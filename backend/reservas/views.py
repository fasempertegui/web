from datetime import date

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods, require_POST, require_safe

from instalaciones.models import Cancha, Sede
from usuarios.models import Usuario
from usuarios.views import datos_json, errores_formulario

from .disponibilidad import consultar_disponibilidad
from .forms import CancelacionForm, ReservaForm
from .models import Reserva
from .servicios import ConflictoReserva, cancelar_reserva, crear_reserva


@require_safe
def disponibilidad(request, cancha_id):
    fecha_texto = request.GET.get("fecha", "")
    try:
        fecha = date.fromisoformat(fecha_texto)
    except ValueError:
        return JsonResponse({"error": "Ingresá la fecha en formato AAAA-MM-DD."}, status=400)
    if fecha.isoformat() != fecha_texto:
        return JsonResponse({"error": "Ingresá la fecha en formato AAAA-MM-DD."}, status=400)

    cancha = Cancha.objects.select_related("sede").filter(pk=cancha_id).first()
    if cancha is None:
        return JsonResponse({"error": "La cancha no existe."}, status=404)
    try:
        datos = consultar_disponibilidad(cancha, fecha)
    except ValidationError as error:
        return JsonResponse({"error": error.messages[0]}, status=400)
    return JsonResponse({"cancha_id": cancha.pk, "fecha": fecha, **datos})


def datos_reserva(reserva):
    evento = reserva.evento
    turno = evento.turno
    return {
        "id": reserva.pk,
        "organizador_id": reserva.organizador_id,
        "cancha_id": turno.cancha_id,
        "cancha": turno.cancha.nombre,
        "sede": turno.cancha.sede.nombre,
        "fecha": turno.fecha,
        "hora_inicio": turno.hora_inicio.isoformat(timespec="minutes"),
        "hora_fin": turno.hora_fin.isoformat(timespec="minutes"),
        "estado": evento.estado,
        "importe": reserva.importe,
        "observaciones": evento.observaciones,
        "motivo_anulacion": evento.motivo_anulacion,
    }


@require_http_methods(["GET", "HEAD", "POST"])
def reservas(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Iniciá sesión para gestionar reservas."}, status=401)
    if request.method in ("GET", "HEAD"):
        propias = Reserva.objects.filter(organizador=request.user).select_related(
            "evento__turno__cancha__sede"
        ).order_by("-evento__turno__fecha", "-evento__turno__hora_inicio", "-pk")
        return JsonResponse({"reservas": [datos_reserva(reserva) for reserva in propias]})

    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = ReservaForm(datos)
    if not form.is_valid():
        return errores_formulario(form)
    valores = form.cleaned_data
    try:
        reserva = crear_reserva(
            request.user, valores["organizador_id"] or request.user.pk,
            valores["cancha_id"], valores["fecha"], valores["hora_inicio"],
            valores["precio_por_turno"], valores["observaciones"],
        )
    except PermissionDenied:
        return JsonResponse({"error": "No podés reservar a nombre de otra persona."}, status=403)
    except (Cancha.DoesNotExist, Sede.DoesNotExist, Usuario.DoesNotExist):
        return JsonResponse({"error": "La cancha o el organizador no están disponibles."}, status=404)
    except ConflictoReserva as error:
        return JsonResponse({"error": error.messages[0]}, status=409)
    except ValidationError as error:
        return JsonResponse({"error": error.messages[0]}, status=400)
    except IntegrityError:
        return JsonResponse({"error": "El turno ya no está disponible. Elegí nuevamente."}, status=409)
    return JsonResponse({"reserva": datos_reserva(reserva)}, status=201)


@require_POST
def cancelar(request, reserva_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Iniciá sesión para gestionar reservas."}, status=401)
    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = CancelacionForm(datos)
    if not form.is_valid():
        return errores_formulario(form)
    try:
        reserva = cancelar_reserva(request.user, reserva_id, form.cleaned_data["motivo"])
    except (Reserva.DoesNotExist, PermissionDenied):
        return JsonResponse({"error": "La reserva no existe."}, status=404)
    except ConflictoReserva as error:
        return JsonResponse({"error": error.messages[0]}, status=409)
    return JsonResponse({"reserva": datos_reserva(reserva)})

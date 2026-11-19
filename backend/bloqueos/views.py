import json

from django import forms
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_safe

from instalaciones.models import Cancha, Sede
from reservas.disponibilidad import horarios_del_dia
from reservas.forms import CancelacionForm
from reservas.models import Evento
from reservas.servicios import ConflictoReserva
from usuarios.views import datos_json, errores_formulario

from .forms import OperacionMasivaForm
from .masivos import confirmar_operacion, preparar_operacion
from .models import Bloqueo
from .servicios import crear_bloqueo, liberar_bloqueo


class AgendaForm(forms.Form):
    cancha_id = forms.IntegerField(min_value=1)
    fecha = forms.DateField(input_formats=["%Y-%m-%d"])


class BloqueoForm(AgendaForm):
    hora_inicio = forms.TimeField(input_formats=["%H:%M"])
    motivo = forms.ChoiceField(choices=Bloqueo.Motivo.choices)
    evento_esperado = forms.IntegerField(min_value=0)
    observaciones = forms.CharField(required=False)


def acceso_denegado():
    return JsonResponse({"error": "Se requiere acceso de administrador."}, status=403)


@require_safe
def agenda(request):
    if not request.user.is_superuser:
        return acceso_denegado()
    form = AgendaForm(request.GET)
    if not form.is_valid():
        return errores_formulario(form)
    fecha = form.cleaned_data["fecha"]
    cancha = Cancha.objects.select_related("sede").filter(pk=form.cleaned_data["cancha_id"]).first()
    if cancha is None:
        return JsonResponse({"error": "La cancha no existe."}, status=404)

    turnos = {
        inicio: {"hora_inicio": inicio, "hora_fin": fin, "evento_id": 0}
        for inicio, fin in horarios_del_dia(cancha.sede, fecha)
    }
    eventos = Evento.objects.filter(
        turno__cancha=cancha, turno__fecha=fecha,
    ).exclude(estado=Evento.Estado.ANULADO).select_related(
        "turno", "bloqueo", "reserva__organizador"
    )
    for evento in eventos:
        turno = evento.turno
        datos = {
            "hora_inicio": turno.hora_inicio,
            "hora_fin": turno.hora_fin,
            "evento_id": evento.pk,
            "tipo": evento.tipo,
            "estado": evento.estado,
            "observaciones": evento.observaciones,
        }
        if evento.tipo == Evento.Tipo.BLOQUEO:
            datos.update(bloqueo_id=evento.bloqueo.pk, motivo=evento.bloqueo.motivo)
        else:
            reserva = evento.reserva
            datos.update(
                reserva_id=reserva.pk, organizador=reserva.organizador.get_full_name(),
                organizador_id=reserva.organizador_id, importe=reserva.importe,
            )
        turnos[turno.hora_inicio] = datos
    for datos in turnos.values():
        for campo in ("hora_inicio", "hora_fin"):
            datos[campo] = datos[campo].isoformat(timespec="minutes")
    return JsonResponse({
        "cancha_id": cancha.pk, "fecha": fecha,
        "turnos": [turnos[inicio] for inicio in sorted(turnos)],
    })


@require_POST
def crear(request):
    if not request.user.is_superuser:
        return acceso_denegado()
    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = BloqueoForm(datos)
    if not form.is_valid():
        return errores_formulario(form)
    try:
        bloqueo = crear_bloqueo(request.user, **form.cleaned_data)
    except (Cancha.DoesNotExist, Sede.DoesNotExist):
        return JsonResponse({"error": "La cancha no existe."}, status=404)
    except ConflictoReserva as error:
        return JsonResponse({"error": error.messages[0]}, status=409)
    except ValidationError as error:
        return JsonResponse({"error": error.messages[0]}, status=400)
    return JsonResponse({"bloqueo_id": bloqueo.pk, "evento_id": bloqueo.evento_id}, status=201)


@require_POST
def liberar(request, bloqueo_id):
    if not request.user.is_superuser:
        return acceso_denegado()
    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = CancelacionForm(datos)
    if not form.is_valid():
        return errores_formulario(form)
    try:
        liberar_bloqueo(request.user, bloqueo_id, form.cleaned_data["motivo"])
    except Bloqueo.DoesNotExist:
        return JsonResponse({"error": "El bloqueo no existe."}, status=404)
    except ConflictoReserva as error:
        return JsonResponse({"error": error.messages[0]}, status=409)
    return JsonResponse({"bloqueo_id": bloqueo_id, "estado": Evento.Estado.ANULADO})


@require_POST
def previsualizar_masivos(request):
    if not request.user.is_superuser:
        return acceso_denegado()
    try:
        datos = json.loads(request.body)
    except ValueError:
        datos = None
    if not isinstance(datos, dict):
        return JsonResponse({"error": "Se esperaba un objeto JSON."}, status=400)
    form = OperacionMasivaForm(datos)
    if not form.is_valid():
        return errores_formulario(form)
    try:
        return JsonResponse(preparar_operacion(request.user, form.cleaned_data))
    except Sede.DoesNotExist:
        return JsonResponse({"error": "La sede no existe."}, status=404)
    except ValidationError as error:
        return JsonResponse({"error": error.messages[0]}, status=400)


@require_POST
def confirmar_masivos(request):
    if not request.user.is_superuser:
        return acceso_denegado()
    datos = datos_json(request)
    if not datos or not datos.get("confirmacion"):
        return JsonResponse({"error": "Ingresá el código de confirmación."}, status=400)
    try:
        return JsonResponse(confirmar_operacion(request.user, datos["confirmacion"]))
    except Sede.DoesNotExist:
        return JsonResponse({"error": "La sede no existe."}, status=404)
    except ValidationError as error:
        return JsonResponse({"error": error.messages[0]}, status=409)

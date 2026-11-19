from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods, require_POST, require_safe

from usuarios.views import datos_json, errores_formulario

from .forms import CanchaForm, HorarioForm, PrecioForm, SedeForm
from .models import Cancha, Sede, SedeHorario


def datos_horario(horario):
    datos = {"dia_semana": horario.dia_semana}
    for campo in ("hora_inicio_1", "hora_fin_1", "hora_inicio_2", "hora_fin_2"):
        valor = getattr(horario, campo)
        datos[campo] = valor.isoformat(timespec="minutes") if valor is not None else None
    return datos


def datos_sede(sede, *, administracion=False):
    datos = {
        "id": sede.pk,
        "nombre": sede.nombre,
        "direccion": sede.direccion,
        "canchas": [
            {"id": cancha.pk, "nombre": cancha.nombre, "superficie": cancha.superficie}
            for cancha in sede.canchas.all()
        ],
        "horarios": [datos_horario(horario) for horario in sede.horarios.all()],
    }
    if administracion:
        datos["precio_reserva_vigente"] = sede.precio_reserva_vigente
    return datos


def acceso_denegado():
    return JsonResponse({"error": "Se requiere acceso de administrador."}, status=403)


def datos_invalidos():
    return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)


def sede_no_encontrada():
    return JsonResponse({"error": "La sede no existe o está inactiva."}, status=404)


@require_safe
def listar_sedes(request):
    canchas = Cancha.objects.filter(estado=Cancha.Estado.ACTIVA)
    sedes = Sede.objects.filter(estado=Sede.Estado.ACTIVA).prefetch_related(
        Prefetch("canchas", queryset=canchas), "horarios"
    )
    return JsonResponse({"sedes": [datos_sede(sede) for sede in sedes]})


@require_http_methods(["GET", "HEAD", "POST"])
def administrar_sedes(request):
    if not request.user.is_superuser:
        return acceso_denegado()
    if request.method in ("GET", "HEAD"):
        sedes = Sede.objects.filter(estado=Sede.Estado.ACTIVA).prefetch_related("canchas", "horarios")
        return JsonResponse({"sedes": [datos_sede(sede, administracion=True) for sede in sedes]})

    datos = datos_json(request)
    if datos is None:
        return datos_invalidos()
    form = SedeForm(datos)
    if not form.is_valid():
        return errores_formulario(form)
    try:
        sede = form.save()
    except IntegrityError:
        form.add_error("nombre", "Ya existe una sede con ese nombre.")
        return errores_formulario(form)
    return JsonResponse({"sede": datos_sede(sede, administracion=True)}, status=201)


@require_POST
@transaction.atomic
def crear_cancha(request, sede_id):
    if not request.user.is_superuser:
        return acceso_denegado()
    sede = Sede.objects.select_for_update().filter(pk=sede_id, estado=Sede.Estado.ACTIVA).first()
    if sede is None:
        return sede_no_encontrada()
    datos = datos_json(request)
    if datos is None:
        return datos_invalidos()
    form = CanchaForm(datos, instance=Cancha(sede=sede))
    if not form.is_valid():
        return errores_formulario(form)
    form.save()
    return JsonResponse({"sede": datos_sede(sede, administracion=True)}, status=201)


@require_http_methods(["PUT"])
@transaction.atomic
def guardar_precio(request, sede_id):
    if not request.user.is_superuser:
        return acceso_denegado()
    sede = Sede.objects.select_for_update().filter(pk=sede_id, estado=Sede.Estado.ACTIVA).first()
    if sede is None:
        return sede_no_encontrada()
    datos = datos_json(request)
    if datos is None or "precio_reserva_vigente" not in datos:
        return datos_invalidos()
    form = PrecioForm(datos, instance=sede)
    if not form.is_valid():
        return errores_formulario(form)
    form.save()
    return JsonResponse({"sede": datos_sede(sede, administracion=True)})


@require_http_methods(["PUT", "DELETE"])
@transaction.atomic
def guardar_horario(request, sede_id, dia):
    if not request.user.is_superuser:
        return acceso_denegado()
    if dia not in SedeHorario.DiaSemana.values:
        return JsonResponse({"error": "Elegí un día de la semana válido."}, status=400)
    sede = Sede.objects.select_for_update().filter(pk=sede_id, estado=Sede.Estado.ACTIVA).first()
    if sede is None:
        return sede_no_encontrada()
    horario = sede.horarios.filter(dia_semana=dia).first()
    if request.method == "DELETE":
        if horario is not None:
            horario.delete()
    else:
        datos = datos_json(request)
        if datos is None:
            return datos_invalidos()
        form = HorarioForm(datos, instance=horario or SedeHorario(sede=sede, dia_semana=dia))
        if not form.is_valid():
            return errores_formulario(form)
        form.save()
    return JsonResponse({"sede": datos_sede(sede, administracion=True)})

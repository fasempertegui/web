import json
from datetime import date, timedelta

from django import forms
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils import timezone
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


class AgendaDiariaForm(forms.Form):
    sede_id = forms.IntegerField(min_value=1)
    fecha = forms.DateField(input_formats=["%Y-%m-%d"])


class HistorialTurnoForm(AgendaForm):
    hora_inicio = forms.TimeField(input_formats=["%H:%M"])


class BloqueoForm(HistorialTurnoForm):
    motivo = forms.ChoiceField(choices=Bloqueo.Motivo.choices)
    evento_esperado = forms.IntegerField(min_value=0)
    observaciones = forms.CharField(required=False)


def acceso_denegado():
    return JsonResponse({"error": "Se requiere acceso de administrador."}, status=403)


def datos_evento(evento, *, es_administrador):
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
        datos.update(reserva_id=reserva.pk, importe=reserva.importe)
        if es_administrador:
            datos.update(
                organizador=reserva.organizador.get_full_name() or reserva.organizador.username,
                organizador_id=reserva.organizador_id,
            )
    return datos


def eventos_del_historial(usuario):
    eventos = Evento.objects.filter(estado=Evento.Estado.ANULADO)
    if not usuario.is_superuser:
        eventos = eventos.filter(tipo=Evento.Tipo.RESERVA, reserva__organizador=usuario)
    return eventos


@require_safe
def historial_turno(request):
    usuario = request.user
    if not usuario.is_authenticated:
        return JsonResponse({"error": "Iniciá sesión para consultar el historial."}, status=401)
    form = HistorialTurnoForm(request.GET)
    if not form.is_valid():
        return errores_formulario(form)
    filtros = form.cleaned_data
    eventos = eventos_del_historial(usuario).filter(
        turno__cancha_id=filtros["cancha_id"],
        turno__fecha=filtros["fecha"],
        turno__hora_inicio=filtros["hora_inicio"],
    ).select_related("bloqueo", "reserva__organizador").order_by("-anulado_en", "-pk")

    historial = []
    for evento in eventos:
        if evento.tipo == Evento.Tipo.BLOQUEO:
            historial.append({"tipo": "bloqueo", "detalle": evento.bloqueo.get_motivo_display()})
        else:
            reserva = evento.reserva
            organizador = reserva.organizador
            fila = {"tipo": "reserva", "detalle": organizador.get_full_name() or organizador.username}
            if reserva.organizador_id == usuario.pk:
                fila["reserva_id"] = reserva.pk
            historial.append(fila)
    return JsonResponse({"historial": historial})


@require_safe
def agenda_diaria(request):
    usuario = request.user
    if not usuario.is_authenticated:
        return JsonResponse({"error": "Iniciá sesión para consultar la agenda."}, status=401)
    form = AgendaDiariaForm(request.GET)
    if not form.is_valid():
        return errores_formulario(form)

    fecha = form.cleaned_data["fecha"]
    ahora = timezone.localtime()
    hoy = ahora.date()
    try:
        maximo = hoy.replace(year=hoy.year + 1)
    except ValueError:
        maximo = hoy.replace(year=hoy.year + 1, day=28)
    if not date(2026, 8, 1) <= fecha <= maximo:
        return JsonResponse({"error": "La fecha está fuera del calendario de la agenda."}, status=400)

    sede = Sede.objects.filter(pk=form.cleaned_data["sede_id"]).first()
    if sede is None:
        return JsonResponse({"error": "La sede no existe."}, status=404)

    horarios = dict(horarios_del_dia(sede, fecha))
    eventos = Evento.objects.filter(
        turno__cancha__sede=sede, turno__fecha=fecha,
    ).exclude(estado=Evento.Estado.ANULADO).select_related(
        "turno", "bloqueo", "reserva__organizador"
    )
    historial = {}
    for cancha_id, inicio in eventos_del_historial(usuario).filter(
        turno__cancha__sede=sede, turno__fecha=fecha,
    ).values_list("turno__cancha_id", "turno__hora_inicio").order_by().distinct():
        historial.setdefault(cancha_id, set()).add(inicio)
    por_cancha = {}
    horas_propias = {hora for horas in historial.values() for hora in horas}
    for evento in eventos:
        turno = evento.turno
        propia = evento.tipo == Evento.Tipo.RESERVA and evento.reserva.organizador_id == usuario.pk
        if propia:
            horas_propias.add(turno.hora_inicio)
        if usuario.is_superuser or propia:
            datos = datos_evento(evento, es_administrador=usuario.is_superuser)
        elif turno.hora_inicio in horarios or turno.hora_inicio in historial.get(turno.cancha_id, ()):
            datos = {"hora_inicio": turno.hora_inicio, "hora_fin": turno.hora_fin, "tipo": "no_disponible"}
        else:
            continue
        por_cancha.setdefault(turno.cancha_id, {})[turno.hora_inicio] = datos

    columnas = []
    for cancha in sede.canchas.all():
        activa = sede.estado == Sede.Estado.ACTIVA and cancha.estado == Cancha.Estado.ACTIVA
        ocupaciones = por_cancha.get(cancha.pk, {})
        horas_historial = historial.get(cancha.pk, set())
        if not activa and not ocupaciones and not horas_historial:
            continue
        turnos = []
        for inicio in sorted(horarios.keys() | ocupaciones.keys() | horas_historial):
            futuro = (fecha, inicio) > (hoy, ahora.time())
            if not usuario.is_superuser and not futuro and inicio not in horas_propias:
                continue
            datos = ocupaciones.get(inicio)
            if datos is None:
                if activa and inicio in horarios:
                    datos = {"hora_inicio": inicio, "hora_fin": horarios[inicio], "evento_id": 0}
                elif inicio in horas_historial:
                    fin = inicio.replace(hour=inicio.hour + 1)
                    datos = {"hora_inicio": inicio, "hora_fin": fin, "tipo": "solo_historial"}
                else:
                    continue
            datos.update(
                tiene_historial=inicio in horas_historial,
                en_horario=activa and inicio in horarios,
                reservable=(
                    activa and inicio in horarios and futuro and inicio not in ocupaciones
                    and fecha <= hoy + timedelta(days=3) and sede.precio_reserva_vigente is not None
                ),
                iniciado=not futuro,
            )
            for campo in ("hora_inicio", "hora_fin"):
                datos[campo] = datos[campo].isoformat(timespec="minutes")
            turnos.append(datos)
        columnas.append({"cancha": {"id": cancha.pk, "nombre": cancha.nombre}, "turnos": turnos})
    return JsonResponse({"sede_id": sede.pk, "fecha": fecha, "columnas": columnas})


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
        datos = datos_evento(evento, es_administrador=True)
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

from datetime import time, timedelta

from django.core.exceptions import ValidationError
from django.utils import timezone

from instalaciones.models import Cancha, Sede

from .models import Evento


def validar_fecha_reserva(fecha, hoy):
    if not hoy <= fecha <= hoy + timedelta(days=3):
        raise ValidationError("Elegí una fecha desde hoy hasta tres días después, inclusive.")


def consultar_disponibilidad(cancha, fecha):
    ahora = timezone.localtime()
    validar_fecha_reserva(fecha, ahora.date())

    sede = cancha.sede
    if sede.estado != Sede.Estado.ACTIVA or cancha.estado != Cancha.Estado.ACTIVA:
        raise ValidationError("La sede y la cancha deben estar activas para consultar disponibilidad.")
    precio = sede.precio_reserva_vigente
    if precio is None:
        raise ValidationError("La sede necesita un precio por turno configurado para ofrecer turnos.")

    horario = sede.horarios.filter(dia_semana=fecha.isoweekday()).first()
    franjas = []
    if horario is not None:
        franjas.append((horario.hora_inicio_1, horario.hora_fin_1))
        if horario.hora_inicio_2 is not None:
            franjas.append((horario.hora_inicio_2, horario.hora_fin_2))

    ocupados = set(
        Evento.objects.filter(
            turno__cancha=cancha,
            turno__fecha=fecha,
            estado__in=(Evento.Estado.PROGRAMADO, Evento.Estado.FINALIZADO),
        ).values_list("turno__hora_inicio", flat=True)
    )
    turnos = []
    for hora in range(23):
        inicio, fin = time(hora), time(hora + 1)
        if inicio in ocupados or (fecha == ahora.date() and inicio <= ahora.time()):
            continue
        if any(apertura <= inicio and fin <= cierre for apertura, cierre in franjas):
            turnos.append({
                "hora_inicio": inicio.isoformat(timespec="minutes"),
                "hora_fin": fin.isoformat(timespec="minutes"),
            })
    return {"precio_por_turno": precio, "turnos": turnos}

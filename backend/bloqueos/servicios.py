from calendar import monthrange
from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from instalaciones.models import Cancha, Sede
from reservas.disponibilidad import horarios_del_dia
from reservas.models import Evento, Turno
from reservas.servicios import ConflictoReserva, cancelar_reserva

from .models import Bloqueo, CierreMalTiempo


def validar_inicio_bloqueo(fecha, hora):
    ahora = timezone.localtime()
    anio, mes = divmod(ahora.year * 12 + ahora.month + 1, 12)
    mes += 1
    limite = date(anio, mes, monthrange(anio, mes)[1])
    if not date(2026, 8, 1) <= fecha <= limite:
        raise ValidationError("La fecha está fuera del calendario operativo.")
    if (fecha, hora) <= (ahora.date(), ahora.time()):
        raise ConflictoReserva("Sólo se puede bloquear un turno antes de su inicio.")


@transaction.atomic
def crear_bloqueo(actor, cancha_id, fecha, hora_inicio, motivo, evento_esperado, observaciones, *, cierre=None):
    cancha = Cancha.objects.get(pk=cancha_id)
    sede = Sede.objects.select_for_update().get(pk=cancha.sede_id)
    cancha = Cancha.objects.select_for_update().get(pk=cancha_id, sede=sede)
    if sede.estado != Sede.Estado.ACTIVA or cancha.estado != Cancha.Estado.ACTIVA:
        raise ValidationError("La sede y la cancha deben estar activas.")
    validar_inicio_bloqueo(fecha, hora_inicio)
    if not any(inicio == hora_inicio for inicio, _ in horarios_del_dia(sede, fecha)):
        raise ValidationError("El bloqueo debe estar dentro de una franja de funcionamiento.")

    turno, _ = Turno.objects.get_or_create(cancha=cancha, fecha=fecha, hora_inicio=hora_inicio)
    turno = Turno.objects.select_for_update().get(pk=turno.pk)
    origen = turno.eventos.select_for_update().exclude(estado=Evento.Estado.ANULADO).first()
    if (origen.pk if origen else 0) != evento_esperado:
        raise ConflictoReserva("La actividad del turno cambió. Revisá la agenda antes de confirmar.")
    if origen:
        if origen.tipo != Evento.Tipo.RESERVA or origen.estado != Evento.Estado.PROGRAMADO:
            raise ConflictoReserva("El turno ya está ocupado.")
        cancelar_reserva(actor, origen.reserva.pk, Bloqueo.Motivo(motivo).label)

    evento = Evento.objects.create(
        turno=turno, tipo=Evento.Tipo.BLOQUEO, registrado_por=actor, observaciones=observaciones
    )
    bloqueo = Bloqueo.objects.create(evento=evento, motivo=motivo, evento_origen=origen, cierre=cierre)
    validar_inicio_bloqueo(fecha, hora_inicio)
    return bloqueo


@transaction.atomic
def liberar_bloqueo(actor, bloqueo_id, motivo, *, desde_cierre=False):
    bloqueo = Bloqueo.objects.select_related("evento").get(pk=bloqueo_id)
    turno = Turno.objects.select_for_update().get(pk=bloqueo.evento.turno_id)
    evento = Evento.objects.select_for_update().get(pk=bloqueo.evento_id)
    ahora = timezone.localtime()
    inicio = timezone.make_aware(datetime.combine(turno.fecha, turno.hora_inicio))
    if not desde_cierre and CierreMalTiempo.objects.filter(
        sedes__canchas=turno.cancha_id, desde__lte=inicio, hasta__gt=inicio,
    ).exists():
        raise ConflictoReserva("El turno está cubierto por un cierre por mal tiempo. Revisá el cierre antes de liberarlo.")
    if evento.estado != Evento.Estado.PROGRAMADO:
        raise ConflictoReserva("Sólo se pueden liberar bloqueos programados.")
    if (turno.fecha, turno.hora_inicio) <= (ahora.date(), ahora.time()):
        raise ConflictoReserva("Sólo se puede liberar un bloqueo antes de su inicio.")
    evento.estado = Evento.Estado.ANULADO
    evento.anulado_por = actor
    evento.anulado_en = ahora
    evento.motivo_anulacion = motivo
    evento.save(update_fields=[
        "estado", "anulado_por", "anulado_en", "motivo_anulacion", "actualizado_en"
    ])
    return bloqueo

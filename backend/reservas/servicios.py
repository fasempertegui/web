from decimal import Decimal

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from instalaciones.models import Cancha, Sede
from notificaciones.models import Notificacion
from usuarios.models import Usuario

from .disponibilidad import consultar_disponibilidad
from .models import Evento, Reserva, Turno


class ConflictoReserva(ValidationError):
    pass


@transaction.atomic
def crear_reserva(actor, organizador_id, cancha_id, fecha, hora, precio, observaciones):
    if actor.pk != organizador_id and not actor.is_superuser:
        raise PermissionDenied
    organizador = Usuario.objects.select_for_update().get(pk=organizador_id, is_active=True)
    cancha = Cancha.objects.get(pk=cancha_id)
    sede = Sede.objects.select_for_update().get(pk=cancha.sede_id)
    cancha = Cancha.objects.select_for_update().get(pk=cancha_id, sede=sede)
    cancha.sede = sede

    disponibilidad = consultar_disponibilidad(cancha, fecha)
    if disponibilidad["precio_por_turno"] != Decimal(precio):
        raise ConflictoReserva("El precio cambió. Revisá nuevamente la reserva.")
    if not any(turno["hora_inicio"] == hora.isoformat(timespec="minutes")
               for turno in disponibilidad["turnos"]):
        raise ConflictoReserva("El turno ya no está disponible. Elegí nuevamente.")

    reservas = organizador.reservas.exclude(evento__estado=Evento.Estado.ANULADO)
    if reservas.filter(evento__estado=Evento.Estado.PROGRAMADO).count() >= 2:
        raise ConflictoReserva("El organizador ya tiene dos reservas programadas.")
    if reservas.filter(evento__turno__fecha=fecha, evento__turno__hora_inicio=hora).exists():
        raise ConflictoReserva("El organizador ya tiene una reserva a esa hora.")

    turno, _ = Turno.objects.get_or_create(cancha=cancha, fecha=fecha, hora_inicio=hora)
    evento = Evento.objects.create(
        turno=turno, tipo=Evento.Tipo.RESERVA, registrado_por=actor, observaciones=observaciones
    )
    reserva = Reserva.objects.create(evento=evento, organizador=organizador, importe=precio)
    Notificacion.objects.create(reserva=reserva, tipo=Notificacion.Tipo.RESERVA_CREADA)
    return reserva


@transaction.atomic
def cancelar_reserva(actor, reserva_id, motivo):
    reserva = Reserva.objects.select_related("evento__turno__cancha").get(pk=reserva_id)
    if actor.pk != reserva.organizador_id and not actor.is_superuser:
        raise PermissionDenied
    turno = Turno.objects.select_for_update().get(pk=reserva.evento.turno_id)
    evento = Evento.objects.select_for_update().get(pk=reserva.evento_id)
    ahora = timezone.localtime()
    if evento.estado != Evento.Estado.PROGRAMADO:
        raise ConflictoReserva("Sólo se pueden cancelar reservas programadas.")
    if (turno.fecha, turno.hora_inicio) <= (ahora.date(), ahora.time()):
        raise ConflictoReserva("Sólo se puede cancelar una reserva antes de su inicio.")
    evento.estado = Evento.Estado.ANULADO
    evento.anulado_por = actor
    evento.anulado_en = ahora
    evento.motivo_anulacion = motivo
    evento.save(update_fields=[
        "estado", "anulado_por", "anulado_en", "motivo_anulacion", "actualizado_en"
    ])
    evento.turno = turno
    reserva.evento = evento
    Notificacion.objects.create(reserva=reserva, tipo=Notificacion.Tipo.RESERVA_ANULADA)
    return reserva

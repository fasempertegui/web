from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from reservas.models import Evento


class Command(BaseCommand):
    help = "Finaliza las reservas cuyo turno ya terminó."

    def handle(self, *args, **options):
        ahora = timezone.localtime()
        limite = ahora - timedelta(hours=1)
        cantidad = Evento.objects.filter(
            Q(turno__fecha__lt=limite.date())
            | Q(turno__fecha=limite.date(), turno__hora_inicio__lte=limite.time()),
            tipo=Evento.Tipo.RESERVA,
            estado=Evento.Estado.PROGRAMADO,
        ).update(
            estado=Evento.Estado.FINALIZADO,
            finalizado_en=ahora,
            actualizado_en=ahora,
        )
        self.stdout.write(f"Reservas finalizadas: {cantidad}")

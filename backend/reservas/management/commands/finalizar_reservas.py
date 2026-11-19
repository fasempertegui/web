from datetime import timedelta
from time import sleep

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections
from django.db.models import Q
from django.utils import timezone

from reservas.models import Evento


class Command(BaseCommand):
    help = "Finaliza las reservas cuyo turno ya terminó."

    def add_arguments(self, parser):
        parser.add_argument("--intervalo", type=int, help="Segundos entre ejecuciones.")

    def handle(self, *args, intervalo, **options):
        if intervalo is not None and intervalo < 1:
            raise CommandError("El intervalo debe ser mayor que cero.")
        while True:
            self.finalizar_vencidas()
            if intervalo is None:
                return
            close_old_connections()
            sleep(intervalo)

    def finalizar_vencidas(self):
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

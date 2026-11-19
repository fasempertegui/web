from django.conf import settings
from django.db import models

from reservas.models import Evento


class CierreMalTiempo(models.Model):
    sedes = models.ManyToManyField("instalaciones.Sede", related_name="cierres_por_mal_tiempo")
    desde = models.DateTimeField()
    hasta = models.DateTimeField()
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-desde", "-pk")
        constraints = [
            models.CheckConstraint(condition=models.Q(hasta__gt=models.F("desde")), name="cierre_intervalo_valido"),
        ]


class Bloqueo(models.Model):
    class Motivo(models.TextChoices):
        MAL_TIEMPO = "clima_adverso", "Mal tiempo"
        TORNEO = "torneo", "Torneo"
        MANTENIMIENTO = "mantenimiento", "Mantenimiento"

    id = models.BigAutoField(primary_key=True)
    evento = models.OneToOneField(
        Evento,
        on_delete=models.PROTECT,
        related_name="bloqueo",
        limit_choices_to={"tipo": Evento.Tipo.BLOQUEO},
    )
    motivo = models.CharField(max_length=20, choices=Motivo.choices)
    cierre = models.ForeignKey(
        CierreMalTiempo, on_delete=models.PROTECT, related_name="bloqueos", null=True, blank=True
    )
    evento_origen = models.OneToOneField(
        Evento,
        on_delete=models.PROTECT,
        related_name="bloqueo_originado",
        null=True,
        blank=True,
        limit_choices_to={"tipo": Evento.Tipo.RESERVA, "estado": Evento.Estado.ANULADO},
    )

    class Meta:
        db_table = "bloqueos"
        ordering = ("-evento__creado_en", "-pk")
        default_permissions = ()
        constraints = [
            models.CheckConstraint(
                condition=models.Q(motivo__in=("clima_adverso", "torneo", "mantenimiento")),
                name="bloqueo_motivo_valido",
            ),
        ]
        verbose_name = "bloqueo"
        verbose_name_plural = "bloqueos"

    def __str__(self):
        return f"Bloqueo {self.pk}"

    @property
    def numero(self):
        return f"B-{self.pk:06d}" if self.pk is not None else ""


MOTIVOS_PUNTUALES = [
    (motivo.value, motivo.label)
    for motivo in (Bloqueo.Motivo.TORNEO, Bloqueo.Motivo.MANTENIMIENTO)
]

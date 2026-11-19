from django.db import models


class Notificacion(models.Model):
    class Tipo(models.TextChoices):
        RESERVA_CREADA = "reserva_creada", "Tu reserva fue confirmada."
        RESERVA_ANULADA = "reserva_anulada", "Tu reserva fue anulada. Consultá el motivo en el detalle."

    reserva = models.ForeignKey(
        "reservas.Reserva", on_delete=models.PROTECT, related_name="notificaciones"
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    creado_en = models.DateTimeField(auto_now_add=True)
    leida_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-creado_en", "-pk")
        constraints = [
            models.UniqueConstraint(
                fields=("reserva", "tipo"), name="notificacion_reserva_tipo_unico"
            ),
        ]

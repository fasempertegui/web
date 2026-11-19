from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower


class Usuario(AbstractUser):
    email = models.EmailField()
    celular_contacto = models.CharField(max_length=30, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="usuario_email_unico"),
        ]

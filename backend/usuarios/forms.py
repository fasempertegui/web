import re
import unicodedata

import phonenumbers
from django import forms
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Usuario

def _normalizar_para_usuario(texto):
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z]", "", texto.lower())


def validar_nombre_sin_numeros(valor):
    if any(caracter.isnumeric() for caracter in valor):
        raise forms.ValidationError("No se permiten números.")


def validar_email_disponible(email, *, excluir_usuario=None):
    usuarios = Usuario.objects.filter(email__iexact=email)
    if excluir_usuario and excluir_usuario.pk:
        usuarios = usuarios.exclude(pk=excluir_usuario.pk)
    if usuarios.exists():
        raise forms.ValidationError("Ya existe un usuario registrado con ese email.")
    return email


def generar_nombre_usuario(nombre, apellido):
    validar_nombre_sin_numeros(nombre)
    validar_nombre_sin_numeros(apellido)
    base = _normalizar_para_usuario(apellido)
    inicial = _normalizar_para_usuario(nombre)[:1]
    if not base or not inicial:
        raise forms.ValidationError(
            "Ingresá un nombre y un apellido con letras para generar el usuario."
        )
    candidato = f"{base}{inicial}"
    sufijo = 1
    resultado = candidato
    while Usuario.objects.filter(username__iexact=resultado).exists():
        resultado = f"{candidato}{sufijo}"
        sufijo += 1
    return resultado


def crear_usuario_con_nombre_generado(nombre, apellido, **datos):
    while True:
        nombre_usuario = generar_nombre_usuario(nombre, apellido)
        try:
            with transaction.atomic():
                return Usuario.objects.create_user(
                    username=nombre_usuario,
                    first_name=nombre,
                    last_name=apellido,
                    **datos,
                )
        except IntegrityError:
            # Si otra alta ocupó el nombre, se busca el siguiente sufijo disponible.
            if not Usuario.objects.filter(username__iexact=nombre_usuario).exists():
                raise


def validar_celular_ar(valor):
    try:
        numero = phonenumbers.parse(valor, "AR")
    except phonenumbers.NumberParseException:
        raise forms.ValidationError("El formato del celular no es válido.")

    if numero.country_code != 54:
        raise forms.ValidationError("El celular debe ser argentino.")

    if (
        phonenumbers.is_valid_number(numero)
        and phonenumbers.number_type(numero) == phonenumbers.PhoneNumberType.MOBILE
    ):
        return phonenumbers.format_number(numero, phonenumbers.PhoneNumberFormat.E164)

    # El campo es exclusivamente para celulares. Si se ingresó el número
    # nacional sin 9 ni 15, se agrega el indicador móvil argentino antes de
    # validarlo y guardarlo en formato internacional.
    numero_nacional = phonenumbers.national_significant_number(numero)
    try:
        numero = phonenumbers.parse(f"+549{numero_nacional}", None)
    except phonenumbers.NumberParseException:
        raise forms.ValidationError("El número de celular no es válido.")

    if (
        not phonenumbers.is_valid_number(numero)
        or phonenumbers.number_type(numero) != phonenumbers.PhoneNumberType.MOBILE
    ):
        raise forms.ValidationError("El número de celular no es válido.")

    return phonenumbers.format_number(numero, phonenumbers.PhoneNumberFormat.E164)


def _sumar_anios(fecha, cantidad):
    try:
        return fecha.replace(year=fecha.year + cantidad)
    except ValueError:
        # 29 de febrero en un año no bisiesto.
        return fecha.replace(year=fecha.year + cantidad, day=28)


def fecha_minima_nacimiento():
    return _sumar_anios(timezone.localdate(), -120)


def validar_fecha_nacimiento(fecha):
    hoy = timezone.localdate()
    if fecha > hoy:
        raise forms.ValidationError("La fecha de nacimiento no puede ser futura.")
    minima = fecha_minima_nacimiento()
    if fecha < minima:
        raise forms.ValidationError(
            f"La fecha de nacimiento no puede ser anterior al {minima:%d/%m/%Y}."
        )


class PerfilForm(forms.Form):
    nombre = forms.CharField(max_length=100, validators=[validar_nombre_sin_numeros])
    apellido = forms.CharField(max_length=100, validators=[validar_nombre_sin_numeros])
    celular_contacto = forms.CharField(max_length=30, validators=[validar_celular_ar])
    fecha_nacimiento = forms.DateField(
        input_formats=["%Y-%m-%d"], validators=[validar_fecha_nacimiento]
    )


class RegistroForm(PerfilForm):
    email = forms.EmailField()
    contrasena = forms.CharField(strip=False)
    confirmar_contrasena = forms.CharField(strip=False)

    def clean_email(self):
        return validar_email_disponible(self.cleaned_data["email"])

    def clean(self):
        datos = super().clean()
        if self.errors:
            return datos
        if datos["contrasena"] != datos["confirmar_contrasena"]:
            self.add_error("confirmar_contrasena", "Las contraseñas no coinciden.")
        try:
            usuario = Usuario(
                username=generar_nombre_usuario(datos["nombre"], datos["apellido"]),
                first_name=datos["nombre"],
                last_name=datos["apellido"],
                email=datos["email"],
            )
            validate_password(datos["contrasena"], usuario)
        except forms.ValidationError as error:
            self.add_error(None, error)
        return datos

    def guardar(self):
        datos = self.cleaned_data
        return crear_usuario_con_nombre_generado(
            datos["nombre"], datos["apellido"],
            email=datos["email"], password=datos["contrasena"],
            celular_contacto=datos["celular_contacto"],
            fecha_nacimiento=datos["fecha_nacimiento"],
        )


class CorreoForm(forms.Form):
    email = forms.EmailField()

    def __init__(self, usuario, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.usuario = usuario

    def clean_email(self):
        return validar_email_disponible(
            self.cleaned_data["email"], excluir_usuario=self.usuario
        )

from django import forms

from .models import Cancha, Sede, SedeHorario


class SedeForm(forms.ModelForm):
    class Meta:
        model = Sede
        fields = ("nombre", "direccion")


class PrecioForm(forms.ModelForm):
    class Meta:
        model = Sede
        fields = ("precio_reserva_vigente",)


class CanchaForm(forms.ModelForm):
    class Meta:
        model = Cancha
        fields = ("nombre", "superficie")

    def clean_nombre(self):
        nombre = self.cleaned_data["nombre"]
        if self.instance.sede.canchas.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError("Ya existe una cancha con ese nombre en esta sede.")
        return nombre


class HorarioForm(forms.ModelForm):
    class Meta:
        model = SedeHorario
        fields = ("hora_inicio_1", "hora_fin_1", "hora_inicio_2", "hora_fin_2")

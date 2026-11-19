from django import forms


class ReservaForm(forms.Form):
    cancha_id = forms.IntegerField(min_value=1)
    organizador_id = forms.IntegerField(min_value=1, required=False)
    fecha = forms.DateField(input_formats=["%Y-%m-%d"])
    hora_inicio = forms.TimeField(input_formats=["%H:%M"])
    precio_por_turno = forms.DecimalField(max_digits=12, decimal_places=2)
    observaciones = forms.CharField(required=False)


class CancelacionForm(forms.Form):
    motivo = forms.CharField(min_length=5)

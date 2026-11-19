from datetime import date

from django import forms

from .models import Bloqueo


class CanchasField(forms.Field):
    def to_python(self, value):
        if value is None:
            return []
        if not isinstance(value, list) or any(type(pk) is not int or pk < 1 for pk in value):
            raise forms.ValidationError("Seleccioná una lista de canchas válidas.")
        return sorted(set(value))


class OperacionMasivaForm(forms.Form):
    sede_id = forms.IntegerField(min_value=1)
    canchas = CanchasField(required=False)
    operacion = forms.ChoiceField(choices=[("bloquear", "Bloquear"), ("liberar", "Liberar")])
    fecha = forms.DateField(input_formats=["%Y-%m-%d"], required=False)
    mes = forms.RegexField(r"^[0-9]{4}-(0[1-9]|1[0-2])$", required=False)
    desde_hora = forms.TimeField(input_formats=["%H:%M"], required=False)
    hasta_hora = forms.TimeField(input_formats=["%H:%M"], required=False)
    conservar_reservas = forms.BooleanField(required=False)
    conservar_bloqueos = forms.BooleanField(required=False)
    motivo = forms.CharField(required=False)
    observaciones = forms.CharField(required=False)

    def clean_mes(self):
        mes = self.cleaned_data["mes"]
        if mes:
            try:
                date.fromisoformat(mes + "-01")
            except ValueError as error:
                raise forms.ValidationError("Ingresá un mes válido.") from error
        return mes

    def clean(self):
        datos = super().clean()
        if self.errors:
            return datos
        if bool(datos["fecha"]) == bool(datos["mes"]):
            raise forms.ValidationError("Elegí una fecha o un mes.")
        if datos["operacion"] == "bloquear":
            if datos["mes"]:
                raise forms.ValidationError("Las acciones del mes sólo permiten liberar turnos.")
            if datos["motivo"] not in Bloqueo.Motivo.values:
                self.add_error("motivo", "Elegí un motivo de bloqueo válido.")
        inicio, fin = datos["desde_hora"], datos["hasta_hora"]
        if fin and (not inicio or inicio >= fin):
            self.add_error("hasta_hora", "El fin debe ser posterior al inicio.")
        for campo, valor in (("desde_hora", inicio), ("hasta_hora", fin)):
            if valor and (valor.minute or valor.second or valor.microsecond):
                self.add_error(campo, "Ingresá una hora en punto.")
        if not self.errors:
            datos["fecha"] = datos["fecha"].isoformat() if datos["fecha"] else None
            datos["desde_hora"] = inicio.strftime("%H:%M") if inicio else None
            datos["hasta_hora"] = fin.strftime("%H:%M") if fin else None
        return datos

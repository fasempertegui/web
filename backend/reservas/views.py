from datetime import date

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_safe

from instalaciones.models import Cancha

from .disponibilidad import consultar_disponibilidad


@require_safe
def disponibilidad(request, cancha_id):
    fecha_texto = request.GET.get("fecha", "")
    try:
        fecha = date.fromisoformat(fecha_texto)
    except ValueError:
        return JsonResponse({"error": "Ingresá la fecha en formato AAAA-MM-DD."}, status=400)
    if fecha.isoformat() != fecha_texto:
        return JsonResponse({"error": "Ingresá la fecha en formato AAAA-MM-DD."}, status=400)

    cancha = Cancha.objects.select_related("sede").filter(pk=cancha_id).first()
    if cancha is None:
        return JsonResponse({"error": "La cancha no existe."}, status=404)
    try:
        datos = consultar_disponibilidad(cancha, fecha)
    except ValidationError as error:
        return JsonResponse({"error": error.messages[0]}, status=400)
    return JsonResponse({"cancha_id": cancha.pk, "fecha": fecha, **datos})

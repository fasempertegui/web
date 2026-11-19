from django.db.models import Prefetch
from django.http import JsonResponse
from django.views.decorators.http import require_safe

from .models import Cancha, Sede


@require_safe
def listar_sedes(request):
    canchas = Cancha.objects.filter(estado=Cancha.Estado.ACTIVA)
    sedes = Sede.objects.filter(estado=Sede.Estado.ACTIVA).prefetch_related(
        Prefetch("canchas", queryset=canchas), "horarios"
    )
    return JsonResponse({
        "sedes": [
            {
                "id": sede.pk,
                "nombre": sede.nombre,
                "direccion": sede.direccion,
                "canchas": [
                    {"id": cancha.pk, "nombre": cancha.nombre, "superficie": cancha.superficie}
                    for cancha in sede.canchas.all()
                ],
                "horarios": [
                    {
                        "dia_semana": horario.dia_semana,
                        "hora_inicio_1": horario.hora_inicio_1.isoformat(timespec="minutes"),
                        "hora_fin_1": horario.hora_fin_1.isoformat(timespec="minutes"),
                        "hora_inicio_2": (
                            horario.hora_inicio_2.isoformat(timespec="minutes")
                            if horario.hora_inicio_2 is not None else None
                        ),
                        "hora_fin_2": (
                            horario.hora_fin_2.isoformat(timespec="minutes")
                            if horario.hora_fin_2 is not None else None
                        ),
                    }
                    for horario in sede.horarios.all()
                ],
            }
            for sede in sedes
        ]
    })

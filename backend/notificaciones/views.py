from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST, require_safe

from .models import Notificacion


def propias(usuario):
    return Notificacion.objects.filter(reserva__organizador=usuario)


def sesion_requerida():
    return JsonResponse({"error": "Iniciá sesión para consultar tus notificaciones."}, status=401)


@require_safe
def listar(request):
    if not request.user.is_authenticated:
        return sesion_requerida()
    filtro = request.GET.get("estado", "todas")
    if filtro not in ("todas", "sin_leer", "leidas"):
        return JsonResponse({"error": "El filtro de notificaciones no es válido."}, status=400)

    notificaciones = propias(request.user)
    sin_leer = notificaciones.filter(leida_en__isnull=True)
    if filtro == "sin_leer":
        notificaciones = sin_leer
    elif filtro == "leidas":
        notificaciones = notificaciones.filter(leida_en__isnull=False)

    paginas = Paginator(notificaciones, 25)
    try:
        pagina = paginas.page(request.GET.get("pagina", 1))
    except (EmptyPage, PageNotAnInteger):
        return JsonResponse({"error": "La página de notificaciones no es válida."}, status=400)
    return JsonResponse({
        "pagina": pagina.number,
        "paginas": paginas.num_pages,
        "sin_leer": sin_leer.count(),
        "notificaciones": [
            {
                "id": aviso.pk,
                "reserva_id": aviso.reserva_id,
                "tipo": aviso.tipo,
                "mensaje": aviso.get_tipo_display(),
                "creado_en": aviso.creado_en,
                "leida_en": aviso.leida_en,
            }
            for aviso in pagina
        ],
    })


@require_POST
def leer(request, notificacion_id):
    if not request.user.is_authenticated:
        return sesion_requerida()
    aviso = propias(request.user).filter(pk=notificacion_id)
    if not aviso.exists():
        return JsonResponse({"error": "La notificación no existe."}, status=404)
    aviso.filter(leida_en__isnull=True).update(leida_en=timezone.now())
    return JsonResponse({"leida_en": aviso.values_list("leida_en", flat=True).get()})


@require_POST
def leer_todas(request):
    if not request.user.is_authenticated:
        return sesion_requerida()
    cantidad = propias(request.user).filter(leida_en__isnull=True).update(leida_en=timezone.now())
    return JsonResponse({"marcadas": cantidad})

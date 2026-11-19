from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from django.views.decorators.http import require_safe
from instalaciones.views import listar_sedes
from reservas import views as reservas
from usuarios import views as usuarios


@require_safe
def estado_api(request):
    return JsonResponse({"estado": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/estado/", estado_api),
    path("api/sedes/", listar_sedes),
    path("api/canchas/<int:cancha_id>/disponibilidad/", reservas.disponibilidad),
    path("api/reservas/", reservas.reservas),
    path("api/reservas/<int:reserva_id>/cancelar/", reservas.cancelar),
    path("api/sesion/", usuarios.sesion),
    path("api/registro/", usuarios.registro),
    path("api/sesion/iniciar/", usuarios.iniciar_sesion),
    path("api/sesion/cerrar/", usuarios.cerrar_sesion),
    path("api/perfil/", usuarios.perfil),
    path("api/usuarios/", usuarios.buscar_usuarios),
    path("api/usuarios/<int:usuario_id>/correo/", usuarios.cambiar_correo),
    path("api/usuarios/<int:usuario_id>/contrasena/", usuarios.restablecer_contrasena),
]

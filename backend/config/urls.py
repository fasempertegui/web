from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from django.views.decorators.http import require_safe


@require_safe
def estado_api(request):
    return JsonResponse({"estado": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/estado/", estado_api),
]

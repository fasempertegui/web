import json

from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm, SetPasswordForm
from django.db import IntegrityError
from django.db.models import Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.csrf import csrf_failure
from django.views.decorators.http import require_http_methods, require_POST, require_safe

from .forms import CorreoForm, PerfilForm, RegistroForm
from .models import Usuario


def error_csrf(request, reason=""):
    if request.path.startswith("/api/"):
        return JsonResponse({"error": "Token CSRF inválido."}, status=403)
    return csrf_failure(request, reason=reason)


def datos_json(request):
    try:
        datos = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return None
    if isinstance(datos, dict) and all(isinstance(valor, str) for valor in datos.values()):
        return datos
    return None


def errores_formulario(form):
    return JsonResponse({"errores": form.errors.get_json_data()}, status=400)


def datos_usuario(usuario):
    return {
        "id": usuario.pk,
        "nombre_usuario": usuario.username,
        "nombre": usuario.first_name,
        "apellido": usuario.last_name,
        "email": usuario.email,
        "celular_contacto": usuario.celular_contacto,
        "fecha_nacimiento": usuario.fecha_nacimiento,
        "es_administrador": usuario.is_superuser,
    }


@require_safe
def sesion(request):
    usuario = datos_usuario(request.user) if request.user.is_authenticated else None
    return JsonResponse({"usuario": usuario, "csrf_token": get_token(request)})


@require_POST
def registro(request):
    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = RegistroForm(datos)
    if not form.is_valid():
        return errores_formulario(form)
    try:
        usuario = form.guardar()
    except IntegrityError:
        if not Usuario.objects.filter(email__iexact=form.cleaned_data["email"]).exists():
            raise
        form.add_error("email", "Ya existe un usuario registrado con ese email.")
        return errores_formulario(form)
    return JsonResponse({"nombre_usuario": usuario.username}, status=201)


@require_POST
def iniciar_sesion(request):
    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = AuthenticationForm(request, data={
        "username": datos.get("nombre_usuario"),
        "password": datos.get("contrasena"),
    })
    if not form.is_valid():
        return errores_formulario(form)
    login(request, form.get_user())
    return JsonResponse({
        "usuario": datos_usuario(request.user), "csrf_token": get_token(request),
    })


@require_POST
def cerrar_sesion(request):
    logout(request)
    return JsonResponse({"usuario": None, "csrf_token": get_token(request)})


@require_http_methods(["GET", "HEAD", "PUT"])
def perfil(request):
    usuario = request.user
    if not usuario.is_authenticated:
        return JsonResponse({"error": "Iniciá sesión para acceder al perfil."}, status=401)
    if request.method == "PUT":
        datos = datos_json(request)
        if datos is None:
            return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
        form = PerfilForm(datos)
        if not form.is_valid():
            return errores_formulario(form)
        usuario.first_name = form.cleaned_data["nombre"]
        usuario.last_name = form.cleaned_data["apellido"]
        usuario.celular_contacto = form.cleaned_data["celular_contacto"]
        usuario.fecha_nacimiento = form.cleaned_data["fecha_nacimiento"]
        usuario.save(update_fields=["first_name", "last_name", "celular_contacto", "fecha_nacimiento"])
    return JsonResponse({"usuario": datos_usuario(usuario)})


@require_safe
def buscar_usuarios(request):
    if not request.user.is_superuser:
        return JsonResponse({"error": "Se requiere acceso de administrador."}, status=403)
    busqueda = request.GET.get("q", "").strip()
    usuarios = Usuario.objects.filter(
        Q(username__icontains=busqueda) | Q(email__icontains=busqueda)
        | Q(first_name__icontains=busqueda) | Q(last_name__icontains=busqueda)
    ).order_by("username")
    return JsonResponse({"usuarios": [datos_usuario(usuario) for usuario in usuarios]})


def cuenta_administrada(request, usuario_id):
    if not request.user.is_superuser:
        return None, JsonResponse({"error": "Se requiere acceso de administrador."}, status=403)
    usuario = Usuario.objects.filter(pk=usuario_id).first()
    if usuario is None:
        return None, JsonResponse({"error": "La cuenta no existe."}, status=404)
    return usuario, None


@require_POST
def cambiar_correo(request, usuario_id):
    usuario, error = cuenta_administrada(request, usuario_id)
    if error is not None:
        return error
    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = CorreoForm(usuario, datos)
    if not form.is_valid():
        return errores_formulario(form)
    usuario.email = form.cleaned_data["email"]
    try:
        usuario.save(update_fields=["email"])
    except IntegrityError:
        form.add_error("email", "Ya existe un usuario registrado con ese email.")
        return errores_formulario(form)
    return JsonResponse({"usuario": datos_usuario(usuario)})


@require_POST
def restablecer_contrasena(request, usuario_id):
    usuario, error = cuenta_administrada(request, usuario_id)
    if error is not None:
        return error
    datos = datos_json(request)
    if datos is None:
        return JsonResponse({"error": "Se esperaba un objeto JSON con campos de texto."}, status=400)
    form = SetPasswordForm(usuario, {
        "new_password1": datos.get("contrasena"),
        "new_password2": datos.get("confirmar_contrasena"),
    })
    if not form.is_valid():
        return errores_formulario(form)
    form.save()
    return JsonResponse({"usuario": datos_usuario(usuario)})

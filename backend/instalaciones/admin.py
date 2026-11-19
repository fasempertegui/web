from django.contrib import admin

from .models import Cancha, Sede, SedeHorario


class SedeHorarioInline(admin.TabularInline):
    model = SedeHorario
    extra = 0


@admin.register(Sede)
class SedeAdmin(admin.ModelAdmin):
    list_display = ("nombre", "direccion", "estado")
    inlines = (SedeHorarioInline,)


@admin.register(Cancha)
class CanchaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "sede", "superficie", "estado")
    list_filter = ("sede", "estado")

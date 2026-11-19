from datetime import date, datetime, time, timedelta

from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from instalaciones.models import Cancha, Sede
from reservas.disponibilidad import horarios_del_dia
from reservas.models import Evento
from reservas.servicios import ConflictoReserva

from .masivos import huella_revision
from .models import Bloqueo, CierreMalTiempo
from .servicios import crear_bloqueo, liberar_bloqueo, validar_inicio_bloqueo


FIRMA = "bloqueos.mal_tiempo"


def limite_local(valor):
    try:
        instante = datetime.strptime(valor, "%Y-%m-%dT%H:%M")
    except ValueError as error:
        raise ValidationError("Ingresá fecha y hora en formato AAAA-MM-DDTHH:MM.") from error
    return timezone.make_aware(instante)


def datos_cierre(cierre):
    return {
        "id": cierre.pk,
        "desde": timezone.localtime(cierre.desde).isoformat(timespec="minutes"),
        "hasta": timezone.localtime(cierre.hasta).isoformat(timespec="minutes"),
        "sedes": [{"id": sede.pk, "nombre": sede.nombre} for sede in cierre.sedes.all()],
    }


def revisar_cierre(datos):
    desde, hasta = limite_local(datos["desde"]), limite_local(datos["hasta"])
    ahora = timezone.localtime()
    if desde >= hasta or hasta <= ahora:
        raise ValidationError("El fin debe ser futuro y posterior al inicio.")
    ultimo_turno = (hasta - timedelta(microseconds=1)).replace(minute=0, second=0, microsecond=0)
    validar_inicio_bloqueo(ultimo_turno.date(), ultimo_turno.time())
    sedes = list(Sede.objects.filter(
        pk__in=datos["sedes"], estado=Sede.Estado.ACTIVA
    ).prefetch_related("canchas").order_by("pk"))
    if not sedes or len(sedes) != len(datos["sedes"]):
        raise ValidationError("Seleccioná sedes activas.")
    if CierreMalTiempo.objects.filter(
        sedes__in=sedes, desde__lt=hasta, hasta__gt=max(desde, ahora),
    ).exists():
        raise ConflictoReserva("Ya hay un cierre por mal tiempo que coincide con el período en alguna sede.")

    eventos = Evento.objects.filter(
        turno__cancha__sede__in=sedes, turno__fecha__range=(max(desde.date(), ahora.date()), hasta.date()),
    ).exclude(estado=Evento.Estado.ANULADO).select_related("turno")
    ocupados = {
        (e.turno.cancha_id, e.turno.fecha, e.turno.hora_inicio): e for e in eventos
    }
    revision = {
        "sedes": [{"id": sede.pk, "nombre": sede.nombre} for sede in sedes],
        "bloquear": [], "ya_bloqueados": [],
    }
    for sede in sedes:
        canchas = [cancha for cancha in sede.canchas.all() if cancha.estado == Cancha.Estado.ACTIVA]
        horarios_por_dia = {}
        fecha = max(desde.date(), ahora.date())
        while fecha <= hasta.date():
            dia = fecha.isoweekday()
            if dia not in horarios_por_dia:
                horarios_por_dia[dia] = horarios_del_dia(sede, fecha)
            for hora, _ in horarios_por_dia[dia]:
                inicio = timezone.make_aware(datetime.combine(fecha, hora))
                if inicio <= ahora or not desde <= inicio < hasta:
                    continue
                for cancha in canchas:
                    evento = ocupados.get((cancha.pk, fecha, hora))
                    fila = {
                        "sede_id": sede.pk, "cancha_id": cancha.pk, "cancha": cancha.nombre,
                        "fecha": fecha.isoformat(), "hora_inicio": hora.strftime("%H:%M"),
                        "evento_id": evento.pk if evento else 0,
                    }
                    if evento and evento.tipo == Evento.Tipo.BLOQUEO:
                        revision["ya_bloqueados"].append(fila)
                    else:
                        revision["bloquear"].append(dict(fila, cancela_reserva=bool(evento)))
            fecha += timedelta(days=1)
    return revision


def revisar_reapertura(datos):
    cierre = CierreMalTiempo.objects.get(pk=datos["cierre_id"])
    nuevo_fin = limite_local(datos["hasta"])
    ahora = timezone.localtime()
    if cierre.hasta <= ahora or not cierre.desde < nuevo_fin < cierre.hasta:
        raise ValidationError("Elegí un fin anterior al cierre vigente y posterior a su inicio.")
    if nuevo_fin < ahora.replace(second=0, microsecond=0):
        raise ValidationError("Elegí la hora actual o una futura.")

    filas = []
    bloqueos = cierre.bloqueos.filter(evento__estado=Evento.Estado.PROGRAMADO).select_related(
        "evento__turno__cancha"
    ).order_by("pk")
    for bloqueo in bloqueos:
        turno = bloqueo.evento.turno
        inicio = timezone.make_aware(datetime.combine(turno.fecha, turno.hora_inicio))
        if inicio > ahora and inicio >= nuevo_fin:
            filas.append({
                "bloqueo_id": bloqueo.pk, "sede_id": turno.cancha.sede_id,
                "cancha_id": turno.cancha_id, "cancha": turno.cancha.nombre,
                "fecha": turno.fecha.isoformat(), "hora_inicio": turno.hora_inicio.strftime("%H:%M"),
            })
    return {"liberar": filas, "fin_actual": cierre.hasta.isoformat()}


def preparar_cierre(actor, datos, *, reapertura=False):
    revisar = revisar_reapertura if reapertura else revisar_cierre
    revision = revisar(datos)
    confirmacion = signing.dumps({
        "actor": actor.pk, "datos": datos, "reapertura": reapertura, "huella": huella_revision(revision),
    }, salt=FIRMA, compress=True)
    return {"confirmacion": confirmacion, **revision}


@transaction.atomic
def confirmar_cierre(actor, token):
    try:
        carga = signing.loads(token, salt=FIRMA, max_age=15 * 60)
    except signing.BadSignature as error:
        raise ConflictoReserva("La confirmación venció o es inválida. Volvé a revisar.") from error
    if carga["actor"] != actor.pk:
        raise ConflictoReserva("La confirmación pertenece a otra cuenta.")

    datos = carga["datos"]
    reapertura = carga["reapertura"]
    if reapertura:
        cierre = CierreMalTiempo.objects.select_for_update().get(pk=datos["cierre_id"])
        sedes = cierre.sedes.values_list("pk", flat=True)
    else:
        sedes = datos["sedes"]
    list(Sede.objects.select_for_update().filter(pk__in=sedes).order_by("pk"))

    revisar = revisar_reapertura if reapertura else revisar_cierre
    try:
        revision = revisar(datos)
    except ValidationError as error:
        raise ConflictoReserva(error.messages[0]) from error
    if carga["huella"] != huella_revision(revision):
        raise ConflictoReserva("La agenda cambió. Volvé a revisar la operación.")

    if reapertura:
        filas = revision["liberar"]
        for fila in filas:
            liberar_bloqueo(actor, fila["bloqueo_id"], "Reapertura por mal tiempo", desde_cierre=True)
        cierre.hasta = limite_local(datos["hasta"])
        cierre.save(update_fields=["hasta"])
    else:
        filas = revision["bloquear"]
        if not filas and not revision["ya_bloqueados"]:
            raise ValidationError("No hay turnos futuros dentro del período seleccionado.")
        cierre = CierreMalTiempo.objects.create(
            desde=limite_local(datos["desde"]), hasta=limite_local(datos["hasta"]), registrado_por=actor,
        )
        cierre.sedes.set(sedes)
        for fila in filas:
            crear_bloqueo(
                actor, fila["cancha_id"], date.fromisoformat(fila["fecha"]),
                time.fromisoformat(fila["hora_inicio"]),
                Bloqueo.Motivo.MAL_TIEMPO, fila["evento_id"], "", cierre=cierre,
            )

    ahora = timezone.localtime().strftime("%Y-%m-%dT%H:%M")
    if any(f"{fila['fecha']}T{fila['hora_inicio']}" <= ahora for fila in filas):
        raise ConflictoReserva("Un turno ya comenzó. Volvé a revisar la operación.")
    return {"cierre": datos_cierre(cierre), "aplicadas": len(filas)}

import json
from calendar import monthrange
from datetime import date, time, timedelta
from hashlib import sha256

from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from instalaciones.models import Cancha, Sede
from reservas.disponibilidad import horarios_del_dia
from reservas.models import Evento
from reservas.servicios import ConflictoReserva, cancelar_reserva

from .servicios import crear_bloqueo, liberar_bloqueo


FIRMA = "bloqueos.operacion_masiva"


def fechas_operacion(datos, hoy):
    if datos["fecha"]:
        inicio = fin = date.fromisoformat(datos["fecha"])
    else:
        inicio = date.fromisoformat(datos["mes"] + "-01")
        fin = inicio.replace(day=monthrange(inicio.year, inicio.month)[1])
        if inicio < hoy.replace(day=1):
            raise ValidationError("Elegí el mes actual o uno de los dos siguientes.")
    anio, mes = divmod(hoy.year * 12 + hoy.month + 1, 12)
    mes += 1
    limite = date(anio, mes, monthrange(anio, mes)[1])
    if not date(2026, 8, 1) <= inicio <= fin <= limite:
        raise ValidationError("La fecha está fuera del calendario operativo.")
    return inicio, fin


def revisar_operacion(datos):
    ahora = timezone.localtime()
    desde, hasta = fechas_operacion(datos, ahora.date())
    sede = Sede.objects.get(pk=datos["sede_id"])
    canchas = sede.canchas.all()
    if datos["canchas"]:
        canchas = canchas.filter(pk__in=datos["canchas"])
    canchas = list(canchas.order_by("pk"))
    if not canchas or (datos["canchas"] and len(canchas) != len(datos["canchas"])):
        raise ValidationError("Seleccioná canchas pertenecientes a la sede.")

    bloquear = datos["operacion"] == "bloquear"
    eventos = Evento.objects.filter(
        turno__cancha__in=canchas, turno__fecha__range=(desde, hasta)
    ).exclude(estado=Evento.Estado.ANULADO).select_related("turno", "reserva", "bloqueo")
    ocupados = {
        (evento.turno.fecha, evento.turno.cancha_id, evento.turno.hora_inicio): evento
        for evento in eventos
    }
    habilitados = set()
    horarios_disponibles = set()
    fecha = desde
    while fecha <= hasta:
        horarios = horarios_del_dia(sede, fecha)
        horarios_disponibles.update(horarios)
        if bloquear and sede.estado == Sede.Estado.ACTIVA:
            habilitados.update(
                (fecha, cancha.pk, inicio)
                for cancha in canchas if cancha.estado == Cancha.Estado.ACTIVA
                for inicio, _ in horarios
            )
        fecha += timedelta(days=1)

    corte, fin = datos["desde_hora"], datos["hasta_hora"]
    if corte and corte not in {inicio.strftime("%H:%M") for inicio, _ in horarios_disponibles}:
        raise ValidationError("La hora de inicio debe corresponder a un turno habilitado.")
    if fin and fin not in {limite.strftime("%H:%M") for _, limite in horarios_disponibles}:
        raise ValidationError("La hora de fin debe corresponder al cierre de un turno habilitado.")

    resultado = {"acciones": [], "conservados": [], "ya_bloqueados": []}
    for clave in sorted(ocupados.keys() | habilitados):
        fecha, cancha_id, hora = clave
        hora_texto = hora.strftime("%H:%M")
        if (corte and hora_texto < corte) or (fin and hora_texto >= fin):
            continue
        evento = ocupados.get(clave)
        fila = {
            "fecha": fecha.isoformat(), "cancha_id": cancha_id, "hora_inicio": hora_texto,
            "evento_id": evento.pk if evento else 0,
        }
        if evento:
            fila.update(tipo=evento.tipo, estado=evento.estado)
        if (fecha, hora) <= (ahora.date(), ahora.time()):
            if evento:
                resultado["conservados"].append(dict(fila, razon="turno_iniciado"))
        elif evento and evento.estado == Evento.Estado.FINALIZADO:
            resultado["conservados"].append(dict(fila, razon="finalizado"))
        elif bloquear and evento and evento.tipo == Evento.Tipo.BLOQUEO:
            resultado["ya_bloqueados"].append(fila)
        elif evento and (
            evento.tipo == Evento.Tipo.RESERVA and datos["conservar_reservas"]
            or evento.tipo == Evento.Tipo.BLOQUEO and datos["conservar_bloqueos"]
        ):
            resultado["conservados"].append(dict(fila, razon="seleccionado_para_conservar"))
        elif bloquear:
            if clave in habilitados:
                resultado["acciones"].append(dict(fila, accion="bloquear"))
            elif evento:
                resultado["conservados"].append(dict(fila, razon="fuera_de_horario"))
        elif evento:
            if evento.tipo == Evento.Tipo.RESERVA:
                resultado["acciones"].append(dict(fila, accion="cancelar", id=evento.reserva.pk))
            else:
                resultado["acciones"].append(dict(fila, accion="liberar", id=evento.bloqueo.pk))

    if not bloquear and resultado["acciones"] and len(datos["motivo"]) < 5:
        raise ValidationError("Ingresá un motivo de al menos 5 caracteres.")
    return resultado


def huella_revision(revision):
    return sha256(json.dumps(revision, sort_keys=True).encode()).hexdigest()


def preparar_operacion(actor, datos):
    revision = revisar_operacion(datos)
    token = signing.dumps(
        {"actor": actor.pk, "datos": datos, "huella": huella_revision(revision)},
        salt=FIRMA, compress=True,
    )
    return {"confirmacion": token, **revision}


@transaction.atomic
def confirmar_operacion(actor, token):
    try:
        carga = signing.loads(token, salt=FIRMA, max_age=15 * 60)
    except signing.BadSignature as error:
        raise ConflictoReserva("La confirmación venció o es inválida. Volvé a revisar.") from error
    if carga["actor"] != actor.pk:
        raise ConflictoReserva("La confirmación pertenece a otra sesión de usuario.")

    datos = carga["datos"]
    Sede.objects.select_for_update().get(pk=datos["sede_id"])
    try:
        revision = revisar_operacion(datos)
    except ValidationError as error:
        raise ConflictoReserva("La selección cambió. Volvé a revisar la operación.") from error
    if carga["huella"] != huella_revision(revision):
        raise ConflictoReserva("La agenda cambió. Volvé a revisar la operación.")

    acciones = revision["acciones"]
    for fila in acciones:
        if fila["accion"] == "bloquear":
            crear_bloqueo(
                actor, fila["cancha_id"], date.fromisoformat(fila["fecha"]),
                time.fromisoformat(fila["hora_inicio"]),
                datos["motivo"], fila["evento_id"], datos["observaciones"],
            )
        elif fila["accion"] == "cancelar":
            cancelar_reserva(actor, fila["id"], datos["motivo"])
        else:
            liberar_bloqueo(actor, fila["id"], datos["motivo"])

    ahora = timezone.localtime().strftime("%Y-%m-%dT%H:%M")
    if any(f"{fila['fecha']}T{fila['hora_inicio']}" <= ahora for fila in acciones):
        raise ConflictoReserva("Un turno ya comenzó. Volvé a revisar la operación.")
    return {"aplicadas": len(acciones)}

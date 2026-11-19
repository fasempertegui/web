import React, { useRef, useState } from 'react'
import { CalendarClock, CalendarDays, CloudRain, History, Plus, Settings2, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PanelDetalle } from '@/components/PanelDetalle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useConsulta } from '@/hooks/use-consulta'
import { useIsMobile } from '@/hooks/use-mobile'
import { GrillaAgenda, estadoTurno } from './GrillaAgenda.jsx'
import { FiltrosAgenda } from './FiltrosAgenda.jsx'
import { api } from './api.js'
import { CierreMalTiempo } from './CierreMalTiempo.jsx'
import { HistorialTurno } from './HistorialTurno.jsx'
import { AccionesAgenda } from './AccionesAgenda.jsx'
import { AccionesTurno, etiquetasBloqueo } from './AccionesTurno.jsx'
import { desplazarFecha, fechaValida, finDeMes, hoy, importe, labelFecha } from './fechas.js'
import './agenda.css'

const inicioOperaciones = '2026-08-01'

export default function Agenda({ usuario }) {
  const [params, setParams] = useSearchParams()
  const [aviso, setAviso] = useState(null)
  const [alcance, setAlcance] = useState(null)
  const disparadorPanel = useRef(null)
  const botonAcciones = useRef(null)
  const menuAbrePanel = useRef(false)
  const movil = useIsMobile(1024)
  const fechaHoy = hoy()
  const fecha = fechaValida(params.get('fecha')) ? params.get('fecha') : fechaHoy
  const { datos: catalogoSedes, error: errorSedes, cargando: cargandoSedes } = useConsulta('sedes/')
  const sedes = catalogoSedes?.sedes || null
  const sede = sedes?.find(item => String(item.id) === params.get('sede')) || sedes?.[0]
  const llave = sede ? `${sede.id}:${fecha}` : ''
  const rutaAgenda = sede ? `agenda/diaria/?sede_id=${sede.id}&fecha=${fecha}` : null
  const {
    datos: agendaDiaria, error: errorAgenda, cargando: cargandoAgenda, setDatos: setAgendaDiaria,
  } = useConsulta(rutaAgenda)
  const administrador = usuario.es_administrador

  const columnas = agendaDiaria?.columnas || []
  const canchaId = params.get('cancha')
  const hora = params.get('hora')
  const verHistorial = params.get('historial') === '1'
  const columna = columnas.find(item => String(item.cancha.id) === canchaId)
  const turno = columna?.turnos.find(item => item.hora_inicio === hora)
  const visibles = [...new Set(columnas.flatMap(item => item.turnos.map(t => t.hora_inicio)))].sort()
  const maximo = desplazarFecha(fechaHoy, 365)
  const limiteBloqueo = finDeMes(fechaHoy, 2)
  const nuevoParams = new URLSearchParams({ sede: sede?.id || '', fecha })

  const turnoFuturo = turno && !turno.iniciado
  const puedeCancelarReserva = administrador && turnoFuturo &&
    turno.tipo === 'reserva' && turno.estado === 'programado'
  const puedeGestionarBloqueo = administrador && turnoFuturo && (
    (turno.tipo === 'bloqueo' && turno.estado === 'programado') ||
    (turno.en_horario && fecha <= limiteBloqueo &&
      (!turno.tipo || (turno.tipo === 'reserva' && turno.estado === 'programado')))
  )

  async function refrescarAgenda(mensaje) {
    setAviso({ llave, mensaje })
    try {
      const datos = await api(rutaAgenda)
      setAgendaDiaria(datos)
    } catch (fallo) {
      setAviso({ llave, mensaje: mensaje + ' No se pudo actualizar la agenda. ' + fallo.message, error: true })
    }
  }

  function cambiarVista(nuevaSede, nuevaFecha) {
    setAlcance(null)
    setParams({ sede: nuevaSede, fecha: nuevaFecha })
  }

  function seleccionar(id, inicio, disparador) {
    disparadorPanel.current = disparador
    setAlcance(null)
    setParams({ ...Object.fromEntries(nuevoParams), cancha: id, hora: inicio }, { replace: true })
  }

  function cambiarHistorial(abrir) {
    const siguiente = new URLSearchParams(params)
    if (abrir) siguiente.set('historial', '1')
    else siguiente.delete('historial')
    setParams(siguiente, { replace: true })
  }

  function cerrarDetalle() {
    setParams(nuevoParams, { replace: true })
    if (!movil) disparadorPanel.current?.focus()
  }

  function abrirAcciones(periodo) {
    menuAbrePanel.current = movil
    disparadorPanel.current = botonAcciones.current
    setParams(nuevoParams, { replace: true })
    setAlcance({ periodo, llave })
  }

  function actualizarLote(cantidad) {
    const mensaje = cantidad === 1 ? 'Se actualizó 1 turno.' : `Se actualizaron ${cantidad} turnos.`
    setAlcance(actual => actual?.llave === llave ? null : actual)
    return refrescarAgenda(mensaje)
  }

  function actualizarCierre(cantidad, reapertura) {
    const resultado = reapertura ? 'Reapertura confirmada.' : 'Cierre confirmado.'
    const cambios = cantidad === 1 ? 'Se actualizó 1 turno.' : `Se actualizaron ${cantidad} turnos.`
    setAlcance(actual => actual?.periodo === 'mal-tiempo' && actual.llave === llave ? null : actual)
    return refrescarAgenda(`${resultado} ${cambios}`)
  }

  const periodo = alcance?.llave === llave ? alcance.periodo : null

  function cerrarPanel() {
    if (periodo) {
      setAlcance(null)
      if (!movil) disparadorPanel.current?.focus()
    } else cerrarDetalle()
  }

  const contenidoPanel = periodo === 'mal-tiempo'
    ? <CierreMalTiempo key={llave} sedes={sedes} sedeId={sede.id}
      cerrar={cerrarPanel} alConfirmar={actualizarCierre} />
    : periodo ? <AccionesAgenda key={`${llave}:${periodo}`} sede={sede} fecha={fecha}
      alcance={periodo} cerrar={cerrarPanel} alConfirmar={actualizarLote} />
    : turno?.tiene_historial && verHistorial
      ? <HistorialTurno key={`${llave}:${canchaId}:${hora}`} cancha={columna.cancha}
        fecha={fecha} turno={turno} volver={() => cambiarHistorial(false)} />
      : turno ? <>
        <header className="agenda-turno">
          <div className="min-w-0">
            <Badge variant="outline" className="agenda-estado border-(--turno-acento) bg-(--turno-fondo) text-(--turno-texto)" data-tipo={turno.tipo || 'libre'}>{estadoTurno(turno)}</Badge>
            <h3 className="agenda-titulo">{turno.hora_inicio} – {turno.hora_fin}</h3>
            <p>{columna.cancha.nombre}</p>
          </div>
          {!movil && <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0"
            aria-label="Cerrar detalle" onClick={cerrarDetalle}><X aria-hidden="true" /></Button>}
        </header>
        {(turno.organizador || turno.importe || turno.motivo || turno.observaciones) && <dl className="agenda-datos-turno">
          {turno.organizador && <div><dt>Organizador</dt><dd>{turno.organizador}</dd></div>}
          {turno.importe && <div><dt>Importe</dt><dd>{importe(turno.importe)}</dd></div>}
          {turno.motivo && <div><dt>Motivo</dt><dd>{etiquetasBloqueo[turno.motivo]}</dd></div>}
          {turno.observaciones && <div><dt>Observaciones</dt><dd>{turno.observaciones}</dd></div>}
        </dl>}
        {(turno.reservable || turno.tiene_historial || puedeGestionarBloqueo || puedeCancelarReserva) &&
          <div className="agenda-acciones-turno">
            {turno.reservable && <Button asChild variant="outline" className="agenda-accion-turno">
              <Link to={'/agenda/nueva-reserva?' + params.toString()}><Plus aria-hidden="true" />Nueva reserva</Link>
            </Button>}
            {turno.tiene_historial && <Button className="agenda-accion-turno" type="button" variant="outline"
              onClick={() => cambiarHistorial(true)}><History aria-hidden="true" />Ver historial</Button>}
            {(puedeGestionarBloqueo || puedeCancelarReserva) && <AccionesTurno
              key={`${llave}:${canchaId}:${hora}:${turno.evento_id}`}
              turno={turno} canchaId={canchaId} fecha={fecha} alGuardar={refrescarAgenda}
              puedeBloquear={puedeGestionarBloqueo} puedeCancelar={puedeCancelarReserva} />}
          </div>}
      </> : <div className="agenda-panel-vacio">
        <div className="agenda-panel-icono"><CalendarClock aria-hidden="true" /></div>
        <h3 className="agenda-titulo">Elegí un turno</h3>
        <p>Seleccioná una celda para ver sus datos y las acciones disponibles.</p>
      </div>

  function recuperarFocoPanel() {
    if (!disparadorPanel.current?.isConnected) return false
    disparadorPanel.current.focus()
    return true
  }

  return <main className="agenda-superficie w-full flex-1">
    <div className="contenido-pagina">
      <header className="agenda-encabezado">
        <h1 className="agenda-titulo">Agenda</h1>
        {administrador && sede && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button ref={botonAcciones} type="button" className="h-10">
              <Settings2 aria-hidden="true" /> Acciones
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="agenda-menu w-52"
            onCloseAutoFocus={evento => {
              if (menuAbrePanel.current) evento.preventDefault()
              menuAbrePanel.current = false
            }}>
            {sede.canchas.length > 0 && fecha >= fechaHoy && fecha <= limiteBloqueo &&
              <DropdownMenuItem onSelect={() => abrirAcciones('dia')}>
                <CalendarDays aria-hidden="true" /> Acciones del día
              </DropdownMenuItem>}
            {sede.canchas.length > 0 && <DropdownMenuItem onSelect={() => abrirAcciones('mes')}>
              <CalendarClock aria-hidden="true" /> Acciones del mes
            </DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => abrirAcciones('mal-tiempo')}>
              <CloudRain aria-hidden="true" /> Cierre por mal tiempo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>}
      </header>

      {errorSedes && <p className="error" role="alert">{errorSedes}</p>}
      {cargandoSedes && <Skeleton className="h-24 rounded-2xl" role="status" aria-label="Cargando sedes" />}
      {sedes?.length === 0 && <Card className="agenda-estado-vacio border-border gap-3 p-6 shadow-none">
        <h2 className="agenda-titulo">Todavía no hay sedes</h2>
        {administrador && <Button asChild className="w-fit no-underline">
          <Link to="/instalaciones">Configurar instalaciones</Link>
        </Button>}
      </Card>}

      {sede && <>
        <FiltrosAgenda sedes={sedes} sede={sede} fecha={fecha} minimo={inicioOperaciones}
          maximo={maximo} cambiarVista={cambiarVista} />
        {aviso?.llave === llave && <p className={aviso.error ? 'error' : 'reserva-mensaje'}
          role={aviso.error ? 'alert' : 'status'}>{aviso.mensaje}</p>}
        {errorAgenda && <p className="error" role="alert">{errorAgenda}</p>}

        <div className={movil ? 'agenda-vista' : 'agenda-vista agenda-vista-escritorio'}>
          {cargandoAgenda ? <Skeleton className="h-72 rounded-2xl" role="status" aria-label="Cargando agenda" />
          : errorAgenda ? <div />
          : visibles.length > 0 ? <GrillaAgenda
            columnas={columnas} horas={visibles} fecha={fecha} sede={sede.nombre}
            administrador={administrador} canchaId={canchaId} hora={hora} seleccionar={seleccionar} />
          : <Card className="agenda-estado-vacio border-border gap-2 p-6 shadow-none">
            <h2 className="agenda-titulo">{labelFecha(fecha)}</h2>
            <p>{columnas.length === 0 ? 'La sede todavía no tiene canchas activas.'
              : fecha < fechaHoy && !administrador ? 'No tenés reservas en esta fecha.'
              : 'No hay turnos para mostrar en esta fecha.'}</p>
          </Card>}

          <PanelDetalle
            movil={movil}
            abierto={Boolean(periodo || turno)}
            cerrar={cerrarPanel}
            recuperarFoco={recuperarFocoPanel}
            mostrarEnEscritorio={Boolean(agendaDiaria || periodo)}
            titulo={periodo ? 'Acciones de agenda' : 'Detalle del turno'}
            descripcion="Información y acciones del turno seleccionado."
            clasePanel="agenda-panel"
            claseSheet="agenda-sheet"
            claseContenido="detalle">
            {contenidoPanel}
          </PanelDetalle>
        </div>
      </>}
    </div>
  </main>
}

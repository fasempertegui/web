import React, { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { FiltrosAgenda } from './FiltrosAgenda.jsx'
import { api } from './api.js'
import { CierreMalTiempo } from './CierreMalTiempo.jsx'
import { HistorialTurno } from './HistorialTurno.jsx'
import { AccionesAgenda } from './AccionesAgenda.jsx'
import { AccionesTurno, etiquetasBloqueo } from './AccionesTurno.jsx'
import { desplazarFecha, fechaValida, horaActual, hoy, importe, labelFecha } from './fechas.js'

const inicioOperaciones = '2026-08-01'

async function consultarAgenda(sede, fecha, signal) {
  const { columnas } = await api(`agenda/diaria/?sede_id=${sede.id}&fecha=${fecha}`, { signal })
  return columnas
}

function estadoTurno(turno) {
  if (turno.tipo === 'bloqueo') return 'Bloqueo'
  if (turno.tipo === 'reserva') return 'Reserva'
  if (turno.tipo === 'solo_historial') return 'Historial'
  if (turno.tipo === 'no_disponible') return 'No disponible'
  return 'Libre'
}

export default function Agenda({ usuario }) {
  const [params, setParams] = useSearchParams()
  const [sedes, setSedes] = useState(null)
  const [errorSedes, setErrorSedes] = useState('')
  const [consulta, setConsulta] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [alcance, setAlcance] = useState(null)
  const disparadorPanel = useRef(null)
  const movil = useIsMobile()
  const fecha = fechaValida(params.get('fecha')) ? params.get('fecha') : hoy()
  const sede = sedes?.find(item => String(item.id) === params.get('sede')) || sedes?.[0]
  const llave = sede ? `${sede.id}:${fecha}` : ''
  const administrador = usuario.es_administrador

  useEffect(() => {
    const control = new AbortController()
    api('sedes/', { signal: control.signal })
      .then(datos => setSedes(datos.sedes))
      .catch(error => { if (error.name !== 'AbortError') setErrorSedes(error.message) })
    return () => control.abort()
  }, [])

  useEffect(() => {
    if (!sede) return
    const control = new AbortController()
    consultarAgenda(sede, fecha, control.signal)
      .then(columnas => setConsulta({ llave, columnas }))
      .catch(error => {
        if (error.name !== 'AbortError') setConsulta({ llave, error: error.message })
      })
    return () => control.abort()
  }, [sede, fecha, administrador, llave])

  const activa = consulta?.llave === llave ? consulta : null
  const columnas = activa?.columnas || []
  const canchaId = params.get('cancha')
  const hora = params.get('hora')
  const verHistorial = params.get('historial') === '1'
  const columna = columnas.find(item => String(item.cancha.id) === canchaId)
  const turno = columna?.turnos.find(item => item.hora_inicio === hora)
  const visibles = [...new Set(columnas.flatMap(item => item.turnos.map(t => t.hora_inicio)))].sort()
  const maximo = desplazarFecha(hoy(), 365)
  const nuevoParams = new URLSearchParams({ sede: sede?.id || '', fecha })

  const turnoFuturo = turno && !turno.iniciado
  const limiteBloqueo = new Date(hoy() + 'T12:00:00Z')
  limiteBloqueo.setUTCMonth(limiteBloqueo.getUTCMonth() + 3, 0)
  const puedeCancelarReserva = administrador && turnoFuturo &&
    turno.tipo === 'reserva' && turno.estado === 'programado'
  const puedeGestionarBloqueo = administrador && turnoFuturo && (
    (turno.tipo === 'bloqueo' && turno.estado === 'programado') ||
    (turno.en_horario && fecha <= limiteBloqueo.toISOString().slice(0, 10) &&
      (!turno.tipo || (turno.tipo === 'reserva' && turno.estado === 'programado')))
  )

  async function refrescarAgenda(mensaje) {
    setAviso({ llave, mensaje })
    try {
      const columnas = await consultarAgenda(sede, fecha)
      setConsulta(actual => actual?.llave === llave ? { llave, columnas } : actual)
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

  function abrirAcciones(periodo, disparador) {
    disparadorPanel.current = disparador
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
    if (periodo) setAlcance(null)
    else cerrarDetalle()
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
        <div className="turno-resumen">
          <Badge variant="secondary" className="text-xs">{estadoTurno(turno)}</Badge>
          {!movil && <button type="button" aria-label="Cerrar detalle" onClick={cerrarDetalle}>×</button>}
          <h3>{turno.hora_inicio} – {turno.hora_fin}</h3>
          <p>{columna.cancha.nombre}</p>
        </div>
        {turno.organizador && <p>{turno.organizador}</p>}
        {turno.importe && <p>{importe(turno.importe)}</p>}
        {turno.motivo && <p>{etiquetasBloqueo[turno.motivo]}</p>}
        {turno.observaciones && <p>{turno.observaciones}</p>}
        {turno.tiene_historial && <Button className="accion" type="button" variant="outline"
          onClick={() => cambiarHistorial(true)}>Ver historial</Button>}
        {turno.reservable && <Button asChild className="accion no-underline">
          <Link to={'/agenda/nueva-reserva?' + params.toString()}>Nueva reserva</Link>
        </Button>}
        {(puedeGestionarBloqueo || puedeCancelarReserva) && <AccionesTurno
          key={`${llave}:${canchaId}:${hora}:${turno.evento_id}`}
          turno={turno} canchaId={canchaId} fecha={fecha} alGuardar={refrescarAgenda}
          puedeBloquear={puedeGestionarBloqueo} puedeCancelar={puedeCancelarReserva} />}
      </> : <>
        <h3>Elegí un turno</h3>
        <p>Seleccioná una celda para consultar su detalle.</p>
      </>

  return <main className="pagina" onKeyDown={evento => {
    if (!movil && evento.key === 'Escape' && turno) cerrarDetalle()
  }}>
    <header className="encabezado encabezado-agenda">
      <div><h1>Agenda</h1>
      <p>{administrador ? 'Consultá las reservas y los bloqueos de cada cancha.' : 'Elegí un turno para consultar su disponibilidad.'}</p></div>
      {administrador && sede && <div className="controles-agenda">
        {sede.canchas.length > 0 && fecha >= hoy() && fecha <= limiteBloqueo.toISOString().slice(0, 10) &&
          <Button type="button" aria-pressed={periodo === 'dia'}
            onClick={evento => abrirAcciones('dia', evento.currentTarget)}>Acciones del día</Button>}
        {sede.canchas.length > 0 && <Button type="button" variant="outline" aria-pressed={periodo === 'mes'}
          onClick={evento => abrirAcciones('mes', evento.currentTarget)}>Acciones del mes</Button>}
        <Button type="button" variant="outline" aria-pressed={periodo === 'mal-tiempo'}
          onClick={evento => abrirAcciones('mal-tiempo', evento.currentTarget)}>Cierre por mal tiempo</Button>
      </div>}
    </header>
    {errorSedes && <p className="error" role="alert">{errorSedes}</p>}
    {sedes === null && !errorSedes && <p role="status">Cargando sedes…</p>}
    {sedes?.length === 0 && <p className="tarjeta vacio">
      {administrador ? 'Cargá una sede y sus canchas desde el admin de Django para ver la agenda.' : 'Todavía no hay sedes disponibles.'}
    </p>}
    {sede && <>
      <FiltrosAgenda sedes={sedes} sede={sede} fecha={fecha} minimo={inicioOperaciones}
        maximo={maximo} cambiarVista={cambiarVista} />
      <h2 className="fecha-agenda">{labelFecha(fecha)}</h2>
      {aviso?.llave === llave && <p className={aviso.error ? 'error' : 'reserva-mensaje'}
        role={aviso.error ? 'alert' : 'status'}>{aviso.mensaje}</p>}
      {!activa && <p role="status">Cargando agenda…</p>}
      {activa?.error && <p className="error" role="alert">{activa.error}</p>}
      {activa?.columnas && columnas.length === 0 && <p className="tarjeta vacio">La sede todavía no tiene canchas activas.</p>}
      {columnas.length > 0 && visibles.length === 0 && !periodo && <p className="tarjeta vacio">
        {fecha < hoy() && !administrador ? 'No tenés reservas en esta fecha.' : 'No hay turnos para mostrar en esta fecha.'}
      </p>}
      {(visibles.length > 0 || periodo) && <div className={movil ? undefined : "agenda-cuerpo"}>
        {visibles.length === 0 ? <p className="tarjeta vacio">No hay turnos para mostrar en esta fecha.</p> :
        <div className="tarjeta grilla">
          <table aria-label={'Turnos de ' + sede.nombre}>
            <thead><tr><th scope="col">Hora</th>
              {columnas.map(({ cancha }) => <th key={cancha.id} scope="col">{cancha.nombre}</th>)}
            </tr></thead>
            <tbody>{visibles.map((inicio, indice) => {
              const anterior = visibles[indice - 1]
              const finAnterior = anterior && String(Number(anterior.slice(0, 2)) + 1).padStart(2, '0') + ':00'
              const actual = fecha === hoy() && horaActual().slice(0, 2) === inicio.slice(0, 2)
              return <React.Fragment key={inicio}>
                {anterior && finAnterior < inicio && <tr className="pausa"><td colSpan={columnas.length + 1}>
                  {finAnterior} a {inicio} · Fuera del horario de funcionamiento
                </td></tr>}
                <tr>
                  <th scope="row" className={actual ? 'ahora' : undefined}>{inicio}{actual && <small>Ahora</small>}</th>
                  {columnas.map(({ cancha, turnos }) => {
                    const celda = turnos.find(item => item.hora_inicio === inicio)
                    const seleccionada = canchaId === String(cancha.id) && hora === inicio
                    return <td key={cancha.id}>
                      {celda ? <button type="button"
                        className={`celda ${celda.tipo || 'libre'}`}
                        aria-label={`${cancha.nombre}, ${inicio}, ${estadoTurno(celda)}${celda.tiene_historial ? ", con historial" : ""}`}
                        aria-pressed={seleccionada} onClick={evento => seleccionar(cancha.id, inicio, evento.currentTarget)}>
                        <span>{estadoTurno(celda)}</span>
                        {celda.tiene_historial && <span className="marca-historial" aria-hidden="true">↶</span>}
                        {celda.organizador && <small>{celda.organizador}</small>}
                        {etiquetasBloqueo[celda.motivo] && <small>{etiquetasBloqueo[celda.motivo]}</small>}
                      </button> : <span className="sin-turno" aria-label="Sin turno">—</span>}
                    </td>
                  })}
                </tr>
              </React.Fragment>
            })}</tbody>
          </table>
        </div>}
        {movil ? <Sheet open={Boolean(periodo || turno)} onOpenChange={abierto => {
          if (!abierto) cerrarPanel()
        }}>
          <SheetContent side="bottom" className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-xl bg-card"
            onCloseAutoFocus={evento => {
              if (disparadorPanel.current?.isConnected) {
                evento.preventDefault()
                disparadorPanel.current.focus()
              }
            }}>
            <SheetHeader className="sr-only">
              <SheetTitle>{periodo ? 'Acciones de agenda' : 'Detalle del turno'}</SheetTitle>
              <SheetDescription>Información y acciones disponibles en la agenda.</SheetDescription>
            </SheetHeader>
            <div className="detalle px-4 pt-12 pb-5">{contenidoPanel}</div>
          </SheetContent>
        </Sheet> : <Card role="complementary" aria-label={periodo ? 'Acciones de agenda' : 'Detalle del turno'}
          className="gap-0 py-0 shadow-none">
          <CardContent className="detalle px-3 py-3">{contenidoPanel}</CardContent>
        </Card>}
      </div>}
    </>}
  </main>
}

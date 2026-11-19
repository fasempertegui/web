import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api.js'
import { horaActual, hoy, importe, labelFecha } from './fechas.js'

const estados = {
  programado: 'Programada',
  anulado: 'Cancelada',
  finalizado: 'Finalizada',
}

function SeccionReservas({ titulo, reservas, seleccion, seleccionar }) {
  return <section className="tarjeta lista-reservas">
    <h2>{titulo}</h2>
    {reservas.length === 0 ? <p className="texto-suave">No hay reservas en esta sección.</p> :
      <ul>{reservas.map(reserva => <li key={reserva.id}>
        <button type="button" className="fila-reserva" aria-pressed={seleccion === reserva.id}
          onClick={() => seleccionar(reserva.id)}>
          <span><strong>{reserva.cancha}</strong><small>{reserva.sede}</small></span>
          <span><strong>{reserva.hora_inicio} – {reserva.hora_fin}</strong><small>{labelFecha(reserva.fecha)}</small></span>
          <span className={`estado-reserva ${reserva.estado}`}>{estados[reserva.estado]}</span>
        </button>
      </li>)}</ul>}
  </section>
}

export function MisReservas() {
  const [reservas, setReservas] = useState(null)
  const [error, setError] = useState('')
  const [seleccion, seleccionar] = useState(null)
  const [cancelando, setCancelando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const control = new AbortController()
    api('reservas/', { signal: control.signal })
      .then(datos => setReservas(datos.reservas))
      .catch(fallo => { if (fallo.name !== 'AbortError') setError(fallo.message) })
    return () => control.abort()
  }, [])

  function elegir(id) {
    seleccionar(id === seleccion ? null : id)
    setCancelando(false)
    setError('')
  }

  async function cancelar(evento) {
    evento.preventDefault()
    const motivo = new FormData(evento.currentTarget).get('motivo').trim()
    if (motivo.length < 5) {
      setError('Ingresá un motivo de al menos 5 caracteres.')
      return
    }
    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const { reserva } = await api(`reservas/${seleccion}/cancelar/`, { datos: { motivo } })
      setReservas(actuales => actuales.map(item => item.id === reserva.id ? reserva : item))
      setCancelando(false)
      setMensaje('Reserva cancelada.')
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  const ahora = `${hoy()}T${horaActual()}`
  const detalle = reservas?.find(reserva => reserva.id === seleccion)
  const puedeCancelar = detalle?.estado === 'programado' &&
    `${detalle.fecha}T${detalle.hora_inicio}` > ahora
  const tomanLugar = reserva => reserva.estado === 'programado' &&
    `${reserva.fecha}T${reserva.hora_fin}` > ahora
  const proximas = reservas?.filter(tomanLugar).reverse()
  const historial = reservas?.filter(reserva => !tomanLugar(reserva))

  return <main className="pagina">
    <header className="encabezado"><h1>Mis reservas</h1></header>
    {error && <p className="error" role="alert">{error}</p>}
    {mensaje && <p className="reserva-mensaje" role="status">{mensaje}</p>}
    {!reservas && !error && <p role="status">Cargando reservas…</p>}
    {reservas?.length === 0 && <div className="tarjeta vacio">
      <p>Todavía no tenés reservas.</p>
      <Link className="primario" to="/agenda">Ir a la agenda</Link>
    </div>}
    {reservas?.length > 0 && <div className="agenda-cuerpo">
      <div className="secciones-reservas">
        <SeccionReservas titulo="Próximas" reservas={proximas} seleccion={seleccion}
          seleccionar={id => { if (!guardando) elegir(id) }} />
        <SeccionReservas titulo="Historial" reservas={historial} seleccion={seleccion}
          seleccionar={id => { if (!guardando) elegir(id) }} />
      </div>
      {detalle && <aside className="tarjeta detalle" aria-label="Detalle de la reserva">
        <div className="turno-resumen">
          <span>{estados[detalle.estado]}</span>
          <button type="button" aria-label="Cerrar detalle" disabled={guardando}
            onClick={() => elegir(seleccion)}>×</button>
          <h3>{detalle.hora_inicio} – {detalle.hora_fin}</h3>
          <p>{detalle.cancha} · {detalle.sede}</p>
        </div>
        <p>{labelFecha(detalle.fecha)}</p>
        <p>{importe(detalle.importe)}</p>
        {detalle.observaciones && <p>{detalle.observaciones}</p>}
        {detalle.motivo_anulacion && <p>Motivo de cancelación: {detalle.motivo_anulacion}</p>}
        {puedeCancelar && !cancelando && <button type="button" className="accion"
          onClick={() => { setMensaje(''); setCancelando(true) }}>Cancelar reserva</button>}
        {cancelando && <form onSubmit={cancelar}>
          <label>Motivo de cancelación<textarea required minLength={5} rows={3}
            name="motivo" disabled={guardando} /></label>
          <div className="acciones">
            <button type="button" disabled={guardando} onClick={() => {
              setCancelando(false)
              setError('')
            }}>Volver</button>
            <button className="primario" disabled={guardando}>
              {guardando ? 'Cancelando…' : 'Confirmar cancelación'}
            </button>
          </div>
        </form>}
      </aside>}
    </div>}
  </main>
}

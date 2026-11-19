import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from './api.js'
import { fechaValida, importe, labelFecha } from './fechas.js'

function nombreCompleto(usuario) {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.nombre_usuario
}

function BuscarOrganizador({ organizador, elegir }) {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)
  const consulta = texto.trim()

  useEffect(() => {
    if (consulta.length < 2 || organizador) return
    const control = new AbortController()
    const espera = setTimeout(() => {
      api('usuarios/?q=' + encodeURIComponent(consulta), { signal: control.signal })
        .then(datos => setResultado({ consulta, usuarios: datos.usuarios }))
        .catch(error => {
          if (error.name !== 'AbortError') setResultado({ consulta, error: error.message })
        })
    }, 220)
    return () => {
      clearTimeout(espera)
      control.abort()
    }
  }, [consulta, organizador])

  const actual = resultado?.consulta === consulta ? resultado : null
  return <section className="organizador">
    {organizador ? <div className="elegido">
      <strong>{nombreCompleto(organizador)}</strong>
      <button type="button" onClick={() => elegir(null)}>Cambiar</button>
    </div> : <>
      <label>Organizador<input type="search" value={texto} onChange={evento => setTexto(evento.target.value)}
        placeholder="Buscar por nombre, apellido o usuario" /></label>
      {consulta.length >= 2 && !actual && <p role="status">Buscando…</p>}
      {actual?.error && <p className="error" role="alert">{actual.error}</p>}
      {actual?.usuarios?.length === 0 && <p>No encontramos usuarios.</p>}
      {actual?.usuarios?.length > 0 && <ul className="resultados">
        {actual.usuarios.map(usuario => <li key={usuario.id}>
          <button type="button" onClick={() => elegir(usuario)}>
            <strong>{nombreCompleto(usuario)}</strong><span>{usuario.nombre_usuario}</span>
          </button>
        </li>)}
      </ul>}
    </>}
  </section>
}

export function NuevaReserva({ usuario }) {
  const [params] = useSearchParams()
  const volver = '/agenda?' + params.toString()
  const navegar = useNavigate()
  const esAdmin = usuario.es_administrador
  const [organizador, elegir] = useState(esAdmin ? null : usuario)
  const [revision, revisar] = useState(!esAdmin)
  const [consulta, setConsulta] = useState(null)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting: enviando } } = useForm({ shouldUnregister: true })
  const sedeId = params.get('sede')
  const canchaId = params.get('cancha')
  const fecha = params.get('fecha')
  const hora = params.get('hora')
  const seleccionValida = /^\d+$/.test(sedeId || '') && /^\d+$/.test(canchaId || '') &&
    fechaValida(fecha) && /^\d\d:00$/.test(hora || '')

  useEffect(() => {
    if (!seleccionValida) return
    const control = new AbortController()
    Promise.all([
      api('sedes/', { signal: control.signal }),
      api(`canchas/${canchaId}/disponibilidad/?fecha=${fecha}`, { signal: control.signal }),
    ]).then(([catalogo, datos]) => {
      const sede = catalogo.sedes.find(item => String(item.id) === sedeId)
      const cancha = sede?.canchas.find(item => String(item.id) === canchaId)
      const turno = datos.turnos.find(item => item.hora_inicio === hora)
      if (!cancha || !turno) throw new Error('El turno ya no está disponible. Volvé a la agenda.')
      setConsulta({ sede, cancha, turno, precio: datos.precio_por_turno })
    }).catch(fallo => { if (fallo.name !== 'AbortError') setError(fallo.message) })
    return () => control.abort()
  }, [sedeId, canchaId, fecha, hora, seleccionValida])

  async function confirmar({ observaciones = '' }) {
    setError('')
    try {
      await api('reservas/', { datos: {
        cancha_id: canchaId, organizador_id: String(organizador.id), fecha,
        hora_inicio: hora, precio_por_turno: String(consulta.precio), observaciones,
      } })
      navegar(volver, { replace: true })
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  return <main className="pagina pagina-reserva">
    <section className="tarjeta reserva-form">
      <h1>Nueva reserva</h1>
      {!seleccionValida && <p className="error" role="alert">Elegí un turno desde la agenda.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {seleccionValida && !consulta && !error && <p role="status">Consultando el turno…</p>}
      {!consulta && <Link to={volver}>Volver a la agenda</Link>}
      {consulta && <>
        {esAdmin && <div className="pasos" aria-label="Pasos de la reserva">
          <span aria-current={!revision ? 'step' : undefined}>Organizador</span>
          <span aria-current={revision ? 'step' : undefined}>Revisión</span>
        </div>}
        <div className="reserva-datos">
          <div><span>{consulta.sede.nombre}</span><strong>{consulta.cancha.nombre}</strong></div>
          <div><span>{labelFecha(fecha)}</span><strong>{hora} – {consulta.turno.hora_fin}</strong></div>
        </div>
        {!revision ? <>
          <BuscarOrganizador organizador={organizador} elegir={elegir} />
          <div className="acciones">
            <Link className="secundario" to={volver}>Cancelar</Link>
            <button className="primario" disabled={!organizador} onClick={() => revisar(true)}>Continuar</button>
          </div>
        </> : <form onSubmit={handleSubmit(confirmar)}>
          <dl className="revision">
            <div><dt>Organizador</dt><dd>{nombreCompleto(organizador)}</dd></div>
            <div><dt>Precio del turno</dt><dd>{importe(consulta.precio)}</dd></div>
          </dl>
          <label>Observaciones <span className="opcional">(opcional)</span><textarea {...register('observaciones')} rows="3" /></label>
          <div className="acciones">
            {esAdmin && <button type="button" disabled={enviando} onClick={() => { revisar(false); setError('') }}>Atrás</button>}
            <Link className="secundario" to={volver}>Cancelar</Link>
            <button className="primario" disabled={enviando}>{enviando ? 'Confirmando…' : 'Confirmar reserva'}</button>
          </div>
        </form>}
      </>}
    </section>
  </main>
}

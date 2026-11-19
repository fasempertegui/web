import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from './api.js'

export const motivosBloqueo = {
  torneo: 'Torneo',
  mantenimiento: 'Mantenimiento',
}

export const etiquetasBloqueo = { ...motivosBloqueo, clima_adverso: 'Mal tiempo' }

export function AccionesTurno({ turno, canchaId, fecha, puedeBloquear, puedeCancelar, alGuardar }) {
  const [operacion, setOperacion] = useState(null)
  const { register, handleSubmit, formState: { isSubmitting: guardando } } = useForm({ shouldUnregister: true })
  const [error, setError] = useState('')
  const bloquear = operacion === 'bloquear'
  const cancelar = operacion === 'cancelar'
  const tituloBloqueo = turno.tipo === 'reserva' ? 'Cancelar y bloquear' : 'Bloquear turno'

  async function confirmar(campos) {
    const motivo = campos.motivo.trim()
    if (!bloquear && motivo.length < 5) {
      setError('Ingresá un motivo de al menos 5 caracteres.')
      return
    }
    setError('')
    try {
      if (bloquear) {
        await api('bloqueos/', { datos: {
          cancha_id: String(canchaId),
          fecha,
          hora_inicio: turno.hora_inicio,
          evento_esperado: String(turno.evento_id),
          motivo,
          observaciones: campos.observaciones || '',
        } })
        await alGuardar('Turno bloqueado.')
      } else if (cancelar) {
        await api(`reservas/${turno.reserva_id}/cancelar/`, { datos: { motivo } })
        await alGuardar('Reserva cancelada.')
      } else {
        await api(`bloqueos/${turno.bloqueo_id}/liberar/`, { datos: { motivo } })
        await alGuardar('Bloqueo liberado.')
      }
      setOperacion(null)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  if (!operacion) return <>
    {puedeCancelar && <button type="button" className="accion"
      onClick={() => setOperacion('cancelar')}>Cancelar reserva</button>}
    {puedeBloquear && <button type="button" className="accion" onClick={() => {
      setOperacion(turno.tipo === 'bloqueo' ? 'liberar' : 'bloquear')
    }}>{turno.tipo === 'bloqueo' ? 'Liberar bloqueo' : tituloBloqueo}</button>}
  </>

  return <form className="formulario-bloqueo" onSubmit={handleSubmit(confirmar)}>
    {bloquear && turno.tipo === 'reserva' && <p>Al confirmar, se cancela la reserva actual y se bloquea el turno.</p>}
    {cancelar && <p>Al confirmar, se cancela la reserva y el turno vuelve a quedar disponible si está dentro del horario de atención.</p>}
    {!bloquear ? <label>{cancelar ? 'Motivo de cancelación' : 'Motivo de liberación'}
      <textarea {...register('motivo')} rows={3} required minLength={5} disabled={guardando} />
    </label> : <>
      <label>Motivo del bloqueo
        <select {...register('motivo')} defaultValue="" required disabled={guardando}>
          <option value="" disabled>Elegí un motivo</option>
          {Object.entries(motivosBloqueo).map(([valor, nombre]) =>
            <option key={valor} value={valor}>{nombre}</option>
          )}
        </select>
      </label>
      <label>Observaciones <span className="opcional">(opcional)</span>
        <textarea {...register('observaciones')} rows={3} disabled={guardando} />
      </label>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="acciones">
      <button type="button" disabled={guardando} onClick={() => {
        setError('')
        setOperacion(null)
      }}>Volver</button>
      <button className="primario" disabled={guardando}>
        {guardando ? 'Guardando…' : bloquear ? tituloBloqueo : cancelar ? 'Confirmar cancelación' : 'Confirmar liberación'}
      </button>
    </div>
  </form>
}

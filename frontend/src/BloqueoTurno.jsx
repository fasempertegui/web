import React, { useState } from 'react'
import { api } from './api.js'

export const motivosBloqueo = {
  clima_adverso: 'Clima adverso',
  torneo: 'Torneo',
  mantenimiento: 'Mantenimiento',
}

export function BloqueoTurno({ turno, canchaId, fecha, alGuardar }) {
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const liberar = turno.tipo === 'bloqueo'
  const reemplazar = turno.tipo === 'reserva'
  const accion = liberar ? 'Liberar bloqueo' : reemplazar ? 'Cancelar y bloquear' : 'Bloquear turno'

  async function confirmar(evento) {
    evento.preventDefault()
    const campos = new FormData(evento.currentTarget)
    const motivo = campos.get('motivo').trim()
    if (liberar && motivo.length < 5) {
      setError('Ingresá un motivo de al menos 5 caracteres.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      if (liberar) {
        await api(`bloqueos/${turno.bloqueo_id}/liberar/`, { datos: { motivo } })
      } else {
        await api('bloqueos/', { datos: {
          cancha_id: String(canchaId),
          fecha,
          hora_inicio: turno.hora_inicio,
          evento_esperado: String(turno.evento_id),
          motivo,
          observaciones: campos.get('observaciones'),
        } })
      }
      await alGuardar(liberar ? 'Bloqueo liberado.' : 'Turno bloqueado.')
      setAbierto(false)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return <button type="button" className="accion" onClick={() => setAbierto(true)}>{accion}</button>
  }

  return <form className="formulario-bloqueo" onSubmit={confirmar}>
    {reemplazar && <p>Al confirmar, se cancela la reserva actual y se bloquea el turno.</p>}
    {liberar ? <label>Motivo de liberación
      <textarea name="motivo" rows={3} required minLength={5} disabled={guardando} />
    </label> : <>
      <label>Motivo del bloqueo
        <select name="motivo" defaultValue="" required disabled={guardando}>
          <option value="" disabled>Elegí un motivo</option>
          {Object.entries(motivosBloqueo).map(([valor, nombre]) =>
            <option key={valor} value={valor}>{nombre}</option>
          )}
        </select>
      </label>
      <label>Observaciones <span className="opcional">(opcional)</span>
        <textarea name="observaciones" rows={3} disabled={guardando} />
      </label>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="acciones">
      <button type="button" disabled={guardando} onClick={() => {
        setError('')
        setAbierto(false)
      }}>Volver</button>
      <button className="primario" disabled={guardando}>
        {guardando ? 'Guardando…' : liberar ? 'Confirmar liberación' : accion}
      </button>
    </div>
  </form>
}

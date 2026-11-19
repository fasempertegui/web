import React from 'react'
import { Link } from 'react-router-dom'
import { useConsulta } from '@/hooks/use-consulta'
import { labelFecha } from './fechas.js'

export function HistorialTurno({ cancha, fecha, turno, volver }) {
  const filtros = new URLSearchParams({
    cancha_id: cancha.id, fecha, hora_inicio: turno.hora_inicio,
  })
  const { datos: resultado, error, cargando } = useConsulta('agenda/historial/?' + filtros)

  return <>
    <div className="turno-resumen">
      <span>Historial del turno</span>
      <h3>{turno.hora_inicio} – {turno.hora_fin}</h3>
      <p>{cancha.nombre} · {labelFecha(fecha)}</p>
    </div>
    <button type="button" className="accion" onClick={volver}>Volver al turno</button>
    {cargando && <p role="status">Cargando historial…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {resultado?.historial?.length === 0 && <p>No hay cancelaciones ni liberaciones para mostrar.</p>}
    {resultado?.historial?.length > 0 && <ul className="historial-turno">
      {resultado.historial.map((fila, indice) => <li key={indice} className={fila.tipo}>
        <strong>{fila.tipo === 'reserva' ? 'Reserva cancelada' : 'Bloqueo liberado'}</strong>
        <span>{fila.detalle}</span>
        {fila.reserva_id && <Link to={`/mis-reservas?reserva=${fila.reserva_id}`}>Ver reserva</Link>}
      </li>)}
    </ul>}
  </>
}

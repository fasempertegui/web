import React from 'react'
import { History } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { horaActual, hoy, labelFecha } from './fechas.js'
import { etiquetasBloqueo } from './AccionesTurno.jsx'

const estados = {
  libre: 'Libre',
  reserva: 'Reserva',
  bloqueo: 'Bloqueo',
  solo_historial: 'Historial',
  no_disponible: 'No disponible',
}

export function estadoTurno(turno) {
  return estados[turno.tipo || 'libre']
}

export function GrillaAgenda({ columnas, horas, fecha, sede, administrador, canchaId, hora, seleccionar }) {
  const canchas = columnas.map(({ cancha, turnos }) => ({
    ...cancha, porHora: new Map(turnos.map(turno => [turno.hora_inicio, turno])),
  }))
  const estadosVisibles = new Set(columnas.flatMap(({ turnos }) => turnos.map(turno => turno.tipo || 'libre')))
  const tipos = administrador ? ['libre', 'reserva', 'bloqueo'] : ['libre', 'reserva', 'no_disponible']
  const leyenda = tipos.filter(tipo => estadosVisibles.has(tipo))
  const horaLocal = fecha === hoy() ? horaActual().slice(0, 2) : null

  return <Card className="agenda-tablero gap-0 border-border overflow-hidden py-0 shadow-none">
    <div className="agenda-tablero-cabecera">
      <h2 className="agenda-titulo">{labelFecha(fecha)}</h2>
      {leyenda.length > 0 && <ul className="agenda-leyenda" aria-label="Estados de los turnos">
        {leyenda.map(tipo => <li key={tipo} data-tipo={tipo}>{estados[tipo]}</li>)}
      </ul>}
    </div>
    <div className="agenda-tablero-scroll" tabIndex={0} role="region" aria-label="Grilla de turnos">
      <table aria-label={`Turnos de ${sede}, ${labelFecha(fecha)}`}>
        <thead>
          <tr>
            <th scope="col" className="agenda-hora">Hora</th>
            {canchas.map(cancha => <th key={cancha.id} scope="col">{cancha.nombre}</th>)}
          </tr>
        </thead>
        <tbody>{horas.map((inicio, indice) => {
          const anterior = horas[indice - 1]
          const finAnterior = anterior && String(Number(anterior.slice(0, 2)) + 1).padStart(2, '0') + ':00'
          const ahora = horaLocal === inicio.slice(0, 2)
          return <React.Fragment key={inicio}>
            {anterior && finAnterior < inicio && <tr className="agenda-pausa">
              <td colSpan={canchas.length + 1}>{finAnterior} – {inicio} · Fuera del horario de atención</td>
            </tr>}
            <tr>
              <th scope="row" className="agenda-hora" data-ahora={ahora}>
                <time>{inicio}</time>
                {ahora && <small>Ahora</small>}
              </th>
              {canchas.map(cancha => {
                const turno = cancha.porHora.get(inicio)
                const seleccionado = canchaId === String(cancha.id) && hora === inicio
                const detalle = turno?.organizador || etiquetasBloqueo[turno?.motivo]
                return <td key={cancha.id}>
                  {turno ? <button type="button" className="agenda-celda"
                    data-tipo={turno.tipo || 'libre'} data-iniciado={turno.iniciado}
                    aria-label={`${cancha.nombre}, ${inicio}, ${estadoTurno(turno)}${turno.tiene_historial ? ', con historial' : ''}`}
                    aria-pressed={seleccionado}
                    onClick={evento => seleccionar(cancha.id, inicio, evento.currentTarget)}>
                    <span className="agenda-celda-estado">{estadoTurno(turno)}</span>
                    {detalle && <span className="agenda-celda-detalle">{detalle}</span>}
                    {turno.tiene_historial && <History className="agenda-celda-historial" aria-hidden="true" />}
                  </button> : <span className="agenda-sin-turno" aria-label="Sin turno">—</span>}
                </td>
              })}
            </tr>
          </React.Fragment>
        })}</tbody>
      </table>
    </div>
  </Card>
}

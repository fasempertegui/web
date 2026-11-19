import React, { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from './api.js'
import { desplazarFecha, fechaValida, horaActual, hoy, importe, labelFecha } from './fechas.js'

const inicioOperaciones = '2026-08-01'
const motivos = { clima_adverso: 'Clima adverso', torneo: 'Torneo', mantenimiento: 'Mantenimiento' }

function horariosSede(sede, fecha) {
  const dia = new Date(fecha + 'T12:00:00Z').getUTCDay() || 7
  const horario = sede.horarios.find(item => item.dia_semana === dia)
  if (!horario) return []
  const franjas = [[horario.hora_inicio_1, horario.hora_fin_1], [horario.hora_inicio_2, horario.hora_fin_2]]
  return franjas.flatMap(([inicio, fin]) => {
    if (!inicio) return []
    const desde = Number(inicio.slice(0, 2))
    const hasta = Number(fin.slice(0, 2))
    return Array.from({ length: hasta - desde }, (_, indice) => {
      const hora = desde + indice
      return {
        hora_inicio: String(hora).padStart(2, '0') + ':00',
        hora_fin: String(hora + 1).padStart(2, '0') + ':00',
      }
    })
  })
}

async function consultarAgenda(sede, fecha, administrador, signal) {
  if (administrador) {
    return Promise.all(sede.canchas.map(async cancha => {
      const datos = await api(`agenda/?cancha_id=${cancha.id}&fecha=${fecha}`, { signal })
      return { cancha, turnos: datos.turnos }
    }))
  }

  const horarios = horariosSede(sede, fecha)
  const { reservas } = await api('reservas/', { signal })
  const propias = reservas.filter(reserva => reserva.fecha === fecha && reserva.estado !== 'anulado')
  return Promise.all(sede.canchas.map(async cancha => {
    let datos = { turnos: [] }
    if (fecha >= hoy() && fecha <= desplazarFecha(hoy(), 3) && horarios.length) {
      try {
        datos = await api(`canchas/${cancha.id}/disponibilidad/?fecha=${fecha}`, { signal })
      } catch (error) {
        if (!error.message.includes('precio por turno')) throw error
      }
    }
    const turnos = new Map(horarios.map(turno => [turno.hora_inicio, { ...turno, tipo: 'no_disponible' }]))
    for (const libre of datos.turnos) turnos.set(libre.hora_inicio, libre)
    for (const reserva of propias.filter(item => item.cancha_id === cancha.id)) {
      turnos.set(reserva.hora_inicio, { ...reserva, tipo: 'reserva' })
    }
    return { cancha, turnos: [...turnos.values()] }
  }))
}

function estadoTurno(turno) {
  if (turno.tipo === 'bloqueo') return 'Bloqueo'
  if (turno.tipo === 'reserva') return 'Reserva'
  if (turno.tipo === 'no_disponible') return 'No disponible'
  return 'Libre'
}

export function Agenda({ usuario }) {
  const [params, setParams] = useSearchParams()
  const [sedes, setSedes] = useState(null)
  const [errorSedes, setErrorSedes] = useState('')
  const [consulta, setConsulta] = useState(null)
  const celdaActiva = useRef(null)
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
    consultarAgenda(sede, fecha, administrador, control.signal)
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
  const columna = columnas.find(item => String(item.cancha.id) === canchaId)
  const turno = columna?.turnos.find(item => item.hora_inicio === hora)
  const horas = [...new Set(columnas.flatMap(item => item.turnos.map(t => t.hora_inicio)))].sort()
  const visibles = administrador ? horas : horas.filter(inicio =>
    (fecha > hoy() || (fecha === hoy() && inicio > horaActual())) ||
    columnas.some(item => item.turnos.some(t => t.hora_inicio === inicio && t.tipo === 'reserva'))
  )
  const maximo = desplazarFecha(hoy(), 365)
  const nuevoParams = new URLSearchParams({ sede: sede?.id || '', fecha })

  function cambiarVista(nuevaSede, nuevaFecha) {
    setParams({ sede: nuevaSede, fecha: nuevaFecha })
  }

  function seleccionar(id, inicio) {
    setParams({ ...Object.fromEntries(nuevoParams), cancha: id, hora: inicio }, { replace: true })
  }

  function cerrarDetalle() {
    setParams(nuevoParams, { replace: true })
    celdaActiva.current?.focus()
  }

  function reservarDisponible() {
    return turno && !turno.tipo && fecha >= hoy() && fecha <= desplazarFecha(hoy(), 3)
      && (fecha !== hoy() || hora > horaActual())
  }

  return <main className="pagina" onKeyDown={evento => {
    if (evento.key === 'Escape' && turno) cerrarDetalle()
  }}>
    <header className="encabezado">
      <h1>Agenda</h1>
      <p>{administrador ? 'Consultá las reservas y los bloqueos de cada cancha.' : 'Elegí un turno para consultar su disponibilidad.'}</p>
    </header>
    {errorSedes && <p className="error" role="alert">{errorSedes}</p>}
    {sedes === null && !errorSedes && <p role="status">Cargando sedes…</p>}
    {sedes?.length === 0 && <p className="tarjeta vacio">
      {administrador ? 'Cargá una sede y sus canchas desde el admin de Django para ver la agenda.' : 'Todavía no hay sedes disponibles.'}
    </p>}
    {sede && <>
      <section className="tarjeta filtros" aria-label="Filtros de agenda">
        <label>Sede<select value={sede.id} onChange={evento => cambiarVista(evento.target.value, fecha)}>
          {sedes.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select></label>
        <div>
          <label htmlFor="fecha-agenda">Fecha</label>
          <div className="selector-fecha">
            <button aria-label="Día anterior" disabled={fecha <= inicioOperaciones}
              onClick={() => cambiarVista(sede.id, desplazarFecha(fecha, -1))}>‹</button>
            <input id="fecha-agenda" type="date" value={fecha} min={inicioOperaciones} max={maximo}
              onChange={evento => {
                const valor = evento.target.value
                if (valor >= inicioOperaciones && valor <= maximo) cambiarVista(sede.id, valor)
              }} />
            <button aria-label="Día siguiente" disabled={fecha >= maximo}
              onClick={() => cambiarVista(sede.id, desplazarFecha(fecha, 1))}>›</button>
            <button onClick={() => cambiarVista(sede.id, hoy())}>Hoy</button>
          </div>
        </div>
      </section>
      <h2 className="fecha-agenda">{labelFecha(fecha)}</h2>
      {!activa && <p role="status">Cargando agenda…</p>}
      {activa?.error && <p className="error" role="alert">{activa.error}</p>}
      {activa?.columnas && columnas.length === 0 && <p className="tarjeta vacio">La sede todavía no tiene canchas activas.</p>}
      {columnas.length > 0 && visibles.length === 0 && <p className="tarjeta vacio">
        {fecha < hoy() && !administrador ? 'No tenés reservas en esta fecha.' : 'No hay turnos para mostrar en esta fecha.'}
      </p>}
      {visibles.length > 0 && <div className="agenda-cuerpo">
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
                      {celda ? <button ref={seleccionada ? celdaActiva : null}
                        className={`celda ${celda.tipo || 'libre'}`}
                        aria-label={`${cancha.nombre}, ${inicio}, ${estadoTurno(celda)}`}
                        aria-pressed={seleccionada} onClick={() => seleccionar(cancha.id, inicio)}>
                        <span>{estadoTurno(celda)}</span>
                        {celda.organizador && <small>{celda.organizador}</small>}
                        {motivos[celda.motivo] && <small>{motivos[celda.motivo]}</small>}
                      </button> : <span className="sin-turno" aria-label="Sin turno">—</span>}
                    </td>
                  })}
                </tr>
              </React.Fragment>
            })}</tbody>
          </table>
        </div>
        <aside className="tarjeta detalle" aria-label="Detalle del turno">
          {turno ? <>
            <div className="turno-resumen">
              <span>{estadoTurno(turno)}</span>
              <button type="button" aria-label="Cerrar detalle" onClick={cerrarDetalle}>×</button>
              <h3>{turno.hora_inicio} – {turno.hora_fin}</h3>
              <p>{columna.cancha.nombre}</p>
            </div>
            {turno.organizador && <p>{turno.organizador}</p>}
            {turno.importe && <p>{importe(turno.importe)}</p>}
            {turno.motivo && <p>{motivos[turno.motivo]}</p>}
            {turno.observaciones && <p>{turno.observaciones}</p>}
            {reservarDisponible() && <Link className="primario accion"
              to={'/agenda/nueva-reserva?' + params.toString()}>Nueva reserva</Link>}
          </> : <>
            <h3>Elegí un turno</h3>
            <p>Seleccioná una celda para consultar su detalle.</p>
          </>}
        </aside>
      </div>}
    </>}
  </main>
}

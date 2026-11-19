import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from './api.js'
import { diaSemanaISO, horaActual, hoy, labelFecha, proximosMeses } from './fechas.js'
import { motivosBloqueo } from './AccionesTurno.jsx'

const etiquetas = {
  bloquear: 'Bloquear',
  cancelar: 'Cancelar reserva',
  liberar: 'Liberar bloqueo',
  turno_iniciado: 'Turno iniciado',
  finalizado: 'Finalizado',
  cierre_por_mal_tiempo: 'Cubierto por un cierre por mal tiempo',
  fuera_de_horario: 'Fuera de horario',
  seleccionado_para_conservar: 'Marcado para conservar',
}

function horasDisponibles(sede, fecha, mensual) {
  const dia = diaSemanaISO(fecha)
  const horarios = mensual ? sede.horarios : sede.horarios.filter(item => item.dia_semana === dia)
  const inicios = new Set()
  const fines = new Set()
  const fechaHoy = hoy()
  const horaAhora = horaActual()
  for (const horario of horarios) {
    for (const [desde, hasta] of [
      [horario.hora_inicio_1, horario.hora_fin_1], [horario.hora_inicio_2, horario.hora_fin_2],
    ]) {
      if (!desde || !hasta) continue
      for (let hora = Number(desde.slice(0, 2)); hora < Number(hasta.slice(0, 2)); hora++) {
        const inicio = String(hora).padStart(2, '0') + ':00'
        if (mensual || fecha !== fechaHoy || inicio > horaAhora) {
          inicios.add(inicio)
          fines.add(String(hora + 1).padStart(2, '0') + ':00')
        }
      }
    }
  }
  return { inicios: [...inicios].sort(), fines: [...fines].sort() }
}

function GrupoRevision({ titulo, filas, sede }) {
  return <details className="grupo-revision">
    <summary>{titulo} ({filas.length})</summary>
    {filas.length === 0 ? <p>Sin turnos.</p> : <ul>
      {filas.map(fila => <li key={`${fila.fecha}:${fila.cancha_id}:${fila.hora_inicio}`}>
        <strong>{sede.canchas.find(cancha => cancha.id === fila.cancha_id)?.nombre || 'Cancha'} · {fila.hora_inicio}</strong>
        <span>{labelFecha(fila.fecha)}</span>
        {(fila.accion || fila.razon) && <span>
          {fila.accion === 'bloquear' && fila.tipo === 'reserva'
            ? 'Cancelar reserva y bloquear' : etiquetas[fila.accion || fila.razon]}
        </span>}
      </li>)}
    </ul>}
  </details>
}

export function AccionesAgenda({ sede, fecha, alcance, cerrar, alConfirmar }) {
  const mensual = alcance === 'mes'
  const meses = proximosMeses(3)
  const mesInicial = meses.find(mes => mes.valor === fecha.slice(0, 7))?.valor || meses[0].valor
  const [operacion, setOperacion] = useState(mensual ? 'liberar' : 'bloquear')
  const [seleccionarCanchas, setSeleccionarCanchas] = useState(false)
  const [desde, setDesde] = useState('')
  const [revision, setRevision] = useState(null)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const { register, handleSubmit, resetField, formState: { isSubmitting } } = useForm({ shouldUnregister: true })
  const cargando = isSubmitting || confirmando
  const horas = horasDisponibles(sede, fecha, mensual)
  const bloquear = operacion === 'bloquear'

  async function previsualizar(campos) {
    const canchas = seleccionarCanchas ? [].concat(campos.canchas || []).map(Number) : []
    if (seleccionarCanchas && canchas.length === 0) {
      setError('Elegí al menos una cancha.')
      return
    }

    const datos = {
      sede_id: sede.id,
      canchas,
      operacion,
      [mensual ? 'mes' : 'fecha']: mensual ? campos.mes : fecha,
      desde_hora: desde,
      hasta_hora: campos.hasta_hora || '',
      conservar_reservas: Boolean(campos.conservar_reservas),
      conservar_bloqueos: !bloquear && Boolean(campos.conservar_bloqueos),
      motivo: campos.motivo || '',
      observaciones: campos.observaciones || '',
    }
    setError('')
    try {
      const resultado = await api('bloqueos/masivos/vista-previa/', { datos })
      setRevision({ ...resultado, motivo: bloquear ? motivosBloqueo[datos.motivo] : datos.motivo })
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  async function confirmar() {
    setConfirmando(true)
    setError('')
    try {
      const { aplicadas } = await api('bloqueos/masivos/confirmar/', {
        datos: { confirmacion: revision.confirmacion },
      })
      await alConfirmar(aplicadas)
    } catch (fallo) {
      setError(fallo.message)
      setRevision(null)
    } finally {
      setConfirmando(false)
    }
  }

  return <>
    <div className="turno-resumen">
      <h3>{mensual ? 'Acciones del mes' : 'Acciones del día'}</h3>
      <button type="button" aria-label="Cerrar acciones" onClick={cerrar} disabled={cargando}>×</button>
      <p>{sede.nombre}</p>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <form className="acciones-agenda" hidden={Boolean(revision)} onSubmit={handleSubmit(previsualizar)}>
      <fieldset disabled={cargando}>
        {mensual ? <label>Mes
          <select {...register('mes')} defaultValue={mesInicial}>
            {meses.map(mes => <option key={mes.valor} value={mes.valor}>{mes.etiqueta}</option>)}
          </select>
        </label> : <label>Operación
          <select value={operacion} onChange={evento => {
            resetField('motivo', { defaultValue: '' })
            setOperacion(evento.target.value)
          }}>
            <option value="bloquear">Bloquear turnos</option>
            <option value="liberar">Liberar turnos</option>
          </select>
        </label>}
        <label>Canchas
          <select value={seleccionarCanchas ? 'seleccionar' : 'todas'}
            onChange={evento => setSeleccionarCanchas(evento.target.value === 'seleccionar')}>
            <option value="todas">Todas las canchas</option>
            <option value="seleccionar">Seleccionar canchas</option>
          </select>
        </label>
        {seleccionarCanchas && <fieldset className="opciones-agenda">
          <legend>Canchas incluidas</legend>
          {sede.canchas.map(cancha => <label key={cancha.id}>
            <input type="checkbox" {...register('canchas')} value={cancha.id} /> {cancha.nombre}
          </label>)}
        </fieldset>}
        <label>Horario
          <select value={desde} onChange={evento => {
            resetField('hasta_hora', { defaultValue: '' })
            setDesde(evento.target.value)
          }}>
            <option value="">Día completo</option>
            {horas.inicios.map(inicio => <option key={inicio} value={inicio}>Desde las {inicio}</option>)}
          </select>
        </label>
        {desde && <label>Hasta
          <select key={desde} {...register('hasta_hora')}>
            <option value="">Hasta el cierre</option>
            {horas.fines.filter(fin => fin > desde).map(fin => <option key={fin}>{fin}</option>)}
          </select>
        </label>}
        <fieldset className="opciones-agenda">
          <legend>Conservar actividades</legend>
          <label><input type="checkbox" {...register('conservar_reservas')} /> Reservas</label>
          {!bloquear && <label><input type="checkbox" {...register('conservar_bloqueos')} /> Bloqueos</label>}
        </fieldset>
        {bloquear ? <>
          <label>Motivo del bloqueo
            <select {...register('motivo')} defaultValue="" required>
              <option value="" disabled>Elegí un motivo</option>
              {Object.entries(motivosBloqueo).map(([valor, nombre]) =>
                <option key={valor} value={valor}>{nombre}</option>
              )}
            </select>
          </label>
          <label>Observaciones <span className="opcional">(opcional)</span>
            <textarea {...register('observaciones')} rows={2} />
          </label>
        </> : <label>Motivo de cancelación
          <textarea {...register('motivo')} rows={2} minLength={5} />
        </label>}
      </fieldset>
      <button className="primario accion" disabled={cargando}>{cargando ? 'Consultando…' : 'Revisar operación'}</button>
    </form>
    {revision && <div className="revision-lote">
      <h4>Vista previa</h4>
      {revision.motivo && <p>Motivo: {revision.motivo}</p>}
      <GrupoRevision titulo="Cambios" filas={revision.acciones} sede={sede} />
      <GrupoRevision titulo="Conservados" filas={revision.conservados} sede={sede} />
      {bloquear && <GrupoRevision titulo="Ya bloqueados" filas={revision.ya_bloqueados} sede={sede} />}
      {revision.acciones.length === 0 && <p>No hay cambios para aplicar.</p>}
      <div className="acciones">
        <button type="button" disabled={cargando} onClick={() => setRevision(null)}>Editar selección</button>
        {revision.acciones.length > 0 && <button type="button" className="primario" disabled={cargando}
          onClick={confirmar}>{cargando ? 'Aplicando…' : 'Confirmar cambios'}</button>}
      </div>
    </div>}
  </>
}

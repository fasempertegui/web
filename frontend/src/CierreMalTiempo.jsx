import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useConsulta } from '@/hooks/use-consulta'
import { api } from './api.js'
import { horaActual, hoy, labelFecha } from './fechas.js'

const ruta = 'cierres-mal-tiempo/'

function fechaHora(valor) {
  return `${labelFecha(valor.slice(0, 10))} · ${valor.slice(11, 16)}`
}

function RevisionCierre({ revision, sedes, reapertura }) {
  return <div className="revision-lote">
    <h4>Vista previa</h4>
    {sedes.map(sede => {
      const cambios = (reapertura ? revision.liberar : revision.bloquear)
        .filter(turno => turno.sede_id === sede.id)
      const previos = (revision.ya_bloqueados || []).filter(turno => turno.sede_id === sede.id)
      const cancelaciones = cambios.filter(turno => turno.cancela_reserva).length
      return <details className="grupo-revision" key={sede.id}>
        <summary>{sede.nombre} · {cambios.length} {reapertura ? 'a liberar' : 'a bloquear'}
          {cancelaciones > 0 && <small>Reservas a cancelar: {cancelaciones}</small>}
          {previos.length > 0 && <small>Turnos ya bloqueados: {previos.length}</small>}
        </summary>
        {!cambios.length && !previos.length ? <p>Sin turnos afectados.</p> : <ul>
          {[...cambios, ...previos].map(turno => <li
            key={`${turno.cancha_id}:${turno.fecha}:${turno.hora_inicio}`}>
            <strong>{turno.cancha} · {turno.hora_inicio}</strong>
            <span>{labelFecha(turno.fecha)}</span>
            <span>{previos.includes(turno) ? 'Ya bloqueado'
              : reapertura ? 'Liberar bloqueo'
              : turno.cancela_reserva ? 'Cancelar reserva y bloquear' : 'Bloquear'}</span>
          </li>)}
        </ul>}
      </details>
    })}
  </div>
}

function FormularioCierre({ sedes, cierre, sedeId, volver, alConfirmar }) {
  const actual = `${hoy()}T${horaActual()}`
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()
  const [revision, setRevision] = useState(null)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const ocupado = isSubmitting || confirmando

  async function revisar(datos) {
    setError('')
    const seleccion = [].concat(datos.sedes || []).map(Number)
    if (!cierre && !seleccion.length) {
      setError('Seleccioná al menos una sede.')
      return
    }
    try {
      const vista = await api(ruta + (cierre ? `${cierre.id}/reapertura/` : 'vista-previa/'), {
        datos: cierre ? { hasta: datos.hasta } : { sedes: seleccion, desde: datos.desde, hasta: datos.hasta },
      })
      setRevision({ ...vista, hasta: datos.hasta, desde: datos.desde })
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  async function confirmar() {
    setConfirmando(true)
    setError('')
    try {
      const { aplicadas } = await api(ruta + 'confirmar/', {
        datos: { confirmacion: revision.confirmacion },
      })
      await alConfirmar(aplicadas, Boolean(cierre))
    } catch (fallo) {
      setError(fallo.message)
      setRevision(null)
    } finally {
      setConfirmando(false)
    }
  }

  const sinCambios = revision && !cierre && !revision.bloquear.length && !revision.ya_bloqueados.length

  return <>
    {error && <p className="error" role="alert">{error}</p>}
    <form className="acciones-agenda" onSubmit={handleSubmit(revisar)} hidden={Boolean(revision)}>
      <fieldset disabled={ocupado}>
        {cierre ? <>
          <p>{cierre.sedes.map(sede => sede.nombre).join(', ')}</p>
          <p>Fin vigente: {fechaHora(cierre.hasta)}</p>
        </> : <>
          <fieldset className="opciones-agenda">
            <legend>Sedes incluidas</legend>
            {sedes.map(sede => <label key={sede.id}>
              <input type="checkbox" {...register('sedes')} value={sede.id}
                defaultChecked={sede.id === sedeId} /> {sede.nombre}
            </label>)}
          </fieldset>
          <label>Desde
            <input type="datetime-local" {...register('desde')} defaultValue={actual} required />
          </label>
        </>}
        <label>{cierre ? 'Nuevo fin del cierre' : 'Hasta'}
          <input type="datetime-local" {...register('hasta')} min={actual} required />
        </label>
      </fieldset>
      <div className="acciones">
        <button type="button" disabled={ocupado} onClick={volver}>Volver</button>
        <button className="primario" disabled={ocupado}>{ocupado ? 'Consultando…' : 'Revisar'}</button>
      </div>
    </form>
    {revision && <>
      {cierre ? <p>Nuevo fin: {fechaHora(revision.hasta)}</p>
        : <p>{fechaHora(revision.desde)}<br />Hasta {fechaHora(revision.hasta)}</p>}
      <RevisionCierre revision={revision} sedes={cierre ? cierre.sedes : revision.sedes} reapertura={Boolean(cierre)} />
      {sinCambios && <p>No hay turnos futuros para bloquear en ese período.</p>}
      <div className="acciones">
        <button type="button" disabled={ocupado} onClick={() => setRevision(null)}>Editar selección</button>
        {!sinCambios && <button type="button" className="primario" disabled={ocupado} onClick={confirmar}>
          {ocupado ? 'Aplicando…' : cierre ? 'Confirmar reapertura' : 'Confirmar cierre'}
        </button>}
      </div>
    </>}
  </>
}

export function CierreMalTiempo({ sedes, sedeId, cerrar, alConfirmar }) {
  const [modo, setModo] = useState(null)
  const { datos: listado, error, cargando } = useConsulta(ruta)

  return <>
    <div className="turno-resumen">
      <button type="button" aria-label="Cerrar panel de mal tiempo" onClick={cerrar}>×</button>
      <h3>{modo?.id ? 'Adelantar reapertura' : 'Cierre por mal tiempo'}</h3>
    </div>
    {modo ? <FormularioCierre key={modo.id || 'nuevo'} sedes={sedes} sedeId={sedeId}
      cierre={modo.id ? modo : null} volver={() => setModo(null)} alConfirmar={alConfirmar} /> : <>
      <button type="button" className="primario accion" onClick={() => setModo('nuevo')}>Nuevo cierre</button>
      <h4>Cierres vigentes y programados</h4>
      {cargando && <p role="status">Cargando cierres…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {listado?.cierres?.length === 0 && <p>No hay cierres programados.</p>}
      {listado?.cierres?.length > 0 && <ul className="lista-cierres">
        {listado.cierres.map(cierre => <li key={cierre.id}>
          <button type="button" onClick={() => setModo(cierre)}>
            <strong>{cierre.sedes.map(sede => sede.nombre).join(', ')}</strong>
            <small>Desde {fechaHora(cierre.desde)}</small>
            <small>Hasta {fechaHora(cierre.hasta)}</small>
          </button>
        </li>)}
      </ul>}
    </>}
  </>
}

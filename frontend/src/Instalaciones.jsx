import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { importe } from './fechas.js'

const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const superficies = { cemento: 'Cemento', polvo_ladrillo: 'Polvo de ladrillo' }
const horas = Array.from({ length: 24 }, (_, hora) => String(hora).padStart(2, '0') + ':00')

function CampoHora({ nombre, etiqueta, valor, requerido }) {
  return <label>{etiqueta}
    <select name={nombre} defaultValue={valor || ''} required={requerido}>
      <option value="">Elegí una hora</option>
      {horas.map(hora => <option key={hora}>{hora}</option>)}
    </select>
  </label>
}

function EditorInstalacion({ accion, sede, cerrar, guardar }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cerrado, marcarCerrado] = useState(false)
  const horario = sede?.horarios.find(item => item.dia_semana === accion.dia)
  const titulos = {
    sede: 'Nueva sede',
    cancha: 'Nueva cancha',
    precio: 'Editar tarifa',
    horario: dias[accion.dia - 1],
  }

  async function enviar(evento) {
    evento.preventDefault()
    const datos = Object.fromEntries(new FormData(evento.currentTarget))
    let ruta = 'instalaciones/'
    if (accion.tipo === 'cancha') ruta += `${sede.id}/canchas/`
    if (accion.tipo === 'precio') ruta += `${sede.id}/precio/`
    if (accion.tipo === 'horario') ruta += `${sede.id}/horarios/${accion.dia}/`
    const metodo = cerrado ? 'DELETE' : (accion.tipo === 'precio' || accion.tipo === 'horario') ? 'PUT' : 'POST'
    setGuardando(true)
    setError('')
    try {
      const respuesta = await api(ruta, { metodo, datos: cerrado ? undefined : datos })
      guardar(respuesta.sede)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  return <section className="tarjeta editor-instalacion">
    <h2>{titulos[accion.tipo]}</h2>
    <form onSubmit={enviar}>
      <fieldset disabled={guardando}>
        {['sede', 'cancha'].includes(accion.tipo) && <label>Nombre
          <input name="nombre" required maxLength={120} />
        </label>}
        {accion.tipo === 'sede' && <label>Dirección
          <input name="direccion" required maxLength={250} />
        </label>}
        {accion.tipo === 'cancha' && <label>Superficie
          <select name="superficie" required defaultValue="">
            <option value="" disabled>Elegí una superficie</option>
            {Object.entries(superficies).map(([valor, etiqueta]) =>
              <option key={valor} value={valor}>{etiqueta}</option>
            )}
          </select>
        </label>}
        {accion.tipo === 'precio' && <label>Precio por turno (ARS)
          <input name="precio_reserva_vigente" type="number" min="0.01" step="0.01"
            max="9999999999.99" defaultValue={sede.precio_reserva_vigente || ''} />
        </label>}
        {accion.tipo === 'horario' && <>
          {horario && <label className="dia-cerrado">
            <input type="checkbox" checked={cerrado} onChange={evento => marcarCerrado(evento.target.checked)} />
            Marcar el día como cerrado
          </label>}
          {!cerrado && <>
            <fieldset className="franja-horario">
              <legend>Primera franja</legend>
              <CampoHora nombre="hora_inicio_1" etiqueta="Desde" valor={horario?.hora_inicio_1} requerido />
              <CampoHora nombre="hora_fin_1" etiqueta="Hasta" valor={horario?.hora_fin_1} requerido />
            </fieldset>
            <fieldset className="franja-horario">
              <legend>Segunda franja (opcional)</legend>
              <CampoHora nombre="hora_inicio_2" etiqueta="Desde" valor={horario?.hora_inicio_2} />
              <CampoHora nombre="hora_fin_2" etiqueta="Hasta" valor={horario?.hora_fin_2} />
            </fieldset>
          </>}
        </>}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button type="button" disabled={guardando} onClick={cerrar}>Volver</button>
        <button className="primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  </section>
}

function horarioDelDia(horario) {
  if (!horario) return 'Cerrado'
  const primera = `${horario.hora_inicio_1} – ${horario.hora_fin_1}`
  return horario.hora_inicio_2 ? `${primera} · ${horario.hora_inicio_2} – ${horario.hora_fin_2}` : primera
}

export function Instalaciones() {
  const [sedes, setSedes] = useState(null)
  const [seleccion, seleccionar] = useState(null)
  const [accion, setAccion] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const sede = sedes?.find(item => item.id === seleccion) || sedes?.[0]

  useEffect(() => {
    const control = new AbortController()
    api('instalaciones/', { signal: control.signal })
      .then(datos => setSedes(datos.sedes))
      .catch(fallo => { if (fallo.name !== 'AbortError') setError(fallo.message) })
    return () => control.abort()
  }, [])

  function abrir(nueva) {
    setMensaje('')
    setAccion(nueva)
  }

  function guardar(actualizada) {
    setSedes(actuales => {
      const otras = actuales.filter(item => item.id !== actualizada.id)
      return [...otras, actualizada].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'))
    })
    seleccionar(actualizada.id)
    setAccion(null)
    setMensaje('Cambios guardados.')
  }

  return <main className="pagina">
    <header className="encabezado encabezado-agenda">
      <h1>Instalaciones</h1>
      {sedes && !accion && <button type="button" className="primario"
        onClick={() => abrir({ tipo: 'sede' })}>Nueva sede</button>}
    </header>
    {error && <p className="error" role="alert">{error}</p>}
    {mensaje && <p className="reserva-mensaje" role="status">{mensaje}</p>}
    {!sedes && !error && <p role="status">Cargando instalaciones…</p>}
    {sedes?.length === 0 && !accion && <p className="tarjeta vacio">Todavía no hay sedes.</p>}
    <div className="agenda-cuerpo">
      {sede && <div className="secciones-reservas">
        <section className="tarjeta filtros">
          <label>Sede
            <select value={sede.id} disabled={Boolean(accion)}
              onChange={evento => { seleccionar(Number(evento.target.value)); setMensaje('') }}>
              {sedes.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <p className="texto-suave">{sede.direccion}</p>
        </section>
        <section className="tarjeta lista-reservas">
          <div className="encabezado-agenda">
            <div><h2>Tarifa por turno</h2>
              <p className="texto-suave">{sede.precio_reserva_vigente
                ? importe(sede.precio_reserva_vigente) : 'Sin tarifa configurada'}</p></div>
            {!accion && <button type="button" onClick={() => abrir({ tipo: 'precio' })}>Editar tarifa</button>}
          </div>
        </section>
        <section className="tarjeta lista-reservas">
          <div className="encabezado-agenda">
            <h2>Canchas</h2>
            {!accion && <button type="button" onClick={() => abrir({ tipo: 'cancha' })}>Nueva cancha</button>}
          </div>
          {sede.canchas.length === 0 ? <p className="texto-suave">Todavía no hay canchas.</p> :
            <ul className="lista-instalacion">{sede.canchas.map(cancha => <li key={cancha.id}>
              <strong>{cancha.nombre}</strong><span>{superficies[cancha.superficie]}</span>
            </li>)}</ul>}
        </section>
        <section className="tarjeta lista-reservas">
          <h2>Horarios de atención</h2>
          <ul className="lista-instalacion">{dias.map((dia, indice) => {
            const numero = indice + 1
            const horario = sede.horarios.find(item => item.dia_semana === numero)
            return <li key={dia}>
              <div><strong>{dia}</strong><span>{horarioDelDia(horario)}</span></div>
              {!accion && <button type="button" aria-label={`Editar horario del ${dia.toLowerCase()}`}
                onClick={() => abrir({ tipo: 'horario', dia: numero })}>Editar</button>}
            </li>
          })}</ul>
        </section>
      </div>}
      {accion && <EditorInstalacion key={`${sede?.id}:${accion.tipo}:${accion.dia}`}
        accion={accion} sede={sede} cerrar={() => setAccion(null)} guardar={guardar} />}
    </div>
  </main>
}

import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { hoy, labelFecha } from './fechas.js'

export function Perfil({ usuario, alGuardar }) {
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const control = new AbortController()
    api('perfil/', { signal: control.signal })
      .then(datos => alGuardar(datos.usuario))
      .catch(fallo => { if (fallo.name !== 'AbortError') setError(fallo.message) })
      .finally(() => { if (!control.signal.aborted) setCargando(false) })
    return () => control.abort()
  }, [alGuardar])

  async function guardar(evento) {
    evento.preventDefault()
    const datos = Object.fromEntries(new FormData(evento.currentTarget))
    setGuardando(true)
    setError('')
    try {
      const perfil = await api('perfil/', { datos, metodo: 'PUT' })
      alGuardar(perfil.usuario)
      setEditando(false)
      setGuardado(true)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  function abrirEdicion() {
    setError('')
    setGuardado(false)
    setEditando(true)
  }

  return <main className="pagina pagina-reserva">
    <header className="encabezado"><h1>Mi perfil</h1></header>
    {guardado && <p className="reserva-mensaje" role="status">Perfil actualizado.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <section className="tarjeta reserva-form">
      {editando ? <form onSubmit={guardar}>
        <div className="campos-perfil">
          <label>Nombre<input name="nombre" defaultValue={usuario.nombre}
            required maxLength={100} autoComplete="given-name" disabled={guardando} /></label>
          <label>Apellido<input name="apellido" defaultValue={usuario.apellido}
            required maxLength={100} autoComplete="family-name" disabled={guardando} /></label>
          <label>Celular<input name="celular_contacto" type="tel" defaultValue={usuario.celular_contacto}
            required maxLength={30} autoComplete="tel" disabled={guardando} /></label>
          <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date"
            defaultValue={usuario.fecha_nacimiento || ''} required max={hoy()}
            autoComplete="bday" disabled={guardando} /></label>
        </div>
        <div className="acciones">
          <button type="button" disabled={guardando} onClick={() => {
            setEditando(false)
            setError('')
          }}>Cancelar</button>
          <button className="primario" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form> : <>
        <dl className="revision datos-perfil">
          <div><dt>Nombre</dt><dd>{[usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || 'Sin cargar'}</dd></div>
          <div><dt>Usuario</dt><dd>{usuario.nombre_usuario}</dd></div>
          <div><dt>Correo</dt><dd>{usuario.email || 'Sin cargar'}</dd></div>
          <div><dt>Celular</dt><dd>{usuario.celular_contacto || 'Sin cargar'}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>
            {usuario.fecha_nacimiento ? labelFecha(usuario.fecha_nacimiento) : 'Sin cargar'}
          </dd></div>
        </dl>
        <div className="acciones">
          <button type="button" className="primario" disabled={cargando} onClick={abrirEdicion}>Editar perfil</button>
        </div>
      </>}
    </section>
  </main>
}

import React, { useEffect, useState } from 'react'
import { api } from './api.js'

function nombreCompleto(usuario) {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.nombre_usuario
}

function DetalleUsuario({ cuenta, cerrar, alGuardar }) {
  const [accion, setAccion] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  function cambiarAccion(nueva) {
    setAccion(nueva)
    setError('')
    setMensaje('')
  }

  async function guardar(evento) {
    evento.preventDefault()
    const datos = Object.fromEntries(new FormData(evento.currentTarget))
    setError('')
    if (accion === 'contrasena' && datos.contrasena !== datos.confirmar_contrasena) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setGuardando(true)
    try {
      const { usuario } = await api(`usuarios/${cuenta.id}/${accion}/`, { datos })
      alGuardar(usuario, accion)
      setMensaje(accion === 'correo' ? 'Correo actualizado.' : 'Contraseña restablecida.')
      setAccion(null)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  return <aside className="tarjeta detalle" aria-label="Detalle de la cuenta">
    <div className="turno-resumen">
      <span>{cuenta.es_administrador ? 'Administrador' : 'Usuario'}</span>
      <button type="button" aria-label="Cerrar detalle" disabled={guardando} onClick={cerrar}>×</button>
      <h3>{nombreCompleto(cuenta)}</h3>
      <p>{cuenta.nombre_usuario}</p>
    </div>
    <p>{cuenta.email || 'Sin correo'}</p>
    {mensaje && <p className="reserva-mensaje" role="status">{mensaje}</p>}
    {accion === null ? <>
      <button type="button" className="accion" onClick={() => cambiarAccion('correo')}>Cambiar correo</button>
      <button type="button" className="accion" onClick={() => cambiarAccion('contrasena')}>Restablecer contraseña</button>
    </> : <form key={accion} onSubmit={guardar}>
      {accion === 'correo' ? <label>Nuevo correo
        <input name="email" type="email" defaultValue={cuenta.email} required maxLength={254} disabled={guardando} />
      </label> : <div className="campos-contrasena">
        <label>Nueva contraseña<input name="contrasena" type="password" required autoComplete="new-password" disabled={guardando} /></label>
        <label>Confirmar contraseña<input name="confirmar_contrasena" type="password" required
          autoComplete="new-password" disabled={guardando} /></label>
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button type="button" disabled={guardando} onClick={() => cambiarAccion(null)}>Volver</button>
        <button className="primario" disabled={guardando}>
          {guardando ? 'Guardando…' : accion === 'correo' ? 'Guardar correo' : 'Confirmar restablecimiento'}
        </button>
      </div>
    </form>}
  </aside>
}

export function Usuarios({ alGuardar }) {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)
  const [seleccion, setSeleccion] = useState(null)
  const busqueda = texto.trim()
  const activa = resultado?.busqueda === busqueda ? resultado : null
  const cuenta = activa?.usuarios?.find(usuario => usuario.id === seleccion)

  useEffect(() => {
    if (busqueda.length < 2) return
    const control = new AbortController()
    const espera = setTimeout(() => {
      api('usuarios/?q=' + encodeURIComponent(busqueda), { signal: control.signal })
        .then(datos => {
          if (!control.signal.aborted) setResultado({ busqueda, usuarios: datos.usuarios })
        })
        .catch(fallo => {
          if (fallo.name !== 'AbortError') setResultado({ busqueda, error: fallo.message })
        })
    }, 220)

    return () => {
      clearTimeout(espera)
      control.abort()
    }
  }, [busqueda])

  function actualizar(usuario, accion) {
    setResultado(actual => actual?.usuarios ? {
      ...actual,
      usuarios: actual.usuarios.map(item => item.id === usuario.id ? usuario : item),
    } : actual)
    alGuardar(usuario, accion)
  }

  return <main className="pagina">
    <header className="encabezado"><h1>Usuarios</h1></header>
    <div className="agenda-cuerpo">
      <section className="tarjeta lista-reservas">
        <label>Buscar cuenta
          <input type="search" value={texto} placeholder="Nombre, apellido, usuario o correo"
            onChange={evento => {
              setTexto(evento.target.value)
              setSeleccion(null)
              if (evento.target.value.trim() !== busqueda) setResultado(null)
            }} />
        </label>
        {busqueda.length < 2 && <p className="estado-busqueda texto-suave">Ingresá al menos dos caracteres.</p>}
        {busqueda.length >= 2 && !activa && <p className="estado-busqueda" role="status">Buscando…</p>}
        {activa?.error && <p className="error estado-busqueda" role="alert">{activa.error}</p>}
        {activa?.usuarios?.length === 0 && <p className="estado-busqueda texto-suave">No encontramos usuarios.</p>}
        {activa?.usuarios?.length > 0 && <ul className="estado-busqueda">
          {activa.usuarios.map(usuario => <li key={usuario.id}>
            <button type="button" className="fila-reserva fila-usuario"
              aria-pressed={seleccion === usuario.id}
              onClick={() => setSeleccion(seleccion === usuario.id ? null : usuario.id)}>
              <span><strong>{nombreCompleto(usuario)}</strong><small>{usuario.nombre_usuario}</small></span>
              {usuario.email && <span>{usuario.email}</span>}
            </button>
          </li>)}
        </ul>}
      </section>
      {cuenta && <DetalleUsuario key={cuenta.id} cuenta={cuenta}
        cerrar={() => setSeleccion(null)} alGuardar={actualizar} />}
    </div>
  </main>
}

import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from './api.js'
import { hoy } from './fechas.js'

export function Registro() {
  const location = useLocation()
  const destino = location.state?.volver || '/agenda'
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function registrar(evento) {
    evento.preventDefault()
    const datos = Object.fromEntries(new FormData(evento.currentTarget))
    setError('')
    if (datos.contrasena !== datos.confirmar_contrasena) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setEnviando(true)
    try {
      await api('sesion/')
      const cuenta = await api('registro/', { datos })
      setNombreUsuario(cuenta.nombre_usuario)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setEnviando(false)
    }
  }

  if (nombreUsuario) return <section className="tarjeta acceso-form" aria-labelledby="cuenta-creada">
    <h2 id="cuenta-creada">Cuenta creada</h2>
    <p role="status">Tu nombre de usuario es <strong>{nombreUsuario}</strong>.</p>
    <Link className="primario" to={destino} replace state={{ nombreUsuario }}>Iniciar sesión</Link>
  </section>

  return <form className="tarjeta acceso-form registro-form" onSubmit={registrar}>
    <h2>Crear una cuenta</h2>
    <fieldset disabled={enviando} className="campos-registro">
      <label>Nombre<input name="nombre" required maxLength={100} autoComplete="given-name" /></label>
      <label>Apellido<input name="apellido" required maxLength={100} autoComplete="family-name" /></label>
      <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date" required max={hoy()} autoComplete="bday" /></label>
      <label>Celular<input name="celular_contacto" type="tel" required maxLength={30} autoComplete="tel" /></label>
      <label className="registro-correo">Correo<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label>Contraseña<input name="contrasena" type="password" required autoComplete="new-password" /></label>
      <label>Confirmar contraseña<input name="confirmar_contrasena" type="password" required autoComplete="new-password" /></label>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primario" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
    <Link className="enlace-acceso" to={destino}>Volver al inicio de sesión</Link>
  </form>
}

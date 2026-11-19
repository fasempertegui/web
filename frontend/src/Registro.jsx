import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router-dom'
import { api } from './api.js'
import { hoy } from './fechas.js'

export default function Registro() {
  const location = useLocation()
  const destino = location.state?.volver || '/agenda'
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting: enviando } } = useForm()

  async function registrar(datos) {
    setError('')
    if (datos.contrasena !== datos.confirmar_contrasena) {
      setError('Las contraseñas no coinciden.')
      return
    }
    try {
      const cuenta = await api('registro/', { datos })
      setNombreUsuario(cuenta.nombre_usuario)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  if (nombreUsuario) return <section className="tarjeta acceso-form" aria-labelledby="cuenta-creada">
    <h2 id="cuenta-creada">Cuenta creada</h2>
    <p role="status">Tu nombre de usuario es <strong>{nombreUsuario}</strong>.</p>
    <Link className="primario" to={destino} replace state={{ nombreUsuario }}>Iniciar sesión</Link>
  </section>

  return <form className="tarjeta acceso-form registro-form" onSubmit={handleSubmit(registrar)}>
    <h2>Crear una cuenta</h2>
    <fieldset disabled={enviando} className="campos-registro">
      <label>Nombre<input {...register('nombre')} required maxLength={100} autoComplete="given-name" /></label>
      <label>Apellido<input {...register('apellido')} required maxLength={100} autoComplete="family-name" /></label>
      <label>Fecha de nacimiento<input {...register('fecha_nacimiento')} type="date" required max={hoy()} autoComplete="bday" /></label>
      <label>Celular<input {...register('celular_contacto')} type="tel" required maxLength={30} autoComplete="tel" /></label>
      <label className="registro-correo">Correo<input {...register('email')} type="email" required maxLength={254} autoComplete="email" /></label>
      <label>Contraseña<input {...register('contrasena')} type="password" required autoComplete="new-password" /></label>
      <label>Confirmar contraseña<input {...register('confirmar_contrasena')} type="password" required autoComplete="new-password" /></label>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primario" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
    <Link className="enlace-acceso" to={destino}>Volver al inicio de sesión</Link>
  </form>
}

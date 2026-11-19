import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './api.js'
import { Agenda } from './Agenda.jsx'
import { NuevaReserva } from './NuevaReserva.jsx'
import { MisReservas } from "./MisReservas.jsx"
import './styles.css'

function Marca() {
  return <span className="marca"><img src="/logo.png" alt="" />Academia TM</span>
}

function Acceso({ iniciar, errorSesion }) {
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setOcupado(true)
    setError('')
    const datos = Object.fromEntries(new FormData(evento.currentTarget))
    try {
      await iniciar(datos)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setOcupado(false)
    }
  }

  return <main className="acceso">
    <header><Marca /></header>
    <div className="acceso-contenido">
      <section className="portada">
        <h1>Tu próximo encuentro<br /> te está esperando<span>.</span></h1>
        <p>Consultá la agenda y reservá tu cancha.</p>
      </section>
      <form className="tarjeta acceso-form" onSubmit={enviar}>
        <h2>Iniciar sesión</h2>
        <label>Usuario<input required name="nombre_usuario" autoComplete="username" /></label>
        <label>Contraseña<input required name="contrasena" type="password" autoComplete="current-password" /></label>
        {(error || errorSesion) && <p className="error" role="alert">{error || errorSesion}</p>}
        <button className="primario" disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </div>
  </main>
}

function App() {
  const [usuario, setUsuario] = useState(undefined)
  const [errorSesion, setErrorSesion] = useState('')
  const location = useLocation()

  useEffect(() => {
    const controlador = new AbortController()
    api('sesion/', { signal: controlador.signal })
      .then(datos => setUsuario(datos.usuario))
      .catch(error => {
        if (error.name !== 'AbortError') {
          setUsuario(null)
          setErrorSesion(error.message)
        }
      })
    return () => controlador.abort()
  }, [])

  async function iniciar(datos) {
    setErrorSesion('')
    await api('sesion/')
    const sesion = await api('sesion/iniciar/', { datos })
    setUsuario(sesion.usuario)
  }

  async function cerrar() {
    setErrorSesion('')
    try {
      await api('sesion/cerrar/', { datos: {} })
      setUsuario(null)
    } catch (error) {
      setErrorSesion(error.message)
    }
  }

  if (usuario === undefined) return <main className="espera" role="status">Cargando sesión…</main>
  if (!usuario) return <Acceso iniciar={iniciar} errorSesion={errorSesion} />

  const agenda = '/agenda' + location.search
  return <>
    <header className="barra">
      <div className="barra-contenido">
        <Link to={agenda} aria-label="Academia TM, agenda"><Marca /></Link>
        <div className="barra-cuenta">
          <Link to="/mis-reservas" aria-current={location.pathname === "/mis-reservas" ? "page" : undefined}>Mis reservas</Link>
          <span>{usuario.nombre || usuario.nombre_usuario}</span>
          <button type="button" onClick={cerrar}>Salir</button>
        </div>
      </div>
    </header>
    {errorSesion && <p className="error" role="alert">{errorSesion}</p>}
    <Routes>
      <Route path="/agenda" element={<Agenda usuario={usuario} />} />
      <Route path="/agenda/nueva-reserva" element={<NuevaReserva usuario={usuario} />} />
      <Route path="/mis-reservas" element={<MisReservas />} />
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  </>
}

createRoot(document.querySelector('#root')).render(<BrowserRouter><App /></BrowserRouter>)

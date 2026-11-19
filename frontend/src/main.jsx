import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './api.js'
import { NuevaReserva } from './NuevaReserva.jsx'
import { Perfil } from "./Perfil.jsx"
import { Registro } from './Registro.jsx'
import './tema.css'

const Agenda = lazy(() => import('./Agenda.jsx'))
const Usuarios = lazy(() => import('./Usuarios.jsx'))
const Instalaciones = lazy(() => import('./Instalaciones.jsx'))
const Notificaciones = lazy(() => import('./Notificaciones.jsx'))
const MisReservas = lazy(() => import('./MisReservas.jsx'))
const NavegacionAdmin = lazy(() => import('./NavegacionAdmin.jsx'))

function Marca() {
  return <span className="marca"><img src="/logo.png" alt="" />Academia TM</span>
}

function MarcoAcceso({ children, registro = false }) {
  return <main className="acceso">
    <header><Marca /></header>
    <div className={registro ? 'acceso-contenido acceso-registro' : 'acceso-contenido'}>
      <section className="portada">
        <h1>Tu próximo encuentro<br /> te está esperando<span>.</span></h1>
        <p>Consultá la agenda y reservá tu cancha.</p>
      </section>
      {children}
    </div>
  </main>
}

function Acceso({ iniciar, errorSesion }) {
  const location = useLocation()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting: ocupado } } = useForm()

  async function enviar(datos) {
    setError('')
    try {
      await iniciar(datos)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  return <MarcoAcceso>
      <form className="tarjeta acceso-form" onSubmit={handleSubmit(enviar)}>
        <h2>Iniciar sesión</h2>
        <label>Usuario<input required {...register('nombre_usuario')} autoComplete="username"
          defaultValue={location.state?.nombreUsuario || ""} /></label>
        <label>Contraseña<input required {...register('contrasena')} type="password" autoComplete="current-password" /></label>
        {(error || errorSesion) && <p className="error" role="alert">{error || errorSesion}</p>}
        <button className="primario" disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Ingresar'}</button>
        <Link className="enlace-acceso" to="/registro"
          state={{ volver: location.pathname + location.search }}>Crear una cuenta</Link>
      </form>
  </MarcoAcceso>
}

function App() {
  const [usuario, setUsuario] = useState(undefined)
  const [errorSesion, setErrorSesion] = useState('')
  const [sinLeer, setSinLeer] = useState(0)
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

  const usuarioId = usuario?.id
  const ruta = location.pathname
  const busquedaAgenda = useRef('')
  const enAgenda = ruta === '/agenda' || ruta === '/agenda/nueva-reserva'

  useEffect(() => {
    if (enAgenda) busquedaAgenda.current = location.search
  }, [enAgenda, location.search])

  useEffect(() => {
    if (!usuarioId || ruta === '/notificaciones') return
    const control = new AbortController()
    api('notificaciones/', { signal: control.signal })
      .then(datos => { if (!control.signal.aborted) setSinLeer(datos.sin_leer) })
      .catch(() => {})
    return () => control.abort()
  }, [usuarioId, ruta])

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
      setSinLeer(0)
    } catch (error) {
      setErrorSesion(error.message)
    }
  }

  function actualizarCuenta(cuenta, accion) {
    if (cuenta.id !== usuario.id) return
    if (accion === 'contrasena') {
      setUsuario(null)
      setSinLeer(0)
    } else {
      setUsuario(cuenta)
    }
  }

  if (usuario === undefined) return <main className="espera" role="status">Cargando sesión…</main>
  if (!usuario) return ruta === '/registro'
    ? <MarcoAcceso registro><Registro /></MarcoAcceso>
    : <Acceso iniciar={iniciar} errorSesion={errorSesion} />

  const agenda = '/agenda' + (enAgenda ? location.search : busquedaAgenda.current)
  const contenido = <>
    {errorSesion && <p className="error" role="alert">{errorSesion}</p>}
    <Routes>
      <Route path="/agenda" element={<Suspense fallback={<main className="espera" role="status">Cargando agenda…</main>}>
        <Agenda usuario={usuario} />
      </Suspense>} />
      <Route path="/agenda/nueva-reserva" element={<NuevaReserva usuario={usuario} />} />
      <Route path="/mis-reservas" element={<Suspense fallback={<main className="espera" role="status">Cargando reservas…</main>}>
        <MisReservas />
      </Suspense>} />
      <Route path="/notificaciones" element={<Suspense fallback={<main className="espera" role="status">Cargando notificaciones…</main>}>
        <Notificaciones alCargar={setSinLeer} />
      </Suspense>} />
      <Route path="/perfil" element={<Perfil usuario={usuario} alGuardar={setUsuario} />} />
      {usuario.es_administrador && <Route path="/usuarios"
        element={<Suspense fallback={<main className="espera" role="status">Cargando usuarios…</main>}>
          <Usuarios alGuardar={actualizarCuenta} />
        </Suspense>} />}
      {usuario.es_administrador && <Route path="/instalaciones" element={<Suspense fallback={<main className="espera" role="status">Cargando instalaciones…</main>}>
        <Instalaciones />
      </Suspense>} />}
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  </>

  if (usuario.es_administrador) {
    return <Suspense fallback={<main className="espera" role="status">Cargando administración…</main>}>
      <NavegacionAdmin agenda={agenda} usuario={usuario} sinLeer={sinLeer} cerrar={cerrar}>
        {contenido}
      </NavegacionAdmin>
    </Suspense>
  }

  return <>
    <header className="barra">
      <div className="barra-contenido">
        <Link to={agenda} aria-label="Academia TM, agenda"><Marca /></Link>
        <div className="barra-cuenta">
          <Link to="/mis-reservas" aria-current={location.pathname === "/mis-reservas" ? "page" : undefined}>Mis reservas</Link>
          <Link to="/notificaciones" aria-current={ruta === '/notificaciones' ? 'page' : undefined}>
            Notificaciones{sinLeer > 0 && <span className="contador-avisos" aria-label={`${sinLeer} sin leer`}>{sinLeer}</span>}
          </Link>
          <Link to="/perfil" aria-current={location.pathname === "/perfil" ? "page" : undefined}>Perfil</Link>
          <span>{usuario.nombre || usuario.nombre_usuario}</span>
          <button type="button" onClick={cerrar}>Salir</button>
        </div>
      </div>
    </header>
    {contenido}
  </>
}

createRoot(document.querySelector('#root')).render(<BrowserRouter><App /></BrowserRouter>)

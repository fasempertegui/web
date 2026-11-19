import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/dm-sans'
import { api } from './api.js'
import './tema.css'

const Agenda = lazy(() => import('./Agenda.jsx'))
const NuevaReserva = lazy(() => import('./NuevaReserva.jsx'))
const MisReservas = lazy(() => import('./MisReservas.jsx'))
const Notificaciones = lazy(() => import('./Notificaciones.jsx'))
const Perfil = lazy(() => import('./Perfil.jsx'))
const Usuarios = lazy(() => import('./Usuarios.jsx'))
const Instalaciones = lazy(() => import('./Instalaciones.jsx'))
const Registro = lazy(() => import('./Registro.jsx'))
const NavegacionAdmin = lazy(() => import('./NavegacionAdmin.jsx'))
const NavegacionUsuario = lazy(() => import('./NavegacionUsuario.jsx'))

function VistaDiferida({ mensaje, inline = false, children }) {
  const espera = inline
    ? <p className="espera" role="status">{mensaje}</p>
    : <main className="espera" role="status">{mensaje}</main>
  return <Suspense fallback={espera}>{children}</Suspense>
}

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
    ? <MarcoAcceso registro>
      <VistaDiferida mensaje="Cargando registro…" inline><Registro /></VistaDiferida>
    </MarcoAcceso>
    : <Acceso iniciar={iniciar} errorSesion={errorSesion} />

  const agenda = '/agenda' + (enAgenda ? location.search : busquedaAgenda.current)
  const contenido = <>
    {errorSesion && <p className="error" role="alert">{errorSesion}</p>}
    <Routes>
      <Route path="/agenda" element={<VistaDiferida mensaje="Cargando agenda…">
        <Agenda usuario={usuario} />
      </VistaDiferida>} />
      <Route path="/agenda/nueva-reserva" element={<VistaDiferida mensaje="Cargando reserva…">
        <NuevaReserva usuario={usuario} />
      </VistaDiferida>} />
      <Route path="/mis-reservas" element={<VistaDiferida mensaje="Cargando reservas…">
        <MisReservas />
      </VistaDiferida>} />
      <Route path="/notificaciones" element={<VistaDiferida mensaje="Cargando notificaciones…">
        <Notificaciones alCargar={setSinLeer} />
      </VistaDiferida>} />
      <Route path="/perfil" element={<VistaDiferida mensaje="Cargando perfil…">
        <Perfil usuario={usuario} alGuardar={setUsuario} />
      </VistaDiferida>} />
      {usuario.es_administrador && <Route path="/usuarios" element={<VistaDiferida mensaje="Cargando usuarios…">
        <Usuarios alGuardar={actualizarCuenta} />
      </VistaDiferida>} />}
      {usuario.es_administrador && <Route path="/instalaciones" element={<VistaDiferida mensaje="Cargando instalaciones…">
        <Instalaciones />
      </VistaDiferida>} />}
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  </>

  if (usuario.es_administrador) {
    return <VistaDiferida mensaje="Cargando administración…">
      <NavegacionAdmin agenda={agenda} usuario={usuario} sinLeer={sinLeer} cerrar={cerrar}>
        {contenido}
      </NavegacionAdmin>
    </VistaDiferida>
  }

  return <VistaDiferida mensaje="Cargando el portal…">
    <NavegacionUsuario agenda={agenda} usuario={usuario} sinLeer={sinLeer} cerrar={cerrar} />
    {contenido}
  </VistaDiferida>
}

createRoot(document.querySelector('#root')).render(<BrowserRouter><App /></BrowserRouter>)

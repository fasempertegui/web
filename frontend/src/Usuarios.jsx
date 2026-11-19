import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, KeyRound, Mail, Search, UserRound, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from './api.js'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/dm-sans'
import './usuarios.css'

function nombreCompleto(usuario) {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.nombre_usuario
}

function InicialesUsuario({ usuario, grande = false }) {
  const nombres = [usuario.nombre, usuario.apellido].filter(Boolean)
  const iniciales = (nombres.length ? nombres.map(parte => parte[0]).join('') : usuario.nombre_usuario.slice(0, 2))
    .toLocaleUpperCase('es-AR')

  return <Avatar aria-hidden="true" className={grande ? 'size-12 shrink-0 rounded-xl' : 'size-9 shrink-0 rounded-lg'}>
    <AvatarFallback className={`rounded-[inherit] text-sm font-semibold text-primary ${grande ? 'bg-white' : 'bg-secondary'}`}>{iniciales}</AvatarFallback>
  </Avatar>
}

function DetalleUsuario({ cuenta, movil, cerrar, recuperarFoco, alGuardar }) {
  const [accion, setAccion] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const { register, handleSubmit, formState: { isSubmitting: guardando } } = useForm({ shouldUnregister: true })

  function cambiarAccion(nueva) {
    setAccion(nueva)
    setError('')
    setMensaje('')
  }

  async function guardar(datos) {
    setError('')
    if (accion === 'contrasena' && datos.contrasena !== datos.confirmar_contrasena) {
      setError('Las contraseñas no coinciden.')
      return
    }

    try {
      const { usuario } = await api(`usuarios/${cuenta.id}/${accion}/`, { datos })
      alGuardar(usuario, accion)
      setMensaje(accion === 'correo' ? 'Correo actualizado.' : 'Contraseña restablecida.')
      setAccion(null)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  const contenido = <>
    <div className="usuarios-resumen">
      <InicialesUsuario usuario={cuenta} grande />
      <div className="min-w-0 flex-1">
        <h2 className="usuarios-titulo m-0 text-xl font-semibold wrap-anywhere">{nombreCompleto(cuenta)}</h2>
        <Badge variant="outline" className="mt-1 border-border bg-card text-primary">
          {cuenta.es_administrador ? 'Administrador' : 'Usuario'}
        </Badge>
      </div>
      {!movil && <Button type="button" variant="ghost" size="icon"
        className="size-8 min-h-0 shrink-0 border-0 bg-transparent text-primary" aria-label="Cerrar detalle"
        disabled={guardando} onClick={cerrar}><X aria-hidden="true" /></Button>}
    </div>

    <dl className="usuarios-datos">
      <div><dt>Nombre de usuario</dt><dd>{cuenta.nombre_usuario}</dd></div>
      <div><dt>Correo electrónico</dt><dd>{cuenta.email || 'Sin correo'}</dd></div>
    </dl>

    {mensaje && <p className="usuarios-confirmacion" role="status"><CheckCircle2 aria-hidden="true" />{mensaje}</p>}
    {accion === null ? <div className="mt-4 grid gap-2">
      <Button type="button" variant="outline" className="min-h-11 border-border bg-card text-primary"
        onClick={() => cambiarAccion('correo')}><Mail aria-hidden="true" />Cambiar correo</Button>
      <Button type="button" variant="outline" className="min-h-11 border-border bg-card text-primary"
        onClick={() => cambiarAccion('contrasena')}><KeyRound aria-hidden="true" />Restablecer contraseña</Button>
    </div> : <form key={accion} onSubmit={handleSubmit(guardar)} className="mt-4 grid gap-3">
      {accion === 'correo' ? <div className="grid gap-2">
        <Label htmlFor="usuario-nuevo-correo">Nuevo correo</Label>
        <Input id="usuario-nuevo-correo" {...register('email')} type="email" defaultValue={cuenta.email}
          required maxLength={254} disabled={guardando} />
      </div> : <>
        <div className="grid gap-2">
          <Label htmlFor="usuario-contrasena">Nueva contraseña</Label>
          <Input id="usuario-contrasena" {...register('contrasena')} type="password"
            required autoComplete="new-password" disabled={guardando} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="usuario-confirmar-contrasena">Confirmar contraseña</Label>
          <Input id="usuario-confirmar-contrasena" {...register('confirmar_contrasena')} type="password"
            required autoComplete="new-password" disabled={guardando} />
        </div>
      </>}
      {error && <p className="error m-0" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="border-border" disabled={guardando}
          onClick={() => cambiarAccion(null)}>Volver</Button>
        <Button disabled={guardando}>
          {guardando ? 'Guardando…' : accion === 'correo' ? 'Guardar correo' : 'Confirmar restablecimiento'}
        </Button>
      </div>
    </form>}
  </>

  return movil ? <Sheet open onOpenChange={abierto => { if (!abierto && !guardando) cerrar() }}>
    <SheetContent side="bottom" showCloseButton={!guardando}
      className="usuarios-sheet max-h-[85svh] gap-0 overflow-y-auto rounded-t-xl bg-card"
      onCloseAutoFocus={evento => { evento.preventDefault(); recuperarFoco() }}>
      <SheetHeader className="sr-only">
        <SheetTitle>Detalle de la cuenta</SheetTitle>
        <SheetDescription>Datos y acciones para la cuenta seleccionada.</SheetDescription>
      </SheetHeader>
      <div className="px-4 pt-12 pb-5">{contenido}</div>
    </SheetContent>
  </Sheet> : <Card role="complementary" aria-label="Detalle de la cuenta"
    className="usuarios-panel gap-0 rounded-2xl border-border py-0 shadow-none">
    <CardContent className="p-4">{contenido}</CardContent>
  </Card>
}

export default function Usuarios({ alGuardar }) {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)
  const [seleccion, setSeleccion] = useState(null)
  const disparador = useRef(null)
  const movil = useIsMobile(1024)
  const busqueda = texto.trim()
  const activa = resultado?.busqueda === busqueda ? resultado : null
  const cuenta = activa?.usuarios?.find(usuario => usuario.id === seleccion)
  const tieneResultados = activa?.usuarios?.length > 0

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

  function recuperarFoco() {
    if (disparador.current?.isConnected) disparador.current.focus()
  }

  function cerrarDetalle() {
    setSeleccion(null)
    if (!movil) recuperarFoco()
  }

  function actualizar(usuario, accion) {
    setResultado(actual => actual?.usuarios ? {
      ...actual,
      usuarios: actual.usuarios.map(item => item.id === usuario.id ? usuario : item),
    } : actual)
    alGuardar(usuario, accion)
  }

  return <main className="usuarios-superficie w-full flex-1">
    <div className="contenido-pagina">
      <header className="mb-5">
        <h1 className="usuarios-titulo m-0 text-4xl leading-none font-semibold sm:text-5xl">Usuarios</h1>
      </header>

      <div className={!movil && tieneResultados ? 'usuarios-vista usuarios-escritorio' : 'usuarios-vista'}>
        <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl border-border py-0 shadow-none">
          <div className="grid gap-2 border-b border-border px-4 py-4 sm:px-5">
            <Label htmlFor="buscar-usuario">Buscar cuenta</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true" />
              <Input id="buscar-usuario" type="search" value={texto} className="h-11 bg-card pl-9"
                placeholder="Nombre, usuario o correo" onChange={evento => {
                  setTexto(evento.target.value)
                  setSeleccion(null)
                  if (evento.target.value.trim() !== busqueda) setResultado(null)
                }} />
            </div>
          </div>
          {busqueda.length < 2 && <p className="m-0 px-4 py-6 text-sm text-muted-foreground sm:px-5">Ingresá al menos dos caracteres.</p>}
          {busqueda.length >= 2 && !activa && <div className="grid gap-3 p-4 sm:p-5" role="status" aria-label="Buscando usuarios">
            <Skeleton className="h-10 w-full rounded-lg" /><Skeleton className="h-10 w-full rounded-lg" />
          </div>}
          {activa?.error && <p className="error mx-4 my-4 sm:mx-5" role="alert">{activa.error}</p>}
          {activa?.usuarios?.length === 0 && <p className="m-0 px-4 py-6 text-sm text-muted-foreground sm:px-5">No encontramos usuarios.</p>}
          {tieneResultados && <ul className="m-0 list-none divide-y divide-border p-0">
            {activa.usuarios.map(usuario => <li key={usuario.id}>
              <button type="button" className="usuarios-fila" aria-pressed={seleccion === usuario.id}
                onClick={evento => {
                  disparador.current = evento.currentTarget
                  setSeleccion(seleccion === usuario.id ? null : usuario.id)
                }}>
                <InicialesUsuario usuario={usuario} />
                <span className="min-w-0">
                  <strong className="block wrap-anywhere">{nombreCompleto(usuario)}</strong>
                  <small className="block text-muted-foreground wrap-anywhere">{usuario.nombre_usuario}</small>
                </span>
                <span className="usuarios-correo text-sm text-muted-foreground wrap-anywhere">{usuario.email}</span>
                {usuario.es_administrador ? <Badge variant="outline" className="usuarios-rol border-border bg-secondary text-primary">Admin</Badge>
                  : <span className="usuarios-rol" />}
                <ChevronRight className="usuarios-flecha size-4 text-primary/65" aria-hidden="true" />
              </button>
            </li>)}
          </ul>}
        </Card>

        {cuenta ? <DetalleUsuario key={cuenta.id} cuenta={cuenta} movil={movil} cerrar={cerrarDetalle}
          recuperarFoco={recuperarFoco} alGuardar={actualizar} /> : !movil && tieneResultados &&
          <Card className="usuarios-panel gap-2 rounded-2xl border-border p-4 shadow-none" aria-label="Detalle de la cuenta">
            <span className="usuarios-icono"><UserRound aria-hidden="true" /></span>
            <h2 className="usuarios-titulo m-0 text-lg">Elegí una cuenta</h2>
            <p className="m-0 text-sm text-muted-foreground">Seleccioná un usuario de la lista para ver sus datos.</p>
          </Card>}
      </div>
    </div>
  </main>
}

import React, { useState } from 'react'
import { AtSign, CalendarDays, CheckCircle2, Mail, Pencil, Phone } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { useConsulta } from '@/hooks/use-consulta'
import { api } from './api.js'
import { hoy, labelFecha } from './fechas.js'
import { inicialesUsuario, nombreCompleto } from './usuarios.js'
import './perfil.css'

function DatoPerfil({ icono: Icono, etiqueta, valor }) {
  return <div className="flex min-w-0 items-start gap-3 py-3.5">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
      <Icono aria-hidden="true" className="size-4" />
    </span>
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className="m-0 font-medium wrap-anywhere">{valor || 'Sin cargar'}</dd>
    </div>
  </div>
}

export default function Perfil({ usuario, alGuardar }) {
  const [editando, setEditando] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting: guardando } } = useForm()
  const [errorEdicion, setErrorEdicion] = useState('')
  const [guardado, setGuardado] = useState(false)
  const { error: errorConsulta, cargando } = useConsulta('perfil/', {
    alExito: datos => alGuardar(datos.usuario),
  })

  const nombre = nombreCompleto(usuario)
  const iniciales = inicialesUsuario(usuario)

  function cambiarEdicion(abierta) {
    if (guardando) return
    if (abierta) {
      reset({
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        celular_contacto: usuario.celular_contacto,
        fecha_nacimiento: usuario.fecha_nacimiento || '',
      })
      setGuardado(false)
    }
    setErrorEdicion('')
    setEditando(abierta)
  }

  async function guardar(datos) {
    setErrorEdicion('')
    try {
      const perfil = await api('perfil/', { datos, metodo: 'PUT' })
      alGuardar(perfil.usuario)
      setEditando(false)
      setGuardado(true)
    } catch (fallo) {
      setErrorEdicion(fallo.message)
    }
  }

  return <main className="perfil-superficie w-full flex-1">
    <div className="contenido-pagina">
      <header className="mb-6">
        <h1 className="perfil-titulo m-0 text-4xl leading-none font-semibold sm:text-5xl">Mi perfil</h1>
      </header>

      {guardado && <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900"
        role="status"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />Perfil actualizado.</p>}
      {errorConsulta && !editando && <p className="error" role="alert">{errorConsulta}</p>}

      <Sheet open={editando} onOpenChange={cambiarEdicion}>
        <div className="grid gap-4 md:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
          <Card className="perfil-identidad relative isolate min-w-0 justify-between overflow-hidden rounded-2xl border-0 p-6 text-white shadow-none sm:p-8">
            <div className="relative">
              <Avatar className="mb-5 size-16 rounded-2xl border border-white/25 sm:size-20">
                <AvatarFallback className="perfil-titulo rounded-[inherit] bg-white/15 text-2xl font-semibold text-white sm:text-3xl">
                  {iniciales}
                </AvatarFallback>
              </Avatar>
              <h2 className="perfil-titulo m-0 text-3xl leading-tight font-semibold wrap-anywhere sm:text-4xl">{nombre}</h2>
              <Badge className="mt-3 border-white/25 bg-white/10 px-2.5 text-white">
                {usuario.es_administrador ? 'Administrador' : 'Usuario'}
              </Badge>
            </div>
            <SheetTrigger asChild>
              <Button type="button" disabled={cargando}
                className="relative mt-4 h-10 w-fit border-0 bg-white px-4 text-sidebar hover:bg-secondary hover:text-sidebar">
                <Pencil aria-hidden="true" />Editar perfil
              </Button>
            </SheetTrigger>
          </Card>

          <Card className="min-w-0 gap-0 rounded-2xl border-border bg-card py-5 shadow-none">
            <CardHeader className="px-5 sm:px-6">
              <CardTitle><h2 className="perfil-titulo m-0 text-xl font-semibold">Datos de la cuenta</h2></CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2 sm:px-6">
              <dl className="m-0 divide-y divide-border">
                <DatoPerfil icono={AtSign} etiqueta="Nombre de usuario" valor={usuario.nombre_usuario} />
                <DatoPerfil icono={Mail} etiqueta="Correo electrónico" valor={usuario.email} />
                <DatoPerfil icono={Phone} etiqueta="Celular" valor={usuario.celular_contacto} />
                <DatoPerfil icono={CalendarDays} etiqueta="Fecha de nacimiento"
                  valor={usuario.fecha_nacimiento ? labelFecha(usuario.fecha_nacimiento) : ''} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <SheetContent side="right" showCloseButton={!guardando}
          className="perfil-edicion w-full gap-0 overflow-y-auto bg-card sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-5 sm:px-6">
            <SheetTitle className="perfil-titulo text-2xl">Editar perfil</SheetTitle>
            <SheetDescription>Actualizá tu nombre, celular y fecha de nacimiento.</SheetDescription>
          </SheetHeader>

          <form className="flex flex-1 flex-col" onSubmit={handleSubmit(guardar)}>
            <fieldset className="m-0 grid min-w-0 gap-5 border-0 px-5 py-6 sm:px-6" disabled={guardando}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="perfil-nombre">Nombre</Label>
                  <Input id="perfil-nombre" {...register('nombre')} required maxLength={100} autoComplete="given-name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="perfil-apellido">Apellido</Label>
                  <Input id="perfil-apellido" {...register('apellido')} required maxLength={100} autoComplete="family-name" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="perfil-celular">Celular</Label>
                <Input id="perfil-celular" {...register('celular_contacto')} type="tel" required maxLength={30} autoComplete="tel" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="perfil-nacimiento">Fecha de nacimiento</Label>
                <Input id="perfil-nacimiento" {...register('fecha_nacimiento')} type="date" required max={hoy()} autoComplete="bday" />
              </div>
            </fieldset>
            {errorEdicion && <p className="error mx-5 sm:mx-6" role="alert">{errorEdicion}</p>}
            <SheetFooter className="border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <SheetClose asChild>
                <Button type="button" variant="outline" disabled={guardando}>Cancelar</Button>
              </SheetClose>
              <Button disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  </main>
}

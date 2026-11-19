import React, { useEffect, useRef, useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronRight, CircleDollarSign, MapPin, Pencil, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from './api.js'
import { importe } from './fechas.js'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/dm-sans'
import './instalaciones.css'

const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const superficies = { cemento: 'Cemento', polvo_ladrillo: 'Polvo de ladrillo' }
const horas = Array.from({ length: 24 }, (_, hora) => String(hora).padStart(2, '0') + ':00')

function CampoHora({ nombre, etiqueta, valor, requerido, register }) {
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={nombre}>{etiqueta}</Label>
    <NativeSelect id={nombre} className="w-full" {...register(nombre)} defaultValue={valor || ''} required={requerido}>
      <option value="">Elegí una hora</option>
      {horas.map(hora => <option key={hora}>{hora}</option>)}
    </NativeSelect>
  </div>
}

function EditorInstalacion({ accion, sede, cerrar, guardar, recuperarFoco }) {
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting: guardando } } = useForm({ shouldUnregister: true })
  const [cerrado, marcarCerrado] = useState(false)
  const horario = sede?.horarios.find(item => item.dia_semana === accion.dia)
  const titulos = {
    sede: 'Nueva sede',
    cancha: 'Nueva cancha',
    precio: 'Editar tarifa',
    horario: 'Horario del ' + dias[accion.dia - 1]?.toLowerCase(),
  }

  async function enviar(datos) {
    let ruta = 'instalaciones/'
    if (accion.tipo === 'cancha') ruta += `${sede.id}/canchas/`
    if (accion.tipo === 'precio') ruta += `${sede.id}/precio/`
    if (accion.tipo === 'horario') ruta += `${sede.id}/horarios/${accion.dia}/`
    const metodo = cerrado ? 'DELETE' : (accion.tipo === 'precio' || accion.tipo === 'horario') ? 'PUT' : 'POST'
    setError('')
    try {
      const respuesta = await api(ruta, { metodo, datos: cerrado ? undefined : datos })
      guardar(respuesta.sede)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  return <Sheet open onOpenChange={abierta => { if (!abierta && !guardando) cerrar() }}>
    <SheetContent side="right" showCloseButton={!guardando}
      className="instalaciones-editor w-full gap-0 overflow-y-auto bg-card sm:max-w-md"
      onCloseAutoFocus={evento => { evento.preventDefault(); recuperarFoco() }}>
      <SheetHeader className="border-b border-border px-5 py-5 sm:px-6">
        <SheetTitle className="instalaciones-titulo text-2xl">{titulos[accion.tipo]}</SheetTitle>
        <SheetDescription>{accion.tipo === 'sede' ? 'Ingresá el nombre y la dirección de la sede.' : sede.nombre}</SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit(enviar)} className="flex flex-1 flex-col">
        <fieldset className="m-0 grid min-w-0 gap-5 border-0 px-5 py-6 sm:px-6" disabled={guardando}>
          {['sede', 'cancha'].includes(accion.tipo) && <div className="grid gap-2">
            <Label htmlFor="instalacion-nombre">Nombre</Label>
            <Input id="instalacion-nombre" {...register('nombre')} required maxLength={120} />
          </div>}
          {accion.tipo === 'sede' && <div className="grid gap-2">
            <Label htmlFor="instalacion-direccion">Dirección</Label>
            <Input id="instalacion-direccion" {...register('direccion')} required maxLength={250} />
          </div>}
          {accion.tipo === 'cancha' && <div className="grid gap-2">
            <Label htmlFor="instalacion-superficie">Superficie</Label>
            <NativeSelect id="instalacion-superficie" className="w-full" {...register('superficie')} required defaultValue="">
              <option value="" disabled>Elegí una superficie</option>
              {Object.entries(superficies).map(([valor, etiqueta]) =>
                <option key={valor} value={valor}>{etiqueta}</option>
              )}
            </NativeSelect>
          </div>}
          {accion.tipo === 'precio' && <div className="grid gap-2">
            <Label htmlFor="instalacion-tarifa">Precio por turno (ARS)</Label>
            <Input id="instalacion-tarifa" {...register('precio_reserva_vigente')} type="number" min="0.01" step="0.01"
              max="9999999999.99" defaultValue={sede.precio_reserva_vigente || ''} />
          </div>}
          {accion.tipo === 'horario' && <>
            {horario && <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary px-3 py-2.5">
              <Checkbox id="instalacion-cerrado" className="min-h-0 p-0" checked={cerrado} disabled={guardando}
                onCheckedChange={valor => marcarCerrado(valor === true)} />
              <Label htmlFor="instalacion-cerrado">Marcar el día como cerrado</Label>
            </div>}
            {!cerrado && [1, 2].map(franja => <fieldset key={franja} className="m-0 min-w-0 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold text-foreground">
                {franja === 1 ? 'Primera franja' : 'Segunda franja (opcional)'}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <CampoHora register={register} nombre={`hora_inicio_${franja}`} etiqueta="Desde"
                  valor={horario?.[`hora_inicio_${franja}`]} requerido={franja === 1} />
                <CampoHora register={register} nombre={`hora_fin_${franja}`} etiqueta="Hasta"
                  valor={horario?.[`hora_fin_${franja}`]} requerido={franja === 1} />
              </div>
            </fieldset>)}
          </>}
        </fieldset>
        {error && <p className="error mx-5 sm:mx-6" role="alert">{error}</p>}
        <SheetFooter className="border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="border-border" disabled={guardando}>Volver</Button>
          </SheetClose>
          <Button disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>
}

function HorariosSede({ horarios, editar }) {
  return <Card className="gap-0 overflow-hidden rounded-2xl border-border py-0 shadow-none">
    <CardHeader className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
      <span className="instalaciones-icono"><CalendarClock aria-hidden="true" /></span>
      <h2 className="instalaciones-titulo m-0 text-xl font-semibold">Horarios de atención</h2>
    </CardHeader>
    <ul className="m-0 list-none divide-y divide-border p-0">
      {dias.map((dia, indice) => {
        const numero = indice + 1
        const horario = horarios.find(item => item.dia_semana === numero)
        return <li key={dia}>
          <button type="button" className="instalaciones-horario"
            aria-label={`Editar horario del ${dia.toLowerCase()}`}
            onClick={evento => editar({ tipo: 'horario', dia: numero }, evento.currentTarget)}>
            <span className="font-semibold">{dia}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {horario ? <>
                <Badge variant="outline" className="border-border bg-secondary text-primary tabular-nums">
                  {horario.hora_inicio_1} – {horario.hora_fin_1}
                </Badge>
                {horario.hora_inicio_2 && <Badge variant="outline" className="border-border bg-secondary text-primary tabular-nums">
                  {horario.hora_inicio_2} – {horario.hora_fin_2}
                </Badge>}
              </> : <span className="text-sm text-muted-foreground">Cerrado</span>}
            </span>
            <ChevronRight className="size-4 text-primary/65" aria-hidden="true" />
          </button>
        </li>
      })}
    </ul>
  </Card>
}

export default function Instalaciones() {
  const [sedes, setSedes] = useState(null)
  const [seleccion, seleccionar] = useState(null)
  const [accion, setAccion] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const disparador = useRef(null)
  const sede = sedes?.find(item => item.id === seleccion) || sedes?.[0]

  useEffect(() => {
    const control = new AbortController()
    api('instalaciones/', { signal: control.signal })
      .then(datos => { if (!control.signal.aborted) setSedes(datos.sedes) })
      .catch(fallo => { if (fallo.name !== 'AbortError') setError(fallo.message) })
    return () => control.abort()
  }, [])

  function abrir(nueva, boton) {
    disparador.current = boton
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

  return <main className="instalaciones-superficie w-full flex-1">
    <div className="contenido-pagina">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="instalaciones-titulo m-0 text-4xl leading-none font-semibold sm:text-5xl">Instalaciones</h1>
        {sedes && <Button type="button" className="h-10"
          onClick={evento => abrir({ tipo: 'sede' }, evento.currentTarget)}><Plus aria-hidden="true" />Nueva sede</Button>}
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="instalaciones-confirmacion" role="status"><CheckCircle2 aria-hidden="true" />{mensaje}</p>}
      {!sedes && !error && <Skeleton className="h-40 rounded-2xl" role="status" aria-label="Cargando instalaciones" />}
      {sedes?.length === 0 && <Card className="gap-3 rounded-2xl border-border p-6 shadow-none">
        <span className="instalaciones-icono"><MapPin aria-hidden="true" /></span>
        <h2 className="instalaciones-titulo m-0 text-xl">Todavía no hay sedes</h2>
      </Card>}

      {sede && <>
        <Card className="instalaciones-sede mb-4 flex-row flex-wrap items-end justify-between gap-4 rounded-2xl border-0 px-5 py-5 text-white shadow-none sm:px-6">
          <div className="min-w-0">
            <h2 className="instalaciones-titulo m-0 text-2xl font-semibold wrap-anywhere sm:text-3xl">{sede.nombre}</h2>
            {sede.direccion && <p className="m-0 mt-1.5 flex items-start gap-1.5 text-sm text-white/85">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{sede.direccion}
            </p>}
          </div>
          <div className="grid min-w-44 gap-2">
            <Label htmlFor="instalacion-sede" className="text-white/90">Sede</Label>
            <Select value={String(sede.id)} onValueChange={valor => { seleccionar(Number(valor)); setMensaje('') }}>
              <SelectTrigger id="instalacion-sede" className="w-full border-white bg-white text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>{sedes.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </Card>

        <div className="instalaciones-grid">
          <div className="grid min-w-0 gap-4">
            <Card className="gap-0 rounded-2xl border-border py-0 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="instalaciones-icono"><CircleDollarSign aria-hidden="true" /></span>
                  <div>
                    <h2 className="m-0 text-sm font-medium text-muted-foreground">Tarifa por turno</h2>
                    <p className="m-0 font-semibold tabular-nums">{sede.precio_reserva_vigente
                      ? importe(sede.precio_reserva_vigente) : 'Sin tarifa configurada'}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" className="border-border"
                  onClick={evento => abrir({ tipo: 'precio' }, evento.currentTarget)}><Pencil aria-hidden="true" />Editar tarifa</Button>
              </CardContent>
            </Card>
            <Card className="gap-0 overflow-hidden rounded-2xl border-border py-0 shadow-none">
              <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <h2 className="instalaciones-titulo m-0 text-xl font-semibold">Canchas</h2>
                <Button type="button" variant="outline" className="border-border"
                  onClick={evento => abrir({ tipo: 'cancha' }, evento.currentTarget)}><Plus aria-hidden="true" />Nueva cancha</Button>
              </CardHeader>
              {sede.canchas.length ? <ul className="m-0 list-none divide-y divide-border p-0">
                {sede.canchas.map(cancha => <li key={cancha.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
                  <strong className="font-semibold">{cancha.nombre}</strong>
                  <Badge variant="outline" className="border-border bg-secondary text-primary">{superficies[cancha.superficie]}</Badge>
                </li>)}
              </ul> : <p className="m-0 px-4 py-5 text-sm text-muted-foreground sm:px-5">Todavía no hay canchas.</p>}
            </Card>
          </div>
          <HorariosSede horarios={sede.horarios} editar={abrir} />
        </div>
      </>}

      {accion && <EditorInstalacion key={`${sede?.id}:${accion.tipo}:${accion.dia}`}
        accion={accion} sede={sede} cerrar={() => setAccion(null)} guardar={guardar}
        recuperarFoco={() => { if (disparador.current?.isConnected) disparador.current.focus() }} />}
    </div>
  </main>
}

import React, { useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, Clock, MapPin, Plus, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { PanelDetalle } from '@/components/PanelDetalle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useConsulta } from '@/hooks/use-consulta'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from './api.js'
import { horaActual, hoy, importe, labelFecha, labelMesCorto } from './fechas.js'
import './mis-reservas.css'

const estados = {
  programado: 'Programada',
  anulado: 'Cancelada',
  finalizado: 'Finalizada',
}

function EstadoReserva({ estado }) {
  return <Badge variant="outline" data-estado={estado}
    className="mis-reservas-estado border-(--reserva-borde) bg-(--reserva-fondo) text-(--reserva-texto)">
    {estados[estado]}
  </Badge>
}

function ListaReservas({ reservas, seleccion, seleccionar, guardando, mensajeVacio }) {
  if (reservas.length === 0) return <p className="m-0 px-4 py-8 text-sm text-muted-foreground sm:px-5">{mensajeVacio}</p>

  return <ul className="m-0 list-none divide-y divide-border p-0">
    {reservas.map(reserva => <li key={reserva.id}>
      <button type="button" className="mis-reservas-fila" aria-pressed={seleccion === reserva.id}
        disabled={guardando} onClick={evento => seleccionar(reserva.id, evento.currentTarget)}>
        <time className="mis-reservas-fecha" dateTime={reserva.fecha} aria-label={labelFecha(reserva.fecha)}>
          <strong>{reserva.fecha.slice(-2)}</strong>
          <small>{labelMesCorto(reserva.fecha)}</small>
        </time>
        <span className="mis-reservas-cancha">
          <strong>{reserva.cancha}</strong>
          <span>{reserva.sede}</span>
        </span>
        <span className="mis-reservas-hora">{reserva.hora_inicio} – {reserva.hora_fin}</span>
        <EstadoReserva estado={reserva.estado} />
        <ChevronRight className="mis-reservas-flecha" aria-hidden="true" />
      </button>
    </li>)}
  </ul>
}

export default function MisReservas() {
  const { datos, error: errorConsulta, cargando, setDatos } = useConsulta('reservas/')
  const [errorCancelacion, setErrorCancelacion] = useState('')
  const [params, setParams] = useSearchParams()
  const seleccion = Number(params.get('reserva')) || null
  const [cancelando, setCancelando] = useState(false)
  const { register, handleSubmit, formState: { isSubmitting: guardando } } = useForm({ shouldUnregister: true })
  const [mensaje, setMensaje] = useState('')
  const disparador = useRef(null)
  const pestanaActiva = useRef(null)
  const movil = useIsMobile(1024)
  const reservas = datos?.reservas || null

  const ahora = `${hoy()}T${horaActual()}`
  const detalle = reservas?.find(reserva => reserva.id === seleccion)
  const puedeCancelar = detalle?.estado === 'programado' &&
    `${detalle.fecha}T${detalle.hora_inicio}` > ahora
  const esProxima = reserva => reserva.estado === 'programado' &&
    `${reserva.fecha}T${reserva.hora_fin}` > ahora
  const proximas = reservas?.filter(esProxima).reverse() || []
  const historial = reservas?.filter(reserva => !esProxima(reserva)) || []
  const vista = detalle ? esProxima(detalle) ? 'proximas' : 'historial'
    : params.get('vista') === 'historial' ? 'historial' : 'proximas'

  function actualizarVista(siguiente, id = null) {
    setParams(id ? { vista: siguiente, reserva: id } : { vista: siguiente }, { replace: true })
    setCancelando(false)
    setErrorCancelacion('')
    setMensaje('')
  }

  function seleccionar(id, boton) {
    if (guardando) return
    disparador.current = boton
    actualizarVista(vista, id === seleccion ? null : id)
  }

  function recuperarFoco() {
    const objetivo = disparador.current?.isConnected ? disparador.current : pestanaActiva.current
    objetivo?.focus()
  }

  function cerrarDetalle() {
    if (guardando) return
    actualizarVista(vista)
    if (!movil) recuperarFoco()
  }

  async function cancelar(campos) {
    const motivo = (campos.motivo || '').trim()
    if (motivo.length < 5) {
      setErrorCancelacion('Ingresá un motivo de al menos 5 caracteres.')
      return
    }
    setErrorCancelacion('')
    try {
      const { reserva } = await api(`reservas/${seleccion}/cancelar/`, { datos: { motivo } })
      setDatos(actual => ({
        ...actual,
        reservas: actual.reservas.map(item => item.id === reserva.id ? reserva : item),
      }))
      setCancelando(false)
      setMensaje('Reserva cancelada.')
    } catch (fallo) {
      setErrorCancelacion(fallo.message)
    }
  }

  const contenido = detalle && <>
    <div className="mis-reservas-resumen">
      <div className="min-w-0">
        <EstadoReserva estado={detalle.estado} />
        <h2 className="mis-reservas-titulo m-0 mt-2 text-2xl font-semibold">{detalle.cancha}</h2>
        <p className="m-0 mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />{detalle.sede}
        </p>
      </div>
      {!movil && <Button type="button" variant="ghost" size="icon" className="size-9 min-h-0 border-0 bg-transparent"
        disabled={guardando} aria-label="Cerrar detalle" onClick={cerrarDetalle}><X aria-hidden="true" /></Button>}
    </div>
    {mensaje && <p className="mis-reservas-confirmacion" role="status"><CheckCircle2 aria-hidden="true" />{mensaje}</p>}
    <dl className="mis-reservas-datos">
      <div><dt>Fecha</dt><dd>{labelFecha(detalle.fecha)}</dd></div>
      <div><dt>Horario</dt><dd>{detalle.hora_inicio} – {detalle.hora_fin}</dd></div>
      <div><dt>Importe</dt><dd>{importe(detalle.importe)}</dd></div>
      {detalle.observaciones && <div><dt>Observaciones</dt><dd>{detalle.observaciones}</dd></div>}
      {detalle.motivo_anulacion && <div><dt>Motivo de cancelación</dt><dd>{detalle.motivo_anulacion}</dd></div>}
    </dl>
    {puedeCancelar && !cancelando && <Button type="button" variant="outline"
      className="mt-4 min-h-11 w-full border-border bg-card text-destructive hover:text-destructive"
      onClick={() => setCancelando(true)}>Cancelar reserva</Button>}
    {puedeCancelar && cancelando && <form className="mt-4 grid gap-3 border-t border-border pt-4" onSubmit={handleSubmit(cancelar)}>
      <Label htmlFor="motivo-reserva">Motivo de cancelación</Label>
      <Textarea id="motivo-reserva" required minLength={5} rows={3}
        {...register('motivo')} disabled={guardando} />
      {errorCancelacion && <p className="error m-0" role="alert">{errorCancelacion}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="border-border" disabled={guardando} onClick={() => {
          setCancelando(false)
          setErrorCancelacion('')
        }}>Volver</Button>
        <Button variant="destructive" disabled={guardando}>
          {guardando ? 'Cancelando…' : 'Confirmar cancelación'}
        </Button>
      </div>
    </form>}
  </>

  return <main className="mis-reservas-superficie w-full flex-1">
    <div className="contenido-pagina">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mis-reservas-titulo m-0 text-4xl leading-none font-semibold sm:text-5xl">Mis reservas</h1>
        {reservas?.length > 0 && <Button asChild className="h-10 no-underline">
          <Link to="/agenda"><Plus aria-hidden="true" />Nueva reserva</Link>
        </Button>}
      </header>
      {errorConsulta && <p className="error" role="alert">{errorConsulta}</p>}
      {cargando && <Skeleton className="h-52 rounded-2xl" role="status" aria-label="Cargando reservas" />}
      {reservas?.length === 0 && <Card className="items-start gap-3 rounded-2xl border-border p-6 shadow-none">
        <div className="mis-reservas-icono"><CalendarDays aria-hidden="true" /></div>
        <h2 className="mis-reservas-titulo m-0 text-xl">Todavía no tenés reservas</h2>
        <Button asChild className="mt-1 no-underline"><Link to="/agenda">Ir a Agenda</Link></Button>
      </Card>}

      {reservas?.length > 0 && <div className={movil ? 'mis-reservas-vista' : 'mis-reservas-vista mis-reservas-escritorio'}>
        <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl border-border py-0 shadow-none">
          <Tabs value={vista} onValueChange={valor => actualizarVista(valor)} className="gap-0">
            <div className="border-b border-border px-3 py-3 sm:px-4">
              <TabsList aria-label="Estado de las reservas" className="h-auto max-w-full">
                <TabsTrigger value="proximas" ref={vista === 'proximas' ? pestanaActiva : null}
                  disabled={guardando} className="min-h-9 bg-transparent px-2 data-[state=active]:bg-card sm:px-3">
                  Próximas <span className="mis-reservas-cantidad">{proximas.length}</span>
                </TabsTrigger>
                <TabsTrigger value="historial" ref={vista === 'historial' ? pestanaActiva : null}
                  disabled={guardando} className="min-h-9 bg-transparent px-2 data-[state=active]:bg-card sm:px-3">
                  Historial <span className="mis-reservas-cantidad">{historial.length}</span>
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="proximas">
              <ListaReservas reservas={proximas} seleccion={seleccion} seleccionar={seleccionar}
                guardando={guardando} mensajeVacio="No tenés reservas próximas." />
            </TabsContent>
            <TabsContent value="historial">
              <ListaReservas reservas={historial} seleccion={seleccion} seleccionar={seleccionar}
                guardando={guardando} mensajeVacio="Todavía no hay reservas en el historial." />
            </TabsContent>
          </Tabs>
        </Card>

        <PanelDetalle
          movil={movil}
          abierto={Boolean(detalle)}
          cerrar={cerrarDetalle}
          recuperarFoco={recuperarFoco}
          bloqueado={guardando}
          titulo="Detalle de la reserva"
          descripcion="Información y acciones disponibles para la reserva seleccionada."
          clasePanel="mis-reservas-panel"
          claseSheet="mis-reservas-sheet">
          {contenido || <>
            <div className="mis-reservas-icono"><Clock aria-hidden="true" /></div>
            <h2 className="mis-reservas-titulo mt-3 mb-1 text-lg">Elegí una reserva</h2>
            <p className="m-0 text-sm text-muted-foreground">Seleccioná una fila para ver los datos del turno.</p>
          </>}
        </PanelDetalle>
      </div>}
    </div>
  </main>
}

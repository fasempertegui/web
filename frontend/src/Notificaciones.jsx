import React, { useEffect, useState } from 'react'
import { Bell, CalendarCheck, CalendarX, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from './api.js'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/dm-sans'
import './notificaciones.css'

const fechaAviso = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Salta',
})

const tipos = {
  reserva_creada: { titulo: 'Reserva confirmada', Icono: CalendarCheck },
  reserva_anulada: { titulo: 'Reserva cancelada', Icono: CalendarX },
}

const filtros = [
  { id: 'todas', etiqueta: 'Todas', vacio: 'Todavía no tenés notificaciones.' },
  { id: 'sin_leer', etiqueta: 'Sin leer', vacio: 'Estás al día. No hay avisos sin leer.' },
  { id: 'leidas', etiqueta: 'Leídas', vacio: 'Todavía no tenés avisos leídos.' },
]

function FilaAviso({ aviso, abrir, ocupado }) {
  const { titulo, Icono } = tipos[aviso.tipo] || { titulo: 'Aviso de reserva', Icono: Bell }

  return <li>
    <button type="button" className="notificacion-fila" data-sin-leer={!aviso.leida_en}
      disabled={ocupado} onClick={() => abrir(aviso)}>
      <span className="notificacion-icono" data-tipo={aviso.tipo}>
        <Icono aria-hidden="true" />
      </span>
      <span className="notificacion-contenido">
        <strong>{titulo}</strong>
        <span>{aviso.mensaje}</span>
      </span>
      <time dateTime={aviso.creado_en}>{fechaAviso.format(new Date(aviso.creado_en))}</time>
      <span className="notificacion-indicador">
        {!aviso.leida_en && <><span className="notificacion-punto" aria-hidden="true" /><span className="sr-only">Sin leer</span></>}
        <ChevronRight className="notificacion-flecha" aria-hidden="true" />
      </span>
    </button>
  </li>
}

export default function Notificaciones({ alCargar }) {
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState('todas')
  const [pagina, setPagina] = useState(1)
  const [version, refrescar] = useState(0)
  const [bandeja, setBandeja] = useState(null)
  const [error, setError] = useState('')
  const [accion, setAccion] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const consulta = `${filtro}:${pagina}:${version}`
  const activa = bandeja?.consulta === consulta ? bandeja : null
  const sinLeer = bandeja?.sin_leer || 0
  const ocupado = accion !== null

  useEffect(() => {
    const control = new AbortController()
    api(`notificaciones/?estado=${filtro}&pagina=${pagina}`, { signal: control.signal })
      .then(datos => {
        if (control.signal.aborted) return
        setBandeja({ ...datos, consulta })
        alCargar(datos.sin_leer)
      })
      .catch(fallo => {
        if (fallo.name !== 'AbortError') {
          setBandeja(anterior => ({ consulta, error: fallo.message, sin_leer: anterior?.sin_leer }))
        }
      })
    return () => control.abort()
  }, [consulta, filtro, pagina, alCargar])

  function cambiarFiltro(valor) {
    if (ocupado) return
    setFiltro(valor)
    setPagina(1)
    setError('')
    setMensaje('')
  }

  async function abrir(aviso) {
    setAccion(aviso.id)
    setError('')
    try {
      if (!aviso.leida_en) {
        await api(`notificaciones/${aviso.id}/leer/`, { datos: {} })
        alCargar(Math.max(0, sinLeer - 1))
      }
      navegar(`/mis-reservas?reserva=${aviso.reserva_id}`)
    } catch (fallo) {
      setError(fallo.message)
      setAccion(null)
    }
  }

  async function leerTodas() {
    setAccion('todas')
    setError('')
    setMensaje('')
    try {
      const { marcadas } = await api('notificaciones/leer-todas/', { datos: {} })
      const restantes = Math.max(0, sinLeer - marcadas)
      setBandeja(anterior => ({ ...anterior, sin_leer: restantes }))
      alCargar(restantes)
      setPagina(1)
      refrescar(valor => valor + 1)
      setMensaje('Notificaciones marcadas como leídas.')
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setAccion(null)
    }
  }

  return <main className="notificaciones-superficie w-full flex-1">
    <div className="notificaciones-contenido">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="notificaciones-titulo m-0 text-4xl leading-none font-semibold sm:text-5xl">Notificaciones</h1>
        {sinLeer > 0 && <Button type="button" variant="outline"
          className="h-10 border-border bg-card" disabled={ocupado || !activa || Boolean(activa.error)} onClick={leerTodas}>
          <CheckCheck aria-hidden="true" />
          {accion === 'todas' ? 'Marcando…' : 'Marcar todas como leídas'}
        </Button>}
      </header>
      {(error || activa?.error) && <p className="error" role="alert">{error || activa.error}</p>}
      {mensaje && <p className="notificaciones-confirmacion" role="status"><CheckCheck aria-hidden="true" />{mensaje}</p>}

      <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl border-border py-0 shadow-none">
        <Tabs value={filtro} onValueChange={cambiarFiltro} className="gap-0">
          <div className="border-b border-border px-3 py-3 sm:px-4">
            <TabsList aria-label="Filtrar notificaciones" className="h-auto max-w-full">
              {filtros.map(item => <TabsTrigger key={item.id} value={item.id} disabled={ocupado}
                className="min-h-9 bg-transparent px-2 data-[state=active]:bg-card sm:px-3">
                {item.etiqueta}
                {item.id === 'sin_leer' && sinLeer > 0 && <span className="notificaciones-cantidad">{sinLeer}</span>}
              </TabsTrigger>)}
            </TabsList>
          </div>

          {filtros.map(item => <TabsContent key={item.id} value={item.id}>
            {!activa ? <div className="grid gap-3 p-4" role="status" aria-label="Cargando notificaciones">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div> : activa.error ? <div className="px-4 py-5">
              <Button type="button" variant="outline" className="border-border"
                onClick={() => { setPagina(1); refrescar(valor => valor + 1) }}>Volver a consultar</Button>
            </div> : activa.notificaciones.length > 0 ? <>
              <ul className="m-0 list-none divide-y divide-border p-0">
                {activa.notificaciones.map(aviso => <FilaAviso key={aviso.id} aviso={aviso} abrir={abrir} ocupado={ocupado} />)}
              </ul>
              {activa.paginas > 1 && <nav className="notificaciones-paginas" aria-label="Páginas de notificaciones">
                <Button type="button" variant="outline" className="border-border" disabled={pagina <= 1 || ocupado}
                  onClick={() => setPagina(pagina - 1)}><ChevronLeft aria-hidden="true" />Anterior</Button>
                <span>Página {pagina} de {activa.paginas}</span>
                <Button type="button" variant="outline" className="border-border" disabled={pagina >= activa.paginas || ocupado}
                  onClick={() => setPagina(pagina + 1)}>Siguiente<ChevronRight aria-hidden="true" /></Button>
              </nav>}
            </> : <div className="notificaciones-vacio">
              <span className="notificacion-icono"><Bell aria-hidden="true" /></span>
              <p className="m-0">{item.vacio}</p>
            </div>}
          </TabsContent>)}
        </Tabs>
      </Card>
    </div>
  </main>
}

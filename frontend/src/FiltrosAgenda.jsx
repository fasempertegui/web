import React, { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { desplazarFecha, hoy, labelFecha } from './fechas.js'

function fechaCalendario(valor) {
  return new Date(valor + 'T12:00:00')
}

export function FiltrosAgenda({ sedes, sede, fecha, minimo, maximo, cambiarVista }) {
  const [calendarioAbierto, setCalendarioAbierto] = useState(false)
  const seleccionada = fechaCalendario(fecha)
  const desde = fechaCalendario(minimo)
  const hasta = fechaCalendario(maximo)

  const cambiarDia = nuevoDia => cambiarVista(sede.id, nuevoDia)

  return <Card role="region" aria-label="Filtros de agenda" className="agenda-filtros border-border flex-row flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl px-4 py-3.5 shadow-none sm:px-5">
    <div className="grid gap-2">
      <Label className="text-muted-foreground" htmlFor="sede-agenda">Sede</Label>
      <Select value={String(sede.id)} onValueChange={id => cambiarVista(id, fecha)}>
        <SelectTrigger id="sede-agenda" className="w-full min-w-44 bg-card text-foreground data-[size=default]:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sedes.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div className="grid gap-2">
      <Label className="text-muted-foreground" htmlFor="fecha-agenda">Fecha</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Día anterior"
          disabled={fecha <= minimo} onClick={() => cambiarDia(desplazarFecha(fecha, -1))}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Popover open={calendarioAbierto} onOpenChange={setCalendarioAbierto}>
          <PopoverTrigger asChild>
            <Button id="fecha-agenda" type="button" variant="outline" className="h-10 min-w-32 tabular-nums"
              aria-label={`Elegir fecha: ${labelFecha(fecha)}`}>
              <CalendarDays aria-hidden="true" />
              {fecha.split('-').reverse().join('/')}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1rem)] p-0">
            <Calendar locale={es} mode="single" selected={seleccionada} defaultMonth={seleccionada}
              startMonth={desde} endMonth={hasta} disabled={{ before: desde, after: hasta }}
              captionLayout="dropdown" weekStartsOn={1} autoFocus
              formatters={{ formatMonthDropdown: dia => format(dia, 'MMMM', { locale: es }) }}
              className="[&_button]:min-h-0 [&_select]:min-h-0"
              onSelect={dia => {
                if (!dia) return
                cambiarDia(format(dia, 'yyyy-MM-dd'))
                setCalendarioAbierto(false)
              }} />
          </PopoverContent>
        </Popover>
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Día siguiente"
          disabled={fecha >= maximo} onClick={() => cambiarDia(desplazarFecha(fecha, 1))}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button type="button" variant="secondary" className="h-10" onClick={() => cambiarDia(hoy())}>Hoy</Button>
      </div>
    </div>
  </Card>
}

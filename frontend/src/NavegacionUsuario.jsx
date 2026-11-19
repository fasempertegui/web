import React from 'react'
import { Bell, CalendarDays, ChevronDown, ClipboardList, LogOut, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { inicialesUsuario, nombreCompleto } from './usuarios.js'
import './navegacion-usuario.css'

export default function NavegacionUsuario({ agenda, usuario, sinLeer, cerrar }) {
  const { pathname } = useLocation()
  const nombre = nombreCompleto(usuario)
  const iniciales = inicialesUsuario(usuario)

  const enlaces = [
    { ruta: '/agenda', destino: agenda, titulo: 'Agenda', Icono: CalendarDays },
    { ruta: '/mis-reservas', titulo: 'Mis reservas', Icono: ClipboardList },
    { ruta: '/notificaciones', titulo: 'Notificaciones', Icono: Bell },
  ]

  return <header className="portal-barra">
    <div className="contenido-pagina portal-barra-contenido">
      <Link to={agenda} className="portal-marca" aria-label="Academia TM, ir a Agenda">
        <img src="/logo.png" alt="" className="size-9 shrink-0 rounded-lg object-contain" />
        <span>Academia TM</span>
      </Link>

      <nav className="portal-nav" aria-label="Navegación principal">
        {enlaces.map(({ ruta, destino, titulo, Icono }) => {
          const activa = pathname === ruta || pathname.startsWith(ruta + '/')
          return <Link className="portal-enlace" key={ruta} to={destino || ruta}
            aria-current={activa ? 'page' : undefined}>
            <Icono aria-hidden="true" />
            <span>{titulo}</span>
            {ruta === '/notificaciones' && sinLeer > 0 && <Badge
              className="portal-avisos rounded-full bg-primary px-1.5 text-xs text-white"
              aria-label={`${sinLeer} sin leer`}>{sinLeer > 99 ? '99+' : sinLeer}</Badge>}
          </Link>
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline"
            className="portal-cuenta h-10 min-w-0 gap-1.5 rounded-xl border-border bg-card px-2.5 text-foreground"
            aria-label="Menú de cuenta">
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="bg-secondary text-xs font-semibold text-primary">{iniciales}</AvatarFallback>
            </Avatar>
            <span className="portal-cuenta-nombre truncate">{nombre}</span>
            <ChevronDown className="size-3.5 text-primary" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="portal-menu-cuenta w-56 rounded-xl border-border">
          <DropdownMenuLabel className="min-w-0 px-2 py-2">
            <strong className="block truncate">{nombre}</strong>
            {nombre !== usuario.nombre_usuario && <small className="block truncate font-normal text-muted-foreground">
              {usuario.nombre_usuario}
            </small>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/perfil" className="text-foreground no-underline"
              aria-current={pathname === '/perfil' ? 'page' : undefined}><UserRound aria-hidden="true" />Mi perfil</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={cerrar}><LogOut aria-hidden="true" />Cerrar sesión</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
}

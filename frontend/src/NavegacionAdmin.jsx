import React from 'react'
import { Bell, CalendarDays, ClipboardList, LogOut, MapPin, UsersRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'
import './navegacion-admin.css'

const grupos = [
  { titulo: 'Operación', enlaces: [
    { ruta: '/agenda', icono: CalendarDays, etiqueta: 'Agenda' },
    { ruta: '/instalaciones', icono: MapPin, etiqueta: 'Instalaciones' },
    { ruta: '/usuarios', icono: UsersRound, etiqueta: 'Usuarios' },
  ] },
  { titulo: 'Personal', enlaces: [
    { ruta: '/mis-reservas', icono: ClipboardList, etiqueta: 'Mis reservas' },
    { ruta: '/notificaciones', icono: Bell, etiqueta: 'Notificaciones' },
  ] },
]

function MenuAdmin({ agenda, usuario, sinLeer, cerrar }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const nombre = [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.nombre_usuario
  const inicial = nombre.slice(0, 1).toLocaleUpperCase('es-AR')
  const cerrarMenuMovil = () => setOpenMobile(false)

  return <Sidebar collapsible="offcanvas">
    <div className="menu-admin flex min-h-0 flex-1 flex-col border-r border-border bg-[#faf7fc] text-foreground">
      <SidebarHeader className="menu-admin-marca px-4 py-5">
        <Link to={agenda} onClick={cerrarMenuMovil}
          className="flex w-fit items-center gap-2.5 rounded-lg text-white no-underline focus-visible:outline-white">
          <img src="/logo.png" className="size-9 rounded-md object-contain" alt="" />
          <span className="menu-admin-titulo text-xl leading-none font-semibold">Academia TM</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2.5 py-3">
        <nav className="flex flex-col gap-2" aria-label="Administración">
          {grupos.map(grupo => <SidebarGroup className="px-0 py-1" key={grupo.titulo}>
            <SidebarGroupLabel className="h-7 px-3.5 text-xs font-semibold text-muted-foreground">{grupo.titulo}</SidebarGroupLabel>
            <SidebarMenu className="m-0 list-none gap-1 p-0">
              {grupo.enlaces.map(({ ruta, icono: Icono, etiqueta }) => {
                const activa = pathname === ruta || pathname.startsWith(ruta + '/')
                return <SidebarMenuItem key={ruta}>
                  <SidebarMenuButton asChild isActive={activa}
                    className="menu-admin-enlace relative h-10 rounded-lg px-3.5 text-sm text-foreground no-underline
                      hover:bg-secondary hover:text-sidebar focus-visible:ring-ring
                      data-[active=true]:bg-[#ece0f6] data-[active=true]:font-semibold data-[active=true]:text-sidebar">
                    <Link to={ruta === '/agenda' ? agenda : ruta} onClick={cerrarMenuMovil}
                      aria-current={activa ? 'page' : undefined}>
                      <Icono aria-hidden="true" className="text-primary" />
                      <span>{etiqueta}</span>
                      {ruta === '/notificaciones' && sinLeer > 0 &&
                        <Badge className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-xs text-white"
                          aria-label={`${sinLeer} sin leer`}>{sinLeer}</Badge>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              })}
            </SidebarMenu>
          </SidebarGroup>)}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1">
          <Link to="/perfil" onClick={cerrarMenuMovil} aria-current={pathname === '/perfil' ? 'page' : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 text-foreground no-underline
              hover:bg-secondary aria-[current=page]:bg-secondary focus-visible:outline-ring">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-secondary text-sm font-semibold text-primary">{inicial}</AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 text-sm leading-tight">
              <strong className="truncate font-semibold">{nombre}</strong>
              <span className="text-xs text-muted-foreground">Mi perfil</span>
            </span>
          </Link>
          <Button type="button" variant="ghost" size="icon" onClick={cerrar}
            className="size-9 min-h-0 shrink-0 border-0 bg-transparent text-primary"
            aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      </SidebarFooter>
    </div>
  </Sidebar>
}

function BarraAdmin() {
  const { isMobile, openMobile, open } = useSidebar()
  const abierto = isMobile ? openMobile : open

  return <header className="menu-admin flex min-h-12 items-center gap-2 border-b border-border bg-[#faf7fc] px-4">
    <SidebarTrigger className="size-9 min-h-0 rounded-lg border-0 bg-transparent text-primary hover:bg-secondary"
      title={abierto ? 'Ocultar menú' : 'Mostrar menú'} aria-label={abierto ? 'Ocultar menú' : 'Mostrar menú'}
      aria-expanded={abierto} />
    {!abierto && <span className="text-sm font-medium text-muted-foreground" aria-hidden="true">Menú</span>}
  </header>
}

export default function NavegacionAdmin({ agenda, usuario, sinLeer, cerrar, children }) {
  return <SidebarProvider>
    <MenuAdmin agenda={agenda} usuario={usuario} sinLeer={sinLeer} cerrar={cerrar} />
    <SidebarInset className="min-w-0 [&>.pagina]:w-full">
      <BarraAdmin />
      {children}
    </SidebarInset>
  </SidebarProvider>
}

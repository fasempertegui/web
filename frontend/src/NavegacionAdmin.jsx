import React from 'react'
import { Bell, CalendarDays, ClipboardList, LogOut, MapPin, UserRound, UsersRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'

function MenuAdmin({ agenda, usuario, sinLeer, cerrar }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const secciones = [
    { ruta: '/agenda', destino: agenda, icono: CalendarDays, etiqueta: 'Agenda' },
    { ruta: '/mis-reservas', icono: ClipboardList, etiqueta: 'Mis reservas' },
    { ruta: '/notificaciones', icono: Bell, etiqueta: 'Notificaciones' },
    { ruta: '/usuarios', icono: UsersRound, etiqueta: 'Usuarios' },
    { ruta: '/instalaciones', icono: MapPin, etiqueta: 'Instalaciones' },
  ]

  return <Sidebar collapsible="offcanvas">
    <SidebarHeader className="px-3 pt-4">
      <Link to={agenda} onClick={() => setOpenMobile(false)} className="marca text-sidebar-foreground no-underline">
        <img src="/logo.png" alt="" /> Academia TM
      </Link>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <nav aria-label="Administración">
          <SidebarMenu className="m-0 list-none p-0">
            {secciones.map(({ ruta, destino, icono: Icono, etiqueta }) => {
              const activa = pathname === ruta || pathname.startsWith(ruta + '/')
              return <SidebarMenuItem key={ruta}>
                <SidebarMenuButton asChild isActive={activa} size="lg" className="text-sidebar-foreground no-underline">
                  <Link to={destino || ruta} onClick={() => setOpenMobile(false)}
                    aria-current={activa ? 'page' : undefined}>
                    <Icono aria-hidden="true" />
                    <span>{etiqueta}</span>
                    {ruta === '/notificaciones' && sinLeer > 0 &&
                      <span className="ml-auto rounded-full bg-sidebar-primary px-2 text-xs font-semibold text-sidebar-primary-foreground"
                        aria-label={`${sinLeer} sin leer`}>{sinLeer}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            })}
          </SidebarMenu>
        </nav>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter className="border-t border-sidebar-border">
      <SidebarMenu className="m-0 list-none p-0">
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={pathname === '/perfil'} size="lg" className="text-sidebar-foreground no-underline">
            <Link to="/perfil" onClick={() => setOpenMobile(false)}
              aria-current={pathname === '/perfil' ? 'page' : undefined}>
              <UserRound aria-hidden="true" />
              <span>{usuario.nombre || usuario.nombre_usuario}</span>
              <span className="ml-auto text-xs">Perfil</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton className="justify-start border-0 bg-transparent text-sidebar-foreground" onClick={cerrar}>
            <LogOut aria-hidden="true" /><span>Salir</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
}

export default function NavegacionAdmin({ agenda, usuario, sinLeer, cerrar, children }) {
  return <SidebarProvider>
    <MenuAdmin agenda={agenda} usuario={usuario} sinLeer={sinLeer} cerrar={cerrar} />
    <SidebarInset className="min-w-0 [&>.pagina]:w-full">
      <header className="flex min-h-12 items-center border-b border-border bg-card px-4">
        <SidebarTrigger className="size-10 min-h-10 border-0 bg-transparent" title="Alternar menú de administración" aria-label="Alternar menú de administración" />
      </header>
      {children}
    </SidebarInset>
  </SidebarProvider>
}

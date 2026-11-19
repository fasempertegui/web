import React, { useEffect, useRef } from 'react'
import { cn } from 'cn'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export function PanelDetalle({
  movil,
  abierto,
  cerrar,
  recuperarFoco,
  titulo,
  descripcion,
  bloqueado = false,
  mostrarEnEscritorio = true,
  clasePanel,
  claseSheet,
  claseContenido,
  children,
}) {
  const cerrarRef = useRef(cerrar)
  cerrarRef.current = cerrar

  useEffect(() => {
    if (movil || !abierto || bloqueado) return
    const manejarTecla = evento => {
      if (evento.key !== 'Escape' || evento.defaultPrevented) return
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"]')) return
      cerrarRef.current?.()
    }
    window.addEventListener('keydown', manejarTecla)
    return () => window.removeEventListener('keydown', manejarTecla)
  }, [movil, abierto, bloqueado])

  if (movil) {
    return <Sheet open={abierto} onOpenChange={estado => { if (!estado && !bloqueado) cerrar() }}>
      <SheetContent
        side="bottom"
        showCloseButton={!bloqueado}
        className={cn('max-h-[85svh] gap-0 overflow-y-auto rounded-t-xl bg-card', claseSheet)}
        onCloseAutoFocus={evento => {
          if (!recuperarFoco) return
          if (recuperarFoco() !== false) evento.preventDefault()
        }}>
        <SheetHeader className="sr-only">
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{descripcion}</SheetDescription>
        </SheetHeader>
        <div className={cn('px-4 pt-12 pb-5', claseContenido)}>{children}</div>
      </SheetContent>
    </Sheet>
  }

  if (!mostrarEnEscritorio) return null

  return <Card
    role="complementary"
    aria-label={titulo}
    className={cn('gap-0 rounded-2xl border-border py-0 shadow-none', clasePanel)}>
    <CardContent className={cn('p-4', claseContenido)}>{children}</CardContent>
  </Card>
}

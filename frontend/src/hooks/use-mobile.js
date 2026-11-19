import * as React from "react"

const MOBILE_BREAKPOINT = 768

function consultaMovil(breakpoint) {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches
}

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState(() => consultaMovil(breakpoint))

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = evento => setIsMobile(evento.matches)
    setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return isMobile
}

const zona = 'America/Argentina/Salta'
const fechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: zona })
const horaLocal = new Intl.DateTimeFormat('en-GB', {
  timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const diaLargo = new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: 'UTC' })
const mesCortoFmt = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const mesLargoFmt = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fechaHoraFmt = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: zona,
})
const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

const fechaUTC = fecha => new Date(fecha + 'T12:00:00Z')

export const hoy = () => fechaLocal.format(new Date())
export const horaActual = () => horaLocal.format(new Date())
export const labelFecha = fecha => diaLargo.format(fechaUTC(fecha))
export const labelMesCorto = fecha => mesCortoFmt.format(fechaUTC(fecha))
export const labelFechaHora = iso => fechaHoraFmt.format(new Date(iso))
export const importe = precio => pesos.format(precio)
export const diaSemanaISO = fecha => fechaUTC(fecha).getUTCDay() || 7

export function desplazarFecha(fecha, dias) {
  const nueva = fechaUTC(fecha)
  nueva.setUTCDate(nueva.getUTCDate() + dias)
  return nueva.toISOString().slice(0, 10)
}

export function finDeMes(fecha, meses = 0) {
  const base = fechaUTC(fecha)
  base.setUTCMonth(base.getUTCMonth() + meses + 1, 0)
  return base.toISOString().slice(0, 10)
}

export function proximosMeses(cantidad, desde = hoy()) {
  const inicio = fechaUTC(desde.slice(0, 7) + '-01')
  return Array.from({ length: cantidad }, (_, indice) => {
    const mes = new Date(inicio)
    mes.setUTCMonth(inicio.getUTCMonth() + indice)
    return { valor: mes.toISOString().slice(0, 7), etiqueta: mesLargoFmt.format(mes) }
  })
}

export function fechaValida(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') &&
    !Number.isNaN(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha
}

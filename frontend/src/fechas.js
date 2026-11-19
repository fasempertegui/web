const zona = 'America/Argentina/Salta'
const fechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: zona })
const horaLocal = new Intl.DateTimeFormat('en-GB', {
  timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const diaLargo = new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: 'UTC' })
const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export const hoy = () => fechaLocal.format(new Date())
export const horaActual = () => horaLocal.format(new Date())
export const labelFecha = fecha => diaLargo.format(new Date(fecha + 'T12:00:00Z'))
export const importe = precio => pesos.format(precio)

export function desplazarFecha(fecha, dias) {
  const nueva = new Date(fecha + 'T12:00:00Z')
  nueva.setUTCDate(nueva.getUTCDate() + dias)
  return nueva.toISOString().slice(0, 10)
}

export function fechaValida(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') &&
    !Number.isNaN(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha
}

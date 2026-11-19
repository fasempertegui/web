let csrfToken

export async function api(ruta, { datos, signal, metodo = datos === undefined ? 'GET' : 'POST' } = {}) {
  const opciones = { signal, method: metodo }
  if (!['GET', 'HEAD'].includes(metodo)) {
    opciones.headers = { 'X-CSRFToken': csrfToken || '' }
  }
  if (datos !== undefined) {
    opciones.headers = { ...opciones.headers, 'Content-Type': 'application/json' }
    opciones.body = JSON.stringify(datos)
  }

  const respuesta = await fetch('/api/' + ruta, opciones)
  const cuerpo = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    const mensajes = Object.values(cuerpo.errores || {}).flat().map(error => error.message)
    throw new Error(cuerpo.error || mensajes.join(' ') || 'No se pudo completar la solicitud.')
  }
  if (cuerpo.csrf_token) csrfToken = cuerpo.csrf_token
  return cuerpo
}

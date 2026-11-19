let csrfToken

export async function api(ruta, { datos, signal } = {}) {
  const opciones = { signal }
  if (datos !== undefined) {
    opciones.method = 'POST'
    opciones.headers = {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken || '',
    }
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

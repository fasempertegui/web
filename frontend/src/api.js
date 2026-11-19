import axios from 'axios'

let csrfToken

export async function api(ruta, { datos, signal, metodo = datos === undefined ? 'GET' : 'POST' } = {}) {
  const headers = {}
  if (!['GET', 'HEAD'].includes(metodo)) {
    headers['X-CSRFToken'] = csrfToken || ''
  }

  try {
    const { data: cuerpo } = await axios.request({
      url: '/api/' + ruta,
      method: metodo,
      data: datos,
      headers,
      signal,
    })
    if (cuerpo?.csrf_token) csrfToken = cuerpo.csrf_token
    return cuerpo
  } catch (fallo) {
    if (axios.isCancel(fallo)) {
      throw new DOMException(fallo.message, 'AbortError')
    }
    const cuerpo = fallo.response?.data
    const mensajes = Object.values(cuerpo?.errores || {}).flat().map(error => error.message)
    throw new Error(cuerpo?.error || mensajes.join(' ') || 'No se pudo completar la solicitud.')
  }
}

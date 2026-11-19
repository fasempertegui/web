import axios from 'axios'

const METODOS_SEGUROS = new Set(['GET', 'HEAD'])

let csrfToken = ''
let csrfPendiente = null

function obtenerCsrf() {
  if (!csrfPendiente) {
    csrfPendiente = axios.get('/api/sesion/')
      .then(({ data }) => {
        if (data?.csrf_token) csrfToken = data.csrf_token
        return csrfToken
      })
      .finally(() => { csrfPendiente = null })
  }
  return csrfPendiente
}

function normalizarError(fallo) {
  if (axios.isCancel(fallo) || fallo?.name === 'AbortError') {
    return new DOMException(fallo.message || 'Solicitud cancelada.', 'AbortError')
  }
  const cuerpo = fallo.response?.data
  const mensajes = Object.values(cuerpo?.errores || {}).flat().map(error => error.message)
  return new Error(cuerpo?.error || mensajes.join(' ') || 'No se pudo completar la solicitud.')
}

async function ejecutar(ruta, { datos, signal, metodo, reintento }) {
  const metodoHttp = metodo.toUpperCase()
  const esSeguro = METODOS_SEGUROS.has(metodoHttp)
  const headers = {}

  if (!esSeguro) {
    if (!csrfToken) {
      await obtenerCsrf()
      if (signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
    }
    headers['X-CSRFToken'] = csrfToken
  }

  try {
    const { data: cuerpo } = await axios.request({
      url: '/api/' + ruta,
      method: metodoHttp,
      data: datos,
      headers,
      signal,
    })
    if (cuerpo?.csrf_token) csrfToken = cuerpo.csrf_token
    return cuerpo
  } catch (fallo) {
    const esErrorCsrf = !esSeguro && !reintento &&
      fallo.response?.status === 403 && fallo.response?.data?.error === 'Token CSRF inválido.'
    if (esErrorCsrf) {
      csrfToken = ''
      await obtenerCsrf()
      if (signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
      return ejecutar(ruta, { datos, signal, metodo: metodoHttp, reintento: true })
    }
    throw fallo
  }
}

export async function api(ruta, { datos, signal, metodo = datos === undefined ? 'GET' : 'POST' } = {}) {
  try {
    return await ejecutar(ruta, { datos, signal, metodo, reintento: false })
  } catch (fallo) {
    throw normalizarError(fallo)
  }
}

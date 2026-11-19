import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'

export function useBuscarUsuarios(texto, { activo = true, espera = 220 } = {}) {
  const [resultado, setResultado] = useState(null)
  const busqueda = texto.trim()
  const habilitada = activo && busqueda.length >= 2

  useEffect(() => {
    if (!habilitada) return
    const control = new AbortController()
    const temporizador = setTimeout(() => {
      api('usuarios/?q=' + encodeURIComponent(busqueda), { signal: control.signal })
        .then(datos => {
          if (!control.signal.aborted) setResultado({ busqueda, usuarios: datos.usuarios, error: '' })
        })
        .catch(fallo => {
          if (fallo.name !== 'AbortError') setResultado({ busqueda, usuarios: null, error: fallo.message })
        })
    }, espera)

    return () => {
      clearTimeout(temporizador)
      control.abort()
    }
  }, [busqueda, habilitada, espera])

  const vigente = habilitada && resultado?.busqueda === busqueda
  const usuarios = vigente ? resultado.usuarios : null
  const error = vigente ? resultado.error : ''
  const buscando = habilitada && !vigente

  const actualizarUsuario = useCallback(usuario => {
    setResultado(actual => actual?.usuarios ? {
      ...actual,
      usuarios: actual.usuarios.map(item => item.id === usuario.id ? usuario : item),
    } : actual)
  }, [])

  return { busqueda, usuarios, error, buscando, actualizarUsuario }
}

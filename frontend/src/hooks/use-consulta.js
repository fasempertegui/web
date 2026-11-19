import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

export function useConsulta(ruta, { alExito } = {}) {
  const [version, setVersion] = useState(0)
  const [estado, setEstado] = useState(null)
  const alExitoRef = useRef(alExito)
  alExitoRef.current = alExito

  const llave = ruta ? `${ruta}#${version}` : null
  const llaveRef = useRef(llave)
  llaveRef.current = llave

  useEffect(() => {
    if (!ruta) return
    const control = new AbortController()
    const llaveActual = `${ruta}#${version}`

    api(ruta, { signal: control.signal })
      .then(datos => {
        if (control.signal.aborted) return
        setEstado({ llave: llaveActual, datos, error: '' })
        alExitoRef.current?.(datos)
      })
      .catch(fallo => {
        if (fallo.name !== 'AbortError') {
          setEstado({ llave: llaveActual, datos: null, error: fallo.message })
        }
      })

    return () => control.abort()
  }, [ruta, version])

  const vigente = Boolean(llave && estado?.llave === llave)
  const datos = vigente ? estado.datos : null
  const error = vigente ? estado.error : ''
  const cargando = Boolean(ruta) && !vigente

  const setDatos = useCallback(actualizador => {
    if (!llave || llaveRef.current !== llave) return
    setEstado(anterior => {
      if (anterior?.llave !== llave) return anterior
      const siguientes = typeof actualizador === 'function' ? actualizador(anterior.datos) : actualizador
      return { ...anterior, datos: siguientes, error: '' }
    })
  }, [llave])

  const recargar = useCallback(() => {
    setVersion(actual => actual + 1)
  }, [])

  return { datos, error, cargando, setDatos, recargar }
}

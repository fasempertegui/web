import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './api.js'

const fechaAviso = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Salta',
})

const tipos = {
  reserva_creada: 'Reserva confirmada',
  reserva_anulada: 'Reserva cancelada',
}

export function Notificaciones({ alCargar }) {
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState('todas')
  const [pagina, setPagina] = useState(1)
  const [version, refrescar] = useState(0)
  const [bandeja, setBandeja] = useState(null)
  const [error, setError] = useState('')
  const [accion, setAccion] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const consulta = `${filtro}:${pagina}:${version}`
  const activa = bandeja?.consulta === consulta ? bandeja : null

  useEffect(() => {
    const control = new AbortController()
    api(`notificaciones/?estado=${filtro}&pagina=${pagina}`, { signal: control.signal })
      .then(datos => {
        if (control.signal.aborted) return
        setBandeja({ ...datos, consulta })
        alCargar(datos.sin_leer)
      })
      .catch(fallo => {
        if (fallo.name !== 'AbortError') setBandeja({ consulta, error: fallo.message })
      })
    return () => control.abort()
  }, [consulta, filtro, pagina, alCargar])

  async function abrir(aviso) {
    setAccion(aviso.id)
    setError('')
    try {
      if (!aviso.leida_en) await api(`notificaciones/${aviso.id}/leer/`, { datos: {} })
      navegar(`/mis-reservas?reserva=${aviso.reserva_id}`)
    } catch (fallo) {
      setError(fallo.message)
      setAccion(null)
    }
  }

  async function leerTodas() {
    setAccion('todas')
    setError('')
    setMensaje('')
    try {
      await api('notificaciones/leer-todas/', { datos: {} })
      setPagina(1)
      refrescar(valor => valor + 1)
      setMensaje('Notificaciones marcadas como leídas.')
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setAccion(null)
    }
  }

  return <main className="pagina pagina-reserva">
    <header className="encabezado encabezado-agenda">
      <h1>Notificaciones</h1>
      {activa?.sin_leer > 0 && <button type="button" disabled={accion !== null} onClick={leerTodas}>
        {accion === 'todas' ? 'Guardando…' : 'Marcar todas como leídas'}
      </button>}
    </header>
    <div className="tarjeta bandeja">
      <label>Mostrar<select value={filtro} disabled={accion !== null} onChange={evento => {
        setFiltro(evento.target.value)
        setPagina(1)
        setError('')
        setMensaje('')
      }}>
        <option value="todas">Todas</option>
        <option value="sin_leer">Sin leer</option>
        <option value="leidas">Leídas</option>
      </select></label>
      {(error || activa?.error) && <p className="error" role="alert">{error || activa.error}</p>}
      {mensaje && <p className="reserva-mensaje" role="status">{mensaje}</p>}
      {!activa && <p role="status">Cargando notificaciones…</p>}
      {activa?.notificaciones?.length === 0 && <p className="texto-suave">No hay notificaciones para mostrar.</p>}
      {activa?.notificaciones?.length > 0 && <ul className="lista-avisos">
        {activa.notificaciones.map(aviso => <li key={aviso.id}>
          <button type="button" className="fila-aviso" disabled={accion !== null}
            onClick={() => abrir(aviso)}>
            <span className="aviso-titulo">
              <strong>{tipos[aviso.tipo] || 'Aviso de reserva'}</strong>
              {!aviso.leida_en && <small>Sin leer</small>}
            </span>
            <span>{aviso.mensaje}</span>
            <time dateTime={aviso.creado_en}>{fechaAviso.format(new Date(aviso.creado_en))}</time>
          </button>
        </li>)}
      </ul>}
      {activa?.paginas > 1 && <nav className="paginas-avisos" aria-label="Páginas de notificaciones">
        <button disabled={pagina <= 1 || accion !== null} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {activa.paginas}</span>
        <button disabled={pagina >= activa.paginas || accion !== null} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </nav>}
    </div>
  </main>
}

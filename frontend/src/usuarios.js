export function nombreCompleto(usuario) {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.nombre_usuario
}

export function inicialesUsuario(usuario, maximo = 2) {
  const partes = [usuario.nombre, usuario.apellido].filter(Boolean)
  const texto = partes.length
    ? partes.map(parte => parte[0]).join('')
    : usuario.nombre_usuario
  return texto.slice(0, maximo).toLocaleUpperCase('es-AR')
}

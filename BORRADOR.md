# Turnero de canchas

Frontend en React que consume una API JSON para consultar disponibilidad, reservar canchas y administrar la agenda. Todas las operaciones se rigen por las reglas vigentes del turnero.

## Pantallas y consumo de API

| Pantalla | Operaciones de API |
|---|---|
| Acceso | Registrarse, iniciar y cerrar sesión, consultar la sesión. |
| Agenda | Consultar sedes, canchas y disponibilidad. Crear una reserva. |
| Mis reservas | Consultar reservas propias y cancelarlas cuando corresponda. |
| Perfil | Consultar y actualizar el perfil. |
| Notificaciones | Consultar avisos dentro de la app. |
| Agenda de administración | Consultar reservas y bloqueos, gestionar reservas y crear o levantar bloqueos individuales. |
| Planilla de bloqueos | Consultar turnos y gestionar bloqueos en masa. |
| Usuarios | Buscar cuentas, cambiar direcciones de correo y restablecer contraseñas desde administración. |

## Comportamiento de la agenda en React

- La agenda diaria conserva la grilla del turnero. Las canchas son columnas y las horas son filas. Se navega por sede y fecha, con anterior, siguiente y Hoy.
- Seleccionar un turno abre su detalle al lado de la grilla, o debajo en pantallas chicas. Los formularios se abren desde el detalle cuando corresponde. La planilla masiva conserva la grilla visible durante la selección, la revisión y la confirmación.
- El portal muestra las reservas propias y presenta las demás ocupaciones como «No disponible». Administración puede distinguir reservas y bloqueos y operar sobre ellos.
- La sede y la fecha quedan en la URL para que se puedan compartir y recuperar con Atrás. Cambiar la sede limpia el turno seleccionado. Seleccionar, reservar, cancelar y bloquear actualizan la vista sin recargar la página. Si la ocupación o el precio cambian, se conserva el contexto y se ofrece revisar el turno actualizado.

Para conectar esta grilla, la API necesita devolver la agenda diaria de la sede, incluidas las ocupaciones con el nivel de detalle que corresponde a cada usuario. La consulta de disponibilidad por cancha sigue sirviendo para mostrar el precio y los horarios que se pueden reservar.

## Fuera de alcance

Planes, membresías, caja, clases, gestión de alumnos y profesores, feriados, auditoría, envío de correos y reportes.

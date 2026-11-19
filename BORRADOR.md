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

## Fuera de alcance

Planes, membresías, caja, clases, gestión de alumnos y profesores, feriados, auditoría, envío de correos y reportes.

.venv/bin/python backend/manage.py runserver 127.0.0.1:8001
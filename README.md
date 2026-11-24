# SHIFTS

SHIFTS convierte el proyecto TCGym en una base multiempresa para administrar agendas y recibir reservas online. El sistema usa React/Vite, Express y MySQL.

[Aplicación publicada](https://tcgym.vercel.app/)

## Flujos implementados

- Registro de un espacio y un propietario con plantillas para gimnasio, barbería, peluquería, estética, consultorios, tatuajes, clases y servicios generales.
- Aislamiento de consultas por organización mediante membresías.
- Panel responsive con resumen diario, clientes/cuentas, turnos y calendario.
- Catálogo editable de servicios con descripción, precio opcional, duración y capacidad.
- Horario semanal, zona horaria y política de cancelación configurables, con reglas adicionales por sucursal y profesional.
- Asociaciones entre profesionales y servicios, agenda por sede, y reserva de sede/profesional desde el portal y la cuenta del socio.
- Página de reservas por negocio en `/b/:slug`; el enlace se puede compartir desde el panel.
- Reservas públicas y de socios con revisión de disponibilidad en el servidor, cruce por duración completa, bloqueo transaccional por negocio y email con detalles de sede/profesional cuando Resend está configurado.
- Cancelación de reservas públicas con un enlace firmado y validación de la política del negocio.
- Recordatorios diarios de turnos para cada organización, usando su zona horaria, cuando se invoca el endpoint protegido por `CRON_SECRET` y Resend está configurado.
- Los turnos públicos se muestran en el panel junto a los turnos de cuentas existentes.
- Plantilla fitness con cupos grupales, asistencia y ficha de entrenamiento; plantillas de barbería, peluquería, estética y consultorio con catálogo de servicios, proveedores, agendas y sedes. El perfil muestra los campos físicos solo para gimnasios.

## Arquitectura

- `frontend/`: React, React Router, Vite, Tailwind CSS y FullCalendar.
- `backend/`: Express, JWT en cookie HttpOnly, MySQL, bcrypt y Resend.
- `backend/src/services/migrations.js`: migraciones incrementales y compatibles con las tablas de TCGym. Conserva los turnos existentes y les asigna la sede principal como ubicación inicial.
- `organizaciones`, `membresias`, `servicios`, `agenda_horarios`, `agenda_especifica`, `negocio_recursos`, `negocio_sucursales` y `turnos` separan la configuración por organización.

## Desarrollo local

1. Prepara una base MySQL.
2. Copia `backend/.env.example` como `backend/.env` y completa los valores localmente. No subas archivos `.env`.
3. En `backend/`, ejecuta `npm ci` y `npm start`.
4. En `frontend/`, ejecuta `npm ci` y `npm run dev`.

## Variables para Render

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: datos de conexión MySQL/Aiven.
- `JWT_SECRET`: secreto aleatorio, privado y distinto de los demás.
- `FRONTEND_ORIGINS`: origen(es) permitidos, por ejemplo `https://tcgym.vercel.app`.
- `FRONTEND_URL`: dirección pública de la aplicación; se usa en los enlaces de gestión de reservas. Si se omite, el backend conserva el dominio actual de Vercel como valor predeterminado.
- `RESEND_API_KEY` y `EMAIL_FROM`: habilitan confirmaciones y recordatorios por correo. Sin ellos las reservas funcionan, pero no se envían emails.
- `CRON_SECRET`: protege `GET /recordatorios`; debe coincidir con el header `x-secret` del cron.
- `UPLOAD_DIR`: directorio persistente para archivos. Render usa almacenamiento efímero si no se configura un disco.

Render debe instalar `backend/` y ejecutar `node server.js` (o usar `backend/` como raíz del servicio). Vercel debe compilar `frontend/`; `frontend/vercel.json` envía `/api` a Render y redirige las demás rutas a la aplicación React.

## Alcance pendiente

La agenda, sedes y proveedores son comunes a los rubros indicados; la operación avanzada de cada industria todavía requiere trabajo. Pendiente: planes y pagos recurrentes de gimnasio, reprogramación online, permisos configurables e invitaciones con aceptación, historial de auditoría, personalización de marca y políticas de cancelación por empleado o sucursal. Mercado Pago y WhatsApp no están conectados. Los precios son informativos y no procesan pagos. En consultorios no se guardan historias clínicas ni notas sensibles.

Las plantillas iniciales son editables; verificá horarios, cupos y precios antes de publicar el enlace de reservas.

## Secretos

El repositorio excluye los archivos `.env` actuales. Si alguna credencial estuvo en el historial de Git, revocala/cambiala en el proveedor y limpia el historial antes de redistribuir el repositorio.

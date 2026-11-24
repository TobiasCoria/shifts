# SHIFTS

SHIFTS convierte el proyecto TCGym en una base multiempresa para administrar agendas y recibir reservas online. El sistema usa React/Vite, Express y MySQL.

[Aplicación publicada](https://tcgym.vercel.app/)

## Flujos implementados

- Registro de un espacio y un propietario con plantillas para gimnasio, barbería, peluquería, estética, consultorios, tatuajes, clases y servicios generales.
- Aislamiento de consultas por organización mediante membresías.
- Panel responsive con resumen diario, clientes/cuentas, turnos y calendario.
- Catálogo editable de servicios con descripción, precio opcional, duración y capacidad.
- Horario semanal, zona horaria y política de cancelación configurables.
- Página de reservas por negocio en `/b/:slug`; el enlace se puede compartir desde el panel.
- Reserva pública con nombre y correo, revisión de disponibilidad en el servidor, bloqueo transaccional por negocio y email de confirmación cuando Resend está configurado.
- Cancelación de reservas públicas con un enlace firmado y validación de la política del negocio.
- Recordatorios diarios de turnos para cada organización, usando su zona horaria, cuando se invoca el endpoint protegido por `CRON_SECRET` y Resend está configurado.
- Los turnos públicos se muestran en el panel junto a los turnos de cuentas existentes.

## Arquitectura

- `frontend/`: React, React Router, Vite, Tailwind CSS y FullCalendar.
- `backend/`: Express, JWT en cookie HttpOnly, MySQL, bcrypt y Resend.
- `backend/src/services/migrations.js`: migraciones incrementales y compatibles con las tablas de TCGym. No borra los turnos existentes.
- `organizaciones`, `membresias`, `servicios`, `agenda_horarios`, `negocio_recursos` y `turnos` separan los datos por organización.

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

## Módulos siguientes

La base y los primeros flujos de agenda ya admiten varios rubros, pero todavía no es un SaaS completo con toda la operación de cada industria. Falta implementar asignación y disponibilidad individual de profesionales, sucursales, permisos configurables e invitaciones con aceptación, pagos/deudas y comisiones, reprogramación online, historial de auditoría, configuración de marca, módulos deportivos de membresías/planes/rutinas y políticas de cancelación por empleado o sucursal. Mercado Pago y WhatsApp todavía no están conectados. Los campos de precio son informativos: no procesan pagos.

Las plantillas iniciales son editables; verificá horarios, cupos y precios antes de publicar el enlace de reservas.

## Secretos

El repositorio excluye los archivos `.env` actuales. Si alguna credencial estuvo en el historial de Git, revocala/cambiala en el proveedor y limpia el historial antes de redistribuir el repositorio.

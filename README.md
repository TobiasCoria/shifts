# TCGym

Aplicación de gestión de gimnasio con interfaz para socios y administración, API y persistencia MySQL. Mi aporte abarca frontend, backend y base de datos.

[Acceso público](https://tcgym.vercel.app/)

## Funcionalidades verificadas en el código

- Registro y acceso con autenticación JWT.
- Consulta de disponibilidad, reservas y cancelaciones.
- Actualización de asistencia.
- Perfiles y vistas administrativas con validación de rol en endpoints protegidos.
- Calendario mediante FullCalendar.

## Tecnologías y estructura

- `frontend/`: React, Vite, React Router y Tailwind CSS.
- `backend/`: Node.js, Express, mysql2, JWT y bcryptjs; `server.js` como entrada.
- MySQL para usuarios y reservas.

La función `test` del backend actual es un placeholder; no se presenta como suite de pruebas aprobada.

## Desarrollo local

Preparar una base MySQL y configurar variables privadas fuera de Git. Desde `frontend/`: `npm ci` y `npm run dev`. Desde `backend/`: `npm ci` y `npm start`. Comprobar primero la ubicación esperada del archivo de entorno y la configuración de URL de API del frontend. No ejecutar con credenciales de producción.

Variables utilizadas por el backend: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. Preparar `.env.example` sin valores reales. Configurar servicios de correo solo en un entorno autorizado.

## Estado y límites

La revisión verificó estructura y rutas en código y pantallas públicas. No se probó el backend completo ni se ingresó a cuentas. Antes de usar este repositorio como referencia pública, revisar el archivo `.env` versionado y sanear secretos si corresponde.

## English

Gym management application with a React frontend, an Express API and MySQL persistence. My contribution covers frontend, backend and databases. Implemented workflows include member access, booking availability, reservations, cancellations and attendance. The public interface and source structure were reviewed; this is not a claim of a complete runtime or security audit.

# TCGym y agenda multi negocio

Aplicación de turnos con React, Express y MySQL. El primer espacio es TCGym, y el registro permite iniciar espacios para gimnasios, consultorios, peluquerías, clases y otros servicios.

[Acceso público](https://tcgym.vercel.app/)

## Funciones

- Acceso con cookie de sesión HttpOnly y permisos por membresía del espacio.
- Disponibilidad, reservas transaccionales, cancelaciones con anticipación configurable y correos de confirmación/cancelación.
- Agenda configurable por servicio, día, horario, intervalo, cupo y zona horaria.
- Panel de administración, métricas que usan la capacidad de la agenda y calendario.
- Perfil, rutinas PDF y fotos privadas detrás de una ruta autenticada.
- Plantillas de inicio para gimnasio, consultorio, peluquería, clases y servicios generales.

## Estructura

- `frontend/`: React, Vite, React Router, Tailwind CSS y FullCalendar.
- `backend/`: Node.js, Express, MySQL, JWT y bcrypt.
- `backend/src/services/migrations.js`: prepara el esquema existente al arrancar y asocia los usuarios/turnos previos con `tcgym` sin borrar sus datos.

## Desarrollo

Prepará una base MySQL y configurá variables privadas fuera de Git. En `backend/`, copiá `backend/.env.example` como `.env` y completá las variables locales. En `frontend/`, copiá `frontend/.env.example` como `.env` si el backend no corre en `localhost:3001`. Ejecutá `npm ci` y `npm start` en `backend/`, y `npm ci` y `npm run dev` en `frontend/`.

## Despliegue

En Render, configura `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y un `JWT_SECRET` nuevo. Agrega `FRONTEND_ORIGINS=https://tcgym.vercel.app`; `RESEND_API_KEY` y `EMAIL_FROM` habilitan correos. El rewrite de `/api` en `frontend/vercel.json` apunta a `https://tcgym.onrender.com`.

Render usa almacenamiento efímero por defecto. Para que rutinas y fotos persistan entre reinicios, adjuntá un disco persistente en `/var/data` y configurá `UPLOAD_DIR=/var/data/uploads`. El backend limita PDF a 10 MB e imágenes a 5 MB.

El registro crea un espacio y su administrador; las plantillas cargan una primera agenda editable desde Administración → Configuración. Hay tablas para invitar usuarios, pero el flujo de emisión y aceptación de invitaciones todavía no está implementado.

## Secretos en Git

`.env` y `frontend/.env` se retiraron del índice actual. Eso no elimina las versiones históricas: si alguna vez incluyeron credenciales, rotalas en Aiven/Render/correo y saneá el historial antes de volver público el repositorio.

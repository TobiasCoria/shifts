const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET) throw new Error('Falta la variable de entorno requerida: JWT_SECRET');

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'https://tcgym.vercel.app,http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
app.set('trust proxy', 1);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const index = entry.indexOf('=');
    return [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))];
  }));
  req.cookies = cookies;
  next();
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/turnos', require('./src/routes/turnos'));
app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/espacio', require('./src/routes/espacio'));

app.get('/', (req, res) => res.json({ mensaje: 'TCGym API funcionando' }));
app.get('/test-db', async (req, res) => {
  try { await require('./src/config/db').execute('SELECT 1'); res.json({ status: 'OK', message: 'Conexión a la base de datos disponible' }); }
  catch (err) { console.error('[test-db]', err.code || err.message); res.status(503).json({ status: 'ERROR', code: err.code || 'DB_CONNECTION_FAILED', message: 'No se pudo conectar a la base de datos' }); }
});

app.get('/recordatorios', async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers['x-secret'] !== process.env.CRON_SECRET) return res.status(401).json({ error: 'No autorizado' });
  try {
    const pool = require('./src/config/db');
    const { enviarRecordatorio } = require('./src/services/emailService');
    const { fechaLocal } = require('./src/utils/agenda');
    const [organizaciones] = await pool.execute('SELECT id, nombre, zona_horaria FROM organizaciones');
    const turnos = [];
    for (const organizacion of organizaciones) {
      const hoy = fechaLocal(organizacion.zona_horaria).fecha;
      const manana = new Date(Date.parse(`${hoy}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
      const [reservas] = await pool.execute(
        "SELECT t.*, COALESCE(t.nombre_cliente, u.nombre) AS nombre, COALESCE(t.email_cliente, u.email) AS email, s.nombre AS servicio FROM turnos t LEFT JOIN usuarios u ON u.id = t.usuario_id LEFT JOIN servicios s ON s.id = t.servicio_id WHERE t.organizacion_id = ? AND t.fecha = ? AND t.estado = 'reservado'",
        [organizacion.id, manana]
      );
      turnos.push(...reservas.map((turno) => ({ ...turno, negocio: organizacion.nombre })));
    }
    const resultados = await Promise.allSettled(turnos.map((turno) => enviarRecordatorio({ nombre: turno.nombre, email: turno.email }, turno, turno.negocio)));
    const enviados = resultados.filter((resultado) => resultado.status === 'fulfilled' && resultado.value === true).length;
    res.json({ mensaje: `${enviados} recordatorios enviados`, procesados: turnos.length });
  } catch (err) { console.error('[recordatorios]', err.code || err.message); res.status(500).json({ error: 'No se pudieron enviar los recordatorios' }); }
});

app.use((err, req, res, next) => {
  console.error('[api]', err.code || err.message);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo supera el tamaño permitido' });
  if (err.message === 'Formato no permitido' || err.message === 'Solo se permiten imágenes') return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Error del servidor' });
});

const PORT = process.env.PORT || 3001;
async function start() {
  await require('./src/services/migrations').migrar();
  app.listen(PORT, '0.0.0.0', () => console.log(`Servidor corriendo en puerto ${PORT}`));
}
start().catch((err) => { console.error('[startup] No se pudo preparar la base de datos:', err.code || err.message); process.exit(1); });

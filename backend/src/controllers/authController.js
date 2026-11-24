const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const cookieOptions = (req) => ({ httpOnly: true, secure: Boolean(req.secure || process.env.NODE_ENV === 'production'), sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 });
const datosUsuario = (u, org) => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: org.rol, organizacionId: org.organizacion_id, organizacion: org.organizacion_nombre, tipoNegocio: org.tipo_negocio, timezone: org.zona_horaria });

const login = async (req, res) => {
  const { email, documento, contrasena } = req.body || {};
  if ((!email && !documento) || typeof contrasena !== 'string' || !contrasena) return res.status(400).json({ error: 'Email o documento y contraseña son requeridos' });
  try {
    const campo = email ? 'email' : 'documento';
    const valor = email ? String(email).trim().toLowerCase() : String(documento).trim();
    const [rows] = await pool.execute(`SELECT * FROM usuarios WHERE ${campo} = ?`, [valor]);
    if (!rows.length || !(await bcrypt.compare(contrasena, rows[0].contrasena))) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const usuario = rows[0];
    const [orgs] = await pool.execute(
      `SELECT m.organizacion_id, m.rol, o.nombre AS organizacion_nombre, o.tipo_negocio, o.zona_horaria FROM membresias m JOIN organizaciones o ON o.id = m.organizacion_id WHERE m.usuario_id = ? AND m.estado = 'activo' ORDER BY m.organizacion_id LIMIT 1`,
      [usuario.id]
    );
    if (!orgs.length) return res.status(403).json({ error: 'La cuenta no pertenece a un espacio activo' });
    const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.cookie('tcgym_session', token, cookieOptions(req));
    res.json({ usuario: datosUsuario(usuario, orgs[0]) });
  } catch (err) { console.error('[auth.login]', err.code || err.message); res.status(500).json({ error: 'No se pudo iniciar sesión' }); }
};

const registro = async (req, res) => {
  const { nombre, apellido, email, documento, contrasena, negocio, tipoNegocio, zonaHoraria } = req.body || {};
  const emailLimpio = String(email || '').trim().toLowerCase();
  if (!nombre || !apellido || !emailLimpio || typeof contrasena !== 'string' || contrasena.length < 10 || !negocio || !['gimnasio', 'consultorio', 'peluqueria', 'clases', 'general'].includes(tipoNegocio)) {
    return res.status(400).json({ error: 'Completá nombre, apellido, correo, espacio, plantilla y una contraseña de al menos 10 caracteres' });
  }
  const connection = await pool.getConnection();
  try {
    const zona = zonaHoraria || 'America/Argentina/Buenos_Aires';
    try { new Intl.DateTimeFormat('en-US', { timeZone: zona }); } catch { return res.status(400).json({ error: 'Zona horaria inválida' }); }
    await connection.beginTransaction();
    const hash = await bcrypt.hash(contrasena, 12);
    const [created] = await connection.execute(
      'INSERT INTO usuarios (nombre, apellido, email, documento, contrasena, rol, organizacion_actual_id) VALUES (?,?,?,?,?,?,NULL)',
      [String(nombre).trim(), String(apellido).trim(), emailLimpio, documento ? String(documento).trim() : null, hash, 'admin']
    );
    const usuarioId = created.insertId;
    const nombreOrg = String(negocio).trim().slice(0, 150);
    const slug = `${nombreOrg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
    const [orgCreated] = await connection.execute(
      'INSERT INTO organizaciones (nombre, slug, tipo_negocio, zona_horaria) VALUES (?, ?, ?, ?)',
      [nombreOrg, slug, tipoNegocio, zona]
    );
    const orgId = orgCreated.insertId;
    await connection.execute("INSERT INTO membresias (organizacion_id, usuario_id, rol) VALUES (?, ?, 'admin')", [orgId, usuarioId]);
    await connection.execute('UPDATE usuarios SET organizacion_actual_id = ? WHERE id = ?', [orgId, usuarioId]);
    const plantillas = {
      gimnasio: [{ nombre: 'Entrenamiento libre', duracion: 60, capacidad: 10, inicio: '07:00', fin: '22:00', dias: [0, 1, 2, 3, 4, 5, 6] }],
      consultorio: [{ nombre: 'Consulta', duracion: 30, capacidad: 1, inicio: '09:00', fin: '18:00', dias: [0, 1, 2, 3, 4] }],
      peluqueria: [{ nombre: 'Turno de peluquería', duracion: 45, capacidad: 1, inicio: '09:00', fin: '19:00', dias: [0, 1, 2, 3, 4, 5] }],
      clases: [{ nombre: 'Clase grupal', duracion: 60, capacidad: 15, inicio: '08:00', fin: '21:00', dias: [0, 1, 2, 3, 4, 5] }],
      general: [{ nombre: 'Servicio', duracion: 60, capacidad: 1, inicio: '09:00', fin: '17:00', dias: [0, 1, 2, 3, 4] }],
    }[tipoNegocio];
    for (const plantilla of plantillas) {
      const [servicio] = await connection.execute('INSERT INTO servicios (organizacion_id, nombre, duracion_minutos, capacidad, activo) VALUES (?, ?, ?, ?, TRUE)', [orgId, plantilla.nombre, plantilla.duracion, plantilla.capacidad]);
      for (const dia of plantilla.dias) await connection.execute('INSERT INTO agenda_horarios (organizacion_id, servicio_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos, capacidad, activo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)', [orgId, servicio.insertId, dia, `${plantilla.inicio}:00`, `${plantilla.fin}:00`, plantilla.duracion, plantilla.capacidad]);
    }
    await connection.commit();
    res.status(201).json({ mensaje: 'Espacio creado. Ya podés iniciar sesión.' });
  } catch (err) {
    await connection.rollback();
    console.error('[auth.registro]', err.code || err.message);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ese correo o documento ya está registrado' });
    res.status(500).json({ error: 'No se pudo crear el espacio' });
  } finally { connection.release(); }
};

const sesion = async (req, res) => {
  const [rows] = await pool.execute('SELECT id, nombre, apellido, email FROM usuarios WHERE id = ?', [req.usuario.id]);
  const [orgs] = await pool.execute('SELECT m.organizacion_id, m.rol, o.nombre AS organizacion_nombre, o.tipo_negocio, o.zona_horaria FROM membresias m JOIN organizaciones o ON o.id = m.organizacion_id WHERE m.usuario_id = ? AND m.estado = \'activo\' ORDER BY m.organizacion_id LIMIT 1', [req.usuario.id]);
  if (!rows.length || !orgs.length) return res.status(401).json({ error: 'Sesión inválida' });
  res.json({ usuario: datosUsuario(rows[0], orgs[0]) });
};

const logout = (req, res) => { res.clearCookie('tcgym_session', cookieOptions(req)); res.json({ mensaje: 'Sesión cerrada' }); };

module.exports = { login, registro, sesion, logout };

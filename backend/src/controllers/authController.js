const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const cookieOptions = (req) => ({ httpOnly: true, secure: Boolean(req.secure || process.env.NODE_ENV === 'production'), sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 });
const datosUsuario = (u, org) => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: org.rol, organizacionId: org.organizacion_id, organizacion: org.organizacion_nombre, slug: org.slug, tipoNegocio: org.tipo_negocio, timezone: org.zona_horaria });

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
      `SELECT m.organizacion_id, m.rol, o.nombre AS organizacion_nombre, o.slug, o.tipo_negocio, o.zona_horaria FROM membresias m JOIN organizaciones o ON o.id = m.organizacion_id WHERE m.usuario_id = ? AND m.estado = 'activo' ORDER BY m.organizacion_id LIMIT 1`,
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
  if (!nombre || !apellido || !emailLimpio || typeof contrasena !== 'string' || contrasena.length < 10 || !negocio || !['gimnasio', 'barberia', 'peluqueria', 'estetica', 'consultorio', 'tatuajes', 'clases', 'general'].includes(tipoNegocio)) {
    return res.status(400).json({ error: 'Completá nombre, apellido, correo, espacio, plantilla y una contraseña de al menos 10 caracteres' });
  }
  const connection = await pool.getConnection();
  try {
    const zona = zonaHoraria || 'America/Argentina/Buenos_Aires';
    try { new Intl.DateTimeFormat('en-US', { timeZone: zona }); } catch { return res.status(400).json({ error: 'Zona horaria inválida' }); }
    await connection.beginTransaction();
    const nombreLimpio = String(nombre).trim().slice(0, 120);
    const apellidoLimpio = String(apellido).trim().slice(0, 120);
    const negocioLimpio = String(negocio).trim().slice(0, 150);
    if (nombreLimpio.length < 2 || apellidoLimpio.length < 2 || negocioLimpio.length < 2 || emailLimpio.length > 254) return res.status(400).json({ error: 'Revisá nombre, apellido, correo y negocio' });
    const hash = await bcrypt.hash(contrasena, 12);
    const [created] = await connection.execute(
      'INSERT INTO usuarios (nombre, apellido, email, documento, contrasena, rol, organizacion_actual_id) VALUES (?,?,?,?,?,?,NULL)',
      [nombreLimpio, apellidoLimpio, emailLimpio, documento ? String(documento).trim().slice(0, 30) : null, hash, 'admin']
    );
    const usuarioId = created.insertId;
    const nombreOrg = negocioLimpio;
    const slug = `${nombreOrg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
    const [orgCreated] = await connection.execute(
      'INSERT INTO organizaciones (nombre, slug, tipo_negocio, zona_horaria) VALUES (?, ?, ?, ?)',
      [nombreOrg, slug, tipoNegocio, zona]
    );
    const orgId = orgCreated.insertId;
    await connection.execute('INSERT INTO negocio_sucursales (organizacion_id, nombre) VALUES (?, ?)', [orgId, 'Sucursal principal']);
    await connection.execute("INSERT INTO membresias (organizacion_id, usuario_id, rol) VALUES (?, ?, 'admin')", [orgId, usuarioId]);
    await connection.execute('UPDATE usuarios SET organizacion_actual_id = ? WHERE id = ?', [orgId, usuarioId]);
    const plantillas = {
      gimnasio: { nombre: 'Entrenamiento libre', duracion: 60, capacidad: 10, inicio: '07:00', fin: '22:00', dias: [0, 1, 2, 3, 4, 5, 6] },
      consultorio: { nombre: 'Consulta', duracion: 30, capacidad: 1, inicio: '09:00', fin: '18:00', dias: [0, 1, 2, 3, 4] },
      barberia: { nombre: 'Corte de cabello', duracion: 30, capacidad: 1, inicio: '09:00', fin: '19:00', dias: [0, 1, 2, 3, 4, 5] },
      peluqueria: { nombre: 'Turno de peluquería', duracion: 45, capacidad: 1, inicio: '09:00', fin: '19:00', dias: [0, 1, 2, 3, 4, 5] },
      estetica: { nombre: 'Tratamiento', duracion: 60, capacidad: 1, inicio: '09:00', fin: '19:00', dias: [0, 1, 2, 3, 4, 5] },
      tatuajes: { nombre: 'Consulta de tatuaje', duracion: 60, capacidad: 1, inicio: '10:00', fin: '19:00', dias: [1, 2, 3, 4, 5, 6] },
      clases: { nombre: 'Clase grupal', duracion: 60, capacidad: 15, inicio: '08:00', fin: '21:00', dias: [0, 1, 2, 3, 4, 5] },
      general: { nombre: 'Servicio', duracion: 60, capacidad: 1, inicio: '09:00', fin: '17:00', dias: [0, 1, 2, 3, 4] },
    }[tipoNegocio];
    const [servicio] = await connection.execute('INSERT INTO servicios (organizacion_id, nombre, duracion_minutos, capacidad, activo) VALUES (?, ?, ?, ?, TRUE)', [orgId, plantillas.nombre, plantillas.duracion, plantillas.capacidad]);
    for (const dia of plantillas.dias) await connection.execute('INSERT INTO agenda_horarios (organizacion_id, servicio_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos, capacidad, activo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)', [orgId, servicio.insertId, dia, `${plantillas.inicio}:00`, `${plantillas.fin}:00`, plantillas.duracion, plantillas.capacidad]);
    await connection.commit();
    res.status(201).json({ mensaje: 'Espacio creado. Ya podés iniciar sesión.' });
  } catch (err) {
    await connection.rollback();
    console.error('[auth.registro]', err.code || err.message);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ese correo o documento ya está registrado' });
    res.status(500).json({ error: 'No se pudo crear el espacio' });
  } finally { connection.release(); }
};

const registroCliente = async (req, res) => {
  const { nombre, apellido, email, contrasena, slug: slugIngresado } = req.body || {};
  const emailLimpio = String(email || '').trim().toLowerCase();
  const slug = String(slugIngresado || '').trim().toLowerCase();
  if (!nombre || !apellido || !emailLimpio || typeof contrasena !== 'string' || contrasena.length < 10 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({ error: 'Completá tus datos, el enlace del local y una contraseña de al menos 10 caracteres' });
  }
  const nombreLimpio = String(nombre).trim().slice(0, 120);
  const apellidoLimpio = String(apellido).trim().slice(0, 120);
  if (nombreLimpio.length < 2 || apellidoLimpio.length < 2 || emailLimpio.length > 254) return res.status(400).json({ error: 'Revisá tu nombre, apellido y correo' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orgs] = await connection.execute('SELECT id, nombre AS organizacion_nombre, slug, tipo_negocio, zona_horaria FROM organizaciones WHERE slug = ? LIMIT 1', [slug]);
    if (!orgs.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'No encontramos ese local. Revisá el enlace que te compartieron.' });
    }
    const [existing] = await connection.execute('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [emailLimpio]);
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Iniciá sesión para entrar al local.' });
    }
    const hash = await bcrypt.hash(contrasena, 12);
    const [created] = await connection.execute(
      'INSERT INTO usuarios (nombre, apellido, email, documento, contrasena, rol, organizacion_actual_id) VALUES (?,?,?,?,?,?,?)',
      [nombreLimpio, apellidoLimpio, emailLimpio, null, hash, 'socio', orgs[0].id]
    );
    await connection.execute("INSERT INTO membresias (organizacion_id, usuario_id, rol) VALUES (?, ?, 'socio')", [orgs[0].id, created.insertId]);
    await connection.commit();
    const usuario = { id: created.insertId, nombre: nombreLimpio, apellido: apellidoLimpio, email: emailLimpio };
    const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.cookie('tcgym_session', token, cookieOptions(req));
    res.status(201).json({ usuario: datosUsuario(usuario, { ...orgs[0], rol: 'socio' }) });
  } catch (err) {
    await connection.rollback();
    console.error('[auth.registroCliente]', err.code || err.message);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Iniciá sesión para entrar al local.' });
    res.status(500).json({ error: 'No se pudo crear la cuenta' });
  } finally { connection.release(); }
};

const sesion = async (req, res) => {
  const [rows] = await pool.execute('SELECT id, nombre, apellido, email FROM usuarios WHERE id = ?', [req.usuario.id]);
  const [orgs] = await pool.execute('SELECT m.organizacion_id, m.rol, o.nombre AS organizacion_nombre, o.slug, o.tipo_negocio, o.zona_horaria FROM membresias m JOIN organizaciones o ON o.id = m.organizacion_id WHERE m.usuario_id = ? AND m.estado = \'activo\' ORDER BY m.organizacion_id LIMIT 1', [req.usuario.id]);
  if (!rows.length || !orgs.length) return res.status(401).json({ error: 'Sesión inválida' });
  res.json({ usuario: datosUsuario(rows[0], orgs[0]) });
};

const logout = (req, res) => { res.clearCookie('tcgym_session', cookieOptions(req)); res.json({ mensaje: 'Sesión cerrada' }); };

module.exports = { login, registro, registroCliente, sesion, logout };

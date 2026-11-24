const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verificarToken = async (req, res, next) => {
  const token = req.cookies?.tcgym_session || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sesión requerida' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      `SELECT m.organizacion_id, m.rol, o.zona_horaria,
       (SELECT id FROM servicios s WHERE s.organizacion_id = m.organizacion_id AND s.activo = 1 ORDER BY id LIMIT 1) AS servicio_id
       FROM membresias m JOIN organizaciones o ON o.id = m.organizacion_id
       WHERE m.usuario_id = ? AND m.estado = 'activo' ORDER BY m.organizacion_id LIMIT 1`,
      [decoded.id]
    );
    if (!rows.length) return res.status(403).json({ error: 'La cuenta no tiene un espacio activo' });
    req.usuario = { ...decoded, rol: rows[0].rol, organizacionId: rows[0].organizacion_id, timezone: rows[0].zona_horaria, servicioId: rows[0].servicio_id };
    next();
  } catch {
    res.clearCookie('tcgym_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

module.exports = { verificarToken, soloAdmin };

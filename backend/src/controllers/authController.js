const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  const { email, documento, contrasena } = req.body || {};

  if ((!email && !documento) || typeof contrasena !== 'string' || !contrasena) {
    return res.status(400).json({ error: 'Email o documento y contraseña son requeridos' });
  }

  try {
    let query, params;

    if (email) {
      query = 'SELECT * FROM usuarios WHERE email = ?';
      params = [email];
    } else if (documento) {
      query = 'SELECT * FROM usuarios WHERE documento = ?';
      params = [documento];
    } else {
      return res.status(400).json({ error: 'Email o documento requerido' });
    }

    const [rows] = await pool.execute(query, params);
    if (rows.length === 0)
      return res.status(401).json({ error: 'Usuario no encontrado' });

    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!passwordValida)
      return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    console.error('[auth.login] Falló el inicio de sesión:', err.code || err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const registro = async (req, res) => {
  const { nombre, apellido, email, documento, contrasena } = req.body || {};

  if (!nombre || !apellido || !email || !documento || typeof contrasena !== 'string' || contrasena.length < 6) {
    return res.status(400).json({ error: 'Completa los datos requeridos y usa una contraseña de al menos 6 caracteres' });
  }

  try {
    const hash = await bcrypt.hash(contrasena, 10);
    await pool.execute(
      'INSERT INTO usuarios (nombre, apellido, email, documento, contrasena) VALUES (?,?,?,?,?)',
      [nombre, apellido, email, documento, hash]
    );
    res.status(201).json({ mensaje: 'Usuario creado exitosamente' });
  } catch (err) {
    console.error('[auth.registro] Falló el registro:', err.code || err.message);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Email o documento ya registrado' });
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { login, registro };

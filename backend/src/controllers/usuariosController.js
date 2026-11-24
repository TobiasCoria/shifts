const pool = require('../config/db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

// ================= USUARIOS =================

const getUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.documento, m.rol, u.creado_en, 'cuenta' AS origen
       FROM usuarios u JOIN membresias m ON m.usuario_id = u.id AND m.organizacion_id = ? WHERE m.estado = 'activo'
       UNION ALL
       SELECT -CAST(MIN(t.id) AS SIGNED) AS id, MAX(t.nombre_cliente) AS nombre, '' AS apellido, LOWER(t.email_cliente) AS email, NULL AS documento, 'cliente' AS rol, MIN(CONCAT(DATE_FORMAT(t.fecha, '%Y-%m-%d'), ' ', TIME_FORMAT(t.hora, '%H:%i:%s'))) AS creado_en, 'reserva' AS origen
       FROM turnos t LEFT JOIN (SELECT u.id, u.email, m.organizacion_id FROM usuarios u JOIN membresias m ON m.usuario_id = u.id AND m.estado = 'activo') u ON LOWER(u.email) = LOWER(t.email_cliente) AND u.organizacion_id = t.organizacion_id
       WHERE t.organizacion_id = ? AND t.nombre_cliente IS NOT NULL AND t.email_cliente IS NOT NULL AND u.id IS NULL
       GROUP BY LOWER(t.email_cliente)
       ORDER BY nombre`, [req.usuario.organizacionId, req.usuario.organizacionId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const getMiPerfil = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
        id, nombre, apellido, email, documento, 
        peso, estatura, fecha_nacimiento, 
        rutina_archivo, foto_perfil
      FROM usuarios u JOIN membresias m ON m.usuario_id = u.id
      WHERE u.id = ? AND m.organizacion_id = ? AND m.estado = 'activo'`,
      [req.usuario.id, req.usuario.organizacionId]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

const actualizarPerfil = async (req, res) => {
  const { peso, estatura, fecha_nacimiento } = req.body;
  try {
    await pool.execute(
      'UPDATE usuarios SET peso = ?, estatura = ?, fecha_nacimiento = ? WHERE id = ? AND organizacion_actual_id = ?',
      [peso || null, estatura || null, fecha_nacimiento || null, req.usuario.id, req.usuario.organizacionId]
    );
    res.json({ mensaje: 'Perfil actualizado correctamente' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('DELETE FROM membresias WHERE organizacion_id = ? AND usuario_id = ?', [req.usuario.organizacionId, id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

// ================= RUTINA =================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'rutina_' + req.usuario.id + '_' + Date.now() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext) && file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Formato no permitido'));
  },
});

const subirRutina = [
  upload.single('rutina'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibio archivo' });

    try {
      await pool.execute('UPDATE usuarios SET rutina_archivo = ? WHERE id = ? AND organizacion_actual_id = ?', [req.file.filename, req.usuario.id, req.usuario.organizacionId]);

      res.json({ archivo: req.file.filename });
    } catch {
      res.status(500).json({ error: 'Error al guardar rutina' });
    }
  }
];

// ================= FOTO =================

const storageFoto = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'foto_' + req.usuario.id + '_' + Date.now() + ext);
  },
});

const uploadFoto = multer({
  storage: storageFoto,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext) && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

const subirFoto = [
  uploadFoto.single('foto'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

    try {
      // 🔎 buscar foto anterior
      const [rows] = await pool.execute(
        'SELECT foto_perfil FROM usuarios WHERE id = ? AND organizacion_actual_id = ?',
        [req.usuario.id, req.usuario.organizacionId]
      );

      const fotoAnterior = rows[0]?.foto_perfil;

      // 🗑️ borrar foto anterior
      if (fotoAnterior) {
        const ruta = path.join(uploadDir, path.basename(fotoAnterior));
        fs.unlink(ruta, () => {}); // silencioso
      }

      // 💾 guardar nueva
      await pool.execute(
        'UPDATE usuarios SET foto_perfil = ? WHERE id = ? AND organizacion_actual_id = ?',
        [req.file.filename, req.usuario.id, req.usuario.organizacionId]
      );

      res.json({ foto: req.file.filename });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
];

const cambiarContrasena = async (req, res) => {
  const { contrasena_actual, contrasena_nueva } = req.body;
  try {
    const [rows] = await pool.execute('SELECT contrasena FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const bcrypt = require('bcryptjs');
    const valida = await bcrypt.compare(contrasena_actual, rows[0].contrasena);
    if (!valida) return res.status(400).json({ error: 'La contraseña actual es incorrecta' });

    if (contrasena_nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

    const hash = await bcrypt.hash(contrasena_nueva, 10);
    await pool.execute('UPDATE usuarios SET contrasena = ? WHERE id = ?', [hash, req.usuario.id]);
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const verArchivo = async (req, res) => {
  const nombre = path.basename(req.params.filename);
  try {
    const [rows] = await pool.execute('SELECT u.foto_perfil, u.rutina_archivo FROM usuarios u JOIN membresias m ON m.usuario_id = u.id WHERE u.id = ? AND m.organizacion_id = ? AND m.estado = \'activo\'', [req.usuario.id, req.usuario.organizacionId]);
    if (!rows.length || ![rows[0].foto_perfil, rows[0].rutina_archivo].includes(nombre)) return res.status(404).json({ error: 'Archivo no encontrado' });
    const ruta = path.join(uploadDir, nombre);
    if (!ruta.startsWith(`${uploadDir}${path.sep}`)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(ruta, (err) => { if (err && !res.headersSent) res.status(err.statusCode === 404 ? 404 : 500).end(); });
  } catch { res.status(500).json({ error: 'No se pudo abrir el archivo' }); }
};

module.exports = { getUsuarios, getMiPerfil, actualizarPerfil, eliminarUsuario, subirRutina, subirFoto, cambiarContrasena, verArchivo };

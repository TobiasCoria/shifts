const pool = require('../config/db');

const obtener = async (req, res) => {
  try {
    const [organizaciones] = await pool.execute('SELECT id, nombre, tipo_negocio, zona_horaria, minutos_cancelacion FROM organizaciones WHERE id = ?', [req.usuario.organizacionId]);
    const [servicios] = await pool.execute('SELECT id, nombre, duracion_minutos, capacidad, activo FROM servicios WHERE organizacion_id = ? ORDER BY id', [req.usuario.organizacionId]);
    const [horarios] = await pool.execute('SELECT servicio_id, dia_semana, TIME_FORMAT(hora_inicio, \'%H:%i\') AS hora_inicio, TIME_FORMAT(hora_fin, \'%H:%i\') AS hora_fin, intervalo_minutos, capacidad, activo FROM horarios WHERE organizacion_id = ? ORDER BY dia_semana, hora_inicio', [req.usuario.organizacionId]);
    const [recursos] = await pool.execute('SELECT id, nombre, tipo, activo FROM recursos WHERE organizacion_id = ? ORDER BY id', [req.usuario.organizacionId]);
    res.json({ organizacion: organizaciones[0], servicios, horarios, recursos });
  } catch (err) { console.error('[espacio.obtener]', err.code || err.message); res.status(500).json({ error: 'No se pudo cargar la configuración' }); }
};

const actualizar = async (req, res) => {
  const { nombre, zonaHoraria, minutosCancelacion, servicio, horarios = [], recursos = [] } = req.body || {};
  if (!nombre?.trim() || !servicio?.nombre?.trim() || !Number.isInteger(Number(servicio.capacidad)) || Number(servicio.capacidad) < 1 || !Number.isInteger(Number(servicio.duracionMinutos)) || Number(servicio.duracionMinutos) < 5 || !Number.isInteger(Number(minutosCancelacion)) || Number(minutosCancelacion) < 0 || Number(minutosCancelacion) > 10080 || !Array.isArray(horarios) || !Array.isArray(recursos)) return res.status(400).json({ error: 'Revisá nombre, servicio, capacidad, duración y política de cancelación' });
  try { new Intl.DateTimeFormat('en-US', { timeZone: zonaHoraria }); } catch { return res.status(400).json({ error: 'Zona horaria inválida' }); }
  if (horarios.some((h) => !Number.isInteger(Number(h.dia)) || Number(h.dia) < 0 || Number(h.dia) > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.inicio || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.fin || '') || h.inicio >= h.fin || !Number.isInteger(Number(h.intervalo)) || Number(h.intervalo) < 5)) return res.status(400).json({ error: 'Hay días u horarios inválidos' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE organizaciones SET nombre = ?, zona_horaria = ?, minutos_cancelacion = ? WHERE id = ?', [nombre.trim().slice(0, 150), zonaHoraria, Number(minutosCancelacion), req.usuario.organizacionId]);
    let servicioId = Number(servicio.id) || 0;
    if (servicioId) {
      const [result] = await connection.execute('UPDATE servicios SET nombre = ?, duracion_minutos = ?, capacidad = ?, activo = TRUE WHERE id = ? AND organizacion_id = ?', [servicio.nombre.trim().slice(0, 120), Number(servicio.duracionMinutos), Number(servicio.capacidad), servicioId, req.usuario.organizacionId]);
      if (!result.affectedRows) throw new Error('Servicio no encontrado');
    } else {
      const [created] = await connection.execute('INSERT INTO servicios (organizacion_id, nombre, duracion_minutos, capacidad, activo) VALUES (?, ?, ?, ?, TRUE)', [req.usuario.organizacionId, servicio.nombre.trim().slice(0, 120), Number(servicio.duracionMinutos), Number(servicio.capacidad)]);
      servicioId = created.insertId;
    }
    await connection.execute('DELETE FROM horarios WHERE organizacion_id = ? AND servicio_id = ?', [req.usuario.organizacionId, servicioId]);
    for (const h of horarios) await connection.execute('INSERT INTO horarios (organizacion_id, servicio_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos, capacidad, activo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)', [req.usuario.organizacionId, servicioId, Number(h.dia), `${h.inicio}:00`, `${h.fin}:00`, Number(h.intervalo), Number(servicio.capacidad)]);
    for (const recurso of recursos) if (recurso.nombre?.trim()) {
      if (recurso.id) await connection.execute('UPDATE recursos SET nombre = ?, tipo = ? WHERE id = ? AND organizacion_id = ?', [recurso.nombre.trim().slice(0, 120), String(recurso.tipo || 'profesional').slice(0, 40), Number(recurso.id), req.usuario.organizacionId]);
      else await connection.execute('INSERT INTO recursos (organizacion_id, nombre, tipo, activo) VALUES (?, ?, ?, TRUE)', [req.usuario.organizacionId, recurso.nombre.trim().slice(0, 120), String(recurso.tipo || 'profesional').slice(0, 40)]);
    }
    await connection.commit();
    res.json({ mensaje: 'Configuración guardada' });
  } catch (err) {
    await connection.rollback();
    console.error('[espacio.actualizar]', err.code || err.message);
    res.status(err.message === 'Servicio no encontrado' ? 404 : 500).json({ error: err.message === 'Servicio no encontrado' ? err.message : 'No se pudo guardar la configuración' });
  } finally { connection.release(); }
};

module.exports = { obtener, actualizar };

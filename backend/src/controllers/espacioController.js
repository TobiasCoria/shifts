const pool = require('../config/db');

const obtener = async (req, res) => {
  try {
    const [organizaciones] = await pool.execute('SELECT id, nombre, slug, tipo_negocio, zona_horaria, minutos_cancelacion FROM organizaciones WHERE id = ?', [req.usuario.organizacionId]);
    const [servicios] = await pool.execute('SELECT id, nombre, descripcion, precio, duracion_minutos, capacidad, activo FROM servicios WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [req.usuario.organizacionId]);
    const [horarios] = await pool.execute('SELECT servicio_id, dia_semana, TIME_FORMAT(hora_inicio, \'%H:%i\') AS hora_inicio, TIME_FORMAT(hora_fin, \'%H:%i\') AS hora_fin, intervalo_minutos, capacidad, activo FROM agenda_horarios WHERE organizacion_id = ? ORDER BY dia_semana, hora_inicio', [req.usuario.organizacionId]);
    const [recursos] = await pool.execute('SELECT id, nombre, tipo, activo FROM negocio_recursos WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [req.usuario.organizacionId]);
    res.json({ organizacion: organizaciones[0], servicios, horarios, recursos });
  } catch (err) { console.error('[espacio.obtener]', err.code || err.message); res.status(500).json({ error: 'No se pudo cargar la configuración' }); }
};

const publico = async (req, res) => {
  try {
    const [orgRows] = await pool.execute('SELECT id, nombre, slug, tipo_negocio, zona_horaria FROM organizaciones WHERE slug = ?', [req.params.slug]);
    if (!orgRows.length) return res.status(404).json({ error: 'No encontramos ese negocio' });
    const organizacion = orgRows[0];
    const [servicios] = await pool.execute('SELECT id, nombre, descripcion, precio, duracion_minutos, capacidad FROM servicios WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [organizacion.id]);
    const [recursos] = await pool.execute("SELECT id, nombre, tipo FROM negocio_recursos WHERE organizacion_id = ? AND activo = TRUE ORDER BY id", [organizacion.id]);
    const [horarios] = await pool.execute("SELECT servicio_id, dia_semana, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, intervalo_minutos, capacidad FROM agenda_horarios WHERE organizacion_id = ? AND activo = TRUE ORDER BY dia_semana, hora_inicio", [organizacion.id]);
    res.json({ organizacion, servicios, recursos, horarios });
  } catch (err) { console.error('[espacio.publico]', err.code || err.message); res.status(500).json({ error: 'No se pudo cargar la página de reservas' }); }
};

const actualizar = async (req, res) => {
  const { nombre, tipoNegocio, zonaHoraria, minutosCancelacion, servicio, servicios = [], horarios = [], recursos = [] } = req.body || {};
  const catalogo = Array.isArray(servicios) && servicios.length ? servicios : [servicio];
  if (!nombre?.trim() || !['gimnasio', 'barberia', 'peluqueria', 'estetica', 'consultorio', 'tatuajes', 'clases', 'general'].includes(tipoNegocio) || !catalogo.every((item) => item?.nombre?.trim() && Number.isInteger(Number(item.capacidad)) && Number(item.capacidad) >= 1 && Number.isInteger(Number(item.duracionMinutos)) && Number(item.duracionMinutos) >= 5 && (item.precio === '' || item.precio == null || (Number.isFinite(Number(item.precio)) && Number(item.precio) >= 0))) || !Number.isInteger(Number(minutosCancelacion)) || Number(minutosCancelacion) < 0 || Number(minutosCancelacion) > 10080 || !Array.isArray(horarios) || !Array.isArray(recursos)) return res.status(400).json({ error: 'Revisá rubro, servicios, capacidad, duración, precios y política de cancelación' });
  try { new Intl.DateTimeFormat('en-US', { timeZone: zonaHoraria }); } catch { return res.status(400).json({ error: 'Zona horaria inválida' }); }
  if (horarios.some((h) => !Number.isInteger(Number(h.dia)) || Number(h.dia) < 0 || Number(h.dia) > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.inicio || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.fin || '') || h.inicio >= h.fin || !Number.isInteger(Number(h.intervalo)) || Number(h.intervalo) < 5)) return res.status(400).json({ error: 'Hay días u horarios inválidos' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE organizaciones SET nombre = ?, tipo_negocio = ?, zona_horaria = ?, minutos_cancelacion = ? WHERE id = ?', [nombre.trim().slice(0, 150), tipoNegocio, zonaHoraria, Number(minutosCancelacion), req.usuario.organizacionId]);
    const servicioIds = new Set();
    for (const item of catalogo) {
      let servicioId = Number(item.id) || 0;
      if (servicioId) {
        const [result] = await connection.execute('UPDATE servicios SET nombre = ?, descripcion = ?, precio = ?, duracion_minutos = ?, capacidad = ?, activo = TRUE WHERE id = ? AND organizacion_id = ?', [item.nombre.trim().slice(0, 120), String(item.descripcion || '').trim().slice(0, 500) || null, item.precio === '' || item.precio == null ? null : Number(item.precio), Number(item.duracionMinutos), Number(item.capacidad), servicioId, req.usuario.organizacionId]);
        if (!result.affectedRows) {
          const [exists] = await connection.execute('SELECT id FROM servicios WHERE id = ? AND organizacion_id = ?', [servicioId, req.usuario.organizacionId]);
          if (!exists.length) throw new Error('Servicio no encontrado');
        }
      } else {
        const [created] = await connection.execute('INSERT INTO servicios (organizacion_id, nombre, descripcion, precio, duracion_minutos, capacidad, activo) VALUES (?, ?, ?, ?, ?, ?, TRUE)', [req.usuario.organizacionId, item.nombre.trim().slice(0, 120), String(item.descripcion || '').trim().slice(0, 500) || null, item.precio === '' || item.precio == null ? null : Number(item.precio), Number(item.duracionMinutos), Number(item.capacidad)]);
        servicioId = created.insertId;
      }
      servicioIds.add(servicioId);
      await connection.execute('DELETE FROM agenda_horarios WHERE organizacion_id = ? AND servicio_id = ?', [req.usuario.organizacionId, servicioId]);
      for (const h of horarios) await connection.execute('INSERT INTO agenda_horarios (organizacion_id, servicio_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos, capacidad, activo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)', [req.usuario.organizacionId, servicioId, Number(h.dia), `${h.inicio}:00`, `${h.fin}:00`, Number(h.intervalo), Number(item.capacidad)]);
    }
    const [activos] = await connection.execute('SELECT id FROM servicios WHERE organizacion_id = ? AND activo = TRUE', [req.usuario.organizacionId]);
    const idsEnviados = new Set(servicioIds);
    const idsExistentes = new Set(activos.map((row) => Number(row.id)));
    for (const item of catalogo) if (item.id && !idsExistentes.has(Number(item.id))) throw new Error('Servicio no encontrado');
    for (const row of activos) if (!idsEnviados.has(Number(row.id))) await connection.execute('UPDATE servicios SET activo = FALSE WHERE id = ? AND organizacion_id = ?', [row.id, req.usuario.organizacionId]);
    const existentesRecursos = new Set();
    for (const recurso of recursos) if (recurso.nombre?.trim()) {
      if (recurso.id) existentesRecursos.add(Number(recurso.id));
      if (recurso.id) await connection.execute('UPDATE negocio_recursos SET nombre = ?, tipo = ?, activo = TRUE WHERE id = ? AND organizacion_id = ?', [recurso.nombre.trim().slice(0, 120), String(recurso.tipo || 'profesional').slice(0, 40), Number(recurso.id), req.usuario.organizacionId]);
      else await connection.execute('INSERT INTO negocio_recursos (organizacion_id, nombre, tipo, activo) VALUES (?, ?, ?, TRUE)', [req.usuario.organizacionId, recurso.nombre.trim().slice(0, 120), String(recurso.tipo || 'profesional').slice(0, 40)]);
    }
    const [recursosActivos] = await connection.execute('SELECT id FROM negocio_recursos WHERE organizacion_id = ? AND activo = TRUE', [req.usuario.organizacionId]);
    for (const row of recursosActivos) if (!existentesRecursos.has(Number(row.id))) await connection.execute('UPDATE negocio_recursos SET activo = FALSE WHERE id = ? AND organizacion_id = ?', [row.id, req.usuario.organizacionId]);
    await connection.commit();
    res.json({ mensaje: 'Configuración guardada' });
  } catch (err) {
    await connection.rollback();
    console.error('[espacio.actualizar]', err.code || err.message);
    res.status(err.message === 'Servicio no encontrado' ? 404 : 500).json({ error: ['Servicio no encontrado', 'Invalid service'].includes(err.message) ? 'Servicio no encontrado' : 'No se pudo guardar la configuración' });
  } finally { connection.release(); }
};

module.exports = { obtener, actualizar, publico };

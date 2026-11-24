const pool = require('../config/db');

const obtener = async (req, res) => {
  try {
    const orgId = req.usuario.organizacionId;
    const [[organizacion]] = await pool.execute('SELECT id, nombre, slug, tipo_negocio, zona_horaria, minutos_cancelacion FROM organizaciones WHERE id = ?', [orgId]);
    const [servicios] = await pool.execute('SELECT id, nombre, descripcion, precio, duracion_minutos, capacidad, activo FROM servicios WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [orgId]);
    const [horarios] = await pool.execute("SELECT servicio_id, dia_semana, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, intervalo_minutos, capacidad, activo FROM agenda_horarios WHERE organizacion_id = ? ORDER BY servicio_id, dia_semana, hora_inicio", [orgId]);
    const [recursos] = await pool.execute('SELECT r.id, r.nombre, r.tipo, r.activo, GROUP_CONCAT(DISTINCT sr.servicio_id) AS serviciosIds FROM negocio_recursos r LEFT JOIN servicio_recursos sr ON sr.recurso_id = r.id AND sr.organizacion_id = r.organizacion_id WHERE r.organizacion_id = ? AND r.activo = TRUE GROUP BY r.id ORDER BY r.id', [orgId]);
    const [sucursales] = await pool.execute('SELECT id, nombre, direccion, activo FROM negocio_sucursales WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [orgId]);
    const [horariosEspecificos] = await pool.execute("SELECT servicio_id, sucursal_id, recurso_id, dia_semana, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, intervalo_minutos FROM agenda_especifica WHERE organizacion_id = ? AND activo = TRUE ORDER BY servicio_id, sucursal_id, recurso_id, dia_semana, hora_inicio", [orgId]);
    const [sucursalRecursos] = await pool.execute('SELECT sucursal_id, recurso_id FROM sucursal_recursos WHERE organizacion_id = ?', [orgId]);
    res.json({ organizacion, servicios, horarios, recursos: recursos.map((r) => ({ ...r, serviciosIds: r.serviciosIds ? r.serviciosIds.split(',').map(Number) : [] })), sucursales, horariosEspecificos, sucursalRecursos });
  } catch (err) { console.error('[espacio.obtener]', err.code || err.message); res.status(500).json({ error: 'No se pudo cargar la configuración' }); }
};

const publico = async (req, res) => {
  try {
    const [orgRows] = await pool.execute('SELECT id, nombre, slug, tipo_negocio, zona_horaria FROM organizaciones WHERE slug = ?', [req.params.slug]);
    if (!orgRows.length) return res.status(404).json({ error: 'No encontramos ese negocio' });
    const organizacion = orgRows[0];
    const [servicios] = await pool.execute('SELECT id, nombre, descripcion, precio, duracion_minutos, capacidad FROM servicios WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [organizacion.id]);
    const [recursos] = await pool.execute('SELECT r.id, r.nombre, r.tipo, GROUP_CONCAT(DISTINCT sr.servicio_id) AS serviciosIds FROM negocio_recursos r LEFT JOIN servicio_recursos sr ON sr.recurso_id = r.id AND sr.organizacion_id = r.organizacion_id WHERE r.organizacion_id = ? AND r.activo = TRUE GROUP BY r.id ORDER BY r.nombre', [organizacion.id]);
    const [sucursales] = await pool.execute('SELECT id, nombre, direccion FROM negocio_sucursales WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [organizacion.id]);
    const [horarios] = await pool.execute("SELECT servicio_id, dia_semana, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, intervalo_minutos, capacidad FROM agenda_horarios WHERE organizacion_id = ? AND activo = TRUE ORDER BY dia_semana, hora_inicio", [organizacion.id]);
    res.json({ organizacion, servicios, recursos: recursos.map((r) => ({ ...r, serviciosIds: r.serviciosIds ? r.serviciosIds.split(',').map(Number) : [] })), sucursales, horarios });
  } catch (err) { console.error('[espacio.publico]', err.code || err.message); res.status(500).json({ error: 'No se pudo cargar la página de reservas' }); }
};

const validarReglas = (items) => Array.isArray(items) && items.every((h) => Number.isInteger(Number(h.dia)) && Number(h.dia) >= 0 && Number(h.dia) <= 6 && /^([01]\d|2[0-3]):[0-5]\d$/.test(h.inicio || '') && /^([01]\d|2[0-3]):[0-5]\d$/.test(h.fin || '') && h.inicio < h.fin && Number.isInteger(Number(h.intervalo)) && Number(h.intervalo) >= 5);

const actualizar = async (req, res) => {
  const { nombre, tipoNegocio, zonaHoraria, minutosCancelacion, servicios = [], horarios = [], recursos = [], sucursales = [] } = req.body || {};
  const tipos = ['gimnasio', 'barberia', 'peluqueria', 'estetica', 'consultorio', 'tatuajes', 'clases', 'general'];
  if (!nombre?.trim() || !tipos.includes(tipoNegocio) || !servicios.length || !servicios.every((s) => s?.nombre?.trim() && Number.isInteger(Number(s.capacidad)) && Number(s.capacidad) >= 1 && Number.isInteger(Number(s.duracionMinutos)) && Number(s.duracionMinutos) >= 5 && (s.precio === '' || s.precio == null || (Number.isFinite(Number(s.precio)) && Number(s.precio) >= 0))) || !Number.isInteger(Number(minutosCancelacion)) || Number(minutosCancelacion) < 0 || Number(minutosCancelacion) > 10080 || !validarReglas(horarios) || !Array.isArray(recursos) || !Array.isArray(sucursales) || !recursos.every((r) => r.nombre?.trim() && (r.horarios === undefined || validarReglas(r.horarios))) || !sucursales.every((b) => b.nombre?.trim() && (b.horarios === undefined || validarReglas(b.horarios)))) return res.status(400).json({ error: 'Revisá rubro, servicios, horarios y reglas de cancelación' });
  try { new Intl.DateTimeFormat('en-US', { timeZone: zonaHoraria }); } catch { return res.status(400).json({ error: 'Zona horaria inválida' }); }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const orgId = req.usuario.organizacionId;
    await connection.execute('UPDATE organizaciones SET nombre = ?, tipo_negocio = ?, zona_horaria = ?, minutos_cancelacion = ? WHERE id = ?', [nombre.trim().slice(0, 150), tipoNegocio, zonaHoraria, Number(minutosCancelacion), orgId]);
    const serviceIds = new Set();
    for (const item of servicios) {
      let id = Number(item.id) || 0;
      if (id) {
        await connection.execute('UPDATE servicios SET nombre = ?, descripcion = ?, precio = ?, duracion_minutos = ?, capacidad = ?, activo = TRUE WHERE id = ? AND organizacion_id = ?', [item.nombre.trim().slice(0, 120), String(item.descripcion || '').trim().slice(0, 500) || null, item.precio === '' || item.precio == null ? null : Number(item.precio), Number(item.duracionMinutos), Number(item.capacidad), id, orgId]);
        const [exists] = await connection.execute('SELECT id FROM servicios WHERE id = ? AND organizacion_id = ?', [id, orgId]);
        if (!exists.length) throw new Error('Servicio no encontrado');
      } else {
        const [created] = await connection.execute('INSERT INTO servicios (organizacion_id, nombre, descripcion, precio, duracion_minutos, capacidad, activo) VALUES (?, ?, ?, ?, ?, ?, TRUE)', [orgId, item.nombre.trim().slice(0, 120), String(item.descripcion || '').trim().slice(0, 500) || null, item.precio === '' || item.precio == null ? null : Number(item.precio), Number(item.duracionMinutos), Number(item.capacidad)]);
        id = created.insertId;
      }
      serviceIds.add(id);
      await connection.execute('DELETE FROM agenda_horarios WHERE organizacion_id = ? AND servicio_id = ?', [orgId, id]);
      for (const h of horarios) await connection.execute('INSERT INTO agenda_horarios (organizacion_id, servicio_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos, capacidad, activo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)', [orgId, id, Number(h.dia), `${h.inicio}:00`, `${h.fin}:00`, Number(h.intervalo), Number(item.capacidad)]);
    }
    const [existingServices] = await connection.execute('SELECT id FROM servicios WHERE organizacion_id = ? AND activo = TRUE', [orgId]);
    for (const row of existingServices) if (!serviceIds.has(Number(row.id))) await connection.execute('UPDATE servicios SET activo = FALSE WHERE id = ? AND organizacion_id = ?', [row.id, orgId]);

    const resourceIds = new Set();
    for (const r of recursos) {
      let id = Number(r.id) || 0;
      if (id) {
        await connection.execute('UPDATE negocio_recursos SET nombre = ?, tipo = ?, activo = TRUE WHERE id = ? AND organizacion_id = ?', [r.nombre.trim().slice(0, 120), String(r.tipo || 'profesional').slice(0, 40), id, orgId]);
        const [exists] = await connection.execute('SELECT id FROM negocio_recursos WHERE id = ? AND organizacion_id = ?', [id, orgId]);
        if (!exists.length) throw new Error('Recurso no encontrado');
      } else {
        const [created] = await connection.execute('INSERT INTO negocio_recursos (organizacion_id, nombre, tipo, activo) VALUES (?, ?, ?, TRUE)', [orgId, r.nombre.trim().slice(0, 120), String(r.tipo || 'profesional').slice(0, 40)]);
        id = created.insertId;
      }
      resourceIds.add(id);
      await connection.execute('DELETE FROM servicio_recursos WHERE organizacion_id = ? AND recurso_id = ?', [orgId, id]);
      const assignedServices = Array.isArray(r.serviciosIds) && r.serviciosIds.length ? r.serviciosIds.map(Number).filter((serviceId) => serviceIds.has(serviceId)) : [...serviceIds];
      for (const serviceId of assignedServices) await connection.execute('INSERT IGNORE INTO servicio_recursos (organizacion_id, servicio_id, recurso_id) VALUES (?, ?, ?)', [orgId, serviceId, id]);
      await connection.execute('DELETE FROM agenda_especifica WHERE organizacion_id = ? AND recurso_id = ? AND sucursal_id IS NULL', [orgId, id]);
      for (const serviceId of assignedServices) for (const h of r.horarios || []) await connection.execute('INSERT INTO agenda_especifica (organizacion_id, servicio_id, recurso_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos) VALUES (?, ?, ?, ?, ?, ?, ?)', [orgId, serviceId, id, Number(h.dia), `${h.inicio}:00`, `${h.fin}:00`, Number(h.intervalo)]);
    }
    const [currentResources] = await connection.execute('SELECT id FROM negocio_recursos WHERE organizacion_id = ? AND activo = TRUE', [orgId]);
    for (const row of currentResources) if (!resourceIds.has(Number(row.id))) await connection.execute('UPDATE negocio_recursos SET activo = FALSE WHERE id = ? AND organizacion_id = ?', [row.id, orgId]);

    const branchIds = new Set();
    for (const b of sucursales) {
      let id = Number(b.id) || 0;
      if (id) {
        await connection.execute('UPDATE negocio_sucursales SET nombre = ?, direccion = ?, activo = TRUE WHERE id = ? AND organizacion_id = ?', [b.nombre.trim().slice(0, 120), String(b.direccion || '').trim().slice(0, 255) || null, id, orgId]);
        const [exists] = await connection.execute('SELECT id FROM negocio_sucursales WHERE id = ? AND organizacion_id = ?', [id, orgId]);
        if (!exists.length) throw new Error('Sucursal no encontrada');
      } else {
        const [created] = await connection.execute('INSERT INTO negocio_sucursales (organizacion_id, nombre, direccion, activo) VALUES (?, ?, ?, TRUE)', [orgId, b.nombre.trim().slice(0, 120), String(b.direccion || '').trim().slice(0, 255) || null]);
        id = created.insertId;
      }
      branchIds.add(id);
      await connection.execute('DELETE FROM agenda_especifica WHERE organizacion_id = ? AND sucursal_id = ? AND recurso_id IS NULL', [orgId, id]);
      for (const serviceId of serviceIds) for (const h of b.horarios || []) await connection.execute('INSERT INTO agenda_especifica (organizacion_id, servicio_id, sucursal_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos) VALUES (?, ?, ?, ?, ?, ?, ?)', [orgId, serviceId, id, Number(h.dia), `${h.inicio}:00`, `${h.fin}:00`, Number(h.intervalo)]);
      for (const resourceId of resourceIds) await connection.execute('INSERT IGNORE INTO sucursal_recursos (organizacion_id, sucursal_id, recurso_id) VALUES (?, ?, ?)', [orgId, id, resourceId]);
    }
    if (!branchIds.size) throw new Error('Debe haber al menos una sucursal');
    const [currentBranches] = await connection.execute('SELECT id FROM negocio_sucursales WHERE organizacion_id = ? AND activo = TRUE', [orgId]);
    for (const row of currentBranches) if (!branchIds.has(Number(row.id))) await connection.execute('UPDATE negocio_sucursales SET activo = FALSE WHERE id = ? AND organizacion_id = ?', [row.id, orgId]);
    for (const branchId of branchIds) for (const resourceId of resourceIds) await connection.execute('INSERT IGNORE INTO sucursal_recursos (organizacion_id, sucursal_id, recurso_id) VALUES (?, ?, ?)', [orgId, branchId, resourceId]);
    await connection.commit();
    res.json({ mensaje: 'Configuración guardada' });
  } catch (err) {
    await connection.rollback();
    console.error('[espacio.actualizar]', err.code || err.message);
    const status = /no encontrado/.test(err.message) ? 404 : err.message === 'Debe haber al menos una sucursal' ? 400 : 500;
    res.status(status).json({ error: status === 404 ? err.message : status === 400 ? err.message : 'No se pudo guardar la configuración' });
  } finally { connection.release(); }
};

module.exports = { obtener, actualizar, publico };

const pool = require('../config/db');
const { enviarConfirmacionTurno, enviarConfirmacionEnNombreDe, enviarCancelacionTurno } = require('../services/emailService');
const { fechaLocal, validarFecha, horaEnMinutos } = require('../utils/agenda');
const jwt = require('jsonwebtoken');

const getTurnos = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, COALESCE(t.nombre_cliente, u.nombre) AS nombre, COALESCE(u.apellido, '') AS apellido, COALESCE(t.email_cliente, u.email) AS email, s.nombre AS servicio, r.nombre AS profesional,
       COALESCE((SELECT h.capacidad FROM agenda_horarios h WHERE h.organizacion_id = t.organizacion_id AND h.servicio_id = t.servicio_id AND h.dia_semana = WEEKDAY(t.fecha) AND TIME(t.hora) >= h.hora_inicio AND TIME(t.hora) < h.hora_fin ORDER BY h.id LIMIT 1), s.capacidad) AS capacidad
       FROM turnos t LEFT JOIN usuarios u ON t.usuario_id = u.id
       LEFT JOIN servicios s ON s.id = t.servicio_id
       LEFT JOIN negocio_recursos r ON r.id = t.recurso_id
       WHERE t.organizacion_id = ? ORDER BY t.fecha, t.hora`,
      [req.usuario.organizacionId]
    );
    res.json(rows);
  } catch (err) { console.error('[turnos.listar]', err.code || err.message); res.status(500).json({ error: 'No se pudieron cargar los turnos' }); }
};

const construirDisponibilidad = async (poolConn, org, service, fecha, horaActual = null, resourceId = null) => {
  const [horarios] = await poolConn.execute("SELECT TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, intervalo_minutos, capacidad FROM agenda_horarios WHERE organizacion_id = ? AND servicio_id = ? AND dia_semana = WEEKDAY(?) AND activo = TRUE ORDER BY hora_inicio", [org.id, service.id, fecha]);
  const [ocupados] = await poolConn.execute("SELECT TIME_FORMAT(hora, '%H:%i') AS hora, recurso_id, COUNT(*) AS ocupados FROM turnos WHERE organizacion_id = ? AND servicio_id = ? AND fecha = ? AND estado = 'reservado' GROUP BY hora, recurso_id", [org.id, service.id, fecha]);
  const [recursos] = await poolConn.execute('SELECT id, nombre FROM negocio_recursos WHERE organizacion_id = ? AND activo = TRUE ORDER BY nombre', [org.id]);
  const usaProfesionales = recursos.length > 0 && Number(service.capacidad) <= 1;
  const ahora = fechaLocal(org.zona_horaria);
  const slots = [];
  for (const h of horarios) {
    const inicio = horaEnMinutos(h.hora_inicio), fin = horaEnMinutos(h.hora_fin), intervalo = Number(h.intervalo_minutos) || 60;
    for (let m = inicio; m < fin; m += intervalo) {
      const hora = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      if (fecha < ahora.fecha || (fecha === ahora.fecha && m <= (horaActual ?? ahora.minutos))) continue;
      const reservas = ocupados.filter((row) => row.hora === hora);
      const reservasSinAsignar = reservas.filter((row) => row.recurso_id == null).reduce((suma, row) => suma + Number(row.ocupados), 0);
      if (usaProfesionales) {
        const ocupadosIds = new Set(reservas.filter((row) => row.recurso_id != null).map((row) => Number(row.recurso_id)));
        const disponibles = recursos.filter((recurso) => !ocupadosIds.has(Number(recurso.id)) && reservasSinAsignar === 0);
        const elegido = resourceId ? disponibles.filter((recurso) => Number(recurso.id) === Number(resourceId)) : disponibles;
        const lugares = resourceId ? 1 : recursos.length;
        const ocupacion = resourceId ? (disponibles.length ? 0 : 1) : recursos.length - disponibles.length;
        slots.push({ hora, ocupados: ocupacion, capacidad: lugares, disponible: elegido.length > 0, recursosDisponibles: disponibles.map((recurso) => ({ id: recurso.id, nombre: recurso.nombre })) });
      } else {
        const cantidad = reservas.reduce((suma, row) => suma + Number(row.ocupados), 0);
        const capacidad = Number(h.capacidad || service.capacidad);
        slots.push({ hora, ocupados: cantidad, capacidad, disponible: cantidad < capacidad, recursosDisponibles: [] });
      }
    }
  }
  return slots;
};

const getMisTurnos = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT t.*, s.nombre AS servicio FROM turnos t LEFT JOIN servicios s ON s.id = t.servicio_id WHERE t.usuario_id = ? AND t.organizacion_id = ? ORDER BY t.fecha, t.hora',
      [req.usuario.id, req.usuario.organizacionId]
    );
    res.json(rows);
  } catch (err) { console.error('[turnos.mios]', err.code || err.message); res.status(500).json({ error: 'No se pudieron cargar tus turnos' }); }
};

const crearTurno = async (req, res) => {
  const { fecha, hora, servicioId } = req.body || {};
  const organizationId = req.usuario.organizacionId;
  const timezone = req.usuario.timezone || process.env.BUSINESS_TIMEZONE || 'America/Argentina/Buenos_Aires';
  if (!validarFecha(fecha) || !/^\d{2}:\d{2}(:\d{2})?$/.test(hora || '')) return res.status(400).json({ error: 'Fecha u horario inválido' });
  const horaSql = hora.length === 5 ? `${hora}:00` : hora;
  const ahora = fechaLocal(timezone);
  const idServicio = Number(servicioId || req.usuario.servicioId);
  if (!Number.isInteger(idServicio)) return res.status(400).json({ error: 'Seleccioná un servicio' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orgRows] = await connection.execute('SELECT zona_horaria FROM organizaciones WHERE id = ?', [organizationId]);
    const timezoneOrg = orgRows[0]?.zona_horaria || timezone;
    const ahoraOrg = fechaLocal(timezoneOrg);
    if (fecha < ahoraOrg.fecha) { await connection.rollback(); return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' }); }
    const [servicios] = await connection.execute(
      'SELECT id, nombre, capacidad, activo FROM servicios WHERE id = ? AND organizacion_id = ? FOR UPDATE',
      [idServicio, organizationId]
    );
    const servicio = servicios[0];
    if (!servicio || !servicio.activo) { await connection.rollback(); return res.status(400).json({ error: 'El servicio no está disponible' }); }
    const [horarios] = await connection.execute(
      `SELECT id, hora_inicio, hora_fin, intervalo_minutos, capacidad
       FROM agenda_horarios WHERE organizacion_id = ? AND servicio_id = ? AND dia_semana = WEEKDAY(?) AND activo = 1`,
      [organizationId, idServicio, fecha]
    );
    const minuto = horaEnMinutos(horaSql);
    const horario = horarios.find((h) => {
      const inicio = horaEnMinutos(h.hora_inicio), fin = horaEnMinutos(h.hora_fin);
      const intervalo = Number(h.intervalo_minutos) || 60;
      return minuto >= inicio && minuto < fin && (minuto - inicio) % intervalo === 0;
    });
    if (!horario) { await connection.rollback(); return res.status(400).json({ error: 'Ese horario no está habilitado para el servicio' }); }
    if (fecha === ahoraOrg.fecha && minuto <= ahoraOrg.minutos) { await connection.rollback(); return res.status(400).json({ error: 'No se puede reservar un horario que ya pasó' }); }
    await connection.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [req.usuario.id]);
    const [existentes] = await connection.execute(
      "SELECT id FROM turnos WHERE usuario_id = ? AND organizacion_id = ? AND fecha = ? AND estado = 'reservado' FOR UPDATE",
      [req.usuario.id, organizationId, fecha]
    );
    if (existentes.length) { await connection.rollback(); return res.status(409).json({ error: 'Ya tenés un turno reservado para ese día' }); }
    const [ocupados] = await connection.execute(
      "SELECT COUNT(*) AS total FROM turnos WHERE organizacion_id = ? AND servicio_id = ? AND fecha = ? AND hora = ? AND estado = 'reservado'",
      [organizationId, idServicio, fecha, horaSql]
    );
    const capacidad = Number(horario.capacidad || servicio.capacidad);
    if (Number(ocupados[0].total) >= capacidad) { await connection.rollback(); return res.status(409).json({ error: 'Ese horario está completo' }); }
    const [insertado] = await connection.execute(
      "INSERT INTO turnos (usuario_id, fecha, hora, organizacion_id, servicio_id, estado) VALUES (?, ?, ?, ?, ?, 'reservado')",
      [req.usuario.id, fecha, horaSql, organizationId, idServicio]
    );
    await connection.commit();
    const [usuarios] = await pool.execute('SELECT nombre, email FROM usuarios WHERE id = ?', [req.usuario.id]);
    void enviarConfirmacionTurno(usuarios[0], { fecha, hora: horaSql, servicio: servicio.nombre });
    res.status(201).json({ mensaje: 'Turno reservado correctamente', id: insertado.insertId });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('[turnos.crear]', err.code || err.message);
    res.status(500).json({ error: 'No se pudo reservar el turno' });
  } finally { if (connection) connection.release(); }
};

const crearTurnoPublico = async (req, res) => {
  const { organizacionSlug, servicioId, fecha, hora, nombre, email, recursoId } = req.body || {};
  const nombreCliente = String(nombre || '').trim().slice(0, 120);
  const emailCliente = String(email || '').trim().toLowerCase().slice(0, 254);
  if (!organizacionSlug || !Number.isInteger(Number(servicioId)) || !validarFecha(fecha) || !/^\d{2}:\d{2}$/.test(hora || '') || nombreCliente.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCliente)) return res.status(400).json({ error: 'Completá nombre, correo y un horario válido' });
  if (horaEnMinutos(hora) >= 1440) return res.status(400).json({ error: 'El horario no es válido' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orgRows] = await connection.execute('SELECT id, nombre, zona_horaria, minutos_cancelacion FROM organizaciones WHERE slug = ? FOR UPDATE', [String(organizacionSlug).slice(0, 180)]);
    if (!orgRows.length) { await connection.rollback(); return res.status(404).json({ error: 'No encontramos ese negocio' }); }
    const org = orgRows[0];
    const [services] = await connection.execute('SELECT id, nombre, capacidad, activo FROM servicios WHERE id = ? AND organizacion_id = ? FOR UPDATE', [Number(servicioId), org.id]);
    const service = services[0];
    if (!service || !service.activo) { await connection.rollback(); return res.status(404).json({ error: 'Ese servicio ya no está disponible' }); }
    const [recursos] = await connection.execute('SELECT id FROM negocio_recursos WHERE organizacion_id = ? AND activo = TRUE ORDER BY nombre', [org.id]);
    const usaProfesionales = recursos.length > 0 && Number(service.capacidad) <= 1;
    if (recursoId && (!usaProfesionales || !recursos.some((recurso) => Number(recurso.id) === Number(recursoId)))) { await connection.rollback(); return res.status(400).json({ error: 'Ese profesional no está disponible para este servicio' }); }
    const ahoraBloqueado = fechaLocal(org.zona_horaria);
    if (fecha < ahoraBloqueado.fecha || (fecha === ahoraBloqueado.fecha && horaEnMinutos(hora) <= ahoraBloqueado.minutos)) { await connection.rollback(); return res.status(400).json({ error: 'Elegí un horario que siga estando en el futuro' }); }
    const slots = await construirDisponibilidad(connection, org, service, fecha, ahoraBloqueado.minutos, recursoId || null);
    const seleccionado = slots.find((slot) => slot.hora === hora);
    if (!seleccionado) { await connection.rollback(); return res.status(400).json({ error: 'Ese horario no está disponible' }); }
    if (!seleccionado.disponible) { await connection.rollback(); return res.status(409).json({ error: 'Ese horario acaba de ocuparse; elegí otro' }); }
    const recursoAsignado = usaProfesionales ? (recursoId ? Number(recursoId) : Number(seleccionado.recursosDisponibles[0]?.id)) : null;
    if (usaProfesionales && !recursoAsignado) { await connection.rollback(); return res.status(409).json({ error: 'Ese horario acaba de ocuparse; elegí otro' }); }
    const [insertado] = await connection.execute("INSERT INTO turnos (usuario_id, fecha, hora, organizacion_id, servicio_id, estado, nombre_cliente, email_cliente, recurso_id) VALUES (NULL, ?, ?, ?, ?, 'reservado', ?, ?, ?)", [fecha, `${hora}:00`, org.id, service.id, nombreCliente, emailCliente, recursoAsignado]);
    await connection.commit();
    const tokenCancelar = jwt.sign({ turnoId: insertado.insertId, organizacionId: org.id }, process.env.JWT_SECRET, { expiresIn: '365d' });
    const baseFrontend = (process.env.FRONTEND_URL || 'https://tcgym.vercel.app').replace(/\/+$/, '');
    const urlCancelar = `${baseFrontend}/cancelar/${tokenCancelar}`;
    const profesional = usaProfesionales ? recursos.find((recurso) => Number(recurso.id) === recursoAsignado) : null;
    void enviarConfirmacionEnNombreDe({ nombre: nombreCliente, email: emailCliente }, { fecha, hora: `${hora}:00`, servicio: service.nombre, profesional: profesional?.nombre }, org.nombre, urlCancelar, org.minutos_cancelacion);
    return res.status(201).json({ mensaje: 'Reserva confirmada', id: insertado.insertId, profesional: profesional?.nombre || null, minutosCancelacion: Number(org.minutos_cancelacion), urlCancelar });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('[turnos.publico]', err.code || err.message);
    return res.status(500).json({ error: 'No se pudo confirmar la reserva' });
  } finally { if (connection) connection.release(); }
};

const gestionarTurnoPublico = async (req, res) => {
  const { accion } = req.body || {};
  let claims;
  try { claims = jwt.verify(req.params.token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'El enlace de gestión venció o no es válido' }); }
  if (!['cancelar'].includes(accion)) return res.status(400).json({ error: 'Acción no disponible' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orgRows] = await connection.execute('SELECT id FROM organizaciones WHERE id = ? FOR UPDATE', [claims.organizacionId]);
    if (!orgRows.length) { await connection.rollback(); return res.status(404).json({ error: 'No encontramos el negocio' }); }
    const [rows] = await connection.execute("SELECT t.id, t.fecha, t.hora, t.estado, t.email_cliente, o.nombre AS negocio, o.zona_horaria, o.minutos_cancelacion FROM turnos t JOIN organizaciones o ON o.id = t.organizacion_id WHERE t.id = ? AND t.organizacion_id = ? AND t.usuario_id IS NULL AND t.nombre_cliente IS NOT NULL", [claims.turnoId, claims.organizacionId]);
    const turno = rows[0];
    if (!turno) { await connection.rollback(); return res.status(404).json({ error: 'No encontramos la reserva' }); }
    if (turno.estado !== 'reservado') { await connection.rollback(); return res.status(409).json({ error: 'La reserva ya fue actualizada' }); }
    const hoy = fechaLocal(turno.zona_horaria);
    const dias = Math.round((Date.parse(`${String(turno.fecha).slice(0, 10)}T12:00:00Z`) - Date.parse(`${hoy.fecha}T12:00:00Z`)) / 86400000);
    const restantes = dias * 1440 + horaEnMinutos(turno.hora) - hoy.minutos;
    if (restantes <= 0 || restantes < Number(turno.minutos_cancelacion)) { await connection.rollback(); return res.status(400).json({ error: `La política del negocio requiere ${turno.minutos_cancelacion} minutos de anticipación` }); }
    const [result] = await connection.execute("UPDATE turnos SET estado = 'cancelado' WHERE id = ? AND organizacion_id = ? AND usuario_id IS NULL AND estado = 'reservado' AND nombre_cliente IS NOT NULL", [turno.id, claims.organizacionId]);
    if (!result.affectedRows) { await connection.rollback(); return res.status(409).json({ error: 'La reserva ya fue actualizada' }); }
    await connection.commit();
    void enviarCancelacionTurno({ nombre: 'Cliente', email: turno.email_cliente }, turno);
    return res.json({ mensaje: 'Reserva cancelada correctamente' });
  } catch (err) { if (connection) await connection.rollback().catch(() => {}); console.error('[turnos.publico.gestionar]', err.code || err.message); return res.status(500).json({ error: 'No se pudo cancelar la reserva' }); }
  finally { if (connection) connection.release(); }
};

const cancelarTurno = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT t.id, t.fecha, t.hora, t.estado, u.nombre, u.email, o.zona_horaria, o.minutos_cancelacion FROM turnos t JOIN usuarios u ON u.id = t.usuario_id JOIN organizaciones o ON o.id = t.organizacion_id WHERE t.id = ? AND t.usuario_id = ? AND t.organizacion_id = ? AND t.nombre_cliente IS NULL",
      [req.params.id, req.usuario.id, req.usuario.organizacionId]
    );
    const turno = rows[0];
    if (!turno) return res.status(404).json({ error: 'No encontramos ese turno' });
    if (turno.estado !== 'reservado') return res.status(409).json({ error: 'El turno ya no está reservado' });
    const hoy = fechaLocal(turno.zona_horaria);
    const distanciaDias = Math.round((Date.parse(`${turno.fecha}T12:00:00Z`) - Date.parse(`${hoy.fecha}T12:00:00Z`)) / 86400000);
    const minutosRestantes = distanciaDias * 1440 + horaEnMinutos(turno.hora) - hoy.minutos;
    if (minutosRestantes <= 0 || minutosRestantes < Number(turno.minutos_cancelacion)) {
      return res.status(400).json({ error: `La política de cancelación requiere al menos ${turno.minutos_cancelacion} minutos de anticipación` });
    }
    const [result] = await pool.execute("UPDATE turnos SET estado = 'cancelado' WHERE id = ? AND usuario_id = ? AND organizacion_id = ? AND estado = 'reservado'", [turno.id, req.usuario.id, req.usuario.organizacionId]);
    if (!result.affectedRows) return res.status(409).json({ error: 'El turno ya fue actualizado' });
    void enviarCancelacionTurno({ nombre: turno.nombre, email: turno.email }, turno);
    res.json({ mensaje: 'Turno cancelado' });
  } catch (err) { console.error('[turnos.cancelar]', err.code || err.message); res.status(500).json({ error: 'No se pudo cancelar el turno' }); }
};

const getDisponibilidad = async (req, res) => {
  const { fecha, servicioId } = req.query;
  const organizationId = req.usuario.organizacionId;
  if (!validarFecha(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  try {
    const [servicios] = await pool.execute('SELECT id, nombre, capacidad FROM servicios WHERE organizacion_id = ? AND activo = 1 ORDER BY id', [organizationId]);
    const idServicio = Number(servicioId || req.usuario.servicioId || servicios[0]?.id);
    const servicio = servicios.find((s) => Number(s.id) === idServicio);
    if (!servicio) return res.status(404).json({ error: 'No hay servicios disponibles' });
    const [horarios] = await pool.execute(
      `SELECT TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin,
       intervalo_minutos, capacidad FROM agenda_horarios WHERE organizacion_id = ? AND servicio_id = ? AND dia_semana = WEEKDAY(?) AND activo = 1 ORDER BY hora_inicio`,
      [organizationId, idServicio, fecha]
    );
    const [ocupados] = await pool.execute(
      "SELECT TIME_FORMAT(hora, '%H:%i') AS hora, COUNT(*) AS ocupados FROM turnos WHERE organizacion_id = ? AND servicio_id = ? AND fecha = ? AND estado = 'reservado' GROUP BY hora",
      [organizationId, idServicio, fecha]
    );
    const [org] = await pool.execute('SELECT zona_horaria FROM organizaciones WHERE id = ?', [organizationId]);
    const ahora = fechaLocal(org[0].zona_horaria);
    const slots = [];
    for (const h of horarios) {
      const inicio = horaEnMinutos(h.hora_inicio), fin = horaEnMinutos(h.hora_fin), intervalo = Number(h.intervalo_minutos) || 60;
      for (let m = inicio; m < fin; m += intervalo) {
        const hora = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        if (fecha < ahora.fecha || (fecha === ahora.fecha && m <= ahora.minutos)) continue;
        const ocupacion = Number(ocupados.find((o) => o.hora === hora)?.ocupados || 0);
        slots.push({ hora, ocupados: ocupacion, capacidad: Number(h.capacidad || servicio.capacidad), disponible: ocupacion < Number(h.capacidad || servicio.capacidad) });
      }
    }
    res.json({ servicio, servicios, slots, zonaHoraria: org[0].zona_horaria });
  } catch (err) { console.error('[turnos.disponibilidad]', err.code || err.message); res.status(500).json({ error: 'No se pudo consultar disponibilidad' }); }
};

const getDisponibilidadPublica = async (req, res) => {
  const { slug, fecha, servicioId, recursoId } = req.query;
  if (!slug || !validarFecha(fecha) || !Number.isInteger(Number(servicioId))) return res.status(400).json({ error: 'Negocio, servicio o fecha inválidos' });
  if (recursoId != null && (!Number.isInteger(Number(recursoId)) || Number(recursoId) < 1)) return res.status(400).json({ error: 'Profesional inválido' });
  try {
    const [orgRows] = await pool.execute('SELECT id, zona_horaria FROM organizaciones WHERE slug = ?', [String(slug).slice(0, 180)]);
    if (!orgRows.length) return res.status(404).json({ error: 'No encontramos ese negocio' });
    const org = orgRows[0];
    const [services] = await pool.execute('SELECT id, capacidad FROM servicios WHERE id = ? AND organizacion_id = ? AND activo = TRUE', [Number(servicioId), org.id]);
    if (!services.length) return res.status(404).json({ error: 'No encontramos ese servicio' });
    const service = services[0];
    const slots = await construirDisponibilidad(pool, org, service, fecha, null, recursoId || null);
    res.json({ slots });
  } catch (err) { console.error('[turnos.disponibilidad_publica]', err.code || err.message); res.status(500).json({ error: 'No se pudo consultar disponibilidad' }); }
};

const marcarAsistencia = async (req, res) => {
  const { estado } = req.body || {};
  if (!['reservado', 'completado', 'ausente', 'cancelado'].includes(estado)) return res.status(400).json({ error: 'Estado no permitido' });
  try {
    const [turnos] = await pool.execute("SELECT t.nombre_cliente, t.email_cliente, u.nombre AS nombre_usuario, u.email AS email_usuario, t.fecha, t.hora FROM turnos t LEFT JOIN usuarios u ON u.id = t.usuario_id WHERE t.id = ? AND t.organizacion_id = ?", [req.params.id, req.usuario.organizacionId]);
    if (!turnos.length) return res.status(404).json({ error: 'Turno no encontrado' });
    const [result] = await pool.execute('UPDATE turnos SET estado = ? WHERE id = ? AND organizacion_id = ? AND estado = \'reservado\'', [estado, req.params.id, req.usuario.organizacionId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Turno no encontrado' });
    if (estado === 'cancelado' && turnos[0].nombre_cliente && turnos[0].email_cliente) void enviarCancelacionTurno({ nombre: turnos[0].nombre_cliente, email: turnos[0].email_cliente }, turnos[0]);
    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) { console.error('[turnos.estado]', err.code || err.message); res.status(500).json({ error: 'No se pudo actualizar el estado' }); }
};

const getCapacidadDia = async (req, res) => {
  const { fecha } = req.query;
  if (!validarFecha(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  try {
    const [rows] = await pool.execute(
      `SELECT COALESCE(SUM(CEIL(TIMESTAMPDIFF(MINUTE, h.hora_inicio, h.hora_fin) / h.intervalo_minutos) * COALESCE(h.capacidad, s.capacidad)), 0) AS capacidad
       FROM agenda_horarios h JOIN servicios s ON s.id = h.servicio_id
       WHERE h.organizacion_id = ? AND s.activo = 1 AND h.activo = 1 AND h.dia_semana = WEEKDAY(?)`,
      [req.usuario.organizacionId, fecha]
    );
    res.json({ capacidad: Number(rows[0].capacidad) });
  } catch (err) { console.error('[turnos.capacidad]', err.code || err.message); res.status(500).json({ error: 'No se pudo calcular la capacidad' }); }
};

module.exports = { getTurnos, getMisTurnos, crearTurno, crearTurnoPublico, gestionarTurnoPublico, cancelarTurno, getDisponibilidad, getDisponibilidadPublica, marcarAsistencia, getCapacidadDia };

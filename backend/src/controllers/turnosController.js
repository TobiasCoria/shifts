const pool = require('../config/db');
const { enviarConfirmacionTurno, enviarConfirmacionEnNombreDe, enviarCancelacionTurno } = require('../services/emailService');
const { fechaLocal, validarFecha, horaEnMinutos } = require('../utils/agenda');
const jwt = require('jsonwebtoken');

const getTurnos = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, COALESCE(t.nombre_cliente, u.nombre) AS nombre, COALESCE(u.apellido, '') AS apellido, COALESCE(t.email_cliente, u.email) AS email, s.nombre AS servicio, r.nombre AS profesional, b.nombre AS sucursal,
       COALESCE((SELECT h.capacidad FROM agenda_horarios h WHERE h.organizacion_id = t.organizacion_id AND h.servicio_id = t.servicio_id AND h.dia_semana = WEEKDAY(t.fecha) AND TIME(t.hora) >= h.hora_inicio AND TIME(t.hora) < h.hora_fin ORDER BY h.id LIMIT 1), s.capacidad) AS capacidad
       FROM turnos t LEFT JOIN usuarios u ON t.usuario_id = u.id
       LEFT JOIN servicios s ON s.id = t.servicio_id
       LEFT JOIN negocio_recursos r ON r.id = t.recurso_id
       LEFT JOIN negocio_sucursales b ON b.id = t.sucursal_id
       WHERE t.organizacion_id = ? ORDER BY t.fecha, t.hora`,
      [req.usuario.organizacionId]
    );
    res.json(rows);
  } catch (err) { console.error('[turnos.listar]', err.code || err.message); res.status(500).json({ error: 'No se pudieron cargar los turnos' }); }
};

const minutosFin = (inicio, duracion) => inicio + Number(duracion || 60);
const seSuperponen = (inicioA, finA, inicioB, finB) => inicioA < finB && inicioB < finA;

const construirDisponibilidad = async (poolConn, org, service, fecha, horaActual = null, resourceId = null, branchId = null) => {
  const [branches] = await poolConn.execute('SELECT id, nombre FROM negocio_sucursales WHERE organizacion_id = ? AND activo = TRUE ORDER BY id', [org.id]);
  const requestedBranch = branchId ? branches.find((b) => Number(b.id) === Number(branchId)) : null;
  if (branchId && !requestedBranch) return { slots: [], sucursales: branches, sucursalId: null, recursos: [] };
  const branch = requestedBranch || branches[0];
  if (!branch) return { slots: [], sucursales: [], sucursalId: null, recursos: [] };
  const [resources] = await poolConn.execute(`SELECT r.id, r.nombre FROM negocio_recursos r
    JOIN servicio_recursos sr ON sr.recurso_id = r.id AND sr.organizacion_id = r.organizacion_id AND sr.servicio_id = ?
    JOIN sucursal_recursos br ON br.recurso_id = r.id AND br.organizacion_id = r.organizacion_id AND br.sucursal_id = ?
    WHERE r.organizacion_id = ? AND r.activo = TRUE ORDER BY r.nombre`, [service.id, branch.id, org.id]);
  const usaProfesionales = resources.length > 0 && Number(service.capacidad) <= 1;
  const [bookings] = await poolConn.execute(`SELECT t.hora, t.recurso_id, t.sucursal_id, t.servicio_id, s.duracion_minutos
    FROM turnos t JOIN servicios s ON s.id = t.servicio_id
    WHERE t.organizacion_id = ? AND t.fecha = ? AND t.estado = 'reservado'`, [org.id, fecha]);
  const [globalHours] = await poolConn.execute("SELECT TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, intervalo_minutos, capacidad FROM agenda_horarios WHERE organizacion_id = ? AND servicio_id = ? AND dia_semana = WEEKDAY(?) AND activo = TRUE ORDER BY hora_inicio", [org.id, service.id, fecha]);
  const now = fechaLocal(org.zona_horaria);
  const candidateResources = usaProfesionales ? resources : [];
  const scheduleCache = new Map();
  const scheduleFor = async (resource) => {
    const key = resource ? Number(resource.id) : 0;
    if (scheduleCache.has(key)) return scheduleCache.get(key);
    let specific = [];
    if (resource || branch) {
      const [rows] = await poolConn.execute(`SELECT sucursal_id, recurso_id, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, intervalo_minutos
        FROM agenda_especifica WHERE organizacion_id = ? AND servicio_id = ? AND dia_semana = WEEKDAY(?) AND activo = TRUE
        AND (sucursal_id = ? OR sucursal_id IS NULL) AND (recurso_id = ? OR recurso_id IS NULL)
        ORDER BY CASE WHEN sucursal_id IS NOT NULL AND recurso_id IS NOT NULL THEN 0 WHEN recurso_id IS NOT NULL THEN 1 WHEN sucursal_id IS NOT NULL THEN 2 ELSE 3 END, hora_inicio`, [org.id, service.id, fecha, branch.id, resource?.id || null]);
      if (rows.length) {
        const rank = (row) => row.sucursal_id != null && row.recurso_id != null ? 0 : row.recurso_id != null ? 1 : row.sucursal_id != null ? 2 : 3;
        const exact = rows.filter((row) => rank(row) === 0);
        const resourceHours = rows.filter((row) => rank(row) === 1);
        const branchHours = rows.filter((row) => rank(row) === 2);
        if (exact.length) specific = exact;
        else if (resourceHours.length && branchHours.length) {
          specific = resourceHours.flatMap((resourceWindow) => branchHours.flatMap((branchWindow) => {
            const start = Math.max(horaEnMinutos(resourceWindow.hora_inicio), horaEnMinutos(branchWindow.hora_inicio));
            const end = Math.min(horaEnMinutos(resourceWindow.hora_fin), horaEnMinutos(branchWindow.hora_fin));
            if (start >= end) return [];
            const fmt = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
            return [{ hora_inicio: fmt(start), hora_fin: fmt(end), intervalo_minutos: resourceWindow.intervalo_minutos }];
          }));
        } else specific = resourceHours.length ? resourceHours : branchHours;
      }
    }
    const result = specific.length ? specific : globalHours;
    scheduleCache.set(key, result);
    return result;
  };
  const slotsByMinute = new Map();
  const slotsFor = candidateResources.length ? candidateResources : [null];
  for (const resource of slotsFor) {
    const windows = await scheduleFor(resource);
    for (const window of windows) {
      const start = horaEnMinutos(window.hora_inicio), end = horaEnMinutos(window.hora_fin), interval = Number(window.intervalo_minutos) || 60;
      for (let minute = start; minute < end; minute += interval) {
        if (fecha < now.fecha || (fecha === now.fecha && minute <= (horaActual ?? now.minutos))) continue;
        const finish = minutosFin(minute, service.duracion_minutos);
        if (finish > end) continue;
        const hour = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
        const overlapping = bookings.filter((booking) => seSuperponen(minute, finish, horaEnMinutos(booking.hora), minutosFin(horaEnMinutos(booking.hora), booking.duracion_minutos)));
        let available = false;
        if (resource) {
          available = !overlapping.some((booking) => booking.recurso_id != null && Number(booking.recurso_id) === Number(resource.id) || booking.recurso_id == null && Number(booking.servicio_id) === Number(service.id) && Number(booking.sucursal_id || branch.id) === Number(branch.id));
        } else {
          const capacity = Number(window.capacidad || service.capacidad);
          const used = overlapping.filter((booking) => Number(booking.servicio_id) === Number(service.id) && Number(booking.sucursal_id || branch.id) === Number(branch.id)).length;
          available = used < capacity;
        }
        if (!slotsByMinute.has(minute)) slotsByMinute.set(minute, { hora: hour, ocupados: 0, capacidad: 0, disponible: false, recursosDisponibles: [] });
        const slot = slotsByMinute.get(minute);
        if (resource) {
          slot.capacidad += 1;
          if (available) slot.recursosDisponibles.push({ id: resource.id, nombre: resource.nombre });
        } else {
          slot.capacidad = Number(window.capacidad || service.capacidad);
          slot.ocupados = bookings.filter((booking) => Number(booking.servicio_id) === Number(service.id) && Number(booking.sucursal_id || branch.id) === Number(branch.id) && seSuperponen(minute, finish, horaEnMinutos(booking.hora), minutosFin(horaEnMinutos(booking.hora), booking.duracion_minutos))).length;
          slot.disponible = available;
        }
      }
    }
  }
  const slots = [...slotsByMinute.values()].sort((a, b) => a.hora.localeCompare(b.hora)).map((slot) => {
    if (slot.recursosDisponibles.length || slot.capacidad > 0 && candidateResources.length) {
      slot.ocupados = slot.capacidad - slot.recursosDisponibles.length;
      slot.disponible = resourceId ? slot.recursosDisponibles.some((r) => Number(r.id) === Number(resourceId)) : slot.recursosDisponibles.length > 0;
      if (resourceId) slot.recursosDisponibles = slot.recursosDisponibles.filter((r) => Number(r.id) === Number(resourceId));
    }
    return slot;
  });
  const [allResources] = await poolConn.execute(`SELECT r.id, r.nombre FROM negocio_recursos r JOIN servicio_recursos sr ON sr.recurso_id = r.id AND sr.organizacion_id = r.organizacion_id AND sr.servicio_id = ? JOIN sucursal_recursos br ON br.recurso_id = r.id AND br.organizacion_id = r.organizacion_id AND br.sucursal_id = ? WHERE r.organizacion_id = ? AND r.activo = TRUE ORDER BY r.nombre`, [service.id, branch.id, org.id]);
  return { slots, sucursales: branches, sucursalId: Number(branch.id), recursos: allResources };
};

const getMisTurnos = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT t.*, s.nombre AS servicio, r.nombre AS profesional, b.nombre AS sucursal FROM turnos t LEFT JOIN servicios s ON s.id = t.servicio_id LEFT JOIN negocio_recursos r ON r.id = t.recurso_id LEFT JOIN negocio_sucursales b ON b.id = t.sucursal_id WHERE t.usuario_id = ? AND t.organizacion_id = ? ORDER BY t.fecha, t.hora',
      [req.usuario.id, req.usuario.organizacionId]
    );
    res.json(rows);
  } catch (err) { console.error('[turnos.mios]', err.code || err.message); res.status(500).json({ error: 'No se pudieron cargar tus turnos' }); }
};

const crearTurno = async (req, res) => {
  const { fecha, hora, servicioId, recursoId, sucursalId } = req.body || {};
  const organizationId = req.usuario.organizacionId;
  const timezone = req.usuario.timezone || process.env.BUSINESS_TIMEZONE || 'America/Argentina/Buenos_Aires';
  if (!validarFecha(fecha) || !/^\d{2}:\d{2}(:\d{2})?$/.test(hora || '')) return res.status(400).json({ error: 'Fecha u horario inválido' });
  const horaSql = hora.length === 5 ? `${hora}:00` : hora;
  const idServicio = Number(servicioId || req.usuario.servicioId);
  if (!Number.isInteger(idServicio)) return res.status(400).json({ error: 'Seleccioná un servicio' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orgRows] = await connection.execute('SELECT id, nombre, zona_horaria FROM organizaciones WHERE id = ? FOR UPDATE', [organizationId]);
    const org = orgRows[0];
    const timezoneOrg = org?.zona_horaria || timezone;
    const ahoraOrg = fechaLocal(timezoneOrg);
    if (fecha < ahoraOrg.fecha) { await connection.rollback(); return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' }); }
    const [servicios] = await connection.execute(
      'SELECT id, nombre, capacidad, duracion_minutos, activo FROM servicios WHERE id = ? AND organizacion_id = ? FOR UPDATE',
      [idServicio, organizationId]
    );
    const servicio = servicios[0];
    if (!servicio || !servicio.activo) { await connection.rollback(); return res.status(400).json({ error: 'El servicio no está disponible' }); }
    const minuto = horaEnMinutos(horaSql);
    if (fecha === ahoraOrg.fecha && minuto <= ahoraOrg.minutos) { await connection.rollback(); return res.status(400).json({ error: 'No se puede reservar un horario que ya pasó' }); }
    await connection.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [req.usuario.id]);
    const [existentes] = await connection.execute(
      "SELECT id FROM turnos WHERE usuario_id = ? AND organizacion_id = ? AND fecha = ? AND estado = 'reservado' FOR UPDATE",
      [req.usuario.id, organizationId, fecha]
    );
    if (existentes.length) { await connection.rollback(); return res.status(409).json({ error: 'Ya tenés un turno reservado para ese día' }); }
    const disponibilidad = await construirDisponibilidad(connection, { ...org, zona_horaria: timezoneOrg }, servicio, fecha, ahoraOrg.minutos, recursoId || null, sucursalId || null);
    const usaProfesionales = disponibilidad.recursos.length > 0 && Number(servicio.capacidad) <= 1;
    if (recursoId && (!usaProfesionales || !disponibilidad.recursos.some((r) => Number(r.id) === Number(recursoId)))) { await connection.rollback(); return res.status(400).json({ error: 'Ese profesional no está disponible para este servicio y sucursal' }); }
    const seleccionado = disponibilidad.slots.find((slot) => slot.hora === horaSql.slice(0, 5));
    if (!seleccionado) { await connection.rollback(); return res.status(400).json({ error: 'Ese horario no está habilitado para el servicio o no alcanza la duración de la cita' }); }
    if (!seleccionado.disponible) { await connection.rollback(); return res.status(409).json({ error: 'Ese horario se superpone con otra reserva o está completo' }); }
    const recursoAsignado = usaProfesionales ? Number(recursoId || seleccionado.recursosDisponibles[0]?.id) : null;
    if (usaProfesionales && !recursoAsignado) { await connection.rollback(); return res.status(409).json({ error: 'Elegí un profesional disponible para este horario' }); }
    const [insertado] = await connection.execute(
      "INSERT INTO turnos (usuario_id, fecha, hora, organizacion_id, servicio_id, sucursal_id, recurso_id, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'reservado')",
      [req.usuario.id, fecha, horaSql, organizationId, idServicio, disponibilidad.sucursalId, recursoAsignado]
    );
    await connection.commit();
    const [usuarios] = await pool.execute('SELECT nombre, email FROM usuarios WHERE id = ?', [req.usuario.id]);
    const profesional = disponibilidad.recursos.find((r) => Number(r.id) === recursoAsignado);
    const sucursal = disponibilidad.sucursales.find((b) => Number(b.id) === Number(disponibilidad.sucursalId));
    void enviarConfirmacionTurno(usuarios[0], { fecha, hora: horaSql, servicio: servicio.nombre, profesional: profesional?.nombre, sucursal: sucursal?.nombre });
    res.status(201).json({ mensaje: 'Turno reservado correctamente', id: insertado.insertId });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('[turnos.crear]', err.code || err.message);
    res.status(500).json({ error: 'No se pudo reservar el turno' });
  } finally { if (connection) connection.release(); }
};

const crearTurnoPublico = async (req, res) => {
  const { organizacionSlug, servicioId, fecha, hora, nombre, email, recursoId, sucursalId } = req.body || {};
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
    const [services] = await connection.execute('SELECT id, nombre, capacidad, duracion_minutos, activo FROM servicios WHERE id = ? AND organizacion_id = ? FOR UPDATE', [Number(servicioId), org.id]);
    const service = services[0];
    if (!service || !service.activo) { await connection.rollback(); return res.status(404).json({ error: 'Ese servicio ya no está disponible' }); }
    const ahoraBloqueado = fechaLocal(org.zona_horaria);
    if (fecha < ahoraBloqueado.fecha || (fecha === ahoraBloqueado.fecha && horaEnMinutos(hora) <= ahoraBloqueado.minutos)) { await connection.rollback(); return res.status(400).json({ error: 'Elegí un horario que siga estando en el futuro' }); }
    const disponibilidad = await construirDisponibilidad(connection, org, service, fecha, ahoraBloqueado.minutos, recursoId || null, sucursalId || null);
    const usaProfesionales = disponibilidad.recursos.length > 0 && Number(service.capacidad) <= 1;
    if (recursoId && (!usaProfesionales || !disponibilidad.recursos.some((recurso) => Number(recurso.id) === Number(recursoId)))) { await connection.rollback(); return res.status(400).json({ error: 'Ese profesional no está disponible para este servicio y sucursal' }); }
    const seleccionado = disponibilidad.slots.find((slot) => slot.hora === hora);
    if (!seleccionado) { await connection.rollback(); return res.status(400).json({ error: 'Ese horario no está disponible' }); }
    if (!seleccionado.disponible) { await connection.rollback(); return res.status(409).json({ error: 'Ese horario acaba de ocuparse o se superpone con otra reserva; elegí otro' }); }
    const recursoAsignado = usaProfesionales ? (recursoId ? Number(recursoId) : Number(seleccionado.recursosDisponibles[0]?.id)) : null;
    if (usaProfesionales && !recursoAsignado) { await connection.rollback(); return res.status(409).json({ error: 'Ese horario acaba de ocuparse; elegí otro' }); }
    const [insertado] = await connection.execute("INSERT INTO turnos (usuario_id, fecha, hora, organizacion_id, servicio_id, sucursal_id, estado, nombre_cliente, email_cliente, recurso_id) VALUES (NULL, ?, ?, ?, ?, ?, 'reservado', ?, ?, ?)", [fecha, `${hora}:00`, org.id, service.id, disponibilidad.sucursalId, nombreCliente, emailCliente, recursoAsignado]);
    await connection.commit();
    const tokenCancelar = jwt.sign({ turnoId: insertado.insertId, organizacionId: org.id }, process.env.JWT_SECRET, { expiresIn: '365d' });
    const baseFrontend = (process.env.FRONTEND_URL || 'https://tcgym.vercel.app').replace(/\/+$/, '');
    const urlCancelar = `${baseFrontend}/cancelar/${tokenCancelar}`;
    const profesional = usaProfesionales ? disponibilidad.recursos.find((recurso) => Number(recurso.id) === recursoAsignado) : null;
    const sucursal = disponibilidad.sucursales.find((b) => Number(b.id) === Number(disponibilidad.sucursalId));
    void enviarConfirmacionEnNombreDe({ nombre: nombreCliente, email: emailCliente }, { fecha, hora: `${hora}:00`, servicio: service.nombre, profesional: profesional?.nombre, sucursal: sucursal?.nombre }, org.nombre, urlCancelar, org.minutos_cancelacion);
    return res.status(201).json({ mensaje: 'Reserva confirmada', id: insertado.insertId, profesional: profesional?.nombre || null, sucursal: sucursal?.nombre || null, minutosCancelacion: Number(org.minutos_cancelacion), urlCancelar });
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
  const { fecha, servicioId, recursoId, sucursalId } = req.query;
  const organizationId = req.usuario.organizacionId;
  if (!validarFecha(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  try {
    const [servicios] = await pool.execute('SELECT id, nombre, capacidad, duracion_minutos FROM servicios WHERE organizacion_id = ? AND activo = 1 ORDER BY id', [organizationId]);
    const idServicio = Number(servicioId || req.usuario.servicioId || servicios[0]?.id);
    const servicio = servicios.find((s) => Number(s.id) === idServicio);
    if (!servicio) return res.status(404).json({ error: 'No hay servicios disponibles' });
    const [orgRows] = await pool.execute('SELECT id, zona_horaria FROM organizaciones WHERE id = ?', [organizationId]);
    const disponibilidad = await construirDisponibilidad(pool, orgRows[0], servicio, fecha, null, recursoId || null, sucursalId || null);
    res.json({ servicio, servicios, ...disponibilidad, zonaHoraria: orgRows[0].zona_horaria });
  } catch (err) { console.error('[turnos.disponibilidad]', err.code || err.message); res.status(500).json({ error: 'No se pudo consultar disponibilidad' }); }
};

const getDisponibilidadPublica = async (req, res) => {
  const { slug, fecha, servicioId, recursoId, sucursalId } = req.query;
  if (!slug || !validarFecha(fecha) || !Number.isInteger(Number(servicioId))) return res.status(400).json({ error: 'Negocio, servicio o fecha inválidos' });
  if (recursoId != null && (!Number.isInteger(Number(recursoId)) || Number(recursoId) < 1)) return res.status(400).json({ error: 'Profesional inválido' });
  try {
    const [orgRows] = await pool.execute('SELECT id, zona_horaria FROM organizaciones WHERE slug = ?', [String(slug).slice(0, 180)]);
    if (!orgRows.length) return res.status(404).json({ error: 'No encontramos ese negocio' });
    const org = orgRows[0];
    const [services] = await pool.execute('SELECT id, capacidad, duracion_minutos FROM servicios WHERE id = ? AND organizacion_id = ? AND activo = TRUE', [Number(servicioId), org.id]);
    if (!services.length) return res.status(404).json({ error: 'No encontramos ese servicio' });
    const service = services[0];
    const disponibilidad = await construirDisponibilidad(pool, org, service, fecha, null, recursoId || null, sucursalId || null);
    res.json(disponibilidad);
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
    const [orgRows] = await pool.execute('SELECT id, zona_horaria FROM organizaciones WHERE id = ?', [req.usuario.organizacionId]);
    const [services] = await pool.execute('SELECT id, capacidad, duracion_minutos FROM servicios WHERE organizacion_id = ? AND activo = TRUE', [req.usuario.organizacionId]);
    const [branches] = await pool.execute('SELECT id FROM negocio_sucursales WHERE organizacion_id = ? AND activo = TRUE', [req.usuario.organizacionId]);
    let capacidad = 0;
    for (const service of services) for (const branch of branches) {
      const agenda = await construirDisponibilidad(pool, orgRows[0], service, fecha, -1, null, branch.id);
      capacidad += agenda.slots.reduce((sum, slot) => sum + Number(slot.capacidad), 0);
    }
    res.json({ capacidad });
  } catch (err) { console.error('[turnos.capacidad]', err.code || err.message); res.status(500).json({ error: 'No se pudo calcular la capacidad' }); }
};

module.exports = { getTurnos, getMisTurnos, crearTurno, crearTurnoPublico, gestionarTurnoPublico, cancelarTurno, getDisponibilidad, getDisponibilidadPublica, marcarAsistencia, getCapacidadDia };

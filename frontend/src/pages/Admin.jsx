import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../services/api';
import CalendarioTurnos from '../pages/Calendarioturnos';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function EditorHorarios({ value = [], onChange, titulo }) {
  const dias = [...new Set(value.map((item) => Number(item.dia)))];
  const inicio = value[0]?.inicio || '09:00';
  const fin = value[0]?.fin || '17:00';
  const intervalo = value[0]?.intervalo || 60;
  const actualizar = (nextDias, nextInicio = inicio, nextFin = fin, nextIntervalo = intervalo) => onChange(nextDias.map((dia) => ({ dia, inicio: nextInicio, fin: nextFin, intervalo: Number(nextIntervalo) })));
  return <fieldset className="space-y-3 rounded-xl border border-[#dfe4ea] p-4"><legend className="px-2 text-sm font-medium text-[#526981]">{titulo}</legend><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-[#718197]">Abre<input type="time" value={inicio} onChange={(e) => actualizar(dias, e.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-[#15263b] [color-scheme:light]" /></label><label className="text-xs text-[#718197]">Cierra<input type="time" value={fin} onChange={(e) => actualizar(dias, inicio, e.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-[#15263b] [color-scheme:light]" /></label><label className="text-xs text-[#718197]">Intervalo (min)<input type="number" min="5" step="5" value={intervalo} onChange={(e) => actualizar(dias, inicio, fin, e.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-[#15263b]" /></label></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{DIAS.map((dia, index) => <label key={dia} className="flex items-center gap-2 rounded-lg border border-[#dfe4ea] p-2 text-xs text-[#526981]"><input type="checkbox" checked={dias.includes(index)} onChange={(e) => actualizar(e.target.checked ? [...dias, index] : dias.filter((d) => d !== index))} />{dia}</label>)}</div></fieldset>;
}

function ConfiguracionEspacio({ onError, error }) {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevoRecurso, setNuevoRecurso] = useState('');
  const [mensaje, setMensaje] = useState('');
  const descripcionModulo = {
    gimnasio: 'Fitness: cupos para clases y sesiones, agenda, ficha del socio y control de asistencias.',
    barberia: 'Barbería: catálogo con duración, profesionales, disponibilidad individual y sucursales.',
    peluqueria: 'Peluquería: servicios con duración, profesionales, disponibilidad individual y sucursales.',
    estetica: 'Estética y spa: tratamientos, duración, agenda por profesional y sucursal.',
    consultorio: 'Consultorio: tipos de consulta, agenda por profesional y sucursal, con datos del paciente limitados al perfil básico.',
    tatuajes: 'Estudio de tatuajes: servicios, profesionales, sucursales y citas con duración configurable.',
    clases: 'Academia: clases grupales con cupo, agenda y registro de asistencia.',
    general: 'Servicios: catálogo, cupos, agenda y gestión de profesionales por sucursal.',
  };

  useEffect(() => {
      api.get('/espacio').then(({ data }) => {
      const servicio = data.servicios[0] || { nombre: 'Servicio', capacidad: 1, duracion_minutos: 60 };
      const filas = data.horarios.filter((h) => Number(h.servicio_id) === Number(servicio.id));
      setConfig({
        organizacion: data.organizacion,
        servicios: data.servicios.map((item) => ({ ...item, nombre: item.nombre || '', descripcion: item.descripcion || '', precio: item.precio == null ? '' : String(item.precio), capacidad: String(item.capacidad), duracion_minutos: String(item.duracion_minutos) })),
        inicio: filas[0]?.hora_inicio || '09:00', fin: filas[0]?.hora_fin || '17:00', intervalo: String(filas[0]?.intervalo_minutos || servicio.duracion_minutos || 60),
        dias: [...new Set(filas.filter((h) => h.activo).map((h) => Number(h.dia_semana)))],
        recursos: data.recursos.map((r) => ({ ...r, horarios: data.horariosEspecificos.filter((h) => Number(h.recurso_id) === Number(r.id) && h.sucursal_id == null).map((h) => ({ dia: Number(h.dia_semana), inicio: h.hora_inicio, fin: h.hora_fin, intervalo: Number(h.intervalo_minutos) })) })),
        sucursales: data.sucursales.map((b) => ({ ...b, horarios: data.horariosEspecificos.filter((h) => Number(h.sucursal_id) === Number(b.id) && h.recurso_id == null).map((h) => ({ dia: Number(h.dia_semana), inicio: h.hora_inicio, fin: h.hora_fin, intervalo: Number(h.intervalo_minutos) })) })),
      });
    }).catch((err) => onError(err.response?.data?.error || 'No se pudo cargar la configuración'));
  }, [onError]);

  if (!config) return <p className="text-sm text-[#718197]">Cargando configuración…</p>;
  const cambiar = (campo, valor) => setConfig((actual) => ({ ...actual, [campo]: valor }));
  const guardar = async (event) => {
    event.preventDefault(); setGuardando(true); setMensaje(''); onError('');
    const horarios = config.dias.map((dia) => ({ dia, inicio: config.inicio, fin: config.fin, intervalo: Number(config.intervalo) }));
    try {
      await api.put('/espacio', { nombre: config.organizacion.nombre, tipoNegocio: config.organizacion.tipo_negocio, zonaHoraria: config.organizacion.zona_horaria, minutosCancelacion: Number(config.organizacion.minutos_cancelacion), servicios: config.servicios.map((item) => ({ ...item, duracionMinutos: Number(item.duracion_minutos), capacidad: Number(item.capacidad) })), horarios, recursos: config.recursos, sucursales: config.sucursales });
      const { data } = await api.get('/espacio');
      setConfig((actual) => ({ ...actual, servicios: data.servicios.map((item) => ({ ...item, nombre: item.nombre || '', descripcion: item.descripcion || '', precio: item.precio == null ? '' : String(item.precio), capacidad: String(item.capacidad), duracion_minutos: String(item.duracion_minutos) })), recursos: data.recursos.map((r) => ({ ...r, horarios: data.horariosEspecificos.filter((h) => Number(h.recurso_id) === Number(r.id) && h.sucursal_id == null).map((h) => ({ dia: Number(h.dia_semana), inicio: h.hora_inicio, fin: h.hora_fin, intervalo: Number(h.intervalo_minutos) })) })), sucursales: data.sucursales.map((b) => ({ ...b, horarios: data.horariosEspecificos.filter((h) => Number(h.sucursal_id) === Number(b.id) && h.recurso_id == null).map((h) => ({ dia: Number(h.dia_semana), inicio: h.hora_inicio, fin: h.hora_fin, intervalo: Number(h.intervalo_minutos) })) })) }));
      setMensaje('Cambios guardados. La agenda pública ya está actualizada.');
    } catch (err) { onError(err.response?.data?.error || 'No se pudo guardar'); }
    finally { setGuardando(false); }
  };

  return <form onSubmit={guardar} className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-[#dfe4ea] bg-white p-6">
    <div><h2 className="text-2xl font-semibold">Configuración del espacio</h2><p className="mt-1 text-sm text-[#718197]">{descripcionModulo[config.organizacion.tipo_negocio] || descripcionModulo.general}</p></div>
    {mensaje && <p role="status" className="rounded-lg bg-[#edf6f0] p-3 text-sm text-[#315640]">{mensaje}</p>}{error && <p role="alert" className="rounded-lg bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
    <label className="block space-y-2 text-sm text-[#526981]">Nombre del negocio<input value={config.organizacion.nombre} onChange={(e) => cambiar('organizacion', { ...config.organizacion, nombre: e.target.value })} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]" required /></label>
    <div className="grid gap-4 md:grid-cols-2"><label className="block space-y-2 text-sm text-[#526981]">Rubro<select value={config.organizacion.tipo_negocio} onChange={(e) => cambiar('organizacion', { ...config.organizacion, tipo_negocio: e.target.value })} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]"><option value="gimnasio">Gimnasio / Fitness</option><option value="barberia">Barbería</option><option value="peluqueria">Peluquería</option><option value="estetica">Estética / Spa</option><option value="consultorio">Consultorio</option><option value="tatuajes">Estudio de tatuajes</option><option value="clases">Academia / Clases</option><option value="general">Otro negocio</option></select></label><div className="space-y-2 text-sm text-[#526981]">Enlace público<div className="flex gap-2"><Link target="_blank" to={`/b/${config.organizacion.slug}`} className="min-w-0 flex-1 truncate rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#355a77]">{window.location.origin}/b/{config.organizacion.slug}</Link><button type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/b/${config.organizacion.slug}`)} className="rounded-lg border border-[#dfe4ea] px-4 text-xs hover:bg-[#f8f9fa]">Copiar</button></div></div></div>
    <label className="block space-y-2 text-sm text-[#526981]">Zona horaria<select value={config.organizacion.zona_horaria} onChange={(e) => cambiar('organizacion', { ...config.organizacion, zona_horaria: e.target.value })} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]"><option value="America/Argentina/Buenos_Aires">Argentina — Buenos Aires</option><option value="America/Santiago">Chile — Santiago</option><option value="America/Montevideo">Uruguay — Montevideo</option><option value="America/Mexico_City">México — Ciudad de México</option><option value="Europe/Madrid">España — Madrid</option><option value="UTC">UTC</option></select></label>
    <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Catálogo de servicios</h3><p className="text-xs text-[#718197]">Los horarios se comparten para los servicios activos.</p></div><button type="button" onClick={() => cambiar('servicios', [...config.servicios, { nombre: '', descripcion: '', precio: '', capacidad: '1', duracion_minutos: '60' }])} className="rounded-lg border border-[#dfe4ea] px-3 py-2 text-sm hover:bg-[#f8f9fa]">Agregar servicio</button></div>
    <div className="space-y-4">{config.servicios.map((servicio, index) => <div key={servicio.id || `nuevo-${index}`} className="space-y-3 rounded-xl border border-[#dfe4ea] bg-[#f8f9fa] p-4"><div className="grid gap-3 md:grid-cols-2"><label className="space-y-2 text-sm text-[#526981]">Nombre<input value={servicio.nombre} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, nombre: e.target.value } : item))} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2.5 text-[#15263b]" required /></label><label className="space-y-2 text-sm text-[#526981]">Descripción<input value={servicio.descripcion} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, descripcion: e.target.value } : item))} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2.5 text-[#15263b]" maxLength="500" /></label></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><label className="space-y-2 text-xs text-[#718197]">Precio<input type="number" min="0" step="0.01" value={servicio.precio} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, precio: e.target.value } : item))} className="mt-2 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2.5 text-sm text-[#15263b]" /></label><label className="space-y-2 text-xs text-[#718197]">Duración<input type="number" min="5" step="5" value={servicio.duracion_minutos} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, duracion_minutos: e.target.value } : item))} className="mt-2 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2.5 text-sm text-[#15263b]" required /></label><label className="space-y-2 text-xs text-[#718197]">Cupo<input type="number" min="1" value={servicio.capacidad} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, capacidad: e.target.value } : item))} className="mt-2 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2.5 text-sm text-[#15263b]" required /></label><div className="flex items-end justify-end">{config.servicios.length > 1 && <button type="button" onClick={() => cambiar('servicios', config.servicios.filter((_, i) => i !== index))} className="rounded-lg px-3 py-2 text-xs text-rose-200 hover:bg-rose-300/10">Quitar</button>}</div></div></div>)}</div>
    <div className="grid gap-4 md:grid-cols-3"><label className="space-y-2 text-sm text-[#526981]">Abre<input type="time" value={config.inicio} onChange={(e) => cambiar('inicio', e.target.value)} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b] [color-scheme:light]" required /></label><label className="space-y-2 text-sm text-[#526981]">Cierra<input type="time" value={config.fin} onChange={(e) => cambiar('fin', e.target.value)} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b] [color-scheme:light]" required /></label><label className="space-y-2 text-sm text-[#526981]">Intervalo entre turnos (min)<input type="number" min="5" step="5" value={config.intervalo} onChange={(e) => cambiar('intervalo', e.target.value)} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]" required /></label></div>
    <fieldset><legend className="mb-3 text-sm text-[#526981]">Días habilitados</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{DIAS.map((dia, index) => <label key={dia} className="flex items-center gap-2 rounded-lg border border-[#dfe4ea] p-3 text-sm"><input type="checkbox" checked={config.dias.includes(index)} onChange={(e) => cambiar('dias', e.target.checked ? [...config.dias, index] : config.dias.filter((d) => d !== index))} />{dia}</label>)}</div></fieldset>
    <label className="block space-y-2 text-sm text-[#526981]">Anticipación mínima para cancelar (minutos)<input type="number" min="0" max="10080" value={config.organizacion.minutos_cancelacion} onChange={(e) => cambiar('organizacion', { ...config.organizacion, minutos_cancelacion: e.target.value })} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]" required /></label>
    <section className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Sucursales</h3><p className="text-xs text-[#718197]">Cada una puede tener horario propio. Las reservas anteriores conservan su asignación.</p></div><button type="button" onClick={() => cambiar('sucursales', [...config.sucursales, { nombre: '', direccion: '', horarios: [] }])} className="rounded-lg border border-[#dfe4ea] px-3 py-2 text-sm hover:bg-[#f8f9fa]">Agregar sucursal</button></div>{config.sucursales.map((b, index) => <div key={b.id || `sucursal-${index}`} className="space-y-3 rounded-xl border border-[#dfe4ea] bg-[#f8f9fa] p-4"><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs text-[#718197]">Nombre<input value={b.nombre} onChange={(e) => cambiar('sucursales', config.sucursales.map((item, i) => i === index ? { ...item, nombre: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-[#15263b]" required /></label><label className="text-xs text-[#718197]">Dirección<input value={b.direccion || ''} onChange={(e) => cambiar('sucursales', config.sucursales.map((item, i) => i === index ? { ...item, direccion: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-[#15263b]" /></label>{config.sucursales.length > 1 && <button type="button" onClick={() => cambiar('sucursales', config.sucursales.filter((_, i) => i !== index))} className="self-end rounded-lg px-3 py-2 text-xs text-rose-200">Quitar</button>}</div><EditorHorarios titulo="Horario de esta sucursal (opcional)" value={b.horarios} onChange={(horarios) => cambiar('sucursales', config.sucursales.map((item, i) => i === index ? { ...item, horarios } : item))} /></div>)}</section>
    <section className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{['barberia', 'peluqueria', 'estetica', 'consultorio', 'tatuajes'].includes(config.organizacion.tipo_negocio) ? 'Profesionales' : 'Profesionales o recursos'}</h3><p className="text-xs text-[#718197]">Asigná los servicios que ofrece cada profesional y definí su agenda.</p></div><div className="flex gap-2"><input value={nuevoRecurso} onChange={(e) => setNuevoRecurso(e.target.value)} placeholder="Nombre" className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-[#15263b]"/><button type="button" onClick={() => { if (nuevoRecurso.trim()) { cambiar('recursos', [...config.recursos, { nombre: nuevoRecurso.trim(), tipo: 'profesional', serviciosIds: [], horarios: [] }]); setNuevoRecurso(''); } }} className="rounded-lg border border-[#dfe4ea] px-3 text-sm hover:bg-[#f8f9fa]">Agregar</button></div></div>{config.recursos.map((r, index) => <div key={r.id || `${r.nombre}-${index}`} className="space-y-3 rounded-xl border border-[#dfe4ea] bg-[#f8f9fa] p-4"><div className="flex items-center justify-between"><p className="font-medium">{r.nombre}</p><button type="button" aria-label={`Quitar ${r.nombre}`} onClick={() => cambiar('recursos', config.recursos.filter((_, i) => i !== index))} className="rounded-lg px-3 py-2 text-xs text-rose-200">Quitar</button></div><fieldset><legend className="mb-2 text-xs text-[#718197]">Servicios que realiza</legend><div className="flex flex-wrap gap-2">{config.servicios.filter((s) => s.id).map((s) => <label key={s.id} className="flex items-center gap-2 rounded-lg border border-[#dfe4ea] px-3 py-2 text-xs"><input type="checkbox" checked={(r.serviciosIds || []).map(Number).includes(Number(s.id))} onChange={(e) => cambiar('recursos', config.recursos.map((item, i) => i === index ? { ...item, serviciosIds: e.target.checked ? [...(item.serviciosIds || []), Number(s.id)] : (item.serviciosIds || []).filter((id) => Number(id) !== Number(s.id)) } : item))} />{s.nombre}</label>)}</div>{!config.servicios.some((s) => s.id) && <p className="text-xs text-[#718197]">Guardá primero el servicio nuevo para poder asignarlo.</p>}</fieldset><EditorHorarios titulo="Horario del profesional (opcional)" value={r.horarios} onChange={(horarios) => cambiar('recursos', config.recursos.map((item, i) => i === index ? { ...item, horarios } : item))} /></div>)}</section>
    <button disabled={guardando} className="rounded-xl bg-[#142942] px-6 py-3 text-sm font-semibold text-white hover:bg-[#233c58] disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar configuración'}</button>
  </form>;
}

export default function Admin() {
  const [seccion, setSeccion] = useState('dashboard');
  const [usuarios, setUsuarios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [capacidadDia, setCapacidadDia] = useState(0);
  const [configError, setConfigError] = useState('');
  const [filtroUsuarios, setFiltroUsuarios] = useState('');
  const [urlPublica, setUrlPublica] = useState('');
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const rubro = usuario?.tipoNegocio || 'general';
  const etiquetas = {
    gimnasio: { clientes: 'Socios', turnos: 'Reservas', atendidos: 'Asistencias' },
    consultorio: { clientes: 'Pacientes', turnos: 'Consultas', atendidos: 'Atendidos' },
    barberia: { clientes: 'Clientes', turnos: 'Turnos', atendidos: 'Realizados' },
    peluqueria: { clientes: 'Clientes', turnos: 'Turnos', atendidos: 'Realizados' },
    estetica: { clientes: 'Clientes', turnos: 'Sesiones', atendidos: 'Realizados' },
    tatuajes: { clientes: 'Clientes', turnos: 'Sesiones', atendidos: 'Realizados' },
    clases: { clientes: 'Alumnos', turnos: 'Clases', atendidos: 'Asistencias' },
    general: { clientes: 'Clientes', turnos: 'Reservas', atendidos: 'Realizados' },
  }[rubro] || { clientes: 'Clientes', turnos: 'Reservas', atendidos: 'Realizados' };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const hoyLocal = new Intl.DateTimeFormat('en-CA', { timeZone: usuario?.timezone || 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const [u, t, c] = await Promise.all([api.get('/usuarios'), api.get('/turnos'), api.get('/turnos/capacidad', { params: { fecha: hoyLocal } })]);
      setUsuarios(u.data);
      setTurnos(t.data);
      setCapacidadDia(c.data.capacidad);
    } catch (err) { console.error(err); } 
    finally { setCargando(false); }
  }, [usuario?.timezone]);

  useEffect(() => { void cargarDatos(); }, [cargarDatos]);
  useEffect(() => { api.get('/espacio').then(({ data }) => setUrlPublica(`${window.location.origin}/b/${data.organizacion.slug}`)).catch(() => {}); }, []);

  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: usuario?.timezone || 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const turnosHoy = turnos.filter(t => t.fecha?.split('T')[0] === hoy);
  const reservadosHoy = turnosHoy.filter(t => t.estado === 'reservado').length;
  const completadosHoy = turnosHoy.filter(t => t.estado === 'completado').length;
  const canceladosHoy = turnosHoy.filter(t => t.estado === 'cancelado').length;
  const ocupacion = capacidadDia ? Math.min(100, Math.round((reservadosHoy / capacidadDia) * 100)) : 0;
  const usuariosFiltrados = usuarios.filter((u) => `${u.nombre} ${u.apellido} ${u.email} ${u.documento || ''}`.toLowerCase().includes(filtroUsuarios.toLowerCase()));
  const actualizarEstado = async (id, estado) => {
    try { await api.patch(`/turnos/${id}/estado`, { estado }); await cargarDatos(); }
    catch (err) { window.alert(err.response?.data?.error || 'No se pudo actualizar el turno'); }
  };

  const STATS = [
    { label: etiquetas.clientes, valor: usuarios.length, icon: '01', color: 'from-slate-400 to-[#6B8F71]' },
    { label: `${etiquetas.turnos} hoy`, valor: turnosHoy.length, icon: '02', color: 'from-[#172B4D] to-slate-300' },
    { label: etiquetas.atendidos, valor: completadosHoy, icon: '03', color: 'from-slate-500 to-[#6B8F71]' },
    { label: 'Cancelados', valor: canceladosHoy, icon: '04', color: 'from-slate-600 to-slate-400' },
    { label: 'Pendientes', valor: reservadosHoy, icon: '05', color: 'from-slate-400 to-[#6B8F71]' },
    { label: 'Ocupación', valor: ocupacion + '%', icon: '06', color: 'from-[#172B4D] to-slate-300' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#15263b] flex flex-col md:flex-row">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-72 border-r border-[#dfe4ea] bg-white p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-[#142942] rounded-xl flex items-center justify-center font-semibold text-white">S</div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide">SHIFTS</h1>
            <p className="text-[10px] text-[#718197] uppercase tracking-widest">{usuario?.organizacion || 'Tu espacio'}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', label: 'Resumen', icon: '01' },
            { id: 'usuarios', label: etiquetas.clientes, icon: '01', count: usuarios.length },
            { id: 'turnos', label: `${etiquetas.turnos} de hoy`, icon: '02', count: turnosHoy.length },
            { id: 'calendario', label: 'Calendario', icon: '03' },
            { id: 'configuracion', label: 'Servicios y negocio', icon: '04' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSeccion(item.id)}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${
                seccion === item.id ? 'bg-[#142942] text-white shadow-xl' : 'text-[#718197] hover:bg-[#f8f9fa] hover:text-[#15263b]'
              }`}
            >
              <span className="flex items-center gap-3"><span>{item.icon}</span> {item.label}</span>
              {item.count !== undefined && <span className="bg-white/10 px-2 py-1 rounded-lg text-[10px]">{item.count}</span>}
            </button>
          ))}
        </nav>

        <button onClick={() => navigate('/home')} className="p-4 rounded-xl bg-[#f8f9fa] border border-[#dfe4ea] text-xs font-medium hover:bg-[#f8f9fa] transition-all">
          ← Inicio de cuenta
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative h-screen">
        {/* Glow Effects */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[#edf2f6] rounded-full blur-[120px] pointer-events-none" />

        <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 border-b border-[#dfe4ea] px-5 py-4 flex items-center justify-between md:hidden">
          <h2 className="font-semibold text-sm tracking-wide">SHIFTS · Panel</h2>
          <div className="w-8 h-8 rounded-lg bg-[#142942] grid place-items-center text-white">S</div>
        </header>

        <nav className="sticky top-[57px] z-30 flex gap-2 overflow-x-auto border-b border-[#dfe4ea] bg-white px-4 py-3 md:hidden">
          {[
            { id: 'dashboard', label: 'Resumen' },
            { id: 'usuarios', label: etiquetas.clientes },
            { id: 'turnos', label: etiquetas.turnos },
            { id: 'calendario', label: 'Calendario' },
            { id: 'configuracion', label: 'Negocio' },
          ].map((item) => <button key={item.id} onClick={() => setSeccion(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${seccion === item.id ? 'bg-[#142942] text-white' : 'text-[#718197] hover:bg-[#f8f9fa]'}`}>{item.label}</button>)}
        </nav>

        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-10">
          
          {cargando ? (
            <div className="h-[60vh] flex flex-col items-center justify-center animate-pulse">
              <div className="w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-medium text-[#718197]">Cargando panel…</p>
            </div>
          ) : (
            <div className="animate-fadeIn">
              
              {/* SECTION: DASHBOARD */}
              {seccion === 'dashboard' && (
                <div className="space-y-10">
                  <header>
                    <p className="text-xs font-medium uppercase tracking-[.18em] text-[#718197]">Panel de control · {usuario?.organizacion}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Resumen de hoy</h1>
                    <p className="mt-2 text-sm text-[#718197]">{new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: usuario?.timezone || 'America/Argentina/Buenos_Aires' }).format(new Date())}</p>
                  </header>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dfe4ea] bg-white p-5"><div><p className="text-sm font-medium">Tu página de reservas</p><p className="mt-1 text-xs text-[#718197]">Compartila con tus clientes para recibir turnos.</p></div><div className="flex gap-2"><a href={urlPublica || '#'} target="_blank" rel="noreferrer" className="rounded-lg border border-[#dfe4ea] px-3 py-2 text-xs text-[#526981]">Abrir página ↗</a><button onClick={() => navigator.clipboard?.writeText(urlPublica)} disabled={!urlPublica} className="rounded-lg bg-[#142942] px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Copiar enlace</button></div></div>
                    {STATS.map((stat, i) => (
                      <div key={i} className="group bg-white border border-[#dfe4ea] p-6 rounded-[2rem] hover:border-[#a9c5b4] transition-all cursor-default relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${stat.color} opacity-[0.03] rounded-bl-full`} />
                        <span className="text-xs font-semibold text-[#718197] mb-4 block">{stat.icon}</span>
                        <p className="text-3xl font-black tracking-tighter mb-1">{stat.valor}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#718197] group-hover:text-[#526981] transition-colors">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border border-[#dfe4ea] rounded-[2.5rem] overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#dfe4ea] flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest">Actividad Reciente - Turnos</h3>
                        <span className="px-3 py-1 bg-[#a9c5b4] text-[#315640] text-[10px] font-semibold rounded-full uppercase">En Vivo</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#f8f9fa]">
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#718197]">Usuario</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#718197]">Horario</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#718197]">Estado</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#718197] text-right">Control</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {turnosHoy.map((t) => (
                            <tr key={t.id} className="hover:bg-[#f8f9fa] transition-all group">
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-[#edf2f6] border border-[#dfe4ea] flex items-center justify-center font-black text-[#315640] text-xs">
                                    {t.nombre?.[0]}{t.apellido?.[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{t.nombre || 'Cliente'} {t.apellido}</p>
                                    <p className="text-xs text-[#718197]">{t.email || 'Reserva online'} · {t.servicio || 'Servicio'}{t.profesional ? ` · ${t.profesional}` : ''}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <span className="font-mono text-lg font-black text-[#315640]/80">{t.hora?.slice(0,5)}</span>
                              </td>
                              <td className="px-8 py-5">
                                <span className={`text-[10px] font-black uppercase px-4 py-2 rounded-full border ${
                                  t.estado === 'completado' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                                  t.estado === 'cancelado' ? 'border-red-500/30 text-red-400 bg-red-500/5' : 'border-[#c9dfd0] text-[#315640] bg-[#a9c5b4]/5'
                                }`}>
                                  {t.estado}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex justify-end gap-2 opacity-100 transition-all">
                                  {t.estado === 'reservado' && (
                                    <button onClick={() => actualizarEstado(t.id, 'completado')} aria-label="Marcar asistencia" className="p-2 bg-[#a9c5b4] text-[#315640] rounded-lg hover:bg-white transition-colors">✓</button>
                                  )}
                                  {t.estado === 'reservado' && <button onClick={() => actualizarEstado(t.id, 'cancelado')} aria-label="Cancelar turno" className="p-2 bg-[#f8f9fa] text-[#526981] rounded-lg hover:text-rose-300 transition-colors">✕</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTIONS FOR OTHER VIEWS (REUSE THE SAME TABLE PATTERN) */}
              {seccion === 'usuarios' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[.18em] text-[#718197]">Directorio</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{etiquetas.clientes}</h2></div><input value={filtroUsuarios} onChange={(e) => setFiltroUsuarios(e.target.value)} placeholder={`Buscar ${etiquetas.clientes.toLowerCase()}, correo o documento`} className="w-full max-w-sm rounded-xl border border-[#dfe4ea] bg-white px-4 py-3 text-sm text-[#15263b] placeholder:text-[#718197]" /></div>
                    <div className="bg-white border border-[#dfe4ea] rounded-[2.5rem] overflow-hidden p-2">
                        {/* Aquí podrías mapear la lista de usuarios con el mismo estilo de tabla elite */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                            {usuariosFiltrados.map(u => (
                                <div key={u.id} className="bg-[#f8f9fa] border border-[#dfe4ea] p-6 rounded-3xl flex items-center justify-between hover:border-[#a9c5b4] transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#f8f9fa] rounded-2xl flex items-center justify-center text-xs font-medium tracking-widest">CL</div>
                                        <div>
                                            <p className="text-sm font-black uppercase">{u.nombre} {u.apellido}</p>
                                            <p className="text-xs text-[#718197]">{u.email}</p>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-[#dfe4ea] px-3 py-1 text-xs capitalize text-[#526981]">{u.rol}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              )}

              {seccion === 'turnos' && <section className="space-y-4"><h2 className="text-2xl font-semibold">Turnos de hoy</h2>{turnosHoy.length ? turnosHoy.map((turno) => <article key={turno.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#dfe4ea] bg-white p-4"><div><p className="font-medium">{turno.nombre || 'Cliente'} {turno.apellido}</p><p className="text-sm text-[#718197]">{turno.hora.slice(0, 5)} · {turno.servicio || 'Servicio'}{turno.profesional ? ` · ${turno.profesional}` : ''} · {turno.email || 'Reserva online'} · {turno.estado}</p></div>{turno.estado === 'reservado' && <div className="flex gap-2"><button onClick={() => actualizarEstado(turno.id, 'completado')} className="rounded-lg bg-[#a9c5b4] px-3 py-2 text-xs font-medium text-[#315640]">Asistió</button><button onClick={() => actualizarEstado(turno.id, 'cancelado')} className="rounded-lg border border-[#dfe4ea] px-3 py-2 text-xs">Cancelar</button></div>}</article>) : <p className="rounded-xl border border-[#dfe4ea] bg-white p-5 text-[#718197]">No hay turnos para hoy.</p>}</section>}

              {seccion === 'calendario' && (
                <div className="animate-fadeIn">
                  <CalendarioTurnos />
                </div>
              )}

              {seccion === 'configuracion' && <ConfiguracionEspacio onError={setConfigError} error={configError} />}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}

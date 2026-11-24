import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../services/api';
import CalendarioTurnos from '../pages/Calendarioturnos';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function ConfiguracionEspacio({ onError, error }) {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevoRecurso, setNuevoRecurso] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
      api.get('/espacio').then(({ data }) => {
      const servicio = data.servicios[0] || { nombre: 'Servicio', capacidad: 1, duracion_minutos: 60 };
      const filas = data.horarios.filter((h) => Number(h.servicio_id) === Number(servicio.id));
      setConfig({
        organizacion: data.organizacion,
        servicios: data.servicios.map((item) => ({ ...item, nombre: item.nombre || '', descripcion: item.descripcion || '', precio: item.precio == null ? '' : String(item.precio), capacidad: String(item.capacidad), duracion_minutos: String(item.duracion_minutos) })),
        inicio: filas[0]?.hora_inicio || '09:00', fin: filas[0]?.hora_fin || '17:00', intervalo: String(filas[0]?.intervalo_minutos || servicio.duracion_minutos || 60),
        dias: [...new Set(filas.filter((h) => h.activo).map((h) => Number(h.dia_semana)))],
        recursos: data.recursos,
      });
    }).catch((err) => onError(err.response?.data?.error || 'No se pudo cargar la configuración'));
  }, [onError]);

  if (!config) return <p className="text-sm text-slate-400">Cargando configuración…</p>;
  const cambiar = (campo, valor) => setConfig((actual) => ({ ...actual, [campo]: valor }));
  const guardar = async (event) => {
    event.preventDefault(); setGuardando(true); setMensaje(''); onError('');
    const horarios = config.dias.map((dia) => ({ dia, inicio: config.inicio, fin: config.fin, intervalo: Number(config.intervalo) }));
    try {
      await api.put('/espacio', { nombre: config.organizacion.nombre, tipoNegocio: config.organizacion.tipo_negocio, zonaHoraria: config.organizacion.zona_horaria, minutosCancelacion: Number(config.organizacion.minutos_cancelacion), servicios: config.servicios.map((item) => ({ ...item, duracionMinutos: Number(item.duracion_minutos), capacidad: Number(item.capacidad) })), horarios, recursos: config.recursos });
      const { data } = await api.get('/espacio');
      setConfig((actual) => ({ ...actual, servicios: data.servicios.map((item) => ({ ...item, nombre: item.nombre || '', descripcion: item.descripcion || '', precio: item.precio == null ? '' : String(item.precio), capacidad: String(item.capacidad), duracion_minutos: String(item.duracion_minutos) })), recursos: data.recursos }));
      setMensaje('Cambios guardados. La agenda pública ya está actualizada.');
    } catch (err) { onError(err.response?.data?.error || 'No se pudo guardar'); }
    finally { setGuardando(false); }
  };

  return <form onSubmit={guardar} className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-white/10 bg-[#0c1a2b] p-6">
    <div><h2 className="text-2xl font-semibold">Configuración del espacio</h2><p className="mt-1 text-sm text-slate-400">Servicios, horarios, cupos y reglas de cancelación.</p></div>
    {mensaje && <p role="status" className="rounded-lg bg-sky-300/10 p-3 text-sm text-sky-100">{mensaje}</p>}{error && <p role="alert" className="rounded-lg bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
    <label className="block space-y-2 text-sm text-slate-300">Nombre del negocio<input value={config.organizacion.nombre} onChange={(e) => cambiar('organizacion', { ...config.organizacion, nombre: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label>
    <div className="grid gap-4 md:grid-cols-2"><label className="block space-y-2 text-sm text-slate-300">Rubro<select value={config.organizacion.tipo_negocio} onChange={(e) => cambiar('organizacion', { ...config.organizacion, tipo_negocio: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white"><option value="gimnasio">Gimnasio / Fitness</option><option value="barberia">Barbería</option><option value="peluqueria">Peluquería</option><option value="estetica">Estética / Spa</option><option value="consultorio">Consultorio</option><option value="tatuajes">Estudio de tatuajes</option><option value="clases">Academia / Clases</option><option value="general">Otro negocio</option></select></label><div className="space-y-2 text-sm text-slate-300">Enlace público<div className="flex gap-2"><Link target="_blank" to={`/b/${config.organizacion.slug}`} className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-sky-200">{window.location.origin}/b/{config.organizacion.slug}</Link><button type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/b/${config.organizacion.slug}`)} className="rounded-lg border border-white/15 px-4 text-xs hover:bg-white/5">Copiar</button></div></div></div>
    <label className="block space-y-2 text-sm text-slate-300">Zona horaria<select value={config.organizacion.zona_horaria} onChange={(e) => cambiar('organizacion', { ...config.organizacion, zona_horaria: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white"><option value="America/Argentina/Buenos_Aires">Argentina — Buenos Aires</option><option value="America/Santiago">Chile — Santiago</option><option value="America/Montevideo">Uruguay — Montevideo</option><option value="America/Mexico_City">México — Ciudad de México</option><option value="Europe/Madrid">España — Madrid</option><option value="UTC">UTC</option></select></label>
    <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Catálogo de servicios</h3><p className="text-xs text-slate-400">Los horarios se comparten para los servicios activos.</p></div><button type="button" onClick={() => cambiar('servicios', [...config.servicios, { nombre: '', descripcion: '', precio: '', capacidad: '1', duracion_minutos: '60' }])} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5">Agregar servicio</button></div>
    <div className="space-y-4">{config.servicios.map((servicio, index) => <div key={servicio.id || `nuevo-${index}`} className="space-y-3 rounded-xl border border-white/10 bg-[#091625] p-4"><div className="grid gap-3 md:grid-cols-2"><label className="space-y-2 text-sm text-slate-300">Nombre<input value={servicio.nombre} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, nombre: e.target.value } : item))} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-white" required /></label><label className="space-y-2 text-sm text-slate-300">Descripción<input value={servicio.descripcion} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, descripcion: e.target.value } : item))} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-white" maxLength="500" /></label></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><label className="space-y-2 text-xs text-slate-400">Precio<input type="number" min="0" step="0.01" value={servicio.precio} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, precio: e.target.value } : item))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white" /></label><label className="space-y-2 text-xs text-slate-400">Duración<input type="number" min="5" step="5" value={servicio.duracion_minutos} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, duracion_minutos: e.target.value } : item))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white" required /></label><label className="space-y-2 text-xs text-slate-400">Cupo<input type="number" min="1" value={servicio.capacidad} onChange={(e) => cambiar('servicios', config.servicios.map((item, i) => i === index ? { ...item, capacidad: e.target.value } : item))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white" required /></label><div className="flex items-end justify-end">{config.servicios.length > 1 && <button type="button" onClick={() => cambiar('servicios', config.servicios.filter((_, i) => i !== index))} className="rounded-lg px-3 py-2 text-xs text-rose-200 hover:bg-rose-300/10">Quitar</button>}</div></div></div>)}</div>
    <div className="grid gap-4 md:grid-cols-3"><label className="space-y-2 text-sm text-slate-300">Abre<input type="time" value={config.inicio} onChange={(e) => cambiar('inicio', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white [color-scheme:light]" required /></label><label className="space-y-2 text-sm text-slate-300">Cierra<input type="time" value={config.fin} onChange={(e) => cambiar('fin', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white [color-scheme:light]" required /></label><label className="space-y-2 text-sm text-slate-300">Intervalo entre turnos (min)<input type="number" min="5" step="5" value={config.intervalo} onChange={(e) => cambiar('intervalo', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label></div>
    <fieldset><legend className="mb-3 text-sm text-slate-300">Días habilitados</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{DIAS.map((dia, index) => <label key={dia} className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm"><input type="checkbox" checked={config.dias.includes(index)} onChange={(e) => cambiar('dias', e.target.checked ? [...config.dias, index] : config.dias.filter((d) => d !== index))} />{dia}</label>)}</div></fieldset>
    <label className="block space-y-2 text-sm text-slate-300">Anticipación mínima para cancelar (minutos)<input type="number" min="0" max="10080" value={config.organizacion.minutos_cancelacion} onChange={(e) => cambiar('organizacion', { ...config.organizacion, minutos_cancelacion: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label>
    <div><p className="mb-2 text-sm text-slate-300">Profesionales o recursos</p><div className="mb-3 flex gap-2"><input value={nuevoRecurso} onChange={(e) => setNuevoRecurso(e.target.value)} placeholder="Nombre del profesional o recurso" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white"/><button type="button" onClick={() => { if (nuevoRecurso.trim()) { cambiar('recursos', [...config.recursos, { nombre: nuevoRecurso.trim(), tipo: 'profesional' }]); setNuevoRecurso(''); } }} className="rounded-lg border border-white/15 px-4 text-sm hover:bg-white/5">Agregar</button></div><div className="flex flex-wrap gap-2">{config.recursos.length ? config.recursos.map((r, index) => <span key={r.id || `${r.nombre}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{r.nombre}<button type="button" aria-label={`Quitar ${r.nombre}`} onClick={() => cambiar('recursos', config.recursos.filter((_, i) => i !== index))} className="text-slate-500 hover:text-white">×</button></span>) : <span className="text-xs text-slate-500">Sin recursos agregados.</span>}</div></div>
    <button disabled={guardando} className="rounded-xl bg-[#dce4ed] px-6 py-3 text-sm font-semibold text-[#13243a] hover:bg-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar configuración'}</button>
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
    { label: 'Clientes', valor: usuarios.length, icon: '01', color: 'from-slate-400 to-[#6B8F71]' },
    { label: 'Turnos hoy', valor: turnosHoy.length, icon: '02', color: 'from-[#172B4D] to-slate-300' },
    { label: 'Asistieron', valor: completadosHoy, icon: '03', color: 'from-slate-500 to-[#6B8F71]' },
    { label: 'Cancelados', valor: canceladosHoy, icon: '04', color: 'from-slate-600 to-slate-400' },
    { label: 'Pendientes', valor: reservadosHoy, icon: '05', color: 'from-slate-400 to-[#6B8F71]' },
    { label: 'Ocupación', valor: ocupacion + '%', icon: '06', color: 'from-[#172B4D] to-slate-300' },
  ];

  return (
    <div className="min-h-screen bg-[#05070a] text-white flex flex-col md:flex-row">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-72 border-r border-white/[0.07] bg-[#0a111c] p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-[#284361] rounded-xl flex items-center justify-center font-semibold">S</div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide">SHIFTS</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{usuario?.organizacion || 'Tu espacio'}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', label: 'Resumen', icon: '01' },
            { id: 'usuarios', label: 'Clientes', icon: '01', count: usuarios.length },
            { id: 'turnos', label: 'Turnos de hoy', icon: '02', count: turnosHoy.length },
            { id: 'calendario', label: 'Calendario', icon: '03' },
            { id: 'configuracion', label: 'Servicios y negocio', icon: '04' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSeccion(item.id)}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${
                seccion === item.id ? 'bg-[#284361] text-white shadow-xl' : 'text-white/45 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3"><span>{item.icon}</span> {item.label}</span>
              {item.count !== undefined && <span className="bg-white/10 px-2 py-1 rounded-lg text-[10px]">{item.count}</span>}
            </button>
          ))}
        </nav>

        <button onClick={() => navigate('/home')} className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs font-medium hover:bg-white/10 transition-all">
          ← Inicio de cuenta
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative h-screen">
        {/* Glow Effects */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-sky-600/5 rounded-full blur-[120px] pointer-events-none" />

        <header className="sticky top-0 z-40 backdrop-blur-md bg-[#080d14]/90 border-b border-white/[0.05] px-5 py-4 flex items-center justify-between md:hidden">
          <h2 className="font-semibold text-sm tracking-wide">SHIFTS · Panel</h2>
          <div className="w-8 h-8 rounded-lg bg-[#284361] grid place-items-center">S</div>
        </header>

        <nav className="sticky top-[57px] z-30 flex gap-2 overflow-x-auto border-b border-white/5 bg-[#080d14] px-4 py-3 md:hidden">
          {[
            { id: 'dashboard', label: 'Resumen' },
            { id: 'usuarios', label: 'Clientes' },
            { id: 'turnos', label: 'Turnos' },
            { id: 'calendario', label: 'Calendario' },
            { id: 'configuracion', label: 'Negocio' },
          ].map((item) => <button key={item.id} onClick={() => setSeccion(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${seccion === item.id ? 'bg-[#284361] text-white' : 'text-slate-400 hover:bg-white/5'}`}>{item.label}</button>)}
        </nav>

        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-10">
          
          {cargando ? (
            <div className="h-[60vh] flex flex-col items-center justify-center animate-pulse">
              <div className="w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-medium text-slate-400">Cargando panel…</p>
            </div>
          ) : (
            <div className="animate-fadeIn">
              
              {/* SECTION: DASHBOARD */}
              {seccion === 'dashboard' && (
                <div className="space-y-10">
                  <header>
                    <p className="text-xs font-medium uppercase tracking-[.18em] text-slate-400">Panel de control · {usuario?.organizacion}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Resumen de hoy</h1>
                    <p className="mt-2 text-sm text-slate-400">{new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: usuario?.timezone || 'America/Argentina/Buenos_Aires' }).format(new Date())}</p>
                  </header>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0b1624] p-5"><div><p className="text-sm font-medium">Tu página de reservas</p><p className="mt-1 text-xs text-slate-400">Compartila con tus clientes para recibir turnos.</p></div><div className="flex gap-2"><a href={urlPublica || '#'} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200">Abrir página ↗</a><button onClick={() => navigator.clipboard?.writeText(urlPublica)} disabled={!urlPublica} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-900 disabled:opacity-50">Copiar enlace</button></div></div>
                    {STATS.map((stat, i) => (
                      <div key={i} className="group bg-[#080a0f] border border-white/5 p-6 rounded-[2rem] hover:border-sky-500/50 transition-all cursor-default relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${stat.color} opacity-[0.03] rounded-bl-full`} />
                        <span className="text-xs font-semibold text-slate-500 mb-4 block">{stat.icon}</span>
                        <p className="text-3xl font-black tracking-tighter mb-1">{stat.valor}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/50 transition-colors">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#080a0f] border border-white/5 rounded-[2.5rem] overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest">Actividad Reciente - Turnos</h3>
                        <span className="px-3 py-1 bg-sky-500 text-black text-[10px] font-black rounded-full uppercase">En Vivo</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/[0.02]">
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/30">Usuario</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/30">Horario</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/30">Estado</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Control</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {turnosHoy.map((t) => (
                            <tr key={t.id} className="hover:bg-white/[0.02] transition-all group">
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-sky-600/10 border border-sky-600/20 flex items-center justify-center font-black text-sky-500 text-xs">
                                    {t.nombre?.[0]}{t.apellido?.[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{t.nombre || 'Cliente'} {t.apellido}</p>
                                    <p className="text-xs text-white/40">{t.email || 'Reserva online'} · {t.servicio || 'Servicio'}{t.profesional ? ` · ${t.profesional}` : ''}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <span className="font-mono text-lg font-black text-sky-500/80">{t.hora?.slice(0,5)}</span>
                              </td>
                              <td className="px-8 py-5">
                                <span className={`text-[10px] font-black uppercase px-4 py-2 rounded-full border ${
                                  t.estado === 'completado' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                                  t.estado === 'cancelado' ? 'border-red-500/30 text-red-400 bg-red-500/5' : 'border-sky-500/30 text-sky-500 bg-sky-500/5'
                                }`}>
                                  {t.estado}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex justify-end gap-2 opacity-100 transition-all">
                                  {t.estado === 'reservado' && (
                                    <button onClick={() => actualizarEstado(t.id, 'completado')} aria-label="Marcar asistencia" className="p-2 bg-sky-300 text-slate-950 rounded-lg hover:bg-white transition-colors">✓</button>
                                  )}
                                  {t.estado === 'reservado' && <button onClick={() => actualizarEstado(t.id, 'cancelado')} aria-label="Cancelar turno" className="p-2 bg-white/5 text-white/60 rounded-lg hover:text-rose-300 transition-colors">✕</button>}
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
                    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[.18em] text-slate-400">Directorio</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Clientes</h2></div><input value={filtroUsuarios} onChange={(e) => setFiltroUsuarios(e.target.value)} placeholder="Buscar nombre, email o documento" className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0c1a2b] px-4 py-3 text-sm text-white placeholder:text-white/35" /></div>
                    <div className="bg-[#080a0f] border border-white/5 rounded-[2.5rem] overflow-hidden p-2">
                        {/* Aquí podrías mapear la lista de usuarios con el mismo estilo de tabla elite */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                            {usuariosFiltrados.map(u => (
                                <div key={u.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl flex items-center justify-between hover:border-sky-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-xs font-medium tracking-widest">CL</div>
                                        <div>
                                            <p className="text-sm font-black uppercase">{u.nombre} {u.apellido}</p>
                                            <p className="text-xs text-white/45">{u.email}</p>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-slate-300">{u.rol}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              )}

              {seccion === 'turnos' && <section className="space-y-4"><h2 className="text-2xl font-semibold">Turnos de hoy</h2>{turnosHoy.length ? turnosHoy.map((turno) => <article key={turno.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0c1a2b] p-4"><div><p className="font-medium">{turno.nombre || 'Cliente'} {turno.apellido}</p><p className="text-sm text-slate-400">{turno.hora.slice(0, 5)} · {turno.servicio || 'Servicio'}{turno.profesional ? ` · ${turno.profesional}` : ''} · {turno.email || 'Reserva online'} · {turno.estado}</p></div>{turno.estado === 'reservado' && <div className="flex gap-2"><button onClick={() => actualizarEstado(turno.id, 'completado')} className="rounded-lg bg-sky-300 px-3 py-2 text-xs font-medium text-slate-950">Asistió</button><button onClick={() => actualizarEstado(turno.id, 'cancelado')} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Cancelar</button></div>}</article>) : <p className="rounded-xl border border-white/10 bg-[#0c1a2b] p-5 text-slate-400">No hay turnos para hoy.</p>}</section>}

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

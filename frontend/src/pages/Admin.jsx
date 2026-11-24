import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
        servicio: { ...servicio, capacidad: String(servicio.capacidad), duracion_minutos: String(servicio.duracion_minutos) },
        inicio: filas[0]?.hora_inicio || '09:00', fin: filas[0]?.hora_fin || '17:00', intervalo: String(filas[0]?.intervalo_minutos || servicio.duracion_minutos || 60),
        dias: filas.filter((h) => h.activo).map((h) => Number(h.dia_semana)),
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
      await api.put('/espacio', { nombre: config.organizacion.nombre, zonaHoraria: config.organizacion.zona_horaria, minutosCancelacion: Number(config.organizacion.minutos_cancelacion), servicio: { id: config.servicio.id, nombre: config.servicio.nombre, duracionMinutos: Number(config.servicio.duracion_minutos), capacidad: Number(config.servicio.capacidad) }, horarios, recursos: config.recursos });
      setMensaje('Cambios guardados. La agenda ya está actualizada.');
    } catch (err) { onError(err.response?.data?.error || 'No se pudo guardar'); }
    finally { setGuardando(false); }
  };

  return <form onSubmit={guardar} className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#0c1a2b] p-6">
    <div><h2 className="text-2xl font-semibold">Configuración del espacio</h2><p className="mt-1 text-sm text-slate-400">Servicios, horarios, cupos y reglas de cancelación.</p></div>
    {mensaje && <p role="status" className="rounded-lg bg-sky-300/10 p-3 text-sm text-sky-100">{mensaje}</p>}{error && <p role="alert" className="rounded-lg bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
    <label className="block space-y-2 text-sm text-slate-300">Nombre del negocio<input value={config.organizacion.nombre} onChange={(e) => cambiar('organizacion', { ...config.organizacion, nombre: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label>
    <label className="block space-y-2 text-sm text-slate-300">Zona horaria<select value={config.organizacion.zona_horaria} onChange={(e) => cambiar('organizacion', { ...config.organizacion, zona_horaria: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white"><option value="America/Argentina/Buenos_Aires">Argentina — Buenos Aires</option><option value="America/Santiago">Chile — Santiago</option><option value="America/Montevideo">Uruguay — Montevideo</option><option value="America/Mexico_City">México — Ciudad de México</option><option value="Europe/Madrid">España — Madrid</option><option value="UTC">UTC</option></select></label>
    <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm text-slate-300">Servicio<input value={config.servicio.nombre} onChange={(e) => cambiar('servicio', { ...config.servicio, nombre: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label><label className="space-y-2 text-sm text-slate-300">Capacidad por horario<input type="number" min="1" value={config.servicio.capacidad} onChange={(e) => cambiar('servicio', { ...config.servicio, capacidad: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label></div>
    <div className="grid gap-4 md:grid-cols-3"><label className="space-y-2 text-sm text-slate-300">Duración (minutos)<input type="number" min="5" step="5" value={config.servicio.duracion_minutos} onChange={(e) => cambiar('servicio', { ...config.servicio, duracion_minutos: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label><label className="space-y-2 text-sm text-slate-300">Abre<input type="time" value={config.inicio} onChange={(e) => cambiar('inicio', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white [color-scheme:dark]" required /></label><label className="space-y-2 text-sm text-slate-300">Cierra<input type="time" value={config.fin} onChange={(e) => cambiar('fin', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white [color-scheme:dark]" required /></label></div>
    <label className="block space-y-2 text-sm text-slate-300">Intervalo entre turnos (minutos)<input type="number" min="5" step="5" value={config.intervalo} onChange={(e) => cambiar('intervalo', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label>
    <fieldset><legend className="mb-3 text-sm text-slate-300">Días habilitados</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{DIAS.map((dia, index) => <label key={dia} className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm"><input type="checkbox" checked={config.dias.includes(index)} onChange={(e) => cambiar('dias', e.target.checked ? [...config.dias, index] : config.dias.filter((d) => d !== index))} />{dia}</label>)}</div></fieldset>
    <label className="block space-y-2 text-sm text-slate-300">Anticipación mínima para cancelar (minutos)<input type="number" min="0" max="10080" value={config.organizacion.minutos_cancelacion} onChange={(e) => cambiar('organizacion', { ...config.organizacion, minutos_cancelacion: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white" required /></label>
    <div><p className="mb-2 text-sm text-slate-300">Profesionales o recursos</p><div className="mb-3 flex gap-2"><input value={nuevoRecurso} onChange={(e) => setNuevoRecurso(e.target.value)} placeholder="Nombre del profesional o recurso" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07111f] px-4 py-3 text-white"/><button type="button" onClick={() => { if (nuevoRecurso.trim()) { cambiar('recursos', [...config.recursos, { nombre: nuevoRecurso.trim(), tipo: 'profesional' }]); setNuevoRecurso(''); } }} className="rounded-lg border border-white/15 px-4 text-sm hover:bg-white/5">Agregar</button></div><div className="flex flex-wrap gap-2">{config.recursos.length ? config.recursos.map((r, index) => <span key={r.id || `${r.nombre}-${index}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{r.nombre}</span>) : <span className="text-xs text-slate-500">Sin recursos agregados.</span>}</div></div>
    <button disabled={guardando} className="rounded-xl bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar configuración'}</button>
  </form>;
}

export default function Admin() {
  const [seccion, setSeccion] = useState('dashboard');
  const [usuarios, setUsuarios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [capacidadDia, setCapacidadDia] = useState(0);
  const [configError, setConfigError] = useState('');
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

  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: usuario?.timezone || 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const turnosHoy = turnos.filter(t => t.fecha?.split('T')[0] === hoy);
  const reservadosHoy = turnosHoy.filter(t => t.estado === 'reservado').length;
  const completadosHoy = turnosHoy.filter(t => t.estado === 'completado').length;
  const canceladosHoy = turnosHoy.filter(t => t.estado === 'cancelado').length;
  const ocupacion = capacidadDia ? Math.min(100, Math.round((reservadosHoy / capacidadDia) * 100)) : 0;
  const actualizarEstado = async (id, estado) => {
    try { await api.patch(`/turnos/${id}/estado`, { estado }); await cargarDatos(); }
    catch (err) { window.alert(err.response?.data?.error || 'No se pudo actualizar el turno'); }
  };

  const STATS = [
    { label: 'Usuarios Activos', valor: usuarios.length, icon: '👥', color: 'from-slate-400 to-sky-300' },
    { label: 'Turnos Hoy', valor: turnosHoy.length, icon: '📅', color: 'from-sky-600 to-slate-300' },
    { label: 'Check-in', valor: completadosHoy, icon: '✅', color: 'from-slate-500 to-sky-300' },
    { label: 'Cancelados', valor: canceladosHoy, icon: '🚫', color: 'from-slate-600 to-slate-400' },
    { label: 'Pendientes', valor: reservadosHoy, icon: '⏳', color: 'from-slate-400 to-sky-400' },
    { label: 'Ocupación', valor: ocupacion + '%', icon: '📈', color: 'from-sky-700 to-slate-300' },
  ];

  return (
    <div className="min-h-screen bg-[#05070a] text-white flex flex-col md:flex-row">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-72 border-r border-white/[0.05] bg-[#080a0f] p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center font-black shadow-lg shadow-sky-600/20">TC</div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide">{usuario?.organizacion || 'Agenda'}</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Administración</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'usuarios', label: 'Usuarios', icon: '👤', count: usuarios.length },
            { id: 'turnos', label: 'Turnos Hoy', icon: '🕒', count: turnosHoy.length },
            { id: 'calendario', label: 'Calendario', icon: '🗓️' },
            { id: 'configuracion', label: 'Configuración', icon: '⚙️' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSeccion(item.id)}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${
                seccion === item.id ? 'bg-sky-600 text-white shadow-xl shadow-sky-600/10' : 'text-white/40 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3"><span>{item.icon}</span> {item.label}</span>
              {item.count !== undefined && <span className="bg-white/10 px-2 py-1 rounded-lg text-[10px]">{item.count}</span>}
            </button>
          ))}
        </nav>

        <button onClick={() => navigate('/home')} className="p-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
          ← Volver al Terminal
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative h-screen">
        {/* Glow Effects */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-sky-600/5 rounded-full blur-[120px] pointer-events-none" />

        <header className="sticky top-0 z-40 backdrop-blur-md bg-[#05070a]/80 border-b border-white/[0.05] px-8 py-6 flex items-center justify-between md:hidden">
          <h2 className="font-black uppercase text-xs tracking-widest text-sky-500">Admin Panel</h2>
          <div className="w-8 h-8 rounded-full bg-sky-600" />
        </header>

        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-10">
          
          {cargando ? (
            <div className="h-[60vh] flex flex-col items-center justify-center animate-pulse">
              <div className="w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[.4em] text-white/20">Cargando Protocolos</p>
            </div>
          ) : (
            <div className="animate-fadeIn">
              
              {/* SECTION: DASHBOARD */}
              {seccion === 'dashboard' && (
                <div className="space-y-10">
                  <header>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter">Sistema de <span className="text-sky-500">Métricas</span></h1>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-2 italic">Análisis en tiempo real - {new Date().toLocaleDateString()}</p>
                  </header>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {STATS.map((stat, i) => (
                      <div key={i} className="group bg-[#080a0f] border border-white/5 p-6 rounded-[2rem] hover:border-sky-500/50 transition-all cursor-default relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${stat.color} opacity-[0.03] rounded-bl-full`} />
                        <span className="text-xl mb-4 block">{stat.icon}</span>
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
                                    <p className="text-sm font-black uppercase">{t.nombre} {t.apellido}</p>
                                    <p className="text-[10px] text-white/20 font-bold tracking-tight">ID: #{t.id}</p>
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
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
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
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter underline decoration-sky-500 underline-offset-8">Base de Datos <span className="text-sky-500">Usuarios</span></h2>
                    <div className="bg-[#080a0f] border border-white/5 rounded-[2.5rem] overflow-hidden p-2">
                        {/* Aquí podrías mapear la lista de usuarios con el mismo estilo de tabla elite */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                            {usuarios.map(u => (
                                <div key={u.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl flex items-center justify-between hover:border-sky-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-xl">👤</div>
                                        <div>
                                            <p className="text-sm font-black uppercase">{u.nombre} {u.apellido}</p>
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{u.documento}</p>
                                        </div>
                                    </div>
                                    <button className="text-[10px] font-black uppercase text-sky-500 border border-sky-500/20 px-4 py-2 rounded-xl hover:bg-sky-500 hover:text-black transition-all">Expediente</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              )}

              {seccion === 'turnos' && <section className="space-y-4"><h2 className="text-2xl font-semibold">Turnos de hoy</h2>{turnosHoy.length ? turnosHoy.map((turno) => <article key={turno.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0c1a2b] p-4"><div><p className="font-medium">{turno.nombre} {turno.apellido}</p><p className="text-sm text-slate-400">{turno.hora.slice(0, 5)} · {turno.servicio || 'Servicio'} · {turno.estado}</p></div>{turno.estado === 'reservado' && <div className="flex gap-2"><button onClick={() => actualizarEstado(turno.id, 'completado')} className="rounded-lg bg-sky-300 px-3 py-2 text-xs font-medium text-slate-950">Asistió</button><button onClick={() => actualizarEstado(turno.id, 'cancelado')} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Cancelar</button></div>}</article>) : <p className="rounded-xl border border-white/10 bg-[#0c1a2b] p-5 text-slate-400">No hay turnos para hoy.</p>}</section>}

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

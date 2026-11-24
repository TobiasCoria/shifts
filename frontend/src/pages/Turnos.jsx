import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const hoyLocal = (timeZone) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return f;
};

export default function Turnos() {
  const { usuario } = useAuth();
  const [servicios, setServicios] = useState([]);
  const [servicioId, setServicioId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [recursoId, setRecursoId] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [slots, setSlots] = useState([]);
  const [misTurnos, setMisTurnos] = useState([]);
  const [fecha, setFecha] = useState(() => hoyLocal(usuario?.timezone || 'America/Argentina/Buenos_Aires'));
  const [seleccionado, setSeleccionado] = useState('');
  const [vista, setVista] = useState('reservar');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const navigate = useNavigate();

  const cargarTurnos = useCallback(async () => {
    try { const { data } = await api.get('/turnos/mis-turnos'); setMisTurnos(data); }
    catch (err) { setError(err.response?.data?.error || 'No se pudieron cargar tus reservas'); }
  }, []);

  const cargarDisponibilidad = useCallback(async () => {
    try {
      const { data } = await api.get('/turnos/disponibilidad', { params: { fecha, servicioId: servicioId || undefined, sucursalId: sucursalId || undefined, recursoId: recursoId || undefined } });
      setServicios(data.servicios || []);
      setSucursales(data.sucursales || []);
      setSucursalId((old) => old || String(data.sucursalId || ''));
      setRecursos(data.recursos || []);
      if (!servicioId && data.servicio?.id) setServicioId(String(data.servicio.id));
      setSlots(data.slots || []);
      setError('');
    } catch (err) { setSlots([]); setError(err.response?.data?.error || 'No se pudo consultar la disponibilidad'); }
  }, [fecha, recursoId, servicioId, sucursalId]);

  useEffect(() => { void cargarDisponibilidad(); }, [cargarDisponibilidad]);
  useEffect(() => { void cargarTurnos(); }, [cargarTurnos]);

  const reservar = async () => {
    if (!seleccionado) return;
    setCargando(true); setError('');
    try {
      await api.post('/turnos', { fecha, hora: `${seleccionado}:00`, servicioId: Number(servicioId), sucursalId: sucursalId || undefined, recursoId: recursoId || undefined });
      setConfirmado(true); setSeleccionado(''); await Promise.all([cargarDisponibilidad(), cargarTurnos()]);
      window.setTimeout(() => setConfirmado(false), 2200);
    } catch (err) { setError(err.response?.data?.error || 'No se pudo reservar el turno'); await cargarDisponibilidad(); }
    finally { setCargando(false); }
  };

  const cancelar = async (id) => {
    setError('');
    try { await api.patch(`/turnos/${id}/cancelar`); await Promise.all([cargarTurnos(), cargarDisponibilidad()]); }
    catch (err) { setError(err.response?.data?.error || 'No se pudo cancelar el turno'); }
  };

  const fechaLegible = (valor) => new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#15263b]">
      <header className="sticky top-0 z-30 border-b border-[#dfe4ea] bg-white/95 px-5 py-4 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button onClick={() => navigate('/home')} className="rounded-lg border border-[#dfe4ea] px-3 py-2 text-sm text-[#526981] hover:bg-[#f6f7f8]">← Inicio</button>
          <div className="text-right"><p className="text-sm font-semibold tracking-wide">Agenda de turnos</p><p className="text-xs text-[#718197]">Elegí servicio, día y horario</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 pb-28 md:px-10">
        <div className="flex gap-2 rounded-xl border border-[#dfe4ea] bg-white p-1">
          {['reservar', 'mis-turnos'].map((tab) => <button key={tab} onClick={() => setVista(tab)} className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition ${vista === tab ? 'bg-[#142942] text-white' : 'text-[#718197] hover:text-[#15263b]'}`}>{tab === 'reservar' ? 'Reservar' : `Mis reservas (${misTurnos.filter((t) => t.estado === 'reservado').length})`}</button>)}
        </div>
        {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {vista === 'reservar' ? <>
          <section className="grid gap-4 rounded-2xl border border-[#dfe4ea] bg-white p-5 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[#526981]"><span>Servicio</span><select value={servicioId} onChange={(e) => { setServicioId(e.target.value); setRecursoId(''); setSeleccionado(''); }} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]">{servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
            {sucursales.length > 1 && <label className="space-y-2 text-sm text-[#526981]"><span>Sucursal</span><select value={sucursalId} onChange={(e) => { setSucursalId(e.target.value); setRecursoId(''); setSeleccionado(''); }} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]">{sucursales.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select></label>}
            {servicios.find((s) => Number(s.id) === Number(servicioId))?.capacidad <= 1 && recursos.length > 0 && <label className="space-y-2 text-sm text-[#526981]"><span>Profesional</span><select value={recursoId} onChange={(e) => { setRecursoId(e.target.value); setSeleccionado(''); }} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]"><option value="">Cualquiera disponible</option>{recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label>}
            <label className="space-y-2 text-sm text-[#526981]"><span>Fecha</span><input type="date" value={fecha} min={hoyLocal(usuario?.timezone || 'America/Argentina/Buenos_Aires')} onChange={(e) => { setFecha(e.target.value); setSeleccionado(''); }} className="w-full rounded-lg border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b] [color-scheme:light]" /></label>
            <div className="md:col-span-2"><p className="mb-1 font-medium capitalize">{fechaLegible(fecha)}</p><p className="text-xs text-[#718197]">Los horarios y cupos dependen de la configuración del espacio.</p></div>
          </section>
          <section className="rounded-2xl border border-[#dfe4ea] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-[#526981]">Horarios disponibles</h2>
            {slots.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{slots.map((slot) => <button key={slot.hora} disabled={!slot.disponible} onClick={() => setSeleccionado(slot.hora)} className={`rounded-xl border px-3 py-4 text-left transition ${seleccionado === slot.hora ? 'border-[#142942] bg-[#142942] text-white' : slot.disponible ? 'border-[#dfe4ea] bg-white hover:border-[#73889e]' : 'cursor-not-allowed border-[#eceff2] bg-[#f5f7f9] text-[#abb4be]'}`}><span className="block font-semibold">{slot.hora}</span><span className="mt-1 block text-xs opacity-70">{slot.disponible ? `${slot.capacidad - slot.ocupados} lugares` : 'Completo'}</span></button>)}</div> : <p className="rounded-lg bg-[#f5f7f9] p-5 text-sm text-[#718197]">No hay horarios disponibles para este día.</p>}
          </section>
          <div className="sticky bottom-4 flex justify-end"><button onClick={reservar} disabled={!seleccionado || cargando} className="rounded-xl bg-sky-300 px-7 py-4 text-sm font-semibold text-slate-950 shadow-lg shadow-black/30 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">{cargando ? 'Procesando…' : seleccionado ? `Confirmar ${seleccionado}` : 'Seleccioná un horario'}</button></div>
        </> : <section className="space-y-3">{misTurnos.length ? misTurnos.map((turno) => <article key={turno.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#dfe4ea] bg-white p-5 sm:flex-row sm:items-center"><div><p className="font-semibold capitalize">{fechaLegible(turno.fecha)}</p><p className="mt-1 text-sm text-[#718197]">{turno.hora.slice(0, 5)} · {turno.servicio || 'Servicio'}{turno.profesional ? ` · ${turno.profesional}` : ''}{turno.sucursal ? ` · ${turno.sucursal}` : ''}</p></div><div className="flex items-center gap-3"><span className="rounded-full border border-[#cbd5df] bg-[#f4f6f8] px-3 py-1 text-xs text-[#526981]">{turno.estado}</span>{turno.estado === 'reservado' && <button onClick={() => cancelar(turno.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50">Cancelar</button>}</div></article>) : <p className="rounded-xl border border-[#dfe4ea] bg-white p-8 text-center text-[#718197]">Todavía no tenés reservas.</p>}</section>}
      </main>
      {confirmado && <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[#a9c5b4] bg-[#e8f1eb] px-6 py-4 text-sm text-[#315640] shadow-2xl">Reserva confirmada. Te enviamos un correo.</div>}
    </div>
  );
}

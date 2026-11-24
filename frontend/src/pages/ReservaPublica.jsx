import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

const fechaHoy = (zona = 'America/Argentina/Buenos_Aires') => {
  const partes = new Intl.DateTimeFormat('en', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).reduce((resultado, parte) => ({ ...resultado, [parte.type]: parte.value }), {});
  return `${partes.year}-${partes.month}-${partes.day}`;
};

export default function ReservaPublica() {
  const { slug } = useParams();
  const [espacio, setEspacio] = useState(null);
  const [servicioId, setServicioId] = useState('');
  const [recursoId, setRecursoId] = useState('');
  const [fecha, setFecha] = useState(fechaHoy());
  const [slots, setSlots] = useState([]);
  const [seleccionado, setSeleccionado] = useState('');
  const [cliente, setCliente] = useState({ nombre: '', email: '' });
  const [urlCancelar, setUrlCancelar] = useState('');
  const [estado, setEstado] = useState({ cargando: true, enviando: false, error: '', exito: '' });

  useEffect(() => {
    api.get(`/espacio/publico/${encodeURIComponent(slug)}`).then(({ data }) => {
      setEspacio(data);
      setServicioId(String(data.servicios[0]?.id || ''));
      setFecha(fechaHoy(data.organizacion.zona_horaria));
    }).catch((err) => setEstado((s) => ({ ...s, error: err.response?.data?.error || 'No se pudo abrir la página de reservas' }))).finally(() => setEstado((s) => ({ ...s, cargando: false })));
  }, [slug]);

  const cargarDisponibilidad = useCallback(async () => {
    if (!servicioId || !fecha) return setSlots([]);
    try {
      const { data } = await api.get('/turnos/disponibilidad-publica', { params: { slug, servicioId, fecha, recursoId: recursoId || undefined } });
      setSlots(data.slots);
      setEstado((s) => ({ ...s, error: '' }));
    } catch (err) {
      setSlots([]);
      setEstado((s) => ({ ...s, error: err.response?.data?.error || 'No se pudo consultar disponibilidad' }));
    }
  }, [fecha, recursoId, servicioId, slug]);

  useEffect(() => { void cargarDisponibilidad(); }, [cargarDisponibilidad]);

  const reservar = async (event) => {
    event.preventDefault();
    if (!seleccionado) return;
    setEstado((s) => ({ ...s, enviando: true, error: '', exito: '' }));
    try {
      const { data } = await api.post('/turnos/publico', { organizacionSlug: slug, servicioId: Number(servicioId), recursoId: recursoId || undefined, fecha, hora: seleccionado, ...cliente });
      setUrlCancelar(data.urlCancelar);
      setEstado((s) => ({ ...s, exito: `Tu turno está confirmado${data.profesional ? ` con ${data.profesional}` : ''}. Guardá este enlace para gestionar la cancelación si lo necesitás.` }));
      setSeleccionado('');
      setCliente({ nombre: '', email: '' });
      await cargarDisponibilidad();
    } catch (err) {
      setEstado((s) => ({ ...s, error: err.response?.data?.error || 'No se pudo confirmar la reserva' }));
      await cargarDisponibilidad();
    } finally { setEstado((s) => ({ ...s, enviando: false })); }
  };

  if (estado.cargando) return <main className="min-h-screen grid place-items-center bg-[#f4f6f8] text-[#15263b]">Cargando agenda…</main>;
  if (!espacio) return <main className="min-h-screen grid place-items-center bg-[#f4f6f8] p-6 text-center text-[#15263b]"><div><p className="text-2xl font-semibold">No encontramos este negocio</p><Link className="mt-4 inline-block text-sm underline" to="/">Ir a SHIFTS</Link></div></main>;

  const servicio = espacio.servicios.find((item) => String(item.id) === servicioId);
  const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(`Reservá en ${espacio.organizacion.nombre}: ${window.location.href}`)}`;
  return <main className="min-h-screen bg-[#f4f6f8] text-[#15263b]">
    <header className="border-b border-[#dfe4ea] bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#142942] text-sm font-bold text-white">S</span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#62748a]">Reservas online</p><h1 className="font-semibold">{espacio.organizacion.nombre}</h1></div></div><span className="rounded-full border border-[#dfe4ea] px-3 py-1 text-xs capitalize text-[#62748a]">{espacio.organizacion.tipo_negocio}</span></div></header>
    <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[.8fr_1.2fr] lg:py-12">
      <section className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#64778d]">SHIFTS · Agenda del negocio</p><h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Reservá tu próximo turno</h2><p className="mt-3 leading-7 text-[#65758a]">Elegí el servicio y un horario que te quede cómodo. La reserva queda confirmada al enviarla.</p></div>
        <div className="rounded-2xl border border-[#dfe4ea] bg-white p-5"><p className="text-sm font-semibold">Servicios disponibles</p><div className="mt-4 space-y-3">{espacio.servicios.map((item) => <button key={item.id} type="button" onClick={() => { setServicioId(String(item.id)); setSeleccionado(''); }} className={`w-full rounded-xl border p-4 text-left transition ${servicioId === String(item.id) ? 'border-[#345574] bg-[#f2f6fa]' : 'border-[#e8ecf0] hover:border-[#afbdca]'}`}><span className="flex justify-between gap-4 font-medium">{item.nombre}<span className="text-sm text-[#526981]">{item.precio == null ? '' : `$${Number(item.precio).toLocaleString('es-AR')}`}</span></span><span className="mt-1 block text-sm text-[#718197]">{item.duracion_minutos} minutos{item.descripcion ? ` · ${item.descripcion}` : ''}</span></button>)}</div></div>
        <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[#355a77]">Compartir reserva por WhatsApp <span aria-hidden="true">↗</span></a>
      </section>
      <form onSubmit={reservar} className="space-y-5 rounded-2xl border border-[#dfe4ea] bg-white p-5 shadow-[0_12px_40px_rgba(20,41,66,.06)] md:p-7"><div><h3 className="text-lg font-semibold">Elegí fecha y horario</h3><p className="mt-1 text-sm text-[#718197]">{servicio ? `${servicio.nombre} · ${servicio.duracion_minutos} min` : 'Seleccioná un servicio'}</p></div>
        {servicio && Number(servicio.capacidad) <= 1 && espacio.recursos.length > 0 && <label className="block space-y-2 text-sm font-medium">Profesional<select value={recursoId} onChange={(e) => { setRecursoId(e.target.value); setSeleccionado(''); }} className="w-full rounded-xl border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b]"><option value="">Cualquiera disponible</option>{espacio.recursos.map((recurso) => <option key={recurso.id} value={recurso.id}>{recurso.nombre}</option>)}</select></label>}
        <label className="block space-y-2 text-sm font-medium">Fecha<input type="date" min={fechaHoy(espacio.organizacion.zona_horaria)} value={fecha} onChange={(e) => { setFecha(e.target.value); setSeleccionado(''); }} className="w-full rounded-xl border border-[#dfe4ea] bg-white px-4 py-3 text-[#15263b] [color-scheme:light]" required /></label>
        <div><p className="mb-3 text-sm font-medium">Horarios disponibles</p>{slots.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((slot) => <button key={slot.hora} type="button" disabled={!slot.disponible} onClick={() => setSeleccionado(slot.hora)} className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${seleccionado === slot.hora ? 'border-[#142942] bg-[#142942] text-white' : slot.disponible ? 'border-[#dfe4ea] hover:border-[#73889e]' : 'cursor-not-allowed border-[#eceff2] text-[#abb4be]'}`}>{slot.hora}</button>)}</div> : <p className="rounded-xl bg-[#f5f7f9] p-4 text-sm text-[#718197]">No hay horarios disponibles para esa fecha.</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium">Tu nombre<input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} autoComplete="name" maxLength="120" className="w-full rounded-xl border border-[#dfe4ea] px-4 py-3 outline-none focus:border-[#73889e]" required /></label><label className="block space-y-2 text-sm font-medium">Correo electrónico<input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} autoComplete="email" maxLength="254" className="w-full rounded-xl border border-[#dfe4ea] px-4 py-3 outline-none focus:border-[#73889e]" required /></label></div>
        {estado.error && <p role="alert" className="rounded-xl bg-[#fff0f0] p-3 text-sm text-[#a13c46]">{estado.error}</p>}{estado.exito && <div role="status" className="space-y-2 rounded-xl bg-[#edf6f0] p-3 text-sm text-[#28633e]"><p>{estado.exito}</p>{urlCancelar && <a className="inline-block font-semibold underline" href={urlCancelar}>Gestionar cancelación</a>}</div>}
        <button disabled={!seleccionado || estado.enviando} className="w-full rounded-xl bg-[#142942] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#233c58] disabled:cursor-not-allowed disabled:opacity-45">{estado.enviando ? 'Confirmando…' : seleccionado ? `Confirmar ${seleccionado}` : 'Elegí un horario'}</button><p className="text-center text-xs text-[#8794a3]">Al confirmar, aceptás la política de cancelación de este negocio.</p>
      </form>
    </div><footer className="border-t border-[#dfe4ea] px-5 py-6 text-center text-xs text-[#8290a0]">Agenda administrada con SHIFTS · <Link className="underline" to="/">Conocé SHIFTS</Link></footer>
  </main>;
}

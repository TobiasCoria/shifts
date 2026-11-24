import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const rubros = [
  ['gimnasio', 'Gimnasio / Fitness'], ['barberia', 'Barbería'], ['peluqueria', 'Peluquería'], ['estetica', 'Estética / Spa'],
  ['consultorio', 'Consultorio'], ['tatuajes', 'Estudio de tatuajes'], ['clases', 'Academia / Clases'], ['general', 'Otro negocio'],
];
const inputClass = 'w-full rounded-xl border border-white/10 bg-[#0c1726] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-slate-300/60';
const labelClass = 'block space-y-2 text-sm font-medium text-slate-300';

export default function Login() {
  const [vista, setVista] = useState('login');
  const [modo, setModo] = useState('email');
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', documento: '', contrasena: '', confirmar: '', negocio: '', tipoNegocio: 'gimnasio', zonaHoraria: 'America/Argentina/Buenos_Aires' });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const cambiar = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));

  const handleLogin = async (event) => {
    event.preventDefault(); setCargando(true); setError('');
    try {
      const body = { contrasena: form.contrasena, ...(modo === 'email' ? { email: form.email } : { documento: form.documento }) };
      const { data } = await api.post('/auth/login', body); login(data.usuario); navigate('/home');
    } catch (err) { setError(err.response?.data?.error || 'No se pudo iniciar sesión. Revisá los datos e intentá de nuevo.'); }
    finally { setCargando(false); }
  };

  const handleRegistro = async (event) => {
    event.preventDefault(); setError(''); setExito('');
    if (form.contrasena !== form.confirmar) return setError('Las contraseñas no coinciden');
    if (form.contrasena.length < 10) return setError('La contraseña necesita al menos 10 caracteres');
    setCargando(true);
    try {
      await api.post('/auth/registro', { nombre: form.nombre, apellido: form.apellido, email: form.email, documento: form.documento, contrasena: form.contrasena, negocio: form.negocio, tipoNegocio: form.tipoNegocio, zonaHoraria: form.zonaHoraria });
      setExito('Espacio creado. Ya podés iniciar sesión.');
      window.setTimeout(() => { setVista('login'); setExito(''); setForm((actual) => ({ ...actual, contrasena: '', confirmar: '' })); }, 1600);
    } catch (err) { setError(err.response?.data?.error || 'No se pudo crear el espacio'); }
    finally { setCargando(false); }
  };

  return <main className="min-h-screen bg-[#101a29] p-4 text-white sm:p-8">
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#111d2d] shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden flex-col justify-between bg-[#152a42] p-12 lg:flex"><div><div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 text-xl font-bold">S</div><p className="mt-10 text-xs font-semibold uppercase tracking-[.25em] text-slate-300">Operaciones simples. Tiempo mejor organizado.</p><h1 className="mt-4 max-w-lg text-5xl font-semibold leading-tight tracking-tight">Cada turno, en su lugar.</h1><p className="mt-5 max-w-md leading-7 text-slate-300">SHIFTS reúne reservas, agenda y clientes para negocios que trabajan con citas y clases.</p></div><div className="grid grid-cols-3 gap-3 text-xs text-slate-300"><span className="rounded-xl border border-white/10 p-3">Agenda clara</span><span className="rounded-xl border border-white/10 p-3">Reservas online</span><span className="rounded-xl border border-white/10 p-3">Tu negocio</span></div></section>
      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12"><div className="w-full max-w-md">
        <header className="mb-8"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#284361] text-xl font-bold">S</div><h2 className="mt-5 text-3xl font-semibold tracking-tight">SHIFTS</h2><p className="mt-1 text-sm text-white/45">{vista === 'login' ? 'Gestión de turnos para tu negocio' : 'Creá el espacio de tu negocio'}</p></header>
        {vista === 'login' ? <form onSubmit={handleLogin} className="space-y-5"><div className="mb-6"><h3 className="text-xl font-semibold">Bienvenido</h3><p className="mt-1 text-sm text-white/45">Ingresá a tu espacio de trabajo.</p></div>
          <div className="flex rounded-xl bg-black/25 p-1">{[['email', 'Correo'], ['documento', 'Documento']].map(([key, label]) => <button type="button" key={key} onClick={() => setModo(key)} className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${modo === key ? 'bg-[#314e6d] text-white' : 'text-white/45 hover:text-white'}`}>{label}</button>)}</div>
          <label className={labelClass}>{modo === 'email' ? 'Correo electrónico' : 'Documento'}<input className={inputClass} type={modo === 'email' ? 'email' : 'text'} autoComplete={modo === 'email' ? 'email' : 'off'} placeholder={modo === 'email' ? 'nombre@negocio.com' : 'DNI o CI'} value={modo === 'email' ? form.email : form.documento} onChange={(event) => cambiar(modo, event.target.value)} required /></label>
          <label className={labelClass}>Contraseña<input className={inputClass} type="password" autoComplete="current-password" value={form.contrasena} onChange={(event) => cambiar('contrasena', event.target.value)} required /></label>
          {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200">{error}</p>}{exito && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-200">{exito}</p>}
          <button disabled={cargando} className="w-full rounded-xl bg-[#dce4ed] py-3.5 text-sm font-semibold text-[#13243a] transition hover:bg-white disabled:opacity-50">{cargando ? 'Ingresando…' : 'Iniciar sesión'}</button>
          <p className="pt-3 text-center text-sm text-white/50">¿Primera vez acá? <button type="button" onClick={() => { setVista('registro'); setError(''); }} className="font-semibold text-white hover:underline">Crear un espacio</button></p>
        </form> : <form onSubmit={handleRegistro} className="space-y-4"><div><h3 className="text-xl font-semibold">Configurá tu negocio</h3><p className="mt-1 text-sm text-white/45">La plantilla inicial se puede editar desde tu panel.</p></div>
          <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Nombre<input className={inputClass} autoComplete="given-name" value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} required /></label><label className={labelClass}>Apellido<input className={inputClass} autoComplete="family-name" value={form.apellido} onChange={(e) => cambiar('apellido', e.target.value)} required /></label></div>
          <label className={labelClass}>Correo electrónico<input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={(e) => cambiar('email', e.target.value)} required /></label>
          <label className={labelClass}>Nombre del negocio<input className={inputClass} value={form.negocio} onChange={(e) => cambiar('negocio', e.target.value)} placeholder="Ej.: Estudio Norte" required /></label>
          <label className={labelClass}>Rubro<select className={inputClass} value={form.tipoNegocio} onChange={(e) => cambiar('tipoNegocio', e.target.value)}>{rubros.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className={labelClass}>Zona horaria<select className={inputClass} value={form.zonaHoraria} onChange={(e) => cambiar('zonaHoraria', e.target.value)}><option value="America/Argentina/Buenos_Aires">Argentina — Buenos Aires</option><option value="America/Santiago">Chile — Santiago</option><option value="America/Montevideo">Uruguay — Montevideo</option><option value="America/Mexico_City">México — Ciudad de México</option><option value="Europe/Madrid">España — Madrid</option><option value="UTC">UTC</option></select></label>
          <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Contraseña<input className={inputClass} type="password" autoComplete="new-password" minLength="10" value={form.contrasena} onChange={(e) => cambiar('contrasena', e.target.value)} required /></label><label className={labelClass}>Confirmar contraseña<input className={inputClass} type="password" autoComplete="new-password" value={form.confirmar} onChange={(e) => cambiar('confirmar', e.target.value)} required /></label></div>
          {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200">{error}</p>}{exito && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-200">{exito}</p>}
          <button disabled={cargando} className="w-full rounded-xl bg-[#dce4ed] py-3.5 text-sm font-semibold text-[#13243a] transition hover:bg-white disabled:opacity-50">{cargando ? 'Creando…' : 'Crear espacio'}</button><p className="text-center text-sm text-white/50">¿Ya tenés cuenta? <button type="button" onClick={() => { setVista('login'); setError(''); }} className="font-semibold text-white hover:underline">Iniciar sesión</button></p>
        </form>}
        <p className="mt-8 text-center text-xs text-white/30">Tu agenda, tus clientes, en orden.</p>
      </div></section>
    </div>
  </main>;
}

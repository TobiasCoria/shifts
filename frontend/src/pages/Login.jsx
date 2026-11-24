import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Brand from '../components/Brand';

const rubros = [
  ['gimnasio', 'Gimnasio / Fitness'], ['barberia', 'Barbería'], ['peluqueria', 'Peluquería'], ['estetica', 'Estética / Spa'],
  ['consultorio', 'Consultorio'], ['tatuajes', 'Estudio de tatuajes'], ['clases', 'Academia / Clases'], ['general', 'Otro negocio'],
];
const vacio = { nombre: '', apellido: '', email: '', documento: '', contrasena: '', confirmar: '', negocio: '', tipoNegocio: 'gimnasio', zonaHoraria: 'America/Argentina/Buenos_Aires', espacio: '' };

function CampoContrasena({ label, value, onChange, autoComplete, minLength, placeholder }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return <div className="auth-password-field">
    <label className="auth-label" htmlFor={id}>{label}</label>
    <div className="auth-password-wrap">
      <input id={id} className="auth-input auth-password-input" type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} required />
      <button type="button" className="auth-password-toggle" onClick={() => setVisible((actual) => !actual)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
        {visible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.7 10.7 0 0112 5c5.5 0 9 5.2 9 7a9 9 0 01-2.1 3.1M6.2 6.2C3.7 7.8 2 10.5 2 12c0 1.8 3.5 7 10 7 1 0 2-.2 2.9-.5"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>}
        <span>{visible ? 'Ocultar' : 'Mostrar'}</span>
      </button>
    </div>
  </div>;
}

function obtenerSlug(valor) {
  const input = valor.trim();
  if (!input) return '';
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    const match = url.pathname.match(/\/b\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]).toLowerCase();
  } catch { /* acepta también el slug directo */ }
  return input.replace(/^\/?b\//, '').replace(/\/$/, '').toLowerCase();
}

export default function Login() {
  const [vista, setVista] = useState('login');
  const [modo, setModo] = useState('email');
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const cambiar = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));
  const cambiarVista = (siguiente) => { setVista(siguiente); setError(''); setExito(''); };

  const handleLogin = async (event) => {
    event.preventDefault(); setCargando(true); setError('');
    try {
      const body = { contrasena: form.contrasena, ...(modo === 'email' ? { email: form.email } : { documento: form.documento }) };
      const { data } = await api.post('/auth/login', body); login(data.usuario); navigate('/home');
    } catch (err) { setError(err.response?.data?.error || 'No se pudo iniciar sesión. Revisá tus datos e intentá de nuevo.'); }
    finally { setCargando(false); }
  };

  const handleRegistro = async (event) => {
    event.preventDefault(); setError(''); setExito('');
    if (form.contrasena !== form.confirmar) return setError('Las contraseñas no coinciden.');
    if (form.contrasena.length < 10) return setError('La contraseña necesita al menos 10 caracteres.');
    setCargando(true);
    try {
      if (vista === 'registro-cliente') {
        const slug = obtenerSlug(form.espacio);
        const { data } = await api.post('/auth/registro-cliente', { nombre: form.nombre, apellido: form.apellido, email: form.email, contrasena: form.contrasena, slug });
        login(data.usuario); navigate('/home');
      } else {
        await api.post('/auth/registro', { nombre: form.nombre, apellido: form.apellido, email: form.email, documento: form.documento, contrasena: form.contrasena, negocio: form.negocio, tipoNegocio: form.tipoNegocio, zonaHoraria: form.zonaHoraria });
        setExito('Espacio creado. Ya podés iniciar sesión como administrador.');
        setTimeout(() => { cambiarVista('login'); setForm((actual) => ({ ...actual, contrasena: '', confirmar: '' })); }, 1700);
      }
    } catch (err) { setError(err.response?.data?.error || (vista === 'registro-cliente' ? 'No se pudo crear la cuenta.' : 'No se pudo crear el espacio.')); }
    finally { setCargando(false); }
  };

  const titulo = vista === 'registro-espacio' ? 'Tu negocio, mejor organizado.' : vista === 'registro-cliente' ? 'Tu agenda empieza acá.' : vista === 'elegir' ? 'Una cuenta para cada necesidad.' : 'Todo tu día, en orden.';
  const descripcion = vista === 'registro-espacio'
    ? 'Creá un espacio de trabajo para tu local y configurá tus servicios, equipo y reservas.'
    : vista === 'registro-cliente'
      ? 'Creá una cuenta para reservar y consultar tus turnos en el local que te invitó.'
      : vista === 'elegir'
        ? 'Administrá tu local o creá una cuenta para reservar en el espacio que te compartieron.'
        : 'Reservas, equipo y operación en una experiencia clara para vos y tus clientes.';

  return <main className={`auth-page auth-view-${vista}`}>
    <div className="auth-shell">
      <aside className="auth-side">
        <div className="auth-side-top"><Brand light /></div>
        <div className="auth-side-message" key={vista}>
          <span className="auth-eyebrow">Una plataforma. Tu forma de trabajar.</span>
          <h1>{vista === 'login' ? <>Todo tu día,<br />en orden.</> : titulo}</h1>
          <p>{descripcion}</p>
        </div>
        <div className="auth-side-bottom">
          <div className="auth-feature"><span>01</span><div><strong>Una agenda clara</strong><small>Turnos y disponibilidad en un mismo lugar.</small></div></div>
          <div className="auth-feature"><span>02</span><div><strong>Hecho para cada local</strong><small>Gimnasios, estudios y servicios.</small></div></div>
          <p className="auth-side-note">Menos coordinación. Más tiempo para lo que importa.</p>
        </div>
        <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
      </aside>

      <section className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-content" key={vista}>
          <div className="auth-heading">
            <span className="auth-kicker">{vista === 'login' ? 'TU ESPACIO SHIFTS' : vista === 'registro-cliente' ? 'CUENTA DE CLIENTE' : vista === 'registro-espacio' ? 'NUEVO ESPACIO' : 'EMPEZAR'}</span>
            <h2>{vista === 'login' ? 'Qué bueno verte.' : vista === 'elegir' ? '¿Cómo querés usar SHIFTS?' : vista === 'registro-cliente' ? 'Creá tu cuenta' : vista === 'registro-espacio' ? 'Creá tu espacio' : 'Elegí cómo empezar'}</h2>
            <p>{vista === 'login' ? 'Iniciá sesión para continuar.' : vista === 'elegir' ? 'Son dos accesos distintos. Elegí el que necesitás.' : vista === 'registro-cliente' ? 'Vas a entrar al espacio del local que te compartió su enlace.' : vista === 'registro-espacio' ? 'Este espacio será el panel de gestión de tu negocio.' : 'Podés crear el espacio de un negocio o una cuenta de cliente.'}</p>
          </div>

          {vista === 'login' && <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-mode" role="group" aria-label="Método de acceso">{[['email', 'Correo electrónico'], ['documento', 'Documento']].map(([key, label]) => <button type="button" key={key} onClick={() => setModo(key)} className={modo === key ? 'is-active' : ''}>{label}</button>)}</div>
            <label className="auth-label">{modo === 'email' ? 'Correo electrónico' : 'Documento'}<input className="auth-input" type={modo === 'email' ? 'email' : 'text'} autoComplete={modo === 'email' ? 'email' : 'off'} placeholder={modo === 'email' ? 'nombre@correo.com' : 'DNI o CI'} value={modo === 'email' ? form.email : form.documento} onChange={(event) => cambiar(modo, event.target.value)} required /></label>
            <CampoContrasena label="Contraseña" autoComplete="current-password" placeholder="Tu contraseña" value={form.contrasena} onChange={(value) => cambiar('contrasena', value)} />
            {error && <p role="alert" className="auth-alert auth-error">{error}</p>}{exito && <p role="status" className="auth-alert auth-success">{exito}</p>}
            <button disabled={cargando} className="auth-submit"><span className="auth-submit-copy">{cargando && <i className="auth-spinner" aria-hidden="true" />}{cargando ? 'Ingresando…' : 'Iniciar sesión'}</span><span className="auth-submit-arrow" aria-hidden="true">→</span></button>
            <p className="auth-switch">¿Todavía no usás SHIFTS? <button type="button" onClick={() => cambiarVista('elegir')}>Elegí cómo empezar</button></p>
          </form>}

          {vista === 'elegir' && <div className="auth-choice-list">
            <button className="auth-choice" type="button" onClick={() => cambiarVista('registro-espacio')}><span className="auth-choice-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V6.5L12 3l8 3.5V20M2.5 20h19M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M10 20v-4h4v4"/></svg></span><span><strong>Crear espacio para mi local</strong><small>Para propietarios y administradores que quieren gestionar un negocio.</small></span><b aria-hidden="true">→</b></button>
            <button className="auth-choice" type="button" onClick={() => cambiarVista('registro-cliente')}><span className="auth-choice-icon auth-choice-icon-light"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.5A5.5 5.5 0 018 13h2a5.5 5.5 0 015.5 5.5V20M19 8v7M15.5 11.5h7"/></svg></span><span><strong>Crear cuenta para usar un local</strong><small>Para clientes que recibieron un enlace de reservas o invitación.</small></span><b aria-hidden="true">→</b></button>
            <p className="auth-switch"><button type="button" onClick={() => cambiarVista('login')}>Volver a iniciar sesión</button></p>
          </div>}

          {(vista === 'registro-espacio' || vista === 'registro-cliente') && <form onSubmit={handleRegistro} className="auth-form auth-register-form">
            <div className="auth-form-top"><button className="auth-back" type="button" onClick={() => cambiarVista('elegir')}>← Cambiar tipo de alta</button><span className="auth-step">{vista === 'registro-espacio' ? 'NEGOCIO' : 'CLIENTE'}</span></div>
            {vista === 'registro-cliente' && <label className="auth-label">Enlace del local o código del espacio<input className="auth-input" autoComplete="url" placeholder="shifts.app/b/mi-local" value={form.espacio} onChange={(e) => cambiar('espacio', e.target.value)} required /><small className="auth-hint">Pedí el enlace de reservas al local. También podés pegar la URL completa.</small></label>}
            <div className="auth-fields-two"><label className="auth-label">Nombre<input className="auth-input" autoComplete="given-name" value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} required /></label><label className="auth-label">Apellido<input className="auth-input" autoComplete="family-name" value={form.apellido} onChange={(e) => cambiar('apellido', e.target.value)} required /></label></div>
            <label className="auth-label">Correo electrónico<input className="auth-input" type="email" autoComplete="email" placeholder="nombre@correo.com" value={form.email} onChange={(e) => cambiar('email', e.target.value)} required /></label>
            {vista === 'registro-espacio' ? <>
              <label className="auth-label">Nombre del local<input className="auth-input" autoComplete="organization" placeholder="Ej.: Estudio Norte" value={form.negocio} onChange={(e) => cambiar('negocio', e.target.value)} required /></label>
              <div className="auth-fields-two"><label className="auth-label">Rubro<select className="auth-input" value={form.tipoNegocio} onChange={(e) => cambiar('tipoNegocio', e.target.value)}>{rubros.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="auth-label">Zona horaria<select className="auth-input" value={form.zonaHoraria} onChange={(e) => cambiar('zonaHoraria', e.target.value)}><option value="America/Argentina/Buenos_Aires">Argentina</option><option value="America/Santiago">Chile</option><option value="America/Montevideo">Uruguay</option><option value="America/Mexico_City">México</option><option value="Europe/Madrid">España</option><option value="UTC">UTC</option></select></label></div>
            </> : null}
            <div className="auth-fields-two"><CampoContrasena label="Contraseña" autoComplete="new-password" minLength="10" placeholder="Mínimo 10 caracteres" value={form.contrasena} onChange={(value) => cambiar('contrasena', value)} /><CampoContrasena label="Confirmá la contraseña" autoComplete="new-password" placeholder="Repetí la contraseña" value={form.confirmar} onChange={(value) => cambiar('confirmar', value)} /></div>
            {error && <p role="alert" className="auth-alert auth-error">{error}</p>}{exito && <p role="status" className="auth-alert auth-success">{exito}</p>}
            <button disabled={cargando} className="auth-submit"><span className="auth-submit-copy">{cargando && <i className="auth-spinner" aria-hidden="true" />}{cargando ? 'Creando…' : vista === 'registro-espacio' ? 'Crear espacio de negocio' : 'Crear cuenta de cliente'}</span><span className="auth-submit-arrow" aria-hidden="true">→</span></button>
            <p className="auth-switch">¿Ya tenés cuenta? <button type="button" onClick={() => cambiarVista('login')}>Iniciar sesión</button></p>
          </form>}
        </div>
        <footer className="auth-footer"><span>© SHIFTS</span><span>Agenda, equipo y reservas en orden.</span></footer>
      </section>
    </div>
  </main>;
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
  const [vista, setVista] = useState('login');
  const [modo, setModo] = useState('email');
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', documento: '', contrasena: '', confirmar: '', negocio: '', tipoNegocio: 'gimnasio', zonaHoraria: 'America/Argentina/Buenos_Aires'
  });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const resetForm = () => {
    setForm({ nombre: '', apellido: '', email: '', documento: '', contrasena: '', confirmar: '', negocio: '', tipoNegocio: 'gimnasio', zonaHoraria: 'America/Argentina/Buenos_Aires' });
    setError('');
    setExito('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      const body = {
        contrasena: form.contrasena,
        ...(modo === 'email' ? { email: form.email } : { documento: form.documento }),
      };
      const { data } = await api.post('/auth/login', body);
      login(data.usuario);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales incorrectas');
    } finally {
      setCargando(false);
    }
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    if (form.contrasena !== form.confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.contrasena.length < 10) {
      setError('Usá al menos 10 caracteres');
      return;
    }
    setCargando(true);
    setError('');
    try {
      await api.post('/auth/registro', {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        documento: form.documento,
        contrasena: form.contrasena,
        negocio: form.negocio,
        tipoNegocio: form.tipoNegocio,
        zonaHoraria: form.zonaHoraria,
      });
      setExito('¡Cuenta creada con éxito!');
      setTimeout(() => {
        resetForm();
        setVista('login');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error en el registro');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-4 overflow-hidden selection:bg-sky-500/30">
      
      {/* Luces de Fondo (Ambience) */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[120px] animate-glowPulse" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[400px] h-[400px] bg-sky-500/5 rounded-full blur-[100px] animate-glowPulse" style={{animationDelay:'1s'}} />
      </div>

      <div className="relative w-full max-w-[400px]">
        
        {/* Branding */}
        <header className="text-center mb-10 animate-fadeIn">
          <div className="relative inline-block group">
            <div className="absolute inset-0 bg-sky-500/20 blur-2xl rounded-full group-hover:bg-sky-500/40 transition-all duration-500" />
            <img 
              src="/logo.png" 
              alt="TCgym" 
              className="relative w-24 h-24 object-contain animate-float drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]" 
            />
          </div>
          <h1 className="mt-4 text-white text-3xl font-black tracking-tighter">TC<span className="text-sky-300">GYM</span></h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-[0.3em] mt-2">
            {vista === 'login' ? 'Performance Center' : 'Únete a la Élite'}
          </p>
        </header>

        {/* Form Container */}
        <div className="animate-scaleIn shadow-2xl backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 md:p-10">
          
          {vista === 'login' ? (
            <div className="animate-fadeIn">
              {/* Switcher Pro */}
              <div className="flex bg-black/40 p-1 rounded-2xl mb-8">
                {['email', 'documento'].map((op) => (
                  <button
                    key={op}
                    onClick={() => setModo(op)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                      modo === op ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="group">
                  <label className="block text-white/30 text-[10px] font-black uppercase tracking-widest mb-2 ml-1 group-focus-within:text-sky-500 transition-colors">
                    {modo === 'email' ? 'Correo Electrónico' : 'Documento de Identidad'}
                  </label>
                  <input
                    type={modo === 'email' ? 'email' : 'text'}
                    placeholder={modo === 'email' ? 'ejemplo@gym.com' : 'DNI / CI'}
                    value={modo === 'email' ? form.email : form.documento}
                    onChange={(e) => setForm({ ...form, [modo]: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/5 focus:border-sky-500/50 focus:bg-sky-500/[0.02] text-white rounded-2xl px-5 py-4 text-sm outline-none transition-all placeholder:text-white/10"
                    required
                  />
                </div>

                <div className="group">
                  <label className="block text-white/30 text-[10px] font-black uppercase tracking-widest mb-2 ml-1 group-focus-within:text-sky-500 transition-colors">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.contrasena}
                    onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/5 focus:border-sky-500/50 focus:bg-sky-500/[0.02] text-white rounded-2xl px-5 py-4 text-sm outline-none transition-all placeholder:text-white/10"
                    required
                  />
                </div>

                {error && <p className="text-red-400 text-[11px] font-bold text-center animate-shake bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>}

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-800 to-sky-500 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-950/60 active:scale-[0.99] text-xs uppercase tracking-[0.16em]"
                >
                  <span className="relative z-10">{cargando ? 'Verificando...' : 'Entrar al Box'}</span>
                </button>
              </form>

              <footer className="mt-8 text-center">
                <button
                  onClick={() => { resetForm(); setVista('registro'); }}
                  className="text-white/30 hover:text-sky-400 text-[11px] font-bold uppercase tracking-widest transition-all"
                >
                  ¿No tienes cuenta? <span className="text-sky-500 ml-1">Regístrate</span>
                </button>
              </footer>
            </div>
          ) : (
            /* REGISTRO REDISEÑADO */
            <div className="animate-fadeIn">
              <form onSubmit={handleRegistro} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-white/30 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Nombre</label>
                    <input
                      type="text"
                      placeholder="Juan"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/5 focus:border-sky-500/50 text-white rounded-2xl px-4 py-3.5 text-sm outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="group">
                    <label className="block text-white/30 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Apellido</label>
                    <input
                      type="text"
                      placeholder="Pérez"
                      value={form.apellido}
                      onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/5 focus:border-sky-500/50 text-white rounded-2xl px-4 py-3.5 text-sm outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-white/30 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Email</label>
                  <input
                    type="email"
                    placeholder="atleta@tcgym.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/5 focus:border-sky-300/50 text-white rounded-2xl px-4 py-3.5 text-sm outline-none transition-all"
                    required
                  />
                </div>

                <div className="group">
                  <label className="block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Nombre del espacio</label>
                  <input type="text" placeholder="Mi gimnasio o consultorio" value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} className="w-full bg-white/[0.04] border border-white/10 focus:border-sky-300/50 text-white rounded-xl px-4 py-3 text-sm outline-none" required />
                </div>
                <div className="group">
                  <label className="block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Tipo de negocio</label>
                  <select value={form.tipoNegocio} onChange={(e) => setForm({ ...form, tipoNegocio: e.target.value })} className="w-full bg-[#101a29] border border-white/10 focus:border-sky-300/50 text-white rounded-xl px-4 py-3 text-sm outline-none"><option value="gimnasio">Gimnasio</option><option value="consultorio">Consultorio</option><option value="peluqueria">Peluquería</option><option value="clases">Clases</option><option value="general">Otro servicio</option></select>
                </div>
                <div className="group">
                  <label className="block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Zona horaria del negocio</label>
                  <select value={form.zonaHoraria} onChange={(e) => setForm({ ...form, zonaHoraria: e.target.value })} className="w-full bg-[#101a29] border border-white/10 focus:border-sky-300/50 text-white rounded-xl px-4 py-3 text-sm outline-none"><option value="America/Argentina/Buenos_Aires">Argentina — Buenos Aires</option><option value="America/Santiago">Chile — Santiago</option><option value="America/Montevideo">Uruguay — Montevideo</option><option value="America/Mexico_City">México — Ciudad de México</option><option value="Europe/Madrid">España — Madrid</option><option value="UTC">UTC</option></select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-white/30 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Password</label>
                    <input
                      type="password"
                      placeholder="10 caracteres o más"
                      value={form.contrasena}
                      onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/5 focus:border-sky-300/50 text-white rounded-2xl px-4 py-3.5 text-sm outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="group">
                    <label className="block text-white/30 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Confirmar</label>
                    <input
                      type="password"
                      placeholder="••••••"
                      value={form.confirmar}
                      onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/5 focus:border-sky-500/50 text-white rounded-2xl px-4 py-3.5 text-sm outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                {error && <p className="text-red-400 text-[10px] font-black text-center uppercase tracking-widest">{error}</p>}
                {exito && <p className="text-green-400 text-[10px] font-black text-center uppercase tracking-widest">{exito}</p>}

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full bg-sky-300 text-slate-950 hover:bg-white font-semibold py-4 rounded-xl transition-all duration-300 text-[11px] uppercase tracking-[0.16em] mt-2"
                >
                  {cargando ? 'Procesando...' : 'Confirmar Registro'}
                </button>
              </form>

              <footer className="mt-6 text-center">
                <button
                  onClick={() => { resetForm(); setVista('login'); }}
                  className="text-white/30 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  ← Volver al login
                </button>
              </footer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

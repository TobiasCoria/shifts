import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function MisDatos() {
  const { usuario } = useAuth();
  const esGimnasio = !usuario?.tipoNegocio || usuario.tipoNegocio === 'gimnasio';
  const navigate = useNavigate();
  
  const [form, setForm] = useState({ peso: '', estatura: '', fecha_nacimiento: '' });
  const [contrasenas, setContrasenas] = useState({ actual: '', nueva: '', confirmar: '' });
  const [archivo, setArchivo] = useState(null);
  const [archivoFile, setArchivoFile] = useState(null);
  const [foto, setFoto] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  
  const [cargando, setCargando] = useState(false);
  const [cargandoPass, setCargandoPass] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState('');
  const [errorPass, setErrorPass] = useState('');
  const [exitoPass, setExitoPass] = useState('');

  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        const { data } = await api.get('/usuarios/perfil');
        setForm({
          peso: data.peso || '',
          estatura: data.estatura || '',
          fecha_nacimiento: data.fecha_nacimiento?.split('T')[0] || '',
        });
        if (data.rutina_archivo) setArchivo(data.rutina_archivo);
        if (data.foto_perfil) setFoto(data.foto_perfil);
      } catch { setError('No se pudo cargar tu perfil'); }
    };
    cargarPerfil();
  }, []);

  const imc = form.peso && form.estatura 
    ? (form.peso / Math.pow(form.estatura / 100, 2)).toFixed(1) 
    : null;

  const getImcStatus = (v) => {
    if (v < 18.5) return { label: 'Bajo peso', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    if (v < 25) return { label: 'Saludable', color: 'text-green-400', bg: 'bg-green-500/10' };
    if (v < 30) return { label: 'Sobrepeso', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    return { label: 'Obesidad', color: 'text-red-400', bg: 'bg-red-500/10' };
  };

  const status = imc ? getImcStatus(imc) : null;

  const handleGuardar = async () => {
    setCargando(true);
    setError('');
    try {
      await api.put('/usuarios/perfil', form);
      if (archivoFile) {
        const fd = new FormData();
        fd.append('rutina', archivoFile);
        await api.post('/usuarios/rutina', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      if (fotoFile) {
        const fd = new FormData();
        fd.append('foto', fotoFile);
        const { data } = await api.post('/usuarios/foto', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (data.foto) setFoto(data.foto);
      }
      setGuardado(true);
      setArchivoFile(null);
      setFotoFile(null);
      setTimeout(() => setGuardado(false), 2500);
    } catch { setError('Error al actualizar perfil'); }
    finally { setCargando(false); }
  };

  const handleCambiarContrasena = async () => {
    if (contrasenas.nueva !== contrasenas.confirmar) return setErrorPass('Las contraseñas no coinciden');
    setCargandoPass(true);
    setErrorPass('');
    try {
      await api.put('/usuarios/contrasena', {
        contrasena_actual: contrasenas.actual,
        contrasena_nueva: contrasenas.nueva,
      });
      setExitoPass('Seguridad actualizada');
      setContrasenas({ actual: '', nueva: '', confirmar: '' });
      setTimeout(() => setExitoPass(''), 3000);
    } catch (err) { setErrorPass(err.response?.data?.error || 'Error de validación'); }
    finally { setCargandoPass(false); }
  };

  const fotoUrl = fotoFile ? URL.createObjectURL(fotoFile) : foto ? `/api/usuarios/archivos/${encodeURIComponent(foto)}` : null;

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#15263b]">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#73889e]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#a9c5b4]/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 border-b border-[#dfe4ea] px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/home')} className="w-10 h-10 flex items-center justify-center rounded-full border border-[#dfe4ea] bg-white hover:bg-[#f5f7f9] transition-all">
          <span className="text-xl text-[#526981]">←</span>
        </button>
        <h1 className="text-lg font-semibold tracking-tight">Mi perfil</h1>
      </header>

      <main className="relative max-w-lg mx-auto px-6 pt-8 pb-32 space-y-6">
        {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200">{error}</p>}
        
        {/* Profile Card */}
        <section className="flex flex-col items-center text-center space-y-4 py-4 animate-fadeIn">
          <div className="relative group">
            <div className="w-28 h-28 rounded-[2.5rem] p-1 bg-[#dfe4ea]">
              <div className="w-full h-full rounded-[2.3rem] overflow-hidden bg-[#f4f6f8] border-4 border-white">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black text-[#355a77]/60">
                    {usuario?.nombre?.charAt(0)}
                  </div>
                )}
              </div>
            </div>
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-white text-black rounded-2xl flex items-center justify-center shadow-xl cursor-pointer hover:scale-110 transition-transform">
              <span className="text-lg" aria-hidden="true">+</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && setFotoFile(e.target.files[0])} />
            </label>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{usuario?.nombre} {usuario?.apellido}</h2>
            <p className="text-[#718197] text-xs font-medium tracking-wide">{usuario?.email}</p>
          </div>
        </section>

        {esGimnasio && <>{/* Fitness profile fields stay scoped to gym accounts. */}
        <section className="grid grid-cols-2 gap-4 animate-fadeIn">
          <div className="bg-white border border-[#dfe4ea] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#718197]">Masa Corporal (kg)</span>
            <input 
              type="number" 
              value={form.peso} 
              onChange={e => setForm({...form, peso: e.target.value})}
              className="bg-transparent text-2xl font-semibold w-full outline-none focus:text-[#355a77] transition-colors"
              placeholder="00"
            />
          </div>
          <div className="bg-white border border-[#dfe4ea] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#718197]">Estatura (cm)</span>
            <input 
              type="number" 
              value={form.estatura} 
              onChange={e => setForm({...form, estatura: e.target.value})}
              className="bg-transparent text-2xl font-semibold w-full outline-none focus:text-[#355a77] transition-colors"
              placeholder="000"
            />
          </div>
          {imc && (
            <div className={`col-span-2 ${status.bg} border border-[#dfe4ea] p-6 rounded-2xl flex justify-between items-center animate-scaleIn`}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#718197]">Índice de Masa Corporal</p>
                <p className={`text-lg font-black italic uppercase ${status.color}`}>{status.label}</p>
              </div>
              <div className="text-4xl font-black italic">{imc}</div>
            </div>
          )}
        </section>

        {/* Vital Info */}
        <section className="bg-white border border-[#dfe4ea] p-6 rounded-2xl space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#718197] ml-2">Fecha de Nacimiento</label>
            <input 
              type="date" 
              value={form.fecha_nacimiento}
              onChange={e => setForm({...form, fecha_nacimiento: e.target.value})}
              className="w-full bg-[#f8f9fa] border border-[#dfe4ea] rounded-xl px-5 py-4 text-sm font-medium outline-none focus:border-[#73889e] [color-scheme:light]"
            />
          </div>
        </section>
        {/* Routine File */}
        <section className="bg-white border border-[#dfe4ea] p-6 rounded-2xl space-y-4">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#718197] ml-2">Plan de Entrenamiento</label>
          {archivo && (
            <div className="bg-[#edf6f0] border border-[#c9dfd0] p-4 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold truncate max-w-[150px]">{archivo}</span>
              <a href={`/api/usuarios/archivos/${encodeURIComponent(archivo)}`} target="_blank" rel="noreferrer" className="text-[10px] font-semibold uppercase text-[#355a77] bg-white px-3 py-2 rounded-lg">Ver PDF</a>
            </div>
          )}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#dfe4ea] rounded-xl p-6 hover:bg-[#f8f9fa] transition-all cursor-pointer group">
            <span className="text-sm mb-2 font-semibold tracking-widest group-hover:scale-105 transition-transform">PDF</span>
            <span className="text-[10px] font-semibold uppercase text-[#718197]">{archivoFile ? archivoFile.name : 'Subir Nueva Rutina'}</span>
            <input type="file" className="hidden" onChange={e => { if(e.target.files[0]){ setArchivo(e.target.files[0].name); setArchivoFile(e.target.files[0]); }}} />
          </label>
        </section>
        </>}

        {/* Security Section */}
        <section className="bg-white border border-[#dfe4ea] p-6 rounded-2xl space-y-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#718197] ml-2">Seguridad</h3>
          <div className="space-y-3">
            {['actual', 'nueva', 'confirmar'].map((key) => (
              <input
                key={key}
                type="password"
                placeholder={key === 'actual' ? 'Contraseña Actual' : key === 'nueva' ? 'Nueva Contraseña' : 'Confirmar Nueva'}
                value={contrasenas[key]}
                onChange={e => setContrasenas({...contrasenas, [key]: e.target.value})}
                className="w-full bg-[#f8f9fa] border border-[#dfe4ea] rounded-xl px-5 py-4 text-sm font-medium outline-none focus:border-[#73889e]"
              />
            ))}
            {errorPass && <p className="text-[10px] font-bold text-red-400 ml-2">{errorPass}</p>}
            {exitoPass && <p className="text-[10px] font-bold text-green-400 ml-2">{exitoPass}</p>}
            <button 
              onClick={handleCambiarContrasena}
              disabled={!contrasenas.actual || !contrasenas.nueva || cargandoPass}
              className="w-full py-4 rounded-xl bg-white border border-[#dfe4ea] text-xs font-semibold uppercase tracking-widest hover:bg-[#f8f9fa] disabled:opacity-40 transition-all"
            >
              {cargandoPass ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </section>

        {/* Final Save Action */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#f4f6f8] to-transparent pointer-events-none">
          <button
            onClick={handleGuardar}
            disabled={cargando}
            className="w-full max-w-sm mx-auto pointer-events-auto bg-[#142942] hover:bg-[#233c58] text-white font-medium text-sm py-4 rounded-xl shadow-sm transition-all active:scale-[0.99]"
          >
            {cargando ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </div>
      </main>

      {/* Success Toast */}
      {guardado && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
          <div className="bg-[#e8f1eb] text-[#315640] border border-[#c9dfd0] px-6 py-3 rounded-full font-semibold text-xs uppercase tracking-widest shadow-lg">
            ¡Perfil Actualizado!
          </div>
        </div>
      )}
    </div>
  );
}

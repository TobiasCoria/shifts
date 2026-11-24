import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Home() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [proximoTurno, setProximoTurno] = useState(null);
  const [stats, setStats] = useState({ usuarios: 0, turnosHoy: 0, reservados: 0, completados: 0 });

  const esAdmin = usuario?.rol === 'admin';
  const tipoNegocio = ({ gimnasio: 'Fitness', barberia: 'Barbería', peluqueria: 'Peluquería', estetica: 'Estética', consultorio: 'Consultorio', tatuajes: 'Estudio de tatuajes', clases: 'Academia', general: 'Servicios' })[usuario?.tipoNegocio] || 'Negocio';

  useEffect(() => {
    const cargar = async () => {
      try {
        if (esAdmin) {
          const [u, t] = await Promise.all([api.get('/usuarios'), api.get('/turnos')]);
          const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: usuario?.timezone || 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
          const turnosHoy = t.data.filter(t => t.fecha?.split('T')[0] === hoy);
          setStats({
            usuarios: u.data.length,
            turnosHoy: turnosHoy.length,
            reservados: turnosHoy.filter(t => t.estado === 'reservado').length,
            completados: turnosHoy.filter(t => t.estado === 'completado').length,
          });
        } else {
          const { data } = await api.get('/turnos/mis-turnos');
          const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: usuario?.timezone || 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
          const proximo = data.find(t => t.estado === 'reservado' && t.fecha?.split('T')[0] >= hoy);
          setProximoTurno(proximo || null);
        }
      } catch (err) {
        console.error("Error cargando datos", err);
      }
    };
    cargar();
  }, [esAdmin, usuario?.timezone]);

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#15263b] selection:bg-[#cbd8e5]">
      
      {/* Luces Ambientales (Glows) */}
      <nav className="relative z-40 flex items-center justify-between border-b border-[#dfe4ea] bg-white px-5 py-4 sm:px-8">
        <button 
          onClick={() => setMenuAbierto(true)} 
          className="rounded-lg border border-[#dfe4ea] px-3 py-2 text-sm text-[#526981] hover:bg-[#f4f6f8]"
        >
          Menú
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className="font-semibold tracking-wide">SHIFTS</span>
          <span className="text-xs text-[#718197]">{usuario?.organizacion || 'Tu espacio'}</span>
        </div>

        <button 
          onClick={() => navigate(esAdmin ? '/admin' : '/mis-datos')}
          className="grid h-10 w-10 place-items-center rounded-xl bg-[#284361] font-semibold text-white"
        >
          {usuario?.nombre?.charAt(0).toUpperCase()}
        </button>
      </nav>

      {/* Contenido Principal */}
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
        
        {/* Card de Bienvenida Premium */}
        <section className="animate-fadeIn">
          <div className="rounded-2xl border border-[#dfe4ea] bg-white p-6 sm:p-8">
            <span className="text-xs font-semibold uppercase tracking-[.16em] text-[#64778d]">{esAdmin ? `Panel del negocio · ${tipoNegocio}` : 'Tu cuenta'}</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Hola, {usuario?.nombre}</h1>
            <p className="mt-2 text-sm text-[#718197]">{esAdmin ? 'Tu agenda y operación en un mismo lugar.' : `Accedé a tus turnos en ${usuario?.organizacion || 'tu espacio'}.`}</p>
          </div>
        </section>

        {/* Stats Grid (Solo Admin o modo expandido) */}
        {esAdmin && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn delay-100">
            {[
              { label: 'Clientes', val: stats.usuarios, icon: '01' },
              { label: 'Turnos de hoy', val: stats.turnosHoy, icon: '02' },
              { label: 'Asistencias', val: stats.completados, icon: '03' },
              { label: 'Pendientes', val: stats.reservados, icon: '04' },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl border border-[#dfe4ea] bg-white p-5 transition hover:border-[#bdcbd8]">
                <span className="mb-2 block text-xs font-semibold text-[#718197]">{s.icon}</span>
                <p className="text-2xl font-semibold">{s.val}</p>
                <p className="mt-1 text-xs text-[#718197]">{s.label}</p>
              </div>
            ))}
          </section>
        )}

        {/* Acciones Principales */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate(esAdmin ? '/admin' : '/turnos')}
            className="group relative flex items-center justify-between gap-5 rounded-2xl bg-[#142942] p-6 transition hover:bg-[#203b59] md:col-span-2"
          >
            <div className="text-left">
              <p className="text-white font-semibold text-xl md:text-2xl">{esAdmin ? `Administrar ${usuario?.organizacion || 'negocio'}` : 'Reservar un turno'}</p>
              <p className="mt-1 text-sm text-slate-300">{esAdmin ? 'Gestionar turnos, clientes y agenda' : `Elegí un horario disponible en ${usuario?.organizacion || 'tu espacio'}`}</p>
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-sm text-white transition group-hover:bg-white/15">
              →
            </div>
          </button>

          {/* Cards Secundarias */}
          <div 
            onClick={() => navigate(esAdmin ? '/admin' : '/turnos')}
            className="rounded-2xl border border-[#dfe4ea] bg-white p-5 transition hover:border-[#bdcbd8] cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-[#718197]">AGENDA</span>
              <span className="text-xs text-[#718197]">Abrir →</span>
            </div>
            <p className="text-xs text-[#718197]">
              {esAdmin ? 'Actividad Total' : 'Próxima Clase'}
            </p>
            <p className="text-lg font-semibold mt-2">
              {esAdmin ? `${stats.turnosHoy} Turnos Hoy` : (proximoTurno ? `${proximoTurno.hora?.slice(0,5)} hs` : 'Sin reservas')}
            </p>
          </div>

          <div 
            onClick={() => navigate(esAdmin ? '/admin' : '/mis-datos')}
            className="rounded-2xl border border-[#dfe4ea] bg-white p-5 transition hover:border-[#bdcbd8] cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-[#718197]">CUENTA</span>
              <span className="text-xs text-[#718197]">Gestionar →</span>
            </div>
            <p className="text-xs text-[#718197]">Mi cuenta</p>
            <p className="mt-2 text-lg font-semibold">Perfil y ajustes</p>
          </div>
        </section>

      </main>

      {/* Menú Lateral Rediseñado */}
      {menuAbierto && (
        <div className="fixed inset-0 z-[100] flex animate-fadeIn">
          <div className="absolute inset-0 bg-[#142942]/35 backdrop-blur-sm" onClick={() => setMenuAbierto(false)} />
          
          <aside className="relative flex h-full w-80 flex-col border-r border-[#dfe4ea] bg-white shadow-2xl animate-slideInRight">
            <div className="border-b border-[#e8ecf0] p-7">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[#284361] font-semibold text-white">
                {usuario?.nombre?.charAt(0).toUpperCase()}
              </div>
              <h3 className="font-semibold leading-none text-[#15263b]">{usuario?.nombre} {usuario?.apellido}</h3>
              <p className="mt-2 text-xs text-[#718197]">{usuario?.email}</p>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2">
              {(esAdmin ? [
                { label: 'Inicio', icon: '🏠', path: '/home' },
                { label: 'Gestión Admin', icon: '⚙️', path: '/admin' },
              ] : [
                { label: 'Inicio', icon: '🏠', path: '/home' },
                { label: 'Reservar Turno', icon: '📅', path: '/turnos' },
                { label: 'Mi Perfil', icon: '👤', path: '/mis-datos' },
              ]).map((item) => (
                <button 
                  key={item.path} 
                  onClick={() => { navigate(item.path); setMenuAbierto(false); }} 
                  className="w-full flex items-center gap-4 rounded-xl px-4 py-3 text-left text-[#526981] hover:bg-[#f4f6f8] transition-all font-medium group"
                >
                  <span className="text-lg group-hover:scale-125 transition-transform">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-6 border-t border-white/5">
              <button 
                onClick={() => { logout(); navigate('/'); }} 
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#dfe4ea] px-4 py-3 text-sm font-medium text-[#526981] transition hover:bg-[#f4f6f8]"
              >
                Cerrar Sesión 🚪
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

export default function GestionReserva() {
  const { token } = useParams();
  const [estado, setEstado] = useState({ enviando: false, error: '', exito: '' });
  const cancelar = async () => {
    setEstado({ enviando: true, error: '', exito: '' });
    try { const { data } = await api.post(`/turnos/publico/${encodeURIComponent(token)}`, { accion: 'cancelar' }); setEstado({ enviando: false, error: '', exito: data.mensaje }); }
    catch (err) { setEstado({ enviando: false, error: err.response?.data?.error || 'No se pudo gestionar la reserva', exito: '' }); }
  };
  return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] p-5 text-[#15263b]"><section className="w-full max-w-md rounded-2xl border border-[#dfe4ea] bg-white p-7 shadow-sm"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#142942] font-semibold text-white">S</div><p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-[#718197]">SHIFTS · Gestión de reserva</p><h1 className="mt-2 text-2xl font-semibold">Cancelar turno</h1><p className="mt-2 text-sm leading-6 text-[#65758a]">La cancelación aplica la política de anticipación del negocio. Esta acción no se puede deshacer.</p>{estado.error && <p role="alert" className="mt-5 rounded-xl bg-[#fff0f0] p-3 text-sm text-[#a13c46]">{estado.error}</p>}{estado.exito && <p role="status" className="mt-5 rounded-xl bg-[#edf6f0] p-3 text-sm text-[#28633e]">{estado.exito}</p>}<button onClick={cancelar} disabled={estado.enviando || Boolean(estado.exito)} className="mt-6 w-full rounded-xl bg-[#142942] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{estado.enviando ? 'Cancelando…' : 'Confirmar cancelación'}</button><Link to="/" className="mt-4 block text-center text-sm text-[#64778d] underline">Ir a SHIFTS</Link></section></main>;
}

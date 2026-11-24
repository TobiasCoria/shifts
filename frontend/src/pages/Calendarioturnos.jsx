import { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import api from '../services/api';

export default function CalendarioTurnos() {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescar, setRefrescar] = useState(false);
  const [modalEvento, setModalEvento] = useState(null); // Para gestionar acciones

  const cargarTurnos = async () => {
    try {
      const res = await api.get('/turnos');
      const turnosFormateados = res.data.map((turno) => ({
        id: turno.id.toString(),
        title: `${turno.nombre} ${turno.apellido}`,
        start: `${turno.fecha.split('T')[0]}T${turno.hora}`,
        extendedProps: { estado: turno.estado, hora: turno.hora },
        // Colores dinámicos basados en estado
        backgroundColor: turno.estado === 'completado' ? 'rgba(107, 143, 113, 0.16)' :
                         turno.estado === 'cancelado' ? 'rgba(100, 116, 139, 0.12)' : 'rgba(23, 43, 77, 0.10)',
        borderColor: turno.estado === 'completado' ? '#6B8F71' :
                     turno.estado === 'cancelado' ? '#94a3b8' : '#172B4D',
      }));
      setEventos(turnosFormateados);
    } catch (err) {
      console.error(err);
    } finally { setCargando(false); }
  };

  useEffect(() => { cargarTurnos(); }, [refrescar]);

  const actualizarEstado = async (id, nuevoEstado) => {
    try {
      const endpoint = `/turnos/${id}/estado`;
      await api.patch(endpoint, { estado: nuevoEstado });
      
      setModalEvento(null);
      setRefrescar(!refrescar);
    } catch { window.alert('Error al actualizar el turno'); }
  };

  if (cargando) return (
    <div className="h-96 flex flex-col items-center justify-center space-y-4">
      <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[.3em] text-sky-500">Sincronizando Sistema</p>
    </div>
  );

  return (
      <div className="bg-white border border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm animate-fadeIn">
      
      {/* HEADER TÉCNICO */}
      <div className="px-6 py-6 sm:px-8 border-b border-white/[0.05] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Agenda · SHIFTS</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Calendario de turnos</h2>
        </div>
        
        <button 
          onClick={() => setRefrescar(!refrescar)}
          className="bg-white text-slate-800 border border-slate-200 px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-50 transition-all"
        >
          Refrescar Base
        </button>
      </div>

      {/* CALENDARIO CONTAINER */}
      <div className="p-4 sm:p-8 calendar-custom-wrapper">
        <style>{`
          .fc { --fc-border-color: #e7e4dc; --fc-page-bg-color: transparent; }
          .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #eeece7 !important; }
          .fc .fc-toolbar-title { font-size: 1.15rem !important; font-weight: 600; text-transform: none; letter-spacing: -0.02em; }
          .fc .fc-button-primary { background: white !important; border: 1px solid #dedbd3 !important; color: #292823 !important; font-size: 0.75rem !important; font-weight: 500 !important; text-transform: capitalize !important; border-radius: 10px !important; }
          .fc .fc-button-primary:hover { background: #f5f3ee !important; }
          .fc .fc-button-active { background: #172B4D !important; border-color: #172B4D !important; color: white !important; }
          .fc-v-event { border-width: 0 0 0 3px !important; border-radius: 6px !important; padding: 4px 8px !important; margin: 2px 0 !important; }
          .fc-event-title { font-weight: 600 !important; font-size: 0.75rem !important; }
          .fc-timegrid-slot { height: 3rem !important; }
          .fc-col-header-cell { padding: 15px 0 !important; background: #faf9f6; }
          .fc-col-header-cell-cushion { font-size: 0.65rem !important; font-weight: 600 !important; text-transform: uppercase; letter-spacing: 0.1em; color: #77736a; }
        `}</style>
        
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay,dayGridMonth'
          }}
          events={eventos}
          eventClick={(info) => setModalEvento({
            id: info.event.id,
            title: info.event.title,
            ...info.event.extendedProps
          })}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          height="auto"
          locale={esLocale}
          nowIndicator={true}
          dayMaxEvents={true}
        />
      </div>

      {/* MODAL DE ACCIÓN PRO */}
      {modalEvento && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setModalEvento(null)} />
          <div className="relative bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-7 shadow-xl animate-scaleIn">
            <div className="mb-6">
              <span className="text-xs font-medium uppercase tracking-[.16em] text-slate-500">Gestionar turno</span>
              <h3 className="text-2xl font-semibold text-slate-900 mt-2">{modalEvento.title}</h3>
              <p className="text-slate-500 text-sm mt-1">Horario: {modalEvento.hora} hs</p>
            </div>

            <div className="space-y-3">
              {modalEvento.estado === 'reservado' && (
                <>
                  <button 
                    onClick={() => actualizarEstado(modalEvento.id, 'completado')}
                    className="w-full bg-[#172B4D] text-white py-3 rounded-xl font-medium text-sm hover:bg-[#172B4D] transition-all"
                  >
                    Confirmar Asistencia
                  </button>
                  <button 
                    onClick={() => actualizarEstado(modalEvento.id, 'cancelado')}
                    className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium text-sm hover:bg-slate-50 transition-all"
                  >
                    Cancelar Turno
                  </button>
                </>
              )}
              <button 
                onClick={() => setModalEvento(null)}
                className="w-full bg-white text-slate-500 py-3 rounded-xl font-medium text-sm hover:text-slate-900 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function validarFecha(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const date = new Date(`${fecha}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === fecha;
}

function horaEnMinutos(hora) {
  const [h, m] = String(hora).split(':').slice(0, 2).map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fechaLocal(timeZone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return { fecha: `${parts.year}-${parts.month}-${parts.day}`, minutos: Number(parts.hour) * 60 + Number(parts.minute) };
}

module.exports = { validarFecha, horaEnMinutos, fechaLocal };

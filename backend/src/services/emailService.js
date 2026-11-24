const { Resend } = require('resend');
require('dotenv').config();

const getResend = () => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const enviarConfirmacionEnNombreDe = async (usuario, turno, negocio, urlCancelar, minutosCancelacion) => {
  try {
    const resend = getResend();
    if (!resend || !usuario?.email) return;
    const nombreNegocio = escaparHtml(negocio || 'SHIFTS');
    await resend.emails.send({ from: process.env.EMAIL_FROM, to: usuario.email, subject: `Turno confirmado — ${negocio || 'SHIFTS'}`, html: `<div style="font-family:Arial,sans-serif;background:#f4f6f8;color:#15263b;padding:32px"><h1>${nombreNegocio}</h1><h2>Tu turno está confirmado</h2><p>Hola ${escaparHtml(usuario.nombre)},</p><p>Reservaste ${escaparHtml(turno.servicio)} el ${escaparHtml(turno.fecha)} a las ${escaparHtml(turno.hora.slice(0, 5))}${turno.profesional ? ` con ${escaparHtml(turno.profesional)}` : ''}.</p><p>Podés cancelar según las reglas del negocio desde este enlace seguro:</p><p><a href="${escaparHtml(urlCancelar)}">Gestionar reserva</a></p><p>Cancelación disponible hasta ${Number(minutosCancelacion)} minutos antes.</p></div>` });
  } catch (err) { console.error('Error enviando email de reserva pública:', err); }
};

const escaparHtml = (valor) => String(valor || '').replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter]);

const enviarConfirmacionTurno = async (usuario, turno) => {
  try {
    const resend = getResend();
    if (!resend || !usuario?.email) return;
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: usuario.email,
      subject: `Turno confirmado — ${process.env.BUSINESS_NAME || 'SHIFTS'}`,
      html: `
        <div style="font-family: Inter, sans-serif; background: #0f1117; color: white; padding: 40px; border-radius: 16px; max-width: 500px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #93c5fd; font-size: 24px; margin: 0;">${escaparHtml(process.env.BUSINESS_NAME || 'SHIFTS')}</h1>
          </div>
          <h2 style="font-size: 20px; margin-bottom: 8px;">Turno confirmado ✓</h2>
          <p style="color: rgba(255,255,255,0.5); margin-bottom: 24px;">Hola ${escaparHtml(usuario.nombre)}, tu turno fue reservado correctamente.</p>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.4); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Detalles del turno</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${new Date(turno.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p style="margin: 4px 0 0 0; color: #93c5fd; font-size: 16px; font-weight: bold;">${escaparHtml(turno.hora.slice(0,5))}hs · ${escaparHtml(turno.servicio || '')}</p>
          </div>
          <p style="color: rgba(255,255,255,0.3); font-size: 12px; text-align: center;">Si necesitás cancelar tu turno, ingresá a la app.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Error enviando email de confirmación:', err);
  }
};

const enviarCancelacionTurno = async (usuario, turno) => {
  try {
    const resend = getResend();
    if (!resend || !usuario?.email) return;
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: usuario.email,
      subject: `Turno cancelado — ${process.env.BUSINESS_NAME || 'SHIFTS'}`,
      html: `
        <div style="font-family: Inter, sans-serif; background: #0f1117; color: white; padding: 40px; border-radius: 16px; max-width: 500px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #93c5fd; font-size: 24px; margin: 0;">${escaparHtml(process.env.BUSINESS_NAME || 'SHIFTS')}</h1>
          </div>
          <h2 style="font-size: 20px; margin-bottom: 8px;">Turno cancelado</h2>
          <p style="color: rgba(255,255,255,0.5); margin-bottom: 24px;">Hola ${escaparHtml(usuario.nombre)}, tu turno fue cancelado.</p>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.4); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Turno cancelado</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${new Date(turno.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.4); font-size: 16px; font-weight: bold;">${escaparHtml(turno.hora.slice(0,5))}hs</p>
          </div>
          <p style="color: rgba(255,255,255,0.3); font-size: 12px; text-align: center;">Podés reservar un nuevo turno cuando quieras.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Error enviando email de cancelación:', err);
  }
};

const enviarRecordatorio = async (usuario, turno, negocio = 'SHIFTS') => {
  try {
    const resend = getResend();
    if (!resend || !usuario?.email) return false;
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: usuario.email,
      subject: `Recordatorio de turno mañana — ${negocio || 'SHIFTS'}`,
      html: `
        <div style="font-family: Inter, sans-serif; background: #0f1117; color: white; padding: 40px; border-radius: 16px; max-width: 500px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #93c5fd; font-size: 24px; margin: 0;">${escaparHtml(negocio || 'SHIFTS')}</h1>
          </div>
          <h2 style="font-size: 20px; margin-bottom: 8px;">Recordatorio 📅</h2>
          <p style="color: rgba(255,255,255,0.5); margin-bottom: 24px;">Hola ${escaparHtml(usuario.nombre)}, te recordamos que mañana tenés un turno reservado.</p>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.4); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Tu turno</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${new Date(turno.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <p style="margin: 4px 0 0 0; color: #93c5fd; font-size: 16px; font-weight: bold;">${escaparHtml(turno.hora.slice(0,5))}hs${turno.servicio ? ` · ${escaparHtml(turno.servicio)}` : ''}</p>
          </div>
          <p style="color: rgba(255,255,255,0.3); font-size: 12px; text-align: center;">Para cancelar, usá el enlace de gestión recibido con la confirmación y respetá la anticipación que indica el negocio.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Error enviando recordatorio:', err);
    return false;
  }
};

module.exports = { enviarConfirmacionTurno, enviarConfirmacionEnNombreDe, enviarCancelacionTurno, enviarRecordatorio };

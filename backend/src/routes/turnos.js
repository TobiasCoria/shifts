const router = require('express').Router();

const { 
  getTurnos, 
  getMisTurnos, 
  crearTurno, 
  crearTurnoPublico,
  gestionarTurnoPublico,
  cancelarTurno, 
  getDisponibilidad, 
  getDisponibilidadPublica,
  marcarAsistencia,
  getCapacidadDia
} = require('../controllers/turnosController');

const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.post('/publico', crearTurnoPublico);
router.post('/publico/:token', gestionarTurnoPublico);
router.get('/disponibilidad-publica', getDisponibilidadPublica);

// Marcar asistencia (admin)
router.patch('/:id/estado', verificarToken, soloAdmin, marcarAsistencia);

// Obtener todos los turnos (admin)
router.get('/', verificarToken, soloAdmin, getTurnos);

// Obtener mis turnos
router.get('/mis-turnos', verificarToken, getMisTurnos);

// Disponibilidad
router.get('/disponibilidad', verificarToken, getDisponibilidad);
router.get('/capacidad', verificarToken, soloAdmin, getCapacidadDia);

// Crear turno
router.post('/', verificarToken, crearTurno);

// Cancelar turno
router.patch('/:id/cancelar', verificarToken, cancelarTurno);

module.exports = router;

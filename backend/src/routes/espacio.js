const router = require('express').Router();
const { verificarToken, soloAdmin } = require('../middlewares/auth');
const { obtener, actualizar } = require('../controllers/espacioController');

router.get('/', verificarToken, soloAdmin, obtener);
router.put('/', verificarToken, soloAdmin, actualizar);

module.exports = router;

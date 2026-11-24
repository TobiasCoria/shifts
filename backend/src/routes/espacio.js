const router = require('express').Router();
const { verificarToken, soloAdmin } = require('../middlewares/auth');
const { obtener, actualizar, publico } = require('../controllers/espacioController');

router.get('/publico/:slug', publico);
router.get('/', verificarToken, soloAdmin, obtener);
router.put('/', verificarToken, soloAdmin, actualizar);

module.exports = router;

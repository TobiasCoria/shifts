const router = require('express').Router();
const { login, registro, sesion, logout } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');

router.post('/login', login);
router.post('/registro', registro);
router.get('/me', verificarToken, sesion);
router.post('/logout', logout);

module.exports = router;

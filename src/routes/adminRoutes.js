const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const configController = require('../controllers/configController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Todas las rutas de este router requieren estar logueado Y ser admin.
router.use(authMiddleware, adminMiddleware);

// Ventas (editar, borrar individual, borrado total para la siguiente jugada)
router.put('/sales/:id', salesController.update);
router.delete('/sales/:id', salesController.remove);
router.delete('/sales', salesController.clearAll);

// Configuración (default unit price)
router.put('/config', configController.update);

module.exports = router;

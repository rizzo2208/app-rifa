const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todo este router requiere estar logueado (operador o admin).
router.use(authMiddleware);

// POST /api/sales
router.post('/', salesController.create);

// GET /api/sales
router.get('/', salesController.getAll);

module.exports = router;

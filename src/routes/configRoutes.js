const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const authMiddleware = require('../middlewares/authMiddleware');

// GET /api/config (requiere estar logueado — cualquier rol)
router.get('/', authMiddleware, configController.get);

module.exports = router;

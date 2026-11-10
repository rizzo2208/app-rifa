const db = require('../config/db');

// GET /api/config (requires login — any role)
exports.get = (req, res) => {
    res.json(db.loadConfig());
};

// PUT /api/admin/config (requires admin)
exports.update = (req, res) => {
    const { precioUnitario } = req.body;

    const precio = Number(precioUnitario);

    if (!Number.isFinite(precio) || precio <= 0) {
        return res.status(400).json({ message: 'El precio unitario debe ser mayor a 0.' });
    }

    const config = { precioUnitario: precio };
    db.saveConfig(config);

    return res.status(200).json(config);
};

const db = require('../config/db');

// Requiere que authMiddleware ya haya corrido antes (necesita req.user.id).
// Verifica el rol contra la base de datos en cada request, así una
// promoción a admin no necesita que el usuario vuelva a loguearse.
module.exports = (req, res, next) => {
    const users = db.loadUsers();
    const user = users.find(u => u.id === req.user?.id);

    if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso restringido a administradores.' });
    }

    next();
};

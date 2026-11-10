const jwt = require('jsonwebtoken');

// Verifica si el usuario tiene sesión activa antes de dar acceso a rutas protegidas
module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No autorizado.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ message: 'No autorizado.' });
    }
};

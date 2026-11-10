const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Registro de usuario
exports.register = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    const users = db.loadUsers();

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // El email configurado en ADMIN_EMAIL se registra directamente como admin del mercadito.
    const role = process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL ? 'admin' : 'operador';

    const newUser = {
        id: Date.now(),
        name,
        email,
        passwordHash,
        role,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    db.saveUsers(users);

    return res.status(201).json({
        message: 'Usuario registrado exitosamente',
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
};

// Login de usuario
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email y contraseña requeridos.' });
    }

    const users = db.loadUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
        return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Si el email coincide con ADMIN_EMAIL pero la cuenta se creó antes de tener
    // roles (o cambiaste el ADMIN_EMAIL), la promovemos acá sin que el usuario
    // tenga que hacer nada.
    if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL && user.role !== 'admin') {
        user.role = 'admin';
        db.saveUsers(users);
    }

    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    return res.status(200).json({
        message: 'Login exitoso',
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role || 'operador'
        }
    });
};

// Devuelve el usuario dueño del token (requiere authMiddleware antes)
exports.getMe = (req, res) => {
    const users = db.loadUsers();
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.status(200).json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role || 'operador' }
    });
};

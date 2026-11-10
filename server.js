require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/sales', require('./src/routes/salesRoutes'));
app.use('/api/config', require('./src/routes/configRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

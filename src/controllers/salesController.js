const db = require('../config/db');

const PAYMENT_TYPES = ['efectivo', 'transferencia', 'mixto'];

function computeMontos(formaPago, total, body) {
    if (formaPago === 'efectivo') {
        return { montoEfectivo: total, montoTransferencia: 0 };
    }
    if (formaPago === 'transferencia') {
        return { montoEfectivo: 0, montoTransferencia: total };
    }

    const montoEfectivo = Number(body.montoEfectivo) || 0;
    const montoTransferencia = Number(body.montoTransferencia) || 0;

    if (montoEfectivo < 0 || montoTransferencia < 0) {
        return { error: 'Los montos de efectivo y transferencia no pueden ser negativos.' };
    }

    if (Math.abs(montoEfectivo + montoTransferencia - total) > 0.01) {
        return { error: 'En pago mixto, la suma de efectivo y transferencia debe ser igual al total.' };
    }

    return { montoEfectivo, montoTransferencia };
}

// POST /api/sales (requires login — any role)
exports.create = (req, res) => {
    const { cantidad, precioUnitario, formaPago } = req.body;

    const cant = Number(cantidad);
    if (!Number.isInteger(cant) || cant <= 0) {
        return res.status(400).json({ message: 'La cantidad de números debe ser un número entero mayor a 0.' });
    }

    const precio = Number(precioUnitario);
    if (!Number.isFinite(precio) || precio <= 0) {
        return res.status(400).json({ message: 'El precio unitario debe ser mayor a 0.' });
    }

    if (!PAYMENT_TYPES.includes(formaPago)) {
        return res.status(400).json({ message: 'Forma de pago inválida.' });
    }

    const total = cant * precio;
    const { montoEfectivo, montoTransferencia, error } = computeMontos(formaPago, total, req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    const users = db.loadUsers();
    const vendedor = users.find(u => u.id === req.user.id);

    const sale = {
        id: Date.now(),
        cantidad: cant,
        precioUnitario: precio,
        formaPago,
        montoEfectivo,
        montoTransferencia,
        total,
        vendedorId: req.user.id,
        vendedorName: vendedor ? vendedor.name : 'Desconocido',
        createdAt: new Date().toISOString()
    };

    const sales = db.loadSales();
    sales.push(sale);
    db.saveSales(sales);

    return res.status(201).json(sale);
};

// GET /api/sales (requires login — any role)
exports.getAll = (req, res) => {
    const sales = db.loadSales();
    const sorted = [...sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
};

// PUT /api/admin/sales/:id (requires admin)
exports.update = (req, res) => {
    const { cantidad, precioUnitario, formaPago } = req.body;

    const cant = Number(cantidad);
    if (!Number.isInteger(cant) || cant <= 0) {
        return res.status(400).json({ message: 'La cantidad de números debe ser un número entero mayor a 0.' });
    }

    const precio = Number(precioUnitario);
    if (!Number.isFinite(precio) || precio <= 0) {
        return res.status(400).json({ message: 'El precio unitario debe ser mayor a 0.' });
    }

    if (!PAYMENT_TYPES.includes(formaPago)) {
        return res.status(400).json({ message: 'Forma de pago inválida.' });
    }

    const sales = db.loadSales();
    const sale = sales.find(s => s.id === Number(req.params.id));

    if (!sale) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    const total = cant * precio;
    const { montoEfectivo, montoTransferencia, error } = computeMontos(formaPago, total, req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    sale.cantidad = cant;
    sale.precioUnitario = precio;
    sale.formaPago = formaPago;
    sale.montoEfectivo = montoEfectivo;
    sale.montoTransferencia = montoTransferencia;
    sale.total = total;
    sale.updatedAt = new Date().toISOString();

    db.saveSales(sales);
    return res.status(200).json(sale);
};

// DELETE /api/admin/sales/:id (requires admin)
exports.remove = (req, res) => {
    const sales = db.loadSales();
    const index = sales.findIndex(s => s.id === Number(req.params.id));

    if (index === -1) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    sales.splice(index, 1);
    db.saveSales(sales);

    return res.status(204).send();
};

// DELETE /api/admin/sales (requires admin) — full wipe for the next raffle
exports.clearAll = (req, res) => {
    db.saveSales([]);
    return res.status(204).send();
};

// Mirrors sales to a Google Sheet through a Google Apps Script web app.
// The app database (JSON files) stays the source of truth: a failure here is
// logged and never blocks or fails a sale.
//
// Env vars:
//   SHEETS_URL    Apps Script web app URL (ends in /exec). If empty, mirroring is off.
//   SHEETS_TOKEN  Shared secret, checked by the Apps Script, so only this server can write.

const TIMEOUT_MS = 10000;

function isEnabled() {
    return Boolean(process.env.SHEETS_URL && process.env.SHEETS_URL.trim());
}

async function send(payload) {
    if (!isEnabled()) return;

    try {
        // text/plain avoids a CORS preflight and is what Apps Script expects for JSON bodies.
        const res = await fetch(process.env.SHEETS_URL.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ ...payload, token: process.env.SHEETS_TOKEN || '' }),
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });

        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch (e) { /* non-JSON reply handled below */ }

        if (!res.ok || !data || data.status !== 'success') {
            console.warn(`[sheets] ${payload.action} failed:`, data ? data.message : `HTTP ${res.status}`);
        }
    } catch (error) {
        console.warn(`[sheets] ${payload.action} failed:`, error.message);
    }
}

function toRow(sale) {
    return {
        id: sale.id,
        fecha: new Date(sale.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
        vendedor: sale.vendedorName,
        cantidad: sale.cantidad,
        precioUnitario: sale.precioUnitario,
        formaPago: sale.formaPago,
        montoEfectivo: sale.montoEfectivo,
        montoTransferencia: sale.montoTransferencia,
        total: sale.total
    };
}

// Fire-and-forget: callers do not await these, so the HTTP response is never delayed.
exports.addSale = (sale) => { send({ action: 'add', sale: toRow(sale) }); };
exports.updateSale = (sale) => { send({ action: 'update', sale: toRow(sale) }); };
exports.deleteSale = (id) => { send({ action: 'delete', id }); };
exports.clearAll = () => { send({ action: 'clear_all' }); };
exports.isEnabled = isEnabled;

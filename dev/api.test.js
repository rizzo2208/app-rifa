// Runs the real apps-script/Code.gs through the local fake: `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('./mock-server');

let server;
let url;

test.before(async () => {
    server = createServer();
    await new Promise(resolve => server.listen(0, resolve));
    url = `http://127.0.0.1:${server.address().port}/exec`;
});

test.after(() => server.close());

const call = async (action, pin, data = {}) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action, pin, ...data }) });
    return res.json();
};

const VEND = '1111';
const ADMIN = '9999';
const sale = { vendedor: 'Ana', cantidad: 4, precioUnitario: 1000, formaPago: 'mixto', montoEfectivo: 1500, montoTransferencia: 2500 };

test('rejects a missing or wrong PIN', async () => {
    assert.equal((await call('list', '')).code, 'unauthorized');
    assert.equal((await call('list', 'nope')).code, 'unauthorized');
});

test('login reports the role and the price', async () => {
    const v = await call('login', VEND);
    const a = await call('login', ADMIN);
    assert.deepEqual([v.role, a.role, v.precioUnitario], ['vendedor', 'admin', 1000]);
});

test('vendedor adds a mixed sale and it is listed with its cash/transfer split', async () => {
    const added = await call('add', VEND, { sale });
    assert.equal(added.status, 'success');
    assert.equal(added.venta.total, 4000);

    const { ventas } = await call('list', VEND);
    assert.equal(ventas.length, 1);
    assert.deepEqual(
        [ventas[0].vendedorName, ventas[0].cantidad, ventas[0].montoEfectivo, ventas[0].montoTransferencia],
        ['Ana', 4, 1500, 2500]
    );
    assert.ok(!('comprador' in ventas[0]) && !('pozoAmount' in ventas[0]));
});

test('rejects invalid sales', async () => {
    const bad = [
        { ...sale, montoEfectivo: 500, montoTransferencia: 500 },
        { ...sale, montoEfectivo: -500, montoTransferencia: 4500 },
        { ...sale, cantidad: 0 },
        { ...sale, cantidad: 1.5 },
        { ...sale, precioUnitario: 0 },
        { ...sale, formaPago: 'bitcoin' },
        { ...sale, vendedor: '   ' }
    ];
    for (const s of bad) {
        const r = await call('add', VEND, { sale: s });
        assert.equal(r.code, 'bad_request', JSON.stringify(s));
    }
});

test('vendedor cannot update, delete, clear or change the price', async () => {
    const { ventas } = await call('list', VEND);
    const id = ventas[0].id;
    assert.equal((await call('update', VEND, { id, sale })).code, 'forbidden');
    assert.equal((await call('delete', VEND, { id })).code, 'forbidden');
    assert.equal((await call('clear_all', VEND)).code, 'forbidden');
    assert.equal((await call('set_price', VEND, { precioUnitario: 5 })).code, 'forbidden');
});

test('admin updates, changes price, deletes and clears', async () => {
    const { ventas } = await call('list', ADMIN);
    const id = ventas[0].id;

    const upd = await call('update', ADMIN, { id, sale: { ...sale, cantidad: 5, formaPago: 'efectivo' } });
    assert.equal(upd.venta.total, 5000);
    assert.equal(upd.venta.montoTransferencia, 0);
    assert.equal(upd.venta.id, id);

    assert.equal((await call('update', ADMIN, { id: 1, sale })).code, 'not_found');

    assert.equal((await call('set_price', ADMIN, { precioUnitario: 2500 })).precioUnitario, 2500);
    assert.equal((await call('login', VEND)).precioUnitario, 2500);
    assert.equal((await call('set_price', ADMIN, { precioUnitario: 0 })).code, 'bad_request');

    assert.equal((await call('delete', ADMIN, { id })).status, 'success');
    assert.equal((await call('list', ADMIN)).ventas.length, 0);

    await call('add', VEND, { sale });
    await call('add', VEND, { sale });
    assert.equal((await call('list', ADMIN)).ventas.length, 2);
    await call('clear_all', ADMIN);
    assert.equal((await call('list', ADMIN)).ventas.length, 0);
});

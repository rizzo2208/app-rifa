document.addEventListener('DOMContentLoaded', () => {
    const rifaForm = document.getElementById('rifaForm');
    if (!rifaForm) return; // not on index.html

    const { api, priceFormatter, pagoBadges, esc } = window.Rifa;

    const VENDEDOR_KEY = 'rifaVendedor';

    const vendedorInput = document.getElementById('vendedor');
    const cantidadInput = document.getElementById('cantidadNumeros');
    const precioInput = document.getElementById('precioUnitario');
    const formaPagoSelect = document.getElementById('formaPago');
    const mixtoContainer = document.getElementById('mixtoContainer');
    const montoEfectivoInput = document.getElementById('montoEfectivo');
    const montoTransferenciaInput = document.getElementById('montoTransferencia');

    // Which mixed-payment box the user typed in last; the other one is derived from it.
    let lastEdited = 'efectivo';

    function getTotal() {
        const cant = Math.max(0, parseInt(cantidadInput.value, 10) || 0);
        const precio = parseFloat(precioInput.value) || 0;
        return cant * precio;
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    // ---------- Tabs ----------
    window.switchTab = function (tab) {
        const secVenta = document.getElementById('sectionVenta');
        const secHistorial = document.getElementById('sectionHistorial');
        const btnVenta = document.getElementById('btnTabVenta');
        const btnHistorial = document.getElementById('btnTabHistorial');

        if (tab === 'venta') {
            secVenta.classList.remove('hidden');
            secHistorial.classList.add('hidden');
            btnVenta.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
            btnHistorial.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700';
        } else {
            secVenta.classList.add('hidden');
            secHistorial.classList.remove('hidden');
            btnHistorial.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
            btnVenta.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700';
            loadHistorial();
        }
    };

    // ---------- Cantidad ----------
    function setCantidad(cant) {
        cantidadInput.value = Math.max(1, cant);
        refresh();
    }

    document.getElementById('btnMenos').addEventListener('click', () => setCantidad((parseInt(cantidadInput.value, 10) || 0) - 1));
    document.getElementById('btnMas').addEventListener('click', () => setCantidad((parseInt(cantidadInput.value, 10) || 0) + 1));
    document.querySelectorAll('.quick-cant').forEach(btn => {
        btn.addEventListener('click', () => setCantidad(Number(btn.dataset.cant)));
    });
    cantidadInput.addEventListener('input', refresh);
    precioInput.addEventListener('input', refresh);

    // ---------- Forma de pago ----------
    formaPagoSelect.addEventListener('change', () => {
        if (formaPagoSelect.value === 'mixto') {
            mixtoContainer.classList.remove('hidden');
            montoEfectivoInput.value = '';
            lastEdited = 'efectivo';
            syncMixto();
            montoEfectivoInput.focus();
        } else {
            mixtoContainer.classList.add('hidden');
        }
        calcularTotal();
    });

    // Typing one amount fills the other with the remaining difference.
    function syncMixto() {
        const total = getTotal();
        if (lastEdited === 'efectivo') {
            const efec = parseFloat(montoEfectivoInput.value) || 0;
            montoTransferenciaInput.value = round2(Math.max(0, total - efec));
        } else {
            const transf = parseFloat(montoTransferenciaInput.value) || 0;
            montoEfectivoInput.value = round2(Math.max(0, total - transf));
        }
    }

    montoEfectivoInput.addEventListener('input', () => {
        lastEdited = 'efectivo';
        syncMixto();
        calcularTotal();
    });

    montoTransferenciaInput.addEventListener('input', () => {
        lastEdited = 'transferencia';
        syncMixto();
        calcularTotal();
    });

    function refresh() {
        if (formaPagoSelect.value === 'mixto') syncMixto();
        calcularTotal();
    }

    function calcularTotal() {
        const cant = Math.max(0, parseInt(cantidadInput.value, 10) || 0);
        const precio = parseFloat(precioInput.value) || 0;
        const total = cant * precio;

        document.getElementById('lblDetalleTotal').textContent = `${cant} número/s × ${priceFormatter.format(precio)}`;
        document.getElementById('previewTotal').textContent = priceFormatter.format(total);

        const mixtoError = document.getElementById('mixtoError');
        if (formaPagoSelect.value === 'mixto') {
            const efec = parseFloat(montoEfectivoInput.value) || 0;
            const transf = parseFloat(montoTransferenciaInput.value) || 0;
            mixtoError.classList.toggle('hidden', Math.abs(efec + transf - total) <= 0.01);
        } else {
            mixtoError.classList.add('hidden');
        }
    }

    // ---------- Registrar venta ----------
    rifaForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cantidad = parseInt(cantidadInput.value, 10) || 0;
        if (cantidad <= 0) {
            alert('Ingresá una cantidad válida de números.');
            return;
        }

        const payload = {
            vendedor: vendedorInput.value.trim(),
            cantidad,
            precioUnitario: parseFloat(precioInput.value) || 0,
            formaPago: formaPagoSelect.value
        };

        if (payload.formaPago === 'mixto') {
            payload.montoEfectivo = parseFloat(montoEfectivoInput.value) || 0;
            payload.montoTransferencia = parseFloat(montoTransferenciaInput.value) || 0;
        }

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Registrando...';

        try {
            const data = await api.add(payload);

            window.Rifa.store(VENDEDOR_KEY, payload.vendedor);
            mostrarUltimaVenta(data.venta);
            formaPagoSelect.value = 'efectivo';
            mixtoContainer.classList.add('hidden');
            setCantidad(1);

            loadHistorial();
        } catch (error) {
            console.error('Error al registrar venta:', error);
            alert(error.message || 'Ocurrió un error al registrar la venta.');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Confirmar y Registrar Venta';
        }
    });

    function mostrarUltimaVenta(sale) {
        const card = document.getElementById('lastSaleCard');
        const details = document.getElementById('lastSaleDetails');
        card.classList.remove('hidden');

        details.innerHTML = `
            <p><strong>Cantidad:</strong> <span class="text-indigo-400 font-bold">${sale.cantidad} número/s</span></p>
            <p><strong>Efectivo:</strong> <span class="text-emerald-400 font-bold">${priceFormatter.format(sale.montoEfectivo)}</span></p>
            <p><strong>Transferencia:</strong> <span class="text-sky-400 font-bold">${priceFormatter.format(sale.montoTransferencia)}</span></p>
            <p><strong>Total:</strong> <span class="text-emerald-400 font-bold">${priceFormatter.format(sale.total)}</span></p>
        `;
    }

    // ---------- Balance (con modo privado) ----------
    const BALANCE_HIDDEN_KEY = 'rifaBalanceHidden';
    const MASK = '••••';
    const btnToggleBalance = document.getElementById('btnToggleBalance');

    // Hidden by default so nobody glancing at the screen sees the takings; the choice is remembered.
    let balanceHidden = window.Rifa.read(BALANCE_HIDDEN_KEY) !== 'false';
    let balance = { recaudado: 0, numeros: 0, efectivo: 0, transferencia: 0 };

    function renderBalance() {
        const show = (value, formatted) => (balanceHidden ? MASK : formatted(value));
        const money = (v) => priceFormatter.format(v);

        document.getElementById('boxTotalRecaudado').textContent = show(balance.recaudado, money);
        document.getElementById('boxTotalNumeros').textContent = show(balance.numeros, String);
        document.getElementById('boxTotalEfectivo').textContent = show(balance.efectivo, money);
        document.getElementById('boxTotalTransf').textContent = show(balance.transferencia, money);

        // The label names the action the button will perform.
        btnToggleBalance.textContent = balanceHidden ? '👁️ Mostrar' : '🙈 Ocultar';
        btnToggleBalance.setAttribute('aria-pressed', String(!balanceHidden));
    }

    btnToggleBalance.addEventListener('click', () => {
        balanceHidden = !balanceHidden;
        window.Rifa.store(BALANCE_HIDDEN_KEY, String(balanceHidden));
        renderBalance();
    });

    renderBalance();

    // ---------- Historial / balance ----------
    async function loadHistorial() {
        try {
            const { ventas: sales } = await api.list();

            balance = { recaudado: 0, numeros: 0, efectivo: 0, transferencia: 0 };

            sales.forEach(s => {
                balance.recaudado += s.total;
                balance.numeros += s.cantidad;
                balance.efectivo += s.montoEfectivo;
                balance.transferencia += s.montoTransferencia;
            });

            renderBalance();

            const tbody = document.getElementById('tablaVentasBody');
            tbody.innerHTML = '';

            if (sales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No hay ventas registradas.</td></tr>';
                return;
            }

            sales.forEach(sale => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/40 transition';
                tr.innerHTML = `
                    <td class="p-3 text-slate-400 whitespace-nowrap">${new Date(sale.createdAt).toLocaleString('es-AR')}</td>
                    <td class="p-3 font-semibold text-slate-200">${esc(sale.vendedorName)}</td>
                    <td class="p-3 font-mono text-indigo-300 font-bold">${sale.cantidad}</td>
                    <td class="p-3">${pagoBadges(sale)}</td>
                    <td class="p-3 text-right font-bold text-emerald-400">${priceFormatter.format(sale.total)}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error al cargar historial:', error);
        }
    }

    // ---------- Arranque: PIN primero ----------
    window.Rifa.requireAuth().then((session) => {
        window.Rifa.wireLogout();

        document.getElementById('userName').textContent = session.role === 'admin' ? 'Administrador' : 'Vendedor';
        if (session.role === 'admin') document.getElementById('adminLink').classList.remove('hidden');

        vendedorInput.value = window.Rifa.read(VENDEDOR_KEY) || '';
        precioInput.value = session.precioUnitario;
        calcularTotal();
        loadHistorial();
    });
});

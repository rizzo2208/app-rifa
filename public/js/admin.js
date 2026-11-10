document.addEventListener('DOMContentLoaded', () => {
    const salesTableBody = document.getElementById('salesTableBody');
    if (!salesTableBody) return; // no estamos en admin.html

    const priceFormatter = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    });

    function authHeaders() {
        const token = localStorage.getItem('userToken');
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        };
    }

    // ---------- Configuración ----------

    const configForm = document.getElementById('configForm');
    const configPrecioInput = document.getElementById('configPrecio');

    async function loadConfig() {
        try {
            const res = await fetch('/api/config', { headers: authHeaders() });
            const config = await res.json();
            configPrecioInput.value = config.precioUnitario;
        } catch (error) {
            console.error('Error al cargar configuración:', error);
        }
    }

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            precioUnitario: Number(configPrecioInput.value)
        };

        try {
            const res = await fetch('/api/admin/config', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
            const data = await res.json();

            if (!res.ok) {
                alert(data.message || 'No se pudo guardar la configuración.');
                return;
            }

            alert('Configuración guardada.');
        } catch (error) {
            console.error('Error al guardar configuración:', error);
        }
    });

    // ---------- Ventas ----------

    let allSales = [];
    const editModal = document.getElementById('editModal');
    const editForm = document.getElementById('editForm');
    const editFormaPagoSelect = document.getElementById('editFormaPago');
    const editMixtoContainer = document.getElementById('editMixtoContainer');
    const filterVendedor = document.getElementById('filterVendedor');
    const filterFormaPago = document.getElementById('filterFormaPago');
    const editCantidadInput = document.getElementById('editCantidad');
    const editPrecioInput = document.getElementById('editPrecioUnitario');
    const editEfectivoInput = document.getElementById('editMontoEfectivo');
    const editTransferenciaInput = document.getElementById('editMontoTransferencia');
    let editLastEdited = 'efectivo';

    // Shows how much was paid in cash and by transfer instead of a bare "mixto" label.
    function pagoBadges(sale) {
        const parts = [];
        if (sale.montoEfectivo > 0) {
            parts.push(`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">💵 ${priceFormatter.format(sale.montoEfectivo)}</span>`);
        }
        if (sale.montoTransferencia > 0) {
            parts.push(`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 whitespace-nowrap">📲 ${priceFormatter.format(sale.montoTransferencia)}</span>`);
        }
        return `<div class="flex flex-wrap gap-1">${parts.join('')}</div>`;
    }

    function pagoTexto(sale) {
        if (sale.formaPago === 'efectivo') return 'Efectivo';
        if (sale.formaPago === 'transferencia') return 'Transferencia';
        return `Mixto (Efectivo ${priceFormatter.format(sale.montoEfectivo)} + Transferencia ${priceFormatter.format(sale.montoTransferencia)})`;
    }

    function buildSaleRow(sale) {
        const tr = document.createElement('tr');
        tr.className = 'border-t border-slate-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-slate-400 whitespace-nowrap">${new Date(sale.createdAt).toLocaleString('es-AR')}</td>
            <td class="px-4 py-3 text-slate-200 font-medium">${sale.vendedorName}</td>
            <td class="px-4 py-3 font-mono text-indigo-300 font-bold">${sale.cantidad}</td>
            <td class="px-4 py-3">${pagoBadges(sale)}</td>
            <td class="px-4 py-3 text-right font-bold text-emerald-400">${priceFormatter.format(sale.total)}</td>
            <td class="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                <button data-action="edit" class="text-sm font-semibold text-indigo-400 hover:underline">Editar</button>
                <button data-action="delete" class="text-sm font-semibold text-rose-400 hover:underline">Eliminar</button>
            </td>
        `;
        tr.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(sale));
        tr.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSale(sale.id));
        return tr;
    }

    function populateVendedorFilter(sales) {
        const current = filterVendedor.value;
        const names = [...new Set(sales.map(s => s.vendedorName))].sort();

        filterVendedor.innerHTML = '<option value="">Todos</option>' +
            names.map(name => `<option value="${name}">${name}</option>`).join('');

        if (names.includes(current)) filterVendedor.value = current;
    }

    function getFilteredSales() {
        return allSales.filter(s => {
            if (filterVendedor.value && s.vendedorName !== filterVendedor.value) return false;
            if (filterFormaPago.value && s.formaPago !== filterFormaPago.value) return false;
            return true;
        });
    }

    function renderSales() {
        const filtered = getFilteredSales();

        salesTableBody.innerHTML = '';

        if (filtered.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-500">No hay ventas para mostrar.</td></tr>';
        } else {
            filtered.forEach(sale => salesTableBody.appendChild(buildSaleRow(sale)));
        }

        const total = filtered.reduce((acc, s) => acc + s.total, 0);
        const numeros = filtered.reduce((acc, s) => acc + s.cantidad, 0);
        const cash = filtered.reduce((acc, s) => acc + s.montoEfectivo, 0);
        const transfer = filtered.reduce((acc, s) => acc + s.montoTransferencia, 0);

        document.getElementById('sumTotal').textContent = priceFormatter.format(total);
        document.getElementById('sumNumeros').textContent = numeros;
        document.getElementById('sumCash').textContent = priceFormatter.format(cash);
        document.getElementById('sumTransfer').textContent = priceFormatter.format(transfer);
    }

    async function loadSales() {
        try {
            const res = await fetch('/api/sales', { headers: authHeaders() });
            allSales = await res.json();
            populateVendedorFilter(allSales);
            renderSales();
        } catch (error) {
            console.error('Error al cargar ventas:', error);
        }
    }

    filterVendedor.addEventListener('change', renderSales);
    filterFormaPago.addEventListener('change', renderSales);

    function openEditModal(sale) {
        document.getElementById('editSaleId').value = sale.id;
        editCantidadInput.value = sale.cantidad;
        editPrecioInput.value = sale.precioUnitario;
        editFormaPagoSelect.value = sale.formaPago;
        editEfectivoInput.value = sale.montoEfectivo;
        editTransferenciaInput.value = sale.montoTransferencia;
        editLastEdited = 'efectivo';
        editMixtoContainer.classList.toggle('hidden', sale.formaPago !== 'mixto');
        editModal.classList.remove('hidden');
        editModal.classList.add('flex');
    }

    function closeEditModal() {
        editModal.classList.add('hidden');
        editModal.classList.remove('flex');
    }

    // Typing one amount fills the other with the remaining difference.
    function syncEditMixto() {
        const total = (Number(editCantidadInput.value) || 0) * (Number(editPrecioInput.value) || 0);
        if (editLastEdited === 'efectivo') {
            const efec = Number(editEfectivoInput.value) || 0;
            editTransferenciaInput.value = Math.round(Math.max(0, total - efec) * 100) / 100;
        } else {
            const transf = Number(editTransferenciaInput.value) || 0;
            editEfectivoInput.value = Math.round(Math.max(0, total - transf) * 100) / 100;
        }
    }

    editFormaPagoSelect.addEventListener('change', () => {
        const isMixto = editFormaPagoSelect.value === 'mixto';
        editMixtoContainer.classList.toggle('hidden', !isMixto);
        if (isMixto) {
            editEfectivoInput.value = '';
            editLastEdited = 'efectivo';
            syncEditMixto();
        }
    });

    editEfectivoInput.addEventListener('input', () => {
        editLastEdited = 'efectivo';
        syncEditMixto();
    });

    editTransferenciaInput.addEventListener('input', () => {
        editLastEdited = 'transferencia';
        syncEditMixto();
    });

    [editCantidadInput, editPrecioInput].forEach(input => {
        input.addEventListener('input', () => {
            if (editFormaPagoSelect.value === 'mixto') syncEditMixto();
        });
    });

    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('editSaleId').value;
        const payload = {
            cantidad: Number(editCantidadInput.value),
            precioUnitario: Number(editPrecioInput.value),
            formaPago: editFormaPagoSelect.value
        };

        if (payload.formaPago === 'mixto') {
            payload.montoEfectivo = Number(editEfectivoInput.value);
            payload.montoTransferencia = Number(editTransferenciaInput.value);
        }

        try {
            const res = await fetch(`/api/admin/sales/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
            const data = await res.json();

            if (!res.ok) {
                alert(data.message || 'No se pudo guardar la venta.');
                return;
            }

            closeEditModal();
            loadSales();
        } catch (error) {
            console.error('Error al editar venta:', error);
        }
    });

    async function deleteSale(id) {
        if (!confirm('¿Eliminar esta venta?')) return;

        try {
            const res = await fetch(`/api/admin/sales/${id}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) {
                const data = await res.json();
                alert(data.message || 'No se pudo eliminar la venta.');
                return;
            }
            loadSales();
        } catch (error) {
            console.error('Error al eliminar venta:', error);
        }
    }

    document.getElementById('clearAllBtn').addEventListener('click', async () => {
        if (!confirm('⚠️ ¿Seguro que querés vaciar la caja? Esto borra TODAS las ventas registradas.')) return;
        if (!confirm('🚨 Última confirmación: asegurate de haber exportado el Excel antes de continuar. ¿Proceder?')) return;

        try {
            const res = await fetch('/api/admin/sales', { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) {
                alert('No se pudo vaciar la caja.');
                return;
            }
            loadSales();
        } catch (error) {
            console.error('Error al vaciar la caja:', error);
        }
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        const filtered = getFilteredSales();

        if (filtered.length === 0) {
            alert('No hay ventas para exportar.');
            return;
        }

        const dataToExport = filtered.map((s, idx) => ({
            'N°': idx + 1,
            'Fecha / Hora': new Date(s.createdAt).toLocaleString('es-AR'),
            'Vendedor': s.vendedorName,
            'Números': s.cantidad,
            'Precio Unitario ($)': s.precioUnitario,
            'Forma de Pago': pagoTexto(s),
            'Efectivo ($)': s.montoEfectivo,
            'Transferencia ($)': s.montoTransferencia,
            'Total ($)': s.total
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas Rifa');
        XLSX.writeFile(workbook, `Ventas_Rifa_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });

    loadConfig();
    loadSales();
});

document.addEventListener('DOMContentLoaded', () => {
    const salesTableBody = document.getElementById('salesTableBody');
    if (!salesTableBody) return; // not on admin.html

    const { api, priceFormatter, pagoBadges, pagoTexto, esc } = window.Rifa;

    let allSales = [];

    const configForm = document.getElementById('configForm');
    const configPrecioInput = document.getElementById('configPrecio');

    const editModal = document.getElementById('editModal');
    const editForm = document.getElementById('editForm');
    const editFormaPagoSelect = document.getElementById('editFormaPago');
    const editMixtoContainer = document.getElementById('editMixtoContainer');
    const editVendedorInput = document.getElementById('editVendedor');
    const editCantidadInput = document.getElementById('editCantidad');
    const editPrecioInput = document.getElementById('editPrecioUnitario');
    const editEfectivoInput = document.getElementById('editMontoEfectivo');
    const editTransferenciaInput = document.getElementById('editMontoTransferencia');
    const filterVendedor = document.getElementById('filterVendedor');
    const filterFormaPago = document.getElementById('filterFormaPago');
    let editLastEdited = 'efectivo';

    // ---------- Configuración ----------

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            await api.setPrice(Number(configPrecioInput.value));
            alert('Configuración guardada.');
        } catch (error) {
            alert(error.message || 'No se pudo guardar la configuración.');
        }
    });

    // ---------- Ventas ----------

    function buildSaleRow(sale) {
        const tr = document.createElement('tr');
        tr.className = 'border-t border-slate-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-slate-400 whitespace-nowrap">${new Date(sale.createdAt).toLocaleString('es-AR')}</td>
            <td class="px-4 py-3 text-slate-200 font-medium">${esc(sale.vendedorName)}</td>
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
            names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');

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
            const data = await api.list();
            allSales = data.ventas;
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
        editVendedorInput.value = sale.vendedorName;
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

        const id = Number(document.getElementById('editSaleId').value);
        const payload = {
            vendedor: editVendedorInput.value.trim(),
            cantidad: Number(editCantidadInput.value),
            precioUnitario: Number(editPrecioInput.value),
            formaPago: editFormaPagoSelect.value
        };

        if (payload.formaPago === 'mixto') {
            payload.montoEfectivo = Number(editEfectivoInput.value);
            payload.montoTransferencia = Number(editTransferenciaInput.value);
        }

        try {
            await api.update(id, payload);
            closeEditModal();
            loadSales();
        } catch (error) {
            alert(error.message || 'No se pudo guardar la venta.');
        }
    });

    async function deleteSale(id) {
        if (!confirm('¿Eliminar esta venta?')) return;

        try {
            await api.remove(id);
            loadSales();
        } catch (error) {
            alert(error.message || 'No se pudo eliminar la venta.');
        }
    }

    document.getElementById('clearAllBtn').addEventListener('click', async () => {
        if (!confirm('⚠️ ¿Seguro que querés vaciar la caja? Esto borra TODAS las ventas registradas.')) return;
        if (!confirm('🚨 Última confirmación: asegurate de haber exportado el Excel antes de continuar. ¿Proceder?')) return;

        try {
            await api.clearAll();
            loadSales();
        } catch (error) {
            alert(error.message || 'No se pudo vaciar la caja.');
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

    // ---------- Arranque: solo con PIN de administrador ----------
    window.Rifa.requireAuth({ admin: true }).then((session) => {
        window.Rifa.wireLogout();
        document.getElementById('userName').textContent = 'Administrador';
        configPrecioInput.value = session.precioUnitario;
        loadSales();
    });
});

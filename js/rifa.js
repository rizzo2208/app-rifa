// Shared client library: Apps Script API client, PIN gate and display helpers.
(function () {
    const PIN_KEY = 'rifaPin';
    const ROLE_KEY = 'rifaRole';

    const priceFormatter = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    });

    // localStorage can throw (private mode, blocked site data): never let that break the app.
    function store(key, value) {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch (e) { /* ignore */ }
    }

    function read(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function apiUrl() {
        // On localhost always use the local fake (`npm run dev`), so testing never touches the real sheet.
        if (['localhost', '127.0.0.1'].includes(location.hostname)) return '/exec';
        return (window.RIFA_CONFIG && window.RIFA_CONFIG.apiUrl && window.RIFA_CONFIG.apiUrl.trim()) || '';
    }

    async function call(action, data, pinOverride) {
        const url = apiUrl();
        if (!url) {
            const err = new Error('Falta configurar la URL del Apps Script en js/config.js.');
            err.code = 'not_configured';
            throw err;
        }

        const res = await fetch(url, {
            method: 'POST',
            // text/plain keeps this a "simple" request, so the browser sends no CORS preflight.
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, pin: pinOverride !== undefined ? pinOverride : read(PIN_KEY), ...data })
        });

        let json;
        try {
            json = await res.json();
        } catch (e) {
            const err = new Error('La respuesta del servidor no es válida. Revisá la URL del Apps Script.');
            err.code = 'bad_response';
            throw err;
        }

        if (json.status !== 'success') {
            const err = new Error(json.message || 'Error desconocido.');
            err.code = json.code;
            throw err;
        }
        return json;
    }

    // Any call except login: a rejected PIN sends the user back to the gate.
    async function authed(action, data) {
        try {
            return await call(action, data);
        } catch (err) {
            if (err.code === 'unauthorized') {
                logout();
            }
            throw err;
        }
    }

    const api = {
        login: (pin) => call('login', {}, pin),
        list: () => authed('list'),
        add: (sale) => authed('add', { sale }),
        update: (id, sale) => authed('update', { id, sale }),
        remove: (id) => authed('delete', { id }),
        clearAll: () => authed('clear_all'),
        setPrice: (precioUnitario) => authed('set_price', { precioUnitario })
    };

    function logout() {
        store(PIN_KEY, null);
        store(ROLE_KEY, null);
        location.reload();
    }

    function showGate(opts, resolve, initialMessage) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4';
        overlay.innerHTML = `
            <form class="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <div class="text-center">
                    <h1 class="text-2xl font-bold text-white">🎟️ Rifa Master</h1>
                    <p class="text-sm text-slate-400 mt-1">${opts.admin ? 'Ingresá el PIN de administrador' : 'Ingresá tu PIN para continuar'}</p>
                </div>
                <input id="gatePin" type="password" autocomplete="current-password" required placeholder="PIN"
                    class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-center text-lg tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <p id="gateError" class="text-sm text-rose-400 text-center ${initialMessage ? '' : 'hidden'}">${initialMessage || ''}</p>
                <button type="submit" id="gateBtn" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition">Entrar</button>
            </form>`;
        document.body.appendChild(overlay);

        const form = overlay.querySelector('form');
        const pinInput = overlay.querySelector('#gatePin');
        const errorEl = overlay.querySelector('#gateError');
        const btn = overlay.querySelector('#gateBtn');
        pinInput.focus();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorEl.classList.add('hidden');
            btn.disabled = true;
            btn.textContent = 'Verificando...';

            try {
                const pin = pinInput.value.trim();
                const result = await call('login', {}, pin);

                if (opts.admin && result.role !== 'admin') {
                    throw Object.assign(new Error('Esta sección requiere el PIN de administrador.'), { code: 'forbidden' });
                }

                store(PIN_KEY, pin);
                store(ROLE_KEY, result.role);
                overlay.remove();
                resolve(result);
            } catch (err) {
                errorEl.textContent = err.code === 'unauthorized' ? 'PIN incorrecto.' : err.message;
                errorEl.classList.remove('hidden');
                pinInput.select();
            } finally {
                btn.disabled = false;
                btn.textContent = 'Entrar';
            }
        });
    }

    // Resolves with { role, precioUnitario } once the visitor holds a valid PIN.
    // With { admin: true } only the administrator PIN is accepted.
    async function requireAuth(opts = {}) {
        const stored = read(PIN_KEY);
        let message = '';

        if (stored) {
            try {
                const result = await call('login', {}, stored);
                if (!opts.admin || result.role === 'admin') {
                    store(ROLE_KEY, result.role);
                    return result;
                }
                message = 'Esta sección requiere el PIN de administrador.';
            } catch (err) {
                if (err.code !== 'unauthorized') message = err.message;
            }
        }

        return new Promise((resolve) => showGate(opts, resolve, message));
    }

    // How much was paid in cash and by transfer, instead of a bare "mixto" label.
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

    // Vendor names come from free text typed by users: escape before putting them in HTML.
    function esc(value) {
        return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function wireLogout() {
        const btn = document.getElementById('logoutBtn');
        if (btn) btn.addEventListener('click', logout);
    }

    window.Rifa = { api, requireAuth, logout, wireLogout, priceFormatter, pagoBadges, pagoTexto, esc, store, read };
})();

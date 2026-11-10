// Local dev server: serves the static app and runs the REAL apps-script/Code.gs
// against an in-memory fake of the Apps Script / Google Sheets APIs.
// Data lives in memory only and resets when the server stops.
//
//   node dev/mock-server.js            (PORT=3006, PINs from env or defaults below)
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3006;
const PIN_VENDEDOR = process.env.PIN_VENDEDOR || '1111';
const PIN_ADMIN = process.env.PIN_ADMIN || '9999';

// ---------- Fake Google services (only what Code.gs uses) ----------

function createFakeSheet(name) {
    const sheet = { name, rows: [] };
    const api = {
        getLastRow: () => sheet.rows.length,
        appendRow: (row) => { sheet.rows.push([...row]); },
        setName: (n) => { sheet.name = n; },
        setFrozenRows: () => {},
        deleteRow: (n) => { sheet.rows.splice(n - 1, 1); },
        deleteRows: (start, count) => { sheet.rows.splice(start - 1, count); },
        getRange: (a, b, c, d) => {
            if (typeof a === 'string') {
                return { setNumberFormat() {}, setFontWeight() {} };
            }
            return {
                getValues: () => sheet.rows.slice(a - 1, a - 1 + c).map(r => r.slice(b - 1, b - 1 + d)),
                setValues: (vals) => { vals.forEach((v, i) => { sheet.rows[a - 1 + i] = [...v]; }); },
                setFontWeight() {}
            };
        },
        _sheet: sheet
    };
    return api;
}

function createContext() {
    const sheets = [createFakeSheet('Sheet1')];
    const props = { PIN_VENDEDOR, PIN_ADMIN };

    const pad = (n) => String(n).padStart(2, '0');

    const context = {
        console,
        Number, Math, Date, JSON, String, Object, Array, Error, isFinite,
        SpreadsheetApp: {
            getActiveSpreadsheet: () => ({
                getSheetByName: (n) => sheets.find(s => s._sheet.name === n) || null,
                getSheets: () => sheets,
                insertSheet: (n) => { const s = createFakeSheet(n); sheets.push(s); return s; }
            })
        },
        LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
        PropertiesService: {
            getScriptProperties: () => ({
                getProperty: (k) => (k in props ? props[k] : null),
                setProperty: (k, v) => { props[k] = v; }
            })
        },
        ContentService: {
            MimeType: { JSON: 'application/json' },
            createTextOutput: (content) => ({ content, setMimeType() { return this; } })
        },
        Utilities: {
            sleep() {},
            formatDate: (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        },
        Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' }
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
    return context;
}

// ---------- HTTP ----------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };

function createServer() {
    const context = createContext();

    return http.createServer((req, res) => {
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };

        if (req.url.startsWith('/exec')) {
            if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

            if (req.method === 'GET') {
                context.__result = vm.runInContext('doGet()', context);
                res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
                return res.end(context.__result.content);
            }

            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
                context.__event = { postData: { contents: body } };
                const out = vm.runInContext('doPost(__event)', context);
                res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
                res.end(out.content);
            });
            return;
        }

        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));

        if (!file.startsWith(ROOT) || file.startsWith(path.join(ROOT, 'dev')) || file.startsWith(path.join(ROOT, '.git')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404);
            return res.end('Not found');
        }

        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
}

if (require.main === module) {
    createServer().listen(PORT, () => {
        console.log(`Rifa dev server: http://localhost:${PORT}  (PIN vendedor: ${PIN_VENDEDOR}, PIN admin: ${PIN_ADMIN})`);
    });
}

module.exports = { createServer };

// Google Apps Script backend for the raffle app.
// The spreadsheet is the database. Access is controlled with two PINs kept in
// Project Settings > Script Properties (never in the repository):
//   PIN_VENDEDOR  can register sales and read the history
//   PIN_ADMIN     can additionally edit, delete, clear everything and change the price

const SHEET_NAME = 'Ventas';
const HEADERS = [
  'ID', 'Fecha / Hora', 'Vendedor', 'Números', 'Precio Unitario ($)',
  'Forma de Pago', 'Efectivo ($)', 'Transferencia ($)', 'Total ($)'
];
const DEFAULT_PRICE = 1000;
const PAYMENT_TYPES = ['efectivo', 'transferencia', 'mixto'];

function doGet() {
  return json_({ status: 'success', message: 'Rifa API is up' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return fail_('Pedido inválido.', 'bad_request');
  }

  const role = roleFor_(body.pin);
  if (!role) {
    Utilities.sleep(800); // slows down PIN guessing
    return fail_('PIN incorrecto.', 'unauthorized');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    switch (body.action) {
      case 'login':
        return ok_({ role: role, precioUnitario: getPrice_() });

      case 'list':
        return ok_({ ventas: listSales_(), precioUnitario: getPrice_() });

      case 'add':
        return ok_({ venta: addSale_(body.sale) });

      case 'update':
        requireAdmin_(role);
        return ok_({ venta: updateSale_(body.id, body.sale) });

      case 'delete':
        requireAdmin_(role);
        deleteSale_(body.id);
        return ok_({});

      case 'clear_all':
        requireAdmin_(role);
        clearAll_();
        return ok_({});

      case 'set_price':
        requireAdmin_(role);
        return ok_({ precioUnitario: setPrice_(body.precioUnitario) });

      default:
        return fail_('Acción desconocida.', 'bad_request');
    }
  } catch (err) {
    if (err && err.apiCode) return fail_(err.message, err.apiCode);
    return fail_('Error interno: ' + String(err), 'internal');
  } finally {
    lock.releaseLock();
  }
}

// ---------- Access control ----------

function roleFor_(pin) {
  const props = PropertiesService.getScriptProperties();
  const admin = props.getProperty('PIN_ADMIN');
  const vendedor = props.getProperty('PIN_VENDEDOR');
  const given = String(pin || '');

  if (!given) return null;
  if (admin && given === admin) return 'admin';
  if (vendedor && given === vendedor) return 'vendedor';
  return null;
}

function requireAdmin_(role) {
  if (role !== 'admin') throw apiError_('Esta acción requiere el PIN de administrador.', 'forbidden');
}

// ---------- Validation ----------

function validateSale_(sale) {
  if (!sale) throw apiError_('Faltan los datos de la venta.', 'bad_request');

  const cantidad = Number(sale.cantidad);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw apiError_('La cantidad de números debe ser un número entero mayor a 0.', 'bad_request');
  }

  const precio = Number(sale.precioUnitario);
  if (!isFinite(precio) || precio <= 0) {
    throw apiError_('El precio unitario debe ser mayor a 0.', 'bad_request');
  }

  if (PAYMENT_TYPES.indexOf(sale.formaPago) === -1) {
    throw apiError_('Forma de pago inválida.', 'bad_request');
  }

  const vendedor = String(sale.vendedor || '').trim().slice(0, 60);
  if (!vendedor) throw apiError_('Indicá el nombre del vendedor.', 'bad_request');

  const total = cantidad * precio;
  let efectivo = 0;
  let transferencia = 0;

  if (sale.formaPago === 'efectivo') {
    efectivo = total;
  } else if (sale.formaPago === 'transferencia') {
    transferencia = total;
  } else {
    efectivo = Number(sale.montoEfectivo) || 0;
    transferencia = Number(sale.montoTransferencia) || 0;
    if (efectivo < 0 || transferencia < 0) {
      throw apiError_('Los montos de efectivo y transferencia no pueden ser negativos.', 'bad_request');
    }
    if (Math.abs(efectivo + transferencia - total) > 0.01) {
      throw apiError_('En pago mixto, la suma de efectivo y transferencia debe ser igual al total.', 'bad_request');
    }
  }

  return {
    vendedor: vendedor,
    cantidad: cantidad,
    precioUnitario: precio,
    formaPago: sale.formaPago,
    montoEfectivo: efectivo,
    montoTransferencia: transferencia,
    total: total
  };
}

// ---------- Sales ----------

function addSale_(input) {
  const sale = validateSale_(input);
  const id = Date.now(); // also encodes the creation time
  getSheet_().appendRow(toRow_(id, sale));
  return toSale_(toRow_(id, sale));
}

function updateSale_(id, input) {
  const sale = validateSale_(input);
  const sheet = getSheet_();
  const row = findRow_(sheet, id);
  if (row === -1) throw apiError_('Venta no encontrada.', 'not_found');

  const values = toRow_(Number(id), sale);
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([values]);
  return toSale_(values);
}

function deleteSale_(id) {
  const sheet = getSheet_();
  const row = findRow_(sheet, id);
  if (row === -1) throw apiError_('Venta no encontrada.', 'not_found');
  sheet.deleteRow(row);
}

function clearAll_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
}

function listSales_() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];

  const rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return rows.map(toSale_).sort(function (a, b) { return b.id - a.id; });
}

function toRow_(id, sale) {
  return [
    id,
    Utilities.formatDate(new Date(id), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    sale.vendedor,
    sale.cantidad,
    sale.precioUnitario,
    sale.formaPago,
    sale.montoEfectivo,
    sale.montoTransferencia,
    sale.total
  ];
}

function toSale_(row) {
  const id = Number(row[0]);
  return {
    id: id,
    createdAt: new Date(id).toISOString(),
    vendedorName: String(row[2]),
    cantidad: Number(row[3]),
    precioUnitario: Number(row[4]),
    formaPago: String(row[5]),
    montoEfectivo: Number(row[6]),
    montoTransferencia: Number(row[7]),
    total: Number(row[8])
  };
}

// Returns the 1-based sheet row for a sale id, or -1.
function findRow_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;

  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === Number(id)) return i + 2;
  }
  return -1;
}

// ---------- Price ----------

function getPrice_() {
  const stored = Number(PropertiesService.getScriptProperties().getProperty('PRICE'));
  return stored > 0 ? stored : DEFAULT_PRICE;
}

function setPrice_(value) {
  const price = Number(value);
  if (!isFinite(price) || price <= 0) throw apiError_('El precio unitario debe ser mayor a 0.', 'bad_request');
  PropertiesService.getScriptProperties().setProperty('PRICE', String(price));
  return price;
}

// ---------- Sheet ----------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    // Reuse the default empty first tab of a brand-new spreadsheet instead of leaving it blank.
    const first = ss.getSheets()[0];
    if (first.getLastRow() === 0) {
      sheet = first;
      sheet.setName(SHEET_NAME);
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
    }
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    // Show the long numeric ID in full instead of scientific notation.
    sheet.getRange('A:A').setNumberFormat('0');
  }

  return sheet;
}

// ---------- Responses ----------

function apiError_(message, code) {
  const err = new Error(message);
  err.apiCode = code;
  return err;
}

function ok_(data) {
  return json_(Object.assign({ status: 'success' }, data));
}

function fail_(message, code) {
  return json_({ status: 'error', code: code, message: message });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

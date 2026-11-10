// Google Apps Script web app that mirrors raffle sales into a Google Sheet.
// Paste this into Extensions > Apps Script of the target spreadsheet.
// The shared secret lives in Project Settings > Script Properties, key: TOKEN

const SHEET_NAME = 'Ventas';
const HEADERS = [
  'ID', 'Fecha / Hora', 'Vendedor', 'Números', 'Precio Unitario ($)',
  'Forma de Pago', 'Efectivo ($)', 'Transferencia ($)', 'Total ($)'
];

function doGet() {
  return json_({ status: 'success', message: 'Rifa Sheets endpoint is up' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const body = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');

    if (!expected || body.token !== expected) {
      return json_({ status: 'error', message: 'unauthorized' });
    }

    const sheet = getSheet_();

    switch (body.action) {
      case 'add':
        sheet.appendRow(toRow_(body.sale));
        break;

      case 'update': {
        const row = findRow_(sheet, body.sale.id);
        if (row === -1) {
          // Not mirrored yet (e.g. it was created while the mirror was off): add it.
          sheet.appendRow(toRow_(body.sale));
        } else {
          sheet.getRange(row, 1, 1, HEADERS.length).setValues([toRow_(body.sale)]);
        }
        break;
      }

      case 'delete': {
        const row = findRow_(sheet, body.id);
        if (row !== -1) sheet.deleteRow(row);
        break;
      }

      case 'clear_all':
        if (sheet.getLastRow() > 1) {
          sheet.deleteRows(2, sheet.getLastRow() - 1);
        }
        break;

      default:
        return json_({ status: 'error', message: 'unknown action' });
    }

    return json_({ status: 'success' });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
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

function toRow_(s) {
  return [s.id, s.fecha, s.vendedor, s.cantidad, s.precioUnitario,
          s.formaPago, s.montoEfectivo, s.montoTransferencia, s.total];
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

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

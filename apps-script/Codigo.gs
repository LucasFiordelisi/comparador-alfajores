// Votaciones del comparador de alfajores — Google Apps Script.
//
// Setup (una vez):
//  1. En tu hoja de Google: Extensions > Apps Script.
//  2. Pegá todo este archivo y guardá.
//  3. Deploy > New deployment > Web app:
//       - Execute as: Me
//       - Who has access: Anyone
//     y copiá la URL (.../exec).
//
// La hoja "Votaciones" se crea sola con los encabezados en el primer uso.
// Re-votar el mismo alfajor como el mismo usuario REEMPLAZA el voto (opción A).

var TOKEN = 'alfajor-stats-2026'; // anti-spam; no es secreto (vive en el HTML)
var SHEET_NAME = 'Votaciones';
var PARAMS = ['priceQuality', 'dulceDeLeche', 'chocolate', 'tapas', 'contundencia', 'originalidad'];
var HEADERS = ['timestamp', 'usuarioId', 'usuarioNombre', 'alfajorId'].concat(PARAMS);
var CACHE_KEY = 'totals-v1';
var CACHE_SECONDS = 60;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
  }
  return sh;
}

// Agrega la hoja completa: { alfajorId: { param: { sum, count } } }.
function totals_() {
  var cached = CacheService.getScriptCache().get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var values = sheet_().getDataRange().getValues(); // fila 0 = encabezados
  var totals = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var pid = String(row[3]);
    if (!pid) continue;
    if (!totals[pid]) totals[pid] = {};
    for (var i = 0; i < PARAMS.length; i++) {
      var v = Number(row[4 + i]);
      if (!isFinite(v) || v < 1 || v > 10) continue;
      var k = PARAMS[i];
      if (!totals[pid][k]) totals[pid][k] = { sum: 0, count: 0 };
      totals[pid][k].sum += v;
      totals[pid][k].count += 1;
    }
  }
  CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(totals), CACHE_SECONDS);
  return totals;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, totals: totals_() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var body = {};
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (parseErr) {
      return json_({ ok: false, error: 'json' });
    }
    if (body.token !== TOKEN) return json_({ ok: false, error: 'token' });

    var uid = String(body.usuarioId || '');
    var pid = String(body.alfajorId || '');
    var name = String(body.usuarioNombre || '').slice(0, 30);
    if (!/^usuario\d+$/.test(uid) || !pid) return json_({ ok: false, error: 'payload' });

    var scores = {};
    for (var i = 0; i < PARAMS.length; i++) {
      var v = Number(body.scores && body.scores[PARAMS[i]]);
      if (!isFinite(v) || v < 1 || v > 10) return json_({ ok: false, error: 'score: ' + PARAMS[i] });
      scores[PARAMS[i]] = v;
    }

    var sh = sheet_();
    var values = sh.getDataRange().getValues();
    var targetRow = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][1]) === uid && String(values[r][3]) === pid) {
        targetRow = r + 1; // getRange es 1-based e incluye el encabezado
        break;
      }
    }
    var row = [new Date(), uid, name, pid].concat(PARAMS.map(function (k) { return scores[k]; }));
    if (targetRow > 0) sh.getRange(targetRow, 1, 1, HEADERS.length).setValues([row]);
    else sh.appendRow(row);

    CacheService.getScriptCache().remove(CACHE_KEY);
    return json_({ ok: true, totals: totals_() });
  } finally {
    lock.releaseLock();
  }
}

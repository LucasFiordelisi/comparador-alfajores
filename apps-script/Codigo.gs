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

function candidatesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CANDIDATES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CANDIDATES_SHEET);
    sh.appendRow(CANDIDATE_HEADERS);
  }
  return sh;
}

// Agrega la hoja completa: { totals: {alfajorId: {param: {sum, count}}},
//                             users: {usuarioId: nombre} }.
function data_() {
  var cached = CacheService.getScriptCache().get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var values = sheet_().getDataRange().getValues(); // fila 0 = encabezados
  var totals = {};
  var users = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var uid = String(row[1]);
    var nm = String(row[2] || '');
    var pid = String(row[3]);
    // El upsert sobrescribe la fila, asi que la ultima aparicion tiene el nombre actual.
    // Se guarda el uid aunque no tenga nombre: sirve para avisar slots ocupados
    // y contar participantes (el nombre vacio se muestra como "usuarioN" pelado).
    if (uid) users[uid] = nm;
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
  var data = { totals: totals, users: users };
  CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(data), CACHE_SECONDS);
  return data;
}

function candidatesData_() {
  var cached = CacheService.getScriptCache().get(CACHE_CANDIDATES_KEY);
  if (cached) return JSON.parse(cached);

  var sh = candidatesSheet_();
  var values = sh.getDataRange().getValues();
  var candidates = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var alfajorId = String(row[2] || '').trim();
    if (!alfajorId) continue;
    candidates.push({
      alfajorId: alfajorId,
      marca: String(row[3] || '').trim(),
      modelo: String(row[4] || '').trim(),
      color: String(row[5] || '').trim(),
      logoDataUrl: String(row[6] || '').trim(),
      createdBy: String(row[1] || '').trim()
    });
  }
  var data = { candidates: candidates };
  CacheService.getScriptCache().put(CACHE_CANDIDATES_KEY, JSON.stringify(data), CACHE_SECONDS);
  return data;
}

function json_(obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return out;
}

function doGet() {
  try {
    var d = {};
    try { d = data_(); } catch (e1) { d = { totals: {}, users: {} }; }
    var cands = [];
    try {
      var c = candidatesData_();
      if (c && Array.isArray(c.candidates)) cands = c.candidates;
    } catch (e2) { cands = []; }
    return json_({ ok: true, totals: d.totals || {}, users: d.users || {}, candidates: cands });
  } catch (e) {
    try {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, totals: {}, users: {}, candidates: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (e3) {
      return ContentService.createTextOutput('{"ok":true,"totals":{},"users":{},"candidates":[]}').setMimeType(ContentService.MimeType.JSON);
    }
  }
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

    // Agregar candidato (solo usuario1)
    if (body.action === 'addCandidate') {
      var uid = String(body.usuarioId || '');
      if (uid !== 'usuario1') return json_({ ok: false, error: 'unauthorized' });
      var pid = String(body.alfajorId || '').trim().toLowerCase();
      var marca = String(body.marca || '').trim().slice(0, 60);
      var modelo = String(body.modelo || '').trim().slice(0, 60);
      var color = String(body.color || '').trim().slice(0, 7);
      var logoDataUrl = String(body.logoDataUrl || '');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pid) || !marca || !modelo) {
        return json_({ ok: false, error: 'payload' });
      }
      // Limitar tamaño de imagen para evitar inflar demasiado la hoja
      if (logoDataUrl.length > 180000) return json_({ ok: false, error: 'image-too-large' });

      var shc = candidatesSheet_();
      var cvals = shc.getDataRange().getValues();
      for (var cr = 1; cr < cvals.length; cr++) {
        if (String(cvals[cr][2] || '').trim().toLowerCase() === pid) {
          // Permitir reemplazar imagen/color si ya existe (actualizar)
          shc.getRange(cr + 1, 5, 1, 3).setValues([[color, logoDataUrl, cvals[cr][6]]]); // mantener logo si vacío? reemplazamos con lo enviado
          // Reemplazo completo de los campos editables
          shc.getRange(cr + 1, 6, 1, 2).setValues([[color, logoDataUrl]]);
          CacheService.getScriptCache().remove(CACHE_CANDIDATES_KEY);
          CacheService.getScriptCache().remove(CACHE_KEY);
          var d2 = data_();
          var c2 = candidatesData_();
          return json_({ ok: true, totals: d2.totals, users: d2.users, candidates: c2.candidates || [], updated: true });
        }
      }
      shc.appendRow([new Date(), uid, pid, marca, modelo, color, logoDataUrl]);
      CacheService.getScriptCache().remove(CACHE_CANDIDATES_KEY);
      CacheService.getScriptCache().remove(CACHE_KEY);
      var d3 = data_();
      var c3 = candidatesData_();
      return json_({ ok: true, totals: d3.totals, users: d3.users, candidates: c3.candidates || [], created: true });
    }

    var uidv = String(body.usuarioId || '');
    var pidv = String(body.alfajorId || '');
    var name = String(body.usuarioNombre || '').slice(0, 30);
    if (!/^usuario\d+$/.test(uidv) || !pidv) return json_({ ok: false, error: 'payload' });

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
      if (String(values[r][1]) === uidv && String(values[r][3]) === pidv) {
        targetRow = r + 1; // getRange es 1-based e incluye el encabezado
        break;
      }
    }
    var row = [new Date(), uidv, name, pidv].concat(PARAMS.map(function (k) { return scores[k]; }));
    if (targetRow > 0) sh.getRange(targetRow, 1, 1, HEADERS.length).setValues([row]);
    else sh.appendRow(row);

    CacheService.getScriptCache().remove(CACHE_KEY);
    var dv = data_();
    var cv = candidatesData_();
    return json_({ ok: true, totals: dv.totals, users: dv.users, candidates: cv.candidates || [] });
  } finally {
    lock.releaseLock();
  }
}

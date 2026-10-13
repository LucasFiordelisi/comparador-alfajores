// Minimal local stand-in for the Google Apps Script web app (same API):
//   GET  /exec  -> { ok: true, totals }
//   POST /exec  -> upsert by usuarioId+alfajorId, returns updated totals
// Used by tools/cloud-test.js. Run standalone: node tools/mock-votes-server.js [port]
const http = require('http');

const TOKEN = 'alfajor-stats-2026';
const PARAMS = ['priceQuality', 'dulceDeLeche', 'chocolate', 'tapas', 'contundencia', 'originalidad'];

function computeTotals(rows) {
  const totals = {};
  rows.forEach((row) => {
    if (!totals[row.alfajorId]) totals[row.alfajorId] = {};
    PARAMS.forEach((k) => {
      const v = Number(row.scores[k]);
      if (!Number.isFinite(v) || v < 1 || v > 10) return;
      if (!totals[row.alfajorId][k]) totals[row.alfajorId][k] = { sum: 0, count: 0 };
      totals[row.alfajorId][k].sum += v;
      totals[row.alfajorId][k].count += 1;
    });
  });
  return totals;
}

function computeUsers(rows) {
  const users = {};
  rows.forEach((row) => {
    // Uids go in even without a name (slot-taken warnings, participant count).
    if (row.usuarioId) users[row.usuarioId] = row.usuarioNombre || '';
  });
  return users;
}

function payload(rows) {
  return { ok: true, totals: computeTotals(rows), users: computeUsers(rows) };
}

function startServer(port) {
  const rows = []; // { usuarioId, usuarioNombre, alfajorId, scores }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const send = (obj) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };

    if (req.method === 'GET') {
      send(payload(rows));
      return;
    }

    if (req.method !== 'POST') { send({ ok: false, error: 'method' }); return; }

    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw || '{}'); } catch (e) { send({ ok: false, error: 'json' }); return; }
      if (body.token !== TOKEN) { send({ ok: false, error: 'token' }); return; }
      const uid = String(body.usuarioId || '');
      const pid = String(body.alfajorId || '');
      if (!/^usuario\d+$/.test(uid) || !pid) { send({ ok: false, error: 'payload' }); return; }
      const scores = {};
      for (const k of PARAMS) {
        const v = Number(body.scores && body.scores[k]);
        if (!Number.isFinite(v) || v < 1 || v > 10) { send({ ok: false, error: 'score' }); return; }
        scores[k] = v;
      }
      const existing = rows.find((r) => r.usuarioId === uid && r.alfajorId === pid);
      const record = { usuarioId: uid, usuarioNombre: String(body.usuarioNombre || '').slice(0, 30), alfajorId: pid, scores };
      if (existing) Object.assign(existing, record);
      else rows.push(record);
      send(payload(rows));
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: 'http://127.0.0.1:' + port + '/exec',
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { startServer };

if (require.main === module) {
  startServer(Number(process.argv[2]) || 8787).then((s) => console.log('mock votes server:', s.url));
}

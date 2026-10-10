// Assembles the single-file deliverable:
//   datos/alfajores-ejemplo.xlsx  ->  PRODUCTS data (via xlsx)
//   tools/vendor/*.js             ->  inline libraries
//   tools/index.template.html     ->  ../index.html
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'datos', 'alfajores-ejemplo.xlsx');

const ATTR_LABEL_TO_KEY = {
  'Relación calidad/precio': 'priceQuality',
  'Cantidad de dulce de leche': 'dulceDeLeche',
  'Sabor del chocolate': 'chocolate',
  'Calidad de las tapas': 'tapas',
  'Contundencia': 'contundencia',
  'Originalidad': 'originalidad',
};

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// Reads the Votaciones sheet into Map(brand||key -> array aligned with userCols).
// Array keeps null for users that did not vote (overlay in the app needs positions).
function readVotes(ws) {
  const header = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
  const userCols = header
    .map((h) => String(h).trim())
    .filter((h) => /^usuario\d+$/i.test(h))
    .sort((a, b) => parseInt(a.replace(/\D+/g, ''), 10) - parseInt(b.replace(/\D+/g, ''), 10));
  if (userCols.length === 0) throw new Error('La hoja "Votaciones" no tiene columnas usuario1..N.');

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const votes = new Map();

  rows.forEach((row, i) => {
    const fila = i + 2;
    const brand = String(row['Marca'] || '').trim();
    const label = String(row['Atributo'] || '').trim();
    const key = ATTR_LABEL_TO_KEY[label];
    if (!brand) throw new Error('Votaciones fila ' + fila + ': falta la marca.');
    if (!key) throw new Error('Votaciones fila ' + fila + ': atributo desconocido "' + label + '".');

    const list = userCols.map((col) => {
      const raw = row[col];
      if (raw === '' || raw === null || raw === undefined) return null; // no votó
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 1 || v > 10) {
        throw new Error('Votaciones fila ' + fila + ' (' + brand + ' / ' + label + '): ' + col + ' debe ser 1-10 o vacío (recibido: ' + raw + ').');
      }
      return v;
    });
    if (list.every((v) => v === null)) throw new Error('Votaciones fila ' + fila + ' (' + brand + ' / ' + label + '): sin ningún voto.');
    votes.set(brand + '||' + key, list);
  });

  return votes;
}

function readProducts() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error('Falta el Excel: ' + XLSX_PATH + ' (ejecutá: node tools/make-excel.js)');
  }
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const ws = wb.Sheets['Alfajores'];
  if (!ws) throw new Error('La hoja "Alfajores" no existe en el Excel.');
  const wsVotes = wb.Sheets['Votaciones'];
  if (!wsVotes) throw new Error('La hoja "Votaciones" no existe en el Excel.');
  const votes = readVotes(wsVotes);

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return rows.map((row, i) => {
    const p = { id: '', brand: '', name: '', color: '#6b4423', scores: {}, votes: {}, raw: {} };
    p.brand = String(row['Marca'] || '').trim();
    p.name = String(row['Modelo'] || '').trim();
    const color = String(row['Color'] || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(color)) p.color = color;
    if (!p.brand) throw new Error('Fila ' + (i + 2) + ': falta la marca.');

    Object.keys(ATTR_LABEL_TO_KEY).forEach((label) => {
      const key = ATTR_LABEL_TO_KEY[label];
      const list = votes.get(p.brand + '||' + key);
      if (!list) throw new Error('Alfajores fila ' + (i + 2) + ' (' + p.brand + '): faltan votos para "' + label + '".');
      const filled = list.filter((v) => v !== null);
      const avg = filled.reduce((a, b) => a + b, 0) / filled.length;
      p.scores[key] = round2(avg);
      p.votes[key] = filled.length;
      p.raw[key] = list; // nulls preserved: the app overlays local votes by position
    });

    p.id = slug(p.brand + '-' + p.name);

    const logoPath = path.join(__dirname, 'logos', 'brand-' + slug(p.brand) + '.png');
    p.logo = fs.existsSync(logoPath)
      ? 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
      : null;

    return p;
  });
}

function inlineLib(file) {
  const src = fs.readFileSync(path.join(__dirname, 'vendor', file), 'utf8');
  // A </script> inside the lib would break the inline tag; refuse rather than corrupt.
  if (/<\/script/i.test(src)) throw new Error(file + ' contiene "</script>"; no se puede embeber directamente.');
  return src.trim();
}

function main() {
  const products = readProducts();
  let html = fs.readFileSync(path.join(__dirname, 'index.template.html'), 'utf8');

  const dataJson = JSON.stringify(products, null, 2);
  const replacements = {
    '__LIB_THREE__': inlineLib('three.min.js'),
    '__LIB_CHART__': inlineLib('chart.umd.min.js'),
    '__DATA__': dataJson,
  };

  Object.keys(replacements).forEach((token) => {
    const re = new RegExp(token, 'g');
    const count = (html.match(re) || []).length;
    if (count !== 1) throw new Error('El placeholder "' + token + '" aparece ' + count + ' veces (esperaba 1).');
    html = html.replace(re, () => replacements[token]);
  });

  const out = path.join(ROOT, 'index.html');
  fs.writeFileSync(out, html);
  console.log('index.html generado:', out);
  console.log('Alfajores embebidos:', products.length, '| tamaño:', (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
  products.forEach((p) => {
    const avg = Object.values(p.scores).reduce((a, b) => a + b, 0) / 6;
    console.log(' - ' + p.brand + ' ' + p.name + ': ' + avg.toFixed(2) + ' (' + p.votes.priceQuality + ' votos/atributo)');
  });
}

main();

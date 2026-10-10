// Generates datos/alfajores-ejemplo.xlsx:
//   - Hoja "Alfajores": metadata (marca, modelo, color)
//   - Hoja "Votaciones": 60 filas (10 alfajores x 6 atributos) x usuario1..15
// Votes are deterministic (seeded) and centered on the base scores so the
// demo shows realistic averages without hand-typing 900 cells.
const ExcelJS = require('exceljs');
const path = require('path');

const USERS = 15;

const PARAMS = [
  ['Relación calidad/precio', 'priceQuality'],
  ['Cantidad de dulce de leche', 'dulceDeLeche'],
  ['Sabor del chocolate', 'chocolate'],
  ['Calidad de las tapas', 'tapas'],
  ['Contundencia', 'contundencia'],
  ['Originalidad', 'originalidad'],
];

// [marca, modelo, color, scores base (solo para generar los votos)]
const ALFAJORES = [
  ['Havanna', 'Clásico de Chocolate', '#6b4423', [7, 9, 9, 9, 7, 6]],
  ['Cachafaz', 'Oreo', '#232526', [7, 7, 7, 8, 7, 9]],
  ['Lesta', 'Clásico', '#8e5b2f', [9, 8, 7, 7, 7, 5]],
  ['Jorgito', 'Grandes', '#2b6cb0', [9, 8, 6, 6, 9, 5]],
  ['Guaymallén', 'Dorado', '#d4a017', [10, 7, 5, 6, 6, 4]],
  ['Farito', 'Chocolinas', '#e67e22', [8, 7, 8, 6, 6, 7]],
  ['Cofler', 'Choco Relleno', '#7d3c98', [8, 7, 8, 7, 7, 6]],
  ['Águila', 'Con Crema', '#a93226', [8, 9, 6, 7, 8, 5]],
  ['Terrabusi', 'Massini', '#2980b9', [7, 8, 9, 8, 7, 7]],
  ['Aguafiestas', 'Tradicional', '#f39c12', [7, 6, 6, 6, 7, 10]],
];

// Deterministic PRNG so regenerating the Excel keeps the same votes.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function styleHeader(row, fill) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 28;
}

async function main() {
  const rnd = mulberry32(20261009);
  // Each voter keeps a personal bias across the whole survey (some are harsher/kinder).
  const userBias = Array.from({ length: USERS }, () => rnd() * 2.4 - 1.2);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Comparador de Alfajores';
  wb.created = new Date();

  const ws1 = wb.addWorksheet('Alfajores', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws1.columns = [
    { header: 'Marca', key: 'brand', width: 18 },
    { header: 'Modelo', key: 'name', width: 24 },
    { header: 'Color', key: 'color', width: 12 },
  ];
  styleHeader(ws1.getRow(1), 'FF6b4423');
  ALFAJORES.forEach(([brand, name, color]) => ws1.addRow([brand, name, color]));

  const ws2 = wb.addWorksheet('Votaciones', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] });
  ws2.columns = [
    { header: 'Marca', width: 16 },
    { header: 'Atributo', width: 28 },
    ...Array.from({ length: USERS }, (_, i) => ({ header: 'usuario' + (i + 1), width: 10 })),
  ];
  styleHeader(ws2.getRow(1), 'FF3a2f26');

  for (const [brand, , , base] of ALFAJORES) {
    PARAMS.forEach(([label], attrIdx) => {
      const row = [brand, label];
      for (let u = 0; u < USERS; u++) {
        const noise = rnd() * 2.8 - 1.4;
        let vote = Math.round(base[attrIdx] + userBias[u] + noise);
        vote = Math.max(1, Math.min(10, vote));
        row.push(vote);
      }
      ws2.addRow(row);
    });
  }

  const ws3 = wb.addWorksheet('Esquema');
  ws3.columns = [
    { header: 'Hoja', key: 's', width: 16 },
    { header: 'Columna', key: 'c', width: 30 },
    { header: 'Descripción', key: 'd', width: 62 },
  ];
  ws3.getRow(1).font = { bold: true };
  ws3.addRow(['Alfajores', 'Marca / Modelo / Color', 'Metadata del alfajor participante; una fila por alfajor']);
  ws3.addRow(['Alfajores', 'Color', 'Color hexadecimal del chocolate (se usa en el 3D y los gráficos)']);
  ws3.addRow(['Votaciones', 'Marca', 'Debe existir en la hoja Alfajores']);
  ws3.addRow(['Votaciones', 'Atributo', 'Uno de: ' + PARAMS.map((p) => p[0]).join(' | ')]);
  ws3.addRow(['Votaciones', 'usuario1..usuarioN', 'Voto entero del 1 al 10; vacío = no votó. Se promedian por atributo']);
  ws3.addRow(['Regla', 'Promedio', 'Atributo final = media de los votos no vacíos; puntaje total = media de los 6 atributos']);

  const out = path.join(__dirname, '..', 'datos', 'alfajores-ejemplo.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('Excel generado:', out);
  console.log('Filas de votación:', ALFAJORES.length * PARAMS.length, '| votos por atributo:', USERS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

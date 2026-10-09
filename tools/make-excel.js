// Generates datos/alfajores-ejemplo.xlsx with 10 well-known alfajores.
// Scores are 1-10 per parameter; totals are computed by the app (simple average).
const ExcelJS = require('exceljs');
const path = require('path');

const PARAMS = [
  ['Relación calidad/precio', 'priceQuality'],
  ['Cantidad de dulce de leche', 'dulceDeLeche'],
  ['Sabor del chocolate', 'chocolate'],
  ['Calidad de las tapas', 'tapas'],
  ['Contundencia', 'contundencia'],
  ['Originalidad', 'originalidad'],
];

const ROWS = [
  ['Havanna', 'Clásico de Chocolate', '#6b4423', 7, 9, 9, 9, 7, 6],
  ['Cachafaz', 'Oreo', '#232526', 7, 7, 7, 8, 7, 9],
  ['Lesta', 'Clásico', '#8e5b2f', 9, 8, 7, 7, 7, 5],
  ['Jorgito', 'Grandes', '#2b6cb0', 9, 8, 6, 6, 9, 5],
  ['Guaymallén', 'Dorado', '#d4a017', 10, 7, 5, 6, 6, 4],
  ['Farito', 'Chocolinas', '#e67e22', 8, 7, 8, 6, 6, 7],
  ['Cofler', 'Choco Relleno', '#7d3c98', 8, 7, 8, 7, 7, 6],
  ['Águila', 'Con Crema', '#a93226', 8, 9, 6, 7, 8, 5],
  ['Terrabusi', 'Massini', '#2980b9', 7, 8, 9, 8, 7, 7],
  ['Aguafiestas', 'Tradicional', '#f39c12', 7, 6, 6, 6, 7, 10],
];

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Comparador de Alfajores';
  wb.created = new Date();

  const ws = wb.addWorksheet('Alfajores', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = ['Marca', 'Modelo', 'Color', ...PARAMS.map((p) => p[0])];
  ws.columns = headers.map((h) => ({ header: h, key: h, width: h === 'Marca' || h === 'Modelo' ? 18 : 14 }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6b4423' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  headerRow.height = 30;

  ROWS.forEach((r) => ws.addRow(r));

  ws.getColumn(3).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
    if (rowNumber > 1 && /^#[0-9a-fA-F]{6}$/.test(String(cell.value))) {
      cell.font = { color: { argb: 'FF' + String(cell.value).slice(1) } };
    }
  });

  // Second sheet documents the schema for the converter/app.
  const ws2 = wb.addWorksheet('Esquema');
  ws2.columns = [{ header: 'Columna', key: 'c', width: 30 }, { header: 'Campo en la app', key: 'f', width: 22 }, { header: 'Descripción', key: 'd', width: 45 }];
  ws2.getRow(1).font = { bold: true };
  ws2.addRow(['Marca', 'brand', 'Nombre de la marca']);
  ws2.addRow(['Modelo', 'name', 'Nombre del alfajor']);
  ws2.addRow(['Color', 'color', 'Color hexadecimal del chocolate (para el 3D)']);
  PARAMS.forEach(([label, key]) => ws2.addRow([label, `scores.${key}`, 'Puntaje entero del 1 al 10']));

  const out = path.join(__dirname, '..', 'datos', 'alfajores-ejemplo.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('Excel generado:', out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

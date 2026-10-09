// Headless smoke test: loads ../index.html and checks console + core interactions.
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

async function main() {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2500));

  const checks = await page.evaluate(() => {
    const res = {};
    res.title = document.title;
    res.kpiScore = document.getElementById('kpi-score').textContent;
    res.kpiBrand = document.getElementById('kpi-brand').textContent;
    res.paramRows = document.querySelectorAll('#kpi-params li').length;
    res.chips = document.querySelectorAll('#brand-toggles .chip').length;
    res.selectOptions = document.getElementById('featured-select').options.length;
    res.rankingBars = (window.Chart && Chart.getChart('chart-ranking')) ? Chart.getChart('chart-ranking').data.labels.length : 0;
    res.radarDatasets = (window.Chart && Chart.getChart('chart-radar')) ? Chart.getChart('chart-radar').data.datasets.length : 0;
    res.barsDatasets = (window.Chart && Chart.getChart('chart-bars')) ? Chart.getChart('chart-bars').data.datasets.length : 0;
    const c = document.getElementById('alfajor-canvas');
    res.canvasVisible = !c.hidden && c.width > 0;
    const logo = document.getElementById('kpi-logo');
    res.kpiLogoVisible = !logo.hidden;
    res.kpiLogoSrc = logo.src || '';
    return res;
  });

  // Rotation check: two captures of the 3D stage must differ
  const stage = await page.$('#stage');
  const frame1 = await stage.screenshot();
  await new Promise((r) => setTimeout(r, 700));
  const frame2 = await stage.screenshot();
  checks.rotationVisible = !frame1.equals(frame2);

  // Interaction: pick another featured alfajor
  await page.select('#featured-select', await page.evaluate(() => document.getElementById('featured-select').options[8].value));
  await new Promise((r) => setTimeout(r, 300));
  const afterSelect = await page.evaluate(() => document.getElementById('kpi-score').textContent + ' | ' + document.getElementById('kpi-brand').textContent);
  const logoSrc2 = await page.evaluate(() => document.getElementById('kpi-logo').src || '');
  const logoChanged = logoSrc2 !== checks.kpiLogoSrc;
  checks.kpiLogoSrc = checks.kpiLogoSrc.slice(0, 60) + '...';
  logoSrc2.length && (checks.kpiLogoSrc2 = logoSrc2.slice(0, 60) + '...');

  // Interaction: deselect all -> empty state
  await page.click('#btn-none');
  await new Promise((r) => setTimeout(r, 300));
  const emptyShown = await page.evaluate(() => !document.getElementById('empty-note').hidden);

  // Interaction: select all -> charts back
  await page.click('#btn-all');
  await new Promise((r) => setTimeout(r, 600));
  const chartsBack = await page.evaluate(() => !!(window.Chart && Chart.getChart('chart-ranking')));

  await page.screenshot({ path: path.join(__dirname, 'smoke-screenshot.png') });
  await browser.close();

  console.log(JSON.stringify({ checks, afterSelect, logoChanged, emptyShown, chartsBack, errors }, null, 2));
  if (errors.length) process.exit(1);
  if (!checks.rotationVisible || !checks.kpiLogoVisible || !logoChanged) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });

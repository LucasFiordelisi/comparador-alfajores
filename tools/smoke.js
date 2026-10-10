// Headless smoke test: loads ../index.html and checks console + core interactions.
const path = require('path');
const fs = require('fs');

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

  // Voting flow: usuario1 rates Havanna priceQuality=10 -> KPI must update live
  checks.voteFormUsers = await page.evaluate(() => document.getElementById('vote-user').options.length);
  checks.voteFormAlfajores = await page.evaluate(() => document.getElementById('vote-alfajor').options.length);
  const beforeParam = await page.$eval('#kpi-params .pval', (el) => el.textContent);
  await page.select('#vote-user', 'usuario1');
  await page.evaluate(() => {
    const inp = document.getElementById('vote-priceQuality');
    inp.value = '10';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#vote-form button[type="submit"]');
  await new Promise((r) => setTimeout(r, 400));
  const afterParam = await page.$eval('#kpi-params .pval', (el) => el.textContent);
  checks.voteChangedKpi = beforeParam !== afterParam;
  checks.voteSaved = await page.evaluate(() => {
    try { const v = JSON.parse(localStorage.getItem('alfajor-stats-votes')); return !!(v && v.usuario1); } catch (e) { return false; }
  });
  checks.voteProgress = await page.evaluate(() => document.getElementById('vote-progress').textContent);
  checks.voteAutoAdvanced = await page.evaluate(() => document.getElementById('vote-alfajor').value !== 'havanna-clasico-de-chocolate');

  // Display name: type it, check dropdown label + localStorage
  await page.type('#vote-name', 'Maria Test');
  await page.evaluate(() => document.getElementById('vote-name').dispatchEvent(new Event('change')));
  await new Promise((r) => setTimeout(r, 200));
  checks.nameInDropdown = await page.evaluate(() => {
    const sel = document.getElementById('vote-user');
    return sel.options[sel.selectedIndex].textContent.indexOf('Maria Test') !== -1;
  });
  checks.nameSaved = await page.evaluate(() => {
    try { const n = JSON.parse(localStorage.getItem('alfajor-stats-names')); return !!(n && n.usuario1 === 'Maria Test'); } catch (e) { return false; }
  });

  // CSV export: real download via CDP, then validate shape and merged vote
  const dlPath = path.join(__dirname, 'dl-test');
  fs.rmSync(dlPath, { recursive: true, force: true });
  fs.mkdirSync(dlPath, { recursive: true });
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dlPath });
  await page.click('#vote-export');
  await new Promise((r) => setTimeout(r, 1500));
  const csvFile = path.join(dlPath, 'votaciones-actualizadas.csv');
  checks.csvExported = fs.existsSync(csvFile);
  if (checks.csvExported) {
    const csv = fs.readFileSync(csvFile, 'utf8');
    const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
    checks.csvLines = lines.length;
    checks.csvHeaderOk = lines[0].replace(/^﻿/, '').startsWith('Marca,Atributo,usuario1');
    const first = lines.find((l) => l.startsWith('Havanna,Relación calidad/precio'));
    checks.csvHasHavanna = !!first;
    checks.csvVoteApplied = !!first && first.split(',')[2] === '10'; // usuario1's vote we just saved
  }
  const namesFile = path.join(dlPath, 'nombres-usuarios.csv');
  checks.namesCsvExported = fs.existsSync(namesFile);
  if (checks.namesCsvExported) {
    const names = fs.readFileSync(namesFile, 'utf8');
    checks.namesCsvHasUser = names.indexOf('usuario1,Maria Test') !== -1;
  }
  fs.rmSync(dlPath, { recursive: true, force: true });

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
  if (checks.voteFormUsers !== 15 || checks.voteFormAlfajores !== 10) process.exit(1);
  if (!checks.voteChangedKpi || !checks.voteSaved || !checks.voteAutoAdvanced) process.exit(1);
  if (!checks.csvExported || checks.csvLines !== 61 || !checks.csvHeaderOk || !checks.csvVoteApplied) process.exit(1);
  if (!checks.nameInDropdown || !checks.nameSaved) process.exit(1);
  if (!checks.namesCsvExported || !checks.namesCsvHasUser) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });

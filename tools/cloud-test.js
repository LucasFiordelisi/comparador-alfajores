// E2E test of the cloud voting flow against tools/mock-votes-server.js.
// Builds index.html with the mock endpoint, votes, revotes (upsert), reloads,
// and finally rebuilds in local-only mode + runs the regular smoke test.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { startServer } = require('./mock-votes-server');

const ROOT = path.join(__dirname, '..');
const CLOUD_CONFIG = path.join(__dirname, 'cloud-config.json');

function build(endpoint) {
  if (endpoint) fs.writeFileSync(CLOUD_CONFIG, JSON.stringify({ endpoint, token: 'alfajor-stats-2026' }));
  else if (fs.existsSync(CLOUD_CONFIG)) fs.unlinkSync(CLOUD_CONFIG);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('build failed');
}

async function setSliders(page, values) {
  await page.evaluate((vals) => {
    Object.keys(vals).forEach((key) => {
      const input = document.getElementById('vote-' + key);
      input.value = String(vals[key]);
      input.nextElementSibling.textContent = String(vals[key]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, values);
}

async function vote(page, uid, pid, values) {
  await page.select('#vote-user', uid);
  await page.select('#vote-alfajor', pid);
  await setSliders(page, values);
  await page.click('#vote-form button[type="submit"]');
  await page.waitForFunction(() => /sincronizado/.test(document.getElementById('vote-status').textContent), { timeout: 5000 });
}

async function kpi(page, pid) {
  await page.select('#featured-select', pid);
  await new Promise((r) => setTimeout(r, 300));
  return page.evaluate(() => ({
    score: document.getElementById('kpi-score').textContent,
    firstCount: document.querySelector('#kpi-params .pcount').textContent,
    firstVal: document.querySelector('#kpi-params .pval').textContent,
  }));
}

async function main() {
  const { default: puppeteer } = await import('puppeteer-core');
  const server = await startServer(8791);
  build(server.url);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => /conectado/.test(document.getElementById('cloud-status').textContent), { timeout: 5000 });

  const all = (v) => ({ priceQuality: v, dulceDeLeche: v, chocolate: v, tapas: v, contundencia: v, originalidad: v });
  const gid = await page.evaluate(() => {
    const p = PRODUCTS.find((x) => x.brand === 'Guaymallén');
    return p && p.id;
  });
  if (!gid) throw new Error('Guaymallen product not found');

  await vote(page, 'usuario5', gid, all(8));
  const afterFirst = await kpi(page, gid);
  await vote(page, 'usuario6', gid, all(2));
  const afterSecond = await kpi(page, gid);
  await vote(page, 'usuario5', gid, all(10)); // upsert: replaces usuario5's 8s
  const afterRevote = await kpi(page, gid);

  // Reload: totals must come from the server (mock keeps them in memory).
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => /conectado/.test(document.getElementById('cloud-status').textContent), { timeout: 5000 });
  const afterReload = await kpi(page, gid);

  const ok =
    afterFirst.score === '8.0' && afterFirst.firstCount === '1 voto' &&
    afterSecond.score === '5.0' && afterSecond.firstCount === '2 votos' &&
    afterRevote.score === '6.0' && afterRevote.firstCount === '2 votos' &&
    afterReload.score === '6.0' && afterReload.firstCount === '2 votos';

  const report = { afterFirst, afterSecond, afterRevote, afterReload, ok, errors };
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
  await server.close();

  // Leave the repo in local-only mode and re-verify the classic smoke test.
  build(null);
  const smoke = spawnSync(process.execPath, [path.join(__dirname, 'smoke.js')], { stdio: 'inherit' });
  if (!ok || errors.length || smoke.status !== 0) process.exit(1);
  console.log('cloud-test OK');
}

main().catch((err) => { console.error(err); process.exit(1); });

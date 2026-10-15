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

function buildLocal() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'build.js'), '--local'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('local build failed');
}

function rebuild() {
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
  // Preserve any pre-existing (real) cloud config: tests must never hit production.
  const savedConfig = fs.existsSync(CLOUD_CONFIG) ? fs.readFileSync(CLOUD_CONFIG, 'utf8') : null;
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
  const gid = await page.evaluate(() => PRODUCTS[0].id);
  if (!gid) throw new Error('No products found');

  // usuario5 registers a name so the cloud user directory can be tested.
  await page.select('#vote-user', 'usuario5');
  await page.type('#vote-name', 'Maria Cloud');
  await page.evaluate(() => document.getElementById('vote-name').dispatchEvent(new Event('change', { bubbles: true })));

  await vote(page, 'usuario5', gid, all(8));
  const afterFirst = await kpi(page, gid);
  const serverUser5 = await page.evaluate(() => (state.serverUsers && state.serverUsers.usuario5) || '');
  await vote(page, 'usuario6', gid, all(2));
  const afterSecond = await kpi(page, gid);
  // Own slot (voted from this browser) must not warn.
  const slotWarnOwn = await page.evaluate(() => document.getElementById('slot-warn').hidden);
  await vote(page, 'usuario5', gid, all(10)); // upsert: replaces usuario5's 8s
  const afterRevote = await kpi(page, gid);

  // Reload: totals must come from the server (mock keeps them in memory).
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => /conectado/.test(document.getElementById('cloud-status').textContent), { timeout: 5000 });
  const afterReload = await kpi(page, gid);

  // Fresh profile (no localStorage): the cloud directory must show Maria Cloud.
  const os = require('os');
  const freshProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'alfajor-fresh-'));
  const freshBrowser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox'],
    userDataDir: freshProfile,
  });
  const fresh = await freshBrowser.newPage();
  await fresh.setViewport({ width: 1280, height: 900 });
  await fresh.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await fresh.waitForFunction(() => /conectado/.test(document.getElementById('cloud-status').textContent), { timeout: 5000 });
  const dirOption = await fresh.evaluate(() => {
    const opt = Array.from(document.getElementById('vote-user').options).find((o) => o.value === 'usuario5');
    return opt ? opt.textContent : '';
  });
  await fresh.select('#vote-user', 'usuario5');
  const dirNameInput = await fresh.evaluate(() => document.getElementById('vote-name').value);
  // Slot taken by someone else must warn with their name.
  const slotWarnFresh = await fresh.evaluate(() => ({
    hidden: document.getElementById('slot-warn').hidden,
    text: document.getElementById('slot-warn').textContent,
  }));
  const participantCount = await fresh.evaluate(() => document.getElementById('participant-count').textContent);
  // Refresh button re-fetches without reload.
  await fresh.click('#vote-refresh');
  await fresh.waitForFunction(() => /conectado/.test(document.getElementById('cloud-status').textContent), { timeout: 5000 });
  await freshBrowser.close();

  // Clear local data on the main page (which holds votes + names): the cloud must be untouched.
  page.on('dialog', async (d) => { await d.accept(); });
  await page.click('#vote-clear');
  await page.waitForFunction(() => /borrados/.test(document.getElementById('vote-status').textContent), { timeout: 5000 });
  const afterClear = await page.evaluate(() => ({
    progress: document.getElementById('vote-progress').textContent,
    votesGone: !localStorage.getItem('alfajor-stats-votes'),
    namesGone: !localStorage.getItem('alfajor-stats-names'),
  }));
  const afterClearKpi = await kpi(page, gid);

  const ok =
    afterFirst.score === '8.0' && afterFirst.firstCount === '1 voto' &&
    serverUser5 === 'Maria Cloud' &&
    afterSecond.score === '5.0' && afterSecond.firstCount === '2 votos' &&
    slotWarnOwn === true &&
    afterRevote.score === '6.0' && afterRevote.firstCount === '2 votos' &&
    afterReload.score === '6.0' && afterReload.firstCount === '2 votos' &&
    dirOption === 'Maria Cloud (usuario5)' && dirNameInput === 'Maria Cloud' &&
    slotWarnFresh.hidden === false && slotWarnFresh.text.includes('Maria Cloud') &&
    participantCount === '2 personas votando' &&
    /^0 de \d+ alfajores votados$/.test(afterClear.progress) &&
    afterClear.votesGone === true && afterClear.namesGone === true &&
    afterClearKpi.score === '6.0' && afterClearKpi.firstCount === '2 votos';

  const report = { afterFirst, serverUser5, afterSecond, slotWarnOwn, afterRevote, afterReload, dirOption, dirNameInput, slotWarnFresh, participantCount, afterClear, afterClearKpi, ok, errors };
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
  await server.close();

  // Leave the repo as it was: restore the saved config (or none) and rebuild,
  // then run the classic smoke test in local-only mode (never production).
  if (savedConfig != null) fs.writeFileSync(CLOUD_CONFIG, savedConfig);
  else if (fs.existsSync(CLOUD_CONFIG)) fs.unlinkSync(CLOUD_CONFIG);
  buildLocal();
  const smoke = spawnSync(process.execPath, [path.join(__dirname, 'smoke.js')], { stdio: 'inherit' });
  if (savedConfig != null) {
    fs.writeFileSync(CLOUD_CONFIG, savedConfig);
    rebuild();
  }
  if (!ok || errors.length || smoke.status !== 0) process.exit(1);
  console.log('cloud-test OK');
}

main().catch((err) => { console.error(err); process.exit(1); });

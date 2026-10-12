const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const { default: puppeteer } = await import('puppeteer-core');
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

  await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => /conectado|sin conexi/.test(document.getElementById('cloud-status').textContent), { timeout: 15000 });

  const result = await page.evaluate(() => ({
    cloudStatus: document.getElementById('cloud-status').textContent,
    kpiScore: document.getElementById('kpi-score').textContent,
    firstCount: document.querySelector('#kpi-params .pcount').textContent,
    firstVal: document.querySelector('#kpi-params .pval').textContent,
    endpoint: typeof CONFIG !== 'undefined' ? CONFIG.votesEndpoint : '(missing)',
  }));

  console.log(JSON.stringify({ ...result, errors }, null, 2));
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });

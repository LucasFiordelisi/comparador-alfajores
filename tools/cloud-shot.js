const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { startServer } = require('./mock-votes-server');

async function main() {
  const { default: puppeteer } = await import('puppeteer-core');
  const server = await startServer(8792);
  fs.writeFileSync(path.join(__dirname, 'cloud-config.json'), JSON.stringify({ endpoint: server.url, token: 'alfajor-stats-2026' }));
  spawnSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => /conectado/.test(document.getElementById('cloud-status').textContent), { timeout: 5000 });

  // Vote so the "sincronizado" status is visible too.
  await page.select('#vote-user', 'usuario4');
  await page.select('#vote-alfajor', await page.evaluate(() => PRODUCTS[0].id));
  await page.evaluate(() => {
    ['priceQuality', 'dulceDeLeche', 'chocolate', 'tapas', 'contundencia', 'originalidad'].forEach((k) => {
      const i = document.getElementById('vote-' + k);
      i.value = '9';
      i.nextElementSibling.textContent = '9';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  await page.click('#vote-form button[type="submit"]');
  await page.waitForFunction(() => /sincronizado/.test(document.getElementById('vote-status').textContent), { timeout: 5000 });

  const panel = await page.$('.vote');
  await panel.screenshot({ path: 'smoke-cloud-panel.png' });
  await browser.close();
  await server.close();

  fs.unlinkSync(path.join(__dirname, 'cloud-config.json'));
  spawnSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
  console.log('ok');
}

main().catch((err) => { console.error(err); process.exit(1); });

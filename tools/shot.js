// Captures stage screenshots for the featured product (and an optional second one).
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
  await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 3000));
  const stage = await page.$('#stage');
  await stage.screenshot({ path: 'smoke-v3-havanna.png' });
  await page.select('#featured-select', await page.evaluate(() => document.getElementById('featured-select').options[4].value));
  await new Promise((r) => setTimeout(r, 1200));
  await stage.screenshot({ path: 'smoke-v3-guaymallen.png' });
  await browser.close();
  console.log('ok');
}

main().catch((err) => { console.error(err); process.exit(1); });

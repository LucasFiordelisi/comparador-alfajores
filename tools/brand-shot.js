// Captures the feature area with a chosen featured alfajor for visual review.
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const idx = Number(process.argv[2] || 0);
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2500));
  const opts = await page.evaluate(() => Array.from(document.getElementById('featured-select').options).map((o) => o.value));
  await page.select('#featured-select', opts[idx]);
  await new Promise((r) => setTimeout(r, 1200));
  const feature = await page.$('.feature');
  await feature.screenshot({ path: 'smoke-brand-' + idx + '.png' });
  await browser.close();
  console.log('ok');
}

main().catch((err) => { console.error(err); process.exit(1); });

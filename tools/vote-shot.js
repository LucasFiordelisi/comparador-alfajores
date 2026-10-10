// Captures the voting panel for visual verification.
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
  await new Promise((r) => setTimeout(r, 2500));
  await page.select('#vote-user', 'usuario3');
  const vote = await page.$('.vote');
  await vote.screenshot({ path: 'smoke-vote-panel.png' });
  await browser.close();
  console.log('ok');
}

main().catch((err) => { console.error(err); process.exit(1); });

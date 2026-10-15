// Verifies votes survive across browser sessions (same user data dir).
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const PROFILE = path.join(__dirname, 'profile-test');

async function open() {
  const { default: puppeteer } = await import('puppeteer-core');
  return puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: PROFILE, args: ['--no-sandbox'] });
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });

  // Session 1: vote priceQuality = 10 as usuario1 on the first alfajor
  let browser = await open();
  let page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2000));
  const before = await page.$eval('#kpi-params .pval', (el) => el.textContent);
  await page.select('#vote-user', 'usuario1');
  await page.evaluate(() => {
    const inp = document.getElementById('vote-priceQuality');
    inp.value = '10';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#vote-form button[type="submit"]');
  await new Promise((r) => setTimeout(r, 500));
  const session1Saved = await page.evaluate(() => {
    try { return !!JSON.parse(localStorage.getItem('alfajor-stats-votes')); } catch (e) { return false; }
  });
  await browser.close();

  // Session 2: same profile, no vote -> must show the stored vote
  browser = await open();
  page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2000));
  const after = await page.$eval('#kpi-params .pval', (el) => el.textContent);
  const progress = await page.evaluate(() => document.getElementById('vote-progress').textContent);
  const firstId = await page.evaluate(() => PRODUCTS[0].id);
  const persisted = await page.evaluate((fid) => {
    try {
      const v = JSON.parse(localStorage.getItem('alfajor-stats-votes'));
      return !!(v && v.usuario1 && v.usuario1[fid] && v.usuario1[fid].priceQuality === 10);
    } catch (e) { return false; }
  }, firstId);
  await browser.close();
  fs.rmSync(PROFILE, { recursive: true, force: true });

  console.log(JSON.stringify({ before, after, session1Saved, persisted, progress, kpiChanged: before !== after }, null, 2));
  process.exit(persisted && before !== after ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });

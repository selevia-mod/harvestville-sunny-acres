// Quick visual check: loads the built page in a phone-sized headless Chromium and screenshots it.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || 'shot.png';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [], requests = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await page.waitForFunction(() => window.Farm && window.Farm.world && window.Farm.ui, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out });
  console.log('errors:', errors);
  console.log('network:', requests);
  await browser.close();
})();

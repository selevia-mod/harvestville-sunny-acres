// Saves when the page is put away (owner, 23 Nov 2026: "it should save the game when the users close the app or the
// game"): the app tells the game to sleep and it saves (window.__gameSleep), but a phone can stop the page before that
// message comes (the app swiped away, iOS freezing the web view). The page hiding (visibilitychange, pagehide) saves too,
// so what was played in the last 15 seconds is on the phone.
// Run alone, after node build.js: node --test --test-concurrency=1 test/e2e-save-on-hide.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.join(process.env.DIST || path.resolve(__dirname, '..', 'dist'), 'index.html');
const SLOW = { timeout: 90000 };

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open() {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    return url.startsWith('file:') || url.startsWith('data:') ? route.continue() : route.abort();
  });
  await page.addInitScript(() => { window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } }; });
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  return { page, problems, context };
}
// something played just now (not yet in the 15-second save): a gold coin more
const play = (page) => page.evaluate(() => { const s = Farm.session.state; s.gold += 7; Farm.world.changed(); Farm.world.saveMs = 0; window.gameHost.saves = []; return s.gold; });
// (a save is written short: read back the way the game reads it)
const lastGold = (page) => page.evaluate(() => { const l = window.gameHost.saves; return l.length ? Farm.Logic.deserialize(JSON.parse(l[l.length - 1])).gold : null; });

test('the page hidden (the app put away, swiped off, the phone locked) saves the farm, before any message from the app', async () => {
  const { page, problems, context } = await open();
  const gold = await play(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const saved = await lastGold(page);
  assert.ok(saved != null, 'a save the moment the page is hidden');
  assert.strictEqual(saved, gold, 'with what was just played');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the page going away (pagehide: the game closed) saves too; the app\'s sleep after it saves as before', async () => {
  const { page, problems, context } = await open();
  const gold = await play(page);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  assert.strictEqual(await lastGold(page), gold, 'pagehide saves what was just played');
  // the app's sleep (the usual way) still saves, once
  await page.evaluate(() => { window.gameHost.saves = []; Farm.session.state.gold += 1; window.__gameSleep(true); });
  assert.strictEqual(await lastGold(page), gold + 1, 'the sleep saves');
  // already asleep (the app's message came first): hiding then makes no second save of the same farm
  await page.evaluate(() => { window.gameHost.saves = []; window.dispatchEvent(new Event('pagehide')); });
  assert.strictEqual(await page.evaluate(() => window.gameHost.saves.length), 0, 'asleep: saved already');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

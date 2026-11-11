// Long lists on phones: the rows in view at once, the rest a few a frame (owner, 11 Nov 2026: "online menu, it feels like a bit
// heavy"). The browser tests build every row at once (they read a list the moment it opens); here the phones' way is forced on
// with Farm.listStagger and the whole list must still arrive, and c.slimAll() must finish it at once.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open() {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await page.route('**/*', (route) => { const u = route.request().url(); return u.startsWith('file:') || u.startsWith('data:') ? route.continue() : route.abort(); });
  await page.addInitScript(() => {
    window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => new Date(2026, 3, 1, 10, 0).getTime() };
  });
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// The open panel's words, and how many rows (or tiles) it has built so far.
const texts = (page) => page.evaluate(() => {
  const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
  return out.join(' | ');
});
const rowsOf = (t) => (t.match(/Not met yet/g) || []).length; // (a new farm has met no one: every row says so)

test('a long list on a phone: the first rows at once, every row a few frames later, and slimAll finishes it at once', async () => {
  const { page, problems, context } = await open();
  // the browser tests' way: every row at once
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.vsBook(3); });
  const whole = await texts(page);
  assert.strictEqual(rowsOf(whole), 23, 'all 23 rows at once in the tests');
  // the phones' way: Hana's row (well down the page) is not there yet, then it is
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.listStagger = true; Farm.ui.vsBook(3); });
  const first = await texts(page);
  assert.ok(rowsOf(first) > 0 && rowsOf(first) < 23, 'only the first rows at once on a phone (' + rowsOf(first) + ')');
  await page.waitForFunction(() => { const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return (out.join(' | ').match(/Not met yet/g) || []).length >= 23; }, null, { timeout: 5000 });
  assert.strictEqual(await texts(page), whole, 'the same rows in the end');
  // slimAll: the rest at once
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.vsBook(3); Farm.ui.modals[Farm.ui.modals.length - 1].c.slimAll(); });
  assert.strictEqual(await texts(page), whole, 'slimAll builds the rest at once');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test("a shop's tiles on a phone: the ones in view at once, all of them a few frames later", async () => {
  const { page, problems, context } = await open();
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openShop(); });
  const whole = await texts(page);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.listStagger = true; Farm.ui.openShop(); });
  const first = await texts(page);
  assert.ok(first.length < whole.length, 'fewer tiles at once on a phone');
  await page.waitForFunction((n) => { const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return out.join(' | ').length >= n; }, whole.length, { timeout: 5000 });
  assert.strictEqual((await texts(page)).split(' | ').sort().join('|'), whole.split(' | ').sort().join('|'), 'the same tiles in the end');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Error reports (owner, 22 Nov 2026: "Yes proceed to 1 and 2"): src/02-report-errors.js and supabase/farm_errors.sql.
// With the app's connection: an error is sent once (farm_error_v1) with what broke, the map, the panel on top, the build
// and the version, the page's address out of its stack; at most 5 a session; a promise nobody caught too.
// Without it (a plain browser, every other test): nothing is sent and no request is made.
// Run alone, after node build.js: node --test --test-concurrency=1 test/e2e-error-reports.test.js
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
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [], requests = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
    requests.push(url);
    return route.abort();
  });
  await page.addInitScript(() => { window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } }; });
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { const s = Farm.session.state; s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; s.wv = Farm.Config.NEWS_LATEST; Farm.ui.closeAll(); });
  return { page, problems, requests, context };
}
// the app's connection, after the game opened offline: every rpc kept
const connect = (page) => page.evaluate(() => { window.__calls = []; window.gameHost.net = { session: () => 'u1', rpc: (name, args) => { window.__calls.push([name, args]); return Promise.resolve(null); }, join: () => null }; Farm.Net.mode = 'host'; });
const boom = (page, msg) => page.evaluate((msg) => new Promise((r) => { setTimeout(() => { throw new Error(msg); }, 0); setTimeout(r, 120); }), msg);
const reports = (page) => page.evaluate(() => window.__calls.filter((c) => c[0] === 'farm_error_v1').map((c) => c[1]));

test('an error is sent once, with what broke, where and which build; 5 at most; a promise nobody caught too', async () => {
  const { page, problems, requests, context } = await open();
  await connect(page);
  await page.evaluate(() => Farm.ui.openForge());
  // a real one, from inside the game's code (a panel opened without what it needs)
  await page.evaluate(() => new Promise((r) => { setTimeout(() => Farm.ui.openBuilding(), 0); setTimeout(r, 120); }));
  let r = await reports(page);
  assert.strictEqual(r.length, 1, JSON.stringify(r));
  const one = r[0], build = await page.evaluate(() => Farm.BUILD), v = await page.evaluate(() => Farm.Config.NEWS_LATEST);
  assert.ok(/Cannot read properties of undefined/.test(one.p_msg), one.p_msg);
  assert.strictEqual(one.p_map, 'farm');
  assert.strictEqual(one.p_screen, "Bram's Forge");
  assert.ok(/^[0-9a-f]{8}$/.test(build), 'the build is stamped: ' + build);
  assert.strictEqual(one.p_build, build);
  assert.strictEqual(one.p_version, v);
  assert.ok(['ios', 'android', 'other'].includes(one.p_platform));
  assert.ok(/page:\d+:\d+/.test(one.p_stack) && !/file:/.test(one.p_stack), 'the address is out of the stack: ' + one.p_stack);
  await page.evaluate(() => new Promise((r) => { setTimeout(() => Farm.ui.openBuilding(), 0); setTimeout(r, 120); }));
  assert.strictEqual((await reports(page)).length, 1, 'the same one again: not sent twice');
  await page.evaluate(() => { Farm.ui.closeAll(); Promise.reject(new Error('robot promise')); });
  await page.waitForTimeout(150);
  r = await reports(page);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[1].p_msg, 'robot promise');
  assert.strictEqual(r[1].p_screen, '', 'no panel on top');
  for (let i = 2; i <= 8; i++) await boom(page, 'robot boom ' + i);
  assert.strictEqual((await reports(page)).length, 5, '5 a session at most');
  await page.evaluate(() => { Promise.reject(new Error('offline')); });
  await page.waitForTimeout(150);
  assert.strictEqual((await reports(page)).length, 5, 'no connection is not a bug: not sent');
  assert.strictEqual(problems.filter((p) => !/robot (boom|promise)|offline|Cannot read properties of undefined/.test(p)).length, 0, problems.join('\n'));
  assert.deepStrictEqual(requests, [], 'the page itself makes no request: the app sends it');
  await context.close();
});

test('without the app\'s connection: nothing is sent, nothing asked of the network, and the game plays on', async () => {
  const { page, problems, requests, context } = await open();
  await boom(page, 'robot alone');
  await page.waitForTimeout(200);
  assert.deepStrictEqual(requests, []);
  assert.deepStrictEqual(problems, ['pageerror: robot alone']);
  // the game still answers
  await page.evaluate(() => Farm.ui.openPause());
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  await context.close();
});

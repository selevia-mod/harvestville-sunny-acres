// The Market Stall's Orders tab in a phone-sized headless Chromium: what villagers ask for (only what this farm can get
// now) and how a row looks. Run after `node build.js`: node --test test/e2e-orders.test.js
// Screenshots go to SHOTS (default: shots/ next to this folder).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS || path.resolve(__dirname, '..', 'shots');
const NOW = new Date(2026, 3, 1, 10, 0).getTime(); // a spring Wednesday, 10 AM: the market is open

const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file) || null, l = /^looks\/v1\/([a-z]+-(?:boy|girl)(?:-archer)?)$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : l ? path.join(__dirname, '..', 'assets', 'looks', l[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); fs.mkdirSync(SHOTS, { recursive: true }); });
test.after(async () => { await browser.close(); });

async function open(savedState) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
    problems.push('network: ' + url);
    return route.abort();
  });
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([state, now, here]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state: state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, NOW, allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}

// A save from a fresh state changed by `edit` (run in the page, with s, L and C).
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    // eslint-disable-next-line no-eval
    eval(edit);
    return L.serialize(s);
  }, edit);
  await context.close();
  return save;
}

const frames = (page, n = 4) => page.evaluate((n) => new Promise((r) => {
  const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

async function ordersShot(save, name) {
  const { page, problems, context } = await open(save);
  await page.evaluate(() => Farm.ui.openStand('orders'));
  await frames(page, 6);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  const orders = await page.evaluate(() => Farm.session.state.orders.map((o) => o.items ? o.items.map((it) => it[0] + ':' + it[1]) : null));
  await context.close();
  return { orders, problems };
}

// A farm well into the game (the orders ask for 2-3 things), three orders already on the board.
const SETUP = `
  s.stats.earned = 30000;
  s.gold = 5000;
  L.addItem(s, 'rod', 1);
  L.addItem(s, 'milker', 1);
  s.animals.push({ kind: 'cow', name: 'Bella', love: 10, fed: 0, pet: 0, ready: 0, brushed: 0, young: 0, preg: 0 });
`;

test('Orders tab: a farm with no carabao never sees Carabao Milk, and an old order for it is replaced on open', async () => {
  const save = await makeSave(SETUP + `
    // an old save's orders: all three ask for carabao milk, which this farm can't get
    s.orders = [
      { from: 'lily', gold: 2420, items: [['carabao_milk', 7], ['fish_s', 4]] },
      { from: 'rosa', gold: 1900, items: [['carabao_milk', 8], ['egg', 4]] },
      { from: 'mira', gold: 1500, items: [['carabao_milk', 6], ['turnip', 5]] },
    ];
    L.addItem(s, 'egg', 6); // enough eggs for any egg order: shows the green count and the green Deliver
    L.addItem(s, 'turnip', 10);
  `);
  const { orders, problems } = await ordersShot(save, 'orders-no-carabao');
  assert.deepStrictEqual(problems, []);
  assert.ok(orders.every((o) => o), 'three orders');
  orders.forEach((o) => o.forEach((it) => assert.ok(!/^carabao_milk:/.test(it), 'no carabao milk: ' + it)));
  const ids = orders.map((o) => o.map((it) => it.split(':')[0]));
  const flat = [].concat(...ids);
  assert.strictEqual(new Set(flat).size, flat.length, 'no item on two orders at once: ' + JSON.stringify(ids));
});

test('Orders tab: a farm with a carabao (and a milker) can be asked for Carabao Milk, a day\'s worth at most', async () => {
  const save = await makeSave(SETUP + `
    s.animals.push({ kind: 'carabao', name: 'Kidlat', love: 10, fed: 0, pet: 0, ready: 0, brushed: 0, young: 0, preg: 0 });
    s.orders = [
      { from: 'hollis', gold: 520, items: [['carabao_milk', 2], ['turnip', 3]] },
      { wait: 60 },
      { wait: 90 },
    ];
    L.standTick(s, 200);
    L.addItem(s, 'carabao_milk', 2);
    L.addItem(s, 'turnip', 3); // all of Hollis's order: a green Deliver
  `);
  const { orders, problems } = await ordersShot(save, 'orders-with-carabao');
  assert.deepStrictEqual(problems, []);
  assert.ok(orders[0].includes('carabao_milk:2'), 'a fair carabao milk order stays: ' + JSON.stringify(orders));
  orders.forEach((o) => o.forEach((it) => { const m = /^carabao_milk:(\d+)$/.exec(it); if (m) assert.ok(+m[1] <= 2, it); }));
});

test('Shelves tab: the wider tabs and the X sit clear of the Sell button', async () => {
  const { page, problems, context } = await open(null);
  await page.evaluate(() => Farm.ui.openStand('shelves'));
  await frames(page, 6);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'shelves.png') });
  await context.close();
  assert.deepStrictEqual(problems, []);
});

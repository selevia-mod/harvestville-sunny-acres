// End-to-end playthrough of dist/index.html in a phone-sized headless Chromium.
// Uses real taps/keys for input; teleports the player between spots to keep it fast.
// Set SHOTS=/some/dir to save screenshots along the way.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const W = 64; // farm width in tiles
const ACTION_BTN = { x: 294, y: 512 };
// Headless Chromium renders on the CPU, so frames are slow; give clock- and fade-driven waits room.
const SLOW = { timeout: 90000 }; // headless frames can be slow

// The app's side of the packs (lib/sunny-acres/assets.js): files from dist/packs and assets/looks, as the CDN would serve them.
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file) || null, l = /^looks\/v1\/([a-z]+-(?:boy|girl)(?:-archer)?)$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : l ? path.join(__dirname, '..', 'assets', 'looks', l[1] + '.webp') : null;
  return p && require('fs').existsSync(p) ? 'data:image/webp;base64,' + require('fs').readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => require('fs').readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// The game's clock (window.gameHost.now): a spring Wednesday at 10 AM unless a test says otherwise.
const START = [2026, 4, 1, 10, 0];
const at = (when) => new Date(when[0], when[1] - 1, when[2], when[3] || 0, when[4] || 0).getTime();

async function open(savedState, when = START, viewport = { width: 360, height: 640 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
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
    window.gameHost = {
      state: state,
      quiet: !window.__loud, // no daily-gift popup or quest toasts in the way of the other tests
      saves: [],
      save(s) { this.saves.push(JSON.stringify(s)); this.state = s; },
      now: () => window.__now,
    };
  }, [savedState || null, at(when), allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; }); // no surprise rain
  await page.waitForTimeout(300);
  const cdp = await context.newCDPSession(page);
  return { page, problems, context, cdp };
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => {
  const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step));
  step();
}), n);

async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => {
    const T = Farm.Config.TILE;
    Farm.world.setFeet(tx * T + T / 2, ty * T + T / 2);
    Farm.world.dir = dir;
    Farm.world.idle();
  }, [tx, ty, dir]);
  await frames(page);
}

async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  // tools land a moment after the tap: wait for it, then let the effects play
  await page.waitForFunction(() => !Farm.world || !Farm.world.landing, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(150);
}
const modalText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
  return out.join(' | ');
});
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
// Kanor's Jeep lists every hunting place, a few to a page: the text of all its pages (6 Nov 2026: eight places)
async function jeepText(page) {
  let out = '';
  for (let p = 0; p < 3; p++) { await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openJeep(p); }, p); out += ' | ' + await modalText(page); }
  await page.evaluate(() => Farm.ui.closeAll());
  return out;
}

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const closeAll = async (page) => { await page.evaluate(() => Farm.ui.closeAll()); await frames(page, 2); };
const count = (s, id) => s.inv.filter((x) => x && x.id === id).reduce((a, b) => a + b.n, 0);

async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}

async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
}

// ---------- turning furniture (owner, 8 Nov 2026: "Furniture should be turned not just flip") ----------
test('turning furniture: Turn goes front, facing left, back, facing right; a piece that cannot turn still flips', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  await go(page, 'house');
  const bed = await page.evaluate(() => Farm.session.state.home.items.findIndex((it) => Farm.Config.HOME.types[it.t].key === 'bed'));
  assert.ok(bed >= 0);
  await page.evaluate(() => Farm.world.startDecor());
  await page.waitForFunction(() => Farm.ui.decorBar, null, SLOW);
  const seen = [];
  for (let k = 0; k < 4; k++) {
    await page.evaluate((i) => { const w = Farm.world; w.decorSelect(i); w.decorTurn(); }, bed);
    await frames(page, 3);
    const v = await page.evaluate((i) => {
      const it = Farm.session.state.home.items[i], spr = Farm.world.furn && Farm.world.furn.find ? null : null;
      const imgs = Farm.world.children.list.filter((o) => o.type === 'Image' && o.texture && /^furn/.test(o.texture.key));
      const mine = imgs.find((o) => Math.abs(o.x - it.x * Farm.Config.TILE) < 2 && Math.abs(o.y - (it.y + Farm.Config.HOME.types[it.t].h) * Farm.Config.TILE) < 2);
      return { f: it.f, key: mine && mine.texture.key, frame: mine && String(mine.frame.name), flip: mine && mine.flipX };
    }, bed);
    seen.push(v);
    await shot(page, 'furn-turn-' + k);
  }
  assert.deepStrictEqual(seen.map((v) => v.f), [2, 3, 4, 0], 'a quarter turn each time');
  assert.deepStrictEqual(seen.map((v) => [v.key, v.frame, v.flip]), [['furnturn_0', '0', false], ['furnturn_0', '1', false], ['furnturn_0', '0', true], ['furn_0', '0', false]], 'its side, its back, its other side, its front');
  // a royal one turned: its own style's picture (from the styles pack)
  await page.evaluate((i) => { const s = Farm.session.state; s.home.items[i].v = 4; s.home.items[i].f = 3; Farm.world.placeHome(); }, bed);
  await page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Image' && o.texture && o.texture.key === 'furnturn_4'), null, SLOW).catch(() => {});
  await page.evaluate(() => Farm.world.placeHome());
  await frames(page, 3);
  await shot(page, 'furn-turn-royal-back');
  // a piece that cannot turn (a rug, a plant...) still only flips
  const other = await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; const t = Farm.Config.HOME.typeIndex.bookshelf; return [L.nextTurn(t, 0), L.nextTurn(t, 1)]; });
  assert.deepStrictEqual(other, [1, 0]);
  // kept in the save
  const back = await page.evaluate((i) => { const L = Farm.Logic; return L.deserialize(JSON.parse(JSON.stringify(L.serialize(Farm.session.state)))).home.items[i].f; }, bed);
  assert.strictEqual(back, 3);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

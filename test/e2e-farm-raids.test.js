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

// ---------- Farm Raids, step 1 (owner, 9 Nov 2026; docs/raids.md) ----------
test('farm raids: the Raid Camp panel (party, raiders, defenses, practice), training, and a practice raid on a bandit farm', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; s.gold = 50000; const r = Farm.Logic.frState(s); r.camp = 3; Farm.ui.openRaidCamp('party', 0); });
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Raid Camp.*Power \d+.*Raid Camp, level 3.*Goat.*Crows.*Cat.*Carabao/);
  await shot(page, 'raid-camp');
  // train: Gold now, the goat joins when its time is up
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; for (let i = 0; i < 3; i++) L.trainRaider(s, 'goat', Date.now() - 60000); L.trainDone(s, Date.now()); });
  assert.strictEqual(await page.evaluate(() => Farm.session.state.fr.army.goat), 3);
  for (const tab of ['raiders', 'defenses', 'practice']) {
    await page.evaluate((t) => { Farm.ui.closeAll(); Farm.ui.openRaidCamp(t, 0); }, tab);
    await page.waitForTimeout(300);
    await shot(page, 'raid-tab-' + tab);
  }
  assert.match(await modalText(page), /Bandit Shack.*Raid/);
  // a party, and the first bandit farm
  await page.evaluate(() => { const r = Farm.session.state.fr; r.army = { goat: 10, crow: 6, cat: 4 }; Farm.ui.startRaid('b1'); });
  await page.waitForFunction(() => Farm.game.scene.isActive('FarmRaid'), null, SLOW);
  await page.waitForTimeout(500);
  await shot(page, 'raid-battle-start');
  // send them in from the edge (as taps on the scene would)
  await page.evaluate(() => {
    const sc = Farm.game.scene.getScene('FarmRaid');
    sc.sel = 'goat'; for (let i = 0; i < 10; i++) sc.drop(0, 6 + i);
    sc.sel = 'crow'; for (let i = 0; i < 6; i++) sc.drop(3 + i, 0);
    sc.sel = 'cat'; for (let i = 0; i < 4; i++) sc.drop(25, 4 + i);
  });
  await page.waitForTimeout(3000);
  await shot(page, 'raid-battle-mid');
  const mid = await page.evaluate(() => { const b = Farm.game.scene.getScene('FarmRaid').b; return { t: b.t, raiders: b.raiders.length, taken: Object.values(b.taken).reduce((a, x) => a + x, 0) }; });
  assert.strictEqual(mid.raiders, 20, 'all 20 went in');
  assert.ok(mid.t > 10, 'the clock runs');
  // the rest of the battle at once, then the results
  await page.evaluate(() => { const sc = Farm.game.scene.getScene('FarmRaid'); while (!sc.b.end) Farm.Logic.frStep(sc.b); sc.finish(); });
  await page.waitForTimeout(400);
  await shot(page, 'raid-battle-end');
  const res = await page.evaluate(() => Farm.game.scene.getScene('FarmRaid').result);
  assert.ok(res && res.gold >= 0 && res.stars >= 0);
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.fr.army), {}, 'the raiders that went in are used');
  // back to the farm: the practice tab, its stars
  await page.evaluate(() => Farm.raidLeave());
  await page.waitForFunction(() => !Farm.game.scene.isActive('FarmRaid') && Farm.ui.modals.length, null, SLOW);
  assert.match(await modalText(page), /Bandit Shack/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

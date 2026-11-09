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


const PARTIES = {
  P1: { goat: 6, crow: 4 },
  P2: { goat: 5, crow: 4, cat: 3 },
  P3: { goat: 3, crow: 3, cat: 2, carabao: 2 },
  P4: { goat: 3, crow: 3, cat: 2, carabao: 2, monkey: 2 },
  P5: { goat: 3, crow: 3, cat: 2, carabao: 2, monkey: 2, boar: 1 },
};
test('farm raids: the bandit farms get harder one by one (each played with the party a camp of its level holds)', async () => {
  const { page, context } = await open(null);
  await closeAll(page);
  const out = [];
  for (const key of ['b1', 'b2', 'b3', 'b4', 'b5']) {
    await page.evaluate((key) => { const s = Farm.session.state; Farm.Logic.frState(s).camp = 7; s.fr.army = { goat: 1 }; Farm.raidFarmStart({ kind: 'bandit', key }); }, key);
    await page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.ui.frBox, null, SLOW);
    const res = await page.evaluate((PARTIES) => {
      const w = Farm.world, L = Farm.Logic, farm = w.raidFarm(), rows = {};
      const cells = []; for (let i = 0; i < farm.drop.length; i++) if (farm.drop[i] === '1') cells.push([i % farm.w, Math.floor(i / farm.w)]);
      const loot = farm.loot, cx = loot.reduce((a, p) => a + p.x, 0) / loot.length, cy = loot.reduce((a, p) => a + p.y, 0) / loot.length;
      cells.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
      Object.keys(PARTIES).forEach((pk) => [1, 3].forEach((lv) => {
        const stars = [], shares = [];
        for (let seed = 1; seed <= 4; seed++) {
          const army = {}; Object.keys(PARTIES[pk]).forEach((k) => { army[k] = { n: PARTIES[pk][k], lv }; });
          const b = L.frStart(farm, army, seed); let n = 0;
          Object.keys(army).forEach((k) => { for (let i = 0; i < army[k].n; i++) { const c = cells[(n * 3) % Math.min(cells.length, 40)]; L.frDrop(b, k, c[0], c[1]); n++; } });
          while (!b.end) L.frStep(b);
          stars.push(L.frStars(b)); shares.push(Math.round(L.frShare(b) * 100));
        }
        rows[pk + ' lv' + lv] = stars.join('') + ' (' + shares.join('/') + '%)';
      }));
      return { defs: farm.defs.filter((d) => d.t !== 'fence').map((d) => d.t).join(','), fences: farm.defs.filter((d) => d.t === 'fence').length, loot: loot.length, rows };
    }, PARTIES);
    out.push(key + ' ' + JSON.stringify(res));
    await page.evaluate(() => Farm.raidFarmLeave());
    await page.waitForFunction(() => !Farm.session.visit && Farm.world.mapKey === 'farm' && !Farm.world.busy && Farm.world.player.visible, null, SLOW);
    await page.evaluate(() => Farm.ui.closeAll());
  }
  // (the best of the 4 battles: one battle's luck no longer decides it)
  const star = (b, p) => Math.max(...JSON.parse(out.find((l) => l.startsWith(b + ' ')).slice(3)).rows[p].split(' ')[0].split('').map(Number));
  assert.strictEqual(star('b1', 'P1 lv1'), 3, 'the first one: a new camp wins it');
  assert.strictEqual(star('b2', 'P1 lv1'), 0, 'the second: its scarecrow stops goats and crows');
  assert.ok(star('b2', 'P2 lv1') >= 2, 'cats win it');
  assert.ok(star('b3', 'P3 lv1') >= 1 && star('b3', 'P3 lv1') <= 2);
  assert.ok(star('b4', 'P4 lv1') <= 2 && star('b4', 'P5 lv3') >= 1); // (9 Nov 2026: defenses hit with their level now; the 4th bandit farm is a real fight)
  assert.ok(star('b5', 'P5 lv1') <= 1, 'the last: the hardest');
  assert.ok(star('b5', 'P5 lv3') <= star('b4', 'P5 lv3'), 'harder than the one before'); // (9 Nov 2026: with defenses at their level it needs raiders above level 3)
  await context.close();
});

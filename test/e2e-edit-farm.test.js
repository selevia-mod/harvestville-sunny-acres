// Edit Farm part 1 (docs/edit-farm.md), end to end: the farm with its buildings as pieces works as before, and moved ones work where they are.
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

// A save made from a fresh state (no debris on the field), changed by `edit` (run in the page).
async function makeSave(edit, when) {
  const { page, context } = await open(null, when);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState({ fieldTiles: Farm.fieldTiles() });
    // eslint-disable-next-line no-eval
    if (edit) eval(edit);
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const tileOf = (page) => page.evaluate(() => { const f = Farm.world.feet(), T = Farm.Config.TILE; return [Math.floor(f.x / T), Math.floor(f.y / T)]; });
const BASE = "s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST;";
const enterAndLeave = async (page) => {
  await page.evaluate(() => { const o = Farm.world.objects.find((w) => w.type === 'warp' && w.props.to === 'house'); Farm.world.travel(o.props.to, o.props.spawn); });
  await page.waitForFunction(() => Farm.world.mapKey === 'house' && !Farm.world.busy, null, SLOW);
  await page.evaluate(() => Farm.world.travel('farm', 'house_door'));
  await page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
};

test('the farm works as before: the door, mailbox, Lily\'s shop, the pen and the dog\'s yard where they were; the ponds are water; the house opens', async () => {
  const { page, problems, context } = await open(await makeSave(BASE));
  const r = await page.evaluate(() => {
    const w = Farm.world, z = w.zones, o = (t) => w.objects.find((x) => x.type === t);
    return {
      door: (() => { const d = w.objects.find((x) => x.type === 'warp' && x.props.to === 'house'); return [d.x0, d.y0]; })(),
      mail: o('mail') && [o('mail').x0, o('mail').y0], shop: o('shop') && [o('shop').x0, o('shop').y0, o('shop').x1],
      inc: o('incubator') && [o('incubator').x0, o('incubator').y0],
      pen: z.pen && [z.pen[0].x0, z.pen[0].y0, z.pen[0].x1, z.pen[0].y1], dog: z.dogarea && [z.dogarea[0].x0, z.dogarea[0].y0, z.dogarea[0].x1, z.dogarea[0].y1],
      water: [w.isWater(16, 4), w.isWater(35, 11), w.isWater(28, 15)], herd: !!w.herd, dogOk: !!w.dog,
      tillField: w.isTillable(8, 13), stand: !!w.tileAt('Walls', 16, 30), houseImg: !!w.houseImg,
      solid: [!!w.blocked[w.idx(5, 4)], !!w.blocked[w.idx(6, 6)], !!w.blocked[w.idx(6, 7)]],
    };
  });
  assert.deepStrictEqual(r, {
    door: [6, 6], mail: [9, 6], shop: [16, 31, 17], inc: [7, 28], pen: [3, 31, 9, 34], dog: [11, 5, 14, 9],
    water: [true, true, false], herd: true, dogOk: true, tillField: true, stand: true, houseImg: true, solid: [true, true, false],
  });
  await enterAndLeave(page);
  assert.deepStrictEqual(await tileOf(page), [6, 7], 'out at the door');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a moved house: its door warps in, you come out at it, the mailbox and the picture go along', async () => {
  const { page, problems, context } = await open(await makeSave(BASE + " const h = s.yard.items.find((it) => it.t === C.OUTDOOR.index.farmhouse); h.x = 24; h.y = 4;"));
  const r = await page.evaluate(() => { const w = Farm.world, d = w.objects.find((x) => x.type === 'warp' && x.props.to === 'house'), m = w.objects.find((x) => x.type === 'mail'); return { door: [d.x0, d.y0], mail: [m.x0, m.y0], img: [Math.round(w.houseImg.x / 256), Math.round(w.houseImg.y / 256)] }; });
  assert.deepStrictEqual(r, { door: [26, 7], mail: [29, 7], img: [24, 8] });
  await enterAndLeave(page);
  assert.deepStrictEqual(await tileOf(page), [26, 8], 'out at the moved door');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

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
const MOVE_RANCH = " const r = s.yard.items.find((it) => it.t === C.OUTDOOR.index.ranch); r.x = 24; r.y = 14;";
const MOVE_POND = " const p = s.yard.items.filter((it) => it.t === C.OUTDOOR.index.farm_pond).find((it) => it.x === 34 && it.y === 20); p.x = 24; p.y = 4;";

test('raids and the guide read the pieces: a moved ranch\'s pen is kept clear and the old spot is open; the field is its plots; the guide finds a moved pond', async () => {
  const { page, problems, context } = await open(await makeSave(BASE + MOVE_RANCH + MOVE_POND));
  const r = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, O = Farm.Config.OUTDOOR, f = w.raidFarm({ camp: 3 }), at = (x, y) => f.drop[y * f.w + x] === '1';
    const ranch = s.yard.items.find((it) => it.t === O.index.ranch), pen = w.zones.pen[0];
    let penBad = 0;
    for (let y = pen.y0; y <= pen.y1; y++) for (let x = pen.x0; x <= pen.x1; x++) if (at(x, y)) penBad++;
    let oldOpen = 0;
    for (let y = 31; y <= 34; y++) for (let x = 3; x <= 9; x++) if (at(x, y)) oldOpen++;
    let fieldBad = 0;
    s.yard.items.filter((it) => O.types[it.t].fieldPlot).forEach((it) => Farm.Logic.yardBox(it.t, it.x, it.y).forEach((p) => { if (at(p[0], p[1])) fieldBad++; }));
    return { ranch: [ranch.x, ranch.y], pen: [pen.x0, pen.y0, pen.x1, pen.y1], penBad, oldOpen, fieldBad, water: [w.isWater(25, 5), w.isWater(35, 21)] };
  });
  assert.deepStrictEqual(r.ranch, [24, 14], 'the ranch stays where it was put');
  assert.deepStrictEqual(r.pen, [25, 18, 31, 21], 'the pen moved with it');
  assert.strictEqual(r.penBad, 0, 'no landing in the moved pen');
  assert.ok(r.oldOpen > 20, 'the old pen spot is open grass to land on: ' + r.oldOpen);
  assert.strictEqual(r.fieldBad, 0, 'nor on the field');
  assert.deepStrictEqual(r.water, [true, false], 'the moved pond is water, its old spot is not');
  // the guide's 'water' goal (the daily quests: "To the field!" / water) leads to the moved pond
  await teleport(page, 26, 10, 'up');
  const end = await page.evaluate(() => { const w = Farm.world, g = w.guideGoal({ map: 'farm', to: 'water' }), p = w.guidePath(g.goal); return p && p.length ? p[p.length - 1] : null; });
  assert.ok(end && end.x >= 23 && end.x <= 29 && end.y >= 3 && end.y <= 8, 'next to the moved pond: ' + JSON.stringify(end));
  // and the 'field' goal is a field plot
  const fend = await page.evaluate(() => { const w = Farm.world, g = w.guideGoal({ map: 'farm', to: 'field' }), p = w.guidePath(g.goal); return p && p.length ? p[p.length - 1] : null; });
  assert.ok(fend && fend.x >= 4 && fend.x <= 19 && fend.y >= 11 && fend.y <= 24, 'on the field: ' + JSON.stringify(fend));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

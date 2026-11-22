// The town's Market Hall in the owner's own picture (owner, 22 Nov 2026: "Yes, build it in"; art-src/town/bh_market_hall.png,
// tools/art/vehicles-import.js, src/19zzzz-bayanihan.js): once the town has built it, the painted hall stands over the
// plaza's stalls with "MARKET HALL" on its sign; its back posts behind the stalls, its roof in front of the farmer;
// until the picture is on the phone (or with no app at all) the drawn roof, and the moment it comes, the picture.
// Run alone, after node build.js: node --test --test-concurrency=1 test/e2e-market-hall.test.js   (SHOTS=/some/dir)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const HALL = ['bh_market_hall', 'bh_market_hall_back'];

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
// the app's side: each file answered after `delay` ms (the phone downloading it)
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { setTimeout(function () { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }, window.__delay || 0); }); };';

// app: false = no app (a browser preview: nothing can be fetched); true = the app, the files answered after `delay`
async function open(savedState, app, delay = 0) {
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
  await page.addInitScript(([state, here, delay]) => {
    window.__here = here;
    window.__delay = delay;
    window.gameHost = { state: state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } };
  }, [savedState || null, app ? allPackFiles() : [], delay]);
  if (app) await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  return { page, problems, context };
}
// a farm in town; `built`: the town's projects built (bits: 1 the Old Bridge, 2 the Market Hall)
async function makeSave(built) {
  const { page, context } = await open(null, false);
  const save = await page.evaluate((built) => {
    const L = Farm.Logic, s = L.newState();
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1;
    s.map = 'town';
    s.bh = s.bh || {};
    s.bh.built = built;
    return L.serialize(s);
  }, built);
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const inTown = (page) => page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy && Farm.world.player.active && Farm.world.bh, null, SLOW);
const parts = (page) => page.evaluate(() => ((Farm.world.bh && Farm.world.bh.hallParts) || []).filter((p) => p.active).map((p) => (p.type === 'Text' ? { text: p.text, depth: p.depth, w: p.displayWidth } : { key: p.texture.key, depth: p.depth, x: p.x, y: p.y, w: p.displayWidth, h: p.displayHeight })));
async function lookAt(page) {
  await page.evaluate(() => { const h = Farm.world.points.bh_hall; Farm.world.setFeet(h.x + 3.5 * 256, h.y + 6 * 256); Farm.world.dir = 'up'; Farm.world.idle(); });
  await frames(page, 10);
}

test('the owner\'s Market Hall over the stalls: the sign says MARKET HALL; its back posts behind the stalls, its roof in front; on the ground the drawn roof stood on', async () => {
  const { page, problems, context } = await open(await makeSave(3), true);
  await inTown(page);
  await page.waitForFunction((keys) => keys.every((k) => Farm.images[k]), HALL, SLOW);
  await frames(page, 4);
  await lookAt(page);
  const p = await parts(page);
  assert.deepStrictEqual(p.map((x) => x.key || x.text), ['bh_market_hall_back', 'bh_market_hall', 'MARKET HALL']);
  const [back, hall, sign] = p;
  const T = 256, h = await page.evaluate(() => Farm.world.points.bh_hall);
  assert.ok(Math.abs(hall.x - h.x) < 1 && Math.abs(hall.w - 4.9 * T) < 1, 'the drawn roof\'s place and width: ' + JSON.stringify(hall));
  assert.ok(Math.abs(hall.y + hall.h - (h.y + 3.05 * T)) < 1, 'its posts on the drawn roof\'s ground');
  assert.deepStrictEqual([back.x, back.y, back.w, back.h], [hall.x, hall.y, hall.w, hall.h], 'the back posts exactly under the hall');
  assert.ok(sign.w <= 0.34 * hall.w, 'the words fit the sign: ' + sign.w);
  assert.ok(sign.depth > hall.depth, 'the words on the sign');
  // the stalls (their row is blocked under the roof) stand in front of the back posts and behind the roof
  const row = await page.evaluate(() => { const w = Farm.world, h = w.points.bh_hall, out = []; for (let y = Math.floor(h.y / 256); y < h.y / 256 + 3.05; y++) { let n = 0; for (let x = Math.floor(h.x / 256); x < h.x / 256 + 4.9; x++) if (w.blocked[w.idx(x, y)]) n++; if (n >= 3) out.push(y); } return out; });
  assert.ok(row.length, 'the stalls under the hall');
  const stallDepth = await page.evaluate((y) => Farm.WorldScene.DEPTH.actor + (y + 1) * 256 / 1e5, row[0]);
  assert.ok(back.depth < stallDepth && stallDepth < hall.depth, 'back posts ' + back.depth + ' < stalls ' + stallDepth + ' < roof ' + hall.depth);
  // a farmer in front of the hall stands in front of it all
  await page.evaluate(() => { const h = Farm.world.points.bh_hall; Farm.world.setFeet(h.x + 2.4 * 256, h.y + 3.6 * 256); Farm.world.idle(); });
  await frames(page, 4);
  assert.ok(await page.evaluate(() => Farm.world.player.depth) > hall.depth, 'the farmer in front of the hall');
  await shot(page, '01-market-hall');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('until the picture is on the phone: the drawn roof; the moment it comes, the owner\'s hall in its place (once, nothing left behind)', async () => {
  const { page, problems, context } = await open(await makeSave(3), true, 2500);
  await inTown(page);
  await frames(page, 4);
  assert.deepStrictEqual((await parts(page)).map((x) => x.key), ['bh-hall'], 'the drawn roof first');
  await lookAt(page);
  await shot(page, '02-drawn-roof-first');
  await page.waitForFunction((keys) => keys.every((k) => Farm.images[k]), HALL, SLOW);
  await frames(page, 4);
  assert.deepStrictEqual((await parts(page)).map((x) => x.key || x.text), ['bh_market_hall_back', 'bh_market_hall', 'MARKET HALL']);
  assert.strictEqual(await page.evaluate(() => Farm.world.children.list.filter((o) => o.texture && o.texture.key === 'bh-hall').length), 0, 'the drawn roof gone');
  await shot(page, '03-owner-hall-came');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('no app (nothing can be fetched): the drawn roof, no errors; not built yet: no hall at all', async () => {
  let o = await open(await makeSave(3), false);
  await inTown(o.page);
  await frames(o.page, 4);
  assert.deepStrictEqual((await parts(o.page)).map((x) => x.key), ['bh-hall']);
  assert.deepStrictEqual(o.problems, []);
  await o.context.close();
  o = await open(await makeSave(1), true);
  await inTown(o.page);
  await o.page.waitForTimeout(1000);
  assert.deepStrictEqual(await parts(o.page), []);
  assert.ok(await o.page.evaluate((keys) => keys.every((k) => !Farm.images[k]), HALL), 'not fetched before the town builds it');
  assert.deepStrictEqual(o.problems, []);
  await o.context.close();
});

// The deep Mine in the built page (dist/index.html), phone-sized headless Chromium: floor 1,250 and 2,500 (a tough
// rock: cracks for free, its energy once on the breaking swing), a grumpy critter (Bonk for free, its charge takes its
// energy, bonked down it leaves an ore), the centred tour the first time past floor 1,200, and the frame time on a slow
// phone (CPU x4) on a deep floor with its critters out. Run alone, after `node build.js`:
//   node --test --test-concurrency=1 test/e2e-deep-mine.test.js        (SHOTS=/some/dir saves screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const DAY = [2026, 11, 18, 10, 0];
// The app's side of the packs (as test/e2e-gorge.test.js): with `packs`, the Wild Lands' pack is on the phone
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(edit, opts = {}) {
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
  await page.addInitScript(([now, loud, here]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state: null, quiet: !loud, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [at(DAY), !!opts.loud, opts.packs ? allPackFiles() : []]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate((edit) => {
    const s = Farm.session.state;
    Farm.Logic.weather = () => 'sunny';
    s.goal = 1e6;
    s.stats.deepest = 2600;
    s.tools.hammer = 3;
    s.energy = 5000;
    eval(edit || ''); // eslint-disable-line no-eval
    Farm.ui.closeAll();
  }, edit || '');
  await page.waitForTimeout(300);
  return { page, problems, context };
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
async function floor(page, n) {
  await page.evaluate((n) => Farm.world.travel('mine', 'entrance', n), n);
  await page.waitForFunction((n) => Farm.world.mapKey === 'mine' && Farm.session.mineFloor === n && !Farm.world.busy && Farm.world.player.active, n, SLOW);
  await frames(page, 4);
}
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(250);
}
// for a picture: you in the open middle of the floor, the critters on free tiles round you, the toasts gone
const pose = async (page, name) => {
  await page.evaluate(() => {
    const w = Farm.world, z = w.zones.minefloor[0], T = 256, free = (x, y) => w.walkable(x, y), out = [];
    let best = null, most = -1;
    for (let y = z.y0 + 2; y <= z.y1 - 2; y++) for (let x = z.x0 + 1; x <= z.x1 - 1; x++) {
      if (!free(x, y)) continue;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (free(x + dx, y + dy)) n++;
      if (n > most) { most = n; best = [x, y]; }
    }
    w.setFeet(best[0] * T + 128, best[1] * T + 160); w.dir = 'down'; w.idle();
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && Math.abs(dx) + Math.abs(dy) >= 2 && free(best[0] + dx, best[1] + dy)) out.push([best[0] + dx, best[1] + dy]);
    (w.deep || []).forEach((a, i) => { const p = out[(i * 3) % out.length]; a.x = p[0] * T + 128; a.y = p[1] * T + 190; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; a.vx = a.vy = 0; a.left = p[0] > best[0]; });
  });
  await page.waitForTimeout(3200);
  await shot(page, name);
};
// stand below a rock, facing up, the Hammer in hand; returns the rock's tile index and how many swings it needs
const atRock = (page) => page.evaluate(() => {
  const w = Farm.world, L = Farm.Logic, s = w.state, W = w.map.width, T = 256;
  const i = s.inv.findIndex((x) => x && x.id === 'hammer');
  if (i >= 0) s.sel = i;
  const idx = w.mine.rocks.find((r) => !w.mine.broken[r] && r !== w.mine.stairs && w.walkable(r % W, Math.floor(r / W) + 1) && L.rockHitsAt(s, Farm.session.mineFloor, r) >= 2);
  (w.deep || []).forEach((a) => { a.x = -9 * T; a.cool = 1e9; });
  w.setFeet((idx % W) * T + 128, (Math.floor(idx / W) + 1) * T + 140);
  w.dir = 'up';
  w.idle();
  return { idx, hits: L.rockHitsAt(s, Farm.session.mineFloor, idx), e: L.mineEnergy(s, Farm.session.mineFloor) };
});

test('floor 1,250 and 2,500: a tough rock cracks for free, then breaks for its energy once; the cave keeps the cracks for the day', async () => {
  const { page, problems, context } = await open('s.tools.hammer = 0;'); // (the Basic Hammer: half the rocks of floor 1,250 take 2 swings)
  await floor(page, 1250);
  assert.strictEqual(await page.evaluate(() => Farm.world.map.getTileset('indoor').image.key), 'indoor-star');
  const r = await atRock(page);
  assert.ok(r.hits >= 2, 'a 2-swing rock: ' + r.hits);
  assert.strictEqual(await actionLabel(page), 'Smash');
  const e0 = await page.evaluate(() => Farm.session.state.energy);
  await tapAction(page);
  await page.waitForTimeout(300);
  const one = await page.evaluate((idx) => ({ energy: Farm.session.state.energy, broken: !!Farm.world.mine.broken[idx], cracks: Farm.world.mine.cracks[idx] }), r.idx);
  assert.deepStrictEqual(one, { energy: e0, broken: false, cracks: 1 }, 'the first swing cracks it, for nothing');
  for (let k = 1; k < r.hits; k++) { await tapAction(page); await page.waitForTimeout(300); }
  const done = await page.evaluate((idx) => ({ energy: Farm.session.state.energy, broken: !!Farm.world.mine.broken[idx], cracks: Farm.world.mine.cracks[idx] }), r.idx);
  assert.deepStrictEqual(done, { energy: e0 - r.e, broken: true, cracks: undefined }, 'broken on its last swing, for one rock\'s energy');
  await pose(page, 'deep-1250');
  // 2,500: the critters out, tougher still
  await floor(page, 2500);
  const here = await page.evaluate(() => (Farm.world.deep || []).map((a) => a.kind + ' ' + a.hp + ' ' + a.img.texture.key));
  assert.strictEqual(here.length, 3, 'three critters on floor 2,500: ' + here);
  assert.ok(here.every((x) => /fx-critter-/.test(x)), 'without the Wild Lands\' pack: the drawn stand-ins ' + here);
  const r2 = await atRock(page);
  await tapAction(page);
  await page.waitForTimeout(300);
  // out and back the same day: the crack is still there
  await floor(page, 2499);
  await floor(page, 2500);
  assert.strictEqual(await page.evaluate((idx) => Farm.world.mine.cracks[idx], r2.idx), 1);
  assert.ok(await page.evaluate((idx) => !!Farm.world.mine.crackG[idx], r2.idx), 'and its cracks are drawn');
  await pose(page, 'deep-2500');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a grumpy critter: Bonk is free, a charge that reaches you takes its energy, bonked down it scampers off with an ore', async () => {
  const { page, problems, context } = await open('', { packs: true });
  await floor(page, 2251);
  await page.waitForFunction(() => Farm.packReady('wild'), null, SLOW); // (opened from the phone on the first deep floor)
  await floor(page, 2252);
  assert.ok(await page.evaluate(() => Farm.world.deep.every((a) => a.art && a.img.texture.key === 'wild')), 'the Wild Lands\' pictures, in their own colours');
  const c = await page.evaluate(() => {
    const w = Farm.world, s = w.state, T = 256, L = Farm.Logic;
    s.sel = s.inv.findIndex((x) => x && x.id === 'hammer');
    const z = w.zones.minefloor[0]; // (on the floor, with free floor above you)
    let spot = null;
    for (let y = z.y0 + 1; y <= z.y1 && !spot; y++) for (let x = z.x0; x <= z.x1 && !spot; x++) if (w.walkable(x, y) && w.walkable(x, y - 1)) spot = [x, y];
    w.setFeet(spot[0] * T + 128, spot[1] * T + 160);
    const a = w.deep[0], f = w.feet();
    w.deep.slice(1).forEach((b) => { b.x = -9 * T; b.cool = 1e9; });
    a.x = f.x; a.y = f.y - 0.8 * T; a.cool = 1e9; a.mode = 'idle'; a.t = 1e9;
    w.dir = 'up'; w.idle();
    return { kind: a.kind, hp: a.hp, hit: L.critterLoss(s, a.kind, 2252), name: a.def.name };
  });
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Bonk');
  const e0 = await page.evaluate(() => Farm.session.state.energy);
  await tapAction(page);
  await page.waitForTimeout(250);
  assert.strictEqual(await page.evaluate(() => Farm.world.deep[0].hp), c.hp - 1);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.energy), e0, 'a bonk costs nothing');
  // its charge
  await page.evaluate(() => { const a = Farm.world.deep[0]; a.cool = 0; a.t = 0; a.mode = 'idle'; });
  await page.waitForFunction((e0) => Farm.session.state.energy < e0, e0, { timeout: 8000 });
  assert.strictEqual(await page.evaluate(() => Farm.session.state.energy), e0 - c.hit, 'a charge: ' + c.hit + ' energy');
  // bonked down
  const ore = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'obsidian'));
  for (let k = 0; k < c.hp + 2; k++) {
    const left = await page.evaluate(() => { const w = Farm.world, f = w.feet(), a = w.deep && w.deep.find((x) => x.kind); if (!a || !w.deep.includes(a)) return 0; a.x = f.x; a.y = f.y - 0.8 * 256; a.cool = 1e9; a.mode = 'idle'; a.t = 1e9; a.vx = a.vy = 0; w.dir = 'up'; w.idle(); return a.hp; });
    if (!left || (await page.evaluate(() => Farm.world.deep.length)) < 3) break;
    await frames(page, 2);
    await tapAction(page);
  }
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => Farm.world.deep.length), 2, 'one fewer');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'obsidian')), ore + 1);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /scampers off/);
  await pose(page, 'deep-critter');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the first time past floor 1,200: THE DEEP HALLS, a centred tour, once', async () => {
  const { page, problems, context } = await open('', { loud: true });
  await page.evaluate(() => { const s = Farm.session.state; ['mine_tour', 'rare_tour'].forEach((k) => Farm.Logic.takeTip(s, k)); });
  await floor(page, 1201);
  await page.waitForFunction(() => { // (the day's gift and the like close first: the tour waits for them)
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    if (!m) return false;
    const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (out.includes('THE DEEP HALLS')) return true;
    Farm.ui.closeAll();
    return false;
  }, null, { timeout: 30000, polling: 500 });
  const card = await page.evaluate(() => {
    const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    walk(m.c.list);
    const b = m.c.getBounds();
    return { text: out.join(' | '), mid: Math.round(b.centerX) };
  });
  assert.match(card.text, /THE DEEP HALLS/);
  assert.match(card.text, /The deep halls grow harder/);
  assert.ok(Math.abs(card.mid - 180) <= 2, 'centred: ' + card.mid);
  await page.waitForTimeout(700);
  await shot(page, 'deep-note');
  assert.ok(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'deep_tour')));
  await page.evaluate(() => Farm.ui.closeAll());
  await floor(page, 1202);
  await page.waitForTimeout(3000);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'once');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// The world's own work in a frame (its update and its drawing), as test/e2e-gorge.test.js measures it
const work = (page, ms) => page.evaluate((ms) => new Promise((resolve) => {
  const d = [], wk = [], sys = Farm.world.sys, step = sys.step, render = sys.render;
  let w = 0;
  sys.step = function () { const t = performance.now(); try { return step.apply(this, arguments); } finally { w += performance.now() - t; } };
  sys.render = function () { const t = performance.now(); try { return render.apply(this, arguments); } finally { w += performance.now() - t; } };
  let last = performance.now();
  const t0 = last;
  const sum = (a) => { a.sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p50: +a[Math.floor(a.length * 0.5)].toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), worst: +a[a.length - 1].toFixed(1) }; };
  const tick = (now) => {
    d.push(now - last); wk.push(w); w = 0; last = now;
    if (now - t0 < ms) return requestAnimationFrame(tick);
    delete sys.step; delete sys.render;
    resolve({ frame: sum(d), world: sum(wk), frames: d.length });
  };
  requestAnimationFrame(tick);
}), ms);

test('a slow phone (CPU x4): floor 2,500 with its three critters, against floor 1,000 (budget 13-14 ms at 60 Hz)', async () => {
  const { page, problems, context } = await open('', { packs: true });
  await floor(page, 2499);
  await page.waitForFunction(() => Farm.packReady('wild'), null, SLOW);
  const cdp = await context.newCDPSession(page);
  const rows = {};
  for (const [name, n] of [['floor 1,000', 1000], ['floor 2,500', 2500]]) {
    await floor(page, n);
    await page.evaluate(() => { (Farm.world.deep || []).forEach((a) => { a.cool = 1e9; }); }); // (they wander, but leave you be)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.waitForTimeout(1500);
    const m = work(page, 6000);
    for (const [k, ms] of [['ArrowDown', 900], ['ArrowRight', 700], ['ArrowLeft', 1400], ['ArrowUp', 900]]) { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); }
    rows[name] = await m;
    rows[name].critters = await page.evaluate(() => (Farm.world.deep || []).length);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  console.log('[CPU x4] world work per frame (ms), and frame gaps:', JSON.stringify(rows));
  assert.strictEqual(rows['floor 2,500'].critters, 3);
  assert.ok(rows['floor 2,500'].world.avg <= 14, 'within the 60 Hz budget on average: ' + rows['floor 2,500'].world.avg);
  assert.ok(rows['floor 2,500'].world.p50 <= Math.max(14, rows['floor 1,000'].world.p50 * 1.3), 'about as light as floor 1,000');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

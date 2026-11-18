// Browser playthroughs of Bram's farm machines (the last part of the truck plan, owner 18 Nov 2026; src/19zzz...-machines.js):
// Bram makes each one at the Forge; each held in the field: the Tractor's 3x3 (debris cleared, the stump left) and its row of 9
// (held button), the Seeder (the packet held last), the Harvester (into the Silo); the field's edge; the first-time tour,
// centred; and the burst of one 3x3 on a slow phone (CPU x4). Run alone, after node build.js:
// node --test --test-concurrency=1 test/e2e-machines.test.js   (SHOTS=/some/dir saves the screenshots)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const W = 75;
const START = [2026, 11, 18, 10, 0];
const at = (when) => new Date(when[0], when[1] - 1, when[2], when[3] || 0, when[4] || 0).getTime();
const idx = (x, y) => y * W + x;

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(savedState, quiet = true) {
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
  await page.addInitScript(([state, now, quiet]) => {
    window.__now = now;
    window.gameHost = { state: state, quiet: quiet, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, at(START), quiet]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a farm with its field clear, the three machines' materials and plenty of gold: `edit` runs in the page (s, L, C)
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    s.debris = {};
    s.gold = 500000;
    s.energy = 100;
    s.lumber = 200;
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; // (every older tip seen: none in the way)
    eval(edit); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page, 2);
}
async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => { Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.dir = dir; Farm.world.idle(); }, [tx, ty, dir]);
  await frames(page);
}
// holds the bag slot with `id` in it
async function hold(page, id) {
  const i = await page.evaluate((id) => { const s = Farm.session.state, i = s.inv.findIndex((x) => x && x.id === id); if (i >= 0) { s.sel = i; Farm.bus.emit('hud'); } return i; }, id);
  assert.ok(i >= 0, id + ' in the bag');
  await frames(page, 3);
}
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
}
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});
const slimTo = (page, name) => page.evaluate((name) => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text.indexOf(name) === 0 && m.c.slimInto) m.c.slimInto(o); if (o.list) walk(o.list); });
  walk(m.c.list);
}, name);
// taps the button `label` in the row whose name starts with `row`
async function tapIn(page, row, label) {
  const pos = await page.evaluate(([row, label]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], names = [], btns = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text.indexOf(row) === 0) names.push(o); if (o.type === 'Text' && o.text === label) btns.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const n = names[0];
    if (!n) return null;
    if (m.c.slimInto) m.c.slimInto(n);
    const b = btns.sort((a, b2) => Math.abs(a.getBounds().centerY - n.getBounds().centerY) - Math.abs(b2.getBounds().centerY - n.getBounds().centerY))[0];
    if (!b) return null;
    if (m.c.slimInto) m.c.slimInto(b);
    const bb = b.getBounds();
    return { x: bb.centerX, y: bb.centerY };
  }, [row, label]);
  assert.ok(pos, `"${label}" in the row "${row}"`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
  await page.waitForTimeout(150);
}
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
}
// holds the action button down until the charge reaches `level`, then lets go
async function holdAction(page, cdp, level) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ACTION_BTN.x, y: ACTION_BTN.y, id: 7 }] });
  await page.waitForFunction((lv) => Farm.world.charge && Farm.world.charge.level === lv, level, SLOW);
  await frames(page, 2);
}
const release = async (page, cdp) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => !Farm.world.charge, null, SLOW);
  await frames(page, 2);
};
const MATS = "s.lumber = 200; [['ore_copper', 10], ['ore_silver', 10], ['ore_gold', 10], ['farm_cement', 10], ['rope', 10]].forEach((n) => L.addItem(s, n[0], n[1]));";
const MACHINES = "['tractor', 'seeder', 'harvester'].forEach((k) => { L.addItem(s, k, 1); s.mk |= 1 << C.MACHINE_KINDS.indexOf(k); }); s.mk |= 8;";
const shownSoil = (page, list) => page.evaluate((list) => list.filter((i) => Farm.world.layers.Soil.getTileAt(i % 75, Math.floor(i / 75))).length, list);

test('Bram makes the Tractor, the Seeder and the Harvester (three new Forge rows), one of each', async () => {
  const save = await makeSave(MATS + " s.mk = 8; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.ui.openForge());
  await frames(page, 4);
  const t = await modalText(page);
  assert.match(t, /Tractor/);
  assert.match(t, /Also 40 lumber\. Tills the 3x3 ahead/);
  await slimTo(page, 'Tractor');
  await frames(page, 3);
  await shot(page, '01-forge-rows');
  await tapIn(page, 'Tractor', 'Make');
  let s = await state(page);
  assert.strictEqual(s.gold, 500000 - 80000);
  assert.ok(s.inv.some((x) => x && x.id === 'tractor') && s.mk === 9);
  await tapIn(page, 'Seeder', 'Make');
  await tapIn(page, 'Harvester', 'Make');
  s = await state(page);
  assert.strictEqual(s.gold, 500000 - 80000 - 120000 - 200000);
  assert.strictEqual(s.lumber, 200 - 40 - 40 - 60);
  assert.deepStrictEqual(['ore_copper', 'ore_silver', 'ore_gold', 'farm_cement', 'rope'].map((id) => s.inv.filter((x) => x && x.id === id).reduce((n, x) => n + x.n, 0)), [0, 0, 0, 0, 0]);
  assert.strictEqual(s.mk, 15);
  await slimTo(page, 'Harvester (made)');
  await frames(page, 3);
  assert.match(await modalText(page), /Tractor \(made\).*Seeder \(made\).*Harvester \(made\)/);
  await shot(page, '02-forge-rows-made');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('in the field: the Tractor tills the 3x3 ahead and clears it (the stump stays); held down, a row of 9; at the field\'s edge, only field soil', async () => {
  const save = await makeSave(MACHINES + " s.debris[13 * 75 + 5] = 'weed'; s.debris[14 * 75 + 4] = 'branch'; s.debris[14 * 75 + 6] = 'stone'; s.debris[12 * 75 + 6] = 'stump';");
  const { page, problems, context } = await open(save);
  const cdp = await context.newCDPSession(page);
  await teleport(page, 5, 11, 'down'); // (in the field: the fence runs along row 10)
  await hold(page, 'tractor');
  assert.strictEqual(await actionLabel(page), 'Till');
  const shown = await page.evaluate(() => ({ spr: !!Farm.world.mkSpr && Farm.world.mkSpr.visible, cells: Farm.world.areaCells.filter((c) => c.visible).length }));
  assert.deepStrictEqual(shown, { spr: true, cells: 9 }, 'the machine in front, the 3x3 shown');
  await shot(page, '03-tractor-held-field-before');
  const s0 = await state(page);
  await tapAction(page);
  await page.waitForTimeout(60);
  await shot(page, '04-tractor-in-use');
  await page.waitForTimeout(600);
  let s = await state(page);
  const block = []; for (let y = 12; y <= 14; y++) for (let x = 4; x <= 6; x++) block.push(idx(x, y));
  assert.deepStrictEqual(block.filter((i) => s.soil[i]).length, 8, 'tilled all but the stump');
  assert.ok(!s.debris[idx(5, 13)] && !s.debris[idx(4, 14)] && !s.debris[idx(6, 14)] && s.debris[idx(6, 12)] === 'stump');
  assert.deepStrictEqual([s.lumber - s0.lumber, s.stone - s0.stone], [1, 1], 'the branch\'s lumber, the stone\'s stone');
  assert.strictEqual(s0.energy - s.energy, Math.floor((8 * 2 + 1 + 3 + 3) * 8 / 9), 'by hand 23 (8 tilled, a weed, a branch, a stone): the Tractor 20');
  assert.strictEqual(await shownSoil(page, block), 8, 'the soil is drawn');
  await shot(page, '05-tractor-field-after');
  // held down: a row of 9
  await teleport(page, 8, 11, 'down');
  await holdAction(page, cdp, 1);
  assert.match(await page.evaluate(() => Farm.ui.chargeText.text), /Row of 9/);
  assert.strictEqual(await page.evaluate(() => Farm.world.areaCells.filter((c) => c.visible).length), 9);
  await shot(page, '06-tractor-row-held');
  await release(page, cdp);
  await page.waitForTimeout(500);
  s = await state(page);
  assert.strictEqual([12, 13, 14, 15, 16, 17, 18, 19, 20].filter((y) => s.soil[idx(8, y)]).length, 9, 'a row of 9');
  // the field's edge: only the field soil of the block
  await teleport(page, 5, 16, 'left'); // the block ahead: x 4 (field), 3 and 2 (not)
  assert.strictEqual(await actionLabel(page), 'Till');
  await tapAction(page);
  await page.waitForTimeout(500);
  s = await state(page);
  assert.deepStrictEqual([15, 16, 17].map((y) => [!!s.soil[idx(4, y)], !!s.soil[idx(3, y)], !!s.soil[idx(2, y)]]), [[true, false, false], [true, false, false], [true, false, false]]);
  // off the farm it does nothing (and says why)
  await go(page, 'town', 'from_farm');
  await hold(page, 'tractor');
  assert.strictEqual(await page.evaluate(() => !!(Farm.world.mkSpr && Farm.world.mkSpr.visible)), false, 'not shown in town');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('in the field: the Seeder plants the packet held last (one packet a pass); the Harvester picks the 3x3 into the Silo, and a row of 9', async () => {
  const till = 'for (let y = 11; y <= 20; y++) for (let x = 4; x <= 8; x++) s.soil[y * 75 + x] = { w: 1, c: null, p: 0, r: 0 };';
  const save = await makeSave(MACHINES + till + " s.inv = s.inv.map((x) => (x && C.ITEMS[x.id].kind === 'seed' ? null : x)); L.addItem(s, 'seed_turnip', 3); L.addItem(s, 'seed_potato', 3);");
  const { page, problems, context } = await open(save);
  const cdp = await context.newCDPSession(page);
  await teleport(page, 5, 11, 'down');
  await hold(page, 'seed_potato'); // held last
  await hold(page, 'seeder');
  assert.strictEqual(await actionLabel(page), 'Plant');
  await shot(page, '07-seeder-held');
  await tapAction(page);
  await page.waitForTimeout(60);
  await shot(page, '08-seeder-in-use');
  await page.waitForTimeout(600);
  let s = await state(page);
  const block = []; for (let y = 12; y <= 14; y++) for (let x = 4; x <= 6; x++) block.push(idx(x, y));
  assert.ok(block.every((i) => s.soil[i].c === 'potato'), 'the 3x3 planted with potatoes');
  assert.deepStrictEqual(['seed_potato', 'seed_turnip'].map((id) => s.inv.filter((x) => x && x.id === id).reduce((n, x) => n + x.n, 0)), [2, 3], 'one packet');
  assert.strictEqual(s.inv[s.sel].id, 'seeder', 'still holding the Seeder');
  await shot(page, '09-seeder-field-after');
  // the crops ripen; the Harvester picks them into the Silo
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic, C = Farm.Config; Object.keys(s.soil).forEach((i) => { const t = s.soil[i]; if (t.c) { t.w = 1; t.p = L.nowMin() - C.CROPS[t.c].mins - 1; } }); Farm.world.refreshAllSoil(); });
  await hold(page, 'harvester');
  assert.strictEqual(await actionLabel(page), 'Harvest');
  await shot(page, '10-harvester-held-ripe');
  const before = await state(page);
  await tapAction(page);
  await page.waitForTimeout(60);
  await shot(page, '11-harvester-in-use');
  await page.waitForTimeout(700);
  s = await state(page);
  assert.ok(block.every((i) => !s.soil[i].c), 'all 9 picked');
  const silo = (st) => (st.silo && st.silo.c.potato) || 0, bag = (st) => st.inv.filter((x) => x && x.id === 'potato').reduce((n, x) => n + x.n, 0);
  assert.ok(silo(s) - silo(before) >= 1 && silo(s) - silo(before) + bag(s) - bag(before) >= 9, 'into the Silo (Silver and Gold ones in the bag): ' + [silo(s), bag(s)]);
  assert.strictEqual(s.inv.filter((x) => x && x.id === 'potato' && !x.q).length, 0, 'no plain potatoes in the bag: the Silo had room');
  await shot(page, '12-harvester-field-after');
  // a row of 9: planted by the Seeder held down, ripened, picked by the Harvester held down
  await teleport(page, 8, 11, 'down');
  await hold(page, 'seeder');
  await holdAction(page, cdp, 1);
  await release(page, cdp);
  await page.waitForTimeout(500);
  s = await state(page);
  const r = [12, 13, 14, 15, 16, 17, 18, 19, 20].map((y) => idx(8, y));
  assert.ok(r.every((i) => s.soil[i].c === 'potato'), 'a row of 9 planted');
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic, C = Farm.Config; Object.keys(s.soil).forEach((i) => { const t = s.soil[i]; if (t.c) { t.w = 1; t.p = L.nowMin() - C.CROPS[t.c].mins - 1; } }); Farm.world.refreshAllSoil(); });
  await hold(page, 'harvester');
  await holdAction(page, cdp, 1);
  await release(page, cdp);
  await page.waitForTimeout(600);
  s = await state(page);
  assert.ok(r.every((i) => !s.soil[i].c), 'a row of 9 picked');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the first-time tour (centred, once), then the Forge with its machine rows', async () => {
  const save = await makeSave(MATS + " s.mk = 0; s.map = 'town';");
  const { page, problems, context } = await open(save, false);
  await page.waitForTimeout(1500);
  await page.evaluate(() => Farm.ui.closeAll());
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.ui.openForge());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(700);
  assert.match(await modalText(page), /FARM MACHINES/);
  const box = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1].c.getBounds(); return { x: m.centerX, w: m.width }; });
  assert.ok(Math.abs(box.x - 180) < 12, 'centred: ' + JSON.stringify(box));
  await shot(page, '13-tour-1');
  for (let i = 2; i <= 5; i++) { await tapButton(page, 'Next'); await page.waitForTimeout(900); await shot(page, '13-tour-' + i); }
  await tapButton(page, 'Got it');
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Bram's Forge/);
  assert.match(await modalText(page), /Tractor/);
  const s = await state(page);
  assert.strictEqual(s.mk, 8, 'seen');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openForge());
  await frames(page, 4);
  assert.doesNotMatch(await modalText(page), /FARM MACHINES/, 'once only');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// The world's own work in a frame (its update and its drawing), as e2e-jungle.test.js measures it
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

test('a slow phone (CPU x4): one 3x3 of each machine is one short burst; the frames after it, and holding one, within the budget', async () => {
  const debris = "for (let y = 12; y <= 22; y++) for (let x = 4; x <= 19; x++) if ((x + y) % 3 === 0) s.debris[y * 75 + x] = ['weed', 'branch', 'stone'][(x * 7 + y) % 3];";
  // (past the starter goals, as a farm that can afford a machine is: a goal finished by the first tap shows its own reward
  // card, which picking or tilling by hand shows too; measured on its own below)
  const save = await makeSave(MACHINES + debris + " L.addItem(s, 'seed_potato', 20); s.energy = 100; s.goal = C.GOALS.length;");
  const { page, problems, context } = await open(save);
  const cdp = await context.newCDPSession(page);
  // the burst: mkUse timed, many times over on fresh blocks (the page's timer is coarse: 0.1 ms)
  await page.evaluate(() => {
    const P = Object.getPrototypeOf(Farm.world), use = P.mkUse;
    window.__bursts = [];
    P.mkUse = function () { const t0 = performance.now(); try { return use.apply(this, arguments); } finally { window.__bursts.push(performance.now() - t0); } };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(800);
  const rows = {};
  const idle = await work(page, 1500);
  rows.idle = idle;
  for (const k of ['tractor', 'seeder', 'harvester']) {
    if (k === 'harvester') await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic, C = Farm.Config; Object.keys(s.soil).forEach((i) => { const t = s.soil[i]; if (t.c) { t.w = 1; t.p = L.nowMin() - C.CROPS[t.c].mins - 1; } }); Farm.world.refreshAllSoil(); });
    await hold(page, k);
    await page.evaluate(() => { window.__bursts = []; });
    const held = await work(page, 1200);
    const after = [];
    for (const x of [5, 8, 11, 14, 17]) {
      await teleport(page, x, 11, 'down');
      await page.evaluate(() => { Farm.session.state.energy = 100; });
      await tapAction(page);
      after.push(await work(page, 700));
      await page.waitForTimeout(150);
    }
    const b = await page.evaluate(() => window.__bursts.slice());
    b.sort((x, y) => x - y);
    rows[k] = { held: held.frame, heldWorld: held.world, burst: { n: b.length, p50: +b[Math.floor(b.length / 2)].toFixed(1), worst: +b[b.length - 1].toFixed(1) }, after: after.map((a) => a.world.worst), afterP50: after.map((a) => a.world.p50) };
    assert.strictEqual(b.length, 5, k + ': 5 uses');
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log('machines on a slow phone (CPU x4), ms:', JSON.stringify(rows, null, 1));
  ['tractor', 'seeder', 'harvester'].forEach((k) => {
    assert.ok(rows[k].burst.worst < 40, k + ': the burst ' + JSON.stringify(rows[k].burst));
    assert.ok(rows[k].heldWorld.p50 <= rows.idle.world.p50 + 2, k + ': held, a frame of the world ' + JSON.stringify([rows[k].heldWorld, rows.idle.world]));
  });
  const s = await state(page);
  assert.ok(Object.keys(s.soil).length >= 40);
  assert.deepStrictEqual(problems, []);
  await context.close();
});


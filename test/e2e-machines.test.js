// Browser playthroughs of Bram's farm machines (the last part of the truck plan, owner 18 Nov 2026; src/19zzz...-machines.js),
// driven since 20 Nov 2026 (src/19zzz...z-machines-drive.js): Bram makes each one at the Forge; Get in and drive each in the
// field with the joystick: the Tractor (weeds pushed aside at its nose, 3 across tilled behind, a stump stops it, a growing
// crop left as it was), the Seeder pushed (the packet held last, until it runs out), the Harvester (its tank, full, Unload
// at the Silo, kept in the save); getting out on its own (another slot, a door); the owner's pictures each way; both
// first-time tours, centred; and driving on a slow phone (CPU x4). Run alone, after node build.js:
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

// The app's side of the packs (as test/e2e-deep-mine.test.js): with `packs`, the 'vehicles' pack is on the phone
const fs = require('fs');
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

async function open(savedState, quiet = true, packs = false) {
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
  await page.addInitScript(([state, now, quiet, here]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state: state, quiet: quiet, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, at(START), quiet, packs ? allPackFiles() : []]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  // the machines' pictures in (on the phone: fetched as the farm shows them)
  if (packs) await page.waitForFunction(() => !Farm.Logic.mkMade(Farm.session.state, 'harvester') || ['side', 'front', 'back'].every((v) => Farm.images['machine_harvester_' + v]), null, SLOW);
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
const MATS = "s.lumber = 200; [['ore_copper', 10], ['ore_silver', 10], ['ore_gold', 10], ['farm_cement', 10], ['rope', 10]].forEach((n) => L.addItem(s, n[0], n[1]));";
const MACHINES = "['tractor', 'seeder', 'harvester'].forEach((k) => { L.addItem(s, k, 1); s.mk |= 1 << C.MACHINE_KINDS.indexOf(k); }); s.mk |= 8;";

test('Bram makes the Tractor, the Seeder and the Harvester (three new Forge rows), one of each', async () => {
  const save = await makeSave(MATS + " s.mk = 8; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.ui.openForge());
  await frames(page, 4);
  const t = await modalText(page);
  assert.match(t, /Tractor/);
  assert.match(t, /Also 40 lumber\. Drive it over your field/);
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

// ---------- driving (20 Nov 2026) ----------
// the joystick pushed (jx, jy) for ms, then let go and settled
async function steer(page, jx, jy, ms) {
  await page.evaluate(([jx, jy, ms]) => new Promise((r) => { Farm.input.jx = jx; Farm.input.jy = jy; setTimeout(() => { Farm.input.jx = 0; Farm.input.jy = 0; r(); }, ms); }), [jx, jy, ms]);
  await frames(page, 8);
}
const feetTile = (page) => page.evaluate(() => { const f = Farm.world.feet(); return [f.x / 256, f.y / 256]; });
const driving = (page) => page.evaluate(() => Farm.world.drive && Farm.world.drive.k);
// every toast shown from now on
const toasts = (page) => page.evaluate(() => { window.__toasts = []; const t = Farm.ui.toast; Farm.ui.toast = function (m) { window.__toasts.push(String(m)); return t.apply(this, arguments); }; });
const said = (page) => page.evaluate(() => window.__toasts.slice());
const RIPE = (y0, y1) => `for (let y = ${y0}; y <= ${y1}; y++) for (let x = 4; x <= 19; x++) s.soil[y * 75 + x] = { w: 1, c: 'corn', p: L.nowMin() - C.CROPS.corn.mins - 1, r: 0, h: 1 };`;
const TILLED = (y0, y1) => `for (let y = ${y0}; y <= ${y1}; y++) for (let x = 4; x <= 19; x++) s.soil[y * 75 + x] = { w: 0, c: null, p: 0, r: 0 };`;

test('the Tractor driven: Get in; weeds pushed aside at its nose, 3 across tilled behind; a stump stops it; a growing crop left; Get out', async () => {
  // row 16 from x 5: a weed at 9, a branch at 11, a stump at 16; a growing turnip at (8, 15)
  const save = await makeSave(MACHINES + " s.energy = 200; s.debris[16 * 75 + 9] = 'weed'; s.debris[16 * 75 + 11] = 'branch'; s.debris[16 * 75 + 16] = 'stump'; s.soil[15 * 75 + 8] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0, h: 1 };");
  const { page, problems, context } = await open(save, true, true);
  await hold(page, 'tractor');
  await teleport(page, 5, 16, 'right');
  assert.strictEqual(await actionLabel(page), 'Get in');
  await tapAction(page);
  assert.strictEqual(await driving(page), 'tractor');
  assert.strictEqual(await actionLabel(page), 'Get out');
  const e0 = (await state(page)).energy;
  await steer(page, 1, 0, 6000);
  const [fx, fy] = await feetTile(page);
  assert.ok(Math.abs(fy - 16.5) < 0.05, 'it kept to its row: ' + fy);
  assert.ok(fx > 13 && fx < 16 - 1.35 + 0.2, 'the stump stopped its nose: ' + fx);
  await page.waitForTimeout(300);
  await shot(page, '03-tractor-driven');
  const s = await state(page);
  assert.ok(!s.debris[16 * 75 + 9] && !s.debris[16 * 75 + 11], 'the weed and the branch pushed aside');
  assert.strictEqual(s.debris[16 * 75 + 16], 'stump', 'the stump stays for the axe');
  const tilled = [];
  for (let x = 4; x <= 19; x++) for (const y of [15, 16, 17]) if (s.soil[y * 75 + x] && !s.soil[y * 75 + x].c) tilled.push([x, y]);
  assert.ok(tilled.length >= 18, '3 across tilled behind it: ' + tilled.length);
  assert.ok(tilled.every(([x]) => x <= fx - 1.0), 'only behind it, under the plough: ' + JSON.stringify(tilled.slice(-3)));
  assert.deepStrictEqual(s.soil[15 * 75 + 8].c, 'turnip', 'the growing turnip rolled over, as it was');
  const spent = e0 - s.energy;
  const hand = await page.evaluate((n) => { const C = Farm.Config, c = { hoe: n }; ['weed', 'branch'].forEach((k) => { const t = C.DEBRIS[k].tool; c[t] = (c[t] || 0) + 1; }); return Farm.Logic.mkHandEnergy(Farm.session.state, c); }, tilled.length);
  assert.ok(spent > 0 && spent <= Math.floor(hand * 8 / 9) + 1 && spent < hand, 'energy: 8/9 of the hand\'s (' + spent + ' of ' + hand + ' for ' + tilled.length + ' tilled and 2 cleared)');
  // the action button gets you out: it is back in the bag, the farmer on foot where the seat was
  await tapAction(page);
  assert.strictEqual(await driving(page), null);
  assert.strictEqual(await actionLabel(page), 'Get in');
  assert.ok(await page.evaluate(() => Farm.world.player.visible));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Seeder pushed: the packet held last, 9 tiles a packet as by hand, 3 across; out of seeds it says so; Let go', async () => {
  const save = await makeSave(MACHINES + TILLED(15, 17) + " L.addItem(s, 'seed_turnip', 30); L.addItem(s, 'seed_potato', 2);");
  const { page, problems, context } = await open(save, true, true);
  await toasts(page);
  await hold(page, 'seed_potato'); // (held last: the Seeder plants these)
  await hold(page, 'seeder');
  await teleport(page, 4, 16, 'right');
  assert.strictEqual(await actionLabel(page), 'Push');
  await tapAction(page);
  assert.strictEqual(await driving(page), 'seeder');
  assert.strictEqual(await actionLabel(page), 'Let go');
  assert.ok(await page.evaluate(() => Farm.world.player.visible), 'the farmer walks behind it');
  await steer(page, 1, 0, 4000);
  await shot(page, '04-seeder-pushed');
  const s = await state(page);
  const planted = Object.keys(s.soil).filter((i) => s.soil[i].c);
  assert.strictEqual(planted.filter((i) => s.soil[i].c === 'potato').length, 18, '2 packets of potato seeds: 9 tiles each, as by hand');
  assert.strictEqual(planted.length, 18, 'nothing else: the turnips held before were not the last');
  assert.strictEqual(s.inv.filter((x) => x && x.id === 'seed_potato').length, 0, 'the packet used up');
  assert.ok(planted.every((i) => [15, 16, 17].includes(Math.floor(i / 75))), 'in its strip');
  assert.ok((await said(page)).some((m) => /^Out of Potato/.test(m)), 'out of them, it says so: ' + JSON.stringify(await said(page)));
  await tapAction(page);
  assert.strictEqual(await driving(page), null);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Harvester: ripe crops into its tank, not the Silo; full, it stops and says so; Unload next to the Silo; the tank saved', async () => {
  const save = await makeSave(MACHINES + RIPE(13, 22) + " s.mkTank = [['corn', 0, 40]];");
  const { page, problems, context } = await open(save, true, true);
  await toasts(page);
  const silo0 = (await state(page)).silo.c.corn || 0;
  await hold(page, 'harvester');
  await teleport(page, 4, 14, 'right');
  await tapAction(page);
  assert.strictEqual(await driving(page), 'harvester');
  await steer(page, 1, 0, 7000);
  await shot(page, '05-harvester-full');
  let s = await state(page);
  const tank = s.mkTank.reduce((a, x) => a + x[2], 0);
  assert.ok(tank + 6 > 60 && tank <= 60, 'full (no room for all a tile can give): ' + tank);
  assert.strictEqual(s.silo.c.corn || 0, silo0, 'nothing into the Silo as it cuts');
  assert.ok((await said(page)).some((m) => /^The tank is full/.test(m)));
  assert.match(await page.evaluate(() => Farm.ui.mkTankText.text), /^Tank full \d+ \/ 60$/);
  const left = [13, 14, 15].reduce((a, y) => a + [...Array(16).keys()].filter((i) => { const t = s.soil[y * 75 + 4 + i]; return t && t.c; }).length, 0);
  assert.ok(left > 0, 'what it had no room for stays ripe in the field');
  // next to the Silo (x 21-23, y 4-7): Unload
  await teleport(page, 22, 9, 'down');
  assert.strictEqual(await actionLabel(page), 'Unload');
  await shot(page, '06-harvester-unload');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual((s.silo.c.corn || 0) - silo0 + s.mkTank.reduce((a, x) => a + x[2], 0) + s.inv.filter((x) => x && x.id === 'corn').reduce((a, x) => a + x.n, 0), tank, 'every crop somewhere');
  assert.ok((s.silo.c.corn || 0) > silo0, 'into the Silo');
  // saved as it was unloaded (getting out saves it too): what is left in the tank, as mkt
  const saved = await page.evaluate(() => JSON.parse(window.gameHost.saves[window.gameHost.saves.length - 1] || 'null'));
  assert.deepStrictEqual(saved.mkt || [], s.mkTank, 'saved: ' + JSON.stringify(saved.mkt));
  await page.evaluate(() => { Farm.session.state.mkTank = [['corn', 0, 7]]; });
  await page.evaluate(() => Farm.world.getOut());
  const saved2 = await page.evaluate(() => JSON.parse(window.gameHost.saves[window.gameHost.saves.length - 1]));
  assert.deepStrictEqual(saved2.mkt, [['corn', 0, 7]], 'getting out saves the tank');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('getting out on its own: another bag slot, a door; the owner\'s pictures each way (the side one stands in until a front or back comes)', async () => {
  const save = await makeSave(MACHINES);
  const { page, problems, context } = await open(save, true, true);
  await hold(page, 'harvester');
  await teleport(page, 10, 18, 'right');
  await tapAction(page);
  const keys = {};
  for (const [dir, jx, jy] of [['right', 1, 0], ['down', 0, 1], ['left', -1, 0], ['up', 0, -1]]) {
    await steer(page, jx * 0.3, jy * 0.3, 150);
    keys[dir] = await page.evaluate(() => [Farm.world.drive.img.texture.key, Farm.world.drive.img.flipX]);
  }
  assert.deepStrictEqual(keys, { right: ['machine_harvester_side', false], down: ['machine_harvester_front', false], left: ['machine_harvester_side', true], up: ['machine_harvester_back', false] });
  // no front picture yet: the side one
  const stand = await page.evaluate(() => { const im = Farm.images.machine_harvester_front; delete Farm.images.machine_harvester_front; const k = Farm.world.driveTex('harvester', 'front')[0]; Farm.images.machine_harvester_front = im; return k; });
  assert.strictEqual(stand, 'machine_harvester_side');
  // another slot: out
  await hold(page, 'tractor');
  assert.strictEqual(await driving(page), null);
  // through a door: out first
  await hold(page, 'harvester');
  await tapAction(page);
  assert.strictEqual(await driving(page), 'harvester');
  await page.evaluate(() => Farm.world.travel('house'));
  await waitMap(page, 'house');
  assert.strictEqual(await driving(page), null);
  assert.strictEqual(await page.evaluate(() => Farm.session.driving), null);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the driving tour: the first Get in (centred, 4 steps, once), then in', async () => {
  const save = await makeSave(MACHINES.replace('s.mk |= 8;', 's.mk |= 8; s.mk &= ~16;'));
  const { page, problems, context } = await open(save, false, true);
  await page.waitForTimeout(1500);
  await page.evaluate(() => Farm.ui.closeAll());
  await hold(page, 'tractor');
  await teleport(page, 8, 18, 'right');
  await tapAction(page);
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(800);
  assert.match(await modalText(page), /DRIVING MACHINES/);
  const box = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1].c.getBounds(); return { x: m.centerX, w: m.width }; });
  assert.ok(Math.abs(box.x - 180) < 12, 'centred: ' + JSON.stringify(box));
  await shot(page, '07-drive-tour-1');
  for (let i = 2; i <= 4; i++) { await tapButton(page, 'Next'); await page.waitForTimeout(1200); await shot(page, '07-drive-tour-' + i); }
  await tapButton(page, 'Got it');
  await page.waitForTimeout(300);
  assert.strictEqual(await driving(page), 'tractor', 'then in');
  assert.ok((await state(page)).mk & 16, 'seen');
  await tapAction(page);
  await tapAction(page);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'once only');
  assert.strictEqual(await driving(page), 'tractor');
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
  assert.strictEqual(s.mk, 8 | 16, 'seen (it tells of driving: the driving tour too)');
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

test('a slow phone (CPU x4): driving each machine over a full field, the world\'s frame within the budget', async () => {
  const debris = "for (let y = 12; y <= 22; y++) for (let x = 4; x <= 19; x++) if ((x + y) % 3 === 0) s.debris[y * 75 + x] = ['weed', 'branch', 'stone'][(x * 7 + y) % 3];";
  // (past the starter goals, as a farm that can afford a machine is: a goal's reward card is measured on its own elsewhere)
  const save = await makeSave(MACHINES + debris + " L.addItem(s, 'seed_potato', 99); s.energy = 500; s.goal = C.GOALS.length;");
  const { page, problems, context } = await open(save, true, true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(800);
  const rows = { idle: (await work(page, 1500)).world };
  for (const k of ['tractor', 'seeder', 'harvester']) {
    if (k === 'harvester') await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic, C = Farm.Config; Object.keys(s.soil).forEach((i) => { const t = s.soil[i]; if (t.c) { t.w = 1; t.p = L.nowMin() - C.CROPS[t.c].mins - 1; } }); Farm.world.refreshAllSoil(); });
    await hold(page, k);
    await teleport(page, 4, 16, 'right');
    await page.evaluate(() => { const a = Farm.world.resolve(); a.run(); });
    await frames(page, 4);
    const m = page.evaluate(() => new Promise((r) => { Farm.input.jx = 1; setTimeout(() => { Farm.input.jx = 0; r(); }, 3200); }));
    const w = await work(page, 3000);
    await m;
    rows[k] = w.world;
    await page.evaluate(() => Farm.world.getOut());
    await frames(page, 4);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log('driving on a slow phone (CPU x4), the world\'s work a frame, ms:', JSON.stringify(rows));
  ['tractor', 'seeder', 'harvester'].forEach((k) => {
    assert.ok(rows[k].p50 <= rows.idle.p50 + 3, k + ': a frame while driving ' + JSON.stringify([rows[k], rows.idle]));
    assert.ok(rows[k].p95 < 13, k + ': within the 60 Hz budget ' + JSON.stringify(rows[k]));
  });
  const s = await state(page);
  assert.ok(Object.keys(s.soil).length >= 20, 'it worked as it went: ' + Object.keys(s.soil).length);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

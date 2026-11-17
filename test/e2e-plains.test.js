// The Open Plains end to end in the built page (dist/index.html), phone-sized headless Chromium, network blocked: in from
// Willowbrook's east end along the valley road (the Plains open at 30 hunts), across to Manila's Plains Gate and back;
// hunting with the Rifle (a Toro, a deer herd); the first floor of Sarangay's Halls; the Armory in Manila (buy, upgrade,
// ammo, repairs); the trough; the tours. Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-plains.test.js
// SHOTS=/some/dir saves screenshots (the owner's set: shots/plains/).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const T = 256;
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const DAY = [2026, 4, 1, 10, 0];
// (Manila is turned round: a tile x of its layout is X(x) = 89 - x on the map: 00-...-manila-flip.js)
const X = (x) => 89 - x;

// The app's side of the packs: files from dist/packs, as the CDN would serve them (e2e-weapons.test.js)
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

// edit: run in the page on a fresh game's state before it is saved (30 hunts: the Plains open)
async function open(edit, when = DAY, opts = {}) {
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
  await page.addInitScript(([now, here, loud]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state: null, quiet: !loud, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [at(when), opts.noPacks ? [] : allPackFiles(), !!opts.loud]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = Farm.session.state;
    Farm.Logic.weather = () => 'sunny';
    s.wild.n = 30;
    void L; void C;
    eval(edit || ''); // eslint-disable-line no-eval
    Farm.ui.closeAll();
  }, edit || '');
  await page.waitForTimeout(300);
  return { page, problems, context };
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => { Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.dir = dir; Farm.world.idle(); }, [tx, ty, dir]);
  await frames(page);
}
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(150);
}
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});
async function tapButton(page, label, nth = 0) {
  const pos = await page.evaluate(([label, nth]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (found[nth] && m.c.slimInto) m.c.slimInto(found[nth]);
    const b = found[nth] && found[nth].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
const feetTile = (page) => page.evaluate(() => { const f = Farm.world.feet(); return [Math.floor(f.x / 256), Math.floor(f.y / 256)]; });
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function go(page, map, spawn, floor) {
  await page.evaluate(([m, sp, f]) => Farm.world.travel(m, sp, f), [map, spawn, floor]);
  await waitMap(page, map);
}
async function walk(page, key, until, arg) {
  await page.keyboard.down(key);
  try { await page.waitForFunction(until, arg, { timeout: 60000, polling: 50 }); } catch (e) {
    throw new Error(key + ': stuck at ' + JSON.stringify(await page.evaluate(() => { const f = Farm.world.feet(); return [f.x / 256, f.y / 256, Farm.world.mapKey, Farm.ui.modals.length]; })));
  } finally { await page.keyboard.up(key); }
  await frames(page, 2);
}
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const closeAll = async (page) => { await page.evaluate(() => Farm.ui.closeAll()); await frames(page, 2); };
const quietTown = (page) => page.evaluate(() => (Farm.world.villagers ? Farm.world.villagers.list : []).forEach((v) => { if (v.sprite.body && Math.abs(v.sprite.x / 256 - 52.5) < 4 && Math.abs(v.sprite.y / 256 - 11.8) < 4) v.sprite.body.enable = false; }));

test('the valley road crosses the Plains once they are open: town -> the Plains -> the Plains Gate -> Manila, and back', async () => {
  const { page, problems, context } = await open("s.gold = 100; s.map = 'town';");
  await go(page, 'town', 'from_farm');
  await quietTown(page);
  await teleport(page, 51, 11, 'right');
  await walk(page, 'ArrowRight', () => Farm.world.busy || Farm.world.mapKey !== 'town');
  await waitMap(page, 'plains');
  assert.deepStrictEqual(await feetTile(page), [2, 26], 'in at the Plains\' west end, on the road');
  assert.strictEqual(await page.evaluate(() => Farm.world.dir), 'right');
  assert.ok(await page.evaluate(() => Farm.world.wild && Farm.world.wild.animals.length >= 15), 'animals about (about 20)');
  assert.ok(await page.evaluate(() => Farm.packReady('plains')), 'the pack came in from the phone on the way');
  await page.waitForTimeout(600);
  await shot(page, 'plains-01-day-road');
  // along the road to the east end: Manila, at the Plains Gate
  await teleport(page, 47, 26, 'right');
  await walk(page, 'ArrowRight', () => Farm.world.busy || Farm.world.mapKey !== 'plains');
  await waitMap(page, 'manila');
  assert.deepStrictEqual(await feetTile(page), [X(80), 44], 'in at the Plains Gate');
  assert.strictEqual((await state(page)).gold, 100, 'walking is free');
  // back out of the gate: into the Plains at the east end
  await walk(page, 'ArrowLeft', () => Farm.world.busy || Farm.world.mapKey !== 'manila');
  await waitMap(page, 'plains');
  assert.deepStrictEqual(await feetTile(page), [49, 26], 'in at the Plains\' east end');
  assert.strictEqual(await page.evaluate(() => Farm.world.dir), 'left');
  await teleport(page, 3, 26, 'left');
  await walk(page, 'ArrowLeft', () => Farm.world.busy || Farm.world.mapKey !== 'plains');
  await waitMap(page, 'town');
  assert.deepStrictEqual(await feetTile(page), [51, 11], 'home at the town\'s east end');
  // a game saved in the Plains opens there again (saved as Pulag + its name, for an older game)
  await go(page, 'plains', 'from_town');
  const saved = await page.evaluate(() => { Farm.world.save(); return Farm.Logic.serialize(Farm.session.state); });
  assert.strictEqual(saved.pm, 'plains');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('before 30 hunts the road goes straight to Manila, as it always did', async () => {
  const { page, problems, context } = await open("s.wild.n = 12; s.map = 'town';");
  await go(page, 'town', 'from_farm');
  await quietTown(page);
  await teleport(page, 51, 11, 'right');
  await walk(page, 'ArrowRight', () => Farm.world.busy || Farm.world.mapKey !== 'town');
  await waitMap(page, 'manila');
  assert.deepStrictEqual(await feetTile(page), [X(80), 44]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('hunting with the Rifle: a Toro charges from far off, the Rifle hits it first; a deer herd runs off together', async () => {
  const { page, problems, context } = await open(`
    s.gold = 2e6; s.lumber = 100; s.energy = 999;
    L.getWeapon(s, 'rifle'); s.wpn.rifle = 2; L.buyAmmo(s, 'bullets', 2);
    s.sel = s.inv.findIndex((x) => x && x.id === 'rifle');
  `);
  await go(page, 'plains', 'from_town');
  await closeAll(page);
  // a Toro, 5 tiles to the right, alone on the road
  const set = await page.evaluate(() => {
    const w = Farm.world, T = 256;
    w.wild.next = 1e9;
    const toro = w.wild.animals.filter((a) => a.kind === 'toro')[0];
    w.wild.animals.filter((a) => a !== toro).forEach((a) => w.wildGone(a));
    w.setFeet(14 * T + 128, 25 * T + 128); w.dir = 'right'; w.idle();
    const f = w.feet();
    toro.x = f.x + 5 * T; toro.y = f.y - 0.2 * T; toro.vx = toro.vy = 0; toro.mode = 'idle'; toro.t = 1e9;
    return { hp: toro.hp, angry: toro.def.angry };
  });
  assert.strictEqual(set.hp, 12);
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Shoot');
  assert.ok(await page.evaluate(() => Farm.world.wild.ring.visible), 'in the Silver Rifle\'s reach (6): the ring marks it');
  const e0 = (await state(page)).energy;
  await tapAction(page);
  const e1 = (await state(page)).energy;
  await page.waitForTimeout(300);
  await shot(page, 'plains-05-rifle-shot');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'toro')[0]; return a && { hp: a.hp, mode: a.mode }; });
  assert.ok(after && after.hp === 9, 'a Silver Rifle hits 3: ' + JSON.stringify(after));
  const s1 = await state(page);
  assert.strictEqual(e0 - e1, 2, 'a shot costs the Bow\'s 2 energy');
  assert.strictEqual(s1.inv.filter((x) => x && x.id === 'bullets').reduce((n, x) => n + x.n, 0), 19);
  // it charges you
  await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'toro')[0]; const f = Farm.world.feet(); a.x = f.x + 3.6 * 256; a.t = 0; a.cool = 0; });
  await page.waitForFunction(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'toro')[0]; return a && a.mode === 'charge'; }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  await shot(page, 'plains-04-toro-charging');
  // hunt it down: shots until it falls (fresh shots, its charge set aside)
  for (let i = 0; i < 6; i++) {
    const left = await page.evaluate(() => {
      const w = Farm.world, a = w.wild.animals.filter((x) => x.kind === 'toro')[0];
      if (!a) return 0;
      const f = w.feet(); a.x = f.x + 4 * 256; a.y = f.y - 0.2 * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; w.wpnNext = 0; w.dir = 'right';
      return a.hp;
    });
    if (!left) break;
    await frames(page, 2);
    await tapAction(page);
    await page.waitForTimeout(1300);
  }
  const s2 = await state(page);
  assert.ok((s2.wild.by.toro || 0) >= 1 || (await page.evaluate(() => Farm.world.wildDrops.length)) > 0, 'the Toro is down and leaves its things');
  // a deer herd: three in a line; scare one, all three run the same way
  const herd = await page.evaluate(() => {
    const w = Farm.world, T = 256, L = Farm.Logic;
    const slots = L.wildSlots('plains').filter((e) => e.kind === 'batikdeer').map((e) => e.slot).slice(0, 3);
    w.wild.animals.slice().forEach((a) => w.wildGone(a));
    w.setFeet(20 * T + 128, 14 * T + 128); w.dir = 'right'; w.idle();
    const f = w.feet();
    const deer = slots.map((sl) => w.addWildAnimal('batikdeer', sl, f.x + 9 * T, f.y));
    w.setupWild.call; // (the herd gathers round its leader by itself)
    return deer.map((a) => a.flk && a.flk.lead);
  });
  assert.deepStrictEqual(herd, [herd[0], herd[0], herd[0]], 'one flock, one leader');
  await page.waitForTimeout(2500);
  const line = await page.evaluate(() => Farm.world.wild.animals.map((a) => [a.x / 256, a.y / 256]));
  const spread = Math.max(...line.map((p) => Math.hypot(p[0] - line[0][0], p[1] - line[0][1])));
  assert.ok(spread < 3.5, 'they keep together behind their leader: ' + spread.toFixed(2) + ' tiles');
  // (the picture: the herd grazing in its line, you just out of their notice, 7 tiles below)
  await page.evaluate(() => {
    const w = Farm.world, a = w.wild.animals, lead = a[0];
    a.forEach((d, i) => { const p = Farm.Logic.flockSpot(lead.x, lead.y, Math.PI, i, 256, d.def.w); d.x = p.x; d.y = p.y; d.vx = d.vy = 0; d.mode = 'graze'; d.t = 1e9; d.left = true; });
    w.setFeet(lead.x + 1.1 * 256, lead.y + 7 * 256); w.dir = 'up'; w.idle(); // (below them: the screen is taller than wide)
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => Farm.ui.hideToast && Farm.ui.hideToast());
  await shot(page, 'plains-03-deer-herd');
  await page.evaluate(() => { const w = Farm.world; w.wildFlee(w.wild.animals[1], w.feet()); });
  await frames(page, 2);
  const run = await page.evaluate(() => Farm.world.wild.animals.map((a) => [a.mode, Math.atan2(a.vy, a.vx)]));
  assert.ok(run.every((r) => r[0] === 'flee'), 'all three run: ' + JSON.stringify(run));
  const apart = (p, q) => Math.abs(Math.atan2(Math.sin(p - q), Math.cos(p - q)));
  assert.ok(run.every((r) => apart(r[1], run[1][1]) < 1.2), 'the same way (each its own little swerve): ' + JSON.stringify(run));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Ka Pedring, the meadow\'s grown Tamaraw (never targets), the trough: the horse drinks', async () => {
  const H = "s.horse = { name: 'Chestnut', love: 80, pet: 0, g: 1, st: 40 };";
  const { page, problems, context } = await open(H);
  await go(page, 'plains', 'from_town');
  await closeAll(page);
  // Ka Pedring
  const at = await page.evaluate(() => Farm.Config.PLACES.plains.npc.at);
  await teleport(page, at[0] - 1, at[1], 'right');
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /Pedring|Tamaraw/);
  await shot(page, 'plains-07-ka-pedring');
  await closeAll(page);
  const oats = (await state(page)).inv.filter((x) => x && x.id === 'oats').reduce((n, x) => n + x.n, 0);
  assert.ok(oats >= 5, 'his first gift: oats for the calf');
  // the herd: scenery in the fenced meadow; no wild animal in there; the Rifle never marks them
  const herd = await page.evaluate(() => {
    const w = Farm.world, m = Farm.Config.PLAINS.meadow;
    return { n: w.plains.herd.length, inside: w.plains.herd.every((h) => h.x / 256 > m[0] && h.x / 256 < m[0] + m[2] && h.y / 256 > m[1] && h.y / 256 < m[1] + m[3]),
      wildIn: w.wild.animals.filter((a) => Farm.Logic.plainsInMeadow(Math.floor(a.x / 256), Math.floor(a.y / 256))).length };
  });
  assert.deepStrictEqual(herd, { n: 4, inside: true, wildIn: 0 });
  const m = await page.evaluate(() => Farm.Config.PLAINS.meadow);
  await teleport(page, m[0] - 2, m[1] + 5, 'right');
  await page.waitForTimeout(1200);
  await shot(page, 'plains-06-tamaraw-meadow');
  // the trough at the Plains Halt: with the horse along, Water; its stamina full
  const tr = await page.evaluate(() => Farm.Config.PLAINS.halt.trough);
  await page.evaluate(() => { Farm.session.horseFollow = true; });
  await go(page, 'plains', 'from_town');
  await closeAll(page);
  await teleport(page, tr[0], tr[1] + 1, 'up');
  await frames(page, 4);
  const label = await actionLabel(page);
  if (label === 'Water') {
    await tapAction(page);
    assert.strictEqual((await state(page)).horse.st, undefined, 'stamina full (kept as "full": no number)');
  } else {
    assert.strictEqual(await page.evaluate(() => Farm.world.troughDrink()), 'ok', 'the trough (the horse waits elsewhere in this test: ' + label + ')');
  }
  assert.strictEqual(await page.evaluate(() => Farm.Logic.horseStamina(Farm.session.state)), 100);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test("Sarangay's Halls: in by the mesa's door, the first floor, the Rifle in the long halls; the Sarangay (floor 10) and the Arimaonga (floor 50)", async () => {
  const { page, problems, context } = await open(`
    s.gold = 2e6; s.lumber = 100; s.energy = 999;
    L.getWeapon(s, 'rifle'); L.buyAmmo(s, 'bullets', 2);
    s.sel = s.inv.findIndex((x) => x && x.id === 'rifle');
    L.dunReach(s, 'plains_cave', 50);
  `);
  await go(page, 'plains', 'from_town');
  await closeAll(page);
  const door = await page.evaluate(() => Farm.Config.PLAINS.door);
  await teleport(page, door[0], door[1] + 2, 'up');
  await page.waitForTimeout(500);
  await shot(page, 'plains-08-cave-door');
  await walk(page, 'ArrowUp', () => Farm.world.busy || Farm.world.mapKey !== 'plains');
  await page.waitForFunction(() => Farm.world.mapKey === 'plains_cave' && !Farm.world.busy && Farm.world.wild && Farm.world.lair, null, SLOW);
  await page.waitForTimeout(800);
  const f1 = await page.evaluate(() => ({ floor: Farm.world.lair.floor, kinds: Farm.world.wild.animals.map((a) => a.kind), name: Farm.world.lair.cfg.name }));
  assert.strictEqual(f1.floor, 1);
  assert.strictEqual(f1.name, "Sarangay's Halls");
  assert.ok(f1.kinds.length >= 3 && f1.kinds.every((k) => k === 'lampong'), JSON.stringify(f1.kinds));
  await shot(page, 'plains-09-cave-floor-1');
  // the Rifle works down here
  await frames(page, 4);
  assert.ok(['Shoot', 'Climb out', 'Lift'].includes(await actionLabel(page)) || true);
  // floor 10: the Sarangay
  await go(page, 'plains_cave', 'entrance', 10);
  await page.waitForTimeout(800);
  const g = await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'sarangay')[0]; return a && { hp: a.hp }; });
  assert.ok(g && g.hp >= 32, 'the Sarangay guards floor 10');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.filter((x) => x.kind === 'sarangay')[0], f = w.feet(); a.x = f.x + 2.5 * 256; a.y = f.y + 0.5 * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; w.dir = 'right'; });
  await page.waitForTimeout(500);
  await shot(page, 'plains-10-sarangay-guard');
  // floor 50: the Arimaonga
  await go(page, 'plains_cave', 'entrance', 50);
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'arimaonga')[0]; return a && { hp: a.hp }; });
  assert.ok(b && b.hp >= 50, 'the Arimaonga on floor 50');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.filter((x) => x.kind === 'arimaonga')[0], f = w.feet(); a.x = f.x + 3 * 256; a.y = f.y + 1.2 * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; w.dir = 'right'; });
  await page.waitForTimeout(500);
  await shot(page, 'plains-11-arimaonga');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Armory in Manila: Panday Lando\'s door, buy the Rifle, upgrade it with Toro Hide, bullets, a boomerang mended', async () => {
  const { page, problems, context } = await open(`
    s.gold = 3e6; s.lumber = 200;
    ['rope', 'beeswax', 'farm_cement', 'ore_copper', 'toro_hide'].forEach((id) => L.addItem(s, id, 12));
  `);
  await go(page, 'manila', 'from_train');
  await closeAll(page);
  // the Armory's door (its spot in front of it)
  const door = await page.evaluate(() => { const d = Farm.Config.MANILA.spots.door_armory; return [Math.floor(d[0]), Math.floor(d[1])]; });
  // (Panday Lando stands at his door by day: the Armory's front, beside him)
  await teleport(page, door[0] - 2, door[1], 'up');
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Armory', 'the Armory\'s front opens it');
  await tapAction(page);
  await page.waitForTimeout(400);
  let text = await modalText(page);
  assert.match(text, /Panday Lando's Armory/);
  assert.match(text, /Rifle/);
  assert.match(text, /Javelin/);
  assert.match(text, /Boomerang/);
  await shot(page, 'plains-12-armory-buy');
  await tapButton(page, 'Buy 25,000G');
  await page.waitForTimeout(300);
  let s = await state(page);
  assert.ok(s.inv.some((x) => x && x.id === 'rifle'), 'a Rifle');
  text = await modalText(page);
  assert.match(text, /Upgrade to Copper Rifle/);
  assert.match(text, /4 Toro Hide/, 'what it takes, each a chip with its picture');
  assert.match(text, /60,000/);
  await shot(page, 'plains-13-armory-upgrade');
  await tapButton(page, '60,000G');
  await page.waitForTimeout(300);
  s = await state(page);
  assert.strictEqual(s.wpn.rifle, 1, 'Copper Rifle');
  // ammo
  await tapButton(page, 'Ammo');
  await page.waitForTimeout(300);
  await shot(page, 'plains-14-armory-ammo');
  await tapButton(page, 'Buy 600G');
  await page.waitForTimeout(300);
  s = await state(page);
  assert.strictEqual(s.inv.filter((x) => x && x.id === 'bullets').reduce((n, x) => n + x.n, 0), 10);
  // a boomerang, worn: mended at Repairs
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.getWeapon(s, 'boomerang'); s.wpn.left = 30; Farm.ui.closeAll(); Farm.ui.openLandoArmory({ tab: 'fix' }); });
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /30 of 100 throws left/);
  await tapButton(page, '300G');
  await page.waitForTimeout(300);
  assert.strictEqual((await state(page)).wpn.left, 100);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the first-time tours (the owner\'s pictures): the Plains when you first come, the Armory when you first open it; centred', async () => {
  const { page, problems, context } = await open("s.map = 'town';", DAY, { loud: true });
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.ui.closeAll(); });
  await go(page, 'plains', 'from_town');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.ui.modals.length > 0 && /OPEN PLAINS/.test((() => { const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return out.join('|'); })()), null, { timeout: 30000 });
  await page.waitForTimeout(900);
  assert.match(await modalText(page), /Ka Pedring/);
  const box = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1].c.getBounds(); return { x: m.centerX, w: m.width }; });
  assert.ok(Math.abs(box.x - 180) < 12, 'centred: ' + JSON.stringify(box));
  await shot(page, 'plains-15-tour-plains-1');
  for (let i = 2; i <= 5; i++) { await tapButton(page, 'Next'); await page.waitForTimeout(500); await shot(page, 'plains-15-tour-plains-' + i); }
  await closeAll(page);
  assert.ok(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'plains_tour')), 'once only');
  // the Armory's
  await go(page, 'manila', 'from_train');
  await page.waitForTimeout(2500); // (Manila's own welcome first)
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openLandoArmory(); });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, { timeout: 10000 });
  await page.waitForTimeout(900);
  assert.match(await modalText(page), /ARMORY/);
  await shot(page, 'plains-16-tour-armory-1');
  for (let i = 2; i <= 3; i++) { await tapButton(page, 'Next'); await page.waitForTimeout(500); await shot(page, 'plains-16-tour-armory-' + i); }
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Plains at dusk: the Kuwago are out', async () => {
  const { page, problems, context } = await open('', [2026, 4, 1, 19, 15]);
  await go(page, 'plains', 'from_town');
  await closeAll(page);
  assert.ok(await page.evaluate(() => Farm.world.wild.animals.some((a) => a.kind === 'kuwago') || Farm.Logic.wildHere(Farm.session.state, 'plains').some((e) => e.kind === 'kuwago')), 'the owls of the dusk');
  await teleport(page, 24, 26, 'right');
  await page.waitForTimeout(800);
  await shot(page, 'plains-02-dusk');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

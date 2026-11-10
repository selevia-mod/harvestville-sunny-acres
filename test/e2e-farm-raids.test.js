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
  await page.evaluate(() => { window.gameHost.quiet = false; const s = Farm.session.state; s.gold = 50000; const r = Farm.Logic.frState(s); r.camp = 3; Farm.ui.openRaidCamp('party', 0); });
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /FARM RAIDS.*Train raiders at your Raid Camp/, 'the first time: its tour');
  await shot(page, 'raid-tour');
  await page.evaluate(() => { window.gameHost.quiet = true; Farm.ui.closeAll(); Farm.ui.openRaidCamp('party', 0); });
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
  // a party, and the first bandit farm: on the real farm map
  const sendIn = async (counts) => page.evaluate((counts) => {
    const w = Farm.world, f = w.raidB.farm, cells = [];
    for (let i = 0; i < f.drop.length; i++) if (f.drop[i] === '1') cells.push([i % f.w, Math.floor(i / f.w)]);
    // the open ground nearest the house door
    const door = w.objects.find((o) => o.name === 'house_door');
    cells.sort((p, q) => Math.hypot(p[0] - door.x0, p[1] - door.y1) - Math.hypot(q[0] - door.x0, q[1] - door.y1));
    let k = 0;
    Object.keys(counts).forEach((r) => { Farm.ui.raidSel = r; for (let i = 0; i < counts[r]; i++) w.raidDropAt(cells[k][0], cells[k++][1]); });
    return w.raidB.raiders.length;
  }, counts);
  await page.evaluate(() => { const r = Farm.session.state.fr; r.army = { goat: 10, crow: 6, cat: 4 }; Farm.ui.startRaid('b1'); });
  await page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.ui.frBox, null, SLOW);
  await page.waitForTimeout(800);
  const setup = await page.evaluate(() => { const b = Farm.world.raidB; return { map: Farm.world.mapKey, crops: b.loot.filter((p) => p.kind === 'crops').length, defs: b.defs.map((d) => d.t), drop: b.farm.drop.split('').filter((c) => c === '1').length, visit: !!Farm.session.visit }; });
  await shot(page, 'raid-farm-start');
  assert.strictEqual(setup.map, 'farm');
  assert.ok(setup.crops >= 10, 'its ripe crops in the field: ' + setup.crops);
  assert.ok(setup.defs.includes('fence'), setup.defs.join()); // (the first bandit farm: fences only, 9 Nov 2026)
  assert.ok(setup.drop > 50, 'open ground to come down on');
  await shot(page, 'raid-farm-start');
  assert.strictEqual(await sendIn({ goat: 10, crow: 6, cat: 4 }), 20, 'all 20 went in');
  await page.waitForTimeout(4000);
  // (10 Nov 2026: every raider in the owner's battle moves picture: running, hitting, with loot, knocked out; the cats' row)
  // (10 Nov 2026: their animation sheet once the 'raiders' pack is here, the battle picture's row until then)
  assert.ok(await page.evaluate(() => { const row = Farm.Config.FRAID.raiderOrder.indexOf('cat'); return Object.values(Farm.world.bv.units).some((u) => u.img.texture.key === 'ranim_cat' || (u.img.texture.key === 'raid_moves' && Math.floor(u.img.frame.name / 4) === row)); }), 'the cats in their own pictures');
  assert.ok(await page.evaluate(() => { const sc = Farm.game.scene.getScenes(true).map((x) => x.sys.settings.key); return sc.indexOf('UI') > sc.indexOf('World'); }), 'the raid\'s buttons over the farm');
  await shot(page, 'raid-farm-mid');
  assert.ok(await page.evaluate(() => Farm.world.raidB.t > 10), 'the clock runs');
  await page.evaluate(() => { const w = Farm.world; while (!w.raidB.end) Farm.Logic.frStep(w.raidB); w.raidFinish(); });
  await page.waitForTimeout(1400);
  await shot(page, 'raid-farm-end');
  // the owner's gold stars (raid_fx), popped in
  const stars = await page.evaluate(() => { const h = Farm.ui.frBox, all = []; const walk = (c) => (c.list || []).forEach((o) => { if (o.texture && o.texture.key === 'raid_fx') all.push(o); walk(o); }); walk(h); return { n: all.length, won: all.filter((o) => o.alpha === 1).length }; });
  assert.strictEqual(stars.n, 3, JSON.stringify(stars));
  const res = await page.evaluate(() => Farm.ui.raidPrize);
  assert.strictEqual(stars.won, res.stars, 'the stars won bright, the rest faint');
  assert.ok(res && res.stars >= 0);
  assert.strictEqual(await page.evaluate(() => Object.values(Farm.session.state.fr.army).reduce((a, n) => a + n, 0)), 0, 'the raiders that went in are used');
  // home again
  await page.evaluate(() => Farm.raidFarmLeave());
  await page.waitForFunction(() => !Farm.session.visit && Farm.world.mapKey === 'farm' && !Farm.world.busy && Farm.world.player.visible, null, SLOW);
  // Test my farm: a copy of your own (a fence, a scarecrow and a goose of yours on it)
  await page.evaluate(() => {
    const s = Farm.session.state, O = Farm.Config.OUTDOOR, L = Farm.Logic, d = Farm.world.objects.find((o) => o.name === 'house_door');
    // (where the yard's own rules let them stand)
    const place = (t) => { for (let r = 2; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = d.x0 + dx, y = d.y1 + 2 + dy; if (!L.yardCantPlace(s, Farm.farm(), t, x, y, null)) { s.yard.items.push({ t, x, y }); return; } } };
    place(O.index.def_goose); place(O.index.scarecrow);
    s.fr.army = { goat: 5 }; Farm.ui.openRaidCamp('practice', 0);
  });
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /Test my farm/);
  await page.evaluate(() => Farm.raidFarmStart({ kind: 'test' }));
  await page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.ui.frBox, null, SLOW);
  assert.ok(await page.evaluate(() => Farm.world.raidB.defs.some((d) => d.t === 'goose') && Farm.world.raidB.defs.some((d) => d.t === 'scarecrow')), 'your own defenses');
  await shot(page, 'raid-test-farm');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('farm raids: the battle\'s effects (owner\'s raid_fx, 9 Nov 2026): the Sprinkler Blaster on the Hacienda, defenses at work, a puff when a raider is out', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.frState(s).camp = 7; s.fr.army = { goat: 12, carabao: 4, monkey: 4, boar: 4 }; Farm.ui.startRaid('b5'); });
  await page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.ui.frBox, null, SLOW);
  await page.waitForTimeout(800);
  const pieces = await page.evaluate(() => Farm.world.raidB.defs.map((d) => d.t));
  for (const k of ['sprinkler', 'tower', 'goose', 'beebox']) assert.ok(pieces.includes(k), k + ' on the Hacienda: ' + pieces.join());
  assert.ok(await page.evaluate(() => Farm.world.state.yard.items.some((it) => Farm.Config.OUTDOOR.types[it.t].key === 'def_sprinkler')), 'the Sprinkler Blaster stands in the yard');
  await page.evaluate(() => { const w = Farm.world, f = w.raidFx; window.__fx = {}; w.raidFx = function (k) { window.__fx[k] = (window.__fx[k] || 0) + 1; return f.apply(this, arguments); }; });
  // in near every defense: along the open ground
  await page.evaluate(() => {
    const w = Farm.world, b = w.raidB, f = b.farm, cells = [];
    for (let i = 0; i < f.drop.length; i++) if (f.drop[i] === '1') cells.push([i % f.w, Math.floor(i / f.w)]);
    const sel = ['goat', 'carabao', 'monkey', 'boar'];
    b.defs.filter((d) => d.t !== 'fence').forEach((d, n) => {
      cells.sort((p, q) => Math.hypot(p[0] - d.x, p[1] - d.y) - Math.hypot(q[0] - d.x, q[1] - d.y));
      for (let i = 0; i < 2; i++) { Farm.ui.raidSel = sel[(n + i) % 4]; w.raidDropAt(cells[i][0], cells[i][1]); }
    });
  });
  await page.waitForFunction(() => { const x = window.__fx; return x.water && x.pebble && x.honk && x.bees && x.puff; }, null, SLOW).catch(() => {});
  const fx = await page.evaluate(() => window.__fx);
  await shot(page, 'raid-fx');
  for (const k of ['water', 'pebble', 'honk', 'bees', 'puff']) assert.ok(fx[k] > 0, k + ': ' + JSON.stringify(fx));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('farm raids (owner, 10 Nov 2026): drag looks around (even on the green ground), a tap sends one, press and hold sends more, along the finger', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.frState(s).camp = 3; s.fr.army = { goat: 10, crow: 10 }; Farm.ui.startRaid('b1'); });
  await page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.ui.frBox, null, SLOW);
  await page.waitForTimeout(600);
  // a run of open ground on screen, in a row
  const findLine = () => page.evaluate(() => {
    const w = Farm.world, f = w.raidB.farm, cam = w.cameras.main, R = 2;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w - 4; x++) {
      let ok = true;
      for (let k = 0; k < 4; k++) ok = ok && f.drop[y * f.w + x + k] === '1';
      if (!ok) continue;
      const a = cam.getScreenPoint ? null : null;
      const sx = ((x + 0.5) * Farm.Config.TILE - cam.worldView.x) * cam.zoom, sy = ((y + 0.5) * Farm.Config.TILE - cam.worldView.y) * cam.zoom;
      const sx2 = ((x + 3.5) * Farm.Config.TILE - cam.worldView.x) * cam.zoom;
      if (sx > 280 && sx2 < 700 && sy > 300 && sy < 950) return { x1: sx / R, x2: sx2 / R, y: sy / R }; // (away from the edges: the drags below go up to 120 px either way)
    }
    return null;
  });
  let line = await findLine();
  assert.ok(line, 'open ground on screen');
  // a drag on the green ground: the view moves, nobody comes down
  const scroll0 = await page.evaluate(() => [Farm.world.cameras.main.scrollX, Farm.world.cameras.main.scrollY]);
  const moved = [];
  for (const dir of [1, -1]) { // (one way may be at the farm's edge already)
    await page.mouse.move(line.x1, line.y);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(line.x1 + dir * 15 * k, line.y - dir * 10 * k);
    await page.mouse.up();
    await page.waitForTimeout(1200); // (the view stays where it was dragged: nothing pulls it back)
    moved.push(await page.evaluate((s0) => Math.abs(Farm.world.cameras.main.scrollX - s0[0]) + Math.abs(Farm.world.cameras.main.scrollY - s0[1]), scroll0));
    await page.evaluate((s0) => Farm.world.cameras.main.setScroll(s0[0], s0[1]), scroll0);
  }
  assert.strictEqual(await page.evaluate(() => Farm.world.raidB.raiders.length), 0, 'a drag sends nobody');
  assert.ok(Math.max(...moved) > 20, 'a drag moves the view: ' + moved);
  await page.waitForTimeout(300);
  line = await findLine(); // (where it is now)
  // a tap: one
  await page.mouse.click(line.x1, line.y);
  assert.strictEqual(await page.evaluate(() => Farm.world.raidB.raiders.length), 1, 'a tap sends one');
  // press and hold, then slide: they come along the finger
  await page.mouse.move(line.x1, line.y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  for (let k = 1; k <= 12; k++) await page.mouse.move(line.x1 + (line.x2 - line.x1) * k / 12, line.y);
  const dragged = await page.evaluate(() => Farm.world.raidB.raiders.length);
  assert.ok(dragged >= 4, 'held, then along the finger: ' + dragged);
  await page.waitForTimeout(1500); // hold still
  await page.mouse.up();
  const held = await page.evaluate(() => Farm.world.raidB.raiders.length);
  assert.ok(held > dragged, 'holding: more come (' + dragged + ' -> ' + held + ')');
  await shot(page, 'raid-drag');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Farm Shield (owner, 9 Nov 2026): used from the bag, 24 hours; the Raid Camp shows it', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.frState(s).camp = 1; Farm.Logic.addItem(s, 'farm_shield', 2); s.sel = s.inv.findIndex((x) => x && x.id === 'farm_shield'); Farm.ui.refresh(); });
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Farm.ui.actionLabel.text), 'Use');
  await page.evaluate(() => Farm.world.resolve().run());
  await page.waitForFunction(() => /shielded for 24 hours/.test(Farm.ui.toastText ? Farm.ui.toastText.text : ''), null, SLOW);
  assert.ok(await page.evaluate(() => Farm.Logic.shieldLeft(Farm.session.state, Date.now()) > 23.9 * 3600000));
  await page.evaluate(() => Farm.ui.openRaidCamp('party', 0));
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /Shielded: 2[34]h \d+m left/);
  await shot(page, 'raid-shield');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('farm raids v2 (owner, 10 Nov 2026: "make it more ... intense"): a green drop zone with Tap here, a red flash off it, raiders drop in with dust, hit sparks and numbers, rubble, crops pulled up, the loot bar', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.frState(s).camp = 7; s.fr.army = { goat: 12, carabao: 4, monkey: 4, boar: 4, crow: 6 }; Farm.ui.startRaid('b4'); });
  await page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.ui.frBox && Farm.world.bv, null, SLOW);
  await page.waitForTimeout(600);
  assert.ok(await page.evaluate(() => Farm.world.bv.hint && Farm.world.bv.hint.some((o) => o.text === 'Tap here!')), 'Tap here! before the first raider');
  await page.evaluate(() => { const w = Farm.world, f = w.bv && w.raidB.farm, P = Farm.WorldScene.prototype, fx = w.bfx; window.__fx = {}; w.bfx = function (k) { window.__fx[k] = (window.__fx[k] || 0) + 1; return fx.apply(this, arguments); }; window.__red = 0; const nd = w.raidNoDrop; w.raidNoDrop = function () { window.__red++; return nd.apply(this, arguments); }; const i = f.drop.indexOf('0'); w.raidDropAt(i % f.w, Math.floor(i / f.w)); });
  assert.strictEqual(await page.evaluate(() => window.__red), 1, 'off the green: the red flash');
  await page.evaluate(() => {
    const w = Farm.world, b = w.raidB, f = b.farm, cells = [];
    for (let i = 0; i < f.drop.length; i++) if (f.drop[i] === '1') cells.push([i % f.w, Math.floor(i / f.w)]);
    const d = b.defs.filter((q) => q.t === 'fence')[0] || b.defs[0];
    cells.sort((p, q) => Math.hypot(p[0] - d.x, p[1] - d.y) - Math.hypot(q[0] - d.x, q[1] - d.y));
    ['carabao', 'carabao', 'boar', 'boar', 'goat', 'goat', 'goat', 'goat', 'monkey', 'crow', 'crow'].forEach((k, i) => { Farm.ui.raidSel = k; w.raidDropAt(cells[i][0], cells[i][1]); });
  });
  assert.ok(await page.evaluate(() => !Farm.world.bv.hint), 'the hint goes with the first raider');
  await page.waitForFunction(() => { const x = window.__fx; return x.ring && x.dust && x.hit && x.rubble && (x.crop || x.coins || x.sack); }, null, SLOW).catch(() => {});
  const fx = await page.evaluate(() => window.__fx);
  for (const k of ['ring', 'dust', 'hit', 'rubble']) assert.ok(fx[k] > 0, k + ': ' + JSON.stringify(fx));
  assert.ok(fx.crop || fx.coins || fx.sack, 'loot pops out: ' + JSON.stringify(fx));
  // (the attack pose shows a part of each swing: watched for, not looked at once)
  await page.evaluate(() => { window.__hitPose = false; const w = Farm.world, d = w.raidDraw; w.raidDraw = function (t) { d.call(this, t); if (Object.values(this.bv.units).some((u) => !u.out && u.img.frame.name % 4 === 1)) window.__hitPose = true; }; });
  assert.ok(await page.waitForFunction(() => window.__hitPose, null, SLOW).then(() => true, () => false), 'someone hitting (the attack pose)');
  await shot(page, 'raid-v2-battle');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Raid Camp sells and places defenses (owner, 10 Nov 2026: "i bought all the defenses but how can I put it in the farm?")', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; s.gold = 20000; Farm.Logic.frState(s).camp = 3; Farm.ui.openRaidCamp('defenses', 0); });
  await page.waitForTimeout(400);
  const txt = await modalText(page);
  assert.match(txt, /Guard Goose.*0 of 2 on your farm/, txt.slice(0, 300)); // (camp 3: two geese)
  assert.match(txt, /Buy 1,500G/);
  assert.match(txt, /Lv 2 2,000G/);
  const t = await page.evaluate(() => Farm.Config.OUTDOOR.index.def_goose);
  const before = await page.evaluate(() => Farm.session.state.yard.items.length);
  await page.evaluate((t) => Farm.ui.raidDefensePlace(t), t);
  await page.waitForTimeout(500);
  const st = await page.evaluate((t) => ({ gold: Farm.session.state.gold, items: Farm.session.state.yard.items.length, decor: !!Farm.world.yd, placed: Farm.session.state.yard.items.some((it) => it.t === t) }), t);
  assert.strictEqual(st.gold, 20000 - 1500, 'paid');
  assert.ok(st.decor, 'into Decorate');
  assert.ok(st.placed && st.items === before + 1, 'the goose is on the farm, ready to drag');
  await shot(page, 'raid-defense-place');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a raid on your farm: raiders never land on the field or a tile round it, nor in the pen; open grass is fine (10 Nov 2026: the field was never kept clear)', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  const r = await page.evaluate(() => {
    const w = Farm.world, f = w.raidFarm({ camp: 3 }), at = (x, y) => f.drop[y * f.w + x] === '1';
    // (the field is its plots, where they stand: Edit Farm, 10 Nov 2026)
    const O = Farm.Config.OUTDOOR, field = [], pen = (w.zones.pen || [])[0];
    Farm.session.state.yard.items.filter((it) => O.types[it.t].fieldPlot).forEach((it) => Farm.Logic.yardBox(it.t, it.x, it.y).forEach((p) => field.push(p)));
    let fieldOk = 0, fieldBad = 0;
    field.forEach((p) => { if (at(p[0], p[1])) fieldBad++; else fieldOk++; });
    let penBad = 0;
    for (let y = pen.y0; y <= pen.y1; y++) for (let x = pen.x0; x <= pen.x1; x++) if (at(x, y)) penBad++;
    const open = f.drop.split('').filter((c) => c === '1').length;
    return { fieldOk, fieldBad, penBad, open, ring: at(3, 15) || at(20, 15) };
  });
  assert.ok(r.fieldOk > 200, 'the field is there: ' + JSON.stringify(r));
  assert.strictEqual(r.fieldBad, 0, 'no landing on the field');
  assert.strictEqual(r.ring, false, 'nor a tile round it');
  assert.strictEqual(r.penBad, 0, 'nor in the pen');
  assert.ok(r.open > 100, 'open ground left to land on: ' + r.open);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

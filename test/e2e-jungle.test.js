// The Bamboo Jungle end to end in the built page (dist/index.html), phone-sized headless Chromium, network blocked: in
// through Manila's Jungle Gate (shut before 70 hunts), out again; a Baboy-damo pair charging, a Javelin throw, tall
// bamboo stopping a long shot, the Pilandok zigzagging; Diday; the Bamboo Hollows (floor 1, the Tigmamanukan, the Bamboo
// Giant); the dusk; the tour; and the frame time on a slow phone (CPU x4) against the Plains and the town.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-jungle.test.js
// SHOTS=/some/dir saves screenshots (the owner's set: shots/jungle/).
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
const DAY = [2026, 4, 1, 10, 0];

// The app's side of the packs: files from dist/packs, as the CDN would serve them (e2e-plains.test.js)
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

// edit: run in the page on a fresh game's state (70 hunts: the Jungle open)
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
    s.wild.n = 70;
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
async function walk(page, key, until, arg, ms = 60000) {
  await page.keyboard.down(key);
  try { await page.waitForFunction(until, arg, { timeout: ms, polling: 50 }); } catch (e) {
    throw new Error(key + ': stuck at ' + JSON.stringify(await page.evaluate(() => { const f = Farm.world.feet(); return [f.x / 256, f.y / 256, Farm.world.mapKey, Farm.ui.modals.length]; })));
  } finally { await page.keyboard.up(key); }
  await frames(page, 2);
}
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const closeAll = async (page) => { await page.evaluate(() => Farm.ui.closeAll()); await frames(page, 2); };
// only the animals asked for, everything else gone
const only = (page) => page.evaluate(() => { const w = Farm.world; w.wild.next = 1e9; w.wild.animals.slice().forEach((a) => w.wildGone(a)); });
const GATE = [58, 88]; // Manila's Jungle Gate (x 28 in the layout, turned round)

test('Manila\'s Jungle Gate: shut before 70 hunts; at 70 you walk through it into the Jungle, and out again to the gate', async () => {
  // shut: the fence; the gate says when it opens; walking at it goes nowhere
  let { page, problems, context } = await open("s.wild.n = 69; s.map = 'manila';");
  await go(page, 'manila', 'from_train');
  await closeAll(page);
  await teleport(page, GATE[0] + 2, 86, 'down');
  await walk(page, 'ArrowDown', () => false, null, 1500).catch(() => {});
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'manila', 'still in Manila');
  assert.ok((await feetTile(page))[1] <= 87, 'kept out by the fence');
  assert.strictEqual(await actionLabel(page), 'Gate');
  await tapAction(page);
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /opens at 70 hunts/);
  assert.deepStrictEqual(problems, []);
  await context.close();
  // open
  ({ page, problems, context } = await open("s.map = 'manila'; s.gold = 100;"));
  await go(page, 'manila', 'from_train');
  await closeAll(page);
  await teleport(page, GATE[0] + 2, 86, 'down');
  await walk(page, 'ArrowDown', () => Farm.world.busy || Farm.world.mapKey !== 'manila');
  await waitMap(page, 'jungle');
  assert.deepStrictEqual(await feetTile(page), [26, 2], 'in at the Jungle\'s north gate');
  assert.ok(await page.evaluate(() => Farm.packReady('jungle')), 'the pack came in from the phone on the way');
  assert.ok(await page.evaluate(() => Farm.world.wild && Farm.world.wild.animals.length >= 12), 'animals about');
  const props = await page.evaluate(() => Farm.world.props.filter((i) => i.texture.key === 'props/jungle_bamboo').length);
  assert.ok(props > 150, 'the bamboo is the owner\'s: ' + props);
  await page.evaluate(() => Farm.ui.hideToast && Farm.ui.hideToast());
  await teleport(page, 26, 13, 'down');
  await page.waitForTimeout(800);
  await shot(page, 'jungle-01-day');
  // back up the trail: out at the gate, in Manila
  await teleport(page, 25, 2, 'up');
  await walk(page, 'ArrowUp', () => Farm.world.busy || Farm.world.mapKey !== 'jungle');
  await waitMap(page, 'manila');
  const back = await feetTile(page);
  assert.ok(back[0] >= GATE[0] && back[0] <= GATE[0] + 3 && back[1] === 87, 'in front of the gate: ' + back);
  assert.strictEqual(await page.evaluate(() => Farm.world.dir), 'up');
  assert.strictEqual((await state(page)).gold, 100, 'walking is free');
  // a game saved in the Jungle opens there again (saved as Pulag + its name)
  await go(page, 'jungle', 'from_city');
  const saved = await page.evaluate(() => { Farm.world.save(); return Farm.Logic.serialize(Farm.session.state); });
  assert.strictEqual(saved.pm, 'jungle');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a Baboy-damo pair charges together; a Javelin throw hits; tall bamboo stops a long shot', async () => {
  const { page, problems, context } = await open(`
    s.gold = 5e6; s.lumber = 100; s.energy = 999;
    L.addItem(s, 'rope', 20); L.getWeapon(s, 'javelin'); s.wpn.javelin = 3; L.buyAmmo(s, 'javelins', 4);
    L.getWeapon(s, 'rifle'); s.wpn.rifle = 4; L.buyAmmo(s, 'bullets', 2);
    s.sel = s.inv.findIndex((x) => x && x.id === 'javelin');
  `);
  await go(page, 'jungle', 'from_city');
  await closeAll(page);
  await only(page);
  // a pair in the pool glade, east of you; they stand side by side
  const pair = await page.evaluate(() => {
    const w = Farm.world, L = Farm.Logic, T = 256;
    const slots = L.wildSlots('jungle').filter((e) => e.kind === 'baboydamo' && !e.when).map((e) => e.slot).slice(0, 2);
    w.setFeet(19 * T + 128, 28 * T + 128); w.dir = 'right'; w.idle();
    const f = w.feet();
    const a = slots.map((sl) => w.addWildAnimal('baboydamo', sl, f.x + 6 * T, f.y - 0.3 * T));
    const p = L.flockSpot(a[0].x, a[0].y, Math.PI, 1, T, a[0].def.w, 2);
    a[1].x = p.x; a[1].y = p.y;
    a.forEach((x) => { x.vx = x.vy = 0; x.mode = 'idle'; x.t = 1e9; x.left = true; });
    return a.map((x) => x.flk && x.flk.lead);
  });
  assert.deepStrictEqual(pair, [pair[0], pair[0]], 'one pair, one leader');
  // they charge: the leader first, its friend with it
  await page.evaluate(() => {
    const w = Farm.world, a = w.wild.animals, f = w.feet();
    a[0].x = f.x + 2 * 256;
    const p = Farm.Logic.flockSpot(a[0].x, a[0].y, Math.PI, 1, 256, a[0].def.w, 2);
    a[1].x = p.x; a[1].y = p.y;
    a.forEach((x) => { x.t = 0; x.cool = 0; });
  });
  await page.waitForFunction(() => Farm.world.wild.animals.filter((a) => a.mode === 'charge').length === 2, null, { timeout: 10000 });
  await page.waitForTimeout(120);
  await shot(page, 'jungle-03-baboy-pair-charging');
  // a Javelin throw at the one in front: it hits (the Gold Javelin: 4) for the Bow's energy
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.forEach((a, i) => { const f = w.feet(); a.x = f.x + (2 + i * 0.1) * 256; a.y = f.y - (0.2 - i * 1.0) * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; }); w.dir = 'right'; w.wpnNext = 0; });
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Throw');
  const e0 = (await state(page)).energy, hp0 = await page.evaluate(() => Farm.world.wild.animals[0].hp);
  await tapAction(page);
  const s1 = await state(page); // (at once: struck, the pig charges you, and that costs more)
  await page.waitForTimeout(110);
  await shot(page, 'jungle-04-javelin-throw');
  await page.waitForTimeout(600);
  assert.strictEqual(e0 - s1.energy, 2, 'a throw costs the Bow\'s 2 energy');
  const hp1 = await page.evaluate(() => { const a = Farm.world.wild.animals[0]; return a ? a.hp : 0; });
  assert.strictEqual(hp0 - hp1, 4, 'the Gold Javelin hits 4: ' + hp0 + ' -> ' + hp1);
  // tall bamboo: from an open tile, a Tuko 6 tiles off across a clump; the Magma Rifle (reach 8) shoots, the bullet stops
  // at the bamboo and the Tuko is untouched
  await only(page);
  const spot = await page.evaluate(() => {
    const w = Farm.world, L = Farm.Logic, J = Farm.Config.JUNGLE, T = 256, cl = L.jungleClumps(Farm.ASSETS.maps.jungle);
    const open = (x, y) => w.walkable(x, y) && !cl.at(x, y);
    const dirs = { right: [1, 0, 0], left: [-1, 0, Math.PI], down: [0, 1, Math.PI / 2], up: [0, -1, -Math.PI / 2] };
    for (const g of J.glades) for (let y = g[1]; y < g[1] + g[3]; y++) for (let x = g[0]; x < g[0] + g[2]; x++) {
      if (!open(x, y)) continue;
      for (const k of Object.keys(dirs)) {
        const d = dirs[k], tx = x + d[0] * 6, ty = y + d[1] * 6;
        if (!w.walkable(tx, ty)) continue;
        let near = false;
        for (let i = 1; i <= 4; i++) if (cl.at(x + d[0] * i, y + d[1] * i)) near = true;
        if (near) continue;
        const stop = L.bambooStop(cl.at, x + 0.5, y + 0.45, d[2], 6);
        if (stop && stop < 5.6) return { x, y, dir: k, tx, ty, stop };
      }
    }
    return null;
  });
  assert.ok(spot, 'a place where bamboo stands between you and an animal past 4 tiles');
  await page.evaluate((p) => {
    const w = Farm.world, s = Farm.session.state, T = 256;
    s.sel = s.inv.findIndex((x) => x && x.id === 'rifle');
    w.setFeet(p.x * T + 128, p.y * T + 128); w.dir = p.dir; w.idle();
    const sl = Farm.Logic.wildSlots('jungle').filter((e) => e.kind === 'tuko')[0].slot;
    const a = w.addWildAnimal('tuko', sl, p.tx * T + 128, p.ty * T + 200);
    a.vx = a.vy = 0; a.mode = 'graze'; a.t = 1e9; a.cool = 1e9; w.wpnNext = 0;
    w.__shots = [];
    const fly = w.wpnFly; w.wpnFly = function (o) { const sh = fly.apply(this, arguments); w.__shots.push({ range: sh.range, asked: o.range, bamboo: !!sh.bamboo }); return sh; };
    const puff = w.bambooPuff; w.bambooPuff = function () { w.__puff = true; return puff.apply(this, arguments); };
  }, spot);
  await frames(page, 4);
  const tuko0 = await page.evaluate(() => Farm.world.wild.animals[0].hp);
  assert.strictEqual(await actionLabel(page), 'Shoot');
  await page.evaluate(() => { window.gameHost.quiet = false; }); // (its words, the first time)
  await tapAction(page);
  await page.waitForFunction(() => Farm.world.__puff, null, { timeout: 5000 });
  await page.waitForTimeout(90);
  await shot(page, 'jungle-05-bamboo-stops-a-long-shot');
  await page.evaluate(() => { window.gameHost.quiet = true; });
  await page.waitForTimeout(600);
  const fired = await page.evaluate(() => Farm.world.__shots);
  assert.strictEqual(fired.length, 1);
  assert.ok(fired[0].bamboo && fired[0].range < 6 * 256 && fired[0].asked === 8 * 256, 'the bullet stops at the bamboo: ' + JSON.stringify(fired[0]));
  assert.strictEqual(await page.evaluate(() => Farm.world.wild.animals[0].hp), tuko0, 'the Tuko behind it is untouched');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Pilandok zigzags as it runs (one way, then the other); Diday by her hut', async () => {
  const { page, problems, context } = await open('');
  await go(page, 'jungle', 'from_city');
  await closeAll(page);
  await only(page);
  await page.evaluate(() => {
    const w = Farm.world, T = 256, sl = Farm.Logic.wildSlots('jungle').filter((e) => e.kind === 'pilandok')[0].slot;
    w.setFeet(20 * T + 128, 27 * T + 128); w.dir = 'right'; w.idle();
    const f = w.feet(), a = w.addWildAnimal('pilandok', sl, f.x + 2.5 * T, f.y);
    a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9;
    w.__zz = [];
    w.wildFlee(a, { x: f.x, y: f.y });
    a.vx = Math.abs(a.vx) || 6.8 * T; a.vy = 0; a.t = 4000;
  });
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(90);
    const v = await page.evaluate(() => { const a = Farm.world.wild.animals[0]; return a && a.mode === 'flee' ? Math.atan2(a.vy, a.vx) - a.zz0 : null; });
    if (v != null) await page.evaluate((v) => Farm.world.__zz.push(v), v);
    if (i === 4) await shot(page, 'jungle-06-pilandok-zigzag');
  }
  const turns = await page.evaluate(() => Farm.world.__zz);
  const signs = turns.map((t) => Math.sign(Math.atan2(Math.sin(t), Math.cos(t))));
  assert.ok(turns.length >= 6, 'it ran: ' + turns.length);
  assert.ok(signs.includes(1) && signs.includes(-1), 'it dodged both ways: ' + JSON.stringify(turns.map((t) => +t.toFixed(2))));
  // Diday
  const npc = await page.evaluate(() => Farm.Config.PLACES.jungle.npc.at);
  await teleport(page, npc[0], npc[1] + 1, 'up');
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /DIDAY/);
  assert.match(await modalText(page), /cassava/);
  await closeAll(page);
  await page.waitForTimeout(300);
  await shot(page, 'jungle-07-diday');
  const cassava = (await state(page)).inv.filter((x) => x && x.id === 'cassava').reduce((n, x) => n + x.n, 0);
  assert.ok(cassava >= 5, 'her first gift: cassava for the Biik');
  assert.ok(await page.evaluate(() => Farm.world.placeNpc.img.texture.key === 'npc_diday'), 'her own picture');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Bamboo Hollows: in by the cave\'s door, floor 1; the Tigmamanukan (floor 10) and the Bamboo Giant (floor 50)', async () => {
  const { page, problems, context } = await open(`
    s.gold = 2e6; s.lumber = 100; s.energy = 999; L.addItem(s, 'rope', 2);
    L.getWeapon(s, 'javelin'); L.buyAmmo(s, 'javelins', 2);
    s.sel = s.inv.findIndex((x) => x && x.id === 'javelin');
    L.dunReach(s, 'jungle_cave', 50);
  `);
  await go(page, 'jungle', 'from_city');
  await closeAll(page);
  const door = await page.evaluate(() => Farm.Config.JUNGLE.door);
  await teleport(page, door[0], door[1] + 2, 'up');
  await page.waitForTimeout(500);
  await shot(page, 'jungle-08-cave-door');
  await walk(page, 'ArrowUp', () => Farm.world.busy || Farm.world.mapKey !== 'jungle');
  await page.waitForFunction(() => Farm.world.mapKey === 'jungle_cave' && !Farm.world.busy && Farm.world.wild && Farm.world.lair, null, SLOW);
  await page.waitForTimeout(800);
  // in at the door: the last lift reached (floor 50 reached: the lift's last stop is 41; owner, 23 Nov 2026, "A")
  assert.strictEqual(await page.evaluate(() => Farm.world.lair.floor), 41);
  await go(page, 'jungle_cave', 'entrance', 1);
  await page.waitForTimeout(800);
  const f1 = await page.evaluate(() => ({ floor: Farm.world.lair.floor, kinds: Farm.world.wild.animals.map((a) => a.kind), name: Farm.world.lair.cfg.name }));
  assert.strictEqual(f1.floor, 1);
  assert.strictEqual(f1.name, 'The Bamboo Hollows');
  assert.ok(f1.kinds.length >= 3 && f1.kinds.every((k) => k === 'kawayansprite'), JSON.stringify(f1.kinds));
  await shot(page, 'jungle-09-cave-floor-1');
  await go(page, 'jungle_cave', 'entrance', 10);
  await page.waitForTimeout(800);
  const g = await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'jg_tigma')[0]; return a && { hp: a.hp, key: a.img.texture.key }; });
  assert.ok(g && g.hp >= 38, 'the Tigmamanukan guards floor 10');
  assert.strictEqual(g.key, 'wild_jungle_tigma', 'the Jungle\'s own Tigmamanukan picture');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.filter((x) => x.kind === 'jg_tigma')[0], f = w.feet(); a.x = f.x + 2.5 * 256; a.y = f.y + 0.6 * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; w.dir = 'right'; });
  await page.waitForTimeout(500);
  await shot(page, 'jungle-10-tigmamanukan');
  await go(page, 'jungle_cave', 'entrance', 50);
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'bamboogiant')[0]; return a && { hp: a.hp }; });
  assert.ok(b && b.hp >= 58, 'the Bamboo Giant on floor 50');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.filter((x) => x.kind === 'bamboogiant')[0], f = w.feet(); a.x = f.x + 2.6 * 256; a.y = f.y + 4.2 * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; w.dir = 'down'; });
  await page.waitForTimeout(500);
  await shot(page, 'jungle-11-bamboo-giant');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the first-time tour (the owner\'s pictures), centred, once; the Jungle at dusk: the Maral are out', async () => {
  let { page, problems, context } = await open("s.map = 'manila';", DAY, { loud: true });
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.ui.closeAll(); });
  await go(page, 'jungle', 'from_city');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.ui.modals.length > 0 && /BAMBOO JUNGLE/.test((() => { const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return out.join('|'); })()), null, { timeout: 30000 });
  await page.waitForTimeout(900);
  assert.match(await modalText(page), /Diday/);
  const box = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1].c.getBounds(); return { x: m.centerX, w: m.width }; });
  assert.ok(Math.abs(box.x - 180) < 12, 'centred: ' + JSON.stringify(box));
  await shot(page, 'jungle-12-tour-1');
  for (let i = 2; i <= 5; i++) { await tapButton(page, 'Next'); await page.waitForTimeout(500); await shot(page, 'jungle-12-tour-' + i); }
  await closeAll(page);
  assert.ok(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'jungle_tour')), 'once only');
  assert.deepStrictEqual(problems, []);
  await context.close();
  ({ page, problems, context } = await open('', [2026, 4, 1, 19, 15]));
  await go(page, 'jungle', 'from_city');
  await closeAll(page);
  assert.ok(await page.evaluate(() => Farm.world.wild.animals.some((a) => a.kind === 'maral') || Farm.Logic.wildHere(Farm.session.state, 'jungle').some((e) => e.kind === 'maral')), 'the leopard cats of the dusk');
  await teleport(page, 26, 22, 'down');
  await page.waitForTimeout(800);
  await shot(page, 'jungle-02-dusk');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// The world's own work in a frame (its update and its drawing), as e2e-gameserver-pub.test.js measures it
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

test('a slow phone (CPU x4): the Jungle\'s frame time, walking its trails, against the Plains and the town (budget 13-14 ms at 60 Hz)', async () => {
  const { page, problems, context } = await open("s.wild.n = 70; s.map = 'town';");
  const cdp = await context.newCDPSession(page);
  const rows = {};
  const run = async (name, map, spawn, path) => {
    await go(page, map, spawn);
    await closeAll(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.waitForTimeout(1500);
    const m = work(page, 7000);
    for (const [k, ms] of path) { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); }
    rows[name] = await m;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  };
  await run('town', 'town', 'from_farm', [['ArrowRight', 1500], ['ArrowDown', 1000], ['ArrowLeft', 1500], ['ArrowUp', 1000], ['ArrowRight', 1500]]);
  await run('plains', 'plains', 'from_town', [['ArrowRight', 3000], ['ArrowUp', 1000], ['ArrowRight', 2500]]);
  await run('jungle', 'jungle', 'from_city', [['ArrowDown', 3500], ['ArrowUp', 1500], ['ArrowDown', 1500]]);
  console.log('[CPU x4] world work per frame (ms), and frame gaps:', JSON.stringify(rows));
  assert.ok(rows.jungle.world.avg <= 14, 'the Jungle within the 60 Hz budget on average: ' + rows.jungle.world.avg + ' ms');
  assert.ok(rows.jungle.world.p50 <= Math.max(14, rows.plains.world.p50 * 1.5), 'and about as light as the Plains: ' + rows.jungle.world.p50 + ' vs ' + rows.plains.world.p50);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

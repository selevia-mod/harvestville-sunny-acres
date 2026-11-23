// The Rocky Gorge end to end in the built page (dist/index.html), phone-sized headless Chromium, network blocked: in
// through Manila's Gorge Gate (shut before 110 hunts), out again; a flock of Kalapati in a row on a ledge; a Boomerang
// throw hitting the first one on the way out and again on the way back (the Moon one: 2 side by side each way); the Ibong
// Adarna's song (every animal near stands still 3 s); the Little Kalapati spotting it; Tata Ambo; a rope bridge; the Echo
// Caves (floor 1's fireflies three together, the Bato King, the Galura); the dusk; the tour; and the frame time on a slow
// phone (CPU x4) with a flock of 5 on screen, against the Jungle, the Plains and the town.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-gorge.test.js
// SHOTS=/some/dir saves screenshots (the owner's set: shots/gorge/).
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

// edit: run in the page on a fresh game's state (110 hunts: the Gorge open)
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
    s.wild.n = 110;
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
const GATE = [42, 0]; // Manila's Gorge Gate (x 44 in the layout, turned round: 90 - 44 - 4), on the north edge
// a flock of n of a kind (its first n slots: one flock) in a row on the first west ledge, the leader in the middle
const flockOnLedge = (page, kind, n, lx, ly) => page.evaluate(([kind, n, lx, ly]) => {
  const w = Farm.world, L = Farm.Logic, T = 256, slots = L.wildSlots('gorge').filter((e) => e.kind === kind && !e.when).map((e) => e.slot).slice(0, n);
  const lead = w.addWildAnimal(kind, slots[0], lx * T + 128, ly * T + 180, 1);
  const out = [lead];
  slots.slice(1).forEach((sl, i) => { const p = L.flockSpot(lead.x, lead.y, 0, i + 1, T, lead.def.w, n, lead.def); out.push(w.addWildAnimal(kind, sl, p.x, p.y, 1)); });
  out.forEach((a) => { a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; a.left = true; a.song = 1e9; w.drawWild(a); });
  return out.map((a) => ({ x: a.x / T, y: a.y / T, lead: a.flk && a.flk.lead, slot: a.slot }));
}, [kind, n, lx, ly]);

test('Manila\'s Gorge Gate: shut before 110 hunts; at 110 you walk through it into the Gorge, and out again to the gate', async () => {
  let { page, problems, context } = await open("s.wild.n = 109; s.map = 'manila';");
  await go(page, 'manila', 'from_train');
  await closeAll(page);
  await teleport(page, GATE[0] + 2, 3, 'up');
  await walk(page, 'ArrowUp', () => false, null, 1500).catch(() => {});
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'manila', 'still in Manila');
  assert.ok((await feetTile(page))[1] >= 2, 'kept out by the fence');
  assert.strictEqual(await actionLabel(page), 'Gate');
  await tapAction(page);
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /opens at 110 hunts/);
  assert.deepStrictEqual(problems, []);
  await context.close();
  ({ page, problems, context } = await open("s.map = 'manila'; s.gold = 100;"));
  await go(page, 'manila', 'from_train');
  await closeAll(page);
  await teleport(page, GATE[0] + 2, 4, 'up');
  await walk(page, 'ArrowUp', () => Farm.world.busy || Farm.world.mapKey !== 'manila');
  await waitMap(page, 'gorge');
  assert.deepStrictEqual(await feetTile(page), [19, 48], 'in at the Gorge\'s south gate');
  assert.ok(await page.evaluate(() => Farm.packReady('gorge')), 'the pack came in from the phone on the way');
  assert.ok(await page.evaluate(() => Farm.world.wild && Farm.world.wild.animals.length >= 15), 'animals about');
  assert.ok(await page.evaluate(() => Farm.world.map.getTileset('tiles').image.key === 'tiles-gorge'), 'the owner\'s ground: floor, water, the cliffs');
  const props = await page.evaluate(() => Farm.world.props.filter((i) => /^props\/gorge_/.test(i.texture.key)).length);
  assert.ok(props > 30, 'the owner\'s props: ' + props);
  // the cliffs are solid: you cannot climb them
  assert.ok(await page.evaluate(() => !Farm.world.walkable(2, 20) && !Farm.world.walkable(20, 2) && !Farm.world.walkable(8, 14) && Farm.world.walkable(8, 12)), 'cliff top, ledge face solid; the shelf walkable');
  // flocks start on the ledges, in a row
  const onLedge = await page.evaluate(() => Farm.world.wild.animals.filter((a) => a.def.abreast && a.flk && a.flk.i === 0 && Farm.Logic.gorgeOnLedge(Math.floor(a.x / 256), Math.floor(a.y / 256))).length);
  assert.ok(onLedge >= 2, 'flock leaders on the ledges: ' + onLedge);
  await page.evaluate(() => Farm.ui.hideToast && Farm.ui.hideToast());
  await teleport(page, 18, 22, 'up');
  await page.waitForTimeout(900);
  await shot(page, 'gorge-01-day');
  await teleport(page, 19, 48, 'down');
  await walk(page, 'ArrowDown', () => Farm.world.busy || Farm.world.mapKey !== 'gorge');
  await waitMap(page, 'manila');
  const back = await feetTile(page);
  assert.ok(back[0] >= GATE[0] && back[0] <= GATE[0] + 3 && back[1] === 3, 'in front of the gate: ' + back);
  assert.strictEqual(await page.evaluate(() => Farm.world.dir), 'down');
  assert.strictEqual((await state(page)).gold, 100, 'walking is free');
  await go(page, 'gorge', 'from_city');
  const saved = await page.evaluate(() => { Farm.world.save(); return Farm.Logic.serialize(Farm.session.state); });
  assert.strictEqual(saved.pm, 'gorge');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a flock of Kalapati in a row on a ledge; the Boomerang hits the first one going out and again coming back; the Moon one hits 2 each way', async () => {
  const { page, problems, context } = await open(`
    s.gold = 5e6; s.lumber = 100; s.energy = 999;
    L.addItem(s, 'beeswax', 4); L.getWeapon(s, 'boomerang'); s.wpn.boomerang = 2; s.wpn.left = 300;
    s.sel = s.inv.findIndex((x) => x && x.id === 'boomerang');
  `);
  await go(page, 'gorge', 'from_city');
  await closeAll(page);
  await only(page);
  // four in a row on the first west ledge (shelf rows 10-13), each a tile from the next
  const row = await flockOnLedge(page, 'kalapati', 4, 9, 10);
  assert.strictEqual(new Set(row.map((r) => r.lead)).size, 1, 'one flock');
  const xs = row.map((r) => r.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 0.9 && xs[i] - xs[i - 1] < 1.4, 'side by side: ' + JSON.stringify(xs));
  await teleport(page, 9, 13, 'up');
  await page.evaluate(() => { const w = Farm.world; w.setFeet(9 * 256 + 128, 13.3 * 256); w.dir = 'up'; w.idle(); });
  await frames(page, 6);
  await shot(page, 'gorge-03-flock-on-a-ledge');
  // the Silver Boomerang (reach 3, hits 2): the one in front, twice; the throw costs the Bow's 2 energy
  const hit = await page.evaluate(() => {
    const w = Farm.world, out = [];
    const st = w.wpnStrike;
    w.wpnStrike = function (sh, a) { out.push({ slot: a.slot, hp: a.hp, t: Math.round(sh.t) }); return st.apply(this, arguments); };
    w.__struck = out;
    w.wpnNext = 0;
    return w.wild.animals.map((a) => a.hp);
  });
  const e0 = (await state(page)).energy;
  assert.strictEqual(await actionLabel(page), 'Throw');
  await tapAction(page);
  await page.waitForTimeout(260);
  await shot(page, 'gorge-04-boomerang-out');
  await page.waitForTimeout(260);
  await shot(page, 'gorge-05-boomerang-back');
  await page.waitForTimeout(900);
  const struck = await page.evaluate(() => Farm.world.__struck);
  assert.strictEqual(e0 - (await state(page)).energy, 2, 'a throw costs 2 energy');
  assert.strictEqual(struck.length, 2, 'two hits: ' + JSON.stringify(struck));
  assert.strictEqual(struck[0].slot, struck[1].slot, 'out and back: the same one, the first one again');
  assert.ok(struck[1].t > struck[0].t + 100, 'the second on the way back');
  const hp1 = await page.evaluate(() => Farm.world.wild.animals.map((a) => ({ slot: a.slot, hp: a.hp })));
  assert.ok(hp1.some((a) => a.slot === struck[0].slot && a.hp === 1) || !hp1.some((a) => a.slot === struck[0].slot), 'Silver hits 2, twice: 5 -> 1 ' + JSON.stringify(hp1));
  assert.strictEqual(await page.evaluate(() => Farm.world.wpnShots.length), 0, 'back in your hand');
  void hit;
  // the Moon Boomerang (reach 6, hits 3, 2 side by side): a fresh row of four, four hits in one throw
  await only(page);
  await page.evaluate(() => { const s = Farm.session.state; s.wpn.boomerang = 5; s.wpn.left = 600; Farm.world.__struck.length = 0; });
  await flockOnLedge(page, 'kalapati', 4, 9, 10);
  await page.evaluate(() => { const w = Farm.world; w.setFeet(9 * 256 + 128, 13.3 * 256); w.dir = 'up'; w.idle(); w.wpnNext = 0; });
  await frames(page, 4);
  await tapAction(page);
  await page.waitForTimeout(400);
  await shot(page, 'gorge-06-moon-boomerang');
  await page.waitForTimeout(900);
  const moon = await page.evaluate(() => Farm.world.__struck);
  assert.strictEqual(moon.length, 4, 'the Moon Boomerang: 2 side by side each way: ' + JSON.stringify(moon));
  assert.strictEqual(moon[0].slot, moon[2].slot, 'the first one going out and again coming back, each time with the one beside it');
  assert.ok(moon[1].slot !== moon[0].slot && moon[3].slot !== moon[0].slot, 'the one beside it: ' + JSON.stringify(moon));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Ibong Adarna sings: every animal near it stands still for 3 s, then goes on; the Little Kalapati spots it', async () => {
  const { page, problems, context } = await open(`
    L.addItem(s, 'mung_bean', 30);
    for (let i = 0; i < 40 && !L.tamed(s, 'gorge'); i++) { const r = L.feedTame(s, 'gorge', () => 0.99); if (r === 'ran') L.placeRec(s, 'gorge').ta = 0; }
  `);
  await go(page, 'gorge', 'from_city');
  await closeAll(page);
  await only(page);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.companion(Farm.session.state)), 'gorge', 'the Little Kalapati walks with you');
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.world.comp && (Farm.world.comp.spotted = false); });
  const who = await page.evaluate(() => {
    const w = Farm.world, L = Farm.Logic, T = 256, sl = (k) => L.wildSlots('gorge').filter((e) => e.kind === k)[0].slot;
    w.setFeet(20 * T + 128, 30 * T + 128); w.dir = 'right'; w.idle();
    const ad = w.addWildAnimal('adarna', sl('adarna'), 30 * T, 30 * T, 1);
    const near = w.addWildAnimal('ibid', sl('ibid'), 32 * T, 31 * T);
    const far = w.addWildAnimal('batobato', sl('batobato'), 44 * T + 128, 44 * T);
    [ad, near, far].forEach((a) => { a.mode = 'walk'; a.vx = 0.5 * T; a.vy = 0; a.t = 1e9; a.cool = 1e9; });
    ad.song = 1e9;
    return [ad.slot, near.slot, far.slot];
  });
  await page.waitForFunction(() => Farm.world.gorge.point, null, { timeout: 5000 });
  await page.waitForTimeout(200);
  await shot(page, 'gorge-08-little-kalapati-spots-the-adarna');
  const told = await page.evaluate(() => Farm.ui.toastText && Farm.ui.toastText.text);
  assert.match(told || '', /Little Kalapati coos/);
  // it sings
  await page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'adarna'); a.song = 0; });
  await frames(page, 3);
  const pos0 = await page.evaluate(() => Farm.world.wild.animals.map((a) => ({ k: a.kind, x: a.x, still: a.still || 0 })));
  await page.evaluate(() => { const w = Farm.world; w.setFeet(29 * 256, 32 * 256); w.dir = 'up'; w.idle(); }); // (the picture: up close, while they stand still)
  await page.waitForTimeout(500);
  await shot(page, 'gorge-07-adarna-sings');
  await page.waitForTimeout(1200);
  const pos1 = await page.evaluate(() => Farm.world.wild.animals.map((a) => ({ k: a.kind, x: a.x, still: a.still || 0 })));
  const by = (l, k) => l.find((a) => a.k === k);
  assert.ok(by(pos0, 'adarna').still > 2500 && by(pos0, 'ibid').still > 2500, 'it and the Ibid near it stand still: ' + JSON.stringify(pos0));
  assert.strictEqual(by(pos0, 'batobato').still, 0, 'the Bato-Bato far off does not');
  assert.strictEqual(by(pos1, 'ibid').x, by(pos0, 'ibid').x, 'the Ibid has not moved');
  assert.ok(by(pos1, 'batobato').x > by(pos0, 'batobato').x, 'the far one walks on');
  // a hit while it is still: it does not run
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'ibid'); a.still = Math.max(a.still || 0, 2000); w.wildStruck(a); }); // (still standing: as long as the song lasts)
  assert.strictEqual(await page.evaluate(() => Farm.world.wild.animals.find((x) => x.kind === 'ibid').mode), 'idle', 'spellbound: struck, it stays');
  await page.waitForTimeout(2200);
  assert.ok(await page.evaluate(() => !(Farm.world.wild.animals.find((x) => x.kind === 'ibid').still > 0)), 'after 3 s it is free again');
  void who;
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Tata Ambo by his camp; a rope bridge over the stream', async () => {
  const { page, problems, context } = await open('');
  await go(page, 'gorge', 'from_city');
  await closeAll(page);
  const npc = await page.evaluate(() => Farm.Config.PLACES.gorge.npc.at);
  await teleport(page, npc[0], npc[1] + 1, 'up');
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /TATA AMBO/);
  assert.match(await modalText(page), /mung beans/);
  await closeAll(page);
  await page.waitForTimeout(300);
  await shot(page, 'gorge-09-tata-ambo');
  assert.ok(await page.evaluate(() => Farm.world.placeNpc.img.texture.key === 'npc_tata_ambo'), 'his own picture');
  const mung = (await state(page)).inv.filter((x) => x && x.id === 'mung_bean').reduce((n, x) => n + x.n, 0);
  assert.ok(mung >= 5, 'his first gift: mung beans');
  // across the stream on the first rope bridge (rows 18-19)
  await teleport(page, 22, 18, 'right');
  await walk(page, 'ArrowRight', () => Farm.world.feet().x > 29 * 256, null, 8000);
  assert.ok(await page.evaluate(() => Farm.world.props.some((i) => i.texture.key === 'props/gorge_bridge')), 'the owner\'s rope bridge');
  await teleport(page, 25, 19, 'right');
  await page.waitForTimeout(500);
  await shot(page, 'gorge-10-rope-bridge');
  assert.ok(await page.evaluate(() => !Farm.world.walkable(25, 25)), 'the stream is water');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Echo Caves: in by the north cliff\'s door, floor 1 (fireflies three together); the Bato King (floor 10) and the Galura (floor 50)', async () => {
  const { page, problems, context } = await open(`
    s.gold = 2e6; s.lumber = 100; s.energy = 999; L.addItem(s, 'beeswax', 2);
    L.getWeapon(s, 'boomerang'); s.sel = s.inv.findIndex((x) => x && x.id === 'boomerang');
    L.dunReach(s, 'gorge_cave', 50);
  `);
  await go(page, 'gorge', 'from_city');
  await closeAll(page);
  const door = await page.evaluate(() => Farm.Config.GORGE.door);
  await teleport(page, door[0], door[1] + 2, 'up');
  await page.waitForTimeout(500);
  await shot(page, 'gorge-11-cave-door');
  await walk(page, 'ArrowUp', () => Farm.world.busy || Farm.world.mapKey !== 'gorge');
  await page.waitForFunction(() => Farm.world.mapKey === 'gorge_cave' && !Farm.world.busy && Farm.world.wild && Farm.world.lair, null, SLOW);
  await page.waitForTimeout(800);
  // in at the door: the last lift reached (floor 50 reached: the lift's last stop is 41; owner, 23 Nov 2026, "A")
  assert.strictEqual(await page.evaluate(() => Farm.world.lair.floor), 41);
  await go(page, 'gorge_cave', 'entrance', 1);
  await page.waitForTimeout(800);
  const f1 = await page.evaluate(() => ({ floor: Farm.world.lair.floor, kinds: Farm.world.wild.animals.map((a) => a.kind), name: Farm.world.lair.cfg.name, flocks: Farm.world.wild.animals.map((a) => a.flk && a.flk.lead) }));
  assert.strictEqual(f1.floor, 1);
  assert.strictEqual(f1.name, 'The Echo Caves');
  assert.ok(f1.kinds.length === 3 && f1.kinds.every((k) => k === 'gr_alitaptap'), JSON.stringify(f1.kinds));
  assert.ok(f1.flocks.every((l) => l === 0), 'one flock of three: ' + JSON.stringify(f1.flocks));
  await page.evaluate(() => { const w = Farm.world, f = w.feet(), L = Farm.Logic, a = w.wild.animals; a.forEach((x, i) => { const p = L.flockSpot(f.x + 3 * 256, f.y + 1.5 * 256, 0, i, 256, x.def.w, 3, x.def); x.x = p.x; x.y = p.y; x.vx = x.vy = 0; x.mode = 'idle'; x.t = 1e9; }); });
  await page.waitForTimeout(500);
  await shot(page, 'gorge-12-cave-floor-1');
  await go(page, 'gorge_cave', 'entrance', 10);
  await page.waitForTimeout(800);
  const g = await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'batoking')[0]; return a && { hp: a.hp, key: a.img.texture.key }; });
  assert.ok(g && g.hp >= 45, 'the Bato King guards floor 10');
  assert.strictEqual(g.key, 'wild_batoking');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.filter((x) => x.kind === 'batoking')[0], f = w.feet(); a.x = f.x + 2.5 * 256; a.y = f.y + 1.2 * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; w.dir = 'right'; });
  await page.waitForTimeout(500);
  await shot(page, 'gorge-13-bato-king');
  await go(page, 'gorge_cave', 'entrance', 50);
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.kind === 'gr_galura')[0]; return a && { hp: a.hp, key: a.img.texture.key }; });
  assert.ok(b && b.hp >= 66, 'the Galura on floor 50');
  assert.strictEqual(b.key, 'wild_gorge_galura', 'the Gorge\'s own Galura picture');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.filter((x) => x.kind === 'gr_galura')[0], f = w.feet(); a.x = f.x + 2.6 * 256; a.y = f.y + 4.2 * 256; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.cool = 1e9; w.dir = 'down'; });
  await page.waitForTimeout(500);
  await shot(page, 'gorge-14-galura');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the first-time tour (the owner\'s pictures), centred, once; the Gorge at dusk: a Banog is out', async () => {
  let { page, problems, context } = await open("s.map = 'manila';", DAY, { loud: true });
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.ui.closeAll(); });
  await go(page, 'gorge', 'from_city');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.ui.modals.length > 0 && /ROCKY GORGE/.test((() => { const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return out.join('|'); })()), null, { timeout: 30000 });
  await page.waitForTimeout(900);
  assert.match(await modalText(page), /Tata Ambo/);
  const box = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1].c.getBounds(); return { x: m.centerX, w: m.width }; });
  assert.ok(Math.abs(box.x - 180) < 12, 'centred: ' + JSON.stringify(box));
  await shot(page, 'gorge-15-tour-1');
  for (let i = 2; i <= 5; i++) { await tapButton(page, 'Next'); await page.waitForTimeout(500); await shot(page, 'gorge-15-tour-' + i); }
  await closeAll(page);
  assert.ok(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'gorge_tour')), 'once only');
  assert.deepStrictEqual(problems, []);
  await context.close();
  ({ page, problems, context } = await open('', [2026, 4, 1, 17, 30]));
  await go(page, 'gorge', 'from_city');
  await closeAll(page);
  assert.ok(await page.evaluate(() => Farm.Logic.wildHere(Farm.session.state, 'gorge').some((e) => e.kind === 'banog')), 'the serpent eagle of the dusk');
  await teleport(page, 30, 24, 'up');
  await page.waitForTimeout(800);
  await shot(page, 'gorge-02-dusk');
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


test('a slow phone (CPU x4): the Gorge with a flock of 5 on screen, against the Jungle, the Plains and the town (budget 13-14 ms at 60 Hz)', async () => {
  const { page, problems, context } = await open("s.map = 'town';");
  const cdp = await context.newCDPSession(page);
  const rows = {};
  const run = async (name, map, spawn, path, before) => {
    await go(page, map, spawn);
    await closeAll(page);
    if (before) await before();
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
  // the Gorge: five Langay-langayan in a row on the second west ledge, you just below it, walking about by them
  let seen = 0;
  await run('gorge', 'gorge', 'from_city', [['ArrowLeft', 1200], ['ArrowRight', 2400], ['ArrowLeft', 1200], ['ArrowUp', 600], ['ArrowDown', 600]], async () => {
    await flockOnLedge(page, 'gr_langay', 5, 9, 25);
    await page.evaluate(() => { const w = Farm.world; w.wild.animals.forEach((a) => { if (a.kind === 'gr_langay') { a.t = 1500; a.cool = 0; } }); w.setFeet(10 * 256 + 128, 31 * 256); w.idle(); w.player.body.setVelocity(0, 0); });
    await page.waitForTimeout(1200);
    seen = await page.evaluate(() => { const v = Farm.world.cameras.main.worldView; return Farm.world.wild.animals.filter((a) => a.kind === 'gr_langay' && a.img.visible && v.contains(a.x, a.y)).length; });
  });
  console.log('[CPU x4] world work per frame (ms), and frame gaps:', JSON.stringify(rows), 'langay on screen:', seen);
  assert.ok(seen >= 5, 'a flock of 5 on screen (and the Gorge\'s own): ' + seen);
  assert.ok(rows.gorge.world.avg <= 14, 'the Gorge within the 60 Hz budget on average: ' + rows.gorge.world.avg + ' ms');
  assert.ok(rows.gorge.world.p50 <= Math.max(14, rows.plains.world.p50 * 1.5), 'and about as light as the Plains: ' + rows.gorge.world.p50 + ' vs ' + rows.plains.world.p50);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

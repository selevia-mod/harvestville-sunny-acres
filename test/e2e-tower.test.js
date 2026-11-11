// The Lost Tower, end to end in the built page (dist/index.html) in a phone-sized headless Chromium: in at Manila's
// lighthouse, floor 1's 20 enemies, the stairs up sealed until the floor is cleared, the Pearls paid once only, up to
// floor 2, a guard's floor, the lift at 11 (and the door bringing you back to it), the bag's Pearls, energy at 0 sending
// you out at the lighthouse, and a game closed in the Tower opening at the lighthouse.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-tower.test.js   (SHOTS=/some/dir: screenshots)
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
const NOON = [2026, 11, 12, 12, 0];

// the app's side of the packs (as test/e2e.test.js): the Tower is a wild map, so it needs the Wild Lands' pack
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

async function open(savedState, when = NOON) {
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
  await page.addInitScript(([state, now, here]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, at(when), allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, s = L.newState();
    eval(edit); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => { const T = 256; Farm.world.setFeet(tx * T + T / 2, ty * T + T / 2); Farm.world.dir = dir; Farm.world.idle(); }, [tx, ty, dir]);
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
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function waitFloor(page, f) {
  await page.waitForFunction((f) => Farm.world.mapKey === 'tower' && Farm.session.lairFloor === f && !Farm.world.busy && Farm.world.player.active && Farm.world.lair && Farm.world.lair.floor === f, f, SLOW);
  await frames(page, 3);
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const fromTower = (page) => page.evaluate(() => { const w = Farm.world, f = w.feet(), p = w.points.from_tower; return p ? Math.hypot(f.x - p.x, f.y - p.y) / 256 : 99; });

test('The Lost Tower: in at the lighthouse, floor 1 has 20 enemies, cleared the stairs up open and pay Pearls once only, floor 2, a guard, the lift at 11, energy 0 sends you out, a closed game opens at the lighthouse', async () => {
  // the lighthouse's door (Manila turned round: the bay on the right; L.towerDoor says where it is)
  const save = await makeSave("s.map = 'manila'; s.energy = 200; s.wild.n = 5; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 40); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); const d = L.towerDoor(); s.player = { x: (d.x + 0.5) * 256, y: (d.y + 1.5) * 256, dir: 'up' };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'manila');
  const door = await page.evaluate(() => Farm.Logic.towerDoor());
  const obj = await page.evaluate(() => { const o = Farm.world.objects.find((x) => x.name === 'tower_door'); return o && { type: o.type, x: o.x0, y: o.y0, to: o.props.to, label: o.props.label }; });
  assert.deepStrictEqual(obj, { type: 'warp', x: door.x, y: door.y, to: 'tower', label: 'Go in' }, 'the lighthouse is the door');
  await teleport(page, door.x, door.y + 1, 'up');
  await shot(page, 'tower-1-lighthouse');
  assert.strictEqual(await actionLabel(page), 'Go in');
  await tapAction(page);
  await waitFloor(page, 1);

  // floor 1: 28 x 24, 20 enemies of the first realm (stand-ins in their tints), the stairs sealed, the chip
  const here = await page.evaluate(() => {
    const w = Farm.world, Z = Farm.Config.TOWER.zones[0];
    return { size: [w.map.width, w.map.height], n: w.wild.animals.length, realm: w.wild.animals.every((a) => Z.normal.indexOf(a.kind) >= 0),
      tinted: w.wild.animals.every((a) => a.img.tintTopLeft !== 0xffffff), hp: w.wild.animals.map((a) => a.hp), open: w.lair.open, deep: Farm.session.state.tower.deep,
      sheet: w.map.getTileset('indoor').image.key, chip: Farm.ui.towerChipBox && Farm.ui.towerChipBox.visible && Farm.ui.towerText.text };
  });
  assert.deepStrictEqual(here.size, [28, 24]);
  assert.strictEqual(here.n, 20, 'floor 1 has 20 enemies');
  assert.ok(here.realm && here.tinted, 'Tambanakua\'s enemies, tinted stand-ins');
  assert.ok(here.hp.every((h) => h === 2), 'two hits each at damage 1');
  assert.strictEqual(here.open, false);
  assert.strictEqual(here.deep, 1);
  assert.strictEqual(here.sheet, 'indoor-tower-1', 'the cave tiles in the realm\'s colours');
  assert.match(here.chip, /^Floor 1 +20 left +Pearls 0$/);
  await page.waitForTimeout(700);
  await shot(page, 'tower-2-floor-1');
  // nobody walks in from the edges
  await page.evaluate(() => { const w = Farm.world; for (let i = 0; i < 40; i++) { w.wild.next = 0; w.wildArrive(0); } });
  assert.strictEqual(await page.evaluate(() => Farm.world.wild.animals.length), 20);
  // the stairs up: sealed, and they say so
  const gate = await page.evaluate(() => Farm.world.lair.gateRect);
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0 }); }); }); // (no charges while we look)
  await teleport(page, gate.x0, gate.y0 - 1, 'down');
  assert.strictEqual(await actionLabel(page), 'Sealed');
  await teleport(page, gate.x0, gate.y0, 'down');
  await page.waitForFunction(() => Farm.ui.toastText.visible && /stairs up are sealed\. 20 enemies/.test(Farm.ui.toastText.text), null, SLOW);
  await teleport(page, gate.x0, gate.y0 - 2, 'down');
  // one shot with the Bow at one of them, then the rest with the test helper
  const one = await page.evaluate(() => { const w = Farm.world, a = w.wild.animals[0]; a.hp = 1; w.wildStruck(a); return w.wild.animals.length; });
  assert.strictEqual(one, 19);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.wild.gone['tower:0']), undefined, 'no slot waits in the Tower');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.pearls), 0, 'nothing until the last one falls');
  assert.ok(await page.evaluate(() => Farm.towerClearFloor()));
  await page.waitForFunction(() => Farm.world.lair.open && Farm.world.lair.gate.glow.visible, null, SLOW);
  await page.waitForFunction(() => Farm.ui.toastText.visible && /Floor 1 cleared! \+1 Pearl/.test(Farm.ui.toastText.text), null, SLOW);
  await page.waitForFunction(() => Farm.ui.toastText.visible && /stairs up are open! Walk onto them for floor 2/.test(Farm.ui.toastText.text), null, SLOW);
  await frames(page, 10);
  let s = await state(page);
  assert.strictEqual(s.pearls, 1, 'floor 1 pays 1 Pearl');
  assert.strictEqual(s.tower.cl, 1);
  await teleport(page, gate.x0, gate.y0 - 1, 'down');
  await shot(page, 'tower-3-cleared');
  assert.strictEqual(await actionLabel(page), 'Go up');
  // the bag shows them
  await page.evaluate(() => Farm.ui.openInventory());
  assert.match(await modalText(page), /Pearls 1/);
  await page.evaluate(() => Farm.ui.closeAll());
  // up: walk onto the stairs
  await teleport(page, gate.x0, gate.y0, 'down');
  await waitFloor(page, 2);
  s = await state(page);
  assert.deepStrictEqual([s.tower.deep, s.pearls], [2, 1]);
  assert.deepStrictEqual(await page.evaluate(() => [Farm.world.wild.animals.length, Farm.world.lair.open]), [20, false]);
  // floor 1 again (by the lift): cleared again, it pays nothing
  await page.evaluate(() => Farm.world.travel('tower', 'entrance', 1));
  await waitFloor(page, 1);
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.open && Farm.world.lair.paid, null, SLOW);
  await frames(page, 6);
  assert.strictEqual((await state(page)).pearls, 1, 'Pearls paid once only');
  // floor 10: the Alimango Knight guards it, five times as tough, its bar from the start
  await page.evaluate(() => Farm.world.travel('tower', 'entrance', 10));
  await waitFloor(page, 10);
  const guard = await page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'alimango'); return a && { hp: a.hp, bar: !!a.bar, hit: a.def.hit, n: Farm.world.wild.animals.length }; });
  assert.deepStrictEqual(guard, { hp: 10, bar: true, hit: 3, n: 21 });
  await page.waitForTimeout(500);
  await shot(page, 'tower-4-guard');
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.paid, null, SLOW);
  assert.strictEqual((await state(page)).pearls, 1 + 5, 'a guard\'s floor pays 5 (its first time)');
  // the lift at 11: once you have been past it
  await page.evaluate(() => { Farm.session.state.tower.deep = 15; Farm.world.travel('tower', 'entrance', 1); });
  await waitFloor(page, 1);
  await teleport(page, 4, 3, 'left');
  assert.strictEqual(await actionLabel(page), 'Lift');
  await tapAction(page);
  assert.match(await modalText(page), /Tower Lift[\s\S]*Floor 11[\s\S]*Floor 1/);
  await shot(page, 'tower-5-lift');
  await tapButton(page, 'Go');
  await waitFloor(page, 11);
  assert.strictEqual(await page.evaluate(() => Farm.world.map.width), 28);
  // out by the ladder: at the lighthouse; in again at the door: the last lift you reached (11)
  await teleport(page, 5, 3, 'up');
  assert.strictEqual(await actionLabel(page), 'Go out');
  await tapAction(page);
  await waitMap(page, 'manila');
  assert.ok((await fromTower(page)) < 1, 'out in front of the lighthouse');
  await teleport(page, door.x, door.y + 1, 'up');
  await tapAction(page);
  await waitFloor(page, 11);
  // energy at 0: a charge that reaches you takes the last of it, and you are out at the lighthouse
  const hit = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, a = w.wild.animals[1];
    s.energy = 2;
    const lost = Farm.Logic.chargeLoss(s, a.def.hit, a.kind);
    a.x = w.feet().x + 200; a.y = w.feet().y;
    w.wildHit(a);
    return lost;
  });
  assert.strictEqual(hit, 2, 'floor 11: 2 energy a hit');
  await waitMap(page, 'manila');
  assert.ok((await fromTower(page)) < 1, 'out at the lighthouse');
  assert.strictEqual((await state(page)).energy, 0);
  // a game closed in the Tower opens at the lighthouse, its Pearls and floors kept
  await page.evaluate(() => { Farm.session.state.energy = 100; });
  await teleport(page, door.x, door.y + 1, 'up');
  await tapAction(page);
  await waitFloor(page, 11);
  const closed = await page.evaluate(() => { Farm.world.save(); return gameHost.saves[gameHost.saves.length - 1]; });
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(JSON.parse(closed));
  await waitMap(again.page, 'manila');
  assert.ok((await fromTower(again.page)) < 1, 'at the lighthouse');
  const back = await again.page.evaluate(() => ({ pearls: Farm.session.state.pearls, tower: Farm.session.state.tower }));
  assert.deepStrictEqual(back, { pearls: 6, tower: { deep: 15, cl: 10, hd: -1, hn: 0 } });
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('The Lost Tower in waves (C.TOWER.wave): the next wave comes when the last is mostly down; the stairs wait for the last wave', async () => {
  const save = await makeSave("s.map = 'manila'; s.energy = 200; s.wild.n = 5; s.tower.deep = 501; s.tower.cl = 500; const d = L.towerDoor(); s.player = { x: (d.x + 0.5) * 256, y: (d.y + 1.5) * 256, dir: 'up' };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'manila');
  await page.evaluate(() => { Farm.Config.TOWER.wave = 20; Farm.world.travel('tower', 'entrance', 501); });
  await waitFloor(page, 501);
  assert.deepStrictEqual(await page.evaluate(() => [Farm.world.map.width, Farm.world.map.height, Farm.world.wild.animals.length, Farm.towerLeft(Farm.world)]), [46, 38, 20, 60]);
  // floor 501: 22 hits each, 12 energy a hit, a quarter faster (once: the floor's numbers are made from the kind)
  assert.ok(await page.evaluate(() => Farm.world.wild.animals.every((a) => { const k = Farm.Config.WILD.animals[a.kind]; return a.hp === 22 && a.def.hit === 12 && Math.abs(a.def.run - k.run * 1.25) < 1e-9 && Math.abs(a.def.walk - k.walk * 1.25) < 1e-9; })));
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0 }); }); });
  // 16 of the first 20 down: not yet; the 17th: the second wave comes
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.slice(0, 15).forEach((a) => { a.hp = 0; a.mine = true; a.hits = 1; w.wildDown(a); }); });
  await frames(page, 6);
  assert.strictEqual(await page.evaluate(() => Farm.world.wild.animals.length), 5, 'a quarter of the wave still up: no new wave');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals[0]; a.hp = 0; a.mine = true; a.hits = 1; w.wildDown(a); });
  await page.waitForFunction(() => Farm.world.wild.animals.length === 24, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.world.lair.wave), 1);
  await page.waitForTimeout(800);
  await shot(page, 'tower-6-wave-2');
  // every one on the floor down, but a wave still to come: the stairs stay shut
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.slice().forEach((a) => { a.hp = 0; a.mine = true; a.hits = 1; w.wildDown(a); }); w.wild.next = 0; });
  await frames(page, 2);
  assert.strictEqual(await page.evaluate(() => Farm.world.lair.open), false);
  await page.waitForFunction(() => Farm.world.lair.wave === 2 && Farm.world.wild.animals.length === 20, null, SLOW);
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.open && Farm.world.lair.paid, null, SLOW);
  assert.strictEqual((await state(page)).pearls, 6, 'floor 501 pays 6 (realm 6)');
  await page.evaluate(() => { Farm.Config.TOWER.wave = 0; });
  assert.deepStrictEqual(problems, []);
  await context.close();
});

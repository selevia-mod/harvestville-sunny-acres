// The Lost Tower's Keeper's shop, the big bosses' rewards and lands 7-9, end to end in the built page (dist/index.html):
// Mang Ilaw at the lighthouse door, a Keeper's piece bought with Pearls (too few refused), fewer energy lost on a tower
// floor with it on, a big boss beaten giving its Blessing and Tide piece once, and the farm's new column: walk there, buy
// land 7 with Gold and Pearls, place a piece on it, raids' farm copy 75 wide.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-tower-shop.test.js   (SHOTS=/some/dir: screenshots)
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


const SETUP = "s.map = 'manila'; s.energy = 200; s.wild.n = 5; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 40); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); const d = L.towerDoor(); s.player = { x: (d.x + 0.5) * 256, y: (d.y + 1.5) * 256, dir: 'up' }; ";
const keeperAt = (page) => page.evaluate(() => { const k = Farm.world.keeper; return k && { x: Math.floor(k.x / 256), y: Math.floor(k.y / 256 - 0.3), visible: k.sp.visible && k.sp.active }; });
const faceKeeper = async (page) => {
  const k = await keeperAt(page);
  assert.ok(k && k.visible, 'the keeper is there');
  // stand below him, facing up (or above, if below is not free)
  for (const [dx, dy, dir] of [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) {
    await teleport(page, k.x + dx, k.y + dy, dir);
    if ((await actionLabel(page)) === 'Shop') return;
  }
  assert.fail('no Shop by the keeper');
};

test("Mang Ilaw's shop at the lighthouse: too few Pearls refused, the Coat bought with Pearls, fewer energy lost on a tower floor; the shop inside the Tower too", async () => {
  const save = await makeSave(SETUP + "s.pearls = 600; s.gold = 5000; s.tower.deep = 101; s.tower.cl = 100;");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'manila');
  await faceKeeper(page);
  await shot(page, 'shop-1-keeper');
  await tapAction(page);
  let text = await modalText(page);
  assert.match(text, /Mang Ilaw's Shop/);
  assert.match(text, /Pearls 600/);
  assert.match(text, /Keeper's Hat[\s\S]*300 Pearls[\s\S]*Keeper's Boots[\s\S]*Keeper's Coat[\s\S]*500 Pearls[\s\S]*Keeper's Lantern[\s\S]*800 Pearls/);
  assert.match(text, /A new weapon[\s\S]*Coming soon[\s\S]*Soon/);
  await shot(page, 'shop-2-panel');
  // the Lantern is 800: refused, nothing taken
  await tapButton(page, '800 Pearls');
  await page.waitForFunction(() => Farm.ui.toastText.visible && /You need 200 more Pearls/.test(Farm.ui.toastText.text), null, SLOW);
  let s = await state(page);
  assert.deepStrictEqual([s.pearls, s.gold, s.kpr], [600, 5000, 0], 'nothing taken');
  // the Coat
  await tapButton(page, '500 Pearls');
  await page.waitForFunction(() => Farm.session.state.kpr === 4, null, SLOW);
  s = await state(page);
  assert.deepStrictEqual([s.pearls, s.gold, s.gwear.body], [100, 5000, 'k:coat'], 'the Coat for 500 Pearls, worn');
  text = await modalText(page);
  assert.match(text, /Keeper's Coat \(on\)/);
  assert.match(text, /Worn: 20% less in the Tower/);
  // the horse page and the Tower page
  await tapButton(page, 'Horse');
  assert.match(await modalText(page), /Keeper's Saddle[\s\S]*400 Pearls[\s\S]*Keeper's Bridle[\s\S]*Horse Lantern/);
  await tapButton(page, 'Tower');
  assert.match(await modalText(page), /Tower Blessings[\s\S]*\+0% damage[\s\S]*The Tide set: 0 of 10/);
  await shot(page, 'shop-3-tower-page');
  await page.evaluate(() => Farm.ui.closeAll());
  // into the Tower: floor 101, a hit costs 4; with the Coat, 3
  const door = await page.evaluate(() => Farm.Logic.towerDoor());
  await teleport(page, door.x, door.y + 1, 'up');
  await tapAction(page);
  await waitFloor(page, 101);
  const hits = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, out = [];
    w.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0 }); });
    const a = w.wild.animals.find((x) => !x.def.boss);
    [true, false].forEach((on) => {
      if (on) Farm.Logic.wear(s, 'k:coat'); else Farm.Logic.takeOff(s, 'body');
      s.energy = 100;
      a.cool = 0; a.x = w.feet().x + 200; a.y = w.feet().y;
      w.wildHit(a);
      out.push(100 - s.energy);
    });
    Farm.Logic.wear(s, 'k:coat');
    return { out, loss: a.def.hit };
  });
  assert.strictEqual(hits.loss, 4, 'floor 101: 4 energy a hit');
  assert.deepStrictEqual(hits.out, [3, 4], 'the Coat: 3 instead of 4');
  // Mang Ilaw is in here too, by the way in
  await page.evaluate(() => { Farm.session.state.energy = 100; });
  await faceKeeper(page);
  await shot(page, 'shop-4-inside');
  await tapAction(page);
  assert.match(await modalText(page), /Mang Ilaw's Shop[\s\S]*Pearls 100/);
  await page.evaluate(() => Farm.ui.closeAll());
  // the Boots: faster in the Tower
  const speed = await page.evaluate(() => { const s = Farm.session.state; s.kpr |= 2; Farm.Logic.wear(s, 'k:boots'); return Farm.Logic.keeperSpeed(s); });
  assert.strictEqual(speed, 1.1);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a big boss beaten: its Blessing and its Tide piece once; floor 200 adds 10 energy', async () => {
  const save = await makeSave(SETUP + "s.tower.deep = 200; s.tower.cl = 99;");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'manila');
  const max0 = await page.evaluate(() => Farm.Logic.maxEnergy(Farm.session.state));
  await page.evaluate(() => Farm.world.travel('tower', 'entrance', 100));
  await waitFloor(page, 100);
  assert.ok(await page.evaluate(() => Farm.world.wild.animals.some((a) => a.kind === 'tambanakua')), 'Tambanakua is here');
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.paid, null, SLOW);
  await page.waitForFunction(() => Farm.ui.modals.length && /A TOWER BLESSING/.test(Farm.ui.modals.map((m) => { const o = []; const w = (l) => l.forEach((x) => { if (x.type === 'Text') o.push(x.text); if (x.list) w(x.list); }); w(m.c.list); return o.join(' '); }).join(' ')), null, SLOW);
  assert.match(await modalText(page), /\+5% damage in The Lost Tower[\s\S]*Tide Crown \(1 of 10\)/);
  await shot(page, 'boss-1-blessing');
  let s = await state(page);
  assert.deepStrictEqual([s.twb, s.pearls], [1, 100], 'boss 1 beaten, its 100 Pearls');
  const dmg = await page.evaluate(() => { const s = Farm.session.state; return [Farm.Logic.towerDamage(s), Farm.Logic.bowDamage(s)]; });
  assert.strictEqual(dmg[0], 1.05);
  await page.evaluate(() => Farm.ui.closeAll());
  // again: nothing more
  await page.evaluate(() => Farm.world.travel('tower', 'entrance', 100));
  await waitFloor(page, 100);
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.paid, null, SLOW);
  await page.waitForTimeout(1800);
  assert.ok(!/A TOWER BLESSING/.test(await modalText(page)), 'no second Blessing');
  s = await state(page);
  assert.deepStrictEqual([s.twb, s.pearls], [1, 100], 'paid once');
  // floor 200: +10 most energy
  await page.evaluate(() => { Farm.session.state.tower.cl = 199; Farm.world.travel('tower', 'entrance', 200); });
  await waitFloor(page, 200);
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.session.state.twb === 3, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.maxEnergy(Farm.session.state)), max0 + 10);
  await page.waitForTimeout(1800);
  assert.match(await modalText(page), /\+10 most energy, everywhere[\s\S]*Tide Shell Mantle \(2 of 10\)/);
  await page.evaluate(() => Farm.ui.closeAll());
  // the Tower page lists them
  await page.evaluate(() => Farm.ui.openTowerPage());
  const page1 = await modalText(page);
  assert.match(page1, /\+5% damage in The Lost Tower, \+10 most energy/);
  assert.match(page1, /The Tide set: 2 of 10[\s\S]*Tide Crown, Tide Shell Mantle/);
  assert.match(page1, /Floor 100: Tambanakua[\s\S]*Beaten!/);
  await shot(page, 'boss-2-tower-page');
  // the save keeps them
  const back = await page.evaluate(() => { const L = Farm.Logic, b = L.deserialize(JSON.parse(JSON.stringify(L.serialize(Farm.session.state)))); return [b.twb, L.tidePieces(b).length]; });
  assert.deepStrictEqual(back, [3, 2]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('lands 7-9: walk to the new column, the For Sale sign wants Gold and Pearls, buy land 7, place a piece on it; the raid copy is 75 wide', async () => {
  const save = await makeSave("s.land = 6; s.gold = 900000; s.pearls = 100; s.energy = 200;");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  assert.strictEqual(await page.evaluate(() => [Farm.world.map.width, Farm.Config.FARM_W].join()), '75,75');
  // fenced with signs, all three
  const fenced = await page.evaluate(() => [[62, 29], [62, 18], [62, 7]].map(([x, y]) => { const t = Farm.world.tileAt('Walls', x, y); return t && t.index === Farm.world.gids.land_sign; }));
  assert.deepStrictEqual(fenced, [true, true, true], 'For Sale signs');
  await teleport(page, 72, 24, 'left');
  await page.waitForTimeout(400);
  await shot(page, 'land-0-column');
  // walk there along the track at x 61, up from the bottom row
  await teleport(page, 61, 35, 'up');
  const y0 = await page.evaluate(() => Farm.world.feet().y);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => Farm.world.feet().y < 29.9 * 256, null, SLOW);
  await page.keyboard.up('ArrowUp');
  assert.ok((await page.evaluate(() => Farm.world.feet().y)) < y0 - 4 * 256, 'walked up the track');
  await teleport(page, 61, 29, 'right');
  assert.strictEqual(await actionLabel(page), 'For sale');
  await tapAction(page);
  assert.match(await modalText(page), /FOR SALE[\s\S]*800,000G and 250 Pearls[\s\S]*You need 150 more Pearls/);
  await shot(page, 'land-1-pearls');
  await page.evaluate(() => Farm.ui.closeAll());
  let s = await state(page);
  assert.deepStrictEqual([s.land, s.gold, s.pearls], [6, 900000, 100], 'nothing taken');
  // land 8's sign: not yet
  await teleport(page, 61, 18, 'right');
  assert.strictEqual(await actionLabel(page), 'For sale');
  await tapAction(page);
  assert.match(await modalText(page), /Not yet/);
  await page.evaluate(() => Farm.ui.closeAll());
  // with the Pearls
  await page.evaluate(() => { Farm.session.state.pearls = 300; });
  await teleport(page, 61, 29, 'right');
  await tapAction(page);
  assert.match(await modalText(page), /BUY THIS LAND\?[\s\S]*800,000G and 250 Pearls/);
  await tapButton(page, 'Yes');
  await frames(page, 5);
  const bought = await page.evaluate(() => { const w = Farm.world, s = w.state; return { land: s.land, gold: s.gold, pearls: s.pearls, fence: !!w.tileAt('Walls', 62, 29), till: w.isTillable(66, 30), next: w.isTillable(66, 18) }; });
  assert.deepStrictEqual(bought, { land: 7, gold: 100000, pearls: 50, fence: false, till: true, next: false });
  await teleport(page, 64, 29, 'right');
  await shot(page, 'land-2-bought');
  // a piece on it
  const placed = await page.evaluate(() => { const L = Farm.Logic, s = Farm.session.state, t = Farm.Config.OUTDOOR.index.planter; s.yard.bag[t] = 1; return typeof L.placeYard(s, Farm.farm(), t, 66, 27); });
  assert.strictEqual(placed, 'number');
  // the farm's raid copy: 75 wide, its loot where it is
  const copy = await page.evaluate(() => { const w = Farm.world, s = w.state; const L = Farm.Logic; s.soil[30 * 75 + 70] = { w: 1, c: 'turnip', p: L.nowMin() - L.growMins({ c: 'turnip', w: 1 }) - 5, r: 0 }; const c = w.raidCopy(); return { w: c.w, h: c.h, solid: c.solid.length, drop: c.drop.length, far: c.loot.some((p) => p.kind === 'crops' && p.x === 70 && p.y === 30), size: JSON.stringify(c).length }; });
  assert.deepStrictEqual([copy.w, copy.h, copy.solid, copy.drop, copy.far], [75, 38, 75 * 38, 75 * 38, true]);
  assert.ok(copy.size < 24576, 'the copy fits the server: ' + copy.size);
  // a reload keeps it all
  const saved = await page.evaluate(() => JSON.stringify(Farm.Logic.serialize(Farm.session.state)));
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(JSON.parse(saved));
  await waitMap(again.page, 'farm');
  const after = await again.page.evaluate(() => { const w = Farm.world; return { land: w.state.land, fence: !!w.tileAt('Walls', 62, 29), locked: !!w.tileAt('Walls', 62, 18), crop: !!w.state.soil[30 * 75 + 70], piece: w.state.yard.items.some((it) => it.x === 66 && it.y === 27) }; });
  assert.deepStrictEqual(after, { land: 7, fence: false, locked: true, crop: true, piece: true });
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

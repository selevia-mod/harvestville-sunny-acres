// Browser playthroughs of the horse going out (farm economy v2, part 5; docs/farm-economy-v2.md section 6;
// src/19zzzzzzzzzzzzzzzzzzzzzzzzz-horse-out.js): blocked without hearts or Horseshoes, the Stable, riding into the
// Wild Lands, stamina running out and the horse following, feeding it, shooting from the saddle, and being knocked off
// in a cave. Run alone (node --test --test-concurrency=1 test/e2e-horse-out.test.js) after node build.js.
// Set SHOTS=/some/dir to save screenshots.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const START = [2026, 11, 11, 10, 0];
const at = (when) => new Date(when[0], when[1] - 1, when[2], when[3] || 0, when[4] || 0).getTime();

// The app's side of the packs (as e2e-adventures.test.js): files from dist/packs and assets/looks, as the CDN would serve them
const fs = require('fs');
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file) || null, l = /^looks\/v1\/([a-z]+-(?:boy|girl)(?:-archer)?)$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : l ? path.join(__dirname, '..', 'assets', 'looks', l[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(savedState, when = START) {
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
    window.gameHost = { state: state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, at(when), allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a save from a fresh farm with a horse: `edit` runs in the page (s, L, C)
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    s.builds.stable = 1;
    s.horse = { name: 'Chestnut', love: 50, pet: 0 };
    s.gold = 50000;
    s.energy = 200;
    s.wild.n = 500; // (hunts: every hunting place and cave open)
    // eslint-disable-next-line no-eval
    if (edit) eval(edit);
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const what = (page) => page.evaluate(() => { const a = Farm.world.resolve(); return a ? { label: a.label, disabled: !!a.disabled, why: a.why || '' } : null; });
const toast = (page) => page.evaluate(() => (Farm.ui.toastText ? Farm.ui.toastText.text : ''));
const riding = (page) => page.evaluate(() => !!Farm.session.riding);
const stamina = (page) => page.evaluate(() => Farm.Logic.horseStamina(Farm.session.state));
const count = (page, id) => page.evaluate((id) => Farm.Logic.countItem(Farm.session.state, id), id);
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(150);
}
const hold = async (page, id) => {
  await page.evaluate((id) => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === id); Farm.world.hintKey = null; Farm.bus.emit('hud'); }, id);
  await frames(page);
};
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function go(page, map, spawn, floor) {
  await page.evaluate(([m, sp, fl]) => Farm.world.travel(m, sp, fl), [map, spawn, floor]);
  await waitMap(page, map);
}
// stand just above the horse, facing it (it is brought under you first: where it waited can be by a road's end)
async function toHorse(page) {
  await page.evaluate(() => { const w = Farm.world, h = w.horse, f = w.feet(); h.x = f.x; h.y = f.y + 0.75 * 256; w.dir = 'down'; w.idle(); });
  await frames(page, 3);
}
async function ride(page) {
  await toHorse(page);
  assert.strictEqual(await actionLabel(page), 'Ride');
  await tapAction(page);
  assert.ok(await riding(page), 'on the horse');
}
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
  return out.join(' | ');
});
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (!found[0]) { const tiles = []; const walk2 = (l) => l.forEach((o) => { if (o.row && (o.row.buttons || []).some((x) => x.label === label)) tiles.push(o); if (o.list) walk2(o.list); }); walk2(m.c.list); if (tiles[0]) { if (m.c.slimInto) m.c.slimInto(tiles[0].list[0]); const tb = tiles[0].getBounds(); return { x: tb.centerX, y: tb.centerY }; } }
    if (found[0] && m.c.slimInto) m.c.slimInto(found[0]);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  const n0 = await page.evaluate(() => Farm.ui.modals.length);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
  if (await page.evaluate((n0) => Farm.ui.modals.length === n0 + 1 && !!Farm.ui.modals[n0].c.tileDetail, n0)) await tapButton(page, label);
}
// gallop (or walk) with the arrow keys for `ms`
async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await frames(page, 2);
}

test('bond and gear open places: blocked without 6 hearts, then without Horseshoes; the Stable makes them; then into the Wild Lands', async () => {
  const save = await makeSave("L.addItem(s, 'ore_copper', 5); L.addItem(s, 'leather_soft', 1);");
  const { page, problems, context } = await open(save);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.horseHearts(Farm.session.state)), 5);
  await ride(page);
  await go(page, 'town', 'from_farm');
  assert.ok(await riding(page), 'town opens at 3 hearts');
  // the road west: Pulag is the Wild Lands (6 hearts)
  await go(page, 'pulag', 'from_town');
  assert.ok(!(await riding(page)), 'on foot in Pulag');
  assert.match(await toast(page), /Chestnut needs 6 hearts for the Wild Lands \(it has 5\)\. Pet it and give it Pet Meals\.\nIt waits here for you\./);
  assert.strictEqual(await page.evaluate(() => Farm.world.horse), null, 'not here');
  assert.strictEqual(await page.evaluate(() => Farm.session.horseAt.map), 'town', 'it waits in town');
  await go(page, 'town', 'from_pulag');
  assert.ok(await page.evaluate(() => !!Farm.world.horse), 'still in town where you left it');
  // 6 hearts, no Horseshoes
  await page.evaluate(() => { Farm.session.state.horse.love = 60; });
  await ride(page);
  await go(page, 'pulag', 'from_town');
  assert.ok(!(await riding(page)));
  assert.match(await toast(page), /Chestnut needs Horseshoes for the Wild Lands\. Make them at the Stable\./);
  // the Stable, on the farm
  await go(page, 'farm', 'from_town');
  await page.evaluate(() => {
    const w = Farm.world, o = w.objects.find((x) => x.type === 'stable');
    w.setFeet((o.x0 + 1.5) * 256, (o.y1 + 1.5) * 256); w.dir = 'up'; w.idle();
  });
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Stable');
  await tapAction(page);
  let t = await modalText(page);
  assert.match(t, /Chestnut's Stable/);
  assert.match(t, /♥ 6\/10 hearts · Stamina 100\/100/);
  assert.match(t, /Horseshoes/);
  assert.match(t, /Lantern Bridle/);
  assert.match(t, /Saddlebags/);
  assert.match(t, /Saddlebags \| 2 Soft Leather, 3 Rope, 1,200G\./); // (part 3: Rope from the Mixer, so they can be made)
  await shot(page, 'horse-stable');
  await tapButton(page, 'Make');
  await page.waitForFunction(() => Farm.Logic.horseHas(Farm.session.state, 'horseshoes'), null, SLOW);
  assert.strictEqual(await count(page, 'ore_copper'), 0);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.gold), 50000 - 800);
  await page.evaluate(() => Farm.ui.closeAll());
  // the horse is back at the stable (a new map: where you left it today is town)
  await go(page, 'town', 'from_farm');
  await ride(page);
  await go(page, 'pulag', 'from_town');
  assert.ok(await riding(page), 'riding in the Wild Lands');
  assert.ok(await page.evaluate(() => Farm.world.horse && Farm.world.hbar && Farm.world.hbar.visible), 'the stamina bar shows');
  // a gallop drains stamina; town did not
  assert.strictEqual(await stamina(page), 100);
  await holdKey(page, 'ArrowLeft', 700); // (west: into Pulag; east is the road back to town)
  const st = await stamina(page);
  assert.ok(st < 100 && st > 80, 'a little stamina gone: ' + st);
  await shot(page, 'horse-pulag-riding');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('stamina runs out: you walk and it follows you, through a road too; feeding it lets you ride again', async () => {
  const save = await makeSave("s.horse.love = 100; s.horse.g = 3; s.horse.st = 3; L.addItem(s, 'oats', 2); L.addItem(s, 'hoe', 1);");
  const { page, problems, context } = await open(save);
  await ride(page);
  await go(page, 'town', 'from_farm');
  await go(page, 'pulag', 'from_town');
  assert.ok(await riding(page));
  await holdKey(page, 'ArrowUp', 900);
  await page.waitForFunction(() => !Farm.session.riding, null, SLOW);
  assert.strictEqual(await stamina(page), 0);
  assert.match(await toast(page), /Chestnut is worn out and stops\. You walk on, and it follows you\./);
  assert.ok(await page.evaluate(() => Farm.session.horseFollow), 'it follows');
  // you walk on: it keeps near
  await holdKey(page, 'ArrowLeft', 1500);
  const gap = await page.evaluate(() => { const w = Farm.world, f = w.feet(); return Math.hypot(w.horse.x - f.x, w.horse.y - f.y) / 256; });
  assert.ok(gap < 3, 'it walked after you: ' + gap.toFixed(1) + ' tiles');
  await shot(page, 'horse-tired-follows');
  // a road: it comes too
  await go(page, 'makiling', 'from_pulag');
  assert.ok(await page.evaluate(() => !!Farm.world.horse), 'it followed you to Makiling Forest');
  // too tired to carry you
  await hold(page, 'hoe');
  await toHorse(page);
  assert.deepStrictEqual(await what(page), { label: 'Ride', disabled: true, why: 'Chestnut is too tired to carry you. Feed it oats, an apple or a carrot.' });
  // feed it
  await hold(page, 'oats');
  assert.strictEqual(await actionLabel(page), 'Feed');
  await tapAction(page);
  assert.strictEqual(await stamina(page), 40);
  assert.strictEqual(await count(page, 'oats'), 1);
  assert.match(await toast(page), /Chestnut perks up\. You can ride again!/);
  await hold(page, 'hoe');
  await ride(page);
  assert.ok(await page.evaluate(() => !Farm.session.horseFollow), 'ridden, not following');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('shooting from the saddle: an arrow flies, you stay on and keep moving', async () => {
  const save = await makeSave("s.horse.love = 100; s.horse.g = 3; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 10);");
  const { page, problems, context } = await open(save);
  await ride(page);
  await go(page, 'town', 'from_farm');
  await go(page, 'pulag', 'from_town');
  await hold(page, 'bow');
  assert.strictEqual(await actionLabel(page), 'Shoot');
  const e0 = await page.evaluate(() => Farm.session.state.energy);
  await page.evaluate(() => { const w = Farm.world, f = w.wildArrow; w.arrowsShot = 0; w.wildArrow = function () { w.arrowsShot++; return f.apply(this, arguments); }; });
  await page.keyboard.down('ArrowLeft'); // (west: into Pulag; east is the road back to town)
  await page.waitForTimeout(250);
  await tapAction(page);
  const flying = await page.evaluate(() => Farm.world.arrowsShot);
  const moving = await page.evaluate(() => Math.hypot(Farm.world.player.body.velocity.x, Farm.world.player.body.velocity.y));
  await shot(page, 'horse-shoot-riding');
  await page.keyboard.up('ArrowLeft');
  assert.strictEqual(flying, 1, 'an arrow flew');
  assert.ok(moving > Farm_SPEED(), 'still galloping: ' + moving);
  assert.ok(await riding(page), 'still on the horse');
  assert.strictEqual(await count(page, 'arrows'), 9);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.energy), e0 - 2, 'a shot costs its energy');
  assert.ok(await page.evaluate(() => !Farm.world.shot && Farm.world.horse.sprite.visible), 'no archer stance: the rider stays drawn');
  // one arrow at a time: a second tap at once does nothing, a moment later it shoots
  await page.evaluate(() => { const w = Farm.world; w.rideShotAt = 0; w.shoot(); w.shoot(); });
  assert.strictEqual(await count(page, 'arrows'), 8, 'two taps at once: one arrow');
  await page.waitForTimeout(500);
  await page.evaluate(() => Farm.world.shoot());
  assert.strictEqual(await count(page, 'arrows'), 7);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
function Farm_SPEED() { return 1152 * 1.2; } // (faster than walking: C.SPEED 1152, the horse 1.7 times)

test('in a cave a big monster can knock you off: the horse runs to the way in and waits, on every floor, and comes out with you', async () => {
  const save = await makeSave("s.horse.love = 100; s.horse.g = 3;");
  const { page, problems, context } = await open(save);
  await ride(page);
  await go(page, 'banaue_cave', 'entrance', 1);
  assert.ok(await riding(page), 'riding in a cave (10 hearts, Horseshoes and the Lantern Bridle)');
  await page.evaluate(() => { Farm.Config.HORSE_OUT.knockOdds = 1; }); // (every big hit knocks: the test)
  const hit = (big) => page.evaluate((big) => {
    const w = Farm.world, f = w.feet();
    w.setFeet(f.x, f.y);
    w.wildHit({ def: big ? { hit: 18, boss: true, walk: 1 } : { hit: 6, walk: 1 }, kind: 'cave_bayawak', x: f.x - 256, y: f.y, mode: 'charge' });
  }, big);
  await page.evaluate(() => { const w = Farm.world, e = w.points.entrance; w.setFeet(e.x, e.y + 5 * 256); });
  await frames(page, 3);
  await hit(false);
  assert.ok(await riding(page), 'a small one does not');
  await hit(true);
  assert.ok(!(await riding(page)), 'knocked off');
  assert.match(await toast(page), /Thud! You fell off\. Chestnut ran back to the way in and waits there\./);
  assert.ok(await page.evaluate(() => Farm.session.horseAt.entrance && !Farm.session.horseFollow));
  await page.waitForFunction(() => !Farm.world.horse.run, null, SLOW);
  const d = await page.evaluate(() => { const w = Farm.world, e = w.points.entrance; return Math.hypot(w.horse.x - e.x, w.horse.y - e.y) / 256; });
  assert.ok(d < 2, 'it waits by the way in: ' + d.toFixed(1));
  await shot(page, 'horse-knocked-off');
  // the next floor: it waits by the way in there too
  await go(page, 'banaue_cave', 'entrance', 2);
  assert.ok(await page.evaluate(() => { const w = Farm.world, e = w.points.entrance; return !!w.horse && Math.hypot(w.horse.x - e.x, w.horse.y - e.y) < 2 * 256; }));
  // climb out: it comes with you
  await go(page, 'banaue', 'from_dungeon');
  assert.ok(await page.evaluate(() => !!Farm.world.horse && Farm.session.horseFollow), 'out of the cave with you');
  await ride(page);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('old saves: a horse from before rides in town (3 hearts once); visiting needs nothing new', async () => {
  const save = await makeSave('s.horse.love = 4;');
  save.hs = [4, 0]; // (as a save from before this update)
  const { page, problems, context } = await open(save);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.horseHearts(Farm.session.state)), 3);
  await ride(page);
  await go(page, 'town', 'from_farm');
  assert.ok(await riding(page), 'still rides in town');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

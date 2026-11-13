// The Lost Tower's food, end to end in the built page (dist/index.html) in a phone-sized headless Chromium (the rules:
// test/tower-food.test.js): a floor's enemies drop its ingredient on the floor (picked up by walking over it), a dish is
// cooked in the Kitchen and eaten (its toast, its chip), its power works on the next realm's trick (Sinigang na Talangka:
// 3 Bow hits break a shield), Mang Ilaw sells the Baon for Gold, and the Baon feeds you by itself under 15 energy.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-tower-food.test.js   (SHOTS=/some/dir: screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const NOON = [2026, 11, 13, 12, 0];

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

async function open(savedState) {
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
  }, [savedState || null, at(NOON), allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => {
    Farm.Logic.weather = () => 'sunny';
    // every toast, kept (the Tower hushes some while an enemy goes down: it puts its own back after)
    window.__toasts = [];
    const t = Farm.ui.toast;
    Farm.ui.toast = function (msg) { window.__toasts.push(String(msg)); return t.apply(this, arguments); };
  });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a save at Manila's lighthouse with the floors open up to `deep`, the Bow and arrows, a Kitchen, and `edit`
const SETUP = "s.tips = -1; s.tq = -1; s.tq2 = -1; s.map = 'manila'; s.energy = 200; s.wild.n = 900; s.builds.kitchen = 1; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 99); " +
  "s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); const d = L.towerDoor(); s.player = { x: (d.x + 0.5) * 256, y: (d.y + 1.5) * 256, dir: 'up' };";
async function makeSave(deep, edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate(([setup, deep, edit]) => {
    const L = Farm.Logic, s = L.newState();
    s.gold = 0; s.lumber = 999;
    eval(setup); // eslint-disable-line no-eval
    s.tower.deep = deep;
    s.tower.cl = deep;
    eval(edit || ''); // eslint-disable-line no-eval
    return L.serialize(s);
  }, [SETUP, deep, edit]);
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
async function waitFloor(page, f) {
  await page.waitForFunction((f) => Farm.world.mapKey === 'tower' && Farm.session.lairFloor === f && !Farm.world.busy && Farm.world.player.active && Farm.world.lair && Farm.world.lair.floor === f, f, SLOW);
  await frames(page, 3);
}
async function toFloor(deep, f, edit) {
  const o = await open(await makeSave(deep, edit));
  await o.page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy, null, SLOW);
  await o.page.evaluate((f) => Farm.world.travel('tower', 'entrance', f), f);
  await waitFloor(o.page, f);
  await o.page.evaluate(() => { if (Farm.ui.closeAll) Farm.ui.closeAll(); });
  await frames(o.page, 2);
  return o;
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const calm = (page) => page.evaluate(() => { Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0 }); }); });
// the rows a list panel was opened with (the Kitchen's, the Keeper's, the Baon's)
// (the innermost: every wrap has added its rows by then)
const ROWS = 'window.__rows = null; if (!Farm.ui.__lp) { Farm.ui.__lp = Farm.ui.lookListPanel; Farm.ui.lookListPanel = function (o) { window.__rows = o.rows; return Farm.ui.__lp.apply(this, arguments); }; }';

test('a floor drops its ingredient: a normal enemy 1 in 4 (on the floor, picked up), the guard 2 always; never at the stand', async () => {
  const { page, problems, context } = await toFloor(10, 10);
  await calm(page);
  const r = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, L = Farm.Logic, list = w.wild.animals, out = {};
    const beat = (a) => { a.hp = Math.min(a.hp, L.bowDamage(s)); w.wildStruck(a); };
    const rnd = Math.random;
    // a normal one with a lucky roll: one Talangka Meat on the floor
    Math.random = () => 0.1;
    const a = list.find((x) => x.def.role === 'normal');
    const n0 = w.wildDrops.length;
    try { beat(a); } finally { Math.random = rnd; }
    out.normal = w.wildDrops.slice(n0).map((d) => d.id);
    out.shown = w.wildDrops.slice(n0).every((d) => d.img && d.img.active && d.img.visible && d.img.frame.name === Farm.Config.ITEMS[d.id].icon);
    // an unlucky one: nothing
    Math.random = () => 0.9;
    const b = list.find((x) => x.def.role === 'normal');
    const n1 = w.wildDrops.length;
    try { beat(b); } finally { Math.random = rnd; }
    out.unlucky = w.wildDrops.length - n1;
    // the guard: its Tinola and 2 Talangka Meat
    const g = list.find((x) => x.def.role === 'guard');
    out.guardKind = g.kind;
    const n2 = w.wildDrops.length;
    Math.random = () => 0.9;
    try { while (g.hp > 0 && list.includes(g)) beat(g); } finally { Math.random = rnd; }
    out.guard = w.wildDrops.slice(n2).map((d) => d.id).sort();
    // walk over them: into the bag
    w.wildDrops.slice().forEach((d) => { w.setFeet(d.x, d.y); w.pickWildDrops(); });
    out.bag = L.countItem(s, 'tw_talangka_meat');
    out.price = L.basePrice('tw_talangka_meat');
    return out;
  });
  assert.deepStrictEqual(r.normal, ['tw_talangka_meat'], 'a normal enemy of the Tide Stairs: Talangka Meat');
  assert.ok(r.shown, 'it lands on the floor, in its own icon');
  assert.strictEqual(r.unlucky, 0, '3 times in 4: nothing');
  assert.strictEqual(r.guardKind, 'alimango');
  assert.deepStrictEqual(r.guard, ['tinola', 'tw_talangka_meat', 'tw_talangka_meat'], 'the guard: its Tinola and 2 Talangka Meat');
  assert.strictEqual(r.bag, 3, 'picked up by walking over them');
  assert.strictEqual(r.price, 0, 'never sold');
  await shot(page, 'food-drop');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('cooked in the Kitchen, eaten (its toast, its chip), its power on the next realm\'s trick: 3 Bow hits break a shield', async () => {
  const { page, problems, context } = await toFloor(150, 150, "L.addItem(s, 'tw_talangka_meat', 1); L.addItem(s, 'tomato', 1); L.addItem(s, 'radish', 1);");
  await calm(page);
  // the Kitchen: its row, Cook
  const cooked = await page.evaluate((rows) => {
    eval(rows); // eslint-disable-line no-eval
    Farm.ui.openKitchen();
    const row = window.__rows.find((x) => x.name === 'Sinigang na Talangka');
    const out = { row: !!row, desc: row && row.desc, icon: row && row.icon };
    row.buttons[0].cb();
    out.have = Farm.Logic.countItem(Farm.session.state, 'sinigang_talangka');
    out.left = ['tw_talangka_meat', 'tomato', 'radish'].map((id) => Farm.Logic.countItem(Farm.session.state, id));
    Farm.ui.closeAll();
    return out;
  }, ROWS);
  assert.ok(cooked.row, 'the Kitchen lists it');
  assert.match(cooked.desc, /Talangka Meat \+ Tomato \+ Radish\. \+70 energy\./);
  assert.strictEqual(cooked.icon, 2210, 'its own icon');
  assert.strictEqual(cooked.have, 1);
  assert.deepStrictEqual(cooked.left, [0, 0, 0]);
  // eat it
  await page.evaluate(() => { const s = Farm.session.state; s.energy = 50; s.sel = s.inv.findIndex((x) => x && x.id === 'sinigang_talangka'); });
  await frames(page);
  assert.strictEqual(await page.evaluate(() => { const a = Farm.world.resolve(); return a && a.label; }), 'Eat');
  await page.evaluate(() => { window.__toasts = []; Farm.world.resolve().run(); Farm.world.powerChip(); });
  await frames(page);
  const ate = await page.evaluate(() => ({
    toasts: window.__toasts, dish: Farm.Logic.towerDish(Farm.session.state), energy: Farm.session.state.energy,
    chip: Farm.ui.foodChip && Farm.ui.foodChip.box.visible ? Farm.ui.foodChip.text.text : null, frame: Farm.ui.foodChip && Farm.ui.foodChip.icon.frame.name,
  }));
  assert.ok(ate.toasts.some((t) => /^Sinigang na Talangka: in The Lost Tower, for 15 minutes, your Bow and Javelin crack shields too/.test(t)), ate.toasts.join(' | '));
  assert.strictEqual(ate.dish, 'sinigang_talangka');
  assert.ok(ate.energy > 50);
  assert.strictEqual(ate.chip, '15 min', 'its chip in the potions\' row');
  assert.strictEqual(ate.frame, 2210);
  await shot(page, 'food-chip');
  // a shielded one: crack, crack, broken; then the Bow hurts it
  const r = await page.evaluate(() => {
    const w = Farm.world, a = w.wild.animals.find((x) => x.shield), hp = a.hp, out = [];
    for (let i = 0; i < 3; i++) { w.wildStruck(a); out.push([a.hp === hp, a.shield]); }
    const words = Object.keys(Farm.towerTk().pools).filter((k) => /^w:Crack/.test(k));
    w.wildStruck(a);
    return { out, words, after: hp - a.hp };
  });
  assert.deepStrictEqual(r.out, [[true, true], [true, true], [true, false]], 'two cracks, the third breaks it (no damage on the way)');
  assert.deepStrictEqual(r.words.sort(), ['w:Crack 1/3', 'w:Crack 2/3']);
  assert.ok(r.after > 0, 'then it takes the Bow\'s hits');
  // 15 minutes later: over, the chip gone
  await page.evaluate(() => { window.__now += 15 * 60000 + 1000; Farm.world.powerChip(); });
  assert.strictEqual(await page.evaluate(() => Farm.ui.foodChip.box.visible), false);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Mang Ilaw sells the Baon for 5,000 Gold; packed from its page, it feeds you by itself under 15 energy in the Tower', async () => {
  const { page, problems, context } = await toFloor(5, 5, "s.gold = 6000; L.addItem(s, 'tinola', 1); L.addItem(s, 'kaldereta', 1);");
  await calm(page);
  const bought = await page.evaluate((rows) => {
    eval(rows); // eslint-disable-line no-eval
    const s = Farm.session.state, L = Farm.Logic;
    Farm.ui.openKeeper('gear', 0);
    const row = window.__rows.find((x) => /^Baon/.test(x.name));
    const out = { row: !!row, label: row && row.buttons[0].label, last: window.__rows[window.__rows.length - 1].name };
    row.buttons[0].cb();
    out.gold = s.gold;
    out.own = L.baonOwned(s);
    out.again = window.__rows.find((x) => /^Baon/.test(x.name)).buttons[0].label;
    Farm.ui.closeAll();
    // held: its own button opens its page; pack the Tinola there
    s.sel = s.inv.findIndex((x) => x && x.id === 'baon');
    const act = Farm.world.resolve();
    out.act = act && act.label;
    act.run();
    const pack = window.__rows.find((x) => /^Labuyo Tinola/.test(x.name));
    pack.buttons[0].cb();
    out.packed = (s.tfb || []).slice();
    out.tinola = L.countItem(s, 'tinola');
    Farm.ui.closeAll();
    return out;
  }, ROWS);
  assert.ok(bought.row, 'on his Gear page');
  assert.strictEqual(bought.label, '5,000G');
  assert.strictEqual(bought.last, 'A new weapon', '"A new weapon" stays last');
  assert.deepStrictEqual([bought.gold, bought.own, bought.again], [1000, true, 'Open']);
  assert.strictEqual(bought.act, 'Baon');
  assert.deepStrictEqual([bought.packed, bought.tinola], [['tinola'], 0]);
  // 20 energy: nothing; 12: it eats the Tinola by itself
  await page.evaluate(() => { window.__toasts = []; Farm.session.state.energy = 20; });
  await page.waitForTimeout(600);
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.tfb.slice()), ['tinola']);
  await page.evaluate(() => { Farm.session.state.energy = 12; });
  await page.waitForFunction(() => !Farm.session.state.tfb.length, null, { timeout: 5000 });
  const r = await page.evaluate(() => ({ e: Farm.session.state.energy, toasts: window.__toasts }));
  assert.ok(r.e > 12, 'fed: ' + r.e);
  assert.ok(r.toasts.some((t) => /^Your Baon: you ate the Labuyo Tinola! It is empty now\./.test(t)), r.toasts.join(' | '));
  await shot(page, 'food-baon');
  // a big hit to 0 with food packed: the Baon first, no fainting
  const saved = await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic;
    s.sel = s.inv.findIndex((x) => x && x.id === 'kaldereta');
    L.baonPack(s, s.sel);
    s.energy = 0;
    Farm.world.faint();
    return { map: Farm.world.mapKey, e: s.energy, left: s.tfb.length };
  });
  assert.deepStrictEqual([saved.map, saved.e > 0, saved.left], ['tower', true, 0]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Owner, 13 Nov 2026 ("Check the drops in towers and the lunch box, why those arts did not change?"): the owner's food
// picture was fetched only when the bag or the Kitchen opened, so a drop on a floor (and the Baon) showed the drawn
// stand-in. Walking into the Tower now asks for it: the floor's drops are painted from the owner's sheet, bag never opened.
test('into the Tower, the bag never opened: the owner\'s food picture comes, and the drops on the floor are painted from it', async () => {
  const { page, problems, context } = await toFloor(1, 1);
  await page.waitForFunction(() => !!(Farm.images && Farm.images.tower_food_icons), null, SLOW);
  const r = await page.evaluate(() => {
    const w = Farm.world, f = w.feet(), C = Farm.Config;
    w.dropWild('tw_talangka_meat', f.x + 200, f.y);
    const tex = w.textures.get('items'), fr = tex.get(C.ITEMS.tw_talangka_meat.icon), art = Farm.images.tower_food_icons;
    // the frame's pixels are the owner's cell (not the drawn one): compare a few pixels of each
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    g.drawImage(fr.source.image, fr.cutX, fr.cutY, 128, 128, 0, 0, 128, 128);
    const o = document.createElement('canvas'); o.width = 128; o.height = 128; const h = o.getContext('2d');
    const i = C.FOOD_ICONS.indexOf('tw_talangka_meat');
    h.drawImage(art, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128, 0, 0, 128, 128);
    const a = g.getImageData(0, 0, 128, 128).data, b = h.getImageData(0, 0, 128, 128).data;
    let same = 0, n = 0;
    for (let y = 8; y < 120; y += 8) for (let x = 8; x < 120; x += 8) { const k = (y * 128 + x) * 4; n++; if (Math.abs(a[k] - b[k]) < 12 && Math.abs(a[k + 1] - b[k + 1]) < 12 && Math.abs(a[k + 3] - b[k + 3]) < 12) same++; }
    return { same, n };
  });
  assert.ok(r.same / r.n > 0.9, 'the drop is the owner\'s picture: ' + JSON.stringify(r));
  await shot(page, 'tower-food-drop-art');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

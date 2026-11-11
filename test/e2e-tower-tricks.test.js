// The Lost Tower's tricks, end to end in the built page (dist/index.html) in a phone-sized headless Chromium (the rules:
// test/tower-tricks.test.js): a shield stops a Bow shot and breaks on a Rifle shot; a puddle slows you and dries; a singer
// slows your shots; a flock circles and dives; a healer heals another; the dark has a hole round you and lights round the
// fire creatures; a splitter leaves two and the stairs wait for them; a reviver stands up unless hit again; and floor 951,
// every trick and 60 enemies, runs for a few seconds with no errors.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-tower-tricks.test.js   (SHOTS=/some/dir: screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const NOON = [2026, 11, 12, 12, 0];

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
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a save at Manila's lighthouse with the floors open up to `deep`, the Bow, the Rifle and bullets
const SETUP = "s.tips = -1; s.tq = -1; s.tq2 = -1; s.map = 'manila'; s.energy = 200; s.wild.n = 5; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 99); L.getWeapon(s, 'rifle'); L.addItem(s, 'bullets', 50); " +
  "s.gold = 0; s.sel = s.inv.findIndex((x) => x && x.id === 'rifle'); const d = L.towerDoor(); s.player = { x: (d.x + 0.5) * 256, y: (d.y + 1.5) * 256, dir: 'up' };";
async function makeSave(deep) {
  const { page, context } = await open(null);
  const save = await page.evaluate(([edit, deep]) => {
    const L = Farm.Logic, s = L.newState();
    s.gold = 1e6; s.lumber = 999;
    eval(edit); // eslint-disable-line no-eval
    s.tower.deep = deep;
    s.tower.cl = deep;
    return L.serialize(s);
  }, [SETUP, deep]);
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
async function waitFloor(page, f) {
  await page.waitForFunction((f) => Farm.world.mapKey === 'tower' && Farm.session.lairFloor === f && !Farm.world.busy && Farm.world.player.active && Farm.world.lair && Farm.world.lair.floor === f, f, SLOW);
  await frames(page, 3);
}
async function toFloor(deep, f) {
  const o = await open(await makeSave(deep));
  await o.page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy, null, SLOW);
  await o.page.evaluate((f) => Farm.world.travel('tower', 'entrance', f), f);
  await waitFloor(o.page, f);
  await o.page.evaluate(() => { if (Farm.ui.closeAll) Farm.ui.closeAll(); });
  await frames(o.page, 2);
  return o;
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
// (no charges while we look: the tests' own way, as test/e2e-tower.test.js)
const calm = (page) => page.evaluate(() => { Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0 }); }); });
// put enemy i at tile (tx, ty) (feet), still
const PUT = 'window.put = (a, tx, ty) => { a.x = tx * 256 + 128; a.y = ty * 256 + 128; a.vx = a.vy = 0; a.mode = "idle"; a.t = 1e9; Farm.world.drawWild(a); };';
const me = (page, tx, ty) => page.evaluate(([tx, ty]) => { Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.idle(); }, [tx, ty]);

test('shielded (floor 150): a Bow hit bounces off ("Shield!"), a Rifle shot breaks it, then it takes hits', async () => {
  const { page, problems, context } = await toFloor(150, 150);
  await calm(page);
  const r = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, list = w.wild.animals, a = list.find((x) => x.shield), plain = list.find((x) => !x.shield && x.def.role === 'normal');
    const out = { n: list.length, shielded: list.filter((x) => x.shield).length, lead: list[0].kind, leadShield: list[0].shield, img: !!(a.shieldImg && a.shieldImg.visible) };
    const hp = a.hp;
    w.wildStruck(a); // the Bow
    out.bow = [a.hp === hp, a.shield];
    s.wpnHit = { k: 'javelin', lv: 3 }; w.wildStruck(a); s.wpnHit = null;
    out.javelin = [a.hp === hp, a.shield];
    out.word = Object.keys(Farm.towerTk().pools).some((k) => k === 'w:Shield!' && Farm.towerTk().pools[k].list.some((o) => o.visible));
    w.wpnStrike({ k: 'rifle', lv: 0 }, a); // a Rifle shot: the shield breaks, the shot spent on it
    out.rifle = [a.hp === hp, a.shield, a.shieldImg];
    w.wildStruck(a); // now the Bow hurts it
    out.after = hp - a.hp;
    const php = plain.hp;
    w.wildStruck(plain);
    out.plain = php - plain.hp;
    return out;
  });
  assert.strictEqual(r.lead, 'pating', 'floor 150: Pating na Bakal, the mini boss... ');
  assert.ok(r.leadShield, '...in its armour');
  assert.ok(r.shielded >= 2 && r.shielded < r.n, 'some, not all, carry one: ' + r.shielded + ' of ' + r.n);
  assert.ok(r.img, 'the shield shows');
  assert.deepStrictEqual(r.bow, [true, true], 'the Bow: no damage, the shield holds');
  assert.deepStrictEqual(r.javelin, [true, true], 'the Javelin: the same');
  assert.ok(r.word, '"Shield!" over it');
  assert.deepStrictEqual(r.rifle, [true, false, null], 'the Rifle breaks it');
  assert.strictEqual(r.after, 1, 'then a Bow hit lands');
  assert.strictEqual(r.plain, 1, 'one with no shield takes the Bow as ever');
  await page.waitForTimeout(200);
  await shot(page, 'tricks-1-shield');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('bursting (floor 250): a beaten one leaves a puddle; in it you walk 40% slower; it dries in 6 s', async () => {
  const { page, problems, context } = await toFloor(250, 250);
  await calm(page);
  await me(page, 12, 10);
  const spot = await page.evaluate(() => {
    const w = Farm.world, a = w.wild.animals.find((x) => !x.shield);
    a.x = 12 * 256 + 128; a.y = 14 * 256 + 128;
    a.hp = 1; w.wildStruck(a);
    const p = Farm.towerTk().puddles;
    return { n: p.length, x: p[0].x, y: p[0].y, vis: p[0].img.visible, left: p[0].until - w.time.now };
  });
  assert.strictEqual(spot.n, 1);
  assert.deepStrictEqual([spot.x, spot.y], [12 * 256 + 128, 14 * 256 + 128], 'where it fell');
  assert.ok(spot.vis && spot.left > 5800 && spot.left < 6000.01, 'for 6 s: ' + JSON.stringify(spot));
  // walking: top speed outside, then in the puddle
  const speed = async (tx, ty) => {
    await me(page, tx, ty);
    await page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = -1; });
    await page.waitForTimeout(160);
    const v = await page.evaluate(() => Math.abs(Farm.world.player.body.velocity.y));
    await page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
    await frames(page, 4);
    return v;
  };
  const out = await speed(16, 16), inIt = await speed(12, 14.4);
  assert.ok(out > 0, 'walking');
  assert.ok(Math.abs(inIt / out - 0.6) < 0.08, 'in the puddle: 60% of the speed (' + (inIt / out).toFixed(2) + ')');
  await shot(page, 'tricks-2-puddle');
  // it dries
  await page.evaluate(() => { Farm.towerTk().puddles[0].until = Farm.world.time.now + 10; });
  await page.waitForTimeout(150);
  assert.strictEqual(await page.evaluate(() => Farm.towerTk().puddles[0].img.visible), false);
  assert.ok(Math.abs((await speed(12, 14.4)) / out - 1) < 0.08, 'dry: full speed again');
  // no more than a few at once (their pictures reused)
  const most = await page.evaluate(() => { const w = Farm.world; w.wild.animals.slice(0, 18).forEach((a) => { a.hp = 0; a.mine = true; a.hits = 1; w.wildDown(a); }); return Farm.towerTk().puddles.length; });
  assert.strictEqual(most, 10, 'at most 10 at once');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('song (floor 350): with a singer alive near you, the Rifle and the Bow wait half as long again between shots; "♪ slowed" shows', async () => {
  const { page, problems, context } = await toFloor(350, 350);
  await calm(page);
  await me(page, 10, 10);
  // every singer far off but one, 3 tiles away
  await page.evaluate((PUT) => {
    eval(PUT); // eslint-disable-line no-eval
    const list = Farm.world.wild.animals;
    list.forEach((a, i) => put(a, 2 + (i % 20), 21 + (i % 2) * 2 + (i % 3)));
    put(list.find((a) => a.sing && !a.shield), 13, 10);
  }, PUT);
  await page.waitForFunction(() => Farm.towerTk().sung && Farm.towerTk().mark.visible, null, SLOW);
  await page.waitForTimeout(600);
  await shot(page, 'tricks-3-song');
  assert.ok(await page.evaluate(() => (Farm.towerTk().pools.note || { list: [] }).list.length > 0), 'notes float up');
  // the Rifle: 1.4 s between shots, now 2.1 s (the game's own clock: under load it runs behind the wall's)
  const rifle = await page.evaluate(() => {
    const w = Farm.world, t0 = w.time.now, b0 = Farm.Logic.countItem(Farm.session.state, 'bullets');
    w.dir = 'left'; w.fireWeapon();
    return { t0, gap: w.wpnNext - t0, shot: b0 - Farm.Logic.countItem(Farm.session.state, 'bullets') };
  });
  assert.strictEqual(rifle.shot, 1);
  assert.ok(Math.abs(rifle.gap - 2100) < 40, 'the next in 2.1 s: ' + rifle.gap);
  const fireAt = (t) => page.evaluate(async (t) => {
    const w = Farm.world;
    await new Promise((r) => { const step = () => (w.time.now >= t ? r() : requestAnimationFrame(step)); step(); });
    const b0 = Farm.Logic.countItem(Farm.session.state, 'bullets');
    w.wpnNext = 0; // (past the Rifle's own 1.4 s: only the song holds it)
    w.fireWeapon();
    return b0 - Farm.Logic.countItem(Farm.session.state, 'bullets');
  }, t);
  assert.strictEqual(await fireAt(rifle.t0 + 1600), 0, 'at 1.6 s: not yet');
  assert.strictEqual(await fireAt(rifle.t0 + 2150), 1, 'at 2.15 s: it fires');
  // the Bow, the same: after its shot is done it still waits
  await page.evaluate(() => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  const bow = await page.evaluate(async () => {
    const w = Farm.world, until = (t) => new Promise((r) => { const step = () => (w.time.now >= t ? r() : requestAnimationFrame(step)); step(); });
    await until(w.time.now + 2300);
    w.shoot();
    const gap = Farm.towerTk().bowGap, t0 = w.time.now;
    await until(t0 + gap + 100);
    const done = !w.shot;
    w.shoot();
    const blocked = !w.shot;
    await until(t0 + gap * 1.5 + 60);
    w.shoot();
    return { gap, done, blocked, again: !!w.shot };
  });
  assert.ok(bow.gap > 200, 'the Bow\'s own time: ' + bow.gap);
  assert.deepStrictEqual([bow.done, bow.blocked, bow.again], [true, true, true], 'its shot done, the next waits, then goes');
  // the singer beaten: no more song
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.filter((a) => a.sing).forEach((a) => { a.hp = 0; a.mine = true; a.hits = 1; w.wildDown(a); }); });
  await page.waitForFunction(() => !Farm.towerTk().sung && !Farm.towerTk().mark.visible, null, SLOW);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('flocks (floor 420): the fliers circle in flocks of 3-5, dive at you together, and one reaching you costs energy', async () => {
  const { page, problems, context } = await toFloor(420, 420);
  const fl = await page.evaluate(() => {
    const k = Farm.towerTk(), fs = Object.values(k.fl);
    return { n: fs.length, sizes: fs.map((f) => f.members.length), members: Farm.world.wild.animals.filter((a) => a.fs).length, all: Farm.world.wild.animals.length };
  });
  assert.ok(fl.n >= 4, fl.n + ' flocks');
  assert.ok(fl.sizes.every((n) => n >= 3 && n <= 5), 'flocks of 3-5: ' + fl.sizes);
  assert.strictEqual(fl.members, fl.all - 1, 'every normal one (they all fly here); the guard alone');
  await me(page, 14, 13);
  await page.evaluate(() => { const w = Farm.world; w.wild.animals[0].def = Object.assign({}, w.wild.animals[0].def, { angry: 0 }); Object.values(Farm.towerTk().fl).forEach((f) => { f.t = 1e9; f.mode = 'circle'; }); }); // (no dives yet; the guard calm)
  await page.waitForFunction(() => Object.values(Farm.towerTk().fl).every((f) => f.members.every((a) => Math.hypot(a.x - f.x, a.y - f.y) < 1.2 * 256)), null, SLOW);
  const ring = await page.evaluate(() => {
    const k = Farm.towerTk(), out = [];
    Object.values(k.fl).forEach((f) => f.members.forEach((a) => out.push([Math.hypot(a.x - f.x, a.y - f.y) / 256, a.lift / 256, a.mode])));
    const near = Object.values(k.fl).map((f) => Math.min(...f.members.slice(1).map((b) => Math.hypot(b.x - f.members[0].x, b.y - f.members[0].y) / 256)));
    return { out, near };
  });
  assert.ok(ring.out.every((x) => x[0] < 1.2), 'together round the middle: ' + ring.out.map((x) => x[0].toFixed(2)));
  assert.ok(ring.out.every((x) => x[1] > 0.3 && x[2] === 'flock'), 'up in the air, circling');
  assert.ok(ring.near.every((d) => d < 1.4), 'a flockmate within a Moon pair\'s reach: ' + ring.near.map((d) => d.toFixed(2)));
  await shot(page, 'tricks-4-flock');
  // one flock dives
  const e0 = await page.evaluate(() => Farm.session.state.energy);
  await page.evaluate(() => { const f = Object.values(Farm.towerTk().fl)[0], c = Farm.world.player.body.center; f.x = c.x + 2 * 256; f.y = c.y; f.t = 0; });
  await page.waitForFunction(() => Object.values(Farm.towerTk().fl)[0].mode !== 'circle', null, SLOW);
  await page.waitForFunction(() => Object.values(Farm.towerTk().fl)[0].hit, null, SLOW);
  const after = await page.evaluate(() => ({ e: Farm.session.state.energy, mode: Object.values(Farm.towerTk().fl)[0].mode, loss: Farm.world.wild.animals[1].def.hit }));
  assert.strictEqual(e0 - after.e, after.loss, 'one hit\'s energy');
  assert.strictEqual(after.mode, 'back', 'and it pulls back');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('healers (floor 550): a healer mends the most hurt one near it by a fifth of its hits, with a green glow; never itself', async () => {
  const { page, problems, context } = await toFloor(550, 550);
  await calm(page);
  await me(page, 4, 20);
  const r = await page.evaluate((PUT) => {
    eval(PUT); // eslint-disable-line no-eval
    const w = Farm.world, list = w.wild.animals, h = list.find((a) => a.heal && a.kind === 'kataw_manggagamot');
    list.forEach((a, i) => { put(a, 2 + (i % 40), 30 + (i % 4)); a.healT = 1e9; if (a.fs) a.fs = null; });
    const b = list.find((a) => a !== h && !a.heal && a.def.role === 'normal'), far = list.find((a) => a !== h && a !== b && a.def.role === 'normal' && !a.heal);
    put(h, 20, 12); put(b, 22, 12); put(far, 28, 12);
    b.hp = Math.floor(b.max / 2); far.hp = 1; h.hp = 1;
    const was = { b: b.hp, far: far.hp, h: h.hp, max: b.max };
    h.healT = 1;
    return was;
  }, PUT);
  await page.waitForTimeout(250);
  const now = await page.evaluate(() => {
    const w = Farm.world, list = w.wild.animals, h = list.find((a) => a.heal && a.kind === 'kataw_manggagamot');
    const at = (tx) => list.find((a) => Math.floor(a.x / 256) === tx && Math.floor(a.y / 256) === 12);
    return { b: at(22).hp, far: at(28).hp, h: h.hp, glow: (Farm.towerTk().pools.glow || { list: [] }).list.some((o) => o.visible), plus: Farm.towerTk().pools['w:+'].list.some((o) => o.visible), next: h.healT };
  });
  assert.strictEqual(now.b - r.b, Math.round(r.max * 0.2), 'a fifth of its hits');
  assert.strictEqual(now.far, r.far, '8 tiles off: too far');
  assert.strictEqual(now.h, r.h, 'never itself');
  assert.ok(now.glow && now.plus, 'a green glow and a "+"');
  assert.ok(now.next > 3500, 'the next in about 4 s');
  await shot(page, 'tricks-5-heal');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('darkness (floor 650): dark but for a hole round you (3.5 tiles; L.towerSight widens it); the fire creatures glow', async () => {
  const { page, problems, context } = await toFloor(650, 650);
  await calm(page);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const w = Farm.world, k = Farm.towerTk(), c = w.player.body.center, fire = w.wild.animals.filter((a) => a.fire), other = w.wild.animals.find((a) => !a.fire);
    return { on: !!(k.dark && k.dark.visible), depth: k.dark.depth, at: [Math.round(k.dark.x - c.x), Math.round(k.dark.y - c.y)], size: k.dark.displayWidth / 256,
      fire: fire.length, lights: fire.every((a) => a.light && a.light.visible && a.img.depth > k.dark.depth), other: other.img.depth < k.dark.depth && !other.light };
  });
  assert.ok(r.on, 'the dark is on');
  assert.deepStrictEqual(r.at, [0, -102], 'round you');
  assert.ok(Math.abs(r.size - 64) < 0.01, 'the hole 3.5 tiles across its middle');
  assert.ok(r.fire > 0 && r.lights, 'the Santelmos and the Alitaptap carry their light, over the dark');
  assert.ok(r.other, 'the others stay in the dark');
  await shot(page, 'tricks-6-dark');
  const wide = await page.evaluate(async () => {
    const L = Farm.Logic, was = L.towerSight;
    L.towerSight = (s) => was(s) + Farm.towerTricks.dark.lantern; // (the Keeper's Lantern, later)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const size = Farm.towerTk().dark.displayWidth / 256;
    L.towerSight = was;
    return size;
  });
  assert.ok(Math.abs(wide - 64 * 5.5 / 3.5) < 0.01, 'the Lantern\'s +2 tiles widens the hole');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('splitters (floor 750): a beaten one leaves two at 0.6 size with half its hits; copies do not split; the stairs wait for them', async () => {
  const { page, problems, context } = await toFloor(750, 750);
  await calm(page);
  const r = await page.evaluate(() => {
    const w = Farm.world, list = w.wild.animals, a = list.find((x) => x.split && x.def.role === 'normal' && !x.shield), n0 = list.length, left0 = Farm.towerLeft(w), max = a.max, size = a.size;
    a.hp = 1; w.wildStruck(a);
    const copies = list.filter((x) => x.slot >= 10000);
    const out = { n: list.length - n0, left: Farm.towerLeft(w) - left0, copies: copies.map((c) => [c.kind === a.kind, c.max, c.hp, +(c.size / size).toFixed(2), c.split]), max };
    const c = copies[0];
    c.hp = 1; w.wildStruck(c);
    out.afterCopy = [list.length - n0, Farm.towerLeft(w) - left0];
    // the mini boss splits too
    const mini = list[0];
    out.mini = [mini.kind, mini.split];
    return out;
  });
  assert.strictEqual(r.n, 1, 'one down, two up');
  assert.strictEqual(r.left, 1, 'the floor\'s count has the copies');
  assert.deepStrictEqual(r.copies, [[true, Math.ceil(r.max / 2), Math.ceil(r.max / 2), 0.6, false], [true, Math.ceil(r.max / 2), Math.ceil(r.max / 2), 0.6, false]]);
  assert.deepStrictEqual(r.afterCopy, [0, 0], 'a copy beaten: just gone');
  assert.deepStrictEqual(r.mini, ['tigmamanukan', true]);
  await shot(page, 'tricks-7-split');
  // every one of the floor's own down, a copy still up: the stairs stay shut
  await page.evaluate(() => {
    const w = Farm.world, lr = w.lair;
    w.wild.animals.filter((a) => a.slot < 10000).forEach((a) => { a.split = false; a.hp = 0; a.mine = true; a.hits = 1; w.wildDown(a); });
    Farm.Logic.towerRoster(lr.floor).forEach((e) => { lr.down[e.slot] = true; });
  });
  await frames(page, 6);
  assert.deepStrictEqual(await page.evaluate(() => [Farm.towerLeft(Farm.world), Farm.world.lair.open, Farm.world.wild.animals.length]), [1, false, 1]);
  await page.evaluate(() => { const w = Farm.world, c = w.wild.animals[0]; c.hp = 1; w.wildStruck(c); });
  await page.waitForFunction(() => Farm.world.lair.open && Farm.world.lair.paid, null, SLOW);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('revivers (floor 850): a beaten one lies dim 3 s and stands with half its hits; hit while down, it is finished; the stairs wait', async () => {
  const { page, problems, context } = await toFloor(850, 850);
  await calm(page);
  const r = await page.evaluate(() => {
    const w = Farm.world, list = w.wild.animals, [a, b] = list.filter((x) => x.revive && x.def.role === 'normal' && !x.shield && !x.fs), n0 = list.length, left0 = Farm.towerLeft(w);
    list.forEach((x) => { x.healT = 1e9; }); // (no healer mends it while we look)
    a.hp = 1; w.wildStruck(a);
    b.hp = 1; w.wildStruck(b);
    const out = { lying: [!!a.lying, list.includes(a), a.img.alpha < 0.5, Farm.towerLeft(w) - left0, list.length - n0], max: a.max, slot: a.slot };
    w.wildStruck(b); // hit again while it lies: finished (and, the splitters' trick staying, it splits)
    out.b = [list.includes(b), Farm.towerLeft(w) - left0, list.filter((x) => x.slot >= 10000 && x.kind === b.kind && !x.revive).length];
    return out;
  });
  assert.deepStrictEqual(r.lying, [true, true, true, 0, 0], 'it lies there, dim, still counted');
  assert.deepStrictEqual(r.b, [false, 1, 2], 'hit while down: finished, and in two (copies that do not lie down again)');
  await shot(page, 'tricks-8-lying');
  await page.waitForFunction((slot) => { const a = Farm.world.wild.animals.find((x) => x.slot === slot); return a && !a.lying; }, r.slot, SLOW);
  const up = await page.evaluate((slot) => { const a = Farm.world.wild.animals.find((x) => x.slot === slot); return a && [a.lying, a.hp, a.img.alpha, a.revived]; }, r.slot);
  assert.deepStrictEqual(up, [0, Math.ceil(r.max / 2), 1, true], 'up again with half its hits');
  const again = await page.evaluate((slot) => { const w = Farm.world, a = w.wild.animals.find((x) => x.slot === slot); a.hp = 1; w.wildStruck(a); return w.wild.animals.includes(a); }, r.slot);
  assert.strictEqual(again, false, 'once only: the second time it stays down');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('floor 951, every trick: 60 enemies run for a few seconds with no errors, beaten ones splitting, lying, leaving puddles', async () => {
  const { page, problems, context } = await toFloor(951, 951);
  const here = await page.evaluate(() => {
    const w = Farm.world, k = Farm.towerTk(), list = w.wild.animals;
    return { n: list.length, on: Object.keys(k.on).sort(), size: [w.map.width, w.map.height],
      has: ['shield', 'sing', 'heal', 'fire', 'split', 'revive'].filter((f) => list.some((a) => a[f])).concat(list.some((a) => a.fs) ? ['flock'] : []).sort() };
  });
  assert.strictEqual(here.n, 60);
  assert.deepStrictEqual(here.size, [46, 38]);
  assert.deepStrictEqual(here.on, ['burst', 'dark', 'flock', 'heal', 'revive', 'shield', 'song', 'split']);
  assert.deepStrictEqual(here.has, ['fire', 'flock', 'heal', 'revive', 'shield', 'sing', 'split']);
  // they run as they do (charges, dives, heals, the song), your energy kept up; now and then you beat a few
  const ms = await page.evaluate(async () => {
    const w = Farm.world, s = Farm.session.state, gaps = [];
    let last = performance.now(), t0 = last, beat = 0;
    await new Promise((done) => {
      const step = () => {
        const now = performance.now();
        gaps.push(now - last);
        last = now;
        s.energy = 200;
        if (now - t0 > 400 * (beat + 1) && beat < 8) { // (eight times: three beaten, a Rifle at a shield)
          beat++;
          const list = w.wild.animals.filter((a) => a.hp > 0 && !a.lying && !a.def.boss), down = w.wild.animals.filter((a) => a.lying);
          list.slice(0, 3).forEach((a) => { if (a.shield) w.wpnStrike({ k: 'rifle', lv: 0 }, a); a.hp = 1; w.wildStruck(a); });
          down.slice(0, 3).forEach((a) => w.wildStruck(a)); // (finished where they lie: they split)
        }
        if (now - t0 < 4500) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    gaps.sort((a, b) => a - b);
    return { frames: gaps.length, median: gaps[Math.floor(gaps.length / 2)], p95: gaps[Math.floor(gaps.length * 0.95)] };
  });
  console.log('# floor 951, 60 enemies, every trick: ' + ms.frames + ' frames in 4.5 s, median ' + ms.median.toFixed(1) + ' ms, 95% under ' + ms.p95.toFixed(1) + ' ms (headless desktop)');
  const after = await page.evaluate(() => {
    const w = Farm.world, k = Farm.towerTk(), list = w.wild.animals;
    return { copies: list.filter((a) => a.slot >= 10000).length + Object.keys(w.lair.extra || {}).length, puddles: k.puddles.length, lying: list.filter((a) => a.lying).length, left: Farm.towerLeft(w), active: w.sys.isActive(), map: w.mapKey };
  });
  assert.strictEqual(after.map, 'tower', 'still on the floor');
  assert.ok(after.copies > 0 && after.puddles > 0, 'splits and puddles happened');
  assert.ok(after.puddles <= 10, 'the puddles kept to a few');
  await shot(page, 'tricks-9-floor-951');
  // and the floor clears: the stairs open
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.open && Farm.world.lair.paid && Farm.towerLeft(Farm.world) === 0, null, SLOW);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

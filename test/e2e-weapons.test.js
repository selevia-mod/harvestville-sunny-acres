// The Rifle, the Javelin and the Boomerang in a phone-sized headless Chromium (owner, 11 Nov 2026), with the old hunting
// places switched on for them (C.WEAPONS_OLD_PLACES: the owner has not decided; off for players) and the Armory reached
// through gameHost.devWeapons. One file at a time: node --test --test-concurrency=1 test/e2e-weapons.test.js (build first).
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
}
const modalText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
  return out.join(' | ');
});
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const closeAll = async (page) => { await page.evaluate(() => Farm.ui.closeAll()); await frames(page, 2); };
const toast = (page) => page.evaluate(() => (Farm.ui.toastText ? Farm.ui.toastText.text : ''));
// a toast with these words comes (the one last seen, if it never does: for the message)
const waitToast = async (page, re) => {
  await page.waitForFunction((src) => Farm.ui.toastText && new RegExp(src).test(Farm.ui.toastText.text), re.source, { timeout: 15000 }).catch(() => {});
  return toast(page);
};
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
}
// A button with this label in the top panel, tapped (e2e.test.js)
async function tapButton(page, label, nth = 0) {
  const pos = await page.evaluate(([label, nth]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    const found = [];
    // (a slim list's rows out of view are hidden: still found, then scrolled into view: 19i-look.js)
    const shown = (o) => { for (let p = o.parentContainer; p && p !== m.c; p = p.parentContainer) if (!p.visible && !(m.c.slimInto && p.rowH)) return false; return true; };
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c && shown(o)) found.push(o);
      if (o.list) walk(o.list);
    });
    walk(m.c.list);
    // a row named like its button (News: "Write"): the button, not the row's name
    const btns = found.filter((o) => o.parentContainer.list.some((x) => x.type === 'Zone'));
    if (btns.length && btns.length < found.length) found.splice(0, found.length, ...btns);
    // not on screen: a tile that offers it in its own panel (Buy 5, a second button)
    if (!found[nth]) { const tiles = []; const walk2 = (l) => l.forEach((o) => { if (o.row && (o.row.buttons || []).some((x) => x.label === label)) tiles.push(o); if (o.list) walk2(o.list); }); walk2(m.c.list); if (tiles[nth]) { if (m.c.slimInto) m.c.slimInto(tiles[nth].list[0]); const tb = tiles[nth].getBounds(); return { x: tb.centerX, y: tb.centerY, tile: true }; } }
    if (found[nth] && m.c.slimInto) m.c.slimInto(found[nth]); // (a slim list scrolls it into view: 19i-look.js)
    const b = found[nth] && found[nth].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  const n0 = await page.evaluate(() => Farm.ui.modals.length);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
  // a tile (a shop's picture: 19i-look.js) opens its own panel first: its button of the same name is the one meant
  if (await page.evaluate((n0) => Farm.ui.modals.length === n0 + 1 && !!Farm.ui.modals[n0].c.tileDetail, n0)) await tapButton(page, label);
}

// In Pulag with the new weapons on there: the game's own state given the weapons and ammo (`edit` runs in the page).
async function huntWith(edit) {
  const o = await open(null);
  await o.page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = Farm.session.state;
    C.WEAPONS_OLD_PLACES = true;
    s.gold = 2e6; s.lumber = 200; s.energy = 999;
    // eslint-disable-next-line no-eval
    eval(edit);
  }, edit);
  await go(o.page, 'pulag', 'from_town');
  await closeAll(o.page);
  return o;
}
// One animal (or two: `two` = 'behind' or 'beside') standing still `dist` tiles to your right, tough enough to stay up.
const standStill = (page, dist, two) => page.evaluate(([dist, two]) => {
  const w = Farm.world, T = Farm.Config.TILE;
  w.wild.next = 1e9; // no new ones walking in
  const keep = w.wild.animals.filter((a) => !a.def.tameOnly && !a.def.rare).slice(0, two ? 2 : 1);
  w.wild.animals.filter((a) => keep.indexOf(a) < 0).forEach((a) => w.wildGone(a));
  for (let tx = 4; tx < 26; tx++) for (let ty = 4; ty < 22; ty++) {
    if (!(w.wildFree(tx, ty) && w.wildFree(tx + 1, ty) && w.wildFree(tx + 2, ty) && w.wildFree(tx + 3, ty) && w.wildFree(tx + 4, ty))) continue;
    w.setFeet(tx * T + T / 2, ty * T + T / 2); w.dir = 'right'; w.idle();
    const f = w.feet();
    keep.forEach((a, i) => {
      a.def = Object.assign({}, a.def, { shy: 0, angry: 0, hp: 60 });
      a.hp = 60; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9;
      a.x = f.x + (dist + (two === 'behind' ? i * 1.1 : 0)) * T;
      a.y = f.y - 0.2 * T + (two === 'beside' ? i * 0.9 * T : 0);
      a.pin = [a.x, a.y];
    });
    return keep.length;
  }
  return 0;
}, [dist, two || null]);
// they stay where they were put (a struck animal runs)
const pin = (page) => page.evaluate(() => Farm.world.wild.animals.forEach((a) => { if (a.pin) { a.x = a.pin[0]; a.y = a.pin[1]; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; } }));
const hps = (page) => page.evaluate(() => Farm.world.wild.animals.map((a) => a.hp));
const hold = (page, id) => page.evaluate((id) => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === id); Farm.bus.emit('hud'); }, id);
async function fireAndLand(page, ms = 1200) {
  await tapAction(page);
  for (let t = 0; t < ms; t += 100) { await pin(page); await page.waitForTimeout(100); }
}

test('the Rifle, the Javelin and the Boomerang hit an animal in Pulag with their own damage; ammo and throws go down; friends see the shot', async () => {
  const { page, problems, context } = await huntWith(`
    ['rifle', 'javelin', 'boomerang'].forEach((k) => { s.wpn[k] = 0; L.getWeapon(s, k); });
    s.wpn.rifle = 2; s.wpn.javelin = 3; s.wpn.boomerang = 2; s.wpn.left = 300;
    L.buyAmmo(s, 'bullets', 1); L.buyAmmo(s, 'javelins', 1);
  `);
  // the Rifle (Silver: reach 6, hits 3)
  assert.strictEqual(await standStill(page, 4), 1, 'an animal in a clear spot');
  await hold(page, 'rifle');
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Shoot');
  assert.ok(await page.evaluate(() => Farm.world.wild.ring.visible), 'the ring marks it');
  assert.strictEqual(await page.evaluate(() => Farm.ui.wpnChip.visible && Farm.ui.wpnChipText.text), 'x10');
  await tapAction(page);
  await page.waitForTimeout(330);
  const flying = await page.evaluate(() => ({ shots: Farm.world.wpnShots.length, posed: !!Farm.world.wpnShot, arrows: Farm.world.wildArrows.length }));
  assert.ok(flying.posed && flying.arrows === 0, 'a rifle pose, not an arrow');
  await shot(page, 'wpn-rifle');
  for (let t = 0; t < 1200; t += 100) { await pin(page); await page.waitForTimeout(100); }
  assert.deepStrictEqual(await hps(page), [57], 'a Silver Rifle hits 3');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'bullets')), 9);
  // too soon after: nothing (1.4 s between shots)
  const lvl = await page.evaluate(() => { const w = Farm.world; w.wpnNext = w.time.now + 1000; w.fireWeapon(); return Farm.Logic.countItem(Farm.session.state, 'bullets'); });
  assert.strictEqual(lvl, 9, 'not before its time');
  // the Javelin (Gold: reach 3, hits 4)
  await page.evaluate(() => { Farm.world.wpnNext = 0; });
  await standStill(page, 2);
  await hold(page, 'javelin');
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Throw');
  await tapAction(page);
  await page.waitForTimeout(250);
  await shot(page, 'wpn-javelin');
  for (let t = 0; t < 900; t += 100) { await pin(page); await page.waitForTimeout(100); }
  assert.deepStrictEqual(await hps(page), [56], 'a Gold Javelin hits 4');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'javelins')), 4);
  // the Boomerang (Silver: reach 3, hits 2): out and back to your hand
  await standStill(page, 2);
  await hold(page, 'boomerang');
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => Farm.ui.wpnChipText.text), '300/300');
  await tapAction(page);
  await page.waitForTimeout(350);
  await shot(page, 'wpn-boomerang');
  for (let t = 0; t < 1300; t += 100) { await pin(page); await page.waitForTimeout(100); }
  assert.deepStrictEqual(await hps(page), [58], 'a Silver Boomerang hits 2');
  assert.strictEqual(await page.evaluate(() => Farm.world.wpnShots.length), 0, 'back in your hand');
  assert.strictEqual(await page.evaluate(() => Farm.ui.wpnChipText.text), '299/300');
  // a friend's shot (as their 'ar' comes: the weapon in its range): it flies here and hits nothing
  const seen = await page.evaluate(() => {
    const w = Farm.world, L = Farm.Logic, a = w.wild.animals[0], f = w.feet(), T = Farm.Config.TILE, hp = a.hp;
    w.wildArrow(f.x, f.y - 0.5 * T, 0, L.shotRange(4 * T, 'javelin'), true, 5);
    w.bowFlash(f.x, f.y - 0.5 * T, 0, 5);
    const sh = w.wpnShots[w.wpnShots.length - 1];
    return { k: sh && sh.k, shown: sh && sh.shown, moon: sh && sh.moon, arrows: w.wildArrows.length, hp, a };
  });
  assert.deepStrictEqual([seen.k, seen.shown, seen.moon, seen.arrows], ['javelin', true, 'pair', 0]);
  for (let t = 0; t < 700; t += 100) { await pin(page); await page.waitForTimeout(100); }
  assert.deepStrictEqual(await hps(page), [58], "a friend's shot is theirs to count");
  // your shot went out for the others with its weapon (P.tellArrow)
  const told = await page.evaluate(() => {
    const w = Farm.world, out = [];
    const was = w.tellArrow;
    w.tellArrow = (m) => out.push(m);
    w.wpnNext = 0;
    w.fireWeapon();
    return new Promise((r) => setTimeout(() => { w.tellArrow = was; r(out.map((m) => Farm.Logic.shotWeapon(m.l) + ':' + m.b)); }, 600));
  });
  assert.deepStrictEqual(told, ['boomerang:2']);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Moon Rifle goes through into the one behind; the Moon Javelin hits 2 side by side; they glow', async () => {
  const { page, problems, context } = await huntWith(`
    L.getWeapon(s, 'rifle'); L.getWeapon(s, 'javelin');
    s.wpn.rifle = 5; s.wpn.javelin = 5;
    L.buyAmmo(s, 'bullets', 1); L.buyAmmo(s, 'javelins', 1);
  `);
  assert.strictEqual(await standStill(page, 3, 'behind'), 2, 'two animals in a line');
  await hold(page, 'rifle');
  await frames(page, 4);
  await tapAction(page);
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => Farm.world.wpnShots.some((x) => x.glow) || !!(Farm.world.wpnShot && Farm.world.wpnShot.glow)), 'the Moon Rifle glows');
  await shot(page, 'wpn-moon-rifle');
  for (let t = 0; t < 1200; t += 100) { await pin(page); await page.waitForTimeout(100); }
  assert.deepStrictEqual(await hps(page), [56, 56], 'both hit, 4 each');
  await page.evaluate(() => { Farm.world.wpnNext = 0; });
  assert.strictEqual(await standStill(page, 2, 'beside'), 2, 'two side by side');
  await hold(page, 'javelin');
  await frames(page, 4);
  await tapAction(page);
  await page.waitForTimeout(250);
  await shot(page, 'wpn-moon-javelin');
  for (let t = 0; t < 900; t += 100) { await pin(page); await page.waitForTimeout(100); }
  assert.deepStrictEqual(await hps(page), [56, 56], 'one javelin, both hit');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('out of ammo; the Armory (dev only) sells more; with the old places off the weapons do not work there', async () => {
  const { page, problems, context } = await huntWith(`
    L.getWeapon(s, 'rifle');
    L.addItem(s, 'bullets', 1);
  `);
  await standStill(page, 3);
  await hold(page, 'rifle');
  await frames(page, 4);
  await fireAndLand(page);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'bullets')), 0);
  assert.strictEqual(await page.evaluate(() => Farm.ui.wpnChipText.text), 'x0');
  await page.evaluate(() => { Farm.world.wpnNext = 0; });
  await tapAction(page);
  assert.match(await waitToast(page, /No bullets left/), /No bullets left/);
  assert.strictEqual(await page.evaluate(() => Farm.world.wpnShots.length), 0, 'nothing flies');
  // Kanor's Lodge: no Armory for players
  await page.evaluate(() => Farm.ui.openKanor('buy', 0));
  await frames(page, 3);
  assert.doesNotMatch(await modalText(page), /Armory/);
  await closeAll(page);
  // with the dev flag: the Armory, its Ammo tab
  await page.evaluate(() => { window.gameHost.devWeapons = true; Farm.ui.openKanor('buy', 0); });
  await frames(page, 3);
  assert.match(await modalText(page), /Armory \(test\)/);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openArmory({ tab: 'ammo' }); });
  await frames(page, 3);
  assert.match(await modalText(page), /Bullets x10/);
  await shot(page, 'wpn-armory-ammo');
  await tapButton(page, 'Buy 200G');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'bullets')), 10);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openArmory({ tab: 'arms' }); });
  await frames(page, 3);
  const arms = await modalText(page);
  assert.match(arms, /Upgrade to Copper Rifle/);
  assert.match(arms, /Javelin/);
  assert.match(arms, /Boomerang/);
  await shot(page, 'wpn-armory');
  await closeAll(page);
  // the switch off (as for players today): not in the old places
  await page.evaluate(() => { Farm.Config.WEAPONS_OLD_PLACES = false; Farm.world.hintKey = null; });
  await frames(page, 4);
  const off = await page.evaluate(() => Farm.world.resolve());
  assert.ok(off && off.disabled && /Manila/.test(off.why), 'not here');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a boomerang breaks on its last throw and is gone; a worn one is fixed at Bram\'s Forge back to full', async () => {
  const { page, problems, context } = await huntWith(`
    L.getWeapon(s, 'boomerang');
    s.wpn.left = 21;
  `);
  await standStill(page, 1.5);
  await hold(page, 'boomerang');
  await frames(page, 4);
  await fireAndLand(page, 1200);
  assert.match(await waitToast(page, /20 throws left/), /20 throws left/, 'the warning');
  assert.strictEqual(await page.evaluate(() => Farm.ui.wpnChipText.style.color), '#ff9a8a', 'the chip turns red');
  await page.evaluate(() => { Farm.session.state.wpn.left = 1; Farm.world.wpnNext = 0; });
  await fireAndLand(page, 1300);
  assert.match(await waitToast(page, /Your Boomerang broke!/), /Your Boomerang broke!/);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.hasWeapon(Farm.session.state, 'boomerang')), false, 'gone');
  await shot(page, 'wpn-broke');
  // a new one, worn: Bram fixes it
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.getWeapon(s, 'boomerang'); s.wpn.left = 40; });
  await go(page, 'town', 'from_pulag');
  await page.evaluate(() => Farm.ui.openForge());
  await frames(page, 3);
  assert.match(await modalText(page), /Fix your Boomerang/);
  assert.match(await modalText(page), /40 of 100 throws left/);
  await shot(page, 'wpn-forge');
  const before = await page.evaluate(() => [Farm.session.state.gold, Farm.session.state.lumber]);
  await tapButton(page, '100G');
  const after = await page.evaluate(() => [Farm.session.state.gold, Farm.session.state.lumber, Farm.Logic.throwsLeft(Farm.session.state)]);
  assert.deepStrictEqual(after, [before[0] - 100, before[1] - 2, 100]);
  // the save keeps it
  const saved = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.deepStrictEqual(saved.wp, [0, 0, 0, 100]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// ---------- the Rifle's rig (owner, 11 Nov 2026: the boy built from parts while he shoots) ----------
// the one animal `dist` tiles away the way he faces (a little off to the side), standing still
const faceAnimal = (page, dir, dist, off) => page.evaluate(([dir, dist, off]) => {
  const w = Farm.world, T = Farm.Config.TILE, f = w.feet(), a = w.wild.animals[0], v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
  w.dir = dir; w.idle(); w.wpnNext = 0; w.acting = 0;
  a.def = Object.assign({}, a.def, { shy: 0, angry: 0, hp: 999 }); a.hp = 999; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9;
  a.x = f.x + (v[0] * dist + v[1] * off) * T; a.y = f.y - 0.2 * T + (v[1] * dist + v[0] * off) * T; a.pin = [a.x, a.y];
}, [dir, dist, off]);
const openSpace = (page) => page.evaluate(() => {
  const w = Farm.world, T = Farm.Config.TILE;
  w.wild.next = 1e9;
  w.wild.animals.filter((a) => a.def.tameOnly || a.def.rare).forEach((a) => w.wildGone(a));
  w.wild.animals.slice(1).forEach((a) => w.wildGone(a));
  for (let tx = 8; tx < 24; tx++) for (let ty = 8; ty < 20; ty++) if ([-4, -3, -2, -1, 0, 1, 2, 3, 4].every((d) => w.wildFree(tx + d, ty) && w.wildFree(tx, ty + d))) { w.setFeet(tx * T + T / 2, ty * T + T / 2); return true; }
  return false;
});

test('the Rifle rig: he aims and shoots built from parts in all four ways, both hands on the rifle, the dog to the side; back to his sheet at the same size and place', async () => {
  const { page, problems, context } = await huntWith(`L.getWeapon(s, 'rifle'); s.wpn.rifle = 3; L.buyAmmo(s, 'bullets', 5);`);
  await page.evaluate(() => { Farm.rigOn = true; Farm.holdOff = true; Farm.needImage('rig_boy'); }); // (parked, owner 11 Nov 2026: off unless asked for; and not the drawn-in sheet)
  await page.waitForFunction(() => Farm.images.rig_boy && Farm.Config.RIG_BOY, null, SLOW);
  assert.ok(await openSpace(page), 'an open spot');
  await hold(page, 'rifle');
  for (const dir of ['left', 'right', 'down', 'up']) {
    await faceAnimal(page, dir, 3, 0.5);
    await page.waitForTimeout(700); // (the dog trots back behind him)
    await page.evaluate(() => Farm.world.fireWeapon());
    await page.waitForTimeout(220);
    const r = await page.evaluate((dir) => {
      const w = Farm.world, sh = w.wpnShot, rig = sh && sh.rig, p = w.player, T = Farm.Config.TILE;
      if (!rig) return { rig: false };
      const hands = rig.handAt.map((h, i) => Math.hypot(h[0] - rig.gripAt[i][0], h[1] - rig.gripAt[i][1]));
      const head = rig.head.visible ? rig.head : rig.aimHead, top = head.getBounds().top, bottom = rig.legs.getBounds().bottom;
      const a = w.wild.animals[0], want = Math.atan2((a.y - 0.3 * a.def.w * T) - sh.rigTip.y, a.x - sh.rigTip.x), d = Math.abs(Math.atan2(Math.sin(want - sh.rigAng), Math.cos(want - sh.rigAng)));
      return { rig: true, hands, top: top - p.y, bottom: bottom - p.y, aimOff: d, flip: rig.cont.scaleX, aimHead: !!(rig.aimHead && rig.aimHead.visible), dir: sh.dir, view: rig.view };
    }, dir);
    assert.ok(r.rig, dir + ': the rig, not a pose sheet');
    assert.ok(r.hands.every((x) => x < 4), dir + ': both hands on the rifle ' + r.hands.map(Math.round));
    assert.ok(Math.abs(r.bottom - 178) < 8 && Math.abs(r.top + 170) < 20, dir + ': boots and cap where the sheet has them ' + Math.round(r.top) + '..' + Math.round(r.bottom));
    assert.ok(r.aimOff < 0.25, dir + ': the rifle points at the animal (' + r.aimOff.toFixed(2) + ' rad off)');
    assert.strictEqual(r.flip, dir === 'right' ? -1 : 1);
    if (dir === 'left' || dir === 'right') assert.ok(r.aimHead, dir + ': the aiming face, side on');
    await shot(page, 'rig-' + dir);
    await page.waitForTimeout(380);
    const dog = await page.evaluate(() => { const w = Farm.world, d = w.huntDog, f = w.feet(); return d ? Math.hypot(d.x - f.x, d.y - f.y) / Farm.Config.TILE : 9; });
    assert.ok(dog > 0.6, dir + ': the dog is not on him (' + dog.toFixed(2) + ' tiles)');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => { const w = Farm.world; return { rig: !!(w.wpnShot && w.wpnShot.rig), alpha: w.player.alpha, visible: w.player.visible, rigs: w.children.list.filter((o) => o.type === 'Container' && o.list.some((x) => x.frame && /^p:/.test(x.frame.name))).length }; });
    assert.deepStrictEqual(after, { rig: false, alpha: 1, visible: true, rigs: 0 }, dir + ': back to his sheet');
  }
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'bullets')), 46, 'four shots');
  // the girl (and a look, the other weapons) keep the pose sheets for now
  await page.evaluate(() => { Farm.session.state.look = 'girl'; });
  await faceAnimal(page, 'left', 3, 0);
  await page.evaluate(() => Farm.world.fireWeapon());
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await page.evaluate(() => { const sh = Farm.world.wpnShot; return [!!sh.rig, !!sh.body]; }), [false, true], 'the girl: her pose sheet');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// ---------- the weapon drawn in the hands (owner, 11 Nov 2026) ----------
// A hold sheet made in the page for the test (the owner's are not in yet): the old empty-hand pose sheet's frames, each
// in a frame of 384 (as tools/art/weapons-hold-import.js lays them out), only the directions given.
const makeHold = async (page, key, from, rows) => {
  // (the owner's real sheet when the pack has it, fetched; else one made in the page from the old pose sheet)
  const real = await page.evaluate((key) => { if (!Farm.holdPacked(key) || !Farm.packedFile(key)) return false; Farm.needImage(key); return true; }, key);
  if (real) await page.waitForFunction((key) => !!Farm.images[key], key, SLOW);
  await page.evaluate(([key, from, rows, real]) => {
    if (!real) {
      const im = Farm.images[from], c = document.createElement('canvas'), g = c.getContext('2d');
      c.width = c.height = 8 * 2 + 384 * 3 + 16 * 2;
      for (let i = 0; i < 9; i++) g.drawImage(im, 8 + (i % 3) * (288 + 16), 8 + Math.floor(i / 3) * (384 + 16), 288, 384, 8 + (i % 3) * 400 + 48, 8 + Math.floor(i / 3) * 400, 288, 384);
      Farm.images[key] = c;
    }
    Farm.holdSheet(key);
    Farm.Config.WPN_HOLD_ROWS[key] = rows; // (only these directions, for the test)
  }, [key, from, rows, real]);
};

test('the weapon drawn in the hands: his own sheet with no weapon drawn on top, the level\'s glow, the shot from its hand and tip, the motion; a direction or a look without one keeps the old way; the rig is off', async () => {
  const { page, problems, context } = await huntWith(`L.getWeapon(s, 'rifle'); s.wpn.rifle = 2; L.getWeapon(s, 'javelin'); L.buyAmmo(s, 'bullets', 5); L.buyAmmo(s, 'javelins', 2);`);
  await page.evaluate(() => Farm.needImage('wpn_pose_rifle_girl')); // (a girl's: only fetched for a girl)
  await page.waitForFunction(() => Farm.images.wpn_pose_rifle && Farm.images.wpn_pose_javelin && Farm.images.wpn_pose_rifle_girl, null, SLOW);
  assert.ok(await openSpace(page));
  await makeHold(page, 'wpn_hold_rifle_boy', 'wpn_pose_rifle', ['front', 'left']);
  await makeHold(page, 'wpn_hold_javelin_boy', 'wpn_pose_javelin', ['left']);
  await hold(page, 'rifle');
  // the Rifle, side on: his drawn-in sheet, nothing drawn over it, the Silver glow; the round from his hand, shown from the tip
  await faceAnimal(page, 'left', 3, 0);
  await page.evaluate(() => Farm.world.fireWeapon());
  await page.waitForFunction(() => Farm.world.wpnShot && Farm.world.wpnShot.stage === 1, null, SLOW);
  const a = await page.evaluate(() => { const sh = Farm.world.wpnShot; return { key: sh.body.texture.key, held: !!sh.held, fist: !!sh.fist, glow: !!sh.glow, drawn: sh.drawnIn, rig: !!sh.rig, frame: sh.body.frame.name }; });
  assert.deepStrictEqual(a, { key: 'wpn_hold_rifle_boy', held: false, fist: false, glow: true, drawn: true, rig: false, frame: 7 }, 'aimed (the middle pose)');
  await page.waitForFunction(() => Farm.world.wpnShots.length > 0, null, SLOW);
  const g0 = await page.evaluate(() => { const sh = Farm.world.wpnShot; return [sh.grip.x, sh.grip.y]; });
  await page.waitForTimeout(50); // (the kick, in the next frames)
  const b = await page.evaluate((g0) => { const w = Farm.world, sh = w.wpnShot, b = w.wpnShots[0] || { x0: NaN, y0: NaN, hide: 0 }; return { from: [b.x0, b.y0], grip: g0, hide: b.hide, frame: sh.body.frame.name, moved: Math.hypot(sh.body.x - w.player.x, sh.body.y - w.player.y) }; }, g0);
  assert.ok(Math.hypot(b.from[0] - b.grip[0], b.from[1] - b.grip[1]) < 12, 'the round leaves from his hand');
  assert.ok(b.hide > 40, 'and shows from the rifle\'s tip');
  assert.strictEqual(b.frame, 8, 'the kick pose');
  assert.ok(b.moved > 1, 'the kick moves him (' + b.moved.toFixed(1) + ')');
  await shot(page, 'hold-rifle-left');
  await page.waitForTimeout(1500);
  // facing away: this sheet has no picture for it: the old way (the empty-hand pose with the rifle drawn on)
  await faceAnimal(page, 'up', 3, 0);
  await page.evaluate(() => Farm.world.fireWeapon());
  await page.waitForTimeout(120);
  assert.deepStrictEqual(await page.evaluate(() => { const sh = Farm.world.wpnShot; return [sh.drawnIn, !!sh.held, sh.body.texture.key]; }), [false, true, 'wpn_pose_rifle']);
  await page.waitForTimeout(1500);
  // the Javelin, side on: it leaves from the hand of the throw
  await hold(page, 'javelin');
  await faceAnimal(page, 'left', 2, 0);
  await page.evaluate(() => Farm.world.fireWeapon());
  await page.waitForFunction(() => Farm.world.wpnShots.length > 0, null, SLOW);
  const j = await page.evaluate(() => {
    const w = Farm.world, b = w.wpnShots[0], p = w.player, q = Farm.holdPts('wpn_hold_javelin_boy', 'javelin')[7].hand;
    return { from: [b.x0, b.y0], want: [p.x + q[0] - Farm.holdFW('wpn_hold_javelin_boy') / 2, p.y + q[1] - 192], drawn: w.wpnShot.drawnIn };
  });
  assert.ok(j.drawn);
  assert.ok(Math.hypot(j.from[0] - j.want[0], j.from[1] - j.want[1]) < 14, 'the javelin from the hand of the throw ' + j.from.map(Math.round) + ' ~ ' + j.want.map(Math.round));
  await page.waitForTimeout(1200);
  // a look with no sheet of its own (a Tailor Shop look): the old way
  await page.evaluate(() => { Farm.Logic.__worn = Farm.Logic.wornLook; Farm.Logic.wornLook = () => 'fire'; });
  await faceAnimal(page, 'left', 2, 0);
  await page.evaluate(() => Farm.world.fireWeapon());
  await page.waitForTimeout(100);
  assert.deepStrictEqual(await page.evaluate(() => { const sh = Farm.world.wpnShot; return [sh.drawnIn, !!sh.held]; }), [false, true]);
  await page.evaluate(() => { Farm.Logic.wornLook = Farm.Logic.__worn; });
  await page.waitForTimeout(1200);
  // a friend's shot: their own sheet when this phone holds it; let go 30 s after it was last seen
  await makeHold(page, 'wpn_hold_rifle_girl', 'wpn_pose_rifle_girl', ['front', 'back', 'left']);
  const r = await page.evaluate(() => {
    const w = Farm.world, f = w.feet(), T = Farm.Config.TILE;
    const spr = w.add.sprite(f.x + 2 * T, f.y, Farm.playerKey ? Farm.playerKey(w) : 'player', 0);
    const who = { spr, look: 'girl', cs: '' };
    w.wpnRemote(spr.x - T, spr.y, Math.PI, Farm.Logic.shotRange(4 * T, 'rifle'), 1, 'rifle', who);
    const q = w.wpnRemotePoses[0];
    return { posed: !!q, key: q && q.key, hidden: !spr.visible, held: Object.keys(Farm.holdHeld) };
  });
  assert.deepStrictEqual(r, { posed: true, key: 'wpn_hold_rifle_girl', hidden: true, held: ['wpn_hold_rifle_girl'] });
  await page.waitForTimeout(600);
  assert.strictEqual(await page.evaluate(() => Farm.world.wpnRemotePoses.length), 0, 'their pose is over');
  const gone = await page.evaluate(() => { Farm.holdSweep(Date.now() + 31000); return [Object.keys(Farm.holdHeld).length, Farm.world.textures.exists('wpn_hold_rifle_girl')]; });
  assert.deepStrictEqual(gone, [0, false], 'let go after 30 s unseen');
  // the rig is parked: the boy with the Rifle and no hold sheet facing away is not rigged
  assert.strictEqual(await page.evaluate(() => Farm.rigFor(Farm.world, 'rifle')), false);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

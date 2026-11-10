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

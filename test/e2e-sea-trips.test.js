// Sea trips in the built page (dist/index.html), phone-sized headless Chromium (boats step 1, owner 18 Nov 2026): a ticket
// at berth 1 of Manila's pier (riding free), a cast at a spot (2 energy, as the river), a cast off the spots (nothing, free),
// a Seaweed snag, a clump scooped from the rail, Back to the pier (the crate's Capiz Shells and the summary); the Marlin
// after 5 minutes (lost once, back 60 s later, landed in 3 holds: its medal, the Hall of Fame's first waiting to be sent,
// at most once a trip); the bell at 1 minute, back by itself at 10; the game closed mid-trip (back on the pier, the catch
// kept); the first-time tour, centred; and the frame time with the CPU slowed 4x. Run alone, after `node build.js`:
//   node --test --test-concurrency=1 test/e2e-sea-trips.test.js        (SHOTS=/some/dir saves screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const DAY = new Date(2026, 10, 18, 10, 0).getTime();

// the 'sea' pack on the phone (as the trucks' test does): the game asks for a file, the test hands it dist/packs/'s copy
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

async function open(edit, opts = {}) {
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
  await page.addInitScript(([now, loud, save]) => {
    window.__now = now;
    window.gameHost = { state: save ? JSON.parse(save) : null, quiet: !loud, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [opts.now || DAY, !!opts.loud, opts.save || null]);
  if (opts.packs) {
    await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
    await page.addInitScript((here) => { window.__here = here; }, allPackFiles());
    await page.addInitScript(HOST_ASSETS);
  }
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  if (opts.save) return { page, problems, context };
  await page.evaluate((edit) => {
    const s = Farm.session.state, L = Farm.Logic;
    L.weather = () => 'sunny';
    s.goal = 1e6;
    s.gold = 50000;
    s.energy = 500;
    L.addItem(s, 'rod', 1);
    Farm.Config.FISH_WINDOW = 1e9; // (headless frames are slow: a bite never gets away)
    eval(edit || ''); // eslint-disable-line no-eval
    Farm.ui.closeAll();
  }, edit || '');
  await page.waitForTimeout(300);
  return { page, problems, context };
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const state = (page) => page.evaluate(() => { const s = Farm.session.state; return { gold: s.gold, energy: s.energy, map: Farm.world.mapKey, sea: JSON.parse(JSON.stringify(s.sea)) }; });
const count = (page, id) => page.evaluate((id) => Farm.Logic.countItem(Farm.session.state, id), id);
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(250);
}
// the words of the panel on top
const modalText = (page) => page.evaluate(() => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  if (m) walk(m.c.list);
  return out.join(' | ');
});
// a tap on the button (or words) `label` of the panel on top, where it is on the screen
async function tapText(page, label) {
  const at = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    let hit = null;
    const walk = (l) => l.forEach((o) => { if (!hit && o.type === 'Text' && o.text === label) hit = o; if (o.list) walk(o.list); });
    walk(m ? m.c.list : (Farm.ui.seaChip ? [Farm.ui.seaChip.box] : []));
    if (!hit) return null;
    const b = hit.getBounds();
    return { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(at, 'no "' + label + '" on screen: ' + (await modalText(page)));
  await page.touchscreen.tap(at.x, at.y);
  await frames(page, 4);
  await page.waitForTimeout(300);
}
async function toPier(page) {
  await page.evaluate(() => Farm.world.travel('manila', 'from_sea'));
  await page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await frames(page, 4);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.world.dir = 'up'; Farm.world.idle(); });
  await frames(page, 2);
}
async function board(page) {
  await toPier(page);
  assert.strictEqual(await actionLabel(page), 'Sea trip', 'berth 1: Kapitana Marisol\'s boat');
  const boat = await page.evaluate(() => {
    const w = Farm.world, v = w.cameras.main.worldView, b = w.children.list.find((o) => o.texture && /^(fx-sea-side|sea\/boat_marisol_side)$/.test(o.texture.key));
    return b ? { key: b.texture.key, seen: b.visible && b.x > v.x && b.x < v.right && b.y - b.displayHeight > v.y && b.y < v.bottom } : null;
  });
  assert.ok(boat && boat.seen, 'the boat at berth 1, in view: ' + JSON.stringify(boat));
  if (SHOTS) { await page.waitForTimeout(600); await shot(page, 'sea-berth'); } // (the arrival's fade over)
  await tapAction(page);
  assert.match(await modalText(page), /Kapitana Marisol's Boat/);
  await tapText(page, 'Ticket 3,000G');
  await page.waitForFunction(() => Farm.world.mapKey === 'sea' && !Farm.world.busy && Farm.world.sea && Farm.world.player.active, null, SLOW);
  await frames(page, 4);
}
// stand on the deck by spot i (or, `off`, by the rail where no spot is), facing the water, the rod in hand
const atSpot = (page, i, off) => page.evaluate(([i, off]) => {
  const w = Farm.world, s = Farm.session.state, S = Farm.Config.SEA, d = S.deck, T = 256;
  s.sel = s.inv.findIndex((x) => x && x.id === 'rod');
  let p = w.sea.list[i];
  if (off) p = S.slots.concat([[d[0] - 1, d[1]]]).find((q) => Farm.Logic.seaSpotAt(w.sea.list, q[0], q[1]) < 0 && q[1] < d[1]);
  const side = p[0] < d[0] ? 'left' : p[0] >= d[0] + d[2] ? 'right' : null, stand = side === 'left' ? [p[0] + 1, p[1]] : side === 'right' ? [p[0] - 1, p[1]] : [p[0], p[1] < d[1] ? p[1] + 1 : p[1] - 1];
  w.setFeet(stand[0] * T + 128, stand[1] * T + (p[1] < d[1] ? 60 : 200));
  w.dir = side || (p[1] < d[1] ? 'up' : 'down');
  w.idle();
  return p;
}, [i, !!off]);
async function cast(page, roll) {
  await page.evaluate((roll) => { if (roll) Farm.Logic.seaRoll = () => roll; }, roll || null);
  await frames(page, 2);
  assert.strictEqual(await actionLabel(page), 'Fish');
  await tapAction(page);
  await page.evaluate(() => { Farm.world.fishing.biteAt = 0; });
  await page.waitForFunction(() => Farm.world.fishing && Farm.world.fishing.state === 'bite', null, SLOW);
  await page.evaluate(() => { const G = Farm.Config.FISH_GAME; G.fill = 50; G.drain = 0; });
  await tapAction(page);
  await page.waitForFunction(() => !Farm.world.fishing, null, SLOW);
  await page.waitForFunction(() => !Farm.ui.game2, null, SLOW);
}

test('a ticket at berth 1, a cast at a spot, one off the spots, a snag, a clump scooped, and back to the pier with the crate', async () => {
  const { page, problems, context } = await open();
  await board(page);
  let st = await state(page);
  assert.strictEqual(st.gold, 50000 - 3000, 'the ticket: 3,000 Gold');
  assert.strictEqual(st.energy, 500, 'riding the boat costs no energy');
  assert.ok(st.sea.t && st.sea.t.p === 3000, 'a trip on');
  assert.match(await page.evaluate(() => Farm.ui.seaChip.t1.text), /^At sea {2}(10:00|9:5\d)$/);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.held(Farm.session.state).id), 'rod', 'the rod in your hands as you come aboard');
  // the farm's tools on a deck: greyed out, and free (as in the hunting grounds)
  const tools = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, out = [], sel = s.sel;
    ['hoe', 'axe', 'hammer', 'sickle'].forEach((id) => {
      if (!s.inv.some((x) => x && x.id === id)) Farm.Logic.addItem(s, id, 1);
      s.sel = s.inv.findIndex((x) => x && x.id === id);
      const a = w.resolve(), e = s.energy;
      if (a && a.run && !a.disabled) a.run(1);
      out.push(id + ':' + (a ? a.label + (a.disabled ? ' (off)' : '') : '-') + ':' + (e - s.energy));
    });
    s.sel = sel;
    return out;
  });
  assert.deepStrictEqual(tools, ['hoe:Till (off):0', 'axe:Chop (off):0', 'hammer:Smash (off):0', 'sickle:Cut (off):0']);
  await atSpot(page, 0); // (already the rod)
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Fish', 'at a spot with the rod: Fish');
  await shot(page, 'sea-deck');
  // a cast where no spot is: nothing bites, and it costs nothing
  await atSpot(page, 0, true);
  await frames(page, 2);
  assert.strictEqual(await actionLabel(page), 'Fish');
  await tapAction(page);
  assert.strictEqual(await page.evaluate(() => !!Farm.world.fishing), false);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Nothing bites out here/);
  assert.strictEqual((await state(page)).energy, 500);
  // at a spot: a Tuna, for the river's 2 energy
  await atSpot(page, 0);
  await cast(page, 'tuna');
  st = await state(page);
  assert.strictEqual(await count(page, 'tuna'), 1);
  assert.strictEqual(st.energy, 500 - 2, 'a cast: C.FISH_ENERGY');
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Tuna, \d+(\.\d)? kg!/);
  assert.ok(st.sea.b.tuna > 0 && st.sea.c.tuna === 1 && st.sea.t.n === 1, 'weighed and kept in the sea\'s fish book');
  // a snag: Seaweed, no mini game
  await atSpot(page, 1);
  await cast(page, 'seaweed');
  assert.strictEqual(await count(page, 'seaweed'), 1);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /A snag! Seaweed/);
  assert.strictEqual((await state(page)).energy, 500 - 4);
  // a clump floating by the rail: Scoop, free
  await page.evaluate(() => {
    const w = Farm.world, f = w.facing(), c = w.seaClump();
    w.tweens.killTweensOf(c.img);
    c.img.setPosition((f.x + 0.5) * 256, (f.y + 0.5) * 256);
  });
  await frames(page, 2);
  assert.strictEqual(await actionLabel(page), 'Scoop');
  await tapAction(page);
  assert.strictEqual(await count(page, 'seaweed'), 2);
  assert.strictEqual((await state(page)).energy, 500 - 4, 'scooping costs nothing');
  await shot(page, 'sea-fishing');
  // Back to the pier (the chip), Yes: the crate's shells, the summary on the pier
  const shells = (await state(page)).sea.t.sh;
  await tapText(page, 'Back to the pier');
  assert.match(await modalText(page), /BACK TO THE PIER\?/);
  await tapText(page, 'Yes');
  await page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy && Farm.ui.modals.length, null, SLOW);
  // (its pop-in done: every part of it solid)
  await page.waitForFunction(() => Farm.ui.modals[Farm.ui.modals.length - 1].c.list.slice(1).every((o) => o.alpha === 1), null, SLOW);
  const text = await modalText(page);
  assert.match(text, /BACK AT THE PIER/);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals[Farm.ui.modals.length - 1].c.list.filter((o) => o.type === 'Image' && o.texture && /sea/.test(o.texture.key)).length), 0, 'no picture over its words');
  assert.match(text, new RegExp('The crate: ' + shells + ' Capiz Shell'));
  st = await state(page);
  assert.strictEqual(st.sea.t, null);
  assert.strictEqual(st.sea.tr, 1);
  assert.strictEqual(await count(page, 'capiz'), shells);
  assert.strictEqual(await count(page, 'tuna'), 1, 'every fish kept');
  const at = await page.evaluate(() => { const f = Farm.world.feet(), p = Farm.Logic.seaPier(); return Math.hypot(f.x - p.x, f.y - p.y); });
  assert.ok(at < 300, 'on the pier by berth 1: ' + at);
  assert.strictEqual(await page.evaluate(() => Farm.ui.seaChip), null, 'the chip went with the boat');
  await shot(page, 'sea-back');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Marlin: after 5 minutes its shadow; lost once, it comes back 60 s later; landed in 3 holds; once a trip', async () => {
  const { page, problems, context } = await open();
  await board(page);
  assert.strictEqual(await page.evaluate(() => Farm.world.sea.mOut), false, 'not in the first 5 minutes');
  await page.evaluate(() => { window.__now += 5 * 60000 + 1000; });
  await page.waitForFunction(() => Farm.world.sea && Farm.world.sea.mOut && Farm.world.sea.shadow, null, SLOW);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /THE MARLIN/);
  await shot(page, 'sea-marlin-shadow');
  const spot = () => page.evaluate(() => Farm.world.sea.mIdx);
  // lost: the fish wins the first hold
  await atSpot(page, await spot());
  await frames(page, 2);
  await tapAction(page);
  await page.evaluate(() => { Farm.world.fishing.biteAt = 0; });
  await page.waitForFunction(() => Farm.world.fishing && Farm.world.fishing.state === 'bite', null, SLOW);
  await page.evaluate(() => { const G = Farm.Config.FISH_GAME; G.fill = 0; G.drain = 50; });
  await tapAction(page);
  await page.waitForFunction(() => !Farm.world.fishing && !Farm.ui.game2, null, SLOW);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /The Marlin broke free/);
  let t = (await state(page)).sea.t;
  assert.strictEqual(t.ml, 1);
  await page.waitForFunction(() => !Farm.world.sea.mOut && !Farm.world.sea.shadow, null, SLOW);
  // 60 s later it is back; three holds in a row
  await page.evaluate(() => { window.__now += 61000; });
  await page.waitForFunction(() => Farm.world.sea.mOut && Farm.world.sea.shadow, null, SLOW);
  await atSpot(page, await spot());
  await frames(page, 2);
  await tapAction(page);
  await page.evaluate(() => { Farm.world.fishing.biteAt = 0; });
  await page.waitForFunction(() => Farm.world.fishing && Farm.world.fishing.state === 'bite', null, SLOW);
  let rounds = 0;
  await page.evaluate(() => { // (each hold is the reel game's own panel: counted as it opens)
    const G = Farm.Config.FISH_GAME, ui = Farm.ui, panel = ui.panelImg;
    G.fill = 50; G.drain = 0; window.__holds = 0;
    ui.panelImg = function (c, x, y, w, h) { if (h === 380) window.__holds++; return panel.apply(this, arguments); };
  });
  await tapAction(page);
  await page.waitForFunction(() => !Farm.world.fishing && Farm.Logic.countItem(Farm.session.state, 'marlin') === 1, null, SLOW);
  rounds = await page.evaluate(() => window.__holds);
  assert.strictEqual(rounds, 3, 'three holds in a row');
  await page.waitForFunction(() => /THE MARLIN!/.test(Farm.ui.modals.length ? Farm.ui.modals[Farm.ui.modals.length - 1].c.list.map((o) => o.text || '').join(' ') : ''), null, SLOW);
  t = (await state(page)).sea;
  assert.strictEqual(t.t.mc, 1);
  assert.strictEqual(t.c.marlin, 1, 'the Marlin medal: one landed');
  assert.strictEqual(t.hf, 1, 'the first Marlin: the Hall of Fame\'s claim waits to be sent (offline)');
  await page.evaluate(() => Farm.ui.closeAll());
  await shot(page, 'sea-marlin');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.seaMarlinOut(Farm.session.state.sea.t, window.__now + 600000)), false, 'once a trip');
  assert.strictEqual(await page.evaluate(() => !!Farm.world.sea.shadow), false);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the bell at 1 minute left, back by itself at 10; a game closed mid-trip opens on the pier with the catch kept', async () => {
  const { page, problems, context } = await open();
  await board(page);
  await atSpot(page, 0);
  await cast(page, 'tanigue');
  await page.evaluate(() => { window.__now += 9 * 60000 + 500; });
  await page.waitForFunction(() => /DING DING/.test(Farm.ui.toastText.text), null, SLOW);
  await page.evaluate(() => { window.__now += 60000; });
  await page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy && Farm.ui.modals.length, null, SLOW);
  assert.match(await modalText(page), /Ten minutes are up/);
  assert.strictEqual(await count(page, 'tanigue'), 1);
  // closed mid-trip: the save says the pier; opened again, the trip is over and the catch is there
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.session.state.gold = 9000; Farm.world.seaBoard({}); });
  await page.waitForFunction(() => Farm.world.mapKey === 'sea' && !Farm.world.busy && Farm.world.sea, null, SLOW);
  await atSpot(page, 0);
  await cast(page, 'maya_maya');
  const save = await page.evaluate(() => { Farm.world.save(); return window.gameHost.saves[window.gameHost.saves.length - 1]; });
  const o = JSON.parse(save);
  assert.ok(Array.isArray(o.sv) && Array.isArray(o.sv[0]), 'the trip is in the save');
  await context.close();
  const again = await open(null, { save, now: DAY + 11 * 60000 });
  await again.page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy && Farm.ui.modals.length, null, SLOW);
  assert.match(await modalText(again.page), /BACK AT THE PIER/);
  assert.strictEqual(await count(again.page, 'maya_maya'), 1, 'the catch kept');
  assert.strictEqual(await again.page.evaluate(() => Farm.session.state.sea.t), null, 'the trip is over');
  assert.ok(await count(again.page, 'capiz') >= 2, 'both crates');
  assert.deepStrictEqual(problems, []);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('the first time the boat\'s panel opens: SEA TRIPS, a centred tour, once', async () => {
  const { page, problems, context } = await open('', { loud: true });
  await toPier(page);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.seaPanel(); });
  await page.waitForFunction(() => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    if (!m) return false;
    const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    walk(m.c.list);
    return out.includes('SEA TRIPS');
  }, null, { timeout: 30000, polling: 300 });
  const mid = await page.evaluate(() => Math.round(Farm.ui.modals[Farm.ui.modals.length - 1].c.getBounds().centerX));
  assert.ok(Math.abs(mid - 180) <= 2, 'centred: ' + mid);
  assert.match(await modalText(page), /berth 1/);
  await shot(page, 'sea-tour');
  assert.ok(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'sea_tour')));
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.seaPanel(); });
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Kapitana Marisol's Boat/, 'once: the panel itself the next time');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// The world's own work in a frame (its update and its drawing), as test/e2e-deep-mine.test.js measures it
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

// (twice: the stand-ins, and the owner's pictures from the 'sea' pack)
for (const art of [false, true]) {
test('a slow phone (CPU x4): walking the deck with the spots, the gulls and a clump, against Manila\'s pier (budget 13-14 ms at 60 Hz)' + (art ? ', with the owner\'s pictures' : ''), async () => {
  const { page, problems, context } = await open('', { packs: art });
  if (art) await page.evaluate(() => Farm.loadPack('sea'));
  const cdp = await context.newCDPSession(page);
  const rows = {};
  const walk = async () => { for (const [k, ms] of [['ArrowLeft', 900], ['ArrowDown', 500], ['ArrowRight', 1400], ['ArrowUp', 700]]) { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); } };
  await toPier(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(1500);
  let m = work(page, 6000);
  await walk();
  rows.pier = await m;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.world.seaBoard({}); });
  await page.waitForFunction(() => Farm.world.mapKey === 'sea' && !Farm.world.busy && Farm.world.sea, null, SLOW);
  await page.evaluate(() => { Farm.world.seaClump(); Farm.world.setFeet(11.5 * 256, 9.4 * 256); });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(1500);
  m = work(page, 6000);
  await walk();
  rows.sea = await m;
  rows.sea.marks = await page.evaluate(() => Farm.world.sea.marks.length);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log('[CPU x4' + (art ? ', the owner\'s pictures' : ', stand-ins') + '] world work per frame (ms), and frame gaps:', JSON.stringify(rows));
  assert.strictEqual(rows.sea.marks, 8, 'four spots, each with its gull');
  assert.ok(rows.sea.world.avg <= 14, 'within the 60 Hz budget on average: ' + rows.sea.world.avg);
  assert.ok(rows.sea.world.p50 <= Math.max(14, rows.pier.world.p50 * 1.3), 'about as light as the pier');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
}

test("the owner's pictures (the 'sea' pack on the phone): the boat at berth 1, the water, the deck, the spots, the crate, the gulls and the bag's icons", async () => {
  const { page, problems, context } = await open('', { packs: true });
  assert.ok(await page.evaluate(() => Farm.packFiles('sea').length === 10), 'the sea pack: 10 pictures');
  await toPier(page);
  await page.waitForFunction(() => { const b = Farm.world.seaBoat; return b && b.texture.key === 'sea/boat_marisol_side'; }, null, SLOW); // (in the stand-in's place once it comes)
  const boat = await page.evaluate(() => { const b = Farm.world.seaBoat; return { w: b.displayWidth / 256, h: b.displayHeight / 256 }; });
  assert.ok(Math.abs(boat.w - 4) < 0.01 && boat.h > 1.5 && boat.h < 2, 'the boat 4 tiles wide, its own shape: ' + JSON.stringify(boat));
  if (SHOTS) { await page.waitForTimeout(600); await shot(page, 'art-berth'); }
  await board(page);
  await page.waitForFunction(() => Farm.packReady('sea'), null, SLOW);
  if (!(await page.evaluate(() => Farm.world.textures.exists('sea/ground_sea_open') && (Farm.world.sea.water.displayTexture || Farm.world.sea.water.texture).key === 'sea/ground_sea_open'))) {
    // (the pack came while the deck was being drawn: the next trip has it; go back and board again)
    await page.evaluate(() => Farm.world.seaBack('early'));
    await page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy, null, SLOW);
    await page.evaluate(() => { Farm.ui.closeAll(); Farm.session.state.gold += 3000; });
    await board(page);
  }
  const used = await page.evaluate(() => {
    const w = Farm.world, keys = {};
    w.children.list.forEach((o) => { if (o.texture && /^sea\//.test(o.texture.key)) keys[o.texture.key] = (keys[o.texture.key] || 0) + 1; });
    return { keys, water: (w.sea.water.displayTexture || w.sea.water.texture).key, scale: w.sea.water.tileScaleX }; // (a TileSprite draws through a texture of its own: what it repeats is displayTexture)
  });
  ['sea/boat_marisol_deck', 'sea/sea_crate', 'sea/sea_spot', 'sea/sea_gull', 'sea/sea_skyline'].forEach((k) => assert.ok(used.keys[k], k + ' on the screen: ' + JSON.stringify(used)));
  assert.strictEqual(used.water, 'sea/ground_sea_open');
  assert.strictEqual(used.scale, 2, 'the 512 px water repeats every 4 tiles, as the stand-in');
  await atSpot(page, 0);
  await frames(page, 4);
  await shot(page, 'art-deck');
  // the bag's sea icons from the owner's two sheets
  assert.ok(await page.evaluate(() => Farm.world.textures.get('items').seaArt === 2), 'the icons painted from both sheets');
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; ['galunggong', 'sea_pusit', 'maya_maya', 'lapu_lapu', 'tanigue', 'tuna', 'marlin', 'seaweed'].forEach((id) => L.addItem(s, id, 1)); Farm.ui.refresh(); });
  if (SHOTS) { await frames(page, 6); await page.waitForTimeout(400); await shot(page, 'art-bag'); } // (the toolbar: the new sea things in its slots)
  assert.deepStrictEqual(problems, []);
  await context.close();
});

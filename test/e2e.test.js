// End-to-end playthrough of dist/index.html in a phone-sized headless Chromium.
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

// A save made from a fresh state (no debris on the field), changed by `edit` (run in the page).
async function makeSave(edit, when) {
  const { page, context } = await open(null, when);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    // eslint-disable-next-line no-eval
    if (edit) eval(edit);
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
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
  // tools land a moment after the tap: wait for it, then let the effects play
  await page.waitForFunction(() => !Farm.world || !Farm.world.landing, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(150);
}

async function tapHotbar(page, i, bar = 0) { // (an item held from further down the bag takes the bar with it)
  await page.evaluate((bar) => Farm.ui.hotTo(bar), bar);
  await page.touchscreen.tap(14 + i * 48 + 22, 606);
  await frames(page);
}

const hold = async (page, id) => {
  await page.evaluate((id) => {
    const s = Farm.session.state;
    s.sel = s.inv.findIndex((x) => x && x.id === id);
    Farm.world.hintKey = null;
    Farm.bus.emit('hud');
  }, id);
  await frames(page);
};

// Taps the on-screen button with the given label inside the top modal (the nth one, if there are several).
async function tapButton(page, label, nth = 0) {
  const pos = await page.evaluate(([label, nth]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    const found = [];
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c && o.parentContainer.visible) found.push(o.getBounds());
      if (o.list) walk(o.list);
    });
    walk(m.c.list);
    const b = found[nth];
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}

// Taps the k-th slot of the open bag page (the slots' own zones, in order).
async function tapSlotOnPage(page, k) {
  const pos = await page.evaluate((k) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    const z = m.c.list.filter((o) => o.type === 'Zone' && o.input && o.input.enabled)[k];
    return z && { x: z.x, y: z.y };
  }, k);
  assert.ok(pos, 'slot ' + k + ' is on screen');
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}

const modalText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
  return out.join(' | ');
});
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const closeAll = async (page) => { await page.evaluate(() => Farm.ui.closeAll()); await frames(page, 2); };
const count = (s, id) => s.inv.filter((x) => x && x.id === id).reduce((a, b) => a + b.n, 0);

async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}

async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
}

// Moves the game's clock: the world catches up within a frame or two.
const tick = (page) => page.evaluate(() => { if (Farm.world) Farm.world.clockMs = 1000; });
async function setClock(page, when) {
  await page.evaluate((t) => { window.__now = t; }, at(when));
  await tick(page);
  await frames(page, 3);
}
async function advance(page, mins) {
  await page.evaluate((m) => { window.__now += m * 60000; }, mins);
  await tick(page);
  await frames(page, 3);
}

// To 8 AM the next day: the new day starts where you stand, with its report. Returns the report's text.
async function nextMorning(page) {
  const { day } = await state(page);
  await page.evaluate(() => {
    Farm.ui.closeAll();
    const d = new Date(window.__now);
    window.__now = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 8, 0).getTime();
    Farm.world.clockMs = 1000;
  });
  await page.waitForFunction((d) => Farm.session.state.day === d + 1 && Farm.world && !Farm.world.busy && Farm.world.player.active, day, SLOW);
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW); // the morning report
  const report = await modalText(page);
  await tapButton(page, 'OK');
  return report;
}

test('farming loop: clear debris, till, plant a seed bag, water, wait in real time, harvest, sell at the stand, shop, save', async () => {
  const { page, problems, context, cdp } = await open();
  const idx = (x, y) => y * W + x;

  // a new game asks: boy or girl? Back can't skip it. Picking the girl changes the farmer's picture.
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  assert.match(await modalText(page), /Who will you play/);
  await shot(page, '00-choose');
  assert.strictEqual(await page.evaluate(() => window.__gameBack()), true);
  assert.match(await modalText(page), /Who will you play/);
  await tapButton(page, 'Girl');
  assert.strictEqual((await state(page)).look, 'girl');
  assert.strictEqual(await page.evaluate(() => Farm.world.player.texture.key), 'player_girl');

  // then she is named (27 Oct: name your farmer)
  await page.waitForSelector('#farm-ask input', SLOW);
  await page.fill('#farm-ask input', 'Lily Rose');
  await page.click('#farm-ask button:last-child');
  await page.waitForSelector('#farm-ask', { state: 'detached' });
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.strictEqual((await state(page)).name, 'Lily Rose');

  // then the welcome dialog, which closes with the host Back button
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  assert.match(await modalText(page), /WELCOME/);
  await shot(page, '01-welcome');
  assert.strictEqual(await page.evaluate(() => window.__gameBack()), true);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);
  let s = await state(page);
  assert.ok(Object.keys(s.debris).length > 60, 'a new farm starts overgrown');
  await shot(page, '02-start');

  // joystick: drag right on the left side of the screen and the farmer walks right
  await frames(page, 3); // (the save learns where the farmer stands on the first frames after the welcome closes)
  const y0 = (await state(page)).player.y;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 420, id: 1 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + i * 8, y: 420, id: 1 }] });
  }
  // the farmer eases up to walking speed; slow headless frames can take a while to get there
  await page.waitForFunction(() => Farm.world.feet().x > 6.5 * 256 + 200, null, { timeout: 8000 }).catch(() => {});
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await frames(page);
  const moved = await state(page);
  assert.ok(moved.player.x > 6.5 * 256 + 160, 'player walked right with the joystick');
  assert.strictEqual(Math.round(moved.player.y), Math.round(y0));
  assert.deepStrictEqual(await page.evaluate(() => [Farm.input.jx, Farm.input.jy]), [0, 0], 'joystick released');

  // a patch of the field with a weed, a branch and a stone on it (and nothing else)
  await page.evaluate(() => {
    const s = Farm.session.state;
    for (let y = 11; y <= 15; y++) for (let x = 4; x <= 8; x++) delete s.debris[y * 64 + x];
    s.debris[12 * 64 + 5] = 'weed';
    s.debris[12 * 64 + 6] = 'branch';
    s.debris[12 * 64 + 7] = 'stone';
    Farm.world.refreshDebris();
  });
  await teleport(page, 5, 11, 'down');
  await hold(page, 'sickle');
  assert.strictEqual(await actionLabel(page), 'Cut');
  await tapAction(page);
  await teleport(page, 6, 11, 'down');
  await tapHotbar(page, 4); // axe
  assert.strictEqual(await actionLabel(page), 'Chop');
  await tapAction(page);
  await teleport(page, 7, 11, 'down');
  await tapHotbar(page, 5); // hammer
  assert.strictEqual(await actionLabel(page), 'Smash');
  await tapAction(page);
  s = await state(page);
  assert.ok(!s.debris[idx(5, 12)] && !s.debris[idx(6, 12)] && !s.debris[idx(7, 12)], 'debris cleared');
  assert.strictEqual(s.goal, 1, 'the first goal (clear 3) is done');
  assert.strictEqual(s.gold, 300 + 100, 'and paid its reward');
  assert.match(await page.evaluate(() => Farm.ui.goalText.text), /Till 3 tiles/);
  assert.ok(await page.evaluate(() => Farm.ui.arrow.visible), 'the guide arrow shows');
  assert.strictEqual(s.lumber, 1);
  assert.strictEqual(s.stone, 1);
  assert.strictEqual(s.energy, 100 - 1 - 3 - 3);
  await shot(page, '03-cleared');

  // till a 3x3 patch with the hoe
  await tapHotbar(page, 0);
  for (let y = 12; y <= 14; y++) {
    for (let x = 5; x <= 7; x++) {
      await teleport(page, x, y - 1, 'down');
      await tapAction(page);
    }
  }
  s = await state(page);
  for (let y = 12; y <= 14; y++) for (let x = 5; x <= 7; x++) assert.ok(s.soil[idx(x, y)], `tilled ${x},${y}`);
  assert.strictEqual(s.energy, 93 - 18);

  // one seed bag sows the whole 3x3 patch (keyboard 3 selects slot 3)
  await teleport(page, 6, 12, 'down');
  await page.keyboard.press('3');
  await frames(page);
  assert.strictEqual(await actionLabel(page), 'Plant');
  await tapAction(page);
  s = await state(page);
  for (let y = 12; y <= 14; y++) for (let x = 5; x <= 7; x++) assert.strictEqual(s.soil[idx(x, y)].c, 'turnip');
  assert.strictEqual(count(s, 'seed_turnip'), 3, '3 bags + 1 from the till goal - 1 planted');

  // water the top row: watered turnips ripen in 11 1/4 minutes instead of 15
  await tapHotbar(page, 1);
  for (let x = 5; x <= 7; x++) {
    await teleport(page, x, 11, 'down');
    if (x === 5) assert.strictEqual(await actionLabel(page), 'Water');
    await page.keyboard.press('Space'); // the keyboard works too
    await frames(page);
  }
  s = await state(page);
  assert.strictEqual(s.soil[idx(5, 12)].w, 1, 'watered');
  await shot(page, '04-watered');
  // facing a growing crop (with nothing to use on it) says how long it has left
  await hold(page, 'chicken_feed');
  await teleport(page, 5, 11, 'down');
  await page.evaluate(() => { Farm.world.hintKey = null; });
  await frames(page);
  assert.strictEqual(await actionLabel(page), 'Growing');
  await tapAction(page);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Turnip: ready in 15 min/);
  // 15 real minutes later the watered row is ripe; the dry rows never started (owner, 29 Oct 2026: crops need water)
  await advance(page, 15);
  s = await state(page);
  assert.ok(await page.evaluate(() => Farm.Logic.isRipe(Farm.session.state.soil[12 * 64 + 5])));
  assert.strictEqual(await page.evaluate(() => Farm.Logic.cropStage(Farm.session.state.soil[13 * 64 + 5])), 0, 'the unwatered row is still a seed');
  await teleport(page, 5, 12, 'down');
  await page.evaluate(() => { Farm.world.hintKey = null; });
  await frames(page);
  await tapAction(page);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Turnip needs water to grow/);
  assert.strictEqual(await page.evaluate(() => Farm.world.crops[12 * 64 + 5].stage), 3, 'the field shows it');
  await teleport(page, 5, 11, 'down');
  await shot(page, '05-ripe');

  // harvest the three ripe turnips
  for (let x = 5; x <= 7; x++) {
    await teleport(page, x, 11, 'down');
    assert.strictEqual(await actionLabel(page), 'Harvest');
    await tapAction(page);
  }
  s = await state(page);
  const turnipSlot = s.inv.findIndex((x) => x && x.id === 'turnip');
  assert.strictEqual(s.inv[turnipSlot].n, 3, 'harvested 3 turnips');
  assert.strictEqual(s.soil[idx(5, 12)].c, null);

  // look at the turnips in the bag
  await page.touchscreen.tap(14 + 6 * 48 + 22, 606); // bag button
  await frames(page);
  await shot(page, '06-bag');
  await page.touchscreen.tap(33 + (turnipSlot % 6) * 50 + 22, 160 + Math.floor(turnipSlot / 6) * 50 + 22);
  await frames(page);
  assert.match(await modalText(page), /Lumber 1 +Stone 1/);
  await tapButton(page, 'Close');

  // sell them at the market stall in town: put them on a shelf at the fair price; a buyer comes overnight
  await go(page, 'town', 'from_farm');
  await teleport(page, 11, 15, 'up');
  await page.waitForFunction(() => Farm.ui.actionLabel.text !== 'Talk', null, SLOW); // (a villager may be walking past the stall)
  assert.strictEqual(await actionLabel(page), 'Sell');
  await tapAction(page);
  assert.match(await modalText(page), /Market Stall/);
  await shot(page, '07-stand');
  await tapButton(page, 'Sell from bag');
  await page.waitForTimeout(300);
  await page.touchscreen.tap(33 + 22, 206 + 22); // the turnips, the only thing in the bag that sells
  await page.waitForTimeout(300);
  const P = await page.evaluate(() => ({ now: 3 * Math.floor(Farm.Config.ITEMS.turnip.sell * Farm.Config.STAND.instant), fair: 3 * Math.round(Farm.Config.ITEMS.turnip.sell * 1.2) }));
  assert.match(await modalText(page), new RegExp('Sell now: ' + P.now + 'G'));
  await tapButton(page, 'Fair: ' + P.fair + 'G  (about 2.5h)');
  s = await state(page);
  assert.deepStrictEqual(s.shelves[0] && [s.shelves[0].id, s.shelves[0].n, s.shelves[0].price], ['turnip', 3, 1]);
  assert.strictEqual(count(s, 'turnip'), 0);
  await page.evaluate(() => Farm.ui.closeAll());
  const goldBefore = s.gold;
  const report = await nextMorning(page);
  assert.match(report, new RegExp('1 lot sold\\. Collect ' + P.fair + 'G'));
  await clearAround(page, 11, 14); // (villagers stroll the plaza in the morning)
  await teleport(page, 11, 15, 'up');
  await page.waitForFunction(() => Farm.ui.actionLabel.text !== 'Talk', null, SLOW); // (a villager may be walking past the stall)
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.gold, goldBefore + P.fair, 'the stall paid the fair price');
  assert.strictEqual(s.shelves[0], null);
  await go(page, 'farm', 'from_town');

  // Lily's stand never closes (5 Nov 2026): open at 5:30 in the morning too, with no CLOSED sign on it
  await setClock(page, [2026, 4, 2, 5, 30]);
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  assert.match(await modalText(page), /Lily's Seed Stand/);
  await closeAll(page);
  await page.waitForTimeout(2200); // (signs are checked every 2 s)
  assert.ok(!(await page.evaluate(() => Farm.world.nightSigns && Farm.world.nightSigns.length)), 'no CLOSED sign');
  await setClock(page, [2026, 4, 2, 10, 0]);
  await tapAction(page);
  await shot(page, '07-shop');
  const bag = await page.evaluate(() => Farm.Config.ITEMS.seed_turnip.price);
  await tapButton(page, 'Buy ' + bag + 'G'); // a bag of turnip seeds
  s = await state(page);
  assert.strictEqual(count(s, 'seed_turnip'), 4);
  assert.strictEqual(s.gold, goldBefore + P.fair - bag);
  await tapButton(page, 'Supplies');
  assert.match(await modalText(page), /Milker/);
  assert.match(await modalText(page), /Fishing Rod/);
  assert.strictEqual(await page.evaluate(() => window.__gameBack()), true);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);

  // Back with nothing open shows the pause menu; Back again closes it
  assert.strictEqual(await page.evaluate(() => window.__gameBack()), true);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  await shot(page, '08-pause');
  await tapButton(page, 'Calendar');
  assert.match(await modalText(page), /Flower Festival/);
  await shot(page, '09-calendar');
  await page.evaluate(() => window.__gameBack());
  await page.evaluate(() => window.__gameBack());
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);

  // night falls on the phone's clock
  await setClock(page, [2026, 4, 2, 21, 0]);
  assert.strictEqual(await page.evaluate(() => Farm.ui.timeText.text), '9:00 PM');
  await shot(page, '10-night');

  // __gameSleep pauses the game and saves; waking picks up the real time
  const savesBefore = await page.evaluate(() => gameHost.saves.length);
  await page.evaluate(() => window.__gameSleep(true));
  const t0 = (await state(page)).time;
  await page.evaluate(() => { window.__now += 10 * 60000; });
  await page.waitForTimeout(1500);
  assert.strictEqual((await state(page)).time, t0, 'nothing runs while asleep');
  assert.strictEqual(await page.evaluate(() => gameHost.saves.length), savesBefore + 1, 'saved on sleep');
  await page.evaluate(() => window.__gameSleep(false));
  await page.waitForFunction((t0) => Farm.session.state.time >= t0 + 10, t0, SLOW); // and catches up on waking

  // saves are small and restore correctly in a fresh page
  const saves = await page.evaluate(() => gameHost.saves);
  saves.forEach((json) => assert.ok(json.length < 16384, `save is ${json.length} bytes`));
  const last = JSON.parse(saves[saves.length - 1]);
  assert.strictEqual(last.v, 1);
  const before = await state(page);
  assert.deepStrictEqual(problems, []);
  await context.close();

  const again = await open(last, [2026, 4, 2, 21, 30]);
  assert.strictEqual(await again.page.evaluate(() => Farm.ui.modals.length), 0, 'no welcome dialog on a loaded game');
  assert.strictEqual(await again.page.evaluate(() => Farm.world.player.texture.key), 'player_girl', 'still the girl after loading');
  const after = await state(again.page);
  assert.strictEqual(after.day, before.day);
  assert.strictEqual(after.gold, before.gold);
  assert.deepStrictEqual(after.soil, before.soil);
  assert.deepStrictEqual(after.debris, before.debris);
  assert.deepStrictEqual(after.inv, before.inv);
  assert.strictEqual(after.lumber, 1);
  assert.ok(Math.abs(after.player.x - before.player.x) <= 1);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('a pig and a carabao from the shop join the pen; the carabao is milked, the pig finds truffles', async () => {
  const { page, problems, context } = await open(await makeSave("s.gold = 5000; s.time = 600; L.addItem(s, 'milker', 1); L.addItem(s, 'fodder', 5);"));
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  await tapButton(page, 'Animals');
  await tapButton(page, 'Buy 1500G');
  await tapButton(page, 'Buy 3000G');
  let s = await state(page);
  assert.deepStrictEqual(s.animals.map((a) => a.kind), ['chicken', 'pig', 'carabao']);
  assert.strictEqual(s.gold, 500);
  assert.deepStrictEqual(await page.evaluate(() => Farm.world.herd.members.map((m) => m.sprite.texture.key)), ['animals', 'animals', 'animals']);
  await page.evaluate(() => window.__gameBack());
  // fodder feeds them both; 12 hours later (5 Nov 2026: it was the next morning) there is a truffle and carabao milk
  await hold(page, 'fodder');
  await meetAnimal(page, 1, 6, 33);
  assert.strictEqual(await actionLabel(page), 'Feed');
  await tapAction(page);
  await away(page, 1);
  await meetAnimal(page, 2, 6, 33);
  await tapAction(page);
  s = await state(page);
  assert.deepStrictEqual(s.animals.slice(1).map((a) => a.fed), [1, 1]);
  await advance(page, 12 * 60);
  await page.evaluate(() => Farm.world.changed());
  await meetAnimal(page, 2, 6, 33);
  assert.strictEqual(await actionLabel(page), 'Milk');
  await tapAction(page);
  await away(page, 2);
  await meetAnimal(page, 1, 6, 33);
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  assert.ok(s.inv.some((x) => x && x.id === 'truffle') && s.inv.some((x) => x && x.id === 'carabao_milk'));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('in town, a villager walks up to the market stall and buys what is on a shelf', async () => {
  const { page, problems, context } = await open(await makeSave("s.time = 600; L.addItem(s, 'potato', 4);"));
  await go(page, 'town', 'from_farm');
  await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, V = Farm.world.villagers;
    L.listItem(s, 0, s.inv.findIndex((x) => x && x.id === 'potato'), 4, 0);
    s.shelves[0].left = 1; // a buyer is due in a minute
    // no visitors today: one already at the stall buys within a frame or two, before this test can see them on the way
    V.nextShopper = Infinity;
    V.list.filter((v) => v.shopper).forEach((v) => { v.target = null; v.place = 'gone'; V.put(v, 0, 0, false); });
  });
  await advance(page, 2);
  // someone heads for the stall...
  await page.waitForFunction(() => Farm.world.buyers && Object.keys(Farm.world.buyers).length, null, SLOW);
  const buyer = await page.evaluate(() => Farm.world.buyers[0]);
  assert.ok(buyer, 'a villager is on the way');
  assert.strictEqual((await state(page)).shelves[0].coins, 0, 'not sold before they get there');
  await shot(page, '19b-buyer');
  // ...walks up, buys the potatoes and leaves the coins
  await page.waitForFunction(() => Farm.session.state.shelves[0] && Farm.session.state.shelves[0].coins > 0, null, SLOW);
  const at = await page.evaluate((k) => { const v = Farm.world.villagers.list.find((x) => x.key === k), p = Farm.world.points.stall_front; return Math.hypot(v.x - p.x, v.y - p.y); }, buyer);
  assert.ok(at < 256, 'they stood at the stall');
  const s = await state(page);
  assert.strictEqual(s.shelves[0].buyer, buyer);
  assert.strictEqual(s.shelves[0].coins, 4 * (await page.evaluate(() => Farm.Config.ITEMS.potato.sell)));
  await page.waitForFunction(() => !Farm.world.villagers.list.some((v) => v.errand), null, SLOW); // they head off
  await teleport(page, 11, 15, 'up');
  await page.waitForFunction(() => Farm.ui.actionLabel.text !== 'Talk', null, SLOW); // (a villager may be walking past the stall)
  assert.strictEqual(await actionLabel(page), 'Collect');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('someone walking near the farmer never freezes: a visitor at the stall leaves, and a villager heading into you goes round after a moment (owner, 31 Oct)', async () => {
  const { page, problems, context } = await open(await makeSave('s.time = 600;'));
  await go(page, 'town', 'from_farm');
  await teleport(page, 11, 15, 'up');
  const walker = () => page.evaluate(() => {
    const V = Farm.world.villagers, p = Farm.world.points;
    V.nextShopper = Infinity;
    V.list.filter((v) => v.shopper).forEach((v) => { v.target = null; v.place = 'gone'; V.put(v, 0, 0, false); });
    const v = V.list.find((x) => x.shopper);
    V.put(v, p.stall_front.x, p.stall_front.y, true); // standing at the stall, next to the farmer
    return v.key;
  });
  const gone = (key) => page.waitForFunction((k) => {
    const v = Farm.world.villagers.list.find((x) => x.key === k), f = Farm.world.feet();
    return Math.hypot(v.x - f.x, v.y - f.y) > Farm.Config.TILE * 1.5;
  }, key, { timeout: 15000 });
  // walking away from you: off they go
  let key = await walker();
  await page.evaluate((k) => {
    const v = Farm.world.villagers.list.find((x) => x.key === k), p = Farm.world.points;
    v.n++; v.target = { place: 'leave#' + v.n, point: p.from_east, hide: true };
  }, key);
  await gone(key);
  // walking straight at you: they stop first, so you can talk to them, and then carry on past
  key = await walker();
  await page.evaluate((k) => {
    const v = Farm.world.villagers.list.find((x) => x.key === k), f = Farm.world.feet(), T = Farm.Config.TILE;
    Farm.world.villagers.put(v, f.x - T * 0.6, f.y, true);
    v.path = [{ x: f.x, y: f.y }, { x: f.x + T * 4, y: f.y }];
    window.__held = 0;
    const t = setInterval(() => { if (v.x === f.x - T * 0.6) window.__held++; else clearInterval(t); }, 100);
  }, key);
  await page.waitForTimeout(1000);
  assert.ok(await page.evaluate(() => window.__held) >= 5, 'they stopped in front of you');
  await gone(key);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a box with three buttons keeps them all on the panel (owner, 31 Oct)', async () => {
  const { page, problems, context } = await open();
  const row = await page.evaluate(() => {
    Farm.ui.closeAll();
    Farm.ui.dialog('GIVE TO SELENE\nGive Selene your Chicken Feed (you have 7)?', [{ label: 'Cancel' }, { label: 'Give 1' }, { label: 'Give 7' }]);
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], seen = [];
    (function walk(list) {
      list.forEach((o) => {
        if (o.type === 'Text' && /^(Cancel|Give \d+)$/.test(o.text)) seen.push(o.parentContainer.x);
        if (o.list) walk(o.list);
      });
    })(m.c.list);
    return { seen, W: Farm.Config.WIDTH };
  });
  assert.strictEqual(row.seen.length, 3);
  row.seen.forEach((x) => { assert.ok(x - 45 >= 24 && x + 45 <= row.W - 24, 'on the panel: ' + x); });
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a new day starts at midnight wherever you are; energy comes back by itself', async () => {
  const { page, problems, context } = await open(null, [2026, 4, 1, 23, 50]);
  await tapButton(page, 'Boy');
  await page.waitForSelector('#farm-ask input', SLOW); // name your farmer (27 Oct): Cancel
  await page.click('#farm-ask button:first-child');
  await page.waitForSelector('#farm-ask', { state: 'detached' });
  await page.evaluate(() => window.__gameBack());
  // (the farm's debris is random: clear that tile, in the save AND on the map, or the farmer would be standing inside a
  // rock and pushed off it: the save alone left the rock on screen, and 1 run in 4 ended a tile away)
  await page.evaluate(() => { const i = 20 * Farm.Config.FARM_W + 10; delete Farm.session.state.debris[i]; Farm.world.removeDebrisTile(i); Farm.world.changed && Farm.world.changed(); });
  await teleport(page, 10, 20, 'down');
  const day = (await state(page)).day;
  // a stone just above you must not count as being stuck when the day's new world is built (the feet were read a tile too high)
  await page.evaluate(() => { const s = Farm.session.state; s.energy = 10; s.debris[19 * Farm.Config.FARM_W + 10] = 'stone'; });
  await advance(page, 30); // 00:20: a new day, and 30 minutes' worth of energy (1 every C.ENERGY_EVERY minutes)
  await page.waitForFunction((d) => Farm.session.state.day === d + 1 && !Farm.world.busy && Farm.world.player.active, day, SLOW);
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /A NEW DAY! APR 2/);
  await tapButton(page, 'OK');
  const s = await state(page);
  assert.strictEqual(s.energy, 10 + Math.floor(30 / (await page.evaluate(() => Farm.Config.ENERGY_EVERY))));
  assert.strictEqual(Math.floor(s.time), 20);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'farm', 'still on the farm');
  assert.ok(Math.abs(s.player.x / 256 - 10.5) < 0.5 && Math.abs(s.player.y / 256 - 20.5) < 0.5, 'where you stood');
  assert.strictEqual(await page.evaluate(() => Farm.ui.timeText.text), '12:20 AM');
  // the bed explains it
  await go(page, 'house', 'bed');
  await teleport(page, 2, 4, 'up');
  assert.strictEqual(await actionLabel(page), 'Bed');
  await tapAction(page);
  assert.match(await modalText(page), /A new day starts at midnight/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Bow is a real shot: it comes up, the string pulls back, then the arrow leaves, one at a time (owner, 2 Nov 2026)', async () => {
  const { page, problems, context } = await open();
  await closeAll(page);
  await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic;
    L.addItem(s, 'bow', 1);
    L.addItem(s, 'arrows', 10);
    s.sel = s.inv.findIndex((x) => x && x.id === 'bow');
  });
  await go(page, 'pulag', 'from_town');
  await page.evaluate(() => { const w = Farm.world; w.wild.next = 1e9; w.dir = 'right'; w.idle(); });
  const left = () => page.evaluate(() => Farm.session.state.inv.filter((x) => x && x.id === 'arrows').reduce((a, b) => a + b.n, 0));
  // a second tap while drawing does nothing, and no arrow has left yet
  const drawing = await page.evaluate(() => { const w = Farm.world; w.shoot(); w.shoot(); return { on: !!w.shot, flying: w.wildArrows.length, sheet: w.shot.body.texture.key, frame: w.shot.body.frame.name, hidden: !w.player.visible, standing: w.acting > 0 }; });
  assert.deepStrictEqual(drawing, { on: true, flying: 0, sheet: 'archer', frame: 6, hidden: true, standing: true });
  assert.strictEqual(await left(), 9);
  await page.waitForFunction(() => Farm.world.wildArrows.length === 1, null, SLOW);
  await page.waitForFunction(() => !Farm.world.shot, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.world.player.visible), true, 'the farmer is back');
  // each way has its pose, and the bow stays with you when you shoot up or down
  for (const [dir, frame] of [['up', 3], ['down', 0], ['left', 6]]) {
    await page.waitForFunction(() => Farm.world.wildArrows.length === 0, null, SLOW);
    const f = await page.evaluate((dir) => { const w = Farm.world; w.wild.animals.forEach((a) => { a.x = a.y = -9999; }); w.dir = dir; w.idle(); w.shoot(); return w.shot.body.frame.name; }, dir);
    assert.strictEqual(f, frame, dir);
    await page.waitForFunction(() => !Farm.world.shot, null, SLOW);
  }
  // leaving in the middle of a shot does not jam the Bow
  await page.evaluate(() => { const w = Farm.world; w.shoot(); w.travel('town', 'road_west'); });
  await waitMap(page, 'town');
  await go(page, 'pulag', 'from_town');
  assert.strictEqual(await page.evaluate(() => Farm.world.shot), null);
  // the string drawn on the icon is gone, the bow itself is not, for every level; a friend's shot flashes their bow
  const pictures = await page.evaluate(() => {
    const w = Farm.world, out = [];
    [0, 1, 2, 3].forEach((n) => {
      w.bowFlash(w.player.x, w.player.y, 0, n);
      const frame = Farm.Config.ICON[n ? 'bow_' + n : 'bow'], g = w.textures.get('fx-bow-' + frame).getSourceImage().getContext('2d');
      out.push([g.getImageData(85, 86, 1, 1).data[3] === 0, g.getImageData(62, 50, 1, 1).data[3] > 200]);
    });
    return out;
  });
  assert.deepStrictEqual(pictures, [[true, true], [true, true], [true, true], [true, true]]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('players\' suggestions on the farm: dig up a growing crop, a Power-Up shows its minutes (owner, 2 Nov 2026)', async () => {
  const { page, problems, context } = await open();
  await closeAll(page);
  const idx = 12 * 64 + 6;
  await page.evaluate((idx) => {
    const s = Farm.session.state;
    for (let y = 11; y <= 14; y++) for (let x = 4; x <= 9; x++) delete s.debris[y * 64 + x];
    s.soil[idx] = { w: 1, c: 'turnip', p: Farm.Logic.nowMin(), r: 0 };
    Farm.world.refreshDebris();
    Farm.world.refreshTile(idx);
  }, idx);
  await teleport(page, 6, 11, 'down');
  await hold(page, 'hoe');
  assert.strictEqual(await actionLabel(page), 'Dig up');
  await tapAction(page);
  assert.match(await modalText(page), /DIG THIS UP/);
  await tapButton(page, 'Yes');
  assert.strictEqual(await page.evaluate((idx) => Farm.session.state.soil[idx].c, idx), null);
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.addItem(s, 'power_up', 1); Farm.Logic.usePowerUp(s, s.inv.findIndex((x) => x && x.id === 'power_up')); });
  await page.waitForFunction(() => Farm.ui.powerChipBox && Farm.ui.powerChipBox.visible, null, SLOW);
  assert.match(await page.evaluate(() => Farm.ui.powerText.text), /^120 min$/);
  await shot(page, '53-power');
  // behind a friend, a floor past your own earns nothing: no chest, no lift, no energy
  const deep = await page.evaluate(async () => {
    const s = Farm.session.state;
    s.stats.deepest = 20;
    Farm.session.visit = { host: 'friend', name: 'Ana', inTown: true, state: {} };
    Farm.world.travel('mine', 'entrance', 205);
    return new Promise((done) => {
      const look = () => {
        const w = Farm.world;
        if (w.mapKey !== 'mine' || w.busy || !w.chest) return setTimeout(look, 100);
        w.setFeet(9.5 * 256, 4.6 * 256);
        w.dir = 'up';
        w.idle();
        setTimeout(() => {
          const a = w.objectAction ? w.objectAction(w.objects.filter((o) => o.type === 'chest')[0], null, null) : null;
          done({ deepest: s.stats.deepest, label: a && a.label, max: Farm.Logic.maxEnergy(s) });
        }, 300);
      };
      look();
    });
  });
  assert.deepStrictEqual(deep, { deepest: 20, label: 'Locked', max: 100 });
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('wood: the big trees of Makiling Forest come down to the Axe, and the Forge has the rod (owner, 2 Nov 2026)', async () => {
  const { page, problems, context } = await open();
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; s.wild.n = 10; L.addItem(s, 'rod', 1); L.addItem(s, 'ore_copper', 5); s.gold = 3000; });
  await go(page, 'makiling', 'from_pulag');
  await hold(page, 'axe');
  const trees = await page.evaluate(() => {
    const w = Farm.world, T = Farm.Config.TILE;
    w.wild.next = 1e9;
    w.wild.animals.forEach((a) => { a.x = a.y = -9999; });
    const p = w.trees[0];
    w.setFeet(p.x + p.displayWidth / 2, p.y + 0.5 * T);
    w.dir = 'up';
    w.idle();
    return w.trees.length;
  });
  assert.strictEqual(trees, 8);
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Chop');
  const before = await page.evaluate(() => Farm.session.state.lumber);
  await tapAction(page);
  await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.lumber), before + 2);
  await shot(page, '54-tree');
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => { const a = Farm.world.resolve(); return a.label + (a.disabled ? ' off' : ''); }), 'Chop off');
  await page.evaluate(() => Farm.ui.openForge(1));
  await frames(page, 3);
  assert.match(await modalText(page), /Fishing Rod.*A Copper Rod/);
  await shot(page, '55-forge');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('three toolbars: swipe the bar for the next 6 slots, a swipe picks nothing, the Bag stays (owner, 2 Nov 2026)', async () => {
  const { page, problems, context, cdp } = await open();
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; s.inv[6] = { id: 'axe', n: 1 }; s.inv[13] = { id: 'seed_turnip', n: 2 }; Farm.ui.select(0); });
  await frames(page, 2);
  const bar = () => page.evaluate(() => ({ page: Farm.ui.hotPage, sel: Farm.session.state.sel }));
  const swipe = async (from, to) => {
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', from, 606);
    await frames(page);
    for (let k = 1; k <= 4; k++) { await touch('touchMove', from + (to - from) * k / 4, 606); await frames(page); }
    await touch('touchEnd');
    await frames(page, 3);
  };
  await swipe(250, 150);
  assert.deepStrictEqual(await bar(), { page: 1, sel: 0 }, 'on to the second bar, still holding the same thing');
  await tapHotbar(page, 0, 1);
  assert.deepStrictEqual(await bar(), { page: 1, sel: 6 }, 'a tap picks from this bar');
  await shot(page, '52-toolbar');
  await swipe(250, 150);
  await swipe(250, 150);
  assert.deepStrictEqual(await bar(), { page: 2, sel: 6 }, 'three bars, no more');
  await tapHotbar(page, 1, 2);
  assert.strictEqual((await bar()).sel, 13);
  await swipe(100, 220);
  await swipe(100, 220);
  await swipe(100, 220);
  assert.deepStrictEqual(await bar(), { page: 0, sel: 13 }, 'and back');
  // picked in the bag: the bar shows it
  await page.evaluate(() => { Farm.session.state.sel = 6; Farm.ui.refresh(); });
  assert.strictEqual((await bar()).page, 1);
  // past the three bars, the bag still works
  await page.evaluate(() => { const s = Farm.session.state; s.inv[20] = { id: 'axe', n: 1 }; s.sel = 20; Farm.ui.refresh(); });
  assert.deepStrictEqual(await bar(), { page: 1, sel: 20 });
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('more land: a fenced block with a For Sale sign, bought, tilled, and still yours after a reload (owner, 2 Nov 2026)', async () => {
  const { page, problems, context } = await open();
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; s.gold = 15000; delete s.debris; s.debris = {}; });
  // the way in, past the old tree line
  await teleport(page, 34, 33, 'right');
  await page.evaluate(() => { Farm.world.setFeet(39.5 * Farm.Config.TILE, 33.5 * Farm.Config.TILE); });
  assert.strictEqual(await page.evaluate(() => Farm.world.tileAt('Walls', 36, 33)), null, 'the tree is gone');
  // the second block is not for sale yet; the first is
  await teleport(page, 39, 18, 'right');
  assert.strictEqual(await actionLabel(page), 'For sale');
  await tapAction(page);
  assert.match(await modalText(page), /Not yet/);
  await closeAll(page);
  await teleport(page, 39, 29, 'right');
  assert.strictEqual(await actionLabel(page), 'For sale');
  await tapAction(page);
  assert.match(await modalText(page), /BUY THIS LAND.*10,000G/);
  await tapButton(page, 'Yes');
  await frames(page, 5);
  const bought = await page.evaluate(() => { const w = Farm.world; return { land: w.state.land, gold: w.state.gold, fence: !!w.tileAt('Walls', 40, 29), till: w.isTillable(45, 30), next: w.isTillable(45, 18) }; });
  assert.deepStrictEqual(bought, { land: 1, gold: 5000, fence: false, till: true, next: false });
  await shot(page, '50-land');
  // walk in, till it
  await hold(page, 'hoe');
  await teleport(page, 44, 29, 'right');
  await tapAction(page);
  const idx = 29 * 64 + 45;
  assert.ok(await page.evaluate((i) => !!Farm.session.state.soil[i], idx), 'tilled');
  // a save and a reload keep the land and the soil
  const save = await page.evaluate(() => JSON.stringify(Farm.Logic.serialize(Farm.session.state)));
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(JSON.parse(save));
  await closeAll(again.page);
  const after = await again.page.evaluate((i) => { const w = Farm.world; return { land: w.state.land, soil: !!w.state.soil[i], fence: !!w.tileAt('Walls', 40, 29), locked: !!w.tileAt('Walls', 40, 18) }; }, idx);
  assert.deepStrictEqual(after, { land: 1, soil: true, fence: false, locked: true });
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('the field fence can be moved: drag a piece in Decorate, put another away (owner, 2 Nov 2026)', async () => {
  const { page, problems, context, cdp } = await open();
  await closeAll(page);
  await teleport(page, 24, 18, 'left'); // (a solid piece can't go where the farmer stands)
  const toScreen = (x, y) => page.evaluate(([x, y]) => {
    const cam = Farm.world.cameras.main, T = 256;
    return { x: ((x + 0.5) * T - cam.worldView.x) * cam.zoom / Farm.R, y: ((y + 0.5) * T - cam.worldView.y) * cam.zoom / Farm.R };
  }, [x, y]);
  await page.touchscreen.tap(330, 258); // Decorate
  await page.waitForFunction(() => Farm.world.yd && Farm.ui.decorBar, null, SLOW);
  const fence = () => page.evaluate(() => { const s = Farm.session.state, f = Farm.Config.OUTDOOR.index.field_fence; return s.yard.items.filter((it) => it.t === f).map((it) => it.x + ',' + it.y); });
  assert.strictEqual((await fence()).length, 60);
  const from = await toScreen(20, 15), to = await toScreen(22, 15);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await page.touchscreen.tap(from.x, from.y); // a tap picks the piece, then it can be dragged
  await frames(page, 3);
  const picked = await page.evaluate(() => { const w = Farm.world, it = w.state.yard.items[w.yd.sel]; return it && [it.x, it.y]; });
  assert.deepStrictEqual(picked, [20, 15], 'a tap picks a fence piece');
  await touch('touchStart', from.x, from.y);
  await frames(page);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', from.x + (to.x - from.x) * k / 6, from.y); await frames(page, 2); }
  await touch('touchEnd');
  await frames(page, 3);
  const moved = await fence();
  assert.ok(moved.includes('22,15') && !moved.includes('20,15'), 'the piece moved');
  assert.strictEqual(await page.evaluate(() => Farm.world.tileAt('Walls', 20, 15)), null);
  await shot(page, '51-fence');
  await page.evaluate(() => { const w = Farm.world, s = w.state, f = Farm.Config.OUTDOOR.index.field_fence; w.yardSelect(s.yard.items.findIndex((it) => it.t === f && it.x === 20 && it.y === 16)); w.yardStore(); });
  await frames(page, 2);
  assert.strictEqual((await fence()).length, 59);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.yard.bag[Farm.Config.OUTDOOR.index.field_fence]), 1, 'kept in storage');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the deeper Mine: the lift stops at a band you reached, its cave has its own colours, a new band grows the bar (owner, 2 Nov 2026)', async () => {
  const { page, problems, context } = await open();
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; s.stats.deepest = 250; s.goal = 1e6; });
  await go(page, 'mine', 'entrance');
  const sheet = () => page.evaluate(() => Farm.world.map.getTileset('indoor').image.key);
  assert.strictEqual(await sheet(), 'indoor', 'the first 200 floors look as they did');
  await teleport(page, 4, 3, 'left');
  assert.strictEqual(await actionLabel(page), 'Lift');
  await tapAction(page);
  assert.match(await modalText(page), /Mine Lift/);
  // the deepest first: 201, 151, 101, 51, then floor 1 (Here) on the next page
  assert.match(await modalText(page), /Floor 201 \| Purple Crystal Caves: its first floor[\s\S]*Floor 151 \| The Mine/);
  await shot(page, 'mine-lift');
  await tapButton(page, 'Go', 0);
  await page.waitForFunction(() => Farm.session.mineFloor === 201 && Farm.world.mapKey === 'mine' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await frames(page, 3);
  assert.strictEqual(await sheet(), 'indoor-crystal');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.maxEnergy(Farm.session.state)), 100 + 10);
  await shot(page, '52-crystal');
  // a rock here pays in the band's goods, and a chest holds its gem
  const rock = await page.evaluate(() => {
    const w = Farm.world, s = w.state, floor = 201;
    const real = Math.random;
    Math.random = () => 0.86;
    const idx = w.mine.rocks[0], t = { x: idx % w.map.width, y: Math.floor(idx / w.map.width) }, show = w.breakRock(idx, t, {});
    Math.random = real;
    if (show) show();
    return { has: Farm.Logic.countItem(s, 'amethyst'), floor };
  });
  assert.strictEqual(rock.has, 1);
  // down the ladder into a new band for the first time
  await page.evaluate(() => { Farm.session.state.stats.deepest = 400; Farm.world.travel('mine', 'entrance', 401); });
  await page.waitForFunction(() => Farm.session.mineFloor === 401 && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await page.waitForFunction(() => Farm.ui.toastText.visible && /Green Jade Deep/.test(Farm.ui.toastText.text), null, SLOW);
  assert.strictEqual(await sheet(), 'indoor-jade');
  assert.strictEqual(await page.evaluate(() => Farm.mineSheet), 'indoor-jade');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.maxEnergy(Farm.session.state)), 100 + 20);
  // back to the top by the lift, and the cave is the old one again
  await teleport(page, 4, 3, 'left');
  await tapAction(page);
  assert.match(await modalText(page), /Floor 401 \| Green Jade Deep: its first floor/);
  await page.evaluate(() => { Farm.ui.closeModal(); Farm.ui.openLift(2); }); // (9 stops, 4 a page: floor 1 is on the last)
  assert.match(await modalText(page), /Floor 1 \| The Mine: its first floor/);
  await tapButton(page, 'Go', 0);
  await page.waitForFunction(() => Farm.session.mineFloor === 1 && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  assert.strictEqual(await sheet(), 'indoor');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Wild Lands: the road west to Pulag, Kanor sells a Bow, a hunted deer leaves venison, Makiling waits for 10 hunts (owner, 30 Oct 2026)', async () => {
  const { page, problems, context } = await open();
  await closeAll(page);
  await page.evaluate(() => { Farm.session.state.gold = 5000; });
  await go(page, 'town', 'from_farm');
  // the sign at the west end of the main road, then walk off the edge into Pulag
  await teleport(page, 2, 20, 'down');
  assert.strictEqual(await actionLabel(page), 'Read');
  await teleport(page, 0, 20, 'left');
  await waitMap(page, 'pulag');
  const here = await page.evaluate(() => Farm.world.wild.animals.map((a) => a.kind).sort());
  assert.deepStrictEqual(here, ['deer', 'deer', 'labuyo', 'labuyo', 'labuyo', 'rabbit', 'rabbit', 'rabbit']);
  // Kanor: hello once, then his shop
  await page.evaluate(() => { const k = Farm.world.kanor, T = Farm.Config.TILE; Farm.world.setFeet(k.x, k.y + 1.1 * T); Farm.world.dir = 'up'; Farm.world.idle(); });
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  assert.match(await modalText(page), /KANOR.*Need a bow\?/);
  await tapButton(page, 'Shop');
  await tapButton(page, 'Buy 800G');
  await tapButton(page, 'Buy 60G');
  assert.match(await modalText(page), /Copper Bow.*You have 10/);
  await shot(page, '42-kanor');
  await closeAll(page);
  // hold the Bow, face a deer that stands still, shoot it down (2 arrows), walk over its venison
  const d = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, T = Farm.Config.TILE;
    s.sel = s.inv.findIndex((x) => x && x.id === 'bow');
    w.wild.animals.filter((a) => a.kind !== 'deer').forEach((a) => { a.img.destroy(); a.sh.destroy(); });
    w.wild.animals = w.wild.animals.filter((a) => a.kind === 'deer').slice(0, 1);
    w.wild.next = 1e9; // no new ones walking in
    const a = w.wild.animals[0];
    a.def = Object.assign({}, a.def, { shy: 0 });
    a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9;
    for (let tx = 4; tx < 26; tx++) for (let ty = 4; ty < 22; ty++) if (w.wildFree(tx, ty) && w.wildFree(tx + 2, ty)) { a.x = (tx + 2.5) * T; a.y = (ty + 0.7) * T; return [tx, ty]; }
    return null;
  });
  assert.ok(d, 'a clear spot');
  await teleport(page, d[0], d[1], 'right');
  assert.strictEqual(await actionLabel(page), 'Shoot');
  // (a struck deer runs, so a second arrow can miss: it is brought back and held still for the test)
  const spot = await page.evaluate(() => { const a = Farm.world.wild.animals[0]; return [a.x, a.y]; });
  for (let k = 0; k < 2; k++) {
    await tapAction(page);
    await page.waitForTimeout(500);
    await page.evaluate(([x, y]) => { const a = Farm.world.wild.animals[0]; if (a) { a.x = x; a.y = y; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; } }, spot);
  }
  await page.waitForFunction(() => Farm.world.wild.animals.length === 0, null, SLOW);
  const drops = await page.evaluate(() => Farm.world.wildDrops.map((x) => x.id));
  assert.deepStrictEqual(drops.filter((x) => x === 'venison'), ['venison', 'venison']);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.wild.n), 1);
  await shot(page, '43-hunted');
  // a new one walks in once it is due, while you stay
  await page.evaluate(() => { const w = Farm.world, g = Farm.session.state.wild.gone; Object.keys(g).forEach((k) => { g[k] = 0; }); w.wild.next = 0; });
  await page.waitForFunction(() => Farm.world.wild.animals.length === 1, null, SLOW);
  await page.evaluate(() => { const w = Farm.world; w.wild.next = 1e9; });
  const at = await page.evaluate(() => { const x = Farm.world.wildDrops[0]; return [x.x, x.y]; });
  await page.evaluate(([x, y]) => Farm.world.setFeet(x, y), at);
  await page.waitForFunction(() => Farm.Logic.countItem(Farm.session.state, 'venison') >= 1, null, SLOW);
  // Makiling is shut until 10 hunts
  await page.evaluate(() => Farm.world.travel('makiling', 'from_pulag'));
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'pulag');
  // Magayon stays shut too, then the road north out of Makiling opens after 40 hunts, with its big animals
  await page.evaluate(() => Farm.world.travel('magayon', 'from_makiling'));
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'pulag');
  // what is left on the ground goes home with you
  await go(page, 'town', 'from_pulag');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'venison')), 2);
  const saved = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.strictEqual(saved.wl[0], 1);
  await page.evaluate(() => { Farm.session.state.wild.n = 40; });
  await go(page, 'makiling', 'from_pulag');
  await page.evaluate(() => { const T = Farm.Config.TILE; Farm.world.setFeet(20.9 * T, 0.5 * T); Farm.world.dir = 'up'; });
  await waitMap(page, 'magayon');
  const big = await page.evaluate(() => Farm.world.wild.animals.map((a) => a.kind).sort());
  assert.deepStrictEqual(big, ['bear', 'bear', 'bear', 'mammoth', 'rhino', 'rhino', 'tiger', 'tiger']);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('home storage: the free Dresser opens Storage; put a stack away, take it back (owner, 30 Oct 2026)', async () => {
  const { page, problems, context } = await open();
  await tapButton(page, 'Boy');
  await page.waitForSelector('#farm-ask input', SLOW);
  await page.click('#farm-ask button:first-child');
  await page.waitForSelector('#farm-ask', { state: 'detached' });
  await page.evaluate(() => window.__gameBack());
  await go(page, 'house', 'bed');
  const d = await page.evaluate(() => { const H = Farm.Config.HOME; const it = Farm.session.state.home.items.find((x) => H.types[x.t].key === 'dresser'); return { x: it.x, y: it.y }; });
  await teleport(page, d.x, d.y + 2, 'up');
  assert.strictEqual(await actionLabel(page), 'Storage');
  await page.evaluate(() => { Farm.session.state.inv[8] = { id: 'carrot', n: 40 }; });
  await tapAction(page);
  assert.match(await modalText(page), /Storage {2}1\/2.*0 of 60 slots used/);
  await tapButton(page, 'Bag');
  assert.match(await modalText(page), /Tap an item to read about it, put it away/);
  await tapSlotOnPage(page, 8);
  assert.match(await modalText(page), /Carrot.*x40.*Sells for.*How many to put away/, 'an item says what it is, and asks how many');
  await shot(page, '41b-store-item');
  await tapButton(page, '10');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.inv[8].n), 30);
  await tapSlotOnPage(page, 8);
  await tapButton(page, 'All');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.inv[8]), null);
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.store[0]), { id: 'carrot', n: 40 });
  await shot(page, '41-storage');
  // kept in the save
  const saved = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.deepStrictEqual(saved.kp, [['carrot', 40]]);
  await tapButton(page, 'Storage');
  // Move: pick it up, tap where it goes
  await tapSlotOnPage(page, 0);
  await tapButton(page, 'Move');
  assert.match(await modalText(page), /Now tap where to put the Carrot/);
  await tapSlotOnPage(page, 3);
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.store[3]), { id: 'carrot', n: 40 });
  await tapSlotOnPage(page, 3);
  await tapButton(page, 'All');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'carrot')), 40);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.store[3]), null);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('one cabinet, one storage: a Wardrobe keeps its own 60, the Dresser its own; a cabinet with things in it stays (owner, 5 Nov 2026)', async () => {
  const { page, problems, context } = await open();
  await tapButton(page, 'Boy');
  await page.waitForSelector('#farm-ask input', SLOW);
  await page.click('#farm-ask button:first-child');
  await page.waitForSelector('#farm-ask', { state: 'detached' });
  await page.evaluate(() => window.__gameBack());
  await go(page, 'house', 'bed');
  const w = await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, H = Farm.Config.HOME, t = H.typeIndex.wardrobe;
    s.home.bag[L.furnKey(t, 0)] = 1;
    const spot = L.findSpot(s, t, 4, 2, null);
    const i = L.placeFurn(s, t, 0, spot.x, spot.y, 0);
    Farm.world.placeHome();
    s.inv[8] = { id: 'carrot', n: 40 };
    return { i, x: spot.x, y: spot.y, n: s.store.length };
  });
  assert.strictEqual(w.n, 120, 'a second cabinet, 60 more slots');
  await teleport(page, w.x, w.y + 3, 'up');
  assert.strictEqual(await actionLabel(page), 'Storage');
  await tapAction(page);
  assert.match(await modalText(page), /Wardrobe {2}1\/2.*0 of 60 slots used/);
  await tapButton(page, 'Bag');
  await tapSlotOnPage(page, 8);
  await tapButton(page, 'All');
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.store[60]), { id: 'carrot', n: 40 }, "in the Wardrobe's own slots");
  assert.strictEqual(await page.evaluate(() => Farm.session.state.store[0]), null);
  await tapButton(page, 'Storage');
  await shot(page, '41c-wardrobe-storage');
  await tapButton(page, 'Close');
  // the Dresser has its own, still empty
  const d = await page.evaluate(() => { const H = Farm.Config.HOME; const it = Farm.session.state.home.items.find((x) => H.types[x.t].key === 'dresser'); return { x: it.x, y: it.y }; });
  await teleport(page, d.x, d.y + 2, 'up');
  await tapAction(page);
  assert.match(await modalText(page), /Dresser {2}1\/2.*0 of 60 slots used/);
  await tapButton(page, 'Close');
  // the Wardrobe can't be put away with the Carrots in it
  const kept = await page.evaluate((i) => { Farm.world.startDecor(); Farm.world.decor.sel = i; Farm.world.decorStore(); return Farm.session.state.home.items.length; }, w.i);
  assert.strictEqual(kept, await page.evaluate(() => Farm.session.state.home.items.length));
  assert.ok(await page.evaluate(() => Farm.Logic.cabinets(Farm.session.state).length === 2), 'still standing');
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Empty it first/);
  // kept in the save, in the Wardrobe's place
  const saved = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.deepStrictEqual(saved.kp[60], ['carrot', 40]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('sleep in your bed: tucked in with Zzz, energy every minute, the joystick wakes you (owner, 29 Oct 2026)', async () => {
  const { page, problems, context } = await open();
  await tapButton(page, 'Boy');
  await page.waitForSelector('#farm-ask input', SLOW);
  await page.click('#farm-ask button:first-child');
  await page.waitForSelector('#farm-ask', { state: 'detached' });
  await page.evaluate(() => window.__gameBack());
  await go(page, 'house', 'bed');
  await teleport(page, 1, 4, 'up'); // (a new farm's bed is at 1,2)
  await page.evaluate(() => { const s = Farm.session.state; s.energy = 10; s.regen = Farm.Logic.nowMin(); });
  assert.strictEqual(await actionLabel(page), 'Bed');
  await tapAction(page);
  assert.match(await modalText(page), /Take a nap\?/);
  await tapButton(page, 'Sleep');
  await frames(page, 3);
  let z = await page.evaluate(() => ({ on: !!Farm.world.sleeping, asleep: Farm.session.state.asleep, seen: Farm.world.player.visible,
    art: Farm.world.sleeping && Farm.world.sleeping.img.texture.key, bar: !!Farm.ui.sleepBar }));
  assert.deepStrictEqual(z, { on: true, asleep: true, seen: false, art: 'props/sleepbed_boy', bar: true }, 'the classic bed: the whole-bed picture (owner, 29 Oct)');
  await advance(page, 3);
  await page.waitForTimeout(1200);
  await shot(page, '40-asleep');
  assert.strictEqual((await state(page)).energy, 13, '1 point a minute while asleep');
  await page.waitForFunction(() => Farm.world.sleeping.zzz.length > 0, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.regenEvery(Farm.session.state)), 1);
  // a push on the joystick wakes you, and energy is back to every 2 minutes
  await page.evaluate(() => { Farm.input.jx = 1; });
  await frames(page, 2);
  await page.evaluate(() => { Farm.input.jx = 0; });
  z = await page.evaluate(() => ({ on: !!Farm.world.sleeping, asleep: Farm.session.state.asleep, seen: Farm.world.player.visible, bar: !!Farm.ui.sleepBar }));
  assert.deepStrictEqual(z, { on: false, asleep: false, seen: true, bar: false });
  await advance(page, 4);
  assert.strictEqual((await state(page)).energy, 15, 'awake: 1 point every 2 minutes');
  // asleep with a nearly full bar: it wakes you when it is full; the saved game never says you are asleep
  // another style of bed: its own picture of the bed with you in it
  await page.evaluate(() => { Farm.session.state.home.items.forEach((it) => { if (Farm.Config.HOME.types[it.t].use === 'sleep') it.v = 1; }); Farm.world.fallAsleep(); });
  assert.strictEqual(await page.evaluate(() => Farm.world.sleeping.img.texture.key), 'props/sleepbed_v1_boy', 'other styles: their own whole-bed picture (30 Oct)');
  await page.evaluate(() => { Farm.world.wakeUp(); Farm.session.state.home.items.forEach((it) => { it.v = 0; }); });
  await page.evaluate(() => { const s = Farm.session.state; s.energy = Farm.Logic.maxEnergy(s) - 1; s.regen = Farm.Logic.nowMin(); Farm.world.fallAsleep(); });
  assert.ok(!('asleep' in JSON.parse(JSON.stringify(await page.evaluate(() => Farm.Logic.serialize(Farm.session.state))))));
  await advance(page, 1);
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => !!Farm.world.sleeping), false, 'woke up full');
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /full of energy/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a garbage save from the host starts a new game instead of crashing', async () => {
  const { page, problems, context } = await open('{not json');
  const s = await state(page);
  assert.strictEqual(s.day, await page.evaluate(() => Farm.Logic.dayOf(window.__now)), 'a new farm, today');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Parks an animal at a tile and keeps it there, then puts the farmer just above it, facing down.
// moves a pen animal out of the way, to a corner of the pen
const away = (page, i) => page.evaluate((i) => {
  const h = Farm.world.herd, m = h.members[i];
  m.x = m.tx = h.pen.x0 + 300;
  m.y = m.ty = h.pen.y1 - 100;
  m.wait = 1e9;
}, i);

async function meetAnimal(page, i, tx, ty) {
  await page.evaluate(([i, tx, ty]) => {
    const T = Farm.Config.TILE, m = Farm.world.herd.members[i];
    m.x = m.tx = tx * T + T / 2;
    m.y = m.ty = (ty + 0.8) * T;
    m.wait = 1e9;
  }, [i, tx, ty]);
  await teleport(page, tx, ty - 1, 'down');
}

test('animals: pet, feed, brush, collect an egg, sell it, buy a cow, the dog, save', async () => {
  const { page, problems, context } = await open(await makeSave());
  let s = await state(page);
  assert.strictEqual(s.animals.length, 1);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members.length), 1);

  // pet Clucky (holding the hoe)
  await meetAnimal(page, 0, 5, 33);
  assert.strictEqual(await actionLabel(page), 'Pet');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.animals[0].pet, 1);
  assert.ok(s.animals[0].love > 0);

  // feed her (Chicken Feed is in hotbar slot 4)
  await tapHotbar(page, 3);
  assert.strictEqual(await actionLabel(page), 'Feed');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.animals[0].fed, 1);
  assert.strictEqual(s.inv[3].n, 4);

  // and brush her
  await page.evaluate(() => Farm.Logic.addItem(Farm.session.state, 'brush', 1));
  await hold(page, 'brush');
  assert.strictEqual(await actionLabel(page), 'Brush');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.animals[0].brushed, 1);
  assert.strictEqual(await actionLabel(page), 'Clucky', 'cared for: shows her name');
  await shot(page, '11-pen');

  // next morning there is an egg waiting
  await nextMorning(page);
  s = await state(page);
  assert.strictEqual(s.animals[0].ready, 1);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members[0].bubble.visible), true, 'egg bubble shows');
  await meetAnimal(page, 0, 6, 33);
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  assert.ok(count(s, 'egg') === 1, 'egg collected');
  assert.strictEqual(s.animals[0].ready, 0);


  // sell the egg right away at the market stall in town
  await go(page, 'town', 'from_farm');
  await teleport(page, 11, 15, 'up');
  await page.waitForFunction(() => Farm.ui.actionLabel.text !== 'Talk', null, SLOW); // (a villager may be walking past the stall)
  await tapAction(page);
  await tapButton(page, 'Sell from bag');
  await page.waitForTimeout(300);
  await page.touchscreen.tap(33 + 22, 206 + 22);
  await page.waitForTimeout(300);
  const goldEgg = (await state(page)).gold;
  await tapButton(page, 'Sell now: 30G');
  s = await state(page);
  assert.strictEqual(count(s, 'egg'), 0);
  assert.strictEqual(s.gold, goldEgg + 30, 'sold now at 75%');
  await page.evaluate(() => Farm.ui.closeAll());
  await go(page, 'farm', 'from_town');

  // buy a cow from the Animals tab
  await page.evaluate(() => { Farm.session.state.gold = 2500; Farm.session.state.time = 600; });
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  await tapButton(page, 'Animals');
  await shot(page, '12-shop-animals');
  await tapButton(page, 'Buy 2000G');
  s = await state(page);
  assert.strictEqual(s.animals.length, 2);
  assert.strictEqual(s.animals[1].kind, 'cow');
  assert.strictEqual(s.animals[1].name, 'Daisy');
  assert.strictEqual(s.gold, 500);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members.length), 2);
  await page.evaluate(() => window.__gameBack());

  // the wrong feed is refused with a hint
  await page.evaluate(() => { Farm.Logic.addItem(Farm.session.state, 'chicken_feed', 1); });
  await hold(page, 'chicken_feed');
  await meetAnimal(page, 1, 6, 33);
  await shot(page, '13-cow');
  assert.strictEqual(await actionLabel(page), 'Feed');
  await tapAction(page);
  assert.strictEqual((await state(page)).animals[1].fed, 0, 'chicken feed does not feed a cow');

  // pet the dog in his yard by the house
  await page.evaluate(() => {
    const d = Farm.world.dog, T = 256;
    d.x = d.tx = 13.5 * T;
    d.y = d.ty = 7.9 * T;
    d.wait = 1e9;
  });
  await teleport(page, 13, 6, 'down');
  assert.strictEqual(await actionLabel(page), 'Pet');
  await tapAction(page);
  assert.strictEqual((await state(page)).dog.pet, 1);

  // animals survive a save + reload
  const saved = await page.evaluate(() => { Farm.world.save(); return gameHost.saves[gameHost.saves.length - 1]; });
  assert.ok(saved.length < 16384);
  const before = await state(page);
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(JSON.parse(saved));
  const after = await state(again.page);
  assert.deepStrictEqual(after.animals, before.animals);
  assert.strictEqual(await again.page.evaluate(() => Farm.world.herd.members.length), 2);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('a taller phone gets a taller view: top bar at the top, controls at the bottom, panels centred', async () => {
  const { page, problems, context } = await open(await makeSave(), START, { width: 360, height: 780 });
  const at = await page.evaluate(() => ({
    view: Farm.Config.VIEW_H, extra: Farm.Config.EXTRA, canvas: Math.round(document.querySelector('canvas').getBoundingClientRect().height),
    time: Math.round(Farm.ui.timeText.getBounds().centerY), action: Math.round(Farm.ui.actionBtn.y), bag: Math.round(Farm.ui.bagWidget.bg.getBounds().centerY),
    rows: Math.round(Farm.world.cameras.main.height / Farm.world.cameras.main.zoom / Farm.Config.TILE),
  }));
  assert.deepStrictEqual({ view: at.view, extra: at.extra, canvas: at.canvas }, { view: 780, extra: 140, canvas: 780 });
  assert.ok(at.time < 50, 'the clock stays at the top (' + at.time + ')');
  assert.strictEqual(at.action, 512 + 140, 'the action button moves to the bottom');
  assert.ok(at.bag > 720, 'the hotbar sits at the bottom (' + at.bag + ')');
  assert.ok(at.rows >= 24, 'the world shows more rows (' + at.rows + ')');
  await page.evaluate(() => window.__gameBack());
  const pause = await page.evaluate(() => { const m = Farm.ui.modals[0].c; const b = m.list[1].getBounds(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; });
  assert.ok(Math.abs(pause.top - (780 - pause.bottom)) < 40, 'the pause menu is centred (' + JSON.stringify(pause) + ')');
  await shot(page, '15-tall-pause');
  await tapButton(page, 'Resume');
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'buttons still land on a tall screen');
  // the joystick, dragged at its new place, walks the farmer
  const y0 = await page.evaluate(() => Farm.world.feet().y);
  await page.mouse.move(86, 652); await page.mouse.down(); await page.mouse.move(86, 700, { steps: 5 });
  await page.waitForTimeout(700); await page.mouse.up();
  assert.ok((await page.evaluate(() => Farm.world.feet().y)) > y0 + 100, 'the joystick works at the bottom');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('owner batch: one tap harvests the Sickle\'s reach; a bigger bag; the energy panel; a Weekend Market day', async () => {
  const SAT = [2026, 10, 31, 10, 0];
  const save = await makeSave(`
    s.goal = 1;
    s.gold = 9000;
    s.tools.sickle = 2; // Silver: a 3x3 patch
    for (let y = 13; y <= 15; y++) for (let x = 9; x <= 11; x++) s.soil[y * 64 + x] = { c: 'carrot', p: L.nowMin() - 60, w: 0, r: 0 };
  `, SAT);
  const { page, problems, context } = await open(save, SAT);
  await closeAll(page);
  await teleport(page, 10, 12, 'down');
  assert.strictEqual(await actionLabel(page), 'Harvest');
  await tapAction(page);
  assert.strictEqual(count(await state(page), 'carrot'), 9, 'a Silver Sickle harvests the 3x3 patch in one tap');
  // the energy panel
  await page.touchscreen.tap(188, 29);
  await frames(page, 4);
  assert.match(await modalText(page), /Energy \d+ \/ \d+.*1 point every 2 minutes/);
  await shot(page, '35-energy');
  await closeAll(page);
  // Weekend Market: Lily's seeds 20% off; a bigger bag in Supplies
  await page.evaluate(() => Farm.ui.openShop('seeds'));
  assert.match(await modalText(page), /Weekend Market: seeds 20% off!.*Buy 16G/);
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openShop('supplies'));
  await tapButton(page, 'Buy 2000G');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.inv.length), 24);
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openInventory());
  await shot(page, '36-bag-24');
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  // a bag over 30 has pages (owner, 30 Oct): the arrows turn them, and Move takes an item to another page
  await closeAll(page);
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.resizeBag(s, 4); s.inv[2] = { id: 'carrot', n: 3 }; s.sel = 2; Farm.ui.openInventory(); });
  assert.match(await modalText(page), /Bag {2}1\/2/);
  await tapButton(page, 'Move');
  await tapButton(page, '>');
  assert.match(await modalText(page), /Bag {2}2\/2/);
  assert.strictEqual(await page.evaluate(() => Farm.ui.invPage()), 1);
  await tapSlotOnPage(page, 5); // the 6th slot of page 2 = slot 35
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.inv[35]), { id: 'carrot', n: 3 });
  assert.strictEqual(await page.evaluate(() => Farm.session.state.inv[2]), null);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Leave game shows only when the app offers gameHost.exit, and saves before leaving', async () => {
  const { page, problems, context } = await open(await makeSave());
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'a saved farm opens with nothing in the way');
  const labels = () => page.evaluate(() => {
    const out = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
    return out;
  });
  await page.evaluate(() => window.__gameBack());
  assert.ok(!(await labels()).includes('Leave game'), 'no Leave button without the app');
  await page.evaluate(() => window.__gameBack()); // closes the pause menu

  await page.evaluate(() => { window.__left = 0; window.gameHost.exit = () => { window.__left++; }; });
  await page.evaluate(() => window.__gameBack());
  await shot(page, '14-pause-leave');
  const before = await page.evaluate(() => window.gameHost.saves.length);
  await tapButton(page, 'Leave game');
  assert.strictEqual(await page.evaluate(() => window.__left), 1);
  assert.ok((await page.evaluate(() => window.gameHost.saves.length)) > before, 'saved before leaving');
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'the pause menu closed');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('New game in the pause menu replaces a progressed farm with a fresh one', async () => {
  const progressed = await makeSave(`
    s.start = s.day - 8;
    s.gold = 4321;
    L.till(s, 300);
    L.plant(s, 300, s.inv.findIndex((x) => x && x.id === 'seed_turnip'));
    L.buyAnimal(s, 'cow');
  `);
  const { page, problems, context } = await open(progressed);
  let s = await state(page);
  const today = s.day;
  assert.strictEqual(s.start, today - 8);
  assert.strictEqual(s.animals.length, 2);

  // Back opens the pause menu; "No" keeps the farm
  await page.evaluate(() => window.__gameBack());
  await shot(page, '14-pause-newgame');
  await tapButton(page, 'New game');
  await tapButton(page, 'No');
  assert.strictEqual((await state(page)).start, today - 8, 'No keeps the farm');

  // "Yes" starts over
  await tapButton(page, 'New game');
  await tapButton(page, 'Yes');
  await page.waitForFunction((d) => Farm.ui && Farm.ui.refresh && Farm.world && Farm.world.herd && Farm.session.state.start === d, today, SLOW);
  await frames(page, 5);
  s = await state(page);
  assert.strictEqual(s.day, today);
  assert.strictEqual(s.gold, 300);
  assert.deepStrictEqual(s.soil, {});
  assert.ok(Object.keys(s.debris).length > 60, 'the new farm is overgrown again');
  assert.deepStrictEqual(s.animals.map((a) => a.name), ['Clucky']);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members.length), 1);
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.crops).length), 0);
  const last = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.strictEqual(last.s0, today, 'the new farm is saved straight away');
  assert.strictEqual(last.g, 300);

  // the boy-or-girl choice and the welcome message show, the HUD is live, and the farm is playable
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  await tapButton(page, 'Boy');
  await page.waitForSelector('#farm-ask input', SLOW); // name your farmer (27 Oct)
  await page.click('#farm-ask button:first-child'); // Cancel: still "Farmer", and on to the welcome
  await page.waitForSelector('#farm-ask', { state: 'detached' });
  assert.strictEqual(await page.evaluate(() => Farm.world.player.texture.key), 'player');
  await page.evaluate(() => window.__gameBack());
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Apr 1');
  await page.evaluate(() => { delete Farm.session.state.debris[12 * 64 + 5]; Farm.world.refreshDebris(); });
  await teleport(page, 5, 11, 'down');
  await tapHotbar(page, 0);
  await tapAction(page);
  assert.ok((await state(page)).soil[12 * 64 + 5], 'can till on the new farm');
  assert.strictEqual(await page.evaluate(() => Farm.ui.goldText.text), '300'); // the coin says it is gold
  assert.deepStrictEqual(problems, []);
  await context.close();

  // and the new farm is what loads next time
  const again = await open(last);
  assert.strictEqual((await state(again.page)).start, today);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

// The gid drawn at a map tile, and the seasons tileset's first gid, to check which season's art is showing.
const tileGid = (page, layer, x, y) => page.evaluate(([l, x, y]) => Farm.world.layers[l].getTileAt(x, y).index, [layer, x, y]);

test('seasons follow the months: summer on June 1st, winter on December 1st; the shop and the farm change', async () => {
  const MAY31 = [2026, 5, 31, 22, 0];
  const save = await makeSave(`
    L.till(s, 12 * 64 + 5);
    L.addItem(s, 'seed_onion', 1);
    L.plant(s, 12 * 64 + 5, s.inv.findIndex((x) => x && x.id === 'seed_onion'));
  `, MAY31);
  const { page, problems, context } = await open(save, MAY31);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'May 31');
  const springGrass = await tileGid(page, 'Ground', 2, 3);
  const seasonsFirst = await page.evaluate(() => Farm.world.map.getTileset('seasons').firstgid);
  assert.ok(springGrass >= seasonsFirst && springGrass < seasonsFirst + 12, 'spring art from the seasons tileset');

  // summer seeds can't be planted yet
  await page.evaluate(() => {
    Farm.Logic.addItem(Farm.session.state, 'seed_tomato', 1);
    Farm.Logic.till(Farm.session.state, 12 * 64 + 6);
    Farm.world.refreshAllSoil();
  });
  await hold(page, 'seed_tomato');
  await teleport(page, 6, 11, 'down');
  await tapAction(page);
  assert.strictEqual((await state(page)).soil[12 * 64 + 6].c, null, 'tomato refused in spring');

  const report = await nextMorning(page);
  assert.match(report, /Summer has arrived/);
  let s = await state(page);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Jun 1');
  assert.strictEqual(s.soil[12 * 64 + 5].c, 'onion', 'the spring onion grows on');
  const summerGrass = await tileGid(page, 'Ground', 2, 3);
  assert.strictEqual(summerGrass, springGrass + 12, 'grass switched to the summer art');
  await teleport(page, 6, 9, 'down');
  await shot(page, '16-summer');

  // now the tomato goes in
  await hold(page, 'seed_tomato');
  await teleport(page, 6, 11, 'down');
  await tapAction(page);
  assert.strictEqual((await state(page)).soil[12 * 64 + 6].c, 'tomato');

  // the shop's seeds tab follows the season
  await setClock(page, [2026, 6, 1, 10, 0]);
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  let names = await modalText(page);
  assert.ok(names.includes('Okra Seeds') && names.includes('Chili Pepper Seeds'), names);
  assert.ok(!names.includes('Turnip Seeds'));
  await page.evaluate(() => window.__gameBack());

  // the last evening of fall, then winter
  await page.evaluate(() => {
    window.__now = new Date(2026, 10, 30, 22, 0).getTime();
    Farm.session.state.day = Farm.Logic.dayOf(window.__now);
  });
  await nextMorning(page);
  s = await state(page);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Dec 1');
  assert.strictEqual(await tileGid(page, 'Ground', 2, 3), springGrass + 36, 'snow');
  assert.ok(await page.evaluate(() => Farm.ui.weather && Farm.ui.weather.getAliveParticleCount() > 0), 'snow is falling');
  // trees still block the way in winter (collision follows the swapped tiles)
  assert.strictEqual(await page.evaluate(() => Farm.world.layers.Walls.getTileAt(0, 3).collides), true);
  await teleport(page, 6, 9, 'down');
  await shot(page, '17-winter');
  await setClock(page, [2026, 12, 1, 10, 0]);
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  names = await modalText(page);
  assert.ok(names.includes('Kale Seeds'), 'winter has its own crops: ' + names);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('upgraded tools charge: hold the button to till a 3x3 patch; rain waters the field', async () => {
  const { page, problems, context, cdp } = await open(await makeSave('s.tools.hoe = 2;'));
  await teleport(page, 5, 11, 'down');
  await tapHotbar(page, 0);
  assert.strictEqual(await actionLabel(page), 'Till');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ACTION_BTN.x, y: ACTION_BTN.y, id: 7 }] });
  await page.waitForFunction(() => Farm.world.charge && Farm.world.charge.level === 2, null, SLOW);
  assert.match(await page.evaluate(() => Farm.ui.chargeText.text), /3 x 3/);
  await shot(page, '18-charging');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => !Farm.world.charge, null, SLOW);
  await frames(page);
  let s = await state(page);
  let tilled = 0;
  for (let y = 12; y <= 14; y++) for (let x = 4; x <= 6; x++) if (s.soil[y * W + x]) tilled++;
  assert.strictEqual(tilled, 9, 'a silver hoe tills 3x3 in one swing');
  assert.strictEqual(s.energy, 100 - Math.round(2 * 0.65 * 9));
  assert.strictEqual(await page.evaluate(() => Farm.Logic.iconOf(Farm.session.state, 'hoe')), await page.evaluate(() => Farm.Config.ICON.hoe_2));

  // tomorrow it rains: the forecast says so, the crops get watered, and rain falls on the farm
  await page.evaluate(() => { Farm.Logic.weather = (s, day) => (day === s.day + 1 || day > 1 ? 'rain' : 'sunny'); });
  const report = await nextMorning(page);
  assert.match(report, /Rain/);
  s = await state(page);
  assert.strictEqual(s.soil[12 * W + 5].w, 1, 'rain watered the soil');
  assert.strictEqual(await page.evaluate(() => Farm.ui.weatherText.text), 'Rain');
  assert.ok(await page.evaluate(() => Farm.ui.weather && Farm.ui.weather.getAliveParticleCount() > 20), 'rain is falling');
  await shot(page, '19-rain');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('fishing at the pond and foraging', async () => {
  const { page, problems, context } = await open(await makeSave("L.addItem(s, 'rod', 1);"));
  await page.evaluate(() => { Farm.Config.FISH_WINDOW = 1e9; }); // headless frames are slow: don't let it get away
  await hold(page, 'rod');
  await teleport(page, 14, 4, 'right'); // the pond is to the east
  assert.strictEqual(await actionLabel(page), 'Fish');
  await tapAction(page);
  assert.ok(await page.evaluate(() => Farm.world.fishing && Farm.world.fishing.state === 'wait'));
  await page.evaluate(() => { Farm.world.fishing.biteAt = 0; });
  await page.waitForFunction(() => Farm.world.fishing && Farm.world.fishing.state === 'bite', null, SLOW);
  assert.strictEqual(await actionLabel(page), 'Reel!');
  await shot(page, '20-bite');
  // the green bar covers the whole track and fills fast, so slow headless frames still land the fish
  await page.evaluate(() => {
    const G = Farm.Config.FISH_GAME;
    ['fish_s', 'fish_m', 'fish_l', 'fish_k'].forEach((k) => { G[k].zone = 1; });
  });
  await tapAction(page);
  // hooked: the reel-in mini-game. Hold the screen to lift the green bar over the fish.
  await page.waitForFunction(() => Farm.ui.game2, null, SLOW);
  await shot(page, '20b-reel');
  await page.evaluate(() => { Farm.Config.FISH_GAME.fill = 50; Farm.Config.FISH_GAME.drain = 0; });
  await page.waitForFunction(() => !Farm.ui.game2 && !Farm.world.fishing, null, SLOW);
  let s = await state(page);
  assert.strictEqual(['fish_s', 'fish_m', 'fish_l'].reduce((n, id) => n + count(s, id), 0), 1, 'caught a fish');
  assert.strictEqual(s.energy, 100 - 2);
  // weighed (the Fishing Derby, 01-logicM.js), and kept as the biggest of its kind
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /^You caught a (giant )?(Small|Medium|Large) Fish, \d+(\.\d)? kg!$/);
  assert.strictEqual(Object.keys(s.fb).length, 1);

  // forage: pick one of today's herbs
  const spot = await page.evaluate(() => Number(Object.keys(Farm.world.forage)[0]));
  assert.ok(spot > 0, 'there is forage on the farm');
  await teleport(page, spot % W, Math.floor(spot / W) - 1, 'down');
  assert.strictEqual(await actionLabel(page), 'Pick');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(count(s, 'herb'), 1);
  assert.deepStrictEqual(s.forage.farm.taken, [spot]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('town: walk down the road, talk, gift, the forge, the woodshop, the inn, and the mine', async () => {
  const save = await makeSave(`
    s.time = 600;
    s.gold = 2000;
    L.addItem(s, 'ore_copper', 5);
    L.addItem(s, 'turnip', 2);
  `);
  const { page, problems, context } = await open(save);

  // walk off the south edge of the farm into town
  await teleport(page, 11, 36, 'down');
  await page.evaluate(() => { Farm.input.jy = 1; });
  await waitMap(page, 'town');
  await page.evaluate(() => { Farm.input.jy = 0; });
  await shot(page, '21-town');

  // Mayor Hollis is in the plaza at 10 AM
  await teleport(page, 14, 18, 'down');
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  assert.match(await modalText(page), /Mayor Hollis/);
  await shot(page, '22-talk');
  await tapButton(page, 'OK');
  await hold(page, 'turnip');
  assert.strictEqual(await actionLabel(page), 'Gift');
  await tapAction(page);
  await tapButton(page, 'OK');
  let s = await state(page);
  assert.strictEqual(s.friends.hollis.pts, 3 + 3, 'a chat and a (neutral) gift');
  assert.strictEqual(count(s, 'turnip'), 1);

  // the forge upgrades the hoe with gold and copper ore
  await teleport(page, 4, 19, 'up');
  assert.strictEqual(await actionLabel(page), 'Enter');
  await tapAction(page);
  await shot(page, '23-forge');
  await tapButton(page, 'Upgrade', 0);
  s = await state(page);
  assert.strictEqual(s.tools.hoe, 1);
  assert.strictEqual(s.gold, 1000);
  assert.strictEqual(count(s, 'ore_copper'), 0);
  await page.evaluate(() => window.__gameBack());

  // the woodshop sells lumber, and builds things overnight
  await teleport(page, 25, 19, 'up');
  await tapAction(page);
  await tapButton(page, 'Materials');
  await tapButton(page, 'Buy 10 500G');
  assert.strictEqual((await state(page)).lumber, 10);
  await tapButton(page, 'Build');
  await tapButton(page, 'Build', 0); // the kitchen: 2500G + 40 lumber
  assert.strictEqual((await state(page)).project, null, 'not enough gold and lumber yet');
  await page.evaluate(() => window.__gameBack());

  // the inn serves a meal
  await page.evaluate(() => { Farm.session.state.energy = 40; });
  await teleport(page, 24, 8, 'up');
  await tapAction(page);
  await tapButton(page, 'Eat 150G');
  s = await state(page);
  assert.strictEqual(s.energy, 80);
  assert.strictEqual(s.gold, 500 - 150);
  await page.evaluate(() => window.__gameBack());

  // the mine: break the rock hiding the ladder and go down
  await teleport(page, 27, 11, 'up');
  assert.strictEqual(await actionLabel(page), 'Enter');
  await tapAction(page);
  await waitMap(page, 'mine');
  await shot(page, '24-mine');
  const rock = await page.evaluate(() => {
    const w = Farm.world, row = w.mine.rocks.filter((i) => Math.floor(i / w.map.width) === 4);
    w.mine.stairs = row[0];
    return row[0];
  });
  await teleport(page, rock % 14, 3, 'down');
  await tapHotbar(page, 5); // hammer
  assert.strictEqual(await actionLabel(page), 'Smash');
  await tapAction(page);
  assert.strictEqual(await actionLabel(page), 'Go down');
  await tapAction(page);
  await waitMap(page, 'mine');
  assert.strictEqual(await page.evaluate(() => Farm.session.mineFloor), 2);

  // climb out at the ladder and land at the mine entrance
  await teleport(page, 6, 3, 'up');
  assert.strictEqual(await actionLabel(page), 'Climb out');
  await tapAction(page);
  await waitMap(page, 'town');
  s = await state(page);
  assert.ok(Math.abs(s.player.x / 256 - 28) < 1 && Math.abs(s.player.y / 256 - 11.6) < 1, 'at the mine entrance');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('home life: kitchen, TV, the Flower Festival, a proposal and a wedding', async () => {
  const APR14 = [2026, 4, 14, 10, 0]; // the Flower Festival
  const save = await makeSave(`
    s.map = 'house';
    s.builds.kitchen = 1;
    s.builds.bighouse = 1;
    s.home.items.push({ t: C.HOME.typeIndex.kitchen, v: 0, x: 1, y: 7, f: 0 });
    L.friend(s, 'lily').pts = 75;
    L.friend(s, 'lily').met = 1;
    L.addItem(s, 'egg', 1);
    L.addItem(s, 'blue_feather', 1);
  `, APR14);
  const { page, problems, context } = await open(save, APR14);
  await waitMap(page, 'house');
  await shot(page, '25-house');

  // cook a boiled egg in the kitchen
  await teleport(page, 2, 6, 'down');
  assert.strictEqual(await actionLabel(page), 'Cook');
  await tapAction(page);
  await shot(page, '26-kitchen');
  await tapButton(page, 'Cook', 0);
  let s = await state(page);
  assert.strictEqual(count(s, 'boiled_egg'), 1);
  assert.strictEqual(count(s, 'egg'), 0);
  await page.evaluate(() => window.__gameBack());

  // the TV has the forecast
  await teleport(page, 4, 3, 'up');
  assert.strictEqual(await actionLabel(page), 'Watch');
  await tapAction(page);
  assert.match(await modalText(page), /WEATHER REPORT/);
  await tapButton(page, 'OK');

  // the festival in the plaza: talk to the mayor and dance with Lily
  await go(page, 'town', 'from_farm');
  await page.waitForFunction(() => Farm.world.villagers.list.every((v) => !v.path.length), null, SLOW);
  await teleport(page, 14, 18, 'down');
  assert.strictEqual(await actionLabel(page), 'Festival');
  await tapAction(page);
  await shot(page, '27-festival');
  await page.evaluate(() => { Farm.Config.DANCE.bpm = 900; }); // a quick dance (no taps: every beat is missed)
  await tapButton(page, 'Dance');
  await page.waitForFunction(() => Farm.ui.game2, null, SLOW);
  await shot(page, '27b-dance');
  await page.waitForFunction(() => !Farm.ui.game2 && /dance with Lily/.test(Farm.ui.modals.length ? '' + Farm.ui.modals[Farm.ui.modals.length - 1].c.list.filter((o) => o.type === 'Text').map((o) => o.text) : ''), null, SLOW);
  assert.match(await modalText(page), /toes/);
  await tapButton(page, 'OK');
  s = await state(page);
  assert.strictEqual(s.fest.flower, 2026, 'joined this year');
  assert.strictEqual(s.friends.lily.pts, 85);

  // propose to Lily with the Blue Feather
  await hold(page, 'blue_feather');
  await teleport(page, 11, 18, 'down');
  assert.strictEqual(await actionLabel(page), 'Propose');
  await tapAction(page);
  assert.match(await modalText(page), /Yes!/);
  await tapButton(page, 'OK');
  s = await state(page);
  assert.deepStrictEqual(s.engaged, { who: 'lily', day: s.day + 3 });

  // the wedding is three days later; then she lives at the farmhouse
  await nextMorning(page);
  await nextMorning(page);
  const report = await nextMorning(page);
  assert.match(report, /married Lily/);
  s = await state(page);
  assert.strictEqual(s.spouse, 'lily');
  await go(page, 'house', 'bed');
  assert.ok(await page.evaluate(() => Farm.world.villagers.list.some((v) => v.key === 'lily' && v.visible)), 'Lily is at home in the morning');
  await shot(page, '28-married');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('new things: mail, a heart event, the horse and saddlebag, the cat, furniture, a mine chest, the collection', async () => {
  const save = await makeSave(`
    s.start = s.day - 1;
    s.gold = 5000;
    s.mail = ['welcome'];
    s.builds.stable = 1;
    s.horse = { name: 'Chestnut', love: 0, pet: 0 };
    L.friend(s, 'leo').pts = 25;
    L.friend(s, 'leo').met = 1;
    L.addItem(s, 'turnip', 2);
  `);
  const { page, problems, context } = await open(save);

  // the welcome letter waits in the mailbox, with a gift
  assert.ok(await page.evaluate(() => Farm.world.mailFlag.visible), 'the mailbox shows a letter');
  await teleport(page, 9, 7, 'up');
  assert.strictEqual(await actionLabel(page), 'Read');
  await tapAction(page);
  assert.match(await modalText(page), /LETTER FROM MAYOR HOLLIS/);
  await shot(page, '29-letter');
  await tapButton(page, 'OK');
  let s = await state(page);
  assert.strictEqual(count(s, 'sandwich'), 1);
  assert.deepStrictEqual(s.mail, []);

  // the horse waits by the stable: ride it, open the market stall from the saddlebag, and get off
  const horse = await page.evaluate(() => [Farm.world.horse.x / 256, Farm.world.horse.y / 256]);
  await teleport(page, Math.floor(horse[0]), Math.floor(horse[1]) - 1, 'down');
  assert.strictEqual(await actionLabel(page), 'Ride');
  await tapAction(page);
  assert.strictEqual(await page.evaluate(() => Farm.session.riding), true);
  assert.strictEqual((await state(page)).horse.pet, 1, 'riding counts as a pat');
  await page.evaluate(() => { Farm.input.jx = 1; });
  await page.waitForTimeout(300);
  await shot(page, '30-riding');
  await page.evaluate(() => { Farm.input.jx = 0; });
  await hold(page, 'turnip');
  assert.strictEqual(await actionLabel(page), 'Sell');
  await tapAction(page);
  assert.match(await modalText(page), /Market Stall/, 'the stall opens from the saddlebag');
  await page.evaluate(() => Farm.ui.closeAll());
  await hold(page, 'hoe');
  assert.strictEqual(await actionLabel(page), 'Get off');
  await tapAction(page);
  assert.strictEqual(await page.evaluate(() => Farm.session.riding), false);

  // a heart event with Leo (2 hearts) when you first talk to him today
  await go(page, 'town', 'from_farm');
  await page.evaluate(() => {
    const v = Farm.world.villagers.list.find((x) => x.key === 'leo');
    Farm.world.villagers.put(v, 14.5 * 256, 19.6 * 256, true);
    v.place = Farm.Logic.villagerAt(Farm.session.state, 'leo', Farm.session.state.time);
    v.hold = 1e9;
  });
  await teleport(page, 14, 18, 'down');
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  assert.match(await modalText(page), /King Trout/);
  await tapButton(page, 'Next');
  await tapButton(page, 'Next');
  await shot(page, '31-heart-choice');
  await tapButton(page, "Let's catch him together.");
  assert.match(await modalText(page), /partner/);
  await tapButton(page, 'OK');
  s = await state(page);
  assert.strictEqual(s.friends.leo.pts, 31);
  assert.strictEqual(s.friends.leo.ev, 1);

  // furniture from Mira: the cat basket brings a cat
  await teleport(page, 25, 19, 'up');
  await tapAction(page);
  await tapButton(page, 'Furniture');
  await tapButton(page, 'See all'); // the Classic style
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openCatalog(0, 6); }); // its last page: the cat basket
  await tapButton(page, 'Buy 600G');
  s = await state(page);
  assert.strictEqual(s.cat.name, 'Mochi');
  await page.evaluate(() => window.__gameBack());

  // a treasure chest on floor 5 of the mine
  await go(page, 'mine', 'entrance');
  await page.evaluate(() => Farm.world.travel('mine', 'entrance', 5));
  await page.waitForFunction(() => Farm.session.mineFloor === 5 && Farm.world.mapKey === 'mine' && !Farm.world.busy && Farm.world.chest, null, SLOW);
  await teleport(page, 8, 3, 'right');
  assert.strictEqual(await actionLabel(page), 'Open');
  await tapAction(page);
  assert.match(await modalText(page), /TREASURE/);
  await tapButton(page, 'OK');
  s = await state(page);
  assert.strictEqual(count(s, 'ore_copper'), 3);
  assert.strictEqual(s.stats.deepest, 5);

  // home: pet the cat
  await go(page, 'house', 'door');
  await page.evaluate(() => {
    const c = Farm.world.cat;
    c.x = c.tx = 4.5 * 256;
    c.y = c.ty = 4.9 * 256;
    c.wait = 1e9;
  });
  await teleport(page, 4, 3, 'down');
  assert.strictEqual(await actionLabel(page), 'Pet');
  await tapAction(page);
  assert.strictEqual((await state(page)).cat.pet, 1);
  await shot(page, '32-cat');

  // the collection book in the pause menu
  await page.evaluate(() => window.__gameBack());
  await tapButton(page, 'Collection');
  assert.match(await modalText(page), /RECORDS   Earned 0G   Fish 0.*Deepest mine floor 5/s);
  await shot(page, '33-collection');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('home: decorate, buy furniture, upgrade the house', async () => {
  const save = await makeSave(`
    s.time = 600;
    s.map = 'house';
    s.gold = 40000;
    s.lumber = 200;
    s.stone = 100;
  `);
  const { page, problems, context, cdp } = await open(save);
  await waitMap(page, 'house');
  assert.strictEqual(await page.evaluate(() => Farm.world.map.width), 8, 'a Cozy Cabin to start');

  // Decorate: drag the table three tiles to the right
  await page.touchscreen.tap(330, 258);
  await page.waitForFunction(() => Farm.world.decor && Farm.ui.decorBar, null, SLOW);
  const at = await page.evaluate(() => {
    const w = Farm.world, cam = w.cameras.main, T = 256, s = w.state;
    const i = s.home.items.findIndex((it) => it.t === Farm.Config.HOME.typeIndex.table);
    const it = s.home.items[i];
    const screen = (x, y) => ({ x: (x - cam.worldView.x) * cam.zoom / Farm.R, y: (y - cam.worldView.y) * cam.zoom / Farm.R });
    return { i, from: screen((it.x + 1) * T, (it.y + 1.5) * T), to: screen((it.x + 3) * T, (it.y + 1.5) * T), x: it.x };
  });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', at.from.x, at.from.y);
  await frames(page);
  for (let k = 1; k <= 6; k++) {
    await touch('touchMove', at.from.x + (at.to.x - at.from.x) * k / 6, at.from.y);
    await frames(page, 2);
  }
  await touch('touchEnd');
  await frames(page);
  await shot(page, '34-decorate');
  let s = await state(page);
  assert.strictEqual(s.home.items[at.i].x, at.x + 2, 'the table moved');
  await page.touchscreen.tap(312, 598); // Done
  await page.waitForFunction(() => !Farm.world.decor && !Farm.world.busy, null, SLOW);

  // Mira: start the Cottage and buy a Modern sofa
  await page.evaluate(() => Farm.ui.openWoodshop('build'));
  await tapButton(page, 'Build', 1); // (0 is the tab) the house is the first row
  await page.evaluate(() => Farm.ui.closeAll());
  s = await state(page);
  assert.deepStrictEqual(s.project && s.project.id, 'house');
  const price = await page.evaluate(() => { Farm.ui.openCatalog(3, 1); return Farm.Logic.furnPrice(4, 3); });
  await tapButton(page, 'Buy ' + price + 'G');
  await page.evaluate(() => Farm.ui.closeAll());
  s = await state(page);
  assert.strictEqual(s.home.bag['4.3'], 1);

  // a night later the house is bigger, and the sofa goes in from storage
  await nextMorning(page);
  s = await state(page);
  assert.strictEqual(s.home.level, 2);
  assert.strictEqual(await page.evaluate(() => Farm.world.map.width), 10);
  await page.evaluate(() => Farm.world.startDecor());
  await page.waitForFunction(() => Farm.ui.decorBar, null, SLOW);
  await page.touchscreen.tap(50, 598); // Storage
  await tapButton(page, 'Place');
  s = await state(page);
  assert.ok(s.home.items.some((it) => it.t === 4 && it.v === 3), 'the sofa is in the room');
  assert.ok(!s.home.bag['4.3']);
  await shot(page, '35-sofa');
  await page.evaluate(() => Farm.world.endDecor());

  // the bigger house on the farm
  await go(page, 'farm', 'house_door');
  assert.ok(await page.evaluate(() => !!Farm.world.houseImg));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Sends anyone standing near a tile on their way (hidden until their next walk), so a door can be used.
const clearAround = (page, tx, ty) => page.evaluate(([tx, ty]) => {
  const T = 256, vs = Farm.world.villagers;
  vs.list.forEach((v) => { if (v.visible && Math.hypot(v.x - (tx + 0.5) * T, v.y - (ty + 0.5) * T) < 2.5 * T) { v.errand = null; vs.put(v, v.x, v.y, false); v.hideAtEnd = false; } });
}, [tx, ty]);

test('the Tannery: bought and placed, hides go in, leather comes out; a Gold tool and a big bag ask for what you hunt (owner, 30 Oct)', async () => {
  const save = await makeSave(`s.time = 600; s.gold = 60000;
    const ix = C.OUTDOOR.index, farm = Farm.farm();
    L.buyYard(s, ix.tannery, 1); L.placeYard(s, farm, ix.tannery, 25, 14);
    L.addItem(s, 'fur_rabbit', 3); L.addItem(s, 'pelt_wolf', 1); L.addItem(s, 'hide_rhino', 1);`);
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await teleport(page, 25, 17, 'up');
  assert.strictEqual(await actionLabel(page), 'Open');
  await tapAction(page);
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /Tannery \|[\s\S]*Soft Leather[\s\S]*Thick Leather[\s\S]*Tough Leather/);
  await shot(page, 'tannery-1-panel');
  await tapButton(page, 'Make');
  assert.match(await modalText(page), /Soft Leather: 45 min/);
  let s = await state(page);
  assert.strictEqual(count(s, 'fur_rabbit'), 0, 'three furs went in');
  await closeAll(page);
  await advance(page, 46);
  await page.evaluate(() => Farm.world.farm2Bubbles());
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.bubbles2).length), 1, 'a bubble over the Tannery');
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(count(s, 'leather_soft'), 1);
  // Bram says what a Gold tool wants, and asks for it
  await page.evaluate(() => { const s = Farm.session.state; s.tools.hoe = 2; Farm.Logic.addItem(s, 'ore_gold', 5); Farm.ui.openForge(); });
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /5 Gold Ore \| 2 Boar Tusk/); // (its own chip since 5 Nov 2026)
  await tapButton(page, 'Upgrade');
  await page.waitForFunction(() => /You need 2 Boar Tusk/.test(Farm.ui.toastText.text), null, SLOW);
  assert.strictEqual((await state(page)).tools.hoe, 2);
  await closeAll(page);
  // Lily says what a big bag wants
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.resizeBag(s, 7); s.gold = 1e6; Farm.ui.openShop('supplies'); });
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /Also needs: \| 5 Soft Leather/); // (its own chip since 5 Nov 2026)
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the bigger town: new villagers and visitors, the bakery, the chapel, the school, and an animal treat', async () => {
  const save = await makeSave(`
    s.time = 600; // 10 AM on a weekday
    s.gold = 5000;
    s.energy = 60;
    L.addItem(s, 'treat', 1);
  `);
  const { page, problems, context } = await open(save);

  // an animal treat for Clucky on the farm
  await hold(page, 'treat');
  await meetAnimal(page, 0, 5, 33);
  assert.strictEqual(await actionLabel(page), 'Treat');
  const love = (await state(page)).animals[0].love;
  await tapAction(page);
  let s = await state(page);
  assert.strictEqual(s.animals[0].love, love + 12);
  assert.strictEqual(count(s, 'treat'), 0);

  // the town is bigger, with the new villagers out and visitors about
  await go(page, 'town', 'from_farm');
  const town = await page.evaluate(() => ({
    w: Farm.world.map.width, h: Farm.world.map.height,
    people: Farm.world.villagers.list.filter((v) => !v.shopper && !v.tourist).length, // (tourist: off the train, 19zz-town.js)
    visitors: Farm.world.villagers.list.filter((v) => v.shopper && v.visible).length,
  }));
  assert.deepStrictEqual([town.w, town.h, town.people], [54, 52, 23]);
  assert.ok(town.visitors >= 1, 'visitors are in town');
  await shot(page, '36-town');

  // breakfast at Hana's bakery: walk up to the door and eat a loaf
  await clearAround(page, 32, 11);
  await teleport(page, 32, 11, 'up');
  assert.strictEqual(await actionLabel(page), 'Enter');
  await tapAction(page);
  assert.match(await modalText(page), /Hana's Bakery/);
  await tapButton(page, 'Eat 60G');
  s = await state(page);
  assert.strictEqual(s.energy, 85);
  assert.strictEqual(s.gold, 4940);
  await shot(page, '37-bakery');
  await page.evaluate(() => Farm.ui.closeAll());

  // help at school (over the bridge), then rest in the chapel
  await clearAround(page, 11, 47);
  await teleport(page, 11, 47, 'up');
  assert.strictEqual(await actionLabel(page), 'Enter');
  await tapAction(page);
  await tapButton(page, 'Help');
  s = await state(page);
  ['clara', 'pip', 'daisy'].forEach((k) => assert.strictEqual(s.friends[k].pts, 4, k));
  await page.evaluate(() => Farm.ui.closeAll());
  await clearAround(page, 4, 47);
  await teleport(page, 4, 47, 'up');
  await tapAction(page);
  await tapButton(page, 'Rest');
  s = await state(page);
  assert.strictEqual(s.energy, 100);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the yard never boxes you in: a piece that would is refused, and a farmer already stuck hops out (owner, 29 Oct)', async () => {
  const save = await makeSave('s.time = 600; s.gold = 20000;');
  const { page, problems, context } = await open(save);
  await teleport(page, 26, 14, 'down'); // in the meadow
  const ring = [[25, 13], [26, 13], [27, 13], [25, 14], [27, 14], [25, 15], [26, 15], [27, 15]];
  // seven fences around the farmer; the eighth would shut them in
  const why = await page.evaluate((ring) => {
    const s = Farm.session.state, fence = 0;
    ring.slice(0, 7).forEach(([x, y]) => s.yard.items.push({ t: fence, x, y }));
    Farm.world.renderYard();
    return Farm.world.yardWhy(fence, ring[7][0], ring[7][1], null);
  }, ring);
  assert.strictEqual(why, 'trap');
  // an older version let it happen: the farmer hops out to the nearest open tile
  await page.evaluate((ring) => { Farm.session.state.yard.items.push({ t: 0, x: ring[7][0], y: ring[7][1] }); Farm.world.renderYard(); }, ring);
  await page.waitForFunction(() => /boxed in/.test(Farm.ui.toastText.text), null, SLOW);
  const at = await page.evaluate(() => { const f = Farm.world.feet(), T = Farm.Config.TILE; return [Math.floor(f.x / T), Math.floor(f.y / T)]; });
  assert.notDeepStrictEqual(at, [26, 14], 'out of the ring');
  assert.ok(!(at[0] >= 25 && at[0] <= 27 && at[1] >= 13 && at[1] <= 15), 'not on a fence either: ' + at);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the yard: place fences by tapping, move a bench, buy garden pieces at Mira\'s', async () => {
  const save = await makeSave('s.time = 600; s.gold = 20000;');
  const { page, problems, context, cdp } = await open(save);
  await teleport(page, 26, 14, 'down'); // in the meadow
  const toScreen = (x, y) => page.evaluate(([x, y]) => {
    const cam = Farm.world.cameras.main, T = 256;
    return { x: ((x + 0.5) * T - cam.worldView.x) * cam.zoom / Farm.R, y: ((y + 0.5) * T - cam.worldView.y) * cam.zoom / Farm.R };
  }, [x, y]);
  await page.touchscreen.tap(330, 258); // Decorate
  await page.waitForFunction(() => Farm.world.yd && Farm.ui.decorBar, null, SLOW);

  // three wooden fences in a row, a tap each
  await page.touchscreen.tap(90, 598); // Storage
  await tapButton(page, 'Place'); // the first row: Wooden Fence
  for (const x of [24, 25, 26]) {
    const p = await toScreen(x, 11);
    await page.touchscreen.tap(p.x, p.y);
    await frames(page, 2);
  }
  let s = await state(page);
  assert.deepStrictEqual(s.yard.items.slice(60).map((it) => [it.x, it.y]), [[24, 11], [25, 11], [26, 11]], 'after the 60 pieces of the field fence');
  assert.deepStrictEqual(await page.evaluate(() => [60, 61, 62].map((i) => Farm.Logic.fenceShape(Farm.session.state, i))), ['h', 'h', 'h']);
  assert.strictEqual(s.yard.bag[0], 5, 'three of the eight starter fences used');
  await page.touchscreen.tap(180, 534); // Done placing

  // the bench goes in, then gets dragged two tiles right
  await page.touchscreen.tap(90, 598);
  await tapButton(page, 'Place', 2); // Wooden Fence, Flower Bed, Bench
  s = await state(page);
  const bench = s.yard.items[63];
  const IX = await page.evaluate(() => Farm.Config.OUTDOOR.index);
  assert.strictEqual(bench.t, IX.bench);
  const from = await toScreen(bench.x, bench.y), to = await toScreen(bench.x + 2, bench.y);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', from.x, from.y);
  await frames(page);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', from.x + (to.x - from.x) * k / 6, from.y); await frames(page, 2); }
  await touch('touchEnd');
  await frames(page);
  s = await state(page);
  assert.strictEqual(s.yard.items[63].x, bench.x + 2, 'the bench moved');
  await shot(page, '38-yard');
  await page.touchscreen.tap(270, 598); // Done
  await page.waitForFunction(() => !Farm.world.yd && !Farm.world.busy, null, SLOW);
  assert.ok(await page.evaluate(() => Farm.world.blocked[Farm.world.idx(25, 11)]), 'fences are solid');

  // Mira's Outdoor tab: a flower bed from the Garden page
  await page.evaluate(() => Farm.ui.openWoodshop('outdoor'));
  await tapButton(page, 'See all', 2); // Fences, Paths and hedges, Garden
  await tapButton(page, 'Buy 300G');
  s = await state(page);
  assert.strictEqual(s.yard.bag[IX.flower_bed], 2);
  assert.strictEqual(s.gold, 20000 - 300);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
test('phase 3: the daily gift, claiming a quest, a request on the board, the trader, a Power-Up', async () => {
  const TUE = [2026, 4, 7, 10, 0]; // a Tuesday: a trader day
  const save = await makeSave(`
    s.goal = 1; // past the first goal: a brand-new farmer gets the gift after it
    s.gold = 1000;
    s.energy = 30;
    L.addItem(s, 'gem', 5);
    L.addItem(s, 'power_up', 1);
  `, TUE);
  const { page, problems, context } = await open(save, TUE);
  // the daily gift pops up once the game is quiet
  await page.evaluate(() => { window.gameHost.quiet = false; });
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /DAILY GIFT/);
  await tapButton(page, 'Claim');
  let s = await state(page);
  assert.strictEqual(s.gold, 1200);
  assert.strictEqual(s.lg.streak, 1);
  await page.evaluate(() => { window.gameHost.quiet = true; });

  // 10 daily quests; finish one and claim it from the Quests button
  assert.strictEqual(s.dq.list.length, 10);
  await page.evaluate(() => { const q = Farm.session.state.dq.list[0]; q.b -= q.n; });
  await page.touchscreen.tap(330, 134); // Quests
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  await tapButton(page, 'Claim');
  s = await state(page);
  assert.strictEqual(s.dq.list[0].done, 1);
  assert.strictEqual(s.cnt.dquest, 1);
  await shot(page, '39-quests');
  await page.evaluate(() => Farm.ui.closeAll());

  // a Power-Up: full energy
  await hold(page, 'power_up');
  await teleport(page, 26, 14, 'down');
  assert.strictEqual(await actionLabel(page), 'Drink');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.energy, 100);
  assert.ok(s.pwr.until > s.time);

  // in town: a request on the notice board, then Saffron's tent
  await go(page, 'town', 'from_farm');
  const req = await page.evaluate(() => { const r = Farm.session.state.rq.list[0]; Farm.Logic.addItem(Farm.session.state, r.id, r.n); return r; });
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.noticeBoard(); });
  const g0 = (await state(page)).gold;
  await tapButton(page, 'Give');
  s = await state(page);
  assert.strictEqual(s.rq.list[0].done, 1);
  assert.strictEqual(s.gold - g0, req.gold);
  assert.strictEqual(s.rq.streak, 1);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.world.trader, null, SLOW);
  await teleport(page, 39, 18, 'up');
  assert.strictEqual(await actionLabel(page), 'Trade');
  await tapAction(page);
  await tapButton(page, 'Swap'); // the tab
  await tapButton(page, 'Swap', 1); // 5 gems for a Star
  s = await state(page);
  assert.strictEqual(s.stars, 1);
  assert.strictEqual(count(s, 'gem'), 0);
  await shot(page, '40-trader');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Pushes the farmer into every solid tile, building, prop and villager on every map from each open side, at
// walking and riding speed, with the game's own physics. Nothing solid may be walked into or through.
test('nothing solid can be walked through, on any map, on foot or on horseback', async () => {
  const save = await makeSave(`
    Object.assign(s.builds, { kitchen: 1, bighouse: 1, stable: 1, f_plant: 1, f_music: 1, f_aquarium: 1, f_cat: 1 });
    s.debris = L.makeDebris(5, Farm.fieldTiles());
    s.time = 600;
  `);
  const { page, problems, context } = await open(save);
  for (const map of ['farm', 'house', 'town', 'mine']) {
    await page.evaluate((m) => { Farm.ui.closeAll(); Farm.world.travel(m, null, 5); }, map);
    await waitMap(page, map);
    const r = await page.evaluate(() => {
      const w = Farm.world, T = 256, pw = w.physics.world, body = w.player.body, S = Farm.Config.SPEED;
      w.busy = true; // keep the scene's own update out of the way while we step the physics by hand
      if (w.villagers) w.villagers.list.forEach((v) => { v.path = []; v.hold = 1e9; });
      const villagerAt = (x, y) => w.villagers && w.villagers.list.some((v) => v.visible && Math.floor(v.x / T) === x && Math.floor(v.y / T) === y);
      const fails = [];
      let tries = 0;
      for (let y = 0; y < w.map.height; y++) for (let x = 0; x < w.map.width; x++) {
        if (w.walkable(x, y)) continue;
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
          const nx = x - dx, ny = y - dy;
          if (!w.inMap(nx, ny) || !w.walkable(nx, ny) || villagerAt(nx, ny)) return;
          [1, Farm.Config.HORSE.speed].forEach((mul) => {
            tries++;
            w.setFeet(nx * T + T / 2, ny * T + T / 2);
            for (let i = 0; i < 40; i++) { body.setVelocity(dx * S * mul, dy * S * mul); pw.singleStep(); }
            body.setVelocity(0, 0);
            const f = w.feet();
            if (Math.floor(f.x / T) !== nx || Math.floor(f.y / T) !== ny) fails.push(`(${nx},${ny}) -> (${x},${y}) x${mul}`);
          });
        });
      }
      if (w.villagers) w.villagers.list.filter((v) => v.visible).forEach((v) => {
        tries++;
        w.setFeet(v.x, v.y - 1.3 * T);
        for (let i = 0; i < 40; i++) { body.setVelocity(0, S); pw.singleStep(); }
        if (w.feet().y > v.y - 0.2 * T) fails.push('through ' + v.key);
      });
      w.busy = false;
      return { tries, fails };
    });
    assert.ok(r.tries > 50, `${map}: tested ${r.tries} pushes`);
    assert.deepStrictEqual(r.fails, [], `${map}: walked into something solid`);
  }
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('holding the watering can off the soil (grass, in town) never stops the game', async () => {
  const { page, problems, context } = await open();
  await closeAll(page);
  await hold(page, 'can');
  const frame0 = await page.evaluate(() => Farm.game.loop.frame);
  await teleport(page, 3, 3, 'down'); // grass by the house
  await frames(page, 10);
  await go(page, 'town', null);
  await hold(page, 'can');
  await frames(page, 10);
  const frame1 = await page.evaluate(() => Farm.game.loop.frame);
  assert.ok(frame1 > frame0 + 15, 'the game keeps running (' + frame0 + ' -> ' + frame1 + ')');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the growing farm: the Bakery bakes, a mango tree fruits, a field plot is tilled and planted, crop stars', async () => {
  const save = await makeSave(`s.time = 600; s.gold = 50000;
    const ix = C.OUTDOOR.index, farm = Farm.farm();
    [['bakery', 25, 14], ['mango_tree', 30, 14], ['farm_plot', 24, 20]].forEach(([k, x, y]) => { L.buyYard(s, ix[k], 1); L.placeYard(s, farm, ix[k], x, y); });
    L.addItem(s, 'wheat', 6); L.addItem(s, 'seed_wheat', 1);`);
  const { page, problems, context } = await open(save);
  await closeAll(page);

  // the Bakery: face it and tap: its panel; make bread; it's ready 30 minutes later
  await teleport(page, 25, 17, 'up');
  assert.strictEqual(await actionLabel(page), 'Open');
  await tapAction(page);
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /Bakery \|[\s\S]*Fresh Bread[\s\S]*Pandesal[\s\S]*Strawberry Cake/);
  await shot(page, 'farm2-1-bakery');
  await tapButton(page, 'Make');
  assert.match(await modalText(page), /Fresh Bread: 30 min/);
  let s = await state(page);
  assert.strictEqual(count(s, 'wheat'), 3, 'three wheat went in');
  await closeAll(page);
  await advance(page, 31);
  await page.evaluate(() => Farm.world.farm2Bubbles());
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.bubbles2).length), 1, 'a bubble over the Bakery');
  await shot(page, 'farm2-2-bread-ready');
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(count(s, 'bread'), 1);

  // the mango tree: growing its first fruit, then ripe 12 hours later (it's spring)
  await teleport(page, 30, 17, 'up');
  assert.strictEqual(await actionLabel(page), 'Growing');
  await advance(page, 12 * 60);
  await teleport(page, 30, 17, 'up');
  assert.strictEqual(await actionLabel(page), 'Pick');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(count(s, 'mango'), 3);

  // the field plot: till it with the hoe, plant wheat on it
  await hold(page, 'hoe');
  await teleport(page, 25, 23, 'up');
  assert.strictEqual(await actionLabel(page), 'Till');
  await tapAction(page);
  s = await state(page);
  assert.ok(s.soil[22 * W + 25], 'tilled soil on the plot');
  await hold(page, 'seed_wheat');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.soil[22 * W + 25].c, 'wheat');
  await teleport(page, 25, 24, 'up');
  await shot(page, 'farm2-3-plot');

  // the Collection has a Crop stars list
  await page.evaluate(() => Farm.ui.openCollection());
  await tapButton(page, 'Crop stars');
  assert.match(await modalText(page), /Crop stars/);
  await shot(page, 'farm2-4-crop-stars');
  await closeAll(page);
  // Mira's catalog: the new pages; one Bakery only; each plot dearer
  await page.evaluate(() => Farm.ui.openOutdoor(null, 1));
  assert.match(await modalText(page), /Workshops[\s\S]*Fruit trees[\s\S]*More land/);
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openOutdoor('workshops', 0));
  assert.match(await modalText(page), /Bakery[\s\S]*You have one\.[\s\S]*Dairy[\s\S]*Buy 4000G/);
  await shot(page, 'farm2-6-workshops');
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openOutdoor('land', 0));
  assert.match(await modalText(page), /Field Plot[\s\S]*Buy 3000G/);
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openOutdoor('orchard', 0));
  await shot(page, 'farm2-7-orchard');
  await closeAll(page);
  await page.evaluate(() => Farm.ui.newOnFarm());
  assert.match(await modalText(page), /NEW ON YOUR FARM/);
  await shot(page, 'farm2-5-new');
  await closeAll(page);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the gold counter comes back to your gold after a visit showed another number (28 Oct, OPPO: stuck on 300)', async () => {
  const save = await makeSave('s.gold = 1854;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  const shown = () => page.evaluate(() => Farm.ui.goldText.text);
  const settle = () => page.waitForTimeout(1500);
  // a daily gift rolls the counter up to 2,354 ...
  await page.evaluate(() => { Farm.session.state.gold = 2354; Farm.ui.refresh(); });
  await settle();
  assert.strictEqual(await shown(), '2,354');
  // ... a visit's look-only farm shows 300 while it loads ...
  await page.evaluate(() => Farm.ui.showGold(300));
  assert.strictEqual(await shown(), '300');
  // ... and home again, the counter is back on your gold
  await page.evaluate(() => Farm.ui.refresh());
  await settle();
  assert.strictEqual(await shown(), '2,354');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the watering can fills up at the pond (27 Oct: an energy refill had taken the name of the can\'s refill)', async () => {
  const save = await makeSave('s.time = 600; s.water = 0;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  // a walkable tile next to the pond, facing the water
  const spot = await page.evaluate(() => {
    const w = Farm.world, D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (let y = 1; y < w.map.height - 1; y++) for (let x = 1; x < w.map.width - 1; x++) {
      if (!w.walkable(x, y)) continue;
      for (const dir of Object.keys(D)) if (w.isWater(x + D[dir][0], y + D[dir][1])) return { x, y, dir };
    }
    return null;
  });
  assert.ok(spot, 'a spot by the pond');
  await hold(page, 'can');
  await teleport(page, spot.x, spot.y, spot.dir);
  assert.strictEqual(await actionLabel(page), 'Refill');
  assert.strictEqual((await state(page)).water, 0);
  await tapAction(page);
  const s = await state(page);
  assert.strictEqual(s.water, await page.evaluate(() => Farm.Logic.canCapacity(Farm.session.state)), 'the can is full');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('your farmer has a name: asked after picking the farmer on a new farm, renamed from the pause menu', async () => {
  const { page, problems, context } = await open(null);
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await tapButton(page, 'Girl');
  await page.waitForSelector('#farm-ask input', SLOW);
  assert.match(await page.textContent('#farm-ask'), /Name your farmer/);
  await shot(page, 'name-1-ask');
  // a rude name is refused, and asked again
  await page.fill('#farm-ask input', 'gago');
  await page.click('#farm-ask button:last-child');
  await page.waitForFunction(() => /friendly/.test(Farm.ui.toastText.text), null, SLOW);
  await page.waitForSelector('#farm-ask input', SLOW);
  await page.fill('#farm-ask input', 'Selene');
  await page.click('#farm-ask button:last-child');
  await page.waitForFunction(() => /WELCOME TO HARVEST VILLE/.test(JSON.stringify(Farm.ui.modals.map((m) => m.c.list.map((o) => o.text || '')))), null, SLOW);
  assert.strictEqual((await state(page)).name, 'Selene');
  assert.strictEqual((await state(page)).look, 'girl');
  await closeAll(page);
  // Rename from the pause menu
  await page.evaluate(() => Farm.ui.openPause());
  assert.match(await modalText(page), /Selene/); // on the farmer card (owner, 29 Oct: option E)
  await shot(page, 'name-2-pause');
  await tapButton(page, 'Rename');
  await page.waitForSelector('#farm-ask input', SLOW);
  await page.fill('#farm-ask input', 'Selene Rose');
  await page.click('#farm-ask button:last-child');
  await page.waitForFunction(() => /Selene Rose/.test(JSON.stringify(Farm.ui.modals.map((m) => m.c.list.map((o) => o.text || '')))), null, SLOW);
  // saved
  const saved = await page.evaluate(() => Farm.Logic.deserialize(JSON.parse(window.gameHost.saves[window.gameHost.saves.length - 1])).name);
  assert.strictEqual(saved, 'Selene Rose');
  // Cancel on a new farm still goes on to the welcome
  const second = await open(null);
  await second.page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await tapButton(second.page, 'Boy');
  await second.page.waitForSelector('#farm-ask input', SLOW);
  await second.page.click('#farm-ask button:first-child');
  await second.page.waitForFunction(() => /WELCOME TO HARVEST VILLE/.test(JSON.stringify(Farm.ui.modals.map((m) => m.c.list.map((o) => o.text || '')))), null, SLOW);
  assert.strictEqual(await second.page.evaluate(() => Farm.Logic.farmerName(Farm.session.state)), 'Farmer');
  assert.deepStrictEqual(problems, []);
  assert.deepStrictEqual(second.problems, []);
  await second.context.close();
  await context.close();
});

test('arranging the bag: Move puts the sickle in the first hotbar slot (owner, 27 Oct)', async () => {
  const save = await makeSave('s.time = 600;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await page.touchscreen.tap(14 + 6 * 48 + 22, 606); // the bag
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  const sickle = await page.evaluate(() => Farm.session.state.inv.findIndex((x) => x && x.id === 'sickle'));
  // tap the sickle (hold it), then Move, then the first slot
  // the bag's slots: its square tap zones, in order
  const slotXY = (i) => page.evaluate((i) => { const c = Farm.ui.modals[0].c; const z = c.list.filter((o) => o.type === 'Zone' && o.width === o.height)[i]; return z && { x: z.x, y: z.y + c.y }; }, i);
  let p = await slotXY(sickle);
  assert.ok(p, 'the sickle slot');
  await page.touchscreen.tap(p.x, p.y);
  await frames(page);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.held(Farm.session.state).id), 'sickle');
  await tapButton(page, 'Move');
  assert.match(await modalText(page), /Now tap where to put the Sickle/);
  await shot(page, 'bag-1-move');
  p = await slotXY(0);
  await page.touchscreen.tap(p.x, p.y);
  await frames(page);
  const s = await state(page);
  assert.strictEqual(s.inv[0].id, 'sickle', 'the sickle is on the hotbar');
  assert.strictEqual(s.inv[sickle].id, 'hoe', 'the hoe took its place');
  assert.strictEqual(s.sel, 0, 'still holding it');
  await shot(page, 'bag-2-done');
  await closeAll(page);
  assert.strictEqual(await page.evaluate(() => Farm.ui.slots[0].icon.frame.name), await page.evaluate(() => Farm.Logic.iconOf(Farm.session.state, 'sickle')));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('paging a list while it loads opens one page, not a pile of them (owner, 29 Oct: X had to be tapped 100 times)', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  const left = await page.evaluate(() => new Promise((done) => {
    const u = Farm.ui, rows = [];
    for (let i = 0; i < 12; i++) rows.push({ icon: 0, name: 'Farm ' + i, desc: '' });
    const show = (p) => u.listPanel({ title: 'Online', rows, page: p, reopen: (t, q) => setTimeout(() => show(q), 300) }); // a slow load
    show(0);
    for (let i = 0; i < 20; i++) u.swapTo(() => setTimeout(() => show(i + 1), 300));
    setTimeout(() => done(u.modals.length), 1200);
  }));
  assert.strictEqual(left, 1, 'one panel');
  await page.evaluate(() => Farm.ui.closeModal());
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'one X closes it');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('your birthday: the hat, confetti and the mayor\'s letter with a cake on the day; a cake on the calendar', async () => {
  const save = await makeSave("s.name = 'Ana'; L.setBirthday(s, 4, 1);");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  // the farmer wears the party hat in every pose: the birthday sheet, walking too (owner, 29 Oct: "change the character itself")
  await page.waitForFunction(() => /^player(_girl)?_bday$/.test(Farm.world.player.texture.key), null, SLOW);
  assert.deepStrictEqual(await page.evaluate(() => [Farm.walkAnim('down'), !!Farm.world.anims.get(Farm.walkAnim('down'))]), ['walk-down-b', true]);
  await shot(page, 'birthday-farmer');
  await page.waitForFunction(() => Farm.session.state.mail.includes('mybday'), null, SLOW); // the letter is in the mailbox (the party starts after a moment)
  await page.evaluate(() => Farm.ui.openCalendar(0));
  await page.waitForTimeout(200);
  const text = await page.evaluate(() => { const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[0].c.list); return out.join('\n'); });
  assert.match(text, /Apr 1 {2}Your birthday!/);
  await shot(page, 'birthday-calendar');
  await closeAll(page);
  const r = await page.evaluate(() => { const s = Farm.session.state; s.mail = ['mybday']; return Farm.Logic.readMail(s).letter.text; });
  assert.match(r, /Happy birthday/);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'cake')), 1);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('X on a list whose next page is still loading keeps it closed (owner, 29 Oct)', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  const left = await page.evaluate(() => new Promise((done) => {
    const u = Farm.ui, rows = [];
    for (let i = 0; i < 12; i++) rows.push({ icon: 0, name: 'Farm ' + i, desc: '' });
    const show = (p) => { const ticket = u.swapping; setTimeout(() => { if (!u.swapGone(ticket)) u.listPanel({ title: 'Online', rows, page: p, reopen: () => {} }); }, 300); }; // a slow load
    u.listPanel({ title: 'Online', rows, page: 0, reopen: () => {} });
    u.swapTo(() => show(1)); // Next...
    u.closeModal(); // ...then X before page 2 arrives
    setTimeout(() => done(u.modals.length), 900);
  }));
  assert.strictEqual(left, 0, 'nothing pops back up');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// A day past a farm's first, on a Monday, with the goal banner up.
const MONDAY = [2026, 11, 2, 10, 0];
const boxOf = (page, name) => page.evaluate((name) => { const b = Farm.ui[name].getBounds(); return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }; }, name);
const apart = (a, b) => a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;

test('Today\'s Event: a small chip you can tap, clear of the goal banner, the side buttons and the chat box', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 2;', MONDAY);
  const { page, problems, context } = await open(save, MONDAY);
  await closeAll(page);
  await page.waitForFunction(() => Farm.ui.eventChipBox && Farm.ui.eventChipBox.visible, null, SLOW);
  await shot(page, 'event-chip');
  const chip = await boxOf(page, 'eventChipBox');
  assert.ok(await page.evaluate(() => Farm.ui.goalBar.visible), 'the banner is up');
  assert.ok(apart(chip, { x0: 8, y0: 68, x1: 352, y1: 98 }), 'not on the goal banner');
  assert.ok(apart(chip, await boxOf(page, 'questBtn')), 'not on Quests');
  assert.ok(chip.x1 < 300, 'nowhere near the side buttons');
  const c = await page.evaluate(() => Farm.Config.EXTRA);
  assert.ok(apart(chip, { x0: 8, y0: 402 + c, x1: 204, y1: 458 + c }), 'not on the chat box');
  assert.ok(apart(chip, { x0: 8, y0: 225, x1: 82, y1: 281 }), 'over the dish and Power-Up chips, not on them');
  // the name shows beside it for a few seconds, then only the small round badge stays (owner, 3 Nov: "blocking the view")
  assert.strictEqual(await page.evaluate(() => Farm.ui.eventTag.visible && Farm.ui.eventTag.alpha > 0.5), true, 'the name at first');
  await page.waitForFunction(() => !Farm.ui.eventTag.visible, null, SLOW);
  const small = await page.evaluate(() => { // what shows: the badge and its icon
    const seen = Farm.ui.eventChipBox.list.filter((o) => o.visible && o.type !== 'Zone' && o.alpha > 0).map((o) => o.getBounds());
    return { x0: Math.min(...seen.map((b) => b.x)), y0: Math.min(...seen.map((b) => b.y)), x1: Math.max(...seen.map((b) => b.x + b.width)), y1: Math.max(...seen.map((b) => b.y + b.height)) };
  });
  assert.ok(small.x1 - small.x0 <= 48 && small.y1 - small.y0 <= 48, 'a small badge: ' + JSON.stringify(small));
  await shot(page, 'event-badge');
  await page.touchscreen.tap((small.x0 + small.x1) / 2, (small.y0 + small.y1) / 2);
  await frames(page, 3);
  assert.match(await modalText(page), /FISH MONDAY.*Fish sell for 25% more.*Tomorrow: Timber Tuesday/);
  await shot(page, 'event-panel');
  await closeAll(page);
  // it goes with Decorate, and on a visit
  await page.evaluate(() => { Farm.session.visit = { host: 'x' }; Farm.world.powerChip(); });
  assert.strictEqual(await page.evaluate(() => Farm.ui.eventChipBox.visible), false, 'not on a friend\'s farm');
  await page.evaluate(() => { Farm.session.visit = null; Farm.world.powerChip(); });
  // the stall pays it
  const prices = await page.evaluate(() => [Farm.Logic.instantPrice('fish_l', 2), Farm.Logic.instantPrice('turnip', 2)]);
  assert.deepStrictEqual(prices, [Math.floor(210 * 1.25), 6]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Today\'s Event: one pop-up on the first open of the day, never in quiet mode, kept in the save', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST;', MONDAY);
  const { page, problems, context } = await open(save, MONDAY);
  await closeAll(page);
  await page.waitForTimeout(6000);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'quiet: no pop-up');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.evSeen), 0);
  await page.evaluate(() => { window.gameHost.quiet = false; });
  await go(page, 'house', 'door');
  let seen = '';
  for (let i = 0; i < 40 && !/FISH MONDAY/.test(seen); i++) {
    seen = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; if (!m) return ''; const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(m.c.list); return out.join(' | '); });
    if (/Every day of the week has a small bonus/.test(seen)) { await tapButton(page, 'Skip'); seen = ''; continue; } // (its first-time tour, then the card)
    if (seen && !/FISH MONDAY/.test(seen)) { await closeAll(page); seen = ''; }
    await page.waitForTimeout(500);
  }
  assert.match(seen, /FISH MONDAY/);
  await shot(page, 'event-popup');
  await closeAll(page);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.evSeen === Farm.session.state.day), true);
  await go(page, 'farm', 'from_house');
  await page.waitForTimeout(6000);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.some((m) => { let f = false; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && /FISH MONDAY/.test(o.text)) f = true; if (o.list) walk(o.list); }); walk(m.c.list); return f; })), false, 'once a day');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('rare surprises: a sparkling rock glints, pays once and stays paid after closing the game; a golden crop glows and pays', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.stats.deepest = 60; s.look = "boy"; s.seed = 4242;', MONDAY);
  const { page, problems, context } = await open(save, MONDAY);
  await closeAll(page);
  await page.evaluate(() => { Farm.Config.RARE.rock = 0.1; Farm.world.travel('mine', 'entrance', 57); });
  await page.waitForFunction(() => Farm.session.mineFloor === 57 && Farm.world.mapKey === 'mine' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await frames(page, 4);
  const info = await page.evaluate(() => {
    const w = Farm.world, m = w.mine, idx = m.spark[0], x = idx % w.map.width, y = Math.floor(idx / w.map.width);
    return { n: m.spark.length, shown: Object.keys(w.sparks).length, idx, tint: w.layers.Walls.getTileAt(x, y).tint, plain: w.layers.Walls.getTileAt(m.rocks.filter((r) => m.spark.indexOf(r) < 0 && r !== m.stairs)[0] % w.map.width, Math.floor(m.rocks.filter((r) => m.spark.indexOf(r) < 0 && r !== m.stairs)[0] / w.map.width)).tint };
  });
  assert.ok(info.n >= 1, 'a floor with sparkling rocks');
  assert.strictEqual(info.shown, info.n, 'each one glints');
  assert.notStrictEqual(info.tint, info.plain, 'and is tinted');
  await shot(page, 'rare-rock');
  const paid = await page.evaluate((idx) => {
    const w = Farm.world, s = w.state, t = { x: idx % w.map.width, y: Math.floor(idx / w.map.width) }, was = s.gold, had = s.inv.filter(Boolean).reduce((a, b) => a + b.n, 0);
    const f = w.breakRock(idx, t, {});
    if (f) f();
    return { paid: !!s.rr && s.rr.got.length === 1, value: s.gold - was + s.inv.filter(Boolean).reduce((a, b) => a + b.n, 0) - had, gone: !w.sparks[idx] };
  }, info.idx);
  assert.ok(paid.paid && paid.gone, 'paid, and its stars are gone');
  assert.ok(paid.value > 0, 'a prize');
  await page.waitForFunction(() => Farm.ui.toastText.visible && /Sparkling rock!/.test(Farm.ui.toastText.text), null, SLOW);
  await shot(page, 'rare-rock-prize');
  // closing the game brings the rock back as a plain rock
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify(Farm.Logic.serialize(Farm.session.state))));
  await context.close();
  const again = await open(saved, MONDAY);
  await closeAll(again.page);
  const left = await again.page.evaluate((idx) => { const F = Farm, s = F.session.state; return { open: F.Logic.rockOpen(s, s.seed, 57, idx) }; }, info.idx);
  assert.strictEqual(left.open, false);
  // a golden crop
  await go(again.page, 'farm', 'from_house');
  await closeAll(again.page);
  const r = await again.page.evaluate(() => {
    const F = Farm, L = F.Logic, C = F.Config, w = F.world, s = w.state;
    C.RARE.crop = 1;
    s.tools.sickle = 0;
    const idx = 15 * 64 + 10, t = { c: 'tomato', p: 0, w: 0, r: 0 };
    t.p = L.nowMin() - L.growMins(t);
    s.soil[idx] = t;
    w.refreshTile(idx);
    return { idx, tint: w.crops[idx].tintTopLeft, stars: (w.goldFx[idx] || []).length };
  });
  assert.ok(r.stars >= 3, 'stars over it');
  assert.notStrictEqual(r.tint, 0xffffff, 'tinted gold');
  await teleport(again.page, 10, 14, 'down');
  await shot(again.page, 'rare-crop');
  assert.strictEqual(await actionLabel(again.page), 'Harvest');
  const before = await again.page.evaluate(() => Farm.session.state.gold);
  await tapAction(again.page);
  const after = await state(again.page);
  assert.strictEqual(after.gold - before, 12 * 6, 'six times its price, on top of the crop');
  assert.strictEqual(count(after, 'tomato'), 1);
  await again.page.waitForFunction(() => Farm.ui.toastText.visible && /Golden Tomato!/.test(Farm.ui.toastText.text), null, SLOW);
  await shot(again.page, 'rare-crop-prize');
  assert.strictEqual(await again.page.evaluate((i) => !Farm.world.goldFx[i], r.idx), true, 'its stars went with it');
  assert.deepStrictEqual(problems, []);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('Gem Sunday: a gem from a rock comes in twos, and says so', async () => {
  const SUNDAY = [2026, 11, 8, 10, 0];
  const save = await makeSave('s.start -= 3; s.goal = 99; s.stats.deepest = 60;', SUNDAY);
  const { page, problems, context } = await open(save, SUNDAY);
  await closeAll(page);
  await page.evaluate(() => Farm.world.travel('mine', 'entrance', 50));
  await page.waitForFunction(() => Farm.session.mineFloor === 50 && Farm.world.mapKey === 'mine' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  const got = await page.evaluate(() => {
    const w = Farm.world, real = Math.random, items = {};
    const idx = w.mine.rocks.filter((r) => r !== w.mine.stairs && w.mine.spark.indexOf(r) < 0)[0], t = { x: idx % w.map.width, y: Math.floor(idx / w.map.width) };
    Math.random = () => 0.86; // a gem
    const f = w.breakRock(idx, t, items);
    Math.random = real;
    if (f) f();
    return { items, bag: Farm.Logic.countItem(w.state, 'gem') };
  });
  assert.deepStrictEqual(got, { items: { gem: 2 }, bag: 2 });
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('tours: the Back Fields tour opens once when you walk up to the land, Skip / Next / Got it, and What\'s new shows it again', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  const waitText = (re) => page.waitForFunction((src) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    if (!m) return false;
    const out = [];
    const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    walk(m.c.list);
    return new RegExp(src).test(out.join(' | '));
  }, re.source, SLOW);
  // quiet (the tests): never
  await teleport(page, 36, 30, 'right');
  await page.waitForTimeout(2000);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'quiet: no tour');
  await teleport(page, 10, 30, 'down');
  await page.evaluate(() => { window.gameHost.quiet = false; });
  // the day's other pop-ups (the Daily Gift) come first: close them until it stays clear
  for (let quietFor = 0, i = 0; quietFor < 3 && i < 30; i++) {
    await page.waitForTimeout(800);
    if (await page.evaluate(() => Farm.ui.modals.length)) { assert.ok(!/BACK FIELDS/.test(await modalText(page)), 'not before you reach the land'); await closeAll(page); quietFor = 0; } else quietFor++;
  }
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);
  await teleport(page, 36, 30, 'right');
  await waitText(/THE BACK FIELDS.*Six new blocks of land wait past the trees.*Skip.*Next/);
  await shot(page, 'tour-land-1');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'land_tour')), true, 'marked at once');
  assert.ok(JSON.parse((await page.evaluate(() => window.gameHost.saves.slice(-1)[0])) || '{}').tp > 0, 'and saved');
  await tapButton(page, 'Next');
  await waitText(/For Sale sign with a coin over it/);
  await shot(page, 'tour-land-2');
  await tapButton(page, 'Next');
  await waitText(/10,000G.*20,000G.*40,000G.*80,000G.*160,000G.*320,000G/);
  await shot(page, 'tour-land-3');
  await tapButton(page, 'Next');
  await waitText(/loses its fence and turns into field.*Got it/);
  assert.ok(!/Skip/.test(await modalText(page)), 'the last step has only Got it');
  await shot(page, 'tour-land-4');
  await tapButton(page, 'Got it');
  await frames(page, 4);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);
  // once
  await teleport(page, 10, 30, 'down');
  await teleport(page, 36, 30, 'right');
  await page.waitForTimeout(2000);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'once');
  // What's new: Show me plays it again, then the list comes back
  let p = 0;
  for (; p < 40; p++) {
    await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openNews(p, null); }, p);
    await frames(page, 3);
    if (/The Back Fields/.test(await modalText(page))) break;
  }
  assert.ok(p < 40, 'the Back Fields line is in the list');
  await shot(page, 'tour-land-news');
  await tapButton(page, 'Show me');
  await waitText(/THE BACK FIELDS.*Six new blocks/);
  await tapButton(page, 'Skip');
  await waitText(/What's new[\s\S]*The Back Fields/);
  // Back skips too
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.tour('town'); });
  await waitText(/TOWN GOAL.*one Town Goal/);
  for (const k of [0, 1, 2]) { await shot(page, 'tour-town-' + (k + 1)); await tapButton(page, 'Next'); }
  await waitText(/Best Farm of the Week and a crown.*Got it/);
  await shot(page, 'tour-town-4');
  await page.evaluate(() => window.__gameBack());
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'Back closes it');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Tailor Shop: Tita Luz in the park, the Elf for free, a Gold look bought once, worn anywhere, changed from the pause menu (owner, 3 Nov)', async () => {
  const fs = require('fs');
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.gold = 60000;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  // the app brings a look's pictures when asked (the Costumes pack); ranch is missing on this "CDN"
  void fs;
  await page.evaluate(() => { window.__asked = []; const ask = window.gameHost.asset; window.gameHost.asset = function (f, save) { window.__asked.push(f); if (/ranch/.test(f)) return window.__gameAsset(f, null); return ask(f, save); }; });
  await page.evaluate(() => Farm.world.travel('town', 'from_farm'));
  await waitMap(page, 'town');
  const at = await page.evaluate(() => { const k = Farm.world.tailor; return k && { x: k.x, y: k.y, shown: k.img.visible }; });
  assert.ok(at && at.shown, 'Tita Luz is at her door in the day');
  const T = await page.evaluate(() => Farm.Config.TILE);
  await teleport(page, Math.floor(at.x / T), Math.floor(at.y / T) + 1, 'up');
  assert.strictEqual(await actionLabel(page), 'Talk');
  await shot(page, 'tailor-1-door');
  await tapAction(page);
  await page.waitForFunction(() => Farm.ui.modals.length, null, SLOW);
  assert.match(await modalText(page), /Tailor Shop[\s\S]*Christmas Elf[\s\S]*Wear[\s\S]*Straw Farmer[\s\S]*50,000G/);
  await shot(page, 'tailor-2-shop');
  // the Elf is everyone's
  await tapButton(page, 'Wear');
  await page.waitForFunction(() => Farm.world.player.texture.key === 'look_elf_boy', null, SLOW);
  assert.deepStrictEqual(await page.evaluate(() => window.__asked), ['looks/v1/elf-boy']);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.wornLook(Farm.session.state)), 'elf');
  await shot(page, 'tailor-3-elf');
  // a Gold look: bought once, for its price
  await page.evaluate(() => Farm.ui.openTailor('shop', 0));
  await frames(page, 3);
  await tapButton(page, '50,000G');
  await frames(page, 3);
  assert.match(await modalText(page), /BUY THIS LOOK\?[\s\S]*Straw Farmer for 50,000G/);
  await tapButton(page, 'Yes');
  await frames(page, 3);
  assert.match(await modalText(page), /IT IS YOURS!/);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.gold), 10000);
  await tapButton(page, 'Wear it');
  await page.waitForFunction(() => Farm.world.player.texture.key === 'look_straw_boy', null, SLOW);
  // the walk works in it
  await page.evaluate(() => { Farm.input.jx = 1; });
  await page.waitForTimeout(400);
  assert.match(await page.evaluate(() => Farm.world.player.anims.currentAnim && Farm.world.player.anims.currentAnim.key), /look_straw_boy/);
  await page.evaluate(() => { Farm.input.jx = 0; });
  // the pause menu: Looks shows what you own, and takes it off
  await page.evaluate(() => Farm.ui.openPause());
  await frames(page, 3);
  assert.match(await modalText(page), /Looks/, 'a Looks tile in the pause menu');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.drawTailor('mine', 0); }); // (what the tile opens)
  await frames(page, 3);
  const mine = await modalText(page);
  assert.match(mine, /Christmas Elf[\s\S]*Straw Farmer/);
  assert.ok(!/Ranch Hand/.test(mine), 'only what you own');
  await tapButton(page, 'Take off');
  await page.waitForFunction(() => Farm.world.player.texture.key === 'player', null, SLOW);
  // it is saved, and a look's picture that never comes leaves your own clothes on
  await page.evaluate(() => { Farm.Logic.wearLook(Farm.session.state, 'straw'); Farm.world.save(); });
  const saved = JSON.parse(await page.evaluate(() => window.gameHost.saves.slice(-1)[0]));
  assert.strictEqual(saved.cw, 1);
  assert.strictEqual(saved.co & 2, 2);
  await page.evaluate(() => { Farm.session.state.gold = 1e6; Farm.Logic.buyLookGold(Farm.session.state, 'ranch'); Farm.ui.wearLook('ranch'); });
  await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(() => Farm.world.player.texture.key), 'player', 'ranch never came: own clothes');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('four more tours: the Tailor Shop on first meeting Tita Luz, Today\'s Event before its card, and each step of Rare surprises and the deep Mine draws', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  const waitText = (re) => page.waitForFunction((src) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    if (!m) return false;
    const out = [];
    const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    walk(m.c.list);
    return new RegExp(src).test(out.join(' | '));
  }, re.source, SLOW);
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.Logic.eventShown(Farm.session.state); });
  await page.evaluate(() => Farm.world.travel('town', 'from_farm'));
  await waitMap(page, 'town');
  for (let i = 0; i < 6 && await page.evaluate(() => Farm.ui.modals.length); i++) { await closeAll(page); await page.waitForTimeout(600); } // (the day's gift)
  await page.evaluate(() => Farm.world.talkTailor());
  await waitText(/THE TAILOR SHOP[\s\S]*Tita Luz sews a look/);
  await shot(page, 'tour-tailor-1');
  for (let k = 0; k < 3; k++) await tapButton(page, 'Next');
  await waitText(/Friends see your look[\s\S]*Got it/);
  await tapButton(page, 'Got it');
  await waitText(/Tailor Shop[\s\S]*Christmas Elf/); // then the shop itself
  await closeAll(page);
  await page.evaluate(() => Farm.world.talkTailor());
  await waitText(/Tailor Shop[\s\S]*Christmas Elf/); // once
  assert.ok(!/Tita Luz sews/.test(await modalText(page)));
  await closeAll(page);
  // Today's Event: the tour first, then its card
  await page.evaluate(() => Farm.ui.openEvent());
  await waitText(/TODAY'S EVENT[\s\S]*Every day of the week/);
  await tapButton(page, 'Skip');
  await waitText(/WEDNESDAY|MONDAY|TUESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY/);
  await closeAll(page);
  // Rare surprises and the deep Mine: every step draws
  for (const name of ['rare', 'mine']) {
    await page.evaluate((n) => Farm.ui.tour(n), name);
    const steps = await page.evaluate((n) => Farm.TOURS[n].steps.length, name);
    for (let k = 0; k < steps - 1; k++) { await frames(page, 4); await tapButton(page, 'Next'); }
    await frames(page, 4);
    await shot(page, 'tour-' + name + '-last');
    await tapButton(page, 'Got it');
  }
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('downloads: without the Wild Lands you are asked first; a small badge while it comes; the Downloads page; then in you go; and the game opens in town if it is not on the phone (owner, 3 Nov)', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; L.addItem(s, 'bow', 1);");
  // a phone with nothing downloaded yet, on a slow "CDN"
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage(), problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([s, now]) => {
    window.__now = now;
    window.gameHost = { state: s, quiet: true, saves: [], save(x) { this.saves.push(JSON.stringify(x)); this.state = x; }, now: () => window.__now, here: [] };
    window.gameHost.asset = function (f, save) { setTimeout(function () { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); }, 120); };
  }, [save, at(START)]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await closeAll(page);
  assert.strictEqual(await page.evaluate(() => Farm.packReady('wild') || Farm.packOnPhone('wild')), false);
  await page.evaluate(() => Farm.world.travel('town', 'from_farm'));
  await waitMap(page, 'town');
  await closeAll(page);
  await page.evaluate(() => Farm.world.travel('pulag', 'from_town'));
  await frames(page, 4);
  const first = await modalText(page);
  assert.match(first, /WILD LANDS[\s\S]*A one-time download of \d\.\d MB[\s\S]*Not now[\s\S]*Download/);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'town', 'not gone yet');
  {
    await shot(page, 'packs-1-ask');
    await tapButton(page, 'Download');
    await page.waitForFunction(() => Farm.ui.packBadge.visible, null, SLOW);
    await shot(page, 'packs-2-badge');
    await page.evaluate(() => Farm.ui.openDownloads());
    await frames(page, 3);
    assert.match(await modalText(page), /Downloads[\s\S]*Wild Lands[\s\S]*Downloading/);
    await shot(page, 'packs-3-page');
    await closeAll(page);
    await page.waitForFunction(() => !Farm.anyDownloading() && Farm.packOnPhone('wild'), null, SLOW);
    await page.waitForFunction(() => Farm.ui.toastText.visible && /The Wild Lands are ready/.test(Farm.ui.toastText.text), null, SLOW);
    assert.strictEqual(await page.evaluate(() => Farm.ui.packBadge.visible), false, 'the badge goes when it is done');
    await page.waitForFunction(() => Farm.packReady('wild'), null, SLOW);
  }
  await page.evaluate(() => Farm.world.travel('pulag', 'from_town'));
  await waitMap(page, 'pulag');
  await page.waitForFunction(() => Farm.world.kanor && Farm.world.wild && Farm.world.wild.animals.length > 0, null, SLOW);
  await shot(page, 'packs-4-pulag');
  // the Downloads page: the Wild Lands on the phone now
  await page.evaluate(() => Farm.ui.openDownloads());
  await frames(page, 3);
  assert.match(await modalText(page), /Wild Lands[\s\S]*On your phone/);
  await closeAll(page);
  assert.deepStrictEqual(problems, []);
  await context.close();
  // reopened in Pulag on a phone without the Wild Lands: in town by the west road
  const wildSave = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.map = 'pulag';");
  const ctx2 = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const p2 = await ctx2.newPage();
  await ctx2.exposeBinding('__testAsset', () => null);
  await p2.addInitScript((s) => { window.gameHost = { state: s, quiet: true, saves: [], save(x) { this.state = x; }, here: [] }; window.gameHost.asset = function (f, save) { setTimeout(function () { if (save) window.__gameAssetSaved(f, false); else window.__gameAsset(f, null); }, 50); }; }, wildSave);
  await p2.goto(PAGE, { timeout: 90000 });
  await p2.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && !Farm.world.busy, null, { timeout: 90000 });
  assert.strictEqual(await p2.evaluate(() => Farm.world.mapKey), 'town');
  await ctx2.close();
});

test('your dog comes hunting: it follows you, points at a hidden animal, fetches a drop into your bag; Hunter\'s gear from Kanor; the Big Quiver brings a missed arrow back; the three tours (owner, 3 Nov)', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.map = 'pulag';");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await page.waitForFunction(() => Farm.world.mapKey === 'pulag' && Farm.world.wild && Farm.world.huntDog, null, SLOW);
  const T = 256;
  const dog = () => page.evaluate(() => { const d = Farm.world.huntDog, f = Farm.world.feet(); return { mode: d.mode, mark: !!d.mark, far: Math.hypot(d.x - f.x, d.y - f.y) / 256 }; });
  // no animals running about for this part
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.forEach((a) => { a.img.destroy(); a.sh.destroy(); }); w.wild.animals = []; w.wild.next = 1e9; });
  // it follows: walk off five tiles and it catches up
  const spot = await page.evaluate(() => {
    const w = Farm.world, z = w.wild.zone;
    for (let x = z.x0 + 3; x < z.x1 - 12; x++) for (let y = z.y0 + 3; y < z.y1 - 3; y++) {
      let ok = true;
      for (let k = 0; k <= 9 && ok; k++) ok = w.walkable(x + k, y);
      if (ok) return [x, y];
    }
    return null;
  });
  assert.ok(spot, 'open ground');
  await page.evaluate(([x, y]) => Farm.world.setFeet((x + 0.5) * 256, (y + 0.5) * 256), spot);
  await page.waitForFunction(() => { const d = Farm.world.huntDog, f = Farm.world.feet(); return Math.hypot(d.x - f.x, d.y - f.y) < 1.6 * 256; }, null, SLOW);
  // it sits when you stop (waited for, not timed: frames are slow when the machine is busy)
  await page.waitForFunction(() => Farm.world.huntDog.sprite.frame.name - Farm.Config.DOG.frame0 === 9, null, SLOW);
  // it points: an animal six tiles off, out in the grass
  await page.evaluate(([x, y]) => {
    const w = Farm.world, a = w.addWildAnimal('deer', 0, (x + 6.5) * 256, (y + 0.5) * 256, 1);
    a.def = Object.assign({}, a.def, { shy: 0 }); a.mode = 'idle'; a.t = 1e9;
    w.huntDog.sniffIn = 0;
  }, spot);
  await page.waitForFunction(() => Farm.world.huntDog.mode === 'point' && Farm.world.huntDog.mark, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.world.huntDog.flip), true, 'it faces the deer (to the right)');
  await page.waitForTimeout(400); // (it pops up)
  assert.ok(await page.evaluate(() => Farm.world.huntDog.mark.scale) > 0.9);
  await shot(page, 'dog-points');
  await page.waitForFunction(() => Farm.world.huntDog.mode === 'follow' && !Farm.world.huntDog.mark, null, SLOW);
  // it fetches: venison four tiles away goes in your bag, and it brings it back
  const before = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'venison'));
  await page.evaluate(([x, y]) => { const w = Farm.world; w.wild.animals.forEach((a) => { a.img.destroy(); a.sh.destroy(); }); w.wild.animals = []; w.dropWild('venison', (x + 4.5) * 256, (y + 0.5) * 256); }, spot);
  assert.strictEqual((await dog()).mode, 'follow', 'not at once: it lets it land');
  await page.waitForFunction(() => Farm.world.huntDog.mode === 'carry', null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'venison')), before + 1, 'in your bag as it picks it up');
  assert.strictEqual(await page.evaluate(() => Farm.world.wildDrops.length), 0);
  await shot(page, 'dog-fetches');
  await page.waitForFunction(() => Farm.world.huntDog.mode === 'follow' && !Farm.world.huntDog.carry, null, SLOW);
  assert.ok((await dog()).far < 1.2, 'brought back to you');
  // Hunter's gear at Kanor's: bought once, for Gold
  await page.evaluate(() => { const s = Farm.session.state; s.gold = 20000; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 10); Farm.ui.openKanor('buy', 0); });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(page), /Camo Cloak[\s\S]*Animals notice you later/);
  await tapButton(page, '3000G');
  await page.waitForFunction(() => Farm.Logic.hasGear(Farm.session.state, 'cloak'), null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.gold), 17000);
  assert.match(await modalText(page), /Camo Cloak \(yours\)/);
  await shot(page, 'kanor-gear');
  await closeAll(page);
  // the Big Quiver: a miss comes back (made sure here: 2 in 5 in the game)
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.buyGear(s, 'quiver'); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); Farm.world.dir = 'right'; Farm.world.idle(); window.__back = Farm.Logic.arrowBack; Farm.Logic.arrowBack = () => true; });
  await frames(page, 3);
  const arrows = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows'));
  await page.evaluate(() => Farm.world.shoot());
  await page.waitForFunction((n) => Farm.Logic.countItem(Farm.session.state, 'arrows') === n - 1, arrows, SLOW);
  await page.waitForFunction((n) => Farm.Logic.countItem(Farm.session.state, 'arrows') === n, arrows, SLOW);
  await page.evaluate(() => { Farm.Logic.arrowBack = window.__back; });
  // the tours: Hunter's gear before Kanor's Buy tab, once
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.Logic.takeTip(Farm.session.state, 'wild'); Farm.ui.openKanor('buy', 0); });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(page), /HUNTER'S GEAR[\s\S]*Hunter's gear, each piece once/);
  for (let k = 0; k < 2; k++) { await frames(page, 4); await tapButton(page, 'Next'); }
  await shot(page, 'tour-gear-last');
  await tapButton(page, 'Got it');
  assert.match(await modalText(page), /Kanor's Lodge/);
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openKanor('buy', 0));
  assert.doesNotMatch(await modalText(page), /HUNTER'S GEAR/);
  await closeAll(page);
  // the dog's tour on the next trip into the Wild Lands
  await page.evaluate(() => Farm.world.travel('town', 'from_pulag'));
  await waitMap(page, 'town');
  for (let i = 0; i < 6 && await page.evaluate(() => Farm.ui.modals.length); i++) { await closeAll(page); await page.waitForTimeout(600); } // (the day's gift)
  await page.evaluate(() => Farm.world.travel('pulag', 'from_town'));
  await waitMap(page, 'pulag');
  // (the day's own pop-ups come first: the tour waits for them)
  const top = async () => ((await page.evaluate(() => Farm.ui.modals.length)) ? modalText(page) : '');
  for (let i = 0; i < 60 && !/YOUR DOG COMES HUNTING/.test(await top()); i++) {
    if (await top()) await closeAll(page);
    await page.waitForTimeout(500);
  }
  assert.match(await modalText(page), /YOUR DOG COMES HUNTING[\s\S]*follows you in the Wild Lands/);
  for (let k = 0; k < 2; k++) { await frames(page, 4); await tapButton(page, 'Next'); }
  await shot(page, 'tour-dog-last');
  await tapButton(page, 'Got it');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'hunt_dog_tour')), true);
  // Hunting together's tour (it opens online): every step draws
  await page.evaluate(() => Farm.ui.tour('hunt_together'));
  for (let k = 0; k < 3; k++) { await frames(page, 4); await tapButton(page, 'Next'); }
  await shot(page, 'tour-hunt-together-last');
  await tapButton(page, 'Got it');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Daily gift calendar: a week of tiles, today glowing, day 7 a chest; Claim pays once. Farm photo: a frame, Hi!, Snap sends the picture, and the buttons come back (owner, 4 Nov)', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  // day 3 of a streak
  await page.evaluate(() => { const s = Farm.session.state, dn = Farm.Logic.dayNum(Farm.today()); s.lg = { last: dn - 1, streak: 2, claimed: dn - 1 }; Farm.ui.showLoginGift(); });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  const text = await modalText(page);
  assert.match(text, /DAILY GIFT[\s\S]*Day 3 in a row![\s\S]*Day 1[\s\S]*Day 7[\s\S]*Big chest[\s\S]*Day 7: 1500G \+ 2 Sunbeams \+ Power-Up/);
  assert.strictEqual((text.match(/✓/g) || []).length, 2, 'days 1 and 2 ticked');
  await shot(page, 'daily-calendar');
  const gold = await page.evaluate(() => Farm.session.state.gold);
  await tapButton(page, 'Claim');
  await page.waitForFunction(() => !Farm.ui.modals.length, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.gold), gold + 500, 'day 3: 500G');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.loginGift(Farm.session.state, Farm.today())), null, 'once a day');
  // photo mode
  await page.evaluate(() => { window.__shared = null; window.gameHost.share = (p) => { window.__shared = p; }; Farm.ui.shareFarm(); });
  await page.waitForFunction(() => Farm.ui.photo, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.ui.cameras.main.visible), false, 'the buttons and bars are hidden');
  assert.strictEqual(await page.evaluate(() => Farm.world.cursor.scale), 0, 'and the square on the tile in front (OPPO, 4 Nov)');
  const inFrame = await page.evaluate(() => { const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.photo.frame.list); return out.join(' | '); });
  assert.match(inFrame, /Harvest Ville on Selebox/);
  const tap = async (label) => {
    const pos = await page.evaluate((label) => { let b = null; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === label) b = o.getBounds(); if (o.list) walk(o.list); }); walk(Farm.ui.photo.bar.list); return b && { x: b.centerX, y: b.centerY }; }, label);
    assert.ok(pos, label);
    await page.touchscreen.tap(pos.x, pos.y);
    await frames(page, 3);
  };
  const before = await page.evaluate(() => { const f = Farm.world.feet(); return [f.x, f.y]; });
  await tap('Hi!');
  await page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Text' && o.text === 'Hi!'), null, SLOW);
  await page.touchscreen.tap(60, 400); // (a tap on the picture does not walk the farmer)
  await frames(page, 6);
  assert.deepStrictEqual(await page.evaluate(() => { const f = Farm.world.feet(); return [f.x, f.y]; }), before);
  await shot(page, 'farm-photo');
  await tap('Snap');
  await page.waitForFunction(() => window.__shared, null, SLOW);
  const shared = await page.evaluate(() => ({ jpeg: window.__shared.image.startsWith('data:image/jpeg;base64,'), w: window.__shared.width, text: window.__shared.text }));
  assert.ok(shared.jpeg && shared.w > 0);
  assert.match(shared.text, /My farm in Harvest Ville/);
  await page.waitForFunction(() => !Farm.ui.photo && Farm.ui.cameras.main.visible && Farm.ui.cameras.cameras.length === 1, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.world.cursor.scale), 1);
  // the tours: photo mode's, once
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.ui.shareFarm(); });
  await page.waitForFunction(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; return m && Farm.ui.photo; }, null, SLOW);
  assert.match(await modalText(page), /FARM PHOTOS[\s\S]*Photo mode hides the buttons/);
  await tapButton(page, 'Next');
  await shot(page, 'tour-photo-last');
  await tapButton(page, 'Got it');
  await page.waitForFunction(() => Farm.ui.photo && !Farm.ui.cameras.main.visible && Farm.ui.photo.bar.visible, null, SLOW);
  await tap('X');
  await page.waitForFunction(() => !Farm.ui.photo && Farm.ui.cameras.main.visible, null, SLOW);
  // the Derby's tour draws
  await page.evaluate(() => Farm.ui.tour('derby'));
  for (let k = 0; k < 2; k++) { await frames(page, 4); await tapButton(page, 'Next'); }
  await shot(page, 'tour-derby-last');
  await tapButton(page, 'Got it');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Bakunawa\'s Lair: in through the mouth in Magayon, floor 1\'s creatures in their own pictures, the gate opens when they are down, the guard of floor 10, the lift, the ladder out, and a reopened game lands at the mouth (owner, 4 Nov)', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.map = 'magayon'; s.wild.n = 50; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 40); s.sel = s.inv.findIndex((x) => x && x.id === 'bow');");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await waitMap(page, 'magayon');
  const T = 256;
  // the mouth stands at the head of the trail (the owner's picture, not the drawn one), its rock solid, its door open
  const mouth = await page.evaluate(() => { const w = Farm.world, p = w.points.lair_mouth, has = (k) => w.children.list.some((o) => o.texture && o.texture.key === k); return { pic: has('props/lair_mouth'), drawn: has('fx-lairmouth'), rock: !!w.blocked[w.idx(19, 2)], door: !w.blocked[w.idx(20, 3)], x: p.x, y: p.y }; });
  assert.deepStrictEqual([mouth.pic, mouth.drawn, mouth.rock, mouth.door], [true, false, true, true]);
  await page.evaluate(() => { const w = Farm.world, p = w.points.from_lair; w.setFeet(p.x, p.y); w.dir = 'down'; w.idle(); });
  await frames(page, 3);
  await shot(page, 'lair-mouth');
  await page.evaluate(() => { const w = Farm.world; w.setFeet(20.5 * 256, 3.5 * 256); w.dir = 'up'; });
  await waitMap(page, 'lair');
  // floor 1: three Santelmo, in their own row of the sheet and their own colours (no tint), and nobody walks in
  const here = await page.evaluate(() => {
    const w = Farm.world, WI = Farm.Config.WILD, row = WI.order.indexOf('santelmo');
    return { fl: Farm.session.lairFloor, deep: Farm.session.state.lair.deep, list: w.wild.animals.map((a) => [a.kind, Math.floor(a.img.frame.name / 12) === row, a.img.tintTopLeft === 0xffffff, a.sh.tintTopLeft === 0xffffff, !!a.halo]) };
  });
  assert.deepStrictEqual(here, { fl: 1, deep: 1, list: [0, 1, 2].map(() => ['santelmo', true, true, true, true]) });
  await page.evaluate(() => { const w = Farm.world; for (let i = 0; i < 40; i++) { w.wild.next = 0; w.wildArrive(0); } });
  assert.strictEqual(await page.evaluate(() => Farm.world.wild.animals.length), 3, 'none walk in from the edges');
  assert.strictEqual(await page.evaluate(() => Farm.world.lair.open), false);
  // the cave is the owner's tiles (painted into the Lair's copy of the indoor sheet), its lava pools filled with the
  // lava picture, the gate shut in its picture
  assert.deepStrictEqual(await page.evaluate(() => {
    const w = Farm.world, ts = w.map.getTileset('indoor'), g = w.lair.gate.img;
    return [ts.image.key, w.textures.exists('fx-lairgate0'), g.texture.key, g.frame.name, w.children.list.filter((o) => o.texture && /^fx-lairpool/.test(o.texture.key)).length > 0];
  }), ['indoor-lair', false, 'props/lair_gate', 'shut', true]);
  await shot(page, 'lair-floor-1');
  await teleport(page, 9, 12, 'down');
  await shot(page, 'lair-gate-shut');
  // the gate is sealed while they are about
  await teleport(page, 9, 13, 'down');
  assert.strictEqual(await actionLabel(page), 'Sealed');
  await teleport(page, 9, 14, 'down');
  await page.waitForFunction(() => Farm.ui.toastText.visible && /sealed\. 3 creatures/.test(Farm.ui.toastText.text), null, SLOW);
  // one real arrow: it holds still beside you, and the Bow takes it down (2 hits)
  const spot = await page.evaluate(() => {
    const w = Farm.world, a = w.wild.animals[0], T = 256;
    a.def = Object.assign({}, a.def, { shy: 0 });
    for (let tx = 2; tx < 16; tx++) for (let ty = 5; ty < 16; ty++) if (w.wildFree(tx, ty) && w.wildFree(tx + 1, ty) && w.wildFree(tx + 2, ty)) { a.x = (tx + 2.5) * T; a.y = (ty + 0.7) * T; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; return [tx, ty, a.x, a.y]; }
    return null;
  });
  assert.ok(spot, 'a clear spot');
  await teleport(page, spot[0], spot[1], 'right');
  assert.strictEqual(await actionLabel(page), 'Shoot');
  for (let k = 0; k < 2; k++) {
    await tapAction(page);
    await page.waitForTimeout(500);
    await page.evaluate(([x, y]) => { const a = Farm.world.wild.animals.find((b) => b.def.shy === 0); if (a) { a.x = x; a.y = y; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; } }, [spot[2], spot[3]]);
  }
  await page.waitForFunction(() => Farm.world.wild.animals.length === 2, null, SLOW);
  assert.ok(await page.evaluate(() => Farm.world.wildDrops.some((d) => d.id === 'ember_shard')), 'it left an Ember Shard');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.wild.gone['lair:0']), undefined, 'no slot waits in the Lair');
  // the rest (their hits counted as yours), and the gate glows open
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.slice().forEach((a) => { a.hp = 1; w.wildStruck(a); }); });
  await page.waitForFunction(() => Farm.world.lair.open && Farm.world.lair.gate.img.texture.key === 'props/lair_gate' && Farm.world.lair.gate.img.frame.name === 'open' && Farm.world.lair.gate.glow.visible, null, SLOW);
  await page.waitForFunction(() => Farm.ui.toastText.visible && /gate down is open/.test(Farm.ui.toastText.text), null, SLOW);
  await teleport(page, 9, 13, 'down');
  await shot(page, 'lair-gate-open');
  assert.strictEqual(await actionLabel(page), 'Go down');
  await teleport(page, 10, 15, 'down'); // walk onto it
  await page.waitForFunction(() => Farm.session.lairFloor === 2 && Farm.world.mapKey === 'lair' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  assert.ok(!(await page.evaluate(() => Farm.ui.toastText.visible && /gate down is open/.test(Farm.ui.toastText.text))), 'the gate note goes with its floor');
  await frames(page, 3);
  assert.deepStrictEqual(await page.evaluate(() => [Farm.session.state.lair.deep, Farm.world.lair.open, Farm.world.wild.animals.length]), [2, false, 3]);
  assert.ok(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'ember_shard')) >= 3, 'what lay on the ground came along');
  // floor 10: the Bungisngis guards it, as tough as the floor, with its bar from the start
  await page.evaluate(() => Farm.world.travel('lair', 'entrance', 10));
  await page.waitForFunction(() => Farm.session.lairFloor === 10 && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  const guard = await page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'bungisngis'); return a && { hp: a.hp, max: a.max, bar: !!a.bar }; });
  assert.deepStrictEqual(guard, { hp: 29, max: 29, bar: true });
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'bungisngis'), T = 256; a.x = 7.5 * T; a.y = 6.7 * T; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.def = Object.assign({}, a.def, { angry: 0 }); w.wildStruck(a); w.setFeet(6.5 * T, 9.5 * T); });
  await frames(page, 6);
  await shot(page, 'lair-floor-10-guard');
  // the lift: once you have been past floor 20, it stops at 1, 11 and 21
  await page.evaluate(() => { Farm.session.state.lair.deep = 25; Farm.world.travel('lair', 'entrance', 1); });
  await page.waitForFunction(() => Farm.session.lairFloor === 1 && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await teleport(page, 4, 3, 'left');
  assert.strictEqual(await actionLabel(page), 'Lift', 'even with the Bow in your hands');
  await tapAction(page);
  assert.match(await modalText(page), /Lair Lift[\s\S]*Floor 21[\s\S]*Floor 11[\s\S]*Floor 1/);
  await shot(page, 'lair-lift');
  await tapButton(page, 'Go');
  await page.waitForFunction(() => Farm.session.lairFloor === 21 && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  // the ladder climbs out to the mouth
  await teleport(page, 5, 3, 'up');
  assert.strictEqual(await actionLabel(page), 'Climb out');
  await tapAction(page);
  await waitMap(page, 'magayon');
  const out = await page.evaluate(() => { const w = Farm.world, f = w.feet(), p = w.points.from_lair; return Math.hypot(f.x - p.x, f.y - p.y) / 256; });
  assert.ok(out < 1, 'at the mouth');
  // in again, and the game is closed there: it opens at the mouth, not in the cave
  await page.evaluate(() => Farm.world.travel('lair', 'entrance', 11));
  await page.waitForFunction(() => Farm.world.mapKey === 'lair' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  const closed = await page.evaluate(() => { Farm.world.save(); return gameHost.saves[gameHost.saves.length - 1]; });
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(JSON.parse(closed));
  await closeAll(again.page);
  await waitMap(again.page, 'magayon');
  const back = await again.page.evaluate(() => { const w = Farm.world, f = w.feet(), p = w.points.from_lair; return { far: Math.hypot(f.x - p.x, f.y - p.y) / 256, deep: Farm.session.state.lair.deep }; });
  assert.ok(back.far < 1, 'at the mouth');
  assert.strictEqual(back.deep, 25);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('farmhands: hired at the Sunny Inn (tour first), they water and pick on the farm, wait by the field to talk, the morning report says what they did, and you can let them go (4 Nov)', async () => {
  const save = await makeSave(`s.stats.earned = 4000; s.gold = 5000; s.goal = 99; s.wv = C.NEWS_LATEST;
    for (let y = 11; y <= 16; y++) for (let x = 3; x <= 12; x++) delete s.debris[y * 64 + x];
    const now = L.nowMin();
    for (let x = 4; x <= 9; x++) s.soil[12 * 64 + x] = { w: 0, c: 'potato', p: now, r: 0, h: 1 };
    for (let x = 4; x <= 6; x++) s.soil[15 * 64 + x] = { w: 1, c: 'turnip', p: now - 20, r: 0, h: 1 };`);
  const { page, problems, context } = await open(save);
  await closeAll(page);
  const idx = (x, y) => y * W + x;
  // the Sunny Inn has a Farmhands tab; the first time, its tour comes first
  await go(page, 'town', 'from_farm');
  await closeAll(page);
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.ui.openBuilding('inn'); });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(page), /Sunny Inn[\s\S]*Menu[\s\S]*Farmhands[\s\S]*Sandwich/);
  await tapButton(page, 'Farmhands');
  await page.waitForFunction(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; return m && /FARMHANDS/.test(JSON.stringify(m.c.list.filter((o) => o.type === 'Text').map((o) => o.text))); }, null, SLOW);
  assert.match(await modalText(page), /FARMHANDS[\s\S]*stay at the Sunny Inn/);
  await shot(page, 'farmhands-tour-1');
  for (let k = 0; k < 3; k++) { await frames(page, 4); await tapButton(page, 'Next'); await frames(page, 4); await shot(page, 'farmhands-tour-' + (k + 2)); }
  await tapButton(page, 'Got it');
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  await page.evaluate(() => { window.gameHost.quiet = true; });
  let text = await modalText(page);
  assert.match(text, /Andoy · Waterer[\s\S]*Waters your seeds\. 20 a day, 60G a work day\.[\s\S]*Hire/);
  assert.match(text, /Berto · Animal hand[\s\S]*Comes once your farm has earned 6,000G/);
  await shot(page, 'farmhands-inn');
  // hire Andoy, then Lucing
  await tapButton(page, 'Hire');
  assert.match(await modalText(page), /ANDOY, WATERER[\s\S]*Up to 20 crops a day, for 60G on each day there is work/);
  await shot(page, 'farmhands-hire');
  await tapButton(page, 'Hire');
  await page.waitForFunction(() => Farm.Logic.fhHired(Farm.session.state, 'andoy') && Farm.ui.modals.length === 1, null, SLOW);
  await tapButton(page, 'Hire');
  await tapButton(page, 'Hire');
  await page.waitForFunction(() => Farm.Logic.fhHired(Farm.session.state, 'lucing') && Farm.ui.modals.length === 1, null, SLOW);
  text = await modalText(page);
  assert.match(text, /Lv 1[\s\S]*Andoy[\s\S]*0\/20[\s\S]*Waterer\. 60G a work day\. Lv 2 in 5 days\.[\s\S]*Let go/);
  await shot(page, 'farmhands-hired');
  await closeAll(page);
  // on the farm they wait by the field; at the next round they walk to the jobs and do them
  await go(page, 'farm', 'from_town');
  await closeAll(page);
  assert.deepStrictEqual(await page.evaluate(() => Object.keys(Farm.world.fh.hands).sort()), ['andoy', 'lucing']);
  // they wear their own pictures (assets/farmhands, tools/art/farmhands-import.js), not visitors cut from the people sheet
  assert.deepStrictEqual(await page.evaluate(() => {
    const one = Farm.world.textures.get('farmhands').source[0];
    return { real: one.image === Farm.images.farmhands, standin: 'fh_standin' in Farm.images, w: one.width, h: one.height, sprite: Farm.world.fh.hands.andoy.sprite.texture.key };
  }), { real: true, standin: false, w: 1152, h: 768, sprite: 'farmhands' });
  await teleport(page, 7, 11, 'down');
  await advance(page, 10);
  await page.waitForFunction(() => Farm.world.fh.hands.andoy.queue.length + (Farm.world.fh.hands.andoy.job ? 1 : 0) > 0, null, SLOW);
  let s = await state(page);
  assert.deepStrictEqual([4, 5, 6, 7, 8, 9].map((x) => s.soil[idx(x, 12)].w), [1, 1, 1, 1, 1, 1], 'the rules did the work');
  assert.strictEqual(s.basket.turnip, 3);
  assert.strictEqual(s.gold, 5000 - 60 - 80, 'a wage each');
  assert.ok(await page.evaluate((i) => !!Farm.world.fh.hold[i], idx(9, 12)), 'the field shows it as they get there');
  assert.ok(await page.evaluate((i) => !!Farm.world.crops[i], idx(4, 15)), 'the turnip stays until Lucing picks it');
  await page.waitForTimeout(2500);
  await shot(page, 'farmhands-working');
  await page.waitForFunction(() => Object.values(Farm.world.fh.hands).every((h) => !h.queue.length && !h.job && !h.path.length), null, { timeout: 240000 });
  assert.deepStrictEqual(await page.evaluate(() => Object.keys(Farm.world.fh.hold)), [], 'every tile shows what was done');
  assert.strictEqual(await page.evaluate((i) => Farm.world.layers.Soil.getTileAt(i % 64, Math.floor(i / 64)).index === Farm.world.gids.tilled_wet, idx(9, 12)), true);
  assert.strictEqual(await page.evaluate(() => Farm.world.basket.badge.text), '3');
  // talk to Andoy while he waits
  await teleport(page, 12, 9, 'up');
  await page.waitForFunction(() => Farm.ui.actionLabel.text === 'Talk', null, SLOW);
  await shot(page, 'farmhands-resting');
  await tapAction(page);
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(page), /ANDOY, WATERER[\s\S]*Dry soil\?[\s\S]*Today: 6 of 20 jobs done\. Lv 1, New\./);
  await closeAll(page);
  // the morning report: what they did yesterday (Lucing picked the potatoes at 4:10 PM)
  const day = (await state(page)).day;
  await page.evaluate(() => { Farm.ui.closeAll(); const d = new Date(window.__now); window.__now = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 8, 0).getTime(); Farm.world.clockMs = 1000; });
  await page.waitForFunction((d) => Farm.session.state.day === d + 1 && Farm.world && !Farm.world.busy && Farm.world.player.active && Farm.ui.modals.length === 1, day, SLOW);
  const report = await modalText(page);
  await shot(page, 'farmhands-report');
  await tapButton(page, 'OK');
  assert.match(report, /Your farmhands: Andoy watered 6 crops, Lucing picked 9 crops into the basket\. Wages: 140G\./);
  s = await state(page);
  assert.strictEqual(s.basket.potato, 6);
  // letting one go, at the inn
  await page.evaluate(() => Farm.ui.openFarmhands());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await tapButton(page, 'Let go');
  assert.match(await modalText(page), /LET ANDOY GO\?/);
  await tapButton(page, 'Let go');
  await page.waitForFunction(() => !Farm.Logic.fhHired(Farm.session.state, 'andoy'), null, SLOW);
  await closeAll(page);
  await page.waitForFunction(() => Farm.world.fh.hands.andoy && Farm.world.fh.hands.andoy.leaving, null, SLOW);
  // What's new has the line, with the tour behind Show me
  assert.ok(await page.evaluate(() => Farm.Config.NEWS.some((n) => n.lines.some((l) => l[1] === 'Farmhands' && l[3] === 'farmhands'))));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('festival contests: told the day before and on the day, the calendar says so; the Animal Contest at the Cow Festival with its judging card and prize; Ribbons in the Collection; the Noche Buena Cook-off on Starry Night next to the evening, and its tour (contests)', async () => {
  const NOV18 = [2026, 11, 18, 10, 0];
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.animals = []; L.addAnimal(s, 'cow'); s.animals[0].love = 100;", NOV18);
  const { page, problems, context } = await open(save, NOV18);
  await closeAll(page);
  // the morning before, and the day itself
  let report = await nextMorning(page);
  assert.match(report, /The Animal Contest at the Cow Festival is tomorrow! Get ready: feed, pet and brush your best animal first\./);
  await page.evaluate(() => Farm.ui.openCalendar(0));
  assert.match(await modalText(page), /Nov 20 {2}Cow Festival: Animal Contest/);
  await shot(page, 'contest-calendar');
  await closeAll(page);
  report = await nextMorning(page);
  assert.match(report, /Today is the Cow Festival! Bring your best-loved animal[\s\S]*The Animal Contest is on at the Cow Festival today, 8:00 AM to 9:00 PM: talk to Mayor Hollis/);
  await page.evaluate(() => { const a = Farm.session.state.animals[0]; a.love = 100; a.fed = 1; a.pet = 1; a.brushed = 1; });
  // Mayor Hollis in the plaza: the entry list
  await go(page, 'town', 'from_farm');
  await page.waitForFunction(() => Farm.world.villagers.list.every((v) => !v.path.length), null, SLOW);
  await teleport(page, 14, 18, 'down');
  assert.strictEqual(await actionLabel(page), 'Festival');
  await tapAction(page);
  let text = await modalText(page);
  assert.match(text, /Animal Contest[\s\S]*Judge: Owen, veterinarian\. 1st 1,500G and the trophy[\s\S]*Daisy[\s\S]*5 hearts\. 92 points\.\nFed ✓ {2}Petted ✓ {2}Brushed ✓/);
  await shot(page, 'contest-list');
  const gold = (await state(page)).gold;
  await tapButton(page, 'Enter');
  assert.match(await modalText(page), /Enter Daisy \(it comes home after\)\? You can enter once a year\./);
  await tapButton(page, 'Enter');
  assert.match(await modalText(page), /Welcome to the Animal Contest![\s\S]*This year Tomas, Pip and Pearl entered too\./);
  await tapButton(page, 'Next');
  assert.match(await modalText(page), /Fed, petted and brushed today\? I can tell\./);
  await tapButton(page, 'Next');
  // the card: 4th place first, then up
  await page.waitForFunction(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; return m && m.c.list.some((o) => o.type === 'Container' && o.alpha === 1 && o.list.some((t) => t.type === 'Text' && /Snowball/.test(t.text))); }, null, SLOW);
  await shot(page, 'contest-judging');
  await page.waitForFunction(() => { let hit = false; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === 'Hooray!') hit = true; if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return hit; }, null, SLOW);
  text = await modalText(page);
  assert.match(text, /ANIMAL CONTEST[\s\S]*Daisy the cow {2}\(you\)[\s\S]*92[\s\S]*Father Tomas' cow Bella[\s\S]*83[\s\S]*Pip's pig Bubbles[\s\S]*64[\s\S]*Grandma Pearl's chicken Snowball[\s\S]*48[\s\S]*1st place! Blue ribbon and 1,500G, and the 2026 trophy!/);
  await shot(page, 'contest-card');
  // the ribbons are the pictures (assets/contests), not the drawn stand-ins
  const painted = (keys) => page.evaluate((keys) => keys.map((k) => Farm.ui.textures.exists(k)), keys);
  assert.deepStrictEqual(await painted(['ct-rosp-1-40', 'ct-rosp-2-40', 'ct-rosp-3-40', 'ct-rosp-4-34', 'ct-ros-1-40']), [true, true, true, true, false]); // (4th: the green thank-you ribbon)
  await tapButton(page, 'Hooray!');
  assert.match(await modalText(page), /1ST PLACE![\s\S]*See it in the Collection: tap Ribbons\./);
  await page.waitForTimeout(600);
  await shot(page, 'contest-prize');
  assert.deepStrictEqual(await painted(['ct-rosp-1-76', 'ct-cupp-80', 'ct-ros-1-76', 'ct-cup-80']), [true, true, false, false], 'the prize: the picture ribbon and cup');
  await tapButton(page, 'OK');
  let s = await state(page);
  assert.strictEqual(s.gold, gold + 1500);
  assert.deepStrictEqual(s.cn.r, [{ c: 'animal', y: 2026, p: 1, w: 'Daisy' }]);
  assert.strictEqual(s.fest.cowfest, 2026);
  assert.strictEqual(s.animals[0].love, 100);
  assert.match(JSON.stringify(await page.evaluate(() => Farm.Logic.serialize(Farm.session.state).cn)), /\[\[0,2026,1,"Daisy"\]\]/, 'saved');
  // once a year
  await closeAll(page);
  await tapAction(page);
  assert.match(await modalText(page), /Thank you for entering the Animal Contest! 1st place with Daisy: well done!/);
  await closeAll(page);
  // Ribbons, from the Collection
  await page.evaluate(() => Farm.ui.openCollection());
  await tapButton(page, 'Ribbons');
  assert.match(await modalText(page), /RIBBONS & TROPHIES[\s\S]*Trophies 1 {4}Ribbons 1[\s\S]*Animal 2026[\s\S]*Daisy/);
  await shot(page, 'contest-ribbons');
  assert.deepStrictEqual(await painted(['ct-rosp-1-32', 'ct-cupp-38', 'ct-cup-38']), [true, true, false]);
  await tapButton(page, 'Close');
  assert.match(await modalText(page), /Collection/);
  await closeAll(page);
  assert.deepStrictEqual(problems, []);
  await context.close();

  // Starry Night: the evening, or the Cook-off (the tour first, the first time)
  const DEC24 = [2026, 12, 24, 19, 0];
  const save2 = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.inv = s.inv.map(() => null); L.addItem(s, 'pumpkin_pie', 1); L.addItem(s, 'sandwich', 1); L.addItem(s, 'boiled_egg', 1); s.map = 'town';", DEC24);
  const b = await open(save2, DEC24);
  await waitMap(b.page, 'town');
  await closeAll(b.page);
  await b.page.waitForFunction(() => Farm.world.villagers.list.every((v) => !v.path.length), null, SLOW);
  await teleport(b.page, 14, 18, 'down');
  assert.strictEqual(await actionLabel(b.page), 'Festival');
  await b.page.evaluate(() => { window.gameHost.quiet = false; });
  await tapAction(b.page);
  assert.match(await modalText(b.page), /Mayor Hollis[\s\S]*Tonight there is something for everyone![\s\S]*Noche Buena Cook-off\. Why not both\?/);
  await shot(b.page, 'contest-starry-choice');
  await tapButton(b.page, 'Cook-off');
  assert.match(await modalText(b.page), /FESTIVAL CONTESTS[\s\S]*Three festivals have a contest/);
  await tapButton(b.page, 'Next');
  await tapButton(b.page, 'Next');
  await frames(b.page, 6);
  await shot(b.page, 'contest-tour-last');
  assert.deepStrictEqual(await b.page.evaluate(() => ['ct-rosp-1-48', 'ct-rosp-2-40', 'ct-rosp-3-36', 'ct-cupp-50', 'ct-cup-50'].map((k) => Farm.ui.textures.exists(k))), [true, true, true, true, false]);
  assert.deepStrictEqual(await b.page.evaluate(() => { // without the sheet, the drawn ones
    const had = Farm.images.contests;
    delete Farm.images.contests;
    try { Farm.ui.ctRosette(null, 0, 0, 2, 44).destroy(); Farm.ui.ctCup(null, 0, 0, 44).destroy(); } finally { Farm.images.contests = had; }
    return ['ct-ros-2-44', 'ct-cup-44', 'ct-rosp-2-44'].map((k) => Farm.ui.textures.exists(k));
  }), [true, true, false]);
  await tapButton(b.page, 'Got it');
  text = await modalText(b.page);
  assert.match(text, /Noche Buena Cook-off[\s\S]*Judge: Rosa, innkeeper\.[\s\S]*Pumpkin Pie[\s\S]*90 points\. 3 things in it, 110 energy\.[\s\S]*Boiled Egg/);
  assert.ok(!/Sandwich/.test(text), 'bought at the inn: not on the list');
  await shot(b.page, 'contest-cook-list');
  await b.page.evaluate(() => { Farm.Logic.ctRivals('cook', 2026); }); // (Pearl's pie scores 84: the pie wins)
  await tapButton(b.page, 'Enter');
  await tapButton(b.page, 'Enter');
  await tapButton(b.page, 'Next');
  await tapButton(b.page, 'Next');
  await b.page.waitForFunction(() => { let hit = false; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === 'Hooray!') hit = true; if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return hit; }, null, SLOW);
  assert.match(await modalText(b.page), /NOCHE BUENA COOK-OFF[\s\S]*Your Pumpkin Pie {2}\(you\)[\s\S]*1st place!/);
  await shot(b.page, 'contest-cook-card');
  await tapButton(b.page, 'Hooray!');
  await tapButton(b.page, 'OK');
  s = await state(b.page);
  assert.strictEqual(count(s, 'pumpkin_pie'), 0, 'the judges keep the pie');
  assert.strictEqual(s.fest.starry, undefined);
  // the evening is still there
  await closeAll(b.page);
  await tapAction(b.page);
  { const ev = await modalText(b.page); assert.ok(!/STARRY NIGHT\n/.test(ev) && /Starry Night/.test(ev), 'the evening list: ' + ev.slice(0, 300)); }
  await closeAll(b.page);
  assert.deepStrictEqual(b.problems, []);
  await b.context.close();
});

// ---------- Skills (src/19zz-skills.js) ----------
// Taps the centre of a Phaser object found by `find` (run in the page: (o) => bool) in the top modal, or in `where`.
async function tapWhere(page, find, where) {
  const pos = await page.evaluate(([src, where]) => {
    const f = eval(src), root = where ? eval(where) : Farm.ui.modals[Farm.ui.modals.length - 1].c; // eslint-disable-line no-eval
    let b = null;
    const walk = (list) => list.forEach((o) => { if (!b && f(o)) b = o.getBounds(); if (o.list) walk(o.list); });
    walk(root.list);
    return b && { x: b.centerX, y: b.centerY };
  }, [find, where || null]);
  assert.ok(pos, 'found ' + find);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}

test('skills: a till levels up Farming, its card opens Skills; the farmer card and the Collection open it too; the perks; a smashed rock; the reel bar; a caught and a lost fish', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.sk2 = { farm: 99 }; L.addItem(s, "rod", 1);');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  const xp = (k) => page.evaluate((k) => Farm.Logic.skillXp(Farm.session.state, k), k);
  // one tilled tile: 100 XP, Farming level 2, and its card
  await teleport(page, 5, 11, 'down');
  await hold(page, 'hoe');
  assert.strictEqual(await actionLabel(page), 'Till');
  await tapAction(page);
  assert.strictEqual(await xp('farm'), 100);
  await page.waitForFunction(() => Farm.ui.skCard && Farm.ui.skCard.active, null, SLOW);
  const card = await page.evaluate(() => { const out = []; Farm.ui.skCard.list.forEach((o) => { if (o.type === 'Text') out.push(o.text); }); return out.join(' | '); });
  assert.match(card, /LEVEL UP! \| Farming {2}Level 2 \| Next perk at level 3\./);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'the card is not a panel: you keep playing');
  await page.waitForTimeout(400);
  await shot(page, 'skills-levelup');
  // tap it: the Skills panel
  await tapWhere(page, "(o) => o.type === 'Zone'", 'Farm.ui.skCard');
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  let text = await modalText(page);
  assert.match(text, /Skills \| X \| Tap a skill to see all of its perks\. \| Farming \| Level 2 \| 0 \/ 200 XP to level 3 \| Level 3: Your Watering Can holds 5 more water\./);
  assert.match(text, /Mining \| Level 1 \| 0 \/ 100 XP to level 2 \| Level 3: Rocks take 15% less energy to smash\./);
  assert.match(text, /Fishing \| Level 1 .*Hunting \| Level 1/);
  await shot(page, 'skills-panel');
  // a skill: all of its perks
  await tapWhere(page, "(o) => o.type === 'Text' && o.text === 'Farming'");
  text = await modalText(page);
  assert.match(text, /FARMING {2}LEVEL 2 .*Level 3: {2}Your Watering Can holds 5 more water\. .*Level 10: {2}A 1 in 10 chance of one more crop when you pick\./);
  await tapButton(page, 'OK');
  assert.match(await modalText(page), /^Skills/);
  await tapButton(page, 'X');
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);
  // the farmer card in the pause menu: Skills, and X goes back to the menu
  await page.evaluate(() => Farm.ui.openPause());
  await frames(page, 2);
  await shot(page, 'skills-pause');
  await tapWhere(page, "(o) => o.name === 'skills-link'");
  assert.match(await modalText(page), /^Skills .*Farming \| Level 2/);
  await tapButton(page, 'X');
  assert.match(await modalText(page), /Paused/);
  // the Collection: Skills beside Hunts
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openCollection());
  await frames(page, 2);
  await tapButton(page, 'Skills');
  assert.match(await modalText(page), /^Skills/);
  await tapButton(page, 'X');
  assert.match(await modalText(page), /Collection/);
  await closeAll(page);
  // the bigger can at Farming 3, and the Hoe's energy at Farming 5
  const can = await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic, a = L.canCapacity(s); s.sk2.farm = Farm.Config.SKILLS.need[3]; return [a, L.canCapacity(s)]; });
  assert.strictEqual(can[1], can[0] + 5);
  await page.waitForFunction(() => Farm.ui.skCard == null || !Farm.ui.skCard.active, null, SLOW);
  // the mine: a smashed rock is Mining XP; at Mining 3 it takes 15% less energy
  await page.evaluate(() => { Farm.session.state.sk2.mine = Farm.Config.SKILLS.need[3]; Farm.world.travel('mine', 'entrance', 40); });
  await waitMap(page, 'mine');
  const rock = await page.evaluate(() => {
    const w = Farm.world, W = w.map.width; // a plain rock with open floor above it
    const ok = w.mine.rocks.filter((i) => i !== w.mine.stairs && !w.mine.broken[i] && !(w.mine.spark || []).includes(i) && i >= W && !w.tileAt('Walls', i % W, Math.floor(i / W) - 1));
    return ok.length ? [ok[0] % W, Math.floor(ok[0] / W)] : null;
  });
  assert.ok(rock, 'a rock with room in front');
  await teleport(page, rock[0], rock[1] - 1, 'down');
  await hold(page, 'hammer');
  assert.strictEqual(await actionLabel(page), 'Smash');
  const before = await page.evaluate(() => { const s = Farm.session.state; s.energy = 100; return { e: s.energy, xp: Farm.Logic.skillXp(s, 'mine'), cost: Farm.Logic.mineEnergy(s, 40), plain: (() => { const x = s.sk2.mine; s.sk2.mine = 0; const c = Farm.Logic.mineEnergy(s, 40); s.sk2.mine = x; return c; })() }; });
  assert.strictEqual(before.cost, Math.round(before.plain * 0.85), 'Mining 3: 15% less');
  await tapAction(page);
  const after = await page.evaluate(() => ({ e: Farm.session.state.energy, xp: Farm.Logic.skillXp(Farm.session.state, 'mine') }));
  assert.strictEqual(after.e, before.e - before.cost);
  assert.ok(after.xp - before.xp === 3 || after.xp - before.xp === 5, 'a rock: 3, or 5 with ore: ' + (after.xp - before.xp));
  await go(page, 'farm', 'from_town');
  // fishing at Fishing 3: a 10% bigger green bar; the table is the plain one again after
  await page.evaluate(() => { Farm.Config.FISH_WINDOW = 1e9; Farm.session.state.sk2.fish = Farm.Config.SKILLS.need[3]; });
  await hold(page, 'rod');
  await teleport(page, 14, 4, 'right');
  assert.strictEqual(await actionLabel(page), 'Fish');
  await tapAction(page);
  await page.evaluate(() => { Farm.world.fishing.biteAt = 0; });
  await page.waitForFunction(() => Farm.world.fishing && Farm.world.fishing.state === 'bite', null, SLOW);
  await page.evaluate(() => { const G = Farm.Config.FISH_GAME; window.__plain = JSON.stringify(G); ['fish_s', 'fish_m', 'fish_l', 'fish_k'].forEach((k) => { G[k].zone = 0.5; G[k].speed = 0.0001; }); });
  await tapAction(page);
  await page.waitForFunction(() => Farm.ui.game2, null, SLOW);
  const bar = await page.evaluate(() => { let h = 0; const walk = (l) => l.forEach((o) => { if (o.type === 'Rectangle' && o.width === 38) h = o.height; if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return h; });
  assert.ok(Math.abs(bar - 0.5 * 1.1 * 320) < 0.01, 'the green bar: ' + bar);
  assert.strictEqual(await page.evaluate(() => Farm.Config.FISH_GAME.fish_l.zone), 0.5, 'the real table is untouched');
  await shot(page, 'skills-reel');
  // it lands (the fish keeps still in the bar), and that is Fishing XP
  const fx = await xp('fish');
  await page.evaluate(() => { Farm.Config.FISH_GAME.fill = 50; Farm.Config.FISH_GAME.drain = 0; });
  await page.waitForFunction(() => !Farm.ui.game2 && !Farm.world.fishing, null, SLOW);
  const fish = await page.evaluate(() => Farm.session.state.lastFish);
  assert.ok(fish && fish.id, 'caught');
  const X = await page.evaluate(() => Farm.Config.SKILLS.skills.fish.xp);
  assert.strictEqual(await xp('fish'), fx + X[fish.id] + (fish.giant ? X.giant : 0));
  // one that gets away (Back in the reel game) still teaches a little
  await tapAction(page);
  await page.evaluate(() => { Farm.world.fishing.biteAt = 0; });
  await page.waitForFunction(() => Farm.world.fishing && Farm.world.fishing.state === 'bite', null, SLOW);
  await page.evaluate(() => { const G = Farm.Config.FISH_GAME; G.fill = 0.0001; });
  await tapAction(page);
  await page.waitForFunction(() => Farm.ui.game2, null, SLOW);
  const fx2 = await xp('fish');
  await page.evaluate(() => window.__gameBack());
  await page.waitForFunction(() => !Farm.ui.game2 && !Farm.world.fishing, null, SLOW);
  assert.strictEqual(await xp('fish'), fx2 + 1);
  await page.evaluate(() => { const p = JSON.parse(window.__plain); Object.assign(Farm.Config.FISH_GAME, p); });
  // the save keeps it all
  await page.evaluate(() => Farm.world.save());
  const saved = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  const st = await state(page);
  assert.deepStrictEqual(saved.sk2, ['farm', 'mine', 'fish', 'hunt'].map((k) => st.sk2[k] || 0));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('skills: a hunted deer is Hunting XP and a strong shot says so; the Skills tour after the first level-up and from What\'s new; a friend\'s levels on their player menu', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.gold = 5000; L.addItem(s, "bow", 1); L.addItem(s, "arrows", 20); s.sk2 = { hunt: Farm.Config.SKILLS.need[10] - 10 };');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await page.evaluate(() => { window.gameHost.quiet = false; });
  // the day's other pop-ups first
  for (let quietFor = 0, i = 0; quietFor < 3 && i < 30; i++) {
    await page.waitForTimeout(800);
    if (await page.evaluate(() => Farm.ui.modals.length)) { await closeAll(page); quietFor = 0; } else quietFor++;
  }
  await go(page, 'town', 'from_farm');
  await page.evaluate(() => Farm.world.travel('pulag', 'from_town'));
  await waitMap(page, 'pulag');
  await page.waitForTimeout(1500);
  await closeAll(page); // (Pulag's own first-time words)
  const d = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, T = Farm.Config.TILE;
    s.sel = s.inv.findIndex((x) => x && x.id === 'bow');
    w.wild.animals.filter((a) => a.kind !== 'deer').forEach((a) => { a.img.destroy(); a.sh.destroy(); });
    w.wild.animals = w.wild.animals.filter((a) => a.kind === 'deer').slice(0, 1);
    w.wild.next = 1e9;
    const a = w.wild.animals[0];
    a.def = Object.assign({}, a.def, { shy: 0 });
    a.size = 1;
    a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9;
    for (let tx = 4; tx < 26; tx++) for (let ty = 4; ty < 22; ty++) if (w.wildFree(tx, ty) && w.wildFree(tx + 2, ty)) { a.x = (tx + 2.5) * T; a.y = (ty + 0.7) * T; return [tx, ty]; }
    return null;
  });
  assert.ok(d, 'a clear spot');
  await teleport(page, d[0], d[1], 'right');
  assert.strictEqual(await actionLabel(page), 'Shoot');
  // Hunting 9 (level 10 is 10 XP away): 1 in 10 shots is strong. This one is: the deer (2 hits) goes down to one arrow
  await page.evaluate(() => { Farm.Logic.skillRnd = () => 0; window.__floats = []; const f = Farm.ui.floatText; Farm.ui.floatText = function (x, y, t) { window.__floats.push(t); return f.apply(this, arguments); }; });
  const arrows = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows'));
  await tapAction(page);
  await page.waitForFunction(() => Farm.world.wild.animals.length === 0, null, SLOW);
  assert.ok((await page.evaluate(() => window.__floats)).includes('Strong shot!'), 'it says so');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows')), arrows, 'Hunting 3+: that arrow was not used up');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.skillXp(Farm.session.state, 'hunt')), await page.evaluate(() => Farm.Config.SKILLS.need[10]), 'a deer: 10 XP (2 arrows x 5)');
  await page.evaluate(() => { Farm.Logic.skillRnd = Math.random; });
  // the level-up card, then the tour (not in quiet mode)
  await page.waitForFunction(() => Farm.ui.skCard && Farm.ui.skCard.active, null, SLOW);
  assert.match(await page.evaluate(() => Farm.ui.skCard.list.filter((o) => o.type === 'Text').map((o) => o.text).join(' | ')), /Hunting {2}Level 10 \| 1 in 5 shots is a strong shot\./);
  await shot(page, 'skills-levelup-hunt');
  await page.waitForFunction(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; return m && m.c.list.some((o) => o.type === 'Text' && o.text === 'SKILLS'); }, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'skills_tour')), true);
  assert.match(await modalText(page), /SKILLS .*you get better at each just by doing it/);
  await shot(page, 'tour-skills-1');
  await tapButton(page, 'Next');
  assert.match(await modalText(page), /LEVEL UP! .*Fishing {2}Level 3/);
  await shot(page, 'tour-skills-2');
  await tapButton(page, 'Next');
  assert.match(await modalText(page), /on your farmer card in the pause menu.*Got it/);
  await shot(page, 'tour-skills-3');
  await tapButton(page, 'Got it');
  if (await page.evaluate(() => Farm.ui.modals.length)) assert.ok(!/SKILLS/.test(await modalText(page)), 'the tour is gone (another first-time card may follow: ' + (await modalText(page)).slice(0, 60) + ')');
  await closeAll(page);
  // once: Skills opens straight away now
  await page.evaluate(() => Farm.ui.openSkills());
  await frames(page, 2);
  assert.match(await modalText(page), /^Skills .*Hunting \| Level 10 \| Top level! 7,200 XP \| All of its perks are yours\./);
  await closeAll(page);
  // What's new: the Skills line, and Show me plays it again
  let p = 0;
  for (; p < 20; p++) {
    await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openNews(p, null); }, p);
    await frames(page, 3);
    if (/Skills \| Get better at farming/.test(await modalText(page))) break;
  }
  assert.ok(p < 20, 'the Skills line is in What\'s new');
  await shot(page, 'skills-news');
  const row = await page.evaluate(() => { const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return out; });
  const nth = row.slice(0, row.indexOf('Skills')).filter((t) => t === 'Show me').length;
  await tapButton(page, 'Show me', nth);
  assert.match(await modalText(page), /SKILLS .*just by doing it/);
  await tapButton(page, 'Skip');
  assert.match(await modalText(page), /What's new/);
  await closeAll(page);
  // a friend's levels: on a visit, their player menu says them (from their snapshot; checked on the way in)
  const menu = await page.evaluate(() => {
    const L = Farm.Logic, mine = Farm.session.state, st = L.visitState({ sk2: [4, 2, 7, 1] }, mine);
    Farm.session.visit = { host: 'aaaaaaaa-1111-2222-3333-444444444444', name: 'Mara', state: st };
    try {
      Farm.ui.playerMenu('aaaaaaaa-1111-2222-3333-444444444444', 'Mara');
      const out = [];
      const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
      walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
      Farm.ui.closeAll();
      Farm.ui.playerMenu('bbbbbbbb-1111-2222-3333-444444444444', 'Someone else');
      const other = [];
      walk.call(null, Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
      Farm.ui.modals[Farm.ui.modals.length - 1].c.list.forEach((o) => { if (o.type === 'Text') other.push(o.text); });
      return { mara: out.join(' | '), other: other.join(' | '), own: Farm.ui.listPanel === Farm.UIScene.prototype.listPanel };
    } finally { Farm.ui.closeAll(); Farm.session.visit = null; }
  });
  assert.match(menu.mara, /Mara \| .*Farm 4 · Mine 2 · Fish 7 · Hunt 1/);
  assert.match(menu.other, /Keep Harvest Ville friendly\./, 'not someone else\'s menu');
  assert.strictEqual(menu.own, true, 'the list panel is the usual one again');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// ---------- animal breeds (src/19zz-breeding.js) ----------
test('animal breeds: colours in the pen, a rare one twinkles and gives two, the shop sends a new colour, a RARE chick in the morning report, the Breeds book and its prize, the tour', async () => {
  const save = await makeSave("s.gold = 50000; s.time = 600; s.builds.coop2 = 1; s.builds.barn2 = 1; s.goal = 99; s.wv = C.NEWS_LATEST;" +
    "L.addAnimal(s, 'chicken'); L.addAnimal(s, 'cow'); L.addAnimal(s, 'cow'); L.addAnimal(s, 'pig'); L.addAnimal(s, 'carabao');" +
    "s.brf = []; [3, 2, 0, 3, 3, 2].forEach(function (b, i) { if (b) s.animals[i].br = b; L.markBreed(s, s.animals[i].kind, b); });" +
    "s.animals.forEach(function (a) { a.love = 60; }); s.animals[0].fed = 1;");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  let s = await state(page);
  assert.deepStrictEqual(s.animals.map((a) => a.kind + ':' + (a.br || 0)), ['chicken:3', 'chicken:2', 'cow:0', 'cow:3', 'pig:3', 'carabao:2']);
  await page.waitForFunction(() => !Farm.world.breedQueue, null, SLOW); // (each colour's picture decoded, then put up)
  const keys = await page.evaluate(() => Farm.world.herd.members.map((m) => m.sprite.texture.key));
  assert.deepStrictEqual(keys, ['animals_br_chicken_3', 'animals_br_chicken_2', 'animals', 'animals_br_cow_3', 'animals_br_pig_3', 'animals_br_carabao_2']);
  // each colour is its own picture (art-src/breeds), with its own shadows, not the animal recoloured
  const pics = await page.evaluate(() => Farm.world.herd.members.map((m) => {
    const img = m.sprite.texture.source[0].image, sh = m.sh.texture;
    return [Object.keys(Farm.images).find((k) => Farm.images[k] === img) || '?', sh.key, Object.keys(Farm.images).find((k) => Farm.images[k] === sh.source[0].image) || '?', m.sprite.alpha, m.sh.alpha];
  }));
  assert.deepStrictEqual(pics, [
    ['breed_chicken_golden', 'animalshade_br_chicken_3', 'breedshade_chicken_golden', 1, 1],
    ['breed_chicken_black', 'animalshade_br_chicken_2', 'breedshade_chicken_black', 1, 1],
    ['animals', 'animalshade', 'animalshade', 1, 1],
    ['breed_cow_highland', 'animalshade_br_cow_3', 'breedshade_cow_highland', 1, 1],
    ['breed_pig_moon', 'animalshade_br_pig_3', 'breedshade_pig_moon', 1, 1],
    ['breed_carabao_albino', 'animalshade_br_carabao_2', 'breedshade_carabao_albino', 1, 1],
  ]);
  // only the colours on this farm are on the GPU (the other six pictures are not)
  assert.deepStrictEqual(await page.evaluate(() => Object.keys(Farm.game.textures.list).filter((k) => /^animals_br_/.test(k)).sort()),
    ['animals_br_carabao_2', 'animals_br_chicken_2', 'animals_br_chicken_3', 'animals_br_cow_3', 'animals_br_pig_3']);
  assert.deepStrictEqual(await page.evaluate(() => Farm.world.herd.members.map((m) => m.rare)), [true, false, false, true, true, true]);
  // they walk in their own colours: the frames keep their numbers
  await page.waitForFunction(() => Farm.world.herd.members.some((m) => m.pose === 'walk'), null, SLOW);
  assert.ok(await page.evaluate(() => Farm.world.herd.members.every((m) => m.sprite.frame.name >= m.def.frame0 && m.sprite.frame.name < m.def.frame0 + 12)));
  // a line-up for the picture
  await page.evaluate(() => {
    const T = Farm.Config.TILE;
    Farm.world.herd.members.forEach((m, i) => { m.x = m.tx = (4.5 + (i % 3) * 1.6) * T; m.y = m.ty = (33.6 + Math.floor(i / 3) * 1.5) * T; m.wait = 1e9; m.flip = i % 2 === 0; });
  });
  await teleport(page, 6, 31, 'down');
  await page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Image' && o.texture.key === 'items' && o.frame.name === Farm.Config.ICON.star && o.depth === 23), null, SLOW);
  await shot(page, 'breeds-pen');
  // the golden hen: her breed in her info, and two eggs in the morning
  await page.evaluate(() => { const s = Farm.session.state; s.animals[0].pet = 1; s.animals[0].fed = 1; s.animals[0].brushed = 1; });
  await meetAnimal(page, 0, 5, 33);
  assert.strictEqual(await actionLabel(page), s.animals[0].name);
  await tapAction(page);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Golden Hen \(rare: 2 a day\)/);
  // a chick on the way, and the next one is rare (the dice are loaded for the test)
  await page.evaluate(() => { const s = Farm.session.state; s.inc = 1; window.__r = Farm.Logic.brRandom; let n = 0; Farm.Logic.brRandom = () => [0.9, 0.5, 0.01, 0][n++ % 4]; });
  const report = await nextMorning(page);
  assert.match(report, /A RARE chick hatched! Say hello to [A-Za-z ]+[0-9]*, a Golden Hen!/);
  assert.match(report, /2 Large Egg|2 Egg/);
  await page.evaluate(() => { Farm.Logic.brRandom = window.__r; });
  s = await state(page);
  assert.strictEqual(s.animals.length, 7);
  assert.strictEqual(s.animals[6].br, 3);
  const eggs = count(s, 'egg_l') + count(s, 'egg');
  assert.ok(s.animals[0].ready && s.animals[0].bx === 1, 'her egg and her bonus: ' + JSON.stringify(s.animals[0]));
  await page.evaluate(() => Farm.world.herd.members.forEach((m, i) => { if (i) { m.x = m.tx = m.y = m.ty = 0; m.wait = 1e9; } })); // (the others out of the way)
  await meetAnimal(page, 0, 5, 33);
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(count(s, 'egg_l') + count(s, 'egg'), eggs + 2, 'a rare hen: two eggs');
  // the shop: a pig in a colour new to you, and the book says so
  await page.evaluate(() => { Farm.session.state.time = 600; Farm.session.state.gold = 50000; });
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  await tapButton(page, 'Animals');
  await tapButton(page, 'Buy 1500G');
  s = await state(page);
  assert.strictEqual(s.animals[7].kind, 'pig');
  assert.strictEqual(s.animals[7].br, undefined, 'the Pink Pig: the first colour not found yet');
  await page.waitForFunction(() => /New in your Breeds book: the Pink Pig! \(2 of 4\)/.test(Farm.ui.toastText.text), null, SLOW);
  await closeAll(page);
  // the potion on a pig: a piglet is on the way
  await page.evaluate(() => { const s = Farm.session.state; s.animals[4].love = 80; Farm.Logic.addItem(s, 'miracle', 1); });
  await hold(page, 'miracle');
  await meetAnimal(page, 4, 6, 33);
  assert.strictEqual(await actionLabel(page), 'Potion');
  await tapAction(page);
  assert.match(await modalText(page), /expecting a piglet!/);
  await closeAll(page);
  // the Breeds book, from the Collection
  await page.evaluate(() => Farm.ui.openCollection());
  assert.match(await modalText(page), /Crop stars[\s\S]*Hunts[\s\S]*Breeds/);
  await shot(page, 'breeds-collection');
  await tapButton(page, 'Breeds');
  let text = await modalText(page);
  assert.match(text, /Breeds book[\s\S]*2 of 4 found/);
  assert.match(text, /Golden Hen[\s\S]*Gives 2 a day/);
  assert.match(text, /\?\?\?[\s\S]*Lily sells it/, 'the Brown Hen: not found yet');
  await shot(page, 'breeds-book-hens');
  await tapButton(page, 'Carabaos');
  text = await modalText(page);
  assert.match(text, /1 of 3 found[\s\S]*White Carabao[\s\S]*Prize: 3,000G \+ Miracle Potion[\s\S]*Find all 3 colours/);
  await shot(page, 'breeds-book-carabaos');
  // every carabao colour: the prize
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.markBreed(s, 'carabao', 0); Farm.Logic.markBreed(s, 'carabao', 1); Farm.ui.closeAll(); Farm.ui.openBreeds('carabao'); });
  const gold = (await state(page)).gold;
  await tapButton(page, 'Claim');
  await page.waitForFunction((g) => Farm.session.state.gold === g + 3000, gold, SLOW);
  assert.match(await modalText(page), /Claimed\. Well done!/);
  await shot(page, 'breeds-book-claimed');
  await closeAll(page);
  // the tour: on the farm, once
  await page.evaluate(() => { window.gameHost.quiet = false; Farm.world.travel('town', 'from_farm'); });
  await waitMap(page, 'town');
  for (let i = 0; i < 6 && await page.evaluate(() => Farm.ui.modals.length); i++) { await closeAll(page); await page.waitForTimeout(600); }
  await page.evaluate(() => Farm.world.travel('farm', 'from_town'));
  await waitMap(page, 'farm');
  const top = async () => ((await page.evaluate(() => Farm.ui.modals.length)) ? modalText(page) : '');
  for (let i = 0; i < 60 && !/ANIMAL BREEDS/.test(await top()); i++) {
    if (await top()) await closeAll(page);
    await page.waitForTimeout(500);
  }
  assert.match(await modalText(page), /ANIMAL BREEDS[\s\S]*come in colours now/);
  await shot(page, 'tour-breeds-1');
  for (let k = 0; k < 3; k++) { await frames(page, 4); await tapButton(page, 'Next'); if (k === 0) await shot(page, 'tour-breeds-2'); }
  await shot(page, 'tour-breeds-last');
  await tapButton(page, 'Got it');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'breeds_tour')), true);
  // and they all come back from the save
  const saved = await page.evaluate(() => { Farm.world.save(); return JSON.parse(window.gameHost.saves[window.gameHost.saves.length - 1]).br; });
  assert.deepStrictEqual(saved[0].slice(0, 8), [3, 2, 0, 3, 3, 2, 3, 0]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Willowbrook Station (src/19zz-town.js, src/19zz-town-ui.js; rules test/station.test.js). Run alone:
// node build.js && node --test --test-timeout=900000 --test-name-pattern="Willowbrook Station" test/e2e.test.js
test('Willowbrook Station: its tour, a cargo order filled crate by crate, the Town Level, the train rolling in with visitors, a wish given, and the train leaving with them (owner, 4 Nov)', async () => {
  const WHEN = [2026, 4, 1, 10, 50];
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.gold = 5000;', WHEN);
  const { page, problems, context } = await open(save, WHEN);
  await closeAll(page);
  const waitText = (re) => page.waitForFunction((src) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    if (!m) return false;
    const out = [];
    const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    walk(m.c.list);
    return new RegExp(src).test(out.join(' | '));
  }, re.source, SLOW);
  await go(page, 'town', 'from_farm');
  // the station, its rails and the cargo stand where the map says, solid; the lane and the platform are open
  assert.deepStrictEqual(await page.evaluate(() => {
    const w = Farm.world;
    return { tw: !!w.tw, lane: w.walkable(39, 8), door: w.walkable(39, 6), station: w.walkable(39, 5), rails: w.walkable(45, 3), platform: w.walkable(45, 5), cargo: w.walkable(47, 4), order: !!Farm.session.state.tw.o };
  }), { tw: true, lane: true, door: true, station: false, rails: false, platform: true, cargo: false, order: true });
  // the painted pictures show (art-src/station/, tools/art/station-import.js), not the old drawn stand-ins
  assert.deepStrictEqual(await page.evaluate(() => {
    const w = Farm.world, keys = w.children.list.map((o) => o.texture && o.texture.key);
    return {
      station: keys.includes('tw_station'), rails: keys.includes('tw_rails'), train: w.tw.train.texture.key,
      crates: w.tw.crates.map((c) => c.img.texture.key + ':' + c.img.frame.name).join(' '),
      visitors: w.villagers.tourists.map((v) => v.sprite.texture.key + ':' + v.sprite.frame.name).join(' '),
      drawn: ['tw-station', 'tw-rails', 'tw-train', 'tw-crate', 'tw-crate-full', 'tw-pallet'].filter((k) => w.textures.exists(k)),
    };
  }), {
    station: true, rails: true, train: 'tw_train', crates: 'tw_crates:0 tw_crates:0 tw_crates:0 tw_crates:0 tw_crates:2 tw_crates:2', // (4 crates, 2 empty pallets)
    visitors: 'tw_people:0 tw_people:9 tw_people:18 tw_people:27 tw_people:36', drawn: [],
  });
  // the tour opens the first time you walk up to the station (never while quiet)
  await teleport(page, 39, 7, 'up');
  await page.waitForTimeout(1800);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0, 'quiet: no tour');
  await teleport(page, 30, 12, 'up');
  await page.evaluate(() => { window.gameHost.quiet = false; });
  for (let quietFor = 0, i = 0; quietFor < 3 && i < 30; i++) {
    await page.waitForTimeout(800);
    if (await page.evaluate(() => Farm.ui.modals.length)) { await closeAll(page); quietFor = 0; } else quietFor++;
  }
  await teleport(page, 39, 7, 'up');
  for (let i = 0; i < 60; i++) { // (the day's other pop-ups may still come first: closed as they come)
    await page.waitForTimeout(500);
    const top = await page.evaluate(() => Farm.ui.modals.length);
    if (top && /THE TRAIN STATION/.test(await modalText(page))) break;
    if (top) await closeAll(page);
  }
  await waitText(/THE TRAIN STATION.*up the lane by the Post Office.*7 AM, 11 AM, 3 PM and 7 PM.*Skip.*Next/);
  await shot(page, 'station-tour-1');
  for (const k of [2, 3, 4]) { await tapButton(page, 'Next'); await page.waitForTimeout(900); await shot(page, 'station-tour-' + k); }
  await waitText(/Each Town Level brings something new.*Got it/);
  await tapButton(page, 'Got it');
  await page.evaluate(() => { window.gameHost.quiet = true; });
  assert.strictEqual(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'station_tour')), true);
  // the station: its Cargo
  await teleport(page, 39, 6, 'up');
  assert.strictEqual(await actionLabel(page), 'Station');
  await shot(page, 'station-front');
  await tapAction(page);
  await waitText(/Willowbrook Station.*Fill them by 10:50 AM tomorrow.*Fill all 4 crates.*Prize/);
  await shot(page, 'station-cargo');
  const o = await page.evaluate(() => {
    const s = Farm.session.state;
    Farm.Logic.addItem(s, s.tw.o.crates[0].id, s.tw.o.crates[0].n);
    Farm.ui.closeAll();
    Farm.ui.openStation('cargo');
    return JSON.parse(JSON.stringify(s.tw.o));
  });
  await frames(page, 3);
  const gold0 = (await state(page)).gold;
  await tapButton(page, 'Fill');
  await waitText(/1 \/ 4[\s\S]*FILLED/);
  let s = await state(page);
  assert.strictEqual(s.tw.o.crates[0].done, 1);
  assert.strictEqual(s.gold, gold0 + o.crates[0].pay);
  assert.strictEqual(s.tw.p, 2);
  // the other three, and the prize
  await page.evaluate(() => { const s = Farm.session.state; s.tw.o.crates.forEach((c, i) => { if (i) Farm.Logic.addItem(s, c.id, c.n); }); Farm.ui.closeAll(); Farm.ui.openStation('cargo'); });
  await frames(page, 3);
  await shot(page, 'station-cargo-ready');
  for (const k of [2, 3]) { await tapButton(page, 'Fill'); await waitText(new RegExp(k + ' / 4')); }
  await tapButton(page, 'Fill');
  await waitText(/CARGO COMPLETE!.*Sunbeam.*Pet Meal.*Town points.*Hooray!/);
  await shot(page, 'station-cargo-complete');
  s = await state(page);
  assert.ok(s.tw.o.full && s.tw.done === 1 && s.stars >= o.prize.stars);
  await tapButton(page, 'Hooray!');
  await waitText(/TOWN LEVEL 2!.*each shelf holds 30.*\+500G/);
  await shot(page, 'station-level-2');
  await tapButton(page, 'OK');
  s = await state(page);
  assert.strictEqual(s.tw.p, 4 * 2 + 10);
  assert.strictEqual(s.gold, gold0 + o.crates.reduce((a, c) => a + c.pay, 0) + o.prize.gold + 500);
  assert.strictEqual(await page.evaluate(() => Farm.world.tw.level.text), 'Lv 2');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openStation('cargo'); });
  await waitText(/All filled! The 11:00 AM train takes them away/);
  await closeAll(page);
  // 11 AM: the train rolls in, takes the crates, brings the next order, and its visitors step off
  await teleport(page, 44, 5, 'right');
  await setClock(page, [2026, 4, 1, 11, 0]);
  await page.waitForFunction(() => Farm.world.tw.shown && Farm.world.tw.moving === 'in', null, SLOW);
  await page.waitForTimeout(1600);
  await shot(page, 'station-train-arriving');
  await page.waitForFunction(() => Farm.world.tw.shown && !Farm.world.tw.moving, null, SLOW);
  s = await state(page);
  assert.ok(s.tw.o && s.tw.o.no === 1 && !s.tw.o.full, 'a new order');
  assert.ok(s.tw.o.crates.every((c) => !c.done));
  await shot(page, 'station-train-in');
  await page.waitForFunction(() => Farm.world.villagers.tourists.filter((v) => v.visible).length === 2, null, SLOW);
  await page.waitForTimeout(1200);
  await shot(page, 'station-visitors-off');
  // they walk in their own painted sheets, the villagers' walk cut from them
  assert.ok(await page.evaluate(() => Farm.world.villagers.tourists.filter((v) => v.visible).every((v) => v.sprite.texture.key === 'tw_people' &&
    Farm.game.anims.get('v-' + v.key + '-side').frames.every((f) => f.textureKey === 'tw_people'))));
  // a visitor wishes for something: talk, and Give
  const wish = await page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state, L = Farm.Logic, T = Farm.Config.TILE;
    const wish = L.twWishes(s)[0], v = w.villagers.tourists.find((t) => t.who === wish.who);
    L.addItem(s, wish.id, wish.n);
    v.dwell = 1e9;
    w.villagers.put(v, 10.5 * T, 18.6 * T, true);
    w.setFeet(10.5 * T, 19.6 * T);
    w.dir = 'up';
    w.idle();
    return { ...wish, name: v.def.name };
  });
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Give');
  await shot(page, 'station-visitor-bubble');
  await tapAction(page);
  await waitText(new RegExp(wish.name.toUpperCase() + '[\\s\\S]*' + wish.n + ' [\\s\\S]*' + wish.gold + 'G[\\s\\S]*You have ' + wish.n + '[\\s\\S]*Give'));
  await shot(page, 'station-visitor-wish');
  const gold1 = (await state(page)).gold;
  await tapButton(page, 'Give');
  await frames(page, 4);
  s = await state(page);
  assert.strictEqual(s.gold, gold1 + wish.gold);
  assert.strictEqual(s.tw.v.find((w) => w.who === wish.who).done, 1);
  assert.strictEqual(s.tw.p, 18 + 3);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openStation('visitors'); });
  await waitText(/In town until 1:00 PM.*Salamat/);
  await shot(page, 'station-visitors-tab');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openStation('town'); });
  await waitText(/Town Level 2.*Level 3 brings.*Flags over the plaza/);
  await shot(page, 'station-town-tab');
  // Town Level 2: the stall's shelves take 30
  await page.evaluate(() => { Farm.ui.closeAll(); const s = Farm.session.state; Farm.Logic.addItem(s, 'turnip', 30); Farm.ui.openSellOptions(0, s.inv.findIndex((x) => x && x.id === 'turnip'), 30); });
  await frames(page, 3);
  assert.match(await modalText(page), /Put on a shelf/);
  assert.doesNotMatch(await modalText(page), /fit on one/);
  await closeAll(page);
  // 12:50 the visitors walk back to the platform; at 1 PM the train leaves with them
  await teleport(page, 44, 5, 'right');
  await setClock(page, [2026, 4, 1, 12, 50]);
  await page.waitForFunction(() => Farm.world.villagers.tourists.every((v) => !v.visible || v.leaving), null, SLOW);
  await setClock(page, [2026, 4, 1, 13, 0]);
  await page.waitForFunction(() => Farm.world.tw.moving === 'out', null, SLOW);
  await page.waitForTimeout(1800);
  await shot(page, 'station-train-leaving');
  await page.waitForFunction(() => !Farm.world.tw.shown && Farm.world.villagers.tourists.every((v) => !v.visible), null, SLOW);
  assert.deepStrictEqual(await page.evaluate(() => Farm.Logic.twWishes(Farm.session.state)), []);
  // saved: all of it is there after closing the game
  const saved = await page.evaluate(() => { Farm.world.save(); return window.gameHost.saves.slice(-1)[0]; });
  const again = await open(JSON.parse(saved), [2026, 4, 1, 13, 5]);
  const s2 = await state(again.page);
  assert.deepStrictEqual([s2.tw.p, s2.tw.done, s2.tw.o.no, s2.tw.o.crates.length], [21, 1, 1, 4]);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// ---------- farm tech (src/19zz-farmtech.js, rules 01-logicZ-farmtech.js) ----------
test('farm tech: Bram makes a sprinkler, fertilizer from Lily, the sprinkler waters a fertilized patch, a Gold crop shows its star', async () => {
  const save = await makeSave(`s.time = 600; s.gold = 20000;
    for (let y = 15; y <= 17; y++) for (let x = 9; x <= 11; x++) s.soil[y * 64 + x] = { w: 0, c: null, p: 0, r: 0 };
    L.addItem(s, 'ore_copper', 3); L.addItem(s, 'sprinkler_silver', 1); L.addItem(s, 'fert_rich', 1); L.addItem(s, 'seed_turnip', 1);
    s.inv[3] = { id: 'turnip', n: 2, q: 2 }; s.inv[4] = { id: 'tomato', n: 1, q: 1 };`);
  const { page, problems, context } = await open(save);
  await closeAll(page);
  const idx = (x, y) => y * W + x;
  let s = await state(page);
  assert.deepStrictEqual([s.inv[3].q, s.inv[4].q], [2, 1], 'the save kept the Silver and Gold slots');
  assert.deepStrictEqual(await page.evaluate(() => [Farm.ui.slots[3].star.visible, Farm.ui.slots[4].star.visible, Farm.ui.slots[2].star.visible]), [true, true, false], 'a star on the toolbar');

  // Bram's Forge: the three sprinklers after the tools; Make one
  // (taller cards since 5 Nov 2026: the sprinklers are on a later page; they go together on the last one)
  let fp = 0;
  for (; fp < 6; fp++) {
    await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openForge(p); }, fp);
    await frames(page, 3);
    if (/Copper Sprinkler/.test(await modalText(page))) break;
  }
  assert.match(await modalText(page), /Copper Sprinkler[\s\S]*Silver Sprinkler[\s\S]*Gold Sprinkler/);
  await shot(page, 'farmtech-1-forge');
  await tapButton(page, 'Make');
  s = await state(page);
  assert.strictEqual(count(s, 'sprinkler_copper'), 1);
  assert.strictEqual(count(s, 'ore_copper'), 0);
  assert.strictEqual(s.gold, 20000 - 800);
  await closeAll(page);
  // Lily's Supplies: both fertilizers, by 1 or 5
  await page.evaluate(() => Farm.ui.openShop('supplies', 1));
  assert.match(await modalText(page), /Fertilizer[\s\S]*Rich Fertilizer/);
  await shot(page, 'farmtech-2-lily');
  await tapButton(page, 'Buy 5 50G');
  s = await state(page);
  assert.strictEqual(count(s, 'fert'), 5);
  await closeAll(page);

  // Rich Fertilizer on the 3x3, then the Silver Sprinkler in its middle, then seeds: they grow at once
  await hold(page, 'fert_rich');
  await teleport(page, 10, 17, 'up');
  assert.strictEqual(await actionLabel(page), 'Spread');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.soil[idx(9, 15)].f, 2);
  await hold(page, 'sprinkler_silver');
  assert.strictEqual(await actionLabel(page), 'Place');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.soil[idx(10, 16)].sp, 2);
  assert.strictEqual(count(s, 'sprinkler_silver'), 0);
  assert.ok([[9, 15], [11, 17], [10, 17]].every(([x, y]) => s.soil[idx(x, y)].w === 1), 'its 8 tiles are wet');
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.ftSp).length), 1, 'it shows on the farm');
  await hold(page, 'seed_turnip');
  assert.strictEqual(await actionLabel(page), 'Plant');
  await tapAction(page);
  s = await state(page);
  assert.ok(!s.soil[idx(10, 16)].c, 'no seed on the sprinkler');
  assert.ok([[9, 15], [11, 17]].every(([x, y]) => s.soil[idx(x, y)].c === 'turnip' && s.soil[idx(x, y)].w === 1), 'planted, and growing');
  await teleport(page, 10, 19, 'up');
  await frames(page, 4);
  await shot(page, 'farmtech-3-sprinkler');
  // ripe 15 minutes later; picked, the soil is wet again (the sprinkler)
  await advance(page, 16);
  await teleport(page, 9, 18, 'up');
  assert.strictEqual(await actionLabel(page), 'Harvest');
  await tapAction(page);
  s = await state(page);
  assert.ok(!s.soil[idx(9, 17)].c, 'picked');
  assert.strictEqual(s.soil[idx(9, 17)].w, 1, 'wet again');
  assert.ok(!s.soil[idx(9, 17)].f, 'the fertilizer is used up');
  // the sprinkler: tap it to pick it up
  await hold(page, 'hoe');
  await teleport(page, 10, 17, 'up');
  assert.strictEqual(await actionLabel(page), 'Pick up');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(count(s, 'sprinkler_silver'), 1);
  assert.ok(s.soil[idx(10, 16)] && !s.soil[idx(10, 16)].sp, 'the soil stays tilled');
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.ftSp).length), 0);
  // the bag: the Gold turnip's name and star (and all five farm tech pictures, for the screenshot)
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.addItem(s, 'sprinkler_gold', 1); Farm.Logic.addItem(s, 'fert_rich', 1); s.sel = 3; Farm.ui.openInventory(); });
  await frames(page, 3);
  assert.match(await modalText(page), /Gold Turnip[\s\S]*Gold: sells for 10G/);
  await shot(page, 'farmtech-4-bag');
  await closeAll(page);
  // the stall: a Silver tomato sells for its price, with its star
  await page.evaluate(() => Farm.ui.openSellOptions(null, 4));
  const silver = await page.evaluate(() => Farm.Logic.withQuality(1, () => Farm.Logic.instantPrice('tomato', 1)));
  assert.ok(silver > await page.evaluate(() => Farm.Logic.instantPrice('tomato', 1)), 'more than a normal tomato');
  assert.match(await modalText(page), new RegExp('Sell now: ' + silver + 'G'));
  assert.match(await modalText(page), /Silver Tomato/);
  await shot(page, 'farmtech-5-sell');
  await closeAll(page);
  // the tours draw
  for (const [name, steps] of [['sprinkler', 3], ['quality', 3]]) {
    await page.evaluate((n) => Farm.ui.tour(n), name);
    for (let k = 0; k < steps; k++) {
      await frames(page, 4);
      await shot(page, 'farmtech-tour-' + name + '-' + (k + 1));
      await tapButton(page, k < steps - 1 ? 'Next' : 'Got it');
    }
  }
  // saved and reopened: the sprinkler is back in the bag, the Gold turnip still Gold
  const saved = await page.evaluate(() => { Farm.world.save(); return window.gameHost.state; });
  assert.deepStrictEqual(saved.ft.q.slice(0, 2), [3, 2]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('farm tech: the greenhouse from Mira grows a summer melon in spring, watered by itself; its tour', async () => {
  const save = await makeSave(`s.time = 600; s.gold = 20000;
    const gh = C.OUTDOOR.index.greenhouse; L.buyYard(s, gh, 1); L.placeYard(s, Farm.farm(), gh, 24, 20);
    L.addItem(s, 'seed_melon', 2); L.addItem(s, 'hoe', 1);
    for (let x = 24; x <= 27; x++) L.till(s, 21 * 64 + x);`);
  const { page, problems, context } = await open(save);
  await closeAll(page);
  let s = await state(page);
  const GH = await page.evaluate(() => Farm.Config.OUTDOOR.index.greenhouse);
  assert.ok(s.yard.items.some((it) => it.t === GH && it.x === 24 && it.y === 20), 'placed');
  assert.ok(s.soil[21 * W + 25].w, 'its soil is wet');
  // the real pictures: the floor under the soil, the glass frame over the crops (art-src/props, not drawn canvases)
  assert.deepStrictEqual(await page.evaluate((gh) => {
    const w = Farm.world, i = Farm.session.state.yard.items.findIndex((it) => it.t === gh);
    return [w.yardSprites[i].texture.key, w.ftFrames.map((f) => f.texture.key), w.textures.exists('ft-gh-floor') || w.textures.exists('ft-gh-frame')];
  }, GH), ['props/greenhouse_floor', ['props/greenhouse_frame'], false]);
  // Mira's catalog: the Greenhouse under More land, one only
  await page.evaluate(() => Farm.ui.openOutdoor('land', 0));
  assert.match(await modalText(page), /Greenhouse[\s\S]*12000G\. Any crop grows inside in any season[\s\S]*You have one/);
  assert.strictEqual(await page.evaluate((gh) => Farm.yardImg(Farm.ui, gh).key, GH), 'props/ws_greenhouse', 'the whole greenhouse in the list');
  await shot(page, 'farmtech-6-mira');
  await closeAll(page);
  // with a greenhouse, Lily sells every seed: out of season ones after the rest
  await page.evaluate(() => Farm.ui.openShop('seeds', 3));
  assert.match(await modalText(page), /Out of season: for your greenhouse/);
  await shot(page, 'farmtech-8-lily-seeds');
  await closeAll(page);
  // till a tile inside: wet at once
  await hold(page, 'hoe');
  await teleport(page, 25, 23, 'up');
  assert.strictEqual(await actionLabel(page), 'Till');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.soil[22 * W + 25].w, 1);
  // melon seeds in spring: only inside
  await hold(page, 'seed_melon');
  assert.strictEqual(await actionLabel(page), 'Plant');
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.soil[22 * W + 25].c, 'melon');
  assert.strictEqual(s.soil[21 * W + 24].c, 'melon');
  assert.ok(!s.soil[23 * W + 25], 'nothing outside');
  await teleport(page, 25, 24, 'up');
  await frames(page, 4);
  await shot(page, 'farmtech-7-greenhouse');
  await teleport(page, 10, 18, 'up');
  assert.strictEqual(await page.evaluate(() => { const a = Farm.world.resolve(); return a.disabled && /grow only in summer|only grow in Summer/i.test(a.why); }), true, 'out in the field: not in spring');
  for (let k = 0; k < 3; k++) {
    if (!k) await page.evaluate(() => Farm.ui.tour('greenhouse'));
    await frames(page, 4);
    await shot(page, 'farmtech-tour-greenhouse-' + (k + 1));
    await tapButton(page, k < 2 ? 'Next' : 'Got it');
  }
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Lair\'s Fire look: not in the shop until it is yours, then the walk, every tool swing and the Bow in it, for the boy and the girl (5 Nov 2026)', async () => {
  const save = await makeSave('s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST;');
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await page.evaluate(() => { window.__asked = []; const ask = window.gameHost.asset; window.gameHost.asset = function (f, save) { window.__asked.push(f); return ask(f, save); }; });
  // no price yet (the owner's to say): the shop does not offer it, and it is in My looks once the server gives it
  await page.evaluate(() => Farm.ui.drawTailor('shop', 0));
  await frames(page, 3);
  for (let p = 0; p < 3; p++) {
    await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.drawTailor('shop', p); }, p);
    await frames(page, 2);
    assert.ok(!/Lair Fire/.test(await modalText(page)), 'not on sale: not listed (page ' + p + ')');
  }
  await page.evaluate(() => { Farm.Logic.ownLooks(Farm.session.state, ['fire']); Farm.ui.closeAll(); Farm.ui.drawTailor('mine', 0); });
  await frames(page, 3);
  assert.match(await modalText(page), /Lair Fire[\s\S]*Wear/);
  await shot(page, 'fire-look-1-mine');
  await page.evaluate(() => Farm.ui.wearLook('fire'));
  for (const who of ['boy', 'girl']) {
    if (who === 'girl') { await page.evaluate(() => { Farm.session.state.look = 'girl'; Farm.world.applyLook(); }); }
    const key = 'look_fire_' + who;
    await page.waitForFunction((key) => Farm.world.player.texture.key === key, key, SLOW);
    // its real picture: 15 frames of the farmer's own layout (9 walking, 6 swinging)
    assert.strictEqual(await page.evaluate((key) => Farm.world.textures.get(key).frameTotal - 1, key), 15);
    await page.evaluate(() => { Farm.input.jx = 1; });
    await page.waitForTimeout(400);
    assert.match(await page.evaluate(() => Farm.world.player.anims.currentAnim && Farm.world.player.anims.currentAnim.key), new RegExp(key));
    await page.evaluate(() => { Farm.input.jx = 0; Farm.world.idle(); });
    await frames(page, 2);
    // every swing, every way: the raise and the strike come from the look's own frames
    for (const dir of ['down', 'up', 'left', 'right']) {
      const poses = await page.evaluate((dir) => new Promise((done) => {
        const w = Farm.world, out = [];
        w.dir = dir; w.idle();
        w.animateUse(Farm.Config.ICON.hoe, 'swing');
        out.push([w.player.texture.key, w.player.frame.name]);
        setTimeout(() => { out.push([w.player.texture.key, w.player.frame.name]); done(out); }, 200);
      }), dir);
      poses.forEach(([k, f]) => { assert.strictEqual(k, key, dir); assert.ok(f >= 9 && f <= 14, dir + ' frame ' + f); });
      if (dir === 'left') await shot(page, 'fire-look-2-swing-' + who);
      await page.waitForFunction(() => !(Farm.world.acting > 0), null, SLOW);
    }
  }
  // the Bow: each way draws from the look's archer sheet
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 20); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  await go(page, 'pulag', 'from_town');
  for (const who of ['girl', 'boy']) {
    // (the archer sheet is asked for on the way into a wild map, or by the first shot: here, the look was just changed)
    await page.evaluate((who) => { Farm.session.state.look = who; Farm.world.applyLook(); Farm.lookReady('fire', who, true); }, who);
    const arch = 'look_fire_' + who + '_archer';
    await page.waitForFunction((arch) => Farm.world.textures.exists(arch), arch, SLOW);
    for (const dir of ['down', 'up', 'left', 'right']) {
      await page.waitForFunction(() => !Farm.world.shot && Farm.world.wildArrows.length === 0, null, SLOW);
      const k = await page.evaluate((dir) => { const w = Farm.world; w.wild.next = 1e9; w.wild.animals.forEach((a) => { a.x = a.y = -9999; }); w.dir = dir; w.idle(); w.shoot(); return w.shot.body.texture.key; }, dir);
      assert.strictEqual(k, arch, who + ' ' + dir);
      if (dir === 'right') { await page.waitForTimeout(250); await shot(page, 'fire-look-3-bow-' + who); }
    }
  }
  assert.deepStrictEqual((await page.evaluate(() => window.__asked)).filter((f) => /fire/.test(f)).sort(),
    ['looks/v1/fire-boy', 'looks/v1/fire-boy-archer', 'looks/v1/fire-girl', 'looks/v1/fire-girl-archer']);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Fire look from Kanor: on his Buy tab at 500,000G and the Lair\'s best, then in My looks; gone from his list once yours (owner, 5 Nov)', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.wild.n = 50; s.gold = 500000; L.addItem(s, 'ember_shard', 80); L.addItem(s, 'bakunawa_scale', 4); L.addItem(s, 'bungisngis_tooth', 2);");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  const findPage = async () => {
    for (let p = 0; p < 6; p++) {
      await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openKanor('buy', p); }, p);
      await frames(page, 2);
      if (/Lair Fire look/.test(await modalText(page))) return p;
    }
    return -1;
  };
  const at = await findPage();
  assert.ok(at >= 0, 'Kanor lists the Fire look');
  assert.match(await modalText(page), /Lair Fire look[\s\S]*1 in 10 from a Bakunawa\. Or 80 Ember Shards \(80\), 4 Scales \(4\), 2 Teeth \(2\)[\s\S]*500,000G/);
  await shot(page, 'fire-look-kanor');
  await tapButton(page, '500,000G');
  await page.waitForFunction(() => /The Lair Fire look is yours! Wear it from Looks\./.test(Farm.ui.toastText.text), null, SLOW);
  const s = await state(page);
  assert.strictEqual(s.gold, 0);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.ownsLook(Farm.session.state, 'fire')), true);
  assert.strictEqual(await findPage(), -1, 'not offered again');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.drawTailor('mine', 0); });
  await frames(page, 3);
  assert.match(await modalText(page), /Lair Fire[\s\S]*Wear/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('downloads by themselves: a few seconds after the game opens, every pack comes down onto the phone, one after another, the badge showing it (owner, 5 Nov)', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST;");
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage(), problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([s, now]) => {
    window.__now = now;
    window.__asked = [];
    window.gameHost = { state: s, quiet: true, autoPacks: true, saves: [], save(x) { this.saves.push(JSON.stringify(x)); this.state = x; }, now: () => window.__now, here: [] };
    window.gameHost.asset = function (f, save) { window.__asked.push([f, save]); setTimeout(function () { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); }, 60); };
  }, [save, at(START)]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  assert.deepStrictEqual(await page.evaluate(() => ['wild', 'looks', 'party'].map((p) => Farm.packOnPhone(p))), [false, false, false], 'nothing on the phone yet');
  assert.strictEqual(await page.evaluate(() => window.__asked.length), 0, 'not straight away: the farm opens first');
  await page.waitForFunction(() => Farm.anyDownloading() && Farm.ui.packBadge.visible, null, SLOW);
  await shot(page, 'packs-auto-badge');
  await page.waitForFunction(() => ['wild', 'looks', 'party'].every((p) => Farm.packOnPhone(p)) && !Farm.anyDownloading(), null, { timeout: 180000 });
  const asked = await page.evaluate(() => window.__asked);
  assert.ok(asked.length > 0 && asked.every((a) => a[1] === true), 'onto the phone only, not into the page');
  assert.strictEqual(await page.evaluate(() => Farm.packReady('wild')), false, 'the Wild Lands go into the page when you go there');
  assert.strictEqual(await page.evaluate(() => Farm.ui.packBadge.visible), false, 'the badge goes when it is all done');
  await page.evaluate(() => Farm.ui.openDownloads());
  await frames(page, 3);
  const text = await modalText(page);
  assert.ok(!/Get all/.test(text) && (text.match(/On your phone/g) || []).length === 3, text);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test("players' ideas (5 Nov 2026): a placed lamp glows at night; Drop in the Bag and pick it up again; Craft at Mira's; Mira's two jobs", async () => {
  const save = await makeSave(`
    s.gold = 50000; s.lumber = 300; s.stone = 300;
    L.addItem(s, 'tulip', 4); L.addItem(s, 'gumamela', 2); L.addItem(s, 'turnip', 5);
    s.yard.bag[C.OUTDOOR.index.lamp] = 1;
  `);
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  // a Lamp Post on the farm: a glow, lit at night
  const placed = await page.evaluate(() => {
    const L = Farm.Logic, s = Farm.session.state, t = Farm.Config.OUTDOOR.index.lamp, f = Farm.farm();
    const spot = L.yardFindSpot(s, f, t, 14, 9);
    const i = L.placeYard(s, f, t, spot.x, spot.y);
    Farm.world.renderYard();
    return typeof i === 'number';
  });
  assert.ok(placed);
  await setClock(page, [2026, 4, 1, 21, 30]);
  await page.evaluate(() => Farm.ui.refresh());
  await frames(page, 3);
  const glow = await page.evaluate(() => ({ n: Farm.world.yardGlows.length, a: Farm.world.yardGlows[0] && Farm.world.yardGlows[0].alpha }));
  assert.strictEqual(glow.n, 1, 'the lamp has a glow');
  assert.ok(glow.a > 0.5, 'lit at night: ' + glow.a);
  await shot(page, 'players-1-lamp-night');
  await setClock(page, [2026, 4, 1, 11, 0]);
  await page.evaluate(() => Farm.ui.refresh());
  await frames(page, 3);
  assert.ok(await page.evaluate(() => Farm.world.yardGlows[0].alpha) < 0.05, 'dark by day');

  // What's new: watching the players' tour with Show me counts as seen, so the first Bag open does not play it again
  // (found on the OPPO, 5 Nov 2026)
  const unseen = await page.evaluate(() => {
    const s = Farm.session.state, i = Farm.Config.TIPS.map((t) => t.key).indexOf('players_tour'), k = i < 31 ? 'tips' : 'tq', b = i < 31 ? i : i - 31;
    s[k] = (s[k] || 0) & ~(1 << b);
    return !Farm.Logic.tipSeen(s, 'players_tour');
  });
  assert.ok(unseen, 'the tip is unseen for this check');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openNews(0, null); });
  await frames(page, 3);
  {
    const row = await page.evaluate(() => { const out = []; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return out; });
    const nth = row.slice(0, row.indexOf('Your ideas: new seeds')).filter((t) => t === 'Show me').length;
    await tapButton(page, 'Show me', nth);
  }
  assert.match(await modalText(page), /NEW: YOUR IDEAS/);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'players_tour')), true, 'seen once watched');
  await tapButton(page, 'Skip');
  await closeAll(page);

  // Drop: hold the turnips, Bag, Drop, Drop 5
  await teleport(page, 12, 12, 'down');
  await hold(page, 'turnip');
  await page.evaluate(() => Farm.ui.openInventory());
  await frames(page, 3);
  await shot(page, 'players-2-bag-drop');
  await tapButton(page, 'Drop');
  assert.match(await modalText(page), /DROP IT\?[\s\S]*disappears in 5 minutes/);
  await tapButton(page, 'Drop 5');
  await frames(page, 3);
  assert.strictEqual(count(await state(page), 'turnip'), 0, 'out of the bag');
  assert.strictEqual(await page.evaluate(() => Farm.ground.mine.length), 1);
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.groundImgs).length), 1, 'on the ground');
  await shot(page, 'players-3-dropped');
  // step off, then back onto it: back in the bag
  const at2 = await page.evaluate(() => { const d = Farm.ground.mine[0], T = Farm.Config.TILE; return [d.x / T, d.y / T]; });
  await teleport(page, 12, 16, 'down');
  await page.waitForFunction(() => !Farm.ground.mine[0].away, null, SLOW);
  await page.evaluate(([x, y]) => { Farm.world.setFeet(x * Farm.Config.TILE, y * Farm.Config.TILE); }, at2);
  await page.waitForFunction(() => !Farm.ground.mine.length, null, SLOW);
  assert.strictEqual(count(await state(page), 'turnip'), 5, 'picked up again');

  // Craft at Mira's: the first row of her Outdoor page
  let found = false;
  for (let pg = 0; pg < 4 && !found; pg++) {
    await page.evaluate((pg) => { Farm.ui.closeAll(); Farm.ui.openOutdoor(null, pg); }, pg);
    await frames(page, 3);
    found = /Craft it yourself/.test(await modalText(page));
  }
  assert.ok(found, 'Craft it yourself is in Mira\'s Outdoor catalog');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openCraft(0); });
  await frames(page, 3);
  assert.match(await modalText(page), /Flower Bed[\s\S]*Needs 4 Tulip \(4\), 2 Gumamela \(2\)/);
  await shot(page, 'players-4-craft');
  const bed = await page.evaluate(() => Farm.Config.OUTDOOR.index.flower_bed);
  const before = await page.evaluate((b) => Farm.session.state.yard.bag[b] || 0, bed);
  await tapButton(page, 'Craft', 0);
  assert.strictEqual(await page.evaluate((b) => Farm.session.state.yard.bag[b] || 0, bed), before + 1, 'a Flower Bed in yard storage');
  assert.strictEqual(count(await state(page), 'tulip'), 0);
  await closeAll(page);

  // Mira: two jobs, both shown as being built
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.startBuild(s, 'kitchen'); L.startBuild(s, 'coop2'); Farm.ui.openWoodshop('build', 0); });
  await frames(page, 3);
  const text = await modalText(page);
  assert.strictEqual((text.match(/Mira is building it/g) || []).length, 2, text);
  await shot(page, 'players-5-two-jobs');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test("the forge: each row is named after the upgrade you get, and everything it takes is a chip, Boar Tusks too (owner, 5 Nov 2026)", async () => {
  const save = await makeSave(`s.tools.hammer = 2; s.gold = 9000; L.addItem(s, 'ore_gold', 8);`);
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  let text = '';
  for (let p = 0; p < 6 && !/Gold Hammer/.test(text); p++) {
    await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openForge(p); }, p);
    await frames(page, 3);
    text = await modalText(page);
  }
  assert.match(text, /Upgrade to Gold Hammer \| Breaks a 3 x 5 patch at once/);
  assert.ok(!/Also needs/.test(text), 'nothing hidden in the text');
  const tusk = await page.evaluate(() => Farm.Logic.upgradeCost(Farm.session.state, 'hammer').needs);
  assert.ok(tusk && tusk.length, 'the Gold Hammer takes a hunt\'s goods');
  const names = await page.evaluate((t) => t.map(([id, n]) => (n > 1 ? n + ' ' : '') + Farm.Config.ITEMS[id].name), tusk);
  names.forEach((nm) => assert.ok(text.includes('| ' + nm), nm + ' has its chip: ' + text));
  await shot(page, 'forge-gold-hammer');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Owner, 5 Nov 2026 (after e29, a screenshot from the Lair): "i was attacked and pushed back to the edge and now i am
// stucked". A charge's bump moved the farmer by the middle of the feet only, so it could leave the feet half inside the
// wall at the edge of a floor, and there the farmer could not walk out.
test('the Lair: a charge that bumps you against the wall at the edge of the floor never leaves you stuck in it', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.map = 'magayon'; s.wild.n = 50; s.energy = 900; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 40); s.sel = s.inv.findIndex((x) => x && x.id === 'bow');");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await waitMap(page, 'magayon');
  await page.evaluate(() => Farm.world.travel('lair', 'entrance', 1));
  await page.waitForFunction(() => Farm.world.mapKey === 'lair' && Farm.session.lairFloor === 1 && !Farm.world.busy && Farm.world.player.active && Farm.world.wild && Farm.world.wild.animals.length, null, SLOW);
  await closeAll(page);
  const T = 256;
  // the farmer just above the floor's bottom wall (row 17), something charging in from above
  const hit = await page.evaluate(([T]) => {
    const w = Farm.world, a = w.wild.animals[0];
    w.setFeet(12.5 * T, 16.3 * T);
    for (let k = 0; k < 3; k++) {
      const f = w.feet();
      a.x = f.x; a.y = f.y - 0.4 * T; a.cool = 0;
      w.wildHit(a);
    }
    a.x = 3 * T; a.y = 5 * T; a.vx = a.vy = 0; a.cool = 99999; a.mode = 'walk';
    const f = w.feet(), b = w.player.body;
    return { y: f.y / T, bottom: (b.y + b.height) / T };
  }, [T]);
  assert.ok(hit.bottom <= 17 + 1e-6, 'the bump stops at the wall: feet bottom ' + hit.bottom.toFixed(3) + ' (the wall starts at 17)');
  // and the farmer walks away: up, then left
  for (const [jx, jy] of [[0, -1], [-1, 0]]) {
    const from = await page.evaluate(() => Farm.world.feet());
    await page.evaluate(([jx, jy]) => { Farm.input.jx = jx; Farm.input.jy = jy; }, [jx, jy]);
    await page.waitForFunction(([fx, fy, jx, jy]) => { const f = Farm.world.feet(); return (jx ? Math.abs(f.x - fx) : Math.abs(f.y - fy)) > 0.6 * 256; }, [from.x, from.y, jx, jy], { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
    const to = await page.evaluate(() => Farm.world.feet());
    assert.ok(jx ? Math.abs(to.x - from.x) > 0.6 * T : from.y - to.y > 0.6 * T, 'walked ' + (jx ? 'left' : 'up') + ' from the wall');
  }
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Owner, 5 Nov 2026: "i can move left or right but i cannot go up going to door" — deep in the Lair's bottom wall the
// farmer could walk along it but never out. Inside a wall, the farmer steps out to the nearest open tile.
test('the Lair: a farmer found deep inside the bottom wall is back on the floor at once, and walks up to the door', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.map = 'magayon'; s.wild.n = 50; s.energy = 900; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 40); s.sel = s.inv.findIndex((x) => x && x.id === 'bow');");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await waitMap(page, 'magayon');
  await page.evaluate(() => Farm.world.travel('lair', 'entrance', 1));
  await page.waitForFunction(() => Farm.world.mapKey === 'lair' && Farm.session.lairFloor === 1 && !Farm.world.busy && Farm.world.player.active && Farm.world.wild && Farm.world.wild.animals.length, null, SLOW);
  await closeAll(page);
  await page.evaluate(() => { Farm.world.wild.animals.forEach((x) => { x.x = 3 * 256; x.y = 5 * 256; x.cool = 1e9; x.mode = 'walk'; x.vx = x.vy = 0; }); });
  await page.evaluate(() => Farm.world.setFeet(12.5 * 256, 17.8 * 256)); // (where the owner's farmer stood)
  await page.waitForFunction(() => Farm.world.feet().y < 17 * 256, null, { timeout: 5000 }).catch(() => {});
  const back = await page.evaluate(() => Farm.world.feet().y / 256);
  assert.ok(back < 17, 'out of the wall: feet at row ' + back.toFixed(2));
  const from = await page.evaluate(() => Farm.world.feet());
  await page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = -1; });
  await page.waitForFunction((fy) => fy - Farm.world.feet().y > 2 * 256, from.y, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
  const to = await page.evaluate(() => Farm.world.feet());
  assert.ok(from.y - to.y > 2 * 256, 'walked up ' + ((from.y - to.y) / 256).toFixed(2) + ' tiles');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Owner, 5 Nov 2026: "need improvement specially on long chat, even in chat box cant see it" — the box and the Chat
// panel cut every line to one row with "…". Now a long line wraps onto more rows; every word shows, inside the box.
test('chat: a long line shows every word in the small box and in the Chat panel, on more rows, never cut', async () => {
  const { page, problems, context } = await open(null);
  await closeAll(page);
  const long = 'Meet me at the plaza after you water your crops please okay ka';
  const said = await page.evaluate((long) => {
    const O = Farm.Online, now = Date.now(), C = Farm.Config;
    O.chatLog.push({ id: 'a', name: 'Selene', text: 'Hi!', t: now - 2000 });
    O.chatLog.push({ id: 'b', name: 'Dear Jen', text: long.slice(0, C.CHAT.max), t: now - 1000 });
    for (let i = 0; i < 9; i++) O.chatLog.push({ id: 'a', name: 'Selene', text: 'Line ' + i + ' of a few more words here', t: now - 50000 });
    O.chatLog.push({ id: 'b', name: 'Dear Jen', text: long.slice(0, C.CHAT.max), t: now });
    const ui = Farm.ui;
    ui.drawChatBox();
    const boxTexts = ui.chatBox.list.filter((o) => o.text != null), bg = ui.chatBox.list[0];
    const inBox = boxTexts.every((o) => o.x + o.width <= 196 + 1);
    const box = boxTexts.map((o) => o.text).join(' ');
    ui.openSay(0);
    const modal = ui.modals[ui.modals.length - 1].c;
    const all = []; const walk = (c) => (c.list || []).forEach((o) => { if (o.type === 'Text') all.push(o); walk(o); });
    walk(modal);
    const W = Farm.UI_CONST.W, inPanel = all.filter((o) => /plaza|crops|okay|water|please|after/.test(o.text)).every((o) => o.x + o.width <= W - 38);
    return { box, inBox, panel: all.map((o) => o.text).join(' '), inPanel, max: C.CHAT.max, rows: boxTexts.length };
  }, long);
  const want = long.slice(0, said.max).trim().split(' ');
  for (const w of want) {
    assert.ok(said.box.split(/\s+/).includes(w), 'box shows "' + w + '": ' + said.box);
    assert.ok(said.panel.split(/\s+/).includes(w), 'panel shows "' + w + '": ' + said.panel);
  }
  assert.ok(!/…/.test(said.box) && !/…/.test(said.panel), 'nothing cut');
  // the box holds the newest lines in a row: an older one never shows while a newer one is left out
  assert.ok(!/Selene: Hi!/.test(said.box) || (said.box.match(/Dear Jen:/g) || []).length === 2, 'newest lines in a row: ' + said.box);
  assert.ok(said.inBox && said.inPanel, 'every row inside');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// ---------- hunting places (owner, 6 Nov 2026; src/19zzzzz-places.js) ----------
// SAMPLE: the engine proved on the sample place; the place agents replace this test with their own place's.
test('hunting places (SAMPLE): Kanor makes a gear set; the Jeep to the sample place; gear takes a charge to 1; tame its animal (it runs off once and comes back); its hidden chest; its person\'s story; its 2-floor cave and the boss\'s chest; the Medals page (owner, 6 Nov 2026)', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.map = 'pulag'; s.gold = 5000; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 40); L.addItem(s, 'berry', 10); L.addItem(s, 'sample_hide', 3); L.addItem(s, 'sample_fang', 1); s.sel = s.inv.findIndex((x) => x && x.id === 'bow');");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await waitMap(page, 'pulag');
  await page.evaluate(() => { window.gameHost.devPlaces = true; });
  // Kanor's Make tab: the sample set, four pieces, each on as it is made
  // (the set's rows come after the trophies and the sets of the places listed before it, 4 rows a page)
  const trophies = await page.evaluate(() => { const C = Farm.Config, shown = C.PLACE_ORDER.filter(Farm.Logic.placeShown); return C.WILD.trophies.length + 4 * shown.slice(0, shown.indexOf('sample_place')).filter((id) => C.PLACE_GEAR[id + '_head']).length; });
  for (let k = 0; k < 4; k++) {
    await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openKanor('make', p); }, Math.floor((trophies + k) / 4));
    await tapButton(page, '100G');
  }
  await page.waitForFunction(() => Farm.Logic.wornSet(Farm.session.state) === 'sample_place', null, SLOW);
  await shot(page, 'places-kanor-make');
  await closeAll(page);
  // the Gear page from the Bag: four slots, the set worn
  await page.evaluate(() => Farm.ui.openInventory());
  await tapButton(page, 'Gear');
  assert.match(await modalText(page), /Gear[\s\S]*Head: Sample Hat[\s\S]*Body: Sample Vest[\s\S]*Feet: Sample Shoes[\s\S]*Charm: Sample Charm/);
  assert.match(await modalText(page), /A charge costs you 6 less, 8 less in Sample Place/);
  await shot(page, 'places-gear');
  await closeAll(page);
  // the Jeep by the Lodge
  await teleport(page, 27, 10, 'up');
  assert.strictEqual(await actionLabel(page), 'Jeep', 'even with the Bow in your hands');
  await tapAction(page);
  assert.match(await modalText(page), /Kanor's Jeep[\s\S]*Pulag Grassland[\s\S]*Sample Place[\s\S]*0% explored[\s\S]*Makiling Forest[\s\S]*Opens at 10 hunts/);
  await shot(page, 'places-jeep');
  await tapButton(page, 'Go');
  await waitMap(page, 'sample_place');
  const here = await page.evaluate(() => { const w = Farm.world, f = w.feet(), p = w.points.from_jeep; return { jeep: !!w.jeep, npc: !!w.placeNpc, chests: w.placeChests.length, near: Math.hypot(f.x - p.x, f.y - p.y) < 256, kinds: w.wild.animals.map((a) => a.kind).sort(), comp: !!w.comp }; });
  assert.deepStrictEqual(here, { jeep: true, npc: true, chests: 1, near: true, kinds: ['sample_hog', 'sample_kid'], comp: false });
  await shot(page, 'places-sample-arrive');
  // a charge: the whole set takes 8 off, never under 1
  const lost = await page.evaluate(() => { const w = Farm.world, s = Farm.session.state, a = w.wild.animals.find((x) => x.kind === 'sample_hog'), e = s.energy; w.wildHit(a); return e - s.energy; });
  assert.strictEqual(lost, 1);
  // the hog hunted (its hits counted as yours)
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'sample_hog'); a.hp = 1; w.wildStruck(a); });
  await page.waitForFunction(() => Farm.session.state.places.sample_place.n === 1, null, SLOW);
  // taming: hold berries, sneak up to it while it is calm, Feed
  const kid = () => page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'sample_kid'); return a ? { hearts: a.hearts && a.hearts.visible ? a.hearts.text : null } : null; });
  const nextTo = async () => {
    await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'sample_kid'), T = 256; a.def = Object.assign({}, a.def, { shy: 0 }); a.x = 8.5 * T; a.y = 9.7 * T; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; w.setFeet(7.5 * T, 9.5 * T); w.dir = 'right'; w.idle(); });
    await frames(page, 3);
  };
  await hold(page, 'berry');
  await nextTo();
  assert.strictEqual(await actionLabel(page), 'Feed');
  await page.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0.9; });
  await tapAction(page);
  await page.evaluate(() => { Math.random = window.__rnd; });
  assert.strictEqual((await kid()).hearts, '♥ 1/3');
  await shot(page, 'places-tame-fed');
  await page.evaluate(() => { const r = Farm.Logic.feedTame; Farm.Logic.feedTame = (s, id) => r(s, id, () => 0.1); window.__feed = r; }); // (the 1 in 4: it runs off)
  await nextTo();
  await tapAction(page);
  await page.waitForFunction(() => !Farm.world.wild.animals.some((x) => x.kind === 'sample_kid'), null, SLOW);
  await page.evaluate(() => { Farm.Logic.feedTame = window.__feed; });
  await advance(page, 11);
  await page.evaluate(() => { const w = Farm.world; for (let i = 0; i < 20 && !w.wild.animals.some((x) => x.kind === 'sample_kid'); i++) { w.wild.next = 0; w.wildArrive(0); } });
  assert.ok(await kid(), 'back after a while');
  await page.evaluate(() => { const r = Farm.Logic.feedTame; Farm.Logic.feedTame = (s, id) => r(s, id, () => 0.9); window.__feed = r; });
  await nextTo();
  await tapAction(page);
  await page.evaluate(() => { Farm.Logic.feedTame = window.__feed; });
  await page.waitForFunction(() => Farm.Logic.tamed(Farm.session.state, 'sample_place') && Farm.world.comp && !Farm.world.wild.animals.some((x) => x.kind === 'sample_kid'), null, SLOW);
  await page.waitForFunction(() => /is tamed/.test(Farm.ui.toastText.text), null, SLOW);
  await frames(page, 10);
  await shot(page, 'places-companion');
  // its skill: it fetches what lies near you
  await page.evaluate(() => { const w = Farm.world, f = w.feet(); w.dropWild('sample_hide', f.x + 2.4 * 256, f.y + 0.5 * 256); });
  const hides = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'sample_hide'));
  await page.waitForFunction((n) => Farm.Logic.countItem(Farm.session.state, 'sample_hide') === n + 1 && !Farm.world.wildDrops.length, hides, SLOW);
  // the hidden chest shows as you come near, and opens once
  await teleport(page, 4, 4, 'up');
  await page.waitForFunction(() => Farm.world.placeChests[0] && Farm.world.placeChests[0].img.alpha > 0.6, null, SLOW);
  assert.strictEqual(await actionLabel(page), 'Open');
  const arrows = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows'));
  await tapAction(page);
  await page.waitForFunction(() => /A hidden chest!/.test(Farm.ui.toastText.text), null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows')), arrows + 5);
  // the person: the line for how far you are (hunted, tamed)
  await teleport(page, 11, 5, 'up');
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  assert.match(await modalText(page), /SAMPLE GUIDE[\s\S]*A friend for life/);
  await shot(page, 'places-npc');
  await closeAll(page);
  // the cave: in at the door, floor 1's guard and its two, the gate, floor 2's boss, its chest
  await page.evaluate(() => { const w = Farm.world; w.setFeet(15.5 * 256, 2.5 * 256); w.dir = 'up'; });
  await waitMap(page, 'sample_cave');
  const f1 = await page.evaluate(() => ({ fl: Farm.session.lairFloor, kinds: Farm.world.wild.animals.map((a) => a.kind), guardBar: !!Farm.world.wild.animals[0].bar, sheet: Farm.world.map.getTileset('indoor').image.key, comp: !!Farm.world.comp }));
  assert.deepStrictEqual(f1, { fl: 1, kinds: ['sample_guard', 'sample_bat', 'sample_bat'], guardBar: true, sheet: 'indoor-sample_cave', comp: true });
  await shot(page, 'places-cave-1');
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.slice().forEach((a) => { a.hp = 1; w.wildStruck(a); }); });
  await page.waitForFunction(() => Farm.world.lair.open, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.places.sample_place.g), 1, 'the guard is down');
  await page.evaluate(() => { const g = Farm.world.lair.gateRect; Farm.world.setFeet((g.x0 + 1) * 256, (g.y0 + 1.5) * 256); });
  await page.waitForFunction(() => Farm.session.lairFloor === 2 && Farm.world.mapKey === 'sample_cave' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await frames(page, 3);
  const boss = await page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'sample_boss'); return a && { hp: a.hp, max: a.max, bar: !!a.bar }; });
  assert.deepStrictEqual(boss, { hp: 6, max: 6, bar: true }, 'soloable: no more for one');
  assert.strictEqual(await page.evaluate(() => Farm.world.lair.gate), null, 'the bottom: no gate down');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'sample_boss'); a.def = Object.assign({}, a.def, { angry: 0 }); a.hp = 2; w.wildStruck(a); w.wildStruck(a); });
  await page.waitForFunction(() => !!Farm.world.bossChest, null, SLOW);
  await page.waitForFunction(() => /The boss left a chest/.test(Farm.ui.toastText.text), null, SLOW);
  await page.evaluate(() => { const w = Farm.world, b = w.bossChest; w.setFeet(b.x, b.y + 0.75 * 256); w.dir = 'up'; w.idle(); });
  await frames(page, 3);
  await shot(page, 'places-boss-chest');
  assert.strictEqual(await actionLabel(page), 'Open');
  const fangs = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'sample_fang'));
  await tapAction(page);
  await page.waitForFunction(() => !Farm.world.bossChest, null, SLOW);
  assert.ok(await page.evaluate((n) => Farm.Logic.countItem(Farm.session.state, 'sample_fang') + Farm.world.wildDrops.filter((d) => d.id === 'sample_fang').length >= n + 2, fangs));
  assert.strictEqual(await page.evaluate(() => Farm.Logic.bossChests(Farm.session.state, 'sample_place')), 0);
  // medals: the farmer card in the pause menu, then the page
  await closeAll(page);
  await page.evaluate(() => Farm.ui.openPause());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  const link = await page.evaluate(() => { const m = Farm.ui.modals[0], l = m.c.list.find((o) => o.name === 'medals-link'); return l && l.list[0].text; });
  assert.match(link, /^Medals \d+$/);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openMedals(); });
  assert.match(await modalText(page), /My Medals[\s\S]*\d+ of \d+ medals/);
  const earned = await page.evaluate(() => [9900, 9901, 9902, 9903, 9904, 9910].map((c) => Farm.Logic.hasMedal(Farm.session.state, c)));
  assert.deepStrictEqual(earned, [true, true, true, true, true, true]);
  await shot(page, 'places-medals');
  // closed in the cave: it opens at the cave's door, in the place
  await closeAll(page);
  const closed = await page.evaluate(() => { Farm.world.save(); return gameHost.saves[gameHost.saves.length - 1]; });
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(JSON.parse(closed));
  await closeAll(again.page);
  await waitMap(again.page, 'sample_place');
  const back = await again.page.evaluate(() => { const w = Farm.world, f = w.feet(), p = w.points.from_dungeon; return { far: Math.hypot(f.x - p.x, f.y - p.y) / 256, comp: !!w.comp, deep: Farm.session.state.places.sample_place.deep }; });
  assert.ok(back.far < 1, 'at the cave door');
  assert.deepStrictEqual([back.comp, back.deep], [true, 2]);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

// ---------- Place 13: Taal Lake (owner, 6 Nov 2026; src/00-zzzzzzzzzz-place-13-taal.js) ----------
test('hunting places: Taal Lake: the Jeep at 100 hunts; a Tagak, a Buwaya and the rare Royal Tagak; fish from the pier; tame the Little Tagak; a hidden chest; Mang Celso\'s first step and gift; Taal Crater floor 5 guard and floor 10 Berberoka; its chest; the medals', async () => {
  const save = await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; s.map = 'pulag'; s.wild.n = 100; s.gold = 5000; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 60); L.addItem(s, 'rod', 1); L.addItem(s, 'fish_s', 12); s.sel = s.inv.findIndex((x) => x && x.id === 'bow');");
  const { page, problems, context } = await open(save);
  await closeAll(page);
  await waitMap(page, 'pulag');
  // Kanor's Jeep: Taal Lake is open at 100 hunts
  await teleport(page, 27, 10, 'up');
  assert.strictEqual(await actionLabel(page), 'Jeep');
  await tapAction(page);
  assert.match(await modalText(page), /Kanor's Jeep[\s\S]*Taal Lake \| 0% explored\. 0 hunts here\./);
  const go = await page.evaluate(() => Farm.Logic.jeepPlaces(Farm.session.state).filter((e) => e.open).findIndex((e) => e.id === 'taal'));
  assert.ok(go >= 0);
  await page.evaluate(() => { Farm.Logic.wildRare = () => true; }); // (the rare one is out today)
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('taal', 'from_jeep'); });
  await waitMap(page, 'taal');
  const here = await page.evaluate(() => { const w = Farm.world, f = w.feet(), p = w.points.from_jeep; return { jeep: !!w.jeep, npc: !!w.placeNpc && w.placeNpc.p.npc.name, chests: w.placeChests.length, near: Math.hypot(f.x - p.x, f.y - p.y) < 256, kinds: [...new Set(w.wild.animals.map((a) => a.kind))].sort(), mouth: !!w.points.dungeon_mouth }; });
  assert.deepStrictEqual(here, { jeep: true, npc: 'Mang Celso', chests: 5, near: true, kinds: ['buwaya', 'royal_tagak', 'tagak', 'tagak_bata'], mouth: true });
  await frames(page, 20);
  await shot(page, 'taal-arrive');
  // one of each hunted (their hits counted as yours); the Buwaya charges first
  const lost = await page.evaluate(() => { const w = Farm.world, s = Farm.session.state, a = w.wild.animals.find((x) => x.kind === 'buwaya'), e = s.energy; w.wildHit(a); return e - s.energy; });
  assert.strictEqual(lost, 15, 'a Buwaya charge, no gear on');
  for (const kind of ['tagak', 'buwaya', 'royal_tagak']) {
    await page.evaluate((k) => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === k); a.hp = 1; w.wildStruck(a); }, kind);
    await page.waitForFunction((k) => (Farm.session.state.wild.by[k] || 0) === 1, kind, SLOW);
  }
  assert.strictEqual(await page.evaluate(() => Farm.session.state.places.taal.n), 3);
  // the pier: fish from its end (the lake is water: you cannot walk on it)
  await teleport(page, 17, 6, 'up');
  await hold(page, 'rod');
  assert.strictEqual(await actionLabel(page), 'Fish');
  assert.strictEqual(await page.evaluate(() => Farm.world.walkable(17, 4)), false, 'the lake');
  await frames(page, 10);
  await shot(page, 'taal-pier');
  // taming: hold Small Fish, sneak up to the Little Tagak while it is calm, Feed; 9 feedings (it never runs off here)
  await hold(page, 'fish_s');
  await page.evaluate(() => { const r = Farm.Logic.feedTame; Farm.Logic.feedTame = (s, id) => r(s, id, () => 0.9); window.__feed = r; });
  for (let k = 1; k <= 9; k++) {
    await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'tagak_bata'), T = 256; a.def = Object.assign({}, a.def, { shy: 0 }); a.x = 22.5 * T; a.y = 21.7 * T; a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; w.setFeet(21.5 * T, 21.5 * T); w.dir = 'right'; w.idle(); });
    await frames(page, 3);
    assert.strictEqual(await actionLabel(page), 'Feed', 'feeding ' + k);
    if (k === 1) await shot(page, 'taal-tame');
    await tapAction(page);
    if (k < 9) assert.strictEqual(await page.evaluate(() => Farm.Logic.tameHearts(Farm.session.state, 'taal')), k);
  }
  await page.evaluate(() => { Farm.Logic.feedTame = window.__feed; });
  await page.waitForFunction(() => Farm.Logic.tamed(Farm.session.state, 'taal') && Farm.world.comp && Farm.world.comp.kind === 'tagak_bata', null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'fish_s')), 3);
  // a hidden chest: the one in the reeds, by the crater path
  await teleport(page, 4, 15, 'up');
  await page.waitForFunction(() => Farm.world.placeChests[1] && Farm.world.placeChests[1].img.alpha > 0.6, null, SLOW);
  assert.strictEqual(await actionLabel(page), 'Open');
  const arrows = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows'));
  await tapAction(page);
  await page.waitForFunction(() => /A hidden chest!/.test(Farm.ui.toastText.text), null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows')), arrows + 8);
  // Mang Celso by his pier: 3 hunts here is his first step, and its coffee
  await teleport(page, 14, 16, 'up');
  assert.strictEqual(await actionLabel(page), 'Talk');
  const coffee = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'kapeng_barako')); // (the chest may have had one)
  await tapAction(page);
  assert.match(await modalText(page), /MANG CELSO[\s\S]*Magandang araw![\s\S]*Mang Celso gives you 1 Kapeng Barako/);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'kapeng_barako')), coffee + 1);
  await shot(page, 'taal-celso');
  await closeAll(page);
  // Taal Crater: in at the door at the top of the trail
  await page.evaluate(() => { const w = Farm.world; w.setFeet(6.5 * 256, 3.5 * 256); w.dir = 'up'; });
  await waitMap(page, 'taal_crater');
  const f1 = await page.evaluate(() => ({ fl: Farm.session.lairFloor, kinds: Farm.world.wild.animals.map((a) => a.kind), sheet: Farm.world.map.getTileset('indoor').image.key, comp: !!Farm.world.comp }));
  assert.deepStrictEqual(f1, { fl: 1, kinds: ['siyokoy', 'siyokoy', 'siyokoy'], sheet: 'indoor-taal_crater', comp: true });
  await frames(page, 10);
  await shot(page, 'taal-crater-1');
  // floor 5 (jumping there): the Lava Buwaya and its two
  await page.evaluate(() => Farm.world.travel('taal_crater', 'entrance', 5));
  await page.waitForFunction(() => Farm.session.lairFloor === 5 && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await frames(page, 3);
  const guard = await page.evaluate(() => { const a = Farm.world.wild.animals[0]; return { kind: a.kind, hp: a.hp, bar: !!a.bar, n: Farm.world.wild.animals.length }; });
  assert.deepStrictEqual(guard, { kind: 'lava_buwaya', hp: 26, bar: true, n: 3 });
  await shot(page, 'taal-crater-5');
  await page.evaluate(() => { const w = Farm.world; w.wild.animals.slice().forEach((a) => { a.hp = 1; w.wildStruck(a); }); });
  await page.waitForFunction(() => Farm.world.lair.open, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.places.taal.g), 1, 'the guard is down');
  // floor 10: the Berberoka, soloable (no more for one); its chest
  await page.evaluate(() => Farm.world.travel('taal_crater', 'entrance', 10));
  await page.waitForFunction(() => Farm.session.lairFloor === 10 && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await frames(page, 3);
  const boss = await page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'berberoka'); return a && { hp: a.hp, max: a.max, bar: !!a.bar }; });
  assert.deepStrictEqual(boss, { hp: 40, max: 40, bar: true });
  assert.strictEqual(await page.evaluate(() => Farm.world.lair.gate), null, 'the bottom: no gate down');
  await shot(page, 'taal-crater-10');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'berberoka'); a.def = Object.assign({}, a.def, { angry: 0 }); a.hp = 3; w.wildStruck(a); w.wildStruck(a); w.wildStruck(a); }); // (3 hits: its share)
  await page.waitForFunction(() => !!Farm.world.bossChest, null, SLOW);
  await page.waitForFunction(() => /The boss left a chest/.test(Farm.ui.toastText.text), null, SLOW);
  const pearlsNow = () => page.evaluate(() => { const s = Farm.session.state; return Farm.Logic.countItem(s, 'pearl_kataw') + (s.basket.pearl_kataw || 0) + Farm.world.wildDrops.filter((d) => d.id === 'pearl_kataw').length; }); // (a full bag: the rest waits in the basket)
  const pearls = await pearlsNow();
  // (stand at it and tap Open; again if a pet or the companion walked up in between and the button became Talk)
  for (let i = 0; i < 4 && (await page.evaluate(() => !!Farm.world.bossChest)); i++) {
    await page.evaluate(() => { const w = Farm.world, b = w.bossChest; w.setFeet(b.x, b.y + 0.75 * 256); w.dir = 'up'; w.idle(); });
    await frames(page, 3);
    if (i === 0) assert.strictEqual(await actionLabel(page), 'Open');
    if ((await actionLabel(page)) === 'Open') await tapAction(page);
    await page.waitForFunction(() => !Farm.world.bossChest, null, { timeout: 8000 }).catch(() => {});
  }
  assert.strictEqual(await page.evaluate(() => Farm.world.bossChest), null, 'the chest is open');
  assert.ok((await pearlsNow()) >= pearls + 2, 'the chest\'s 2 Kataw Pearls');
  await shot(page, 'taal-boss-chest');
  // medals: first hunt, guard, boss, tame, each animal and the rare one
  await closeAll(page);
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openMedals(); });
  assert.match(await modalText(page), /My Medals[\s\S]*\d+ of \d+ medals/);
  const earned = await page.evaluate(() => [1300, 1301, 1302, 1303, 1310, 1312, 1314].map((c) => Farm.Logic.hasMedal(Farm.session.state, c)));
  assert.deepStrictEqual(earned, [true, true, true, true, true, true, true]);
  await shot(page, 'taal-medals');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// End-to-end playthrough of dist/index.html in a phone-sized headless Chromium.
// Uses real taps/keys for input; teleports the player between spots to keep it fast.
// Set SHOTS=/some/dir to save screenshots along the way.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const W = 38; // farm width in tiles
const ACTION_BTN = { x: 294, y: 512 };
// Headless Chromium renders on the CPU, so frames are slow; give clock- and fade-driven waits room.
const SLOW = { timeout: 90000 }; // headless frames can be slow

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
  await page.addInitScript(([state, now]) => {
    window.__now = now;
    window.gameHost = {
      state: state,
      quiet: !window.__loud, // no daily-gift popup or quest toasts in the way of the other tests
      saves: [],
      save(s) { this.saves.push(JSON.stringify(s)); this.state = s; },
      now: () => window.__now,
    };
  }, [savedState || null, at(when)]);
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

async function tapHotbar(page, i) {
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
    for (let y = 11; y <= 15; y++) for (let x = 4; x <= 8; x++) delete s.debris[y * 38 + x];
    s.debris[12 * 38 + 5] = 'weed';
    s.debris[12 * 38 + 6] = 'branch';
    s.debris[12 * 38 + 7] = 'stone';
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
  assert.ok(await page.evaluate(() => Farm.Logic.isRipe(Farm.session.state.soil[12 * 38 + 5])));
  assert.strictEqual(await page.evaluate(() => Farm.Logic.cropStage(Farm.session.state.soil[13 * 38 + 5])), 0, 'the unwatered row is still a seed');
  await teleport(page, 5, 12, 'down');
  await page.evaluate(() => { Farm.world.hintKey = null; });
  await frames(page);
  await tapAction(page);
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Turnip needs water to grow/);
  assert.strictEqual(await page.evaluate(() => Farm.world.crops[12 * 38 + 5].stage), 3, 'the field shows it');
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

  // Lily's stand opens at 6 in the morning (real time); before that she is asleep, and the market is shut too
  await setClock(page, [2026, 4, 2, 5, 30]);
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  assert.match(await modalText(page), /Lily is sleeping\.\s+Come back at 6:00 AM/);
  await tapButton(page, 'OK');
  await page.waitForFunction(() => Farm.world.nightSigns && Farm.world.nightSigns.length > 0, null, { timeout: 5000 }); // a CLOSED sign on the stand (checked every 2 s)
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
  // fodder feeds them both; the next morning there is a truffle and carabao milk
  await hold(page, 'fodder');
  await meetAnimal(page, 1, 6, 33);
  assert.strictEqual(await actionLabel(page), 'Feed');
  await tapAction(page);
  await away(page, 1);
  await meetAnimal(page, 2, 6, 33);
  await tapAction(page);
  s = await state(page);
  assert.deepStrictEqual(s.animals.slice(1).map((a) => a.fed), [1, 1]);
  await page.evaluate(() => { Farm.Logic.endDay(Farm.session.state, false, {}); Farm.world.changed(); });
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
    const s = Farm.session.state, L = Farm.Logic;
    L.listItem(s, 0, s.inv.findIndex((x) => x && x.id === 'potato'), 4, 0);
    s.shelves[0].left = 1; // a buyer is due in a minute
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
  if (!buyer.startsWith('visitor_')) assert.strictEqual(s.shelves[0].buyer, buyer); // a visitor's sale goes down as a villager's
  assert.strictEqual(s.shelves[0].coins, 4 * (await page.evaluate(() => Farm.Config.ITEMS.potato.sell)));
  await page.waitForFunction(() => !Farm.world.villagers.list.some((v) => v.errand), null, SLOW); // they head off
  await teleport(page, 11, 15, 'up');
  await page.waitForFunction(() => Farm.ui.actionLabel.text !== 'Talk', null, SLOW); // (a villager may be walking past the stall)
  assert.strictEqual(await actionLabel(page), 'Collect');
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
  assert.match(await modalText(page), /Tap an item to put it away/);
  await tapSlotOnPage(page, 8);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.inv[8]), null);
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.store[0]), { id: 'carrot', n: 40 });
  await shot(page, '41-storage');
  // kept in the save
  const saved = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.deepStrictEqual(saved.kp, [['carrot', 40]]);
  await tapButton(page, 'Storage');
  await tapSlotOnPage(page, 0);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'carrot')), 40);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.store[0]), null);
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
    for (let y = 13; y <= 15; y++) for (let x = 9; x <= 11; x++) s.soil[y * 38 + x] = { c: 'carrot', p: L.nowMin() - 60, w: 0, r: 0 };
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
  await page.evaluate(() => { delete Farm.session.state.debris[12 * 38 + 5]; Farm.world.refreshDebris(); });
  await teleport(page, 5, 11, 'down');
  await tapHotbar(page, 0);
  await tapAction(page);
  assert.ok((await state(page)).soil[12 * 38 + 5], 'can till on the new farm');
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
    L.till(s, 12 * 38 + 5);
    L.addItem(s, 'seed_onion', 1);
    L.plant(s, 12 * 38 + 5, s.inv.findIndex((x) => x && x.id === 'seed_onion'));
  `, MAY31);
  const { page, problems, context } = await open(save, MAY31);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'May 31');
  const springGrass = await tileGid(page, 'Ground', 2, 3);
  const seasonsFirst = await page.evaluate(() => Farm.world.map.getTileset('seasons').firstgid);
  assert.ok(springGrass >= seasonsFirst && springGrass < seasonsFirst + 12, 'spring art from the seasons tileset');

  // summer seeds can't be planted yet
  await page.evaluate(() => {
    Farm.Logic.addItem(Farm.session.state, 'seed_tomato', 1);
    Farm.Logic.till(Farm.session.state, 12 * 38 + 6);
    Farm.world.refreshAllSoil();
  });
  await hold(page, 'seed_tomato');
  await teleport(page, 6, 11, 'down');
  await tapAction(page);
  assert.strictEqual((await state(page)).soil[12 * 38 + 6].c, null, 'tomato refused in spring');

  const report = await nextMorning(page);
  assert.match(report, /Summer has arrived/);
  let s = await state(page);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Jun 1');
  assert.strictEqual(s.soil[12 * 38 + 5].c, 'onion', 'the spring onion grows on');
  const summerGrass = await tileGid(page, 'Ground', 2, 3);
  assert.strictEqual(summerGrass, springGrass + 12, 'grass switched to the summer art');
  await teleport(page, 6, 9, 'down');
  await shot(page, '16-summer');

  // now the tomato goes in
  await hold(page, 'seed_tomato');
  await teleport(page, 6, 11, 'down');
  await tapAction(page);
  assert.strictEqual((await state(page)).soil[12 * 38 + 6].c, 'tomato');

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
  assert.match(await modalText(page), /Also needs 2 Boar Tusk/);
  await tapButton(page, 'Upgrade');
  await page.waitForFunction(() => /You need 2 Boar Tusk/.test(Farm.ui.toastText.text), null, SLOW);
  assert.strictEqual((await state(page)).tools.hoe, 2);
  await closeAll(page);
  // Lily says what a big bag wants
  await page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.resizeBag(s, 7); s.gold = 1e6; Farm.ui.openShop('supplies'); });
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /Also needs 5 Soft Leather/);
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
    people: Farm.world.villagers.list.filter((v) => !v.shopper).length,
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
  assert.deepStrictEqual(s.yard.items.map((it) => [it.x, it.y]), [[24, 11], [25, 11], [26, 11]]);
  assert.deepStrictEqual(await page.evaluate(() => [0, 1, 2].map((i) => Farm.Logic.fenceShape(Farm.session.state, i))), ['h', 'h', 'h']);
  assert.strictEqual(s.yard.bag[0], 5, 'three of the eight starter fences used');
  await page.touchscreen.tap(180, 534); // Done placing

  // the bench goes in, then gets dragged two tiles right
  await page.touchscreen.tap(90, 598);
  await tapButton(page, 'Place', 2); // Wooden Fence, Flower Bed, Bench
  s = await state(page);
  const bench = s.yard.items[3];
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
  assert.strictEqual(s.yard.items[3].x, bench.x + 2, 'the bench moved');
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

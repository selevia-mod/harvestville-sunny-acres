// End-to-end playthrough of dist/index.html in a phone-sized headless Chromium.
// Uses real taps/keys for input; teleports the player between spots to keep it fast.
// Set SHOTS=/some/dir to save screenshots along the way.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const W = 24; // farm width in tiles
const ACTION_BTN = { x: 294, y: 512 };
// Headless Chromium renders on the CPU, so frames are slow; give clock- and fade-driven waits room.
const SLOW = { timeout: 30000 };

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
  await page.addInitScript((state) => {
    window.gameHost = {
      state: state,
      saves: [],
      save(s) { this.saves.push(JSON.stringify(s)); this.state = s; },
    };
  }, savedState || null);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; }); // no surprise rain
  await page.waitForTimeout(300);
  const cdp = await context.newCDPSession(page);
  return { page, problems, context, cdp };
}

// A save made from a fresh state (no debris on the field), changed by `edit` (run in the page).
async function makeSave(edit) {
  const { page, context } = await open();
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
  await page.waitForTimeout(250); // tools land a moment after the tap; let the effects play
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

const modalText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
  return out.join(' | ');
});
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const count = (s, id) => s.inv.filter((x) => x && x.id === id).reduce((a, b) => a + b.n, 0);

async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}

async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
}

// Goes to bed in the farmhouse, reads the morning report, and goes back to where we were.
async function sleepThroughNight(page) {
  const { day } = await state(page);
  const from = await page.evaluate(() => Farm.world.mapKey);
  if (from !== 'house') await go(page, 'house', 'bed');
  await teleport(page, 2, 4, 'up'); // facing the bed
  assert.strictEqual(await actionLabel(page), 'Sleep');
  await tapAction(page);
  await tapButton(page, 'Yes');
  await page.waitForFunction((d) => Farm.session.state.day === d + 1 && Farm.world.mapKey === 'house' && !Farm.world.busy, day, SLOW);
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW); // the morning report
  const report = await modalText(page);
  await tapButton(page, 'OK');
  if (from === 'farm') await go(page, 'farm', 'house_door');
  else if (from === 'town') await go(page, 'town', 'from_farm');
  return report;
}

test('farming loop: clear debris, till, plant a seed bag, water, sleep, harvest, ship, shop, save', async () => {
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
  const y0 = s.player.y;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 420, id: 1 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + i * 8, y: 420, id: 1 }] });
  }
  await page.waitForTimeout(800); // the farmer eases up to walking speed
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await frames(page);
  const moved = await state(page);
  assert.ok(moved.player.x > 6.5 * 256 + 160, 'player walked right with the joystick');
  assert.strictEqual(Math.round(moved.player.y), Math.round(y0));
  assert.deepStrictEqual(await page.evaluate(() => [Farm.input.jx, Farm.input.jy]), [0, 0], 'joystick released');

  // a patch of the field with a weed, a branch and a stone on it (and nothing else)
  await page.evaluate(() => {
    const s = Farm.session.state;
    for (let y = 11; y <= 15; y++) for (let x = 4; x <= 8; x++) delete s.debris[y * 24 + x];
    s.debris[12 * 24 + 5] = 'weed';
    s.debris[12 * 24 + 6] = 'branch';
    s.debris[12 * 24 + 7] = 'stone';
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

  // water the top row each day, then sleep in the farmhouse; three watered days ripen turnips
  for (let day = 0; day < 3; day++) {
    await tapHotbar(page, 1);
    for (let x = 5; x <= 7; x++) {
      await teleport(page, x, 11, 'down');
      if (x === 5 && day === 0) assert.strictEqual(await actionLabel(page), 'Water');
      await page.keyboard.press('Space'); // the keyboard works too
      await frames(page);
    }
    s = await state(page);
    assert.strictEqual(s.soil[idx(5, 12)].w, 1, `watered on day ${s.day}`);
    if (day === 0) await shot(page, '04-watered');
    const report = await sleepThroughNight(page);
    assert.match(report, /GOOD MORNING/);
  }
  s = await state(page);
  assert.strictEqual(s.day, 4);
  assert.strictEqual(s.soil[idx(5, 12)].d, 3);
  assert.strictEqual(s.soil[idx(5, 13)].d, 0, 'the unwatered row did not grow');
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

  // ship them: pick the turnips from the bag, then use the shipping box
  await page.touchscreen.tap(14 + 6 * 48 + 22, 606); // bag button
  await frames(page);
  await shot(page, '06-bag');
  await page.touchscreen.tap(33 + (turnipSlot % 6) * 50 + 22, 160 + Math.floor(turnipSlot / 6) * 50 + 22);
  await frames(page);
  assert.match(await modalText(page), /Lumber 1 +Stone 1/);
  await tapButton(page, 'Close');
  await teleport(page, 10, 7, 'up');
  assert.strictEqual(await actionLabel(page), 'Ship');
  await tapAction(page);
  s = await state(page);
  assert.deepStrictEqual(s.box, [{ id: 'turnip', n: 3 }]);
  const goldBefore = s.gold;
  const report = await sleepThroughNight(page);
  assert.match(report, /earned 180G/);
  s = await state(page);
  assert.strictEqual(s.gold, goldBefore + 180, 'shipping paid 3 x 60G overnight');

  // Lily's stand is closed early in the morning, open at 10 AM
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  assert.match(await modalText(page), /Closed/);
  await tapButton(page, 'OK');
  await page.evaluate(() => { Farm.session.state.time = 600; });
  await tapAction(page);
  await shot(page, '07-shop');
  await tapButton(page, 'Buy 120G'); // a bag of turnip seeds
  s = await state(page);
  assert.strictEqual(count(s, 'seed_turnip'), 4);
  assert.strictEqual(s.gold, goldBefore + 180 - 120);
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

  // night falls
  await page.evaluate(() => { Farm.session.state.time = 21 * 60; Farm.bus.emit('hud'); });
  await frames(page);
  await shot(page, '10-night');

  // __gameSleep pauses the clock and saves; waking resumes
  const savesBefore = await page.evaluate(() => gameHost.saves.length);
  await page.evaluate(() => window.__gameSleep(true));
  const t0 = (await state(page)).time;
  await page.waitForTimeout(1500);
  assert.strictEqual((await state(page)).time, t0, 'clock stopped while asleep');
  assert.strictEqual(await page.evaluate(() => gameHost.saves.length), savesBefore + 1, 'saved on sleep');
  await page.evaluate(() => window.__gameSleep(false));
  await page.waitForFunction((t0) => Farm.session.state.time > t0, t0, SLOW); // clock runs again after waking

  // saves are small and restore correctly in a fresh page
  const saves = await page.evaluate(() => gameHost.saves);
  saves.forEach((json) => assert.ok(json.length < 16384, `save is ${json.length} bytes`));
  const last = JSON.parse(saves[saves.length - 1]);
  assert.strictEqual(last.v, 1);
  const before = await state(page);
  assert.deepStrictEqual(problems, []);
  await context.close();

  const again = await open(last);
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
  assert.deepStrictEqual(await page.evaluate(() => Farm.world.herd.members.map((m) => m.sprite.texture.key)), ['animals', 'animals2', 'animals2']);
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

test('passing out at 2 AM wakes you in bed with half energy', async () => {
  const { page, problems, context } = await open();
  await tapButton(page, 'Boy');
  await page.evaluate(() => window.__gameBack());
  await page.evaluate(() => { Farm.session.state.time = Farm.Config.PASS_OUT - 1; });
  await page.waitForFunction(() => Farm.session.state.day === 2 && Farm.world.mapKey === 'house' && !Farm.world.busy, null, SLOW);
  await page.waitForFunction(() => Farm.ui.modals.length === 1, null, SLOW);
  assert.match(await modalText(page), /passed out/);
  const s = await state(page);
  assert.strictEqual(s.energy, 50);
  assert.strictEqual(s.time, 360);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a garbage save from the host starts a new game instead of crashing', async () => {
  const { page, problems, context } = await open('{not json');
  const s = await state(page);
  assert.strictEqual(s.day, 1);
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

test('animals: pet, feed, brush, collect an egg, ship it, buy a cow, the dog, save', async () => {
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
  await sleepThroughNight(page);
  s = await state(page);
  assert.strictEqual(s.animals[0].ready, 1);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members[0].bubble.visible), true, 'egg bubble shows');
  await meetAnimal(page, 0, 6, 33);
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  assert.ok(count(s, 'egg') === 1, 'egg collected');
  assert.strictEqual(s.animals[0].ready, 0);

  // ship the egg
  await hold(page, 'egg');
  await teleport(page, 10, 7, 'up');
  assert.strictEqual(await actionLabel(page), 'Ship');
  await tapAction(page);
  s = await state(page);
  assert.deepStrictEqual(s.box, [{ id: 'egg', n: 1 }]);

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

test('New game in the pause menu replaces a progressed farm with a fresh one', async () => {
  const progressed = await makeSave(`
    s.day = 9;
    s.gold = 4321;
    L.till(s, 300);
    L.plant(s, 300, s.inv.findIndex((x) => x && x.id === 'seed_turnip'));
    L.buyAnimal(s, 'cow');
  `);
  const { page, problems, context } = await open(progressed);
  let s = await state(page);
  assert.strictEqual(s.day, 9);
  assert.strictEqual(s.animals.length, 2);

  // Back opens the pause menu; "No" keeps the farm
  await page.evaluate(() => window.__gameBack());
  await shot(page, '14-pause-newgame');
  await tapButton(page, 'New game');
  await tapButton(page, 'No');
  assert.strictEqual((await state(page)).day, 9, 'No keeps the farm');

  // "Yes" starts over
  await tapButton(page, 'New game');
  await tapButton(page, 'Yes');
  await page.waitForFunction(() => Farm.ui && Farm.ui.refresh && Farm.world && Farm.world.herd && Farm.session.state.day === 1, null, SLOW);
  await frames(page, 5);
  s = await state(page);
  assert.strictEqual(s.day, 1);
  assert.strictEqual(s.gold, 300);
  assert.deepStrictEqual(s.soil, {});
  assert.ok(Object.keys(s.debris).length > 60, 'the new farm is overgrown again');
  assert.deepStrictEqual(s.animals.map((a) => a.name), ['Clucky']);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members.length), 1);
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.crops).length), 0);
  const last = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.strictEqual(last.d, 1, 'the new farm is saved straight away');
  assert.strictEqual(last.g, 300);

  // the boy-or-girl choice and the welcome message show, the HUD is live, and the farm is playable
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  await tapButton(page, 'Boy');
  assert.strictEqual(await page.evaluate(() => Farm.world.player.texture.key), 'player');
  await page.evaluate(() => window.__gameBack());
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Spring 1');
  await page.evaluate(() => { delete Farm.session.state.debris[12 * 24 + 5]; Farm.world.refreshDebris(); });
  await teleport(page, 5, 11, 'down');
  await tapHotbar(page, 0);
  await tapAction(page);
  assert.ok((await state(page)).soil[12 * 24 + 5], 'can till on the new farm');
  assert.strictEqual(await page.evaluate(() => Farm.ui.goldText.text), '300G');
  assert.deepStrictEqual(problems, []);
  await context.close();

  // and the new farm is what loads next time
  const again = await open(last);
  assert.strictEqual((await state(again.page)).day, 1);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

// The gid drawn at a map tile, and the seasons tileset's first gid, to check which season's art is showing.
const tileGid = (page, layer, x, y) => page.evaluate(([l, x, y]) => Farm.world.layers[l].getTileAt(x, y).index, [layer, x, y]);

test('seasons: summer arrives, spring crops wither, the shop and the farm change', async () => {
  const save = await makeSave(`
    s.day = C.DAYS_PER_SEASON;
    L.till(s, 12 * 24 + 5);
    L.plant(s, 12 * 24 + 5, s.inv.findIndex((x) => x && x.id === 'seed_turnip'));
  `);
  const { page, problems, context } = await open(save);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Spring 28');
  const springGrass = await tileGid(page, 'Ground', 2, 3);
  const seasonsFirst = await page.evaluate(() => Farm.world.map.getTileset('seasons').firstgid);
  assert.ok(springGrass >= seasonsFirst && springGrass < seasonsFirst + 12, 'spring art from the seasons tileset');

  // summer seeds can't be planted yet
  await page.evaluate(() => {
    Farm.Logic.addItem(Farm.session.state, 'seed_tomato', 1);
    Farm.Logic.till(Farm.session.state, 12 * 24 + 6);
    Farm.world.refreshAllSoil();
  });
  await hold(page, 'seed_tomato');
  await teleport(page, 6, 11, 'down');
  await tapAction(page);
  assert.strictEqual((await state(page)).soil[12 * 24 + 6].c, null, 'tomato refused in spring');

  await sleepThroughNight(page);
  let s = await state(page);
  assert.strictEqual(s.day, 29);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Summer 1');
  assert.strictEqual(s.soil[12 * 24 + 5].c, null, 'the spring turnip withered');
  assert.ok(s.soil[12 * 24 + 5], 'its soil is still tilled');
  const summerGrass = await tileGid(page, 'Ground', 2, 3);
  assert.strictEqual(summerGrass, springGrass + 12, 'grass switched to the summer art');
  await teleport(page, 6, 9, 'down');
  await shot(page, '16-summer');

  // now the tomato goes in
  await hold(page, 'seed_tomato');
  await teleport(page, 6, 11, 'down');
  await tapAction(page);
  assert.strictEqual((await state(page)).soil[12 * 24 + 6].c, 'tomato');

  // the shop's seeds tab follows the season
  await page.evaluate(() => { Farm.session.state.time = 600; });
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  const names = await modalText(page);
  assert.ok(names.includes('Tomato Seeds') && names.includes('Corn Seeds'));
  assert.ok(!names.includes('Turnip Seeds'));
  await page.evaluate(() => window.__gameBack());

  // jump to the last day of fall and sleep into winter
  await page.evaluate(() => { Farm.session.state.day = 3 * Farm.Config.DAYS_PER_SEASON; });
  await sleepThroughNight(page);
  s = await state(page);
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Winter 1');
  assert.strictEqual(s.soil[12 * 24 + 6].c, null, 'the summer tomato withered');
  assert.strictEqual(await tileGid(page, 'Ground', 2, 3), springGrass + 36, 'snow');
  assert.ok(await page.evaluate(() => Farm.ui.weather && Farm.ui.weather.getAliveParticleCount() > 0), 'snow is falling');
  // trees still block the way in winter (collision follows the swapped tiles)
  assert.strictEqual(await page.evaluate(() => Farm.world.layers.Walls.getTileAt(0, 3).collides), true);
  await teleport(page, 6, 9, 'down');
  await shot(page, '17-winter');
  await page.evaluate(() => { Farm.session.state.time = 600; });
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  assert.match(await modalText(page), /Nothing grows in winter/);
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
  const report = await sleepThroughNight(page);
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
  const save = await makeSave(`
    s.day = 14; // Spring 14: the Flower Festival
    s.time = 600;
    s.map = 'house';
    s.builds.kitchen = 1;
    s.builds.bighouse = 1;
    L.friend(s, 'lily').pts = 75;
    L.friend(s, 'lily').met = 1;
    L.addItem(s, 'egg', 1);
    L.addItem(s, 'blue_feather', 1);
  `);
  const { page, problems, context } = await open(save);
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
  assert.strictEqual(s.fest.flower, 1);
  assert.strictEqual(s.friends.lily.pts, 85);

  // propose to Lily with the Blue Feather
  await hold(page, 'blue_feather');
  await teleport(page, 11, 18, 'down');
  assert.strictEqual(await actionLabel(page), 'Propose');
  await tapAction(page);
  assert.match(await modalText(page), /Yes!/);
  await tapButton(page, 'OK');
  s = await state(page);
  assert.deepStrictEqual(s.engaged, { who: 'lily', day: 17 });

  // the wedding is three days later; then she lives at the farmhouse
  await sleepThroughNight(page);
  await sleepThroughNight(page);
  const report = await sleepThroughNight(page);
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
    s.day = 2;
    s.time = 600;
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

  // the horse waits by the stable: ride it, ship from the saddlebag, and get off
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
  assert.strictEqual(await actionLabel(page), 'Ship');
  await tapAction(page);
  assert.deepStrictEqual((await state(page)).box, [{ id: 'turnip', n: 2 }], 'shipped from the saddlebag');
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
  assert.match(await modalText(page), /Shipped: 0G/);
  await shot(page, '33-collection');
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

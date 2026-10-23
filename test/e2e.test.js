// End-to-end playthrough of dist/index.html in a phone-sized headless Chromium.
// Uses real taps/keys for input; teleports the player between spots to keep it fast.
// Set SHOTS=/some/dir to save screenshots along the way.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const W = 24; // map width in tiles
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
  await page.goto(PAGE);
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.ui && Farm.ui.refresh);
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

async function tapHotbar(page, i) {
  await page.touchscreen.tap(14 + i * 48 + 22, 606);
  await frames(page);
}

// Taps the on-screen button with the given label inside the top modal.
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    let found = null;
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found = o.getBounds();
      if (o.list) walk(o.list);
    });
    walk(m.c.list);
    return found && { x: found.centerX, y: found.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}

const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

async function sleepThroughNight(page) {
  const day = (await state(page)).day;
  await teleport(page, 6, 7, 'up'); // facing the house door
  await tapAction(page);
  await tapButton(page, 'Yes');
  await page.waitForFunction((d) => Farm.session.state.day === d + 1 && !Farm.world.busy, day, SLOW);
  await page.waitForFunction(() => !Farm.world.cameras.main.fadeEffect.isRunning, null, SLOW);
  await tapButton(page, 'OK'); // morning report
}

test('full farming loop: till, plant, water, sleep, harvest, ship, shop, save', async () => {
  const { page, problems, context, cdp } = await open();
  const FIELD = { x: 5, y: 12 };
  const idx = FIELD.y * W + FIELD.x;

  // welcome dialog closes with the host Back button
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  await shot(page, '01-welcome');
  assert.strictEqual(await page.evaluate(() => window.__gameBack()), true);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);
  await shot(page, '02-start');

  // joystick: drag right on the left side of the screen and the farmer walks right
  const y0 = (await state(page)).player.y;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 420, id: 1 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + i * 8, y: 420, id: 1 }] });
  }
  await page.waitForTimeout(400);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await frames(page);
  const moved = await state(page);
  assert.ok(moved.player.x > 6.5 * 256 + 160, 'player walked right with the joystick');
  assert.strictEqual(Math.round(moved.player.y), Math.round(y0));
  assert.deepStrictEqual(await page.evaluate(() => [Farm.input.jx, Farm.input.jy]), [0, 0], 'joystick released');

  // till with the hoe (hotbar slot 1)
  await teleport(page, FIELD.x, FIELD.y - 1, 'down');
  await tapHotbar(page, 0);
  await tapAction(page);
  let s = await state(page);
  assert.ok(s.soil[idx], 'tile tilled');
  assert.strictEqual(s.energy, 98);

  // plant seeds (keyboard 3 selects slot 3)
  await page.keyboard.press('3');
  await frames(page);
  await tapAction(page);
  s = await state(page);
  assert.strictEqual(s.soil[idx].c, 'turnip');
  assert.strictEqual(s.inv[2].n, 5);

  // till + plant a second tile using the Space key
  await teleport(page, FIELD.x + 1, FIELD.y - 1, 'down');
  await page.keyboard.press('1');
  await page.keyboard.press('Space');
  await frames(page);
  await page.keyboard.press('3');
  await page.keyboard.press('Space');
  await frames(page);

  // water both, then sleep; repeat until the turnips are ripe (3 watered days)
  for (let day = 0; day < 3; day++) {
    await tapHotbar(page, 1);
    await teleport(page, FIELD.x, FIELD.y - 1, 'down');
    await tapAction(page);
    await teleport(page, FIELD.x + 1, FIELD.y - 1, 'down');
    await tapAction(page);
    s = await state(page);
    assert.strictEqual(s.soil[idx].w, 1, `watered on day ${s.day}`);
    if (day === 0) await shot(page, '03-watered');
    await sleepThroughNight(page);
  }
  s = await state(page);
  assert.strictEqual(s.day, 4);
  assert.strictEqual(s.soil[idx].d, 3);
  await teleport(page, FIELD.x, FIELD.y - 1, 'down');
  await shot(page, '04-ripe');

  // harvest both turnips
  await tapAction(page);
  await teleport(page, FIELD.x + 1, FIELD.y - 1, 'down');
  await tapAction(page);
  s = await state(page);
  const turnipSlot = s.inv.findIndex((x) => x && x.id === 'turnip');
  assert.strictEqual(s.inv[turnipSlot].n, 2, 'harvested 2 turnips');
  assert.strictEqual(s.soil[idx].c, null);

  // ship them: pick the turnips from the bag, then use the shipping box
  await page.touchscreen.tap(14 + 6 * 48 + 22, 606); // bag button
  await frames(page);
  await shot(page, '05-bag');
  await page.touchscreen.tap(33 + (turnipSlot % 6) * 50 + 22, 176 + Math.floor(turnipSlot / 6) * 50 + 22);
  await frames(page);
  await tapButton(page, 'Close');
  await teleport(page, 10, 7, 'up');
  await tapAction(page);
  s = await state(page);
  assert.deepStrictEqual(s.box, [{ id: 'turnip', n: 2 }]);
  const goldBefore = s.gold;
  await sleepThroughNight(page);
  s = await state(page);
  assert.strictEqual(s.gold, goldBefore + 120, 'shipping paid 2 x 60G overnight');

  // the shop is closed early in the morning, open at 10 AM
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  assert.match(await page.evaluate(() => Farm.ui.modals[0].c.list.filter((o) => o.type === 'Text').map((o) => o.text).join(' ')), /closed/);
  await tapButton(page, 'OK');
  await page.evaluate(() => { Farm.session.state.time = 600; });
  await tapAction(page);
  await shot(page, '06-shop');
  const seedsBefore = s.inv.filter((x) => x && x.id === 'seed_turnip').reduce((a, b) => a + b.n, 0);
  const buyButtons = await page.evaluate(() => {
    const out = [];
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === 'Buy 5') out.push(o.getBounds());
      if (o.list) walk(o.list);
    });
    walk(Farm.ui.modals[0].c.list);
    return out.map((b) => ({ x: b.centerX, y: b.centerY }));
  });
  await page.touchscreen.tap(buyButtons[0].x, buyButtons[0].y); // 5 turnip seeds
  await frames(page);
  s = await state(page);
  assert.strictEqual(s.inv.filter((x) => x && x.id === 'seed_turnip').reduce((a, b) => a + b.n, 0), seedsBefore + 5);
  assert.strictEqual(s.gold, goldBefore + 120 - 100);
  assert.strictEqual(await page.evaluate(() => window.__gameBack()), true);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);

  // Back with nothing open shows the pause menu; Back again closes it
  assert.strictEqual(await page.evaluate(() => window.__gameBack()), true);
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  await shot(page, '07-pause');
  await page.evaluate(() => window.__gameBack());
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 0);

  // night falls
  await page.evaluate(() => { Farm.session.state.time = 21 * 60; Farm.bus.emit('hud'); });
  await frames(page);
  await shot(page, '08-night');

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
  const after = await state(again.page);
  assert.strictEqual(after.day, before.day);
  assert.strictEqual(after.gold, before.gold);
  assert.deepStrictEqual(after.soil, before.soil);
  assert.deepStrictEqual(after.inv, before.inv);
  assert.ok(Math.abs(after.player.x - before.player.x) <= 1);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('passing out at 2 AM ends the day with half energy', async () => {
  const { page, problems, context } = await open();
  await page.evaluate(() => window.__gameBack());
  await page.evaluate(() => { Farm.session.state.time = Farm.Config.PASS_OUT - 1; });
  await page.waitForFunction(() => Farm.session.state.day === 2 && !Farm.world.busy, null, SLOW);
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
async function meetAnimal(page, i, tx, ty) {
  await page.evaluate(([i, tx, ty]) => {
    const T = Farm.Config.TILE, m = Farm.world.herd.members[i];
    m.x = m.tx = tx * T + T / 2;
    m.y = m.ty = (ty + 0.8) * T;
    m.wait = 1e9;
  }, [i, tx, ty]);
  await teleport(page, tx, ty - 1, 'down');
}

const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);

test('animals: pet, feed, collect an egg, ship it, buy a cow, save', async () => {
  const { page, problems, context } = await open();
  await page.evaluate(() => window.__gameBack());
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
  assert.strictEqual(await actionLabel(page), 'Clucky', 'cared for: shows her name');
  await shot(page, '10-pen');

  // next morning there is an egg waiting
  await sleepThroughNight(page);
  s = await state(page);
  assert.strictEqual(s.animals[0].ready, 1);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members[0].bubble.visible), true, 'egg bubble shows');
  await meetAnimal(page, 0, 6, 33);
  await shot(page, '11-egg-ready');
  assert.strictEqual(await actionLabel(page), 'Collect');
  await tapAction(page);
  s = await state(page);
  const eggSlot = s.inv.findIndex((x) => x && x.id === 'egg');
  assert.ok(eggSlot >= 0, 'egg collected');
  assert.strictEqual(s.animals[0].ready, 0);

  // ship the egg
  await page.evaluate((i) => { Farm.session.state.sel = i; Farm.world.hintKey = null; }, eggSlot);
  await teleport(page, 10, 7, 'up');
  assert.strictEqual(await actionLabel(page), 'Ship');
  await tapAction(page);
  s = await state(page);
  assert.deepStrictEqual(s.box, [{ id: 'egg', n: 1 }]);

  // buy a cow from the Animals tab
  await page.evaluate(() => { Farm.session.state.gold = 1500; Farm.session.state.time = 600; });
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  await tapButton(page, 'Animals');
  await shot(page, '12-shop-animals');
  const buys = await page.evaluate(() => {
    const out = [];
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === 'Buy') out.push(o.getBounds());
      if (o.list) walk(o.list);
    });
    walk(Farm.ui.modals[0].c.list);
    return out.map((b) => ({ x: b.centerX, y: b.centerY }));
  });
  assert.strictEqual(buys.length, 2);
  await page.touchscreen.tap(buys[1].x, buys[1].y); // cow
  await frames(page);
  s = await state(page);
  assert.strictEqual(s.animals.length, 2);
  assert.strictEqual(s.animals[1].kind, 'cow');
  assert.strictEqual(s.animals[1].name, 'Daisy');
  assert.strictEqual(s.gold, 500);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members.length), 2);
  await page.evaluate(() => window.__gameBack());

  // the wrong feed is refused with a hint
  await page.evaluate(() => { Farm.Logic.addItem(Farm.session.state, 'chicken_feed', 1); });
  await page.evaluate(() => { Farm.session.state.sel = Farm.session.state.inv.findIndex((x) => x && x.id === 'chicken_feed'); Farm.world.hintKey = null; });
  await meetAnimal(page, 1, 6, 33);
  await shot(page, '13-cow');
  assert.strictEqual(await actionLabel(page), 'Feed');
  await tapAction(page);
  assert.strictEqual((await state(page)).animals[1].fed, 0, 'chicken feed does not feed a cow');

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
  // a farm in progress: day 9, rich, crops planted, two animals
  const progressed = await (async () => {
    const { page, context } = await open();
    const save = await page.evaluate(() => {
      const L = Farm.Logic, s = L.newState();
      s.day = 9;
      s.gold = 4321;
      L.till(s, 300);
      L.plant(s, 300, s.inv.findIndex((x) => x && x.id === 'seed_turnip'));
      L.buyAnimal(s, 'cow');
      return L.serialize(s);
    });
    await context.close();
    return save;
  })();

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
  await page.waitForFunction(() => Farm.ui && Farm.ui.refresh && Farm.world && Farm.world.herd, null, SLOW);
  await frames(page, 5);
  s = await state(page);
  assert.strictEqual(s.day, 1);
  assert.strictEqual(s.gold, 300);
  assert.deepStrictEqual(s.soil, {});
  assert.deepStrictEqual(s.animals.map((a) => a.name), ['Clucky']);
  assert.strictEqual(await page.evaluate(() => Farm.world.herd.members.length), 1);
  assert.strictEqual(await page.evaluate(() => Farm.world.crops && Object.keys(Farm.world.crops).length), 0);
  const last = JSON.parse(await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]));
  assert.strictEqual(last.d, 1, 'the new farm is saved straight away');
  assert.strictEqual(last.g, 300);

  // the welcome message shows, the HUD is live, and the farm is playable
  assert.strictEqual(await page.evaluate(() => Farm.ui.modals.length), 1);
  await shot(page, '15-new-game');
  await page.evaluate(() => window.__gameBack());
  assert.strictEqual(await page.evaluate(() => Farm.ui.dayText.text), 'Spring 1');
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
  // Spring 28 with a growing turnip
  const save = await (async () => {
    const { page, context } = await open();
    const out = await page.evaluate(() => {
      const L = Farm.Logic, s = L.newState();
      s.day = Farm.Config.DAYS_PER_SEASON;
      L.till(s, 12 * 24 + 5);
      L.plant(s, 12 * 24 + 5, s.inv.findIndex((x) => x && x.id === 'seed_turnip'));
      return L.serialize(s);
    });
    await context.close();
    return out;
  })();
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
    Farm.session.state.sel = Farm.session.state.inv.findIndex((x) => x && x.id === 'seed_tomato');
  });
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
  await teleport(page, 6, 11, 'down');
  await tapAction(page);
  assert.strictEqual((await state(page)).soil[12 * 24 + 6].c, 'tomato');

  // the shop's seeds tab follows the season
  await page.evaluate(() => { Farm.session.state.time = 600; });
  await teleport(page, 16, 32, 'up');
  await tapAction(page);
  const names = await page.evaluate(() => Farm.ui.modals[0].c.list.filter((o) => o.type === 'Text').map((o) => o.text));
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
  const winterShop = await page.evaluate(() => Farm.ui.modals[0].c.list.filter((o) => o.type === 'Text').map((o) => o.text).join(' '));
  assert.match(winterShop, /Nothing grows in winter/);
  await shot(page, '18-winter-shop');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

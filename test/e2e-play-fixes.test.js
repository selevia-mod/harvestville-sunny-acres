// The 2nd play test (22 Nov 2026; owner: "A, and the words are ok, fix them all"), on the screen:
//   1 the Forge's Big Truck: its 10 Obsidian chip was under the Make button (one squeezed line of 5 chips) and its
//     price read "1500k": two lines of chips now, and "1.5M"
//   2 Manila's Plains Gate sign said the Open Plains was "coming soon"
//   3 40 days away: "WELCOME BACK! 30 DAYS WENT BY"
//   4 the Ribbons page listed Nov 20 first on 22 Nov (over), then Oct 12, then Dec 24
//   5 14 shops showed the gold as "250000G" (the Armory: 250,000)
//   6 the Lighthouse, without the Wild Lands download: a "WILD LANDS" card about Pulag and Kanor
// Run alone, after node build.js: node --test --test-concurrency=1 test/e2e-play-fixes.test.js   (SHOTS=/some/dir)
// DIST=/other/checkout/dist runs it against another build (the one before: every test fails there).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.join(process.env.DIST || path.resolve(__dirname, '..', 'dist'), 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const DAY = new Date(2026, 10, 22, 10, 0).getTime(); // (Sunday 22 Nov 2026, 10 AM)
const ACTION_BTN = { x: 294, y: 512 };

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(savedState, now) {
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
  await page.addInitScript(([state, now]) => {
    window.__now = now;
    window.gameHost = { state: state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, now || DAY]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState(); // eslint-disable-line no-unused-vars
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; s.goal = 99; s.wv = C.NEWS_LATEST; s.name = 'Selene';
    eval(edit || ''); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit);
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const texts = (page) => page.evaluate(() => {
  const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out;
});

test('1: the Big Truck shows all 5 of its costs, on two lines, clear of its Make button; its price reads 1.5M', async () => {
  const { page, problems, context } = await open(await makeSave('s.gold = 250000;'));
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openForge(); });
  await frames(page, 6);
  const r = await page.evaluate(() => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], all = [];
    const walk = (l) => l.forEach((o) => { if (o.type === 'Text') all.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const name = all.find((t) => t.text === 'Big Truck');
    if (m.c.slimInto) m.c.slimInto(name);
    const row = name.parentContainer, inRow = all.filter((t) => t.parentContainer === row || (t.parentContainer && t.parentContainer.parentContainer === row));
    const box = (t) => { const b = t.getBounds(); return { s: t.text, l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    return { rowY: row.y, rows: inRow.map(box) };
  });
  await frames(page, 4);
  await shot(page, '1-big-truck');
  const at = (s) => r.rows.find((x) => x.s === s);
  const make = at('Make'), desc = r.rows.find((x) => /^60 Market Stars/.test(x.s));
  for (const s of ['1.5M', '20 Gold Ore', '20 Farm Cement', '12 Rope', '10 Obsidian']) {
    const c = at(s);
    assert.ok(c, s + ' is on the row: ' + r.rows.map((x) => x.s).join(' | '));
    assert.ok(c.r < make.l - 2, s + ' ends before the Make button: ' + JSON.stringify([c, make]));
    assert.ok(c.b <= desc.t + 1, s + ' is above the description');
    assert.ok(c.b - c.t >= 6.5, s + ' is not squeezed small: ' + (c.b - c.t));
  }
  assert.ok(!at('1500k'), 'no 1500k');
  assert.ok(desc.b <= r.rowY + 56 + 2 + (desc.b - desc.t) && desc.r < make.l, 'the description fits the row: ' + JSON.stringify(desc));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('2: Manila\'s Plains Gate sign: the way to the Open Plains, not "coming soon"', async () => {
  const { page, problems, context } = await open(await makeSave('s.sel = -1;'));
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('manila'); });
  await page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await frames(page, 4);
  const o = await page.evaluate(() => Farm.world.objects.filter((x) => x.name === 'mn_gatesign_plains').map((x) => ({ x0: x.x0, x1: x.x1, y0: x.y0, y1: x.y1 }))[0]);
  assert.ok(o, 'the sign');
  let label = null;
  for (const [tx, ty, dir] of [[o.x0, o.y1 + 1, 'up'], [o.x0 - 1, o.y0, 'right'], [o.x1 + 1, o.y0, 'left'], [o.x0, o.y0 - 1, 'down']]) {
    label = await page.evaluate(([tx, ty, dir]) => { Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.dir = dir; Farm.world.idle(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(Farm.ui.actionLabel.text)))); }, [tx, ty, dir]);
    if (label === 'Read') break;
  }
  assert.strictEqual(label, 'Read');
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page, 6);
  await page.waitForTimeout(300);
  await shot(page, '2-plains-sign');
  const t = (await texts(page)).join(' | ');
  assert.ok(/PLAINS GATE/.test(t) && /The Open Plains: take the east road out of Willowbrook\./.test(t), t);
  assert.ok(!/soon/i.test(t), t);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('3: back after 40 days: "40 DAYS WENT BY" (and 400), the title on the screen', async () => {
  const save = await makeSave('');
  for (const n of [40, 400]) {
    const { page, problems, context } = await open(save, new Date(2026, 10, 22 + n, 10, 0).getTime());
    await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
    await frames(page, 6);
    const t = await texts(page);
    await shot(page, '3-away-' + n);
    const title = 'WELCOME BACK! ' + n + ' DAYS WENT BY';
    assert.ok(t.includes(title), t.join(' | '));
    const b = await page.evaluate((title) => { let hit; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === title) hit = o; if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); const r = hit.getBounds(); return [r.left, r.right]; }, title);
    assert.ok(b[0] >= 8 && b[1] <= 352, 'the title fits: ' + b);
    assert.deepStrictEqual(problems, []);
    await context.close();
  }
});

test('4: no ribbons yet: the next contest first (22 Nov: Dec 24, then Oct 12, then Nov 20)', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openRibbons(0); });
  await frames(page, 6);
  await shot(page, '4-ribbons');
  const t = (await texts(page)).find((x) => /Enter a contest/.test(x));
  const lines = t.split('\n').filter((x) => /Contest|Cook-off/.test(x));
  assert.deepStrictEqual(lines, ['Dec 24  Noche Buena Cook-off (Starry Night)', 'Oct 12  Crop Contest (Harvest Festival)', 'Nov 20  Animal Contest (Cow Festival)']);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('5: the shops show the gold with commas (250,000G), like the Armory', async () => {
  const { page, problems, context } = await open(await makeSave('s.gold = 250000;'));
  for (const op of ['openForge', 'openShop', 'openKanor', 'openFlorist', 'openVet', 'openWagon', 'openWoodshop', 'openFoodShop', 'openFarmhands']) {
    await page.evaluate((op) => { Farm.ui.closeAll(); Farm.ui[op](); }, op);
    await frames(page, 4);
    const t = (await texts(page)).join(' | ');
    assert.ok(/250,000/.test(t), op + ': ' + t.slice(0, 200));
    assert.ok(!/250000/.test(t), op + ' has no 250000');
  }
  await shot(page, '5-farmhands');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('6: the Lighthouse without the Wild Lands download: a card about The Lost Tower, not the Wild Lands', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('manila'); });
  await page.waitForFunction(() => Farm.world.mapKey === 'manila' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  assert.strictEqual(await page.evaluate(() => Farm.packReady('wild')), false, '(no Wild Lands pack in this test page)');
  // outside the app (no download): it says where it comes from
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('tower'); });
  await frames(page, 6);
  await shot(page, '6-lighthouse');
  let t = (await texts(page)).join(' | ');
  assert.ok(/^THE LOST TOWER \| This needs the Wild Lands download \(the animals in it\), and it can only come through the Selebox app\./.test(t), t);
  assert.ok(!/WILD LANDS/.test(t), t);
  // in the app: the download card, Not now / Download
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.canFetch = () => true; Farm.packOnPhone = () => false; Farm.packCount = () => 0; Farm.world.packGate = false; Farm.world.travel('tower'); });
  await frames(page, 6);
  t = (await texts(page)).join(' | ');
  assert.ok(/^THE LOST TOWER \| This needs the Wild Lands download \(the animals in it\)\.\nA one-time download of [0-9.]+ (MB|KB)\. You can keep playing while it comes\./.test(t) || /^THE LOST TOWER \| This needs the Wild Lands download \(the animals in it\)\. \| A one-time download/.test(t), t);
  assert.ok(/Download/.test(t) && /Not now/.test(t), t);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'manila', 'still on the pier');
  // the Wild Lands' own places keep their card
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.askPack('wild', null, 'pulag'); });
  await frames(page, 3);
  assert.ok(/^WILD LANDS/.test((await texts(page)).join(' | ')));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

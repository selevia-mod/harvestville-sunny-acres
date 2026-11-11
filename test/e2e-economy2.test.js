// Browser playthroughs of farm economy v2, parts 2, 3 and 4 (docs/farm-economy-v2.md; src/*economy2.js): the Silo on
// every farm, training a raider with crops from it, a won practice raid bringing its crops home into it, the Mixer
// making Farm Cement, and a potion's effect (its chip, the walk, a free shot). Run alone after node build.js:
// node --test --test-concurrency=1 test/e2e-economy2.test.js (SHOTS=/some/dir saves screenshots).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const START = [2026, 11, 12, 10, 0];
const at = (when) => new Date(when[0], when[1] - 1, when[2], when[3] || 0, when[4] || 0).getTime();

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(savedState, when = START) {
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
  }, [savedState || null, at(when)]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; Farm.ui.closeAll(); });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a save from a farm opened once (it has its Silo): `edit` runs in the page (s, L, C, put(key, x, y) places a piece)
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = Farm.session.state;
    s.gold = 50000;
    s.energy = 100;
    s.look = 'boy';
    const put = (key, x, y) => { const t = C.OUTDOOR.index[key], p = L.yardFindSpot(s, Farm.farm(), t, x, y); s.yard.items.push({ t, x: p.x, y: p.y }); return p; };
    void put;
    // eslint-disable-next-line no-eval
    if (edit) eval(edit);
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const what = (page) => page.evaluate(() => { const a = Farm.world.resolve(); return a ? a.label : null; });
const toast = (page) => page.evaluate(() => (Farm.ui.toastText && Farm.ui.toastText.visible ? Farm.ui.toastText.text : ''));
const modalText = (page) => page.evaluate(() => {
  const out = [], m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return '';
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return out.join(' | ');
});
// taps the button whose label is `label` in the panel on top (the first one, or the one in the row named `row`)
const tapButton = async (page, label, row) => {
  const pos = await page.evaluate(([label, row]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    let at = null;
    const walk = (list, inRow) => list.forEach((o) => {
      if (at) return;
      const here = inRow || (o.list && o.list.some((x) => x.type === 'Text' && row && x.text.indexOf(row) === 0));
      if (o.type === 'Text' && o.text === label && (!row || inRow)) { const b = o.getBounds(); at = { x: b.centerX, y: b.centerY }; }
      if (o.list) walk(o.list, here);
    });
    walk(m.c.list, false);
    return at;
  }, [label, row || null]);
  assert.ok(pos, 'button ' + label + (row ? ' in ' + row : ''));
  await page.touchscreen.tap(pos.x, pos.y);
  await page.waitForTimeout(250);
};
// stands below a piece (its middle column), facing it
const faceFrom = async (page, key) => {
  await page.evaluate((key) => {
    const C = Farm.Config, T = C.TILE, t = C.OUTDOOR.index[key], it = Farm.session.state.yard.items.find((x) => x.t === t), type = C.OUTDOOR.types[t];
    Farm.world.setFeet((it.x + Math.floor(type.w / 2) + 0.5) * T, (it.y + type.h + 0.5) * T);
    Farm.world.dir = 'up';
    Farm.world.idle();
  }, key);
  await frames(page);
};

test('the Silo stands on every farm; training a raider takes its crops from it; not enough says so', async () => {
  const save = await makeSave("put('raid_camp', 28, 10); L.frState(s).camp = 1; L.siloPut(s, 'cabbage', 2); L.addItem(s, 'corn', 12);");
  const { page, problems, context } = await open(save);
  const silo = await page.evaluate(() => { const C = Farm.Config; return Farm.session.state.yard.items.filter((it) => it.t === C.OUTDOOR.index.silo).length; });
  assert.strictEqual(silo, 1, 'one Silo, kept from the first opening');
  await faceFrom(page, 'silo');
  assert.strictEqual(await what(page), 'Silo');
  await shot(page, 'econ2-silo');
  // the Silo's panel: store the corn
  await page.evaluate(() => Farm.world.resolve().run());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(page), /Silo \| Level 1 {3}· {3}2 \/ 300 crops/);
  await tapButton(page, 'Store all');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.siloHas(Farm.session.state, 'corn')), 12);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'corn')), 0);
  assert.match(await modalText(page), /14 \/ 300 crops.*Cabbage {2}x2.*Corn {2}x12/);
  await shot(page, 'econ2-silo-panel');
  await page.evaluate(() => Farm.ui.closeAll());
  // the Raid Camp's Party tab: the goat eats a cabbage
  await page.evaluate(() => Farm.ui.openRaidCamp('party'));
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(page), /Goat[^|]*\|[^|]*Eats 1 Cabbage \(you have 2\)/);
  const gold = await page.evaluate(() => Farm.session.state.gold);
  await tapButton(page, 'Train 20G', 'Goat');
  await tapButton(page, 'Train 20G', 'Goat');
  const after = await page.evaluate(() => { const s = Farm.session.state; return { cab: Farm.Logic.siloHas(s, 'cabbage'), train: s.fr.train.length, gold: s.gold }; });
  assert.deepStrictEqual(after, { cab: 0, train: 2, gold: gold - 40 }, 'two goats training, two cabbages gone from the Silo');
  await shot(page, 'econ2-train');
  await tapButton(page, 'Train 20G', 'Goat');
  assert.match(await toast(page), /Not enough of its food/);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.fr.train.length), 2);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a won practice raid brings its crops home into the Silo, instead of their worth in Gold', async () => {
  const save = await makeSave("put('raid_camp', 28, 10); const r = L.frState(s); r.camp = 3; r.army = { goat: 10, crow: 6 };");
  const { page, problems, context } = await open(save);
  await page.evaluate(() => Farm.ui.startRaid('b1'));
  await page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.ui.frBox && Farm.session.raid && Farm.session.raid.kind === 'bandit', null, SLOW);
  await page.waitForTimeout(600);
  const fought = await page.evaluate(() => {
    const w = Farm.world, b = w.raidB, f = b.farm, L = Farm.Logic, cells = [];
    for (let i = 0; i < f.drop.length; i++) if (f.drop[i] === '1') cells.push([i % f.w, Math.floor(i / f.w)]);
    const crop = b.loot.find((p) => p.kind === 'crops');
    cells.sort((p, q) => Math.hypot(p[0] - crop.x, p[1] - crop.y) - Math.hypot(q[0] - crop.x, q[1] - crop.y)); // (next to the field)
    let k = 0;
    ['goat', 'crow'].forEach((r) => { Farm.ui.raidSel = r; for (let i = 0; i < Farm.session.state.fr.army[r]; i++) w.raidDropAt(cells[k][0], cells[k++][1]); });
    w.raidStarted = true;
    while (!b.end) L.frStep(b);
    const taken = L.frTaken(b), got = L.frCropsOf(w.state, taken);
    w.raidFinish();
    return { taken, got };
  });
  assert.ok(fought.taken.crops > 0, 'the raiders carried crops: ' + JSON.stringify(fought.taken));
  const want = Object.values(fought.got).reduce((a, n) => a + n, 0);
  assert.strictEqual(want, fought.taken.crops, 'every crop carried is a crop of the bandit\'s field');
  await page.waitForTimeout(1200);
  const card = await page.evaluate(() => { const out = [], h = Farm.ui.frBox; const w = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) w(o.list); }); w(h.list); return out.join(' | '); });
  await shot(page, 'econ2-raid-won');
  assert.match(card, new RegExp('\\+' + want + ' crops to your Silo'));
  const prize = await page.evaluate(() => Farm.ui.raidPrize);
  assert.strictEqual(prize.crops, want);
  const silo = await page.evaluate(() => Object.assign({}, Farm.session.state.silo.c));
  assert.deepStrictEqual(silo, fought.got, 'the crops, by kind, in the Silo');
  assert.ok(Object.keys(silo).every((k) => ['turnip', 'potato', 'carrot', 'corn'].includes(k)));
  await page.evaluate(() => Farm.raidFarmLeave());
  await page.waitForFunction(() => !Farm.session.visit && Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  const saved = await page.evaluate(() => { Farm.world.save(); return JSON.parse(window.gameHost.saves[window.gameHost.saves.length - 1]).sl; });
  assert.ok(Array.isArray(saved) && saved.length === 1 + 2 * Object.keys(fought.got).length, 'saved: ' + JSON.stringify(saved));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Mixer makes Farm Cement from the Silo\'s crops: an hour, then Collect', async () => {
  const save = await makeSave("put('mixer', 28, 10); ['corn', 'wheat', 'carrot'].forEach((id) => L.siloPut(s, id, 3));");
  const { page, problems, context } = await open(save);
  await faceFrom(page, 'mixer');
  assert.strictEqual(await what(page), 'Open');
  await shot(page, 'econ2-mixer');
  assert.ok(await page.evaluate(() => Farm.world.textures.exists('props/mixer')), 'its picture (a stand-in until the owner\'s)');
  await page.evaluate(() => Farm.world.resolve().run());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(page), /Mixer[\s\S]*Farm Cement \| 3 Corn \(3\), 3 Wheat \(3\), 3 Carrot \(3\)/);
  await tapButton(page, 'Make', 'Farm Cement');
  assert.deepStrictEqual(await page.evaluate(() => Farm.session.state.ws.mixer.length), 1);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.siloCount(Farm.session.state)), 0, 'its crops came from the Silo');
  await shot(page, 'econ2-mixer-making');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => { window.__now += 61 * 60000; });
  await page.waitForTimeout(400);
  assert.strictEqual(await what(page), 'Collect');
  await page.evaluate(() => Farm.world.resolve().run());
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'farm_cement')), 1);
  // its icon: a frame of its own in the items texture
  assert.ok(await page.evaluate(() => { const f = Farm.ui.textures.get('items').get(Farm.Config.ICON.farm_cement); return !!f && f.source === Farm.ui.textures.get('items').econ2Src; }));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test("a potion's effect: Pineapple Juice (Drink, its chip, the walk power) and Hunter's Coffee (a free shot in Sierra Madre)", async () => {
  const save = await makeSave("L.addItem(s, 'pineapple_juice', 1); L.addItem(s, 'hunters_coffee', 1); L.addItem(s, 'arrows', 10); s.tools.bow = 1; s.energy = 50;");
  const { page, problems, context } = await open(save);
  await page.evaluate(() => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'pineapple_juice'); });
  await frames(page);
  assert.strictEqual(await what(page), 'Drink');
  await page.evaluate(() => Farm.world.resolve().run());
  await page.waitForTimeout(1300);
  assert.match(await toast(page), /Pineapple Juice: for 10 minutes, you walk 20% faster\./);
  assert.strictEqual(await page.evaluate(() => Farm.Logic.potionLeft(Farm.session.state, 'walk')), 10);
  const chip = await page.evaluate(() => { const c = Farm.ui.potChips && Farm.ui.potChips.walk; return c && c.box.visible ? c.text.text : null; });
  assert.strictEqual(chip, '10 min', 'its chip, with the minutes left');
  await shot(page, 'econ2-potion-chip');
  assert.ok(await page.evaluate(() => Farm.Logic.power(Farm.session.state, 'walk')), 'the walk power is on');
  // 10 minutes later: over, the chip gone
  await page.evaluate(() => { window.__now += 10 * 60000 + 1000; });
  await page.waitForTimeout(1300);
  assert.ok(!(await page.evaluate(() => Farm.Logic.power(Farm.session.state, 'walk'))));
  assert.strictEqual(await page.evaluate(() => Farm.ui.potChips.walk.box.visible), false);
  // Hunter's Coffee: a shot in the Sierra Madre costs 4 energy, none with it
  const shots = await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, was = s.map;
    s.map = 'sierra';
    const e0 = s.energy;
    L.shoot(s);
    const before = e0 - s.energy;
    s.sel = s.inv.findIndex((x) => x && x.id === 'hunters_coffee');
    L.eat(s, s.sel);
    const e1 = s.energy;
    L.shoot(s);
    s.map = was;
    return { before, after: e1 - s.energy, chip: !!Farm.ui.potChips };
  });
  assert.deepStrictEqual([shots.before, shots.after], [4, 0]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

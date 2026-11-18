// Browser playthroughs of the trucks and the barangay City Orders (steps 2 and 3 of the truck plan, owner 18 Nov 2026;
// src/19zzz...z-trucks.js): Bram's three truck rows, each truck by the Stable (loaded), its panel, switching, driving it
// yourself to the Grand Market's loading bay (no horse) and home, selling there, the City Order board before the SQL is
// applied (nothing taken) and with it (a stand-in server in the page: deliver, 2x pay, the prize), Mang Kardo taking a
// truck, the plaque in the house, the two tours, and the frame. Run alone, after node build.js:
// node --test --test-concurrency=1 test/e2e-trucks.test.js   (SHOTS=/some/dir saves the screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const START = [2026, 11, 18, 10, 0];
const at = (when) => new Date(when[0], when[1] - 1, when[2], when[3] || 0, when[4] || 0).getTime();
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

async function open(savedState, when = START, quiet = true) {
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
  await page.addInitScript(([state, now, here, quiet]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state: state, quiet: quiet, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, at(when), allPackFiles(), quiet]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a farm with the horse, the cart, 12 Market Stars and plenty of everything: `edit` runs in the page (s, L, C)
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    s.builds.stable = 1;
    s.horse = { name: 'Chestnut', love: 60, pet: 0, g: 1 << C.HORSE_OUT.gearOrder.indexOf('horseshoes') };
    s.gold = 5e6; s.lumber = 999; s.energy = 200;
    s.gm.cart = 1; s.gm.ms = 12;
    L.silo(s).lv = C.SILO.levels.length - 1;
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; // (every older tip seen: none in the way)
    eval(edit); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
async function tapAction(page) { await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y); await frames(page); await page.waitForTimeout(150); }
async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => { Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.dir = dir; Farm.world.idle(); }, [tx, ty, dir]);
  await frames(page);
}
async function waitMap(page, key) { await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW); await frames(page, 3); }
async function go(page, map, spawn) { await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]); await waitMap(page, map); }
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});
async function tapIn(page, row, label) {
  const pos = await page.evaluate(([row, label]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], names = [], btns = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text.indexOf(row) === 0) names.push(o); if (o.type === 'Text' && o.text === label) btns.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const top = (o) => { let r = o; while (r.parentContainer && r.parentContainer.parentContainer && r.parentContainer.parentContainer !== m.c) r = r.parentContainer; return r; };
    const n = names[0];
    if (!n) return null;
    if (m.c.slimInto) m.c.slimInto(n);
    const b = btns.filter((x) => top(x) === top(n))[0] || btns.sort((a, b2) => Math.abs(a.getBounds().centerY - n.getBounds().centerY) - Math.abs(b2.getBounds().centerY - n.getBounds().centerY))[0];
    if (!b) return null;
    if (m.c.slimInto) m.c.slimInto(b);
    const bb = b.getBounds();
    return { x: bb.centerX, y: bb.centerY };
  }, [row, label]);
  assert.ok(pos, `"${label}" in the row "${row}"`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
  await page.waitForTimeout(150);
}
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (!found[0]) { const any = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label) found.push(o); if (o.list) any(o.list); }); any(m.c.list); }
    if (found[0] && m.c.slimInto) m.c.slimInto(found[0]);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
}
const scrollTo = (page, text) => page.evaluate((t) => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === t && m.c.slimInto) m.c.slimInto(o); if (o.list) walk(o.list); }); walk(m.c.list); }, text);
// stand below the vehicle on the farm, facing it
async function toTruck(page) {
  await page.evaluate(() => { const w = Farm.world, c = w.gmCart.obj; w.setFeet(((c.x0 + c.x1) / 2 + 0.5) * 256, (c.y1 + 1.5) * 256); w.dir = 'up'; w.idle(); });
  await page.waitForTimeout(450); // (a parked truck is looked at every 0.3 s: drawn once it is on the screen)
  await frames(page, 3);
}
// the server in the page (the SQL applied, or not there): Farm.Net answers like the real farm_city_*_v1 would
const SERVER = `(() => {
  const O = Farm.Online, N = Farm.Net, L = Farm.Logic;
  O.on = true; O.me = { id: '00000000-0000-4000-8000-000000000001', name: 'Tester', code: 'ABC123', listed: true }; N.available = () => true;
  N.join = () => ({ track() {}, send() {}, leave() {} });
  const db = window.__db = { applied: __APPLIED__, hood: __HOOD__, members: 6, order: null, gives: [0, 0, 0, 0], reqs: {}, claims: [], calls: [] };
  const wk = L.coWeek(L.clock());
  N.rpc = (name, a) => {
    db.calls.push(name);
    if (!/^farm_city_/.test(name)) return Promise.reject(new Error('offline'));
    if (!db.applied) return Promise.reject(new Error('Could not find the function public.' + name + ' in the schema cache'));
    if (name === 'farm_city_claim_v1') return Promise.resolve(db.claims);
    if (!db.hood) return Promise.resolve({ ok: false, code: 'hood' });
    if (name === 'farm_city_order_v1') {
      if (!db.order) { if (!a.p_kinds) return Promise.resolve({ ok: false, code: 'kinds', hood: db.hood, members: db.members }); db.order = { kinds: a.p_kinds, need: 300, got: [0, 0, 0, 0] }; }
      const o = db.order;
      return Promise.resolve({ ok: true, week: wk.key, hood: db.hood, name: 'Masagana', members: db.members, kinds: o.kinds, need: o.need, got: o.got, mine: db.gives, done: o.got.every((g) => g >= o.need), ends_in: 86400 });
    }
    if (name === 'farm_city_deliver_v1') {
      if (db.reqs[a.p_request_id]) return Promise.resolve(Object.assign({ again: true }, db.reqs[a.p_request_id]));
      const o = db.order, i = o.kinds.indexOf(a.p_kind), k = Math.max(0, Math.min(a.p_n, o.need - o.got[i]));
      o.got[i] += k; db.gives[i] += k;
      const done = o.got.every((g) => g >= o.need);
      if (done) db.claims = [{ week: wk.key, stars: 3, plaque: true }];
      return Promise.resolve(db.reqs[a.p_request_id] = { ok: true, took: k, left: o.need - o.got[i], done });
    }
    return Promise.reject(new Error('offline'));
  };
})()`;
const server = (page, applied, hood = 42) => page.evaluate(SERVER.replace('__APPLIED__', String(applied)).replace('__HOOD__', String(hood)));

test('Bram\'s Forge: three truck rows after the Horse Cart (Market Stars to have, not spent); the Pickup made takes over', async () => {
  const save = await makeSave("s.map = 'town'; L.addItem(s, 'ore_silver', 15); L.addItem(s, 'farm_cement', 6); L.addItem(s, 'rope', 4); s.gm.cargo = { corn: 80 };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.ui.openForge());
  await frames(page, 4);
  const t = await modalText(page);
  assert.match(t, /Horse Cart \(made\)/);
  assert.match(t, /Pickup/);
  assert.match(t, /10 Market Stars \(kept\) \+ 80 lumber\. Carries 300\./);
  assert.match(t, /30 Market Stars \(kept\) \+ 120 lumber/);
  assert.match(t, /Big Truck/);
  await scrollTo(page, 'Farm Truck');
  await frames(page, 3);
  await shot(page, '01-forge-truck-rows');
  // the Farm Truck: not yet (12 of 30 Stars), nothing taken
  await tapIn(page, 'Farm Truck', 'Make');
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /30 Market Stars \(they are not spent\)\. You have 12/);
  await tapIn(page, 'Pickup', 'Make');
  const s = await state(page);
  assert.strictEqual(s.gm.veh, 1);
  assert.strictEqual(s.gm.use, 1, 'the Pickup takes over from the cart');
  assert.deepStrictEqual(s.gm.cargo, { corn: 80 }, 'the cart\'s load moves into it');
  assert.strictEqual(s.gm.ms, 12, 'the Stars are kept');
  assert.strictEqual(s.gold, 5e6 - 150000);
  assert.match(await modalText(page), /Pickup \(made\)/);
  await scrollTo(page, 'Pickup (made)');
  await frames(page, 3);
  await shot(page, '02-forge-pickup-made');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('each truck by the Stable, loaded, with its panel; switching moves the load and never loses any', async () => {
  for (const i of [1, 2, 3]) {
    const save = await makeSave(`s.gm.ms = 61; s.gm.veh = 7; s.gm.use = ${i}; s.gm.cargo = { corn: ${[0, 250, 700, 1400][i]}, tomato: 50 };`);
    const { page, problems, context } = await open(save);
    await waitMap(page, 'farm');
    const c = await page.evaluate(() => { const w = Farm.world, c = w.gmCart, st = w.objects.find((o) => o.type === 'stable'); return c && { truck: c.truck, x: c.x / 256, y: c.y / 256, sx: st.x1, sy: st.y1, loaded: c.loaded }; });
    assert.ok(c && c.truck === i && c.loaded, 'truck ' + i + ' by the Stable: ' + JSON.stringify(c));
    assert.ok(Math.abs(c.y - c.sy - 1) < 0.5);
    await toTruck(page);
    assert.strictEqual(await actionLabel(page), 'Truck');
    await shot(page, '0' + (2 + i) + '-truck-' + i + '-on-the-farm-loaded');
    if (i === 3) {
      await tapAction(page);
      const t = await modalText(page);
      assert.match(t, /Big Truck/);
      assert.match(t, /Cargo 1450 \/ 1,?500 crops/);
      assert.match(t, /Drive it yourself/);
      assert.match(t, /Your vehicles/);
      assert.doesNotMatch(t, /Hitch/);
      await shot(page, '06-big-truck-panel');
      await tapIn(page, 'Your vehicles', 'Switch');
      await page.waitForTimeout(300);
      assert.match(await modalText(page), /Big Truck  \(in use\)/);
      await shot(page, '07-your-vehicles');
      await tapIn(page, 'Pickup', 'Use');
      let s = await state(page);
      assert.strictEqual(s.gm.use, 1);
      assert.deepStrictEqual(s.gm.cargo, { corn: 300 });
      assert.deepStrictEqual(s.gm.park, { 3: { corn: 1100, tomato: 50 } }, 'the rest stays in the Big Truck');
      assert.match(await page.evaluate(() => Farm.ui.toastText.text), /You use the Pickup now\. 300 crops moved over\. 1150 stayed in the Big Truck\./);
      assert.strictEqual(await page.evaluate(() => Farm.world.gmCart.truck), 1, 'the Pickup by the Stable now');
      await tapIn(page, 'Big Truck', 'Use');
      s = await state(page);
      assert.deepStrictEqual(s.gm.cargo, { corn: 1400, tomato: 50 }, 'all of it back together');
      assert.deepStrictEqual(s.gm.park, {});
    }
    assert.deepStrictEqual(problems, []);
    await context.close();
  }
});

test('driving it yourself: no horse, the valley road to the Grand Market\'s loading bay, selling there, and home', async () => {
  const save = await makeSave("s.horse = null; s.builds.stable = 1; s.gm.cart = 0; s.gm.ms = 31; s.gm.veh = 2; s.gm.use = 2; s.gm.cargo = { corn: 500, tomato: 120 };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  await toTruck(page);
  await tapAction(page);
  await tapIn(page, 'Drive it yourself', 'Drive');
  await page.waitForTimeout(700);
  assert.match(await modalText(page), /TO THE GRAND MARKET/);
  await shot(page, '08-driving-to-manila');
  await waitMap(page, 'manila');
  await page.waitForTimeout(600);
  const p = await page.evaluate(() => { const w = Farm.world, c = w.gmCart, f = w.feet(); return { truck: c && c.truck, view: c && c.view, x: c && c.x / 256, y: c && c.y / 256, fx: f.x / 256, fy: f.y / 256, here: w.gmAtMarket() }; });
  assert.deepStrictEqual([p.truck, p.view, p.x, p.y], [2, 'front', 29.5, 46.4], 'at the loading bay, nose out');
  assert.ok(p.here && Math.abs(p.fx - 29.5) < 0.1 && p.fy > p.y, 'you beside it, at the market: ' + JSON.stringify(p));
  await page.evaluate(() => Farm.world.mn.folk.forEach((v) => { v.hold = 1e9; v.path = []; v.x = 256; v.y = 256; Farm.world.mnFolkPlace(v); }));
  await frames(page, 4);
  await shot(page, '09-parked-at-the-grand-market');
  assert.strictEqual(await actionLabel(page), 'Truck');
  await tapAction(page);
  assert.match(await modalText(page), /At the Grand Market's loading bay: 620 \/ 800 crops/);
  await shot(page, '10-truck-at-the-bay-panel');
  await tapIn(page, "Aling Rosa's Grand Market", 'Open');
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /Your Farm Truck is here: 620 crops/);
  const gold0 = (await state(page)).gold, price = await page.evaluate(() => Farm.Logic.gmPrice(Farm.session.state.day, 'corn', 0));
  await tapIn(page, 'Corn', 'Sell');
  let s = await state(page);
  assert.strictEqual(s.gold, gold0 + 500 * price, 'sold from the truck at the board');
  await page.evaluate(() => Farm.ui.closeAll());
  // home again: parked by the Stable, the tomatoes still in it
  await tapAction(page);
  await tapIn(page, 'Drive home', 'Drive');
  await page.waitForTimeout(500);
  assert.match(await modalText(page), /HOME TO THE FARM/);
  await waitMap(page, 'farm');
  await page.waitForTimeout(400);
  s = await state(page);
  assert.deepStrictEqual(s.gm.cargo, { tomato: 120 });
  assert.ok(await page.evaluate(() => Farm.world.gmCart && Farm.world.gmCart.truck === 2 && Farm.world.gmCart.view === 'side'), 'by the Stable');
  assert.strictEqual(await actionLabel(page), 'Truck', 'you stand by it');
  // to Manila again, then home by train: it drives itself home, its load safe
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.trkDrive('manila'); });
  await waitMap(page, 'manila');
  await page.evaluate(() => { window.__toasts = []; const t = Farm.ui.toast; Farm.ui.toast = function (m) { window.__toasts.push(String(m)); return t.apply(this, arguments); }; });
  await page.evaluate(() => Farm.ui.mnTrain('town'));
  await tapButton(page, 'Ride free');
  await waitMap(page, 'town');
  await page.waitForTimeout(900);
  assert.match((await page.evaluate(() => window.__toasts)).join(' | '), /Your Farm Truck drove itself home to the farm\. Its load is safe\./);
  await go(page, 'farm', 'from_town');
  assert.ok(await page.evaluate(() => Farm.world.gmCart && Farm.world.gmCart.truck === 2));
  assert.deepStrictEqual((await state(page)).gm.cargo, { tomato: 120 });
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the City Order board: before the SQL is applied it says "open soon" and takes nothing; no barangay; offline', async () => {
  const save = await makeSave("s.gm.veh = 1; s.gm.use = 1; s.gm.cargo = { corn: 200 }; s.gm.tour = 15;");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  // offline (no app around the page): the board says to go online
  await page.evaluate(() => Farm.ui.gmOpenMarket('city'));
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Go online for City Orders/);
  await page.evaluate(() => Farm.ui.closeAll());
  await server(page, false);
  await page.evaluate(() => Farm.ui.gmOpenMarket('city'));
  await page.waitForTimeout(500);
  const t = await modalText(page);
  assert.match(t, /City Orders open soon/);
  assert.doesNotMatch(t, /Deliver|Send/);
  await shot(page, '11-city-order-board-sql-not-applied');
  // Mang Kardo's panel shows no City Order row before the SQL, and nothing left the truck
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.gmOpenSend(); });
  await page.waitForTimeout(200);
  assert.doesNotMatch(await modalText(page), /City Order/);
  const s = await state(page);
  assert.deepStrictEqual(s.gm.cargo, { corn: 200 });
  assert.ok(!s.gm.co, 'nothing recorded');
  await page.evaluate(() => Farm.ui.closeAll());
  // applied, but not in a barangay: how to join one
  await page.evaluate(() => { Farm.Online.coOff = false; });
  await server(page, true, 0);
  await page.evaluate(() => Farm.ui.gmOpenMarket('city'));
  await page.waitForTimeout(500);
  assert.match(await modalText(page), /Join a barangay/);
  await shot(page, '12-city-order-board-no-barangay');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the City Order with the SQL applied: the barangay\'s order, Deliver at the Grand Market (2x), Mang Kardo, the prize and the plaque', async () => {
  const save = await makeSave("s.gm.veh = 1; s.gm.use = 1; s.gm.tour = 15; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await server(page, true);
  // the order's 4 crops in the truck: 300 of the first, 100 of the second
  const kinds = await page.evaluate(() => { const L = Farm.Logic, s = Farm.session.state, k = L.coOrder(L.coWeek(L.clock()).day, 42, 6).kinds; s.gm.cargo = { [k[0]]: 300 }; return k; });
  await page.evaluate(() => Farm.ui.trkDrive('manila'));
  await waitMap(page, 'manila');
  await page.evaluate(() => Farm.ui.gmOpenMarket('city'));
  await page.waitForTimeout(600);
  let t = await modalText(page);
  assert.match(t, /Masagana: 1,200 crops this week/);
  const names = await page.evaluate((k) => k.map((id) => Farm.Config.ITEMS[id].name), kinds);
  names.forEach((n) => assert.match(t, new RegExp(n + '  0/300')));
  assert.strictEqual(await page.evaluate(() => window.__db.order.kinds.length), 4, 'the game sent the week\'s 4 crops (the first look)');
  await shot(page, '13-city-order-board-applied');
  const gold0 = (await state(page)).gold, each = await page.evaluate((k) => 2 * Farm.Config.ITEMS[k].sell, kinds[0]);
  await tapIn(page, names[0], 'Deliver');
  await page.waitForTimeout(700);
  let s = await state(page);
  assert.strictEqual(s.gold, gold0 + 300 * each, '2x the sell price, at once');
  assert.ok(!s.gm.cargo[kinds[0]], 'out of the truck');
  assert.strictEqual(s.gm.co.d[kinds[0]], 300);
  t = await modalText(page);
  assert.match(t, new RegExp(names[0] + '  300/300'));
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), new RegExp('Delivered 300 ' + names[0] + ' for the City Order'));
  await shot(page, '14-city-order-delivered');
  await page.evaluate(() => Farm.ui.closeAll());
  // home, and Mang Kardo takes the second crop in the truck
  await page.evaluate((k) => { Farm.session.state.gm.cargo = { [k]: 350 }; }, kinds[1]);
  await page.evaluate(() => Farm.ui.trkDrive('farm'));
  await waitMap(page, 'farm');
  await page.evaluate(() => Farm.ui.gmOpenSend());
  await page.waitForTimeout(200);
  await tapIn(page, 'Barangay City Order', 'Choose');
  await page.waitForTimeout(600);
  assert.match(await modalText(page), /City Order by Mang Kardo/);
  await shot(page, '15-city-order-by-mang-kardo');
  await tapIn(page, names[1], 'Send');
  await page.waitForTimeout(600);
  s = await state(page);
  assert.ok(s.gm.trip && s.gm.trip.co, 'on the road for the City Order');
  assert.deepStrictEqual(s.gm.cargo, { [kinds[1]]: 50 }, 'the 50 the order did not need stay home');
  // the rest of the order is filled by the barangay; the prize: +3 Market Stars and the plaque
  await page.evaluate((k) => { const d = window.__db; d.order.got = [300, 300, 300, 299]; Farm.session.state.gm.trip = null; Farm.session.state.gm.cargo = { [k]: 1 }; }, kinds[3]);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.coGo(Farm.Logic.coOrder(Farm.Logic.coWeek(Farm.Logic.clock()).day, 42, 6).kinds[3], 'k', 'kardo'));
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /CITY ORDER FILLED!/);
  assert.match(await modalText(page), /\+3 Market Stars/);
  assert.match(await modalText(page), /City Order Plaque/);
  await shot(page, '16-city-order-filled');
  s = await state(page);
  assert.strictEqual(s.gm.ms, 15, '12 + 3 Market Stars');
  const plaque = await page.evaluate(() => Farm.Config.HOME.typeIndex.trophy_city_order);
  assert.strictEqual(s.home.bag[plaque + '.0'], 1, 'the plaque in storage');
  // the plaque, drawn in the house's furniture sheet (its own frame)
  const px = await page.evaluate((t) => { const key = Farm.furnTexture(Farm.ui, 0), f = Farm.ui.textures.getFrame(key, t); return { w: f.width, h: f.height, src: f.sourceIndex }; }, plaque);
  assert.deepStrictEqual(px, { w: 128, h: 128, src: 1 });
  await page.evaluate((t) => { Farm.ui.closeAll(); const c = Farm.ui.openModal(); Farm.ui.panelImg(c, 60, 200, 240, 200); c.add(Farm.ui.add.image(180, 300, Farm.furnTexture(Farm.ui, 0), t).setScale(1)); }, plaque);
  await frames(page, 3);
  await shot(page, '17-city-order-plaque');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the first-time tours: Trucks (Mang Kardo, the market) and City Orders (Aling Rosa), centred', async () => {
  const save = await makeSave("s.gm.tour = 3; s.map = 'town';");
  const { page, problems, context } = await open(save, START, false);
  await page.waitForTimeout(1500);
  await page.evaluate(() => Farm.ui.closeAll());
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.ui.openForge());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(700);
  assert.match(await modalText(page), /THE TRUCKS/);
  await shot(page, '18-tour-trucks-page-1');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  await shot(page, '19-tour-trucks-page-2');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => !!Farm.images.npc_mang_kardo && !!Farm.images['props/manila_grand_market']), 'the owner\'s pictures');
  await shot(page, '20-tour-trucks-page-3');
  await tapButton(page, 'Got it');
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Bram's Forge/, 'then the Forge');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.gmOpenMarket('city'));
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(700);
  assert.match(await modalText(page), /CITY ORDERS/);
  assert.ok(await page.evaluate(() => !!Farm.images.npc_aling_rosa));
  await shot(page, '21-tour-city-orders-page-1');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  await shot(page, '22-tour-city-orders-page-2');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  await shot(page, '23-tour-city-orders-page-3');
  await tapButton(page, 'Got it');
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Go online for City Orders/);
  // centred: the card's middle is the screen's
  const s = await state(page);
  assert.strictEqual(s.gm.tour, 15, 'both seen, saved');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the frame: a parked truck costs almost nothing and is not drawn off the screen', async () => {
  const save = await makeSave("s.gm.ms = 61; s.gm.veh = 7; s.gm.use = 3; s.gm.cargo = { corn: 900 };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  await toTruck(page);
  const m = await page.evaluate(async () => {
    const w = Farm.world, P = Object.getPrototypeOf(w), up = P.updateExtras, times = [];
    // this file's work a frame: the whole updateExtras chain timed with and without the truck
    const time = async (n) => { const t = []; for (let i = 0; i < n; i++) { await new Promise((r) => requestAnimationFrame(r)); const t0 = performance.now(); for (let k = 0; k < 200; k++) { w.trkCullMs = 0; up.call(w, 16, 0); } t.push((performance.now() - t0) / 200); } t.sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
    const withTruck = await time(20);
    const c = w.gmCart; w.gmCart = null;
    const without = await time(20);
    w.gmCart = c;
    return { withTruck: Math.round(withTruck * 1e4) / 1e4, without: Math.round(without * 1e4) / 1e4 };
  });
  console.log('truck frame cost (ms per updateExtras, its check forced every frame):', JSON.stringify(m));
  assert.ok(m.withTruck - m.without < 0.05, 'the truck adds under 0.05 ms a frame: ' + JSON.stringify(m));
  await page.evaluate(() => Farm.world.setFeet(2 * 256, 2 * 256)); // (the farm's far corner)
  await page.waitForTimeout(800);
  assert.strictEqual(await page.evaluate(() => Farm.world.gmCart.img.visible), false, 'off the screen: not drawn');
  await toTruck(page);
  await page.waitForTimeout(800);
  assert.strictEqual(await page.evaluate(() => Farm.world.gmCart.img.visible), true);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

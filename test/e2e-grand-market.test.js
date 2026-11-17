// Browser playthroughs of Aling Rosa's Grand Market and the horse cart (step 1 of the truck plan, owner 18 Nov 2026;
// src/19zzzz...-grand-market.js): Bram makes the cart, it stands by the Stable, loading it from the Silo and the bag, the
// price board and the contracts in Manila, riding there with the cart by the valley road and selling from it, Mang Kardo's
// trip and his message, the two first-time tours with the owner's pictures. Run alone, after node build.js:
// node --test --test-concurrency=1 test/e2e-grand-market.test.js   (SHOTS=/some/dir saves the screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const T = 256;
const START = [2026, 11, 18, 10, 0];
const at = (when) => new Date(when[0], when[1] - 1, when[2], when[3] || 0, when[4] || 0).getTime();

// the app's side of the packs (as e2e-horse-out.test.js): files from dist/packs, as the phone holds them
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
// a farm with the horse (6 hearts and Horseshoes), plenty of gold: `edit` runs in the page (s, L, C)
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    s.builds.stable = 1;
    s.horse = { name: 'Chestnut', love: 60, pet: 0, g: 1 << C.HORSE_OUT.gearOrder.indexOf('horseshoes') };
    s.gold = 50000;
    s.energy = 200;
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
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(150);
}
async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => { Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.dir = dir; Farm.world.idle(); }, [tx, ty, dir]);
  await frames(page);
}
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
}
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});
// taps the button `label` in the row whose name starts with `row` (a slim list scrolls it into view first)
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
    if (!found[0]) { const any = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label) found.push(o); if (o.list) any(o.list); }); any(m.c.list); } // (a tab)
    if (found[0] && m.c.slimInto) m.c.slimInto(found[0]);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
}
// stand below the cart on the farm, facing it
async function toCart(page) {
  await page.evaluate(() => { const w = Farm.world, c = w.gmCart.obj; w.setFeet((c.x0 + 0.5) * 256, (c.y1 + 1.5) * 256); w.dir = 'up'; w.idle(); });
  await frames(page, 3);
}
const RICH = "s.lumber = 100; L.addItem(s, 'ore_copper', 12); L.addItem(s, 'farm_cement', 3);";

test('Bram makes the Horse Cart (a new Forge row); it stands by the Stable; tap it to load from the Silo and the bag', async () => {
  const save = await makeSave(RICH + " s.map = 'town'; L.siloPut(s, 'corn', 120); L.addItem(s, 'tomato', 30); L.addItemQ(s, 'pumpkin', 8, 2);");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.ui.openForge());
  await frames(page, 4);
  assert.match(await modalText(page), /Horse Cart/);
  assert.match(await modalText(page), /Also 60 lumber\. It carries 100 crops/);
  await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === 'Horse Cart' && m.c.slimInto) m.c.slimInto(o); if (o.list) walk(o.list); }); walk(m.c.list); });
  await frames(page, 3);
  await shot(page, '01-forge-horse-cart-row');
  await tapIn(page, 'Horse Cart', 'Make');
  let s = await state(page);
  assert.strictEqual(s.gm.cart, 1, 'made');
  assert.strictEqual(s.gold, 30000);
  assert.strictEqual(s.lumber, 40);
  await page.evaluate(() => Farm.ui.closeAll());
  // home: the cart by the Stable
  await go(page, 'farm', 'from_town');
  const spot = await page.evaluate(() => { const w = Farm.world, c = w.gmCart, st = w.objects.find((o) => o.type === 'stable'); return c && { x: c.x / 256, y: c.y / 256, sx: st.x1, sy: st.y1, vis: c.img.visible }; });
  assert.ok(spot && spot.vis, 'the cart is on the farm');
  assert.ok(spot.x > spot.sx && spot.x < spot.sx + 4 && Math.abs(spot.y - spot.sy - 1) < 0.5, 'beside the Stable: ' + JSON.stringify(spot));
  await toCart(page);
  assert.strictEqual(await actionLabel(page), 'Cart');
  await shot(page, '02-cart-on-the-farm');
  await tapAction(page);
  let t = await modalText(page);
  assert.match(t, /Horse Cart/);
  assert.match(t, /Cargo 0 \/ 100 crops/);
  assert.match(t, /Send to the Grand Market/);
  assert.match(t, /Drive it yourself/);
  // from the Silo
  await tapButton(page, 'From Silo');
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /Corn  x120/);
  await tapIn(page, 'Corn', 'Load all');
  s = await state(page);
  assert.strictEqual(s.gm.cargo.corn, 100, 'a full cart');
  assert.strictEqual(s.silo.c.corn, 20);
  // unload 40 back, then the bag: the Gold pumpkins keep their star
  await tapButton(page, 'Cargo');
  await page.waitForTimeout(300);
  await tapIn(page, 'Corn  x100', 'Unload');
  s = await state(page);
  assert.ok(!s.gm.cargo.corn && s.silo.c.corn === 120, 'all back in the Silo');
  await tapButton(page, 'From bag');
  await page.waitForTimeout(300);
  await tapIn(page, 'Gold Pumpkin', 'Load all');
  await tapIn(page, 'Tomato', 'Load 10');
  await tapButton(page, 'From Silo');
  await page.waitForTimeout(300);
  await tapIn(page, 'Corn', 'Load all');
  s = await state(page);
  assert.deepStrictEqual(s.gm.cargo, { corn: 82, 'pumpkin~2': 8, tomato: 10 });
  await tapButton(page, 'Cargo');
  await page.waitForTimeout(300);
  await shot(page, '03-cart-load-panel');
  await page.evaluate(() => Farm.ui.closeAll());
  await frames(page, 3);
  await shot(page, '04-cart-loaded-by-the-stable');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the price board in Manila: today\'s prices, the hot crops on top, the contracts', async () => {
  const save = await makeSave("s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await go(page, 'manila', 'from_valley');
  const board = await page.evaluate(() => { const o = Farm.world.objects.find((x) => x.type === 'gm_board'); return o && [o.x0, o.y0, o.x1, o.y1]; });
  assert.deepStrictEqual(board, [25, 43, 26, 44], 'the order board by the market is the price board');
  await page.evaluate(() => Farm.world.mn.folk.forEach((v) => { v.hold = 1e9; v.path = []; v.x = 256; v.y = 256; Farm.world.mnFolkPlace(v); }));
  await teleport(page, 25, 45, 'up');
  assert.strictEqual(await actionLabel(page), 'Board');
  await tapAction(page);
  const t = await modalText(page);
  assert.match(t, /Aling Rosa's Grand Market/);
  const hot = await page.evaluate(() => Farm.Logic.gmHot(Farm.session.state.day).map((id) => Farm.Config.ITEMS[id].name));
  hot.forEach((n) => assert.match(t, new RegExp(n + '  x1\\.[678]\\d  HOT')));
  assert.ok(t.indexOf('HOT') < t.indexOf('x1.5') || t.indexOf('x1.5') < 0);
  await shot(page, '05-price-board');
  await tapButton(page, 'Contracts');
  await page.waitForTimeout(300);
  const c = await modalText(page);
  assert.match(c, /0\/\d+0 \| Pays \d+G each\. Ends in \d+ hours/); // (got / need: a progress bar)
  await shot(page, '06-contracts');
  await page.evaluate(() => Farm.ui.closeAll());
  // the market itself opens the board too
  await teleport(page, 19, 43, 'up'); // (Aling Rosa stands at its door)
  assert.strictEqual(await actionLabel(page), 'Market');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('riding to Manila with the cart by the valley road (6 hearts, Horseshoes), selling and delivering from it at the Grand Market', async () => {
  const save = await makeSave("s.gm.cart = 1; s.gm.cargo = { corn: 60, tomato: 40, 'pumpkin~2': 8 };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  // hitch it at the cart, then ride
  await toCart(page);
  await tapAction(page);
  await tapIn(page, 'Drive it yourself', 'Hitch');
  assert.ok(await page.evaluate(() => Farm.session.gmHitch), 'hitched');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => { const w = Farm.world, h = w.horse, f = w.feet(); h.x = f.x; h.y = f.y + 0.75 * 256; w.dir = 'down'; w.idle(); });
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Ride');
  await tapAction(page);
  assert.ok(await page.evaluate(() => Farm.session.riding));
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(600); await page.keyboard.up('ArrowLeft');
  await frames(page, 3);
  const trail = await page.evaluate(() => { const w = Farm.world, c = w.gmCart, h = w.horse; return Math.hypot(c.x - h.x, c.y - h.y) / 256; });
  assert.ok(trail > 1.2 && trail < 1.8, 'the cart follows on its rope: ' + trail);
  await go(page, 'town', 'from_farm');
  assert.ok(await page.evaluate(() => !!Farm.world.gmCart), 'in town behind the horse');
  const st0 = await page.evaluate(() => Farm.Logic.horseStamina(Farm.session.state));
  await go(page, 'manila', 'from_valley');
  assert.ok(await page.evaluate(() => Farm.session.riding), 'still riding in Manila');
  assert.ok(await page.evaluate(() => !!Farm.world.horse && !!Farm.world.gmCart), 'the horse and the cart in Manila');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.horseStamina(Farm.session.state)), st0 - 10, 'the road took 10 stamina');
  await page.evaluate(() => Farm.world.mn.folk.forEach((v) => { v.hold = 1e9; v.path = []; v.x = 256; v.y = 256; Farm.world.mnFolkPlace(v); }));
  await teleport(page, 25, 45, 'up');
  await frames(page, 6);
  assert.ok(await page.evaluate(() => Farm.world.gmAtMarket()), 'the cart is at the Grand Market');
  await page.evaluate(() => Farm.ui.closeAll());
  await shot(page, '07-horse-and-cart-at-the-grand-market');
  assert.strictEqual(await actionLabel(page), 'Board');
  await tapAction(page);
  let t = await modalText(page);
  assert.match(t, /Your cart is here: 108 crops/);
  await shot(page, '08-sell-from-the-cart');
  const gold0 = (await state(page)).gold, price = await page.evaluate(() => Farm.Logic.gmPrice(Farm.session.state.day, 'corn', 0));
  await tapIn(page, 'Corn', 'Sell');
  let s = await state(page);
  assert.strictEqual(s.gold, gold0 + 60 * price, 'sold at the board, no fee');
  assert.ok(!s.gm.cargo.corn);
  // 40 tomatoes: too few to sell
  await tapIn(page, 'Tomato', 'Sell');
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /50 or more at a time/);
  // a contract for tomatoes: deliver them
  const k = await page.evaluate(() => { const s = Farm.session.state; s.gm.cargo.tomato = 150; const c = Farm.Logic.gmContracts(s)[0]; s.gm.cargo = { [c.crop]: c.need }; return c.crop; });
  await page.evaluate(() => Farm.ui.closeAll());
  await tapAction(page);
  await tapButton(page, 'Contracts');
  await page.waitForTimeout(300);
  const name = await page.evaluate((k) => Farm.Config.ITEMS[k].name, k);
  await tapIn(page, (await page.evaluate(() => Farm.Logic.gmContracts(Farm.session.state)[0].need)) + ' ' + name, 'Deliver');
  s = await state(page);
  assert.strictEqual(s.gm.ms, 1, 'a Market Star');
  assert.match(await modalText(page), /DONE/);
  await page.evaluate(() => Farm.ui.closeAll());
  // the train home leaves the horse and the cart in Manila, as before
  await page.evaluate(() => Farm.ui.mnTrain('town'));
  await tapButton(page, 'Ride free');
  await waitMap(page, 'town');
  assert.ok(!(await page.evaluate(() => Farm.session.riding)), 'off the horse');
  assert.strictEqual(await page.evaluate(() => Farm.session.horseAt && Farm.session.horseAt.map), 'manila');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('without 6 hearts the valley road is walked: off the horse, it waits at the road\'s end, the cart with it', async () => {
  const save = await makeSave("s.horse.love = 40; s.gm.cart = 1; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await page.evaluate(() => { Farm.session.horseAt = null; Farm.session.riding = true; Farm.session.gmHitch = true; });
  await go(page, 'farm', 'from_town');
  await go(page, 'town', 'from_farm');
  assert.ok(await page.evaluate(() => Farm.session.riding && !!Farm.world.gmCart));
  await page.evaluate(() => { window.__toasts = []; const t = Farm.ui.toast; Farm.ui.toast = function (m) { window.__toasts.push(String(m)); return t.apply(this, arguments); }; });
  await go(page, 'manila', 'from_valley');
  assert.ok(!(await page.evaluate(() => Farm.session.riding)), 'walked');
  assert.strictEqual(await page.evaluate(() => Farm.world.gmCart), null, 'no cart here');
  assert.match((await page.evaluate(() => window.__toasts)).join(' | '), /Chestnut needs 6 hearts for Manila \(it has 4\)\. Pet it and give it Pet Meals\.\nIt waits here; you walk on\./);
  assert.strictEqual(await page.evaluate(() => Farm.session.horseAt.map), 'town');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Mang Kardo takes the load: the cart is away, and 30 minutes later the gold and his message', async () => {
  const save = await makeSave("s.gm.cart = 1; s.gm.cargo = { corn: 100 };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  await toCart(page);
  await tapAction(page);
  await tapIn(page, 'Send to the Grand Market', 'Send');
  assert.match(await modalText(page), /Send Mang Kardo/);
  assert.match(await modalText(page), /100 crops: [\d,]+G, you get [\d,]+G after his 10%/);
  await shot(page, '09-send-mang-kardo');
  const gold0 = (await state(page)).gold, q = await page.evaluate(() => Farm.Logic.gmSendQuote(Farm.session.state, 'sell'));
  await tapIn(page, "Sell at today's prices", 'Send');
  let s = await state(page);
  assert.ok(s.gm.trip, 'on the road');
  assert.strictEqual(await page.evaluate(() => Farm.world.gmCart), null, 'the cart is away');
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /Mang Kardo drives off to Manila with 100 crops\. Back in 30 minutes/);
  // closed and opened again 45 minutes later: the gold and his message
  const saved = await page.evaluate(() => { Farm.world.save(); return window.gameHost.state; });
  await context.close();
  const again = await open(saved, [2026, 11, 18, 10, 45]);
  await waitMap(again.page, 'farm');
  await again.page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  const t = await modalText(again.page);
  assert.match(t, /MANG KARDO IS BACK!/);
  assert.match(t, /Sold 100 Corn at the Grand Market/);
  assert.match(t, new RegExp('You got ' + q.net.toLocaleString('en-US') + 'G'));
  await shot(again.page, '10-mang-kardo-is-back');
  s = await state(again.page);
  assert.strictEqual(s.gold, gold0 + q.net);
  assert.ok(!s.gm.trip);
  await again.page.evaluate(() => Farm.ui.closeAll());
  await frames(again.page, 3);
  assert.ok(await again.page.evaluate(() => !!Farm.world.gmCart), 'the cart is back by the Stable');
  assert.deepStrictEqual(problems.concat(again.problems), []);
  await again.context.close();
});

test('the first-time tours: the board (Aling Rosa, the market) and the cart (Mang Kardo), with the owner\'s pictures', async () => {
  const save = await makeSave("s.gm.cart = 1; s.map = 'town';");
  const { page, problems, context } = await open(save, START, false);
  await page.waitForTimeout(1500);
  await page.evaluate(() => Farm.ui.closeAll());
  await waitMap(page, 'town');
  await page.evaluate(() => { window.gameHost.quiet = true; });
  await go(page, 'manila', 'from_valley');
  await page.evaluate(() => { Farm.ui.closeAll(); window.gameHost.quiet = false; });
  await page.evaluate(() => Farm.ui.gmOpenMarket());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(700);
  assert.match(await modalText(page), /ALING ROSA'S GRAND MARKET/);
  assert.ok(await page.evaluate(() => !!Farm.images['props/manila_grand_market'] && !!Farm.images.npc_aling_rosa), 'the owner\'s pictures');
  await shot(page, '11-tour-board-page-1');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  await shot(page, '12-tour-board-page-2');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  await shot(page, '13-tour-board-page-3');
  await tapButton(page, 'Got it');
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Aling Rosa's Grand Market/, 'then the board itself');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => { window.gameHost.quiet = true; });
  await go(page, 'farm', 'from_town');
  await page.evaluate(() => { Farm.ui.closeAll(); window.gameHost.quiet = false; });
  await page.evaluate(() => Farm.ui.gmOpenCart());
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(700);
  assert.match(await modalText(page), /THE HORSE CART/);
  await shot(page, '14-tour-cart-page-1');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  await shot(page, '15-tour-cart-page-2');
  await tapButton(page, 'Next');
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => !!Farm.images.npc_mang_kardo));
  await shot(page, '16-tour-cart-page-3');
  await tapButton(page, 'Got it');
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /Cargo 0 \/ 100/);
  const s = await state(page);
  assert.strictEqual(s.gm.tour, 3, 'both seen');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the frame: the cart and the horse in Manila add almost nothing (measured), and nothing while off the screen', async () => {
  const save = await makeSave("s.gm.cart = 1; s.gm.cargo = { corn: 100 }; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await page.evaluate(() => { Farm.session.riding = true; Farm.session.horseAt = null; Farm.session.gmHitch = true; });
  await go(page, 'farm', 'from_town');
  await go(page, 'town', 'from_farm');
  await go(page, 'manila', 'from_valley');
  // the cost of this file's work each frame: the trail and the horse's check, timed over many frames
  const m = await page.evaluate(async () => {
    const w = Farm.world, P = Object.getPrototypeOf(w), trail = P.gmTrail, times = [];
    let n = 0;
    P.gmTrail = function (h) { const t0 = performance.now(); trail.call(this, h); times.push(performance.now() - t0); n++; };
    const end = Date.now() + 1500;
    await new Promise((r) => { const step = () => { const f = w.feet(); w.setFeet(f.x + (n % 120 < 60 ? 8 : -8), f.y); if (Date.now() < end) requestAnimationFrame(step); else r(); }; step(); });
    P.gmTrail = trail;
    times.sort((a, b) => a - b);
    // and one frame's trail, 20,000 times over (the page's timer is too coarse for a single one)
    const h = w.horse, x0 = h.x, t0 = performance.now();
    for (let i = 0; i < 20000; i++) { h.x = x0 + (i % 50) * 8; w.gmTrail(h); }
    const each = (performance.now() - t0) / 20000;
    h.x = x0;
    return { n, median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)], usPerFrame: Math.round(each * 1000 * 100) / 100 };
  });
  assert.ok(m.n > 30, 'frames: ' + m.n);
  assert.ok(m.p95 < 0.5 && m.usPerFrame < 50, 'the cart\'s work a frame (ms): ' + JSON.stringify(m));
  // off the screen: dismounted, the horse waits; the camera far away; the horse and the cart are not drawn
  await page.evaluate(() => { const w = Farm.world; w.dismount(); Farm.session.horseFollow = false; w.horseWait(); w.setFeet(60 * 256, 70 * 256); });
  await page.waitForTimeout(900);
  const off = await page.evaluate(() => { const w = Farm.world; return { off: w.gmHorseOff, horse: w.horse.sprite.visible, cart: w.gmCart.img.visible }; });
  assert.deepStrictEqual(off, { off: true, horse: false, cart: false });
  console.log('cart frame cost (ms):', JSON.stringify(m));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

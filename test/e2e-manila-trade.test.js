// Browser playthroughs of Mang Danny's Trading Post and the Talipapa's vendors (owner, 18 Nov 2026;
// src/19z...z-manila-trade.js): the Trading Post's front says Shop, its tour the first time (the owner's pictures), Buy
// and Sell, the weekly rare trade inside it; each Talipapa vendor's Buy, the Talipapa's tour, their goods; a full bag
// sends what you buy to the basket. Run alone, after node build.js:
// node --test --test-concurrency=1 test/e2e-manila-trade.test.js   (SHOTS=/some/dir saves the screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const PACKS = path.join(__dirname, '..', 'dist', 'packs');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const TEN = [2026, 4, 1, 10, 0];

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(150);
}
async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => { Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.dir = dir; Farm.world.idle(); }, [tx, ty, dir]);
  await frames(page);
}
// taps the button `label` in the row whose name starts with `row` (or anywhere, with no row)
async function tapIn(page, row, label) {
  const pos = await page.evaluate(([row, label]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], names = [], btns = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && row && o.text.indexOf(row) === 0) names.push(o); if (o.type === 'Text' && o.text === label) btns.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const n = names[0];
    if (row && !n) return null;
    const b = n ? btns.sort((a, b2) => Math.abs(a.getBounds().centerY - n.getBounds().centerY) - Math.abs(b2.getBounds().centerY - n.getBounds().centerY))[0] : btns[0];
    if (!b) return null;
    const bb = b.getBounds();
    return { x: bb.centerX, y: bb.centerY };
  }, [row, label]);
  assert.ok(pos, `"${label}"` + (row ? ` in the row "${row}"` : ''));
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
  await page.waitForTimeout(200);
}
const tapButton = (page, label) => tapIn(page, null, label);
const pics = (page) => page.evaluate(() => { const out = [], walk = (l) => l.forEach((o) => { if (o.texture) out.push(o.texture.key); if (o.list) walk(o.list); }); walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list); return out; });

// a farm in Manila, made by this game's own rules: `edit` runs in the page (s, L, C)
async function makeSave(edit, tx, ty) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await context.newPage();
  await page.route('**/*', (route) => { const u = route.request().url(); return u.startsWith('file:') || u.startsWith('data:') ? route.continue() : route.abort(); });
  await page.addInitScript((now) => { window.gameHost = { state: null, quiet: true, save() {}, now: () => now }; }, at(TEN));
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player, null, SLOW);
  const save = await page.evaluate(([edit, tx, ty]) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState(); // eslint-disable-line no-unused-vars
    s.gold = 5000; s.energy = 100; s.map = 'manila'; s.player = { x: tx * 256 + 128, y: ty * 256 + 128, dir: 'down' };
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; L.takeTip(s, 'manila_hello');
    eval(edit); // eslint-disable-line no-eval
    return L.serialize(s);
  }, [edit || '', tx, ty]);
  await context.close();
  return save;
}
// the city with the packs on the phone (as e2e-manila.test.js's openCity)
async function openCity(edit, tx, ty) {
  const save = await makeSave(edit, tx, ty);
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await context.exposeBinding('__appAsset', (src, file) => {
    const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file), p = m && path.join(PACKS, m[1] + '.webp');
    return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith('file:') || u.startsWith('data:')) return route.continue(); problems.push('network: ' + u); return route.abort(); });
  const all = fs.readdirSync(PACKS).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
  await page.addInitScript(([state, now, here]) => {
    window.__now = now;
    window.gameHost = { state, quiet: true, save(s) { this.state = s; }, now: () => window.__now, here,
      asset(f, save) { setTimeout(() => window.__appAsset(f).then((u) => (save ? window.__gameAssetSaved(f, !!u) : window.__gameAsset(f, u))), 20 + Math.random() * 60); } };
  }, [save, at(TEN), all]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.mn && Farm.packReady('manila') && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await frames(page, 6);
  return { page, problems, context };
}
// everyone in the city but `keep` (roles) out of the way
const clearCrowd = (page, keep = []) => page.evaluate((keep) => {
  const w = Farm.world;
  w.mn.folk.forEach((v) => { if (keep.indexOf(v.role) >= 0) { v.hold = 1e9; v.path = []; return; } v.hold = 1e9; v.path = []; v.x = 256; v.y = 256; w.mnFolkPlace(v); });
  w.mn.people.forEach((v) => { v.hold = 1e9; v.path = []; v.x = 512; v.y = 256; w.mnPlace(v); });
}, keep);

test('the Trading Post: Shop at its front, the tour the first time, Buy and Sell, the rare trade inside', async () => {
  const { page, problems, context } = await openCity("L.addItem(s, 'rope', 6); L.addItem(s, 'kesong_puti', 2); const f = L.friend(s, 'mn_danny'); f.met = 1; f.pts = 80;", 40, 45);
  const spot = await page.evaluate(() => { const o = Farm.world.objects.find((x) => x.type === 'mn_spot' && x.name === 'trading'); return o && [o.x0, o.x1, o.y1]; });
  assert.ok(spot, 'the Trading Post is there');
  await clearCrowd(page);
  await teleport(page, spot[0], spot[2] + 1, 'up');
  assert.strictEqual(await actionLabel(page), 'Shop');
  await shot(page, '01-trading-post-front');
  await page.evaluate(() => { window.gameHost.quiet = false; });
  await tapAction(page);
  let t = await modalText(page);
  assert.match(t, /MANG DANNY'S TRADING POST/, 'the first time: the tour');
  const p = await pics(page);
  assert.ok(p.includes('props/manila_trading_post') && p.includes('npc_mang_danny'), 'the owner\'s pictures: ' + p);
  await shot(page, '02-tour-trading-post-1');
  await tapButton(page, 'Next');
  assert.match(await modalText(page), /170G.*340G|Sell 170G \| Buy 340G/);
  await shot(page, '03-tour-trading-post-2');
  await tapButton(page, 'Next');
  await shot(page, '04-tour-trading-post-3');
  await tapButton(page, 'Got it');
  await frames(page, 4);
  t = await modalText(page);
  assert.match(t, /Mang Danny's Trading Post/);
  assert.match(t, /Rare trade: 1 Amethyst/, 'his weekly trade, at the top (this week: 2 Kesong Puti for an Amethyst)');
  assert.match(t, /Farm Cement  ·  240G \| Left today: 20 of 20\. You have 0\./);
  assert.match(t, /Rope  ·  340G/);
  await shot(page, '05-trading-post-buy-tab-with-rare-trade');
  await tapIn(page, 'Farm Cement', 'Buy 5');
  let s = await state(page);
  assert.strictEqual(s.gold, 5000 - 5 * 240);
  assert.match(await modalText(page), /Farm Cement  ·  240G \| Left today: 15 of 20\. You have 5\./);
  // the rare trade from the shop
  await tapIn(page, 'Rare trade', 'Trade');
  s = await state(page);
  assert.ok(s.inv.some((x) => x && x.id === 'amethyst'), 'the Amethyst');
  assert.ok(!s.inv.some((x) => x && x.id === 'kesong_puti'), 'for the kesong puti');
  assert.match(await modalText(page), /This week's is done/);
  // Sell: he pays the sell price
  await tapButton(page, 'Sell');
  await page.waitForTimeout(300);
  t = await modalText(page);
  assert.match(t, /Rope  ·  170G each \| You have 6\. He buys any amount\./);
  await shot(page, '06-trading-post-sell-tab');
  await tapIn(page, 'Rope', 'Sell all');
  s = await state(page);
  assert.strictEqual(s.gold, 5000 - 1200 + 6 * 170);
  assert.ok(!s.inv.some((x) => x && x.id === 'rope'));
  // the second time: straight in
  await page.evaluate(() => Farm.ui.closeAll());
  await tapAction(page);
  assert.doesNotMatch(await modalText(page), /Next/);
  assert.match(await modalText(page), /Mang Danny's Trading Post/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

const VENDORS = [['meat_vendor', 'The Meat Stall', 'Labuyo Meat  ·  48G'], ['fish_vendor', 'The Fish Stall', 'Small Fish  ·  60G'], ['veg_vendor', 'The Vegetable Stall', 'Garlic  ·  24G']];
test('the Talipapa: each vendor says Buy, the tour the first time, their goods at twice the sell price, 30 of each a day; a full bag fills the basket', async () => {
  const { page, problems, context } = await openCity('', 12, 34);
  await clearCrowd(page, VENDORS.map((v) => v[0]));
  const posts = await page.evaluate(() => Farm.world.mn.roles.filter((v) => /_vendor$/.test(v.role) && v.role !== 'balut').map((v) => [v.role, v.x / 256, v.y / 256, v.inside, v.sp.texture.key]));
  let first = true;
  for (const [role, title, row] of VENDORS) {
    const v = posts.find((x) => x[0] === role);
    assert.ok(v && !v[3], role + ' is at the stall at 10 AM');
    assert.match(v[4], /^npc_/, 'their own picture');
    await teleport(page, Math.floor(v[1]) + 1, Math.floor(v[2]), 'left');
    assert.strictEqual(await actionLabel(page), 'Buy', role);
    if (first) {
      await shot(page, '07-talipapa-vendor-buy');
      await page.evaluate(() => { window.gameHost.quiet = false; });
      await tapAction(page);
      assert.match(await modalText(page), /THE TALIPAPA/, 'the first time: the tour');
      const p = await pics(page);
      assert.ok(['meat', 'fish', 'veg'].every((k) => p.includes('props/manila_talipapa_' + k)), 'the owner\'s stalls: ' + p);
      await shot(page, '08-tour-talipapa-1');
      await tapButton(page, 'Next');
      await shot(page, '09-tour-talipapa-2');
      await tapButton(page, 'Next');
      await shot(page, '10-tour-talipapa-3');
      await tapButton(page, 'Got it');
      await frames(page, 4);
      first = false;
    } else await tapAction(page);
    const t = await modalText(page);
    assert.match(t, new RegExp(title));
    assert.match(t, new RegExp(row.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\| Left today: 30 of 30'));
    await shot(page, '1' + (1 + VENDORS.findIndex((x) => x[0] === role)) + '-talipapa-' + role.replace('_vendor', '') + '-shop');
    await page.evaluate(() => Farm.ui.closeAll());
  }
  // buying: the bag, then (full) the basket; the stock goes down
  await page.evaluate(() => { const s = Farm.session.state; s.inv = s.inv.map(() => ({ id: 'egg', n: 999 })); s.inv[0] = null; });
  const veg = posts.find((x) => x[0] === 'veg_vendor');
  await teleport(page, Math.floor(veg[1]) + 1, Math.floor(veg[2]), 'left');
  await tapAction(page);
  await tapIn(page, 'Garlic', 'Buy 5');
  let s = await state(page);
  assert.strictEqual(s.inv[0].id, 'garlic');
  assert.strictEqual(s.inv[0].n, 5);
  await page.evaluate(() => { Farm.session.state.inv[0] = { id: 'egg', n: 999 }; });
  await tapIn(page, 'Garlic', 'Buy 5');
  s = await state(page);
  assert.strictEqual(s.basket.garlic, 5, 'no room in the bag: the basket');
  assert.match(await modalText(page), /Garlic  ·  24G \| Left today: 20 of 30/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Farm Raids step 2 end to end: two phones (a raider and a farm), each the real game in the real app bridge over the
// test Supabase (test/net-mock.js, with part 25's functions), and the real game server's check (server/lib/fraid.js)
// behind a stand-in WebSocket. Run alone: node --test test/e2e-fraid.test.js (SHOTS=/some/dir saves screenshots).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');
const { makeFraid } = require('../server/lib/fraid');
const { load } = require('../server/lib/rules');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file) || null;
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && require('fs').existsSync(p) ? 'data:image/webp;base64,' + require('fs').readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => require('fs').readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// the game server: the real check, its Supabase calls answered by the test Supabase as the token's player
function gameServer(server) {
  const fetch = async (url, init) => {
    const name = url.split('/rpc/')[1], uid = init.headers.Authorization.replace('Bearer test-token:', '');
    const r = await server.supabaseFor(uid).rpc(name, JSON.parse(init.body));
    return { ok: !r.error, status: r.error ? 400 : 200, json: async () => r.data };
  };
  return makeFraid({ url: 'https://sb.test', anonKey: 'anon', key: server.db.fraid.key, fetch, rules: load() });
}

async function open(server, fraid) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
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
  const uid = server.newUser();
  const webViewRef = { current: { injectJavaScript: (code) => { page.evaluate(code).catch(() => {}); } } };
  const bridge = createSunnyAcresBridge({ supabase: server.supabaseFor(uid), webViewRef });
  await context.exposeBinding('__rnPost', (source, data) => { bridge.onMessage({ nativeEvent: { data } }); });
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  // the game server's line: what the phone sends goes to the real check; its answer comes back
  await context.exposeBinding('__frSend', async (src, raw) => { const m = JSON.parse(raw); return JSON.stringify(Object.assign({ t: 'frr', raid: m.raid }, await fraid.settle(m.token, m.raid, m.moves))); });
  await page.addInitScript((here) => {
    window.ReactNativeWebView = { postMessage: (data) => window.__rnPost(data) };
    window.__here = here;
    window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, gs: 'wss://game.test/' };
    window.WebSocket = class {
      constructor(url) { this.url = url; setTimeout(() => this.onopen && this.onopen(), 20); }
      send(s) { const m = JSON.parse(s); if (m.t !== 'fr') return; window.__frSend(s).then((a) => this.onmessage && this.onmessage({ data: a })); }
      close() {}
    };
  }, allPackFiles());
  await page.addInitScript(HOST_ASSETS);
  await page.addInitScript(bridge.injectedJavaScriptBeforeContentLoaded);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.Online.on, null, SLOW);
  return { page, problems, context, uid };
}
const modalText = (page) => page.evaluate(() => {
  const out = [], m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return '';
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return out.join(' | ');
});
const waitModal = (page, re) => page.waitForFunction((src) => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return false;
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return new RegExp(src).test(out.join(' | '));
}, re.source, SLOW).catch(async (e) => { throw new Error(e.message.split('\n')[0] + '\n  wanted: ' + re + '\n  shown: ' + await modalText(page).catch(() => '?')); });
const frText = (page) => page.evaluate(() => { const out = [], h = Farm.ui.frBox; if (!h) return ''; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(h.list); return out.join(' | '); });
const tapDialog = async (page, label) => {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1]; let at = null;
    const walk = (l) => l.forEach((o) => { if (!at && o.type === 'Text' && o.text === label) { const b = o.getBounds(); at = { x: b.centerX, y: b.centerY }; } if (o.list) walk(o.list); });
    walk(m.c.list); return at;
  }, label);
  assert.ok(pos, 'button ' + label);
  await page.touchscreen.tap(pos.x, pos.y);
};
// the battle, run to its end at once (the drops: 8 goats wherever they may come down)
const fight = (page) => page.evaluate(() => {
  const w = Farm.world, b = w.raidB, L = Farm.Logic;
  let n = 0;
  for (let y = 0; y < b.farm.h && n < 8; y++) for (let x = 0; x < b.farm.w && n < 8; x++) if (L.frEdge(b, x, y) && L.frDrop(b, 'goat', x, y)) n++;
  w.raidStarted = true;
  while (!b.end) L.frStep(b);
  w.raidFinish();
  return { n, taken: L.frTaken(b), stars: L.frStars(b) };
});

test('a real raid: find a farm, raid it, the game server counts it, the prize; the farm sees it, loses it, Replay and Revenge', async () => {
  const server = createServer(), fraid = gameServer(server);
  // ---- the farm: ripe crops, the stall's goods and coins; 30 days old
  const B = await open(server, fraid);
  await B.page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, w = Farm.world, W = w.map.width;
    let k = 0;
    for (let y = 12; y < 20 && k < 24; y++) for (let x = 8; x < 20 && k < 24; x++) {
      if (!w.walkable(x, y) || w.blocked[w.idx(x, y)]) continue;
      const t = s.soil[y * W + x] = { c: 'turnip', w: 1, r: 0 }; t.p = L.nowMin() - L.growMins(t) - 1; k++;
    }
    s.shelves[0] = { id: 'egg', n: 12, left: 60 };
    s.shelves[1] = { id: 'milk', n: 4, left: 0, coins: 400 };
    s.name = 'Bea';
    Farm.Online.me.name = 'Bea';
    w.save();
  });
  await B.page.evaluate(() => Farm.FR.sendCopy(Farm.world, true));
  await B.page.waitForFunction(() => true);
  for (let i = 0; i < 50 && !server.db.fraid.copies.has(B.uid); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(server.db.fraid.copies.has(B.uid), "the farm's raid copy is on the server");
  const bCopy = server.db.fraid.copies.get(B.uid);
  assert.ok(bCopy.loot > 0 && bCopy.copy.loot.some((p) => p.kind === 'crops') && bCopy.copy.loot.some((p) => p.kind === 'gold' && p.n === 400), 'its crops, and the 400 Gold at the stall');
  server.db.players.get(B.uid).farm_name = 'Bea';
  const crops0 = await B.page.evaluate(() => Object.values(Farm.session.state.soil).filter((t) => t && t.c && Farm.Logic.isRipe(t)).length);

  // ---- the raider: a camp, 8 goats
  const A = await open(server, fraid);
  await A.page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, r = L.frState(s);
    r.camp = 3; r.army.goat = 8; s.energy = 100;
    Farm.world.save();
  });
  const gold0 = await A.page.evaluate(() => Farm.session.state.gold);
  await A.page.evaluate(() => Farm.ui.raidFind([]));
  await waitModal(A.page, /RAID BEA\?/);
  assert.match(await modalText(A.page), /Power \d+ \(yours \d+\).*Gold's worth for you to take.*A raid takes 10 energy/s);
  await A.page.waitForTimeout(700);
  await shot(A.page, 'fraid-found');
  await tapDialog(A.page, 'Raid');
  await A.page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.session.raid && Farm.session.raid.kind === 'real', null, SLOW);
  await shot(A.page, 'fraid-battle');
  const raid = server.db.fraid.raids[0];
  assert.strictEqual(raid.state, 'open');
  assert.strictEqual(await A.page.evaluate(() => Farm.session.state.energy), 90, 'the raid took its energy');
  const got = await fight(A.page);
  assert.ok(got.n > 0 && got.taken.value > 0, 'the goats took something');
  await A.page.waitForFunction(() => /Raid (won|over)/.test((() => { const out = [], h = Farm.ui.frBox; if (!h) return ''; const w = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) w(o.list); }); w(h.list); return out.join(' | '); })()), null, SLOW);
  await A.page.waitForTimeout(900);
  await shot(A.page, 'fraid-result');
  assert.strictEqual(raid.state, 'done', 'the game server counted it');
  assert.strictEqual(raid.stars, got.stars, "the server's stars are the battle's");
  assert.ok(raid.prize > 0 && raid.prize <= Math.ceil(bCopy.copy.value * raid.cap), 'the prize, never more than its share');
  assert.match(await frText(A.page), new RegExp('\\+' + raid.prize.toLocaleString('en-US') + ' Gold'));
  await A.page.waitForFunction(() => true);
  for (let i = 0; i < 30 && !raid.claimed; i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(raid.claimed, 'taken once');
  assert.strictEqual(await A.page.evaluate(() => Farm.session.state.gold), gold0 + raid.prize, 'the prize is in the raider\'s Gold');
  assert.strictEqual(await A.page.evaluate(() => Farm.Logic.frState(Farm.session.state).army.goat || 0), 8 - got.n, 'the raiders sent are used up');

  // ---- the farm opens its game: the card, the loss, seen once
  // (the farm's game may look on its own first, when its farm opens: the card shows either way, once)
  await B.page.evaluate(() => { Farm.FR.inboxAt = 0; Farm.FR.inbox(Farm.world); });
  await waitModal(B.page, /YOUR FARM WAS RAIDED!/);
  const card = await modalText(B.page);
  await B.page.waitForTimeout(700);
  await shot(B.page, 'fraid-raided');
  assert.match(card, /raided you: [★☆]{3}/);
  assert.match(card, /They took /);
  assert.match(card, /Your farm is safe for 8 hours/);
  assert.match(card, /Replay.*Revenge.*OK/s);
  const crops1 = await B.page.evaluate(() => Object.values(Farm.session.state.soil).filter((t) => t && t.c && Farm.Logic.isRipe(t)).length);
  assert.strictEqual(crops0 - crops1, raid.taken.crops || 0, 'the crops they took are gone');
  assert.ok(raid.seen, 'seen once');
  assert.ok(server.db.fraid.copies.get(B.uid).raided > Date.now(), 'the farm is shielded');

  // ---- Replay: the same battle, drawn
  await tapDialog(B.page, 'Replay');
  await B.page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.session.raid && Farm.session.raid.kind === 'replay', null, SLOW);
  const replayed = await B.page.evaluate(() => { const w = Farm.world, b = w.raidB, L = Farm.Logic; while (!b.end) { w.raidReplayDrops(); L.frStep(b); } w.raidFinish(); return { taken: L.frTaken(b), stars: L.frStars(b) }; });
  assert.strictEqual(replayed.stars, raid.stars, 'the replay: the same stars');
  assert.strictEqual(replayed.taken.value, got.taken.value, 'and the same loot');
  await B.page.waitForFunction(() => { const out = [], h = Farm.ui.frBox; if (!h) return false; const w = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) w(o.list); }); w(h.list); return /The raid on your farm/.test(out.join(' | ')); }, null, SLOW);
  await B.page.evaluate(() => Farm.raidFarmLeave());
  await B.page.waitForFunction(() => Farm.world && !Farm.session.raid && Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  assert.ok(!/Welcome to/.test(await B.page.evaluate(() => (Farm.ui.toastText.visible ? Farm.ui.toastText.text : ''))), 'no visitor welcome after a replay');

  // ---- Revenge: free, once, against the raider (whose own raid broke their shields)
  await A.page.evaluate(() => Farm.raidFarmLeave());
  await A.page.waitForFunction(() => Farm.world && !Farm.session.raid && Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  await A.page.evaluate(() => { // (the raider has ripe crops out too: an empty farm can't be raided, even for Revenge)
    const s = Farm.session.state, L = Farm.Logic, w = Farm.world, W = w.map.width;
    let k = 0;
    for (let y = 12; y < 20 && k < 10; y++) for (let x = 8; x < 20 && k < 10; x++) {
      if (!w.walkable(x, y) || w.blocked[w.idx(x, y)]) continue;
      const t = s.soil[y * W + x] = { c: 'turnip', w: 1, r: 0 }; t.p = L.nowMin() - L.growMins(t) - 1; k++;
    }
    w.save();
    Farm.FR.sendCopy(w, true);
  });
  for (let i = 0; i < 30 && !((server.db.fraid.copies.get(A.uid) || {}).loot > 0); i++) await new Promise((r) => setTimeout(r, 100));
  await B.page.evaluate(() => { const r = Farm.Logic.frState(Farm.session.state); r.camp = 3; r.army.goat = 6; Farm.session.state.energy = 0; Farm.world.save(); });
  await B.page.evaluate((id) => Farm.raidFarmStart({ kind: 'real', revenge: id }), raid.id);
  await B.page.waitForFunction(() => Farm.world && Farm.world.raidB && Farm.session.raid && Farm.session.raid.revenge, null, SLOW);
  assert.strictEqual(server.db.fraid.raids[1].revengeOf, raid.id, 'a revenge raid');
  assert.strictEqual(server.db.fraid.raids[1].defender, A.uid, 'on the raider');
  assert.strictEqual(await B.page.evaluate(() => Farm.session.state.energy), 0, 'free: no energy needed');
  assert.ok(raid.revenged, 'once only');

  // ---- last week's prize: #1 gets 20,000 Gold, once
  server.db.fraid.weekPrize = { uid: A.uid, gold: 20000, rank: 1 };
  const g1 = await A.page.evaluate(() => Farm.session.state.gold);
  await A.page.evaluate(() => { Farm.FR.weekAsked = false; Farm.FR.inboxAt = 0; Farm.FR.inbox(Farm.world); });
  await A.page.waitForFunction((g) => Farm.session.state.gold === g + 20000, g1, SLOW);
  await A.page.evaluate(() => { Farm.FR.weekAsked = false; Farm.FR.inboxAt = 0; Farm.FR.inbox(Farm.world); });
  await A.page.waitForTimeout(500);
  assert.strictEqual(await A.page.evaluate(() => Farm.session.state.gold), g1 + 20000, 'once');

  // ---- the board
  await A.page.evaluate(() => Farm.ui.raidBoard());
  await A.page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await modalText(A.page), new RegExp('Raid Points[\\s\\S]*1\\. [\\s\\S]*\\(you\\)[\\s\\S]*' + raid.points + ' Raid Points'));
  await shot(A.page, 'fraid-board');

  assert.deepStrictEqual(A.problems.concat(B.problems), []);
  await A.context.close();
  await B.context.close();
});

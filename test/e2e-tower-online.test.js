// The Lost Tower with friends, end to end (the spec docs/superpowers/specs/2026-11-12-lost-tower-design.md, "Friends on a
// floor"; docs/game-server.md "Step 4"): three real game pages, each a WebView in the Selebox app running the real app
// bridge over a stand-in for the app's Supabase (test/net-mock.js), as test/e2e-gameserver-pub.test.js opens them, and
// the REAL game server (server/lib/server.js with server/lib/tower.js) behind a 60-250 ms relay each way.
//   - three friends, each from their own game, on one floor: each sees the other two and the same 20 enemies, no more
//     and no stronger for three; the kills shared; one clear: the stairs open for all;
//   - the Pearls: the first-timer gets the floor's own, a helper 1, a helper at 50 today nothing;
//   - alone on a floor you cleared: nothing;
//   - up the stairs: each walks up on their own and lands on the friend's floor; one new to a floor never lands on a
//     friend's cleared one (a fresh floor: its Pearls are still hers); the lift shows a friend's floor, Join takes you;
//   - nothing of the floor on the old relay (Supabase).
// Run alone, after `node build.js`: node --test test/e2e-tower-online.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SLOW = { timeout: 90000 };
const OLD = { wa: 1, wh: 1, wd: 1, wb: 1 }; // the old relay's monster messages: none for a floor the server runs
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the REAL server, behind a 60-250 ms relay (as test/e2e-gameserver-pub.test.js) ----------
const servers = [];
async function realServer() {
  const { startServer } = require('../server/lib/server');
  const auth = { check: async (token) => { const m = /^test-token:(.+)$/.exec(String(token || '')); return m ? { uid: m[1] } : { why: 'auth' }; } };
  const app = startServer({ auth, port: 0, log: () => {}, reportEvery: 600000 });
  const addr = await app.listening;
  const ws = require('../server/node_modules/ws'), WS = ws.WebSocket, WSS = ws.WebSocketServer;
  const proxy = new WSS({ port: 0, host: '127.0.0.1' });
  await new Promise((r) => proxy.on('listening', r));
  const lag = () => 60 + Math.random() * 190;
  proxy.on('connection', (down) => {
    const up = new WS('ws://127.0.0.1:' + addr.port + '/');
    const toUp = [], outAt = { v: 0 }, inAt = { v: 0 };
    const later = (at, fn) => { // (one queue a way: in order, as one connection)
      const t = Math.max(Date.now() + lag(), at.v); at.v = t;
      const q = at.q || (at.q = []);
      q.push({ t, fn });
      if (q.length > 1) return;
      const pump = () => { while (q.length && q[0].t <= Date.now()) q.shift().fn(); if (q.length) setTimeout(pump, Math.max(0, q[0].t - Date.now())); };
      setTimeout(pump, Math.max(0, t - Date.now()));
    };
    up.on('open', () => { while (toUp.length) up.send(toUp.shift()); });
    down.on('message', (m) => later(inAt, () => { if (up.readyState === 1) up.send(String(m)); else toUp.push(String(m)); }));
    up.on('message', (m) => later(outAt, () => { if (down.readyState === 1) down.send(String(m)); }));
    up.on('close', (c) => later(outAt, () => { try { down.close(c >= 4000 ? c : 1000); } catch (e) { /* gone */ } }));
    down.on('close', () => later(inAt, () => { try { up.close(); } catch (e) { /* gone */ } })); // (after what was sent before it, as one connection: a 'bye' is not a dropped line)
  });
  const x = { url: 'ws://127.0.0.1:' + proxy.address().port + '/', game: app.game, close: async () => { proxy.clients.forEach((c) => c.terminate()); proxy.close(); await Promise.race([app.stop(), sleep(3000)]); } };
  servers.push(x);
  return x;
}

// ---------- the phones ----------
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file) || null, l = /^looks\/v1\/([a-z]+-(?:boy|girl)(?:-archer)?)$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : l ? path.join(__dirname, '..', 'assets', 'looks', l[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); await Promise.all(servers.map((x) => x.close().catch(() => {}))); });

// A phone in its own game, online, a named farm, a bow, plenty of energy; edit: its Tower so far (on `s`).
async function open(server, gs, name, edit) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [], relay = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket connection to/.test(m.text())) problems.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
    problems.push('network: ' + url);
    return route.abort();
  });
  const uid = server.newUser();
  const webViewRef = { current: { injectJavaScript: (code) => { page.evaluate(code).catch(() => {}); } } };
  const bridge = createSunnyAcresBridge({ supabase: server.supabaseFor(uid), webViewRef });
  await context.exposeBinding('__rnPost', (source, data) => {
    try { const m = JSON.parse(data); if (m.op === 'send') relay.push(m.args[1]); } catch (e) { /* not ours */ }
    bridge.onMessage({ nativeEvent: { data } });
  });
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([here, gs]) => {
    window.ReactNativeWebView = { postMessage: (data) => window.__rnPost(data) };
    window.__here = here;
    window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } };
    window.gameHost.gs = gs;
  }, [allPackFiles(), gs]);
  await page.addInitScript(HOST_ASSETS);
  await page.addInitScript(bridge.injectedJavaScriptBeforeContentLoaded);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.Online.on, null, SLOW);
  await page.evaluate((n) => Farm.Net.rpc('farm_join_v1', { p_farm_name: n }).then((r) => {
    Farm.Online.me.name = r.farm_name;
    Farm.session.state.net.named = 1;
    Farm.Online.chan.track(Farm.Online.myState());
  }), name);
  await page.evaluate((edit) => {
    const s = Farm.session.state, L = Farm.Logic; // eslint-disable-line no-unused-vars
    s.wild.n = 60; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 99); s.sel = s.inv.findIndex((x) => x && x.id === 'bow');
    s.energy = 900;
    s.time = 600;
    eval(edit || ''); // eslint-disable-line no-eval
  }, edit || '');
  return { page, problems, context, uid, relay, name };
}
// friends with each other (what farm_friends_v1 would say): the floor's hi says them (`with`)
const befriend = (all) => Promise.all(all.map((who) => who.page.evaluate((ids) => Farm.GameServer.friendsNow(ids), Object.fromEntries(all.filter((x) => x !== who).map((x) => [x.uid, 1])))));
const gsState = (page) => page.evaluate(() => Farm.GameServer.state());
const waitLive = (page) => page.waitForFunction(() => (Farm.GameServer.state() || {}).mode === 'live' && Farm.world.wild && !Farm.world.busy, null, SLOW);
// into the Tower at a floor (from wherever you are), and live on it
async function toFloor(who, f) {
  await who.page.evaluate((f) => { Farm.ui.closeAll(); Farm.world.travel('tower', 'entrance', f); }, f);
  await who.page.waitForFunction((f) => Farm.world.mapKey === 'tower' && Farm.session.lairFloor === f && !Farm.world.busy && Farm.world.player.active && Farm.world.lair && Farm.world.lair.floor === f, f, SLOW);
  await waitLive(who.page);
  await who.page.evaluate(() => Farm.ui.closeAll());
}
const list = (page) => page.evaluate(() => Farm.world.wild.animals.map((a) => a.slot + ':' + a.kind + ':' + a.hp + '/' + a.max).sort().join(' '));
const remoteNames = (page) => page.evaluate(() => Object.keys(Farm.world.remotes || {}).map((id) => Farm.world.remotes[id].tag.text).sort());
const until = async (fn, what, ms = 30000, why) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(150); }
  assert.fail('timed out: ' + what + (why ? ' ' + (await why()) : ''));
};
// the server's tower rooms: floor, who, cleared (for a failure's message)
const towerRooms = (real) => Array.from(real.game.rooms.values()).filter((r) => r.tw).map((r) => [r.key.slice(-12), r.floor, Array.from(r.players.values()).map((p) => p.name), r.clear]);
const tower = (page) => page.evaluate(() => { const s = Farm.session.state, lr = Farm.world.lair; return { pearls: s.pearls || 0, cl: s.tower.cl, deep: s.tower.deep, hn: s.tower.hn, paid: !!(lr && lr.paid), open: !!(lr && lr.open), floor: lr && lr.floor }; });
// Its share of the floor (slot % n === k, then any left): walks up to one and shoots it, an arrow every 170 ms, until the
// floor is empty (the server says each is down).
const hunt = (who, k, n) => who.page.evaluate(async ([k, n]) => {
  const w = Farm.world, T = 256;
  for (let i = 0; i < 1500; i++) {
    if (!w.wild || w.mapKey !== 'tower') return 'left the tower';
    const up = w.wild.animals.filter((a) => a.hp > 0 && !a.lying);
    if (!w.wild.animals.length) return 'done';
    const a = up.filter((x) => x.slot % n === k)[0] || up[i % Math.max(1, up.length)];
    if (a) {
      Farm.ui.closeAll();
      const f = w.feet();
      if (Math.hypot(f.x - a.x, f.y - a.y) > 3 * T) w.setFeet(a.x, a.y + 0.9 * T);
      w.wildStruck(a);
    }
    await new Promise((r) => setTimeout(r, 170));
  }
  return 'still ' + w.wild.animals.length;
}, [k, n]);
const huntTogether = async (team) => {
  const out = await Promise.all(team.map((who, k) => hunt(who, k, team.length)));
  out.forEach((r, i) => assert.ok(r === 'done', team[i].name + ': ' + r));
};
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (found[0] && m.c.slimInto) m.c.slimInto(found[0]);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
}
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});

test('REAL server: three friends on one Tower floor share its 20 enemies and its clear; the first-timer is paid its Pearls, a helper 1, a helper at 50 today nothing; alone on a cleared floor nothing; up the stairs together; the lift joins a friend', async () => {
  const real = await realServer(), server = createServer();
  // Ana has never been in; Ben and Cy have climbed to floor 30; Cy has helped 50 times today already
  const ana = await open(server, real.url, 'Ana Acres');
  const ben = await open(server, real.url, 'Ben Barn', 'for (let f = 1; f <= 30; f++) { L.towerReach(s, f); L.towerPay(s, f); } s.pearls = 0;');
  const cy = await open(server, real.url, 'Cy Coop', 'for (let f = 1; f <= 30; f++) { L.towerReach(s, f); L.towerPay(s, f); } s.pearls = 0; s.tower.hd = s.day; s.tower.hn = 50;');
  const team = [ana, ben, cy];
  await befriend(team);

  // ---- floor 1, the three of them: one room, each sees the other two, one list of 20 ----
  await toFloor(ana, 1);
  const first = await list(ana.page);
  await toFloor(ben, 1);
  await toFloor(cy, 1);
  for (const who of team) {
    const others = team.filter((x) => x !== who).map((x) => x.name).sort();
    await until(async () => JSON.stringify(await remoteNames(who.page)) === JSON.stringify(others), who.name + ' sees ' + others.join(', '));
  }
  await until(async () => (await list(ben.page)) === first && (await list(cy.page)) === first, 'one list of enemies on all three');
  assert.strictEqual(first.split(' ').length, 20, 'floor 1\'s 20, no more for three');
  first.split(' ').forEach((e) => assert.ok(/:2\/2$/.test(e), 'each two hits, no stronger for three: ' + e));
  const room = Array.from(real.game.rooms.values()).filter((r) => r.tw && r.floor === 1);
  assert.strictEqual(room.length, 1, 'one room for floor 1');
  assert.strictEqual(room[0].players.size, 3);
  for (const who of team) assert.strictEqual((await gsState(who.page)).map, 'tower');

  // ---- the kills shared; one clear ----
  await huntTogether(team);
  for (const who of team) await who.page.waitForFunction(() => Farm.world.lair.paid && Farm.world.lair.open, null, SLOW);
  const after = await Promise.all(team.map((who) => tower(who.page)));
  assert.deepStrictEqual([after[0].pearls, after[0].cl], [1, 1], 'Ana, new to floor 1: its first-time Pearl');
  assert.deepStrictEqual([after[1].pearls, after[1].hn], [1, 1], 'Ben, helping: 1 Pearl');
  assert.deepStrictEqual([after[2].pearls, after[2].hn], [0, 50], 'Cy, 50 helps today already: nothing');
  after.forEach((t, i) => assert.ok(t.open, team[i].name + ': the stairs are open'));
  for (const who of team) await who.page.waitForFunction(() => /^Floor 1 +· +Clear! +· +/.test(Farm.ui.towerText.text), null, SLOW); // (the chip redraws on its own clock)

  // ---- Ben alone on floor 2, which he cleared long ago: nothing ----
  await toFloor(ben, 2);
  assert.deepStrictEqual(await remoteNames(ben.page), [], 'Ben alone on floor 2');
  await huntTogether([ben]);
  await ben.page.waitForFunction(() => Farm.world.lair.paid && Farm.world.lair.open, null, SLOW);
  assert.strictEqual((await tower(ben.page)).pearls, 1, 'alone on a cleared floor: nothing');

  // ---- Ana up the stairs: floor 2 is new to her, Ben's floor 2 is cleared: she gets a fresh one (her Pearls) ----
  await ana.page.evaluate(() => Farm.world.lairDown());
  await ana.page.waitForFunction(() => Farm.world.lair && Farm.world.lair.floor === 2 && !Farm.world.busy && (Farm.GameServer.state() || {}).mode === 'live', null, SLOW);
  await ana.page.waitForFunction(() => Farm.world.wild.animals.length === 20 && !Farm.world.lair.open, null, SLOW);
  assert.deepStrictEqual(await remoteNames(ana.page), [], 'not on Ben\'s cleared floor');
  // Ben comes to her: back to floor 1 (cleared: Cy is still there), then up its open stairs; the server puts him with his
  // friend still fighting, not on his own cleared floor 2
  await toFloor(ben, 1);
  await ben.page.waitForFunction(() => Farm.world.lair.open, null, SLOW);
  assert.strictEqual((await tower(ben.page)).pearls, 1, 'back on a floor cleared before he came: nothing');
  await ben.page.evaluate(() => Farm.world.lairDown());
  await ben.page.waitForFunction(() => Farm.world.lair && Farm.world.lair.floor === 2 && !Farm.world.busy && (Farm.GameServer.state() || {}).mode === 'live', null, SLOW);
  await until(async () => JSON.stringify(await remoteNames(ana.page)) === JSON.stringify(['Ben Barn']), 'Ana sees Ben come', 30000, async () => JSON.stringify({ rooms: towerRooms(real), ben: await gsState(ben.page), ana: await gsState(ana.page), names: await remoteNames(ana.page), benHi: await ben.page.evaluate(() => Farm.GameServer.friends()) }));
  await until(async () => (await list(ben.page)) === (await list(ana.page)), 'one list on floor 2');
  await huntTogether([ana, ben]);
  for (const who of [ana, ben]) await who.page.waitForFunction(() => Farm.world.lair.paid && Farm.world.lair.open, null, SLOW);
  assert.deepStrictEqual([(await tower(ana.page)).pearls, (await tower(ben.page)).pearls, (await tower(ben.page)).hn], [2, 2, 2], 'Ana +1 (new), Ben +1 (helping)');

  // ---- up the stairs together: each walks up and lands on the other's floor ----
  await ana.page.evaluate(() => Farm.world.lairDown());
  await ana.page.waitForFunction(() => Farm.world.lair && Farm.world.lair.floor === 3 && !Farm.world.busy && (Farm.GameServer.state() || {}).mode === 'live', null, SLOW);
  await ben.page.evaluate(() => Farm.world.lairDown());
  await ben.page.waitForFunction(() => Farm.world.lair && Farm.world.lair.floor === 3 && !Farm.world.busy && (Farm.GameServer.state() || {}).mode === 'live', null, SLOW);
  await until(async () => JSON.stringify(await remoteNames(ben.page)) === JSON.stringify(['Ana Acres']), 'Ben lands on Ana\'s floor 3');

  // ---- the lift: Cy (on floor 1) sees her friends on floor 3 and joins them ----
  await cy.page.evaluate(() => Farm.ui.openLairLift());
  await until(async () => /Ana Acres, floor 3|Ben Barn, floor 3/.test(await modalText(cy.page)), 'the lift shows the friends\' floor', 15000);
  assert.match(await modalText(cy.page), /2 of 4 on it/);
  await tapButton(cy.page, 'Join');
  await cy.page.waitForFunction(() => Farm.world.lair && Farm.world.lair.floor === 3 && !Farm.world.busy && (Farm.GameServer.state() || {}).mode === 'live', null, SLOW);
  await until(async () => JSON.stringify(await remoteNames(cy.page)) === JSON.stringify(['Ana Acres', 'Ben Barn']), 'Cy on floor 3 with both');

  // nothing of the floors on the old relay; no errors
  for (const who of team) {
    assert.deepStrictEqual(who.relay.filter((e) => OLD[e]), [], who.name + ': no monster messages on the old relay');
    assert.deepStrictEqual(who.problems, [], who.name);
  }
  await Promise.all(team.map((who) => who.context.close()));
});

test('no game server for the Tower (an older one says no to it): the floor is the phone\'s own, as before, and pays as alone', async () => {
  // a server that knows no Tower: refuses its hi ('topic'), as a droplet not yet updated would
  const real = await realServer();
  const dungeonOf = real.game.R.dungeonOf;
  real.game.R.dungeonOf = (map) => (map === 'tower' ? null : dungeonOf(map));
  const server = createServer();
  const ana = await open(server, real.url, 'Ana Acres');
  await ana.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('tower', 'entrance', 1); });
  await ana.page.waitForFunction(() => (Farm.GameServer.state() || {}).mode === 'off' && Farm.world.wild && Farm.world.wild.animals.length === 20, null, SLOW);
  assert.match((await gsState(ana.page)).why, /^no:topic/);
  await ana.page.evaluate(() => Farm.towerClearFloor());
  await ana.page.waitForFunction(() => Farm.world.lair.paid && Farm.world.lair.open, null, SLOW);
  assert.strictEqual((await tower(ana.page)).pearls, 1);
  real.game.R.dungeonOf = dungeonOf;
  assert.deepStrictEqual(ana.problems, []);
  await ana.context.close();
});

// One shot of yours at one enemy (k: a weapon's, as its shot sets s.wpnHit; none: the Bow), from beside it.
const shootAt = (page, slot, k) => page.evaluate(async ([slot, k]) => {
  const w = Farm.world, s = Farm.session.state, a = w.wild.animals.find((x) => x.slot === slot);
  if (!a) return 'gone';
  Farm.ui.closeAll();
  const f = w.feet();
  if (Math.hypot(f.x - a.x, f.y - a.y) > 2 * 256) { w.setFeet(a.x, a.y + 0.9 * 256); await new Promise((r) => setTimeout(r, 160)); } // (the server hears where you are first)
  s.wpnHit = k ? { k, lv: 5 } : null;
  try { if (a.hp > 0) w.wildStruck(a); } finally { s.wpnHit = null; }
  await new Promise((r) => setTimeout(r, 200));
  return 'ok';
}, [slot, k || null]);
const mon = (page, slot) => page.evaluate((slot) => { const a = Farm.world.wild.animals.find((x) => x.slot === slot); return a ? { hp: a.hp, max: a.max, shield: !!a.shield, img: !!a.shieldImg, lying: !!a.lying } : null; }, slot);

test('REAL server, the realms\' tricks on a shared floor (851): a shield bounces a Bow and breaks to a Rifle for both; a reviver lies and stands again for both; beaten again it splits, its copies on both', async () => {
  const real = await realServer(), server = createServer();
  const climb = 'for (let f = 1; f <= 900; f++) { L.towerReach(s, f); L.towerPay(s, f); } s.pearls = 0; s.energy = 99999;';
  const ana = await open(server, real.url, 'Ana Acres', climb), ben = await open(server, real.url, 'Ben Barn', climb);
  await befriend([ana, ben]);
  await toFloor(ana, 851);
  await toFloor(ben, 851);
  await until(async () => JSON.stringify(await remoteNames(ana.page)) === JSON.stringify(['Ben Barn']), 'together on 851');
  await until(async () => (await list(ben.page)) === (await list(ana.page)), 'one list of 60');
  assert.strictEqual((await list(ana.page)).split(' ').length, 60);
  const keep = () => Promise.all([ana, ben].map((who) => who.page.evaluate(() => { Farm.session.state.energy = 99999; })));

  // ---- a shield: the Bow bounces (no damage on either phone), a Rifle breaks it on both ----
  const sh = await ana.page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.shield && x.def.role === 'normal' && !x.fs); return a && a.slot; });
  assert.ok(sh != null, 'a shielded one');
  const hp0 = (await mon(ana.page, sh)).hp;
  await shootAt(ana.page, sh);
  await sleep(900);
  assert.deepStrictEqual([(await mon(ana.page, sh)).hp, (await mon(ben.page, sh)).hp], [hp0, hp0], 'the Bow bounces off');
  assert.ok((await mon(ben.page, sh)).shield && (await mon(ben.page, sh)).img, 'Ben still sees its shield');
  await shootAt(ana.page, sh, 'rifle');
  await until(async () => { const a = await mon(ana.page, sh), b = await mon(ben.page, sh); return a && b && !a.shield && !b.shield && !b.img; }, 'the shield broken on both');
  assert.strictEqual((await mon(ben.page, sh)).hp, hp0, 'the Rifle\'s shot was spent on it');
  await keep();

  // ---- a reviver: beaten, it lies on both; it stands again with half its hits; beaten again it splits into two ----
  const rv = await ana.page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.revive && !x.shield && !x.fs && x.def.role === 'normal'); return a && a.slot; });
  assert.ok(rv != null, 'a reviver');
  const max = (await mon(ana.page, rv)).max;
  for (let i = 0; i < 60; i++) { const m = await mon(ben.page, rv); if (!m || m.lying) break; await shootAt(ana.page, rv, 'javelin'); } // (one shot at a time, each answered: a shot while it lies would finish it)
  await until(async () => { const b = await mon(ben.page, rv); return b && b.lying; }, 'Ben sees it lie down');
  await until(async () => { const a = await mon(ana.page, rv), b = await mon(ben.page, rv); return a && b && !a.lying && !b.lying && b.hp > 0; }, 'it stands again on both', 15000);
  assert.strictEqual((await mon(ben.page, rv)).hp, Math.ceil(max / 2));
  await keep();
  for (let i = 0; i < 60; i++) { if (!(await mon(ben.page, rv))) break; const a = await mon(ana.page, rv); if (a && !a.lying) await shootAt(ana.page, rv, 'javelin'); else await sleep(200); }
  const copies = [10000 + rv * 2, 10001 + rv * 2];
  for (const who of [ana, ben]) {
    await until(async () => { const got = await Promise.all(copies.map((s) => mon(who.page, s))); return got.every((c) => c && c.max === Math.ceil(max / 2) && !c.shield); }, who.name + ' sees its two copies');
  }
  assert.strictEqual(await mon(ben.page, rv), null, 'the reviver itself is gone');
  for (const who of [ana, ben]) assert.deepStrictEqual(who.problems, [], who.name);
  await Promise.all([ana, ben].map((who) => who.context.close()));
});

// Owner, 13 Nov 2026 ("Build the server change now"): the Tower's food on a shared floor. The phone's hit tells the server
// the power of the dish its player ate (pw); the server runs it for both phones.
test('REAL server, the Tower\'s food on a shared floor (851): Halo-halo keeps a reviver down 6 s on both; then Bicol Express makes its copies a quarter on both', async () => {
  const real = await realServer(), server = createServer();
  const climb = 'for (let f = 1; f <= 900; f++) { L.towerReach(s, f); L.towerPay(s, f); } s.pearls = 0; s.energy = 99999;';
  const ana = await open(server, real.url, 'Ana Acres', climb), ben = await open(server, real.url, 'Ben Barn', climb);
  await befriend([ana, ben]);
  await toFloor(ana, 851);
  await toFloor(ben, 851);
  await until(async () => JSON.stringify(await remoteNames(ana.page)) === JSON.stringify(['Ben Barn']), 'together on 851');
  await until(async () => (await list(ben.page)) === (await list(ana.page)), 'one list of 60');
  const dish = (id) => ana.page.evaluate((id) => { const s = Farm.session.state; s.tfd = { id, until: Farm.Logic.nowMin() + 15 }; s.energy = 99999; return Farm.Logic.towerHitPower(s); }, id);
  assert.strictEqual(await dish('halo_halo_biringan'), 'revive');
  const onServer = (slot) => { for (const r of real.game.rooms.values()) { const a = r.tw && r.mons.find((x) => x.slot === slot); if (a) return a; } return null; };
  const rv = await ana.page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.revive && !x.shield && !x.fs && x.def.role === 'normal'); return a && a.slot; });
  assert.ok(rv != null, 'a reviver');
  const max = (await mon(ana.page, rv)).max;
  for (let i = 0; i < 120; i++) { const a = onServer(rv); if (!a || a.lying) break; await shootAt(ana.page, rv, 'javelin'); await until(async () => !onServer(rv) || onServer(rv).lying || (await mon(ana.page, rv) || {}).hp > 0, 'answered'); }
  const lyingMs = (onServer(rv) || {}).lying;
  assert.ok(lyingMs > 5000, 'the server lays it down for 6 s, not 3: ' + lyingMs); // (one shot at a time, each answered: a shot while it lies would finish it)
  await until(async () => { const b = await mon(ben.page, rv); return b && b.lying; }, 'Ben sees it lie down');
  const lay = Date.now();
  await until(async () => { const b = await mon(ben.page, rv); return b && !b.lying && b.hp > 0; }, 'it stands again', 20000);
  const ms = Date.now() - lay;
  assert.ok(ms > 5000 && ms < 9000, 'it lay about 6 s, not 3: ' + ms + ' ms');
  assert.strictEqual(await dish('bicol_express'), 'split');
  for (let i = 0; i < 60; i++) { if (!(await mon(ben.page, rv))) break; const a = await mon(ana.page, rv); if (a && !a.lying) await shootAt(ana.page, rv, 'javelin'); else await sleep(200); }
  const copies = [10000 + rv * 2, 10001 + rv * 2];
  for (const who of [ana, ben]) {
    await until(async () => { const got = await Promise.all(copies.map((s) => mon(who.page, s))); return got.every((c) => c && c.max === Math.ceil(max / 4)); }, who.name + ' sees its two copies at a quarter');
  }
  for (const who of [ana, ben]) assert.deepStrictEqual(who.problems, [], who.name);
  await Promise.all([ana, ben].map((who) => who.context.close()));
});

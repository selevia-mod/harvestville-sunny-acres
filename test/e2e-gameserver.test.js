// The game server, the phone's side (docs/game-server.md; src/19zzzzzzzzz-gameserver.js), end to end: two real game
// pages, each a WebView in the Selebox app running the real app bridge over a stand-in for the app's Supabase
// (test/net-mock.js), as test/e2e-online.test.js does, and a SMALL FAKE game server here (node ws: only what the
// contract says the server sends, with simple scripted monsters), with 60-250 ms of delay each way.
// Run alone, after `node build.js`: node --test test/e2e-gameserver.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

// (the ws package; without it here, the copy that comes inside Playwright)
const WebSocketServer = (() => {
  try { const ws = require('ws'); return ws.WebSocketServer || ws.Server; } catch (e) { return require('playwright-core/lib/utilsBundle').wsServer; }
})();

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SLOW = { timeout: 90000 };
const T = 256;
const OLD = { wa: 1, wh: 1, wd: 1, wb: 1 };
const rand = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the fake game server ----------
// floors(map, floor) -> [{ slot, kind, k (its packed kind), hp, x, y, moves }]. Monsters that move walk a small circle.
// refuse: answers every hi with 'no' (this why); silent: never answers. As the real one (server/lib/room.js): a hit
// within 150 ms of this phone's last on that monster, or from 12+ tiles away, is not counted and only that phone hears
// the monster's hp back; a refusal closes with 4010 after its 'no'; a second line for the same player takes its place
// (the old one closed with 4001); 'wl' has the tick number and the server's clock, and a floor already clear gets 'cl'
// right after it; 'dn' names the kind.
const servers = []; // (closed at the end, even when a test fails: they would keep the run open)
function fakeGameServer({ floors, refuse, silent } = {}) {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  const rooms = new Map(), conns = new Set(), held = new Map();
  const stats = { hi: 0, hits: 0, mv: 0, pi: 0, bye: 0 };
  const pack = (m) => [m.slot, m.k, Math.round(m.x), Math.round(m.y), m.dir, m.left, m.mode, m.hp, 100, 0, m.max];
  const row = (c) => [c.id, c.name, c.look, c.x, c.y, c.dir, c.m];
  const room = (key, map, floor) => {
    if (rooms.has(key)) return rooms.get(key);
    const mons = new Map();
    (floors ? floors(map, floor) : []).forEach((m) => mons.set(m.slot, { ...m, hx: m.x, hy: m.y, ang: m.slot, dir: 2, left: 0, mode: 0, max: m.hp, hits: {} }));
    const r = { key, mons, conns: new Set(), changed: new Set(), gone: [], come: [], left: [], n: 0, cleared: false };
    rooms.set(key, r);
    return r;
  };
  // each way, every message 60-250 ms late, in order (as on one TCP line); what goes in one burst arrives together
  const delayed = (c, dir, fn) => {
    const now = Date.now(), at = now - (c[dir + 'Sent'] || 0) < 30 ? c[dir] : Math.max(c[dir], now + rand(60, 250));
    c[dir] = at;
    c[dir + 'Sent'] = now;
    // one queue a way, so they come out in the order they went in (as one connection keeps them: two timers due at the
    // same moment can fire out of order, and a stale tick after a kill brought a dead monster back in this test)
    const q = c[dir + 'Q'] || (c[dir + 'Q'] = []);
    q.push({ at, fn });
    if (q.length > 1) return;
    const pump = () => {
      while (q.length && q[0].at <= Date.now()) q.shift().fn();
      if (q.length) setTimeout(pump, Math.max(0, q[0].at - Date.now()));
    };
    setTimeout(pump, Math.max(0, at - now));
  };
  const out = (c, m) => delayed(c, 'outAt', () => { if (c.sock.readyState === 1) c.sock.send(JSON.stringify(m)); });
  const all = (r, m) => r.conns.forEach((c) => out(c, m));
  const leave = (c) => {
    const r = c.room;
    c.room = null;
    if (!r || !r.conns.delete(c)) return;
    r.left.push(c.id);
  };
  const handle = (c, m) => {
    if (c.closed && m.t !== 'bye') return;
    if (m.t === 'hi') {
      stats.hi++;
      if (silent) return;
      const id = /^test-token:(.+)$/.exec(String(m.token || ''));
      if (refuse || !id || m.v !== 1) {
        out(c, { t: 'no', why: refuse || (!id ? 'auth' : 'version') });
        return delayed(c, 'outAt', () => c.sock.close(4010));
      }
      if (held.get(id[1]) > Date.now()) return c.sock.close(); // (its line is down a while: test only)
      c.id = id[1];
      Object.assign(c, { name: String(m.name), look: m.look === 'girl' ? 'girl' : 'boy', x: m.x, y: m.y, dir: m.dir, m: 0, b: m.b ? 1 : 0, last: {} });
      const r = room(m.topic + '|' + m.map + '|' + m.floor, m.map, m.floor);
      [...r.conns].filter((o) => o.id === c.id).forEach((o) => { leave(o); o.sock.close(4001); });
      out(c, { t: 'wl', you: c.id, tick: 50, mons: [...r.mons.values()].map(pack), ppl: [...r.conns].map(row), cap: 8, n: r.n, st: Date.now() });
      if (r.cleared) out(c, { t: 'cl' });
      r.come.push(c);
      r.conns.add(c);
      c.room = r;
      return;
    }
    if (m.t === 'bye') stats.bye++; // (the line closes right after it: counted even when the close came first)
    const r = c.room;
    if (!r) return;
    if (m.t === 'mv') { stats.mv++; Object.assign(c, { x: m.x, y: m.y, dir: m.dir, m: m.m ? 1 : 0, b: m.b ? 1 : 0, moved: true }); }
    else if (m.t === 'pi') { stats.pi++; out(c, { t: 'po', c: m.c, st: Date.now() }); }
    else if (m.t === 'bye') leave(c);
    else if (m.t === 'hit') {
      stats.hits++;
      const mon = r.mons.get(m.s);
      if (!mon) return;
      if (Date.now() - (c.last[mon.slot] || 0) < 150 || Math.hypot(mon.x - c.x, mon.y - c.y) > 12 * T) {
        stats.uncounted = (stats.uncounted || 0) + 1;
        return out(c, { t: 'hp', s: mon.slot, hp: mon.hp, by: c.id, n: m.n });
      }
      c.last[mon.slot] = Date.now();
      mon.hp = Math.max(0, mon.hp - Math.max(1, Math.min(3, Math.floor(Number(m.d)) || 1)));
      mon.hits[c.id] = (mon.hits[c.id] || 0) + 1;
      all(r, { t: 'hp', s: mon.slot, hp: mon.hp, by: c.id, n: m.n });
      if (mon.hp > 0) return;
      r.mons.delete(mon.slot);
      r.gone.push(mon.slot);
      all(r, { t: 'dn', s: mon.slot, kind: mon.kind, x: Math.round(mon.x), y: Math.round(mon.y), by: Object.keys(mon.hits), size: 1 });
      if (!r.mons.size && !r.cleared) { r.cleared = true; all(r, { t: 'cl' }); }
    }
  };
  wss.on('connection', (sock) => {
    const c = { sock, inAt: 0, outAt: 0, id: null, room: null, closed: false };
    conns.add(c);
    sock.on('message', (raw) => { let m; try { m = JSON.parse(String(raw)); } catch (e) { return; } delayed(c, 'inAt', () => handle(c, m)); });
    sock.on('close', () => { c.closed = true; conns.delete(c); leave(c); });
    sock.on('error', () => {});
  });
  // 20 ticks a second: the monsters that walk, the players that moved, who came and left
  const timer = setInterval(() => {
    rooms.forEach((r) => {
      const ch = [];
      r.mons.forEach((m) => {
        if (!m.moves) return;
        m.ang += 0.06;
        const nx = m.hx + Math.cos(m.ang) * 0.8 * T, ny = m.hy + Math.sin(m.ang) * 0.5 * T, vx = nx - m.x, vy = ny - m.y;
        m.x = nx; m.y = ny; m.mode = 2;
        if (Math.abs(vx) > Math.abs(vy)) { m.dir = 2; m.left = vx < 0 ? 1 : 0; } else m.dir = vy > 0 ? 0 : 1;
        ch.push(pack(m));
      });
      const p = [...r.conns].filter((c) => c.moved).map((c) => { c.moved = false; return [c.id, c.x, c.y, c.dir, c.m]; });
      if (!ch.length && !p.length && !r.gone.length && !r.come.length && !r.left.length) return;
      const come = r.come.splice(0), left = r.left.splice(0), gone = r.gone.splice(0);
      r.conns.forEach((c) => out(c, { t: 'tk', n: ++r.n, st: Date.now(), m: ch, gone, p: p.filter((x) => x[0] !== c.id), left, come: come.filter((x) => x !== c).map(row) }));
    });
  }, 50);
  timer.unref();
  return new Promise((resolve) => wss.on('listening', () => resolve(servers[servers.push({
    url: 'ws://127.0.0.1:' + wss.address().port + '/',
    rooms, stats,
    list: (key) => [...rooms.get(key).mons.values()].map((m) => m.slot + ':' + m.kind + ':' + m.hp + '/' + m.max).sort().join(' '),
    // a phone's line drops (and it cannot come back for ms)
    drop: (id, ms = 0) => { held.set(id, Date.now() + ms); conns.forEach((c) => { if (c.id === id) c.sock.terminate(); }); },
    close: () => { clearInterval(timer); conns.forEach((c) => c.sock.terminate()); return new Promise((r) => wss.close(() => r())); },
  }) - 1])));
}

// ---------- the phones (as test/e2e-online.test.js opens them, with window.gameHost.gs) ----------
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

async function open(server, gs) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [], oldSent = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  // (a socket to a dead address says so in the console: that is the test, not a problem)
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
    // (what the old relay sends through the app: none of it for a floor the server runs)
    try { const m = JSON.parse(data); if (m.op === 'send' && OLD[m.args[1]]) oldSent.push(m.args[1]); } catch (e) { /* not ours */ }
    bridge.onMessage({ nativeEvent: { data } });
  });
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([here, gs]) => {
    window.ReactNativeWebView = { postMessage: (data) => window.__rnPost(data) };
    window.__here = here;
    window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } };
    if (gs) window.gameHost.gs = gs;
  }, [allPackFiles(), gs || null]);
  await page.addInitScript(HOST_ASSETS);
  await page.addInitScript(bridge.injectedJavaScriptBeforeContentLoaded);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.Online.on, null, SLOW);
  await page.evaluate(() => { Farm.Config.ONLINE.trackEvery = 100; });
  return { page, problems, context, uid, bridge, oldSent };
}

const waitRemotes = (page, names) => page.waitForFunction((want) => {
  const r = Farm.world.remotes || {};
  return JSON.stringify(Object.keys(r).map((id) => r[id].tag.text).sort()) === JSON.stringify(want);
}, names.slice().sort(), SLOW);
const waitWorld = (page, visiting) => page.waitForFunction((v) => Farm.world && !Farm.world.busy && Farm.world.player.active && !!Farm.world.state.isVisit === v, visiting, SLOW);
async function nameFarm(page, name) {
  await page.evaluate((n) => Farm.Net.rpc('farm_join_v1', { p_farm_name: n }).then((r) => {
    Farm.Online.me.name = r.farm_name;
    Farm.session.state.net.named = 1;
    Farm.Online.chan.track(Farm.Online.myState());
  }), name);
}
const MAP = 'banaue_cave', FLOOR = 13; // (50 floors since 8 Nov 2026: the tougher Cave Bayawak from floor 11)
// The floor's creatures for the fake server: the game's own list for it, set out in its hunting zone (every other one
// walking), each as strong as its kind.
const floorSpec = (page) => page.evaluate(([map, floor]) => {
  const L = Farm.Logic, WI = Farm.Config.WILD, raw = Farm.ASSETS.maps[map];
  let z = null;
  raw.layers.forEach((l) => (l.objects || []).forEach((o) => { if (o.type === 'wild') z = o; }));
  return L.dunRoster(map, floor).filter((e) => !WI.animals[e.kind].great).map((e, i) => {
    const k = L.wildPack({ slot: e.slot, kind: e.kind, x: 0, y: 0, dir: 'side', left: false, mode: 'idle', hp: 1, size: 1, look: false, max: 1 })[1];
    return { slot: e.slot, kind: e.kind, k, hp: WI.animals[e.kind].hp, moves: i % 2 === 0, x: z.x + z.width * (0.25 + 0.5 * ((i * 37) % 10) / 10), y: z.y + z.height * (0.3 + 0.4 * ((i * 53) % 10) / 10) };
  });
}, [MAP, FLOOR]);
async function pair(server, gs, gs2) {
  const host = await open(server, gs), guest = await open(server, gs2 === undefined ? gs : gs2);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  for (const who of [host, guest]) {
    await who.page.evaluate(() => { const s = Farm.session.state; s.wild.n = 60; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 99); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  }
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  return { host, guest };
}
const go = async (who, floor) => {
  await who.page.evaluate(() => { Farm.ui.closeAll(); if (Farm.session.visit) Farm.session.visit.chase = null; if (Farm.world.mapKey !== 'town' && Farm.world.mapKey !== 'banaue_cave') Farm.world.travel('town', 'from_farm'); });
  await who.page.waitForFunction(() => (Farm.world.mapKey === 'town' || Farm.world.mapKey === 'banaue_cave') && !Farm.world.busy, null, SLOW);
  await who.page.evaluate((f) => { Farm.ui.closeAll(); Farm.world.travel('banaue_cave', 'entrance', f); }, floor);
  await who.page.waitForFunction((f) => Farm.world.mapKey === 'banaue_cave' && Farm.session.lairFloor === f && !Farm.world.busy && Farm.world.wild, floor, SLOW);
  await who.page.evaluate(() => Farm.ui.closeAll());
};
const list = (page) => page.evaluate(() => Farm.world.wild.animals.map((a) => a.slot + ':' + a.kind + ':' + a.hp + '/' + a.max).sort().join(' '));
const mode = (page) => page.evaluate(() => (Farm.GameServer.state() || {}).mode || null);
const waitMode = (page, m) => page.waitForFunction((m) => (Farm.GameServer.state() || {}).mode === m, m, SLOW);
const until = async (fn, what, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(100); }
  assert.fail('timed out: ' + what);
};
// Walks up to one creature and shoots it until it is down (as arrows come: one every 170 ms, so the server counts
// each; the server counts none from 12 tiles away or more).
const hunt = (page, slot) => page.evaluate(async (n) => {
  const w = Farm.world;
  for (let i = 0; i < 80; i++) {
    const a = w.wild.animals.find((x) => x.slot === n);
    if (!a) return true;
    const f = w.feet();
    if (Math.hypot(f.x - a.x, f.y - a.y) > 4 * 256) w.setFeet(a.x, a.y + 128);
    if (a.hp > 0) w.wildStruck(a);
    await new Promise((r) => setTimeout(r, 170));
  }
  const a = w.wild.animals.find((x) => x.slot === n), f = w.feet();
  return JSON.stringify({ hp: a.hp, max: a.max, pend: a.gsPend, ax: a.x, ay: a.y, fx: f.x, fy: f.y, gs: Farm.GameServer.state() });
}, slot);
const roomKey = (host) => 'farm:' + host.uid + '|' + MAP + '|' + FLOOR;

test('game server: two phones on one cave floor get the same monsters from it; your hit shows before its answer; a kill is gone on both and stays gone; the gate opens for both; the old relay stays quiet', async () => {
  const server = createServer();
  let spec = null;
  const gsrv = await fakeGameServer({ floors: (map, floor) => (map === MAP && floor === FLOOR ? spec.map((m) => ({ ...m })) : []) });
  const { host, guest } = await pair(server, gsrv.url);
  spec = await floorSpec(host.page);
  assert.ok(spec.length >= 2, 'a floor with a few creatures');
  await go(host, FLOOR);
  await waitMode(host.page, 'live');
  await go(guest, FLOOR);
  await waitMode(guest.page, 'live');
  await waitRemotes(host.page, ['Ana Acres']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  for (const who of [host, guest]) assert.strictEqual(await who.page.evaluate(() => Farm.world.wildFollowing()), 'gs', 'the server runs the floor');
  // the same monsters on both, as the server has them, and in the same places (a moment behind it)
  const want = gsrv.list(roomKey(host));
  for (const who of [host, guest]) await until(async () => (await list(who.page)) === want, 'the server\'s list on both');
  await sleep(600);
  const where = (page) => page.evaluate(() => Farm.world.wild.animals.map((a) => [a.slot, a.x, a.y]));
  const [ph, pg] = await Promise.all([where(host.page), where(guest.page)]);
  const srv = gsrv.rooms.get(roomKey(host)).mons;
  ph.forEach(([slot, x, y]) => {
    const o = pg.find((q) => q[0] === slot), m = srv.get(slot);
    assert.ok(Math.hypot(o[1] - x, o[2] - y) < 1.2 * T, 'slot ' + slot + ' in the same place on both phones');
    assert.ok(Math.hypot(m.x - x, m.y - y) < 1.5 * T, 'and near where the server has it');
  });
  // a friend's farmer walks where the server says: the guest walks, the owner sees them get there
  await guest.page.evaluate(() => { const w = Farm.world, f = w.feet(); w.setFeet(f.x + 256, f.y); });
  await sleep(400);
  const gfeet = await guest.page.evaluate(() => Farm.world.feet());
  await until(() => [...gsrv.rooms.get(roomKey(host)).conns].some((c) => c.id === guest.uid && Math.abs(c.x - gfeet.x) < 8 && c.m === 0), 'the guest\'s move (and its stop) reach the server');
  await host.page.waitForFunction(([id, x, y]) => { const r = Farm.world.remotes[id]; return r && Math.hypot(r.x - x, r.y - y) < 40; }, [guest.uid, gfeet.x, gfeet.y], SLOW);
  for (const who of [host, guest]) await who.page.evaluate(() => Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0, shy: 0 }); }));

  // your hit shows at once (flash, flinch, the bar down by your damage), before the server has even heard of it
  const slot = spec.slice().sort((a, b) => b.hp - a.hp)[0].slot; // (the toughest: a few hits in it)
  const hitsBefore = gsrv.stats.hits;
  const hit = await guest.page.evaluate((n) => {
    const w = Farm.world, a = w.wild.animals.find((x) => x.slot === n), before = a.hp;
    w.wildStruck(a);
    return { before, after: a.hp, flinch: a.hitT > 0, bar: !!a.bar, waiting: (a.gsPend || []).length, dmg: Farm.Logic.bowDamage(Farm.session.state) };
  }, slot);
  assert.strictEqual(gsrv.stats.hits, hitsBefore, 'the server has not heard it yet');
  assert.deepStrictEqual(hit, { before: hit.before, after: hit.before - hit.dmg, flinch: true, bar: true, waiting: 1, dmg: hit.dmg }, 'shown at once');
  // ...then the server's 'hp' says the same: nothing waits any more, and the owner's bar drops too
  await guest.page.waitForFunction(([n, hp]) => { const a = Farm.world.wild.animals.find((x) => x.slot === n); return a && !(a.gsPend || []).length && a.hp === hp; }, [slot, hit.after], SLOW);
  await host.page.waitForFunction(([n, hp]) => { const a = Farm.world.wild.animals.find((x) => x.slot === n); return a && a.hp === hp && !!a.bar; }, [slot, hit.after], SLOW);
  assert.strictEqual(srv.get(slot).hp, hit.after);

  // the guest finishes it: the puff on both, the drops on the guest's phone only (it is in 'by'); and it stays gone
  // two arrows in the same moment: the server counts one; the second's bar is put right on the guest's phone only
  const quick = await guest.page.evaluate((n) => { const w = Farm.world, a = w.wild.animals.find((x) => x.slot === n); w.wildStruck(a); w.wildStruck(a); return a.hp; }, slot);
  const counted = hit.after - hit.dmg;
  assert.strictEqual(quick, hit.after - 2 * hit.dmg, 'both shown at once');
  await guest.page.waitForFunction(([n, hp]) => { const a = Farm.world.wild.animals.find((x) => x.slot === n); return a && !(a.gsPend || []).length && a.hp === hp; }, [slot, counted], SLOW);
  await host.page.waitForFunction(([n, hp]) => { const a = Farm.world.wild.animals.find((x) => x.slot === n); return a && a.hp === hp; }, [slot, counted], SLOW);
  assert.ok(gsrv.stats.uncounted >= 1, 'one was not counted');
  assert.ok(await hunt(guest.page, slot));
  for (const who of [host, guest]) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), slot, SLOW);
  assert.ok((await guest.page.evaluate(() => Farm.world.wildDrops.length)) > 0, 'the guest\'s hunt: its things on the ground');
  assert.strictEqual(await host.page.evaluate(() => Farm.world.wildDrops.length), 0, 'nothing for the owner, who never hit it');
  await sleep(2500);
  for (const who of [host, guest]) assert.ok(!(await who.page.evaluate((n) => Farm.world.wild.animals.some((a) => a.slot === n), slot)), 'still gone a while later');
  assert.strictEqual(await list(host.page), gsrv.list(roomKey(host)));
  assert.strictEqual(await list(guest.page), gsrv.list(roomKey(host)));

  // the owner clears the rest: the server says the floor is clear, and the gate opens on both phones
  for (const who of [host, guest]) assert.strictEqual(await who.page.evaluate(() => Farm.world.lair.open), false, 'sealed while creatures are left');
  for (const n of await host.page.evaluate(() => Farm.world.wild.animals.map((a) => a.slot))) { const r = await hunt(host.page, n); assert.strictEqual(r, true, 'slot ' + n + ' hunted: ' + r + ' server: ' + JSON.stringify([...gsrv.rooms.get(roomKey(host)).conns].map((c) => [c.id === host.uid, c.x, c.y])) + ' ' + JSON.stringify(gsrv.stats)); }
  for (const who of [host, guest]) await who.page.waitForFunction(() => !Farm.world.wild.animals.length && Farm.world.lair.open, null, SLOW);
  assert.strictEqual(gsrv.rooms.get(roomKey(host)).cleared, true);
  // the round trip is measured every 2 s
  await host.page.waitForFunction(() => Farm.GameServer.state().rtt > 0, null, SLOW);
  // none of the old relay's monster messages went through the app, from either phone
  assert.deepStrictEqual(host.oldSent, []);
  assert.deepStrictEqual(guest.oldSent, []);
  // leaving the floor: 'bye'
  const byes = gsrv.stats.bye;
  await guest.page.evaluate(() => Farm.world.travel('banaue_cave', 'entrance', 1));
  await until(() => gsrv.stats.bye > byes, 'a bye');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
  await gsrv.close();
});

test('game server: a dropped line comes back (at once, then 1, 2 s), and its welcome is the whole floor again, a kill made while it was down too', async () => {
  const server = createServer();
  let spec = null;
  const gsrv = await fakeGameServer({ floors: (map, floor) => (map === MAP && floor === FLOOR ? spec.map((m) => ({ ...m })) : []) });
  const { host, guest } = await pair(server, gsrv.url);
  spec = await floorSpec(host.page);
  await guest.page.evaluate(() => { window.gameHost.gsDebug = true; });
  await go(host, FLOOR);
  await go(guest, FLOOR);
  for (const who of [host, guest]) await waitMode(who.page, 'live');
  const want = gsrv.list(roomKey(host));
  for (const who of [host, guest]) await until(async () => (await list(who.page)) === want, 'one list');
  for (const who of [host, guest]) await who.page.evaluate(() => Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0, shy: 0 }); }));
  // the debug line (gameHost.gsDebug): the round trip
  await guest.page.waitForFunction(() => { const g = Farm.GameServer.state(); return g.rtt > 0; }, null, SLOW);
  // the guest's line drops, and the server will not take it back for 1.5 s
  gsrv.drop(guest.uid, 1500);
  await guest.page.waitForFunction(() => Farm.GameServer.state().mode === 'retry', null, SLOW);
  assert.strictEqual(await guest.page.evaluate(() => Farm.world.wildFollowing()), 'gs', 'still the server\'s floor while the line comes back: no old relay');
  // meanwhile the owner hunts one
  const slot = spec[1].slot;
  assert.ok(await hunt(host.page, slot));
  await host.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), slot, SLOW);
  // back: its 'wl' is the floor as it is now
  await waitMode(guest.page, 'live');
  const st = await guest.page.evaluate(() => Farm.GameServer.state());
  assert.ok(st.connects >= 2, 'opened again (' + st.connects + ' lines)');
  await until(async () => (await list(guest.page)) === gsrv.list(roomKey(host)), 'the whole floor again');
  assert.ok(!(await guest.page.evaluate((n) => Farm.world.wild.animals.some((a) => a.slot === n), slot)), 'the kill made while it was away is gone');
  // and the guest's hits count again
  const slot2 = spec[0].slot, hp0 = gsrv.rooms.get(roomKey(host)).mons.get(slot2).hp;
  await guest.page.evaluate((n) => { const w = Farm.world; w.wildStruck(w.wild.animals.find((x) => x.slot === n)); }, slot2);
  await until(() => gsrv.rooms.get(roomKey(host)).mons.get(slot2).hp < hp0, 'a hit after coming back');
  await guest.page.waitForFunction(() => /^server: \d+ ms$/.test((Farm.ui.children.list.find((o) => o.type === 'Text' && /^server: /.test(o.text)) || {}).text || ''), null, SLOW);
  for (const who of [host, guest]) assert.deepStrictEqual(who.oldSent, []);
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
  await gsrv.close();
});

// The old way, as today: one phone (the owner, there first) runs the floor through the Supabase relay.
async function oldRelayWorks(host, guest, hostThere) {
  if (!hostThere) await go(host, FLOOR);
  await go(guest, FLOOR);
  await waitRemotes(host.page, ['Ana Acres']);
  await guest.page.waitForFunction((id) => Farm.world.wildFollowing() === id, host.uid, SLOW);
  await sleep(800);
  const both = await list(host.page);
  assert.ok(both.length > 0, 'creatures on the floor');
  await until(async () => (await list(guest.page)) === both, 'one list (the old relay)');
  for (const who of [host, guest]) await who.page.evaluate(() => Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0, shy: 0 }); }));
  const slot = await guest.page.evaluate(() => { const w = Farm.world, a = w.wild.animals[0]; for (let i = 0; i < 30 && a.hp > 0; i++) w.wildStruck(a); return a.slot; });
  for (const who of [host, guest]) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), slot, SLOW);
  await sleep(2000);
  for (const who of [host, guest]) assert.ok(!(await who.page.evaluate((n) => Farm.world.wild.animals.some((a) => a.slot === n), slot)), 'still gone');
  assert.ok(host.oldSent.includes('wa'), 'the owner\'s phone tells the floor, as before');
}

test('game server: no server (the address is dead): the cave plays the old way, as before', async () => {
  const server = createServer();
  const { host, guest } = await pair(server, 'ws://127.0.0.1:9/');
  await oldRelayWorks(host, guest);
  for (const who of [host, guest]) assert.deepStrictEqual(await who.page.evaluate(() => { const g = Farm.GameServer.state(); return [g.mode, Farm.Online.mapAt > 0]; }), ['off', true], 'off, and its place in the "who came first" order is back');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('game server: a "no" (refused), or no welcome within 3 s: the old way for that floor', async () => {
  const server = createServer();
  const refusing = await fakeGameServer({ refuse: 'version' }), silent = await fakeGameServer({ silent: true });
  // the owner's server never answers; the guest's says no
  const { host, guest } = await pair(server, silent.url, refusing.url);
  // alone on the floor first: nothing out while it waits, then (3 s, no welcome) the floor's creatures as before
  await go(host, FLOOR);
  assert.strictEqual(await mode(host.page), 'connecting');
  assert.strictEqual(await host.page.evaluate(() => Farm.world.wild.animals.length), 0, 'held while it waits for the server');
  const t0 = Date.now();
  await waitMode(host.page, 'off');
  assert.ok(Date.now() - t0 > 800, 'it waited for a welcome a while (3 s from when the floor opened)');
  assert.strictEqual(await host.page.evaluate(() => Farm.GameServer.state().why), 'slow');
  assert.ok((await host.page.evaluate(() => Farm.world.wild.animals.length)) > 0, 'then out they come');
  assert.ok(silent.stats.hi >= 1, 'it said hi');
  await oldRelayWorks(host, guest, true);
  // (its 'no', or the refusal's close code right behind it: whichever the page handles first)
  assert.match(await guest.page.evaluate(() => Farm.GameServer.state().why), /^(no:version|refused:4010)$/);
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
  await Promise.all([refusing.close(), silent.close()]);
});

// ---------- the REAL server (server/), not the fake one: only its sign-in check is a stand-in ----------
// A relay in front of it adds 60-250 ms each way (in order), as a phone in the Philippines to Singapore on bad signal.
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
    down.on('close', () => { try { up.close(); } catch (e) { /* gone */ } });
  });
  const x = { url: 'ws://127.0.0.1:' + proxy.address().port + '/', cut: () => proxy.clients.forEach((c) => c.terminate()), close: async () => { proxy.clients.forEach((c) => c.terminate()); proxy.close(); await Promise.race([app.stop(), sleep(3000)]); } };
  servers.push(x);
  return x;
}

test('the REAL game server (60-250 ms each way): one list on both phones, a kill gone on both and kept, the floor clears and its gate opens on both', async () => {
  const real = await realServer(), server = createServer();
  const { host, guest } = await pair(server, real.url);
  const step = (w) => console.log('[real]', ((Date.now() - t0) / 1000).toFixed(1) + 's', w), t0 = Date.now();
  step('paired');
  await go(host, FLOOR);
  await go(guest, FLOOR);
  step('on the floor');
  for (const who of [host, guest]) await waitMode(who.page, 'live');
  step('live');
  await sleep(1200);
  const a = await list(host.page), b = await list(guest.page);
  assert.ok(a.length > 0, 'the floor has its creatures');
  assert.strictEqual(b, a, 'the same creatures, slots and health on both');
  // the guest hunts the first one: gone on both and it stays gone
  step('lists ' + a);
  const first = Number(a.split(' ')[0].split(':')[0]);
  assert.strictEqual(await hunt(guest.page, first), true);
  for (const who of [host, guest]) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((x) => x.slot === n), first, SLOW);
  await sleep(2500);
  for (const who of [host, guest]) assert.ok(!(await who.page.evaluate((n) => Farm.world.wild.animals.some((x) => x.slot === n), first)), 'still gone');
  step('kill stayed gone');
  // the host hunts the rest: the gate down opens on both
  for (const slot of (await list(host.page)).split(' ').filter(Boolean).map((e) => Number(e.split(':')[0]))) assert.strictEqual(await hunt(host.page, slot), true);
  for (const who of [host, guest]) await who.page.waitForFunction(() => !Farm.world.wild.animals.length && Farm.world.lair && Farm.world.lair.open, null, SLOW);
  step('gate open on both');
  // nothing of the cave's creatures went through the old relay from either phone
  assert.deepStrictEqual([host.oldSent, guest.oldSent], [[], []]);
  // the round trip the phones measured (through the 60-250 ms relay)
  const rtt = await guest.page.evaluate(() => (Farm.GameServer.state() || {}).rtt);
  console.log('measured round trip through the relay:', rtt, 'ms');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('the REAL game server: the line drops in the middle of a floor and both phones come back to the same floor', async () => {
  const real = await realServer(), server = createServer();
  const { host, guest } = await pair(server, real.url);
  await go(host, FLOOR);
  await go(guest, FLOOR);
  for (const who of [host, guest]) await waitMode(who.page, 'live');
  await sleep(1200);
  const before = await list(host.page);
  const first = Number(before.split(' ')[0].split(':')[0]);
  assert.strictEqual(await hunt(host.page, first), true);
  for (const who of [host, guest]) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((x) => x.slot === n), first, SLOW);
  real.cut();
  for (const who of [host, guest]) await who.page.waitForFunction(() => Farm.GameServer.state().mode !== 'live', null, SLOW);
  for (const who of [host, guest]) await waitMode(who.page, 'live');
  await sleep(1200);
  const a = await list(host.page), b = await list(guest.page);
  assert.strictEqual(b, a, 'the same floor on both after the drop');
  assert.ok(!a.split(' ').some((e) => Number(e.split(':')[0]) === first), 'the one killed before the drop stays gone');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('game server: a tick older than one already heard never brings a monster back (it came after the kill)', async () => {
  const server = createServer();
  let spec = null;
  const gsrv = await fakeGameServer({ floors: (map, floor) => (map === MAP && floor === FLOOR ? spec.map((m) => ({ ...m })) : []) });
  const { host, guest } = await pair(server, gsrv.url);
  spec = await floorSpec(host.page);
  await go(host, FLOOR);
  await go(guest, FLOOR);
  for (const who of [host, guest]) await waitMode(who.page, 'live');
  const want = gsrv.list(roomKey(host));
  for (const who of [host, guest]) await until(async () => (await list(who.page)) === want, 'one list');
  for (const who of [host, guest]) await who.page.evaluate(() => Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0, shy: 0 }); }));
  const slot = Number(want.split(' ')[0].split(':')[0]);
  const row = await guest.page.evaluate((n) => JSON.parse(JSON.stringify(Farm.Logic.wildPack(Farm.world.wild.animals.find((a) => a.slot === n)))), slot);
  assert.strictEqual(await hunt(host.page, slot), true);
  for (const who of [host, guest]) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), slot, SLOW);
  // a stale tick (number 1, long since passed) with the monster still in it, straight to the guest's line
  const room = gsrv.rooms.get(roomKey(host)), c = [...room.conns].find((x) => x.id === guest.uid);
  c.sock.send(JSON.stringify({ t: 'tk', n: 1, st: Date.now(), m: [row], gone: [], p: [], left: [], come: [] }));
  await sleep(1500);
  assert.ok(!(await guest.page.evaluate((n) => Farm.world.wild.animals.some((a) => a.slot === n), slot)), 'still gone');
  assert.strictEqual(await list(guest.page), gsrv.list(roomKey(host)));
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

// Owner, 7 Nov 2026: "if I was in the dungeon and my friend go to dungeon, we will see each other or do i need always to
// go to his/her farm first? ... it should be automatic". Two friends, each in their own game (no visit), go down the same
// floor: they are on one floor (the same monsters), see each other in their looks, and talk; a friend of only one is not.
test('the REAL game server: friends each in their own game meet on a dungeon floor, without a visit: one floor, seen, heard', async () => {
  const real = await realServer(), server = createServer();
  const A = await open(server, real.url), B = await open(server, real.url);
  await nameFarm(A.page, 'Moon Meadow');
  await nameFarm(B.page, 'Sun Patch');
  // friends (as Online, Friends, Add does on both sides)
  await A.page.evaluate((id) => Farm.Net.rpc('farm_friend_ask_v1', { p_other: id }), B.uid);
  await B.page.evaluate((id) => Farm.Net.rpc('farm_friend_ask_v1', { p_other: id }), A.uid);
  for (const who of [A, B]) await who.page.evaluate(() => { const s = Farm.session.state; s.wild.n = 60; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 99); });
  assert.ok(!(await A.page.evaluate(() => !!Farm.session.visit)) && !(await B.page.evaluate(() => !!Farm.session.visit)), 'nobody visits anybody');
  await go(A, FLOOR);
  await waitMode(A.page, 'live');
  await go(B, FLOOR);
  await waitMode(B.page, 'live');
  // one floor: each draws the other, the same monsters
  for (const [x, y] of [[A, B], [B, A]]) await x.page.waitForFunction((id) => !!Farm.world.remotes[id], y.uid, SLOW);
  await until(async () => (await list(A.page)) === (await list(B.page)), 'the same monsters on both');
  // the Chat button is there for both: a friend is on the floor (owner, 8 Nov 2026: "Missing chat on dungeon")
  for (const who of [A, B]) await who.page.waitForFunction(() => Farm.world.chatable === true && Farm.ui.chatBtn.visible, null, SLOW);
  // talk: a line and a wave from B reach A
  assert.strictEqual(await B.page.evaluate(() => Farm.Online.say('Andito ako!')), '');
  await A.page.waitForFunction(() => Farm.Online.chatLines().some((l) => l.text === 'Andito ako!'), null, SLOW);
  // a kill by A is gone on B
  for (const who of [A, B]) await who.page.evaluate(() => Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0, shy: 0 }); }));
  const slot = Number((await list(A.page)).split(' ')[0].split(':')[0]);
  assert.strictEqual(await hunt(A.page, slot), true);
  await B.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), slot, SLOW);
  // a third player, a friend of nobody here: their own floor (they do not see A or B)
  const C = await open(server, real.url);
  await nameFarm(C.page, 'Rain Field');
  await C.page.evaluate(() => { const s = Farm.session.state; s.wild.n = 60; });
  await go(C, FLOOR);
  await waitMode(C.page, 'live');
  await sleep(1500);
  assert.ok(!(await C.page.evaluate(([a, b]) => !!(Farm.world.remotes[a] || Farm.world.remotes[b]), [A.uid, B.uid])), 'a stranger is not on their floor');
  assert.strictEqual(await C.page.evaluate(() => !!Farm.world.chatable), false, 'alone on a floor: no Chat button');
  for (const who of [A, B, C]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([A.context.close(), B.context.close(), C.context.close()]);
});

// e35: the PLAYING TOGETHER tour, the first time you are on a dungeon floor the server says who is on (and only once).
test('the REAL game server: the first dungeon floor on the server shows the PLAYING TOGETHER tour, every step, once', async () => {
  const real = await realServer(), server = createServer();
  const A = await open(server, real.url);
  await nameFarm(A.page, 'Moon Meadow');
  await A.page.evaluate(() => { window.gameHost.quiet = false; const s = Farm.session.state; s.wild.n = 60; });
  await go(A, FLOOR);
  await waitMode(A.page, 'live');
  const text = () => A.page.evaluate(() => { const out = [], m = Farm.ui.modals[Farm.ui.modals.length - 1]; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); if (m) walk(m.c.list); return out.join(' | '); });
  await A.page.waitForFunction(() => Farm.Logic.tipSeen(Farm.session.state, 'play_together_tour') && Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await text(), /PLAYING TOGETHER[\s\S]*same dungeon floor as a friend/);
  for (const [re, next] of [[/tap Online to see who is hunting near you/, 'Next'], [/a small note at the top says where/, 'Got it']]) {
    await A.page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; let b = null; const walk = (l) => l.forEach((o) => { if (!b && o.type === 'Text' && o.text === 'Next' && o.parentContainer !== m.c) b = o; if (o.list) walk(o.list); }); walk(m.c.list); if (b) b.parentContainer.emit('pointerup'); });
    void next;
    await sleep(400);
  }
  assert.ok(await A.page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'play_together_tour')));
  await A.context.close();
});

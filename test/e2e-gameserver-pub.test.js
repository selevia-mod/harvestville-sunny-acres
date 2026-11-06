// The game server, step 2 (docs/game-server.md, "Step 2"): the hunting places open to everyone, 30 a room. The phone's
// side (src/19zzzzzzzzz-gameserver.js) end to end: real game pages, each a WebView in the Selebox app running the real
// app bridge over a stand-in for the app's Supabase (test/net-mock.js), as test/e2e-gameserver.test.js does.
//
// Two kinds of server:
//   - a SMALL FAKE of the public rooms here (fakePubServer: only what the contract's "Step 2" says, with simple scripted
//     animals and walking bots), with 60-250 ms of delay each way: what the phone side was built against;
//   - the REAL server (server/lib/server.js, its public rooms: server/lib/pub.js) behind a 60-250 ms relay. A server
//     without public rooms refuses topic 'pub' (no 'topic'): the tests marked "REAL pub" then skip themselves with that
//     reason, and the last one checks the old way instead.
// Run alone, after `node build.js`: node --test test/e2e-gameserver-pub.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

const WSmod = (() => { try { return require('ws'); } catch (e) { return require('../server/node_modules/ws'); } })();
const WebSocketServer = WSmod.WebSocketServer || WSmod.Server, WebSocket = WSmod.WebSocket || WSmod;

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SLOW = { timeout: 90000 };
const T = 256;
const HUNT = { wa: 1, wh: 1, wd: 1, wb: 1, bt: 1, ar: 1 }; // what a farm's room must never carry for a public place
const MAP = 'pulag';
const rand = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the fake public rooms (docs/game-server.md, Step 2) ----------
// animals(map) -> [{ slot, kind, k (packed kind), hp, x, y, moves }]. A room: 'map|ch', up to `cap`; who joins: the
// 'with' player's room of this map if it has space, else the fullest with space, else a new one (the lowest free
// number). Each phone gets the players within VIEW (18 tiles), at most the 15 nearest: coming into view is a 'come',
// going out of it a 'left'. Rows: [id, name, look, x, y, dir, m, lk]. Bait: one each, told to the others ('bt' with id
// and until). Arrows: passed on to the phones that see the shooter. Kills as step 1, never 'cl'. Bots: players with no
// phone that walk round a point (the cheap-phone check).
const servers = [];
function fakePubServer({ animals, cap = 30, refuse } = {}) {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  const rooms = new Map(), conns = new Set();
  const VIEW = 18 * T, MOST = 15;
  const stats = { hi: [], hits: [], mv: 0, bt: [], ar: [], bye: 0, other: [], bytes: new Map() };
  const pack = (m) => [m.slot, m.k, Math.round(m.x), Math.round(m.y), m.dir, m.left, m.mode, m.hp, 100, 0, m.max];
  const row = (p) => [p.id, p.name, p.look, Math.round(p.x), Math.round(p.y), p.dir, p.m, p.lk];
  const roomFor = (map, withId) => {
    const mine = [...rooms.values()].filter((r) => r.map === map);
    const w = withId && mine.find((r) => r.players.has(withId) && r.players.size < cap);
    if (w) return w;
    const open = mine.filter((r) => r.players.size < cap).sort((a, b) => b.players.size - a.players.size || a.ch - b.ch)[0];
    if (open) return open;
    let ch = 1;
    while (mine.some((r) => r.ch === ch)) ch++;
    const mons = new Map();
    (animals ? animals(map) : []).forEach((m) => mons.set(m.slot, { ...m, hx: m.x, hy: m.y, ang: m.slot, dir: 2, left: 0, mode: 0, max: m.hp, hits: {}, last: {} }));
    const r = { key: map + '|' + ch, map, ch, mons, players: new Map(), gone: [], baits: new Map(), n: 0 };
    rooms.set(r.key, r);
    return r;
  };
  const inView = (c, r) => [...r.players.values()].filter((p) => p !== c && Math.hypot(p.x - c.x, p.y - c.y) <= VIEW)
    .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, MOST);
  const delayed = (c, dir, fn) => {
    const now = Date.now(), at = now - (c[dir + 'Sent'] || 0) < 30 ? c[dir] : Math.max(c[dir], now + rand(60, 250));
    c[dir] = at;
    c[dir + 'Sent'] = now;
    setTimeout(fn, Math.max(0, at - now));
  };
  const out = (c, m) => {
    if (!c.sock) return;
    const data = JSON.stringify(m);
    stats.bytes.set(c.id, (stats.bytes.get(c.id) || 0) + data.length);
    delayed(c, 'outAt', () => { if (c.sock.readyState === 1) c.sock.send(data); });
  };
  const leave = (c) => {
    const r = c.room;
    c.room = null;
    if (!r || r.players.get(c.id) !== c) return;
    r.players.delete(c.id);
    r.baits.delete(c.id);
    if (![...r.players.values()].some((p) => p.sock)) rooms.delete(r.key); // (an empty public room goes at once)
  };
  const handle = (c, m) => {
    if (c.closed && m.t !== 'bye') return;
    if (m.t === 'hi') {
      const id = /^test-token:(.+)$/.exec(String(m.token || ''));
      stats.hi.push({ id: id && id[1], topic: m.topic, map: m.map, floor: m.floor, with: m.with, lk: m.lk, bk: m.bk });
      if (refuse || !id || m.v !== 1 || m.topic !== 'pub' || m.floor !== 0) {
        out(c, { t: 'no', why: refuse || (!id ? 'auth' : m.v !== 1 ? 'version' : 'topic') });
        return delayed(c, 'outAt', () => c.sock.close(4011));
      }
      if (c.room) leave(c);
      c.id = id[1];
      rooms.forEach((r) => { const o = r.players.get(c.id); if (o && o !== c) { leave(o); o.sock.close(4001); } });
      Object.assign(c, { name: String(m.name), look: m.look === 'girl' ? 'girl' : 'boy', lk: m.lk && typeof m.lk === 'object' ? { cs: String(m.lk.cs || '').slice(0, 64), pt: m.lk.pt ? 1 : 0, rd: m.lk.rd ? 1 : 0 } : {}, x: m.x, y: m.y, dir: m.dir, m: 0, last: {} });
      const r = roomFor(m.map, m.with);
      r.players.set(c.id, c);
      c.room = r;
      const view = inView(c, r);
      c.view = new Set(view.map((p) => p.id));
      out(c, { t: 'wl', you: c.id, tick: 50, mons: [...r.mons.values()].map(pack), ppl: view.map(row), cap, ch: r.ch, n: r.n, st: Date.now() });
      return;
    }
    if (m.t === 'bye') stats.bye++;
    const r = c.room;
    if (!r) return;
    if (m.t === 'mv') { stats.mv++; Object.assign(c, { x: m.x, y: m.y, dir: m.dir, m: m.m ? 1 : 0, moved: true }); }
    else if (m.t === 'pi') out(c, { t: 'po', c: m.c, st: Date.now() });
    else if (m.t === 'bye') leave(c);
    else if (m.t === 'bt') {
      stats.bt.push({ id: c.id, x: m.x, y: m.y });
      const b = { id: c.id, x: m.x, y: m.y, until: Date.now() + 120000 };
      r.baits.set(c.id, b);
      r.players.forEach((p) => { if (p !== c) out(p, { t: 'bt', ...b }); });
    } else if (m.t === 'ar') {
      stats.ar.push({ id: c.id, x: m.x, y: m.y });
      r.players.forEach((p) => { if (p !== c && p.view && p.view.has(c.id)) out(p, { t: 'ar', id: c.id, x: m.x, y: m.y, a: m.a, l: m.l, b: m.b }); });
    } else if (m.t === 'hit') {
      stats.hits.push(m.s);
      const mon = r.mons.get(m.s);
      if (!mon) return;
      if (Date.now() - (c.last[mon.slot] || 0) < 150 || Math.hypot(mon.x - c.x, mon.y - c.y) > 12 * T) return out(c, { t: 'hp', s: mon.slot, hp: mon.hp, by: c.id, n: m.n });
      c.last[mon.slot] = Date.now();
      mon.hp = Math.max(0, mon.hp - Math.max(1, Math.min(3, Math.floor(Number(m.d)) || 1)));
      mon.hits[c.id] = (mon.hits[c.id] || 0) + 1;
      r.players.forEach((p) => out(p, { t: 'hp', s: mon.slot, hp: mon.hp, by: c.id, n: m.n }));
      if (mon.hp > 0) return;
      r.mons.delete(mon.slot);
      r.gone.push(mon.slot);
      r.players.forEach((p) => out(p, { t: 'dn', s: mon.slot, kind: mon.kind, x: Math.round(mon.x), y: Math.round(mon.y), by: Object.keys(mon.hits), size: 1 }));
    } else stats.other.push(m.t);
  };
  wss.on('connection', (sock) => {
    const c = { sock, inAt: 0, outAt: 0, id: null, room: null, closed: false };
    conns.add(c);
    sock.on('message', (raw) => { let m; try { m = JSON.parse(String(raw)); } catch (e) { return; } delayed(c, 'inAt', () => handle(c, m)); });
    sock.on('close', () => { c.closed = true; conns.delete(c); leave(c); });
    sock.on('error', () => {});
  });
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
      r.players.forEach((b) => { // the bots walk round their point, each its own way
        if (b.sock || !b.walk) return;
        const k = b.walk;
        k.ang += k.speed;
        const nx = k.cx + Math.cos(k.ang) * k.r, ny = k.cy + Math.sin(k.ang) * k.r * 0.8, vx = nx - b.x, vy = ny - b.y;
        b.x = nx; b.y = ny; b.m = 1; b.moved = true;
        b.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      });
      const gone = r.gone.splice(0), moved = new Set();
      r.players.forEach((p) => { if (p.moved) { moved.add(p.id); p.moved = false; } });
      r.n++;
      r.players.forEach((c) => {
        if (!c.sock) return;
        const view = inView(c, r), now = new Set(view.map((p) => p.id));
        const come = view.filter((p) => !c.view.has(p.id)).map(row), left = [...c.view].filter((id) => !now.has(id));
        const p = view.filter((q) => c.view.has(q.id) && moved.has(q.id)).map((q) => [q.id, Math.round(q.x), Math.round(q.y), q.dir, q.m]);
        c.view = now;
        if (!ch.length && !p.length && !gone.length && !come.length && !left.length) return;
        out(c, { t: 'tk', n: r.n, st: Date.now(), m: ch, gone, p, left, come });
      });
    });
  }, 50);
  timer.unref();
  return new Promise((resolve) => wss.on('listening', () => resolve(servers[servers.push({
    url: 'ws://127.0.0.1:' + wss.address().port + '/',
    rooms, stats,
    roomOf: (id) => [...rooms.values()].find((r) => r.players.has(id) && r.players.get(id).sock) || null,
    list: (r) => [...r.mons.values()].map((m) => m.slot + ':' + m.kind + ':' + m.hp + '/' + m.max).sort().join(' '),
    // n bots walking round (x, y) in the room of map that `near` is in (or the map's fullest)
    bots: (map, n, x, y, near) => {
      const r = (near && [...rooms.values()].find((q) => q.players.has(near))) || roomFor(map);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rr = (2 + (i % 5) * 2.5) * T;
        const b = { id: 'bot-' + i, name: 'Bot ' + i, look: i % 2 ? 'girl' : 'boy', lk: { cs: '', pt: 0, rd: 0 }, dir: 'down', m: 1, x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr,
          walk: { cx: x, cy: y, r: rr, ang: a, speed: (i % 2 ? 1 : -1) * (0.02 + (i % 7) * 0.004) } };
        r.players.set(b.id, b);
      }
      return r;
    },
    close: () => { clearInterval(timer); conns.forEach((c) => c.sock.terminate()); return new Promise((r) => wss.close(() => r())); },
  }) - 1])));
}

// ---------- the phones (as test/e2e-gameserver.test.js opens them) ----------
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

async function open(server, gs, name) {
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
    // (what goes out on the old relay, Supabase Realtime, through the app: each broadcast's event and where it was sent from)
    try { const m = JSON.parse(data); if (m.op === 'send') relay.push({ ev: m.args[1], map: m.args[2] && m.args[2].map }); } catch (e) { /* not ours */ }
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
  const who = { page, problems, context, uid, bridge, relay, name };
  if (name) await nameFarm(page, name);
  await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic;
    s.wild.n = 60; L.addItem(s, 'bow', 1); L.addItem(s, 'arrows', 99); L.addItem(s, 'bait', 5); s.sel = s.inv.findIndex((x) => x && x.id === 'bow');
    s.time = 600; // (daytime: the same animals for everyone)
  });
  return who;
}
async function nameFarm(page, name) {
  await page.evaluate((n) => Farm.Net.rpc('farm_join_v1', { p_farm_name: n }).then((r) => {
    Farm.Online.me.name = r.farm_name;
    Farm.session.state.net.named = 1;
    Farm.Online.chan.track(Farm.Online.myState());
  }), name);
}
const waitRemotes = (page, names) => page.waitForFunction((want) => {
  const r = Farm.world.remotes || {};
  return JSON.stringify(Object.keys(r).map((id) => r[id].tag.text).sort()) === JSON.stringify(want);
}, names.slice().sort(), SLOW);
const remoteNames = (page) => page.evaluate(() => Object.keys(Farm.world.remotes || {}).map((id) => Farm.world.remotes[id].tag.text).sort());
const waitWorld = (page, visiting) => page.waitForFunction((v) => Farm.world && !Farm.world.busy && Farm.world.player.active && !!Farm.world.state.isVisit === v, visiting, SLOW);
// A friend visits: the guest on the owner's farm (as test/e2e-gameserver.test.js pair()).
async function visit(host, guest) {
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, [host.name + ' (owner)']);
}
// Off to a hunting place, by town (a visitor: into the owner's town in their own game, then out to hunt).
const go = async (who, map = MAP, spawn = 'from_town') => {
  await who.page.evaluate(() => { Farm.ui.closeAll(); if (Farm.session.visit) Farm.session.visit.chase = null; if (Farm.world.mapKey !== 'town') Farm.world.travel('town', 'from_farm'); });
  await who.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy && Farm.world.player.active, null, SLOW);
  await who.page.evaluate(([m, sp]) => { Farm.ui.closeAll(); if (Farm.session.visit) Farm.session.visit.chase = null; Farm.world.travel(m, sp); }, [map, spawn]);
  await who.page.waitForFunction((m) => Farm.world.mapKey === m && !Farm.world.busy && Farm.world.wild && Farm.world.player.active, map, SLOW);
  await who.page.evaluate(() => Farm.ui.closeAll());
};
const list = (page) => page.evaluate(() => Farm.world.wild.animals.filter((a) => !a.gsLocal).map((a) => a.slot + ':' + a.kind + ':' + a.hp + '/' + (a.max || a.def.hp)).sort().join(' '));
const gsState = (page) => page.evaluate(() => Farm.GameServer.state());
const waitMode = (page, m) => page.waitForFunction((m) => (Farm.GameServer.state() || {}).mode === m, m, SLOW);
const until = async (fn, what, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(100); }
  assert.fail('timed out: ' + what);
};
// Walks up to one animal and shoots it until it is down (an arrow every 170 ms, so the server counts each).
const hunt = (page, slot) => page.evaluate(async (n) => {
  const w = Farm.world;
  for (let i = 0; i < 80; i++) {
    const a = w.wild.animals.find((x) => x.slot === n && !x.gsLocal);
    if (!a) return true;
    const f = w.feet();
    if (Math.hypot(f.x - a.x, f.y - a.y) > 4 * 256) w.setFeet(a.x, a.y + 128);
    if (a.hp > 0) w.wildStruck(a);
    await new Promise((r) => setTimeout(r, 170));
  }
  return JSON.stringify(Farm.GameServer.state());
}, slot);
// The place's animals for the fake server: the game's own list for it now (not the tame one, not the Great Mammoth), in
// its hunting zone, every other one walking. extra: more copies of some (slots 100 + slot).
const placeSpec = (page, map = MAP, extra = 0) => page.evaluate(([map, extra]) => {
  const L = Farm.Logic, WI = Farm.Config.WILD, raw = Farm.ASSETS.maps[map];
  let z = null;
  raw.layers.forEach((l) => (l.objects || []).forEach((o) => { if (o.type === 'wild') z = o; }));
  const base = L.wildHere(Farm.session.state, map).filter((e) => !e.tame && !WI.animals[e.kind].great);
  const all = base.concat(base.slice(0, extra).map((e) => ({ slot: 100 + e.slot, kind: e.kind })));
  return all.map((e, i) => {
    const k = L.wildPack({ slot: e.slot % 100, kind: e.kind, x: 0, y: 0, dir: 'side', left: false, mode: 'idle', hp: 1, size: 1, look: false, max: 1 })[1];
    return { slot: e.slot, kind: e.kind, k, hp: WI.animals[e.kind].hp, moves: i % 2 === 0, x: z.x + z.width * (0.25 + 0.5 * ((i * 37) % 10) / 10), y: z.y + z.height * (0.3 + 0.4 * ((i * 53) % 10) / 10) };
  });
}, [map, extra]);
const calm = (page) => page.evaluate(() => Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0, shy: 0 }); }));
// The texts of the panel on top (a dialog's title and lines).
const panelText = (page) => page.evaluate(() => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [];
  const walk = (o) => { if (!o) return; if (o.type === 'Text') out.push(o.text); (o.list || []).forEach(walk); };
  if (m) walk(m.c);
  return out.join(' | ');
});
// Where someone's farmer is on the screen (CSS pixels), to tap it.
const onScreen = (page, id) => page.evaluate((id) => {
  const w = Farm.world, r = w.remotes[id], cam = w.cameras.main, cv = w.sys.game.canvas, box = cv.getBoundingClientRect();
  const k = box.width / w.sys.game.config.width;
  return { x: box.left + ((r.x - cam.worldView.x) * cam.zoom) * k, y: box.top + ((r.y - 0.7 * 256 - cam.worldView.y) * cam.zoom) * k };
}, id);
// What went out on the old relay while on the place: none of the hunt's messages, and the farm room's moves only the first.
const relayOnMap = (who, map = MAP) => who.relay.filter((m) => HUNT[m.ev] || (m.ev === 'mv' && m.map === map));

async function fourOnOnePlace(gsUrl, opts = {}) {
  const server = createServer();
  const host = await open(server, gsUrl, 'Moon Meadow'), guest = await open(server, gsUrl, 'Ana Acres');
  const sun = await open(server, gsUrl, 'Sun Patch'), rain = await open(server, gsUrl, 'Rain Field');
  await visit(host, guest);
  if (opts.ready) await opts.ready(host);
  // the friend first (on a visit: 'with' the owner), then the owner ('with' the friend, who is there now), then two strangers
  await go(guest);
  await waitMode(guest.page, 'live');
  await host.page.waitForFunction((id) => { const p = Farm.Online.others[id]; return p && p.map === 'pulag'; }, guest.uid, SLOW);
  await go(host);
  for (const who of [sun, rain]) await go(who);
  for (const who of [host, guest, sun, rain]) await waitMode(who.page, 'live');
  return { server, host, guest, sun, rain, all: [host, guest, sun, rain] };
}

// ---------- the fake public rooms ----------
test('public room (fake server): four on one place, two friends (with) and two strangers: one room, each drawn once, one list, a kill gone for all, a stranger\'s card, bait and arrows seen by the others, nothing on the old relay', async () => {
  let spec = null;
  const gsrv = await fakePubServer({ animals: (map) => (map === MAP && spec ? spec.map((m) => ({ ...m })) : []) });
  // (the animals come from a page: the room is made when the first phone says hi, after they are known)
  const { host, guest, sun, rain, all } = await fourOnOnePlace(gsrv.url, { ready: async (h) => { spec = await placeSpec(h.page); } });
  // the hi: topic 'pub', floor 0, how each looks; the friend asked to be with the owner, the owner with the friend
  const hiOf = (who) => gsrv.stats.hi.filter((h) => h.id === who.uid).pop();
  assert.deepStrictEqual([hiOf(guest).topic, hiOf(guest).map, hiOf(guest).floor, hiOf(guest).with], ['pub', MAP, 0, host.uid]);
  assert.strictEqual(hiOf(host).with, guest.uid, 'the owner: with the friend from their farm\'s room who is here');
  assert.strictEqual(hiOf(sun).with, undefined, 'a stranger: with nobody');
  for (const who of all) assert.deepStrictEqual(Object.keys(hiOf(who).lk || {}).sort(), ['cs', 'pt', 'rd'], 'lk: how they look');
  assert.strictEqual(hiOf(sun).bk, 0);
  const room = gsrv.roomOf(host.uid);
  for (const who of all) assert.strictEqual(gsrv.roomOf(who.uid), room, 'one room for the four');
  // each sees the other three, once (the owner's friend too: from the server, never also from the farm room)
  await waitRemotes(host.page, ['Ana Acres', 'Sun Patch', 'Rain Field']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)', 'Sun Patch', 'Rain Field']);
  await waitRemotes(sun.page, ['Moon Meadow', 'Ana Acres', 'Rain Field']);
  await waitRemotes(rain.page, ['Moon Meadow', 'Ana Acres', 'Sun Patch']);
  for (const who of all) {
    const st = await gsState(who.page);
    assert.deepStrictEqual([st.mode, st.pub, st.ch, st.cap], ['live', true, room.ch, 30]);
    assert.strictEqual(await who.page.evaluate(() => Farm.world.wildFollowing()), 'gs', 'the server runs the place');
  }
  // the room on screen
  await host.page.waitForFunction(() => Farm.GameServer.state().chip === 'Pulag 1 · 4 here', null, SLOW);
  // one list, the server's
  const want = gsrv.list(room);
  assert.ok(want.length > 0);
  for (const who of all) await until(async () => (await list(who.page)) === want, 'the server\'s list on ' + who.name);
  // a stranger walks: the others see them get there
  await sun.page.evaluate(() => { const w = Farm.world, f = w.feet(); w.setFeet(f.x - 512, f.y); });
  await sleep(400);
  const sf = await sun.page.evaluate(() => Farm.world.feet());
  for (const who of [host, rain]) await who.page.waitForFunction(([id, x, y]) => { const r = Farm.world.remotes[id]; return r && Math.hypot(r.x - x, r.y - y) < 40; }, [sun.uid, sf.x, sf.y], SLOW);
  for (const who of all) await calm(who.page);

  // a kill: the stranger hunts one; gone on all four, the drops on theirs only
  const slot = Number(want.split(' ')[0].split(':')[0]);
  const n0 = await rain.page.evaluate(() => Farm.session.state.wild.n);
  assert.strictEqual(await hunt(rain.page, slot), true);
  for (const who of all) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), slot, SLOW);
  await rain.page.waitForFunction((n) => Farm.session.state.wild.n === n + 1, n0, SLOW);
  assert.ok((await rain.page.evaluate(() => Farm.world.wildDrops.length)) > 0, 'the hunter\'s things on the ground');
  assert.strictEqual(await host.page.evaluate(() => Farm.world.wildDrops.length), 0);
  assert.strictEqual(await rain.page.evaluate(() => Farm.session.state.wild.by[Object.keys(Farm.session.state.wild.by)[0]] > 0), true, 'in the hunter\'s book');
  await sleep(1500);
  for (const who of all) assert.strictEqual(await list(who.page), gsrv.list(room), 'and it stays gone');
  // (the hunt took the stranger across the place, out of the others' view, 18 tiles: back to where the others are)
  await rain.page.evaluate(([x, y]) => Farm.world.setFeet(x + 256, y + 256), [sf.x, sf.y]);
  for (const who of [host, guest, sun]) await who.page.waitForFunction((id) => !!Farm.world.remotes[id], rain.uid, SLOW);

  // a stranger's card: a tap on their farmer, on the owner's phone
  await host.page.evaluate(() => Farm.ui.closeAll());
  await host.page.evaluate((id) => { const w = Farm.world, r = w.remotes[id]; w.setFeet(r.x, r.y + 2.2 * 256); }, sun.uid);
  await sleep(1200); // (the camera catches up)
  const at = await onScreen(host.page, sun.uid);
  await host.page.touchscreen.tap(at.x, at.y);
  await host.page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  const card = await panelText(host.page);
  assert.match(card, /SAY HI/);
  assert.match(card, /Sun Patch is hunting in Pulag with you\./);
  assert.match(card, /Add friend/);
  assert.match(card, /More/);
  await host.page.evaluate(() => Farm.ui.closeAll());
  // facing them, Wave opens it too
  const wave = await host.page.evaluate((id) => {
    const w = Farm.world, r = w.remotes[id], s = Farm.session.state;
    s.sel = s.inv.findIndex((x) => !x); w.setFeet(r.x, r.y + 0.75 * 256); w.dir = 'up';
    const a = w.resolve(); if (a) a.run();
    return a && a.label;
  }, sun.uid);
  assert.strictEqual(wave, 'Wave');
  assert.match(await panelText(host.page), /Sun Patch is hunting in Pulag/);
  // More, Block: they are not drawn on the owner's phone any more (and still on everyone else's)
  await host.page.evaluate(([id, n]) => { Farm.ui.closeAll(); const c = Farm.ui.confirm; Farm.ui.confirm = (t, go) => go(); try { Farm.ui.blockPlayer(id, n, true); } finally { Farm.ui.confirm = c; } }, [sun.uid, 'Sun Patch']);
  await waitRemotes(host.page, ['Ana Acres', 'Rain Field']);
  await sleep(1500);
  assert.deepStrictEqual(await remoteNames(host.page), ['Ana Acres', 'Rain Field'], 'a blocked one stays undrawn');
  assert.deepStrictEqual(await remoteNames(rain.page), ['Ana Acres', 'Moon Meadow', 'Sun Patch']);
  await host.page.evaluate(() => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });

  // bait: a stranger puts some down; the server hears it and the others draw it
  await rain.page.evaluate(() => { Farm.ui.closeAll(); const w = Farm.world, s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'bait'); w.putBait(); });
  await until(() => gsrv.stats.bt.some((b) => b.id === rain.uid), 'the bait reached the server');
  for (const who of [guest, sun]) await who.page.waitForFunction((id) => Farm.GameServer.baits().includes(id), rain.uid, SLOW);
  assert.ok(await rain.page.evaluate(() => !!Farm.world.wildBait), 'their own, drawn on their phone');
  // arrows: the guest shoots; the others see the arrow fly (their farmer lets it go)
  for (const who of [host, sun, rain]) await who.page.evaluate(() => { const w = Farm.world; w.__shots = 0; const rs = w.remoteShot, wa = w.wildArrow; w.remoteShot = function () { const ok = rs.apply(this, arguments); if (ok) w.__shots++; return ok; }; w.wildArrow = function (x, y, a, l, shown) { if (shown) w.__shots++; return wa.apply(this, arguments); }; });
  await guest.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.shoot(); });
  await until(() => gsrv.stats.ar.some((a) => a.id === guest.uid), 'the arrow reached the server');
  for (const who of [host, sun, rain]) await who.page.waitForFunction(() => Farm.world.__shots > 0, null, SLOW);

  // nothing of the hunt on the old relay (Supabase Realtime) from any phone, and of the farm room's moves only the first here
  for (const who of all) {
    const sent = relayOnMap(who);
    assert.deepStrictEqual(sent.filter((m) => HUNT[m.ev]), [], who.name + ': no hunt messages on the old relay');
    assert.ok(sent.filter((m) => m.ev === 'mv').length <= 2, who.name + ': no steps on the old relay (' + sent.length + ')');
  }
  for (const who of all) assert.deepStrictEqual(who.problems, []);
  await Promise.all(all.map((who) => who.context.close()));
  await gsrv.close();
});

test('public room (fake server): your tame animal stays on your phone only; the room\'s more copies of the roster (slot 100 up) are hunted and kept in your book under the place\'s own slot', async () => {
  let spec = null;
  const gsrv = await fakePubServer({ animals: (map) => (map === 'banaue' && spec ? spec.map((m) => ({ ...m })) : []) });
  const server = createServer();
  const me = await open(server, gsrv.url, 'Moon Meadow');
  spec = await placeSpec(me.page, 'banaue', 2);
  assert.ok(spec.some((m) => m.slot >= 100), 'copies in the room');
  const tame = await me.page.evaluate(() => Farm.Logic.wildHere(Farm.session.state, 'banaue').filter((e) => e.tame).map((e) => e.slot + ':' + e.kind)[0]);
  assert.ok(tame, 'Banaue has its tame animal for this player');
  await go(me, 'banaue', 'from_jeep');
  await waitMode(me.page, 'live');
  const room = gsrv.roomOf(me.uid);
  await until(async () => (await list(me.page)) === gsrv.list(room), 'the server\'s list, copies too');
  // the tame one: here, on this phone only, and it walks (this phone runs it)
  const t0 = await me.page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.gsLocal); return a && { slot: a.slot, kind: a.kind, x: a.x, y: a.y }; });
  assert.strictEqual(t0.slot + ':' + t0.kind, tame);
  // an arrow at it: nothing to the server (it wants feeding, not hunting)
  const hits0 = gsrv.stats.hits.length;
  await me.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.gsLocal); w.wildStruck(a); });
  await sleep(800);
  assert.strictEqual(gsrv.stats.hits.length, hits0, 'the tame one is never the server\'s');
  await sleep(3000);
  assert.ok(await me.page.evaluate(() => Farm.world.wild.animals.some((x) => x.gsLocal)), 'still here after the room\'s ticks');
  // a dropped line: the room's whole list again, and the tame one is still yours
  gsrv.rooms.forEach((r) => r.players.forEach((p) => { if (p.sock) p.sock.terminate(); }));
  await me.page.waitForFunction(() => Farm.GameServer.state().mode !== 'live', null, SLOW);
  await waitMode(me.page, 'live');
  await until(async () => (await list(me.page)) === gsrv.list(gsrv.roomOf(me.uid)), 'the whole list again');
  assert.strictEqual(await me.page.evaluate(() => Farm.world.wild.animals.filter((x) => x.gsLocal).length), 1, 'one tame animal, not two');
  // a copy hunted: down, the drops, and the book keeps it under the place's own slot (the save keeps slots 0-99)
  await calm(me.page);
  const copy = spec.find((m) => m.slot >= 100);
  const n0 = await me.page.evaluate(() => Farm.session.state.wild.n);
  assert.strictEqual(await hunt(me.page, copy.slot), true);
  await me.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), copy.slot, SLOW);
  const rec = await me.page.evaluate((slot) => { const s = Farm.session.state; return { n: s.wild.n, base: !!s.wild.gone['banaue:' + (slot % 100)], copy: !!s.wild.gone['banaue:' + slot] }; }, copy.slot);
  assert.deepStrictEqual(rec, { n: n0 + 1, base: true, copy: false });
  assert.ok((await me.page.evaluate(() => Farm.world.wildDrops.length)) > 0);
  assert.deepStrictEqual(relayOnMap(me, 'banaue').filter((m) => HUNT[m.ev]), []);
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
  await gsrv.close();
});

test('public room: no server (a dead address), or the server says no: the place plays the old way, with your farm\'s friends drawn from its room', async () => {
  for (const kind of ['dead', 'no']) {
    const server = createServer();
    let url = 'ws://127.0.0.1:9/', refusing = null;
    if (kind === 'no') { refusing = await fakePubServer({ refuse: 'version' }); url = refusing.url; }
    const host = await open(server, url, 'Moon Meadow'), guest = await open(server, url, 'Ana Acres');
    await visit(host, guest);
    await go(host);
    await waitMode(host.page, 'off');
    await go(guest);
    await waitMode(guest.page, 'off');
    if (kind === 'no') assert.match((await gsState(guest.page)).why, /^(no:version|refused:4011)$/);
    await waitRemotes(host.page, ['Ana Acres']);
    await waitRemotes(guest.page, ['Moon Meadow (owner)']);
    // the owner, there first, runs the animals through the relay as before; the friend follows; one list
    await guest.page.waitForFunction((id) => Farm.world.wildFollowing() === id, host.uid, SLOW);
    await sleep(800);
    const both = await list(host.page);
    assert.ok(both.length > 0);
    await until(async () => (await list(guest.page)) === (await list(host.page)), 'one list (the old relay)');
    assert.ok(host.relay.some((m) => m.ev === 'wa'), 'the owner\'s phone tells the place, as before');
    for (const who of [host, guest]) assert.strictEqual((await gsState(who.page)).chip, '', 'no room chip');
    for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
    await Promise.all([host.context.close(), guest.context.close()]);
    if (refusing) await refusing.close();
  }
});

// The page's frame time over ms, from the browser's own frames (requestAnimationFrame: headless Chrome holds them at
// 60 a second at best), and the world scene's own work in each (its update and its drawing, Phaser's sys.step and
// sys.render): average, 95th, worst.
const frames = (page, ms) => page.evaluate((ms) => new Promise((resolve) => {
  const d = [], work = [], sys = Farm.world.sys, step = sys.step, render = sys.render;
  let w = 0;
  sys.step = function () { const t = performance.now(); try { return step.apply(this, arguments); } finally { w += performance.now() - t; } };
  sys.render = function () { const t = performance.now(); try { return render.apply(this, arguments); } finally { w += performance.now() - t; } };
  let last = performance.now();
  const t0 = last;
  const sum = (a) => { a.sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), worst: +a[a.length - 1].toFixed(1) }; };
  const tick = (now) => {
    d.push(now - last); work.push(w); w = 0; last = now;
    if (now - t0 < ms) return requestAnimationFrame(tick);
    delete sys.step; delete sys.render;
    resolve({ frame: sum(d), world: sum(work), frames: d.length });
  };
  requestAnimationFrame(tick);
}), ms);

test('public room (fake server): a cheap phone with 29 others walking round it draws at most 15 of them; its frame time', async () => {
  let spec = null;
  const gsrv = await fakePubServer({ animals: (map) => (map === MAP && spec ? spec.map((m) => ({ ...m })) : []) });
  const server = createServer();
  const me = await open(server, gsrv.url, 'Moon Meadow');
  spec = await placeSpec(me.page);
  await go(me);
  await waitMode(me.page, 'live');
  // a cheap phone: 4x slower CPU (Chrome's own throttling)
  const cdp = await me.context.newCDPSession(me.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await sleep(1500);
  const alone = await frames(me.page, 6000);
  const f = await me.page.evaluate(() => Farm.world.feet());
  gsrv.bots(MAP, 29, f.x, f.y, me.uid);
  await me.page.waitForFunction(() => Object.keys(Farm.world.remotes).length === 15, null, SLOW);
  await sleep(1500);
  const busy = await frames(me.page, 8000);
  const st = await gsState(me.page);
  const drawn = await me.page.evaluate(() => Object.keys(Farm.world.remotes).length);
  const kb = (gsrv.stats.bytes.get(me.uid) || 0) / 1024;
  console.log('[cheap phone, CPU x4] alone:', JSON.stringify(alone), ' with 29 walking (15 drawn):', JSON.stringify(busy), ' kept:', st.here, ' drawn:', drawn, ' KB down in all:', kb.toFixed(0));
  assert.ok(drawn <= 15, 'never more than 15 drawn');
  assert.ok(st.here <= 15, 'the server sends the 15 nearest');
  assert.ok(busy.frames > 0);
  assert.deepStrictEqual(me.problems, []);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await me.context.close();
  await gsrv.close();
});

// ---------- the REAL server (server/), with a 60-250 ms relay in front of it ----------
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
    const later = (at, fn) => { const t = Math.max(Date.now() + lag(), at.v + 1); at.v = t; setTimeout(fn, t - Date.now()); };
    up.on('open', () => { while (toUp.length) up.send(toUp.shift()); });
    down.on('message', (m) => later(inAt, () => { if (up.readyState === 1) up.send(String(m)); else toUp.push(String(m)); }));
    up.on('message', (m) => later(outAt, () => { if (down.readyState === 1) down.send(String(m)); }));
    up.on('close', (c) => later(outAt, () => { try { down.close(c >= 4000 ? c : 1000); } catch (e) { /* gone */ } }));
    down.on('close', () => { try { up.close(); } catch (e) { /* gone */ } });
  });
  const x = { url: 'ws://127.0.0.1:' + proxy.address().port + '/', direct: 'ws://127.0.0.1:' + addr.port + '/', close: async () => { proxy.clients.forEach((c) => c.terminate()); proxy.close(); await Promise.race([app.stop(), sleep(3000)]); } };
  servers.push(x);
  return x;
}
// Does this server have public rooms yet? A hi for 'pub': a 'wl' (yes) or a 'no' (not yet).
const hasPub = (url) => new Promise((resolve) => {
  const s = new WebSocket(url);
  const done = (v) => { try { s.close(); } catch (e) { /* gone */ } resolve(v); };
  s.on('open', () => s.send(JSON.stringify({ t: 'hi', v: 1, token: 'test-token:probe-' + Date.now(), topic: 'pub', map: MAP, floor: 0, name: 'Probe', look: 'boy', x: 7808, y: 3738, dir: 'down', hg: 0, sk: 0, b: 0, bk: 0, lk: { cs: '', pt: 0, rd: 0 } })));
  s.on('message', (raw) => { let m; try { m = JSON.parse(String(raw)); } catch (e) { return; } if (m.t === 'wl') done(true); else if (m.t === 'no') done(false); });
  s.on('error', () => done(false));
  s.on('close', () => done(false));
  setTimeout(() => done(false), 5000);
});
const NEEDS_PUB = 'needs the REAL server\'s public rooms (server/lib/pub.js): this server has none';

test('REAL pub: four on one place (two friends with, two strangers): one list, a kill gone for all, a stranger\'s card, bait and arrows seen, nothing on the old relay', async (t) => {
  const real = await realServer();
  if (!(await hasPub(real.direct))) return t.skip(NEEDS_PUB);
  const { host, guest, sun, rain, all } = await fourOnOnePlace(real.url);
  const ch = (await gsState(host.page)).ch;
  for (const who of all) assert.strictEqual((await gsState(who.page)).ch, ch, 'one room');
  await waitRemotes(host.page, ['Ana Acres', 'Sun Patch', 'Rain Field']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)', 'Sun Patch', 'Rain Field']);
  await waitRemotes(sun.page, ['Moon Meadow', 'Ana Acres', 'Rain Field']);
  await sleep(1500);
  const a = await list(host.page);
  assert.ok(a.length > 0);
  for (const who of all) await until(async () => (await list(who.page)) === (await list(host.page)), 'one list');
  const slot = Number((await list(host.page)).split(' ')[0].split(':')[0]);
  for (const who of all) await calm(who.page);
  assert.strictEqual(await hunt(sun.page, slot), true);
  for (const who of all) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((x) => x.slot === n), slot, SLOW);
  // the card (the stranger steps away from the others first: at the gate they all stand on one spot)
  await rain.page.evaluate(() => { const w = Farm.world, f = w.feet(); w.setFeet(f.x - 3 * 256, f.y + 256); });
  await sleep(500);
  const rf = await rain.page.evaluate(() => Farm.world.feet());
  await host.page.waitForFunction(([id, x, y]) => { const r = Farm.world.remotes[id]; return r && Math.hypot(r.x - x, r.y - y) < 40; }, [rain.uid, rf.x, rf.y], SLOW);
  await host.page.evaluate((id) => { Farm.ui.closeAll(); const w = Farm.world, r = w.remotes[id], s = Farm.session.state; s.sel = s.inv.findIndex((x) => !x); w.setFeet(r.x, r.y + 0.75 * 256); w.dir = 'up'; const q = w.resolve(); if (q) q.run(); }, rain.uid);
  assert.match(await panelText(host.page), /Rain Field is hunting in Pulag with you/);
  await host.page.evaluate(() => Farm.ui.closeAll());
  // bait
  await rain.page.evaluate(() => { const w = Farm.world, s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'bait'); w.putBait(); });
  for (const who of [guest, sun]) await who.page.waitForFunction((id) => Farm.GameServer.baits().includes(id), rain.uid, SLOW);
  // an arrow: the others see it fly
  for (const who of [host, sun, rain]) await who.page.evaluate(() => { const w = Farm.world; w.__shots = 0; const rs = w.remoteShot, wa = w.wildArrow; w.remoteShot = function () { const ok = rs.apply(this, arguments); if (ok) w.__shots++; return ok; }; w.wildArrow = function (x, y, a, l, shown) { if (shown) w.__shots++; return wa.apply(this, arguments); }; });
  await guest.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.shoot(); });
  for (const who of [host, sun, rain]) await who.page.waitForFunction(() => Farm.world.__shots > 0, null, SLOW);
  // a tap on a stranger's farmer opens the card too
  await host.page.evaluate(() => Farm.ui.closeAll());
  await host.page.evaluate((id) => { const w = Farm.world, r = w.remotes[id]; w.setFeet(r.x, r.y + 2.2 * 256); }, rain.uid);
  await sleep(1200);
  const at = await onScreen(host.page, rain.uid);
  await host.page.touchscreen.tap(at.x, at.y);
  await host.page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  assert.match(await panelText(host.page), /Rain Field is hunting in Pulag with you/);
  await host.page.evaluate(() => Farm.ui.closeAll());
  assert.match((await gsState(host.page)).chip, /^Pulag \d+ · 4 here$/);
  for (const who of all) assert.deepStrictEqual(relayOnMap(who).filter((m) => HUNT[m.ev]), []);
  for (const who of all) assert.ok(relayOnMap(who).filter((m) => m.ev === 'mv').length <= 2, who.name + ': no steps on the old relay');
  for (const who of all) assert.deepStrictEqual(who.problems, []);
  await Promise.all(all.map((who) => who.context.close()));
});

test('REAL pub: a cheap phone with 29 bots (real sockets) walking round it: at most 15 drawn; its frame time', async (t) => {
  const real = await realServer();
  if (!(await hasPub(real.direct))) return t.skip(NEEDS_PUB);
  const server = createServer();
  const me = await open(server, real.url, 'Moon Meadow');
  await go(me);
  await waitMode(me.page, 'live');
  const f = await me.page.evaluate(() => Farm.world.feet());
  const bots = [];
  for (let i = 0; i < 29; i++) {
    const s = new WebSocket(real.url), a = (i / 29) * Math.PI * 2, r = (2 + (i % 5) * 2.5) * T;
    let ang = a;
    s.on('open', () => {
      s.send(JSON.stringify({ t: 'hi', v: 1, token: 'test-token:bot-' + i, topic: 'pub', map: MAP, floor: 0, name: 'Bot ' + i, look: 'boy', x: Math.round(f.x + Math.cos(a) * r), y: Math.round(f.y + Math.sin(a) * r), dir: 'down', hg: 0, sk: 0, b: 0, bk: 0, with: me.uid, lk: { cs: '', pt: 0, rd: 0 } }));
      s.timer = setInterval(() => { ang += 0.05; s.send(JSON.stringify({ t: 'mv', x: Math.round(f.x + Math.cos(ang) * r), y: Math.round(f.y + Math.sin(ang) * r * 0.8), dir: 'left', m: 1, hg: 0, sk: 0, b: 0 })); }, 100);
    });
    s.on('error', () => {});
    bots.push(s);
  }
  await me.page.waitForFunction(() => Object.keys(Farm.world.remotes).length >= 10, null, SLOW);
  const cdp = await me.context.newCDPSession(me.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await sleep(1500);
  const busy = await frames(me.page, 8000);
  const drawn = await me.page.evaluate(() => Object.keys(Farm.world.remotes).length);
  console.log('[REAL, cheap phone, CPU x4] with 29 bots:', JSON.stringify(busy), ' drawn:', drawn);
  assert.ok(drawn <= 15);
  bots.forEach((s) => { clearInterval(s.timer); s.terminate(); });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});

test('the REAL server: two friends on a hunting place are live in one public room (a server without public rooms says no: then the old way)', async () => {
  const real = await realServer(), server = createServer();
  const pub = await hasPub(real.direct);
  const host = await open(server, real.url, 'Moon Meadow'), guest = await open(server, real.url, 'Ana Acres');
  await visit(host, guest);
  await go(host);
  await go(guest);
  if (pub) {
    for (const who of [host, guest]) await waitMode(who.page, 'live');
    await waitRemotes(host.page, ['Ana Acres']);
    await waitRemotes(guest.page, ['Moon Meadow (owner)']);
    assert.strictEqual((await gsState(host.page)).ch, (await gsState(guest.page)).ch, 'one room');
    await sleep(1200);
    await until(async () => (await list(guest.page)) === (await list(host.page)), 'one list (the server\'s)');
  } else {
    for (const who of [host, guest]) await waitMode(who.page, 'off');
    assert.match((await gsState(host.page)).why, /^(no:topic|refused:4011)$/);
    await waitRemotes(host.page, ['Ana Acres']);
    await guest.page.waitForFunction((id) => Farm.world.wildFollowing() === id, host.uid, SLOW);
    await sleep(800);
    await until(async () => (await list(guest.page)) === (await list(host.page)), 'one list (the old relay)');
  }
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

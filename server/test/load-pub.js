// The load test for step 2 (docs/game-server.md "Tests (step 2)"): 30 bot phones on each of 6 hunting places at once
// (180 players, one full public room a place), each with 60-250 ms of random delay each way (in order, as a real
// connection keeps it). Most walk to the nearest animal and shoot it (an `ar` with each arrow, a `hit` when it is near),
// some wander, now and then one puts bait down, as players do.
//   node server/test/load-pub.js         (60 s)      SECS=120 PLACES=6 BOTS=30 node server/test/load-pub.js
// Prints: the slowest tick, p99 and average; KB a second down per phone (target: under 8); how long a kill takes to
// reach every phone in the room (p50 / p95: from the killing arrow leaving the shooter's phone to the last phone hearing
// its `dn`); players each phone hears of; CPU.
'use strict';
const path = require('path');
const { fork } = require('child_process');
const WebSocket = require('ws');
const { rules } = require('../lib/rules');

const SECS = Number(process.env.SECS) || 60, PLACES = Number(process.env.PLACES) || 6, BOTS = Number(process.env.BOTS) || 30;
const DELAY = [60, 250];
const STEP_MS = Number(process.env.STEP_MS) || 100;
const R = rules(), T = R.T, SPEED = R.C.SPEED;
const MAPS = ['pulag', 'makiling', 'magayon', 'banaue', 'bohol', 'taal', 'sierra', 'palawan'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pct = (list, q) => { const s = list.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };

// One way of a connection: each message waits its delay, in order (one timer for the lane, so two never swap)
const lane = () => {
  const q = [];
  let timer = null;
  const pump = () => {
    timer = null;
    while (q.length && q[0].at <= Date.now()) q.shift().fn();
    if (q.length) timer = setTimeout(pump, Math.max(0, q[0].at - Date.now()));
  };
  return (at, fn) => { q.push({ at, fn }); if (!timer) timer = setTimeout(pump, Math.max(0, at - Date.now())); };
};

const sentHits = new Map(); // 'uid|n' -> when the bot let that arrow go
const kills = new Map(); // a kill -> { heard: [ms to each phone] }
const roomSize = new Map(); // map|ch -> phones in it
let measuring = false;

function bot(url, uid, group, i) {
  const map = MAPS[group % MAPS.length];
  const b = { uid, map, mons: new Map(), ppl: new Set(), x: rnd(3, 28) * T, y: rnd(3, 24) * T, n: 0, shotAt: 0, lastHp: {}, inMsgs: 0, inBytes: 0, outMsgs: 0, outBytes: 0,
    perSec: new Map(), bumps: 0, rtt: [], seen: [], wander: i % 4 === 3, goal: null, baitAt: 0, ch: 0 };
  let upAt = 0, downAt = 0;
  const up = lane(), down = lane();
  const ws = b.ws = new WebSocket(url);
  const send = (msg) => {
    const s = JSON.stringify(msg), now = Date.now(), at = upAt = Math.max(upAt, now + rnd(DELAY[0], DELAY[1]));
    if (msg.t === 'hit') sentHits.set(uid + '|' + msg.n, now);
    if (measuring) { b.outMsgs++; b.outBytes += s.length; }
    up(at, () => { if (ws.readyState === 1) ws.send(s); });
  };
  ws.on('open', () => send({ t: 'hi', v: 1, token: 'tok:' + uid, topic: 'pub', map, floor: 0, name: uid, look: Math.random() < 0.5 ? 'boy' : 'girl',
    x: Math.round(b.x), y: Math.round(b.y), dir: 'down', hg: 0, sk: 0, b: 0, bk: 0, lk: { cs: 'outfit-' + (i % 7), pt: i % 9 === 0 ? 1 : 0, rd: i % 5 === 0 ? 1 : 0 },
    with: i > 0 && i % 6 === 0 ? 'pb-' + group + '-0' : undefined }));
  ws.on('message', (d) => {
    const now = Date.now(), at = downAt = Math.max(downAt, now + rnd(DELAY[0], DELAY[1])), s = d.toString();
    down(at, () => hear(JSON.parse(s), s.length));
  });
  const hear = (m, bytes) => {
    const now = Date.now();
    if (measuring) {
      b.inMsgs++;
      b.inBytes += bytes;
      const sec = Math.floor(now / 1000);
      b.perSec.set(sec, (b.perSec.get(sec) || 0) + bytes);
    }
    if (m.t === 'wl') {
      b.mons.clear(); m.mons.forEach((r) => b.mons.set(r[0], r));
      b.ppl = new Set(m.ppl.map((r) => r[0]));
      b.ch = m.ch;
      roomSize.set(map + '|' + m.ch, (roomSize.get(map + '|' + m.ch) || 0) + 1);
      b.joined = true;
    } else if (m.t === 'tk') {
      m.m.forEach((r) => b.mons.set(r[0], r));
      m.gone.forEach((s) => b.mons.delete(s));
      m.come.forEach((r) => b.ppl.add(r[0]));
      m.left.forEach((id) => b.ppl.delete(id));
      if (measuring) b.seen.push(b.ppl.size);
    } else if (m.t === 'hp') b.lastHp[m.s] = m;
    else if (m.t === 'dn') {
      b.mons.delete(m.s);
      const h = b.lastHp[m.s];
      if (h && h.hp <= 0) {
        const sent = sentHits.get(h.by + '|' + h.n), key = map + '|' + b.ch + '|' + m.s + '|' + h.by + '|' + h.n;
        if (sent && measuring) {
          const k = kills.get(key) || { heard: [], room: map + '|' + b.ch };
          k.heard.push(now - sent);
          kills.set(key, k);
        }
      }
    } else if (m.t === 'bp') {
      b.bumps++;
      b.x += rnd(-0.6, 0.6) * T;
      b.y += rnd(-0.6, 0.6) * T;
    } else if (m.t === 'po') b.rtt.push(now - m.c);
    else if (m.t === 'no') console.log('refused', uid, m.why);
  };
  // the phone's own loop: 10 a second (STEP_MS=50: 20 a second, as phones send from 7 Nov 2026)
  let lastPing = 0, still = false;
  b.timer = setInterval(() => {
    if (ws.readyState !== 1 || !b.joined) return;
    const now = Date.now();
    if (now - lastPing > 2000) { lastPing = now; send({ t: 'pi', c: now }); }
    let best = null, bd = Infinity;
    b.mons.forEach((r) => { const d = Math.hypot(r[2] - b.x, r[3] - b.y); if (d < bd) { bd = d; best = r; } });
    let to = null;
    if (b.wander || !best) {
      if (!b.goal || Math.hypot(b.goal.x - b.x, b.goal.y - b.y) < T) b.goal = { x: rnd(3, 28) * T, y: rnd(3, 24) * T };
      to = b.goal;
    } else if (bd > 3 * T) to = { x: best[2], y: best[3] };
    if (to) {
      const d = Math.hypot(to.x - b.x, to.y - b.y), k = Math.min(1, SPEED * STEP_MS / 1000 / Math.max(1, d));
      b.x += (to.x - b.x) * k;
      b.y += (to.y - b.y) * k;
      still = false;
      send({ t: 'mv', x: Math.round(b.x), y: Math.round(b.y), dir: to.x < b.x ? 'left' : 'right', m: 1, hg: 0, sk: 0 });
    } else if (!still) { still = true; send({ t: 'mv', x: Math.round(b.x), y: Math.round(b.y), dir: 'down', m: 0, hg: 0, sk: 0 }); }
    if (best && bd < 5 * T && now - b.shotAt > rnd(500, 900)) {
      b.shotAt = now;
      send({ t: 'ar', x: Math.round(b.x), y: Math.round(b.y), a: Math.atan2(best[3] - b.y, best[2] - b.x), l: 5 * T, b: 1 });
      if (bd < 4.5 * T) send({ t: 'hit', s: best[0], d: 2, n: ++b.n }); // (the bow reaches 3-6 tiles)
    }
    if (now - b.baitAt > 40000 && Math.random() < 0.002) { b.baitAt = now; send({ t: 'bt', x: Math.round(b.x + T), y: Math.round(b.y) }); }
  }, STEP_MS);
  return b;
}

async function main() {
  const child = fork(path.join(__dirname, 'load-server.js'), [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const ask = (msg, reply) => new Promise((resolve) => {
    const on = (m) => { if (m.t === reply) { child.off('message', on); resolve(m); } };
    child.on('message', on);
    if (msg) child.send(msg);
  });
  const { port } = await ask(null, 'port');
  const url = 'ws://127.0.0.1:' + port + '/';
  const bots = [];
  for (let g = 0; g < PLACES; g++) for (let i = 0; i < BOTS; i++) { bots.push(bot(url, 'pb-' + g + '-' + i, g, i)); await new Promise((r) => setTimeout(r, 5)); }
  while (!bots.every((b) => b.joined)) await new Promise((r) => setTimeout(r, 100));
  console.log(bots.length + ' bots on ' + PLACES + ' places (' + Array.from(roomSize.entries()).map(([k, v]) => k + ': ' + v).join(', ') + '); measuring ' + SECS + ' s ...');
  await new Promise((r) => setTimeout(r, 3000)); // (settle)
  measuring = true;
  child.send({ t: 'reset' });
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, SECS * 1000));
  const secs = (Date.now() - t0) / 1000;
  measuring = false;
  const st = await ask({ t: 'stats' }, 'stats');
  bots.forEach((b) => { clearInterval(b.timer); b.ws.close(); });
  child.send({ t: 'stop' });

  const avg = (l) => l.reduce((s, x) => s + x, 0) / Math.max(1, l.length);
  const kbDown = bots.map((b) => b.inBytes / secs / 1024);
  const peakKb = Math.max.apply(null, bots.map((b) => Math.max.apply(null, Array.from(b.perSec.values()).concat([0])))) / 1024;
  const reach = [], heardBy = [];
  kills.forEach((k) => { reach.push(Math.max.apply(null, k.heard)); heardBy.push(k.heard.length / (roomSize.get(k.room) || 1)); });
  const rtt = [].concat(...bots.map((b) => b.rtt));
  const seen = [].concat(...bots.map((b) => b.seen));
  const f = (v, d) => v.toFixed(d == null ? 1 : d);
  console.log('');
  console.log('players ' + st.players + ' in ' + st.rooms + ' rooms, ' + f(secs, 0) + ' s, ' + st.ticks + ' ticks');
  console.log('tick ms: slowest ' + f(st.slowest, 2) + ', p99 ' + f(st.p99, 2) + ', p50 ' + f(st.p50, 3) + ', avg ' + f(st.avg, 3) + '  (target: under 10 ms)');
  console.log('server CPU ' + f(st.cpuPct) + '% of one core, memory ' + f(st.rssMb, 0) + ' MB');
  console.log('KB a second down per phone: avg ' + f(avg(kbDown), 2) + ', p95 ' + f(pct(kbDown, 0.95), 2) + ', most ' + f(Math.max.apply(null, kbDown), 2) + ' (one second at most ' + f(peakKb, 1) + ')  (target: under 8)');
  console.log('messages a second per phone: in ' + f(avg(bots.map((b) => b.inMsgs / secs))) + ', out ' + f(avg(bots.map((b) => b.outMsgs / secs))) + '; up ' + f(avg(bots.map((b) => b.outBytes / secs)), 0) + ' B/s');
  console.log('players a phone hears of: avg ' + f(avg(seen)) + ', most ' + seen.reduce((m, x) => Math.max(m, x), 0) + ' (at most 15)');
  console.log('kills ' + reach.length + ' (heard by ' + f(avg(heardBy) * 100, 0) + '% of the room each): to every phone p50 ' + f(pct(reach, 0.5), 0) + ' ms, p95 ' + f(pct(reach, 0.95), 0) +
    ' ms (with 60-250 ms each way)');
  console.log('ping round trip p50 ' + f(pct(rtt, 0.5), 0) + ' ms, p95 ' + f(pct(rtt, 0.95), 0) + ' ms; charges that reached a bot ' + bots.reduce((s, b) => s + b.bumps, 0));
  setTimeout(() => process.exit(0), 300);
}

main().catch((e) => { console.error(e); process.exit(1); });

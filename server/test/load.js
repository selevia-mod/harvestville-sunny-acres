// The load test (docs/game-server.md "Tests"): 8 bot phones on each of 10 cave floors at once (80 players), each bot
// with 60-250 ms of random delay each way (in order, as a real connection keeps it). They walk to the nearest monster,
// shoot it, get charged, and go down the gate when the floor is clear, as players do.
//   node server/test/load.js            (60 s)      SECS=120 ROOMS=10 BOTS=8 node server/test/load.js
// Prints: the slowest tick and others, messages and bytes a second per phone, how long a kill takes to reach every
// phone on the floor (p50 / p95: from the killing arrow leaving the shooter's phone to the last phone hearing it), CPU.
'use strict';
const path = require('path');
const { fork } = require('child_process');
const WebSocket = require('ws');
const { rules } = require('../lib/rules');

const SECS = Number(process.env.SECS) || 60, ROOMS = Number(process.env.ROOMS) || 10, BOTS = Number(process.env.BOTS) || 8;
const DELAY = [60, 250];
const R = rules(), T = R.T, SPEED = R.C.SPEED;
const MAPS = ['lair', 'banaue_cave', 'bohol_cave', 'taal_crater', 'sierra_cave', 'palawan_cave'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pct = (list, q) => { const s = list.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };

const sentHits = new Map(); // 'uid|n' -> when the bot let that arrow go
const kills = new Map(); // a kill -> { at: its arrow, heard: [ms to each phone] }
let measuring = false;

function bot(url, uid, group) {
  const b = { uid, group, mons: new Map(), x: 1408, y: 1100, n: 0, shotAt: 0, lastHp: {}, inMsgs: 0, inBytes: 0, outMsgs: 0, outBytes: 0, perSec: new Map(), bumps: 0, rtt: [] };
  b.map = MAPS[group % MAPS.length];
  b.cfg = R.dungeonOf(b.map);
  b.floor = 1 + (group * 3) % (b.cfg.floors - 1);
  let upAt = 0, downAt = 0;
  const ws = b.ws = new WebSocket(url);
  // a phone's connection: every message waits 60-250 ms, but never passes the one before it
  const send = (msg) => {
    const s = JSON.stringify(msg), now = Date.now(), at = upAt = Math.max(upAt, now + rnd(DELAY[0], DELAY[1]));
    if (msg.t === 'hit') sentHits.set(uid + '|' + msg.n, now);
    if (measuring) { b.outMsgs++; b.outBytes += s.length; }
    setTimeout(() => { if (ws.readyState === 1) ws.send(s); }, at - now);
  };
  const hello = () => send({ t: 'hi', v: 1, token: 'tok:' + uid, topic: 'farm:' + ('00000000' + group).slice(-8) + '-0000-4000-8000-000000000000', map: b.map, floor: b.floor,
    name: uid, look: Math.random() < 0.5 ? 'boy' : 'girl', x: b.x, y: b.y, dir: 'down', hg: 0, sk: 0, b: 0, bk: 1 });
  ws.on('open', hello);
  ws.on('message', (d) => {
    const now = Date.now(), at = downAt = Math.max(downAt, now + rnd(DELAY[0], DELAY[1])), s = d.toString();
    setTimeout(() => hear(JSON.parse(s), s.length), at - now);
  });
  const hear = (m, bytes) => {
    const now = Date.now();
    if (measuring) {
      b.inMsgs++;
      b.inBytes += bytes;
      const sec = Math.floor(now / 1000);
      b.perSec.set(sec, (b.perSec.get(sec) || 0) + 1);
    }
    if (m.t === 'wl') { b.mons.clear(); m.mons.forEach((r) => b.mons.set(r[0], r)); b.joined = true; }
    else if (m.t === 'tk') { m.m.forEach((r) => b.mons.set(r[0], r)); m.gone.forEach((s) => b.mons.delete(s)); }
    else if (m.t === 'hp') b.lastHp[m.s] = m;
    else if (m.t === 'dn') {
      b.mons.delete(m.s);
      const h = b.lastHp[m.s];
      if (h && h.hp <= 0) {
        const sent = sentHits.get(h.by + '|' + h.n), key = group + '|' + b.floor + '|' + m.s + '|' + h.by + '|' + h.n;
        if (sent && measuring) {
          const k = kills.get(key) || { heard: [] };
          k.heard.push(now - sent);
          kills.set(key, k);
        }
      }
    } else if (m.t === 'bp') {
      b.bumps++;
      b.x += rnd(-0.6, 0.6) * T;
      b.y += rnd(-0.6, 0.6) * T;
    } else if (m.t === 'cl') { // down the gate, after a walk to it
      if (b.leaving) return;
      b.leaving = true;
      setTimeout(() => {
        send({ t: 'bye' });
        b.floor = b.floor >= b.cfg.floors ? 1 : b.floor + 1;
        b.mons.clear();
        b.lastHp = {};
        b.leaving = false;
        b.x = 1408; b.y = 1100;
        hello();
      }, rnd(800, 2500));
    } else if (m.t === 'po') b.rtt.push(now - m.c);
    else if (m.t === 'no') console.log('refused', uid, m.why);
  };
  // the phone's own loop: 10 a second
  let lastPing = 0, still = false;
  b.timer = setInterval(() => {
    if (ws.readyState !== 1 || !b.joined) return;
    const now = Date.now();
    if (now - lastPing > 2000) { lastPing = now; send({ t: 'pi', c: now }); }
    if (b.leaving) return;
    let best = null, bd = Infinity;
    b.mons.forEach((r) => { const d = Math.hypot(r[2] - b.x, r[3] - b.y); if (d < bd) { bd = d; best = r; } });
    if (best && bd > 3 * T) { // walk to it
      const k = Math.min(1, SPEED * 0.1 / bd);
      b.x += (best[2] - b.x) * k;
      b.y += (best[3] - b.y) * k;
      still = false;
      send({ t: 'mv', x: Math.round(b.x), y: Math.round(b.y), dir: best[2] < b.x ? 'left' : 'right', m: 1, hg: 0, sk: 0 });
    } else {
      if (!still) { still = true; send({ t: 'mv', x: Math.round(b.x), y: Math.round(b.y), dir: 'down', m: 0, hg: 0, sk: 0 }); }
      if (best && now - b.shotAt > rnd(500, 900)) { b.shotAt = now; send({ t: 'hit', s: best[0], d: 2, n: ++b.n }); }
    }
  }, 100);
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
  for (let g = 0; g < ROOMS; g++) for (let i = 0; i < BOTS; i++) bots.push(bot(url, 'bot-' + g + '-' + i, g));
  while (!bots.every((b) => b.joined)) await new Promise((r) => setTimeout(r, 100));
  console.log(bots.length + ' bots on ' + ROOMS + ' floors; measuring ' + SECS + ' s ...');
  await new Promise((r) => setTimeout(r, 2000)); // (settle)
  measuring = true;
  child.send({ t: 'reset' });
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, SECS * 1000));
  const secs = (Date.now() - t0) / 1000;
  measuring = false;
  const st = await ask({ t: 'stats' }, 'stats');
  bots.forEach((b) => { clearInterval(b.timer); b.ws.close(); });
  child.send({ t: 'stop' });

  const inPer = bots.map((b) => b.inMsgs / secs), outPer = bots.map((b) => b.outMsgs / secs);
  const peak = Math.max.apply(null, bots.map((b) => Math.max.apply(null, Array.from(b.perSec.values()).concat([0]))));
  const reach = [], heardBy = [];
  kills.forEach((k) => { reach.push(Math.max.apply(null, k.heard)); heardBy.push(k.heard.length); });
  const avg = (l) => l.reduce((s, x) => s + x, 0) / Math.max(1, l.length);
  const rtt = [].concat(...bots.map((b) => b.rtt));
  const f = (v, d) => v.toFixed(d == null ? 1 : d);
  console.log('');
  console.log('players ' + st.players + ' in ' + st.rooms + ' rooms, ' + f(secs, 0) + ' s, ' + st.ticks + ' ticks');
  console.log('tick ms: slowest ' + f(st.slowest, 2) + ', p99 ' + f(st.p99, 2) + ', p50 ' + f(st.p50, 3) + ', avg ' + f(st.avg, 3) + '  (target: under 10 ms)');
  console.log('server CPU ' + f(st.cpuPct) + '% of one core, memory ' + f(st.rssMb, 0) + ' MB');
  console.log('messages a second per phone: in avg ' + f(avg(inPer)) + ' (peak ' + peak + ' in one second), out avg ' + f(avg(outPer)));
  console.log('bytes a second per phone: in ' + f(avg(bots.map((b) => b.inBytes / secs)), 0) + ' B/s, out ' + f(avg(bots.map((b) => b.outBytes / secs)), 0) + ' B/s');
  console.log('kills ' + reach.length + ' (heard by ' + f(avg(heardBy)) + ' phones each): to every phone p50 ' + f(pct(reach, 0.5), 0) + ' ms, p95 ' + f(pct(reach, 0.95), 0) +
    ' ms (with 60-250 ms each way)');
  console.log('ping round trip p50 ' + f(pct(rtt, 0.5), 0) + ' ms, p95 ' + f(pct(rtt, 0.95), 0) + ' ms; charges that reached a bot ' + bots.reduce((s, b) => s + b.bumps, 0));
  setTimeout(() => process.exit(0), 300);
}

main().catch((e) => { console.error(e); process.exit(1); });

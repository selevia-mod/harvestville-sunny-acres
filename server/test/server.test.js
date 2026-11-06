// The real thing on this machine only (127.0.0.1, a free port): /health, two phones on a WebSocket, a hit, the tick
// on its own clock, and a clean stop that tells the phones.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const WebSocket = require('ws');
const { startServer } = require('../lib/server');
const { fakeAuth, TOPIC } = require('./helpers');

const open = (url) => new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.got = [];
  ws.on('message', (d) => ws.got.push(JSON.parse(d.toString())));
  ws.once('open', () => resolve(ws));
  ws.once('error', reject);
});
const until = async (fn, ms) => {
  const end = Date.now() + (ms || 3000);
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error('waited too long');
};
const hi = (uid, extra) => JSON.stringify(Object.assign({ t: 'hi', v: 1, token: 'tok:' + uid, topic: TOPIC, map: 'lair', floor: 7, name: uid, look: 'boy', x: 1408, y: 922, dir: 'down', hg: 0, sk: 0 }, extra || {}));

test('on the network: health, two phones, a hit, the tick, the stop', async () => {
  const lines = [];
  const app = startServer({ auth: fakeAuth, port: 0, log: (l) => lines.push(l), reportEvery: 200 });
  const addr = await app.listening;
  assert.strictEqual(addr.address, '127.0.0.1');
  const health = await new Promise((resolve) => http.get('http://127.0.0.1:' + addr.port + '/health', (res) => {
    let b = '';
    res.on('data', (d) => { b += d; });
    res.on('end', () => resolve([res.statusCode, b]));
  }));
  assert.deepStrictEqual(health, [200, 'ok']);

  const url = 'ws://127.0.0.1:' + addr.port + '/';
  const a = await open(url), b = await open(url);
  a.send(hi('a'));
  const wl = await until(() => a.got.find((m) => m.t === 'wl'));
  assert.strictEqual(wl.you, 'a');
  b.send(hi('b'));
  await until(() => b.got.find((m) => m.t === 'wl'));
  await until(() => a.got.find((m) => m.t === 'tk' && m.come.length));
  // ticks come about every 50 ms while something moves
  b.send(JSON.stringify({ t: 'mv', x: 1500, y: 922, dir: 'right', m: 1 }));
  await until(() => a.got.find((m) => m.t === 'tk' && m.p.length));
  const m = wl.mons[0];
  a.send(JSON.stringify({ t: 'mv', x: m[2] + 100, y: m[3], dir: 'right', m: 0 }));
  a.send(JSON.stringify({ t: 'hit', s: m[0], d: 1, n: 1 }));
  const hp = await until(() => b.got.find((x) => x.t === 'hp'));
  assert.strictEqual(hp.by, 'a');
  // a refused one is told why, then closed
  const c = await open(url);
  const closed = new Promise((r) => c.once('close', (code) => r(code)));
  c.send(hi('c', { token: 'nope' }));
  assert.strictEqual(await closed, 4010);
  assert.deepStrictEqual(c.got, [{ t: 'no', why: 'auth' }]);
  // the minute's line (every 200 ms here)
  await until(() => lines.some((l) => /rooms 1, players 2/.test(l)));
  // stop: every phone hears it
  const gone = new Promise((r) => a.once('close', (code) => r(code)));
  await app.stop();
  assert.strictEqual(await gone, 1001);
});

test('on the network: a hunting place open to everyone (pub): wl with its room number, a stranger seen with their look', async () => {
  const app = startServer({ auth: fakeAuth, port: 0, log: () => {} });
  const addr = await app.listening;
  const url = 'ws://127.0.0.1:' + addr.port + '/';
  const a = await open(url), b = await open(url);
  a.send(hi('outsider', { topic: 'pub', map: 'taal', floor: 0, x: 600, y: 600 }));
  const wl = await until(() => a.got.find((m) => m.t === 'wl'));
  assert.strictEqual(wl.ch, 1);
  assert.strictEqual(wl.cap, 30);
  b.send(hi('b', { topic: 'pub', map: 'taal', floor: 0, x: 900, y: 600, lk: { cs: 'hat', pt: 1, rd: 0 }, with: 'outsider' }));
  assert.strictEqual((await until(() => b.got.find((m) => m.t === 'wl'))).ppl[0][0], 'outsider');
  const tk = await until(() => a.got.find((m) => m.t === 'tk' && m.come.length));
  assert.deepStrictEqual(tk.come[0], ['b', 'b', 'boy', 900, 600, 'down', 0, { cs: 'hat', pt: 1, rd: 0 }]);
  b.send(JSON.stringify({ t: 'ar', x: 900, y: 600, a: 3.1, l: 700, b: 1 }));
  assert.strictEqual((await until(() => a.got.find((m) => m.t === 'ar'))).id, 'b');
  await app.stop();
});

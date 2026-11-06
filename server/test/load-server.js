// The game server for the load test (test/load.js starts it as a process of its own, so the bots do not share its
// CPU): the real server on 127.0.0.1, a free port, the tests' fake Supabase. It says its port, and on asking, how long
// every tick took and how much CPU it used.
'use strict';
const { startServer } = require('../lib/server');
const { fakeAuth } = require('./helpers');

const app = startServer({ auth: fakeAuth, port: 0, log: () => {} });
const game = app.game, tick = game.tick.bind(game);
let ticks = [], cpu = process.cpuUsage(), wall = process.hrtime.bigint();
game.tick = () => { const ms = tick(); ticks.push(ms); if (process.env.LOAD_TRACE && ms > 4) console.error('[slow tick] ' + ms.toFixed(2) + ' ms at ' + Date.now()); return ms; };

app.listening.then((a) => process.send({ t: 'port', port: a.port }));
process.on('message', (m) => {
  if (m.t === 'reset') { ticks = []; cpu = process.cpuUsage(); wall = process.hrtime.bigint(); game.report(); return; }
  if (m.t === 'stats') {
    const used = process.cpuUsage(cpu), secs = Number(process.hrtime.bigint() - wall) / 1e9, r = game.report();
    const sorted = ticks.slice().sort((x, y) => x - y), at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0;
    process.send({ t: 'stats', ticks: sorted.length, slowest: sorted[sorted.length - 1] || 0, p99: at(0.99), p50: at(0.5),
      avg: sorted.reduce((s, x) => s + x, 0) / Math.max(1, sorted.length), cpuPct: (used.user + used.system) / 1e6 / secs * 100,
      secs, rooms: r.rooms, players: r.players, rssMb: process.memoryUsage().rss / 1048576 });
  }
  if (m.t === 'stop') app.stop().then(() => process.exit(0));
});

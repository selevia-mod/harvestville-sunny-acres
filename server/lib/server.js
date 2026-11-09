// The game on the network: one HTTP server on 127.0.0.1 (Caddy in front does TLS), `/health` answers `ok`, and every
// WebSocket on it is a phone (lib/game.js). The tick runs every 50 ms, kept to the clock (a late one does not push the
// rest later); one log line a minute.
'use strict';
const http = require('http');
const { WebSocketServer } = require('ws');
const { Game } = require('./game');

function startServer(opts) {
  const o = opts || {};
  const game = o.game || new Game(o);
  const log = o.log || ((line) => console.log(line));
  const server = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not here');
  });
  const wss = new WebSocketServer({ server, maxPayload: 65536, perMessageDeflate: false }); // (64 KB, 10 Nov 2026: a made-up farm's raid check carries its farm, 12-22 KB)
  wss.on('connection', (ws) => {
    ws.on('error', () => {});
    const c = game.connect({
      send: (s) => ws.send(s),
      close: (code, why) => ws.close(code, why),
      get bufferedAmount() { return ws.bufferedAmount; },
    });
    ws.on('message', (data, isBinary) => { if (!isBinary) game.message(c, data.toString()); });
    ws.on('close', () => game.closed(c));
  });

  // the tick, on the clock
  let stopped = false, timer = null, start = Date.now(), n = 0;
  const loop = () => {
    if (stopped) return;
    try { game.tick(); } catch (e) { log('[game] tick error: ' + (e && e.stack || e)); }
    n++;
    let wait = start + n * game.tickMs - Date.now();
    if (wait < -game.tickMs * 4) { start = Date.now(); n = 0; wait = game.tickMs; } // (far behind, e.g. the machine slept: start again)
    timer = setTimeout(loop, Math.max(0, wait));
  };
  timer = setTimeout(loop, game.tickMs);

  // one line a minute
  const minute = setInterval(() => {
    const r = game.report();
    log('[game] rooms ' + r.rooms + ', players ' + r.players + ', sockets ' + r.conns + ', msgs/s in ' + r.inPerSec.toFixed(1) + ' out ' + r.outPerSec.toFixed(1) +
      ', ' + r.kbOutPerSec.toFixed(1) + ' KB/s out, slowest tick ' + r.slowestMs.toFixed(2) + ' ms' +
      (r.pub ? ', public rooms ' + r.pub + ' (' + r.pubPlayers + ' players)' : '') +
      (r.hitsOk || Object.keys(r.refused).length ? ', hits ' + r.hitsOk + ' counted' + Object.keys(r.refused).map((k) => ', ' + r.refused[k] + ' refused (' + k + ')').join('') : ''));
  }, o.reportEvery || 60000);
  minute.unref();

  const listening = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port == null ? 2567 : o.port, o.host || '127.0.0.1', () => resolve(server.address()));
  });

  // Stop: no new phones, every phone told the server is restarting (they reconnect, or play the old way), then out.
  const stop = () => new Promise((resolve) => {
    if (stopped) return resolve();
    stopped = true;
    clearTimeout(timer);
    clearInterval(minute);
    game.shutdown();
    wss.close();
    const done = setTimeout(() => { wss.clients.forEach((ws) => ws.terminate()); resolve(); }, 2000);
    done.unref();
    server.close(() => { clearTimeout(done); resolve(); });
    wss.clients.forEach((ws) => ws.terminate());
  });

  return { game, server, wss, listening, stop };
}

module.exports = { startServer };

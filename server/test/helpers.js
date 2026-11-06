// Fake phones for the room tests: a game with its own clock and dice, phones that keep every message they are sent.
'use strict';
const { Game } = require('../lib/game');

// the same numbers every run
const dice = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const TOPIC = 'farm:' + '1234abcd-0000-4000-8000-00000000beef';

// A fake Supabase: a token is 'tok:<uid>'; 'tok:outsider' may not be on the farm.
const fakeAuth = { check: async (token, topic) => {
  const m = /^tok:(.+)$/.exec(token);
  if (!m) return { why: 'auth' };
  if (m[1] === 'outsider' && topic !== 'pub') return { why: 'topic' }; // (a hunting place is open to everyone)
  return { uid: m[1] };
} };

function world(opts) {
  const o = opts || {};
  let t = o.t || 1800000000000; // (Fri 15 Jan 2027, 4 PM in the Philippines)
  const game = new Game({ auth: o.auth || fakeAuth, now: () => t, rand: dice(o.seed || 7), pubCap: o.pubCap });
  const flush = () => new Promise((r) => setImmediate(r));
  const w = {
    game,
    now: () => t,
    phones: [],
    // time goes on, one 50 ms tick at a time; every open phone pings every 2 s, as the game does
    run(ms) {
      for (let k = 0; k < ms / 50; k++) {
        t += 50;
        if (t % 2000 === 0) w.phones.forEach((p) => { if (!p.closed && !p.quiet) p.say({ t: 'pi', c: t }); });
        game.tick();
      }
    },
    wait(ms) { t += ms; },
    // a phone: connects and says hi (await it)
    async phone(uid, hi) {
      const p = { uid, got: [], closed: null, bufferedAmount: 0 };
      p.sock = { send: (s) => p.got.push(JSON.parse(s)), close: (code, why) => { p.closed = { code, why }; }, bufferedAmount: 0 };
      p.c = game.connect(p.sock);
      p.say = (msg) => game.message(p.c, JSON.stringify(msg));
      p.all = (type) => p.got.filter((m) => m.t === type);
      p.last = (type) => p.all(type).slice(-1)[0];
      p.drop = () => { p.quiet = true; game.closed(p.c); }; // (the socket closed under it)
      w.phones.push(p);
      p.say(Object.assign({ t: 'hi', v: 1, token: 'tok:' + uid, topic: TOPIC, map: 'lair', floor: 1, name: uid, look: 'boy', x: 1408, y: 922, dir: 'down', hg: 0, sk: 0 }, hi || {}));
      await flush();
      return p;
    },
    room(map, floor, topic) { return game.rooms.get((topic || TOPIC) + '|' + map + '|' + floor); },
    // a phone on a hunting place, open to everyone (topic 'pub', floor 0)
    pub(uid, map, hi) { return w.phone(uid, Object.assign({ topic: 'pub', map: map || 'banaue', floor: 0, bk: 0 }, hi || {})); },
    pubRoom(map, n) { return game.rooms.get('pub|' + map + '|' + n); },
  };
  return w;
}

module.exports = { world, dice, TOPIC, fakeAuth };

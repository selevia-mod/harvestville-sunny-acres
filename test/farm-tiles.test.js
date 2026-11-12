// Unit tests for a farm tile's number between phones while some still run the 64-wide farm (src/01-logicZZZZZZZZZZZZZZZZZZZZ-
// farm-tiles.js): L.tileOut / L.tileIn, and each message that carries one: the owner's live field (19zg-live-farm.js), a
// friend's watering (farm_help_v1 / farm_helps_v1), a friend's picking (farm_pick_v1 / farm_picks_v1), the snapshot a visit
// and a raid's look are built from, and a raid's crops (L.frCropsOf). The old app (live e55, 64 wide) is the same code
// with C.FARM_W 64; what it does with a number is copied below as it is there.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
require('./clock')(ctx);
L.weather = () => 'sunny';
const plain = (x) => JSON.parse(JSON.stringify(x));
const W = C.FARM_W, OLD = 64, H = 38;
const at = (x, y) => y * W + x, at64 = (x, y) => y * OLD + x;

// ---------- the old app (e55), as it reads a number ----------
const int = (v, min, max, fb) => { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(min, Math.min(max, v)) : fb; };
const old = {
  // 19zg-live-farm.js okIdx + tileOf, on its 64 x 38 map (MAX_TILES 64 * 64)
  liveTile: (n) => { const i = Math.floor(Number(n)); return Number.isInteger(i) && i >= 0 && i < Math.min(64 * 64, OLD * H) ? { x: i % OLD, y: Math.floor(i / OLD) } : null; },
  // 01-logicA.js L.applyHelp: the soil at that number, if any
  help: (soil, n) => soil[int(n, -1, 1e5, -1)],
  // 01-logicB.js L.applyPicks: 50000+ a fruit tree, else the soil at that number
  pick: (soil, n) => { const t = int(n, -1, 1e5, -1); return t >= 50000 ? 'tree' : soil[t]; },
};

test('L.tileOut / L.tileIn: every tile of the 75-wide farm and back; x 0-63 as the old app numbers it; x 64+ past it', () => {
  assert.strictEqual(W, 75);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = L.tileOut(at(x, y));
    assert.strictEqual(L.tileIn(n), at(x, y), x + ',' + y);
    if (x < OLD) assert.strictEqual(n, at64(x, y), 'the old app reads it as ' + x + ',' + y);
    else {
      assert.ok(n >= 20000 && n < 50000, 'past any 64-wide tile and below a fruit tree: ' + n);
      assert.strictEqual(old.liveTile(n), null, 'the old app leaves it');
    }
  }
  // the old app's numbers: read as 64 wide
  assert.strictEqual(L.tileIn(at64(63, 37)), at(63, 37));
  assert.strictEqual(L.tileIn(at64(5, 12)), at(5, 12));
  // never a tile: junk, a fruit tree's number, past the server's 100000
  [-1, 1.5, 'x', null, undefined, NaN, 50000, 50123, 100001].forEach((n) => assert.strictEqual(L.tileIn(n), -1, String(n)));
  [-1, 'x', 1.5].forEach((n) => assert.strictEqual(L.tileOut(n), -1, String(n)));
  assert.strictEqual(L.tileIn('970'), at(10, 15), 'a number as text (from the server)');
});

test("a friend's watering: old -> new, new -> old, new -> new, and a tile on lands 7-9 to an old app", () => {
  const now = L.nowMin();
  const grow = () => ({ w: 0, c: 'turnip', p: now, r: 0 });
  const host = L.newState();
  host.soil = {};
  [[10, 15], [63, 37], [66, 26]].forEach(([x, y]) => { host.soil[at(x, y)] = grow(); });
  // an old app's helper sends y * 64 + x
  assert.strictEqual(L.applyHelp(host, [at64(10, 15), at64(63, 37)]), 2);
  assert.ok(host.soil[at(10, 15)].w && host.soil[at(63, 37)].w);
  // a new one's, on lands 7-9 (the server keeps any 0..100000)
  const n = L.tileOut(at(66, 26));
  assert.ok(n >= 0 && n <= 100000);
  assert.strictEqual(L.applyHelp(host, [n]), 1);
  assert.ok(host.soil[at(66, 26)].w);
  // a new helper, an old host: its soil is 64 wide; the tile at x 64+ is not on its farm and finds nothing
  const oldSoil = { [at64(10, 15)]: grow(), [at64(2, 27)]: grow() };
  assert.strictEqual(old.help(oldSoil, L.tileOut(at(10, 15))), oldSoil[at64(10, 15)], 'the right tile');
  assert.strictEqual(old.help(oldSoil, n), undefined, 'lands 7-9: nothing (it does not land a row lower at x 2)');
  // the visitor's side: the tile it shows is the one it sends
  const v = L.newState();
  v.soil = { [at(66, 26)]: grow() };
  assert.ok(L.helpWater(v, at(66, 26)));
});

test("a friend's picking: crops old -> new, new -> old, lands 7-9; fruit trees keep their own numbers", () => {
  const ripe = () => ({ w: 0, c: 'turnip', p: L.nowMin() - C.CROPS.turnip.mins - 1, r: 0 });
  const host = L.newState();
  host.soil = { [at(20, 30)]: ripe(), [at(70, 33)]: ripe() };
  host.basket = {};
  assert.strictEqual(L.applyPicks(host, [[at64(20, 30), 'turnip'], [L.tileOut(at(70, 33)), 'turnip']]), 2);
  assert.ok(!host.soil[at(20, 30)].c && !host.soil[at(70, 33)].c);
  const oldSoil = { [at64(20, 30)]: ripe() };
  assert.strictEqual(old.pick(oldSoil, L.tileOut(at(20, 30))), oldSoil[at64(20, 30)]);
  assert.strictEqual(old.pick(oldSoil, L.tileOut(at(70, 33))), undefined, 'not a fruit tree, not a tile: nothing');
  assert.ok(L.treeTile({ x: 66, y: 20 }) >= 50000, 'a tree is still sent as one');
});

test("the owner's live field: each row's tile as the old app reads it; lands 7-9 rows only for a new app", () => {
  // 19zg-live-farm.js sends [L.tileOut(k), ...] and reads L.tileIn(row[0])
  const tiles = [at(0, 0), at(10, 15), at(63, 37), at(64, 2), at(74, 37)];
  const rows = tiles.map((k) => [L.tileOut(k), 1, 'turnip', 0, 0, 0, 0]);
  rows.forEach((r, i) => {
    const x = tiles[i] % W, y = Math.floor(tiles[i] / W), o = old.liveTile(r[0]);
    assert.deepStrictEqual(o && plain(o), x < OLD ? { x, y } : null, 'old app: ' + x + ',' + y);
    assert.strictEqual(L.tileIn(r[0]), tiles[i], 'new app');
  });
  // an old owner's rows: y * 64 + x
  assert.strictEqual(L.tileIn(at64(40, 20)), at(40, 20));
});

test("a snapshot: new -> new with lands 7-9; new -> old reads every tile right; old -> new, sprinklers too", () => {
  const now = L.nowMin();
  const s = L.newState();
  s.soil = {}; s.debris = {};
  s.soil[at(45, 29)] = { w: 1, c: 'turnip', p: now, r: 0 };
  s.soil[at(66, 26)] = { w: 1, c: 'corn', p: now, r: 0 }; // land 7
  s.soil[at(30, 20)] = { w: 0, c: null, p: 0, r: 0, sp: 1 }; // a sprinkler
  s.soil[at(70, 27)] = { w: 0, c: null, p: 0, r: 0, sp: 2 };
  s.debris[at(12, 6)] = 'weed';
  s.debris[at(68, 30)] = 'stone';
  s.decoGone = [at(5, 3), at(73, 10)];
  const snap = plain(L.snapshot(s));
  // as the old app reads it: 64 wide, nothing to move; every number y * 64 + x of its own tile
  assert.strictEqual(snap.fw, OLD);
  assert.deepStrictEqual(snap.soil.map((e) => e[0]).sort((a, b) => a - b), [at64(30, 20), at64(45, 29)]);
  assert.deepStrictEqual(snap.debris.map((e) => e[0]), [at64(12, 6)]);
  assert.deepStrictEqual(snap.sp, [at64(30, 20), 1]);
  assert.deepStrictEqual(snap.dco, [at64(5, 3)]);
  // lands 7-9, beside it
  assert.deepStrictEqual(Object.keys(snap.fx).sort(), ['d', 'dco', 's', 'sp']);
  // a new app: all of it, each on its tile
  const v = L.visitState(snap, L.newState());
  assert.strictEqual(v.soil[at(45, 29)].c, 'turnip');
  assert.strictEqual(v.soil[at(66, 26)].c, 'corn');
  assert.strictEqual(v.soil[at(30, 20)].sp, 1);
  assert.strictEqual(v.soil[at(70, 27)].sp, 2);
  assert.strictEqual(v.debris[at(12, 6)], 'weed');
  assert.strictEqual(v.debris[at(68, 30)], 'stone');
  assert.deepStrictEqual(plain(v.decoGone).sort((a, b) => a - b), [at(5, 3), at(73, 10)]);
  assert.strictEqual(Object.keys(v.soil).length, 4);
  // an old app's snapshot (64 wide, no fx): moved, the sprinkler with its soil (it stayed put before)
  const o = plain(snap);
  delete o.fx;
  const v2 = L.visitState(o, L.newState());
  assert.strictEqual(v2.soil[at(45, 29)].c, 'turnip');
  assert.strictEqual(v2.soil[at(30, 20)].sp, 1, 'the sprinkler on its own tile');
  assert.strictEqual(Object.keys(v2.soil).length, 2);
  assert.deepStrictEqual(plain(v2.decoGone), [at(5, 3)]);
  // and a snapshot read twice is the same (the visit and the raid's look)
  assert.deepStrictEqual(plain(L.visitState(snap, L.newState()).soil), plain(v.soil));
});

test("a raid's crops from an older app's copy (64 wide), counted on the look this app moved to 75", () => {
  // the copy and what was taken are in x and y; the copy's w (taken.w) is 64; its look (st) is this app's width
  const st = L.newState();
  st.soil = {};
  st.soil[at(40, 12)] = { w: 1, c: 'corn', p: 0, r: 0 };
  st.soil[at(41, 12)] = { w: 1, c: 'cabbage', p: 0, r: 0 };
  const taken = { w: OLD, items: [['crops', 40, 12, 1], ['crops', 41, 12, 1]], crops: 2 };
  assert.deepStrictEqual(plain(L.frCropsOf(st, taken)), { corn: 1, cabbage: 1 });
});

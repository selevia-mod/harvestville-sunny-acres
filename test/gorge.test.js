// The Rocky Gorge (owner, 18 Nov 2026; src/00-zzz...z-gorge.js, src/01-logicZ...Z-gorge.js): Manila's third hunting ground,
// the Boomerang's, and its 50-floor cave, the Echo Caves. The unlock at 110 hunts, its animals and their stats, flocks of 3
// to 5 in a row, the Ibong Adarna's song, the Little Kalapati and its spot skill, the cave, drops, prices, the dish and the
// Climber set, every Boomerang level built from what the game drops (and the Moon Rifle and Javelin now), the Boomerang
// hitting out and back, a shot's energy, the horse, the map and Manila's Gorge Gate, and the saves.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const WI = C.WILD;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const plain = (x) => JSON.parse(JSON.stringify(x));
const fresh = () => { clock.set(2026, 11, 18, 10, 0); const s = L.newState(); s.seed = 22; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const P = C.PLACES.gorge;
const D = P.dungeon;
const A = WI.animals;
const G = C.GORGE;
const map = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', name + '.json'), 'utf8'));
const tame = (s) => { L.addItem(s, 'mung_bean', 20); for (let i = 0; i < 30 && !L.tamed(s, 'gorge'); i++) { const r = L.feedTame(s, 'gorge', () => 0.99); if (r === 'ran') L.placeRec(s, 'gorge').ta = 0; } };
// the notes' (docs/manila-proposals.md 3c) hits to bring one down and a charge's energy
const NOTES = { kalapati: 3, gr_langay: 2, ibid: 4, banog: 6, batobato: 7, adarna: 8, gr_alitaptap: 4, kabog: 7, batoking: 30, gr_galura: 44 };
const NOTE_HIT = { banog: 14, batobato: 13, kabog: 15, batoking: 17, gr_galura: 20 };

// A built map's walkable tiles, as the world reads them (11-world.js: any colliding tile; a prop's foot rows above its
// object's y, Tiled's bottom), and a flood fill from a tile.
const walker = (m) => {
  const W = m.width, H = m.height, solid = {}, block = new Uint8Array(W * H);
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => (t.properties || []).forEach((p) => { if (p.name === 'collides' && p.value) solid[ts.firstgid + t.id] = 1; })));
  m.layers.filter((l) => l.type === 'tilelayer').forEach((l) => l.data.forEach((g, i) => { if (solid[g]) block[i] = 1; }));
  const ps = m.tilesets.find((t) => t.name === 'props');
  m.layers[3].objects.filter((o) => o.gid).forEach((o) => {
    const t = ps.tiles.find((x) => x.id === o.gid - ps.firstgid), pr = {};
    (t.properties || []).forEach((p) => { pr[p.name] = p.value; });
    if (!pr.foot || pr.flat) return;
    const x0 = Math.round(o.x / 256), w = Math.round(o.width / 256), y1 = Math.round(o.y / 256) - 1;
    for (let y = y1 - pr.foot + 1; y <= y1; y++) for (let x = x0; x < x0 + w; x++) block[y * W + x] = 1;
  });
  const from = (x0, y0) => {
    const seen = new Uint8Array(W * H), q = [y0 * W + x0];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = Math.floor(c / W);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => { const nx = x + d[0], ny = y + d[1], n = ny * W + nx; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[n] && !block[n]) { seen[n] = 1; q.push(n); } });
    }
    return (x, y) => seen[y * W + x] === 1;
  };
  return { W, H, block, ok: (x, y) => !block[y * W + x], from };
};

test('the Rocky Gorge: place 23, opens at 110 hunts, reached by Manila\'s Gorge Gate (not the Jeep), its cave the Echo Caves; Tata Ambo', () => {
  assert.deepStrictEqual([P.n, P.unlock, P.map, D.key, D.name, D.floors, P.pack], [23, 110, 'gorge', 'gorge_cave', 'The Echo Caves', 50, 'gorge']);
  const s = fresh();
  s.wild.n = 109;
  assert.strictEqual(L.wildOpen(s, 'gorge'), false, '109 hunts: shut');
  assert.strictEqual(L.wildOpen(s, 'gorge_cave'), false);
  s.wild.n = 110;
  assert.strictEqual(L.wildOpen(s, 'gorge'), true, '110 hunts: open');
  assert.strictEqual(L.wildOpen(s, 'gorge_cave'), true);
  assert.ok(L.isWildMap('gorge') && L.isWildMap('gorge_cave'), 'a hunting place: the Bow, the dog, friends');
  assert.ok(!L.jeepPlaces(s).some((e) => ['gorge', 'jungle', 'plains'].includes(e.id)), 'not in Kanor\'s Jeep');
  assert.deepStrictEqual([P.npc.name, P.npc.sheet], ['Tata Ambo', 'npc_tata_ambo']);
  assert.ok(fs.existsSync(path.join(ROOT, 'art-src', 'manila', 'npc_tata_ambo.png')));
  assert.ok(require('../tools/manila/manila-art').all().includes('npc_tata_ambo'), 'in the manila pack');
  assert.deepStrictEqual(plain(P.npc.lines.map((l) => (l.need ? Object.keys(l.need)[0] : 'first'))), ['first', 'hunts', 'guard', 'boss']);
  P.npc.lines.forEach((l, i) => { assert.ok(l.gift && l.gift.length, 'line ' + i); l.gift.forEach((g) => assert.ok(C.ITEMS[g[0]] && g[1] > 0, g[0])); });
  assert.ok(P.npc.lines.some((l) => /mung beans/i.test(l.text)), 'he tells you what the Little Kalapati eats');
  const codes = C.MEDALS.filter((m) => m.place === 'gorge').map((m) => m.code);
  assert.ok(codes.length >= 10 && codes.every((c) => c >= 2300 && c < 2400), 'medals from 2300');
  assert.match(WI.areas.gorge.opened, /110 hunts/);
  assert.deepStrictEqual([C.PLACES.plains.unlock, C.PLACES.jungle.unlock, C.PLACES.jungle.n], [30, 70, 22], 'the Plains and the Jungle as before');
});

test('its animals: the notes\' animals about 1.5 times harder (hits), a charge a little dearer; cute, the bosses grumpy; their own ids beside the Lost Tower\'s', () => {
  assert.deepStrictEqual(plain(P.kinds), ['kalapati', 'gr_langay', 'ibid', 'batobato', 'banog', 'adarna']);
  assert.deepStrictEqual(plain(P.animals), { kalapati: 8, gr_langay: 5, ibid: 3, batobato: 3 });
  const HP = { kalapati: 5, gr_langay: 3, ibid: 6, banog: 9, batobato: 11, adarna: 12, gr_alitaptap: 6, kabog: 11, batoking: 45, gr_galura: 66 };
  Object.keys(NOTES).forEach((k) => {
    assert.strictEqual(A[k].hp, HP[k], k);
    assert.ok(A[k].hp >= NOTES[k] * 1.4 && A[k].hp <= NOTES[k] * 1.7, k + ': about 1.5 times the notes, ' + A[k].hp + ' for ' + NOTES[k]);
  });
  Object.keys(NOTE_HIT).forEach((k) => assert.ok(A[k].hit > NOTE_HIT[k] && A[k].hit <= NOTE_HIT[k] + 2, k + ' hits ' + A[k].hit));
  assert.strictEqual(A.gr_galura.hpEach, 25);
  assert.ok(A.adarna.rare && A.adarna.respawn === 120 && A.adarna.shy === 7 && A.adarna.sings);
  assert.ok(P.extra.some((x) => x.kind === 'banog' && x.when === 'dawn') && P.extra.some((x) => x.kind === 'adarna' && x.when === 'rare'));
  // every creature has the owner's picture (art-src/manila/gorge) and a stand-in row until it is in
  Object.keys(P.creatures).concat(Object.keys(D.creatures)).forEach((k) => {
    assert.ok(fs.existsSync(path.join(ROOT, 'art-src', 'manila', 'gorge', (A[k].src || A[k].sheet) + '.png')), k + ': ' + A[k].sheet);
    assert.ok(WI.order.includes(A[k].sheetRow), k + ': a stand-in row');
    assert.ok(A[k].px > 0 && A[k].place === 'gorge', k);
    (A[k].drops || []).forEach((d) => assert.ok(C.ITEMS[d[0]], k + ' drops ' + d[0]));
  });
  // the Lost Tower keeps its Langay-langayan, Alitaptap and Galura (their ids and pictures); the Gorge's are its own
  ['langay', 'alitaptap', 'galura'].forEach((k) => {
    assert.ok(A[k] && A[k].tower && A[k].sheet === 'wild_' + k, 'the Tower\'s ' + k);
    assert.ok(A['gr_' + k].place === 'gorge' && A['gr_' + k].sheet === 'wild_gorge_' + k && A['gr_' + k].src === 'wild_' + k, 'the Gorge\'s gr_' + k);
  });
  assert.ok(!A.bato && !A.sarimanok, 'no Bato clash; the Sarimanok left out on purpose');
  assert.ok(A.batoking.boss && A.gr_galura.boss && A.gr_galura.minHits === 3);
  assert.ok(A.squab.tameOnly && !A.squab.drops.length && A.squab.sheet === 'wild_kalapati' && A.squab.w < A.kalapati.w, 'the Little Kalapati: the Kalapati\'s picture, smaller');
});

test('flocks of 3 to 5 stand in a row on the ledges, each beside the next (inside the Moon pair reach); the cave\'s come three together', () => {
  assert.deepStrictEqual([A.kalapati.flock, A.gr_langay.flock, A.batobato.flock, A.gr_alitaptap.flock, A.kabog.flock], [4, 5, 3, 3, 3]);
  ['kalapati', 'gr_langay', 'batobato', 'gr_alitaptap', 'kabog'].forEach((k) => assert.ok(A[k].abreast, k));
  ['ibid', 'banog', 'adarna', 'batoking', 'gr_galura'].forEach((k) => assert.ok(!A[k].flock, k));
  const slots = L.wildSlots('gorge'), birds = slots.filter((e) => e.kind === 'kalapati').map((e) => e.slot);
  assert.strictEqual(birds.length, 8);
  assert.deepStrictEqual(plain(L.flockOf('gorge', birds[5])), plain({ lead: birds[4], slots: birds.slice(4, 8), i: 1 }), 'two flocks of 4');
  const langay = slots.filter((e) => e.kind === 'gr_langay' && !e.when).map((e) => e.slot);
  assert.strictEqual(L.flockOf('gorge', langay[4]).slots.length, 5, 'a flock of 5');
  // the row: the leader in the middle, the others a tile to each side in turn, whichever way it faces
  const T = C.TILE, x = 9 * T, y = 11 * T;
  [0, Math.PI / 2, Math.PI].forEach((ang) => {
    const row = [0, 1, 2, 3, 4].map((i) => L.flockSpot(x, y, ang, i, T, A.gr_langay.w, 5, A.gr_langay));
    const xs = row.map((p) => p.x / T).sort((a, b) => a - b);
    assert.deepStrictEqual(xs.map((v) => +(v - 9).toFixed(2)), [-2, -1, 0, 1, 2], 'a row along the ledge');
    row.forEach((p) => assert.ok(Math.abs(p.y - y) < 0.2 * T, 'side by side, not behind'));
    for (let i = 1; i < 5; i++) {
      const a = row.find((p) => Math.abs(p.x / T - xs[i]) < 1e-6), b = row.find((p) => Math.abs(p.x / T - xs[i - 1]) < 1e-6);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) / T < C.WEAPON_PAIR, 'each next to the next');
    }
  });
  assert.deepStrictEqual(plain(L.flockSpot(x, y, 0, 1, T, 1.3, 3)), plain(L.flockSpot(x, y, 0, 1, T, 1.3)), 'the Plains\' threes: a line, as before');
  assert.deepStrictEqual(plain(L.flockSpot(x, y, 0, 1, T, 1.4, 2)), plain(L.flockSpot(x, y, 0, 1, T, 1.4, 2, A.baboydamo)), 'the Jungle\'s pairs as before');
  // a ledge has room for the row; every shelf tile of a ledge is on it
  for (let k = 0; k < 40; k++) {
    const r = ((k * 0.618) % 1), at = L.gorgeLedgeSpot(5, () => r);
    assert.ok(at && L.gorgeOnLedge(at[0] - 2, at[1]) && L.gorgeOnLedge(at[0] + 2, at[1]), 'a row of 5 fits: ' + at);
  }
  // the Echo Caves: three of a kind together, one flock
  for (let f = 1; f <= 49; f++) {
    const list = L.dunRoster('gorge_cave', f), from = L.dunWho(D, f) ? 1 : 0;
    for (let i = from; i < list.length; i++) {
      const fl = L.caveFlockOf('gorge_cave', f, i);
      assert.ok(fl && fl.slots.includes(i) && fl.slots.length <= 3 && fl.slots.every((sl) => list[sl].kind === list[i].kind), 'floor ' + f + ' slot ' + i);
    }
  }
  assert.deepStrictEqual(plain(L.caveFlockOf('gorge_cave', 1, 2)), { lead: 0, slots: [0, 1, 2], i: 2 });
  assert.strictEqual(L.caveFlockOf('gorge_cave', 10, 0), null, 'the Bato King leads no flock');
  assert.deepStrictEqual(plain(L.dunRoster('jungle_cave', 30)), plain(L.dunRoster('jungle_cave', 30)), 'other caves as before');
});

test('the Ibong Adarna sings: every animal near it, itself too, stands still 3 s; one further off does not', () => {
  assert.deepStrictEqual([WI.song.still, WI.song.reach], [3000, 6]);
  assert.ok(WI.song.every[0] >= 6000 && WI.song.every[1] > WI.song.every[0], 'now and then, not all the time');
  const T = C.TILE, ad = { k: 'adarna', x: 20 * T, y: 20 * T, hp: 12 };
  const list = [ad, { k: 'near', x: 24 * T, y: 22 * T, hp: 5 }, { k: 'edge', x: 26 * T, y: 20 * T, hp: 3 }, { k: 'far', x: 27 * T, y: 21 * T, hp: 5 }, { k: 'gone', x: 21 * T, y: 20 * T, hp: 0 }];
  assert.deepStrictEqual(L.adarnaSong(list, ad.x, ad.y, T).map((b) => b.k), ['adarna', 'near', 'edge']);
  assert.ok(C.ITEMS.adarna_feather.sell === 2600 && /seven colours/.test(C.ITEMS.adarna_feather.desc));
});

test('the Little Kalapati: planted mung beans, 9 feedings; tamed, it walks with you and spots the Ibong Adarna (spot)', () => {
  assert.deepStrictEqual([P.tame.kind, P.tame.food, P.tame.feedings, P.tame.skill], ['squab', 'mung_bean', 9, 'spot']);
  assert.ok(C.ITEMS.mung_bean && C.CROPS.mung_bean, 'mung beans are planted');
  assert.match(C.COMPANION_SKILLS.spot.text, /rare animal/);
  const s = fresh(), bag = s.inv.length;
  let feeds = 0;
  L.addItem(s, 'mung_bean', 20);
  for (let i = 0; i < 30 && !L.tamed(s, 'gorge'); i++) { const r = L.feedTame(s, 'gorge', () => 0.99); feeds++; if (r === 'ran') L.placeRec(s, 'gorge').ta = 0; }
  assert.ok(L.tamed(s, 'gorge'));
  assert.strictEqual(feeds, 9, 'nine feedings');
  assert.strictEqual(L.companion(s), 'gorge');
  assert.strictEqual(L.companionSkill(s), 'spot');
  assert.strictEqual(s.inv.length, bag, 'no carrying');
  const back = roundTrip(s);
  assert.ok(L.tamed(back, 'gorge') && back.comp === 'gorge');
  // the one it spots is the rare one: the Ibong Adarna (and it is about now and then, the same for everyone)
  assert.deepStrictEqual(Object.keys(P.creatures).filter((k) => A[k].rare), ['adarna']);
  assert.ok(L.wildSlots('gorge').some((e) => e.kind === 'squab' && e.tame), 'it roams the Gorge until it is tamed');
});

test('the Echo Caves: 50 floors, a lift every 10, a Bato King on every 10th (tougher each time), the Galura on 50; the built cave', () => {
  assert.deepStrictEqual([D.floors, D.liftEvery, D.guardFloor, D.guardEvery, D.bossFloor], [50, 10, 10, 10, 50]);
  assert.deepStrictEqual([D.guard, D.boss], ['batoking', 'gr_galura']);
  const guards = [];
  for (let f = 1; f <= 50; f++) { const w = L.dunWho(D, f); if (w) guards.push(f + ':' + w); }
  assert.deepStrictEqual(guards, ['10:batoking', '20:batoking', '30:batoking', '40:batoking', '50:gr_galura']);
  assert.ok(L.dunHp('batoking', 1, 40) > L.dunHp('batoking', 1, 10), 'deeper guards are tougher');
  assert.strictEqual(L.dunHp('gr_galura', 1, 50), 66, 'soloable');
  assert.strictEqual(L.dunHp('gr_galura', 3, 50), 66 + 2 * 25, 'more health for each friend');
  assert.ok(L.dunRoster('gorge_cave', 1).every((e) => e.kind === 'gr_alitaptap'));
  assert.ok(L.dunRoster('gorge_cave', 35).some((e) => e.kind === 'kabog'));
  const s = fresh();
  s.wild.n = 110;
  L.dunReach(s, 'gorge_cave', 34);
  assert.deepStrictEqual(plain(L.dunStops(s, 'gorge_cave')), [1, 11, 21, 31]);
  L.hunted(s, 'gorge_cave', 0, 'batoking', 1);
  assert.strictEqual(L.placeRec(s, 'gorge').g, 1);
  L.hunted(s, 'gorge_cave', 0, 'gr_galura', 1);
  assert.strictEqual(L.bossChests(s, 'gorge'), 1);
  assert.ok(L.openBossChests(s, 'gorge', () => 0).some((x) => x[0] === 'galura_feather'));
  assert.strictEqual(L.horseZone('gorge_cave'), 'cave');
  const cave = L.gorgeCaveMap(map('palawan_cave')), obj = cave.layers[3].objects;
  ['entrance', 'exit', 'dungeon_gate', 'wild'].forEach((n) => assert.ok(obj.some((o) => o.name === n), n));
  assert.strictEqual(obj.filter((o) => o.name === 'exit')[0].properties[0].value, 'gorge');
  const w = walker(cave), reach = w.from(5, 3), g = obj.find((o) => o.name === 'dungeon_gate');
  assert.ok(reach(g.x / 256 - 1, g.y / 256), 'the ladder to the gate down');
  [[2, 3], [22, 4], [2, 15], [28, 12]].forEach((p) => assert.ok(reach(p[0], p[1]), 'both halls ' + p));
  assert.ok(!w.ok(12, 9) && !w.ok(12, 10) && w.ok(8, 10), 'a wall between the halls, wide ways through');
});

test('drops and prices: the Gorge\'s 100 to 480, the Adarna feather 2,600, the Bato Crown 2,200, the Galura Feather 3,400; the dish', () => {
  ['kalapati_feather', 'kalapati_meat', 'langay_feather', 'mud_nest', 'ibid_sail', 'banog_feather', 'banog_talon', 'bato_pebble', 'gorge_crystal', 'glow_jar', 'kabog_wing']
    .forEach((id) => assert.ok(C.ITEMS[id].sell >= 100 && C.ITEMS[id].sell <= 480, id + ' ' + C.ITEMS[id].sell));
  assert.strictEqual(C.ITEMS.adarna_feather.sell, 2600);
  assert.ok(C.ITEMS.bato_crown.sell >= 900 && C.ITEMS.bato_crown.sell <= 2200);
  assert.ok(C.ITEMS.galura_feather.sell >= 1400 && C.ITEMS.galura_feather.sell <= 3400);
  Object.keys(P.items).forEach((id) => {
    const it = C.ITEMS[id];
    assert.ok(it.sell > 0 && it.name && it.desc && it.place === 'gorge', id);
    assert.strictEqual(it.icon, C.gorgeIcon(id), id + ': its painted icon');
    assert.ok(/^[a-z][a-z_]{0,23}$/.test(id), id);
  });
  assert.strictEqual(C.GORGE_ICONS.length, 20);
  assert.ok(!C.GORGE_ICONS.some((id) => C.ICON_ORDER.includes(id)), 'not in the page\'s items sheet');
  assert.ok(C.GORGE_ICON_BASE >= C.JUNGLE_ICON_BASE + C.JUNGLE_ICONS.length, 'past the Jungle\'s frames');
  C.GORGE_ICONS.forEach((id) => assert.ok(C.ICON[C.GORGE_STAND[id]] != null, id + ': a stand-in until the pack is in'));
  // Ginisang Monggo: mung beans, pigeon meat, garlic; 120 energy; you walk faster
  assert.ok(C.RECIPES.some((r) => r.dish === 'ginisang_monggo' && r.needs.join() === 'mung_bean,kalapati_meat,garlic'));
  assert.strictEqual(C.ITEMS.ginisang_monggo.energy, 120);
  assert.strictEqual(C.DISH_POWERS.ginisang_monggo.key, 'walk');
  assert.ok(C.CROPS.garlic && C.CROPS.mung_bean);
  P.chestLoot.concat(D.chest).forEach((x) => assert.ok(C.ITEMS[x[0]], x[0]));
  assert.strictEqual(P.chests.length, 5);
});

test('the Climber set: four pieces at 30,000 to 60,000 Gold each plus the Gorge\'s drops', () => {
  const pieces = C.GEAR_SLOTS.map((k) => C.PLACE_GEAR['gorge_' + k]);
  assert.deepStrictEqual(plain(pieces.map((g) => g.name)), ['Knitted Climber\'s Cap', 'Banog Cape', 'Climbing Boots', 'Adarna Charm']);
  assert.deepStrictEqual(plain(pieces.map((g) => g.gold)), [30000, 50000, 35000, 60000]);
  pieces.forEach((g) => {
    g.needs.forEach((n) => assert.strictEqual(C.ITEMS[n[0]].place, 'gorge', g.name + ' needs ' + n[0]));
    assert.strictEqual(g.icon, C.gorgeIcon(g.art), g.name + ': the owner\'s icon');
  });
  const s = fresh();
  s.gold = 200000;
  pieces.forEach((g) => { g.needs.forEach((n) => L.addItem(s, n[0], n[1])); assert.strictEqual(L.makeGear(s, g.id), 'ok', g.name); });
  assert.strictEqual(L.wornSet(s), 'gorge');
  assert.strictEqual(s.gold, 200000 - 175000);
  assert.strictEqual(L.gearLess(s, 'banog'), 1 + 2 + 1 + 2 + C.GEAR_SET_BONUS);
  assert.strictEqual(L.gearLess(s, 'gr_galura'), 1 + 2 + 1 + 2 + C.GEAR_SET_BONUS, 'and in its cave');
  assert.strictEqual(L.gearLess(s, 'baboydamo'), 0, 'only against the Gorge\'s own creatures');
});

const sources = () => {
  const got = new Set(['lumber']);
  Object.keys(A).forEach((k) => (A[k].drops || []).forEach((d) => got.add(d[0])));
  C.PLACE_ORDER.forEach((id) => { const p = C.PLACES[id]; (p.chestLoot || []).forEach((x) => got.add(x[0])); if (p.dungeon && p.dungeon.chest) p.dungeon.chest.forEach((x) => got.add(x[0])); });
  ((C.MINE && C.MINE.bands) || []).forEach((b) => b.ids.forEach((id) => got.add(id)));
  Object.keys(C.WORKSHOPS).forEach((w) => (C.WORKSHOPS[w].recipes || []).forEach((r) => got.add(r.out)));
  return got;
};
const buildAll = (k) => {
  const s = fresh();
  s.gold = 1e7;
  s.lumber = 100;
  for (let lv = 0; lv < 6; lv++) {
    const next = L.nextWeapon(s, k);
    assert.strictEqual(next.level, lv);
    next.needs.forEach((n) => { if (n[0] !== 'lumber') L.addItem(s, n[0], n[1]); });
    assert.strictEqual(L.getWeapon(s, k), 'ok', k + ' level ' + lv);
  }
  return s;
};

test('every Boomerang level, Basic to Moon, is built from what the game drops; the weapons file\'s ids are the Gorge\'s drops', () => {
  const got = sources();
  [['kalapati_feather', 'kalapati'], ['banog_feather', 'banog'], ['bato_crown', 'batoking'], ['galura_feather', 'gr_galura']].forEach(([id, who]) => {
    assert.ok(C.ITEMS[id] && C.ITEMS[id].place === 'gorge', id + ' is a Gorge item');
    assert.ok(A[who].drops.some((d) => d[0] === id && d[2] === 1), who + ' drops ' + id);
  });
  C.WEAPONS.boomerang.buy.forEach((b, lv) => {
    assert.deepStrictEqual(plain(L.weaponNeeds(b.needs)), plain(b.needs), 'Boomerang level ' + lv + ': every material it lists is in the game');
    b.needs.forEach((n) => assert.ok(got.has(n[0]), 'Boomerang level ' + lv + ': ' + n[0] + ' comes from somewhere'));
  });
  assert.deepStrictEqual(plain(L.weaponNeeds(C.WEAPONS.boomerang.buy[5].needs)), [['galura_feather', 6], ['arimaonga_mane', 3], ['bamboo_heart', 3], ['bakunawa_scale', 5]]);
  ['arimaonga_mane', 'bamboo_heart', 'bakunawa_scale'].forEach((id) => assert.ok(C.ITEMS[id] && got.has(id), id));
  const s = buildAll('boomerang');
  assert.strictEqual(L.itemName(s, 'boomerang'), 'Moon Boomerang');
  assert.strictEqual(L.throwsLeft(s), 600);
});

test('the Moon Rifle and the Moon Javelin can be built now: galura_feather drops; every level of both from game drops', () => {
  const got = sources();
  ['rifle', 'javelin'].forEach((k) => {
    C.WEAPONS[k].buy.forEach((b, lv) => {
      // (every Manila drop is asked for now; the Rifle's Basic 'iron' is no item, so it was never asked for: as before)
      b.needs.filter((n) => n[0] !== 'iron').forEach((n) => assert.ok(L.weaponNeeds(b.needs).some((x) => x[0] === n[0]), k + ' level ' + lv + ': ' + n[0] + ' asked for'));
      L.weaponNeeds(b.needs).forEach((n) => assert.ok(got.has(n[0]), k + ' level ' + lv + ': ' + n[0]));
    });
    assert.ok(L.weaponNeeds(C.WEAPONS[k].buy[5].needs).some((n) => n[0] === 'galura_feather' && n[1] === 3), k + ': the Galura Feather asked for');
    const s = buildAll(k);
    assert.strictEqual(L.itemName(s, k), 'Moon ' + C.WEAPONS[k].name);
  });
});

// a row of animals (the boomerang's touch: the world's rule, 19zzz...z-weapons.js `touching`)
const throwAt = (row, opts) => {
  const T = C.TILE, home = { x: 9.5 * T, y: 13.3 * T }, ang = -Math.PI / 2, hits = [];
  const sh = { x0: home.x, y0: home.y, x: home.x, y: home.y, c: Math.cos(ang), s: Math.sin(ang), range: opts.range * T, t: 0, went: 0, moon: opts.moon || null };
  const touch = (x, y, only) => row.find((a) => a.hp > 0 && (!only || a === only) && Math.hypot(x - a.x, y - (a.y - 0.3 * a.def.w * T)) < Math.max(0.45, 0.55 * a.def.w) * T + 0.15 * T) || null;
  const beside = (a) => row.filter((b) => b !== a && b.hp > 0).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).find((b) => Math.hypot(b.x - a.x, b.y - a.y) < C.WEAPON_PAIR * T) || null;
  let tau = 0, n = 0;
  while (tau < 1 && n++ < 500) {
    tau = L.boomStep(sh, 16, { trip: 820, home, T, touch, beside, strike: (a) => { a.hp -= opts.dmg; hits.push({ slot: a.slot, back: sh.t / 820 >= 0.5 }); if (opts.after) opts.after(a, sh); } });
  }
  return { hits, sh, tau };
};
const rowOf = (n, hp, kind) => [0, 1, 2, 3, 4].slice(0, n).map((i) => { const T = C.TILE, p = L.flockSpot(9.5 * T, 10.7 * T, 0, i, T, A[kind].w, n, A[kind]); return { slot: i, hp, def: A[kind], x: p.x, y: p.y }; });

test('the Boomerang hits the first animal on the way out and the first one again on the way back; the Moon one 2 side by side each way', () => {
  // Silver (reach 3, hits 2) at a row of four Kalapati (5 hp): the one in front, twice
  let r = throwAt(rowOf(4, 5, 'kalapati'), { range: 3, dmg: 2 });
  assert.deepStrictEqual(r.hits, [{ slot: 0, back: false }, { slot: 0, back: true }], 'out and back, the same one');
  assert.strictEqual(r.tau, 1, 'back in your hand');
  // it runs off after the first hit: the way back still finds it (it swings through where it is now, when in reach)
  r = throwAt(rowOf(4, 5, 'kalapati'), { range: 3, dmg: 2, after: (a, sh) => { if (!sh.backHit) { a.x += 0.6 * C.TILE; a.y -= 0.4 * C.TILE; } } });
  assert.deepStrictEqual(r.hits.map((h) => h.slot), [0, 0], 'the first one again, where it went');
  // the first one falls going out: on the way back it hits the first one it meets (here one standing behind it, which it
  // flew past going out: one hit each way)
  const T = C.TILE, two = [{ slot: 0, hp: 2, def: A.kalapati, x: 10.17 * T, y: 10.9 * T }, { slot: 1, hp: 5, def: A.kalapati, x: 9.5 * T, y: 8.6 * T }];
  r = throwAt(two, { range: 5, dmg: 2 });
  assert.deepStrictEqual(r.hits, [{ slot: 0, back: false }, { slot: 1, back: true }], 'the next one on the way back');
  // a row with the one in front gone after the first hit: nothing more in its way home, nothing more hit
  r = throwAt(rowOf(4, 2, 'kalapati'), { range: 3, dmg: 2 });
  assert.deepStrictEqual(r.hits, [{ slot: 0, back: false }]);
  // nothing on the way out (out of reach going, the row walked in behind): the first it meets coming back
  r = throwAt([], { range: 3, dmg: 2 });
  assert.deepStrictEqual(r.hits, []);
  // the Moon Boomerang (reach 6, hits 3, pair): 2 side by side each way, 4 hits a throw on a flock
  r = throwAt(rowOf(5, 12, 'gr_langay'), { range: 6, dmg: 3, moon: 'pair' });
  assert.strictEqual(r.hits.length, 4, JSON.stringify(r.hits));
  assert.deepStrictEqual(r.hits.filter((h) => !h.back).length, 2);
  assert.strictEqual(new Set(r.hits.map((h) => h.slot)).size, 2, 'the first and the one beside it, out and back');
  assert.strictEqual(L.weaponMoon('boomerang', 5), 'pair');
  assert.strictEqual(L.weaponMoon('boomerang', 4), null);
  // a lone animal far off: the boomerang flies its loop out to its reach and back, as before
  const lone = throwAt([{ slot: 9, hp: 5, def: A.ibid, x: 9.5 * C.TILE, y: 1 * C.TILE }], { range: 3, dmg: 1 });
  assert.deepStrictEqual(lone.hits, []);
  assert.ok(lone.sh.went > 5 * C.TILE && Math.hypot(lone.sh.x - 9.5 * C.TILE, lone.sh.y - 13.3 * C.TILE) < 1, 'out 3 tiles and home');
});

test('a shot costs what the Bow\'s does (2), never 4: the Boomerang, the Bow, in the Gorge and the Echo Caves', () => {
  const s = fresh();
  assert.strictEqual(C.SHOT_ENERGY.gorge, undefined);
  assert.strictEqual(C.SHOT_ENERGY.gorge_cave, undefined);
  ['gorge', 'gorge_cave'].forEach((m) => { s.map = m; assert.strictEqual(L.shotEnergy(s, WI.shotEnergy), 2, m); });
  assert.strictEqual(C.WEAPON_ENERGY, 2);
  s.map = 'gorge';
  s.gold = 1e6; s.lumber = 50; s.energy = 100;
  L.addItem(s, 'beeswax', 2);
  assert.strictEqual(L.getWeapon(s, 'boomerang'), 'ok');
  assert.strictEqual(L.fireWeapon(s, 'boomerang'), 'ok');
  assert.strictEqual(s.energy, 98, 'a throw: 2');
  L.addItem(s, 'arrows', 5);
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(s.energy, 96, 'an arrow: 2');
  assert.ok(L.weaponsWork('gorge') && L.weaponsWork('gorge_cave'));
});

test('the horse: rides free; 8 hearts and Horseshoes in the Gorge, 10 and the Lantern Bridle in the Echo Caves; only a hit tires it', () => {
  const H = C.HORSE_OUT, s = fresh();
  s.horse = { name: 'Chestnut', love: 7 * H.loveHeart, pet: 0 };
  assert.strictEqual(L.horseZone('gorge'), 'hunt');
  assert.strictEqual(L.horseMayGo(s, 'gorge').why, 'hearts');
  assert.strictEqual(L.horseMayGo(s, 'gorge').need, 8);
  s.horse.love = 8 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'gorge').why, 'shoes');
  s.horse.g = 1 << H.gearOrder.indexOf('horseshoes');
  assert.ok(L.horseMayGo(s, 'gorge').ok);
  assert.strictEqual(L.horseMayGo(s, 'gorge_cave').why, 'hearts');
  s.horse.love = 10 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'gorge_cave').why, 'lantern');
  s.horse.g |= 1 << H.gearOrder.indexOf('lantern_bridle');
  assert.ok(L.horseMayGo(s, 'gorge_cave').ok);
  assert.strictEqual(L.horseRide(s, 'gorge', 40), 'ok');
  assert.strictEqual(L.horseStamina(s), H.stamina, 'riding is free');
  L.horseHit(s);
  assert.strictEqual(L.horseStamina(s), H.stamina - H.hitDrain, 'a hit tires it');
  assert.strictEqual(L.horseKnocks('gorge_cave', A.batoking, 0), true, 'the guard can knock you off in the cave');
  assert.strictEqual(L.horseKnocks('gorge', A.banog, 0), false, 'not in the Gorge itself');
});

test('the map: the canyon\'s cliffs solid, the ledges with a face under them and open at their inner end, the stream and its two rope bridges, every place in reach', () => {
  const m = L.gorgeMap(map('pulag')), obj = m.layers[3].objects, by = (n) => obj.filter((o) => o.name === n)[0];
  assert.deepStrictEqual([m.width, m.height], [G.W, G.H]);
  const road = by('road_south');
  assert.deepStrictEqual(plain(road.properties.map((p) => p.value)), ['manila', 'from_gorge', true]);
  assert.deepStrictEqual([road.x / 256, road.y / 256, road.width / 256], [G.gate[0], G.H - 1, 2]);
  ['from_city', 'dungeon_door', 'dungeon_mouth', 'from_dungeon', 'wild', 'sign_gorge', 'sign_echo'].forEach((n) => assert.ok(by(n), n));
  assert.strictEqual(by('dungeon_door').properties[0].value, 'gorge_cave');
  const w = walker(m), sp = by('from_city'), reach = w.from(Math.floor(sp.x / 256), Math.floor(sp.y / 256));
  assert.ok(reach(G.gate[0], G.H - 1) && reach(G.gate[0] + 1, G.H - 1), 'down to the gate');
  assert.ok(reach(G.door[0], G.door[1]), 'into the cave\'s door');
  assert.ok(reach(P.npc.at[0], P.npc.at[1] + 1), 'Tata Ambo');
  P.chests.forEach((c) => assert.ok(reach(c[0], c[1]), 'chest ' + c));
  // the cliffs: their top and face are solid all round; you cannot climb them
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
    if (x < G.rim || x >= G.W - G.rim || y < G.rim + G.face) assert.ok(!(x === G.door[0] && y === G.door[1]) ? w.block[y * G.W + x] : true, 'cliff ' + x + ',' + y);
  }
  // every ledge: its shelf reached, a face under it, the way up at its inner end
  G.ledges.forEach((l) => {
    const inner = l[0] < G.W / 2 ? l[0] + l[2] - 1 : l[0];
    assert.ok(reach(inner, l[1] + 1), 'ledge ' + l);
    for (let x = l[0]; x < l[0] + l[2]; x++) { assert.ok(w.block[(l[1] + l[3]) * G.W + x], 'the face under ledge ' + l + ' at ' + x); assert.ok(w.block[(l[1] - 1) * G.W + x], 'the outcrop above'); }
    assert.ok(reach(inner + (l[0] < G.W / 2 ? 1 : -1), l[1] + 1), 'off its inner end, down to the canyon');
  });
  // the stream is water; the two rope bridges cross it
  const st = G.stream;
  for (let y = st[1]; y < st[1] + st[3]; y++) {
    const bridge = G.bridges.some((b) => y === b || y === b + 1);
    for (let x = st[0]; x < st[0] + st[2]; x++) assert.strictEqual(reach(x, y), bridge, (bridge ? 'bridge ' : 'water ') + x + ',' + y);
  }
  assert.ok(reach(st[0] - 1, 30) && reach(st[0] + st[2], 30), 'both banks');
  assert.strictEqual(obj.filter((o) => o.name === 'flower_arch').length, 2, 'two rope bridges');
  assert.strictEqual(G.kinds.length, 12);
  assert.deepStrictEqual(plain(Object.values(C.PLACE_PROP_SWAP.gorge).sort()), plain(G.kinds.slice().sort()));
  // this map's own copy of the tiles makes the cliff tiles solid; the town's sheet (Pulag's map) is as before
  const tl = m.tilesets.find((t) => t.name === 'tiles'), pul = map('pulag').tilesets.find((t) => t.name === 'tiles');
  [G.tiles.top, G.tiles.face, G.tiles.faceHi, G.tiles.faceLo].forEach((id) => {
    assert.ok(tl.tiles.find((t) => t.id === id).properties.some((p) => p.name === 'collides' && p.value), 'solid here: ' + id);
    assert.ok(!(pul.tiles.find((t) => t.id === id) || { properties: [] }).properties.some((p) => p.name === 'collides'), 'not in Pulag\'s: ' + id);
  });
  assert.ok(!C.PLACE_GROUND.includes('gorge'), 'its ground is painted by its own code (four textures)');
  assert.deepStrictEqual(plain(require('../tools/manila/plains-art').all('gorge').filter((k) => /^ground_gorge/.test(k)).sort()), ['ground_gorge', 'ground_gorge_cliff', 'ground_gorge_face', 'ground_gorge_water']);
});

test('Manila\'s Gorge Gate: north, on the turned-round city\'s top edge; shut until 110 hunts, then the way in; the goal arrow', () => {
  const M = C.MANILA, g = M.gorgeGate;
  assert.strictEqual(g.key, 'gorge');
  assert.deepStrictEqual(plain(g.box), [42, 0, 4, 3], 'x 44 in the layout, turned round: 90 - 44 - 4');
  assert.strictEqual(g.box[1], 0, 'on the north edge');
  assert.match(g.text, /opens at 110 hunts/);
  assert.ok(!/soon/i.test(g.text));
  assert.strictEqual(C.ROUTES.manila.gorge, 'gorge_gate');
  assert.strictEqual(C.ROUTES.manila.gorge_cave, 'gorge_gate');
  assert.strictEqual(C.ROUTES.town.gorge, C.ROUTES.town.manila);
  assert.strictEqual(C.ROUTES.gorge.manila, 'road_south');
  assert.strictEqual(C.ROUTES.gorge.jungle, 'road_south');
  assert.strictEqual(C.ROUTES.gorge.gorge_cave, 'dungeon_door');
  assert.strictEqual(C.ROUTES.gorge_cave.manila, 'exit');
  assert.strictEqual(C.ROUTES.jungle.gorge, 'road_north', 'from the Jungle: north to Manila');
  assert.strictEqual(C.ROUTES.manila.jungle, 'jungle_gate', 'the Jungle Gate as before');
});

test('saves: no new key; the Gorge saves as a place (on its map: Pulag + its name, in its cave: at the door); old saves load as before', () => {
  const s = fresh(), keys = Object.keys(L.serialize(s)).sort();
  s.wild.n = 110;
  s.map = 'gorge';
  const o = L.serialize(s);
  assert.strictEqual(o.pm, 'gorge');
  assert.strictEqual(o.m, L.serialize(Object.assign({}, s, { map: 'pulag' })).m, 'saved as Pulag for an older game');
  assert.strictEqual(L.deserialize(plain(o)).map, 'gorge');
  s.map = 'gorge_cave';
  const c = L.serialize(s);
  assert.ok(c.pd === 1 && c.pm === 'gorge');
  const back = L.deserialize(plain(c));
  assert.strictEqual(back.map, 'gorge');
  assert.strictEqual(back.player.spawn, 'from_dungeon');
  const t = fresh();
  t.wild.n = 110;
  L.hunted(t, 'gorge', 0, 'kalapati', 1);
  L.hunted(t, 'gorge', 0, 'adarna', 1);
  L.talkNpc(t, 'gorge');
  tame(t);
  const r = roundTrip(t);
  assert.strictEqual(L.placeHunts(r, 'gorge'), 2);
  assert.strictEqual(r.wild.by.kalapati, 1);
  assert.ok(L.tamed(r, 'gorge') && r.comp === 'gorge');
  assert.ok(L.hasMedal(r, 2300), 'first hunt in the Rocky Gorge');
  // a Moon Boomerang saves as before (o.wp)
  const u = buildAll('boomerang');
  assert.deepStrictEqual(plain(L.serialize(u).wp), [0, 0, 5, 600]);
  assert.deepStrictEqual(Object.keys(L.serialize(fresh())).sort(), keys);
  assert.strictEqual(C.SAVE_GEN, 3);
});

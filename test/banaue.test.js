// Banaue Terraces (owner, 6 Nov 2026; src/00-zzzzzzzzzz-place-11-banaue.js, src/01-logicZZZZZ-place-11-banaue.js,
// maps/banaue.json, maps/banaue_cave.json): its fixed item ids and art names, its numbers (between Makiling and
// Magayon / the Lair), opening at 60 hunts, taming the calm duck, Lola Bugan's story and gifts, the Terrace set, the
// tunnels' floors and boss, Adobong Itik, its medals, and its two maps (every way through open, the chests and Lola
// Bugan on free tiles). The engine's checks on every place's data are in test/places.test.js.
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
const F = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const fresh = () => { clock.set(2026, 11, 6, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const ID = 'banaue', P = () => C.PLACES[ID], A = C.WILD.animals;
const hold = (s, id) => { s.sel = s.inv.findIndex((x) => x && x.id === id); };

test('Banaue: the 16 ids of docs/places-items.json, in its order, and every picture of the prompts named', () => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'places-items.json'), 'utf8')).banaue;
  assert.deepStrictEqual(plain(F.BANAUE_ICONS), j.items.map((x) => x.id), 'the icons sheet order');
  const gear = Object.values(P().gear.pieces).map((g) => g.id);
  assert.deepStrictEqual(gear, ['terrace_hat', 'terrace_vest', 'terrace_sandals', 'terrace_charm']);
  assert.deepStrictEqual(Object.keys(P().items).concat(gear).sort(), j.items.map((x) => x.id).sort(), 'items + gear = the 16');
  Object.keys(P().items).forEach((id) => assert.ok(Number.isInteger(C.ITEMS[id].icon) && C.ITEMS[id].place === ID, id));
  // every picture of art-src/PLACES-1-5-PROMPTS.md 1-18 has a name the game looks for
  const sheets = new Set(C.WILD.more.filter((k) => A[k].place === ID).map((k) => A[k].sheet));
  assert.deepStrictEqual([...sheets].sort(), ['wild_amomongo', 'wild_bayawak', 'wild_cavebayawak', 'wild_goldduck', 'wild_itik', 'wild_kibaan', 'wild_kibaanchief']);
  assert.strictEqual(P().npc.sheet, 'npc_lola_bugan');
  assert.deepStrictEqual(plain(P().dungeon.art), { mouth: 'props/banaue_mouth', gate: 'props/banaue_gate', cave: 'banaue_cave' });
  assert.deepStrictEqual(plain(F.BANAUE_PROP_ORDER), ['banaue_wall', 'banaue_hut', 'banaue_fern', 'banaue_rack', 'banaue_boulder', 'banaue_grass'], 'props_banaue.png, row by row');
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', 'banaue.json'), 'utf8'));
  assert.ok(map.tilesets.some((t) => t.name === 'banaue_ground'), 'ground_banaue.png and ground_banaue_water.png go in its own tileset');
  const packed = require('../tools/places/banaue-art').all;
  ['props/banaue_mouth', 'props/banaue_gate', 'banaue_cave', 'npc_lola_bugan', 'wild_itik', 'wild_itikshade'].concat(F.BANAUE_PROP_ORDER.map((n) => 'props/' + n))
    .forEach((k) => assert.ok(packed.includes(k), k + ' goes in the wild pack when it comes'));
});

test('Banaue: its numbers sit between Makiling and Magayon (and the Lair)', () => {
  const mak = ['boar', 'wolf'], mag = ['bear', 'tiger', 'rhino'];
  const max = (ks, f) => Math.max(...ks.map((k) => A[k][f])), min = (ks, f) => Math.min(...ks.map((k) => A[k][f]));
  ['bayawak', 'cave_bayawak'].forEach((k) => {
    assert.ok(A[k].hp > max(mak, 'hp') && A[k].hp <= min(mag, 'hp'), k + ' hp');
    assert.ok(A[k].hit >= max(mak, 'hit') && A[k].hit < min(mag, 'hit'), k + ' hit');
  });
  assert.strictEqual(A.itik.hp, 1, 'a duck: one arrow');
  assert.ok(A.goldduck.rare && A.goldduck.respawn === 120 && A.goldduck.drops[0][0] === 'golden_feather');
  // the guard: softer than the Lair's Bungisngis; the boss: between the Bungisngis and the Bakunawa, and soloable
  assert.ok(A.kibaan_chief.boss && A.kibaan_chief.hp < A.bungisngis.hp);
  assert.ok(A.amomongo.boss && !A.amomongo.great && A.amomongo.hp > A.bungisngis.hp && A.amomongo.hp < A.bakunawa.hp, 'between the two Lair bosses');
  assert.strictEqual(L.dunHp('amomongo', 1), 30, 'soloable');
  assert.strictEqual(L.dunHp('amomongo', 2), 42, '12 more for a friend');
  assert.strictEqual(L.dunHp('amomongo', 3), 54);
  // what Kanor pays: more than Makiling's, less than Magayon's, the rare and the boss's dear
  assert.ok(C.ITEMS.scale_bayawak.sell > C.ITEMS.tusk.sell && C.ITEMS.scale_bayawak.sell < C.ITEMS.hide_rhino.sell);
  assert.ok(C.ITEMS.fur_amomongo.sell > C.ITEMS.bungisngis_tooth.sell * 0.5 && C.ITEMS.fur_amomongo.sell < C.ITEMS.bakunawa_scale.sell);
  // gear: Head/Feet 3000, Body 5000, Charm 6000 (the Fire Charm's price)
  assert.deepStrictEqual(['head', 'body', 'feet', 'charm'].map((s) => C.PLACE_GEAR[ID + '_' + s].gold), [3000, 5000, 3000, 6000]);
});

test('Banaue opens at 60 hunts, by the Jeep', () => {
  const s = fresh();
  s.wild.n = 59;
  assert.strictEqual(L.placeOpen(s, ID), false);
  const row = () => plain(L.jeepPlaces(s)).find((p) => p.id === ID);
  assert.deepStrictEqual([row().open, row().unlock], [false, 60]);
  assert.strictEqual(L.hunted(s, 'pulag', 0, 'deer', 1).opened, ID, 'the 60th hunt opens it');
  assert.strictEqual(row().open, true);
  assert.match(C.WILD.areas[ID].opened, /^BANAUE TERRACES IS OPEN\nKanor: "Sixty hunts!/);
  assert.ok(L.isWildMap('banaue') && L.isWildMap('banaue_cave'));
  assert.deepStrictEqual(plain(L.wildHere(s, ID).map((e) => e.kind)).sort(), ['bayawak', 'bayawak', 'bayawak', 'itik', 'itik', 'itik', 'itik', 'itik_calm']);
});

test('Banaue taming: 8 feedings of heirloom rice, 1 in 4 it flies off for 15 minutes; Lola Bugan\'s first two gifts are enough', () => {
  const s = fresh();
  const t = P().tame;
  assert.deepStrictEqual([t.kind, t.food, t.feedings, t.runOff, t.back, t.skill], ['itik_calm', 'heirloom_rice', 8, 0.25, 15, 'spot']);
  assert.ok(A.itik_calm.tameOnly && !A.itik.tameOnly, 'the calm one is not for the Bow; the others are');
  assert.strictEqual(A.itik_calm.sheet, A.itik.sheet, 'the same bird');
  // Lola Bugan: 4 rice at once; 4 more after 5 hunts here
  L.talkNpc(s, ID);
  for (let i = 0; i < 5; i++) L.hunted(s, ID, 0, 'itik', 1);
  L.talkNpc(s, ID);
  assert.strictEqual(L.countItem(s, 'heirloom_rice'), 8);
  hold(s, 'heirloom_rice');
  assert.strictEqual(L.canFeed(s, ID, 'idle', 1.4), true);
  let ran = 0;
  for (let i = 0; i < 8; i++) {
    const r = L.feedTame(s, ID, () => (i === 3 ? 0.1 : 0.9));
    if (r === 'ran') { ran++; assert.strictEqual(L.tameAway(s, ID), true); clock.advance(t.back + 1); }
  }
  assert.strictEqual(ran, 1);
  assert.strictEqual(L.tamed(s, ID), true, '8 feedings: tamed');
  assert.strictEqual(L.countItem(s, 'heirloom_rice'), 0);
  assert.strictEqual(L.companion(s), ID);
  assert.strictEqual(L.companionSkill(roundTrip(s)), 'spot', 'a Spotter: it says when the Golden Duck is out');
  assert.ok(L.hasMedal(s, 1103) || (L.medalCheck(s), L.hasMedal(s, 1103)), 'the tame medal');
});

test('Lola Bugan: four steps (first visit, 5 hunts, the guard, the boss), each with its gift once', () => {
  const s = fresh();
  const d = P().dungeon;
  const talk = () => plain(L.talkNpc(s, ID));
  let r = talk();
  assert.strictEqual(r.i, 0);
  assert.deepStrictEqual(r.gift, [['heirloom_rice', 4]]);
  assert.strictEqual(L.giftWords(r.gift), '4 Heirloom Rice');
  r = talk();
  assert.strictEqual(r.gift, undefined, 'given once');
  assert.strictEqual(L.countItem(s, 'heirloom_rice'), 4);
  assert.match(P().npc.lines[1].hint, /Hunt here/);
  for (let i = 0; i < 4; i++) L.hunted(s, ID, 0, 'bayawak', 1);
  assert.strictEqual(talk().i, 0, '4 hunts: not yet');
  L.hunted(s, ID, 1, 'itik', 1);
  r = talk();
  assert.strictEqual(r.i, 1);
  assert.strictEqual(L.giftWords(r.gift), '4 Heirloom Rice and 10 Arrows');
  L.hunted(s, d.key, 0, d.guard, 1);
  r = talk();
  assert.strictEqual(r.i, 2);
  assert.ok(L.countItem(s, 'terrace_stone') >= 6);
  L.hunted(s, d.key, 0, d.boss, 1);
  r = talk();
  assert.deepStrictEqual([r.i, r.last], [3, true]);
  assert.deepStrictEqual(r.gift, [['adobong_itik', 2], ['heirloom_rice', 3]], 'she cooks for you');
  assert.strictEqual(L.countItem(s, 'adobong_itik'), 2);
  const back = roundTrip(s);
  assert.strictEqual(plain(L.talkNpc(back, ID)).gift, undefined, 'not again after a reload');
  L.medalCheck(s);
  assert.ok(L.hasMedal(s, 1105), 'her story\'s medal');
  // kind words only: the bulul are spoken of, never fought
  assert.ok(P().npc.lines.some((l) => /bulul/.test(l.text)));
  assert.ok(!Object.keys(A).some((k) => /bulul/i.test(k + ' ' + A[k].name)), 'no bulul creature');
});

test('the Terrace set: Kanor makes it from Banaue\'s drops; all four take 6 off a charge, 8 off a Banaue creature\'s (map and tunnels)', () => {
  const s = fresh();
  s.gold = 20000;
  Object.values(P().gear.pieces).forEach((g) => g.needs.forEach(([id, n]) => L.addItem(s, id, n)));
  ['head', 'body', 'feet', 'charm'].forEach((slot) => assert.strictEqual(L.makeGear(s, ID + '_' + slot), 'ok', slot));
  assert.strictEqual(s.gold, 20000 - 17000);
  assert.strictEqual(L.wornSet(s), ID);
  assert.strictEqual(L.chargeLoss(s, 16, 'bear'), 10, '1 + 2 + 1 + 2 off anyone\'s');
  assert.strictEqual(L.chargeLoss(s, 10, 'bayawak'), 2, '2 more off the Bayawak');
  assert.strictEqual(L.chargeLoss(s, 15, 'amomongo'), 7, 'and in the tunnels');
  assert.strictEqual(L.chargeLoss(s, 11, 'cave_bayawak'), 3);
  assert.strictEqual(L.chargeLoss(s, 9, 'kibaan_chief'), 1, 'never under 1');
});

test('the Terrace Tunnels: 10 floors, more creatures deeper, the Kibaan Chief on 5, the Amomongo on 10, the lift at 1, 6', () => {
  const d = P().dungeon;
  const roster = (f) => plain(L.dunRoster(d.key, f)).map((x) => x.kind);
  assert.deepStrictEqual([1, 2, 3, 4, 6, 7, 8, 9].map((f) => roster(f).length), [3, 3, 3, 4, 4, 4, 5, 5], '3, 4 from floor 4, 5 from floor 8');
  assert.deepStrictEqual(roster(1), ['kibaan', 'kibaan', 'kibaan'], 'only Kibaan at first');
  assert.ok(roster(9).includes('cave_bayawak'));
  const bay = (from, to) => { let n = 0; for (let f = from; f <= to; f++) if (f !== 5) n += roster(f).filter((k) => k === 'cave_bayawak').length; return n; };
  assert.ok(bay(7, 9) > bay(2, 4), 'more Cave Bayawak deeper');
  assert.deepStrictEqual(roster(5).slice(0, 1).concat(roster(5).length), ['kibaan_chief', 3], 'the guard and two');
  assert.deepStrictEqual(roster(10)[0], 'amomongo');
  const s = fresh();
  for (let f = 1; f <= 10; f++) L.dunReach(s, d.key, f);
  assert.deepStrictEqual(plain(L.dunStops(s, d.key)), [1, 6]);
  // the daily chest: stacks to 3
  L.hunted(s, d.key, 0, d.boss, 1);
  s.day += 9;
  L.hunted(s, d.key, 0, d.boss, 1);
  assert.strictEqual(L.bossChests(s, ID), 3);
  const loot = plain(L.openBossChests(s, ID, () => 0));
  assert.deepStrictEqual(loot, [['fur_amomongo', 3], ['heirloom_rice', 6], ['terrace_stone', 9], ['arrows', 30], ['golden_feather', 3]]);
  L.medalCheck(s);
  assert.ok(L.hasMedal(s, 1102), 'the boss medal');
});

test('Adobong Itik: cooked in the kitchen from Itik Meat, garlic and heirloom rice; duck counts as meat', () => {
  const s = fresh();
  s.builds.kitchen = true;
  const r = C.RECIPES.find((x) => x.dish === 'adobong_itik');
  assert.deepStrictEqual(plain(r.needs), ['meat_itik', 'garlic', 'heirloom_rice']);
  assert.strictEqual(L.cook(s, r), 'missing');
  ['meat_itik', 'garlic', 'heirloom_rice'].forEach((id) => L.addItem(s, id, 1));
  assert.notStrictEqual(L.cook(s, r), 'missing');
  assert.strictEqual(L.countItem(s, 'adobong_itik'), 1);
  assert.ok(C.ITEMS.adobong_itik.energy > C.ITEMS.boar_adobo.energy - 10 && C.ITEMS.adobong_itik.energy < C.ITEMS.kaldereta.energy);
  assert.ok(C.FOOD_GROUPS.meat.includes('meat_itik'));
});

test('Banaue\'s medals: codes 1100 and up, one each', () => {
  const ms = C.MEDALS.filter((m) => m.place === ID);
  assert.deepStrictEqual(plain(ms.map((m) => m.code)), [1100, 1101, 1102, 1103, 1104, 1105, 1110, 1111, 1112, 1113, 1114]);
  assert.deepStrictEqual(plain(ms.slice(6).map((m) => m.title)), ['Wild Duck', 'Giant Wild Duck', 'Bayawak', 'Giant Bayawak', 'Rare: Golden Duck']);
});

// ---------- the maps ----------
const loadMap = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', name + '.json'), 'utf8'));
// Which tiles a person can stand on: no solid tile in any layer, no prop's solid foot, not the mouth's rock.
const walk = (m) => {
  const solid = new Set();
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { if ((t.properties || []).some((p) => p.name === 'collides' && p.value)) solid.add(ts.firstgid + t.id); }));
  const ok = new Array(m.width * m.height).fill(true);
  m.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Above').forEach((l) => l.data.forEach((g, i) => { if (solid.has(g)) ok[i] = false; }));
  const objs = m.layers.find((l) => l.type === 'objectgroup').objects;
  objs.filter((o) => o.type === 'place_prop' && (o.properties || []).some((p) => p.name === 'foot')).forEach((o) => {
    for (let y = o.y / 256; y < (o.y + o.height) / 256; y++) for (let x = o.x / 256; x < (o.x + o.width) / 256; x++) ok[y * m.width + x] = false;
  });
  objs.filter((o) => o.type === 'jeep').forEach((o) => { for (let x = o.x / 256; x < (o.x + o.width) / 256; x++) ok[(o.y / 256) * m.width + x] = false; });
  const mouth = objs.find((o) => o.name === 'dungeon_mouth');
  if (mouth) { const cx = Math.floor(mouth.x / 256), foot = Math.round(mouth.y / 256) - 1; [[cx - 1, 3], [cx + 1, 3], [cx, 2]].forEach(([x, n]) => { for (let y = foot - 2; y < foot - 2 + n; y++) ok[y * m.width + x] = false; }); }
  return { ok, objs, at: (x, y) => ok[y * m.width + x] };
};
const reach = (m, w, x0, y0) => {
  const seen = new Set([y0 * m.width + x0]), q = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = ny * m.width + nx;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(k) || !w.ok[k]) return;
      seen.add(k);
      q.push([nx, ny]);
    });
  }
  return (x, y) => seen.has(y * m.width + x);
};

test('maps/banaue.json: about Pulag\'s size; the jeep, the cave door, Lola Bugan and every chest on free tiles, all reached from the jeep', () => {
  const m = loadMap('banaue'), w = walk(m), pt = (n) => w.objs.find((o) => o.name === n);
  assert.deepStrictEqual([m.width, m.height], [32, 30]);
  ['jeep', 'from_jeep', 'wild', 'dungeon_door', 'dungeon_mouth', 'from_dungeon'].forEach((n) => assert.ok(pt(n), n));
  assert.deepStrictEqual(plain(pt('dungeon_door').properties.map((p) => [p.name, p.value])), [['to', 'banaue_cave'], ['spawn', 'entrance'], ['walk', true]]);
  const fj = pt('from_jeep'), fx = Math.floor(fj.x / 256), fy = Math.floor(fj.y / 256);
  assert.ok(w.at(fx, fy), 'you step off the jeep onto a free tile');
  const can = reach(m, w, fx, fy);
  P().chests.forEach(([x, y]) => assert.ok(w.at(x, y) && can(x, y), 'chest ' + x + ',' + y));
  const [nx, ny] = P().npc.at;
  assert.ok(w.at(nx, ny) && can(nx, ny + 1), 'Lola Bugan, and the tile in front of her');
  const door = pt('dungeon_door'), fd = pt('from_dungeon');
  assert.ok(can(door.x / 256, door.y / 256 + 1) && can(Math.floor(fd.x / 256), Math.floor(fd.y / 256)), 'the cave door');
  // inside the ring of trees, every open tile is reached: no terrace, dike or corner is cut off
  const cut = [];
  for (let y = 1; y < m.height - 2; y++) for (let x = 2; x < m.width - 2; x++) if (w.at(x, y) && !can(x, y)) cut.push(x + ',' + y);
  assert.deepStrictEqual(cut, []);
  const props = w.objs.filter((o) => o.type === 'place_prop');
  assert.ok(props.every((o) => F.BANAUE_PROPS[o.name]), 'every prop is one of the place\'s');
  ['banaue_wall', 'banaue_hut', 'banaue_fern', 'banaue_rack', 'banaue_boulder', 'banaue_grass'].forEach((n) => assert.ok(props.some((o) => o.name === n), n));
  assert.ok(fs.statSync(path.join(ROOT, 'maps', 'banaue.json')).size < 35000, 'lean: the page carries it');
});

test('maps/banaue_cave.json: the ladder, the gate down and the lift\'s tiles, the gate reached from the way in', () => {
  const m = loadMap('banaue_cave'), w = walk(m), pt = (n) => w.objs.find((o) => o.name === n);
  const gate = pt('dungeon_gate'), exit = pt('exit');
  assert.ok(gate && exit && pt('entrance') && pt('wild'));
  assert.deepStrictEqual(plain(exit.properties.map((p) => [p.name, p.value])), [['to', 'banaue'], ['spawn', 'from_dungeon'], ['label', 'Climb out']]);
  const can = reach(m, w, 5, 3);
  assert.ok(can(gate.x / 256, gate.y / 256) && can(gate.x / 256 + 1, gate.y / 256 + 1), 'the gate');
  [[2, 2], [3, 2], [2, 3], [3, 3]].forEach(([x, y]) => assert.ok(w.at(x, y), 'the lift\'s tile ' + x + ',' + y));
  assert.ok(m.tilesets.every((t) => t.name !== 'props'), 'no props tileset: its props are the place\'s own');
  assert.ok(fs.statSync(path.join(ROOT, 'maps', 'banaue_cave.json')).size < 12000);
});

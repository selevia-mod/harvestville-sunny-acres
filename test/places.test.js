// Unit tests for the hunting places engine (owner, 6 Nov 2026; src/00-zzzzzzzzz-places.js, src/01-logicZZZZ-places.js
// and the SAMPLE place, src/00-zzzzzzzzzz-place-99-sample.js): gear slots and what they take off a charge, taming,
// medals and their save, the boss's daily chest, "% explored", opening by hunts, the caves' floors, and every place's
// data. The tests marked SAMPLE go with the sample place when the place agents delete it; the data checks stay.
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
const F = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const fresh = () => { clock.set(2026, 11, 6, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const SP = 'sample_place';
const sample = () => C.PLACES[SP];

// ---------- every place's data ----------
test('every place: what it names exists (items, icons, animals, foods, skills), medal codes are its own, the cave is whole', () => {
  const placeKinds = new Set();
  C.PLACE_ORDER.forEach((id) => {
    const p = C.PLACES[id];
    assert.ok(p.name && p.map && typeof p.unlock === 'number', id);
    assert.ok(C.WILD.areas[id], id + ' is a wild place');
    assert.strictEqual(L.isWildMap(p.map), true, id);
    p.kinds.forEach((k) => assert.ok(C.WILD.animals[k], id + ': ' + k));
    const item = (x, what) => assert.ok(C.ITEMS[x] && Number.isInteger(C.ITEMS[x].icon), id + ': ' + what + ' ' + x);
    p.kinds.forEach((k) => C.WILD.animals[k].drops.forEach((d) => item(d[0], k + ' drops')));
    if (p.legacy) return;
    Object.keys(p.creatures || {}).forEach((k) => placeKinds.add(k));
    Object.keys(p.items || {}).forEach((x) => item(x, 'item'));
    (p.chestLoot || []).forEach((d) => item(d[0], 'chest'));
    assert.ok(p.chests.every((c) => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger)), id + ': chests are tiles');
    assert.ok(p.chests.length <= 30, id + ': chests fit one saved number');
    if (p.tame) {
      assert.ok(C.WILD.animals[p.tame.kind] && C.WILD.animals[p.tame.kind].tameOnly, id + ': the tame');
      item(p.tame.food, 'tame food');
      assert.ok(C.COMPANION_SKILLS[p.tame.skill], id + ': skill');
      assert.ok(p.tame.feedings >= 2 && p.tame.runOff >= 0 && p.tame.runOff < 1, id + ': taming is not too hard');
    }
    if (p.gear) C.GEAR_SLOTS.forEach((slot) => {
      const g = C.PLACE_GEAR[id + '_' + slot];
      assert.ok(g && g.gold > 0 && Number.isInteger(g.icon), id + ': ' + slot);
      g.needs.forEach((n) => item(n[0], slot + ' needs'));
    });
    if (p.npc) {
      assert.ok(p.npc.name && p.npc.at && p.npc.lines.length >= 1 && !p.npc.lines[0].need, id + ': the first line is open');
      assert.ok(p.npc.lines.length <= 6);
    }
    const d = p.dungeon;
    if (d) {
      assert.strictEqual(C.DUNGEONS[d.key], id);
      assert.strictEqual(L.isWildMap(d.key), true);
      [d.guard, d.boss].forEach((k) => assert.ok(!k || (C.WILD.animals[k] && C.WILD.animals[k].boss), id + ': ' + k));
      Object.keys(d.creatures).forEach((k) => placeKinds.add(k));
      Object.keys(d.creatures).forEach((k) => C.WILD.animals[k].drops.forEach((x) => item(x[0], k + ' drops')));
      (d.chest || []).forEach((x) => item(x[0], 'boss chest'));
      for (let f = 1; f <= d.floors; f++) assert.ok(L.dunRoster(d.key, f).length > 0, id + ' floor ' + f + ' has creatures');
      assert.strictEqual(L.dunRoster(d.key, d.bossFloor)[0].kind, d.boss);
      if (d.guard) assert.strictEqual(L.dunRoster(d.key, d.guardFloor)[0].kind, d.guard);
    }
  });
  placeKinds.forEach((k) => {
    const d = C.WILD.animals[k];
    assert.ok(d.place && C.WILD.more.includes(k) && !C.WILD.order.includes(k), k + ' is saved by name');
    assert.ok(d.sheet || C.WILD.order.includes(d.sheetRow), k + ': its own sheet, or a stand-in row');
  });
  const codes = C.MEDALS.map((m) => m.code);
  assert.strictEqual(new Set(codes).size, codes.length, 'every medal its own code');
  C.MEDALS.forEach((m) => assert.ok(Number.isInteger(m.icon) && m.icon >= 0 && m.title, m.id));
});

test('the item ids fixed for the five places (docs/places-items.json) are all good ids, new or one from before', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'places-items.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(j), ['banaue', 'bohol', 'taal', 'sierra', 'palawan']);
  Object.keys(j).forEach((p) => {
    assert.strictEqual(j[p].items.length, 16, p + ': a 4 x 4 icons sheet');
    j[p].items.forEach((x) => {
      assert.match(x.id, /^[a-z][a-z_]{0,23}$/, p + ': ' + x.id);
      // (one from before, used again; or this place's own, once its data file is in: owner, 6 Nov 2026)
      if (C.ITEMS[x.id]) assert.ok(!C.ITEMS[x.id].place || C.PLACES[C.ITEMS[x.id].place].name === j[p].name, x.id + ' is one from before (used again, not new), or ' + j[p].name + "'s own");
    });
  });
  // F.placeIcons appended only what was new, at the end, place after place, and kept the ones from before (Kaldereta);
  // calling it again adds nothing
  const first = C.ICON.chocolate_cake + 1, fresh16 = [].concat(...Object.keys(j).map((p) => j[p].items.map((x) => x.id))).filter((id) => C.ICON_ORDER.indexOf(id) >= first);
  assert.strictEqual(fresh16.length, 16 * 5 - 1, 'every new icon of the five, Kaldereta kept');
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(first)), fresh16, 'in the places\' order, nothing after them');
  assert.ok(C.ICON.kaldereta < first);
  const before = C.ICON_ORDER.length, ctx2 = { window: {}, console };
  vm.createContext(ctx2);
  fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx2));
  ctx2.window.Farm.placeIcons(j.bohol.items.map((x) => x.id));
  const C2 = ctx2.window.Farm.Config;
  assert.strictEqual(C2.ICON_ORDER.length, before);
  assert.strictEqual(C2.ICON.horn_goat, C.ICON.horn_goat);
});

test('the places from before are in the jeep list with their medals; a new place opens by hunts', () => {
  const s = fresh();
  // (the places from before; the new places, each opening by its own hunts, follow them in the list)
  const legacy = (l) => l.filter((p) => C.PLACES[p.id].legacy);
  const list = plain(L.jeepPlaces(s));
  assert.deepStrictEqual(legacy(list).map((p) => p.id), ['pulag', 'makiling', 'magayon']);
  assert.ok(!list.some((p) => p.id === SP), 'the sample place hides outside the tests');
  assert.deepStrictEqual(legacy(list).map((p) => p.open), [true, false, false]);
  s.wild.n = 40;
  assert.ok(legacy(L.jeepPlaces(s)).every((p) => p.open));
  ctx.window.gameHost.devPlaces = true;
  assert.ok(L.jeepPlaces(s).some((p) => p.id === SP), 'SAMPLE: shown to the tests');
  ctx.window.gameHost.devPlaces = false;
  // a place's unlock is its hunts (a pretend place 60, as Banaue will be)
  const p = sample(), was = p.unlock;
  C.WILD.areas[SP].unlock = 60;
  s.wild.n = 59;
  assert.strictEqual(L.placeOpen(s, SP), false);
  s.wild.n = 60;
  assert.strictEqual(L.placeOpen(s, SP), true);
  C.WILD.areas[SP].unlock = was;
  assert.ok(C.MEDAL_BY_CODE[302] && /Bakunawa/.test(C.MEDAL_BY_CODE[302].title), 'the Lair is Magayon\'s cave: its boss is a medal');
});

// ---------- gear ----------
test('gear: Head and Feet take 1 off a hit, Body and Charm 2, a whole set 2 more; only against its own place, never under a third of the hit (owner, 7 Nov)', () => {
  const s = fresh();
  s.gold = 10000;
  L.addItem(s, 'sample_hide', 9);
  L.addItem(s, 'sample_fang', 9);
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_hog'), 10);
  assert.strictEqual(L.makeGear(s, 'sample_place_head'), 'ok');
  assert.strictEqual(L.makeGear(s, 'sample_place_head'), 'owned', 'made once');
  assert.strictEqual(L.worn(s, 'head'), 'sample_place_head', 'on at once in a free slot');
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_hog'), 9);
  assert.strictEqual(L.chargeLoss(s, 10, 'boar'), 10, 'not against another place\'s creatures');
  L.makeGear(s, 'sample_place_body');
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_hog'), 7);
  L.makeGear(s, 'sample_place_feet');
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_hog'), 6);
  L.makeGear(s, 'sample_place_charm');
  assert.strictEqual(L.wornSet(s), SP);
  assert.strictEqual(L.chargeLoss(s, 20, 'sample_hog'), 12, '1 + 2 + 1 + 2, and 2 more for the whole set');
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_hog'), 4, 'but never under a third of the hit (10 - 8 would be 2)');
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_boss'), 4, 'its cave too');
  assert.strictEqual(L.chargeLoss(s, 10, 'boar'), 10, 'the places from before stay as they were');
  assert.strictEqual(L.chargeLoss(s, 2, 'sample_hog'), 1, 'never less than 1');
  assert.strictEqual(L.chargeLoss(s, 0, 'sample_hog'), 0);
  // a dish's power still halves it first; with the whole set on it never goes under the third either
  s.pw = Object.assign({}, s.pw);
  const realPower = L.power;
  L.power = (st, k) => k === 'charge' || realPower(st, k);
  try { assert.strictEqual(L.chargeLoss(s, 24, 'sample_hog'), 8, '24 / 2 = 12, - 8 = 4, a third of 24 is 8'); } finally { L.power = realPower; }
  L.takeOff(s, 'feet');
  assert.strictEqual(L.wornSet(s), null);
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_hog'), 5, 'no set: no bonus');
  // the old Hunter's gear: in its slot, its own effect; the Fire Charm and a set charm share a slot
  s.gold = 50000;
  L.addItem(s, 'ember_shard', 25);
  L.addItem(s, 'santelmo_flame', 3);
  assert.strictEqual(L.buyGear(s, 'charm'), 'ok');
  assert.strictEqual(L.worn(s, 'charm'), 'sample_place_charm', 'the slot was taken: the new charm waits');
  assert.strictEqual(L.wearsOld(s, 'charm'), false);
  assert.strictEqual(L.wear(s, 'g:charm'), 'ok');
  assert.strictEqual(L.chargeLoss(s, 10, 'boar'), 6, 'Makiling: 40% off; the sample place\'s hat and vest do nothing there');
  assert.strictEqual(L.chargeLoss(s, 10, 'sample_hog'), 7, 'a new place: no Fire Charm, but the hat and the vest (3)');
  assert.strictEqual(L.wear(s, 'sample_place_feet'), 'ok');
  assert.strictEqual(L.wear(s, 'nope_head'), 'none');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.gwear), { head: 'sample_place_head', body: 'sample_place_body', feet: 'sample_place_feet', charm: 'g:charm' });
  assert.deepStrictEqual(plain(back.gown).sort(), ['sample_place_body', 'sample_place_charm', 'sample_place_feet', 'sample_place_head']);
  assert.deepStrictEqual(plain(L.piecesFor(back, 'charm')), ['g:charm', 'sample_place_charm']);
});

test('gear: the cloak and the boots work only when worn; an old save keeps what it had on; friends see only what is worn', () => {
  const s = fresh();
  s.gold = 99999;
  L.buyGear(s, 'cloak');
  L.buyGear(s, 'quiver');
  assert.strictEqual(L.gearBits(s), 5, 'the cloak (worn) and the quiver');
  L.takeOff(s, 'body');
  assert.strictEqual(L.gearBits(s), 4, 'the cloak off: animals see you as before');
  assert.strictEqual(L.hasGear(s, 'cloak'), true, 'still yours');
  assert.strictEqual(roundTrip(s).gwear.body, '', 'kept off');
  const o = plain(L.serialize(s));
  delete o.gw; // a save from before the slots
  const old = L.deserialize(o);
  assert.strictEqual(old.gwear.body, 'g:cloak', 'what you had stays on');
  assert.strictEqual(L.gearBits(old), 5);
  o.gw = ['x', 'sample_place_body', 7, null]; // junk, and a piece not yours
  assert.deepStrictEqual(plain(L.deserialize(o).gwear), { head: '', body: '', feet: '', charm: '' });
});

// ---------- taming ----------
test('SAMPLE taming: fed while calm and close with its food; each feeding fills the meter; it can run off and come back; N tame it', () => {
  const s = fresh();
  const t = sample().tame;
  assert.strictEqual(L.feedTame(s, SP), 'food', 'no berries');
  L.addItem(s, 'berry', 10);
  s.sel = s.inv.findIndex((x) => x && x.id === 'berry');
  assert.strictEqual(L.canFeed(s, SP, 'idle', 1.4), true);
  assert.strictEqual(L.canFeed(s, SP, 'idle', 1.6), false, 'within 1.5 tiles');
  assert.strictEqual(L.canFeed(s, SP, 'flee', 1), false, 'calm');
  assert.strictEqual(L.canFeed(s, SP, 'charge', 1), false);
  assert.strictEqual(L.feedTame(s, SP, () => 0.9), 'fed');
  assert.strictEqual(L.tameHearts(s, SP), 1);
  assert.strictEqual(L.countItem(s, 'berry'), 9);
  assert.strictEqual(L.feedTame(s, SP, () => 0.1), 'ran', 'a 1 in 4 it runs off');
  assert.strictEqual(L.tameAway(s, SP), true);
  assert.strictEqual(L.feedTame(s, SP, () => 0.9), 'away');
  assert.ok(!L.wildHere(s, SP).some((e) => e.kind === t.kind), 'gone from the place');
  clock.advance(t.back + 1);
  assert.ok(L.wildHere(s, SP).some((e) => e.kind === t.kind), 'back later');
  assert.strictEqual(L.tameHearts(roundTrip(s), SP), 2, 'the meter is kept');
  assert.strictEqual(L.feedTame(s, SP, () => 0.1), 'tame', 'the last feeding never runs off');
  assert.strictEqual(L.tamed(s, SP), true);
  assert.strictEqual(L.companion(s), SP, 'the first one comes along at once');
  assert.ok(!L.wildHere(s, SP).some((e) => e.kind === t.kind), 'it walks with you now, not in the place');
  assert.strictEqual(L.feedTame(s, SP), 'tamed');
  const back = roundTrip(s);
  assert.strictEqual(L.tamed(back, SP), true);
  assert.strictEqual(L.companion(back), SP);
  assert.strictEqual(L.companionSkill(back), 'fetch');
  assert.strictEqual(L.setCompanion(back, ''), 'ok');
  assert.strictEqual(L.companion(roundTrip(back)), null, 'at the Lodge');
  assert.strictEqual(L.setCompanion(back, 'pulag'), 'no', 'only a tamed one');
  L.medalCheck(s);
  assert.ok(L.hasMedal(s, 9903), 'a medal for it');
});

// ---------- medals ----------
test('medals: earned from what you did, with the date; kept in the save; an old save gets what it earned before', () => {
  const s = fresh();
  assert.deepStrictEqual(plain(L.medalCheck(s)), []);
  const r = L.hunted(s, 'pulag', 0, 'rabbit', 1);
  assert.deepStrictEqual(plain(r.medals.map((m) => m.code)).sort(), [100, 112], 'first hunt in Pulag, and the rabbit');
  assert.strictEqual(s.medals[100], s.day);
  L.hunted(s, 'pulag', 1, 'rabbit', 1.3);
  assert.ok(L.hasMedal(s, 113), 'a giant rabbit');
  assert.strictEqual(L.hunted(s, 'pulag', 2, 'rabbit', 1).medals.length, 0, 'once each');
  clock.advance(60 * 30); // another day
  L.hunted(s, 'pulag', 3, 'labuyo', 1);
  const back = roundTrip(s);
  assert.strictEqual(back.medals[110], s.day);
  assert.strictEqual(back.medals[100], s.medals[100], 'the day it was earned');
  assert.ok(JSON.stringify(L.serialize(s).md).length < 60, 'small: code, day, ...');
  // an old save (no medals yet): what it did before gives them, dated today
  const o = plain(L.serialize(s));
  delete o.md;
  const old = L.deserialize(o);
  assert.ok([100, 110, 112, 113].every((c) => L.hasMedal(old, c)));
  o.md = [99999, 5, 'x', 3, 110];
  assert.ok(!L.deserialize(o).medals[99999], 'junk is dropped');
  // friends see them on your card
  const snap = plain(L.snapshot(s));
  assert.ok(Array.isArray(snap.md) && snap.md.includes(113));
  const seen = L.visitState(snap, s);
  assert.ok(L.hasMedal(seen, 113) && L.hasMedal(seen, 100));
  assert.ok(!L.visitState({ md: [1e9, 1, 'a', 2] }, s).medals[1e9]);
});

// ---------- the boss's chest ----------
test('SAMPLE the boss chest: once a day; missed days add up, to 3 waiting; opened all at once', () => {
  const s = fresh();
  const d = sample().dungeon;
  assert.strictEqual(L.hunted(s, d.key, 0, d.boss, 1).chests, 1, 'the first');
  assert.strictEqual(L.bossChests(s, SP), 1);
  assert.strictEqual(L.hunted(s, d.key, 0, d.boss, 1).chests, 0, 'not again today');
  assert.strictEqual(s.wild.gone[d.key + ':0'], undefined, 'no slot waits in a cave');
  clock.advance(60 * 24);
  s.day += 1;
  L.hunted(s, d.key, 0, d.boss, 1);
  assert.strictEqual(L.bossChests(s, SP), 2, 'stored');
  s.day += 5;
  L.hunted(s, d.key, 0, d.boss, 1);
  assert.strictEqual(L.bossChests(s, SP), 3, 'never more than 3');
  assert.strictEqual(L.bossChests(roundTrip(s), SP), 3, 'kept in the save');
  const loot = plain(L.openBossChests(s, SP, () => 0));
  assert.deepStrictEqual(loot, [['sample_fang', 6], ['arrows', 30]]);
  assert.strictEqual(L.bossChests(s, SP), 0);
  s.day += 1;
  L.hunted(s, d.key, 0, d.boss, 1);
  assert.strictEqual(L.bossChests(s, SP), 1, 'yesterday was had: one');
  assert.ok(L.hasMedal(s, 9902));
});

// ---------- exploring ----------
test('SAMPLE % explored: animals met, the hidden chest, the story, the guard and the boss', () => {
  const s = fresh();
  assert.strictEqual(L.placeExplored(s, SP).pct, 0);
  assert.deepStrictEqual(plain(L.placeExplored(s, SP).parts), { animals: [0, 2], chests: [0, 1], story: [0, 4], guard: [0, 1], boss: [0, 1] });
  L.hunted(s, SP, 0, 'sample_hog', 1);
  assert.strictEqual(L.placeExplored(s, SP).pct, 11, '1 of 9');
  assert.deepStrictEqual(plain(L.openPlaceChest(s, SP, 0, () => 0)), [['arrows', 5], ['sample_hide', 2]]);
  assert.strictEqual(L.openPlaceChest(s, SP, 0, () => 0), null, 'once');
  assert.strictEqual(L.openPlaceChest(s, SP, 7, () => 0), null);
  // the story: the lines open one after another as you go
  assert.deepStrictEqual(plain(L.talkNpc(s, SP)), { i: 1, text: sample().npc.lines[1].text, isNew: true, last: false });
  assert.strictEqual(L.talkNpc(s, SP).isNew, false);
  const d = sample().dungeon;
  L.hunted(s, d.key, 0, d.guard, 1);
  L.hunted(s, d.key, 0, d.boss, 1);
  assert.strictEqual(L.talkNpc(s, SP).i, 1, 'the tame line comes before the boss line');
  s.places[SP].tm = 1;
  assert.strictEqual(L.talkNpc(s, SP).i, 3);
  const e = L.placeExplored(roundTrip(s), SP);
  assert.deepStrictEqual(plain(e.parts), { animals: [2, 2], chests: [1, 1], story: [4, 4], guard: [1, 1], boss: [1, 1] });
  assert.strictEqual(e.pct, 100);
  assert.ok([9900, 9901, 9902, 9904, 9905, 9910].every((c) => L.hasMedal(L.medalCheck(s) && s, c)));
  // a place from before: its animals
  const t = fresh();
  L.hunted(t, 'pulag', 0, 'deer', 1);
  assert.strictEqual(L.placeExplored(t, 'pulag').pct, 25, '1 of its 4 (with the White Stag)');
});

// ---------- caves ----------
test('SAMPLE a cave: the guard leads its floor, the boss its own; the boss has more for each friend; the lift; the deepest floor', () => {
  const d = sample().dungeon;
  assert.deepStrictEqual(plain(L.dunRoster(d.key, 1).map((e) => e.kind)), ['sample_guard', 'sample_bat', 'sample_bat']);
  assert.deepStrictEqual(plain(L.dunRoster(d.key, 2).map((e) => e.kind)), ['sample_boss', 'sample_bat', 'sample_bat']);
  assert.deepStrictEqual(plain(L.dunRoster(d.key, 9)), plain(L.dunRoster(d.key, 2)), 'past the bottom is the bottom');
  assert.strictEqual(L.dunHp('sample_boss', 1), 6, 'soloable');
  assert.strictEqual(L.dunHp('sample_boss', 3), 14, '4 more for each friend');
  assert.strictEqual(L.dunHp('sample_bat', 3), 1);
  const s = fresh();
  assert.deepStrictEqual(plain(L.dunStops(s, d.key)), [1]);
  assert.strictEqual(L.dunReach(s, d.key, 2), true);
  assert.strictEqual(L.dunReach(s, d.key, 1), false);
  assert.deepStrictEqual(plain(L.dunStops(roundTrip(s), d.key)), [1, 2]);
  assert.strictEqual(L.isPlaceDungeon('lair'), false, 'the Lair keeps its own rules');
  assert.strictEqual(L.placeOf('lair'), 'magayon');
});

test('SAMPLE the save: on a place\'s map it opens there; in its cave, at the cave door; a place no longer in the game opens by the jeep', () => {
  const s = fresh();
  s.map = SP;
  s.player = { x: 900, y: 700, dir: 'left' };
  let back = roundTrip(s);
  assert.strictEqual(back.map, SP);
  assert.strictEqual(back.player.x, 900);
  s.map = 'sample_cave';
  back = roundTrip(s);
  assert.strictEqual(back.map, SP);
  assert.strictEqual(back.player.spawn, 'from_dungeon');
  const o = plain(L.serialize(s));
  o.pm = 'gone_place';
  back = L.deserialize(o);
  assert.deepStrictEqual([back.map, back.player.spawn], ['pulag', 'from_jeep']);
  // place creatures are saved by name, never in the list saved by index
  const t = fresh();
  L.hunted(t, SP, 0, 'sample_hog', 1.2);
  const ot = plain(L.serialize(t));
  assert.strictEqual(ot.wl[2].length, C.PLACE_BASE.kinds, 'the old list keeps its length');
  assert.deepStrictEqual(ot.pk.sample_hog, [1, 600]);
  assert.strictEqual(roundTrip(t).wild.by.sample_hog, 1);
  assert.ok(Array.isArray(ot.pg) && ot.pg[0][0] === SP, 'its slot waits, by the place\'s name');
  assert.ok(roundTrip(t).wild.gone[SP + ':0'] > 0);
  assert.ok(ot.wl[3].every((g) => g[0] < C.PLACE_BASE.areas));
  // a friend's phone hears a place creature by its own number
  const row = L.wildPack({ slot: 2, kind: 'sample_boss', x: 100, y: 200, dir: 'side', left: true, mode: 'charge', hp: 13, size: 1, max: 14 });
  assert.ok(row[1] >= 1000);
  const a = L.wildUnpack(JSON.parse(JSON.stringify(row)));
  assert.deepStrictEqual([a.kind, a.hp, a.max, a.mode], ['sample_boss', 13, 14, 'charge'], 'its strength for the crew comes through');
  assert.strictEqual(L.wildUnpack([1, 1999, 0, 0, 0, 0, 0, 1, 100, 0]), null);
});

test('the save stays small with every place full', () => {
  const s = fresh();
  C.PLACE_ORDER.forEach((id) => { const r = L.placeRec(s, id); Object.assign(r, { n: 9999, ch: 31, st: 4, t: 9, tm: 1, ta: 1e9, g: 1, b: 999, dl: 20000, bc: 3, deep: 10 }); });
  C.MEDALS.forEach((m) => { s.medals[m.code] = 20400; });
  const size = JSON.stringify(L.serialize(s)).length;
  assert.ok(size < 16000, size + ' bytes');
});

// ---------- the server knows every place (part 23, owner 7 Nov 2026) ----------
test('part 23: its rows are the game\'s own (tools/places/server-rows.js): every new place\'s map, animals and boss', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_online_23.sql'), 'utf8');
  const made = require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'places', 'server-rows.js')], { encoding: 'utf8' });
  assert.ok(sql.includes(made.trim()), 'the SQL carries exactly what the tool prints (rerun it when a place changes)');
  const news = C.PLACE_ORDER.filter((id) => !C.PLACES[id].legacy && !C.PLACES[id].dev);
  news.forEach((id) => {
    assert.ok(sql.includes("('" + C.PLACES[id].map + "')"), id + ': Hunting now');
    C.PLACES[id].kinds.forEach((k) => assert.ok(sql.includes("('" + k + "', " + C.WILD.animals[k].kg + ')'), id + ': ' + k));
    assert.ok(sql.includes("('" + id + "_boss'"), id + ': its boss in the Hall');
    assert.ok(C.HALL.FIRSTS.some((f) => f.key === id + '_boss' && f.map === C.PLACES[id].dungeon.key && f.kind === C.PLACES[id].dungeon.boss), id + ': and in the game');
  });
  assert.deepStrictEqual(plain(C.HALL.spots.w8.keys), plain(news.map((id) => id + '_boss')), 'all on one plaque');
});

// Unit tests for the Wild Lands (owner, 30 Oct 2026): who roams where and when, hunts and their drops, Makiling
// opening after 10 hunts, the Bow and its upgrades, arrows, Kanor's shop, cooking the meat, and the save.
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
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const kinds = (list) => plain(list.map((e) => e.kind));
const fresh = () => { const s = L.newState(); s.seed = 11; return s; };

test('the places and who roams there: wolves only at night', () => {
  const s = L.newState();
  assert.deepStrictEqual(kinds(L.wildSlots('pulag').filter((e) => !e.when)), ['labuyo', 'labuyo', 'labuyo', 'rabbit', 'rabbit', 'rabbit', 'deer', 'deer']);
  s.time = 10 * 60;
  assert.deepStrictEqual(kinds(L.wildHere(s, 'makiling').filter((e) => !e.when)), ['deer', 'deer', 'boar', 'boar', 'boar']);
  s.time = 21 * 60;
  assert.deepStrictEqual(kinds(L.wildHere(s, 'makiling')).filter((k) => k === 'wolf'), ['wolf', 'wolf']);
  s.time = 3 * 60;
  assert.ok(L.isNight(s));
  assert.ok(L.isWildMap('pulag') && L.isWildMap('makiling') && !L.isWildMap('town'));
});

test('a hunted animal is gone for a few minutes, then back; Makiling opens on the 10th hunt', () => {
  const s = L.newState();
  s.time = 10 * 60;
  assert.strictEqual(L.wildOpen(s, 'pulag'), true);
  assert.strictEqual(L.wildOpen(s, 'makiling'), false);
  assert.strictEqual(L.hunted(s, 'pulag', 6, 'deer').opened, null);
  const plainOnes = () => L.wildHere(s, 'pulag').filter((e) => !e.when);
  assert.deepStrictEqual(kinds(plainOnes()).filter((k) => k === 'deer'), ['deer']);
  clock.advance(C.WILD.respawn - 1);
  assert.strictEqual(plainOnes().length, 7);
  clock.advance(2);
  assert.strictEqual(plainOnes().length, 8, 'back');
  for (let i = 0; i < 8; i++) L.hunted(s, 'pulag', 0, 'labuyo');
  assert.strictEqual(L.hunted(s, 'pulag', 1, 'labuyo').opened, 'makiling');
  assert.strictEqual(L.wildOpen(s, 'makiling'), true);
  assert.strictEqual(s.wild.by.labuyo, 9);
  assert.strictEqual(s.wild.by.deer, 1);
});

test('what an animal leaves: always its meat (or pelt), sometimes more', () => {
  assert.deepStrictEqual(plain(L.huntDrops('deer', () => 0.99)), [['venison', 2]]);
  assert.deepStrictEqual(plain(L.huntDrops('deer', () => 0.1)), [['venison', 2], ['antler', 1]]);
  assert.deepStrictEqual(plain(L.huntDrops('wolf', () => 0.99)), [['pelt_wolf', 1]]);
  C.WILD.order.forEach((k) => C.WILD.animals[k].drops.forEach((d) => assert.ok(C.ITEMS[d[0]] && C.ITEMS[d[0]].sell > 0, d[0])));
});

test('the Bow: buy it once, upgrade it with gold and ore, shoot with arrows and energy', () => {
  const s = L.newState();
  s.gold = 500;
  assert.strictEqual(L.buyBow(s), 'gold');
  s.gold = 100000;
  assert.strictEqual(L.buyBow(s), 'ok');
  assert.strictEqual(L.buyBow(s), 'have');
  assert.strictEqual(L.bowRange(s), 3);
  assert.strictEqual(L.shoot(s), 'arrows');
  assert.strictEqual(L.buyWild(s, 'arrows'), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 10);
  s.energy = 1;
  assert.strictEqual(L.shoot(s), 'tired');
  s.energy = 50;
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 9);
  assert.strictEqual(s.energy, 48);
  assert.strictEqual(L.upgradeBow(s), 'ore');
  L.addItem(s, 'ore_copper', 5);
  assert.strictEqual(L.upgradeBow(s), 'ok');
  assert.strictEqual(L.countItem(s, 'ore_copper'), 0);
  assert.strictEqual(L.itemName(s, 'bow'), 'Copper Bow');
  assert.strictEqual(L.iconOf(s, 'bow'), C.ICON.bow_1);
  assert.strictEqual(L.bowRange(s), 4);
  L.addItem(s, 'ore_silver', 5);
  L.upgradeBow(s);
  assert.strictEqual(L.bowDamage(s), 2);
  L.addItem(s, 'ore_gold', 5);
  assert.strictEqual(L.upgradeBow(s), 'ok');
  assert.strictEqual(L.upgradeBow(s), 'max');
  assert.ok(!C.TOOL_KEYS.includes('bow'), 'the forge never upgrades it');
});

test('Kanor buys what you hunt; the meat cooks into the new dishes', () => {
  const s = L.newState();
  L.addItem(s, 'venison', 3);
  L.addItem(s, 'pelt_wolf', 1);
  L.addItem(s, 'turnip', 4);
  assert.deepStrictEqual(plain(L.wildGoods(s)), ['venison', 'pelt_wolf']);
  const g = s.gold;
  assert.strictEqual(L.sellToKanor(s, 'venison'), 135);
  assert.strictEqual(s.gold, g + 135);
  assert.strictEqual(L.countItem(s, 'venison'), 0);
  ['tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw'].forEach((d) => {
    const r = C.RECIPES.find((x) => x.dish === d);
    assert.ok(r && C.ITEMS[d].energy > 40, d);
    r.needs.forEach((n) => assert.ok(C.ITEMS[n] || C.FOOD_GROUPS[n], d + ' needs ' + n));
  });
  s.builds.kitchen = 1;
  L.addItem(s, 'meat_boar', 1);
  L.addItem(s, 'onion', 1);
  assert.strictEqual(L.cook(s, C.RECIPES.find((x) => x.dish === 'inihaw')), 'ok', 'any meat for inihaw');
  assert.strictEqual(L.countItem(s, 'inihaw'), 1);
});

test('saved: hunts, the bow and its level, animals still away; older saves start fresh', () => {
  const s = L.newState();
  s.gold = 1e6;
  L.buyBow(s);
  L.addItem(s, 'ore_copper', 5);
  L.upgradeBow(s);
  L.hunted(s, 'makiling', 3, 'boar');
  s.map = 'pulag';
  const b = roundTrip(s);
  assert.strictEqual(b.wild.n, 1);
  assert.strictEqual(b.wild.by.boar, 1);
  assert.strictEqual(L.bowLevel(b), 1);
  assert.strictEqual(b.map, 'pulag');
  assert.strictEqual(L.wildHere(b, 'makiling').filter((e) => e.slot === 3).length, 0, 'still away');
  // the wait goes on while the game is closed (it used to stop, and restart on opening)
  const saved = plain(L.serialize(s));
  clock.advance(C.WILD.respawn + 1);
  assert.strictEqual(L.wildHere(L.deserialize(saved), 'makiling').filter((e) => e.slot === 3).length, 1, 'back after time away');
  const old = plain(L.serialize(L.newState()));
  delete old.wl;
  const o = L.deserialize(old);
  assert.deepStrictEqual(plain(o.wild), { n: 0, by: {}, gone: {}, job: 0, best: {} });
  assert.ok(!L.hasBow(o));
});

test('who comes out changes with the hour, the rain and the season; slots stay in place for old saves', () => {
  const s = L.newState();
  const count = (area, kind) => L.wildHere(s, area).filter((e) => e.kind === kind).length;
  assert.deepStrictEqual(plain(L.wildSlots('pulag').slice(0, 8).map((e) => e.slot)), [0, 1, 2, 3, 4, 5, 6, 7], 'the first eight are the old ones');
  s.time = 10 * 60;
  const noon = count('pulag', 'rabbit');
  s.time = 6 * 60;
  assert.strictEqual(count('pulag', 'rabbit'), noon + 2, 'dawn: more rabbits');
  s.time = 18 * 60;
  assert.strictEqual(L.wildWhen(s, 'pulag', 'dusk'), true);
  s.time = 10 * 60;
  const dry = count('makiling', 'boar');
  const weather = L.weather;
  L.weather = () => 'rain';
  assert.strictEqual(count('makiling', 'boar'), dry + 2, 'rain: more boars');
  assert.ok(L.wildNews(s).some((x) => /Rain/.test(x)));
  L.weather = weather;
  const date = L.date;
  L.date = (d) => Object.assign({}, date(d), { key: 'fall' });
  assert.strictEqual(count('makiling', 'boar'), dry + 1, 'fall: one more boar');
  L.date = date;
});

test('a rare animal is about some of the time, the same for everyone, and it takes 2 hours to come back', () => {
  const s = L.newState();
  s.time = 10 * 60;
  let on = 0;
  for (let d = 1; d <= 400; d++) { s.day = d; for (let b = 0; b < 12; b++) { s.time = b * 120; if (L.wildRare(s, 'pulag')) on++; } }
  assert.ok(on > 4800 * 0.06 && on < 4800 * 0.14, 'about 1 in 10: ' + on);
  const other = L.newState();
  other.seed = 777; other.day = s.day; other.time = s.time;
  assert.strictEqual(L.wildRare(other, 'pulag'), L.wildRare(s, 'pulag'), 'not by player');
  const rare = L.wildRare;
  L.wildRare = () => true;
  s.time = 10 * 60;
  const slot = L.wildSlots('pulag').find((e) => e.kind === 'whitedeer').slot;
  assert.ok(L.wildHere(s, 'pulag').some((e) => e.kind === 'whitedeer'));
  L.hunted(s, 'pulag', slot, 'whitedeer', 1);
  clock.advance(100);
  assert.ok(!L.wildHere(s, 'pulag').some((e) => e.kind === 'whitedeer'), 'still gone');
  const b = roundTrip(s);
  assert.ok(!L.wildHere(b, 'pulag').some((e) => e.kind === 'whitedeer'), 'still gone after a reload');
  clock.advance(25);
  assert.ok(L.wildHere(s, 'pulag').some((e) => e.kind === 'whitedeer'), 'back');
  L.wildRare = rare;
  assert.deepStrictEqual(plain(L.huntDrops('whitedeer', () => 0.99)), [['venison', 3], ['white_antler', 1]]);
  assert.deepStrictEqual(plain(L.huntDrops('goldboar', () => 0.99)), [['meat_boar', 3], ['gold_tusk', 1]]);
});

test('every animal has a size: giants are rare, the biggest goes in the book, and friends can see it', () => {
  let giants = 0, i = 0;
  const seq = (n) => () => { i = (i * 16807 + 11) % 2147483647; return i / 2147483647; };
  const rnd = seq();
  for (let k = 0; k < 4000; k++) {
    const size = L.wildSize(rnd);
    assert.ok(size >= 0.9 && size <= 1.35, String(size));
    if (L.wildGiant(size)) giants++;
  }
  assert.ok(giants > 200 && giants < 480, 'about 1 in 12: ' + giants);
  const s = L.newState();
  assert.strictEqual(L.hunted(s, 'pulag', 6, 'deer', 1).record, false, 'the first is not a record yet');
  assert.strictEqual(s.wild.best.deer, 600);
  assert.strictEqual(L.hunted(s, 'pulag', 7, 'deer', 0.9).record, false);
  const big = L.hunted(s, 'pulag', 7, 'deer', 1.4);
  assert.strictEqual(big.record, true);
  assert.strictEqual(big.kg, 84);
  assert.strictEqual(roundTrip(s).wild.best.deer, 840);
  const snap = plain(L.snapshot(s));
  const seen = L.visitState(snap, L.newState());
  assert.strictEqual(seen.wild.best.deer, 840);
  assert.strictEqual(seen.wild.by.deer, 3);
  const bad = L.visitState(Object.assign({}, snap, { hb: [['x'], [-5, 'y']] }), L.newState());
  assert.ok(bad.wild.best.rabbit === 0 && !bad.wild.by.deer, 'an odd snapshot is ignored');
  assert.ok(JSON.stringify(snap).length < 16 * 1024);
});

test("Kanor's request: one a day, it pays well, it needs the real goods; Makiling's only once it is open", () => {
  const s = L.newState();
  s.gold = 0;
  s.wild.n = 0;
  const seen = new Set();
  for (let d = 1; d <= 300; d++) { s.day = d; seen.add(L.wildJob(s).item); }
  assert.ok(![...seen].some((id) => ['meat_boar', 'tusk', 'pelt_wolf', 'fang_wolf'].includes(id)), 'not before Makiling');
  assert.ok(seen.size >= 5);
  s.wild.n = 10;
  s.day = 5;
  for (let d = 1; d <= 300; d++) { s.day = d; seen.add(L.wildJob(s).item); }
  assert.ok(seen.has('pelt_wolf'));
  s.day = 40;
  const j = L.wildJob(s);
  assert.ok(j.gold >= C.ITEMS[j.item].sell * j.n * 2, 'it pays more than selling');
  assert.strictEqual(L.doWildJob(s), 'short');
  L.addItem(s, j.item, j.n);
  assert.strictEqual(L.doWildJob(s), 'ok');
  assert.strictEqual(s.gold, j.gold);
  assert.strictEqual(L.countItem(s, j.item), 0);
  assert.strictEqual(L.doWildJob(s), 'done');
  assert.strictEqual(roundTrip(s).wild.job, 40);
  s.day = 41;
  assert.strictEqual(L.wildJob(s).done, false, 'a new one tomorrow');
});

test('trophies: made from rare drops, into furniture storage, and never for sale', () => {
  const s = L.newState();
  s.gold = 5000;
  assert.strictEqual(L.makeTrophy(s, 0), 'short');
  L.addItem(s, 'antler', 3);
  s.gold = 100;
  assert.strictEqual(L.makeTrophy(s, 0), 'gold');
  s.gold = 5000;
  assert.strictEqual(L.makeTrophy(s, 0), 'ok');
  assert.strictEqual(s.gold, 4500);
  assert.strictEqual(L.countItem(s, 'antler'), 0);
  const t = C.HOME.typeIndex.trophy_antler;
  assert.strictEqual(s.home.bag[L.furnKey(t, 0)], 1);
  assert.strictEqual(roundTrip(s).home.bag[L.furnKey(t, 0)], 1);
  assert.strictEqual(L.buyFurn(s, t, 0), 'bad', 'not sold');
  C.WILD.trophies.forEach((x) => {
    assert.ok(C.HOME.types[C.HOME.typeIndex[x.type]].trophy, x.type);
    x.needs.forEach((n) => assert.ok(C.ITEMS[n[0]], n[0]));
  });
  for (let d = 1; d < 400; d++) { s.day = d; L.wagonDeals(s).forEach((w) => assert.ok(!C.HOME.types[w.t].trophy)); }
  assert.ok(!C.HOME.types[L.swapPiece(s, 'furniture').t].trophy);
});

test('Magayon Peaks: open after 40 hunts, its big animals, its drops and dishes', () => {
  const s = L.newState();
  s.time = 10 * 60;
  assert.deepStrictEqual(kinds(L.wildHere(s, 'magayon')).sort(), ['bear', 'bear', 'bear', 'mammoth', 'rhino', 'rhino', 'tiger', 'tiger']);
  assert.ok(L.isWildMap('magayon'));
  assert.strictEqual(L.wildNext(s), 'makiling');
  s.wild.n = 9;
  assert.strictEqual(L.hunted(s, 'pulag', 0, 'deer').opened, 'makiling');
  assert.strictEqual(L.wildNext(s), 'magayon');
  assert.strictEqual(L.wildOpen(s, 'magayon'), false);
  s.wild.n = 39;
  assert.strictEqual(L.hunted(s, 'pulag', 0, 'deer').opened, 'magayon');
  assert.strictEqual(L.wildOpen(s, 'magayon'), true);
  assert.strictEqual(L.wildNext(s), null);
  assert.strictEqual(L.hunted(s, 'pulag', 0, 'deer').opened, null);
  ['bear', 'mammoth', 'tiger', 'rhino'].forEach((k) => {
    const def = C.WILD.animals[k];
    assert.ok(C.WILD.order.includes(k) && def.angry && def.hit && def.hp >= 5 && def.ground, k);
    def.drops.forEach((d) => assert.ok(C.ITEMS[d[0]] && C.ITEMS[d[0]].sell > 0, d[0]));
  });
  // Magayon's goods only asked for once it is open
  const t = L.newState();
  t.wild.n = 39;
  const asked = new Set();
  for (let d = 1; d <= 400; d++) { t.day = d; asked.add(L.wildJob(t).item); }
  assert.ok(!asked.has('pelt_tiger'));
  t.wild.n = 40;
  for (let d = 1; d <= 400; d++) { t.day = d; asked.add(L.wildJob(t).item); }
  assert.ok(asked.has('pelt_tiger'));
  // the dishes cook, and a saved record of the new animals comes back
  t.builds.kitchen = 1;
  ['meat_mammoth', 'onion', 'rice'].forEach((id) => L.addItem(t, id, 1));
  assert.strictEqual(L.cook(t, C.RECIPES.find((x) => x.dish === 'bistek')), 'ok');
  L.hunted(t, 'magayon', 7, 'mammoth', 1.2);
  assert.strictEqual(roundTrip(t).wild.best.mammoth, 48000);
  assert.strictEqual(roundTrip(t).map, t.map);
  t.map = 'magayon';
  assert.strictEqual(roundTrip(t).map, 'magayon');
});

test('the new icons went at the very end, so no older icon moved in the items sheet', () => {
  const n = C.ICON_ORDER.length;
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(n - 16, n - 4)), ['meat_bear', 'fur_bear', 'claw_bear', 'meat_mammoth', 'wool_mammoth', 'tusk_mammoth', 'pelt_tiger', 'claw_tiger', 'hide_rhino', 'horn_rhino', 'kaldereta', 'bistek']);
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(n - 4)), ['leather_soft', 'leather_thick', 'leather_tough', 'great_tusk']);
  assert.strictEqual(C.ICON.wheat, 211);
});

test('every wild map: all its open ground can be walked to from the way in, and each way out is there', () => {
  const { TILES, PROPS } = require('../tools/tiles');
  ['pulag', 'makiling', 'magayon'].forEach((name) => {
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', name + '.json'), 'utf8'));
    const W = m.width, H = m.height, S = 256, solid = new Set();
    const walls = m.layers.find((l) => l.name === 'Walls').data;
    walls.forEach((g, i) => { if (g) solid.add(i); });
    const objs = m.layers.filter((l) => l.type === 'objectgroup').flatMap((l) => l.objects);
    objs.filter((o) => o.type === 'prop').forEach((o) => {
      const p = PROPS[o.name], left = o.x / S, bottom = o.y / S;
      for (let y = bottom - (p.foot || 0); y < bottom; y++) for (let x = left; x < left + p.w; x++) solid.add(y * W + x);
    });
    const warps = objs.filter((o) => o.type === 'warp'), spawn = objs.find((o) => o.type === 'spawn');
    const start = Math.floor(spawn.y / S) * W + Math.floor(spawn.x / S);
    const seen = new Set([start]), q = [start];
    while (q.length) {
      const k = q.pop(), x = k % W;
      [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W].forEach((o) => {
        if (o >= 0 && o < W * H && !seen.has(o) && !solid.has(o)) { seen.add(o); q.push(o); }
      });
    }
    warps.forEach((o) => assert.ok(seen.has(Math.floor(o.y / S) * W + Math.floor(o.x / S)), name + ': the way to ' + plain(o.properties).find((p) => p.name === 'to').value));
    const z = objs.find((o) => o.type === 'wild');
    let open = 0, cut = 0;
    for (let y = z.y / S; y < (z.y + z.height) / S; y++) for (let x = z.x / S; x < (z.x + z.width) / S; x++) {
      const k = y * W + x;
      if (solid.has(k)) continue;
      open++;
      if (!seen.has(k)) cut++;
    }
    assert.ok(open > 300 && cut <= 4, name + ': ' + cut + ' of ' + open + ' tiles cut off');
  });
});


test('hunting with friends: whoever came first runs the hunt, and every phone works out the same answer', () => {
  const list = [{ id: 'b', sn: 200 }, { id: 'a', sn: 300 }, { id: 'c', sn: 100 }];
  assert.strictEqual(L.wildLead(list), 'c');
  assert.strictEqual(L.wildLead(list.slice().reverse()), 'c');
  assert.strictEqual(L.wildLead([{ id: 'b', sn: 100 }, { id: 'a', sn: 100 }]), 'a', 'a tie');
  assert.strictEqual(L.wildLead([{ id: 'old', sn: 0 }, { id: 'me', sn: 500 }]), 'me', 'someone from before this update cannot run it');
  assert.strictEqual(L.wildLead([]), null);
});

test('hunting with friends: an animal survives the trip, and junk off the channel is dropped', () => {
  const a = { slot: 3, kind: 'deer', x: 1234.6, y: 88.2, dir: 'side', left: true, mode: 'flee', hp: 2, size: 1.27, look: true };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.wildUnpack(JSON.parse(JSON.stringify(L.wildPack(a)))))),
    { slot: 3, kind: 'deer', x: 1235, y: 88, dir: 'side', left: true, mode: 'flee', hp: 2, size: 1.27, look: true, max: 2 });
  const good = L.wildPack(a);
  [null, 'x', [], good.slice(0, 5), good.map((v, i) => (i === 1 ? 99 : v)), good.map((v, i) => (i === 0 ? -1 : v)), good.map((v, i) => (i === 0 ? 1.5 : v)),
    good.map((v, i) => (i === 4 ? 9 : v)), good.map((v, i) => (i === 6 ? 9 : v)), good.map((v, i) => (i === 2 ? 'x' : v)), good.map((v, i) => (i === 3 ? null : v))]
    .forEach((bad) => assert.strictEqual(L.wildUnpack(bad), null, JSON.stringify(bad)));
  const wild = L.wildUnpack(good.map((v, i) => (i === 2 ? 1e12 : i === 7 ? 999 : i === 8 ? 9000 : v)));
  assert.ok(wild.x <= 400 * C.TILE);
  assert.strictEqual(wild.hp, C.WILD.animals.deer.hp);
  assert.strictEqual(wild.size, 2);
});

test('the Tannery: a workshop that turns furs and hides into leather, for sale at the Market too', () => {
  assert.deepStrictEqual(plain(C.WORKSHOPS.tannery.recipes.map((r) => [r.out, r.mins, r.needs])), [
    ['leather_soft', 45, [['fur_rabbit', 3]]], ['leather_thick', 60, [['pelt_wolf', 1]]], ['leather_tough', 90, [['hide_rhino', 1]]]]);
  assert.strictEqual(C.OUTDOOR.types[C.OUTDOOR.index.tannery].price, 5000);
  ['leather_soft', 'leather_thick', 'leather_tough', 'great_tusk', 'tusk', 'wool_mammoth'].forEach((id) => assert.ok(L.marketable(id), id));
  const s = fresh(), ix = C.OUTDOOR.index, FARM = L.farmInfo(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8')));
  s.gold = 9000;
  assert.strictEqual(L.buyYard(s, ix.tannery, 1), 'ok');
  assert.strictEqual(L.buyYard(s, ix.tannery, 1), 'have', 'one Tannery');
  assert.strictEqual(typeof L.placeYard(s, FARM, ix.tannery, 25, 14), 'number');
  L.addItem(s, 'fur_rabbit', 3);
  assert.strictEqual(L.startJob(s, 'tannery', 0), 'ok');
  assert.strictEqual(L.countItem(s, 'fur_rabbit'), 0);
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.strictEqual(L.startJob(back, 'tannery', 0), 'missing', 'the job came through the save, and there is no more fur');
});

test('the top upgrades need what you hunt: Gold tools, the last bags, the top houses; nothing before them', () => {
  const s = fresh();
  s.gold = 1e7; s.lumber = 9999; s.stone = 9999;
  L.addItem(s, 'ore_copper', 5); L.addItem(s, 'ore_silver', 5); L.addItem(s, 'ore_gold', 5);
  assert.strictEqual(L.upgradeTool(s, 'hoe'), 'ok', 'Copper as before');
  assert.strictEqual(L.upgradeTool(s, 'hoe'), 'ok', 'Silver as before');
  assert.strictEqual(L.upgradeTool(s, 'hoe'), 'needs', 'Gold wants tusks');
  assert.strictEqual(L.countItem(s, 'ore_gold'), 5, 'nothing was taken');
  L.addItem(s, 'tusk', 3);
  assert.strictEqual(L.upgradeTool(s, 'hoe'), 'ok');
  assert.strictEqual(L.countItem(s, 'tusk'), 1);
  const levels = C.HOME.levels;
  assert.deepStrictEqual(plain(levels.filter((l) => l.needs).map((l) => [l.name, l.needs])), [['Villa', [['leather_thick', 10]]], ['Estate', [['wool_mammoth', 10]]], ['Mansion', [['tusk_mammoth', 5]]]]);
  s.home.level = levels.findIndex((l) => l.name === 'Villa');
  assert.strictEqual(L.startHomeUpgrade(s), 'needs');
  assert.ok(!s.project);
  L.addItem(s, 'leather_thick', 10);
  assert.strictEqual(L.startHomeUpgrade(s), 'ok');
  assert.strictEqual(L.countItem(s, 'leather_thick'), 0);
});

test('dishes with a power: 10 minutes, one at a time, and a full stomach still takes one', () => {
  const s = fresh();
  L.addItem(s, 'bistek', 1); L.addItem(s, 'venison_tapa', 1); L.addItem(s, 'kaldereta', 1); L.addItem(s, 'inihaw', 1);
  const slot = (id) => s.inv.findIndex((x) => x && x.id === id);
  s.energy = L.maxEnergy(s);
  const full = L.toolEnergy(s, 'axe', 10), mine = L.mineEnergy(s, 30), range = L.bowRange(s);
  assert.strictEqual(L.eat(s, slot('bistek')), -2, 'no energy to add, the power is on');
  assert.ok(L.power(s, 'walk'));
  assert.strictEqual(L.countItem(s, 'bistek'), 0);
  s.energy = 10;
  assert.ok(L.eat(s, slot('venison_tapa')) > 0);
  assert.ok(!L.power(s, 'walk'), 'the newest replaces the last');
  assert.ok(L.toolEnergy(s, 'axe', 10) < full);
  L.eat(s, slot('kaldereta'));
  assert.ok(L.mineEnergy(s, 30) < mine);
  L.eat(s, slot('inihaw'));
  assert.strictEqual(L.bowRange(s), range + 1);
  assert.strictEqual(L.powerLeft(s), 10);
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.ok(L.power(back, 'bow'), 'kept in the save');
  s.dp.until = L.nowMin() - 1;
  assert.ok(!L.power(s, 'bow'), 'and it runs out');
  L.addItem(s, 'carrot', 1);
  s.energy = 10;
  assert.ok(L.eat(s, slot('carrot')) > 0, 'other food is as it was');
  s.energy = L.maxEnergy(s);
  L.addItem(s, 'carrot', 1);
  assert.strictEqual(L.eat(s, slot('carrot')), -1);
});

test('the Great Mammoth: at weekends, one Great Tusk a week each, 3 make the trophy', () => {
  const s = fresh();
  s.wild.n = 50;
  const slots = L.wildSlots('magayon').filter((e) => e.kind === 'greatmammoth');
  assert.strictEqual(slots.length, 1);
  const here = () => L.wildHere(s, 'magayon').some((e) => e.kind === 'greatmammoth');
  const week = L.weekendMarket;
  L.weekendMarket = () => false;
  assert.ok(!here());
  L.weekendMarket = () => true;
  assert.ok(here());
  L.weekendMarket = week;
  assert.ok(L.greatTusk(s));
  assert.ok(!L.greatTusk(s), 'once a week');
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.ok(!L.greatTusk(back), 'kept in the save');
  assert.strictEqual(C.WILD.animals.greatmammoth.minHits, 3);
  assert.deepStrictEqual(plain(C.WILD.trophies[C.WILD.trophies.length - 1]), { type: 'trophy_great_mammoth', needs: [['great_tusk', 3]], gold: 5000 });
  const row = L.wildUnpack(JSON.parse(JSON.stringify(L.wildPack({ slot: 12, kind: 'greatmammoth', x: 10, y: 10, dir: 'side', left: true, mode: 'walk', hp: 20, size: 1, look: false, max: 24 }))));
  assert.strictEqual(row.hp, 20);
  assert.strictEqual(row.max, 24);
});

test('Magayon\'s animals come back after 15 minutes, the others after 6 (owner, 31 Oct)', () => {
  const s = fresh();
  s.wild.n = 50;
  ['bear', 'mammoth', 'tiger', 'rhino'].forEach((k) => assert.strictEqual(C.WILD.animals[k].respawn, 15, k));
  ['rabbit', 'labuyo', 'deer', 'boar', 'wolf'].forEach((k) => assert.strictEqual(C.WILD.animals[k].respawn, undefined, k));
  const slot = L.wildSlots('magayon').find((e) => e.kind === 'bear').slot;
  const out = () => L.wildHere(s, 'magayon').some((e) => e.slot === slot);
  s.wild.gone['magayon:' + slot] = L.nowMin() - 7;
  assert.ok(!out(), 'not after 7 minutes');
  s.wild.gone['magayon:' + slot] = L.nowMin() - 15;
  assert.ok(out(), 'back after 15');
});

test('the Great Mammoth comes once a weekend: it stays gone through a reload', () => {
  const s = fresh();
  s.wild.n = 50;
  const week = L.weekendMarket, slot = L.wildSlots('magayon').find((e) => e.kind === 'greatmammoth').slot;
  L.weekendMarket = () => true;
  L.hunted(s, 'magayon', slot, 'greatmammoth', 1);
  clock.advance ? clock.advance(600) : s.wild.gone['magayon:' + slot] -= 600; // 10 hours later
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.ok(!L.wildHere(back, 'magayon').some((e) => e.kind === 'greatmammoth'), 'still gone after 10 hours and a reload');
  back.wild.gone['magayon:' + slot] = L.nowMin() - 4321;
  assert.ok(L.wildHere(back, 'magayon').some((e) => e.kind === 'greatmammoth'), 'back after 3 days');
  L.weekendMarket = week;
});

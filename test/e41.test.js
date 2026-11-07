// e41 (owner, 8 Nov 2026): Haliya's Moon Bow. Reach 7 and hit 3 as the Magma Bow (owner: "8 is so much overpower"),
// its arrows go through the first creature and hit the one behind (L.bowPierce); Kanor makes it from the Magma Bow, each
// cave boss's part, Bakunawa Scales and 600,000 Gold (owner: "change the gold to 600k ... so they grind the mine also").
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

const plain = (x) => JSON.parse(JSON.stringify(x));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const M = C.MOON_BOW;
const withBow = (level) => { const s = L.newState(); L.addItem(s, 'bow', 1); s.tools.bow = level; return s; };
const allParts = (s) => M.needs.forEach((n) => L.addItem(s, n[0], n[1]));

test('the Moon Bow: reach 7 and hit 3 like the Magma Bow, its arrow goes through one creature, its own icon', () => {
  const magma = withBow(4), moon = withBow(5);
  assert.deepStrictEqual([L.bowRange(moon), L.bowDamage(moon)], [L.bowRange(magma), L.bowDamage(magma)], 'not stronger on paper');
  assert.deepStrictEqual([L.bowRange(moon), L.bowDamage(moon)], [7, 3]);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map((lv) => L.bowPierce(lv)), [0, 0, 0, 0, 0, 1], 'only the Moon Bow goes through');
  assert.deepStrictEqual([4, 5, '5', 0].map((lv) => L.moonShot(lv)), [false, true, true, false]);
  assert.strictEqual(L.itemName(moon, 'bow'), "Haliya's Moon Bow");
  assert.strictEqual(L.iconOf(moon, 'bow'), C.ICON.bow_5);
  assert.strictEqual(C.ICON_ORDER[C.ICON_ORDER.length - 1], 'bow_5', 'its icon is the last: nothing moves');
  assert.deepStrictEqual([0, 3, 4, 5, 9].map((lv) => L.bowIcon(lv)), [C.ICON.bow, C.ICON.bow_3, C.ICON.bow_4, C.ICON.bow_5, C.ICON.bow_5]);
});

test('Kanor makes it from the Magma Bow, the five caves\' boss parts, 5 Bakunawa Scales and 600,000 Gold', () => {
  assert.strictEqual(M.gold, 600000);
  assert.deepStrictEqual(plain(M.needs), [['fur_amomongo', 6], ['moss_nuno', 3], ['pearl_berberoka', 3], ['bark_kapre', 6], ['feather_minokawa', 6], ['bakunawa_scale', 5]]);
  // each part is the first thing its cave's boss leaves (the boss's part), and the Bakunawa's scale
  ['banaue', 'bohol', 'taal', 'sierra', 'palawan'].forEach((id, i) => assert.strictEqual(M.needs[i][0], L.starParts(id).boss, id));
  assert.strictEqual(L.makeMoonBow(L.newState()), 'nobow');
  const gold = withBow(3);
  gold.gold = 1e7;
  allParts(gold);
  assert.strictEqual(L.makeMoonBow(gold), 'magma', 'the Magma Bow first');
  const s = withBow(4);
  s.gold = 599999;
  allParts(s);
  assert.strictEqual(L.makeMoonBow(s), 'gold');
  s.gold = 600000;
  L.removeItem(s, 'bakunawa_scale', 1);
  assert.strictEqual(L.makeMoonBow(s), 'short');
  L.addItem(s, 'bakunawa_scale', 1);
  L.addItem(s, 'bark_kapre', 2); // (more than it needs: the rest stays)
  assert.strictEqual(L.makeMoonBow(s), 'ok');
  assert.strictEqual(L.bowLevel(s), 5);
  assert.strictEqual(s.gold, 0);
  M.needs.forEach((n) => assert.strictEqual(L.countItem(s, n[0]), n[0] === 'bark_kapre' ? 2 : 0, n[0]));
  assert.strictEqual(L.makeMoonBow(s), 'have');
  assert.strictEqual(L.nextBow(s), null, 'nothing past it at the bow upgrades');
});

test('the Moon Bow is kept by the save (the bow\'s level in \'wl\' stops at Gold; o.mgb, then o.mnb)', () => {
  const s = withBow(5);
  const o = plain(L.serialize(s));
  assert.strictEqual(o.mnb, 1);
  assert.strictEqual(o.mgb, 1);
  assert.strictEqual(L.bowLevel(roundTrip(s)), 5);
  assert.strictEqual(L.bowLevel(roundTrip(roundTrip(s))), 5);
  // a Magma Bow stays a Magma Bow
  assert.strictEqual(L.bowLevel(roundTrip(withBow(4))), 4);
  assert.strictEqual(plain(L.serialize(withBow(4))).mnb, undefined);
  // o.mnb without the Magma Bow under it (a broken save) makes nothing
  const t = plain(L.serialize(withBow(2)));
  t.mnb = 1;
  assert.strictEqual(L.bowLevel(L.deserialize(t)), 2);
});

test('its tour is remembered once (the last tip: older saves keep theirs)', () => {
  assert.strictEqual(C.TIPS[C.TIPS.length - 1].key, 'moonbow_tour');
  const s = L.newState();
  assert.ok(!L.tipSeen(s, 'moonbow_tour'));
  L.takeTip(s, 'moonbow_tour');
  assert.ok(L.tipSeen(roundTrip(s), 'moonbow_tour'));
});

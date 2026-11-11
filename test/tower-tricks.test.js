// Unit tests for The Lost Tower's tricks (the rules: src/01-logicZZZZZZZZZZZZZZZZZZ-tower-tricks.js; the spec:
// docs/superpowers/specs/2026-11-12-lost-tower-design.md): which floors have which, who carries them, and each trick's
// numbers: the shield and the Rifle, the puddles, the song, the flocks, the healers, the dark, the splitters, the revivers.
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
const TR = ctx.window.Farm.towerTricks;
const TW = C.TOWER;
const WI = C.WILD;
const T = C.TILE;
const plain = (x) => JSON.parse(JSON.stringify(x));
const ALL = ['shield', 'burst', 'song', 'flock', 'heal', 'dark', 'split', 'revive'];

test('every realm\'s trick has its entry in F.towerTricks, by the realm\'s trick id, from that realm up', () => {
  assert.deepStrictEqual(Object.keys(TR).sort(), ALL.slice().sort());
  TW.zones.forEach((z) => { if (z.trick && z.trick !== 'all') assert.strictEqual(TR[z.trick].zone, z.n, z.trick + ' starts at realm ' + z.n); });
  assert.deepStrictEqual(plain(L.towerTricks(1)), []);
  assert.deepStrictEqual(plain(L.towerTricks(100)), [], 'the first realm: none');
  assert.deepStrictEqual(plain(L.towerTricks(101)), ['shield']);
  assert.deepStrictEqual(plain(L.towerTricks(200)), ['shield']);
  assert.deepStrictEqual(plain(L.towerTricks(201)), ['shield', 'burst']);
  assert.deepStrictEqual(plain(L.towerTricks(450)), ['shield', 'burst', 'song', 'flock']);
  assert.deepStrictEqual(plain(L.towerTricks(650)), ['shield', 'burst', 'song', 'flock', 'heal', 'dark']);
  assert.deepStrictEqual(plain(L.towerTricks(899)), ALL);
  assert.deepStrictEqual(plain(L.towerTricks(951)), ALL, 'the Seventh Moon: all of them');
  assert.deepStrictEqual(plain(L.towerTricks(1000)), ALL);
  // they stay: each floor has every trick of the floor below it
  for (let f = 2; f <= 1000; f++) L.towerTricks(f - 1).forEach((id) => assert.ok(L.towerHas(f, id), id + ' stays on floor ' + f));
});

const flagsOn = (f) => L.towerRoster(f).map((e) => Object.assign({ kind: e.kind, slot: e.slot }, plain(L.towerFlags(f, e.kind, e.slot))));
const share = (list, k) => list.filter((x) => x[k]).length / list.length;

test('shield: the Umang, the Kugita Knight, Pating\'s armour and Pugita always; about 1 in 4 normal enemies on every shielded floor', () => {
  ['umang', 'kugita_kabalyero', 'pating', 'pugita'].forEach((k) => assert.ok(L.towerFlags(150, k, 3).shield, k));
  assert.ok(!L.towerFlags(50, 'talangka', 3).shield && !L.towerFlags(99, 'umang', 3).shield, 'nothing below floor 101');
  // the share: of the normal ones that are not shield kinds, on the Deep and above (thousands of slots: near a quarter)
  let n = 0, on = 0;
  for (let f = 101; f <= 1000; f += 7) flagsOn(f).forEach((x) => { if (WI.animals[x.kind].role === 'normal' && TR.shield.kinds.indexOf(x.kind) < 0) { n++; if (x.shield) on++; } });
  assert.ok(Math.abs(on / n - 0.25) < 0.03, 'about 1 in 4: ' + (on / n).toFixed(3));
  // a guard or boss that is not a shield kind: never
  assert.ok(!L.towerFlags(310, 'sirena_koro', 0).shield);
  assert.ok(!L.towerFlags(600, 'kataw_hari', 0).shield);
  // the same every time; a copy has none
  assert.deepStrictEqual(plain(L.towerFlags(321, 'sirena', 17)), plain(L.towerFlags(321, 'sirena', 17)));
  assert.ok(!L.towerFlags(150, 'umang', L.towerCopySlot(3, 0), true).shield);
  // only a Rifle shot breaks it
  assert.strictEqual(L.towerShieldHit('rifle'), 'break');
  ['javelin', 'boomerang', null, undefined].forEach((k) => assert.strictEqual(L.towerShieldHit(k), 'bounce', 'the ' + (k || 'Bow')));
});

test('burst: a puddle 2 tiles across for 6 s; standing in it you walk 40% slower', () => {
  assert.deepStrictEqual([TR.burst.size, TR.burst.ms, TR.burst.slow], [2, 6000, 0.4]);
  const p = [{ x: 10 * T, y: 10 * T, until: 6000 }];
  assert.ok(L.towerInPuddle(p, 10 * T, 10 * T, 0, T));
  assert.ok(L.towerInPuddle(p, 10.9 * T, 10 * T, 5999, T), 'near its edge, before it dries');
  assert.ok(!L.towerInPuddle(p, 11.1 * T, 10 * T, 0, T), 'past its edge');
  assert.ok(!L.towerInPuddle(p, 10 * T, 10 * T, 6000, T), 'dried up');
  assert.ok(!L.towerInPuddle([], 0, 0, 0, T));
  assert.strictEqual(L.towerWalk(true), 0.6);
  assert.strictEqual(L.towerWalk(false), 1);
  assert.ok(TR.burst.most > 0 && TR.burst.most <= 12, 'a few at once on a phone: ' + TR.burst.most);
});

test('song: the singers; one alive within 6 tiles makes your shots take half as long again between them', () => {
  ['sirena', 'sirena_koro', 'sirenang_bituin', 'magindara', 'palakang_buwan'].forEach((k) => assert.ok(L.towerFlags(350, k, 2).sing, k));
  assert.ok(!L.towerFlags(350, 'dikya_buwan', 2).sing || TR.song.kinds.indexOf('dikya_buwan') < 0, 'the Moon Jelly does not sing on its own floors');
  assert.ok(flagsOn(350).filter((x) => x.kind === 'dikya_buwan').every((x) => !x.sing), 'not on its own realm');
  assert.ok(!L.towerFlags(250, 'sirena', 2).sing, 'not below floor 301');
  // above the Lagoon, a share of the normal ones sing (none of the singers live there): the trick stays
  const up = [];
  for (let f = 401; f <= 1000; f += 3) flagsOn(f).forEach((x) => { if (WI.animals[x.kind].role === 'normal') up.push(x); });
  assert.ok(Math.abs(share(up, 'sing') - TR.song.share) < 0.03, 'about 1 in 8 sing above it: ' + share(up, 'sing').toFixed(3));
  const me = { x: 0, y: 0 };
  const singer = (d, more) => Object.assign({ sing: true, hp: 3, x: d * T, y: 0 }, more);
  assert.ok(L.towerSung([singer(5.9)], me.x, me.y, T), 'within 6 tiles');
  assert.ok(!L.towerSung([singer(6.1)], me.x, me.y, T), 'too far');
  assert.ok(!L.towerSung([singer(2, { hp: 0 })], me.x, me.y, T), 'beaten');
  assert.ok(!L.towerSung([singer(2, { lying: 2000 })], me.x, me.y, T), 'lying down (a reviver): not singing');
  assert.ok(!L.towerSung([singer(2, { sing: false })], me.x, me.y, T), 'not a singer');
  assert.strictEqual(L.towerGap(1400, true), 2100, 'the Rifle: 1.4 s, 2.1 s while sung to');
  assert.strictEqual(L.towerGap(430, true), 645);
  assert.strictEqual(L.towerGap(1400, false), 1400);
});

test('flocks: the fliers in groups of 3 to 5 (above the Storm Gallery, a quarter of the others in packs too); a Moon Boomerang\'s pair hit reaches a flockmate', () => {
  for (let f = 401; f <= 1000; f += 11) {
    const fl = plain(L.towerFlocks(f)), groups = {};
    Object.keys(fl).forEach((s) => { (groups[fl[s]] = groups[fl[s]] || []).push(+s); });
    const sizes = Object.values(groups).map((g) => g.length), total = sizes.reduce((a, b) => a + b, 0);
    if (total >= 3) sizes.forEach((n) => assert.ok(n >= 3 && n <= 5, 'floor ' + f + ': a flock of ' + n));
    // who is in one: a normal flier, or (above realm 5) one of the share; never a guard or boss
    L.towerRoster(f).forEach((e) => {
      const d = WI.animals[e.kind], inIt = e.slot in fl;
      if (d.role !== 'normal') assert.ok(!inIt, e.kind + ' leads: not in a flock');
      else if (d.flies) assert.ok(inIt, e.kind + ' flies: in a flock on floor ' + f);
    });
    assert.deepStrictEqual(plain(L.towerFlocks(f)), fl, 'the same every time');
  }
  // the Storm Gallery: every normal one flies, so every normal one is in a flock
  const r = L.towerRoster(420), fl = plain(L.towerFlocks(420));
  assert.strictEqual(Object.keys(fl).length, r.filter((e) => WI.animals[e.kind].role === 'normal').length);
  assert.deepStrictEqual(plain(L.towerFlocks(300)), {}, 'none below floor 401');
  // the Kataw Court has no fliers: a quarter of its normal ones go in packs
  const court = Object.keys(plain(L.towerFlocks(550))).length / 60;
  assert.ok(court > 0.1 && court < 0.4, 'packs on the Kataw Court: ' + court);
  // the ring a flock flies in: its neighbours nearer than a Moon pair's reach, so the boomerang's second hit finds one
  for (let n = 2; n <= 5; n++) {
    const a = L.towerRing(0, n, 0.3), b = L.towerRing(1, n, 0.3);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < C.WEAPON_PAIR, 'flock of ' + n + ': ' + Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(2) + ' tiles apart');
  }
});

test('healers: the Kataw Healer, the Queen and the Royal Guard mend the most hurt other within 5 tiles by a fifth of its hits, every 4 s', () => {
  ['kataw_manggagamot', 'kataw_reyna', 'bantay_hari'].forEach((k) => assert.ok(L.towerFlags(550, k, 1).heal, k));
  assert.ok(!L.towerFlags(450, 'kataw_manggagamot', 1).heal, 'not below floor 501');
  assert.ok(flagsOn(560).filter((x) => x.kind === 'tw_kataw').every((x) => !x.heal), 'the Courtier does not heal on its own floors');
  const up = [];
  for (let f = 601; f <= 1000; f += 3) flagsOn(f).forEach((x) => { if (WI.animals[x.kind].role === 'normal') up.push(x); });
  assert.ok(Math.abs(share(up, 'heal') - TR.heal.share) < 0.03, 'about 1 in 10 heal above it: ' + share(up, 'heal').toFixed(3));
  assert.deepStrictEqual([TR.heal.reach, TR.heal.part, TR.heal.every], [5, 0.2, 4000]);
  const h = { x: 0, y: 0, hp: 5, max: 20 }; // (hurt itself: still never its own target)
  const a = { x: 2 * T, y: 0, hp: 10, max: 20 }, b = { x: 3 * T, y: 0, hp: 30, max: 100 }, far = { x: 5.5 * T, y: 0, hp: 1, max: 20 };
  const full = { x: T, y: 0, hp: 20, max: 20 }, lying = { x: T, y: 0, hp: 1e-6, max: 20, lying: 2000 }, gone = { x: T, y: 0, hp: 0, max: 20 };
  assert.strictEqual(L.towerHealPick(h, [h, a, b, far, full, lying, gone], T), b, 'the most hurt as a share (30%), not the one with most hits gone');
  assert.strictEqual(L.towerHealPick(h, [h, a, far, full], T), a);
  assert.strictEqual(L.towerHealPick(h, [h, far, full, lying, gone], T), null, 'nobody hurt and near: nobody (never itself)');
  const near = { x: T, y: 0, hp: 10, max: 20 };
  assert.strictEqual(L.towerHealPick(h, [a, near], T), near, 'as hurt: the nearer');
  assert.strictEqual(L.towerHealOf({ hp: 10, max: 22 }), 4, 'a fifth of 22, rounded');
  assert.strictEqual(L.towerHealOf({ hp: 21, max: 22 }), 1, 'never past full');
  assert.strictEqual(L.towerHealOf({ hp: 1, max: 2 }), 1, 'at least 1');
  assert.strictEqual(L.towerHealOf({ hp: 100, max: 1600 }), 320);
});

test('darkness: from floor 601, you see 3.5 tiles (the hook for the Keeper\'s Lantern); the fire creatures carry their own light', () => {
  assert.ok(!L.towerHas(600, 'dark') && L.towerHas(601, 'dark') && L.towerHas(951, 'dark'));
  assert.strictEqual(L.towerSight({}), 3.5);
  assert.strictEqual(TR.dark.lantern, 2, 'the Lantern will add 2 tiles');
  TR.dark.fire.forEach((k) => assert.ok(WI.animals[k] && WI.animals[k].tower, k + ' is a tower creature'));
  ['santelmong_asul', 'alitaptap', 'lampara_golem', 'dakilang_santelmo'].forEach((k) => assert.ok(L.towerFlags(650, k, 1).fire, k + ' lights the dark'));
  assert.ok(!L.towerFlags(650, 'anino', 1).fire, 'a shadow does not');
  assert.ok(!L.towerFlags(550, 'parol_multo', 1).fire, 'no darkness, no need');
  assert.ok(L.towerFlags(951, 'parola_golem', 1).fire, 'the Lighthouse Golem on the Seventh Moon');
});

test('splitters: the normal ones and the mini boss (never a guard or the big boss); two copies with half the hits; copies do not split', () => {
  assert.ok(!L.towerHas(700, 'split') && L.towerHas(701, 'split'));
  const z = TW.zones[7];
  z.normal.forEach((k) => assert.ok(L.towerFlags(720, k, 4).split, k));
  assert.ok(L.towerFlags(750, z.mini, 0).split, 'the mini boss');
  assert.ok(!L.towerFlags(710, z.guard, 0).split, 'the guard: no');
  assert.ok(!L.towerFlags(800, z.boss, 0).split, 'the big boss: no');
  assert.ok(!L.towerFlags(720, z.normal[0], L.towerCopySlot(4, 1), true).split, 'a copy: once only');
  assert.deepStrictEqual([TR.split.n, TR.split.size, TR.split.part], [2, 0.6, 0.5]);
  assert.strictEqual(L.towerSplitHp(32), 16);
  assert.strictEqual(L.towerSplitHp(31), 16, 'half, rounded up');
  assert.strictEqual(L.towerSplitHp(1), 1);
  // copies have slots of their own, never one of the floor's
  assert.strictEqual(L.towerCopySlot(7, 0), 10014);
  assert.strictEqual(L.towerCopySlot(7, 1), 10015);
  assert.ok(L.towerIsCopy(L.towerCopySlot(0, 0)) && !L.towerIsCopy(60));
  const slots = new Set();
  L.towerRoster(1000).forEach((e) => [0, 1].forEach((i) => slots.add(L.towerCopySlot(e.slot, i))));
  assert.strictEqual(slots.size, 122, 'every copy slot on the biggest floor is its own');
  // the Seventh Moon's normal ones split too (the trick stays)
  TW.zones[9].normal.forEach((k) => assert.ok(L.towerFlags(951, k, 2).split, k));
});

test('revivers: the normal ones and the mini boss, once; they lie about 3 s and stand with half their hits', () => {
  assert.ok(!L.towerHas(800, 'revive') && L.towerHas(801, 'revive'));
  TW.zones[8].normal.forEach((k) => assert.ok(L.towerFlags(820, k, 4).revive, k));
  assert.ok(L.towerFlags(850, TW.zones[8].mini, 0).revive);
  assert.ok(!L.towerFlags(900, TW.zones[8].boss, 0).revive);
  assert.ok(!L.towerFlags(820, TW.zones[8].normal[0], L.towerCopySlot(4, 0), true).revive, 'a copy: no');
  assert.strictEqual(TR.revive.ms, 3000);
  assert.strictEqual(L.towerReviveHp(40), 20);
  assert.strictEqual(L.towerReviveHp(3), 2);
});

test('floor 951 has every trick: its enemies carry them all between them', () => {
  const list = flagsOn(951);
  assert.strictEqual(list.length, 60);
  ['shield', 'sing', 'heal', 'flock', 'split', 'revive', 'fire'].forEach((k) => assert.ok(list.some((x) => x[k]), 'someone has ' + k));
  assert.ok(Object.keys(L.towerFlocks(951)).length >= 3, 'a pack at least');
});

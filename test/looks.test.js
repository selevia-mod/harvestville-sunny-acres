// Unit tests for looks (src/00-zzzlooks.js, src/01-logicK.js): the Elf is everyone's, Gold looks bought in the game,
// Coins and Stars looks owned when the server says, wearing only what you own, and the save (old saves too).
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
const fresh = () => { clock.set(2026, 11, 3, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));

test('eight looks at the owner\'s prices, then the Lair\'s Fire look, then the five caves\' looks (8 Nov 2026), in a fixed order', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.LOOKS.map((l) => l.key))), ['elf', 'straw', 'ranch', 'winter', 'flower', 'santa', 'fiesta', 'bunny', 'fire', 'terrace', 'hills', 'lake', 'forest', 'feather']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.LOOKS.map((l) => [l.free || false, l.gold || 0, l.coins || 0, l.stars || 0]))),
    [[true, 0, 0, 0], [false, 50000, 0, 0], [false, 150000, 0, 0], [false, 300000, 0, 0], [false, 0, 100, 150], [false, 0, 150, 0], [false, 0, 150, 200], [false, 0, 150, 200],
      [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0]]);
});

test('the Fire look has no price in the game: it is yours only when the server says so, and then it is worn and saved', () => {
  const s = fresh();
  assert.strictEqual(L.lookDef('fire').reward, 'lair');
  assert.strictEqual(L.ownsLook(s, 'fire'), false);
  assert.strictEqual(L.buyLookGold(s, 'fire'), 'paid');
  assert.strictEqual(L.wearLook(s, 'fire'), false);
  assert.strictEqual(L.ownLooks(s, ['fire']), 1);
  assert.strictEqual(L.wearLook(s, 'fire'), true);
  const back = roundTrip(s);
  assert.strictEqual(L.ownsLook(back, 'fire'), true, 'its bit (the 9th) survives the save');
  assert.strictEqual(L.wornLook(back), 'fire');
});

test('the Elf is everyone\'s; a Gold look is bought once, for its price; a Coins look is not sold here', () => {
  const s = fresh();
  assert.strictEqual(L.ownsLook(s, 'elf'), true);
  assert.strictEqual(L.ownsLook(s, 'straw'), false);
  s.gold = 49999;
  assert.strictEqual(L.buyLookGold(s, 'straw'), 'gold');
  assert.strictEqual(s.gold, 49999);
  s.gold = 60000;
  assert.strictEqual(L.buyLookGold(s, 'straw'), 'ok');
  assert.strictEqual(s.gold, 10000);
  assert.strictEqual(L.buyLookGold(s, 'straw'), 'owned');
  assert.strictEqual(s.gold, 10000, 'never twice');
  assert.strictEqual(L.buyLookGold(s, 'santa'), 'paid');
  assert.strictEqual(L.buyLookGold(s, 'nope'), 'none');
});

test('what the server says you own is yours; nonsense is ignored', () => {
  const s = fresh();
  assert.strictEqual(L.ownLooks(s, ['santa', 'bunny', 'santa', 'x', 7, null]), 2);
  assert.strictEqual(L.ownsLook(s, 'santa') && L.ownsLook(s, 'bunny'), true);
  assert.strictEqual(L.ownLooks(s, 'santa'), 0);
});

test('you wear only what you own; it is saved, and an old save wears its own clothes', () => {
  const s = fresh();
  assert.strictEqual(L.wearLook(s, 'ranch'), false);
  assert.strictEqual(L.wornLook(s), '');
  assert.strictEqual(L.wearLook(s, 'elf'), true);
  assert.strictEqual(L.wornLook(roundTrip(s)), 'elf');
  s.gold = 1e6; L.buyLookGold(s, 'winter'); L.wearLook(s, 'winter');
  const back = roundTrip(s);
  assert.strictEqual(L.wornLook(back), 'winter');
  assert.strictEqual(L.ownsLook(back, 'winter'), true);
  assert.strictEqual(L.ownsLook(back, 'ranch'), false);
  L.wearLook(back, '');
  assert.strictEqual(L.serialize(back).cw, undefined, 'own clothes: nothing saved');
  const old = L.serialize(fresh()); delete old.co; delete old.cw;
  const o = L.deserialize(JSON.parse(JSON.stringify(old)));
  assert.deepStrictEqual([o.lk, o.cw], [0, '']);
  const forged = L.serialize(fresh()); forged.cw = 5; // wearing Santa without owning it
  assert.strictEqual(L.wornLook(L.deserialize(forged)), '');
});

test('the four new tours take the next free tip bits, under 31', () => {
  const keys = C.TIPS.map((t) => t.key);
  ['tailor_tour', 'event_tour', 'rare_tour', 'mine_tour'].forEach((k) => assert.ok(keys.indexOf(k) >= 0 && keys.indexOf(k) < 31, k));
  assert.strictEqual(new Set(keys).size, keys.length);
});

test('every Tailor Shop look rides the horse in its own clothes (owner\'s art; Cozy Winter 11 Nov 2026): its boy and girl riding sheets, with their shadows, the size of the farm clothes\' and in the riding pack', () => {
  const packs = require('../tools/packs'), sizes = require('../assets/sizes.json'), A = path.join(__dirname, '..', 'assets');
  C.LOOKS.forEach((l) => ['boy', 'girl'].forEach((who) => ['', 'shade'].forEach((sh) => {
    const k = 'ride_' + l.key + '_' + who + sh;
    assert.ok(fs.existsSync(path.join(A, k + '.webp')) && fs.existsSync(path.join(A, k + '.png')), k + ': its picture');
    assert.ok(packs.riding.indexOf(k) >= 0, k + ': in the riding pack (out of the page)');
    assert.deepStrictEqual(sizes[k], sizes['ride_default_' + who + sh], k + ': the same sheet as the farm clothes\'');
  })));
});

test('riding v2 (owner\'s art, approved 11 Nov 2026): the outfits in C.RIDE2 are the pictures in art-src/riding/v2, each with its 4 x 4 sheet and shadow in the riding pack; the others keep their old sheet', () => {
  const packs = require('../tools/packs'), A = path.join(__dirname, '..', 'assets'), SRC = path.join(__dirname, '..', 'art-src', 'riding', 'v2');
  const art = fs.readdirSync(SRC).filter((f) => /^[a-z]+-(boy|girl)\.png$/.test(f)).map((f) => f.slice(0, -4).split('-'));
  const has = (o, w) => art.some(([a, b]) => a === o && b === w), all = [...new Set(art.map((x) => x[0]))];
  const R2 = C.RIDE2, list = (k) => JSON.parse(JSON.stringify(R2[k])).sort();
  assert.deepStrictEqual(list('outfits'), all.filter((o) => has(o, 'boy') && has(o, 'girl')).sort(), 'C.RIDE2.outfits: both the boy and the girl in v2');
  assert.deepStrictEqual(list('boyOnly'), all.filter((o) => has(o, 'boy') && !has(o, 'girl')).sort(), 'C.RIDE2.boyOnly: only the boy so far');
  assert.deepStrictEqual(list('girlOnly'), all.filter((o) => !has(o, 'boy') && has(o, 'girl')).sort(), 'C.RIDE2.girlOnly');
  assert.ok(R2.outfits.indexOf('default') >= 0, 'the farm clothes gallop');
  art.forEach(([o, w]) => assert.ok(L.ride2Has(o, w), o + ' ' + w + ': v2'));
  C.LOOKS.forEach((l) => ['boy', 'girl'].forEach((w) => { if (!has(l.key, w)) assert.ok(!L.ride2Has(l.key, w) && fs.existsSync(path.join(A, 'ride_' + l.key + '_' + w + '.webp')), l.key + ' ' + w + ': still its old sheet'); }));
  const webpSize = (f) => { const d = fs.readFileSync(f); return d.toString('latin1', 12, 16) === 'VP8X' ? [1 + d.readUIntLE(24, 3), 1 + d.readUIntLE(27, 3)] : null; };
  ['ride2_horse'].concat(art.map(([o, w]) => 'ride2_' + o + '_' + w)).forEach((k) => ['', 'shade'].forEach((sh) => {
    assert.ok(packs.riding.indexOf(k + sh) >= 0, k + sh + ': in the riding pack');
    const sz = webpSize(path.join(A, k + sh + '.webp'));
    // (the shadow stored at half the size, a quarter of the memory, drawn at the sheet's: assets/sizes.json, 11 Nov 2026)
    if (sz) assert.deepStrictEqual(sz, sh ? [R2.fw * 2, R2.fh * 2] : [R2.fw * 4, R2.fh * 4], k + sh + ': 4 x 4 frames of ' + R2.fw + ' x ' + R2.fh + (sh ? ', stored at half' : ''));
    if (sh) assert.deepStrictEqual(require('../assets/sizes.json')[k + sh], [R2.fw * 4, R2.fh * 4], k + sh + ': drawn at full size');
  }));
});

test('riding v2 on a busy screen (owner, 11 Nov 2026): the others\' outfit sheets held at once are capped (yours and the farm clothes\' always fine), past the cap the farm clothes\'; one unseen for 30 s is let go', () => {
  const held = {}, keep = ['ride2_santa_girl', 'ride2_default_boy', 'ride2_default_girl'], R2 = C.RIDE2;
  assert.strictEqual(R2.others, 10);
  assert.strictEqual(R2.othersCheap, 4);
  assert.strictEqual(R2.letGo, 30000);
  const outfits = ['elf', 'straw', 'ranch', 'winter', 'flower', 'fiesta', 'bunny'];
  const got = outfits.map((o, i) => L.ride2Pick(held, 'ride2_' + o + '_boy', keep, 1000 + i, 4));
  assert.deepStrictEqual(got, ['ride2_elf_boy', 'ride2_straw_boy', 'ride2_ranch_boy', 'ride2_winter_boy', null, null, null], 'a cheap phone: 4, then the farm clothes');
  assert.strictEqual(Object.keys(held).length, 4);
  assert.strictEqual(L.ride2Pick(held, 'ride2_elf_boy', keep, 5000, 4), 'ride2_elf_boy', 'one already held: still fine (seen again)');
  assert.strictEqual(L.ride2Pick(held, 'ride2_santa_girl', keep, 5000, 4), 'ride2_santa_girl', 'yours: always');
  assert.strictEqual(L.ride2Pick(held, 'ride2_default_girl', keep, 5000, 4), 'ride2_default_girl', 'the farm clothes: always');
  assert.strictEqual(Object.keys(held).length, 4, 'neither counts');
  assert.deepStrictEqual([...L.ride2Stale(held, 32000, 30000)].sort(), ['ride2_ranch_boy', 'ride2_straw_boy', 'ride2_winter_boy'], 'unseen for 30 s: let go');
  assert.deepStrictEqual([...Object.keys(held)], ['ride2_elf_boy'], 'the one seen at 5 s stays');
  assert.strictEqual(L.ride2Pick(held, 'ride2_fiesta_boy', keep, 32000, 4), 'ride2_fiesta_boy', 'room again');
  assert.strictEqual(L.ride2Pick(held, null, keep, 32000, 4), null);
});

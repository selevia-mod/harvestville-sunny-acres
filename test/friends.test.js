// Unit tests for the villager friendship stories (owner, 6 Nov 2026): the stories (src/00-zzzzzzzzzzz-friends.js) and
// their rules and save (src/01-logicZZZZ-friends.js).
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
const plain = (x) => JSON.parse(JSON.stringify(x));
// Wed 1 Apr 2026, 10 AM (spring)
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; s.time = 600; return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const VS = C.VS;
const hearts = (s, key, n) => { const f = L.friend(s, key); f.met = 1; f.pts = n * 10; };
const at = (s, h, m = 0) => { s.time = h * 60 + m; };
const steps = () => C.VILLAGER_ORDER.flatMap((k) => VS.stories[k].map((st, i) => ({ k, i, st })));
const allRewards = (st) => [st.reward].concat(st.choice.a.map((a) => (a[2] && a[2].reward) || null)).filter(Boolean).flat();
const townPoints = (() => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'town.json'), 'utf8'));
  return new Set(m.layers.filter((l) => l.type === 'objectgroup').flatMap((l) => l.objects).map((o) => o.name));
})();

// ---------- the stories ----------
test('every one of the 23 villagers has a story of 4 steps, opening at 2, 4, 6 and 8 hearts, the last with a secret', () => {
  assert.strictEqual(C.VILLAGER_ORDER.length, 23);
  assert.deepStrictEqual(plain(VS.hearts), [2, 4, 6, 8]);
  C.VILLAGER_ORDER.forEach((k) => {
    const list = VS.stories[k];
    assert.ok(Array.isArray(list), k + ' has a story');
    assert.strictEqual(list.length, 4, k + ' has 4 steps');
    assert.ok(allRewards(list[3]).some((r) => r.secret), k + ': the 8-heart step tells a secret');
  });
  assert.strictEqual(L.vsTotal(), 92);
  assert.deepStrictEqual(plain(Object.keys(VS.stories).sort()), plain(C.VILLAGER_ORDER.slice().sort()), 'no story for someone who is not a villager');
});

test('every step is short and complete: a title, a hint, 4-8 lines with the choice, two answers, a reward', () => {
  steps().forEach(({ k, i, st }) => {
    const id = k + ' ' + (i + 1);
    assert.ok(st.t && st.t.length < 40, id + ' title');
    assert.ok(st.hint && st.hint.length > 10, id + ' hint');
    assert.ok(Array.isArray(st.lines) && st.lines.length >= 2, id + ' lines');
    const n = st.lines.length + 1 + (st.thanks ? st.thanks.length : 0);
    assert.ok(n >= 3 && n <= 8, id + ': ' + n + ' lines in all (with the choice)');
    assert.ok(st.choice && st.choice.q && st.choice.a.length === 2, id + ' has a choice of two');
    st.choice.a.forEach((a) => { assert.ok(a[0] && a[1], id + ' answer and reply'); assert.ok(a[0].length <= 60, id + ' answer fits a button'); });
    assert.ok(Array.isArray(st.reward) && st.reward.length, id + ' reward');
    if (st.bring) assert.ok(st.thanks && st.thanks.length, id + ': a favour has its thanks');
    assert.ok(!(st.bring && st.help), id + ': a favour or a hand, not both');
    [st.t, st.hint].concat(st.lines.map((l) => l[1])).concat(st.choice.a.flatMap((a) => [a[0], a[1]])).forEach((t) => assert.ok(!/[^\x00-\x7f]/.test(t), id + ': plain text: ' + t));
  });
});

test('everything a story names is in the game: speakers, items, recipes, furniture, yard pieces, places, shops, friends', () => {
  const ok = (cond, msg) => assert.ok(cond, msg);
  steps().forEach(({ k, i, st }) => {
    const id = k + ' ' + (i + 1);
    st.lines.concat(st.thanks || []).forEach((l) => ok(l[0] === 'me' || C.VILLAGERS[l[0]], id + ': speaker ' + l[0]));
    allRewards(st).forEach((r) => {
      const kinds = ['item', 'gold', 'seeds', 'recipe', 'furn', 'yard', 'photo', 'off', 'secret'].filter((x) => r[x] != null);
      assert.strictEqual(kinds.length, 1, id + ': one kind of reward each: ' + JSON.stringify(r));
      if (r.item) { ok(C.ITEMS[r.item] || ['lumber', 'stone'].includes(r.item), id + ': item ' + r.item); ok(r.n > 0, id + ' n'); }
      if (r.gold) ok(r.gold > 0 && r.gold <= 2000, id + ' gold');
      if (r.recipe) {
        const rc = VS.recipes[r.recipe];
        ok(rc && C.ITEMS[rc.dish] && C.ITEMS[rc.dish].energy, id + ': recipe ' + r.recipe);
        rc.needs.forEach((n) => L.ingredientItems(n).forEach((x) => ok(C.ITEMS[x], id + ': ingredient ' + x)));
        ok(!C.RECIPES.some((x) => x.dish === rc.dish), id + ': ' + rc.dish + ' was not cookable before');
      }
      if (r.furn || r.photo) {
        const t = C.HOME.typeIndex[r.photo ? 'painting' : r.furn];
        ok(t != null, id + ': furniture ' + r.furn);
        ok(!C.HOME.types[t].trophy && !C.HOME.types[t].needs && !C.HOME.types[t].use || ['musicbox', 'aquarium'].includes(C.HOME.types[t].use), id + ': an ordinary piece');
        ok(C.HOME.styleIndex[r.style || 'classic'] != null, id + ': style ' + r.style);
      }
      if (r.yard) {
        const y = L.vsYardIndex(r.yard);
        ok(y >= 0, id + ': yard piece ' + r.yard);
        ok(!C.OUTDOOR.types[y].workshop && !['bakery', 'dairy', 'jam_maker', 'tannery', 'greenhouse', 'farm_plot', 'field_fence'].includes(r.yard), id + ': decoration, not a workshop');
      }
      if (r.photo) (r.people || []).forEach((p) => ok(C.VILLAGERS[p], id + ': in the photo ' + p));
      if (r.off) ok(VS.shops[k] && r.off > 0 && r.off <= VS.maxOff, id + ': a friend price at a shop ' + k + ' has');
    });
    if (st.bring) {
      const b = st.bring[0], mat = ['lumber', 'stone'].includes(b);
      ok((mat || C.ITEMS[b]) && st.bring[1] > 0, id + ': bring ' + b);
      ok(mat || (C.ITEMS[b].kind !== 'crop' && C.ITEMS[b].kind !== 'forage'), id + ': a favour never waits on a season');
    }
    if (st.after) ok(VS.stories[st.after[0]] && st.after[1] >= 1 && st.after[1] <= 4 && st.after[0] !== k, id + ': after ' + st.after);
    if (st.at) {
      const v = C.VILLAGERS[k], places = v.schedule.concat(v.rest || []).map((e) => e[1]);
      ok(places.includes(st.at), id + ': ' + st.at + ' is in ' + k + "'s day");
      if (/^in:/.test(st.at)) ok(C.BUILDINGS[st.at.slice(3)] && C.BUILDINGS[st.at.slice(3)].owner === k, id + ': ' + st.at + ' is their own shop (its Talk button is theirs)');
      else { ok(townPoints.has(st.at), id + ': ' + st.at + ' is a point on the town map'); ok(VS.places[st.at], id + ': ' + st.at + ' has a name'); }
      ok(L.vsWhen(k, st.at), id + ': a time for ' + st.at);
    }
    if (st.help) ok(/^in:/.test(st.at) || st.at, id + ': help happens somewhere');
  });
  Object.keys(VS.shops).forEach((k) => ok(C.VILLAGERS[k], 'shop of ' + k));
  // the two tied stories
  assert.deepStrictEqual(plain(VS.stories.ewan[3].after), ['leo', 3]);
  assert.deepStrictEqual(plain(VS.stories.elliot[2].after), ['clara', 3]);
  assert.ok(C.TIPS.some((t) => t.key === 'friends_tour'), 'the tour has its tip bit');
});

test('stories know each other: at least 15 steps have another villager speaking or waiting on them', () => {
  const tied = steps().filter(({ k, st }) => st.after || st.lines.concat(st.thanks || []).some((l) => l[0] !== 'me' && l[0] !== k));
  assert.ok(tied.length >= 15, tied.length + ' tied steps');
});

// ---------- when a step opens ----------
test('a step opens with the hearts: nothing at 1 heart, the talk-anywhere step at 2, the next one waits for 4', () => {
  const s = fresh();
  hearts(s, 'lily', 1);
  assert.strictEqual(L.vsReady(s, 'lily'), null);
  assert.strictEqual(L.vsNext(s, 'lily').state, 'locked');
  assert.match(L.vsHint(s, 'lily'), /^At 2 hearts: /);
  hearts(s, 'lily', 2);
  const go = L.vsReady(s, 'lily');
  assert.strictEqual(go.i, 0);
  assert.strictEqual(go.phase, 'scene');
  assert.strictEqual(L.vsHint(s, 'lily'), 'Talk to Lily.');
  const r = L.vsStart(s, 'lily', 0, 0);
  assert.ok(r.got && r.got.length, 'the reward');
  assert.strictEqual(L.vsDone(s, 'lily'), 1);
  assert.strictEqual(L.vsReady(s, 'lily'), null, 'step 2 needs 4 hearts');
  assert.match(L.vsHint(s, 'lily'), /^At 4 hearts: /);
  // a villager never met has no step, whatever the points say
  L.friend(s, 'bram').pts = 90;
  assert.strictEqual(L.vsReady(s, 'bram'), null);
});

test('a meeting step plays only where and when they are: Mira at the river dock, 6 PM to 7 PM', () => {
  const s = fresh();
  hearts(s, 'mira', 4);
  s.vf.mira = 1;
  at(s, 10);
  assert.strictEqual(L.vsReady(s, 'mira'), null, 'in the morning she is at the woodshop');
  assert.match(L.vsHint(s, 'mira'), /Meet Mira at the river dock \(6 PM-7 PM\)/);
  assert.match(L.talk(s, 'mira').line, /Friendship Book: Mira wants to see you at the river dock/);
  at(s, 18, 20);
  assert.strictEqual(L.vsReady(s, 'mira').i, 1);
  // married to her: anywhere will do
  at(s, 10);
  s.spouse = 'mira';
  assert.strictEqual(L.vsReady(s, 'mira').i, 1);
});

test('the children meet after school on school days, and the hint says when on Saturdays and Sundays', () => {
  const s = fresh(); // a Wednesday
  hearts(s, 'pip', 2);
  at(s, 10);
  assert.strictEqual(L.vsReady(s, 'pip'), null, 'Pip is at school');
  at(s, 15);
  assert.strictEqual(L.vsReady(s, 'pip').i, 0, 'the playground after school');
  assert.match(L.vsWhen('pip', 'playground'), /2 PM-5 PM on school days, 9 AM-12 PM on Saturdays and Sundays/);
});

test('helping at their shop needs the energy, and takes it: Hana at the bakery in the morning', () => {
  const s = fresh();
  hearts(s, 'hana', 2);
  at(s, 9);
  s.energy = 10;
  assert.strictEqual(L.vsReady(s, 'hana'), null, 'too tired');
  assert.match(L.vsNudge(s, 'hana'), /15 energy/);
  s.energy = 60;
  assert.match(L.vsHint(s, 'hana'), /^Help Hana at Hana's Bakery \(6 AM-3 PM or 6 PM-11 PM\)\. It takes 15 energy\.$/);
  assert.strictEqual(L.vsReady(s, 'hana').i, 0);
  const r = L.vsStart(s, 'hana', 0, 1);
  assert.ok(r.got);
  assert.strictEqual(s.energy, 45);
  assert.deepStrictEqual(plain(L.vsRecipes(s)).map((x) => x.dish), ['bread']);
});

test('two stories tied together: Ewan sails the Pearl only after Leo and you mended her', () => {
  const s = fresh();
  hearts(s, 'ewan', 8);
  s.vf.ewan = 3;
  at(s, 7);
  assert.strictEqual(L.vsNext(s, 'ewan').state, 'after');
  assert.strictEqual(L.vsReady(s, 'ewan'), null);
  assert.match(L.vsHint(s, 'ewan'), /First: Leo's story, "Mending the Pearl"/);
  s.vf.leo = 3;
  assert.strictEqual(L.vsReady(s, 'ewan').i, 3);
});

// ---------- favours ----------
test('a favour: the scene asks, the talk says what is missing, the things are handed over, the reward comes', () => {
  const s = fresh();
  hearts(s, 'rosa', 6);
  s.vf.rosa = 2;
  const go = L.vsReady(s, 'rosa');
  assert.strictEqual(go.i, 2);
  const r = L.vsStart(s, 'rosa', 2, 1);
  assert.strictEqual(r.asked, true);
  assert.strictEqual(L.vsAsked(s, 'rosa'), true);
  assert.strictEqual(L.vsDone(s, 'rosa'), 2, 'not done until the eggs come');
  assert.strictEqual(L.vsHint(s, 'rosa'), 'Bring Rosa 6 Egg (you have 0).');
  assert.strictEqual(L.vsReady(s, 'rosa'), null);
  s.friends.rosa.talked = 0;
  assert.match(L.talk(s, 'rosa').line, /\(Rosa is waiting for 6 Egg\. You have 0\.\)$/);
  assert.deepStrictEqual(plain(L.vsHandOver(s, 'rosa')), { error: 'missing' });
  L.addItem(s, 'egg', 7);
  assert.strictEqual(L.vsReady(s, 'rosa').phase, 'thanks');
  const pts = s.friends.rosa.pts;
  const done = L.vsHandOver(s, 'rosa');
  assert.ok(done.got, 'handed over');
  assert.strictEqual(L.countItem(s, 'egg'), 1, 'six eggs given');
  assert.strictEqual(L.countItem(s, 'pumpkin_pie'), 2);
  const table = L.furnKey(C.HOME.typeIndex.table, C.HOME.styleIndex.harvest);
  assert.strictEqual(s.home.bag[table], 1, 'the Harvest table is in house storage');
  assert.strictEqual(L.vsDone(s, 'rosa'), 3);
  assert.strictEqual(L.vsAsked(s, 'rosa'), false);
  assert.strictEqual(L.vsChoice(s, 'rosa', 2), 1, 'the answer given when she asked is kept');
  assert.strictEqual(s.friends.rosa.pts, pts + VS.pts);
});

test('a full bag keeps the reward (and the things you brought) until there is room', () => {
  const s = fresh();
  hearts(s, 'leo', 2);
  at(s, 7);
  for (let k = 0; k < s.inv.length; k++) if (!s.inv[k]) s.inv[k] = { id: 'stone', n: 99 };
  for (let k = s.inv.length; k < 200; k++) if (L.canAdd(s, 'fish_l', 1)) L.addItem(s, 'ore_copper', 99); else break;
  assert.ok(!L.canAdd(s, 'fish_l', 2), 'the bag is full');
  const before = JSON.stringify(L.serialize(s));
  assert.deepStrictEqual(plain(L.vsStart(s, 'leo', 0, 0)), { error: 'full', item: 'fish_l' });
  assert.strictEqual(JSON.stringify(L.serialize(s)), before, 'nothing changed');
  assert.strictEqual(L.vsReady(s, 'leo').i, 0, 'it waits');
});

// ---------- choices ----------
test('what you say changes what you get: Rosa pays gold or soup, Pearl a rug or a photo', () => {
  const a = fresh(), b = fresh();
  [a, b].forEach((s) => { hearts(s, 'rosa', 4); s.vf.rosa = 1; at(s, 12); s.energy = 100; });
  const g0 = a.gold, g1 = b.gold;
  L.vsStart(a, 'rosa', 1, 0);
  L.vsStart(b, 'rosa', 1, 1);
  assert.strictEqual(a.gold, g0 + 400);
  assert.strictEqual(L.countItem(a, 'hot_soup'), 0);
  assert.strictEqual(b.gold, g1);
  assert.strictEqual(L.countItem(b, 'hot_soup'), 2);
  assert.notStrictEqual(VS.stories.rosa[1].choice.a[0][1], VS.stories.rosa[1].choice.a[1][1], 'and she answers differently');
  // Pearl: the photo for one answer, the rug for the other
  const c = fresh(), d = fresh();
  [c, d].forEach((s) => { hearts(s, 'pearl', 6); s.vf.pearl = 2; L.addItem(s, 'grilled_fish', 2); });
  L.vsStart(c, 'pearl', 2, 0);
  L.vsStart(d, 'pearl', 2, 1);
  L.vsHandOver(c, 'pearl');
  L.vsHandOver(d, 'pearl');
  assert.deepStrictEqual(plain(L.vsPhotos(c)).map((p) => p.photo), ['Pearl and Ewan on the pier']);
  assert.deepStrictEqual(plain(L.vsPhotos(d)), []);
  const rug = L.furnKey(C.HOME.typeIndex.rug, C.HOME.styleIndex.cottage), painting = L.furnKey(C.HOME.typeIndex.painting, C.HOME.styleIndex.classic);
  assert.strictEqual(d.home.bag[rug], 1);
  assert.strictEqual(c.home.bag[painting], 1, 'the photo hangs as a Painting');
  assert.strictEqual(c.home.bag[rug], undefined);
  // and the friendship: an answer may add a little
  const e = fresh(), f = fresh();
  [e, f].forEach((s) => hearts(s, 'lily', 2));
  L.vsStart(e, 'lily', 0, 0);
  L.vsStart(f, 'lily', 0, 1);
  assert.strictEqual(e.friends.lily.pts - f.friends.lily.pts, 3);
});

// ---------- rewards ----------
test('rewards land where they belong: seeds of the season, a recipe for the kitchen, yard pieces, a friend price', () => {
  const s = fresh(); // spring: the dearest spring seed
  hearts(s, 'lily', 2);
  L.vsStart(s, 'lily', 0, 0);
  const best = L.vsSeasonSeed(s);
  assert.strictEqual(C.ITEMS[best].kind, 'seed');
  assert.ok(L.cropInSeason(C.ITEMS[best].crop, s.day), best + ' is a spring seed');
  assert.strictEqual(L.countItem(s, best), 6);
  // the friend price at Lily's: 10% off seeds, only seeds, and only for this farm
  hearts(s, 'lily', 4);
  at(s, 18);
  assert.strictEqual(L.vsReady(s, 'lily').i, 1);
  L.vsStart(s, 'lily', 1, 0);
  const full = L.priceOf('seed_tulip', s.day);
  assert.strictEqual(L.priceOf('seed_tulip', s.day, s), Math.round(full * 0.9));
  assert.strictEqual(L.priceOf('brush', s.day, s), C.ITEMS.brush.price, 'not her other goods');
  s.gold = 1000;
  assert.strictEqual(L.buy(s, 'seed_tulip', 2), 'ok');
  assert.strictEqual(s.gold, 1000 - 2 * Math.round(full * 0.9));
  assert.strictEqual(L.priceOf('seed_tulip', s.day), full, 'the shop price is the same for everyone else');
  // a recipe a friend taught: in the kitchen, and it cooks
  const t = fresh();
  hearts(t, 'pearl', 4);
  t.vf.pearl = 1;
  at(t, 9);
  L.vsStart(t, 'pearl', 1, 0);
  const cookie = plain(L.vsRecipes(t))[0];
  assert.deepStrictEqual(cookie, { dish: 'cookie', needs: ['wheat', 'egg', 'milk'], story: 'cookie' });
  t.builds.kitchen = 1;
  ['wheat', 'egg_l', 'milk'].forEach((id) => L.addItem(t, id, 1));
  assert.strictEqual(L.cook(t, L.vsRecipes(t)[0]), 'ok');
  assert.strictEqual(L.countItem(t, 'cookie'), 1);
  // a yard piece: Hollis's lamp post
  const u = fresh();
  hearts(u, 'hollis', 2);
  L.vsStart(u, 'hollis', 0, 1);
  assert.strictEqual(u.yard.bag[L.vsYardIndex('lamp')], 1);
  // the secret, once the last step is done
  const w = fresh();
  hearts(w, 'bram', 8);
  w.vf.bram = 3;
  at(w, 9);
  assert.strictEqual(L.vsSecret(w, 'bram'), null);
  L.vsStart(w, 'bram', 3, 0);
  assert.match(L.vsSecret(w, 'bram'), /chickens/);
  assert.strictEqual(L.vsHint(w, 'bram'), 'Story complete!');
  assert.strictEqual(L.vsNext(w, 'bram'), null);
});

test('every step can be played to the end, with either answer, and every reward is given without an error', () => {
  [0, 1].forEach((pick) => {
    const s = fresh();
    s.gold = 0;
    s.builds.kitchen = 1;
    C.VILLAGER_ORDER.forEach((k) => {
      hearts(s, k, 10);
      VS.stories[k].forEach((st, i) => {
        s.vf[k] = (s.vf[k] & ~15) | i; // the step is next
        if (st.after) s.vf[st.after[0]] = Math.max(s.vf[st.after[0]] & 7, st.after[1]);
        s.energy = 100;
        const r = L.vsStart(s, k, i, pick);
        assert.ok(!r.error, k + ' ' + (i + 1) + ': ' + JSON.stringify(r));
        if (st.bring) {
          if (['lumber', 'stone'].includes(st.bring[0])) s[st.bring[0]] += st.bring[1]; else L.addItem(s, st.bring[0], st.bring[1]);
          const h = L.vsHandOver(s, k);
          assert.ok(h.got, k + ' ' + (i + 1) + ' handed over');
        }
        assert.strictEqual(L.vsDone(s, k), i + 1, k + ' ' + (i + 1) + ' done');
        s.inv = s.inv.map(() => null); // room for the next
      });
    });
    assert.strictEqual(L.vsCount(s), 92);
    assert.strictEqual(L.vsRecipes(s).length, Object.keys(VS.recipes).length, 'all six recipes taught');
    assert.ok(L.vsPhotos(s).length >= 8, L.vsPhotos(s).length + ' photos');
    assert.strictEqual(L.vsOff(s, 'seed_coffee'), 0.1);
    assert.strictEqual(L.vsOff(s, 'bouquet'), 0.1);
    assert.strictEqual(L.vsOff(s, 'treat'), 0.1);
    assert.strictEqual(L.vsOff(s, 'bread'), 0);
    // and it all saves in a few bytes
    const o = L.serialize(s);
    assert.strictEqual(o.vf.length, 23);
    assert.ok(JSON.stringify(o.vf).length < 120, JSON.stringify(o.vf));
    assert.deepStrictEqual(plain(roundTrip(s).vf), plain(s.vf));
  });
});

// ---------- the save ----------
test('the save: steps, an asked favour and the answers come back; an older save loads with no stories yet', () => {
  const s = fresh();
  hearts(s, 'lily', 2);
  L.vsStart(s, 'lily', 0, 1);
  hearts(s, 'rosa', 6);
  s.vf.rosa = 2;
  L.vsStart(s, 'rosa', 2, 1);
  const o = L.serialize(s);
  assert.deepStrictEqual(plain(o.vf), [1 | 16, 0, 0, 0, 2 | 8 | 64]);
  const t = roundTrip(s);
  assert.strictEqual(L.vsDone(t, 'lily'), 1);
  assert.strictEqual(L.vsChoice(t, 'lily', 0), 1);
  assert.strictEqual(L.vsAsked(t, 'rosa'), true);
  assert.strictEqual(L.vsChoice(t, 'rosa', 2), 1);
  assert.strictEqual(L.vsNext(t, 'rosa').state, 'asked');
  // a farm with no story yet saves no key at all
  const u = fresh();
  assert.strictEqual(L.serialize(u).vf, undefined);
  // an older save (no vf key) loads, with every story at its start
  const old = L.serialize(fresh());
  delete old.vf;
  const v = L.deserialize(JSON.parse(JSON.stringify(old)));
  assert.deepStrictEqual(plain(v.vf), {});
  C.VILLAGER_ORDER.forEach((k) => assert.strictEqual(L.vsDone(v, k), 0));
  // nonsense in the key is kept to what a story can be
  const bad = L.serialize(fresh());
  bad.vf = [7, 'x', -3, 255, 1 | 8, 3.7, null, 2 | 8 | 128 | 64, 99999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4];
  const w = L.deserialize(JSON.parse(JSON.stringify(bad)));
  assert.strictEqual(L.vsDone(w, 'lily'), 4, 'at most 4 steps');
  assert.strictEqual(L.vsDone(w, 'hollis'), 0);
  assert.strictEqual(L.vsDone(w, 'mira'), 4);
  assert.strictEqual(L.vsAsked(w, 'rosa'), false, 'Rosa step 2 is not a favour: no "asked"');
  assert.strictEqual(L.vsDone(w, 'leo'), 3);
  assert.strictEqual(L.vsAsked(w, 'pearl'), true, 'Pearl step 3 is a favour');
  assert.strictEqual(L.vsChoice(w, 'pearl', 2), 1);
  assert.strictEqual(L.vsChoice(w, 'pearl', 3), 0, 'no answer kept for a step not reached');
  assert.strictEqual(Object.keys(w.vf).length, 5);
});

test('a talk with no story waiting is the same line as before', () => {
  const s = fresh();
  hearts(s, 'leo', 1);
  const line = L.talk(s, 'leo').line;
  assert.ok(!/Friendship Book/.test(line));
  const t = fresh();
  hearts(t, 'leo', 2);
  at(t, 7); // at the dock: the step is ready, so nothing to add
  assert.ok(!/\n\n\(/.test(L.talk(t, 'leo').line));
});

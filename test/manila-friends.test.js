// Unit tests for Manila Friends (owner, 18 Nov 2026: docs/superpowers/specs/2026-11-18-manila-friends-design.md;
// src/00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-friends.js, src/01-logicZZZZZZZZZZZZZZZZZZZZZZZZZ-manila-friends.js): the 10
// friends, the town's friendship rules for them (talk, gifts, birthdays, tiers), their 4-step stories at 2/4/6/8 hearts,
// every unlock, the town's villagers untouched (mn_rosa is not the Sunny Inn's Rosa), no marriage, and the save.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(SRC).filter((f) => /^0[01]-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const MF = C.MNF, U = MF.unlocks, G = C.GRAND_MARKET;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const fresh = (y = 2026, m = 4, d = 1) => {
  clock.set(y, m, d, 10, 0);
  const s = L.newState(); s.seed = 11; s.time = 600; s.gold = 1e6; s.lumber = 500;
  return s;
};
const hearts = (s, key, n) => { const f = L.friend(s, key); f.met = 1; f.pts = n * 10; };
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
const give = (s, key, id) => { L.addItem(s, id, 1); return L.giveGift(s, key, slotOf(s, id)); };
const dayOn = (m, d, y = 2026) => L.dayOf(new Date(y, m - 1, d, 12).getTime());
const allRewards = (st) => [st.reward].concat(st.choice.a.map((a) => (a[2] && a[2].reward) || null)).filter(Boolean).flat();

// ---------- who they are ----------
test('ten Manila friends, keyed mn_*, none of them a town villager', () => {
  assert.deepStrictEqual(plain(MF.order), ['mn_rosa', 'mn_danny', 'mn_lando', 'mn_kardo', 'mn_marisol', 'mn_tibo', 'mn_amparo', 'mn_ramon', 'mn_bea', 'mn_nena']);
  MF.order.forEach((k) => {
    assert.match(k, /^mn_[a-z]+$/);
    assert.ok(!C.VILLAGERS[k] && C.VILLAGER_ORDER.indexOf(k) < 0, k + ' is not a villager');
    assert.ok(L.mnIs(k) && !L.mnIs(k.slice(3)), k);
  });
  assert.deepStrictEqual(plain(Object.keys(MF.friends).sort()), plain(MF.order.slice().sort()));
  // each is someone already in the city: one of the 7 people, or a city-life role (Bea is the students' leader, BEA)
  MF.order.forEach((k) => {
    const d = MF.friends[k];
    if (d.person) assert.ok(C.MANILA.people[d.person] && C.MANILA.people[d.person].sheet === d.sheet, k);
    else assert.ok(C.MANILA.roles[d.role2] && C.MANILA.roles[d.role2].sheets.indexOf(d.sheet) >= 0, k);
  });
  assert.strictEqual(C.MANILA.roles.students.names[MF.friends.mn_bea.n], 'BEA');
  assert.strictEqual(L.mnKeyOfRole('priest', 0), 'mn_ramon');
  assert.strictEqual(L.mnKeyOfRole('carinderia_cook', 0), 'mn_nena');
  assert.strictEqual(L.mnKeyOfRole('students', 1), null, 'only Bea of the three');
  assert.strictEqual(L.mnKeyOfPerson('rosa'), 'mn_rosa');
});

test('each has the town\'s dialogue shape and real gifts, mostly from the farm', () => {
  MF.order.forEach((k) => {
    const D = C.DIALOGUE[k], v = MF.friends[k];
    assert.ok(D.intro && D.rain && D.birthday && D.bday && D.tiers.length === 4 && D.tiers.every((t) => t.length >= 3), k);
    assert.ok(D.gift.love && D.gift.like && D.gift.neutral && D.gift.dislike, k);
    assert.deepStrictEqual(plain(D.spouse), [], 'nobody to marry');
    const all = v.loves.concat(v.likes, v.dislikes);
    all.forEach((id) => { assert.ok(C.ITEMS[id], k + ': ' + id); assert.ok(L.giftable(id), k + ': ' + id + ' can be given'); });
    assert.strictEqual(new Set(all).size, all.length, k + ': no item in two lists');
    const farm = v.loves.concat(v.likes).filter((id) => ['crop', 'dish', 'goods', 'fish', 'produce', 'fruit', 'feed'].indexOf(C.ITEMS[id].kind) >= 0);
    assert.ok(farm.length >= (v.loves.length + v.likes.length) / 2, k + ': the farm feeds Manila');
  });
  // the 7 city people keep their own first hello
  ['rosa', 'danny', 'lando', 'kardo', 'marisol', 'tibo', 'amparo'].forEach((p) => assert.strictEqual(C.DIALOGUE['mn_' + p].intro, C.MANILA.people[p].met));
});

test('birthdays: one each, never a town villager\'s birthday, a festival day or another friend\'s', () => {
  const seen = new Set();
  MF.order.forEach((k) => {
    const b = MF.friends[k].birthday, key = b[0] * 100 + b[1];
    assert.ok(b[0] >= 1 && b[0] <= 12 && b[1] >= 1 && b[1] <= 28, k);
    assert.ok(!seen.has(key), k + ': shared');
    seen.add(key);
    assert.ok(!C.VILLAGER_ORDER.some((v) => C.VILLAGERS[v].birthday[0] === b[0] && C.VILLAGERS[v].birthday[1] === b[1]), k + ': a villager\'s');
    assert.ok(!C.FESTIVALS.some((f) => f.date[0] === b[0] && f.date[1] === b[1]), k + ': a festival');
    const d = dayOn(b[0], b[1]);
    assert.deepStrictEqual(plain(L.mnBirthdaysOn(d)), [k]);
    assert.deepStrictEqual(plain(L.birthdaysOn(d)), [], 'the town\'s calendar of letters never sees them');
  });
});

// ---------- the town's rules ----------
test('a chat once a day (+3), the tiers by hearts, rain, and a new day', () => {
  const s = fresh();
  let r = L.talk(s, 'mn_tibo');
  assert.ok(r.first);
  assert.strictEqual(r.line, C.DIALOGUE.mn_tibo.intro);
  assert.strictEqual(L.friend(s, 'mn_tibo').pts, C.FRIEND.talk);
  r = L.talk(s, 'mn_tibo');
  assert.strictEqual(L.friend(s, 'mn_tibo').pts, C.FRIEND.talk, 'once a day');
  assert.ok(C.DIALOGUE.mn_tibo.tiers[0].indexOf(r.line) >= 0, 'a 0-2 hearts line');
  [[4, 1], [7, 2], [10, 3]].forEach(([h, tier]) => {
    hearts(s, 'mn_tibo', h);
    assert.ok(C.DIALOGUE.mn_tibo.tiers[tier].indexOf(L.talk(s, 'mn_tibo').line) >= 0, h + ' hearts: tier ' + tier);
  });
  clock.nextDay(L, s);
  assert.strictEqual(L.friend(s, 'mn_tibo').talked, 0, 'a new day: chat again');
  const before = L.friend(s, 'mn_tibo').pts;
  L.talk(s, 'mn_tibo');
  assert.strictEqual(L.friend(s, 'mn_tibo').pts, Math.min(100, before + 3));
  // rain (every other day of rain)
  const w = L.weather;
  try {
    L.weather = () => 'rain';
    const t = fresh(); L.talk(t, 'mn_bea'); if (!(t.day % 2)) t.day++;
    assert.strictEqual(L.talk(t, 'mn_bea').line, C.DIALOGUE.mn_bea.rain);
  } finally { L.weather = w; }
});

test('gifts once a day: loves +15, likes +8, neutral +3, dislikes -6 (never below 0)', () => {
  const s = fresh();
  let r = give(s, 'mn_marisol', 'fish_l');
  assert.strictEqual(r.reaction, 'love'); assert.strictEqual(r.pts, 15); assert.strictEqual(r.line, C.DIALOGUE.mn_marisol.gift.love);
  assert.strictEqual(L.friend(s, 'mn_marisol').pts, 15);
  assert.strictEqual(give(s, 'mn_marisol', 'fish_m').error, 'already', 'once a day');
  [['mn_kardo', 'fodder', 'like', 8], ['mn_lando', 'turnip', 'neutral', 3], ['mn_bea', 'okra', 'dislike', 0]].forEach(([k, id, re, pts]) => {
    const g = give(s, k, id);
    assert.strictEqual(g.reaction, re, k);
    assert.strictEqual(L.friend(s, k).pts, pts, k + ': ' + pts);
  });
  hearts(s, 'mn_nena', 3); s.friends.mn_nena.gifted = 0;
  give(s, 'mn_nena', 'ore_copper');
  assert.strictEqual(L.friend(s, 'mn_nena').pts, 24, 'a dislike: -6');
  assert.strictEqual(L.giveGift(s, 'mn_rosa', 99).error, 'nogift');
});

test('birthdays count double, with the birthday line; a chat on the day says so', () => {
  const s = fresh();
  L.talk(s, 'mn_rosa');
  s.day = dayOn(5, 13); // Aling Rosa's
  s.friends.mn_rosa.talked = 0;
  assert.strictEqual(L.talk(s, 'mn_rosa').line, C.DIALOGUE.mn_rosa.bday);
  const r = give(s, 'mn_rosa', 'pumpkin');
  assert.strictEqual(r.pts, 15 * C.FRIEND.birthday);
  assert.strictEqual(r.line, C.DIALOGUE.mn_rosa.birthday);
  assert.strictEqual(L.friend(s, 'mn_rosa').pts, 3 + 3 + 30);
  const t = fresh(); t.day = dayOn(5, 13);
  assert.strictEqual(give(t, 'mn_rosa', 'ore_copper').pts, -6, 'a dislike is not doubled');
  const u = fresh(); u.day = dayOn(5, 14);
  assert.strictEqual(give(u, 'mn_rosa', 'pumpkin').pts, 15, 'the day after: as ever');
});

test('mn_rosa is never the Sunny Inn\'s Rosa, and the town is as it was', () => {
  const s = fresh();
  L.talk(s, 'mn_rosa'); give(s, 'mn_rosa', 'pumpkin');
  assert.ok(!s.friends.rosa || s.friends.rosa.pts === 0, 'the town\'s Rosa untouched');
  L.talk(s, 'rosa'); L.addItem(s, 'cheese', 1); L.giveGift(s, 'rosa', slotOf(s, 'cheese'));
  assert.strictEqual(L.friend(s, 'rosa').pts, 3 + 15, 'Rosa loves cheese');
  assert.strictEqual(L.friend(s, 'mn_rosa').pts, 3 + 15, 'and Aling Rosa kept hers');
  assert.strictEqual(L.reaction('rosa', 'pumpkin'), 'neutral', 'the town\'s Rosa does not love pumpkins');
  assert.strictEqual(L.reaction('mn_rosa', 'cheese'), 'neutral');
  s.day = dayOn(7, 21); // the town Rosa's birthday
  assert.deepStrictEqual(plain(L.birthdaysOn(s.day)), ['rosa']);
  assert.ok(L.mnBirthdaysOn(s.day).indexOf('mn_rosa') < 0);
  // the town's loops over the villagers never meet them
  hearts(s, 'mn_amparo', 9);
  assert.strictEqual(L.heartEvent(s, 'mn_amparo'), null, 'no town heart event');
  L.checkMail(s);
  assert.ok(!s.mail.concat(s.sent).some((m) => /mn_/.test(m)), 'no letters from Manila friends');
  assert.strictEqual(L.vsCount(s), 0);
  assert.strictEqual(L.vsTotal(), C.VILLAGER_ORDER.length * 4, 'the town Friendship Book counts its own steps only');
  assert.ok(!Object.keys(C.VS.stories).some((k) => /^mn_/.test(k)), 'the town\'s stories untouched');
});

test('no marriage in Manila', () => {
  const s = fresh();
  s.builds.bighouse = 1;
  hearts(s, 'mn_bea', 10);
  L.addItem(s, 'blue_feather', 1);
  assert.strictEqual(L.proposeBlock(s, 'mn_bea'), 'notcandidate');
  assert.strictEqual(L.propose(s, 'mn_bea', slotOf(s, 'blue_feather')), 'notcandidate');
  assert.ok(slotOf(s, 'blue_feather') >= 0, 'the feather stays in the bag');
  assert.strictEqual(s.engaged, null);
  MF.order.forEach((k) => assert.strictEqual(L.proposeBlock(s, k), 'notcandidate', k));
});

// ---------- the stories ----------
test('every friend has 4 steps, each a scene with a choice, its rewards real; Lola Amparo\'s each a framed photo', () => {
  assert.deepStrictEqual(plain(MF.hearts), [2, 4, 6, 8]);
  MF.order.forEach((k) => {
    const list = MF.stories[k];
    assert.strictEqual(list.length, 4, k);
    list.forEach((st, i) => {
      const id = k + ' ' + (i + 1);
      assert.ok(st.t && st.hint && st.lines.length && st.choice.a.length === 2, id);
      assert.ok(!st.at && !st.after, id + ': met in the city');
      st.lines.concat(st.thanks || []).forEach((l) => assert.ok(l[0] === 'me' || l[0] === k, id + ': ' + l[0]));
      if (st.bring) { assert.ok(C.ITEMS[st.bring[0]] && st.bring[1] > 0 && st.thanks, id); }
      allRewards(st).forEach((rw) => {
        if (rw.item) assert.ok(C.ITEMS[rw.item] && rw.n > 0, id + ': ' + rw.item);
        if (rw.furn) assert.ok(C.HOME.typeIndex[rw.furn] != null && C.HOME.styleIndex[rw.style] != null, id + ': ' + rw.furn);
        if (rw.photo) assert.ok(C.HOME.styleIndex[rw.style] != null, id + ': photo');
        if (rw.yard) assert.ok(L.vsYardIndex(rw.yard) >= 0, id + ': ' + rw.yard);
        assert.ok(rw.item || rw.gold || rw.seeds || rw.furn || rw.photo || rw.yard || rw.secret, id);
      });
    });
    assert.ok(list[3].reward.some((rw) => rw.secret), k + ': a secret at 8 hearts');
  });
  MF.stories.mn_amparo.forEach((st, i) => assert.ok(st.reward.some((rw) => rw.photo), 'Lola Amparo ' + (i + 1)));
  assert.strictEqual(L.mnsPhotoCount(), 4);
});

// plays a friend's whole story, checking each step opens at its hearts and not before
const playStory = (s, k) => {
  const list = MF.stories[k];
  list.forEach((st, i) => {
    const h = MF.hearts[i];
    hearts(s, k, h - 1);
    assert.strictEqual(L.mnsNext(s, k).state, 'locked', k + ' ' + (i + 1) + ' locked at ' + (h - 1));
    assert.strictEqual(L.mnsReady(s, k), null);
    hearts(s, k, h);
    s.energy = L.maxEnergy(s);
    const go = L.mnsReady(s, k);
    assert.ok(go && go.i === i && go.phase === 'scene', k + ' ' + (i + 1) + ' opens at ' + h);
    const r = L.mnsStart(s, k, i, i % 2);
    if (st.bring) {
      assert.ok(r.asked, k + ' ' + (i + 1) + ': a favour');
      assert.strictEqual(L.mnsNext(s, k).state, 'asked');
      assert.strictEqual(L.mnsHandOver(s, k).error, 'missing');
      L.addItem(s, st.bring[0], st.bring[1]);
      const t = L.mnsReady(s, k);
      assert.strictEqual(t.phase, 'thanks');
      const got = L.mnsHandOver(s, k);
      assert.ok(got.got, k + ' ' + (i + 1) + ': handed over');
      assert.strictEqual(L.countItem(s, st.bring[0]), 0);
    } else assert.ok(r.got, k + ' ' + (i + 1) + ': ' + JSON.stringify(r.error));
    assert.strictEqual(L.mnsDone(s, k), i + 1);
    assert.strictEqual(L.mnsChoice(s, k, i), i % 2);
  });
  assert.strictEqual(L.mnsNext(s, k), null, 'the story is over');
  assert.strictEqual(L.mnsHint(s, k), 'Story complete!');
  assert.ok(L.mnsSecret(s, k));
};

test('each friend\'s 4 steps open at 2, 4, 6 and 8 hearts, give their rewards, and come back after a save', () => {
  MF.order.forEach((k) => {
    const s = fresh();
    const gold = s.gold;
    playStory(s, k);
    const got = [0, 1, 2, 3].flatMap((i) => L.mnsRewards(k, i, i % 2));
    const golds = got.filter((rw) => rw.gold).reduce((a, rw) => a + rw.gold, 0);
    assert.strictEqual(s.gold, gold + golds, k + ': the gold');
    got.filter((rw) => rw.furn || rw.photo).forEach((rw) => {
      const key = L.furnKey(C.HOME.typeIndex[rw.photo ? 'painting' : rw.furn], C.HOME.styleIndex[rw.style || 'classic']);
      assert.ok(s.home.bag[key] >= 1, k + ': ' + (rw.photo || rw.furn) + ' in the house storage');
    });
    got.filter((rw) => rw.yard).forEach((rw) => assert.ok(s.yard.bag[L.vsYardIndex(rw.yard)] >= 1, k + ': ' + rw.yard));
    got.filter((rw) => rw.item).forEach((rw) => assert.ok(L.countItem(s, rw.item) >= rw.n, k + ': ' + rw.item));
    const b = roundTrip(s);
    assert.strictEqual(L.mnsDone(b, k), 4);
    [0, 1, 2, 3].forEach((i) => assert.strictEqual(L.mnsChoice(b, k, i), i % 2));
  });
});

test('a step that asks for a hand takes its energy (and waits when you are too tired); a favour asked is saved', () => {
  const s = fresh();
  hearts(s, 'mn_lando', 6);
  s.friends.mn_lando.vs = 2; // (steps 1 and 2 done)
  s.energy = 5;
  assert.strictEqual(L.mnsNext(s, 'mn_lando').state, 'open');
  assert.strictEqual(L.mnsReady(s, 'mn_lando'), null, 'too tired');
  assert.match(L.mnsNudge(s, 'mn_lando'), /20 energy/);
  s.energy = 50;
  assert.ok(L.mnsStart(s, 'mn_lando', 2, 0).got);
  assert.strictEqual(s.energy, 30);
  const t = fresh();
  hearts(t, 'mn_rosa', 4); t.friends.mn_rosa.vs = 1;
  assert.ok(L.mnsStart(t, 'mn_rosa', 1, 1).asked);
  const b = roundTrip(t);
  assert.strictEqual(L.mnsNext(b, 'mn_rosa').state, 'asked');
  assert.strictEqual(L.mnsChoice(b, 'mn_rosa', 1), 1);
  assert.match(L.talk(b, 'mn_rosa').line, /waiting for 20 Tomato/);
});

test('Lola Amparo\'s photos: a framed old-Manila photo at each step, a Painting for the house', () => {
  const s = fresh();
  playStory(s, 'mn_amparo');
  const ph = L.mnsPhotos(s);
  assert.strictEqual(ph.length, 4);
  assert.deepStrictEqual(ph.map((p) => p.photo), MF.stories.mn_amparo.map((st) => st.reward.filter((rw) => rw.photo)[0].photo));
  const paintings = Object.keys(s.home.bag).filter((k) => Number(k.split('.')[0]) === C.HOME.typeIndex.painting).reduce((a, k) => a + s.home.bag[k], 0);
  assert.strictEqual(paintings, 4, 'four Paintings in the house storage');
  assert.strictEqual(L.vsPhotos(s).length, 0, 'the town\'s Photo wall keeps its own');
});

// ---------- the unlocks ----------
test('Mang Tibo: the train half price at 6 hearts, free at 10, both ways (the first ride is free as ever)', () => {
  const s = fresh();
  s.mn.r = 1; // (the first ride taken)
  assert.strictEqual(L.manilaFare(s), C.MANILA.fare);
  hearts(s, 'mn_tibo', 5);
  assert.strictEqual(L.manilaFare(s), C.MANILA.fare);
  hearts(s, 'mn_tibo', 6);
  assert.strictEqual(L.manilaFare(s), Math.ceil(C.MANILA.fare / 2));
  assert.strictEqual(L.mnFareWhy(s), 'half');
  const g = s.gold;
  assert.ok(L.manilaRide(s).ok);
  assert.strictEqual(s.gold, g - 125, 'charged half');
  hearts(s, 'mn_tibo', 10);
  assert.strictEqual(L.manilaFare(s), 0);
  assert.ok(L.manilaRide(s).ok);
  assert.strictEqual(s.gold, g - 125, 'free');
  const f = fresh();
  hearts(f, 'mn_tibo', 6);
  assert.strictEqual(L.manilaFare(f), 0, 'the first ride still free');
});

const cartFarm = () => {
  const s = fresh(2026, 11, 18);
  s.builds.stable = 1; s.horse = { name: 'Chestnut', love: 0, pet: 0 }; s.gm.cart = 1;
  return s;
};
test('Aling Rosa: a 4th contract a day at 6 hearts (kept while it runs, saved), and tomorrow\'s hot crops at 10', () => {
  const s = cartFarm();
  assert.strictEqual(L.gmContractsOf(s, s.day).length, 3);
  hearts(s, 'mn_rosa', 6);
  const four = L.gmContractsOf(s, s.day);
  assert.strictEqual(four.length, 4);
  const c4 = four[3];
  assert.ok(L.gmIsFourth(c4.k) && c4.rosa && c4.need >= G.contract.min && c4.need <= G.contract.max && c4.need % G.contract.step === 0);
  assert.ok(four.slice(0, 3).every((c) => c.crop !== c4.crop), 'another crop than the day\'s 3');
  assert.strictEqual(L.gmContracts(s).filter((c) => c.day === s.day).length, 4);
  // deliver it from the cart: gold and a Market Star
  const g = s.gold;
  let r = null;
  for (let left = c4.need; left > 0; left -= r.n) { // (the cart holds 100: one load or two)
    L.siloPut(s, c4.crop, 100); L.gmLoadSilo(s, c4.crop, Math.min(100, left));
    r = L.gmDeliver(s, c4.k);
    assert.ok(r.ok, JSON.stringify(r));
  }
  assert.ok(r.done);
  assert.strictEqual(s.gold, g + c4.need * c4.each);
  assert.strictEqual(L.gmStars(s), 1);
  // kept and saved while it runs; gone after its 2 days
  const b = roundTrip(s);
  assert.deepStrictEqual(plain(L.gmContractsOf(b, b.day)[3]), plain(L.gmContractsOf(s, s.day)[3]));
  assert.ok(L.gmContract(b, c4.k).done);
  clock.nextDay(L, b);
  assert.ok(L.gmContracts(b).some((c) => c.k === c4.k), 'tomorrow too, like the 3');
  clock.nextDay(L, b);
  assert.ok(!L.gmContracts(b).some((c) => c.k === c4.k), 'then it ends');
  assert.ok(!Object.keys(b.gm.con).some((k) => Number(k) === c4.k) && !b.gm.cs4[s.day], 'and is let go');
  // tomorrow's hot crops
  assert.strictEqual(L.mnHotTomorrow(s), null);
  hearts(s, 'mn_rosa', 10);
  assert.deepStrictEqual(plain(L.mnHotTomorrow(s)), plain(L.gmHot(s.day + 1)));
  assert.strictEqual(L.mnHotTomorrow(s).length, 3);
});

test('Mang Kardo: his fee 5% at 8 hearts (10% before), the trip keeps the fee it left with, saved', () => {
  const s = cartFarm();
  L.siloPut(s, 'corn', 100); L.gmLoadSilo(s, 'corn', 100);
  let q = L.gmSendQuote(s, 'sell');
  assert.strictEqual(q.fee, Math.round(q.gold * 0.1));
  hearts(s, 'mn_kardo', 8);
  q = L.gmSendQuote(s, 'sell');
  assert.strictEqual(q.fee, Math.round(q.gold * 0.05));
  assert.strictEqual(q.net, q.gold - q.fee);
  const now = L.nowMin();
  assert.ok(L.gmSend(s, 'sell', now).ok);
  assert.strictEqual(s.gm.trip.fee, 0.05);
  const b = roundTrip(s);
  assert.strictEqual(b.gm.trip.fee, 0.05, 'the trip\'s fee is saved');
  hearts(b, 'mn_kardo', 0); // (even a friendship fallen out later: the trip pays as it was quoted)
  const g = b.gold, r = L.gmFinish(b, now + G.driver.mins);
  assert.strictEqual(r.fee, Math.round(r.gold * 0.05));
  assert.strictEqual(b.gold, g + r.gold - r.fee);
  // and without the friendship: 10%, as ever, nothing new in the save
  const t = cartFarm();
  L.siloPut(t, 'corn', 100); L.gmLoadSilo(t, 'corn', 100);
  L.gmSend(t, 'sell', now);
  assert.strictEqual(t.gm.trip.fee, undefined);
  assert.strictEqual(plain(L.serialize(t)).gm[2].length, 4);
  const r2 = L.gmFinish(t, now + G.driver.mins);
  assert.strictEqual(r2.fee, Math.round(r2.gold * G.driver.fee));
});

test('Panday Lando: 10% off bullets and javelins at 8 hearts (their prices unchanged)', () => {
  const s = fresh();
  const p = C.ITEMS.bullets.price;
  assert.strictEqual(L.ammoPrice(s, 'bullets', 1), p);
  let g = s.gold;
  assert.strictEqual(L.buyAmmo(s, 'bullets', 1), 'ok');
  assert.strictEqual(s.gold, g - p);
  hearts(s, 'mn_lando', 8);
  assert.strictEqual(L.ammoPrice(s, 'bullets', 1), Math.round(p * 0.9));
  assert.strictEqual(L.ammoPrice(s, 'javelins', 10), Math.round(C.ITEMS.javelins.price * 10 * 0.9));
  g = s.gold;
  const n = L.countItem(s, 'javelins');
  assert.strictEqual(L.buyAmmo(s, 'javelins', 2), 'ok');
  assert.strictEqual(s.gold, g - Math.round(C.ITEMS.javelins.price * 2 * 0.9));
  assert.strictEqual(L.countItem(s, 'javelins'), n + 2 * C.AMMO.javelins.pack);
  assert.strictEqual(C.ITEMS.bullets.price, 600, 'the price itself stays');
  s.gold = 10;
  assert.strictEqual(L.buyAmmo(s, 'bullets', 1), 'gold');
});

test('Kapitana Marisol: her pier spot at 6 hearts, with the bay\'s bigger fish', () => {
  const s = fresh();
  const dock = C.MANILA.ground.filter((g) => g[0] === 'dock')[0], x = dock[1] + 2, y = dock[2] + 1;
  assert.ok(L.mnOnPier(x, y) && !L.mnOnPier(dock[1] - 3, y));
  assert.strictEqual(L.mnPierWater(s, 'manila', x, y), null);
  hearts(s, 'mn_marisol', 6);
  assert.strictEqual(L.mnPierWater(s, 'manila', x, y), 'mn_pier');
  assert.strictEqual(L.mnPierWater(s, 'town', x, y), null, 'only in Manila');
  assert.strictEqual(L.mnPierWater(s, 'manila', 40, 40), null, 'only on the pier');
  const fish = new Set();
  for (let r = 0; r < 1; r += 0.01) fish.add(L.rollFish('mn_pier', r));
  assert.deepStrictEqual([...fish].sort(), ['fish_k', 'fish_l', 'fish_m'], 'no small fish there');
  assert.ok(MF.pierFish.fish_k > C.FISH_TABLE.river.fish_k && MF.pierFish.fish_l > C.FISH_TABLE.bridge.fish_l, 'better than anywhere');
  assert.ok(Object.keys(MF.pierFish).every((id) => C.FISH_KG[id]), 'the game\'s own fish');
});

test('Mang Danny: one rare trade a week at 8 hearts, fair, the same for everyone that week', () => {
  const s = fresh();
  let o = L.mnTradeOffer(s);
  assert.strictEqual(L.mnTrade(s), 'locked');
  hearts(s, 'mn_danny', 8);
  assert.strictEqual(L.mnTrade(s), 'missing');
  L.addItem(s, o.give, o.n);
  assert.strictEqual(L.mnTrade(s), 'ok');
  assert.strictEqual(L.countItem(s, o.get), o.m);
  assert.strictEqual(L.countItem(s, o.give), 0);
  L.addItem(s, o.give, o.n);
  assert.strictEqual(L.mnTrade(s), 'done', 'once a week');
  assert.strictEqual(L.mnTrade(roundTrip(s)), 'done', 'saved');
  // the next Monday: another offer
  const wd = L.date(s.day).weekday, toMon = ((8 - wd) % 7) || 7;
  s.day += toMon;
  assert.strictEqual(L.date(s.day).weekday, 1);
  o = L.mnTradeOffer(s);
  assert.ok(!o.done);
  assert.strictEqual(L.mnWeek(s.day), L.mnWeek(s.day + 6), 'a week from Monday to Sunday');
  MF.trades.forEach((t) => {
    const give = C.ITEMS[t[0]].sell * t[1], get = C.ITEMS[t[2]].sell * t[3];
    assert.ok(give >= get * 0.75 && give <= get * 1.6, t.join(' ') + ': fair (' + give + ' for ' + get + ')');
    assert.ok(['ore', 'fish', 'crop', 'goods'].indexOf(C.ITEMS[t[0]].kind) >= 0 && C.ITEMS[t[2]].kind === 'ore', t.join(' '));
  });
});

test('Father Ramon\'s blessing: +25 energy once a day at 6 hearts; gives, never takes', () => {
  const s = fresh();
  s.energy = 10;
  assert.strictEqual(L.mnBless(s).why, 'locked');
  hearts(s, 'mn_ramon', 6);
  let r = L.mnBless(s);
  assert.ok(r.ok); assert.strictEqual(r.gain, 25); assert.strictEqual(s.energy, 35);
  assert.strictEqual(L.mnBless(s).why, 'done', 'once a day');
  assert.strictEqual(L.mnBless(roundTrip(s)).why, 'done', 'saved');
  s.day++;
  s.energy = L.maxEnergy(s);
  assert.strictEqual(L.mnBless(s).why, 'full');
  assert.strictEqual(s.energy, L.maxEnergy(s), 'never takes');
  s.energy = L.maxEnergy(s) - 4;
  r = L.mnBless(s);
  assert.strictEqual(r.gain, 4, 'only up to the most');
  s.energy = L.maxEnergy(s) + 30; // (over the most, from storing furniture)
  s.day++;
  assert.strictEqual(L.mnBless(s).why, 'full');
  assert.strictEqual(s.energy, L.maxEnergy(s) + 30);
});

test('Studying with Bea: +40 XP in the skill you pick, once a day at 6 hearts', () => {
  const s = fresh();
  assert.strictEqual(L.mnStudy(s, 'farm').why, 'locked');
  hearts(s, 'mn_bea', 6);
  const r = L.mnStudy(s, 'fish');
  assert.ok(r.ok); assert.strictEqual(r.xp, 40);
  assert.strictEqual(L.skillXp(s, 'fish'), 40);
  assert.strictEqual(L.mnStudy(s, 'farm').why, 'done');
  s.day++;
  assert.strictEqual(L.mnStudy(s, 'nope').why, 'skill');
  s.sk2.mine = C.SKILLS.need[C.SKILLS.max];
  assert.strictEqual(L.mnStudy(s, 'mine').why, 'max', 'a skill at its top: pick another');
  assert.ok(L.mnStudy(s, 'hunt').ok, 'not used up by that');
  assert.strictEqual(L.skillXp(roundTrip(s), 'hunt'), 40);
});

test('Aling Nena: a free carinderia meal once a day at 8 hearts', () => {
  const s = fresh();
  s.energy = 20;
  hearts(s, 'mn_nena', 7);
  assert.strictEqual(L.mnFreeMeal(s).why, 'locked');
  hearts(s, 'mn_nena', 8);
  const g = s.gold, r = L.mnFreeMeal(s);
  assert.ok(r.ok);
  assert.strictEqual(r.gain, C.MANILA.food.meal.energy);
  assert.strictEqual(s.gold, g, 'free');
  assert.strictEqual(L.mnFreeMeal(s).why, 'done');
  s.day++;
  assert.ok(L.mnFreeMeal(s).ok, 'the next day again');
});

test('an unlock reached stays: a dislike later lowers the hearts, never what they gave', () => {
  const s = fresh();
  hearts(s, 'mn_tibo', 6);
  s.mn.r = 1;
  give(s, 'mn_tibo', 'onion');
  assert.strictEqual(L.friendHearts(s, 'mn_tibo'), 5);
  assert.strictEqual(L.mnHearts(s, 'mn_tibo'), 6);
  assert.strictEqual(L.manilaFare(s), 125, 'still half price');
  const b = roundTrip(s);
  assert.strictEqual(L.manilaFare(b), 125, 'after a save too');
  assert.strictEqual(L.mnsNext(b, 'mn_tibo').i, 0, '(the stories follow the same hearts)');
  assert.strictEqual(L.mnUnlock(b, 'mn_tibo').on, true);
});

// ---------- the save ----------
test('the save: nothing new at the top; each friend in fr; round trips; junk is cleaned; generation 3', () => {
  const s = fresh();
  const keys = Object.keys(plain(L.serialize(s))).sort();
  hearts(s, 'mn_rosa', 6); L.talk(s, 'mn_rosa');
  hearts(s, 'mn_ramon', 6); s.energy = 10; assert.ok(L.mnBless(s).ok);
  hearts(s, 'mn_danny', 9); s.friends.mn_danny.vs = 1 | 8 | 16 | 32; // (step 1 done, step 2's favour asked: both answers the second)
  const o = plain(L.serialize(s));
  assert.deepStrictEqual(Object.keys(o).filter((k) => k !== 'gm').sort(), keys.filter((k) => k !== 'gm'), 'no new top-level key');
  assert.strictEqual(o.gg, 3);
  assert.deepStrictEqual(o.fr.mn_rosa.slice(0, 4), [63, 1, 0, 1]);
  assert.strictEqual(o.fr.mn_ramon[7], s.day + 1);
  const b = L.deserialize(o);
  ['mn_rosa', 'mn_ramon', 'mn_danny'].forEach((k) => assert.deepStrictEqual(plain(b.friends[k]), plain(Object.assign({}, s.friends[k], { ev: undefined })), k));
  // junk: out of range numbers, a favour asked where the step has none, a story longer than 4
  const j = plain(o);
  j.fr.mn_rosa = [999, 'x', 1, 1, 0, 255, 99, -5];
  j.fr.mn_bogus = [50, 0, 0, 1];
  const c = L.deserialize(j);
  assert.strictEqual(c.friends.mn_rosa.pts, 100);
  assert.strictEqual(c.friends.mn_rosa.vs & 7, 4);
  assert.strictEqual(c.friends.mn_rosa.best, 10);
  assert.strictEqual(c.friends.mn_rosa.u, undefined);
  assert.ok(!c.friends.mn_bogus, 'only the 10');
  // a new day: chats and gifts again for the Manila friends too
  b.friends.mn_rosa.gifted = 1;
  L.endDay(b);
  assert.strictEqual(b.friends.mn_rosa.talked, 0);
  assert.strictEqual(b.friends.mn_rosa.gifted, 0);
});

test('old saves load unchanged, with no Manila friends yet, and play on', () => {
  const dir = path.join(__dirname, 'old-saves');
  fs.readdirSync(dir).filter((f) => f.endsWith('.json')).forEach((f) => {
    const { save } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const s = L.deserialize(plain(save));
    assert.ok(s, f);
    MF.order.forEach((k) => assert.ok(!s.friends[k], f + ': ' + k));
    C.VILLAGER_ORDER.forEach((k) => { if (save.fr && save.fr[k]) assert.strictEqual(s.friends[k].pts, Math.min(100, Math.max(0, Math.floor(save.fr[k][0]))), f + ': ' + k); });
    assert.strictEqual(L.mnHearts(s, 'mn_tibo'), 0);
    assert.strictEqual(L.mnTradeOffer(s).on, false);
    L.talk(s, 'mn_amparo');
    assert.strictEqual(L.friend(roundTrip(s), 'mn_amparo').pts, 3, f + ': a first chat is kept');
  });
});

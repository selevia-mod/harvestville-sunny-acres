// Manila Friends: the rules and the save (owner, 18 Nov 2026; content: 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-friends.js; the
// world: 19zzz...z-manila-friends.js).
// - Friendship is the town's: L.friend / L.friendHearts / L.talk / L.giveGift with the friend's key ('mn_rosa'), so the
//   town's rules (C.FRIEND, Friendly Thursday, the quests that count a chat or a gift) work for them too. Here: their gifts
//   (L.reaction), their birthdays (L.mnBirthdaysOn: never the town's L.birthdaysOn, whose letters and calendar are the
//   town's), the birthday line and the double gift, and no marriage (L.proposeBlock).
// - Their stories: the town's step format, played by these rules (L.mns*), saved in the friend's own record.
// - What each friendship unlocks (L.mnHas: a friendship's highest hearts, so a dislike later never takes an unlock away):
//   the train (L.manilaFare), a 4th Grand Market contract and tomorrow's hot crops, Mang Kardo's fee, ammo prices, the
//   pier's fish, the weekly rare trade, the blessing, studying with Bea, the free meal.
// - The save: nothing new at the top. Each friend is in 'fr' like a villager: [pts, talked, gifted, met, ev] and after them
//   [story, highest hearts, the day (or week) an unlock was last used], only as long as needed. The 4th contracts go in
//   'gm' (its 8th place), a trip's lower fee in its trip (its 5th place). An older save simply has no Manila friends yet.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var MF = C.MNF;
  var G = C.GRAND_MARKET;
  if (!MF || !MF.on) return;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var DONE = 7, ASKED = 8;
  var U = MF.unlocks;

  // ---------- who ----------
  L.mnIs = function (key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(MF.friends, key); };
  L.mnDef = function (key) { return L.mnIs(key) ? MF.friends[key] : null; };
  L.mnName = function (key) { var d = L.mnDef(key); return d ? d.name : key; };
  // the friend a city person is: one of the 7 (C.MANILA.people: 'rosa'), or a role's person (role, its n)
  L.mnKeyOfPerson = function (person) { return MF.order.filter(function (k) { return MF.friends[k].person === person; })[0] || null; };
  L.mnKeyOfRole = function (role, n) { return MF.order.filter(function (k) { return MF.friends[k].role2 === role && (MF.friends[k].n || 0) === (n || 0); })[0] || null; };

  // ---------- birthdays (their own: the town's calendar of letters never sees them) ----------
  L.mnBirthdaysOn = function (day) {
    var d = L.date(day);
    return MF.order.filter(function (k) { var b = MF.friends[k].birthday; return b[0] === d.month && b[1] === d.day; });
  };
  L.mnBirthday = function (s, key) { return L.mnBirthdaysOn(s.day).indexOf(key) >= 0; };

  // ---------- gifts ----------
  var reaction = L.reaction;
  L.reaction = function (key, id) {
    var v = L.mnDef(key);
    if (!v) return reaction.apply(this, arguments);
    if (v.loves.indexOf(id) >= 0) return 'love';
    if (v.likes.indexOf(id) >= 0) return 'like';
    if (v.dislikes.indexOf(id) >= 0) return 'dislike';
    return 'neutral';
  };
  // A friendship's highest hearts: kept when a dislike lowers them (so an unlock reached stays), else simply the hearts.
  // (never makes a record for someone not met: asking is not meeting)
  L.mnHearts = function (s, key) { var f = s && s.friends && s.friends[key]; return f ? Math.max(f.best || 0, Math.floor((f.pts || 0) / 10)) : 0; };
  L.mnHas = function (s, key, n) { return !!s && L.mnHearts(s, key) >= n; };
  var giveGift = L.giveGift;
  L.giveGift = function (s, key, slotIndex) {
    if (!L.mnIs(key)) return giveGift.apply(this, arguments);
    var before = L.friendHearts(s, key), r = giveGift.apply(this, arguments);
    if (!r || r.error) return r;
    if (r.pts > 0 && L.mnBirthday(s, key)) { // birthdays count double (the town's rule)
      L.addFriend(s, key, r.pts * (C.FRIEND.birthday - 1));
      r.pts *= C.FRIEND.birthday;
      r.line = C.DIALOGUE[key].birthday;
      r.birthday = true;
    }
    var f = L.friend(s, key);
    if (L.friendHearts(s, key) < before) f.best = Math.max(f.best || 0, before);
    return r;
  };
  // no marriage in Manila (owner's design)
  var proposeBlock = L.proposeBlock;
  L.proposeBlock = function (s, key) { return L.mnIs(key) ? 'notcandidate' : proposeBlock.apply(this, arguments); };

  // ---------- a chat: their birthday line (what their story waits for: the town's own nudge, 01-logicZZZZ-friends.js) ----------
  var talk = L.talk;
  L.talk = function (s, key) {
    var r = talk.apply(this, arguments);
    if (r && L.mnIs(key) && !r.first && !r.birthday && L.mnBirthday(s, key)) r.line = C.DIALOGUE[key].bday;
    return r;
  };

  // ---------- the stories: the town's rules (L.vsNext, L.vsReady, L.vsStart, L.vsHandOver...) play them, from
  // C.MNF.stories, each friend's number in s.friends[key].vs. The names below are theirs, for the Manila side. ----------
  ['Story', 'Done', 'Asked', 'Choice', 'Rewards', 'Next', 'Ready', 'Hint', 'Nudge', 'Start', 'HandOver', 'Secret'].forEach(function (n) {
    L['mns' + n] = function () { return L['vs' + n].apply(L, arguments); };
  });
  L.mnsCount = function (s) { return MF.order.reduce(function (a, k) { return a + L.vsDone(s, k); }, 0); };
  L.mnsTotal = function () { return MF.order.reduce(function (a, k) { return a + MF.stories[k].length; }, 0); };
  // what the stories gave: the framed photos (Lola Amparo's old Manila), each friend's secret
  L.mnsPhotos = function (s) {
    var out = [];
    MF.order.forEach(function (key) {
      for (var i = 0; i < L.mnsDone(s, key); i++) L.mnsRewards(key, i, L.mnsChoice(s, key, i)).forEach(function (rw) { if (rw.photo) out.push({ key: key, i: i, photo: rw.photo, style: rw.style || 'classic' }); });
    });
    return out;
  };
  L.mnsPhotoCount = function () {
    var n = 0;
    MF.order.forEach(function (k) { MF.stories[k].forEach(function (st) { if (st.reward.some(function (rw) { return rw.photo; })) n++; }); });
    return n;
  };

  // ---------- the unlocks ----------
  // what a friend's unlock is now, in words: { on, text } (on: reached; text: what it is, or what it waits for)
  L.mnUnlock = function (s, key) {
    var u = U[key];
    if (!u) return null;
    var h = L.mnHearts(s, key), on = h >= u.at;
    if (key === 'mn_tibo') return { on: on, text: h >= u.free ? u.text2 + ' (unlocked)' : on ? u.text + ' (unlocked). At ' + u.free + ' hearts: ' + u.text2.toLowerCase() + '.' : 'At ' + u.at + ' hearts: ' + u.text.toLowerCase() + '.' };
    if (key === 'mn_rosa') return { on: on, text: h >= u.hot ? u.text + ', and ' + u.text2.toLowerCase() + ' (unlocked)' : on ? u.text + ' (unlocked). At ' + u.hot + ' hearts: ' + u.text2.toLowerCase() + '.' : 'At ' + u.at + ' hearts: ' + u.text.toLowerCase() + '.' };
    return { on: on, text: on ? u.text + ' (unlocked)' : 'At ' + u.at + ' hearts: ' + u.text.charAt(0).toLowerCase() + u.text.slice(1) + '.' };
  };
  var used = function (s, key) { var f = s.friends[key]; return (f && f.u) || 0; };
  var use = function (s, key, n) { L.friend(s, key).u = n; };

  // Mang Tibo: the train half price at 6 hearts, free at 10 (both ways; the first ride is free as ever)
  var fare = L.manilaFare;
  L.manilaFare = function (s) {
    var f = fare.apply(this, arguments);
    if (!f || !s || !s.friends) return f;
    if (L.mnHas(s, 'mn_tibo', U.mn_tibo.free)) return 0;
    if (L.mnHas(s, 'mn_tibo', U.mn_tibo.half)) return Math.ceil(f / 2);
    return f;
  };
  L.mnFareWhy = function (s) { return L.mnHas(s, 'mn_tibo', U.mn_tibo.free) ? 'free' : L.mnHas(s, 'mn_tibo', U.mn_tibo.half) ? 'half' : null; };

  // Aling Rosa: a 4th contract a day at 6 hearts (its number: 900,000,000 + the day, apart from the day's 3), kept in the
  // save while it runs like the 3 (gm.cs4); tomorrow's 3 hot crops on her board at 10
  var CON = G && G.contract, K4 = 9e8;
  L.gmIsFourth = function (k) { return k >= K4; };
  if (G) {
    var gmNew = L.gmNew;
    L.gmNew = function () { var g = gmNew.apply(this, arguments); g.cs4 = {}; return g; };
    var steps = Math.floor((CON.max - CON.min) / CON.step) + 1;
    var pick4 = function (s, day, three) {
      var crops = L.gmGrowable(s);
      if (!crops.length) return null;
      var taken = three.map(function (c) { return c.crop; }), fresh = crops.filter(function (c) { return taken.indexOf(c) < 0; }), pool = fresh.length ? fresh : crops;
      var crop = pool[Math.floor(L.gmUnit('con4', (s.seed | 0), day) * pool.length)];
      return [crop, CON.min + CON.step * Math.min(steps - 1, Math.floor(L.gmUnit('need4', (s.seed | 0), day) * steps))];
    };
    var contractsOf = L.gmContractsOf;
    L.gmContractsOf = function (s, day) {
      var list = contractsOf.apply(this, arguments);
      if (!s || !s.friends || !L.mnHas(s, 'mn_rosa', U.mn_rosa.at)) return list;
      var g = s.gm, keep = g && day <= s.day && day > s.day - CON.days, c4 = keep && g.cs4 && g.cs4[day];
      if (!c4) {
        c4 = pick4(s, day, list);
        if (!c4) return list;
        if (keep) (g.cs4 = g.cs4 || {})[day] = c4;
      }
      var each = Math.max(1, Math.round(((C.ITEMS[c4[0]] && C.ITEMS[c4[0]].sell) || 0) * CON.pay));
      return list.concat([{ k: K4 + day, day: day, crop: c4[0], need: c4[1], each: each, rosa: true }]);
    };
    L.mnHotTomorrow = function (s) { return L.mnHas(s, 'mn_rosa', U.mn_rosa.hot) ? L.gmHot(s.day + 1).slice() : null; };

    // Mang Kardo: his fee 10% -> 5% at 8 hearts. A trip keeps the fee it left with (what the quote said is what you get).
    L.gmFeeRate = function (s) { return s && s.friends && L.mnHas(s, 'mn_kardo', U.mn_kardo.at) ? U.mn_kardo.fee : G.driver.fee; };
    var sendQuote = L.gmSendQuote;
    L.gmSendQuote = function (s, how) {
      var q = sendQuote.apply(this, arguments);
      if (q && !q.why) {
        var r = L.gmFeeRate(s);
        if (r !== G.driver.fee) { q.fee = Math.round(q.gold * r); q.net = q.gold - q.fee; }
        q.rate = r;
      }
      return q;
    };
    var gmSend = L.gmSend;
    L.gmSend = function (s, how, now) {
      var q = gmSend.apply(this, arguments);
      if (q && q.ok && s.gm.trip && q.rate != null && q.rate !== G.driver.fee) s.gm.trip.fee = q.rate;
      return q;
    };
    var tripPay = L.gmTripPay;
    L.gmTripPay = function (trip) {
      var r = tripPay.apply(this, arguments);
      if (trip && trip.fee != null) { r.fee = Math.round(r.gold * trip.fee); r.net = r.gold - r.fee; }
      r.rate = trip && trip.fee != null ? trip.fee : G.driver.fee;
      return r;
    };
  }

  // Panday Lando: 10% off bullets and javelins at 8 hearts (their prices themselves stay as they are)
  L.ammoOff = function (s) { return s && s.friends && L.mnHas(s, 'mn_lando', U.mn_lando.at) ? U.mn_lando.off : 0; };
  L.ammoPrice = function (s, id, packs) {
    var p = ((C.ITEMS[id] && C.ITEMS[id].price) || 0) * (packs || 1), off = L.ammoOff(s);
    return off ? Math.max(1, Math.round(p * (1 - off))) : p;
  };
  var buyAmmo = L.buyAmmo;
  if (buyAmmo) {
    L.buyAmmo = function (s, id, packs) {
      if (!C.AMMO || !C.AMMO[id] || !L.ammoOff(s)) return buyAmmo.apply(this, arguments);
      packs = int(packs, 1, 999, 1);
      var n = C.AMMO[id].pack * packs, price = L.ammoPrice(s, id, packs);
      if (s.gold < price) return 'gold';
      if (!L.canAdd(s, id, n)) return 'full';
      s.gold -= price;
      L.addItem(s, id, n);
      return 'ok';
    };
  }

  // Kapitana Marisol: her spot on the pier (the dock's planks) at 6 hearts, with the bay's bigger fish
  C.FISH_TABLE.mn_pier = MF.pierFish;
  var dock = (C.MANILA.ground || []).filter(function (g) { return g[0] === 'dock'; })[0];
  L.mnOnPier = function (tx, ty) { return !!dock && tx >= dock[1] && tx < dock[1] + dock[3] && ty >= dock[2] && ty < dock[2] + dock[4]; };
  L.mnPierWater = function (s, map, tx, ty) { return map === 'manila' && L.mnOnPier(tx, ty) && L.mnHas(s, 'mn_marisol', U.mn_marisol.at) ? 'mn_pier' : null; };

  // Mang Danny: one rare trade a week at 8 hearts (weeks from Monday; the same offer for everyone that week)
  L.mnWeek = function (day) { return Math.floor((day + 3) / 7); }; // (day 0, 1 Jan 1970, was a Thursday)
  L.mnTradeOffer = function (s) {
    var w = L.mnWeek(s.day), t = MF.trades[w % MF.trades.length];
    return { give: t[0], n: t[1], get: t[2], m: t[3], have: L.countItem(s, t[0]), done: used(s, 'mn_danny') === w + 1, on: L.mnHas(s, 'mn_danny', U.mn_danny.at), week: w };
  };
  // 'ok' | 'locked' | 'done' (this week's is made) | 'missing' | 'full'
  L.mnTrade = function (s) {
    var o = L.mnTradeOffer(s);
    if (!o.on) return 'locked';
    if (o.done) return 'done';
    if (o.have < o.n) return 'missing';
    if (!L.canAdd(s, o.get, o.m)) return 'full';
    L.removeItem(s, o.give, o.n);
    L.addItem(s, o.get, o.m);
    use(s, 'mn_danny', o.week + 1); // (+1: week 0 is a week too)
    return 'ok';
  };

  // once a day, from a friend: Father Ramon's blessing, studying with Bea, Aling Nena's free meal. Each gives, never takes:
  // with nothing to give (full of energy, a skill at its top) it is not used up.
  var daily = function (s, key) {
    if (!L.mnHas(s, key, U[key].at)) return 'locked';
    if (used(s, key) === s.day + 1) return 'done'; // (+1: a day is never 0 in play, but the save keeps 0 as none)
    return null;
  };
  L.mnDailyReady = function (s, key) { return !daily(s, key); };
  var energize = function (s, key, n) {
    var why = daily(s, key);
    if (why) return { why: why };
    var gain = Math.max(0, Math.min(n, L.maxEnergy(s) - s.energy));
    if (!gain) return { why: 'full' };
    s.energy += gain;
    use(s, key, s.day + 1);
    return { ok: true, gain: gain };
  };
  L.mnBless = function (s) { return energize(s, 'mn_ramon', U.mn_ramon.energy); };
  L.mnFreeMeal = function (s) { var fd = C.MANILA.food && C.MANILA.food[U.mn_nena.food]; return energize(s, 'mn_nena', fd ? fd.energy : 15); };
  L.mnStudy = function (s, skill) {
    var why = daily(s, 'mn_bea');
    if (why) return { why: why };
    var SK = C.SKILLS;
    if (!SK || !SK.skills[skill]) return { why: 'skill' };
    if (L.skillXp(s, skill) >= SK.need[SK.max]) return { why: 'max' };
    var before = L.skillXp(s, skill), up = L.skillAdd(s, skill, U.mn_bea.xp);
    if (L.skillXp(s, skill) <= before) return { why: 'max' };
    use(s, 'mn_bea', s.day + 1);
    return { ok: true, xp: L.skillXp(s, skill) - before, level: up };
  };

  // ---------- a new day: chats and gifts again ----------
  L.mnNewDay = function (s) {
    MF.order.forEach(function (k) { var f = s.friends && s.friends[k]; if (f) { f.talked = 0; f.gifted = 0; } });
  };
  var endDay = L.endDay;
  L.endDay = function (s) {
    var r = endDay.apply(this, arguments);
    L.mnNewDay(s);
    var g = s.gm;
    if (g && G) {
      if (g.con) Object.keys(g.con).forEach(function (k) { if (Number(k) >= K4 && Number(k) - K4 <= s.day - CON.days) delete g.con[k]; });
      if (g.cs4) Object.keys(g.cs4).forEach(function (d) { if (Number(d) <= s.day - CON.days) delete g.cs4[d]; });
    }
    return r;
  };

  // ---------- the save ----------
  // a story's saved number, kept to what the story can be (as the town's)
  var clean = function (key, n) {
    var list = MF.stories[key];
    var done = Math.min(n & DONE, list.length), keep = done + ((n & ASKED) && list[done] && list[done].bring ? 1 : 0);
    var out = done | (keep > done ? ASKED : 0);
    for (var i = 0; i < keep; i++) out |= ((n >> (4 + i)) & 1) << (4 + i);
    return out;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize.apply(this, arguments);
    if (o && o.fr) {
      MF.order.forEach(function (k) {
        var f = s.friends[k], a = o.fr[k];
        if (!f || !Array.isArray(a)) return;
        var more = [f.vs || 0, f.best || 0, f.u || 0];
        while (more.length && !more[more.length - 1]) more.pop();
        if (more.length) { while (a.length < 5) a.push(0); o.fr[k] = a.concat(more); }
      });
    }
    var g = s.gm;
    if (g && G) {
      var cs4 = [];
      Object.keys(g.cs4 || {}).sort(function (x, y) { return x - y; }).forEach(function (d) { cs4.push(Number(d), g.cs4[d][0], g.cs4[d][1]); });
      var fee = g.trip && g.trip.fee != null ? Math.round(g.trip.fee * 1000) : null;
      if (cs4.length || fee != null) {
        if (!o.gm) o.gm = [0, [], 0, [], 0, 0, []];
        if (cs4.length) o.gm[7] = cs4;
        if (fee != null && Array.isArray(o.gm[2])) o.gm[2][4] = fee;
      }
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize.apply(this, arguments);
    if (!s) return s;
    var fr = o && o.fr && typeof o.fr === 'object' ? o.fr : {};
    MF.order.forEach(function (k) {
      delete s.friends[k];
      var a = fr[k];
      if (!Array.isArray(a)) return;
      var f = s.friends[k] = { pts: int(a[0], 0, C.FRIEND.max, 0), talked: a[1] ? 1 : 0, gifted: a[2] ? 1 : 0, met: a[3] ? 1 : 0 };
      var ev = int(a[4], 0, 255, 0), vs = clean(k, int(a[5], 0, 255, 0)), best = int(a[6], 0, 10, 0), u = int(a[7], 0, 1e7, 0);
      if (ev) f.ev = ev;
      if (vs) f.vs = vs;
      if (best) f.best = best;
      if (u) f.u = u;
    });
    var g = s.gm, b = o && Array.isArray(o.gm) ? o.gm : null;
    if (g && G && b) {
      var c4 = Array.isArray(b[7]) ? b[7] : [];
      for (var i = 0; i + 2 < c4.length; i += 3) {
        var d = int(c4[i], 0, 1e7, -1), crop = c4[i + 1], need = int(c4[i + 2], 1, 1e5, 0);
        if (d >= 0 && typeof crop === 'string' && crop.length <= 40 && need) g.cs4[d] = [crop, need];
      }
      if (g.trip && Array.isArray(b[2]) && b[2][4] != null) {
        var fee = int(b[2][4], 0, 1000, -1);
        if (fee >= 0) g.trip.fee = fee / 1000;
      }
    }
    return s;
  };
})(window.Farm = window.Farm || {});

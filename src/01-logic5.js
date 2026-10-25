// Rules for the bigger Willowbrook (content in 00-town2.js): days of the week and rest-day schedules, shops open
// on some days only, animal treats, mailing a gift, resting at the chapel, helping at school, and Marco's
// daily furniture deals. Wraps the earlier logic files.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;

  // ---------- the week ----------
  L.weekday = function (day) { return ((day - 1) % 7) + 1; }; // 1..7
  L.restDay = function (day) { return C.REST_DAYS.indexOf(L.weekday(day)) >= 0; };

  // On rest days the children have no school (and Clara no class): they follow their `rest` schedule.
  var villagerAt = L.villagerAt;
  L.villagerAt = function (s, key, time) {
    var v = C.VILLAGERS[key], fest = L.festivalOn(s.day);
    if (v.rest && L.restDay(s.day) && s.spouse !== key && !(fest && time >= fest.from - 30 && time < fest.to)) {
      var at = v.rest[0][1];
      v.rest.forEach(function (e) { if (time >= e[0]) at = e[1]; });
      return at;
    }
    return villagerAt(s, key, time);
  };

  var buildingOpen = L.buildingOpen;
  L.buildingOpen = function (s, key) {
    var b = C.BUILDINGS[key];
    if (b && b.days && b.days.indexOf(L.weekday(s.day)) < 0) return false;
    return buildingOpen(s, key);
  };

  // ---------- animal treats (from the vet) ----------
  // Returns 'ok', 'notreat', 'already' (one a day each) or 'max'.
  L.giveTreat = function (s, i, slotIndex) {
    var a = s.animals[i], slot = s.inv[slotIndex];
    if (!a) return 'none';
    if (!slot || slot.id !== 'treat') return 'notreat';
    if (a.treat) return 'already';
    if (a.love >= C.LOVE.max) return 'max';
    L.removeAt(s, slotIndex, 1);
    a.treat = 1;
    a.love = Math.min(C.LOVE.max, a.love + C.TREAT_LOVE);
    return 'ok';
  };

  // ---------- the post office: mail the item in a slot to a villager ----------
  // Counts as the day's gift to them, for C.POST_SHARE of the friendship. Returns { error } or giveGift's result.
  L.mailGift = function (s, key, slotIndex) {
    var slot = s.inv[slotIndex], f = L.friend(s, key);
    if (!C.VILLAGERS[key] || !f.met) return { error: 'who' };
    if (!slot || !L.giftable(slot.id)) return { error: 'item' };
    if (f.gifted) return { error: 'gifted' };
    if (s.gold < C.POST_FEE) return { error: 'gold' };
    s.gold -= C.POST_FEE;
    var before = f.pts, r = L.giveGift(s, key, slotIndex);
    if (r.error) { s.gold += C.POST_FEE; return r; }
    var got = f.pts - before;
    if (got > 0) L.addFriend(s, key, Math.round(got * C.POST_SHARE) - got);
    r.pts = f.pts - before;
    return r;
  };

  // ---------- the chapel: sit and rest, once a day ----------
  L.chapelRest = function (s) {
    if (s.chapelDay === s.day) return 0;
    s.chapelDay = s.day;
    var gain = Math.max(0, Math.min(C.CHAPEL_REST.energy, L.maxEnergy(s) - s.energy));
    s.energy += gain;
    s.time = Math.min(C.PASS_OUT - 1, s.time + C.CHAPEL_REST.minutes);
    return gain || -1;
  };

  // ---------- the school: help with a lesson, once a day (friendship with the teacher and the children) ----------
  L.schoolKids = function () { return C.VILLAGER_ORDER.filter(function (k) { return C.VILLAGERS[k].child; }); };
  L.helpSchool = function (s) {
    if (!L.buildingOpen(s, 'school')) return 'closed';
    if (s.schoolDay === s.day) return 'already';
    s.schoolDay = s.day;
    ['clara'].concat(L.schoolKids()).forEach(function (k) {
      L.friend(s, k).met = 1;
      L.addFriend(s, k, C.SCHOOL_HELP.pts);
    });
    s.time = Math.min(C.PASS_OUT - 1, s.time + C.SCHOOL_HELP.minutes);
    return 'ok';
  };

  // ---------- Marco's wagon: a few pieces of furniture each day, any style (festival ones too), discounted ----------
  L.wagonDeals = function (s) {
    var out = [], seen = {};
    for (var k = 0; out.length < C.WAGON.deals && k < 40; k++) {
      var t = Math.floor(L.rand(s.seed, s.day, 900 + k) * H.types.length);
      var v = 1 + Math.floor(L.rand(s.seed, s.day, 950 + k) * (H.styles.length - 1));
      if (H.types[t].needs || seen[t + '.' + v]) continue;
      seen[t + '.' + v] = 1;
      out.push({ t: t, v: v, price: Math.round(L.furnPrice(t, v) * (1 - C.WAGON.off) / 10) * 10 });
    }
    return out;
  };

  L.buyDeal = function (s, i) {
    var d = L.wagonDeals(s)[i];
    if (!d) return 'none';
    if (!L.buildingOpen(s, 'wagon')) return 'closed';
    if (s.gold < d.price) return 'gold';
    s.gold -= d.price;
    var k = L.furnKey(d.t, d.v);
    s.home.bag[k] = (s.home.bag[k] || 0) + 1;
    return 'ok';
  };

  // ---------- day end and save ----------
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info);
    s.animals.forEach(function (a) { a.treat = 0; });
    return r;
  };

  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    var treated = [];
    s.animals.forEach(function (a, i) { if (a.treat) treated.push(i); });
    o.tw = [s.chapelDay || 0, s.schoolDay || 0, treated];
    return o;
  };

  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var tw = Array.isArray(o.tw) ? o.tw : [];
    s.chapelDay = Number(tw[0]) === s.day ? s.day : 0;
    s.schoolDay = Number(tw[1]) === s.day ? s.day : 0;
    (Array.isArray(tw[2]) ? tw[2] : []).forEach(function (i) { if (s.animals[i]) s.animals[i].treat = 1; });
    return s;
  };
})(window.Farm = window.Farm || {});

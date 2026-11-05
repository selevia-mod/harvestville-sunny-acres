// Villager friendship stories, the rules and the save (owner, 6 Nov 2026; the stories: 00-zzzzzzzzzzz-friends.js, on
// screen: 19zzzz-friends.js). Each villager's story is one small number in the save, saved as 'vf' (a list in
// C.VILLAGER_ORDER, which only ever grows at the end): bits 0-2 = steps finished (0 to 4), bit 3 = the next step's
// favour was asked, bits 4-7 = which answer you picked at each step. Everything else (recipes you were taught, friend
// prices, photos, secrets) follows from that, so an older save simply has no stories yet.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var VS = C.VS;

  // The Friendship Book's first-time tour (19zzzz-friends.js). Appended last: a tip is its place in a saved number.
  C.TIPS.push({ key: 'friends_tour', text: 'FRIENDSHIP BOOK' });

  var DONE = 7, ASKED = 8;
  var code = function (s, key) { return (s.vf && s.vf[key]) || 0; };
  var setCode = function (s, key, n) { if (!s.vf) s.vf = {}; if (n) s.vf[key] = n; else delete s.vf[key]; };
  var name = function (key) { return C.VILLAGERS[key] ? C.VILLAGERS[key].name : key; };
  // Lumber and Stone are not bag items: the farm keeps them as two counts (s.lumber, s.stone), like Mira's materials.
  var MAT = { lumber: 'Lumber', stone: 'Stone' };
  var itemName = function (id) { return MAT[id] || (C.ITEMS[id] ? C.ITEMS[id].name : id); };
  L.vsHave = function (s, id) { return MAT[id] ? s[id] || 0 : L.countItem(s, id); };
  var takeAway = function (s, id, n) { if (MAT[id]) s[id] -= n; else L.removeItem(s, id, n); };
  var addTo = function (s, id, n) { if (MAT[id]) s[id] = (s[id] || 0) + n; else L.addItem(s, id, n); };
  L.vsItemIcon = function (id) { return MAT[id] ? C.ICON[id] : C.ITEMS[id].icon; };

  L.vsStory = function (key) { return VS.stories[key] || null; };
  L.vsDone = function (s, key) { return code(s, key) & DONE; };
  L.vsAsked = function (s, key) { return !!(code(s, key) & ASKED); };
  L.vsChoice = function (s, key, i) { return (code(s, key) >> (4 + i)) & 1; };
  L.vsCount = function (s) { return C.VILLAGER_ORDER.reduce(function (a, k) { return a + L.vsDone(s, k); }, 0); };
  L.vsTotal = function () { return C.VILLAGER_ORDER.reduce(function (a, k) { return a + (VS.stories[k] ? VS.stories[k].length : 0); }, 0); };

  // What a step gives for the answer picked (an answer with its own reward takes the place of the step's).
  L.vsRewards = function (key, i, choice) {
    var st = VS.stories[key][i], a = st.choice && st.choice.a[choice];
    return (a && a[2] && a[2].reward) || st.reward || [];
  };

  // ---------- where and when ----------
  L.vsPlaceName = function (at) {
    if (/^in:/.test(at)) { var b = C.BUILDINGS[at.slice(3)], n = b ? b.name : at.slice(3); return /'s /.test(n) ? n : 'the ' + n; } // "Hana's Bakery", "the Chapel"
    return VS.places[at] || at;
  };
  var short = function (m) {
    m = Math.min(m, C.SHOP_CLOSE);
    var h = Math.floor(m / 60) % 24, mm = m % 60;
    return (h % 12 === 0 ? 12 : h % 12) + (mm ? ':' + (mm < 10 ? '0' : '') + mm : '') + (h < 12 ? ' AM' : ' PM');
  };
  var windows = function (sched, at) {
    var out = [];
    (sched || []).forEach(function (e, k) {
      if (e[1] !== at) return;
      out.push(short(e[0]) + '-' + short(k + 1 < sched.length ? sched[k + 1][0] : C.SHOP_CLOSE));
    });
    return out;
  };
  // "between 5 PM-7 PM", from the villager's day (and their rest days, when those differ)
  L.vsWhen = function (key, at) {
    var v = C.VILLAGERS[key], w = windows(v.schedule, at).join(' or ');
    if (!v.rest) return w;
    var r = windows(v.rest, at).join(' or ');
    if (r === w) return w;
    return (w ? w + ' on school days' : '') + (w && r ? ', ' : '') + (r ? r + ' on Saturdays and Sundays' : '');
  };
  // Where the step happens, as words: "at the gazebo (5 PM-7 PM)".
  L.vsWhere = function (key, st) {
    if (!st.at) return '';
    var when = L.vsWhen(key, st.at);
    return ' at ' + L.vsPlaceName(st.at) + (when ? ' (' + when + ')' : '');
  };
  // Is the villager where the step wants them, now? (A spouse lives with you: anywhere will do.)
  L.vsHere = function (s, key, st) {
    if (!st.at || s.spouse === key) return true;
    return L.villagerAt(s, key, s.time) === st.at;
  };

  // ---------- the next step ----------
  // { i, step, hearts, state }: state 'locked' (not enough hearts, or not met), 'after' (waits on a friend's story),
  // 'open' (it can play) or 'asked' (the favour is asked; bring the things). null when the story is over.
  L.vsNext = function (s, key) {
    var list = VS.stories[key];
    if (!list) return null;
    var i = L.vsDone(s, key);
    if (i >= list.length) return null;
    var st = list[i], r = { i: i, step: st, hearts: VS.hearts[i] };
    if (L.vsAsked(s, key) && st.bring) r.state = 'asked';
    else if (!L.friend(s, key).met || L.friendHearts(s, key) < VS.hearts[i]) r.state = 'locked';
    else if (st.after && L.vsDone(s, st.after[0]) < st.after[1]) r.state = 'after';
    else r.state = 'open';
    return r;
  };

  // The step to play now, when you talk to them: { i, step, phase: 'scene' | 'thanks' }, or null.
  L.vsReady = function (s, key) {
    var n = L.vsNext(s, key);
    if (!n) return null;
    var st = n.step;
    if (n.state === 'asked') return L.vsHave(s, st.bring[0]) >= st.bring[1] ? { i: n.i, step: st, phase: 'thanks' } : null;
    if (n.state !== 'open' || !L.vsHere(s, key, st)) return null;
    if (st.help && s.energy < st.help) return null;
    return { i: n.i, step: st, phase: 'scene' };
  };

  // What to do next, in words (the Friendship Book, and the line added when you talk to them).
  L.vsHint = function (s, key) {
    var n = L.vsNext(s, key), who = name(key);
    if (!n) return VS.stories[key] ? 'Story complete!' : '';
    var st = n.step;
    if (n.state === 'locked') return 'At ' + n.hearts + ' hearts: ' + st.hint;
    if (n.state === 'after') {
      var other = VS.stories[st.after[0]][st.after[1] - 1];
      return st.hint + ' (First: ' + name(st.after[0]) + "'s story, \"" + other.t + '".)';
    }
    if (n.state === 'asked') return 'Bring ' + who + ' ' + st.bring[1] + ' ' + itemName(st.bring[0]) + ' (you have ' + L.vsHave(s, st.bring[0]) + ').';
    var where = L.vsWhere(key, st);
    if (st.help) return 'Help ' + who + where + '. It takes ' + st.help + ' energy.';
    return (st.at ? 'Meet ' + who + where : 'Talk to ' + who) + '.';
  };
  // Added to a chat when the step is open but this is not the place, the time or the energy for it, or the favour waits.
  L.vsNudge = function (s, key) {
    var n = L.vsNext(s, key);
    if (!n || (n.state !== 'open' && n.state !== 'asked') || L.vsReady(s, key)) return null;
    var st = n.step;
    if (n.state === 'asked') return name(key) + ' is waiting for ' + st.bring[1] + ' ' + itemName(st.bring[0]) + '. You have ' + L.vsHave(s, st.bring[0]) + '.';
    if (!L.vsHere(s, key, st)) return 'Friendship Book: ' + name(key) + ' wants to see you' + L.vsWhere(key, st) + '.';
    if (st.help && s.energy < st.help) return 'Friendship Book: ' + name(key) + ' could use a hand. Come back with ' + st.help + ' energy.';
    return null;
  };

  // ---------- rewards ----------
  // This season's dearest seeds (the best a friend has to give): not grass.
  L.vsSeasonSeed = function (s) {
    var best = null;
    L.seedsInSeason(s.day).forEach(function (id) {
      if (id === 'seed_grass' || !C.ITEMS[id]) return;
      if (!best || (C.ITEMS[id].price || 0) > (C.ITEMS[best].price || 0)) best = id;
    });
    return best || L.starterSeed(s);
  };
  var furnOf = function (rw) { return { t: C.HOME.typeIndex[rw.photo ? 'painting' : rw.furn], v: C.HOME.styleIndex[rw.style || 'classic'] }; };
  var yardOf = function (key) { var t = -1; C.OUTDOOR.types.forEach(function (o, k) { if (o.key === key) t = k; }); return t; };
  L.vsYardIndex = yardOf;
  // Words for a reward, as the reward card and the book show it.
  L.vsRewardText = function (key, rw, seed) {
    if (rw.item) return rw.n + ' ' + itemName(rw.item);
    if (rw.gold) return String(rw.gold).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'G';
    if (rw.seeds) return rw.seeds + ' ' + (seed ? itemName(seed) : "packets of the season's best seeds");
    if (rw.recipe) return 'Recipe: ' + itemName(VS.recipes[rw.recipe].dish) + ' (cook it in your Kitchen)';
    if (rw.photo) return 'A framed photo: "' + rw.photo + '" (it hangs in your house as a Painting)';
    if (rw.furn) { var f = furnOf(rw); return C.HOME.styles[f.v].name + ' ' + C.HOME.types[f.t].name + ', for your house'; }
    if (rw.yard) { var y = C.OUTDOOR.types[yardOf(rw.yard)]; return (y ? y.name : rw.yard) + ', for your yard'; }
    if (rw.off) return 'Friend price: ' + Math.round(rw.off * 100) + '% off at ' + VS.shops[key].name;
    if (rw.secret) return 'A secret, kept in your Friendship Book';
    return '';
  };
  L.vsRewardIcon = function (key, rw, seed) {
    if (rw.item) return L.vsItemIcon(rw.item);
    if (rw.gold) return C.ICON.coin;
    if (rw.seeds) return seed && C.ITEMS[seed] ? C.ITEMS[seed].icon : C.ICON.seed_turnip;
    if (rw.recipe) return C.ITEMS[VS.recipes[rw.recipe].dish].icon;
    if (rw.photo) return C.ICON.heart;
    if (rw.off) return C.ICON.tag;
    if (rw.secret) return C.ICON.book;
    return C.ICON.sparkle;
  };
  // Room in the bag for what the step gives (the house and the yard always have room in storage).
  var room = function (s, key, list) {
    for (var k = 0; k < list.length; k++) {
      var rw = list[k], id = rw.item || (rw.seeds ? L.vsSeasonSeed(s) : null);
      if (MAT[id]) continue;
      if (id && !L.canAdd(s, id, rw.item ? rw.n : rw.seeds)) return id;
    }
    return null;
  };
  var give = function (s, key, rw) {
    var seed = null;
    if (rw.item) addTo(s, rw.item, rw.n);
    else if (rw.gold) s.gold += rw.gold;
    else if (rw.seeds) { seed = L.vsSeasonSeed(s); L.addItem(s, seed, rw.seeds); }
    else if (rw.furn || rw.photo) { var f = furnOf(rw), k = L.furnKey(f.t, f.v); s.home.bag[k] = (s.home.bag[k] || 0) + 1; }
    else if (rw.yard) { var t = yardOf(rw.yard); s.yard.bag[t] = (s.yard.bag[t] || 0) + 1; }
    return { icon: L.vsRewardIcon(key, rw, seed), text: L.vsRewardText(key, rw, seed), rw: rw };
  };

  // Finishes step i with answer `choice`: the rewards, the friendship, the save. { got: [{ icon, text }] } or { error }.
  var finish = function (s, key, i, choice) {
    var st = VS.stories[key][i], list = L.vsRewards(key, i, choice), a = st.choice.a[choice] || [];
    var full = room(s, key, list);
    if (full) return { error: 'full', item: full };
    if (st.help) {
      if (s.energy < st.help) return { error: 'energy' };
      s.energy -= st.help;
    }
    var got = list.map(function (rw) { return give(s, key, rw); });
    setCode(s, key, ((code(s, key) & ~(DONE | ASKED)) | (i + 1)) | ((choice ? 1 : 0) << (4 + i)));
    var f = L.friend(s, key);
    f.met = 1;
    L.addFriend(s, key, VS.pts + (st.bring ? 0 : (a[2] && a[2].pts) || 0)); // (a favour's answer counted when it was asked)
    return { got: got, i: i, step: st };
  };

  // After the scene's choice: a favour is asked ({ asked: true }), anything else finishes ({ got }); or { error }.
  L.vsStart = function (s, key, i, choice) {
    var n = L.vsNext(s, key);
    if (!n || n.i !== i || n.state !== 'open') return { error: 'step' };
    var st = n.step, a = st.choice.a[choice];
    if (!a) return { error: 'choice' };
    if (st.bring) {
      setCode(s, key, (code(s, key) & ~(1 << (4 + i))) | ASKED | ((choice ? 1 : 0) << (4 + i)));
      L.addFriend(s, key, (a[2] && a[2].pts) || 0);
      return { asked: true, i: i, step: st };
    }
    return finish(s, key, i, choice);
  };

  // Hands the favour over: the things leave the bag, and the step is done. { got } or { error: 'missing' | 'full' | 'step' }.
  L.vsHandOver = function (s, key) {
    var n = L.vsNext(s, key);
    if (!n || n.state !== 'asked') return { error: 'step' };
    var b = n.step.bring;
    if (L.vsHave(s, b[0]) < b[1]) return { error: 'missing' };
    takeAway(s, b[0], b[1]);
    var r = finish(s, key, n.i, L.vsChoice(s, key, n.i));
    if (r.error) addTo(s, b[0], b[1]);
    return r;
  };

  // ---------- what the stories gave you ----------
  var each = function (s, fn) {
    C.VILLAGER_ORDER.forEach(function (key) {
      if (!VS.stories[key]) return;
      for (var i = 0; i < L.vsDone(s, key); i++) L.vsRewards(key, i, L.vsChoice(s, key, i)).forEach(function (rw) { fn(key, i, rw); });
    });
  };
  // The dishes friends taught you, in the book's order: [{ dish, needs }].
  L.vsRecipes = function (s) {
    var got = {};
    each(s, function (key, i, rw) { if (rw.recipe) got[rw.recipe] = 1; });
    return Object.keys(VS.recipes).filter(function (r) { return got[r]; }).map(function (r) { return { dish: VS.recipes[r].dish, needs: VS.recipes[r].needs.slice(), story: r }; });
  };
  // How much cheaper a friend's shop is for you, for this item (0 to VS.maxOff).
  L.vsOff = function (s, id) {
    var it = C.ITEMS[id], off = 0;
    if (!it || !s) return 0;
    each(s, function (key, i, rw) { if (rw.off && VS.shops[key] && VS.shops[key].has(id, it)) off += rw.off; });
    return Math.min(VS.maxOff, off);
  };
  L.vsPhotos = function (s) {
    var out = [];
    each(s, function (key, i, rw) { if (rw.photo) out.push({ key: key, i: i, photo: rw.photo, people: rw.people || [key], style: rw.style || 'classic' }); });
    return out;
  };
  L.vsSecret = function (s, key) {
    var out = null;
    for (var i = 0; i < L.vsDone(s, key); i++) L.vsRewards(key, i, L.vsChoice(s, key, i)).forEach(function (rw) { if (rw.secret) out = rw.secret; });
    return out;
  };

  // ---------- friend prices ----------
  // L.priceOf(id, day) has no farm to ask, so the price a farm pays is worked out while L.buy runs for it, or when a
  // screen passes the farm (L.priceOf(id, day, s)).
  var priceOf = L.priceOf, shopper = null;
  L.priceOf = function (id, day, s) {
    var p = priceOf(id, day), off = L.vsOff(s || shopper, id);
    return off > 0 ? Math.max(1, Math.round(p * (1 - off))) : p;
  };
  var buy = L.buy;
  L.buy = function (s, id, qty) {
    var was = shopper;
    shopper = s;
    try { return buy(s, id, qty); } finally { shopper = was; }
  };

  // ---------- a chat says what the story waits for ----------
  var talk = L.talk;
  L.talk = function (s, key) {
    var r = talk(s, key);
    if (r && !r.first && VS.stories[key]) {
      var n = L.vsNudge(s, key);
      if (n) r.line = r.line + '\n\n(' + n + ')';
    }
    return r;
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function () {
    var s = newState.apply(this, arguments);
    s.vf = {};
    return s;
  };
  // A saved number, kept to what the story can be: no more steps than it has, "asked" only for a favour, answers
  // only for the steps reached.
  var clean = function (key, n) {
    var list = VS.stories[key];
    if (!list) return 0;
    var done = Math.min(n & DONE, list.length), keep = done + ((n & ASKED) && list[done] && list[done].bring ? 1 : 0);
    var out = done | (keep > done ? ASKED : 0);
    for (var i = 0; i < keep; i++) out |= ((n >> (4 + i)) & 1) << (4 + i);
    return out;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), a = C.VILLAGER_ORDER.map(function (k) { return code(s, k); });
    while (a.length && !a[a.length - 1]) a.pop();
    if (a.length) o.vf = a;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.vf = {};
    if (o && Array.isArray(o.vf)) {
      o.vf.slice(0, C.VILLAGER_ORDER.length).forEach(function (n, i) {
        n = Math.floor(Number(n));
        if (!(n > 0 && n < 256)) return;
        var c = clean(C.VILLAGER_ORDER[i], n);
        if (c) s.vf[C.VILLAGER_ORDER[i]] = c;
      });
    }
    return s;
  };
})(window.Farm = window.Farm || {});

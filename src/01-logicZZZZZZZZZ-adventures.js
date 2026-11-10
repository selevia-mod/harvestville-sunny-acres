// Daily adventures, the rules (owner, 8 Nov 2026; docs/quests-adventures.md; content 00-zzzzzzzzzzzzzz-adventures.js):
//  - a new day: 6 daily quests, 3 normal and 3 adventures (an easy, a medium and a hard one, from places you opened);
//    any 5 claimed open the day's chest, all 6 give a Sunbeam more
//  - an adventure: its pieces are found (or its marked creature hunted) only while it is on; handed over to whoever
//    asked, it is claimed there (its prize, and hearts with a villager)
//  - a new week: the weekly chest opens with 5 good days (a day whose chest you opened), Monday to Sunday
//  - the month is as it was (owner: "We cannot change the monthly quest now"); its goals still count
// A day (or week) made before this keeps its own list until the next one. Saved: 'av'.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var Q = C.QUESTS, D = C.DAILY2;

  C.TIPS.push({ key: 'adv_tour', text: 'DAILY ADVENTURES' }); // (last: older saves keep their tips)
  if (C.COUNTERS.indexOf('adv') < 0) C.COUNTERS.push('adv'); // (appended: the saved counters keep their places)
  C.QUEST_PLACES.adv = { map: 'town', to: 'adv', say: '' }; // (where it leads is the adventure's own: 19zzzzzzzzzzzzzz-adventures.js)

  var BY = {};
  C.ADVENTURES.forEach(function (a, i) { a.i = i; BY[a.key] = a; });
  L.advDef = function (key) { return BY[key] || null; };
  L.advOf = function (q) { return q && q.c === 'adv' ? BY[q.a] || null : null; };
  L.advWho = function (a) { return C.ADVENTURE_PEOPLE[a.who] ? C.ADVENTURE_PEOPLE[a.who].name : C.VILLAGERS[a.who] ? C.VILLAGERS[a.who].name : a.who; };
  L.advIcon = function (a) { return (a.story ? C.STORY_ICONS_IN : C.ADVENTURE_ICONS_IN) ? C.ICON['qi_' + a.key] : C.ICON.sparkle; };
  L.advItemName = function (a, n) { return n > 1 ? (a.items || a.item + 's') : a.item; };
  L.advText = function (a) { return L.advWho(a) + ': ' + (a.n > 1 ? a.n + ' ' : '') + L.advItemName(a, a.n); };
  // the place's name ('the mine', 'your farm', 'town', a hunting place's)
  L.advWhere = function (a) {
    if (a.map === 'farm') return 'your farm';
    if (a.map === 'town') return 'town';
    if (a.map === 'mine') return 'the mine';
    if (a.map === 'house') return 'your kitchen';
    var w = C.WILD.areas[a.map];
    return w ? w.name : a.map;
  };
  // Can this farm go there? (the mine, the farm and town: anyone; a hunting place: once open)
  L.advOpen = function (s, a) {
    if (a.map === 'farm' || a.map === 'town' || a.map === 'mine' || a.map === 'house') return true;
    return L.isWildMap(a.map) && L.wildOpen(s, a.map);
  };
  // Bram's hammer lies on one floor of the mine (1 to 10, no deeper than you have been, the same all day)
  L.advFloor = function (s, d) { var most = Math.max(1, Math.min(10, (s.stats && s.stats.deepest) || 1)); return 1 + Math.floor(L.rand(s.seed || 1, d * 13 + 5, 3) * most) % most; };

  // ---------- a new day ----------
  var pickFrom = function (s, list, n, seed, avoid) {
    var out = [];
    for (var k = 0; out.length < n && k < 80; k++) {
      var q = list[Math.floor(L.rand(s.seed || 1, seed, k) * list.length)];
      if (q && out.indexOf(q) < 0 && !out.some(function (o) { return o.c === q.c; }) && !(avoid && avoid(q, out))) out.push(q);
    }
    return out;
  };
  // today's 3 adventures: one of each tier when it can (a tier with none open: another tier's), never one person twice
  L.advPick = function (s, dn) {
    var open = C.ADVENTURES.filter(function (a) { return !a.story && L.advOpen(s, a); }), out = [];
    // this week's story: today's chapter first (owner, 9 Nov 2026: Hana's Fiesta Bread)
    var ch = L.storyChapter(dn);
    if (ch && L.advOpen(s, ch)) out.push(ch);
    var take = function (pool, seed) {
      pool = pool.filter(function (a) { return out.indexOf(a) < 0 && !out.some(function (o) { return o.who === a.who; }); });
      if (pool.length) out.push(pool[Math.floor(L.rand(s.seed || 1, seed, 11) * pool.length) % pool.length]);
    };
    // a medium one every day, besides the story (its prize is the day's Power-Up: owner, 10 Nov 2026); then the other
    // two kinds the story is not, or (a medium story) one of them, turn about
    var tierOf = function (t) { return open.filter(function (a) { return a.tier === t; }); };
    take(tierOf('medium'), dn * 7 + 41);
    var rest = ['easy', 'hard'].filter(function (t) { return !(ch && out.indexOf(ch) >= 0 && ch.tier === t); });
    if (ch && out.indexOf(ch) >= 0 && ch.tier === 'medium') rest = [rest[dn % 2]];
    rest.forEach(function (t, k) { take(tierOf(t), dn * 7 + 40 + 2 * k); });
    for (var k = 0; out.length < 3 && k < 3; k++) take(open, dn * 7 + 50 + k);
    return out;
  };
  var prizeOf = function (a, dn) {
    var p = C.ADVENTURE_PRIZES[a.tier];
    return Array.isArray(p) ? p[dn % p.length] : p;
  };
  L.advStart = function (s, a, dn) {
    return { c: 'adv', n: a.n, b: 0, done: 0, reward: prizeOf(a, dn), text: L.advText(a), tier: 'adventure', a: a.key, got: 0, gb: 0, gv: 0 };
  };
  var refresh = L.refreshQuests;
  L.refreshQuests = function (s, today) {
    var news = refresh(s, today);
    var dn = L.dayNum(today);
    if (news.daily && s.dq && s.dq.d === dn) {
      var normal = pickFrom(s, Q.easy, D.normal, dn * 7 + 1).map(function (q) {
        return { c: q.c, n: q.n, text: q.text.replace('{n}', q.n), reward: q.reward, b: L.count(s, q.c), done: 0, tier: 'easy' };
      });
      s.dq = { d: dn, all: 0, v: 2, six: 0, list: normal.concat(L.advPick(s, dn).map(function (a) { return L.advStart(s, a, dn); })) };
      delete s.qp;
    }
    if (news.weekly && s.wq) { s.wq.v = 2; s.wq.good = 0; s.wq.st = 0; s.wq.list = []; }
    return news;
  };
  L.daily2 = function (s) { return !!(s.dq && s.dq.v === 2); };
  L.weekly2 = function (s) { return !!(s.wq && s.wq.v === 2); };

  // ---------- an adventure's progress ----------
  var progress = L.questProgress;
  L.questProgress = function (s, q) { return q.c === 'adv' ? (q.gv ? q.n : Math.min(q.n, q.got || 0)) : progress(s, q); };
  var ready = L.questReady;
  L.questReady = function (s, q) { return q.c === 'adv' ? !!q.gv && !q.done : ready(s, q); };
  // today's adventures still to find or hunt on map (and, in the mine, on this floor): [{ i, q, a }]
  L.advActive = function (s, map, floor) {
    if (!s.dq || !s.dq.list) return [];
    var out = [];
    s.dq.list.forEach(function (q, i) {
      var a = L.advOf(q);
      if (!a || q.done || q.gv || (q.got || 0) >= q.n || a.map !== map) return;
      if (map === 'mine' && floor != null && floor !== L.advFloor(s, s.dq.d)) return;
      out.push({ i: i, q: q, a: a });
    });
    return out;
  };
  // A piece found (spot k of quest i): 'found' | 'all' (the last one) | 'no'
  L.advFind = function (s, i, k) {
    var q = s.dq && s.dq.list[i];
    if (!L.advOf(q) || q.done || q.gv || (q.got || 0) >= q.n || (q.gb & (1 << k))) return 'no';
    q.gb = (q.gb || 0) | (1 << k);
    q.got = (q.got || 0) + 1;
    return q.got >= q.n ? 'all' : 'found';
  };
  L.advHunted = function (s, i) {
    var q = s.dq && s.dq.list[i];
    if (!L.advOf(q) || q.done || q.gv) return 'no';
    q.got = q.n;
    return 'all';
  };
  // the adventure who is waiting for: its index, or -1
  L.advFor = function (s, who) {
    if (!s.dq) return -1;
    for (var i = 0; i < s.dq.list.length; i++) {
      var q = s.dq.list[i], a = L.advOf(q);
      if (a && a.who === who && !q.done && !q.gv && (q.got || 0) >= q.n) return i;
    }
    return -1;
  };
  // Handed over: the quest is claimed there. Returns the prize ({..., hearts}) or 'full' (kept: claim it in Quests).
  L.advHandOver = function (s, i) {
    var q = s.dq && s.dq.list[i], a = L.advOf(q);
    if (!a || q.done || (q.got || 0) < q.n) return 'notyet';
    if (!q.gv) {
      q.gv = 1;
      if (C.VILLAGERS[a.who]) L.addFriend(s, a.who, 10); // (a heart's worth)
    }
    return L.claimQuest(s, 'daily', i);
  };
  var claimQuest = L.claimQuest;
  L.claimQuest = function (s, kind, i) {
    var set = L.questOf(s, kind), q = set && set.list[i];
    if (q && q.c === 'adv' && !q.gv && !q.done) return 'notyet';
    var r = claimQuest(s, kind, i);
    if (kind === 'daily' && typeof r === 'object' && L.daily2(s)) {
      if (q.c === 'adv') L.bump(s, 'adv');
      var six = sixBonus(s);
      if (six) r = merge(r, six);
    }
    return r;
  };
  var merge = function (a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { o[k] = (o[k] || 0) + b[k]; }); return o; };
  // all 6 done after the chest: a Sunbeam more, once
  var sixBonus = function (s) {
    var set = s.dq;
    if (!set.all || set.six || !set.list.every(function (q) { return q.done; })) return null;
    set.six = 1;
    L.giveReward(s, D.six);
    return D.six;
  };

  // ---------- the week's story ----------
  // this week's story (one a week, in turn) and today's chapter of it
  L.storyOf = function (dn) { return C.STORIES.length ? C.STORIES[Math.floor(L.weekOf(dn) / 7) % C.STORIES.length] : null; };
  L.storyChapter = function (dn) { var st = L.storyOf(dn); return st ? st.chapters[dn - L.weekOf(dn)] || null : null; };
  // chapters handed over this week (bits, Monday = 1)
  L.storyDone = function (s) { var b = (s.wq && s.wq.st) || 0, n = 0; while (b) { n += b & 1; b >>= 1; } return n; };
  // the keepsakes you have (story keys), and the recipes they gave
  L.storyKept = function (s, key) { return !!(s.stk && s.stk.indexOf(key) >= 0); };
  var handOver = L.advHandOver;
  L.advHandOver = function (s, i) {
    var q = s.dq && s.dq.list[i], a = L.advOf(q), was = q && q.gv;
    var r = handOver(s, i);
    if (typeof r !== 'object' || !a || !a.story || was || !s.wq) return r;
    s.wq.st = (s.wq.st || 0) | (1 << a.day);
    var st = L.storyOf(s.dq.d);
    if (st && st.key === a.story && L.storyDone(s) >= st.need && !L.storyKept(s, st.key)) {
      s.stk = (s.stk || []).concat([st.key]);
      L.giveReward(s, st.keepsake);
      r = merge(r, st.keepsake);
      r.keepsake = st.key;
    }
    return r;
  };
  // the recipes a story gave, with a friend's (19zzzz-friends.js: the Kitchen's list)
  var vsRecipes = L.vsRecipes;
  L.vsRecipes = function (s) {
    var out = vsRecipes ? vsRecipes(s) : [];
    C.STORIES.forEach(function (st) { if (st.recipe && L.storyKept(s, st.key)) out.push({ dish: C.STORY_RECIPES[st.recipe].dish, needs: C.STORY_RECIPES[st.recipe].needs.slice(), story: st.key }); });
    return out;
  };

  // ---------- the day's chest and the week's ----------
  L.dailyDone = function (s) { return s.dq ? s.dq.list.filter(function (q) { return q.done; }).length : 0; };
  var chestReady = L.chestReady;
  L.chestReady = function (s, kind) {
    if (kind === 'daily' && L.daily2(s)) return !s.dq.all && L.dailyDone(s) >= D.need;
    if (kind === 'weekly' && L.weekly2(s)) return !s.wq.chest && L.goodDays(s) >= D.goodDays;
    return chestReady(s, kind);
  };
  L.goodDays = function (s) { var b = (s.wq && s.wq.good) || 0, n = 0; while (b) { n += b & 1; b >>= 1; } return n; };
  var claimChest = L.claimChest;
  L.claimChest = function (s, kind) {
    var r = claimChest(s, kind);
    if (kind === 'daily' && typeof r === 'object' && L.daily2(s)) {
      // a good day for the week (the week it was)
      if (L.weekly2(s) && s.wq.w === L.weekOf(s.dq.d)) s.wq.good = (s.wq.good || 0) | (1 << (s.dq.d - s.wq.w));
      var six = sixBonus(s);
      if (six) r = merge(r, six);
    }
    return r;
  };

  // ---------- the reason on the Quests list and the dog's tip ----------
  var reason = L.questReason;
  L.questReason = function (s, i) {
    var q = s.dq && s.dq.list[i], a = L.advOf(q);
    if (!a) return reason(s, i);
    return { who: a.who, text: a.say };
  };

  // ---------- the save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    var av = {};
    if (L.daily2(s)) {
      av.d = [s.dq.d, s.dq.six ? 1 : 0];
      av.q = [];
      s.dq.list.forEach(function (q, i) { if (q.c === 'adv') av.q.push([i, q.a, q.got || 0, q.gb || 0, q.gv ? 1 : 0]); });
    }
    if (L.weekly2(s)) av.w = [s.wq.w, s.wq.good || 0, s.wq.st || 0];
    if (s.stk && s.stk.length) av.k = s.stk.slice();
    if (av.d || av.w || av.k) o.av = av;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var av = o.av && typeof o.av === 'object' ? o.av : {};
    if (s.dq && Array.isArray(av.d) && Number(av.d[0]) === s.dq.d) {
      s.dq.v = 2;
      s.dq.six = av.d[1] ? 1 : 0;
      (Array.isArray(av.q) ? av.q : []).forEach(function (e) {
        var q = Array.isArray(e) && s.dq.list[Number(e[0])], a = Array.isArray(e) && BY[e[1]];
        if (!q || q.c !== 'adv' || !a) return;
        q.a = a.key;
        q.n = a.n;
        q.got = Math.max(0, Math.min(a.n, Number(e[2]) || 0));
        q.gb = (Number(e[3]) || 0) & 7;
        q.gv = e[4] ? 1 : 0;
      });
    }
    if (s.dq && s.dq.list) s.dq.list = s.dq.list.filter(function (q) { return q.c !== 'adv' || BY[q.a]; }); // (an adventure without its own: dropped)
    if (s.wq && Array.isArray(av.w) && Number(av.w[0]) === s.wq.w) { s.wq.v = 2; s.wq.good = (Number(av.w[1]) || 0) & 127; s.wq.st = (Number(av.w[2]) || 0) & 127; }
    s.stk = (Array.isArray(av.k) ? av.k : []).filter(function (k) { return C.STORIES.some(function (st) { return st.key === k; }); });
    return s;
  };
})(window.Farm = window.Farm || {});

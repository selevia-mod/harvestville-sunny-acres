// Bayanihan Projects' rules (owner, 6 Nov 2026; content 00-zzzzzzzzzzz-bayanihan.js, the board and the town
// 19zzzz-bayanihan.js, the server supabase/farm_online_20.sql). Pure, no Phaser.
// The server holds the town's progress (one for everyone) and decides what each gift counts for and what each reward
// pays; the game reads its answers here (every value checked, as for anything from the network), takes the given things
// out of the bag only after the server said ok, keeps the request of a gift whose answer never came (sent again with the
// same id, so it counts once), remembers which projects are built (so the town shows them offline too), pays a claimed
// reward once, and runs the benefits of the built ones.
// Saved as 'bh': [built (a bit per project), claimed (bits), celebrated (bits), wishing-coin day, bell day, boat day,
// the gift waiting for its answer: [request id, item, n, project] or 0].
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var BH = C.BH;
  var O = C.OUTDOOR;

  C.TIPS.push({ key: 'bh_tour', text: 'BAYANIHAN PROJECTS' });

  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var blank = function () { return { built: 0, got: 0, shown: 0, d: [0, 0, 0], p: null }; };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.bh = blank();
    return s;
  };

  // ---------- the projects ----------
  L.bhIndex = function (key) { for (var i = 0; i < BH.projects.length; i++) if (BH.projects[i].key === key) return i; return -1; };
  L.bhDef = function (key) { return BH.projects[L.bhIndex(key)] || null; };
  L.bhBuilt = function (s, key) { var i = L.bhIndex(key); return i >= 0 && !!(s.bh && (s.bh.built >> i) & 1); };
  L.bhBuiltKeys = function (s) { return BH.projects.filter(function (p) { return L.bhBuilt(s, p.key); }).map(function (p) { return p.key; }); };
  // The project the town is on, as far as this farm knows (the first not built), or null when all are built.
  L.bhNext = function (s) { return BH.projects.filter(function (p) { return !L.bhBuilt(s, p.key); })[0] || null; };
  // A need's thing: a bag item, or the farm's lumber or stone.
  L.bhOk = function (id) { return id === 'lumber' || id === 'stone' || !!(C.ITEMS[id] && C.ITEMS[id].sell > 0); };
  L.bhName = function (id) { return BH.names[id] || (C.ITEMS[id] ? C.ITEMS[id].name : id); };
  L.bhIcon = function (id) { return BH.names[id] ? C.ICON[id] : C.ITEMS[id] ? C.ITEMS[id].icon : C.ICON.crate; };
  L.bhHave = function (s, id) { return id === 'lumber' ? s.lumber : id === 'stone' ? s.stone : L.countItem(s, id); };
  // Takes up to n out of the bag (the server said ok). Returns how many went.
  L.bhTake = function (s, id, n) {
    var k = Math.max(0, Math.min(n, L.bhHave(s, id)));
    if (!k) return 0;
    if (id === 'lumber') s.lumber -= k;
    else if (id === 'stone') s.stone -= k;
    else { L.removeItem(s, id, k); L.discover(s, id); }
    return k;
  };
  // The reward tier for the points a farmer gave to a project: 0 (none), 1 Helper, 2 Builder, 3 Hero.
  // (tiers: the server's numbers, from its state, or the game's own)
  L.bhTier = function (pts, tiers) { var t = 0; (tiers || BH.tiers).forEach(function (x, i) { if (pts >= x.at) t = i + 1; }); return t; };
  L.bhTitles = function (s) { return BH.projects.filter(function (p, i) { return s.bh && (s.bh.got >> i) & 1; }).map(function (p) { return p.title; }); };

  // ---------- the server's answers ----------
  var person = function (g) { return g && g.id ? { id: String(g.id), name: L.cleanText(g.name, 24) || 'Farmer', pts: int(g.pts, 0, 1e7, 0), me: !!g.me } : null; };
  // farm_project_state_v1, checked: { current: { key, def, needs: [{ id, goal, have, pts, day, today }], mine, cap, top,
  // givers, hood: { name, pts } | null } | null, done: [{ key, mine, tier, claimed, ago }], canGive }; null if it is not one.
  L.bhRead = function (r) {
    if (!r || typeof r !== 'object' || r.ok === false) return null;
    var cur = null, c = r.current;
    if (c && typeof c === 'object' && L.bhDef(c.key)) {
      var needs = (Array.isArray(c.needs) ? c.needs : []).filter(function (n) { return n && L.bhOk(n.item); }).slice(0, 8).map(function (n) {
        var goal = int(n.goal, 1, 1e7, 1);
        return { id: n.item, goal: goal, have: int(n.have, 0, goal, 0), pts: int(n.pts, 1, 1000, 1), day: int(n.day_max, 0, 1e5, 0), today: int(n.today, 0, 1e5, 0) };
      });
      var hood = c.hood && typeof c.hood === 'object' ? { name: L.cleanText(c.hood.name, 20) || 'Your barangay', pts: int(c.hood.pts, 0, 1e8, 0) } : null;
      var at = Array.isArray(c.tiers) && c.tiers.length === BH.tiers.length ? c.tiers : null, gold = Array.isArray(c.gold) && c.gold.length === BH.tiers.length ? c.gold : null;
      cur = {
        key: c.key, def: L.bhDef(c.key), needs: needs, mine: int(c.mine, 0, 1e7, 0), cap: int(c.cap, 0, 1e7, BH.cap),
        tiers: BH.tiers.map(function (t, i) { return { name: t.name, at: at ? int(at[i], 1, 1e7, t.at) : t.at, gold: gold ? int(gold[i], 0, 1e5, t.gold) : t.gold }; }),
        top: (Array.isArray(c.top) ? c.top : []).map(person).filter(Boolean).slice(0, BH.top), givers: int(c.givers, 0, 1e8, 0), hood: hood,
      };
    }
    var done = (Array.isArray(r.done) ? r.done : []).filter(function (d) { return d && L.bhDef(d.key); }).map(function (d) {
      return { key: d.key, mine: int(d.mine, 0, 1e7, 0), tier: int(d.tier, 0, BH.tiers.length, 0), claimed: !!d.claimed, ago: int(d.ago, 0, 1e9, 0) };
    });
    return { current: cur, done: done, canGive: r.can_give !== false };
  };
  // The town as the server has it: each done project is built on this farm too. Returns the ones newly built here.
  L.bhSync = function (s, st) {
    var fresh = [];
    (st && st.done || []).forEach(function (d) {
      var i = L.bhIndex(d.key);
      if (i < 0 || (s.bh.built >> i) & 1) return;
      s.bh.built |= 1 << i;
      fresh.push(d.key);
    });
    return fresh;
  };
  // A built project not yet celebrated on this farm (the board shows it once), or null.
  L.bhToCelebrate = function (s) {
    var p = BH.projects.filter(function (x, i) { return (s.bh.built >> i) & 1 && !((s.bh.shown >> i) & 1); })[0];
    return p || null;
  };
  L.bhCelebrated = function (s, key) { var i = L.bhIndex(key); if (i >= 0) s.bh.shown |= 1 << i; };

  // The most a farmer may give of a need right now: what they have, what is left of their day, of the need, and of
  // their points for the project (the server checks it all again).
  L.bhGiveMax = function (s, cur, need) {
    if (!cur || !need) return 0;
    var byPts = Math.floor(Math.max(0, cur.cap - cur.mine) / need.pts);
    return Math.max(0, Math.min(L.bhHave(s, need.id), need.day - need.today, need.goal - need.have, byPts));
  };

  // ---------- giving ----------
  // A new gift's request: kept in the save until the server answers, so a gift whose answer was lost is asked again
  // with the same id (and counts once). id: a fresh uuid from the game.
  L.bhAsk = function (s, key, id, n, rid) {
    s.bh.p = { r: rid, i: id, n: n, k: key };
    return s.bh.p;
  };
  // The server's answer to a gift (farm_project_give_v1). ok: the things go out of the bag (as many as it took, never
  // more than are in the bag now) and the board's numbers move; not ok: they stay. Either way the request is done.
  // Returns { ok, n (taken), code, done (the gift finished the project) }.
  L.bhAnswer = function (s, r, cur) {
    var p = s.bh.p;
    s.bh.p = null;
    if (!p) return { ok: false, n: 0, code: 'none' };
    if (!r || typeof r !== 'object' || !r.ok) return { ok: false, n: 0, code: (r && typeof r.code === 'string' && r.code) || 'bad' };
    var n = int(r.n, 0, p.n, 0), got = L.bhTake(s, p.i, n);
    if (cur && cur.key === p.k) {
      var need = cur.needs.filter(function (x) { return x.id === p.i; })[0];
      if (need) {
        need.have = int(r.have, 0, need.goal, Math.min(need.goal, need.have + n));
        need.today = int(r.today, 0, 1e5, need.today + n);
      }
      var was = cur.mine;
      cur.mine = int(r.mine, 0, 1e7, cur.mine + n * (need ? need.pts : 1));
      if (cur.hood) cur.hood.pts += Math.max(0, cur.mine - was); // (a member's gift counts for the barangay too)
    }
    return { ok: true, n: got, code: '', done: !!r.done };
  };
  // A request the save kept, if it still looks like one.
  L.bhPending = function (s) { var p = s.bh.p; return p && UUID.test(p.r) && L.bhOk(p.i) && L.bhDef(p.k) ? p : null; };

  // ---------- the reward ----------
  // Pays a claimed reward (farm_project_claim_v1's answer) once: its Gold (what the server says, never more than the top
  // tier's), the title and the yard piece. Returns { gold, title, deco, tier } or 'claimed' / 'bad'.
  L.bhClaim = function (s, key, r) {
    var i = L.bhIndex(key), def = BH.projects[i];
    if (!def || !r || typeof r !== 'object' || !r.ok) return 'bad';
    if ((s.bh.got >> i) & 1) return 'claimed';
    var top = BH.tiers[BH.tiers.length - 1].gold * 2, gold = int(r.gold, 0, top, 0), tier = int(r.tier, 1, BH.tiers.length, 1);
    s.bh.got |= 1 << i;
    s.bh.built |= 1 << i; // (a claim means it is done)
    s.gold += gold;
    var t = O.index[def.deco];
    if (t != null) s.yard.bag[t] = (s.yard.bag[t] || 0) + 1;
    return { gold: gold, title: def.title, deco: t != null ? O.types[t].name : '', tier: tier };
  };
  L.bhClaimed = function (s, key) { var i = L.bhIndex(key); return i >= 0 && !!((s.bh.got >> i) & 1); };

  // ---------- the benefits ----------
  // The fountain's wishing coin (once a day): { gold } or { id, n }, or 'built' (no fountain yet) / 'done' / 'full'.
  L.bhWish = function (s) {
    if (!L.bhBuilt(s, 'fountain')) return 'built';
    if (s.bh.d[0] === s.day) return 'done';
    var w = BH.wish[Math.floor(L.rand(s.seed, s.day, 9710) * BH.wish.length)], r;
    if (w[0] === 'gold') { s.gold += w[1]; r = { gold: w[1] }; }
    else {
      var id = w[0] === 'seed' ? L.starterSeed(s) : w[0];
      if (!L.canAdd(s, id, w[1])) return 'full';
      L.addItem(s, id, w[1]);
      r = { id: id, n: w[1] };
    }
    s.bh.d[0] = s.day;
    return r;
  };
  // The Chapel Bell on a festival day: the festival gift, once that day. { gold } or 'built' / 'day' (no festival) / 'done'.
  L.bhRing = function (s) {
    if (!L.bhBuilt(s, 'bell')) return 'built';
    if (!L.festivalOn(s.day)) return 'day';
    if (s.bh.d[1] === s.day) return 'done';
    s.bh.d[1] = s.day;
    s.gold += BH.bellGold;
    return { gold: BH.bellGold };
  };
  // The boatman's catch, once a day. { items: [[id, n]] } or 'built' / 'done' / 'full'.
  L.bhBoat = function (s) {
    if (!L.bhBuilt(s, 'pier')) return 'built';
    if (s.bh.d[2] === s.day) return 'done';
    if (!BH.boat.every(function (e) { return L.canAdd(s, e[0], e[1]); })) return 'full';
    BH.boat.forEach(function (e) { L.addItem(s, e[0], e[1]); L.discover(s, e[0]); });
    s.bh.d[2] = s.day;
    return { items: BH.boat.map(function (e) { return e.slice(); }) };
  };

  // The Market Hall: stall sales pay more, and each shelf holds more.
  var sellLot = L.sellLot;
  L.sellLot = function (s, i) {
    var r = sellLot.apply(L, arguments), e = s.shelves && s.shelves[i];
    if (r && e && L.bhBuilt(s, 'market')) {
      e.coins = Math.round(e.coins * BH.hallPay);
      r.coins = e.coins;
      r.hall = true;
    }
    return r;
  };
  var shelfCap = L.twShelfCap;
  L.twShelfCap = function (s) { return shelfCap.call(L, s) + (L.bhBuilt(s, 'market') ? BH.hallShelf : 0); };
  // The Chapel Bell: festival contest prizes pay more.
  var ctEnter = L.ctEnter;
  if (ctEnter) {
    L.ctEnter = function (s) {
      var r = ctEnter.apply(L, arguments);
      if (r && !r.error && r.gold > 0 && L.bhBuilt(s, 'bell')) {
        var more = Math.round(r.gold * (BH.contestPay - 1));
        s.gold += more;
        r.gold += more;
        r.bell = more;
        r.text += ' The Chapel Bell adds ' + more + 'G!';
      }
      return r;
    };
  }

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), b = s.bh || blank(), p = b.p;
    if (b.built || b.got || b.shown || b.d[0] || b.d[1] || b.d[2] || p) o.bh = [b.built, b.got, b.shown, b.d[0], b.d[1], b.d[2], p ? [p.r, p.i, p.n, p.k] : 0];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    // a stall shelf of the Market Hall keeps its bigger lot on the way in (the Station's loading allows TW.shelfMore)
    var keep = C.TW.shelfMore, s;
    C.TW.shelfMore = keep + BH.hallShelf;
    try { s = deserialize(o); } finally { C.TW.shelfMore = keep; }
    if (!s) return s;
    var a = o && Array.isArray(o.bh) ? o.bh : [], all = (1 << BH.projects.length) - 1;
    s.bh = blank();
    s.bh.built = int(a[0], 0, all, 0);
    s.bh.got = int(a[1], 0, all, 0);
    s.bh.shown = int(a[2], 0, all, 0);
    s.bh.d = [int(a[3], 0, 1e7, 0), int(a[4], 0, 1e7, 0), int(a[5], 0, 1e7, 0)];
    var p = Array.isArray(a[6]) ? { r: String(a[6][0] || ''), i: String(a[6][1] || ''), n: int(a[6][2], 1, 1e5, 1), k: String(a[6][3] || '') } : null;
    s.bh.p = p && UUID.test(p.r) && L.bhOk(p.i) && L.bhDef(p.k) ? p : null;
    return s;
  };
})(window.Farm = window.Farm || {});

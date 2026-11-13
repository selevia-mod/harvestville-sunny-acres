// Name frames, the rules (words and numbers 00-zzzzzzzzzzzzzzzzzzzzzzzzzz-name-frames.js, the pictures and pages
// 19zzz...z-name-frames.js, the server supabase/farm_name_frames.sql). Pure, no Phaser:
// - which frame a player wears (L.frameWear: the server's own rule, for the "My frame" page): their pick if they still own
//   it, else Auto: this week's board frame, else their newest boss frame; 'none': no frame;
// - the server's answers checked (L.frameRows, L.frameMine): never a frame from what a phone says about itself;
// - the phone's cache (L.frameCache): answers kept 10 minutes, each new player asked for once, in batches of 60.
// Nothing saved.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var NF = C.NAME_FRAMES;
  if (!NF) return;
  var ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var uid = function (v) { v = typeof v === 'string' ? v.toLowerCase() : ''; return ID.test(v) ? v : null; };
  var known = L.frameKnown = function (k) { return typeof k === 'string' && NF.keys.indexOf(k) >= 0; };
  var title = function (v) { return typeof v === 'string' && v ? L.cleanText(v, 30) || null : null; };

  // ---------- which frame ----------
  // own: { firsts: [boss frames, newest first], week: 'gold' | 'silver' | 'bronze' | null }; pick: 'auto' | 'none' | a key
  L.frameWear = function (own, pick) {
    own = own || {};
    var firsts = (Array.isArray(own.firsts) ? own.firsts : []).filter(known), week = known(own.week) ? own.week : null;
    if (pick === 'none') return null;
    if (known(pick) && (pick === week || firsts.indexOf(pick) >= 0)) return pick;
    return week || firsts[0] || null;
  };
  // the frames one owns, in the page's order: this week's board frame first, then the boss frames, floor 100 first
  L.frameOwned = function (own) {
    own = own || {};
    var firsts = (Array.isArray(own.firsts) ? own.firsts : []).filter(known);
    return (known(own.week) ? [own.week] : []).concat(NF.keys.filter(function (k) { return firsts.indexOf(k) >= 0; }));
  };

  // ---------- the server's answers, checked ----------
  // farm_frames_v1: [{ id, frame, title }] (only the players with a frame or a title) -> { id: { f, t } }
  L.frameRows = function (r) {
    var out = {};
    (Array.isArray(r) ? r : []).slice(0, NF.most).forEach(function (x) {
      var id = x && typeof x === 'object' ? uid(x.id) : null;
      if (id) out[id] = { f: known(x.frame) ? x.frame : null, t: title(x.title) };
    });
    return out;
  };
  // farm_frames_mine_v1: { pick, firsts, week, title, until, wear: { frame, title } } -> the page's, or null
  L.frameMine = function (r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    var own = { firsts: (Array.isArray(r.firsts) ? r.firsts : []).filter(known), week: known(r.week) ? r.week : null };
    var pick = r.pick === 'none' || known(r.pick) ? r.pick : 'auto';
    var w = r.wear && typeof r.wear === 'object' ? r.wear : {};
    return {
      pick: pick, firsts: own.firsts, week: own.week, title: title(r.title),
      until: typeof r.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.until) ? r.until : '',
      owned: L.frameOwned(own),
      wear: { f: known(w.frame) ? w.frame : L.frameWear(own, pick), t: title(w.title) },
    };
  };

  // ---------- the cache ----------
  // m: { id: { f, t, at } } (answers), p: { id: when asked } (asked, not answered yet)
  L.frameCache = function () { return { m: {}, p: {} }; };
  // The ids to ask for now, in batches (NF.most each): new to the phone, or answered more than NF.cache ago; never one
  // already asked and waiting (NF.retry), never twice in one call. Marks them asked.
  L.frameAsk = function (c, ids, now) {
    var want = [], seen = {};
    (Array.isArray(ids) ? ids : []).forEach(function (v) {
      var id = uid(v);
      if (!id || seen[id]) return;
      seen[id] = 1;
      var e = c.m[id], p = c.p[id];
      if (e && now - e.at < NF.cache) return;
      if (p != null && now - p < NF.retry) return;
      c.p[id] = now;
      want.push(id);
    });
    var out = [];
    for (var i = 0; i < want.length; i += NF.most) out.push(want.slice(i, i + NF.most));
    return out;
  };
  // The answer to an ask: every id asked is known now (no row: no frame and no title).
  L.frameGot = function (c, ids, rows, now) {
    var r = L.frameRows(rows);
    (ids || []).forEach(function (v) {
      var id = uid(v);
      if (!id) return;
      delete c.p[id];
      c.m[id] = { f: r[id] ? r[id].f : null, t: r[id] ? r[id].t : null, at: now };
    });
    return r;
  };
  // (no answer, no connection: the ids stay asked, and are asked again after NF.retry)
  L.frameOf = function (c, id) {
    var e = c.m[uid(id)];
    return e ? { f: e.f, t: e.t } : null;
  };
  // our own, straight from a pick's answer
  L.frameSet = function (c, id, e, now) {
    id = uid(id);
    if (!id || !e) return;
    c.m[id] = { f: known(e.f) ? e.f : null, t: title(e.t), at: now };
    delete c.p[id];
  };
})(window.Farm = window.Farm || {});

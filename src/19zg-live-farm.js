// The owner's farm, live for its visitors (owner, 3 Nov 2026: "polish how users can see what the other player is doing").
// A visit used to load the farm once (farm_visit_v1, up to a minute old) and never again, so a visitor saw the owner
// swing and nothing happen. Now the owner's phone tells its visitors which field tiles changed, just after each action
// (and the whole field once when someone arrives), and the visitor's phone redraws them with the same pop, dirt, splash
// or leaves as your own work. Only the soil, crops and debris travel; the visit stays look-only.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var T = C.TILE;
  var AFTER = 130; // ms after an action: its tool has landed (19b-feel.js IMPACT)
  var EVERY = 2000; // and a quiet look this often, for what changes without an action (a crop withering, a new day)
  var MAX_TILES = 64 * 64;

  // ---------- the owner's side ----------
  var sentSoil = null, sentDebris = null, known = {}, soon = null;
  var packSoil = function (t) { return t ? [t.w ? 1 : 0, t.c || '', Math.round(t.p || 0), Math.round(t.r || 0)] : 0; };
  var same = function (a, b) { return a === b || (a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]); };
  var ownFarm = function (w) { return w && w.mapKey === 'farm' && w.state && !w.state.isVisit && !F.session.visit && w.sys && w.sys.isActive(); };
  var visitors = function () { return Object.keys(O.others).filter(function (k) { return O.others[k].map === 'farm'; }); };

  var tellFarm = function (w) {
    soon = null;
    if (!ownFarm(w) || !O.on || !O.chan) return;
    var here = visitors();
    if (!here.length) { sentSoil = sentDebris = null; known = {}; return; }
    var s = w.state, soil = {}, debris = {};
    Object.keys(s.soil || {}).forEach(function (k) { soil[k] = packSoil(s.soil[k]); });
    Object.keys(s.debris || {}).forEach(function (k) { debris[k] = s.debris[k]; });
    var fresh = here.some(function (id) { return !known[id]; });
    known = {};
    here.forEach(function (id) { known[id] = 1; });
    if (fresh || !sentSoil) { // someone new: the whole field, as it is now
      O.send('farm', { full: 1, s: Object.keys(soil).map(function (k) { return [Number(k)].concat(soil[k]); }), d: Object.keys(debris).map(function (k) { return [Number(k), debris[k]]; }) });
    } else {
      var ds = [], dd = [];
      Object.keys(soil).forEach(function (k) { if (!same(soil[k], sentSoil[k])) ds.push([Number(k)].concat(soil[k])); });
      Object.keys(sentSoil).forEach(function (k) { if (!(k in soil)) ds.push([Number(k), 0]); });
      Object.keys(debris).forEach(function (k) { if (debris[k] !== sentDebris[k]) dd.push([Number(k), debris[k]]); });
      Object.keys(sentDebris).forEach(function (k) { if (!(k in debris)) dd.push([Number(k), 0]); });
      if (ds.length || dd.length) O.send('farm', { s: ds, d: dd });
    }
    sentSoil = soil;
    sentDebris = debris;
  };

  var changed = P.changed;
  P.changed = function () {
    changed.call(this);
    var self = this;
    if (ownFarm(this) && O.on && O.chan && !soon && visitors().length) soon = setTimeout(function () { tellFarm(self); }, AFTER);
  };
  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this;
    sentSoil = sentDebris = null;
    known = {};
    if (this.mapKey === 'farm' && !this.state.isVisit) this.time.addEvent({ delay: EVERY, loop: true, callback: function () { if (!soon) tellFarm(self); } });
  };

  // ---------- the visitor's side ----------
  var tileOf = function (w, idx) { return { x: idx % w.map.width, y: Math.floor(idx / w.map.width) }; };
  var readSoil = function (row) {
    if (!Array.isArray(row) || row.length < 5) return null; // [idx, 0]: the soil is gone
    var c = typeof row[2] === 'string' && C.CROPS[row[2]] ? row[2] : null;
    return { w: row[1] ? 1 : 0, c: c, p: Number(row[3]) || 0, r: Number(row[4]) || 0 };
  };
  var okIdx = function (w, i) { return Number.isInteger(i) && i >= 0 && i < Math.min(MAX_TILES, w.map.width * w.map.height); };

  P.liveFarm = function (p) {
    var self = this, s = this.state, full = !!p.full;
    s.soil = s.soil || {};
    s.debris = s.debris || {};
    var soil = Array.isArray(p.s) ? p.s.slice(0, MAX_TILES) : [], debris = Array.isArray(p.d) ? p.d.slice(0, MAX_TILES) : [];
    if (full) {
      var wantSoil = {}, wantDebris = {};
      soil.forEach(function (row) { var i = Math.floor(Number(row && row[0])), t = readSoil(row); if (okIdx(self, i) && t) wantSoil[i] = t; });
      debris.forEach(function (row) { var i = Math.floor(Number(row && row[0])); if (okIdx(self, i) && C.DEBRIS[row[1]]) wantDebris[i] = row[1]; });
      Object.keys(s.debris || {}).forEach(function (k) { if (!wantDebris[k]) self.removeDebrisTile(Number(k)); });
      Object.keys(wantDebris).forEach(function (k) { var t = tileOf(self, Number(k)); self.putTile('Debris', self.gids['debris_' + wantDebris[k]], t.x, t.y); });
      s.soil = wantSoil;
      s.debris = wantDebris;
      this.refreshAllSoil();
      if (this.layers.Debris) this.layers.Debris.setCollisionByProperty({ collides: true });
      return;
    }
    debris.forEach(function (row) {
      var i = Math.floor(Number(row && row[0])), kind = row && row[1];
      if (!okIdx(self, i)) return;
      var t = tileOf(self, i), was = s.debris[i];
      if (kind && C.DEBRIS[kind]) {
        s.debris[i] = kind;
        self.putTile('Debris', self.gids['debris_' + kind], t.x, t.y);
      } else if (was) {
        delete s.debris[i];
        self.popOut('Debris', t);
        self.removeDebrisTile(i);
        self.impact('hammer', { kind: 'debris', debris: was }, t, true);
      }
    });
    soil.forEach(function (row) {
      var i = Math.floor(Number(row && row[0]));
      if (!okIdx(self, i)) return;
      var t = tileOf(self, i), was = s.soil[i] || null, now = readSoil(row), spr = self.crops[i];
      if (now && !was) self.impact('hoe', { kind: 'till' }, t, false);
      else if (!now && was) self.impact('hoe', { kind: 'untill' }, t, false);
      else if (now && was) {
        if (now.w && !was.w) self.puff(t, 0x9fd3ea, 2); // watered
        if (now.c && !was.c) self.puff(t, 0xd9b98a, 1); // planted
        if (was.c && (!now.c || now.p !== was.p) && spr) { // picked: the crop pops up and goes, and leaves fly
          var pop = self.add.image(spr.x, spr.y, 'crops', spr.frame.name).setOrigin(0.5, 1).setDepth(spr.depth + 0.01);
          self.tweens.add({ targets: pop, y: spr.y - 0.8 * T, alpha: 0, duration: 360, ease: 'Quad.out', onComplete: function () { pop.destroy(); } });
          self.burst('leaf', spr.x, spr.y - 40, 4);
          var crop = C.CROPS[was.c], item = crop && C.ITEMS[crop.item];
          if (item) self.floatIcon(spr.x, spr.y - 0.6 * T, item.icon); // what they picked (a crop that grows back too)
        }
      }
      if (now) s.soil[i] = now;
      else delete s.soil[i];
      self.refreshTile(i);
    });
    if (debris.length && this.layers.Debris) this.layers.Debris.setCollisionByProperty({ collides: true });
  };

  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event !== 'farm') return onMessage.call(O, event, payload);
    var p = payload && typeof payload === 'object' ? payload : {}, w = F.world;
    if (!w || !w.sys || !w.sys.isActive() || w.busy || w.mapKey !== 'farm' || !w.state || !w.state.isVisit) return;
    if (!F.session.visit || p.id !== F.session.visit.host) return; // only the owner, about their own farm
    w.liveFarm(p);
  };
})(window.Farm = window.Farm || {});

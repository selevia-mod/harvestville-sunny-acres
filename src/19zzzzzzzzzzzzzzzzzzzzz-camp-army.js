// Your trained raiders at your Raid Camp (owner, 10 Nov 2026: "I want to see my raider in my farm, I should also see
// whose I already trained"; "Every raider show but yes for cheap phones, load only necessary"). Like an army camp:
// every raider you have trained stands about in front of your camp, walks a few steps, looks round, turns. One still in
// training is not there yet: it walks out of the camp when it is ready. The ones a raid used are gone until you train
// more. On your own farm only (not on a visit, not in a raid).
// A cheap phone (4 GB or less: the OPPO A5 bar) shows at most C.CAMP_ARMY.cheap of them, every kind you have among them,
// and "+N" for the rest; it draws them from the battle picture already in the page and never fetches the animation
// sheets. Other phones fetch only the sheets of the kinds they have (the 'raiders' pack), the battle picture until then.
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR, T = C.TILE, R = C.FRAID;
  var P = F.WorldScene.prototype, DEPTH = F.WorldScene.DEPTH;
  C.CAMP_ARMY = { cheap: 10, speed: 0.75, every: 1000 };
  var BASE = { goat: 1.0, crow: 0.8, cat: 0.85, carabao: 1.7, monkey: 0.95, boar: 1.25, rooster: 0.8, bayawak: 1.15 };
  var DIRROW = { side: 0, front: 4, back: 8 }, SIZE = 0.9;

  F.cheapPhone = function () {
    var m = typeof navigator !== 'undefined' && navigator.deviceMemory;
    return !!(window.gameHost && window.gameHost.lite) || !!(m && m <= 4);
  };
  var campOf = function (s) {
    return ((s.yard && s.yard.items) || []).filter(function (it) { var t = O.types[it.t]; return t && t.key === 'raid_camp'; })[0] || null;
  };
  var mine = function (w) { return w.mapKey === 'farm' && !(w.state && w.state.isVisit) && !F.session.visit && !F.session.raid; };

  // who should stand at the camp: every trained raider (a cheap phone: some of each kind, up to its most)
  P.campArmyWant = function () {
    var s = this.state, r = L.frState(s), by = {}, total = 0;
    L.trainDone(s, Date.now());
    R.raiderOrder.forEach(function (k) { var n = Math.max(0, r.army[k] || 0); if (n) { by[k] = n; total += n; } });
    var most = F.cheapPhone() ? C.CAMP_ARMY.cheap : Infinity, list = [], left = Object.assign({}, by);
    while (list.length < Math.min(total, most)) R.raiderOrder.forEach(function (k) { if (left[k] > 0 && list.length < most) { list.push(k); left[k]--; } });
    return { list: list, total: total };
  };

  // the open tiles in front of the camp (and round it, if those are taken)
  var spotsOf = function (w, it) {
    var type = O.types[it.t], out = [], ok = function (x, y) { return w.inMap(x, y) && w.walkable(x, y) && !w.blocked[w.idx(x, y)]; };
    for (var y = it.y + type.h; y <= it.y + type.h + 3; y++) for (var x = it.x - 2; x <= it.x + type.w + 1; x++) if (ok(x, y)) out.push([x, y]);
    for (var r = 1; out.length < 6 && r <= 5; r++) {
      for (var yy = it.y - r; yy < it.y + type.h + r; yy++) for (var xx = it.x - r; xx < it.x + type.w + r; xx++) {
        if (ok(xx, yy) && !out.some(function (p) { return p[0] === xx && p[1] === yy; })) out.push([xx, yy]);
      }
    }
    return out;
  };
  var pick = function (spots) { var p = spots[Math.floor(Math.random() * spots.length)]; return { x: (p[0] + 0.2 + Math.random() * 0.6) * T, y: (p[1] + 0.3 + Math.random() * 0.5) * T }; };

  var asked = {}; // (when each sheet was last asked for: offline, again 10 s later, not every frame)
  var sheetFor = function (w, k) {
    var key = 'ranim_' + k;
    if (F.images && F.images[key]) return F.ensureTexture(w, key);
    if (!F.cheapPhone() && F.needImage && Date.now() - (asked[key] || 0) > 10000) { asked[key] = Date.now(); F.needImage(key); } // (only the kinds this farm has)
    return null;
  };
  P.campArmyAdd = function (k, fromCamp) {
    var it = this.campArmy.camp, type = O.types[it.t], spots = this.campArmy.spots;
    if (!spots.length) return null;
    var at = fromCamp ? { x: (it.x + type.w / 2) * T, y: (it.y + type.h) * T } : pick(spots), base = BASE[k] || 1, row = R.raiderOrder.indexOf(k);
    var u = { k: k, x: at.x, y: at.y, wait: fromCamp ? 0 : Math.random() * 2500, tx: at.x, ty: at.y, dir: 'side', face: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 10, base: base, fly: !!R.raiders[k].flies, alpha: 0 };
    if (fromCamp) { var to = pick(spots); u.tx = to.x; u.ty = to.y; }
    u.sh = this.add.ellipse(u.x, u.y, 0.7 * base * T, 0.22 * base * T, 0x000000, 0.25).setDepth(DEPTH.shadow).setAlpha(0);
    u.img = this.add.image(u.x, u.y, F.ensureTexture(this, 'raid_moves'), row * 4).setOrigin(0.5, 0.9).setScale(base * 1.45 * T / C.RAID_MOVES.run[row] * SIZE).setAlpha(0);
    this.campArmy.units.push(u);
    return u;
  };
  P.campArmySync = function () {
    var self = this, s = this.state, it = campOf(s), ca = this.campArmy;
    if (!it || !mine(this) || L.frState(s).camp < 1) { this.campArmyClear(); return; }
    if (!ca || ca.camp !== it || ca.at !== it.x + ',' + it.y) {
      this.campArmyClear();
      ca = this.campArmy = { camp: it, at: it.x + ',' + it.y, spots: spotsOf(this, it), units: [], label: null };
    }
    var want = this.campArmyWant(), have = {}, need = {};
    ca.units.forEach(function (u) { if (!u.gone) have[u.k] = (have[u.k] || 0) + 1; });
    want.list.forEach(function (k) { need[k] = (need[k] || 0) + 1; });
    var first = !ca.ready;
    Object.keys(need).forEach(function (k) { for (var i = have[k] || 0; i < need[k]; i++) self.campArmyAdd(k, !first); });
    ca.units.forEach(function (u) { if (!u.gone && (need[u.k] || 0) < (have[u.k] || 0)) { u.gone = true; have[u.k]--; } });
    ca.ready = true;
    var more = want.total - want.list.length, type = O.types[it.t];
    if (more > 0) {
      if (!ca.label) ca.label = this.add.text(0, 0, '', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '90px', color: '#ffffff', fontStyle: 'bold', stroke: '#4a2a10', strokeThickness: 14 }).setOrigin(0.5, 1).setDepth(DEPTH.fx);
      ca.label.setText('+' + more).setPosition((it.x + type.w / 2) * T, (it.y + 0.2) * T).setVisible(true);
    } else if (ca.label) ca.label.setVisible(false);
  };
  P.campArmyClear = function () {
    var ca = this.campArmy;
    if (!ca) return;
    ca.units.forEach(function (u) { u.img.destroy(); u.sh.destroy(); });
    if (ca.label) ca.label.destroy();
    this.campArmy = null;
  };

  P.campArmyFrame = function (dt, time) {
    var self = this, ca = this.campArmy;
    if (!ca) return;
    var sp = C.CAMP_ARMY.speed * T;
    ca.units = ca.units.filter(function (u) {
      // in and out softly
      u.alpha = Math.max(0, Math.min(1, u.alpha + (u.gone ? -1 : 1) * dt / 400));
      if (u.gone && u.alpha <= 0) { u.img.destroy(); u.sh.destroy(); return false; }
      var dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy), moving = false;
      if (u.wait > 0) u.wait -= dt;
      else if (d > 6) {
        var step = Math.min(d, sp * (u.fly ? 1.3 : 1) * dt / 1000);
        u.x += dx / d * step; u.y += dy / d * step; moving = true;
        if (Math.abs(dx) > Math.abs(dy) * 1.15) { u.dir = 'side'; u.face = dx > 0 ? 1 : -1; } else u.dir = dy > 0 ? 'front' : 'back';
      } else { // there: stand a while, now and then turn to look
        u.wait = 1200 + Math.random() * 3500;
        var to = pick(ca.spots); u.tx = to.x; u.ty = to.y;
        if (Math.random() < 0.4) { u.dir = ['side', 'front', 'back'][Math.floor(Math.random() * 3)]; u.face = -u.face; }
      }
      var key = sheetFor(self, u.k), lift = u.fly ? (0.35 + Math.sin(time / 240 + u.ph) * 0.06) * T : 0;
      if (key) {
        if (u.img.texture.key !== key) u.img.setTexture(key).setScale(u.base * 1.45 * T / C.RAID_ANIM.runW[u.k] * SIZE);
        var row = moving || u.fly ? 0 : 3, col = moving || u.fly ? Math.floor(time / (u.fly ? 80 : 110) + u.ph) % 4 : 3;
        u.img.setFrame((DIRROW[u.dir] + row) * 4 + col).setFlipX(u.dir === 'side' && u.face > 0);
      } else { // the battle picture (one pose a raider, sideways): a hop as it walks
        lift += moving && !u.fly ? Math.abs(Math.sin(time / 110 + u.ph)) * 0.1 * T : 0;
        u.img.setFlipX(u.face > 0);
      }
      u.img.setPosition(u.x, u.y - lift).setAlpha(u.alpha);
      u.sh.setPosition(u.x, u.y + 4).setAlpha(u.alpha * (u.fly ? 0.6 : 1));
      F.depthTo(u.img, DEPTH.actor + u.y / 1e5);
      return true;
    });
  };

  var create = P.create;
  P.create = function () {
    this.campArmy = null;
    this.campArmyMs = 0;
    create.apply(this, arguments);
    if (this.mapKey === 'farm') this.campArmySync();
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    if (this.mapKey !== 'farm' || this.busy) return;
    this.campArmyMs -= delta;
    if (this.campArmyMs <= 0) { this.campArmyMs = C.CAMP_ARMY.every; this.campArmySync(); }
    if (this.campArmy) this.campArmyFrame(Math.min(delta, 100), time);
  };
  // the camp moved in Decorate: they gather where it stands now
  var renderYard = P.renderYard;
  P.renderYard = function () {
    renderYard.apply(this, arguments);
    if (this.campArmy) this.campArmySync();
  };
})(window.Farm = window.Farm || {});

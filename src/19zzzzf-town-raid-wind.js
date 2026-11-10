// Town Raid: Typhoon Night's wind (owner's art, 11 Nov 2026; art-src/WINTER-RIDING-AND-WIND-PROMPTS.md #2,
// tools/art/town-wind-import.js). While the typhoon is on your farm (or the friend's you help), gusts blow across the
// screen from right to left, a few at a time, see-through, over the night like the lamps' glow but under every button
// (those are the UIScene's). Each gust is one row of ranim_wind (three streaks, a swirl, two quick dashes, a streak with
// leaves): appearing, strongest, curling thin, almost gone. In the 'raiders' pack, asked for as the typhoon comes; until
// it is on the phone there is no wind (the debris fly as before). A cheap phone (F.cheapPhone) gets one gust at a time.
(function (F) {
  'use strict';
  var C = F.Config;
  var P = F.WorldScene.prototype;
  var T = C.TILE;
  // fw x fh: a frame (keep in step with the importer); most: gusts at once (cheap: on a cheap phone); every: seconds
  // between gusts; life: seconds a gust lasts (its 4 frames); w: its width in tiles; speed: tiles a second, leftwards
  C.TOWN_WIND = { key: 'ranim_wind', fw: 320, fh: 184, most: 3, cheap: 1, every: [0.6, 1.5], cheapEvery: [2.2, 3.6], life: [1.5, 2.1], w: [4, 6], speed: [2.6, 4.2], alpha: 0.72, depth: 31.6 };
  var WD = C.TOWN_WIND;
  if (F.SHEETS) F.SHEETS[WD.key] = { frameWidth: WD.fw, frameHeight: WD.fh };
  var asked = 0; // (when it was last asked for: offline, again 10 s later, not every frame)
  var rnd = function (a) { return a[0] + Math.random() * (a[1] - a[0]); };
  var here = function () { return !!(F.images && F.images[WD.key]); };

  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    this.gusts = []; // (a scene is reused from map to map: its old gusts went with the old map)
    this.gustIn = 0;
  };

  // is it blowing here: the typhoon's raid, on this farm, now
  P.windOn = function () {
    var r = this.raidHere && this.raidHere() && F.Logic.raidNow();
    return !!(r && r.kind === 'typhoon');
  };

  P.addGust = function () {
    var cam = this.cameras.main, v = cam.worldView, w = rnd(WD.w) * T, row = Math.floor(Math.random() * 4);
    F.ensureTexture(this, WD.key);
    // somewhere on the right two thirds of the screen, not on its top or bottom edge
    var x = v.x + v.width * (0.35 + Math.random() * 0.75), y = v.y + v.height * (0.12 + Math.random() * 0.72);
    var img = this.add.image(x, y, WD.key, row * 4).setScale(w / WD.fw).setAlpha(0).setDepth(WD.depth);
    var g = { img: img, row: row, t: 0, life: rnd(WD.life) * 1000, vx: -rnd(WD.speed) * T / 1000, wob: Math.random() * 6.28 };
    this.gusts.push(g);
    return g;
  };

  // each frame: blow the gusts along, a new one now and then (none while a panel is open: they wait with the raid)
  P.windFrame = function (dt) {
    if (!this.gusts) this.gusts = [];
    var on = this.windOn();
    if (on && !here() && F.needImage && Date.now() - asked > 10000) { asked = Date.now(); F.needImage(WD.key); }
    if (on && here()) {
      var cheap = F.cheapPhone && F.cheapPhone(), most = cheap ? WD.cheap : WD.most;
      this.gustIn = (this.gustIn || 0) - dt;
      if (this.gustIn <= 0 && this.gusts.length < most) {
        this.gustIn = rnd(cheap ? WD.cheapEvery : WD.every) * 1000;
        this.addGust();
      }
    }
    for (var i = this.gusts.length - 1; i >= 0; i--) {
      var g = this.gusts[i], img = g.img;
      if (!img.active) { this.gusts.splice(i, 1); continue; }
      g.t += on ? dt : dt * 3; // (the typhoon over: they blow out quickly)
      var k = g.t / g.life;
      if (k >= 1) { img.destroy(); this.gusts.splice(i, 1); continue; }
      img.x += g.vx * dt * (k < 0.5 ? 1 : 1.25 - k * 0.5); // (it slows as it thins)
      img.y += Math.sin(g.wob + g.t / 260) * 0.03 * dt;
      img.setFrame(g.row * 4 + Math.min(3, Math.floor(k * 4)));
      img.setAlpha(WD.alpha * Math.min(1, k / 0.12, (1 - k) / 0.22));
    }
  };

  var raidFrame = P.raidFrame;
  P.raidFrame = function (dt, time) {
    var out = raidFrame.apply(this, arguments);
    if (!this.busy && !(F.ui && F.ui.blocking())) this.windFrame(dt, time);
    return out;
  };
})(window.Farm = window.Farm || {});

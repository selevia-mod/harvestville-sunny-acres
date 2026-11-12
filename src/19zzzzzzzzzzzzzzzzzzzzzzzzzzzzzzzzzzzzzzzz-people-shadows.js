// People's shadows (owner, 12 Nov 2026: "they don't have shadow, they look like they are floating"). The farmer and friends
// online had one (11-world.js 'fx-shadow'); the villagers, the city folk, the guides and the keepers did not. Every person
// on the map now stands on the same soft shadow: one shared picture, drawn in one batch under everyone (DEPTH.shadow), so
// 80 people in Manila cost 80 small quads, no new texture and nothing drawn per frame but a position.
//   - who: a sprite whose sheet is a person's (PERSON below), found every 400 ms (not every frame)
//   - where: at its feet, sized to it; hidden when it is (on the jeep, inside, faded out); gone with it
(function (F) {
  'use strict';
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  // a person's sheet: the villagers', the town's, the guides', Kanor's, Tita Luz's, Manila's people and keepers (npc_*)
  var PERSON = /^(people|tw_people|tita_luz|kanor|npc_.+)$/;
  var SCAN_MS = 400;
  // the farmer's frame is 256 x 384 with the feet 48 px above its bottom, its shadow 176 px wide (11-world.js): the same
  // proportions for everyone, from their size on screen
  var FOOT = 48 / 384, WIDE = 1 / 256;

  F.isPersonSheet = function (key) { return PERSON.test(key || ''); };

  var place = function (o, sh) {
    var w = o.displayWidth, h = o.displayHeight;
    sh.setPosition(o.x + (0.5 - o.originX) * w, o.y + (1 - o.originY) * h - h * FOOT).setScale(w * WIDE, w * WIDE);
    sh.setVisible(o.visible && o.alpha > 0.05);
    sh.setAlpha(Math.min(1, o.alpha));
  };

  P.peopleShadowsScan = function () {
    var list = this.children.list, ps = this.peopleShadows;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.type !== 'Sprite' || o.peopleShadow || o === this.player || !o.texture || !PERSON.test(o.texture.key)) continue;
      var sh = this.add.image(o.x, o.y, 'fx-shadow').setDepth(DEPTH.shadow);
      o.peopleShadow = sh;
      ps.push(o);
      place(o, sh);
    }
  };

  P.peopleShadowsUpdate = function (dt) {
    var ps = this.peopleShadows;
    if (!ps || !this.textures.exists('fx-shadow')) return;
    this.peopleShadowsT -= dt;
    if (this.peopleShadowsT <= 0) { this.peopleShadowsT = SCAN_MS; this.peopleShadowsScan(); }
    for (var i = ps.length - 1; i >= 0; i--) {
      var o = ps[i], sh = o.peopleShadow;
      if (!o.active || !o.scene || !PERSON.test(o.texture && o.texture.key)) { if (sh && sh.active) sh.destroy(); o.peopleShadow = null; ps.splice(i, 1); continue; }
      place(o, sh);
    }
  };

  var create = P.create;
  P.create = function () {
    this.peopleShadows = [];
    this.peopleShadowsT = 0;
    return create.apply(this, arguments);
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    if (this.peopleShadows) this.peopleShadowsUpdate(Math.min(delta, 100));
  };
})(window.Farm = window.Farm || {});

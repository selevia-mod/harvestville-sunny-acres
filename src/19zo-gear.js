// Hunter's gear (owner, 3 Nov 2026: "i like the hunting ideas"; C.GEAR in 00-zzzzhunt.js, rules 01-logicL.js): Kanor
// sells a Camo Cloak, Quiet Boots and a Big Quiver, each once, for Gold. They are always on in the Wild Lands: the cloak
// and the boots in how close shy animals let you come (19v-wild.js updateWild, for friends too: their gear rides in
// their presence, 'hg'), the quiver when an arrow misses (it flies back to you).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  // Kanor's Buy tab: one row each (done: openKanor's answer to a purchase).
  U.gearRows = function (s, done) {
    return C.GEAR.map(function (g) {
      if (L.hasGear(s, g.key)) return { icon: g.icon, name: g.name + ' (yours)', desc: g.desc + ' Always on in the Wild Lands.' };
      return { icon: g.icon, name: g.name, desc: g.desc, buttons: [{ label: g.gold + 'G', color: s.gold >= g.gold ? 0x5fa84a : 0xa08a68, cb: function () {
        var r = L.buyGear(s, g.key);
        if (r === 'ok' && F.Online && F.Online.retrack && F.Online.on) F.Online.retrack(); // (friends' phones go by it too)
        done(r, g.name + '! Always on when you hunt.');
      } }] };
    });
  };

  // The Big Quiver: a missed arrow springs back out of the ground to you, and into your bag.
  P.arrowBack = function (ar) {
    var self = this, s = this.state, f = this.feet();
    if (!L.canAdd(s, 'arrows', 1)) return;
    L.addItem(s, 'arrows', 1);
    F.ensureTexture(this, 'props/arrow_fly');
    var img = this.add.image(ar.x, ar.y, 'props/arrow_fly').setDisplaySize(0.85 * T, 0.28 * T).setRotation(ar.img.rotation).setDepth(DEPTH.fx);
    this.tweens.add({ targets: img, x: f.x, y: f.y - 0.6 * T, rotation: img.rotation + Math.PI * 2, scale: img.scale * 0.6, duration: 520, delay: 360, ease: 'Quad.inOut',
      onComplete: function () { img.destroy(); if (self.sys && self.sys.isActive()) { self.iconPop(f.x, f.y - 0.7 * T, C.ICON.arrows); sfx('pick'); } } });
    this.changed();
  };
})(window.Farm = window.Farm || {});

// A hit you can see (owner, 12 Nov 2026: "the bow arrow hit the enemy but looks like nothing happen, maybe a -XX damage").
// Every hit on a wild creature or a Tower enemy, yours or a friend's: its damage pops up over it ("-2", small, light red; a
// little bigger and redder when one hit takes more than half its life) and a small spark bursts where it was struck. (The flash and the flinch: 19v-wild.js.)
// Light on a phone: each number's picture is drawn once (a canvas, the first time it is needed) and the numbers and sparks
// are a pool of 12 images each, reused (the oldest when all are busy): no new text, no new texture per hit.
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var POOL = 12;

  // a number's picture: "-2", white (or gold) with a dark outline, 128 px tall
  var numKey = function (w, n, big) {
    var key = 'fx-dmg' + (big ? 'b' : '') + n;
    if (w.textures.exists(key)) return key;
    var str = '-' + n, H = 128, Wd = 64 + str.length * 66, c = w.textures.createCanvas(key, Wd, H), g = c.getContext();
    g.font = 'bold 104px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 12;
    g.strokeStyle = '#7a1e1e';
    g.strokeText(str, Wd / 2, H / 2 + 4);
    g.fillStyle = big ? '#ff7a7a' : '#ffa3a3'; // (owner: small and light red)
    g.fillText(str, Wd / 2, H / 2 + 4);
    c.refresh();
    return key;
  };
  // the spark: a soft star, drawn once
  var sparkKey = function (w) {
    var key = 'fx-hitspark';
    if (w.textures.exists(key)) return key;
    var S = 128, c = w.textures.createCanvas(key, S, S), g = c.getContext(), r = S / 2;
    // solid colours (a soft see-through edge came out brown on the phone's graphics)
    var star = function (outer, inner, n) {
      g.beginPath();
      for (var i = 0; i < n * 2; i++) { var ang = i * Math.PI / n - Math.PI / 2, rad = i % 2 ? inner : outer; g.lineTo(r + Math.cos(ang) * rad, r + Math.sin(ang) * rad); }
      g.closePath();
    };
    star(r - 4, r * 0.36, 8);
    g.fillStyle = '#ffb02e';
    g.fill();
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = '#7a3a0e';
    g.stroke();
    star(r * 0.62, r * 0.24, 8);
    g.fillStyle = '#fff6c8';
    g.fill();
    c.refresh();
    return key;
  };
  var take = function (w, list, make) { // a free one from the pool, or the oldest
    for (var j = list.length - 1; j >= 0; j--) if (!list[j].active || !list[j].scene) list.splice(j, 1); // (gone with a scene)
    var o = null;
    for (var i = 0; i < list.length && !o; i++) if (!list[i].visible) o = list[i];
    if (!o && list.length < POOL) list.push(o = make());
    if (!o) { o = list.shift(); list.push(o); }
    w.tweens.killTweensOf(o);
    return o;
  };

  P.hitPop = function (x, y, n, big, size) {
    if (!this.add || !(n > 0)) return;
    var w = this, hp = this.hitPops || (this.hitPops = { nums: [], sparks: [] });
    var sp = take(w, hp.sparks, function () { return w.add.image(0, 0, sparkKey(w)).setDepth(DEPTH.fx + 0.02); });
    var s0 = (0.9 + 0.3 * Math.min(2, size || 1)) * T / 128;
    sp.setPosition(x, y + 0.35 * T).setVisible(true).setAlpha(1).setScale(s0 * 0.8).setRotation(Math.random() * Math.PI);
    w.tweens.add({ targets: sp, scale: s0 * 1.6, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: function () { sp.setVisible(false); } });
    var key = numKey(w, n, big);
    var im = take(w, hp.nums, function () { return w.add.image(0, 0, key).setDepth(DEPTH.fx + 0.03); });
    var k = (big ? 0.6 : 0.48) * T / 128;
    im.setTexture(key).setPosition(x + (Math.random() - 0.5) * 0.4 * T, y - 0.1 * T).setVisible(true).setAlpha(1).setScale(k * 1.45);
    w.tweens.add({ targets: im, scale: k, duration: 140, ease: 'Back.out' });
    w.tweens.add({ targets: im, y: im.y - 0.8 * T, delay: 80, duration: 620, ease: 'Quad.out' });
    w.tweens.add({ targets: im, alpha: 0, delay: 420, duration: 300, onComplete: function () { im.setVisible(false); } });
  };

  // the scene starts again for each floor and each map: a new pool (the old one went with it)
  var create = P.create;
  P.create = function () { this.hitPops = null; return create.apply(this, arguments); };

  // every hit: the life it took, over the creature (before the hit, while it is still there)
  var wildStruck = P.wildStruck;
  P.wildStruck = function (a) {
    var before = a.hp, img = a.img, x = a.x, top = img && img.active ? a.y - img.displayHeight * 0.55 : a.y - T;
    var max = a.max || a.hpMax || (a.hpMax = Math.max(a.hp || 1, (a.def && a.def.hp) || 1));
    var r = wildStruck.apply(this, arguments);
    var n = Math.round((before - Math.max(0, a.hp)) * 10) / 10;
    if (n > 0) this.hitPop(x, top, n, n > max / 2, a.def && a.def.w);
    return r;
  };
})(window.Farm = window.Farm || {});

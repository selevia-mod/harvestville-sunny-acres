// The animals in the pen: wandering, poses, produce bubbles and little heart effects.
// Their care state (fed, petted, produce, love) lives in state.animals; this only draws them.
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
  var POSE = { walkA: 0, walkB: 1, eat: 2, sleep: 3 };
  var DEPTH = 10; // same band as the player, sorted by feet y
  var NIGHT = 20 * 60; // animals sleep from 8 PM

  F.Herd = class {
    constructor(scene, pen) {
      this.scene = scene;
      this.pen = pen; // wander area in world units: { x0, y0, x1, y1 }
      this.members = [];
      for (var i = 0; i < scene.state.animals.length; i++) this.add(i);
    }

    add(i) {
      var sc = this.scene, def = C.ANIMALS[sc.state.animals[i].kind], p = this.randomSpot();
      var m = { i: i, def: def, x: p.x, y: p.y, tx: p.x, ty: p.y, wait: Math.random() * 2500, hold: 0, eat: false, flip: Math.random() < 0.5, pose: 'walkA' };
      m.sprite = sc.add.image(p.x, p.y, 'animals', def.frame0).setOrigin(0.5, 300 / 320);
      m.bubble = sc.add.image(0, 0, 'items', C.ICON.bubble).setDepth(21);
      m.icon = sc.add.image(0, 0, 'items', C.ITEMS[def.product].icon).setScale(0.62).setDepth(22);
      this.members.push(m);
      this.place(m, 0);
      return m;
    }

    randomSpot() {
      var p = this.pen;
      return { x: Phaser.Math.Between(p.x0 + T * 0.6, p.x1 - T * 0.6), y: Phaser.Math.Between(p.y0 + T * 0.7, p.y1 - T * 0.15) };
    }

    // New day: everyone wakes up somewhere new.
    scatter() {
      var self = this;
      this.members.forEach(function (m) {
        var p = self.randomSpot();
        m.x = m.tx = p.x;
        m.y = m.ty = p.y;
        m.wait = Math.random() * 2500;
      });
    }

    update(dt, time, minutes) {
      var self = this, night = minutes >= NIGHT;
      this.members.forEach(function (m) {
        if (night) {
          m.pose = 'sleep';
        } else if (m.hold > 0) {
          m.hold -= dt; // the farmer is facing it, so stand still
          if (m.pose !== 'eat') m.pose = 'walkA';
        } else if (m.wait > 0) {
          m.wait -= dt;
          m.pose = m.eat && (m.def === C.ANIMALS.cow || Math.floor(time / 350) % 2) ? 'eat' : 'walkA';
          if (m.wait <= 0) {
            var p = self.randomSpot();
            m.tx = p.x;
            m.ty = p.y;
          }
        } else {
          var dx = m.tx - m.x, dy = m.ty - m.y, d = Math.sqrt(dx * dx + dy * dy);
          var step = m.def.speed * dt / 1000;
          if (d <= step) {
            m.x = m.tx;
            m.y = m.ty;
            m.wait = Phaser.Math.Between(1500, 5000);
            m.eat = Math.random() < 0.6;
          } else {
            m.x += dx / d * step;
            m.y += dy / d * step;
            if (Math.abs(dx) > 4) m.flip = dx > 0; // the art faces left
            m.pose = Math.floor(time / (m.def === C.ANIMALS.cow ? 260 : 150)) % 2 ? 'walkA' : 'walkB';
          }
        }
        self.place(m, time);
      });
    }

    place(m, time) {
      var a = this.scene.state.animals[m.i];
      m.sprite.setPosition(m.x, m.y).setFrame(m.def.frame0 + POSE[m.pose]).setFlipX(m.flip).setDepth(DEPTH + m.y / 1e5);
      var by = m.y - m.def.height * T - 80 + Math.sin(time / 300) * 10;
      m.bubble.setVisible(!!a.ready).setPosition(m.x, by);
      m.icon.setVisible(!!a.ready).setPosition(m.x, by - 6);
    }

    // The animal whose body covers a world point (the spot in front of the farmer), if any.
    at(x, y) {
      var best = null, bestD = Infinity;
      this.members.forEach(function (m) {
        var cx = m.x, cy = m.y - m.def.height * T * 0.4;
        var d = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
        if (d < m.def.reach * T && d < bestD) {
          best = m;
          bestD = d;
        }
      });
      return best;
    }

    hold(m) {
      m.hold = 600;
    }

    hearts(m, n) {
      var sc = this.scene;
      for (var k = 0; k < n; k++) {
        var h = sc.add.image(m.x + Phaser.Math.Between(-60, 60), m.y - m.def.height * T * 0.6, 'items', C.ICON.heart)
          .setScale(0.5).setDepth(23);
        sc.tweens.add({
          targets: h, y: h.y - 160, alpha: 0, scale: 0.8, delay: k * 120, duration: 800, ease: 'Quad.out',
          onComplete: function (tw, targets) { targets[0].destroy(); },
        });
      }
    }
  };
})(window.Farm = window.Farm || {});

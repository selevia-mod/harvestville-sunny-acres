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
      m.scale = sc.state.animals[i].young ? 0.6 : 1; // chicks and calves are small
      m.bubble = sc.add.image(0, 0, 'items', C.ICON.bubble).setDepth(21);
      m.icon = sc.add.image(0, 0, 'items', C.ITEMS[def.product].icon).setScale(0.62).setDepth(22);
      this.members.push(m);
      this.place(m, 0);
      return m;
    }

    randomSpot() {
      var p = this.pen || { x0: 0, y0: 0, x1: 4 * T, y1: 4 * T };
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
      m.sprite.setPosition(m.x, m.y).setFrame(m.def.frame0 + POSE[m.pose]).setFlipX(m.flip).setDepth(DEPTH + m.y / 1e5).setScale(m.scale);
      var by = m.y - m.def.height * T * m.scale - 80 + Math.sin(time / 300) * 10;
      m.bubble.setVisible(!!a.ready).setPosition(m.x, by);
      m.icon.setVisible(!!a.ready).setPosition(m.x, by - 6);
    }

    // The animal whose body covers a world point (the spot in front of the farmer), if any.
    at(x, y) {
      var best = null, bestD = Infinity;
      this.members.forEach(function (m) {
        var cx = m.x, cy = m.y - m.def.height * T * 0.4 * m.scale;
        var d = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
        if (d < m.def.reach * T * Math.max(0.8, m.scale) && d < bestD) {
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

  // The farm dog: trots around his yard by the house, sits when he sees you, sleeps at night.
  F.Dog = class {
    constructor(scene, area, def, scale) {
      this.scene = scene;
      this.area = area;
      this.def = def || C.DOG;
      var p = this.spot();
      this.x = this.tx = p.x;
      this.y = this.ty = p.y;
      this.wait = 1000;
      this.sit = 0;
      this.flip = false;
      this.sprite = scene.add.image(p.x, p.y, 'animals', this.def.frame0).setOrigin(0.5, 300 / 320).setScale(scale || 0.8);
    }

    spot() {
      var a = this.area;
      return { x: Phaser.Math.Between(a.x0 + T * 0.5, a.x1 - T * 0.5), y: Phaser.Math.Between(a.y0 + T * 0.6, a.y1 - T * 0.2) };
    }

    update(dt, time, minutes) {
      var pose = 0, f = this.scene.feet();
      var near = Math.abs(f.x - this.x) < 2 * T && Math.abs(f.y - this.y) < 2 * T;
      if (minutes >= NIGHT) {
        pose = 3;
      } else if (this.sit > 0 || near) {
        this.sit = Math.max(0, this.sit - dt);
        pose = 2;
        if (Math.abs(f.x - this.x) > 20) this.flip = f.x > this.x;
      } else if (this.wait > 0) {
        this.wait -= dt;
        pose = 2;
        if (this.wait <= 0) {
          var p = this.spot();
          this.tx = p.x;
          this.ty = p.y;
        }
      } else {
        var dx = this.tx - this.x, dy = this.ty - this.y, d = Math.sqrt(dx * dx + dy * dy), step = this.def.speed * dt / 1000;
        if (d <= step) {
          this.x = this.tx;
          this.y = this.ty;
          this.wait = Phaser.Math.Between(1500, 4000);
        } else {
          this.x += dx / d * step;
          this.y += dy / d * step;
          if (Math.abs(dx) > 4) this.flip = dx > 0;
          pose = Math.floor(time / 120) % 2;
        }
      }
      this.sprite.setPosition(this.x, this.y).setFrame(this.def.frame0 + pose).setFlipX(this.flip).setDepth(DEPTH + this.y / 1e5);
    }

    near(x, y) {
      var cx = this.x, cy = this.y - this.def.height * T * 0.4;
      return Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y)) < this.def.reach * T;
    }

    happy() {
      var sc = this.scene, self = this;
      this.sit = 2500;
      for (var k = 0; k < 3; k++) {
        var h = sc.add.image(self.x + Phaser.Math.Between(-50, 50), self.y - T * 0.5, 'items', C.ICON.heart).setScale(0.5).setDepth(23);
        sc.tweens.add({ targets: h, y: h.y - 160, alpha: 0, delay: k * 120, duration: 800, onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
      sc.tweens.add({ targets: this.sprite, scaleY: 0.7, duration: 90, yoyo: true, repeat: 2 });
    }
  };
})(window.Farm = window.Farm || {});

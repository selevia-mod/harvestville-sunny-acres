// The animals in the pen: wandering, poses, produce bubbles and little heart effects.
// Their care state (fed, petted, produce, love) lives in state.animals; this only draws them.
// Drawn from above like the farmer (owner, 30 Oct 2026): each has 12 frames in the animals sheet, 0-2 walking toward you,
// 3-5 away, 6-8 to the left (stand, step, step; flipped for the right), then its own last row: barn animals 9 eating
// (left), 10 asleep (left), 11 happy, facing you; dog and cat 9 sitting, facing you, 10 asleep (left), 11 running or
// stretching (left); the horse 9 standing, facing you, 10 eating (left), 11 galloping (left). animalshade has the shadow
// of each frame, so their feet are on the ground (tools/art/animals3q-import.js).
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
  var POSE = { eat: 9, sleep: 10, happy: 11 };
  var FACING = { down: 0, up: 3, side: 6 }, STEPS = [1, 0, 2, 0];
  var ORIGIN = 233 / 252; // the feet line in a frame
  var DEPTH = 10, SHADOW = 9; // same band as the player, sorted by feet y
  var NIGHT = 20 * 60; // animals sleep from 8 PM

  // Shared with the horse (19-extras.js).
  F.Anim = {
    FACING: FACING,
    STEPS: STEPS,
    scale: function (def) { return def.w * T / def.px; },
    image: function (scene, x, y, def) {
      return scene.add.image(x, y, F.ensureTexture(scene, 'animals'), def.frame0 + FACING.side).setOrigin(0.5, ORIGIN).setScale(F.Anim.scale(def));
    },
    shadow: function (scene, x, y, def) {
      return scene.add.image(x, y, F.ensureTexture(scene, 'animalshade'), def.frame0 + FACING.side).setOrigin(0.5, ORIGIN).setScale(F.Anim.scale(def)).setDepth(SHADOW);
    },
    // one frame of it, in its picture and its shadow
    show: function (a, frame, flip) {
      a.sprite.setFrame(frame).setFlipX(flip);
      a.sh.setFrame(frame).setFlipX(flip);
    },
    // which way something faces as it moves: sideways, or toward / away from you (with a little give on a slant)
    face: function (a, dx, dy) {
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax > ay * 1.2) a.dir = 'side'; else if (ay > ax * 1.2) a.dir = dy > 0 ? 'down' : 'up';
      if (ax > 4) a.flip = dx > 0; // the side frames face left
    },
    // breathing while it stands (it grows from its feet, so they stay put)
    breathe: function (sprite, scale, time, seed, slow) {
      var b = Math.sin(time / (slow ? 900 : 520) + seed);
      sprite.setScale(scale * (1 - b * 0.006), scale * (1 + b * 0.018));
    },
  };

  F.Herd = class {
    constructor(scene, pen) {
      this.scene = scene;
      this.pen = pen; // wander area in world units: { x0, y0, x1, y1 }
      this.members = [];
      for (var i = 0; i < scene.state.animals.length; i++) this.add(i);
    }

    add(i) {
      var sc = this.scene, def = C.ANIMALS[sc.state.animals[i].kind], p = this.randomSpot();
      var m = { i: i, def: def, x: p.x, y: p.y, tx: p.x, ty: p.y, wait: Math.random() * 2500, hold: 0, eat: false, flip: Math.random() < 0.5, pose: 'stand', dir: 'side', joy: 0 };
      m.sprite = F.Anim.image(sc, p.x, p.y, def);
      m.sh = F.Anim.shadow(sc, p.x, p.y, def);
      m.scale = F.Anim.scale(def) * (sc.state.animals[i].young ? 0.6 : 1); // chicks, calves and piglets are small
      m.small = sc.state.animals[i].young ? 0.6 : 1;
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
        } else if (m.joy > 0) {
          m.joy -= dt; // petted, fed: it looks up, pleased
          m.pose = 'happy';
        } else if (m.hold > 0) {
          m.hold -= dt; // the farmer is facing it, so stand still
          if (m.pose !== 'eat') m.pose = 'stand';
        } else if (m.wait > 0) {
          m.wait -= dt;
          m.pose = m.eat && (m.def.home === 'barn' || Math.floor(time / 350) % 2) ? 'eat' : 'stand';
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
            F.Anim.face(m, dx, dy);
            m.pose = 'walk';
          }
        }
        self.place(m, time);
      });
    }

    place(m, time) {
      var a = this.scene.state.animals[m.i], k;
      if (m.pose === 'walk') k = FACING[m.dir] + STEPS[Math.floor(time / (m.def === C.ANIMALS.cow ? 260 : 150)) % 4];
      else k = POSE[m.pose] || FACING[m.dir];
      F.Anim.show(m, m.def.frame0 + k, k >= 6 && k !== POSE.happy && m.flip);
      m.sh.setPosition(m.x, m.y).setScale(m.scale);
      if (m.pose === 'stand' || m.pose === 'sleep') F.Anim.breathe(m.sprite, m.scale, time, m.i * 2, m.pose === 'sleep');
      else m.sprite.setScale(m.scale);
      F.depthTo(m.sprite.setPosition(m.x, m.y), DEPTH + m.y / 1e5);
      var by = m.y - m.def.height * T * m.small - 80 + Math.sin(time / 300) * 10;
      m.bubble.setVisible(!!a.ready).setPosition(m.x, by);
      m.icon.setVisible(!!a.ready).setPosition(m.x, by - 6);
    }

    // The animal whose body covers a world point (the spot in front of the farmer), if any.
    at(x, y) {
      var best = null, bestD = Infinity;
      this.members.forEach(function (m) {
        var cx = m.x, cy = m.y - m.def.height * T * 0.4 * m.small;
        var d = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
        if (d < m.def.reach * T * Math.max(0.8, m.small) && d < bestD) {
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
      m.joy = 900;
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
    constructor(scene, area, def) {
      this.scene = scene;
      this.area = area;
      this.def = def || C.DOG;
      var p = this.spot();
      this.x = this.tx = p.x;
      this.y = this.ty = p.y;
      this.wait = 1000;
      this.sit = 0;
      this.flip = false;
      this.dir = 'side';
      this.joy = 0;
      this.sprite = F.Anim.image(scene, p.x, p.y, this.def);
      this.sh = F.Anim.shadow(scene, p.x, p.y, this.def);
    }

    spot() {
      var a = this.area;
      return { x: Phaser.Math.Between(a.x0 + T * 0.5, a.x1 - T * 0.5), y: Phaser.Math.Between(a.y0 + T * 0.6, a.y1 - T * 0.2) };
    }

    update(dt, time, minutes) {
      var k = 9, f = this.scene.feet(), walking = false, def = this.def;
      var near = Math.abs(f.x - this.x) < 2 * T && Math.abs(f.y - this.y) < 2 * T;
      if (minutes >= NIGHT) {
        k = 10;
      } else if (this.sit > 0 || near) {
        this.sit = Math.max(0, this.sit - dt);
        if (Math.abs(f.x - this.x) > 20) this.flip = f.x > this.x;
      } else if (this.wait > 0) {
        this.wait -= dt;
        if (def === C.CAT && Math.floor(time / 5000) % 3 === 1) k = 11; // a good stretch
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
          F.Anim.face(this, dx, dy);
          walking = true;
          if (def === C.CAT || this.dir !== 'side') k = FACING[this.dir] + STEPS[Math.floor(time / 120) % 4];
          else k = Math.floor(time / 120) % 2 ? 11 : 7; // the dog runs
        }
      }
      F.Anim.show(this, def.frame0 + k, k >= 6 && k !== 9 && this.flip);
      var scale = F.Anim.scale(def);
      if (this.joy > 0) this.joy -= dt;
      else if (!walking) F.Anim.breathe(this.sprite, scale, time, 1, k === 10);
      else this.sprite.setScale(scale);
      this.sh.setPosition(this.x, this.y);
      F.depthTo(this.sprite.setPosition(this.x, this.y), DEPTH + this.y / 1e5);
    }

    near(x, y) {
      var cx = this.x, cy = this.y - this.def.height * T * 0.4;
      return Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y)) < this.def.reach * T;
    }

    happy() {
      var sc = this.scene, self = this;
      this.sit = 2500;
      this.joy = 560;
      this.sprite.setScale(F.Anim.scale(this.def));
      for (var k = 0; k < 3; k++) {
        var h = sc.add.image(self.x + Phaser.Math.Between(-50, 50), self.y - T * 0.5, 'items', C.ICON.heart).setScale(0.5).setDepth(23);
        sc.tweens.add({ targets: h, y: h.y - 160, alpha: 0, delay: k * 120, duration: 800, onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
      sc.tweens.add({ targets: this.sprite, scaleY: F.Anim.scale(this.def) * 0.87, duration: 90, yoyo: true, repeat: 2 });
    }
  };
})(window.Farm = window.Farm || {});

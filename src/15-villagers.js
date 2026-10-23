// Villagers walking around town on their daily schedules (and the spouse at home in the farmhouse).
// Where each one should be comes from Logic.villagerAt; this moves the sprites there along the paths.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var SPEED = 600; // world units per second (about 2.3 tiles/s)
  var DEPTH = 10;

  F.Villagers = class {
    constructor(scene) {
      var self = this;
      this.scene = scene;
      this.map = scene.mapKey;
      this.list = [];
      F.ensureTexture(scene, 'people');
      var s = scene.state;
      C.VILLAGER_ORDER.forEach(function (key, i) {
        if (self.map === 'house' && s.spouse !== key) return;
        var v = {
          key: key, i: i, def: C.VILLAGERS[key], place: null, path: [], hold: 0, dir: 'down', visible: false,
          sprite: scene.add.sprite(0, 0, 'people', i * 9).setOrigin(0.5, 0.83).setScale(2).setVisible(false),
        };
        self.list.push(v);
        var target = self.targetOf(v, s.time);
        v.place = target.place;
        if (target.point) self.put(v, target.point.x, target.point.y, !target.hide);
        if (target.hide) v.from = target.point; // they will come out of this door
      });
      // villagers are solid: the farmer walks around them, not through them
      var sprites = this.list.map(function (v) {
        scene.physics.add.existing(v.sprite);
        v.sprite.body.setSize(60, 30).setOffset(34, 145).setImmovable(true);
        v.sprite.body.moves = false;
        v.sprite.body.enable = v.visible;
        return v.sprite;
      });
      if (sprites.length) scene.physics.add.collider(scene.player, sprites);
    }

    // Where a villager should be right now: { place, point, hide } (hide = goes indoors / out of town there).
    targetOf(v, time) {
      var sc = this.scene, place = L.villagerAt(sc.state, v.key, time), pts = sc.points;
      if (this.map === 'house') return place === 'home' ? { place: place, point: pts.spouse } : { place: place, point: null, hide: true };
      if (place.indexOf('in:') === 0) return { place: place, point: pts['door_' + place.slice(3)], hide: true };
      if (place === 'away' || place === 'home') return { place: place, point: pts.from_farm, hide: true };
      return { place: place, point: pts[place] || pts.plaza_c };
    }

    put(v, x, y, visible) {
      v.x = x;
      v.y = y;
      v.visible = visible;
      v.path = [];
      v.sprite.setVisible(visible).setPosition(x, y).setDepth(DEPTH + y / 1e5);
      if (v.sprite.body) v.sprite.body.enable = visible;
      this.stand(v);
    }

    stand(v) {
      var base = v.i * 9 + (v.dir === 'up' ? 3 : v.dir === 'down' ? 0 : 6);
      v.sprite.anims.stop();
      v.sprite.setFrame(base).setFlipX(v.dir === 'right');
    }

    update(dt, time, frozen) {
      var self = this, sc = this.scene, f = sc.feet();
      this.list.forEach(function (v) {
        var target = self.targetOf(v, sc.state.time);
        if (target.place !== v.place) {
          v.place = target.place;
          self.walkTo(v, target);
        }
        if (frozen || !v.path.length) return;
        if (v.hold > 0) { v.hold -= dt; return; }
        var dxp = f.x - v.x, dyp = f.y - v.y;
        if (dxp * dxp + dyp * dyp < T * T * 0.6) { // the farmer is in the way
          if (v.sprite.anims.isPlaying) self.stand(v);
          return;
        }
        var p = v.path[0], dx = p.x - v.x, dy = p.y - v.y, d = Math.sqrt(dx * dx + dy * dy), step = SPEED * dt / 1000;
        if (d <= step) {
          v.x = p.x;
          v.y = p.y;
          v.path.shift();
          if (!v.path.length) {
            if (v.hideAtEnd) {
              v.visible = false;
              v.sprite.setVisible(false);
              v.sprite.body.enable = false;
            }
            v.dir = 'down';
            self.stand(v);
          }
        } else {
          v.x += dx / d * step;
          v.y += dy / d * step;
          var dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
          if (dir !== v.dir || !v.sprite.anims.isPlaying) {
            v.dir = dir;
            v.sprite.anims.play('v-' + v.key + '-' + (dir === 'left' || dir === 'right' ? 'side' : dir), true);
            v.sprite.setFlipX(dir === 'right');
          }
        }
        v.sprite.setPosition(v.x, v.y).setDepth(DEPTH + v.y / 1e5);
      });
    }

    // Starts a walk to a target. Someone who was indoors steps out of the door they went in by.
    walkTo(v, target) {
      if (!target.point) {
        this.put(v, v.x || 0, v.y || 0, false);
        return;
      }
      if (!v.visible) {
        var from = v.from || target.point;
        this.put(v, from.x, from.y, true);
      }
      v.from = target.hide ? target.point : null;
      v.hideAtEnd = !!target.hide;
      v.path = this.route(v.x, v.y, target.point.x, target.point.y);
    }

    // A path of tile centres from one world point to another, found with a breadth-first search.
    route(x0, y0, x1, y1) {
      var sc = this.scene, W = sc.map.width, H = sc.map.height;
      var sx = Math.floor(x0 / T), sy = Math.floor(y0 / T), ex = Math.floor(x1 / T), ey = Math.floor(y1 / T);
      var start = sy * W + sx, end = ey * W + ex, prev = new Int32Array(W * H).fill(-1), queue = [start];
      prev[start] = start;
      while (queue.length) {
        var cur = queue.shift();
        if (cur === end) break;
        var cx = cur % W, cy = (cur - cx) / W;
        for (var k = 0; k < 4; k++) {
          var nx = cx + [1, -1, 0, 0][k], ny = cy + [0, 0, 1, -1][k], n = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[n] >= 0) continue;
          if (n !== end && !sc.walkable(nx, ny)) continue;
          prev[n] = cur;
          queue.push(n);
        }
      }
      if (prev[end] < 0) return [{ x: x1, y: y1 }]; // no path: walk straight there
      var tiles = [];
      for (var at = end; at !== start; at = prev[at]) tiles.unshift(at);
      var path = tiles.slice(0, -1).map(function (i) { return { x: (i % W) * T + T / 2, y: Math.floor(i / W) * T + T / 2 + 40 }; });
      path.push({ x: x1, y: y1 });
      return path;
    }

    // The villager standing at a world point (the spot in front of the farmer), if any.
    at(x, y) {
      var best = null, bestD = T * 0.8;
      this.list.forEach(function (v) {
        if (!v.visible) return;
        var dx = v.x - x, dy = v.y - T * 0.3 - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestD) {
          best = v;
          bestD = d;
        }
      });
      return best;
    }

    // Turns to face the farmer and stays put for a moment.
    greet(v, playerDir) {
      v.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[playerDir];
      v.hold = 5000;
      this.stand(v);
    }

    hearts(v, n) {
      var sc = this.scene;
      for (var k = 0; k < n; k++) {
        var h = sc.add.image(v.x + Phaser.Math.Between(-60, 60), v.y - T * 1.2, 'items', C.ICON.heart).setScale(0.5).setDepth(23);
        sc.tweens.add({ targets: h, y: h.y - 160, alpha: 0, delay: k * 120, duration: 800, onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
    }
  };

  // ---------- talking, gifts and proposals (mixed into WorldScene) ----------
  var M = {};
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  M.villagerAction = function (v) {
    var self = this, s = this.state, held = L.held(s), f = L.friend(s, v.key);
    var fest = L.festivalNow(s);
    if (fest && v.key === 'hollis') return { label: 'Festival', icon: C.ICON.ribbon, run: function () { self.villagers.greet(v, self.dir); F.ui.openFestival(fest); } };
    if (held && held.id === 'blue_feather' && v.def.candidate) return { label: 'Propose', icon: C.ICON.blue_feather, run: function () { self.propose(v); } };
    if (held && L.giftable(held.id) && !f.gifted) return { label: 'Gift', icon: C.ICON.gift, run: function () { self.gift(v); } };
    return { label: 'Talk', icon: C.ICON.note, run: function () { self.talkTo(v); } };
  };

  M.talkTo = function (v) {
    var self = this, s = this.state;
    this.villagers.greet(v, this.dir);
    var ev = !L.friend(s, v.key).talked && L.heartEvent(s, v.key);
    if (ev) return this.playHeartEvent(v, ev);
    var r = L.talk(s, v.key);
    sfx('talk');
    this.emote(v, C.ICON.note);
    var name = v.def.name + (s.spouse === v.key ? ' (your spouse)' : '');
    F.ui.say(v.key, name, r.line);
    this.changed();
    if (r.first) this.progress('meet');
    void self;
  };

  // A little story scene at a friendship milestone, with a choice at the end.
  M.playHeartEvent = function (v, e) {
    var self = this, s = this.state, ev = e.ev;
    L.friend(s, v.key).met = 1;
    sfx('gift');
    this.emote(v, C.ICON.heart);
    F.ui.playLines(ev.lines, function () {
      F.ui.choose(v.key, ev.choice.q, ev.choice.a.map(function (a, k) {
        return {
          label: a[0], cb: function () {
            var reply = L.finishEvent(s, v.key, e.i, k);
            if (a[1] > 0) self.villagers.hearts(v, a[1] >= 8 ? 5 : 3);
            sfx(a[1] > 0 ? 'gift' : 'nope');
            F.ui.say(v.key, v.def.name, reply);
            self.changed();
            self.save();
          },
        };
      }));
    });
  };

  M.gift = function (v) {
    var s = this.state, held = L.held(s), item = C.ITEMS[held.id].name;
    var r = L.giveGift(s, v.key, s.sel);
    if (r.error) return;
    this.villagers.greet(v, this.dir);
    if (r.pts > 0) this.villagers.hearts(v, r.reaction === 'love' ? 4 : r.reaction === 'like' ? 2 : 1);
    this.emote(v, r.pts > 0 ? C.ICON.heart : C.ICON.exclaim);
    sfx(r.pts > 0 ? 'gift' : 'nope');
    F.ui.say(v.key, v.def.name, '(You gave the ' + item + '.)\n' + r.line);
    this.changed();
  };

  M.propose = function (v) {
    var s = this.state, r = L.propose(s, v.key, s.sel), D = C.DIALOGUE[v.key];
    this.villagers.greet(v, this.dir);
    var why = {
      taken: "You're already spoken for!", house: 'You need the House Extension from the woodshop before you can marry.',
      hearts: D.propose ? D.propose.no : '', notcandidate: '',
    };
    if (r === 'yes') {
      this.villagers.hearts(v, 6);
      sfx('wedding');
      F.ui.say(v.key, v.def.name, D.propose.yes + '\n\n(The wedding is on ' + L.formatDate(s.engaged.day) + '.)');
      this.changed();
      this.save();
      return;
    }
    if (r === 'hearts') return F.ui.say(v.key, v.def.name, why.hearts + '\n\n(You need ' + C.FRIEND.marry / 10 + ' hearts.)');
    F.ui.toast(why[r] || 'Hmm.');
  };

  Object.assign(F.WorldScene.prototype, M);
})(window.Farm = window.Farm || {});

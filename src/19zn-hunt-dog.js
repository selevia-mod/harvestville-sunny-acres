// Your farm dog comes hunting (owner, 3 Nov 2026: "i like the hunting ideas"; numbers C.HUNT_DOG, 00-zzzzhunt.js). In
// the Wild Lands it trots a little behind you and sits when you stop. Now and then it stops, faces an animal hiding out
// of sight in the grass, and barks with a "!" over its head: walk the way it points. What a hunt leaves on the ground a
// little way off, it runs to fetch: the thing goes in your bag as it picks it up (nothing is lost if you leave), and it
// trots back with it in its mouth. When a boar or a wolf charges you, it barks. Friends' dogs come too, and follow them
// on your screen (only yours points and fetches). The same picture as the farm dog (13-animals.js).
(function (F) {
  'use strict';
  var DOGS = 6; // others' dogs drawn at most (the nearest)
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var HD = C.HUNT_DOG;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var A = F.Anim, FACING = A.FACING, STEPS = A.STEPS, DOG = C.DOG;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var sfx = function (name, soft) { if (F.Audio) { if (soft && F.Audio.sfxSoft) F.Audio.sfxSoft(name, 0.5); else F.Audio.sfx(name); } };

  var makeDog = function (w, x, y, owner) {
    var d = { owner: owner, x: x, y: y, dir: 'side', flip: false, mode: 'follow', still: 0, sniffIn: rand(HD.sniffEvery[0], HD.sniffEvery[1]), t: 0, seed: rand(0, 6) };
    d.sprite = A.image(w, x, y, DOG);
    d.sh = A.shadow(w, x, y, DOG);
    d.scale = A.scale(DOG);
    return d;
  };
  var dropDog = function (d) {
    [d.sprite, d.sh, d.mark, d.carry].forEach(function (o) { if (o) o.destroy(); });
  };

  // A drop says when it landed: the dog leaves it a moment (it bounces, and you may be walking over to it yourself).
  var dropWild = P.dropWild;
  P.dropWild = function (id, x, y) {
    dropWild.call(this, id, x, y);
    var d = this.wildDrops[this.wildDrops.length - 1];
    if (d) d.at = Date.now();
  };

  // ---------- setting up ----------
  var create = P.create;
  P.create = function () {
    this.huntDog = null;
    this.friendDogs = {};
    create.call(this);
    if (!this.wild || !this.player) return;
    var f = this.feet();
    this.huntDog = makeDog(this, f.x - HD.behind * T, f.y + 0.2 * T, null);
    this.huntDog.sprite.setAlpha(0);
    this.tweens.add({ targets: this.huntDog.sprite, alpha: 1, duration: 300 });
  };

  // ---------- every frame ----------
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (!this.wild || !this.huntDog || this.busy || !this.sys.isActive()) return;
    var dt = Math.min(delta, 100), self = this, busy = !F.ui || F.ui.blocking();
    this.updateHuntDog(this.huntDog, this.feet(), dt, time, busy);
    // friends' dogs: one for each friend here, following them (at most the DOGS nearest: a hunting place open to
    // everyone can have 15 others drawn, and a cheap phone should not draw 15 dogs too)
    var seen = {}, me = this.feet(), rs = this.remotes || {};
    Object.keys(rs).sort(function (a, b) { return Math.hypot(rs[a].x - me.x, rs[a].y - me.y) - Math.hypot(rs[b].x - me.x, rs[b].y - me.y); }).slice(0, DOGS).forEach(function (id) {
      var r = rs[id];
      seen[id] = true;
      var fd = self.friendDogs[id];
      if (!fd) fd = self.friendDogs[id] = makeDog(self, r.x - HD.behind * T, r.y + 0.2 * T, id);
      self.updateHuntDog(fd, { x: r.x, y: r.y }, dt, time, true);
    });
    Object.keys(this.friendDogs).forEach(function (id) { if (!seen[id]) { dropDog(self.friendDogs[id]); delete self.friendDogs[id]; } });
  };

  // One dog: where it heads (behind its person, an animal it points at, a drop it fetches) and how it looks.
  P.updateHuntDog = function (d, f, dt, time, quiet) {
    var mine = !d.owner;
    if (mine && !quiet) this.huntDogThink(d, f, dt);
    var tx = f.x, ty = f.y, speed = C.SPEED, near = 0.35 * T;
    if (d.mode === 'follow') {
      // a little behind and to the side, the way the person last walked
      var v = d.owner ? [d.lx || 0, d.ly || 0] : this.dirVec(), len = Math.hypot(v[0], v[1]) || 1;
      tx = f.x - v[0] / len * HD.behind * T + (v[1] / len) * 0.35 * T;
      ty = f.y - v[1] / len * HD.behind * T * 0.7 + 0.1 * T;
      if (d.owner) { var mx = f.x - (d.fx || f.x), my = f.y - (d.fy || f.y); if (Math.hypot(mx, my) > 2) { d.lx = mx; d.ly = my; } d.fx = f.x; d.fy = f.y; }
    } else if (d.mode === 'fetch') {
      tx = d.drop.x; ty = d.drop.y; speed = C.SPEED * 1.5; near = 0.25 * T;
    } else if (d.mode === 'carry') {
      speed = C.SPEED * 1.4; near = 0.7 * T;
    } else if (d.mode === 'point') {
      tx = d.x; ty = d.y;
    }
    var dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy);
    if (d.mode === 'follow' && dist > HD.run * T) speed = C.SPEED * 1.45;
    if (d.mode === 'follow' && dist > 12 * T) { d.x = tx; d.y = ty; dist = 0; } // (left far behind: it catches up)
    var moving = dist > near, k;
    if (moving) {
      var step = Math.min(dist, speed * dt / 1000 * Math.min(1, dist / (0.8 * T) + 0.35));
      d.x += dx / dist * step;
      d.y += dy / dist * step;
      A.face(d, dx, dy);
      d.still = 0;
      var fast = speed > C.SPEED * 1.2;
      if (d.dir === 'side') k = fast ? (Math.floor(time / 110) % 2 ? 11 : 7) : 6 + STEPS[Math.floor(time / 130) % 4];
      else k = FACING[d.dir] + STEPS[Math.floor(time / (fast ? 100 : 130)) % 4];
    } else {
      d.still += dt;
      if (d.mode === 'carry') this.huntDogDeliver(d);
      if (d.mode === 'fetch') this.huntDogPick(d);
      if (d.mode === 'point') { d.dir = 'side'; k = 6; } // standing, facing the animal
      else {
        if (Math.abs(f.x - d.x) > 20) d.flip = f.x > d.x;
        k = d.still > 900 ? 9 : FACING[d.dir]; // it sits when you stop
      }
    }
    if (k == null) k = FACING[d.dir];
    A.show(d, DOG.frame0 + k, k >= 6 && k !== 9 && d.flip);
    if (moving) d.sprite.setScale(d.scale); else A.breathe(d.sprite, d.scale, time, d.seed, k === 9);
    d.sprite.setPosition(d.x, d.y);
    d.sh.setPosition(d.x, d.y);
    F.depthTo(d.sprite, DEPTH.actor + d.y / 1e5);
    var top = d.y - DOG.height * T - 0.55 * T;
    if (d.mark) d.mark.setPosition(d.x, top + Math.sin(time / 160) * 6);
    if (d.carry) d.carry.setPosition(d.x + (d.flip ? 1 : -1) * 0.28 * T, d.y - 0.32 * T).setDepth(DEPTH.actor + d.y / 1e5 + 1e-6);
  };

  // Yours decides: bark at a charge, point at a hidden animal, fetch a drop.
  P.huntDogThink = function (d, f, dt) {
    var self = this, animals = this.wild.animals;
    // something charging you
    var charge = animals.filter(function (a) { return a.mode === 'charge' && Math.hypot(a.x - f.x, a.y - f.y) < 5 * T; })[0];
    if (charge && d.barkedAt !== charge) { d.barkedAt = charge; this.huntDogBark(d, 2); }
    if (!charge) d.barkedAt = null;
    if (d.mode === 'point') {
      d.t -= dt;
      var a = d.at;
      if (a && animals.indexOf(a) >= 0) { var ax = a.x - d.x; if (Math.abs(ax) > 10) d.flip = ax > 0; }
      if (d.t <= 0 || !a || animals.indexOf(a) < 0 || a.mode === 'flee') this.huntDogDone(d);
      return;
    }
    if (d.mode !== 'follow') return;
    // a drop a little way off
    var drop = (this.wildDrops || []).filter(function (x) {
      var g = Math.hypot(x.x - f.x, x.y - f.y) / T;
      return !x.dogSkip && Date.now() - (x.at || 0) > HD.settle && g > HD.fetch[0] && g < HD.fetch[1] && L.canAdd(self.state, x.id, 1);
    }).sort(function (p, q) { return Math.hypot(p.x - d.x, p.y - d.y) - Math.hypot(q.x - d.x, q.y - d.y); })[0];
    if (drop) { d.mode = 'fetch'; d.drop = drop; return; }
    // an animal out of sight in the grass
    d.sniffIn -= dt;
    if (d.sniffIn > 0) return;
    d.sniffIn = rand(HD.sniffEvery[0], HD.sniffEvery[1]);
    var hid = animals.filter(function (a) {
      var g = Math.hypot(a.x - f.x, a.y - f.y) / T;
      return a.hp > 0 && g > HD.sniff[0] && g < HD.sniff[1] && a.mode !== 'flee' && a.mode !== 'charge';
    }).sort(function (p, q) { return Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y); })[0];
    if (!hid) return;
    d.mode = 'point';
    d.at = hid;
    d.t = 2600;
    d.flip = hid.x > d.x;
    d.mark = this.add.container(d.x, d.y - T).setDepth(DEPTH.fx); // a speech bubble with a "!", as the farm animals ask
    d.mark.add([this.add.image(0, 0, 'items', C.ICON.bubble), this.add.image(0, -6, 'items', C.ICON.exclaim).setScale(0.62)]);
    d.mark.setScale(0.01);
    this.tweens.add({ targets: d.mark, scale: 1, duration: 220, ease: 'Back.out' });
    this.huntDogBark(d, 1); // (no words: the "!" and the bark say it, and its tour explains it)
  };
  P.huntDogBark = function (d, n) {
    for (var i = 0; i < n; i++) this.time.delayedCall(i * 260, function () { sfx('woof', true); });
    this.tweens.add({ targets: d.sprite, scaleY: d.scale * 1.08, duration: 90, yoyo: true, repeat: n - 1 });
  };
  P.huntDogDone = function (d) {
    if (d.mark) { d.mark.destroy(); d.mark = null; }
    d.mode = 'follow';
    d.at = null;
  };
  // At the drop: into your bag now (so leaving never loses it), and in its mouth until it is back with you.
  P.huntDogPick = function (d) {
    var x = d.drop, s = this.state, i = (this.wildDrops || []).indexOf(x);
    d.drop = null;
    if (i < 0) { d.mode = 'follow'; return; } // (you picked it up yourself)
    if (!L.canAdd(s, x.id, 1)) { x.dogSkip = true; d.mode = 'follow'; return; }
    this.wildDrops.splice(i, 1);
    L.addItem(s, x.id, 1);
    L.discover(s, x.id);
    x.img.destroy();
    x.sh.destroy();
    d.carry = this.add.image(d.x, d.y, 'items', L.iconOf(s, x.id)).setScale(0.7);
    d.carryId = x.id;
    d.mode = 'carry';
    this.changed();
  };
  P.huntDogDeliver = function (d) {
    var f = this.feet();
    if (d.carry) d.carry.destroy();
    d.carry = null;
    this.iconPop(f.x, f.y - 0.6 * T, L.iconOf(this.state, d.carryId));
    sfx('pick');
    d.mode = 'follow';
    d.still = 0;
  };
})(window.Farm = window.Farm || {});

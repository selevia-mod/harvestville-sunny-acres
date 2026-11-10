// Town Raid: the attackers' own animation sheets (owner's art, 10 Nov 2026: "How about the town raid attacker, lets
// generate arts for them too"; art-src/TOWN-RAID-ANIM-PROMPTS.md, tools/art/town-raid-anim-import.js). In the 'raiders'
// pack, fetched as a raid comes; until a sheet is on the phone the old look stays (the wild boar, a darkened rooster, the
// drawn flame, a spinning log or stone).
//   Giant Boar (ranim_tboar): side (facing left) / toward you / away, each: stampede run, trampling, hit, running away scared.
//   Crows (ranim_crow, the Farm Raids crow): side / toward / away, each: flying, pecking, flying off with a crop, hurt.
//   Lava Spark (ranim_tspark): floating, burning a crop, doused (shrinking to an ember), fleeing (facing left).
//   Typhoon debris (ranim_tdebris): a branch, a stone, a roof piece (each tumbling), then each one cleared.
// A hit tints it light red for a moment (owner, 10 Nov 2026, on the Farm Raids: the white flash was "too much").
(function (F) {
  'use strict';
  var C = F.Config;
  var P = F.WorldScene.prototype;
  var T = C.TILE;
  var FR = 200, HIT_TINT = 0xff9a8a;

  // which sheet a Town Raid kind uses. w0: the width of its first frame (its size); size: that width on the farm, in tiles;
  // rows: in each direction's block of 4 rows (dirs) or in the sheet (no dirs); oy: where its feet are in the frame
  C.TOWN_ANIM = {
    boar: { key: 'ranim_tboar', dirs: true, w0: 129, size: 1.9, rows: { run: 0, eat: 1, hit: 2, flee: 3 }, oy: 0.9 },
    crow: { key: 'ranim_crow', dirs: true, w0: 139, size: 1.05, rows: { run: 0, eat: 1, hit: 3, flee: 0, loot: 2 }, oy: 0.85 },
    spark: { key: 'ranim_tspark', dirs: false, w0: 104, size: 1.05, rows: { run: 0, eat: 1, hit: 2, flee: 3, out: 2 }, oy: 0.8 },
    typhoon: { key: 'ranim_tdebris', dirs: false, w0: 137, size: 1.0, debris: true, oy: 0.75 },
  };
  var ANIM = C.TOWN_ANIM, DIRROW = { side: 0, front: 4, back: 8 };
  if (F.SHEETS) Object.keys(ANIM).forEach(function (k) { F.SHEETS[ANIM[k].key] = { frameWidth: FR, frameHeight: FR }; });
  var ready = function (an) { return !!(an && F.images && F.images[an.key]); };
  var asked = {}; // (when each was last asked for: offline, again 10 s later, not every frame)
  var want = function (an) {
    if (!an || ready(an) || !F.needImage || Date.now() - (asked[an.key] || 0) < 10000) return;
    asked[an.key] = Date.now();
    F.needImage(an.key);
  };

  // its picture becomes the sheet's (when it is here)
  P.raiderAnim = function (a) {
    var an = ANIM[a.kind];
    if (!ready(an) || a.anim) return;
    F.ensureTexture(this, an.key);
    a.anim = an;
    a.sheet = null; // (the old pose leaves its frames alone: this file picks them)
    a.dk = Math.floor(Math.random() * 3); // (debris: a branch, a stone or a roof piece)
    a.img.setTexture(an.key, 0).setOrigin(0.5, an.oy).setRotation(0).clearTint().setFlipX(false);
    a.img.setScale(an.size * T / an.w0);
    a.scale = a.img.scaleX;
    a.dir = 'side';
    a.lx = a.x; a.ly = a.y; a.vx = 0; a.vy = 0;
  };

  // the raid's sheet asked for as it comes (the first raider can still come in the old look)
  var raidFrame = P.raidFrame;
  P.raidFrame = function (dt, time) {
    var r = F.Logic.raidNow && F.Logic.raidNow();
    if (r && r.kind) want(ANIM[r.kind]);
    return raidFrame.apply(this, arguments);
  };

  var addRaider = P.addRaider;
  P.addRaider = function (r) {
    var a = addRaider.apply(this, arguments);
    if (a) { want(ANIM[a.kind]); this.raiderAnim(a); if (a.anim) this.drawRaider(a, 0); }
    return a;
  };

  // each frame (after the old pose): the frame for what it is doing, the way it is going
  var drawRaider = P.drawRaider;
  P.drawRaider = function (a, time) {
    drawRaider.apply(this, arguments);
    if (!a.anim) return;
    var an = a.anim, img = a.img;
    // its speed, from how far it moved (smoothed: a waypoint turn doesn't flick it round)
    var dx = a.x - a.lx, dy = a.y - a.ly;
    a.lx = a.x; a.ly = a.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.01) { a.vx = a.vx * 0.6 + dx * 0.4; a.vy = a.vy * 0.6 + dy * 0.4; }
    var ax = Math.abs(a.vx), ay = Math.abs(a.vy);
    if (ax > ay * 1.2) a.dir = 'side'; else if (ay > ax * 1.2) a.dir = a.vy > 0 ? 'front' : 'back';
    if (ax > 0.05) a.flip = a.vx > 0; // (drawn facing left)
    var tick = function (ms) { return Math.floor(time / ms + a.t) % 4; }, frame, flip = false;
    if (an.debris) {
      if (a.out) frame = 12 + a.dk; // cleared: broken, where it was hit
      else if (a.mode === 'eat') frame = a.dk * 4; // (lying on the crop)
      else frame = a.dk * 4 + tick(110); // tumbling through the air
      img.setRotation(0);
    } else {
      var rows = an.rows, row, col;
      if (a.out && rows.out != null) { row = rows.out; col = Math.min(3, Math.floor((1 - Math.max(0, a.fade)) * 4.5)); } // (doused: shrinking to an ember)
      else if (a.hitT > 0) { row = rows.hit; col = 0; }
      else if (a.mode === 'eat') { row = rows.eat; col = tick(150); }
      else if (a.mode === 'flee') { row = a.stole && rows.loot != null ? rows.loot : rows.flee; col = tick(90); }
      else { row = rows.run; col = tick(an.dirs ? 110 : 130); }
      var dir = an.dirs ? a.dir : 'side';
      frame = (an.dirs ? DIRROW[dir] : 0) + row * 4 + col;
      // sideways it faces where it goes; a spark only turns for its run away (its other rows look straight at you)
      flip = an.dirs ? dir === 'side' && a.flip : row === rows.flee && a.flip;
    }
    img.setFrame(frame).setFlipX(flip).setScale(a.scale);
  };

  // a crop eaten: it runs off with it (the crow's loot row); a hit: the red tint and its hurt frame
  var update = P.updateRaider;
  P.updateRaider = function (a, dt, time, r) {
    var was = a.mode;
    var out = update.apply(this, arguments);
    if (was === 'eat' && a.mode === 'flee' && !a.out) a.stole = true;
    return out;
  };
  var struck = P.raiderStruck;
  P.raiderStruck = function (a) {
    var was = a && a.mode;
    struck.apply(this, arguments);
    if (!a || !a.anim || !a.img.active) return;
    a.img.setTint(HIT_TINT); // (the old white flash is replaced; it clears as before, 90 ms on)
    var img = a.img;
    this.time.delayedCall(120, function () { if (img.active) img.clearTint(); });
    if (was !== 'flee' && a.mode === 'flee') {
      a.out = true;
      // a spark goes out and debris breaks where they are; a boar or a crow runs off
      if (a.anim.debris || a.anim.rows.out != null) { a.tx = a.x; a.ty = a.y; }
    }
  };
})(window.Farm = window.Farm || {});

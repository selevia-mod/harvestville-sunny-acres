// Friends see each other work (owner, 3 Nov 2026: "users are walking or smashing the rock but I can't see how they doing
// that. It looks like lagging then suddenly the rock gone"; "we need to polish how users can see what the other player is
// doing"). Each tool swing is told to the others on the same map (and mine floor), and their farmer swings it on your
// screen (18-polish.js remoteUse). A rock they break pops when their hammer lands (19r-follow.js remoteRock); a friend's
// bow shot is drawn in 19w-bow.js remoteShot. Fishing: their bobber in the water, the bite, and the fish they land.
(function (F) {
  'use strict';
  var C = F.Config;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var EVERY = 180; // ms: the quickest swings are told (a held, charged swing is one message)
  var FISH_MAX = 60000; // a friend's bobber that never hears the end (they left, the line dropped) goes after this
  var DIRS = { down: 1, up: 1, left: 1, right: 1 };
  var sent = 0;

  var floorOf = function (w) { return w.mapKey === 'mine' ? F.session.mineFloor : 0; };
  var near = function (w) {
    var fl = floorOf(w);
    for (var k in O.others) if (O.others[k].map === w.mapKey && (O.others[k].fl || 0) === fl) return true;
    return false;
  };
  var tell = function (w, event, payload) {
    if (O.on && O.chan && !w.busy && near(w)) O.send(event, Object.assign({ map: w.mapKey, fl: floorOf(w) }, payload));
  };

  var animateUse = P.animateUse;
  P.animateUse = function (frame, kind) {
    animateUse.call(this, frame, kind);
    var now = Date.now();
    if (now - sent < EVERY) return;
    sent = now;
    tell(this, 'use', { f: frame, k: kind === 'pour' ? 'pour' : 'swing', d: this.dir });
  };

  // ---------- fishing ----------
  var startFishing = P.startFishing;
  P.startFishing = function (t) {
    startFishing.call(this, t);
    if (this.fishing && this.fishing.bob) tell(this, 'fish', { k: 'cast', x: Math.round(this.fishing.bob.x), y: Math.round(this.fishing.bob.y) });
  };
  var updateFishing = P.updateFishing;
  P.updateFishing = function (time) {
    var before = this.fishing && this.fishing.state;
    updateFishing.call(this, time);
    if (before === 'wait' && this.fishing && this.fishing.state === 'bite') tell(this, 'fish', { k: 'bite' });
  };
  var endFishing = P.endFishing;
  P.endFishing = function () {
    var had = !!this.fishing;
    endFishing.call(this);
    if (had && !this.fishLanding) tell(this, 'fish', { k: 'end' });
  };
  // A fish landed: told with its picture, so it jumps out of their water.
  var startFishGame = U.startFishGame;
  U.startFishGame = function (fishId, done) {
    return startFishGame.call(this, fishId, function (ok) {
      var w = F.world;
      if (w) w.fishLanding = true;
      try { done(ok); } finally { if (w) w.fishLanding = false; }
      if (w) tell(w, 'fish', { k: 'end', ok: ok ? 1 : 0, i: ok && C.ITEMS[fishId] ? C.ITEMS[fishId].icon : -1 });
    });
  };

  // What a friend got, floating up where they got it (owner, 3 Nov 2026): ore from a rock, a crop they picked, a fish.
  P.floatIcon = function (x, y, frame) {
    var img = this.add.image(x, y, 'items', frame).setScale(0.45).setDepth(DEPTH.Above);
    this.tweens.add({ targets: img, y: y - 1.3 * T, scale: 0.6, duration: 420, ease: 'Quad.out' });
    this.tweens.add({ targets: img, alpha: 0, delay: 750, duration: 300, onComplete: function () { img.destroy(); } });
  };

  P.remoteFishEnd = function (r, icon) {
    var f = r.fish;
    if (!f) return;
    r.fish = null;
    this.tweens.killTweensOf(f.bob);
    if (f.mark) { this.tweens.killTweensOf(f.mark); f.mark.destroy(); }
    if (f.timer) f.timer.remove();
    var x = f.bob.x, y = f.bob.y;
    f.bob.destroy();
    if (!(icon >= 0)) return;
    if (this.puff) this.puff({ x: Math.floor(x / T), y: Math.floor(y / T) }, 0xbfe6f0, 2);
    var fish = this.add.image(x, y, 'items', icon).setScale(0.6).setDepth(DEPTH.Above);
    this.tweens.add({ targets: fish, y: y - 1.6 * T, scale: 0.9, angle: { from: -25, to: 15 }, duration: 380, ease: 'Quad.out' });
    this.tweens.add({ targets: fish, alpha: 0, delay: 900, duration: 300, onComplete: function () { fish.destroy(); } });
  };
  P.remoteFish = function (r, p) {
    var self = this;
    if (p.k === 'cast') {
      var x = Number(p.x), y = Number(p.y);
      if (!isFinite(x) || !isFinite(y) || Math.hypot(x - r.x, y - r.y) > 6 * T) return; // (their line is only so long)
      this.remoteFishEnd(r, -1);
      var bob = this.add.image(x, y, 'items', C.ICON.bobber).setDepth(DEPTH.fx);
      this.tweens.add({ targets: bob, y: y + 16, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      r.fish = { bob: bob, mark: null, timer: this.time.delayedCall(FISH_MAX, function () { self.remoteFishEnd(r, -1); }) };
    } else if (p.k === 'bite' && r.fish && !r.fish.mark) {
      var f = r.fish;
      f.mark = this.add.image(r.x, r.y - 2.4 * T, 'items', C.ICON.exclaim).setScale(1.3).setDepth(DEPTH.Above + 1);
      this.tweens.killTweensOf(f.bob);
      this.tweens.add({ targets: f.bob, y: f.bob.y + 40, duration: 90, yoyo: true, repeat: 4 });
      this.remoteSound(r, 'bite');
    } else if (p.k === 'end') {
      var icon = Math.floor(Number(p.i));
      var got = p.ok && icon >= 0 && icon < C.ICON_ORDER.length;
      this.remoteFishEnd(r, got ? icon : -1);
      if (got) this.remoteSound(r, 'catch');
    }
  };

  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event !== 'use' && event !== 'fish') return onMessage.call(O, event, payload);
    var p = payload && typeof payload === 'object' ? payload : {}, w = F.world;
    var r = w && w.remotes && typeof p.id === 'string' ? w.remotes[p.id] : null;
    if (!r || !w.sys || !w.sys.isActive() || w.busy || p.map !== w.mapKey || (Number(p.fl) || 0) !== floorOf(w)) return;
    if (event === 'fish') return w.remoteFish(r, p);
    var frame = Math.floor(Number(p.f));
    if (!(frame >= 0 && frame < C.ICON_ORDER.length) || !DIRS[p.d]) return;
    w.remoteUse(r, p.d, frame, p.k === 'pour' ? 'pour' : 'swing');
  };
})(window.Farm = window.Farm || {});

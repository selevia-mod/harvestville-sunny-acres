// The bow you hold, on your back (owner, 8 Nov 2026: "bow must be seen while equipped, it was a good show off to their
// friends or other users. Specially if they have a good bow"). While the Bow is the thing in your hands, its own picture
// (Bow, Copper, Silver, Gold, Magma or Haliya's Moon Bow) hangs across your back as you walk and stand, and everyone sees
// it on you: your friends on a farm or in town (your presence: bw), and anyone in a hunting place or on a cave floor (the
// game server: your hi, then 'lk' when you take it up or put it away). The Moon Bow glows softly with moonlight. When
// you shoot, it is in your hands as before (19w-bow.js); on a horse it is not drawn.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;

  var SCALE = 1.9; // the 128 px icon on a 256 x 384 farmer: big enough to read at a glance
  // Where it hangs, from the farmer's middle (the picture's centre), by the way they face: across the back, the top end
  // over a shoulder. Facing you or to a side it is behind them; facing away it is on their back, in front.
  var AT = {
    down: { x: 46, y: -36, rot: -0.2, behind: true },
    up: { x: 0, y: -14, rot: 0, behind: false },
    left: { x: 50, y: -30, rot: 0.3, behind: true },
    right: { x: -50, y: -30, rot: -0.3, behind: true, flip: true },
  };
  // which way a farmer faces, from their frame (rows of 3: facing you, away, to the side; a flipped side is right)
  var facing = function (spr) {
    var f = Number(spr.frame && spr.frame.name) || 0, row = Math.floor(f / 3) % 3;
    return row === 0 ? 'down' : row === 1 ? 'up' : spr.flipX ? 'right' : 'left';
  };

  // The bow in your hands now: its level + 1, or 0 (sent to the others: 19h-online.js O.myState, 19zzzzzzzzz-gameserver.js).
  O.heldBow = function () {
    var s = F.session && F.session.state, h = s && L.held && L.held(s);
    return h && h.id === 'bow' && L.hasBow(s) ? L.bowLevel(s) + 1 : 0;
  };

  // One farmer's bow: made, moved, shown or hidden (bw: level + 1, 0 = none). Returns the bow image (or null).
  var hang = function (w, holder, spr, bw, alpha) {
    var on = bw > 0 && spr && spr.active && spr.visible && alpha > 0.01;
    if (!on) {
      if (holder.slung) holder.slung.setVisible(false);
      if (holder.slungGlow) holder.slungGlow.setVisible(false);
      return null;
    }
    var level = bw - 1, frame = L.bowIcon ? L.bowIcon(level) : C.ICON.bow;
    if (!holder.slung || !holder.slung.active || holder.slungFrame !== frame) {
      if (holder.slung) holder.slung.destroy();
      F.ensureTexture(w, 'items');
      holder.slung = w.add.image(0, 0, 'items', frame).setScale(SCALE);
      holder.slungFrame = frame;
    }
    var moon = !!(L.moonShot && L.moonShot(level));
    if (moon && (!holder.slungGlow || !holder.slungGlow.active)) {
      holder.slungGlow = w.add.circle(0, 0, 0.62 * C.TILE, C.MOON_BOW.shine, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    }
    var at = AT[facing(spr)], x = spr.x + at.x, y = spr.y + at.y;
    holder.slung.setPosition(x, y).setRotation(at.rot).setFlipX(!!at.flip).setAlpha(alpha).setVisible(true)
      .setDepth(spr.depth + (at.behind ? -0.0004 : 0.0004));
    if (holder.slungGlow) {
      holder.slungGlow.setVisible(moon);
      if (moon) holder.slungGlow.setPosition(x, y).setDepth(holder.slung.depth - 0.0001).setAlpha(alpha * (0.22 + 0.1 * Math.sin(w.time.now / 400)));
    }
    return holder.slung;
  };

  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (!this.player || !this.sys || !this.sys.isActive()) return;
    // yours
    var bw = O.heldBow(), mine = this.slungMine = this.slungMine || {};
    hang(this, mine, this.player, this.shot || F.session.riding || this.sleeping ? 0 : bw, this.player.alpha);
    // tell the others when it changes (at most twice a second)
    if (bw !== this.slungSent && time - (this.slungAt || 0) > 500) {
      this.slungSent = bw;
      this.slungAt = time;
      if (O.on && O.chan && O.retrack) O.retrack();
      if (O.gsLook) O.gsLook();
    }
    // theirs
    var self = this, keep = {};
    Object.keys(this.remotes || {}).forEach(function (id) {
      var r = self.remotes[id], p = O.who ? O.who(id) : O.others && O.others[id];
      keep[id] = 1;
      hang(self, r, r.spr, r.shot || r.horse || !p ? 0 : p.bw || 0, r.spr ? r.spr.alpha : 0);
    });
    // those who left: their bow goes with them
    var held = this.slungHeld = this.slungHeld || {};
    Object.keys(held).forEach(function (id) {
      if (keep[id] && self.remotes[id] === held[id]) return;
      var r = held[id];
      if (r.slung) r.slung.destroy();
      if (r.slungGlow) r.slungGlow.destroy();
      r.slung = r.slungGlow = null;
      delete held[id];
    });
    Object.keys(keep).forEach(function (id) { held[id] = self.remotes[id]; });
  };
})(window.Farm = window.Farm || {});

// Sleeping in your bed (owner, 29 Oct 2026): tap the bed and choose Sleep. The farmer tucks in (sleepbed_* pictures
// of each bed with you in it; sleeper_* head and hands on a bed without one yet), the room dims and Zzz float up.
// While you sleep, energy comes back every C.SLEEP_EVERY minutes instead of every C.ENERGY_EVERY (L.regen reads
// s.asleep). Wake up with the button, the joystick or the action button; a full bar wakes you by itself. s.asleep is
// never saved: closing the game wakes you.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var H = C.HOME;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  // The bed nearest the farmer (the one you tapped), or null.
  P.sleepBed = function () {
    var s = this.state, f = this.feet(), best = null, bd = 1e9;
    (s.home && s.home.items || []).forEach(function (it) {
      var type = H.types[it.t];
      if (!type || type.use !== 'sleep') return;
      var dx = (it.x + type.w / 2) * T - f.x, dy = (it.y + type.h / 2) * T - f.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = it; }
    });
    return best;
  };

  var askSleep = P.askSleep;
  P.askSleep = function () {
    if (this.sleeping) return this.wakeUp();
    if (F.session.visit || this.mapKey !== 'house' || !this.sleepBed()) return askSleep.call(this); // (their bed: just a look)
    var self = this, s = this.state, w = L.weather(s, s.day + 1);
    F.ui.dialog('YOUR BED\nA new day starts at midnight, while you play or not. Take a nap? While you sleep, your energy comes back ' +
      'twice as fast: 1 point every ' + C.SLEEP_EVERY + ' minute instead of every ' + C.ENERGY_EVERY + '.\n\nTomorrow: ' + C.WEATHER[w].name + '.',
    [{ label: 'Not now', color: 0xa08a68 }, { label: 'Sleep', cb: function () { self.fallAsleep(); } }]);
  };

  P.fallAsleep = function () {
    var s = this.state, it = this.sleepBed();
    if (this.sleeping || !it || this.busy) return;
    var type = H.types[it.t], who = s.look === 'girl' ? 'girl' : 'boy';
    L.regen(s); // the points earned at the waking rate, before the faster one starts
    s.asleep = true;
    // tucked in: on a single bed in the middle, on a double bed on one side (the other pillow is for your spouse)
    var cx = (it.x + type.w / 2) * T, img;
    if (type.w >= 3) cx = (it.x + (it.f ? type.w - 1.17 : 1.17)) * T; // the double bed's art is 2 tiles wide in its 3: its left pillow
    // the owner's pictures of the whole bed with you in it, one per style (classic 29 Oct, the others 30 Oct), laid
    // exactly over the bed: props/sleepbed[2]_<who> for Classic, props/sleepbed[2]_v<style>_<who> for the others
    var base = { bed: 'props/sleepbed_', double_bed: 'props/sleepbed2_' }[type.key];
    var whole = base && base + (it.v ? 'v' + it.v + '_' : '') + who;
    if (whole && F.images[whole]) {
      img = this.add.image(it.x * T, (it.y + type.h) * T, F.ensureTexture(this, whole)).setOrigin(0, 1)
        .setDisplaySize(type.w * T, type.h * T).setFlipX(!!it.f);
    } else { // a style without its picture yet: your head and hands on that bed's own pillow and quilt (owner's art, 29 Oct)
      img = this.add.image(cx, it.y * T + (type.w >= 3 ? 0.31 : 0.24) * T, F.ensureTexture(this, 'props/sleeper_' + who)).setOrigin(0.5, 0);
      img.setScale((0.6 * T) / 437); // the size of the classic bed's sleeper; one scale for both (437 = the boy's width)
    }
    img.setDepth(DEPTH.actor + (it.y + type.h) * T / 1e5 + 1e-6);
    this.sleeping = { img: img, zzz: [], head: { x: cx + 0.28 * T, y: it.y * T + 0.3 * T }, at: 0 };
    this.player.setVisible(false);
    if (this.shadow) this.shadow.setVisible(false);
    if (this.player.body) this.player.body.setVelocity(0, 0);
    this.tweens.add({ targets: img, alpha: { from: 0, to: 1 }, duration: 350 });
    sfx('swoosh');
    F.bus.emit('hud');
    if (F.ui && F.ui.showSleep) F.ui.showSleep(true);
  };

  P.wakeUp = function (why) {
    var z = this.sleeping, s = this.state;
    if (!z) return;
    L.regen(s); // the points earned asleep
    s.asleep = false;
    this.sleeping = null;
    z.img.destroy();
    z.zzz.forEach(function (t) { t.destroy(); });
    this.player.setVisible(true);
    if (this.shadow) this.shadow.setVisible(true);
    this.dir = 'down';
    this.idle();
    F.bus.emit('hud');
    if (F.ui && F.ui.showSleep) F.ui.showSleep(false);
    if (why === 'full' && F.ui) F.ui.toast('You woke up full of energy!', 2600, 0x2f5a22);
  };

  // Zzz floating up from the pillow while you sleep.
  P.updateSleep = function (dt) {
    var z = this.sleeping, self = this;
    if (!z) return;
    var s = this.state;
    if (s.energy >= L.maxEnergy(s)) return this.wakeUp('full');
    var k = this.keys, moved = Math.abs(F.input.jx) + Math.abs(F.input.jy) > 0.5 ||
      (k && (k.LEFT.isDown || k.RIGHT.isDown || k.UP.isDown || k.DOWN.isDown || k.W.isDown || k.A.isDown || k.S.isDown || k.D.isDown));
    if (moved) return this.wakeUp();
    if (this.player.body) this.player.body.setVelocity(0, 0);
    z.at -= dt;
    if (z.at > 0) return;
    z.at = 900;
    var n = z.zzz.length % 3, t = this.add.text(z.head.x + n * 0.06 * T, z.head.y, 'z', {
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif', fontSize: Math.round(T * (0.42 + n * 0.12)) + 'px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#3d2614', strokeThickness: Math.round(T * 0.06),
    }).setOrigin(0.5, 1).setDepth(DEPTH.fx + 2);
    z.zzz.push(t);
    this.tweens.add({
      targets: t, x: t.x + 0.4 * T, y: t.y - 0.9 * T, alpha: { from: 1, to: 0 }, angle: -12, duration: 2400, ease: 'Sine.out',
      onComplete: function () { var i = z.zzz.indexOf(t); if (i >= 0) z.zzz.splice(i, 1); t.destroy(); },
    });
    if (z.zzz.length > 6) { var old = z.zzz.shift(); self.tweens.killTweensOf(old); old.destroy(); }
  };

  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (this.sleeping) this.updateSleep(Math.min(delta, 100));
  };

  // A new day (or a trip) restarts the scene: still asleep in the house, you stay tucked in; anywhere else you wake.
  var create = P.create;
  P.create = function () {
    this.sleeping = null;
    create.call(this);
    var s = F.session.state;
    if (s.asleep) {
      if (this.mapKey === 'house' && !F.session.visit && this.sleepBed()) { s.asleep = false; this.fallAsleep(); } else { L.regen(s); s.asleep = false; }
    }
  };

  // While you sleep the room goes dark like a night (the lamps still glow), and a Wake up button sits over the hotbar.
  var darkness = U.darkness;
  U.darkness = function () {
    var d = darkness.call(this);
    return F.world && F.world.sleeping ? Math.max(d, 0.42) : d;
  };
  U.showSleep = function (on) {
    if (this.sleepBar) { this.sleepBar.destroy(); this.sleepBar = null; }
    if (!on) return;
    var c = this.sleepBar = this.add.container(0, 0).setDepth(40);
    this.button(c, C.WIDTH / 2, C.HEIGHT - 150, 132, 38, 'Wake up', function () { if (F.world) F.world.wakeUp(); }, 0x4a90c9);
    c.add(this.txt(C.WIDTH / 2, C.HEIGHT - 196, 'Sleeping... +1 energy every minute', 12, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5, 0.5));
  };
})(window.Farm = window.Farm || {});

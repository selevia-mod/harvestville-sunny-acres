// The horse (ride it, ship from the saddlebag), the cat, the mailbox, mine treasure chests, and the music box
// and aquarium in the farmhouse. Mixed into WorldScene.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var RIDE_MAPS = { farm: true, town: true };
  var CHEST_TILE = [9, 3];

  var M = {};

  // the boy or the girl was just picked: swap the farmer's picture
  M.applyLook = function () {
    var key = F.playerKey(this);
    this.player.setTexture(key, 0);
    this.idle();
    if (this.rider) this.rider.setTexture(key, 6);
  };

  M.setupExtras = function () {
    var s = this.state, self = this;
    this.horse = null;
    this.cat = null;
    this.mailFlag = null;
    this.chest = null;
    if (!RIDE_MAPS[this.mapKey]) F.session.riding = false;
    // the horse: at the stable, where you left it today, or under you
    if (s.horse && RIDE_MAPS[this.mapKey]) {
      var at = F.session.riding ? this.feet() : F.session.horseAt && F.session.horseAt.map === this.mapKey ? F.session.horseAt
        : this.mapKey === 'farm' ? this.points.horse : null;
      if (at) {
        this.horse = { x: at.x, y: at.y, sprite: this.add.image(at.x, at.y, 'animals', C.HORSE.frame0 + 2).setOrigin(0.5, 300 / 320).setScale(1.4) };
        this.rider = this.add.image(0, 0, F.playerKey(this), 6).setVisible(false);
      }
    }
    // the cat lives in the farmhouse
    var catArea = this.zones.catarea && this.zones.catarea[0];
    if (s.cat && catArea) {
      this.cat = new F.Dog(this, { x0: catArea.px, y0: catArea.py, x1: catArea.px + catArea.pw, y1: catArea.py + catArea.ph }, C.CAT, 0.75);
    }
    // a letter bobs over the mailbox while there is mail
    var box = this.objects.filter(function (o) { return o.type === 'mail'; })[0];
    if (box) {
      this.mailFlag = this.add.image((box.x0 + 0.5) * T, (box.y0 - 1.2) * T, 'items', C.ICON.letter).setScale(1.1).setDepth(DEPTH.Above + 1);
      this.tweens.add({ targets: this.mailFlag, y: '-=40', duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    // a treasure chest every few floors of the mine
    if (this.mapKey === 'mine' && L.hasChest(F.session.mineFloor)) {
      var cx = CHEST_TILE[0], cy = CHEST_TILE[1];
      F.ensureTexture(this, 'props/chest');
      this.chest = this.add.image(cx * T, (cy + 1) * T, 'props/chest').setOrigin(0, 1).setDisplaySize(T, T).setDepth(DEPTH.actor + (cy + 1) * T / 1e5);
      if (L.chestOpened(s, F.session.mineFloor)) this.chest.setAlpha(0.45);
      this.objects.push({ type: 'chest', name: 'chest', x0: cx, y0: cy, x1: cx, y1: cy, props: {} });
      this.blocked[this.idx(cx, cy)] = true;
      var zone = this.add.zone((cx + 0.5) * T, (cy + 0.5) * T, T - 30, T - 30);
      this.physics.add.existing(zone, true);
      this.solids.add(zone);
      if (this.layers.Walls.getTileAt(cx, cy)) this.layers.Walls.removeTileAt(cx, cy); // never under a rock
      void self;
    }
  };

  M.updateExtras = function (dt, time) {
    var s = this.state;
    if (this.mailFlag) this.mailFlag.setVisible(s.mail.length > 0);
    if (this.cat) this.cat.update(dt, time, s.time);
    var h = this.horse;
    if (!h) return;
    if (F.session.riding) {
      var f = this.feet(), flip = !!this.rideFlip;
      h.x = f.x;
      h.y = f.y + 20;
      this.player.setVisible(false);
      F.depthTo(this.rider.setVisible(true).setFrame(6).setFlipX(flip).setPosition(f.x + (flip ? -30 : 30), f.y - 350), DEPTH.actor + f.y / 1e5 + 0.0002);
      h.sprite.setFrame(C.HORSE.frame0 + (this.moving ? Math.floor(time / 140) % 2 : 2)).setFlipX(flip);
      this.shadow.setScale(1.6, 1.3);
    } else {
      this.player.setVisible(true);
      this.rider.setVisible(false);
      this.shadow.setScale(1);
      h.sprite.setFrame(C.HORSE.frame0 + (Math.floor(time / 2600) % 3 === 0 ? 3 : 2));
    }
    F.depthTo(h.sprite.setPosition(h.x, h.y), DEPTH.actor + h.y / 1e5);
  };

  // Indoors and down the mine, the horse waits outside.
  M.beforeTravel = function (to) {
    if (F.session.riding && !RIDE_MAPS[to]) this.dismount();
  };

  M.dismount = function () {
    var f = this.feet();
    F.session.riding = false;
    F.session.horseAt = { map: this.mapKey, x: f.x, y: f.y + 20 };
    if (this.horse) {
      this.horse.x = f.x;
      this.horse.y = f.y + 20;
    }
    this.player.setVisible(true);
    if (this.rider) this.rider.setVisible(false);
    this.shadow.setScale(1);
    this.idle();
  };

  M.mount = function () {
    var h = this.horse;
    this.setFeet(h.x, h.y - 20);
    F.session.riding = true;
    F.session.horseAt = null;
    this.rideFlip = false;
    sfx('neigh');
    if (L.petHorse(this.state) === 'ok') {
      F.ui.toast(this.state.horse.name + ' nuzzles you. Off you go!');
      this.changed();
    }
  };

  // Pets near the spot in front of the farmer: the horse (to ride) and the cat.
  M.petAction = function (pt) {
    var self = this, s = this.state;
    if (this.horse && !F.session.riding && Math.hypot(this.horse.x - pt.x, this.horse.y - T * 0.5 - pt.y) < C.HORSE.reach * T) {
      return { label: 'Ride', icon: C.ICON.horse, run: function () { self.mount(); } };
    }
    if (this.cat && this.cat.near(pt.x, pt.y)) {
      if (!s.cat.pet) return { label: 'Pet', icon: C.ICON.cat, run: function () { self.petCat(); } };
      return { label: s.cat.name, icon: C.ICON.cat, run: function () {
        var h = Math.floor(s.cat.love / 20);
        F.ui.toast(s.cat.name + '  ' + (h ? new Array(h + 1).join('♥') : 'no hearts yet') + '\nPurrs happily. Pet her every day.');
      } };
    }
    return null;
  };

  M.petCat = function () {
    L.petCat(this.state);
    this.cat.happy();
    sfx('meow');
    this.floatTextAt(this.cat.x, this.cat.y - T, this.state.cat.name + ' purrs!');
    this.changed();
  };

  // On horseback: no tools, but the saddlebag reaches the market stall from anywhere.
  M.rideAction = function (held, def) {
    var self = this;
    if (def && def.sell) return { label: 'Sell', icon: C.ICON.crate, run: function () { F.ui.openStand('shelves'); } };
    return { label: 'Get off', icon: C.ICON.horse, run: function () { self.dismount(); } };
  };

  M.extraObjectAction = function (o) {
    var self = this, s = this.state;
    switch (o.type) {
      case 'mail':
        if (s.mail.length) return { label: 'Read', icon: C.ICON.letter, run: function () { self.readMail(); } };
        return { label: 'Mailbox', icon: C.ICON.letter, run: function () { F.ui.toast('No new letters.'); } };
      case 'chest':
        if (L.chestOpened(s, F.session.mineFloor)) return { label: 'Empty', icon: C.ICON.chest, disabled: true, why: 'You already opened this chest.' };
        return { label: 'Open', icon: C.ICON.chest, run: function () { self.openChest(); } };
      case 'musicbox': return { label: 'Play', icon: C.ICON.music_box, run: function () { self.playMusicBox(); } };
      case 'aquarium': return { label: 'Look', icon: C.ICON.aquarium, run: function () { self.lookAquarium(); } };
    }
    return null;
  };

  M.readMail = function () {
    var self = this, r = L.readMail(this.state);
    if (r.error === 'full') return F.ui.toast('Your bag is full. Make room for the gift first.');
    if (r.error) return;
    sfx('letter');
    var g = r.letter.gift, gift = '';
    if (g) gift = '\n\n(You got ' + (g[0] === 'gold' ? g[1] + 'G' : g[1] + ' ' + (g[0] === 'lumber' ? 'Lumber' : g[0] === 'stone' ? 'Stone' : C.ITEMS[g[0]].name)) + '.)';
    F.ui.dialog('LETTER FROM ' + C.VILLAGERS[r.letter.from].name.toUpperCase() + '\n' + r.letter.text + gift, [{ label: this.state.mail.length ? 'Next letter' : 'OK', cb: function () { if (self.state.mail.length) self.readMail(); } }]);
    this.changed();
    this.save();
  };

  M.openChest = function () {
    var s = this.state, r = L.openChest(s, F.session.mineFloor);
    if (r.error === 'full') return F.ui.toast('Your bag is full!');
    if (r.error) return;
    sfx('found');
    this.chest.setAlpha(0.45);
    var self = this;
    r.items.forEach(function (it, i) { self.time.delayedCall(i * 150, function () { self.flyItem(self.chest.x + T / 2, self.chest.y - T / 2, C.ICON[it[0]]); }); });
    F.ui.dialog('TREASURE!\nYou found ' + r.gold + 'G and ' + r.items.map(function (it) { return it[1] + ' ' + C.ITEMS[it[0]].name; }).join(' and ') + '.');
    this.changed();
    this.save();
  };

  M.playMusicBox = function () {
    var gain = L.playMusicBox(this.state);
    sfx('musicbox');
    F.ui.toast(gain > 0 ? 'A sweet little tune. You feel refreshed. +' + gain + ' energy' : gain < 0 ? 'A sweet little tune.' : 'A sweet little tune. (It lifts your spirits once a day.)');
    this.changed();
  };

  M.lookAquarium = function () {
    var s = this.state, fish = ['fish_s', 'fish_m', 'fish_l', 'fish_k'].filter(function (id) { return L.discovered(s, id); });
    F.ui.dialog('AQUARIUM\n' + (fish.length ? 'Swimming here: ' + fish.map(function (id) { return C.ITEMS[id].name; }).join(', ') + '.' : 'Empty for now. Catch some fish and they will show up here!') +
      '\nFish caught so far: ' + s.stats.fish + '.');
  };

  Object.assign(F.WorldScene.prototype, M);
})(window.Farm = window.Farm || {});

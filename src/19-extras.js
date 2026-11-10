// The horse (ride it, ship from the saddlebag), the cat, the mailbox, mine treasure chests, and the music box
// and aquarium in the farmhouse. Mixed into WorldScene.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var RIDE_MAPS = { farm: true, town: true, park: true }; // (park: Central Park rides like town, owner 6 Nov 2026)
  var CHEST_TILE = [9, 3];
  // The horse in its riding saddle (owner's art, 10 Nov 2026: the rider stood on the horse; art-src/battle2/horse_ride.png,
  // tools/art/animals3q-import.js battle2): frames as an animal's (0-2 toward you, 3-5 away, 6-8 sideways, 9 standing, 10
  // standing sideways, 11 a step). Ridden, the horse and its farmer are ONE picture drawn together (owner: a farmer cut
  // or stacked on the horse looked "so ugly"): assets/ride_<outfit>_<boy|girl> (art-src/riding, RIDING-ON-HORSE-PROMPTS.md),
  // the same frames; an outfit without its own rides in the farm clothes (ride_default_<boy|girl>) until it has one.
  if (F.SHEETS) { F.SHEETS.horse_ride = F.SHEETS.animals; F.SHEETS.horse_rideshade = F.SHEETS.animalshade; }
  var RIDE = { px: 174, ridden: 177 }; // (the horse's width sideways, in its picture: alone, and with its farmer)
  var GALLOP = 105; // ms a stride while riding

  var M = {};

  // the boy or the girl was just picked: swap the farmer's picture
  M.applyLook = function () {
    var key = F.playerKey(this);
    if (!this.player || !this.player.scene) return;
    this.player.setTexture(key, 0);
    this.idle();
    if (this.rider && this.rider.scene) this.rider.setTexture(key, 6);
  };

  M.setupExtras = function () {
    var s = this.state, self = this;
    // (players, 10 Nov 2026: "can't get inside your houses", a black screen: the farmer on the horse was the last map's,
    // already gone, and dressing it in your look stopped the house being built. Each map makes its own, or none.)
    this.horse = null;
    this.rider = null;
    this.cat = null;
    this.mailFlag = null;
    this.chest = null;
    if (!this.horseMapOk(this.mapKey)) F.session.riding = false;
    // the horse: at the stable, where you left it today, or under you
    if (s.horse) {
      var at = this.horseSpot();
      if (at) {
        this.horse = { x: at.x, y: at.y, sprite: F.Anim.image(this, at.x, at.y, C.HORSE), sh: F.Anim.shadow(this, at.x, at.y, C.HORSE) };
        this.rider = this.add.image(0, 0, F.playerKey(this), 6).setVisible(false);
        if (F.images.horse_ride && F.images.horse_rideshade) {
          var hs = C.HORSE.w * T / RIDE.px;
          this.horse.ride = true;
          this.horse.sprite.setTexture(F.ensureTexture(this, 'horse_ride'), 10).setScale(hs);
          this.horse.sh.setTexture(F.ensureTexture(this, 'horse_rideshade'), 10).setScale(hs);
        }
      }
    }
    // the cat lives in the farmhouse
    var catArea = this.zones.catarea && this.zones.catarea[0];
    if (s.cat && catArea) {
      this.cat = new F.Dog(this, { x0: catArea.px, y0: catArea.py, x1: catArea.px + catArea.pw, y1: catArea.py + catArea.ph }, C.CAT);
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
      // it goes the way you go: the farmer's back on the way up; the way down, its head and mane are in front of you
      var f = this.feet(), flip = !!this.rideFlip, A = F.Anim, side = this.dir === 'left' || this.dir === 'right', d = side ? 'side' : this.dir;
      var k = !this.moving ? A.FACING[d] : side ? (Math.floor(time / 130) % 2 ? 11 : 7) : A.FACING[d] + A.STEPS[Math.floor(time / 120) % 4];
      h.x = f.x;
      h.y = f.y + 20;
      this.player.setVisible(false);
      if (h.ride) {
        this.rideSeat(h, d, side, flip, time);
        this.shadow.setVisible(false);
        // (owner, 10 Nov 2026: riding "looks like flying": a gallop's bounce each stride, the shadow staying on the
        // ground, and a kick of dust from the hooves as they land)
        var stride = this.moving ? Math.floor(time / GALLOP) : -1, bob = this.moving ? Math.abs(Math.sin(time / GALLOP * Math.PI)) * 0.06 * T : 0;
        if (stride >= 0 && stride !== h.stride && stride % 2 === 0 && this.bits && this.bits.dust) this.bits.dust.explode(1, h.x + (side ? (flip ? -1 : 1) * 0.45 * T : 0), h.y);
        h.stride = stride;
        h.sh.setPosition(h.x, h.y).setScale(h.sprite.scaleX * (1 - bob / (2 * T)), h.sprite.scaleY);
        F.depthTo(h.sprite.setPosition(h.x, h.y - bob), DEPTH.actor + h.y / 1e5);
        return;
      }
      this.rider.setVisible(true).setFrame(side ? 6 : d === 'up' ? 3 : 0).setFlipX(side && flip).setPosition(f.x + (side ? (flip ? -30 : 30) : 0), f.y - (side ? 350 : d === 'up' ? 330 : 370));
      F.depthTo(this.rider, DEPTH.actor + f.y / 1e5 + (d === 'down' ? -0.0002 : 0.0005)); // (the horse stands 20 units, 0.0002, lower)
      A.show(h, C.HORSE.frame0 + k, k >= 6 && k !== 9 && flip);
      this.shadow.setVisible(false);
    } else {
      this.player.setVisible(true);
      this.rider.setVisible(false);
      if (h.ridden) this.rideTexture(h, null);
      F.Anim.show(h, (h.ride ? 0 : C.HORSE.frame0) + (Math.floor(time / 2600) % 3 === 0 ? 10 : 9), false);
    }
    h.sh.setPosition(h.x, h.y);
    F.depthTo(h.sprite.setPosition(h.x, h.y), DEPTH.actor + h.y / 1e5);
  };

  // Riding: the horse with its farmer, one picture (see RIDE above)
  M.rideKey = function () {
    var s = this.state, who = s.look === 'girl' ? 'girl' : 'boy', cos = L.wornLook ? L.wornLook(s) : '', key = 'ride_' + (cos || 'default') + '_' + who;
    // a costume's riding picture comes from its pack the first time (tools/packs.js 'riding'): the farm clothes till then
    if (cos && (!F.images[key] || !F.images[key + 'shade']) && F.needImage) { F.needImage(key); F.needImage(key + 'shade'); }
    if (!F.images[key] || !F.images[key + 'shade']) key = 'ride_default_' + who;
    if (!F.images[key] || !F.images[key + 'shade']) return null;
    if (F.SHEETS) { F.SHEETS[key] = F.SHEETS.animals; F.SHEETS[key + 'shade'] = F.SHEETS.animalshade; }
    return key;
  };
  // the horse's picture: the ridden one (key), or back to the saddled horse alone (null)
  M.rideTexture = function (h, key) {
    var k = key || 'horse_ride', sc = C.HORSE.w * T / (key ? RIDE.ridden : RIDE.px);
    if (h.sprite.texture.key === k) return;
    h.sprite.setTexture(F.ensureTexture(this, k), h.sprite.frame.name).setScale(sc);
    h.sh.setTexture(F.ensureTexture(this, k + 'shade'), h.sh.frame.name).setScale(sc);
    h.ridden = !!key;
  };
  M.rideSeat = function (h, d, side, flip, time) {
    // moving, the legs never rest: step, other step (the walk's 'stand' between steps made a galloping horse glide)
    var A = F.Anim, k = A.FACING[d] + (this.moving ? 1 + Math.floor(time / GALLOP) % 2 : 0), mirror = side && flip, key = this.rideKey();
    if (key) {
      this.rideTexture(h, key);
      this.rider.setVisible(false);
      return A.show(h, k, mirror);
    }
    // (no ridden picture at all: the farmer stands in the saddle, as before)
    A.show(h, k, mirror);
    this.rider.setVisible(true).setFrame(side ? 6 : d === 'up' ? 3 : 0).setFlipX(mirror).setPosition(h.x + (side ? (mirror ? -30 : 30) : 0), h.y - 20 - (side ? 350 : d === 'up' ? 330 : 370));
    F.depthTo(this.rider, DEPTH.actor + h.y / 1e5 + (d === 'down' ? -0.0002 : 0.0005));
    void time;
  };

  // Where it may be ridden, and where it stands as a map starts (19zzzzzzzzzzzzzzzzzzzzzzzzz-horse-out.js widens both:
  // the horse goes out, farm economy v2 part 5).
  M.horseMapOk = function (map) { return !!RIDE_MAPS[map]; };
  M.horseSpot = function () {
    if (!RIDE_MAPS[this.mapKey]) return null;
    return F.session.riding ? this.feet() : F.session.horseAt && F.session.horseAt.map === this.mapKey ? F.session.horseAt
      : this.mapKey === 'farm' ? this.points.horse : null;
  };

  // Indoors and down the mine, the horse waits outside.
  M.beforeTravel = function (to) {
    if (F.session.riding && !this.horseMapOk(to)) this.dismount();
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
    if (this.horse && this.horse.ridden) this.rideTexture(this.horse, null);
    this.shadow.setVisible(true);
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
        if (F.session.visit && F.session.mineFloor > s.stats.deepest) return { label: 'Locked', icon: C.ICON.chest, disabled: true, why: 'Reach this floor on your own to open its chest.' };
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

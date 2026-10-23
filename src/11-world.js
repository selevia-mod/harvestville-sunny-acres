// The farm: Tiled map, player movement, the clock, and everything the action button does.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = { Ground: 0, Soil: 1, Walls: 2, crops: 3, cursor: 4, shadow: 9, player: 10, fx: 11, Above: 20 };
  var DIR_VEC = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
  var IDLE_FRAME = { down: 0, up: 3, left: 6, right: 6 };
  var FEET_OFFSET = 128; // body centre sits this far below the sprite centre (see body offset below)

  function propsOf(list) {
    var out = {};
    if (Array.isArray(list)) list.forEach(function (p) { out[p.name] = p.value; });
    else if (list) Object.keys(list).forEach(function (k) { out[k] = list[k]; });
    return out;
  }

  F.WorldScene = class extends Phaser.Scene {
    constructor() {
      super('World');
    }

    create() {
      var self = this;
      F.world = this;
      this.state = F.session.state;
      this.busy = false;
      this.clockMs = 0;
      this.saveMs = 0;
      this.hintKey = '';

      // ----- map
      var map = this.map = this.make.tilemap({ key: 'farm' });
      var tilesets = map.tilesets.map(function (ts) { return map.addTilesetImage(ts.name, ts.name); });
      this.layers = {};
      ['Ground', 'Soil', 'Walls', 'Above'].forEach(function (name) {
        self.layers[name] = map.createLayer(name, tilesets).setDepth(DEPTH[name]);
      });
      this.layers.Ground.setCollisionByProperty({ collides: true });
      this.layers.Walls.setCollisionByProperty({ collides: true });

      this.gids = {};
      map.tilesets.forEach(function (ts) {
        Object.keys(ts.tileProperties || {}).forEach(function (id) {
          var name = ts.tileProperties[id].name;
          if (name) self.gids[name] = ts.firstgid + Number(id);
        });
      });

      this.objects = [];
      this.spawn = { x: map.widthInPixels / 2, y: map.heightInPixels / 2 };
      map.getObjectLayer('Objects').objects.forEach(function (o) {
        var type = o.type || o.class || o.name;
        if (type === 'spawn') {
          self.spawn = { x: o.x, y: o.y };
          return;
        }
        self.objects.push({
          type: type,
          x0: Math.floor(o.x / T), y0: Math.floor(o.y / T),
          x1: Math.ceil((o.x + o.width) / T) - 1, y1: Math.ceil((o.y + o.height) / T) - 1,
          props: propsOf(o.properties),
        });
      });

      // ----- crops
      this.crops = {};
      this.refreshAllSoil();

      // ----- player
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      this.shadow = this.add.ellipse(0, 0, 176, 64, 0x000000, 0.25).setDepth(DEPTH.shadow);
      this.player = this.physics.add.sprite(0, 0, 'player', 0).setDepth(DEPTH.player);
      this.player.body.setSize(160, 96).setOffset(48, 272); // feet area of the 256x384 frame
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, [this.layers.Ground, this.layers.Walls]);
      var p = this.state.player;
      this.dir = p.dir || 'down';
      if (p.x != null) this.setFeet(p.x, p.y);
      else this.setFeet(this.spawn.x, this.spawn.y);
      this.idle();

      this.cursor = this.add.rectangle(0, 0, T, T).setOrigin(0).setStrokeStyle(14, 0xffffff, 0.9).setDepth(DEPTH.cursor);
      this.tweens.add({ targets: this.cursor, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

      // ----- camera
      var cam = this.cameras.main;
      cam.setZoom(F.R * C.VIEW_TILE / T).setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      cam.startFollow(this.player, false, 0.15, 0.15).setFollowOffset(0, -T);
      cam.setBackgroundColor('#3a7a2f');

      this.keys = this.input.keyboard ? this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') : null;
    }

    // ----- player helpers
    setFeet(x, y) {
      this.player.body.reset(x, y - FEET_OFFSET);
      this.shadow.setPosition(x, y + 16);
    }

    feet() {
      return { x: this.player.body.center.x, y: this.player.body.center.y };
    }

    idle() {
      this.player.anims.stop();
      this.player.setFrame(IDLE_FRAME[this.dir]);
      this.player.setFlipX(this.dir === 'right');
    }

    facing() {
      var f = this.feet(), d = DIR_VEC[this.dir];
      return { x: Math.floor(f.x / T) + d[0], y: Math.floor(f.y / T) + d[1] };
    }

    // ----- map queries
    inMap(x, y) {
      return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
    }

    idx(x, y) {
      return y * this.map.width + x;
    }

    tileProps(layer, x, y) {
      var t = this.layers[layer].getTileAt(x, y);
      return t ? t.properties || {} : {};
    }

    isTillable(x, y) {
      return !!this.tileProps('Ground', x, y).tillable && !this.layers.Walls.getTileAt(x, y);
    }

    isWater(x, y) {
      return !!this.tileProps('Ground', x, y).water;
    }

    objectAt(x, y) {
      return this.objects.filter(function (o) { return x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1; })[0] || null;
    }

    // ----- frame loop
    update(time, delta) {
      var dt = Math.min(delta, 100);
      var s = this.state;
      var body = this.player.body;
      if (!F.ui) return;

      if (this.busy || F.ui.blocking()) {
        body.setVelocity(0, 0);
        if (this.player.anims.isPlaying) this.idle();
        F.input.action = false;
        return;
      }

      // movement: joystick plus keyboard
      var vx = F.input.jx, vy = F.input.jy, k = this.keys;
      if (k) {
        if (k.LEFT.isDown || k.A.isDown) vx = -1;
        else if (k.RIGHT.isDown || k.D.isDown) vx = 1;
        if (k.UP.isDown || k.W.isDown) vy = -1;
        else if (k.DOWN.isDown || k.S.isDown) vy = 1;
      }
      var len = Math.sqrt(vx * vx + vy * vy);
      if (len < 0.2) vx = vy = 0;
      else if (len > 1) { vx /= len; vy /= len; }
      body.setVelocity(vx * C.SPEED, vy * C.SPEED);
      if (vx || vy) {
        this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
        this.player.anims.play(this.dir === 'left' || this.dir === 'right' ? 'walk-side' : 'walk-' + this.dir, true);
        this.player.setFlipX(this.dir === 'right');
      } else if (this.player.anims.isPlaying) {
        this.idle();
      }
      var f = this.feet();
      this.shadow.setPosition(f.x, f.y + 16);
      s.player.x = f.x;
      s.player.y = f.y;
      s.player.dir = this.dir;

      // clock
      this.clockMs += dt;
      while (this.clockMs >= C.MS_PER_MINUTE) {
        this.clockMs -= C.MS_PER_MINUTE;
        s.time += 1;
        if (s.time % 10 === 0) F.bus.emit('hud');
      }
      if (s.time >= C.PASS_OUT) {
        this.endDay(true);
        return;
      }

      // target tile + contextual action
      var t = this.facing();
      this.cursor.setPosition(t.x * T, t.y * T).setVisible(this.inMap(t.x, t.y));
      var action = this.resolve();
      var key = action ? action.label + '|' + action.icon + '|' + !!action.disabled : '';
      if (key !== this.hintKey) {
        this.hintKey = key;
        F.bus.emit('hint', action);
      }
      if (F.input.action) {
        F.input.action = false;
        if (action && action.disabled) F.ui.toast(action.why);
        else if (action) action.run();
      }

      // periodic autosave of mid-day progress
      this.saveMs += dt;
      if (F.session.dirty && this.saveMs > 15000) this.save();
    }

    save() {
      F.Host.save(this.state);
      F.session.dirty = false;
      this.saveMs = 0;
    }

    changed() {
      F.session.dirty = true;
      F.bus.emit('hud');
    }

    // ----- what the action button would do right now
    resolve() {
      var self = this, s = this.state, t = this.facing();
      if (!this.inMap(t.x, t.y)) return null;
      var o = this.objectAt(t.x, t.y);
      var held = L.held(s), def = held ? C.ITEMS[held.id] : null;
      if (o) {
        if (o.type === 'sleep') return { label: 'Sleep', icon: C.ICON.moon, run: function () { self.askSleep(); } };
        if (o.type === 'shop') return { label: 'Shop', icon: C.ICON.tag, run: function () { self.openShop(); } };
        if (o.type === 'sign') return { label: 'Read', icon: -1, run: function () { F.ui.dialog(o.props.text || '...'); } };
        if (o.type === 'ship') {
          if (def && def.sell) return { label: 'Ship', icon: C.ICON.crate, run: function () { self.ship(); } };
          return { label: 'Box', icon: C.ICON.crate, run: function () { self.showBox(); } };
        }
      }
      var idx = this.idx(t.x, t.y), soil = s.soil[idx];
      if (L.isRipe(soil)) return { label: 'Harvest', icon: C.ICON.sparkle, run: function () { self.harvest(t, idx); } };
      if (!def) return null;
      if (held.id === 'hoe') {
        if (this.isTillable(t.x, t.y) && !soil) return { label: 'Till', icon: def.icon, run: function () { self.till(t, idx); } };
        return { label: 'Till', icon: def.icon, disabled: true, why: soil ? 'This soil is already tilled.' : 'You can only till the soil in your field.' };
      }
      if (held.id === 'can') {
        if (this.isWater(t.x, t.y)) return { label: 'Refill', icon: C.ICON.drop, run: function () { self.refill(); } };
        if (soil && !soil.w) return { label: 'Water', icon: def.icon, run: function () { self.waterTile(t, idx); } };
        return { label: 'Water', icon: def.icon, disabled: true, why: soil ? 'Already watered today.' : 'Water tilled soil, or refill the can at the pond.' };
      }
      if (def.kind === 'seed') {
        if (soil && !soil.c) return { label: 'Plant', icon: def.icon, run: function () { self.plantTile(t, idx); } };
        return { label: 'Plant', icon: def.icon, disabled: true, why: soil ? 'Something is already growing here.' : 'Till the soil with the Hoe first.' };
      }
      if (def.kind === 'crop') {
        return { label: 'Ship', icon: def.icon, disabled: true, why: 'Put crops in the shipping box next to your house to sell them.' };
      }
      return null;
    }

    // ----- actions
    tired() {
      F.ui.toast("You're too tired. Go to bed to recover.");
    }

    till(t, idx) {
      if (!L.spendEnergy(this.state, C.ENERGY_COST.hoe)) return this.tired();
      L.till(this.state, idx);
      this.refreshTile(idx);
      this.swing(t, C.ITEMS.hoe.icon);
      this.puff(t, 0x8a5a30, 6);
      this.changed();
    }

    waterTile(t, idx) {
      if (this.state.water <= 0) return F.ui.toast('The can is empty. Refill it at the pond.');
      if (!L.spendEnergy(this.state, C.ENERGY_COST.can)) return this.tired();
      L.water(this.state, idx);
      this.refreshTile(idx);
      this.swing(t, C.ITEMS.can.icon);
      this.drops(t);
      this.changed();
    }

    refill() {
      L.refill(this.state);
      this.swing(this.facing(), C.ITEMS.can.icon);
      this.drops(this.facing());
      F.ui.toast('Watering can refilled!');
      this.changed();
    }

    plantTile(t, idx) {
      if (L.plant(this.state, idx, this.state.sel) !== 'ok') return;
      this.refreshTile(idx);
      this.puff(t, 0x4a2e18, 4);
      this.changed();
    }

    harvest(t, idx) {
      var got = L.harvest(this.state, idx);
      if (got === '!full') return F.ui.toast('Your bag is full!');
      this.refreshTile(idx);
      this.puff(t, 0x93d66b, 6);
      this.floatText(t, '+1 ' + C.ITEMS[got].name);
      this.changed();
    }

    ship() {
      var r = L.ship(this.state, this.state.sel);
      if (!r) return;
      F.ui.toast('Shipped ' + r.n + ' ' + C.ITEMS[r.id].name + '. ' + r.value + 'G arrives in the morning.');
      this.changed();
      this.save();
    }

    showBox() {
      var s = this.state;
      var lines = s.box.map(function (b) { return b.n + ' x ' + C.ITEMS[b.id].name; });
      F.ui.dialog('SHIPPING BOX\n' + (lines.length
        ? lines.join('\n') + '\nTotal: ' + L.boxValue(s) + 'G, paid while you sleep.'
        : 'Hold a crop and press the action button here to ship it. You get paid while you sleep.'));
    }

    openShop() {
      if (!L.shopOpen(this.state)) {
        F.ui.dialog("LILY: Sorry, we're closed!\nThe seed shop is open from 9:00 AM to 5:00 PM.");
        return;
      }
      F.ui.openShop();
    }

    askSleep() {
      var self = this;
      F.ui.confirm('Go to bed and end Day ' + this.state.day + '?', function () { self.endDay(false); });
    }

    endDay(passedOut) {
      var self = this, cam = this.cameras.main;
      this.busy = true;
      this.player.body.setVelocity(0, 0);
      F.input.reset();
      cam.fadeOut(passedOut ? 1200 : 600, 0, 0, 0);
      cam.once('camerafadeoutcomplete', function () {
        var result = L.endDay(self.state, passedOut);
        self.refreshAllSoil();
        self.dir = 'down';
        self.setFeet(self.spawn.x, self.spawn.y);
        self.idle();
        self.clockMs = 0;
        self.save();
        F.bus.emit('hud');
        cam.fadeIn(600);
        self.busy = false;
        F.ui.dayReport(result, self.state);
      });
    }

    // ----- soil & crop rendering
    refreshTile(idx) {
      var w = this.map.width, x = idx % w, y = Math.floor(idx / w);
      var tile = this.state.soil[idx];
      if (tile) this.layers.Soil.putTileAt(tile.w ? this.gids.tilled_wet : this.gids.tilled, x, y);
      else this.layers.Soil.removeTileAt(x, y);

      var stage = L.cropStage(tile), spr = this.crops[idx];
      if (stage < 0) {
        if (spr) { spr.destroy(); delete this.crops[idx]; }
        return;
      }
      if (!spr) {
        spr = this.crops[idx] = this.add.image(x * T + T / 2, y * T + T - 12, 'crops').setOrigin(0.5, 1).setDepth(DEPTH.crops);
      }
      spr.setFrame(stage * C.CROP_KEYS.length + C.CROPS[tile.c].row); // sheet: one column per crop, one row per stage
      if (stage === 3 && !spr.sway) {
        spr.sway = this.tweens.add({ targets: spr, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (idx * 37) % 500 });
      } else if (stage !== 3 && spr.sway) {
        spr.sway.remove();
        spr.sway = null;
        spr.angle = 0;
      }
    }

    refreshAllSoil() {
      var self = this, soil = this.layers.Soil;
      soil.forEachTile(function (t) { if (t.index !== -1) soil.removeTileAt(t.x, t.y); });
      Object.keys(this.crops).forEach(function (idx) {
        if (!self.state.soil[idx]) {
          self.crops[idx].destroy();
          delete self.crops[idx];
        }
      });
      Object.keys(this.state.soil).forEach(function (idx) { self.refreshTile(Number(idx)); });
    }

    // ----- little effects
    swing(t, frame) {
      var img = this.add.image(t.x * T + T / 2, t.y * T + T / 4, 'items', frame).setScale(1.6).setDepth(DEPTH.fx).setAngle(-50);
      this.tweens.add({ targets: img, angle: 20, y: img.y + T / 4, duration: 160, ease: 'Quad.in' });
      this.tweens.add({ targets: img, alpha: 0, delay: 200, duration: 150, onComplete: function () { img.destroy(); } });
    }

    puff(t, color, n) {
      for (var i = 0; i < n; i++) {
        var r = this.add.circle(t.x * T + T / 2 + Phaser.Math.Between(-96, 96), t.y * T + 176 + Phaser.Math.Between(-48, 48), 18, color).setDepth(DEPTH.fx);
        this.tweens.add({ targets: r, y: r.y - Phaser.Math.Between(64, 144), alpha: 0, duration: Phaser.Math.Between(300, 520), onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
    }

    drops(t) {
      for (var i = 0; i < 6; i++) {
        var r = this.add.ellipse(t.x * T + 48 + i * 32, t.y * T + 32, 14, 30, 0x8fd0ff).setDepth(DEPTH.fx);
        this.tweens.add({ targets: r, y: r.y + 160, alpha: 0, delay: i * 30, duration: 320, onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
    }

    floatText(t, text) {
      var cam = this.cameras.main;
      var sx = (t.x * T + T / 2 - cam.worldView.x) * cam.zoom / F.R; // layout px
      var sy = (t.y * T - cam.worldView.y) * cam.zoom / F.R;
      F.ui.floatText(sx, sy, text);
    }
  };
})(window.Farm = window.Farm || {});

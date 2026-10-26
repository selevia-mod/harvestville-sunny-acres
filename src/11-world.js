// The world scene: loads the current map (farm, house, town or mine) from Tiled, places props, moves the
// player, runs the clock, and travels between maps. What the action button does is in 14-actions.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = { Ground: 0, Soil: 1, Debris: 1.5, Walls: 2, Closed: 2.2, flat: 2.5, crops: 3, cursor: 4, forage: 4.5, shadow: 9, actor: 10, fx: 11, Above: 20 };
  var DIR_VEC = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
  var IDLE_FRAME = { down: 0, up: 3, left: 6, right: 6 };
  var FEET_OFFSET = 128; // body centre sits this far below the sprite centre (see body offset below)
  var DEFAULT_SPAWN = { farm: 'spawn', house: 'bed', town: 'from_farm', mine: 'entrance' };
  var OUTDOORS = { farm: true, town: true };

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
      var self = this, s = this.state = F.session.state;
      F.world = this;
      this.mapKey = s.map;
      this.outdoors = !!OUTDOORS[s.map];
      this.busy = false;
      this.clockMs = 0;
      this.saveMs = 0;
      this.hintKey = '';
      this.charge = null;
      this.fishing = null;
      this.hits = {}; // tile index -> swings so far on a stump or boulder
      this.herd = null;
      this.dog = null;
      this.villagers = null;
      this.mine = null;

      this.buildMap();
      this.buildObjects();

      // ----- player
      this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
      // Arcade ignores a wall the body has sunk into by more than TILE_BIAS in one step. At our scale
      // (256 per tile) the farmer moves ~19 units a step (33 on the horse), past the default 16, so walls
      // were walked straight through. Allow for a few steps' worth.
      this.physics.world.TILE_BIAS = 128;
      this.physics.world.OVERLAP_BIAS = 48;
      this.shadow = this.add.ellipse(0, 0, 176, 64, 0x000000, 0.25).setDepth(DEPTH.shadow);
      this.player = this.physics.add.sprite(0, 0, F.playerKey(this), 0).setDepth(DEPTH.actor);
      this.player.body.setSize(160, 96).setOffset(48, 272); // feet area of the 256x384 frame
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, this.collideLayers);
      this.physics.add.collider(this.player, this.solids);
      var p = s.player, spawn = this.points[F.session.spawn] || this.points[p.spawn] || this.points[DEFAULT_SPAWN[this.mapKey]] || { x: this.map.widthInPixels / 2, y: this.map.heightInPixels / 2, props: {} };
      F.session.spawn = null;
      delete p.spawn;
      if (p.x != null) {
        this.dir = p.dir || 'down';
        this.setFeet(p.x, p.y);
      } else {
        this.dir = spawn.props.dir || 'down';
        this.setFeet(spawn.x, spawn.y);
      }
      this.idle();
      this.unstick();

      this.cursor = this.add.rectangle(0, 0, T, T).setOrigin(0).setStrokeStyle(14, 0xffffff, 0.9).setDepth(DEPTH.cursor);
      this.tweens.add({ targets: this.cursor, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
      this.areaCells = [];
      for (var i = 0; i < 15; i++) this.areaCells.push(this.add.rectangle(0, 0, T - 24, T - 24, 0xffffff, 0.28).setOrigin(0).setDepth(DEPTH.cursor).setVisible(false));

      // ----- what lives on this map
      if (this.mapKey === 'farm') this.setupFarm();
      if (this.mapKey === 'mine') this.setupMine();
      this.setupForage();
      if (this.mapKey === 'town' || this.mapKey === 'house') this.villagers = new F.Villagers(this);
      this.setupExtras();
      this.setupPolish();
      if (this.mapKey === 'mine') L.reachFloor(s, F.session.mineFloor);
      if (this.mapKey === 'town') this.time.delayedCall(600, function () { if (F.ui) self.progress('town'); });

      // ----- camera: follows the player, and centres maps smaller than the screen
      var cam = this.cameras.main;
      cam.setZoom(F.R * C.VIEW_TILE / T);
      cam.setBackgroundColor(this.mapKey === 'mine' ? '#1a1410' : this.mapKey === 'house' ? '#2a1a10' : '#3a7a2f');
      this.updateCamera(1);
      cam.fadeIn(350);

      this.keys = this.input.keyboard ? this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') : null;
      F.bus.emit('map', this.mapKey);
      F.bus.emit('hud');
      if (F.Audio) {
        var weather = L.weather(s, s.day);
        F.Audio.music(this.musicMood());
        F.Audio.ambient(this.outdoors && C.WEATHER[weather].waters ? weather : null);
      }
      if (F.session.report) {
        var report = F.session.report;
        F.session.report = null;
        this.time.delayedCall(400, function () { if (F.ui) F.ui.dayReport(report, self.state); });
      } else if (this.mapKey === 'mine') {
        F.ui && F.ui.toast('Mine, floor ' + F.session.mineFloor);
      }
    }

    // ----- map, layers and seasons
    buildMap() {
      var self = this, s = this.state;
      // the farmhouse's map grows with its level (house_1 .. house_10)
      var key = this.assetKey = this.mapKey === 'house' ? 'house_' + s.home.level : this.mapKey;
      var raw = F.ASSETS.maps[key];
      var map = this.map = this.make.tilemap({ key: key });
      // (Phaser lists each image of the props collection as a tileset of its own; props are drawn as images instead.)
      var tilesets = map.tilesets.filter(function (ts) { return F.images[ts.name]; })
        .map(function (ts) { return map.addTilesetImage(ts.name, F.ensureTexture(self, ts.name)); });
      this.layers = {};
      this.collideLayers = [];
      raw.layers.forEach(function (l) {
        if (l.type !== 'tilelayer') return;
        var cond = propsOf(l.properties);
        if (cond.unless && s.builds[cond.unless]) return;
        if (cond.requires && !s.builds[cond.requires]) return;
        var layer = self.layers[l.name] = map.createLayer(l.name, tilesets).setDepth(l.name in DEPTH ? DEPTH[l.name] : 2);
        layer.setCollisionByProperty({ collides: true });
        self.collideLayers.push(layer);
      });

      this.gids = {};
      this.slotOf = {}; // gid of a spring tile -> its slot in the seasons tileset
      map.tilesets.forEach(function (ts) {
        Object.keys(ts.tileProperties || {}).forEach(function (id) {
          var props = ts.tileProperties[id];
          if (props.name) self.gids[props.name] = ts.firstgid + Number(id);
          if (props.seasonal !== undefined) self.slotOf[ts.firstgid + Number(id)] = props.seasonal;
        });
      });
      this.seasonal = [];
      if (map.getTileset('seasons')) {
        ['Ground', 'Walls', 'Above'].forEach(function (name) {
          if (!self.layers[name]) return;
          self.layers[name].forEachTile(function (t) {
            if (self.slotOf[t.index] !== undefined) self.seasonal.push({ layer: name, x: t.x, y: t.y, slot: self.slotOf[t.index] });
          });
        });
      }
      this.seasonShown = -1;
      this.applySeason();
    }

    // Swaps every seasonal tile for the current season's version (the maps are drawn in spring).
    applySeason() {
      var season = L.date(this.state.day).season;
      if (season === this.seasonShown || !this.seasonal.length) return;
      this.seasonShown = season;
      var ts = this.map.getTileset('seasons'), self = this;
      var perSeason = C.SEASONS.length ? Object.keys(this.slotOf).length : 0;
      this.seasonal.forEach(function (e) {
        self.putTile(e.layer, ts.firstgid + season * perSeason + e.slot, e.x, e.y);
      });
      this.recollide();
    }

    // Phaser's putTileAt keeps the old tile's properties (or none), so copy the new tile's own.
    putTile(layer, gid, x, y) {
      var map = this.map, tile = this.layers[layer].putTileAt(gid, x, y);
      if (!tile) return null;
      var ts = map.tilesets[map.tiles[gid][2]];
      tile.properties = (ts && ts.getTileProperties(gid)) || {};
      return tile;
    }

    recollide() {
      this.collideLayers.forEach(function (l) { l.setCollisionByProperty({ collides: true }); });
    }

    // ----- objects: spawn points, places, warps, things to use, and props (furniture, buildings)
    buildObjects() {
      var self = this, s = this.state, raw = F.ASSETS.maps[this.assetKey];
      var propSet = raw.tilesets.filter(function (ts) { return ts.name === 'props'; })[0];
      var fest = L.festivalOn(s.day);
      this.objects = [];
      this.points = {};
      this.zones = {}; // type -> [rect in tiles]
      this.blocked = {}; // tile index -> true under the solid part of a prop
      this.solids = this.physics.add.staticGroup();
      this.props = [];
      var layer = raw.layers.filter(function (l) { return l.type === 'objectgroup'; })[0];
      (layer ? layer.objects : []).forEach(function (o) {
        var props = propsOf(o.properties), type = o.type || o.class || '';
        if (props.requires && !s.builds[props.requires]) return;
        if (props.unless && s.builds[props.unless]) return;
        if (props.festival && !(fest && props.festival.split(',').indexOf(fest.key) >= 0)) return;
        if (o.gid && propSet) {
          var tile = propSet.tiles.filter(function (t) { return t.id === o.gid - propSet.firstgid; })[0];
          if (tile) self.addProp(tile.image.replace(/^.*\/|\.png$/g, ''), o, propsOf(tile.properties));
          return;
        }
        if (o.point) {
          self.points[o.name] = { x: o.x, y: o.y, props: props, type: type };
          return;
        }
        var rect = {
          type: type, name: o.name,
          x0: Math.floor(o.x / T), y0: Math.floor(o.y / T),
          x1: Math.ceil((o.x + o.width) / T) - 1, y1: Math.ceil((o.y + o.height) / T) - 1,
          px: o.x, py: o.y, pw: o.width, ph: o.height, props: props,
        };
        if (type === 'pen' || type === 'dogarea' || type === 'catarea' || type === 'forage' || type === 'minefloor') {
          (self.zones[type] = self.zones[type] || []).push(rect);
          return;
        }
        self.objects.push(rect);
      });
    }

    addProp(name, o, tp) {
      F.ensureTexture(this, 'props/' + name);
      var img = this.add.image(o.x, o.y, 'props/' + name).setOrigin(0, 1).setDisplaySize(o.width, o.height);
      img.setDepth(tp.flat ? DEPTH.flat : DEPTH.actor + o.y / 1e5);
      this.props.push(img);
      var foot = tp.foot || 0;
      if (!foot || tp.flat) return;
      var x0 = Math.round(o.x / T), w = Math.round(o.width / T), y1 = Math.round(o.y / T) - 1;
      for (var y = y1 - foot + 1; y <= y1; y++) for (var x = x0; x < x0 + w; x++) this.blocked[this.idx(x, y)] = true;
      var zone = this.add.zone(o.x + o.width / 2, o.y - foot * T / 2 + 8, o.width - 16, foot * T - 16);
      this.physics.add.existing(zone, true);
      this.solids.add(zone);
      if (name === 'notice') {
        this.objects.push({ type: 'notice', x0: x0, y0: y1 - foot + 1, x1: x0 + w - 1, y1: y1, props: {} });
      }
    }

    // A save from before walls were solid may have left the farmer inside something: step out to the
    // nearest open tile.
    unstick() {
      var f = this.feet(), sx = Math.floor(f.x / T), sy = Math.floor(f.y / T);
      if (this.walkable(sx, sy)) return;
      var W = this.map.width, seen = {}, q = [[sx, sy]];
      seen[sy * W + sx] = true;
      while (q.length) {
        var p = q.shift();
        if (this.walkable(p[0], p[1])) {
          this.setFeet(p[0] * T + T / 2, p[1] * T + T / 2);
          return;
        }
        for (var k = 0; k < 4; k++) {
          var nx = p[0] + [1, -1, 0, 0][k], ny = p[1] + [0, 0, 1, -1][k];
          if (this.inMap(nx, ny) && !seen[ny * W + nx]) {
            seen[ny * W + nx] = true;
            q.push([nx, ny]);
          }
        }
      }
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

    face(dir) {
      this.dir = dir;
      this.idle();
    }

    facing() {
      var f = this.feet(), d = DIR_VEC[this.dir];
      return { x: Math.floor(f.x / T) + d[0], y: Math.floor(f.y / T) + d[1] };
    }

    dirVec() {
      return DIR_VEC[this.dir];
    }

    // ----- map queries
    inMap(x, y) {
      return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
    }

    idx(x, y) {
      return y * this.map.width + x;
    }

    tileProps(layer, x, y) {
      var l = this.layers[layer], t = l && l.getTileAt(x, y);
      return t ? t.properties || {} : {};
    }

    tileAt(layer, x, y) {
      var l = this.layers[layer];
      return l ? l.getTileAt(x, y) : null;
    }

    isTillable(x, y) {
      return this.mapKey === 'farm' && !!this.tileProps('Ground', x, y).tillable && !this.tileAt('Walls', x, y);
    }

    isWater(x, y) {
      return !!(this.tileProps('Ground', x, y).water || this.tileProps('Walls', x, y).water);
    }

    // Can a person stand on this tile? (Used for villager routes and forage spots.)
    walkable(x, y) {
      if (!this.inMap(x, y) || this.blocked[this.idx(x, y)]) return false;
      for (var i = 0; i < this.collideLayers.length; i++) {
        var t = this.collideLayers[i].getTileAt(x, y);
        if (t && t.collides) return false;
      }
      return true;
    }

    objectAt(x, y) {
      return this.objects.filter(function (o) { return x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1; })[0] || null;
    }

    musicMood() {
      var s = this.state;
      if (L.festivalNow(s) || (L.festivalOn(s.day) && this.mapKey === 'town')) return 'festival';
      if (this.mapKey === 'mine') return 'mine';
      if (s.time >= 20 * 60) return 'night';
      if (this.mapKey === 'town') return 'town';
      if (this.mapKey === 'house') return 'house';
      return L.date(s.day).key;
    }

    // ----- frame loop
    update(time, delta) {
      var dt = Math.min(delta, 100);
      var s = this.state;
      var body = this.player.body;
      this.updateCamera(0.15);
      if (!F.ui) return;

      if (this.busy || F.ui.blocking() || this.fishing || this.charge || this.acting > 0) {
        body.setVelocity(0, 0);
        if (this.player.anims.isPlaying) this.idle();
        if (this.busy || F.ui.blocking()) {
          F.input.action = false;
          this.charge = null;
          this.showArea(null);
          if (this.villagers) this.villagers.update(dt, time, true);
          return;
        }
      } else {
        this.move(body);
      }
      var f = this.feet();
      this.shadow.setPosition(f.x, f.y + 16);
      s.player.x = f.x;
      s.player.y = f.y;
      s.player.dir = this.dir;
      this.player.setDepth(DEPTH.actor + f.y / 1e5);

      if (this.tickClock(dt)) return;
      this.updatePolish(dt, time);
      this.updateExtras(dt, time);
      if (this.herd) this.herd.update(dt, time, s.time);
      if (this.dog) this.dog.update(dt, time, s.time);
      if (this.villagers) this.villagers.update(dt, time, false);
      if (this.checkWalkWarp()) return;

      if (this.fishing) {
        this.updateFishing(time);
      } else {
        this.updateAction(time);
      }

      // periodic autosave of mid-day progress
      this.saveMs += dt;
      if (F.session.dirty && this.saveMs > 15000) this.save();
    }

    move(body) {
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
      var speed = C.SPEED * (F.session.riding ? C.HORSE.speed : 1);
      body.setVelocity(vx * speed, vy * speed);
      if (F.session.riding) {
        if (vx || vy) this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
        if (vx) this.rideFlip = vx > 0;
        this.moving = !!(vx || vy);
        return;
      }
      if (vx || vy) {
        this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
        this.player.anims.play(F.walkAnim(this.dir === 'left' || this.dir === 'right' ? 'side' : this.dir), true);
        this.player.setFlipX(this.dir === 'right');
      } else if (this.player.anims.isPlaying) {
        this.idle();
      }
    }

    // Follows the phone's clock, once a second: the time, energy coming back, crops growing, and a new day at
    // midnight (or on coming back after days away). Returns true when a new day just started.
    tickClock(dt) {
      var s = this.state;
      this.clockMs += dt;
      if (this.clockMs < 1000) return false;
      this.clockMs = 0;
      var now = L.clock(), before = Math.floor(s.time), energy = s.energy;
      var r = L.catchUp(s, now, L.dayOf(now) > s.day ? { fieldTiles: F.fieldTiles() } : null);
      if (r) {
        this.newDay(r);
        return true;
      }
      var minute = Math.floor(s.time);
      if (minute !== before || s.energy !== energy) {
        F.bus.emit('hud');
        if (F.Audio && minute !== before && minute % 30 === 0) F.Audio.music(this.musicMood());
      }
      if (this.mapKey === 'farm') this.growCrops();
      return false;
    }

    // Crops show their stage as they grow (and wither) by the clock.
    growCrops() {
      var self = this;
      Object.keys(this.crops).forEach(function (idx) {
        var spr = self.crops[idx], t = self.state.soil[idx];
        if (spr && t && spr.stage !== L.cropStage(t)) self.refreshTile(Number(idx));
      });
    }

    // Midnight went by: the morning report, where you are (the scene restarts to show the new day).
    newDay(report) {
      var self = this;
      if (this.busy) return;
      this.busy = true;
      this.player.body.setVelocity(0, 0);
      F.input.reset();
      if (F.ui) F.ui.closeAll();
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', function () {
        F.session.report = report;
        F.session.mineBroken = {};
        self.save();
        self.scene.restart();
      });
    }

    updateCamera(lerp) {
      var cam = this.cameras.main, f = this.feet();
      var vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      var mw = this.map.widthInPixels, mh = this.map.heightInPixels;
      var cx = f.x, cy = f.y - T; // a little above the feet, since the HUD covers the bottom
      cx = mw <= vw ? mw / 2 : Phaser.Math.Clamp(cx, vw / 2, mw - vw / 2);
      cy = mh <= vh - 3 * T ? mh / 2 + T : Phaser.Math.Clamp(cy, vh / 2 - 2 * T, mh - vh / 2 + 3 * T);
      var cur = cam.midPoint;
      cam.centerOn(cur.x + (cx - cur.x) * lerp, cur.y + (cy - cur.y) * lerp);
    }

    // Walk-through warps (the road between the farm and town, the house door).
    checkWalkWarp() {
      var f = this.feet(), tx = Math.floor(f.x / T), ty = Math.floor(f.y / T);
      var o = this.objects.filter(function (w) { return w.type === 'warp' && w.props.walk && tx >= w.x0 && tx <= w.x1 && ty >= w.y0 && ty <= w.y1; })[0];
      if (!o) return false;
      this.travel(o.props.to, o.props.spawn);
      return true;
    }

    // Goes to another map: saves, fades out, and restarts this scene on the new map.
    travel(to, spawn, floor) {
      if (this.busy) return;
      var self = this, s = this.state;
      this.beforeTravel(to);
      this.busy = true;
      this.charge = null;
      this.player.body.setVelocity(0, 0);
      F.input.reset();
      if (to === 'mine') F.session.mineFloor = floor || 1;
      if (F.Audio) F.Audio.sfx(to === this.mapKey ? 'ladder' : 'door');
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', function () {
        s.map = to;
        s.player = { x: null, y: null, dir: 'down' };
        F.session.spawn = spawn;
        self.save();
        self.scene.restart();
      });
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

    // The bed: time runs on the real clock, so there is no sleeping through the night.
    askSleep() {
      var s = this.state, w = L.weather(s, s.day + 1);
      F.ui.dialog('YOUR BED\nA new day starts at midnight, while you play or not. Your energy comes back by itself: ' +
        '1 point every ' + C.ENERGY_EVERY + ' minutes (food and a Power-Up help too).\n\nTomorrow: ' + C.WEATHER[w].name + '.');
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
      this.floatTextAt(t.x * T + T / 2, t.y * T, text);
    }

    floatTextAt(wx, wy, text) {
      var cam = this.cameras.main;
      var sx = (wx - cam.worldView.x) * cam.zoom / F.R; // layout px
      var sy = (wy - cam.worldView.y) * cam.zoom / F.R;
      F.ui.floatText(sx, sy, text);
    }

    iconPop(wx, wy, frame) {
      var img = this.add.image(wx, wy, 'items', frame).setScale(1.2).setDepth(DEPTH.fx);
      this.tweens.add({ targets: img, y: wy - 200, alpha: 0, duration: 800, ease: 'Quad.out', onComplete: function () { img.destroy(); } });
    }
  };

  F.WorldScene.DEPTH = DEPTH;
  F.WorldScene.DIR_VEC = DIR_VEC;
})(window.Farm = window.Farm || {});

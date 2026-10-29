// Registers the inlined images and Tiled maps with Phaser (no loader, no network), then starts the game.
(function (F) {
  'use strict';
  var C = F.Config;

  // Frames are padded in the sheets (8px margin, 16px gaps) so scaled-down sprites never bleed.
  var SHEETS = {
    player: { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 },
    player_girl: { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 },
    player_bday: { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 }, // the same farmers in a party hat
    player_girl_bday: { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 },
    crops: { frameWidth: 256, frameHeight: 256, margin: 8, spacing: 16 },
    items: { frameWidth: 128, frameHeight: 128, margin: 8, spacing: 16 },
    animals: { frameWidth: 384, frameHeight: 320, margin: 8, spacing: 16 },
    animals2: { frameWidth: 384, frameHeight: 320, margin: 8, spacing: 16 },
    people: { frameWidth: 128, frameHeight: 192, margin: 8, spacing: 16 },
    fx: { frameWidth: 128, frameHeight: 128, margin: 8, spacing: 16 },
  };
  // Only these are uploaded to the GPU at boot; the rest (props, villagers, indoor tiles) are added
  // the first time a map needs them, which keeps memory down on low-end phones.
  var EAGER = ['player', 'fx', 'crops', 'items', 'animals', 'tiles', 'ranch', 'seasons'];

  // Shared between scenes: an event bus and the current touch/keyboard input.
  F.bus = new Phaser.Events.EventEmitter();
  F.input = {
    jx: 0, // joystick vector, -1..1
    jy: 0,
    action: false, // set when the action button goes down, consumed by the world
    holding: false, // the action button is still held (charging a tool)
    released: false, // set when the action button comes up
    reset: function () {
      this.jx = this.jy = 0;
      this.action = this.holding = this.released = false;
      if (F.ui) F.ui.releaseJoystick();
    },
  };

  // Adds an inlined image as a texture the first time it is needed. World art is stored at half size: it goes to the
  // GPU as it is (a quarter of the memory of scaling it back up) and Phaser is told the full size, so every frame,
  // tile and UV stays in full-size pixels (UVs are fractions of the source size). On a phone screen a tile is 64-96
  // pixels, so the 128-pixel half-size art is still drawn smaller than it is.
  F.ensureTexture = function (scene, key) {
    var tex = scene.textures;
    if (tex.exists(key)) return key;
    if (!F.images[key]) throw new Error('No image "' + key + '"');
    var full = F.sizes && F.sizes[key], bmp = F.bitmaps && F.bitmaps[key];
    if (full) {
      var t = tex.create(key, bmp || F.images[key], full[0], full[1]), gt = t.source[0].glTexture;
      if (gt) { gt.width = full[0]; gt.height = full[1]; } // tilemap layers divide by the GL texture's size
      if (SHEETS[key]) Phaser.Textures.Parsers.SpriteSheet(t, 0, 0, 0, full[0], full[1], SHEETS[key]);
      else Phaser.Textures.Parsers.Image(t, 0);
      tex.emit(Phaser.Textures.Events.ADD, key, t);
      tex.emit(Phaser.Textures.Events.ADD_KEY + key, t);
    } else if (SHEETS[key]) tex.addSpriteSheet(key, bmp || F.images[key], SHEETS[key]);
    else tex.addImage(key, bmp || F.images[key]);
    if (bmp) { // uploaded from the bitmap decoded off the main thread; keep the <img> for a GPU context restore
      var src = tex.get(key).source[0];
      src.image = F.images[key];
      if (src.glTexture) src.glTexture.pixels = F.images[key];
      bmp.close();
      delete F.bitmaps[key];
    }
    if (key === 'people') F.makePeopleAnims(scene);
    if (SHEETS[key] && key.indexOf('player') === 0) F.makeWalkAnims(scene, key);
    return key;
  };

  // Decodes the big sheets the next map needs off the main thread while the screen fades out (travel), so their first
  // upload is fast; ensureTexture uses the bitmap and closes it.
  var NEXT_MAP = { town: ['people'], house: ['people', 'indoor'], mine: ['indoor'] };
  F.prewarm = function (map, scene) {
    if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function' || !F.bitmaps) return;
    (NEXT_MAP[map] || []).forEach(function (k) {
      if (F.bitmaps[k] || F.bitmaps[k] === null || !F.ASSETS.images[k] || (scene && scene.textures.exists(k))) return;
      F.bitmaps[k] = null; // decoding
      fetch(F.ASSETS.images[k]).then(function (r) { return r.blob(); })
        .then(function (b) { return createImageBitmap(b, { premultiplyAlpha: 'premultiply' }); })
        .then(function (b) {
          if (scene && scene.textures.exists(k)) b.close(); // it was needed before the bitmap was ready
          else F.bitmaps[k] = b;
        }, function () { delete F.bitmaps[k]; });
    });
  };

  // The farmer's walk cycle: frame = dir * 3 + step (stand, step A, step B).
  F.makeWalkAnims = function (scene, key) {
    [['down', 0], ['up', 3], ['side', 6]].forEach(function (d) {
      var f = d[1];
      scene.anims.create({
        key: 'walk-' + d[0] + F.walkSuffix(key),
        frames: scene.anims.generateFrameNumbers(key, { frames: [f + 1, f, f + 2, f] }),
        frameRate: 8,
        repeat: -1,
      });
    });
  };

  // Walk cycles for every villager: frame = villager * 9 + dir * 3 + step (stand, step A, step B).
  F.makePeopleAnims = function (scene) {
    C.VILLAGER_ORDER.forEach(function (v, i) {
      ['down', 'up', 'side'].forEach(function (d, k) {
        var f = i * 9 + k * 3;
        scene.anims.create({
          key: 'v-' + v + '-' + d,
          frames: scene.anims.generateFrameNumbers('people', { frames: [f + 1, f, f + 2, f] }),
          frameRate: 6,
          repeat: -1,
        });
      });
    });
  };

  // The farmer's picture: the boy or the girl, picked at the start of a new game (the girl's sheet is only
  // added when she is played). Pass a scene to make sure the texture is there.
  // On your birthday the farmer wears a party hat in every pose (owner, 29 Oct 2026: "change the character itself").
  F.sheetFor = function (look, party) {
    return (look === 'girl' ? 'player_girl' : 'player') + (party ? '_bday' : '');
  };
  F.walkSuffix = function (key) {
    return { player: '', player_girl: '-g', player_bday: '-b', player_girl_bday: '-gb' }[key] || '';
  };
  F.myParty = function () {
    var s = F.session && F.session.state;
    return !!(s && F.Logic.myBirthdayOn && F.Logic.myBirthdayOn(s, s.day));
  };
  F.playerKey = function (scene) {
    var key = F.session ? F.sheetFor(F.session.state.look, F.myParty()) : 'player';
    return scene ? F.ensureTexture(scene, key) : key;
  };
  F.walkAnim = function (dir) {
    return 'walk-' + dir + F.walkSuffix(F.playerKey());
  };

  // Tillable field tiles on the farm map: where new farms get their debris and where weeds sprout.
  F.fieldTiles = function () {
    var map = F.ASSETS.maps.farm, tillable = {}, walls = {};
    map.tilesets.forEach(function (ts) {
      (ts.tiles || []).forEach(function (t) {
        (t.properties || []).forEach(function (p) { if (p.name === 'tillable' && p.value) tillable[ts.firstgid + t.id] = true; });
      });
    });
    map.layers.forEach(function (l) { if (l.name === 'Walls') l.data.forEach(function (g, i) { if (g) walls[i] = true; }); });
    var out = [];
    map.layers.forEach(function (l) {
      if (l.name === 'Ground') l.data.forEach(function (g, i) { if (tillable[g] && !walls[i]) out.push(i); });
    });
    return out;
  };

  F.BootScene = class extends Phaser.Scene {
    constructor() {
      super('Boot');
    }

    create() {
      var self = this;
      EAGER.forEach(function (key) { F.ensureTexture(self, key); });
      Object.keys(F.ASSETS.maps).forEach(function (key) {
        self.cache.tilemap.add(key, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: F.ASSETS.maps[key] });
      });

      var saved = F.Host.load();
      F.session = F.newSession(saved);
      // back after a while: the farm catches up with the clock (energy, and any midnights that went by)
      if (saved) F.session.report = F.Logic.catchUp(F.session.state, F.Logic.clock(), { fieldTiles: F.fieldTiles() });
      this.scene.start('World');
      this.scene.launch('UI');
    }
  };

  // Things that live for the session but are not saved (mine floor, the morning report).
  F.newSession = function (saved) {
    return {
      state: saved || F.Logic.newState({ fieldTiles: F.fieldTiles() }),
      dirty: false,
      isNew: !saved,
      spawn: null, // spawn point name for the next map
      mineFloor: 1,
      mineBroken: {}, // 'day:floor' -> { idx: 1 } rocks broken today
      report: null, // morning report waiting to be shown
    };
  };
})(window.Farm = window.Farm || {});

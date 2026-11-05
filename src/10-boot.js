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
    animals: { frameWidth: 224, frameHeight: 252, margin: 8, spacing: 16 }, // a row of 12 per animal (tools/art/animals3q-import.js)
    animalshade: { frameWidth: 224, frameHeight: 252, margin: 8, spacing: 16 }, // the shadow under each of those frames
    people: { frameWidth: 128, frameHeight: 192, margin: 8, spacing: 16 },
    fx: { frameWidth: 128, frameHeight: 128, margin: 8, spacing: 16 },
    wild: { frameWidth: 224, frameHeight: 252, margin: 8, spacing: 16 }, // the Wild Lands' animals (C.WILD.order rows of 12: tools/art/wild3q-import.js)
    wildshade: { frameWidth: 224, frameHeight: 252, margin: 8, spacing: 16 }, // the shadow under each of those frames
    wildgrass: { frameWidth: 320, frameHeight: 120 }, // grass before their feet: Pulag, Makiling, Magayon, 2 rows (tools/art/grass-import.js)
    kanor: { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 }, // Kanor the hunter, like the farmer
    tita_luz: { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 }, // the tailor, like Kanor (tools/art/tailor-import.js)
    looks_thumbs: { frameWidth: 128, frameHeight: 192, margin: 0, spacing: 0 }, // each look's front pose, boy then girl
    furn_thumbs: { frameWidth: 64, frameHeight: 128, margin: 0, spacing: 4 }, // each style's armchair (tools/art/cut-sheets.js)
    sidebtn: { frameWidth: 144, frameHeight: 144, margin: 8, spacing: 16 }, // the painted Quests, Online, Decorate and Chat buttons
    visitbtn: { frameWidth: 144, frameHeight: 144, margin: 8, spacing: 16 }, // the painted buttons of a visit's fan (19h-online.js)
    archer: { frameWidth: 288, frameHeight: 384, margin: 8, spacing: 16 }, // the farmer drawing a bow, 3 poses a way (tools/art/archer-import.js)
    archer_girl: { frameWidth: 288, frameHeight: 384, margin: 8, spacing: 16 },
    tw_crates: { frameWidth: 128, frameHeight: 128, margin: 8, spacing: 16 }, // the station's open crate, full crate, pallet (tools/art/station-import.js)
    tw_people: { frameWidth: 128, frameHeight: 192, margin: 8, spacing: 16 }, // the visitors off the train, 9 frames a row like the villagers
  };
  F.SHEETS = SHEETS; // (a hunting place adds its own creatures' and people's sheets: 19zzzzz-places.js)
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
    if (scene === F.world && scene.mapKey && !scene.busy) (F.mapNeeds[scene.mapKey] = F.mapNeeds[scene.mapKey] || {})[key] = true; // (what this map uses)
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
      if (!(F.keepBitmap && F.keepBitmap[key])) { // (kept: something paints from it soon, 19zz-breeding.js)
        bmp.close();
        delete F.bitmaps[key];
      }
    }
    if (key === 'people') F.makePeopleAnims(scene);
    if (SHEETS[key] && key.indexOf('player') === 0) F.makeWalkAnims(scene, key);
    return key;
  };

  // Decodes what the next map needs off the main thread while the screen fades out (travel), so its first upload is fast
  // (an <img> is decoded on the main thread the moment it is first drawn: 0.3-0.5 s for a town's worth on a slow phone);
  // ensureTexture uses the bitmap and closes it. The big sheets each map uses, then its props (from the map, as
  // buildObjects places them), then whatever else the map asked for the last time (F.mapNeeds: what was dropped since).
  var NEXT_MAP = { town: ['people', 'tita_luz', 'tw_station', 'tw_rails', 'tw_train', 'tw_crates', 'tw_people'], house: ['people', 'indoor'], mine: ['indoor'], lair: ['indoor', 'wild', 'wildshade', 'wildgrass'], pulag: ['wild', 'wildshade', 'wildgrass', 'kanor'], makiling: ['wild', 'wildshade', 'wildgrass'], magayon: ['wild', 'wildshade', 'wildgrass'], park: [], hall: ['indoor', 'furn_0'] }; // (park: Central Park, only its tiles and props; hall: its Hall of Fame inside, 19zzzz-rank.js)
  F.mapNeeds = {}; // map -> { texture key: true } made while that map was on screen
  var mapProps = function (map) {
    var s = F.session && F.session.state, raw = F.ASSETS.maps[map === 'house' && s ? 'house_' + s.home.level : map], out = [];
    if (!raw || !s) return out;
    var propSet = raw.tilesets.filter(function (ts) { return ts.name === 'props'; })[0], fest = F.Logic.festivalOn(s.day);
    var props = function (list) { var o = {}; (list || []).forEach(function (p) { o[p.name] = p.value; }); return o; };
    raw.tilesets.forEach(function (ts) { if (ts.name !== 'props') out.push(ts.name); });
    if (propSet) raw.layers.forEach(function (l) {
      (l.type === 'objectgroup' ? l.objects : []).forEach(function (o) {
        if (!o.gid) return;
        var p = Array.isArray(o.properties) ? props(o.properties) : o.properties || {};
        if ((p.requires && !s.builds[p.requires]) || (p.unless && s.builds[p.unless])) return;
        if (p.festival && !(fest && p.festival.split(',').indexOf(fest.key) >= 0)) return;
        var tile = propSet.tiles.filter(function (t) { return t.id === o.gid - propSet.firstgid; })[0];
        if (tile) out.push('props/' + tile.image.replace(/^.*\/|\.png$/g, ''));
      });
    });
    if (map === 'house') s.home.items.forEach(function (it) { out.push('furn_' + it.v); });
    return out;
  };
  // A picture's file as a Blob, kept for the session (its packed bytes, a tenth of the pixels or less): making it from the
  // data URL costs the main thread ~15 ms a MB on a slow phone, so that is paid once; decoding it again later is free.
  F.blobs = {};
  F.packUrls = F.packUrls || {}; // (a pack's picture: its data URL as it came, 10b-packs.js)
  var blobOf = function (k) {
    if (F.blobs[k]) return Promise.resolve(F.blobs[k]);
    var src = F.ASSETS.images[k] || F.packUrls[k];
    if (!src || src.indexOf('data:') !== 0) return Promise.reject(new Error('no data URL'));
    return fetch(src).then(function (r) { return r.blob(); }).then(function (b) { F.blobs[k] = b; return b; });
  };
  var decoding = {}; // key -> promise while its bitmap is made
  F.prewarmKey = function (k, scene) {
    if (!F.bitmaps || typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return null;
    if (F.bitmaps[k] || (scene && scene.textures.exists(k))) return null;
    if (decoding[k]) return decoding[k];
    var p = decoding[k] = blobOf(k)
      .then(function (b) { return createImageBitmap(b, { premultiplyAlpha: 'premultiply' }); })
      .then(function (b) {
        delete decoding[k];
        if (scene && scene.textures && scene.textures.exists(k)) b.close(); // it was needed before the bitmap was ready
        else { if (F.bitmaps[k]) F.bitmaps[k].close(); F.bitmaps[k] = b; }
      }, function () { delete decoding[k]; });
    return p;
  };
  // A bitmap decoded for a map that did not use it (a prop that is not out today) is let go after a while.
  F.dropBitmaps = function (scene) {
    if (!F.bitmaps || (scene && scene.busy)) return;
    Object.keys(F.bitmaps).forEach(function (k) { if (F.bitmaps[k]) { F.bitmaps[k].close(); delete F.bitmaps[k]; } });
  };
  // Every picture a map uses (as far as is known), and the ones of those not on the GPU yet.
  F.mapKeys = function (map) {
    var want = {};
    (NEXT_MAP[map] || []).concat(mapProps(map), Object.keys(F.mapNeeds[map] || {})).forEach(function (k) { want[k] = true; });
    return want;
  };
  F.mapWants = function (map, scene) {
    return Object.keys(F.mapKeys(map)).filter(function (k) { return F.images && F.images[k] && !scene.textures.exists(k); });
  };
  // Gets the next map's pictures onto the GPU while the screen fades out and stays dark: each decoded off the main thread
  // (their Blobs are made one a tick, so no single tick is long), then uploaded a few a frame (a bitmap uploads ~10x
  // faster than an <img>, which is decoded on the main thread first). Resolves when all are up, or could not be.
  F.prewarm = function (map, scene) {
    var keys = F.mapWants(map, scene), up = [], left = keys.length;
    // the Lair paints its cave from the indoor sheet the first time in (19zt-lair.js): from a bitmap, not the <img>
    var paint = map === 'lair' && !scene.textures.exists('indoor-lair') && F.images && F.images.indoor ? F.prewarmKey('indoor', null) : null;
    if (paint) { left++; paint.then(function () { finish(); }); }
    if (!left) return Promise.resolve();
    var finish;
    return new Promise(function (resolve) {
      finish = function () { if (--left <= 0) resolve(); };
      var upload = function () {
        var t0 = performance.now();
        while (up.length && performance.now() - t0 < 6) {
          var k = up.shift();
          try {
            if (!scene.textures.exists(k)) {
              F.ensureTexture(scene, k);
              (F.mapNeeds[map] = F.mapNeeds[map] || {})[k] = true;
            }
          } catch (e) { /* made when the map asks for it */ }
          finish();
        }
        if (up.length) requestAnimationFrame(upload);
      };
      var ready = function (k) { up.push(k); if (up.length === 1) requestAnimationFrame(upload); };
      var next = function (i) {
        if (i >= keys.length) return;
        var p = F.prewarmKey(keys[i], scene);
        if (p) p.then(function () { ready(keys[i]); }); else ready(keys[i]);
        setTimeout(function () { next(i + 1); }, 0);
      };
      next(0);
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

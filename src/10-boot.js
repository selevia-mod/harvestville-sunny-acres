// Registers the inlined images and Tiled maps with Phaser (no loader, no network), then starts the game.
(function (F) {
  'use strict';

  // Frames are padded in the sheets (8px margin, 16px gaps) so scaled-down sprites never bleed.
  var SHEETS = {
    player: { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 },
    crops: { frameWidth: 256, frameHeight: 256, margin: 8, spacing: 16 },
    items: { frameWidth: 128, frameHeight: 128, margin: 8, spacing: 16 },
    animals: { frameWidth: 384, frameHeight: 320, margin: 8, spacing: 16 },
  };

  // Shared between scenes: an event bus and the current touch/keyboard input.
  F.bus = new Phaser.Events.EventEmitter();
  F.input = {
    jx: 0, // joystick vector, -1..1
    jy: 0,
    action: false, // set by the action button, consumed by the world
    reset: function () {
      this.jx = this.jy = 0;
      this.action = false;
      if (F.ui) F.ui.releaseJoystick();
    },
  };

  F.BootScene = class extends Phaser.Scene {
    constructor() {
      super('Boot');
    }

    create() {
      var self = this;
      Object.keys(F.images).forEach(function (key) {
        if (SHEETS[key]) self.textures.addSpriteSheet(key, F.images[key], SHEETS[key]);
        else self.textures.addImage(key, F.images[key]);
      });
      Object.keys(F.ASSETS.maps).forEach(function (key) {
        self.cache.tilemap.add(key, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: F.ASSETS.maps[key] });
      });

      [['down', 0], ['up', 3], ['side', 6]].forEach(function (d) {
        var f = d[1];
        self.anims.create({
          key: 'walk-' + d[0],
          frames: self.anims.generateFrameNumbers('player', { frames: [f + 1, f, f + 2, f] }),
          frameRate: 8,
          repeat: -1,
        });
      });

      var saved = F.Host.load();
      F.session = { state: saved || F.Logic.newState(), dirty: false, isNew: !saved };
      this.scene.start('World');
      this.scene.launch('UI');
    }
  };
})(window.Farm = window.Farm || {});

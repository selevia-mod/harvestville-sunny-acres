// Decodes the inlined data-URL images, then boots Phaser.
(function (F) {
  'use strict';
  var C = F.Config;
  // Render at the screen's pixel density so the 256px art stays sharp. Layout stays 360x640.
  F.R = Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)));

  function decode(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not decode an inlined image')); };
      img.src = src;
    });
  }

  // World art is stored at half size (tools/art/draw.js): scaled back up here, so every frame keeps its size.
  function fullSize(img, size) {
    if (!size) return img;
    var c = document.createElement('canvas');
    c.width = size[0];
    c.height = size[1];
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, size[0], size[1]);
    return c;
  }

  var keys = Object.keys(F.ASSETS.images), sizes = F.ASSETS.sizes || {};
  Promise.all(keys.map(function (k) { return decode(F.ASSETS.images[k]); })).then(function (imgs) {
    F.images = {};
    keys.forEach(function (k, i) { F.images[k] = fullSize(imgs[i], sizes[k]); });
    F.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: C.WIDTH * F.R,
      height: C.HEIGHT * F.R,
      backgroundColor: '#2d4a22',
      antialias: true,
      roundPixels: false,
      banner: false,
      render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' }, // smooth downscaling of power-of-two sheets
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { debug: false } },
      input: { activePointers: 3 },
      scene: [F.BootScene, F.WorldScene, F.UIScene],
    });
    F.Host.attach(F.game);
  }).catch(function (err) {
    console.error(err);
  });
})(window.Farm = window.Farm || {});

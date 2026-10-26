// Decodes the inlined data-URL images, then boots Phaser.
(function (F) {
  'use strict';
  var C = F.Config;
  // Render at the screen's pixel density so the 256px art stays sharp. Layout stays 360x640. Android phones at 3x
  // draw at 2x (owner, 26 Oct: smoother first): less than half the pixels each frame, the biggest GPU saving on
  // budget phones, and the screen scales it up. iPhones keep their full density.
  var android = /Android/i.test((window.navigator && navigator.userAgent) || '');
  F.R = Math.max(1, Math.min(android ? 2 : 3, Math.round(window.devicePixelRatio || 1)));

  function decode(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not decode an inlined image')); };
      img.src = src;
    });
  }

  // World art is stored at half size (tools/art/draw.js) and goes to the GPU as it is (F.ensureTexture says its full
  // size). It used to be scaled back up on canvases here: ~370 MB of pixels kept for the whole session.
  // The first map's sheets are also decoded off the main thread (ImageBitmap), which makes their upload ~10x faster.
  var EAGER = ['player', 'fx', 'crops', 'items', 'animals', 'tiles', 'ranch', 'seasons'];
  F.bitmaps = {};
  var bitmaps = typeof createImageBitmap === 'function' && typeof fetch === 'function' ? EAGER.filter(function (k) { return F.ASSETS.images[k]; }).map(function (k) {
    return fetch(F.ASSETS.images[k]).then(function (r) { return r.blob(); })
      .then(function (b) { return createImageBitmap(b, { premultiplyAlpha: 'premultiply' }); })
      .then(function (b) { F.bitmaps[k] = b; }, function () { /* the <img> is used instead */ });
  }) : [];
  var keys = Object.keys(F.ASSETS.images);
  F.sizes = F.ASSETS.sizes || {};
  Promise.all(keys.map(function (k) { return decode(F.ASSETS.images[k]); }).concat(bitmaps)).then(function (imgs) {
    F.images = {};
    keys.forEach(function (k, i) { F.images[k] = imgs[i]; });
    F.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: C.WIDTH * F.R,
      height: C.VIEW_H * F.R, // taller phones get a taller view (00-config.js)
      backgroundColor: '#2d4a22',
      antialias: true,
      antialiasGL: false, // no 4x MSAA on the canvas: flat 2D sprites gain nothing from it, the GPU pays every frame
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

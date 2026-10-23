// Decodes the inlined data-URL images, then boots Phaser.
(function (F) {
  'use strict';
  var C = F.Config;

  function decode(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not decode an inlined image')); };
      img.src = src;
    });
  }

  var keys = Object.keys(F.ASSETS.images);
  Promise.all(keys.map(function (k) { return decode(F.ASSETS.images[k]); })).then(function (imgs) {
    F.images = {};
    keys.forEach(function (k, i) { F.images[k] = imgs[i]; });
    F.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: C.WIDTH,
      height: C.HEIGHT,
      backgroundColor: '#2d4a22',
      pixelArt: true,
      roundPixels: true,
      banner: false,
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

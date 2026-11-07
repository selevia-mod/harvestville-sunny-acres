// The icon of Haliya's Moon Bow (8 Nov 2026), until a painted one replaces it: the Gold Bow's own picture made moon
// silver (the wood pearl-white, the gold silver, a pale blue light round it, a little crescent on the grip), so it reads
// as the same bow, two levels up, as the Magma Bow does (lair-icons.js). Runs after draw.js; tools/art/icons-fill.js
// paints it into the items sheet (ICON_FROM: the picture it starts from, loaded before it draws).
(function () {
  'use strict';
  var A = window.ART;
  var D = A.ICON_DRAW;
  A.ICON_FROM = A.ICON_FROM || {};
  A.ICON_FROM.bow_5 = 'bow_3';
  A.IMG = A.IMG || {};

  function moonFromGoldBow(g, im) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var h = c.getContext('2d', { willReadFrequently: true });
    h.drawImage(im, 0, 0, 128, 128);
    var d = h.getImageData(0, 0, 128, 128), q = d.data;
    var mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
    var ramp = function (stops, t) {
      t = Math.max(0, Math.min(1, t));
      for (var i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
      return stops[stops.length - 1][1];
    };
    var PEARL = [[0, [70, 82, 110]], [0.45, [150, 166, 196]], [0.8, [214, 226, 244]], [1, [252, 254, 255]]]; // the wood: pearl
    var SILVER = [[0, [96, 110, 140]], [0.5, [186, 200, 226]], [0.85, [236, 244, 255]], [1, [255, 255, 255]]]; // the gold: silver
    for (var i = 0; i < q.length; i += 4) {
      if (!q[i + 3]) continue;
      var r = q[i], gr = q[i + 1], b = q[i + 2], mx = Math.max(r, gr, b), mn = Math.min(r, gr, b), l = mx / 255, s = mx ? (mx - mn) / mx : 0;
      var hue = 0;
      if (mx !== mn) {
        if (mx === r) hue = ((gr - b) / (mx - mn)) % 6; else if (mx === gr) hue = (b - r) / (mx - mn) + 2; else hue = (r - gr) / (mx - mn) + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      var out;
      if (l < 0.22) out = [30, 36, 64]; // the outline: night blue
      else if (s < 0.3 && l > 0.6) out = [236, 246, 255]; // the string
      else if (hue >= 37 && hue < 70) out = ramp(SILVER, Math.pow(l, 0.9));
      else out = ramp(PEARL, Math.pow(l, 1.2));
      q[i] = out[0]; q[i + 1] = out[1]; q[i + 2] = out[2];
    }
    h.putImageData(d, 0, 0);
    g.save();
    g.shadowColor = 'rgba(190,220,255,0.95)'; // the moon's light round the whole bow
    g.shadowBlur = 12;
    g.drawImage(c, 0, 0);
    g.restore();
    // a small crescent moon on the grip (ICON.grip in 19w-bow.js: 58, 54), cut on its own canvas
    var m = document.createElement('canvas');
    m.width = m.height = 128;
    var k = m.getContext('2d');
    k.beginPath();
    k.arc(58, 54, 9, 0, Math.PI * 2);
    k.fillStyle = '#fffbea';
    k.fill();
    k.globalCompositeOperation = 'destination-out';
    k.beginPath();
    k.arc(62, 51, 8, 0, Math.PI * 2);
    k.fill();
    g.save();
    g.shadowColor = 'rgba(220,236,255,1)';
    g.shadowBlur = 6;
    g.drawImage(m, 0, 0);
    g.restore();
  }
  D.bow_5 = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (A.IMG.bow_3) moonFromGoldBow(g, A.IMG.bow_3);
  };
})();

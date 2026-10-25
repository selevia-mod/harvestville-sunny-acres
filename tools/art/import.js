// Turns generated pictures (art-src/, listed in tools/art-manifest.js) into game-ready pieces: removes a flat
// background, splits grids into cells, trims, scales and lines things up (feet on the ground line), and
// makes ground textures seamless. The results go in window.ART.OVR, keyed the way makeArt() looks them up.
(function () {
  'use strict';
  var A = window.ART;
  A.OVR = {};
  var S = 256;

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function load(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('could not read image')); };
      img.src = src;
    });
  }

  // ---------- background removal ----------
  // Pictures with real transparency are kept as they are. Otherwise the flat colour touching the border
  // (magenta, white, anything even) is flood-filled away, with a soft edge and magenta spill removed.
  function cutout(img) {
    var c = canvas(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    var W = c.width, H = c.height, d = g.getImageData(0, 0, W, H), px = d.data;
    var border = 0, clear = 0;
    for (var x = 0; x < W; x += 4) [0, H - 1].forEach(function (y) { border++; if (px[(y * W + x) * 4 + 3] < 32) clear++; });
    for (var y = 0; y < H; y += 4) [0, W - 1].forEach(function (x) { border++; if (px[(y * W + x) * 4 + 3] < 32) clear++; });
    if (clear / border > 0.3) return c; // already transparent
    var corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(function (p) { var i = (p[1] * W + p[0]) * 4; return [px[i], px[i + 1], px[i + 2]]; });
    var key = [0, 1, 2].map(function (k) { return corners.reduce(function (s, cc) { return s + cc[k]; }, 0) / 4; });
    var magenta = key[0] > 180 && key[1] < 90 && key[2] > 180;
    var dist = function (i) { return Math.abs(px[i] - key[0]) + Math.abs(px[i + 1] - key[1]) + Math.abs(px[i + 2] - key[2]); };
    var TOL = magenta ? 150 : 60, SOFT = magenta ? 260 : 120;
    var seen = new Uint8Array(W * H), stack = [];
    for (x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
    for (y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
    while (stack.length) {
      var p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      var i = p * 4, dd = dist(i);
      if (dd > SOFT) continue;
      px[i + 3] = dd < TOL ? 0 : Math.round(px[i + 3] * (dd - TOL) / (SOFT - TOL));
      if (dd >= TOL) continue; // an edge pixel: soften it, but don't flood past it
      var xx = p % W, yy = (p - xx) / W;
      if (xx > 0) stack.push(p - 1);
      if (xx < W - 1) stack.push(p + 1);
      if (yy > 0) stack.push(p - W);
      if (yy < H - 1) stack.push(p + W);
    }
    if (magenta) { // pink fringe left on soft edges
      for (i = 0; i < px.length; i += 4) {
        if (px[i + 3] && px[i] > px[i + 1] + 60 && px[i + 2] > px[i + 1] + 60) {
          var m = Math.min(px[i], px[i + 2]) - px[i + 1];
          px[i] -= m * 0.6;
          px[i + 2] -= m * 0.6;
        }
      }
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  // Bounding box of the visible pixels in a region of a canvas.
  function bbox(c, rx, ry, rw, rh) {
    var px = c.getContext('2d').getImageData(rx, ry, rw, rh).data, x0 = rw, y0 = rh, x1 = -1, y1 = -1;
    for (var y = 0; y < rh; y++) for (var x = 0; x < rw; x++) {
      if (px[(y * rw + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    return x1 < 0 ? null : { x: rx + x0, y: ry + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // Splits a picture into cols x rows cells. Uses the empty gaps between items when it can find exactly
  // the right number of them (generated grids are rarely perfectly even), else equal cells.
  function cells(c, cols, rows) {
    var W = c.width, H = c.height, px = c.getContext('2d').getImageData(0, 0, W, H).data;
    var runs = function (n, len, filled) {
      var out = [], start = -1;
      for (var k = 0; k <= len; k++) {
        var on = k < len && filled(k);
        if (on && start < 0) start = k;
        if (!on && start >= 0) { if (k - start > len * 0.03) out.push([start, k]); start = -1; }
      }
      return out.length === n ? out : null;
    };
    var colRuns = runs(cols, W, function (x) { for (var y = 0; y < H; y += 2) if (px[(y * W + x) * 4 + 3] > 24) return true; return false; });
    var rowRuns = runs(rows, H, function (y) { for (var x = 0; x < W; x += 2) if (px[(y * W + x) * 4 + 3] > 24) return true; return false; });
    var out = [];
    for (var r = 0; r < rows; r++) for (var k = 0; k < cols; k++) {
      var cx = colRuns ? colRuns[k][0] : Math.round(k * W / cols), cw = colRuns ? colRuns[k][1] - colRuns[k][0] : Math.round(W / cols);
      var cy = rowRuns ? rowRuns[r][0] : Math.round(r * H / rows), ch = rowRuns ? rowRuns[r][1] - rowRuns[r][0] : Math.round(H / rows);
      out.push(bbox(c, cx, cy, cw, ch));
    }
    return out;
  }

  // Draws part of a canvas into a new w x h canvas at scale s: centred, bottom on `base` (or centred if base is null).
  function place(src, b, w, h, s, base) {
    var out = canvas(w, h), g = out.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    var dw = b.w * s, dh = b.h * s, dy = base == null ? (h - dh) / 2 : base - dh;
    g.drawImage(src, b.x, b.y, b.w, b.h, (w - dw) / 2, dy, dw, dh);
    return out;
  }

  function fit(src, b, w, h, frac, base) {
    var s = Math.min(w * frac / b.w, (base == null ? h * frac : base * frac) / b.h);
    return place(src, b, w, h, s, base);
  }

  // A seamless 256 texture: the picture in the middle, blended toward a half-offset copy at the edges
  // (whose borders are the picture's own interior, so neighbouring tiles join without a seam).
  // Pictures that already repeat cleanly along an axis are left alone on it; `only` = 'x' blends just the left
  // and right edges (for a wall strip that is not meant to repeat up and down).
  function texture(img, only) {
    var c = canvas(S, S), g = c.getContext('2d'), side = Math.min(img.width, img.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    var a = g.getImageData(0, 0, S, S), d = a.data;
    // edge mismatch compared with how much neighbouring rows / columns differ anyway
    var diff = function (p, q) { return Math.abs(d[p] - d[q]) + Math.abs(d[p + 1] - d[q + 1]) + Math.abs(d[p + 2] - d[q + 2]); };
    var seam = function (horizontal) {
      var edge = 0, inner = 0;
      for (var k = 0; k < S; k++) {
        var at = function (u, v) { return ((horizontal ? k : u) * S + (horizontal ? u : k)) * 4; };
        edge += diff(at(0, 0), at(S - 1, 0));
        inner += diff(at(S / 2, 0), at(S / 2 + 1, 0));
      }
      return edge > inner * 2.5;
    };
    var bx = seam(true), by = only !== 'x' && seam(false);
    if (!bx && !by) return c;
    var o = canvas(S, S), og = o.getContext('2d');
    var dx = bx ? S / 2 : 0, dy = by ? S / 2 : 0;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { og.drawImage(c, q[0] * dx, q[1] * dy); });
    var b = og.getImageData(0, 0, S, S), BAND = 72;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var e = Math.min(bx ? Math.min(x, S - 1 - x) : S, by ? Math.min(y, S - 1 - y) : S), t = Math.min(1, e / BAND);
      t = t * t * (3 - 2 * t);
      var i = (y * S + x) * 4;
      for (var k = 0; k < 3; k++) d[i + k] = d[i + k] * t + b.data[i + k] * (1 - t);
      d[i + 3] = 255;
    }
    g.putImageData(a, 0, 0);
    return c;
  }

  // Dry and wet tilled soil must read apart at a glance: dry turns light and dusty, wet turns dark and
  // glistens (small cool highlights on the tops of the furrows).
  function soilTone(c, tone) {
    var g = c.getContext('2d'), a = g.getImageData(0, 0, S, S), d = a.data, n = S * S, i, k;
    var lum = new Float32Array(n), mean = 0;
    for (i = 0; i < n; i++) { lum[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]; mean += lum[i] / n; }
    var sorted = Array.prototype.slice.call(lum).sort(function (x, y) { return x - y; }), top = sorted[Math.floor(n * 0.93)];
    for (i = 0; i < n; i++) {
      var p = i * 4, rel = lum[i] / mean; // keep the texture's own light and shade
      if (tone === 'dry') { // light sandy brown
        var base = [170, 118, 74];
        for (k = 0; k < 3; k++) d[p + k] = Math.min(255, base[k] * (0.4 + 0.6 * rel));
      } else { // dark, rich, a little cool
        var wet = [74, 42, 30];
        for (k = 0; k < 3; k++) d[p + k] = Math.min(255, wet[k] * (0.6 + 0.4 * rel));
        if (lum[i] >= top) { // glints of water on the ridges
          var t = Math.min(1, (lum[i] - top) / 25 + 0.45);
          d[p] += (190 - d[p]) * t * 0.6;
          d[p + 1] += (215 - d[p + 1]) * t * 0.6;
          d[p + 2] += (235 - d[p + 2]) * t * 0.6;
        }
      }
    }
    g.putImageData(a, 0, 0);
  }

  // Shifts a texture's average colour to another's, so two variants laid side by side don't make a checkerboard.
  function matchColour(c, ref) {
    var mean = function (cv) {
      var d = cv.getContext('2d').getImageData(0, 0, S, S).data, m = [0, 0, 0];
      for (var i = 0; i < d.length; i += 4) for (var k = 0; k < 3; k++) m[k] += d[i + k];
      return m.map(function (v) { return v / (S * S); });
    };
    var want = mean(ref), have = mean(c), g = c.getContext('2d'), a = g.getImageData(0, 0, S, S);
    for (var i = 0; i < a.data.length; i += 4) for (var k = 0; k < 3; k++) a.data[i + k] = a.data[i + k] * want[k] / Math.max(1, have[k]);
    g.putImageData(a, 0, 0);
  }

  // how much of the tile each one-tile object fills
  var OBJ_FIT = { rock: 0.62, stump: 0.7, d_weed: 0.72, d_branch: 0.82, d_stone: 0.5, d_stump: 0.86, d_boulder: 0.9, mine_rock: 0.8, fence_post: 0.8, sign: 0.8, shipbox: 0.84, hay: 0.9, trough: 0.9, ladder_down: 0.95, ladder_up: 0.95 };

  // jobs: [{ ...manifest job, data: data URL }]
  A.prepareOverrides = function (jobs) {
    var O = A.OVR;
    // one at a time: the pictures are big, and decoding them all at once runs the browser out of memory
    return jobs.reduce(function (done, j) { return done.then(function () { return one(j); }); }, Promise.resolve());
    function one(j) {
      return load(j.data).then(function (img) {
        if (j.mode === 'texture') {
          var t = texture(img, j.wrap);
          if (j.match && O[j.match]) matchColour(t, O[j.match]);
          if (j.tone) soilTone(t, j.tone);
          j.targets.forEach(function (k) { O[k] = t; });
          return;
        }
        if (j.mode === 'yardtex') { // path swatches: each becomes a seamless tile
          var yg = cells(cutout(img), j.cols, j.rows);
          j.names.forEach(function (name, k) {
            var b = yg[k];
            if (!b) throw new Error(j.file + ': swatch ' + (k + 1) + ' (' + name + ') is missing');
            var inset = Math.round(Math.min(b.w, b.h) * 0.04), sw = canvas(b.w - 2 * inset, b.h - 2 * inset);
            sw.getContext('2d').drawImage(img, b.x + inset, b.y + inset, sw.width, sw.height, 0, 0, sw.width, sw.height);
            O['yard:' + name] = texture(sw);
          });
          return;
        }
        if (j.mode === 'surf') { // swatches of wallpaper or floor: each becomes a seamless tile
          var sg = cells(cutout(img), j.cols, j.rows);
          j.styles.forEach(function (v, k) {
            var b = sg[k];
            if (!b) throw new Error(j.file + ': swatch ' + (k + 1) + ' is missing');
            var inset = Math.round(Math.min(b.w, b.h) * 0.04), sw = canvas(b.w - 2 * inset, b.h - 2 * inset);
            sw.getContext('2d').drawImage(img, b.x + inset, b.y + inset, sw.width, sw.height, 0, 0, sw.width, sw.height);
            O['surf:' + j.kind + ':' + v] = texture(sw);
          });
          return;
        }
        var c = cutout(img), whole = bbox(c, 0, 0, c.width, c.height);
        if (!whole) throw new Error(j.file + ': the picture is empty after removing its background');
        var name = j.id.replace(/^obj_/, '');
        if (j.mode === 'sprite') O[j.targets[0]] = fit(c, whole, S, S, OBJ_FIT[name] || 0.9, 246);
        else if (j.mode === 'fill') {
          var horizontal = name === 'fence_h';
          var s = horizontal ? S / whole.w : S / whole.h;
          O[j.targets[0]] = place(c, whole, S, S, s, horizontal ? 236 : null);
        } else if (j.mode === 'block') O[j.targets[0]] = fit(c, whole, j.w * S, j.h * S, 1, j.id === 'building_pond' ? null : j.h * S);
        else if (j.mode === 'prop') O[j.targets[0]] = fit(c, whole, j.w * S, j.h * S, 0.98, PROPS_FLAT[name.replace(/^prop_/, '')] ? null : j.h * S - 4);
        else if (j.mode === 'season4' || j.mode === 'tree4') {
          var cs = cells(c, 2, 2), size = j.mode === 'tree4' ? 2 * S : S;
          ['spring', 'summer', 'fall', 'winter'].forEach(function (season, k) {
            if (!cs[k]) throw new Error(j.file + ': no picture found for ' + season);
            O[(j.mode === 'tree4' ? 'tree:' : 'season:' + j.kind + ':') + season] = fit(c, cs[k], size, size, 0.96, size - 8);
          });
        } else if (j.mode === 'frames') frames(j, c);
        else if (j.mode === 'icons') {
          var ic = cells(c, 4, 4);
          j.names.forEach(function (n, k) {
            if (!ic[k]) throw new Error(j.file + ': icon ' + (k + 1) + ' (' + n + ') is missing');
            O['icon:' + n] = fit(c, ic[k], 128, 128, 0.88, null);
          });
        } else if (j.mode === 'icon') O['icon:' + j.name] = fit(c, whole, 128, 128, 0.88, null);
        else if (j.mode === 'yard') { // a grid of outdoor pieces, each sized to its tiles (half resolution)
          var pc = cells(c, j.cols, j.rows);
          j.pieces.forEach(function (pz, k) {
            var b = pc[k];
            if (!b) throw new Error(j.file + ': piece ' + (k + 1) + ' (' + pz.name + ') is missing');
            var W = pz.w * 128, H = pz.h * 128;
            O['yard:' + pz.name] = pz.fill ? place(c, b, W, H, Math.min(W / b.w, H / b.h), H) : fit(c, b, W, H, 0.96, H - 2);
          });
        } else if (j.mode === 'furn') { // a grid of furniture: each piece sized to its tiles (half resolution)
          var gc = cells(c, j.cols, j.rows);
          j.dims.forEach(function (type, k) {
            var b = gc[k];
            if (!b) throw new Error(j.file + ': piece ' + (k + 1) + ' (' + type.key + ') is missing');
            var W = type.w * 128, H = type.h * 128;
            O['furn:' + j.v + ':' + j.types[k]] = fit(c, b, W, H, 0.96, type.place === 'floor' ? H - 2 : null);
          });
        } else if (j.mode === 'fx') {
          var fc = cells(c, 2, 2);
          fc.forEach(function (b, k) {
            if (!b) throw new Error(j.file + ': piece ' + (k + 1) + ' is missing');
            O['fx:' + j.kind + ':' + k] = fit(c, b, 128, 128, 0.92, null);
          });
        }
      }).catch(function (e) { throw new Error(j.file + ': ' + e.message); });
    }
  };
  var PROPS_FLAT = { rug: 1, doormat: 1, cat_bed: 1 };

  // Animation frames: one scale for the whole set (so the character doesn't grow and shrink), feet on the base line.
  function frames(j, c) {
    var cs = cells(c, j.cols, j.rows), n = j.cols * j.rows;
    cs.slice(0, n).forEach(function (b, k) { if (!b) throw new Error(j.file + ': frame ' + (k + 1) + ' is empty'); });
    var s = Math.min.apply(null, cs.slice(0, n).map(function (b) { return Math.min(j.fw * 0.94 / b.w, j.base * 0.96 / b.h); })) * (j.size || 1);
    cs.slice(0, n).forEach(function (b, k) {
      var f = place(c, b, j.fw, j.fh, s, j.base), key;
      if (j.sheet === 'animals' || j.sheet === 'animals2') key = j.sheet + ':' + j.row + ':' + k;
      else key = j.sheet + ':' + j.frames[k];
      A.OVR[key] = f;
    });
    if (j.icon) A.OVR['icon:' + j.icon] = fit(c, cs[0], 128, 128, 0.9, null);
  }
})();

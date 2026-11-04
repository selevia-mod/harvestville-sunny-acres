'use strict';
// Bakunawa's Lair in the world (5 Nov 2026; prompts 7-13 in art-src/LAIR-PROMPTS.md, pictures in art-src/lair/): the
// pictures that take the place of what src/19zt-lair.js drew and painted until they came.
//   assets/props/lair_mouth.*  the cave mouth on Magayon, at 160 px a tile (like Magayon's other props), standing on its
//                              bottom edge
//   assets/props/lair_gate.*   the gate down: closed on the left, open on the right, the same size and place in each half
//                              (19zt-lair.js cuts the two frames: GATE_FRAMES below)
//   assets/lair_cave.*         the cave's tiles, one 128 px tile each (the indoor sheet's own size), in this order:
//                              cave, cave2, cave_wall, cave_top, void (lava, under the pools), then the lava again at
//                              192 px, the pattern the pools are filled with (2 tiles a repeat: the crust plates read as
//                              plates, not crumbs). The game paints them over the Mine's cave tiles in its own copy of the
//                              indoor sheet, so the Mine and its bands keep theirs.
//   art-src/furniture/volcano_<piece>.png  the Volcano set's five pieces, cut out and kept for later: no Volcano style or
//                              pieces exist in the game yet (src/00-home.js), so nothing is wired.
// Each 1024 texture is scaled down whole to one tile. They came nearly seamless; what little the edges miss is evened out
// in the small copy (each row's mismatch across the wrap shared between the two sides, fading in over a quarter of the
// tile), so copies side by side show no line. cave2 is the floor with another part of the same stone in its middle and
// the very same edges, so the two kinds of floor tile sit side by side in any order.
// node tools/art/lair-world-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'lair');
const FURN = path.join(ROOT, 'art-src', 'furniture');
const OUT = path.join(ROOT, 'assets');
const PPT = 160, TILE = 128, LAVA = 192;
const MOUTH_W = 3.7; // tiles wide (19zt-lair.js MOUTH.w); its height follows the picture
const GATE_W = 2; // tiles wide, each half (the gate is 2 tiles by 2 on the cave floor)
const VOLCANO = ['volcano_fireplace', 'volcano_lava_lamp', 'volcano_armchair', 'volcano_rug', 'volcano_model'];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (name, r) => {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(('assets/' + name).padEnd(26), r.w + 'x' + r.h, (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
};
const need = (f) => { if (!fs.existsSync(f)) throw new Error('no ' + path.relative(ROOT, f) + ' yet'); return data(f); };

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });

  // ---------- the cave mouth ----------
  const mouth = await p.evaluate(async ([src, w]) => {
    const x = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0], h = Math.round(w * x.h / x.w), o = W.canvas(w, h);
    W.draw(o.getContext('2d'), x.c, x, w / x.w, w / 2, h);
    return Object.assign(W.out(o, 0.85), { w, h });
  }, [need(path.join(SRC, 'lair_mouth.png')), Math.round(MOUTH_W * PPT)]);
  save('props/lair_mouth', mouth);

  // ---------- the gate: both halves at one scale, each centred, standing on the same line ----------
  const gate = await p.evaluate(async ([src, fw]) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 1, 0.02);
    if (!cl[0] || !cl[1]) throw new Error('the gate needs both halves');
    const k = fw / Math.max(cl[0].w, cl[1].w), fh = Math.ceil(Math.max(cl[0].h, cl[1].h) * k), GAP = 4, o = W.canvas(fw * 2 + GAP, fh), g = o.getContext('2d');
    cl.forEach((x, i) => W.draw(g, x.c, x, k, i * (fw + GAP) + fw / 2, fh));
    return Object.assign(W.out(o, 0.85), { w: o.width, h: fh, fw, gap: GAP });
  }, [need(path.join(SRC, 'lair_gate.png')), GATE_W * PPT]);
  save('props/lair_gate', gate);
  console.log('  gate frames: ' + gate.fw + 'x' + gate.h + ' at x 0 and ' + (gate.fw + gate.gap) + ' (19zt-lair.js GATE_FRAMES)');

  // ---------- the cave's tiles ----------
  const cave = await p.evaluate(async ([floor, lava, top, face, T, LV]) => {
    // the whole picture in an S x S copy, its edges evened out across the wrap (sideways only for the wall's face)
    const small = (img, S, both) => {
      const c = W.canvas(S, S), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, S, S);
      const im = g.getImageData(0, 0, S, S), d = im.data, band = S / 4;
      const even = (along) => { // along x: each row's left and right edges meet; along y: each column's top and bottom
        for (let a = 0; a < S; a++) {
          const i0 = along ? (a * S) * 4 : a * 4, i1 = along ? (a * S + S - 1) * 4 : ((S - 1) * S + a) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const e = (d[i1 + ch] - d[i0 + ch]) / 2;
            for (let t = 0; t < band; t++) {
              const f = 1 - t / band, j0 = along ? (a * S + t) * 4 : (t * S + a) * 4, j1 = along ? (a * S + S - 1 - t) * 4 : ((S - 1 - t) * S + a) * 4;
              d[j0 + ch] += e * f;
              d[j1 + ch] -= e * f;
            }
          }
        }
      };
      even(true);
      if (both) even(false);
      g.putImageData(im, 0, 0);
      return c;
    };
    // the same tile with another part of its stone in the middle: the copy moved by half (it wraps, so it is just as
    // seamless) shows through away from the edges, which stay the tile's own
    const variant = (c) => {
      const S = c.width, o = W.canvas(S, S), g = o.getContext('2d'), sh = W.canvas(S, S), sg = sh.getContext('2d');
      [[-1, -1], [0, -1], [-1, 0], [0, 0]].forEach((q) => sg.drawImage(c, S / 2 + q[0] * S, S / 2 + q[1] * S));
      g.drawImage(c, 0, 0);
      const a = g.getImageData(0, 0, S, S), bb = sg.getImageData(0, 0, S, S), A = a.data, B = bb.data;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const e = Math.min(x, S - 1 - x, y, S - 1 - y) / (S * 0.3), w = Math.min(1, e), k = w * w * (3 - 2 * w), i = (y * S + x) * 4;
        for (let ch = 0; ch < 3; ch++) A[i + ch] = Math.round(A[i + ch] * (1 - k) + B[i + ch] * k);
      }
      g.putImageData(a, 0, 0);
      return o;
    };
    const fl = small(await W.load(floor), T, true), lv = await W.load(lava);
    const tiles = [fl, variant(fl), small(await W.load(face), T, false), small(await W.load(top), T, true), small(lv, T, true), small(lv, LV, true)];
    const o = W.canvas(T * 5 + LV, LV), g = o.getContext('2d');
    tiles.forEach((c, i) => g.drawImage(c, i * T, 0));
    // (webp at 0.9: the stone's fine grain is what makes it read as stone)
    return Object.assign(W.out(o, 0.9), { w: o.width, h: o.height });
  }, [need(path.join(SRC, 'cave_floor.png')), need(path.join(SRC, 'cave_lava.png')), need(path.join(SRC, 'cave_rock_top.png')), need(path.join(SRC, 'cave_rock_face.png')), TILE, LAVA]);
  save('lair_cave', cave);

  // ---------- the Volcano furniture: cut out for later (no Volcano style in the game yet) ----------
  const volcano = path.join(FURN, 'volcano.png');
  if (fs.existsSync(volcano)) {
    const pieces = await p.evaluate(async (src) => W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 2, 0.02).map((x) => {
      if (!x) return null;
      const o = W.canvas(x.w + 16, x.h + 16);
      o.getContext('2d').drawImage(x.c, 8, 8);
      return o.toDataURL('image/png');
    }), data(volcano));
    VOLCANO.forEach((n, i) => {
      if (!pieces[i]) throw new Error(n + ' is missing');
      fs.writeFileSync(path.join(FURN, n + '.png'), Buffer.from(pieces[i].split(',')[1], 'base64'));
    });
    console.log('art-src/furniture/' + VOLCANO.join('.png, ') + '.png');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });

'use strict';
// The Open Plains' pictures (owner, 18 Nov 2026; art-src/MANILA-PROMPTS.md batch 3, saved in art-src/manila/plains/; the
// Plainsrunner set's icons are row 1 of art-src/manila/icons_manila_gear.png) into the game's sizes, for the 'plains'
// download pack (tools/manila/plains-art.js, tools/packs.js). Each part runs when its picture is there; the rest keep
// their stand-ins in the game. The creatures: node tools/art/animals3q-import.js plains (their own sheets, as every place's).
//   assets/props/plains_mouth.*, plains_gate.*, assets/plains_cave.*   the cave's mouth, gate and tiles (as places-import.js)
//   assets/ground_plains.*, ground_plains_water.*                      two seamless 256 px textures (the map's grass, the pond)
//   assets/props/plains_<kind>.*                                       the 12 props (C.PLAINS.kinds), 2.5 tiles wide
//   assets/plains_icons.*                                              the 20 icons (C.PLAINS_ICONS), 8 a row of 128
// Then: node build.js (the pack's files come out in dist/packs/, for the CDN's app-assets/packs/). The page does not grow.
// node tools/manila/plains-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { config } = require('./plains-art');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'manila', 'plains');
const OUT = path.join(ROOT, 'assets');
const C = config(), P = C.PLACES.plains;
const PPT = 160, TILE = 128, POOL = 192, MOUTH_W = 3.7, GATE_W = 2;

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const pic = (name) => { const f = path.join(SRC, name); return fs.existsSync(f) ? data(f) : null; };
const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true }); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
const save = (name, r) => {
  put(name + '.png', r.png);
  const n = put(name + '.webp', r.webp);
  console.log(('assets/' + name).padEnd(34), (r.w ? r.w + 'x' + r.h : '').padEnd(10), (n / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  if (!fs.existsSync(SRC)) { console.log('No art-src/manila/plains/ yet: nothing to do (the game keeps its stand-ins).'); return; }
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('../art/wild-lib') });
  const done = [], art = P.dungeon.art;

  // ---------- the cave: mouth, gate (closed | open), tiles ----------
  const mouth = pic('plains_mouth.png');
  if (mouth) {
    save(art.mouth, await p.evaluate(async ([src, w]) => {
      const x = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0], h = Math.round(w * x.h / x.w), o = W.canvas(w, h);
      W.draw(o.getContext('2d'), x.c, x, w / x.w, w / 2, h);
      return Object.assign(W.out(o, 0.85), { w, h });
    }, [mouth, Math.round(MOUTH_W * PPT)]));
    done.push('mouth');
  }
  const gate = pic('plains_gate.png');
  if (gate) {
    save(art.gate, await p.evaluate(async ([src, fw]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 1, 0.02);
      if (!cl[0] || !cl[1]) throw new Error('the gate needs both halves');
      const k = fw / Math.max(cl[0].w, cl[1].w), fh = Math.ceil(Math.max(cl[0].h, cl[1].h) * k), GAP = 4, o = W.canvas(fw * 2 + GAP, fh), g = o.getContext('2d');
      cl.forEach((x, i) => W.draw(g, x.c, x, k, i * (fw + GAP) + fw / 2, fh));
      return Object.assign(W.out(o, 0.85), { w: o.width, h: fh });
    }, [gate, GATE_W * PPT]));
    done.push('gate');
  }
  const caveParts = ['plains_cave_floor.png', 'plains_cave_water.png', 'plains_cave_rock_top.png', 'plains_cave_rock_face.png'].map(pic);
  if (caveParts.every(Boolean)) {
    save(art.cave, await p.evaluate(async ([floor, water, top, face, S, LV]) => {
      // a picture scaled down whole to one tile, its edges evened out across the wrap (as places-import.js)
      const small = (img, N, both) => {
        const c = W.canvas(N, N), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, N, N);
        const im = g.getImageData(0, 0, N, N), d = im.data, band = N / 4;
        (both ? [true, false] : [true]).forEach((along) => {
          for (let a = 0; a < N; a++) {
            const i0 = along ? (a * N) * 4 : a * 4, i1 = along ? (a * N + N - 1) * 4 : ((N - 1) * N + a) * 4;
            for (let ch = 0; ch < 3; ch++) {
              const e = (d[i1 + ch] - d[i0 + ch]) / 2;
              for (let t = 0; t < band; t++) {
                const f = 1 - t / band, j0 = along ? (a * N + t) * 4 : (t * N + a) * 4, j1 = along ? (a * N + N - 1 - t) * 4 : ((N - 1 - t) * N + a) * 4;
                d[j0 + ch] += e * f;
                d[j1 + ch] -= e * f;
              }
            }
          }
        });
        g.putImageData(im, 0, 0);
        return c;
      };
      const fl = small(await W.load(floor), S, true), wt = await W.load(water), v = W.canvas(S, S), vg = v.getContext('2d');
      [[-1, -1], [0, -1], [-1, 0], [0, 0]].forEach((q) => vg.drawImage(fl, S / 2 + q[0] * S, S / 2 + q[1] * S));
      const tiles = [fl, v, small(await W.load(face), S, false), small(await W.load(top), S, true), small(wt, S, true), small(wt, LV, true)];
      const o = W.canvas(S * 5 + LV, LV), g = o.getContext('2d');
      tiles.forEach((c, i) => g.drawImage(c, i * S, 0));
      return Object.assign(W.out(o, 0.9), { w: o.width, h: o.height });
    }, caveParts.concat([TILE, POOL])));
    done.push('cave tiles');
  }

  // ---------- the ground: two seamless textures ----------
  for (const [file, key] of [['ground_plains.png', 'ground_plains'], ['ground_plains_water.png', 'ground_plains_water']]) {
    const src = pic(file);
    if (!src) continue;
    save(key, await p.evaluate(async ([s, S]) => {
      const img = await W.load(s), c = W.canvas(S, S), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, S, S);
      const im = g.getImageData(0, 0, S, S), d = im.data, band = S / 4;
      [true, false].forEach((along) => {
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
      });
      g.putImageData(im, 0, 0);
      return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.85), w: S, h: S };
    }, [src, 256]));
    done.push(key);
  }

  // ---------- the 12 props: two 3 x 2 sheets, in C.PLAINS.kinds' order ----------
  const kinds = C.PLAINS.kinds;
  for (const [file, from] of [['props_plains.png', 0], ['props_plains_2.png', 6]]) {
    const src = pic(file);
    if (!src) continue;
    const cut = await p.evaluate(async ([s, ow]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), 3, 2, 0.02), out = [];
      for (let i = 0; i < 6; i++) {
        const x = cl[i];
        if (!x) throw new Error('prop ' + (i + 1) + ' is missing');
        const oh = Math.round(ow * x.h / x.w), o = W.canvas(ow, oh);
        W.draw(o.getContext('2d'), x.c, x, ow / x.w, ow / 2, oh);
        out.push(Object.assign(W.out(o, 0.85), { w: ow, h: oh }));
      }
      return out;
    }, [src, 2.5 * PPT]);
    cut.forEach((r, i) => save('props/plains_' + kinds[from + i], r));
    done.push(file);
  }

  // ---------- the icons: icons_plains.png (4 x 4) then the Plainsrunner row of icons_manila_gear.png (4 x 3) ----------
  const icons = pic('icons_plains.png'), gearSrc = fs.existsSync(path.join(ROOT, 'art-src', 'manila', 'icons_manila_gear.png')) ? data(path.join(ROOT, 'art-src', 'manila', 'icons_manila_gear.png')) : null;
  if (icons) {
    const r = await p.evaluate(async ([src, gear, n]) => {
      const cut = async (s, cols, rows, take) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), cols, rows, 0.02), out = [];
        for (let i = 0; i < take; i++) {
          if (!cl[i]) throw new Error('icon ' + (i + 1) + ' is missing');
          const o = W.canvas(128, 128);
          W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
          out.push(o);
        }
        return out;
      };
      const list = (await cut(src, 4, 4, 16)).concat(gear ? await cut(gear, 4, 3, 4) : []);
      const sheet = W.canvas(8 * 128, Math.ceil(n / 8) * 128), g = sheet.getContext('2d');
      list.forEach((c, i) => g.drawImage(c, (i % 8) * 128, Math.floor(i / 8) * 128));
      return Object.assign(W.out(sheet, 0.85), { w: sheet.width, h: sheet.height, n: list.length });
    }, [icons, gearSrc, C.PLAINS_ICONS.length]);
    save('plains_icons', r);
    done.push(r.n + ' icons');
  }

  await b.close();
  console.log(done.length ? 'Made: ' + done.join(', ') + '. Creatures: node tools/art/animals3q-import.js plains. Then: node build.js' : 'No Plains pictures yet.');
})().catch((e) => { console.error(e); process.exit(1); });

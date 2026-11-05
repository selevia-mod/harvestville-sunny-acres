'use strict';
// Banaue Terraces' pictures (owner, 6 Nov 2026; art-src/PLACES-1-5-PROMPTS.md 1-18, saved in art-src/places/banaue/)
// into the game's sizes. Run it whenever pictures come in: each part runs when its pictures are there, the rest keep
// their stand-ins. (The place: src/00-zzzzzzzzzz-place-11-banaue.js; the names are listed in docs/places/banaue.md.)
//   assets/banaue_ground.*      the map's own tiles (maps/banaue.json, tileset 'banaue_ground'), 3 x 2 cells of 256 in
//                               the tiles sheets' padding: grass, grass2, paddy, paddy2, dike, steps. grass/grass2 from
//                               ground_banaue.png, paddy/paddy2 from ground_banaue_water.png; until they come (and the
//                               dike and the steps always) they are made from the game's own tiles. Always rebuilt.
//                               PNG at full size, WebP at half (assets/sizes.json).
//   assets/props/banaue_<x>.*   props_banaue.png's 6 cells (wall, hut, fern, rack, boulder, grass; F.BANAUE_PROP_ORDER),
//                               at 160 px a tile, F.BANAUE_PROPS[x].w tiles wide, standing on their bottom edge
//   assets/npc_lola_bugan.*     npc_lola_bugan.png's 3 x 3 poses as one row of 9 frames of 128 x 192 (a villager's)
//   assets/props/banaue_mouth.*, banaue_gate.*, assets/banaue_cave.*: the tunnels' mouth, gate and tiles, made as
//                               tools/art/lair-world-import.js makes the Lair's (the water where the Lair has lava)
//   assets/items.png/.webp      icons_banaue.png's 16 icons (docs/places-items.json order) in the slots F.placeIcons
//                               gives them; then the place's file is switched to use them (ICONS_IN = true)
//   the creatures (wild_itik.png ... wild_amomongo.png): node tools/art/animals3q-import.js places (their own sheets);
//                               then set each creature's px in the place's file to the width it prints.
// The pictures of the props, the person, the creatures and the tunnels go in the 'wild' pack, not the page
// (tools/places/banaue-art.js, read by tools/packs.js). node tools/art/banaue-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const { TILES } = require('../tiles');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'places', 'banaue');
const OUT = path.join(ROOT, 'assets');
const PLACE_FILE = path.join(ROOT, 'src', '00-zzzzzzzzzz-place-11-banaue.js');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const F = ctx.window.Farm, C = F.Config;
const PPT = 160, TILE = 128, POOL = 192, MOUTH_W = 3.7, GATE_W = 2;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const pic = (name) => { const f = path.join(SRC, name); return fs.existsSync(f) ? data(f) : null; };
const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
const save = (name, r) => {
  put(name + '.png', r.png);
  const n = put(name + '.webp', r.webp);
  console.log(('assets/' + name).padEnd(30), (r.w ? r.w + 'x' + r.h : '').padEnd(10), (n / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const sizes = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8'));
  const done = [];

  // ---------- the ground ----------
  const T = TILES.T;
  const ground = await p.evaluate(async ([tiles, ids, grassPic, waterPic]) => {
    const sheet = await W.load(tiles), S = 256;
    const cell = (id) => { const c = W.canvas(S, S); c.getContext('2d').drawImage(sheet, 8 + (id % 7) * 272, 8 + Math.floor(id / 7) * 272, S, S, 0, 0, S, S); return c; };
    // recoloured: each pixel's lightness onto a ramp from lo to hi, with `keep` of its own colour left in
    const tone = (c, lo, hi, keep) => {
      const g = c.getContext('2d'), im = g.getImageData(0, 0, S, S), d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = Math.min(1, (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255 * 1.15);
        for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.round((lo[ch] + (hi[ch] - lo[ch]) * l) * (1 - keep) + d[i + ch] * keep);
      }
      g.putImageData(im, 0, 0);
      return c;
    };
    // a picture scaled down whole to one tile, its edges evened out across the wrap (lair-world-import.js)
    const small = (img) => {
      const c = W.canvas(S, S), g = c.getContext('2d');
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
      return c;
    };
    // the same tile with another part of itself in the middle and its own edges (so the two sit side by side in any order)
    const variant = (c) => {
      const o = W.canvas(S, S), g = o.getContext('2d'), sh = W.canvas(S, S), sg = sh.getContext('2d');
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
    // rows of young rice in the stand-in paddy (4 a row, 4 rows, every other row half a step on: the pattern wraps)
    const rice = (c) => {
      const g = c.getContext('2d');
      g.lineCap = 'round';
      for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) {
        const x = 32 + j * 64 + (k % 2) * 32, y = 50 + k * 64;
        [x, x - S].forEach((cx) => { // (and again one tile left, so a tuft cut by the right edge goes on at the left)
          g.fillStyle = 'rgba(20,40,20,0.22)';
          g.beginPath(); g.ellipse(cx, y, 16, 6, 0, 0, Math.PI * 2); g.fill();
          [[-14, -24], [-5, -34], [5, -36], [14, -26]].forEach(([dx, dy]) => {
            g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + dx * 0.3, y + dy * 0.6, cx + dx, y + dy);
            g.lineWidth = 9; g.strokeStyle = '#2a5a1c'; g.stroke();
            g.lineWidth = 5; g.strokeStyle = '#86d850'; g.stroke();
          });
        });
      }
      return c;
    };
    // stone steps going down the slope: four slabs, each the tile's width, a dark riser under each
    const steps = (c) => {
      const g = c.getContext('2d');
      for (let row = 0; row < 4; row++) {
        const y = row * 64, v = 168 - row % 2 * 10;
        g.fillStyle = 'rgb(' + v + ',' + (v - 4) + ',' + (v - 16) + ')';
        g.fillRect(0, y, S, 46);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(0, y + 2, S, 7);
        g.fillStyle = 'rgba(60,50,40,0.35)';
        for (let x = (row * 37) % 64; x < S; x += 64) g.fillRect(x, y + 14, 3, 22); // (cracks between the stones)
        g.fillStyle = 'rgb(96,86,72)';
        g.fillRect(0, y + 46, S, 18);
        g.fillStyle = 'rgba(30,24,16,0.4)';
        g.fillRect(0, y + 58, S, 6);
      }
      return c;
    };
    const grass = grassPic ? small(await W.load(grassPic)) : tone(cell(ids.grass), [38, 92, 30], [168, 226, 104], 0.15);
    const paddy = waterPic ? small(await W.load(waterPic)) : rice(tone(cell(ids.water), [52, 82, 66], [150, 182, 140], 0.1));
    const dike = tone(cell(ids.trail), [70, 52, 30], [176, 146, 100], 0.4);
    const stone = steps(tone(cell(ids.trail), [48, 44, 38], [120, 112, 100], 0.2));
    const list = [grass, variant(grass), paddy, variant(paddy), dike, stone];
    // the sheet: 3 x 2 cells of 256, 8 px round it and 16 between, each tile's edge pixels drawn out into the gaps
    const o = W.canvas(816, 544), g = o.getContext('2d'), pad = 8;
    list.forEach((c, i) => {
      const x = 8 + (i % 3) * 272, y = 8 + Math.floor(i / 3) * 272;
      g.drawImage(c, x, y);
      g.drawImage(c, 0, 0, 1, S, x - pad, y, pad, S);
      g.drawImage(c, S - 1, 0, 1, S, x + S, y, pad, S);
      g.drawImage(o, x - pad, y, S + pad * 2, 1, x - pad, y - pad, S + pad * 2, pad);
      g.drawImage(o, x - pad, y + S - 1, S + pad * 2, 1, x - pad, y + S, S + pad * 2, pad);
    });
    const half = W.canvas(408, 272), h = half.getContext('2d');
    h.imageSmoothingQuality = 'high';
    h.drawImage(o, 0, 0, 408, 272);
    return { png: o.toDataURL('image/png'), webp: half.toDataURL('image/webp', 0.8), w: 816, h: 544 };
  }, [data(path.join(OUT, 'tiles.png')), { grass: T.wild_grass, water: T.water, trail: T.wild_trail }, pic('ground_banaue.png'), pic('ground_banaue_water.png')]);
  save('banaue_ground', ground);
  sizes.banaue_ground = [816, 544];
  done.push('ground' + (pic('ground_banaue.png') ? ' (grass: yours)' : '') + (pic('ground_banaue_water.png') ? ' (paddy: yours)' : ''));

  // ---------- the props ----------
  const props = pic('props_banaue.png');
  if (props) {
    const names = F.BANAUE_PROP_ORDER;
    const cut = await p.evaluate(async ([src, ws, ppt]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 2, 0.02);
      return ws.map((w, i) => {
        const x = cl[i];
        if (!x) throw new Error('prop ' + (i + 1) + ' is missing');
        const ow = Math.round(w * ppt), oh = Math.round(ow * x.h / x.w), o = W.canvas(ow, oh);
        W.draw(o.getContext('2d'), x.c, x, ow / x.w, ow / 2, oh);
        return Object.assign(W.out(o, 0.85), { w: ow, h: oh });
      });
    }, [props, names.map((n) => F.BANAUE_PROPS[n].w), PPT]);
    names.forEach((n, i) => save('props/' + n, cut[i]));
    done.push('props');
  }

  // ---------- Lola Bugan ----------
  const lola = pic('npc_lola_bugan.png');
  if (lola) {
    const r = await p.evaluate(async (src) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 3, 0.02);
      if (cl.some((x) => !x)) throw new Error('a pose is missing');
      const k = Math.min(...cl.map((x) => Math.min(118 / x.w, 180 / x.h))), o = W.canvas(8 * 2 + 9 * 128 + 8 * 16, 8 * 2 + 192), g = o.getContext('2d');
      cl.forEach((x, i) => W.draw(g, x.c, x, k, 8 + i * 144 + 64, 8 + 186));
      return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height });
    }, lola);
    save('npc_lola_bugan', r);
    done.push('Lola Bugan');
  }

  // ---------- the tunnels: mouth, gate, tiles ----------
  const mouth = pic('banaue_mouth.png');
  if (mouth) {
    const r = await p.evaluate(async ([src, w]) => {
      const x = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0], h = Math.round(w * x.h / x.w), o = W.canvas(w, h);
      W.draw(o.getContext('2d'), x.c, x, w / x.w, w / 2, h);
      return Object.assign(W.out(o, 0.85), { w, h });
    }, [mouth, Math.round(MOUTH_W * PPT)]);
    save('props/banaue_mouth', r);
    done.push('mouth');
  }
  const gate = pic('banaue_gate.png');
  if (gate) {
    const r = await p.evaluate(async ([src, fw]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 1, 0.02);
      if (!cl[0] || !cl[1]) throw new Error('the gate needs both halves');
      const k = fw / Math.max(cl[0].w, cl[1].w), fh = Math.ceil(Math.max(cl[0].h, cl[1].h) * k), GAP = 4, o = W.canvas(fw * 2 + GAP, fh), g = o.getContext('2d');
      cl.forEach((x, i) => W.draw(g, x.c, x, k, i * (fw + GAP) + fw / 2, fh));
      return Object.assign(W.out(o, 0.85), { w: o.width, h: fh });
    }, [gate, GATE_W * PPT]);
    save('props/banaue_gate', r);
    done.push('gate');
  }
  const caveParts = ['banaue_cave_floor.png', 'banaue_cave_water.png', 'banaue_cave_rock_top.png', 'banaue_cave_rock_face.png'].map(pic);
  if (caveParts.every(Boolean)) {
    const r = await p.evaluate(async ([floor, water, top, face, S, LV]) => {
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
      // cave2: the floor moved by half (it wraps), so the two kinds of floor tile differ in the middle
      [[-1, -1], [0, -1], [-1, 0], [0, 0]].forEach((q) => vg.drawImage(fl, S / 2 + q[0] * S, S / 2 + q[1] * S));
      const tiles = [fl, v, small(await W.load(face), S, false), small(await W.load(top), S, true), small(wt, S, true), small(wt, LV, true)];
      const o = W.canvas(S * 5 + LV, LV), g = o.getContext('2d');
      tiles.forEach((c, i) => g.drawImage(c, i * S, 0));
      return Object.assign(W.out(o, 0.9), { w: o.width, h: o.height });
    }, caveParts.concat([TILE, POOL]));
    save('banaue_cave', r);
    done.push('tunnel tiles');
  }

  // ---------- the icons ----------
  const icons = pic('icons_banaue.png');
  if (icons) {
    const order = C.ICON_ORDER.slice();
    F.BANAUE_ICONS.forEach((id) => { if (order.indexOf(id) < 0) order.push(id); }); // (where F.placeIcons puts them)
    const cut = await p.evaluate(async ([src, n]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.02), out = [];
      for (let i = 0; i < n; i++) {
        if (!cl[i]) throw new Error('icon ' + (i + 1) + ' is missing');
        const o = W.canvas(128, 128);
        W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
        out.push(o.toDataURL('image/png'));
      }
      return out;
    }, [icons, F.BANAUE_ICONS.length]);
    const by = {};
    F.BANAUE_ICONS.forEach((id, i) => { by[id] = cut[i]; });
    const items = await p.evaluate(async ([old, list]) => {
      const im = await W.load(old), rows = Math.ceil(list.length / 8), sheet = W.canvas(1152, Math.max(im.height, rows * 144)), g = sheet.getContext('2d');
      g.drawImage(im, 0, 0);
      for (let i = 0; i < list.length; i++) {
        if (!list[i]) continue;
        const x = 8 + (i % 8) * 144, y = 8 + Math.floor(i / 8) * 144;
        g.clearRect(x, y, 128, 128);
        g.drawImage(await W.load(list[i]), x, y);
      }
      return W.itemsOut(sheet, 0.72);
    }, [data(path.join(OUT, 'items.png')), order.map((n) => by[n] || null)]);
    put('items.png', items.png);
    put('items.webp', items.webp);
    const src = fs.readFileSync(PLACE_FILE, 'utf8');
    if (/var ICONS_IN = false;/.test(src)) fs.writeFileSync(PLACE_FILE, src.replace('var ICONS_IN = false;', 'var ICONS_IN = true;'));
    done.push('icons (slots ' + order.indexOf(F.BANAUE_ICONS[0]) + '..' + order.indexOf(F.BANAUE_ICONS[F.BANAUE_ICONS.length - 1]) + ')');
  }

  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  await b.close();
  const creatures = [...new Set(C.WILD.more.filter((k) => C.WILD.animals[k].place === 'banaue').map((k) => C.WILD.animals[k].sheet))].filter((s) => pic(s + '.png'));
  console.log('done:', done.join(', '));
  if (creatures.length) console.log('creatures waiting (' + creatures.join(' ') + '): node tools/art/animals3q-import.js places');
})().catch((e) => { console.error(e); process.exit(1); });

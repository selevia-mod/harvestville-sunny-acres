'use strict';
// The hunting places' pictures (owner, 6 Nov 2026; art-src/PLACES-1-5-PROMPTS.md, saved in art-src/places/<place>/ and
// art-src/shared/, art-src/park/) into the game's sizes, for every place but Banaue (its ground and props are its own:
// tools/art/banaue-import.js does all of Banaue). Run it whenever pictures come in: each part runs when its picture is
// there, the rest keep their stand-ins. The creatures are tools/art/animals3q-import.js places.
//   assets/npc_<name>.*         the person's 3 x 3 poses as one row of 9 frames of 128 x 192 (a villager's)
//   assets/props/<id>_mouth.*, <id>_gate.*, assets/<id>_cave.*: the dungeon's mouth, gate and tiles (as banaue-import.js)
//   assets/items.png/.webp      each place's 16 icons, in the slots its file's F.placeIcons gives them (an id from before,
//                               like kaldereta, keeps its own icon)
//   assets/props/kanor_jeep.*   Kanor's Jeep (shared/kanor_jeep.png), 2.4 tiles wide
//   assets/props/hall_of_fame.* the Hall of Fame (park/hall_of_fame.png), its 6 x 5 tiles, standing on its bottom edge
// The pictures of the people, the dungeons and the creatures go in the 'places' pack, not the page
// (tools/places/places-art.js, read by tools/packs.js). node tools/art/places-import.js [place ...]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const F = ctx.window.Farm, C = F.Config;
const ITEMS = require('../../docs/places-items.json');
const PPT = 160, TILE = 128, POOL = 192, MOUTH_W = 3.7, GATE_W = 2;
const PLACES = process.argv.slice(2).length ? process.argv.slice(2) : ['bohol', 'taal', 'sierra', 'palawan'];
const OLD_ICONS = 285; // (C.ICON_ORDER's length before the places: only the places' new slots are painted)

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
const save = (name, r) => {
  put(name + '.png', r.png);
  const n = put(name + '.webp', r.webp);
  console.log(('assets/' + name).padEnd(32), (r.w ? r.w + 'x' + r.h : '').padEnd(10), (n / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const done = [];
  const icons = {}; // id -> a 128 x 128 picture

  // A place's 16 icons, cut from its 4 x 4 sheet: each saved as art-src/icons/<id>.png (like every icon's source) and
  // kept for the items sheet if it is a new slot. (Banaue's too: tools/art/banaue-import.js paints its own the same way.)
  const iconsOf = async (id) => {
    const f = path.join(ROOT, 'art-src', 'places', id, 'icons_' + id + '.png');
    if (!fs.existsSync(f)) return false;
    const ids = ITEMS[id].items.map((x) => x.id);
    const cut = await p.evaluate(async ([src, n]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.02), out = [];
      for (let i = 0; i < n; i++) {
        if (!cl[i]) throw new Error('icon ' + (i + 1) + ' is missing');
        const o = W.canvas(128, 128);
        W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
        out.push(o.toDataURL('image/png'));
      }
      return out;
    }, [data(f), ids.length]);
    ids.forEach((k, i) => {
      const slot = C.ICON_ORDER.indexOf(k);
      if (slot < 0) throw new Error(id + ': icon ' + k + ' has no slot (is F.placeIcons called in its file?)');
      if (slot < OLD_ICONS) return; // (one from before keeps its own picture)
      icons[k] = cut[i];
      fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', k + '.png'), Buffer.from(cut[i].split(',')[1], 'base64'));
    });
    return true;
  };
  if (await iconsOf('banaue')) done.push('banaue: icons');

  for (const id of PLACES) {
    const P = C.PLACES[id];
    if (!P || id === 'banaue') throw new Error(id + ': not a place here (Banaue: tools/art/banaue-import.js)');
    const SRC = path.join(ROOT, 'art-src', 'places', id);
    const pic = (name) => { const f = path.join(SRC, name); return fs.existsSync(f) ? data(f) : null; };
    const got = [];

    // ---------- the person ----------
    const sheet = P.npc && P.npc.sheet, person = sheet && pic(sheet + '.png');
    if (person) {
      const r = await p.evaluate(async (src) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 3, 0.02);
        if (cl.some((x) => !x)) throw new Error('a pose is missing');
        const k = Math.min(...cl.map((x) => Math.min(118 / x.w, 180 / x.h))), o = W.canvas(8 * 2 + 9 * 128 + 8 * 16, 8 * 2 + 192), g = o.getContext('2d');
        cl.forEach((x, i) => W.draw(g, x.c, x, k, 8 + i * 144 + 64, 8 + 186));
        return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height });
      }, person);
      save(sheet, r);
      got.push(P.npc.name);
    }

    // ---------- the dungeon: mouth, gate, tiles ----------
    const art = (P.dungeon && P.dungeon.art) || {};
    const mouth = pic(id + '_mouth.png');
    if (mouth && art.mouth) {
      const r = await p.evaluate(async ([src, w]) => {
        const x = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0], h = Math.round(w * x.h / x.w), o = W.canvas(w, h);
        W.draw(o.getContext('2d'), x.c, x, w / x.w, w / 2, h);
        return Object.assign(W.out(o, 0.85), { w, h });
      }, [mouth, Math.round(MOUTH_W * PPT)]);
      save(art.mouth, r);
      got.push('mouth');
    }
    const gate = pic(id + '_gate.png');
    if (gate && art.gate) {
      const r = await p.evaluate(async ([src, fw]) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 1, 0.02);
        if (!cl[0] || !cl[1]) throw new Error('the gate needs both halves');
        const k = fw / Math.max(cl[0].w, cl[1].w), fh = Math.ceil(Math.max(cl[0].h, cl[1].h) * k), GAP = 4, o = W.canvas(fw * 2 + GAP, fh), g = o.getContext('2d');
        cl.forEach((x, i) => W.draw(g, x.c, x, k, i * (fw + GAP) + fw / 2, fh));
        return Object.assign(W.out(o, 0.85), { w: o.width, h: fh });
      }, [gate, GATE_W * PPT]);
      save(art.gate, r);
      got.push('gate');
    }
    const caveParts = ['_cave_floor.png', '_cave_water.png', '_cave_rock_top.png', '_cave_rock_face.png'].map((n) => pic(id + n));
    if (caveParts.every(Boolean) && art.cave) {
      const r = await p.evaluate(async ([floor, water, top, face, S, LV]) => {
        // a picture scaled down whole to one tile, its edges evened out across the wrap (lair-world-import.js)
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
      save(art.cave, r);
      got.push('dungeon tiles');
    }

    // ---------- the ground: two seamless textures (the game paints them into its map's grass and water tiles) ----------
    for (const [file, key] of [['ground_' + id + '.png', 'ground_' + id], ['ground_' + id + '_water.png', 'ground_' + id + '_water']]) {
      const src = pic(file);
      if (!src) continue;
      const r = await p.evaluate(async ([s, S]) => {
        const img = await W.load(s), c = W.canvas(S, S), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, S, S);
        const im = g.getImageData(0, 0, S, S), d = im.data, band = S / 4;
        [true, false].forEach((along) => { // (its edges evened out across the wrap, as banaue-import.js does)
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
      }, [src, 256]);
      save(key, r);
      got.push(key);
    }

    // ---------- the props: the 3 x 2 sheet, cut into props/<id>_<kind> (src/19zzzzzzz-place-art.js puts them in) ----------
    const kinds = C.PLACE_PROP_KINDS && C.PLACE_PROP_KINDS[id], props = pic('props_' + id + '.png');
    if (kinds && props) {
      const cut = await p.evaluate(async ([src, n, ow]) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 2, 0.02);
        const out = [];
        for (let i = 0; i < n; i++) {
          const x = cl[i];
          if (!x) throw new Error('prop ' + (i + 1) + ' is missing');
          const oh = Math.round(ow * x.h / x.w), o = W.canvas(ow, oh);
          W.draw(o.getContext('2d'), x.c, x, ow / x.w, ow / 2, oh);
          out.push(Object.assign(W.out(o, 0.85), { w: ow, h: oh }));
        }
        return out;
      }, [props, kinds.length, 2.5 * PPT]);
      kinds.forEach((k, i) => save('props/' + id + '_' + k, cut[i]));
      got.push('props');
    }

    if (await iconsOf(id)) got.push('icons');
    done.push(id + ': ' + (got.join(', ') || 'nothing yet'));
  }

  if (Object.keys(icons).length) {
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
    }, [data(path.join(OUT, 'items.png')), C.ICON_ORDER.map((n) => icons[n] || null)]);
    put('items.png', items.png);
    put('items.webp', items.webp);
    done.push(Object.keys(icons).length + ' icons painted');
  }

  // ---------- shared: Kanor's Jeep, the Hall of Fame ----------
  const shared = (f) => (fs.existsSync(path.join(ROOT, 'art-src', f)) ? data(path.join(ROOT, 'art-src', f)) : null);
  const one = (src, w, hmax) => p.evaluate(async ([s, w, hmax]) => {
    const x = W.cells(W.dehalo(W.cutout(await W.load(s))), 1, 1, 0.02)[0];
    let ow = w, oh = Math.round(w * x.h / x.w);
    if (hmax && oh > hmax) { oh = hmax; ow = Math.round(hmax * x.w / x.h); }
    const o = W.canvas(w, hmax || oh);
    W.draw(o.getContext('2d'), x.c, x, ow / x.w, w / 2, hmax || oh);
    return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height });
  }, [src, w, hmax]);
  // the jeep stop by Kanor's Jeep at each place (shared/jeep_stop.png), 2 tiles wide, standing on its bottom edge
  const stop = shared('shared/jeep_stop.png');
  if (stop) { save('props/jeep_stop', await one(stop, 2 * PPT)); done.push('jeep stop'); }
  // the four medal frames (shared/medals.png, 2 x 2: bronze, silver, gold, rainbow), each 120 x 150, standing on its
  // bottom edge; the Medals page puts the earned thing in the round part (src/19zzzzzzz-medal-frames.js)
  const medals = shared('shared/medals.png');
  if (medals) {
    const cut = await p.evaluate(async (src) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 2, 0.02);
      return cl.map((x) => {
        if (!x) throw new Error('a medal is missing');
        const FW = 120, FH = 150, k = Math.min(FW / x.w, FH / x.h), o = W.canvas(FW, FH);
        W.draw(o.getContext('2d'), x.c, x, k, FW / 2, FH);
        return Object.assign(W.out(o, 0.9), { w: FW, h: FH });
      });
    }, medals);
    ['bronze', 'silver', 'gold', 'rainbow'].forEach((n, i) => save('medal_' + n, cut[i]));
    done.push('medal frames');
  }
  const jeep = shared('shared/kanor_jeep.png');
  if (jeep) { save('props/kanor_jeep', await one(jeep, Math.round(2.4 * PPT))); done.push("Kanor's Jeep"); }
  const hall = shared('park/hall_of_fame.png');
  if (hall) {
    // (the props tileset's own size for it: 6 x 5 tiles of 128, stored at full size here like the town's buildings)
    const r = await one(hall, 6 * 128, 5 * 128);
    put('props/hall_of_fame.png', r.png);
    put('props/hall_of_fame.webp', r.webp);
    console.log('assets/props/hall_of_fame'.padEnd(32), (r.w + 'x' + r.h).padEnd(10));
    done.push('Hall of Fame');
  }

  await b.close();
  console.log('done:', done.join('; '));
})().catch((e) => { console.error(e); process.exit(1); });

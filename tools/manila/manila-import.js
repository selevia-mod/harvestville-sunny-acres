'use strict';
// Manila's pictures (owner; art-src/MANILA-PROMPTS.md batches 1 and 2, saved in art-src/manila/ with the file names the
// prompts give) into the game's sizes, for the 'manila' download pack (tools/manila/manila-art.js, tools/packs.js). Run it
// whenever pictures come in: each picture that is there is made, the rest keep their stand-ins in the game.
//   assets/manila_tex_<slot>.*      a ground texture (cobble, plaza, bay, baywalk), 256 x 256 with its edges evened out
//                                   across the wrap; the game paints it into its ground sheet (manila_ground)
//   assets/props/manila_<name>.*    a building or a single prop (plaza_fountain, grand_market, ...), trimmed, 128 px a tile
//                                   at the size its prompt gives (C.MANILA.art.singles)
//   assets/props/manila_<piece>.*   each piece of a sheet of 3 x 2 (or 3 x 1), in the prompt's order (C.MANILA.art.sheets)
//   assets/npc_<name>.*             a person's 3 x 3 walking sheet as one row of 9 frames of 128 x 192 (a villager's)
// Then: node build.js (the pack's files come out in dist/packs/, for the CDN's app-assets/packs/). The page does not grow.
// node tools/manila/manila-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { config } = require('./manila-art');

const ROOT = path.join(__dirname, '..', '..');
const SRC = process.env.MANILA_SRC || path.join(ROOT, 'art-src', 'manila'); // (the two env names: for trying it out elsewhere)
const OUT = process.env.MANILA_OUT || path.join(ROOT, 'assets');
const M = config().MANILA, A = M.art, TILE = 128;

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
// (city life's pictures are in art-src/manila/city/: C.MANILA.life.folder)
const pic = (name) => { const f = [path.join(SRC, name + '.png'), path.join(SRC, (M.life && M.life.folder) || 'city', name + '.png')].filter((x) => fs.existsSync(x))[0]; return f ? data(f) : null; };
const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true }); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
const save = (name, r) => {
  put(name + '.png', r.png);
  const n = put(name + '.webp', r.webp);
  console.log(('assets/' + name).padEnd(40), (r.w + 'x' + r.h).padEnd(10), (n / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  if (!fs.existsSync(SRC)) { console.log('No art-src/manila/ yet: nothing to do (the game keeps its stand-ins).'); return; }
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('../art/wild-lib') });
  const done = [];

  // ---------- the ground textures ----------
  for (const slot of Object.keys(A.ground)) {
    const src = pic(A.ground[slot]);
    if (!src) continue;
    const r = await p.evaluate(async ([s, S]) => {
      const img = await W.load(s), c = W.canvas(S, S), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, S, S);
      const im = g.getImageData(0, 0, S, S), d = im.data, band = S / 4;
      [true, false].forEach((along) => { // (its edges evened out across the wrap, as the places' ground)
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
    save('manila_tex_' + slot, r);
    done.push(A.ground[slot]);
  }

  // ---------- one picture: trimmed, its width the tiles its prompt gives ----------
  const one = (src, wTiles, hTiles) => p.evaluate(async ([s, w, h, TL]) => {
    const x = W.cells(W.dehalo(W.cutout(await W.load(s))), 1, 1, 0.02)[0];
    if (!x) throw new Error('nothing in the picture');
    const k = Math.min(w * TL / x.w, h * TL / x.h), ow = Math.round(x.w * k), oh = Math.round(x.h * k), o = W.canvas(ow, oh);
    W.draw(o.getContext('2d'), x.c, x, k, ow / 2, oh);
    return Object.assign(W.out(o, 0.85), { w: ow, h: oh });
  }, [src, wTiles, hTiles, TILE]);
  const singles = Object.assign({}, A.singles);
  for (const name of Object.keys(singles)) {
    const src = pic(name);
    if (!src) continue;
    const [w, h] = singles[name];
    save('props/manila_' + name, await one(src, w, h));
    done.push(name);
  }

  // ---------- the sheets of 6 (or 3): each piece on its own ----------
  for (const sheet of Object.keys(A.sheets)) {
    const src = pic(sheet);
    if (!src) continue;
    const [cols, rows, names, wTiles] = A.sheets[sheet];
    const cut = await p.evaluate(async ([s, cols, rows, n, w, TL]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), cols, rows, 0.02), out = [];
      for (let i = 0; i < n; i++) {
        const x = cl[i];
        if (!x) throw new Error('piece ' + (i + 1) + ' is missing');
        const k = w * TL / Math.max(x.w, x.h * 0.9), ow = Math.round(x.w * k), oh = Math.round(x.h * k), o = W.canvas(ow, oh);
        W.draw(o.getContext('2d'), x.c, x, k, ow / 2, oh);
        out.push(Object.assign(W.out(o, 0.85), { w: ow, h: oh }));
      }
      return out;
    }, [src, cols, rows, names.length, wTiles, TILE]);
    names.forEach((n, i) => save('props/manila_' + n, cut[i]));
    done.push(sheet);
  }

  // ---------- the people: a 3 x 3 sheet as one row of 9 (a villager's) ----------
  for (const sheet of M.people.order.map((k) => M.people[k].sheet).concat(M.crowd.sheets || [], (M.life && M.life.people) || [])) {
    if (M.life && M.life.files[sheet] && !fs.existsSync(path.join(SRC, sheet + '.png')) && !fs.existsSync(path.join(SRC, M.life.folder, sheet + '.png'))) continue;
    const src = pic(sheet);
    if (!src) continue;
    const r = await p.evaluate(async (s) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), 3, 3, 0.02);
      if (cl.some((x) => !x)) throw new Error('a pose is missing');
      const k = Math.min(...cl.map((x) => Math.min(118 / x.w, 180 / x.h))), o = W.canvas(8 * 2 + 9 * 128 + 8 * 16, 8 * 2 + 192), g = o.getContext('2d');
      cl.forEach((x, i) => W.draw(g, x.c, x, k, 8 + i * 144 + 64, 8 + 186));
      return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height });
    }, src);
    save(sheet, r);
    done.push(sheet);
  }

  // ---------- city life (docs/manila-city-life.md): EXACTLY MANILA-CITY-LIFE-PROMPTS.md's files, by C.MANILA.life.files ----------
  const LF = (M.life && M.life.files) || {}, cityPic = (n) => { const f = path.join(SRC, M.life.folder, n + '.png'); return fs.existsSync(f) ? data(f) : null; };
  const seamless = (s, S) => p.evaluate(async ([s, S]) => {
    const img = await W.load(s), c = W.canvas(S, S), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, S, S);
    return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.85), w: S, h: S };
  }, [s, S]);
  for (const file of Object.keys(LF)) {
    const d = LF[file], src = cityPic(file);
    if (!src) continue;
    if (d.tex) save('manila_tex_' + d.tex, await seamless(src, 256));
    else if (d.swatch) { // squares on a plain white page: each cell's square, trimmed of the white round it
      const [cols, rows, names] = d.swatch;
      const out = await p.evaluate(async ([s, cols, rows, n]) => {
        const img = await W.load(s), cw = img.width / cols, ch = img.height / rows, res = [];
        const c0 = W.canvas(img.width, img.height), g0 = c0.getContext('2d');
        g0.drawImage(img, 0, 0);
        for (let i = 0; i < n; i++) {
          const x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch, px = g0.getImageData(x0, y0, cw, ch).data;
          let a = cw, b = ch, e = 0, f = 0;
          for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
            const k = (y * cw + x) * 4, white = px[k] > 235 && px[k + 1] > 235 && px[k + 2] > 235;
            if (px[k + 3] > 40 && !white) { if (x < a) a = x; if (x > e) e = x; if (y < b) b = y; if (y > f) f = y; }
          }
          if (e <= a || f <= b) throw new Error('swatch ' + (i + 1) + ' is empty');
          const m = Math.round(Math.min(e - a, f - b) * 0.04), o = W.canvas(256, 256), g = o.getContext('2d');
          g.imageSmoothingQuality = 'high';
          g.drawImage(c0, x0 + a + m, y0 + b + m, e - a - 2 * m, f - b - 2 * m, 0, 0, 256, 256);
          res.push({ png: o.toDataURL('image/png'), webp: o.toDataURL('image/webp', 0.85), w: 256, h: 256 });
        }
        return res;
      }, [src, cols, rows, names.length]);
      names.forEach((n, i) => save('manila_tex_' + d.prefix + n, out[i]));
    } else if (d.single) save('props/manila_' + d.single, await one(src, d.size[0], d.size[1]));
    else if (d.sheet) {
      const [cols, rows, names] = d.sheet;
      const cut = await p.evaluate(async ([s, cols, rows, n, w, TL]) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), cols, rows, 0.02), out = [];
        for (let i = 0; i < n; i++) {
          const x = cl[i];
          if (!x) { out.push(null); continue; }
          const k = w * TL / Math.max(x.w, x.h * 0.9), ow = Math.round(x.w * k), oh = Math.round(x.h * k), o = W.canvas(ow, oh);
          W.draw(o.getContext('2d'), x.c, x, k, ow / 2, oh);
          out.push(Object.assign(W.out(o, 0.85), { w: ow, h: oh }));
        }
        return out;
      }, [src, cols, rows, names.length, d.w || 2, TILE]);
      names.forEach((n, i) => { if (!n) return; if (!cut[i]) throw new Error(file + ': piece ' + (i + 1) + ' is missing'); save('props/manila_' + n, cut[i]); });
    } else if (d.vehicle) { // a 3 x 3 driving sheet: every frame the same scale, standing on the same line, in a 3 x 3 grid of 512 x 384
      const r = await p.evaluate(async (s) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), 3, 3, 0.02);
        if (cl.some((x) => !x)) throw new Error('a frame is missing');
        const FW = 512, FH = 384, k = Math.min(...cl.map((x) => Math.min((FW - 16) / x.w, (FH - 12) / x.h))), o = W.canvas(FW * 3, FH * 3), g = o.getContext('2d');
        cl.forEach((x, i) => W.draw(g, x.c, x, k, (i % 3) * FW + FW / 2, Math.floor(i / 3) * FH + FH - 6));
        return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height });
      }, src);
      save('manila_' + d.vehicle, r);
    } else continue; // (person: with the other people, above)
    done.push('city/' + file);
  }

  await b.close();
  console.log(done.length ? 'Made: ' + done.join(', ') + '. Now: node build.js' : 'No Manila pictures in art-src/manila/ yet.');
})().catch((e) => { console.error(e); process.exit(1); });

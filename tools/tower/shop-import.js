'use strict';
// Mang Ilaw's shop pictures (owner, 13 Nov 2026; art-src/tower-shop/, each a see-through PNG) into the game's sizes, for
// the 'tower' pack (tools/tower/tower-art.js keys(), tools/packs.js), never the page. Each part runs when its picture is
// there; the game draws its stand-in for any that is not.
//   tower_icons.png (4 x 3: hat, boots, coat, lantern, saddle, bridle, horse lantern, dye, tide shell, pearl, -, -)
//     -> assets/tower_icons: 128 x 128 cells, 8 a row (1024 x 256), in C.TOWER_ICONS' order (ICON_FROM below: the "?",
//        weapon_soon, has no cell in the picture: the game always draws it); each trimmed, fitted with a small margin
//        and centred, as tools/tower/food-icons-import.js.
//   npc_keeper.png (3 x 3: rows toward you, away, left; standing, step, step)
//     -> assets/npc_keeper: one row of 9 frames of 128 x 192 (a villager's, as tools/manila/manila-import.js makes the
//        npc_* sheets): frame row * 3 + column, so 0 faces you, 3 away, 6 left (19zzz...z-tower-shop.js keeperLookRow).
//   keeper_<hat|boots|coat|lantern>_<boy|girl>.png (3 x 3, the same rows and columns: the farmer wearing ONE piece)
//     -> assets/keeper_<piece>_<who>: the farmer's walking frames 0-8, in the player sheet's own layout (frames of
//        256 x 384, 8 px margin, 16 px gaps: 816 x 1208, its first three rows). The game puts them over frames 0-8 of
//        the farmer's own sheet (the tools' poses, 9-14, stay the farmer's own). Each row (toward you, away, left) at
//        one scale, its tallest pose as tall as the farmer's own row (assets/player, assets/player_girl: the generator
//        drew some rows bigger than others, and the farmer's are all one height), and each pose then as tall as the
//        farmer's own pose (within 6% of its row's scale: the generator's steps bob, the farmer's do not), its feet on the ground line
//        (372 of 384) and the middle of its feet where the farmer's own pose has them: a lantern held out to one side
//        does not push the farmer over, and nothing jumps when the piece goes on.
//   horse_look_<saddle|bridle|lantern>.png (4 x 4, laid out like ride2_horse: galloping toward you, away, left; then
//        standing toward you, away, left, and rearing)
//     -> assets/horse_look_<id>: the whole horse wearing it, 4 x 4 frames of 252 x 252 like ride2_horse (C.RIDE2,
//        tools/art/riding-v2-import.js): each cell placed as drawn (its middle on the frame's middle), a gallop row on
//        one ground line (its lowest hooves), each standing frame on its own, the ground at 233. Its size: ride2_horse's
//        own, measured from assets/ride2_horse: nose to tail galloping left as long (so it covers the same ground; the
//        owner's look horse is drawn a little taller and leaner than the chubby pony, so it stands a little taller), each
//        standing frame at its gallop row's scale (rearing: standing side on's). It has no shadow sheet of its own: the
//        frames are ride2_horse's, so the game keeps ride2_horseshade under it.
// Then: node build.js (the new pack files come out in dist/packs/, for the CDN's app-assets/packs/).
//   node tools/tower/shop-import.js [icons] [keeper] [gear] [horse]     (none: all)     SHOW=<folder>: contact sheets
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'tower-shop');
const OUT = path.join(ROOT, 'assets');

// The owner's icon picture's cells (1 to 10, left to right, top to bottom), by name; C.TOWER_ICONS' order is the game's.
const SRC_ICONS = ['k_hat', 'k_boots', 'k_coat', 'k_lantern', 'h_saddle', 'h_bridle', 'h_lantern', 'horse_dye', 'tide', 'pearl'];
// For each of C.TOWER_ICONS, its cell in the owner's picture (1-based), or 0 (none: drawn by the game)
const iconFrom = (order) => order.map((name) => SRC_ICONS.indexOf(name) + 1);
const PIECES = ['hat', 'boots', 'coat', 'lantern'], WHO = ['boy', 'girl'], LOOKS = ['saddle', 'bridle', 'lantern'];
// the player sheet's frames (10-boot.js SHEETS.player; tools/art/characters-import.js)
const PL = { fw: 256, fh: 384, base: 372, m: 8, gap: 16 };
const GEAR_W = PL.m * 2 + 3 * PL.fw + 2 * PL.gap, GEAR_H = PL.m + 3 * (PL.fh + PL.gap); // 816 x 1208
// ride2_horse's (C.RIDE2, tools/art/riding-v2-import.js)
const R2 = { fw: 252, fh: 252, feet: 233 };

module.exports = { SRC_ICONS, iconFrom, GEAR_W, GEAR_H };

if (require.main === module) {
  const { chromium } = require('playwright');
  const { config } = require('./tower-art');
  const C = config();
  const ONLY = process.argv.slice(2).length ? process.argv.slice(2) : ['icons', 'keeper', 'gear', 'horse'];
  const SHOW = process.env.SHOW;
  const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const pic = (name) => { const f = path.join(SRC, name + '.png'); return fs.existsSync(f) ? data(f) : null; };
  const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
  const save = (name, r, note) => {
    put(name + '.png', r.png);
    const n = put(name + '.webp', r.webp);
    console.log(('assets/' + name).padEnd(30), (r.w + 'x' + r.h).padEnd(10), (n / 1024).toFixed(0).padStart(4) + ' KB webp', note || '');
    if (SHOW && r.show) { fs.mkdirSync(SHOW, { recursive: true }); fs.writeFileSync(path.join(SHOW, name + '.png'), Buffer.from(r.show.split(',')[1], 'base64')); }
  };

  (async () => {
    if (!fs.existsSync(SRC)) { console.log('No art-src/tower-shop/ yet: the game keeps its stand-ins.'); return; }
    const b = await chromium.launch(), p = await b.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.addScriptTag({ content: require('../art/wild-lib') });

    // ---------- the icons ----------
    if (ONLY.includes('icons') && pic('tower_icons')) {
      const from = iconFrom(C.TOWER_ICONS), CELL = 128, PAD = 6;
      const r = await p.evaluate(async ([src, from, CELL, PAD]) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 3, 0);
        const o = W.canvas(8 * CELL, Math.ceil(from.length / 8) * CELL), g = o.getContext('2d'), miss = [];
        from.forEach((n, i) => {
          if (!n) return; // (the "?": the game's own)
          const x = cl[n - 1];
          if (!x) { miss.push(n); return; }
          const k = Math.min((CELL - PAD * 2) / x.w, (CELL - PAD * 2) / x.h), cx = (i % 8) * CELL + CELL / 2, bottom = Math.floor(i / 8) * CELL + CELL / 2 + x.h * k / 2;
          W.draw(g, x.c, x, k, cx, bottom);
        });
        return Object.assign(W.out(o, 0.9), { w: o.width, h: o.height, miss, show: o.toDataURL('image/png') });
      }, [pic('tower_icons'), from, CELL, PAD]);
      if (r.miss.length) throw new Error('tower_icons: no icon in cells ' + r.miss.join(', '));
      save('tower_icons', r, '(' + C.TOWER_ICONS.map((n, i) => n + '<' + (from[i] || '-')).join(' ') + ')');
    }

    // ---------- Mang Ilaw: a villager's row of 9 ----------
    if (ONLY.includes('keeper') && pic(C.KEEPER.person.sheet)) {
      const r = await p.evaluate(async (s) => {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(s), { holes: true })), 3, 3, 0.02);
        if (cl.some((x) => !x)) throw new Error('npc_keeper: a pose is missing');
        const k = Math.min(...cl.map((x) => Math.min(118 / x.w, 180 / x.h))), o = W.canvas(8 * 2 + 9 * 128 + 8 * 16, 8 * 2 + 192), g = o.getContext('2d');
        cl.forEach((x, i) => W.draw(g, x.c, x, k, 8 + i * 144 + 64, 8 + 186));
        return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height, show: o.toDataURL('image/png') });
      }, pic(C.KEEPER.person.sheet));
      save(C.KEEPER.person.sheet, r);
    }

    // ---------- the farmer wearing one piece: frames 0-8 of the player sheet ----------
    if (ONLY.includes('gear')) {
      const own = {};
      for (const who of WHO) own[who] = data(path.join(OUT, who === 'girl' ? 'player_girl.png' : 'player.png'));
      for (const g of C.KEEPER.gear) for (const who of WHO) {
        const name = g.art + '_' + who, src = pic(name);
        if (!src) continue;
        const r = await p.evaluate(async ([src, ownSrc, PL, GW, GH]) => {
          // the farmer's own frames: where the middle of each pose's feet is (its lowest tenth), and its height
          const im0 = await W.load(ownSrc), c0 = W.canvas(im0.width, im0.height), g0 = c0.getContext('2d');
          g0.drawImage(im0, 0, 0);
          const at = (f) => [PL.m + (f % 3) * (PL.fw + PL.gap), PL.m + Math.floor(f / 3) * (PL.fh + PL.gap)];
          const feetOf = (q, w, h) => { // [middle of the feet, top, bottom] of a picture's alpha (over 24)
            let top = h, bot = -1;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (q[(y * w + x) * 4 + 3] > 24) { if (y < top) top = y; bot = y; }
            const y0 = bot - Math.round((bot - top) * 0.1);
            let l = w, r = -1;
            for (let y = y0; y <= bot; y++) for (let x = 0; x < w; x++) if (q[(y * w + x) * 4 + 3] > 24) { if (x < l) l = x; if (x > r) r = x; }
            return [(l + r + 1) / 2, top, bot];
          };
          const ownFeet = [];
          for (let f = 0; f < 9; f++) { const [x, y] = at(f); ownFeet.push(feetOf(g0.getImageData(x, y, PL.fw, PL.fh).data, PL.fw, PL.fh)); }
          // the haze and faint loose specks out (as characters-import.js), then the 9 poses
          const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 3, 0.02);
          if (cl.some((x) => !x)) throw new Error('a pose is missing');
          // each row (a way it faces) as tall as the farmer's own row: the generator drew some rows bigger than others
          const kRow = [0, 1, 2].map((r) => {
            const own = Math.min(...[0, 1, 2].map((c) => ownFeet[r * 3 + c][1])), tall = Math.max(...[0, 1, 2].map((c) => cl[r * 3 + c].h));
            return Math.min((PL.base - own) / tall, ...[0, 1, 2].map((c) => PL.fw * 0.94 / cl[r * 3 + c].w));
          });
          const o = W.canvas(GW, GH), g = o.getContext('2d'), rep = [];
          cl.forEach((x, f) => {
            const q = x.c.getContext('2d').getImageData(0, 0, x.w, x.h).data, mid = feetOf(q, x.w, x.h)[0];
            const kr = kRow[Math.floor(f / 3)], k = Math.max(kr * 0.94, Math.min(kr * 1.06, (PL.base - ownFeet[f][1]) / x.h, PL.fw * 0.94 / x.w)), [fx, fy] = at(f), left = fx + ownFeet[f][0] - mid * k, dw = x.w * k, dh = x.h * k;
            g.save(); g.beginPath(); g.rect(fx, fy, PL.fw, PL.fh); g.clip();
            g.imageSmoothingQuality = 'high';
            g.drawImage(x.c, 0, 0, x.w, x.h, left, fy + PL.base - dh, dw, dh);
            g.restore();
            const cut = left < fx || left + dw > fx + PL.fw;
            rep.push([Math.round(PL.base - dh), Math.round(dw), Math.round(ownFeet[f][1]), cut ? 'CUT' : '']);
          });
          // to look at: the farmer's own frames 0-8 above, this sheet's below
          const sh = W.canvas(GW, GH * 2), sg = sh.getContext('2d');
          sg.fillStyle = '#9ccf7a'; sg.fillRect(0, 0, GW, GH * 2);
          sg.drawImage(c0, 0, 0, GW, GH, 0, 0, GW, GH); sg.drawImage(o, 0, GH);
          sg.strokeStyle = 'red'; for (let r = 0; r < 6; r++) { sg.beginPath(); sg.moveTo(0, PL.m + (r % 3) * (PL.fh + PL.gap) + PL.base + (r >= 3 ? GH : 0)); sg.lineTo(GW, PL.m + (r % 3) * (PL.fh + PL.gap) + PL.base + (r >= 3 ? GH : 0)); sg.stroke(); }
          return Object.assign(W.out(o, 0.82), { w: GW, h: GH, rep, k: kRow, show: sh.toDataURL('image/png') });
        }, [src, own[who], PL, GEAR_W, GEAR_H]);
        if (r.rep.some((x) => x[3])) throw new Error(name + ': a pose does not fit its frame');
        save(name, r, 'top (own top) ' + r.rep.map((x) => x[0] + '(' + x[2] + ')').join(' '));
      }
    }

    // ---------- the horse's looks: whole horses, laid out like ride2_horse ----------
    if (ONLY.includes('horse')) {
      // ride2_horse's own sizes, frame by frame: [width, height above the ground] of what is solid (alpha over 160)
      const ref = await p.evaluate(async ([src, R2]) => {
        const im = await W.load(src), c = W.canvas(im.width, im.height), g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const out = [];
        for (let i = 0; i < 16; i++) {
          const q = g.getImageData((i % 4) * R2.fw, Math.floor(i / 4) * R2.fh, R2.fw, R2.fh).data;
          let x0 = R2.fw, x1 = -1, top = R2.fh;
          for (let y = 0; y < R2.fh; y++) for (let x = 0; x < R2.fw; x++) if (q[(y * R2.fw + x) * 4 + 3] > 160) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < top) top = y; }
          out.push([x1 - x0 + 1, R2.feet - top]);
        }
        return out;
      }, [data(path.join(OUT, 'ride2_horse.png')), R2]);
      for (const h of C.KEEPER.horse) {
        const src = pic(h.art);
        if (!src) continue;
        const r = await p.evaluate(async ([src, R2, ref]) => {
          const im = await W.load(src), cw = im.width / 4, ch = im.height / 4;
          const cl = W.cells(W.dehalo(W.cutout(im)), 4, 4, 0.02);
          cl.forEach((x, i) => { if (!x) throw new Error('frame ' + i + ' is missing'); });
          const g16 = cl.map((x, i) => x.foot - Math.floor(i / 4) * ch);
          const line = g16.map((gv, i) => (i < 12 ? Math.max(g16[i - i % 4], g16[i - i % 4 + 1], g16[i - i % 4 + 2], g16[i - i % 4 + 3]) : gv));
          // each cell's solid width and height above its ground, in the picture's pixels
          const size = cl.map((x, i) => {
            const q = x.c.getContext('2d').getImageData(0, 0, x.w, x.h).data;
            let x0 = x.w, x1 = -1, top = x.h;
            for (let y = 0; y < x.h; y++) for (let xx = 0; xx < x.w; xx++) if (q[(y * x.w + xx) * 4 + 3] > 160) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < top) top = y; }
            return [x1 - x0 + 1, line[i] - (x.top - Math.floor(i / 4) * ch + top)];
          });
          const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
          const kg = mean([8, 9, 10, 11].map((i) => ref[i][0])) / mean([8, 9, 10, 11].map((i) => size[i][0]));
          // (the standing row: at its gallop row's scale, by what it covers, as riding-v2-import.js brings a standing frame
          // to its gallop row: a horse that stops must not grow or shrink; rearing as standing side on)
          const area = cl.map((x) => { const q = x.c.getContext('2d').getImageData(0, 0, x.w, x.h).data; let n = 0; for (let j = 3; j < q.length; j += 4) if (q[j] > 128) n++; return Math.sqrt(n); });
          const row = (r) => mean([0, 1, 2, 3].map((c) => area[r * 4 + c]));
          const fit = (r, i) => Math.max(0.8, Math.min(1.05, row(r) / area[i]));
          const sc = cl.map((x, i) => kg * (i < 12 ? 1 : i === 12 ? fit(0, 12) : i === 13 ? fit(1, 13) : fit(2, 14)));
          const o = W.canvas(R2.fw * 4, R2.fh * 4), g = o.getContext('2d', { willReadFrequently: true }), got = [];
          g.imageSmoothingQuality = 'high';
          for (let i = 0; i < 16; i++) {
            const fx = (i % 4) * R2.fw, fy = Math.floor(i / 4) * R2.fh, sx = (i % 4) * cw, sy = Math.floor(i / 4) * ch, x = cl[i], kk = sc[i];
            g.save(); g.beginPath(); g.rect(fx, fy, R2.fw, R2.fh); g.clip();
            g.drawImage(x.c, 0, 0, x.w, x.h, fx + R2.fw / 2 + (x.left - sx - cw / 2) * kk, fy + R2.feet + (x.top - sy - line[i]) * kk, x.w * kk, x.h * kk);
            g.restore();
            const q = g.getImageData(fx, fy, R2.fw, R2.fh).data;
            let x0 = R2.fw, x1 = -1, y1 = -1, top = R2.fh;
            for (let y = 0; y < R2.fh; y++) for (let xx = 0; xx < R2.fw; xx++) { const a = q[(y * R2.fw + xx) * 4 + 3]; if (a > 60) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y > y1) y1 = y; } if (a > 160 && y < top) top = y; }
            if (x1 < 0) throw new Error('frame ' + i + ' came out empty');
            if (x0 <= 0 || x1 >= R2.fw - 1 || y1 >= R2.fh - 1) throw new Error('frame ' + i + ' does not fit its frame');
            got.push([x1 - x0 + 1, R2.feet - top]);
          }
          return Object.assign(W.out(o, 0.8), { w: o.width, h: o.height, got, kg, show: o.toDataURL('image/png') });
        }, [src, R2, ref]);
        save(h.art, r, 'w/h ' + r.got.map((x, i) => x.join('/') + '(' + ref[i].join('/') + ')').join(' '));
      }
    }
    await b.close();
    if (errors.length) throw new Error(errors.join('\n'));
  })().catch((e) => { console.error(e); process.exit(1); });
}

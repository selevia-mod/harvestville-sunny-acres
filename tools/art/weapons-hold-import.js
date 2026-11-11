'use strict';
// The farmer HOLDING each weapon (owner, 11 Nov 2026; ~/Downloads/weapon-in-hand-simple/WEAPON-IN-HAND-SIMPLE-PROMPTS.md):
// ONE picture a direction, 1536 x 512 on flat magenta, the farmer 3 times side by side (left to right: ready, aim or
// throw, after or catch), the weapon drawn in the hands:
//   art-src/weapons/hold/<weapon>-<boy|girl>-<left|front|back>.png             (left: side on, facing left; right is it mirrored)
//   art-src/weapons/hold/<outfit>-<weapon>-<boy|girl>-<left|front|back>.png    (a Tailor Shop look, later)
// Each weapon and look becomes one sheet in the weapons pack (never the page), in the pose sheets' layout: 3 x 3 frames
// of 384 (rows facing you, away, left), margin 8, gaps 16 -> assets/wpn_hold_[<outfit>_]<weapon>_<boy|girl>. A sheet
// whose weapon reaches far to the side (a javelin's shaft) gets wider frames instead, 448 to 640 (the game reads the
// width from its size), so the farmer is never made smaller to fit.
// The three poses are found as figures (the picture's spacing varies: not fixed thirds): the 3 biggest pieces are the
// farmer, every smaller piece (a weapon's tip, a strap) goes with the nearest; a big loose one (a boomerang drawn flying
// beside the hand) is left out: the game flies its own. Each direction is sized so the farmer is as
// tall as in the walking sheet (348, cap to boots: the middle of the 3, so a raised javelin doesn't shrink him), never out
// of its frame, his boots on the walking sheet's line (370) and centred under the frame's middle. A direction with no
// picture stays empty in the sheet, and the game draws that direction the old way (src/00-...-hold-rows.js lists the
// directions each sheet has). The PNG is full size, the WebP the game loads half (assets/sizes.json: the full size).
// Where the hand and the weapon's tip are in each pose is in the game (F.WPN_HOLD_PTS): measure them on new pictures.
// HOLD_ART=<folder> and HOLD_OUT=<folder> read and write elsewhere (to try it out; then nothing in src/ or sizes.json).
// node tools/art/weapons-hold-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ART = process.env.HOLD_ART || path.join(ROOT, 'art-src', 'weapons', 'hold');
const OUT = process.env.HOLD_OUT || path.join(ROOT, 'assets');
const REAL = OUT === path.join(ROOT, 'assets');
const WEAPONS = ['rifle', 'javelin', 'boomerang', 'bow'];
const ROWS = ['front', 'back', 'left']; // (the sheet's rows: facing you, away, left)
const FW = 384, FW_WIDE = [448, 512, 576, 640], FH = 384, BASE = 370, TALL = 348;

(async () => {
  const sheets = {}; // key -> { row: file }
  if (fs.existsSync(ART)) fs.readdirSync(ART).forEach((f) => {
    const m = /^(?:([a-z]+)-)?([a-z]+)-(boy|girl)-(left|front|back)\.png$/.exec(f);
    if (!m || WEAPONS.indexOf(m[2]) < 0) return;
    const key = 'wpn_hold_' + (m[1] ? m[1] + '_' : '') + m[2] + '_' + m[3];
    (sheets[key] = sheets[key] || {})[m[4]] = f;
  });
  const rows = {};
  if (!Object.keys(sheets).length) console.log('nothing to import yet: <weapon>-<boy|girl>-<left|front|back>.png in ' + path.relative(ROOT, ART));
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const sizesFile = path.join(ROOT, 'assets', 'sizes.json'), sizes = JSON.parse(fs.readFileSync(sizesFile, 'utf8'));
  for (const key of Object.keys(sheets).sort()) {
    const have = ROWS.filter((r) => sheets[key][r]);
    const srcs = ROWS.map((r) => (sheets[key][r] ? 'data:image/png;base64,' + fs.readFileSync(path.join(ART, sheets[key][r])).toString('base64') : null));
    const run = (FW) => p.evaluate(async ([srcs, FW, FH, BASE, TALL]) => {
      // the three figures of a picture: { c (canvas holding only its pieces), w, h, fx (the boots' middle) }
      const figures = (c) => {
        const w = c.width, h = c.height, px = c.getContext('2d').getImageData(0, 0, w, h).data, lab = new Int32Array(w * h), comps = [null];
        for (let k0 = 0; k0 < w * h; k0++) {
          if (lab[k0] || px[k0 * 4 + 3] < 40) continue;
          const id = comps.length, q = [k0], o = { x0: w, x1: 0, y0: h, y1: 0, n: 0 };
          lab[k0] = id;
          while (q.length) {
            const m = q.pop(), mx = m % w, my = (m - mx) / w;
            o.n++; if (mx < o.x0) o.x0 = mx; if (mx > o.x1) o.x1 = mx; if (my < o.y0) o.y0 = my; if (my > o.y1) o.y1 = my;
            [m - 1, m + 1, m - w, m + w].forEach((k, j) => {
              if ((j === 0 && mx === 0) || (j === 1 && mx === w - 1) || k < 0 || k >= w * h) return;
              if (!lab[k] && px[k * 4 + 3] >= 40) { lab[k] = id; q.push(k); }
            });
          }
          comps.push(o);
        }
        const big = comps.slice(1).map((o, i) => Object.assign(o, { id: i + 1 })).filter((o) => o.n >= 60).sort((a, z) => z.n - a.n);
        if (big.length < 3) throw new Error('3 poses side by side, each on its own: found ' + big.length);
        const main = big.slice(0, 3).sort((a, z) => a.x0 - z.x0), owner = {};
        main.forEach((o, i) => { owner[o.id] = i; });
        // a big loose piece is the weapon flying beside the hand (a boomerang just thrown): the game draws its own, so it goes
        const flying = big.slice(3).filter((o) => o.n > Math.max(600, main[0].n * 0.015));
        flying.forEach((o) => { owner[o.id] = -1; });
        if (flying.length) dropped.push(flying.length);
        big.slice(3).filter((o) => flying.indexOf(o) < 0).forEach((o) => { // (a loose piece: with the figure whose middle is nearest)
          const cx = (o.x0 + o.x1) / 2;
          let best = 0, bd = Infinity;
          main.forEach((m, i) => { const d = Math.abs(cx - (m.x0 + m.x1) / 2); if (d < bd) { bd = d; best = i; } });
          owner[o.id] = best;
          const m = main[best]; m.x0 = Math.min(m.x0, o.x0); m.x1 = Math.max(m.x1, o.x1); m.y0 = Math.min(m.y0, o.y0); m.y1 = Math.max(m.y1, o.y1);
        });
        return main.map((m, i) => {
          const fw = m.x1 - m.x0 + 1, fh = m.y1 - m.y0 + 1, o = W.canvas(fw, fh), g = o.getContext('2d'), d = g.createImageData(fw, fh);
          for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
            const k = (m.y0 + y) * w + m.x0 + x, L = lab[k];
            if (!L || owner[L] !== i) continue; // (only this figure's pieces; the soft edge comes with them)
            for (let c = 0; c < 4; c++) d.data[(y * fw + x) * 4 + c] = px[k * 4 + c];
          }
          g.putImageData(d, 0, 0);
          // the boots' middle: the opaque pixels in its bottom rows
          const rows = Math.max(3, Math.round(fh * 0.05)), bd = g.getImageData(0, fh - rows, fw, rows).data;
          let n = 0, sx = 0;
          for (let j = 0; j < bd.length; j += 4) if (bd[j + 3] > 80) { n++; sx += (j / 4) % fw; }
          return { c: o, w: fw, h: fh, fx: n ? sx / n : fw / 2 };
        });
      };
      const dropped = [], narrow = [];
      const sheet = W.canvas(8 * 2 + FW * 3 + 16 * 2, 8 * 2 + FH * 3 + 16 * 2), g = sheet.getContext('2d'), scales = [];
      g.imageSmoothingQuality = 'high';
      for (let row = 0; row < 3; row++) {
        if (!srcs[row]) { scales.push(null); continue; }
        // (a pocket of the flat magenta shut in between an arm and the body: dark strongly-purple pixels go, as in the pose import)
        const c0 = W.cutout(await W.load(srcs[row])), g0 = c0.getContext('2d'), d0 = g0.getImageData(0, 0, c0.width, c0.height), q0 = d0.data;
        for (let i = 0; i < q0.length; i += 4) { const r = q0[i], gg = q0[i + 1], bl = q0[i + 2]; if (q0[i + 3] && r - gg > 40 && bl - gg > 40 && gg < 90 && Math.abs(r - bl) < 90 && bl - r < 30) q0[i + 3] = 0; } // (magenta: blue no more than red; the girl's lavender is clearly bluer)
        g0.putImageData(d0, 0, 0);
        const fig = figures(W.dehalo(c0)), med = fig.map((q) => q.h).sort((a, z) => a - z)[1];
        let k = TALL / med;
        fig.forEach((q) => { k = Math.min(k, (BASE - 2) / q.h); });
        const tall = k;
        fig.forEach((q) => { k = Math.min(k, (FW / 2 - 2) / Math.max(q.fx, q.w - q.fx)); }); // (never out of its frame)
        if (k < tall * 0.97) narrow.push(row);
        fig.forEach((q, col) => {
          const ox = 8 + col * (FW + 16), oy = 8 + row * (FH + 16);
          g.drawImage(q.c, 0, 0, q.w, q.h, ox + FW / 2 - q.fx * k, oy + BASE - q.h * k, q.w * k, q.h * k);
        });
        scales.push(Math.round(k * 1000) / 1000);
      }
      const half = W.canvas(sheet.width / 2, sheet.height / 2), hg = half.getContext('2d');
      hg.imageSmoothingQuality = 'high';
      hg.drawImage(sheet, 0, 0, half.width, half.height);
      return { png: sheet.toDataURL('image/png'), webp: half.toDataURL('image/webp', 0.82), w: sheet.width, h: sheet.height, scales, dropped: dropped.length, narrow };
    }, [srcs, FW, FH, BASE, TALL]).catch((e) => { throw new Error(key + ': ' + e.message); });
    // (a weapon held far out to the side, a javelin's long shaft: frames 512 wide, so the farmer keeps his size)
    let r = await run(FW);
    for (const wide of FW_WIDE) { if (!r.narrow.length) break; r = await run(wide); }
    fs.writeFileSync(path.join(OUT, key + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, key + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
    if (REAL) sizes[key] = [r.w, r.h];
    rows[key] = have;
    console.log(key, (r.w > 1200 ? '(frames ' + Math.round((r.w - 48) / 3) + ' wide) ' : '') + ROWS.map((row, i) => row + (r.scales[i] ? ' x' + r.scales[i] : ' (none: the old way)')).join(', ') + (r.dropped ? ' | a flying weapon left out of ' + r.dropped + ' picture(s)' : ''));
  }
  await b.close();
  if (!REAL) return;
  fs.writeFileSync(sizesFile, JSON.stringify(sizes, null, 1) + '\n');
  fs.writeFileSync(path.join(ROOT, 'src', '00-zzzzzzzzzzzzzzzzzzzzz-hold-rows.js'),
    '// Made by tools/art/weapons-hold-import.js (do not edit: run it again). The directions each weapon-in-hand sheet has\n' +
    '// (rows: front = facing you, back = away, left = side on, mirrored for right); a direction not listed is drawn the old way.\n' +
    '(function (F) {\n  \'use strict\';\n  F.Config.WPN_HOLD_ROWS = ' + JSON.stringify(rows) + ';\n})(window.Farm = window.Farm || {});\n');
})().catch((e) => { console.error(e.message || e); process.exit(1); });

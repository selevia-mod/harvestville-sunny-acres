'use strict';
// The new weapons' pictures (owner's batch 6, art-src/MANILA-PROMPTS.md 100-114) into the weapons pack (tools/packs.js),
// in the layouts the game reads (src/19zzzzzzzzzzzzzzzzzzzzzzzzzzz-weapons-art.js). Until a picture is in, the game draws
// its stand-in, so any of these can be missing: what is there goes in.
//   art-src/weapons/icons_rifle.png, icons_javelin.png, icons_boomerang.png (3 x 2: Basic..Moon), icons_ammo.png (2 x 2:
//     bullets, javelins, a repair kit (no slot yet), a broken boomerang)        -> assets/wpn_icons (8 x 3 cells of 128)
//   held_rifle.png, held_javelin.png (3 x 2, side on, pointing right)        -> assets/wpn_held (6 x 2 cells of 256 x 96)
//   spin_boomerang.png (4 x 6: a row a level)                                  -> assets/wpn_spin (4 x 6 cells of 128)
//   proj_bullet.png (3 x 2)                                                    -> assets/wpn_bullet (6 cells of 128)
//   rifle-boy.png, rifle-girl.png, javelin-boy.png ... boomerang-girl.png (3 x 3 poses, as the archer's)
//                                                         -> assets/wpn_pose_<weapon>[_girl] (the archer frames: 288 x 384)
// Then: node build.js (the page stays the same size; the pictures go to dist/packs), and look at them in a hunting ground.
// WPN_ART=<folder> and WPN_OUT=<folder> read and write elsewhere (to try it out).
// node tools/art/weapons-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ART = process.env.WPN_ART || path.join(ROOT, 'art-src', 'weapons');
const OUT = process.env.WPN_OUT || path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const has = (f) => fs.existsSync(path.join(ART, f));
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(ART, f)).toString('base64');
const save = (name, r) => {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('wrote', name);
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  // cells of a sheet, each fitted into a w x h box (one scale for the whole sheet when `same`), as data URLs
  const cut = (file, cols, rows, w, h, same) => p.evaluate(async ([src, cols, rows, w, h, same]) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), cols, rows, 0.02);
    const fit = (q) => Math.min(w * 0.9 / q.w, h * 0.9 / q.h);
    const one = Math.min(...cl.filter(Boolean).map(fit));
    return cl.map((q) => {
      if (!q) return null;
      const o = W.canvas(w, h);
      W.draw(o.getContext('2d'), q.c, q, same ? one : fit(q), w / 2, null, h / 2);
      return o.toDataURL('image/png');
    });
  }, [data(file), cols, rows, w, h, !!same]).catch((e) => { throw new Error(file + ': ' + e.message); });
  // a sheet of `cols` cells of w x h from a list of data URLs (null: left empty)
  const sheet = (list, cols, w, h, gap) => p.evaluate(async ([list, cols, w, h, gap]) => {
    const rows = Math.ceil(list.length / cols), m = gap ? 8 : 0, s = gap ? 16 : 0;
    const c = W.canvas(m * 2 + cols * w + (cols - 1) * s, m * 2 + rows * h + (rows - 1) * s), g = c.getContext('2d');
    for (let i = 0; i < list.length; i++) if (list[i]) g.drawImage(await W.load(list[i]), m + (i % cols) * (w + s), m + Math.floor(i / cols) * (h + s));
    return W.out(c, 0.8);
  }, [list, cols, w, h, !!gap]);

  // ---------- the icons ----------
  const icons = {};
  for (const k of C.WEAPON_KINDS) if (has('icons_' + k + '.png')) (await cut('icons_' + k + '.png', 3, 2, 128, 128)).forEach((u, i) => { icons[k + '_' + i] = u; });
  if (has('icons_ammo.png')) {
    const a = await cut('icons_ammo.png', 2, 2, 128, 128);
    icons.bullets = a[0]; icons.javelins = a[1]; icons.boomerang_broken = a[3]; // (a[2], the repair kit: no slot yet)
  }
  if (Object.keys(icons).length) {
    // (an icon with no picture yet: the game's own drawing stays in its cell, so the sheet only goes in once it is whole)
    const missing = C.WPN_ICONS.filter((n) => !icons[n]);
    if (missing.length) console.log('icons: waiting for', missing.join(' '), '(wpn_icons is written once all are in)');
    else save('wpn_icons', await sheet(C.WPN_ICONS.map((n) => icons[n]), 8, 128, 128));
  }
  // ---------- held, spinning, the bullet ----------
  if (has('held_rifle.png') && has('held_javelin.png')) save('wpn_held', await sheet((await cut('held_rifle.png', 3, 2, 256, 96, true)).concat(await cut('held_javelin.png', 3, 2, 256, 96, true)), 6, 256, 96));
  if (has('spin_boomerang.png')) save('wpn_spin', await sheet(await cut('spin_boomerang.png', 4, 6, 128, 128, true), 4, 128, 128));
  if (has('proj_bullet.png')) save('wpn_bullet', await sheet(await cut('proj_bullet.png', 3, 2, 128, 128, true), 6, 128, 128));
  // ---------- the farmer's poses: the archer's frames, each pose stood on its feet (as tools/art/archer-import.js) ----------
  for (const k of C.WEAPON_KINDS) for (const who of ['boy', 'girl']) {
    const f = k + '-' + who + '.png';
    if (!has(f)) continue;
    const poses = await p.evaluate(async ([src]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 3, 0.02), FW = 288, FH = 384, BASE = 372;
      const k = Math.min(...cl.filter(Boolean).map((q) => Math.min(FW * 0.96 / q.w, FH * 0.94 / q.h)));
      return cl.map((q) => { if (!q) return null; const o = W.canvas(FW, FH); W.draw(o.getContext('2d'), q.c, q, k, FW / 2, BASE); return o.toDataURL('image/png'); });
    }, [data(f)]).catch((e) => { throw new Error(f + ': ' + e.message); });
    save('wpn_pose_' + k + (who === 'girl' ? '_girl' : ''), await sheet(poses, 3, 288, 384, true));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });

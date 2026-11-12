'use strict';
// The Lost Tower's pictures (owner, 12 Nov 2026; prompts art-src/LOST-TOWER-PROMPTS.md, pictures in art-src/tower/zone<n>/)
// into the game's sizes. Every file goes in the 'tower' pack, never the page (tools/tower/tower-art.js, tools/packs.js).
// Run it whenever pictures come in: each part runs when its picture is there, the rest keep their stand-ins.
//   assets/wild_<id>.*, wild_<id>shade.*  each creature's 3 x 4 poses as one row of 12 frames in the wild sheet's order and
//                       size (FW x FH, its feet on FEET: tools/art/animals3q-import.js, 19v-wild.js): 0-2 walking toward
//                       you, 3-5 away, 6-8 left (stand, step, step), then 9 facing you (alert), 10 and 11 facing left (10:
//                       standing about, 11: the long leap of a charge, or flying): the picture's row 4 (three attack poses,
//                       some facing you, some left) gives them, chosen by POSES below. Each pose is found on its own (the
//                       pictures are not lined up with their cells), stood on the feet line (a hovering one: its row's
//                       poses keep one height, by their middles) and centred by its weight, all 12 at one scale, the
//                       biggest that fits; the shadows from the feet, found as animals3q-import.js finds them. Prints
//                       each one's width walking left (its px in the game) and writes them to
//                       src/00-zzzzzzzzzzzzzzzzzzzzzz-towerpx.js.
//                       Stored at 3/4 size (assets/sizes.json), the mini bosses and the big bosses at full size: they
//                       stand 2.5 and 3.4 tiles wide in the game.
//   assets/tower_cave_<n>.*  the realm's cave tiles, laid out like assets/lair_cave (19zt-lair.js CAVE): floor, floor moved
//                       by half, wall face, wall top, water (the 'void' tile under the pools), then the water again at 192
//                       px, the pools' pattern. Each 1024 texture scaled down whole to its tile and made to wrap (its outer
//                       part the picture moved by half, faded in), so copies side by side show no line.
//   assets/props/tower_<n>_<k>.*  the realm's 6 props (props.png, 3 x 2, k = 1..6), each 2.5 tiles wide at 128 px a tile,
//                       standing on its bottom edge. The floor's stand-in props (C.TOWER zone props) show them instead,
//                       on the same tile and solid foot (19zzz...z-tower.js), so the room and the server's map stay as they
//                       are.
// The realms' stairs pictures are not used (the owner turned them down, 12 Nov 2026).
// node tools/tower/tower-import.js [zone ...]          (SHOW=<folder>: each sheet's 12 frames to look at)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { config } = require('./tower-art');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'tower');
const OUT = path.join(ROOT, 'assets');
const PX_FILE = path.join(ROOT, 'src', '00-zzzzzzzzzzzzzzzzzzzzzz-towerpx.js');
const C = config();
const FW = 224, FH = 252, M = 8, G = 16, FEET = 233, SHADE = 3; // (the wild sheet's: 10-boot.js, 19v-wild.js, animals3q-import.js)
const TILE = 128, POOL = 192, PROP_W = 320;
const ZONES = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : C.TOWER.zones.map((z) => z.n);

// Which of the picture's 12 cells (row by row, 0..11) shows as frames 9, 10 and 11. From the prompts' row 4 (facing you or
// to the LEFT): 9 an attack pose facing you; 11 one going LEFT (the game shows it between steps when one charges sideways,
// and for a flier on the wing); 10 the third, standing about. A pose for a realm's trick (bursting, splitting, reviving,
// lying, melting, going dark, a cracked shield) is never used: a cell of rows 1-3 stands in (0 facing you, 6 left, 8 a step).
const POSES = {
  talangka: [9, 11, 10], kanaway: [9, 11, 10], igat: [9, 11, 10], alimango: [9, 10, 11], ulang: [9, 11, 10], tambanakua: [9, 10, 11],
  kugita: [9, 11, 10], umang: [9, 6, 11], dikya: [9, 11, 10], kugita_kabalyero: [9, 6, 10], pating: [9, 6, 10], pugita: [9, 10, 11],
  palakang_putik: [9, 6, 11], kuhol: [9, 6, 11], parol_multo: [9, 6, 11], putik_golem: [9, 6, 10], dambuhalang_kuhol: [9, 6, 10], berberoka: [9, 11, 10],
  sirena: [9, 11, 10], dikya_buwan: [9, 11, 10], palakang_buwan: [9, 11, 10], sirena_koro: [9, 11, 10], sirenang_bituin: [9, 6, 10], magindara: [9, 11, 10],
  langay: [9, 6, 10], kabag: [9, 10, 11], ulap: [9, 11, 10], lawin_kidlat: [9, 11, 10], bagyo: [9, 6, 10], galura: [9, 11, 10],
  kataw: [9, 11, 10], kataw_manggagamot: [9, 11, 10], kabayo_dagat: [9, 11, 10], bantay_hari: [9, 11, 10], kataw_reyna: [9, 11, 10], kataw_hari: [9, 11, 10],
  santelmong_asul: [9, 6, 10], alitaptap: [9, 6, 11], anino: [9, 6, 11], lampara_golem: [9, 6, 10], dambuhalang_anino: [9, 11, 10], dakilang_santelmo: [9, 11, 10],
  engkanto: [0, 6, 10], minokawa_sisiw: [9, 6, 10], ulap_blob: [11, 6, 10], bantay_biringan: [9, 6, 10], tigmamanukan: [9, 6, 10], minokawa: [9, 11, 10],
  tala: [9, 6, 8], bituing_alimasag: [9, 6, 10], gamugamo_buwan: [9, 6, 10], bituing_golem: [9, 6, 10], pagong_batong_buwan: [9, 6, 10], tagapag_ingat_bituin: [9, 6, 10],
  bakunawa_anak: [9, 11, 10], laho: [9, 6, 11], parola_golem: [9, 11, 10], bakunawa_bata: [9, 11, 10], dakilang_laho: [9, 11, 10], bakunawa_ng_look: [9, 11, 10],
};
// drawn hovering (the prompts' "flying loop"): a row's poses keep one height (by their middles), not each on its lowest point
const HOVER = ['kanaway', 'dikya', 'parol_multo', 'dikya_buwan', 'langay', 'kabag', 'ulap', 'lawin_kidlat', 'bagyo', 'galura', 'santelmong_asul', 'alitaptap',
  'dakilang_santelmo', 'minokawa_sisiw', 'tigmamanukan', 'minokawa', 'tala', 'gamugamo_buwan', 'laho', 'dakilang_laho'];

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
const kb = (n) => (n / 1024).toFixed(0) + ' KB';

// ---------- in the page: one creature's sheet and its shadows ----------
const SHEET_CODE = async ([src, opt, FW, FH, M, G, FEET, SHADE]) => {
  const im = await W.load(src), cl = W.cells(W.cutout(im), 3, 4);
  cl.forEach((c, i) => { if (!c) throw new Error('pose ' + (i + 1) + ' (row ' + (Math.floor(i / 3) + 1) + ', column ' + (i % 3 + 1) + ') is missing'); });
  // each pose's middle by its weight (a claw or a splash reaching out does not move the body)
  cl.forEach((c) => {
    const d = c.c.getContext('2d').getImageData(0, 0, c.w, c.h).data;
    let n = 0, sx = 0, sy = 0;
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const a = d[(y * c.w + x) * 4 + 3]; if (a > 60) { n++; sx += x; sy += y; } }
    c.mx = n ? sx / n : c.w / 2; c.my = n ? sy / n : c.h / 2;
    c.fy = c.foot - c.top; // its feet, from its top
  });
  // the 12 frames, from the cells: rows 1-3 as they are, then frames 9-11 as opt.poses says
  const pick = [0, 1, 2, 3, 4, 5, 6, 7, 8].concat(opt.poses);
  // where each one's feet go, from its top: on its own lowest point; hovering, a row's three at its middle's height
  const low = pick.map((k, i) => {
    const c = cl[k];
    if (!opt.hover || i >= 9) return c.fy;
    const row = [0, 1, 2].map((j) => cl[i - i % 3 + j]), below = Math.max(...row.map((r) => r.fy - r.my));
    return c.my + below;
  });
  // one scale for all: the biggest that fits every pose in its frame (no bigger than the picture)
  let k = 1;
  pick.forEach((idx, i) => {
    const c = cl[idx], half = Math.max(c.mx, c.w - c.mx);
    k = Math.min(k, (FW / 2 - 4) / half, (FEET - 6) / low[i]);
  });
  const sheet = W.canvas(M * 2 + 12 * FW + 11 * G, M * 2 + FH), g = sheet.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  pick.forEach((idx, i) => {
    const c = cl[idx], x = M + i * (FW + G), y = M;
    g.save();
    g.beginPath(); g.rect(x, y, FW, FH); g.clip();
    g.drawImage(c.c, x + FW / 2 - c.mx * k, y + FEET - low[i] * k, c.w * k, c.h * k);
    g.restore();
  });
  // ---- the shadows (as tools/art/animals3q-import.js) ----
  const frameBox = (fx, fy) => {
    const d = g.getImageData(fx, fy, FW, FH).data, on = (x, y) => d[(y * FW + x) * 4 + 3] > 60;
    let x0 = FW, x1 = -1, y0 = FH, y1 = -1;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, x1, y0, y1, on };
  };
  const findFeet = (b) => {
    const bot = new Array(FW).fill(-1), h = b.y1 - b.y0 + 1, top = b.y1 - h * 0.42;
    for (let x = b.x0; x <= b.x1; x++) for (let y = b.y1; y >= b.y0; y--) if (b.on(x, y)) { bot[x] = y; break; }
    const peaks = [];
    for (let x = b.x0; x <= b.x1; x++) {
      if (bot[x] < 0) continue;
      let e = x;
      while (e < b.x1 && bot[e + 1] === bot[x]) e++;
      if ((bot[x - 1] === undefined || bot[x - 1] < bot[x]) && (bot[e + 1] === undefined || bot[e + 1] < bot[x])) {
        const y = bot[x];
        let l = y, r = y;
        for (let q = x - 1; q >= b.x0 && bot[q] <= y; q--) l = Math.min(l, bot[q] < 0 ? b.y0 : bot[q]);
        for (let q = e + 1; q <= b.x1 && bot[q] <= y; q++) r = Math.min(r, bot[q] < 0 ? b.y0 : bot[q]);
        const rise = y - Math.max(l, r);
        if (y >= top && rise >= 8) peaks.push({ x: (x + e) / 2, y, rise });
      }
      x = e;
    }
    peaks.sort((p, q) => q.y - p.y);
    const near = Math.max(14, (b.x1 - b.x0) * 0.11), feet = [];
    peaks.forEach((p) => { if (!feet.some((f) => Math.abs(f.x - p.x) < near && Math.abs(f.y - p.y) < 22)) feet.push(p); });
    feet.forEach((f) => {
      let l = f.x, r = f.x;
      while (bot[Math.floor(l) - 1] >= f.y - 7) l--;
      while (bot[Math.ceil(r) + 1] >= f.y - 7) r++;
      f.x = (l + r) / 2; f.w = r - l + 1;
    });
    if (feet.length < 2) [[b.x0, (b.x0 + b.x1) / 2], [(b.x0 + b.x1) / 2, b.x1]].forEach(([a, z]) => {
      let at = -1;
      for (let x = Math.ceil(a); x <= z; x++) if (bot[x] >= 0 && (at < 0 || bot[x] > bot[at])) at = x;
      if (at >= 0 && bot[at] >= b.y1 - h * 0.55 && !feet.some((f) => Math.abs(f.x - at) < near)) feet.push({ x: at, y: bot[at], w: 18 });
    });
    return feet.slice(0, 4);
  };
  const shade = W.canvas(sheet.width, sheet.height), sg = shade.getContext('2d');
  const drawShade = (fx, fy, i, b, feet) => {
    sg.save();
    sg.beginPath(); sg.rect(fx, fy, FW, FH); sg.clip();
    sg.translate(fx, fy);
    const blob = (x, y, rx, ry, a, blur) => { sg.filter = 'blur(' + blur + 'px)'; sg.fillStyle = 'rgba(0,0,0,' + a + ')'; sg.beginPath(); sg.ellipse(x, y, rx, ry, 0, 0, 7); sg.fill(); };
    const w = b.x1 - b.x0 + 1, mid = (b.x0 + b.x1) / 2;
    if (opt.hover || (i === 11 && !opt.ground) || feet.length < 2) { // (in the air, or no clear feet: a soft oval below)
      const air = opt.hover || (i === 11 && !opt.ground);
      blob(mid + 2, air || !feet.length ? FEET - 12 : feet[0].y - 6, w * 0.36, w * 0.13, 0.46, air ? 6 : 5);
      if (!air) feet.forEach((f) => { const rx = Math.min(20, Math.max(7, f.w * 0.66)); blob(f.x + 1, f.y - 1, rx, rx * 0.45, 0.55, 1.5); });
    } else { // (on its feet: a soft oval joining them, a dark patch under each; not the hull animals3q-import.js draws, which
      // spreads into a dark box under the wispy and spiky ones here)
      const xs = feet.map((f) => f.x), lo = Math.max(...feet.map((f) => f.y)), span = Math.max(...xs) - Math.min(...xs);
      const rx = Math.min(w * 0.46, span / 2 + 16);
      blob((Math.min(...xs) + Math.max(...xs)) / 2 + 2, lo - 4, rx, Math.max(8, rx * 0.28), 0.42, 5);
      feet.filter((f) => f.y > lo - 30).forEach((f) => { const r = Math.min(20, Math.max(7, f.w * 0.66)); blob(f.x + 1, f.y - 1, r, r * 0.45, 0.5, 1.5); });
    }
    sg.restore();
  };
  let px = 0;
  const boxes = [];
  for (let i = 0; i < 12; i++) {
    const fx = M + i * (FW + G), b = frameBox(fx, M);
    if (i === 6) px = b.x1 - b.x0 + 1;
    boxes.push([b.x0, b.y0, b.x1, b.y1]);
    drawShade(fx, M, i, b, findFeet(b));
  }
  const small = W.canvas(Math.round(sheet.width / SHADE), Math.round(sheet.height / SHADE)), smg = small.getContext('2d');
  smg.imageSmoothingQuality = 'high';
  smg.drawImage(shade, 0, 0, small.width, small.height);
  let stored = sheet;
  if (opt.store < 1) {
    stored = W.canvas(Math.round(sheet.width * opt.store), Math.round(sheet.height * opt.store));
    const stg = stored.getContext('2d');
    stg.imageSmoothingQuality = 'high';
    stg.drawImage(sheet, 0, 0, stored.width, stored.height);
  }
  // the picture to look at: the frames on grey with the shadow, numbered
  const show = W.canvas(sheet.width, sheet.height + 18), shg = show.getContext('2d');
  shg.fillStyle = '#6a7458'; shg.fillRect(0, 0, show.width, show.height);
  shg.drawImage(small, 0, 18, sheet.width, sheet.height); shg.drawImage(sheet, 0, 18);
  shg.fillStyle = '#fff'; shg.font = 'bold 14px sans-serif';
  for (let i = 0; i < 12; i++) { shg.fillText(String(i), M + i * (FW + G) + 4, 14); shg.fillStyle = 'rgba(255,255,255,0.35)'; shg.fillRect(M + i * (FW + G), 18 + M + FEET, FW, 1); shg.fillStyle = '#fff'; }
  return { png: stored.toDataURL('image/png'), webp: stored.toDataURL('image/webp', 0.8), shadePng: small.toDataURL('image/png'), shadeWebp: small.toDataURL('image/webp', 0.7),
    show: show.toDataURL('image/png'), px, k, boxes, w: sheet.width, h: sheet.height };
};

// ---------- in the page: the cave tiles (as places-import.js) ----------
const CAVE_CODE = async ([floor, water, top, face, S, LV]) => {
  // A picture scaled down whole to one tile, made to wrap: the outer part of the tile is the picture moved by half (whose
  // edges meet across the wrap), faded into the picture itself in the middle. (Evening out the edge colours only, as
  // lair-world-import.js does, left lines where these tiles meet.) both: up and down too (the wall face only wraps across).
  const N0 = (img, N) => { const c = W.canvas(N, N), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, N, N); return c; };
  const moved = (c, dx, dy) => { // moved by half across (dx) and/or down (dy), wrapping round
    const N = c.width, o = W.canvas(N, N), g = o.getContext('2d');
    [[-1, -1], [0, -1], [-1, 0], [0, 0]].forEach((q) => g.drawImage(c, dx ? N / 2 + q[0] * N : 0, dy ? N / 2 + q[1] * N : 0));
    return o;
  };
  // mid in the middle, out toward the edges (across: the left and right edges; down: the top and bottom)
  const fade = (mid, out, across, down) => {
    const N = mid.width, o = W.canvas(N, N), a = mid.getContext('2d').getImageData(0, 0, N, N), b = out.getContext('2d').getImageData(0, 0, N, N), band = N * 0.3;
    const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = (across ? ease(Math.min(x + 0.5, N - x - 0.5) / band) : 1) * (down ? ease(Math.min(y + 0.5, N - y - 0.5) / band) : 1), i = (y * N + x) * 4;
      for (let ch = 0; ch < 4; ch++) a.data[i + ch] = a.data[i + ch] * k + b.data[i + ch] * (1 - k);
    }
    o.getContext('2d').putImageData(a, 0, 0);
    return o;
  };
  // one way, then the other (each pass keeps the wrap the one before made)
  const wrap = (img, N, both) => {
    const c = fade(N0(img, N), moved(N0(img, N), true, false), true, false);
    return both ? fade(c, moved(c, false, true), false, true) : c;
  };
  const fl = wrap(await W.load(floor), S, true), wt = await W.load(water);
  // cave2: the same floor with another part of it in the middle and the very same edges, so the two kinds of floor tile
  // sit side by side in any order
  const v = fade(moved(fl, true, true), fl, true, true);
  const tiles = [fl, v, wrap(await W.load(face), S, false), wrap(await W.load(top), S, true), wrap(wt, S, true), wrap(wt, LV, true)];
  const o = W.canvas(S * 5 + LV, LV), g = o.getContext('2d');
  tiles.forEach((c, i) => g.drawImage(c, i * S, 0));
  return Object.assign(W.out(o, 0.9), { w: o.width, h: o.height });
};

// ---------- in the page: the 6 props ----------
const PROPS_CODE = async ([src, ow]) => {
  const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 2, 0.02);
  return cl.map((x, i) => {
    if (!x) throw new Error('prop ' + (i + 1) + ' is missing');
    const oh = Math.round(ow * x.h / x.w), o = W.canvas(ow, oh);
    W.draw(o.getContext('2d'), x.c, x, ow / x.w, ow / 2, oh);
    return Object.assign(W.out(o, 0.85), { w: ow, h: oh });
  });
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('../art/wild-lib') });
  const sizes = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8'));
  const pxs = Object.assign({}, C.TOWER.artPx || {}); // (the zones not run this time keep theirs)
  const done = [];
  for (const zn of ZONES) {
    const z = C.TOWER.zones[zn - 1], dir = path.join(SRC, 'zone' + zn), got = [];
    if (!z) throw new Error('no zone ' + zn);
    const file = (n) => path.join(dir, n);
    // ---- its creatures ----
    for (const id of z.normal.concat([z.guard, z.mini, z.boss])) {
      const d = C.WILD.animals[id], f = file('wild_' + d.art + '.png');
      if (!fs.existsSync(f)) continue;
      if (!POSES[d.art]) throw new Error(d.art + ': no POSES row');
      const store = d.role === 'mini' || d.role === 'boss' ? 1 : 0.75;
      const r = await p.evaluate(SHEET_CODE, [data(f), { poses: POSES[d.art], hover: HOVER.includes(d.art), ground: !d.flies, store }, FW, FH, M, G, FEET, SHADE]);
      put(d.sheet + '.png', r.png);
      const n1 = put(d.sheet + '.webp', r.webp);
      put(d.sheet + 'shade.png', r.shadePng);
      const n2 = put(d.sheet + 'shade.webp', r.shadeWebp);
      sizes[d.sheet + 'shade'] = [r.w, r.h];
      if (store < 1) sizes[d.sheet] = [r.w, r.h];
      else delete sizes[d.sheet];
      pxs[id] = r.px;
      console.log(('assets/' + d.sheet).padEnd(36), d.role.padEnd(7), 'px', String(r.px).padStart(3), ' k', r.k.toFixed(2), ' ', kb(n1), '+ shade', kb(n2));
      if (process.env.SHOW) fs.writeFileSync(path.join(process.env.SHOW, 'z' + zn + '-' + d.sheet + '.png'), Buffer.from(r.show.split(',')[1], 'base64'));
      got.push(id);
    }
    // ---- its cave tiles ----
    const parts = ['floor', 'water', 'rock_top', 'rock_face'].map((n) => file(n + '.png'));
    if (parts.every((f) => fs.existsSync(f))) {
      const r = await p.evaluate(CAVE_CODE, parts.map(data).concat([TILE, POOL]));
      put(z.art.cave + '.png', r.png);
      console.log(('assets/' + z.art.cave).padEnd(36), r.w + 'x' + r.h, kb(put(z.art.cave + '.webp', r.webp)));
      got.push('cave tiles');
    }
    // ---- its props ----
    if (fs.existsSync(file('props.png'))) {
      const cut = await p.evaluate(PROPS_CODE, [data(file('props.png')), PROP_W]);
      z.art.props.forEach((key, i) => {
        put(key + '.png', cut[i].png);
        console.log(('assets/' + key).padEnd(36), cut[i].w + 'x' + cut[i].h, kb(put(key + '.webp', cut[i].webp)));
      });
      got.push('props');
    }
    done.push('zone ' + zn + ': ' + (got.length ? got.join(', ') : 'nothing yet'));
  }
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  // each creature's width walking left in its own sheet (its px in the game, once its sheet is in: 19zzz...z-tower.js)
  const ids = C.TOWER.zones.flatMap((z) => z.normal.concat([z.guard, z.mini, z.boss])).filter((id) => pxs[id]);
  const lines = [];
  for (let i = 0; i < ids.length; i += 6) lines.push('    ' + ids.slice(i, i + 6).map((id) => id + ': ' + pxs[id]).join(', ') + ',');
  fs.writeFileSync(PX_FILE, [
    "// The Lost Tower's creatures: each one's width walking left (frame 6) in its own sheet, its `px` once that sheet is in",
    '// (until then its stand-in row\'s px). Written by tools/tower/tower-import.js: do not edit by hand.',
    '(function (F) {',
    "  'use strict';",
    '  var C = F.Config;',
    '  C.TOWER.artPx = {',
    ...lines,
    '  };',
    '})(window.Farm = window.Farm || {});',
    '',
  ].join('\n'));
  await b.close();
  console.log(done.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });

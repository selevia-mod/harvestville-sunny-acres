'use strict';
// Generates every pixel-art sprite sheet into assets/. Run: npm run art
const path = require('path');
const fs = require('fs');
const { Pix, rng } = require('./pix');
const { COLS, ROWS, SIZE, T, BLOCKS } = require('./tiles');

const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const C = {
  grass: '#5aa845', grassDark: '#47903a', grassDeep: '#3a7a2f', grassLight: '#78c25a',
  soil: '#b07a45', soilDark: '#946236', soilLight: '#c68f57',
  till: '#7f5230', tillDark: '#5f3b20', tillLight: '#97653c',
  wet: '#553621', wetDark: '#3d2616', wetLight: '#6a4429',
  path: '#d9b97c', pathDark: '#c19f63', pathLight: '#ead09a',
  water: '#3b8ed8', waterDark: '#2f74b8', waterLight: '#79bdf0',
  wood: '#b9834a', woodDark: '#865a2e', woodLight: '#d9a56a', outline: '#3d2614',
  leaf: '#4f9a3a', leafDark: '#3a7a2c', leafLight: '#6dbb4f', leafHi: '#93d66b', leafOut: '#24461b',
  bark: '#7a4f26', barkDark: '#553515',
  stone: '#9aa3ad', stoneDark: '#6e7782', stoneLight: '#c9d0d8',
  shadow: '#00000040',
};

const sheetW = COLS * SIZE;
const sheetH = ROWS * SIZE;

// ---------- helpers ----------
function tileXY(id) {
  return [(id % COLS) * SIZE, Math.floor(id / COLS) * SIZE];
}

function speckle(p, ox, oy, w, h, r, base, specks) {
  p.rect(ox, oy, w, h, base);
  specks.forEach(([col, count]) => {
    for (let i = 0; i < count; i++) p.set(ox + r.int(w), oy + r.int(h), col);
  });
}

function grass(p, ox, oy, r, w = SIZE, h = SIZE, extra = 0) {
  speckle(p, ox, oy, w, h, r, C.grass, [[C.grassDark, (w * h) / 14], [C.grassLight, (w * h) / 24]]);
  const tufts = Math.round((w * h) / 128) + extra;
  for (let i = 0; i < tufts; i++) {
    const x = ox + 1 + r.int(w - 3), y = oy + 2 + r.int(h - 3);
    p.set(x, y, C.grassDeep);
    p.set(x + 1, y - 1, C.grassDeep);
    p.set(x + 2, y, C.grassDeep);
    p.set(x + 1, y - 2, C.grassLight);
  }
}

function flower(p, x, y, petal, center) {
  p.set(x, y - 1, petal);
  p.set(x - 1, y, petal);
  p.set(x + 1, y, petal);
  p.set(x, y + 1, petal);
  p.set(x, y, center);
}

// Round, shaded clump made of overlapping circles (tree crowns, bushes, crop leaves).
function blob(p, ox, oy, circles, col, r) {
  const inside = (x, y, dx, dy, shrink) =>
    circles.some(([cx, cy, rad]) => {
      const ex = x + 0.5 - (cx + dx), ey = y + 0.5 - (cy + dy);
      return ex * ex + ey * ey <= (rad - shrink) * (rad - shrink);
    });
  let minX = 99, maxX = -99, minY = 99, maxY = -99;
  circles.forEach(([cx, cy, rad]) => {
    minX = Math.min(minX, cx - rad); maxX = Math.max(maxX, cx + rad);
    minY = Math.min(minY, cy - rad); maxY = Math.max(maxY, cy + rad);
  });
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      if (!inside(x, y, 0, 0, 0)) continue;
      let c = col.base;
      if (!inside(x, y, -1, -2, 0)) c = col.dark;
      else if (inside(x, y, -2, -2, 2.5)) c = col.light;
      p.set(ox + x, oy + y, c);
    }
  }
  if (col.hi && r) {
    for (let i = 0; i < circles.length * 2; i++) {
      const [cx, cy, rad] = circles[r.int(circles.length)];
      const x = Math.round(cx - rad / 2 + r.int(Math.max(1, rad / 2)));
      const y = Math.round(cy - rad / 2 + r.int(Math.max(1, rad / 2)));
      if (inside(x, y, 0, 0, 1.5)) p.set(ox + x, oy + y, col.hi);
    }
  }
}

function sprite(w, h, draw, outlineColor) {
  const s = new Pix(w, h);
  draw(s);
  if (outlineColor) s.outline(outlineColor);
  return s;
}

const LEAVES = { base: C.leaf, dark: C.leafDark, light: C.leafLight, hi: C.leafHi };

// ---------- tileset ----------
function makeTiles() {
  const p = new Pix(sheetW, sheetH);
  const r = rng(7);
  const at = (id, fn) => fn(...tileXY(id));

  at(T.grass, (x, y) => grass(p, x, y, r));
  at(T.grass2, (x, y) => grass(p, x, y, r, SIZE, SIZE, 4));
  at(T.grass3, (x, y) => {
    grass(p, x, y, r);
    flower(p, x + 4, y + 4, '#ffffff', '#f2c53d');
    flower(p, x + 11, y + 10, '#ffffff', '#f2c53d');
    flower(p, x + 5, y + 12, '#f6e37a', '#e08a2b');
  });
  at(T.flowers, (x, y) => {
    grass(p, x, y, r);
    flower(p, x + 3, y + 5, '#e5484d', '#f6e37a');
    flower(p, x + 10, y + 3, '#e5484d', '#f6e37a');
    flower(p, x + 12, y + 11, '#b56be0', '#f6e37a');
    flower(p, x + 6, y + 11, '#e5484d', '#f6e37a');
  });

  at(T.field, (x, y) => {
    speckle(p, x, y, SIZE, SIZE, r, C.soil, [[C.soilDark, 22], [C.soilLight, 14]]);
    for (let i = 0; i < 3; i++) {
      const px = x + 1 + r.int(13), py = y + 1 + r.int(13);
      p.rect(px, py, 2, 1, '#8a5a30');
      p.set(px, py - 1, C.soilLight);
    }
  });

  const tilled = (x, y, base, dark, light) => {
    p.rect(x, y, SIZE, SIZE, base);
    for (let row = 0; row < 4; row++) {
      const fy = y + row * 4;
      p.rect(x + 1, fy + 1, 14, 1, light);
      p.rect(x + 1, fy + 3, 14, 1, dark);
    }
    p.rect(x, y, SIZE, 1, dark);
    p.rect(x, y, 1, SIZE, dark);
    p.rect(x, y + 15, SIZE, 1, dark);
    p.rect(x + 15, y, 1, SIZE, dark);
    for (let i = 0; i < 6; i++) p.set(x + 2 + r.int(12), y + 2 + r.int(12), light);
  };
  at(T.tilled, (x, y) => tilled(x, y, C.till, C.tillDark, C.tillLight));
  at(T.tilledWet, (x, y) => {
    tilled(x, y, C.wet, C.wetDark, C.wetLight);
    for (let i = 0; i < 4; i++) p.set(x + 2 + r.int(12), y + 2 + r.int(12), '#7f9fc0');
  });

  at(T.path, (x, y) => {
    speckle(p, x, y, SIZE, SIZE, r, C.path, [[C.pathDark, 20], [C.pathLight, 16]]);
    for (let i = 0; i < 2; i++) {
      const px = x + 2 + r.int(11), py = y + 2 + r.int(11);
      p.rect(px, py, 2, 2, '#b8975e');
      p.set(px, py, C.pathLight);
    }
  });

  at(T.water, (x, y) => waterFill(p, x, y, SIZE, SIZE, r));

  // fences sit on a transparent background (drawn on the Walls layer above the grass)
  const post = (x, y) => {
    p.rect(x + 6, y + 2, 4, 12, C.wood);
    p.rect(x + 6, y + 2, 1, 12, C.woodLight);
    p.rect(x + 9, y + 2, 1, 12, C.woodDark);
    p.rect(x + 6, y + 2, 4, 1, C.woodLight);
    p.rect(x + 5, y + 1, 6, 1, C.outline);
    p.rect(x + 5, y + 14, 6, 1, C.outline);
    p.rect(x + 5, y + 1, 1, 14, C.outline);
    p.rect(x + 10, y + 1, 1, 14, C.outline);
    p.rect(x + 6, y + 14, 4, 1, C.shadow);
  };
  const rail = (x, y, ry) => {
    p.rect(x, y + ry - 1, SIZE, 1, C.outline);
    p.rect(x, y + ry, SIZE, 1, C.woodLight);
    p.rect(x, y + ry + 1, SIZE, 1, C.woodDark);
    p.rect(x, y + ry + 2, SIZE, 1, C.outline);
  };
  at(T.fenceH, (x, y) => { rail(x, y, 4); rail(x, y, 9); post(x, y); });
  at(T.fenceV, (x, y) => {
    p.rect(x + 6, y, 1, SIZE, C.outline);
    p.rect(x + 7, y, 2, SIZE, C.wood);
    p.rect(x + 7, y, 1, SIZE, C.woodLight);
    p.rect(x + 9, y, 1, SIZE, C.outline);
    post(x, y);
  });
  at(T.fencePost, post);

  // 2x2 tree: crown on top row (Above layer), lower crown + trunk on bottom row (Walls layer)
  {
    const t = sprite(32, 32, (s) => {
      s.ellipse(16, 29, 9, 3, C.shadow);
      s.rect(13, 20, 6, 10, C.bark);
      s.rect(13, 20, 1, 10, C.barkDark);
      s.rect(17, 22, 1, 6, C.barkDark);
      s.rect(12, 29, 8, 1, C.barkDark);
      blob(s, 0, 0, [[10, 12, 8], [22, 12, 8], [16, 7, 8], [16, 16, 8]], LEAVES, rng(11));
      flower(s, 9, 9, '#ffffff', '#f6e37a');
    }, C.leafOut);
    // trees are laid out TL,TR,BL,BR consecutively in row 0 of the tileset
    const parts = [[T.treeTL, 0, 0], [T.treeTR, 16, 0], [T.treeBL, 0, 16], [T.treeBR, 16, 16]];
    parts.forEach(([id, sx, sy]) => {
      const [tx, ty] = tileXY(id);
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
        const k = ((sy + j) * 32 + sx + i) * 4;
        if (t.d[k + 3]) p.set(tx + i, ty + j, [t.d[k], t.d[k + 1], t.d[k + 2], t.d[k + 3]]);
      }
    });
  }

  at(T.bush, (x, y) => {
    p.ellipse(x + 8, y + 14, 6, 2, C.shadow);
    p.blit(sprite(16, 16, (s) => {
      blob(s, 0, 0, [[5, 10, 4.5], [11, 10, 4.5], [8, 7, 4.5]], LEAVES, rng(5));
      s.set(6, 7, '#e5484d'); s.set(10, 9, '#e5484d'); s.set(8, 11, '#e5484d');
    }, C.leafOut), x, y);
  });

  at(T.rock, (x, y) => {
    p.ellipse(x + 8, y + 13, 6, 2, C.shadow);
    p.blit(sprite(16, 16, (s) => {
      blob(s, 0, 0, [[6, 10, 4.5], [10, 10, 4], [8, 8, 4]], { base: C.stone, dark: C.stoneDark, light: C.stoneLight }, null);
      s.set(7, 6, '#ffffff');
    }, '#3e444c'), x, y);
  });

  at(T.stump, (x, y) => {
    p.blit(sprite(16, 16, (s) => {
      s.rect(4, 8, 8, 6, C.bark);
      s.rect(4, 12, 8, 2, C.barkDark);
      s.ellipse(8, 8, 4, 2, '#c99a62');
      s.ellipse(8, 8, 2, 1, '#a8774a');
    }, C.outline), x, y);
  });

  at(T.tallgrass, (x, y) => {
    for (let i = 0; i < 6; i++) {
      const bx = x + 2 + i * 2 + r.int(2), h = 4 + r.int(5);
      p.line(bx, y + 14, bx + (i % 2 ? 1 : -1), y + 14 - h, i % 2 ? C.grassDeep : C.leafLight);
    }
  });

  at(T.shipbox, (x, y) => {
    p.ellipse(x + 8, y + 14, 7, 2, C.shadow);
    p.blit(sprite(16, 16, (s) => {
      s.rect(1, 5, 14, 9, C.wood);
      s.rect(1, 5, 14, 1, C.woodLight);
      s.rect(1, 9, 14, 1, C.woodDark);
      s.rect(1, 13, 14, 1, C.woodDark);
      s.rect(0, 2, 16, 3, '#9a6a3a'); // lid
      s.rect(0, 2, 16, 1, C.woodLight);
      s.rect(3, 6, 1, 8, C.stoneDark);
      s.rect(12, 6, 1, 8, C.stoneDark);
      s.rect(7, 4, 2, 3, '#f2c53d'); // latch
    }, C.outline), x, y);
  });

  at(T.sign, (x, y) => {
    p.blit(sprite(16, 16, (s) => {
      s.rect(7, 9, 2, 6, C.woodDark);
      s.rect(2, 2, 12, 8, C.wood);
      s.rect(2, 2, 12, 1, C.woodLight);
      s.rect(4, 4, 8, 1, C.woodDark);
      s.rect(4, 6, 6, 1, C.woodDark);
    }, C.outline), x, y);
  });

  drawHouse(p, BLOCKS.house.col * SIZE, BLOCKS.house.row * SIZE, r);
  drawPond(p, BLOCKS.pond.col * SIZE, BLOCKS.pond.row * SIZE, r);
  drawShop(p, BLOCKS.shop.col * SIZE, BLOCKS.shop.row * SIZE, r);

  p.save(path.join(OUT, 'tiles.png'));
}

function waterFill(p, ox, oy, w, h, r, inside) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside || inside(x, y)) p.set(ox + x, oy + y, C.water);
  }
  for (let i = 0; i < (w * h) / 40; i++) {
    const x = r.int(w - 4), y = r.int(h);
    const len = 2 + r.int(3);
    for (let k = 0; k < len; k++) {
      if (!inside || inside(x + k, y)) p.set(ox + x + k, oy + y, k === 0 ? C.waterDark : C.waterLight);
    }
  }
}

function drawHouse(p, ox, oy, r) {
  const W = 80, H = 64;
  const s = new Pix(W, H);
  // walls
  s.rect(4, 34, 72, 28, '#ead7ae');
  for (let y = 37; y < 62; y += 4) s.rect(4, y, 72, 1, '#cdb184');
  s.rect(4, 34, 72, 3, '#b99b6d'); // shadow under eaves
  s.rect(2, 60, 76, 4, '#8f949b'); // stone footing
  s.rect(2, 60, 76, 1, '#b6bcc3');
  // door (tile column 2 of the block => x 32..47)
  s.rect(33, 41, 14, 20, '#8a5a32');
  s.rect(33, 41, 14, 1, '#5a3a1e');
  s.rect(33, 41, 1, 20, '#5a3a1e');
  s.rect(46, 41, 1, 20, '#5a3a1e');
  s.rect(36, 44, 8, 6, '#a06d40');
  s.rect(36, 52, 8, 6, '#a06d40');
  s.rect(43, 51, 2, 2, '#f2c53d');
  // windows with flower boxes
  [10, 56].forEach((wx) => {
    s.rect(wx, 41, 14, 11, '#ffffff');
    s.rect(wx + 1, 42, 12, 9, '#9fd3ef');
    s.rect(wx + 1, 42, 4, 3, '#d4eefb');
    s.rect(wx + 7, 42, 1, 9, '#ffffff');
    s.rect(wx + 1, 46, 12, 1, '#ffffff');
    s.rect(wx - 1, 52, 16, 3, '#9a6a3a');
    for (let i = 0; i < 5; i++) flower(s, wx + 1 + i * 3, 51, i % 2 ? '#e5484d' : '#f6e37a', '#ffffff');
  });
  // roof
  for (let y = 4; y < 36; y++) {
    const inset = Math.max(0, 6 - Math.floor((y - 4) / 2));
    for (let x = inset; x < W - inset; x++) {
      let c = '#c0483a';
      const band = (y - 4) % 6;
      if (band === 5) c = '#8e3128';
      else if (band === 0) c = '#d9675a';
      else if ((x + (Math.floor((y - 4) / 6) % 2) * 4) % 8 === 0) c = '#a33b2f';
      s.set(x, y, c);
    }
  }
  s.rect(6, 3, 68, 2, '#e07a6c'); // ridge
  // chimney
  s.rect(58, 0, 8, 10, '#9a8f86');
  s.rect(58, 0, 8, 2, '#b8aea5');
  s.rect(60, 4, 4, 1, '#6e655e');
  s.outline('#3d2614');
  p.blit(s, ox, oy);
}

function drawPond(p, ox, oy, r) {
  const W = 80, H = 64;
  grass(p, ox, oy, r, W, H);
  const cx = 40, cy = 32;
  const inEll = (x, y, rx, ry) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    return nx * nx + ny * ny <= 1;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inEll(x, y, 38, 30)) p.set(ox + x, oy + y, '#8a6a3e');
    if (inEll(x, y, 37, 29)) p.set(ox + x, oy + y, '#e0c98c');
    if (inEll(x, y, 37, 29) && y > cy + 20) p.set(ox + x, oy + y, '#c9ae6e');
  }
  waterFill(p, ox, oy, W, H, r, (x, y) => inEll(x, y, 33, 25));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inEll(x, y, 33, 25) && !inEll(x, y, 32, 24)) p.set(ox + x, oy + y, C.waterDark);
  }
  // lily pads + a couple of reeds
  [[22, 24], [52, 38], [58, 22]].forEach(([lx, ly]) => {
    p.ellipse(ox + lx, oy + ly, 4, 3, '#4f9a3a');
    p.set(ox + lx, oy + ly, C.water);
    p.set(ox + lx + 1, oy + ly - 1, C.water);
    p.set(ox + lx - 2, oy + ly - 1, '#6dbb4f');
  });
  flower(p, ox + 52, oy + 37, '#f7a8c8', '#f6e37a');
  [[8, 18], [10, 16], [70, 44], [72, 42]].forEach(([rx, ry]) => {
    p.line(ox + rx, oy + ry + 8, ox + rx, oy + ry, C.grassDeep);
    p.rect(ox + rx, oy + ry, 1, 3, '#7a4f26');
  });
}

function drawShop(p, ox, oy, r) {
  const W = 96, H = 64;
  const s = new Pix(W, H);
  // building
  s.rect(4, 10, 88, 52, '#7cb36a');
  for (let x = 4; x < 92; x += 6) s.rect(x, 10, 1, 52, '#679d57');
  s.rect(0, 2, 96, 10, '#7a4f26'); // roof
  s.rect(0, 2, 96, 2, '#9a6a3a');
  for (let x = 2; x < 96; x += 6) s.rect(x, 6, 3, 1, '#5e3b1b');
  // sign board with "SEEDS"
  s.rect(30, 0, 36, 12, '#e8cf98');
  s.rect(30, 0, 36, 1, '#fff2cc');
  const glyph = {
    S: ['111', '100', '111', '001', '111'],
    E: ['111', '100', '110', '100', '111'],
    D: ['110', '101', '101', '101', '110'],
  };
  'SEEDS'.split('').forEach((ch, i) => {
    glyph[ch].forEach((row, y) => row.split('').forEach((b, x) => {
      if (b === '1') s.set(36 + i * 5 + x, 3 + y, '#7a3b1b');
    }));
  });
  // windows
  [8, 74].forEach((wx) => {
    s.rect(wx, 22, 14, 12, '#ffffff');
    s.rect(wx + 1, 23, 12, 10, '#9fd3ef');
    s.rect(wx + 1, 23, 4, 3, '#d4eefb');
  });
  // shopkeeper peeking over the counter
  s.rect(40, 30, 16, 14, '#4b2f1c');
  s.ellipse(48, 37, 6, 6, '#a3612f');
  s.ellipse(48, 39, 4.5, 4, '#f5c9a0');
  s.set(46, 39, '#2b1d14');
  s.set(50, 39, '#2b1d14');
  s.set(45, 41, '#ef9a8a');
  s.set(51, 41, '#ef9a8a');
  s.rect(43, 44, 10, 4, '#e5484d');
  // striped awning
  for (let x = 2; x < 94; x++) {
    const stripe = Math.floor((x - 2) / 8) % 2 ? '#ffffff' : '#e5484d';
    const drop = ((x - 2) % 8 < 4 ? 1 : 0);
    for (let y = 16; y < 24 + drop * 2; y++) s.set(x, y, stripe);
    s.set(x, 24 + drop * 2, '#00000033');
  }
  // counter with produce crates
  s.rect(14, 46, 68, 16, '#b9834a');
  s.rect(14, 46, 68, 2, '#d9a56a');
  for (let x = 14; x < 82; x += 8) s.rect(x, 48, 1, 14, '#865a2e');
  [[20, '#f4f0ea', '#a2479c'], [32, '#c49a5e', '#a27a44'], [62, '#e2363e', '#f6e37a'], [72, '#f2a03d', '#d97c1e']].forEach(([cx, c1, c2]) => {
    s.rect(cx - 4, 40, 9, 6, '#865a2e');
    for (let i = 0; i < 3; i++) {
      s.ellipse(cx - 2 + i * 2, 40, 1.6, 1.6, c1);
      s.set(cx - 2 + i * 2, 39, c2);
    }
  });
  s.outline('#3d2614');
  p.blit(s, ox, oy);
}

// ---------- player (16x24 frames: rows down / up / side, cols stand / stepA / stepB) ----------
const PLAYER_PAL = {
  k: '#2b1d14', c: '#e04a3a', C: '#a8302a', h: '#7a4524', H: '#a3612f', s: '#f5c9a0', S: '#d99a70',
  e: '#2b1d14', r: '#ef9a8a', w: '#f4efe1', o: '#3f6fc0', O: '#2d4f8f', l: '#6b3e22',
};

const DOWN_TOP = [
  '....kkkkkkkk....',
  '...kcccccccck...',
  '..kcccccccccck..',
  '..kCCCCCCCCCCk..',
  '.kCCCCCCCCCCCCk.',
  '..khsssssssshk..',
  '..khsesssseshk..',
  '..ksrssssssrsk..',
  '...kssssssssk...',
  '....kSSSSSSk....',
  '...kwwwwwwwwk...',
  '..kwwoowwoowwk..',
  '..kwoooooooowk..',
  '..kwooOooOoowk..',
  '..ksoooooooosk..',
  '...kooooooook...',
  '...kOOOOOOOOk...',
];
const UP_TOP = [
  '....kkkkkkkk....',
  '...kcccccccck...',
  '..kcccccccccck..',
  '..kcccccccccck..',
  '..kCCCCCCCCCCk..',
  '..khhhhhhhhhhk..',
  '..khhhhhhhhhhk..',
  '..kHhhhhhhhhHk..',
  '...khhhhhhhhk...',
  '....kSSSSSSk....',
  '...kwwwwwwwwk...',
  '..kwwowwwwowwk..',
  '..kwwoooooowwk..',
  '..kwoooooooowk..',
  '..ksoooooooosk..',
  '...kooooooook...',
  '...kOOOOOOOOk...',
];
const LEGS_STAND = ['...kook..kook...', '...kook..kook...', '...kllk..kllk...', '...kkkk..kkkk...'];
const LEGS_STEP_A = ['...kook..kook...', '...kllk..kook...', '...kkkk..kllk...', '.........kkkk...'];
const LEGS_STEP_B = ['...kook..kook...', '...kook..kllk...', '...kllk..kkkk...', '...kkkk.........'];

const SIDE_TOP = [
  '.....kkkkkk.....',
  '....kcccccck....',
  '...kcccccccck...',
  '...kCCCCCCCCk...',
  '.kCCCCCCCCCCk...',
  '...ksssshhhhk...',
  '...ksesshhhhk...',
  '..kssssshhhk....',
  '...kSsssshk.....',
  '....kSSSSk......',
  '....kwwwwwk.....',
  '....kwwwowk.....',
  '....kowwwok.....',
  '....koosook.....',
  '....koooook.....',
  '....kOOOOOk.....',
];
const SIDE_LEGS_STAND = ['....kooook......', '....kooook......', '...klllllk......', '...kkkkkkk......'];
const SIDE_LEGS_STEP_A = ['...kook.kook....', '..kook...kook...', '.klllk...kllk...', '.kkkkk...kkkk...'];
const SIDE_LEGS_STEP_B = ['....kooook......', '....koook.......', '...kllllk.......', '...kkkkkk.......'];

function makePlayer() {
  const FW = 16, FH = 24;
  const rows = [
    [DOWN_TOP, [LEGS_STAND, LEGS_STEP_A, LEGS_STEP_B]],
    [UP_TOP, [LEGS_STAND, LEGS_STEP_A, LEGS_STEP_B]],
    [SIDE_TOP, [SIDE_LEGS_STAND, SIDE_LEGS_STEP_A, SIDE_LEGS_STEP_B]],
  ];
  const p = new Pix(FW * 3, FH * 3);
  rows.forEach(([top, legsList], ry) => {
    legsList.forEach((legs, cx) => {
      const art = top.concat(legs);
      art.forEach((row, i) => {
        if (row.length !== FW) throw new Error(`player row ${i} (dir ${ry}) is ${row.length} wide: "${row}"`);
      });
      const bob = cx === 0 ? 0 : 1; // body dips one pixel mid-stride
      const topY = FH - art.length;
      const body = top.map((row) => row);
      p.ascii(cx * FW, ry * FH + topY + bob, body, PLAYER_PAL);
      p.ascii(cx * FW, ry * FH + topY + top.length, legs, PLAYER_PAL);
    });
  });
  p.save(path.join(OUT, 'player.png'));
}

// ---------- crops (16x16 frames: one row per crop, cols seeds / sprout / growing / ripe) ----------
function makeCrops() {
  const p = new Pix(64, 48);
  const seeds = (s) => {
    [[4, 6], [9, 5], [6, 10], [11, 10], [8, 8]].forEach(([x, y]) => {
      s.rect(x, y, 2, 1, '#4a2e18');
      s.set(x, y - 1, '#e3c48a');
    });
  };
  const sprout = (s) => {
    s.line(8, 13, 8, 10, '#3f8f33');
    s.ellipse(6, 9, 2.2, 1.4, '#7cd35a');
    s.ellipse(10.5, 9, 2.2, 1.4, '#6cc24a');
  };
  const stem = (s, x0, y0) => s.line(x0, y0, 8, 13, '#3f8f33');
  const leaf = (s, cx, cy, rx, ry) => {
    s.ellipse(cx, cy, rx, ry, C.leaf);
    s.ellipse(cx - 0.5, cy - 0.8, rx * 0.5, ry * 0.5, C.leafLight);
  };

  const draw = {
    turnip: [
      seeds, sprout,
      (s) => { stem(s, 5, 8); stem(s, 11, 8); leaf(s, 5, 8, 2.2, 3); leaf(s, 11, 8, 2.2, 3); leaf(s, 8, 6, 2.2, 4); },
      (s) => {
        leaf(s, 4, 6, 2.5, 4); leaf(s, 12, 6, 2.5, 4); leaf(s, 8, 4, 2.5, 4.5);
        s.ellipse(8, 12, 4.5, 3.5, '#f4f0ea');
        s.ellipse(8, 10.5, 4.2, 1.8, '#b04fa6');
        s.set(6, 12, '#ffffff');
      },
    ],
    potato: [
      seeds, sprout,
      (s) => blob(s, 0, 0, [[6, 10, 3.2], [10, 10, 3.2], [8, 8, 3.2]], LEAVES, rng(21)),
      (s) => {
        s.ellipse(5, 14, 2.2, 1.5, '#c49a5e');
        s.ellipse(11, 14, 2.2, 1.5, '#c49a5e');
        blob(s, 0, 0, [[5, 9, 4], [11, 9, 4], [8, 6, 4], [8, 10, 4]], LEAVES, rng(22));
        flower(s, 6, 5, '#d7a6f0', '#f6e37a');
        flower(s, 11, 8, '#ffffff', '#f6e37a');
      },
    ],
    strawberry: [
      seeds, sprout,
      (s) => {
        blob(s, 0, 0, [[5, 11, 3], [11, 11, 3], [8, 9, 3]], LEAVES, rng(31));
        flower(s, 6, 9, '#ffffff', '#f6e37a');
      },
      (s) => {
        blob(s, 0, 0, [[5, 9, 4], [11, 9, 4], [8, 7, 4]], LEAVES, rng(32));
        [[4, 11], [10, 12], [7, 8], [12, 7]].forEach(([x, y]) => {
          s.ellipse(x + 1, y + 1, 1.8, 2, '#e2363e');
          s.set(x, y + 1, '#ff8a8a');
          s.set(x + 1, y + 2, '#f6e37a');
        });
      },
    ],
  };

  ['turnip', 'potato', 'strawberry'].forEach((crop, row) => {
    draw[crop].forEach((fn, col) => {
      p.blit(sprite(16, 16, fn, col === 0 ? null : C.leafOut), col * 16, row * 16);
    });
  });
  p.save(path.join(OUT, 'crops.png'));
}

// ---------- item + UI icons (16x16 frames, 8 per row) ----------
const ICONS = [
  'hoe', 'can', 'seed_turnip', 'seed_potato', 'seed_strawberry', 'turnip', 'potato', 'strawberry',
  'coin', 'bolt', 'bag', 'moon', 'drop', 'sparkle', 'crate', 'tag',
];

function seedBag(label, mark) {
  return (s) => {
    s.rect(4, 5, 8, 9, '#e2c48f');
    s.rect(3, 7, 10, 7, '#e2c48f');
    s.rect(3, 12, 10, 2, '#c9a66b');
    s.rect(6, 3, 4, 2, '#c9a66b');
    s.rect(5, 2, 6, 1, '#a8834d');
    s.rect(5, 8, 6, 4, label);
    s.set(7, 9, mark);
    s.set(8, 10, mark);
    s.set(6, 10, mark);
    s.set(4, 7, '#f3dcae');
  };
}

const ICON_DRAW = {
  hoe: (s) => {
    s.line(3, 14, 11, 6, '#9b6a3c');
    s.line(4, 14, 12, 6, '#c08a50');
    s.rect(9, 2, 6, 3, '#9aa3ad');
    s.rect(9, 2, 6, 1, '#d0d7de');
    s.rect(12, 5, 2, 2, '#6e7782');
  },
  can: (s) => {
    s.rect(3, 6, 8, 8, '#4aa3c9');
    s.rect(3, 6, 8, 2, '#7cc6e6');
    s.rect(3, 12, 8, 2, '#2f7fa3');
    s.line(10, 9, 14, 5, '#4aa3c9');
    s.rect(13, 3, 2, 2, '#7cc6e6');
    s.rect(4, 3, 6, 1, '#2f7fa3');
    s.rect(4, 3, 1, 3, '#2f7fa3');
    s.rect(9, 3, 1, 3, '#2f7fa3');
  },
  seed_turnip: seedBag('#b04fa6', '#ffffff'),
  seed_potato: seedBag('#a27a44', '#f6e37a'),
  seed_strawberry: seedBag('#e2363e', '#f6e37a'),
  turnip: (s) => {
    s.line(8, 6, 5, 1, '#4f9a3a');
    s.line(8, 6, 8, 0, '#6dbb4f');
    s.line(8, 6, 11, 1, '#4f9a3a');
    s.ellipse(8, 10, 5, 4.5, '#f4f0ea');
    s.ellipse(8, 8, 4.5, 2.2, '#b04fa6');
    s.set(6, 10, '#ffffff');
    s.set(8, 15, '#d9d2c5');
  },
  potato: (s) => {
    s.ellipse(8, 9, 6, 4.5, '#c49a5e');
    s.ellipse(9, 10.5, 4.5, 2.5, '#b08548');
    s.ellipse(6, 7.5, 2, 1.2, '#dbb57a');
    s.set(5, 10, '#7a5a30'); s.set(10, 8, '#7a5a30'); s.set(11, 11, '#7a5a30');
  },
  strawberry: (s) => {
    for (let y = 5; y < 15; y++) {
      const half = Math.max(1, Math.round(5.5 - (y - 5) * 0.5));
      s.rect(8 - half, y, half * 2, 1, '#e2363e');
    }
    s.rect(4, 5, 8, 2, '#f04a52');
    [[5, 7], [9, 7], [7, 9], [10, 10], [6, 11], [8, 12]].forEach(([x, y]) => s.set(x, y, '#f6e37a'));
    s.rect(5, 3, 6, 2, '#4f9a3a');
    s.rect(7, 1, 2, 2, '#3a7a2c');
  },
  coin: (s) => {
    s.ellipse(8, 8, 6.5, 6.5, '#d39b1e');
    s.ellipse(8, 8, 5, 5, '#f2c53d');
    s.rect(7, 5, 2, 6, '#d39b1e');
    s.rect(5, 5, 2, 2, '#fff2a8');
  },
  bolt: (s) => {
    [[9, 1], [8, 2], [7, 3], [6, 4], [5, 5], [5, 6], [6, 7], [8, 7], [7, 8], [6, 9], [5, 10], [4, 11], [4, 12]].forEach(([x, y]) => s.rect(x, y, 4, 1, '#f2c53d'));
    s.rect(4, 7, 8, 1, '#f2c53d');
    s.set(8, 3, '#fff2a8');
  },
  bag: (s) => {
    s.rect(3, 5, 10, 10, '#a8703c');
    s.rect(3, 5, 10, 2, '#c58a50');
    s.rect(5, 2, 6, 1, '#7a4f26');
    s.rect(5, 2, 1, 4, '#7a4f26');
    s.rect(10, 2, 1, 4, '#7a4f26');
    s.rect(5, 9, 6, 4, '#8a5a30');
    s.rect(7, 9, 2, 2, '#f2c53d');
  },
  moon: (s) => {
    s.ellipse(8, 8, 6, 6, '#f6e37a');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 11, dy = y + 0.5 - 6;
      if (dx * dx + dy * dy <= 25) s.d.fill(0, (y * 16 + x) * 4, (y * 16 + x) * 4 + 4);
    }
    s.set(4, 8, '#fff7c2');
  },
  drop: (s) => {
    for (let y = 2; y < 14; y++) {
      const half = y < 8 ? Math.ceil((y - 2) * 0.7) : Math.round(Math.sqrt(Math.max(0, 25 - (y - 9) * (y - 9))));
      s.rect(8 - half, y, Math.max(1, half * 2), 1, '#4aa3e8');
    }
    s.rect(6, 8, 1, 3, '#bfe3ff');
  },
  sparkle: (s) => {
    s.rect(7, 1, 2, 14, '#f6e37a');
    s.rect(1, 7, 14, 2, '#f6e37a');
    s.rect(5, 5, 6, 6, '#f6e37a');
    s.rect(7, 4, 2, 8, '#ffffff');
    s.rect(4, 7, 8, 2, '#ffffff');
  },
  crate: (s) => {
    s.rect(2, 5, 12, 9, C.wood);
    s.rect(2, 5, 12, 1, C.woodLight);
    s.rect(2, 9, 12, 1, C.woodDark);
    s.rect(1, 3, 14, 2, '#9a6a3a');
    s.rect(7, 4, 2, 2, '#f2c53d');
  },
  tag: (s) => {
    s.rect(4, 3, 9, 10, '#f2c53d');
    s.rect(2, 5, 2, 6, '#f2c53d');
    s.rect(4, 3, 9, 1, '#fff2a8');
    s.rect(5, 7, 2, 2, '#8a5a30');
    s.rect(8, 6, 4, 1, '#d39b1e');
    s.rect(8, 9, 3, 1, '#d39b1e');
  },
};

function makeItems() {
  const p = new Pix(128, 32);
  ICONS.forEach((name, i) => {
    const s = sprite(16, 16, ICON_DRAW[name], '#2b1d14');
    p.blit(s, (i % 8) * 16, Math.floor(i / 8) * 16);
  });
  p.save(path.join(OUT, 'items.png'));
}

makeTiles();
makePlayer();
makeCrops();
makeItems();
console.log('Art written to', OUT);

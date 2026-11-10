// The new weapons' pictures (00-zzzzzzzzzzzzzzzzzzz-weapons.js): drawn stand-ins in code (nothing added to the page's
// pictures), until the owner's art (art-src/MANILA-PROMPTS.md batch 6) is in its pack (tools/art/weapons-import.js writes
// it; tools/packs.js 'weapons'). Each is used the moment its pack picture is here:
//   wpn_icons   1024x384, 8 x 3 cells of 128 in C.WPN_ICONS' order (each weapon's 6 levels, bullets, javelins, a broken boomerang)
//   wpn_held    1536x192, 6 x 2 cells of 256x96: the Rifle's then the Javelin's levels, side on, pointing right
//   wpn_spin    512x768, 4 x 6 cells of 128: the Boomerang from above, a row a level (the game spins column 0)
//   wpn_bullet  768x128, 6 cells of 128: the Rifle's shot by level, flying right
//   wpn_pose_<rifle|javelin|boomerang>[_girl]: the farmer's 9 poses, the archer sheets' frames (288x384, 3 x 3)
// The icons go into the items texture as frames of their own (from C.WPN_ICON_BASE), on a small canvas of their own.
(function (F) {
  'use strict';
  var C = F.Config;
  var OUT = '#3b2312';
  // by level: Basic, Copper, Silver, Gold, Magma, Moon
  var PAL = [
    { wood: '#c98a4b', woodHi: '#e2a868', metal: '#5d636b', band: '#7a4a22', tip: '#9aa3ad', shot: '#ffd36b' },
    { wood: '#c98a4b', woodHi: '#e2a868', metal: '#b8683a', band: '#e08a4f', tip: '#d98a56', shot: '#ffb37a' },
    { wood: '#c98a4b', woodHi: '#e2a868', metal: '#aeb8c4', band: '#eef3f8', tip: '#e3eaf2', shot: '#f3f7ff' },
    { wood: '#c98a4b', woodHi: '#e2a868', metal: '#d9a521', band: '#f6cf4a', tip: '#f4cb46', gem: '#d8323c', shot: '#ffe066' },
    { wood: '#2b2328', woodHi: '#4a3a40', metal: '#3a2f33', band: '#ffb03a', tip: '#ff8a2a', crack: '#ff6a1a', shot: '#ff7a1a' },
    { wood: '#f3f5ff', woodHi: '#ffffff', metal: '#dfe5ff', band: '#c9d4ff', tip: '#ffffff', moon: true, shot: '#eaf4ff' },
  ];
  F.WPN_PAL = PAL;
  F.WPN_GLOW = 0xeaf4ff; // the Moon weapons' glow (as the Moon Bow's shine)
  var canvas = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  var rr = function (g, x, y, w, h, r) { // a rounded box
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  };
  var fillOut = function (g, fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 3; g.strokeStyle = OUT; g.stroke(); };
  var moons = function (g, pts, r) { // tiny crescent moons along it
    pts.forEach(function (p) {
      g.save(); g.translate(p[0], p[1]);
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = '#9fb4ff'; g.fill();
      g.beginPath(); g.arc(r * 0.45, -r * 0.3, r * 0.85, 0, Math.PI * 2); g.globalCompositeOperation = 'destination-out'; g.fill();
      g.restore();
    });
  };
  var cracks = function (g, P, lines) {
    if (!P.crack) return;
    g.save(); g.strokeStyle = P.crack; g.lineWidth = 2; g.lineCap = 'round';
    lines.forEach(function (l) { g.beginPath(); g.moveTo(l[0], l[1]); for (var i = 2; i < l.length; i += 2) g.lineTo(l[i], l[i + 1]); g.stroke(); });
    g.restore();
  };

  // ---------- the drawings, in their own units: 100 long, pointing right, the middle at 0,0 ----------
  // A cozy toy-like hunting rifle (never a real gun): a round wooden stock, a short barrel, bands, a little sight, a strap.
  var rifle = function (g, P) {
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-28, 6); g.quadraticCurveTo(-6, 26, 18, 4); g.lineWidth = 3; g.strokeStyle = '#6b4020'; g.stroke(); // strap
    g.beginPath(); g.moveTo(-50, -2); g.quadraticCurveTo(-52, 14, -40, 15); g.lineTo(-14, 7); g.lineTo(-14, -6); g.closePath(); fillOut(g, P.wood); // stock
    rr(g, -16, -8, 30, 14, 5); fillOut(g, P.wood); // the body
    rr(g, -12, -6, 22, 3, 1.5); g.fillStyle = P.woodHi; g.fill();
    rr(g, 10, -6, 40, 7, 3); fillOut(g, P.metal); // the barrel
    [-15, 6, 32].forEach(function (x) { rr(g, x, -9, 5, x > 20 ? 12 : 16, 2); fillOut(g, P.band, 2); });
    g.beginPath(); g.arc(2, -11, 3.5, 0, Math.PI * 2); fillOut(g, P.metal, 2); // sight
    if (P.gem) { g.beginPath(); g.arc(-31, 4, 3.5, 0, Math.PI * 2); fillOut(g, P.gem, 1.5); }
    cracks(g, P, [[-46, 2, -38, 6, -32, 2, -24, 6], [-10, -2, -2, 2, 4, -3]]);
    if (P.moon) moons(g, [[-36, 4], [-4, -1], [24, -3]], 3);
  };
  // A long throwing javelin: a bamboo shaft, a leaf-shaped tip, a red cloth grip.
  var javelin = function (g, P) {
    g.lineJoin = 'round';
    rr(g, -50, -3, 86, 6, 3); fillOut(g, P.moon || P.crack ? P.wood : '#d8b46a', 2.5);
    [-30, -10, 14].forEach(function (x) { g.beginPath(); g.moveTo(x, -3); g.lineTo(x, 3); g.lineWidth = 1.5; g.strokeStyle = 'rgba(59,35,18,0.5)'; g.stroke(); });
    g.beginPath(); g.moveTo(34, 0); g.quadraticCurveTo(40, -8, 52, 0); g.quadraticCurveTo(40, 8, 34, 0); g.closePath(); fillOut(g, P.tip, 2.5); // the tip
    rr(g, -6, -4.5, 12, 9, 3); fillOut(g, '#c8463a', 2); // the grip
    [-46, 30].forEach(function (x) { rr(g, x, -4.5, 4, 9, 1.5); fillOut(g, P.band, 1.5); });
    if (P.gem) { g.beginPath(); g.arc(0, 0, 2.5, 0, Math.PI * 2); fillOut(g, P.gem, 1); }
    cracks(g, P, [[-44, 0, -36, -1, -28, 1], [12, 0, 20, -1, 26, 1]]);
    if (P.moon) moons(g, [[-22, 0], [20, 0]], 2.2);
  };
  // A boomerang seen from above: a wide V, a carved wavy line.
  var boomerang = function (g, P, broken) {
    var arm = function (sx) {
      g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(sx * 18, -6, sx * 40, 18);
      g.lineCap = 'round'; g.lineWidth = 19; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = 13; g.strokeStyle = P.wood; g.stroke();
      g.lineWidth = 2; g.strokeStyle = P.crack || 'rgba(59,35,18,0.45)'; g.stroke();
      g.beginPath(); g.arc(sx * 34, 12, 4.5, 0, Math.PI * 2); g.fillStyle = P.band; g.fill();
    };
    if (broken) {
      g.save(); g.translate(-8, 4); g.rotate(-0.25); arm(-1); g.restore();
      g.save(); g.translate(10, -2); g.rotate(0.35); arm(1); g.restore();
      return;
    }
    arm(-1); arm(1);
    if (P.gem) { g.beginPath(); g.arc(0, -9, 3.5, 0, Math.PI * 2); fillOut(g, P.gem, 1.5); }
    if (P.moon) moons(g, [[-22, 0], [22, 0]], 2.5);
  };
  var DRAW = { rifle: rifle, javelin: javelin, boomerang: boomerang };

  var glow = function (g, x, y, r) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(234,244,255,0.85)'); gr.addColorStop(0.55, 'rgba(200,220,255,0.35)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // ---------- the icons: 128 cells ----------
  var icon = function (g, name) {
    var m = /^(rifle|javelin|boomerang)_(\d)$/.exec(name);
    g.save();
    g.translate(64, 64);
    if (m) {
      var P = PAL[+m[2]];
      if (P.moon) glow(g, 0, 0, 62);
      if (m[1] === 'boomerang') { g.scale(1.25, 1.25); g.translate(0, -2); boomerang(g, P); } else { g.rotate(-Math.PI / 4); g.scale(1.12, 1.12); DRAW[m[1]](g, P); }
    } else if (name === 'bullets') { // a small wooden box of round shots, the lid open
      g.scale(1.2, 1.2);
      rr(g, -30, -6, 60, 30, 5); fillOut(g, '#b9793e');
      g.beginPath(); g.moveTo(-30, -6); g.lineTo(-24, -28); g.lineTo(30, -28); g.lineTo(30, -6); g.closePath(); fillOut(g, '#d39a5c');
      [-18, -6, 6, 18].forEach(function (x) { g.beginPath(); g.arc(x, -6, 6, 0, Math.PI * 2); fillOut(g, '#f0c040', 2); g.beginPath(); g.arc(x - 2, -8, 2, 0, Math.PI * 2); g.fillStyle = '#fff2b0'; g.fill(); });
      rr(g, -30, 2, 60, 5, 2); g.fillStyle = 'rgba(59,35,18,0.25)'; g.fill();
    } else if (name === 'javelins') { // five plain javelins tied with a red cord
      [-0.95, -0.85, -0.75].forEach(function (a, i) { g.save(); g.translate((i - 1) * 6, (i - 1) * 4); g.rotate(a); g.scale(1.05, 1.05); javelin(g, PAL[0]); g.restore(); });
      g.beginPath(); g.ellipse(0, 0, 12, 7, -0.8, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = '#c8463a'; g.stroke();
    } else if (name === 'boomerang_broken') {
      g.scale(1.2, 1.2); boomerang(g, PAL[0], true);
    }
    g.restore();
  };
  // the icons' canvas (the owner's wpn_icons when it is in), as frames of the items texture
  var iconCanvas = function () {
    var cv = canvas(1024, 512), g = cv.getContext('2d'), art = F.images && F.images.wpn_icons;
    C.WPN_ICONS.forEach(function (name, i) {
      g.save();
      g.translate((i % 8) * 128, Math.floor(i / 8) * 128);
      g.beginPath(); g.rect(4, 4, 120, 120); g.clip();
      if (art) g.drawImage(art, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128, 0, 0, 128, 128);
      else { g.translate(64, 64); g.scale(0.9, 0.9); g.translate(-64, -64); icon(g, name); }
      g.restore();
    });
    return cv;
  };
  F.paintWeaponIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var cv = iconCanvas(), src = tex.wpnSrc;
    if (src) { // (their pack came in: painted again)
      src.image = src.source = cv;
      src.update();
      return;
    }
    src = tex.wpnSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.WPN_ICONS.forEach(function (name, i) {
      var key = C.WPN_ICON_BASE + i;
      if (tex.has(key)) tex.remove(key);
      tex.add(key, at, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128);
    });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintWeaponIcons(scene);
    return out;
  };

  // ---------- in the world: held, flying ----------
  // the weapon side on, pointing right: { key, w, h, grip (0..1 along it, where the hand is), tip (0..1, where the shot leaves) }
  var HELD = { rifle: { w: 220, h: 80, grip: 0.62, tip: 0.98 }, javelin: { w: 250, h: 44, grip: 0.46, tip: 1 }, boomerang: { w: 104, h: 104, grip: 0.5, tip: 0.5 } };
  F.weaponTexture = function (scene, k, lv) {
    lv = Math.max(0, Math.min(5, lv | 0));
    var key = 'wpnfx-' + k + '-' + lv + '-' + (F.wpnArtV || 0), H = HELD[k];
    if (!scene.textures.exists(key)) {
      var cv = canvas(H.w, H.h), g = cv.getContext('2d'), art;
      if (k === 'boomerang' && (art = F.images && F.images.wpn_spin)) g.drawImage(art, 0, lv * 128, 128, 128, 0, 0, H.w, H.h);
      else if (k !== 'boomerang' && (art = F.images && F.images.wpn_held)) g.drawImage(art, lv * 256, (k === 'rifle' ? 0 : 1) * 96, 256, 96, 0, (H.h - H.w * 96 / 256) / 2, H.w, H.w * 96 / 256);
      else {
        g.translate(H.w / 2, H.h / 2);
        var sc = k === 'boomerang' ? H.w / 100 : H.w / 106;
        g.scale(sc, sc);
        DRAW[k](g, PAL[lv]);
      }
      scene.textures.addCanvas(key, cv);
    }
    return { key: key, w: H.w, h: H.h, grip: H.grip, tip: H.tip };
  };
  // the Rifle's shot: a small bright round, with the owner's picture when it is in
  F.bulletTexture = function (scene, lv) {
    lv = Math.max(0, Math.min(5, lv | 0));
    var key = 'wpnfx-bullet-' + lv + '-' + (F.wpnArtV || 0);
    if (!scene.textures.exists(key)) {
      var cv = canvas(48, 48), g = cv.getContext('2d'), art = F.images && F.images.wpn_bullet;
      if (art) g.drawImage(art, lv * 128, 0, 128, 128, 0, 0, 48, 48);
      else {
        g.beginPath(); g.arc(24, 24, 11, 0, Math.PI * 2); g.fillStyle = PAL[lv].shot; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
        g.beginPath(); g.arc(20, 20, 4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
      }
      scene.textures.addCanvas(key, cv);
    }
    return key;
  };
  // The farmer's poses for a weapon: its own sheet when the owner's is in, else the archer's (hands empty, the weapon
  // drawn on top), else none (the farmer as they stand).
  ['rifle', 'javelin', 'boomerang'].forEach(function (k) {
    F.SHEETS['wpn_pose_' + k] = F.SHEETS['wpn_pose_' + k + '_girl'] = { frameWidth: 288, frameHeight: 384, margin: 8, spacing: 16 };
  });
  F.weaponPoseKey = function (k) {
    var s = F.session.state, girl = s.look === 'girl', own = 'wpn_pose_' + k + (girl ? '_girl' : '');
    if (F.images && F.images[own] && !L().wornLook(s)) return own; // (the looks keep the archer's poses until they have their own)
    var key = F.archerKeyFor ? F.archerKeyFor(s.look, L().wornLook(s)) : girl ? 'archer_girl' : 'archer';
    return F.images && F.images[key] ? key : null;
  };
  var L = function () { return F.Logic; };
  // the pack (tools/packs.js 'weapons'): on the Downloads page once it has pictures
  if (F.PACK_INFO && F.ASSETS && F.ASSETS.packs && F.ASSETS.packs.weapons && Object.keys(F.ASSETS.packs.weapons).length) {
    F.PACK_INFO.weapons = { name: 'Weapons', icon: 'bow', desc: 'The Rifle, the Javelin and the Boomerang, and the farmer using them.' };
  }
  // the pack pictures, asked for once (no app: none) and painted in when they come
  var ART_KEYS = ['wpn_icons', 'wpn_held', 'wpn_spin', 'wpn_bullet'];
  F.askWeaponArt = function () {
    if (F.wpnArtAsked || !F.needImage || !F.packedFile) return;
    F.wpnArtAsked = true;
    var girl = F.session && F.session.state && F.session.state.look === 'girl';
    ART_KEYS.concat(['rifle', 'javelin', 'boomerang'].map(function (k) { return 'wpn_pose_' + k + (girl ? '_girl' : ''); })).forEach(function (k) {
      if (!(F.images && F.images[k]) && F.packedFile(k)) F.needImage(k);
    });
  };
  if (F.bus) F.bus.on('packart', function (key) {
    if (ART_KEYS.indexOf(key) < 0 || !F.game) return;
    if (key === 'wpn_icons' && F.world) F.paintWeaponIcons(F.world);
    else F.wpnArtV = (F.wpnArtV || 0) + 1; // (the next shot's pictures are made from it; the old ones are let be)
  });
})(window.Farm = window.Farm || {});

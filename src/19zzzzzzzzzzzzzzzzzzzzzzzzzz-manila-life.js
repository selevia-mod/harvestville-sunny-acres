// Manila city life in the world (owner, 11 Nov 2026: docs/manila-city-life.md; content 00-zzzzzzzzzzzzzzzzzzzz-manila-life.js,
// rules 01-logicZZZZZZZZZZZZZZZ-manila-life.js). Steps 1 and 3:
// - drawn stand-ins for the new buildings (towers, the Mall, the College, shophouses, waiting sheds, the Ferris wheel, the
//   Mall's shops) until the owner's pictures come in the pack (props/manila_<art>, C.MANILA.life.art);
// - the jeepney: drawn where L.jeepAt says (the clock alone: the same on every phone); it waits at its 6 sheds, 1-2 city
//   folk get on and off; it stops and honks for anyone in front of it (you, a friend online, someone on a crosswalk) and
//   catches up after; at night every other loop, its lights on. Ride it: "Para po" at a shed, 15G, pick where to get off;
//   you sit in it and the camera follows it;
// - the roles: 3 office workers (in by morning, out at lunch, home at 6 PM), a guard at the towers, a guard at the Mall's
//   door, 6 shoppers going in and out with bags while it is open;
// - the Ferris wheel turning slowly; the Mall's door; inside, its shops ("Coming soon"), the food court (eat there for
//   energy), a guard and a sales lady, and people walking about.
// Cheap phones (F.cheapPhone): fewer people, and only those near the screen move and animate (as the crowd).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var M = C.MANILA;
  var J = M.jeep;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var GREEN = 0x5fa84a, GREY = 0xa08a68;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  if (!M || !M.on || !J) return;
  var CHEAP = !!(F.cheapPhone && F.cheapPhone());
  var IDLE = { down: 0, up: 3, left: 6, right: 6 };
  var jeepNow = function () { return M.jeepNow ? M.jeepNow() : Date.now(); }; // (the tests may set the clock it keeps)
  (M.life.people || []).forEach(function (k) { if (F.SHEETS && F.SHEETS.people) F.SHEETS[k] = F.SHEETS.people; });

  // ---------- drawn stand-ins (a canvas each, 64 px a tile: fitted into their boxes like any picture) ----------
  var PX = 64;
  var rr = function (g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  var windows = function (g, x0, y0, cols, rows, w, h, gx, gy, lit) {
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { g.fillStyle = lit && (r * 7 + c * 3) % 5 === 0 ? '#ffe9a0' : '#9fc8e8'; g.fillRect(x0 + c * gx, y0 + r * gy, w, h); }
  };
  var SHOP_COL = ['#e8b4a0', '#f2d48a', '#a8d0c0', '#c8b8e0'], ROOF_COL = ['#b5523a', '#3f7d6a', '#c58a2a', '#5a6aa8'];
  var DRAWN = {
    tower: function (g, w, h, v) { // a glass office tower
      var c = v ? '#7a93ad' : '#8fa6b8';
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(w * 0.08, h * 0.02, w * 0.9, h * 0.98);
      g.fillStyle = c; g.fillRect(w * 0.06, 0, w * 0.88, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(w * 0.06, 0, w * 0.2, h);
      windows(g, w * 0.12, h * 0.04, 4, 14, w * 0.16, h * 0.04, w * 0.2, h * 0.062, true);
      g.fillStyle = '#4b5a68'; g.fillRect(w * 0.3, h * 0.9, w * 0.4, h * 0.1); g.fillStyle = '#cfe6f5'; g.fillRect(w * 0.34, h * 0.91, w * 0.32, h * 0.09);
    },
    mall: function (g, w, h) { // a long bayside mall: glass front, a big sign board (no words), the door in the middle
      g.fillStyle = '#e9e2d4'; g.fillRect(0, h * 0.18, w, h * 0.82);
      g.fillStyle = '#5ba6c9'; g.fillRect(w * 0.04, h * 0.3, w * 0.92, h * 0.38);
      windows(g, w * 0.06, h * 0.33, 11, 2, w * 0.06, h * 0.14, w * 0.08, h * 0.18, false);
      g.fillStyle = '#d65a5a'; rr(g, w * 0.3, h * 0.02, w * 0.4, h * 0.2, 12); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(w * 0.36, h * 0.09, w * 0.28, h * 0.05);
      g.fillStyle = '#3c4b5a'; g.fillRect(w * 0.42, h * 0.72, w * 0.16, h * 0.28); g.fillStyle = '#bfe3f2'; g.fillRect(w * 0.44, h * 0.74, w * 0.12, h * 0.26);
      g.fillStyle = '#7fbf5a'; [0.08, 0.2, 0.74, 0.88].forEach(function (k) { g.beginPath(); g.arc(w * k, h * 0.86, h * 0.07, 0, 7); g.fill(); });
    },
    college: function (g, w, h) { // an old college hall with columns and a clock
      g.fillStyle = '#d8c3a0'; g.fillRect(0, h * 0.25, w, h * 0.75);
      g.fillStyle = '#8a3a2a'; g.beginPath(); g.moveTo(w * 0.3, h * 0.25); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.7, h * 0.25); g.fill();
      g.fillStyle = '#f3ead8'; g.beginPath(); g.arc(w * 0.5, h * 0.15, h * 0.06, 0, 7); g.fill();
      g.fillStyle = '#efe4cc'; for (var k = 0; k < 8; k++) g.fillRect(w * (0.08 + k * 0.115), h * 0.4, w * 0.04, h * 0.5);
      windows(g, w * 0.06, h * 0.32, 8, 1, w * 0.07, h * 0.05, w * 0.115, h * 0.1, false);
      g.fillStyle = '#5a3a24'; g.fillRect(w * 0.44, h * 0.72, w * 0.12, h * 0.28);
    },
    shophouse: function (g, w, h, v) { // store below, home above
      g.fillStyle = SHOP_COL[v % 4]; g.fillRect(w * 0.04, h * 0.18, w * 0.92, h * 0.82);
      g.fillStyle = ROOF_COL[v % 4]; g.fillRect(0, h * 0.08, w, h * 0.14);
      windows(g, w * 0.14, h * 0.3, 3, 1, w * 0.18, h * 0.16, w * 0.27, 0, false);
      g.fillStyle = ROOF_COL[(v + 1) % 4]; for (var k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#fbf3e2' : ROOF_COL[(v + 1) % 4]; g.fillRect(w * (0.06 + k * 0.148), h * 0.58, w * 0.148, h * 0.1); }
      g.fillStyle = '#6b4a30'; g.fillRect(w * 0.12, h * 0.7, w * 0.76, h * 0.3); g.fillStyle = '#f2d88a'; g.fillRect(w * 0.16, h * 0.74, w * 0.3, h * 0.22);
    },
    shed: function (g, w, h) { // a waiting shed: a roof on posts, a bench
      g.fillStyle = '#4a5a6a'; g.fillRect(w * 0.08, h * 0.3, w * 0.05, h * 0.7); g.fillRect(w * 0.87, h * 0.3, w * 0.05, h * 0.7);
      g.fillStyle = '#e8743a'; rr(g, 0, h * 0.12, w, h * 0.22, 6); g.fill();
      g.fillStyle = '#ffd34a'; g.fillRect(w * 0.3, h * 0.17, w * 0.4, h * 0.1);
      g.fillStyle = '#8a5a34'; g.fillRect(w * 0.16, h * 0.72, w * 0.68, h * 0.1); g.fillRect(w * 0.18, h * 0.82, w * 0.04, h * 0.18); g.fillRect(w * 0.78, h * 0.82, w * 0.04, h * 0.18);
    },
    sign_board: function (g, w, h, v) { // a board for a place still to come: a red arch (Chinatown) or a tin roof (the Talipapa)
      if (!v) { g.fillStyle = '#c8302a'; g.fillRect(w * 0.06, h * 0.2, w * 0.06, h * 0.8); g.fillRect(w * 0.88, h * 0.2, w * 0.06, h * 0.8); g.fillStyle = '#e2b13a'; rr(g, 0, h * 0.05, w, h * 0.25, 8); g.fill(); g.fillStyle = '#c8302a'; g.fillRect(w * 0.04, h * 0.12, w * 0.92, h * 0.1); }
      else { g.fillStyle = '#9aa4ab'; g.beginPath(); g.moveTo(0, h * 0.4); g.lineTo(w * 0.5, 0); g.lineTo(w, h * 0.4); g.fill(); g.fillStyle = '#6b4a30'; g.fillRect(w * 0.1, h * 0.4, w * 0.06, h * 0.6); g.fillRect(w * 0.84, h * 0.4, w * 0.06, h * 0.6); g.fillStyle = '#7fbf5a'; g.fillRect(w * 0.2, h * 0.7, w * 0.6, h * 0.2); }
    },
    ferris_base: function (g, w, h) { // the stand: two legs and a ticket booth (the wheel turns above it)
      g.strokeStyle = '#d8dde2'; g.lineWidth = w * 0.05;
      g.beginPath(); g.moveTo(w * 0.2, h); g.lineTo(w * 0.5, h * 0.36); g.lineTo(w * 0.8, h); g.stroke();
      g.fillStyle = '#e8743a'; g.fillRect(w * 0.36, h * 0.84, w * 0.28, h * 0.16); g.fillStyle = '#ffd34a'; g.fillRect(w * 0.4, h * 0.86, w * 0.2, h * 0.05);
    },
    ferris_wheel: function (g, w) { // the wheel and its gondolas, drawn once and turned
      var c = w / 2, R = w * 0.46;
      g.strokeStyle = '#eef2f5'; g.lineWidth = w * 0.025; g.beginPath(); g.arc(c, c, R, 0, 7); g.stroke();
      g.lineWidth = w * 0.012; for (var k = 0; k < 12; k++) { var a = k * Math.PI / 6; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R); g.stroke(); }
      var COLS = ['#e85a5a', '#ffd34a', '#5ab0e8', '#7fd06a', '#e88ad0', '#ff9a3a'];
      for (var j = 0; j < 12; j++) { var b = j * Math.PI / 6; g.fillStyle = COLS[j % 6]; g.beginPath(); g.arc(c + Math.cos(b) * R, c + Math.sin(b) * R, w * 0.045, 0, 7); g.fill(); }
      g.fillStyle = '#c8ced4'; g.beginPath(); g.arc(c, c, w * 0.04, 0, 7); g.fill();
    },
    jeepney: function (g, w, h, v) { // a long colourful jeep facing left (the game turns it): chrome, stripes, a little horse on the hood
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(w * 0.5, h * 0.9, w * 0.46, h * 0.08, 0, 0, 7); g.fill();
      g.fillStyle = '#d8dde2'; rr(g, w * 0.1, h * 0.25, w * 0.82, h * 0.55, 10); g.fill();
      g.fillStyle = '#e8402a'; g.fillRect(w * 0.12, h * 0.55, w * 0.78, h * 0.08); g.fillStyle = '#2a7ad0'; g.fillRect(w * 0.12, h * 0.63, w * 0.78, h * 0.05); g.fillStyle = '#ffd34a'; g.fillRect(w * 0.12, h * 0.68, w * 0.78, h * 0.05);
      g.fillStyle = '#9fd0f0'; for (var k = 0; k < 5; k++) g.fillRect(w * (0.3 + k * 0.12), h * 0.32, w * 0.09, h * 0.16);
      g.fillStyle = '#7fb8e0'; g.fillRect(w * 0.12, h * 0.32, w * 0.14, h * 0.18);
      g.fillStyle = '#c8302a'; rr(g, w * 0.14, h * 0.12, w * 0.76, h * 0.14, 8); g.fill(); g.fillStyle = '#fff6d0'; g.fillRect(w * 0.4, h * 0.15, w * 0.3, h * 0.07);
      g.fillStyle = '#e8e8e8'; g.fillRect(w * 0.02, h * 0.5, w * 0.1, h * 0.25); g.fillStyle = '#c8a040'; g.fillRect(w * 0.04, h * 0.42, w * 0.04, h * 0.1);
      g.fillStyle = '#2a2a2a'; [0.2, 0.78].forEach(function (k) { g.beginPath(); g.arc(w * k, h * 0.8, h * 0.11, 0, 7); g.fill(); g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(w * k, h * 0.8, h * 0.05, 0, 7); g.fill(); g.fillStyle = '#2a2a2a'; });
      if (v) { g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(w * 0.04, h * 0.58, h * 0.06, 0, 7); g.fill(); }
    },
    cart: function (g, w, h, v) { // a street cart (Chinatown's dimsum stall, its chestnut cart)
      g.fillStyle = v ? '#7a4a2a' : '#c8302a'; g.fillRect(w * 0.08, h * 0.4, w * 0.84, h * 0.4);
      g.fillStyle = v ? '#3a2a20' : '#e2b13a'; rr(g, w * 0.02, h * 0.08, w * 0.96, h * 0.2, 6); g.fill();
      g.fillStyle = '#8a8a8a'; g.fillRect(w * 0.12, h * 0.28, w * 0.05, h * 0.14); g.fillRect(w * 0.83, h * 0.28, w * 0.05, h * 0.14);
      g.fillStyle = v ? '#a06030' : '#f0f0e8'; for (var k = 0; k < 3; k++) { g.beginPath(); g.arc(w * (0.3 + k * 0.2), h * 0.42, w * 0.08, 0, 7); g.fill(); }
      g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(w * 0.25, h * 0.86, h * 0.1, 0, 7); g.fill(); g.beginPath(); g.arc(w * 0.75, h * 0.86, h * 0.1, 0, 7); g.fill();
    },
    pickleball_court: function (g, w, h) { // a court seen from above: blue-green, white lines, the net across the middle
      g.fillStyle = '#3f8f6a'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a7ab0'; g.fillRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8);
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8);
      g.beginPath(); g.moveTo(w * 0.06, h * 0.5); g.lineTo(w * 0.36, h * 0.5); g.moveTo(w * 0.64, h * 0.5); g.lineTo(w * 0.94, h * 0.5); g.stroke();
      g.beginPath(); g.moveTo(w * 0.36, h * 0.1); g.lineTo(w * 0.36, h * 0.9); g.moveTo(w * 0.64, h * 0.1); g.lineTo(w * 0.64, h * 0.9); g.stroke();
      g.fillStyle = '#eeeeee'; g.fillRect(w * 0.495, h * 0.04, w * 0.01, h * 0.92); g.fillStyle = 'rgba(30,30,30,0.5)'; g.fillRect(w * 0.488, h * 0.08, w * 0.024, h * 0.84);
    },
    // the Mall's inside
    mall_boutique: function (g, w, h) { mallShop(g, w, h, '#e88ab0', ['#f5c0d0', '#a0c8f0', '#f0e0a0']); },
    mall_toys: function (g, w, h) { mallShop(g, w, h, '#5ab0e8', ['#ffd34a', '#7fd06a', '#e85a5a']); },
    mall_arcade: function (g, w, h) { mallShop(g, w, h, '#7a5ac8', ['#5aff9a', '#ff5ad0', '#5ad0ff']); },
    mall_cinema: function (g, w, h) { mallShop(g, w, h, '#2a2a3a', ['#ffd34a', '#ffd34a', '#ffd34a']); },
    mall_food: function (g, w, h, v) { // a food court stall: its board and its counter (1 rice and noodles, 2 barbecue, 3 halo-halo)
      var c = ['#e8743a', '#c8302a', '#c86ad0'][(v || 1) - 1];
      g.fillStyle = c; g.fillRect(0, 0, w, h * 0.28); g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(w * 0.5, h * 0.14, h * 0.09, 0, 7); g.fill();
      g.fillStyle = '#f0d8a8'; g.fillRect(w * 0.04, h * 0.3, w * 0.92, h * 0.4); g.fillStyle = '#8a5a34'; g.fillRect(0, h * 0.7, w, h * 0.3);
      g.fillStyle = '#ffffff'; for (var k = 0; k < 3; k++) { g.beginPath(); g.arc(w * (0.22 + k * 0.28), h * 0.62, h * 0.07, 0, 7); g.fill(); }
    },
    mall_shut: function (g, w, h) { g.fillStyle = '#c8c8c0'; g.fillRect(0, 0, w, h * 0.25); g.fillStyle = '#9aa0a6'; g.fillRect(w * 0.04, h * 0.28, w * 0.92, h * 0.72); g.strokeStyle = '#7a8086'; g.lineWidth = 2; for (var k = 1; k < 10; k++) { g.beginPath(); g.moveTo(w * 0.04, h * (0.28 + k * 0.072)); g.lineTo(w * 0.96, h * (0.28 + k * 0.072)); g.stroke(); } g.fillStyle = '#4f9a3a'; g.beginPath(); g.arc(w * 0.08, h * 0.85, w * 0.07, 0, 7); g.arc(w * 0.92, h * 0.85, w * 0.07, 0, 7); g.fill(); },
    mall_doors: function (g, w, h) { g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, w, h); g.fillStyle = '#8fd0f0'; g.fillRect(w * 0.12, h * 0.15, w * 0.76, h * 0.85); g.fillStyle = '#5aa0e0'; g.fillRect(w * 0.12, h * 0.6, w * 0.76, h * 0.4); g.fillStyle = '#ffffff'; g.fillRect(w * 0.49, h * 0.15, w * 0.02, h * 0.85); },
    mall_fountain: function (g, w, h) { g.fillStyle = '#e8e2d4'; g.beginPath(); g.ellipse(w * 0.5, h * 0.75, w * 0.46, h * 0.2, 0, 0, 7); g.fill(); g.fillStyle = '#5ab0e8'; g.beginPath(); g.ellipse(w * 0.5, h * 0.72, w * 0.38, h * 0.14, 0, 0, 7); g.fill(); g.fillStyle = '#e8e2d4'; g.fillRect(w * 0.44, h * 0.3, w * 0.12, h * 0.42); g.fillStyle = '#9fd8f8'; g.beginPath(); g.arc(w * 0.5, h * 0.28, w * 0.14, 0, 7); g.fill(); },
    mall_table: function (g, w, h) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(w * 0.5, h * 0.45, w * 0.3, h * 0.25, 0, 0, 7); g.fill(); g.fillStyle = '#e8743a'; g.fillRect(w * 0.04, h * 0.4, w * 0.12, h * 0.5); g.fillRect(w * 0.84, h * 0.4, w * 0.12, h * 0.5); },
    mall_palm: function (g, w, h) { g.fillStyle = '#ffffff'; g.fillRect(w * 0.2, h * 0.72, w * 0.6, h * 0.28); g.fillStyle = '#4f9a3a'; for (var k = 0; k < 5; k++) { g.beginPath(); g.ellipse(w * 0.5 + Math.cos(k * 1.3) * w * 0.25, h * 0.35 + Math.sin(k * 1.3) * h * 0.1, w * 0.3, h * 0.06, k * 1.3, 0, 7); g.fill(); } },
    mall_planter: function (g, w, h) { g.fillStyle = '#c8a070'; g.fillRect(0, h * 0.5, w, h * 0.5); g.fillStyle = '#e88ab0'; for (var k = 0; k < 8; k++) { g.beginPath(); g.arc(w * (0.08 + k * 0.12), h * 0.4, h * 0.14, 0, 7); g.fill(); } },
    mall_map_kiosk: function (g, w, h) { g.fillStyle = '#4a5a6a'; g.fillRect(w * 0.35, h * 0.5, w * 0.3, h * 0.5); g.fillStyle = '#f0f0e8'; g.fillRect(w * 0.08, h * 0.05, w * 0.84, h * 0.5); g.fillStyle = '#5ab0e8'; g.fillRect(w * 0.2, h * 0.15, w * 0.25, h * 0.15); g.fillStyle = '#7fd06a'; g.fillRect(w * 0.5, h * 0.3, w * 0.3, h * 0.15); },
    mall_claw: function (g, w, h) { g.fillStyle = '#e85a5a'; g.fillRect(w * 0.1, h * 0.6, w * 0.8, h * 0.4); g.fillStyle = '#cfeaf8'; g.fillRect(w * 0.1, h * 0.05, w * 0.8, h * 0.55); g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(w * 0.4, h * 0.5, w * 0.12, 0, 7); g.arc(w * 0.62, h * 0.48, w * 0.1, 0, 7); g.fill(); },
    mall_cabinet: function (g, w, h) { g.fillStyle = '#3a2a6a'; g.fillRect(w * 0.1, 0, w * 0.8, h); g.fillStyle = '#5affc8'; g.fillRect(w * 0.18, h * 0.1, w * 0.64, h * 0.3); g.fillStyle = '#ff5ad0'; g.beginPath(); g.arc(w * 0.35, h * 0.55, w * 0.07, 0, 7); g.arc(w * 0.65, h * 0.55, w * 0.07, 0, 7); g.fill(); },
    mall_counter: function (g, w, h) { g.fillStyle = '#8a5a34'; g.fillRect(0, h * 0.25, w, h * 0.75); g.fillStyle = '#f0d8a8'; g.fillRect(0, h * 0.15, w, h * 0.15); g.fillStyle = '#4a5a6a'; g.fillRect(w * 0.6, 0, w * 0.25, h * 0.2); },
    mall_escalator: function (g, w, h) {
      g.fillStyle = '#b8c2cc'; g.beginPath(); g.moveTo(w * 0.1, h); g.lineTo(w * 0.35, 0); g.lineTo(w * 0.65, 0); g.lineTo(w * 0.9, h); g.fill();
      g.strokeStyle = '#6a7680'; g.lineWidth = 2; for (var k = 1; k < 10; k++) { g.beginPath(); g.moveTo(w * (0.1 + k * 0.025), h * (1 - k * 0.1)); g.lineTo(w * (0.9 - k * 0.025), h * (1 - k * 0.1)); g.stroke(); }
      g.fillStyle = '#2a2a2a'; g.fillRect(w * 0.08, h * 0.1, w * 0.05, h * 0.9); g.fillRect(w * 0.87, h * 0.1, w * 0.05, h * 0.9);
    },
    mall_bench: function (g, w, h) { g.fillStyle = '#8a5a34'; g.fillRect(0, h * 0.3, w, h * 0.3); g.fillStyle = '#5a3a24'; g.fillRect(w * 0.06, h * 0.6, w * 0.06, h * 0.4); g.fillRect(w * 0.88, h * 0.6, w * 0.06, h * 0.4); },
    mall_plant: function (g, w, h) { g.fillStyle = '#c8a070'; g.fillRect(w * 0.2, h * 0.7, w * 0.6, h * 0.3); g.fillStyle = '#4f9a3a'; g.beginPath(); g.arc(w * 0.5, h * 0.45, w * 0.42, 0, 7); g.fill(); },
  };
  var mallShop = function (g, w, h, col, goods) { // a shop front: a sign band, a window with goods, a door
    g.fillStyle = col; g.fillRect(0, 0, w, h * 0.25);
    g.fillStyle = '#fffaf0'; g.fillRect(w * 0.15, h * 0.08, w * 0.7, h * 0.09);
    g.fillStyle = '#d8e8f0'; g.fillRect(w * 0.04, h * 0.3, w * 0.62, h * 0.6);
    goods.forEach(function (c, k) { g.fillStyle = c; g.fillRect(w * (0.08 + k * 0.19), h * 0.5, w * 0.14, h * 0.3); });
    g.fillStyle = '#5a3a24'; g.fillRect(w * 0.72, h * 0.35, w * 0.22, h * 0.65);
  };
  var DRAWN_SIZE = { cart: [2, 2], pickleball_court: [8, 5], tower: [5, 11], mall: [12, 8], college: [14, 9], shophouse: [4, 4], shed: [3, 2], sign_board: [8, 3], ferris_base: [7, 7], ferris_wheel: [7, 7],
    jeepney: [4, 3], mall_boutique: [4, 3], mall_toys: [4, 3], mall_arcade: [4, 3], mall_cinema: [4, 3], mall_food: [4, 3], mall_shut: [4, 3], mall_doors: [4, 3],
    mall_escalator: [3, 3], mall_fountain: [3, 3], mall_table: [2, 1], mall_bench: [2, 1], mall_palm: [1, 2], mall_planter: [3, 1], mall_map_kiosk: [1, 2], mall_claw: [1, 2],
    mall_cabinet: [1, 2], mall_counter: [2, 1] };
  // the Mall's own floor and wall sheet (M.MALLG): the owner's swatches (manila_tex_mallfloor_<k>, manila_tex_mallwall_<k>) once
  // they are in, else plain colours
  var MALLC = { floor: { main: '#efe6d2', walk: '#e4e4e8', food: '#e0b080', boutique: '#d8b480', toys: '#f0d0e0', arcade: '#2a3a6a', cinema: '#8a2a2a', garden: '#c0c4b8', entrance: '#d8c090' },
    wall: { main: '#f0e6cc', bay: '#9fd0f0', food: '#f2d88a', boutique: '#f5c8d0', toys: '#b8dcf5', arcade: '#5a3a8a', cinema: '#6a1a1a', garden: '#b8e0c0', plain: '#f8f8f4' } };
  var mallSig = null;
  F.mnMallGround = function (scene) {
    var MG = M.MALLG, have = function (k) { return F.images && F.images['manila_tex_' + k]; };
    var sig = MG.FLOORS.map(function (k) { return have('mallfloor_' + k) ? 1 : 0; }).concat(MG.WALLS.map(function (k) { return have('mallwall_' + k) ? 1 : 0; })).join('');
    if (F.images[MG.NAME] && sig === mallSig) return;
    mallSig = sig;
    if (scene.textures.exists(MG.NAME)) scene.textures.remove(MG.NAME);
    var half = 2, S = MG.SIZE / half, MA = MG.MARGIN / half, SP = MG.SPACING / half, cv = document.createElement('canvas');
    cv.width = MG.IMAGE_W / half;
    cv.height = MG.IMAGE_H / half;
    var g = cv.getContext('2d');
    var cell = function (i, img, col, wall) {
      var x = MA + (i % MG.COLS) * (S + SP), y = MA + Math.floor(i / MG.COLS) * (S + SP);
      if (img) { g.drawImage(img, x - MA, y - MA, S + 2 * MA, S + 2 * MA); g.drawImage(img, x, y, S, S); return; }
      g.fillStyle = col; g.fillRect(x - MA, y - MA, S + 2 * MA, S + 2 * MA);
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
      if (wall) { for (var k = 1; k < 4; k++) g.strokeRect(x + k * S / 4 - 1, y, 2, S); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y + S - 6, S, 6); }
      else g.strokeRect(x + 1, y + 1, S - 2, S - 2);
    };
    MG.FLOORS.forEach(function (k, i) { cell(i, have('mallfloor_' + k), MALLC.floor[k], false); });
    MG.WALLS.forEach(function (k, i) { cell(10 + i, have('mallwall_' + k), MALLC.wall[k], true); });
    cell(MG.VOID, null, '#2a1a10', false);
    F.images[MG.NAME] = cv;
    F.sizes = F.sizes || {};
    F.sizes[MG.NAME] = [MG.IMAGE_W, MG.IMAGE_H];
  };
  // a stand-in's texture key (made once; the same for every map: let go with the scene's textures like any other)
  F.mnStandIn = function (scene, name, v) {
    var key = 'mnd-' + name + '-' + (v || 0);
    if (scene.textures.exists(key)) return key;
    var draw = DRAWN[name], sz = DRAWN_SIZE[name];
    if (!draw || !sz) return null;
    var w = sz[0] * PX, h = sz[1] * PX, tex = scene.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h, v || 0);
    tex.refresh();
    return key;
  };
  // a picture's key: the owner's when it is in, else the drawn one
  var artKey = function (scene, art, name, v) { return F.images && F.images['props/manila_' + art] ? F.ensureTexture(scene, 'props/manila_' + art) : F.mnStandIn(scene, name, v); };

  // ---------- setting up a city map's life ----------
  P.mnLife = function () {
    var mn = this.mn;
    mn.roles = [];
    mn.riders = [];
    if (mn.mall) {
      var R = M.mall.roles;
      Object.keys(R).forEach(function (k) { for (var i = 0; i < R[k].n; i++) this.mnRoleAdd(k, R[k], i); }, this);
      return;
    }
    var RS = M.roles, self = this;
    Object.keys(RS).forEach(function (k) {
      var n = CHEAP && RS[k].cheap != null ? RS[k].cheap : RS[k].n;
      for (var i = 0; i < n; i++) self.mnRoleAdd(k, RS[k], i);
    });
    this.mnJeepSetup();
    this.mnFerrisSetup();
    this.mnRailSetup();
  };

  // ---------- the elevated railway (scenery, owner's art only): its deck over the rails, pillars, the buffer, the train ----------
  P.mnRailSetup = function () {
    var R = M.rail, self = this;
    if (!R || !has('rail_deck')) return;
    var deck = F.ensureTexture(this, 'props/manila_rail_deck'), fr = this.textures.getFrame(deck), dw = 4 * T, dh = dw * fr.realHeight / fr.realWidth;
    var depth = DEPTH.actor + R.y * T / 1e5;
    var put = function (art, x, w, d) {
      if (!has(art)) return null;
      var k = F.ensureTexture(self, 'props/manila_' + art), f = self.textures.getFrame(k), h = w * f.realHeight / f.realWidth;
      var im = self.add.image(x, R.y * T, k).setOrigin(0.5, 1).setDisplaySize(w, h);
      F.depthTo(im, depth + (d || 0));
      return im;
    };
    R.pillars.forEach(function (x) { put('rail_pillar', x * T, 1.6 * T, -2e-6); });
    var flip = !!R.flip; // (the city turned round, 00-...-manila-flip.js: the deck laid from its buffer's end, east)
    for (var x = flip ? R.x1 - 4 : R.x0; flip ? x > R.x0 - 4 : x < R.x1; x += flip ? -4 : 4) {
      var im = this.add.image(x * T, (R.y - 0.4) * T, deck).setOrigin(0, 1).setDisplaySize(dw, dh);
      F.depthTo(im, depth - 1e-6);
    }
    // (the owner's end piece has its buffer on the right; the track ends at the WEST, so it is turned round)
    var end = put('rail_end', (R.end + (flip ? -0.9 : 0.9)) * T, 1.8 * T, 0);
    if (end) { end.y -= 0.2 * T; end.setFlipX(!flip); }
    // a covered platform with benches on the deck, east of the parked train, and stairs down to the avenue's sidewalk
    if (R.platform) { var pf = put('rail_platform', (R.platform + 2) * T, 4 * T, 2e-6); if (pf) pf.y -= 0.3 * T; }
    if (R.stairs) { var st = put('rail_stairs', (R.stairs + 1) * T, 2 * T, 3e-6); if (st) st.y += 0.9 * T; }
    // the train at the platform, its head toward the buffer (turned round with the city)
    var tx = R.train * T, head = put('city_train_head', tx + (flip ? 4 * R.cars + 2 : 2) * T, 4 * T, 1e-6);
    if (head) { head.y -= 0.75 * T; head.setFlipX(flip); }
    for (var c = 0; c < R.cars; c++) { var car = put('city_train_car', tx + (flip ? 2 + 4 * c : 6 + 4 * c) * T, 4 * T, 1e-6); if (car) { car.y -= 0.75 * T; car.setFlipX(flip); } }
  };

  // ---------- roles ----------
  var TITLES = { priest: 'FATHER RAMON', dimsum: 'THE DIMSUM VENDOR', castanas: 'THE CASTANAS VENDOR', pickleball: 'A PICKLEBALL PLAYER', office: 'AN OFFICE WORKER', tower_guard: 'THE TOWER GUARD', mall_guard: 'THE MALL GUARD', shopper: 'A SHOPPER', guard: 'THE GUARD', sales: 'THE SALES LADY' };
  // (in front of the towers' doors and the Mall's: from their boxes, wherever the city puts them)
  var TOWER_DOORS = ['tower1', 'tower2'].map(function (k) { var b = M.buildings.filter(function (x) { return x.key === k; })[0].box; return [b[0] + 3, b[1] + b[3] + 0.6]; });
  var MALL_DOOR = M.mall.out;
  // the owner's vehicles (3 x 3 driving sheets, frames of 512 x 384: tools/manila/manila-import.js)
  if (F.SHEETS) ['tricycle', 'calesa'].forEach(function (k) { F.SHEETS['manila_' + k] = { frameWidth: 512, frameHeight: 384, margin: 0, spacing: 0 }; });
  P.mnRoleAdd = function (key, role, i) {
    var mn = this.mn, own = (role.sheets || []).filter(function (k) { return F.images && F.images[k]; });
    // (owner, 11 Nov 2026: a role never wears another character's look: out only once its own sheet is in)
    if (!own.length && !M.roleStandIns) return null;
    var l = own.length ? [own[i % own.length], 0, 0] : role.looks[i % role.looks.length];
    var look = { key: l[0], row: l[1], tint: l[2] || 0 };
    if (!(F.images && F.images[look.key])) look = { key: 'tw_people', row: i % 5, tint: l[2] || 0 };
    F.ensureTexture(this, look.key);
    ['down', 'up', 'side'].forEach(function (d, j) {
      var f = look.row * 9 + j * 3, ak = 'mnf-' + look.key + '-' + look.row + '-' + d;
      if (!this.anims.exists(ak)) this.anims.create({ key: ak, frames: this.anims.generateFrameNumbers(look.key, { frames: [f + 1, f, f + 2, f] }), frameRate: 6, repeat: -1 });
    }, this);
    // (owner's redrawn court, 11 Nov 2026: a fence and a bench along its back; the four stand on the green, two each side of the net)
    var court = role.court, spot = court ? [court[0] + (i < 2 ? 1.5 : court[2] - 1.5), court[1] + (i % 2 ? 4.3 : 3.1), i < 2 ? 'right' : 'left'] : null;
    if (spot) role = Object.assign({}, role, { post: spot });
    var at = role.post || (key === 'office' ? TOWER_DOORS[i % 2] : key === 'shopper' ? MALL_DOOR : M.spots.plaza_s);
    var sp = this.add.sprite(at[0] * T, at[1] * T, look.key, look.row * 9).setOrigin(0.5, 0.83).setScale(2);
    if (look.tint) sp.setTint(look.tint);
    var v = { folk: true, role: key, def: role, look: look, sp: sp, x: at[0] * T, y: at[1] * T, zone: 'plaza', path: [], hold: 300 + Math.random() * 3000, dir: role.post ? role.post[2] : 'down',
      act: '', speed: 1.5 * T, near: true, pal: null, title: TITLES[key] || 'SOMEONE', lines: role.lines, n: i, door: key === 'office' ? TOWER_DOORS[i % 2] : null };
    if (key === 'shopper') { v.bag = this.add.image(v.x, v.y, 'items', C.ICON.bag).setScale(0.45).setVisible(false); v.insideMs = 2000 + i * 4000; this.mnHide(v, true); }
    if (key === 'office') this.mnHide(v, true); // (in or at home until their hour says: placed by the next look)
    F.depthTo(sp, DEPTH.actor + v.y / 1e5);
    if (role.post) this.mnFolkFace(v, role.post[2]);
    if (role.hours && !inHours(role.hours, this.state.time)) this.mnHide(v, true); // (not their hour: in)
    mn.folk.push(v);
    mn.roles.push(v);
    return v;
  };
  P.mnHide = function (v, inside) {
    v.inside = !!inside;
    v.sp.setVisible(!inside && v.near);
    if (v.bag) v.bag.setVisible(false);
    v.path = [];
  };
  P.mnPlaceAt = function (v, p) { v.x = p[0] * T; v.y = p[1] * T; this.mnFolkPlace(v); };
  var openNow = function (span, min) { return span[0] < span[1] ? min >= span[0] && min < span[1] : min >= span[0] || min < span[1]; };
  var scheduleAt = function (sch, min) { var at = sch[0][1]; sch.forEach(function (e) { if (min >= e[0]) at = e[1]; }); return at; };
  var tile = function (p) { return [Math.floor(p[0]), Math.floor(p[1])]; };
  // what a role does when it is free to choose (called by the crowd's mnFolkNext)
  var inHours = function (hours, min) { return !hours || hours.some(function (h) { return min >= h[0] && min < h[1]; }); };
  P.mnRoleNext = function (v) {
    var role = v.def, min = this.state.time, g = this.mn.grid;
    if (role.hours) { // out only in their hours (else in, at the post)
      var out = inHours(role.hours, min);
      if (!out && !v.inside) { this.mnPlaceAt(v, role.post); this.mnHide(v, true); v.hold = 30000; return; }
      if (out && v.inside) { this.mnPlaceAt(v, role.post); v.inside = false; v.sp.setVisible(v.near); this.mnFolkFace(v, role.post[2]); }
      if (!out) { v.hold = 30000; return; }
      if (role.court) { this.mnFolkFace(v, role.post[2]); v.hold = 4000; return; } // (the game is played in mnUpdateRoles)
    }
    if (role.post) { // back to the post, and stand there
      var pt = tile(role.post), here = [Math.floor(v.x / T), Math.floor(v.y / T)];
      if (here[0] !== pt[0] || here[1] !== pt[1]) return this.mnFolkGo(v, pt[0], pt[1], role.post[2]);
      this.mnFolkFace(v, role.post[2]);
      v.hold = 8000 + Math.random() * 8000;
      return;
    }
    if (v.role === 'office') {
      var want = scheduleAt(role.schedule, min), sh = J.stops[0].wait;
      if (want === 'in:home' || want === 'in:tower') {
        var door = want === 'in:home' ? sh : v.door, dt = tile(door);
        if (v.inside) { v.hold = 20000; return; }
        if (Math.abs(v.x / T - door[0]) < 1.2 && Math.abs(v.y / T - door[1]) < 1.2) { this.mnHide(v, true); v.hold = 20000; return; }
        return this.mnFolkGo(v, dt[0], dt[1], 'up');
      }
      if (v.inside) { // out: from the tower (lunch) or off the jeep (morning)
        this.mnPlaceAt(v, want === 'station_shed' && min < 12 * 60 ? sh : v.door);
        v.inside = false;
        v.sp.setVisible(v.near);
      }
      if (want === 'station_shed') { var st = tile(sh); return this.mnFolkGo(v, st[0] + (v.n % 3), st[1], 'down'); }
      var pts = M.crowd.zones.plaza.at, q = pts[(v.n * 3 + Math.floor(Math.random() * 3)) % pts.length];
      return this.mnFolkGo(v, q[0], q[1], q[2] || '');
    }
    if (v.role === 'shopper') {
      var open = openNow(role.open, min);
      if (v.inside) {
        if (!open) { v.hold = 30000; return; }
        v.insideMs -= 1000;
        if (v.insideMs > 0) { v.hold = 1000; return; }
        this.mnPlaceAt(v, MALL_DOOR);
        v.inside = false;
        v.sp.setVisible(v.near);
        v.withBag = true;
        v.insideMs = 20000 + Math.random() * 25000;
        var z = Math.random() < 0.5 ? 'mallfront' : 'sheds', ps = M.crowd.zones[z].at, qq = ps[Math.floor(Math.random() * ps.length)];
        if (z === 'sheds') qq = ps[6 + Math.floor(Math.random() * 2)]; // (the Mall's own shed)
        return this.mnFolkGo(v, qq[0], qq[1], qq[2] || '');
      }
      // out: a while in front, then back in through the door
      var md = tile(MALL_DOOR);
      if (Math.abs(v.x / T - MALL_DOOR[0]) < 1.2 && Math.abs(v.y / T - MALL_DOOR[1]) < 1.2) { this.mnHide(v, true); v.withBag = false; v.hold = 1000; return; }
      if (!v.lingered) { v.lingered = true; v.hold = 4000 + Math.random() * 6000; return; }
      v.lingered = false;
      return this.mnFolkGo(v, md[0], md[1], 'up');
    }
  };
  // the pickleball rally: the ball goes across the net, a player steps to it and hits it back
  P.mnRally = function (dt) {
    var mn = this.mn, ps = (mn.roles || []).filter(function (v) { return v.role === 'pickleball' && !v.inside; });
    if (ps.length < 2) { if (mn.ball) mn.ball.setVisible(false); return; }
    if (!mn.ball) { mn.ball = this.add.circle(0, 0, 18, 0xf2ff5a).setStrokeStyle(3, 0x6a7a20); mn.rally = { t: 0, from: 0, to: 2 }; }
    var R = mn.rally, HIT = 1100;
    R.t += dt;
    if (R.t >= HIT) { R.t -= HIT; R.from = R.to; R.to = R.from < 2 ? 2 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 2); if (!ps[R.to]) R.to = R.from < 2 ? ps.length - 1 : 0; }
    var a = ps[R.from] || ps[0], b = ps[R.to] || ps[ps.length - 1], k = R.t / HIT;
    var x = a.x + (b.x - a.x) * k, y = a.y - 0.9 * T + (b.y - a.y) * k - Math.sin(k * Math.PI) * 0.9 * T;
    mn.ball.setVisible(a.near).setPosition(x, y);
    F.depthTo(mn.ball, DEPTH.actor + Math.max(a.y, b.y) / 1e5 + 1e-5);
    // the one about to hit leans in (a little step), the others ready
    ps.forEach(function (v, i) {
      var lean = i === R.to && k > 0.7 ? (i < 2 ? 0.25 : -0.25) * T : 0;
      v.sp.x = v.x + lean;
    });
  };
  P.mnUpdateRoles = function (dt) {
    this.mnRally(dt || 0);
    (this.mn.roles || []).forEach(function (v) {
      if (!v.bag) return;
      var show = v.withBag && !v.inside && v.near;
      v.bag.setVisible(show);
      if (show) { v.bag.setPosition(v.x + (v.dir === 'left' ? -0.3 : 0.3) * T, v.y - 0.45 * T); F.depthTo(v.bag, DEPTH.actor + v.y / 1e5 + 1e-6); }
    });
  };

  // ---------- the Ferris wheel ----------
  // The owner's pictures: the stand (ferris_stand, drawn as the building) + the wheel (ferris_wheel, turning) + 8 gondolas
  // (ferris_cars) hanging from it and staying upright; or, with only ferris_whole, that one picture, still. Else drawn.
  var has = function (k) { return !!(F.images && F.images['props/manila_' + k]); };
  P.mnFerrisSetup = function () {
    var b = M.buildings.filter(function (x) { return x.ferris; })[0];
    if (!b) return;
    var own = has('ferris_stand') && has('ferris_wheel');
    if (!own && has('ferris_whole')) return; // (the whole picture is the building: mnDrawProp uses it, see below)
    var key = own ? F.ensureTexture(this, 'props/manila_ferris_wheel') : F.mnStandIn(this, 'ferris_wheel', 0), size = b.box[2] * 0.95 * T;
    var cx = (b.box[0] + b.box[2] / 2) * T, cy = (b.box[1] + b.box[3] * 0.38) * T, base = DEPTH.actor + (b.box[1] + b.box[3]) * T / 1e5;
    var w = this.mn.wheel = this.add.image(cx, cy, key).setDisplaySize(size, size);
    F.depthTo(w, base - 1e-5); // (behind its legs)
    this.mn.cars = [];
    if (own) for (var i = 0; i < 8; i++) {
      var ck = has('ferris_car_' + (i + 1)) ? F.ensureTexture(this, 'props/manila_ferris_car_' + (i + 1)) : null;
      var car = ck ? this.add.image(cx, cy, ck).setOrigin(0.5, 0.1) : this.add.circle(cx, cy, 0.3 * T, [0xe85a5a, 0xffd34a, 0x5ab0e8, 0x7fd06a, 0xe88ad0, 0xff9a3a, 0x9a6ad0, 0x4f9a3a][i]);
      if (ck) { var fr = this.textures.getFrame(ck), kk = 0.95 * T / fr.realWidth; car.setDisplaySize(fr.realWidth * kk, fr.realHeight * kk); }
      F.depthTo(car, base - 5e-6);
      this.mn.cars.push(car);
    }
    this.mn.wheelR = size * 0.44;
  };
  P.mnFerrisTurn = function (dt) {
    var mn = this.mn, w = mn.wheel;
    if (!w) return;
    w.rotation += dt * 0.00012; // (slowly: a turn in under a minute)
    (mn.cars || []).forEach(function (c, i) { var a = w.rotation + i * Math.PI / 4; c.setPosition(w.x + Math.cos(a) * mn.wheelR, w.y + Math.sin(a) * mn.wheelR); }); // (upright)
  };

  // ---------- the jeepney ----------
  // the owner's jeepney (jeepney.png: a 3 x 3 driving sheet, manila_jeepney), else the city prop jeep, else drawn
  if (F.SHEETS) F.SHEETS.manila_jeepney = { frameWidth: 512, frameHeight: 384, margin: 0, spacing: 0 };
  P.mnJeepSetup = function () {
    var sheet = !!(F.images && F.images.manila_jeepney);
    var key = sheet ? F.ensureTexture(this, 'manila_jeepney') : F.images && F.images['props/manila_jeep'] ? F.ensureTexture(this, 'props/manila_jeep') : F.mnStandIn(this, 'jeepney', 0);
    var fr = this.textures.getFrame(key, 0), k = Math.min(3.6 * T / fr.realWidth, 2.7 * T / fr.realHeight);
    var img = (sheet ? this.add.sprite(0, 0, key, 0) : this.add.image(0, 0, key)).setOrigin(0.5, 0.78).setDisplaySize(fr.realWidth * k, fr.realHeight * k);
    var glow = this.add.ellipse(0, 0, 1.6 * T, 0.9 * T, 0xfff3a0, 0.35).setVisible(false);
    this.mn.jeep = { img: img, glow: glow, lag: 0, last: -2, honkMs: 0, at: null, sheet: sheet, ms: 0 };
    this.mnJeepUpdate(0);
  };
  // someone the jeep must not run over: in front of it on its way (you, friends online, a city folk on a crosswalk)
  var near = function (x, y, a, b) { return Math.abs(x - a) < 1.1 * T && Math.abs(y - b) < 1.1 * T; };
  P.mnJeepBlocked = function (st, ahead) {
    var self = this, pts = [[ahead.x * T, ahead.y * T], [(st.x + ahead.x) / 2 * T, (st.y + ahead.y) / 2 * T]];
    var hit = function (x, y) { return pts.some(function (p) { return near(x, y, p[0], p[1]); }); };
    if (!this.mnRide || this.mnRide.stage !== 'on') { var f = this.feet(); if (hit(f.x, f.y)) return true; }
    var rs = this.remotes || {};
    if (Object.keys(rs).some(function (id) { var r = rs[id]; return r && hit(r.x, r.y); })) return true;
    return this.mn.folk.some(function (v) { return v.near && !v.inside && !v.riding && hit(v.x, v.y); }); // (someone on a crosswalk)
  };
  P.mnJeepUpdate = function (dt) {
    var J0 = this.mn.jeep;
    if (!J0) return;
    var now = jeepNow(), st = L.jeepAt(now - J0.lag);
    if (st.on && st.stop < 0) {
      var ahead = L.jeepAt(now - J0.lag + 700);
      if (ahead.stop < 0 || ahead.d !== st.d) {
        J0.held = false;
        if (this.mnJeepBlocked(st, ahead)) {
          J0.held = true;
          J0.lag += dt;
          st = L.jeepAt(now - J0.lag);
          J0.honkMs -= dt;
          if (J0.honkMs <= 0) { J0.honkMs = 2500; sfx('nope'); if (this.floatTextAt) this.floatTextAt(st.x * T, st.y * T - 1.8 * T, 'Beep beep!'); }
        } else if (J0.lag > 0) J0.lag = Math.max(0, J0.lag - dt * 0.5); // (it catches up, a little faster)
      }
    }
    J0.at = st;
    var x = st.x * T, y = st.y * T;
    J0.img.setVisible(st.on).setPosition(x, y).setFlipX(st.dir === 'right');
    if (J0.sheet) { // its rows: down, up, left (right: left, turned); its columns: stopped, driving 1, driving 2
      J0.ms += dt;
      var row = st.dir === 'down' ? 0 : st.dir === 'up' ? 1 : 2, moving = st.stop < 0 && !J0.held;
      J0.img.setFrame(row * 3 + (moving ? 1 + Math.floor(J0.ms / 160) % 2 : 0));
    }
    F.depthTo(J0.img, DEPTH.actor + y / 1e5);
    J0.glow.setVisible(st.on && st.lights).setPosition(x + (st.dir === 'right' ? 1.9 : st.dir === 'left' ? -1.9 : 0) * T, y + (st.dir === 'down' ? 1 : st.dir === 'up' ? -1.4 : -0.2) * T);
    F.depthTo(J0.glow, DEPTH.actor + y / 1e5 - 1e-6);
    var stop = st.on ? st.stop : -1;
    if (stop !== J0.last) { J0.last = stop; if (stop >= 0) this.mnJeepStopped(stop); }
    this.mnRideUpdate(st);
  };
  // at a stop: 1 or 2 city folk get off, 1 or 2 waiting at the shed get on; you get on or off
  P.mnJeepStopped = function (i) {
    var mn = this.mn, st = J.stops[i], w = [st.wait[0] * T, st.wait[1] * T], self = this;
    var off = mn.riders.splice(0, 1 + Math.floor(Math.random() * 2));
    off.forEach(function (v, k) { v.riding = false; v.x = w[0] + (k - 0.5) * 0.8 * T; v.y = w[1]; v.zone = 'sheds'; v.path = []; v.hold = 800; self.mnFolkPlace(v); v.sp.setVisible(v.near); });
    var on = mn.folk.filter(function (v) { return !v.role && !v.riding && !v.inside && !v.leaving && v.zone === 'sheds' && !v.path.length && Math.hypot(v.x - w[0], v.y - w[1]) < 3 * T; }).slice(0, 2);
    on.forEach(function (v) { v.riding = true; v.sp.setVisible(false); if (v.seated) { v.seated = false; } mn.riders.push(v); });
    var r = this.mnRide;
    if (!r) return;
    if (r.stage === 'wait' && r.from === i) {
      var f = this.feet();
      if (Math.hypot(f.x - w[0], f.y - w[1]) < JEEP_NEAR * T) this.mnBoard(); // (anywhere still waiting by its shed: owner, 12 Nov 2026)
    } else if (r.stage === 'on' && r.to === i) this.mnAlight(i);
  };

  // ---------- riding it ----------
  P.mnBoard = function () {
    this.mnRide.stage = 'on';
    this.player.body.enable = false;
    if (F.ui) F.ui.toast('On board! Next stop: ' + J.stops[this.mnRide.to].name + '.', 2200);
    sfx('door');
  };
  P.mnAlight = function (i) {
    var w = J.stops[i].wait;
    this.mnRide = null;
    this.player.body.enable = true;
    this.player.setScale(1);
    this.setFeet(w[0] * T, w[1] * T);
    this.dir = 'down';
    this.idle();
    if (F.ui) F.ui.toast('Salamat po! ' + J.stops[i].name + '.', 2000);
    sfx('door');
    this.save();
  };
  var JEEP_NEAR = 8; // (tiles from a stop's wait spot: within, the jeep picks you up; further, you walked off and get the fare back)
  var JEEP_BACK = 1.45; // (tiles from its middle to its back step, side on: it is drawn 3.6 tiles long)
  P.mnRideUpdate = function (st) {
    var r = this.mnRide;
    if (!r) return;
    if (r.stage === 'wait') {
      var w = J.stops[r.from].wait, f = this.feet();
      if (Math.hypot(f.x - w[0] * T, f.y - w[1] * T) > JEEP_NEAR * T) { // walked off: the fare back
        this.mnRide = null;
        this.state.gold += J.fare;
        this.changed();
        if (F.ui) F.ui.toast('You left the shed. Here are your ' + J.fare + 'G back.', 2400);
      }
      return;
    }
    // on board: standing at the back, the camera following. Driving up or down, as before (owner: "standing at the back
    // is iconic"); driving sideways, on its back step and seen from the side, facing the way it goes (owner, 12 Nov 2026)
    this.player.body.setVelocity(0, 0);
    var side = st.dir === 'left' || st.dir === 'right', back = st.dir === 'left' ? JEEP_BACK : st.dir === 'right' ? -JEEP_BACK : 0;
    this.setFeet(st.x * T + back * T, st.y * T + (side ? -0.85 : -0.25) * T);
    var face = side ? st.dir : 'down';
    if (this.dir !== face) { this.dir = face; this.idle(); }
    F.depthTo(this.player, DEPTH.actor + st.y * T / 1e5 + 1e-6);
  };
  var update = P.update;
  P.update = function (time, delta) {
    var riding = this.mnRide && this.mnRide.stage === 'on';
    if (riding) { F.input.jx = F.input.jy = 0; if (this.keys) Object.keys(this.keys).forEach(function (k) { this.keys[k].isDown = false; }, this); }
    update.apply(this, arguments);
    if (!this.mn || this.busy) return;
    var dt = Math.min(delta, 100);
    this.mnJeepUpdate(dt);
    this.mnUpdateRoles(dt);
    this.mnFerrisTurn(dt);
    if (riding && this.player.anims.isPlaying) this.idle();
  };
  U.mnJeepStops = function (from) {
    var self = this, w = F.world, s = F.session.state;
    if (!w || F.session.visit) return this.dialog('THE JEEPNEY\nRide the jeep from your own game.');
    if (w.mnRide) return this.dialog('THE JEEPNEY\nYou are already waiting for the jeep. Stay by the shed!');
    var wait = L.jeepWait(jeepNow() - ((w.mn && w.mn.jeep && w.mn.jeep.lag) || 0), from), secs = Math.max(1, Math.round(wait / 1000));
    var rows = J.stops.map(function (st, i) {
      return { icon: C.ICON.crate, name: st.name, desc: i === from ? 'You are here.' : 'Get off at ' + st.name + '.',
        buttons: [{ label: i === from ? 'Here' : J.fare + 'G', color: i === from ? GREY : GREEN, cb: function () {
          if (i === from) return;
          if (s.gold < J.fare) { sfx('nope'); return self.toast('The fare is ' + J.fare + 'G. You have ' + fmt(s.gold) + 'G.', 2400); }
          s.gold -= J.fare;
          w.mnRide = { stage: 'wait', from: from, to: i };
          w.changed();
          self.closeModal();
          sfx('coin');
          self.toast('Para po! Wait by the shed: the jeep comes in ' + (wait <= 0 ? 'a moment' : 'about ' + secs + ' s') + '.', 3000);
          var j = w.mn.jeep && w.mn.jeep.at;
          if (j && j.on && j.stop === from) w.mnBoard(); // (it is here now)
        } }],
      };
    });
    this.listPanel({ title: 'Jeepney', rows: rows, page: 0, reopen: function () { self.mnJeepStops(from); },
      sub: function () { return 'Para po! Where to? ' + J.fare + 'G a ride.'; } });
  };

  // ---------- the action button ----------
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mnRide && this.mnRide.stage === 'on') {
      return { label: 'Riding', icon: -1, disabled: true, why: 'You get off at ' + J.stops[this.mnRide.to].name + '. Enjoy the ride!' };
    }
    return resolve.apply(this, arguments);
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (this.mn && o.type === 'mn_spot') {
      var p = o.props, self = this;
      if (p.shed != null && p.shed !== '') return { label: 'Para po', icon: C.ICON.crate, run: function () { F.ui.mnJeepStops(+p.shed); } };
      if (p.mall) return { label: 'Enter', icon: -1, run: function () { self.travel('mall', 'entrance'); } };
      if (p.food) return { label: 'Eat', icon: C.ICON.lunch, run: function () { F.ui.mnFoodCourt(); } };
      if (this.mapKey === 'mall' && p.text) return { label: 'Look', icon: -1, run: function () { F.ui.dialog(p.text); } };
    }
    return extraObjectAction.apply(this, arguments);
  };
  // the food court: eat there for energy (the item's own energy: L.energyOf)
  U.mnFoodCourt = function () {
    var self = this, s = F.session.state, w = F.world;
    var full = s.energy >= L.maxEnergy(s);
    var rows = M.mall.food.map(function (f) {
      var it = C.ITEMS[f[0]];
      return { icon: it.icon, name: it.name + '  ·  ' + fmt(f[1]) + 'G', desc: '+' + L.energyOf(f[0]) + ' energy, eaten here.',
        buttons: [{ label: 'Eat', color: GREEN, cb: function () {
          if (s.energy >= L.maxEnergy(s)) { sfx('nope'); return self.toast('You are full of energy already!', 2000); }
          if (s.gold < f[1]) { sfx('nope'); return self.toast('That is ' + fmt(f[1]) + 'G. You have ' + fmt(s.gold) + 'G.', 2200); }
          s.gold -= f[1];
          var gain = Math.min(L.energyOf(f[0]), L.maxEnergy(s) - s.energy);
          s.energy += gain;
          sfx('pick');
          if (w) { w.changed(); w.save(); }
          self.toast('Yum! +' + gain + ' energy.', 2000);
          self.swapTo(function () { self.mnFoodCourt(); });
        } }],
      };
    });
    this.listPanel({ title: 'Food Court', rows: rows, page: 0, reopen: function () { self.mnFoodCourt(); },
      sub: function () { return full ? 'You are full of energy. Come back when you are hungry!' : 'Energy ' + s.energy + ' / ' + L.maxEnergy(s) + '. You have ' + fmt(s.gold) + 'G.'; } });
  };
  // the Mall: dark round its walls (like the house), its own music and no weather
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    if (this.mapKey === 'mall') this.game.renderer.config.backgroundColor = Phaser.Display.Color.HexStringToColor('#2a1a10');
  };
  var musicMood = P.musicMood;
  P.musicMood = function () { return this.mapKey === 'mall' ? 'house' : musicMood.apply(this, arguments); };
  void artKey;
})(window.Farm = window.Farm || {});

// Manila city life, steps 2 and 4, in the world (owner, 11 Nov 2026: docs/manila-city-life.md; 18 Nov 2026: "Make the
// Manila fully build now"). Content: 00-zzzzzzzzzzzzzzzzzzzzzz-manila-life2.js; rules: 01-logicZZZZZZZZZZZZZZZ-manila-life2.js.
// - The new roles (C.MANILA.roles) are made by step 3's mnRoleAdd (their own sheets only); here, how they get about:
//   stops by a schedule, in turn or at random (walk), in a group that is always together (group: the first leads, the
//   others close behind and round them when they stop), a cart pushed beside its vendor (cart: the owner's picture),
//   a call now and then ("Tahooo!", the sorbetes bell, "Baluuut!"), a fishing line from the Bay Walk rail, a pick-up
//   game on the barangay court, the traffic enforcer's whistle as the jeep goes by, the drivers out when their rides rest.
// - Street food: a vendor who sells says Buy; eaten on the spot for energy (L.mnBuyFood). First time: a tour.
// - The calesa: round the old walls by the clock (L.calesaAt); ride it from its stand (20G, twice round). First time: a tour.
// - The elevated train comes in high from the west, waits along its platform (its crowd gets on), and goes out again.
// - The pickleball players, two sheets each shown twice: the second time in another shirt colour (owner, 11 Nov 2026).
// Cheap phones: the same people and the same city; as the crowd, only those near the screen are drawn and animated, and
// the extras here (carts, lines, the platform's crowd) are moved only near the screen.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var M = C.MANILA;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  if (!M || !M.on || !M.calesa || !P.mnRoleAdd) return;
  var GREEN = 0x5fa84a, GREY = 0xa08a68;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var IDLE = { down: 0, up: 3, left: 6, right: 6 };
  var K = M.calesa;
  var clock = function () { return M.jeepNow ? M.jeepNow() : Date.now(); }; // (the tests may set it, as the jeep's)
  var img = function (k) { return !!(F.images && F.images[k]); };
  var rnd = function (a) { return a ? a[0] + Math.random() * (a[1] - a[0]) : 0; };
  var near2 = function (a, b, d) { return Math.abs(a.x - b.x) < d && Math.abs(a.y - b.y) < d; };

  // ---------- the two first-time tours (owner, 4 Oct 2026); their tips appended last (a tip is its place in a saved number) ----------
  C.TIPS.push({ key: 'mn_food_tour', text: 'STREET FOOD' }, { key: 'mn_calesa_tour', text: 'THE CALESA' });
  var tourPic = function (ui, sc, x, y, key, frame, h, fallback) { // the owner's picture at height h, else an icon
    if (img(key)) {
      F.ensureTexture(ui, key);
      var im = ui.add.image(x, y, key, frame), fr = ui.textures.getFrame(key, frame);
      im.setDisplaySize(fr.realWidth * h / fr.realHeight, h);
      sc.add(im);
      return im;
    }
    var i = ui.add.image(x, y, 'items', fallback).setScale(0.36);
    sc.add(i);
    return i;
  };
  var FD = M.food;
  if (F.TOURS) {
    F.TOURS.mn_food = {
      title: 'STREET FOOD',
      steps: [
        { text: 'Manila\'s vendors sell snacks all over the city. Stand by one and tap Buy: you eat it there, for energy.',
          draw: function (ui, sc, move) {
            var a = tourPic(ui, sc, 80, 70, 'props/manila_cart_fishball', 0, 100, C.ITEMS.cookie.icon), b = tourPic(ui, sc, 190, 70, 'props/manila_cart_sorbetes', 0, 100, C.ITEMS.milk.icon);
            if (move) ui.tweens.add({ targets: [a, b], y: 62, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          } },
        { text: 'Fishballs ' + FD.fishball.price + 'G, taho ' + FD.taho.price + 'G, siomai ' + FD.dimsum.price + 'G. Listen for "Tahooo!" in the morning and "Baluuut!" at night.',
          draw: function (ui, sc, move) {
            var a = tourPic(ui, sc, 85, 66, 'npc_taho_vendor', 0, 110, C.ITEMS.milk.icon), b = tourPic(ui, sc, 185, 66, 'npc_balut_vendor', 0, 110, C.ITEMS.egg.icon);
            if (move) ui.tweens.add({ targets: [a, b], angle: { from: -4, to: 4 }, duration: 380, yoyo: true, repeat: -1 });
          } },
      ],
    };
    F.TOURS.mn_calesa = {
      title: 'THE CALESA',
      steps: [
        { text: 'A calesa ride round the old walls: ' + K.fare + 'G, ' + (K.laps === 2 ? 'twice' : K.laps + ' times') + ' round. It runs from 6 AM to 8 PM.',
          draw: function (ui, sc, move) {
            var a = tourPic(ui, sc, 136, 70, 'manila_calesa', 6, 100, C.ICON.horse);
            if (move) { a.x = 200; ui.tweens.add({ targets: a, x: 80, duration: 2400, repeat: -1 }); }
          } },
        { text: 'Pay at its stand, wait there, and climb in when it stops. You get off where you got on.',
          draw: function (ui, sc, move) {
            var a = tourPic(ui, sc, 100, 66, 'manila_calesa', 0, 110, C.ICON.horse), b = tourPic(ui, sc, 196, 70, 'items', C.ICON.coin, 0, C.ICON.coin);
            if (!img('manila_calesa')) a.setScale(0.36);
            b.setScale(0.36);
            if (move) ui.tweens.add({ targets: b, y: 60, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          } },
      ],
    };
  }
  var tourFirst = function (ui, tip, name, then) {
    var s = F.session && F.session.state;
    if (s && ui.tour && F.TOURS && F.TOURS[name] && !F.session.visit && L.takeTip(s, tip)) {
      if (F.world && F.world.save) F.world.save();
      return ui.tour(name, then);
    }
    return then();
  };

  // ---------- another shirt colour: a copy of a sheet with its shirt's hue moved (the torso band of every frame) ----------
  // shirt: { h: [from, to] (degrees), s: least saturation, to: the new hue }. Made once a visit; key 'mnrc-<sheet>-<to>'.
  var recolor = function (key, shirt) {
    var nk = 'mnrc-' + key + '-' + shirt.to;
    if (img(nk)) return nk;
    var src = F.images[key];
    if (!src) return null;
    try {
      var c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      var g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height), px = d.data, W = c.width, Hh = c.height, top = Math.floor(Hh * 0.45), bot = Math.floor(Hh * 0.82);
      for (var y = top; y < bot; y++) for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        if (px[i + 3] < 40) continue;
        var r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dd = mx - mn;
        if (!dd || mx < 0.15) continue;
        var sat = dd / mx, h = mx === r ? ((gg - b) / dd + 6) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
        h *= 60;
        if (sat < (shirt.s || 0.3) || h < shirt.h[0] || h > shirt.h[1]) continue;
        // the new hue, the same saturation and brightness
        var hh = shirt.to / 60, f = hh - Math.floor(hh), p = mx * (1 - sat), q = mx * (1 - sat * f), t2 = mx * (1 - sat * (1 - f)), o;
        switch (Math.floor(hh) % 6) { case 0: o = [mx, t2, p]; break; case 1: o = [q, mx, p]; break; case 2: o = [p, mx, t2]; break; case 3: o = [p, q, mx]; break; case 4: o = [t2, p, mx]; break; default: o = [mx, p, q]; }
        px[i] = o[0] * 255; px[i + 1] = o[1] * 255; px[i + 2] = o[2] * 255;
      }
      g.putImageData(d, 0, 0);
      F.images[nk] = c;
      if (F.sizes && F.sizes[key]) F.sizes[nk] = F.sizes[key];
      if (F.SHEETS) F.SHEETS[nk] = F.SHEETS[key] || F.SHEETS.people;
      return nk;
    } catch (e) { return null; } // (a picture the canvas may not read: the same shirt, then)
  };
  // (owner, 11 Nov 2026: pickleball, "2 sheets, each shown twice in another shirt colour"; decided by me: pink and green)
  if (M.roles.pickleball) M.roles.pickleball.shirts = [null, null, { h: [190, 245], s: 0.25, to: 330 }, { h: [8, 40], s: 0.62, to: 135 }];

  // ---------- making a role: posts, looks, its group, its cart ----------
  var roleAdd = P.mnRoleAdd;
  P.mnRoleAdd = function (key, role, i) {
    var mn = this.mn, def = role;
    if (role.posts) def = Object.assign({}, def, { post: role.posts[i % role.posts.length] });
    var shirt = role.shirts && role.shirts[i], tint = 0;
    if (shirt) {
      var own = (role.sheets || []).filter(img), base = own[i % (own.length || 1)], rk = base && recolor(base, shirt);
      if (rk) def = Object.assign({}, def, { sheets: [rk] });
    }
    if (role.crowdLooks) { // (a family: the city folk's own looks, tinted as the crowd; the third a child)
      // (the city's own people only: with the pack not on the phone yet, no family, as no role, owner 11 Nov 2026)
      var own2 = {};
      M.crowd.looks.forEach(function (l) { own2[l[0]] = 1; });
      var looks = (mn.looks || []).filter(function (l) { return own2[l[0]] && /^npc_/.test(l[0]) && img(l[0]); });
      if (!looks.length) return null;
      var k = (i * 7 + 3) % looks.length;
      def = Object.assign({}, def, { sheets: [looks[k][0]] });
      tint = M.crowd.tints[(i + 1) % M.crowd.tints.length];
    }
    var v = roleAdd.call(this, key, def, i);
    if (!v) return v;
    v.n = i;
    if (tint) { v.sp.setTint(tint); v.look.tint = tint; }
    if (role.title) v.title = role.names ? role.names[i] + ', ' + role.title.replace(/^A /, '').replace(/^AN /, '') : role.title;
    else if (M.lifeTitles && M.lifeTitles[key]) v.title = M.lifeTitles[key];
    if (role.group && role.child != null && i % role.group === role.child) v.sp.setScale(1.45);
    if (role.walk) {
      v.walk = role.walk;
      v.speed = (role.walk.speed || 1.4) * T;
      if (role.group && i % role.group) { // a follower: the one before it in the group leads
        var lead = mn.roles.filter(function (r) { return r.role === key && r.n === i - (i % role.group); })[0];
        if (lead) { v.follow = lead; v.k = i % role.group; v.act = 'follow'; (lead.followers = lead.followers || []).push(v); lead.trail = lead.trail || []; }
      }
      this.mnWalkStart(v);
    }
    if (role.cart && img('props/manila_' + role.cart)) {
      var ck = F.ensureTexture(this, 'props/manila_' + role.cart), fr = this.textures.getFrame(ck), w = 1.7 * T;
      v.cart = this.add.image(v.x, v.y, ck).setOrigin(0.5, 1).setDisplaySize(w, w * fr.realHeight / fr.realWidth).setVisible(false);
    }
    if (role.fishing) {
      v.line = this.add.line(0, 0, 0, 0, 0, 0, 0xf4f0e0, 0.9).setOrigin(0, 0).setLineWidth(3).setVisible(false);
      v.bob = this.add.circle(0, 0, 0.11 * T, 0xe8402a).setStrokeStyle(4, 0xffffff).setVisible(false);
    }
    if (role.call) v.callMs = 2000 + Math.random() * 6000;
    if (role.game) { v.hold = 1e9; v.gameMs = Math.random() * 1500; }
    if (role.when) { v.hold = 1e9; this.mnHide(v, true); }
    return v;
  };

  // ---------- getting about ----------
  var stopOf = function (v, name) { var W = v.walk; return name === '_home' ? W.home || W.stops[Object.keys(W.stops)[0]] : W.stops[name]; };
  var tileOf = function (v) { return [Math.floor(v.x / T), Math.floor(v.y / T)]; };
  // Where its day puts it now: { at: stop name, inside }
  P.mnWalkWant = function (v) {
    var W = v.walk, min = this.state.time, keys = Object.keys(W.stops);
    if (Array.isArray(W.plan)) { var w = L.mnPlanAt(W.plan, min); return w.indexOf('in:') === 0 ? { at: w.slice(3), inside: true } : { at: w, inside: false }; }
    if (!L.mnRoleOut(v.def, min)) return { at: W.home ? '_home' : keys[0], inside: true };
    if (W.plan === 'cycle') { if (v.ci == null) v.ci = v.n % keys.length; return { at: keys[v.ci], inside: false, cycle: true }; }
    if (!v.rk || v.rk === 'next') { var pick = keys.filter(function (k) { return k !== v.lastAt; }); v.rk = pick[Math.floor(Math.random() * pick.length)] || keys[0]; }
    return { at: v.rk, inside: false };
  };
  // At the start: where its day puts it, at once (in, or at its stop)
  P.mnWalkStart = function (v) {
    if (v.follow) { v.x = v.follow.x; v.y = v.follow.y; this.mnFolkPlace(v); if (v.follow.inside) this.mnHide(v, true); return; }
    var want = this.mnWalkWant(v), q = stopOf(v, want.at);
    if (q) { v.x = (q[0] + 0.5) * T; v.y = (q[1] + 0.6) * T; this.mnFolkPlace(v); this.mnFolkFace(v, q[2] || 'down'); v.lastAt = want.at; }
    if (want.inside) this.mnHide(v, true);
    else { v.inside = false; v.sp.setVisible(v.near); }
    v.hold = 1000 + Math.random() * 3000;
  };
  var roleNext = P.mnRoleNext;
  P.mnRoleNext = function (v, again) {
    if (v.follow) { v.hold = 1000; return; } // (a follower goes where its leader goes: mnGroups)
    if (v.def.game || v.def.when) { v.hold = 1e9; return; } // (mnLife2Tick)
    if (!v.walk) return roleNext.apply(this, arguments);
    var want = this.mnWalkWant(v), q = stopOf(v, want.at), here = tileOf(v);
    if (!q) { v.hold = 5000; return; }
    var there = here[0] === q[0] && here[1] === q[1];
    if (there) {
      v.lastAt = want.at;
      if (want.inside) { if (!v.inside) this.mnHide(v, true); (v.followers || []).forEach(function (f) { this.mnHide(f, true); }, this); v.hold = 15000; return; }
      if (v.inside) { v.inside = false; v.sp.setVisible(v.near); (v.followers || []).forEach(function (f) { f.inside = false; f.x = v.x; f.y = v.y; f.sp.setVisible(f.near); this.mnFolkPlace(f); }, this); }
      this.mnFolkFace(v, q[2] || 'down');
      if (want.cycle) v.ci = (v.ci + 1) % Object.keys(v.walk.stops).length;
      else if (!Array.isArray(v.walk.plan)) v.rk = 'next';
      v.hold = Array.isArray(v.walk.plan) ? 6000 + Math.random() * 6000 : 0; // (at a timed stop: look again in a while)
      if (!Array.isArray(v.walk.plan) && !again) return this.mnRoleNext(v, true); // (its own hold was had on arrival: on to the next)
      return;
    }
    if (v.inside) { // out again where it went in
      v.inside = false;
      v.sp.setVisible(v.near);
      (v.followers || []).forEach(function (f) { f.inside = false; f.x = v.x; f.y = v.y; f.sp.setVisible(f.near); this.mnFolkPlace(f); }, this);
    }
    this.mnFolkGo(v, q[0], q[1], q[2] || '');
    v.ownHold = false;
    if (!v.path.length) { // no way found (a cheap phone looks less far): out of sight, it is simply there; else it tries again
      if (!v.near) { v.x = (q[0] + 0.5) * T; v.y = (q[1] + 0.6) * T; this.mnFolkPlace(v); }
      v.hold = 1500;
    }
  };

  // ---------- each frame ----------
  var CART_GAP = 1.05;
  P.mnLife2Update = function (dt) {
    var mn = this.mn, self = this, now = this.state.time;
    if (!mn || !mn.roles) return;
    mn.l2ms = (mn.l2ms || 0) - dt;
    if (mn.l2ms <= 0) { mn.l2ms = 2000; this.mnLife2Tick(); }
    for (var i = 0; i < mn.roles.length; i++) {
      var v = mn.roles[i], d = v.def;
      // a walker's own time at a stop (the crowd's random pause replaced by its own)
      if (v.walk && !v.follow && v.arrivedAt !== v.goal && v.goal && !v.path.length && v.hold > 0) { v.arrivedAt = v.goal; if (v.walk.hold) v.hold = rnd(v.walk.hold); }
      if (v.walk && v.path.length) v.arrivedAt = null;
      if (v.followers) this.mnGroup(v, dt);
      if (d.game) this.mnBall(v, dt);
      if (v.cart) this.mnCart(v);
      if (v.line) this.mnFishing(v, now);
      if (v.callMs != null && v.near && !v.inside) {
        v.callMs -= dt;
        if (v.callMs <= 0) { v.callMs = 8000 + Math.random() * 6000; if (this.floatTextAt) this.floatTextAt(v.x, v.y - 2.1 * T, d.call); if (d.call === 'Ting-a-ling!') sfx('pick'); }
      }
      if (d.whistle && v.near && !v.inside) this.mnWhistle(v, dt);
    }
    this.mnCalesaUpdate(dt);
    this.mnLrtUpdate(dt);
    void self;
  };
  // every 2 s: the ones whose being out the crowd's turn does not see (the drivers, the players)
  P.mnLife2Tick = function () {
    var mn = this.mn, min = this.state.time, self = this;
    mn.roles.forEach(function (v) {
      var d = v.def, out;
      if (d.when === 'jeepRests') out = !!(mn.jeep && mn.jeep.at && !mn.jeep.at.on);
      else if (d.when === 'calesaRests') out = !!(mn.cal && mn.cal.at && !mn.cal.at.on) && min >= 20 * 60 && min < 22 * 60;
      else if (d.game) out = L.mnRoleOut(d, min);
      else return;
      if (!out && !v.inside) { self.mnPlaceAt(v, d.post); self.mnHide(v, true); }
      else if (out && v.inside) { self.mnPlaceAt(v, d.post); v.inside = false; v.sp.setVisible(v.near); self.mnFolkFace(v, d.post[2]); }
    });
  };
  // a group: the leader's trail; the others walk it close behind, and stand round the leader when it stops
  P.mnGroup = function (v, dt) {
    var fs = v.followers, g = this.mn.grid, self = this;
    if (v.inside) { fs.forEach(function (f) { if (!f.inside) self.mnHide(f, true); f.x = v.x; f.y = v.y; }); return; }
    var tr = v.trail, last = tr[tr.length - 1];
    if (!last || Math.hypot(v.x - last.x, v.y - last.y) > 0.12 * T) { tr.push({ x: v.x, y: v.y }); if (tr.length > 60) tr.shift(); }
    var moving = v.path.length > 0;
    fs.forEach(function (f) {
      if (f.inside) { f.inside = false; f.x = v.x; f.y = v.y; f.sp.setVisible(f.near); }
      var tx, ty;
      if (moving) { // its place on the trail, k steps back
        var want = f.k * 0.85 * T, acc = 0, px = v.x, py = v.y;
        tx = px; ty = py;
        for (var j = tr.length - 1; j >= 0; j--) {
          var seg = Math.hypot(tr[j].x - px, tr[j].y - py);
          if (acc + seg >= want) { var r = (want - acc) / (seg || 1); tx = px + (tr[j].x - px) * r; ty = py + (tr[j].y - py) * r; acc = want; break; }
          acc += seg; px = tr[j].x; py = tr[j].y; tx = px; ty = py;
        }
      } else { // round the leader: beside it, else in front
        if (!f.spot || f.spotOf !== v.goal) {
          var free = [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]].filter(function (o) { var x = Math.floor(v.x / T) + o[0], y = Math.floor(v.y / T) + o[1]; return g.ok(x, y); });
          var o = free[(f.k - 1) % (free.length || 1)] || [0, 0];
          f.spot = [v.x + o[0] * 0.95 * T, v.y + o[1] * 0.9 * T];
          f.spotOf = v.goal;
        }
        tx = f.spot[0]; ty = f.spot[1];
      }
      var dx = tx - f.x, dy = ty - f.y, dd = Math.hypot(dx, dy), step = Math.max(v.speed, 1.2 * T) * 1.15 * dt / 1000;
      if (dd > 0.04 * T) {
        if (dd <= step) { f.x = tx; f.y = ty; } else { f.x += dx / dd * step; f.y += dy / dd * step; }
        var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        if (f.near) {
          var ak = 'mnf-' + f.look.key + '-' + f.look.row + '-' + (dir === 'left' || dir === 'right' ? 'side' : dir);
          if (!f.sp.anims.currentAnim || f.sp.anims.currentAnim.key !== ak || !f.sp.anims.isPlaying) f.sp.play(ak);
          f.sp.setFlipX(dir === 'right');
        }
        f.dir = dir;
        self.mnFolkPlace(f);
      } else if (f.sp.anims.isPlaying || f.faced !== v.goal) { // there: the same way as the leader (at a rail), or towards it
        f.faced = v.goal;
        self.mnFolkFace(f, v.walk.sameFace ? v.dir : Math.abs(v.x - f.x) > Math.abs(v.y - f.y) ? (v.x > f.x ? 'right' : 'left') : v.y > f.y ? 'down' : 'up');
      }
    });
  };
  // a cart pushed ahead of its vendor (standing: in front of him, facing his customers)
  P.mnCart = function (v) {
    var c = v.cart, show = v.near && !v.inside;
    c.setVisible(show);
    if (!show) return;
    var moving = v.path.length > 0, dir = v.dir, x = v.x, y = v.y;
    if (!moving || dir === 'down') { y += 0.5 * T; }
    else if (dir === 'up') { y -= 0.75 * T; }
    else x += (dir === 'right' ? 1 : -1) * CART_GAP * T;
    c.setPosition(x, y).setFlipX(dir === 'left');
    F.depthTo(c, DEPTH.actor + y / 1e5 + 1e-6);
  };
  // a fishing line from the rod's tip out over the rail into the bay, the float bobbing
  P.mnFishing = function (v, min) {
    var on = v.near && !v.inside && !v.path.length && v.dir === v.def.post[2];
    v.line.setVisible(on);
    v.bob.setVisible(on);
    if (!on) return;
    var side = v.dir === 'right' ? 1 : -1, tipX = v.x - side * 0.55 * T, tipY = v.y - 1.75 * T;
    var bx = v.x + side * 1.6 * T, by = v.y - 0.15 * T + Math.sin(this.time.now / 380 + v.n) * 0.05 * T;
    v.line.setTo(tipX, tipY, bx, by);
    v.bob.setPosition(bx, by);
    F.depthTo(v.line, DEPTH.actor + v.y / 1e5 + 2e-6);
    F.depthTo(v.bob, DEPTH.actor + v.y / 1e5 + 2e-6);
    void min;
  };
  // the traffic enforcer: as the jeep comes by, he turns to it and whistles, and waves it on (left, right)
  P.mnWhistle = function (v, dt) {
    var j = this.mn.jeep && this.mn.jeep.at;
    v.wMs = (v.wMs || 0) - dt;
    if (!j || !j.on || j.stop >= 0) return;
    var dx = j.x * T - v.x, dy = j.y * T - v.y;
    if (Math.abs(dx) > 5 * T || Math.abs(dy) > 5 * T) { if (v.waving) { v.waving = false; this.mnFolkFace(v, v.def.post[2]); } return; }
    v.waving = true;
    if (v.wMs <= 0) {
      v.wMs = 450;
      v.wave = !v.wave;
      this.mnFolkFace(v, v.wave ? 'left' : 'right');
      if (!v.blewAt || this.time.now - v.blewAt > 7000) { v.blewAt = this.time.now; if (this.floatTextAt) this.floatTextAt(v.x, v.y - 2.1 * T, v.def.whistle); }
    }
  };
  // a pick-up game: each player dribbles to a spot on the court, stops, and goes again; now and then a shot ("Swish!")
  P.mnBall = function (v, dt) {
    if (v.inside) return;
    var c = v.def.court, gx = v.gx, gy = v.gy;
    v.gameMs -= dt;
    if (gx == null || v.gameMs <= 0 && !v.going) {
      // a spot on its team's half, or at the hoop at the far end now and then
      // (the owner's court: its blue floor from about 1.4 tiles in on each side, its hoops 1.9 tiles in, 3 down)
      var left = v.n < 2, shoot = Math.random() < 0.25;
      gx = shoot ? (left ? c[0] + c[2] - 2.1 : c[0] + 1.9) : c[0] + 1.4 + Math.random() * (c[2] - 3);
      gy = shoot ? c[1] + 3 : c[1] + 2.3 + Math.random() * 2.2;
      v.gx = gx * T; v.gy = gy * T; v.going = true; v.shoot = shoot;
      return;
    }
    if (!v.going) return;
    var dx = v.gx - v.x, dy = v.gy - v.y, d = Math.hypot(dx, dy), step = 1.9 * T * dt / 1000;
    var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (d <= step) {
      v.x = v.gx; v.y = v.gy; v.going = false; v.gameMs = 800 + Math.random() * 2200;
      this.mnFolkFace(v, v.shoot ? (v.n < 2 ? 'right' : 'left') : ['down', 'left', 'right'][Math.floor(Math.random() * 3)]);
      if (v.shoot && v.near && Math.random() < 0.6 && this.floatTextAt) this.floatTextAt(v.x, v.y - 2.1 * T, Math.random() < 0.7 ? 'Swish!' : 'Clank!');
    } else {
      v.x += dx / d * step; v.y += dy / d * step;
      if (v.near) {
        var ak = 'mnf-' + v.look.key + '-' + v.look.row + '-' + (dir === 'left' || dir === 'right' ? 'side' : dir);
        if (!v.sp.anims.currentAnim || v.sp.anims.currentAnim.key !== ak || !v.sp.anims.isPlaying) v.sp.play(ak);
        v.sp.setFlipX(dir === 'right');
      }
      v.dir = dir;
    }
    this.mnFolkPlace(v);
  };

  // ---------- the calesa ----------
  if (F.SHEETS) F.SHEETS.manila_calesa = { frameWidth: 512, frameHeight: 384, margin: 0, spacing: 0 };
  // CAL_RIDE[its way]: where you sit in it, from its middle (tiles along x towards its back, tiles along y), and whether you
  // are drawn behind it (coming towards you: behind the driver, under the canopy)
  var CAL_RIDE = F.CAL_RIDE = { side: [0.55, -0.35, false], up: [0, -0.55, false], down: [0, -0.75, true] };
  P.mnCalesaSetup = function () {
    var mn = this.mn;
    mn.cal = null;
    if (!img('manila_calesa')) return; // (the owner's calesa only: until the pack is in, there is no calesa, and its stand says so)
    var key = F.ensureTexture(this, 'manila_calesa'), fr = this.textures.getFrame(key, 0), k = Math.min(3.9 * T / fr.realWidth, 2.9 * T / fr.realHeight);
    var sp = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 0.8).setDisplaySize(fr.realWidth * k, fr.realHeight * k);
    mn.cal = { sp: sp, lag: 0, at: null, ms: 0, last: null, neighMs: 0, held: false };
    this.mnCalesaUpdate(0);
  };
  P.mnCalesaBlocked = function (st, ahead, passed) {
    var pts = [[ahead.x * T, ahead.y * T], [(st.x + ahead.x) / 2 * T, (st.y + ahead.y) / 2 * T]];
    (passed || []).forEach(function (a) { pts.push([a.x * T, a.y * T]); }); // (a long frame's stretch: mnPassed)
    var hit = function (x, y) { return pts.some(function (p) { return Math.abs(x - p[0]) < 1.1 * T && Math.abs(y - p[1]) < 1.0 * T; }); };
    if (!(this.mnCal && this.mnCal.stage === 'on')) { var f = this.feet(); if (hit(f.x, f.y)) return true; }
    var rs = this.remotes || {};
    if (Object.keys(rs).some(function (id) { var r = rs[id]; return r && hit(r.x, r.y); })) return true;
    return this.mn.folk.some(function (v) { return !v.inside && !v.riding && v.near && hit(v.x, v.y); }) || this.mn.people.some(function (v) { return hit(v.x, v.y); });
  };
  P.mnCalesaUpdate = function (dt) {
    var c = this.mn.cal;
    if (!c) return;
    var now = clock(), back = c.t, st = L.calesaAt(now - c.lag);
    if (st.on && !st.stop) {
      var ahead = L.calesaAt(now - c.lag + 700);
      c.held = false;
      if (this.mnCalesaBlocked(st, ahead, this.mnPassed(L.calesaAt, back, now - c.lag, function (a) { return a.on && !a.stop; }))) {
        c.held = true;
        c.lag = this.mnHeldLag(c.lag, now, back, dt); // (held where it was: the jeep's rule, 24 Nov 2026)
        st = L.calesaAt(now - c.lag);
        c.neighMs -= dt;
        if (c.neighMs <= 0) { c.neighMs = 3000; if (this.floatTextAt) this.floatTextAt(st.x * T, st.y * T - 2.2 * T, 'Neigh!'); }
      } else if (c.lag > 0) c.lag = Math.max(0, c.lag - dt * 0.5);
    }
    c.t = now - c.lag;
    c.at = st;
    var x = st.x * T, y = st.y * T, side = st.dir === 'left' || st.dir === 'right', row = st.dir === 'down' ? 0 : st.dir === 'up' ? 1 : 2;
    c.ms += dt;
    var moving = st.on && !st.stop && !c.held;
    c.sp.setPosition(x, y).setFlipX(st.dir === 'right').setFrame(row * 3 + (moving ? 1 + Math.floor(c.ms / 220) % 2 : 0));
    F.depthTo(c.sp, DEPTH.actor + y / 1e5);
    void side;
    this.mnCalRideUpdate(st);
  };
  // riding: on at the stand when it stops there; twice round; off at the stand
  P.mnCalRideUpdate = function (st) {
    var r = this.mnCal;
    if (!r) return;
    var w = K.stop.wait, f = this.feet();
    if (r.stage === 'wait') {
      if (Math.hypot(f.x - w[0] * T, f.y - w[1] * T) > 6 * T) { // walked off: the fare back
        this.mnCal = null;
        this.state.gold += K.fare;
        this.changed();
        if (F.ui) F.ui.toast('You left the calesa stand. Here are your ' + K.fare + 'G back.', 2400);
        return;
      }
      if (st.stop && st.on) this.mnCalBoard(st);
      return;
    }
    if (L.calesaRideDone(r.from, st)) return this.mnCalAlight();
    this.player.body.setVelocity(0, 0);
    var side = st.dir === 'left' || st.dir === 'right', at = CAL_RIDE[side ? 'side' : st.dir] || CAL_RIDE.up;
    var dx = side ? (st.dir === 'left' ? at[0] : -at[0]) : at[0];
    this.setFeet(st.x * T + dx * T, st.y * T + at[1] * T);
    if (this.dir !== st.dir) { this.dir = st.dir; this.idle(); }
    F.depthTo(this.player, DEPTH.actor + st.y * T / 1e5 + (at[2] ? -1e-6 : 1e-6));
  };
  P.mnCalBoard = function (st) {
    this.mnCal = { stage: 'on', from: st.loop };
    this.player.body.enable = false;
    if (F.ui) F.ui.toast('Sakay na! ' + (K.laps === 2 ? 'Twice' : K.laps + ' times') + ' round the old walls.', 2400);
    sfx('door');
  };
  P.mnCalAlight = function () {
    var w = K.stop.wait;
    this.mnCal = null;
    this.player.body.enable = true;
    this.setFeet(w[0] * T, w[1] * T);
    if (P.mnSettle) P.mnSettle(this); // (as off the jeep: 19z...-manila-life.js)
    this.dir = 'down';
    this.idle();
    if (F.ui) F.ui.toast('Salamat po! Back at the calesa stand.', 2000);
    sfx('door');
    this.save();
  };
  U.mnCalesa = function () {
    var self = this, w = F.world, s = F.session.state;
    if (!w || F.session.visit) return this.dialog('THE CALESA\nRide the calesa from your own game.');
    var c = w.mn && w.mn.cal;
    if (!c) return this.dialog('THE CALESA\nThe calesa comes with Manila\'s pictures. Get them in Downloads, then come back for a ride!');
    if (w.mnCal) return this.dialog('THE CALESA\nYou have paid already. Wait here: you climb in when it stops at its stand.');
    if (w.mnRide) return this.dialog('THE CALESA\nYou are waiting for the jeep.');
    var open = function () {
      var at = c.at || L.calesaAt(clock());
      if (!at.on) return self.dialog('THE CALESA\nThe horse is resting. Calesa rides from 6 AM to 8 PM.');
      var wait = L.calesaWait(clock() - c.lag), secs = Math.max(1, Math.round(wait / 1000));
      self.dialog('THE CALESA\n' + (K.laps === 2 ? 'Twice' : K.laps + ' times') + ' round the old walls, sitting high behind the horse.\n\nA ride is ' + K.fare + 'G. You have ' + fmt(s.gold) + 'G.', [
        { label: 'Not now', color: GREY },
        { label: 'Ride ' + K.fare + 'G', color: GREEN, cb: function () {
          if (s.gold < K.fare) { sfx('nope'); return self.toast('A ride is ' + K.fare + 'G. You have ' + fmt(s.gold) + 'G.', 2400); }
          s.gold -= K.fare;
          w.mnCal = { stage: 'wait' };
          w.changed();
          sfx('coin');
          F.bus.emit('hud');
          var now = c.at;
          if (now && now.stop && now.on) w.mnCalBoard(now);
          else self.toast('Wait by the stand: the calesa comes in ' + (wait <= 0 ? 'a moment' : 'about ' + secs + ' s') + '.', 3000);
        } },
      ]);
    };
    tourFirst(this, 'mn_calesa_tour', 'mn_calesa', open);
  };

  // ---------- the elevated train: in, along the platform, out; its crowd on the platform ----------
  P.mnLrtSetup = function () {
    var mn = this.mn, R = M.rail, tr = mn.train;
    mn.lrt = null;
    if (!tr || !tr.parts.length || !R || !M.lrt) return;
    // a head at the back too, turned round (the train goes back out the way it came: its driver walks to that end)
    var flip = !!R.flip, back = tr.put('city_train_head', R.train * T - 2 * T, 4 * T, 1e-6);
    if (back) { back.y -= 0.75 * T; back.setFlipX(!flip); tr.parts.push({ im: back, dx: back.x - R.train * T }); }
    var looks = (mn.looks || []).filter(function (l) { return img(l[0]); }), folk = [];
    for (var i = 0; i < M.lrt.crowd && looks.length; i++) {
      var l = looks[(i * 5 + 2) % looks.length];
      F.ensureTexture(this, l[0]);
      var sp = this.add.sprite(0, 0, l[0], l[1] * 9 + (i % 2 ? 6 : 0)).setOrigin(0.5, 0.83).setScale(1.7).setFlipX(i % 3 === 0);
      var t = M.crowd.tints[(i + 2) % M.crowd.tints.length];
      if (t) sp.setTint(t);
      sp.setPosition((R.platform + 0.6 + i * 0.7) * T, (R.y - 1.95 + (i % 2) * 0.15) * T); // (on the platform's floor, in front of its benches)
      F.depthTo(sp, tr.depth + 5e-6 + i * 1e-8);
      folk.push(sp);
    }
    mn.lrt = { folk: folk, here: folk.length, phase: '', comeMs: 0 };
    this.mnLrtUpdate(0);
  };
  P.mnLrtUpdate = function (dt) {
    var mn = this.mn, z = mn.lrt, tr = mn.train;
    if (!z || !tr) return;
    var a = L.lrtAt(clock()), R = M.rail, west = R.train - 4, shift = (a.x - west) * T, cam = this.cameras.main.worldView;
    var near = cam.y < (R.y + 4) * T && cam.x < (R.x1 + 4) * T; // (the train and its platform in view: else nothing moves)
    tr.parts.forEach(function (p) { p.im.x = R.train * T + p.dx + shift; p.im.setVisible(a.phase !== 'away' && p.im.x > -3 * T); });
    if (a.phase !== z.phase) {
      if (a.phase === 'stop') { z.here = 0; if (near) sfx('door'); } // (all aboard)
      z.phase = a.phase;
    }
    if (a.phase === 'away' || a.phase === 'in') { // they gather again, one at a time
      z.comeMs -= dt;
      if (z.comeMs <= 0 && z.here < z.folk.length) { z.here++; z.comeMs = 3500 + Math.random() * 3000; }
    }
    z.folk.forEach(function (sp, i) { sp.setVisible(near && i < z.here); });
  };

  // ---------- setting up, the frame, the button ----------
  var mnLife = P.mnLife;
  P.mnLife = function () {
    mnLife.apply(this, arguments);
    // (the city drawn again, or another map, while in the calesa: you are out of it, at its stand; waiting stays waiting)
    if (this.mnCal && this.mnCal.stage === 'on') { this.mnCal = null; if (this.player && this.player.body) this.player.body.enable = true; if (!this.mn.mall) { var w0 = K.stop.wait; this.setFeet(w0[0] * T, w0[1] * T); } }
    if (this.mn.mall) return;
    this.mnCalesaSetup();
    this.mnLrtSetup();
  };
  var update = P.update;
  P.update = function (time, delta) {
    var riding = this.mnCal && this.mnCal.stage === 'on';
    if (riding) { F.input.jx = F.input.jy = 0; if (this.keys) Object.keys(this.keys).forEach(function (k) { this.keys[k].isDown = false; }, this); }
    update.apply(this, arguments);
    if (!this.mn || this.busy || this.mn.mall) return;
    this.mnLife2Update(Math.min(delta, 100));
    if (riding && this.player.anims.isPlaying) this.idle();
  };
  // (the city's pictures coming in while you ride: drawn again after the ride, as the jeep's)
  var mnRedraw = P.mnRedraw;
  P.mnRedraw = function (a) {
    var self = this;
    if (this.mnCal && this.mnCal.stage === 'on' && this.sys && this.sys.isActive()) return this.time.delayedCall(1000, function () { self.mnRedraw(a); });
    return mnRedraw.apply(this, arguments);
  };
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mnCal && this.mnCal.stage === 'on') return { label: 'Riding', icon: -1, disabled: true, why: 'Twice round the old walls. You get off at the stand.' };
    if (this.mn && !this.mn.mall && !(this.mnRide && this.mnRide.stage === 'on')) {
      var self = this, pt = this.front(0.7), f = this.feet();
      var v = this.mnPersonAt(pt.x, pt.y) ? null : this.mnFolkAt(pt.x, pt.y);
      if (v && v.def && v.def.sells && M.food[v.def.sells]) return { label: 'Buy', icon: C.ITEMS[M.food[v.def.sells].icon].icon, run: function () { self.mnFolkFace(v, Math.abs(f.x - v.x) > Math.abs(f.y - v.y) ? (f.x > v.x ? 'right' : 'left') : f.y < v.y ? 'up' : 'down'); v.hold = Math.max(v.hold, 6000); F.ui.mnStreetFood(v); } };
      var w = K.stop.wait, c = this.mn.cal;
      if (Math.hypot(f.x - w[0] * T, f.y - w[1] * T) < 1.6 * T || (c && c.at && c.at.stop && Math.hypot(f.x - c.at.x * T, f.y - c.at.y * T) < 2.2 * T)) {
        if (!v) return { label: 'Calesa', icon: C.ICON.horse != null ? C.ICON.horse : -1, run: function () { F.ui.mnCalesa(); } };
      }
    }
    return resolve.apply(this, arguments);
  };
  // street food: what this vendor sells, eaten on the spot
  U.mnStreetFood = function (v) {
    var self = this, s = F.session.state, w = F.world, key = v.def.sells, fd = M.food[key];
    if (!s || !fd) return;
    if (F.session.visit) return this.dialog((v.title || 'A VENDOR') + '\n' + v.lines[0]);
    var line = v.lines[Math.floor(Math.random() * v.lines.length)];
    var open = function () {
      var full = s.energy >= L.maxEnergy(s);
      var rows = [{ icon: C.ITEMS[fd.icon].icon, name: fd.name + '  ·  ' + fmt(fd.price) + 'G', desc: '+' + fd.energy + ' energy: ' + fd.what + ', eaten here.',
        buttons: [{ label: 'Buy', color: GREEN, cb: function () {
          var r = L.mnBuyFood(s, key);
          if (!r.ok) { sfx('nope'); return self.toast(r.why === 'full' ? 'You are full of energy already!' : 'That is ' + fd.price + 'G. You have ' + fmt(s.gold) + 'G.', 2200); }
          sfx('pick');
          if (w) { w.changed(); w.save(); if (w.floatTextAt) w.floatTextAt(w.feet().x, w.feet().y - 2 * T, '+' + r.gain + ' energy'); }
          F.bus.emit('hud');
          self.toast('Masarap! +' + r.gain + ' energy.', 2000);
          self.swapTo(function () { open(); });
        } }] }];
      var more = self.mnFoodMore ? self.mnFoodMore(v, open) : null; // (a friend at the stall: Aling Nena, Manila Friends)
      if (more) rows = rows.concat(more.rows || []);
      self.listPanel({ title: fd.name, rows: rows, page: 0, reopen: open, corner: more ? more.corner : null,
        sub: function () { return full ? 'You are full of energy. Come back when you are hungry!' : '"' + line + '"  Energy ' + s.energy + ' / ' + L.maxEnergy(s) + '.'; } });
    };
    tourFirst(this, 'mn_food_tour', 'mn_food', open);
  };
})(window.Farm = window.Farm || {});

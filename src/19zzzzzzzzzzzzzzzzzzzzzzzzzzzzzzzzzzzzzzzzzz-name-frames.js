// Name frames in the game (owner, 13 Nov 2026; words and numbers 00-zzzzzzzzzzzzzzzzzzzzzzzzzz-name-frames.js, rules
// 01-logicZZZZZZZZZZZZZZZZZZZZZZ-name-frames.js, server supabase/farm_name_frames.sql):
// - the server says who wears what (farm_frames_v1): asked for the players drawn in a room (each new one once, gathered
//   for a moment and asked in batches of 60), kept 10 minutes; never from what a phone says about itself;
// - the frame: a plate behind the name, in its realm's colour (or gold, silver, bronze) with a thin bright rim, drawn
//   here until the owner's pictures come (the 'frames' pack, a 4 x 4 sheet: tools/art/name-frames-import.js);
//   "Lighthouse Champion" small and gold under the name, for the week;
// - where: over the others' heads in every online room (and over yours while others are near), their card (Wave / a tap,
//   More), your farmer card (and its "Frame" link), the Lighthouse Board's rows, the lighthouse wall, the Hall of Fame;
// - "My frame" (your farmer card, the Hall's firsts, the lighthouse wall): the frames you own, Auto, None: pick one
//   (farm_frame_pick_v1).
// Offline, or a server without frames yet: nobody wears one, and nothing else changes.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var NF = C.NAME_FRAMES;
  if (!NF || !O || !F.WorldScene || !F.UIScene) return;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W;
  var GREY = 0xa08a68, BLUE = 0x4a90c9, GREEN = 0x5fa84a;
  var Wd = NF.words;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var missing = function (e) { return /could not find the function|schema cache/i.test(String((e && e.message) || e || '')); };
  var online = function () { return !!(O.on && F.Net.available()); };
  var meId = function () { return O.me && O.me.id ? String(O.me.id).toLowerCase() : null; };
  var live = function (o) { return !!(o && o.active && o.scene && o.scene.sys && o.scene.sys.isActive()); };

  // ---------- asking the server ----------
  // off: the server has no frames yet (asked no more); queue: ids gathered for the next ask; waiting: [{ id, fn }] to run
  // when an id's answer comes
  var FR = O.frames = { cache: L.frameCache(), off: false, queue: [], timer: null, waiting: [] };
  FR.get = function (id) { return L.frameOf(FR.cache, id); };
  FR.want = function (ids) {
    if (!online() || FR.off) return;
    (ids || []).forEach(function (id) { if (id && UUID.test(String(id))) FR.queue.push(String(id)); });
    if (FR.queue.length && !FR.timer) FR.timer = setTimeout(FR.flush, NF.batch);
  };
  FR.flush = function () {
    FR.timer = null;
    var ids = FR.queue;
    FR.queue = [];
    if (!online() || FR.off) return;
    L.frameAsk(FR.cache, ids, Date.now()).forEach(function (batch) {
      F.Net.rpc('farm_frames_v1', { p_ids: batch }).then(function (r) {
        if (!Array.isArray(r)) return; // (a refusal: asked again after a while)
        L.frameGot(FR.cache, batch, r, Date.now());
        FR.heard(batch);
      }, function (e) { if (missing(e)) FR.off = true; });
    });
  };
  // answers came for these ids: what waited on them runs, the world's names are dressed again
  FR.heard = function (ids) {
    var keep = [];
    FR.waiting.forEach(function (w) {
      if (FR.get(w.id)) { try { w.fn(); } catch (e) { /* a page closed meanwhile */ } } else if (w.alive()) keep.push(w);
    });
    FR.waiting = keep;
    F.bus.emit('frames', ids);
  };
  FR.wait = function (id, fn, alive) { FR.waiting.push({ id: String(id).toLowerCase(), fn: fn, alive: alive }); };

  // ---------- the pictures ----------
  // One canvas, 4 x 4 cells (the sheet's order: C.NAME_FRAMES.keys); each frame is three pieces: its two ends, which keep
  // their shape, and the middle, which stretches with the name. The owner's sheet (the 'frames' pack) is drawn in it when
  // it is on the phone; until then, the stand-ins below.
  var TEX = 'name-frames', CELL = NF.cell, N = NF.cols;
  var rr = function (g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  var standIn = function (g, k, x0, y0) {
    var lk = NF.looks[k], c = CELL, top = y0 + c * NF.band[0], h = c * (NF.band[1] - NF.band[0]), r = h * 0.42, m = c * 0.03;
    rr(g, x0 + m, top - 5, c - 2 * m, h + 10, r + 5); // (a dark edge)
    g.fillStyle = lk.deep;
    g.fill();
    rr(g, x0 + m + 5, top, c - 2 * m - 10, h, r);
    var grad = g.createLinearGradient(0, top, 0, top + h);
    grad.addColorStop(0, lk.light);
    grad.addColorStop(0.45, lk.plate);
    grad.addColorStop(1, lk.deep);
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 3.5; // (a thin bright rim)
    g.strokeStyle = lk.rim;
    g.stroke();
    // at each end: a gem in the realm's light (the board's metals: a little star)
    [x0 + c * 0.13, x0 + c * 0.87].forEach(function (x) {
      var y = top + h / 2, s = h * 0.15;
      g.beginPath();
      if (lk.week) { for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? s * 0.45 : s * 1.25; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.closePath(); }
      else g.arc(x, y, s, 0, Math.PI * 2);
      g.fillStyle = lk.gem;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = lk.rim;
      g.stroke();
    });
  };
  var paint = function (tex) {
    var g = tex.getContext(), art = F.images && F.images[NF.sheet];
    g.clearRect(0, 0, N * CELL, N * CELL);
    if (art) g.drawImage(art, 0, 0, N * CELL, N * CELL);
    else NF.keys.forEach(function (k, i) { standIn(g, k, (i % N) * CELL, Math.floor(i / N) * CELL); });
    tex.refresh();
  };
  var ensureTex = function (scene) {
    var tm = scene.textures;
    if (tm.exists(TEX)) return;
    var tex = tm.createCanvas(TEX, N * CELL, N * CELL), cap = Math.round(CELL * NF.ends);
    NF.keys.forEach(function (k, i) {
      var x = (i % N) * CELL, y = Math.floor(i / N) * CELL;
      tex.add(k + 'L', 0, x, y, cap, CELL);
      tex.add(k + 'M', 0, x + cap, y, CELL - 2 * cap, CELL);
      tex.add(k + 'R', 0, x + CELL - cap, y, cap, CELL);
    });
    paint(tex);
    // the owner's pictures, when there are any: fetched the first time a frame shows
    if (F.needImage && F.packedFile && F.packedFile(NF.sheet) && !(F.images && F.images[NF.sheet])) F.needImage(NF.sheet);
  };
  if (F.bus) F.bus.on('packart', function (key) {
    var s = F.world || F.ui;
    if (key === NF.sheet && s && s.textures && s.textures.exists(TEX)) paint(s.textures.get(TEX));
  });
  if (F.PACK_INFO && F.ASSETS && F.ASSETS.packs && F.ASSETS.packs.frames && Object.keys(F.ASSETS.packs.frames).length) {
    F.PACK_INFO.frames = { name: 'Name frames', icon: 'ribbon', desc: 'The frames round the names of the Tower\'s first players and the weekly board\'s top 3.' };
  }

  // A frame round a name w x h big: a container (put it at the name's middle) of the frame's three pieces. Its plate is
  // the name's height; its ends hold the ornaments, outside the name.
  var fit = function (box, w, h) {
    var s = h / (CELL * (NF.band[1] - NF.band[0])), ch = CELL * s, cap = CELL * NF.ends * s, full = Math.max(w + 0.9 * h, 2 * cap + 2);
    var p = box.list;
    p[0].setPosition(-full / 2, 0).setDisplaySize(cap, ch);
    p[1].setPosition(-full / 2 + cap - 0.5, 0).setDisplaySize(full - 2 * cap + 1, ch);
    p[2].setPosition(full / 2 - cap, 0).setDisplaySize(cap, ch);
    box.nfW = full;
    box.nfH = ch;
    return box;
  };
  F.framePlate = function (scene, key, w, h) {
    ensureTex(scene);
    var box = scene.add.container(0, 0);
    box.add(['L', 'M', 'R'].map(function (p) { return scene.add.image(0, 0, TEX, key + p).setOrigin(0, 0.5); }));
    box.nfKey = key;
    return fit(box, w, h);
  };
  F.frameRefit = fit;

  // ---------- a name on a page, framed ----------
  // t: the name's text (on a page); who: { id } (what they wear: asked first when not known) or { frame } (that frame).
  // opts: title: false (no title under it); push: true (lines just under the name move down for the title). The name
  // turns light on its plate. Returns the parts added (none yet when the answer is still to come).
  F.frameName = function (scene, t, who, opts) {
    opts = opts || {};
    var out = [];
    var go = function () {
      if (!t || !t.active || !t.scene) return;
      if (t.alpha < 1) return scene.time.delayedCall(260, go); // (a page still popping in: once it is in place)
      var e = who.id ? FR.get(who.id) : { f: L.frameKnown(who.frame) ? who.frame : null, t: null };
      var title = e && opts.title !== false ? e.t : null;
      if (!e || (!e.f && !title)) return;
      var parent = t.parentContainer, cx = t.x + (0.5 - t.originX) * t.displayWidth, cy = t.y + (0.5 - t.originY) * t.displayHeight;
      var add = function (o, below) {
        if (parent) { if (below) parent.addAt(o, parent.getIndex(t)); else parent.add(o); }
        else o.setDepth(t.depth + (below ? -1e-4 : 1e-4));
        out.push(o);
      };
      if (e.f) {
        add(F.framePlate(scene, e.f, t.displayWidth, t.displayHeight).setPosition(cx, cy), true);
        var px = parseFloat(t.style.fontSize) || 14;
        t.setColor('#fff8e0').setStroke('#2a1a0c', Math.max(2.5, px / 5));
      }
      if (title) {
        var sz = Math.max(9, Math.round((parseFloat(t.style.fontSize) || 14) * 0.62));
        var tt = scene.add.text(cx, cy + t.displayHeight / 2 + 1, title, { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: sz + 'px', fontStyle: 'bold', color: '#ffd34a', stroke: '#3d2614', strokeThickness: 3, resolution: F.R || 1 }).setOrigin(0.5, 0);
        add(tt, false);
        if (opts.push && parent) {
          var low = tt.y + tt.displayHeight + 1;
          parent.list.forEach(function (o) { if (o.type === 'Text' && o !== t && o !== tt && o.y >= tt.y - 2 && o.y < low && Math.abs(o.x - cx) < 80) o.y = low; });
        }
      }
      if (out.length && out[0].alpha === 1 && parent && parent.list.length) out.forEach(function (o) { o.setAlpha(0); scene.tweens.add({ targets: o, alpha: 1, duration: 140 }); });
    };
    if (who.id && !UUID.test(String(who.id))) return out;
    if (who.id && !FR.get(who.id)) {
      FR.wait(who.id, go, function () { return !!(t && t.active); });
      FR.want([who.id]);
    } else go();
    return out;
  };
  // A row of a list on a page (the lighthouse wall, the Hall of Fame): a small plate under its round icon, in the frame
  // its player wears (mark { id }) or a frame (mark { frame }). (12-ui.js dialog calls this for a row's third part.)
  F.frameRow = function (scene, c, x, y, mark) {
    var go = function () {
      if (!c.active || !c.scene) return;
      var e = mark.id ? FR.get(mark.id) : { f: L.frameKnown(mark.frame) ? mark.frame : null };
      if (!e || !e.f) return;
      c.add(F.framePlate(scene, e.f, 22, 11).setPosition(x, y + 14));
    };
    if (!mark || typeof mark !== 'object') return;
    if (mark.id && !UUID.test(String(mark.id))) return;
    if (mark.id && !FR.get(mark.id)) {
      FR.wait(mark.id, go, function () { return !!c.active; });
      FR.want([mark.id]);
    } else go();
  };

  // ---------- over the heads ----------
  var TITLE_STYLE = { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '50px', fontStyle: 'bold', color: '#ffd34a', stroke: '#3d2614', strokeThickness: 11 };
  var TAG_STYLE = { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '84px', fontStyle: 'bold', color: '#fff27a', stroke: '#3d2614', strokeThickness: 15 };
  var undress = function (n) { if (!n) return; if (n.plate) n.plate.destroy(); if (n.title) n.title.destroy(); };
  // A name over a head: its plate behind it, its title under it (the name goes up a line for it). n: what it wears
  var dressTag = function (w, tag, e, n) {
    var f = e ? e.f : null, ti = e ? e.t : null, want = (f || '') + '|' + (ti || '');
    if (n && n.want === want && n.text === tag.text) return n;
    undress(n);
    n = { want: want, text: tag.text, plate: null, title: null };
    if (f) n.plate = F.framePlate(w, f, tag.displayWidth, tag.displayHeight).setDepth(tag.depth - 0.01);
    if (ti) n.title = w.add.text(0, 0, ti, TITLE_STYLE).setOrigin(0.5, 0).setDepth(tag.depth);
    return n;
  };
  // placed each frame, after the name is (the name's y is set again each frame: the title's room is taken once)
  var place = function (tag, n) {
    if (!n || (!n.plate && !n.title)) return 0;
    if (n.title && tag.y !== n.y) { tag.y -= n.title.displayHeight * 0.92; n.y = tag.y; }
    var cy = tag.y - tag.displayHeight / 2, vis = tag.visible;
    if (n.plate) n.plate.setPosition(tag.x, cy).setAlpha(tag.alpha).setVisible(vis);
    if (n.title) n.title.setPosition(tag.x, tag.y - 6).setAlpha(tag.alpha).setVisible(vis);
    return n.plate ? n.plate.nfW : 0;
  };
  var dressRemotes = function (w) {
    if (!w || !w.remotes || !w.sys || !w.sys.isActive()) return;
    Object.keys(w.remotes).forEach(function (id) {
      var r = w.remotes[id];
      if (r.tag && r.tag.active) r.nf = dressTag(w, r.tag, FR.get(id), r.nf);
    });
  };
  var syncSprites = O.syncSprites;
  O.syncSprites = function () {
    var w = F.world, before = w && w.remotes ? Object.assign({}, w.remotes) : {};
    syncSprites.apply(O, arguments);
    if (!w || !w.remotes || !w.sys || !w.sys.isActive()) return;
    Object.keys(before).forEach(function (id) { var r = before[id]; if (r.nf && w.remotes[id] !== r) { undress(r.nf); r.nf = null; } });
    var ids = Object.keys(w.remotes);
    if (ids.length) FR.want(ids.concat(meId() ? [meId()] : [])); // (and ours: shown over our head while they are near)
    dressRemotes(w);
  };
  if (F.bus) F.bus.on('frames', function () { if (F.world) dressRemotes(F.world); });

  // ours: over our head while someone is near (9 tiles), when we wear a frame or have the title
  var dressMe = function (w) {
    var id = meId(), e = id ? FR.get(id) : null, me = w.nfMe, near = false, f = null;
    if (e && (e.f || e.t) && w.player && w.player.active && !w.busy) {
      f = w.feet();
      near = Object.keys(w.remotes).some(function (k) { var r = w.remotes[k]; return Math.abs(r.x - f.x) < 9 * T && Math.abs(r.y - f.y) < 9 * T; });
    }
    if (!near) {
      if (me) { me.tag.setVisible(false); if (me.n.plate) me.n.plate.setVisible(false); if (me.n.title) me.n.title.setVisible(false); }
      return;
    }
    var name = O.myName();
    if (!me) me = w.nfMe = { tag: w.add.text(0, 0, name, TAG_STYLE).setOrigin(0.5, 1).setDepth(DEPTH.Above + 2), n: null };
    if (me.tag.text !== name) me.tag.setText(name);
    me.n = dressTag(w, me.tag, e, me.n);
    me.tag.setVisible(true).setAlpha(1).setPosition(f.x, f.y - (F.session.riding ? 2.3 : 1.45) * T);
    place(me.tag, me.n);
  };
  var update = O.update;
  O.update = function (w) {
    var out = update.apply(O, arguments);
    if (!w || !w.remotes) return out;
    Object.keys(w.remotes).forEach(function (id) {
      var r = w.remotes[id], full = place(r.tag, r.nf);
      // (the Town Rank badge stays left of the frame: 19zzzz-rank.js puts it by the name first)
      if (full && r.rk) r.rk.setPosition(r.tag.x - full / 2 - 46, r.tag.y - r.tag.displayHeight / 2 + 4);
    });
    dressMe(w);
    return out;
  };
  var create = P.create;
  P.create = function () {
    this.nfMe = null; // (a new map: our name is made again when someone is near)
    return create.apply(this, arguments);
  };

  // ---------- the cards ----------
  // Someone's card (Wave, or a tap on them, in the park or a place open to everyone): their name, framed, at the top.
  var parkPlayer = U.parkPlayer;
  if (parkPlayer) U.parkPlayer = function (id) {
    var e = FR.get(id), p = O.who(id), self = this;
    if (!e) FR.want([id]);
    if (!e || (!e.f && !e.t) || !p || this.modals.length) return parkPlayer.apply(this, arguments);
    this.dialog = function (text, buttons, opts) {
      delete self.dialog;
      var lines = text.split('\n'), head = lines.shift();
      var c = self.dialog(head + '\n' + (e.t ? '\n\n\n' : '\n\n') + lines.join('\n'), buttons, opts);
      var body = c.list.filter(function (o) { return o.type === 'Text' && o.text.indexOf(p.name + ' is ') >= 0; })[0];
      if (!body) return c;
      var nt = self.txt(W / 2, body.y + 11, p.name, 17, '#fff8e0', { fontStyle: 'bold' }).setOrigin(0.5);
      if (nt.width > 220) nt.setScale(220 / nt.width);
      c.add(nt);
      var parts = [nt].concat(F.frameName(self, nt, { id: id }));
      // (popping in with the rest of the card)
      parts.forEach(function (o) { o.setAlpha(0); });
      self.tweens.add({ targets: parts, alpha: 1, duration: 140 });
      self.tweens.add({ targets: parts, y: '-=14', duration: 220, ease: 'Back.out' });
      return c;
    };
    try { return parkPlayer.apply(this, arguments); } finally { delete this.dialog; }
  };
  // A player's menu (More: from the lists, a chat, a visit): their name at the top, framed, the title under it.
  var playerMenu = U.playerMenu;
  U.playerMenu = function (id, who) {
    var out = playerMenu.apply(this, arguments), m = this.modals[this.modals.length - 1];
    if (!m || !id || !UUID.test(String(id))) return out;
    var t = m.c.list.filter(function (o) { return o.type === 'Text' && o.text === who; })[0];
    if (t) F.frameName(this, t, { id: id }, { push: true });
    return out;
  };
  // Your farmer card (the pause menu): your name framed, and "Frame" on the card's row of links.
  var openPause = U.openPause;
  U.openPause = function () {
    openPause.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1], s = F.session.state, me = meId();
    if (!m || F.session.visit || !m.c.pauseLinks || !online() || !me) return;
    var nm = m.c.list.filter(function (o) { return o.type === 'Text' && o.text === L.farmerName(s); })[0];
    if (nm) F.frameName(this, nm, { id: me }, { title: false });
    this.pauseLink(m.c, 'frame-link', C.ICON.ribbon, 'Frame', function () { self.openMyFrame(function () { self.openPause(); }); });
  };

  // ---------- My frame ----------
  var whyOf = function (k) {
    var lk = NF.looks[k];
    return lk.week ? 'Last week\'s #' + lk.place + ' on the board, until Monday.' : 'First to beat ' + lk.short + ', floor ' + lk.floor + '.';
  };
  U.openMyFrame = function (back) {
    var self = this, me = meId();
    var say = function (words) { return self.dialog(Wd.page + '\n' + words, [{ label: 'OK', cb: back }]); };
    if (!online() || !me) return say(Wd.offline);
    if (FR.off) return say(Wd.soon);
    var ticket = this.swapping;
    F.Net.rpc('farm_frames_mine_v1', {}).then(function (r) {
      if (self.swapGone && self.swapGone(ticket)) return;
      var m = L.frameMine(r);
      if (!m) return say(Wd.fail);
      L.frameSet(FR.cache, me, m.wear, Date.now());
      FR.heard([me]);
      self.myFramePage(m, back);
    }, function (e) {
      if (self.swapGone && self.swapGone(ticket)) return;
      if (missing(e)) FR.off = true;
      say(FR.off ? Wd.soon : Wd.fail);
    });
  };
  U.myFramePage = function (m, back) {
    var self = this, me = meId();
    var pick = function (k) {
      return function () {
        F.Net.rpc('farm_frame_pick_v1', { p_frame: k }).then(function (r) {
          if (!r || r.ok !== true) return self.toast('That frame is not yours.', 2400);
          var w = r.wear && typeof r.wear === 'object' ? r.wear : {};
          L.frameSet(FR.cache, me, { f: w.frame, t: w.title }, Date.now());
          FR.heard([me]);
          self.openMyFrame(back);
          self.toast(k === 'auto' ? Wd.pickedAuto : k === 'none' ? Wd.pickedNone : Wd.picked.replace('{name}', NF.looks[k].name), 2400, 0x2f5a22);
        }, function () { self.toast(Wd.fail, 2400); });
      };
    };
    // (the one picked: "Wearing", a button that stays as it is)
    var row = function (k, icon, name, desc) {
      return { icon: icon, name: name, desc: desc, buttons: [m.pick === k ? { label: Wd.wearing, color: GREEN, cb: function () {} } : { label: Wd.wear, color: BLUE, cb: pick(k) }] };
    };
    var wearing = m.wear.f ? NF.looks[m.wear.f].name : 'no frame';
    var rows = [row('auto', C.ICON.sparkle, Wd.auto, Wd.autoDesc)]
      .concat(m.owned.map(function (k) { return row(k, NF.looks[k].week ? C.ICON.ribbon : C.ICON.star, NF.looks[k].name, whyOf(k)); }))
      .concat([row('none', C.ICON.exclaim, Wd.none, Wd.noneDesc)]);
    if (!m.owned.length) rows.push({ icon: C.ICON.book, name: 'How to win one', desc: Wd.none_yet, buttons: [] });
    this.listPanel({
      title: Wd.page, page: 0, rows: rows,
      sub: function () { return (m.title ? 'You are the ' + m.title + ' this week! ' : '') + 'Wearing: ' + wearing + '.'; },
      reopen: function (tab, p) { self.closeModal(); self.listPanel(Object.assign({}, this, { page: p })); },
      corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); back(); } } : null,
    });
    // each frame's row: its name in its frame
    var top = this.modals[this.modals.length - 1];
    if (!top) return;
    var found = [], walk = function (list) {
      list.forEach(function (o) {
        if (o.type === 'Text') m.owned.forEach(function (k) { if (o.text === NF.looks[k].name) found.push([o, k]); });
        if (o.list) walk(o.list);
      });
    };
    walk(top.c.list);
    found.forEach(function (f) { F.frameName(self, f[0], { frame: f[1] }, { title: false }); }); // (after the walk: each adds to the lists walked)
  };

  // the Hall of Fame's firsts plaques and the lighthouse wall: a way to My frame
  F.myFrameButton = function (back) { return online() ? [{ label: 'My frame', color: GREY, cb: function () { F.ui.openMyFrame(back); } }] : []; };
})(window.Farm = window.Farm || {});

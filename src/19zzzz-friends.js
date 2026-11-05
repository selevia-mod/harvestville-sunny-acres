// Villager friendship stories on screen (owner, 6 Nov 2026; the stories: 00-zzzzzzzzzzz-friends.js, the rules:
// 01-logicZZZZ-friends.js). A step plays when you talk to the villager (in town, through a shop's Talk button, at the
// mayor's or by knocking at a home): a few lines, a choice, then a reward card. The Friendship Book (Pause > Friends, and
// the Story button on every villager's talk panel) shows everyone's hearts, the steps you have seen, what is next and
// what you got; its Photo wall shows the framed photos (drawn stand-in frames until they get their own pictures). The
// Book has a first-time tour (owner rule: every new feature gets one). Pop-ups are centred, like every dialog.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var VS = C.VS;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var D = F.UI_DRAW;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var world = function () { return F.world; };
  var visiting = function () { return !!(F.session && F.session.visit); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var has = function (key) { return !!VS.stories[key] && !visiting() && !!F.session && !!F.session.state && !!L.friend(F.session.state, key).met; };

  // Marks a tour shown and saves; false when it was shown already, on a visit, or in the tests' quiet mode.
  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || visiting() || L.tipSeen(s, key) || quiet()) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };

  // The villager on the map, if they are drawn (a talk from a shop's panel has none).
  var sprite = function (key) {
    var w = world();
    return w && w.villagers ? w.villagers.list.filter(function (v) { return v.key === key && v.visible; })[0] : null;
  };
  var cheer = function (key, n) {
    var v = sprite(key), w = world();
    if (!v || !w) return;
    w.villagers.hearts(v, n);
    w.emote(v, C.ICON.heart);
  };
  var saved = function () {
    var w = world();
    if (!w) return;
    w.changed();
    w.save();
  };

  // ---------- playing a step ----------
  // go: L.vsReady's answer. done: after the last card.
  U.vsPlay = function (key, go, done) {
    var self = this, s = F.session.state, st = go.step, v = C.VILLAGERS[key];
    var after = function () { saved(); if (done) done(); };
    if (go.phase === 'thanks') {
      var r = L.vsHandOver(s, key);
      if (r.error) return this.vsTrouble(key, r);
      sfx('gift');
      cheer(key, 4);
      saved();
      return this.playLines(st.thanks || [], function () { self.vsCard(key, r, after); });
    }
    // the scene counts as the day's chat (friendship once a day, the quests that count talking)
    L.talk(s, key);
    if (world() && L.hello(s, key)) world().progress('meet');
    sfx('talk');
    this.playLines(st.lines, function () {
      self.choose(key, st.choice.q, st.choice.a.map(function (a, k) {
        return {
          label: a[0], cb: function () {
            var res = L.vsStart(s, key, go.i, k);
            if (res.error) return self.vsTrouble(key, res);
            sfx('gift');
            cheer(key, res.asked ? 2 : 4);
            saved();
            if (!res.asked) return self.dialog(a[1], [{ label: 'OK', cb: function () { self.vsCard(key, res, after); } }], { portrait: key, name: v.name });
            // a favour: what to bring; when it is in the bag already, it is handed over at once
            var b = st.bring, n = L.vsHave(s, b[0]), ready = n >= b[1];
            var ask = a[1] + '\n\n(A favour: bring ' + v.name + ' ' + b[1] + ' ' + (C.ITEMS[b[0]] ? C.ITEMS[b[0]].name : b[0] === 'lumber' ? 'Lumber' : 'Stone') + '. You have ' + n + '.' + (ready ? ' Here they are!' : '') + ')';
            self.dialog(ask, [{ label: 'OK', cb: function () {
              if (ready) return self.vsPlay(key, { i: go.i, step: st, phase: 'thanks' }, done);
              after();
            } }], { portrait: key, name: v.name });
          },
        };
      }));
    });
  };

  // The reward card: what the step gave, and where the story goes next.
  U.vsCard = function (key, r, then) {
    var self = this, s = F.session.state, v = C.VILLAGERS[key], n = L.vsDone(s, key), total = VS.stories[key].length;
    var rows = r.got.filter(function (g) { return g.text; }).map(function (g) { return [g.icon, g.text]; });
    rows.push([C.ICON.book, 'Friendship Book: ' + v.name + "'s story, " + n + ' of ' + total + '. ' +
      (n < total ? 'Next: ' + L.vsHint(s, key) : 'You have heard the whole story!')]);
    sfx('fanfare');
    this.dialog(r.step.t.toUpperCase().replace(/[^A-Z0-9 !?.,:'-]/g, '') + '\n', [{
      label: 'OK', cb: function () {
        if (take('friends_tour')) return self.tour('friends', then);
        if (then) then();
      },
    }], { rows: rows });
  };

  U.vsTrouble = function (key, r) {
    var v = C.VILLAGERS[key];
    var why = r.error === 'full' ? '(Your bag is full. Make room for ' + (C.ITEMS[r.item] ? C.ITEMS[r.item].name : 'it') + ', then talk to ' + v.name + ' again.)'
      : r.error === 'energy' ? '(You are too tired to help right now.)'
        : r.error === 'missing' ? '(You do not have everything yet.)' : '(Maybe another time.)';
    sfx('nope');
    this.say(key, v.name, why);
  };

  // ---------- where a talk can start a step ----------
  // On the map: after the old heart events and a request you can finish, which come first.
  var talkTo = P.talkTo;
  P.talkTo = function (v) {
    var s = this.state, key = v && v.key;
    if (!key || v.shopper || v.tourist || !has(key) || s.isVisit) return talkTo.apply(this, arguments);
    if (!L.friend(s, key).talked && L.heartEvent(s, key)) return talkTo.apply(this, arguments);
    var ri = L.requestFor(s, key);
    if (ri >= 0 && L.canFinishRequest(s, ri)) return talkTo.apply(this, arguments);
    var go = L.vsReady(s, key);
    if (!go) return talkTo.apply(this, arguments);
    this.villagers.greet(v, this.dir);
    this.emote(v, C.ICON.heart);
    F.ui.vsPlay(key, go);
  };

  // A shop's Talk button (every list panel with a keeper): their story first, when a step is ready there.
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    if (o && o.talk && !o.corner && has(o.talk)) {
      var self = this, key = o.talk;
      o.corner = {
        label: 'Talk', color: L.vsReady(F.session.state, key) ? GREEN : BLUE, cb: function () {
          var s = F.session.state, go = L.vsReady(s, key);
          if (go) return self.vsPlay(key, go, function () { if (o.refresh) o.refresh(); });
          var r = L.talk(s, key);
          if (world() && L.hello(s, key)) world().progress('meet');
          sfx('talk');
          if (world()) world().changed();
          self.say(key, C.VILLAGERS[key].name, r.line);
        },
      };
    }
    return listPanel.apply(this, arguments);
  };

  // The mayor's house, and knocking at a home with someone in.
  var mayorTalk = U.mayorTalk;
  U.mayorTalk = function () {
    var go = has('hollis') && L.vsReady(F.session.state, 'hollis');
    if (go) return this.vsPlay('hollis', go);
    return mayorTalk.apply(this, arguments);
  };
  var openBuilding = U.openBuilding;
  U.openBuilding = function (key) {
    var s = F.session.state, b = C.BUILDINGS[key];
    if (b && !b.open && !visiting()) {
      var inside = C.VILLAGER_ORDER.filter(function (k) { return L.villagerAt(s, k, s.time) === 'in:' + key; })[0];
      var go = inside && has(inside) && L.vsReady(s, inside);
      if (go) {
        sfx('door');
        return this.vsPlay(inside, go);
      }
    }
    return openBuilding.apply(this, arguments);
  };

  // ---------- the talk panel: a Story button by the name ----------
  var say = U.say;
  U.say = function (key, nm, text) {
    var c = say.apply(this, arguments);
    if (c && has(key)) this.vsSayButton(c, key);
    return c;
  };
  U.vsSayButton = function (c, key) {
    var self = this, face = null, name = null;
    c.list.forEach(function (o) { if (o.type === 'Image' && o.texture && o.texture.key === 'people') face = o; });
    if (!face) return;
    var y0 = face.y - 98;
    c.list.forEach(function (o) { if (o.type === 'Text' && o.x === 126 && Math.abs(o.y - (y0 + 22)) < 2) name = o; });
    var room = W - 126 - 106;
    if (name && name.displayWidth > room) name.setScale(room / name.width);
    this.pillButton(c, W - 70, y0 + 32, 64, 26, 'Story', function () {
      self.closeModal();
      self.vsPage(key);
    }, 0x9a6a3a);
  };

  // ---------- the Friendship Book ----------
  var openFriends = U.openFriends;
  U.openFriends = function (page) {
    if (visiting()) return openFriends.apply(this, arguments);
    return this.vsBook(page);
  };
  var readyNow = function (s, k) {
    var n = L.vsNext(s, k);
    return !!n && (n.state === 'open' || !!L.vsReady(s, k));
  };
  U.vsBook = function (page) {
    var self = this, s = F.session.state;
    if (take('friends_tour')) return this.tour('friends', function () { self.vsBook(page); });
    var rows = C.VILLAGER_ORDER.map(function (k) {
      var f = L.friend(s, k), v = C.VILLAGERS[k];
      if (!f.met) return { icon: C.ICON.exclaim, name: '???', desc: 'Not met yet. Say hello in town!' };
      var list = VS.stories[k] || [], done = L.vsDone(s, k), ready = readyNow(s, k);
      return {
        people: k, name: v.name + (s.spouse === k ? '  (spouse)' : s.engaged && s.engaged.who === k ? '  (engaged)' : ''),
        hearts: f.pts, tag: done >= list.length && list.length ? 'DONE' : ready ? 'NEW' : null,
        desc: 'Story ' + done + ' of ' + list.length + '. ' + L.vsHint(s, k),
        buttons: [{ label: 'Story', color: ready ? GREEN : BLUE, cb: function () { self.closeModal(); self.vsPage(k, function () { self.vsBook(page); }); } }],
      };
    });
    this.listPanel({
      title: 'Friendship Book', rows: rows, page: page || 0,
      reopen: function (t, p) { self.closeModal(); self.vsBook(p); },
      corner: { label: 'Photos', color: BLUE, cb: function () { self.closeModal(); self.vsPhotoWall(0, function () { self.vsBook(page); }); } },
      sub: function () {
        return C.VILLAGER_ORDER.filter(function (k) { return L.friend(s, k).met; }).length + ' of ' + C.VILLAGER_ORDER.length + ' met.  ' +
          L.vsCount(s) + ' of ' + L.vsTotal() + ' story steps.';
      },
    });
  };

  // One villager's page: a card for each step (done, next, locked).
  U.vsPage = function (key, back) {
    var self = this, s = F.session.state, v = C.VILLAGERS[key], f = L.friend(s, key), list = VS.stories[key];
    var done = L.vsDone(s, key), n = L.vsNext(s, key);
    var again = function () { self.vsPage(key, back); };
    var rows = list.map(function (st, i) {
      var h = VS.hearts[i];
      if (i < done) {
        var got = L.vsRewards(key, i, L.vsChoice(s, key, i));
        return {
          icon: got.length ? L.vsRewardIcon(key, got[0]) : C.ICON.star, tag: 'DONE', name: st.t, done: true,
          desc: 'Got: ' + got.map(function (rw) { return L.vsRewardText(key, rw); }).filter(Boolean).join('; ') + '.',
          buttons: [{ label: 'Read', color: BLUE, cb: function () { self.closeModal(); self.vsRead(key, i, again); } }],
        };
      }
      if (n && i === n.i) {
        var seen = n.state === 'asked';
        return { icon: n.state === 'locked' ? C.ICON.heart : C.ICON.exclaim, tag: n.state === 'locked' ? h + ' HEARTS' : 'NEXT', name: seen ? st.t : '???', desc: L.vsHint(s, key) };
      }
      return { icon: C.ICON.heart, tag: h + ' HEARTS', name: '???', desc: 'At ' + h + ' hearts: ' + st.hint };
    });
    this.listPanel({
      title: v.name, rows: rows, rowH: 86,
      corner: back ? { label: 'Back', cb: function () { self.closeModal(); back(); } } : null,
      sub: function () {
        var hearts = Math.floor(f.pts / 10);
        return hearts + ' of 10 hearts.  Story ' + done + ' of ' + list.length + '.' + (f.talked ? '  ✓ talked' : '') + (f.gifted ? '  ✓ gift' : '');
      },
    });
  };

  // Reads a step you have seen again: the scene, what you said, their answer (and the thanks), then its secret.
  U.vsRead = function (key, i, then) {
    var self = this, s = F.session.state, st = VS.stories[key][i], a = st.choice.a[L.vsChoice(s, key, i)] || st.choice.a[0];
    var lines = st.lines.concat([['me', '"' + a[0].replace(/^\(|\)$/g, '') + '"'], [key, a[1]]]).concat(st.thanks || []);
    this.playLines(lines, function () {
      var sec = L.vsRewards(key, i, L.vsChoice(s, key, i)).filter(function (rw) { return rw.secret; })[0];
      if (sec) return self.dialog(C.VILLAGERS[key].name.toUpperCase().replace(/[^A-Z0-9 .'-]/g, '') + "'S SECRET\n" + sec.secret, [{ label: 'OK', cb: then }]);
      if (then) then();
    });
  };

  // ---------- the Photo wall ----------
  // The photos as drawn frames with the friends in them, four a page: stand-ins until each photo has its own picture
  // (in the house, each one is a Painting in that frame's style).
  var FRAME = { classic: [0x9a6a3a, 0xf3e2b8], rustic: [0x6b4424, 0xe9d6b0], cottage: [0xe8e0d0, 0xf7d9e3], modern: [0x8a96a3, 0xe6eef5],
    flower: [0xe6a0b8, 0xfff0f4], fireworks: [0x24345e, 0xdfe6ff], starry: [0x2a3d6e, 0xe2e9ff] };
  U.vsPhotoWall = function (page, back) {
    var self = this, s = F.session.state, photos = L.vsPhotos(s), per = 4, pages = Math.max(1, Math.ceil(photos.length / per));
    page = Math.max(0, Math.min(page || 0, pages - 1));
    var close = function () { self.closeModal(); if (back) back(); };
    var c = this.openModal(close);
    var PH = 476, y0 = Math.round((H - PH) / 2);
    this.panelImg(c, 12, y0, W - 24, PH);
    var title = this.txt(W / 2, y0 + 4, 'PHOTO WALL', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, 190);
    c.add(title);
    this.closeButton(c, W - 26, y0 + 10, close);
    if (!photos.length) {
      c.add(this.txt(W / 2, y0 + 150, 'No photos yet.\n\nSome friends give you a framed photo as their story grows. Each one also hangs in your house as a Painting.',
        15, INK, { align: 'center', wordWrap: { width: 260 }, lineSpacing: 4 }).setOrigin(0.5, 0));
    }
    F.ensureTexture(this, 'people');
    photos.slice(page * per, page * per + per).forEach(function (p, k) {
      var fw = 144, fh = 116, fx = 30 + (k % 2) * 156, fy = y0 + 40 + Math.floor(k / 2) * 190;
      var col = FRAME[p.style] || FRAME.classic;
      self.baked(c, fx, fy, 'ui-vs-frame-' + p.style, fw, fh, function (g) {
        g.fillStyle(0x000000, 0.18).fillRoundedRect(3, 4, fw - 2, fh - 2, 8);
        g.fillStyle(col[0], 1).fillRoundedRect(0, 0, fw, fh, 8);
        g.fillStyle(0xffffff, 0.18).fillRoundedRect(3, 3, fw - 6, 6, 3);
        g.fillStyle(col[1], 1).fillRect(10, 10, fw - 20, fh - 20);
        g.fillStyle(0xbfe0f0, 1).fillRect(14, 14, fw - 28, fh - 50);
        g.fillStyle(0x8fc46a, 1).fillRect(14, fh - 36, fw - 28, 22);
        g.lineStyle(2, 0x000000, 0.15).strokeRect(10, 10, fw - 20, fh - 20);
      });
      var n = p.people.length;
      p.people.forEach(function (who, j) {
        var x = fx + fw / 2 + (j - (n - 1) / 2) * (n > 2 ? 34 : 44);
        c.add(self.add.image(x, fy + fh - 16, 'people', C.VILLAGER_ORDER.indexOf(who) * 9).setOrigin(0.5, 0.83).setScale(n > 2 ? 0.34 : 0.4).setCrop(0, 0, 128, 150));
      });
      var cap = self.txt(fx + fw / 2, fy + fh + 6, p.photo, 11, INK, { fontStyle: 'bold', align: 'center', wordWrap: { width: fw }, lineSpacing: 1 }).setOrigin(0.5, 0);
      c.add(cap);
      c.add(self.txt(fx + fw / 2, cap.y + cap.height + 2, 'from ' + C.VILLAGERS[p.key].name, 10, '#7a5a3a', { align: 'center' }).setOrigin(0.5, 0));
    });
    c.add(this.txt(W / 2, y0 + PH - 64, photos.length + ' of ' + countPhotos() + ' photos. In your house, each one hangs as a Painting (Decorate).', 11, '#7a5a3a',
      { align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5, 0));
    if (pages > 1) this.pager(c, y0 + PH - 22, page, pages, function (pg) { self.closeModal(); self.vsPhotoWall(pg, back); });
    return c;
  };
  var countPhotos = function () {
    var n = 0;
    Object.keys(VS.stories).forEach(function (k) { VS.stories[k].forEach(function (st) { if (st.reward.some(function (rw) { return rw.photo; }) || st.choice.a.some(function (a) { return a[2] && a[2].reward && a[2].reward.some(function (rw) { return rw.photo; }); })) n++; }); });
    return n;
  };

  // ---------- what friends gave you, in the shops and the kitchen ----------
  // A friend price shows on the Buy buttons (the rules charge it: L.buy).
  var buyButtons = U.buyButtons;
  U.buyButtons = function (id, qtys) {
    var out = buyButtons.apply(this, arguments), s = F.session && F.session.state;
    if (s && !visiting() && L.vsOff(s, id) > 0) {
      out.forEach(function (b, k) {
        var q = qtys[k] || 1;
        if (/^Buy/.test(b.label)) b.label = (q > 1 ? 'Buy ' + q : 'Buy') + ' ' + L.priceOf(id, s.day, s) * q + 'G';
      });
    }
    return out;
  };
  // The dishes a friend taught you, at the end of the Kitchen's list.
  var openKitchen = U.openKitchen;
  U.openKitchen = function () {
    var s = F.session && F.session.state, extra = s ? L.vsRecipes(s) : [];
    if (!extra.length) return openKitchen.apply(this, arguments);
    var keep = C.RECIPES;
    C.RECIPES = keep.concat(extra);
    try { return openKitchen.apply(this, arguments); } finally { C.RECIPES = keep; }
  };

  // ---------- the tour ----------
  var still = function () {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  var tw = function (ui, move, cfg) { if (move && !still()) ui.tweens.add(cfg); };
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var face = function (ui, sc, x, y, key, scale) {
    F.ensureTexture(ui, 'people');
    var i = ui.add.image(x, y, 'people', C.VILLAGER_ORDER.indexOf(key) * 9).setOrigin(0.5, 0.83).setScale(scale || 0.4).setCrop(0, 0, 128, 150);
    sc.add(i);
    return i;
  };
  F.TOURS.friends = {
    title: 'FRIENDSHIP BOOK',
    steps: [
      {
        text: 'Every friend in Willowbrook has a little story. A new part opens at 2, 4, 6 and 8 hearts.',
        draw: function (ui, sc, move) {
          ['pearl', 'leo', 'poppy'].forEach(function (k, i) { face(ui, sc, 66 + i * 70, 124, k, 0.42); });
          [2, 4, 6, 8].forEach(function (h, i) {
            var x = 52 + i * 56, hi = icon(ui, sc, x, 26, C.ICON.heart, 0.2);
            words(ui, sc, x + 16, 26, String(h), 13, '#a8343a');
            tw(ui, move, { targets: hi, scale: 0.25, duration: 400, delay: i * 200, yoyo: true, repeat: -1, repeatDelay: 600 });
          });
        },
      },
      {
        text: 'Talk to them. Some want to meet you at a place in their day, or ask a small favour.',
        draw: function (ui, sc, move) {
          face(ui, sc, 66, 122, 'hana', 0.46);
          var b = icon(ui, sc, 124, 44, C.ICON.bubble, 0.36);
          tw(ui, move, { targets: b, y: 36, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          words(ui, sc, 200, 40, '5 PM at the gazebo', 12, '#5a3a1e');
          icon(ui, sc, 176, 88, C.ICON.egg, 0.26);
          words(ui, sc, 214, 88, 'x 5', 14, '#5a3a1e');
        },
      },
      {
        text: 'Each part gives you something: a recipe, seeds, a piece for your home, a photo, a friend price.',
        draw: function (ui, sc, move) {
          [C.ITEMS.bread.icon, C.ICON.seed_tulip, C.ICON.sparkle, C.ICON.heart, C.ICON.tag].forEach(function (fr, i) {
            var im = icon(ui, sc, 40 + i * 48, 64, fr, 0.3);
            if (move && !still()) {
              im.setScale(0);
              ui.tweens.add({ targets: im, scale: 0.3, duration: 260, delay: 200 + i * 260, hold: 1800 - i * 260, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Back.out' });
            }
          });
          words(ui, sc, 136, 112, 'and at 8 hearts, their secret', 12, '#6a4a2a');
        },
      },
      {
        text: 'Pause > Friends opens this Book: what is next with everyone, and your Photo wall. Talk panels have a Story button too.',
        draw: function (ui, sc, move) {
          var bk = icon(ui, sc, 56, 66, C.ICON.book, 0.5);
          tw(ui, move, { targets: bk, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          [0, 1, 2].forEach(function (i) {
            var y = 30 + i * 34;
            ui.canvasImg(sc, 110, y - 13, 'ui-vs-tourrow', 150, 26, function (g) { D.rrect(g, 0, 0, 150, 26, 8); g.fillStyle = '#fff6dc'; g.fill(); });
            face(ui, sc, 126, y + 12, ['lily', 'owen', 'jules'][i], 0.18);
            [0, 1, 2, 3].forEach(function (h) { icon(ui, sc, 150 + h * 14, y, C.ICON.heart, 0.09).setAlpha(h <= 2 - i ? 1 : 0.35); });
            words(ui, sc, 228, y, i ? (i === 1 ? 'NEXT' : '2/4') : 'NEW', 10, '#a8343a');
          });
        },
      },
    ],
  };
})(window.Farm = window.Farm || {});

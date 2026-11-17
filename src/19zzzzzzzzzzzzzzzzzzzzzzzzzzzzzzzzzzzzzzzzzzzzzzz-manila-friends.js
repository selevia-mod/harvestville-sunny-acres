// Manila Friends on screen (owner, 18 Nov 2026; content: 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-friends.js; the rules:
// 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZ-manila-friends.js).
// - In the city: facing one of the 10, the action button says Talk, or Gift while you hold something giftable and have not
//   given them one today (as with the town's villagers). Aling Nena keeps her Buy (her stall), with Talk and her friend's
//   free meal inside it. A chat plays their story step when one is ready; the talk panel has a Story button, and the
//   button of an unlock that is theirs to give (Father Ramon's blessing, studying with Bea, Mang Danny's rare trade).
// - Father Ramon at the Old Stone Church: at its door by day (6 AM-7 PM), inside at night and for Sunday mass (8-10 AM).
//   Knock at the church when he is inside.
// - The Friendship Book (Pause > Friends) gets a Manila page beside Willowbrook's: everyone's hearts, story, unlock and
//   birthday, and a Photo wall for Lola Amparo's old Manila.
// - Kapitana Marisol's spot: fishing from the pier's planks with her friendship, the bay's bigger fish bite.
// - A first-time tour, "Manila Friends", the first time you talk to any of them. Pop-ups are centred, like every dialog.
// Cheap phones: nothing new is drawn in the city (Father Ramon is one of the city-life roles, drawn only near the screen).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var MF = C.MNF;
  var M = C.MANILA;
  if (!MF || !MF.on || !M || !M.on) return;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var D = F.UI_DRAW;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var T = C.TILE;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, BROWN = 0x9a6a3a;
  var HR = 60;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var me = function () { return F.session && F.session.state; };
  var visiting = function () { return !!(F.session && F.session.visit); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var itemName = function (id) { return C.ITEMS[id] ? C.ITEMS[id].name : id; };

  // the tour's tip: appended last (a tip is its place in a saved number; this file loads after every other one that adds)
  C.TIPS.push({ key: 'mn_friends_tour', text: 'MANILA FRIENDS' });
  var TIP = 'mn_friends_tour';
  var take = function () {
    var s = me();
    if (!s || visiting() || L.tipSeen(s, TIP) || quiet()) return false;
    L.takeTip(s, TIP);
    F.Host.save(s);
    return true;
  };
  var saved = function () { var w = F.world; if (w) { w.changed(); w.save(); } };

  // ---------- their pictures: the owner's sheets (the 'manila' pack), else the stand-in the city shows them in ----------
  F.portraitOf = function (scene, key) {
    if (!L.mnIs(key)) return null;
    var d = MF.friends[key], tex = d.sheet, frame = 0, tint = 0;
    if (!(F.images && F.images[tex])) {
      var p = d.person && M.people[d.person], r = d.role2 && M.roles && M.roles[d.role2], look = r && r.looks && r.looks[0];
      tex = 'tw_people';
      if (p) { frame = p.look[0] * 9; tint = p.look[1] || 0; } else if (look) { frame = (look[1] || 0) * 9; tint = look[2] || 0; }
    }
    F.ensureTexture(scene, tex);
    return { tex: tex, frame: frame, tint: tint, name: d.name, role: d.role };
  };

  // ---------- Father Ramon's day: at the church door by day, inside at night and for Sunday mass ----------
  var PR = M.roles && M.roles.priest;
  if (PR) {
    var DAY = [[6 * HR, 19 * HR]], SUNDAY = [[6 * HR, 8 * HR], [10 * HR, 19 * HR]];
    L.mnMass = function (s) { return !!s && L.date(s.day).weekday === 0 && s.time >= 8 * HR && s.time < 10 * HR; };
    Object.defineProperty(PR, 'hours', { configurable: true, enumerable: true, get: function () { var s = me(); return s && L.date(s.day).weekday === 0 ? SUNDAY : DAY; } });
  }

  // ---------- who is in front of you ----------
  // { key, v, folk } for a Manila friend (one of the 7, or a role's person), or null
  P.mnFriendAt = function (pt) {
    if (!this.mn || this.mn.mall) return null;
    var v = this.mnPersonAt(pt.x, pt.y);
    if (v) { var k = L.mnKeyOfPerson(v.key); return k ? { key: k, v: v, folk: false } : null; }
    var fk = this.mnFolkAt(pt.x, pt.y), k2 = fk && fk.role && L.mnKeyOfRole(fk.role, fk.n);
    return k2 ? { key: k2, v: fk, folk: true } : null;
  };
  var faceMe = function (w, hit) {
    var v = hit.v, f = w.feet(), dir = Math.abs(f.x - v.x) > Math.abs(f.y - v.y) ? (f.x > v.x ? 'right' : 'left') : f.y < v.y ? 'up' : 'down';
    v.hold = Math.max(v.hold || 0, 5000);
    v.path = [];
    if (hit.folk) w.mnFolkFace(v, dir); else w.mnFace(v, dir);
  };
  var resolve = P.resolve;
  P.resolve = function () {
    var riding = (this.mnCal && this.mnCal.stage === 'on') || (this.mnRide && this.mnRide.stage === 'on');
    if (this.mn && !this.mn.mall && !visiting() && !riding && this.player) {
      var self = this, hit = this.mnFriendAt(this.front(0.7));
      if (hit) {
        var s = this.state, held = L.held(s), f = s.friends[hit.key];
        if (held && L.giftable(held.id) && !(f && f.gifted)) return { label: 'Gift', icon: C.ICON.gift, run: function () { self.mnfGift(hit); } };
        if (hit.key !== 'mn_nena') return { label: 'Talk', icon: C.ICON.bubble, run: function () { self.mnfTalkTo(hit); } };
      }
    }
    return resolve.apply(this, arguments);
  };
  // name tags: every friend's just over their own head, in their depth, following them; a tag that would cover a nearer
  // one's moves up over it; only near the camera (the city's culling: the 7's tags, the roles' sprites)
  var update = P.update;
  P.update = function () {
    update.apply(this, arguments);
    var mn = this.mn, DEPTH = F.WorldScene.DEPTH;
    if (!mn || mn.mall || !mn.people || !mn.people[0]) return;
    if (!mn.ft) {
      mn.ft = mn.people.slice();
      (mn.roles || []).forEach(function (v) { var k = L.mnKeyOfRole(v.role, v.n); if (k) { v.tag = this.add.text(0, 0, L.mnName(k), mn.people[0].tag.style.toJSON()).setOrigin(0.5, 1).setScale(0.7); mn.ft.push(v); } }, this);
    }
    var on = mn.ft.filter(function (v) {
      var tg = v.tag;
      if (v.folk) tg.setVisible(v.sp.visible);
      tg.setPosition(v.x, v.y - 1.3 * T);
      F.depthTo(tg, DEPTH.actor + v.y / 1e5 + 1e-7);
      return tg.visible;
    }).map(function (v) { return v.tag; }).sort(function (a, b) { return b.y - a.y; });
    on.forEach(function (tg, i) {
      for (var j = 0; j < i; j++) { var u = on[j]; if (Math.abs(tg.x - u.x) < (tg.displayWidth + u.displayWidth) / 2 + T / 5 && tg.y > u.y - u.displayHeight && tg.y - tg.displayHeight < u.y) tg.y = u.y - u.displayHeight; }
    });
  };
  P.mnfTalkTo = function (hit) {
    var s = this.state, d = MF.friends[hit.key];
    faceMe(this, hit);
    if (d.person) L.manilaTalk(s, d.person, hit.v.talks++); // (who you have met in the city, as before)
    F.ui.mnfTalk(hit.key);
  };
  P.mnfGift = function (hit) {
    var s = this.state, held = L.held(s), item = held && C.ITEMS[held.id] ? C.ITEMS[held.id].name : '';
    var first = !L.friend(s, hit.key).met, r = L.giveGift(s, hit.key, s.sel);
    if (r.error) return;
    faceMe(this, hit);
    if (MF.friends[hit.key].person) L.manilaMet(s, MF.friends[hit.key].person) || L.manilaTalk(s, MF.friends[hit.key].person, 0);
    sfx(r.pts > 0 ? 'gift' : 'nope');
    this.floatTextAt(hit.v.x, hit.v.y - 2.2 * T, (r.pts > 0 ? '+' : '') + r.pts + ' ♥');
    if (L.hello(s, hit.key)) this.progress('meet');
    this.changed();
    this.save();
    var ui = F.ui;
    ui.mnfSay(hit.key, '(You gave the ' + item + '.)\n' + r.line, first);
  };

  // ---------- talking ----------
  U.mnfTalk = function (key, done) {
    var s = me();
    if (!s) return;
    var go = L.vsReady(s, key);
    if (go) return this.vsPlay(key, go, done); // (the town's story scenes, 19zzzz-friends.js)
    var r = L.talk(s, key);
    if (F.world && L.hello(s, key)) F.world.progress('meet');
    sfx('talk');
    saved();
    this.mnfSay(key, r.line, r.first, done);
  };
  // first: the first time (their hello, as the city's people always said it, then the tour); else their panel with the
  // Story button and the unlock theirs to give
  U.mnfSay = function (key, text, first, done) {
    var self = this, d = MF.friends[key];
    var then = function () { if (take()) return self.tour('mn_friends', done); if (done) done(); };
    if (first) return this.dialog(d.name.toUpperCase().replace(/[^A-Z0-9 .'-]/g, '') + '\n(' + d.role + ')\n' + text, [{ label: 'OK', cb: then }]);
    var btns = [{ label: 'OK', cb: then }, { label: 'Story', color: BROWN, cb: function () { self.vsPage(key, done); } }];
    var act = this.mnfAction(key);
    if (act) btns.push(act);
    return this.dialog(text, btns, { portrait: key, name: d.name });
  };
  // the unlock button on a talk panel: null, or { label, color, cb }
  U.mnfAction = function (key) {
    var self = this, s = me();
    if (key === 'mn_ramon' && L.mnDailyReady(s, key)) return { label: 'Blessing', color: GREEN, cb: function () { self.mnfBless(); } };
    if (key === 'mn_bea' && L.mnDailyReady(s, key)) return { label: 'Study', color: GREEN, cb: function () { self.mnfStudy(); } };
    if (key === 'mn_danny' && L.mnTradeOffer(s).on) return { label: 'Trade', color: GREEN, cb: function () { self.mnfTrade(); } };
    return null;
  };

  // ---------- what a friendship gives, in person ----------
  U.mnfBless = function () {
    var s = me(), r = L.mnBless(s);
    if (!r.ok) { sfx('nope'); return this.toast(r.why === 'full' ? 'You are full of energy. Come back for a blessing when you are tired.' : r.why === 'done' ? 'Father Ramon blessed you today already.' : 'Not yet.', 2600); }
    sfx('fanfare');
    var w = F.world;
    if (w) { w.floatTextAt(w.feet().x, w.feet().y - 2 * T, '+' + r.gain + ' energy'); saved(); }
    F.bus.emit('hud');
    this.dialog('God bless you, my child. Go gently today.\n\n(+' + r.gain + ' energy. Once a day.)', null, { portrait: 'mn_ramon', name: 'Father Ramon' });
  };
  U.mnfStudy = function () {
    var self = this, s = me(), SK = C.SKILLS, xp = MF.unlocks.mn_bea.xp;
    this.choose('mn_bea', 'Study together! What shall we study? (+' + xp + ' XP, once a day)', SK.order.map(function (k) {
      return { label: SK.skills[k].name + ' (level ' + L.skillLevel(s, k) + ')', cb: function () {
        var r = L.mnStudy(s, k);
        if (!r.ok) { sfx('nope'); return self.toast(r.why === 'max' ? SK.skills[k].name + ' is at its top already. Pick another.' : r.why === 'done' ? 'You studied with Bea today already.' : 'Not yet.', 2600); }
        sfx('fanfare');
        saved();
        self.dialog('Okay, ' + SK.skills[k].name.toLowerCase() + '! You explain, I take notes. Deal?\n\n(+' + r.xp + ' ' + SK.skills[k].name + ' XP' + (r.level ? '. Level ' + r.level + '!' : '.') + ')', null, { portrait: 'mn_bea', name: 'Bea' });
      } };
    }));
  };
  U.mnfTrade = function () {
    var self = this, s = me(), o = L.mnTradeOffer(s);
    var head = "MANG DANNY'S RARE TRADE\n";
    if (o.done) return this.dialog(head + 'One rare trade a week, kuya. This week\'s is done. Come back on Monday!');
    var text = head + 'This week: your ' + o.n + ' ' + itemName(o.give) + ' for ' + o.m + ' ' + itemName(o.get) + '.\nYou have ' + o.have + ' ' + itemName(o.give) + '.\n\n(One a week. A new one every Monday.)';
    this.dialog(text, [{ label: 'Not now', color: GREY }, { label: 'Trade', color: o.have >= o.n ? GREEN : GREY, cb: function () {
      var r = L.mnTrade(s);
      if (r !== 'ok') { sfx('nope'); return self.toast(r === 'missing' ? 'You need ' + o.n + ' ' + itemName(o.give) + '.' : r === 'full' ? 'Your bag is full.' : 'Not now.', 2400); }
      sfx('coin');
      saved();
      self.toast('A fair trade! ' + o.m + ' ' + itemName(o.get) + '.', 2600, 0x2f5a22);
    } }]);
  };
  // Aling Nena's stall: a Talk button, and her friend's free meal
  U.mnFoodMore = function (v, open) {
    if (!v || v.role !== 'carinderia_cook' || visiting()) return null;
    var self = this, s = me(), u = MF.unlocks.mn_nena, fd = M.food[u.food], rows = [];
    if (L.mnHas(s, 'mn_nena', u.at)) {
      var ready = L.mnDailyReady(s, 'mn_nena');
      rows.push({ icon: C.ICON.heart, name: "A friend's meal  ·  Free", desc: ready ? '+' + fd.energy + ' energy: ' + fd.what + ', from Aling Nena. Once a day.' : 'Aling Nena fed you today already. Come back tomorrow!',
        buttons: ready ? [{ label: 'Eat', color: GREEN, cb: function () {
          var r = L.mnFreeMeal(s);
          if (!r.ok) { sfx('nope'); return self.toast(r.why === 'full' ? 'You are full of energy already!' : 'Tomorrow, anak!', 2200); }
          sfx('pick');
          var w = F.world;
          if (w) { saved(); if (w.floatTextAt) w.floatTextAt(w.feet().x, w.feet().y - 2 * T, '+' + r.gain + ' energy'); }
          F.bus.emit('hud');
          self.toast('Kain na! On the house, anak. +' + r.gain + ' energy.', 2200);
          self.swapTo(function () { open(); });
        } }] : [] });
    }
    return { rows: rows, corner: { label: 'Talk', color: BLUE, cb: function () {
      self.closeModal();
      var w = F.world;
      if (w && v.def) w.mnFolkFace(v, v.dir);
      self.mnfTalk('mn_nena');
    } } };
  };

  // ---------- the church: knock when Father Ramon is inside ----------
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (this.mapKey === 'manila' && o && o.type === 'mn_spot' && o.name === 'church' && !visiting() && this.mn) {
      var pr = (this.mn.roles || []).filter(function (v) { return v.role === 'priest'; })[0], s = this.state;
      if (pr && pr.inside) return { label: 'Knock', icon: C.ICON.bubble, run: function () {
        sfx('door');
        if (L.mnMass && L.mnMass(s)) return F.ui.dialog('OLD STONE CHURCH\nSunday mass is on. The whole barrio sings inside.\n\n(Father Ramon is at the door again at 10 AM.)');
        F.ui.mnfTalk('mn_ramon');
      } };
    }
    return extraObjectAction.apply(this, arguments);
  };

  // ---------- Kapitana Marisol's spot on the pier ----------
  var rollFish = L.rollFish;
  L.rollFish = function (water, r) {
    var w = F.world;
    if (w && w.mapKey === 'manila' && w.player && !visiting()) {
      var f = w.feet(), pw = L.mnPierWater(w.state, 'manila', Math.floor(f.x / T), Math.floor(f.y / T));
      if (pw) water = pw;
    }
    return rollFish.call(L, water, r);
  };
  var startFishing = P.startFishing;
  P.startFishing = function (t) {
    var r = startFishing.apply(this, arguments);
    if (this.mapKey === 'manila' && this.fishing && !visiting() && !F.session.mnPierSaid) {
      var f = this.feet();
      if (L.mnPierWater(this.state, 'manila', Math.floor(f.x / T), Math.floor(f.y / T))) {
        F.session.mnPierSaid = true;
        if (F.ui) F.ui.toast("Kapitana Marisol's spot: the bay's big fish bite here!", 2600);
      }
    }
    return r;
  };

  // ---------- the Friendship Book's Manila page ----------
  U.mnfBook = function (page) {
    var self = this, s = me();
    if (!s) return;
    if (take()) return this.tour('mn_friends', function () { self.mnfBook(page); });
    var rows = MF.order.map(function (k) {
      var f = L.friend(s, k), d = MF.friends[k];
      if (!f.met) return { icon: C.ICON.exclaim, name: '???', desc: 'Not met yet. Say hello at ' + d.where + ' in Manila!' };
      var done = L.mnsDone(s, k), list = MF.stories[k], n = L.mnsNext(s, k), ready = !!n && (n.state === 'open' || !!L.mnsReady(s, k)), un = L.mnUnlock(s, k);
      return {
        people: k, name: d.name, hearts: f.pts, tag: done >= list.length ? 'DONE' : ready ? 'NEW' : null,
        desc: 'Story ' + done + ' of ' + list.length + '. ' + L.mnsHint(s, k) + (un && un.on ? ' Unlocked: ' + MF.unlocks[k].text.toLowerCase() + '.' : ''),
        buttons: [{ label: 'Story', color: ready ? GREEN : BLUE, cb: function () { self.closeModal(); self.vsPage(k, function () { self.mnfBook(page); }); } }],
      };
    });
    this.listPanel({
      title: 'Friendship Book', rows: rows, page: page || 0, tabs: [['town', 'Willowbrook'], ['manila', 'Manila']], tab: 'manila',
      reopen: function (t, p) { self.closeModal(); if (t === 'town') return self.vsBook(p); self.mnfBook(p); },
      corner: { label: 'Photos', color: BLUE, cb: function () { self.closeModal(); self.mnfPhotoWall(0, function () { self.mnfBook(page); }); } },
      sub: function () {
        return MF.order.filter(function (k) { return L.friend(s, k).met; }).length + ' of ' + MF.order.length + ' met in Manila.  ' + L.mnsCount(s) + ' of ' + L.mnsTotal() + ' story steps.';
      },
    });
  };
  // a friend's page (the town's, vsPage): their unlock and their birthday under their steps
  U.vsPageMore = function (key) {
    if (!L.mnIs(key)) return null;
    var s = me(), d = MF.friends[key], un = L.mnUnlock(s, key), b = d.birthday, rows = [];
    if (un) rows.push({ icon: C.ICON.star, tag: un.on ? 'UNLOCKED' : MF.unlocks[key].at + ' HEARTS', name: 'What ' + d.name + ' gives', desc: un.text });
    rows.push({ icon: C.ICON.cake, name: 'Birthday: ' + C.MONTHS[b[0] - 1] + ' ' + b[1], desc: 'A gift on their birthday counts double. Find them at ' + d.where + '.' });
    return rows;
  };
  // Lola Amparo's old Manila, framed: the town's Photo wall, with hers (each one also hangs in your house as a Painting)
  U.mnfPhotoWall = function (page, back) {
    var photos = L.mnsPhotos(me()).map(function (p) { return Object.assign({ people: [] }, p); });
    return this.vsPhotoWall(page, back, { photos: photos, total: L.mnsPhotoCount(), title: 'OLD MANILA',
      none: 'No photos yet.\n\nLola Amparo gives you a framed photo of old Manila at each step of her story. Each one also hangs in your house as a Painting.' });
  };

  // ---------- the tour ----------
  var still = function () {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  var tw = function (ui, move, cfg) { if (move && !still()) ui.tweens.add(cfg); };
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var face = function (ui, sc, x, y, key, scale) {
    var pf = F.portraitOf(ui, key), i = ui.add.image(x, y, pf.tex, pf.frame).setOrigin(0.5, 0.83).setScale(scale || 0.4).setCrop(0, 0, 128, 150);
    if (pf.tint) i.setTint(pf.tint);
    sc.add(i);
    return i;
  };
  if (F.TOURS) {
    F.TOURS.mn_friends = {
      title: 'MANILA FRIENDS',
      steps: [
        { text: 'Ten people of the city can be your friends: Aling Rosa, Mang Tibo, Lola Amparo, Father Ramon, Bea, Aling Nena and more.',
          draw: function (ui, sc, move) {
            ['mn_rosa', 'mn_tibo', 'mn_amparo', 'mn_ramon', 'mn_bea'].forEach(function (k, i) {
              var f = face(ui, sc, 36 + i * 50, 120, k, 0.36);
              tw(ui, move, { targets: f, y: 114, duration: 420, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            });
          } },
        { text: 'Hearts grow as in Willowbrook: talk to them once a day, and give a gift once a day. What they love counts most; birthdays double.',
          draw: function (ui, sc, move) {
            face(ui, sc, 60, 122, 'mn_nena', 0.44);
            var g = icon(ui, sc, 140, 64, C.ICON.gift, 0.38);
            tw(ui, move, { targets: g, y: 56, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            [0, 1, 2, 3, 4].forEach(function (h) {
              var hi = icon(ui, sc, 186 + (h % 3) * 26, 46 + Math.floor(h / 3) * 30, C.ICON.heart, 0.2);
              tw(ui, move, { targets: hi, scale: 0.25, duration: 380, delay: h * 160, yoyo: true, repeat: -1, repeatDelay: 500 });
            });
          } },
        { text: 'At 2, 4, 6 and 8 hearts each has a story. And every friendship unlocks something: a cheaper train, a 4th contract, a blessing, a free meal...',
          draw: function (ui, sc, move) {
            [C.ICON.calendar, C.ICON.coin, C.ICON.rod, C.ICON.sparkle, C.ICON.heart].forEach(function (fr, i) {
              var im = icon(ui, sc, 40 + i * 48, 60, fr, 0.3);
              if (move && !still()) {
                im.setScale(0);
                ui.tweens.add({ targets: im, scale: 0.3, duration: 260, delay: 200 + i * 260, hold: 1800 - i * 260, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Back.out' });
              }
            });
            [2, 4, 6, 8].forEach(function (h, i) { words(ui, sc, 52 + i * 56, 112, h + ' ♥', 13, '#a8343a'); });
          } },
        { text: 'Pause > Friends > the Manila page: everyone\'s hearts, stories, unlocks and birthdays. Lola Amparo\'s old photos are there too.',
          draw: function (ui, sc, move) {
            var bk = icon(ui, sc, 56, 66, C.ICON.book, 0.5);
            tw(ui, move, { targets: bk, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            ['mn_kardo', 'mn_marisol', 'mn_danny'].forEach(function (k, i) {
              var y = 30 + i * 34;
              ui.canvasImg(sc, 110, y - 13, 'ui-vs-tourrow', 150, 26, function (g) { D.rrect(g, 0, 0, 150, 26, 8); g.fillStyle = '#fff6dc'; g.fill(); });
              face(ui, sc, 126, y + 12, k, 0.18);
              [0, 1, 2, 3].forEach(function (h) { icon(ui, sc, 150 + h * 14, y, C.ICON.heart, 0.09).setAlpha(h <= 2 - i ? 1 : 0.35); });
              words(ui, sc, 228, y, ['NEW', '6 ♥', '2/4'][i], 10, '#a8343a');
            });
          } },
      ],
    };
  }
})(window.Farm = window.Farm || {});

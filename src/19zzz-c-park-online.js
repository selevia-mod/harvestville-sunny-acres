// Central Park online (owner, 6 Nov 2026: "A place for everyone, not my park, not my friends park, its for everyone
// park"). Everyone who walks into the park sees everyone else in the same park: three parks (Park 1, 2 and 3) of 30
// each, like an online game's channels. The place itself is 00-zzzzzzzzz-park.js; the server is part 19
// (supabase/farm_online_19.sql): a seat in a park (farm_park_join_v1), "still here" every 30 s (farm_park_beat_v1),
// and the live room 'park:<n>' instead of a farm's. Your own farm's room stays joined while you are in the park, as on a
// visit, and says you went to the park, so a friend on your farm sees where you went.
//
// The message budget (owner, 6 Nov 2026, critical): Supabase counts every broadcast once sent and once for each phone
// that hears it, the whole project may send 2,500 a second, and going over cuts off every live line in the app (the
// Selebox chats too). With 30 in a room a farm's four moves a second would be 30 x 4 x 30 = 3,600 a second from one
// park. So in the park only: your place goes out about once a second while you walk and never while you stand (one
// last "stopped"), every 2 s when more than 20 others are there (C.ONLINE.park), no one answers a newcomer with a move
// (the presence list says where everyone stands), and the others are drawn a step in the past (L.trailAt, tr.every)
// so they still walk smoothly. Farm rooms keep their 250 ms.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var ON = C.ONLINE, PK = ON.park;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68;
  var CAP = 30; // (the server's farm.park_rules(): only shown, never enforced here)
  var STOP_MS = 150; // no step for this long is a stop (a frame with no physics step is not)
  var noop = function () {};
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  // ---------- where we are ----------
  // n: our park (0: none yet); counts: people in Park 1, 2, 3 (us included); seated: the server gave us a seat;
  // asking: a seat asked for; told: the "join online play" toast was shown this time the game is open.
  var Pk = O.park = { n: 0, counts: [0, 0, 0], seated: false, asking: false, timer: null, told: false };
  // In the park as yourself (never on a visit: your own save's map is where you were before the visit).
  O.inPark = function () { var s = F.session && F.session.state; return !!s && !F.session.visit && s.map === 'park'; };
  O.parkRoom = function () { return !!O.chan && O.topic.indexOf('park:') === 0; };

  var setCounts = function (c) {
    if (!Array.isArray(c)) return;
    Pk.counts = [0, 1, 2].map(function (i) { return Math.max(0, Math.min(999, Math.floor(Number(c[i])) || 0)); });
    F.bus.emit('park');
  };
  // How many are in park n: our own park live from the room once it has said who is here (the server's count can hold
  // a seat for up to 75 s after a phone closes), the others from the server's last answer.
  O.parkCount = function (n) {
    if (n === Pk.n && O.parkRoom() && O.seen) return Object.keys(O.others).length + 1;
    return Math.max(n === Pk.n ? 1 : 0, Pk.counts[n - 1] || 0);
  };

  // ---------- the room: park:<n> while in the park ----------
  var topicNow = O.topicNow;
  O.topicNow = function () {
    if (O.on && O.inPark()) return Pk.n ? 'park:' + Pk.n : '';
    return topicNow.call(O);
  };

  var ensureChannel = O.ensureChannel;
  O.ensureChannel = function () {
    if (!O.on || !O.inPark()) {
      if (Pk.seated || Pk.timer) O.parkOut(); // walked out (or went visiting): the seat goes
      return ensureChannel.call(O);
    }
    beatOn();
    var h = O.ensureHome();
    if (h) h.chan.track(O.myState()); // our own room: we are in the park now (its presence, as rarely as trackEvery allows)
    if (Pk.n) return ensureChannel.call(O);
    if (O.chan) O.leaveChannel(); // no seat yet: in no room but our own (which is only set aside)
    O.parkSeat(null);
  };

  // Out of the park: no more beats, and the seat is given back at once.
  O.parkOut = function () {
    beatOff();
    var had = Pk.seated;
    Pk.n = 0;
    Pk.seated = false;
    F.bus.emit('park');
    if (had && F.Net.available()) F.Net.rpc('farm_park_leave_v1', {}).catch(noop);
  };

  var disconnect = O.disconnect;
  O.disconnect = function () {
    if (Pk.seated || Pk.timer) O.parkOut();
    return disconnect.apply(O, arguments);
  };

  // A seat: want = 1-3 to change park, null for "pick for me" (with friends first, else the lowest park with room, and
  // the park we are in if our seat is still fresh).
  O.parkSeat = function (want) {
    if (Pk.asking || !O.on) return Promise.resolve(null);
    Pk.asking = true;
    return F.Net.rpc('farm_park_join_v1', { p_park: want }).then(function (r) {
      Pk.asking = false;
      r = r && typeof r === 'object' ? r : {};
      setCounts(r.counts);
      var n = Math.floor(Number(r.park));
      if (r.ok && n >= 1 && n <= 3) {
        if (!O.on || !O.inPark()) { F.Net.rpc('farm_park_leave_v1', {}).catch(noop); return null; } // walked out meanwhile
        var moved = n !== Pk.n;
        if (!moved) Pk.was = 0;
        Pk.n = n;
        Pk.seated = true;
        F.bus.emit('park');
        if (moved) {
          O.ensureChannel(); // out of the old park's room (if any), into this one
          if (F.ui && n !== Pk.was) F.ui.toast('Central Park ' + n + ' · ' + O.parkCount(n) + ' here', 2600, 0x2f5a22);
          O.parkTour();
          Pk.was = 0;
        }
        return n;
      }
      if (!O.on || !O.inPark()) return null;
      if (r.code === 'full') {
        if (want == null) O.parkFull();
        else if (F.ui) F.ui.toast('Park ' + want + ' is full right now.', 2600);
      }
      return null; // ('not-player', 'bad', or the part not on the server yet: the park stays quiet)
    }, function () { Pk.asking = false; return null; }); // (no answer: quiet; the next beat asks again)
  };

  // All three parks full when we arrive: a centred card, and the farmer steps back out to town.
  O.parkFull = function () {
    beatOff();
    Pk.n = 0;
    Pk.seated = false;
    F.bus.emit('park');
    var tries = 0;
    var out = function () {
      var w = F.world;
      if (!w || w.mapKey !== 'park') return card();
      if (w.busy && tries++ < 40) return setTimeout(out, 250);
      if (F.ui) F.ui.closeAll();
      w.travel('town', 'from_park');
      card();
    };
    var card = function () {
      var w = F.world;
      if (!F.ui) return;
      if ((!w || w.busy || w.mapKey === 'park' || F.ui.modals.length) && tries++ < 60) return setTimeout(card, 250);
      sfx('door');
      F.ui.dialog('CENTRAL PARK\nCentral Park is full right now. Try again in a minute.');
    };
    out();
  };

  // ---------- "still here", every 30 s ----------
  var beat = function () {
    if (!O.on || !O.inPark()) return beatOff();
    if (F.Host.sleeping) return; // the app in the background: no beat (the seat goes stale by itself in 75 s)
    if (!Pk.seated) return void O.parkSeat(null); // no seat yet (no answer before): ask again
    F.Net.rpc('farm_park_beat_v1', {}).then(function (r) {
      r = r && typeof r === 'object' ? r : {};
      setCounts(r.counts);
      if (!O.on || !O.inPark() || !Pk.seated) return;
      if (r.park == null) { Pk.seated = false; O.parkSeat(null); return; } // our seat was lost: join again (most likely the same park)
      var n = Math.floor(Number(r.park));
      if (n >= 1 && n <= 3 && n !== Pk.n) { Pk.n = n; O.ensureChannel(); }
    }, noop);
  };
  var beatOn = function () { if (!Pk.timer) Pk.timer = setInterval(beat, PK.beatEvery); };
  var beatOff = function () { if (Pk.timer) clearInterval(Pk.timer); Pk.timer = null; };

  // Waking: the seat may have gone stale while we slept, so ask again (a fresh one keeps us in the same park).
  var sleep = window.__gameSleep;
  window.__gameSleep = function (sleeping) {
    if (!sleeping && F.Host.sleeping && O.inPark()) { Pk.was = Pk.n; Pk.n = 0; Pk.seated = false; }
    return sleep(sleeping);
  };

  // ---------- the live room ----------
  var onPresence = O.onPresence;
  O.onPresence = function (list) {
    onPresence.call(O, list);
    if (O.parkRoom()) F.bus.emit('park'); // (the chip counts our own park live)
  };

  // How often each walker's steps come (their own phone's pace: it slows in a crowd): they are drawn that far behind.
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    onMessage.apply(O, arguments);
    if (event !== 'mv' || !payload || typeof payload.id !== 'string') return;
    var tr = O.trails[payload.id];
    if (tr) tr.every = O.parkRoom() ? Math.max(ON.moveEvery, Math.min(PK.busyMoveEvery, Number(payload.ev) || PK.moveEvery)) : 0;
  };

  // Our place, in the park (O.update asks first; true: handled). Once a second while walking (every 2 s in a crowd),
  // one "stopped" where we stop, and nothing while we stand; turning on the spot is one message at most each step.
  var step = { at: 0, x: -1, y: -1, t: 0 };
  O.parkSend = function (w, dt) {
    if (!O.parkRoom() || w.mapKey !== 'park') return false;
    var f = w.feet(), now = Date.now(), last = O.last, rd = F.session.riding ? 1 : 0;
    if (!last) { // just arrived: standing, and the presence has our place
      step.x = f.x;
      step.y = f.y;
      step.at = 0;
      O.last = { x: f.x, y: f.y, dir: w.dir, map: 'park', fl: 0, m: 0, rd: rd };
      return true;
    }
    if (Math.abs(f.x - step.x) > 0.5 || Math.abs(f.y - step.y) > 0.5) step.at = now;
    step.x = f.x;
    step.y = f.y;
    var many = Object.keys(O.others).length, every = many > PK.busyAt ? PK.busyMoveEvery : PK.moveEvery;
    var tell = function (m, t) {
      O.last = { x: f.x, y: f.y, dir: w.dir, map: 'park', fl: 0, m: m, rd: rd };
      step.t = Math.max(t, step.t + 1);
      if (many) O.send('mv', { map: 'park', fl: 0, x: Math.round(f.x), y: Math.round(f.y), dir: w.dir, m: m, t: step.t, rd: rd, sn: O.mapAt || 0, ev: every });
    };
    O.mvMs -= dt;
    if (now - step.at < STOP_MS) { // walking
      if (O.mvMs > 0) return true;
      O.mvMs = every;
      tell(1, now);
    } else if (last.m) { // stopped: where, once (when they stopped), and the presence says it for anyone who comes later
      tell(0, step.at);
      O.chan.track(O.myState());
    } else if ((last.dir !== w.dir || last.rd !== rd) && O.mvMs <= 0) { // turned, or got on or off the horse, on the spot
      O.mvMs = every;
      tell(0, now);
      O.chan.track(O.myState());
    }
    return true;
  };

  // ---------- the world ----------
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    if (this.mapKey !== 'park' || F.session.visit) return;
    var self = this;
    // no online play (no app, not signed in, or left it): the park is open, only empty; said once while the game is open
    var tell = function () {
      if (O.on || Pk.told || !self.sys || !self.sys.isActive() || self.mapKey !== 'park') return;
      Pk.told = true;
      if (F.ui) F.ui.toast('Join online play to meet everyone here.', 3200);
    };
    if (O.joining) O.joining.then(tell, tell);
    else this.time.delayedCall(600, tell);
  };

  // Facing someone in the park: Wave opens their card (Hi!, add them as a friend, or More: report, block). A farm keeps
  // its plain Wave; holding food it is still Give (19u-give.js).
  var resolve = P.resolve;
  P.resolve = function () {
    var a = resolve.apply(this, arguments);
    if (!a || a.label !== 'Wave' || this.mapKey !== 'park' || !O.parkRoom()) return a;
    var pt = this.front(0.7), r = this.remoteAt(pt.x, pt.y);
    if (!r) return a;
    var id = r.id;
    return Object.assign({}, a, { run: function () { if (F.ui) F.ui.parkPlayer(id); } });
  };

  // ---------- the chip and the parks ----------
  var CHIP = { x: 8, y: 164, h: 24 }; // the left column: under the goal banner and its toasts, over Today's Event (194)

  var uiCreate = U.create;
  U.create = function () {
    uiCreate.apply(this, arguments);
    var self = this, redraw = function () { self.parkChip(); };
    F.bus.on('park', redraw);
    F.bus.on('map', redraw);
    F.bus.on('online', redraw);
    this.events.once('shutdown', function () { F.bus.off('park', redraw); F.bus.off('map', redraw); F.bus.off('online', redraw); });
    this.parkChip();
  };

  U.parkChip = function () {
    var on = O.on && O.inPark() && Pk.seated && Pk.n > 0 && !this.decorating;
    if (!on) { if (this.parkChipBox) this.parkChipBox.setVisible(false); return; }
    var self = this, text = 'Park ' + Pk.n + ' · ' + O.parkCount(Pk.n) + '/' + CAP;
    if (!this.parkChipBox) {
      var c = this.parkChipBox = this.add.container(CHIP.x, CHIP.y).setDepth(45);
      this.parkChipBg = this.add.graphics();
      this.parkChipDot = this.add.circle(13, CHIP.h / 2, 4, 0x7ee06a);
      this.parkChipText = this.txt(22, CHIP.h / 2, '', 12, '#fff6d8', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.parkChipZone = this.add.zone(0, -6, 10, CHIP.h + 12).setOrigin(0).setInteractive({ useHandCursor: true }); // (a fair size for a thumb)
      F.tapOn(this.parkChipZone, function () { if (!self.modals.length) self.openParks(); });
      c.add([this.parkChipBg, this.parkChipDot, this.parkChipText, this.parkChipZone]);
      this.tweens.add({ targets: this.parkChipDot, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
    }
    if (this.parkChipText.text !== text) {
      this.parkChipText.setText(text);
      var w = Math.ceil(this.parkChipText.width) + 32;
      this.parkChipBg.clear().fillStyle(0x24160b, 0.78).fillRoundedRect(0, 0, w, CHIP.h, CHIP.h / 2);
      this.parkChipBg.lineStyle(1.5, 0xffd23f, 0.85).strokeRoundedRect(0.75, 0.75, w - 1.5, CHIP.h - 1.5, CHIP.h / 2 - 0.75);
      this.parkChipZone.setSize(w + 8, CHIP.h + 12);
      this.parkChipW = w;
    }
    this.parkChipBox.setVisible(true);
  };

  // The three parks, centred: how many in each, and Go to change.
  U.openParks = function () {
    var self = this, c = null;
    var draw = function () {
      var rowH = 50, h = 36 + 3 * rowH + 62, y0 = Math.round((H - h) / 2 - 30);
      c = self.openModal();
      self.panelImg(c, 36, y0, W - 72, h);
      var title = self.txt(W / 2, y0 + 4, 'CENTRAL PARK', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
      self.ribbon(c, W / 2, y0 + 4, Math.max(170, title.width + 44));
      c.add(title);
      [1, 2, 3].forEach(function (n, i) {
        var y = y0 + 30 + i * rowH + rowH / 2, here = n === Pk.n, k = O.parkCount(n);
        if (i) c.add(self.add.rectangle(W / 2, y - rowH / 2, W - 112, 1, 0xc9a26b, 0.6));
        c.add(self.txt(62, y, 'Park ' + n, 16, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5));
        c.add(self.txt(148, y, k + '/' + CAP, 15, k >= CAP ? '#a0402a' : '#5a3a1e').setOrigin(0, 0.5));
        if (here) c.add(self.txt(W - 62, y, 'You are here', 13, '#2f7a22', { fontStyle: 'bold' }).setOrigin(1, 0.5));
        else self.button(c, W - 92, y, 64, 34, 'Go', function () { self.closeModal(); O.parkSeat(n); }, BLUE);
      });
      self.button(c, W / 2, y0 + h - 34, 120, 38, 'Close', function () { self.closeModal(); }, GREY);
    };
    draw();
    F.Net.rpc('farm_park_counts_v1', {}).then(function (r) {
      if (!r || !Array.isArray(r.counts)) return;
      setCounts(r.counts);
      var top = self.modals[self.modals.length - 1];
      if (top && top.c === c) { self.closeModal(); draw(); } // (fresh numbers, in the same place)
    }, noop);
  };

  // Someone in the park: a centred card to say hi, add them as a friend, or More (report, block). (where: another place
  // open to everyone, a hunting place's public room: 19zzzzzzzzz-gameserver.js)
  U.parkPlayer = function (id, where) {
    var p = O.who(id), self = this;
    if (!p || this.modals.length) return;
    var who = p.name;
    this.dialog('SAY HI\n' + who + ' is ' + (where || 'in Central Park') + ' with you.', [
      { label: 'More', color: GREY, cb: function () { self.playerMenu(id, who); } },
      { label: 'Add friend', color: GREEN, cb: function () { if (self.askFriend) self.askFriend(id, who); } },
      { label: 'Wave', color: BLUE, cb: function () { O.wave(); } },
    ]);
  };

  // ---------- the first-time tour (owner, 4 Oct 2026: every new feature gets one; the card: 19ze-tours.js) ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var farmer = function (ui, sc, x, y, girl, flip, scale) {
    var key = F.ensureTexture(ui, girl ? 'player_girl' : 'player');
    var p = ui.add.image(x, y, key, 0).setOrigin(0.5, 1).setScale(scale || 0.26).setFlipX(!!flip);
    sc.add(p);
    return p;
  };
  var pill = function (ui, sc, x, y, str) {
    var t = ui.txt(x + 22, y, str, 12, '#fff6d8', { fontStyle: 'bold' }).setOrigin(0, 0.5), w = Math.ceil(t.width) + 32;
    var g = ui.add.graphics();
    g.fillStyle(0x24160b, 0.85).fillRoundedRect(x, y - 12, w, 24, 12);
    g.lineStyle(1.5, 0xffd23f, 0.85).strokeRoundedRect(x + 0.75, y - 11.25, w - 1.5, 22.5, 11.25);
    sc.add([g, ui.add.circle(x + 13, y, 4, 0x7ee06a), t]);
    return w;
  };

  F.TOURS.park = {
    title: 'CENTRAL PARK',
    steps: [
      {
        text: 'Central Park: everyone in Harvest Ville meets here. Walk up the road by the Station.',
        draw: function (ui, sc, move) {
          [[56, false, false], [104, true, true], [168, false, false], [216, true, true]].forEach(function (f, i) {
            var p = farmer(ui, sc, f[0], 124, f[1], f[2]);
            tw(ui, move, { targets: p, y: 116, duration: 360, yoyo: true, repeat: -1, delay: i * 180, ease: 'Sine.inOut' });
          });
          var h = icon(ui, sc, 136, 30, C.ICON.heart, 0.26);
          tw(ui, move, { targets: h, scale: 0.32, duration: 420, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'The chip at the top left: your park and how many are here. Tap it to go to Park 1, 2 or 3 (30 in each).',
        draw: function (ui, sc, move) {
          pill(ui, sc, 14, 26, 'Park 1 · 23/30');
          words(ui, sc, 96, 70, 'Park 2   8/30', 14, '#5a3a1e');
          words(ui, sc, 96, 104, 'Park 3   0/30', 14, '#5a3a1e');
          var go = words(ui, sc, 222, 70, 'Go', 16, '#1f4a7a');
          tw(ui, move, { targets: go, scale: 1.2, duration: 420, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Tap Chat to talk to everyone here. Face someone and tap Wave to say hi or add them as a friend.',
        draw: function (ui, sc, move) {
          farmer(ui, sc, 80, 128, false, false, 0.2);
          farmer(ui, sc, 166, 128, true, true, 0.2);
          var say = ui.add.container(80, 28), t = ui.txt(0, 0, 'Hi everyone!', 12, '#3d2614', { fontStyle: 'bold' }).setOrigin(0.5), g = ui.add.graphics();
          g.fillStyle(0xfffaf0, 1).fillRoundedRect(-t.width / 2 - 8, -11, t.width + 16, 22, 9).fillTriangle(-5, 10, 5, 10, 0, 17);
          g.lineStyle(1.5, 0x3d2614, 1).strokeRoundedRect(-t.width / 2 - 8, -11, t.width + 16, 22, 9);
          say.add([g, t]);
          sc.add(say);
          tw(ui, move, { targets: say, y: 22, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          var hi = words(ui, sc, 166, 30, 'Hi!', 17, '#a8740c');
          tw(ui, move, { targets: hi, scale: 1.2, duration: 320, yoyo: true, repeat: -1 });
          var chat = ui.add.container(236, 78);
          chat.add([ui.add.circle(0, 0, 18, 0x4a90c9).setStrokeStyle(2, 0xffffff), ui.txt(0, -3, '...', 16, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5)]);
          sc.add(chat);
          tw(ui, move, { targets: chat, scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  // The first time you sit down in a park (online, so the chip and the others are there), once the arrival toast is read.
  O.parkTour = function () {
    var s = F.session.state;
    if (!s || L.tipSeen(s, 'park_tour') || (window.gameHost && window.gameHost.quiet)) return;
    var tries = 0;
    var show = function () {
      var w = F.world;
      if (!F.ui || !O.inPark() || !Pk.seated || L.tipSeen(F.session.state, 'park_tour')) return;
      if ((F.ui.modals.length || !w || w.busy || document.getElementById('farm-ask')) && tries++ < 40) return setTimeout(show, 1500);
      if (!L.takeTip(F.session.state, 'park_tour')) return;
      F.Host.save(F.session.state);
      F.ui.tour('park');
    };
    setTimeout(show, 2800);
  };

})(window.Farm = window.Farm || {});

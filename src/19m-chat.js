// Chat bubbles (owner, 27 Oct 2026: "a mini chat when visiting friends, popping up bubbles over their heads").
// When someone else is on the same farm, a Chat button shows: pick a quick line or type your own (one line, up to
// C.CHAT.max characters) and it pops up over your farmer's head on every phone on that farm for a few seconds. Lines
// go over the farm's live room ('say' messages) and are not stored; each phone checks what it shows (L.chatClean)
// and how often one farmer may talk (L.chatAllowed). Rules in 01-logicA.js.
// Owner, 2 Nov 2026, from players: "cannot see the chat when they are out of screen", "too big, overlaying others",
// "cannot see what others already said". So bubbles are small and two lines at most, every line also shows for a while
// in a small box at the top left wherever the speaker is, even in another part of the farm, and the Chat panel
// keeps what was said since the game opened (O.chatLog, on this phone only: someone who arrives later can't see it).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var heard = {}; // farmer id -> rate-limit log for lines shown here
  var mine = {}; // my own rate-limit log
  var BUBBLE_W = 1100; // world units, about 4 tiles
  var LOG_MAX = 60; // lines kept
  O.chatLog = []; // { id, name, text, t }, oldest first

  // ---------- the bubbles, over a farmer's head, following them ----------
  var P = F.WorldScene.prototype;
  var create = P.create;
  P.create = function () {
    this.bubbles = {}; // farmer id -> { c, until } (a restarted scene keeps its properties, not its pictures)
    this.chatable = null;
    create.call(this);
  };

  P.bubble = function (id, text) {
    var old = this.bubbles[id];
    if (old) old.c.destroy();
    var t = this.add.text(0, 0, text, {
      fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '92px', fontStyle: 'bold', color: '#3d2614', align: 'center',
      wordWrap: { width: BUBBLE_W }, lineSpacing: 6, maxLines: 2,
    }).setOrigin(0.5, 1);
    if (t.getWrappedText(text).length > 2) { // (the whole line is in the box and the Chat panel)
      var two = t.getWrappedText(text).slice(0, 2);
      t.setText(two[0] + '\n' + two[1].replace(/\s+$/, '').slice(0, -1) + '…');
    }
    var bw = t.width + 90, bh = t.height + 56, g = this.add.graphics();
    g.fillStyle(0x3d2614, 0.25).fillRoundedRect(-bw / 2 + 8, -bh - 40 + 12, bw, bh, 44);
    g.fillStyle(0xfffaf0, 1).fillRoundedRect(-bw / 2, -bh - 40, bw, bh, 44);
    g.lineStyle(14, 0x3d2614, 1).strokeRoundedRect(-bw / 2, -bh - 40, bw, bh, 44);
    g.fillStyle(0xfffaf0, 1).fillTriangle(-34, -47, 34, -47, 0, 0);
    g.lineStyle(14, 0x3d2614, 1).lineBetween(-34, -40, 0, 0).lineBetween(34, -40, 0, 0);
    t.setPosition(0, -68);
    var c = this.add.container(0, 0, [g, t]).setDepth(DEPTH.Above + 5).setScale(0.6);
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.out' });
    this.bubbles[id] = { c: c, until: Date.now() + C.CHAT.show };
    this.placeBubble(id);
  };

  // Above the name tag of whoever said it (or above you).
  P.placeBubble = function (id) {
    var b = this.bubbles[id], at = null;
    if (!b) return;
    if (O.me && id === O.me.id && this.player) at = this.feet();
    else if (this.remotes && this.remotes[id]) at = { x: this.remotes[id].x, y: this.remotes[id].y };
    if (!at) { b.c.destroy(); delete this.bubbles[id]; return; } // they left: so does the bubble
    b.c.setPosition(at.x, at.y - 1.98 * T); // (just above the name tag)
  };

  var update = O.update;
  O.update = function (w, dt) {
    update.call(O, w, dt);
    if (!w.bubbles) return;
    var now = Date.now();
    Object.keys(w.bubbles).forEach(function (id) {
      var b = w.bubbles[id];
      if (now > b.until) {
        delete w.bubbles[id];
        w.tweens.add({ targets: b.c, alpha: 0, duration: 250, onComplete: function () { b.c.destroy(); } });
        return;
      }
      w.placeBubble(id);
    });
    // the Chat button shows while someone else is on this farm, wherever they are on it
    var some = !!(O.chan && Object.keys(O.others || {}).length && !w.busy);
    if (some !== w.chatable) {
      w.chatable = some;
      F.bus.emit('chatable', some);
    }
  };

  // ---------- saying something ----------
  // Returns '' when said, or why not.
  O.say = function (text) {
    var w = F.world, line = L.chatClean(text);
    if (!O.chan || !O.me) return 'Nobody is here to hear you.';
    if (!line) return text && L.cleanText(text, C.CHAT.max) ? 'Let\'s keep Harvest Ville friendly. Try other words.' : '';
    if (!L.chatAllowed(mine, Date.now())) return 'Not so fast! Wait a moment.';
    O.send('say', { s: line });
    O.logLine(O.me.id, O.myName(), line);
    if (w && w.bubbles) w.bubble(O.me.id, line);
    sfx('talk');
    return '';
  };

  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event !== 'say') return onMessage.call(O, event, payload);
    var p = payload && typeof payload === 'object' ? payload : {}, who = typeof p.id === 'string' ? O.others[p.id] : null, w = F.world;
    if (!who) return;
    var line = L.chatClean(p.s);
    if (!line || !L.chatAllowed(heard[who.id] = heard[who.id] || {}, Date.now())) return;
    O.logLine(who.id, who.name, line);
    if (w && w.remotes && w.remotes[who.id]) w.bubble(who.id, line);
    sfx('talk');
  };

  O.logLine = function (id, name, text) {
    O.chatLog.push({ id: id, name: name || 'Farmer', text: text, t: Date.now() });
    if (O.chatLog.length > LOG_MAX) O.chatLog.shift();
    F.bus.emit('chatline');
  };
  // What may be shown: not a farmer you blocked since.
  O.chatLines = function () { return O.chatLog.filter(function (l) { return !O.blocked[l.id]; }); };

  // ---------- the button and the panel ----------
  var W = F.UI_CONST.W;
  var BLUE = 0x4a90c9, GREEN = 0x5fa84a;
  // The small box on the left: the last few lines, gone after a while. A tap opens the Chat panel. It stands just above
  // the joystick and grows upwards: higher up it covered the bubble of a farmer near the top of the map (at the house,
  // where visitors arrive), the bar you get on a visit and the toasts.
  var BOX = { x: 8, bottom: 458 + C.EXTRA, w: 196, lines: 3, h: 16, show: 15000 };
  var PAGE = 7; // lines on a page of the Chat panel
  var U = F.UIScene.prototype;

  var uiCreate = U.create;
  U.create = function () {
    uiCreate.call(this);
    var self = this;
    // a round chat icon under Decorate (owner, 27 Oct: an icon, no word; under Decorate)
    var SIDE = this.SIDE || { x: W - 30, r: 22, chat: 320 };
    this.chatBtn = this.add.container(0, 0).setDepth(40).setVisible(false);
    this.roundButton(this.chatBtn, SIDE.x, SIDE.chat, SIDE.r, BLUE, 'chat', null, function () { self.openSay(); });
    var onChatable = function (on) {
      self.chatOn = on;
      self.showChatBtn();
      // the first time: a tip, once the "is visiting" news has been read
      if (on && !self.chatTipLater) {
        self.chatTipLater = self.time.delayedCall(5000, function () {
          self.chatTipLater = null;
          if (!self.chatOn || self.modals.length) return;
          var tip = L.takeTip(F.session.state, 'chat');
          if (tip) { F.Host.save(F.session.state); self.toast(tip, 4500, 0x2f5a22); }
        });
      }
    };
    F.bus.on('chatable', onChatable);
    this.chatBox = this.add.container(BOX.x, BOX.bottom).setDepth(30).setVisible(false);
    var redraw = function () { self.drawChatBox(); if (self.sayShow) self.sayShow(); };
    F.bus.on('chatline', redraw);
    this.events.once('shutdown', function () { F.bus.off('chatable', onChatable); F.bus.off('chatline', redraw); });
  };

  U.drawChatBox = function () {
    var self = this, box = this.chatBox, now = Date.now();
    if (!box) return;
    box.removeAll(true);
    if (this.chatBoxTimer) { this.chatBoxTimer.remove(); this.chatBoxTimer = null; }
    var lines = O.chatLines().filter(function (l) { return now - l.t < BOX.show; }).slice(-BOX.lines);
    box.setVisible(!!lines.length && !this.decorating);
    if (!lines.length) return;
    var h = lines.length * BOX.h + 8, bg = this.add.graphics();
    box.setY(BOX.bottom - h);
    bg.fillStyle(0x2e1c0c, 0.62).fillRoundedRect(0, 0, BOX.w, h, 8);
    box.add(bg);
    lines.forEach(function (l, i) {
      var me = O.me && l.id === O.me.id, y = 4 + i * BOX.h;
      var who = self.txt(7, y, l.name + ':', 11, me ? '#ffe08a' : '#a8dcff', { fontStyle: 'bold' });
      var say = self.txt(7 + who.width + 4, y, l.text, 11, '#ffffff');
      var room = BOX.w - 14 - who.width - 4;
      while (say.width > room && say.text.length > 2) say.setText(say.text.replace(/…$/, '').slice(0, -1) + '…');
      box.add([who, say]);
    });
    var z = this.add.zone(BOX.w / 2, h / 2, BOX.w, h).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { if (!self.modals.length) self.openSay(); });
    box.add(z);
    // the next line to go takes the box with it
    this.chatBoxTimer = this.time.delayedCall(Math.max(100, lines[0].t + BOX.show - now), function () {
      self.chatBoxTimer = null;
      self.drawChatBox();
    });
  };

  U.showChatBtn = function () {
    if (this.chatBtn) this.chatBtn.setVisible(!!this.chatOn && !this.decorating);
    if (this.chatBox) this.chatBox.setVisible(this.chatBox.length > 0 && !this.decorating);
  };
  var checkQuests = U.checkQuests;
  U.checkQuests = function () {
    checkQuests.call(this);
    this.showChatBtn();
  };

  // (openChat is the friends' message window: this one is openSay)
  // What was said, newest at the bottom, then what you can say. page 0 = the newest lines.
  U.openSay = function (page) {
    var self = this, c = this.openModal(), top = 84, quick = C.CHAT.quick, boxH = PAGE * 25 + 44;
    var rows = Math.ceil(quick.length / 2), h = 44 + boxH + rows * 44 + 60;
    this.panelImg(c, 24, top, W - 48, h);
    var title = this.txt(W / 2, top + 4, 'Chat', 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, top + 4, title.width + 54);
    c.add(title);
    this.closeButton(c, W - 40, top + 8, function () { self.closeModal(); });
    var hist = this.add.container(0, 0);
    c.add(hist);
    var box = this.add.graphics();
    box.fillStyle(0x7a4d26, 0.14).fillRoundedRect(38, top + 30, W - 76, boxH - 6, 10);
    hist.add(box);
    var show = function () {
      hist.list.slice(1).forEach(function (o) { o.destroy(); });
      var lines = O.chatLines(), pages = Math.max(1, Math.ceil(lines.length / PAGE)), at = Math.min(page || 0, pages - 1), end = lines.length - at * PAGE;
      if (!lines.length) hist.add(self.txt(W / 2, top + 30 + (boxH - 44) / 2, 'Nothing said yet. Say hello!\nOnly what is said while you are here shows.', 12, '#6a4a2a', { align: 'center' }).setOrigin(0.5));
      lines.slice(Math.max(0, end - PAGE), end).forEach(function (l, i) {
        var me = O.me && l.id === O.me.id, y = top + 37 + i * 25;
        var who = self.txt(48, y, l.name + ':', 12, me ? '#a0601a' : '#1f5f96', { fontStyle: 'bold' });
        var say = self.txt(48 + who.width + 5, y, l.text, 12, '#3d2614');
        while (say.width > W - 106 - who.width && say.text.length > 2) say.setText(say.text.replace(/…$/, '').slice(0, -1) + '…');
        hist.add([who, say]);
      });
      if (pages > 1) self.pager(hist, top + boxH + 2, at, pages, function (to) { page = to; show(); });
      self.sayShow = show;
    };
    show();
    c.once('destroy', function () { if (self.sayShow === show) self.sayShow = null; });
    var say = function (text) {
      var why = O.say(text);
      self.closeModal();
      if (why) self.toast(why, 2200);
    };
    quick.forEach(function (q, i) {
      var x = W / 2 + (i % 2 ? 76 : -76), y = top + 44 + boxH + Math.floor(i / 2) * 44;
      self.button(c, x, y, 140, 38, q, function () { say(q); }, GREEN);
    });
    this.button(c, W / 2, top + 44 + boxH + rows * 44 + 4, 292, 38, 'Type your own', function () {
      self.closeModal();
      self.askText('Say something', '', C.CHAT.max, function (text) {
        var why = O.say(text);
        if (why) self.toast(why, 2200);
      }, { hint: 'One line, up to ' + C.CHAT.max + ' letters. Be kind!' });
    }, BLUE);
  };

  // Decorate mode hides it (the yard bar sits there), and it comes back after
  var openDecor = U.openDecor;
  U.openDecor = function () {
    openDecor.call(this);
    this.showChatBtn();
  };
  var closeDecorBar = U.closeDecorBar;
  U.closeDecorBar = function () {
    closeDecorBar.call(this);
    this.showChatBtn();
  };
})(window.Farm = window.Farm || {});

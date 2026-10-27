// Chat bubbles (owner, 27 Oct 2026: "a mini chat when visiting friends, popping up bubbles over their heads").
// When someone else is on the same farm, a Chat button shows: pick a quick line or type your own (one line, up to
// C.CHAT.max characters) and it pops up over your farmer's head on every phone on that farm for a few seconds. Lines
// go over the farm's live room ('say' messages) and are not stored; each phone checks what it shows (L.chatClean)
// and how often one farmer may talk (L.chatAllowed). Rules in 01-logicA.js.
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
      fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '150px', fontStyle: 'bold', color: '#3d2614', align: 'center',
      wordWrap: { width: 1700 }, lineSpacing: 10,
    }).setOrigin(0.5, 1);
    var bw = t.width + 140, bh = t.height + 90, g = this.add.graphics();
    g.fillStyle(0x3d2614, 0.25).fillRoundedRect(-bw / 2 + 12, -bh - 60 + 18, bw, bh, 70);
    g.fillStyle(0xfffaf0, 1).fillRoundedRect(-bw / 2, -bh - 60, bw, bh, 70);
    g.lineStyle(22, 0x3d2614, 1).strokeRoundedRect(-bw / 2, -bh - 60, bw, bh, 70);
    g.fillStyle(0xfffaf0, 1).fillTriangle(-52, -70, 52, -70, 0, 0);
    g.lineStyle(22, 0x3d2614, 1).lineBetween(-52, -60, 0, 0).lineBetween(52, -60, 0, 0);
    t.setPosition(0, -105);
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
    // the Chat button shows while someone else is drawn on this map
    var some = !!(O.chan && w.remotes && Object.keys(w.remotes).length && !w.busy);
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
    if (w && w.bubbles) w.bubble(O.me.id, line);
    sfx('talk');
    return '';
  };

  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event !== 'say') return onMessage.call(O, event, payload);
    var p = payload && typeof payload === 'object' ? payload : {}, who = typeof p.id === 'string' ? O.others[p.id] : null, w = F.world;
    if (!who || !w || !w.remotes || !w.remotes[who.id]) return;
    var line = L.chatClean(p.s);
    if (!line || !L.chatAllowed(heard[who.id] = heard[who.id] || {}, Date.now())) return;
    w.bubble(who.id, line);
    sfx('talk');
  };

  // ---------- the button and the panel ----------
  var W = F.UI_CONST.W;
  var BLUE = 0x4a90c9, GREEN = 0x5fa84a;
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
    this.events.once('shutdown', function () { F.bus.off('chatable', onChatable); });
  };

  U.showChatBtn = function () {
    if (this.chatBtn) this.chatBtn.setVisible(!!this.chatOn && !this.decorating);
  };
  var checkQuests = U.checkQuests;
  U.checkQuests = function () {
    checkQuests.call(this);
    this.showChatBtn();
  };

  // (openChat is the friends' message window: this one is openSay)
  U.openSay = function () {
    var self = this, c = this.openModal(), top = 150, quick = C.CHAT.quick;
    var rows = Math.ceil(quick.length / 2), h = 96 + rows * 48 + 58;
    this.panelImg(c, 24, top, W - 48, h);
    var title = this.txt(W / 2, top + 4, 'Say something', 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, top + 4, title.width + 54);
    c.add(title);
    this.closeButton(c, W - 40, top + 8, function () { self.closeModal(); });
    c.add(this.txt(W / 2, top + 30, 'It pops up over your farmer for everyone here.', 12, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0));
    var say = function (text) {
      var why = O.say(text);
      self.closeModal();
      if (why) self.toast(why, 2200);
    };
    quick.forEach(function (q, i) {
      var x = W / 2 + (i % 2 ? 76 : -76), y = top + 76 + Math.floor(i / 2) * 48;
      self.button(c, x, y, 140, 40, q, function () { say(q); }, GREEN);
    });
    this.button(c, W / 2, top + 76 + rows * 48 + 6, 292, 40, 'Type your own', function () {
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

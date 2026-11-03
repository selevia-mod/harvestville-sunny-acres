// Big moments, shared (owner, 3 Nov 2026): the friends you are playing with hear when you find the ladder down, catch the
// King Trout, hunt a rare animal, or find a sparkling rock or a golden crop, as a short note on their screen. Only a key
// travels (and which animal); each phone writes the words itself, so nobody can put their own text on yours.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var GOLD = 0x7a5a12;
  var GAP = 3000; // ms: one note at a time from a friend
  var heard = {};

  var SAY = {
    ladder: function () { return 'found the ladder down!'; },
    trout: function () { return 'caught the legendary King Trout!'; },
    rare: function (p) { var a = C.WILD.animals[p.a]; return a && a.rare ? 'hunted a ' + a.name + '!' : null; },
    sparkle: function () { return 'found a sparkling rock!'; },
    golden: function () { return 'found a golden crop!'; },
  };

  var tell = function (k, extra) {
    if (O.on && O.chan && Object.keys(O.others).length) O.send('news', Object.assign({ k: k }, extra || {}));
  };

  // ---------- telling ----------
  var breakRock = P.breakRock;
  P.breakRock = function (idx, t, items) {
    var stairs = this.mine && idx === this.mine.stairs, r = breakRock.call(this, idx, t, items);
    if (r && stairs) tell('ladder');
    return r;
  };
  var rareBurst = P.rareBurst;
  P.rareBurst = function (x, y, frame, text) {
    rareBurst.call(this, x, y, frame, text);
    if (/^Sparkling rock/.test(text)) tell('sparkle');
    else if (/^Golden /.test(text)) tell('golden');
  };
  var hunted = L.hunted;
  L.hunted = function (s, area, slot, kind, size) {
    var r = hunted.apply(L, arguments);
    if (s === F.session.state && C.WILD.animals[kind] && C.WILD.animals[kind].rare) tell('rare', { a: kind });
    return r;
  };
  var startFishGame = U.startFishGame;
  U.startFishGame = function (fishId, done) {
    return startFishGame.call(this, fishId, function (ok) {
      done(ok);
      if (ok && fishId === 'fish_k') tell('trout');
    });
  };

  // ---------- hearing ----------
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event !== 'news') return onMessage.call(O, event, payload);
    var p = payload && typeof payload === 'object' ? payload : {}, who = typeof p.id === 'string' ? O.others[p.id] : null;
    var say = who && Object.prototype.hasOwnProperty.call(SAY, p.k) ? SAY[p.k](p) : null, now = Date.now();
    if (!say || !F.ui || now - (heard[p.id] || 0) < GAP) return;
    heard[p.id] = now;
    F.ui.toast(who.name + ' ' + say, 3000, GOLD);
    if (F.Audio) F.Audio.sfx('found');
  };
})(window.Farm = window.Farm || {});

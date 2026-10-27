// Your farmer's name (owner, 27 Oct 2026: "There's no way to name your character"). A new farm asks right after you
// pick your farmer; a farm from before asks once; Rename is in the pause menu. Online, it is the name over your head
// (19h-online.js O.myName). Rules in 01-logicA.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var U = F.UIScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  var WHY = { empty: 'Type a name for your farmer.', rude: "Let's keep Harvest Ville friendly. Try another name." };

  // Asks for the name (Cancel keeps the old one), then done().
  U.askFarmerName = function (done) {
    var self = this, s = F.session.state;
    var start = s.name || (F.Online && F.Online.me && F.Online.me.name) || '';
    this.askText('Name your farmer', L.cleanName(start), C.FARMER_NAME, function (text) {
      var r = L.setFarmerName(s, text);
      if (r !== 'ok') {
        sfx('nope');
        self.toast(WHY[r], 2400);
        return self.time.delayedCall(250, function () { self.askFarmerName(done); });
      }
      F.session.dirty = true;
      if (F.world && F.world.save) F.world.save();
      if (F.Online && F.Online.retrack) F.Online.retrack();
      sfx('coin');
      self.toast('Hello, ' + s.name + '!', 1800, 0x2f5a22);
      if (done) done();
    }, { hint: 'Up to ' + C.FARMER_NAME + ' letters. Friends see it over your head online.', cancel: done });
  };

  // A new farm: pick your farmer, then name them.
  var chooseLook = U.chooseLook;
  U.chooseLook = function (done) {
    var self = this;
    chooseLook.call(this, function () { self.askFarmerName(done); });
  };

  // A farm from before: asked once, when the farm is quiet.
  var P = F.WorldScene.prototype;
  var create = P.create;
  P.create = function () {
    create.call(this);
    if (this.mapKey !== 'farm' || (this.state && this.state.isVisit) || F.session.isNew || (window.gameHost && window.gameHost.quiet)) return;
    if (F.session.state.name) return;
    var self = this;
    var ask = function () {
      if (!self.sys || !self.sys.isActive() || F.session.state.name) return;
      if (self.busy || !F.ui || F.ui.modals.length || F.session.visit || document.getElementById('farm-ask')) return self.time.delayedCall(2500, ask);
      if (!L.takeTip(F.session.state, 'farmer_name')) return;
      self.save();
      F.ui.askFarmerName(null);
    };
    this.time.delayedCall(6000, ask);
  };
})(window.Farm = window.Farm || {});

// Players' suggestions on screen (owner, 2 Nov 2026; rules 01-logicG.js): the big trees of Makiling Forest, and a word when
// a friend walks you past your own deepest floor (only your own trips count for the lift, the energy and the chests).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var TREE = 'props/rainforest_tree', RESTING = 0xb8a890;

  var create = P.create;
  P.create = function () {
    create.call(this);
    var s = F.session.state, v = F.session.visit;
    this.trees = this.mapKey === 'makiling' ? this.props.filter(function (p) { return p.texture.key === TREE; }).slice(0, 8) : [];
    this.trees.forEach(function (p, i) { if (L.treeCut(s, i)) p.setTint(RESTING); });
    if (this.mapKey === 'mine' && v && F.session.mineFloor > s.stats.deepest && !v.toldFloors) {
      v.toldFloors = true;
      this.time.delayedCall(900, function () { if (F.ui) F.ui.toast('Floors count for your lift and chests when you reach them on your own.', 3800); });
    }
  };

  // The tree in front of you (its trunk), or -1.
  P.treeAhead = function () {
    var pt = this.front(0.9), found = -1;
    (this.trees || []).forEach(function (p, i) {
      if (pt.x > p.x - 0.3 * T && pt.x < p.x + p.displayWidth + 0.3 * T && pt.y > p.y - 1.6 * T && pt.y < p.y + 0.5 * T) found = i;
    });
    return found;
  };

  P.chopBigTree = function (i) {
    var self = this, s = F.session.state, r = L.chopTree(s, i), p = this.trees[i];
    if (r === 'tired') return this.tired();
    if (typeof r !== 'number') return;
    this.animateUse(L.iconOf(s, 'axe'), 'swing');
    this.time.delayedCall(this.IMPACT ? this.IMPACT.swing : 110, function () {
      sfx('chop');
      if (self.bump) self.bump(1);
      self.tweens.add({ targets: p, x: p.x + 14, duration: 45, yoyo: true, repeat: 3 });
      if (self.burst) self.burst('wood', p.x + p.displayWidth / 2, p.y - 0.6 * T, 8);
      self.floatTextAt(p.x + p.displayWidth / 2, p.y - 1.2 * T, '+' + r + ' lumber');
      p.setTint(RESTING);
      if (F.ui) F.ui.toast(L.treesLeft(s) ? 'More wood! ' + L.treesLeft(s) + (L.treesLeft(s) > 1 ? ' trees' : ' tree') + ' left to cut today.' : 'That is enough for today. The forest needs a rest.', 2000);
    });
    F.bus.emit('hud');
    this.changed();
  };

  var resolve = P.resolve;
  P.resolve = function () {
    var held = L.held(F.session.state);
    if (this.trees && this.trees.length && held && held.id === 'axe') {
      var self = this, i = this.treeAhead(), s = F.session.state, icon = L.iconOf(s, 'axe');
      if (i >= 0) {
        if (L.treeCut(s, i)) return { label: 'Chop', icon: icon, disabled: true, why: 'You cut this tree today. It needs a day to recover.' };
        if (!L.treesLeft(s)) return { label: 'Chop', icon: icon, disabled: true, why: 'You cut ' + C.WOOD.trees + ' trees today. The forest needs a rest until tomorrow.' };
        return { label: 'Chop', icon: icon, run: function () { self.chopBigTree(i); } };
      }
    }
    return resolve.call(this);
  };

  // A piece put down on a branch takes it away.
  var renderYard = P.renderYard;
  P.renderYard = function () {
    renderYard.call(this);
    if (this.mapKey === 'farm' && this.mapReady) this.refreshDebris();
  };
  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.call(this);
    this.mapReady = true;
  };
})(window.Farm = window.Farm || {});

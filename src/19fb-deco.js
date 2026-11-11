// The map's decorations a piece was put over (src/01-logicZZZ-deco.js) come off the map as the yard is drawn.
(function (F) {
  'use strict';
  var L = F.Logic, P = F.WorldScene.prototype;
  var renderYard = P.renderYard;
  P.renderYard = function () {
    var r = renderYard.apply(this, arguments);
    if (this.mapKey === 'farm' && this.deco) {
      var self = this, n = 0;
      L.decoGone(this.state).forEach(function (idx) { if (self.deco[idx]) { self.removeDeco(idx); n++; } });
      if (n) this.recollide();
    }
    return r;
  };
})(window.Farm = window.Farm || {});

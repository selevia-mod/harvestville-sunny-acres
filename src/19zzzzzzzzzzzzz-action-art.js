// The action button's own pictures and ring (owner, 8 Nov 2026; icons 00-zzzzzzzzzzzzz-action-icons.js, art
// tools/art/action-import.js). An action that had no picture (Enter, Go down, a sign's Read, Withered, Sealed) or one
// that did not fit (the Lift and the Jeep a crate, Bed a moon, the Bell gold ore, the stall a crate...) shows its own.
// The ring is the painted wooden one, greyed while there is nothing to do.
(function (F) {
  'use strict';
  var C = F.Config;
  var U = F.UIScene.prototype;
  var I = function (k) { return C.ICON[k]; };
  // [label, when (the action's own icon: null = any), the new icon]
  var ART = [
    ['Enter', null, 'act_enter'], ['Go down', null, 'act_down'], ['Withered', null, 'act_withered'], ['Sealed', null, 'act_sealed'],
    ['Lift', null, 'act_lift'], ['Jeep', null, 'act_jeep'], ['Boat', null, 'act_boat'], ['Bell', null, 'act_bell'],
    ['Bed', null, 'act_bed'], ['Station', null, 'act_train'], ['Train', null, 'act_train'], ['Talk', null, 'act_talk'],
    ['Wish', null, 'act_wish'], ['Shop', null, 'act_shop'],
    ['Read', -1, 'act_sign'], ['Board', 'calendar', 'act_board'], ['Board', -1, 'act_board'], ['Sell', 'crate', 'act_stall'],
  ];
  var pick = function (a) {
    if (!a || !a.label) return null;
    var own = a.icon == null || a.icon < 0 ? -1 : a.icon;
    for (var k = 0; k < ART.length; k++) {
      var r = ART[k];
      if (r[0] !== a.label) continue;
      if (r[1] === null || (r[1] === -1 && own === -1) || (typeof r[1] === 'string' && own === I(r[1]))) return I(r[2]);
    }
    return null;
  };
  F.actionArt = pick; // (the tests)
  var setHint = U.setHint;
  U.setHint = function (a) {
    var icon = pick(a);
    setHint.call(this, icon != null ? Object.assign({}, a, { icon: icon }) : a);
    // the painted ring, when it is there
    if (F.images && F.images['props/action_ring'] && this.actionRing) {
      var on = !!a && !a.disabled, r = 42; // (12-ui.js ACTION.r)
      if (this.actionRing.texture.key !== 'props/action_ring') this.actionRing.setTexture(F.ensureTexture(this, 'props/action_ring'));
      this.actionRing.setDisplaySize(r * 2 + 8, r * 2 + 8);
      if (on) this.actionRing.clearTint(); else this.actionRing.setTint(0xb8b0a4);
    }
  };
})(window.Farm = window.Farm || {});

// The action button's own pictures (owner, 8 Nov 2026: "improve the design of this and the art showing inside that
// circle"; prompts art-src/ACTION-ICONS-PROMPTS.md, in by tools/art/action-import.js). Appended to the icons after
// every other (nothing moves); which action shows which: 19zzzzzzzzzzzzz-action-art.js.
(function (F) {
  'use strict';
  var C = F.Config;
  C.ACTION_ICONS = ['act_enter', 'act_down', 'act_sign', 'act_withered', 'act_lift', 'act_jeep', 'act_boat', 'act_bell',
    'act_board', 'act_bed', 'act_stall', 'act_shop', 'act_train', 'act_talk', 'act_sealed', 'act_wish'];
  C.ACTION_ICONS.forEach(function (n) { if (C.ICON_ORDER.indexOf(n) < 0) C.ICON_ORDER.push(n); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
})(window.Farm = window.Farm || {});

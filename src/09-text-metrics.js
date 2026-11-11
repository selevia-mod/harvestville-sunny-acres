// Font measurements once per font (owner, 11 Nov 2026: "online menu, it feels like a bit heavy"; measured on the OPPO).
// Every new Phaser Text measured its font from scratch: it draws a test string on a canvas and reads the pixels back
// (Phaser's MeasureText), which is slow on a phone, and a panel of 30 rows makes a hundred texts. The answer depends only
// on the font (style, size, family), the test string and the baseline factors, so it is kept per font and handed to
// Phaser as the style's `metrics` (Phaser's own way to skip the measuring). Nothing looks different.
(function () {
  'use strict';
  if (!window.Phaser || !Phaser.GameObjects || !Phaser.GameObjects.TextStyle) return;
  var TS = Phaser.GameObjects.TextStyle.prototype, cache = {}, defTest = null; // (Phaser's own test string, read from the first text)
  var keyOf = function (fontStyle, fontSize, fontFamily, test, bx, by) {
    return [fontStyle, fontSize, fontFamily].join(' ').trim() + '|' + test + '|' + bx + '|' + by;
  };
  var mine = function (ts) { return keyOf(ts.fontStyle, ts.fontSize, ts.fontFamily, ts.testString, ts.baselineX, ts.baselineY); };
  var keep = function (ts) { if (ts.metrics) cache[mine(ts)] = { ascent: ts.metrics.ascent, descent: ts.metrics.descent, fontSize: ts.metrics.fontSize }; };
  var pick = function (style, k, own, def, setDefaults) { return style && style[k] !== undefined ? style[k] : setDefaults ? def : own; };
  var setStyle = TS.setStyle;
  TS.setStyle = function (style, updateText, setDefaults) {
    if (style && !style.metrics && !style.font && (defTest !== null || style.testString !== undefined)) {
      var size = pick(style, 'fontSize', this.fontSize, '16px', setDefaults);
      if (typeof size === 'number') size += 'px';
      var k = keyOf(pick(style, 'fontStyle', this.fontStyle, '', setDefaults), size, pick(style, 'fontFamily', this.fontFamily, 'Courier', setDefaults),
        pick(style, 'testString', this.testString, defTest, setDefaults), pick(style, 'baselineX', this.baselineX, 1.2, setDefaults), pick(style, 'baselineY', this.baselineY, 1.4, setDefaults));
      var m = cache[k];
      if (m) {
        var s2 = {}; for (var p in style) s2[p] = style[p];
        s2.metrics = { ascent: m.ascent, descent: m.descent, fontSize: m.fontSize };
        style = s2;
      }
    }
    var r = setStyle.call(this, style, updateText, setDefaults);
    if (defTest === null && setDefaults && !(style && style.testString !== undefined)) defTest = this.testString;
    keep(this);
    return r;
  };
  var update = TS.update;
  TS.update = function (recalc) {
    if (recalc) {
      this._font = [this.fontStyle, this.fontSize, this.fontFamily].join(' ').trim();
      var m = cache[mine(this)];
      if (m) { this.metrics = { ascent: m.ascent, descent: m.descent, fontSize: m.fontSize }; return this.parent.updateText(); }
      var r = update.call(this, recalc);
      keep(this);
      return r;
    }
    return update.call(this, recalc);
  };
  window.Farm = window.Farm || {};
  window.Farm.textMetricsCache = cache; // (tests)
})();

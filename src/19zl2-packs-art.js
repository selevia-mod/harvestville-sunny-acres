// Pictures from packs that are drawn in places everyone goes (6 Nov 2026: the page was 19.46 MB of the 19.5 MiB Android
// opens, so the furniture styles past Classic and their sleeping-in-bed pictures went into the Furniture styles pack,
// tools/packs.js). A piece of a style whose sheet is not in yet shows as the same piece in Classic, and the bed with you
// asleep in it as Classic's; the sheet is asked for (F.needImage, 10b-packs.js: from the phone, or downloaded first)
// and swapped in when it comes: in the house, in the bed, and in the lists (Mira's catalog, Storage, the wagon...).
// Your own house's styles are asked for as soon as a map opens, so they are in before you walk home.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var missing = function (key) { return !(F.images && F.images[key]) && !!F.packedFile(key); };

  // ---------- stand-ins ----------
  var furnTexture = F.furnTexture;
  F.furnTexture = function (scene, v) {
    if (v && missing('furn_' + v)) {
      F.needImage('furn_' + v);
      return furnTexture(scene, 0); // (the same frames: one per kind of furniture)
    }
    return furnTexture(scene, v);
  };
  var furnTurnTexture = F.furnTurnTexture; // (a style's turned pieces: Classic's until its sheet is in)
  F.furnTurnTexture = function (scene, v) {
    if (v && missing('furnturn_' + v)) {
      F.needImage('furnturn_' + v);
      return furnTurnTexture(scene, 0);
    }
    return furnTurnTexture(scene, v);
  };
  // a style's bed with you in it -> Classic's (props/sleepbed[2]_v<style>_<who> -> props/sleepbed[2]_<who>)
  var STAND_IN = /^(props\/sleepbed2?_)v\d+_(boy|girl)$/;
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    if (STAND_IN.test(key) && missing(key)) {
      F.needImage(key);
      return ensureTexture(scene, key.replace(STAND_IN, '$1$2'));
    }
    return ensureTexture(scene, key);
  };
  var bedKey = function (s, it) { // (as 19o-sleep.js names it)
    var type = H.types[it.t], who = s.look === 'girl' ? 'girl' : 'boy', bed = { bed: 'props/sleepbed_', double_bed: 'props/sleepbed2_' }[type.key];
    return bed && it.v ? bed + 'v' + it.v + '_' + who : null;
  };

  // ---------- your own house's, early ----------
  var own = function () {
    var s = F.session && F.session.state;
    if (!s || !s.home || !F.canFetch()) return;
    var want = {};
    (s.home.items || []).forEach(function (it) {
      if (!H.types[it.t] || !it.v) return;
      want['furn_' + it.v] = true;
      var b = bedKey(s, it);
      if (b) want[b] = true;
    });
    Object.keys(want).forEach(function (k) { if (missing(k)) F.needImage(k); });
  };
  var create = P.create;
  P.create = function () {
    if (!(F.session && F.session.visit)) own();
    return create.apply(this, arguments);
  };

  // ---------- swapped in when it comes ----------
  var listRow = U.listRow;
  U.listRow = function (c, y, row) {
    var r = listRow.apply(this, arguments), img = row && row.img;
    if (img && img.furn && missing('furn_' + img.furn) && c && c.list) {
      for (var i = c.list.length - 1; i >= 0; i--) {
        var o = c.list[i];
        if (o.type === 'Image' && o.texture && o.texture.key === 'furn_0' && o.frame && o.frame.name === img.frame) {
          (this.furnWaiting = this.furnWaiting || []).push({ o: o, v: img.furn, t: img.frame });
          break;
        }
      }
    }
    return r;
  };
  // (a tile's picture too: Mira's catalog is tiles since 8 Nov 2026)
  var tilePicture = U.tilePicture;
  U.tilePicture = function (row, x, y, size) {
    var im = tilePicture.apply(this, arguments), img = row && row.img;
    if (im && img && img.furn && missing('furn_' + img.furn)) (this.furnWaiting = this.furnWaiting || []).push({ o: im, v: img.furn, t: img.frame, size: size });
    return im;
  };
  F.bus.on('packart', function (key) {
    var w = F.world, ui = F.ui, m = /^furn_(\d+)$/.exec(key), v = m ? Number(m[1]) : null;
    // a style's turned pieces in the house (19d-home.js: F.furnTurnTexture)
    var mt = /^furnturn_(\d+)$/.exec(key), vt = mt ? Number(mt[1]) : null;
    if (vt != null && w && w.sys && w.sys.isActive() && w.state && w.mapKey === 'house' && w.homeSprites && L.furnView) {
      var its = (w.state.home && w.state.home.items) || [];
      w.homeSprites.forEach(function (img, i) {
        var it = its[i], type = it && H.types[it.t], view = it && L.furnView(it.t, it.f);
        if (!img || !img.active || !type || !view || it.v !== vt || img.texture.key === key) return;
        img.setTexture(F.furnTurnTexture(w, vt), view.frame).setDisplaySize(type.w * T, type.h * T);
      });
    }
    if (w && w.sys && w.sys.isActive() && w.state) {
      if (v != null && w.mapKey === 'house' && w.homeSprites) {
        var items = (w.state.home && w.state.home.items) || [];
        w.homeSprites.forEach(function (img, i) {
          var it = items[i], type = it && H.types[it.t];
          if (!img || !img.active || !type || it.v !== v || img.texture.key === key) return;
          img.setTexture(F.furnTexture(w, v), it.t).setDisplaySize(type.w * T, type.h * T);
        });
      }
      var z = w.sleeping, bed = z && w.sleepBed && w.sleepBed(), type2 = bed && H.types[bed.t];
      if (z && z.img && z.img.active && type2 && bedKey(w.state, bed) === key && z.img.texture.key !== key) {
        z.img.setTexture(F.ensureTexture(w, key)).setDisplaySize(type2.w * T, type2.h * T);
      }
    }
    if (v != null && ui && ui.furnWaiting) {
      ui.furnWaiting = ui.furnWaiting.filter(function (q) {
        if (!q.o.active || !q.o.scene) return false;
        if (q.v !== v) return true;
        q.o.setTexture(F.furnTexture(ui, v), q.t); // (its frame is the same size: the scale stays)
        if (q.size) q.o.setScale(q.size / Math.max(q.o.width, q.o.height)); // (a tile's: fitted again)
        return false;
      });
    }
  });
})(window.Farm = window.Farm || {});

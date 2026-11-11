// Pictures out of the page that a place can do without for a moment (12 Nov 2026: Manila, the horse out and the weapons
// took the page past its 19.5 MiB; tools/packs.js 'lair' and 'park'). A place's pack is taken in on the way there when it
// is on the phone (a moment), and when the game opens there (19zl-packs-ui.js asks F.softPacks); else its pictures are
// fetched as you go and their stand-ins show until they come (the Lair's own drawn mouth and gate, 19zt-lair.js; a drawn
// building for a map's prop, below), then each takes its place where it stands. Offline with nothing on the phone, the
// stand-ins stay: you still go everywhere.
(function (F) {
  'use strict';
  var P = F.WorldScene.prototype;
  var SOFT = { magayon: 'lair', lair: 'lair', park: 'park' }; // a map -> the pack it shows pictures from
  var real = function (key) { return !!(F.images && F.images[key]); };
  var has = function (p) { return !!(p && F.packFiles && F.packFiles(p).length); };
  var fetchAll = function (p) {
    if (!F.needImage || !F.canFetch || !F.canFetch()) return;
    F.packFiles(p).forEach(function (f) { if (f.key && !real(f.key)) F.needImage(f.key); });
  };

  // ---------- opening the game there ----------
  var soft = F.softPacks;
  F.softPacks = function (map) {
    var out = soft ? soft(map) : [], p = SOFT[map];
    return has(p) && out.indexOf(p) < 0 ? out.concat([p]) : out;
  };

  // ---------- going there ----------
  var WAIT = 4000; // (a phone that does not answer in time: in you go, with the stand-ins)
  var travel = P.travel;
  P.travel = function (to) {
    var p = SOFT[to], self = this, args = arguments;
    if (has(p) && !this.busy && !F.packReady(p)) {
      if (F.packOnPhone(p)) {
        if (this.softGate) return;
        this.softGate = true;
        var went = false, go = function () {
          if (went) return;
          went = true;
          self.softGate = false;
          if (self.sys && self.sys.isActive()) travel.apply(self, args);
        };
        setTimeout(go, WAIT);
        return F.loadPack(p).then(go);
      }
      fetchAll(p);
    }
    return travel.apply(this, arguments);
  };

  // ---------- a map's prop whose picture is not in yet ----------
  // A plain building drawn under the picture's own name (so everything that looks for it by name finds it), the size the
  // map gives it; replaced by the picture when it comes.
  var standing = {}; // key -> the stand-in texture while it is the one under that name
  var isStandIn = function (scene, key) { return !!standing[key] && scene.textures.exists(key) && scene.textures.get(key) === standing[key]; };
  var drawStandIn = function (scene, key, w, h) {
    var W = 256, H = Math.max(64, Math.round(W * h / Math.max(1, w))), c = scene.textures.createCanvas(key, W, H), g = c.getContext();
    var line = '#5a3a1e', X = function (k) { return Math.round(W * k); }, Y = function (k) { return Math.round(H * k); };
    g.lineJoin = 'round';
    g.lineWidth = 4;
    g.fillStyle = 'rgba(30,20,10,0.25)';
    g.beginPath();
    g.ellipse(X(0.5), Y(0.95), X(0.44), Y(0.05), 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e9dcc0';
    g.strokeStyle = line;
    g.fillRect(X(0.1), Y(0.42), X(0.8), Y(0.54));
    g.strokeRect(X(0.1), Y(0.42), X(0.8), Y(0.54));
    g.fillStyle = '#9c4a32';
    g.beginPath();
    g.moveTo(X(0.03), Y(0.45));
    g.lineTo(X(0.5), Y(0.06));
    g.lineTo(X(0.97), Y(0.45));
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#6b4424';
    g.fillRect(X(0.43), Y(0.7), X(0.14), Y(0.26));
    g.strokeRect(X(0.43), Y(0.7), X(0.14), Y(0.26));
    g.fillStyle = '#f7e7a1';
    [0.2, 0.66].forEach(function (x) { g.fillRect(X(x), Y(0.54), X(0.14), Y(0.13)); g.strokeRect(X(x), Y(0.54), X(0.14), Y(0.13)); });
    c.refresh();
    standing[key] = c;
  };
  var addProp = P.addProp;
  P.addProp = function (name, o) {
    var key = 'props/' + name, tex = this.textures;
    if (real(key) && isStandIn(this, key)) { tex.remove(key); delete standing[key]; } // (it came while you were elsewhere)
    if (!real(key) && F.packedFile && F.packedFile(key)) {
      if (!tex.exists(key)) drawStandIn(this, key, o.width, o.height);
      if (F.needImage) F.needImage(key);
    }
    var r = addProp.apply(this, arguments), img = this.props[this.props.length - 1];
    if (img && isStandIn(this, key) && img.texture === standing[key]) img.softSize = [o.width, o.height];
    return r;
  };
  F.bus.on('packart', function (key) {
    var w = F.world;
    if (!standing[key] || !real(key) || !w || !w.textures) return;
    if (!isStandIn(w, key)) { delete standing[key]; return; }
    var was = standing[key], imgs = (w.props || []).filter(function (img) { return img.active && img.texture === was; });
    w.textures.remove(key);
    delete standing[key];
    F.ensureTexture(w, key);
    imgs.forEach(function (img) { var sz = img.softSize || [img.displayWidth, img.displayHeight]; img.setTexture(key).setDisplaySize(sz[0], sz[1]); });
  });
})(window.Farm = window.Farm || {});

// Packs: art downloaded when it is needed, not carried in the page (owner, 3 Nov 2026: "users need to download assets to
// see the skin, or they can download it while playing", like Mobile Legends). Which art is in which pack: tools/packs.js
// (build.js leaves it out of the page: F.ASSETS.packs holds each file's name and size). The Tailor Shop's looks are a
// pack too (19zj-looks.js). The page never goes online itself: it asks the app (window.gameHost):
//   gameHost.asset(file, save)   save true: download it to the phone only; false: also send it here
//   window.__gameAsset(file, dataUrl or null)   the answer to a load
//   window.__gameAssetSaved(file, ok)            the answer to a save
//   gameHost.here                                 the files already on the phone when the game opened
// On screen: 19zl-packs-ui.js. With no app (a preview in a browser) nothing can be fetched: the packs stay closed.
(function (F) {
  'use strict';
  var C = F.Config;
  var host = function () { return window.gameHost || {}; };
  var FILE = /^(packs\/[a-z0-9_-]{1,40}\.[0-9a-f]{8}|looks\/v1\/[a-z]{2,12}-(boy|girl)(-archer)?)$/;
  var WAIT = 30000; // an answer that never comes is given up on

  var LOOK_FILES = function () { return Object.keys((F.ASSETS && F.ASSETS.lookBytes) || {}).sort(); };
  // A pack: what players see, and its files: [{ file, bytes, key (an image in the page), look (a look sheet) }]
  F.PACK_INFO = {
    wild: { name: 'Wild Lands', icon: 'bow', desc: 'Pulag, Makiling and Magayon: the wild animals, Kanor and the bow.', need: true },
    party: { name: 'Birthday', icon: 'gift', desc: 'Your farmer in a party hat on your birthday.' },
    looks: { name: 'Costumes', icon: 'ribbon', desc: 'The Tailor Shop looks, for you and for friends who wear them.' },
    styles: { name: 'Furniture styles', icon: 'lumber', desc: "Mira's furniture styles past Classic, and their beds, for your house and friends' houses." },
    // (owner, 6 Nov 2026: the five new hunting places' own pictures; tools/places/places-art.js)
    places: { name: 'Hunting places', icon: 'bow', desc: "Banaue, the Chocolate Hills, Taal, the Sierra Madre and Palawan: their people, animals and dungeons.", need: true },
    // (owner, 10 Nov 2026: a costume's farmer on the horse; 19-extras.js fetches one when it is first ridden in)
    raiders: { name: 'Raiders', icon: 'ribbon', desc: 'The raiders running, attacking and carrying loot in every direction.' },
    riding: { name: 'Riding costumes', icon: 'ribbon', desc: 'Your farmer riding the horse in each Tailor Shop look.' },
  };
  F.packFiles = function (pack) {
    if (pack === 'looks') return LOOK_FILES().map(function (n) { return { file: 'looks/v1/' + n, bytes: F.ASSETS.lookBytes[n], look: n }; });
    var p = (F.ASSETS && F.ASSETS.packs && F.ASSETS.packs[pack]) || {};
    return Object.keys(p).map(function (k) { return { file: p[k].file, bytes: p[k].bytes, key: k }; });
  };
  F.packBytes = function (pack) { return F.packFiles(pack).reduce(function (a, f) { return a + (f.bytes || 0); }, 0); };
  // what is still to come down (a pack that gained a picture or two since it was downloaded)
  F.packBytesLeft = function (pack) { return F.packFiles(pack).reduce(function (a, f) { return a + (here[f.file] ? 0 : f.bytes || 0); }, 0); };
  F.canFetch = function () { return typeof host().asset === 'function'; };

  // ---------- the phone's copy ----------
  var here = {};
  (Array.isArray(host().here) ? host().here : []).forEach(function (f) { if (FILE.test(f)) here[f] = true; });
  F.onPhone = function (file) { return !!here[file]; };
  F.packOnPhone = function (pack) { var fs = F.packFiles(pack); return fs.length > 0 && fs.every(function (f) { return here[f.file]; }); };
  F.packCount = function (pack) { return F.packFiles(pack).filter(function (f) { return here[f.file]; }).length; };

  // ---------- asking the app ----------
  var waiting = {}; // file -> { save: [resolve], load: [resolve], timer }
  var ask = function (file, save) {
    return new Promise(function (resolve) {
      if (!FILE.test(file) || !F.canFetch()) return resolve(null);
      var w = waiting[file] = waiting[file] || { save: [], load: [] };
      var first = !w.save.length && !w.load.length;
      (save ? w.save : w.load).push(resolve);
      clearTimeout(w.timer);
      w.timer = setTimeout(function () { answer(file, null, true); }, WAIT);
      if (first || !save) { try { host().asset(file, !!save); } catch (e) { answer(file, null, true); } }
    });
  };
  var answer = function (file, url, both) {
    var w = waiting[file];
    if (!w) return;
    var load = w.load, save = both ? w.save : [];
    w.load = [];
    if (both) w.save = [];
    if (!w.load.length && !w.save.length) { clearTimeout(w.timer); delete waiting[file]; }
    load.forEach(function (r) { r(url); });
    save.forEach(function (r) { r(!!url); });
  };
  window.__gameAsset = function (file, url) {
    file = String(file || '');
    var ok = typeof url === 'string' && url.indexOf('data:image/') === 0;
    if (ok) here[file] = true;
    answer(file, ok ? url : null, true);
    F.bus.emit('packs');
  };
  window.__gameAssetSaved = function (file, ok) {
    file = String(file || '');
    if (ok) here[file] = true;
    var w = waiting[file];
    if (w) { var save = w.save; w.save = []; save.forEach(function (r) { r(!!ok); }); if (!w.load.length) { clearTimeout(w.timer); delete waiting[file]; } }
    F.bus.emit('packs');
  };

  // A file into the page: a picture (like the ones built in), or a data URL for a look (19zj-looks.js adds it).
  var decode = function (url) {
    return new Promise(function (resolve) { var i = new Image(); i.onload = function () { resolve(i); }; i.onerror = function () { resolve(null); }; i.src = url; });
  };
  F.fetchFile = function (f) {
    if (f.key && F.images && F.images[f.key]) return Promise.resolve(true);
    return ask(f.file, false).then(function (url) {
      if (!url) return null;
      if (!f.key) return url;
      return decode(url).then(function (img) { if (!img) return null; F.images[f.key] = img; (F.packUrls = F.packUrls || {})[f.key] = url; return true; });
    });
  };
  F.saveFile = function (f) { return here[f.file] ? Promise.resolve(true) : ask(f.file, true); };

  // ---------- one picture of a pack, when something wants it ----------
  // (a furniture style's sheet when its piece is drawn: 19zl2-packs-art.js shows Classic's meanwhile.) From the phone, or
  // downloaded first. Resolves true when it is in F.images; then 'packart' (its key) on the bus.
  var byKey = null;
  F.packedFile = function (key) {
    if (!byKey) {
      byKey = {};
      var ps = (F.ASSETS && F.ASSETS.packs) || {};
      Object.keys(ps).forEach(function (p) { Object.keys(ps[p]).forEach(function (k) { byKey[k] = { file: ps[p][k].file, bytes: ps[p][k].bytes, key: k, pack: p }; }); });
    }
    return byKey[key] || null;
  };
  var wanted = {};
  F.needImage = function (key) {
    if (F.images && F.images[key]) return Promise.resolve(true);
    var f = F.packedFile(key);
    if (!f || !F.images || !F.canFetch()) return Promise.resolve(false);
    if (!wanted[key]) {
      wanted[key] = F.fetchFile(f).then(function (ok) {
        delete wanted[key];
        if (ok) F.bus.emit('packart', key);
        return !!ok;
      });
    }
    return wanted[key];
  };

  // ---------- whole packs ----------
  F.packReady = function (pack) {
    var fs = F.packFiles(pack);
    return fs.length > 0 && fs.every(function (f) { return f.key && F.images && F.images[f.key]; });
  };
  // Into the page (from the phone, or downloading first). Resolves true when every picture is in.
  F.loadPack = function (pack) {
    if (F.packReady(pack)) return Promise.resolve(true);
    var fs = F.packFiles(pack).filter(function (f) { return f.key; });
    return Promise.all(fs.map(F.fetchFile)).then(function (r) { F.bus.emit('packs'); return r.every(Boolean); });
  };
  // Onto the phone, one file after another so the bar moves evenly. Resolves true when all of it is there.
  var running = {};
  F.packProgress = function (pack) { return running[pack] || null; }; // { done, total } while downloading
  F.downloadPack = function (pack) {
    if (running[pack]) return running[pack].promise;
    var fs = F.packFiles(pack).filter(function (f) { return !here[f.file]; }), r = running[pack] = { done: 0, total: fs.length };
    F.bus.emit('packs');
    r.promise = fs.reduce(function (chain, f) {
      return chain.then(function (ok) { return F.saveFile(f).then(function (got) { r.done++; F.bus.emit('packs'); return ok && got; }); });
    }, Promise.resolve(true)).then(function (ok) { delete running[pack]; F.bus.emit('packs'); return ok && F.packOnPhone(pack); });
    return r.promise;
  };
  F.anyDownloading = function () { return Object.keys(running).length > 0; };

  // On a birthday, the party hat: a small pack fetched as soon as it is wanted (and the farmer's own clothes meanwhile).
  var sheetFor = F.sheetFor;
  F.sheetFor = function (look, party) {
    var key = sheetFor(look, party);
    if (!party || (F.images && F.images[key])) return key;
    if (F.canFetch() && !F.partyAsked) { F.partyAsked = true; F.loadPack('party').then(function (ok) { if (ok) F.bus.emit('look', key); }); }
    return sheetFor(look, false);
  };
  void C;
})(window.Farm = window.Farm || {});

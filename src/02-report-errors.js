// Error reports (owner, 22 Nov 2026: "Yes proceed to 1 and 2"): when the game breaks on a player's phone, one short note
// goes to the server through the app (public.farm_error_v1, supabase/farm_errors.sql): what broke, on which map and
// screen, which build (F.BUILD, stamped by build.js). The player sees nothing, and nothing here can stop the game.
// At most 5 different errors a game session, each sent once. Without the app's connection (the tests, a plain browser)
// nothing is sent at all.
// Read them: select day, build, version, platform, map, screen, msg, n, users from farm.errors order by day desc, n desc;
(function (F) {
  'use strict';
  var MAX = 5, sent = {}, count = 0;
  // the page's address out of the stack ("page:41892:33"): the line is the built page's, dist/index.html of that build
  var clean = function (s, n) { return String(s == null ? '' : s).replace(/(?:file|https?|blob):\/\/[^\s):]*/g, 'page').replace(/about:blank/g, 'page').slice(0, n); };
  var where = function () { try { return F.world && F.world.mapKey ? String(F.world.mapKey) : ''; } catch (e) { return ''; } };
  var screen = function () { // the first words of the panel on top (its title)
    try {
      var m = F.ui && F.ui.modals && F.ui.modals[F.ui.modals.length - 1], t = '';
      var walk = function (l) { l.forEach(function (o) { if (!t && o && o.type === 'Text' && o.text && o.text.trim()) t = o.text; if (!t && o && o.list) walk(o.list); }); };
      if (m && m.c && m.c.list) walk(m.c.list);
      return t.replace(/\s+/g, ' ').slice(0, 80);
    } catch (e) { return ''; }
  };
  var platform = function () { var u = (window.navigator && navigator.userAgent) || ''; return /iPhone|iPad|iPod/.test(u) ? 'ios' : /Android/.test(u) ? 'android' : 'other'; };
  var send = function (r, tries) {
    try {
      if (!F.Net || !F.Net.available || !F.Net.available()) { if (tries < 3) setTimeout(function () { send(r, tries + 1); }, 5000); return; }
      var p = F.Net.rpc('farm_error_v1', r);
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* (never a second error from the first) */ }
  };
  // Also for a caught error worth knowing about: F.reportError(e.message, e.stack). True when it goes.
  F.reportError = function (msg, stack) {
    try {
      msg = clean(msg, 300);
      if (!msg || /^(Uncaught )?(Error: )?(offline|not allowed|not signed in|failed)$/i.test(msg)) return false; // (no connection: not a bug)
      stack = clean(stack, 1500);
      var key = msg + '|' + (stack.split('\n')[1] || stack.split('\n')[0] || '');
      if (sent[key] || count >= MAX) return false;
      sent[key] = 1;
      count++;
      send({
        p_msg: msg, p_stack: stack, p_map: where(), p_screen: screen(), p_build: String(F.BUILD || ''),
        p_version: String((F.Config && F.Config.NEWS_LATEST) || ''), p_platform: platform(),
      }, 0);
      return true;
    } catch (e) { return false; }
  };
  window.addEventListener('error', function (e) {
    if (!e || !e.message) return; // (a picture that did not load: not an error of the game's)
    F.reportError(e.message, (e.error && e.error.stack) || (e.filename ? e.filename + ':' + e.lineno + ':' + e.colno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    if (r == null) return;
    F.reportError(r && r.message ? r.message : String(r), (r && r.stack) || '');
  });
})(window.Farm = window.Farm || {});

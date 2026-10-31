// The connection to the online world. The game itself makes no network calls: the app it runs in (the Selebox
// app) does them with its own signed-in account, through window.gameHost.net (see bridge/ for the app's side):
//   session()             -> the signed-in user's id, or null
//   rpc(name, args)       -> the result of one of the public.farm_*_v1 functions (supabase/farm_online.sql)
//   join(topic, me, on)   -> a live channel ('farm:<farm id>'): on.presence(list of the others' states) and
//                            on.message(event, payload); returns { track(state), send(event, payload), leave() }
// Without gameHost.net (opened on its own, or an app that does not offer it) online play stays off.
(function (F) {
  'use strict';

  var host = function () { return window.gameHost && window.gameHost.net; };

  var Net = F.Net = {
    mode: 'off',
    uid: null,

    init: function () {
      this.mode = host() ? 'host' : 'off';
    },
    available: function () { return this.mode !== 'off'; },

    session: function () {
      var self = this;
      if (!this.available()) return Promise.resolve(null);
      return Promise.resolve(host().session()).then(function (id) { self.uid = id ? String(id) : null; return self.uid; });
    },

    rpc: function (name, args) {
      if (!this.available()) return Promise.reject(new Error('offline'));
      return Promise.resolve(host().rpc(name, args || {}));
    },

    join: function (topic, me, on) {
      if (!this.available()) return null;
      // (a live message that times out is only a missed message: nothing waits on it)
      var c = host().join(topic, me, on), quiet = function (r) { if (r && r.catch) r.catch(function () {}); return r; };
      // Presence says who is here; the moves say where. A phone that updates it often has its line closed by the server
      // (31 Oct: every stop sent one, so Eliska vanished, jumped and "went home"), so the newest waits its turn.
      var last = Date.now(), next = null, timer = null;
      var turn = function () {
        var wait = last + F.Config.ONLINE.trackEvery - Date.now();
        timer = null;
        if (wait > 0) timer = setTimeout(turn, Math.min(wait, 1000));
        else { last = Date.now(); quiet(c.track(next)); }
      };
      return {
        track: function (s) { next = s; if (!timer) turn(); },
        send: function (e, p) { return quiet(c.send(e, p)); },
        leave: function () { clearTimeout(timer); timer = null; return quiet(c.leave()); },
      };
    },
  };
})(window.Farm = window.Farm || {});

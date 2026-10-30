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
      return { track: function (s) { return quiet(c.track(s)); }, send: function (e, p) { return quiet(c.send(e, p)); }, leave: function () { return quiet(c.leave()); } };
    },
  };
})(window.Farm = window.Farm || {});

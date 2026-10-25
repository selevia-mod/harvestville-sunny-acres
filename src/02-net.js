// The connection to the online world, one interface over two transports:
//  * Supabase (C.ONLINE.url and key filled in, and the supabase-js client bundled by build.js), or
//  * the host's own transport (window.gameHost.net: a native app's bridge, or the tests' stand-in server).
// rpc(name, args) calls the public.farm_*_v1 functions (supabase/farm_online.sql); join(topic, me, on) opens a
// live channel ('farm:<farm id>') with presence (who is here) and broadcasts (moves, emotes).
(function (F) {
  'use strict';
  var C = F.Config;
  var sb = null; // the Supabase client

  var Net = F.Net = {
    mode: 'off',
    uid: null,

    init: function () {
      var cfg = C.ONLINE, host = window.gameHost && window.gameHost.net;
      if (host) this.mode = 'host';
      else if (cfg.url && cfg.key && window.supabase && window.supabase.createClient) {
        sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
        this.mode = 'supabase';
      }
    },
    available: function () { return this.mode !== 'off'; },

    // The signed-in user's id if there is a saved session, else null.
    session: function () {
      var self = this;
      if (this.mode === 'host') return Promise.resolve(window.gameHost.net.session()).then(function (id) { self.uid = id || null; return self.uid; });
      if (this.mode !== 'supabase') return Promise.resolve(null);
      return sb.auth.getSession().then(function (r) { self.uid = r.data && r.data.session ? r.data.session.user.id : null; return self.uid; });
    },

    // kind 'guest' (an anonymous account) or 'account' (email and password of an existing account).
    signIn: function (kind, email, password) {
      var self = this;
      if (this.mode === 'host') return Promise.resolve(window.gameHost.net.signIn(kind, email, password)).then(function (id) { self.uid = id; return id; });
      if (this.mode !== 'supabase') return Promise.reject(new Error('Online play is not switched on yet.'));
      var p = kind === 'guest' ? sb.auth.signInAnonymously() : sb.auth.signInWithPassword({ email: email, password: password });
      return p.then(function (r) {
        if (r.error) throw new Error(r.error.message);
        self.uid = r.data.user.id;
        return self.uid;
      });
    },

    signOut: function () {
      this.uid = null;
      if (this.mode === 'host') return Promise.resolve(window.gameHost.net.signOut && window.gameHost.net.signOut());
      if (this.mode === 'supabase') return sb.auth.signOut();
      return Promise.resolve();
    },

    rpc: function (name, args) {
      if (this.mode === 'host') return Promise.resolve(window.gameHost.net.rpc(name, args || {}));
      if (this.mode !== 'supabase') return Promise.reject(new Error('offline'));
      return sb.rpc(name, args || {}).then(function (r) {
        if (r.error) throw new Error(r.error.message);
        return r.data;
      });
    },

    // A live channel. on: { presence(list of the others' states), message(event, payload) }.
    // Returns { track(state), send(event, payload), leave() }.
    join: function (topic, me, on) {
      if (this.mode === 'host') return window.gameHost.net.join(topic, me, on);
      if (this.mode !== 'supabase') return null;
      var uid = this.uid;
      var ch = sb.channel(topic, { config: { private: true, broadcast: { self: false }, presence: { key: uid } } });
      ch.on('presence', { event: 'sync' }, function () {
        var st = ch.presenceState(), list = [];
        Object.keys(st).forEach(function (k) { if (k !== uid && st[k][0]) list.push(st[k][0]); });
        on.presence(list);
      });
      ch.on('broadcast', { event: '*' }, function (m) { on.message(m.event, m.payload); });
      var state = me;
      ch.subscribe(function (status) { if (status === 'SUBSCRIBED') ch.track(state); });
      return {
        track: function (s) { state = s; return ch.track(s); },
        send: function (event, payload) { return ch.send({ type: 'broadcast', event: event, payload: payload }); },
        leave: function () { return sb.removeChannel(ch); },
      };
    },
  };
})(window.Farm = window.Farm || {});

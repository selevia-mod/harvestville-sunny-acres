// A stand-in for the online world, for the end-to-end tests: the same answers as the database functions in
// supabase/farm_online.sql (kept in memory) and live channels with presence and broadcasts, shared by every
// page that is connected to it. Each page reaches it through window.gameHost.net (see netScript below).
const crypto = require('crypto');

function createServer() {
  const db = { players: new Map(), snaps: new Map(), visits: [], friends: [], messages: [], scores: new Map(), msgId: 0 };
  const channels = new Map(); // topic -> Map(client:hid -> member)
  const today = () => new Date().toISOString().slice(0, 10);
  const online = (p) => Date.now() - p.seen < 2 * 60 * 1000;
  const pair = (a, b) => (a < b ? [a, b] : [b, a]);
  const friendRow = (a, b) => { const [x, y] = pair(a, b); return db.friends.find((f) => f.a === x && f.b === y); };
  const areFriends = (a, b) => { const f = friendRow(a, b); return !!(f && f.accepted); };
  const visitOf = (host, visitor) => db.visits.find((v) => v.host === host && v.visitor === visitor && v.day === today());
  const need = (uid) => {
    if (!uid) throw new Error('not signed in');
    if (!db.players.has(uid)) throw new Error('join first');
    return uid;
  };

  const rpc = {
    farm_join_v1(uid, a) {
      if (!uid) throw new Error('not signed in');
      let p = db.players.get(uid);
      const nm = String(a.p_farm_name || '').trim().slice(0, 24);
      if (!p) {
        const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) code += abc[crypto.randomInt(32)];
        p = { id: uid, farm_name: nm || 'Sunny Acres', friend_code: code, listed: true, seen: Date.now() };
        db.players.set(uid, p);
      } else if (a.p_farm_name != null) p.farm_name = nm || p.farm_name;
      return { id: p.id, farm_name: p.farm_name, friend_code: p.friend_code, listed: p.listed };
    },
    farm_publish_v1(uid, a) {
      need(uid);
      db.snaps.set(uid, { data: a.p_data, beauty: a.p_beauty, house_level: a.p_house_level, updated: Date.now() });
      const s = db.scores.get(uid) || { earned: 0, quests: 0 };
      db.scores.set(uid, { beauty: a.p_beauty, earned: Math.max(s.earned, a.p_earned_week), quests: Math.max(s.quests, a.p_quests_week) });
      db.players.get(uid).seen = Date.now();
      return true;
    },
    farm_heartbeat_v1(uid) { db.players.get(need(uid)).seen = Date.now(); return null; },
    farm_list_v1(uid, a) {
      need(uid);
      const kind = a.p_kind || 'popular';
      return [...db.players.values()].filter((p) => p.id !== uid && db.snaps.has(p.id) && (kind === 'friends' ? areFriends(uid, p.id) : p.listed))
        .map((p) => { const s = db.snaps.get(p.id); return { id: p.id, farm_name: p.farm_name, beauty: s.beauty, house_level: s.house_level, online: online(p), likes_week: db.visits.filter((v) => v.host === p.id && v.liked).length, updated: s.updated }; })
        .sort((x, y) => (kind === 'recent' ? y.updated - x.updated : y.beauty - x.beauty)).slice(0, a.p_limit || 30);
    },
    farm_visit_v1(uid, a) {
      need(uid);
      if (a.p_host === uid) throw new Error('that is your own farm');
      const s = db.snaps.get(a.p_host), p = db.players.get(a.p_host);
      if (!s || !p) throw new Error('no such farm');
      let v = visitOf(a.p_host, uid);
      if (!v) db.visits.push(v = { host: a.p_host, visitor: uid, day: today(), liked: false, gift: null, collected: false });
      return { id: p.id, farm_name: p.farm_name, online: online(p), data: s.data, beauty: s.beauty, house_level: s.house_level, likes: db.visits.filter((x) => x.host === p.id && x.liked).length, friend: areFriends(uid, p.id), liked: v.liked, gift: v.gift };
    },
    farm_like_v1(uid, a) {
      const v = visitOf(a.p_host, need(uid));
      if (!v || v.liked) return false;
      v.liked = true;
      return true;
    },
    farm_gift_v1(uid, a) {
      need(uid);
      if (a.p_gift !== 'gold' && a.p_gift !== 'star') return 'bad';
      const mine = db.visits.filter((v) => v.visitor === uid && v.day === today());
      if (a.p_gift === 'gold' && mine.filter((v) => v.gift === 'gold').length >= 5) return 'limit';
      if (a.p_gift === 'star' && mine.some((v) => v.gift === 'star')) return 'limit';
      const v = visitOf(a.p_host, uid);
      if (!v || v.gift) return 'already';
      v.gift = a.p_gift;
      return 'ok';
    },
    farm_collect_v1(uid) {
      need(uid);
      const taken = db.visits.filter((v) => v.host === uid && v.gift && !v.collected);
      taken.forEach((v) => { v.collected = true; });
      return { gold: taken.filter((v) => v.gift === 'gold').length, stars: taken.filter((v) => v.gift === 'star').length, from: [...new Set(taken.map((v) => db.players.get(v.visitor).farm_name))] };
    },
    farm_visitors_v1(uid) {
      need(uid);
      return db.visits.filter((v) => v.host === uid).reverse().map((v) => ({ id: v.visitor, farm_name: db.players.get(v.visitor).farm_name, day: v.day, liked: v.liked, gift: v.gift }));
    },
    farm_leaderboard_v1(uid, a) {
      need(uid);
      const k = a.p_kind;
      if (!['beauty', 'earned', 'quests'].includes(k)) throw new Error('bad kind');
      const rows = [...db.scores.entries()].map(([id, s]) => ({ id, farm_name: db.players.get(id).farm_name, score: s[k] })).sort((x, y) => y.score - x.score);
      return rows.map((r) => ({ rank: rows.filter((o) => o.score > r.score).length + 1, id: r.id, farm_name: r.farm_name, score: r.score, me: r.id === uid }));
    },
    farm_friend_add_v1(uid, a) {
      need(uid);
      const other = [...db.players.values()].find((p) => p.friend_code === String(a.p_code).trim().toUpperCase());
      if (!other) return 'nocode';
      if (other.id === uid) return 'self';
      const f = friendRow(uid, other.id);
      if (!f) { const [x, y] = pair(uid, other.id); db.friends.push({ a: x, b: y, by: uid, accepted: false }); return 'requested'; }
      if (f.accepted) return 'already';
      if (f.by === other.id) { f.accepted = true; return 'friends'; }
      return 'waiting';
    },
    farm_friend_answer_v1(uid, a) {
      need(uid);
      const f = friendRow(uid, a.p_other);
      if (a.p_accept) {
        if (f && f.by === a.p_other && !f.accepted) { f.accepted = true; return 'friends'; }
        return 'none';
      }
      if (f) db.friends.splice(db.friends.indexOf(f), 1);
      return 'removed';
    },
    farm_friends_v1(uid) {
      need(uid);
      return db.friends.filter((f) => f.a === uid || f.b === uid).map((f) => {
        const o = db.players.get(f.a === uid ? f.b : f.a);
        return { id: o.id, farm_name: o.farm_name, status: f.accepted ? 'friend' : f.by === uid ? 'sent' : 'request', online: online(o), unread: db.messages.filter((m) => m.recipient === uid && m.sender === o.id && !m.read).length };
      });
    },
    farm_message_send_v1(uid, a) {
      need(uid);
      const body = String(a.p_body || '').trim().slice(0, 200);
      if (!body) return 'empty';
      if (!areFriends(uid, a.p_to)) return 'notfriends';
      db.messages.push({ id: ++db.msgId, sender: uid, recipient: a.p_to, body, read: false, at: Date.now() });
      return 'ok';
    },
    farm_messages_v1(uid, a) {
      need(uid);
      const list = db.messages.filter((m) => (m.sender === uid && m.recipient === a.p_with) || (m.sender === a.p_with && m.recipient === uid));
      list.forEach((m) => { if (m.recipient === uid) m.read = true; });
      return list.slice().reverse().slice(0, 50).map((m) => ({ id: m.id, mine: m.sender === uid, body: m.body, created_at: new Date(m.at).toISOString() }));
    },
    farm_set_listed_v1(uid, a) { db.players.get(need(uid)).listed = !!a.p_listed; return null; },
    farm_leave_v1(uid) { need(uid); db.players.delete(uid); db.snaps.delete(uid); db.scores.delete(uid); return null; },
  };

  // ----- live channels
  const deliver = (m, kind, a, b) => {
    setTimeout(() => {
      m.client.page.evaluate(([hid, kind, a, b]) => window.__netRecv && window.__netRecv(hid, kind, a, b), [m.hid, kind, a, b]).catch(() => {});
    }, 0);
  };
  const presence = (topic) => {
    const ch = channels.get(topic);
    if (!ch) return;
    for (const m of ch.values()) deliver(m, 'presence', [...ch.values()].filter((o) => o.client.uid !== m.client.uid).map((o) => o.state));
  };

  function connect(page) {
    const client = { page, uid: null, subs: new Map() };
    client.call = async (op, args) => {
      if (op === 'session') return client.uid;
      if (op === 'signIn') { client.uid = crypto.randomUUID(); return client.uid; }
      if (op === 'signOut') { client.uid = null; return null; }
      if (op === 'rpc') {
        const fn = rpc[args[0]];
        if (!fn) throw new Error('no function ' + args[0]);
        return fn(client.uid, args[1] || {});
      }
      const [hid] = args;
      if (op === 'join') {
        const topic = args[1];
        if (!client.uid || !/^farm:[0-9a-f-]{36}$/.test(topic)) return null;
        if (!channels.has(topic)) channels.set(topic, new Map());
        const m = { client, hid, topic, state: args[2] };
        channels.get(topic).set(client.uid + ':' + hid, m);
        client.subs.set(hid, m);
        presence(topic);
      } else if (op === 'track') {
        const m = client.subs.get(hid);
        if (m) { m.state = args[1]; presence(m.topic); }
      } else if (op === 'send') {
        const m = client.subs.get(hid);
        if (!m) return null;
        for (const o of channels.get(m.topic).values()) if (o.client.uid !== client.uid) deliver(o, 'message', args[1], args[2]);
      } else if (op === 'leave') {
        const m = client.subs.get(hid);
        if (!m) return null;
        client.subs.delete(hid);
        channels.get(m.topic).delete(client.uid + ':' + hid);
        presence(m.topic);
      }
      return null;
    };
    return client;
  }

  return { connect, db, channels };
}

// Runs in the page (before the game): window.gameHost.net talks to the server through the __net binding.
const netScript = () => {
  let seq = 0;
  const handlers = {};
  window.__netRecv = (hid, kind, a, b) => {
    const h = handlers[hid];
    if (!h) return;
    if (kind === 'presence') h.presence(a);
    else h.message(a, b);
  };
  window.gameHost.net = {
    session: () => window.__net('session', []),
    signIn: (kind, email, password) => window.__net('signIn', [kind, email, password]),
    signOut: () => window.__net('signOut', []),
    rpc: (name, args) => window.__net('rpc', [name, JSON.parse(JSON.stringify(args || {}))]),
    join: (topic, me, on) => {
      const hid = ++seq;
      handlers[hid] = on;
      window.__net('join', [hid, topic, me]);
      return {
        track: (s) => window.__net('track', [hid, s]),
        send: (event, payload) => window.__net('send', [hid, event, payload]),
        leave: () => { delete handlers[hid]; return window.__net('leave', [hid]); },
      };
    },
  };
};

module.exports = { createServer, netScript };

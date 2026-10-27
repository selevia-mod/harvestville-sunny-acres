// A stand-in for the online world, for the tests: the same answers as the database functions in
// supabase/farm_online.sql (kept in memory), and realtime channels with presence and broadcasts, behind a fake
// of the app's supabase-js client, so the tests run the real app bridge (bridge/sunnyAcresBridge.js).
const crypto = require('crypto');

function createServer() {
  const db = { players: new Map(), snaps: new Map(), visits: [], friends: [], messages: [], scores: new Map(), msgId: 0, blocks: [], reports: [], follows: [], staff: new Set(), plays: [], wallets: new Map(), purchases: new Map(), loseNextBuyAnswer: false, helps: [] };
  const channels = new Map(); // topic -> Map(client:hid -> member)
  const today = () => new Date().toISOString().slice(0, 10);
  const online = (p) => Date.now() - p.seen < 2 * 60 * 1000;
  const pair = (a, b) => (a < b ? [a, b] : [b, a]);
  const friendRow = (a, b) => { const [x, y] = pair(a, b); return db.friends.find((f) => f.a === x && f.b === y); };
  const follows = (a, b) => db.follows.some((f) => f.by === a && f.who === b);
  const coded = (a, b) => { const f = friendRow(a, b); return !!(f && f.accepted); };
  const areFriends = (a, b) => coded(a, b) || (follows(a, b) && follows(b, a));
  const staff = (uid) => { if (!db.staff.has(uid)) throw new Error('staff only'); };
  const blocked = (a, b) => db.blocks.some((x) => (x.by === a && x.who === b) || (x.by === b && x.who === a));
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
      return [...db.players.values()].filter((p) => p.id !== uid && db.snaps.has(p.id) && !blocked(uid, p.id) && (kind === 'friends' ? areFriends(uid, p.id) : kind === 'following' ? follows(uid, p.id) && (p.listed || areFriends(uid, p.id)) : p.listed))
        .map((p) => { const s = db.snaps.get(p.id); return { id: p.id, farm_name: p.farm_name, beauty: s.beauty, house_level: s.house_level, online: online(p), likes_week: db.visits.filter((v) => v.host === p.id && v.liked).length, updated: s.updated }; })
        .sort((x, y) => (kind === 'recent' ? y.updated - x.updated : y.beauty - x.beauty)).slice(0, a.p_limit || 30);
    },
    farm_visit_v1(uid, a) {
      need(uid);
      if (a.p_host === uid) throw new Error('that is your own farm');
      const s = db.snaps.get(a.p_host), p = db.players.get(a.p_host);
      if (!s || !p || blocked(uid, a.p_host)) throw new Error('no such farm');
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
    // part 6 (supabase/farm_online_6.sql): water a friend's crops on a visit; the tiles friends watered for you
    farm_help_v1(uid, a) {
      need(uid);
      if (!a.p_host || a.p_host === uid) return { ok: false, code: 'self' };
      const tile = Number(a.p_tile);
      if (!Number.isInteger(tile) || tile < 0 || tile > 100000) return { ok: false, code: 'bad' };
      if (blocked(uid, a.p_host) || !areFriends(uid, a.p_host)) return { ok: false, code: 'friends' };
      if (!visitOf(a.p_host, uid)) return { ok: false, code: 'visit' };
      const mineToday = db.helps.filter((h) => h.helper === uid && h.day === today()), mine = mineToday.filter((h) => h.host === a.p_host).length;
      if (mine >= 5 || mineToday.length >= 25) return { ok: false, code: 'limit', left: 0 };
      if (mineToday.some((h) => h.host === a.p_host && h.tile === tile)) return { ok: false, code: 'done', left: 5 - mine };
      db.helps.push({ host: a.p_host, helper: uid, day: today(), tile, claimed: false });
      return { ok: true, left: 4 - mine };
    },
    farm_helps_v1(uid) {
      need(uid);
      const taken = db.helps.filter((h) => h.host === uid && !h.claimed);
      taken.forEach((h) => { h.claimed = true; });
      return { tiles: [...new Set(taken.map((h) => h.tile))], from: [...new Set(taken.map((h) => db.players.get(h.helper).farm_name))] };
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
        return { id: o.id, farm_name: o.farm_name, status: f.accepted ? 'friend' : f.by === uid ? 'sent' : 'request', online: online(o), unread: db.messages.filter((m) => m.recipient === uid && m.sender === o.id && !m.read).length, via: 'code' };
      }).concat([...db.players.values()].filter((o) => o.id !== uid && !friendRow(uid, o.id) && follows(uid, o.id) && follows(o.id, uid) && !blocked(uid, o.id))
        .map((o) => ({ id: o.id, farm_name: o.farm_name, status: 'friend', online: online(o), unread: db.messages.filter((m) => m.recipient === uid && m.sender === o.id && !m.read).length, via: 'selebox' })));
    },
    farm_message_send_v1(uid, a) {
      need(uid);
      const body = String(a.p_body || '').trim().slice(0, 200);
      if (!body) return 'empty';
      if (!areFriends(uid, a.p_to) || blocked(uid, a.p_to)) return 'notfriends';
      if (/\bgago\b|fuck/i.test(body)) return 'word';
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
    farm_block_v1(uid, a) {
      need(uid);
      if (a.p_other === uid) return 'self';
      if (!a.p_block) { db.blocks = db.blocks.filter((x) => !(x.by === uid && x.who === a.p_other)); return 'unblocked'; }
      if (!db.players.has(a.p_other)) return 'none';
      if (!db.blocks.some((x) => x.by === uid && x.who === a.p_other)) db.blocks.push({ by: uid, who: a.p_other });
      const f = friendRow(uid, a.p_other);
      if (f) db.friends.splice(db.friends.indexOf(f), 1);
      return 'blocked';
    },
    farm_blocked_v1(uid) {
      need(uid);
      return db.blocks.filter((x) => x.by === uid).map((x) => ({ id: x.who, farm_name: db.players.get(x.who).farm_name, created_at: new Date().toISOString() }));
    },
    farm_report_v1(uid, a) {
      need(uid);
      if (a.p_target === uid) return 'self';
      if (!['name', 'messages', 'other'].includes(a.p_reason)) return 'bad';
      if (db.reports.some((r) => r.by === uid && r.target === a.p_target)) return 'already';
      db.reports.push({ by: uid, target: a.p_target, reason: a.p_reason, note: a.p_note || null, status: 'open', evidence: { farm_name: (db.players.get(a.p_target) || {}).farm_name, messages: db.messages.filter((m) => m.sender === a.p_target && m.recipient === uid).map((m) => ({ body: m.body })) } });
      return 'ok';
    },
    farm_reports_v1(uid) {
      staff(uid);
      const open = db.reports.filter((r) => r.status === 'open');
      return [...new Set(open.map((r) => r.target))].map((t) => {
        const rs = open.filter((r) => r.target === t), p = db.players.get(t);
        return { id: t, farm_name: p.farm_name, hidden: !!p.hidden, reporters: new Set(rs.map((r) => r.by)).size, reasons: [...new Set(rs.map((r) => r.reason))].join(', '), notes: rs.map((r) => r.note).filter(Boolean).join(' | ') || null, evidence: rs[rs.length - 1].evidence, last_at: new Date().toISOString() };
      });
    },
    farm_moderate_v1(uid, a) {
      staff(uid);
      if (!['clear', 'keep', 'rename'].includes(a.p_action)) return 'bad';
      const p = db.players.get(a.p_target);
      if (!p) return 'none';
      if (a.p_action === 'rename') p.farm_name = 'Farm ' + p.friend_code.slice(0, 4);
      p.hidden = a.p_action === 'keep';
      db.reports.forEach((r) => { if (r.target === a.p_target && r.status === 'open') r.status = a.p_action === 'clear' ? 'cleared' : 'actioned'; });
      return 'ok';
    },
    farm_track_v1(uid, a) { if (!uid) throw new Error('not signed in'); db.plays.push({ uid, opens: Math.min(1, a.p_opens || 0), minutes: Math.min(240, a.p_minutes || 0) }); return null; },
    farm_stats_v1(uid, a) {
      staff(uid);
      const out = [];
      for (let i = 0; i < Math.min(60, a.p_days || 14); i++) {
        const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), who = i ? [] : [...new Set(db.plays.map((p) => p.uid))];
        const mins = i ? 0 : db.plays.reduce((x, p) => x + p.minutes, 0);
        out.push({ day: d, players: who.length, new_players: who.length, minutes: mins, avg_minutes: who.length ? Math.round((mins / who.length) * 10) / 10 : null, back_next_day: 0, back_in_7_days: 0 });
      }
      return out;
    },
    farm_shop_v1(uid) {
      if (!uid) throw new Error('not signed in');
      const w = db.wallets.get(uid);
      return { wallet: w ? { coins: w.coins, stars: w.stars } : null, offers: [{ item: 'energy', currency: 'coins', price: 5, amount: 100, version: 1 }, { item: 'energy', currency: 'stars', price: 10, amount: 100, version: 1 }], left: 20 };
    },
    farm_buy_v1(uid, a) {
      if (!uid) throw new Error('not signed in');
      const key = uid + ':' + a.p_request_id, done = db.purchases.get(key);
      if (done) return Object.assign({ ok: true, duplicate: true }, done);
      const price = { coins: 5, stars: 10 }[a.p_currency];
      if (a.p_item !== 'energy' || !price) return { ok: false, code: 'offer-unavailable' };
      if (a.p_price !== price || a.p_version !== 1) return { ok: false, code: 'offer-changed' };
      const w = db.wallets.get(uid);
      if (!w) return { ok: false, code: 'wallet-unavailable' };
      if (w[a.p_currency] < price) return { ok: false, code: 'insufficient-' + a.p_currency };
      w[a.p_currency] -= price;
      db.purchases.set(key, { item: 'energy', amount: 100, currency: a.p_currency, price });
      if (db.loseNextBuyAnswer) { db.loseNextBuyAnswer = false; throw new Error('network timeout'); }
      return { ok: true, item: 'energy', amount: 100, currency: a.p_currency, price, balance: w[a.p_currency] };
    },
    farm_prizes_v1(uid) { need(uid); const p = db.prizes && db.prizes[uid]; if (db.prizes) delete db.prizes[uid]; return p || []; },
    farm_leave_v1(uid) { need(uid); db.players.delete(uid); db.snaps.delete(uid); db.scores.delete(uid); return null; },
  };

  // ----- realtime: channels with presence (keyed by user id) and broadcasts, like supabase-js
  const topics = new Map(); // topic -> Set of channels
  const later = (fn) => setTimeout(fn, 0);
  const sync = (topic) => {
    const set = topics.get(topic);
    if (!set) return;
    const state = {};
    for (const c of set) if (c.tracked) state[c.key] = [Object.assign({ presence_ref: 'r' + c.n }, c.state)];
    for (const c of set) { c.presence = state; c.fire('presence', 'sync', {}); }
  };
  let nChan = 0;

  // A stand-in for the app's signed-in supabase-js client (only what the bridge uses).
  function supabaseFor(uid) {
    return {
      auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null }, error: null }) },
      async rpc(name, args) {
        const fn = rpc[name];
        if (!fn) return { data: null, error: { message: 'Could not find the function ' + name } };
        try { return { data: JSON.parse(JSON.stringify(fn(uid, args || {}) ?? null)), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; }
      },
      channel(topic, opts) {
        const cfg = (opts && opts.config) || {};
        const c = {
          topic, n: ++nChan, key: (cfg.presence && cfg.presence.key) || uid, self: !!(cfg.broadcast && cfg.broadcast.self),
          listeners: [], state: null, tracked: false, presence: {}, joined: false,
          on(type, filter, cb) { this.listeners.push({ type, event: filter.event, cb }); return this; },
          fire(type, event, arg) { this.listeners.forEach((l) => { if (l.type === type && (l.event === '*' || l.event === event)) l.cb(arg); }); },
          subscribe(cb) {
            later(() => {
              // private channels: only farm:<id> topics, for signed-in players (farm_topic_ok_v1)
              if (!uid || !/^farm:[0-9a-f-]{36}$/.test(topic) || !db.players.has(uid) || blocked(uid, topic.slice(5))) return cb && cb('CHANNEL_ERROR');
              if (!topics.has(topic)) topics.set(topic, new Set());
              topics.get(topic).add(this);
              this.joined = true;
              if (cb) cb('SUBSCRIBED');
            });
            return this;
          },
          async track(state) { this.state = state; this.tracked = true; later(() => sync(topic)); return 'ok'; },
          presenceState() { return this.presence; },
          async send(m) {
            const set = topics.get(topic);
            if (!set || !this.joined) return 'error';
            for (const o of set) if (o !== this || this.self) later(() => o.fire('broadcast', m.event, { type: 'broadcast', event: m.event, payload: m.payload }));
            return 'ok';
          },
        };
        return c;
      },
      async removeChannel(c) {
        const set = topics.get(c.topic);
        if (set && set.delete(c)) later(() => sync(c.topic));
        c.joined = false;
        return 'ok';
      },
    };
  }

  return { supabaseFor, db, topics, newUser: () => crypto.randomUUID() };
}

module.exports = { createServer };

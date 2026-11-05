// A stand-in for the online world, for the tests: the same answers as the database functions in
// supabase/farm_online.sql (kept in memory), and realtime channels with presence and broadcasts, behind a fake
// of the app's supabase-js client, so the tests run the real app bridge (bridge/sunnyAcresBridge.js).
const crypto = require('crypto');
const LOOK_OFFERS = [{ look: 'flower', currency: 'coins', price: 100 }, { look: 'flower', currency: 'stars', price: 150 }, { look: 'santa', currency: 'coins', price: 150 },
  { look: 'fiesta', currency: 'coins', price: 150 }, { look: 'fiesta', currency: 'stars', price: 200 }, { look: 'bunny', currency: 'coins', price: 150 }, { look: 'bunny', currency: 'stars', price: 200 }];

// each animal's usual weight (supabase/farm_online_14.sql, farm.catch_kinds)
const CATCH_KG = { rabbit: 2, labuyo: 1.4, deer: 60, boar: 90, wolf: 40, whitedeer: 75, goldboar: 120, bear: 180, mammoth: 4000, tiger: 200, rhino: 1500, greatmammoth: 7000 };

// each fish's usual weight (supabase/farm_online_15.sql, farm.derby_fish)
const DERBY_KG = { fish_s: 0.3, fish_m: 1.2, fish_l: 3.5, fish_k: 12 };

function createServer() {
  const db = { looksOwned: new Map(), players: new Map(), snaps: new Map(), visits: [], friends: [], messages: [], scores: new Map(), msgId: 0, blocks: [], reports: [], follows: [], staff: new Set(), plays: [], wallets: new Map(), purchases: new Map(), loseNextBuyAnswer: false, helps: [], picks: [], market: [], lotId: 0, hunting: new Map(), catches: new Map(), derby: new Map() };
  const channels = new Map(); // topic -> Map(client:hid -> member)
  db.tracks = []; // every presence update, as the server counts them
  db.sends = []; // every broadcast sent: { uid, room, event, at, heard } (heard: how many others it reached; the message budget)
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
  // may this user use the live channel? (farm_topic_ok_v1: a farm:<id> they are not blocked from, and since part 19 the
  // park channels park:1 to park:3 for any player)
  const topicOk = (uid, topic) => !!uid && db.players.has(uid)
    && (/^park:[1-3]$/.test(topic) || (/^farm:[0-9a-f-]{36}$/.test(topic) && !blocked(uid, topic.slice(5))));
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
    invite_collect_game_rewards_v1(uid, a) {
      need(uid);
      const box = db.invites = db.invites || {}, mine = box[uid] = box[uid] || {}, amount = mine[a.p_kind] || 0;
      mine[a.p_kind] = 0;
      return { ok: true, kind: a.p_kind, amount };
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
    // part 8 (supabase/farm_online_8.sql): pick a friend's ripe crops into their basket; the crops friends picked for you
    farm_pick_v1(uid, a) {
      need(uid);
      if (!a.p_host || a.p_host === uid) return { ok: false, code: 'self' };
      const tile = Number(a.p_tile);
      if (!Number.isInteger(tile) || tile < 0 || tile > 100000 || !/^[a-z][a-z_]{0,23}$/.test(String(a.p_crop))) return { ok: false, code: 'bad' };
      if (blocked(uid, a.p_host) || !areFriends(uid, a.p_host)) return { ok: false, code: 'friends' };
      if (!visitOf(a.p_host, uid)) return { ok: false, code: 'visit' };
      const mineToday = db.picks.filter((h) => h.picker === uid && h.day === today()), mine = mineToday.filter((h) => h.host === a.p_host).length;
      if (mine >= 5 || mineToday.length >= 25) return { ok: false, code: 'limit', left: 0 };
      if (db.picks.some((h) => h.host === a.p_host && h.tile === tile && (!h.claimed || (h.picker === uid && h.day === today())))) return { ok: false, code: 'done', left: 5 - mine };
      db.picks.push({ host: a.p_host, picker: uid, day: today(), tile, crop: a.p_crop, claimed: false });
      return { ok: true, left: 4 - mine };
    },
    farm_picks_v1(uid) {
      need(uid);
      const taken = db.picks.filter((h) => h.host === uid && !h.claimed);
      taken.forEach((h) => { h.claimed = true; });
      return { picks: taken.map((h) => [h.tile, h.crop]), from: [...new Set(taken.map((h) => db.players.get(h.picker).farm_name))] };
    },
    // part 9 (supabase/farm_online_9.sql): giving items to a friend
    farm_give_v1(uid, a) {
      need(uid);
      if (!a.p_to || a.p_to === uid) return { ok: false, code: 'self' };
      if (!/^[a-z][a-z0-9_]{0,23}$/.test(String(a.p_item)) || !Number.isInteger(a.p_n) || a.p_n < 1 || a.p_n > 99) return { ok: false, code: 'bad' };
      if (blocked(uid, a.p_to) || !areFriends(uid, a.p_to)) return { ok: false, code: 'friends' };
      const mine = (db.gives || []).filter((g) => g.giver === uid && g.day === today()), them = mine.filter((g) => g.taker === a.p_to).length;
      if (them >= 10 || mine.length >= 30) return { ok: false, code: 'limit' };
      (db.gives = db.gives || []).push({ giver: uid, taker: a.p_to, day: today(), item: a.p_item, n: a.p_n, claimed: false });
      return { ok: true, left: Math.min(9 - them, 29 - mine.length) };
    },
    farm_gives_v1(uid) {
      need(uid);
      const taken = (db.gives || []).filter((g) => g.taker === uid && !g.claimed);
      taken.forEach((g) => { g.claimed = true; });
      return { gives: taken.map((g) => [g.item, g.n]), from: [...new Set(taken.map((g) => db.players.get(g.giver).farm_name))] };
    },
    // part 7 (supabase/farm_online_7.sql): the Market
    farm_market_list_v1(uid, a) {
      need(uid);
      if (!/^[a-z][a-z_]{0,23}$/.test(String(a.p_item)) || !(a.p_qty >= 1 && a.p_qty <= 10) || !(a.p_price >= 1 && a.p_price <= 100000)) return { ok: false, code: 'bad' };
      if (db.market.filter((m) => m.seller === uid && !m.claimed).length >= 4) return { ok: false, code: 'full' };
      const m = { id: ++db.lotId, seller: uid, item: a.p_item, qty: a.p_qty, price: a.p_price, expires: Date.now() + 2 * 864e5, buyer: null, sold: 0, claimed: false };
      db.market.push(m);
      return { ok: true, id: m.id };
    },
    farm_market_cancel_v1(uid, a) {
      need(uid);
      const m = db.market.find((x) => x.id === a.p_id && x.seller === uid && !x.buyer);
      if (!m) return { ok: false, code: 'gone' };
      db.market.splice(db.market.indexOf(m), 1);
      return { ok: true, item: m.item, qty: m.qty };
    },
    farm_market_mine_v1(uid) {
      need(uid);
      return db.market.filter((m) => m.seller === uid && !m.claimed).map((m) => ({ id: m.id, item: m.item, qty: m.qty, price: m.price,
        status: m.buyer ? 'sold' : m.expires <= Date.now() ? 'expired' : 'open', buyer_name: m.buyer ? db.players.get(m.buyer).farm_name : null, expires_at: new Date(m.expires).toISOString() }));
    },
    farm_market_collect_v1(uid) {
      need(uid);
      const sold = db.market.filter((m) => m.seller === uid && m.buyer && !m.claimed), back = db.market.filter((m) => m.seller === uid && !m.buyer && m.expires <= Date.now());
      sold.forEach((m) => { m.claimed = true; });
      db.market = db.market.filter((m) => !back.includes(m));
      return { sold: sold.map((m) => ({ item: m.item, qty: m.qty, price: m.price, buyer: db.players.get(m.buyer).farm_name })), returned: back.map((m) => ({ item: m.item, qty: m.qty })) };
    },
    farm_market_of_v1(uid, a) {
      need(uid);
      const p = db.players.get(a.p_host);
      if (!p || blocked(uid, a.p_host) || !(p.listed || areFriends(uid, a.p_host))) return [];
      return db.market.filter((m) => m.seller === a.p_host && !m.buyer && m.expires > Date.now()).map((m) => ({ id: m.id, item: m.item, qty: m.qty, price: m.price, expires_at: new Date(m.expires).toISOString() }));
    },
    farm_market_find_v1(uid, a) {
      need(uid);
      return db.market.filter((m) => m.item === a.p_item && !m.buyer && m.expires > Date.now() && m.seller !== uid && !blocked(uid, m.seller))
        .map((m) => ({ id: m.id, seller: m.seller, farm_name: db.players.get(m.seller).farm_name, friend: areFriends(uid, m.seller), qty: m.qty, price: m.price }))
        .sort((x, y) => (y.friend - x.friend) || x.price / x.qty - y.price / y.qty).slice(0, 10);
    },
    farm_market_buy_v1(uid, a) {
      need(uid);
      const m = db.market.find((x) => x.id === a.p_id);
      if (!m) return { ok: false, code: 'gone' };
      if (m.seller === uid) return { ok: false, code: 'self' };
      if (m.buyer || m.expires <= Date.now() || blocked(uid, m.seller)) return { ok: false, code: 'gone' };
      if (db.market.filter((x) => x.buyer === uid && Date.now() - x.sold < 864e5).length >= 10) return { ok: false, code: 'limit' };
      m.buyer = uid;
      m.sold = Date.now();
      return { ok: true, item: m.item, qty: m.qty, price: m.price, seller: db.players.get(m.seller).farm_name };
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
    // the Tailor Shop's Coins and Stars looks, like supabase/farm_online_13.sql
    farm_looks_v1(uid) {
      if (!uid) throw new Error('not signed in');
      if (db.noLooks) throw new Error('function public.farm_looks_v1() does not exist');
      const w = db.wallets.get(uid), owned = db.looksOwned.get(uid) || [];
      return { wallet: w ? { coins: w.coins, stars: w.stars } : null, offers: LOOK_OFFERS.map((o) => Object.assign({ version: 1 }, o)), owned: owned.slice() };
    },
    farm_look_buy_v1(uid, a) {
      if (!uid) throw new Error('not signed in');
      const key = uid + ':look:' + a.p_request_id, done = db.purchases.get(key), owned = db.looksOwned.get(uid) || [];
      if (done) return Object.assign({ ok: true, duplicate: true }, done);
      if (owned.indexOf(a.p_look) >= 0) return { ok: false, code: 'owned', look: a.p_look };
      const o = LOOK_OFFERS.filter((x) => x.look === a.p_look && x.currency === a.p_currency)[0];
      if (!o) return { ok: false, code: 'offer-unavailable' };
      if (a.p_price !== o.price || a.p_version !== 1) return { ok: false, code: 'offer-changed' };
      const w = db.wallets.get(uid);
      if (!w) return { ok: false, code: 'wallet-unavailable' };
      if (w[a.p_currency] < o.price) return { ok: false, code: 'insufficient-' + a.p_currency };
      w[a.p_currency] -= o.price;
      db.looksOwned.set(uid, owned.concat([a.p_look]));
      db.purchases.set(key, { look: a.p_look, currency: a.p_currency, price: o.price });
      return { ok: true, look: a.p_look, currency: a.p_currency, price: o.price, balance: w[a.p_currency] };
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
    farm_leave_v1(uid) { need(uid); hoodGone(uid); db.parkSeats.delete(uid); db.cupPicks.delete(uid); db.players.delete(uid); db.snaps.delete(uid); db.scores.delete(uid); return null; },
    // part 14 (supabase/farm_online_14.sql): hunting together. db.noHunt: as before it is applied (the functions are not there).
    farm_hunt_here_v1(uid, a) {
      huntPart(); need(uid);
      db.players.get(uid).seen = Date.now();
      if (a.p_map == null) { db.hunting.delete(uid); return null; }
      if (!['pulag', 'makiling', 'magayon'].includes(a.p_map)) throw new Error('bad map');
      const old = db.hunting.get(uid);
      db.hunting.set(uid, { map: a.p_map, since: old && old.map === a.p_map ? old.since : Date.now() });
      return null;
    },
    farm_hunting_v1(uid) {
      huntPart(); need(uid);
      return [...db.hunting.entries()].filter(([id]) => id !== uid && db.players.has(id) && online(db.players.get(id)) && !blocked(uid, id) && (areFriends(uid, id) || db.players.get(id).listed))
        .map(([id, h]) => ({ id, farm_name: db.players.get(id).farm_name, map: h.map, friend: areFriends(uid, id), minutes: Math.floor((Date.now() - h.since) / 60000) }))
        .sort((x, y) => (y.friend - x.friend) || ((y.map === 'magayon') - (x.map === 'magayon')));
    },
    farm_friend_ask_v1(uid, a) {
      huntPart(); need(uid);
      const o = db.players.get(a.p_other);
      if (!o || blocked(uid, a.p_other)) return 'nocode';
      return rpc.farm_friend_add_v1(uid, { p_code: o.friend_code });
    },
    farm_catch_v1(uid, a) {
      huntPart(); need(uid);
      const base = CATCH_KG[a.p_kind];
      if (!base) return { ok: false, code: 'bad-kind' };
      if (!(a.p_kg10 >= Math.floor(base * 9) && a.p_kg10 <= Math.ceil(base * 13.5))) return { ok: false, code: 'bad-weight' };
      const key = a.p_kind + ':' + uid, old = db.catches.get(key) || 0;
      if (a.p_kg10 > old) db.catches.set(key, a.p_kg10);
      const best = db.catches.get(key);
      return { ok: true, best, rank: 1 + [...db.catches.entries()].filter(([k, v]) => k.startsWith(a.p_kind + ':') && v > best).length };
    },
    farm_catch_board_v1(uid, a) {
      huntPart(); need(uid);
      const rows = [...db.catches.entries()].filter(([k]) => k.startsWith(a.p_kind + ':')).map(([k, kg10]) => ({ id: k.split(':')[1], kg10 }))
        .filter((r) => db.players.has(r.id) && !blocked(uid, r.id));
      return rows.map((r) => ({ rank: 1 + rows.filter((o) => o.kg10 > r.kg10).length, id: r.id, farm_name: db.players.get(r.id).farm_name, kg10: r.kg10, me: r.id === uid }))
        .sort((x, y) => x.rank - y.rank).filter((r) => r.rank <= 10 || r.me);
    },
    // part 15 (supabase/farm_online_15.sql): the Fishing Derby. db.derbyDay false: not a Monday; db.noDerby: not applied.
    farm_derby_v1(uid, a) {
      derbyPart(); need(uid);
      if (db.derbyDay === false) return { ok: false, code: 'not-monday' };
      const base = DERBY_KG[a.p_kind];
      if (!base) return { ok: false, code: 'bad-kind' };
      if (!(a.p_g >= Math.floor(base * 800) && a.p_g <= Math.ceil(base * 1600))) return { ok: false, code: 'bad-weight' };
      const key = a.p_kind + ':' + uid, old = db.derby.get(key) || 0;
      if (a.p_g > old) db.derby.set(key, a.p_g);
      const best = db.derby.get(key);
      return { ok: true, best, rank: 1 + [...db.derby.entries()].filter(([k, v]) => k.startsWith(a.p_kind + ':') && v > best).length };
    },
    farm_derby_board_v1(uid, a) {
      derbyPart(); need(uid);
      const rows = [...db.derby.entries()].filter(([k]) => k.startsWith(a.p_kind + ':')).map(([k, g]) => ({ id: k.split(':')[1], g }))
        .filter((r) => db.players.has(r.id) && !blocked(uid, r.id));
      return rows.map((r) => ({ rank: 1 + rows.filter((o) => o.g > r.g).length, id: r.id, farm_name: db.players.get(r.id).farm_name, g: r.g, me: r.id === uid }))
        .sort((x, y) => x.rank - y.rank).filter((r) => r.rank <= 10 || r.me);
    },
  };
  function derbyPart() { if (db.noDerby) throw new Error('Could not find the function in the schema cache'); }
  function huntPart() { if (db.noHunt) throw new Error('Could not find the function in the schema cache'); }

  // part 12 (supabase/farm_online_12.sql): the Town Goal and Best Farm of the Week. Like the real thing before it is
  // applied, these do not exist until a test sets server.db.town = {} (see townRpc): the game must then hide them quietly.
  // db.town: { kind, target, total, gives: { uid: n today }, mine: { uid: n this week }, prize: { uid: [weeks to claim] }, best: { id, likes }, bestPrize: uid }
  const townRpc = {
    farm_town_goal_v1(uid) {
      need(uid);
      const t = db.town;
      return { week: '2026-11-02', kind: t.kind || 'crop', target: t.target || 1000, total: t.total || 0, givers: Object.keys(t.mine || {}).length, mine: (t.mine || {})[uid] || 0, left_today: 40 - ((t.gives || {})[uid] || 0), day_cap: 40, min: 10, gold: 1000, stars: 1, ends_in: 3 * 86400 + 3600, can_give: true };
    },
    farm_town_give_v1(uid, a) {
      need(uid);
      const t = db.town, n = Number(a.p_n);
      if (!Number.isInteger(n) || n < 1) return { ok: false, code: 'bad', given: 0 };
      t.gives = t.gives || {};
      t.mine = t.mine || {};
      const took = Math.min(n, 40 - (t.gives[uid] || 0));
      if (took <= 0) return { ok: false, code: 'limit', given: 0, left_today: 0 };
      t.gives[uid] = (t.gives[uid] || 0) + took;
      t.mine[uid] = (t.mine[uid] || 0) + took;
      t.total = (t.total || 0) + took;
      return { ok: true, given: took, left_today: 40 - t.gives[uid] };
    },
    farm_town_claim_v1(uid) {
      need(uid);
      const weeks = (db.town.prize || {})[uid] || [];
      if (db.town.prize) delete db.town.prize[uid];
      return weeks.map((week) => ({ week, gold: 1000, stars: 1 }));
    },
    farm_best_v1(uid) {
      need(uid);
      const b = db.town.best, who = b && db.players.get(b.id);
      return { last: who ? { id: who.id, farm_name: who.farm_name, likes: b.likes, week: '2026-10-26' } : null, top: 0, mine: 0, gold: 5000, stars: 5 };
    },
    farm_best_claim_v1(uid) {
      need(uid);
      if (db.town.bestPrize !== uid) return [];
      db.town.bestPrize = null;
      return [{ week: '2026-10-26', likes: db.town.best ? db.town.best.likes : 1, gold: 5000, stars: 5 }];
    },
  };
  Object.keys(townRpc).forEach((name) => {
    rpc[name] = (uid, a) => {
      if (!db.town) throw new Error('Could not find the function ' + name);
      return townRpc[name](uid, a);
    };
  });

  // parts 16 and 17 (supabase/farm_online_16.sql, _17.sql): barangays and the Bayanihan Cup, and the Market board.
  // db.noHood / db.noAds: as before they are applied (the functions are not there). db.cupFast: a task can be turned in
  // straight away (the real server waits its least minutes; tests can also move a pick's .at back).
  // db.guests: user ids that are guests (profiles.is_guest: no Cup tasks); db.banned: ids banned or suspended (gone for leading, Find, the board).
  Object.assign(db, { hoods: new Map(), hoodOf: new Map(), hoodId: 0, hoodPosts: [], postId: 0, cupPicks: new Map(), cupDone: [], cupHoods: new Map(), cupClaims: new Set(), ads: new Map(),
    hoodBans: new Map(), nbLog: [], guests: new Set(), banned: new Set() });
  const NB_KINDS = [['harvest', 80, 120, 12], ['fish', 12, 100, 10], ['hunt', 4, 120, 10], ['order', 3, 100, 15], ['collect', 15, 80, 10],
    ['care', 25, 60, 8], ['cooked', 5, 80, 8], ['plant', 60, 60, 8], ['forage', 10, 80, 10], ['request', 2, 100, 15]];
  const NB_BADGES = ['carabao', 'mango', 'sunflower', 'fish_k', 'star', 'heart', 'cow', 'gem'];
  const ph = () => new Date(Date.now() + 8 * 3600e3);
  const nbDay = () => ph().toISOString().slice(0, 10);
  const nbWeek = () => { const t = ph(); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  const cupTasks = (wk) => NB_KINDS.map(([kind, goal, points, minutes]) => ({ kind, goal, points, minutes, h: crypto.createHash('md5').update(wk + ':' + kind).digest('hex') }))
    .sort((x, y) => (x.h < y.h ? -1 : 1)).slice(0, 8);
  const members = (hid) => [...db.hoodOf.entries()].filter(([, m]) => m.hood === hid).sort((x, y) => x[1].joined - y[1].joined);
  const INVISIBLE = /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g; // (farm.nb_clean)
  const nbOk = (id) => db.players.has(id) && !db.players.get(id).hidden && !db.banned.has(id); // (farm.nb_ok)
  const hoodLead = (hid) => { // (farm.hood_lead: the leader if still in and in good standing, else the longest member who is)
    const h = db.hoods.get(hid), list = members(hid);
    if (h && list.some(([id]) => id === h.leader) && nbOk(h.leader)) return h.leader;
    const next = list.find(([id]) => nbOk(id));
    return next ? next[0] : null;
  };
  const fixLead = (hid) => { const l = hoodLead(hid), h = db.hoods.get(hid); if (h && l) h.leader = l; };
  const banned = (hid, uid) => (db.hoodBans.get(hid + ':' + uid) || 0) > Date.now();
  const league = (n) => (n <= 5 ? 's' : n <= 15 ? 'm' : 'l');
  const cupSeat = (wk, hid, size, isNew) => { // (farm.cup_seat: a barangay's size only grows; past its league's top it moves up)
    const key = wk + ':' + hid, ch = db.cupHoods.get(key);
    if (!ch && !isNew) return;
    if (ch && size <= ch.most) return;
    const lg = league(Math.max(size, ch ? ch.most : 0));
    if (ch && lg === ch.league) { ch.most = size; return; }
    const grps = {};
    [...db.cupHoods.values()].filter((x) => x.week === wk && x.league === lg && x.hood !== hid).forEach((x) => { grps[x.grp] = (grps[x.grp] || 0) + 1; });
    const open = Object.keys(grps).map(Number).filter((g) => grps[g] < 10).sort((x, y) => x - y);
    const grp = open.length ? open[0] : Object.keys(grps).length ? Math.max(...Object.keys(grps).map(Number)) + 1 : 0;
    if (ch) Object.assign(ch, { league: lg, grp, most: size });
    else { const h = db.hoods.get(hid); db.cupHoods.set(key, { week: wk, hood: hid, name: h.name, badge: h.badge, league: lg, grp, most: Math.max(size, 1), score: 0, last: 0 }); }
  };
  const hoodPost = (hood, uid, kind, body) => {
    db.hoodPosts = db.hoodPosts.filter((p) => p.hood !== hood || Date.now() - p.at < 14 * 864e5); // (farm.hood_prune: any new line)
    if ((kind === 'join' || kind === 'left') && db.hoodPosts.some((p) => p.hood === hood && p.uid === uid && p.kind === kind && Date.now() - p.at < 864e5)) return; // (farm.hood_note: once a day)
    db.hoodPosts.push({ id: ++db.postId, hood, uid, kind, body: body || '', at: Date.now() });
  };
  const hoodGone = (uid) => { // (the trigger: nobody left, it is gone; else the lead passes on if the leader went)
    const m = db.hoodOf.get(uid);
    if (!m) return;
    db.hoodOf.delete(uid);
    if (!members(m.hood).length) db.hoods.delete(m.hood);
    else fixLead(m.hood);
  };
  const cupPlace = (wk, hid) => {
    const h = db.cupHoods.get(wk + ':' + hid);
    if (!h) return null;
    return 1 + [...db.cupHoods.values()].filter((o) => o.week === wk && o.league === h.league && o.grp === h.grp && o.hood !== hid && (o.score > h.score || (o.score === h.score && o.last < h.last))).length;
  };
  const nbPrize = (place, score) => (score >= 400 && place <= 3 ? { gold: [3000, 2000, 1200][place - 1], stars: 4 - place } : { gold: 500, stars: 0 });
  const nbRpc = {
    farm_nb_v1(uid) {
      need(uid);
      db.players.get(uid).seen = Date.now();
      const wk = nbWeek(), today = nbDay(), m = db.hoodOf.get(uid), mine = db.cupDone.filter((d) => d.uid === uid && d.week === wk);
      let hood = null, cup = null, pick = null;
      if (m) {
        const h = db.hoods.get(m.hood), list = members(m.hood), lead = hoodLead(m.hood);
        hood = { id: h.id, name: h.name, badge: h.badge, open: h.open, code: lead === uid ? h.code : null, leader: lead === uid, members: list.length, online: list.filter(([id]) => online(db.players.get(id))).length, max: 30 };
        const ch = db.cupHoods.get(wk + ':' + h.id);
        if (ch) {
          const group = [...db.cupHoods.values()].filter((g) => g.week === wk && g.league === ch.league && g.grp === ch.grp).sort((x, y) => y.score - x.score || x.last - y.last);
          cup = { league: ch.league, score: ch.score, place: cupPlace(wk, h.id), group: group.map((g) => ({ name: g.name, badge: g.badge, score: g.score, me: g.hood === h.id })) };
        }
      }
      const pk = db.cupPicks.get(uid);
      if (pk && pk.week === wk && m && pk.hood === m.hood) pick = { kind: pk.kind, goal: pk.goal, points: pk.points, minutes: pk.minutes, ago: Math.floor((Date.now() - pk.at) / 1000) };
      const end = new Date(wk + 'T00:00:00+08:00').getTime() + 7 * 864e5;
      return { hood, week: wk, ends_in: Math.floor((end - Date.now()) / 1000), tasks: cupTasks(wk).map((t) => ({ kind: t.kind, goal: t.goal, points: t.points, minutes: t.minutes, done: mine.some((d) => d.kind === t.kind) })),
        pick, cup, done_week: mine.length, done_today: mine.filter((d) => d.day === today).length, max_week: 6, max_day: 3, min_place: 400, base_gold: 500,
        prizes: [[3000, 3], [2000, 2], [1200, 1]], can_win: !db.guests.has(uid) };
    },
    farm_nb_create_v1(uid, a) {
      need(uid);
      const nm = String(a.p_name || '').replace(INVISIBLE, '').trim().replace(/\s+/g, ' ');
      if (nm.length < 3 || nm.length > 20 || !NB_BADGES.includes(a.p_badge)) return { ok: false, code: 'bad' };
      if (/shit|fuck|puta/i.test(nm)) return { ok: false, code: 'word' };
      if (db.hoodOf.has(uid)) return { ok: false, code: 'in' };
      if (!db.snaps.has(uid)) return { ok: false, code: 'snap' };
      if (db.nbLog.filter((l) => l.uid === uid && l.kind === 'make' && Date.now() - l.at < 864e5).length >= 3) return { ok: false, code: 'limit' };
      if ([...db.hoods.values()].some((h) => h.name.toLowerCase() === nm.toLowerCase())) return { ok: false, code: 'taken' };
      const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += abc[crypto.randomInt(32)];
      const h = { id: ++db.hoodId, name: nm, badge: a.p_badge, open: a.p_open !== false, code, leader: uid };
      db.hoods.set(h.id, h);
      db.hoodOf.set(uid, { hood: h.id, joined: Date.now() });
      hoodPost(h.id, uid, 'made');
      db.nbLog.push({ uid, kind: 'make', at: Date.now() });
      return { ok: true, id: h.id, name: nm, code };
    },
    farm_nb_find_v1(uid, a) {
      need(uid);
      const wk = nbWeek(), q = String(a.p_q || '').replace(INVISIBLE, '').trim().toLowerCase();
      return [...db.hoods.values()].filter((h) => { const l = hoodLead(h.id); return (q.length < 2 || h.name.toLowerCase().includes(q)) && l && !blocked(uid, l) && !banned(h.id, uid); })
        .map((h) => { const list = members(h.id); return { id: h.id, name: h.name, badge: h.badge, open: h.open, members: list.length, friends: list.filter(([id]) => coded(uid, id)).length, score: (db.cupHoods.get(wk + ':' + h.id) || {}).score || 0 }; })
        .filter((h) => h.members >= 1 && h.members < 30).sort((x, y) => y.friends - x.friends || y.open - x.open || y.score - x.score || y.members - x.members).slice(0, 20);
    },
    farm_nb_join_v1(uid, a) {
      need(uid);
      if (db.nbLog.filter((l) => l.uid === uid && l.kind === 'join' && Date.now() - l.at < 60e3).length >= 10) return { ok: false, code: 'slow' };
      db.nbLog.push({ uid, kind: 'join', at: Date.now() });
      if (db.hoodOf.has(uid)) return { ok: false, code: 'in' };
      if (!db.snaps.has(uid)) return { ok: false, code: 'snap' };
      const c = String(a.p_code || '').trim().toUpperCase();
      const h = c ? [...db.hoods.values()].find((x) => x.code === c) : db.hoods.get(Number(a.p_id));
      if (!h) return { ok: false, code: 'gone' };
      const n = members(h.id).length;
      if (!n) { db.hoods.delete(h.id); return { ok: false, code: 'gone' }; }
      const lead = hoodLead(h.id);
      if (lead && blocked(uid, lead)) return { ok: false, code: 'gone' };
      if (banned(h.id, uid)) return { ok: false, code: 'banned' };
      if (!c && !h.open) return { ok: false, code: 'code' };
      if (n >= 30) return { ok: false, code: 'full' };
      db.hoodOf.set(uid, { hood: h.id, joined: Date.now() });
      db.cupPicks.delete(uid);
      hoodPost(h.id, uid, 'join');
      fixLead(h.id);
      cupSeat(nbWeek(), h.id, n + 1, false);
      return { ok: true, id: h.id, name: h.name };
    },
    farm_nb_leave_v1(uid) {
      need(uid);
      const m = db.hoodOf.get(uid);
      if (!m) return 'out';
      db.cupPicks.delete(uid);
      hoodPost(m.hood, uid, 'left');
      hoodGone(uid);
      return 'ok';
    },
    farm_nb_set_v1(uid, a) {
      need(uid);
      const m = db.hoodOf.get(uid), h = m && db.hoods.get(m.hood);
      if (!h || hoodLead(h.id) !== uid) return 'leader';
      fixLead(h.id);
      h.open = !!a.p_open;
      return 'ok';
    },
    farm_nb_code_v1(uid) {
      need(uid);
      const m = db.hoodOf.get(uid), h = m && db.hoods.get(m.hood);
      if (!h || hoodLead(h.id) !== uid) return { ok: false, code: 'leader' };
      fixLead(h.id);
      const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += abc[crypto.randomInt(32)];
      h.code = code;
      return { ok: true, join_code: code };
    },
    farm_nb_kick_v1(uid, a) {
      need(uid);
      const m = db.hoodOf.get(uid), h = m && db.hoods.get(m.hood);
      if (!h || hoodLead(h.id) !== uid) return 'leader';
      const o = db.hoodOf.get(a.p_user);
      if (a.p_user === uid || !o || o.hood !== h.id) return 'none';
      fixLead(h.id);
      db.hoodBans.set(h.id + ':' + a.p_user, Date.now() + 7 * 864e5);
      db.cupPicks.delete(a.p_user);
      hoodPost(h.id, a.p_user, 'left');
      hoodGone(a.p_user);
      return 'ok';
    },
    farm_nb_members_v1(uid) {
      need(uid);
      const m = db.hoodOf.get(uid), wk = nbWeek();
      if (!m) return [];
      const lead = hoodLead(m.hood);
      return members(m.hood).filter(([id]) => !blocked(uid, id)).map(([id]) => {
        const done = db.cupDone.filter((d) => d.uid === id && d.week === wk && d.hood === m.hood);
        return { id, farm_name: db.players.get(id).farm_name, leader: lead === id, online: online(db.players.get(id)), tasks: done.length, points: done.reduce((n, d) => n + d.points, 0), me: id === uid };
      }).sort((x, y) => y.points - x.points);
    },
    farm_nb_post_v1(uid, a) {
      need(uid);
      const m = db.hoodOf.get(uid), msg = String(a.p_body || '').replace(INVISIBLE, '').trim().replace(/\s+/g, ' ').slice(0, 80);
      if (!m) return 'out';
      if (!msg) return 'empty';
      if (/shit|fuck|puta/i.test(msg)) return 'word';
      if (db.hoodPosts.filter((p) => p.uid === uid && p.kind === 'say' && Date.now() - p.at < 864e5).length >= 30) return 'limit';
      hoodPost(m.hood, uid, 'say', msg);
      return 'ok';
    },
    farm_nb_posts_v1(uid) {
      need(uid);
      const m = db.hoodOf.get(uid);
      if (!m) return [];
      return db.hoodPosts.filter((p) => p.hood === m.hood && !blocked(uid, p.uid)).sort((x, y) => y.id - x.id).slice(0, 40)
        .map((p) => ({ id: p.id, who: p.uid, farm_name: (db.players.get(p.uid) || {}).farm_name, kind: p.kind, body: p.body, ago: Math.floor((Date.now() - p.at) / 1000), mine: p.uid === uid }));
    },
    farm_cup_pick_v1(uid, a) {
      need(uid);
      const m = db.hoodOf.get(uid), wk = nbWeek(), today = nbDay();
      if (!m) return { ok: false, code: 'out' };
      if (db.guests.has(uid)) return { ok: false, code: 'guest' };
      const t = cupTasks(wk).find((x) => x.kind === a.p_kind);
      if (!t) return { ok: false, code: 'bad' };
      const pk = db.cupPicks.get(uid), mine = db.cupDone.filter((d) => d.uid === uid && d.week === wk);
      if (pk && pk.week === wk && pk.hood === m.hood) return { ok: false, code: 'busy', kind: pk.kind };
      if (mine.some((d) => d.kind === t.kind)) return { ok: false, code: 'done' };
      if (mine.length >= 6) return { ok: false, code: 'week' };
      if (mine.filter((d) => d.day === today).length >= 3) return { ok: false, code: 'day' };
      db.cupPicks.set(uid, { week: wk, kind: t.kind, goal: t.goal, points: t.points, minutes: t.minutes, hood: m.hood, at: Date.now() });
      return { ok: true, kind: t.kind, goal: t.goal, points: t.points, minutes: t.minutes };
    },
    farm_cup_drop_v1(uid) { need(uid); return db.cupPicks.delete(uid) ? 'ok' : 'none'; },
    farm_cup_done_v1(uid) {
      need(uid);
      const pk = db.cupPicks.get(uid), wk = nbWeek(), today = nbDay();
      if (!pk) return { ok: false, code: 'none' };
      if (pk.week !== wk) { db.cupPicks.delete(uid); return { ok: false, code: 'late' }; }
      const m = db.hoodOf.get(uid);
      if (!m || m.hood !== pk.hood) { db.cupPicks.delete(uid); return { ok: false, code: 'out' }; }
      if (db.guests.has(uid)) { db.cupPicks.delete(uid); return { ok: false, code: 'guest' }; }
      const wait = Math.ceil(pk.minutes * 60 - (Date.now() - pk.at) / 1000);
      if (wait > 0 && !db.cupFast) return { ok: false, code: 'soon', wait };
      const mine = db.cupDone.filter((d) => d.uid === uid && d.week === wk);
      if (mine.filter((d) => d.day === today).length >= 3) return { ok: false, code: 'day' };
      db.cupPicks.delete(uid);
      db.cupDone.push({ uid, week: wk, kind: pk.kind, hood: pk.hood, points: pk.points, day: today });
      const key = wk + ':' + pk.hood;
      cupSeat(wk, pk.hood, Math.max(members(pk.hood).length, new Set(db.cupDone.filter((d) => d.week === wk && d.hood === pk.hood).map((d) => d.uid)).size), true);
      const ch = db.cupHoods.get(key);
      ch.score += pk.points;
      ch.last = Date.now();
      hoodPost(pk.hood, uid, 'task', pk.kind + ':' + pk.points);
      return { ok: true, kind: pk.kind, points: pk.points, score: ch.score, place: cupPlace(wk, pk.hood) };
    },
    farm_cup_claim_v1(uid) {
      need(uid);
      const wk = nbWeek(), by = {};
      db.cupDone.filter((d) => d.uid === uid && d.week < wk).forEach((d) => { const k = d.week; by[k] = by[k] || {}; by[k][d.hood] = (by[k][d.hood] || 0) + d.points; });
      return Object.keys(by).sort().filter((w) => !db.cupClaims.has(uid + ':' + w)).map((w) => {
        const hid = Number(Object.keys(by[w]).sort((x, y) => by[w][y] - by[w][x])[0]), ch = db.cupHoods.get(w + ':' + hid), place = cupPlace(w, hid);
        db.cupClaims.add(uid + ':' + w);
        return Object.assign({ week: w, place, name: ch.name }, nbPrize(place, ch.score));
      });
    },
  };
  const adsRpc = {
    farm_market_ad_v1(uid) {
      need(uid);
      const today = nbDay(), a = db.ads.get(uid), next_s = 3600;
      if (!db.market.some((m) => m.seller === uid && !m.buyer && m.expires > Date.now())) return { ok: false, code: 'empty' };
      if (a && a.day === today) return { ok: false, code: 'used', until_s: Math.max(0, Math.floor((a.until - Date.now()) / 1000)), next_s };
      db.ads.set(uid, { day: today, at: Date.now(), until: Date.now() + 4 * 3600e3 });
      return { ok: true, until_s: 4 * 3600, next_s };
    },
    farm_market_ads_v1(uid) {
      need(uid);
      const open = (id) => db.market.filter((m) => m.seller === id && !m.buyer && m.expires > Date.now());
      const ads = [...db.ads.entries()].filter(([id, a]) => a.until > Date.now() && id !== uid && nbOk(id) && !blocked(uid, id) && (db.players.get(id).listed || areFriends(uid, id)) && open(id).length)
        .map(([id, a]) => ({ id, farm_name: db.players.get(id).farm_name, friend: areFriends(uid, id), at: a.at, left_s: Math.floor((a.until - Date.now()) / 1000), lots: open(id).length,
          items: open(id).sort((x, y) => x.price / x.qty - y.price / y.qty || x.id - y.id).slice(0, 3).map((m) => ({ item: m.item, qty: m.qty, price: m.price })) }))
        .sort((x, y) => (y.friend - x.friend) || y.at - x.at).slice(0, 30);
      const a = db.ads.get(uid);
      return { ads, mine: { on: !!a && a.until > Date.now(), until_s: a ? Math.max(0, Math.floor((a.until - Date.now()) / 1000)) : 0, used: !!a && a.day === nbDay(), hours: 4, next_s: 3600 } };
    },
  };
  Object.keys(nbRpc).forEach((n) => { rpc[n] = (uid, a) => { if (db.noHood) throw new Error('Could not find the function public.' + n + ' in the schema cache'); return nbRpc[n](uid, a); }; });
  Object.keys(adsRpc).forEach((n) => { rpc[n] = (uid, a) => { if (db.noAds) throw new Error('Could not find the function public.' + n + ' in the schema cache'); return adsRpc[n](uid, a); }; });

  // ----- signed live messages (supabase/farm_online_18.sql): each pair's key, only to one of the pair
  const lineSecret = crypto.randomBytes(32);
  rpc.farm_line_keys_v1 = (uid, a) => {
    if (db.noLineKeys) throw new Error('Could not find the function public.farm_line_keys_v1 in the schema cache');
    const topic = String(a.p_topic || '');
    if (!topicOk(uid, topic)) return null;
    if (!Array.isArray(a.p_peers) || a.p_peers.length > 40) return null;
    const out = {};
    a.p_peers.forEach((p) => {
      if (!p || p === uid || blocked(uid, p)) return;
      const [x, y] = pair(uid, p);
      out[p] = crypto.createHmac('sha256', lineSecret).update(topic + '|' + x + '|' + y).digest('hex');
    });
    return out;
  };

  // ----- Central Park (supabase/farm_online_19.sql; owner, 6 Nov 2026): one open place for every player, in three parks
  // of 30. A seat counts only while it was seen in the last 75 s (the game beats every 30 s), so a phone that closed never
  // keeps anyone out. Tests can age a seat by moving its seen back (db.parkSeats.get(uid).seen), or say the part is not
  // applied yet (db.noPark).
  const PARK = { cap: 30, freshMs: 75e3 };
  const cap = () => db.parkCap || PARK.cap; // (a test may lower it: db.parkCap)
  db.parkSeats = new Map(); // uid -> { park, seen }
  const seatFresh = (s) => Date.now() - s.seen < PARK.freshMs;
  const parkOthers = (uid, n) => [...db.parkSeats.entries()].filter(([id, s]) => id !== uid && s.park === n && seatFresh(s)).map(([id]) => id);
  const parkCounts = () => [1, 2, 3].map((n) => [...db.parkSeats.values()].filter((s) => s.park === n && seatFresh(s)).length);
  const parkRpc = {
    // p_park null = pick for me: stay in my park if my seat is fresh, else the park with the most friends that has
    // room, else the lowest park with room (Park 1 fills first). A park I am already in always has room for me.
    farm_park_join_v1(uid, a) {
      if (!uid) throw new Error('not signed in');
      if (!db.players.has(uid)) return { ok: false, code: 'not-player' };
      const want = a.p_park == null ? null : a.p_park;
      if (want !== null && ![1, 2, 3].includes(want)) return { ok: false, code: 'bad', counts: parkCounts() };
      for (const [id, s] of db.parkSeats) if (Date.now() - s.seen > 3600e3) db.parkSeats.delete(id); // (old seats out)
      const mine = db.parkSeats.get(uid);
      let pick = want;
      if (want === null) {
        if (mine && seatFresh(mine)) pick = mine.park;
        else {
          const open = [1, 2, 3].filter((n) => parkOthers(uid, n).length < cap())
            .map((n) => ({ n, friends: parkOthers(uid, n).filter((id) => areFriends(uid, id) && !blocked(uid, id)).length }))
            .sort((x, y) => y.friends - x.friends || x.n - y.n);
          if (!open.length) return { ok: false, code: 'full', counts: parkCounts() };
          pick = open[0].n;
        }
      } else if (parkOthers(uid, want).length >= cap()) return { ok: false, code: 'full', counts: parkCounts() };
      db.parkSeats.set(uid, { park: pick, seen: Date.now() });
      return { ok: true, park: pick, counts: parkCounts() };
    },
    // "still here": a stale seat comes back only if its park still has room; else it is gone (park null)
    farm_park_beat_v1(uid) {
      if (!uid) throw new Error('not signed in');
      const s = db.parkSeats.get(uid);
      if (s && !seatFresh(s) && parkOthers(uid, s.park).length >= cap()) db.parkSeats.delete(uid);
      const now = db.parkSeats.get(uid);
      if (now) now.seen = Date.now();
      return { ok: true, park: now ? now.park : null, counts: parkCounts() };
    },
    farm_park_leave_v1(uid) { if (!uid) throw new Error('not signed in'); db.parkSeats.delete(uid); return null; },
    farm_park_counts_v1(uid) { if (!uid) throw new Error('not signed in'); return { counts: parkCounts() }; },
  };
  Object.keys(parkRpc).forEach((n) => { rpc[n] = (uid, a) => { if (db.noPark) throw new Error('Could not find the function public.' + n + ' in the schema cache'); return parkRpc[n](uid, a); }; });
  require('./mock-bayanihan').install(rpc, db, need); // Bayanihan Projects (supabase/farm_online_20.sql)

  require('./mock-rank').install(rpc, db, { need, blocked }); // Town Rank and the Hall of Fame (part 22: test/mock-rank.js)
  require('./mock-raid')(rpc, db, need); // part 21: the Town Raid

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

  // A stand-in for the app's signed-in supabase-js client (only what the bridge uses). Like supabase-js 2.x, the client
  // keeps its channels in a list by topic: channel(topic) hands back one still in the list (even one on its way out),
  // a channel on its way out never subscribes again, and a channel that closes takes every channel of its topic out of
  // the list (RealtimeClient._remove filters by topic).
  function supabaseFor(uid) {
    let list = [];
    return {
      auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null }, error: null }) },
      async rpc(name, args) {
        const fn = rpc[name];
        if (!fn) return { data: null, error: { message: 'Could not find the function ' + name } };
        try { return { data: JSON.parse(JSON.stringify(fn(uid, args || {}) ?? null)), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; }
      },
      getChannels() { return list.slice(); },
      channel(room, opts) {
        const same = list.find((c) => c.topic === 'realtime:' + room);
        if (same) return same;
        const cfg = (opts && opts.config) || {};
        const c = {
          topic: 'realtime:' + room, room, n: ++nChan, key: (cfg.presence && cfg.presence.key) || uid, self: !!(cfg.broadcast && cfg.broadcast.self),
          listeners: [], state: null, tracked: false, presence: {}, joined: false, leaving: false, statusCb: null,
          on(type, filter, cb) { this.listeners.push({ type, event: filter.event, cb }); return this; },
          fire(type, event, arg) { this.listeners.forEach((l) => { if (l.type === type && (l.event === '*' || l.event === event)) l.cb(arg); }); },
          subscribe(cb) {
            if (this.leaving || this.joined) return this; // (a channel on its way out stays out)
            this.statusCb = cb || null;
            later(() => {
              if (this.leaving) return;
              // private channels: only farm:<id> and park:1-3 topics, for signed-in players (farm_topic_ok_v1)
              if (!topicOk(uid, room)) return cb && cb('CHANNEL_ERROR');
              if (!topics.has(room)) topics.set(room, new Set());
              topics.get(room).add(this);
              this.joined = true;
              if (cb) cb('SUBSCRIBED');
            });
            return this;
          },
          async track(state) { db.tracks.push({ uid, room, at: Date.now() }); this.state = state; this.tracked = true; later(() => sync(room)); return 'ok'; },
          async untrack() { this.state = null; this.tracked = false; setTimeout(() => sync(room), db.presenceLagMs || 0); return 'ok'; }, // (a real server tells the others a little after any broadcast)
          presenceState() { return this.presence; },
          async send(m) {
            const set = topics.get(room);
            if (!set || !this.joined) return 'error';
            db.sends.push({ uid, room, event: m.event, at: Date.now(), heard: set.size - 1 });
            for (const o of set) if (o !== this || this.self) later(() => o.fire('broadcast', m.event, { type: 'broadcast', event: m.event, payload: m.payload }));
            return 'ok';
          },
          // the server drops this phone (a network cut): it stays in the list, closed
          drop() {
            const set = topics.get(room);
            if (set && set.delete(this)) later(() => sync(room));
            this.joined = false;
            if (this.statusCb) this.statusCb('CHANNEL_ERROR');
          },
        };
        list.push(c);
        return c;
      },
      async removeChannel(c) {
        c.leaving = true;
        await new Promise((r) => setTimeout(r, db.leaveMs || 30)); // the server's answer to the leave takes a moment (or several seconds)
        const set = topics.get(c.room);
        if (set && set.delete(c)) later(() => sync(c.room));
        c.joined = false;
        list = list.filter((x) => x.topic !== c.topic);
        if (c.statusCb) c.statusCb('CLOSED');
        return 'ok';
      },
    };
  }

  // The server closes one player's line, as it does to a phone that updates its presence too often.
  const kick = (uid, room) => { for (const c of [...(topics.get(room) || [])]) if (c.key === uid) c.drop(); };

  return { supabaseFor, db, topics, kick, newUser: () => crypto.randomUUID() };
}

module.exports = { createServer };

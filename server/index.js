// Harvest Ville's game server (docs/game-server.md): node server/index.js
// Env: PORT (2567), HOST (127.0.0.1), SUPABASE_URL, SUPABASE_ANON_KEY (both needed: the phones' tokens are checked
// against that project), SUPABASE_JWT_ISSUER (optional; '' to not check it), FRAID_KEY (Farm Raids: the key in
// farm.fraid_secret, part 25; without it raids are not recorded). Stops cleanly on SIGTERM / SIGINT.
'use strict';
const { startServer } = require('./lib/server');
const { makeSupabaseAuth } = require('./lib/auth');
const { makeFraid } = require('./lib/fraid');
const { rules } = require('./lib/rules');

const env = process.env;
let auth;
try {
  auth = makeSupabaseAuth({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, issuer: env.SUPABASE_JWT_ISSUER });
} catch (e) {
  console.error('[game] ' + e.message);
  process.exit(1);
}

const fraid = env.FRAID_KEY ? makeFraid({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, key: env.FRAID_KEY, rules: rules() }) : null;
const app = startServer({ auth, fraid, port: Number(env.PORT) || 2567, host: env.HOST || '127.0.0.1' });
app.listening.then((a) => console.log('[game] listening on ' + a.address + ':' + a.port), (e) => {
  console.error('[game] cannot listen: ' + e.message);
  process.exit(1);
});

let going = false;
const stop = (sig) => {
  if (going) return;
  going = true;
  console.log('[game] ' + sig + ': stopping');
  app.stop().then(() => process.exit(0));
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

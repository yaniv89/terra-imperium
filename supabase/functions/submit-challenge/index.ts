// supabase/functions/submit-challenge/index.ts
// U36 (KTD16): RECORDS a challenge submission, nothing else. It never replays a log and never
// touches the leaderboard; the scheduled verifier does that. It inserts with the CALLER's JWT, so
// row-level security (supabase/migrations/0004_challenges.sql) decides, not this code. Review only,
// not deployed: see plans/U36-DEPLOY.md.
import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_BODY = 270000; // a little over MAX_LOG_BYTES (src/data/challenges.js)
// The game calls this from its own site, so the browser's preflight must pass. '*' is safe: the
// caller is named by its bearer token, never by a cookie.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const auth = req.headers.get('Authorization');
  if (!auth) return json(401, { error: 'sign in to submit' });
  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'log too large' });
  let b: any;
  try { b = JSON.parse(text); } catch { return json(400, { error: 'not JSON' }); }
  if (typeof b?.weekId !== 'string' || typeof b?.build !== 'string' || typeof b?.hash !== 'string' || !Number.isInteger(b?.score) || typeof b?.log !== 'object' || b.log === null) {
    return json(400, { error: 'bad submission' });
  }
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { error } = await client.from('challenge_submissions').insert({ week_id: b.weekId, build: b.build, claimed_hash: b.hash, claimed_score: b.score, log: b.log });
  return error ? json(400, { error: error.message }) : json(202, { queued: true });
});

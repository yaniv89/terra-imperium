// supabase/functions/resolve-turn/index.ts
// Server-authoritative action resolution (plan §10): "Clients submit actions, never state. The
// server replays the same pure engine with the same seed -> authoritative, cheat-proof result.
// The same module runs client-side for instant local feedback and fully offline skirmish."
//
// Imports the bundled engine (_engine.bundle.js, produced by `npm run build:edge` ->
// scripts/build-edge-engine.mjs) rather than src/engine/gameReducer.js directly — see that
// script's own header for why a bundle step is needed at all. Run `npm run build:edge` before
// `supabase functions deploy resolve-turn`; _engine.bundle.js is a regenerable build artifact
// (gitignored, like www/ and dist/), not something to hand-edit.
//
// Deliberately NOT wired to a live Supabase project in this pass — same as every other Phase F
// backend piece so far (supabase/migrations/0001_cloud_saves.sql, src/services/cloudSaves.js):
// this is the integration CODE, written and verified against the pure engine it wraps
// (scripts/build-edge-engine.test.mjs proves the bundle behaves identically to the source), not a
// deployed endpoint. Turn/action ownership — whether the caller is actually allowed to submit this
// action for this game — is Task 42's job (the lobbies/turn-ownership schema); this function
// trusts its caller completely, which is only safe once something in front of it enforces that.
import { gameReducer } from './_engine.bundle.js';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'expected a POST request' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { state, action } = body ?? {};
  if (!state || typeof state !== 'object' || !action || typeof action.type !== 'string') {
    return new Response(
      JSON.stringify({ error: 'expected a body of shape { state: object, action: { type: string, payload?: any } }' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // gameReducer is a pure function of (state, action) with no I/O and no Math.random() (turn
  // resolution reads state.rngSeed instead — see src/utils/rng.js) — replaying it here reproduces
  // exactly what the submitting client already computed locally, which is what makes this a real
  // tie-breaker of record rather than a second, possibly-divergent implementation.
  let nextState;
  try {
    nextState = gameReducer(state, action);
  } catch (err) {
    return new Response(JSON.stringify({ error: `reducer threw: ${err instanceof Error ? err.message : String(err)}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ state: nextState }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

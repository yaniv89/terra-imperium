# resolve-turn (Supabase Edge Function)

Server-authoritative action resolution for Terra Imperium's async multiplayer (plan §10). Replays
a submitted `{ state, action }` through the exact same pure reducer the client already ran
locally (`src/engine/gameReducer.js`), so the server's result is the tie-breaker of record.

## Before deploying

This function imports `./_engine.bundle.js`, a generated file — **not checked into git** (see
`.gitignore`) and not present until you build it:

```sh
npm run build:edge
supabase functions deploy resolve-turn
```

Re-run `npm run build:edge` (and redeploy) any time `src/engine/gameReducer.js` or anything it
imports from `src/data`/`src/utils` changes.

## What this does not do yet

No authorization: the function trusts that whoever calls it is allowed to submit this action for
this game. That check belongs with the lobbies/turn-ownership schema (plan §10's "turn ownership"),
not here — wiring it in is separate follow-up work, not something to fake with a partial check now.

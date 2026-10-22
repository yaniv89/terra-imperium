# Async multiplayer: design (differentiation plan U44)

Status: design only. No server, no Supabase change and no network code is written by this document.
It is meant to be cut into build units (section 9). Written 2026-10-22 against the code as it stands.

## 1. What we are building

Two to eight friends each play one people on one shared world, each on their own time, on a phone.
The format is the proven one from Through the Ages and Civ's play by cloud:

- Everyone plays a turn at the same time. A turn ends when every human has pressed End Turn, or a
  deadline passes. Then the world resolves once.
- You can open any of your games from one list, with a badge on the games waiting for you.
- You can take your moves back until you press End Turn. After that they are final.
- A text history of what happened since you last looked.

Not in the first version: real time play, spectators, voice, trading between players outside the
normal diplomacy cards, a public matchmaking list. Friends invite friends with a code.

## 2. What exists today

| Piece | What it is | Verdict |
|---|---|---|
| `src/services/multiplayer.js` | Lobby, seats, ready, `submitTurn`, `allPlayersSubmitted`, `resetTurnSubmissions`, `updateGameState`. Takes a Supabase client as a parameter, tested with a fake. | Keep the lobby half. The turn half stores the whole state and is replaced (section 4). |
| `supabase/migrations/0002_multiplayer.sql` | `games` (holds `state jsonb`), `game_players` (nation, ready, `turn_submitted_at`), RLS, max seats trigger. | Keep the tables. Add columns and a table (section 5). `nation_id` comment still says 240 nations: it is a people slug now. |
| `supabase/functions/resolve-turn` | Replays a posted action through the bundled engine. Trusts its caller. | Replace with a per-batch verifier (section 6). |
| `src/engine/actionLog.js`, `macroVerify.js` (U35) | A game is its start plus its ordered actions; replay gives the same state hash. | The core of the design. |
| `src/engine/challenges.js` (U36) | Pending submission, verifier replays, verdict. `CHALLENGES_ON` is false until the user deploys Supabase. | The same trust model; reuse the verifier job and the size caps. |
| `src/services/cloudSaves.js` | One private state per user. | Not used. A shared game is not a save. |

## 3. The hard part: the engine has one human

`gameReducer` and `resolveTurn` read `state.playerNationId` in 92 files (237 times in
gameReducer.js, 38 in resolveTurn.js, 40 in aiOperations.js). The AI skips the human nation, the
battle queue, events, prompts and fog all belong to that one nation. Making every seat a first
class player by editing all of that is the expensive way.

**Decision: seat swap, no engine fork.** One authoritative state, one `playerNationId` at a time:

1. To apply a seat's batch, set `state.playerNationId` to that seat's nation, run its actions
   through `gameReducer`, put the seat marker back. The reducer is pure, so this is safe.
2. Resolve the turn with a new set `state.humanNations` (seat nations). Anywhere the engine says
   "not the player, so the AI acts", it asks `isHuman(state, id)` instead (equal to
   `id === playerNationId || humanNations.includes(id)`). The call sites are in aiLogic.js,
   aiOperations.js, aiEconomy.js, resolveTurn.js and raids.js; the first job of MP2 is to list them
   all (grep `playerNationId` in those files: 38 hits in resolveTurn.js alone, many are "the player's
   own" reads that stay as they are). Everything that is "for the player" (events, prompts, battle
   queue) is stored per nation and read through the swap.
3. A battle against a human is not fought by Auto behind their back. Rule: a human defender gets
   the pending defense in their next session; if their deadline passes, Auto fights it (the
   existing `autoDefend` path). A battle between two humans is fought on Auto in v1 (like decision
   41, no man's land). Commanded battles between two phones are a later unit.

Open risk: events, `pendingDefenses`, `pendingPeaceOffer` and the research prompt are single
slots today (one per game, not per nation). They must become per nation before two humans can
share a world. This is the largest build unit (U-MP3).

## 4. Data flow: batches, not states

A client never uploads a state. It uploads the **actions of one turn** (a batch), like U35's log.

```
phone A                         server                          phone B
  | plays turn N locally          |                               |
  | End Turn: POST batch(N, A) -->| verify, store, mark A done    |
  |                               |<-- POST batch(N, B) ----------|
  |                               | all done: apply A then B      |
  |                               | (fixed order), resolveTurn,   |
  |                               | store hash(N+1), open N+1     |
  |<-- poll or push: N+1 ready ---|--- N+1 ready ---------------->|
  | pull the batches of N, replay |                               |
  | locally to the same hash      |                               |
```

- The batch is `{ gameId, turn, seat, actions[], clientHash? }`. Size cap like challenges
  (`MAX_LOG_BYTES` 262,144 per batch is plenty; `MAX_ACTIONS` per batch is cut to 500 because a turn has far fewer).
- Seat order inside a turn is fixed by seat number, never by arrival time, so the result does not
  depend on who pressed End Turn first. This is a rule in resolve order, written in the engine
  (`humanNations` sorted), not in the server.
- The server holds the log: `start` (the RESET_GAME payload, with `rngSeed`) plus all batches in
  order. Any client can rebuild the world by replay and compare the hash the server publishes
  for each turn. This is `macroVerify.verifyGame` run per turn.
- The state is never stored as truth. `games.state` (0002) becomes an optional snapshot every 10
  turns so a new device does not replay 300 turns (a replay of a long game is slow on a phone, not measured here, so MP8 measures it before
  fixing the snapshot interval).
- Who runs `resolveTurn` on the server: a scheduled job, the same Node verifier that U36 uses
  (`scripts/verifyChallenges.mjs` pattern, GitHub Actions or a Supabase scheduled function). It
  has the engine bundle (`npm run build:edge`). The job wakes every few minutes, finds games where
  all seats submitted or the deadline passed, resolves, and writes the new hash. A friends' game
  tolerates a few minutes of lag; a push notification is a later unit.

### Fog and secrecy

Replay needs the full state, so a modified client can read everything (other nations' armies,
fog). v1 accepts this: friends only, no ranked play, no prizes. It is stated in the lobby ("a
tool can see the whole map"). A later hardening unit would send each seat a state with other
nations' hidden facts removed, but then replay verification is per seat, not global, so it is a
different design and is out of scope.

## 5. Schema changes (a new migration, 0005, written but not applied)

Review only until the user deploys, exactly like 0004.

- `games`: add `start jsonb` (the RESET_GAME payload), `turn_deadline timestamptz`,
  `turn_hours integer default 48`, `last_hash text`. `state` stays as the optional snapshot.
- `game_players`: add `kind text` (`human` or `ai_takeover`), `missed_turns integer default 0`.
- New `game_turns`: `(game_id, turn, seat, actions jsonb, submitted_at)`, unique on
  `(game_id, turn, seat)`. Insert only by the seat's own user and only for the game's current turn
  (a trigger). Rows are read by seated players. The resolver role writes the verified hash on
  `games`, never the client. This mirrors 0004's trigger and verifier-role split.
- `game_events`: `(game_id, turn, text_key, params jsonb)` for the text history. Written by the
  resolver from the turn's logs. Clients render it with the existing message keys, so English and
  Hebrew both work.

## 6. Verifier and cheating

- Each batch is replayed by the resolver through `gameReducer` before it is accepted into the
  turn. An action the reducer rejects (not enough gold, not your city) is dropped and the seat
  is told which. The reducer is the one rulebook.
- Actions that name another nation as the actor are refused: the swap sets the actor from the
  seat, never from the payload.
- The published hash for a turn is the resolver's. A client whose local replay differs shows
  "out of sync, reload from the server", and loads the latest snapshot.
- Same size, rate and build checks as challenges (`ENGINE_BUILD`: a batch from another engine
  build is refused with "update the app", because a different build is a different rulebook).

## 7. The player's view

Phone first, 844x390 landscape.

- **Games list** (new screen from the start screen and the top bar): one row per game: people,
  turn number, "Your turn" or "Waiting for 2 of 4", time left. Tap to open. A game in play can be
  left and another opened without losing anything: a local game keeps its autosave, a shared game
  rebuilds from its log and snapshot.
- **Your turn** looks like today's campaign. The only change: End Turn becomes "Send turn".
  After sending, the screen shows "Waiting for N players" with a Take back button until the
  resolver has taken the batch (see undo).
- **Undo until End Turn.** Actions are held in a local pending list and applied to the local
  state as they are made, as now. "Undo" pops the last action and rebuilds the local state
  from the turn's start state plus the remaining actions (a replay of one turn, fast). End Turn
  uploads the list. Take back after sending is allowed only while the turn is still open and
  deletes the batch row. Random outcomes are seeded by the state, so replaying the same actions
  gives the same result and undo cannot be used to re-roll.
- **What happened** sheet after each resolve: the text history (`game_events`) of the turn, then
  the usual turn report. Chronicle (U28) records the shared game the same as a solo one.
- **Missed turns.** After the deadline the turn resolves without that seat. After 3 missed turns
  in a row the seat becomes `ai_takeover`: the AI plays it, and the player can take it back by
  opening the game. The host can also skip a seat.
- **Players.** Invite by 6-letter code. 2 to 8 seats (the 0002 limit). Everyone plays Stone Age
  start on the same `rngSeed`, same difficulty.

## 8. Not decided here

- Hosting for the resolver job and its cost: needs the user's Supabase deploy and the business
  model pick (U41/U42). Free tier is enough for a few friends' games.
- Push notifications (needs Capacitor plugin and a key; user's account).
- Whether two humans may fight a commanded battle (needs both phones live; later).

## 9. Build units (for the lead to cut)

Each is one lane. Order matters.

| Unit | Work | Files | Size | Needs |
|---|---|---|---|---|
| MP1 | Per nation slots: pending events, peace offers, defenses, research prompt move from one game slot to per nation; saves migrate. | `src/engine/events*.js`, `battleQueue.js`, `peace.js`, `research.js`, save version | large (the risk) | none |
| MP2 | `humanNations` and `isHuman`; AI skips every human; seat swap helper `applySeatBatch(state, seat, actions)`; fixed seat order; tests: 2 seats, same result in either arrival order. | `src/engine/seats.js`, `aiLogic.js`, `aiOperations.js`, `resolveTurn.js` | large | MP1 |
| MP3 | Batch format, size caps, `ENGINE_BUILD` check, `verifyTurn(start, batches)`; reuses `actionLog.js`, `macroVerify.js`. | `src/engine/turnBatch.js` | medium | MP2 |
| MP4 | Migration 0005 (review only) and the lobby service changes (`start`, deadline, `submitBatch`, `getBatches`). Fake client tests. | `supabase/migrations/0005_async_turns.sql`, `src/services/multiplayer.js` | medium | MP3 |
| MP5 | Resolver job: find ready games, apply batches, write hash and events. Runs on a plain Node script first, tested against a fake client. | `scripts/resolveGames.mjs` | medium | MP4, user deploy |
| MP6 | Games list screen, Send turn, waiting state, Take back, local undo, "what happened" sheet. English and Hebrew. mobile-check at 844x390 and 1600x900. | `src/components/multiplayer/` | large | MP4 |
| MP7 | Takeover by AI after missed turns; host skip; deadline display. | `seats.js`, `resolveGames.mjs` | small | MP5 |
| MP8 | Snapshots every 10 turns and "out of sync" recovery. | `resolveGames.mjs`, client loader | small | MP5 |

Cheap first cut that proves the design with no server: MP1 to MP3 plus a hot seat test (two
seats on one phone, pass the device). If MP2's tests show the same hash for either seat order,
the rest is plumbing.

## 10. Checks the build must pass

- Same `start` and same batches replay to the same state hash on Node and in the browser.
- Swapping the arrival order of two seats' batches gives the same hash.
- A batch naming another seat's city is refused and changes nothing.
- Undo then redo of the same actions gives the same hash as never undoing.
- 150 turns with 3 humans (scripted) and 20 AI: no stall, no NaN, `auditGameState` clean.
- `explore` mode (U43) is a start setting and rides in `start`, so a peaceful shared world works.

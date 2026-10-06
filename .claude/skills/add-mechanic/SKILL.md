---
name: add-mechanic
description: Checklist and pitfalls for adding or changing a game mechanic in Terra Imperium's deterministic macro engine (src/engine/, src/utils/aiLogic.js, src/data/) — economy, population, war, diplomacy, tech, buildings, resources, AI behaviour, anything resolveTurn runs. Use before writing code for any new system or rule, any formula or balance change, any new per-turn effect, or when wiring two systems together ("X should affect Y").
---

# Adding a mechanic to Terra Imperium

The macro game is one pure, seeded function per turn: `resolveTurn(state) -> state`
(src/engine/resolveTurn.js), plus player actions in `gameReducer` (src/engine/gameReducer.js).
Same state in, same state out, on every device. Saves, cloud sync and replays depend on it.

## 1. Design it as an interconnection, not an island
Write the rule as an explicit formula with named, exported constants, and name its ripples:
what feeds it and what it feeds (at least two downstream systems). Prefer feeding an EXISTING
lever over inventing a new one:
- population -> income and manpower already, via `getPopFactor` (src/engine/development.js)
- unrest via the `nextUnrest` inputs in resolveTurn's region phase
- stability via `national.stabilityBonus` (positive = less unrest)
- peace acceptance reads war score and `warExhaustion` (src/engine/peace.js)
- modifiers: `getModifier(state, id, key)` is the full sheet; `getNationBonusTotal(nation, key)`
  is nation-static only (government, policy, wonder, identity) and silently drops the stability
  level, legitimacy, overextension and techs. Know which one a consumer uses.

Bound everything (clamp, floors, caps, decay) so nothing snowballs over 1,000 turns.

## 2. Put the logic in a pure module
New file in src/engine/<topic>.js with a header comment that explains the model in plain words
and the formula, then small pure exported functions. Shapes to copy: aftermath.js (war costs),
vassals.js (liberty desire), techDiffusion.js, pacts.js, supplies.js.
- No `Math.random()` and no `Date.now()`. Randomness comes from the turn's `rng` (createRng,
  threaded through) or a deterministic hash roll such as `hashRoll(`${id}|${turn}`)` (aftermath.js).
- Return the same object when nothing changed and never mutate inputs, except the turn's own
  working copies inside resolveTurn (`regions`, `units`, `nations`, `resources`).

## 3. Wire it into the right place
- Turn order matters. resolveTurn phases: income -> region unrest/population -> rebellion ->
  supply attrition -> movement/reinforcement/morale -> AI growth/economy/rulers ->
  economy (upkeep, loans, bankruptcy) -> diplomacy (AE, pacts, vassals) -> great projects ->
  AI recruitment -> AI war declarations -> war progress -> war exhaustion -> events.
  A value a later phase reads this turn must be computed earlier (supplies are computed at
  income, hunger is applied in the morale phase).
- Player actions: the matching `case ActionTypes.X` in gameReducer.js.
- Battles: ONE place, `applyBattleOutcome` (battleOutcome.js), which every battle path calls
  (invasion, defence, landing, field, sea, rebels; Command and Auto); a battle input both modes
  must read goes in battleInputs.js, and the auto-resolve's model in autoBattle.js (rerun the
  battle-lab parityEco check after changing it).
  AI-vs-AI fighting is abstract, in `resolveWarProgress` (diplomacy.js).
- Wars: always through `declareWar` (diplomacy.js); it runs the defensive-pact call to arms.
- AI parity, decided explicitly: AI nations have `nation.economy` (gold, hr, techPoints,
  adm/dip/mil) but no metal stocks; AI research is `nation.tech.researched`, the player's is
  `state.techTree`. Only "Tier 1" AI nations declare wars (performance tiering), so the AI world
  is quiet by design.

## 4. Performance (2,028 regions x 240 nations)
- Never spread the whole `regions` map per item: `{ ...regions, [id]: r }` in a loop copies
  2,028 keys each time. Inside resolveTurn assign into the working copy: `regions[id] = next`.
- Cache per turn (a Map keyed by nation) or per object identity (WeakMap), as techDiffusion.js does.
- No O(regions) scan per nation per turn (getOverextension is one; AI paths skip it).
- Check speed with the balance-sim skill: `compare.sh <base-ref> 50 11` prints msPerTurn for the
  base and the working tree on the same machine at the same time (the sandbox varies by about
  10-20 ms, so never compare against a number from an earlier session). The hard 80 ms/turn
  budgets in aiQualityBenchmark.test.js run only with `PERF_CHECKS=1` on a dedicated machine.

## 5. Show it to the player
A number that changes silently doesn't exist for the player. Surface it where they look:
ProvinceModal.jsx (province stats), ResourceBadge.jsx plus resources.js (resources),
TechPanel.jsx, DiplomacyPanel.jsx, or a log line (`logs.push({ year, message, type })`).
Mobile first: everything must work at phone width.

## 6. Test it
- Unit tests next to the module (src/engine/<topic>.test.js): formula edges, caps, no-ops.
- An integration test through `resolveTurn` or `gameReducer` with a FIXED seed:
  `createInitialState({ playerNationId: 'fr', rngSeed: N })`. Fresh games get random seeds and
  unseeded tests turn flaky.
- Quiet the world in turn loops: every `HISTORICAL_EVENTS` id fired, `proceduralEventCooldown:
  999999`, `battleSettings: { autoDefend: true }`, and answer any `pendingPeaceOffer`.
  resolveTurn does nothing while an event, a peace offer or a defense battle is pending.
- Run the balance-sim skill for any balance-relevant change. src/engine/longRun.test.js already
  checks 150-turn determinism, finite numbers, no runaway and population floors.
- Check invariants with `auditGameState(state)` (src/engine/stateAudit.js) after any change that
  moves land, wars, vassals, units or treasuries.
- `npm run lint` (max-warnings 0) and `npx vitest run`: everything must pass. Long full-game
  tests (endgameReachability) can exceed their time limit on a loaded sandbox; rerun alone.

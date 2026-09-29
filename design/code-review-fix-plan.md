# Terra Imperium — Code Review Findings & Fix Plan

> Source: a full code review of the engine (war, diplomacy, economy, military, AI) plus UX review,
> with emphasis on mobile. Each finding names the file/line and a concrete failure scenario.
> Nothing here is implemented yet — this is the plan. Phases are ordered by impact: Phase 1 fixes
> the broken war model, which several other bugs grow out of.

---

## Phase 1 — The war/relations model (root cause of most bugs)

The core problem: war and relationship state is stored as **single per-nation flags**
(`nation.isAtWar`, `hostility`, `relationStatus`, `hasPeaceTreaty`, `hasTradeAgreement`,
`hasMilitaryPact`) that implicitly mean "relative to the player" — but AI-vs-AI code writes them too.
A nation can't have a relationship with more than one other nation at a time.

### 1.1 A nation can only be in one war (the bug you spotted)
- `diplomacy.js:137` — `declareWar` rejects any target whose `isAtWar` flag is set, and never checks
  the aggressor at all.
- Consequences:
  - Nobody can join an ongoing war or dogpile a nation already fighting someone.
  - A vassal can't declare independence while its overlord is busy (declareWar returns unchanged).
  - The player at war with A *can* declare on B (only the target is checked) — then making peace
    with A sets `player.isAtWar = false` (`gameReducer.js` SUE_FOR_PEACE / OFFER_PEACE /
    ACCEPT_PENDING_PEACE) while the war with B is still active. War exhaustion stops, and every gate
    reading `isAtWar` is now wrong.

### 1.2 Eliminated nations leave zombie war state
- `elimination.js:35` — wars are deleted, but the survivor's `isAtWar` is never cleared, and regions
  the dead nation occupied keep `occupiedBy` pointing at it.
- Player stays "at war" forever: war exhaustion climbs to 100 each turn, AI never targets them,
  can't be proposed to/allied; those occupied home regions yield no income forever.

### 1.3 AI-vs-AI wars corrupt player-relationship fields
- `diplomacy.js:146` / `concludeWar` (`:331`) — an AI-vs-AI war sets the target's `hostility` to 100,
  `relationStatus: WAR` on both, and afterwards `hasPeaceTreaty` + `COLD_PEACE` permanently.
- The Diplomacy panel shows "WAR" for nations not at war with you, peace-treaty counters and
  achievements inflate, and a later player war on either counts as "broke peace" (+40 permanent
  hostility floor).

### 1.4 Hostility "toward the player" used as general aggression
- `aiLogic.js:282` — coalitions against an AI runaway leader still raise hostility *toward the
  player* every turn. `shouldDeclareWar` (`:251`) scales every AI's war chance — even vs other AIs —
  by its hostility toward the player. Insulting one AI makes it attack random weak neighbors.

### 1.5 `peaceWith` event effect skips real peace
- `applyEventEffects.js:129` — clears `isAtWar` unconditionally, closes only player wars, skips
  `applyPeace`/`setTruce`. Occupations never lift; no truce, so war can restart next turn.

### 1.6 War ids aren't unique
- `diplomacy.js:166` — `war_${target}_${year}`. Two wars vs the same target in one year collide;
  every `w.id === war.id` update hits both; React keys duplicate.

### Fix (one coherent refactor)
1. Add a pairwise matrix: `state.relations[a][b] = { hostility, status, truceUntil, treaty, trade,
   pact, ae, opinion }` (symmetric fields mirrored, directional ones like hostility kept per side).
2. **Derive** "at war" from `state.wars` (`isAtWar(state, a)` = any active war naming `a`;
   `areAtWar(state, a, b)`). Delete the stored `isAtWar` flag — it can't drift if it isn't stored.
3. Wars become multi-party: `{ id, attackers: [], defenders: [], leaderA, leaderB, goal, score }`.
4. War ids from a monotonic counter (`state.nextWarSeq`), like `nextUnitSeq`.
5. Route every peace path (SUE_FOR_PEACE, OFFER_PEACE, ACCEPT, events, elimination) through one
   `endWar(state, warId, terms)` that lifts occupations, sets truces, and updates relations.
6. Save migration: build `relations` from existing flags (player row only), rebuild `wars` into the
   new shape; `backfillDefaults` handles the rest.

---

## Phase 2 — Military logic

### 2.1 You can't retake your own occupied provinces
- `gameReducer.js:1215` / `:1358` — LAUNCH_INVASION and AMPHIBIOUS_ASSAULT reject any target owned by
  the player. No LIBERATE action exists. Occupied provinces stay lost (no income, no recruiting) until
  the enemy offers peace — and their occupation score keeps climbing toward a forced peace at 90.
- Fix: gate on the **occupier** (`occupiedBy ?? owner`), not the owner. Recapturing your own land =
  liberation (restores control, no AE).

### 2.2 Offensives can only advance one province deep
- `gameReducer.js:1214` — invasions must launch from a region you *own*; occupied land doesn't count,
  and MOVE_ARMY (`:1161`) can't stage into occupied land either. Capital pushes are impossible.
- Defender list (`:1231`) counts every land unit in the target regardless of owner — your own or a
  third party's units get fed into the battle as defenders. Same bug at `diplomacy.js:380`.
- Fix: allow launch/move from any region you own **or occupy**; filter defenders to the occupier and
  its war allies only.

### 2.3 AI never counter-attacks
- AI defenders don't roll liberation/counter-attacks on their occupied provinces, so wars are
  one-directional. Add an AI "recover occupied land" priority above opportunistic expansion.

---

## Phase 3 — Diplomacy

### 3.1 Circular vassalage
- `gameReducer.js:2357` — VASSALIZE never checks whether the player is itself a vassal. A vassal can
  vassalize its own overlord, then ANNEX it.
- Fix: reject if `player.vassalOf` is set, or if the target is anywhere in the player's overlord chain.

### 3.2 Alliances, trade pacts and marriages do nothing in war
- `aiLogic.js:241` — `pickWarTarget` ignores pacts; nothing ever calls allies into a war.
  `hasMilitaryPact` is read only by the UI and one victory check.
- Fix (depends on Phase 1's multi-party wars):
  - **Call to arms**: defensive alliances auto-join; offensive calls are an accept/decline with an
    opinion cost for refusing.
  - AI won't target an ally, and weighs the target's allies' strength before declaring.
  - Royal marriage: opinion bonus + succession-claim casus belli.
  - Trade pacts: real per-turn gold both ways, broken automatically by war.

### 3.3 Silent reducer guards (partially fixed this session)
- Several diplomacy reducer cases silently `return state` on conditions the UI didn't know about
  (pact capacity, alliance acceptance, target engaged elsewhere, rival must border). Diplomacy panel
  now mirrors these with explicit log messages. **Still to do:** the same pattern exists in the
  Domestic/Military/Tech panels, whose shared `ActionButton` still uses the native `disabled`
  attribute (swallows taps with no feedback on mobile).
- Longer-term fix: have reducers return a structured rejection (`{ state, rejected: reason }`) or
  write the reason to the log themselves, so UI and engine can never drift apart again.

---

## Phase 4 — Economy

- **AI nations have no real treasury in peace terms** — `peace.js` only moves the player's gold, so
  gold/reparations terms are one-sided. Give AI economies (`nation.economy`) real participation in
  peace deals.
- **Occupied regions have no way back** outside peace (fixed by 2.1).
- Consider **war-time economy pressure**: blockades (naval control of sea lanes cuts trade income),
  occupation reducing the owner's manpower, war exhaustion raising unrest.

---

## Phase 5 — Tests & tooling

- Make the `aiQualityBenchmark` 80 ms/turn budget non-flaky: it misses by 2–5 ms under sandbox CPU
  contention even on unchanged code. Either profile `aiEconomy` (dominant phase) for a real win, or
  run the timing assertion with a median-of-N and a small tolerance.
- Add **multi-turn** integration tests for every player action. This session's worst bug (AI economy
  deleting every nation's `id` after turn 1) survived because every action test ran on a fresh turn-1
  state. A shared helper `stateAfterTurns(n)` would catch this class of bug.
- Add an invariant check run after every turn in tests: every `nations[k].id === k`, every active war
  references living nations, no `occupiedBy` pointing at an eliminated nation, no vassal cycles.

---

## Phase 6 — UX / UI (mobile first)

### 6.1 One hub per foreign nation
Today, dealing with a nation is split between the Diplomacy list (240 cards) and RegionInfoModal.
- **Tap any foreign region → a Nation sheet** for that nation, with tabs:
  - **Relations** — opinion, hostility, treaties, AE, truce timer, rival/ally status.
  - **War** — war score, occupied provinces (both directions), peace terms builder.
  - **Trade** — pacts, embargo, trade income.
  - **Covert** — espionage options, success odds, discovery risk.
  - **Vassal** — liberty desire, annex progress, tribute.
- Every action button shows **cost + requirements inline**, and a disabled action explains exactly
  why (not just greyed out).
- The Diplomacy tab becomes a filtered **directory** (At war / Neighbors / Allies / Rivals / All) that
  opens the same Nation sheet — one place, one code path.

### 6.2 Keep the map visible on mobile
Right now full-height sheets cover the map, so you can't see what your actions do.
- **Bottom sheets with snap points**: peek (~15%), half (~50%), full. Default to half; the map stays
  visible above it and **auto-pans/zooms so the relevant region sits in the visible area** (not under
  the sheet).
- Keep the **selected region outlined** while any sheet is open.
- **War status chips** floating on the map (e.g. "⚔ vs Egypt +23") — tap to open that war in the
  Nation sheet.
- **Event log → toast queue**: short-lived toasts for new events, with a swipe-up drawer for history,
  instead of a floating button that competes for space.
- Auto-hide/collapse the header, legend and minimap while panning; show them again on tap.
- Action results should **animate on the map** (arrows for war declarations, pulses for treaties)
  while the sheet is at half height — the effect system already exists (EffectsContext).

### 6.3 Clarity
- Show **ADM/DIP/MIL** with labels, not just icons — most confusion this session came from not
  knowing which pool an action spends.
- Per-turn income preview on End Turn ("+120g, +6 DIP next turn").
- An "Advisor" hint when you have unspent power pools about to hit their cap.

---

## Phase 7 — Gameplay suggestions (new systems / changes)

- **Multi-party wars with war leaders** (enabled by Phase 1): coalitions actually fight together; you
  can join an existing war on either side.
- **Casus belli variety**: claims, rivalry, liberation, humiliation, religious/cultural — each with
  different war goals, AE, and peace-term costs.
- **Real-time tactical battles** (Rise of Nations style) — spec already in
  `design/rts-invasion-battles-spec.md`. Build *after* Phase 1–2; the multi-party war model and the
  fixed invasion rules are prerequisites for it to feel right.
- **Trade routes** between regions (not just nation-level pacts), raidable by navies — gives the naval
  system real economic stakes.
- **Espionage expansion**: sabotage buildings, incite rebels, steal maps (fog of war), assassinate
  advisors — with a discovery/relations cost.
- **Great-power status**: top-N nations get extra diplomatic slots and can "guarantee" smaller ones,
  which feeds call-to-arms.
- **Starting-setup options** (discussed earlier): number of AI opponents, capital-only starts,
  unclaimed land that must be settled or conquered, with free-land rebellions.

---

## Suggested order of work

1. **Phase 1** (relations matrix + derived war state + multi-party wars + unique ids) — largest, but
   it removes the root cause of 1.1–1.6 and unlocks 3.2 and the RTS battles.
2. **Phase 2** (liberation, deep offensives, defender filtering, AI counter-attacks).
3. **Phase 3.1 + 3.3** (cheap, isolated fixes — can ship before Phase 1 if you want quick wins).
4. **Phase 5** invariants + multi-turn tests — add alongside Phase 1 so the refactor is protected.
5. **Phase 6** Nation hub + mobile bottom sheets.
6. **Phase 3.2 / 4 / 7** — alliances with teeth, economy depth, new systems.

# RON-Style Tactical Invasion Battles — Research & Specification

> Requested: "check what it'll take from us to do the fighting like in RON [Rise of Nations],
> that we invade land and then an RTS fight begins." This document is research-and-design only —
> nothing here has been implemented. It audits what the game already has, what a real-time
> tactical battle would need on top of that, what can be reused almost unchanged, what's genuinely
> new engineering, and a phased plan to build it without destabilizing the existing (and heavily
> tested) turn-based combat math.

## 1. Framing: what "RON-style" actually means for this game

Rise of Nations itself is a fully real-time game start-to-finish (no separate turn-based layer at
all) — armies that meet anywhere on the map fight immediately, in real time, under direct player
control (move, target, retreat, keep building reinforcements mid-fight) rather than an instant
dice-roll. That's the specific quality being asked for: **live tactical control during a fight**,
not RON's whole game loop. Our game is turn-based at every other layer (economy, diplomacy, tech,
the calendar) and should stay that way — only the *moment combat happens* would gain a real-time,
player-controlled interlude. This is much closer to what Total War does (turn-based campaign map,
real-time tactical battles) than to porting RON wholesale, and the spec below is written on that
basis.

## 2. Current state audit

### 2.1 Combat today: `src/engine/battle.js`
`resolveBattle()` is a **pure, synchronous, deterministic** function: given both sides' unit lists,
terrain, and an RNG, it resolves an entire engagement in one call — Deployment (combat-width caps
the front line) → Ranged → Shock (melee) → Flanking (reserve cavalry) → Morale/rout checks →
Pursuit. Every hit runs through one shared multiplier stack (`dealDamage`): class counters,
promotions, generals, roster-age advantage, terrain, siege-vs-fortification. No positions, no
movement, no player input mid-battle — it returns `{ outcome, attackerUnits, defenderUnits,
report }` and the caller applies the result immediately.

### 2.2 Trigger points: `src/engine/gameReducer.js`
Four reducer cases call `resolveBattle()` directly, each inline in one action:
`LAUNCH_INVASION`, `AMPHIBIOUS_ASSAULT`, `NAVAL_ENGAGEMENT`-style cases, and
`SUPPRESS_REBELLION`. Each does the same thing: resolve the whole fight synchronously, then apply
XP, siege/control damage, capture, war score, and a log line — all in the same reducer call.
`LAUNCH_INVASION` (gameReducer.js:1209) is the fullest example and the natural first target for
this feature.

### 2.3 Units have no spatial data
A unit is `{ id, classId, strength, morale, commanderId, promotions, domain, regionId, movesLeft,
lastBattleTurn }`. No position, no movement speed, no attack range, no facing — everything is
abstract. This is the single biggest gap versus anything RTS-shaped, and adding it is the crux of
the new engineering work below.

### 2.4 What already models "battlefield shape" abstractly
- **Combat width** (`src/data/combatWidth.js`): terrain caps how many units fight at once
  (3–6 depending on terrain), already the right lever for "how big/open is this map."
- **Terrain** (`src/data/terrain.js`): 9 terrain types (plains/mixed/desert/urban/forest/island/
  hills/mountains/arctic), each with an attacker-damage modifier and an attrition modifier. These
  map naturally onto physical battlefield features (mountains → narrow pass, forest → cover/
  ambush lanes, urban → chokepoints/buildings) if a real arena is ever drawn.
- **Fortification**: `defenseLevel`/`local.fortLevel` reduce attacker damage and gate whether siege
  units get their bonus (`isAttackingFortification`) — this is a physical "walls" concept already,
  just resolved as a flat multiplier rather than a drawn structure.

### 2.5 Scale: most battles have no human audience
The world has 240 nations, and AI-vs-AI conquest (a shipped feature, plan item #32) means dozens of
battles can resolve in a single turn that the player never sees. **A live tactical view can only
matter for battles the player personally fights** (as attacker, or if we ever add "defend against
an AI invasion" as its own prompt) — everything else must keep auto-resolving through the existing
`resolveBattle()`, unchanged. This bounds the whole feature's real scope enormously.

### 2.6 Determinism and the multiplayer scaffold
`resolveBattle()` takes a seeded RNG (`state.rngSeed`) and is built to replay identically — this is
explicitly for the multiplayer story (a Supabase edge function, `supabase/functions/resolve-turn`,
scaffolds server-authoritative turn resolution, plan §M0.5/§41). A live, player-driven real-time
battle is **not** naturally deterministic/replayable the same way (a human's mid-battle orders are
a new source of "input" a server can't predict) — noted as a real constraint in §7, not solved here.

### 2.7 Existing UI to reuse, not replace
- `src/components/modals/BattleSummaryToast.jsx` — the current post-battle report screen.
- `EffectsContext`'s `triggerEffect`/camera-fly-to-region behavior — already flies the map to the
  fought-over region for every action, combat included.
- The project's existing icon pipeline (game-icons.net, pulled via npm per this project's own
  history) — a ready source of unit-class icons for a tactical renderer.
- `src/engine/battle.test.js` and the project's existing long-run simulation-harness pattern (plan
  item #37, "Endgame reachability long-run simulation harness") — the template for how this project
  already validates combat-shaped systems statistically rather than by hand.

## 3. The core architectural decision

**Keep `resolveBattle()` as the engine of record. Add a second, opt-in way to arrive at the exact
same result shape, `{ outcome, attackerUnits, defenderUnits, report }`, instead of rewriting
combat.** When the player personally launches an invasion, offer a choice — *Auto-Resolve* (today's
instant behavior, byte-for-byte unchanged) or *Command the Battle* (new real-time tactical view) —
exactly like Total War's battle-resolution choice. Every reducer case's **post**-battle code (XP
award, control/siege damage, capture, war-score recording, the log line) stays completely untouched
either way; only the **pre**-battle "how do we get outcome/attackerUnits/defenderUnits" step gets a
second implementation. This turns "rewrite the combat system" into "add an alternative front-end
that produces the same output," which is both far less risky to the game's existing balance/tests
and far more achievable as a scoped project.

## 4. New systems required

### 4.1 Battlefield generation
A small, **fixed library of arena templates keyed by terrain type** — reuse the same 9 keys
`combatWidth.js`/`terrain.js` already use, so no new per-region data is needed. Each template is a
bounded 2D space (e.g. a tile grid or open coordinate space) with a handful of obstacle/cover
features appropriate to that terrain (mountains → a narrow central pass; forest → scattered cover
blocking line of sight/movement; urban → building chokepoints; plains → wide open). Fortification
(`defenseLevel`/`local.fortLevel`) adds a drawn wall/keep structure at the defender's spawn edge
when `isAttackingFortification` is true. This avoids needing real per-region geography — exactly
the same "terrain TYPE drives mechanics, not per-region uniqueness" choice `combatWidth.js` already
made.

### 4.2 Unit spatial model (additive, battle-scoped only)
Add battle-only fields that exist **only for the duration of a tactical session** and are discarded
when it ends (the strategic unit keeps exactly its current shape otherwise): `position {x, y}`,
`facing`, `moveSpeed`, `attackRange` (0 = melee-adjacency, >0 = ranged). Add a small per-classId
speed/range table to `src/data/unitClasses.js`, e.g.:

| classId | moveSpeed | attackRange | notes |
|---|---|---|---|
| infantry | slow | melee (0) | the backbone, holds ground |
| cavalry | fast | melee (0) | flanks, pursues |
| ranged | slow | long | damage before contact, as today |
| siege | very slow | long (vs. fortification only) | helpless alone, as today |
| air | fast | medium | ignores terrain movement cost |
| support | slow | short/AA range | non-combat early, AA in Modern age |

Existing `strength`/`morale`/`classId`/`promotions`/`commanderId` remain the source of truth for
the damage multiplier stack — nothing about *how hard a unit hits* changes, only *where it is and
how it gets there*.

### 4.3 Real-time tick simulation — the one genuinely new "engine" module
A new, deliberately **pure** module, `src/engine/tacticalBattle.js`, mirroring `battle.js`'s own
engineering standard: `advance(battleState, dtMs, orders) => nextBattleState`, no `Math.random()`,
no DOM/React — fully unit-testable headless, exactly like `resolveBattle()` is today. A fixed
timestep (e.g. 10 ticks/sec) drives:
- **Movement**: units path toward their current order's target (straight-line is fine for v1;
  simple obstacle avoidance around template features later).
- **Continuous damage**: convert `battle.js`'s per-hit multiplier stack into a **per-tick DPS**
  formula — same multipliers (counters, promotions, generals, roster age, terrain, siege), just
  `damage-per-tick = strength * BASE_DAMAGE_RATE_PER_TICK * multiplier * variance` instead of one
  atomic exchange, tuned so a full engagement takes roughly 30–90 real seconds.
- **Morale bleed**: identical formula to today's `moraleLoss` derivation, applied per tick instead
  of per phase.
- **Rout behavior**: a routed unit stops taking orders and paths away from the nearest enemy —
  the real-time analogue of today's `markRouted`.
- **Pursuit**: cavalry within some leash range auto-chases fleeing units, mirroring
  `pursuitPhase`'s intent (today's flat 50% extra-loss-on-rout becomes continuous chase damage).

Because this module stays pure, the interactive React layer's only job is calling `advance()` every
animation frame with the current player/AI orders and rendering whatever it returns — the
simulation itself can be tested completely headless, the same way `battle.test.js` already tests
`resolveBattle()`.

### 4.4 Player command surface
- **Select** (tap a unit, or drag-select on desktop).
- **Move** (path to a point).
- **Attack-move** (path toward a point, auto-engage anything in range en route).
- **Focus fire** (target a specific enemy unit/stack).
- **Retreat/withdraw** (order units off the player's own map edge) — this maps directly onto the
  existing "a failed invasion falls back to origin" behavior `LAUNCH_INVASION` already has.
- **Promotion abilities**: perks that are currently always-on passives (e.g. Volley Fire's "ranged
  unit gets a free second shot") could become player-activated, cooldown-gated abilities instead —
  a nice-to-have for later, not required for v1 (they can simply stay passive/automatic inside the
  tick sim with zero UI cost).

A player-initiated retreat before the arena forces an end should still produce a real result: map
it onto the **existing** `outcome` values `resolveBattle()` already returns — `'stalemate'` if both
sides still have survivors when the player disengages, `'defender'`/`'attacker'` if one side was
already broken. No new outcome vocabulary needed.

### 4.5 AI-controlled opponent (combat micro only)
Needed whenever the human isn't commanding both sides — the overwhelming majority of player
battles, since most invasions target AI nations. A **small, separate, reactive controller** is
enough for v1: hold position until an enemy enters some aggro radius, then attack-move the nearest
enemy stack; order a retreat once its own front has lost ~60% strength or morale (the real-time
analogue of `battle.js`'s own rout threshold, just applied continuously). This is explicitly **not**
the same thing as the strategic AI (`aiEconomy.js`/AI goals, which decide *whether* to go to war) —
it's a much smaller, purely tactical controller scoped to one active arena at a time.

### 4.6 Rendering
A new, dedicated component, e.g. `src/components/battle/TacticalBattleView.jsx`, drawing to a
plain `<canvas>` — **not** `react-globe.gl` or the d3 flat-map renderer, which are both built for
the whole-world strategic map and are the wrong tool for a small bounded arena. It renders the
arena template, unit icons (reusing the existing icon pipeline), health/morale bars, and
order-feedback (move markers, selection outlines, range indicators). Mounted as a new full-screen
overlay at the same layer in `App.jsx`'s existing overlay stack as `ConflictChooserModal`/
`GameOverModal`, triggered from wherever the "Attack"/invasion action currently lives
(`RegionInfoModal`, per plan item #115) instead of dispatching `LAUNCH_INVASION` immediately.

### 4.7 Result hookup
On battle end (a side's whole force broken/routed with no reserves, a time limit reached, or the
player retreats), package final unit strengths/morale into the exact
`{ outcome, attackerUnits, defenderUnits, report }` shape and dispatch a new action,
`RESOLVE_TACTICAL_BATTLE`. Its reducer case is **~95% the same code already in `LAUNCH_INVASION`**
(control/siege damage, capture, XP award, war-score recording, the log line) — the only difference
is where the three values came from. This is what makes §3's "same output shape" decision pay off
directly in the implementation.

## 5. What's reused almost as-is

| Existing piece | Reused as |
|---|---|
| `battle.js`'s per-hit multiplier stack | The per-tick DPS formula's multiplier |
| `combatWidth.js` | Arena "how many units matter at once" sizing |
| `terrain.js` | Arena template selection + attacker/defender modifiers |
| `LAUNCH_INVASION`'s post-battle code (XP/war-score/capture) | `RESOLVE_TACTICAL_BATTLE`'s reducer, near-verbatim |
| `BattleSummaryToast.jsx` | Unchanged, shown after either resolution path |
| `EffectsContext`'s camera-fly-to-region | Flies to the region right before the tactical view opens |
| The game-icons.net icon pipeline | Unit sprites |
| `battle.test.js` / plan #37's simulation-harness pattern | Template for testing `tacticalBattle.js` headless and for a "tactical vs. auto-resolve parity" statistical check |

## 6. What's genuinely new (the real cost)

- `src/engine/tacticalBattle.js` — the tick simulation engine itself (movement, targeting,
  continuous damage/morale, rout/pursuit). The one substantial new "engine" module, but a natural
  sibling to `battle.js`, not a rewrite of it.
- A small tactical-only AI controller (§4.5).
- `TacticalBattleView.jsx` and its canvas rendering/input-handling — comparable in *kind* of effort
  to building the globe renderer (this project's own Phase 12), though smaller in scope since the
  arena is a small bounded space, not a whole planet.
- Per-class `moveSpeed`/`attackRange` data (§4.2).
- **Mobile touch controls for an RTS surface** — genuinely the hardest UX problem here. RTS control
  schemes (drag-select, right-click-to-move) don't port to touch well. Recommend a deliberately
  simplified touch scheme for v1: tap a unit → tap a destination/target, plus a "select all" button,
  rather than attempting full desktop-style multi-select on a phone.

## 7. Explicitly out of scope for v1

- **AI-vs-AI battles ever rendering live** — always auto-resolve via the existing `resolveBattle()`.
  No player benefit, and a real cost across potentially dozens of simultaneous AI wars per turn.
- Fog of war / vision mechanics inside the arena.
- Persistent unit positions carried between turns or battles — a tactical session is bounded and
  self-contained; units return to abstract `regionId`-only bookkeeping the instant it ends, same as
  today.
- Extending this to naval engagements or `SUPPRESS_REBELLION` — the pattern could reach there later,
  but land `LAUNCH_INVASION` (and possibly `AMPHIBIOUS_ASSAULT`'s landing phase) is the only
  proposed v1 trigger.
- Server-authoritative / multiplayer-safe tactical battles (recording and deterministically
  replaying a human's live orders) — deferred; v1 assumes the same single-player, client-trusted
  resolution the game already runs on today. This is a real, open constraint against the
  multiplayer scaffold (§2.6), not a solved problem.
- Hand-built, per-region-unique battle maps — reuse ~9 terrain-type templates, not 200+ bespoke
  ones.

## 8. Suggested phased build plan

**Phase 1 — prove the concept.** `tacticalBattle.js` engine + a bare-bones canvas view, one terrain
template (plains), player vs. the simple AI controller, reachable only from a dev/debug entry
point. Validate the tick simulation's outcomes statistically match `resolveBattle()`'s expected
win-rates for the same matchups (a new sibling to plan #37's simulation harness: run both
resolution paths across many seeded matchups and confirm they agree on who tends to win).

**Phase 2 — wire into the real flow.** Auto-Resolve / Command-the-Battle choice surfaced from
`RegionInfoModal`'s invasion action; all 9 terrain templates; `AMPHIBIOUS_ASSAULT` landing support;
the simplified mobile touch scheme; `BattleSummaryToast` integration; `RESOLVE_TACTICAL_BATTLE`
wired to the real `LAUNCH_INVASION`-derived reducer logic.

**Phase 3 — polish.** Promotion abilities as activated commands where it makes sense (Volley Fire,
etc.); animation/visual quality pass; optionally, "you are being invaded — Auto-Resolve or Command
the Defense?" as a new prompt when an AI attacks the player (today the player only ever initiates
combat personally; being invaded is a new trigger point this spec doesn't otherwise require).

## 9. Effort estimate

Comparable in size to this project's own Phase 12 (globe renderer) and the original phased-battle
work (plan item #16) **combined** — a genuinely new simulation-plus-rendering-plus-input subsystem,
not a modification of an existing one. Realistically a multi-session engineering effort, not a
single sitting. Recommend tracking it as its own numbered plan item (this project's next major
milestone letter/number) with §8's phases as its checklist, matching how every other major system
here has been scoped and tracked.

## 10. Open questions before implementation starts

1. Should being **invaded** by an AI ever offer Command-the-Battle (defending), or only when the
   player personally initiates an attack? Defending mid-invasion adds a real "interrupt whatever
   the player is doing" UX problem that turn-based games don't usually have to solve.
2. Is Auto-Resolve meant to stay the default/primary path indefinitely (tactical battles as an
   optional flavor feature), or is the long-term goal to make tactical battles the norm and
   auto-resolve the fallback for when the player doesn't want to bother?
3. Any appetite for saving or quitting mid-battle, or should a tactical session be uninterruptible
   once started? (Uninterruptible is simpler and recommended for v1.)

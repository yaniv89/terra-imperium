# Tactical Battles — Implementation Plan (RTS invasions, Auto or Command)

> Request: "when we invade a region we can select to **auto battle** (existing battle system) or
> **manually battle** — RTS in the style of Rise of Nations / Age of Empires / Red Alert 2, but
> modern and adapted to 2026, mobile-friendly all the way. Detailed, with code, so nothing breaks
> on implementation."
>
> This plan **supersedes** `design/rts-invasion-battles-spec.md` (the earlier research note). That
> spec deferred fog of war, being invaded, multiplayer determinism and serious touch controls as
> "not v1 / not solved". Every one of those has a concrete design below.

---

## 0. TL;DR — the decisions that shape everything

| # | Decision | Why |
|---|---|---|
| D1 | **Auto-resolve stays `resolveBattle()` byte-for-byte.** Command mode is a second front-end that produces the *same* `{ outcome, attackerUnits, defenderUnits, report }` shape. | Balance, 1,700+ tests and AI-vs-AI wars stay untouched; only one reducer gets a new input path. |
| D2 | **One strategic unit = one squad** on the battlefield, drawn as N soldiers (N ∝ strength). | Maps 1:1 back to `state.units`; the sim only simulates ~12–30 squads, which a phone can run in well under 1 ms per tick. RoN/AoE-like visual mass costs nothing. |
| D3 | **Deterministic fixed-step sim (20 Hz, integer math, seeded RNG) in a Web Worker**, rendered with interpolation on the main thread. | 60 fps rendering on phones with the sim off the UI thread; identical replays → save/resume after the app is backgrounded, a desync detector, and server-verified multiplayer later. |
| D4 | **Rendering: three.js (already in the bundle at r186 via react-globe.gl), orthographic isometric camera, instanced meshes.** Units and buildings are **extruded 3D tokens generated at runtime from our existing game-icons SVG paths** (`UNIT_ICON_PATHS`, `BUILDING_ICON_PATHS`) with three's `SVGLoader`. | A modern Red Alert 2-style isometric look with zero art pipeline and zero new render dependency. |
| D5 | **No citizen economy inside battles.** RoN's economy is replaced by **Battle Supply**, earned by holding capture points and spent on reserves, reinforcements and commander powers. | The turn layer already owns the economy; gathering micro on a phone is misery. Keeps battles at 2–6 minutes. |
| D6 | **The combat-width rule becomes RoN's population cap.** The strongest `combatWidth` squads deploy (same `deploy()` rule as auto-resolve); the rest wait off-map as reserves you call in with Supply. | Direct parity with auto-resolve, and a hard performance bound per terrain. |
| D7 | **Being invaded is supported without interrupting turn resolution:** AI assaults on defended player regions are **queued as defense battles** and fought before the player's next turn starts (Auto or Command). | This solves the "interrupt mid-turn" problem the old spec couldn't. |
| D8 | **Mobile-first controls**: tap-to-select, tap-to-order, drag-a-line formations, a thumb-zone command bar, class-selection chips, a **tactical pause** (single-player), and long-press radial menus with strict gesture disambiguation. Desktop gets box-select, right-click and hotkeys on top. | Company of Heroes mobile proved radial wheels work *if* they never fight with panning. |

MVP (shippable) = milestones **T0–T5** (§17). RoN depth (supply/attrition, generals' abilities,
powers, fog, reinforcements) = **T6–T7**. Defense battles = **T8**. Naval/amphibious, garrisons and
polish = **T9**.

---

## 1. Research — how Rise of Nations' battle systems work, and what we take

### 1.1 Rise of Nations (Big Huge Games, 2003) — the systems that matter for combat

| RoN system | How it works in RoN | What we do with it |
|---|---|---|
| **National borders & attrition** | Cities and forts project territory. Enemy military units inside your territory take continuous attrition damage unless supplied. Towers can research "patriotism" techs that raise attrition for invaders. | **Adopt.** The battlefield is split into defender territory (around the keep and forts) and neutral ground. Attackers in defender territory bleed strength unless near a friendly Support squad or general. Our region `defenseLevel` and fort buildings raise the rate (patriotism analog). §8.3 |
| **Supply wagons** | Support units that eliminate attrition for nearby troops, which makes them prime targets. Melee units get bonus damage against them. | **Adopt, 1:1.** Our existing `support` class *is* the supply wagon (Baggage Train, Engineers, Pioneers, Sappers); in the Modern age it is the Anti-Air battery. §8.3 |
| **Generals** | Support unit. Gives +2 armor aura to nearby units. Abilities: **Forced March** (speed burst), **Ambush** (nearby units invisible until they attack; countered by scouts and lookouts), **Entrenchment** (sandbag wall; less frontal and splash damage, flanks unaffected, only inside friendly territory), **Create Decoys** (fake copies draw fire). | **Adopt.** Our `state.hiredCommanders` attached to a unit (`commanderId`) spawns as a general on the field with an aura and four abilities. Personalities (`cautious`/`reckless`/`siegemaster`/`logistician`) each add one signature ability. §8.4 |
| **Formations & flanking** | Formations have a front, flank and rear. **Flank hits +100% damage, rear hits +50%.** Formations include Line, Echelon Left/Right and Refused (wraps siege, protects both flanks). Units in formation move at the slowest member's speed. | **Adopt, tuned.** Facing-aware damage using our existing `FLANK_BONUS_MULT = 1.3`, so auto-resolve and command stay in parity, plus a rear bonus of 1.5. Formations: Line, Column, Wedge and Box (≈ Refused). Groups speed-match. §8.1 |
| **Counters** | Hard counters force mixed armies. | **Already ours** — `getCounterMultiplier` (1.75 / 0.6). Used unchanged per hit. |
| **Cities, capture & assimilation** | Reduce a city's HP to 0, then move infantry or cavalry next to an uncontested city to capture it. **Assimilation** takes about 2.2 min, during which the city produces and repairs nothing. | **Adopt.** The region's **Keep** has HP from `defenseLevel` + fort level. At 0 HP, capture by holding it uncontested with infantry or cavalry (our `OCCUPATION_CAPABLE_CLASSES`) for a 30 s assimilation. That is the attacker's decisive win. §8.5 |
| **Population cap / commerce cap** | Pop cap starts at 25 and rises with Military research to 200. Commerce cap limits gather rates. | **Adapt.** The field cap is `combatWidth` squads per side (D6); the rest are reserves. The Supply income cap scales with the region's infrastructure (commerce-cap analog). |
| **Line of sight, scouts, lookouts, spies** | LoS upgrades matter. Scouts and lookouts reveal ambushes. Spies are separate units. | **Adopt fog of war** per side (§8.7). Cavalry has long sight and reveals ambushes. Our new **espionage intel** (`src/engine/intel.js`) pre-reveals enemy structures and garrison positions when you have intel on the owner. |
| **Nukes & the Armageddon clock** | Launching nukes has diplomatic and economic consequences, and the world ends after N detonations. Missile Shield counters it. | **Adapt.** An in-battle **Missile Strike** or **Nuclear Strike** commander power consumes a real missile from `nation.missiles` (`tactical/theatre/icbm/nuclear`, `src/data/missiles.js`). Using a nuke routes the strategic consequences through the same code path as the existing missile action. §8.8 |
| **Conquer the World** (RoN's campaign) | A Risk-like turn map: diplomacy, move armies, spend tribute, play **bonus cards**. Attacking starts a **real-time battle on a map that corresponds to the territory**, with the enemy's strength taken from the territory. You usually get **reinforcement armies** mid-battle. | **This is our design's closest ancestor.** Maps are generated from the real region (terrain, buildings, coast, neighbours). Enemy strength = its real garrison. Reinforcements come from *your real adjacent regions*, arriving from the edge that faces them geographically. §7, §8.6 |

### 1.2 Age of Empires / Red Alert 2 — what we borrow

| From | System | Our version |
|---|---|---|
| RA2 | **Veterancy**: veteran (1 chevron) and elite (3 chevrons) from kills worth 3× own cost; elite self-heals and gets a better weapon. | We already have XP ranks (`recruit→legendary`, `src/data/promotions.js`). In battle XP accrues **from damage dealt** and is paid out through the existing `awardXp`. Chevrons are drawn on squads. Promotion perks become live effects: Volley Fire becomes an ability, Unbreakable prevents the first rout. §8.9 |
| RA2 / AoE | **Garrisoning** civilian buildings and towers with infantry. | Infantry or ranged squads can garrison the keep or towers: damage reduction plus a ranged attack from the building. §8.10 (T9) |
| RA2 | **Superweapons with visible timers**, and **engineers capturing tech buildings**. | **Commander powers** with visible cooldown rings, age-gated and fed by strategic assets (satellites, missiles). Neutral **capture points** (the region's deposits: copper mine, iron foundry, oil well) captured by any squad give Supply and vision. |
| AoE | Keep/Town Center shoots arrows and can be garrisoned. | The Keep and towers have an automatic ranged attack scaled by `defenseLevel`. |

### 1.3 Mobile RTS control lessons (2019–2026)

- **Company of Heroes (iOS/Android, Feral)** ships two schemes: a *Command Panel* (abilities in a
  bottom-right panel) and a *Command Wheel* (tap-and-hold a squad → radial abilities). Box select is
  **double-tap then drag**. Players' main complaint: the **radial wheel triggers accidentally
  while panning**. → Our gesture recognizer (§11) gives panning priority and only opens a radial on a
  stationary long-press *on a selected squad*.
- Games that do well on phones (CoH mobile, Art of War 3, Warcraft Rumble-style lane games)
  converge on the same rules: **no precision tapping, 44–48 px minimum targets, thumb-zone command
  bars, select-by-type chips, and a pause/slow-mo option**.

---

## 2. Player experience, end to end

```
Region sheet (foreign, at war)  ─ "Invade from Bavaria" ─►  BATTLE CHOICE SHEET
                                                              ├─ Auto-resolve   (instant, today's result + toast)
                                                              │     shows: predicted win chance 62% (Monte Carlo, §13)
                                                              └─ Command battle ─► LOADING (map generated, ~300 ms)
                                                                                    │
                                   DEPLOYMENT (≤ 20 s, skippable) ◄──────────────────┘
                                   drag squads inside your zone, pick formation,
                                   "Auto-deploy" = same front/reserve split as auto-resolve
                                                    │
                                   LIVE BATTLE (2–6 min, 1×/2× speed, tactical pause)
                                   objectives: destroy the garrison OR take the Keep
                                   (HP → 0, then 30 s assimilation), hold capture points for Supply
                                                    │
                                   END: victory / defeat / time-out (defender holds) / you retreat
                                                    │
                                   RESULT SCREEN (casualties, XP, promotions earned, "Continue")
                                                    │
                                   RESOLVE_TACTICAL_BATTLE → the SAME post-battle code as
                                   LAUNCH_INVASION: siege control damage, occupation, XP,
                                   war score, log, BattleSummaryToast
```

Defending (T8): at the start of your turn, a banner reads **"Seljuks are assaulting Anatolia — 2
battles to fight"**. Each battle opens the same choice sheet with you as the defender.

**Rules that keep it fair and simple:**
- Command battles cost the **same** as Launch Invasion (`ACTION_COSTS.launchInvasion`), paid when the
  battle begins.
- You cannot end the turn while a battle is pending. The End Turn button reads "Finish battle
  first", with an **"Auto-resolve it"** shortcut.
- Quitting mid-battle = retreat: survivors go home and the outcome is `'defender'`.
- Closing the app mid-battle → the battle is saved (a command log plus a snapshot every 10 s) and
  resumes where you left it (§12).

---

## 3. Architecture

```
┌────────────────────── main thread (React) ──────────────────────┐   ┌────── Web Worker ──────┐
│ BattleChoiceSheet ─► dispatch(BEGIN_TACTICAL_BATTLE)            │   │ battle.worker.js       │
│ TacticalBattleScreen                                            │   │  ├ createWorld(setup)  │
│  ├ BattleRenderer (three.js, interpolates between snapshots) ◄──┼───┤  ├ step() @ 20 Hz      │
│  ├ InputController (gestures → Orders) ─────────────────────────┼──►│  ├ applyOrders()       │
│  ├ HUD (React: command bar, chips, powers, minimap, timer)      │   │  ├ tacticalAI.think()  │
│  └ on 'ended' → toStrategicResult() → dispatch(RESOLVE_...)     │   │  └ hash() for desyncs  │
└──────────────────────────────────────────────────────────────────┘   └────────────────────────┘
          ▲                                                                   │
          └─────────── src/battle/setup/buildBattleSetup.js (pure, from GameState) ─┘

src/battle/                     ← new top-level folder, pure where it matters
  setup/buildBattleSetup.js     pure: GameState + invasion → BattleSetup (seeded)
  setup/mapgen.js               pure: terrain template + noise → tiles, structures, points
  sim/fixed.js                  fixed-point + trig tables
  sim/world.js                  struct-of-arrays world
  sim/step.js                   the tick: orders → AI → move → combat → morale → objectives
  sim/combat.js                 per-hit damage, sharing battle.js's multiplier stack
  sim/pathing.js                flow fields + spatial hash
  sim/abilities.js              generals, powers, perks
  sim/tacticalAI.js             enemy commander
  sim/result.js                 toStrategicResult(world) → resolveBattle-shaped result
  sim/hash.js                   world checksum
  worker/battle.worker.js       message loop around sim/*
  worker/battleClient.js        main-thread wrapper (Promise + event API)
  render/BattleRenderer.js      three.js scene, instancing, interpolation
  render/tokenFactory.js        SVG path → extruded geometry (units/buildings)
  render/terrainMesh.js
  input/gestures.js             pointer-event gesture recognizer
  input/orders.js               gesture → Order translation
src/components/battle/
  BattleChoiceSheet.jsx  TacticalBattleScreen.jsx  BattleHud.jsx  BattleResultScreen.jsx
```

**Purity rules** (enforced by the existing `src/engine/enginePurity.test.js` pattern, extended to
`src/battle/sim/**` and `src/battle/setup/**`):
- No `Math.random`, `Date.now`, DOM or React.
- No floating-point trig in the sim: use lookup tables.
- Iterate in stable ID order.

This is what makes a battle replay identically from `(setup, commandLog)`.

---

## 4. Data model

### 4.1 Strategic state additions (`src/engine/gameReducer.js` → `createInitialState`)

```js
// createInitialState — new top-level keys (plain backfill handles old saves: no migration needed)
pendingBattle: null,     // the one tactical battle currently in progress, see below
pendingDefenses: [],     // T8: queued AI assaults on defended player regions
battleSettings: { defaultMode: 'ask', speed: 1, showTutorialHints: true } // 'ask' | 'auto' | 'command'
```

```js
// state.pendingBattle shape (set by BEGIN_TACTICAL_BATTLE, cleared by RESOLVE/ABANDON)
{
  id: 'b_17_3',                  // `b_${turnNumber}_${counter}`, unique per save
  kind: 'invasion',              // 'invasion' | 'amphibious' (T9) | 'defense' (T8)
  fromRegionId: 'de-by',
  targetRegionId: 'at-9',
  warId: 'w_4',
  attackerNationId: 'de',
  defenderNationId: 'at',
  seed: 3141592653,              // drawn from state.rngSeed at BEGIN; state.rngSeed advances once
  attackerUnitIds: ['u12', 'u13', 'u15'],
  defenderUnitIds: ['u88', 'u90'],
  startedTurn: 17,
  playerSide: 'attacker'         // 'attacker' | 'defender'
}
```

Units in `attackerUnitIds`/`defenderUnitIds` are **locked**: MOVE_ARMY, DISBAND_UNIT, EMBARK_UNIT,
PROMOTE_UNIT and APPOINT_GENERAL reject a locked unit (a one-line guard: `isUnitInBattle(state, id)`).

### 4.2 BattleSetup (pure output of `buildBattleSetup`, input to the worker)

```js
{
  version: 1,
  seed: 3141592653,
  terrain: 'hills',                       // getRegionTerrain(targetRegionId, REGIONS_DATA)
  combatWidth: 4,                         // getCombatWidth(terrain)
  map: { w: 96, h: 64, tiles: Uint8Array, height: Int16Array }, // see §7
  structures: [ { id:'keep', kind:'keep', x, y, hp, maxHp, side:'defender', fortLevel } , ... ],
  points: [ { id:'p_iron', kind:'deposit', resId:'iron', x, y, owner: null }, ... ],
  zones: { attackerDeploy: {x0,y0,x1,y1}, defenderDeploy: {...}, defenderTerritoryRadius: 28 },
  sides: {
    attacker: { nationId:'de', ageId:'kingdoms', color:'#3b82f6', squads:[SquadSpec...], reserves:[SquadSpec...],
                reinforcementSources:[{ regionId:'de-bw', edge:'W', unitIds:['u40'] }], powers:['rallyCry', ...] },
    defender: { ... }
  },
  modifiers: {                             // precomputed ONCE from the strategic state, so the sim never reads GameState
    attackerBaseMult: 0.9,                 // attackerPenalty * defenseLevel reduction * ZoC * roster * terrain (exactly what resolveBattle gets)
    defenderBaseMult: 1.0,
    isAttackingFortification: true,
    attritionPerMinute: 0.024,             // §8.3
    intel: { attackerSeesDefender: true }  // canSeeRegionDetails(state, targetRegionId) for the player side
  },
  generals: { g3: { id:'g3', personality:'reckless', name:'Rommel' } } // state.hiredCommanders subset
}
```

`SquadSpec` is a **copy** of the strategic unit plus derived battle stats:
```js
{ unitId:'u12', classId:'cavalry', strength:870, maxStrength:1000, morale:92, xp:160,
  promotions:['shock'], commanderId:'g3', ageId:'kingdoms' }
```

### 4.3 World (sim state) — struct-of-arrays for speed and cheap snapshots

```js
// src/battle/sim/world.js
export const MAX_SQUADS = 64; // both sides, including reserves and reinforcements — ample for combat width 6

export const createWorld = (setup) => {
  const n = MAX_SQUADS;
  return {
    tick: 0,
    setup,
    rngState: setup.seed >>> 0,
    count: 0,
    // identity
    unitId: new Array(n), side: new Uint8Array(n), classIdx: new Uint8Array(n), alive: new Uint8Array(n),
    onField: new Uint8Array(n),                // 0 = reserve/off-map
    // kinematics — fixed point Q8 (1 tile = 256)
    x: new Int32Array(n), y: new Int32Array(n), vx: new Int32Array(n), vy: new Int32Array(n),
    facing: new Uint8Array(n),                 // 0..255 = full circle, see fixed.js tables
    speed: new Int32Array(n),                  // Q8 tiles per tick
    // combat
    strength: new Int32Array(n), maxStrength: new Int32Array(n), morale: new Int32Array(n),
    cooldown: new Int16Array(n), targetSlot: new Int16Array(n).fill(-1),
    routed: new Uint8Array(n), routImmunityUsed: new Uint8Array(n),
    xpEarned: new Int32Array(n), engaged: new Uint8Array(n), // engaged=1 once it ever dealt/took damage (for XP like deployedIds)
    // orders
    order: new Uint8Array(n), orderX: new Int32Array(n), orderY: new Int32Array(n), orderTarget: new Int16Array(n).fill(-1),
    formationGroup: new Int16Array(n).fill(-1),
    // per-squad static refs (kept as plain arrays — read-only after spawn)
    promotions: new Array(n), commanderId: new Array(n),
    // side-level
    supply: [0, 0], powerCooldowns: [{}, {}], log: [], events: [],
    structures: setup.structures.map((s) => ({ ...s })),
    points: setup.points.map((p) => ({ ...p, captureProgress: 0 })),
    fog: [new Uint8Array(setup.map.w * setup.map.h), new Uint8Array(setup.map.w * setup.map.h)],
    ended: null                                 // { outcome, reason } once over
  };
};
```

Why SoA: every tick loops "for each alive squad"; typed arrays keep that cache-friendly and
**snapshots are a `buffer.slice()` per array** (§12), transferable to the main thread with zero copy.

---

## 5. T0 — refactors first (zero behavior change, proven by tests)

### 5.1 Share the damage multiplier stack between auto-resolve and the sim

Today `dealDamage` in `src/engine/battle.js` computes the multiplier inline. Split it so both
paths call **one** function:

```js
// src/engine/battle.js  (exported; dealDamage now calls it — no numeric change)
export const computeHitMultiplier = (unit, target, { phase, sourceIsInvadingFortification, generals, targetIsDefendingSide, baseMultiplier = 1 }) => {
  let multiplier = getCounterMultiplier(unit.classId, target.classId) * baseMultiplier;
  if (unit.classId === 'siege') {
    multiplier *= applySapperToSiegeMultiplier(unit, sourceIsInvadingFortification, getSiegeMultiplier(sourceIsInvadingFortification));
  }
  multiplier *= getPromotionDamageMultiplier(unit, { phase, isAttackingFortification: sourceIsInvadingFortification });
  multiplier *= getGeneralDamageMultiplier(generals[unit.commanderId], phase, unit.classId);
  multiplier *= getPromotionDefenseMultiplier(target, { isDefendingSide: targetIsDefendingSide });
  multiplier *= getGeneralDefenseMultiplier(generals[target.commanderId]);
  return multiplier;
};

const dealDamage = (rng, phase, unit, target, ctx, log) => {
  if (unit.strength <= 0 || target.strength <= 0) return;
  const roll = rng.next();
  const variance = 1 + (roll * 2 - 1) * RNG_VARIANCE;
  const multiplier = computeHitMultiplier(unit, target, { ...ctx, phase });
  const damage = Math.max(0, Math.round(unit.strength * BASE_DAMAGE_RATE * multiplier * variance));
  // ... unchanged below
};
export { BASE_DAMAGE_RATE, RNG_VARIANCE, MORALE_ROUT_THRESHOLD, FLANK_BONUS_MULT, PURSUIT_EXTRA_LOSS_MULT };
```

**Proof of no change:** add a golden test. Run `resolveBattle` over 500 seeded random matchups
**before** the refactor, store the JSON, and assert deep equality after:

```js
// src/engine/battle.golden.test.js
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import golden from './__fixtures__/battle-golden.json'; // generated once by scripts/gen-battle-golden.mjs from the PRE-refactor commit

it('refactor keeps every resolveBattle result identical', () => {
  golden.cases.forEach(({ input, expected }) => {
    const got = resolveBattle({ ...input, rng: createRng(input.seed) });
    expect(got).toEqual(expected);
  });
});
```

### 5.2 Extract LAUNCH_INVASION's pre- and post-battle halves

`LAUNCH_INVASION` (gameReducer.js ≈ L1250) becomes three pure helpers plus a thin case. This lets
auto and command share **validation** and **consequences** exactly:

```js
// src/engine/invasion.js (new)
export const validateInvasion = (state, fromRegionId, targetRegionId) => {
  const fromRegion = state.regions[fromRegionId];
  const targetRegion = state.regions[targetRegionId];
  if (!fromRegion || fromRegion.owner !== state.playerNationId) return { ok: false, reason: 'not_your_region' };
  if (!targetRegion || targetRegion.owner === state.playerNationId) return { ok: false, reason: 'bad_target' };
  if (!getNeighborIds(fromRegionId).includes(targetRegionId)) return { ok: false, reason: 'not_adjacent' };
  const war = state.wars.find((w) => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner));
  if (!war) return { ok: false, reason: 'no_war' };
  if (!canAfford(state.resources, ACTION_COSTS.launchInvasion)) return { ok: false, reason: 'cost' };
  const attackerUnits = Object.values(state.units).filter((u) => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'land' && !isUnitInBattle(state, u.id));
  if (attackerUnits.length === 0) return { ok: false, reason: 'no_units' };
  if (!attackerUnits.every((u) => (u.movesLeft ?? 1) > 0)) return { ok: false, reason: 'no_moves' };
  const defenderUnits = Object.values(state.units).filter((u) => u.regionId === targetRegionId && u.domain === 'land');
  return { ok: true, war, fromRegion, targetRegion, attackerUnits, defenderUnits };
};

// Everything resolveBattle needs, computed once — the sim receives the same numbers (§4.2 modifiers).
export const getInvasionBattleContext = (state, { targetRegionId, targetRegion, defenderUnits }) => {
  const isDefended = defenderUnits.length > 0;
  const terrain = getRegionTerrain(targetRegionId, REGIONS_DATA);
  return {
    terrain,
    isDefended,
    isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
    attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
    defenderAgeId: state.age,
    generals: state.hiredCommanders,
    defenderDamageReductionMultiplier: isDefended
      ? getDefenseLevelDamageReductionMultiplier((targetRegion.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total)
        * getZoneOfControlMultiplier(state.regions, targetRegionId, targetRegion.owner)
      : 1
  };
};

// The ENTIRE post-battle half of today's LAUNCH_INVASION, moved verbatim: siege control damage,
// XP (deployed only), occupation, stack moves, war score, the log line, lastBattleReport.
export const applyInvasionResult = (state, { fromRegionId, targetRegionId, war, targetRegion, isDefended }, battle, { rngSeed, extraControlDamage = 0 }) => {
  /* ...lines 1302-1375 of today's reducer, unchanged, reading outcome/attackerUnits/defenderUnits/report from `battle`... */
};
```

```js
// gameReducer.js — LAUNCH_INVASION becomes:
case ActionTypes.LAUNCH_INVASION: {
  const { fromRegionId, targetRegionId } = action.payload;
  const v = validateInvasion(state, fromRegionId, targetRegionId);
  if (!v.ok) return state;
  const ctx = getInvasionBattleContext(state, { targetRegionId, ...v });
  const rng = createRng(state.rngSeed);
  const battle = resolveBattle({ attackerUnits: v.attackerUnits, defenderUnits: v.defenderUnits, rng, ...ctx });
  const paid = { ...state, resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion) };
  return applyInvasionResult(paid, { fromRegionId, targetRegionId, war: v.war, targetRegion: v.targetRegion, isDefended: ctx.isDefended }, battle, { rngSeed: rng.getSeed() });
}
```

Every existing LAUNCH_INVASION test in `GameContext.test.js` must pass **unchanged**. That is the
T0 exit gate.

---

## 6. Unit stats on the battlefield

### 6.1 Class base table (`src/battle/data/battleStats.js`)

Units: tiles/second, tiles, seconds. HP = the strategic `strength` (so casualties map back 1:1).

| class | speed | range | min range | sight | attack every | soldiers drawn (at full strength) | notes |
|---|---|---|---|---|---|---|---|
| infantry | 1.6 | 0.9 (melee) | – | 7 | 1.0 s | 12 | can capture the keep and points, can garrison |
| cavalry | 3.2 | 0.9 (melee) | – | 10 | 1.0 s | 8 | charge: +25% on the first hit after moving ≥ 4 tiles; reveals ambush within 3 |
| ranged | 1.5 | 7 | – | 9 | 1.4 s | 10 | fires over friendlies |
| siege | 0.9 | 11 | 3 | 8 | 3.0 s | 3 | ×`getSiegeMultiplier` vs structures; splash radius 1.2 |
| air (Modern) | 5.0 | 4 | – | 12 | 1.2 s | 3 | flies (ignores terrain), **can't capture**, 45 s sortie then returns to its edge to rearm for 15 s |
| support | 1.4 | 0 / 8 (AA) | – | 7 | – / 1.0 s | 4 | early ages: supply aura (§8.3); Modern: Anti-Air, attacks air only |

### 6.2 Age overrides (the same class plays differently per `UNIT_ROSTER` age)

```js
// src/battle/data/battleStats.js
import { UNIT_ROSTER } from '../../data/unitClasses';

const T = (tilesPerSec) => Math.round((tilesPerSec * 256) / 20); // → Q8 tiles per tick @ 20 Hz
const S = (sec) => Math.round(sec * 20);                           // → ticks

export const CLASS_BASE = {
  infantry: { speed: T(1.6), range: 230, minRange: 0, sight: 7, attackTicks: S(1.0), soldiers: 12, melee: true },
  cavalry:  { speed: T(3.2), range: 230, minRange: 0, sight: 10, attackTicks: S(1.0), soldiers: 8, melee: true },
  ranged:   { speed: T(1.5), range: 7 * 256, minRange: 0, sight: 9, attackTicks: S(1.4), soldiers: 10 },
  siege:    { speed: T(0.9), range: 11 * 256, minRange: 3 * 256, sight: 8, attackTicks: S(3.0), soldiers: 3, splash: 307 },
  air:      { speed: T(5.0), range: 4 * 256, minRange: 0, sight: 12, attackTicks: S(1.2), soldiers: 3, flying: true, sortieTicks: S(45), rearmTicks: S(15) },
  support:  { speed: T(1.4), range: 0, minRange: 0, sight: 7, attackTicks: 0, soldiers: 4, supplyAura: 6 * 256 }
};

// Gunpowder and Modern turn "melee" lines into shooters; Modern cavalry are tanks.
export const AGE_OVERRIDES = {
  gunpowder: { infantry: { range: 4 * 256, melee: false, attackTicks: S(1.6) }, cavalry: { speed: T(3.0) } },
  modern: {
    infantry: { range: 5 * 256, melee: false, speed: T(1.9), attackTicks: S(1.0) },
    cavalry: { range: 6 * 256, melee: false, speed: T(3.0), soldiers: 4, attackTicks: S(1.8) },       // Tanks
    ranged: { range: 9 * 256, attackTicks: S(2.0) },                                                    // ATGM teams
    support: { range: 8 * 256, attackTicks: S(1.0), airOnly: true, supplyAura: 0 }                      // Anti-Air
  }
};

export const getBattleStats = (classId, ageId) => ({ ...CLASS_BASE[classId], ...(AGE_OVERRIDES[ageId]?.[classId] || {}) });
export const getDisplayName = (classId, ageId) => UNIT_ROSTER[ageId]?.[classId]?.name || classId;
```

### 6.3 Damage over time — tuned to match auto-resolve

Auto-resolve deals `strength × 0.1 × multiplier` per **exchange**. The sim converts that to a per-hit
amount with a calibration constant, `EXCHANGE_SECONDS`: how many seconds of continuous contact equal
one auto-resolve exchange. It starts at 6 s and gets tuned by the parity harness (§14).

```js
// damage for one attack (ticks since last attack = stats.attackTicks)
const perHitFraction = (BASE_DAMAGE_RATE * (stats.attackTicks / 20)) / EXCHANGE_SECONDS; // 0.1 * 1.0s / 6s ≈ 0.0167
damage = round(attackerStrength * perHitFraction * computeHitMultiplier(...) * facingMult * variance)
```

At equal 1000 vs 1000 with a neutral multiplier, a fight takes about 90 s. The battle clock is
6 min with typical engagements of 2–4 min, which is right for mobile sessions.

Morale per hit reuses auto-resolve's rule **verbatim**:
`moraleLoss = round(damage / 25 × getPromotionMoraleLossMultiplier(target))`. It routs at
`MORALE_ROUT_THRESHOLD` (20).

---

## 7. Battlefield generation — maps built from the real region

Each battle is generated from the region you're attacking: **same region → same map** (seeded by
`hash(regionId)`), so re-attacking a region you already fought over is familiar ground. Only
unit placement varies with the battle seed.

### 7.1 Size and layout
- **Map size** comes from combat width: `w = 64 + combatWidth × 8`, `h = 48 + combatWidth × 4`.
  Plains (6) is 112×72; mountains (3) is 88×60.
- **Orientation:** the attacker deploys on the edge facing the region they come from. The bearing
  from `REGION_COORDINATES[target]` to `REGION_COORDINATES[from]` is snapped to N/E/S/W, and the
  defender sits on the opposite side with the Keep.
- **Reinforcement edges:** every adjacent region owned by a side, with units in it, gets an entry
  point on the edge matching its real bearing. Reinforcements visibly arrive from the direction of
  the province they come from.

### 7.2 Terrain templates (the 9 keys `terrain.js`/`combatWidth.js` already use)

| terrain | generator recipe | gameplay effect |
|---|---|---|
| plains | low noise, a few tree clumps | open field; cavalry heaven |
| mixed | medium noise, farms (fields) + woods + a stream with 2 fords | balanced |
| hills | high-amplitude noise → ridges | **high ground: +15% ranged range, −15% damage taken from lower ground** |
| forest | 55% forest tiles in blobs, 3 cut lanes | forest: −30% speed, blocks sight beyond 2 tiles, **ambush ground** |
| mountains | two impassable massifs + one **central pass** 6–10 tiles wide | chokepoint, width 3 by design |
| desert | dunes (slow sand), an oasis capture point | attrition ×1.2 (terrain.js already says so) |
| arctic | snowfields (−20% speed), frozen lake | attrition ×1.25 |
| urban | street grid of building blocks (impassable), plazas | chokepoints; garrisonable buildings (T9) |
| island | coast on 2 edges, beach | amphibious landing zone (T9) |

Tile codes (`Uint8Array`): `0 open, 1 forest, 2 water (impassable, air ok), 3 rock (impassable),
4 road (+25% speed), 5 sand/snow (−20%), 6 ford (−40%), 7 building (impassable, garrisonable)`.

### 7.3 Region data → battlefield features (why the dossier data matters)

| Strategic data | Battlefield |
|---|---|
| `defenseLevel` + `local.fortLevel` (fortLevel) | Keep HP = `1500 + 750 × fortLevel`. Walls ring the keep at fortLevel ≥ 2 (gates are attackable). Towers = `floor(fortLevel / 2)` (each a ranged attacker). |
| `regionData.isCapital` | The keep becomes a **city** (bigger, +50% HP, 2 towers minimum) |
| `buildings.categories.*` | Cosmetic town buildings; `defense` category tier adds +1 tower per tier |
| `buildings.extraction[res]` / deposits | **Capture points** (mine, foundry, oil well): Supply +2/s and vision |
| `currentInfrastructure` | Roads between keep, points and edges (more infrastructure → more roads) |
| `isCoastal` | One edge becomes coast (naval support/amphibious in T9) |
| `unrest` ≥ 50 | A neutral **rebel camp** squad spawns and attacks whoever is nearest (flavor + chaos) |

### 7.4 Deterministic generator skeleton

```js
// src/battle/setup/mapgen.js
import { createRng } from '../../utils/rng';

const hashString = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// Value noise on an integer lattice — deterministic, no Math.sin.
const valueNoise = (rng, w, h, cell) => {
  const gw = Math.ceil(w / cell) + 2; const gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => Math.floor(rng.next() * 1024));
  const out = new Int16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    const fx = ((x % cell) * 1024) / cell | 0, fy = ((y % cell) * 1024) / cell | 0;
    const a = grid[gy * gw + gx], b = grid[gy * gw + gx + 1], c = grid[(gy + 1) * gw + gx], d = grid[(gy + 1) * gw + gx + 1];
    const top = a + (((b - a) * fx) >> 10), bot = c + (((d - c) * fx) >> 10);
    out[y * w + x] = top + (((bot - top) * fy) >> 10);
  }
  return out;
};

const TEMPLATES = {
  plains:    { cells: [16], forest: 0.08, rock: 0, water: 0 },
  mixed:     { cells: [12], forest: 0.18, rock: 0, water: 0.04, stream: true },
  hills:     { cells: [8, 16], forest: 0.1, rock: 0.04, heightAmp: 3 },
  forest:    { cells: [10], forest: 0.55, rock: 0, lanes: 3 },
  mountains: { cells: [8], forest: 0.05, rock: 0.35, pass: true },
  desert:    { cells: [14], forest: 0, rock: 0.03, sand: 0.4, oasis: true },
  arctic:    { cells: [14], forest: 0.03, rock: 0.05, snow: 0.6, lake: true },
  urban:     { cells: [16], forest: 0, rock: 0, blocks: true },
  island:    { cells: [12], forest: 0.12, rock: 0.02, coastEdges: 2 }
};

export const generateMap = ({ regionId, terrain, w, h }) => {
  const rng = createRng(hashString(`map:${regionId}`)); // SAME region ⇒ SAME map, forever
  const tpl = TEMPLATES[terrain] || TEMPLATES.mixed;
  const noise = valueNoise(rng, w, h, tpl.cells[0]);
  const tiles = new Uint8Array(w * h);
  // threshold the noise into tile types by quantile; carve the pass/lanes/streets; always keep the
  // two deploy zones and a 3-tile corridor between them open (flood-fill check, re-carve if blocked)
  // ... (per-template carving functions: carvePass, carveLanes, carveStreetGrid, carveStream)
  return { w, h, tiles, height: noise };
};
```

**Invariant test:** for all 9 templates × 200 region ids, a path exists from the attacker zone to
the keep (BFS over passable tiles). Maps can never be unwinnable.

---

## 8. The simulation — systems in detail

### 8.1 The tick (20 Hz), in a fixed order

```js
// src/battle/sim/step.js
export const TICK_HZ = 20;
export const BATTLE_LIMIT_TICKS = 6 * 60 * TICK_HZ; // 6 minutes

export const step = (w, orders) => {
  if (w.ended) return w;
  applyOrders(w, orders);          // player + AI commands stamped for this tick (sorted by squad id)
  thinkAI(w);                      // tacticalAI issues its own orders into the same queue (§9)
  updateSupplyIncome(w);           // capture points → supply (every 20 ticks)
  updateAbilities(w);              // durations/cooldowns (generals, powers, perks)
  buildSpatialHash(w);             // bucket squads by 8×8-tile cell
  acquireTargets(w);               // auto-target in range/sight, respecting orders + counter preference
  moveSquads(w);                   // flow fields + separation + formation slots + terrain speed
  resolveAttacks(w);               // cooldown → hit → damage, morale, xp (combat.js)
  resolveStructures(w);            // towers/keep fire; siege damages structures
  applyAttrition(w);               // RoN attrition inside enemy territory (every 20 ticks)
  updateMoraleAndRout(w);          // rout < 20, rally, pursuit
  updateCaptures(w);               // points + keep assimilation
  updateFog(w);                    // every 5 ticks
  checkEnd(w);                     // victory / time limit
  w.tick += 1;
  return w;
};
```

### 8.2 Movement: flow fields + separation + formations

- **Flow fields** (one per distinct destination tile, cached per 64 ticks): a Dijkstra pass over
  passable tiles weighted by terrain cost. It suits groups: 12 squads moving to one point share
  one field. The map is at most 112×72 ≈ 8k tiles, which costs well under a millisecond per field
  in the worker.
- **Local steering**: separation from squads within 1.2 tiles, via the spatial hash.
- **Formations** (per selection group): `line` (default), `column` (roads/passes), `wedge`
  (cavalry charge), `box` (RoN "Refused": ranged/siege/support inside). Slots are computed relative
  to the group's destination and facing. Squads are assigned to the nearest slot, deterministically
  (greedy by squad id). The group moves at the **slowest member's speed** (RoN behavior) until
  within 4 tiles of its slot, then each squad speeds up to settle.
- **Terrain speed**: forest ×0.7, sand/snow ×0.8, ford ×0.6, road ×1.25. Air ignores all of it.

```js
// src/battle/sim/pathing.js — flow field (integer Dijkstra with a bucket queue)
export const buildFlowField = (map, goalIdx) => {
  const { w, h, tiles } = map;
  const cost = new Uint16Array(w * h).fill(0xffff);
  const buckets = Array.from({ length: 64 }, () => []);
  cost[goalIdx] = 0; buckets[0].push(goalIdx);
  const STEP = [10, 10, 10, 10, 14, 14, 14, 14];                  // orthogonal / diagonal
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  for (let b = 0, seen = 1; seen > 0; b = (b + 1) & 63) {
    const bucket = buckets[b]; seen = buckets.reduce((s, q) => s + q.length, 0);
    while (bucket.length) {
      const i = bucket.pop(); const x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; const tc = TILE_COST[tiles[j]]; if (!tc) continue;   // 0 = impassable
        const c = cost[i] + ((STEP[k] * tc) >> 3);
        if (c < cost[j]) { cost[j] = c; buckets[c & 63].push(j); }
      }
    }
  }
  return cost; // squads step toward the lowest-cost neighbour of their current tile
};
export const TILE_COST = [8, 11, 0, 0, 6, 10, 13, 0]; // open, forest, water, rock, road, sand, ford, building (×1/8)
```

### 8.3 Territory, attrition and supply (RoN)

- **Defender territory** = tiles within `defenderTerritoryRadius` of the keep or any tower
  (precomputed mask).
- **Attrition**: each attacker squad inside defender territory loses
  `strength × attritionPerMinute / 3` every 20 s, **unless** it is within `supplyAura` of a friendly
  **Support** squad (supply wagon) or within 6 tiles of its general. Units with the `forager` perk
  are immune.
- `attritionPerMinute = 0.012 × terrainAttritionMult × (1 + 0.1 × fortLevel)`. It reuses
  `TERRAIN_COMBAT_MODIFIERS[terrain].attritionMult`, and fortifications act as RoN's "patriotism".
- **Healing**: squads out of combat for 10 s near a supply wagon regain 0.5% of max strength per
  second, **capped at their strength when the battle began**. The strategic reinforcement phase
  owns real replenishment; the battle must not print soldiers.
- AI priority: supply wagons are high-value targets. Melee gets ×1.5 vs support, the RoN rule, and
  it already fits "support has no counters".

### 8.4 Generals (RoN abilities, mapped onto our commanders)

A unit with `commanderId` spawns its general as a small **attached** squad: it follows the host
and can't be targeted while the host lives. If the host dies, the general flees to the side's edge
and the strategic general survives. No permadeath, so `state.hiredCommanders` stays valid.

| Ability | Who | Effect | Cooldown |
|---|---|---|---|
| Aura (passive) | all | allies within 8 tiles: damage taken ×0.9 (RoN "+2 armor"), morale loss ×0.8, rally faster | – |
| **Forced March** | all | allies within 8: speed ×1.5 for 15 s | 60 s |
| **Entrench** | all (only in own territory or on a held capture point) | allies within 6: frontal damage taken ×0.7; flank/rear unaffected (RoN rule) | 90 s |
| **Ambush** | all (forest or night maps) | allies within 6 become hidden until they attack or an enemy cavalry squad comes within 3 tiles; first volley ×1.5 | 120 s |
| Signature: **Charge** | `reckless` | allies within 8: damage ×1.25 for 10 s | 60 s |
| Signature: **Bombard** | `siegemaster` | siege within 10: attack rate ×1.5 for 20 s | 75 s |
| Signature: **Field Hospital** | `logistician` | allies within 6 heal 10% over 20 s (capped as §8.3) | 90 s |
| Signature: **Shield Wall** | `cautious` | Entrench that also works in enemy territory, frontal ×0.6 | 90 s |

### 8.5 Objectives: the Keep, assimilation and capture points

- **Keep** (and walls, gates, towers) are structures with HP. **Only siege does full damage to
  structures.** Others do ×0.15 (`getSiegeMultiplier(true)` = 3.0 is applied on top for siege).
  Towers and the keep shoot the nearest attacker in range 8 every 1.5 s (damage scales with
  fortLevel).
- **Assimilation** (RoN): keep HP = 0 → if any attacker **infantry/cavalry** (our
  `OCCUPATION_CAPABLE_CLASSES`) is within 6 tiles **and no defender** is, a 30 s timer runs (it
  pauses while contested). When it completes, the attacker wins decisively (§10).
- **Capture points**: any non-air squad standing on a point uncontested for 8 s flips it. The
  holder gets +2 Supply/s and vision radius 8.

### 8.6 Battle Supply, reserves and reinforcements (RoN Conquer the World)

- Each side starts with **100 Supply**, plus 50 if it holds a capture point at start (defender).
  Income: +1/s base, +2/s per held point. **Cap** = `200 + 30 × currentInfrastructure` (commerce-cap
  analog).
- **Reserves** = squads beyond combat width at deployment (the exact `deploy()` split from
  auto-resolve: strongest first). Calling one costs **60**; it enters from your deploy edge after 8 s.
  The field cap is `combatWidth + 2` living squads per side on the field (pop cap). Its purpose is to
  make the reserve decision matter, not to fake scarcity.
- **Reinforcements from neighbours:** for each adjacent region owned by your side with idle land
  units (not locked, `movesLeft > 0`), a "Reinforce from Baden" card costs **120 Supply** and arrives
  after 25 s from that region's real bearing. **It's a real move:** in the strategic result that unit
  ends in the target region (if captured) or back in its origin or the attacker's origin, and it
  spends its move. The defender (AI) does the same from *its* neighbours. Garrisons can really be
  relieved.

### 8.7 Fog of war and intel

- A per-side visibility grid, recomputed every 5 ticks by stamping sight circles (a precomputed
  integer disk mask per radius; forest tiles block beyond 2 tiles, hills give +2 sight).
- **Intel synergy:** if the player has intel on the defender (`canSeeRegionDetails(state,
  targetRegionId)` at setup), all **structures and the defender's initial deployment** start
  revealed as "last seen" ghosts. Our espionage system gets real tactical value.
- **Recon satellite** owned (`state.satellites` with `typeId: 'recon'` and `ownerId` = player) →
  free **Satellite Sweep** power (reveal the map for 10 s, cooldown 60 s).
- **Spy satellite** (`typeId: 'spy'`) → enemy commander-power cooldowns are visible in the HUD.

### 8.8 Commander powers (RA2 superweapons, age-gated, fed by the strategic layer)

| Power | Available | Cost | Effect | Cooldown |
|---|---|---|---|---|
| Rally Cry | all ages | 120 Supply | all own squads +30 morale, rout immunity 8 s | 90 s |
| Arrow Storm | bronze–kingdoms | 150 | 4-tile circle, 6 hits over 3 s (ranged-class damage) | 60 s |
| Artillery Barrage | gunpowder+ (needs a siege unit in the battle or its region) | 250 | 5-tile circle, 8 shells over 4 s, ×2 vs structures | 75 s |
| Air Strike | modern (an `air` unit in the source or any adjacent owned region) | 300 | line strike 10 tiles | 90 s |
| Satellite Sweep | a `recon` satellite owned | free | full reveal 10 s | 60 s |
| **Missile Strike** | a `tactical`/`theatre` missile in `nation.missiles` | **consumes 1 real missile** | big AoE; `militaryDamage` from `MISSILE_TIERS` spread over squads in radius | once per missile |
| **Nuclear Strike** | a `nuclear` missile in stock | **consumes it** | everything in a 14-tile radius destroyed, both sides; battle ends; strategic nuclear consequences applied through the same reducer helper as the existing missile launch action | once |

Every power is gated by **real strategic resources**. Launching a missile in battle is the same
decision as launching it on the world map.

### 8.9 XP, veterancy and promotions in battle

- XP earned = `damageDealt / 20` + 10 per enemy squad routed. On result, each squad's
  `strategicXpGain = min(earned, XP_WIN or XP_LOSE based on outcome) + clamp(earned - that, 0, 20)`.
  Command battles can grant *slightly* more XP than auto (up to +20), a small skill reward that
  can't be farmed (one battle per stack per turn already holds).
- Chevrons over squads show the current rank (`getRankForXp`); promoting mid-battle is not allowed
  (the strategic layer handles it).
- Perks become live:
  - `shock`, `breakthrough`, `bulwark`, `entrenched`, `resilient`: passive, via the shared
    multiplier.
  - `overrun`/`relentless`: pursuit damage vs routed squads ×1.5/×2.
  - `volleyFire`: an **ability** (double attack rate 6 s, cooldown 40 s).
  - `unbreakable`: first rout ignored (identical to auto).
  - `sapper`: siege keeps half its structure bonus in the open.
  - `forcedMarch`: +20% speed.
  - `forager`: attrition immune.
  - `cadre`: heals out of combat even without a wagon.

### 8.10 Garrisons (T9)

Infantry or ranged squads ordered into the keep, a tower or an urban building become invisible
inside it. The building shoots with their ranged damage ×0.8 (melee lines count as ranged 4-tile
shooters). They take no damage until the building drops below 25% HP, when they are ejected with
−20 morale.

### 8.11 Combat core, facing and pursuit (code)

```js
// src/battle/sim/combat.js
import { computeHitMultiplier, BASE_DAMAGE_RATE, RNG_VARIANCE, FLANK_BONUS_MULT } from '../../engine/battle';
import { getPromotionMoraleLossMultiplier } from '../../data/promotions';
import { nextRandom } from './rng';          // same mulberry32 as utils/rng, but state lives in w.rngState
import { angleBetween, angleDiff } from './fixed';

export const EXCHANGE_SECONDS = 6;          // calibrated by the parity harness (§14)
const REAR_BONUS_MULT = 1.5;                // RoN: rear +50% (flank uses our existing 1.3 for parity)

// Which side of the target was hit: 0 front, 1 flank, 2 rear. Facing is 0..255 = full turn.
const hitArc = (w, attacker, target) => {
  const a = angleBetween(w.x[target], w.y[target], w.x[attacker], w.y[attacker]); // direction target→attacker
  const d = Math.abs(angleDiff(a, w.facing[target]));                              // 0..128
  return d <= 43 ? 0 : d <= 96 ? 1 : 2;                                            // ±60° front, ±135° flank, rest rear
};

export const squadView = (w, i) => ({                  // adapter so battle.js's multiplier fn works unchanged
  id: w.unitId[i], classId: CLASS_IDS[w.classIdx[i]], strength: w.strength[i],
  promotions: w.promotions[i], commanderId: w.commanderId[i]
});

export const attack = (w, i, j, stats) => {
  const side = w.side[i];
  const ctx = side === 0 ? w.setup.modifiers.attackerCtx : w.setup.modifiers.defenderCtx;
  const phase = stats.melee ? 'shock' : 'ranged';
  const mult = computeHitMultiplier(squadView(w, i), squadView(w, j), { ...ctx, phase, generals: w.setup.generals });
  const arc = hitArc(w, i, j);
  const facingMult = arc === 1 ? FLANK_BONUS_MULT : arc === 2 ? REAR_BONUS_MULT : 1;
  const roll = nextRandom(w);
  const variance = 1 + (roll * 2 - 1) * RNG_VARIANCE;
  const perHit = (BASE_DAMAGE_RATE * (stats.attackTicks / 20)) / EXCHANGE_SECONDS;
  const auraMult = generalAuraDefense(w, j) * entrenchMult(w, j, arc);
  const damage = Math.max(0, Math.round(w.strength[i] * perHit * mult * facingMult * variance * auraMult));
  if (!damage) return;
  w.strength[j] = Math.max(0, w.strength[j] - damage);
  w.morale[j] = Math.max(0, w.morale[j] - Math.round((damage / 25) * getPromotionMoraleLossMultiplier(squadView(w, j)) * generalAuraMorale(w, j)));
  w.xpEarned[i] += damage;
  w.engaged[i] = 1; w.engaged[j] = 1;
  w.events.push({ t: w.tick, type: stats.melee ? 'melee' : 'shot', from: i, to: j, damage, arc }); // renderer FX only
  if (w.strength[j] === 0) { w.alive[j] = 0; w.events.push({ t: w.tick, type: 'destroyed', id: j }); }
};
```

`computeHitMultiplier` returns a float. Floats are **deterministic in JS across engines for
+ − × ÷** (IEEE-754 double); only transcendental functions (`Math.sin`, `Math.pow` with non-integer
arguments) can differ. The sim therefore uses float multiply/divide freely, rounds damage to
integers immediately, and keeps positions integer (Q8). Angles use a 256-entry table.

```js
// src/battle/sim/fixed.js — deterministic angle helpers (no Math.atan2 in the sim)
export const SIN = new Int16Array(256).map((_, i) => Math.round(Math.sin((i / 256) * 2 * Math.PI) * 4096)); // built once; table content is what's deterministic
export const COS = new Int16Array(256).map((_, i) => SIN[(i + 64) & 255]);
// integer octant-based atan2 approximation → 0..255
export const angleBetween = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; /* octant + ratio lookup, ≤1 unit error */ return atanLookup(dx, dy); };
export const angleDiff = (a, b) => ((a - b + 384) & 255) - 128; // signed −128..127
```

> The `SIN` table is built with `Math.sin` **once at load** from integer inputs. That is the one
> place engines could theoretically differ in the last bit, and rounding to Q12 (×4096) absorbs
> it. To be fully bulletproof for multiplayer, ship the table as literal numbers
> (`scripts/gen-trig-table.mjs` writes `src/battle/sim/trigTable.js`).

### 8.12 Morale, rout and pursuit

- Rout when morale ≤ 20. `unbreakable` negates the first rout, exactly as `markRouted` does.
- A routed squad ignores orders, flee-paths to its own edge, and is removed from the field at the
  edge. It **survives** strategically with its remaining strength, matching auto-resolve (routed ≠
  dead).
- **Rally**: routed and not hit for 6 s, within 8 tiles of its general, or after Rally Cry →
  morale 35, orders restored.
- **Pursuit**: enemy cavalry within 5 tiles of a routed squad auto-chases (unless on hold) and
  deals ×`PURSUIT_EXTRA_LOSS_MULT` × (overrun/relentless) damage per hit. This is the real-time form
  of `pursuitPhase`.

---

## 9. The enemy commander (tactical AI)

A **utility AI** that runs in the worker every 10 ticks (0.5 s). It uses the same order API as the
player. **No cheating**: it reads only its own side's fog grid.

```js
// src/battle/sim/tacticalAI.js
import { getCounterMultiplier } from '../../data/unitClasses';

const DIFFICULTY = {           // keyed by state.difficultyId (src/data/difficulty.js: settler … emperor)
  settler:   { thinkEvery: 24, reactionTicks: 20, focusFire: false, usePowers: false, retreatAt: 0.2 },
  chieftain: { thinkEvery: 20, reactionTicks: 16, focusFire: false, usePowers: false, retreatAt: 0.25 },
  prince:    { thinkEvery: 10, reactionTicks: 8,  focusFire: true,  usePowers: true,  retreatAt: 0.35 },
  king:      { thinkEvery: 6,  reactionTicks: 4,  focusFire: true,  usePowers: true,  retreatAt: 0.4, flank: true },
  emperor:   { thinkEvery: 4,  reactionTicks: 2,  focusFire: true,  usePowers: true,  retreatAt: 0.45, flank: true, kite: true }
};

// Score every visible enemy for each of my squads; pick the best that isn't overkilled.
const targetScore = (w, me, enemy) => {
  const counter = getCounterMultiplier(classOf(w, me), classOf(w, enemy));   // 1.75 / 1 / 0.6
  const dist = Math.max(1, distTiles(w, me, enemy));
  const lowHpBonus = 1 + (1 - w.strength[enemy] / w.maxStrength[enemy]);     // finish off
  const threat = classOf(w, enemy) === 'siege' || classOf(w, enemy) === 'support' ? 1.4 : 1; // RoN: kill the wagons/siege
  return (counter * lowHpBonus * threat) / Math.sqrt(dist);
};
```

**Behaviour layers** (evaluated in order; the first that fires wins):
1. **Defend objective**: if the keep is under assimilation or a held point is contested, send the
   nearest 40% of force.
2. **Retreat**: if own field strength < `retreatAt` × start and the enemy's is > 1.5× ours, pull back
   to the keep or territory (the defender) or off-map (the attacker, ends in `'defender'`).
3. **Use powers**: Rally Cry when ≥ 3 own squads have morale < 40. Barrage and Air Strike on the
   densest enemy cluster (spatial-hash cell with max strength). A missile only on king/emperor and
   only if the cluster is ≥ 40% of enemy strength. **Never nukes**; the AI's strategic layer decides
   nukes, not a tactical script.
4. **Call reserves/reinforcements** when Supply ≥ cost and the field is below the cap.
5. **Engage**: counter-targeting as above. King+ sends cavalry on a **flank arc** (a waypoint
   90° off the enemy line's facing) before contact. Emperor kites (ranged retreat 2 tiles when melee
   is within 3).
6. **Defender posture** (default): hold a line between the enemy and the keep, garrison towers
   (T9), entrench when a general is present.

`reactionTicks` delays how quickly the AI responds to *new* information. That is what makes lower
difficulties beatable without making them stupid.

---

## 10. Ending the battle → the strategic result

| End condition | `outcome` | Notes |
|---|---|---|
| All defender squads destroyed or routed off-map, **or** keep assimilated | `'attacker'` | `decisive = keepAssimilated` |
| All attacker squads destroyed/routed, or the attacker retreats | `'defender'` | |
| Time limit (6 min) with both sides standing | `'defender'` | Same rule as auto-resolve: an inconclusive exchange = defender holds |
| Mutual annihilation (nuke) | `'stalemate'` | Matches auto-resolve's vocabulary |

```js
// src/battle/sim/result.js — produce EXACTLY resolveBattle's shape
export const toStrategicResult = (w) => {
  const bySide = (s) => listSquads(w).filter((i) => w.side[i] === s && !w.isGeneral[i]).map((i) => ({
    ...w.original[i],                                  // the strategic unit object from setup (id, classId, promotions, commanderId, ...)
    strength: w.strength[i],
    morale: Math.max(0, Math.min(100, w.morale[i])),
    routed: !!w.routed[i]
  }));
  const attackerUnits = bySide(0), defenderUnits = bySide(1);
  const engagedIds = (s) => listSquads(w).filter((i) => w.side[i] === s && w.engaged[i]).map((i) => w.unitId[i]);
  return {
    outcome: w.ended.outcome,
    attackerUnits,
    defenderUnits,
    report: {
      combatWidth: w.setup.combatWidth, terrain: w.setup.terrain, isAttackingFortification: w.setup.modifiers.isAttackingFortification,
      deployedAttackers: engagedIds(0).length, deployedDefenders: engagedIds(1).length,
      reserveAttackers: attackerUnits.length - engagedIds(0).length, reserveDefenders: defenderUnits.length - engagedIds(1).length,
      deployedAttackerIds: engagedIds(0), deployedDefenderIds: engagedIds(1),     // XP goes to squads that actually fought
      outcome: w.ended.outcome,
      log: summarizeLog(w),                                                      // ≤ 60 entries, same {phase, attackerClass, defenderClass, damage}
      tactical: { mode: 'command', durationSec: Math.round(w.tick / 20), decisive: !!w.ended.decisive,
                  reason: w.ended.reason, xpEarned: xpById(w), reinforcementsUsed: w.reinforcementsUsed, powersUsed: w.powersUsed }
    }
  };
};
```

### 10.1 Reducer actions

```js
// src/data/types.js — ActionTypes
BEGIN_TACTICAL_BATTLE: 'BEGIN_TACTICAL_BATTLE',
RESOLVE_TACTICAL_BATTLE: 'RESOLVE_TACTICAL_BATTLE',
ABANDON_TACTICAL_BATTLE: 'ABANDON_TACTICAL_BATTLE',   // "auto-resolve it instead"
```

```js
// gameReducer.js
case ActionTypes.BEGIN_TACTICAL_BATTLE: {
  if (state.pendingBattle) return state;                              // one at a time
  const { fromRegionId, targetRegionId } = action.payload;
  const v = validateInvasion(state, fromRegionId, targetRegionId);    // identical gate to LAUNCH_INVASION
  if (!v.ok) return state;
  if (v.defenderUnits.length === 0) {                                 // nothing to fight: an undefended region is taken instantly
    return gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId } });
  }
  const rng = createRng(state.rngSeed);
  const seed = Math.floor(rng.next() * 0xffffffff) >>> 0;
  return {
    ...state,
    resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion), // pay now; a battle is a commitment
    rngSeed: rng.getSeed(),
    pendingBattle: {
      id: `b_${state.turnNumber}_${(state.battleCounter || 0) + 1}`, kind: 'invasion',
      fromRegionId, targetRegionId, warId: v.war.id,
      attackerNationId: state.playerNationId, defenderNationId: v.targetRegion.owner,
      seed, startedTurn: state.turnNumber, playerSide: 'attacker',
      attackerUnitIds: v.attackerUnits.map((u) => u.id), defenderUnitIds: v.defenderUnits.map((u) => u.id)
    },
    battleCounter: (state.battleCounter || 0) + 1
  };
}

case ActionTypes.RESOLVE_TACTICAL_BATTLE: {
  const pb = state.pendingBattle;
  const { battleId, result, reinforcementMoves = [] } = action.payload;
  if (!pb || pb.id !== battleId) return state;
  // SAFETY: never trust the client blindly — clamp to what went in (strength can only go DOWN,
  // ids must match the locked sets). A tampered result can't mint soldiers.
  const safe = sanitizeResult(state, pb, result);
  const targetRegion = state.regions[pb.targetRegionId];
  const war = state.wars.find((w) => w.id === pb.warId && w.active);
  const cleared = { ...state, pendingBattle: null, units: applyReinforcementMoves(state.units, reinforcementMoves) };
  if (!war || !targetRegion) return cleared;                          // war ended meanwhile (can't, turn is blocked — defensive)
  return applyInvasionResult(cleared,
    { fromRegionId: pb.fromRegionId, targetRegionId: pb.targetRegionId, war, targetRegion, isDefended: true },
    safe,
    { rngSeed: state.rngSeed, decisive: safe.report.tactical?.decisive });
}

case ActionTypes.ABANDON_TACTICAL_BATTLE: {
  // Fall back to auto-resolve with the ORIGINAL units (cost already paid → don't charge twice)
  const pb = state.pendingBattle; if (!pb) return state;
  const v = validateInvasionIgnoringCostAndLocks(state, pb);
  const ctx = getInvasionBattleContext(state, { targetRegionId: pb.targetRegionId, ...v });
  const rng = createRng(pb.seed);
  const battle = resolveBattle({ attackerUnits: v.attackerUnits, defenderUnits: v.defenderUnits, rng, ...ctx });
  return applyInvasionResult({ ...state, pendingBattle: null }, { ...pb, war: v.war, targetRegion: v.targetRegion, isDefended: true }, battle, { rngSeed: state.rngSeed });
}
```

- **Decisive win** (keep assimilated): `applyInvasionResult` sets `captured = true` regardless of
  remaining control. You physically took the keep, which is the reward for playing it out.
  Otherwise the normal `resolveSiegeControlDamage` grind applies. It is balanced by the defender
  also getting a real keep, towers and territory attrition.
- **END_TURN guard**: `if (state.pendingBattle) return state;`. The header's End Turn button shows
  "Finish battle" and offers ABANDON (auto-resolve).
- `sanitizeResult` test: feed a result with inflated strength or foreign ids → the reducer clamps
  them.

### 10.2 UI components

```jsx
// src/components/battle/BattleChoiceSheet.jsx  (opened instead of dispatching LAUNCH_INVASION)
const BattleChoiceSheet = ({ fromRegionId, targetRegionId, onClose }) => {
  const { state, dispatch } = useGame();
  const { triggerEffect } = useEffects();
  const odds = useMemo(() => estimateWinChance(state, fromRegionId, targetRegionId, 200), [state.units, fromRegionId, targetRegionId]); // §13
  const auto = () => { triggerEffect('ground_invasion', { from: fromRegionId, to: targetRegionId }); dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId } }); onClose(); };
  const command = () => { dispatch({ type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId, targetRegionId } }); onClose(); };
  return (
    <Sheet title={`Attack ${REGIONS_DATA[targetRegionId].name}`} onClose={onClose}>
      <OddsBar attacker={odds.attacker} defender={odds.defender} stalemate={odds.stalemate} />
      <ChoiceCard icon={Zap} title="Auto-resolve" subtitle={`Instant · ${Math.round(odds.attacker * 100)}% to win`} onClick={auto} />
      <ChoiceCard icon={Swords} title="Command the battle" subtitle="Real-time · 2–6 min · take the keep for a decisive capture" onClick={command} primary />
      <label><input type="checkbox" onChange={rememberChoice} /> Remember my choice</label>
    </Sheet>
  );
};
```

- `TacticalBattleScreen` mounts when `state.pendingBattle` is set (in `App.jsx`, at `z-[80]`,
  above modals and below `ConflictChooserModal`'s `z-[90]`). It is lazy-loaded
  (`React.lazy(() => import('./components/battle/TacticalBattleScreen'))`), so **three.js battle
  code and the worker cost nothing until the first battle**.
- `BattleResultScreen` shows casualties per side, XP bars filling, "promotion available" badges and
  Continue, which dispatches RESOLVE.
- After RESOLVE, the existing `BattleSummaryToast` fires via the normal `lastBattleReport` path.

---

## 11. Controls — mobile first, desktop on top

### 11.1 Screen layout (portrait and landscape both supported; landscape recommended)

```
┌──────────────────────────────────────────────┐
│ ⏸  03:12   ⚔ 4/6  Supply 140 ▮▮▮▯    [mini] │  ← top bar: pause, clock, field cap, supply, minimap (tap = jump)
│                                              │
│                 battlefield                   │
│                                              │
│ [Rally 60s] [Barrage] [Sat✓]                 │  ← power buttons (left thumb), cooldown rings
│──────────────────────────────────────────────│
│ (All)(Inf 3)(Cav 2)(Rng 2)(Sup 1)  [Reserves]│  ← selection chips (tap = select class; double-tap = all of that class on field)
│ [Move][Atk-Move][Hold][Stop][Formation▾][Retreat] ← command bar (right thumb), 48px targets
└──────────────────────────────────────────────┘
```

### 11.2 Gesture map

| Gesture | Nothing selected | Squads selected |
|---|---|---|
| **Tap** own squad | select it (+ its group) | replace selection (tap with 2nd finger held = add) |
| **Tap** ground | – | **move** there (in the current formation) |
| **Tap** enemy / structure | show info card | **attack** it (focus fire) |
| **Drag from a selected squad** | – | draw a **formation line**: the length sets the line's width, the drag direction sets facing (RoN/Total War line drag) |
| **Double-tap + drag** | **lasso box select** (CoH mobile convention) | same |
| **Long-press (≥ 350 ms, < 10 px movement) on a selected squad** | – | **radial**: abilities (Volley, Forced March, Entrench, Ambush, Charge, Garrison) |
| **Long-press ground** | ping or last-seen info | **attack-move** there |
| **One-finger drag on empty ground** | pan | pan |
| **Two-finger pinch / drag** | zoom / pan | zoom / pan |
| **Tap minimap** | jump camera | jump camera |

**Disambiguation rules** (the CoH mobile lesson):
- Any finger movement > 10 px before 350 ms = pan, and a radial can **never** open during that
  pointer sequence.
- A second pointer landing cancels tap and long-press, and starts pinch.
- Radials open only on already-selected squads, so they're never an accident on the first touch.
- `touch-action: none` is set on the canvas.

```js
// src/battle/input/gestures.js — framework-free recognizer (Pointer Events: mouse, touch and pen alike)
const TAP_MS = 250, LONG_MS = 350, MOVE_PX = 10;

export const createGestureRecognizer = (el, handlers) => {
  const pointers = new Map(); let longTimer = null; let mode = 'idle'; let lastTapAt = 0; let start = null;
  const down = (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { clearTimeout(longTimer); mode = 'pinch'; handlers.pinchStart?.(snapshot()); return; }
    start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    const doubleTap = e.timeStamp - lastTapAt < 300;
    mode = doubleTap ? 'lasso-armed' : handlers.isOnSelectedSquad?.(start) ? 'squad-press' : 'press';
    longTimer = setTimeout(() => { if (mode === 'squad-press') { mode = 'radial'; handlers.radialOpen?.(start); } else if (mode === 'press') { mode = 'long'; handlers.longPress?.(start); } }, LONG_MS);
  };
  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch') return handlers.pinchMove?.(snapshot());
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) < MOVE_PX) return;
    clearTimeout(longTimer);
    if (mode === 'lasso-armed') mode = 'lasso';
    else if (mode === 'squad-press') mode = 'formation-drag';
    else if (mode === 'press') mode = 'pan';
    if (mode === 'lasso') handlers.lasso?.(start, e);
    else if (mode === 'formation-drag') handlers.formationDrag?.(start, e);
    else if (mode === 'pan') handlers.pan?.(dx, dy);
    else if (mode === 'radial') handlers.radialHover?.(e);
  };
  const up = (e) => {
    clearTimeout(longTimer); pointers.delete(e.pointerId);
    if (mode === 'pinch') { if (pointers.size === 0) mode = 'idle'; return; }
    const quick = e.timeStamp - start.t < TAP_MS;
    if ((mode === 'press' || mode === 'squad-press') && quick) { handlers.tap?.(start); lastTapAt = e.timeStamp; }
    else if (mode === 'lasso') handlers.lassoEnd?.(start, e);
    else if (mode === 'formation-drag') handlers.formationEnd?.(start, e);
    else if (mode === 'radial') handlers.radialSelect?.(e);
    mode = 'idle';
  };
  const snapshot = () => [...pointers.values()];
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
};
```

### 11.3 Tactical pause (the single most important mobile feature)

Single-player only. **Pause keeps accepting orders.** You can pause, give five squads orders, and
unpause, which turns phone RTS from frantic to strategic. Speed options are 0.5×, 1× and 2×. A
"slow-mo on first contact" setting (0.5× for 3 s when lines first meet) is on by default on
Settler, Chieftain and Prince.

### 11.4 Desktop extras
- Left-drag box select, right-click move/attack, **A**+click attack-move, **S** stop, **H** hold,
  **F** formation cycle, **R** retreat.
- **Ctrl+1–9** control groups, **Space** pause.
- WASD/edge-scroll pan, wheel zoom.

### 11.5 Accessibility and comfort
- Every button is ≥ 48 px. There's a left-handed mirror layout (swap the command bar and powers).
- Colorblind-safe side colors: blue/orange default, with shape markers (a ring vs a diamond under
  squads).
- Haptic tick on order confirm and heavier on squad destroyed: `navigator.vibrate` on Android web,
  or `@capacitor/haptics` if added (optional, tiny).
- Captions for key events ("Keep walls breached", "Enemy cavalry flanking left").

---

## 12. Worker, determinism, save/resume, multiplayer

### 12.1 Worker protocol

```js
// src/battle/worker/battle.worker.js
import { createWorld } from '../sim/world';
import { spawnFromSetup } from '../sim/spawn';
import { step, TICK_HZ } from '../sim/step';
import { toStrategicResult } from '../sim/result';
import { worldHash } from '../sim/hash';

let w = null, queue = [], running = false, speed = 1, acc = 0, last = 0, log = [];

const loop = (now) => {
  if (!running) return;
  acc += Math.min(250, now - last) * speed; last = now;
  const tickMs = 1000 / TICK_HZ;
  while (acc >= tickMs && !w.ended) {
    const orders = queue.filter((o) => o.tick <= w.tick); queue = queue.filter((o) => o.tick > w.tick);
    orders.forEach((o) => log.push(o));
    step(w, orders);
    acc -= tickMs;
    if (w.tick % 200 === 0) postMessage({ type: 'checkpoint', tick: w.tick, hash: worldHash(w), snapshot: snapshotOf(w), log }); // every 10 s
  }
  postMessage({ type: 'frame', tick: w.tick, alpha: acc / tickMs, state: renderViewOf(w), events: w.events.splice(0) }, transferablesOf(w));
  if (w.ended) { running = false; postMessage({ type: 'ended', result: toStrategicResult(w), log }); return; }
  setTimeout(() => loop(performance.now()), 16); // workers have no rAF; ~60 Hz is enough to feed interpolation
};

onmessage = ({ data }) => {
  switch (data.type) {
    case 'start': w = spawnFromSetup(createWorld(data.setup)); log = []; if (data.resume) restore(w, data.resume); running = true; last = performance.now(); loop(last); break;
    case 'orders': data.orders.forEach((o) => queue.push({ ...o, tick: Math.max(o.tick ?? 0, w.tick + 1) })); break; // never in the past
    case 'pause': running = false; break;
    case 'resume': running = true; last = performance.now(); loop(last); break;
    case 'speed': speed = data.speed; break;
    default: break;
  }
};
```

```js
// main thread — Vite bundles the worker as its own chunk automatically
const worker = new Worker(new URL('../../battle/worker/battle.worker.js', import.meta.url), { type: 'module' });
```

Vite 4 supports `new Worker(new URL(...), { type: 'module' })` out of the box, and it works
inside Capacitor's WebView (Android Chrome WebView and iOS WKWebView both support module workers
in their current versions). **Fallback:** if `Worker` construction throws (very old WebViews), run
the same `step()` on the main thread in a rAF loop. The sim is pure, so this is literally the same
code.

### 12.2 Determinism checklist

1. Seeded RNG state lives **in the world** (`w.rngState`), advanced by one function.
2. Integer positions (Q8); damage rounded to integers every hit.
3. No `Math.sin/cos/atan2/pow/sqrt` in the sim (tables and an integer sqrt).
4. Iterate squads in index order; ties are broken by index, never by object key order or
   `Array.sort` on floats.
5. Orders are applied on **tick boundaries** and sorted `(tick, side, squadIndex, seq)`.
6. **Desync detector (dev):** replay `(setup, log)` headless at the end of every battle in dev
   builds and compare `worldHash` at each checkpoint. A mismatch logs the first diverging tick.

### 12.3 Save and resume (mobile reality: calls, app switches, OS kills)

- Every 10 s checkpoint → `IndexedDB` key `battle:<saveSlot>:<battleId>` =
  `{ setupVersion, seed, log, snapshot, tick }`. This is **not** in the main save blob, which keeps
  cloud saves small.
- `document.visibilitychange` (it fires in Capacitor when the app backgrounds) → pause
  immediately and write a checkpoint.
- On load: if `state.pendingBattle` exists → rebuild the setup from state (pure) and restore the
  snapshot, or if it's missing, **replay the log** from tick 0 (fast-forward headless: 6 min of
  battle replays in ≈ 200 ms).
- If nothing is stored (another device, a cloud save), offer "Resume from start" or "Auto-resolve".

### 12.4 Multiplayer: made possible, not deferred

Lockstep with a command log, the proven RTS technique (AoE, StarCraft):
- **Async PvP / server-authoritative**: the client uploads `(battleId, commandLog)`. The Supabase
  edge function (`supabase/functions/resolve-turn`) imports the **same** `src/battle/sim/*`, since
  it's pure JS and Deno runs it. It rebuilds the setup from the authoritative game state, replays,
  and uses **its** result. The client's `result` is only a preview, so cheating is pointless.
- **Live PvP (later)**: both clients run the sim and exchange orders stamped 3 ticks ahead
  (150 ms input delay) over Supabase Realtime channels, with hash exchange every 200 ticks.
  Determinism (§12.2) is what makes this possible. It's out of scope for the milestones below, but
  **nothing in this design blocks it**.

---

## 13. Auto-battle stays, and gets better

- **Unchanged result**: `LAUNCH_INVASION` → `resolveBattle()`.
- **Odds preview** on the choice sheet: Monte Carlo over 200 seeds of `resolveBattle` with the
  real inputs. It's pure and fast (~5 µs per battle, about 1 ms total), so memoize per
  (attacker ids, defender ids).

```js
// src/engine/battleOdds.js
export const estimateWinChance = (state, fromRegionId, targetRegionId, samples = 200) => {
  const v = validateInvasion(state, fromRegionId, targetRegionId);
  if (!v.ok || v.defenderUnits.length === 0) return { attacker: v.ok ? 1 : 0, defender: 0, stalemate: 0 };
  const ctx = getInvasionBattleContext(state, { targetRegionId, ...v });
  const tally = { attacker: 0, defender: 0, stalemate: 0 };
  for (let s = 1; s <= samples; s++) tally[resolveBattle({ attackerUnits: v.attackerUnits, defenderUnits: v.defenderUnits, rng: createRng(s * 2654435761), ...ctx }).outcome] += 1;
  return { attacker: tally.attacker / samples, defender: tally.defender / samples, stalemate: tally.stalemate / samples };
};
```

- **"Watch" option (nice-to-have)**: spectate a command-mode sim where the tactical AI controls
  *both* sides. Wars look alive, and nothing changes: the result still comes from the auto path
  unless the player takes control.

---

## 14. Parity harness — command mode must not be free wins

A statistical test in the style of plan #37's harness: AI-vs-AI in the tactical sim vs
`resolveBattle` over the same matchups.

```js
// src/battle/sim/parity.test.js  (tagged slow; runs in CI nightly, not in the fast suite)
const MATCHUPS = buildMatchups(); // class mixes × ages × terrains × strength ratios (0.6..1.6), 300 cases
it('AI-vs-AI command mode agrees with auto-resolve on who tends to win', () => {
  let disagreements = 0;
  MATCHUPS.forEach((m) => {
    const auto = winRate((seed) => resolveBattle({ ...m.input, rng: createRng(seed) }).outcome, 40);
    const tactical = winRate((seed) => runHeadless(buildSetupFromMatchup(m, seed), { attacker: 'ai', defender: 'ai' }).outcome, 12);
    if (Math.abs(auto - tactical) > 0.2) disagreements += 1;
  });
  expect(disagreements / MATCHUPS.length).toBeLessThan(0.1); // ≥ 90% of matchups within 20 pp
});
```

This tunes `EXCHANGE_SECONDS`, tower damage, attrition and the keep's HP. A skilled human
*should* beat the AI-vs-AI baseline; that's the point. But an average one shouldn't get free wins.

---

## 15. Rendering — "modern 2026" on a phone

### 15.1 Stack
- **three.js r186** (already installed as react-globe.gl's dependency; add `"three": "^0.186.0"`
  to `package.json` explicitly so it's pinned and deduped).
- A dedicated `WebGLRenderer` (not the globe's). It is created on battle mount and `dispose()`d on
  unmount. `WebGPURenderer` is a later opt-in once iOS Safari WebGPU is ubiquitous.
- **Orthographic isometric camera** (Red Alert 2 look): `camera.position.set(x + 40, 50, y + 40)`,
  looking at `(x, 0, y)`, zoom clamped 0.6–2.5. Pan and zoom come from gestures.

### 15.2 Zero-art-pipeline 3D tokens from our own icons

```js
// src/battle/render/tokenFactory.js
import { ExtrudeGeometry, MeshStandardMaterial, InstancedMesh, Matrix4, Color } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getUnitIconPath } from '../../data/unitIcons';

const cache = new Map();
// game-icons paths are 512×512 silhouettes → an extruded, bevelled token standing upright,
// 1 world unit tall. Cached per (age, class): about 30 geometries max for the whole game.
export const getUnitTokenGeometry = (ageId, classId) => {
  const key = `${ageId}:${classId}`;
  if (cache.has(key)) return cache.get(key);
  const d = getUnitIconPath(ageId, classId);
  const shapes = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>`)
    .paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new ExtrudeGeometry(shapes, { depth: 60, bevelEnabled: true, bevelThickness: 8, bevelSize: 6, bevelSegments: 1, curveSegments: 3 });
  geo.scale(1 / 512, -1 / 512, 1 / 512);   // SVG y-down → three y-up
  geo.center();
  geo.rotateY(Math.PI / 4);                // face the isometric camera
  const merged = mergeVertices(geo); merged.computeVertexNormals();
  cache.set(key, merged);
  return merged;
};

// One InstancedMesh per (age, class, side): every soldier of every squad of that type = 1 draw call.
export const createSoldierLayer = (ageId, classId, sideColor, maxSoldiers) => {
  const mesh = new InstancedMesh(getUnitTokenGeometry(ageId, classId), new MeshStandardMaterial({ color: new Color(sideColor), roughness: 0.55, metalness: 0.15 }), maxSoldiers);
  mesh.count = 0; mesh.frustumCulled = false;
  return mesh;
};
```

- **Soldiers per squad** = `ceil(soldiers × strength / maxStrength)`, laid out on formation offsets
  (a 3×4 grid, a wedge or a line) around the squad's interpolated position. They bob slightly while
  walking and lunge on melee events. It's **cosmetic only** and never simulated.
- **Buildings** use the same extrusion from `BUILDING_ICON_PATHS[category][age]` for keeps, towers
  and walls (wall = instanced box segments).
- **Terrain**: a `PlaneGeometry(w, h, w, h)` displaced by the heightmap, with vertex colors per tile
  type (grass/forest floor/sand/snow/rock/road). Forest is instanced low-poly cones. Water is a
  flat plane with a cheap animated normal.
- **FX**: reuse our effects vocabulary: instanced particles for musket smoke, arrows (thin
  instanced quads on parabolic arcs), shell bursts, fire and dust. Everything is driven by the
  worker's `events` stream (`shot/melee/destroyed/power`).
- **UI overlays in 3D**: selection rings (instanced ring geometry), health and morale pips
  (instanced quads, billboarded), chevrons for rank, a move/attack marker ping, and range circles
  for the selected ranged/siege squad.
- **Fog**: a `DataTexture` (w×h, R8) updated from the side's fog grid every 5 ticks, sampled in a
  terrain shader tweak (`onBeforeCompile`): unseen = 30% brightness, never-seen = black.

### 15.3 Interpolation (smooth 60 fps from a 20 Hz sim)

The worker posts positions for tick *n* plus `alpha`. The renderer keeps the last two frames and
draws `lerp(prev, cur, alpha)`. Facing is interpolated on the shortest arc. Soldiers ease toward
their slot targets (critically damped springs), so formation changes look organic.

### 15.4 Performance budget (mid-range 2022 Android as the floor)

| Item | Budget |
|---|---|
| Sim tick (≤ 2 × 12 squads on field + reserves) | ≤ 1.5 ms in the worker (20 Hz → 3% of a core) |
| Flow field build | ≤ 1 ms, cached per destination |
| Draw calls | ≤ 40 (instancing everywhere) |
| Triangles | ≤ 250k (token geometry ~800 tris × ≤ 250 soldiers + terrain 16k + trees) |
| Frame (render) | ≤ 8 ms at DPR ≤ 2 (dynamic resolution drops to DPR 1.25 if 3 consecutive frames exceed 20 ms) |
| Memory | ≤ 60 MB extra; everything disposed on unmount (renderer, geometries, textures, worker.terminate()) |
| Battery | render loop stops when paused and nothing animates; 30 fps "battery saver" toggle |

A performance test (`src/battle/sim/perf.test.js`) asserts the tick budget headless: 3,000 ticks
of a 12v12 battle in < 6 s in CI, with generous CI headroom.

---

## 16. Defense battles (T8): being invaded, without breaking turn flow

Today AI assaults on any region are an abstract roll in `src/engine/diplomacy.js` (the
`capture_region` branch near L377: `rng.next() < chance` → `resolveSiegeControlDamage`, with no
unit battle). For **player-owned regions with a garrison**, change what happens after a successful
roll:

```js
// diplomacy.js — inside the capture_region branch, after `if (rng.next() < chance) {`
const isPlayerTarget = targetRegion.owner === state.playerNationId;
if (isPlayerTarget && isDefended) {
  pendingDefenses.push({
    id: `d_${state.turnNumber}_${pendingDefenses.length + 1}`,
    warId: currentWar.id, aggressorId: currentWar.aggressor, regionId: currentWar.goal.regionId,
    // the AI's real adjacent land units if it has any, else an expeditionary force synthesized
    // from militaryStrength with its composition mix (src/engine/aiEconomy.js), flagged synthetic
    attackerUnitIds: pickAssaultForce(state, currentWar.aggressor, currentWar.goal.regionId),
    synthetic: syntheticForce || null,
    seed: Math.floor(rng.next() * 0xffffffff) >>> 0
  });
  continue; // outcome decided by the battle, next turn start
}
```

- `resolveTurn` returns the state with `pendingDefenses`. **Before the player's next turn is
  interactive**, `App.jsx` shows the "Under attack" banner and a queue UI. For each defense, the
  player picks **Auto** (resolveBattle with the player as defender) or **Command** (the same
  TacticalBattleScreen with `playerSide: 'defender'`).
- `battleSettings.defaultMode === 'auto'` → they auto-resolve silently into the log (players who
  don't want interruptions are never bothered).
- A new `RESOLVE_DEFENSE_BATTLE` action applies: the attacker wins → the same occupation / control
  damage lines as today's AI branch; the defender wins → the assault is repelled, war score goes to
  the player, and synthetic survivors fold back into the aggressor's `militaryStrength`.
- **Balance:** the AI roll used to guarantee success; now a garrison can repel it. The parity
  harness calibrates a multiplier on `AI_CAPTURE_BASE_CHANCE` for player targets so that
  **expected** territory loss under auto-resolve stays where it is today.
- END_TURN is blocked while `pendingDefenses.length > 0` (a banner offers "Auto-resolve all").

**As built (T8), where it differs from the sketch above:**
- Code lives in `src/engine/defense.js`. The assault force is the aggressor's real land units in
  adjacent provinces, **topped up** with synthetic troops to `round(2 × garrison × aggressorShare)`
  units (capped at 12). Synthetic troops stay on the defense record, never in `state.units`, and
  their losses come out of `militaryStrength`.
- Auto-resolve is one exchange per turn, and a single exchange almost never breaks a garrison
  (0 of 2,880 sampled fresh assaults did, even at 4:1). So a binary win/loss can't be calibrated.
  An auto-resolved defense instead does siege damage scaled by **pressure**:
  - 1 when the garrison breaks;
  - 0 when the assaulting line breaks;
  - otherwise the defender's share of casualties (the same exchange-rate metric as the parity harness).
  A commanded defense is fought to the finish, so its outcome decides the siege directly.
- `PLAYER_DEFENDED_CAPTURE_MULT = 1.85`, calibrated by the harness in `defense.test.js`: expected
  control damage, weighted by roll frequency, stays within ±10% of the old roll.
- A region that falls sends the garrison's survivors back to a neighbouring province the player
  still holds; they are only lost if none exists. Defending is free: no action cost.
- `battleSettings.defaultMode === 'auto'` resolves defenses inside `resolveTurn`. The headless
  harnesses (`scripts/simulate.mjs`, the long-run tests) set it so they never stall.

**T9 as built:**
- **Server verification**:
  - `RESOLVE_TACTICAL_BATTLE` takes the command log and re-simulates the battle from the
    authoritative game state (`src/battle/sim/replay.js`). The client's reported result is ignored.
  - The log is sanitized first: every order is forced onto the player's side, junk is dropped and
    the length is capped.
  - Exit gate: 20 live-recorded battles replay to the identical result and hash, both from source
    and from the Deno edge bundle (`scripts/build-edge-engine.test.mjs`).
- **Garrisons (§8.10)**:
  - Only fortified buildings can be manned: a keep with real defenses, or a tower. Unwalled towns
    can't, which keeps unfortified battles in parity with auto-resolve.
  - A walled keep is entered from just outside its wall ring.
  - Prince+ AI defenders man their buildings with ranged squads first, keeping half the army in the field.
- **Amphibious landings**:
  - `BEGIN_AMPHIBIOUS_BATTLE` handles the landing. If an enemy fleet guards the coast, or the beach
    is empty, it falls back to the auto `AMPHIBIOUS_ASSAULT`.
  - The map's west edge becomes sea plus a sand beach, and the attacker's fallback line is the waterline.
  - The fleet brings a `navalBombardment` power: 2 salvos, reaching only the shore half of the field.
  - The attacker gets no reinforcements; the auto and command paths share `applyAmphibiousLanding`.
- **Audio, haptics and resolution**:
  - Audio is synthesized with WebAudio, so there are no asset files.
  - Haptics use Capacitor Haptics or `navigator.vibrate`.
  - One HUD toggle controls both sound and haptics.
  - Dynamic resolution runs DPR 2 → 1.25 → 1.
- Urban maps were already covered by the `urban` mapgen template (street grid of building blocks).

---

## 17. Milestones: build order, exit gates, sizes

Each milestone is its own branch → green suite → merge, like every previous milestone here.
Sizes are relative (S ≈ one focused session, M ≈ 2–3, L ≈ 4+).

| # | Milestone | Contents | Exit gate (all must pass) | Size |
|---|---|---|---|---|
| **T0** | Refactor, no behavior change | `computeHitMultiplier`; `src/engine/invasion.js` (`validateInvasion`, `getInvasionBattleContext`, `applyInvasionResult`); LAUNCH_INVASION rewritten on top | golden test (500 battles identical); every existing test unchanged; `enginePurity` extended to `src/battle/sim`+`setup` | S |
| **T1** | Headless sim core | world, spawn, step, straight-line movement then flow fields, combat with facing, morale/rout/pursuit, end conditions, `toStrategicResult`, hash | determinism test (same setup + log ⇒ same hash at every checkpoint, 50 seeds); perf test; result-shape test (valid input for `applyInvasionResult`) | M |
| **T2** | Battlefields and objectives | mapgen (9 templates), keep/walls/towers from fortLevel, capture points from deposits, supply income, assimilation | path-exists invariant (9 × 200); keep HP formula test; assimilation pause-when-contested test | M |
| **T3** | Renderer + sandbox | three.js scene, tokenFactory, terrain, instancing, interpolation, FX from events, dev-only `?battleSandbox=1` route (choose age/terrain/armies) | Playwright screenshot of the sandbox on 390×844 and 1440×900 with no console errors; manual 60 fps check on a real phone | M |
| **T4** | Controls + HUD | gesture recognizer, orders, selection chips, command bar, formations and line-drag, tactical pause/speed, deployment phase, minimap | gesture unit tests (tap vs pan vs long-press vs pinch thresholds); scripted Playwright touch flow: select → move → attack | M |
| **T5 — ship v1** | Strategic integration | BattleChoiceSheet (+ odds), BEGIN/RESOLVE/ABANDON, unit locks, END_TURN guard, IndexedDB save/resume + log replay, BattleResultScreen, lazy-loaded chunk | reducer tests (BEGIN pays once; RESOLVE sanitizes; ABANDON = auto with the same seed; locks enforced); e2e: invade → command → win → region occupied; kill the page mid-battle → reload → resumes | M |
| **T6** | Enemy commander | utility AI, difficulty table, retreat/objective logic, counter-targeting, flanking (King+) | parity harness ≥ 90% of matchups within 20 pp; AI never issues orders on unseen squads (fog test) | M |
| **T7** | RoN depth | territory + attrition + supply wagons; generals (aura + 4 abilities + signatures); commander powers incl. real missile consumption; reserves + neighbour reinforcements from real bearings; fog + intel + recon/spy satellites; perks as live effects | per-system unit tests; a missile power decrements `nation.missiles` exactly once; a reinforcement unit ends in the right region; intel pre-reveal only with `canSeeRegionDetails` | L |
| **T8** | Defense battles | pendingDefenses queue, Under-Attack UI, RESOLVE_DEFENSE_BATTLE, synthetic AI forces, calibrated capture chance | long-run harness: expected player territory loss under auto within ±10% of today's; turn can't end with pending defenses | M |
| **T9** | Expansion and polish | amphibious landings (beach edge + naval bombardment), garrisons, urban maps, audio (WebAudio SFX), haptics, dynamic resolution, server replay verification in the edge function | edge-function replay test returns the identical result to the client for 20 recorded battles | L |

---

## 18. Test strategy (summary)

- **Pure-sim unit tests** (vitest, node env, which works as-is because the sim has no DOM):
  combat math, facing arcs, rout/rally, supply, abilities, capture, end conditions, result shape.
- **Determinism**: record → replay → hash equality; also a "replay on a fresh worker instance"
  test to catch hidden global state.
- **Golden auto-resolve** fixture (T0) protects existing balance forever.
- **Parity harness** (nightly/slow tag) for balance.
- **Invariant fuzzing**: 1,000 random setups × 600 ticks. No NaN, no negative strength, strength
  never above its starting value, ended within the time limit, result ids ⊆ setup ids.
- **Reducer tests** for every new action, including tampered payloads.
- **Playwright** scratch visual passes per milestone (the project's habit) plus one committed e2e
  for the full invade→command→resolve flow.
- **Perf test** headless tick budget; a manual device matrix before T5 ships (a mid-range Android
  and an older iPhone).

---

## 19. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Command mode becomes "free wins" and trivializes war | Parity harness; the defender gets a real keep, towers and attrition; one attack per stack per turn stays; XP bonus capped at +20 |
| Phone performance | Squad-level sim (≤ 30 entities); instancing; worker; dynamic resolution; battery mode; hard field cap from combat width |
| Touch controls feel bad | Tactical pause; chips + command bar (no precision needed); gesture thresholds from CoH's lessons; playtest before T5 ships |
| A sim bug corrupts strategic state | `sanitizeResult` clamps everything; results can only lower strength; ids must match locked sets; ABANDON always available |
| App killed mid-battle | 10 s checkpoints + log replay; "auto-resolve instead" fallback |
| Bundle size | Lazy chunk: three.js is already in the main bundle via the globe; battle code + worker load on first battle only |
| Scope creep (it's an RTS!) | Milestones ship value at T5; everything RoN-deep is T7+; no citizen economy, ever |
| Save compatibility | New keys are plain-backfilled; `pendingBattle` from an old version whose setup `version` changed → offer auto-resolve |

---

## 20. "Sounds impossible" → how we do it anyway

| Sounds impossible | How |
|---|---|
| "RTS on a phone in a React web app" | Simulate ~30 squads, not 400 soldiers; draw soldiers with one instanced draw call per type; sim in a worker; tactical pause removes the APM wall |
| "3D units and buildings without artists" | Extrude the 140+ game-icons.net silhouettes we already ship into bevelled 3D tokens at runtime (`SVGLoader` → `ExtrudeGeometry`), tinted per side: an Army-Men / board-game-miniature look that reads as deliberate style |
| "4,482 unique battle maps" | Procedural, seeded by region id, driven by that region's real terrain, buildings, deposits, coast, infrastructure and neighbours' bearings; the same province always gives the same battlefield |
| "Multiplayer RTS on a turn-based, serverless backend" | Deterministic lockstep + command logs; the Supabase edge function replays the same pure sim to verify; live PvP later over Realtime with 3-tick input delay |
| "Being attacked while it isn't your turn" | Queue the assault as a defense battle and fight it at the start of your turn (Auto or Command) |
| "Surviving app switches mid-battle" | Checkpoints + replayable command log in IndexedDB; 6 minutes of battle re-simulates in ~0.2 s |
| "Real-time battles that respect a turn-based economy" | Battle Supply from capture points replaces gathering; reserves and reinforcements are your *real* units from *real* neighbouring regions; powers consume *real* satellites' access and *real* missiles |
| "Keeping auto-resolve and command mode fair to each other" | One shared multiplier function, one shared post-battle function, and a statistical parity gate in CI |

---

## 21. Decisions with defaults (can change later, nothing blocks on them)

1. **Default battle mode**: `ask` (the choice sheet every time, with "remember my choice").
2. **Decisive keep capture = immediate occupation** regardless of control. If playtests show it's
   too strong, change it to "control damage ×2".
3. **Tactical pause** in single-player: on. Disabled automatically in any future live PvP.
4. **Nuclear Strike power**: available to the player only (the AI never nukes tactically), with
   the full strategic consequences of the existing missile action.
5. **Defense battles**: T8, default `ask`. The `auto` setting never interrupts.
6. The old spec's open question "save/quit mid-battle?" is answered: yes, via checkpoints (§12.3).

---

## Sources (research)

- Rise of Nations: [Wikipedia](https://en.wikipedia.org/wiki/Rise_of_Nations) ·
  [HeavenGames features](https://ron.heavengames.com/gameinfo/features/) ·
  [RoN 101](https://ron.heavengames.com/press/ron101/) ·
  [Territory](https://riseofnations.fandom.com/wiki/Territory) ·
  [General](https://riseofnations.fandom.com/wiki/General) ·
  [Forced March](https://riseofnations.fandom.com/wiki/Forced_March) ·
  [Ambush](https://riseofnations.fandom.com/wiki/Ambush) ·
  [Assimilation](https://riseofnations.fandom.com/wiki/Assimilation) ·
  [City](https://riseofnations.fandom.com/wiki/City) ·
  [Population Limit](https://riseofnations.fandom.com/wiki/Population_Limit) ·
  [Armageddon Clock](https://riseofnations.fandom.com/wiki/Armageddon_Clock) ·
  [Missile Shield](https://riseofnations.fandom.com/wiki/Missile_Shield) ·
  [Conquer the World](https://riseofnations.fandom.com/wiki/Conquer_the_World) ·
  [Formations (strategy guide)](https://sites.google.com/site/ronstrategy/general/formations) ·
  [Flanking and Formations (forum)](https://ron.heavengames.com/cgi-bin/forums/display.cgi?action=st&fn=12&tn=3394) ·
  [GameSpot walkthrough](https://www.gamespot.com/articles/rise-of-nations-walkthrough/1100-6029147/)
- Red Alert 2: [Veterancy](https://cnc.fandom.com/wiki/Veterancy) ·
  [Garrisoning](https://cnc.fandom.com/wiki/Garrisoning) ·
  [Engineer](https://cnc.fandom.com/wiki/Engineer_(Red_Alert_2)) ·
  [Superweapons](https://cnc.fandom.com/wiki/Superweapon_(Red_Alert))
- Mobile RTS controls: [Company of Heroes mobile FAQ (Feral)](https://support.feralinteractive.com/docs/en/companyofheroes/1.0.2/ios/faqs) ·
  [Thoughts on CoH on Android](https://waywardstrategy.com/2020/09/16/some-thoughts-on-company-of-heroes-on-android/) ·
  [TouchArcade CoH iPad review](https://toucharcade.com/2020/02/24/company-of-heroes-ipad-review/)

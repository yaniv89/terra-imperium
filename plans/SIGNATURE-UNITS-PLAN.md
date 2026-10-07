# Signature units: the technical plan (phase SU)

Date: 2026-10-07. Status: plan, no code yet. Branch of this plan: `claude/plan-signature-units`.

This is the rules side of the 150 signature units (one per people, one age each). The art side,
the roster and the names are in `plans/ART-MODELS-PLAN.md` 4.5, 4.5a and 4.6; this plan replaces
the short rules list of 4.6 with something an implementer can build from. Master plan row: SU in
`plans/MASTER-PLAN.md` section 7.

## 0. Goal

Each of the 150 peoples of a peoples world gets one unit that is visibly and mechanically its own,
in the one age of its historical peak, without breaking three things the game already guarantees:

1. **Honest Auto** (master plan 6.1, 6.10): the auto-resolve and the real-time battle read the
   same unit and the same abilities, and stay inside the parity guardrail (tactical exchange
   within [auto / 2, auto x 3.5]) for every one of the 150 units.
2. **Equal worth**: every signature unit is worth about the same (a points budget, then measured),
   so no people is picked for its unit alone and no age is a snowball age.
3. **Determinism and speed**: the battle sim stays a pure function of setup and orders; battles
   and saves without signature units hash exactly as before; no measurable cost per tick.

## 1. What exists today (read before building)

| Piece | Where | What it means for SU |
|---|---|---|
| The roster, 150 entries `{ ageId, classId, model, rig, name }` | `src/data/signatureUnits.js` | Ages: bronze 34, classical 38, kingdoms 36, gunpowder 32, modern 10. Roles: infantry 61, ranged 44, cavalry (the mobile role) 43, siege 2. No naval or air entry yet. Helpers `signatureUnitFor(peopleId, ageId, classId)`, `signatureKey`, `baseClassOf`. |
| Art use of the roster | `src/battle/render/BattleRenderer.js` (around line 1078), `unitModels.js`, `src/battle/art/artIndex.js` | The renderer draws the signature model for every squad of the side's people in that class and age, when the GLB exists, else the base model. Rules: none. |
| Base roster per age | `src/data/unitClasses.js` `UNIT_ROSTER`, counters `getCounterMultiplier` (1.75 / 0.6), `getRosterCombatMultiplier` | A unit has no stored age: its stats follow its OWNER's effective age live (`getEffectiveAgeId(calendar, techAge)`), so every unit upgrades for free when its nation enters a new age. |
| Battle stats per class and age | `src/battle/data/battleStats.js` `CLASS_BASE`, `AGE_OVERRIDES`, `NAVAL_LINE_STATS`, `getUnitBattleStats` | Speed, range, attack rate, melee, charge, splash. Damage strength comes from `computeHitMultiplier`, never from here. |
| One hit multiplier for both modes | `src/engine/battle.js` `computeHitMultiplier` (counters, siege context, promotions, generals); the sim calls it in `src/battle/sim/combat.js` `attackSquad` | The natural hook: a signature multiplier added here applies to Auto and Command by construction. |
| Perks as precedent | `src/data/promotions.js` (`hasPerk`, shock, bulwark, resilient, volleyFire, unbreakable, forcedMarch, cadre, forager), read by battle.js and by `src/battle/sim/effects.js`, `morale.js`, `support.js` | Signature abilities follow the same pattern: a closed list of ids, each with one rule in the auto-resolve and one in the sim. |
| Squad creation | `src/battle/sim/world.js` `makeSquad` (stats from `getUnitBattleStats`) | The one place a squad gets its stats: signature stat steps are applied here, once. |
| Recruitment (player) | `src/engine/gameReducer.js` `RECRUIT_UNIT`; cost `getRecruitUnitCost` (`src/engine/economy.js`, flat per unit plus the age's strategic resource) | Cost is the same for every class today. |
| City production | `src/engine/world/cities.js` `productionCost` (`UNIT_CLASS_COST` per class), `canQueue`; units made from finished items in `src/engine/resolveTurn.js` (around line 209) | Per-class production cost exists: the signature cost step multiplies it. |
| Upkeep | `calcNationBalance` in `src/engine/economy.js`: units counted x `UNIT_UPKEEP_GOLD_PER_TURN`; AI side in `src/engine/aiEconomy.js` | Upkeep is a unit count today: becomes a sum of unit weights. |
| AI recruitment | `src/utils/aiLogic.js` `chooseAIRecruitClass` / `processAIRecruitment` (Tier 1, doctrine mix and counters); `src/engine/aiProduction.js` `chooseProduction` (city queues, independents' garrisons) | Both pick a CLASS; the signature follows from the class (section 3.1), so the AI needs no new choice. |
| Other unit creation paths | `src/engine/mercenaries.js`, `src/engine/raids.js` / `independents.js` (garrisons), `civilWar.js` (rebels), `src/engine/worldgen/emergentWorld.js` (starts) | Every path calls one stamping helper (3.1). |
| Names | `src/engine/peopleNames.js` (regiment numbers per `regimentKind`), `src/data/regimentNames.js` `regimentName`, `src/data/unitNames.js` `unitDisplayName` | "3rd Akkadian Spearmen" today; a signature regiment gets its own numbering and short title. |
| Battle economy | `src/battle/data/economy.js` `UNITS` (training cost and time per role, `TRAIN_STRENGTH` 200), buildings' `trains`; sim `src/battle/sim/economy.js` | Trained squads of the signature role are signature squads (4.3). |
| Honest Auto | `src/engine/autoBattle.js` `autoFromInputs`, `auxiliariesFor`, `autoDispositions`; inputs `src/engine/battleInputs.js` | Must read the same abilities (section 5). |
| Parity harnesses | `.claude/skills/battle-lab/parityEco.sim.js`, `autoCalib.sim.js` | Extended with a signature mode (section 5.3). |
| Research | `src/data/techTree.js`: the military line has two techs per age (Bronze Casting, Composite Bow; Iron Weapons, Siege Engineering; Feudal Levies, Plate Armor; Gunpowder Weapons, Standing Armies; Mechanized Warfare, Precision Guidance); ids from `idOfName`, `military_<slug>` | The unlock (3.2). |

## 2. Decisions

Settled by the user (ART-MODELS-PLAN 4.5, 4.6), kept:
- D1. One signature unit per people, in one age, any role. It REPLACES the people's base unit of
  that role in that age. Other ages: ordinary base units only.
- D2. Stats are the base unit's of that role and age plus a modest edge. No second stat scale.
- D3. The AI uses it as the base unit of its role (no special logic in the first version).
- D4. The art never waits for the rules: without the model file the base model stands.

Proposed by this plan (each one is the simplest choice consistent with the above; the open ones
are listed again in section 10):
- D5. **Peoples worlds only.** The rules key on `nation.people`. The legacy 240-country world
  (tests, old saves, `scenario.mode` other than `peoples`) never has signature units, so its
  hashes and tests do not move.
- D6. **A stamp on the unit**: a signature unit carries `unit.sig = '<peopleId>'`, set when it is
  made. Its rules apply while its OWNER's effective age equals the entry's `ageId`. The stamp
  (not the owner's people) says what the unit is, so a unit that changes owner keeps it only if
  the rules allow (mercenaries, 3.7).
- D7. **Deltas over the base unit**: stat STEPS (integer) and ABILITIES (a closed list of 13
  ids) over the base unit of the same role and age. Never absolute stats. If R4 or a later
  balance pass changes the base unit, every signature unit of that role and age moves with it.
- D8. **A points budget**: every kit costs exactly 10 points from one price list (section 4.2),
  then the measured edge of each of the 150 must fall in one band (section 5.3). Points are the
  design tool; the measurement is the acceptance.
- D9. **Unlock**: being in the age AND the age's first military tech (Bronze Casting, Iron
  Weapons, Feudal Levies, Gunpowder Weapons, Mechanized Warfare). Without the gate the 34 bronze
  peoples would field theirs from turn 1, against the equal-starts rule of W0.
- D10. **Starting units stay base** (equal starts). Only units made after the unlock are stamped.
- D11. **Obsolete at the end of its age**: when the owner's effective age passes the entry's age,
  the stamp is removed in the same turn and the unit becomes the new age's base unit of its role,
  the free live upgrade every unit already gets. Its regiment is renumbered in the base kind.
- D12. **Conquest and vassals do not transfer it**: a conqueror never recruits the conquered
  people's unit; a vassal fields its own (it is its own nation and people); the overlord does not.
- D13. **Independents field theirs** when their people has one and their (calendar) age matches:
  their garrisons and raiders are made through the same stamping helper. Flavour for free.
- D14. **No new strength scale**: a signature unit still has `strength` 1000 (its battle hit
  points, casualties map 1:1). Its worth shows in damage, defence, morale and speed, never in
  more men.

## 3. Rules in the macro engine

### 3.1 One stamping helper

New pure module `src/engine/signature.js` (logic; the data stays in `src/data/`):

```js
/** The signature entry a nation would make for this class now, or null. */
export const signatureToMake = (state, nationId, classId, ageId) => {
  // null unless: peoples world (D5), nation.people has an entry, entry.ageId === ageId,
  // entry.classId === classId (and entry.navalLine === line for naval), and the unlock tech is
  // researched by this nation (D9; independents: their calendar age only, they do not research).
};
/** The fields to spread into a new unit: { sig: peopleId } or {}. */
export const signatureStamp = (state, nationId, classId, ageId) => { ... };
/** The unit's live signature entry (owner's effective age matches), else null. */
export const activeSignature = (state, unit) => { ... };
```

Every unit creation path spreads `...signatureStamp(...)` into the new unit: `RECRUIT_UNIT`
(gameReducer.js), city production completion (resolveTurn.js, the line that builds
`units[id]` from a finished item), `processAIRecruitment` (aiLogic.js), mercenary hire
(mercenaries.js, 3.7), independents' garrison and raid reserve (through city production) and
rebels (civilWar.js). Starting units (emergentWorld.js) do not (D10). A test runs each path in a
peoples world with a people in its age and asserts the stamp, and in a legacy world asserts none.

### 3.2 Recruitment, replacement and the unlock

- Replacement (D1): for a nation whose `signatureToMake` is non-null for class C, the recruit list
  and the production list show the signature unit in place of the base unit of C. There is no
  way to make the base unit of C in that age (Civ rule). `canQueue` and `RECRUIT_UNIT` need no
  new refusal: the same `{ kind: 'unit', classId: C }` item is made, and stamped.
- Unlock (D9): `SIGNATURE_UNLOCK_TECH = { bronze: 'Bronze Casting', classical: 'Iron Weapons',
  kingdoms: 'Feudal Levies', gunpowder: 'Gunpowder Weapons', modern: 'Mechanized Warfare' }`
  in `src/data/signatureKits.js`, resolved to ids with techTree's `idOfName`. Before the tech the
  people makes base units of C. The research screen lists "Unlocks: Numidian Javelin Riders" on
  that tech for that people (UI, section 7).
- A people that reaches its age late, or never (a modern-peak people in a short game), gets it
  only then, as 4.6 says. A nation whose effective age jumps over the signature age in one turn
  (the calendar floor moving two ages at once is not possible today, a tech rush is capped at one
  age) never sees it; accepted.

### 3.3 Costs and upkeep

Formulas (all integers or rounded once, as the existing costs are):
- Production cost: `productionCost(item)` x `(100 + 15 x costSteps) / 100` when the item would be
  stamped. `baseProductionCost` gets the nation context it already has through `ctx` (ageId) plus
  the stamp decision; `chooseProduction` passes it.
- Player gold recruit: `getRecruitUnitCost(...)` gold x the same factor (the strategic resource
  amount unchanged).
- AI recruit (`canAffordAIRecruit` / `applyAIRecruitCost` in aiEconomy.js): the same factor.
- Upkeep: `calcNationBalance` counts `upkeepWeight(unit)` instead of 1 per unit:
  `1 x (100 + 15 x costSteps) / 100 x (cheapUpkeep ? 0.5 : 1)` for an active signature unit, 1
  otherwise. The AI upkeep in aiEconomy.js reads the same helper. Marching upkeep (routes.js
  `marchUpkeep`) scales by the same weight.
- Mercenary price and upkeep (mercPrice, mercUpkeep) x the same factor when the band is stamped.

### 3.4 Strength, maps and army stacks

- Strength stays 1000 (D14). `militaryStrength` keeps summing strength (it is a headcount).
- Power estimates that decide wars (`getEffectiveMilitaryPower` in aiEconomy.js, warOdds.js)
  count an active signature unit as `SIG_POWER_WEIGHT` (1.2, set from the measured mean edge in
  SU3) units, so the AI's war math sees what the battle will see. `battleOdds.js` samples the
  auto-resolve, so it is honest with no change once Auto reads the abilities.
- Stacks, supply cap (supplyMeter.js), sight, zone of control, move points (armies.js): a
  signature unit is a unit of its class, unchanged. Map movement is NOT a signature trait (the
  speed steps are battle speed only), so routes and A* stay as they are.
- The army badge on the map (sceneModel.js / spriteArt.js) shows a small signature mark when the
  stack holds an active signature unit (UI, section 7).

### 3.5 Names

- `src/data/signatureKits.js` gives each entry a short `title` without the people adjective and
  without the "(improvised)" note, at most 22 characters so it fits the 844x390 cards:
  `numidia: { title: 'Javelin Riders' }`, `israel: { title: 'Merkava' }`.
- `regimentKind(unit)` returns `'<classId>~sig'` for a stamped unit, so signature regiments are
  numbered on their own: "1st Numidian Javelin Riders", while base cavalry keep their count.
- `unitDisplayNameFor(unit, nation, ageId)` (new, in `src/data/unitNames.js`): the title when the
  unit is an active signature, else `unitDisplayName(ageId, classId, navalLine)`. Every UI place
  that names a single unit moves to it (list in section 7).
- D11 renumbering: removing the stamp also clears `unit.regiment`; peopleNames.js gives the next
  number in the base kind on the same turn. The battle reports keep the name the unit had.

### 3.6 Save shape

- One optional unit field: `unit.sig` (a people id string). No save version bump (save version
  10 stays): an old save has no stamps, every unit is base, which is correct.
- `state.nations[id].regiments['<classId>~sig']`: a new key in an existing optional map.
- Invariants in `src/engine/stateAudit.js`: `unit.sig` is a key of `SIGNATURE_UNITS`; its
  entry's `classId` equals `unit.classId`; the owner's effective age equals the entry's age (D11
  clears the rest in the age phase, so a lapsed stamp after a full turn is a violation); no
  stamp in a non-peoples world.

### 3.7 Ownership changes

- Conquest (D12): units never change hands on conquest today (they die or retreat), so nothing
  to do; the conqueror's NEW units in the conquered city are stamped by the conqueror's people.
- Vassals: own nation, own people, own stamp.
- Rebels (civilWar.js): a rebel nation of the same people makes its own stamped units; the
  helper decides by the rebel nation's `people`.
- Mercenaries (proposal, open question Q3): a band hired from an independent whose people's
  signature is the band's class (raiders sell cavalry, mercantile cities infantry) in the buyer's
  effective age is stamped with the SELLER's people: Numidian riders for hire. Rule check for
  `activeSignature` is still the owner's (buyer's) effective age. Price and upkeep x the cost
  factor.

### 3.8 The age phase

In resolveTurn's age update (where `newAge` and each nation's effective age are computed), one
pass per nation whose effective age changed: units with a `sig` whose entry age is no longer the
owner's effective age lose the stamp and their regiment number (D11). O(units of that nation)
only on the turn its age changes. Log line for the player: "The Numidian Javelin Riders pass into
legend; your riders now serve as Heavy Cavalry."

## 4. The data model and the budget

### 4.1 Files and shapes

`src/data/signatureUnits.js` stays the art table (the renderer reads it; art edits never touch
rules). New `src/data/signatureKits.js` holds the rules:

```js
export const SIGNATURE_BUDGET = 10;
export const SIGNATURE_UNLOCK_TECH = { bronze: 'Bronze Casting', ... };
// Stat steps: price per step, allowed range, and the step's effect.
export const STAT_STEPS = {
  atk:  { price: 3, min: 0, max: 2 },   // damage dealt x (1 + 0.10 per step)
  def:  { price: 3, min: 0, max: 2 },   // damage taken x (1 - 0.10 per step)
  spd:  { price: 1, min: -1, max: 3 },  // battle speed x (10 + step) / 10; -1 refunds 1 point
  rng:  { price: 2, min: 0, max: 2 },   // +1 tile of range per step; shooters only
  mor:  { price: 1, min: 0, max: 2 },   // morale loss x (1 - 0.15 per step)
  cost: { price: -2, min: -2, max: 2 }  // +1 = 15% dearer and refunds 2 points; -1 = 15% cheaper, costs 2
};
export const ABILITIES = { charge: { price: 3, roles: [...] }, ... };  // section 4.3
// One kit per people id of SIGNATURE_UNITS (same keys, checked by a test).
export const SIGNATURE_KITS = Object.freeze({
  numidia: { title: 'Javelin Riders', steps: { spd: 2, mor: 1 }, abilities: ['javelins', 'cheapUpkeep'], terrain: ['desert'] },
  ...
});
```

Points spent = sum over steps of `price x step` + sum of ability prices + 2 per terrain kind.
Every kit spends exactly `SIGNATURE_BUDGET`. Caps: at most 3 abilities (terrain kinds count as
abilities), at most 2 terrain kinds, steps inside their ranges, abilities only for their roles.

Why multipliers over the base and not absolute values: the base unit already differs by age (the
roster's attack and defence, AGE_OVERRIDES), and R4 will still move it. A step is the same
relative edge in any age, so one budget fits all five ages and the kits survive base changes.

Integer form for the sim: steps are integers; every derived number is computed ONCE at squad
creation: speed and range in Q units with `Math.round`, the multipliers as permille integers
(`1000 + 100 x atk`) turned into the same kind of float factor the existing counters and perks
already multiply into `computeHitMultiplier` (IEEE double, identical in the worker and in Node;
damage is rounded per hit as today). No new class of nondeterminism.

### 4.2 The price list (first guess; SU3 measures and replaces it)

| Item | Points | Effect (both modes, details in 5.1) | Roles |
|---|---|---|---|
| atk step | 3 | damage dealt x1.10 | all |
| def step | 3 | damage taken x0.90 | all |
| spd step | 1 (-1 refunds 1) | battle speed +10% | land |
| rng step | 2 | +1 tile range | shooters: ranged, siege, gunpowder and modern infantry, modern cavalry, a mounted archer |
| mor step | 1 | morale loss x0.85 | all |
| cost step | -2 per +1 | +15% production, gold, training and upkeep | all |
| charge | 3 | +25% (+50% if the class already charges) on the first blow after closing 4 tiles; Auto: round 1 shock | melee |
| antiCavalry | 3 | +50% damage against the mobile role (cavalry class: chariots, camels, elephants, tanks) | infantry, ranged |
| mountedArcher | 5 | a mobile squad that shoots: range 5 tiles, not melee, keeps its speed and its class | cavalry |
| javelins | 3 | one ranged blow (range 3 tiles) as an enemy first comes close, again after 30 s | infantry, cavalry |
| armourPiercing | 3 | the target's own defence multipliers below 1 (promotions, general, signature def) count half | all |
| wallBreaker | 3 | x4 damage to walls, gates and buildings; counts as a siege engine at the gate in Auto | infantry, cavalry |
| shieldWall | 2 | damage taken from shooters x0.75 | infantry, ranged |
| terrain:<kind> | 2 each | +20% dealt and x0.9 taken in battles on that terrain: desert, forest, hills (hills and mountains), river, cold (arctic), coast (island, landings) | all |
| fearsome | 2 | its hits cost the target 30% more morale | cavalry (elephants, chariots, hussars), infantry |
| moraleAura | 3 | friendly squads within 5 tiles lose 15% less morale | all |
| cheapUpkeep | 2 | upkeep x0.5 (macro only) | all |

Caps that keep any context sane: a signature unit's combined damage-dealt factor is at most 1.6
and its damage-taken factor at least 0.65 in any situation (clamped in the helper; a test walks
every kit through every context).

Naval and air (no entry yet, Q4): the data model allows `classId: 'naval'` with a `navalLine` and
`'air'`; their allowed set is atk, def, spd, rng, mor, cost and charge (a ram for oared lines).

### 4.3 Filling the 150 kits

- A draft script `scripts/signature/draft-kits.mjs` suggests a kit per entry from its rig, role,
  age and name keywords, then a person (or the implementer, with the roster sources of 4.5a)
  edits the table. The keyword table (first match wins, then fill the rest with steps):

| Keyword or rig | Suggested |
|---|---|
| horse archer, horse-archer, mounted archer | mountedArcher |
| javelin, peltast, skirmisher, sumpitan | javelins (+ spd) |
| chariot (rig chariot-*), lancer, lance, hussar, knight, cataphract, armoured horse | charge |
| elephant (rig) | fearsome + charge, spd -1 |
| camel (rig) | terrain:desert; antiCavalry for a camel in the infantry or ranged role (horses shy from camels) |
| spear, pike, halberd, dagger-axe | antiCavalry |
| crossbow, rifle, jezail, ATGM, tank | armourPiercing (+ rng) |
| shield, oxhide, figure-eight, phalanx, hoplite | shieldWall (+ def) |
| guard, garrison, fortress, city-guard | def, terrain by the people's home tile |
| mountain, highland, ski | terrain:hills / terrain:cold |
| forest, ambush | terrain:forest |
| sea, marine, canoe, boat, orang laut | terrain:coast |
| desert, oasis, caravan | terrain:desert |
| standard, sacred, royal guard, sharur | moraleAura |
| raiders, irregulars, guerrilleros, rebels | cheapUpkeep + cost -1 |
| gun crews, stone-thrower (siege) | rng, atk |

- Examples (all 10 points):

| People | Unit | Kit | Points |
|---|---|---|---|
| numidia | Javelin Riders (classical cavalry) | javelins 3, terrain:desert 2, cheapUpkeep 2, spd +2 (2), mor +1 (1) | 10 |
| parthava | Horse Archers (classical cavalry) | mountedArcher 5, rng +1 (2), spd +2 (2), mor +1 (1) | 10 |
| magadha | War Elephants (classical cavalry) | fearsome 2, charge 3, atk +1 (3), def +1 (3), spd -1 (-1), cost +1 (-2), mor +2 (2) | 10 |
| israel | Merkava (modern cavalry) | armourPiercing 3, def +2 (6), mor +2 (2), spd +1 (1), cost +1 (-2) | 10 |
| akkad | Sharur Spearmen (bronze infantry) | antiCavalry 3, moraleAura 3, atk +1 (3), mor +1 (1) | 10 |
| keftiu | Figure-Eight Shields (bronze infantry) | shieldWall 2, terrain:coast 2, cheapUpkeep 2, def +1 (3), mor +1 (1) | 10 |
| qi | Maling Crossbowmen (classical ranged) | armourPiercing 3, terrain:forest 2, atk +1 (3), rng +1 (2) | 10 |
| rygir | Ski Infantry (modern infantry) | terrain:cold 2, terrain:hills 2, atk +1 (3), spd +2 (2), mor +1 (1) | 10 |
| cherusci | Forest Ambushers (classical infantry) | terrain:forest 2, charge 3, atk +1 (3), spd +2 (2) | 10 |
| sarmatians | Winged Hussars (gunpowder cavalry) | charge 3, fearsome 2, atk +1 (3), mor +1 (1), spd +1 (1) | 10 |
| bosporan_kingdom | Stone-Throwers (classical siege) | atk +1 (3), def +1 (3), rng +1 (2), cost -1 (2) | 10 |
| tondo | Lantaka Crews (gunpowder siege) | terrain:coast 2, atk +1 (3), spd +2 (2), cost -1 (2), mor +1 (1) | 10 |

Rules come from the ROLE, never from the rig: Saba's camel archers are a ranged unit (speed steps,
desert), Kindah's camel riflemen a modern infantry unit (desert, speed, range).

## 5. Rules in the battle sim and in Auto (one table, two implementations)

### 5.1 Where each item lives

| Item | Real-time sim (src/battle/sim) | Auto (src/engine/battle.js, autoBattle.js) |
|---|---|---|
| atk, def, antiCavalry, armourPiercing, shieldWall, terrain | `computeHitMultiplier` (shared): new factors `sigDealt(unit, target, ctx)` and `sigTaken(target, unit, ctx)`; `ctx.terrain` (the battle's terrain id, `w.setup.terrain`) and `ctx.river` (the battle tile has a river, from tileContext.js) added to `sideCtx` | the same function; `resolveBattle` passes `terrain` (it has it) and `river` (new optional arg from fieldBattle.js / battleInputs) in the ctx |
| charge | `attackSquad`: the existing `stats.charge && movedSinceAttack >= CHARGE_DISTANCE` branch uses the squad's charge factor (1.25 base, 1.5 with the ability; a non-charging class gains `stats.charge`) | round 1 shock phase: x the same factor (`ctx.round === 1`, passed by `rollHit`) |
| spd | `makeSquad`: `stats.speed = Math.round(base.speed x (10 + spd) / 10)` | escape chance of its own routed units +0.08 per step (`autoDispositions`); a unit with spd >= 2 counts as a pursuer |
| rng | `makeSquad`: `stats.range += rng x Q` | ranged phase damage x(1 + 0.08 x rng) (more shots before contact) |
| mor, fearsome | `applyDamage`'s morale line: x `sigMoraleTaken(target)` x `sigMoraleDealt(attacker)` | `applyHits`: the same two factors (`rollHit` returns the dealer) |
| mountedArcher | `makeSquad`: cavalry stats with `range 5Q, melee false, attackTicks S(1.4), charge false`; the class stays cavalry for counters and capture rules | the unit fights in the ranged phase (`isRangedClass` becomes `isRangedUnit(u)`) and still flanks from the reserve |
| javelins | new `q.javelinTick`: when an enemy squad first comes within 3 tiles and the cooldown (30 s) is over, one ranged blow at 1x (phase 'ranged'); one integer field, checked in the target scan the squad already does | one extra ranged-phase blow in round 1 at share 0.5 |
| wallBreaker | `attackStructure`: x4 on `NON_SIEGE_STRUCTURE_MULT` (0.15 to 0.6, still under siege's x3) | `noSiege` gate: wall-breakers count as half a siege engine: `wallsMult` relief halved; `autoCityDamage` unchanged |
| moraleAura | effects.js: a per-second pass (every 20 ticks, only when the side has an aura squad) marks friendly squads within 5 tiles via the spatial buckets; `moraleLossMult` x0.85 for marked squads | side-wide morale loss x `(1 - 0.15 x min(1, 3 x auraStrengthShare))` |
| cheapUpkeep, cost | none (macro); training cost in battle x the cost factor (5.2) | none |

All factors are read from a per-squad `q.sig` object built once in `makeSquad` (null for every
squad without a stamp), so a battle without signature units runs the exact same code path and
hashes as before. `view(q)` in combat.js passes `sig` through so `computeHitMultiplier` sees it.

### 5.2 Setup and training in battle

- `buildBattleSetup` copies `unit.sig` onto the squad's unit record when `activeSignature` holds
  for that side's age (the caller passes the state's answer: the setup stays pure data).
- `setup.sides[i].signature` (new, optional): the side's signature entry id when the side's
  nation would make one now (`signatureToMake` for its role and age). The battle economy's
  training uses it: a squad trained at the building of that role (barracks infantry, range
  ranged, stable cavalry, siege workshop siege) is a signature squad, at the role's `UNITS` cost
  and time x the cost factor. Auxiliaries in Auto (`auxiliariesFor`, which trains infantry) carry
  the stamp when the side's signature role is infantry.
- Militia (`militiaFor`) never carries it (townsfolk, not soldiers).
- `SETUP_VERSION` 6 to 7 (the two optional fields); old replays load as before.
- Renderer: the signature model is chosen by `squad.sig` (falling back to the side's people for
  setups before version 7), so a lapsed unit, a mercenary band or a base unit made before the
  unlock draws correctly. Placeholder rule in section 7.

### 5.3 Parity per signature unit (the acceptance)

New mode in `.claude/skills/battle-lab/parityEco.sim.js`: `SIG=all` (or `SIG=numidia,parthava`).
For each entry, in its own age against the same age:
- Matchups by role: the signature replaces the base units of its role in a base army of the
  standard mix. Infantry or ranged: `[S, S, other, cavalry]` vs `[base, base, other, cavalry]`;
  cavalry: `[infantry, infantry, S, S, ranged]` vs the base mirror; siege: the assault matchup
  with `[..., S]`. Run as attacker in a field battle and as defender of a walled assault (siege:
  attacker of a walled assault), on terrain `mixed` and on each terrain kind in its kit.
- Three numbers per entry and battle kind:
  1. Guardrail: tactical vs auto exchange ratio IN ([0.5, 3.5]), as every parity row today.
  2. Edge: `E = exchange(base mirror) / exchange(with S)` for the signature side, tactical. The
     band: **1.08 <= E <= 1.40** (averaged over its battle kinds and terrains, the terrain runs
     weighted by how often battles happen on that terrain, from a balance-sim battle histogram).
  3. Auto agrees on the edge: `E_auto` within `[E / 1.25, E x 1.25]`.
- Seeds: N=16 for all 150 (sharded by age with `AGES=`, run in the background, the run time
  written in the result file), N=32 again for every entry outside a band. Output to
  `plans/signature-units/parity-<date>.txt`.

### 5.4 Calibrating the prices

New `.claude/skills/battle-lab/sigPrices.sim.js`: for each age and role, each catalog item ALONE
at one step on the base unit (N=32, the matchups above), measures its tactical edge `e_i` (and
the auto edge). Suggested price `p_i = round(3 x ln(e_i) / ln(e_atk))` (the atk step is the 3-point
reference), a terrain item discounted by its battle-terrain frequency. The output is a suggested
STAT_STEPS / ABILITIES price table; the implementer updates the prices, re-fits the kits to 10
points, then runs 5.3. If an item's auto edge and tactical edge disagree by more than 1.25x, the
Auto mapping of that item in 5.1 is fixed first (one constant per item in `AUTO_TUNE`,
autoCalib.sim.js gains a `SIG_` grid), never the guardrail.

## 6. AI and snowballing

- Recruitment: no new choice (D3). `chooseAIRecruitClass` and `chooseProduction` pick a class;
  the stamp follows. Counters keep working: a signature unit is its class to the counter table,
  so the rival's counter-building already answers it.
- An optional knob `SIG_DOCTRINE_BONUS` (default 1, off): the doctrine share of the signature
  class x the knob. Turned on only if the balance-sim shows the AI under-uses its unit.
- AI cost and upkeep go through the same helpers (3.3), so a dearer unit is felt by the AI too.
- Power weight (3.4) makes war odds honest.
- Snowball watch (balance-sim, `SCENARIO=peoples SIZE=standard`, 6 seeds x 150 turns, base
  `claude/integration` vs the SU branch, `compare.sh`):
  - no star on `giniCities`, `maxProvinceShare`, `topMilitaryToMedian`;
  - new metrics in `worldStats.sim.js`: `sigUnits` (active signature units), `sigShare` (of land
    units), `conquestsInSigAge` and `conquestsOutOfSigAge` per 100 nation-turns. Acceptance: the
    in-age rate at most 1.5x the out-of-age rate, and no single people over 2x the median
    conquests across seeds;
  - `nonFinite` and audit violations 0; `msPerTurn` star allowed only within +2%.
  - 150 turns may end before the later ages: record the ages reached; if kingdoms and later are
    not reached, also run `TURNS=400` on 2 seeds and report it (not a gate, a look).

## 7. UI (to `plans/UI-DESIGN.md`)

- The mark: one small signature glyph (a laurel, drawn in the people's colour, NOT brass, which
  is for the primary action only) beside the unit icon wherever a signature unit appears.
- Recruit and production lists (`src/components/city/CityPanel.jsx`, the unit rows around lines
  107 and 355): the row shows the title, the mark, the cost with the factor, and "replaces Heavy
  Cavalry". Before the unlock: the base row, with a line "Javelin Riders after Iron Weapons".
- Unit card (`MilitaryPanel.jsx`, `armySheetModel.js`, the army sheet on the map, the battle HUD
  squad card in `battleHudModel.js`): the abilities as short chips ("Javelins", "Desert +20%",
  "Cheap upkeep"), each opening its reason on tap ("Throws javelins as an enemy closes: one blow
  at 3 tiles, again after 30 s"), and the steps as "+10% damage" lines. The base unit's numbers
  stay visible (reasons on tap rule).
- Battle economy train menu (`EconomyHud.jsx`): the signature entry in its building's menu.
- Pre-battle and reports (`PreBattleModal.jsx`, `BattleReportSheet.jsx`): names through
  `unitDisplayNameFor`; odds already include it.
- W17 nation overview (`NationOverviewSheet.jsx`): a "Signature unit" row: title, age, role,
  status (in N ages / after <tech> / active / passed into legend).
- W01 start screen (`StartScreen.jsx`): the people preview shows the unit title, its age and
  role, and two ability chips, so a player can choose by it.
- Research: the unlock tech shows the unit for the player's people.
- Placeholder art: until `src/assets/units/signature/<model>.glb` exists (D4) the battle draws
  the base unit's model with the mark on the squad's banner, and the map badge carries the mark.
  The rule is in one function (`signatureArtFor(entry)` in unitModels.js): the art file decides
  the model, the stamp decides the mark; rules never depend on the art.
- Phone layout (844x390): chips wrap to two lines at most; the title is the 22-character cap.

## 8. Validation plan

Unit tests:
- `src/data/signatureKits.test.js`: same keys as SIGNATURE_UNITS; every kit spends exactly the
  budget; caps (steps, abilities, terrains, roles); `title` length; only known ability ids.
- `src/engine/signature.test.js`: `signatureToMake` (peoples only, age, class, tech gate,
  independents by calendar age); stamp on every creation path; cost and upkeep factors; D11
  clearing and renumbering; mercenary rule; no stamp on starting units; the clamps (1.6, 0.65)
  over every kit in every context.
- `src/engine/battle.test.js` additions: each ability's Auto rule on a hand-made exchange (a
  javelin round-1 blow, a shield wall in the ranged phase, a charge in round 1).
- `src/battle/sim/systems.test.js` additions: each ability's sim rule on a two-squad world
  (speed and range in Q, the javelin cooldown, the aura mark, wall-breaker damage, the mounted
  archer staying cavalry for counters).
- Hash guards: the battle-bench and kernel fixtures hash unchanged (no signature in them); the
  legacy world's `stateHash.sim.js` unchanged; a peoples world with no people in its age yet
  unchanged for the first turns.
- `stateAudit` cases for the three invariants of 3.6.
- An integration test through `resolveTurn` with a fixed seed: a people unlocks, recruits, fights
  on Auto, passes its age, the unit lapses; upkeep follows.

Parity: section 5.3 for all 150 (the gate), section 5.4 for the prices.

Balance: section 6 (the gate).

Speed:
- `node scripts/battle-bench.mjs --eco`: without signature units p95 within the run-to-run noise
  of the base commit on the same machine; with a signature-heavy setup (every squad of one role
  signature, an aura and javelins present) p95 at most +3%.
- balance-sim `msPerTurn` (section 6).

Plus `npm run lint` (zero warnings) and `npx vitest run`.

## 9. Order of work

| Unit | What | Files | Tests | Depends on | Size |
|---|---|---|---|---|---|
| SU0 | Data: catalog, prices, budget, unlock table, 150 kits and titles (draft script, then review against 4.5a) | `src/data/signatureKits.js`, `scripts/signature/draft-kits.mjs` | signatureKits.test.js | none | 1 session |
| SU1 | Macro rules: `src/engine/signature.js`, stamping on every creation path, unlock, cost and upkeep, power weight, age-phase clearing, names, audit | gameReducer.js, resolveTurn.js, aiLogic.js, aiEconomy.js, economy.js, world/cities.js, mercenaries.js, civilWar.js, peopleNames.js, regimentNames.js, unitNames.js, stateAudit.js | signature.test.js, audit, integration | SU0 | 1 to 2 |
| SU2 | Battle: squad stats, `computeHitMultiplier` hooks, the sim side of every ability, training in battle, setup v7, renderer keyed by squad | battleStats.js, sim/world.js, combat.js, effects.js, morale.js, sim/economy.js, buildBattleSetup.js, economySetup.js, BattleRenderer.js, unitModels.js | systems tests, hash guards | SU0 | 2 |
| SU3 | Auto and parity: the Auto side of every ability, battleInputs carries the sides' signatures, auxiliaries, `SIG` mode, sigPrices harness, price calibration, kits re-fit, all 150 in band | battle.js, autoBattle.js, battleInputs.js, fieldBattle.js, parityEco.sim.js, sigPrices.sim.js, autoCalib.sim.js | battle.test.js, parity file | SU1, SU2; **after R4** (rosters final) | 2 to 3 |
| SU4 | AI and balance: the optional doctrine knob, worldStats metrics, compare runs, fixes | aiLogic.js, worldStats.sim.js | balance-sim gate | SU3 | 1 |
| SU5 | UI: recruit rows, unit card chips with reasons, train menu, W17 row, W01 preview, research unlock line, map and battle marks | CityPanel.jsx, MilitaryPanel.jsx, armySheetModel.js, battleHudModel.js, EconomyHud.jsx, NationOverviewSheet.jsx, StartScreen.jsx, sceneModel.js, spriteArt.js | model tests, a phone screenshot at 844x390 | SU1 (can run beside SU3) | 1 to 2 |
| SU6 | Result: master plan section 6 result note, ART-MODELS 4.6 updated with the final rules | plans | none | all | small |

Total about 8 to 11 sessions. SU0 to SU2 can start before R4; SU3's calibration must run on R4's
final rosters, or it is done twice.

## 10. Risks and open questions

Risks:
- **The Auto mapping of positional abilities** (javelins, aura, mounted archers, charge) is an
  approximation; it may miss the band for some entries. Mitigation: one `AUTO_TUNE` constant per
  ability, calibrated by 5.4; an ability that cannot be made honest is dropped from the catalog
  rather than kept unfair.
- **Situational abilities** (terrain) are worth little on average and a lot on their ground. The
  frequency weighting prices them; the band is checked on their terrain too, with a looser upper
  bound (1.60) there.
- **Early ages see more play**: in a 150-turn game the bronze and classical units (72 of 150) do
  the fighting. The D9 tech gate and the conquest-rate metric watch it.
- **Run time** of 150 x several battle kinds x 16 seeds of full economy battles: sharded and in
  the background; if too slow, the edge band is checked at N=8 first and N=32 only near the
  edges.
- **Kit quality**: 43 units are "(improvised)" troop types; their kits are generic by design
  (steps more than abilities).

Open questions for the user (the plan's proposal in brackets):
- Q1. One unit per people, as now, or per theme (fewer, shared)? [Per people, as decided in 4.5;
  nothing in this plan needs per theme.]
- Q2. Unlock: the age alone, or the age plus its first military tech? [Age plus tech (D9), so
  bronze peoples do not have it on turn 1.]
- Q3. Do mercenaries from an independent of that people come as its signature unit? [Yes, when
  the band's class is that people's signature role and the buyer is in that age.]
- Q4. Naval and air: the roster has none, sea battles exist (D5b). Should some peoples switch to
  a ship (for example Srivijaya, the Lapita, Keftiu, Tondo)? [Not in SU; the data model allows
  it; revisit with the ship art of ART-MODELS 4.7 and the later naval RTS.]
- Q5. How strong? [About +20% in its featured fights, band 1.08 to 1.40: noticeable, never a
  reason to pick a people.]
- Q6. At the end of its age: the unit becomes the next age's base unit (proposed, D11), or keeps
  its edge as a veteran unit for the rest of the game?
- Q7. Ages: Modern has 10 units, bronze to gunpowder 32 to 38 each. Keep as is? [Yes, per the
  2026-10-06 answer; a modern-peak people simply waits.]
- Q8. AI: use it as any unit (D3), or favour it a little (`SIG_DOCTRINE_BONUS`)? [As any unit
  first; the knob only if the balance-sim shows under-use.]

## 11. Definition of done

- All 150 entries have a kit of exactly 10 points, a title, and pass the data tests.
- Every unit creation path stamps correctly; old saves and the legacy world are unchanged
  (hashes); `stateAudit` holds over the balance-sim runs.
- Every one of the 150 is inside the parity guardrail and the edge band (5.3), Auto agreeing on
  the edge; the result file is in `plans/signature-units/`.
- balance-sim gates of section 6 pass; battle-bench and msPerTurn within the limits of section 8.
- The player sees the unit in the recruit list, the unit card (abilities with reasons), the
  battle, W17 and W01, on a 844x390 phone screen.
- Lint zero warnings, the full vitest suite passes; master plan and ART-MODELS 4.6 updated with
  the result.

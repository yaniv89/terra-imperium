# Terra Imperium's real-time battle rules today (code inventory, 2026-10-22)

Read-only inventory of branch `claude/integration` at commit 15e06f83. Every source below is a file
in the repository (paths relative to the repo root, `file:line` where it matters). Numbers are quoted
from the code. Units: 1 battle tile = `Q` = 256 fixed-point units; the sim runs at `TICK_HZ` = 20
ticks a second ([src/battle/sim/constants.js:5-6](src/battle/sim/constants.js)). "Strength" is the
campaign's regiment strength; 1 strength = 10 men (`MEN_PER_STRENGTH = 10`,
[src/engine/aftermath.js:31](src/engine/aftermath.js)).

## Battle setup: how a battle is built from campaign armies

### Takeaway
A battle is a pure function of (setup, order log): campaign units become squads one-for-one (a squad's
HP is the regiment's strength), the field is generated from the fought-over hex and its six
neighbours, and every campaign land battle except raids/sacks/naval runs a full AoE-style base economy
(workers, four resources, 12 buildable types, training, housing cap 300 a side).

### Cited Findings
**Squads, not individual soldiers**
- One campaign unit = one squad; squad HP is its strategic `strength` so casualties map back 1:1; per-class stats only decide movement and swing rate, hit strength comes from the shared multiplier — [src/battle/data/battleStats.js:1-5](src/battle/data/battleStats.js)
- Drawn soldiers are cosmetic: `soldiers` per class (infantry 12, cavalry 8, ranged 10, siege 3, air 3, support 4, worker 1), drawn count = `ceil(soldiers * strength / maxStrength)` — [src/battle/data/battleStats.js:12-25, 99-101](src/battle/data/battleStats.js)
- Squad collision radius `SQUAD_RADIUS = 154` (~0.6 tile) — [src/battle/sim/constants.js:22](src/battle/sim/constants.js)
- No reserve (user ruling U10/Q2): every regiment starts on the field; `MAX_START_SQUADS = POP_LIMIT` (300) is only a guard, weakest regiments past it stay out untouched — [src/battle/sim/world.js:26-30](src/battle/sim/world.js)
- Allied reinforcements march in from their own edge after `REINFORCEMENT_ARRIVAL_TICKS` = 25 s (sooner if the defender's Barracks stands) — [src/battle/sim/world.js:31-34](src/battle/sim/world.js)
- Deployment: lines 3 tiles apart (`LINE_SPACING = 3`), extra ranks 2 tiles behind (`RANK_DEPTH = 2`); melee in front, shooters behind; defender zone up to 16 tiles in front of the keep (`DEFENDER_ZONE_DEPTH = 16`); per-type templates (field, river, ambush in column, assault close to walls, sally, landing on sand, naval) — [src/battle/sim/world.js:35-38, 125-146](src/battle/sim/world.js)
- Each general rides on the field as a guard squad of `GENERAL_GUARD = 120` strength (cavalry; infantry in Stone) behind its line — [src/battle/sim/world.js:238-287](src/battle/sim/world.js)

**Battlefield size and terrain**
- Map size from combat width: `w = 64 + combatWidth * 8`, `h = 48 + combatWidth * 4` tiles — [src/battle/setup/mapgen.js:66](src/battle/setup/mapgen.js)
- Combat width by terrain: plains 6, mixed 5, desert 5, urban/forest/island/hills 4, mountains/arctic 3, sea 5, default 4 (so plains = 112 x 72 tiles, mountains = 88 x 60) — [src/data/combatWidth.js:8-23](src/data/combatWidth.js)
- Tile kinds OPEN, FOREST, WATER, ROCK, ROAD, SAND, FORD, BUILDING, RUBBLE, GATE with path costs `[8, 11, 0, 0, 6, 10, 13, 0, 13, 0]` (0 = impassable) — [src/battle/setup/mapgen.js:12-15](src/battle/setup/mapgen.js)
- Terrain from the campaign hex: the tile and its six neighbours each fill the edge sector facing them; rivers (size 1 stream / 2 river / 3 great, with fords and bridges), coast, walls; the attacker always comes from the west — [src/battle/setup/tileContext.js:1-13](src/battle/setup/tileContext.js)
- Roads: none on Stone-age ground; else 1 + (infrastructure >= 5) + (>= 8) + tile roads — [src/battle/setup/buildBattleSetup.js:197-199](src/battle/setup/buildBattleSetup.js)
- Terrain combat modifier on the attacker: hills 0.9, forest 0.9, mountains 0.75 (attrition 1.1), desert attrition 1.2, arctic 1.25, others 1 — [src/data/terrain.js:73-84](src/data/terrain.js)
- Attrition inside defender territory (radius `TERRITORY_RADIUS = 14 * Q`): `0.006 * terrain attritionMult * (1 + 0.1 * fortLevel)` per minute; Support wagons or a general within 6 tiles cancel it — [src/battle/setup/buildBattleSetup.js:80, 249](src/battle/setup/buildBattleSetup.js); [src/battle/sim/support.js:1-17](src/battle/sim/support.js)

**Battle types and their objectives** — [src/battle/setup/battleType.js:5-72](src/battle/setup/battleType.js)
- field: rout the enemy or destroy `LOSS_DECISIVE = 0.6` of its squads; defender also wins holding the clock
- river: attacker must hold the far bank with `RIVER_HOLD_SHARE = 0.4` of its strength at the clock
- ambush (forest/jungle/hills, no road, not a city): attacker loses if down `AMBUSH_LOSS = 0.3` within `AMBUSH_SECONDS = 120`
- assault: breach the keep and hold it 30 s (`ASSIMILATION_TICKS`, radius 6 tiles, infantry/cavalry only) — [src/battle/sim/objectives.js:1-22](src/battle/sim/objectives.js)
- sally: burn `SALLY_ENGINES = 2` of 3 siege engines or the camp
- landing: hold the beachhead `LANDING_HOLD_SECONDS = 60`
- raid / sack: burn 2 of 3 loot targets (or 2 town buildings) and escape by own edge; the one "light" battle with no base-building
- naval: sink or scatter (quick battle only today)

**City battles**
- Keep HP `(1500 + 750 * fortLevel) * (1.5 if capital)`, walls if fortLevel >= 2, range 8 tiles, 1.5 s per shot, damage `8 + 6 * fortLevel` (0 if unfortified); towers `min(6, floor(fortLevel/2) + capital bonus)`, HP `800 + 200 * fortLevel`, damage `8 + 4 * fortLevel`, range 7 tiles — [src/battle/setup/buildBattleSetup.js:84-104](src/battle/setup/buildBattleSetup.js)
- A real city loads its manifest: every house, landmark, palace, wall segment, gate, tower placed with manifest id and HP and its damage from earlier battles; gate open to defender, battered by attacker; material by age (mud brick 1, masonry 1.4, concrete 2); base HP small dwelling 800 ... palace/wonder 5,000 — [src/battle/setup/cityBattle.js:1-40](src/battle/setup/cityBattle.js)
- A campaign siege's damage carries in: keep/towers start at `hpRatio` of max HP — [src/battle/setup/buildBattleSetup.js:212](src/battle/setup/buildBattleSetup.js)
- Garrisons: defender infantry/ranged can man the keep (3 squads) or a tower (1); inside they cannot be hurt and add their firepower x0.8; thrown out below 25% HP with -20 morale — [src/battle/sim/objectives.js:26-34](src/battle/sim/objectives.js)
- City militia added to defenders: 2 strength per housing point, max 600, in units of 250, morale 70 — [src/engine/battleInputs.js:46-49](src/engine/battleInputs.js)

**The battle economy (phase R1)** — catalog [src/battle/data/economy.js](src/battle/data/economy.js), sim [src/battle/sim/economy.js](src/battle/sim/economy.js)
- On for every campaign land battle except raid, sack and naval ("every assault is a full RTS battle", decision 23; field battles too, decision 36) — [src/battle/setup/buildBattleSetup.js:207-211, 337, 441](src/battle/setup/buildBattleSetup.js)
- Four resources: food, wood, stone, gold (milli-units internally) — [economy.js:32-36](src/battle/data/economy.js)
- `POP_LIMIT = 300` a side; housing: attacker camp 20 + 10 per regiment brought, defender town hall 20 + the real city's houses, village house +10; one pop per squad, the brought army included; housing only blocks training — [economy.js:38-49](src/battle/data/economy.js); [sim/economy.js:13-20, 114-128](src/battle/sim/economy.js)
- `START_WORKERS = 5` per side; `MAX_ECO_BUILDINGS = 80` — [sim/economy.js:39-40](src/battle/sim/economy.js)
- Gather per worker-second: food 0.65, wood 0.6, stone 0.5, gold 0.4; carry 10; farm x0.7 (renewable), mine x1.25 (no walk); default worker mix food 40 / wood 30 / stone 15 / gold 15 with one-tap presets — [economy.js:51-66](src/battle/data/economy.js)
- Build speed with n builders: `1 + 0.5 * min(n - 1, 4)` (max 5 useful); cancel refund 75%; repair 12 HP/s, quarter speed if hit within 5 s, city works cost 0.1 stone per HP; under attack at most 6 HP/s from all repairers — [economy.js:68-78](src/battle/data/economy.js); [src/battle/sim/siegeRules.js:31-35](src/battle/sim/siegeRules.js)
- Build radius 20 tiles from HQ, 10 from own buildings; queue max 20 — [economy.js:80-83](src/battle/data/economy.js)
- Loot 25% of a destroyed building's price as gold; city building 60 gold; trade post 0.5 gold/s up to 300 — [economy.js:85-91](src/battle/data/economy.js)
- Start stock attacker food 250 / wood 250 / stone 100 / gold 150; defender 300/300/150/200; scaled by `stockMult = clamp(0.75 + 0.5*supply + 0.25*development, 0.75, 1.5)` — [economy.js:99-104](src/battle/data/economy.js)
- Nodes: tree 80 wood each (every forest tile, 5-tile cells, 2-6 slots), berries 200, stone 500, gold 400, herd 300, cattle 450, fish 350 — [economy.js:114-126](src/battle/data/economy.js)
- Buildings (size, HP, cost, seconds): camp 4/2500 HQ; hall (= keep); house 2/400/30 wood/15; food depot and wood-stone yard 2/600/60 wood/20; trade post 3/700/60w+20s+20g/30; farm 3/300/50w/15; mine 2/700/80w/25; barracks 3/1200/150w/40; range 3/1100/150w+30g/40; stable 4/1300/200w+60g/50; siege workshop 4/1300/180w+40s+100g/60; aid post 3/900/120w+40g/35; tower 2/1000/30w+90s+20g/45 (range 7, damage 14, 1.5 s) — [economy.js:133-148](src/battle/data/economy.js)
- Training: worker 50 food, 12 s, strength 25; infantry 60f+30w 20 s; ranged 50f+40w+10g 22 s; cavalry 80f+40w+40g 28 s; siege 120w+60g 40 s; support 60f+60w 25 s; each trained squad is a company of `TRAIN_STRENGTH = 200` (a fifth of a regiment), an "auxiliary" that demobilises after the battle — [economy.js:161-174](src/battle/data/economy.js)
- No in-battle tech tree or age-up: trainable roles = the side's campaign age's classes — [economy.js:201-210](src/battle/data/economy.js)
- Auxiliary frontage: a bigger squad strikes a 200-man company as at most 2.5x its start strength; tower shots capped at 15% of its start strength — [src/battle/sim/siegeRules.js:6-18](src/battle/sim/siegeRules.js)
- Base rule: in an economy battle a side loses only when all its base buildings (camp/keep and finished economy/military buildings, not houses or wall works) are gone, or it retreats; at the clock the defender holds — [src/battle/sim/base.js:1-56](src/battle/sim/base.js); [src/battle/sim/step.js:37-48](src/battle/sim/step.js)

### Inferences
- Compared with AoE: squads (regiments) rather than individual units, no individual unit HP or armour, no in-battle ageing or technologies; the economy is AoE-shaped (villagers, drop-sites, farms, houses, 4 resources, pop cap) but sits on top of a pre-built army brought from the campaign.
- Trained units are local auxiliaries only, so the economy changes the battle but not the campaign's army.

### Gaps
- `src/battle/sim/economy.js` header still says "three resources" while the catalog has four (stale comment, [sim/economy.js:2](src/battle/sim/economy.js)).
- I did not read economy.js gather/walk internals line by line (drop-off pathing, farm reseeding).

## Combat math

### Takeaway
Damage per hit = attacker's current strength x a per-hit fraction x a stack of multipliers (class
counters 1.75/0.6, age roster ratio, terrain, promotions, generals, flank 1.3 / rear 1.5, charge 1.25,
elevation +/-10%, shaken) x +/-10% seeded variance; there is no armour stat or HP-per-soldier, and
the same multiplier function drives auto-resolve.

### Cited Findings
- Hit formula: `damage = round(strikingStrength(a,t) * perHitFraction(a.stats) * mult * variance)` where `perHitFraction = BASE_DAMAGE_RATE * (attackTicks / 20) / EXCHANGE_SECONDS`, `BASE_DAMAGE_RATE = 0.1`, `EXCHANGE_SECONDS = 6`, variance `1 +/- 0.1` — [src/battle/sim/combat.js:31, 41, 136-158](src/battle/sim/combat.js); [src/engine/battle.js:48-51](src/engine/battle.js)
- So per second of contact a squad deals about `strength * 0.1 / 6` (1.67% of its own strength) before multipliers, regardless of class attack speed (faster swings = smaller hits).
- `computeHitMultiplier` (shared with auto-resolve): counter multiplier x side base multiplier x naval line mult x siege fortification mult x promotion damage x general damage x target's promotion defence x target's general defence — [src/engine/battle.js:78-89](src/engine/battle.js)
- Counters: `COUNTER_BONUS_MULT = 1.75`, `COUNTER_PENALTY_MULT = 0.6`. Infantry beats cavalry; cavalry beats ranged and siege; ranged beats infantry; air beats infantry/cavalry/ranged/siege; support (anti-air) beats air — [src/data/unitClasses.js:20-97](src/data/unitClasses.js)
- Siege: x3.0 vs fortification, x0.5 in the open field — [src/data/unitClasses.js:99-106](src/data/unitClasses.js)
- Age gap: side multiplier = attacker age's infantry `baseAttack` / defender age's (Stone 7, Bronze 10, Classical 18, Kingdoms 26, Gunpowder 34, Modern 42); exactly 1.0 at equal ages — [src/data/unitClasses.js:200-205](src/data/unitClasses.js); [src/data/ages.js:26-75](src/data/ages.js)
- Walls reduction applies only to defenders standing inside defender territory — [src/battle/sim/combat.js:75-83](src/battle/sim/combat.js)
- Hit arcs: front +/-60 deg (120 deg arc), flank 60-120 deg, rear 120 deg; flank x1.3 (`FLANK_BONUS_MULT`), rear x1.5 (`REAR_BONUS_MULT`); Stone units (`noFormation`) get no flank/rear bonus — [src/battle/sim/combat.js:50-56, 139-141](src/battle/sim/combat.js); [src/battle/data/battleStats.js:30-38](src/battle/data/battleStats.js)
- Arc also multiplies morale loss: `ARC_MORALE_MULT = [1, 1.15, 1.3]` — [src/battle/sim/combat.js:87](src/battle/sim/combat.js)
- Charge: units with `charge` (cavalry, Bronze/Classical warships) that moved >= 4 tiles since their last strike get x1.25 — [src/battle/sim/combat.js:33-34, 142](src/battle/sim/combat.js)
- Pursuit: hits on a routed squad x1.5 (`1 + PURSUIT_EXTRA_LOSS_MULT`) — [src/battle/sim/combat.js:143](src/battle/sim/combat.js)
- Elevation: `1 + clamp((h_attacker - h_target)/256 * 0.3, -0.1, +0.1)`; not for flying — [src/battle/sim/combat.js:89-99, 148](src/battle/sim/combat.js)
- Splash: siege `splash = 1.2 tiles`, half damage to every other enemy squad in radius — [src/battle/sim/combat.js:159-167](src/battle/data/battleStats.js)
- Per-class stats (speed tiles/s, range, sight tiles, seconds per attack): infantry 1.6 / 0.9 melee / 7 / 1.0; cavalry 3.2 / melee / 10 / 1.0 (charge); ranged 1.5 / 7 tiles / 9 / 1.4; siege 0.9 / 11 tiles (min 3) / 8 / 3.0 (splash, structureBonus); air 5.0 / 4 / 12 / 1.2 (flying); support 1.4 / no attack (supply aura 6 tiles); worker 1.7 / no attack — [src/battle/data/battleStats.js:12-25](src/battle/data/battleStats.js)
- Age overrides: Stone infantry morale loss x1.25, Stone ranged range 5 and 1.0 s; Gunpowder infantry become shooters (range 4, 1.6 s), cavalry 3.0; Modern infantry range 5 speed 1.9, cavalry = tanks (range 6, 1.8 s, no charge), ranged range 9 / 2.0 s, support = anti-air only (range 8) — [src/battle/data/battleStats.js:29-49](src/battle/data/battleStats.js)
- Melee reach is touching (`range + 2 * SQUAD_RADIUS`); shooters measure to the target's edge — [src/battle/sim/combat.js:58-66](src/battle/sim/combat.js)
- Structures: non-siege blows x0.15 (`NON_SIEGE_STRUCTURE_MULT`); siege uses the x3 fort multiplier; walled keep x0.6 while ring whole and HP > 50%; once a wall/gate is down, non-siege blows on the keep x2.5 (`KEEP_STORM_MULT`); raiders burning loot x4; structure damage x3 scale — [src/battle/sim/combat.js:35-39, 170-196](src/battle/sim/combat.js); [src/battle/sim/siegeRules.js:25-29](src/battle/sim/siegeRules.js)
- Towers/keep fire in proportion to HP left (floor 40%) and to crew: `min(1, side fighting strength / 1000)` (`CREW_FULL`) — [src/battle/sim/siegeRules.js:20-52](src/battle/sim/siegeRules.js)
- Shooting reveals the shooter for 3 s and breaks ambush — [src/battle/sim/combat.js:28, 149-151](src/battle/sim/combat.js)
- Abilities: Forced March x1.5 speed 15 s / 60 s cd; Entrench frontal armour 0.7 20 s / 90 s; Ambush hide 60 s, first strike x1.5; Charge x1.25 10 s; Bombard siege rate x1.5; Field Hospital; Shield Wall frontal 0.6; Volley x2 rate 6 s / 40 s — [src/battle/sim/effects.js:20-32](src/battle/sim/effects.js)
- Commander powers (paid in Battle Supply): Rally Cry 120 (+30 morale, 8 s rout immunity, un-routs), Ambush 100, Arrow Storm 150 (6 impacts x 45), Artillery Barrage 250 (8 x 90, structures x3), Air Strike 300 (8 x 120), Naval Bombardment free (6 x 100, shore half) — [src/battle/sim/effects.js:124-131, 145-170](src/battle/sim/effects.js)
- Battle Supply: start [100, 100 (+50 with capture points)], cap `200 + 30 * infrastructure`, +1/s base, +2/s per held point (8 s to capture, radius 1.5 tiles) — [src/battle/setup/buildBattleSetup.js:243-245](src/battle/setup/buildBattleSetup.js); [src/battle/sim/objectives.js:19-24](src/battle/sim/objectives.js)

### Inferences
- Damage scales with the attacker's remaining strength (a Lanchester-square-like dynamic), unlike AoE where each unit does fixed damage minus armour.
- No pierce/melee armour split, no bonus-damage tables beyond the 3x3 counter triangle and the siege/fort context.

### Gaps
- Promotion and general multipliers were not enumerated (src/data/promotions.js, src/data/generals.js not read).
- `damageTakenMult`/`damageDealtMult`/`attackRateMult` details in effects.js only skimmed.

## Morale, routing, rally, shaken

### Takeaway
Morale (0-100) falls 1.2 points per 1% of a squad's own starting strength lost; at 20 the AI's squads
rout, but the player's side in a commanded battle never routs (user rule): it becomes Shaken (deals
x0.6, takes x1.3) and stays fully controllable.

### Cited Findings
- `moraleFromLosses = round(100 * damage / startStrength * 1.2)` (`RTS_MORALE_PER_PERCENT = 1.2`): a fresh squad breaks at about 67% losses — [src/battle/sim/moraleMath.js](src/battle/sim/moraleMath.js)
- Auto-resolve uses `MORALE_LOSS_PER_PERCENT = 3` (~27% casualties breaks a fresh unit) — [src/engine/battle.js:56-57](src/engine/battle.js)
- Rout threshold `MORALE_ROUT_THRESHOLD = 20` — [src/engine/battle.js:47](src/engine/battle.js)
- Shock: a neighbour destroyed or routed within 5 tiles costs 5 morale, capped 10 per tick — [src/battle/sim/morale.js:16-22](src/battle/sim/morale.js)
- `canRout(w, side)` false for the player's side in a commanded battle (`commandedSetup` sets `canRout: controllers[i] !== 'player'`); Shaken at morale <= 20: `SHAKEN_DAMAGE_DEALT = 0.6`, `SHAKEN_DAMAGE_TAKEN = 1.3` — [src/battle/sim/morale.js:29-40](src/battle/sim/morale.js); [src/battle/setup/buildBattleSetup.js:621-624](src/battle/setup/buildBattleSetup.js)
- Regen: +1/s after 3 s without being hit (+3/s if routed); a routed squad rallies after 6 s quiet at morale >= 35 unless its side is being pursued; Unbreakable perk ignores the first rout — [src/battle/sim/morale.js:14-27, 73-91](src/battle/sim/morale.js)
- Routed or retreating squads that reach their own edge leave the field and survive in the campaign ("routed is not dead") — [src/battle/sim/morale.js:1-6, 92-95](src/battle/sim/morale.js)
- Field-type battles: a side with 60% of its squads dead or fled is "spent"; a routable side then routs entirely, the player's side fights on — [src/battle/sim/step.js:81-94](src/battle/sim/step.js)
- Movement stance contract: "Nobody leaves the player's control on their own" — [src/battle/sim/movement.js:18-19](src/battle/sim/movement.js)
- Pursuit after a decided field battle: the loser is turned to retreat; battle ends when the last loser leaves or after `PURSUIT_SECONDS = 90`; no pursuit in base battles — [src/battle/sim/step.js:24-27, 121-137](src/battle/sim/step.js)
- Pre-battle morale inputs: low supply up to -20, starved -15, plague -10, floor 25 — [src/engine/battleInputs.js:40-45](src/engine/battleInputs.js)

### Inferences
- AoE has no morale; ours is a Total War / Rise of Nations hybrid but asymmetric (AI routs, player gets a soft penalty).

### Gaps
- None material.

## Unit control: orders, formations, stances, pathing, fog, touch

### Takeaway
All input is a validated order (21 types incl. economy orders) applied on tick boundaries; stances are
idle (leashed auto-fight), attack-move, attack, hold, move/retreat (no fighting); formations are
line/column/drag-a-line; paths are integer Dijkstra flow fields per goal tile with a push-apart
separation pass; per-side fog grid; touch has tap, drag-pan, drag-formation, lasso, long-press, and a
Path mode (up to 12 waypoints).

### Cited Findings
- Order schema: move, attackMove, movePath (max 12 points), deploy (pre-battle), formationLine, attack (squad/structure/eco), stop, hold, retreat, retreatAll, callReserve (no-op), ability, power, garrison, gather, build, assist, repair, train (count 1-5), cancelTrain, rally, cancelBuild, workerPreset, autoRebuild; max 1024 squads per order; the live loop and the replay admit through the same `admitOrder` — [src/battle/sim/orderSchema.js:22-117](src/battle/sim/orderSchema.js)
- Stances: idle fights anything in sight and retaliates, leash 6 tiles (`IDLE_LEASH`); attackMove the same without the leash; attack keeps its target then turns idle; hold never steps out; move/retreat obey and never stop to fight — [src/battle/sim/movement.js:6-17, 32-35](src/battle/sim/movement.js)
- Retaliation: a free squad hit by an enemy turns on it even beyond sight; idle/attack-moving squads shot by a tower turn on it — [src/battle/sim/combat.js:108-119](src/battle/sim/combat.js); [src/battle/sim/siegeRules.js:54-61](src/battle/sim/siegeRules.js)
- Auto-continue: in base battles a squad whose building fell goes to the next tower or base building within 18 tiles (`CONTINUE_NEAR`) — [src/battle/sim/movement.js:126-137](src/battle/sim/movement.js)
- Target choice: `score = counter * (2 - strength/max) * (1.3 if siege/support) * (0.8 if routed) / (distance + 1)`, re-picked every 10 ticks (`RETARGET_EVERY`); siege prefers structures; attackers fall back to structures then enemy economy buildings; cannot target what fog hides — [src/battle/sim/combat.js:198-252](src/battle/sim/combat.js); [src/battle/sim/movement.js:118](src/battle/sim/movement.js)
- Formations: slots 2.5 tiles apart (`SLOT_SPACING`), front row melee/air, shooters behind, perpendicular to travel or along it for 'column'; drag a line spreads squads on it — [src/battle/sim/orders.js:25, 48-60](src/battle/sim/orders.js)
- Every squad walks at its own pace even in a mixed group (user ruling Q6) — [src/battle/sim/movement.js:1-4](src/battle/sim/movement.js)
- Pathing: one integer Dijkstra flow field per destination tile, shared and cached (24 fields), 8-neighbour steps 10/14, straight-line test skips the field over open ground; gate priced per side — [src/battle/sim/pathing.js:1-30](src/battle/sim/pathing.js)
- Collision: separation pass pushes squads to 2 x radius apart with a 45-degree sidestep — [src/battle/sim/movement.js:255-275](src/battle/sim/movement.js)
- Fog: per-side grid (0 unseen, 1 explored, 2 visible), updated every 5 ticks; defender sees its own territory; structures always known; espionage intel reveals defenders for 200 ticks (10 s); ambushers stay hidden until they attack or enemy cavalry comes within 3 tiles — [src/battle/sim/fog.js:1-30](src/battle/sim/fog.js)
- Touch gestures: tap / one-finger drag pan / drag from a selected squad = formation line / double-tap+drag lasso / long-press context (ground: attack-move) / pinch-zoom; Select mode and Path mode buttons; gesture decided in first 10 px / 350 ms (`TAP_MS 260`, `LONG_MS 380`, `MOVE_PX 10`) — [src/battle/input/gestures.js:1-25](src/battle/input/gestures.js)
- Mouse: left select, box select, right-click order, right-drag formation line, wheel zoom — [src/battle/input/gestures.js:16-20](src/battle/input/gestures.js); [src/battle/input/selection.js:1-25](src/battle/input/selection.js)
- Phone tap targets: squad pick circle >= 22 px (`SQUAD_PICK_PX`), enemies x1.45 reach; buildings +0.7 tiles / 18 px — [src/battle/input/squadPick.js](src/battle/input/squadPick.js); [src/battle/input/selection.js](src/battle/input/selection.js)
- Path mode sends `movePath` with the drawn route — [src/components/battle/TacticalBattleScreen.jsx:168-172, 784-793](src/components/battle/TacticalBattleScreen.jsx)

### Inferences
- No control groups / hotkeys or queued (shift) orders were seen in the order schema; movePath is the only multi-waypoint order.

### Gaps
- Did not check whether keyboard hotkeys or control groups exist in TacticalBattleScreen.jsx.

## AI: tactical, economy, difficulty

### Takeaway
Five difficulty levels change think rate, retreat threshold, use of powers/abilities, flanking and
kiting (Emperor only), and the economy AI's worker count, production buildings and towers; logic is
rule chains, not search.

### Cited Findings
- `AI_DIFFICULTY`: settler think every 24 ticks, retreat at 0.15, no powers/abilities/flank; chieftain 20 / 0.2; prince 10 / 0.25 powers+abilities; king 6 / 0.3 + flank; emperor 4 / 0.3 + flank + kite — [src/battle/sim/tacticalAI.js:21-27](src/battle/sim/tacticalAI.js)
- `AI_ECONOMY`: settler every 60 ticks, 6 workers, 1 production building, 0 towers, queue 1; chieftain 50/8/1/0/1; prince 40/14/2/0/2; king 30/20/3/1/2; emperor 24/26/4/2/3; drop-off raised when loads walk > 12 tiles, max 3 — [src/battle/sim/economyAI.js:19-31](src/battle/sim/economyAI.js)
- Powers: Rally Cry when 3+ squads under 40 morale; Ambush before contact; strikes on the densest enemy cluster (8x8 cells) of >= 1200 strength with no friendly near — [src/battle/sim/tacticalAI.js:95-109](src/battle/sim/tacticalAI.js)
- Abilities by distance (volley in range, charge < 4 tiles, entrench/shield wall when defending < 8 tiles, etc.) — [src/battle/sim/tacticalAI.js:111-125](src/battle/sim/tacticalAI.js)
- Army cohesion: squads more than 6 tiles ahead of the hindmost wait; stragglers > 16 tiles behind are not waited for — [src/battle/sim/tacticalAI.js:127-140](src/battle/sim/tacticalAI.js)
- Defender sallies at 1.5x visible enemy strength (`SALLY_ODDS`); defense radius 24 tiles; generals kept 3 tiles behind army centre — [src/battle/sim/tacticalAI.js:28-37, 225-228](src/battle/sim/tacticalAI.js)
- The plan's own gap list for the battle AI: overkill-aware DPS targeting, per-engagement Lanchester withdraw, influence maps, threat-aware paths, kiting for all difficulties, separation steering — [plans/research-ai-math.md:26-61](plans/research-ai-math.md)

### Inferences
- The AI's economy is "fixed targets per difficulty" rather than adaptive build orders.

### Gaps
- Did not read the full attack/defend decision tree in tacticalAI.js lines 140-340.

## How a battle ends and maps back to the campaign; auto-resolve; prediction

### Takeaway
Command and Auto share one input builder (battleInputs.js), one hit multiplier, one result shape and
one idempotent outcome service (`applyBattleOutcome`); auto-resolve is a round-based exchange
(max 8 rounds) with modelled auxiliaries and walls, calibrated against the real-time sim by a parity
harness; the pre-battle odds are 200 auto-resolve samples.

### Cited Findings
- Clocks: no-economy field 5:00, siege 7:30; economy field 15:00, city assault/landing/real town 30:00; raid 10:00, sack 12:00 — [src/battle/sim/constants.js:7-20](src/battle/sim/constants.js); [src/battle/setup/buildBattleSetup.js:228](src/battle/setup/buildBattleSetup.js)
- End checks per tick: base gone, retreat, keep held 30 s, sally camp burned, beachhead 60 s, ambush loss, sides broken/spent; at the clock river far bank, field attacker wins only with > 1.5x the defender's remaining strength, else the defender holds — [src/battle/sim/step.js:97-147](src/battle/sim/step.js)
- Tick order: fog, AI, orders, effects, impacts, supply, reserves, rebuild, economy, targets, movement, spatial hash, separation, attacks, structure fire, eco towers, garrisons, attrition, buildings, morale, capture points, assimilation, losses, end check, hash chain — [src/battle/sim/step.js:149-179](src/battle/sim/step.js)
- Result: the finished world becomes exactly resolveBattle's result shape; command XP bonus capped at 20 (`COMMAND_XP_BONUS_CAP`) — [src/battle/sim/result.js:1-19](src/battle/sim/result.js)
- `applyBattleOutcome`: idempotent by operation id (last 64), XP win 30 / lose 15, kind adapter (capture, decisive field: loser's units still on field destroyed), war score, aftermath, city damage under the 50% rule, plague contact, records, report from the participant ledger — [src/engine/battleOutcome.js:1-76](src/engine/battleOutcome.js)
- Ledger: per side `before = after + fallen + fled`, checked against the committed map — [src/engine/battleLedger.js:1-28](src/engine/battleLedger.js)
- Auto-resolve: `MAX_BATTLE_ROUNDS = 8`, `BATTLE_FORTUNE = 0.3` per side per battle — [src/engine/battle.js:54-55](src/engine/battle.js)
- Auto models auxiliaries as `AUX_TRAINED[kind] x 200 x AUX_EFFECT (1.6)` in units of 1000 (field [8, 8], assault [12, 8], town [2, 2]); walls without siege; raids x0.4; routed units escape 50% (30% if winner has cavalry) — [src/engine/autoBattle.js:1-151](src/engine/autoBattle.js)
- Auto attacker multipliers by type: river 0.85 (by river size [1, 1.12, 1, 0.94]), ambush 0.8, landing 1, sally 1.1 — [src/battle/setup/battleType.js:34-46](src/battle/setup/battleType.js)
- Pre-battle odds: real auto-resolve over 200 seeds, with reasons — [src/engine/battleOdds.js:1-6, 129-160](src/engine/battleOdds.js); battle card shows ground, walls HP, supply, starvation, plague, militia, reinforcements — [src/components/battle/battleCardModel.js:1-6](src/components/battle/battleCardModel.js)
- Commanded battles are verified by replay of the order log — CLAUDE.md; [src/battle/sim/orderSchema.js:1-20](src/battle/sim/orderSchema.js)

### Inferences
- AoE has no campaign carry-over; here every strength point lost is a campaign loss, and units that escape survive.

### Gaps
- Exact parity tolerance lives in .claude/skills/battle-lab/SKILL.md (not read).

## Ages in battle: rosters, classes, signature units

### Takeaway
The code has six ages today (Stone, Bronze, Classical, Kingdoms, Gunpowder, Modern); the eight-age plan
(adding Information and Future, Modern narrowed) is planned, with Stone battle work (U37-U40) done.
One roster entry per class per age; signature units (one per people) are art only and fight with the
base unit's rules.

### Cited Findings
- `AGE_ORDER = ['stone', 'bronze', 'classical', 'kingdoms', 'gunpowder', 'modern']`; age power attack/defense Stone 7/6, Bronze 10/8, Classical 18/14, Kingdoms 26/20, Gunpowder 34/26, Modern 42/32 — [src/data/ages.js:13-75](src/data/ages.js)
- Rosters: Stone Warband, Hunters, Ladder Crews, Dugout Canoes, Shaman (no cavalry); Bronze Spearmen, Chariots, Archers, Battering Ram, War Galley, Baggage Train; Classical Swordsmen, Heavy Cavalry, Composite Archers, Ballista, Trireme, Engineers; Kingdoms Pikemen, Knights, Longbowmen, Trebuchet, Longship, Pioneers; Gunpowder Musketeers, Dragoons, Riflemen, Field Cannon, Frigate, Sappers; Modern Mechanized Infantry, Tanks, ATGM Teams, Artillery, Destroyer, Fighter Jet, Anti-Air Battery — [src/data/unitClasses.js:121-175](src/data/unitClasses.js)
- Seven classes: infantry, cavalry, ranged, siege, naval, air (Modern only), support — [src/data/unitClasses.js:20-75](src/data/unitClasses.js)
- Signature units: 150 entries, one per people in one age, model only: "until then it fights with the base unit's rules" — [src/data/signatureUnits.js:1-16](src/data/signatureUnits.js)
- Eight-ages plan: R19 every age gets per-age stats, powers, economy names, art; parity on 32 seeds; owners Stone U38, Information U58, Future U66/U72; ~40 new signature units for Information/Future; nuclear/missile powers removed — [plans/2026-10-20-001-feat-eight-ages-plan.md:27, 40, 72-73, 265-286](plans/2026-10-20-001-feat-eight-ages-plan.md)
- Economy building names change by age (Stone: Fire Circle, Longhouse, Hut ... ; Modern: Command camp, Field hospital), same functions — [src/battle/data/economy.js:176-193](src/battle/data/economy.js)
- `SETUP_VERSION = 18` (v18: Stone battles) — [src/battle/setup/buildBattleSetup.js:78](src/battle/setup/buildBattleSetup.js)

### Inferences
- Unlike AoE civ bonuses and unique units, peoples do not differ in battle rules today.

### Gaps
- Whether the eight-ages phase A has started merging beyond Stone was not checked.

## Battle length, phone limits, performance

### Takeaway
Campaign battles with an economy run up to 15 or 30 minutes; the phone target is 844x390 landscape
with 44 px-class tap targets; the sim kernel budget is p95 <= 10 ms and p99 <= 20 ms per tick on a
phone (a 4x slower CPU stand-in).

### Cited Findings
- Clocks as above — [src/battle/sim/constants.js:7-20](src/battle/sim/constants.js)
- Kernel budget `PHONE_P95_BUDGET = 10`, `PHONE_P99_BUDGET = 20` ms per tick — [scripts/battle-bench.mjs:13-27](scripts/battle-bench.mjs)
- Render LOD: three tiers, switch at 44 / 18 px soldier height, 550 and 220 triangles for mid/far — [src/battle/render/soldierLod.js:1-25](src/battle/render/soldierLod.js)
- Largest preset 1,000 squads a side (max per order 1024) — [src/battle/sim/orderSchema.js:24-26](src/battle/sim/orderSchema.js)
- Phones play landscape, 844x390 reference — CLAUDE.md working rules

### Gaps
- No measured average real battle length found; playtest notes a "30-minute assault" — [plans/playtest-4-audit.md:273](plans/playtest-4-audit.md)

## Known gaps and open issues

### Takeaway
Playtest 4 (phone, 300 turns) scored Combat (RTS) 6/10 and battle AI 5/10; idle squads and sticky
building orders (P4-H4) have a fix commit since; result trust after reload (P4-C2, P4-H2), repeated
Auto sieges (P4-M2) and placement friction (P4-M7) were the other battle items.

### Cited Findings
- Scorecard: AI (battle) 5, Combat (RTS) 6 "squads still go idle after a target and orders on buildings do not stick"; Stability 4 — [plans/playtest-4-audit.md:84-98](plans/playtest-4-audit.md)
- P4-C2 "The battle you watch is not the battle that counts" (reload mid-battle) — [plans/playtest-4-audit.md:119-125](plans/playtest-4-audit.md)
- P4-H2 commanded battle restarts from zero after a reload — [plans/playtest-4-audit.md:136-137](plans/playtest-4-audit.md)
- P4-H4 idle squads under towers; fix commit 13133406 "P4-H4: squads keep fighting after a target in commanded assaults" — [plans/playtest-4-audit.md:147-151](plans/playtest-4-audit.md); git log
- P4-M2 identical Auto battles repeat for 8 turns; P4-M7 building placement takes tries; L8 enemy camera opens on black fog — [plans/playtest-4-audit.md:176-212](plans/playtest-4-audit.md)
- "Least fun: a 30-minute assault that bled out under towers because squads stood idle" — [plans/playtest-4-audit.md:273](plans/playtest-4-audit.md)
- Battle AI math gaps 1, 4, 8, 9, 10, 12 (targeting, withdraw, separation, influence maps, threat paths, kiting) — [plans/research-ai-math.md:35-53](plans/research-ai-math.md); the user parked this plan (memory note "AI math deferred")

### Inferences
- The largest structural differences from AoE: regiments brought from a campaign (not built from scratch), strength-scaled damage without armour, morale with asymmetric routing, objective-based victory (bases/keep/beachhead), and a hard clock.

### Gaps
- Whether P4-C2 / P4-H2 are fixed was not verified (no matching commit message found in the last 400 commits).

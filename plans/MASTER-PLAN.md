# Terra Imperium master plan

Date: 2026-10-06. **Start here.** This file joins every plan into one order of work: the roadmap
(peoples, names, independents, settle rules; the nine ages for later), the RTS battle plan, the world art plan,
the review of both (speed, fog of war, the globe) and the user's decisions of 2026-10-06. Where
two plans disagree, this file says which one wins. The detail stays in the plans below; this file
says what to build, in what order, and what must not be forgotten.

## 1. The documents

| File | Holds | Status |
|---|---|---|
| `plans/MASTER-PLAN.md` | this file | current |
| `plans/ROADMAP.md` | decisions 1 to 22, phases S, W0 to W4, Ages 1 to 5, M | current, superseded where this file says so |
| `plans/peoples-and-world-setup.md` | the 150 peoples, world sizes, start screen, titles, city names, art themes, map quality | current |
| `plans/data/cities/*.json` | 3,000 city names (150 peoples x 20) | draft, web check pending |
| `plans/independent-cities.md` | independents: raids, sack, razing, tribute, joining, AI | current, battle parts replaced by section 6 here |
| `plans/eras-origins-and-future.md` | nine ages, units, robots, powers, governments | **later** (decision 32): five ages now |
| `plans/settle-rules.md` | one Civ-style spacing rule (R1, R2, R5 to R7) | current; R3 and R4 only for the legacy 240-nation world |
| `plans/terra-imperium-rts-plan.md` | the RTS battle design (economy, ledgers, outcome, saves, tests) | current, amended by section 6 here |
| `plans/terra-imperium-world-art-and-city-destruction-plan.md` | terrain, footprints, city manifest, destructible houses | current, on the single WebGL map (section 5) |
| `plans/rts-world-review.md` | the review: measurements, speed plan, globe | current |
| `plans/UI-DESIGN.md` | the UI and UX design: the look, five rules, 25 screens (world and RTS) mapped to phases; sketches in `plans/ui/` | current |

The roadmap's code branch `claude/ancient-world` holds the settle-rules prototype and the age
registry; the art and everything else is on `claude/bronze-towns`. **Before phase W0 starts,
merge `claude/bronze-towns` into `claude/ancient-world`** (the roadmap's known issue: palaces by
`nation.theme` need the art branch), and from then on merge art into it after every art batch.

## 2. Every decision

Roadmap decisions 1 to 22 (`ROADMAP.md` section 2) stand. New, 2026-10-06:

23. **Every assault is a full RTS battle**: city assaults and attacks on armies in the field (and
    raids, sacks, sallies, landings), with workers, buildings and training.
24. **Every battle offers Command or Auto**, always, for attacker and defender, player or AI.
25. **300 combat units a side** is the default battle size; 500 and 1,000 are optional presets
    only where measured.
26. **Village houses control population** in battle (section 6.3).
27. **Fog of war on** by default (explored, seen, visible), with an "explored world" option.
28. **Hide the globe** for one release behind a setting, then delete it. The flat map becomes the
    one map, with east and west joined. (This replaces roadmap item 22's "sharper globe".)
29. **The flat map moves to WebGL** (territories, borders, badges, fog and the 3D close view in
    one canvas) after the fog phase.

Decisions of 2026-10-06, second round:

30. **Every unit takes population**, the brought army included (section 6.3).
31. **Conquest keeps at least half the city**: battle damage carries to the map at most 50%
    (section 6.8).
32. **Five ages** (Bronze to Modern) for now. The nine-age plan (`eras-origins-and-future.md`) is
    the future, after its art exists; nothing in phases 1 to 13 below depends on it.
33. **Field battles are decisive**: the side that loses a battle away from a city loses the units
    still on the field; the winner's units gain XP (section 6.9).
34. **Forts start battles** against enemies that come near, and **armies cross rivers** (section 6.9).
35. **Three battle resources**: food, materials, gold.
36. **Full base-building in field battles too**, not a light camp.
37. **Fewer systems**: **no prisoners** (units lost in a battle, raid or sack are simply gone;
    decided 2026-10-06, replacing "ransom or release"); **succession and the noble estates are
    removed** from the game (phase X in section 7).
38. Lead's calls on the rest: mercenaries come with the independents work (W2); no captives
    (decision 37); no weather or seasons in battles.

## 3. Contradictions between the plans, resolved

| Topic | Plans disagree | Decision |
|---|---|---|
| World sizes | independents 0, 2, 7 and eras 16 say 20/35/50 | **24/36/42** (peoples 2, roadmap 2) |
| Nation names | eras 3.5 and independents 14.1 rename by age (Sumer then Babylon) | **one name for all ages, title by government** (peoples 4.1, 4.5); no Civilization names |
| Nation ids | independents 3.1 keeps country codes | **people slugs** (peoples 6.2) with `LEGACY_NATION_IDS` |
| Starts | eras 3.2 gives hearth nations bigger villages | **every nation starts equal** (roadmap 10) |
| Emergence | eras 3.2 and 12 use emergence by year | **no emergence** of majors (roadmap 5); late peoples arrive as independents |
| AI tiers | eras 11 keeps Tier 1 only | **every major is Tier 1** (independents 5); independents have their own cheap AI |
| Distances | gaps measured on the frequency-75 grid ("6 hexes") | **write them in km** (`ringsForKm`): the 6-hex gap is 612 km (8 rings at frequency 100); spacing 306 km (4 rings) |
| Eras in the RTS plan | 5 eras vs the roadmap's 9 ages | **5 ages now** (decision 32); catalogs keyed by the age registry (`src/data/ages.js`) so the 9 ages plug in later |
| Base-building | review section 4.1 said "great sieges only" | **every assault** (decision 23) |
| The globe | roadmap 22 "sharper globe" | **hidden, then removed** (decision 28) |
| Battle size | RTS plan 500 standard | **300 standard** (decision 25) |
| Population | review: the brought army needs no houses | **every unit takes population** (decision 30) |
| Field-battle camps | review: a light camp | **full base-building** (decision 36) |
| Default start | roadmap 18 to 19: nine ages, Origins start in 5000 BCE, game ends 2500 | **five ages for now** (decision 32): the Dawn start (2000 BCE) stays the default until the nine ages land |
| Estates and succession | eras 10 adds a Synthetics estate; succession drives pretenders | **both removed** (decision 37); civil wars keep other causes |

The Jerusalem and Ramallah clash of the legacy world does not arise in new games: the pool has
one people per place and its capitals are spaced by construction (peoples 4.1; Philistia and
Moab were left out for this reason, peoples 4.1 "Spacing"). The settle-rules R3 and R4 stay only for
old full-world saves.

## 4. Names everywhere (the roadmap's peoples in the game and in battles)

The peoples plan says the titled name shows "everywhere a nation name shows" but never mentions
battles. Rules:
- **Nations**: the title by government ("Kingdom of Akkad", "the Akkadian Empire", "Holy
  Akkad"); independents "the Israelite tribes" style. Missing titles to write: Dictatorship,
  Technocracy, Corporate State (peoples 4.5 open).
- **Cities**: the founder's next of its 20 names, then Pleiades ancient names, then syllables
  (peoples 4.6). Conquered cities keep their names; renaming costs loyalty.
- **Battles**: "Siege of <city>" for an assault, "Battle of <nearest city or the tile's place
  name>" for a field battle, "Raid on <city>", "Sack of <city>", "Landing at <coast place>",
  "Sea battle off <place>". Used in the pre-battle screen, the battle HUD, the result screen,
  battle reports, logs and the era goals.
- **Units**: adjective plus unit name by age ("Akkadian Mace Bearers"); regiments numbered per
  nation ("3rd Akkadian Slingers"); generals keep their names.
- **Art**: a people's `theme` picks the town kit, palaces, the battle city (same manifest), and
  the RTS culture skins (RTS plan 14.3: one functional set per age, culture skins as an art
  layer). Theme counts in the pool set the art priority: europe 24, americas 19, levant 18,
  steppe 16, indic 13, monsoon 12, eastafrica 9, maghreb 8, sinic 8, nile 6, westafrica 6,
  pacific 5, korea 3, japan 2, israelite 1.
- **Unmet peoples** show as "unknown people" until contact through fog (eras 9.1; section 5.1).

## 5. The map: fog, speed, one map

Measured 2026-10-06 (`rts-world-review.md` section 5): panning runs at 4 to 10 frames a second on
a desktop and 1 to 4 on a phone; a turn freezes a phone for over 3 seconds.

### 5.1 Fog of war (rules: `add-mechanic`)
- Per nation, an **explored** bitset (100 kB, run-length encoded in saves) grown from `sight.js`
  each turn; the player's **last seen** snapshot per tile (owner, city size and tier,
  improvement, turn).
- **Contact** needs sight (eras 9.1): unmet peoples are "unknown"; diplomacy opens on contact.
- Shared exploration: allies, vassals, trade partners (later), maps from tribal camps, a tech that
  reveals coasts. Independents count as met when seen.
- The AI uses the same explored set for settling and targets.
- Battle fog follows the same rule: the attacker sees the city only as far as scouts and the
  last-seen snapshot reveal.

### 5.2 Rendering by fog state
Unexplored: one dark mask, nothing drawn. Explored, not visible: last-seen territories and towns,
greyed, static, no units. Visible: everything.

### 5.3 Speed work (review section 6)
Spatial index for every on-screen query; placements cached per tile; zoom by transform and
rebuild on settle; render on demand; turn in a Web Worker; React state split into slices; tiles
as a fetched binary instead of an 8.2 MB JSON in the main bundle. Gates: pan 30+ fps on a phone,
55+ on a desktop; the UI never blocked more than 50 ms by a turn.

### 5.4 One WebGL map, globe hidden (decisions 28, 29)
Territories, borders, badges, banners, fog and the 3D close view in one canvas and one camera
(the world art plan's "one depth pass"); east and west joined; the globe behind a setting for one
release, then deleted with `react-globe.gl` and `politicalTexture`. The roadmap's map-quality
items (levels 6 and 7 of the raster, hillshade, land cover, HydroRIVERS) land on this map; the
8,192 globe texture is dropped.

Status (branch `claude/phase-a2-webgl-map`): done. `src/components/map/gl/` draws the map; the old
SVG map ("Old map drawing") and the globe ("Show the globe") are settings, both off. Measured with
`scripts/perf/map-pan.mjs --gpu` (the A2 report has the tables): panning the explored world at
k 4 and 12 went from 11-15 fps to 107-132 fps on the 844x390 profile with the CPU slowed 4x, from
40-55 to 101-144 fps on the desktop; the close view (k 40) from 15 to 78 and from 47 to 92. With
software WebGL (no GPU, the worst case) the phone pans at 28-35 fps at k 1 to 12 (2 to 3 before),
the close view stays slow (5 fps; 3 before). Left: delete the globe and the SVG map after one release; the world map window
(MapModal) and the minimap still draw SVG; the art of batch 08 (map sprites) has placeholders
(paths in `gl/mapSprites.js`).

## 6. Battles: the combined design

The RTS plan's engineering (determinism, ledgers, escrow, idempotent outcome, snapshots, budgets)
stands. These sections amend it.

### 6.1 Every assault, Command or Auto
- Battle kinds and their clocks: city assault 30 to 45 min (overtime to 60); field battle 15 to
  20 min with a camp; raid 8 to 12 min; sack (a raid that reached a weak city) 10 to 15; sally
  15 to 20; landing as city assault; naval separate (later RTS).
- Command or Auto for every battle, attacker or defender, including enemy assaults on the player
  (`DefenseSheet`) and raids by independents. `autoDefend`, `defaultMode`, `instantBattles` stay.
- **Auto must be honest**: a strategic auto-resolve fed by the same inputs (armies, walls, houses,
  economy potential, supply) and producing the same `BattleOutcome`; parity checked per age pair
  (eras 7.4) over 32+ seeds. Most battles in a game will be Auto; it must not be clearly better
  or worse than playing.
- AI vs AI battles are always Auto (abstract), shown in sight as markers.

### 6.2 Size: 300 a side
- 300 a side by default: soldiers and workers together, the population cap (section 6.3).
- The brought army maps to units by the RTS plan 5.1 (a full foot regiment 50, mounted 25, siege
  10, air 5). An invasion bigger than 300 chooses: waves, or the 500/1,000 preset where the device
  passed the measured test, or Auto. Waves: the units that do not fit wait off the map and enter
  as population frees up (deaths, retreats), in the order the player sets.
- Control by **regiment** (box select regiments, regiment cards, formations); single units
  remain selectable. 300 single-unit orders are not playable on a 844x390 screen.
- **Phase C result (2026-10-06, branch claude/phase-c-battle-kernel).** `node scripts/battle-bench.mjs`:
  AI against AI, a full army mix, everyone on the field, 2,400 ticks; i7-12650H, one core pinned;
  phone = x4 (review section 5); budget p95 <= 10 ms, p99 <= 20 ms (RTS plan 13.1).

  | Sim entities a side | Before: mean / p95 ms | After: mean / p95 / p99 ms | Phone p95 after (x4) |
  |---|---|---|---|
  | 300 | 2.41 / 3.81 | 0.80 / 1.19 / 1.51 | 4.8: **go** |
  | 500 | 5.26 / 8.90 | 1.42 / 2.13 / 2.78 | 8.5: go, little margin |
  | 1,000 | 29.9 / 39.0 | 5.65 / 9.98 / 14.2 | about 25 to 40: **no** |

  Same world hash before and after on every scenario (a pure speed change). The renderer is now
  the limit: at 300 squads a side (about 10 figures each, 6,000 figures) a frame is 14 to 19
  million triangles at zoom 1 and 3.6 million zoomed out (phone budget 0.5 million); the sim is
  not. Before R1: frustum culling and a distance LOD for soldier layers, shadows off for the mass,
  fewer figures per entity at scale, and packed transferable frames (13.3).
- **Phase C2 result (2026-10-06, branch claude/phase-c2-battle-render): the renderer.** Edge on the
  Intel UHD iGPU, 844x390, DPR 1, `?battleSandbox&bench=300&autostart`, dev server
  (`.claude/skills/battle-lab/render-bench.mjs`; screenshots in plans/phase-c2/).

  | 300 a side | Before: triangles / frame p50, p95 ms | After: triangles / frame p50, p95 ms |
  |---|---|---|
  | Default camera (zoom 1) | 20.8 M / 130, 136 | 0.43 M / 4.9, 6.5 |
  | Default, CPU x4 | 16.6 M / 108, 126 | 0.41 M / 17.5, 35.9 |
  | Close (zoom 2.2) | 15.5 M / 106, 133 | 0.43 M (max 0.54) / 4.7, 6.2 |
  | Far (zoom 0.45) | 3.5 M / 40, 51 | 0.48 M / 7.7, 9.9 |

  How: squads off screen are not written; three detail levels per soldier (full with shadows,
  about 360 and about 60 triangles, clustered with the rig kept, `soldierLod.js`), one a frame by
  size on screen within a 300k (phone) / 800k (desktop) triangle budget; past 80 squads a side
  fewer figures per squad (about half at 300, 0.4 at 500+), spread wider; props instanced per
  48-tile chunk so they cull, skirt props without shadows, structures merged by material, fog veils
  hidden when nothing is fogged; drawSquads writes the buffers directly. Worker frames are packed
  (`packedView.js`): 2.44 ms a tick (build + clone) down to 0.21 ms at 300, 4.9 to 0.4 ms at 500.
  `&perf` puts the numbers on screen; `scripts/battle-phone-bench.mjs` emulates a phone (DPR 3,
  touch, CPU x4/x6, not the GPU): 300 and 500 a side ran at 33 to 55 fps median at x4 in a
  production build, p95 33 to 85 ms (noisy on this laptop). Verdict: 300 a side holds end to end
  on a mid phone by these measures (sim p95 4.8 ms x4, render about 30 fps with p95 near the 40 ms
  line); a real-phone run with `&perf` is the remaining check. 500 a side: sim go (8.5 ms x4), but
  the far view is 0.64 M triangles and the main thread has little margin: it needs a billboard
  level for the farthest zoom, fewer or merged props at far zoom, and the HUD off the per-squad
  React path before it is offered on phones.

### 6.3 Village houses and population (decisions 26, 30)
As in Age of Empires, every unit needs housing:
- **Population** = every living unit on the field (the brought army, workers, trained units)
  plus units in training. It may not exceed the **housing cap**, and never 300 (decision 25).
- **The brought army is never blocked or harmed by housing**: it enters even above the cap (the
  cap is then simply full, so training waits until houses are built or units fall). Housing never
  kills or removes a unit; it only stops training.
- **Attacker**: the expedition camp houses 20, its army's supply train another 10 per regiment
  brought (so a large army arrives housed); each **village house** (cheap, fast, built by
  workers) adds 10.
- **Defender**: the **real city's houses** (from the city manifest, so a bigger city has more)
  each add their capacity; the town hall adds 20. Destroying the defender's houses lowers its
  cap: training stops while over it. So the destructible city matters to the fight.
- Houses lost in battle are the same houses lost on the map (manifest ids), within the 50% rule
  (section 6.8).
- House art per age and theme (Bronze mudbrick to Modern blocks), from the town kits' houses.
- Later, with the Future age: robots need **power** instead of houses.

### 6.4 Economy in every battle
- **Three resources** (decision 35): food (farms, fishing, herds), materials (wood, stone, metal
  ore) and gold (mines, trade, loot).
- **Full base-building in every battle** (decision 36): city assaults, field battles, sallies and
  landings all have workers, an HQ or camp, houses, depots, production and towers. Raids are the
  one light case (loot, burn, leave), because raiders come to plunder, not to stay.
- No free armies: regular recruits from campaign escrow, auxiliaries demobilise (RTS plan 6.5).

### 6.5 Independents in battle (independents plan)
- Raids: the raiders' goal is loot (depots, fields, a trade post) and escape by an exit; the
  defender wins by killing or driving them off. Pillaged tiles, cut trade routes, captured
  settlers and burned outposts follow from the battle result.
- Sack: if raiders win against a weak city: gold, -1 size and -1 building tier, as the manifest
  damage (the houses and the building they destroyed), never a capture.
- Attacking an independent: a normal assault; its tribal-league allies and mercenaries arrive as
  reinforcements; personalities change the setup (Fortress: walls one tier higher, 1.5x garrison;
  Mercantile: strong walls, mercenaries).
- Razing after capture: one size a turn on the map (independents 5), not in the battle.

### 6.6 Ages in battle
- **Five ages now** (decision 32): Bronze, Classical, Kingdoms, Gunpowder, Modern, each with the
  RTS plan's five roles plus the worker (7.1 there) and its houses, walls and towers.
- Every catalog (units, buildings, houses, weapons and armour tags) is keyed by the age registry,
  so the nine-age plan adds rows later (Neolithic, Age of Cities, Information, Future, robots and
  power-housing) without changing the battle code.

### 6.7 Mechanisms the RTS plan forgot (from the engine)
Each one a battle must read or write; each gets a test in the outcome service:

| # | Mechanism | Where today | What the RTS battle must do |
|---|---|---|---|
| 1 | War score | `recordBattle` in invasion.js:214, fieldBattle.js:148, navalBattle.js:128 | add to `BattleOutcome`; one call per battle |
| 2 | Conquest effects | conquest.js:41-58 (control 25, unrest 50, loyalty, AE, claims, capital moves) | applied once on capture, through the same service |
| 3 | Siege control and the melee rule | siege.js:36-66 | the occupation timer maps onto it; aircraft and workers never capture |
| 4 | Zone of control, `local.fortLevel` | siege.js:83, buildBattleSetup.js:238 | setup inputs |
| 5 | Generals: skill, XP multiplier, 25% death | battle.js:84-86, aftermath.js:140 | a general is a unit on the field (aura, can die); death rule shared with Auto |
| 6 | Powers: rally, arrow storm, artillery, air strike, satellite sweep, missiles, nukes | invasion.js:63-74, gameReducer.js:523-558 | spent once; the satellite sweep lifts battle fog; nuke penalties unchanged |
| 7 | Tile forts, held-tile bonus, river crossings | fieldBattle.js:37-40, 72 | forts start battles and stand on the battle map; rivers with fords (section 6.9) |
| 8 | Air turn-back by AA and patrols | airPower.js:18-24 | aircraft arriving in battle pass the same roll first |
| 9 | Encirclement, blockade, starvation | sieges.js:5-16 | a starved city starts with less food and morale |
| 10 | Wonders raising wall HP | sieges.js:46 | wall HP from the same formula |
| 11 | Plague carried by armies | plague.js:56 | a plague city's units start weakened; armies carry it home |
| 12 | Supply meter and stack cap | supplyMeter.js:27-46 | low supply: smaller starting stockpile and morale; the cap stays on the map |
| 13 | After the battle | resolveTurn.js:553 (`lastBattleTurn`), fieldBattle.js:113 (5-turn marker) | kept |
| 14 | Battle reports and replays | battleReports.js:32 | named battles, the RTS summary, Auto replays |
| 15 | Tech boost and era goal | data/boosts.js:15, data/eraGoals.js:14 | counted from the outcome |
| 16 | Defensive pacts, vassals, allies | diplomacy.js:176 | allied armies in range may join as reinforcements (RTS plan 5.3) |
| 17 | Rebels | civilWar.js | can attack and besiege: same battles; pretenders go with succession (decision 37) |
| 18 | Bankruptcy desertion | resolveTurn.js:909 | applied before the setup is captured |
| 19 | Synthetic garrison, AI capture x1.85, withdrawal cost | defense.js:37, 65-82, 336-363 | replace the synthetic garrison with the city's militia and houses; keep withdrawal |
| 20 | Building razing in commanded battles | gameReducer.js:560 | replaced by manifest damage |
| 21 | Field and naval battles skip the aftermath | fieldBattle.js, navalBattle.js | decide on purpose: field battles cause devastation and war exhaustion too (recommended) |
| 22 | Intel and odds | intel.js, battleOdds.js | the pre-battle screen keeps odds or the scouts' guess |

Mechanisms nobody has yet, needed by the plans:
- **Mercenaries**: independents sell them (independents 4.6); no module exists. Hired units with
  upkeep and a contract length, in battles as any unit.
- **Multiple battles in one turn**: a queue in the order of movement; each pauses the turn.
- **Battles while a peace offer or event is open**: resolveTurn waits for them today; the battle
  queue must too.
- **Weather and seasons**: out of scope (decision 38).

### 6.8 Conquest keeps half the city (decision 31)
- Battle damage to the city (houses, buildings, walls) is recorded per manifest id, but **at most
  50% carries to the map**: the city keeps at least half its houses and buildings, at least half
  its size, and no building loses more than one tier. The rest is "damaged" and repairs over a
  few turns at no cost (half of it at the start of the occupation).
- So destroying the city in battle still costs the conqueror (a smaller, damaged prize), but a
  conquest never leaves ruins only. Razing stays a separate, deliberate order on the map.
- The same 50% rule for sacks, sallies and failed assaults (the defender's city).
- **Phase B result (2026-10-06, branch claude/phase-b-city-manifest).** The town models are split
  back into their houses and landmarks (`npm run build:town-layouts` writes
  `src/data/townLayouts.json`); `src/data/townLayout.js` builds a city's manifest (town hall,
  houses with stable ids and housing, landmarks, palace, buildings, wall ring, gate, towers,
  wonders) and `src/engine/cityManifest.js` derives it from the city record, so saves keep only
  `region.cityDamage` (an optional field: no save version change). A city assault loads it
  (`src/battle/setup/cityBattle.js`, setup version 4): 2.75 tiles per model unit, the gate turned
  to the attacker, houses and walls block the ground and fall to rubble, only the keep, armed
  towers and buildings are picked by the AI. The battle reports its losses by manifest id; the
  reducer carries them under this rule; repairs run each turn. The close view and the battle draw
  the same town model with the same damage shader (`closeView/townDamage.js`). Parity
  (`TYPES=assault CITY=1`): the real city plays like the old keep (both still far from auto: R2).
  Screenshots: `plans/images/phase-b/`.

### 6.9 Field battles, forts and rivers (decisions 33, 34)
- **Decisive field battles**: a battle away from a city ends when one side's army is destroyed,
  routed off the map or retreats through an exit. The loser's units still on the field at the
  end are **destroyed**; units that left through an exit before the end survive and move back one
  tile. The winner's surviving units gain XP (today's 30 for a win, times the general's
  multiplier). Auto uses the same rule.
- **Forts start battles**: an enemy army that enters a tile next to a manned fort (or tries to
  pass it) is stopped and a field battle starts, with the fort on the battle map as a defensive
  building (walls, towers, a garrison that counts as housed). An unmanned fort only slows.
  Forts get zone of control on the map.
- **Rivers**: armies may cross rivers; a crossing costs extra movement, and a battle on a river
  tile puts the river on the battle map with fords and bridges (from the tile's road and river
  edges). Defending a crossing gives the defender the fords as chokepoints.

## 7. Order of work

Four tracks run side by side. Each phase is one branch, merged when the user says.

| # | Track | Phase | Plan | Depends on | Size |
|---|---|---|---|---|---|
| 1 | Rules | **S** settle rules R1, R2, R5 to R7 | settle-rules | none | 1 session |
| 2 | Rules | **W0** peoples, names, start screen, id switch, equal starts, random seed | peoples | S; the art branch merged in | 2 to 3 |
| 3 | Map | **A** fog of war and map speed (5.1 to 5.3) | review 6, this 5 | none (fog rules touch `sight.js` only) | 3 to 4 |
| 4 | Battle | **C** battle kernel go/no-go: packed sim, spatial buckets, 300 / 500 / 1,000 a side on a mid phone; hash-chain checkpoints | review 3, RTS 12 to 13 | none | 2 to 4 |
| 5 | Battle | **B** city manifest: the town assembler writes components; the battle loads the real city with destructible houses, walls, landmarks; damage persists | world plan 7 to 11 | art assembler | 3 to 4 |
| 6 | Rules | **W1** passive independents, `canFight` | independents | W0 | 2 to 3 |
| 7 | Map | **A2** one WebGL map, east-west wrap, globe hidden | this 5.4 | A | 3 to 5 |
| 8 | Battle | **R1** RTS economy: workers, three resources, village houses and the housing cap, construction, training | RTS 6, this 6.3 to 6.4 | C passes | 4 to 6 |
| 9 | Battle | **R2** campaign bridge: escrow, the one outcome service with every row of 6.7, names, Command/Auto everywhere, honest auto-resolve | RTS 9, this 6.1, 6.7 | R1, W0 ids | 3 to 4 |
| 10 | Rules | **W2, W3, W4** independent AI, interactions, UI | independents | W1 | 5 to 7 |
| 11 | Battle | **R3** every battle kind: field, raid, sack, sally, landing; independents in battle | this 6.1, 6.5 | R2, W2 | 3 to 4 |
| 12 | Rules | **X** remove succession and the noble estates (decision 37): `succession.js`, `estates.js`, `estateLand.js`, pretenders in `civilWar.js`, their events, UI (CityPolitics, ProvinceModal) and saves; balance-sim before and after | this 2 | none; before W0 if possible (fewer systems to re-key) | 1 to 2 |
| 13 | Battle | **R4** the five ages' rosters, houses, walls, towers and weapons in battle | this 6.6 | R3 | 3 to 5 |
| 14 | Map | **F** terrain, mountains, rivers, footprints on the WebGL map | world plan 3 to 6 | A2 | ongoing |
| 15 | Art | towns, buildings, wonders, icons (in progress), then RTS prefabs and units per age and theme | RTS 14, eras 13 | per phase | ongoing |
| 16 | All | **Balance**: balance-sim with battles on Auto; parity per age pair; pacing playtests | RTS 17 | R4 | ongoing |
| 17 | UI | **U** UI pass: restyle every screen to `plans/UI-DESIGN.md` (look, top bars, brass only for the primary action, reasons on tap); new screens peace deal, attacked interrupt, raid and tribute, battle reports, nation overview | UI-DESIGN | per screen, after the phase that owns its system; most after R2 | ongoing |
| later | Rules | **Nine ages** (Age of Cities, Neolithic and Origins, Information, Future, robots): after their art exists (decision 32) | eras 16 | all above | 13 to 16 |

Start now, in parallel: **S**, **X**, **A**, **C**. **C** decides whether 300 a side holds on a phone;
if not, the battle size or the device floor is revisited before R1, never silently.

## 8. Open questions for the user

None blocking. Interpretations of the 2026-10-06 answers to confirm in passing:
- "Forts initiate battle": read as a manned fort stopping enemies that come next to it (6.9).
- "Can cross rivers": read as armies crossing rivers on the map, with river battles (6.9).
- Prisoners: dropped (decision 37); the RTS plan's "captured" surrenders count as losses.
- "Dropping succession noble stuff": succession, heirs, pretenders and the estates are removed;
  rulers, governments and governors stay (phase X).

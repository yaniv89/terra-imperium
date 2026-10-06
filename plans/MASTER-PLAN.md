# Terra Imperium master plan

Date: 2026-10-06. **Start here.** This file joins every plan into one order of work: the roadmap
(peoples, names, independents, nine ages, settle rules), the RTS battle plan, the world art plan,
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
| `plans/eras-origins-and-future.md` | nine ages, units, robots, powers, governments | current |
| `plans/settle-rules.md` | one Civ-style spacing rule (R1, R2, R5 to R7) | current; R3 and R4 only for the legacy 240-nation world |
| `plans/terra-imperium-rts-plan.md` | the RTS battle design (economy, ledgers, outcome, saves, tests) | current, amended by section 6 here |
| `plans/terra-imperium-world-art-and-city-destruction-plan.md` | terrain, footprints, city manifest, destructible houses | current, on the single WebGL map (section 5) |
| `plans/rts-world-review.md` | the review: measurements, speed plan, globe | current |

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
| Eras in the RTS plan | 5 eras, "x 5" art counts | **9 ages from the age registry** (`src/data/ages.js`); art counts x 9/5 |
| Base-building | review section 4.1 said "great sieges only" | **every assault** (decision 23) |
| The globe | roadmap 22 "sharper globe" | **hidden, then removed** (decision 28) |
| Battle size | RTS plan 500 standard | **300 standard** (decision 25) |

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
- 300 combat units a side by default, plus workers (counted in the population, section 6.3).
- The brought army maps to units by the RTS plan 5.1 (a full foot regiment 50, mounted 25, siege
  10, air 5). An invasion bigger than 300 chooses: waves, or the 500/1,000 preset where the device
  passed the measured test, or Auto.
- Control by **regiment** (box select regiments, regiment cards, formations); single units
  remain selectable. 300 single-unit orders are not playable on a 844x390 screen.

### 6.3 Village houses and population (decision 26)
As in Age of Empires, units need housing:
- **Population** = living workers + living trained units + queued units. It may not exceed the
  **housing cap**.
- The **brought army does not need houses**: its slots are reserved at the start (RTS plan 5.2),
  so a large invasion is never blocked by housing. Houses cap only workers and new recruits.
- **Attacker**: the expedition camp houses 20; each **village house** (cheap, fast, built by
  workers) adds 10; up to the 300 battle size.
- **Defender**: the **real city's houses** (from the city manifest, so a bigger city has more)
  each add their capacity; the town hall adds 20. Destroying the defender's houses lowers its cap:
  training pauses when over the cap, units are never killed by it. So the destructible city
  matters to the fight, not only to the aftermath.
- Houses lost in battle are the same houses lost on the map (manifest ids), and lower the city's
  population and devastation once (aftermath).
- **Robots** (eras 4.7, Future age) need **power** instead of houses: generators and reactors cap
  robot numbers; an EMP or a destroyed generator stops robot production.
- Ages: Neolithic huts (+5), Age of Cities mudbrick houses, up to Modern apartment blocks and
  Future habitats (+15); art per age and theme.

### 6.4 Economy in every battle
- Resources: the RTS plan's four (provisions, materials, metal, credits) are many for a phone.
  Recommendation: three (food, materials, gold), metal folded into materials until Gunpowder.
  Open question 1.
- Field battles get a camp, a few workers and the basic buildings only; city assaults the full
  set; raids almost none (loot depots, burn, leave).
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

### 6.6 Nine ages in battle (eras plan)
- Rosters per age from eras 6.1; tactical rules per age from eras 7.1 (no formations and early
  routs in the Neolithic, Battle Wagons' turn rate, slingers' splash, MG suppression, shields,
  railguns, beams); powers per age from eras 7.2; battlefields per age (earthwork rings, mudbrick
  walls, domes, eras 7.3).
- Neolithic war is raiding for loot and captives; no annexing before Chiefdoms (eras 9.1).
- Robots: no manpower, never rout, EMP, Hijack, cannot hold a city alone (eras 4.7).
- The RTS plan's weapon-versus-armour tags must cover Neolithic clubs to Future plasma.

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
| 7 | Tile forts, held-tile bonus, river crossings | fieldBattle.js:37-40, 72 | forts are buildings on the field battle map; rivers with fords |
| 8 | Air turn-back by AA and patrols | airPower.js:18-24 | aircraft arriving in battle pass the same roll first |
| 9 | Encirclement, blockade, starvation | sieges.js:5-16 | a starved city starts with less food and morale |
| 10 | Wonders raising wall HP | sieges.js:46 | wall HP from the same formula |
| 11 | Plague carried by armies | plague.js:56 | a plague city's units start weakened; armies carry it home |
| 12 | Supply meter and stack cap | supplyMeter.js:27-46 | low supply: smaller starting stockpile and morale; the cap stays on the map |
| 13 | After the battle | resolveTurn.js:553 (`lastBattleTurn`), fieldBattle.js:113 (5-turn marker) | kept |
| 14 | Battle reports and replays | battleReports.js:32 | named battles, the RTS summary, Auto replays |
| 15 | Tech boost and era goal | data/boosts.js:15, data/eraGoals.js:14 | counted from the outcome |
| 16 | Defensive pacts, vassals, allies | diplomacy.js:176 | allied armies in range may join as reinforcements (RTS plan 5.3) |
| 17 | Rebels and pretenders | civilWar.js | can attack and besiege: same battles |
| 18 | Bankruptcy desertion | resolveTurn.js:909 | applied before the setup is captured |
| 19 | Synthetic garrison, AI capture x1.85, withdrawal cost | defense.js:37, 65-82, 336-363 | replace the synthetic garrison with the city's militia and houses; keep withdrawal |
| 20 | Building razing in commanded battles | gameReducer.js:560 | replaced by manifest damage |
| 21 | Field and naval battles skip the aftermath | fieldBattle.js, navalBattle.js | decide on purpose: field battles cause devastation and war exhaustion too (recommended) |
| 22 | Intel and odds | intel.js, battleOdds.js | the pre-battle screen keeps odds or the scouts' guess |

Mechanisms nobody has yet, needed by the plans:
- **Prisoners and captives**: Neolithic raids take captives (eras 9.1), the RTS plan has
  "captured" surrenders; no module exists. One `captives` ledger: ransom, labour (+population),
  or release (opinion).
- **Mercenaries**: independents sell them (independents 4.6); no module exists. Hired units with
  upkeep and a contract length, in battles as any unit.
- **Multiple battles in one turn**: a queue in the order of movement; each pauses the turn.
- **Battles while a peace offer or event is open**: resolveTurn waits for them today; the battle
  queue must too.
- **Weather and seasons**: not in the game; out of scope unless asked.

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
| 12 | Rules | **Ages 1 to 4** Age of Cities, Neolithic and Origins, Information split, Future | eras 16 | W0 | 13 to 16 |
| 13 | Battle | **R4** nine-age rosters, rules, powers, robots and power-housing | this 6.6 | R3, the ages | 4 to 6 |
| 14 | Map | **F** terrain, mountains, rivers, footprints on the WebGL map | world plan 3 to 6 | A2 | ongoing |
| 15 | Art | towns, buildings, wonders, icons (in progress), then RTS prefabs and units per age and theme | RTS 14, eras 13 | per phase | ongoing |
| 16 | All | **Balance**: balance-sim with battles on Auto; parity per age pair; pacing playtests | RTS 17 | R4 | ongoing |

Start now, in parallel: **S**, **A**, **C**. **C** decides whether 300 a side holds on a phone;
if not, the battle size or the device floor is revisited before R1, never silently.

## 8. Open questions for the user

1. Battle resources: three (food, materials, gold), recommended, or the RTS plan's four?
2. Field battles: a full camp with base-building, or a light camp (a depot, houses, one barracks),
   recommended, so they stay 15 to 20 minutes?
3. Prisoners: ransom, labour or release, all three (recommended) or fewer?
4. Mercenaries and captives are new systems; add them in W2 (with independents), recommended?
5. Weather and seasons in battles: out of scope (recommended) or wanted?

# Plan: Emergent worlds and independent cities

Date: 2026-10-03. Status: approved with the decisions in section 13; not started (the user asked
to wait).
Companion to `plans/eras-origins-and-future.md` (the nine ages). This plan changes the shape of the
world, so it comes before that plan's Phase 1 (section 12).

---

## 0. The idea (from the user) and the short answer

**The user's idea:** drop the full 240-nation world. New games pick a world size of **20, 35 or 50
nations**. Every other people still exists, as an **independent city**: one city that cannot
conquer or settle more cities and only **raids**, like Civ's barbarians. The player and the major
nations can **conquer, raid or destroy** them. Independent cities need their own AI.

**My take: yes, it is a better game.** It fixes three problems at once:
- **The crowded world.** With 240 nations each one has room for 4 to 5 cities (my earlier
  numbers). With 35 majors and the rest as single cities, a major has room for 15 to 25 cities,
  the Civ feel, while the map still has 240 peoples on it.
- **The quiet world.** Today only Tier-1 AI nations fight, because 240 thinking nations are too
  slow. With 20 to 50 majors, **every major can be Tier 1**, and independents give everyone a
  constant, low-stakes source of conflict: raids to defend against, cities to take.
- **Speed.** About 205 one-city polities with a cheap AI cost far less than 205 full nations.

Recommended default: **Standard, 35 major nations.**

---

## 1. What the code does today (facts this plan builds on)

- `src/engine/worldgen/emergentWorld.js`: an "emergent" world mode already exists with
  `NATION_COUNTS = [15, 30, 45, 60, 75]`. It picks the player, then repeatedly the people whose
  capital is farthest from every chosen one (geographic spread). The rest are **dormant**: they
  are dropped from `state.nations` and listed in `scenario.dormantNationIds`.
- `src/engine/emergence.js`: every 50 turns one dormant people founds its capital, if the tile and
  its ring are free.
- **Free cities** (`loyalty.js`): a city whose loyalty hits 0 with nobody to flip to becomes
  ownerless (`owner: null`, `freeCity`). It can be settled peacefully or joins a neighbour later.
  **But ownerless cities cannot be besieged** (`sieges.js` skips `!city.owner`), and units,
  battles, opinion and plunder all need an owner id. So independents must **not** be ownerless.
- **Rebels** (`REBEL_OWNER_ID`) are an owner that is always hostile to everyone; plunder.js,
  sieges.js, fieldBattle.js and armies.js already special-case it. This is the closest existing
  pattern to "can be fought without a war".
- `threat.js` has `pillageTile` and `threatenedCities`; `plunder.js` raids trade routes.
- AI: only "Tier 1" nations recruit and declare wars (`utils/aiLogic.js`), for speed.

---

## 2. World modes

| Mode | Major nations | Independent cities at Dawn | Independents per major | Land per major (rough) |
|---|---|---|---|---|
| Small | 20 | **100** (of about 147 possible) | 5 | about 640 hexes |
| **Standard (default)** | **35** | **all, about 132** | 3.8 | about 345 hexes |
| Large | 50 | **all, about 117** | 2.3 | about 240 hexes |

Counted from the data (2026-10-03): 235 peoples have a capital tile, **68** of them are
"unpeopled at Dawn" (islands and remote land), so about **167 peoples** have a city in 2000 BCE.
Usable land is about 14,600 hexes; an independent holds about 19 (its two rings).

**The ideal ratio is about 4 to 5 independents per major**: enough raiders to defend against
and cities to take early, without independents ruling the map.
- **Standard and Large keep every remaining people** as an independent (3.8 and 2.3 per major).
- **Small keeps 100**, not all 147: at 7.4 per major the 20 majors would spend the early game
  fending off raiders everywhere, and Small is the "few big empires" mode that needs empty land
  to settle. The 100 are picked by `HISTORY_WEIGHT` plus spread (the same score as the majors,
  section below), so famous peoples stay; the roughly 47 left out (mostly small peoples in dense
  areas: the Balkans, the Gulf, the Caribbean) start as open land to settle.
- **In every mode** the 68 island peoples appear later as independents when their land was
  settled historically (4.6), if nobody has claimed it by then. The count rises a little in the
  mid game, then falls as majors conquer independents.
- To be confirmed by the W1 balance-sim (section 10); the counts are one table to tune.

**Who is a major.** Today's pick is pure geographic spread, which can hand a 20-nation world to
20 remote islands. New rule: `score = (distance to the nearest chosen capital) x (1 +
HISTORY_WEIGHT[nation])`, seeded tie-breaks, the player always in.
- `HISTORY_WEIGHT` (new, `src/data/majorWeights.js`): high for the cradles and great powers of
  the start age (Dawn: eg, iq, cn, in, ir, tr, gr; later starts follow their era), low default.
- So a Small world still has Egypt, Mesopotamia and China most of the time, spread across
  continents, and each game differs.

**Everyone else** (up to the mode's independent count) becomes an independent city on its capital
tile (Dawn size table, capped at 3). The `UNPEOPLED_AT_DAWN` islands stay dormant and appear later
as independents (4.6).

**Start screen:** a World size picker (Small, Standard, Large) replaces full/emergent.
**Old full-world saves** keep loading and playing: mode `full` stays in the engine, new games
just cannot pick it.

---

## 3. The independent city: model

### 3.1 Representation (the key decision)
An independent is a **nation record with `kind: 'independent'`**, under its own people id (the
Hittites stay `tr`, shown as "Hattusa, the Hittite independents"). This reuses everything that
needs an owner: units, sieges, battles, loyalty, opinion, plunder, the map border.

One helper decides who may fight whom, used everywhere instead of `isWarBetween` alone:

```js
// src/engine/hostility.js
canFight(state, a, b) = isAtWar(a, b) || ((isIndependent(a) || isIndependent(b)) && !hasTruce(a, b) && !paysTribute(a, b))
```
It replaces the scattered checks in plunder.js, sieges.js, fieldBattle.js, invasion validation,
armies.js zone of control and aiOperations targeting (the same places that special-case rebels).

### 3.2 What an independent can and cannot do

| Can | Cannot |
|---|---|
| Hold its one city and its 2 border rings | Settle, found colonies or outposts |
| Grow the city, up to `INDEPENDENT_SIZE_CAP` (4 + age rank, max 9) | Capture a city (a won assault is a **sack**, 4.4) |
| Build walls and a garrison | Annex, vassalise, join pacts or alliances |
| Raid tiles, trade routes, settlers and weak cities | Declare formal wars, sue for peace |
| Demand tribute, sell mercenaries, trade (by personality) | Research (it uses the calendar age, 3.4) |
| Hold grudges and opinions | Expand borders beyond 2 rings |

### 3.3 Personalities
Assigned once, deterministically, from the city's terrain and culture group:

| Personality | Where | Raids | Defence | Economy | Special |
|---|---|---|---|---|---|
| **Raiders** | steppe, desert, cold coasts | often, far (6 to 8 rings), cavalry and raider fleets | weak walls | poor | demand tribute |
| **Mercantile** | river mouths, coasts, oases on trade tiles | almost never | strong walls | rich (x2 gold) | trade pacts, sell mercenaries, hire defenders |
| **Fortress** | mountains, hills, forest highlands | only in revenge, 3 rings | very strong (walls +1 tier, +50% garrison) | modest | never submits peacefully |
| **Tribal** (default) | everywhere else | sometimes, 4 to 5 rings | moderate | modest | can be absorbed peacefully |

Mix target at Dawn: about 25% raiders, 20% mercantile, 15% fortress, 40% tribal.

### 3.4 Strength over the ages
- Units are always the **calendar age's** roster (they buy weapons from their neighbours), so
  independents never become trivial. From the Modern age they are one age behind the leader at
  most, which never happens before anyway.
- Garrison target: `1 + floor(size / 2)` units, x1.5 for Fortress; walls tier = calendar age's
  defence tier (Palisade, Stone Walls, Star Fort...) capped by size.
- Late ages rename them: city-states and free states from Gunpowder; raiders read as
  **insurgents and militias** from Modern, and raid less (x0.5 Modern, x0.25 Information and
  Future), shifting from pillage to sabotage (a production hit instead of loot).

---

## 4. The independent AI (the core of this plan)

### 4.1 Budget and cadence
- One cheap pass in resolveTurn, in the AI phase. Each independent thinks **every 3 turns**,
  staggered by `hash(id) % 3`, so about 60 think per turn. No A* unless a raid is starting.
- Target cost: **under 5 ms a turn** for all independents together (measured, section 9).
- Deterministic: every roll is `hashRoll(`${id}|${turn}|<what>`)`. No Math.random.

### 4.2 Its state
```js
nation.indep = {
  personality: 'raiders' | 'mercantile' | 'fortress' | 'tribal',
  mood: 'calm' | 'raiding' | 'besieged' | 'recovering',
  raid: null | { targetTile, targetNationId, kind, unitIds, startedTurn },
  grudges: { [nationId]: 0..100 },      // decays 2 a turn
  tributeFrom: { [nationId]: untilTurn }, // who pays it (no raids on them)
  tributeTo: { [nationId]: untilTurn },   // who it pays
  lastRaidTurn
}
```

### 4.3 The decision loop (top priority first, stop at the first that acts)

1. **Under threat?** An enemy stack within 2 rings, or a siege: mood `besieged`. Recall the raid
   party, every unit garrisons. Mercantile spends gold to hire one mercenary unit. Neighbouring
   independents of the same culture group with grudge > 50 against the attacker may send one
   unit (a "tribal league", once per siege).
2. **Rebuild the garrison.** Garrison below target and gold enough: recruit one unit in the city
   (cost as a major's, paid from its treasury; manpower from city size only).
3. **Recover.** Mood `recovering` for 5 turns after a lost battle or a sack against it: no raids.
4. **Start a raid?** Only if no raid is running, the cooldown has passed
   (`RAID_COOLDOWN[personality]`: raiders 6, tribal 10, fortress revenge only, mercantile never)
   and there is at least one unit above the garrison target.
   - Candidates within `RAID_RINGS[personality]` (A* not needed: ring scan on the tile grid),
     owned by a major that does not pay it tribute and that it is not friendly with
     (opinion < 40):
     - an improved tile (farm, mine, pasture, plantation): loot = its yield x 4
     - a tile on a trade route: loot = PLUNDER_GOLD x 2, cuts the route this turn
     - a settler or outpost: loot = 20 gold, the settler is captured or the outpost burned
     - a city with garrison strength below half the raid party: **sack** (4.4)
   - `score = loot x (1 + grudge / 50) x eraFactor / (1 + defendersNear / raidStrength) - 3 x rings`
   - Raid if the best score passes `RAID_THRESHOLD` and the roll passes
     `RAID_CHANCE[personality] x difficultyMult x (1 + grudge / 100)`.
   - The raid party is every unit above the garrison target (at least one).
5. **Grow.** Otherwise: spend surplus gold on walls, then units up to the cap.

### 4.4 Running a raid (every turn while it lasts)
- March with the existing tile routes (armies.js / routes.js), at most `RAID_MAX_TURNS` = 8.
- On the target tile: `pillageTile` (threat.js) takes the loot into its treasury; the
  improvement is damaged (out for 3 turns) or destroyed if pillaged twice. The victim gets a log
  line and a toast, and a "raided us" opinion reason.
- **Sack** instead of capture: if the raid party wins the assault on a weak city, the city is
  **not** transferred. The raiders take gold (3 turns of the city's income), the city loses one
  size and one building tier, and the party goes home. A city is never destroyed by a raid.
- **Abort** and go home when the party has lost half its strength, a stronger enemy stack is
  adjacent, or its own city is threatened (step 1).
- Raid battles against the player can be fought in the tactical battle, like any other battle.

### 4.5 Grudges, tribute and submission
- **Grudge** +20 when a nation pillages its tiles or kills its units, +40 when it takes a city of
  the same culture group, +60 when it razes one; decays 2 a turn. Grudge raises raid weight and
  chance against that nation and lowers the price of buying peace from it.
- **Demanding tribute** (raiders, tribal): when its grudge or strength is high against a weaker
  neighbour, it demands gold (2 + age rank a turn, for 20 turns). To the player this is a choice:
  pay (no raids) or refuse (+20 grudge, a raid soon). AI majors pay when the raider is stronger
  than their nearby army, otherwise they refuse.
- **Peaceful submission** (tribal, mercantile): when a bordering major has opinion of it >= 80
  for 20 turns, or at least 5 times its military strength and opinion >= 40, it offers to join.
  Same path as a free city joining (loyalty.js), with no aggressive expansion.

### 4.6 No awakening (decision 2)
**Independents stay independent forever.** The set of major nations is fixed at the start; the
world only shrinks (conquest) and never adds a major. Today's emergence (a dormant people
founding a new major every 50 turns, emergence.js) is **removed** for these modes. The
"unpeopled at Dawn" islands instead appear as new **independents** when their land was settled
historically (Polynesia, Iceland, Madagascar...), on a year table, if their tile is still free.

---

## 5. What the player and the majors can do to independents

| Action | Rules |
|---|---|
| **Conquer** | No war declaration, no casus belli. Normal siege and assault. Aggressive expansion x0.5. The city's loyalty starts low (foreign culture). Same-culture independents +40 grudge. |
| **Raid** | Pillage its tiles with your units: gold and food for you, +20 grudge. |
| **Raze** | After conquering it: keep or raze, **any size** (decision 3). Razing takes time by size: the city loses `RAZE_SIZE_PER_TURN` = 1 size a turn and is gone at 0, so a size-2 village burns in 2 turns and a size-9 city in 9. While burning it yields nothing, cannot be sold or traded, and can be **retaken** by anyone (its old owner or a neighbour), which stops the razing. When it is gone its tiles are freed. +60 grudge from its culture group at the start; -20 opinion with majors who traded with it. The same rule applies to razing a major's city you conquered. |
| **Pay tribute** | Gold a turn for a set time: it never raids you meanwhile. |
| **Demand tribute** | If your nearby strength is at least 3 times its own: it pays you, or refuses (+grudge). |
| **Trade** (mercantile) | A trade pact: gold both ways, the route can be plundered. |
| **Hire mercenaries** (mercantile, raiders) | 1 or 2 units for gold, for 20 turns. |
| **Gift gold** | Opinion; leads to peaceful submission (4.5). |

**AI majors use the same actions.** Independents are the main expansion target of the AI: a
major whose army is at least 2 times the independent's garrison and has it within its front
range sends a siege force (aiOperations.js fronts, without `declareWar`). AI majors garrison
their borders against raiders and pay tribute when weak. **In emergent modes every major is
Tier 1** (20 to 50 thinking nations is affordable), so the world is no longer quiet.

---

## 6. Diplomacy and war plumbing
- `canFight` (3.1) is the only hostility check for independents; they never appear in
  `state.wars`, peace deals, defensive pacts or AE leagues.
- Aggressive expansion: taking an independent costs half the normal AE.
- New opinion reasons (data/opinion.js): *raided us* (-15, fades), *pays us tribute* (+10),
  *razed our kin* (-40), *trades with us* (+10).
- The player's war score, peace and exhaustion are untouched by independents (raids are not wars).

---

## 7. UI (phone landscape first, 844x390)
- **Map**: independents drawn with a muted, hatched border in their colour and a small shield
  showing the personality (horse: raiders, coin: mercantile, tower: fortress, totem: tribal).
  Raid parties carry a red torch marker; their target tile pulses.
- **Independent sheet** (side sheet, tap the city): name, personality, size, garrison, walls,
  its grudge against you, tribute status, and the actions of section 5 as 44 px buttons.
- **Warnings**: a toast and log line when raiders are 3 tiles from your land ("Scythian raiders
  are 3 tiles from Babylon"); raid targets appear in the threat list (threat.js).
- **Diplomacy panel**: majors as today; independents in a collapsible "Independent cities" list
  sorted by distance, with a filter for "raiders near me".
- **Start screen**: the World size picker (Small 20, Standard 35, Large 50).

---

## 8. Ties to the nine-age plan
- **Origins (5000 BCE)**: independents are the Neolithic tribes; the "tribal camps" idea of the
  nine-age plan (4.1) folds into this (absorb or trade with a tribe = submission or trade).
- **Age of Cities**: the Unify action works on independents of the same culture group.
- **Historical names**: independents use them too (Scythians, Philistia, Nubia...).
- **Modern to Future**: independents read as city-states and free states; raiders as militias
  and insurgents; Future independents get drone and robot defences like everyone else.

---

## 9. Performance
- Majors: 20 to 50 instead of 240, so the AI phases cost far less, even with every major Tier 1.
- Independents must skip every heavy per-nation phase (economy, research, succession, estates,
  diplomacy, AI recruitment, opinion recompute): one `isIndependent(n)` guard in each nation loop
  of resolveTurn. Every loop over `state.nations` gets audited in Phase W1.
- Target: Standard mode at or below today's full world in ms per turn, measured with
  balance-sim compare.sh on the same machine.

---

## 10. Balance targets (balance-sim, 3 seeds, Standard 35, 300 turns at Normal)

| Measure | Target |
|---|---|
| Independents conquered by 1 CE | 25% to 45% |
| Independents conquered by 1500 CE | 50% to 75%; about 10% survive to the Modern age (San Marino, Monaco) |
| Raids on the player, Bronze Age, with raiders in range | one every 8 to 15 turns |
| Cost of an average raid | at most one turn of the victim's income |
| A raid takes a city | never (sack only) |
| Largest major's share of cities by 1500 | below 33% (runaway check) |
| Median major's cities by 1 CE | 6 to 15 |
| ms per turn | at or below today's full world, same machine |
| nonFinite, audit violations | 0 |

---

## 11. Saves
New games only; shares the save version 9 bump with the nine-age plan. Old full-world and
emergent saves load and play as before (their nations have no `kind`, so nothing changes).

---

## 12. Phases (each on its own branch, merged when the user says so)

| Phase | What | Size |
|---|---|---|
| **W1. World modes and passive independents** | Small/Standard/Large with the section 2 counts; major and independent pick with history weight; independents as one-city `kind: 'independent'` records that never expand; breakaway cities become independents (14.4); `canFight` and conquer without war; the nation-loop guards; start screen picker; the names data of section 14 (generated, then reviewed by the user); tests; balance-sim | 2 to 3 sessions |
| **W2. Independent AI** | Personalities, garrison, raids, sack, grudges, tribute demands; battle-lab check that a raid battle plays in the tactical sim | 2 to 3 sessions |
| **W3. Interactions and major AI** | Tribute both ways, trade, mercenaries, raze, peaceful submission; AI majors conquer independents, defend and pay tribute; every major Tier 1 | 2 sessions |
| **W4. UI and art** | Hatched borders, personality shields, raid markers, the independent sheet, warnings | 1 to 2 sessions |
| ~~W5. Awakening~~ | Dropped (decision 2): independents stay independent; emergence.js is replaced by late island settlement as independents (part of W1) | |

Order: W1 to W3 **before** the nine-age plan's Phase 1 (Age of Cities), because the Origins and
Age of Cities designs build on independents. W4 can follow or run alongside.

---

## 13. Decisions (from the user, 2026-10-03)

1. **Default world size: Standard, 35 major nations.**
2. **Independents stay independent forever**: no awakening (4.6). The majors are fixed at the
   start; today's emergence of new majors is removed in these modes.
3. **Raze: any size**, taking longer for bigger cities (one size a turn, section 5).
4. **Raids: all options**: pillage tiles, cut trade routes, capture settlers and burn outposts,
   and **sack** weakly defended cities (gold, -1 size, a building damaged; never a capture).
5. **Peaceful joining: yes** (4.5).

6. **Independent counts**: Small 100, Standard and Large every remaining people (section 2).
7. **Names**: new names for the major nations by age and for independents and free cities
   (section 14).

**Do not start yet** (the user, 2026-10-03): implementation waits for the go-ahead.

---

## 14. Names: the major nations, independents and free cities

Names are data only: no rule reads them, so they never touch saves or balance. One module,
`src/data/polityNames.js`, answers `polityName(state, nationId)` and `cityName(state, cityId)`
for every screen, log line and map label. It builds on the nine-age plan's historical names
(`plans/eras-origins-and-future.md` 3.5, decided: the ancient empires, including the Kingdom
of Israel).

### 14.1 Major nations
- The name follows the nation's **effective age**: Sumer, then Babylon, then Babylonia, then the
  Abbasid Caliphate, then Iraq. The table lives in `src/data/historicalNames.js`
  (nation id -> age -> name), hand-written for the ~60 famous peoples (the nine-age plan's
  table), generated for the rest.
- From the Gunpowder age on, the modern name is used, with a few exceptions kept historical
  (Ottoman Empire, Mughal Empire, Safavid Persia, Qing China, Tsardom of Russia).
- The modern name always shows in small text under the historical one (nation sheet,
  diplomacy list, tooltip). A setting turns historical names off.
- **A major that conquers a lot does not rename itself** automatically. One event per age can
  offer a title to a nation that holds a famous capital with high loyalty ("Proclaim yourself
  heir of Rome", "Take the title King of Kings"): prestige plus the new name, the player's
  choice.

### 14.2 Independents
An independent's name is **its people's name for the age** plus a **form** that follows its
personality and the age:

| Personality | Neolithic and Age of Cities | Bronze to Kingdoms | Gunpowder | Modern to Future |
|---|---|---|---|---|
| Tribal | the {People} clans | the {People} tribes | the {People} confederacy | the {People} autonomous region |
| Raiders, land | the {People} warbands | the {People} horde | the {People} horde | {People} militias |
| Raiders, sea | {People} sea raiders | {People} sea raiders | the {People} corsairs | {People} pirates |
| Mercantile | the traders of {City} | the free city of {City} | the merchant republic of {City} | the city-state of {City} |
| Fortress | the {People} highlanders | {City} stronghold | the {People} free state | the {People} free state |

Examples at Dawn (Bronze Age), Standard mode, if these peoples are not majors:
| Nation id | Personality | Name shown | Under it |
|---|---|---|---|
| ua | Raiders, land | the Cimmerian horde | Ukraine |
| kz | Raiders, land | the Andronovo horde | Kazakhstan |
| lb | Mercantile | the free city of Byblos | Lebanon |
| ps | Tribal | the Philistine tribes | Palestine |
| cy | Mercantile | the free city of Alashiya | Cyprus |
| dk | Raiders, sea | Nordic sea raiders | Denmark |
| am | Fortress | Urartian stronghold (from the Classical age: Armenia) | Armenia |
| ge | Fortress | the Colchian highlanders | Georgia |
| bh | Mercantile | the free city of Dilmun | Bahrain |
| af | Fortress | Bactrian stronghold | Afghanistan |
| ml | Tribal | the Tichitt tribes | Mali |
| bo | Fortress | the Chiripa highlanders | Bolivia |

(Israel, if not a major, reads "the Canaanite tribes" before the Bronze Age and the Kingdom of
Israel's people as "the Israelite tribes" in the Bronze Age, following the decided table.)

### 14.3 Peoples without a famous ancient name
About 100 of the 235 peoples have no well-known ancient state. They get a **people name by
region and age**, generated from their culture group and location and then reviewed: "the
Danubian peoples", "the Bantu peoples", "the Andean peoples", "the Jomon". The modern name
always shows underneath.

### 14.4 Free cities (breakaway cities)
Today a city whose loyalty hits 0 with no one to join becomes an ownerless free city
(loyalty.js). In these modes it becomes a **new independent** instead, so it can be fought,
raided and traded with like any other:
- A new polity id `free_<cityId>`, personality from its terrain (as 3.3), the garrison it had.
- Named by age: "the free city of {City}" (Bronze to Kingdoms), "the commune of {City}"
  (Kingdoms in Europe), "the republic of {City}" (Gunpowder), "the free state of {City}"
  (Modern on). Rebel-held cities from a civil war keep their rebel name until it ends.
- It keeps its culture shares, so its old owner and its people's majors see it as "our people"
  (the existing opinion reason), and peaceful joining (4.5) works for them first.

### 14.5 City names
- Capitals and famous second cities take an **ancient name per age** where one is known (Ur,
  Memphis, Byblos, Hattusa, Jerusalem, Babylon, Nineveh, Mohenjo-daro, Anyang, Mycenae), in the
  same data file, then their modern name later (Byzantium, then Constantinople, then Istanbul).
- Every other city keeps today's naming (cityNames.js: the tile's name or the culture group's
  list).

### 14.6 How the full list gets made
- A generator script (`scripts/names/build-polity-names.mjs`) fills every nation x age from the
  hand-written table, the regional people names and the forms above, and writes
  `src/data/historicalNames.js`. It also prints a review sheet (one row per nation) for the user.
- The user reviews the sheet; corrections go into the hand-written table and the script is
  rerun. Nothing is shipped unreviewed.
- Rules: neutral wording, no names of living people, the modern name always visible, and the
  Israel and Palestine names exactly as in the decided table.
- A test checks every nation has a name for every age (through the age registry), and that no
  two polities show the same name at the same age.


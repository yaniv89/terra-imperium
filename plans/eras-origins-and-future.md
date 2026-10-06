# Plan: Origins (5000 BCE) and the Future (to 2500 CE), a nine-age Terra Imperium

Date: 2026-10-03. Status: approved with the decisions in section 17; Phase 0 in progress.
Builds on `plans/civ-map-rework.md` (map, cities, research web C3, era goals C9.3, pacing I2) and
`plans/playtest-1.md` P3 (the speed table).

---

## 0. The short answer

**Yes, do it, and do it as nine ages, not six.** Two new ages before the Bronze Age, and two new
ages carved out of today's Modern Age (one of them the Future you asked for).

| # | Age (id) | Years | What the age is about, in one verb |
|---|---|---|---|
| 1 | **Neolithic Age** (`neolithic`) NEW | 5000 to 3300 BCE | **Settle.** Bands become villages, farming spreads from its hearths |
| 2 | **Age of Cities** (`copper`) NEW | 3300 to 2000 BCE | **Organise.** Copper, the wheel, writing, the first cities and kings |
| 3 | Bronze Age (`bronze`) | 2000 to 800 BCE | Expand. Chariots, palace empires, bronze trade |
| 4 | Classical Age (`classical`) | 800 BCE to 500 CE | Conquer. Iron, coinage, republics, roads |
| 5 | Age of Kingdoms (`kingdoms`) | 500 to 1500 | Hold. Feudalism, castles, faith |
| 6 | Age of Gunpowder (`gunpowder`) | 1500 to 1900 | Reach. Oceans, colonies, standing armies |
| 7 | Modern Age (`modern`) CHANGED | 1900 to 1990 | Industrialise. Oil, tanks, flight, the atom |
| 8 | **Information Age** (`information`) NEW | 1990 to 2100 | **Connect.** Networks, precision weapons, drones, climate |
| 9 | **Future Age** (`future`) NEW | 2100 to 2500 | **Ascend.** Fusion, orbit, exo-armies then robot armies, the space victory |

Why two ancient ages and not one:
- 5000 to 2000 BCE is 3,000 years, longer than Bronze plus Classical together. One age would
  have to cover both "a tribe of hunters" and "Sargon's empire", which are different games.
- The two halves have clean, different verbs: the Neolithic is about **founding and food** (where
  do I settle, what do I domesticate, can I grow at all), the Age of Cities is about **turning
  villages into a state** (writing, kingship, copper armies, the first wars of conquest).
- History hands us a natural seam at about 3300 BCE: the Uruk period, the first writing, the
  wheel and copper weapons, the unification of Egypt soon after (about 3100 BCE).

Why a Future age **and** an Information age:
- Today the Modern Age is 400 years at 1 year a turn. At Normal speed that is about 400 of the
  920 turns, **43% of the whole game in one age** with one unit roster. That is the biggest
  pacing problem in the timeline, and it exists today, before any new content.
- Splitting it into Modern (1900-1990), Information (1990-2100) and Future (2100-2500) gives the
  late game three rosters and three sets of goals, and the Future age finally gives a home to
  things that are bolted on today: helium-3, the Fusion Grid action (types.js notes there is no
  Future building line for it), space missions, satellites, the space victory.
- The game now ends at 2500 (decision 3). The Future runs at 3 years a turn, so the total turn
  count still stays about the same as today (section 2).

This mirrors Civilization VI's nine eras (Ancient to Future) closely enough that players will
read the structure without explanation.

### The three options, ranked

| | Option | New content | Trade-offs |
|---|---|---|---|
| **1 (recommended)** | Nine ages as above | +4 ages: 40 techs, about 28 units, about 30 building tiers, 12 wonders, art for each | The full vision. Biggest content and art bill, done in phases (section 16), each phase shippable on its own |
| 2 | Seven ages: one "Dawn Age" 5000-2000 BCE, one Future age 2100-2500 (Modern stays 1900-2100) | +2 ages | Half the content. The Dawn age is muddy (hunters and Sargon in one roster) and Modern stays long (200 turns at Normal) |
| 3 | Six ages: one ancient age, future techs folded into Modern | +1 age | Cheapest. Fixes nothing at the late end; the Modern age gets even longer in feel |

Everything below assumes Option 1. Options 2 and 3 are subsets of it, so Phase 0 (the
data-driven age registry) is the same work either way.

---

## 1. What the code does today (the facts this plan is built on)

From a survey of the codebase on 2026-10-03:

- Ages are `AGE_ORDER = ['bronze','classical','kingdoms','gunpowder','modern']` with
  `START_YEAR = -2000` and `END_YEAR = 2300` in `src/data/ages.js`. The array index is the age
  rank and many tables are keyed by id or by index.
- **There is no single age registry.** About 31 non-test files hard-code the five ids or a
  5-length table. The ones that must grow:
  - Keyed per age: `research.js` RESEARCH_AGE_BASE, `ages.js` REFERENCE_YEARS and
    GAME_SPEEDS.years, `fleets.js` NAVAL_MOVES_BY_AGE / DEEP_OK_FROM / SHELF_OK_FROM,
    `world/cities.js` BORDER_RING_BY_AGE, `colonies.js` COLONY_SLOTS_BY_AGE, `settlers.js`
    OUTPOST_SLOTS_BY_AGE, `utils/aiLogic.js`, `data/actionCosts.js` (recruit resource by age),
    `data/navalReach.js`, `data/unitClasses.js` UNIT_ROSTER, `data/unitIcons.js`,
    `data/government.js`, `data/buildings.js`, `data/greatProjects.js`, `data/resources.js`,
    `battle/data/battleStats.js` (with a second copy of AGE_ORDER), `battle/render/
    soldierFactory.js`, `closeView/townModels.js`, `battle/audio/battleAudio.js` (GUN_AGES).
  - 5-length arrays by position: `data/navalLines.js` names and cargo, `data/eraGoals.js`
    targets (a 6th age would read `undefined`), `BASE_TIER_COST` in buildings.js.
  - Literal `'modern'` checks: gameReducer.js (space actions, climate resilience, cultural
    export), resolveTurn.js (oil starvation, the Labor estate), disasters.js, supplies.js,
    satellites.js, missiles.js (MISSILE_MIN_AGE), achievements.js, DiplomacyPanel.jsx,
    ActionPanelTabs.jsx, cityPoliticsModel.js. With a Future age, "is it modern?" must become
    "is it at least modern?".
  - Literal `'bronze'` defaults (cities.js, battle.js, buildBattleSetup.js, UI) and an
    `< 'classical'` check in aiEconomy.js. With earlier ages, "the first age" is no longer
    `'bronze'`.
  - Scripts: `scripts/import-models.js` and `scripts/icons/generate-icon-data.mjs` list ages.
- **Tech tree** (`src/data/techTree.js`): five lines of 10 names, the age comes from the position
  (`AGE_ORDER[floor(i/2)]`), so 2 techs per line per age, 10 per age, 50 total. The tech age
  advances at 6 of an age's 10. Tech ids come from names, so renaming a tech breaks saves;
  **moving** a tech to another age does not.
- **Units do not store an age.** A unit is drawn and fought at its owner's effective age, so
  upgrades are automatic: Spearmen become Swordsmen when the nation advances. Stats are
  `10 + 8 x ageIndex` attack and `8 + 6 x ageIndex` defence, so inserting two ages in front
  shifts every index by 2 (balance, not saves).
- **Buildings** are saved as a **tier index per category** (`categories.food = 2`). Inserting
  tiers in front of a line shifts every saved index: the save migration must add the offset.
- **Calendar**: years per turn by age and speed; `speedCostMult` scales research, production and
  growth by REFERENCE_YEARS / years. The year text `${-year} BCE` is copy-pasted in five places.
- **Scenarios**: Dawn (-2000) plus later starts exist in `src/data/scenarios.js`, but the start
  screen never passes `start`, and `createInitialState` always uses START_YEAR, so in practice
  every game is Dawn. This gap gets fixed here (section 3.4).
- **Nations**: all 240 always exist (or are dormant in emergent mode and appear one per 50 turns).
  No founding years, no historical names.
- **Diplomacy**: no age gating anywhere. Governments have `minAgeId` and one reform tier per age.
- **Battle sim**: class stats with per-age overrides only for gunpowder and modern; powers gated
  by age in invasion.js (arrowStorm for the first three ages, artillery from gunpowder, air
  strikes in modern).
- **Art**: units are procedural by default (soldierFactory MODELS[class][age]) with optional GLB
  or recipe overrides per `{age}-{class}`. Icons are generated per age and class. Town models
  are per age in the close view. No age icons or era music exist.
- **Save**: version 8, `OLDEST_LOADABLE_SAVE_VERSION = 8`, `backfillDefaults` fills new keys
  (including new techs) from a fresh state.

---

## 2. Calendar and pacing

### 2.1 The new speed table (years per turn)

| Speed | Neo | Cities | Bronze | Classical | Kingdoms | Gunpowder | Modern | Information | Future | Turns |
|---|---|---|---|---|---|---|---|---|---|---|
| Fast | 100 | 60 | 50 | 25 | 12 | 5 | 2 | 2 | 6 | about 445 |
| Normal | 60 | 30 | 25 | 12 | 6 | 2 | 1 | 1 | 3 | about 930 |
| Marathon | 25 | 15 | 10 | 5 | 3 | 1 | 1 | 1 | 2 | about 1,670 |

Turns per age at Normal: Neolithic about 28, Age of Cities about 43, Bronze 48, Classical 108,
Kingdoms 167, Gunpowder 200, Modern 90, Information 110, Future 133.

- The ancient ages add about 70 turns at Normal; the Modern split and the 400-year Future
  together take about 67 turns off today's 400 Modern turns. A full game stays about 930 turns,
  so the existing balance targets per age keep their meaning.
- The Future runs at 3 years a turn: fewer, weightier turns, where a fusion plant or an orbital
  station is a multi-turn project, and the extra two centuries do not drag.
- `END_YEAR` becomes 2500.
- REFERENCE_YEARS (the balance anchor for speedCostMult) gets `neolithic: 80, copper: 50` and
  `information: 2, future: 6`. Calibrated with the balance-sim skill, not guessed (section 15).
- Starting at Dawn (2000 BCE) stays possible, so a player who wants today's game loses nothing.

### 2.2 The year display

- One shared `formatYear(year)` in `src/data/ages.js`, used by the five places that copy-paste
  it today (gameReducer, GameHeader, MilitaryPanel, BattleReportSheet, research.js).
- **No year 0**: 1 BCE is followed by 1 CE. Years are stored as astronomical years (0 = 1 BCE)
  internally or the display skips 0; pick one and test it (the Classical steps of 12 cross it).
- Neolithic and Age of Cities years show as "c. 4200 BCE" (circa), because nobody has exact
  dates for that period. This is cheap and reads as deliberate.
- OnboardingOverlay's hard-coded "2000 BCE to 2300 CE" reads the range from the scenario.
- `historicalPopulation.js` gets anchors back to -5000 (world population about 5 to 20 million
  at 5000 BCE, about 27 million by 2000 BCE on the usual estimates).

### 2.3 Age transitions

- Calendar age and tech age work as today: you can be up to one age ahead of the calendar, and
  research costs +30% per age behind. With short ancient ages this is a feature: a cradle
  nation can reach the Age of Cities early, which is exactly what Uruk and Egypt did.
- The "A new era dawns" banner gets a per-age illustration and one line of flavour (section 13).
- **The last age now gets scored.** Today `awardEraLegacy` only runs at an age change, so the
  final age never scores its era goals. The game-end path calls it once for the Future age.

---

## 3. Starting the world at 5000 BCE

### 3.1 The problem

At 2000 BCE every one of the 240 nations has a city. At 5000 BCE that is wrong almost
everywhere: there were farming villages in the Fertile Crescent, the Nile, the Indus, the Yellow
and Yangtze rivers and a few more, and hunter-gatherers nearly everywhere else.

### 3.2 The design: bands and hearths

- **Every nation starts as a band**: one **Band** unit (a settler that also fights weakly and can
  forage) plus one Hunters unit, standing on its capital tile. Founding the first village is
  the first decision of the game (Civ's turn-1 settle, which players already understand).
  - Settling on the historical capital tile is free and instant; settling elsewhere is allowed
    (move up to 3 tiles first). The AI settles on turn 1 or 2.
  - Until the first village exists, nothing else in the nation runs (no research, no economy).
- **Agricultural hearths** (new data file `src/data/hearths.js`): a short list of tile areas
  where farming already exists at 5000 BCE, with the crop package:
  - Fertile Crescent (iq, sy, tr, ir, il, jo, lb): wheat, barley, sheep, goats, cattle
  - Nile (eg, sd): emmer, barley, cattle
  - Yellow River and Yangtze (cn): millet, rice, pigs
  - Indus (pk, in): wheat, barley, zebu
  - Mesoamerica (mx, gt): maize, squash (late: maize is a small crop until about 3000 BCE)
  - Andes (pe, bo, ec): potato, quinoa, llama
  - New Guinea (pg): taro, banana
  - Sahel and Ethiopian highlands (ml, ne, et): sorghum, teff (late)
- Nations whose capital is inside a hearth start with **Agriculture already known** and a
  size-2 village (Egypt, Iraq, China at size 3, as the Dawn table already ranks them).
  Everyone else must research Agriculture, and its cost falls with every neighbour that has it
  (the existing `techDiffusion.js`, -6% per neighbour, up to -30%).
- **The result is emergent history**: farming spreads outward from the hearths across the map
  through the diffusion rule that already exists, at roughly the speed it spread in reality
  (it reached Britain about 4000 BCE). No scripting needed, only tuning.
- `UNPEOPLED_AT_DAWN` (about 70 islands and remote places) keep their late start: at 5000 BCE
  they begin **dormant** and appear when their era of settlement arrives (Polynesia, Iceland,
  Madagascar and so on), using `emergence.js` with a year instead of a turn interval.

### 3.3 Hunter-gatherer economy before Agriculture

- A village without Agriculture works tiles for **forage**: deer, fish, wild game and forest
  tiles give +1 food, farmland gives nothing extra. City size is capped at 3.
- Agriculture unlocks farms on flat river and grassland tiles and lifts the cap.
- Animal Husbandry unlocks pastures (cattle, sheep), reveals Horses on the map (horses become a
  real strategic gate, section 6.4) and adds +1 production on pasture tiles.
- This gives the first 20 turns real choices: settle by the river or by the herds, research
  farming or husbandry first, forage or expand.

### 3.4 Start-screen and scenario fixes (needed anyway)

- The start screen gets a **Start** picker: **Origins (5000 BCE)**, **Dawn (2000 BCE)**, and the
  later starts that already exist in scenarios.js (Classical, Kingdoms, Gunpowder, Modern),
  plus **Information (1990)** later. **Default: Origins** (decision 1) once Phase 2 ships, Dawn
  until then.
- `createInitialState` takes the year and age from the scenario (today it ignores them).
- Later starts grant the techs of every earlier age (a "historical package" per culture group,
  so a 1500 CE Japan does not start with Colonial Trade).

### 3.5 Historical names: the ancient empires (decision 2: yes)

A nation's display name follows the age, so the map reads like the ancient world: Sumer and
Kemet, the Hittites, the Kingdom of Israel, Rome, Han China. New data file
`src/data/historicalNames.js`, keyed by nation id then age id, falling back to the modern name.
The modern name is always shown in small text underneath (in the nation sheet, the diplomacy
list and the tooltip) so nobody gets lost, and a setting turns historical names off.

Rules:
- Names change at the **nation's** age (its effective age), not the calendar, so a nation that
  races ahead gets its next name early.
- Only the Neolithic, Age of Cities, Bronze, Classical and Kingdoms ages get historical names.
  From Gunpowder on, the modern name is used (with a few famous exceptions listed below, for
  example the Ottomans), because by then most modern countries already existed in some form.
- A player who conquers or unifies a famous capital does **not** take its name; names belong to
  nations, not to tiles. An event can still offer "Proclaim yourself the heir of Rome" (+prestige)
  to whoever holds Rome, Constantinople, Babylon or Jerusalem with high loyalty.
- City names: the capital (and a few famous second cities) also gets an ancient name per age
  (Ur, Memphis, Hattusa, Jerusalem, Babylon, Nineveh, Mohenjo-daro, Anyang). Extra cities use the
  culture-group name lists that cityNames.js already has.
- Nations without a famous ancient state use a people name by region in the Neolithic and Age
  of Cities ("the Danubian peoples", "the Bantu peoples", "the Jomon"), then the modern name.

The table for the main ancient empires (about 60 nations, hand-written; the rest come from the
region rule above). `il` is the Kingdom of Israel, as you asked:

| Nation (id) | Neolithic | Age of Cities | Bronze | Classical | Kingdoms |
|---|---|---|---|---|---|
| Israel (il) | Ghassulian peoples | Canaan | **Kingdom of Israel** | **Kingdom of Judah**, then Judea | Israel |
| Palestine (ps) | Ghassulian peoples | Canaan | Philistia | Philistia | Palestine |
| Lebanon (lb) | Byblos villages | Byblos | Phoenicia | Phoenicia | Lebanon |
| Syria (sy) | Halaf peoples | Ebla | Mitanni | Aram | Syria |
| Jordan (jo) | Levantine villages | Canaan | Moab | Nabataea | Jordan |
| Iraq (iq) | Ubaid peoples | **Sumer**, then Akkad | **Babylon** | Assyria, then Babylonia | Abbasid Caliphate |
| Iran (ir) | Zagros peoples | **Elam** | Elam | **Persia** (Achaemenid) | Persia |
| Turkey (tr) | Çatalhöyük peoples | Anatolian cities | **Hittite Empire** | Lydia | Seljuk Sultanate |
| Egypt (eg) | Badari peoples | **Kemet** | **Egypt** (New Kingdom) | Ptolemaic Egypt | Egypt |
| Sudan (sd) | Nile peoples | Ta-Seti | **Kush** | Meroë | Makuria |
| Ethiopia (et) | Highland peoples | Punt | D'mt | **Aksum** | Abyssinia |
| Yemen (ye) | Arabian peoples | Arabian peoples | Saba | **Saba** | Yemen |
| Saudi Arabia (sa) | Arabian peoples | Arabian peoples | Dilmun | Nabataea | Arabia |
| Bahrain (bh) | Gulf peoples | **Dilmun** | Dilmun | Tylos | Bahrain |
| Oman (om) | Gulf peoples | **Magan** | Magan | Oman | Oman |
| Armenia (am) | Shulaveri peoples | Kura-Araxes | Urartu | Armenia | Armenia |
| Georgia (ge) | Shulaveri peoples | Kura-Araxes | Colchis | Iberia (Kartli) | Georgia |
| Greece (gr) | Sesklo peoples | Aegean villages | **Mycenae** | **Hellas** | Byzantine Empire |
| Cyprus (cy) | Khirokitia peoples | Alashiya | Alashiya | Cyprus | Cyprus |
| Italy (it) | Italic villages | Remedello peoples | Villanovans | **Rome** | Italy |
| Tunisia (tn) | Capsian peoples | Libyan peoples | Libyan peoples | **Carthage** | Ifriqiya |
| Libya (ly) | Saharan peoples | Libyan peoples | Libu | Cyrenaica | Libya |
| Morocco (ma) | Maghrebi peoples | Maghrebi peoples | Mauri | Mauretania | Morocco |
| Spain (es) | Iberian villages | Los Millares | Tartessos | Hispania | Al-Andalus |
| France (fr) | Carnac peoples | Megalith builders | Celts | Gaul | Francia |
| United Kingdom (gb) | Stonehenge builders | Beaker peoples | Britons | Britannia | England |
| Germany (de) | Danubian peoples | Corded Ware peoples | Germanic tribes | Germania | Holy Roman Empire |
| Denmark (dk) | Ertebølle peoples | Funnelbeaker peoples | Nordic Bronze Age | Jutes and Danes | Denmark |
| Ukraine (ua) | Cucuteni-Trypillia | Yamnaya | Cimmerians | Scythia | Kievan Rus' |
| Russia (ru) | Forest peoples | Yamnaya | Sintashta | Sarmatia | Kievan Rus', then Muscovy |
| Kazakhstan (kz) | Botai peoples | Botai | Andronovo | Saka | Kazakh Khanate |
| Mongolia (mn) | Steppe peoples | Afanasievo | Steppe peoples | **Xiongnu** | **Mongol Empire** |
| Afghanistan (af) | Mountain peoples | Mundigak | Bactria | Bactria | Ghurids |
| Uzbekistan (uz) | Steppe peoples | Oxus peoples | Oxus civilisation | Sogdia | Khwarazm |
| Pakistan (pk) | Mehrgarh peoples | **Harappa** | Harappa | Gandhara | Delhi Sultanate |
| India (in) | Ganges peoples | Indus peoples | Vedic kingdoms | **Maurya Empire**, then Gupta | Chola |
| Sri Lanka (lk) | Balangoda peoples | Island peoples | Tambapanni | Anuradhapura | Polonnaruwa |
| China (cn) | Yangshao | Longshan | **Shang** | **Han** (Qin first) | Tang, then Song |
| Korea (kr) | Jeulmun peoples | Jeulmun peoples | Gojoseon | Goguryeo | Goryeo |
| Japan (jp) | Jōmon | Jōmon | Jōmon | Yayoi, then Yamato | Japan |
| Vietnam (vn) | Hoabinhian peoples | Phung Nguyen | Văn Lang | Âu Lạc | Đại Việt |
| Cambodia (kh) | Mekong peoples | Mekong peoples | Mekong peoples | Funan | **Khmer Empire** |
| Indonesia (id) | Island peoples | Austronesians | Austronesians | Srivijaya | Majapahit |
| Mexico (mx) | Archaic peoples | Archaic peoples | **Olmec** | Teotihuacan | **Aztec Empire** |
| Guatemala (gt) | Archaic peoples | Archaic peoples | Early Maya | **Maya** | Maya |
| Peru (pe) | Andean peoples | **Caral** (Norte Chico) | Chavín | Moche | **Inca Empire** |
| Bolivia (bo) | Andean peoples | Andean peoples | Chiripa | Tiwanaku | Tiwanaku |
| Nigeria (ng) | Forest peoples | Forest peoples | Nok | **Nok** | Ife, then Benin |
| Mali (ml) | Saharan peoples | Saharan peoples | Tichitt | Djenné-Djenno | **Mali Empire** |
| Mauritania (mr) | Saharan peoples | Saharan peoples | Tichitt | Tichitt | **Ghana Empire** |
| Zimbabwe (zw) | San peoples | San peoples | Bantu peoples | Bantu peoples | **Great Zimbabwe** |

The exact ids and spellings are checked against `geo/countries-meta.json` when the file is
written; any nation missing from this table falls back to the region rule. A few post-Kingdoms
exceptions keep a historical name in the Gunpowder age: Ottoman Empire (tr), Mughal Empire (in),
Safavid Persia (ir), Qing China (cn), Tsardom of Russia (ru).

Names are data only: no mechanics read them, so they never affect saves or balance.

### 3.6 The world of 5000 BCE (climate)

- **The Green Sahara.** Until about 3500 BCE (the end of the African Humid Period) the Sahara
  was savanna with lakes. Saharan desert tiles start as grassland and steppe and **dry out tile
  by tile between 4000 and 3000 BCE** (the "5.9 kiloyear event"), pushing people toward the
  Nile, a real driver of Egyptian civilisation. Engine: a tile-yield override table by year
  (`src/data/paleoClimate.js`) read where tile yields are computed; render: a tint layer over
  the Sahara on the globe and flat map that fades out (no new raster needed at first).
- Sea levels at 5000 BCE are within a few metres of today, so the coastline stays as it is.
  The Persian Gulf head ran further inland; ignore it (one or two tiles, not worth the cost).
- **The 4.2 kiloyear event** (about 2200 BCE): a century of drought from Mesopotamia to the
  Indus, linked to the fall of Akkad and the decline of the Indus cities. Implemented as an
  event that lowers food on arid river tiles for 4 to 6 turns; the end of the Age of Cities.

---

## 4. Age identities and signature mechanics

Each new age gets one or two systems that only matter there, so the age plays differently, not
just with renamed units.

### 4.1 Neolithic Age (5000 to 3300 BCE): settle

1. **Bands and the first village** (section 3.2).
2. **The Neolithic Revolution**: Agriculture spreading from the hearths by diffusion (3.2) and
   the forage economy (3.3).
3. **Tribal camps** (neutral, like Civ's tribal villages): about 150 small unaligned camps
   seeded on free land away from any capital. Entering one with a unit gives a choice:
   *absorb them* (+1 population to the nearest city, small opinion loss with neighbours who
   wanted them) or *trade with them* (a random tech progress boost or a map reveal around it).
   They vanish as borders grow. Deterministic placement from rngSeed.
4. **No writing**: before Proto-Writing (Age of Cities), science per turn is halved and only
   the Tribal government is available. Laws are limited to the justice and land categories
   ("customary law").
5. **Raids, not conquest** (section 9.1).
6. **Megaliths**: the Neolithic culture building is the stone circle; the only Neolithic
   wonders are monuments (section 8.3).

### 4.2 Age of Cities (3300 to 2000 BCE): organise

1. **Writing**: Proto-Writing lifts the science halving, unlocks the first science building
   (the Tablet House) and the Monarchy and Theocracy governments.
2. **The rise of cities**: river-floodplain cities get +1 food per river tile worked; the size
   cap rises with Granary and later Irrigation. The first city to reach size 8 gets a one-off
   prestige bonus and a log line ("Uruk is the largest city in the world").
3. **Unification**: a new peaceful action, **Unify** (Age of Cities only), lets a nation absorb
   a neighbouring nation's single-city remnant of the same culture group when opinion is at
   least 50 and the target is under a third of its size, the way Upper and Lower Egypt or the
   Sumerian city-states merged. Costs ADM and prestige, raises aggressive expansion only a
   little. The AI uses it too (watch for snowballing in balance-sim).
4. **Copper**: copper deposits matter (moved from Bronze, section 6). The recruit cost uses
   copper from this age on.
5. **The first treaty** (section 9.2).

### 4.3 Bronze to Gunpowder

Unchanged, except that every age table now comes from the registry.

### 4.4 Modern Age (1900 to 1990): industrialise

Keeps today's Modern content that belongs to the 20th century: oil, tanks, fighters,
destroyers, artillery, the atom (Atomic Research Center), the first satellites and the Space
Program wonder, the Labor estate, Dictatorship. Oil starvation stays here and in the
Information age.

### 4.5 Information Age (1990 to 2100): connect

1. **Precision and missiles**: Precision Guidance moves here; missiles (missiles.js), the
   satellite network (satellites.js) and the Bunker Network belong to this age.
2. **Cyber**: two new espionage options on the existing ESPIONAGE action: *cyber theft*
   (steal research progress) and *infrastructure attack* (a city's production -50% for 2 turns).
   Counter-intelligence gets a matching cyber defence. No new screen, only new options.
3. **Climate**: a global **carbon meter** (new `src/engine/climate.js`), fed each turn by every
   city's Factory, oil use and Coal or Gas plant. Above thresholds, the existing disasters.js
   rolls more droughts, floods and storms on coastal and arid tiles. The existing
   BUILD_CLIMATE_RESILIENCE action and a new **Climate Accord** (9.4) push the other way. This
   gives the late game a world-scale problem that is not just war.
4. **Globalisation**: trade agreements give +1 gold per pact for every other pact the partner
   has, capped (network effect), and Cultural Export (exists today) moves here.
5. **Drones**: the air class splits into fighters and drones (6.1); drones are cheap, fragile,
   and do not need an airbase in range.

### 4.6 Future Age (2100 to 2500): ascend

1. **Fusion**: a new **Energy** building line (8.1) ends with the Fusion Reactor, which needs
   helium-3 and removes oil dependence for the city (oil starvation no longer applies there).
   The standalone Fusion Grid action becomes this building.
2. **Orbit**: space missions (exist today) become a Future-age **Space** line: Launch Site
   (Modern), Spaceport (Information), Orbital Station and Lunar Base (Future). The Lunar Base
   produces helium-3. The final mission (the space victory) needs an Orbital Station and the
   Mars Colony wonder.
3. **Artificial minds**: a new estate, **the Synthetics** (AI systems that run the economy),
   added at the Future age like Labor is added at Modern. High influence gives big production
   and science; low loyalty gives the "automation unrest" event chain (unemployment, Luddite
   riots). A real trade-off and the Future age's politics.
4. **Future Tech**: after the last Future tech, a repeatable "Future Tech N" that adds score and
   a small science bonus, as in Civ, so research never stops mattering.
5. **Robot armies** (decision 5), see 4.7.
6. **Sea level rise**: deferred (decision 4). Not in this plan.

### 4.7 Robot armies (the second half of the Future)

The Future age is now 400 years long, so it gets two military halves instead of one:

- **2100 to about 2300: exo-armies.** Human soldiers in powered suits (the roster in 6.1).
- **About 2300 to 2500: robot armies.** Two Future techs past the base tree, **Autonomous
  Warfare** (military) and **Machine Consciousness** (science, needs Artificial Intelligence and
  Quantum Computing), turn every land and air class into its robotic version (table in 6.1).
  This is a **roster variant**: the unit keeps its class, promotions and place in the army, and
  its name, model, stats and rules change, just like units already upgrade when an age changes.
  Technically a `variant: { requiresTech, ... }` entry on the Future roster.

What makes robots play differently (real trade-offs, not only bigger numbers):
- **No manpower**: robots cost no HR to build or replace. They cost rare metals and helium-3,
  and +40% production. A small nation can field a big army, so manpower stops being the limit
  and industry takes its place.
- **Never rout**: morale does not apply. They fight to the last hit point, so battles against
  them are bloodier and longer.
- **Vulnerable to EMP and cyber**: EMP stuns robots for twice as long as vehicles, and the Cyber
  Jam power can also **turn one robot squad against its own side for 5 seconds** (a new power,
  **Hijack**, Information-age cyber tech plus Machine Consciousness).
- **No occupation**: robots cannot capture or hold cities on their own; a city taken by an
  army without at least one human (exo-infantry or support) unit gets -2 loyalty a turn. That
  keeps a reason to keep humans in the army.
- **The Synthetics estate** gains +10 influence for every 10 robot units. If its loyalty falls
  below 20, the "Machine Uprising" event chain can turn some robot units into a rebel army
  (the same civil-war machinery that civilWar.js uses). High risk, high reward.
- **Diplomacy**: the Planetary Council can vote on "Autonomous Weapons Ban" (no new robot units
  for 50 years for signers); breaking it is a big opinion hit.

Robot battlefield behaviour: perfect formation (no straggling), steady fire rate, sparks and
smoke instead of blood, a red sensor glow in the nation colour, a mechanical death animation
(collapse and power-down).

---

## 5. Technology

### 5.1 Structure

- Keep the five lines and 2 techs per line per age: **9 ages x 10 = 90 techs** (40 new).
- `buildLine` stops computing the age from the position. Each line becomes an explicit list of
  `{ name, age }` so moving a tech between ages is a data edit.
- **Existing tech names do not change** (ids come from names; saves keep working). Some techs
  move to a new age, which is safe.
- The tech-age threshold stays 6 of 10.
- Research cost: `RESEARCH_AGE_BASE` gets `neolithic: 8, copper: 14` and `information: 360,
  future: 480`, then fitted with balance-sim so a typical nation finishes about 7 of 10 per age
  on time (the rule the research plan already uses).

### 5.2 The full tree (new techs in bold, moved techs marked "moved")

**Military**
| Age | Tech 1 | Tech 2 |
|---|---|---|
| Neolithic | **Hunting Bands** | **Archery** |
| Age of Cities | **Copper Working** | **Battle Wagons** (needs The Wheel) |
| Bronze | Bronze Casting | Composite Bow |
| Classical | Iron Weapons | Siege Engineering |
| Kingdoms | Feudal Levies | Plate Armor |
| Gunpowder | Gunpowder Weapons | Standing Armies |
| Modern | Mechanized Warfare | **Combined Arms** (needs Flight) |
| Information | Precision Guidance (moved) | **Unmanned Systems** |
| Future | **Powered Exoskeletons** | **Directed Energy** |

**Economy**
| Age | Tech 1 | Tech 2 |
|---|---|---|
| Neolithic | **Agriculture** | **Animal Husbandry** |
| Age of Cities | **The Plough** | **Barter Networks** |
| Bronze | Bronze Trade Routes | Granary Storage |
| Classical | Minted Coinage | Silk Road Trade |
| Kingdoms | Guild Charters | Banking Houses |
| Gunpowder | Joint-Stock Companies | Colonial Trade |
| Modern | Industrial Capital | **Mass Production** |
| Information | Global Markets (moved) | **Digital Economy** |
| Future | **Automated Industry** | **Post-Scarcity Fabrication** |

**Infrastructure**
| Age | Tech 1 | Tech 2 |
|---|---|---|
| Neolithic | **Pottery** | **Megalith Building** |
| Age of Cities | **The Wheel** | **Sailing** |
| Bronze | Irrigation Canals | Mudbrick Roads |
| Classical | Paved Roads | Aqueducts |
| Kingdoms | Stone Bridges | Postal Relay |
| Gunpowder | Canal Locks | Turnpike Roads |
| Modern | Rail Networks | Highway Systems |
| Information | **Telecom Networks** | **Smart Grids** |
| Future | **Fusion Power** | **Orbital Infrastructure** |

**Governance**
| Age | Tech 1 | Tech 2 |
|---|---|---|
| Neolithic | **Kinship Ties** | **Chiefdoms** |
| Age of Cities | **Temple Economy** | **Sacred Kingship** |
| Bronze | Code of Laws | Scribal Bureaucracy |
| Classical | Civic Assemblies | Provincial Administration |
| Kingdoms | Feudal Charters | Royal Chancery |
| Gunpowder | Bureaucratic Reform | Constitutional Law |
| Modern | Civil Service | **Mass Politics** |
| Information | Digital Administration (moved) | **Global Institutions** |
| Future | **Algorithmic Governance** | **Planetary Federation** |

**Science**
| Age | Tech 1 | Tech 2 |
|---|---|---|
| Neolithic | **Herbal Lore** | **Star Lore** |
| Age of Cities | **Proto-Writing** | **Calendars** |
| Bronze | Cuneiform Records | Early Astronomy |
| Classical | Geometry | Natural Philosophy |
| Kingdoms | Scholastic Method | Optics |
| Gunpowder | Scientific Method | Calculus |
| Modern | **Nuclear Physics** | Computing |
| Information | Genomics (moved) | **Artificial Intelligence** |
| Future | **Quantum Computing** | **Synthetic Biology** |

Plus two late Future techs past the base tree, **Autonomous Warfare** (military, needs Powered
Exoskeletons and Artificial Intelligence) and **Machine Consciousness** (science, needs Quantum
Computing), which unlock the robot armies (4.7) and are not counted for the tech-age threshold,
and the repeatable **Future Tech** after them.

A known compromise: Irrigation Canals (really about 6000 BCE) stays in the Bronze Age, because
moving it would leave a Bronze slot empty and its name gates plantations. The Age of Cities gets
"The Plough" and river-farm bonuses instead, so the fantasy is covered.

### 5.3 Cross prerequisites (the web, C3)

New entries for `CROSS_PREREQUISITES`:
- Battle Wagons needs The Wheel. Sailing needs Pottery (sealed jars, trade). Sacred Kingship
  needs Proto-Writing. The Plough needs Animal Husbandry. Copper Working needs Megalith
  Building (stone-working and kilns). Bronze Casting needs Copper Working and Barter Networks
  (tin is traded). Code of Laws needs Proto-Writing.
- Combined Arms needs Industrial Capital. Nuclear Physics needs Calculus. Unmanned Systems
  needs Computing. Smart Grids needs Computing. Artificial Intelligence needs Computing and
  Digital Economy. Powered Exoskeletons needs Artificial Intelligence. Directed Energy needs
  Fusion Power. Fusion Power needs Nuclear Physics. Orbital Infrastructure needs Combined Arms
  (rocketry). Planetary Federation needs Global Institutions. Post-Scarcity Fabrication needs
  Synthetic Biology.

### 5.4 Effects of the new techs (TECH_EFFECTS hooks that exist today)

| Tech | Effect |
|---|---|
| Agriculture | farms; size cap lifted; popGrowthBonus 0.002 |
| Animal Husbandry | pastures; reveals Horses |
| Hunting Bands | unlocks Hunters; +10% hrMult |
| Archery | +25% ranged attack for Hunters |
| Pottery | Storage Pits building; +10% food stored (granary carry-over) |
| Megalith Building | Stone Circle building; quarries |
| Kinship Ties | +1 loyalty in every city |
| Chiefdoms | +1 ADM; governingCapacity +5 |
| Herbal Lore | +10% popGrowthBonus |
| Star Lore | +1 DIP (navigation and calendar shared with neighbours) |
| Copper Working | mines; Copper Mine extraction; unlocks copper armies |
| Battle Wagons | cavalry class in the Age of Cities |
| The Plough | +1 food on farms |
| Barter Networks | trade agreements; goldMult 0.10 |
| The Wheel | supplyRange 1; Road Post |
| Sailing | coastal sailing (SHELF_OK_FROM moves to here); fishing boats |
| Temple Economy | Theocracy; +1 ADM |
| Sacred Kingship | Monarchy; milBonus 1 |
| Proto-Writing | lifts the no-writing halving; Tablet House; techPointsMult 0.10 |
| Calendars | +1 DIP; food +5% (planting seasons) |
| Combined Arms | air class (fighters); milBonus 1 |
| Mass Production | productionIncome +15%; stabilityBonus -0.5 |
| Mass Politics | dipBonus 1; Labor estate influence +10 |
| Nuclear Physics | Atomic Research Center; nuclear power plant |
| Unmanned Systems | drones; airPower without airbase |
| Digital Economy | goldMult 0.15; Tech Hub building |
| Telecom Networks | dipBonus 1; espionage cyber options |
| Smart Grids | Power Grid tier; carbon -20% from cities |
| Global Institutions | World Congress (9.4); dipBonus 1 |
| Artificial Intelligence | techPointsMult 0.25; researchCost -0.10 |
| Powered Exoskeletons | Exo-Infantry; hrMult -0.2 (fewer, stronger soldiers) |
| Directed Energy | lasers: support class becomes point defence; Shield Dome |
| Automated Industry | productionIncome +25%; adds the Synthetics estate |
| Post-Scarcity Fabrication | goldMult 0.25; stabilityBonus 1 |
| Fusion Power | Fusion Reactor; oil dependence ends with it |
| Orbital Infrastructure | Orbital Station; helium-3 from the Lunar Base |
| Algorithmic Governance | admBonus 2; developmentCost -0.25 |
| Planetary Federation | Planetary Council (9.5) |
| Quantum Computing | techPointsMult 0.30 |
| Synthetic Biology | popGrowthBonus 0.003; Synthesis Vats |

Numbers are first guesses for the balance-sim to tune.

### 5.5 Boosts (Eurekas, 40%) for the new techs

Every new tech gets a `BOOSTS` entry built on facts `nationFacts` already gathers, plus four new
facts (marked *):
- Agriculture: work a river tile. Animal Husbandry: own a cattle or sheep tile. Hunting Bands:
  win a battle. Archery: own a deer tile. Pottery: reach city size 2. Megalith Building: own a
  stone tile. Kinship Ties: have 2 cities. Chiefdoms: have 3 cities. Herbal Lore: own a forest
  tile. Star Lore: own a coastal city.
- Copper Working: own a copper deposit. Battle Wagons: own horses or own a road. The Plough:
  have 4 farms*. Barter Networks: meet 3 nations*. The Wheel: own a flat (non-hill) tile next to
  your capital. Sailing: own 2 coastal cities. Temple Economy: build a Shrine. Sacred Kingship:
  win a war*. Proto-Writing: own a city of size 5. Calendars: research Star Lore and own a river.
- Information and Future techs: trade pacts 5 (Digital Economy), 10 Research Labs (Artificial
  Intelligence), own uranium (Nuclear Physics), complete a space mission (Orbital
  Infrastructure), sign a Climate Accord* (Smart Grids), win a battle with drones (Unmanned
  Systems), and so on. Each new fact is a small addition to `engine/boosts.js`.

### 5.6 Research UI

- researchView.js already lays out one column band per AGE_ORDER entry; it will show nine. On a
  phone (844x390) the tree scrolls sideways; add an **age jump strip** at the top (nine small
  age icons, tap to scroll) so nobody swipes through 90 techs.
- Past ages collapse to a single thin column by default ("Neolithic: 10 of 10") to keep the tree
  readable late in the game.

---

## 6. Units

### 6.1 The roster (one unit per class per age, as today)

| Age | Infantry | Cavalry | Ranged | Siege | Naval (warship) | Support | Air |
|---|---|---|---|---|---|---|---|
| **Neolithic** | **Warband** (stone axes, clubs) | none | **Hunters** (bows, slings) | none | **Dugout Canoes** (transport line only) | **Shaman** (morale aura) | none |
| **Age of Cities** | **Mace Bearers** (copper maces, axes) | **Battle Wagons** (onager-drawn, slow charge) | **Slingers** | **Ladder Crews** (walls only) | **Reed Ships** | **Donkey Train** | none |
| Bronze | Spearmen | Chariots | Archers | Battering Ram | War Galley | Baggage Train | none |
| Classical | Swordsmen | Heavy Cavalry | Composite Archers | Ballista | Trireme | Engineers | none |
| Kingdoms | Pikemen | Knights | Longbowmen | Trebuchet | Longship | Pioneers | none |
| Gunpowder | Musketeers | Dragoons | Riflemen | Field Cannon | Frigate | Sappers | none |
| **Modern** (renamed) | **Infantry** | Tanks | **Machine Gun Teams** | Artillery | Destroyer | **AA Guns** | **Fighters** |
| **Information** | Mechanized Infantry (moved) | **Main Battle Tanks** | ATGM Teams (moved) | **Rocket Artillery** | **Missile Cruiser** | **SAM Battery** | **Drones** + **Stealth Fighters** |
| **Future** | **Exo-Infantry** | **Hover Tanks** | **Railgun Teams** | **Plasma Artillery** | **Railgun Cruiser** | **Shield Projector** | **Drone Swarm** |

**Robotic variants (late Future, after Autonomous Warfare, section 4.7)**

| Class | Robotic unit | Notes |
|---|---|---|
| Infantry | **Combat Androids** | humanoid, steady, no morale |
| Cavalry | **Mech Walkers** | four-legged assault walkers, ignore rough terrain |
| Ranged | **Sentinel Drones** (ground) | tracked gun platforms, long range |
| Siege | **Siege Automatons** | walking artillery, splash |
| Support | **Repair Swarm** | heals robots in range instead of a supply aura; shield like the Shield Projector |
| Air | **Autonomous Hunter-Killers** | fast, many, fragile |
| Naval | **Autonomous Warships** | crewless, no morale |

Robot power is Future power +8 (72), cost +40% production, zero manpower.

Notes:
- Existing unit names that move keep their names; "Mechanized Infantry" and "ATGM Teams" now
  appear in the Information age where they belong, and Modern gets 20th-century names.
- Neolithic has no cavalry (horses were not ridden yet) and no siege (there were few walls).
  `getAvailableClasses(age)` already gates classes by age; it gains these entries.
- Age of Cities cavalry is the Sumerian battle wagon (Standard of Ur): it charges but is slow,
  so it is a shock unit, not a raider. Chariots in the Bronze Age are the fast version.
- Ladder Crews: structureBonus against walls, no splash, no use in the open. Cheap.
- The **Band** unit (Neolithic only) is a settler that can fight at half infantry strength.
- The Fighter and Drone split in the Information age: drones are 40% of a fighter's cost,
  half its strength, and ignore the airbase range rule.

### 6.2 Stats

- Replace the `10 + 8 x ageIndex` formula with an explicit `power` per age in the registry:
  neolithic 6, copper 9, bronze 10, classical 18, kingdoms 26, gunpowder 34, modern 42,
  information 52, future 64 (attack; defence on the same curve). Bronze through Modern keep
  their current numbers exactly, so today's balance is untouched; the new ages sit around them.
- Production cost: `40 x (1 + 0.6 x ageIndex)` also moves to an explicit per-age cost so the
  ancient units are cheap (Warband 25, Mace Bearers 32) and the Bronze numbers do not change.
- Recruit resource by age (`actionCosts.js`): Neolithic none, Age of Cities copper 3, Bronze
  and Classical copper 5 (or tin, 6.3), Kingdoms and Gunpowder iron 8, Modern oil 10,
  Information oil 8 plus rare metals 2 for tanks and drones, Future helium-3 2 plus rare
  metals 4 (oil no longer needed).

### 6.3 Strategic resources

| Resource | From age | Source | Used for |
|---|---|---|---|
| (none) | Neolithic | | stone weapons need nothing |
| Copper | Age of Cities (moved from Bronze) | deposits.js | recruits, Copper Mine |
| Tin | deferred (decision 4) | | not in this plan |
| Horses | Neolithic (revealed by Animal Husbandry) | tile resource | cavalry from the Bronze Age needs a horse tile or a trade pact with someone who has one |
| Iron | Classical | as today | |
| Coal | Gunpowder | tile resource (exists) | Factory and Coal Plant |
| Oil | Modern | as today | |
| Uranium | Modern | tile resource (exists) | Nuclear Plant, nuclear strikes |
| Rare metals | Information (moved from space missions to tile deposits) | new deposits | tanks, drones, Tech Hub |
| Helium-3 | Future | Lunar Base | Fusion Reactor, Future recruits |

Tin is deferred (decision 4).

### 6.4 Fleets

- `navalLines.js` `names[]` and `cargo[]` become maps keyed by age id.
- Warship (opens in the Age of Cities): Reed Ships, War Galley, Trireme, Cog, Frigate, Destroyer, Missile Cruiser, Railgun Cruiser.
- Transport: Dugout Canoes (cargo 1, coast only, Neolithic), Reed Ships (cargo 2), then as
  today, then Landing Ship (Modern), Amphibious Assault Ship (Information), Hover Transport
  (Future, may cross one land tile to the beach).
- Raider: opens in the Age of Cities (Sea Raiders), then as today, Submarine (Modern), Attack
  Submarine (Information), Stealth Submersible (Future).
- Carrier: Modern, Supercarrier (Information, 3 air units), Orbital Carrier is not a ship (skip).
- Movement by age: Neolithic 3, Age of Cities 4, then as today, Information 12, Future 14.
  SHELF_OK_FROM moves to the Age of Cities via Sailing (Polynesian-style deep crossings stay a
  Gunpowder thing, except for nations with the Pacific culture group who get it early: a nod to
  the Lapita voyages and it lets the Pacific islands emerge on time).

---

## 7. Tactical battles

### 7.1 Per-age behaviour (`AGE_OVERRIDES` in battleStats.js)

- **Neolithic**: no formations. Warbands have low morale and rout early but take fewer
  casualties when routing (ritual and raid warfare: battles end in flight, not slaughter).
  Hunters have short range (5) and fire fast. No walls on the map, only an earthwork ditch and
  palisade ring. Shield Wall is unavailable; Ambush gets +25%.
- **Age of Cities**: Mace Bearers get a small armour bonus against ranged (leather and copper
  helmets). Battle Wagons charge with a big bonus but turn slowly (a new `turnRate` stat, the
  only sim addition for this age). Slingers have range 6 and a small splash against massed
  infantry.
- **Modern**: as today's Modern, with Machine Gun Teams getting suppression (a target's attack
  speed -30% while under fire, a new `suppress` flag).
- **Information**: today's Modern stats plus precision: artillery and ATGM first shot gets +50%
  accuracy against vehicles, drones are many small flying squads with low HP.
- **Future**: **shields** (a new `shield` value: a regenerating HP layer that recovers 5% a
  second out of combat, implemented in fixed point like everything else in sim/), hover tanks
  ignore rough terrain cost, railguns pierce (hit the squad behind the target for 30%),
  Shield Projectors give nearby allies +50% shield. Directed-energy shots are instant (no
  projectile travel), so the renderer draws a beam.
- All new flags go through the existing deterministic 20 Hz integer sim; no floats, no
  Math.random. Battle-lab parity checks cover each age.

### 7.2 Powers by age (invasion.js)

| Age | Powers available |
|---|---|
| Neolithic | War Cry (rallyCry), Ambush |
| Age of Cities | War Cry, Arrow Storm |
| Bronze to Kingdoms | as today (Arrow Storm) |
| Gunpowder | as today (Artillery Barrage) |
| Modern | Artillery Barrage, Air Strike, Nuclear Strike (needs uranium and Nuclear Physics) |
| Information | Air Strike, Missiles, Satellite Sweep, **Cyber Jam** (enemy orders delayed 3 seconds), **Drone Strike** |
| Future | **Orbital Strike** (big splash, long cooldown), **EMP** (vehicles and air stop for 5 seconds, robots for 10), Satellite Sweep, **Hijack** (late Future: one enemy robot squad fights for you for 5 seconds) |

### 7.3 Battlefields

- Neolithic maps: no roads, more forest, a village of round huts or a longhouse cluster as the
  "town" structure, earthwork ring instead of walls.
- Age of Cities: mudbrick walls (fortLevel 1), a temple platform in the town.
- Future: domes, landing pads, shield pylons as the town structures; the tile context
  (tileContext.js) still decides terrain.

### 7.4 Auto-resolve parity

`getRosterCombatMultiplier` compares infantry power between the two sides; with the explicit
power curve (6.2) a Neolithic warband against Bronze spearmen is about 0.6, against Future
exo-infantry hopeless, as intended. Battle-lab parity runs per age pair for adjacent ages.

---

## 8. Buildings and wonders

### 8.1 Building lines (new tiers in bold)

| Line | Neolithic | Age of Cities | Bronze to Gunpowder | Modern | Information | Future |
|---|---|---|---|---|---|---|
| Food | **Storage Pits** (tier 0, Pottery) | Granary (moves here, no tech) | as today | Mechanized Farm | **Vertical Farm** | **Synthesis Vats** |
| Economy | none | **Trading Post** (Barter Networks) | Market, Bazaar, Bank | Stock Exchange | **Tech Hub** | **Fabrication Hub** |
| Military | **Warrior Lodge** (tier 0) | Barracks | Drill Yard, Military Academy | War College | **Simulation Center** | **Exo Armory** |
| Defense | **Earthwork Ditch** (tier 0) | Palisade (now Mudbrick Walls in this age's art) | Stone Walls, Star Fort | **Trench Lines** | Bunker Network | **Shield Dome** |
| Science | none | **Tablet House** (Proto-Writing) | Library, Scriptorium, University | Research Lab | **Supercomputer Center** | **Quantum Lab** |
| Industry | none | none | Workshop, Manufactory | Factory | **Automated Plant** | **Nanoforge** |
| Culture | **Stone Circle** (tier 0, Megalith Building) | Shrine | Temple, Cathedral | Civic Center | **Media Center** | **Habitat Commons** |
| Naval | **Canoe Landing** | **Reed Quay** (Sailing) | Harbor, Shipyard, Naval Base | Carrier Dock | **Drone Port** | **Submersible Pens** |
| Logistics | **Trail Cairns** (tier 0) | Road Post (The Wheel) | Highway | Rail Depot | **Logistics Hub** | **Maglev Terminal** |
| **Energy** NEW | | | **Coal Plant** (Gunpowder, Calculus) | **Oil Plant**, **Nuclear Plant** | **Power Grid** (Smart Grids) | **Fusion Reactor** (helium-3) |
| **Space** NEW | | | | **Launch Site** | **Spaceport** | **Orbital Station**, **Lunar Base** |

- Energy: each tier adds production to the city and carbon to the climate meter (Coal most,
  Fusion none). Gives the Factory line a partner and a real climate trade-off.
- Space: replaces the standalone space mission actions with buildings that gate them. The
  existing SpacePanel reads them. One Spaceport per nation, like a national project.
- **Save safety**: buildings are saved as tier indexes, so the v9 migration adds +1 to every
  saved tier in lines that gained a Neolithic tier 0 (food, military, defense, culture,
  logistics, naval with two). Tested with a v8 fixture.
- `BASE_TIER_COST` becomes a per-line cost list (lines now differ in length: 4 to 9 tiers).
- **Slots**: BUILDING_SLOTS_CAP 6 stays; with 11 lines that is a sharper choice, which is good.
  Revisit after balance-sim.

### 8.2 District and town look

Town models per age in the close view (`townModels.js`): Neolithic round huts and longhouses,
Age of Cities mudbrick blocks and a ziggurat, Modern brick and concrete, Information glass
towers, Future arcologies and domes. See section 13.

### 8.3 Wonders (three per age, as today)

| Age | Wonder | Effect (tier 3) | Site rule |
|---|---|---|---|
| Neolithic | **Stonehenge** | +2 science, Star Lore free | flat, not desert |
| Neolithic | **Çatalhöyük** (the Great Settlement) | +1 size cap in all cities | river or lake |
| Neolithic | **Walls of Jericho** | capital fortLevel +2, -50% siege damage | capital |
| Age of Cities | **White Temple of Uruk** | +2 ADM, clergy loyalty +15 | river |
| Age of Cities | **Great Bath of Mohenjo-daro** | +20% growth, -1 unrest in all cities | river |
| Age of Cities | **Epic of Gilgamesh** (a "great work") | +25% prestige, +1 DIP | Tablet House |
| Bronze | Pyramids, Hanging Gardens, Great Wall | as today | |
| ... | as today | | |
| Modern | Space Program, International Exchange, Atomic Research Center | as today | |
| Information | **The World Wide Web** | +1 trade per pact for every nation, double for you | Research Lab |
| Information | **Large Hadron Collider** | +30% science | Supercomputer Center |
| Information | **Global Seed Vault** | immune to famine and climate food losses | cold tile |
| Future | **Space Elevator** | space missions -50% cost | equator, Spaceport |
| Future | **Mars Colony** | needed for the space victory, +3 to all yields in capital | Orbital Station |
| Future | **Arcology Prime** | +5 size cap in the city, no unrest there | size 20 city |

Optional later: move the Pyramids to the Age of Cities (Giza is about 2560 BCE) and give the
Bronze Age the Palace of Knossos instead. Safe for saves (wonder ids stay), but only worth it if
the Age of Cities wonders feel thin in playtests.

---

## 9. Diplomacy by age

Today no diplomatic action is age gated. Add a `minAge` (and optional `maxAge`) field to the
action definitions in types.js and a single check in gameReducer and the AI's action picker.

### 9.1 Neolithic: contact, gifts and raids
- **Contact**: you can only do diplomacy with nations you have met (sight touched their tile
  once; the fog system already tracks sight). Unmet nations show as "unknown peoples". From the
  Age of Cities on, everyone you border is met automatically.
- **Gift Exchange** instead of trade agreements: a one-off gift of food or gold for opinion.
- **Intermarriage** (the existing marriage action) works from the start.
- **Raid** instead of full war: the war goal is loot (food and gold from the target's tiles)
  and captives (+1 population to your nearest city per won battle, -1 to theirs). **Cities
  cannot be annexed** before Chiefdoms; a beaten village can be made to pay tribute (the
  existing tribute demand) or razed if size 1.
- Truces are counted in years, not turns, from this age on (50 years), because a 10-turn truce
  at 60 years a turn would last 600 years.

### 9.2 Age of Cities: tribute and the first treaties
- Full war and conquest from Chiefdoms on.
- **Border Stele** (the first treaty, after Lagash and Umma about 2550 BCE): a treaty that fixes
  the border between two nations for 100 years; breaking it is a big opinion hit with everyone.
- Trade agreements open with Barter Networks; vassals open with Sacred Kingship ("king of kings").
- **Unify** (section 4.2).

### 9.3 Bronze to Modern
As today.

### 9.4 Information: institutions
- **World Congress** (Global Institutions): every 10 turns, a vote on one resolution from a
  short list (sanctions on a nation, a climate target, a ban on nuclear weapons, a trade
  standard). Votes weighted by trade pacts and allies. Winning a majority of resolutions in a
  row feeds the existing diplomatic victory.
- **Sanctions**: a new action, cuts a target's trade income with all signers.
- **Climate Accord**: a multi-nation pact that lowers carbon per city and gives opinion; leaving
  it costs opinion.
- **Cyber espionage** (section 4.5).

### 9.5 Future: the Planetary Council
- The World Congress becomes the Planetary Council (Planetary Federation tech): resolutions
  can include "orbital demilitarisation" (no Orbital Strike for 50 years), "AI limits"
  (caps the Synthetics estate), and "shared Mars" (anyone can join the Mars Colony).
- A new victory: **Planetary Union**, hold the Council presidency (most votes) for 25 turns in
  the Future age. Or fold it into the existing diplomatic victory; simpler, recommended.

### 9.6 Opinion
New opinion reasons in `data/opinion.js`: *met recently* (+5, fades), *raided us* (-15 per raid,
fades), *broke the border stele* (-40 with everyone), *sanctioned us* (-25), *same accord* (+15).

---

## 10. Government, laws, estates

### 10.1 Governments

| Government | Available from (minAgeId) |
|---|---|
| Tribal Council | **Neolithic** (was Bronze) |
| Monarchy | **Age of Cities** (was Bronze), needs Sacred Kingship |
| Theocracy | **Age of Cities** (was Bronze), needs Temple Economy |
| Republic | Classical (unchanged) |
| Dictatorship | Modern (unchanged) |
| **Technocracy** NEW | Information, needs Artificial Intelligence |
| **Corporate State** NEW | Future, needs Automated Industry |

**Save note**: a v8 save is always at 2000 BCE or later, so a Monarchy in a v8 save is legal
under the new rules. No migration needed.

### 10.2 New reform tiers (one per government per new age)
- Tribal, Neolithic: **Council of Elders** (+1 loyalty, +10% growth) or **Big Man** (+20%
  manpower, -1 loyalty).
- Tribal, Age of Cities: **Chiefdom Confederacy** (+10 governing capacity).
- Monarchy, Age of Cities: **City-King** (+1 ADM) or **Warlord King** (+1 MIL, raids loot +50%).
- Theocracy, Age of Cities: **Temple City** (+15% science, clergy +10).
- Every government, Information: one reform each, for example Republic **Digital Democracy**
  (+2 DIP, -1 unrest), Dictatorship **Surveillance State** (+50% counter-intelligence, +2
  unrest), Monarchy **Ceremonial Crown** (+1 stability, +10% tax).
- Every government, Future: for example Republic **Direct Democracy** (laws cost nothing, but
  a random law vote each 10 turns), Technocracy **AI Stewardship** (+3 ADM, Synthetics estate
  influence +20), Corporate State **Charter Cities** (+30% gold, -15 loyalty in non-capital
  cities).

### 10.3 Laws
- Neolithic: only "customary" tiers of justice and land laws.
- Each law category gets an Information tier (privacy, data, renewables) and a Future tier
  where it makes sense (for example justice: "predictive policing", +stability, -loyalty).
  Gated by `requiresTech` like today.

### 10.4 Estates
- Neolithic and Age of Cities: clergy reads as **Shamans and Priests**, nobility as **Warrior
  Elite**; burghers are absent until Barter Networks (they appear as **Merchants**). Names per
  age only; the mechanics are the same estates.
- Modern: Labor (as today).
- Future: **Synthetics** (section 4.6).

---

## 11. AI

- `aiLogic.js` per-age tables gain the four ages (recruit pacing, war appetite).
- **Neolithic AI**: settles turn 1 or 2, researches Agriculture first unless in a hearth, raids
  only when it outnumbers a neighbour 2 to 1, never more than one raid at a time. Tier-1 AI
  rule stays (the quiet world).
- **Age of Cities AI**: uses Unify when eligible, conquers small neighbours when strong.
  Balance-sim must show no runaway (target: no nation above 12 cities by 2000 BCE at Normal).
- **aiProduction.js**: today the AI only builds infantry from cities. Neolithic AI builds
  Warbands and Hunters (ranged), the Age of Cities adds Battle Wagons. A cheap fix that also
  improves later ages: build one ranged unit per three infantry.
- Research doctrine priorities include the new techs (agriculture-first for growth doctrines,
  bronze-rush for war doctrines).
- Information and Future AI: builds Energy and Space lines, joins Climate Accords when its
  doctrine is not industrial, votes in the World Congress by opinion.
- `aiEconomy.js` `< 'classical'` style checks become rank comparisons through the registry.

---

## 12. Events

`src/data/events.js` today starts at -1850. New historical events (one per turn at most, as
today), each with a choice:

**Neolithic and Age of Cities**
- **The Sahara dries** (about 3800 BCE, African nations): migrate toward rivers (+pop to river
  cities, lose Saharan yields) or stay (keep tiles, -growth).
- **The domestication of the horse** (about 3500 BCE, steppe nations: kz, ua, ru, mn):
  first access to horses.
- **The invention of the wheel** (about 3400 BCE, boost to The Wheel for nations near iq/ua).
- **The first writing** (about 3200 BCE, Sumer and Egypt): boost to Proto-Writing.
- **The unification of Egypt** (about 3100 BCE, Egypt): absorb a free city or a neighbour
  remnant at no AE.
- **The Uruk expansion** (about 3500 BCE, Iraq): trade colonies, +gold, -opinion with
  neighbours.
- **The great migrations** (about 3000 BCE, steppe nations): a dormant nation emerges near you,
  or you gain population.
- **Sargon of Akkad** (2334 BCE, Iraq): a conqueror ruler with a big MIL bonus and high unrest.
  (Falls inside the Bronze Age at Origins pacing only if the Age of Cities ends late; keep it
  gated by year, not age.)
- **The 4.2 kiloyear drought** (about 2200 BCE, arid river nations, section 3.6).
- Procedural events for the ancient ages: a good harvest, a sickness in the herds, a comet, a
  river shifts its course, a shaman's prophecy.

**Information and Future** (generic, never about real living people or current politics)
- A global financial crisis, a pandemic (with a quarantine choice), the first fusion ignition,
  the first general AI, the first crewed Mars landing, an asteroid scare (a joint defence
  project), a solar storm (disables satellites), a climate tipping point (if the carbon meter
  is high), automation riots (Synthetics chain).

---

## 13. Art, audio and presentation

### 13.1 Units
- **Procedural first** (soldierFactory MODELS[class][age]): every new (age, class) pair gets a
  procedural model, so the game is playable before any GLB exists. Visual keys:
  - Neolithic: hide and fur clothing, no helmets, stone axes and clubs, short bows, body paint
    in the nation colour, a totem instead of a banner. Shaman: staff, antler headdress.
  - Age of Cities: kilt-like fleece skirts (Sumerian kaunakes), copper helmets, tall rectangular
    shields, maces; battle wagons with four solid wheels and two onagers.
  - Modern: 20th-century helmets and rifles, olive drab, early tanks, propeller fighters.
  - Information: today's Modern look (plate carriers, MBTs), plus quadcopter drones.
  - Future: smooth exo-suits with glowing seams in the nation colour, hover tanks, drone swarms,
    shield bubbles as translucent spheres.
- **GLB and recipes**: `scripts/import-models.js` SLOTS and the AGES list read the registry;
  new slot kinds: *wagon* (Battle Wagons, like chariot with four wheels), *hover* (hover tanks,
  like vehicle without wheels), *drone* (air, small).
- **Art brief**: extend `plans/unit-art-brief.md` with the new 28 battlefield units and 8
  ships, and add two animation archetypes: J (shaman and support casting) and K (hovering).
  The brief's style (AoE4-like realism) still applies; the Future age gets a short visual
  language section so it reads as plausible, not cartoon sci-fi.
- **Icons**: `scripts/icons/generate-icon-data.mjs` gains paths for every new (age, class), from
  game-icons.net (CC-BY) like today: stone-axe, sling, wagon, drone, mech, laser, shield.

### 13.2 Towns, buildings, wonders
- Town models per age in the close view (8.2).
- Building icons (`buildingIcons.js`) for about 30 new tiers and two new lines.
- Wonder models: 12 new wonders. Start with an icon and a simple procedural landmark (circle of
  stones, ziggurat, dome) and upgrade later; the J3 log already lists wonder models as open,
  so do them together.

### 13.3 The map
- The Green Sahara tint (3.6) and an optional "night lights" layer for the Information and
  Future ages on the globe (city glow by size), cheap and very readable.
- Future age: a thin orbital ring around the globe once the first Orbital Station exists, and a
  small Moon marker for the Lunar Base. Pure presentation, high delight.

### 13.4 UI theming
- **Age icons**: `plans/art-image-spec.md` asks for five; make nine (hand axe, copper ingot or
  ziggurat, chariot wheel, column, castle, cannon, gear, circuit, orbit).
- **Top bar accent per age**: a thin ornament strip under GameHeader in the age's colour and
  pattern (Neolithic: ochre zigzag, Cities: lapis and gold, Future: cyan grid). CSS only,
  one class per age on `<html data-age>`, like `data-layout`.
- **Age advance banner**: a full-width illustration per age (nine images, can start as
  stylised gradients with the age icon).
- Phone check at 844x390 for every new panel: the age jump strip, the Start picker, the World
  Congress sheet, the climate meter chip.

### 13.5 Audio
- `battleAudio.js` GUN_AGES becomes a weapon family per age: *stone* (thuds, shouts),
  *bronze* (clash, today's bow), *gun* (today), *energy* (lasers, shield hum, railgun crack).
  CC0 sound packs, same import path.
- Optional era music: one ambient loop per age (CC0 or commissioned), crossfading at the age
  change. Off by default on phones to save data.

### 13.6 Text and tutorial
- Onboarding and tutorial.js start from the Band and the first village when the start is
  Origins: "Settle", "Research Agriculture", "Meet your neighbours", "Build a Stone Circle".
- The help text for each age (one paragraph each, shown in the age banner and the Legacy panel).

---

## 14. Era goals, victory and score

- `PLAYSTYLES` targets become maps keyed by age id, with nine values each:
  - expand (cities): 1, 3, 4, 6, 9, 12, 16, 20, 24
  - wealth (trade agreements): 0, 1, 1, 2, 3, 4, 5, 6, 8
  - war (cities taken): 0 (raids won: 2), 1, 1, 2, 3, 4, 5, 6, 6
  - culture (wonders): 1, 1, 1, 2, 3, 4, 5, 6, 7
  - science (techs): 3, 6, then today's 4, 8, 14, 20, 28, then 36, 44 (if today's counts are
    totals rather than per age, the Bronze-onward values rise by the 20 ancient techs; check
    `eraGoalProgress` and set from balance-sim)
  (The Neolithic war goal counts won raids, since cities cannot be taken yet.)
- The last age gets scored at game end (2.3).
- **Victory**: Space Ascendancy needs the Mars Colony (Future); the score ending moves to 2500;
  the other victories are unchanged. Score adds Future Tech x 15 like any tech.
- **Achievements**: "First Farmer" (Agriculture first in the world), "Cradle of Civilisation"
  (first city of size 8), "Scribe" (first to Proto-Writing), "Ascended" (space victory).
- A test (`endgameReachability.test.js` exists) proves every victory is still reachable.

---

## 15. Balance and testing

### 15.1 Calibration targets (balance-sim, fixed seeds, all 240 nations)

The best anchor we have: **an Origins game at 2000 BCE should look like today's Dawn start.**
Today's Dawn tuning is the result of many sessions; the ancient ages should arrive there, not
somewhere else.

| At 2000 BCE (Origins, Normal) | Target |
|---|---|
| Nations with a city | 165 to 175 (the rest are dormant islanders) |
| Median capital size | 2 to 3; Egypt, Iraq, China 5 or more |
| Median cities per nation | 1 to 2; no nation above 12 |
| Nations with Agriculture | above 90% |
| Nations in the Bronze Age by 2000 BCE | 5 to 15 (the cradles) |
| Wars per century (Age of Cities) | close to today's Bronze rate |
| ms per turn (PERF_CHECKS=1) | within the 80 ms budget, measured against the base commit on the same machine |

Plus for the late game: Information age carbon meter crosses the first threshold around 2030
in a typical game, the space victory is reachable by about 2350 for a leading nation, robot
armies appear around 2300, and the
Future age has at least 3 nations at war at any time in a 240-nation game.

### 15.2 Tests
- **Registry completeness test** (the most important one): every per-age table in the code
  (roster, buildings, rings, slots, naval, speeds, costs, era goals, government, icons,
  battle overrides, town models) has an entry for every age in AGE_ORDER. One test that
  imports them all and fails with the name of the missing pair. This is what keeps the nine
  ages from rotting.
- ages.test.js: the new speed table, turn counts per speed, formatYear with no year 0.
- techTree.test.js: 90 techs, 10 per age, every prerequisite resolves, no cycles.
- saveMigrations.test.js: a v8 fixture at 1995 CE migrates to the Information age with the
  right tech age; a v8 fixture with buildings migrates with tier indexes shifted.
- longRun from Origins: 150 turns at Normal reaches the Bronze Age with no NaN, no stall, a
  passing `assertGameState`.
- battle-lab: parity runs for (neolithic vs neolithic), (copper vs bronze), (information vs
  information), (future vs future); headless trace that shields regenerate and EMP stops
  vehicles; a browser screenshot of each new age.
- e2e: start an Origins game on the phone layout, settle the Band, open the research tree.

### 15.3 Save version 9
- `CURRENT_SAVE_VERSION = 9`, v8 stays loadable (a migration, not a clean break).
- Steps: recompute `state.age` and every `nation.tech.ageId` from the year and the researched
  set (only changes saves past 1990); shift building tier indexes (8.1); rename per-age keys
  that hold arrays (era goal progress); backfill new techs (automatic today).

---

## 16. Phases (each shippable on its own branch, merged when you say so)

| Phase | What | Visible to the player | Size |
|---|---|---|---|
| **0. Age registry** (done 2026-10-03) | One registry in `src/data/ages.js` (explicit unit attack, defence and cost per age; `FIRST_AGE_ID`, `LAST_AGE_ID`, `isAgeAtLeast`, `isAgeBefore`, `agesFrom`, `formatYear`); every hard-coded `'modern'`/`'bronze'` check, list and position-based table goes through it; the tech tree, naval names and era goal targets are keyed by age; `src/data/ageRegistry.test.js` checks every per-age table. Verified **bit-identical**: whole-state hashes match the base commit at every checkpoint from 2000 BCE to 1995 CE. The Start picker and applying the scenario year moved to Phase 2, because later starts first need their historical tech package (3.4). | Nothing (that is the point) | 1 session |
| **1. Age of Cities** | The `copper` age 3300-2000 BCE: 10 techs, roster, buildings, 3 wonders, governments, Unify, Border Stele, events; start scenario "Cities (3300 BCE)"; procedural art; save v9 | A new opening age | 3 to 4 sessions |
| **2. Neolithic and Origins** | The `neolithic` age: Bands, hearths, forage, tribal camps, raids, contact, Green Sahara; Origins becomes the default start | The 5000 BCE game | 3 to 4 sessions |
| **3. Information split** | Modern 1900-1990 and Information 1990-2100: moved techs and units, 10 new techs, carbon meter, cyber, World Congress, drones | The late game feels like three ages | 3 sessions |
| **4. Future** | Future 2100-2500 and END_YEAR 2500: techs, roster, shields and new powers in the sim, Energy and Space lines, Synthetics, Planetary Council, Future Tech, Mars Colony, then the robot armies (4.7) | The ending | 4 to 5 sessions |
| **5. Art and polish** | GLB/recipe models for the new units and robots, town models, wonder models, age icons and banners, audio families | Looks and sounds finished | ongoing, can run in parallel from Phase 1 |

Historical names (3.5) ship with the phase whose age they name: Age of Cities, Bronze and
Classical names in Phase 1, Neolithic names in Phase 2, Kingdoms names with them.

**World structure first:** `plans/independent-cities.md` (20, 35 or 50 major nations, the rest
as independent cities that raid) changes who exists on the map; its phases W1 to W3 come before
Phase 1 below, because Origins and the Age of Cities build on independents.

Why this order: Phase 0 is mandatory for any option and risk-free when the compare is identical.
The ancient ages come before the future because **every** game plays the opening and only long
games reach 2100. The Age of Cities comes before the Neolithic because it is closer to today's
Dawn (cities already exist) and so it is the safer first content step; the Neolithic then adds
the band start on top of it.

---

## 17. Decisions (from the user, 2026-10-03)

1. **Default start: Origins (5000 BCE).** Dawn and the later starts stay in the Start picker.
2. **Historical names: yes, the ancient empires**, including the Kingdom of Israel (3.5).
3. **End year: extended to 2500.** The Future age runs 2100 to 2500 at 3 years a turn (Normal).
4. **Tin and sea level rise: left out** of this plan.
5. **Future flavour: yes** (Synthetics estate, Technocracy, Corporate State), **plus robotic
   army units** (4.7).

---

## 18. Risks

- **A slow opening**: 70 turns before the Bronze Age could bore players. Mitigations: fast
  turns (60 years), a real decision every turn (settle, forage vs farm, camps, raids), Origins
  is optional, and the calibration target ties the Neolithic to a fixed endpoint.
- **Content volume**: about +80% techs, units and buildings. The registry and the completeness
  test keep it honest; procedural art keeps it playable before the art catches up.
- **Balance drift in Bronze to Modern**: guarded by explicit per-age power and cost values
  that keep today's numbers, plus the Phase 0 identical-results compare.
- **Performance**: tribal camps and the carbon meter are tiny; the extra 40 techs only touch
  research. The turn count stays about the same. Measured per phase with PERF_CHECKS=1.
- **Saves**: v9 is a migration, not a break; tested with v8 fixtures before merge.

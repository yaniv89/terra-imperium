# Terra Imperium ruler plan (phase RU)

Date: 2026-10-07. Status: plan only, nothing built. Branch for the plan: `claude/plan-ruler`.

The user's request: "one ruler (not changing) for each nation, and a new menu item, Ruler, where we
can develop the ruler; plan costs and benefits and attributes."

This plan replaces the ruler half of master plan section M3 (random rulers who reign 15 to 40 years
and are replaced). Decision 37 already removed succession, heirs and the noble estates; rulers,
governments and governors stayed. This plan keeps that line and goes one step further: there is no
next ruler at all.

Read with: `plans/MASTER-PLAN.md` (decisions, order of work), `plans/UI-DESIGN.md` (the Field Atlas
look, the five rules, W17), `plans/peoples-and-world-setup.md` (the 150 peoples),
`.claude/skills/add-mechanic/SKILL.md` and `.claude/skills/balance-sim/SKILL.md` (how a mechanic is
built and validated).

## 0. Summary

- **One ruler per nation for the whole game.** A timeless figure who embodies the nation: "King
  Sargon of Akkad" rules from 2000 BCE to 2300 CE. No death, no reign length, no heirs, no new house.
- **Six attributes**, 0 to 8: Administration, Diplomacy, Military (the three existing power pools),
  plus Command (battles and generals), Learning (science and culture) and Majesty (stability,
  loyalty, legitimacy). Every major starts with the same numbers: 3 / 3 / 3 / 0 / 0 / 0.
- **Renown** is the one currency. It is earned from deeds (cities founded, battles and wars won,
  techs, wonders, era goals) and a small trickle per century ruled. Renown fills **ruler levels**
  1 to 30. Each level gives 1 **attribute point**; every even level gives 1 **virtue point**
  (the tree), and so does every era legacy earned.
- **The Virtue tree**: five branches (Conqueror, Builder, Sage, Diplomat, Prophet), six tiers each,
  tiers gated by the age. 30 virtues, 50 points to buy all; a strong full game earns about 19, so a
  ruler ends with one complete branch and parts of two others.
- **The AI** develops its ruler by the same rules, choosing by its doctrine (personality). Every
  major starts equal. Independents have no ruler.
- **A new Ruler tab** in the rail (second, after Empire): portrait, title, attributes with reasons
  on tap, the renown bar and recent deeds, the tree, the court (advisors). A dot and a "next" prompt
  when points wait. W17 keeps a ruler card that opens it.
- **Engine**: `src/data/rulers.js`, `src/data/rulerVirtues.js`, a rewritten `src/engine/rulers.js`,
  a new `src/engine/renown.js`; save version 12 to 13; deterministic, no randomness at all.
- **Rollout**: RU0 names and titles, RU1 the ruler and attributes, RU2 renown, levels and the tree
  with the AI and balance-sim, RU3 the Ruler screen, RU4 portraits. About 7 to 9 sessions.

## 1. What exists today (read 2026-10-07 on `claude/integration` 86a22e2b)

| Piece | Where | Today |
|---|---|---|
| Ruler record | `src/engine/rulers.js` `generateRuler` | `{ id, name, dynasty, adm, dip, mil, traits, reignStartTurn, reignEndsTurn }`; skills 0 to 6 each (two dice 0 to 3 summed, mean about 3); 0 to 2 random traits, 20% negative |
| Government bias | `rulerStyleFor` | Theocracy rolls ADM twice, Dictatorship floors MIL at 3 |
| Reigns | `reignLengthTurns`, `processReignEnd`, resolveTurn "rulers" phase (resolveTurn.js 713) | 15 to 40 real years, 3 to 25 turns; a monarchy keeps the house name; a log line for the player |
| Dynasty achievement | `src/data/achievements.js` `dynasty`, `nation.sameDynastyStreak` | the same house for 10 rulers; unlocks the "Seasoned Court" starting doctrine |
| Civil war lost | `src/engine/civilWar.js` 194 | rolls a new ruler and government |
| Names | `src/data/names.js` | modern culture-group pools (William, Habsburg); not people-aware |
| Power pools | `src/utils/helpers.js` `getPowerIncome` | `BASE_POWER_PER_TURN` 3 plus `national.admBonus` etc.; the ruler adds its skill to its pool (`modifiers/sources.js` 61) |
| Traits | `src/data/traits.js` (20 traits), `sources.js` | effects on goldMult, techPointsMult, stabilityBonus, hrMult, buildingCost, developmentCost, pool bonuses |
| AI bias | `src/engine/rulerBias.js` | traits multiply the AI war roll (aiLogic.js) and reorder its building lines (aiProduction.js) |
| Authority | `src/engine/authority.js` | part "X's skill" = adm + dip + mil - `AUTHORITY_RULER_PAR` (9) |
| Legitimacy | `src/engine/nationalPower.js` | a monarchy or theocracy gains 0.5 x ADM / 6 a turn; below 50: -1 to the ruler's best pool |
| Advisors | `rulers.js`, `HIRE_ADVISOR`, aiEconomy.js | gold to hire, salary per turn, +level to one pool |
| Events | `applyEventEffects.js` 294 | an effect may add or remove a ruler trait (no event data uses it) |
| UI | `DomesticPanel.jsx` (Court), `NationOverviewSheet.jsx` (W17), `NationSheet.jsx` | name, house, ADM / DIP / MIL, traits, "Reign ends turn N" |
| Independents | `src/engine/independents.js` | `ruler: null` |
| Saves | `src/engine/saveMigrations.js` | `CURRENT_SAVE_VERSION` 12 |

Two findings that matter for this plan:
- **Starts are not equal today.** A random ruler's pool skills range 0 to 6 each, so one major can
  start with +15 power a turn and another with +3, against the master plan's "every nation starts
  equal". The new ruler fixes this.
- **The Scholar trait is player-only.** `national.techPointsMult` is applied in `calcIncome`
  (helpers.js 323) for the player only. Any science bonus from the ruler must be applied where both
  the player and the AI make science: the city yields in `src/engine/world/cities.js`.

## 2. The ruler

### 2.1 One figure for the whole game
- Created once in `createInitialState` for every major, never replaced. No reign, no death, no age,
  no heir, no house. The ruler is the nation's legend: the same name in 2000 BCE and in 2300 CE.
- Display: `<title> <name> of <people>`, e.g. "King Sargon of Akkad", "Pharaoh Narmer of Kemet".
  The title follows the government (and the realm size) the way nation titles do
  (`src/data/nationTitles.js`):

  | Government | Title (m / f) | At 15+ cities |
  |---|---|---|
  | tribal | Chief / Chieftess | High Chief |
  | monarchy | King / Queen | Emperor / Empress |
  | theocracy | Priest-King / Priest-Queen | Divine Emperor / Empress |
  | republic | First Consul | First Citizen |
  | dictatorship | Protector | Lord Protector |
  | technocracy, corporate (later ages) | Chancellor | High Chancellor |

  A people may override a title (`ruler.titles` in peoples.js, like `titles` for the nation):
  Kemet "Pharaoh", Akkad "Lugal" at tribal, the steppe peoples "Khan". Titles are names only; no
  rule reads them.
- **The name comes from the people.** A new hand-written field on each of the 150 entries in
  `src/data/peoples.js`: `ruler: { name: 'Sargon', gender: 'm', epithet: 'the Great' }`. Drafted
  first as `plans/data/rulers.json` (150 rows, source and a web check column, like the 3,000 city
  names), then built in. Rule for the draft: the people's legendary or founding ruler where one is
  known (Sargon, Narmer, Minos for Keftiu); otherwise a name attested in the people's language or
  period; never a Civilization leader name copied whole. Mix of men and women where history allows.
- `nation.ruler.id` = `ruler_<nationId>` (no turn in it: there is only one).
- `src/engine/peopleNames.js` keeps the ruler's full title current with the nation title (it already
  rewrites `nation.name` after every action); the ruler's `name` itself never changes.

### 2.2 Portrait
- Art path: `src/assets/peoples/rulers/<slug>.webp`, 512 x 512, about 30 kB each (150 files, about
  4.5 MB in total), loaded lazily with `import.meta.glob(..., { eager: false })` so only the shown
  portrait downloads. The art brief goes into `plans/ART-PRODUCTION-PLAN.md` when RU4 starts.
- Placeholder until then: a crowned bust silhouette per art `theme` (15 themes, one SVG each, in
  `src/assets/peoples/rulers/placeholder/<theme>.svg`) tinted with the people's colour, the
  ruler's initial on the plinth. `rulerPortrait(nation)` returns the webp when it exists, else the
  placeholder.

### 2.3 What happens to the old pieces

| Old piece | New |
|---|---|
| `reignStartTurn`, `reignEndsTurn`, `reignLengthTurns`, `processReignEnd`, the resolveTurn reign check | removed |
| `dynasty`, "of House X", `generateDynastyName` for rulers | removed (the names pools stay for the legacy world and generals) |
| `rulerStyleFor` (government biases the roll) | removed: nothing is rolled |
| Random traits (`src/data/traits.js`, `rollTraits`) | removed; the Virtue tree replaces them. `ruler.traits` now holds virtue ids |
| Event effect `ruler.addTrait / removeTrait` | removed (no event uses it); an event may grant renown instead (`effects.renown`) |
| Dynasty achievement (10 rulers of one house) | impossible now; **same id `dynasty`, new name "Living Legend", new check: reach ruler level 20**. Keeps "A Seasoned Court" unlockable |
| `sameDynastyStreak` | removed |
| Civil war lost: a new ruler | the ruler stays; government reroll and laws reset stay; the ruler is **humbled**: renown toward the next level drops to 0 and this age's free reshape is spent |
| "Low legitimacy: -1 to the ruler's best pool" | kept (`getRulerBestPool` reads the same fields) |
| Advisors | kept unchanged (gold buys a pool bonus); shown on the Ruler sheet as "Court" |
| Royal marriage, governors | unchanged |
| Legacy 240-country world | same system. The name comes from the culture-group pool (`names.js`), picked by a hash of the nation id (no rng draw); title by government; no hand data; placeholder portrait of the nearest theme |

## 3. Attributes

Six attributes, each an integer 0 to 8. Stored flat on the ruler (`ruler.adm` ... `ruler.maj`) so the
existing readers of `ruler.adm / dip / mil` (sources.js, authority.js, nationalPower.js, the W17 model)
keep working unchanged.

**Start (every major, both worlds): ADM 3, DIP 3, MIL 3, CMD 0, LRN 0, MAJ 0.** The three pool
attributes start at today's average roll, so turn 1 of a new game is today's game without the dice;
the three new attributes start at 0, so they add nothing until earned.

**Cap by age** (the calendar age, `state.age`, the same for everyone): Bronze 4, Classical 5,
Kingdoms 6, Gunpowder 7, Modern 8.

**Cost**: 1 attribute point a level up to 5; 2 points a level for 6, 7 and 8. Points never expire.

| Attribute | Short | Per level (L = the level) | At 3 | At 8 (max) | Hooks (all existing unless marked new) |
|---|---|---|---|---|---|
| Administration | ADM | +1 administrative power a turn; legitimacy +0.5 x L / 6 a turn (monarchy, theocracy); authority counts it | +3 ADM | +8 ADM | `national.admBonus` (sources.js), nationalPower.js, authority.js |
| Diplomacy | DIP | +1 diplomatic power a turn; **+1 opinion of you in every met major per level above 3** | +3 DIP, +0 | +8 DIP, +5 opinion | `national.dipBonus`; opinion.js new reason `ruler` ("Renown of King Sargon") |
| Military | MIL | +1 military power a turn; **+2% manpower per level above 3** | +3 MIL | +8 MIL, +10% | `national.milBonus`, `national.hrMult` |
| Command | CMD | battle-start morale losses (supply, starvation, plague) **-8% per level**; every general of the nation **+1 Martial per 3 levels** (Martial may then exceed 5); morale recovery on the map **+5% per level** | -24%, +1 Martial, +15% | -64%, +2 Martial, +40% | `battleInputs.js conditionUnit` (Command and Auto both read it), `data/generals.js martialMultiplier` (Auto, battle.js; the RTS setup's general stats), `national.moraleRecovery` |
| Learning | LRN | **+2% science and +2% culture in every city** | +6% | +16% | new keys `national.scienceMult`, `national.cultureMult`, read in `src/engine/world/cities.js` yields (player and AI alike) |
| Majesty | MAJ | **+1 loyalty target in every city**; **+0.05 legitimacy a turn**; **+1 authority** per level | +3, +0.15, +3 | +8, +0.4, +8 | loyalty.js `loyaltyTarget` (a new `ruler` part), nationalPower.js, authority.js |

Notes:
- Authority's ruler part becomes (ADM + DIP + MIL - 9) + MAJ: 0 at the start, as today's average.
- Command never puts the ruler on the battlefield (the ruler cannot die). It works through morale and
  the nation's generals, which both Command and Auto battles already read, so parity holds by
  construction. AI-against-AI abstract war progress (`resolveWarProgress`) does not read it (accepted:
  it reads no generals either).
- Every effect is on the modifier sheet with the line "King Sargon (Learning 4)" so every number
  explains itself (UI rule 4).

## 4. Development: renown, levels, points, the tree

### 4.1 Renown (the currency)
Renown is a lifetime total; it is **never lost** (no death spirals; one exception: the civil-war
humbling in 2.3 empties the progress toward the next level). Amounts are counts of deeds, so they
are the same on every game speed; the time trickle is per year, also speed-neutral.

| Deed | Renown | Where it is granted | Limit |
|---|---|---|---|
| Time ruled | 1 per 10 years | resolveTurn rulers phase (years this turn / 10) | none; stops while the capital is lost |
| City founded | 15 | settlers.js (found city), not outposts | none |
| City taken from a major | 25 (its capital: +50) | conquest.js `conquerRegion` | x size damping, see 4.5 |
| City taken from an independent, or joined by choice (W3) | 15 | conquest.js, indepPolicy.js | x size damping |
| Battle won (any kind: field, assault, defence, sea, raid driven off; Command or Auto) | 5, +5 if outnumbered | `applyBattleOutcome` (battleOutcome.js; idempotent by operation id, so never twice) | 20 a turn |
| War won (peace with war score 25+ for you) | 40; a defensive war survived with white peace: 15 | peace.js `applyPeace` | none |
| Tech researched | 2 + 2 x age index (Bronze 2 ... Modern 10) | research.js completion (player and AI) | none |
| Great project tier completed | 30 a tier | resolveTurn great projects phase | none |
| Era goal met (at the age's end) | 40 each | eraGoals.js `awardEraLegacy`, extended to every major (once per age) | none |
| Era legacy earned | 60 and 1 virtue point | the same | 5 a game |
| Stability +3 held 10 turns | 20 | nationalPower phase (the existing `stability3Streak`) | once per 25 turns |
| Event choice | as the event says (`effects.renown`) | applyEventEffects.js | event data |

Every grant goes through one pure helper, `grantRenown(nation, deedId, amount, turn)` in
`src/engine/renown.js`, which adds the amount, keeps the last 12 deeds (`ruler.deeds`, for the
"why" list) and returns a new nation. Nothing else writes `ruler.renown`.

### 4.2 Levels
Renown to go from level L to L + 1 = **50 + 10 x L**. Level 30 is the maximum.

| Level | 5 | 10 | 15 | 20 | 25 | 30 |
|---|---|---|---|---|---|---|
| Renown in total | 300 | 900 | 1,750 | 2,850 | 4,200 | 5,800 |

Expected on Normal speed (estimated from the deed table and a typical major; balance-sim measures it):

| End of age | Average major | Strong player |
|---|---|---|
| Bronze (turn about 48) | 280, level 5 | 450, level 6 |
| Classical (about 157) | 850, level 9 to 10 | 1,350, level 12 |
| Kingdoms | 1,600, level 14 | 2,600, level 19 |
| Gunpowder | 2,400, level 18 | 3,900, level 24 |
| Modern (game end) | 3,300, level 21 | 5,300, level 28 |

### 4.3 Points
- **Attribute points**: 1 per level gained (29 at most). Cost to fill every attribute to 8 from the
  start: 57. Average game: about 20 (a third); strong: about 27 (under half).
- **Virtue points**: 1 at the start (the founding virtue, a tier I pick), 1 at every even level (15 at
  most), 1 per era legacy (5 at most): **21 at most**. Average about 13, strong about 19.
- Points wait unspent as long as the player likes; the tab shows a dot (5.3).

### 4.4 The Virtue tree
Five branches, six tiers. A tier opens with the age (I and II Bronze, III Classical, IV Kingdoms,
V Gunpowder, VI Modern) and needs the tier above it in the same branch. Tier VI is a **capstone**:
it needs four virtues of its branch, and **a ruler may hold one capstone only**. Branch cost
1 + 1 + 1 + 2 + 2 + 3 = 10 points; the whole tree 50. With about 19 points a strong ruler completes
one branch and buys the opening tiers of two or three others.

Effects use existing modifier keys where one exists; "new key" or "new rule" marks the ones RU2 adds.
A drawback is part of the price where the virtue is strong.

**Conqueror** (war)

| Tier | Virtue | Cost | Effect | Drawback |
|---|---|---|---|---|
| I | Warlord | 1 | +10% manpower (`hrMult` 0.10) | AI neighbours: -5 opinion ("Warlike ruler") |
| II | Iron Discipline | 1 | battle-start morale losses -20% (with Command's, capped at -75%); morale recovery +20% | none |
| III | Siege Lord | 1 | your sieges batter walls 20% faster (new key `national.siegeDamage`, sieges.js) | none |
| IV | Terror of the Field | 2 | war score from battles +20% (new rule, `recordBattle`); won battles' XP +25% | AE from conquests +10% |
| V | Grand Strategist | 2 | supply range +2 (`national.supplyRange`), attrition -20% (`national.attrition`) | none |
| VI | Conqueror's Peace (capstone) | 3 | conquered cities' loyalty penalty halved (new rule over `LOYALTY_CONQUERED`), AE from conquest -25% | stability -1 |

**Builder** (growth and works)

| Tier | Virtue | Cost | Effect | Drawback |
|---|---|---|---|---|
| I | Founder | 1 | settlers cost 15% less production (new key `national.settlerCost`, aiProduction and the city queue) | none |
| II | Master Builder | 1 | buildings cost 10% less (`national.buildingCost` -0.10) | none |
| III | Surveyor | 1 | +5 governing capacity (`national.governingCapacity`) | none |
| IV | Granaries | 2 | population growth +1 (`national.popGrowthBonus`) | none |
| V | Engineer-King | 2 | great projects cost 15% less (new key `national.wonderCost`) | none |
| VI | Builder of Ages (capstone) | 3 | +10% production in every city (new key `national.productionMult`, cities.js) | military power -1 a turn |

**Sage** (science and culture)

| Tier | Virtue | Cost | Effect | Drawback |
|---|---|---|---|---|
| I | Scribe | 1 | +5% science (`national.scienceMult`) | none |
| II | Patron of Learning | 1 | research boosts from map facts worth 10% more (new rule, boosts.js) | none |
| III | Royal Library | 1 | the capital +2 science and +1 culture (palace yields, cities.js) | none |
| IV | Philosopher | 2 | research cost -8% (`national.researchCost`) | none |
| V | Academy | 2 | tech diffusion from neighbours +25% (new rule, techDiffusion.js) | none |
| VI | Enlightened (capstone) | 3 | +10% science, +15% culture | manpower -10% |

**Diplomat** (opinion and trade)

| Tier | Virtue | Cost | Effect | Drawback |
|---|---|---|---|---|
| I | Envoy | 1 | +5 opinion of you in every met major (opinion reason `ruler`) | none |
| II | Merchant Prince | 1 | +1 trade pact capacity (diplomacy.js `getTradePactCapacity`), +5% gold | none |
| III | Peacemaker | 1 | the AI accepts peace with 10 less war score (new rule, peace.js) | none |
| IV | Matchmaker | 2 | alliance acceptance +10; royal marriage opinion x1.5 | none |
| V | Great Game | 2 | aggressive expansion against you fades 25% faster (new rule, expansion.js) | none |
| VI | Arbiter of Nations (capstone) | 3 | +10 opinion more; independents join you 25% sooner (indepPolicy.js attitude) | declaring a war costs -1 stability |

**Prophet** (stability, loyalty, faith)

| Tier | Virtue | Cost | Effect | Drawback |
|---|---|---|---|---|
| I | Anointed | 1 | +0.2 legitimacy a turn | none |
| II | Beloved | 1 | stability bonus +1 (`national.stabilityBonus`: -1 unrest everywhere) | none |
| III | Cult of the Ruler | 1 | +5 loyalty target in every city (rules `loyaltyBonus`, as laws do) | none |
| IV | Unifier | 2 | your culture presses 15% harder on cities near you (new rule, loyalty.js pressure) | none |
| V | Divine Mandate | 2 | war exhaustion rises 20% slower (rules `warExhaustionMult` -0.2); stability cost -15% | none |
| VI | Living God (capstone) | 3 | +10 authority; your capital never flips by loyalty | opinion -10 with other theocracies |

### 4.5 Anti-snowball limits
- Escalating level costs (4.2) and the level cap 30.
- Age caps on attributes and on tiers: nobody runs ahead of the calendar.
- One capstone per ruler.
- **Size damping** on conquest and battle renown: x 12 / max(12, cities owned). A 36-city empire gets
  a third of the renown per city taken. Founding, techs and era goals are not damped.
- Battle renown capped at 20 a turn.
- **Catch-up**: a major whose ruler level is below the median of living majors gains +25% renown
  ("Rising star"). Tuned or dropped by balance-sim (open question 8.9).
- Renown is never lost, so a beaten nation is never pushed further down by its ruler.

### 4.6 Reshaping (respec)
- **Once per age, free**: when a new age begins the player may reshape: all attribute and virtue
  points come back (attributes to the start values) and are spent again. The offer waits until used
  or the next age. A civil war lost uses it up (2.3).
- **Any other time**: 200 administrative power and -1 stability.
- The AI never reshapes.

### 4.7 Age gating, in one table

| Age | Attribute cap | Tiers open | Typical level at its end (average / strong) |
|---|---|---|---|
| Bronze | 4 | I, II | 5 / 6 |
| Classical | 5 | III | 10 / 12 |
| Kingdoms | 6 | IV | 14 / 19 |
| Gunpowder | 7 | V | 18 / 24 |
| Modern | 8 | VI | 21 / 28 |

## 5. The AI

- **Equal starts**: every major gets the same ruler numbers on turn 1 (3 / 3 / 3 / 0 / 0 / 0, level 1,
  one virtue point). A test asserts it for the Standard peoples world.
- **Same rules**: the AI earns renown from the same deed sites (each grant site serves player and AI;
  the era goals, player-only today, are scored for every major once per age) and spends by the same
  costs, caps and gates.
- **Personality-driven picks** (`aiDevelopRuler(nation, age)` in rulers.js, pure, no rng): spends every
  available point the turn it gets it (a number compare when there is nothing to spend). Weights by
  doctrine (`src/data/nations.js DOCTRINES`):

  | Doctrine | Branch order | Attribute order |
  |---|---|---|
  | conqueror, blitz, zealot | Conqueror, Prophet, Builder | MIL, CMD, ADM |
  | opportunist | Conqueror, Diplomat, Builder | MIL, DIP, CMD |
  | merchant | Diplomat, Builder, Sage | DIP, ADM, LRN |
  | cautious, defender | Builder, Prophet, Sage | ADM, MAJ, CMD |
  | isolationist | Sage, Builder, Prophet | LRN, ADM, MAJ |
  | attrition (default) | Builder, Conqueror, Sage | ADM, MIL, LRN |

  Rule: take the cheapest open virtue of the first branch in order that has one; with no virtue open,
  hold the point (a new tier opens with the age). Attributes: raise the first in order that is below
  the cap; ties broken by a hash of the nation id (`fnv1a`), never `Math.random`.
- **rulerBias.js** is rewritten to read virtues instead of random traits: each Conqueror virtue x1.1
  on the war roll, each Diplomat virtue x0.9 (clamped to the existing 0.25 to 2.5); building lines by
  branch (Builder: industry, logistics; Sage: science, culture; Conqueror: military, defense;
  Diplomat: economy, naval; Prophet: culture, food).
- **Competitive**: the AI never sits on points and follows its personality, so its ruler stays within
  a few levels of an average player's. balance-sim checks the level spread (7).
- **Independents**: no ruler, no renown, no tree (they are one-city peoples with their own cheap AI).
  Their sheet may name a chief later for flavour only.

## 6. The Ruler menu and screens

### 6.1 Where it lives
- **Phone landscape and desktop rail** (`ActionPanelTabs.jsx TABS`, drawn by `PanelDrawer.jsx`): a new
  tab `{ id: 'ruler', label: 'Ruler', icon: Crown }` second, after Empire; Empire takes `Landmark`.
  Order: Empire, Ruler, Cities, Research, Peoples, (Space), Legacy. Rail buttons are 44 to 64 px
  tall (flex): 8 buttons at 44 px = 352 px, inside the 354 px under the 36 px top bar at 844 x 390.
  It fits with no room left: if a ninth tab ever comes, Legacy moves into Menu.
- **Phone portrait**: the rotate screen (no change).
- **Top bar**: no new item; the nation name already opens W17, which links here.

### 6.2 The Ruler sheet at 844 x 390 (the reference)
A wide dock like Research (W09), right of the map, the rail on its right edge.

```
+--------------------------------------------------------------------------+------+
| [portrait 88] KING SARGON OF AKKAD              Level 7  [=====---] 340/420 |Empire|
|               rules since 2000 BCE  · 2 attribute points · 1 virtue point   |RULER |
+-------------------------------+------------------------------------------+|Cities|
| ATTRIBUTES          cap 5     | VIRTUES   Conqueror Builder Sage Dipl Proph|Resear|
| ADM 4 ●●●●○  +4 ADM a turn [+]| Bronze I  [Warlord][Founder][Scribe]...    |People|
| DIP 3 ●●●○○  +3 DIP     [+]   | Bronze II [Iron D.][Master ][Patron]...    |Legacy|
| MIL 3 ●●●○○  +3 MIL     [+]   | Classical [Siege L][Survey ][Libr. ]...    | Menu |
| CMD 1 ●○○○○  -8% morale [+]   | Kingdoms  (locked: Kingdoms age)           |      |
| LRN 2 ●●○○○  +4% sci    [+]   | Gunpowder (locked)                         |      |
| MAJ 0 ○○○○○  +0 loyalty [+]   | Modern    (locked)                         |      |
| Deeds · Court                 | [selected: Master Builder, 1 point  (Take)]|      |
+-------------------------------+--------------------------------------------+------+
```

- **Header** (56 px): portrait 88 px overlapping the header, full title (Spectral SC), level, the renown
  bar with its numbers (JetBrains Mono), the points waiting as chips ("2 attribute points": brass
  number only, key numbers rule).
- **Left column** (about 270 px): the six attributes, one 44 px row each: name, value, pips to the age
  cap (a dashed pip beyond the cap: "opens in Classical"), what it gives now, and a raised `+` button
  (44 x 44) when a point and room exist. **Tap the row** for its reasons sheet: what each level gives,
  the next level's gain, the cost (1 or 2 points), the age cap, and every place the number shows
  (e.g. "Learning 2: +4% science in 3 cities = +0.8 science a turn"). Below: two text tabs, **Deeds**
  (the last 12 renown gains with turn and place; a place button jumps the map) and **Court** (the
  advisors, moved from the Empire sheet's Court section, same actions).
- **Right area** (about 470 px): the tree as a grid, five branch columns (about 92 px) by six tier
  rows (about 40 px; the rows past the current age shown collapsed to one "Kingdoms and later" line on
  a phone, expanded on desktop). A virtue chip: name on one or two lines, a state (taken: raised fill
  and a light outline; open and affordable: normal; open but too dear: muted cost; locked: dashed,
  with the age or the missing tier). Tap a chip: the **detail bar** at the bottom of the tree shows
  effect, drawback, cost, requirement, and the one **brass** button "Take Master Builder (1 point)".
  That button is the screen's only brass action (rule: brass only for the primary action).
- **Pending choices**: the founding virtue at the start and the free reshape of a new age show as a
  banner at the top of the right area ("A new age: you may reshape your ruler once. Reshape / Later").
- Targets: every tap target 44 px (rows, `+`, chips are 44 px tall with 4 px gaps; the five
  columns fit 5 x 92 in 470 px).

### 6.3 Desktop (1280 x 800)
The same layout in a 760 px dock: portrait 160 px, the attribute rows show their reasons inline (no tap
needed), all six tier rows expanded, each virtue chip shows its effect line under the name, Deeds and
Court side by side under the attributes.

### 6.4 Notifications
- **Tab dot and count**: `getTabBadge(state, 'ruler')` = unspent attribute points + virtue points.
- **Next prompt** (`nextPromptModel.js`, after research): "King Sargon can grow (2 points)", kind
  `ruler`, tab `ruler`. Never blocks End Turn; counts for the "warn me" setting like the others.
- **Level-up**: a log line ("King Sargon reaches level 8: 1 attribute point, 1 virtue point") and a
  group "Ruler" in the turn report (W10) that sums the turn's renown ("+45 renown: Battle of Der won,
  Uruk founded").
- **New age**: the reshape offer as a turn-report line and the banner in 6.2.

### 6.5 W17 nation overview
The ruler card stays as a summary: portrait 56 px, title, "Level 7 · 340 / 420 renown", the six
attributes as 2 rows of 3 small tiles (the sketch's three tiles become six), the virtues as chips,
the line "rules since 2000 BCE" in place of "reign 14 years", and a link "Open Ruler" (or the whole
card is the tap target). The sketch's "leads the Host of Sargon in the field (aura +10% morale)"
becomes the Command line ("Command 1: morale losses -8%, generals +0 Martial").

### 6.6 Other screens
- **Start screen (W01) people preview**: the ruler's portrait and "King Sargon" under the people's
  name; an optional rename field and gender switch for the player's own ruler (open question 8.2).
- **Empire sheet (DomesticPanel)**: its Court block (ruler line, "Reign ends turn N", advisors) is
  replaced by a one-line ruler summary that opens the Ruler tab.
- **NationSheet** (other nations): the other ruler's title, level and branch shown ("Queen Pudu-Hepa
  of Kanesh, level 9, Diplomat"), reasons on tap for the opinion line it adds.
- **Sketch board**: add **W18 Ruler** (phone and desktop) to the UI design canvas and
  `plans/ui/sketches/` before RU3 starts.

## 7. Engine and data

### 7.1 Files
| File | Holds |
|---|---|
| `src/data/rulers.js` (new) | `RULER_ATTRIBUTES` (id, label, short, per-level effect lines, start value), `ATTRIBUTE_CAP_BY_AGE`, `attributeCost(level)`, `RENOWN_DEEDS` (the 4.1 table), `renownToNext(level)`, `MAX_RULER_LEVEL`, `RULER_TITLES` (government x gender, realm size), `VIRTUE_POINTS` rules, the anti-snowball constants (`SIZE_DAMP_CITIES` 12, `BATTLE_RENOWN_TURN_CAP` 20, `CATCHUP_MULT` 1.25), `RESHAPE_COST` |
| `src/data/rulerVirtues.js` (new) | `BRANCHES`, `VIRTUES` (id, branch, tier, age, cost, requires, `effects` in the short hook names that `linesFromEffect` reads, `rules`, `drawback`, `aiWeight`), `DOCTRINE_RULER_PLAN` (5 table) |
| `src/data/traits.js` | deleted (with its tests); `TRAITS` readers move to `VIRTUES` |
| `src/data/peoples.js` | each entry gains `ruler: { name, gender, epithet }` and optional `ruler.titles` |
| `src/engine/rulers.js` (rewritten) | `createRuler(nationId, scenarioMode)`, `rulerLevel(renown)`, `rulerPoints(ruler)` (earned minus spent, derived, never stored separately), `canRaise / raiseAttribute`, `canTakeVirtue / takeVirtue`, `reshape`, `aiDevelopRuler`, `rulerTitle(nation)`; the advisor functions stay |
| `src/engine/renown.js` (new) | `grantRenown`, `renownForDeed(deedId, ctx)` with the size damping, battle cap and catch-up; `timeRenown(years)` |
| `src/engine/rulerBias.js` | rewritten to read virtues by branch (5) |
| `src/engine/modifiers/registry.js` | new keys `national.scienceMult`, `national.cultureMult`, `national.productionMult`, `national.settlerCost`, `national.wonderCost`, `national.siegeDamage` (and their `LEGACY_HOOK` short names) |
| `src/engine/modifiers/sources.js` | the ruler block: one line per attribute effect (labelled "King Sargon (Learning 4)") and `linesFromEffect` per virtue |
| `src/engine/lawRules.js` | `rulesOf(nation)` = law rules plus virtue rules, so every rules consumer (loyalty, war exhaustion) gets both |

### 7.2 State shape
```js
nation.ruler = {
  id: 'ruler_akkad',
  name: 'Sargon', gender: 'm', epithet: 'the Great',   // from peoples.js; legacy world: hash-picked
  adm: 3, dip: 3, mil: 3, cmd: 0, lrn: 0, maj: 0,      // the six attributes, flat
  renown: 0,                                            // lifetime total (one decimal at most)
  traits: ['founder'],                                  // virtue ids in the order taken
  bonusVirtuePoints: 0,                                 // from era legacies and migration refunds
  reshapeAge: null,                                     // the age whose free reshape was used
  deeds: [{ turn: 12, id: 'cityFounded', renown: 15, where: 'c_akkad_2' }]  // last 12
}
```
Level and points are derived (`rulerLevel`, `rulerPoints`), never stored, so they cannot drift.
`nation.sameDynastyStreak` goes. Independents keep `ruler: null`.

### 7.3 Save migration
Version bump **12 to 13** (`CURRENT_SAVE_VERSION` 13, `migrate12to13`):
- Every nation with a ruler gets the new shape. Peoples world: the name from peoples.js (the player
  meets "King Sargon" in place of the rolled name, with a one-time log line "Your ruler is now the
  ageless King Sargon"). Legacy world: the current ruler's name is kept.
- Attributes reset to the start values (3 / 3 / 3 / 0 / 0 / 0). Retroactive renown so the nation is
  not behind a new game at the same turn: years elapsed / 10 + 15 x (cities - 1) + 2 x techs
  researched (capped at the level-20 total). Points arrive unspent: the player spends them, the AI
  spends them on its first turn.
- Old traits are dropped; each old positive trait refunds 1 virtue point (`bonusVirtuePoints`);
  negative ones simply go.
- Removed fields: `dynasty`, `reignStartTurn`, `reignEndsTurn`, `sameDynastyStreak`.
- A test loads a v12 fixture and checks the shape, the refund and `auditGameState`.

### 7.4 Turn and reducer
- **resolveTurn**: the "rulers" phase (resolveTurn.js 713) loses the reign check and becomes: the time
  renown for every major (years this turn / 10), the stability streak deed, the level-up log lines for
  the player, then `aiDevelopRuler` for every AI major (cheap: a compare when no points wait). The
  governor refresh in the same block stays. Order: after the AI economy, before national power (as now),
  so legitimacy and authority read this turn's attributes.
- **Deed sites** call `grantRenown` where the deed happens (4.1), which keeps each grant in the system
  that knows the facts and makes the player's commanded battles (fought from the reducer) count too.
  `applyBattleOutcome` is idempotent by operation id, so a battle's renown is granted once.
- **gameReducer actions** (`src/data/types.js`): `RAISE_RULER_ATTRIBUTE { attr }`,
  `TAKE_RULER_VIRTUE { virtueId }`, `RESHAPE_RULER { free }` (with the full new allocation, applied in
  one action so it is atomic), `RENAME_RULER { name, gender }` (start screen only). Each validates
  with the same `can*` functions the UI uses and returns the same state when refused.
- **Determinism**: nothing in the ruler system draws randomness. `createInitialState` no longer draws
  from `rulerRng` for rulers, which shifts the advisor candidates drawn after it: state hashes of
  existing seeded tests change once, by design (note it in the commit).

### 7.5 Tests
- `rulers.test.js` (rewritten): start values equal for every major in a Standard peoples world and the
  legacy world; level curve edges (0, 59, 60, 5,800, beyond); point arithmetic; caps by age; the
  2-point cost above 5; the one-capstone rule; tier and age gates; reshape restores and costs;
  `aiDevelopRuler` per doctrine and its tie hash.
- `renown.test.js`: each deed amount; size damping; the battle cap per turn; catch-up; idempotent
  battle grants through `applyBattleOutcome`; never negative; civil-war humbling.
- `rulerVirtues.test.js`: every virtue's effect keys exist in the registry; every `requires` exists;
  costs sum to 50; branch sizes.
- Hook tests: Command through `conditionUnit` and `getGeneralDamageMultiplier`; Learning in city
  yields for an AI city and the player's; Majesty in `loyaltyTarget` and authority parts; the DIP and
  Envoy opinion reasons.
- `saveMigrations.test.js`: v12 to v13 fixture.
- Integration: 50 turns of a fixed-seed peoples world through resolveTurn with the world quieted (the
  add-mechanic recipe): every AI ruler has levelled, spent all points, stayed within caps;
  `auditGameState` clean; `longRun.test.js` determinism holds.
- UI models: `rulerSheetModel.test.js` (rows, reasons, states of chips, the brass action), the tab
  badge and the next prompt.

## 8. Balance plan

Run with the balance-sim skill, paired seeds, against the base commit before RU1:

```bash
SCENARIO=peoples SIZE=standard PLAYER=akkad .claude/skills/balance-sim/compare.sh <base-ref> 150 11-16
```

(6 seeds x 150 turns; on Normal speed 150 turns ends near 450 CE, the late Classical age, so it
measures the first two ages; one extra run at 300 turns on 2 seeds checks the Kingdoms age.)

New keys in `scripts/simStats.mjs` (added in RU2): `rulerLevelMean`, `rulerLevelMax`,
`rulerLevelMin`, `rulerLevelTopToMedian`, `renownGini`, `branchShare.<branch>` (share of virtues
taken per branch), `unspentPoints` (should be 0 for the AI).

| Must not change (no starred move the wrong way) | Why |
|---|---|
| Turn 1 ruler numbers identical for every major | equal starts (a test, not a metric) |
| `topLandShare`, `effectiveNations`, `giniCities`, `giniLand` | no runaway |
| `nationsAliveShare`, `medianNationLife` | no cull |
| `nonFinite`, `auditViolations` = 0 | health |
| `msPerTurn` within 2 ms (judge with `JOBS=1`) | the phase must stay cheap |

Expected effect sizes at turn 150:
- Ruler levels: mean 9 to 10, max 13, min 6; top to median at most 1.5.
- Removing the 0 to 6 pool dice: the spread of power income at turn 1 goes from about 3 to 15 extra to
  9 for everyone; `giniWealth` slightly lower (a small fall, perhaps starred).
- At level 10 a ruler has about 9 attribute points and 5 virtues: about +3 to 5% gold or science, a few
  points of loyalty or opinion. `warsTotal` and `conquests` move by less than one seed's noise; a
  starred rise in conquests above 15% means the Conqueror weights are too strong.
- `branchShare`: no branch above 40% (the doctrine mix decides it; if Builder dominates, the
  attrition default order changes).
- Battle-lab parity: Command changes battle inputs only through shared code, but rerun `parityEco` on
  three age pairs with Command 0 and Command 6 to confirm Command and Auto move together.

## 9. Rollout

| Step | What | Size | Depends on |
|---|---|---|---|
| **RU0** | Ruler names for the 150 peoples (`plans/data/rulers.json`, sources, web check), titles table, people overrides | 1 session | none |
| **RU1** | The fixed ruler: data file, `createRuler`, remove reigns, houses, random traits and `traits.js`; the six attributes and their hooks (pools, authority, legitimacy, opinion, manpower, Command in battle inputs and generals, Learning in city yields, Majesty in loyalty); Living Legend; save v13; tests; balance-sim (expect: the dice removed, little else) | 2 sessions | RU0 (or placeholder names) |
| **RU2** | Renown and levels (deed sites, the time trickle, damping, catch-up), points, the Virtue tree with its new keys and rules, reshape, AI development and the rulerBias rewrite, sim stats keys, balance-sim and battle-lab parity | 2 to 3 sessions | RU1 |
| **RU3** | The Ruler tab and sheet (844 x 390 and desktop), W17 card, Empire sheet court move, start screen preview, NationSheet line, badge, next prompt, turn report group; W18 sketch board first; screenshots at both sizes | 2 sessions | RU2 engine; U1 look (done) |
| **RU4** | Portraits: 15 theme placeholders, then 150 webp portraits through the art pipeline | ongoing | RU3 |

Risks:
- **Snowball**: renown follows success, success follows renown. Mitigated by the curve, caps, damping
  and catch-up; balance-sim decides the constants. If `rulerLevelTopToMedian` passes 2, cut conquest
  renown first.
- **AI parity**: deeds in player-only systems (era goals, the player's `techTree`, the player-only
  `techPointsMult`) would hand the player renown or bonuses the AI cannot get. Every deed site and
  every hook in this plan is listed with a path that serves both; RU2 adds a test per site.
- **Hash churn**: the start no longer draws ruler rolls; seeded tests that compare whole states
  change once.
- **Rail space** at 844 x 390: exactly full (6.1).
- **Names**: real historical figures are sensitive for a few peoples (Israel, Kemet); the web check
  and the user's review in RU0 settle them.
- **Too many numbers** for a phone: the sheet shows what the ruler gives now and hides the full table
  behind the tap (rule 4).

## 10. Open questions for the user (with a recommendation each)

1. **Historical names or invented?** Recommend the people's legendary or founding ruler where known
   (Sargon of Akkad, Narmer of Kemet, David of Israel), an attested period name otherwise.
2. **May the player rename the ruler and choose a woman or a man?** Recommend yes, on the start screen
   only, with the historical default.
3. **Should the ruler stand on the battlefield as a hero unit?** Recommend no: a ruler who never dies
   cannot fall in battle; Command works through morale and the generals.
4. **Six attributes, or keep three?** Recommend six (the three pools plus Command, Learning, Majesty):
   each new one owns a system nothing else on the ruler touches.
5. **Can renown be lost?** Recommend never, except the civil-war humbling (progress to the next level).
6. **Reshaping**: recommend one free reshape per age, otherwise 200 administrative power and -1
   stability.
7. **One capstone per ruler?** Recommend yes; it keeps rulers distinct.
8. **Should the government shape the tree** (Prophet cheaper in a theocracy)? Recommend no for now: the
   government already has reforms and laws; the title is enough.
9. **Catch-up renown (+25% below the median level)?** Recommend yes at first, kept only if balance-sim
   shows the level spread needs it.
10. **Independents**: recommend no ruler (as today); a named chief for flavour later.
11. **Advisors**: recommend keep them, shown as the Court on the Ruler sheet.
12. **Legacy 240-country world**: recommend the same system with names from the culture pools, no hand
    data.
13. **The Dynasty achievement**: recommend keep the id, rename to "Living Legend" (ruler level 20).
14. **Calendar age or the nation's own tech age for caps and tiers?** Recommend the calendar age (the
    same for everyone, simple); revisit if a fast researcher feels held back.

## Decisions (user, 2026-10-07)
All 14 recommendations above are accepted, with one change to question 12: the old 240-country
world is no longer a game mode. The ruler system is built for the peoples world only; the legacy
world stays only as far as tests and old saves need it (it gets fixed 3/3/3 rulers and no Ruler
menu), and nothing in RU0 to RU4 is designed around it.

# Math that would make Terra Imperium better

A research proposal (2026-10-04, branch `claude/bronze-towns`). No code was changed. Every idea
below was checked against the current code, so it says what exists already and what is new.
Costs: **S** about a day, **M** a few days to a week, **L** several weeks. Risk is the chance it
breaks balance, saves, determinism or the 80 ms turn budget.

Things I measured or found while reading the code, which shape the ranking:

- **The hex grid is not even.** On the frequency-75 grid, the distance between neighbouring hex
  centres runs from **76.5 km to 112.4 km** (mean 102.2 km), measured with `buildGrid(75)` from
  `src/data/geo/geodesic.js`. Hexes near the 12 icosahedron corners are about half the area of
  the biggest ones. Movement, borders, yields per km² and supply all feel this.
- **Three distance constants are left over from the old 150 km grid.** `KM_PER_RING = 170` in
  `src/engine/armies.js` and `src/engine/fleets.js` (the A* heuristic) and `KM_PER_RING = 147` in
  `src/engine/loyalty.js` (culture pressure). On a 102 km grid the loyalty one makes culture reach
  about 19 real rings instead of the 13 the comment promises, and fall off as if cities were 30%
  closer than they are.
- **Turns are slow.** The plan's own log reports 266 to 431 ms a turn in the balance sim (budget
  80 ms), and names `processCities` copying `tileOwner` as 34 ms of one phase.
- **Monte Carlo battle odds already exist** (`src/engine/battleOdds.js`, 200 seeded auto-resolves
  with a factor breakdown). Flow fields and a spatial hash already exist in the tactical sim
  (`src/battle/sim/pathing.js`), integer fixed-point maths too (`fixed.js`). Instancing and LOD
  exist in the close view. Loyalty already uses a gravity-style pressure field with DeGroot-like
  drift. These are improved below, not reinvented.

---

## 1. Economy, population and growth

### 1.1 Logistic population growth instead of exponential-then-wall (S)
- **What:** Logistic growth means a population grows fast when small and slows smoothly as it
  nears what the land can feed (its carrying capacity K): `dP = r P (1 - P/K)`.
- **Now:** `src/engine/population.js` grows a region by a flat rate (`P x (1 + rate)`) and then
  hard-clamps it at `POPULATION_CAP_RATIO = 5` times the modern baseline. A region grows at full
  speed until it hits an invisible wall. Meanwhile cities (`src/engine/world/cities.js`) have their
  own size model (food bank, `growthThreshold = 15 + 6s + s^1.8`, housing cap). Two population
  models run side by side and only the old one feeds `getPopFactor` (income).
- **Player notices:** growth that visibly slows as land fills up, so building a Granary or
  aqueduct (which raises K) feels like it matters; no strange plateaus.
- **Sketch:**
  ```
  K = baseline x (1 + 0.6 x foodTier + 0.2 x infra) x techK(age)     // what the land can feed
  P' = P + r P (1 - P / K) - warLoss
  ```
  Better still, retire `population.js` for cities and derive the people from size the way Civ V
  does (displayed people grow roughly as size^2.8 x 1,000), so one model drives both income and
  display.
- **Risk:** low; income depends on `popFactor`, so run balance-sim before and after.
- **Source:** [Logistic function (Verhulst)](https://en.wikipedia.org/wiki/Logistic_function).

### 1.2 Cobb-Douglas output for cities: diminishing returns that reward balance (M)
- **What:** Output = A x Labour^a x Capital^b with a + b <= 1. Doubling only one input gives far
  less than double the output, so a balanced city beats a lopsided one.
- **Now:** `calcIncome` in `src/utils/helpers.js` multiplies dev x control x (1 + 0.1 infra) x
  popFactor, all linear, so the best strategy is to pile everything into one lever.
  `POP_FACTOR_MAX = 2` is again a hard clamp.
- **Player notices:** "build what is missing" is the right move; tall single cities stop
  dominating; the economy reads like an economy.
- **Sketch:** `gold = A x dev^0.5 x people^0.3 x infra^0.2` (normalised so today's typical city
  gets today's number). Use it inside the city yield step, not as a new layer.
- **Risk:** medium (touches every income number). Use the `add-mechanic` skill.
- **Source:** [Cobb-Douglas production function](https://en.wikipedia.org/wiki/Cobb%E2%80%93Douglas_production_function);
  Victoria 3 uses throughput and diminishing returns for the same reason
  ([production method wiki](https://vic3.paradoxwikis.com/Production_method)).

### 1.3 Soft caps instead of hard clamps everywhere (S)
- **What:** Replace `min(max, x)` with a smooth curve such as `max x tanh(x / max)` or
  `x / (1 + x / max)`. The value approaches the cap but every extra point still counts a little.
- **Now:** hard clamps in `getPopFactor`, `POPULATION_CAP_RATIO`, `BANK_CAP`, loan capacity,
  stability, prestige.
- **Player notices:** no dead zones where an action silently does nothing.
- **Risk:** low.

### 1.4 Research cost curve tied to the science curve (S)
- **What:** If science output grows roughly geometrically through the ages, tech costs should too,
  so "turns per tech" stays steady (Civ's design target).
- **Now:** `RESEARCH_AGE_BASE = { bronze: 24, classical: 85, kingdoms: 135, gunpowder: 140,
  modern: 290 }` in `src/engine/research.js`: jumps then a flat step from kingdoms to gunpowder.
- **Sketch:** log, per age, the median science per turn from balance-sim; fit
  `cost(age) = c x g^ageIndex` so median turns per tech is constant, then hand-tune flavour.
- **Player notices:** an even rhythm of discoveries; no age that drags.
- **Risk:** low with the sim.

---

## 2. War and combat

### 2.1 Closed-form Lanchester estimate for the AI and for instant previews (S)
- **What:** Lanchester's square law says a force's fighting power goes as (effectiveness x
  numbers²). It gives an instant, deterministic estimate of who wins and how much is left.
- **Now:** The player gets 200 Monte Carlo samples (`battleOdds.js`), which is good. The AI does
  not: relief attacks use a raw strength ratio (`RELIEF_RATIO = 1.2` in `src/engine/threat.js`),
  war targets use `militaryStrength / (1 + wars)` (`pickWarTarget`, `src/utils/aiLogic.js`), and AI
  wars out of sight use `AI_CAPTURE_BASE_CHANCE x aggressorShare` (`diplomacy.js`). None of these
  know about terrain, walls, counters or age, which the real battle does.
- **Sketch:**
  ```
  powerA = sum(strength) x matchup(A,B) x terrainMult x ageMult        // already computed in explainInvasion
  powerB = sum(strength) x matchup(B,A) x walls
  pWin(A) ~ 1 / (1 + exp(-k x ln(powerA² / powerB²)))   // fit k once against battleOdds samples
  survivors(A) = sqrt(powerA² - powerB²) / effA         // square law
  ```
  Calibrate k with a one-off script that runs `estimateInvasionOdds` on a few thousand fixtures.
- **Player notices:** the AI stops attacking walled cities with "equal" armies and stops ignoring
  a weak stack on open ground; out-of-sight wars resolve consistently with visible ones.
- **Risk:** low. Note the empirical caveat: real battle data (Kursk, Ardennes) fit Lanchester only
  loosely, so use it as the AI's estimate, not as the combat rule.
- **Sources:** [Lanchester's laws](https://en.wikipedia.org/wiki/Lanchester%27s_laws);
  [Lucas and Turkes, fitting Lanchester to Kursk and Ardennes (2004)](https://ideas.repec.org/a/wly/navres/v51y2004i1p95-116.html).

### 2.2 Show odds the way people read them (S)
- **What:** Players overrate good odds: Sid Meier's GDC 2010 keynote reported Civ Revolution
  players at 3:1 odds felt cheated by any loss, so Firaxis quietly bent the odds. A safer fix is
  presentation: show a range, not a single number.
- **Now:** `battleOdds.js` returns `attacker`, `defender`, `stalemate` shares from 200 samples.
- **Sketch:** show a Wilson interval and words: 0.9+ "almost certain", 0.7 to 0.9 "likely",
  0.4 to 0.6 "a coin flip". With n = 200 the 95% interval is about ±7 points; show "about 70%",
  never "71%". Also show the median losses band (25th to 75th percentile), which players care
  about as much as winning.
- **Risk:** none (UI only).
- **Source:** [Sid Meier, The Psychology of Game Design, GDC 2010](https://www.gamespot.com/articles/meier-on-crafting-the-epic-journey-full-keynote-video-inside/1100-6253256/),
  [notes from the talk](https://alexx-kay.livejournal.com/284738.html).

### 2.3 Bad-luck protection for battle fortune and disasters (S)
- **What:** Pseudo-random distribution (PRD, Warcraft III and Dota 2) raises the chance after each
  failure and resets on success: same average, far fewer long streaks. A bag randomiser (Tetris
  7-bag) guarantees every outcome appears once per bag.
- **Now:** `BATTLE_FORTUNE = 0.3` per side per battle (`src/engine/battle.js`) is a fresh draw
  every battle; `cityDisasters.js` rolls each city independently (with a 30-turn cooldown, which
  already helps). XCOM 2 adds a hidden aim bonus after misses on lower difficulties.
- **Sketch (fortune):** store `nation.fortuneDebt`; `fortune = clamp(draw + 0.5 x debt)`; after the
  battle `debt += (0 - fortune)`. A string of bad dice is paid back. Deterministic because the
  debt lives in state.
- **Player notices:** fewer "I lost three 80% battles in a row" moments. Keep it off on the hardest
  difficulty, like XCOM.
- **Risk:** low; a field on the nation record (save version bump not needed if it defaults to 0).
- **Sources:** [Dota 2 pseudo-random distribution](https://dota2.fandom.com/wiki/Random_Distribution),
  [Tetris random generator (7-bag)](https://tetris.wiki/Random_Generator),
  [XCOM 2 difficulty and hidden aim](https://xcom.fandom.com/wiki/Game_difficulty_(XCOM_2)).

### 2.4 Elo or TrueSkill for generals and for AI strength (M)
- **What:** Elo and TrueSkill rate players from results. A general who keeps winning against
  stronger odds should earn more than one who wins easy fights.
- **Now:** generals have a fixed four-axis skill (`src/data/generals.js`); experience comes from
  promotions.
- **Sketch:** after a battle, `expected = 1 / (1 + 10^((rB - rA)/400))` using the Lanchester
  estimate as the "rating gap"; `rA += K x (result - expected)`. Upsets give big reputation,
  prestige and a renown title; stomps give little.
- **Second use (tooling):** run the AI difficulties against each other in the headless sim and give
  each a TrueSkill rating, so "King is harder than Prince" is measured, not hoped.
- **Risk:** low.
- **Source:** [TrueSkill (Microsoft Research)](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/),
  [Elo rating system](https://en.wikipedia.org/wiki/Elo_rating_system).

---

## 3. AI decision making

### 3.1 Utility AI with response curves (M)
- **What:** Score every option with a few normalised factors, each passed through a curve
  (linear, logistic, quadratic), multiply them, and pick the best (or a weighted random from the
  top few). It replaces if/then priority lists that flip abruptly.
- **Now:** `src/engine/aiProduction.js` is a fixed priority list (settler, then the next building
  in the doctrine order, then a wonder, then infantry). War targets pick the weakest neighbour.
  The war roll is a product of multipliers (`shouldDeclareWar`), which is half way there.
- **Sketch:**
  ```
  score(granary) = need(foodDeficit)            // logistic around 0
                 x room(housingGap)
                 x affordability(turnsToBuild)  // 1 at 5 turns, 0 at 40
                 x doctrineWeight x rulerBias
  pick argmax, or weighted random among the top 3 seeded from rngSeed
  ```
- **Player notices:** AI cities that build walls when threatened, granaries when starving, and
  armies before a war, not after. AIs feel different from each other without new data.
- **Risk:** medium (AI cost per turn; score only on the existing think periods).
- **Sources:** [Dave Mark and Kevin Dill, Improving AI Decision Modeling Through Utility Theory, GDC 2010](https://www.gdcvault.com/play/1012410/Improving-AI-Decision-Modeling-Through)
  ([slides](https://media.gdcvault.com/gdc10/slides/MarkDill_ImprovingAIUtilityTheory.pdf)).

### 3.2 Influence maps on the hex grid (M)
- **What:** Each army and city spreads "influence" to nearby tiles, fading with distance. Summing
  own minus enemy influence gives a map of fronts, safe zones, weak spots and contested land.
- **Now:** `threat.js` sums enemy strength within 6 rings of a city; `sight.js` grows rings;
  `aiOperations.js` walks a BFS over regions. Each system rebuilds its own ring sums.
- **Sketch:** one `Float32Array(56252)` per nation per turn (only for Tier-1 AIs):
  ```
  inf[t] = sum over units u: strength(u) x decay^ringDist(u,t)   // propagate with 3 to 6 BFS waves
  tension = own + enemy, vulnerability = enemy - own
  ```
  Uses: attack the city with the highest `value / vulnerabilityCost`, defend where `vulnerability`
  is high, settle where both are low, route marches around enemy influence.
- **Player notices:** AI lines that hold chokepoints, flank weak points, and do not walk past your
  army.
- **Risk:** medium for performance; budget it with PERF_CHECKS.
- **Sources:** [Dave Mark, Modular Tactical Influence Maps (Game AI Pro 2, ch. 30)](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf),
  [Kevin Dill, Spatial Reasoning for Strategic Decision Making (ch. 31)](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter31_Spatial_Reasoning_for_Strategic_Decision_Making.pdf).

### 3.3 The bargaining model of war for peace and war decisions (M)
- **What:** Political science's standard model: a war is a costly lottery. A side wins with
  probability p and both pay costs, so a rational side accepts any deal worth more than
  `p x prize - cost`. Wars start when sides disagree about p (bluffing, hidden armies) or cannot
  trust a deal to hold.
- **Now:** `getPeaceAcceptance` in `src/engine/peace.js` is an additive ledger (war score, 0.4 x
  exhaustion, `20 x (2 x share - 1)`, weariness, capital). It is readable, but it cannot tell "I
  am losing slowly" from "I will win next turn".
- **Sketch:**
  ```
  p        = Lanchester pWin of my field army vs theirs (2.1), nudged by war score
  EV(fight on) = p x value(their cities I can take) - (1-p) x value(mine at risk) - costPerTurn x T
  accept  iff  value(terms) >= EV(fight on) - fudge(personality)
  declare iff  EV(war) > 0 and opinion low and target not in a pact that flips p
  ```
  Keep the ledger as the explanation shown to the player; compute its lines from these terms.
  Fog matters: the AI's p uses what its sight and intel show, so hidden armies cause "mistaken"
  wars, exactly Fearon's information problem.
- **Player notices:** AIs that sue for peace when it is hopeless, refuse silly demands, and
  occasionally miscalculate in believable ways.
- **Risk:** medium; behaviour change, needs balance-sim (wars per 100 turns, peace lengths).
- **Sources:** [Fearon, Rationalist Explanations for War (1995)](https://williamspaniel.com/wp-content/uploads/2019/04/rationalist-explanations-for-war.pdf),
  [Bargaining model of war](https://en.wikipedia.org/wiki/Bargaining_model_of_war).

### 3.4 Balance of threat, not balance of military (S)
- **What:** Nations ally against whoever is most threatening: power x proximity x hostile intent,
  not just the biggest army (Walt's balance of threat).
- **Now:** `findRunawayLeader` (`aiLogic.js`) uses world military share >= 15%. A huge distant
  empire triggers coalitions everywhere; a fast-growing neighbour does not.
- **Sketch:** `threat(A→B) = power(A) x 1/(1 + rings(A,B))² x (1 + AE(A in B's eyes)/20) x
  growthRate(A)`; each nation joins a coalition against its own top threat when it exceeds a
  threshold. EU4 does the outraged-at-AE version of this.
- **Player notices:** coalitions that are local and make sense; blobbing at home is dangerous,
  overseas less so.
- **Risk:** low.
- **Source:** [EU4 aggressive expansion and coalitions](https://eu4.paradoxwikis.com/Aggressive_expansion),
  [Balance of threat](https://en.wikipedia.org/wiki/Balance_of_threat).

### 3.5 Richardson arms races (S)
- **What:** Each side's armament grows with the rival's and shrinks with its own burden:
  `dx/dt = a y - m x + g`. It produces arms races and also lets tension cool.
- **Now:** AI recruitment is a per-turn chance (`processAIRecruitment`), not a response to rivals.
- **Sketch:** target army size `= g + a x rivalStrength x hostility/100`, capped by upkeep; recruit
  toward the target.
- **Player notices:** neighbours who arm when you arm (and you can see why), and calm borders
  that stay calm.
- **Source:** [Richardson's arms race model](https://en.wikipedia.org/wiki/Arms_race#Richardson_model).

### 3.6 Monte Carlo Tree Search for the campaign AI's war plans (L, big bet)
- **What:** MCTS tries many short random futures for each candidate plan and keeps the plans
  that win most. Total War: Rome II's campaign AI used it for task allocation.
- **Where:** only the decision "which war goal, which stacks, which order", using the existing
  pure `gameReducer` plus the Lanchester estimate as a cheap rollout, a few hundred rollouts per
  Tier-1 nation per 5 turns, in a Web Worker.
- **Player notices:** AI campaigns with a plan (feint, then strike the real target).
- **Risk:** high CPU on phones; must be time-sliced and seeded.
- **Sources:** [Champandard, MCTS in Total War: Rome II's Campaign AI](http://aigamedev.com/open/coverage/mcts-rome-ii/),
  [MCTS and related algorithms for games (Game AI Pro 2, ch. 25)](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter25_Monte_Carlo_Tree_Search_and_Related_Algorithms_for_Games.pdf).

---

## 4. Pathfinding, logistics and roads

### 4.1 A tighter A* heuristic (S, quick win)
- **What:** A* is fast only when its distance guess is close to the true cost. The guess must
  never overestimate.
- **Now:** `findTilePath` (`armies.js`) uses `h = km / 170 x minStep` with `minStep = 0.5` (road)
  or 0.25 (rail). The longest neighbour step on the real grid is 112.4 km, so dividing by 170
  makes the guess 34% weaker than it needs to be, and the road factor halves it again. Same in
  `fleets.js`.
- **Sketch:** set `KM_PER_STEP_MAX = 113` (measured, with a test that asserts it against the grid).
  Then for the road factor, use the cheapest step that can actually occur in the region: if the
  nation has no roads at all, `minStep = 1`. That alone can roughly halve searched nodes on long
  marches.
- **Risk:** very low; paths stay optimal, just faster.

### 4.2 Landmarks (ALT) for long routes (M)
- **What:** Precompute true travel cost from a dozen "landmark" tiles to every tile. By the
  triangle inequality, `|d(L,goal) - d(L,t)|` is a valid and much tighter heuristic.
- **Where:** `findTilePath`, `tradeRoutes.js` (56-tile caravan paths), settler routing, AI marches.
- **Sketch:** 16 landmarks on the land graph x 16,523 land tiles x Uint16 = 0.5 MB, built once
  per game for open-land costs (roads and borders only lower or block, so the bound stays a lower
  bound if you use the cheapest possible cost per tile). `h(t) = max over L |d(L,to) - d(L,t)|`.
- **Player notices:** snappier route previews on phones; AI can afford more route queries.
- **Source:** [Goldberg and Harrelson, Computing the Shortest Path: A* Search Meets Graph Theory](https://www.microsoft.com/en-us/research/publication/computing-the-shortest-path-a-search-meets-graph-theory/).

### 4.3 Flow fields on the world grid for AI fronts (M)
- **What:** One Dijkstra from a goal gives every tile its next step toward it, so many armies
  heading to the same city share one search. The tactical sim already does this.
- **Now:** each AI stack runs its own `findTilePath`.
- **Sketch:** reuse the integer bucket queue from `src/battle/sim/pathing.js` on the hex graph,
  one field per war goal per turn.
- **Risk:** low.
- **Source:** [Red Blob Games, flow field pathfinding](https://www.redblobgames.com/pathfinding/tower-defense/).

### 4.4 Supply as network flow (L, big bet)
- **What:** Supply moves from cities along roads, rivers and sea lanes with limited capacity per
  link. Max-flow tells how many units a front can feed; the min cut shows the one bridge that
  starves the army if lost.
- **Now:** `supplyMeter.js` gives a per-unit meter by land type and "own land within N rings".
  There is no notion of a supply line that can be cut, except through roads on tiles.
- **Player notices:** cutting a road or blockading a port starves an army far away, and the
  supply lens can show the bottleneck in red. Deep-strike raids become a strategy.
- **Sketch:** a coarse graph (city nodes, road/river/sea edges, capacity by road tier), push
  supply with Edmonds-Karp each turn only for nations at war; units beyond flow capacity get the
  "wild" loss.
- **Risk:** high design scope; performance OK on a city-level graph (a few thousand nodes).
- **Source:** [Max-flow min-cut theorem](https://en.wikipedia.org/wiki/Max-flow_min-cut_theorem).

### 4.5 Road networks the AI plans as trees (M)
- **What:** A minimum spanning tree (or a Steiner tree) links all cities with the least total
  road. Cheap and realistic (Roman roads look like this).
- **Now:** roads are a tile improvement built by city production; `aiProduction.js` never plans a
  network.
- **Sketch:** nodes = own cities, edge weight = A* cost; Kruskal; queue road improvements on the
  path tiles of the tree edges, capital edges first. Offer the same as "auto-road" to the player.
- **Player notices:** AI empires that look connected; armies and trade move faster in developed
  nations.
- **Source:** [Minimum spanning tree](https://en.wikipedia.org/wiki/Minimum_spanning_tree).

---

## 5. Diplomacy and the world graph

### 5.1 Shapley values for splitting war spoils (S)
- **What:** The Shapley value splits a team's winnings by each member's average marginal
  contribution. It is the textbook "fair split".
- **Now:** pact members are called to arms (`declareWar` in `diplomacy.js`) but peace deals do not
  divide spoils among allies by contribution.
- **Sketch:** with 2 to 4 allies, enumerate coalitions exactly: value(S) = war score that S's
  battles and occupations produced. Ally i gets `phi_i = average over orderings of v(S∪i) - v(S)`.
  Show it as "Your allies expect: Austria 40%, Bavaria 25%..."; an ally that gets less than its
  share loses opinion.
- **Player notices:** allies who care about loot, and a reason to actually fight in a war you
  were dragged into.
- **Source:** [Shapley value](https://en.wikipedia.org/wiki/Shapley_value).

### 5.2 Centrality to value chokepoints (S)
- **What:** Betweenness centrality counts how many shortest paths pass through a node. On the
  trade and movement graph it finds Constantinople, Suez, Gibraltar, Malacca automatically.
- **Where:** a one-off build step over cities (land and sea lanes), stored as data; used by AI war
  goals (value of a city), trade income and wonders.
- **Player notices:** the AI fights for the cities history fought for.
- **Source:** [Betweenness centrality](https://en.wikipedia.org/wiki/Betweenness_centrality).

### 5.3 War contagion as a Hawkes process (S)
- **What:** A Hawkes process is "events make more events, then calm down": each war raises the
  chance of nearby wars for a while, with exponential decay. It fits conflict, riots and
  aftershocks.
- **Now:** the AI war roll (`shouldDeclareWar`) has no memory of recent nearby wars.
- **Sketch:** per nation `heat = sum over recent wars within R rings: alpha x exp(-(now - t)/tau)`;
  `chance x= (1 + heat)`. With alpha x tau < 1 the world stays stable (no runaway).
- **Player notices:** history with eras of turmoil and eras of peace, not a constant drizzle.
- **Sources:** [Hawkes process](https://en.wikipedia.org/wiki/Hawkes_process),
  [review of self-exciting models of conflict and terrorism](https://arxiv.org/pdf/1903.08485).

### 5.4 Bounded-confidence opinion dynamics for culture (S)
- **What:** In the Hegselmann-Krause model people only move toward views close to their own.
  Applied to culture, a city assimilates to a related culture quickly and to a very foreign one
  slowly.
- **Now:** `loyalty.js` drifts culture shares 5% toward the pressure shares every third turn
  (essentially DeGroot averaging, which always converges).
- **Sketch:** `drift = CULTURE_DRIFT x similarity(cultureA, cultureB)` where similarity comes from
  culture groups or identity axes; also fix `KM_PER_RING = 147` to the real grid (about 102),
  re-tuning `PRESSURE_RINGS` with balance-sim.
- **Player notices:** conquered lands of a distant culture stay restless for generations;
  neighbours of the same group integrate fast.
- **Source:** [DeGroot learning](https://en.wikipedia.org/wiki/DeGroot_learning),
  [Bounded confidence model](https://en.wikipedia.org/wiki/Bounded_confidence_model).

---

## 6. Trade, technology and plague

### 6.1 Gravity model for trade income (S to M)
- **What:** Trade between two places grows with both economies and falls with distance:
  `T = G x (Ya x Yb) / d^beta`. It is the most reliable law in empirical economics.
- **Now:** a trade pact gives a flat +5% gold (`modifiers/sources.js`), and `tradeRoutes.js`
  finds the caravan path but its length does not change the value.
- **Sketch:** `routeGold = G x sqrt(gdpA x gdpB) / (1 + pathCost)^0.8`; sea routes get a cheaper
  cost per tile; pass through a third nation's land and it takes a toll (link to 5.2).
- **Player notices:** trade with a rich neighbour is worth more than with a poor distant one;
  roads and ports raise trade; trade wars mean something.
- **Source:** [Gravity model of trade](https://en.wikipedia.org/wiki/Gravity_model_of_trade).

### 6.2 Tech diffusion by world share, Bass-style (S)
- **What:** The Bass model says adoption speeds up with how many have adopted already
  (imitation). Civ IV's tech cost uses the share of known civs that have the tech.
- **Now:** `techDiffusion.js` counts bordering nations with the tech (6% each, up to 5) and adds a
  20% pioneer surcharge. A nation across the sea from all the holders gets no discount; one with
  many tiny neighbours gets a big one.
- **Sketch:**
  ```
  share = (holders I border or trade with, weighted by their size) / (all nations I know, weighted)
  mult  = 1 / (1 + 0.3 x share)  x (pioneer ? 1.2 : 1)        // Civ IV's form
  ```
- **Player notices:** trade partners carry ideas; isolated nations fall behind, as Japan did
  before 1853; catch-up is smoother.
- **Sources:** [Bass diffusion model](https://en.wikipedia.org/wiki/Bass_diffusion_model),
  [Civ IV technology research explained](https://civfanatics.com/civ4/strategy/game-mechanics/technology-research-explained/).

### 6.3 Plague as an SIR epidemic along trade and armies (M)
- **What:** SIR splits people into Susceptible, Infected and Recovered:
  `dS = -beta S I / N`, `dI = beta S I / N - gamma I`. Epidemics spread, peak and burn out, and
  leave immunity.
- **Now:** `cityDisasters.js` rolls plague independently in each city (0.3% a turn, size >= 6).
  The Antonine plague and Black Death exist only as scripted events (`src/data/events.js`).
- **Sketch:** per city a small `{ i, r }` (shares). Each turn `i += beta x s x (i + sum over linked
  cities w x i_j) - gamma x i`, where links are trade routes, sea lanes and armies passing
  through. Seeds come from the scripted events and from rare rolls. Size loss = `i x mortality`.
  Quarantine (close borders), aqueducts and medicine techs lower beta.
- **Player notices:** a plague you can watch crossing the map on a lens, choices that matter
  (close the ports or keep the trade money), and real recovery and immunity afterward.
- **Risk:** medium; keep it rare and cheap (only cities with i > 0 are touched).
- **Source:** [Compartmental models in epidemiology](https://en.wikipedia.org/wiki/Compartmental_models_in_epidemiology).

---

## 7. History-scale dynamics (realism)

### 7.1 Turchin's asabiya: why empires rise and fall (L, big bet)
- **What:** Peter Turchin's model: cohesion (asabiya) rises at frontiers under pressure and decays
  in a safe, large interior. Empires form at frontiers, expand, then rot from the middle.
- **Now:** anti-snowball tools exist (AE, coalitions, loyalty, the pioneer surcharge), but nothing
  makes a big, safe empire weaker from inside over time.
- **Sketch:** per nation `A' = A + r0 x A x (1 - A) x frontierShare - delta x A x (1 - frontierShare)`;
  power = size x A; low A raises unrest, civil war and estate takeover chances (`civilWar.js`,
  `disasters.js`).
- **Player notices:** a 4,300-year game with natural cycles of rise and decline; holding a giant
  empire becomes a fight against time, not just neighbours.
- **Risk:** high (it is a pillar); start as a soft modifier.
- **Sources:** [Turchin's metaethnic frontier model, a NetLogo replica](https://www.comses.net/codebases/15a2fc42-90bd-42c4-b21b-dfba428cdb16/releases/1.0.0/),
  [ABM tutorial chapter on the model](https://bookdown.org/amesoudi/ABMtutorial_bookdown/model12.html),
  [Structural-demographic theory](https://en.wikipedia.org/wiki/Structural-demographic_theory).

### 7.2 Realism checks from known laws (S, tooling)
- **Zipf's law for cities:** the largest city is about twice the second, three times the third.
  Measure city sizes per nation in balance-sim; if every city is the same size the economy is
  too flat. [Rank-size distribution](https://en.wikipedia.org/wiki/Rank-size_distribution).
- **Central place theory:** settlements space themselves in a hexagonal hierarchy. The settler
  site score (`scoreSite` in `settlers.js`) could add a penalty for being close to a bigger city
  and a bonus at the edge of its market area. [Central place theory](https://en.wikipedia.org/wiki/Central_place_theory).

---

## 8. Balance and fairness

### 8.1 Statistics in the balance-sim comparison (S, quick win)
- **What:** Compare the same seeds before and after (paired samples) and report a confidence
  interval, not a single average. Paired comparisons cancel most of the seed-to-seed noise.
- **Now:** the plan log says changes are "within the spread between seeds" (3 seeds). The
  balance-sim skill's `compare.sh` reports means.
- **Sketch:** per metric `diff_s = after_s - before_s` for each seed s; report `mean ± 1.96 x sd /
  sqrt(n)` or a bootstrap interval; mark a change "real" only if the interval excludes 0. Add a
  rule of thumb: seeds needed `n ~ (2.8 x sd / effect)²`.
- **Player notices:** nothing directly; every later balance change becomes trustworthy.
- **Source:** [Bootstrapping (statistics)](https://en.wikipedia.org/wiki/Bootstrapping_(statistics)).

### 8.2 Runaway detection with Gini, HHI and survival curves (S)
- **What:** The Gini coefficient (0 = equal, 1 = one owner) and the Herfindahl index (sum of
  squared shares) summarise inequality in one number. A Kaplan-Meier survival curve shows how
  long nations last.
- **Now:** `worldStats.sim.js` reports `topNationProvinces` and `topMilitaryToMedian`.
- **Sketch:** each 10 turns record Gini of cities, people and score across living nations, HHI of
  land, number of lead changes in `rankNations`, and the share of nations still alive. Targets
  come from history (for example, the largest empire of each age held a few percent to a quarter
  of the world's land, see Taagepera's empire-size data).
- **Player notices:** fewer games where one AI eats a continent by turn 100, or none ever moves.
- **Sources:** [Gini coefficient](https://en.wikipedia.org/wiki/Gini_coefficient),
  [Herfindahl-Hirschman index](https://en.wikipedia.org/wiki/Herfindahl%E2%80%93Hirschman_index),
  [Kaplan-Meier estimator](https://en.wikipedia.org/wiki/Kaplan%E2%80%93Meier_estimator).

### 8.3 Automated tuning with Bayesian optimisation (M to L)
- **What:** Treat the headless sim as a black-box function from constants to metrics, and let an
  optimiser (Optuna's TPE, CMA-ES, or a bandit over a few candidate values) search for constants
  that hit target metrics.
- **Where:** `scripts/simulate.mjs` already runs N seeded games. Candidate knobs:
  `BASE_WAR_ROLL_CHANCE`, `AI_CAPTURE_BASE_CHANCE`, `COALITION_MILITARY_SHARE_THRESHOLD`,
  `DIFFUSION_PER_NEIGHBOR`, `PIONEER_MULT`, `CULTURE_DRIFT`, research costs.
- **Sketch:** loss = sum of squared distances from targets (wars per 100 turns, Gini of land at
  turn 150, nations alive, player income curve); 3 seeds x 150 turns per trial (about 2 minutes);
  run 100 trials overnight with common random numbers. Output a table, a human picks.
- **Player notices:** a world that plays as designed across seeds, without endless hand tuning.
- **Sources:** [Metagame Autobalancing for Competitive Multiplayer Games (uses Optuna TPE)](https://arxiv.org/pdf/2006.04419),
  [RuleSmith, Bayesian optimisation on a Civ-like game](https://arxiv.org/abs/2602.06232).

### 8.4 Catch-up curves and a gentle dynamic difficulty (S to M)
- **What:** Dynamic difficulty adjustment (Hunicke's Hamlet) nudges the game when a player is
  struggling. In a strategy game it should be visible and themed, not secret.
- **Now:** difficulty is fixed at start (`src/data/difficulty.js`: yields and aggression). The plan
  log notes a passive player loses its only city by turn 29.
- **Sketch:** an early-game protection curve: AI war-roll multiplier against small nations
  `= 1 - exp(-turn / 25)` for the first ages, and a "Rally" bonus for a nation that lost its
  capital: defence `x (1 + 0.3 x exp(-turnsSinceLoss / 10))`. An optional "Adaptive" difficulty
  that moves `aiAggressionMult` by at most ±0.2 toward the player's rank, shown in the UI.
- **Risk:** players dislike hidden rubber bands; keep it named and optional.
- **Source:** [Hunicke, The Case for Dynamic Difficulty Adjustment in Games (2005)](https://dl.acm.org/doi/pdf/10.1145/1178477.1178573).

---

## 9. Map, procedural generation and rendering

### 9.1 Distance-field borders on the globe and flat map (M)
- **What:** Instead of stroking border polygons, store a distance-to-border value per pixel (a
  signed distance field, built on the GPU with the jump flooding algorithm). A shader then draws
  crisp borders at any zoom, soft inner glows, war stripes and a fog edge, all from one texture.
  Paradox-style borders are made this way.
- **Now:** `src/components/globe/politicalTexture.js` paints fills and border strokes on a 2D
  canvas in equirectangular projection, then uploads it; `Map2DView.jsx` draws SVG paths whose
  stroke width is divided by zoom. Borders blur when the globe zooms and redraw is CPU heavy.
- **Sketch:** render owner ids into a low-res texture (one texel per hex or finer), run JFA in
  log2(N) passes to get distance to the nearest different owner, then in the fragment shader:
  `border = smoothstep(w, w - aa, dist)`, `glow = exp(-dist / falloff) x nationColour`.
- **Player notices:** sharp, beautiful borders at every zoom and cheaper redraws on phones.
- **Risk:** medium (WebGL work on the globe and the flat map).
- **Sources:** [Jump flooding algorithm](https://en.wikipedia.org/wiki/Jump_flooding_algorithm),
  [Valve, Improved Alpha-Tested Magnification for Vector Textures (SDF), SIGGRAPH 2007](https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf),
  [a grand-strategy JFA border shader discussion](https://discussions.unity.com/t/how-to-optimize-and-improve-this-jump-flood-and-distance-field-shader-grand-strategy-faction-borders-shader/1694427).

### 9.2 Poisson-disc trees and noise-shaped forest edges (S)
- **What:** Poisson-disc sampling places points randomly but never too close (blue noise), which
  looks natural. Noise fades the density toward the forest edge so woods do not look like round
  blobs per hex.
- **Now:** `treeSpots` in `src/components/map/closeView/landscape.js` places 22 trees per hex at
  hashed uniform positions in a disc (white noise: clumps and gaps, and each forest hex reads as a
  round patch). `occupancy.js` checks overlap with `discs.some(...)`, which is quadratic.
- **Sketch:** precompute one Poisson-disc tile (Bridson, about 60 points) and reuse it per hex with
  a hashed rotation; keep a tree only if `noise(lat, lon) > edgeThreshold(neighbourIsForest)`.
  Give `occupancy.js` a uniform grid (spatial hash) so each test is O(1).
- **Player notices:** natural woods that flow across hex edges; steadier frame rate when zoomed in.
- **Source:** [Bridson, Fast Poisson Disk Sampling (2007)](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf),
  [Red Blob Games, making maps with noise](https://www.redblobgames.com/maps/terrain-from-noise/).

### 9.3 Even out the hex grid (L, big bet)
- **What:** A spherical centroidal Voronoi tessellation (Lloyd relaxation on the sphere) moves
  cell centres until every cell has nearly the same area.
- **Now:** neighbour spacing ranges 76.5 to 112.4 km (measured), so hex areas differ about 2x.
  Movement points, border rings, yields per hex and sight cover very different real areas in
  different parts of the world.
- **Sketch:** in `scripts/geo/build-tiles.mjs`, after `buildGrid(75)`, run 20 to 50 Lloyd
  iterations on the sphere keeping the neighbour graph; recompute `tiles.json`.
- **Player notices:** fairer starts and movement; no oddly dense hex patches.
- **Risk:** high: a save break (version 9) and every test fixture that uses tile ids. Only worth it
  together with another planned break.
- **Source:** [Centroidal Voronoi tessellation](https://en.wikipedia.org/wiki/Centroidal_Voronoi_tessellation),
  [Lloyd's algorithm](https://en.wikipedia.org/wiki/Lloyd%27s_algorithm).

### 9.4 A better flat-map projection (M)
- **What:** Equirectangular stretches the north: at 60 degrees latitude land is drawn twice as wide
  as it is. An equal-area world view (Equal Earth) or a local view centred where the player looks
  (an oblique projection, re-centred as they pan) removes that.
- **Now:** `Map2DView.jsx` and `politicalTexture.js` use `geoEquirectangular`. Russia, Scandinavia
  and Canada look bigger than they play.
- **Sketch:** d3 has `geoEqualEarth` and `.rotate()`; the raster needs reprojecting in a shader
  (look up lat/lon per pixel), which pairs well with 9.1.
- **Risk:** medium; hit-testing and markers use the projection already, so mostly plumbing.
- **Source:** [Equal Earth projection](https://en.wikipedia.org/wiki/Equal_Earth_projection).

### 9.5 Octahedral impostors for far towns and armies (M)
- **What:** Render a model from many angles into one texture once, then draw a far model as a
  single camera-facing quad that picks the right view.
- **Now:** `CloseViewLayer.jsx` uses instancing and `lodForZoom`; there are many town GLBs.
- **Player notices:** more towns on screen at the same frame rate on phones.
- **Source:** [ShaderBits, Octahedral Impostors](https://shaderbits.com/blog/octahedral-impostors).

---

## 10. Performance and determinism

### 10.1 Typed, persistent arrays for the tile world (M)
- **What:** Store tile ownership as an `Int32Array` of city indices, and update it with
  copy-on-write chunks (persistent arrays) instead of copying a 16,000-key object.
- **Now:** `world.tileOwner` is a plain object keyed by tile (`cities.js`), copied with
  `{ ...world.tileOwner }` on claims; the plan log names this copy as 34 ms of the cities phase.
- **Sketch:** split 56,252 tiles into 220 chunks of 256; a write copies only its chunk; old states
  share untouched chunks. Saves serialise to a compact array.
- **Player notices:** faster turns, especially on phones.
- **Risk:** medium (many readers; wrap access in `ownerOf(tile)` first, then swap the storage).
- **Source:** [Game Programming Patterns, Dirty Flag](https://gameprogrammingpatterns.com/dirty-flag.html),
  [Persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure).

### 10.2 Level of detail for the simulation itself (M)
- **What:** Simulate far-away, quiet nations less often or more coarsely, like rendering LOD.
- **Now:** some of this exists (Tier-1/2 AIs, think periods, "out of sight a war is dice").
- **Sketch:** stagger every per-nation AI system by `(nationIndex + turn) mod k`, with k = 1 near
  the player or at war and k = 3 to 5 elsewhere, and scale effects by k so totals match. Budget
  the phase in ms, carry unfinished nations to the next turn (time slicing).
- **Player notices:** turn times closer to the 80 ms budget.
- **Risk:** medium; deterministic as long as the schedule depends only on state.

### 10.3 Cross-device determinism in the macro engine (S, quick win)
- **What:** In IEEE floating point, `+ - x /` and `Math.sqrt` give identical results on every
  engine, but `Math.acos`, `Math.sin`, `Math.exp` and `Math.pow` with non-integer powers may differ
  in the last bit between V8 (Chrome, Android, the edge server) and JavaScriptCore (iPhone
  Capacitor app). Tactical battles already avoid them (`src/battle/sim/fixed.js`).
- **Now:** `distanceKm` (`geodesic.js`) uses `Math.acos`, and loyalty pressure (`loyalty.js`)
  feeds those distances into weights that decide city flips; `growthThreshold` uses `size ** 1.8`
  (rounded, so safer). A one-bit difference can change a comparison and desync a replay or a
  shared save.
- **Sketch:** use chord length `sqrt(dx² + dy² + dz²)` (monotonic with arc length, deterministic)
  for comparisons and weights, or precompute ring distances; table `size ** 1.8` for size 1 to 30.
  Add an `enginePurity.test.js` rule that bans `Math.acos/sin/cos/exp/log/pow` in `src/engine`.
- **Source:** [Glenn Fiedler, Floating Point Determinism](https://gafferongames.com/post/floating_point_determinism/).

---

## 11. Numbers the player reads

### 11.1 Clean rounding and log scales (S)
- **What:** People perceive quantities on a log scale (Weber-Fechner). Show big numbers with two
  or three significant figures and use "nice numbers" (1, 2, 2.5, 5 x 10^k) for bars and scales.
- **Now:** `formatNumber` (`src/utils/helpers.js`) prints `1.0K`, `12.3K`, `999` and never `B`.
- **Sketch:** `sig3(n)`: 950, 1.2K, 12K, 120K, 1.2M, 1.2B; trailing `.0` dropped. Population and
  army bars on a log scale so a 2,000-man band and a 200,000-man army both read. Deltas as
  percentages when the base is large ("+3%"), as numbers when small ("+12").
- **Player notices:** calmer, more readable panels on a 844x390 phone screen.
- **Sources:** [Weber-Fechner law](https://en.wikipedia.org/wiki/Weber%E2%80%93Fechner_law),
  Heckbert, "Nice Numbers for Graph Labels", Graphics Gems (1990).

---

## Ranked

### (1) Quick wins (S, low risk)
1. Tighter A* heuristic and correct grid constants (4.1, plus the loyalty constant in 5.4).
2. Paired-seed statistics in balance-sim compare (8.1).
3. Gini, HHI, survival curve and Zipf metrics in balance-sim (8.2, 7.2).
4. Cross-device determinism fixes and a purity test (10.3).
5. Lanchester estimate for AI decisions and out-of-sight wars (2.1).
6. Tech diffusion by world share (6.2).
7. Bad-luck protection for battle fortune (2.3).
8. Odds shown as ranges and words (2.2).
9. Logistic population growth and soft caps (1.1, 1.3).
10. Poisson-disc trees and a spatial hash in `occupancy.js` (9.2).
11. Hawkes war contagion (5.3), balance of threat (3.4), Richardson arming (3.5).
12. Clean number formatting (11.1), research cost curve fit (1.4), Shapley spoils (5.1),
    centrality data (5.2), bounded-confidence culture (5.4).

### (2) Medium projects
1. Utility AI for AI production and war targets (3.1).
2. Bargaining-model peace and war (3.3).
3. Influence maps on the hex grid (3.2) and flow fields for fronts (4.3).
4. Typed, persistent tile arrays (10.1) and simulation LOD with time slicing (10.2).
5. Gravity-model trade (6.1).
6. SIR plague along trade and armies (6.3).
7. Distance-field borders (9.1).
8. Automated tuning with Bayesian optimisation (8.3).
9. Cobb-Douglas city output (1.2).
10. Landmark (ALT) pathfinding (4.2), MST road planning (4.5), Elo generals and TrueSkill-rated
    difficulties (2.4), catch-up curves (8.4), impostors (9.5), better projection (9.4).

### (3) Big bets
1. Asabiya cycles: empires that rise and rot (7.1).
2. MCTS war planning for Tier-1 AIs (3.6).
3. Supply as network flow with cuttable lines (4.4).
4. An equal-area hex grid via spherical Lloyd relaxation (9.3), timed with another save break.

---

## Recommended top 10, in order

1. **Fix the grid constants and tighten A*** (4.1, 5.4's constant). Measured bugs, an hour of
   work plus a balance-sim run; faster routes and culture that matches its own design.
2. **Paired statistics and runaway metrics in balance-sim** (8.1, 8.2). Every later item is tuned
   with it, so it goes first.
3. **Cross-device determinism guard** (10.3). Cheap insurance for replays, the edge server and the
   iPhone app.
4. **Lanchester estimates for AI decisions** (2.1). Small code, big jump in how sensible AI
   attacks, reliefs and out-of-sight wars are.
5. **Typed persistent tile ownership plus simulation LOD** (10.1, 10.2). Turns are 3 to 5 times
   over budget; this is the biggest lever.
6. **Utility AI for production and targets** (3.1). The AI feels alive and differs by ruler and
   doctrine.
7. **Bargaining-model peace and war** (3.3). Peace deals and wars that make sense, with fog
   creating believable mistakes.
8. **Logistic growth, soft caps and one population model** (1.1, 1.3). Removes walls and the
   double population model.
9. **Gravity trade plus share-based tech diffusion** (6.1, 6.2). Connects trade, roads and ideas,
   and helps laggards catch up the historical way.
10. **SIR plague and Hawkes war contagion** (6.3, 5.3). The most visible "history happens" upgrade:
    plagues you can watch spread and eras of turmoil.

Close runners-up: distance-field borders (9.1) for looks, and automated tuning (8.3) once items
2 and 4 are in.

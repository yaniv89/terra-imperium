# Terra Imperium: campaign-linked RTS battles

Design proposal, 5 October 2026. Source baseline: `claude/bronze-towns` at `81b933b7d2125ddf567833eae3f7b92900bffb2a`. This is a detailed implementation plan, not an implemented feature or a benchmark report. Numerical balance values and performance budgets below are starting targets to test.

Army-scale revision: large armies fighting simultaneously are a core requirement. Replace the earlier 160-population ceiling, 60-population opening deployment and ten-soldier foot regiments with the larger scale below. The 500/1,000 figures are proposed scenario capacities and engineering targets, not measured device capabilities or a promise of unlimited units.

City/terrain revision: the battlefield also includes the invaded city's passive, individually destructible buildings, alongside operational RTS facilities. Geography, architecture, layout and prior destruction are shared with the campaign map. Detailed world-art, hex-fit, source audit, additional asset counts and incremental effort are in [the world terrain and city destruction companion plan](terra-imperium-world-art-and-city-destruction-plan.md).

Building-identity clarification: the defending city contains the exact buildings/components it has on the world map, with matching built tiers, asset variants, landmarks, walls, relative placement and damage. Both views consume one versioned `CityStructureManifest`; a generic city chosen by biome/development is insufficient.

## 1. Product decision

City attacks become full RTS battles: deploy the army brought from the campaign, establish an expedition base, gather local resources, construct production and defensive buildings, train reinforcements, raid the enemy economy, and capture or destroy the enemy's military position. Defenders start with the city's actual infrastructure and garrison. Individual workers, soldiers, vehicles and siege engines are selectable; control groups and formation orders make larger armies manageable.

The intended feel combines Age of Empires' workers, resources, terrain and base growth with Red Alert 2's responsive commands, recognizable production buildings, rally points and clear counters. Buildings go up through workers/engineers, rather than appearing instantly from a sidebar. This also gives opponents an opportunity to interrupt construction.

Each participant's effective campaign era and researched technology are frozen when the battle starts. There is no age-up button, era research, or automatic roster upgrade during the battle. A Classical nation fights with its own Classical roster even if its opponent is in the Kingdoms era. Battle buildings can unlock access to already-known equipment; they cannot grant a future era.

Recommended defaults:

| Decision | Default |
|---|---|
| Main release | Single-player campaign city assaults and defense |
| City battle clock | 45 simulation minutes, with conditional overtime capped at 60 |
| Expected ordinary city battle | 20–35 minutes after tuning; 45 is a deadline, not a required duration |
| Field encounter | Separate 15–25 minute format with limited camps and production |
| Control | Individual RTS entities, multi-select, groups, attack-move, tactical pause |
| Economy | Four local resources; campaign manpower and equipment authorization are a separate finite ledger |
| Standard active capacity | Target 500 combat entities per side, plus a separate 100-worker allowance: up to 1,200 active units across both sides |
| Large-battle capacity | Target 1,000 combat entities per side plus 100 workers: up to 2,200 active units; validate before enabling on supported devices |
| Strategic army | Deploy the brought army together; reserves are chosen by the player or arrive from neighboring tiles, with capacity checked before battle |
| Existing city | Exact world-map building/component roster and built tiers; shared IDs, individual HP and persistent damage; actual defenses authorize walls/emplacements |
| Post-battle recruitment | Surviving authorized recruits persist; resources alone cannot manufacture campaign armies |
| World time | Campaign turn progression pauses while the battle is active |
| Engine | Extend the current deterministic 20 Hz worker simulation and Three.js renderer |
| Mobile | Landscape, reference layout 844×390; target 30 FPS under sustained load |

The old `design/rts-battles-implementation-plan.md` explicitly says no citizen economy and uses combat width as the field cap. Those decisions are superseded by this proposal. Its existing battle entry, command, rendering and campaign-result work remains useful. This proposal should become a new versioned design document on a feature branch, with a supersession note in the old plan.

## 2. What exists, and what must change

Observed in the inspected source:

| Area | Current behavior | Required change |
|---|---|---|
| Simulation | Integer Q8 positions, seeded RNG, 20 Hz, Web Worker | Keep determinism; add economy, construction, production and dynamic entities |
| Army scale | One simulated squad per campaign unit, with cosmetic soldiers; 3–6 opening squads per side and normal reinforcement cap of width + 2 | Remove the terrain-based entity cap; hundreds of individually commanded combat entities per side |
| Battle lengths | Field 5 minutes; siege 7.5 minutes; old fallback 6 | Scenario-specific clocks and longer save/replay support |
| Economy | Battle Supply from points and defender buildings | Gatherable resources, workers, drop-off, finite recruitment authorization |
| Buildings | Existing city categories create structures; auras and razing | Separate passive city structures from operational RTS facilities; individual HP/ruins, footprints, construction, queues and defenses |
| Reinforcements | Real neighboring campaign units, field cap, supply cost | Retain identity and locking; reserve capacity for nominated troops and add routes and optional wave handling |
| Victory | Keep destruction/assimilation, broken armies, timed outcomes | RTS objectives that account for training, rebuilding and retreat |
| Map | Generated from battle tile and neighbors | Resources, expansion areas, wider navigation, city district layout |
| Pathing | Cached flow fields by goal; spatial hash | Dynamic obstacle versions, footprint/clearance classes, bounded path work |
| Saves | Full order log every 10 seconds; resume replays from tick zero | Periodic full state snapshots plus append-only command segments |
| Result verification | `replayBattle` called synchronously in reducer | Asynchronous verification outside the UI reducer |
| Unit rendering | Instancing and a custom rigid shader rig | Worker/gather/build states; animation pipeline for production assets |
| Quality | One high profile plus dynamic resolution | Explicit quality tiers; thermal/battery policy; asset streaming |

Specific constraints to fix rather than inherit accidentally:

- `MAX_BATTLE_TICKS` currently caps validation at the siege length. A 60-minute battle at 20 Hz is 72,000 ticks, eight times the current 7.5-minute maximum.
- `MAX_LOG_ORDERS` is 20,000 and maximum squad indices per order is 64. Review limits against individual entities and long games; never silently truncate valid late commands.
- `worldHash` only mixes selected current fields. It is not a complete digest of all authoritative state. New workers, queues, construction, resource balances, paths/jobs and recruitment reservations need explicit coverage.
- Many building and fog rules assume side 1 is the defender and every structure belongs to it. Every structure must have an owner; construction and capture make hardcoded side assumptions invalid.
- `toStrategicResult` assumes every combatant has an original campaign unit and clamps strength to its starting strength. New recruits need a separate validated result path.
- The current abandon-to-auto path restarts from original armies. Once the player has gathered, trained or lost units, automatic continuation must start from the live battle checkpoint.
- A tile is roughly 77 km between neighbors in the campaign grid. The battlefield is a representative tactical area derived from that tile, not a literal simulation of its entire geographic area.

## 3. Battle lifecycle and scenario setup

### 3.1 Before deployment

1. Validate war, adjacency or landing route, movement availability and ownership through the existing campaign gates.
2. Capture an immutable `BattleSetupV4`: campaign revision, tile/city identity, participant roster, armies, technology, terrain, weather seed, infrastructure, reserves and scenario rules.
3. Lock committed units, nominated reinforcement units and campaign resources placed in escrow. Prevent movement, disbanding, duplicate participation and spending those reservations elsewhere.
4. Show a pre-battle screen: enemy intelligence, each nation's era, starting troops, off-map reserves, city defenses, estimated difficulty, timer, recruitment allowance, expected campaign risk, Command/Auto choices.
5. Select a validated capacity/map preset that fits both sides' committed troops and production headroom. Allocate the whole brought army to deployment by default; the player can move deployment slots and optionally hold troops in reserve. Show any unsupported army size before launch; never silently truncate the roster.
6. Stream only the participating eras, architecture styles, biome and troop models. Start the sim after required collision/gameplay data and minimum visuals are ready.

No armies or buildings are granted simply to make unequal campaign positions symmetric. A strong developed city should be hard to take. Fairness means valid routes, understandable rules and honest difficulty, not equal starting forces.

### 3.2 Attacker setup

- Start on the edge facing the campaign approach, or on the actual beachhead for a landing.
- Bring committed campaign troops plus an expedition headquarters/camp, eight workers and a bounded starting stockpile. The expedition setup is paid through a visible campaign logistics cost. No extra starter combat army.
- Deploy the brought campaign army without the old 60-population opening allocation or terrain combat-width restriction. A physically crowded entrance may feed troops through several routes over time, but entry does not wait for friendly deaths. Select a larger validated preset before launch when needed; holding troops in reserve is an explicit player choice.
- A campaign support regiment can improve worker efficiency, repair access or logistics, but does not grant unlimited free labor or material.
- If the attacker cannot afford an expedition, allow the existing short assault/raid format or postponement. Do not allow a repeatable free camp to generate profit.

### 3.3 Defender setup

- The actual city garrison, passive houses/shops/civic landmarks, civic objective and existing fortifications are present from the start. Civilian city buildings have HP/footprints and no production, gathering, research or combat auras. Scenario-authorized operational RTS facilities are separate entities/plots; derive their eligibility from city development without making every campaign-category landmark an active producer or counting it twice.
- Start with twelve workers, a modest additional stockpile and housing appropriate to city development. These are finite labor allocations linked to that city.
- Existing siege damage carries into walls and defensive structures, while prior plot damage carries into civilian buildings and ruins. Existing occupation, supply shortages and devastation affect stockpiles and repair state.
- Defender can train and build immediately within its unlocked roster. Towers require actual city defenses or construction.
- An empty, unfortified city may still be captured automatically. A city with meaningful defenses and construction capacity should not be auto-captured merely because it has zero standing soldiers.

### 3.4 Other battle types

| Scenario | Construction/economy | Recommended clock and objective |
|---|---|---|
| City assault/defense | Full | 45 minutes, contested overtime to 60 |
| Capital siege | Full, larger prepared defenses | 45+15 by default; optional 60-minute preset selected before launch |
| Field battle | Camps, basic drop-off and limited training | 20 minutes, control the field or force retreat |
| Ambush | Emergency camp only after disengaging | 10–15 minutes, escape or break the ambush |
| Sally | Defender sorties against a besieging camp | 15–20 minutes, destroy siege/logistics objectives or withdraw |
| Amphibious city assault | Secure beachhead, then expedition base | Same total 45+15 clock; landing cannot reset it |
| Naval engagement | Keep current separate naval battle initially | Dedicated naval rules; full dock-building RTS in a later milestone |

A battle should never require an hour when there is nothing left to contest. Surrender, retreat and clear objectives prevent cleanup of one hidden worker.

## 4. Time, victory, defeat and pacing

### 4.1 Clock semantics

Use simulation time. Pause and app suspension stop it. At 2× speed, 45 simulation minutes take about 22.5 wall-clock minutes before pauses; show both the speed and the remaining simulation time. Default speed is 1×; offer 0.75×, 1×, 1.5× and 2× when measured CPU headroom permits. Do not offer a speed the device cannot sustain silently.

For the standard siege, the 45-minute deadline grants up to 15 minutes of overtime only if the primary objective was actively contested during the preceding 60 simulation seconds. Eligible activity means occupying/contesting the city center or dealing meaningful damage to a primary command structure. Cosmetic shots at a farm do not count. Once granted, overtime has one fixed end tick; activity cannot repeatedly extend it.

At the hard deadline the defender retains the city unless the attacker completed a victory objective on or before that tick. Resolve the last tick's damage and objective progress before evaluating timeout. A tactical draw preserves campaign control; casualties and destruction still apply.

### 4.2 City victory paths

**Occupation:** destroy or disable the defender's civic command structure, then hold the designated city-center zone with occupation-capable ground troops for 120 uninterrupted simulation seconds. Enemy combat units contest; aircraft, builders and workers do not occupy. Contested progress pauses; abandoned progress decays over 60 seconds. The objective remains at the original city center even if the defender builds another headquarters elsewhere.

**Military defeat:** eliminate all enemy operational headquarters and military production buildings, and all deployed combat-capable units and arriving committed waves. A finite rebuild grace period of 120 seconds applies if an eligible builder and affordable command-building reconstruction remain. Farms, isolated workers, empty houses and decorative districts do not force endless searching. Available but uncalled off-map reserves are offered one explicit commit-or-withdraw choice with a fixed 30-second response window; they are never sacrificed automatically.

**Retreat/surrender:** either side can order retreat through a valid exit. Units must reach it; those cut off remain at risk. An orderly surrender ends combat immediately and categorizes trapped forces as captured, using the campaign's prisoner/loss rules. Never run both surrender losses and a second automatic pursuit penalty.

Defender victory uses the corresponding destruction of the expedition command and fighting force, attacker withdrawal, or the deadline. Victory by destruction secures the city only where this battle is a city assault; winning a field battle does not annex an unrelated city.

### 4.3 Target pacing

| Simulation time | Intended decisions |
|---|---|
| 0–3 minutes | Scout, deploy brought troops, protect builders, choose economy/pressure |
| 3–10 | First production, resource raids, establish or deny an expansion |
| 10–25 | Combined arms, defensive lines, attack supply corridors, deploy major reserves |
| 25–40 | Breach, counterattack, secure the objective, decide whether losses justify retreat |
| 40–45 | Deadline pressure and final assault/hold |
| 45–60 if granted | Finish a genuinely contested siege; no endless timer renewal |

Campaign pacing remains a risk: fighting twenty 45-minute battles takes fifteen hours before the map game. Keep auto-resolve, current-state AI takeover, small encounter formats and a pre-battle quick preset. Quick/standard/epic profiles must have separately tuned economy and allowances, not just different timer values that create different recruitment exploits.

## 5. Army identity, scale and reinforcements

### 5.1 The invasion army is the actual starting force

A campaign regiment currently has up to 1,000 strength. Split it into tactical representatives, each storing `sourceUnitId` and an integer share of campaign strength. Initial scale: a full foot regiment produces 50 individual tactical soldiers, mounted 25, siege/armor 10, and aircraft 5; roster-specific profiles can refine this table. Six to twelve full foot regiments therefore field 300–600 actual combat entities. These remain representative campaign-strength shares, not a literal one-to-one simulation of every campaign person. Freeze the mapping in the ruleset; a phone must not get fewer representatives than a desktop.

Every representative is a real selectable and targetable simulation entity. Infantry can be selected individually or through their regiment/group. Extra cosmetic formation members, if later added, cannot alter collision, damage or casualties.

For each profile, use `representatives = ceil(strength / strengthPerRepresentative)` and distribute integer shares in stable entity-ID order. With 20 strength per infantry representative, a 730-strength regiment has 37 soldiers: 27 shares of 20 and ten shares of 19, totaling exactly 730. Dead representatives remove their share; living wounded representatives retain their manpower but carry a bounded readiness/injury penalty back. Healing restores HP/readiness of living representatives, never resurrects a dead share. If later introducing detailed wounded/captured manpower, maintain disjoint integer buckets rather than applying both HP loss and death loss to the same soldiers. Recalibrate tactical HP, damage and recruitment costs to this mapping; increasing representative count cannot multiply a regiment's campaign combat value or grant manpower.

The campaign already treats strength as headcount. Keep `strength` and readiness separate in the new contract; update auto-resolve to use the same effective-strength calculation. Existing original-unit survivors keep identity, home region, promotions and commander. Equipment art and stats are resolved from their owner's effective era at battle start, matching current auto-upgrade policy.

### 5.2 Deployment, capacity and reserves

- Standard target: 500 combat entities per side plus up to 100 workers. Large target: 1,000 combat entities per side plus up to 100 workers. Counts apply to the entire coalition, including allies. Each soldier, vehicle, siege engine or aircraft uses one combat slot; workers use the separate labor allowance. Vehicle strength is balanced through cost, production time, equipment authorization and footprint. Garrisoned/carried troops still count; an empty transport counts as one vehicle.
- These are configurable, versioned scenario ceilings, not a permanent engine constant. Ship only presets demonstrated by benchmarks. There is no unlimited-units performance promise. For armies above the largest validated preset, show the limitation before launch and offer explicitly chosen waves, auto-resolve or postponement; never quietly cut forces or change their representative scale.
- Before launch, calculate both sides' complete committed/nominated rosters plus desired production headroom, initially 100 combat slots per side. Select the smallest validated preset that fits the larger requirement. A 600-soldier invasion therefore uses the large preset and can field all 600. A scenario that cannot fit the headroom must show that before confirmation; player-approved wave play has its own published admission rule.
- Reserve combat slots for every nominated original troop at setup, including delayed neighboring reinforcements. Recruits cannot consume those reservations. Their arrival moves a reservation into deployed occupancy, so original troops do not wait for deaths or new housing. Troops voluntarily held back retain reserved slots; a deliberate withdrawal releases them and removes their participation authorization.
- Initial military logistics capacity covers committed troops plus up to 100 recruitment slots, bounded by the selected ceiling. Initial labor housing covers 20 workers. Each housing/logistics building adds 50 military capacity and ten labor capacity up to their separate ceilings. Destroyed housing pauses new recruitment when over capacity; it never deletes troops or blocks pre-authorized original-army arrivals.
- Terrain limits movement through actual roads, gates and passages. It does not apply `combatWidth` as an army-count cap. Provide room to form a broad front, flank, stage siege weapons and fight in several places at once.
- The full invasion roster appears in the army/reserve panel with strength, class, origin, arrival route and time. Original troops have already been recruited on the map; do not charge a second recruitment cost to use them. Any local dispatch/logistics cost is explicit.
- The player chooses optional waves. No automatic last-stand mechanic exceeding the chosen ceiling; no mandatory reserve queue replacing the promised large simultaneous battles.

An explicitly selected overflow-wave mode is a separate exception for rosters beyond supported simultaneous capacity: pre-battle allocation identifies admitted troops and the remaining off-map roster. Only admitted troops reserve slots. Additional waves require enough released slots and reserve them atomically when called; deaths or completed retreats can free space, while uncalled troops retain their campaign identity. Explain this restriction before the player chooses that mode. Ordinary standard/large battles follow whole-roster reservation above.

### 5.3 Neighboring campaign reinforcements

Eligible units must have a valid allied supply route to the battle and sufficient movement/logistics, and cannot be embarked without a valid landing route. Nominations are fixed and locked at launch for the first release; the campaign is paused, so new units cannot be conjured into neighboring tiles mid-battle.

Arrival uses the route's geographic edge. Initial delay: 30 seconds for already committed reserves, 60–180 seconds for eligible adjacent support, plus a bounded terrain/logistics adjustment. Distances are an abstract operational delay, not a claim to simulate marching 77 km in a minute. Preserve the delay rule in the setup for replay.

At call time validate the setup's reserved combat slots and a safe entry corridor. If the entrance is blocked, show delayed status and allow another legal corridor or cancellation before entry. Cancellation retains the nomination/slots unless the player explicitly withdraws those troops from the operation. Never materialize on enemies or inside buildings. Once any part of a wave enters, those entities are committed and damage persists. Off-map uncalled units remain at their original tile and do not earn XP.

### 5.4 Coalition and different-era battles

Use `participants[]` with nation ID, coalition/side, commander/controller, era, technology, faction traits, army sources and resource ledger. Two combat coalitions remain the first-release limit, but a coalition can include allied regiments from different nations.

Each allied troop uses its own nation's era/stats. Newly trained troops use the owner of the training building and that participant's permissions; allied workers cannot bypass another nation's tech gates. Resources are separate by participant with optional explicit transfers. First release: one economic base owner per side and allied troops as reinforcements. This supports mixed-era armies without building four independent base AIs immediately.

## 6. Economy, construction and training

### 6.1 Four battlefield resource accounts

Keep one mechanical resource vocabulary across eras to limit UI and balance complexity; show era-appropriate labels and objects.

| Account | Bronze/Classical/Kingdoms presentation | Gunpowder/Modern presentation | Spent on |
|---|---|---|---|
| Provisions | Grain, animals, fishing, farms | Provisions, ration depots, modern farms | Workers, troops, crew |
| Materials | Timber and usable stone | Timber/masonry, concrete and salvage | Buildings, housing, repairs, light equipment |
| Metal | Copper/iron workings | Iron/steel/scrap | Weapons, armor, vehicles, siege |
| Credits | Coin/trade goods/treasure deposit | Funds/valuable ore/contract supplies | Specialist units, advanced structures, logistics |

These four local accounts are distinct from campaign `gold`, `hr`, `copper`, `iron` and `oil`. Do not copy a local 500-credit stockpile directly into campaign gold. Modern oil access can unlock a refinery/logistics bonus; it need not become a fifth mandatory gathered resource in the first release. Keep petroleum-consuming roster authorization in the campaign equipment ledger.

Resource nodes have finite capacity, worker slots and work positions. Workers move to a slot, gather into inventory, return to a valid friendly drop-off and deposit. Resource bars increase at deposit, not when the order is issued. A dead worker loses carried inventory; a dropped recoverable bundle is optional later. Nodes disappear or change state when depleted.

Initial gather rates per worker-second: provisions 0.65, materials 0.60, metal 0.45, credits 0.40, before walking; carry capacity 10. Use integer milli-resources internally so small gains do not disappear through rounding. Initial side stocks: attacker 250/300/100/150; defender 300/350/150/200, ordered as the table. Development and supply modify these through a capped setup formula, for example 0.75× to 1.5×, never every turn during battle.

One safe starter cluster per side supports the first 6–8 minutes. Two or more contested expansions reward map control. Farms provide renewable provisions at slower throughput and require paid construction. Metal and credits are finite except for a capped, paid market conversion with worsening exchange rates. No free infinite trade loop.

### 6.2 Construction rules

- A worker places a blueprint on a snapped navigation footprint in explored, currently visible terrain. The server/sim validates ownership, era, tech, cost, footprint, slope, water rules, resource exclusion zones and route connectivity.
- Reserve/pay the full local price atomically when accepted. A client preview is advisory only.
- A scaffold has limited HP and grows as work progresses. Additional builders provide diminishing returns: `rate(n) = 1 + 0.5 * min(n - 1, 4)` for n≥1, zero when nobody is working. Maximum useful builders is five.
- Cancellation returns 75% of unspent construction value; completed work and suffered damage cannot become free material. Initial formula: floor(0.75 × price × (1-progress)); cancelled-before-work returns the full reservation if no scaffold was spawned. A destroyed scaffold gives no refund.
- Workers cannot build through combat blockage. Construction pauses if builders die or leave; it does not reset.
- Repair costs local materials proportionally to restored HP. No free automatic indefinite fort repairs. Repairs under recent damage operate at 25% speed; tune to prevent five workers making a tower unkillable.
- Placement cannot seal every mandatory entry/exit or trap non-garrison units. Walls and gates can close ordinary lanes, but the map must preserve a destructible route; path validation distinguishes destructible barriers from permanent terrain blockage.
- Friendly gates can open automatically. Enemy attacks target gates/walls; destroyed segments remove their collision footprint and invalidate affected navigation caches.
- Building health states: construction, operational, damaged, disabled where applicable, destroyed. Ruins have a defined navigation state and bounded visual lifetime.

### 6.3 Core building roles and starter prices

Prices are provisional in P/M/O/C: provisions/materials/metal/credits. Times are one-builder simulation seconds. Era art and specific roster names vary, while the roles remain recognizable.

| Role | Function | P/M/O/C | Time |
|---|---|---|---:|
| Headquarters | Workers, command, local recruitment ledger access | 0/400/100/150 | 120 |
| Housing/logistics | +50 military capacity and +10 labor capacity | 0/80/0/0 | 30 |
| Food depot | Provisions drop-off; farm access | 0/100/0/0 | 35 |
| Materials yard | Materials drop-off | 0/100/0/0 | 35 |
| Metal works | Metal drop-off; appropriate processing | 0/150/50/0 | 45 |
| Market | Credits drop-off and bounded exchange | 0/160/0/80 | 50 |
| Barracks | Basic/anti-mobile infantry | 0/180/30/0 | 50 |
| Ranged production | Archers, riflemen, AT teams by era | 0/180/40/20 | 50 |
| Mobile production | Chariots, stables, vehicle works | 0/240/80/60 | 65 |
| Siege workshop | Rams, engines, cannon, artillery | 0/260/120/100 | 75 |
| Aid/support building | Heal living troops, support equipment; repair via workers | 0/160/30/80 | 50 |
| Tower/emplacement | Local defense, era-appropriate weapon | 0/160/100/0 | 60 |
| Farm | Renewable provisions; assigned worker required | 0/80/0/0 | 25 |
| Wall segment / gate | Destructible obstruction | 0/20/10/0; gate ×3 | 10 / 25 |

Modern additions: generator, airfield and radar/AA infrastructure. Electricity is capacity, not a mined stockpile: generators provide power and advanced buildings consume it. Low power slows advanced production and disables radar; basic troops, workers and basic defenses continue. Power and effects belong to building owner, not the whole coalition accidentally.

Restrict large production footprints to supplied build areas linked to an HQ/camp; allow limited worker-built outposts outside. No universal construction anywhere on the map. This gives RA2-like base clarity while preserving AoE-style forward defenses.

### 6.4 Production and population

One active item per building, up to twenty queued, with batch-training controls across selected producers. Orders atomically reserve local cost, the appropriate military/labor capacity and any campaign recruitment/equipment authorization. Original-army arrival reservations are unavailable to production. The queue must display exactly what blocks progress. At housing capacity loss it pauses; it does not discard units.

Provisional training at the revised representative scale: worker 50 P / 15 s; basic infantry 30 P + 10 M / 15 s; ranged 25 P + 25 M + 5 O / 20 s; mounted 60 P + 35 O + 20 C / 30 s; siege 120 M + 100 O + 60 C / 50 s. Modern units have their own prices and power/prerequisite requirements, not just a blanket multiplier. Ten barracks can produce 40 basic infantry per minute if supplied, consuming 1,200 P and 400 M per minute. At the proposed gather rates that requires at least 31 provisions workers and twelve materials workers before walking, so a developed 60–100-worker economy must be tested for sustained output. Parallel production and expansion should replenish substantial losses during a 45-minute battle.

On completion, spawn at a legal egress point and follow the rally command. If all exits are blocked, retain the completed item with its reservations; never stack dozens at the same coordinate. Destroyed production cancels its queue under the published refund rule; it does not award troops. Repeated cancel/requeue cannot reduce costs or reset damage for profit.

Queue refund default: an unstarted queued item returns all local resources and all unconsumed reservations. Cancelling an active item returns 75% of its unfinished local-resource value and releases its unconsumed campaign/population reservation. A destroyed producer returns no local resources for its active item but releases its unconsumed regular-recruit authorization; queued unstarted items refund normally. A unit is charged against campaign escrow only at completed training, and that charge persists even if the unit is later killed or deliberately disbanded. Training progress is not restored when requeued.

First release has no generic in-battle attack/armor research. Campaign technologies are already applied. Supply buildings and factories are battlefield prerequisites, so base growth still matters without a second tech tree. Optional tactical equipment choices later must be temporary, same-era and separately balanced.

### 6.5 Preventing free campaign armies

Use two explicit recruit sources, with distinct badges:

1. **Campaign-authorized recruits:** future manpower and equipment committed to this operation before launch. Every trained survivor can persist into the campaign. Their strategic costs are reserved once, charged on completion, and unused reservations returned once after the battle.
2. **Local auxiliaries:** a finite, scenario-funded emergency pool that can be trained with local resources but demobilizes after the battle. This supports a substantial RTS economy even for a small strategic invasion. No XP, equipment, disband refund or gold conversion leaks from auxiliaries into regular campaign units. Losses may contribute to bounded local casualty/devastation effects and are accounted once.

The UI shows both pools openly, for example “Regular recruits remaining: 800 strength; local auxiliaries: 1,200.” A production toggle selects the source. Avoid an invisible rule under which the army the player trained mysteriously disappears.

Recruitment is bounded by real committed manpower, equipment funding and an explicit finite operational allowance, rather than a fixed 25% of the starting army. Before launch, the player can fund regular replacements from available campaign resources through the shared recruitment service. A paid expedition or developed city can also authorize finite local auxiliaries, with mobilization cost, labor availability and demobilization shown in advance. Derive this allowance from its own investment/development, not 50% of the smaller enemy army. Neither pool refills automatically after casualties.

Balance target for a well-funded standard siege: authorize at least one full 500-infantry-equivalent replacement army over the battle, and tune a 1,000-equivalent allowance for a major prolonged operation. At 20 campaign strength per infantry representative, those allowances mean 10,000 or 20,000 strength and require corresponding regular escrow or paid auxiliary mobilization. These are planning targets available only when funded, not free starting troops or increases to simultaneous capacity. Small/poor campaigns may afford less; show this honestly. Size gatherable deposits, expansions, production plots and labor allowances to support the funded plan through the intended duration.

Before training regular recruits, calculate campaign cost through the same class/era recruitment service used by the map, with an explicit rule for fractional 1,000-strength regiments. Reserve costs in fixed units with carried remainders; floor-per-click rounding must not make ten small recruits cheaper than one large recruit. AI factions currently have different resource representation, so an adapter is required rather than assuming they have the player's metal wallet.

New regular recruits become understrength campaign units grouped by owner/class/home origin, or refill a compatible source regiment within its `maxStrength`. Do not fill dead original soldiers for free and also create new units. Unit IDs are allocated once during the committed result transaction, never by renderer state.

Workers are temporary operational labor, not free campaign settlers. Extra workers consume a finite labor allowance; their survival does not create map units. The local-resource economy has no general export to the campaign. A predeclared, capped plunder reward may depend on captured depots, with an operation/city cooldown to prevent repeat farming.

## 7. Era roster, combat and faction identity

### 7.1 Five-era foundation

Use the current five-era registry on bronze-towns. The unmerged eras-expansion branch should not silently alter this plan's scope. A future expanded era list can plug into the content registry after the five-era implementation works.

| Role | Bronze | Classical | Kingdoms | Gunpowder | Modern |
|---|---|---|---|---|---|
| Basic infantry | Spearmen | Swordsmen/legionaries | Pikemen | Line infantry | Rifle infantry |
| Mobile | Chariots | Heavy cavalry | Knights | Dragoons | Tanks |
| Ranged/specialist | Archers | Composite archers | Longbowmen | Riflemen | ATGM team |
| Siege | Battering ram | Ballista | Trebuchet | Field cannon | Artillery |
| Military support | Baggage train | Engineers | Pioneers | Sappers | Anti-air battery |
| Economic worker | Laborer | Laborer | Villager/artisan | Laborer | Engineer/worker; optional hauler |
| Command art | Expedition tent / hall | Camp / civic hall | Camp / keep | HQ tent / command house | Command vehicle camp / HQ |
| Air | None | None | None | None | Fighter/strike aircraft after unlock |

The current Modern infantry campaign label is Mechanized Infantry. Decide in its profile whether its tactical representation is dismounted infantry or a transport-plus-squad; the first release uses dismounted infantry and does not imply a free additional APC. Art variants by culture do not grant different combat rules unless the campaign already has a documented trait.

The first five-era release uses these familiar lines. Later roster depth can add cheap anti-mounted infantry, heavy infantry and distinct scouting/raiding units, with corresponding campaign mappings. Do not introduce ten tactical classes that all silently collapse into one indistinguishable campaign class on return.

### 7.2 Prerequisites and mixed eras

Every build/train action validates `participant.effectiveEraAtStart`, campaign tech unlocks, building prerequisite, local resources, logistics/power, recruitment source and population. Defense art follows local architecture; owner era determines military equipment. When an older nation captures an advanced building, it can occupy, salvage or disable it; it cannot produce equipment it has not unlocked. No in-battle technology theft in the first release.

Current campaign units automatically use their owner's current roster. Freeze this once at launch. A later campaign research event cannot mutate a suspended battle. If legacy-equipment persistence is desired later, that is a separate campaign change.

### 7.3 Damage and counters

Keep readable roles, but replace blanket class bonuses where they contradict actual weapons. In particular, current `infantry beats cavalry` cannot mean a Bronze spear automatically hard-counters a Modern tank. Use explicit tags: light infantry, heavy infantry, mounted, light vehicle, armored vehicle, siege, structure and air; each weapon declares legal targets, damage type and armor interaction.

Suggested deterministic formula:

`damage = max(minimumLegalDamage, floor(baseDamage × readiness × veterancy × weaponVsArmor × terrainExposure × scenarioModifier))`

An illegal weapon/target pairing returns zero before this formula. Same-era parity is tuned around this profile table. Either profile stats incorporate era or an era multiplier does; never apply the full advantage in both places. Baseline hard-counter bonus can start at 1.5×, ordinary unfavorable damage at 0.75×, with explicit heavy-armor penetration requirements. Current values differ and must be recalibrated in auto and commanded combat together.

Combat rules:

- Melee needs approach slots around targets; many soldiers cannot all occupy one point.
- Ranged units use line of sight, range, reload and projectile timing. Attack-move acquires threats; explicit move does not silently stop to fight.
- Siege outranges common towers but requires protection. Wall damage and unit splash are separate profiles.
- Cover and elevation modify exposure/range modestly, without stacking several invisible multipliers.
- Friendly fire is off for ordinary ranged weapons; artillery splash behavior is a scenario rule displayed before battle.
- Formation speed uses the slowest member when explicitly requested; units otherwise take independent paths to formation slots.
- Morale belongs to a regiment/group, updated from local losses and suppression. Share retreat planning across formations rather than running an expensive planner for every soldier. Routed units can rally; retreat is an explicit exit operation.
- Veterancy is capped and earned from meaningful combat, with no XP for repeatedly damaging/rebuilding one's own structures or farming auxiliaries.
- Air uses map bounds, sorties/rearm and valid targets. AA can deny it. Air cannot occupy a city. Full dogfighting/altitude simulation is outside the initial release.
- Modern power outages affect radar/advanced production, not ownership or basic visibility of one's own troops.
- Existing missile/air support powers consume the real authorized campaign asset once and keep their strategic consequences. Strategic nuclear attacks remain a separate campaign action for the first RTS release; no new repeatable local superweapon economy.

### 7.4 Orders and interactions

Required orders: move, queued move, attack, attack-move, stop, hold position, patrol, guard, gather, return cargo, build, assist construction, repair, train, cancel/reorder queue, set rally, garrison, ungarrison, open/close gate, call reserve, retreat group, retreat army, stance and authorized abilities. Every command has deterministic validation and a rejection reason. Commands refer to stable IDs with generations, not array slots that can later be reused for another entity.

## 8. Terrain, city layout and map generation

The battle map is stable for a campaign tile, with changes driven by explicit city development/destruction and a map-generator version. Use biome, slope, coast, river crossings, road connections, local resource access, city tier, architecture and attack direction from the tile and neighbors. Do not rotate every scenario into an aesthetically convenient direction and lose the geography of reinforcements.

Initial sizes: 128–192 cells per dimension for small encounters, 256×256 for a standard city and 384×384 for a large siege; benchmark any 512×512 expansion separately. At an approximate 4 m navigation-cell interpretation these represent roughly 0.5–1.5 km battle areas for the initial presets. Size deployment areas and traversable lanes for the actual roster, including vehicle-heavy armies, rather than relying on cell count alone. Physics and balance remain in logical fixed-point coordinates; metadata supplies visual scaling. Long-range artillery is deliberately compressed to fit this tactical area. Do not mix the campaign's kilometer distances with these ranges.

Generate these layers separately:

1. Terrain height, water and permanent blockers.
2. Static navigability/clearance for foot, mounted and large vehicle footprints.
3. City districts and existing strategic buildings, each with campaign provenance.
4. Attacker deployment, defender center and route-derived reinforcement corridors.
5. Gatherable resources, building plots and contested expansions.
6. Navigation sectors/portals, fog grid and visual dressing.

Validation for every generated map:

- Each side can reach starter resources and has enough legal production footprints and unit egress.
- At least two practical approach routes for ordinary city maps; authored chokepoint scenarios explicitly advertise exceptions.
- Large vehicles can reach their legal objectives; a narrow foot-only alley is not a tank route.
- A fortified city offers attackable gates/walls and siege positions. No inaccessible objective behind an impassable terrain ring.
- Rivers have known crossings or a supported landing route. Bridges require explicit ownership/destruction/navigation rules before being destructible.
- Starting armies do not overlap scenery, resources, water or future HQ footprint. Validate 500/1,000 combat entities per side in staging areas, mass egress and multiple attack lanes. Dense-city defenders still need places to deploy without every unit queueing through one gate.
- Fair resource access is based on travel cost, not straight-line distance. Defender infrastructure advantage remains intentional.
- No resource placement forces the player to discover every resource across the entire map just to train the first counter-unit.

Resource, footprint and path generation runs once in a worker/loading stage. City layout is deterministic and persisted. Every represented civilian building inside the playable area is an independently targetable passive prefab with HP; operational HQs, barracks, depots and defenses have distinct roles. A single merged town GLB cannot serve as a whole destructible city. Re-export house/roof/facade modules from editable source where possible.

### 8.1 Shared geography and city identity

Use versioned `TileVisualDescriptor`/`CityLayoutDescriptor` records for both campaign and RTS visuals: tile/city IDs, stable layout seed, biome/climate, relief/slope, sampled elevation, water/river/road edges, forest coverage, architecture/construction era, development, district plots, landmarks, defenses and prior damage. Military equipment era remains a separate participant profile. Reaching a new era does not require replacing every inherited city landmark.

Keep geographic north fixed and spawn at the real approach edge. Replace the existing `tileContextOf` rotation that makes the attacker always enter from west. Any convenient camera rotation must preserve the compass, roads, river connectivity and neighbor reinforcement directions in the serialized setup.

A desert coastal city has dry ground and the correct shoreline; a forest river city has matching river crossings and wooded approaches; a mountain city has plausible slopes/terraces and passes. The battlefield depicts the actual mapped city inside the approximately 77 km campaign cell. Both views consume the exact same `CityStructureManifest`: built campaign buildings/categories at their current tier, selected town-asset house components, landmarks, capital attachments, defenses, fields and local transforms. Map LOD/visual scale can differ, but every logical building/component has the same stable ID and source in the battle. Unlocked but unbuilt buildings never appear; tier upgrades do not duplicate earlier buildings. Missing art uses a matching fallback rather than omitting a real building.

Export logical building components/placements from the selected existing town's editable source. Multiple roof/wall meshes belonging to one house share one ID and HP; LOD variants preserve identity. A merged town map proxy is valid only if its component manifest matches the battle roster. This parity is mandatory in the first city slice. Preserve recognizable relative placement and gate/road connections through documented scale transforms; correct clearance problems in the shared source rather than generating another battle city.

### 8.2 Passive destructible city structures

Separate roles: `civilianPassive`, `cityObjective`, `fortification`, `operationalRTS` and non-building geographic dressing. Passive houses, shops, storage, workshops, religious/civic landmarks and inherited campaign buildings have HP and occupancy but no jobs, queues, production, research, gathering or auras. Only designated fortifications/RTS defenses fire, according to the real city's defense tier and owner-era weapon eligibility. Civilian garrison/fire rules require a later explicit mechanic; no automatic armed houses.

Actual city-building counts come from the shared manifest, separate from army capacity and operational-building limits. The 40–80/120–240/300–500 figures are small/standard/large stress-fixture workloads, not generated houses or city quotas. A city showing 18 buildings has those 18; a city showing more than 500 is not truncated. Include every actual defending-city building in playable space with individual HP. Only unrelated distant landscape/neighboring settlements can be non-targetable backdrop. Validate the shared streets, public squares, vehicle routes and staging areas; any footprint/layout corrections apply to both views.

Each structure stores stable city/layout/plot ID, district/category provenance, archetype, construction era/style, owner, footprint, max/current HP, damage stage and ruin profile. Passive structures use compact static pools and spatial/occupancy indices, with event-driven damage updates and no per-tick AI. Initial archetype HP/material multipliers and catalog are defined in the companion plan and require calibration against revised unit damage.

Visual stages: intact above 70% HP, damaged at 30–70%, heavily damaged below 30%, ruined at zero. Destruction executes once: record provenance/loss, disable appropriate interactions, swap to a predefined ruin footprint, invalidate affected path sectors, and emit pooled effects. Rubble passability/penalty is a deterministic profile, not a physics animation. Wall/gate destruction opens only the affected segments. First-release smoke/fire is visual; uncontrolled fire spread is separate scope.

Paid operational repair follows section 6. Civilian rebuilding occurs through campaign reconstruction; in-battle rebuilding cannot erase its loss ledger. Civilian houses do not need to be destroyed to win: section 4 occupation/military objectives still govern the battle.

## 9. Campaign persistence and outcome application

### 9.1 Transaction contract

Create a battle operation record at launch, containing locked unit IDs, recruitment/resource escrow, participating city revisions, war ID, terrain/layout version, ruleset hash and one unique operation ID. On completion produce an authoritative `BattleOutcomeV2` with:

```
operationId, setupHash, rulesetVersion, finalTick, resultHash
winnerCoalition, reason, occupationCompleted, retreatRoutes
originalUnits[{unitId, survivingStrength, readiness, morale, xp, disposition}]
newRegularUnits[{ownerId, classId, originId, strength, authorizationId}]
auxiliarySummary, laborCasualties
reinforcements[{unitId, entered, disposition, exitTile}]
strategicBuildingDamage[{provenanceId, startTier, damage, destroyed}]
cityManifestHash, cityStructureDamage[{structureId, sourceId, sourceTier, hp, destroyed}]
wallsDamage, plunder, recruitmentCharges, escrowRefunds, supportAssetsSpent
```

Apply exactly once to the matching campaign revision. A duplicate result returns the already-applied result rather than paying plunder, spawning units or refunding escrow again. Recompute nation military strength from changed canonical units, not from a second independent estimate.

Use one shared outcome application service, with scenario adapters for invasion, defense, field combat, landing and naval support. Test all adapters. Do not fix only the player-attacks path and leave defense with different recruitment or building damage rules.

### 9.2 Persistence rules

| Battlefield state | Campaign result |
|---|---|
| Original soldier/vehicle losses | Reduce exactly the mapped regiment's strength; preserve survivors' identity |
| Living wounded original units | Preserve manpower; bounded readiness injury until recovery |
| Original unit retreats successfully | Move to recorded valid fallback tile, with actual surviving strength |
| Uncalled reserve | Remains at its original tile, untouched and without combat XP |
| Called allied reinforcement | Returns to its own owner's army; survivors placed by its arrival/retreat contract |
| Trapped surrendered unit | Captured/lost according to one shared rule; no duplicate pursuit loss |
| Authorized regular recruit | New/filled campaign regiment, with its pre-reserved costs consumed once |
| Local auxiliary | Demobilizes; no persistent unit or disband refund |
| Worker/labor loss | Bounded local casualty impact from its finite labor allocation |
| New tactical camp/building | Temporary; no free permanent city-tier upgrade |
| Existing city building destroyed | Damage or at most one tier loss per provenance ID per battle |
| Rebuilt tactical copy of a destroyed city building | Helps this battle; cannot erase campaign damage automatically |
| Surviving damaged city structure | Campaign repair/development state, through a capped damage formula |
| Passive civilian plot damaged/destroyed | Persist HP/ruin state; apply weighted district devastation once; show matching damage on the campaign map and next invasion |
| Captured city | Occupation/control through existing war rules; political annexation still follows campaign rules |
| City command destroyed | City remains a damaged settlement unless an explicit campaign raze action exists |
| Unspent local resources | Discarded/demobilized; only predeclared capped plunder may export |

Preserve destroyed-building provenance even if a tactical replacement is built. Otherwise rebuilding a barracks repeatedly can either remove several campaign tiers or undo destruction for free. New structures carry `origin: tactical`; initial city structures carry `origin: campaign` and their exact category/tier ID.

Defender supply shortfalls, public order, devastation and war exhaustion should read the same battle casualty/damage summary. Scale civilian effects through current aftermath rules, cap them by available local population, and avoid double-counting workforce casualties as army casualties. Real losses must matter without one battle deleting an entire macro population because a worker represents many people.

Keep civilian plot losses, campaign category/landmark damage, fortification siege integrity and troop casualties in disjoint ledgers. A destroyed house does not automatically equal dead campaign manpower. Damage targets the exact shared structure ID/source: a destroyed market affects that city's actual market; a house becomes the same house's ruin on the map. Normalize weighted district damage by its opening redevelopment weight, clamp it, and pass it through the aftermath adapter once. Previously recorded ruins cannot charge devastation again. Persist sparse HP overrides/destruction bitsets with the city manifest/layout version; campaign repairs update that same record. Reconcile defensive damage to existing siege state once, and never regenerate an intact city merely because another invasion launches.

### 9.3 World pause, cloud and multiplayer boundaries

For local single-player the world turn is frozen. Reserve eligibility and diplomatic context remain frozen with the setup. Autosave is mandatory, and the user can suspend a battle for another day.

An asynchronous shared campaign needs server locks and a battle lease. A browser checkpoint is not trusted proof. If multiplayer is enabled later, acquire authoritative reservations, checkpoint on the server, adjudicate disconnects and stale diplomacy by an explicit campaign rule. A peace agreement must not simply erase an hour of paid costs or allow troops to exist in two places. First-release scope should disable incompatible simultaneous campaign edits while a manual battle is pending.

No real-time PvP is implied by deterministic replay. That requires an authoritative service or fully specified lockstep, command authentication, network turn buffering, resync and anti-cheat. The existing Supabase client/edge scaffold is not by itself an RTS game server.

## 10. AI, auto-resolve and difficulty

### 10.1 Layered AI

Use small deterministic planners sharing one blackboard per economic participant:

- Economy: worker allocation, drop-off placement, expansion, idle-worker recovery, exhausted nodes.
- Build/production: prerequisite graph, emergency counters, population space, queue spending and egress.
- Strategy: pressure, defend, expand, siege, protect reserves, counterattack, retreat. Reconsider roughly once per second.
- Tactical groups: escort siege, screen ranged, raid workers, focus high-value targets, flank and disengage. Stagger decisions across ticks.
- Individual units: local steering, attack execution and short-range reactions. Reuse simulation systems rather than running a complete planner per soldier.

AI sees only permitted fog information and remembered sightings. It cannot choose hidden newly built structures from the authoritative entity list. Memory has a last-seen tick and confidence decay. It may predict resource expansions, not read the opponent's wallet. Allies coordinate targets through their coalition blackboard, without sharing unauthorized enemy information.

Starting build orders are era/scenario templates, with reactive substitutions. Teach emergency responses: rebuild a lost command building, evacuate workers, construct AA after observed aircraft, protect a reinforcement edge, switch production when a resource is depleted, use siege against towers, and surrender a hopeless battle instead of hiding workers forever.

Difficulty first changes reaction delay, planning quality, scouting and willingness to retreat. Any economic or combat handicap is visible in setup and applied symmetrically by the rules engine. Suggested initial response intervals: easy 2–3 s, normal 0.8–1.5 s, hard 0.4–0.8 s; path and action rates remain capped.

### 10.2 Automatic battles

Keep campaign-wide AI-vs-AI combat abstract; never run 60 minutes of full RTS for every war among 240 nations. Build a revised strategic auto-resolve model from army composition, era/tech, fortification, supply, economic potential and committed recruit allowance. It must produce the same outcome contract and account for the same bounded costs.

For player “AI takes command” during an active battle, continue the current world with AI orders, optionally at accelerated headless speed after suspension. Do not restart the original battle, refund losses or reroll its seed. Offer three clear choices: take command, hand over current battle, orderly retreat.

Manual and abstract outcomes need statistical balance, not identical results regardless of tactics. Compare identical setups across at least 32 seeds per matchup, more for noisy cases, and test even forces, severe disadvantages, mixed eras, sieges, poor supply and no-recruitment conditions. Track win probability, casualties, campaign expenditure and surviving trained strength. The old parity envelope was for short squad battles and is not evidence this economy is balanced.

## 11. Controls, HUD, accessibility and audio

### 11.1 Desktop

- Left click select; drag box-select; shift modifies selection/queues commands; double click selects visible same-type units.
- Right click context action; A then click attack-move; S stop; H hold. Rebindable keys with a visible command grid.
- Ctrl+number sets a group; number selects; double press focuses. Separate select-all-army and select-idle-worker commands.
- Rally points accept move, gather and guard tasks. Production queues support batch orders with cost/population feedback.
- Minimap moves camera and accepts commands with an explicit modifier. Mouse wheel zoom, edge/key pan, camera bookmarks.

### 11.2 Phone/tablet landscape

Top strip: four resources, separate military/labor capacity indicators, army/reserve count, clock, pause/speed. Capacity details distinguish deployed troops, reserved original arrivals and queued recruits. Left/bottom: minimap, idle-worker and alerts. Right command panel: contextual actions and selected unit/building info. Expand build/train into a paged tray; do not put a full desktop sidebar permanently over an 844×390 battlefield.

- Tap select, tap clear context target to act; explicit move/attack mode when ambiguous. One-finger drag pans by default; selection rectangle is a deliberate mode; two-finger pinch zooms.
- Build ghost supports drag, rotate where allowed, confirm and cancel. Placement must not finalize on the same gesture that moved the camera.
- Minimum touch targets around 44 CSS pixels. Adjustable UI scale and safe-area padding.
- Group chips, army cycling, idle-worker cycling and last-alert camera jump replace mandatory precision selection.
- Tactical pause allows queued orders in single-player; show queued orders and commit them deterministically on resume.
- Optional economy assistance: reassign to nearest same-resource node, auto-return cargo, idle-builder reminders, auto-repeat one production queue with a resource floor. Assistance obeys identical costs and fog rules.
- Avoid accidental surrender/retreat and destructive queue cancellation with an undoable pre-commit stage or clear hold/confirmation UI.

### 11.3 Information and feedback

Show cost shortfall, unavailable era/tech, supply disconnection, population block, route blocked, recruitment allowance exhausted and power deficit in ordinary language. Enemy buildings outside current sight show only last-known state. Orders receive immediate visual acknowledgement even if accepted by the next 20 Hz tick.

Use blue/orange defaults plus shape/team patterns and health-bar styles; never rely only on red/green. Offer reduced screen shake, reduced flashes, subtitle/caption alerts, high-contrast selection rings, remappable keyboard and separate music/UI/voice/combat volume. Audio priority suppresses repeated unit barks; a large fight must not emit hundreds of simultaneous sounds.

First battle tutorial: select brought troops, gather, build barracks, train from an allowed pool, call a reserve, attack a counter target, breach and occupy, then explain campaign survivors. Training sandbox is available outside a campaign and includes pause/fast-forward and debug population presets.

## 12. Technical architecture and migration

### 12.1 Keep the existing stack

Retain React for the shell/HUD, Three.js for the battlefield, Vite, Capacitor and the existing deterministic worker. Do not rebuild the game in Unity/Godot or introduce a second renderer simply to implement RTS mechanics. Prove the 1,200/2,200-active-unit targets in the battle kernel before broad content production. React renders summarized UI state rather than one component per worker/soldier.

Proposed code ownership, with filenames illustrative rather than a required giant refactor:

```
src/battle/data/     battleResources, buildingCatalog, unitProfiles, eraUnlocks, scenarios
src/battle/setup/    battleSetupV4, cityLayout, armyMapping, recruitmentBudget, mapValidation
src/battle/sim/      entities, economy, workerJobs, construction, production, power
                    navigation, spatialIndex, combat, visibility, objectives, retreat
                    ai/economy, ai/base, ai/army, ai/scouting
src/battle/worker/   battleLoop, snapshotCodec, commandJournal, verificationClient
src/battle/render/  instanceBatches, animationAtlas, buildingStates, resourceNodes, fog
src/components/battle/ buildTray, productionTray, resourcesHud, reservePanel, selectionPanel
src/engine/         battleOperations, battleEscrow, battleOutcome, battleRecruitment
```

Keep campaign state out of the tick loop. Campaign modifiers are resolved once into immutable participant profiles. The simulation consumes only setup and validated commands. Render state is derived and cannot modify resources, collisions, recruitment or outcomes.

### 12.2 Authoritative state

Use stable entity IDs plus generation counters and indexed pools. Put hot unit fields into packed/typed arrays in the battle kernel: position, HP, owner, type, target, order and flags. Allocate pools for the selected preset and reuse slots with generations; avoid per-tick object allocation. Variable queues and profile references can remain compact objects. This scoped change does not require converting the campaign or every module to an ECS.

Required authoritative state includes:

- Tick, RNG streams, setup/ruleset identifiers, next entity IDs and allocator generation state.
- Entities, collision/navigation occupancy and destructible barriers.
- Worker inventories, jobs, node capacities, work slots and reservation state.
- Participant resource balances, labor/recruitment/equipment ledgers, power and population reservations.
- City layout/geography versions, stable plot IDs, passive building HP/ruin states, fortification integrity and loss provenance; these participate in the digest, snapshots and outcome verification.
- Construction work, repairs, production queues, completion and spawn reservations.
- Projectiles that affect gameplay, morale, damage, status effects and cooldowns.
- Fog/exploration, last-seen information used by AI, AI blackboards and scheduled decisions.
- Reserve calls, arrival routes, retreat progress, objectives and overtime state.
- Command deduplication/sequence counters and campaign provenance records.

Caches can be excluded only if they are a pure derivation with identical behavior on rebuild. A partially completed path job affects when a unit moves; either serialize its queue/progress or design canonical resume that reconstructs exactly the same completion schedule. Do not call it a disposable visual cache.

### 12.3 Deterministic tick order

Recommended fixed order:

1. Consume commands for this tick in stable sequence; validate and reserve costs.
2. Schedule deterministic AI decisions for their allotted tick.
3. Commit last tick's completed path jobs; process a fixed quota of new navigation work.
4. Apply construction completions, occupancy changes, power/logistics and queue prerequisites.
5. Advance worker movement/work/cargo and deposit resources.
6. Advance training and spawn/arrival reservations; instantiate completed units if egress exists.
7. Move combatants and resolve local separation; refresh relevant spatial buckets.
8. Resolve legal targets, attacks, projectiles, damage and deaths in stable ID order.
9. Apply morale, repair/heal and garrison/exit effects under the specified damage ordering.
10. Refresh visibility on its scheduled ticks, update objectives, evaluate retreat and victory.
11. Produce journal/hash/checkpoint events and a compact render delta when scheduled.

Choose and test precise within-tick semantics: a destroyed barracks cannot finish training after its destruction unless the specified ordering makes training complete earlier that tick; newly spawned units cannot attack retroactively. Costs for multiple simultaneous purchases see earlier accepted reservations.

Do not use wall-clock duration to decide how many AI/path nodes complete in the authoritative sim. Fixed operation quotas preserve replay consistency across phones and desktops. Runtime overload changes presentation/speed availability or pauses, not game rules.

### 12.4 Commands and result verification

Define typed schemas with opcode, owner, tick, sequence, IDs, finite bounded coordinates and payload limits. Reject ownership violations, fog-hidden targets where targeting requires sight, invalid prerequisites, duplicate costs and stale generations. Placement validation remains authoritative even if a client draws a green preview.

Move lengthy replay outside `gameReducer`. Local single-player uses a verification worker, with progress and cancellation/suspension handling. Dispatch a finalized outcome only after verification; the reducer performs a short idempotent commit. This isolates UI stalls but does not make a client trusted in multiplayer.

For an authoritative online campaign, verify on a dedicated job/service with the frozen ruleset, or run the battle authoritatively there. A server-trusted checkpoint can shorten replay; a checkpoint supplied by a browser cannot skip verification just because it has a hash. Do not assume a serverless edge request has enough CPU/time to replay 72,000 busy ticks. Measure hosting limits and job costs before enabling online commanded battles.

Extend log limits based on a byte budget and command-rate policy. Reject overflow visibly and preserve the current save; never slice off the last ten minutes. Coalesce harmless repeated camera-free UI commands before they enter the log, but never drop a gameplay command after acceptance.

### 12.5 Save, resume and app lifecycle

- Append command segments every 2–5 seconds; write a full versioned authoritative snapshot every 30 seconds and on pause/background when the platform allows it.
- Commit snapshot, journal offset and checksum atomically in IndexedDB; retain at least two good snapshots and enough journal to recover the newer one. Treat storage quota failure as visible, recoverable state.
- Load latest valid snapshot, replay only the short tail, restore paused, then let the player resume. Do not replay an hour on the main thread.
- Full snapshot target ≤2 MB compressed and ≤10 MB uncompressed at standard scale; targets must be measured with AI/path state included.
- If the process is killed before a background save, lose at most the last persisted segment, never duplicate applied outcomes or charge reservations again.
- Pin content/ruleset version per pending battle. A deployment that changes rules must keep the old simulation bundle available or offer a deliberate migration/recovery path. Do not restart an invested 40-minute battle merely because `SETUP_VERSION` changed.
- Offline saves and cloud sync use one operation revision. Conflict UI preserves both pending records until an authoritative choice; it must not merge troop lists from both saves.
- Page visibility/Capacitor background pauses simulation and resets wall-time accumulation. Resuming does not run 10 minutes of catch-up ticks.
- A full RTS mode should require a functioning worker on supported platforms. If worker startup fails, offer retry/suspend/auto-resolution; the current inline fallback risks freezing a phone with the larger simulation.

## 13. Slowness: expected risks and measurable controls

The likely problems are entity growth, changing paths, asset residency, frequent data copying and long-session memory/thermal pressure. Merely extending the clock is insufficient. A long battle with bounded live entities and proper snapshots should have roughly stable per-frame cost; its lifetime increases total battery consumption and accumulated-save work, not the number of units necessarily.

These are design budgets, not claims of current performance. Establish baselines on real representative Android and iOS devices plus desktop before enforcing them as release gates.

### 13.1 Simulation and rendering budgets

| Metric | Standard target | Gate/action |
|---|---|---|
| Sim frequency | Fixed 20 Hz | Never change combat outcome with frame rate |
| Worker tick | p95 ≤10 ms, p99 ≤20 ms at 1,200 active units; measure 2,200 separately | Treat large-scale simulation as a release gate, not a late optimization |
| Desktop render | 60 FPS target, p95 frame ≤20 ms | Reduce shadow/effect/LOD cost when over budget |
| Midrange phone render | Stable 30 FPS, p95 frame ≤40 ms | Sustained thermal test, not first-minute screenshot |
| Input to local acknowledgement | <50 ms UI; command execution target <100 ms at 1× | Main thread never waits for path completion |
| Standard active count | 500 combat + 100 workers per side; 1,200 total | Same entity count and rules on every supported device |
| Large active count | 1,000 combat + 100 workers per side; 2,200 total | Enable only after full-scene CPU, rendering and thermal validation |
| Mobile on-screen triangles | ~500k budget including terrain/scenery | LOD and instancing; start lower on weak devices |
| Desktop on-screen triangles | ~1–1.5M | Only after measured headroom |
| Draw calls | <120 phone, <200 desktop | Batch by mesh/material/LOD and atlas |
| Battle asset payload | ≤20 MB compressed minimum playable set; ≤40 MB full typical battle | Load just selected content; progressive optional detail |
| Texture residency | Aim ≤128 MB phone, ≤256 MB desktop for battlefield assets | GPU memory estimate; lower resolution/evict nonparticipants |
| Battle JS/CPU working set | Aim ≤100 MB incremental, plus separately measured GPU allocations | Avoid retaining the whole map renderer alongside battle |
| Total app tab/process | Investigate around 350 MB on the mobile test tier | Browser/process memory is device-specific; watch OS kills |
| Resume | <2 seconds after cached data on target device | Snapshot restoration, short journal tail |
| End verification | <3 seconds typical, explicit progress for large cases | Worker/job, never UI-thread replay |
| Leakage | No monotonic growth over repeated battles; steady state within ~5% | Dispose/cache budget tests after 10 battle enter/exit cycles |

Initial workload fixtures combine 1,200 active units with 240 actual-manifest city buildings, and 2,200 with 500, before operational structures, walls, projectiles and resource nodes. These city counts are benchmark points, not quotas or truncation limits; validate the full real manifest before admission when a city exceeds them. Count every carried/garrisoned soldier against military capacity; off-map records do not animate but retain their original-army reservations. Suggested new operational-building limits per side are 80 major structures/256 constructed wall segments for standard and 120/384 for large, subject to map-area validation; preserve the complete preexisting city's defenses separately. Passive city buildings use a separate static pool and never consume army or player-production slots. Walls/resources are indexed static entities, not full unit brains. Keep cosmetic debris, particles and corpses in fixed pools; initial mobile pools might hold 150 particles and 40 corpses. Bound authoritative projectiles separately through actual maximum weapon rates/lifetimes; visual effect pooling cannot discard damage events.

Measure 250, 500 and 1,000 combat units per side, each with a developed economy, to locate the scaling curve. Then run a 1,500-per-side exploratory stress case for headroom. Only the 500 and 1,000 capacities are initial product targets; the larger stress case is not an unlocked mode. If the designated mobile floor misses the standard target, revisit hot loops, rendering budgets and the supported-device floor explicitly before release. Silently restoring tiny armies would fail the product requirement.

### 13.2 Pathfinding and collisions

The existing spatial hash and shared flow fields are good foundations. The existing flow cache key is only a goal cell, so placing a wall can invalidate it without a correct new route. Add navigation version/sector revision and movement-clearance class to the key. Door opening, node depletion, construction and destruction must update occupancy atomically.

Use hierarchical navigation: coarse sectors for long routes, local grid flow fields or A* to a target region, and local separation. Share routes for group destinations and worker resource/drop-off pairs. Do not compute a full map flow field for each worker on every trip. Use approach slots for resources, melee and production egress, and deterministic reservations at tight entrances.

Start with fixed limits such as 2,000 path-node expansions per tick across all queued jobs, then tune against map size and response latency. Never solve every pending path in a single frame. Repath only after destination change, relevant obstacle version change or a sustained blockage threshold. Bound caches with LRU eviction and per-map memory caps; serialize authoritative job progress as described above.

Revisit the current Uint16 flow-cost sentinel before increasing map size. A long winding weighted route can exceed 65,535 even when ordinary straight paths do not. Use proven upper bounds or Uint32 costs with explicit unreachable values; test maximum labyrinth routes rather than assuming the old representation scales.

Do not represent unit-unit avoidance as every entity against every other entity. Query nearby spatial buckets, cap neighbors considered, and use stable tie-breaking. Vehicle footprints require clearance, not a giant force pushing through infantry or buildings. Retest chokepoints, workers near depots and mass rallies specifically; these are worse than units walking across empty ground.

At the larger counts, use formation-level destinations, shared route corridors and per-unit local steering. Units keep individual HP, targeting and orders. Stagger expensive target acquisition and strategic planning on a deterministic schedule; resolve movement, cooldowns and combat at the fixed tick rate. Use sector/dirty-region visibility updates and bounded candidate queries rather than scanning every enemy or recomputing all vision cells for every unit each tick. Off-camera combat remains authoritative and continues at the same rules.

### 13.3 Worker/UI traffic

The current loop can emit a render view on every driver frame, and the view allocates nested objects for all squads. Send packed transforms at 10–20 Hz and interpolate at 30/60 FPS. Send economy/HUD summaries at 4 Hz or on important changes. Send structure deltas on lifecycle changes; use fog dirty rectangles or compact arrays at 4–5 Hz.

Use pooled transferable `ArrayBuffer`s with double/triple buffering. Track ownership of transferred buffers so a detached buffer is never reused prematurely. SharedArrayBuffer is an optional later optimization: it needs cross-origin isolation and hosting support, which should not be assumed on the current GitHub Pages deployment.

Hidden enemies should not carry their real current transforms through the view payload; current `visible` flags alone are insufficient for an online threat model. Store remembered positions separately. React state receives selected entity data and summarized panels, never the complete world each frame.

### 13.4 Rendering and assets

Instance soldiers, repeated buildings, resource props, projectiles and trees. Batch shared materials and atlas textures. Three full SkinnedMesh/AnimationMixer stacks per visible soldier will not scale; use the existing rigid rig for prototype actions and a measured GPU bone/vertex-animation texture path for richer production animation. Retain CPU gameplay independence from animation frames.

Mass-army zoom needs an additional distant LOD/impostor tier. At 2,200 visible units, even 200 triangles each consumes 440k triangles before terrain/buildings. Budget silhouettes around 50–100 triangles or a few billboard quads at far zoom; use richer LODs only for the smaller number occupying enough screen pixels. Batch team markings and selection indicators, and aggregate health displays when zoomed out. Picking and unit commands must still resolve individual entity IDs. Limit visual projectile trails, voices and impact effects independently of real damage and casualties. More soldiers need better batching and LOD coverage, not thousands of unique art assets.

Use static/baked ambient shading and blob/contact shadows on the low tier. High tiers can use one limited directional shadow with a small useful range. Default 2048 shadows and hundreds of effects should not be forced on every phone. Cap device pixel ratio around 1–1.25 on low/mobile tiers; desktop can opt into 1.5–2 with headroom.

Suspend the globe and close-map renderer while in battle. Retain a compact campaign state and thumbnail rather than two live WebGL scenes, two render loops and both texture sets. Restore map rendering after a clean battle disposal boundary. Track shared asset reference counts so disposing a clone does not free a mesh still used elsewhere.

Lazy-load only attacker/defender era/style content, with a neutral fallback for optional detail. Do not bundle all five eras × eleven cultures into the initial battle. Prefer meshopt compression already used by the project; KTX2 texture compression is a later measured addition with a fallback path. A 2048 RGBA texture consumes roughly 16 MiB before mipmaps and roughly 21 MiB with mipmaps, even when the PNG download is small, so atlas residency matters more than file size alone.

### 13.5 Long-session stability and overload

Run 60-minute real-time soak tests on hardware, including charging/not-charging, screen background/resume and thermal throttling. Monitor p95 frame/tick time, heap, GPU estimates, draw calls, garbage-collection pauses and checkpoint growth. An accelerated headless simulation is useful for logic but cannot establish battery or thermal behavior.

If overloaded: lower visual resolution, shadows, particles, distant animation rate and decorative density first. Then lower render-payload/UI frequency within responsiveness targets. If authoritative simulation still cannot keep up, disable fast-forward or pause with a clear slow-device message. Do not drop sim ticks, secretly change unit counts, remove enemy AI decisions or slow one side's economy. Capacity presets are chosen before a battle and serialized. A supported device must sustain that preset; a smaller mode is an explicit pre-battle player choice, never a hidden phone restriction or mid-battle change. Save/resume on another device must preserve the original rules and capacity.

## 14. Art requirements and production pipeline

### 14.1 Reuse audit

The inspected branch contains 372 town GLBs, 18 shared town-part GLBs, ten Israelite building GLBs and two Israelite wonder GLBs under `src/assets/map`. These are file counts, not new logical art-item completion totals. Much of the town art is merged for map display. It is useful for scenery, district identity, material palettes, landmarks and extracting source components; it does not provide 372 independent RTS production buildings.

The earlier audit's 443 implemented logical art items should not be confused with RTS readiness. The new feature needs standalone, selectable buildings, readable units at closer battle scale, construction/destruction states and gathering animations. Existing CC0 unit recipes are placeholders. The unmerged Classical infantry pilot is a useful reference, but its animation/import compatibility needs current-branch validation. The new icon sheet from this conversation is still a draft and should not be marked finished production content.

### 14.2 Minimum art for the playable prototype

Use one Classical architectural set and deliberately simple approved placeholders:

- Seven building prefabs: city HQ, expedition camp variant, housing, shared drop-off depot, barracks, ranged range/workshop and defense tower.
- One wall/gate kit, one farm plot, scaffold and rubble kits.
- One actual Classical city's town-component and built-landmark exports, identical IDs/tiers/variants/placements in map and battle, and damaged/ruined states. Building counts follow its real manifest; higher-count stress fixtures are separate.
- Worker, infantry, ranged, cavalry and one siege model/profile. Use simplified materials before finishing every animation.
- Four resource-node families matching the local economy; one biome terrain/scenery set.
- Resource icons, build/train portraits, selection rings, move/attack/build markers, health bars and basic fog.
- Construction/repair/gather feedback, arrows/hits, death and destruction effects; core UI/command audio.

This art gate tests the complete loop. It does not pretend a greybox is the finished five-era product.

### 14.3 Five-era production workload

Count the following as **adaptation/creation tasks**, not necessarily net-new art from scratch. A reusable existing model only reduces work after passing the tactical prefab specification.

| Deliverable | Planned quantity | Scope/count rule |
|---|---:|---|
| Core standalone building prefabs | 60 | 12 roles in section 6.3, excluding farms/walls, × 5 eras |
| Expedition command appearance variants | 5 | One camp/field-HQ appearance per era; shares HQ functionality |
| Modern-only buildings | 3 | Generator, airfield, radar/AA infrastructure |
| Wall/gate kits | 5 | Each kit includes straight/corner/junction/gate and damaged/destroyed states |
| Farm/food-production prefabs | 5 | One functional visual set per era |
| **Operational land-building/prefab tasks** | **78** | 60 + 5 + 3 + 5 + 5; excludes passive civilian city art; kits are not single meshes |
| Passive map-city component coverage | Determine from existing town sources and actual building/landmark catalogs | Earlier 120-family allowance is provisional art-library scope, not city generation; export faithful components with LOD/damage/ruin states |
| World geographic appearance | 8 ground material families, 8 geographic mesh kits, 6 vegetation kits, 4 infrastructure kits | Shared map/RTS source; companion plan specifies connectivity, hex fit and reuse; overlaps the biome/node rows below |
| Land-unit/worker profiles | 30 | Five military roles + one economic worker, × 5 eras |
| Modern fighter + optional economic hauler | 2 | Fighter required for full Modern roster; hauler can follow |
| Resource/scenery node families | About 10 | Shared across eras with appropriate variants; includes mineral, wood, food, salvage and oil props |
| Construction and ruin libraries | 5 era material sets | Shared scaffolds/debris plus building-specific silhouette states |
| Terrain biome dressing | 6 baseline kits | Temperate, desert, Mediterranean, tropical, cold, steppe; coast/river overlays shared |
| UI icons/portraits | Approximately 70–100 assignments | Exact count from content registry; reused portraits allowed; do not multiply by culture |
| Effects | Approximately 15–25 shared effect families | Weapon, gather, build, repair, dust, smoke, fire, water, destruction, selection/ability feedback |
| Audio | Approximately 60–100 edited clips initially | Selection, orders, gather/build, era weapons, alerts, destruction, ambience; variations share families |

Coastal/naval extension adds approximately five dock appearance sets and the approved ship roster, plus water-specific interactions. The preexisting art spec lists 14 ship IDs, so use those as the starting catalog rather than inventing another incompatible fleet list. Existing wonders represented inside the playable city are passive destructible landmarks/objectives with provenance; distant backdrop landmarks are clearly outside playable space. No whole wonder-construction economy is needed inside a single siege.

Do not commission 78 × 11 complete regional variants initially. First make one readable functional set per era, then add culture skins using modular walls, roofs, entrances and banners. Existing regional kits can supply these parts. Functional silhouette must stay consistent enough to identify a barracks across cultures. Regional variation is an art layer, not eleven duplicated balance trees.

Audit actual editable town sources and campaign building catalogs before creating replacements. Export the selected towns' logical building modules and built landmarks into a shared manifest consumed by both views. The earlier 120-family estimate is a provisional asset-library allowance; the audit determines real component/export scope. Intact/damaged/ruined states add production work per source family. Terrain/source-infrastructure kits overlap the six biome dressing sets and node art; use one asset registry to avoid double-counting commissions.

### 14.4 Asset technical contract

Each prefab needs editable source, optimized GLB, preview, license/provenance, footprint/collision metadata, selection bounds, attach/work/egress points, team-color mask, LODs and lifecycle states. Building state art includes foundation, construction, completed, damaged and destroyed. Construction can share scaffolds and a controlled reveal mesh, but footprints and origin remain constant.

Keep the existing map convention of 1 source unit = 10 m where reusing map assets. A battle asset manifest specifies physical dimensions and scale once at import. Unit art has its own existing normalized-game scale. Convert both through explicit import metadata into one battle rendering scale; never enlarge a house or soldier ad hoc in each renderer. Validate facing, ground origin, door/work positions and footprint at all LODs.

Suggested production budgets at battle distance:

- Human: LOD0 2k–5k triangles, LOD1 800–1,500, LOD2 200–400 or impostor; hero close-up assets can be separate.
- Mounted/vehicle/siege: LOD0 4k–8k, LOD1 1.5k–3k, LOD2 300–800.
- Mass-army LOD3: approximately 50–100 triangles or a few billboard quads per distant actor, including readable team/type silhouettes. Export this for every unit family and test at 1,200/2,200 simultaneous actors; per-model LOD2 limits alone do not satisfy the scene budget.
- Common building: LOD0 5k–12k, LOD1 1k–4k, LOD2 200–800; exceptional HQ budget only when measured.
- Walls/resources: a few hundred triangles per visible module at ordinary play distance.
- Shared 1k–2k atlases per era/building family rather than a separate 2k texture for every small prop.

These tactical budgets can be stricter than the current broad unit brief. Define a profile for battle production so existing art validation and new budgets do not contradict each other silently.

Animation families:

| Actor | Required states |
|---|---|
| Worker | Idle, walk, carry, chop, mine, harvest, build, repair, deposit, death |
| Infantry | Idle, walk/run, melee/ranged action, hit, death, retreat; shield/weapon variants |
| Mounted/chariot | Idle, move, attack, hit, death, rider/crew alignment |
| Siege | Move, deploy if needed, aim, fire, reload, destruction; crew can use a shared rig |
| Vehicle | Tracks/wheels, turret yaw/elevation, fire, damage, wreck |
| Aircraft | Flight, attack, return/rearm, destroyed; landing only if gameplay uses it |
| Building | Scaffold progression, damage/fire attachment points, destruction transition |

The current GLTF loader poses a model and converts it into a rigid shader rig; it does not automatically play all exported Blender clips on hundreds of units. Prototype worker actions can extend that rig. Production work must choose and validate an animation-atlas or GPU skinning path before artists create dozens of clips that the renderer cannot use.

### 14.5 Art acceptance

- Recognizable at actual play distance and at phone size, with at least three team colors and colorblind patterns.
- Building entrance and production egress match navigation; a pretty gate cannot have an invisible blocked passage.
- Unit type, enemy/friendly identity, selection and attack readiness read on grass, sand, snow and dark terrain.
- No opaque ground plates conflicting with terrain unless explicitly part of a field/road prefab.
- LOD transitions preserve team marks and critical silhouette; no disappearing walls or unselectable low-detail units.
- Destruction is capped visual effects with authored/static rubble. Do not simulate hundreds of rigid-body bricks.
- Icons are exported individually with alpha and white masks where the UI expects them, inspected at 24/32 pixels. Generated sheets alone are not a complete icon delivery.
- Automated validation checks file formats, footprint, bounds, bones/clips, texture size, material roles, triangle budgets and provenance. Visual review remains separate from passing a JSON audit.

## 15. Packages, tools and asset purchasing

No new runtime game engine is necessary. Package additions below are candidates to pin and verify during implementation; versions/license status should be checked then. No packages have been installed or purchased for this plan.

| Need | Choice | Decision |
|---|---|---|
| Rendering/UI/build | Existing Three.js, React 18, Vite | Keep; avoid React-per-unit and a second scene framework |
| Mobile wrapper | Existing Capacitor | Keep; implement lifecycle pause/save |
| Model optimization | Existing `gltfpack`, meshopt pipeline | Reuse before adding another compression system |
| Model editing | Blender 4.2+ and existing Python import/validation scripts | Required art workflow; reusable source modules |
| Texture/icon export | Existing `sharp` or ImageMagick | Build-time resizing, atlases, masks and validation |
| IndexedDB ergonomics | Native API or small `idb` wrapper | Optional runtime addition; transaction correctness matters more than wrapper |
| Snapshot compression | Browser CompressionStream or measured small codec such as `fflate` | Optional; benchmark CPU versus save-size gain |
| Asset transformations | `@gltf-transform/cli` and related build tools | Optional development dependency for inspection/texture workflows |
| GPU texture compression | Basis Universal/KTX2 tooling + Three.js KTX2Loader | Add after decoder/platform tests and texture-memory measurements |
| Property-based tests | `fast-check` | Useful development dependency for ledger/command invariants |
| UI/browser tests | Existing Vitest and Playwright | Extend; real-device testing still required |
| Navigation | Existing flow fields + project-owned grid/hierarchy | No mandatory external package; deterministic dynamic-obstacle behavior is central |
| ECS | Indexed pools first; evaluate `bitecs` only after profiling | Optional, not a prerequisite rewrite |
| Physics | Simple circles/footprints and deterministic projectile rules | No Rapier/Cannon dependency for basic RTS movement; cosmetic physics optional later |
| Audio | Existing Web Audio battle system | Extend with priorities and pooled voices; no mandatory new library |
| Backend | Existing Supabase for records/auth, separate verifier job if online | Do not put full hour-long replay in a blocking edge/UI call |

For temporary art, evaluate compatible CC0/appropriately licensed Kenney or Quaternius packs and properly licensed audio libraries. These are sourcing candidates, not a claim that a particular pack covers all five eras. Check each pack's actual license, GLB/source export, animation rig, atlas and mobile budget before adopting it. Record a license manifest beside the imported assets. Paid Unity/Unreal marketplace packages can have engine/export restrictions; purchasing a pack does not prove it can be redistributed in this web game. Use original art for distinctive production assets; do not copy AoE/RA2 models, UI art or sounds.

A pack can save modeling time but usually does not solve consistent five-era scale, animated workers, readable counters, building damage states or team colors. Buy only after the prefab/animation contract is proven with one example. Plan a technical-art integration task for every sourced family.

For campaign geographic refinement, use offline GIS/elevation processing such as GDAL/QGIS or equivalent build scripts to bake height/river/land masks into streamable chunks. This is build tooling, not an additional runtime engine or a dependency on external map services during gameplay. The companion plan details exact-cell fitting, continuous terrain and a shared depth/rendering approach.

## 16. Implementation milestones and exit criteria

Develop on a feature branch based on the current bronze-towns head, behind a `battleRuleset: economy-v1` flag. Keep old battle saves tied to their existing ruleset. Keep production deployment separate from feature completion. The following order puts the expensive unknowns before a large art commission.

| Milestone | Deliverable | Exit gate |
|---|---|---|
| M0: baseline and contracts | Profile existing sim/render; define operation/result/asset schemas; one canonical seeded siege fixture | Reproducible baseline, source audit, accounting invariants and target device list |
| M1: large-scale battle kernel | 500 combat + 100 workers per side, then 1,000 + 100; packed unit state, dynamic obstacles, shared routes, compact snapshots and mass-army LOD | Simultaneous movement/combat/worker traffic meets measured device targets; establish supported presets before broad feature/art work |
| M2: economy sandbox | Workers, four resources, drop-off, footprints, construction, production, cap/queue rules | A complete build-gather-train loop with cancellation, blocked egress and save/resume tests |
| M3: campaign bridge | Actual invasion army mapping, reserves, escrow, regular/auxiliary recruits, shared outcome commit | Original troops and new regular survivors reconcile exactly; no duplicate units/costs; attack and defense both work |
| M4: playable Classical siege | Actual map-city manifest parity, passive HP on those exact buildings, tower/wall breach, occupation/destruction, retreat, provisional AI | Canonical building IDs/tiers/variants match both views; complete battle, exact source damage, saved ruins and consistent second invasion |
| M5: mobile and long-session hardening | Touch HUD, assistance, background handling, snapshots, async verification, quality tiers | 60-minute device soak, no lost outcome after crash, responsive end verification |
| M6: all five eras | Era-specific catalogs, mixed-era battles, Modern power/air/AA, production art/imports | Every era and adjacent mixed-era matchup works through the same campaign contract |
| M7: balance and art completion | Economic AI, auto-resolve tuning, final animation/audio/UI, regional modular skins | Balance matrix, art acceptance, capped logistics/loot, sustained performance acceptance |
| M8: optional extensions | Full coastal/dock RTS, capacities above the validated 1,000-per-side target, real-time multiplayer if requested | Separate design and performance/authority gates; the requested large land battles belong in M1–M7 |

Every milestone should end in a playable or measurable improvement. M1 is a technical stress sandbox, not final polish. M4 is the first feature-complete gameplay demonstration. M6/M7 are needed for the requested production feature across the current eras.

Suggested implementation task order within the first real slice:

1. Record same-machine/current-device baseline and clone a fixed city-assault fixture.
2. Add versioned participant profiles and campaign-strength mapping with conservation tests.
3. Add stable entity handles and production-compatible lifecycle without touching the whole application.
4. Implement occupancy/clearance invalidation and one dynamic wall/gate stress test.
5. Build resource nodes and worker jobs, then one depot, house and barracks.
6. Add local costs/queue reservations and a basic infantry spawn/rally loop.
7. Add one reserve call path and block/retry/cancel behavior.
8. Implement operation escrow and exactly-once outcome in attack/defense fixtures.
9. Add city objective, basic economic opponent and pause/save/resume.
10. Replace prototype visuals with one approved Classical asset family, validate phone controls, then expand content.

Do not begin by increasing `MAX_BATTLE_TICKS` and adding timers to the current battle. That makes replay/UI cost worse while providing none of the economy/persistence guarantees.

Effort estimate for planning only: the earlier 20–40 engineering person-week range assumed much smaller active armies. Use a provisional 24–48 person-week range for the revised five-era land RTS scope, with substantial art/animation and QA overlapping. Allow roughly 2–4 person-weeks for the scale prototype/profiling work and 6–10 for a complete Classical prototype, included within that broader estimate. These are broad planning allowances, not benchmark-derived schedule promises; navigation, renderer/animation changes, recruitment policy, mobile performance and final art quality can move them materially. AI-assisted coding does not remove device profiling, integration or playtest time. Re-estimate after M1 and M4 using measured throughput, and resolve unsupported scale before committing to bulk assets.

Those ranges describe the RTS core; the newly requested campaign visual overhaul and persistent destructible city add scope. The companion plan allocates provisional incremental engineering/technical-art ranges and identifies overlapping navigation, materials, LOD and prefab work. Re-estimate the combined program after one shared-terrain/destructible-city full-load prototype rather than summing overlapping budgets blindly.

## 17. Test plan and acceptance matrix

### 17.1 Core invariants

1. `originalStrength = killed + captured + surviving + deliberatelyDetached`, with categories disjoint; wounds do not subtract again from killed strength.
2. Every persistent recruit has exactly one valid authorization and exactly one campaign cost charge.
3. Campaign resource conservation: opening escrow = consumed authorization + refunded unused escrow, with no negative account and no unbounded fractional-rounding loss/gain.
4. Local economy conservation: available + carried + reserved + spent + lost = initial + legally gathered/converted. Depleted nodes cannot yield more than their capacity.
5. Military used + original-army arrival reservations + recruit reservations never exceeds the selected military ceiling; labor used + labor reservations obeys its separate ceiling. Housing loss pauses new production when over logistics capacity, without deleting occupants or blocking already-reserved original-army arrivals. No original troop waits for a friendly death merely to enter a preset that already reserved its slot.
6. Units cannot occupy impassable static terrain; construction cannot strand a mandatory operation behind indestructible geometry.
7. Each original regiment/ally appears in at most one battle and at one campaign location after resolution.
8. Outcome application is idempotent, including escrow refund, XP, plunder, casualties, unit IDs, building-tier loss and military-strength aggregate.
9. Era/tech prerequisites are frozen per participant and enforced in the sim, not just hidden in the build menu.
10. Replay from initial setup and replay from a full checkpoint plus journal tail produce the same authoritative state and result.

Use property-based tests for random command sequences: rapid train/cancel, construction damage/cancel, simultaneous buys, reserve cancellation, save/reload and duplicate end messages. These should exercise conservation behavior rather than mirror internal implementation lines.

### 17.2 Scenario matrix

| Dimension | Minimum coverage |
|---|---|
| Era | All five equal-era pairs; adjacent-era mismatches in both directions; extreme fixture for validation |
| Player role | Attack, defend, field encounter and landing setup; allied mixed-era reinforcements |
| Force scale | One understrength regiment; 6–12 foot regiments yielding 300–600 entities; 500 and 1,000 combatants per side plus 100 workers; over-preset admission and explicitly chosen waves |
| Terrain | Open, forest, hills, desert, river choke, dense city, coastal landing |
| City identity/destruction | Matching biome/roads/rivers/architecture/defense tier, civilian damage stages, splash hits, ruin occupancy, map damage and repeated invasion |
| Map/battle building parity | Identical canonical structure-ID/source/tier/variant sets, built versus unlocked categories, actual town component counts, upgrades, missing art and both load orders |
| Economy | No metal nearby, exhausted food, no credits, lost workers, lost depot, blocked resource node |
| Base state | Existing city damage, low supply, outpost, capital, no garrison but actual defenses |
| Production | Queue blocked by cap/tech/power/manpower/egress; producer destroyed at completion tick |
| Victory | Both objective routes, contested center, timeout, overtime, simultaneous defeat, surrender, failed retreat |
| Persistence | Uncalled reserves, allied survivors, dead new recruits, new regular survivors, auxiliary demobilization |
| Saves | Background at construction completion, checkpoint corruption, full storage, app kill, stale cloud revision |
| Security | Forged resource balance, forged spawn ID, hidden-target command, duplicate sequence, oversized log |
| UI | 844×390 phone, larger tablet, desktop, high-contrast colors, touch selection over crowded buildings |

No invisible architecture assumption should tie the defender's culture or era to the attacker. Test a Classical attacker against Kingdoms buildings, Modern allied armor arriving with an older ally, and a captured advanced building the new owner cannot operate.

### 17.3 Performance/soak tests

- Headless 72,000-tick maximum scenario with deterministic command logs and periodic digest checks.
- Peak combat: 500 then 1,000 combat entities per side concentrated near walls, 100 workers per side using several depots, parallel production completing and both sides calling reserved reinforcements. Include vehicle-heavy mixtures as well as infantry, with projectiles, fog and sound enabled.
- Dynamic obstacle churn: gates, wall destruction, rebuilds and depleted forest nodes; verify route latency and cache growth.
- Dense-city destruction burst: up to 240/500 civilian structures, mass splash damage, several collapsed blocks, defensive fire and a breached gate while armies/workers repath; validate bounded path work and retained HP/plot identities at distant LOD.
- Mass order: select whole army, attack-move across map, issue correction, then resume a snapshot during in-flight path work.
- Validate orders containing the entire 1,000-unit army, replacing the current 64-ID limit. Resolve group membership at the command tick, preserve deterministic ordering and reject malformed oversized payloads without truncating legitimate selections. Test selection, formation changes and mobile group controls while fully zoomed out.
- Real browser for 60 minutes at 1× on real Android/iOS hardware; desktop separately. Include 15-minute warmup before judging thermal stability.
- Ten battle entry/exit cycles with map renderer suspended/restored; compare live allocations after cleanup.
- Slow storage/full quota and cold-load/poor-network assets. Required gameplay cannot hang waiting for an optional skin.
- End verification and auto-takeover latency; neither may block the UI, reroll the seed or erase previous player losses.

Profile each subsystem separately: navigation, collision, targeting, visibility, workers, production, AI, snapshots, persistence, draw calls, texture load/compile, animation and React update rate. A single FPS number cannot distinguish a CPU pathfinding problem from a fill-rate/shadow problem.

### 17.4 Balance acceptance

Initial goals: an even, symmetric, same-era fixture under identical AI policies should approach 50% attacker wins when designed as a neutral skirmish; a prepared fortified-city scenario may intentionally favor defense. Do not force all cities to 50%. Compare both sides of every seed and swap spawn positions to detect map bias.

Track median and tail battle duration, first combat time, first reinforcement time, idle-worker time, resource float, unit mix, turret spam, siege usage, surrender timing, retreat survival, regular-recruit survival and campaign net expenditure. Economy throughput and temporary recruit allowance must permit several meaningful production decisions throughout a 30-minute battle. If the provisional auxiliary/regular limits exhaust after one small fight, adjust allowance and economic tempo together rather than adding infinite free recruits.

Before release, run campaign simulations with frequent commanded-equivalent battles, repeated defense, repeated city raids and quick-mode auto-resolve. Ensure HR, gold, military strength, development, devastation and war exhaustion do not diverge due to one mode's rewards. Use the repository's `balance-sim` workflow when actual macro rules are implemented.

## 18. Highest-risk decisions and chosen defaults

| Risk | Default/mitigation | Evidence that could change it |
|---|---|---|
| Every city takes an hour | 45-minute deadline, early objectives, smaller encounters and auto takeover | Playtest duration and fatigue |
| Tiny armies become huge free map armies | Pre-authorized regular recruits, finite demobilizing auxiliaries, no raw-resource export | Campaign conservation/balance runs |
| Trained troops disappearing feels bad | Explicit regular/auxiliary source label and outcome preview | Player comprehension testing; potentially simplify to all-authorized regulars |
| Existing assets look good on map but fail in RTS | Re-export modular city buildings; shared material/scale/footprint contract and damage/ruin states | One actual phone siege with approved art |
| Beautiful scenery erases city identity or cannot be destroyed | Shared geographic/city descriptor, individually destructible passive plots, real defense tier and persistent ruins | Compare map/battle views and revisit the city after damage |
| Current units are cosmetic formations | 50 individual infantry per full foot regiment; each has real orders, HP and a conserved campaign share | Control feel, tactical/auto-resolve calibration and target-device profiling |
| Huge army advantage disappears behind cap | 500/1,000 combat entities per side, separate labor, whole-army deployment and reserved reinforcement slots; larger preset selected before launch | Simultaneous large-army playtests and explicit handling above validated capacity |
| Phone performance pressures design back into tiny battles | Large-scale M1 benchmark gate, packed simulation, shared paths and distant LOD; same rules on supported devices | Sustained hardware measurements determine supported presets/device floor |
| Base building overwhelms mobile control | Pause, clear context panel, worker assistance and groups | Native 844×390 usability sessions |
| Modern tank/air counters break old class triangle | Weapon-vs-armor tags, separate air rules and era-frozen profiles | Cross-era matchup tests |
| One-hour verification freezes game | Worker/server job; versioned snapshots and short-tail resume | Measured p95 verify/restore time |
| Players lose battle after deployment update | Pin ruleset and preserve compatible pending-battle execution | Save migration tests |
| More technology increases cheating surface | Authoritative ledger/command validation; separate online verification service | Online threat-model review before multiplayer |
| Too much content before fun is proven | One-era complete loop, then five-era expansion | M4 playtest result |

The proposal uses reasonable defaults so design can proceed now. The decisions most worth revisiting after a playable slice are timer length, individual-unit readability, how much in-battle recruitment persists, and whether economic assistance should be enabled by default. None requires delaying the architecture and accounting work.

## 19. Concrete definition of done

The feature is ready when a player can invade a city using their actual army, deploy the full brought force within a validated preset without the old combat-width bottleneck, optionally hold reserves, gather/build/train using the appropriate era, fight an economic opponent, win or defend through explicit objectives, suspend a 40-minute battle safely, and return to the campaign with correct units, costs, destruction and occupation. The battlefield must reproduce the city's actual world-map building/component roster, built tiers, variants, layout, geography and defenses. Those exact passive buildings are individually destructible, and damage to each persists to that same map building and next invasion. All five eras must work, including mixed-era opponents. The standard 500-combatants-plus-100-workers per side siege must remain playable with the full civilian city on the designated mobile floor after sustained use; the 1,000-combatants-per-side preset requires its own published supported-device evidence. A small capped demo or off-map reserve list does not satisfy the large-battle requirement.

A successful screenshot, a passing icon/model audit, a larger timer constant or an RTS sandbox disconnected from the map does not meet that definition. The required evidence is a complete playable campaign loop, conservation/replay tests, accepted art, and measured device performance.

## 20. Source references and audit limits

Inspected through the GitHub connector at the pinned bronze-towns commit. No game code was changed, no packages were installed, and no runtime benchmarks were performed during this planning audit. Performance values above are proposed acceptance targets. The local `rts-research/` files are inspection copies, not a complete runnable checkout.

- [Current branch](https://github.com/yaniv89/terra-imperium/tree/81b933b7d2125ddf567833eae3f7b92900bffb2a)
- [Repository architecture and rules](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/CLAUDE.md)
- [Existing RTS implementation plan, including old no-economy scope](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/design/rts-battles-implementation-plan.md)
- [Original RTS invasion specification](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/design/rts-invasion-battles-spec.md)
- [Battle setup and city building conversion](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/setup/buildBattleSetup.js)
- [Current world and campaign-unit mapping](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/sim/world.js)
- [Current terrain deployment widths of 3–6 squads](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/data/combatWidth.js)
- [Current battle clocks](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/sim/constants.js)
- [Flow field cache and spatial queries](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/sim/pathing.js)
- [Worker driver and resume replay](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/worker/battleLoop.js)
- [Checkpoint storage](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/worker/battleStore.js)
- [Reducer result verification and recruitment](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/engine/gameReducer.js)
- [Campaign invasion consequences](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/engine/invasion.js)
- [Unit roster and counters](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/data/unitClasses.js)
- [Effective campaign eras](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/data/ages.js)
- [Unit loader's rigid animation conversion](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/render/gltfUnitLoader.js)
- [Current dependency manifest](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/package.json)
- [Mechanic design checklist](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/.claude/skills/add-mechanic/SKILL.md)
- [Battle investigation and verification checklist](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/.claude/skills/battle-lab/SKILL.md)

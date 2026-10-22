# Civilization V, VI and VII: hex map, movement and combat rules

Scope note: the Civilization fandom wiki (civilization.fandom.com) returned HTTP 402 to direct fetches, so wiki facts below come from search-result extracts of those pages or from CivFanatics, civilopedia.net (a mirror of the Civ VI in-game Civilopedia) and the official 2K site. Version is noted on every rule: V = Civ V (vanilla / G&K / BNW), VI = Civ VI (Gathering Storm ruleset unless noted), VII = Civ VII (launched February 2025).

## Map: hexes, terrain, movement, rivers, roads, embarking, map sizes

### Takeaway
All three games use one hex grid on a cylinder-style map. Movement is integer move points spent per tile entered, with rough terrain costing 2. Civ VI rounds movement costs down (you can't enter a 2-cost tile with 1 point left), and river crossings cost movement points instead of ending the move. Civ VI map sizes run from 44x26 (Duel, 1,144 tiles) to 106x66 (Huge, 6,996 tiles). Civ VII has five sizes and splits maps into Homelands and Distant Lands.

### Cited Findings
- VI: open terrain (plains, grassland) costs 1 movement point; woods and hills cost 2 or more — [CivFanatics, Movement in terrain, quoting the wiki](https://forums.civfanatics.com/threads/movement-in-terrain.612700)
- VI: movement costs round down: a unit with 1 point left cannot enter a tile costing more than 1. Earlier games let the last point always enter — [CivFanatics, Movement in terrain](https://forums.civfanatics.com/threads/movement-in-terrain.612700)
- VI (early preview data, may have changed): hills and woods have defense modifier 3 and movement cost 2 — [CivFanatics, screenshot analysis](https://forums.civfanatics.com/threads/screenshot-analysis.567143/page-23)
- VI: rivers cost movement points to cross instead of ending the unit's move as in earlier games (preview statement) — [CivFanatics, screenshot analysis](https://forums.civfanatics.com/threads/screenshot-analysis.567143/page-23)
- VI (forum recollection, not verified): roads cost half a move, then a third after a later tech; roads bridge rivers only after Construction — [CivFanatics, Movement in terrain](https://forums.civfanatics.com/threads/movement-in-terrain.612700)
- VI (community testing on the wiki talk page): embarking costs 2 extra move points on top of the normal sea cost of 1 (3 total); disembarking costs 2 extra on top of the land cost — [Talk:Movement (Civ6)](https://civilization.fandom.com/wiki/Talk:Movement_(Civ6))
- VI: units spend movement points to enter tiles, to attack and to pillage; the cost of a tile is set by its terrain; once points are spent the unit stops until next turn — [Civilopedia, Movement](https://www.civilopedia.net/en-US/gathering-storm/concepts/movement_1/)
- VI: terrain that helps defence: hills, woods, rainforest, and being across a river from the attacker. Floodplains and marsh hurt the defender (no numbers on the page) — [Civilopedia, Combat Bonuses](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_7/)
- VI map sizes (fan-compiled from game data): Duel 44x26 (1,144 tiles), Tiny 60x38 (2,280), Small 74x46 (3,404), Standard 84x54 (4,536), Large 96x60 (5,760), Huge 106x66 (6,996). The default setup is Small, not Standard — [CivFanatics, Map size and game speed](https://forums.civfanatics.com/threads/map-size-and-game-speed.654188)
- V map sizes (forum list): Duel about 40x25 with 2 civs, 4 city-states, 2 natural wonders; Huge 128x80 with 12 civs, 24 city-states, 7 natural wonders. Duel dimensions are quoted as 40x24 or 40x25 in different posts — [Steam, Civ V map size thread](https://steamcommunity.com/app/8930/discussions/0/828938532517691848)
- VI's Large and Huge are smaller than V's, while VI's Duel, Tiny and Small are slightly larger — [Steam, Civ VI map size thread](https://steamcommunity.com/app/289070/discussions/0/282992646967059621)
- VII map sizes: Tiny, Small, Standard, Large, Huge. Map types are Voronoi (Continents & Islands, Pangaea & Islands, Fractal Continents, Shattered Seas, Archipelago) and Legacy (Continents, Pangea Plus, Continents Plus, Archipelago Hemispheres, Fractal, Shuffle, Terra Incognita). Pangea Plus puts every player on one Homeland ringed by Distant Lands islands — [2K, Civ VII Map Types](https://civilization.2k.com/civ-vii/game-guide/gameplay/map-types/)
- VII: naval units can sail up Navigable Rivers and capture undefended settlements — [2K, Civ VII Combat dev diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/combat/)
- V (vanilla): defender terrain modifiers are rough terrain (forest, jungle, hills) +25%, marsh -15%, open terrain -10% — [CivFanatics, The Mechanics of Combat (vanilla)](https://forums.civfanatics.com/resources/the-mechanics-of-combat-vanilla.25621/)

### Inferences
- Civ's terrain model is per tile (one terrain, plus at most one feature, plus hills), and rivers sit on hex edges. Our grid already stores river sizes per hex edge, so the mapping matches.
- Civ's tiles are much coarser than ours: a Huge Civ VI map has about 7,000 tiles in total. Our f100 grid has 29,250 land cells alone.

### Gaps
- Exact Civ VI movement costs for rainforest, marsh, and mountains (impassable in VI before some late units) could not be read from a primary source. Commonly quoted values are rainforest 2, marsh 2, hills +1, mountains impassable, but these are unverified here.
- Civ VI terrain yields table (grassland 2 food, plains 1 food 1 production, etc.) was not fetched because the wiki blocked access. Unverified.
- Civ VI per-size civ and city-state counts: one non-authoritative site lists Duel 4, Tiny 6, Small 8, Standard 8, Large 10, Huge 12 players, which conflicts with other figures. Not confirmed.
- Civ VII per-size player and Independent Power counts, wrap-around behaviour, and terrain or movement tables were not found in official pages.
- Civ VII river rules (minor rivers on edges plus navigable rivers as water tiles) are only partly sourced (navigable rivers above).

## Units on the map: stacking, formations, Commanders, ZOC, sight, XP, healing, fortify, upkeep

### Takeaway
V and VI allow one military unit per tile (VI lets a support or civilian unit share as an escort). VI adds Corps (2 units, +10 strength) and Armies (3 units, +17) late in the game, which never split. VII keeps one unit per tile in combat but adds Commanders that pack units into one moving stack and unpack them onto adjacent tiles. In VII only Commanders earn XP and promotions, and they keep them across Ages.

### Cited Findings
- VI: a military unit can join a support or civilian unit in an escort formation at any time; naval units can carry embarked land units in formation — [Civilopedia, Formations](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_12/)
- VI: Corps (Nationalism civic): two same-type units, +10 base combat strength. Army (Mobilization): three same-type units, +7 more (+17 total). HP does not increase, formations cannot be split, and the formation keeps the best unit's XP and promotions. Naval Fleets and Armadas are the sea equivalent — [Civilopedia, Formations](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_12/)
- VI: measured effect: a Corps (+10) does about 1.5x damage, an Army (+17) about 2x — [CivFanatics, Hans Lemurson combat formula](https://forums.civfanatics.com/threads/hans-lemurson-figures-out-the-combat-formula.606147/)
- VI: units gain XP by surviving combat or entering a tribal village, then level up and pick a promotion, which heals some HP. No further XP accrues until the promotion is picked (the page gives no thresholds) — [Civilopedia, Experience and Promotions](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_8/)
- VI healing per turn: 5 HP in enemy territory, 10 in neutral (unclaimed or a friendly civ's land, not an ally's), 15 in friendly territory, 20 in a city. Fortifying does not change healing. Medic I heals units on the same tile by +10, Medic II adjacent tiles too — [CivFanatics, How much a unit heals per turn](https://forums.civfanatics.com/threads/how-much-a-unit-heals-per-turn.519747)
- VI: a city centre or encampment is under siege when all 6 adjacent tiles are enemy-occupied, under enemy zone of control, or impassable. A besieged district does not heal — [Civilopedia, City Combat](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_9/)
- VII: one unit per tile, carried over from V and VI. Commanders (Army, Fleet, and air variants) pack nearby units into one stack that moves at the Commander's speed. The stack unpacks onto adjacent tiles to fight. A packed army can overrun weaker units. Commanders can request Reinforcements, which travel to them automatically — [2K, Civ VII Combat dev diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/combat/)
- VII: only Commanders earn XP and promotions, mostly from battles fought by troops nearby. Commanders are Ageless and keep XP and promotions across Ages. Army Commander trees: Bastion (defence), Assault, Logistics, Maneuver, Leadership. Commander orders act on every unit in the Command Radius: a coordinated attack with extra strength, heal, repair, fortify — [2K, Civ VII Combat dev diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/combat/)
- VII: the default Command Radius is 1 tile around the Commander, and promotion bonuses apply only inside it. A commendation (Merit) adds +1 radius — search extracts of [Civ7 Combat wiki](https://civilization.fandom.com/wiki/Combat_(Civ7)) and [List of promotions in Civ7](https://civilization.fandom.com/wiki/List_of_promotions_in_Civ7)
- VII: capacity: Commanders carry a fixed number of units for the whole game, and one Logistics promotion (Regiments) adds +2. Sources disagree on the base (commonly 4, so 6 with the promotion) — [CivFanatics, Thoughts on civ7 combat and commanders](https://forums.civfanatics.com/threads/thoughts-on-civ7-combat-and-commanders.698758/page-2); [CivFanatics, How to add more to army](https://forums.civfanatics.com/threads/how-to-add-more-to-army.695161/)
- VII Bastion tree examples: Bulwark (units in radius finish Fortify 1 turn faster), Defilade (+3 strength from fortifications), Garrison (+10 HP to fortified districts in the city when stationed on the city centre). Commendations can give +5 strength in radius. "Mettle and Courage" gives +5 in friendly territory — search extracts of [List of promotions in Civ7](https://civilization.fandom.com/wiki/List_of_promotions_in_Civ7) and [Civ7 Combat wiki](https://civilization.fandom.com/wiki/Combat_(Civ7))
- VII: Commanders are support units and cannot attack themselves — search extract of [Civ7 Combat wiki](https://civilization.fandom.com/wiki/Combat_(Civ7))
- V (vanilla): fortification +25% the first turn, +50% each turn after — [CivFanatics, The Mechanics of Combat (vanilla)](https://forums.civfanatics.com/resources/the-mechanics-of-combat-vanilla.25621/)

### Inferences
- VII's Commander is the closest Civ analogue to a moving "army stack" on a tile. It still fights as one unit per tile after unpacking, so Civ never resolves a whole stack as one battle the way our field battles do.
- VI's healing ladder (5/10/15/20 by territory) is a simple, legible rule worth comparing to our supply meter.

### Gaps
- Zone of control rules (V and VI: entering a tile next to an enemy ends movement when moving between two ZOC tiles; cavalry ignore in some cases) were not read from a primary page in this pass. Unverified.
- Sight radius (2 tiles base in V and VI, +1 on hills) is unverified here.
- VI XP thresholds (commonly 15/45/90/150/225, 5 XP per attack, 2 XP per defence, barbarian cap) are unverified here.
- Gold upkeep per unit: V uses a rising cost per unit beyond a free count, VI charges a per-unit gold upkeep by era. Exact numbers not found.
- V, VI, VII healing differences, and V's healing (commonly 10/15/20/25 HP) are unverified.
- VII healing rates: a Steam thread reports 10/15/20 like VI, unconfirmed.

## Combat: strength formula, randomness, ranged, flanking, terrain, rivers, counters, cities

### Takeaway
VI and VII use a strength-difference formula. Equal units deal about 30 damage out of 100 HP, and each point of strength advantage is worth about 4% more damage. +30 strength is roughly a one-hit kill. VII's developers give 30 x e^(k x diff) with k = ln(100/30)/30 (about 0.040) and a 70-130% random factor. VI's community fit is 30 x e^(diff/25) x random 0.75-1.25. V instead uses a strength ratio and flat percent modifiers. Walls (VI) take 15% damage from melee, 50% from ranged and 100% from siege. In VII the attacker must take every walled district before the city centre.

### Cited Findings
- VII (developer-provided formula on the wiki): Damage = 30 x e^(k x StrengthDifference) x random(0.70 to 1.30), k = ln(100/30)/30 ≈ 0.040. The difference is the attacker's Combat, Ranged or Bombard strength minus the defender's Combat or Defense — search extract of [Civ7 Combat wiki](https://civilization.fandom.com/wiki/Combat_(Civ7))
- VII: wounded penalty to combat strength = round(10 - HP/10). A unit at 30 HP loses 7, one at 1 HP loses 10 — search extract of [Civ7 Combat wiki](https://civilization.fandom.com/wiki/Combat_(Civ7))
- VII: group (Commander-ordered) attacks typically give +2 strength to each unit that takes part — search extract of [Civ7 Combat wiki](https://civilization.fandom.com/wiki/Combat_(Civ7))
- VII: battles resolve one unit at a time. Attackers no longer return to their hex after combat. Engaging an enemy sets a front between the two units, and attacks from the sides or rear get flanking bonuses (no number given) — [2K, Civ VII Combat dev diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/combat/)
- VI (community fit from combat logs, not official): Damage = 30 x e^(diff/25) x random(0.75 to 1.25). Equivalent forms are 30 x 2^(diff/17) and 30 x 1.041^diff — [CivFanatics, Hans Lemurson figures out the Combat Formula](https://forums.civfanatics.com/threads/hans-lemurson-figures-out-the-combat-formula.606147/)
- VI benchmarks: +5 strength gives about 20% more damage dealt and 20% less taken; +10 gives 50%; +17 gives 100%; +30 gives 3.33x, a one-hit kill. One player saw 30-41 damage over several +5 battles — [CivFanatics, Valuing Units & Buildings](https://forums.civfanatics.com/threads/valuing-units-buildings.646107/latest)
- VI: a later poster fitted city or district combat to a baseline near 15, about half the unit baseline, from few samples (uncertain) — [CivFanatics, Hans Lemurson thread](https://forums.civfanatics.com/threads/hans-lemurson-figures-out-the-combat-formula.606147/)
- VI: siege units bombarding non-city units take a 17-strength penalty (a flat cut, not 50%) — [CivFanatics, a question regarding bombard strength](https://forums.civfanatics.com/threads/a-question-regarding-bombard-strength.621008)
- VI flanking: unlocked by the Military Tradition civic, attacker only. A melee attacker gets +2 for each other friendly military unit adjacent to the target, and the first attacker gets nothing. Light cavalry's Double Envelopment doubles it. Flanking does not apply against walls or encampments — [CivFanatics, Civ VI Flanking and Support](https://forums.civfanatics.com/resources/civ-vi-flanking-and-support.27610/); [Civilopedia, Combat Bonuses](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_7/)
- VI support: defender only, against non-ranged attackers: +2 per adjacent friendly military unit (allies don't count). Ranged attacks ignore support. Anti-cavalry with the Square promotion gives +4. Units in cities or encampments can give support but not receive it — [CivFanatics, Civ VI Flanking and Support](https://forums.civfanatics.com/resources/civ-vi-flanking-and-support.27610/)
- VI cities: city combat strength is the strongest melee unit the civ has built minus 10, or the garrison's strength. Each unpillaged district adds a bonus. A city needs walls to make ranged attacks, and its ranged strength comes from the strongest ranged unit — [Civilopedia, City Combat](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_9/)
- VI walls: melee units deal 15% of normal damage, ranged 50%, bombard (siege) 100%. Damaged walls lose effect, and repair needs 3 turns without damage. Capture usually takes several turns — [Civilopedia, City Combat](https://www.civilopedia.net/en-US/gathering-storm/concepts/combat_9/)
- VI walls damage was observed capped at 200 per hit in logs (uncertain) — [CivFanatics, Hans Lemurson thread](https://forums.civfanatics.com/threads/hans-lemurson-figures-out-the-combat-formula.606147/)
- VII cities: settlements sprawl into Urban Districts, which can be walled and hold military buildings. Attackers must conquer every fortified district before the city centre. A captured walled district changes hands and stops paying the defender's yields. Siege units specialise in walls — [2K, Civ VII Combat dev diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/combat/)
- V (vanilla, patch 1.0.1.383, 10 HP units): r = max CS / min CS, m = 0.5 + (r+3)^4/512. The weaker side's damage is min x m and spread x m, the stronger side's is divided by m. Damage = max(floor(min + random(0, spread)), 1). Melee base min 4, spread 4; ranged base min 2, spread 4. Wounded output falls about 10% per 2 HP lost. City damage multiplier 0.5 — [CivFanatics, The Mechanics of Combat (vanilla)](https://forums.civfanatics.com/resources/the-mechanics-of-combat-vanilla.25621/)
- V (vanilla) modifiers, added then applied to base strength: flanking +10% per friendly unit adjacent to the target; attacking across a river -20%; amphibious melee -50%; fortify +25%/+50%; very unhappy -33%; missing strategic resource -50%; total penalty capped at -90%. Ranged-vs-ranged defenders get x1.25; naval defence vs naval x0.4 — [CivFanatics, The Mechanics of Combat (vanilla)](https://forums.civfanatics.com/resources/the-mechanics-of-combat-vanilla.25621/)
- V: units had 10 HP in vanilla, raised to 100 in Gods & Kings to make it harder for primitive units to beat advanced ones with numbers — search extract of [Hit points wiki](https://civilization.fandom.com/wiki/Hit_points)
- V: cities have HP, melee attackers take damage when attacking a city, garrisons and defensive buildings raise city strength, cities heal about 15% HP a turn, and flanking around a city matters — [Wikipedia, Civilization V](https://en.wikipedia.org/wiki/Civilization_V)
- Comparison: VI moved from V's ratio formula to a difference formula, and flanking became flat +2 per unit instead of +10% — [CivFanatics, Civ VI Flanking and Support](https://forums.civfanatics.com/resources/civ-vi-flanking-and-support.27610/); [CivFanatics, How is combat calculated](https://forums.civfanatics.com/threads/how-is-combat-calculated.572105/)

### Inferences
- In VI and VII, strength is an additive scale: every bonus is a flat number of points, and points convert to damage exponentially (+17 doubles damage, +30 kills). This makes stacking small bonuses (+2 flank, +3 terrain, +5 fortify, +10 corps) easy to read and to balance. V's percent modifiers on a ratio behave similarly but are harder to show.
- Both VI and VII deal partial damage (about 30 of 100 HP at parity), so a fight between equals takes 3 or more attacks. This is why healing per turn and the wounded penalty matter so much in Civ.
- VI's wall rule (15% melee / 50% ranged / 100% siege) is a clean "you need siege" gate, comparable to our walls' HP and gate.

### Gaps
- Civ VI terrain defence numbers (hills, woods and rainforest +3; marsh and floodplains -2) and the river-crossing attack penalty (-5), fortify (+4 or +6) and amphibious penalty are only partly sourced (early preview "3"). Unverified.
- Civ VI unit counters (anti-cavalry +10 vs light and heavy cavalry, etc.) and city HP and wall HP by era (ancient 50, medieval 100, renaissance 100, city 200) are unverified here.
- How Civ VI captures cities (a melee unit enters at 0 HP) and razing rules, and Civ VII capture and raze rules beyond the district rule, were not read from a source.
- Civ V Gods & Kings and Brave New World formula on 100 HP (commonly quoted as about 30 damage at parity on a ratio curve, with the wounded penalty at up to -50%) is not sourced here.
- Civ VII terrain and river modifiers, ranged ranges and the combat preview were not found in primary sources.
- Civ VII numbers in a Chill Place Gaming explainer ("5-10% per strength point") conflict with the wiki formula and were not used.

## War weariness, grievances and similar penalties

### Takeaway
VI tracks war weariness points from every battle against a major civ, doubled when fighting outside your borders. It converts them to -1 amenity per 400 points each turn. Gathering Storm adds Grievances, a diplomatic cost for war declarations and conquests. VII replaces this with War Support versus War Weariness, which hits happiness and combat strength.

### Cited Findings
- VI war weariness: points are added on every battle against units of another major civ, city combat included; pillaging, raiding trade routes and declarations do not count. The multiplier is 1 inside your borders (including occupied cities) and 2 outside. Each turn you get -1 amenity per 400 points, applied to your cities. Casus belli and holy wars accrue weariness slower than surprise wars. A nuke adds 12x the era base value — search extract of [War weariness (Civ6)](https://civilization.fandom.com/wiki/War_weariness_(Civ6))
- VI Grievances (Gathering Storm) replaced warmongering. Declaring war, conquering, razing and keeping cities after peace all generate grievances, and a casus belli reduces them. Denouncing is a major source — search extract of [Grievances (Civ6)](https://civilization.fandom.com/wiki/Grievances_(Civ6))
- VI forum estimate: formal war costs about 25 grievances for the denouncement plus about 100 for the declaration 5 turns later. A surprise war costs about 150. Grievances decay over time — [CivFanatics, Surprise war?](https://forums.civfanatics.com/threads/surprise-war.681883/)
- VI: a formal war casus belli is available 5 turns after denouncing. A surprise war carries an extra 50% of the formal-war warmonger penalty. A Holy War halves the warmonger penalty for the declaration and for capturing or razing cities (base-game warmonger system) — [Civilopedia, Casus Belli](https://www.civilopedia.net/en-US/gathering-storm/concepts/diplo_3/)
- VII: War Support is positive and offsets War Weariness, which builds over a long war and stacks with the number of leaders fought. Without enough support, the population's happiness and the army's combat strength fall. Support comes from the Militaristic attribute tree (+1), from buying it for 180 Influence (which also adds weariness to the other side), and from the Gate of All Nations wonder (+2, carried across Ages) — [Game8, Civ 7 War Weariness and War Support](https://game8.co/games/Civ-7/archives/499718)
- VII: -1 combat strength per point of negative war support for military units, plus more unhappiness. A forum list says support only penalises the opponent; the two accounts conflict — search extracts of [War (Civ7) wiki](https://civilization.fandom.com/wiki/War_(Civ7)) and [CivFanatics, The Ultimate List of Things Civ 7 doesn't tell you](https://forums.civfanatics.com/threads/the-ultimate-list-of-things-civ-7-doesnt-tell-you.695556/)

### Inferences
- VI's location multiplier (x2 abroad) rewards defensive wars. That is a cheap rule to copy if we want war exhaustion to punish offensive campaigns more.

### Gaps
- Civ V war weariness (BNW: unhappiness from Ideology and war) and its warmonger penalty numbers were not researched.
- The exact Civ VI grievance table and decay rate were not fetched.

## How Civ VII changed combat and armies (Commanders, packing, fortified districts, Ages and crises)

### Takeaway
VII keeps one unit per tile in battle but moves armies as packed stacks under ageless Commanders. Commanders hold all the XP and promotions. Cities are sieged district by district. Fights chain in one turn (attackers don't snap back to their hex), and flanking is by facing, not by counting neighbours.

### Cited Findings
- VII changes at launch: Commanders (pack and unpack, radius orders, reinforcements, overrun); only Commanders earn XP and promotions; Commanders are Ageless; attackers do not return to their hex after combat; flanking is set by fronts; walled Urban Districts are each taken before the city centre; navigable rivers carry fleets inland — [2K, Civ VII Combat dev diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/combat/)
- VII: the dev diary is dated December 2024 and notes the game has changed since launch; 2K points to its Gameplay page for current rules — [2K, Civ VII Combat dev diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/combat/)

### Inferences
- VII's Commander "pack, travel, unpack beside the target" model is a halfway point between Civ's one-unit-per-tile and our stack-per-tile armies. It may be a useful UI reference for our marches and field battles.

### Gaps
- How the Age transition (crisis, then reset at Antiquity to Exploration to Modern) treats units on the map was not sourced in this pass. Commonly reported: units are pulled back or upgraded and wars end at the age change. Unverified.
- Post-launch Civ VII patch changes (2025-2026) to combat, Commanders and war support were not reviewed. Check 2K patch notes before relying on numbers above.

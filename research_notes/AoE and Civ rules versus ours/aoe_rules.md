# Age of Empires gameplay rules (AoE2 DE and AoE4, with AoM/AoE3 notes)

Research note, 2026-10-22. Method: web searches (the fandom wiki and Liquipedia refuse direct fetches, so figures come from search-result extracts of those pages, official ageofempires.com guides, Steam guides and forums). Numbers can shift by patch; each claim carries its source. Anything known only from memory is kept in the Gaps sections, never in Cited Findings.

## Economy: villagers, resources, gather rates, drop-off, farms, pop cap, TC production, upgrades

### Takeaway
Both games run on villagers carrying small loads (10 per trip, more with upgrades) from a resource to the nearest drop-off building, so real income is gather rate minus walking time. AoE2 base rates are about 0.31 to 0.39 resource per second per villager; AoE4 is faster, about 0.75 per second (45 a minute). Food ends on farms; population is capped at 200 and raised by houses.

### Cited Findings
**AoE2 DE gather rates (per villager, per second, while gathering, no upgrades):**
- Wood 0.39/s (23.4/min; more precise 0.388), gold 0.379/s, stone 0.36/s (0.359), berries/forage 0.31/s, carry capacity 10. — [AoE wiki: Villager (AoE2)](https://ageofempires.fandom.com/wiki/Villager_(Age_of_Empires_II)); [AoE wiki: Resource](https://ageofempires.fandom.com/wiki/Resource)
- Food sources: pasture 0.49/s (carry 3), fish 0.43/s (carry 10), huntables 0.41/s (carry 35), herdables/sheep 0.33/s (carry 10), farm 0.32/s (carry 10). — [AoE wiki: Villager (AoE2)](https://ageofempires.fandom.com/wiki/Villager_(Age_of_Empires_II))
- A farmer next to a drop site nets about 0.356 food/s with no upgrades and 0.49 food/s fully upgraded, once walking is included; the listed rates exclude walking, techs and civ bonuses. — [AoE wiki: Food](https://ageofempires.fandom.com/wiki/Food)
- Measured farm output in practice is lower than the raw rate because of walking and occasional villager stalls. — [Steam guide: Farming Rates in AoE2 DE](https://steamcommunity.com/sharedfiles/filedetails/?id=1932327114)
- Villager: 50 food, 25 s at the Town Center. — [aoe2.ai eco calculator](https://aoe2.ai/en/eco); [West Games AoE2 calculator](https://west-games.com/aoe2-resource-calculator/)
- Farm reseed costs 60 wood; one calculator says a farm holds 375 food and runs dry every 987 s (CONFLICT: the commonly cited base is 175 food, see Gaps; 375 may include upgrades). — [aoe2.ai eco calculator](https://aoe2.ai/en/eco)
- Population: cap 200 by default (DE lobbies allow up to 500); a house gives 5 (Inca 10), a Town Center gives 5 (Chinese 15). — [AoE wiki: Population](https://ageofempires.fandom.com/wiki/Population); [AoE wiki: House (AoE2)](https://ageofempires.fandom.com/wiki/House_(Age_of_Empires_II))
- Relics in a Monastery give 0.5 gold/s (30 gold a minute) each: a trickle income. — [AoE wiki: Relic (AoE2)](https://ageofempires.fandom.com/wiki/Relic_(Age_of_Empires_II)); [aoecoach: Monastery](https://aoecoach.com/en/resources/buildings/monastery/)
- Idle villager: on Xbox, D-pad Up selects an idle villager (PC has an idle-villager button and hotkey). — [ageofempires.com: Controlling your empire (Xbox)](https://www.ageofempires.com/learn-to-play/controlling-your-empire-gathering-resources-xbox/)

**AoE4 gather rates and economy:**
- Base villager carry capacity 10 for every resource, 25 for hunted meat. — [AoE wiki: Villager (AoE4)](https://ageofempires.fandom.com/wiki/Villager_(Age_of_Empires_IV))
- Wiki per-second base rate 0.75 for trees, gold veins and stone (about 45/min each). Community guide: shoreline fish 60 food/min, deer 49.5, sheep and farms 45, berries 41.4 (non-Chinese). A player's ten-minute timing: deer ~0.827/s, sheep 0.75/s, berries ~0.66/s, farm ~0.625/s (rates differ by patch). — [AoE wiki: Resource (AoE4)](https://ageofempires.fandom.com/wiki/Resource_(Age_of_Empires_IV)); [Steam guide: AOE4 Comprehensive Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3757716456); [Steam discussion: food gather rates](https://steamcommunity.com/app/1466860/discussions/0/3199240042196097418/)
- Upgrades: Wheelbarrow +5 carry and +15% villager speed (not Japanese); Double Broadaxe +15% wood; Specialized Pick and Shaft Mining +15% gold/stone each; Horticulture and Fertilization +10% food each. — [AoE wiki: Wheelbarrow (AoE4)](https://ageofempires.fandom.com/wiki/Wheelbarrow_(Age_of_Empires_IV)); [AoE wiki: Villager (AoE4)](https://ageofempires.fandom.com/wiki/Villager_(Age_of_Empires_IV))
- Pop cap 200; start with 10 from the capital TC; a house gives +10, so 19 houses reach the cap; extra TCs also add population (sources disagree: +10 or +20). — [Gamewatcher: AoE4 population limit](https://www.gamewatcher.com/age-of-empires-4-population-limit); [KnowGamePlay: AoE4 max population](https://knowgameplay.blog/aoe-4-max-population-limit)

**AoE2 economic upgrades:** blacksmith-style chains exist for the economy too (Double-Bit Axe/Bow Saw/Two-Man Saw for wood, Gold/Stone Mining and Shaft for mines, Horse Collar/Heavy Plow/Crop Rotation for farms, Wheelbarrow/Hand Cart for carry and speed); I could not retrieve the exact per-tech percentages (see Gaps).

### Inferences
- In both games the walking-time loss pushes players to place drop-off camps (lumber camp, mining camp, mill) right at the resource; this is the main "economy micro" and the main reason the 10-unit carry exists.
- AoE4 roughly doubles AoE2's per-villager gather speed, which shortens games (see game length below).
- Trickle income (relics; in AoE4 also some civ features) is small next to villager income: one relic = 30 gold/min, about 1.3 villagers on gold.

### Gaps
- AoE2 farm food per seed: commonly 175 base in DE (from memory, with Horse Collar +75, Heavy Plow +125, Crop Rotation +175); the one source found said 375. Unverified.
- Exact AoE2 eco tech values (from memory, unverified: wood +20%/+15%/+10%; gold and stone mining +15% each; Wheelbarrow +10% speed +25% carry, Hand Cart +10% speed +50% carry).
- AoE4 farms: believed to be infinite food (no reseed) and AoE4 villager 50 food, 20 s; not confirmed by any source found.
- AoE2 DE auto-reseed farms via the mill queue and the "auto-scout"/idle notification features: not sourced.

## Ages: cost, time, landmarks, unlocks, timing

### Takeaway
AoE2 has four ages bought at the Town Center with food (then food plus gold) and gated by two buildings of the current age; AoE4 also has four ages but you build one of two civ-specific Landmark buildings with villagers, so the age-up is a construction that can be sped up and attacked.

### Cited Findings
- AoE2 costs: Feudal 500 food, Castle 800 food + 200 gold, Imperial 1000 food + 800 gold. — [ageofempires.com: Advancing to the next age (AoE2)](https://www.ageofempires.com/learn-to-play/advancing-aoe2/)
- AoE2 research time at the TC: Feudal 130 s, Castle 160 s (2:40), Imperial 190 s (3:10). — [AoE wiki: Feudal Age (AoE2)](https://ageofempires.fandom.com/wiki/Feudal_Age_(Age_of_Empires_II)); [Liquipedia: Castle Age](https://liquipedia.net/ageofempires/Castle_Age); [Liquipedia: Imperial Age](https://liquipedia.net/ageofempires/Imperial_Age)
- AoE2 building gates: Castle needs two Feudal buildings (e.g. Blacksmith and Stable); Imperial needs a Castle or two Castle Age buildings. Civ bonuses change these (Byzantine Imperial 33% cheaper; Khmer need no buildings). — [ageofempires.com: Advancing](https://www.ageofempires.com/learn-to-play/advancing-aoe2/); [AoE wiki: Imperial Age (AoE2)](https://ageofempires.fandom.com/wiki/Imperial_Age_(Age_of_Empires_II))
- AoE4 Landmarks: Feudal 400 food + 200 gold, Castle 1200 food + 600 gold, Imperial 2400 food + 1200 gold; build time about 3:10 (Feudal) and 3:40 (Castle) with one villager; one landmark per age is enough (Chinese can build the other later). Imperial build time not found. — [GameRant: AoE4 landmarks](https://gamerant.com/age-of-empires-4-landmarks-guide/); [GameSkinny: how to advance](https://www.gameskinny.com/tips/age-of-empires-4-how-to-advance-age-all-civilization-landmarks/); [ISK Mogul: landmarks](https://www.iskmogul.com/how-landmarks-in-age-of-empires-iv-work/)
- AoE4 landmarks also act as the conquest win condition (destroy all enemy landmarks). — [RealSport101: AoE4 win conditions](https://realsport101.com/article/age-of-empires-4-skirmish-mode-how-to-win-wonder-landmarks-sacred-sites-win-conditions)
- Buildings gain hit points by age in AoE2 (+10/+20/+30/+40% in Dark/Feudal/Castle/Imperial per one source). — [AoE wiki: Hit points](https://ageofempires.fandom.com/wiki/Hit_points)

### Inferences
- Ageing is a timed, interruptible investment: the player stops making some units to bank food, and the opponent tries to punish the window. Being first to an age gives a short window of unanswerable units (e.g. Castle Age knights against Feudal defences).
- AoE4 landmarks make each age choice a strategic fork (two options with different bonuses), not just a gate.

### Gaps
- Per-age unlock lists were not retrieved in full. From general knowledge (unverified here): AoE2 Feudal unlocks archery range, stable, blacksmith, market, towers; Castle unlocks castles, monasteries, siege workshop, universities, unique units; Imperial unlocks trebuchet-era upgrades and the last eco/blacksmith tiers. AoE4 follows a similar pattern (siege and keeps in Castle).

## Combat math: HP, attack, armour, bonus damage, minimum damage, reload, range, accuracy, LOS, counters, upgrades, veterancy

### Takeaway
Both games use flat subtraction: damage = attack (plus class bonuses) minus the matching armour (melee or pierce/ranged), floored at 1. Counters come mostly from big class bonuses (pikeman +22 vs cavalry) and from armour (skirmishers shrug off arrows). AoE4 adds percentage resistances for siege. There is no morale and no veterancy in standard AoE2/AoE4 play.

### Cited Findings
- AoE2: armour of the matching type is subtracted per attack component, only positive remainders count, and the minimum damage is 1. A Zhuge Nu against a 50-pierce-armour house still does 1 per shot. — [AoE wiki: Attack](https://ageofempires.fandom.com/wiki/Attack); [AoE forum: negative attack calculations](https://forums.ageofempires.com/t/question-negative-attack-calculations/221766)
- AoE4 formula: Damage = max(1, (base + upgrades) x base multiplier + (bonus + upgrades) x bonus multiplier - armour). Armour is applied last and is an integer; melee armour vs melee, ranged armour vs ranged, fire armour vs fire. Siege units have percentage resistances applied before armour (example: 10 archer damage against a mangonel with 85% ranged resistance gives about 1.5). — [AoE wiki: Armor (AoE4)](https://ageofempires.fandom.com/wiki/Armor_(Age_of_Empires_IV)); [Steam guide: Hidden math of AoE4](https://steamcommunity.com/sharedfiles/filedetails/?id=3661824697); [AoE forum: armour equals or exceeds damage](https://forums.ageofempires.com/t/when-armor-equals-or-exceeds-dmg/223590)
- Counter bonuses (AoE2): pikeman +22 vs cavalry/knights, +18 vs camels, war elephant figure disputed (+25 vs +47); halberdier +32 vs cavalry per a forum post; elite skirmisher +4 vs archers, +2 vs cavalry archers, wins mostly through pierce armour (elite skirm 4 PA, range 5); camel rider +9 vs cavalry; camel archer +4 vs cavalry archers. — [AoE wiki: Pikeman (AoE2)](https://ageofempires.fandom.com/wiki/Pikeman_(Age_of_Empires_II)); [aoecoach: Pikeman](https://aoecoach.com/en/resources/units/pikeman); [Steam: blacksmiths discussion](https://steamcommunity.com/app/813780/discussions/0/3187986750494904954/); [aoecoach: Camel Archer](https://aoecoach.com/en/resources/units/camel-archer/)
- Armour classes in AoE2 are the hook for bonus damage (each unit belongs to classes like Cavalry, Archer, Building; bonuses target classes). — [AoE wiki: Armor class (AoE2)](https://ageofempires.fandom.com/wiki/Armor_class_(Age_of_Empires_II))
- Blacksmith (AoE2): Forging, Iron Casting, Blast Furnace add attack to infantry and cavalry (Blast Furnace +2, Imperial); Scale/Chain/Plate Mail for infantry (Plate +1 melee, +2 pierce armour); Scale/Chain/Plate Barding for cavalry; Padded/Leather/Ring Archer Armor for archers. — [aoe2.guide: The Blacksmith](https://aoe2.guide/the-blacksmith/); [Age of Notes: blacksmith upgrades](https://ageofnotes.com/beginners/age-of-empires-2-blacksmith-upgrades-explained/)
- Rate of fire (reload) is a per-unit stat in seconds between attacks. — [AoE wiki: Rate of Fire](https://ageofempires.fandom.com/wiki/Rate_of_Fire)
- Range examples: trebuchet range 16, minimum range 4 (17 with Siege Engineers). — [Liquipedia: Trebuchet](https://liquipedia.net/ageofempires/Trebuchet); [AoE wiki: Range](https://ageofempires.fandom.com/wiki/Range)
- AoE4 rams: very high HP, near-immune to ranged, 0 melee armour, attack only buildings, +300 vs walls, take +20% from melee; countered by melee units and villagers. — [AoE wiki: Battering Ram (AoE4)](https://ageofempires.fandom.com/wiki/Battering_Ram_(Age_of_Empires_IV)); [Steam guide: AOE4 Comprehensive Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3757716456)
- AoE4 springald: anti-infantry siege firing pass-through bolts (reworked in update 12.0.1974); infantry can build springalds and mangonels in the field. — [AoE wiki: Springald](https://ageofempires.fandom.com/wiki/Springald); [Steam guide: AOE4 Comprehensive Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3757716456)

### Inferences
- Because damage is subtract-then-floor-at-1, one point of armour matters a lot for small-attack units (archers at 4-6 attack), which is why blacksmith armour upgrades swing archer fights hard, and why many weak shots (Zhuge Nu) still scratch armoured targets.
- The counter triangle is mostly encoded as class bonuses plus armour, not as a rock-paper-scissors multiplier: spear/pike beats cavalry (bonus), archer beats spear (range plus low pierce armour on spears), skirmisher beats archer (pierce armour plus small bonus), cavalry beats archer and skirmisher (speed and melee), camels/elephants as cavalry counters, monks and mangonels vs massed units.

### Gaps
- AoE2 accuracy: archers have a per-unit accuracy (e.g. Archer 80%, from memory) and missed arrows can hit other units; Ballistics makes arrows lead moving targets; Thumb Ring raises accuracy to 100%. Not retrieved from a source.
- AoE2 elevation bonus (+25% damage downhill, -25% uphill, from memory) and the line-of-sight values per unit: unverified.
- Veterancy: none in standard AoE2/AoE4 multiplayer to my knowledge; I found no source saying so either way. AoE3 has no veterancy either but has unit "Shipments"; not researched.

## Unit control: formations, stances, attack-move, patrol, garrison, auto-targeting, pathing, speed

### Takeaway
AoE2 gives four formations and four stances; individual units then pick their own targets. Units on Aggressive chase what they see; Stand Ground holds position and shoots in range; No Attack never engages unprompted.

### Cited Findings
- Stances (AoE2): Aggressive (default; chase any target in sight until it dies), Defensive (fight and chase a limited distance, then return; players report DE defensive units chase longer, behaviour disputed), Stand Ground (do not move, attack anything in range), No Attack (never auto-attack). — [AoE wiki: Unit stance](https://ageofempires.fandom.com/wiki/Unit_stance); [Steam: aggressive and defensive stances](https://steamcommunity.com/app/813780/discussions/0/2441462402302394257/)
- Formations (AoE2): Line (dense, standard), Box (strong units outside, weak inside), Staggered (spread, vs area damage and scorpions), Flank (army splits into two halves, used to dodge mangonel shots). Formations do not hold once melee starts; individual unit AI takes over. — [AoE wiki: Battle Formations](https://ageofempires.fandom.com/wiki/Battle_Formations); [Steam: let's talk about box formation](https://steamcommunity.com/app/813780/discussions/0/4029096129886148383/); [Steam: attacking while holding formation](https://steamcommunity.com/app/813780/discussions/0/4295943285926930402/)
- Garrison (AoE2): a Town Center takes up to 15 villagers, foot archers, infantry or monks (25 for Teutons); garrisoned units add arrows (aoecoach: 5 base arrows, +1 per extra garrisoned unit up to 15; one older thread claims 10 max). Castle holds 20. — [AoE wiki: Garrison](https://ageofempires.fandom.com/wiki/Garrison); [aoecoach: Town Center](https://aoecoach.com/en/resources/buildings/town-center); [Liquipedia: Castle](https://liquipedia.net/ageofempires/Castle)
- Console control groups and orders work through radial menus (hold RT for the command menu; LB radial to set groups). — [ageofempires.com: Match goals and advanced controls (Xbox)](https://www.ageofempires.com/learn-to-play/match-goals-advanced-controls-xbox/)

### Inferences
- AoE leans on per-unit auto-targeting plus stance rather than group tactics: the player's tools are positioning, focus fire, stance and formation spread against area damage.

### Gaps
- Attack-move and patrol: both exist in AoE2 DE and AoE4 (attack-move was added to AoE2 in DE; patrol exists in both), from memory; no source retrieved.
- Retargeting rules (AoE2 units retaliate against attackers in range, prefer the nearest threat; AoE4 has stronger auto-acquire and unit collision with soft separation): unverified.
- AoE4 formations: AoE4 groups move at the slowest unit's speed in a default formation and has spread/tight formation buttons (from memory). Unverified.
- Unit speeds (e.g. AoE2 villager 0.8 tiles/s, knight 1.35): unverified.

## Siege and buildings: walls, gates, building HP and armour, garrison arrows, castles and keeps, siege, monks, relics, healing

### Takeaway
Buildings are hard to kill without siege: castles (4,800 HP, 650 stone in AoE2) and keeps shoot arrows that scale with garrison, rams and trebuchets are the answer, and monks convert by a timed random roll. AoE4 makes rams pure building-killers that infantry can build on the spot.

### Cited Findings
- AoE2 Castle: 4,800 HP, 650 stone, garrison 20, range up to 8 base (higher with upgrades). — [Liquipedia: Castle](https://liquipedia.net/ageofempires/Castle); [AoE wiki: Range](https://ageofempires.fandom.com/wiki/Range)
- AoE2 Town Center 2,400 HP (Persians double). — [aoecoach: Town Center](https://aoecoach.com/en/resources/buildings/town-center)
- Monk conversion (AoE2, current wiki model): attempts every ~1.25 s; from the 5th attempt a 38% chance per attempt; guaranteed by the 9th. Buildings: from the 15th attempt, 13% per attempt, guaranteed at the 25th. Older measurements: 5-12 s for a unit, 18-29 s for a building. — [AoE wiki: Conversion](https://ageofempires.fandom.com/wiki/Conversion); [AoE Zone: How monks really work](https://aoezone.net/threads/how-monks-really-work-v-2-all-the-details.119879/)
- Relic: 0.5 gold/s in a Monastery. — [AoE wiki: Relic (AoE2)](https://ageofempires.fandom.com/wiki/Relic_(Age_of_Empires_II))
- AoE4: outposts, keeps and TCs fire garrison arrows; Arrowslits add a permanent attack and raise garrison arrow range from 6 to 7 tiles; emplacements (arrowslits, springald, cannon) give attacks independent of garrison. — [AoE wiki: Arrowslits (AoE4)](https://ageofempires.fandom.com/wiki/Arrowslits_(Age_of_Empires_IV)); [AoE wiki: Outpost (AoE4)](https://ageofempires.fandom.com/wiki/Outpost_(Age_of_Empires_IV)); [AoE wiki: Springald Emplacement](https://ageofempires.fandom.com/wiki/Springald_Emplacement)
- AoE4 rams: attack only buildings, +300 vs walls. — [AoE wiki: Battering Ram (AoE4)](https://ageofempires.fandom.com/wiki/Battering_Ram_(Age_of_Empires_IV))

### Inferences
- Defences multiply defender value per resource (a garrisoned TC turns villagers into an archer battery), which is the reason early raids target villagers in the open, not buildings.

### Gaps
- Building armour values (AoE2 buildings have high pierce armour and take bonus from siege/infantry), wall HP and gate behaviour (gates open for own units, lockable): from memory, unsourced.
- Healing: AoE2 monks heal at a slow rate; garrisoned units in buildings heal; AoE4 monks heal and have a healing aura; unsourced.
- AoE4 AoE monks/relic numbers and AoE4 conversion (only some civs can convert, Imperial-era tech): unsourced.

## Morale and how battles end

### Takeaway
No morale or routing in AoE2 or AoE4: units fight until killed or until the player pulls them back. A battle ends when one side is dead or retreats on the player's order.

### Cited Findings
- In Age of Empires soldiers fight until killed and retreat only on player orders; they never surrender. — [ACOUP: Total Generalship IIIc (comment discussion)](https://acoup.blog/2022/07/01/collections-total-generalship-commanding-pre-modern-armies-part-iiic-morale-and-cohesion/comment-page-1/)
- A morale system (units fleeing to the TC when morale drops) is only a fan proposal on the official forum, not a shipped feature. — [AoE forum: Morale System](https://forums.ageofempires.com/t/morale-system/215105)
- No source found that AoE4 has routing; Total War-style routing (units break from casualties, fatigue, odds) is a different design. — [Total War manual: Morale](https://r2enc.totalwar.com/en/manual/single-player/0087_enc_page_battle_play_phase_conflict_morale/)

### Inferences
- AoE's "soft" substitutes for morale are economic: players retreat damaged units to save their cost, and fights end early because one army is out-countered, not because units panic. This fits the user's "no forced loss of control" rule.

### Gaps
- AoE3 and AoM also have no routing, to my knowledge (not researched).

## Victory conditions, game length, how a battle plays out

### Takeaway
AoE4 wins by destroying all landmarks, holding all sacred sites 10 minutes, or defending a Wonder; AoE2 standard is conquest (plus relic and wonder victories in the standard setting). Ranked 1v1 games last roughly 15-30 minutes.

### Cited Findings
- AoE4 victories: destroy all enemy Landmarks; capture all Sacred Sites with monks and hold them 10 minutes; build a Wonder (Imperial, 3,000 of each resource) and defend it (sources say 15 or 10 minutes). — [RealSport101: AoE4 skirmish win conditions](https://realsport101.com/article/age-of-empires-4-skirmish-mode-how-to-win-wonder-landmarks-sacred-sites-win-conditions); [GameRant: capture sacred sites](https://gamerant.com/age-of-empires-4-capture-sacred-sites-how/); [AoE wiki: Wonder (AoE4)](https://ageofempires.fandom.com/wiki/Wonder_(Age_of_Empires_IV)); [Centurion Report: Wonder victory](https://thecenturionreport.com/get-wonder-victory-age-of-empires-4/)
- AoE4 match length: community figures of about 22.7 minutes average in one patch, about 30 minutes at the lowest levels, 15 minutes typical 1v1 guesses; against a good AI 45-90 minutes. — [AoE forum: standardize games to 30 minutes](https://forums.ageofempires.com/t/standardize-games-to-30-minutes/218364?page=2); [Steam: average game length](https://steamcommunity.com/app/1466860/discussions/0/4357790501742499114/); [Gaming Nexus: AoE4 review](https://www.gamingnexus.com/Article/7470/Age-of-Empires-IV/)

### Inferences
- A typical army clash is short: armies of 20-40 units trade in well under a minute; the game is decided by repeated clashes plus economic damage, not one battle.

### Gaps
- AoE2 victory settings detail (conquest, relic victory: hold all relics for a timer; wonder victory: stand a wonder for a timer, ~200 years game time) and AoE2 average ranked length: unsourced.
- Per-fight duration figures: no source; inference only.

## Mobile and console versions: how controls are simplified

### Takeaway
AoE2 DE on Xbox keeps the full RTS but moves commands into radial menus with control groups on a radial and quick-select on the D-pad. Age of Empires Mobile is a different genre: a timer-based city builder whose battles are mostly automatic, led by hero commanders with skills.

### Cited Findings
- Xbox AoE2 DE: hold RT for a context radial command menu (options change for villagers, military or buildings); hold LB for a radial of control groups; D-pad quick-select, D-pad Up selects an idle villager; mouse and keyboard also supported. — [ageofempires.com: Controlling your empire (Xbox)](https://www.ageofempires.com/learn-to-play/controlling-your-empire-gathering-resources-xbox/); [ageofempires.com: Match goals and advanced controls (Xbox)](https://www.ageofempires.com/learn-to-play/match-goals-advanced-controls-xbox/)
- The radial menu went through many focus-group iterations; reviewers called the gamepad controls surprisingly good. A "simple" and "advanced" control mode exist (advanced gives 2 pages of quick-find). — [Windows Central: first look on console](https://www.windowscentral.com/gaming/xbox/heres-a-first-look-at-age-of-empires-2-on-console); [MobileSyrup: Xbox hands-on](https://mobilesyrup.com/2023/01/30/age-of-empires-ii-xbox-edition-hands-on-great-gamepad-controls/); [AoE forum: radial menu bug report](https://forums.ageofempires.com/t/xbox-radial-menu-becomes-inaccessible-cannot-select-anything-from-it/267963)
- Age of Empires Mobile: heroes lead troops; four unit types in a rock-paper-scissors loop where level can override a bad matchup; auto-battle runs repeated attacks until stamina runs out; commander skills fire automatically in open-field fights; PC edition maps troop skills to Q-T keys and Support/Battle orders to Z/X. Critics call combat low-strategy and gacha-driven. — [Theria Games: auto battler guide](https://theriagames.com/guide/age-of-empires-mobile-auto-battler-guide/); [But Why Tho: AoE Mobile review](https://butwhytho.net/2024/10/age-of-empires-mobile-tacks-light-combat-onto-click-and-wait-gameplay/); [Magic Game World: PC controls](https://www.magicgameworld.com/age-of-empires-mobile-pc-edition-controls-guide/); [MassivelyOP: Fight or Kite](https://massivelyop.com/2024/11/14/fight-or-kite-age-of-empires-mobile-is-a-gacha-encrusted-overmonetized-monstrosity/)

### Inferences
- The two simplification routes are (a) keep the sim, compress input into context radials and group selection (Xbox), or (b) replace unit micro with army-level orders plus auto-firing hero skills (Mobile). Terra Imperium's phone battles sit closer to (a) with squad-level orders.

### Gaps
- AoE4 console (Xbox/PS5) controller scheme details were not researched.

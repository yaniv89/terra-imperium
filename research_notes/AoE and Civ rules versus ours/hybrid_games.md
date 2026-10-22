# Hybrid strategy games: linking an empire layer to tactical battles

Scope: games that pair a world/campaign layer with battles (real-time or tactical), and what they teach Terra Imperium (Civ-like globe + AoE-like real-time battles). Researched 2026-10-22. Most player sentiment comes from Steam/forum threads and is marked as player opinion. Many sources date from launch years (2003-2024) and may predate later patches.

## Rise of Nations: borders, attrition, territory, ages, Conquer the World, commerce cap

### Takeaway
Rise of Nations imported turn-based ideas (territory, attrition, a capped economy) into a real-time game: borders come from cities and forts, enemies bleed inside your borders unless they bring supply wagons or a general, and a commerce cap keeps economies from runaway growth. Its Conquer the World campaign is a Risk-like turn-based map where each attack is one real-time battle, praised as a highlight but long (a 12-18 hour campaign).

### Cited Findings
- Cities and forts radiate a sphere of influence that defines your territory; you can only build inside it, and tax income scales with the share of territory held. — [Hardcore Gaming 101](https://www.hardcoregaming101.net/rise-of-nations/); [Wikipedia](https://en.wikipedia.org/wiki/Rise_of_Nations)
- Borders grow with new cities, fortresses and research (the Social / civic line); some nations have stronger borders. Borders were credited to Alpha Centauri's idea. — [Giant Bomb wiki](https://giantbomb.com/wiki/Games/Rise_of_Nations); [Steam discussion (player)](https://steamcommunity.com/app/287450/discussions/3/1471967615857878423)
- Attrition: enemy units (and structures built in your land) take damage over time inside your territory unless supplied; it is upgradable. Keeping Generals and Supply Wagons near an army removes attrition, which makes those units prime targets. — [GameSpot review](https://gamespot.com/reviews/rise-of-nations-review/1900-6028705/); [Hardcore Gaming 101](https://www.hardcoregaming101.net/rise-of-nations/)
- Reviewers credit attrition with giving turtling and booming players a real defense against rushes. — [Hardcore Gaming 101](https://www.hardcoregaming101.net/rise-of-nations/)
- Commerce limit: an artificial cap on the gathering rate of every resource except knowledge; raised by Commerce research at the library, nation bonuses, rare resources and wonders; hard ceiling 999 (Global Prosperity in the last age). — [Giant Bomb](https://www.giantbomb.com/games/3030-11993/)
- Eight ages: Ancient, Classical, Medieval, Gunpowder, Enlightenment, Industrial, Modern, Information. Advancing requires research in the four library lines; the age-up itself gives few bonuses, the main change is new resources and age-gated military and tech. — [Giant Bomb](https://www.giantbomb.com/games/3030-11993/)
- Conquer the World: a board-game-like world map divided between nations; each turn a nation may do any number of things (declare war, reinforce); territories pay tribute gold each turn and may hold rare resources, bonus cards or supply centers (which raise how many armies you command); each attack is a separate real-time battle. — [GamesFirst review](https://gamesfirst.com/articles/2002/rise-of-nations-review); [Gaming Nexus (T&P)](https://www.gamingnexus.com/Article/497/Rise-of-Nations--Thrones-and-Patriots)
- Campaign battles reportedly last up to 90 minutes (another source says 120); BHG estimated 12-18 hours for the campaign; The Globe and Mail's review listed that even a "short" game eats a lot of time as a drawback. — [Globe and Mail](https://www.theglobeandmail.com/technology/rise-of-nations-thrones-patriots-expansion/article1136824); [CivFanatics thread](https://forums.civfanatics.com/threads/world-conquest-campaign-ron.616107)
- Reported (player memory, not verified): available tech in a campaign battle was tied to the number of global turns played (turn 1 = ancient units only); declaring war cost a move and gold; the campaign ran 30 moves, then scored. — [CivFanatics (player)](https://forums.civfanatics.com/threads/world-conquest-campaign-ron.616107); [Neowin user review](https://www.neowin.net/forum/topic/183597-rise-of-nations/)
- Thrones and Patriots added scenario campaigns (Alexander, Napoleon, New World, Cold War with nukes placed on the strategic map). — [Gaming Nexus](https://www.gamingnexus.com/Article/497/Rise-of-Nations--Thrones-and-Patriots)

### Inferences
- RoN's attrition rule maps cleanly onto our supply meter and fog: damage outside own borders unless a supply source is near is easy to read and gives defenders a natural edge without forcing retreats.
- The commerce cap is a direct anti-snowball tool: income rises with age rather than with unlimited worker spam. Worth comparing with our battle economy (setup.economy) and with macro income.
- Tying battle tech to campaign progress (turn count in RoN) parallels our age-by-tech rule; RoN's choice of turn count is the world-age approach we rejected.
- The 90-minute battle per campaign attack is the main cost; a campaign that needs many battles must keep each short.

### Gaps
- No primary source (manual, BHG postmortem, Brian Reynolds interview) found for exact attrition damage numbers or Conquer the World combat rules; the 30-move limit is anecdotal.

## Total War (Rome II, Warhammer III, Three Kingdoms, Pharaoh Dynasties): campaign armies vs real-time battles

### Takeaway
Total War's linked layers work, but the recurring complaints are (1) auto-resolve that disagrees with the real battle in both directions, (2) late-game fatigue where players auto-resolve everything once wins are one-sided, and (3) sieges that feel samey. CA's counters include army caps tied to generals, siege battles only at province capitals, and a siege rework that gives defenders supplies for barricades and towers.

### Cited Findings
- Rome II: each army holds at most 20 units and needs a general (admiral for fleets); a faction-wide cap on armies scales with faction power (regions and gold); regional recruitment slots (about 3 plus modifiers) are per region, not per army. — [Total War Wiki](https://totalwar.fandom.com/wiki/Total_War:_Rome_II); [Steam discussion](https://steamcommunity.com/app/214950/discussions/0/616189742656420680/?l=polish)
- Rome II: only the province capital gives a siege battle; minor settlements do not, explicitly "to avoid the game becoming bogged down in too many sieges"; CA promised 30+ city variants so sieges would not repeat. — [Gameranx](https://gameranx.com/updates/id/15015/article/total-war-rome-2-provinces-armies-and-generals-details-revealed/)
- Player opinion: artificial unit-type caps without in-world reasons break immersion. — [TWCenter](https://www.twcenter.net/threads/confirming-some-basic-features-for-rome-2.819046/)
- Auto-resolve accuracy (player reports): preview said lose 4 units and win, result was a wiped army; auto-resolve often gives much higher casualties than manual play; a manual fight can be lost then won by reloading and auto-resolving. — [Steam WH3](https://steamcommunity.com/app/1142710/discussions/2/591759013796937462); [Steam WH2](https://steamcommunity.com/app/594570/discussions/0/1480982971175660014)
- Auto-resolve bias (player opinion): it compares numbers, so micro-dependent armies (Skaven) under-perform; the power bar overweights cheap skirmishers, and the AI builds armies from the same bar. — [Steam WH2](https://steamcommunity.com/app/594570/discussions/0/2522527267222150889); [Steam WH2](https://steamcommunity.com/app/594570/discussions/0/1480982971175660014)
- CA listed auto-resolve among the big fixes for Warhammer III patch 1.2. — [Bell of Lost Souls](https://www.belloflostsouls.net/?p=431199)
- Late-game fatigue (player opinion): at turn 150, turns were spent building and every battle auto-resolved because they were one-sided; one player had not fought manually in about 60 turns. A reviewer: you can auto-resolve everything but then miss the battles that are the point. — [Steam WH3](https://steamcommunity.com/app/1142710/discussions/0/4416424806096713060); [Giant Bomb user review](https://giantbomb.com/user-reviews/id/19925/the-games-kind-of-big)
- Player house rules: auto-resolve only clear wins (about 4:1), clear losses or garrison fights; a popular mod disables auto-resolve except for trivial battles. — [Steam WH2](https://steamcommunity.com/app/594570/discussions/0/4763089742396284829)
- Sieges: critics called old sieges the series' weakest part; ladders that appeared from nowhere made walls pointless and every siege "the same fight". The WH3 rework made attackers build crewed ladders and gave defenders a Supplies resource (earned by holding points) to spend on barricades, traps and towers; layouts were paced to avoid repeats between neighbouring regions. — [Destructoid](https://www.destructoid.com/total-war-warhammer-3s-siege-rework-is-a-big-step-towards-perfection/); [GameWatcher](https://www.gamewatcher.com/total-war-warhammer-3-siege-rework); [Total War blog](https://www.totalwar.com/?p=15524)
- Later complaint (player, unverified): a patch removed most minor-settlement sieges and weakened remaining defenses. — [Steam WH3](https://steamcommunity.com/app/1142710/discussions/0/4027968871053655075)
- Three Kingdoms: supply reserves come from empire food; an army in enemy land draws its stock down each turn; low supplies cause attrition that damages units and lowers morale if a battle starts. A 2020 patch cut supply's link to reinforcement so it mainly affects combat strength. Player opinion: supply rarely bites if you stay near borders with positive food. — [Total War Wiki](https://totalwar.fandom.com/wiki/Army_(Total_War:_Three_Kingdoms)); [Steam changelog](https://steamcommunity.com/sharedfiles/filedetails/changelog/2040889491?p=1); [Steam 3K](https://steamcommunity.com/app/779340/discussions/0/3801651941328104892)
- Pharaoh: battles deliberately slow early (armor must break before a side wins), giving time to react to weather such as heat fatigue and mud. Dynasties players tune length with the Lethality setting. — [Windows Central preview](https://www.windowscentral.com/gaming/pc-gaming/total-war-pharaoh-preview-clashing-swords-and-courting-disaster); [Steam Dynasties](https://steamcommunity.com/app/2951630/discussions/0/4521135313699328167)

### Inferences
- An honest auto-resolve (our autoBattle.js calibrated with parityEco) is worth the effort: the strongest TW complaint is predictions that do not match. Showing a forecast and then a different result is worse than no forecast.
- Fewer, bigger battles beat many small ones: limit full siege battles to cities that matter (Rome II rule), and resolve trivial fights without asking.
- Supply that only weakens (Three Kingdoms after 2020) fits our "no forced loss of control" rule better than supply that kills units outright.
- Siege fun needs defender tools and attacker work (ladders, rams), not just walls with HP.

### Gaps
- No CA developer statement on average battle length or what share of battles players fight manually. Morale and routing details not researched here (covered by our own rule: routing disliked).

## Humankind, Old World, Millennia, Ara, Paradox: battle layers, armies, orders, stacking

### Takeaway
The 4X games that tried a tactical layer got mixed results: Humankind's on-map tactical battles were criticised for poor onboarding, reinforcement timing and random deployment terrain; Millennia and Ara chose watch-only battles and players found them passive or opaque. Old World's Orders system is the most praised idea: a shared per-turn action budget that makes military and economy compete and fixes late-game unit tedium.

### Cited Findings
- Old World Orders: moving units and using workers costs Orders from one pool, so each turn trades guns against butter; roads cut the Order cost of moves; most units get three moves a turn (fatigue), with a one-off 100 Training "Force March" letting units go further at double Orders. The designer argues every-unit-moves gives "only the illusion of decisions" as unit counts grow; MP tests found winners protected their economy rather than spending most Orders on war. — [Soren Johnson, Designer Notes #1](https://www.designer-notes.com/old-world-designer-notes-1-orders/)
- Old World: one unit per tile is a mechanical choice, to be read together with Orders and limited city sites as one system; units can move several tiles per click and pass through friendly units. Player opinion: some praise tactical depth, others complain of a "carpet of doom". — [Designer Notes #3](https://www.designer-notes.com/?p=1696); [CivFanatics](https://forums.civfanatics.com/threads/soren-johnson-on-1upt-in-old-world.672317)
- Humankind: battles run as several rounds inside one turn (avoiding Civ VI's multi-turn sieges); all adjacent armies deploy, so army caps mattered little. Player complaints: reinforcements were poorly explained and tech-locked; attacker-first timing let defenders' help arrive too late (MP players banned round-1 reinforcement blocking); the deployment map could drop you on bad terrain; battles usually end in total destruction of one army, feeding snowballing. — [Amplitude closed beta summary](https://community.amplitude-studios.com/amplitude-studios/humankind/forums/212-closed-beta/threads/41305-summary-of-closed-beta-criticisms-from-steam-reviews?page=1); [CivFanatics](https://forums.civfanatics.com/threads/combat-in-humankind-vs-civ-v-vi.673391/); [Amplitude forum](https://community.amplitude-studios.com/amplitude-studios/humankind/forums/169-humankind/threads/47823-unit-slots-what-s-the-point)
- Amplitude responded by clarifying how walls work in sieges and adding clearer damage predictions emphasising strength difference. — [Amplitude OpenDev](https://community.amplitude-studios.com/amplitudestudios/humankind/blogs/742-opendev-feedback-and-plans?page=12)
- Millennia (C Prompt Games, Paradox): by design you choose who fights where and when but give no orders during combat; a window over the map lets you watch or quickly resolve. Wikipedia's critic summary notes "the lack of a proper combat system"; players called combat passive and opaque (losing modern armies to pikemen, late multiplicative bonuses either useless or overpowered). — [Paradox dev diary](https://www.paradoxinteractive.com/games/millennia/news/combat); [Wikipedia](https://en.wikipedia.org/wiki/Millennia_(video_game)); [Steam](https://steamcommunity.com/app/1268590/discussions/0/4369129313607123548)
- Ara: History Untold: no fight button; armies at war in the same region fight, and next turn you get a report and a real-time cinematic. Units are trained then drafted into formations (early on single-unit squads, up to 3 armies); counters and formations matter. PC Gamer: "more of a picture book than a deep strategy tome". Players complain the troop cap is opaque and see "stacks of doom". — [PC Gamer](https://pcgamer.com/games/strategy/ara-history-untold-review); [GGRecon](https://ggrecon.com/reviews/ara-history-untold-review); [Prima Games](https://primagames.com/gaming/military-and-combat-in-ara-history-untold-mustering-limits-war-and-more); [CivFanatics](https://forums.civfanatics.com/threads/ara-history-untold.677325/page-8)

### Inferences
- A shared action budget (Old World) is a proven fix for "too many units to move each turn" on phones; our Idle chip and march automation address the same pain.
- Watch-only battles get punished by players when the result is opaque; if Auto is used, the receipt (our battleReceipt.js and ledger) must explain why.
- Humankind shows that reinforcement rules must be explicit and visible before the fight.

### Gaps
- Imperator: Rome and Europa Universalis (Paradox) combat (combat width, dice, attrition) not researched in this pass. Millennia stacking numbers not found.

## AoE III Home City, Cossacks, Empire Earth: ages over long timelines in an RTS

### Takeaway
Empire Earth proves a 14-15 epoch RTS from prehistory to space is possible; AoE III's Home City deck shows a meta layer feeding battles (cards shipped mid-match), and players argue the deck cap is either too tight or exactly the point.

### Cited Findings
- Empire Earth: 14 epochs from Prehistoric to Nano Age (Prehistoric, Stone, Copper, Bronze, Dark, Middle, Renaissance, Imperial, Industrial, Atomic WW1, Atomic WW2, Atomic Modern, Digital, Nano), spanning 500,000 years; Art of Conquest added the Space Age (15th). — [Wikipedia](https://en.wikipedia.org/wiki/Empire_Earth_(video_game)); [StrategyWiki](https://strategywiki.org/wiki/Empire_Earth/Epochs)
- AoE III Home City: a deck of cards shipped during a match (resource drops, one-use techs, troops). Deck cap 25 (10 per age) debated: some say it cramps certain civs, others say the cap forces a strategy and 40 cards would make decks pointless. Complaints: three separate cards to fully upgrade one unit; choosing shipments pulls attention away from the battle. Definitive Edition unlocked all cards by default. — [Age of Empires forums](https://forums.ageofempires.com/t/what-would-you-think-if-the-home-city-decks-capacity-to-contain-cards-increased-from-25-to-30/230466); [Gaming Nexus](https://gamingnexus.com/Article/943/Age-of-Empires-3); [Vaporlens summary](https://vaporlens.app/app/933110/age_of_empires_iii_definitive_edition)

### Inferences
- Our eight ages sit between RoN (8) and Empire Earth (14-15); RoN's view that the age-up itself matters less than what it unlocks is a useful benchmark.
- A Home City-style deck is one way to let the macro empire feed a battle (our battleInputs.js already does reinforcements and walls); keep choices few and outside the heat of the fight.

### Gaps
- Not found: Empire Earth roster change details per epoch, Cossacks rules, AoE Online campaign structure. No sources gathered for them in this pass.

## Mobile strategy games: simplified battles, controls, session length

### Takeaway
Mobile games cut battles down hard: AoE Mobile and Rise of Kingdoms largely auto-fight with hero-led fixed groups and march orders, and reviewers call this bland; Polytopia wins with small maps, simple rules and a 30-turn mode; Civ VI on iPhone works but small text and mis-taps are the main pain.

### Cited Findings
- Age of Empires Mobile: battles largely automatic, often decided by numbers and upgrade levels; each hero leads a fixed group of soldiers; reviewers found the lack of tactical input bland, while PocketGamer's preview said tap-and-drag controls work. The store page promises leading up to five troops freely. — [Gaming.net](https://www.gaming.net/reviews/age-of-empires-mobile-review-ios-android/); [Sportskeeda](https://www.sportskeeda.com/mobile-games/age-of-empires-mobile-review-a-mobile-adaptation-work-lot-heart-soul-final-trial); [PocketGamer](https://www.pocketgamer.com/age-of-empires-mobile/preview); [Digital Trends](https://digitaltrends.com/?p=3723459)
- Rise of Kingdoms: march queues (unlocked by City Hall level, up to 5), real-time battles on the world map with no loading screens, troops can be redirected at any time; infantry > cavalry > archers > infantry. — [ROK Guides](https://riseofkingdomsguides.com/rise-of-kingdoms-troop-capacity-and-march-queue-guide/); [BlueStacks guide](https://www.bluestacks.com/blog/game-guides/rise-of-kingdoms/rok-beginnners-guide-en.html)
- Polytopia: designed around simple mobile mechanics; Perfection mode is a 30-turn score game; generated small maps; praised for short bursts, criticised as lacking depth. — [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia); [CogConnected](https://cogconnected.com/review/battle-polytopia-review/)
- Civ VI iPhone: touch controls praised (sometimes better than PC), but small text and occasional wrong-tile taps are the main faults. — [Macworld](https://www.macworld.com/article/231955/civilization-vi-iphone-review.html); [Gamereactor](https://www.gamereactor.eu/?p=52243)

### Inferences
- For our phone layout: fixed groups per leader and march orders are the mobile-standard way to make real-time battles touchable, but full auto loses players; keep Command with few big controls and an honest Auto.
- A short, bounded game mode (Polytopia 30 turns) is the proven phone session shape.

### Gaps
- No primary data on session length for RoK or AoE Mobile. No reliable source on Civ VI mobile current state (reviews are 2018).

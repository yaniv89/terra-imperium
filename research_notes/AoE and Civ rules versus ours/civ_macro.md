# Civilization V, VI and VII: empire and city management (macro rules, no movement or combat)

Version tags: [V] = Civ V (incl. Brave New World), [VI] = Civ VI (incl. Rise and Fall / Gathering Storm), [VII] = Civ VII. Civ VII has changed a lot by patch: launch Feb 2025, 1.2.3 (Jul 2025), 1.2.4 (Aug 2025), 1.4.0 "Test of Time" (19 May 2026), 1.4.1 (23 Jun 2026). Version numbers are given where the source states them.

Source note: the Fandom Civilization wiki returned HTTP 402 to direct fetches. Wiki facts below come from search snippets of those pages, not full reads. Items marked "(memory, unverified)" are in Gaps, not Cited Findings.

## Cities: founding, growth, housing/amenities/happiness, tiles, borders, districts, towns vs cities, production, specialists

### Takeaway
Each game sets a different price on having more cities. [V] adds a flat unhappiness cost per city plus +5% tech cost per city. [VI] has no per-city penalty: housing and amenities cap each city's own growth. [VII] has a soft Settlement Cap with a Happiness penalty, and it splits settlements into hands-off Towns and fully managed Cities to cut late-game clicks.

### Cited Findings
- [V] Every city makes 3 Unhappiness plus 1 per Population. A conquered city loses half its population first. — [Carl's Civ 5 Guide: annex/puppet/raze](https://carlsguides.com/strategy/civilization5/war/annex-puppet-raze.php); [Carl's Civ 5 Guide: cities](https://www.carlsguides.com/strategy/civilization5/cities/)
- [V] Each city adds about 5% to tech costs, and puppets count too. Example: 15 cities = +75% on a 10,000-science tech. — search summary of [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/comments/164004533) and [CivFanatics](https://forums.civfanatics.com/threads/a-core-set-of-balance-changes.388179/page-12)
- [V] Forum players defend the flat per-city unhappiness as the mechanic that stops "infinite city spamming". — [CivFanatics: new strategy ignore happiness](https://forums.civfanatics.com/threads/new-strategy-ignore-happiness.382812/page-4)
- [VI] Housing slows growth near the cap. Population equal to housing, or 1 to 4 over it: growth -75%. 5 or more over: growth stops. The wiki snippet also says -50% at 1 under the cap. The snippet wording is muddled, so check the exact bands. — [Civ Wiki: Growth (Civ6)](https://civilization.fandom.com/wiki/Growth_(Civ6)); [Population (Civ6)](https://civilization.fandom.com/wiki/Population_(Civ6))
- [VI] Amenities: the first 2 citizens need none. From pop 3, every 2 citizens need 1 more amenity (pop 5-6 needs 3, pop 11-12 needs 6). — [Civ Wiki: Amenity (Civ6)](https://civilization.fandom.com/wiki/Amenity_(Civ6)); [PocketGamer](https://www.pocketgamer.com/sid-meiers-civilization-vi/amenities)
- [VI] Amenity surplus: +1 to +2 gives +10% growth, +3 or more gives +20%. Deficit: -1 to -2 gives -15% growth, -3 to -4 gives -30%. At -7 or worse the city revolts: non-food yields -60% and rebels appear. Gathering Storm changed some thresholds. — [Civ Wiki: Amenity (Civ6)](https://civilization.fandom.com/wiki/Amenity_(Civ6))
- [VII] You start with a Founder unit that founds the Capital. Every later Settler founds a Town, and Towns can be upgraded to Cities with Gold. Firaxis says this is because in past games "the sheer number of Cities and decisions could lead to a loss of focus and a lot of busywork". — [Firaxis Dev Diary 3: Managing Your Empire](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)
- [VII] Towns have no production menu: their Production turns into Gold automatically. A Town unlocks a Focus (Trade Outpost, Hub Town, Factory Town, Fort Town, and others) at a population threshold. At launch the Focus was permanent for the Age. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)
- [VII] Towns can only buy buildings, and a Civilopedia quote says only buildings that cannot slot specialists (user-posted, unverified). From 1.4.0, Towns can buy "a subset of Buildings, not just Tier 1", Town passives no longer scale with Age, and the later-Age growth curve was changed. — [Steam discussion](https://steamcommunity.com/app/1295660/discussions/2/598519418380641218); [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/)
- [VII] Settlement Cap: a soft limit on Cities plus Towns together. Each settlement over the cap lowers local Happiness in every settlement, and the hit grows with each extra settlement. Most guides put the starting cap at 3 and the penalty at -5 Happiness per settlement over (one forum says 4). Techs, civics (for example Irrigation, Entertainment, Organized Military) and leader attributes raise the cap. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/); [Outsider Gaming](https://outsidergaming.com/how-to-raise-settlement-cap-in-civilization-7/); [Wccftech](https://wccftech.com/how-to/how-to-raise-settlement-cap-in-civilization-7/amp/)
- [VII 1.4.0] The over-cap Happiness penalty no longer has a ceiling (it was capped at -35). — [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/)
- [VII] Converting a Town to a City, from game-file analysis: base 400 Gold, minimum 200, maximum 1000, cheaper per Population, +300 per City owned. A later patch reportedly scales it with game speed. Community-derived. — search summary of [CivFanatics: formula analysis](https://forums.civfanatics.com/threads/formula-analysis.695108/page-2) and [Deltia's Gaming](https://deltiasgaming.com/?p=138125)
- [VII] Urban and rural tiles: each Urban tile has two building slots for any building type. A district appears on its own when you place a building; nothing is pre-built. New urban tiles must touch the City Center or other urban tiles. There is no adjacency bonus for grouping similar buildings. Two of a civ's unique buildings on one tile make a Unique Quarter. Wonders take a whole tile. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)
- [VII] There are no Builders. Each time a settlement grows, you assign the new Population to a rural tile (improving it) or as a Specialist on an urban tile. Growth is a food "bucket" that gets bigger after each new Population. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)
- [VII] Specialists at launch: base Science and Culture, they amplify their tile's adjacency, and they cost Food and Happiness. 1.4.0: the base yield is gone. Specialists now give 100% of the tile's adjacency yields (was 50%) and cost 2/4/6 Food and Happiness by Age. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/); [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/)
- [VII] Happiness: local Happiness pays upkeep for specialists and buildings. Below zero, all other yields fall. Global Happiness builds up toward Celebrations. 1.4.0: each point of unhappiness is -5% yields (was -2%), capped at -80%, and food is not affected. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/); [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/)
- [VII 1.4.1] Settlement Happiness has five stages: Ecstatic 40+, Joyous 20-39, Happy 0-19 (these three scale per Age), Unhappy -1 to -19, Angry -20 or lower. Government effects read these stages. — [1.4.1 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-jun-23-patch-1-4-1/)
- [VII] Buildings go out of date between Ages. Ageless ones (warehouse buildings, unique buildings and improvements, wonders) keep everything. Other buildings keep only their base yields, lose adjacency, and can be built over. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)

### Inferences
- The series has moved from one global penalty per city [V], to local per-city caps [VI], to a soft count cap plus a cheap, low-attention town tier [VII]. For a game with many cities, [VII]'s "most settlements run themselves, a few are hand-managed" is the clearest answer to click load.
- Without builders, [VII] makes growth itself the improvement step. That removes a whole unit type to manage.

### Gaps
- Exact [V]/[VI]/[VII] minimum city distances. From memory, unverified: [V] and [VI] forbid founding within 3 tiles of another city's centre (at least 3 tiles between centres); [VII] uses a similar rule.
- [VI] growth food formula and border growth formula; [V] tile purchase cost formula; [VI] district count limit (memory: 1 specialty district per 3 pop, plus 1); buying tiles with gold in [V]/[VI] (exists, cost formula not sourced).
- Exact [VII] starting cap values per Age after 1.4.x were not found.
- [V]/[VI] buy-with-gold rates (memory: [VI] about 2x production cost in gold, unverified).

## Science and culture: trees, boosts, cost scaling, great people

### Takeaway
[V] makes every city raise tech costs (+5% each), which slows wide empires. [VI] dropped that and added Eurekas/Inspirations: a map task pays part of a tech's cost. [VII] keeps one tech and one civics tree per Age, reset at each transition, and folds great works and codices into Legacy goals.

### Cited Findings
- [V] +5% tech cost per city (see Cities). — [CivFanatics](https://forums.civfanatics.com/threads/a-core-set-of-balance-changes.388179/page-12)
- [VI] Dedications change boost size: Free Inquiry gives +10% more tech progress from Eurekas (golden age) and +1 Era Score per Eureka; Pen, Brush and Voice does the same for Inspirations. — [TheGamer era score guide](https://www.thegamer.com/civilization-6-complete-guide-to-era-score-golden-dark-heroic-age/); [Civilopedia: Dedications](https://www.civilopedia.net/en-US/gathering-storm/concepts/dedications/)
- [VII] Each Age has its own tech and civics trees, and progress resets at the transition. — [CivFanatics: Civ VII Ages](https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-ages/)
- [VII] The Antiquity Science Legacy goal is to collect and display 10 Codices in Libraries or Academies. — [Game8](https://game8.co/games/Civ-7/archives/498398); [Siliconera](https://www.siliconera.com/?p=1077218)

### Inferences
- A boost system ties research to play on the map ("meet a civ", "build a quarry"). It is the cheapest way to make the tech tree react to geography, which fits a real-Earth game.

### Gaps
- The base Eureka/Inspiration size could not be fetched (wiki 402). From memory, unverified: 50% at [VI] launch, cut to 40% in a 2017-2018 patch.
- [VI] tech cost has no per-city scaling (memory, unverified). [VII] great people rules were not researched in depth. [V]/[VI] great people point systems were not sourced.

## Government and policies

### Takeaway
[VI] uses policy-card slots by type (military, economic, diplomatic, wildcard). Swapping cards is cheap and frequent, and governments rarely change. [VII] 1.4.1 gave each government a passive, two Celebration options and two Traditions, and Celebrations are what open policy slots.

### Cited Findings
- [VI] Chiefdom has 2 slots. Tier 1 governments have 4, Tier 2 have 6, Tier 3 have 8, Tier 4 have 10. Some wonders add slots, which are lost with the wonder. — [Civ Wiki: Policy card (Civ6)](https://civilization.fandom.com/wiki/Policy_card_(Civ6)) (search snippet)
- [VI] Changing policies costs Gold, but it is free on the turn a civic completes or a slot is gained. A move to a new government is free. Going back to a government used before causes Anarchy: no Gold, Science, Culture or Faith, policies off, at least 3 turns. — [Civ Wiki: Government (Civ6)](https://civilization.fandom.com/wiki/Government_(Civ6)); [Anarchy (Civ6)](https://civilization.fandom.com/wiki/Anarchy_(Civ6)); [Steam thread](https://steamcommunity.com/app/289070/discussions/0/1489992080519479026/)
- [VII] Celebrations are triggered by global Happiness. They give buffs and slots for Traditions and Social Policies. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)
- [VII] Unlocked Traditions stay usable in policy slots across Ages. Obsolete policy cards are removed at the transition. — [CivFanatics: Ages](https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-ages/)
- [VII 1.4.1] Celebrations last 6 turns on Standard (was 10) and are harder to earn. Government passives include Classical Republic +1 Culture in Happy+ settlements (+4 more in Joyous+ Cities), Despotism +2 Science per conquered settlement (yields -3% per point of negative Happiness), Oligarchy +10% production toward buildings, Feudal Monarchy +10% toward units and walls, and Theocracy +20% Production and Gold toward temples and missionaries. — [1.4.1 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-jun-23-patch-1-4-1/)

### Inferences
- Card-based policies give a frequent, small decision ("swap a card when a civic finishes") instead of a rare, big one. The free swap when a civic completes sets the rhythm.

### Gaps
- [V] social policy trees (memory: culture buys policies, cost rises per city) were not sourced. [VI] legacy bonuses for long-held governments (Rise and Fall) were not sourced. No data was found on how often players change governments.

## Economy: gold, upkeep, trade, resources

### Takeaway
[VII] Towns are the gold engine (their production turns into gold), and gold buys buildings in Cities. Resources are slotted into settlements and count toward the Economic Legacy goal. I found few hard upkeep numbers.

### Cited Findings
- [VII] Town production converts to Gold, which is used to buy buildings for new Cities. A Factory Town adds a Resource Slot. A Trade Outpost adds Happiness on resource tiles and extends trade range. — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)
- [VII] The Antiquity Economic Legacy tiers are 7/14/20 resources assigned to settlements. The top tier keeps all cities as cities into Exploration. — [Siliconera](https://www.siliconera.com/?p=1077218); [Game8](https://game8.co/games/Civ-7/archives/498398)
- [VII] Resources change at the Age transition. — [CivFanatics: Ages](https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-ages/)

### Gaps
- Unit and building upkeep numbers for [V]/[VI]/[VII] were not sourced. Memory, unverified: [VI] building maintenance is 1 to 3 gold; [VI] Gathering Storm strategic resources stockpile with a cap and units cost resources to build and maintain; [V] strategic resources are a flat count, not a stockpile; [V]/[VI] luxuries give +4 Happiness [V] or +1 amenity to 4 cities [VI]; [VI] trader routes are capped by number of cities and markets/lighthouses.

## Diplomacy, city-states, independents, war weariness, AI and difficulty

### Takeaway
[VI] city-states run on envoys (3 envoys and a strict lead make you suzerain; bonuses at 1/3/6 envoys). [VII] replaced barbarians and city-states with Independent Powers that you befriend with Influence. Suzerainty is locked for the Age, and everything resets each Age. AI difficulty in both games is mostly flat yield bonuses.

### Cited Findings
- [VI] A civ with at least 3 envoys and the most envoys is Suzerain. A tie means no suzerain, and the title can change hands. Type bonuses come at 1, 3 and 6 envoys (Scientific: +2 Science in the capital at 1, +2 in every Campus at 3). — [Civ Wiki: Suzerain (Civ6)](https://civilization.fandom.com/wiki/Suzerain_(Civ6)); [Civilopedia](https://www.civilopedia.net/en-US/gathering-storm/concepts/citystates_5/)
- [VII] Befriending an Independent Power costs Influence (one guide: 85) and turns it into a City-State with you as Suzerain at 60 Befriend points. Guides disagree on how long that takes: 30 turns Standard, or at least 10 on Online. Suzerainty is locked for the rest of the Age. City-states reset each Age, and Independents spawn on turn 2 of each Age. Incorporating a city-state takes 10 turns on Standard. — [Game8](https://game8.co/games/Civ-7/archives/498559); [Civ Wiki: Suzerain (Civ7)](https://civilization.fandom.com/wiki/Suzerain_(Civ7)); [Siliconera](https://www.siliconera.com/how-to-handle-independent-powers-and-city-states-in-civilization-vii/)
- [VII 1.4.0] Each use of Improve Trade Relations costs +25% Influence. Befriend Independent costs +20% per active befriend action and per suzerained city-state. War weariness per settlement is 3/5/7 in Antiquity, 5/7/9 in Exploration, and 7/9/11 in Modern. — [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/)
- [VII 1.2.3] Relationships now drift back toward 0 over time instead of jumping at each Age transition. Alliances survive the transition under Continuity (1.2.4). — [1.2.3 notes](https://civilization.2k.com/civ-vii/game-update-notes/2025-jul-22-patch-1-2-3/); [1.2.4 notes](https://civilization.2k.com/civ-vii/game-update-notes/2025-aug-19-patch-1-2-4/)
- [VI] Deity AI gets extra starting units (Immortal and Deity: an extra Settler and two Builders) and about +40% Science, Culture and Faith. Bonuses stack by level. Forum production figures disagree (one says +80%). — [GameRant](https://gamerant.com/civilization-6-difficulty-levels-explained/); [TheGamer](https://www.thegamer.com/civilization-6-difficulty-levels-explained/); [CivFanatics](https://forums.civfanatics.com/threads/is-ai-bonus-too-small.650804/)
- [VII] The AI no longer starts with extra units or cities. It gets yield and combat bonuses instead (one preview claim: +8 combat strength on Deity). — [Steam thread](https://steamcommunity.com/app/1295660/discussions/0/591761765318038032)
- [VII 1.4.0] AI leaders got "various improvements" in pursuing victory, with no numbers given. — [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/)

### Inferences
- [VII] locks suzerainty for the Age, which removes the [VI] envoy tug-of-war (a click sink). Rising Influence costs per action limit spamming instead of a hard cap.

### Gaps
- [VI] grievances, casus belli values, war weariness numbers and [VI] agendas could not be fetched (wiki 402). Memory, unverified: [VI] Gathering Storm grievances decay each turn and a casus belli lowers them; [VI] leaders have one fixed agenda and one hidden random agenda. [V] warmonger penalties were not sourced. Peace deal rules were not sourced.

## Ages and eras

### Takeaway
[VI] (Rise and Fall) era score gives Dark, Normal, Golden or Heroic ages, with thresholds that move with your past ages and your city count. [VII] splits the game into three Ages (Antiquity, Exploration, Modern). Each Age ends in a crisis and a transition where you may change civ, spend Legacy points and lose most units and building bonuses. After heavy criticism, 1.2.3 to 1.4.x made transitions softer, added a keep-one-civ mode and replaced Legacy Paths with Triumphs.

### Cited Findings
- [VI] Community formula: the Normal threshold is about current score + 12 + cities at the start of the era. The Golden threshold is about 12 above that. Each earlier Golden age raises thresholds by 5, and each earlier Dark age lowers them by 5. Score above the Golden threshold is wasted. — [CivFanatics: era score thread](https://forums.civfanatics.com/threads/era-score-for-ages-question.628177/); [TheGamer](https://www.thegamer.com/civilization-6-complete-guide-to-era-score-golden-dark-heroic-age/)
- [VII] Three Ages, each playable alone in about 150-200 turns. Age progress builds every turn and faster from all players' actions (legacy milestones, eliminating a civ). A crisis starts at a progress threshold: narrative events open Crisis Policy slots that must hold negative crisis policies, and it ends in a scripted event (for example a big barbarian assault in Antiquity). Crises can be turned off at setup. — [CivFanatics: Ages](https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-ages/); [Siliconera](https://www.siliconera.com/how-do-ages-work-in-civilization-vii/)
- [VII] Four Legacy Paths (Science, Culture, Military, Economic), up to 3 milestones each. Milestones give Legacy points spent at the transition. Finishing a path gives a Golden Age option, and doing nothing on a path gives a Dark Age option. Antiquity goals: 10 Codices (Science), 2/4/7 Wonders (Culture), 7/14/20 Resources (Economic), and 6/9/12 Settlement points for Military (a conquered settlement counts 2). — [CivFanatics: Ages](https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-ages/); [Siliconera](https://www.siliconera.com/?p=1077218)
- [VII] At the transition you pick a new civ, unlocked by your earlier civ, your leader or your play (for example enough Horses unlocks the Mongols). The leader persists. Most buildings, units and progress do not carry over, but wonders and Ageless buildings do. Pantheons exist only in Antiquity, and religion starts in Exploration. — [CivFanatics: Ages](https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-ages/)
- [VII 1.2.3] New transition option "Continuity" (now the default; the old one is called "Regroup"). Units stay in place and upgrade, units inside others' borders are pushed out, and ships and siege can carry over. 1.2.4 keeps alliances and carries over more Gold and Influence under Continuity. — [1.2.3 notes](https://civilization.2k.com/civ-vii/game-update-notes/2025-jul-22-patch-1-2-3/); [1.2.4 notes](https://civilization.2k.com/civ-vii/game-update-notes/2025-aug-19-patch-1-2-4/)
- [VII 1.4.0 "Test of Time"] Optional single-civ play: at each transition you choose to stay or swap. "Time-Tested" civs get three extra civics, and Syncretism lets you borrow one unique unit or building per Age. Legacy Paths are replaced by Triumphs: 30 per Age in the default set, with Minor ones giving instant rewards and Major ones giving Dedications. You pick 3 Dedications at the transition (5 are always available), earned from Major Triumphs, leader levels and handling the last Crisis. Civ choice moved to the end of the Age. — [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/); [Nintendo Life](https://nintendolife.com/news/2026/05/civilization-viis-huge-free-test-of-time-update-turns-back-the-clock-later-this-month)
- [VII 1.4.1] The Revolutions crisis was removed from the Exploration Age. — [1.4.1 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-jun-23-patch-1-4-1/)

### Inferences
- [VII]'s 15-month walk-back (Continuity, then single-civ, then Triumphs) shows that players reject a forced civ change and a hard reset. Age structure without loss of identity was what they would accept.
- An age meter fed by all players means a fast player cannot end the Age alone. That is a natural anti-snowball pacing tool.

### Gaps
- Exact [VII] age progress numbers per action were not found. [VI] Heroic age rules (a Golden age right after a Dark age gives 3 dedications) are memory, unverified.

## Victory conditions and game length

### Takeaway
Standard speed in [V] and [VI] is 500 turns. [VII] Ages are about 150-200 turns each when played alone. 1.4.0 added "Dominance" wins that end the game early when a player leads second place by a big multiple, a direct answer to the late-game slog.

### Cited Findings
- [VI] Online 250 turns (200% speed), Quick 330, Standard 500, Epic 750 (66%), Marathon 1500 (33%). — [Civ Wiki: Speed (Civ6)](https://civilization.fandom.com/wiki/Speed_(Civ6)); [PCGamesN](https://www.pcgamesn.com/civilization-vi/civ-6-difficulties-speeds-map-types-options)
- [V] Standard ends at turn 500 (the TurnsPerIncrement rows add up to 500). — [CivFanatics](https://forums.civfanatics.com/threads/editing-number-of-max-turns.398860/)
- [VII] Victory types: Cultural, Economic, Military, Scientific, Score. — [CivFanatics: Ages](https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-ages/)
- [VII 1.4.0] Dominance victories need a lead over second place held for 5 turns. Transcendent 6x (50-80% of Exploration), Crushing 4x (80% Exploration to 20% Modern), Decisive 3x (20-40% Modern), Momentous 2x, Substantive 1.5x, Narrow 1.25x (80-100% Modern). Science victory: 100 points, then a Launch Pad active for 5 turns. If Modern reaches 100% with no winner, the highest score wins. — [1.4.0 notes](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/)

### Inferences
- A threshold that falls over time (6x early, 1.25x at the end) ends runaway games early without making close games shorter. It is cheap to copy as a rule.

### Gaps
- Turn counts for [VII] speeds beyond "150-200 per Age" were not sourced.

## Player complaints and design lessons

### Takeaway
Civ VII's launch reviews show that structural novelty (forced civ swap, age resets) plus weak UI gives "mostly negative" user scores even with good critic scores. Firaxis spent 2025-2026 making the new systems optional. The long-running series complaints are late-game busywork per city, snowballing and weak AI.

### Cited Findings
- [VII] Steam user reviews at launch were 39% positive of 1,400, later about 50% of about 8,000. Critics were far kinder. Peak concurrent players were about 43,000, against 49,000 for Civ VI on the same day. — [80.lv](https://80.lv/articles/less-than-half-of-civilization-vii-s-players-on-steam-are-happy-with-the-game/); [wnhub](https://wnhub.io/news/stores-and-publishing/item-47024); [Notebookcheck](https://www.notebookcheck.net/Civilization-VII-s-rough-launch-sparks-backlash-developers-pledge-improvements.958568.0.html)
- [VII] Main complaints: a confusing UI with poor map readability and missing hotkeys, the forced civ change at each age, and missing features (renaming, map variety, hotseat). Firaxis made UI improvements its top priority. — [Notebookcheck](https://www.notebookcheck.net/Civilization-VII-s-rough-launch-sparks-backlash-developers-pledge-improvements.958568.0.html); [itc.ua](https://itc.ua/en/news/alpha-stage-civilization-vii-received-devastating-criticism-from-early-players-with-only-43-positive-reviews)
- [VII] Firaxis's own reason for Towns: late-game city count leads to "a lot of busywork". — [Dev Diary 3](https://civilization.2k.com/civ-vii/news/dev-diary-3-managing-your-empire/)
- [VII] Responses: Continuity (1.2.3), Hotseat back and Happiness, Government and Celebration rework (1.4.1), single-civ option and Triumphs (1.4.0), and a 10-turn safe zone before an Age ends (1.2.3). — [1.2.3 notes](https://civilization.2k.com/civ-vii/game-update-notes/2025-jul-22-patch-1-2-3/); [1.4.0](https://civilization.2k.com/civ-vii/game-update-notes/2026-may-19-patch-1-4-0/); [1.4.1](https://civilization.2k.com/civ-vii/game-update-notes/2026-jun-23-patch-1-4-1/)

### Inferences
- Lessons for us: (1) give most cities a low-attention mode, like [VII] Towns; (2) limit expansion with a soft, visible cap rather than a hidden one; (3) do not take identity away from the player at era changes; (4) end runaway games early with falling dominance thresholds; (5) AI difficulty through flat yield bonuses is the series norm and players call it cheating.

### Gaps
- No primary design talk (GDC) was fetched. AI weakness complaints were found only on forums, without citable specifics. Current (late 2026) Steam numbers were not checked.

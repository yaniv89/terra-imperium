# Terra Imperium against the genre: what to change, what to keep, how to be unique

2026-10-18. A research synthesis, no code changed. Inputs: a full inventory of the game as built
(claude/integration at ec440f37), and web research on 15 strategy games (Civilization VI and VII,
Humankind, Old World, Ara, Millennia, EU IV and V, CK III, Imperator, Victoria 3, Endless Legend 2,
Endless Space 2) and on campaign-plus-battle hybrids and phone strategy (Total War, Rise of Nations,
AoE IV, AoM Retold, Knights of Honor II, Field of Glory: Empires, Hegemony III, Ultimate General,
CoH3, Manor Lords, Bannerlord, Polytopia, Civ VI and VII mobile, ROME: Total War on iPad, Northgard,
Unciv, Freeciv-web, Through the Ages). Sources are in section 7. Nothing here overrides a user
decision; where a recommendation touches one, it is listed as a question in section 6.

## 1. The verdict in one paragraph

No game on the market does what Terra Imperium already does in one product: a real Earth at true
scale over 4,300 years, 150 peoples at their real homes, Paradox-style diplomacy with reasons, and
every battle playable as a real-time battle with a base economy or auto-resolved honestly, on a phone
in landscape and in a browser by link. The genre's biggest complaints (unfair auto-resolve, forced
identity changes, mana currencies, late-game slog, passive AI, pay-to-win on mobile) are mostly ones
the design already avoids or can avoid. The risk is not the vision; it is breadth. The engine still
carries an older Europa Universalis layer (ADM/DIP/MIL points, five victory types, space race, nukes)
on top of the newer Civ-style city layer, the last full playtest scored economy, consistency,
feedback and pacing 3 to 4 out of 10, and about 60 fixes since have not been re-measured. The path
to a unique game is: cut and consolidate, prove it with a new playtest, then invest in four
signature features (section 4) that no competitor can copy easily.

## 2. What already sets us apart (keep and lean into)

| Strength | Why it is rare | Evidence from the research |
|---|---|---|
| Real Earth at true scale, rules in km, real rivers, passes, climate | Civ uses procedural or coarse Earth; Paradox covers 400 to 600 years | True-start-location Earth is a top mod request in Civ; EU5 moved to finer real geography |
| 150 peoples at their real capitals (true start locations) over 2000 BCE to 2300 CE | Nobody spans all of history on a believable globe | Players notice when a people does not start at home |
| One people for the whole game, never forced to switch | Civ VII's forced switch caused its Mixed rating and was reversed after 15 months | Humankind's switching cost attachment |
| Real-time battles inside grand strategy, with a base economy, 300 a side, destructible towns that stay damaged on the map | Total War has battles but a narrow era and shallow campaign; Civ, Humankind and EL2 are turn-based; Paradox has none | Knights of Honor II and Field of Glory: Empires show a weak or separate battle layer gets skipped |
| Honest auto-resolve calibrated to the real-time result (parity tests) | Total War's most common complaint is auto-resolve that does not match and hides its formula | Players auto-resolve 90% of battles; trust in Auto decides whether they enjoy the campaign |
| Independents as living actors: raids, tribute, grudges, mercenaries, patrons, joining by attitude | Minor factions are thin almost everywhere | EL2 and ES2 minor factions are praised but simple |
| Opinion with listed reasons, casus belli, AE and pacts against aggressors | Table stakes in Paradox games, rare in 4X | Players expect every AI attitude explained |
| Phone in landscape and browser by link, deterministic and replayable | Deep strategy on phones is a port (Civ) or very light (Polytopia); browser 4X is not touch-ready (Freeciv-web) | Civ VII on Apple Arcade sells "short sessions"; Unciv's success shows demand for deep and free |
| Signature unit per people in its peak age | Civ copies unique units per civ; ours are research-backed and per age | The 150 roster is done in art |

## 3. What to change (fix before adding)

Ranked by impact on how the game feels.

1. **Run a full playtest now, before new features.** Playtest 3 (2026-10-08) scored economy 3,
   consistency 3, feedback 3, pacing 4, macro AI 4, diplomacy 4, phone layout 4. About 60 fix lanes
   merged since; none is re-scored. Every recommendation below should be checked against that new
   baseline.
2. **Fix the iPhone memory crash first.** City battles reached 500 to 650 MB (textures never freed);
   the crash-hunt lane is merged but unchecked on a real phone. A phone-first game that crashes on
   iPhone loses its main market. Use the triangle and texture budget (plans/art/TRIANGLE-BUDGET.md):
   KTX2 textures, device tiers for map size and battle size.
3. **Retire the mana layer.** ADM/DIP/MIL point pools (up to 9,999) still pay for laws, governments,
   stability and claims. Imperator nearly died of mana; EU5 removed it; players call it "artificial".
   Old World's orders are loved because they come from something you earn. Replace the three pools
   with things already in the game: gold, authority and a small earned budget (see 4.2).
4. **Resolve the ruler contradiction.** Code still rolls a new ruler every 15 to 40 years (10 rulers in
   170 turns in playtest 3), against decision 39 (one ruler per nation, never changing, with a Ruler
   menu; phase RU not started). Build RU; it is also the base of a unique feature (4.2).
5. **Cut the late-game slog.** Modern is about 400 turns at Normal, about 43% of the game, on one unit
   roster, with an old space race, nukes and satellites still wired in. Options: shorten Modern's
   turns (2 years a turn), split it into two sub-ages with their own goals, and remove or rework
   space and nuclear systems that were never redesigned for this game. Every studied 4X struggles
   here; the ones that cope end the game earlier or renew it with era goals.
6. **One victory model.** Five legacy victory types plus a score at 2300 is the old design.
   The research favours either one score with era goals (Humankind fame, Ara prestige) or optional
   challenges (Civ VII Triumphs). Recommend: a legacy score fed by era goals, plus a few named
   ambitions (4.2), and keep domination as the one direct win.
7. **Make battles fewer and bigger.** Total War had to cut minor settlement battles because players
   tired of them. Let small, unwalled towns and outposts fall to an attack without the battle screen
   (still with the capture card), and offer Command for walled cities, field battles between real
   armies and landings. Touches decision 23 (question 6.1).
8. **Make the honest Auto visible.** Show a predicted range (not one number), the top three reasons
   ("walls +, starving -, outnumbered 2 to 1") and the parity line ("Auto matches a fought battle
   within N% over 32 seeds"). Close the known gaps: forts (Auto 20 of 32, real time 0 of 32) and
   landings (real time 32 of 32, Auto 15 of 32), and the two different Auto paths (garrison versus
   empty city HP).
9. **Automate the battle economy on phones.** AoM Retold's villager priorities: worker presets
   (balanced, food, military), automatic drop-site rebuilding, idle workers return to work. The base
   economy should add texture, not taps.
10. **Show consequences before commitment.** EU4's coalition preview at the peace table is cited as a
    quiet best practice. Add: who will join a pact against you before you take a city; the loyalty
    forecast before conquest (partly done); the government change preview (done).
11. **Economy simplification.** Districts with adjacency, nine building lines, rush buying, standing
    works and growth purchases were layered on to fix piling currencies. After the playtest, cut what
    players do not use. Avoid Civ VI's rising-cost district trap and Ara's crafting chores.
12. **Events: depth over count.** 40 historical events and 11 templates repeated and ignored context
    in playtest 3. Old World's modular deck (events with subjects that link into stories) is the
    most-praised event design; see 4.3.

## 4. New ideas to be unique

Ranked by how much they set us apart against the effort. Each fits the existing decisions.

### 4.1 The Chronicle (the game writes your people's history)
Every battle already gets a historical name (battleNames.js), rulers, conquests, era goals and
legacies are tracked. Turn them into a living illustrated history book of your people: chapters per
age, maps of your borders at each age, the famous battles with their results, the ruler's deeds,
the wonders, the cities founded and lost. Shareable as an image or a link. Pair it with a
tap-to-learn glossary (Pentiment's approach) for every people, city, tech and unit, with a
"historically, this people founded X here" note on true start locations. Nobody has this; it turns a
strategy game into a story players keep and share, and it supports a later classroom or explore
mode (Assassin's Creed Discovery Tour shows teachers adopt such material).
Effort: medium. Mostly data that already exists plus a reader screen.

### 4.2 One ruler across the ages, with ambitions (Old World on a full timeline)
Decision 39 already says one ruler per nation, never changing, grown in a Ruler menu. Make that ruler
the player's persona: skills grow through deeds, each age offers two or three ambitions drawn from
the people's real history (Old World's most praised idea), completing one gives legacy score and a
small earned budget of "decrees" per turn that replaces the mana pools (Old World's orders, but light
enough for a phone). Character-driven 4X exists only in Old World's antiquity; nobody carries it
across 4,300 years.
Effort: medium to large (phase RU plus ambitions data per people).

### 4.3 History pressure: crises that come from conditions, not scripts
Real history had the Bronze Age collapse, the Sea Peoples, plagues, steppe surges, the Little Ice Age,
world wars. Model them as world crises that trigger from conditions (overextension, famine,
contact density, a strong steppe independent bloc), not dates, scaled to the world, optional at
setup (Civ VII made crises optional for a reason). Independents are the natural carriers (raider
surges, migrations). Old World-style linked events give each crisis a story. Millennia shows the
appeal; avoid its flaw of one player's race locking everyone's path.
Effort: medium (uses raids, plague, events, independents).

### 4.4 Verified seeded challenges and leaderboards
The engine and the battle sim are deterministic with hash chains and replays. That makes something
no competitor offers cheaply: a weekly seeded challenge (same world, same start, for example
"Bronze Age collapse as Ugarit, 30 turns") whose results are verified by replay, so leaderboards
cannot be faked. Polytopia's 30-turn Perfection mode shows short score modes drive retention on
phones. Add 5 to 10 historical start scenarios (1200 BCE collapse, Alexander, the fall of Rome, the
Mongols, the age of sail) as short modes.
Effort: medium (scenario data, a results page; replay verification exists).

### 4.5 Campaign shapes every battle, and you see why
Rise of Nations' Conquer the World made each battle different with campaign cards. We already feed
supply, terrain from the tile and its neighbours, walls' HP, militia and generals into the battle.
Show them as a "battle card" before deployment (the reasons this battle differs), and let won
campaign events grant a card (a ford scouted, a traitor at the gate, a supply depot). Cheap variety
for many battles.
Effort: small to medium.

### 4.6 Touch controls that beat the mouse
Feral's ROME: Total War on iPad: draw a path to move armies and squads, draw a circle to select, hold
a finger for help on anything. A deep battle on a phone needs this more than more buttons. Teach the
game and the controls in separate steps.
Effort: medium.

### 4.7 Fair business model as a reputation
Pay-to-win poisons reviews in this genre even when it earns (Rise of Kingdoms, AoE Mobile). Polytopia
scaled to over 20 million downloads with capped one-time unlocks. Recommend premium, or free with a
one-time capped unlock, plus cosmetics we already have the pipeline for (culture skins of buildings,
banners, unit skins). Never sell power.

### 4.8 Later: async multiplayer and an explore mode
Supabase lobby scaffolding exists. Through the Ages' async play (jump between games, text history,
undo until End Turn) is the proven phone format. A peaceful explore mode over the real Earth with the
Chronicle and glossary is a cheap second audience.

## 5. What to avoid (lessons from the research)

- Forced identity change between ages (Civ VII backlash). Peoples may evolve titles, art and units,
  never be swapped.
- Abstract action currencies cut off from the world (Imperator, EU4 mana).
- One player's progress forcing everyone's path (Millennia ages).
- Costs that punish catching up (Civ VI district scaling).
- Production chains that become chores (Ara crafting, Millennia).
- Settlement-battle spam and battles in narrow alleys (Total War Warhammer III).
- A battle layer players learn to skip (Knights of Honor II).
- Hidden replenishment penalties (Attila).
- Late-game lag and doomstack waves; keep turn times and the AI's army count in budget.
- Pay-to-win, battle passes, gacha heroes, paid speed-ups.
- Phone shortcuts: tiny top-bar numbers, odd multi-finger gestures, no touch in handheld mode.

## 6. Questions for the user (none blocks writing this; each blocks the matching change)

1. Decision 23 says every assault is a full RTS battle. Should small unwalled towns and outposts fall
   to an attack without the battle screen (Command offered only for walled cities, field battles and
   landings)? Recommended: yes.
2. Remove the ADM/DIP/MIL point pools and pay for laws, governments and claims with gold, authority
   and the ruler's decrees? Recommended: yes.
3. Remove or rework the old late-game systems (space race, nukes, satellites, missiles) and shorten
   the Modern age? Recommended: yes, shorten Modern and keep only what the battles use.
4. Replace the five victory types with a legacy score plus domination? Recommended: yes.
5. Which of the new ideas to plan first? Recommended order: playtest and crash fix, then 4.2 ruler
   with ambitions, 4.1 Chronicle, 4.5 battle card, 4.3 crises, 4.4 challenges, 4.6 touch controls.
6. Business model: premium, or free with a capped unlock plus cosmetics?

## 7. Sources

Strategy games: civfanatics.com (Civ VII ages, formulas), civilization.fandom.com (Revolts, Distant
Lands, Age), civilization.2k.com (patch 1.4.0, dev diaries, Earth map), destructoid.com,
gematsu.com, steamdb.com, newsroom.2k.com, gamesradar.com, vice.com, wargamer.com (Humankind,
Millennia, Imperator 2.0, Victoria 3), community.amplitude-studios.com (Achilles update),
mohawkgames.com and designer-notes.com (Old World), matchstickeyes.com, siliconera.com,
ggrecon.com, paradoxinteractive.com (Millennia ages), forum.paradoxplaza.com (EU5 Tinto Talks, dev
diaries, Imperator 2.0), acoup.blog, paradoxpedia.com, en.wikipedia.org (EU5, Endless Legend 2,
Millennia), pcgamer.com (CK3, ES2), wiki.hoodedhorse.com (Tidefall), pcgamesn.com.
Hybrids and mobile: gamewatcher.com and steamcommunity.com (Warhammer III auto-resolve and
settlement battles), totalwar.com (2.2.0, Pharaoh 1.0.1), legacyofgames.com, gamesfirst.com and
hardcoregaming101.net (Rise of Nations), gamespot.com, historyhit.com, impulsegamer.com,
videogamer.com, checkpointgaming.net, turnbasedlovers.com, ultimategeneral.com, npr.org,
thesixthaxis.com, pocketgamer.com and pocketgamer.biz (Polytopia, AppsFlyer benchmarks, DomiNations),
toucharcade.com, macworld.com, feralinteractive.com (ROME touch controls and help), androidauthority.com
(AoE Mobile), globalgamesforum.com (Polytopia monetisation), boardgamequest.com (Through the Ages),
worldhistory.org (Old World interview), lawrence.edu (Pentiment), variety.com (Discovery Tour study),
videogameschronicle.com (Civ VII "we got it wrong").
The full per-game notes with direct URLs are in the research agents' reports of 2026-10-18; ask to
have them appended here if needed.

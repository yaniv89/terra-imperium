# Playtest 2: 154 turns as Akkad, plus real-time battles

Date: 2026-10-08. Build: claude/integration on localhost:3000 (same code as the live site at that time).
Who played: Claude, by hand in the browser (desktop window about 1600x730, and phone landscape 844x340,
which is 844x390 minus Safari's bars). Settings: Akkad, Real Earth, Standard world, Marathon speed,
Prince. Every claim below was seen in play or checked in the code; "checked in code" marks the
ones that were not seen on screen.

Final state at turn 154: 2 cities (Kish size 3, Agade size 2), Classical Age reached on turn 124,
1,039 gold unspent, at war with Urartu, paying tribute to three raider peoples.

---

## 1. The short version

1. **The first 100 turns are empty.** The capital makes 3 production a turn on the default
   Balanced focus. A settler takes 94 turns. Switching the city to Production focus drops it to 22.
   Nothing tells the player this. Your result (2 cities by Classical) is exactly what the game
   produces for anyone who keeps the default.
2. **Gold piles up with almost nothing to spend it on.** 400 to 1,000 gold sat unused for most of
   the game. You cannot buy units or buildings. The few gold sinks (advisors, buy land, invest in
   growth, fund scholars) are hidden in the Empire and Politics tabs.
3. **The world feels busy but not alive.** 82 civil-war lines and 87 rebellion lines filled my turn
   reports, but almost all happened to peoples I had never met. AI peoples barely grow: at turn 50,
   26 of 36 still had one city.
4. **Threats are fake, then suddenly real.** Refusing tribute says "Expect raiders" and then nothing
   happens for 50 turns. Later, raids arrive in waves and my capital shrank from 6 to 2.
5. **The real-time battle is the best part of the game, and the hardest to reach.** Building,
   gathering, training and the new build menu all work. But placing a building failed 8 times in a
   row, there is no minimap, the enemy can be anywhere, and Retreat ends the whole battle.
6. **Phones in landscape are cramped.** At 844x340 (phone with Safari bars) panels cover 50 to 70%
   of the screen, several sheets stack on top of each other, and some text breaks one word per line.

---

## 2. Gameplay and pacing (map game)

### What happened, turn by turn
| Turn | What I did | What I saw |
|---|---|---|
| 1 | Picked Cuneiform; queued Settlers; sent my army to explore | First techs take 58 turns; settler 94 turns; army moves only at End Turn |
| 5 to 12 | Army reached the Gulf | Supply ran out on turn 11 (-10 a turn); the army started starving |
| 12 | Mari demanded tribute; I refused | "Expect raiders"; nothing happened for 50+ turns |
| 34 | Hired an advisor, seated a governor | Gold had nothing else to buy |
| 35 to 77 | Paid one demand, refused another | Same events again and again (The River Rises 4 times) |
| 77 | Found "Invest in growth" in the city Politics tab | Spent 400 gold; no visible effect on city size |
| 89 | First settler finally done | The settle view (green/red) and site card are good |
| 100 | Switched Kish to Production focus | Settler time 95 turns -> 22 turns; this is the biggest finding |
| 100 | Tried every city tab button | Develop production was undone next turn |
| 101 | Attacked Mari from the city card | No real-time battle (city had no troops); army jumped 4 turns of distance in one click |
| 101 to 110 | Held Mari | It rebelled and was lost on turn 110 |
| 111 to 154 | Raids hit Kish in waves; Urartu went to war after a refused demand | Kish shrank from 6 to 2; 4 sheets stacked on screen at once |

### Findings
- **Default focus cripples production.** Balanced focus gives Kish 3 production; Production focus
  gives 13. The default should either be smarter or the game should point at the focus switch the
  first time a build is longer than ~20 turns. (Checked in code: the balanced focus never works hills.)
- **Marathon multiplies everything by 4.** Settler 280 production, swordsmen 86 to 256 turns,
  ballista 136 to 408 turns, heavy cavalry 128 to 384 turns. Even Normal is about 920 turns long.
  Recommendation: marathon at about 2.5x, and early costs (settler, first units) cheaper on every speed.
- **Settler cost rises per city** (280 in Kish, 360 in Mari) while the second city makes 1 production.
  A new city cannot build anything useful for a long time (Agade: swordsmen 256 turns).
- **Research is the only thing that moves.** 6 to 8 science a turn; a tech every 6 to 20 turns.
- **Dead turns.** From turn 12 to 89 my only decisions were events (one every ~4 turns, often the
  same one) and tribute demands. There is no exploration to do (supply kills the army), nothing to
  buy, and one city with one build.
- **Events repeat and ignore context.** "The River Rises" 4 times; "the granary is wet" with no
  granary; "Raiders From Across the Sea" for an inland city; "Failed Harvest" twice in 4 turns.
- **Rulers change every few turns.** I had 6 rulers in 117 turns (Malik, Yusuf, Malik again, Tariq,
  Faisal...). The ruler system exists in a shallow form: a name, ADM/DIP/MIL, a trait, "reign ends
  turn N". It changes too often to matter.
- **Tribute demands come constantly.** 10 demands in 154 turns from 5 different peoples. Paying is
  cheap (2 gold a turn); refusing is free for a long time, then raids arrive all at once.
- **Raids:** refusing Mari (turn 12) and the Medes (turn 55) brought no raid for 50+ turns. Then from
  turn 100 raid parties arrived repeatedly and sacked Kish (size 6 -> 2). Cause found in code: a
  refusal only adds grudge, and the demand text itself says "Nothing of yours in their reach is worth a
  raid now". The threat is empty early and overwhelming late.
- **Conquest does not stick.** Mari was taken on turn 101 (loyalty settling at 0, -50 a turn) and
  rebelled on turn 110 despite a garrison, a governor and 50 gold of "Quell unrest".
- **"Develop Tax/Production/Manpower" does nothing.** It spent 114 power for +1 production; the next
  turn the value was recomputed from tiles (4 became 14 because of the focus change). Confirmed in code.
- **"Invest in growth" (100 gold) showed no effect** on size over the following turns.
- **Buy land price mismatch:** the button said 144 gold, 159 was charged.

## 3. AI behaviour
- AI peoples rarely expand: at turn 50, 26 of 36 majors had 1 city; at turn 154 most have 2 to 3.
- AI peoples do not explore (confirmed in code: peacetime AI armies never move). I met only 4 majors
  by turn 130, all neighbours.
- Civil wars and rebellions are constant: 82 civil-war lines and 87 rebellion lines in 154 turns.
  The engine research traced it: AI bankruptcy drops stability and the 5-turn civil-war streak fires.
- Independents act: they demand tribute, form raid parties ("Raid party, going home"), and sack cities.
- "The Lapita tribes settle Talepakemalai: a new independent city" is a scheduled late arrival, not an
  independent founding a second city. Only the log wording misleads.
- Urartu (a major) demanded 198 gold, I refused, and Urartu declared war: majors follow through.

## 4. Map and units (world map)
- **Camera jumps** when opening Empire or closing the city panel (seen twice): the map flies to the Gulf.
  Cause found: the last fly-to target is reused whenever a panel changes the free screen space.
- **March starts next turn.** Ordering a march does nothing until End Turn.
- **March arrows** are a thick yellow zigzag on preview and a thick green line once ordered.
- **Units do not animate between tiles**; they jump.
- **Supply ends exploration**: -10 a turn in the wilderness; my army starved after 10 turns.
- **"Army at Kish"** label stays while the army stands in the wilderness.
- **"Attack" prompt lies:** "Your army borders Mari: attack it now" while the route says 4 turns.
- **Invade from the city card teleports** the army 4 turns of distance in one click.
- **Fog borders:** Mari's border hex was drawn as a closed ring away from the city.
- **Tapping a tile in your borders opens the city**, not the tile.
- **Settlers:** the settling view (green where you can settle, red where not) and the site card
  (yields, resource, river, tiles claimed, distance) are the best UI in the game. The settler itself is
  a tiny 2D wagon, and its route is not drawn.
- **New city has no town model** (a tent icon until it grows), and the outpost stage is not explained.
- **Resources:** wheat, cotton, papyrus have no map icon; Oil is listed in the Bronze Age; 37% of land
  tiles carry a resource (too many to mean anything).
- **Naval:** War Galley, Trireme, Longship and Bireme are offered in Kish and Mari, which are river
  cities, not coastal. Harbor correctly says "needs a coast".
- **Improvements** are a long list of identical rows ("Farm on desert, floodplain, river" x8) with no
  map highlight, so you cannot tell which tile is which.

## 5. City panel, every tab
- **Two layers:** tapping a city opens a "city card" (owner, Open the city, overview numbers);
  "Open the city" opens the real panel; closing it leaves the card open behind.
- **Overview:** focus buttons (good, and the most important control in the game, but not explained);
  quick-build buttons (Granary, Barracks, Palisade, Shrine) did nothing in Mari, which could not
  build them.
- **Build:** tapping a row does nothing; only the small arrow queues. No building says what it does.
  Unit times are in the hundreds of turns.
- **Citizens:** tile list with lock and Buy land (works; price mismatch above).
- **Buildings:** category tiers ("next Granary (48)") with no effect text; Develop buttons (useless);
  Infrastructure and Defenses (work, cost gold).
- **Politics:** loyalty breakdown (clear), unrest with reasons (clear), Gain control, Quell unrest
  (works: 50 -> 20), Invest in growth (no visible effect), governor info.
- **Defense:** read-only battle housing; no actions.
- **City rail bug:** "Settlers in 2800 t" while the queue says 94 turns.

## 6. Empire, research, diplomacy
- Empire panel: Authority shown twice (Overview and Court); "Nothing being researched" while a tech is
  being researched; advisor names repeat ("Hassan" twice).
- Research panel: says "Classical Age" while the game was still in the Bronze Age; very tall; with the
  city card open only a narrow strip of map remains. "Fund Scholars" (gold into science) is a good sink.
- Diplomacy: every action costs gold or DIP (trade 100 gold, pact 150, open borders 50); Demand tribute
  gives a casus belli on refusal (works); opinion "Why?" link is good. No map trading exists.
- Power points (ADM, DIP, MIL) are never explained; their totals are not on the top bar.

## 7. Real-time battle
### Campaign battles
- **Siege of Mari:** chose Command; the battle resolved instantly ("2 rounds"). Cause: the city had no
  troops, so the battle guard settled it on Auto, while the pre-battle card promised "about 300 to 460"
  defenders and offered Command. The unit counts disagree too: 1,000 on the card, 9,800 in the result.
- **Sack of Kish (defence):** 130 militia against 1,000 raiders. Auto gave 0%, yet Command was offered.
  The enemy never came on screen; my squad died off-camera in 48 seconds; "0 of 7 houses ruined" and a
  Defeat. A hopeless defence should say so and default to Auto.

### Sandbox battle (economy on, Bronze, walled city), played properly
1. Trained 3 laborers at the camp (works; queue shows).
2. Laborers gather on their own; the ore node card shows "390 / 400 left" (works).
3. **Placing buildings failed 8 times in a row** ("Too close to the edge of the field", "Blocked by
   trees", "Too close to another building"). A scan of the visible area found 6 valid points out of 160.
   The edge of the field is never drawn, and there is no green zone.
4. Placed a house and a barracks after finding valid spots; construction bars fill and walls rise on the
   scaffold (works, looks good).
5. Trained 4 spearmen at the barracks (works).
6. Could not find the enemy: no minimap; the "Keep 100%" link does nothing; no keyboard or edge panning
   on desktop (only middle-drag or right-drag with nothing selected).
7. Marched west (wrong way), then east; the army moves in good formation; the camera never follows.
8. At the walls: towers and defenders destroyed 8 of 10 squads; the gate went 100% -> 94% and was
   repaired back to 100%. Rally Cry and Arrow Storm work with clear cooldowns. "Shaken" alert with
   Rally and Go works.
9. **Retreat ended the whole battle as a Defeat**, with no confirmation, while 4 reserve regiments and
   985 food / 1,198 materials sat unused.

### Battle findings
- The economy loop (gather, build, train) is fun and works.
- Placement needs a visible buildable zone and a drawn field edge.
- Needs a minimap (or at least a "go to enemy keep" button that works) and desktop panning.
- Retreat should withdraw the selected squads, not forfeit; the full withdrawal needs a confirm.
- **Your rule:** a battle should be lost only when all your buildings are gone, not when the units die.
- Reserves (4) were never prompted; nothing reminded me they existed.
- The town in the Sack of Kish looked Mediterranean (white walls, red roofs), not Bronze Mesopotamia.

## 8. Art and animation
- **Trees look bad:** flat, repetitive low-poly blobs in one dark green; they read as noise.
- Units: formations and marching look good; soldiers are tiny on a phone and hard to tap.
- Animations are limited to walk, a weapon strike and idle sway (the animation bake is not built).
- Construction scaffold and rising walls look good.
- Map: the realistic Earth, rivers and close-zoom towns look good; new cities show a tent until they grow.
- Resource and settler icons are small and inconsistent.

## 9. UX/UI on desktop
- Too many panels can be open at once: city card + city panel + research dock + turn report.
- The End Turn button moves when docks open, causing mistaps.
- Turn report fills with news about peoples I have never met.
- First-contact cards, turn report, research choice and battle results all appear at once.
- Text and grammar: "The Elamite tribes descends", "Qedarite horde sacks Sack of Kish",
  "You refuse the tribute The Mariote horde demand", "1 of your unit starves".
- Native browser confirm dialogs (New game) feel out of place.

## 10. UX/UI on phone landscape (844x340, Safari bars on)
- The battle deploy help box covers half the screen, its text is cut off, and it says "right click".
- In battle, the camp card, the defender housing panel and the train bar cover about 60% of the screen;
  the housing panel's collapse arrow did not collapse it.
- The Cancel button in build placement sits where a build tile appears next, so Cancel can pick Tower.
- Map: the tribute sheet breaks at this height (title one word per line); the battle result needs
  scrolling; several sheets stack.
- The Safari bar issue is real for layout: any panel sized to the full height gets cut. The new
  visible-area handling helps, but some sheets still assume 390 pixels.

## 11. What works well (keep it)
- The settling view and site card.
- Tribute and diplomacy sheets: clear options, costs, and consequences in plain words.
- City Politics tab: loyalty and unrest with reasons.
- The battle economy: gather, build, train; construction bars; picture build menu.
- Shaken state with Rally; Rally Cry and Arrow Storm.
- Centred event cards and the End Turn call to action ("Choose research", "Answer: ...").

## 11b. Session 2: phone landscape 844x340 (Akkad, Marathon, turns 1 to 200)
Played on the phone layout (`data-layout="phone-landscape"`, 844x340 = 844x390 minus Safari bars;
touch not emulated at this width, taps arrive as clicks). Production focus from turn 1.
- Result at turn 200: 4 cities (Hagmatana 2, Agade 5, Kish 3, Sippar 1), Classical Age, **2,441 gold
  unspent**. Production focus from turn 1 roughly doubled the expansion speed versus session 1, but
  the land ran out: every settling site within reach was "too close" to an independent or neighbour.
- **Conquest loop:** my army besieged Hagmatana on its own after I parked it next to the city (no order
  given). Hagmatana surrendered 5 times and broke away 4 times ("thrown off your rule").
- World at turn 200: 106 civil-war lines, 117 rebellion lines, 51 ruler changes, 42 events, 9 tribute
  demands, 0 raids on me (I paid every demand).
- Battle (Siege of Hagmatana, Command, phone): trained laborers, built a barracks after one failed
  placement, trained 6 spearmen, panned 70 tiles to find the keep, attacked; Defeat after 8 min 26 s.
  The result said "902 of 902 lost, 1 regiment destroyed" but the army was still on the map with 175 men.
- Phone UX seen in this session (in addition to section 10):
  - The turn report takes the right half of the screen; the city card the left 37%; together nothing
    of the map is visible. Closing the city panel always reveals the city card under it (two closes).
  - Tapping my army's banner on its city opens the city card; reaching the army needs a scroll to
    "Armies here".
  - The march banner ("Tap a city or a tile") covers the top of the map and the route preview.
  - Prompt chips move when sheets open or close, causing mistaps.
  - Event cards fill the screen and only the first option is visible without scrolling.
  - The city panel Focus row (the most important control) is below the fold on the Overview tab.
  - The Build list shows about three rows at a time; queueing scrolls the queue out of view.
  - The settling view (green/red) disappears after the first tap on a red site; the "Go and found
    city" button is half clipped at the bottom.
  - Narrow left sheets (tribute, peace offer, first contact) break their titles one word per line.
  - "A new era dawns" banner stays for 30+ turns and covers the top bar.
  - Battle on phone: very dark field, deploy help covers a third of it, speed/pause buttons shift so a
    speed tap hit Pause, the pause sheet takes half the screen.
  - Pre-battle card fits the phone (the portal fix works).
  - Siege text contradicts itself: the army sheet says "walls 165/240", the pre-battle card says
    "No walls, an open town".

## 12. Ideas for making money (no pressure, player-friendly)
1. **Free base game + paid expansion packs:** ages (Medieval, Gunpowder, Modern) or regions
   (Americas, Africa) with their own peoples, units and wonders. The 150-people roster suits this.
2. **Premium people packs:** famous peoples with signature units, unique buildings and town art
   (Rome, Egypt, Mongols). Cosmetic and content, not power.
3. **Cosmetics:** banners, shield emblems, unit skins, town styles, map themes; the art pipeline already
   produces per-culture variants.
4. **Scenario and campaign packs:** historical campaigns (Bronze Age Collapse, Rise of Rome) with
   scripted goals; a natural fit for the battle sandbox and generated worlds.
5. **One-time "full game" purchase on mobile** (no ads, no energy timers): strategy players dislike
   pay-to-win and timers.
6. **Supporter tier / Patreon-style early access** to new ages and beta features.
7. **Map seed sharing and community challenges** (weekly seed, leaderboard by score or turn count) to
   drive retention; later a paid "season" of curated challenges.
8. Avoid: selling gold, speed-ups or battle power. It would break the single-player balance and the
   deterministic multiplayer plans.

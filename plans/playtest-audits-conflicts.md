# Playtest audit tasks: conflicts, duplicates, done items and a safe parallel schedule

Read-only check of the 237 tasks (I001 to I224, U01 to U13) on `claude/integration` at `af7ce624`
(2026-10-13). Sources: the item inventory (.md and .csv), the implementation plan (sections 3, 5, 6
and 12), the code batches (.md and .csv), both work breakdowns, the art production plan, MASTER-PLAN
section 2 (and sections 6.2 to 6.11 that record how those decisions were built), ART-MODELS-PLAN
section 1, CLAUDE.md, and the code. No code was changed.

## Summary

- **13 real conflicts.** 10 need a user decision (questions Q1 to Q10 below, each with a
  recommended answer). The other 3 are settled by a later user instruction or an existing decision
  and only need the plan rows corrected.
- The biggest ones: the base rule D1 against decisive field battles (decision 33) and the existing
  battle clocks; stone (U01) against the three battle resources (decision 35); the full starting
  roster (U10) against the 300-a-side waves (decision 25, MASTER 6.2); ruler items I146/I147 against
  "one ruler, never changing" (decision 39); globe fog work (I079) against "delete the globe"
  (decision 28); bigger machines and soldiers (U08, I218) against the true-scale unit fix merged on
  2026-10-08.
- **16 duplicate groups** (same fix under two or more IDs), plus 2 IDs that are superseded rather
  than duplicated (I193, I194 by U10).
- **No gameplay code has landed on `claude/integration` since the audit baseline `0c08cf85`:** the
  only 7 later commits are planning docs. Nothing can be closed as "fixed since the audit". But
  about 12 fixes landed on 2026-10-07 and 2026-10-08, just before the baseline and possibly after
  the Playtest 2 sessions; the plans never mention them. 15 items (11 rows in section 5) should be re-checked first and
  may close without work (list below). Three new climate tree kits already exist on the unmerged
  branch `origin/gpt/art-remaining`.
- **Ordering traps:** 13, listed below. The main ones: battle balance and Auto parity before the
  battle rule changes; the battle HUD before its input state machine; any new battle order before
  the replay codec (CB01); art accepted against stale LOD numbers; Battle Supply display before U10;
  save version and battle setup version numbers claimed by several branches at once.
- **Schedule:** 8 lanes can start at once on separate branches (wave 1). The battle rules work
  (CB18, CB16, CB17, CB10, CB15, CB19, CB20 picking) has to be one chain, and all balance tuning
  comes last, one batch at a time.

## 1. Conflicts

"Decision" = needs a user decision (yes/no).

| # | Conflict | IDs | Why (evidence) | Recommended resolution | Decision |
|---|---|---|---|---|---|
| C1 | Reserve button kept vs removed | I193, I194 vs U10 (also I195, W02 task 4) | I193 asks to "keep reserve status and call action visible", I194 a reminder that "reserves remain available". U10: "Remove Reserve button and put committed regiments in the starting force". Plan section 12 already says the later request wins, but the inventory and the code-batch CSV still list I193/I194 as CB18 "Fix" items. | Mark I193 and I194 superseded by U10. Reword I195 ("reserve" becomes "not yet entered / later reinforcement"). Keep `callReserve` in replay only for old setup versions (W02 task 4). | No |
| C2 | Build menu after placement: close vs reopen | I178 vs U13 (W05 task 3) | I178 completion check: "Successful placement **closes** the menu". U13: "Successful confirmation **reopens** the sheet once". W05 task 3 was updated to U13; the inventory .md/.csv row for I178 was not. | Change I178's completion check to U13's rule: the confirming tap is consumed and the sheet reopens once, with no second building armed. | No |
| C3 | Mixed groups: move together or each at its own speed | I192 vs U07 | I192 (R100): cavalry ran ahead alone; wants group pace by default. U07: "a mixed selected group moves together only when cohesion is explicitly active", and cavalry must outrun infantry. Today `movement.js:45` applies `groupSpeed` on move and attack-move. The two disagree on the default. | One rule: a mixed selection moves at the slowest pace by default, with a visible "group pace" chip that releases it; a single-class order always uses its own speed. | **Yes (Q6)** |
| C4 | Base rule vs decisive field battles | D1, I014, W06 task 2 vs decision 33, decision 36, MASTER 6.9 and 6.11 | D1 (the user's own P2 rule: "a battle should be lost only when all your buildings are gone, not when the units die") exempts only "field/naval battles **without bases**". But decision 36 gives field battles, sallies and landings full base-building, so that exemption is empty. Today `step.js:92-121` ends field, river, ambush and sally battles by pursuit once a side breaks (decision 33), and P3 R157 ended an assault "when all defenders routed (keep still 1,243 HP)". | Apply D1 to every battle with a base (field camps included); keep decision 33 for the end itself (the loser's units still on the field are lost, those that left through an exit live). Raids and sacks keep their loot rules. Re-run parity after. | **Yes (Q3)** |
| C5 | What counts as "the base" | D1, D2, A13, A14 vs MASTER 6.3/6.8, world plan 8, `cityStructures.js` | A14 says houses are "protected civilian houses [that] cannot be destroyed". The code says otherwise: houses are passive structures that only an explicit order or bombardment destroys (`cityStructures.js:5-8`), and decision 31 only caps what carries to the map. The real clash: if houses count, the attacker must demolish the whole town, against "victory does not require demolishing the city", and a city assault already ends by taking the keep (`keepTaken`, `step.js:83`). | The base is the HQ, camp or keep plus economy and military buildings built in battle. Houses, landmarks, walls and unfinished sites do not count. Taking the keep still wins a city assault. Correct A14's premise in the plan. | **Yes (Q4)** |
| C6 | Stalled base battles: new draw vs current clock | D3 vs MASTER 6.1 clocks, `step.js:75,126` | D3 prefers "draw/withdrawal or an announced objective timeout". Today the clock gives the defender the win (`timeLimit`) and the attacker's unbroken units withdraw in order (R3). A `stalemate` outcome exists only for mutual destruction. A new draw changes `applyBattleOutcome`, war score and Auto. | Keep today's clock rule (defender holds, attacker withdraws in order), shown on the pre-battle screen. No new draw outcome. | **Yes (Q5)** |
| C7 | A fourth battle resource | U01 (and D13, UI14) vs decision 35, MASTER 6.4, `economy.js:7,24` | Decision 35: "Three battle resources: food, materials, gold", with stone inside materials. U01 asks for a distinct `stone` stock, costs and pickup. The code has `RESOURCES = ['food','materials','gold']` and stone nodes feed materials (`economy.js:91`). U01 is the later request, but it replaces a numbered decision, and Auto (`autoBattle.js`) is calibrated on the three-resource economy. | Replace decision 35 with four resources (Food, Materials = wood and ore, Stone, Gold). Version the battle setup, keep old replays on the old rules, re-run parity. | **Yes (Q1)** |
| C8 | Full roster vs the 300-a-side waves | U10 vs decision 25, MASTER 6.2 ("Waves: the units that do not fit wait off the map and enter as population frees up, in the order the player sets") | U10 removes the player-callable reserve and starts "the full eligible roster". Decision 25 keeps 300 a side and waves for bigger armies; the 1,000 preset failed the phone test (MASTER 6.2 table). U10 does not say what happens to an army over the cap. | Everything that fits the cap starts on the field. The overflow enters on its own as population frees up, in a fixed order, with an arrival notice and no button. 300 stays the default. | **Yes (Q2)** |
| C9 | Ruler reigns and successions | I146, I147, W09 task 9 vs decisions 37 and 39, RULER-PLAN | I146 wants reigns tuned "across speeds"; I147 wants every succession logged. Decision 39: "One ruler per nation, never changing" (phase RU, not started). `rulers.js` still rolls 15 to 40 year reigns. The code-batch CSV maps both items to `research.js`, which is the wrong file. | Close I146 as superseded by RU. Keep I147 only as a small log line until RU lands, or close it too. Fix the CSV path to `src/engine/rulers.js`. | No (decision 39 settles it) |
| C10 | Fixing the globe vs deleting it | I079, T08, W13 task 10, W13 task 11 (legacy map), W15 task 6 vs decision 28, CLAUDE.md, `mapPrefs.js:5-6` | Decision 28: the globe is "hidden behind this setting for one release, then deleted". The old SVG map is the same ("stay behind settings for one release"). The plan spends a Major investigation and a test matrix on fog, labels and picking for both. | Delete the globe (with react-globe.gl and politicalTexture) and the SVG map instead of auditing their fog. Close I079 and T08 when they are gone. | **Yes (Q8)** |
| C11 | Bigger heavy units and bigger soldiers vs true scale | U08, I218, MD09, MD10 vs commits 1d31e518 and d135e898 | The unit-zoom fix put people and mounts at true scale ("a man shoulder-high to a horse's back"); "machines and files with a JSON height keep the fit". U08 asks for larger cannons, tanks and artillery "keeping crew and vehicle proportions coherent", which would make crews larger than the infantry beside them. I218 ("soldiers too tiny") pulls the other way from the fix that just shrank oversize figures. | Enlarge only the machine body (machines are already fitted, not true scale), crew stay at human scale. Fix I218 with larger tap targets, squad markers and the default camera, not bigger figures. | **Yes (Q7)** |
| C12 | Marathon pacing vs the calendar rule | D7, I024, W07 task 11 vs `ages.js` speeds and `ages.test.js:109` | D7 proposes "Marathon near 2.5x" as a separate production factor. Today every cost scales so that cost times years-a-turn is the same at every speed (tested). The research costs (40/85/135/140/290) were calibrated on that, and the date gates (D10) are in calendar years. A separate factor changes research against production (I030) and the gate waits (I133). | Keep "same game, more turns" (costs follow years a turn). Fix Marathon's empty opening with cheaper opening builds and the production baseline from W07 task 6, measured on both speeds. | **Yes (Q9)** |
| C13 | "Make tributary" for a single captured city | D6, I129, W12 task 4 vs `conquest.js:2-12`, vassals.js, indepPolicy.js | D6 offers Conquer, Raze, Make tributary, Free for every capture. A city taken from a multi-city major is not a polity. `conquest.js` hands it over at once, scores it in the war and lets the loser demand it back at the peace table. W12 task 4 notes the gap but does not decide it. | For a major's city, "Make tributary" releases it as a one-city independent that pays you tribute (existing independent tribute rules); for an independent's city it stays independent and pays. Ownership still moves at once, with the choice pending (no provisional ownership). | **Yes (Q10)** |

### Checked pairs that do not conflict

| Pair | Finding |
|---|---|
| D12 / I210 (remove the "50% rule" text) vs D2 and decision 31 | Text only. The text sits in `BattleHud.jsx:230-244`, `BattleResultScreen.jsx:79-85`, `PreBattleModal.jsx` (comment). The rule stays in `cityManifest.js`. Keep a plain line of what was lost and "repairs are free", so the result screen still explains the numbers. Do I210 inside CB02's result-screen rewrite (same file). |
| D5 (auxiliaries stay temporary) vs tasks that keep trained troops | No audit task keeps them. But the RTS plan 6.5 two-pool design (escrowed regular recruits that persist) is still "left" in MASTER 6.10 and 6.11. I015's labels should name both pools now so they are not redone when escrow lands (trap T13). |
| D6 (capture choice) vs decision 31 (conquest keeps half the city) | Compatible: battle damage carries under the 50% rule before the choice; Raze uses the existing gradual razing (`razing.js`, roadmap decision 7), never instant ruins. A Raze button already exists (`RazeControl.jsx`), so W12 extends it. |
| D10 (keep research date gates) vs any task to remove them | No task removes them. D10 matches the user's 2026-10-01 answer ("keep hard year gates for now, soft gate later", map-research-mobile-overhaul decision 2). The planned soft gate (slice 5) is an ordering trap (T10). |
| D4 withdrawal vs decision 33 | Compatible: units that left by an exit live and step back one tile; those still on the field lose. Under C4 a whole-army withdrawal still ends the battle as a loss even with a base. |
| I007 (offer Command for militia defence) vs CLAUDE.md "a commanded battle never opens with nobody on a side" | Compatible if Command is offered only when the setup has someone on each side, and the reason is shown before the choice (W06 task 6). Coordinate with `battleOpenGuard.js`. |
| I060 (split stacks) vs "move a whole stack for 1 MIL" (2026-10-01) | Compatible; define the MIL cost of moving a split part. |
| ART-MODELS D11 (rivers painted into the raster) vs current vector rivers | Already resolved: CLAUDE.md and art plan 2.1 item 9 say rivers are vector lines. "Preserve rivers" (W14 task 12) means the vector rivers. |

## 2. Conflicts with earlier user decisions (MASTER-PLAN, ART-MODELS-PLAN)

| Earlier decision | Audit task in conflict | Row above |
|---|---|---|
| 25: 300 a side, waves for bigger armies (MASTER 6.2) | U10 | C8 |
| 28: hide the globe one release, then delete it | I079, T08, W13 tasks 10 and 11, W15 task 6 | C10 |
| 33: decisive field battles; 36: full base-building in field battles | D1, I014, W06 task 2 | C4 |
| 31 and world plan 8: the city is not demolished to win | D2, A14 | C5 |
| 35: three battle resources | U01, D13, UI14 | C7 |
| 37: succession removed; 39: one ruler, never changing | I146, I147, W09 task 9 | C9 |
| MASTER 6.1 battle clocks (defender holds at the clock) | D3 | C6 |
| Unit-zoom fix of 2026-10-08 (true scale, machines fitted) | U08, I218, MD09, MD10 | C11 |
| ART-MODELS D1 (soldier LOD 360 and 64 triangles), MASTER 6.2 phase C2 ("about 360 and about 60") | Not a task, but stale: the code now uses 550 and 220 (`bf979d33`, edge collapse in `375dc995`). CB20 acceptance and the phone budget (D3, 300k soldier triangles) must use the current numbers. | Trap T5 |

## 3. Ordering traps

| # | Trap | Batches | Why it must be ordered | Safe order |
|---|---|---|---|---|
| T1 | Balance tuned before the rules change | CB04 (I021 to I028), CB18 (I211, I212), CB08 (I100, I101, I108), CB09 | D1, U01 and U10 change every battle outcome and Auto's calibration (`autoBattle.js`, parityEco). Persistent investment (I031), the land quote (I036) and rush (I019) change the economy that pacing is tuned on. | Rules first, then one balance pass per area with balance-sim and parity against one shared baseline. |
| T2 | Battle HUD built before its state machine | CB19 vs CB15, CB16, CB18 | The HUD must hold the hammer and wand launchers (U02, U09), five values (U01 stone, U12 supply), base status (D1) and no Reserve button (U10). Laying out 844x340 first means doing it twice. | CB18, CB16, CB15 state machine, then CB19 layout. |
| T3 | New battle orders before the replay codec | CB15, CB16, CB17, CB18, CB10 vs CB01 | `replay.js:20` admits only 12 order types; economy orders are missing (I001). Any new order (placement confirm, assign worker, stance, cohesion, withdraw selected) added before CB01 repeats the Kerma bug. Removing `callReserve` must keep it for old setup versions. | CB01 first; every later batch adds its orders to the shared schema in the same change. |
| T4 | Battle hashes and setup version | CB01, CB10, CB15, CB16, CB17, CB18 | Each changes world hashes, `SETUP_VERSION` (6, `buildBattleSetup.js:38`), the golden fixtures (`src/engine/__fixtures__/battle-golden.json`, replay and kernel tests) and checkpoint fit (`battleOpenGuard.js:31`). Two branches doing it at once means re-baselining twice. | One chain, one version bump per merge. |
| T5 | Art accepted against old scale and LOD rules | CB20 (I217, I218, U04, U08), art MD05, MD08 to MD10 | Neither audit plan mentions the merged unit-zoom fix: true scale (`ART_UNIT_WORLD`), team colour as an accent only (`teamTint` 0 near, 0.06 far, mount and garment share 0), polearms 2.5, 5 and 3.5 m, soldier LOD 550 and 220. The accent rule weakens side readability at distance, which ART-MODELS section 11 requires ("team colour reads on both sides"). | Re-measure side readability and the phone budget on the current build first; judge every repair against it. |
| T6 | Tree kits commissioned twice | MD05, I217, U04 vs `origin/gpt/art-remaining` | That unmerged branch adds `vegetation-cold`, `-conifer`, `-tropical` (only steppe is still missing), raid and landing props, and changes the UV repair policy in `kitLoader.js` (the file the camouflage fix `58527447` edited). | Review and merge it (or reject it) before CB20 touches `kitLoader.js` or MD05 is ordered. |
| T7 | Animations before the VAT pipeline | U06, U07 gait, I219, AN15 to AN17 | ART-MODELS D5: clips play only after the Wave 0b VAT pipeline; today the loader uses the procedural rig. | VAT pilot (I219) first, then worker tools, barrow and gait. |
| T8 | Load profiling baseline | CB21 (I220) | `375dc995`: "The battle opens once the simplifier is ready", a new wait at battle start the audit did not see. | Profile with it, before and after CB20 asset changes. |
| T9 | Battle Supply display | U12 vs U10, U01 | Reserve calls spend Battle Supply today; U10 removes them, so what the number is for changes. U01 adds a fifth value to the same bar. | U10 and U01, then U12. |
| T10 | Research wait UI vs the planned soft year gate | CB12 (I133, I134) | The soft gate ("+50% before its time", map-research-mobile-overhaul slice 5) would replace "waiting for date". | Build one research status object with a generic gate field (wait or extra cost) so slice 5 only changes data. |
| T11 | Speed table first | Q9, I024 before I133, I221, I100, I146 | The research ETA, event cooldowns ("scaled across speeds") and tribute cooldowns ("Normal-equivalent turns") all read the speed table. | Answer Q9 and fix the pacing table before those batches tune numbers. |
| T12 | Save version numbers | CB04 (`city.investment`), CB05 (per-item queue progress), CB11 (capture operation), CB13 (persisted decision queue), CB03 (hold order), phase RU | Current save version is 13 (`saveMigrations.js:35`, taken by map variations); RULER-PLAN still says "save v13" and MAP-VARIATIONS v14, both stale. Parallel branches will each claim 14. | Assign the number at merge time, one migration per merge. |
| T13 | Auxiliary labels vs escrowed recruits | I015, I211 vs RTS plan 6.5 | If regular escrowed recruits land later, a one-pool label and balance pass are redone. | Design I015's text for both pools now; tune I211 after the escrow decision. |

## 4. Duplicates (same fix under several IDs)

Most pairs already share a primary batch; mark one as the owner and the others "done with".

| Group | IDs | Owner | Note |
|---|---|---|---|
| D1 | I177, I178, I179 and U13 | U13 | One placement state machine (preview, confirm, reopen). I178's text conflicts (C2). |
| D2 | I182, U05 and the X of U02 | U05 | Close menu vs cancel placement vs Stop: one precedence rule. |
| D3 | I192 and U07 | U07 | One movement and cohesion contract (C3). |
| D4 | I190, I191 and U11 | U11 | One stance and threat-response contract (pullback, idle after a kill, respond when attacked). |
| D5 | I217 and U04 (look part) | U04 | Same tree art (MD05); U04 adds picking. |
| D6 | I218 and U08 | MD09 | Same art package and scale question (C11). |
| D7 | I201 and U03 | U03 | Same 70% field measure and usable rectangle. |
| D8 | I135, I136, I137 | I135 | One research status selector feeds every surface. |
| D9 | I139, I140, I141 | I139 | One government preview and confirm. |
| D10 | I084, I086, I087 | I086 | One settlement mode. |
| D11 | I058, I059, I063 | I058 | One physical-location selector. |
| D12 | I128 and I129 | I129 | Capture receipt and the choice are one transaction. |
| D13 | I010 and I011 | I010 | Same pre-battle odds card. |
| D14 | I115 and I170 | I170 | One log summarizer for recurring lines (plunder, upkeep). |
| D15 | I186 and art UI05 | I186 | Same blank build icons. |
| D16 | I062, I157, I210 and decision D12 | the items | D12 restates the three items; not extra work. |
| Superseded | I193, I194 | U10 | Not duplicates: they asked for the opposite and are replaced (C1). |

## 5. Already done, partly done, or to re-check first

**Since the audit:** nothing. `git log 0c08cf85..origin/claude/integration` holds only 7 planning
docs commits (`f1353364`, `9d7b49b8`, `5992a648`, `40444cb6`, `a543d1eb`, `d4352010`, `af7ce624`).
Spot checks confirm several items are still open in code: I001 (`replay.js:20` has no economy
orders), U10/I193 (Reserve button, `BattleHud.jsx:305`), I210 (the 50% text above), U01
(`RESOURCES` has no stone), I146 (reigns still rolled, `rulers.js`), I079 (globe still behind a
setting).

**Fixed just before the baseline, but the plans never mention them** (Playtest 2 may predate them;
both reports are dated 2026-10-08 with no build SHA). Re-check these on the current build before
scheduling work; several may close:

| IDs | Commit that may have fixed it | Re-check |
|---|---|---|
| I217 (trees read as noise) | `58527447` 10-08 06:12 "Repair scrambled LOD uvs in kits: no more camouflage trees"; three new kits on unmerged `gpt/art-remaining` | Battle at 844x390, default and far zoom. Silhouette work may still be needed. |
| I218 (soldiers tiny), part of I209 readability | `1d31e518` true scale, `375dc995` and `bf979d33` LODs by edge collapse ("no more blue arrows"), `d135e898` team colour as an accent | Tap size and side readability, see C11 and T5. |
| I215 (Mediterranean town in a Bronze sack) | `23ac32a4` Bronze culture skins (10-07 22:01), `1b9e13c3` Classical culture skins | Sack of Kish setup with a Mesopotamian people. |
| I072 (camera jumps on resize) | `b1ae931b` 10-07 "Map camera: keep the place across resizes and battles" | Open and close sheets after a fly-to. Likely closable. |
| I064 (city-card attack teleports) | `13b56886` 10-07 "Attack on a far city marches there to attack it" | City card attack on a far city. Likely closable; W03 task 3 keeps the "no other teleport path" check. |
| I007 (Command falls back to Auto) | `bdc1fc28` 10-07 "Battle: never freeze on an empty field" (battleOpenGuard) | Empty-garrison defence: is the fallback now the designed guard with a reason? |
| I176, I183 (no build space, cancel taps through) | `83578fa5` 10-07 Battle UX 2 (placement ghost, context panel) | P3 still saw placement failures (R140, R142), so keep I173 to I181 open; I176 and I183 were P2 only. |
| I197 (Keep focus broken) | Works in P3 per the plan ("preserve the working P3 case") | Likely closable after one check per battle type. |
| I152, I159 (cramped decision and event cards) | `43bd61d0` 10-07 events as a centred card | Re-check at 844x340. |
| I156, I160 (End Turn moves, Safari clipping) | `5430acce` 10-07 iPhone Safari layout (`appViewport.js`, `--app-height`) | P3 still reports both, so keep open, but reuse `appViewport.js` for U03 instead of building a second viewport model. |
| I129 (capture choice) | `RazeControl.jsx` (phase W3) | Partly done: Raze exists; Free, Tributary and the shared flow do not. |

R3 battles (raids, sacks, forts, rivers, decisive pursuit) and the war screens (U1b) landed on
2026-10-06 and 2026-10-07, before both playtests, so the audit already tested them. Their rules are
what C4 to C6 must reconcile with; nothing there closes.

## 6. Same-file collisions the plan's table misses

Only collisions that force one agent or a strict order.

| File or shared asset | Batches | Consequence |
|---|---|---|
| `src/engine/resolveTurn.js` | CB03 (supply, reinforcement), CB04 (development overwrite I031), CB08 (raids), CB09 (AI), CB11 (loyalty, grace), CB14 (events) | Not in the table. Parallel work only if each batch edits its own phase; merge in a fixed order and rebase. |
| `src/engine/gameReducer.js`, `src/data/types.js` | CB02, CB03 (hold, split), CB05 (BUY_TILE, queue), CB06 (disband settlers), CB11 (capture), CB12 (government) | Append-only action types; rebase conflicts but no semantic clash. |
| `src/engine/saveMigrations.js` | CB03, CB04, CB05, CB11, CB13, phase RU | Strict order (T12). |
| `SETUP_VERSION`, battle golden fixtures, battle-bench hashes | CB01, CB10, CB15, CB16, CB17, CB18 | Table lists only CB01, CB02, CB18, CB21. One chain (T4). |
| `src/battle/sim/replay.js`, `orders.js` | CB01 plus CB15, CB16, CB18 (table lists only CB01, CB10, CB17) | After CB01 (T3). |
| `src/engine/autoBattle.js` and parityEco calibration | CB16, CB17, CB18 | Not listed. One recalibration after the battle rules chain. |
| `src/components/battle/PreBattleModal.jsx`, `battleOdds.js`, DefenseSheet | CB02 (I008), CB18 (I010, I011, I013, I213, I210) | Not listed. Same agent or CB02 first. |
| `src/components/battle/BattleResultScreen.jsx` | CB02 (receipt), CB18 (I210 text, I015 labels) | Table lists `result.js` only. CB02 first, I210 folded in. |
| `src/engine/turnBlockers.js`, `src/components/ui/nextPromptModel.js` | CB03 (I061, I062), CB06 (I093), CB11 (capture blocker), CB12 (I134), CB13 (I157), CB08 (I117) | Not listed. CB13 owns the Idle N chip and queue; others add their reasons after it. |
| `src/engine/sieges.js` | CB03 (I130), CB11 (I131), CB18 (I009) | Table lists CB03 only. CB03, then CB18, then CB11. |
| `src/engine/aiProduction.js` | CB04, CB05 (I039 naval rules for the AI), CB09 | Partly listed. CB05 eligibility first, CB09 last. |
| `src/engine/battleOutcome.js` | CB02, CB11, plus CB18 (base survived, withdrawal) and CB08 (raid adapter, truce) | Table lists CB02 and CB11 only. |
| `src/battle/art/kitLoader.js`, `BattleRenderer.js`, `battleTerrain.js` | CB20 vs unmerged `gpt/art-remaining` | Merge or reject that branch first (T6). |
| `scripts/simulate.mjs` (W00 telemetry) | every balance batch | W00 owns it; others only read. |
| `src/engine/rulers.js` | I146, I147 (CSV says `research.js`) vs phase RU | Owned by RU (C9). |

## 7. Safe parallel schedule

Each lane is one branch from `claude/integration`. "Parallel" means no shared hot file beyond
append-only action types and separate `resolveTurn.js` phases; merge in the order listed.

**Wave 0 (before code, small):**
- User answers Q1 to Q10.
- Correct the plan rows: I178 text (C2), I193 and I194 superseded (C1), I146 and I147 file path and status (C9), A14 premise (C5).
- Review and merge or reject `origin/gpt/art-remaining` (T6).
- Re-check the 15 items in section 5 on the current build; close what passes.
- W00 campaign telemetry in `scripts/simulate.mjs` (one agent).

**Wave 1 (8 lanes at once):**

| Lane | Batches | Main files |
|---|---|---|
| L1 Battle trust | CB01 (with W00 battle fixtures) | replay.js, orders.js, battleLoop.js, buildBattleSetup.js, edgeEntry.js |
| L2 Army geography | CB03 | armies.js, routes.js, marchAttack.js, supplyMeter.js, sieges.js, resolveTurn.js (supply phase) |
| L3 City economy | CB05 plus I031 and I032 from CB04 | development.js, CityPanel.jsx, gameReducer.js (BUY_TILE, queue), resolveTurn.js (dev phase) |
| L4 Panels | CB13 | useExclusivePanel.js, panel hosts, index.css, turnBlockers.js, nextPromptModel.js |
| L5 Research | CB12 engine selectors (not rulers, not the government dialog yet) | research.js, researchView.js, researchSheetModel.js, authority.js, lawRules.js |
| L6 Battle art | CB20 render-only part (I214, I215, I216, I217 after T6, I218 and U08 per Q7, I219 VAT pilot) and the CB21 baseline profile | src/battle/render/, src/battle/art/, assets; not TacticalBattleScreen.jsx |
| L7 News | CB14 | event data and selection, turnReportModel.js, LogConsole.jsx |
| L8 Diplomacy words | CB08 slice: I110, I111, I112, I118, I119 | grudges.js, opinion.js, contact text |

Merge order inside wave 1: L1, L2, L3 (rebase on L2's `resolveTurn.js`), L4, then the rest.

**Wave 2 (after wave 1 merges):**
- L1 continues: CB02 (receipt, participant ledger, result screen with I210).
- CB07 then CB06 in one lane (both edit `src/components/map/`; they need L2's selectors and L4's coordinator). Q8 deletes the globe here.
- CB08 tribute, truce and trade (needs L2 reach and L4 decision queue).
- CB04 rules (rush I019, quotes, opening builds per Q9); no tuning yet.
- CB12 UI parts (government confirm dialog, goals) on L4's coordinator.

**Wave 3 (battle rules, one chain, one agent or strictly sequential branches):**
CB18 (U10 roster per Q2, D1 to D3 per Q3 to Q5, I009, I012, I013) and, in parallel only for its
UI-only part, CB15 state machine (U02, U05, U13, I177 to I184 without the placement predicate);
then CB16 (U01 stone per Q1, I185); then CB17 with CB10 (U07, U11, I188 to I192, I125); then CB15
placement legality (I173 to I176); then CB19 (HUD, U03, U09, U12, I201 to I207); then CB20 picking
and worker cargo (U04 selection, U06 after the VAT pilot); then one Auto recalibration and parity
run; then the CB21 after-profile.

**Wave 4 (campaign finish, sequential):**
CB11 conquest (needs CB02, CB13, CB08; Q10), then CB09 strategic AI (needs CB03, CB04 rules, CB08
truce). Then balance, one at a time against one baseline: CB04 pacing, CB08 tribute numbers, CB18
auxiliary and tower balance (I211, I212), CB09 AI budgets.

**Wave 5:** W15 validation (saves, devices, naval, cloud) and the release gate.

## 8. Questions for the user (recommended answers)

1. Q1 (C7): Replace decision 35 with four battle resources: Food, Materials (wood and ore), Stone, Gold? **Recommended: yes.**
2. Q2 (C8): Without a Reserve button, should units that do not fit in 300 a side enter on their own as room frees up, in a fixed order? **Recommended: yes; 300 stays the default.**
3. Q3 (C4): Does "you lose only when your buildings are gone" apply to field battles, sallies and landings too (they all have camps), while units left on the field at the end are still lost (decision 33)? **Recommended: yes.**
4. Q4 (C5): The base is the HQ, camp or keep plus economy and military buildings; houses, landmarks, walls and unfinished sites do not count, and taking the keep still wins a city assault? **Recommended: yes.**
5. Q5 (C6): At the battle clock with buildings standing, keep today's rule (defender holds, attacker withdraws in order) instead of adding a draw? **Recommended: yes.**
6. Q6 (C3): A mixed selection moves at the slowest unit's pace by default, with a chip to release it; a single-class order always uses its own speed? **Recommended: yes.**
7. Q7 (C11): Make cannons, tanks and artillery bigger by enlarging only the machine, crews staying at human scale, and fix "tiny soldiers" with bigger tap targets rather than bigger figures? **Recommended: yes.**
8. Q8 (C10): Delete the globe and the old SVG map now (decision 28) instead of fixing their fog? **Recommended: yes.**
9. Q9 (C12): Keep Marathon as "the same game over more turns" and fix its slow opening with cheaper first builds, not a separate 2.5x production factor? **Recommended: yes.**
10. Q10 (C13): "Make tributary" on a city taken from a big nation releases it as a one-city independent that pays you tribute? **Recommended: yes.**

# Code-touch batching map for audit and follow-up requests

**Planning only.** This map covers all 238 gameplay/request IDs (I001–I224 and U01–U14), including art-primary items that need runtime integration. It complements the [implementation plan](playtest-audits-implementation-plan.md), [item-level work breakdown](playtest-audits-work-breakdown.md), [art production plan](playtest-audits-art-production-plan.md), and [238-row batch CSV](playtest-audits-code-batches.csv). The separate 54 visual requirement rows overlap these requests and are not added to the count.

## How to read this map

- A **primary batch** is where an item should be reviewed and marked complete. A **secondary batch** is a likely shared-code dependency, not a second copy of the task. The CSV gives each ID its title, primary batch, secondary batches, likely shared code, discipline, kind and size. Exactly one primary batch exists for every ID.
- Shared path means likely files or selectors to edit together, based on the current branch and the work-package plan. It does **not** prove the items share a root cause. Confirm file ownership and reproduction at implementation time; keep unrelated behavior changes in separate reviewable commits even when they touch the same file.
- A batch is a coordination area, not necessarily one commit or one session. CB06, CB08 and other broad areas should be split by invariant or user-visible slice. W00 reproduction fixtures and W15 save/accessibility/device validation apply to all batches rather than creating duplicate primary IDs.
- Art-primary rows I097, I099, I209, I215, I217, U06 and U08 are placed in the code batch that integrates or verifies them. Their model, clip and icon authoring remains in the 54-row [art manifest](playtest-audits-art-production-manifest.csv).

## Primary batches: every tracked gameplay/request item

| Batch | Items | IDs | Likely shared code | Safe co-change boundary |
|---|---:|---|---|---|
| **CB01 Battle command verification** | 3 | I001 I007 I008 | `src/battle/sim/replay.js; src/battle/sim/orders.js; src/battle/worker/battleLoop.js; src/battle/setup/buildBattleSetup.js` | Versioned command/setup and deterministic replay; preserve invalid-log evidence |
| **CB02 Battle outcome and campaign receipt** | 7 | I002 I003 I006 I012 I014-I016 | `src/engine/battleOutcome.js; src/engine/battleInputs.js; src/battle/sim/result.js; src/components/battle/TacticalBattleHost.jsx; src/components/battle/BattleResultScreen.jsx` | One participant ledger and committed receipt; verify before applying campaign effects |
| **CB03 Campaign army movement and supply** | 15 | I004-I005 I058-I069 I130 | `src/engine/armies.js; src/engine/supplyMeter.js; src/engine/resolveTurn.js; src/engine/sieges.js` | Physical position, route timing, attack/hold intent and attrition selectors |
| **CB04 Campaign economy and pacing** | 19 | I017-I035 | `src/engine/development.js; src/engine/resolveTurn.js; src/engine/aiProduction.js` | Paired seeded changes to costs, output, power/gold utility and speed pacing |
| **CB05 City quotes, queues and actions** | 18 | I036-I053 | `src/components/city/CityPanel.jsx; src/engine/development.js; src/engine/gameReducer.js` | Shared quote/charge/ETA rules and stable city queue interactions |
| **CB06 Settling and site guidance** | 20 | I054-I057 I084-I099 | `src/engine/settlers.js; src/components/map/; src/components/city/CityPanel.jsx` | One settlement mode, legal-site logic, preview/name and resource guidance |
| **CB07 World map camera, picking and fog** | 14 | I070-I083 | `src/components/map/; src/engine/sight.js; src/hooks/useExclusivePanel.js` | Camera intent, target selection, overlays, labels and fog consistency |
| **CB08 Diplomacy, tribute and trade** | 20 | I100-I119 | `src/engine/indepPolicy.js; src/engine/tradeRoutes.js; src/engine/grudges.js; src/engine/hostility.js` | Consistent treaty effects, reachability, demands and trade/intelligence |
| **CB09 Strategic AI and economy health** | 5 | I120-I124 | `src/engine/aiOperations.js; src/engine/aiProduction.js; src/engine/resolveTurn.js` | Shared goal selection, reachable paths, scouting and solvency |
| **CB10 Tactical AI** | 1 | I125 | `src/battle/sim/tacticalAI.js; src/battle/sim/orders.js` | Defender counteraction and target choice, tested under same player rules |
| **CB11 Conquest and occupation** | 6 | I126-I129 I131-I132 | `src/engine/conquest.js; src/engine/loyalty.js; src/engine/razing.js; src/engine/battleOutcome.js` | Atomic capture choice, loyalty/grace and anti-loop history |
| **CB12 Research, government and goals** | 18 | I133-I150 | `src/engine/research.js; src/engine/gameReducer.js; src/components/panels/researchView.js` | Shared availability/ETA, authority disclosure and goal progress |
| **CB13 Campaign panels and phone controls** | 19 | I151-I169 | `src/hooks/useExclusivePanel.js; src/components/panels/; src/index.css` | One active panel/decision queue, stable controls and safe-height layout |
| **CB14 Events, history and turn reports** | 7 | I170-I172 I221-I224 | `src/engine/resolveTurn.js; src/components/; event data and turn-report models` | Context prerequisites, cooldowns, concise news and correct text |
| **CB15 Battle build placement and worker UI** | 17 | I173-I184 I186-I187 U02 U05 U13 | `src/components/battle/TacticalBattleScreen.jsx; src/components/battle/EconomyHud.jsx; src/battle/sim/economy.js; src/components/battle/inspectModel.js` | One build-sheet/ghost/cancel state machine with sim-backed legality |
| **CB16 Battle resources, housing and training** | 3 | I185 U01 U14 | `src/battle/data/economy.js; src/battle/sim/economy.js; src/battle/setup/economySetup.js; src/components/battle/EconomyHud.jsx` | Stone stock and costs; trace village-house +100 report against existing +10 cap |
| **CB17 Battle targeting, movement and speed** | 7 | I188-I192 U07 U11 | `src/battle/sim/orders.js; src/battle/sim/movement.js; src/battle/sim/tacticalAI.js; src/components/battle/TacticalBattleScreen.jsx` | One stance/threat-response contract; measure class and grouped travel |
| **CB18 Battle roster, objectives and siege rules** | 14 | I009-I011 I013 I193-I195 I202 I208 I210-I213 U10 | `src/battle/setup/buildBattleSetup.js; src/battle/sim/objectives.js; src/battle/sim/result.js; src/components/battle/BattleHud.jsx` | Full starting roster, objective truth, auxiliaries and siege balance |
| **CB19 Battle HUD, camera and cutout layout** | 14 | I196-I201 I203-I207 U03 U09 U12 | `src/components/battle/TacticalBattleScreen.jsx; src/components/battle/BattleHud.jsx; src/components/battle/EconomyHud.jsx; battle camera/renderer` | Space-safe HUD, compact ability sheet, navigation and visible supply |
| **CB20 Battle art and runtime presentation** | 10 | I209 I214-I219 U04 U06 U08 | `src/battle/render/; src/assets/battle/; src/components/battle/; art production manifest` | Asset repair/selection plus renderer integration, picking and animation state |
| **CB21 Battle load and startup performance** | 1 | I220 | `src/battle/worker/battleLoop.js; src/battle/setup/buildBattleSetup.js; src/battle/render/` | Profile cold/warm setup, asset load and worker start before optimization |

**Coverage:** 238 unique IDs in 21 primary batches. 94 IDs also list a secondary batch; these links are useful for scheduling and regression checks, not additional tasks.

## Highest-collision code areas

| Code area | Batches that meet there | Batch together or coordinate because |
|---|---|---|
| `src/components/battle/TacticalBattleScreen.jsx` | CB15, CB17, CB19, CB20 | Selection, build ghost, order target, camera and model picking share input state. Land one interaction-state contract before stacking UI controls. |
| `src/components/battle/BattleHud.jsx` and `EconomyHud.jsx` | CB15, CB16, CB18, CB19 | Build launcher, resource/housing numbers, starting roster and ability/supply controls compete for the same 844×340 layout. Test the full HUD after each slice. |
| `src/battle/sim/economy.js` and `src/battle/data/economy.js` | CB15, CB16, CB18, CB20 | Placement, gathering, stone prices, housing cap, worker cargo and renderer events share catalog/state fields. Version resource/setup changes; U14 is diagnosis first because the rule already says +10. |
| `src/battle/sim/orders.js`, movement and tactical AI | CB01, CB10, CB17 | Admission, replay, stance, threat response and AI commands must share legal order semantics. A new external order needs verifier coverage in the same change. |
| `src/battle/setup/buildBattleSetup.js`, objectives and result | CB01, CB02, CB18, CB21 | Full initial roster and objective/siege changes alter the setup identity, result ledger, replay and load performance. Coordinate rule versions and parity. |
| `src/engine/battleOutcome.js` | CB02, CB11 | A victory receipt and pending capture choice must commit once; conquest must not independently repeat battle rewards or ownership effects. |
| `src/engine/armies.js`, `supplyMeter.js`, map picking | CB03, CB06, CB07, CB09 | Physical tile, route ETA, settlement eligibility, idle/AI planning and co-location need the same position/sight selectors. |
| `src/engine/development.js` and `CityPanel.jsx` | CB04, CB05, CB06 | Price, charged amount, ETA, output, queue and settlement growth must agree. Keep quote helpers shared and benchmark pacing after any cost change. |
| `src/hooks/useExclusivePanel.js` and panel hosts | CB07, CB11, CB12, CB13, CB14 | City, capture, research and event decisions should use one stable active/queued interaction model; keep mandatory decisions durable. |
| `src/engine/indepPolicy.js`, `tradeRoutes.js`, `aiOperations.js`, `loyalty.js` | CB08, CB09, CB11 | Tribute pressure, reachable war goals, trade safety and occupation recovery must use consistent attitude, reachability and owner history. |
| `src/battle/render/` and asset loading | CB19, CB20, CB21 | Bigger heavy units, improved trees, tool animations and phone lighting affect picking, LOD and load time; accept art at real-camera/device budgets. |

## Proposed implementation slices

1. **Freeze evidence and contracts.** W00 fixtures first. CB01 command/setup schema, CB02 receipt/participant ledger and CB18 starting roster/objectives must agree before a new battle rules version is committed. U10 crosses all three, plus CB19 HUD and CB10 AI.
2. **Stabilize battle interaction.** CB15 owns the worker build sheet, placement ghost and cancel precedence (I173–I184, U02/U05/U13). CB16 owns stock/housing/training (I185, U01, U14); connect them through one catalog/state API. CB17 owns order/stance response (I188–I192, U07/U11). CB19 lays out the combined HUD after these contracts exist.
3. **Integrate visual work and performance.** CB20 consumes the art plan for tree picking/graphics, worker cargo/tools and heavy-unit silhouettes. CB21 profiles startup before and after asset changes. Art-only source revisions and gameplay renderer changes may be reviewed separately, but their acceptance scene is shared.
4. **Stabilize campaign selectors and panels.** CB03 fixes physical army position/movement; CB07 and CB06 reuse it for picking and settlement. CB13 supplies the one-active-panel/mandatory-decision pattern used by CB05 city, CB11 conquest, CB12 research and CB14 event UI.
5. **Tune connected rules with seeded baselines.** CB04 economy pacing and CB05 quotes/queues share measures; CB08 diplomacy, CB09 strategic AI and CB11 occupation share reachability and historical consequences. Run the W15 save/replay, phone, fog and long-run gates on the affected slices.

## Important cross-batch safeguards

- **U01 stone:** CB16 owns the distinct account and spending; CB15 build quotes, CB18 setup/AI, CB19 top bar and CB01 replay/schema must change together under a versioned contract. Do not ship a stone icon before stock accounting is authoritative.
- **U10 no manual reserves:** CB18 owns full initial deployment, while CB01 records/replays it, CB02 conserves survivors, CB10/CB17 update AI/order assumptions and CB19 removes the old control. Legacy replays retain their old rules version.
- **U14 house +10:** CB16 first measures the sim and HUD before/after one house. Existing `HOUSE_HOUSING = 10`, building housing and build detail already say +10. If the observed +100 comes from a city manifest or duplicate registration, fix that owner and keep the displayed cap and training rule synchronized.
- **I001–I003 battle mismatch:** CB01 proves commands/setup; CB02 owns the committed receipt. Passing only a UI screenshot or only a replay hash is insufficient.
- **I126–I132 conquest loops:** CB11 owns the capture/loyalty transaction, with CB02 battle outcome and CB13 decision persistence as required interfaces; do not paper over recurring ownership/reward loops with notification changes.

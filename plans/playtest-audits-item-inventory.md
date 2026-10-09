# Full item-level audit inventory

Planning only. Rechecked against all three audit files at baseline `0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091`.

## Corrected count and method

**224 individually checkable gameplay items** are cataloged below. The main audit has **42 labeled headings**, many of which bundle several issues; those headings are not the full issue count. The raw log has **165 data rows**, which contain a mixture of issues, successful tests, notes, requests and corrections. Neither 42 nor 165 is a count of all distinct actionable behaviors.

Counting rule: one item for a separately testable behavior or decision; merge repeat observations across sessions; split compound rows when one fix/check could pass while another still fails. Shared root causes can address several items. These are not 224 independently confirmed bugs or 224 separate code changes. The number depends on the stated granularity.

| Classification | Count | Meaning |
|---|---:|---|
| Reported defects | 55 | Observed incorrect behavior; reproduction and source verification remain part of implementation. |
| UX issues | 108 | Clarity, discoverability, readability or interaction problems. |
| Balance concerns | 31 | Measured or reported pacing/strategic concerns requiring calibration. |
| Feature/design requests | 16 | Requested changes; proposal does not establish approved final tuning. |
| Investigations | 14 | Probable/ambiguous observations or conflicting evidence requiring diagnosis. |
| **Gameplay total** | **224** | Excludes the separate lists below. |

Also tracked separately: **8 commercial/product entries**, **9 explicitly untested areas**, and the plan's **22 additional analysis risks** (A01–A22). These are not added to the gameplay total. Passing checks and the retracted missing-Cyrene-report allegation are not counted as defects. **Thirteen later player requests**, U01–U13, are now tracked in [implementation plan §12](playtest-audits-implementation-plan.md#12-player-follow-up-rts-and-iphone-layout). They came after the source audits and do not change the 224-item audit baseline.

Links: [implementation plan](playtest-audits-implementation-plan.md), [item CSV](playtest-audits-item-inventory.csv), [original test-log coverage CSV](playtest-audits-coverage.csv). Each CSV source reference can be checked against [Playtest 2](playtest-2-report.md), [Playtest 3 audit](playtest-3-audit.md), or [raw log](playtest-3-test-log.md).

P2 refers to the earlier report, including its second session; P3 refers to the main audit; R<number> refers to the original log row. C/H/M/L labels are retained as cross-references. Work-package details and priorities remain in the main plan. All entries remain planned, not implemented.

## Items by domain

| Domain | Count |
|---|---:|
| Battle outcome and campaign consistency | 16 |
| Economy, production and opening pace | 19 |
| City panels, queue integrity and resource actions | 22 |
| Army geography, movement and world-map interaction | 26 |
| Settling, map lenses and resource visibility | 16 |
| Diplomacy, raiding, trade and AI | 26 |
| Conquest and siege consequences | 7 |
| Research, government, rulers and goals | 18 |
| Panels, phone layout and general interaction | 22 |
| Battle placement, controls and feedback | 38 |
| Battle balance, art and content | 14 |

### Battle outcome and campaign consistency

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I001 | Defect | Victory becomes campaign defeat | C1; R158 | W01,W02 | Displayed verdict, verified result, campaign ownership/control and log agree for the same operation. |
| I002 | Defect | Casualty totals disagree between battle and report | C1; R158; P2 §7 | W02 | One participant ledger reconciles displayed men, losses, survivors and temporary troops without scale errors. |
| I003 | Defect | Dead regiments survive or surviving regiments regain strength | C2; R103; R113; R113b; R158; P2 session 2 | W02,W03 | Every campaign participant retains precisely its verified disposition and strength before legal later recovery. |
| I004 | Investigation | Zero-supply army persists without observed attrition | C2; R119 | W03 | Trace the actual turn phases and explain or fix persistence; do not delete units solely for a timer. |
| I005 | UX | Supply explanation contradicts an empty supply meter | R119 | W03 | Separate meter drain, supply-line reach, refill and attrition in a forecast matching actual changes. |
| I006 | Defect | Successful sack reported as city held with damaged nonexistent walls | R57 | W02,W06 | Raid success, conquest and actual damage generate distinct accurate result headlines. |
| I007 | Defect | Command silently falls back to Auto for an empty garrison | P2 §7 | W06 | Command availability and militia/setup validity are resolved and explained before mode selection. |
| I008 | Defect | Pre-battle force estimates disagree with actual battle participants | P2 §7; R91 | W02,W06 | Card, setup and result use consistent participants and explicit uncertainty/units. |
| I009 | Defect | Wall descriptions disagree between army, independent and pre-battle views | M14; R82; P2 session 2 | W06 | Separate fortification tier, siege endurance, gate/wall HP and keep HP using one shared model. |
| I010 | UX | Numerical Auto odds appear only after battle | M11; R103; R157 | W06 | Show the estimated Auto percentage before choosing a mode, labeled separately from Command prospects. |
| I011 | UX | Hopeless defense starts without adequate warning | P2 §7 | W06 | Show odds and consequences; provide an appropriate default while preserving an intentional Command choice when playable. |
| I012 | Defect | Retreat orders whole-battle forfeiture instead of selected withdrawal | H8; R103; P2 §7 | W06 | Selected withdrawal moves selected squads to exits and does not cancel the entire army operation. |
| I013 | UX | Whole-army withdrawal has no confirmation | H8; R103; P2 §7 | W06 | A separate whole-army command previews consequences and requires an in-game confirmation. |
| I014 | Request | Army elimination ends an economy battle despite surviving buildings | P2 §7 user rule; P3 §6 | W06 | Resolve eligible-building and stalemate definitions; living eligible bases can continue recruiting after troop loss. |
| I015 | UX | Battle-trained auxiliaries disappear without adequate explanation | R157; P3 §6 | W06 | Training and results explicitly distinguish temporary auxiliaries from persistent campaign regiments. |
| I016 | Investigation | One-round Auto replay provides little useful information | R58 | W02,W14 | Prefer an honest immediate summary for a one-round outcome; retain replay access without inventing tactical detail. |

### Economy, production and opening pace

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I017 | Balance | Gold accumulates without worthwhile spending | H1; R104; R129; P2 §2 | W07 | Viable spending and saving goals compete meaningfully across early and late campaign fixtures. |
| I018 | Balance | ADM/DIP/MIL accumulate while actions remain trivial | H1; R63; R104 | W07,W09,W10 | Each power pool has useful bounded choices whose costs and effects remain relevant over time. |
| I019 | Request | No gold purchase or hurry-production action | H1; R52; R54; P2 §2 | W07,W08 | A shared premium rush quote enforces prerequisites, stocks, manpower, progress and refund conservation. |
| I020 | UX | Existing spending options are difficult to discover | P2 §2; R54 | W07,W08 | Treasury/city views link to relevant spending choices and correctly explain gold versus power costs. |
| I021 | Balance | Infrastructure and defense costs/effects become negligible | H1; R129 | W07 | Era and repeat-value tuning makes existing investment relevant without charging by saved treasury. |
| I022 | Balance | Balanced focus produces disproportionately poor early output | H9; P2 §2 | W07 | Compare allocation strategies with food constraints; early production is viable without mandatory hidden focus knowledge. |
| I023 | UX | Focus changes at small city sizes show no effect or reason | H9; R22; R50 | W07,W08 | Explain locked tiles, food needs and limited workforce; preview any actual yield delta. |
| I024 | Balance | Marathon timing creates excessive waits across systems | P2 §2 | W07 | Compare speed schedules for production, research, growth, movement and events with paired scenarios. |
| I025 | Balance | Settler costs escalate too sharply with city count | P2 §2 | W07 | Expansion retains a cost without making new-city production unusable; compare early expansion and runaway growth. |
| I026 | Balance | New cities take 80–170 turns to build useful infrastructure | H9; R49; P2 §2 | W07 | Viable starts get a reasonable first-build path while poor terrain remains a meaningful tradeoff. |
| I027 | UX | No warning or alternative for extremely long builds | H9; R49 | W07,W08 | Offer speed-adjusted ETA guidance and actionable alternatives once, without recurring nagging. |
| I028 | Balance | Early versus late production costs have inconsistent pacing | H9; R130; P3 §6 | W07 | Calibrate era reference costs against output and intended decision intervals; avoid penalizing an individual productive city. |
| I029 | Balance | Long early and late stretches contain no meaningful decisions | P2 §2; P3 §8 | W07,W09,W11,W14 | Measure optional-action gaps and improve exploration, investment and goals rather than merely increasing event spam. |
| I030 | Balance | Research advances while other campaign systems stagnate | P2 §2 | W07,W09 | Compare technology progress with production, expansion and unit availability at matching calendar checkpoints. |
| I031 | Defect | Purchased development is overwritten on later turns | P2 §2; R129; P3 §6 | W07 | Persistent investment survives turn resolution, focus changes, save/load and lawful ownership transitions. |
| I032 | Investigation | Invest in growth produces no visible size/progress effect | P2 §2; P2 §5 | W07 | Show people/food progress and housing limits before purchase; prove the paid effect persists across turns. |
| I033 | UX | Advisor hire prices differ without explanation | R41 | W07,W09 | Display the full current quote and why first/additional hire or advisor prices differ. |
| I034 | UX | Power-point purpose and balances are hidden | P2 §6 | W07,W09 | Provide compact balance access and descriptions linking ADM/DIP/MIL to their actual actions. |
| I035 | Request | Unlimited expansion may need administrative pressure | P3 §6 user note; R121 | W07,W11 | Evaluate existing upkeep and overextension before adding a visible calibrated soft capacity; no hidden hard city cap. |

### City panels, queue integrity and resource actions

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I036 | Defect | Buy-land quote is lower than the charged price | M18; R55; P2 §2 | W08 | Shared quote/eligibility inputs include research discounts and match the exact debit. |
| I037 | Investigation | Bought iron tile apparently remains in the purchase list | R55 | W08 | Record tile IDs; remove the purchased candidate immediately or distinguish a different same-resource tile unambiguously. |
| I038 | UX | Buying resource land does not explain extraction requirements | M18; R55; R64 | W08 | Show required mine, technology and working status before purchase and afterward in resource flow. |
| I039 | Defect | Inland river/oasis cities offer seagoing ships | M8; R51; P2 §4 | W08 | Coast/launch eligibility is identical in catalog, quick-build, advisor, AI, rush and reducer. |
| I040 | Defect | Coast-required harbor remains queueable inland | M8; R128 | W08 | An ineligible harbor has a reason and every execution path rejects it consistently. |
| I041 | UX | Improvement rows are indistinguishable duplicates | M7; R51; P2 §4 | W08 | Each entry identifies its tile, direction/distance, terrain/resource and intended effect. |
| I042 | UX | Improvement choice lacks a map highlight | P2 §4; P3 §7 | W08,W13 | Inspecting an improvement highlights the exact affected tile in the usable map area. |
| I043 | UX | Building and upgrade effects are absent | M9; R128; P2 §5 | W08 | Every building/tier shows current-to-next effects, prerequisites, cost and upkeep. |
| I044 | UX | Building/catalog row taps are inert and action arrows are too small | M9; R128; P2 §5 | W08 | Row opens useful details and a stable adequately sized button performs the explicit queue action. |
| I045 | Defect | Build-list reflow queues wrong items or loses repeated taps | M7; R23; R130 | W08 | Rapid repeated taps keep the same target and record accepted actions or visible queue-limit responses. |
| I046 | Request | Production queue cannot be reordered or moved to front | M7; R52 | W08 | Accessible move-up/down/front preserves item identity and defined progress. |
| I047 | UX | Removing or switching production silently loses progress | M7; R52 | W08 | Disclose and enforce progress/refund rules; reordering does not destroy progress or duplicate it. |
| I048 | UX | Queue additions lack feedback and queue is offscreen | M7; R53; P2 session 2 | W08 | A visible compact queue/count confirms each accepted addition without disruptive scrolling. |
| I049 | UX | City panel leaves only about three build rows visible | P2 session 2 | W04,W08 | Compact layout increases useful list space at 844×340 while retaining touch targets and queue access. |
| I050 | Defect | Quick-build buttons appear available but do nothing | P2 §5 | W08 | Eligibility is correct and every enabled quick-build acts; unavailable actions explain why. |
| I051 | UX | Focus row is below the fold despite its importance | P2 session 2; P3 §7 | W08 | Focus and its projected effect are visible at the top of the city overview. |
| I052 | Defect | City rail ETA differs drastically from queue ETA | P2 §5 | W08 | Both surfaces use the same current production and remaining-cost calculation. |
| I053 | UX | City Defense tab provides no actionable path | P2 §5 | W08 | Link available garrison/fortification actions or clearly state the informational role. |
| I054 | UX | Founding promises a city but creates an unexplained outpost | R68; P2 §4 | W08,W13 | Founding preview and city view explain stage, maturation and growth blockers. |
| I055 | UX | New settlement only shows an unexplained tent | P2 §4; P2 §8 | W08,W14 | Use an intentional readable settlement-stage visual with consistent stage explanation. |
| I056 | UX | Founded name differs from the previewed site name | R40 | W08,W13 | Differentiate location/site label from the proposed city name before confirmation. |
| I057 | UX | Settlers are displayed as combat recruits with morale/strength | R48 | W03,W08 | Civilian unit cards show founding, travel and relevant status rather than misleading combat roles. |

### Army geography, movement and world-map interaction

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I058 | Defect | Army location and march origin use a stale home city | M4; R26; R30; R33; R82; P2 §4 | W03 | Physical location, base assignment and march origin are distinct and accurate. |
| I059 | Defect | City Armies here lists physically distant units | R34 | W03 | Membership follows actual co-location rather than a shared base/legacy region ID. |
| I060 | Request | City movement controls cannot split or select individual units | R34 | W03 | Select and split co-located units without moving every unit assigned to a city. |
| I061 | Defect | Marching and besieging armies are incorrectly idle | R32; R83; P3 §7 | W03,W04 | Idle selectors exclude all active movement, siege, hold and guard orders. |
| I062 | Request | Map has no explicit Hold order suppressing idle alerts | R139; P3 §7 | W03,W04 | Hold persists visibly until canceled and excludes the unit from idle cycling. |
| I063 | Defect | Attack prompt claims adjacency when target is several turns away | P2 §4 | W03 | Prompt and engine use the same physical adjacency and route facts. |
| I064 | Defect | City-card invasion bypasses travel distance | P2 §2; P2 §4 | W03 | All invasion paths spend legal movement or create a march-to-attack order. |
| I065 | Defect | Move now arrives sooner than its route ETA predicts | M17; R120 | W03 | ETA includes movement available now and agrees with actual arrival under terrain and supply constraints. |
| I066 | UX | Ordinary marches wait until End Turn without clear timing | P2 §4; R120 | W03 | Explain scheduling versus Move now and retain the working immediate-movement option. |
| I067 | Defect | No clear attack action for moving raid parties | R74 | W03,W13 | Known hostile army targets offer attack/intercept or an explicit legality/reach reason. |
| I068 | UX | Attack routes omit the supply estimate shown on ordinary routes | R75 | W03 | Both route modes show the same supply-cost/remaining-supply forecast. |
| I069 | Balance | Early supply depletion shuts down exploration | P2 §2; P2 §4 | W03,W11 | Provide a costed viable scouting/resupply path without making armies ignore logistics. |
| I070 | UX | Map unit movement jumps between tiles | P2 §4 | W03 | Interpolate rendered travel while preserving authoritative turn-based positions and arrival timing. |
| I071 | UX | March preview/order lines are overly thick and noisy | P2 §4 | W03,W13 | Route stroke width and contrast remain readable without obscuring terrain across zooms. |
| I072 | Defect | Camera jumps to an old target when sheets resize or close | P2 §4 | W13 | Consume explicit focus intent once; ordinary layout changes preserve location. |
| I073 | UX | Opening a city from Cities does not center it | L10; R131 | W13 | An explicit city-open action focuses that city within the remaining visible map area. |
| I074 | Defect | Strategic city icons ignore taps in march mode | L10; R132 | W13 | Picking works for the same target at strategic and closer zoom levels. |
| I075 | UX | One world-map wheel step zooms excessively | R132 | W13 | Tune continuous zoom increments so the target remains predictable and selectable. |
| I076 | UX | Army banner on a city selects the city instead | P2 session 2 | W13 | Resolve overlapping army/city targets with priority or an explicit compact chooser. |
| I077 | UX | Owned-terrain taps force city opening instead of tile inspection | P2 §4 | W13 | Provide intentional tile inspection without losing convenient city selection. |
| I078 | Defect | Fogged borders form a disconnected closed ring | P2 §4 | W13 | Territory seams respect visibility and wrapping without inventing or revealing borders. |
| I079 | Investigation | Globe may reveal unexplored political territories | R4 | W13,W15 | Compare globe render, labels and picking with the flat-map sight policy and fix proven leaks. |
| I080 | UX | World-zoom labels and raid names overlap | R7; R109 | W13 | Declutter by zoom/priority with access to hidden labels through selection. |
| I081 | UX | HUD buttons hide map city labels | R31 | W13 | Label placement accounts for controls and the free visible map area. |
| I082 | UX | Independent cities look like major cities | L8; R25 | W13 | Badges visibly distinguish polity type without relying only on color. |
| I083 | UX | March instruction banner covers the route preview | P2 session 2 | W04,W13 | Move or collapse the banner so route, destination and remaining map controls stay visible. |

### Settling, map lenses and resource visibility

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I084 | Defect | Supply lens prevents entering settlement mode | M5; R44 | W13 | Activating settlement explicitly transitions tools and restores passive lenses deliberately. |
| I085 | UX | Research boost Map action moves/switches lens without useful feedback | M5; R43 | W09,W13 | Focus and highlight an eligible road/boost target; name the activated lens and next action. |
| I086 | Defect | Settlement lens disappears after invalid tap or closing sheet | M6; R37; P2 session 2 | W13 | Keep settlement mode active until explicit cancel or successful commitment. |
| I087 | UX | Settlement mode does not center on the chosen settler | M6; R69 | W13 | Select and focus the relevant settler rather than stale map context. |
| I088 | UX | Nearest legal/good sites are undiscoverable or behind sheets | M6; R39; R45 | W13 | Offer known reachable ranked sites and fit selected candidates into free viewport space. |
| I089 | UX | Green/red settlement eligibility is faint at strategic zoom | R69 | W13 | Eligibility remains distinguishable at strategic zoom, with contrast and non-color cues. |
| I090 | UX | Found-city button is clipped or below the usable footer | R38; P2 session 2 | W04,W13 | Keep the commitment action reachable in the visible-height layout without sideways scrolling. |
| I091 | UX | Zero-yield or growth-locked sites have no warning | M6; R56; R126 | W08,W13 | Preview starvation/growth/production constraints while permitting an informed challenge choice. |
| I092 | Balance | Advisor keeps suggesting settlers after viable land is exhausted | R126; P2 session 2 | W07,W11,W13 | Recommendations consider known reachable settlement quality and available alternatives. |
| I093 | Request | Extra settlers cannot be disbanded and monopolize helpers | M6; P3 final state | W03,W13 | Expose deliberate Disband and Hold with explicit consequences and correct idle counts. |
| I094 | UX | Spacing distance display does not explain water/grid exceptions | R46 | W13 | Explain eligibility from the shared distance rule rather than contradictory rounded distance text. |
| I095 | UX | Settler route is not rendered | P2 §4 | W03,W13 | Show route, destination, ETA and cancel state for traveling settlers. |
| I096 | UX | Future Oil resources appear in ancient site cards | L4; R46; P2 §4 | W13 | Apply an explicit discovery/era policy consistently in map, site and purchase views. |
| I097 | UX | Wheat, cotton and papyrus lack map icons | P2 §4 | W13,W14 | Every intended visible resource has a legible consistent icon or deliberate documented fallback. |
| I098 | Balance | Resource density may undermine scarcity and site choice | P2 §4 | W13 | Measure regional concentration and strategic scarcity before changing generator density. |
| I099 | UX | Settler and resource icons are too small/inconsistent | P2 §4; P2 §8 | W13,W14 | Scale icons consistently across zooms and keep civilian/resource identity recognizable. |

### Diplomacy, raiding, trade and AI

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I100 | Balance | Tribute demands recur excessively | H2; R36; R122; R164; P2 §2 | W10 | Per-pair cooldown and global incoming-demand pacing prevent repetitive taxation. |
| I101 | Balance | Demand amount scales mechanically with saved treasury | H2; R122; R162 | W10 | Price credible reachable pressure and ability to pay without penalizing every saved gold piece. |
| I102 | Balance | Friendly trade partners still make coercive demands | H2; R162 | W10 | Relationships/treaties constrain demands or an explicit breakdown explains the change. |
| I103 | Defect | Paying protection does not prevent same-turn war | H2; R123 | W10 | Payment and protection commit atomically and invalidate conflicting queued hostile actions. |
| I104 | Investigation | Paying tribute has no visible promised opinion benefit | H2; R72; R80; R122 | W10 | Preview and reconcile the actual opinion delta and protection scope without promising unconditional friendship. |
| I105 | Defect | Peace treaty chip remains beside AT WAR for the same pair | R123 | W10 | Display one consistent relationship state or a clearly labeled treaty breach. |
| I106 | UX | Independent refusal threatens raids when none are reachable | P2 §2 | W10 | Threat wording reflects actual reach and distinguishes future hostility from an immediate raid. |
| I107 | Balance | Delayed independent raids arrive in overwhelming synchronized waves | P2 §2 | W10,W11 | Bound pressure/cadence and test refusal histories without making raids harmless. |
| I108 | Balance | Recurring tribute offers near-total safety for a trivial price | R65; P2 §2 | W10 | Compare recurring protection cost/value with raids and other diplomacy under explicit truce rules. |
| I109 | Balance | Remote majors demand tribute without credible local pressure | R72 | W10,W11 | Require meaningful reach/deployable force or a clearly defined diplomatic leverage basis. |
| I110 | Defect | Defending against a sack is blamed as offensive soldier killing | M10; R65 | W10 | Grievance attribution records initiator, defender, casualties and attack type truthfully. |
| I111 | UX | Warm attitude conflicts with active raiding | M10; R65 | W10 | Present cultural affinity and immediate hostility coherently and match resulting actions. |
| I112 | UX | Opinion Why shows only unexplained Standing | L5; R60 | W10 | Explain the components and reconcile them to the displayed total. |
| I113 | Balance | Trade route stays unprofitable from perpetual plunder | M3; R116 | W10 | Model a viable route or explicit suspension and measure downtime/value conservation. |
| I114 | UX | Blocked trade offers no visible cause or recovery action | M3; R67; R116 | W10 | Show known obstruction and feasible escort, repair, alternate-route, access or cancel options. |
| I115 | UX | Plunder repeats as an identical log line every turn | M3; R112; R116 | W10,W14 | Summarize sustained blockage while surfacing new threats and restoration events. |
| I116 | Request | Map/intelligence trading is missing | R62; P2 §6 | W10 | Scope an explored-map snapshot exchange with clear value and no live hidden-information leakage. |
| I117 | UX | War declaration is easily missed | R88 | W04,W10 | Deliver a persistent actionable war notice without destroying the current mandatory choice. |
| I118 | Defect | First-contact narrative credits scouts that do not exist | L9; R71 | W10,W14 | Generate text from actual contact cause or truthful neutral encounter wording. |
| I119 | UX | Scheduled independent emergence is described as expansion | P2 §3 | W10,W14 | Distinguish a new polity arriving from an existing city founding another settlement. |
| I120 | Balance | Major armies stage or pile up without pursuing war goals | H3; R121; R124 | W03,W11 | Reachable supplied operations advance or visibly retarget/recover within bounded time. |
| I121 | Investigation | White peace claims exhaustion after a war with no activity | H3; R124 | W11 | Trace actual costs and duration; explain real burden or fix the stalled operation/peace rationale. |
| I122 | Balance | AI has no effective peacetime exploration and contact remains sparse | H3; R59; R111; R159; P2 §3 | W11 | Costed visible scouting/resupply expands contacts appropriately for geography without omniscience. |
| I123 | Investigation | Early AI expansion looks weak in one speed but strong in another | P2 §3; R121; P3 §5 | W07,W11 | Compare scenario/speed checkpoints before choosing expansion buffs or penalties. |
| I124 | Balance | AI bankruptcy causes repeated civil-war/rebellion cycles | P2 §3; P2 session 2; R121 | W07,W11 | Budget and recovery rules avoid pathological collapse while retaining justified unrest. |
| I125 | Balance | Tactical defenders rarely sally or counterattack intelligently | P3 §5; R86 | W06,W11 | AI evaluates exposed camps/siege forces and favorable sallies with the same information/resource rules. |

### Conquest and siege consequences

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I126 | Balance | Conquered cities rapidly rebel despite attempted occupation measures | H4; R163; P2 §2 | W12 | Reasonable real garrison/governor/control investment materially improves retention with a bounded grace period. |
| I127 | UX | Loyalty/rebellion danger is only visible in the log | H4; R163 | W04,W12 | Surface forecast and actionable warnings with time to make an available response. |
| I128 | UX | Capture or surrender changes ownership without a noticeable receipt | R87; R161 | W04,W12 | Announce the ownership transition and its consequences exactly once, including after reload. |
| I129 | Request | No Conquer/Raze/Tributary/Free decision after capture | H4b; R165 | W12 | All eligible battle/surrender capture paths open the same durable disposition choice with effects and disabled reasons. |
| I130 | Defect | Adjacent armies automatically begin sieges without an order | R29; P2 session 2 | W03,W06 | Hostile siege intent is explicit; calling off an assault does not silently create a new siege order. |
| I131 | Balance | Healthy garrison surrenders at zero siege HP without meaningful cost | M12; R86 | W06 | Surrender considers supply, morale, isolation and force; waiting carries credible risks and costs. |
| I132 | Balance | Repeated surrender and rebellion recreates the same conquest loop | H4; R161; R163; P2 session 2 | W12 | Coordinate unrest/loyalty/restoration and bound repeated transition/reward/reset behavior. |

### Research, government, rulers and goals

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I133 | Defect | Research ETA ignores historical availability gates | M1; R105; R127 | W09 | Show calendar wait and science readiness using the actual speed/calendar schedule. |
| I134 | UX | Advisor mode fails to explain waiting when all technologies are gated | M1; R105 | W09 | Expose waiting/next availability and resume automatically without a false player-action blocker. |
| I135 | Defect | Choose research prompt appears while research is active | R6; R76; P2 §6 | W09 | One shared status drives helpers, Empire, top bar and Research. |
| I136 | Defect | Empire says nothing researched despite active progress | P2 §6 | W09 | Display the same active research/progress as the engine and research panel. |
| I137 | UX | Research panel shows an apparently wrong current age | P2 §6 | W09 | Distinguish calendar age and expertise consistently or fix the incorrect heading. |
| I138 | UX | Fund Scholars hides its expected benefit | R42; P2 §6 | W07,W09 | Preview science added, banked value and turns saved before payment. |
| I139 | Defect | Government change hides authority loss and law lockout | M2; R107 | W09 | Projected stability, authority and threshold effects match committed state. |
| I140 | UX | Government change applies immediately without informed confirmation | M2; R107 | W09 | Confirm the full projected consequences of a high-impact switch in an in-game dialog. |
| I141 | UX | Government switch silently chooses reforms | R107 | W09 | Let the player choose or clearly preview the actual default reform package. |
| I142 | UX | Laws show cost but not effects or comparisons | R108 | W09 | Explain current/proposed effects, eligibility and dependencies for every law. |
| I143 | Defect | Empire collapsible headers are not accessible buttons | R106 | W04,W09 | Use named keyboard-operable controls with correct expanded state and focus behavior. |
| I144 | UX | Authority appears twice without distinct purpose | P2 §6 | W04,W09 | Consolidate duplicate presentation or label separate contexts meaningfully. |
| I145 | UX | Advisor names repeat ambiguously | P2 §6 | W09 | Differentiate same-name advisors so selection and assignment are unambiguous. |
| I146 | Balance | Rulers change too quickly to develop strategic significance | L6; R117; P2 §2 | W09 | Compare reign duration across speeds and preserve enough useful turns for traits to matter. |
| I147 | Defect | Ruler successions are absent from history | L6; R117 | W09,W14 | Log every succession with identity and meaningful changed effects. |
| I148 | UX | Military unit names are anachronistic for the shown era/date | L4; R133 | W09,W14 | Apply a consistent explicit unlock/name policy and explain any intentional technological divergence. |
| I149 | UX | Era goals are buried instead of guiding play | P3 §8 | W09,W14 | Offer an optional compact map goal tracker linking to clear progress and next actions. |
| I150 | UX | Achievements lack progress bars or measurable progress | R114 | W09 | Show progress for incremental achievements and clear binary status where a bar is inappropriate. |

### Panels, phone layout and general interaction

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I151 | UX | Multiple panels obscure most of the world map | H5; R24; R57; R109; R110; P2 §9 | W04 | One active constrained-layout interaction retains usable map context and queued secondary notices. |
| I152 | Defect | Decision cards squeeze to narrow one-word columns | H5; R73; R79; P2 §10 | W04 | Viewport-level cards have readable responsive width and no horizontal overflow. |
| I153 | Defect | Mandatory decisions disappear when another decision opens/closes | R81 | W04 | Stable queued decision IDs survive tribute responses and overlay changes until resolved or explicitly invalidated. |
| I154 | UX | Closed pre-battle card is difficult to rediscover | R90 | W04,W06 | A persistent pending-battle indicator reopens the unresolved choice without hunting through army sheets. |
| I155 | UX | Closing a city panel reveals an underlying card requiring another close | P2 §5; P2 session 2 | W04 | One close returns to map; any navigation history is explicit rather than auto-restored layers. |
| I156 | Defect | End Turn and helper chips move when sheets open | R24; P2 §9; P2 session 2 | W04 | Anchor controls so an in-flight tap cannot hit a different action after layout changes. |
| I157 | Request | Several idle notifications crowd the screen | R138; P3 §7 | W04,W05 | One Idle N control cycles a stable eligible list on map and in battle. |
| I158 | UX | Primary CTA truncates the city into an ambiguous name | R21 | W04 | Keep the target identifiable visually and in its accessible name. |
| I159 | UX | Event options are below the fold or difficult to reach | R73; P2 session 2 | W04 | Scrollable content and a reachable action area expose all choices at 844×340. |
| I160 | Defect | Sheets assume full height and are clipped by Safari bars | P2 §10; P3 §7 | W04,W15 | Use visible height and safe areas through browser-bar and orientation changes. |
| I161 | UX | Era banner covers resource/research controls for many turns | L1; R110; R118 | W04,W14 | Dismiss informational banners into history without hiding essential controls indefinitely. |
| I162 | UX | Resource popover remains open over other sheets | R85 | W04 | Popover lifecycle participates in the interaction coordinator and has a predictable dismissal. |
| I163 | UX | Stored-resource icons have unlabeled numbers | R85 | W04,W07 | Provide visible/accessible labels, units and explanation for every resource amount. |
| I164 | UX | Settings duplicates Map section headings | R2 | W14 | Organize settings with distinct headings and clear disabled-control explanations. |
| I165 | Request | No in-game local save/load slots | R1 | W15 | Scope explicit local slots/checkpoints with persistence semantics separately from corruption fixes. |
| I166 | UX | New Game uses a native browser confirmation | L11; R12 | W04,W15 | Use an accessible in-game dialog that states progress/save consequences and handles cancellation. |
| I167 | UX | Start search promises capital names but misses modern aliases | R13 | W14 | Support the promised aliases or accurately narrow the placeholder; preserve empty-state behavior. |
| I168 | UX | Start region chips overflow without a scroll hint | R15 | W14 | All region filters are discoverable and reachable on landscape phones. |
| I169 | UX | Log shows only about four lines on the phone | L7; R115 | W04,W14 | Provide a readable space-efficient log view with filters and enough context per entry. |
| I170 | UX | Per-turn Upkeep floods the Action log | L7; R115 | W14 | Summarize recurring financial entries while preserving accessible details/history. |
| I171 | UX | News about unmet foreign rebellions dominates turn reports | P2 §3; P2 §9; R112 | W11,W14 | Prioritize local/known actionable news and place optional global history behind filters. |
| I172 | UX | Sack shrinkage then same-turn growth looks contradictory | R66 | W02,W14 | Show ordered events and final population without falsely treating legitimate later growth as corruption. |

### Battle placement, controls and feedback

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I173 | UX | Placement gives no visible legal buildable area | H6; R140; P2 §7 | W05 | Preview legal ground using the same predicate as authoritative placement without leaking fogged information. |
| I174 | UX | Playable field boundary is not drawn | H6; R137; P2 §7 | W05 | Draw the actual boundary so visible grass beyond it is not mistaken for playable land. |
| I175 | UX | Resources and obstacles hide their blocking footprints | H6; R140 | W05 | Show resource/obstacle occupancy and building footprint distinctly during placement. |
| I176 | Investigation | Generated battle start offers almost no valid construction space | P2 §7 | W05 | Measure reachable legal slots for core buildings across layouts and fix generation if overlays alone are insufficient. |
| I177 | UX | Valid placement commits immediately without a clear confirmation step | H6; R96 | W05 | Phone preview and explicit Build here are separate states with clear cancel behavior. |
| I178 | Defect | Build menu reopens beneath the confirming finger | H6; R96 | W05 | Successful placement closes the menu and consumes the gesture without arming a second building. |
| I179 | Defect | Placement error text remains after successful construction | R96 | W05 | Clear stale validity/error state immediately when placement succeeds or the target changes. |
| I180 | Defect | Placement ghost stays stuck at the camp despite taps | R142 | W05 | Preview follows valid pointer updates and reports any input/geometry rejection. |
| I181 | UX | Build here is disabled without explaining why | R142 | W05 | Display the current authoritative placement/affordability reason next to the action. |
| I182 | UX | Stop is mistaken for close-menu and halts construction | R97 | W05 | Separate Close, Cancel placement, Cancel construction and Stop working in text and placement. |
| I183 | Defect | Cancel placement triggers a newly exposed Tower/build tile | P2 §10 | W04,W05 | Pointer capture and gesture consumption prevent the same tap activating the next screen. |
| I184 | UX | Assigning a worker to construction is unclear on touch | R98 | W05 | Give a visible worker-to-site/repair action whose touch and desktop paths perform the same command. |
| I185 | Investigation | Training cost timing/queue feedback appears inconsistent | R94 | W01,W05 | Reconcile source reservation timing with UI updates and confirm accepted queue entries/costs visibly. |
| I186 | Defect | Battle build icons are blank on first open | L2; R95; R136 | W05,W14 | Cold-cache first open renders icons or useful fallbacks without requiring a second open. |
| I187 | UX | Build details are hidden behind poorly signposted long-press | R143 | W05 | Make effects/cost details discoverable without relying on hover or an obscure gesture. |
| I188 | Defect | All N selection unexpectedly moves the camera | H7; R154 | W05 | Select without centering; provide a separate Find army action. |
| I189 | Defect | Attack then structure tap silently fails | H7; R155 | W01,W05 | Every intended order has an accepted marker or specific rejection and matches right-click behavior. |
| I190 | Defect | Pullback move leaves squads idle under towers | H7; R101 | W05 | Trace and fix movement/order priority so legal withdrawal movement executes predictably. |
| I191 | Defect | Squads go idle after their target is destroyed | H7; R147 | W05 | Attack-move and engagement stance acquire nearby threats within leash rules without violating Hold. |
| I192 | UX | Mixed-speed attack sends cavalry alone ahead of infantry | R100 | W05 | Offer group pace/cohesion and deliberate break-formation control. |
| I193 | Defect | Reserve/second-wave control appears only intermittently | M13; R148; R152 | W05 | Keep reserve status and call action visible whenever relevant, with entry constraints explained. |
| I194 | UX | No prompt reminds the player that reserves remain available | M13; P2 §7 | W05 | Provide a restrained contextual reminder when reserves can affect the battle. |
| I195 | UX | Squad count drops without casualty/retreat explanation | R149 | W02,W05 | Distinguish killed, routed, withdrawn, reserve and reinforcing units in a concise live summary. |
| I196 | Request | Player cannot find the enemy objective or navigate via minimap | P2 §7; P3 §7 | W05 | Provide objective/base/army navigation plus a toggleable minimap respecting available intel. |
| I197 | Investigation | Keep focus action is broken or slow to become available | P2 §7; R93 | W05 | Verify each battle type and opening state; preserve the working P3 behavior and explain unavailable targets. |
| I198 | Request | Desktop lacks accessible keyboard/edge panning | P2 §7; R93 | W05 | Provide documented panning controls without conflicting with selection/orders. |
| I199 | Request | Camera never follows a marching battle formation | P2 §7 | W05 | Offer optional follow-selection with explicit cancellation on manual pan. |
| I200 | UX | Battle zoom ignores the pointer location | R93 | W05 | Choose predictable zoom anchoring and test cursor/touch focal behavior across supported devices. |
| I201 | UX | Battle HUD leaves only a narrow field strip | R141; P2 §10; P3 §7 | W05 | Measure occlusion and target at least 70% field visibility in ordinary play while preserving usable controls. |
| I202 | Defect | Defender housing collapse control fails or stays open by default | P2 §10; R141 | W05 | Collapse works in all layouts and nonessential housing starts minimized. |
| I203 | UX | Battle alerts accumulate and obscure the field | R141; P3 §7 | W05 | Use a compact timed alert stack with accessible history rather than permanent overlap. |
| I204 | UX | Deploy help is oversized, clipped and gives desktop-only instructions | P2 §10; R92 | W05 | Use concise layout/input-specific help with all essential instructions reachable. |
| I205 | UX | Performance overlay covers deployment help | R92 | W05 | Reserve non-overlapping overlay zones when the optional overlay is enabled. |
| I206 | Defect | Speed and Pause controls shift under the finger | P2 session 2 | W05 | Keep speed/pause coordinates stable across HUD transitions and verify in-flight taps. |
| I207 | UX | Pause sheet takes excessive space on phone | P2 session 2 | W05 | Use a compact usable pause layout with clear Resume while preserving context. |
| I208 | UX | Camp naming changes without explanation | L3; R135 | W05,W14 | Use consistent labels or an explicit era/type distinction. |
| I209 | UX | Friendly and enemy buildings are visually indistinguishable | R151 | W05,W14 | Use ownership markers/outlines and labels recognizable at phone zoom and without color alone. |
| I210 | Request | 50 percent housing-loss rule text is unwanted on three screens | L12; R160 | W05 | Remove text from pre-battle, defender housing and results without silently changing damage mechanics. |

### Battle balance, art and content

| ID | Type | Issue / request | Evidence | Packages | Completion check |
|---|---|---|---|---|---|
| I211 | Balance | Auxiliary squads feel too fragile relative to their investment | M16; R99; R146 | W06 | Compare aggregate cost/strength and expected role across eras with tactical/Auto parity. |
| I212 | Investigation | Towers and repair throughput may overwhelm viable assaults | R102; P2 §7 | W06 | Test infantry, ranged and siege matchups plus repair economies before adjusting rates. |
| I213 | UX | Pre-battle UI gives no warning to bring siege tools | R150 | W06,W14 | Recommend unlocked siege options when fortifications make the current army unsuitable. |
| I214 | UX | Battle lighting is too dark on phone | R92; P2 session 2 | W05,W14 | Use readable default lighting on reference devices without flattening essential terrain/ownership contrast. |
| I215 | UX | Battle towns use an inappropriate era/cultural style | P2 §7; P2 §8 | W14 | Validate Bronze Mesopotamian and other culture/era asset assignments against battle setup. |
| I216 | Investigation | Nubian battlefield farmland may not fit the location | R134 | W14 | Check actual tile/river context before replacing green terrain solely on regional assumptions. |
| I217 | UX | Trees are repetitive dark blobs that read as noise | P2 §8 | W14 | Improve silhouette/material variation and readability within mobile rendering budgets. |
| I218 | UX | Soldiers are too tiny to identify or select on phone | P2 §8 | W05,W14 | Provide readable visual scale and generous selection targets without changing combat hitboxes. |
| I219 | Request | Animation set is limited and the bake pipeline is not built | P2 §8 | W14 | Validate and connect the existing pipeline for useful movement/combat/work reactions before adding assets. |
| I220 | Investigation | Battle loading varies from roughly 5 to 20 seconds | R92; R134 | W14,W15 | Profile setup/assets/worker startup separately and provide honest progress plus measurable regression checks. |
| I221 | Balance | Events repeat too frequently | M15; R89; P2 §2 | W14 | Apply event/family/city cooldowns scaled to campaign speed while retaining sufficient valid events. |
| I222 | Defect | Events refer to inappropriate climate, coast or nonexistent buildings | M15; R84; P2 §2 | W14 | Use context prerequisites or truthful variants for winter, sea raids, granaries and other setting-dependent text. |
| I223 | Balance | Bronze Age Collapse triggers too early for a one-city start | M15; R35 | W14 | Gate the event to meaningful era/systemic conditions and provide viable early recovery choices. |
| I224 | UX | Messages contain grammar, pluralization and doubled battle names | P2 §9; R30; R109 | W14 | Use consistent formatting that passes singular/plural, actor, location and named-battle examples. |

## Commercial/product entries, separately counted

All map to W16. These are options and constraints, not eight simultaneous commitments.

| ID | Entry | Evidence | Planning disposition |
|---|---|---|---|
| P01 | Free base plus paid era/region expansions | P2 §12.1 | Compare scope, pricing, entitlements and saves; select a coherent model before implementation. |
| P02 | Premium people/content packs | P2 §12.2 | Provide cultural content with fair power budgets and clear compatibility. |
| P03 | Cosmetic banners, shields, units, towns and map themes | P2 §12.3 | Keep ownership readability, accessibility and battlefield fairness. |
| P04 | Historical scenario/campaign packs | P2 §12.4 | Define objectives, scripted starts, progression and an ending for each scenario. |
| P05 | One-time full-game mobile purchase | P2 §12.5 | Compare platform purchase restoration and offline access against other models. |
| P06 | Supporter/early-access tier | P2 §12.6 | Define value and access policy without gating core fixes or power. |
| P07 | Seed sharing, community challenges and possible curated seasons | P2 §12.7 | Version seed descriptors and submissions; establish value before a paid season. |
| P08 | Exclude paid gold, timers, speed-ups and battle advantage | P2 §12.8 | Keep optional commerce consistent with single-player balance and deterministic competition. |

## Explicit source test gaps, separately counted

All map to W15 plus affected subsystem packages. These nine areas are not assumed to contain nine defects.

| ID | Untested area | Evidence | Required verification |
|---|---|---|---|
| T01 | Export/import save round trips | P3 §2; R11 | Validate older/malformed files, migrations and recovery. |
| T02 | Cloud sign-in and synchronization | P3 §2; R10 | Use authorized test accounts for offline/conflict/duplicate-receipt behavior. |
| T03 | Naval combat | P3 §2 | Verify outcome, retreat, casualty and geography contracts at sea. |
| T04 | Landings and interceptions | P3 §2 | Verify sea-to-land setup, queue and final outcome transitions. |
| T05 | Vassals/tributaries | P3 §2 | Verify obligations, capital/ownership and revised capture interactions. |
| T06 | Real touch gestures | P3 §2; R93 | Test actual touch pan, pinch, selection, orders and cancellation on target devices. |
| T07 | Sound | P3 §2 | Verify toggles, pause/background behavior and playability without audio. |
| T08 | Deep globe interaction | P3 §2; R3; R4; R5 | Exercise navigation/picking/fog beyond the observed basic toggle. |
| T09 | Portrait rotate screen | P3 §2 | Verify orientation transitions and lossless restoration of active game interactions. |

## Original 42 labels mapped to item IDs

This is a subset/cross-reference index. Some subitems of compound labels are referenced by their original log rows in the full inventory.

| Audit label | Explicit item references |
|---|---|
| C1 | I001, I002 |
| C2 | I003, I004 |
| H1 | I017, I018, I019, I021 |
| H2 | I100, I101, I102, I103, I104 |
| H3 | I120, I121, I122 |
| H4 | I126, I127, I132 |
| H4b | I129 |
| H5 | I151, I152 |
| H6 | I173, I174, I175, I177, I178 |
| H7 | I188, I189, I190, I191 |
| H8 | I012, I013 |
| H9 | I022, I023, I026, I027, I028 |
| M1 | I133, I134 |
| M2 | I139, I140 |
| M3 | I113, I114, I115 |
| M4 | I058 |
| M5 | I084, I085 |
| M6 | I086, I087, I088, I091, I093 |
| M7 | I041, I045, I046, I047, I048 |
| M8 | I039, I040 |
| M9 | I043, I044 |
| M10 | I110, I111 |
| M11 | I010 |
| M12 | I131 |
| M13 | I193, I194 |
| M14 | I009 |
| M15 | I221, I222, I223 |
| M16 | I211 |
| M17 | I065 |
| M18 | I036, I038 |
| L1 | I161 |
| L2 | I186 |
| L3 | I208 |
| L4 | I096, I148 |
| L5 | I112 |
| L6 | I146, I147 |
| L7 | I169, I170 |
| L8 | I082 |
| L9 | I118 |
| L10 | I073, I074 |
| L11 | I166 |
| L12 | I210 |

## Corrections, ambiguity and exclusions

- R113b explicitly retracts the claim that Cyrene was absent from battle reports. Ghost cavalry and supply behavior remain actionable; report absence does not.
- R129 only records an immediate development increase; it does not disprove P2's next-turn reset. The plan includes a persistent-development test.
- R94's observed training-cost timing conflicts with inspected immediate reservation logic. Investigate live UI/worker timing before rewriting payment behavior.
- R55's remaining Iron row could be a different tile with the same label. Identify exact tile IDs; do not assume duplicate ownership.
- R66 can describe a legitimate sack followed by later growth in the same turn. Fix ordering/clarity if state is already correct.
- R134's green farmland in Nubia is an observation, not proof of incorrect geography. Check the actual river/tile context.
- Early AI expansion differs between P2 and P3. Compare world, speed, stage and playstyle rather than asserting universally poor AI growth.
- An Auto replay of one round may be correct. Improve summary presentation only if needed; do not fabricate missing combat rounds.
- Battle auxiliaries demobilizing is intentional in inspected source. The issue is unclear presentation and the requested design review, not an established persistence bug.
- All original PASS/NOTE rows have item references, verification references, or an explicit preserve/neutral disposition in the updated raw coverage CSV. Successful behaviors remain protected by the plan's preserve list.

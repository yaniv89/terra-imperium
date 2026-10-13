# Art update of 13 October 2026: what changed and what to make

For every art, animation and icon session. This overrides
[the 9 October art plan](playtest-audits-art-production-plan.md) and its
[manifest](playtest-audits-art-production-manifest.csv) wherever they differ. Reasons are the
user's answers of 13 October ([conflicts, section 9](playtest-audits-conflicts.md)), decisions 40
to 42 in [the addendum](playtest-audits-addendum-2026-10-13.md), the new
[triangle budget](art/TRIANGLE-BUDGET.md) and the review of `origin/gpt/art-remaining`.

Row IDs are the manifest's (AN = motion, MD = model or prop, UI = icon or overlay). New rows are
UI15 to UI18, MD13 and MD14. Status words are the plan's (section 10).

## 1. Do first (priority A)

| Row | Make | Why |
|---|---|---|
| UI14 | Battle stock icons for **Food, Wood, Stone, Gold**, plus Battle Supply. A new Wood icon. "Materials" is retired. Readable at 844x340 next to their numbers. | Q1: four battle resources |
| MD06 | Battle nodes: wood grove, stone, gold, fish, herds, each full / half / depleted. Ore is no longer a resource: retire `ore-outcrop.glb` or re-skin it as a stone or gold node (pick per age). | Q1 |
| AN15, AN16, MD07 | Worker tools and loads: logs, stone blocks, gold, food. The pickaxe mines stone and gold. No ore load. | Q1 |
| UI15 (new) | **Capture card**: four choice icons, Conquer, Raze, Make tributary, Free, each with a disabled look, and a card header. Shown after every won city battle and every siege surrender. | decision 40 |
| UI16 (new) | **Base identity**: a marker that tells base buildings (HQ, camp or keep, and the economy and military buildings) from houses, landmarks and walls, and a small base-status element for the battle HUD (how many base buildings stand). | Q3, Q4: a side loses only when its base buildings are gone |
| MD13 (new) | **Damage states for battle economy and military buildings**: barracks, archery range and musketry yard, stable, siege workshop and gun foundry, farm, food depot, wood and stone depots, mine, trade post, aid post, tower. Intact, damaged, destroyed, per age kit. They must now be destroyed to win, so the states have to read at a glance. | Q4 |
| UI06 | Placement overlay states: legal ground tinted, the real field edge drawn as a line, land past the edge visibly out of play (the renderer draws 40 tiles of land beyond the field), a resource's blocked footprint shown, building overlap. "Explored ground inside the camp radius" counts as legal. | addendum X08 to X10 |
| MD09, MD10 | Machines only get bigger: cannon, tank, artillery, siege engines. Crews and soldiers stay at true human scale. Do not enlarge soldier figures; "tiny soldiers" is fixed in code with tap areas and squad markers. | Q7 |

## 2. Change (existing rows, lower priority)

| Row | Change | Why |
|---|---|---|
| UI08 | No Reserve control and no "later reinforcement" cue: everything starts on the field. Keep Idle N. Two separate glyphs: "select all" and "find army". | Q2, U10, X12 |
| AN05 | No "group matching". Each class keeps its own gait and speed, also inside a mixed group (cavalry visibly outpaces infantry). | Q6 |
| UI07 | Add a map-level **Hold** marker for campaign units (stays put, not idle), next to the battle Hold marker. | user request |
| UI10 | A settle mode that forces its own lens and stays on until a site is chosen; legal, illegal and recommended sites. | X20 |
| UI11 | The build sheet has a real close control; "Stop working" is a different, clearly separate glyph. | X11 |
| UI02 | WebGL map only. The globe is hidden; make nothing for it. | Q8 |
| UI05 | Build menu thumbnails are preloaded with the battle (they showed blank on first open). No art change unless a thumbnail is missing. | X14 |

## 3. New, lower priority

| Row | Make | Why | Status |
|---|---|---|---|
| UI17 (new) | A **no man's land** badge for the pre-battle card: "fought on Auto". | decision 41 | new-needed, B |
| MD14 (new) | **Steppe vegetation kit**, split out of MD05. Conifer, tropical and cold already exist on `origin/gpt/art-remaining`. | art branch review | new-needed, B |
| UI18 (new) | **City-state type badges**: trade, military, science, culture, raider, and a quest marker. Extends UI03. | decision 42 (proposed) | hold until the user confirms |

## 4. Trees (MD05, I217)

Checked today in a forest battle at 844x390. The camouflage noise is gone and forests read as
forests. Still weak:
- one species everywhere, in flat-shaded angular shards;
- canopies float on thin trunks;
- dense woods turn into a spiky dark mass that hides what is under it.

Ask: 2 to 3 species per climate kit, fuller trunks, a softer canopy shape, and dense woods that
thin readably at far zoom. Budget: large tree 600 / 200 / octahedral impostor. I217 stays open as
"silhouette and variety".

## 5. Stop or drop

- Reserve button art, wave or "second wave" cues, reinforcement arrival markers.
- Group-pace animation matching.
- Bigger soldier figures.
- Ore as a resource (icon, node identity, cargo).
- Anything made only for the globe.
- The "50% rule / at most N houses" text is being removed from the pre-battle card, the battle
  HUD and the result screen; make no art for it.

## 6. Budgets

Use [plans/art/TRIANGLE-BUDGET.md](art/TRIANGLE-BUDGET.md), not section 3.2 of the 9 October plan:
- Phone frame: 700k target, 1.0M ceiling. Split: terrain and water 130k, soldiers 300k, buildings
  and walls 120k, trees, props and nodes 80k, effects 30k.
- LOD0: person 2,000, mounted 3,500, machine 4,000. A new 2-triangle impostor LOD3 for units.
- Large tree 600 / 200 / impostor. Node 1,500 / 300 / 80. Battle building 8,000 / 2,000 / 400.

## 7. The art branch `origin/gpt/art-remaining`

Reviewed: 14 models, 5.5 MB, merges cleanly, everything under budget, no unit, sim or rig changes.
Before it can merge into `claude/integration`:
1. Remove the three source zips in `plans/art/downloads/wave7/checkpoint-38/sources/` (90 MB) and
   the bulk screenshots and concept PNGs (about 35 MB) from the branch. Keep the builders,
   manifests and GLBs.
2. Add a CC0 licence file for the new terrain, vegetation and props kits (as `props/LICENSE.txt`
   does for the older props).
After the merge: measure UV mismatch on the non-temperate kits (desert, mediterranean, the rts
kits, the city kits), because the UV repair now runs only on the temperate kit.

## 8. Two tiers of peoples (decision 42, proposed)

About 50 peoples become full majors; the other ~100 are the names city-states are drawn from. All
150 signature units already exist, so nothing is thrown away. Until the user picks the 50, do not
start new per-people work (town skins, signature buildings) for a people that is not already in
progress.

## 9. Reporting

Update `plans/art/PRODUCTION-PROGRESS.md` and the manifest `initial_status` as items land, and say
which rows are in progress and which need a decision.

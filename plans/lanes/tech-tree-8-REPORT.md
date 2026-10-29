# Lane tech-tree-8 report (wave 5, plan U6, R10)

Target: tech tree 8/10 in the next grade round (4.3 in round 3b, 6 in the 29 Oct manual playtest).
Ponytail loaded first (Skill `ponytail:ponytail`, full text printed in the transcript).

## For the lead

No blocking design question. Two calls I made, both reversible:
1. The "Lines" view (techs by category, five collapsible sections) is replaced by "By age": the age tabs
   and one list per age (plan U6). The research web stays as the second view. Focus chips still use the categories.
2. In the list, Queue is the main button and "Research now" the second (plan U6). In the web's picked
   card too, so both views read the same. Queue already queues the missing earlier techs first.

## Findings

| Finding (source) | Cause | Fix | Before / after evidence |
|---|---|---|---|
| No full tech tree view; era tabs did nothing; never found an individual tech list (40746164607 issue 5, 40746174323 issue 4 and bug 8) | r3-campaign made the age strip jump to the web; the default "Lines" view listed techs by category, so an era tab never showed that era's techs | Default view "By age": the age strip is the age tabs (selected tab outlined in brass, `aria-pressed`); a tap shows that age's techs and scrolls to the list. In the web view the strip still jumps in the web | before/844x390-en-bronze.png: tapping Bronze opened the web. 844x390-he-bronze.png, 1600x900-en-detail.png: Bronze tab lists its 10 techs. tech-shots "Bronze tab lists techs" ok in all 4 runs |
| Row states not clear (U6) | Rows showed text only | Each row: icon, name, state word (Known, Researching, Queued, Open, Locked, Later age) with its colour; order current, queued, open, locked, later ages, known (`ageRows`, `rowStateOf` in researchView.js) | researchView.test.js "puts what you can act on first" |
| Tapping a tech card did nothing (40746164607 154-157) | Only web nodes opened a card | A row opens its full card in place (`tech-detail`): what it gives, unlocks (glossary links), map effect, boost, Queue and Research now; a missing prerequisite is a chip that opens that tech on its own age tab | 844x390-en-detail.png, 844x390-he-detail.png; "a row opens the detail sheet" ok x4 |
| Honest turns (F143) | Open techs already used remaining cost / science; locked rows showed only "Needs X" | Open: "{cost} science, N turns" (ceil of remaining / science). Locked: the path's turns and steps, "about 33 turns of research, 3 techs · Needs Copper Working". Later age: "Opens in the Bronze Age", never a turn count | researchView.test.js: turn estimate equals ceil(remaining / science); future-age row has no digits |
| "about no science of research" with no science yet (found here, turn 1 before the first city) | `techEtaText` put "no science" inside "about {turns} of research" | One line in `techEtaText`: no science reads "no science" (also fixes the build list's lock text, which shares it) | researchView.test.js last case |
| Panel about 62-70 px above the screen foot (manual 29 Oct, F147) | The dock keeps a 62 px band for End Turn under every tab; Research's age strip sat above it | Research has no band: its foot fills it. The age tabs sit beside End Turn's row; a spacer the row's width (TurnDock publishes `--turn-row-w`) keeps them clear, and when the row is wide ("Choose production: Kish" with advisor buttons) the tabs wrap above it | before: tabs bottom at 328 of 390, dead band below. After: "age tabs flush at the screen's foot" gap 0 px x4; "End Turn covers no age tab" ok x4 (en wraps above the wide row, he sits beside it) |
| "All techs" seemed to loop (40746170250 issue 8) | The choice card's All techs opened Research at its top (current card again) | It also asks for section `tech.all`; TechPanel scrolls to the list on mount | 844x390-en-from-choice.png; "the choice card's All techs shows the list" (list top 103 px) |
| Tech names do not link to the glossary (40746164607) | Already fixed (a873d9ed, 9e382f1a: GlossaryLink on names and unlocks) | none | detail shots show the underlined links |
| Market "about 108 turns of research" in the Stone Age build list (manual 29 Oct) | Build list lock text (techEta path), not this lane's files; the number is the honest path time | not changed; belongs with pacing-8 or the build list owner | |

## Checks

- `node scripts/ui/tech-shots.mjs` (own vite on port 5263): 21 checks, all ok, at 844x390 and 1600x900, en and he. Shots in plans/ui/tech-tree-8/.
- `npx eslint --max-warnings 0` on every changed file: clean.
- `src/components/panels/researchView.test.js` (new, 6 tests): pass.
- `npm run test:related` on the changed files: 378 files passed; 5 engine files timed out under the shared
  machine's load (sight, marchAttack, stoneAI, tacticalBattle, build-edge-engine) and pass alone (63 tests).

## Files

src/components/panels/TechPanel.jsx, researchView.js (+ test), PanelDrawer.jsx (no band under Research),
src/components/modals/ResearchChoiceSheet.jsx, src/components/ui/TurnDock.jsx (`--turn-row-w`),
src/i18n/locales/en.js, he.js, ui/pnl2.en.js, ui/pnl2.he.js, scripts/ui/tech-shots.mjs.
Not touched: src/engine/research.js, src/data/techTree.js (no rule change needed).

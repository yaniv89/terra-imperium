# Lane tech-help-8 report

ponytail read in full at 12:09 UTC, 28 Oct (cat of the whole SKILL.md; the session start hook also printed PONYTAIL MODE ACTIVE).

Branch: claude/tech-help-8, from origin/claude/integration, integration merged before the push. Not merged anywhere.

## Complaints found (round 2 playtests)

| Run | Step / shot | Complaint | Status before this lane |
|---|---|---|---|
| 40650969714 newcomer | 66, 70 | Glossary from Menu and Help opened the Kemet people page, never a list | Fixed by newcomer-flow (index with search) |
| 40650969714 newcomer | 5, 141 | Tech tree only glanced at, "no sense of the tree itself" (5/10) | Open |
| 40650973042 warmonger | 18 | The only military unit was tech-locked, "explained only by a tooltip" (4/10) | Partly: the build row says Needs X and has Research it |
| 40650976677 civ veteran | 10, 30 | Tree never opened; glossary opened on a people entry (fixed) | Open: nothing pulls a player into the tree |
| 40651416284 civ veteran | 33-38, 185, 265 | Tags are clear (7/10); locked items in the late ages made the player give up and use the advisor | Open |
| all four | | Glossary and help 3 to 6: the glossary was barely opened; nobody found hold for help | Open |

The reports have no step where a player read what a tech gives or unlocks before picking it: the glossary tech entry said only "A technology of the X Age" and its prerequisites, and the research web started research on the first tap, so a phone player could not look before acting.

## What changed

1. **Tech entry in the glossary (Civilopedia style)**: what it gives (the same words as the Research row), what it unlocks (units, buildings, improvements, laws), its boost and that it pays 40% at once, Needs first and Leads to, every tech a link. Every dotted tech name in the game opens it.
2. **Unit entry** names the tech it needs (the warmonger's locked unit, step 18), linked.
3. **Research web on a phone**: a tap now selects the tech (brass outline) and shows its full row under the web: gives, unlocks, boost, cost and turns, Research and Queue. It used to research or queue at once with nothing shown. The hint text says so.
4. **Hebrew web**: it opened scrolled to the Future and node names ran out of their boxes (shot `plans/ui/tech-help/before/research-web-tap-desktop-he.png`). The web is now a left-to-right timeline in both languages.
5. **Current research card** lists what it unlocks.
6. **Eight new game terms** (en and he): food, culture, research boosts, research queue, research focus, age landmarks, catching up, getting help. The Research section labels (Map boosts, Next, Focus, the landmark title, the catch-up note) are dotted links to them.
7. **Hold for help is findable and wider**: the glossary index's Game terms tab opens with a one-line tip on hold (phone) and click (desktop); the top bar's gold, food, science, decrees, culture and the age label, and a locked build's "Needs X", open their entry on a hold.

No engine or rule change (research.js, boosts.js and the tech data are untouched), so no balance-sim run: techs per age and boosts triggered cannot have moved.

## Evidence

- Shots: `plans/ui/tech-help/before/` and `after/`, 844x390 and 1600x900, en and he: research, research-web-tap, glossary-index, glossary-tech, glossary-unit, glossary-term. Script: `node scripts/ui/tech-help-shots.mjs --tag after` (dev server on 5197). No page errors, no failed step.
- Looked at: glossary-tech phone en, research-web-tap phone en and he, desktop he, glossary-index phone he, research phone he. Nothing cut off or overlapping; Hebrew reads right to left outside the web.
- Tests: new glossary test (a tech's leads-to and boost; a locked unit's tech). `npm run test:related` on the changed files: 370 files, 3397 tests passed. Full `npx vitest run` after the integration merge: 504 files, 4721 tests passed, 17 skipped; `npm run lint` clean.

## Expected grades

- Tech: 8 is in reach when a playtest opens the tree: every tech now answers "what does it give, unlock, need, lead to" in one tap on a phone. The playtests never opened the tree, so the next playtest should be told to browse it (web view, tap three techs, open one tech's glossary entry).
- Glossary and help: 7 to 8; the index, the hold tip and the research terms now exist. Grade from a fresh playtest, steps: Menu, Glossary, Game terms, Research boosts; hold the gold number on the top bar; Research tab, tap the dotted "Map boosts".

## Not done, for the lead

- Buildings, resources and improvements have no glossary kind yet (their names are not dotted links). Next step if the grade stays under 8.
- The web's age strip under it is still right to left in Hebrew while the web is left to right; both readable, worth a look.
- Hold for help works on touch only by design; desktop uses the dotted links.

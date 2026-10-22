# Next human-playtest round (needs the user's yes; nothing was dispatched)

New saves (scripts/ai/human-playtest.mjs `buildSlices` + `enrichSave`, test scripts/ai/eraSaves.test.mjs):
every era save is of a player whose capital is on the coast, has met its 3 nearest majors both ways, and is at war with the
nearest one (declared by the player). All eight ages can be slices now (`stone` .. `future`). Dry run: scripts/ai/era-saves-dry-run.mjs.

Workflow: "Claude content", job `human-playtest`. Last round cost about $1.7 to $3.4 per run (about 200 steps, 6 sessions).
Branch to run from: the one that holds this lane, after the lead merges it into claude/integration.

| # | persona | scene | size | lang | slices | limit | max_usd | why |
|---|---|---|---|---|---|---|---|---|
| 1 | warmonger | campaign | phone | en | kingdoms,gunpowder,modern | 150 | 3 | war saves reach sieges and AI armies (kingdoms and gunpowder saves had battles within 20 turns) |
| 2 | rts-commander | campaign | phone | en | kingdoms,gunpowder | 150 | 3 | commands the battles the war saves open |
| 3 | builder | campaign | phone | en | classical,modern,information | 150 | 3 | economy, tech and city screens on bigger empires |
| 4 | hebrew-speaker | campaign | phone | he | classical,modern | 120 | 2.5 | last round's he run lost the era sessions (black screen); recheck load |
| 5 | battle-commander | battle | phone | en | (empty = all eight) | 200 | 4 | unchanged battle sandbox, for before/after on today's battle fixes |

Dispatch inputs per run (workflow_dispatch fields): `job=human-playtest`, `persona`, `scene`, `slices`, `size`, `lang`, `limit`, `max_usd`.
Total about $14 worst case if all five run; runs 1 to 4 about $11. Run 1 alone first as a trial if the user wants to spend less.
The slices field only accepts lower-case ids and commas (workflow check), which these are.

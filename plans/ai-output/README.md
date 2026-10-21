# AI content jobs

Six jobs that use Claude to draft or check content for review. They run only in GitHub Actions, with the
repository secret `ANTHROPIC_API_KEY`, for our development work. The game never calls the API, and
the key is never committed or printed. Each job writes to `plans/ai-output/<job>/`, not into `src/`:
the lead merges what survives review into the game.

| Job | What it writes | Model | Why this model |
|---|---|---|---|
| `hebrew-review` | `report.md` (the Hebrew lines to fix, most serious first) and `fixes.json` (`{ key: suggested Hebrew }`) | Claude Haiku 5.5, low effort | Bulk checking of about 6,100 lines; cheapest and fast |
| `glossary-notes` | `notes.json`: `{ missing, notes: { [peopleId]: { note: {en, he}, founded: {en, he}, uncertain, basis } } }` | Claude Sonnet 5.5, medium effort | Short factual writing for 150 peoples, where care about thin history matters |
| `event-cards` | `cards.json`: `{ failed, rejected, cards: { [id]: event in the src/data/events.js shape plus theme, ageId, subject }, he: { "evt.<id>.title": ... } }` | Claude Opus 5.5, medium effort | The creative writing job: real dilemmas, grounded history, two languages |
| `fact-check` | `report.md` (problems ranked by severity, each with a fix) and `verdicts.json` (`{ id: { ok, severity, kind, problem, fix } }`) for the hand-written events of src/data/events.js and the AI cards at `cards_ref` | Claude Opus 5.5, high effort | Historian judgement (anachronisms, wrong facts, theme fit, Hebrew against English) is where the strongest default model earns its price |
| `screenshot-qa` | `report.md` (each layout fault with screen, size, language, severity and file) and `shots/` (JPEGs from scripts/ui/qa-shots.mjs, 844x390 at DPR 2 and 1600x900, English and Hebrew, plus `manifest.json`) | Claude Sonnet 5.5, medium effort | Vision on 60 screenshots: the cheaper tier is good enough to spot clipped text, overlaps and RTL mirroring; English and Hebrew go in one request to compare |
| `playtester` | `report.md` (findings, a scorecard out of 10 per area and a top 10 fixes, with turn numbers) and `digest.json` (one row per 10 turns plus notable moments, scripts/playtestDigest.mjs) | Claude Opus 5.5, high effort | One long report from a small digest: judgement matters, the cost is cents |

Every job also keeps the raw answers in `results.jsonl`.

## Starting a job

From the GitHub Actions tab: open **Claude content**, press **Run workflow**, pick the job, and
optionally set `limit` (only the first N requests, for a trial) and `max_usd` (default 10).
`fact-check` also reads `cards_ref` (default `origin/ai/event-cards-39615084757`; the checkout fetches
every branch). `playtester` reads `seeds` (how many 300-turn games, default 1): the workflow first runs
`node scripts/simulate.mjs --policy scripted --turns 300 --games <seeds> --digest plans/ai-output/playtester/digest.json`
(events on, the research advisor chooses, the first option of each story card). `screenshot-qa` first
installs Playwright's Chromium, builds the game with `VITE_QA_HOOK=1` (keeps the `window.__game` state hook
the shot script needs; the deployed site never sets it), serves it with `npm run preview` and runs
`scripts/ui/qa-shots.mjs`. World Congress has no screen yet, so it is not shot.

Or from a terminal:

```
gh workflow run claude-content.yml -f job=hebrew-review -f limit=5
gh workflow run claude-content.yml -f job=event-cards
gh workflow run claude-content.yml -f job=fact-check -f cards_ref=origin/ai/event-cards-39615084757
gh workflow run claude-content.yml -f job=screenshot-qa
gh workflow run claude-content.yml -f job=playtester -f seeds=2
```

Start with `limit=5` to check the output, then run the full job.

## Cost

Every job uses the Message Batches API (half price; most batches end within an hour, the workflow
waits up to 6 hours). Before sending anything the script estimates the cost: input from the text
size, output at each request's `max_tokens` cap, which includes thinking, so the worst case is a
real upper bound. Every image is counted at the high-resolution cap of about 4,784 tokens (a phone shot is
nearer 1,700), so images do not weaken the bound. The script refuses to start when the worst case is over `max_usd`.

Dry-run estimates for the full jobs (`node scripts/ai/<job>.mjs --dry-run`, no key and no network):

| Job | Requests | Likely | Worst case |
|---|---|---|---|
| `hebrew-review` | 42 (150 lines each) | $0.04 | $0.10 |
| `glossary-notes` | 15 (10 peoples each) | $0.39 | $0.92 |
| `event-cards` | 112 (7 ages x 16 themes, 8 cards each) | $6.42 | $9.22 |
| `fact-check` | 67 (652 cards, 10 each: 40 hand-written, 612 AI) | $3.90 | $8.59 |
| `screenshot-qa` | 30 (15 screens x 2 sizes, English and Hebrew together) | $0.53 | $1.20 |
| `playtester` | 1 a game (a 300-turn digest is about 7,500 tokens) | $0.10 | $0.25 |

Each job fits the default $10 guard on its own. After a run the log prints the real token count
and cost from the API's usage numbers.

## Getting the results

When the batch ends, the workflow commits `plans/ai-output/<job>/` to a new branch
`ai/<job>-<run id>` and pushes it (the run's summary names the branch). It never pushes to `main` or
`claude/integration`. Look at the branch, keep what is good, and merge the data into the game by hand.

Code: `.github/workflows/claude-content.yml`, `scripts/ai/claudeJob.mjs` (the shared runner and the
price table), one script a job in `scripts/ai/`, test `scripts/ai/claudeJob.test.mjs`; the capture
`scripts/ui/qa-shots.mjs`, the digest `scripts/playtestDigest.mjs` (`simulate.mjs --digest`).
Local dry runs need no key: `CARDS_FILE=<path>` replaces the git ref for fact-check, `PLAYTEST_DIGEST=<path>`
points playtester at a digest, and screenshot-qa without shots prices the screen list.

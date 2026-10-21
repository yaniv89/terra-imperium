# AI content jobs

Three jobs that use Claude to draft content for review. They run only in GitHub Actions, with the
repository secret `ANTHROPIC_API_KEY`, for our development work. The game never calls the API, and
the key is never committed or printed. Each job writes to `plans/ai-output/<job>/`, not into `src/`:
the lead merges what survives review into the game.

| Job | What it writes | Model | Why this model |
|---|---|---|---|
| `hebrew-review` | `report.md` (the Hebrew lines to fix, most serious first) and `fixes.json` (`{ key: suggested Hebrew }`) | Claude Haiku 5.5, low effort | Bulk checking of about 6,100 lines; cheapest and fast |
| `glossary-notes` | `notes.json`: `{ missing, notes: { [peopleId]: { note: {en, he}, founded: {en, he}, uncertain, basis } } }` | Claude Sonnet 5.5, medium effort | Short factual writing for 150 peoples, where care about thin history matters |
| `event-cards` | `cards.json`: `{ failed, rejected, cards: { [id]: event in the src/data/events.js shape plus theme, ageId, subject }, he: { "evt.<id>.title": ... } }` | Claude Opus 5.5, medium effort | The creative writing job: real dilemmas, grounded history, two languages |

Every job also keeps the raw answers in `results.jsonl`.

## Starting a job

From the GitHub Actions tab: open **Claude content**, press **Run workflow**, pick the job, and
optionally set `limit` (only the first N requests, for a trial) and `max_usd` (default 10).

Or from a terminal:

```
gh workflow run claude-content.yml -f job=hebrew-review -f limit=5
gh workflow run claude-content.yml -f job=event-cards
```

Start with `limit=5` to check the output, then run the full job.

## Cost

Every job uses the Message Batches API (half price; most batches end within an hour, the workflow
waits up to 6 hours). Before sending anything the script estimates the cost: input from the text
size, output at each request's `max_tokens` cap, which includes thinking, so the worst case is a
real upper bound. The script refuses to start when the worst case is over `max_usd`.

Dry-run estimates for the full jobs (`node scripts/ai/<job>.mjs --dry-run`, no key and no network):

| Job | Requests | Likely | Worst case |
|---|---|---|---|
| `hebrew-review` | 42 (150 lines each) | $0.04 | $0.10 |
| `glossary-notes` | 15 (10 peoples each) | $0.39 | $0.92 |
| `event-cards` | 112 (7 ages x 16 themes, 8 cards each) | $6.42 | $9.22 |

All three together stay under about $10 at worst. After a run the log prints the real token count
and cost from the API's usage numbers.

## Getting the results

When the batch ends, the workflow commits `plans/ai-output/<job>/` to a new branch
`ai/<job>-<run id>` and pushes it (the run's summary names the branch). It never pushes to `main` or
`claude/integration`. Look at the branch, keep what is good, and merge the data into the game by hand.

Code: `.github/workflows/claude-content.yml`, `scripts/ai/claudeJob.mjs` (the shared runner and the
price table), one script a job in `scripts/ai/`, test `scripts/ai/claudeJob.test.mjs`.

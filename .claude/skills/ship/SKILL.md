---
name: ship
description: Terra Imperium's delivery workflow and the user's standing rules for branches, commits, merging to main, rebuilding the GitHub Pages site in docs/, and the end-of-task summary. Use whenever committing, pushing, merging, "ship it", "merge to main", rebuilding docs, or wrapping up a task for the user.
---

# Shipping Terra Imperium

## Standing rules (from the user)
- Big features go on a side branch (the session's designated `claude/...` branch).
- Merge to `main` only when the user asks. Never on your own.
- After every merge to main, rebuild `docs/` (the live GitHub Pages site) and commit it.
- Keep everything mobile-friendly: phone width first, bottom sheets, 44-48 px touch targets.
- Automate rather than hand the user manual work.

## Before every commit
```bash
npm run lint            # max-warnings 0
npx vitest run          # all green, except the 80 ms/turn benchmark on slow sandboxes
```
For gameplay or UI changes also run the end-to-end check (builds the mobile bundle and plays
several turns of a random nation, about 2 minutes):
```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx playwright test
```
Commit messages say what changed and why in plain words, with the numbers (formula constants,
measured before/after). One commit per coherent wave; push after each.

## Merge to main (only when asked)
```bash
git fetch origin main
git checkout -B main origin/main
git merge --ff-only <feature-branch>      # if main moved: merge it into the branch first and re-test
npm run build                             # writes docs/ (vite.config.js: outDir docs, base /terra-imperium/)
git status --short | grep -v ' docs/'     # must print nothing: the build only touches docs/
git add -A docs && git commit -m "Rebuild docs: <what shipped>"
git push origin main
git checkout <feature-branch> && git merge --ff-only main && git push origin <feature-branch>
```
A tab left open across a deploy reloads itself (stale-version guard), so no cache steps are needed.

## Telling the user
Short, plain English, no em dashes. What shipped (grouped), anything that still fails and why,
open decisions as numbered questions, what's next, and whether it's merged.

# Lane polish-8 report (29 Oct)

Source: manual playtest on build af3ee70e, `plans/playtests/manual-2026-10-29.md`, section "polish-8".
Branch `claude/polish-8`, base 0cc85a67. Ponytail loaded at session start (hook and Skill).

## For the lead
- Governor and advisor names: the 150 peoples now draw from 28 ancient culture pools (`src/data/names.js`
  `nameGroupOf`). `getCultureGroup` is unchanged on purpose: AI doctrines read it (peopleNation.js), and the
  first version that changed it shifted AI doctrines (freeLawChange and lateArrivalPace tests caught it).
  Please spot-check the pools (some cultures have no recorded personal names: North America, Pacific).
- Settle site title: the tile card now shows the name the city will take (own-list names first, as
  founding does) instead of the place name. The other choice, founding cities under the real place
  name, would change the naming rule; not done.
- Not fixed, same class as item 1: names that start with "The" (e.g. "The Arvernian people") still read
  with a capital mid-sentence in UI strings built with t() (cf.war.title, cf.trade.title). The fix in
  msgText covers engine messages only.

## Findings

| # | Finding | Cause | Fix | Evidence |
|---|---------|-------|-----|----------|
| 1a | "Pylos stays The Dacian tribes's." | Possessive on a plural name; independent titles are capitalised for title use | `m.diplo.ownStaysTheirs` is now "{city} stays with {nation}."; `msgText` writes a people ref's leading "The" as "the" mid-sentence (src/engine/messages.js) | messages tests pass; output "Pylos stays with the Dacian tribes." |
| 1b | Dev note in Great Wall description | `description` carried the "standing in for..." note (also Pyramids, Arsenal, Seed Vault) | Notes removed in en (greatProjects.js) and he (he.world.js); Hebrew Great Wall and Arsenal lines also said the old "admin power"/"military power" effects, now match the real effects | diff of the four descriptions |
| 1c | Focus line "costs )" | `ACTION_COSTS.setResearchFocus` is `{}` (truthy), so ", costs " with an empty list | TechPanel checks `costLine(focusCost)` instead | line reads "(+N% science for one line)" |
| 1d | FRIENDLY at -13 opinion | NationCard chip and RegionInfoModal read `relationStatus`, frozen to Friendly when trade is signed (resolveTurn keeps it while a trade pact holds) | Both show the mood word from the opinion number (`moodWord`, same thresholds as first contact) | -13 now reads "Wary" |
| 2 | Founded city named differently from the site card | The tile card's title is the tile's place name (`tiles.names`), founding uses `pickCityName` (the people's own list first) | With settlers and a legal site, the card's title is `site.cityName`, the same call founding makes | existing settleSiteModel test asserts card name = founded name |
| 3 | Spanish governor names for Mycenaeans | Name pools were 8 modern groups keyed by modern land; Greece shared the Spanish pool | Ancient pools per culture for every people (`nameGroupOf`); CityPolitics governor line now goes through `nameNow` (Hebrew) | names.test: every people maps to an ancient pool, ahhiyawa never gets Beatriz |
| 4a | "Free law change" chip with nothing to adopt | Chip checked only `nation.freeLawChange` | Shown only when `canEnactLaw` is true for some law (nextPromptModel.js) | |
| 4b | "Decrees full" opens ruler sheet with no spend | Chip target was `tab: 'ruler'` | Goes to the laws section when a law can be enacted, else the Peoples tab (demands, claims, pacts) | |
| 5 | Dock Buy spends gold with no confirm | TurnDock dispatched RUSH_PRODUCTION on tap | Opens the shared confirm card (`buyConfirm`: cost, gold left, turns sooner) | shots buy-*-{phone,desktop}.png |
| 6a | Trade signs in one tap, no terms | NationCard dispatched TRADE_AGREEMENT directly | Confirm card `tradeConfirm`: cost, their opinion before and after, the trade route's status and pacts in use, from the real reducer on a copy | shots trade-*.png |
| 6b | Diplomacy list re-sorts under the finger | List sorted by opinion on every state change | `keepOrder`: the order first shown stays while the tab is open; a new search sorts again | peoplesModel.test keepOrder |
| 7 | Manual save overwritten by autosave | Save now wrote the autosave key | `saveManual` writes the autosave and a copy to `terra-imperium-save-manual`; Load lists it as "Your save (Save now)"; menu line says the autosave never overwrites it | shots menu-*.png, load-*.png |

## Checks
- eslint on every changed file (`--no-ignore`, worktree lint is blind): clean.
- `npm run test:related` on the diff: first run 8 failures; 3 were mine (doctrine drift from names, fixed by
  `nameGroupOf`), the rest pass alone (stoneAI, battleLoop, endgameReachability, sight, tacticalBattle,
  build-edge-engine: known load flakes). Rerun of the touched and failing files: all pass.
- Shots at 844x390 and 1600x900, en and he: `node scripts/ui/polish8-shots.mjs` (vite on 5288), in plans/ui/polish-8/.
  Nothing cut off or overlapping; Hebrew mirrors. In the he trade shot the people name is English only
  because the script passes the raw name; the real button passes `nameNow`.
- Not run: full suite, e2e, balance-sim (no rule changed; AI doctrines verified unchanged).
- Storage: a third save copy can hit the localStorage quota on big saves; then Save now shows "save failed".

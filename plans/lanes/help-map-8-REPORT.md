ponytail loaded in full at the session start (Skill `ponytail:ponytail` printed the whole SKILL.md; the session start hook also printed PONYTAIL MODE ACTIVE).

# Lane help-map-8: report

Branch `claude/help-map-8`, from `claude/integration` 039d3c18. UI only: no engine, rule or battle sim change. No API use.
Source: round 3b Opus playtests civ-veteran 40746164607 and warmonger 40746170250 (diary lines and shots read from their branches).

## For the lead

No design call is open. Two notes:
1. Desktop 1600x900: the army sheet opens under the Cities dock, so a mouse click on its March button lands on the map behind it (`after/3a-march-why-desktop-he.png`; same layer clash as r3-campaign open item 1). Phones are fine. Not fixed here (lead-ui area): say if this lane should take it.
2. A peace offer sent from a city card (RegionInfoModal) still closes without showing the answer; the one from a people's card (civ-veteran 288) shows it since r3-campaign. Not taken.

## Findings

| # | Finding | Root cause | Fix | Before | After |
|---|---|---|---|---|---|
| 1a | Holding Research only opened the panel (warmonger 42) | Rail buttons had no `data-help`, so useHoldHelp ignored them | Every rail and bottom-bar tab names a glossary term (`TABS[].help` in ActionPanelTabs.jsx; PanelDrawer RailButton passes it; Log and Menu too). Four new terms with en and he text: `empire`, `cities`, `peoples`, `log` (Research opens `science`, Ruler `ruler`, Legacy `goals`, Menu `help`) | Code: no `data-help` on any rail button at 039d3c18 | `ok phone-en/he hold Research tab opens the glossary`, `the held tab did not open the panel` (shot `1a-hold-research-tab`) |
| 1b | Tech names in Research did not link to the glossary (civ-veteran 156-158) | Only the tech list cards linked; the current tech's title, the queue chips, the suggestion card and the Web view's nodes did not | Those names are now GlossaryLinks (tap or hold), Web nodes carry `data-help` (TechPanel.jsx) | Code: plain text at 039d3c18 | `ok phone-en/he hold the current tech name opens its entry` (`1c-hold-tech-name`) |
| 1c | Hold-for-help was undiscoverable | Only the glossary sheet's own tip mentioned it | A one-line tip at the top of the first panel a touch player opens: "Tip: hold a finger on any tab, name or number to read what it is.", with an X; once per browser (localStorage, wrapped in try) and never on a mouse screen. The glossary help texts now name tab buttons too | none | `ok hold hint on first open (touch only)` on all four, `ok hold hint shows only once` (`1b-research-first-open`) |
| 2 | Camera jumped away after a march (civ-veteran 198, warmonger 159); target labels behind the march bar (warmonger 157, 276-277) | The war card's March flies to the target while the card's sheet still sets the map insets, so the target lands off centre, at the bottom edge under the HUD. The I083 nudge only handled a target right under the bar, not one below it or off screen | GLMapView.jsx: once the march bar shows, a target that is under the bar or outside the free map is centred in the room above the bar (zoom of the fly-to kept, and the late inset re-fly cancelled); a target already in view stays put | `node scripts/ui/help-map-8-probe.mjs --tag before`: Sippar at 372,369 with the bar at 186-317 and the bottom HUD below: OFF THE FREE MAP, also after March to attack | Sippar at 372,112 (he 472,112; desktop 773,450 under a top bar at 45-212): `ok march target in the free map`, `ok the camera stays after March to attack` (`2a-march-target`, `2b-march-confirmed`) |
| 3 | March greyed after a landing, no reason (warmonger 127) | ArmySheet's March used the native `disabled` with no reason; MarchBar's two Attack buttons had only a `title` (no hover on a phone) | March goes through `useWhy`: "No moves left this turn (a landing or a march used them). It can march again next turn." or "Pick at least one regiment to march."; MarchBar's Attack now and Attack army show their block reason on tap. Every other army button already used `why` | Code: `disabled` without a reason | `ok a greyed March says why` on all four (`3a-march-why`) |
| 4 | Double tap only zoomed; the close view was not discoverable (civ-veteran 39-40) | The close view is just the map zoomed past CLOSE_ZOOM_K; nothing says so | A **Close view** chip beside the map's search button whenever the map is zoomed out of it; one tap flies the middle of the screen to the close view's zoom (the same zoom Home uses), and the chip hides there | none | `ok Close view chip when zoomed out`, `ok the chip zooms into the close view: k 7.7 to 30.8` (`4a-close-view-chip`, `4b-close-view`) |
| 5a | A full-screen banner X needed a second tap (civ-veteran 141-143) | Not reproduced. The slice started on a full-screen card at build a0312e08; the era saves then asked for a pending landmark, which lead-ui-fixes removed (the saves now pick it). Loading the classical save now shows no banner: a screenshot after load and `elementFromPoint(587,72)` is the map canvas. The r3-battle harness fix (event timestamps) also stops slow taps arriving as holds | none needed | finding in 3b | load shot: no banner, nothing at the X spot |
| 5b | The autosave toast covered the prompts (warmonger 108) | Fixed by lead-ui-fixes (toast at top centre, MenuSheet.jsx), after the 3b build | none | | Code: toast at `left-1/2 top-[header+0.5rem]`, the prompts are top-start |
| 6a | Declare war text "Already fighting The Akkadian Empire" looked stale after peace (civ-veteran 357) | Not stale: in the information save the Pontic Empire is at war with Akkad (`Akkad vs Pontus` in `state.wars`). The line did not say whose war it was, and the player read it as their own | Reworded: ". They are at war with {list} (their war, not yours)" (en and he) | text | text |
| 6b | Silent Offer pact (civ-veteran 23, 63), silent Declare war without gold (65), white peace closing without an answer (288) | | Covered by r3-campaign: every people's card action answers in a bubble on the tapped tile, the short-of-gold refusal says what is missing, and the peace sheet from the card sends through the card | | r3-campaign shots `2b-offer-pact`; see "For the lead" 2 for the city-card path |

## Evidence

- `node scripts/ui/help-map-8-shots.mjs` (dev server on 5231; classical save; 844x390 touch with CDP taps and 900 ms holds like the playtester, and 1600x900, en and he): every check ok (log above in the table). Shots: `plans/lanes/help-map-8-shots/after/`.
- `node scripts/ui/help-map-8-probe.mjs --tag before|after`: the march target's screen point (before 372,369 off the free map; after 372,112).
- Tests: `npm run test:related` on the touched files: RESULT_PLACEHOLDER
- Lint: `npx eslint --no-ignore` on every touched file: clean (the repo lint skips .claude/**, so it must be run that way in a worktree).

## Not done / risks

- The Close view chip and the march re-centre are not unit tested (DOM and camera code in GLMapView; covered by the browser checks).
- The hold hint uses `(pointer: coarse)`: a touch laptop with a mouse attached may not see it.

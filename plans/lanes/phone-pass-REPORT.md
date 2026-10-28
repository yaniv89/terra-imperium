# Lane report: phone pass (branch claude/phone-pass)

ponytail read in full at 2026-10-28T04:26Z (`.claude/skills/ponytail/SKILL.md`, from claude/integration; first read at about 2026-10-27T20:37Z) and followed for the rest of the lane.

Goal: every campaign and battle screen reads and works on a phone held sideways (844x390, and
844x340 with Safari's bars), in English and Hebrew, with nothing overlapping, cut off, under the
notch or End Turn, and every control at least 44 px to tap. CSS, JSX and display text only: no game
rule changed.

## How it was checked

- `scripts/ui/phone-pass-shots.mjs`: every campaign screen (the four start steps, research
  choice, band sheet, map and top bar, city card, city sheet and build list, army card, march bar,
  the six rail tabs (Empire, Ruler, Cities, Research, Peoples, Legacy with the chronicle and era
  goals), menu, settings, nation overview, glossary, event card, crisis notice, turn report) at
  844x390, 844x340 and 1600x900, en and he: 162 shots. Each shot is audited in the page: controls
  under 40 px without a widened hit area, controls off screen or under another control, raw
  `{placeholders}`, NaN, sideways scroll, and (added late) a measured check that a signed number
  keeps its sign in front in Hebrew.
- `scripts/ui/phone-pass-battle.mjs`: the battle sandbox (setup, HUD, deploy, running, pause sheet,
  retreat, result), the battle report and the attack card, same sizes and languages.
- `scripts/ui/phone-pass-march.mjs`: choosing a march then opening a rail tab, the march chip,
  and a tap on the army's own hex (the playtest case), with the March button's position measured.
- Before shots come from a copy of claude/integration (e961ec2d) on a second dev server, after
  shots from this branch, same scripts, same steps.

## Fixes (before and after shots in plans/game/phone-pass/)

| # | Screen | Problem | Fix | Before | After |
|---|---|---|---|---|---|
| 1 | Map, any rail tab | Choosing a march, then opening a tab: the march bar drew over the tab's header (Ruler, Research, Peoples, Legacy) | MarchBar joins the one-on-screen registry as a notice (`useInteraction('march-bar', ...)`): a tab tucks it into a chip "Choose where the army marches"; the chip brings it back | 01-march-over-tab-before.jpg | 01-march-over-tab-after.jpg, 01-march-chip-back-after.jpg |
| 2 | Map | A tap on your army's hex (the soldier model under its banner) opened tile info, not the army's orders (playtest run 40550097406: about 40 steps lost) | GLMapView: the first tap on a hex holding your own army opens the army card, a second tap opens the tile; marching and settling taps unchanged | 02-tap-army-hex-*-before.jpg | 02-tap-army-hex-*-after.jpg |
| 3 | Army card | March, Hold and rename sat below the fold, no scroll cue (playtest top issue) | On phone-landscape the action row sticks to the bottom of the card with a top border: March at 321..365 of 390, 271..315 of 340; explore buttons 40 to 44 px | 03-army-card-*-before.jpg | 03-army-card-*-after.jpg |
| 4 | Research tab | Age strip: "INFORMATIONFUTU", long names ran into the next cell | the name truncates inside its cell (`max-w-full`) | 04-age-strip-before.jpg | 04-age-strip-after.jpg |
| 5 | Event card | The date was a raw "-3500" (Hebrew "3500-"); "Can't afford", "Cost" and the footer were English only | `formatYear` (c. 3500 BCE, כ־3500 לפנה״ס), isolated; three new keys `evt.cantAfford`, `evt.cost`, `evt.footer` in en and he | 05-event-year-he-before.jpg | 05-event-year-he-after.jpg |
| 6 | Hebrew everywhere | Signed numbers flipped: "%-3" for "-3%", "10%+" for "+10%", "15+" for "+15" | i18n core: a bare signed number passed to a translated string is isolated left to right, and a "%" after an isolate moves inside it; the shared `signed()` helpers (atlas, CityPanel, CityPolitics, EmpireOverview, PeaceDealSheet, IndependentSheet) and research effect percents isolate too | 06-signed-numbers-he-before.jpg | 06-signed-numbers-he-after.jpg |
| 7 | Map, 844x340 | The needs-you column (chips, crisis notice, goals) ran onto the map's lens buttons | the column scrolls above the bottom buttons (`max-h`, no scrollbar) | 07-chip-column-he340-before.jpg | 07-chip-column-he340-after.jpg |
| 8 | Research choice, 844x340 | "Let my advisor choose" and "All techs" fell below the fold | on phone-landscape the two buttons stick to the true bottom of the sheet, the row padding the strip the sheet keeps clear for End Turn, so no option shows under it; 40 to 44 px | 08-research-choice-he340-before.jpg | 08-research-choice-he340-after.jpg |
| 9 | Tap targets | Under 44 px: top bar nation, turn and help (32), stat items (32), needs-you chips (32), goals chip (36), march and settle bar buttons (32 to 36), crisis close (32), research close (28), glossary links (20), build filters (36), start screen region chips and language switch (36) | 44 px hit areas: a `::before` inset where the visible size must stay (top bar, chips, bars, glossary links, crisis close), else min-height 44 (build filters, start chips, language switch, research close). The stat items sit in the top bar's sideways scroller, which clips any inset: they now fill the 36 px bar | 09-build-filters-before.jpg | 09-build-filters-after.jpg |

## Design calls (the lead's rule of 27 Oct: each with its reason, reference and shots)

1. **Tap the unit's hex to select the unit, tap again for the tile.** Reason: the playtest's top
   issue; the army's model stands on the hex under its banner, and the tap there gave tile info.
   Reference: Polytopia and the Civilization games select a unit by tapping its tile; Civ
   Revolution on iPhone keeps a unit panel with its actions in a fixed corner ([Gear Diary
   review](https://geardiary.com/2009/08/16/review-civilization-revolution-comes-to-the-iphone/amp/)).
   I could not find a primary source for the Civ VI mobile tap rule. Shots 02.
2. **Unit actions pinned in a fixed place, not at the end of a scrolling card.** Reason: same
   playtest (March below the fold, steps 77 to 119). Reference: the fixed unit panel above, and
   Civ VI kept its interface elements in their expected places on iPhone ([Macworld
   review](https://www.macworld.com/article/231955/civilization-vi-iphone-review.html)). Shots 03.
3. **One thing on screen: the march bar waits as a chip behind a panel.** Reason: it covered the
   panel's header. It follows the game's own rule (CLAUDE.md "Who is on screen"), no new pattern.
   Shots 01.
4. **44 px tap areas without growing the slim top bar.** Reason: the audit found 32 px targets.
   Reference: Apple's 44x44 pt minimum, and the advice to widen the invisible hit area rather than
   the glyph ([uxcel](https://app.uxcel.com/courses/mobile-design/ios-app-design-712/minimum-tap-target-size-8996),
   [Big Medium](https://bigmedium.com/ideas/iphone-tap-target-44.html)). The slim 36 px top bar is
   a past decision (plans/UI-DESIGN.md), so it keeps its height.

## Playtest evidence (runs 40550097406 newcomer-phone, 40550092795 warmonger)

- Army orders not found: fixed by calls 1 and 2 (shots 02, 03). "A drag on the card pans the map":
  the playtester drags with a mouse, and a mouse drag never scrolls a panel; on a phone a finger
  drag scrolls the card. With the pinned row March needs no scrolling either way.
- A banner needing two taps (steps 63 to 64, 186 to 187, near x 586): the crisis notice's close
  button was 32 px; its hit area is 44 px now.
- End Turn "hidden" behind production prompts: End Turn becomes "Choose production: X" while a
  city has nothing queued. That is the turn-blocker rule (src/engine/turnBlockers.js), not a
  layering bug, so I left it. Offering "end turn anyway" is a game-rule call for the user.
- The turn report needing a tap every turn, and five taps per city for production: rule and flow
  questions, outside this lane's CSS/JSX scope. Listed for the lead.

## Checked and fine

The measured sign-order audit (every text node with "+N" or "-N" in Hebrew, sign position against
the first digit) found nothing on the six tabs and the event card at 844x390 and 844x340 after the
fixes. The attack card (10-attack-card-he340-checked.jpg) and the battle HUD
(11-battle-hud-he340-checked.jpg) read in order in Hebrew at 844x340.

Start screen steps (no sideways scroll at any size), city sheet tabs and build list, Peoples tab,
Ruler tab, Legacy tab with the chronicle and era goals, menu, settings, nation overview, glossary,
turn report, battle HUD, deploy card, pause sheet, retreat and result screen in both languages
(Hebrew mirrors, End Turn stays at `--rail-w`, no raw placeholders or NaN in any shot), and
desktop 1600x900 in both languages.

## Left open

- On a short phone the settle legend pill runs partly under the band sheet (its lens buttons sit
  in the same corner as the sheet).
- In Hebrew with a tab open, the first chip slightly covers the map's search button (already so
  before this lane).
- Battle at 844x340: the coach card covers the selected squad's card while it shows.
- The panels-shots.mjs check fails before its first panel on today's worlds (it reads
  `capitalRegionId` of a Stone Age band); not fixed here.
- Engine test `resolveTurn.test.js` "an aggressive, hostile Tier 1 neighbor eventually declares
  war" fails on claude/integration too (checked with this lane's changes stashed).

## Tests

- Lint: zero warnings on every changed file.
- `npm run test:related` over the changed src files: 354 of 357 files pass, 2 skipped, 1 failing
  test (the engine test above, failing on the base too).
- i18n test for the Hebrew signed-number isolate: src/i18n/i18n.test.js, 13 of 13 pass.
- Landscape e2e (`e2e/landscape.spec.js`, on a fresh `npm run build:mobile`): 4 of 4 pass.

## Note to the lead

send_message to the lead session fails from this machine (the lead session needs a trusted device),
so this file is the report. Interim note sent nowhere: army orders on a phone were fixed first, as
asked (fixes 2 and 3).

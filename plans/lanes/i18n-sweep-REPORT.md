# Lane i18n-sweep: report (27 Oct)

Goal: every player-facing string in en and he, natural Hebrew, numbers and signs isolated, no raw
keys. Started from playtest issue 17 (English event names and "11g+" in the Hebrew log, English
install banner, army wording that sounds translated).

## What was wrong and what changed

| Finding | Fix |
|---|---|
| Signed numbers flipped in Hebrew ("50+ בתור", "11g+"): only engine log lines isolated signs | `isolateSigned` moved to src/i18n/core.js and applied to every Hebrew `t()` and data text, not only `msgText` |
| Gold in Hebrew read "11g", some lines "1.5Kg זהב" | `{x:money}` in Hebrew writes "1,500 זהב" / "2.5 מיליון זהב"; the three doubled "זהב" lines fixed |
| Income line was "-4700: +11g" (raw year) | now "Income: +11g" / "הכנסה: +11 זהב" (the log heads each year itself); worldSounds income filter follows |
| Raw key on the research pill ("research.turnsCount") with no science | plural lookup falls back to `.other`; the pill says "no known time" |
| Log names stayed English: buildings, improvements, wonders, governments, tax rates, city-state types, districts, resources, unit classes, tech focus, development, identity pole | `refName` maps each kind to its table prefix (btier, impr, gp, gov, ...); identity shift logs its axis id |
| Engine refusals in English in the Hebrew log and city panel: wonders, rush (buy), tile claims, scouts, army templates | `reasonOf` keys `m.why.*` (en and he); CityPanel shows the rush reason through `reasonText` |
| Hard-coded English in 16 components: independents list, raid labels on the live map and the old map, rotate screen, old-save notice, account and cloud saves, save conflict card, log button, city banners, event "can't afford" and "Mandatory", globe loading, map markers, loyalty breakdown (which also shadowed `t`) | converted to `sw.*` keys in src/i18n/locales/ui/sweep.{en,he}.js |
| The log addressed the player in singular masculine ("שלך", "אתה משלם") while the UI uses plural | diplo, battle, world, turn, city message tables and he.world/he.events/he.ruler rewritten to plural (about 210 lines) |
| Army sheet wording: "ציידים של אכד", "החזיקו", "מחזיק" | "ציידי אכד (גדוד 1)" (construct state for one-word plurals), "החזיקו עמדה", "מחזיקים עמדה", smoother fortified line |
| Install banner in English | already fixed on integration (InstallHint uses t()); checked |
| English event names in the log | already fixed on integration (`p:<template>` ids); the headless log check confirms |

Out of scope, left as is: dev screens (AdminPage, TileViewer, WorldLab), ColonyBlock (only the
retired emergent world), AI-written event texts in he.eventsAi.js (narrative, still singular),
`friendlyAuthError` messages from the auth service.

## Automated checks (stay in the suite)
- src/i18n/hardcodedText.test.js: now checks every .jsx under src/components (not only the
  converted list), catches text on its own line under a tag, skips `&&` code between tags.
- src/i18n/sweep.test.js: sign isolation, Hebrew gold, plural fallback, refusals and list labels
  in Hebrew, regiment names, every log ref kind for every real id resolves to Hebrew, and every
  literal `t('a.b')` key in src exists.
- .claude/skills/balance-sim/heLog.sim.js: plays a scripted game and prints every log line that
  still has Latin letters (or "<n>g") in Hebrew. Before: building and improvement names leaked;
  after: none (see below).
- scripts/ui/hebrew-audit.mjs repaired: rail tabs found by label, the player's start without a
  city, "Esc" allowed, onboarding buttons matched exactly, Linux Chromium path.

## Evidence
- `npm run lint` clean. `npm run test:quick` after the final merge: 4073 passed, 1 failed (src/engine/sight.test.js, which passes alone (4/4) and this branch does not touch: a load flake).
- Merge note: another lane added its own `isolateSigned` in src/i18n/messageText.js; this branch has one in src/i18n/core.js (used by `t()`, data text and engine messages). Both are idempotent and do not double-wrap; a later cleanup can keep one. Its test now expects "+11 זהב" instead of "+11g".
- Real-browser crawl in Hebrew at 844x390 (`node scripts/ui/hebrew-audit.mjs --swgl --shots`):
  see the result section below; shots in plans/ui/hebrew-audit/.

## Final crawl
On the merged branch (7e19dc40), Hebrew, 844x390, software GL: **91 screens clean, 1 finding**
(the ruler portrait's plinth showed the English initial "A"; fixed after the run: the initial now
comes from the Hebrew name). Before the sweep the same crawl also found the raw key
`research.turnsCount` on the research pill on every screen.

Covered: start steps, onboarding (7 pages), map and all lenses, every rail tab, log, settings,
research choice, peoples list, nation sheet, events, turn report, tile sheets, battle (deploy,
HUD, camp, selection, wand, build sheet, pause, retreat, result), nation overview, game over.
25 steps were SKIPPED by old audit code that predates later UI changes (stale testids such as the
government button, Legacy rail, fleet and route fixtures); they are reported, not passed. Those
screens are covered by the component check (no hard-coded English in any .jsx) and the key check.

Signs: `node scripts/ui/bidi-sign-check.cjs` measures glyph positions in Chromium: an isolated
"-10%" or "+50" keeps its sign left of the number, a raw one in RTL text flips (the old "11g+").

Headless log (heLog.sim.js, seeds 12 and 13, Israel): before the fix 7 lines with English names
(Storage Pits, Mine); after: 0 of 231 lines.

## Lead's Hebrew review list (88 lines, ai/human-playtest-40550085702, plans/ai-output/hebrew-review)
Most suggestions had already been pasted onto integration as written. Each was checked against
the English and the game's context:
- Repaired broken pastes: `bt.result.afterField` held only a sentence tail; `bt.def.giveUp` kept
  the gender clash (now "נסיגה של ה{ours} שלכם ... והעיר נופלת לידי {enemy}", no agreement).
- Reverted wrong "fixes": the signature units follow their English data (marcomannia is a modern
  Czech tank, sarmatians and avaria are hussars by design), and `bt.alert.enemyBroke` keeps the
  plural (squad names such as "קשתים" are plural).
- Prompt chips with `{name}` (war, peace, city demand, map offer): people names are sometimes
  places (אכד, feminine singular) and sometimes plural ethnonyms (הסרמטים), so the chips are now
  written without verb agreement ("הכרזת מלחמה מצד {name}", "ענו להצעת השלום של {name}").
  The same for `m.act.march`, `m.act.marchAttack`, `m.battle.raidDrivenOff` ({who} can be plural).
- Better words: גיחה (sally), קריאת קרב (rally cry), תאי שיט (canal locks), רפורמטורים,
  הערבות (steppe, not the Arava), בהישג ידם, הציגו (plural like the rest of the UI), the
  steppe crisis text, the difficulty line and two ruler virtues.
- Kept as is, on purpose: `p1.gcd.fromTo` (← reads forward in RTL), `p1.go.copyYears` (שוחקו is
  correct), וסאל, דיפ' (short labels beside the other short resource labels), the "One" lines keep
  {n} (the placeholder test requires it), `bt.screen.graphicsLost` (an error code).

# Plan: Hebrew support (Hebrew / English switch in the Menu card), 14 October 2026

The user asked for Hebrew support with a switch between Hebrew and English in the Menu card.

## What exists today

- No i18n library or string tables. All player text is written inline in about 128 JSX files, in
  view models (`*Model.js`), and in the engine.
- The engine writes log, event and report lines as finished English sentences (about 193 template
  lines in `src/engine` and `src/utils`, plus plain strings), saved inside the game state.
- Static game data carries English names and descriptions (113 files in `src/data`: peoples, techs,
  buildings, units, laws, events, wonders, resources, era goals).
- Fonts come from `--fa-font-body`, `--fa-font-display`, `--fa-font-mono`; the display font has no
  Hebrew letters.
- Layout is left to right, with the phone tab rail on the right (`useLayoutMode.js`, `pl:` variant).

## Decisions (the lead's, the user may change them)

1. **Library:** a small in-house `t(key, vars)` with plural rules from `Intl.PluralRules` and numbers
   and dates from `Intl.NumberFormat` / `Intl.DateTimeFormat` (BCE / CE written by us). No new
   dependency. Keys are English-free ids (`city.build.queueFull`), English is the fallback table.
2. **The switch:** Menu card, a row "Language: English / עברית", saved per device (localStorage, read
   defensively), applied at once without a reload, also on the title screen and start steps. Default:
   the device language if Hebrew, else English.
3. **Right to left:** `<html dir="rtl" lang="he">` in Hebrew. Use CSS logical properties
   (`ms-`/`me-`, `ps-`/`pe-`, `start`/`end` in Tailwind) instead of left/right. The phone tab rail
   moves to the left in Hebrew (mirror), End Turn and the chips follow `--rail-w`. Numbers, years,
   coordinates and unit counts stay left to right inside Hebrew text (`<bdi>` / `dir="ltr"` spans).
   The map, the globe and the battlefield are not mirrored; only the HUD around them is.
4. **Engine text:** the engine stops saving English sentences. New log and report entries store
   `{ key, vars }`; the UI renders them in the current language. Old saves keep their English strings
   and show them as they are (no migration of past text). This keeps the engine deterministic and
   lets the language change mid-game.
5. **Names (user ruling, 14 October: all or nothing):** in Hebrew, every name is written in Hebrew
   letters: all peoples, all cities, rulers, dynasties, generals, regiments, battles, wonders and
   rivers, never a mix of Hebrew and English on one screen. Names are transliterated (ישראל,
   ירושלים, מצרים, אכד, טנוצ'טיטלאן) by a reviewed table, with a deterministic transliteration rule as
   the fallback so a generated or rare name is still Hebrew. A test checks that no Latin letters
   appear in any name the Hebrew UI shows. Techs, buildings, units, laws, resources, wonders and events
   get full Hebrew names and texts.
6. **Fonts:** add a Hebrew-capable body and display face from Google Fonts (for example Heebo or
   Assistant for body, Frank Ruhl Libre for display), loaded only when Hebrew is on.
7. **Quality:** the first full Hebrew text is machine drafted, then reviewed by the user (a native
   speaker) screen by screen; a `?i18nKeys` dev flag shows keys instead of text to find misses.

## Phases

| Phase | Work | Size |
|---|---|---|
| H0 | `src/i18n/` (t, plural, number and date helpers, language store, `useT` hook), the Menu switch, `dir`/`lang` on `<html>`, the Hebrew fonts, a lint rule or test that flags new hard-coded player text in JSX | S |
| H1 | RTL layout pass: replace physical left/right classes with logical ones across components; mirror the rail and sheets; fix icons that point a direction (chevrons, arrows); screenshots in both languages at 844x390, 844x340 and desktop | M |
| H2 | Shell strings: title screen, start steps, top bar, rail, Menu, settings, End Turn, chips, prompts, panels' headings and buttons (the parts seen every turn) | M |
| H3 | Engine and log: `{ key, vars }` entries for logs, events, battle reports, peace and demand cards, notifications; renderer for both languages; old-save strings shown as is | L |
| H4 | Game data: names and descriptions in `src/data` (techs, buildings, units, laws, resources, wonders, events, era goals, independents, city-states) into per-language tables | L |
| H4b | Every proper name in Hebrew: peoples, all cities (each people's full city name list), rulers, dynasties, generals, regiments, battle names, rivers; reviewed table plus a transliteration fallback; test that the Hebrew UI shows no Latin letters in names | L |
| H5 | Battle UI: HUD, build sheet, inspect cards, result screen, battle report | M |
| H6 | Review: the user plays a session in Hebrew; fix wording, overflow (Hebrew is often shorter, but some labels run longer), and any RTL glitches; then a test that every key has a Hebrew value | M |

Order: H0 and H1 first (they touch layout everywhere and should land before other UI lanes add more
left/right code), then H2, then H3 to H5 in parallel lanes, then H6. Rough total: about 10 to 14
agent days. Each phase ships behind the switch, so English never breaks.

## Risks

- Every UI lane after H0 must use `t()`: the lint rule in H0 enforces it.
- RTL bugs hide in absolute positioning and transforms (sheets sliding in from the right, the march
  bar, tooltips): H1 screenshots both languages for every screen in `scripts/ui/panels-shots.mjs`.
- Log text in old saves stays English; the user accepted old saves breaking before, so this is mild.
- Text in canvases (map labels, sprite atlas text, battle HUD drawn in WebGL) needs the Hebrew font
  in the atlas and right-to-left shaping: check `spriteArt.js` and the city banners.

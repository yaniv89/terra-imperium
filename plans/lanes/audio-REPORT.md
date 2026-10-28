ponytail loaded

# Audio lane report (28 Oct 2026)

Branch `claude/audio`. Owner of src/audio/ and the sound settings.

## Step 1: audit

### What plays today (267 files, 29 MB, all CC0, listed in src/assets/audio/LICENSES.md)

| Layer | Ids / files | Where it plays | Size |
| --- | --- | --- | --- |
| Interface (ui) | 7 ids, 15 files: click, open, close, tab, toggle, error, confirm | uiSounds.js: one document click listener and one sheet observer | 140 KB |
| World map (world) | 33 ids, 63 files: turn end and begin, city founded, grows, captured, lost, razed, war, peace, pacts, trade, tech chosen and done, era, wonders, raids, sieges, rebellion, events, first contact, auto battle won or lost, victory, defeat | GameContext compares state before and after each dispatch (worldSounds.js), sfx.js plays at most three, 420 ms apart, most important first | 1.8 MB |
| Battle (battle) | 41 recorded ids, 140 files; 14 more ids synth only (stone, energy and robot age weapons, rout, bell, victory and defeat stings) | battleAudio.js: positional (only what the camera sees, panned), 16 voices, 6 new sounds a frame, cooldown per id, ambience bed follows how much fighting is on screen, war drums when it is heavy | 2.9 MB |
| Unit voices | 5 classes x select, order, attack, 42 files (wordless barks) | TacticalBattleScreen through sfx.playVoice, rate limited | 0.5 MB |
| Music | 10 map tracks (5 min each), 5 battle tracks, crossfaded playlists | music.js; battle playlist while a battle screen is open | 23 MB |
| Map ambience | 1 bed (map-wind: wind, birds, countryside, one picked), `map-sea` registered with no files | music.js under the map music | 1.3 MB |

Settings: one Sound switch, Effects and Music volumes, switches for battle sounds, music, interface
sounds and unit voices (audioSettings.js, per device). Phone rules are handled well already: one
shared Web Audio context, unlocked on the first tap, suspended whenever the page is away, iOS
`ambient` audio session (no background play, follows the silent switch), no media session, music
decoded at 24 kHz on phones, tracks parked and released when not heard. Files are fetched and
decoded on first use; the service worker does not precache audio.

### Measured levels (EBU R128 momentary max per folder, ffmpeg, then the gain chain at the default volumes)

The base commit's mix, heard at default volume (effects 0.8, music 0.5):

| | Heard (LUFS) |
| --- | --- |
| Map music | -24 |
| Battle music | -28 |
| Sword clash / spear thrust / shield block | -38 / -41 / -41 |
| Arrow release / arrow hit | -44 / -45 |
| Unit barks | -24 to -28 |
| ui-click / ui-open | -48 / -30 |
| era-advanced / city-lost / war-declared | -16 / -20 / -19 |

Variant spread inside one folder (the README asks for the same loudness): order-click 9.3 dB,
cavalry-hooves 7.5, worker-chop 7.4, explosion 6.8, fire-crackle 6.7, city-razed 5.9,
tech-selected 5.7, gold-received 5.7, death-cry 5.6, siege select bark 5.3.

### Against the references

- Age of Empires IV: combat is the foreground and music a bed under it; unit acknowledgements are
  clear but do not drown the fight. Here the core combat layer (hits, arrows) sat 10 to 17 dB
  under the battle music and 13 to 16 dB under the barks: battles sounded like music plus voices.
- Total War: a battle opens with horns and the fight has an ambience bed. The bed exists; the
  opening was silent.
- Civilization VI: era music that changes per era, short UI sounds, fanfares for eras and wonders.
  The fanfares and UI set exist; the music is one ancient and medieval playlist from 2000 BCE to
  2300 CE (lute and Egyptian tracks in the Future age), and map ambience never changes with terrain
  or age.
- Mastering basics: three buses (music, interface, battle) each wired straight to the speakers with
  no limiter; a war fanfare over music, or a sixteen-voice melee with gains near 1, can clip.

Bugs found: Arrow Storm sounded like a battering ram (`ram-impact`), and two folders shipped in
every build were never played (`arrow-whoosh`, `stone-impact`).

### Score: 6 / 10 before this lane

Strong engineering (lifecycle, phone rules, variants, cooldowns, spatial culling, sequencing) and
a complete list of feedback sounds. Lost points: the battle mix buried the combat, no limiter,
uneven variants, music and ambience blind to age and terrain, silent battle start, a wrong barrage
sound, synth-only stings for battle victory and defeat and for three age families.

## Step 2: what changed

| Change | Principle (reference) | Evidence |
| --- | --- | --- |
| Measured every effect folder: `scripts/audio/mix-levels.mjs` writes `src/audio/mixLevels.json` | Mix by measured loudness, not by ear per file | 98 folders, 249 files |
| Gains set from the measurements so each id lands in a tier; `src/audio/mixLevels.test.js` checks every recorded id within 2 dB | AoE IV layering: music bed, combat in front, alerts and fanfares above, UI taps under the music | Now heard: battle music -30, hits -31, volleys and siege -28, cannon and alerts -26, collapse and breach -24, barks -30, map music -24, UI taps -36, news -25, fanfares -21 |
| Battle bus 0.35 -> 0.6, barks 0.7 -> 0.41, battle music -4 -> -6 dB; synth-only ids scaled by 0.35/0.6 so they sound as before | Same as above | mixLevels.test.js |
| One limiter (DynamicsCompressor, -6 dB threshold, ratio 20, 3 ms attack) under all three buses: `audioOutput` in audioContext.js | Brick-wall limiting on the master bus, standard in game audio | audioContext.test.js |
| 16 variants brought within 3 dB of their folder (volume change only, re-encoded OGG q3) | Variants of one id must not jump in level (folder README) | Script log; explosion keeps a 6.8 dB spread on purpose (near and far blasts) |
| Start after deployment sounds the horn (`battleStarted`) | Total War and AoE open a fight with a horn | TacticalBattleScreen.jsx |
| Arrow Storm plays `arrow-whoosh`; other early barrages `stone-impact`; shells stay `explosion` | Sound must match what falls | battleAudio.test.js |

Unchanged on purpose: mute and volume switches, autoplay unlock, page-away suspension, phone
decode rate (all already correct and tested).

### Load and memory against the base commit (6ee09ec4)

- Audio on disk: 29,184,827 -> 29,202,873 bytes (+18 KB, +0.06%, the re-encoded variants).
- Built files: 267 OGG emitted before and after (the two newly used folders were already shipped).
  The JS bundle gains a few hundred bytes; mixLevels.json is test-only and not in the bundle.
- Nothing new at startup: every file is still fetched on first play; the service worker does not
  precache audio.
- Decoded memory: an Arrow Storm now decodes arrow-whoosh (2.9 s, 0.55 MB at 48 kHz) instead of
  ram-impact (5.6 s, 1.08 MB); an early barrage decodes stone-impact (0.92 MB) instead. No change
  elsewhere. The limiter is one node per context.

### Tests

- `npx vitest run src/audio src/battle/audio`: 11 files, 92 tests pass (new: mix tiers x4, limiter,
  barrage sounds; two fixtures updated to read the new constants).
- `npm run lint`: clean. `npm run build`: passes.
- `npm run test:quick` after merging origin/claude/integration: 480 files, 4,107 tests pass.

## Open (needs the lead or network access)

1. Music per age (largest gap). Needs CC0 tracks for gunpowder, modern, information and future
   (the current 10 tracks fit stone to kingdoms). Then tag tracks by age in the file name and filter
   the map playlist by `ageOf(state, player)`. This session's network policy blocks opengameart,
   freesound, kenney and archive.org, so no new files could be fetched.
2. Map ambience by terrain and age: `map-sea` is registered but has no files; no desert, snow,
   jungle or city beds. Same blocker.
3. Recorded battle victory and defeat stings and recorded stone, energy and robot weapon families
   (synth only today).
4. Optional: duck the battle music under heavy fighting (battleAudio already computes the fight
   level), as Total War does. Left out to keep this lane small.

### Score after this lane: 7 / 10

The battle now sounds like a battle, nothing can clip, variants are even and the two bugs are
fixed. Items 1 and 2 above are what stands between this and an 8 or 9.

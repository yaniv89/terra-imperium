ponytail read in full at 10:49 UTC, 28 Oct 2026 (`cat .claude/skills/ponytail/SKILL.md`, whole file; the session start hook also printed PONYTAIL MODE ACTIVE).

# Audio lane 2 report (28 Oct 2026)

Branch `claude/audio-2` from `origin/claude/integration` (base f60660b8), integration merged in
before the push. Owner of src/audio/ and the sound settings. No API use.

## Score before: 7 / 10

From the first lane (plans/lanes/audio-REPORT.md) and my own audit:
- One map playlist (10 ancient and medieval tracks) from 2000 BCE to 2300 CE: lutes in the Future
  age. Civ VI and AoE IV both change the score with the era or age; this was the biggest gap.
- Battle music at one fixed level whether two scouts or two armies fight; Total War raises its
  score with the fight.
- Map ambience: one random bed (wind, birds or countryside) whatever the camera shows; `map-sea`
  registered with no files.
- Battle victory and defeat stings synth only (two triangle-wave chords).
- Stingers for war, city founded, city lost, age reached, auto battle won or lost were already
  recorded and mixed (lane 1); fanfares played over full-level music.

## Network

Every audio source site (opengameart, freesound, kenney, archive.org, incompetech, freepd,
pixabay, wikimedia) is still blocked. apt works, so the new music is **composed for the game**:
seeded MIDI from `scripts/audio/compose-music.py`, rendered with FluidSynth and the FluidR3 GM
soundfont (MIT, Frank Wen; its notice is in LICENSES.md), released CC0. The sea, desert and jungle
beds are synthesised noise from `scripts/audio/make-ambience.py` (CC0). Both scripts rebuild the
files byte for byte from their seeds.

## Lead's licence check (message of 11:02)

- SoundFont: FluidR3_GM.sf2 (Frank Wen, 2000-2008), Debian/Ubuntu package fluid-soundfont-gm 3.1,
  upstream http://www.musescore.org/download/fluid-soundfont.tar.gz. Licence: MIT ("I hereby release
  Fluid under the MIT license"), which allows commercial use; its notice is reproduced in
  src/assets/audio/LICENSES.md under "This project's own music". No other soundfont was used.
- Total added audio: +22.2 MB on disk (17 music files 20.6 MB, 2 stings 0.2 MB, 3 beds 0.8 MB).
- Lazy per age: only the player's age's tracks are fetched, one at a time as each starts (the next
  40 s before the current ends); beds only for the land in view; nothing is precached.

## Every change

| Change | Reference | Where |
| --- | --- | --- |
| Map music by the player's age: `music/ages/<age>/`, 3 or 4 tracks per age (4.7 to 11.5 min of music per age). The 10 old tracks sorted by style into stone to gunpowder; 15 new pieces (one per early age, three each for modern, information and future, two for gunpowder). An age with no folder takes the nearest earlier one | Civ VI era music, AoE IV civ music by age | soundRegistry.js `musicTracks(age)`, `tracksForAge` |
| Each age's instruments and mode: stone pan flute, choir, toms (minor pentatonic); bronze double reed, harp, sitar, hand drums (Phrygian dominant); classical flute, harp, strings in 3/4 (Dorian); kingdoms recorder, shawm, lute, bagpipe drone, tabor in 6/8; gunpowder violin, harpsichord, cello (harmonic minor); modern horn, piano, strings, timpani; information vibraphone, electric piano, pads, light kit (Lydian); future crystal bells, halo and bowed pads, voice | Civ VI's per-era orchestration | compose-music.py AGES |
| Each piece builds and settles: intro, A, B, a thin bridge, A', B, A', outro; instruments enter and leave by section, the melody varies on its returns | AoE IV and Civ VI pieces grow in layers | compose-music.py FORM |
| Reaching a new age crossfades the map music to that age's tracks at once (under the era fanfare); a parked playlist starts there next time | Civ VI era change | music.js `setMusicAge`, called from GameContext after every dispatch with `ageOf(state, player)` |
| A quiet spell of 8 to 25 s between map tracks (only the ambience), random each time: repeats come less often and never back to back | Civ VI and AoE IV leave silence between pieces | music.js MAP_GAP_S |
| Battle music by age: the five ancient tracks for stone to kingdoms; new `battle/gunpowder/` (snare, brass, low strings) and `battle/information/` (synth bass, kit, synth brass) for the later ages | Total War: music fits the era | `battleMusicTracks(age)` |
| Battle music rises with the fighting on screen and falls after: -12 dB under the map level in a lull, -6 dB (lane 1's level) in a heavy fight, a 1.2 s glide; the recorded war drums already join above 0.45 | Total War battle music layers | music.js `setBattleIntensity`, from battleAudio.js's ambience level |
| Map ambience by the land at the centre of the view, once the camera settles: sea on water, birds and countryside over grass, plains and forest, desert wind on sand, jungle on jungle or Af/Am climate, cold wind on tundra, snow, ice and mountains; land by the sea adds surf at half; zoomed out to the world only the high wind. Beds crossfade over about 4 s; a silent bed is released after 20 s; a bed starts at a random point and never repeats its last variant | Civ VI map ambience follows the camera | mapAmbience.js (pure) + music.js `setMapAmbience`, GLMapView effect |
| New beds: sea (surf and swell), desert (moaning wind and sand), jungle (cicadas, crickets, distant birds); seamless 32 s loops at -22 LUFS like the old beds | | make-ambience.py |
| Recorded victory (brass fanfare, timpani) and defeat (falling horn over low strings) stings for commanded battles, in the -24 tier of collapse and breach | Total War, AoE end stings | battle/victory, battle/defeat, mixLevels.json |
| A fanfare (a `big` world sound: war declared, a new age, a wonder, victory, defeat) ducks the music to 0.35 while it plays | Civ VI ducks for era and wonder fanfares | sfx.js -> music.js `duckMusic` |
| READMEs, ACTIONS.md, LICENSES.md (moved paths, the new files, the soundfont notice) | | |

Unchanged on purpose: the stingers for war, founding, city lost, era and auto battles (lane 1 mixed
them), mute and volume switches, the Music switch, phone decode rate, page-away suspension, the
first-gesture unlock. All new playback goes through the same Music bus and volume, so mute and the
phone rules hold.

## Tests

- New: every age has 2+ tracks of its own and no track serves two ages; age fallback; battle
  tracks by age; a new age crossfades to its track (and the same age again does nothing); ambience
  follows the land, the old bed fades and is released; battle intensity rises and falls and resets
  for the next battle; the gap between map tracks; the duck; `ambienceMix` on five real Earth spots
  (Sahara desert, Amazon jungle, Atlantic sea, Siberia wind, Paris basin fields).
- `npx vitest run src/audio src/battle/audio`: 12 files, 102 tests pass. `npm run lint`: clean.
  `npm run build`: passes (286 OGG emitted).
- Full `npx vitest run` after merging integration: 505 files pass, 2 skipped; 4,729 tests pass, 17 skipped.

## Load and memory against the base commit (f60660b8)

- Audio on disk: 29.2 MB, 267 OGG -> 51.4 MB, 289 OGG (+22 MB: 15 map pieces at about 80 kbps,
  2 battle pieces, 2 stings, 3 beds). The site's first load is unchanged: every file is still fetched
  on first play and the service worker does not precache audio. A player downloads only the age they
  are in (1 to 1.8 MB a track, as it starts) and the beds of the land they look at (about 0.25 MB).
- Decoded memory is lower than before: the old first map track was 233 s (89 MB at 48 kHz); the
  new ones are 96 to 218 s (37 to 84 MB desktop, half on phones). Two beds at most live during a
  crossfade (12 MB each at 48 kHz, 6 MB on phones), others are released after 20 s silent. One track
  plus the preloaded next as before.
- Map: one `nearest` lookup when the camera settles: 0.03 ms (2000 lookups measured). Engine: no
  change (GameContext reads `ageOf` once a dispatch). Battle: one function call a frame that does
  nothing unless the level moved by 0.05.

## Score after: 8 / 10 (reasons)

+ Music now follows the player through all eight ages with each age's own instruments and mode,
  and changes when the age does (the gap the first lane named as the largest).
+ Battle music breathes with the fight, the drums join in heavy fighting, and battles end on
  recorded stings.
+ The map sounds like the place in view: sea, desert, jungle, fields, cold wind.
+ Fanfares no longer fight the music; quiet spells and 3 to 4 tracks per age keep repeats rare.
- Not a 9: the new pieces are procedural MIDI on a General MIDI soundfont. They are in tune, in
  form and even in level (checked by loudness, peaks and spectrograms), but **I could not listen to
  them**: a human ear (or the AI playtester, with the lead's budget) should judge them. Real
  recorded CC0 music per age (when the network allows) would beat them. Battle stings are one
  variant each. No ambience for cities, rivers or night.

## Open (for the lead)

1. Listen check of the 15 new pieces and the 3 beds; any piece judged weak can be regenerated with
   another seed (`python3 -I scripts/audio/compose-music.py <name>`) or deleted (the age falls back
   to its other tracks).
2. When an audio site is reachable: replace or add recorded CC0 tracks per age by dropping files in
   `music/ages/<age>/` (no code change).
3. Optional: leader or civilisation themes (Civ VI) per people: not done, it needs 150 pieces or a
   theme-variation system; a design call.

# Battle sound effects

One folder per sound id. The ids, their mix level and cooldown are in `src/audio/soundRegistry.js`
(`BATTLE_SOUNDS`). Drop files into a folder and the next build uses them (`import.meta.glob`); no
code change. Several files in one folder are variants: one is picked at random each time (never the
same one twice in a row). A folder with no files plays the built-in procedural sound, or nothing for
ids without one (`fire-crackle`, `war-drums`).

## Format
- OGG (Vorbis) or MP3, 44.1 kHz, mono for one-shots (the game pans them), stereo is fine for loops.
- Loudness: -14 to -20 LUFS integrated (short one-shots: peak around -3 dBFS). Keep the folder's
  variants at the same loudness.
- One-shots: trimmed tight at the start (no silence before the hit), under 2 s where possible.
- Loops (`battle-ambience`, `war-drums`): seamless, 10 to 60 s.
- No gore: `death-cry` is a soft, short cry or groan.
- File names: lower case, `-` separated, e.g. `sword-clash/clash-01.ogg`.

## Licence
Every pack needs a licence file next to its files (`LICENSE.txt` or `LICENSE.md`, with the source
URL and author). CC0 or a licence that allows use in a commercial game without attribution in the
game itself is preferred; CC-BY also works (credit goes in the licence file and the credits).

## Ids
| id | what |
| --- | --- |
| sword-clash | blades meeting, infantry melee |
| spear-thrust | spears, pikes, hoplites in melee |
| shield-block | a blocked blow (no damage) |
| arrow-release | one bow loosed |
| arrow-volley | many arrows at once (6 or more in a moment) |
| arrow-hit | arrows landing |
| cavalry-charge | horsemen hitting a line |
| cavalry-hooves | horsemen riding (heard now and then while they move on screen) |
| chariot-rumble | chariots riding or charging |
| ram-impact | a ram or a stone striking a wall, a stone shot landing |
| ballista-release | bronze and classical siege engines shooting |
| trebuchet-release | medieval siege engines throwing |
| cannon-fire | gunpowder and modern artillery |
| musket-volley | gunpowder age small arms |
| rifle-fire | modern small arms |
| explosion | shells, bombs, big blasts |
| building-collapse | a keep, wall, tower or building falling |
| fire-crackle | a building burning (razed) |
| death-cry | a squad lost (soft, no gore) |
| horn-order | horn or trumpet: rally, last stand, rally cry |
| rout | a squad breaking and fleeing |
| war-drums | loop, under heavy fighting on screen |
| battle-ambience | loop: distant clash and crowd, follows the fighting on screen |
| worker-chop | workers cutting wood |
| worker-mine | workers mining stone or gold |
| worker-build | workers building or repairing |
| order-click | an order given (interface) |
| bell | a point captured (interface) |
| victory | the battle won (interface) |
| defeat | the battle lost (interface) |

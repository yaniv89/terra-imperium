# Battle music

The RTS battle's playlist (`src/audio/soundRegistry.js` `battleMusicTracks`, played by
`src/audio/music.js`). While a battle screen is open the map music crossfades into these tracks;
when it closes the map music comes back where it was. They play in file name order, loop, with a
4 second crossfade, 12 dB under the map music while nobody fights, rising to 6 dB under it in a
heavy fight and falling back after (the battle's own sounds stay clear). The files directly here
play for the first ages; a folder named for an age (`gunpowder/`, `information/`) takes over from
that age on.

Wanted: steady, moderate pieces (drums, low strings or horns, an ancient or medieval flavour), not
epic trailer music.

## Format
- OGG (Vorbis), 44.1 kHz, stereo, 96 kbps, about -18 LUFS integrated, soft fade in and out.
- CC0 only; every file is listed in `src/assets/audio/LICENSES.md`.

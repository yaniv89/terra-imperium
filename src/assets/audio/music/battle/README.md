# Battle music

The RTS battle's playlist (`src/audio/soundRegistry.js` `battleMusicTracks`, played by
`src/audio/music.js`). While a battle screen is open the map music crossfades into these tracks;
when it closes the map music comes back where it was. They play in file name order, loop, with a
4 second crossfade, about 4 dB under the map music so the battle's own sounds stay clear.

Wanted: steady, moderate pieces (drums, low strings or horns, an ancient or medieval flavour), not
epic trailer music.

## Format
- OGG (Vorbis), 44.1 kHz, stereo, 96 kbps, about -18 LUFS integrated, soft fade in and out.
- CC0 only; every file is listed in `src/assets/audio/LICENSES.md`.

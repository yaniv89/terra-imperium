# Music

Tracks for the map (never in a battle). Every OGG or MP3 file directly in this folder is a track of
the playlist (`src/audio/soundRegistry.js` `musicTracks`, played by `src/audio/music.js`). They play
in file name order, so prefix them `01-`, `02-` to set the order; the list loops, with a 4 second
crossfade between tracks. The player sets the level with Settings > Sound > Music volume. Drop
files in and the next build uses them; no code change.

Map ambience beds (wind, sea), looped under the music, go in `ambience/<id>/` (see the README there).

## Format
- OGG (Vorbis) or MP3, 44.1 kHz, stereo, 128 to 192 kbps.
- Loudness: about -16 LUFS integrated for every track, so the playlist is even.
- 2 to 5 minutes a track; a soft start and end help the crossfade.

## Licence
Every pack needs a licence file next to its files (`LICENSE.txt` or `LICENSE.md`, with the source
URL and author). CC0 or a licence that allows use in a commercial game is preferred; CC-BY also
works (credit in the licence file and the credits).

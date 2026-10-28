# Music

The map's music, one folder per age: `ages/<age>/` (`stone` to `future`, the ids of
`src/data/ages.js`). Every OGG or MP3 file in the player's age's folder is a track of the map
playlist (`src/audio/soundRegistry.js` `musicTracks`, played by `src/audio/music.js`); when the
player reaches a new age the music crossfades to that age's tracks. An age with no folder plays the
nearest earlier age's. Tracks play in file name order from a random first one, loop, with a 4 second
crossfade. Keep two or more tracks per age so one never loops alone. The player sets the level with
Settings > Sound > Music volume. Drop files in and the next build uses them; no code change.

Battle music is in `battle/` (see its README). Map ambience beds go in `ambience/<id>/`.

`scripts/audio/compose-music.py` rebuilds the project's own tracks (`<age>-1.ogg`, `<age>-2.ogg`).

## Format
- OGG (Vorbis) or MP3, 44.1 kHz, stereo, 64 to 192 kbps.
- Loudness: -18 LUFS integrated for every track, so the playlist is even.
- 1 to 5 minutes a track; a soft start and end help the crossfade.

## Licence
Every file is listed in `src/assets/audio/LICENSES.md` with its source and author. CC0 or a licence
that allows use in a commercial game is required.

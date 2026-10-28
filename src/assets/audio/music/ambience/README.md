# Map ambience

Looped beds under the map music, one folder per id (`AMBIENCE_SOUNDS` in
`src/audio/soundRegistry.js`): `map-wind`, `map-fields`, `map-sea`, `map-desert`, `map-jungle`.
`src/audio/mapAmbience.js` picks the bed of the land at the centre of the view (and half a share of
sea on a coast); moving the camera crossfades the beds. If a folder holds several files one is picked
at random, never the same twice running. They follow the Music volume and stop in battles, like the
music. `scripts/audio/make-ambience.py` rebuilds the sea, desert and jungle beds.

## Format
- OGG (Vorbis) or MP3, 44.1 kHz, stereo, seamless loops of 30 to 120 s.
- Loudness: about -20 to -24 LUFS integrated (a quiet bed; the mix level in the registry lowers it
  further).

## Licence
A licence file per pack next to its files (`LICENSE.txt` or `LICENSE.md`, source URL and author).

# Wave 0 backlog: final partial checkpoint

Five logical items, seven variant files, 2026-10-07 on `claude/integration`:

| Logical item | Runtime delivery filenames |
| --- | --- |
| warship-bronze | ships/warship-bronze.glb |
| warship-classical | ships/warship-classical.glb |
| warship-kingdoms | ships/warship-kingdoms.glb |
| cathedral | buildings/cathedral.glb, buildings/cathedral-levant.glb |
| classical-town-big | towns/classical-town-big-a.glb, towns/classical-town-big-b.glb |

All filenames are relative to `src/assets/map/`. [Download final-five.zip](https://github.com/yaniv89/terra-imperium/releases/download/wave0-backlog-2026-10-07/final-five.zip) · [Manifest](manifest.json) · [Contact sheet](contact.png) · [Checksums](SHA256SUMS.txt).

The single ZIP is hosted as a GitHub release asset because its complete sources exceed GitHub's 100 MiB Git-file limit. The manifests, reports, previews and game GLBs are committed on `claude/integration`.

The final delivery contains packed editable BLEND files, **uncompressed** GLBs, three texture PNGs per variant, previews, validation and audit reports. Meshopt-compressed game copies are installed separately. The transferred historical reports are preserved as source evidence; the manifest records current files separately from original transfer hashes.

Local review found Classical town B below the Town/Team brightness floors and town A below the Team floor. Blender 5.2 OptiX mask bakes corrected those texture regions without changing geometry, UVs, alpha, Ground, normal or ORM source maps. Installed packed game copies measure town A: Town 0.471 / Team 0.360; town B: Town 0.326 / Team 0.386. Both pass browser loader checks at all three LODs and both requested viewport sizes, including red/blue team recolouring. `tone-correction.json` records each source correction.

Ships contain no sea plane. Water is used only in previews. Original 30 fps Idle/Walk timing and eight-phase LOD0 morph animation are retained; LOD1/2 use root heave. The current game includes a ship resolver and fleet placement. Its renderer does not play the authored swell animation; animation playback remains a separate integration limitation.

Cathedral/town exports match existing resolver paths. Atlas consolidation lowers texel density compared with separate source parts; distant LODs simplify openings and details. Full campaign camera, placement and scene performance acceptance at 1280×800 and 844×390 remain pending. Browser loader/renderer evidence is recorded separately and does not establish full campaign acceptance.

This is a five-item final partial checkpoint, not a padded twenty-item batch. Variants do not inflate logical item counts.

**Hosting status (2026-10-07, Claude):** the release `wave0-backlog-2026-10-07` has not been created yet, so the download links above do not work. The GitHub CLI is not installed on this PC, so the ZIPs could not be uploaded. The verified ZIPs (SHA-256 equal to [SHA256SUMS.txt](SHA256SUMS.txt)) are kept outside the repository in `C:\GitWotkspace\art-deliveries\wave0-backlog-2026-10-07\`. To publish: `gh release create wave0-backlog-2026-10-07 C:\GitWotkspace\art-deliveries\wave0-backlog-2026-10-07\*.zip`. `node scripts/art/downloads-coverage.mjs --items` checks every item of this checkpoint against the game from [manifest.json](manifest.json).

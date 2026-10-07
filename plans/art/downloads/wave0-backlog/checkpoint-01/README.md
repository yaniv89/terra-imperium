# Wave 0 backlog: checkpoint 01

20 existing logical items prepared on `claude/integration`, 2026-10-07. Each archive contains five items with editable Blender sources, **uncompressed** delivery GLBs, three 2048×2048 source texture PNGs, current 844×390 previews, validation reports and current file hashes. Meshopt-compressed game copies are separately installed at the paths in [manifest.json](manifest.json). ZIPs are hosted as release assets rather than stored in Git.

| Archive | Logical items |
| --- | --- |
| [part-1.zip](https://github.com/yaniv89/terra-imperium/releases/download/wave0-backlog-2026-10-07/part-1.zip) | naval_base, carrier_dock, road_post, highway, rail_depot |
| [part-2.zip](https://github.com/yaniv89/terra-imperium/releases/download/wave0-backlog-2026-10-07/part-2.zip) | copper_mine, iron_foundry, farm-bronze, farm-modern, mine-bronze |
| [part-3.zip](https://github.com/yaniv89/terra-imperium/releases/download/wave0-backlog-2026-10-07/part-3.zip) | mine-modern, fishing_boats-bronze, fishing_boats-modern, road-bronze, road-modern |
| [part-4.zip](https://github.com/yaniv89/terra-imperium/releases/download/wave0-backlog-2026-10-07/part-4.zip) | pasture-bronze, camp-bronze, quarry-bronze, lumber_camp-bronze, plantation-bronze |

[Checksums](SHA256SUMS.txt) · [20-item contact sheet](contact.png) · [Distant LOD contact sheet](lod2-contact.png) · [Correction QA](LOD-REPAIR-QA.md) · [Repair hashes](lod-repair-manifest.json) · [Runtime evidence](runtime-repaired-improvements.json) · [Current improvement tone](tone-repaired-improvements.json)

The 13 improvements now use continuous, correctly mapped Ground at LOD1/LOD2. Separate distant roofs, towers, animals, plants and boat hulls remain visible within the 300-triangle LOD2 limit. Original LOD0 geometry and UVs are exact. Ground RGB follows the current warm runtime import; original Town/Team atlas texels stay unchanged. Updated distant desktop and phone proofs are included in the affected item folders.

The first seven building sources retain editable sockets in the hidden `EditableDeliverySockets` collection, unparented with world positions preserved. Their game exports expose the bare model root and LOD0/LOD1/LOD2 children without socket empties; mesh transforms, UVs and materials are unchanged.

The unchanged structural validator passes all 20 delivery GLBs. Actual packed loaders, all three LODs, cloned/instanced Team tint and isolated rendering passed for the 13 repaired improvements at 1280×800 and 844×390, with no reported errors. [Phone gallery 1](runtime-phone-lod2-part-1.png), [gallery 2](runtime-phone-lod2-part-2.png), and [gallery 3](runtime-phone-lod2-part-3.png) show the final distant models. Full campaign play, in-game LOD transitions and scene performance remain acceptance work; this checkpoint does not claim the whole test suite passes.

Working files, obsolete backups and projection intermediates are excluded. Included historical JSON reports describe the original transfer; `archive-manifest.json`, `current-delivery.json` and the checkpoint manifest contain authoritative current hashes. Each ZIP is fully read locally and SHA-256 recorded. Release upload and remote verification are recorded separately after publication.

**Hosting status (2026-10-07, Claude):** the release `wave0-backlog-2026-10-07` has not been created yet, so the download links above do not work. The GitHub CLI is not installed on this PC, so the ZIPs could not be uploaded. The verified ZIPs (SHA-256 equal to [SHA256SUMS.txt](SHA256SUMS.txt)) are kept outside the repository in `C:\GitWotkspace\art-deliveries\wave0-backlog-2026-10-07\`. To publish: `gh release create wave0-backlog-2026-10-07 C:\GitWotkspace\art-deliveries\wave0-backlog-2026-10-07\*.zip`. `node scripts/art/downloads-coverage.mjs --items` checks every item of this checkpoint against the game from [manifest.json](manifest.json).

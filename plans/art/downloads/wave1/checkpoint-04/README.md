# Wave 1 checkpoint 04 — interim civic and tundra delivery

2026-10-07, branch `claude/bronze-towns`. Two deliveries: the base Bronze civic compound with intact, damaged and ruined roots, all three LODs; and seamless 1024 tundra color/AO WebP. Status `in_game_awaiting_review`.

[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [actual renderer contact sheet](contact.png).

Local Blender 5.2 / OptiX on the user’s PC. The civic design sheet preceded geometry; civic architecture reuses the existing original Bronze procedural house kit, with a new court, wing, canopy and lookout. Actual upper-corner cuts and rubble provide damage; the low ruined walls stay in the same footprint. One shared 2048 color/AO, normal, ORM atlas set; fixed local origins, no Ground mesh. All model budgets pass the unchanged validator using explicit per-root HQ/damage/ruin specs. Lower LOD atlas sampling is bounded inside matching source surfaces.

Tundra is original periodic procedural lichen/peat/stone, CC0, q95 WebP. Decoded shipping seams were checked in a 2×2 repeat. Actual 844×390 renderer proof has zero console or network errors. The detail selector supports explicit tundra; campaign climate routing remains pending.

Keep rendering supports three states, theme fallback, LOD and disposal. In capital cities an overlapping objective keep and palace share one visible palace, with the more severe damage state and the existing objective health bar. Existing intact palace models are reused. Missing art retains the previous fallback. Props and palace damage support is prepared, but their deliveries and the 12 regional civic variants are still being verified for the follow-up checkpoint.

Source archive: `C:\GitWotkspace\art-deliveries\wave1-2026-10-07-cp04\part-1-base-civic-tundra.zip`, outside Git. Includes editable BLEND, PNG atlases, GLB, design sheet, build scripts and validation/proof data.

Checks: full lint; 25 focused art/city tests and 5 ground tests; battle suite 272 active tests passed (two load-related timeouts passed on a single-worker rerun). Source/runtime images are review evidence, not human approval.

# Terra Imperium: detailed world terrain and destructible battle cities

Design extension, 5 October 2026. Inspected branch: `claude/bronze-towns`, commit `81b933b7d2125ddf567833eae3f7b92900bffb2a`. Companion to [the RTS implementation plan](terra-imperium-rts-plan.md). This defines required work and proposed budgets; it does not claim the visuals, performance or destruction system are implemented.

Clarified requirement: the defending city is the actual city shown on the campaign map. The battle consumes the same authoritative building/component roster, tiers, selected asset variants, placement and prior damage. Generic same-style substitute cities and independently generated filler buildings do not satisfy this requirement.

## 1. Intended result

The campaign map should have the visual coherence of a high-quality Civilization map: readable terrain, connected mountains and rivers, convincing forests, consistent buildings, and objects whose ground footprints fit their assigned cells. Keep the project's established real-Earth map, restrained hex overlay and mobile landscape layout. Use a cohesive art direction and shared placement rules across terrain, settlements, improvements and landmarks.

An invaded city is reconstructed from the actual buildings it has on the campaign map, including their types, tiers, selected architecture/asset variants, relative placement, landmarks, defenses and prior damage. The surrounding battlefield follows its geography. Its civilian buildings are individually destructible passive structures. Players can attack them, siege fire can hit them, and destroying them changes navigation and campaign damage. They do not gather, train, research or provide hidden battlefield bonuses. Active RTS buildings operate alongside them. Existing fortifications can fire only where actual city defenses justify a weapon emplacement.

The tactical city represents a selected urban area inside a campaign cell roughly 77 km across. It is not every building in a literal 77 km hex. Geographic identity should be accurate to the available data; historically accurate street layouts or individual real buildings need separate, higher-resolution sources and authoring. Do not present procedural neighborhoods as surveyed city reconstruction.

## 2. Evidence from the current branch

| Foundation | Observed behavior | Implication |
|---|---|---|
| World grid | Frequency-100 geodesic grid, 100,002 cells, approximately 29,250 land cells | World size calls for indexed visibility and streaming; it does not require drawing every cell in detail |
| Geographic build | `build-tiles.mjs` samples elevation and roughness and records climate-derived terrain, relief, features and river edges | Reuse geography; add local samples/direction where scalar classifications cannot describe a mountain chain or river bend |
| Close ground | `CloseTerrainLayer` draws raster quads; the terrain vertex shader does not displace height | Noise/detail shading currently improves a flat surface; real relief needs geometry and shared depth |
| Ground blending | `groundBlend.js` samples raster land colors and tints ground; land mask follows the hex coast | Useful foundation, but color tint alone cannot make an opaque ground plate blend naturally |
| Object fitting | `scale.js` limits town size by coast distance and nearby town spacing, with an inland room bound of 1.5 spacings | This is not containment against the actual assigned hex polygon |
| Landscape | Seeded tree placement, 22 trees per eligible hex, maximum 4,000; simple procedural trees/improvements | Instancing exists; replace prototype meshes and improve terrain-aware placement rather than adding thousands of individual scene objects |
| Cities | Hundreds of town GLBs, multiple eras/cultures, LODs; instanced landmark layer | Strong reuse base for roof/wall/material identity; a merged town asset is not automatically separable into destructible houses |
| Battle geography | `tileContextOf` reads the central cell and neighbors, roads, rivers, coast and siege state | Existing connection is useful, but it rotates the approach to west and loses some detailed terrain/architecture information |
| Battle terrain | `mapgen` uses terrain templates and seeded heights; `terrainSurface` already blends road/sand/rock/forest masks and builds a landscape skirt | Retain mask/skirt techniques while deriving the richer landscape from a shared geographic descriptor |

This audit covers source behavior, not a screenshot comparison or runtime benchmark. Existing asset file counts are not an estimate of how many assets already pass the new specification.

## 3. World rendering and detail levels

More total hexes mainly increase metadata, indexing and offline asset-build work. GPU cost follows visible triangles, material changes, pixels, shadows and texture residency. The solution is a hierarchy:

1. **World view:** existing raster/globe appearance with broad elevation shading, terrain colors and settlement symbols; no individual trees or houses.
2. **Regional view:** simplified terrain chunks, mountain-range silhouettes, connected rivers, grouped forest canopies, settlement LODs and strategic overlays.
3. **Close view:** terrain height mesh, rich terrain materials, individual instanced trees/rocks, fitted towns and improvements. Load only viewport chunks plus a small prefetch margin.
4. **RTS view:** load the one city battlefield and its backdrop, suspend campaign renderers, and reuse the same biome/material/architecture vocabulary at tactical scale.

Use projected screen size for LOD decisions, with hysteresis and short transitions to prevent flicker during zoom. Keep tile identity stable across zoom levels; changing LOD must not move a mountain, river mouth or city. Zoom thresholds alone do not account for viewport/device changes.

The existing flat ground and model overlays do not provide a common terrain/object depth buffer. The close-view upgrade needs one coordinated 3D terrain/object camera and depth pass, ideally one scene/renderer, so mountains occlude correctly and foundations sample the same height surface. Keep labels/hex ownership UI as projected overlays. Migrate this close-view layer progressively while retaining the globe/world raster at far zoom; installing a texture pack cannot supply this camera/depth integration.

Maintain a spatial index or visible chunk lookup. Current `landTilesOnScreen` walks all land tiles; replace repeated whole-world scans in camera updates with chunk candidates and exact viewport checks. Update placement only when camera/chunk/state revisions change. Cache generated placement with bounded eviction.

High and low quality tiers can differ in textures, decorative grass, shadows, water effects and mesh detail. They must show the same terrain identity, city location, geographic connectivity and damage state. Details must not obscure army locations or terrain information.

## 4. Fit objects to real cell footprints

Use each cell's actual projected/local polygon, rather than an assumed perfect regular hex or a bounding radius. Support the grid's exceptional polygons and projection distortion. Handle longitude seams and polar regions explicitly.

- Give each asset a ground footprint polygon, origin, width/depth, visual height, allowed rotation, placement class and ground-contact metadata.
- Define a safe polygon inset from each cell boundary. Use approximately 5–10% of local cell width as an initial margin for ordinary town/improvement bases, then validate in the intended camera.
- Rotate and scale the entire footprint, including walls, foundation and attached props; require every transformed footprint vertex/edge to remain inside the permitted area. Run overlap checks against roads, water, other reserved plots and neighbors.
- Store placement in local cell/world coordinates, not pixels. Screen projection must not change ownership or containment. Size objects for the available footprint and actual screen readability; do not inflate a town beyond its cell simply to fill the screen.
- A large city can extend into explicitly owned neighboring district cells. Each district has its own legal footprint; the center does not silently claim those cells.
- Docks, bridges and cross-cell road features have explicit shoreline/edge placement classes. Their permitted extension is part of the feature contract, not an accidental exception to containment.
- Decorative crowns, roofs and mountain peaks can visually overhang under an oblique camera. Check their ground footprint and readability rather than clipping the upper geometry at a hex wall.

Placement reserves space in this order: water and steep terrain, rivers/crossings, roads, city center/defenses, districts/landmarks, improvements, vegetation and small props. Use seeded blue-noise/Poisson-style scattering for natural objects. Avoid center-dot symmetry and identical layouts on every cell.

## 5. Continuous terrain and mountains

Represent terrain as spatial chunks with shared boundary samples. Hexes own metadata and placements, but do not need visibly separate six-sided ground plinths. Cache vertex heights/normals using canonical world-coordinate keys or shared edge/corner samples; stitch different LOD boundaries. No cracks, vertical steps or per-hex lighting seams.

Keep geography at two scales:

- Low-frequency shape from the current elevation/roughness data, with a separately chosen visual height exaggeration.
- Deterministic local detail and authored crag/ridge meshes conditioned on relief, slope, biome, latitude and adjacent terrain.

The current tile mean elevation cannot reconstruct local ridgelines. For close terrain, bake additional elevation samples and ridge/slope direction from existing raw elevation tiles or a higher-resolution DEM for selected regions. Build these offline into compressed chunks; do not query external GIS services as the user pans. Record source attribution and version in the build manifest.

Create mountain **chains**: orient ridges toward neighboring relief, preserve low passes and foothills, add cliffs on appropriate slopes, and place rocks at their bases. Use altitude/slope masks for exposed stone and snow. Do not scatter one disconnected mountain model on every mountain cell. River channels and settlements must occupy plausible valleys.

Geographic collision/gameplay uses the canonical terrain fields. Purely decorative rock detail cannot close a strategic route or alter a saved battle on a different quality setting.

## 6. Materials and blending

Publish a single visual reference: palette, sun direction, exposure/color space, roughness ranges, water color, terrain texture scale, building scale and team marks. Current vertex-color assets can remain; add baked ambient occlusion and measured atlas/normal-map detail where useful. Using photographic terrain with unrelated flat shaded houses will not achieve a coherent result by increasing mesh resolution.

- Use material-weight masks for grass, dry soil, sand, exposed rock, snow, wet soil and paving. Blend neighboring terrain through spatially stable masks and world-space UVs.
- Use slope-aware/triplanar mapping where steep cliffs would stretch a planar texture. Limit simultaneous texture samples on phones; benchmark the shader.
- Foundations sit on sampled terrain height. Flatten only the small designed plot or create a visible retaining wall/stilt foundation for slopes. Avoid floating houses, buried doorways and tilted buildings.
- Replace opaque rectangular town bases with terrain-conforming paving/earth patches, masked edges and dirt/grass transition strips. Existing ground tinting can modulate them but does not replace edge integration.
- Use consistent soft contact shadows or baked contact AO. Reserve expensive real-time shadows for useful nearby objects.
- Author river/shoreline masks from typed geographic data and edge connectivity. Raster colors can remain a visual fallback, but blue-versus-green pixel tests should not determine authoritative river or shoreline geometry.
- River edges connect across cells with identical shared crossing positions. Blend banks, shallow water, foam and shore vegetation; bridges have legal endpoints and correct terrain clearance.

Forest density follows the feature and local slope. Keep clearings around roads and occupied plots. Palette/size variations share geometry and material atlases; distant forests become canopy clusters/impostors rather than thousands of trees rendered with their finest meshes.

## 7. One geography and city descriptor

Create versioned `TileVisualDescriptor` and `CityLayoutDescriptor` records consumed by both map and battle generation. Illustrative fields:

```text
tileId, geographyVersion, terrainSeed
biome, climate, elevationSamples, roughness, slope/ridgeDirection
waterEdges, riverEdges, crossings, roadEdges, forestCoverage
cityId, cityLayoutVersion, stableLayoutSeed, localSiteTransform
architectureStyle, structureConstructionEra, cityTier, development
districts[], plots[], landmarks[], existingDamage[]
defenseTier, fortificationPlots[], gateLinks[]
```

Keep military equipment era separate from inherited architecture. A nation reaching Modern does not instantly replace every old temple, house or wall. Use current era for active troop/weapon unlocks and record construction style/era for city structures. A simpler initial release may use the current city's architectural family, but the contract should support retained older landmarks.

Both renderers must consume one authoritative `CityStructureManifest`. The world map renders these exact instances at its chosen LOD; the RTS renders those same instances at tactical detail and adds HP/navigation components. A distant merged district is allowed only as a render aggregation of that manifest. It cannot substitute a different roster or hide different houses in the battle. Building-for-building correspondence is a required first-slice contract, not a later visual upgrade.

The current renderer derives towns from city tier, era/style and a chosen town variant, then adds real category landmarks, capital palace, defenses and fields. Capture these choices in the manifest and extract the base town's house components from the selected source asset. Use the campaign state to enumerate built category/landmark instances regardless of whether their model has finished loading. Missing art gets a matching labeled fallback, not omission or an invented replacement city.

```text
CityStructureManifest {
  cityId, cityRevision, layoutVersion, manifestHash,
  townAssetId, variantId, architectureStyle,
  structures[{structureId, sourceKind, sourceId, sourceTier,
    sourceComponentId, assetId, localTransform, footprint,
    role, constructionEra, hpState, fortificationLinks}]
}
```

- Campaign building categories create only the instances the city actually owns at their current built tier. A tier upgrade replaces/upgrades that instance; unlocked but unbuilt buildings do not appear, and earlier tiers are not duplicated unless the campaign genuinely stores multiple structures.
- Town houses receive stable component IDs from an exported manifest of the actual selected town asset. Several meshes forming one house share one logical building ID and HP; windows, roofs and LOD children do not become separate buildings.
- Capital buildings, wonders, defense walls/towers, fields and other displayed city attachments use their actual source records and selected variants. Wall rings are exported into linked targetable segments while preserving the map's ring/gate layout.
- Retain relative neighborhood/landmark placements, orientation and road/gate connections. Map visual exaggeration and battlefield scale differ through a documented transform, not an unrelated procedural layout. Unit clearance must be validated against these shared plots; if art needs correction, update the shared map/battle source together.
- Asset variants and logical IDs are deterministic and versioned; do not use runtime Three.js UUIDs or whichever optional mesh happened to load first as identity.
- Persist manifest migrations when development/tier/era policy changes. Existing surviving or ruined instance IDs keep their history; new actual buildings get new IDs, and upgrades are explicit revisions.

Editable-source/component export is therefore a prerequisite. If a merged GLB has lost individual house boundaries, recover them from the Blender/build-script source or author a faithful component split. Keeping that GLB as a map proxy is acceptable only if its manifest matches the battle instances exactly. Until the contract passes, the city feature is incomplete.

Keep geographic north fixed in simulation/layout coordinates. Spawn on the true approach side. If the camera rotates for convenience, rotate only the camera and compass/UI; serialize the transform so rivers, roads, neighbor reinforcements and replays stay consistent. Replace the current automatic west-side geography rotation deliberately.

A desert coastal town should produce dry soil, scarce vegetation, its real water side, road/harbor connections and matching buildings. A forest river city should produce wooded approaches, matching river entry/exit edges and bridges. A mountain city needs slopes, terraced districts and plausible passes. Development changes density and defenses, not the biome.

## 8. Destructible city versus operational RTS buildings

Use explicit structure roles:

| Role | Examples | Default behavior |
|---|---|---|
| Passive civilian city | Houses, shops, civic halls, shrines, preexisting warehouses and workshops | HP, footprint, selection/attack target, damage and rubble; no production, gathering, research or combat aura |
| City objective | Civic command landmark and designated center | Same passive behavior plus explicit objective identity; destroying it starts the occupation path |
| Existing fortification | Walls, gates, tower/citadel emplacements | HP and navigation; weapons only when actual defense tier and era authorize them |
| Operational RTS | Expedition HQ, training buildings, gathered-resource depots, new housing and power infrastructure | Costs, construction, queues and stated functions from the RTS plan |
| Geographic/scenic object | Terrain, decorative street details and plants | Terrain/static dressing; designated resource trees/nodes have their own economy/destruction rules |

The city is not a blank field containing only barracks and a headquarters. Its houses, streets, districts and landmarks should be visible before the player constructs anything. All represented building-sized civilian structures in the playable area are individually destructible, including background-looking houses inside that area. Tiny props can be decorative.

Do not make every preexisting campaign building into an active RTS producer. Initial operational facilities, stockpiles and workforce are separately authorized by scenario setup and the city's actual development. Their plots and identities are distinct from passive city structures, so a barracks-looking city landmark cannot secretly train units or be counted twice.

Optional garrisonable civilian buildings are a later explicit mechanic. No house shoots merely because it has HP. First release permits firing from designated existing towers/fortifications and active RTS defenses. No city defense tier means no free wall ring or armed towers. Era determines bows, gunpowder weapons, machine guns/AA, range and equipment eligibility; it does not equip an old nation with another nation's weapon technology.

## 9. Layout density and structure simulation

The actual manifest determines how many city structures exist. The following are workload fixtures for stress testing, separate from army capacity and operational-building limits; they are not building counts to generate for a city or permission to add missing buildings:

| Stress fixture | Example actual-manifest workload | Navigation/art coverage |
|---|---:|---|
| Small town | 40–80 | Clear main street, square, clustered homes and outskirts |
| Standard city | 120–240 | Several connected blocks, distinct landmarks, flanking approaches |
| Large/capital | 300–500 | Dense center plus districts, broad military routes and defended gates |

Use audited city manifests or explicitly authored test-world cities to populate these fixtures. A real city with 18 displayed buildings has those 18, not 120 filler houses. A city with more than 500 is not truncated to this stress target: benchmark/admit its full manifest with the appropriate map/preset. All actual defending-city structures belong in the playable city area and have HP. Only landscape or explicitly separate neighboring settlements beyond the boundary may be low-detail non-targetable backdrop; do not move actual city buildings there to evade simulation costs.

Validate the actual shared streets/plots for infantry, mounted units, vehicles and siege, plus public squares/staging areas. Correct shared asset footprints or explicitly permitted tactical scale where necessary, preserving building identity and recognizable layout in both views. A dense city cannot defeat the 500/1,000-unit requirement by forcing every army through one narrow alley. Intentional chokepoints need bypass, breach or scenario disclosure.

Store passive buildings in compact static-structure pools:

```text
structureId, plotId, cityId, sourceDistrictId, sourceCampaignBuildingId?
role, archetypeId, constructionEra, architectureStyle, owner
footprint, fixedPosition, maxHp, hp, armor/materialProfile
damageStage, destroyedTick?, rubbleProfile, objectiveId?
```

Use a deterministic stable ID derived from the city/layout/plot contract. Put static footprints into spatial and navigation indices once. Passive structures need no per-tick AI, worker/job brain or repeated target search. Defense emplacements subscribe to weapon/targeting systems separately. Damage and occupancy changes create events/deltas, not a full scan of every house each tick.

## 10. HP, damage, ruins and path changes

Provisional base HP by archetype: small dwelling 800, larger dwelling 1,400, shop/workshop 1,600, warehouse/civic hall 2,400, major civic objective 5,000. Apply explicit material multipliers: timber 0.8, mud brick 1.0, masonry 1.4, reinforced concrete 2.0. These values require calibration against the revised unit damage/representative scale; they are not values observed in the current engine.

Keep fortification HP, armor and siege resistance in a separate defense-tier catalog. Infantry should be able to destroy vulnerable structures, while siege has a substantial anti-structure role. Aircraft and artillery splash queries include city footprints with bounded spatial queries. Decorative impacts cannot inflict duplicate damage or alter outcome through animation timing.

Visual stages: intact above 70%, damaged at 30–70%, heavily damaged below 30%, destroyed at zero. Renderer may attach smoke, roof damage and fire appearance. First release fire is visual feedback only; spreading gameplay fire needs a separate bounded deterministic mechanic. Show HP on selection, hover/long-press or recent damage rather than drawing hundreds of permanent bars.

On zero HP, resolve once at the authoritative tick:

1. Record damage/destruction against the original plot/campaign provenance.
2. Disable weapons/garrison interactions and objective components as appropriate.
3. Replace the footprint with authored ruin geometry and a deterministic navigation mask.
4. Clear invalid attack targets and notify affected path sectors.
5. Emit one destruction event, with pooled dust/fire/debris and a bounded sound priority.

Small-house rubble can become traversable at a published movement penalty; major stone ruins may remain partially blocked with a passable breach. Gates/walls open only their destroyed segments. A debris animation must never decide whether a route exists. Use preauthored ruins and a short collapse sequence, without hundreds of physics fragments.

Never embed units in new rubble masks. Choose a ruin mask contained in the former blocked footprint; if a moving gate/large transition can affect occupancy, validate deterministic evacuation/reservation rules. Cancel tasks directed at destroyed structures and avoid path-cache storms through sector-local invalidation and fixed job budgets.

Destroyed civilian structures cannot be replaced during the battle to erase recorded campaign losses. Operational RTS repair remains paid; existing civilian reconstruction happens after the battle through campaign repair. Optional temporary rubble clearing must keep the original destruction ledger.

## 11. Campaign consequences and repeated invasions

Persist plot-level damage/destruction for the represented district or a compact deterministic damage bitset plus partial-HP overrides. Store it in campaign/cloud saves alongside the layout version. The next battle uses those ruins/remaining HP; the map displays matching damaged district appearance. Do not regenerate a fresh intact city from a new seed on each invasion.

Map house damage to development/economic devastation through an explicit weighted loss rule. Starting proposal: sum damaged fractions times archetype redevelopment weights, divide by opening district weight, clamp to 0–1, then feed the existing aftermath adapter. Cosmetic small props carry zero economic weight. Plot ledgers track whether a loss has already been applied/repaired, so repeated attacks on old ruins cannot charge devastation repeatedly.

For campaign category landmarks, record the exact shared `structureId` and source building/category/tier that was damaged; apply its strategic functionality/repair changes through a source-specific aftermath adapter, once. Destroying that market affects that city's actual market; an unrelated category cannot be reduced instead. Base town houses update their same component's HP/ruin state and aggregate devastation. Keep civilian devastation, fortification siege HP, military casualties and workforce losses in disjoint ledgers. HP lost by a house is not automatically an equal number of dead campaign people. Civilian casualty simulation is not required to satisfy destructibility.

Existing defense integrity initializes tactical wall/tower HP. Reconcile destroyed fortifications back to the same siege/defense state, avoiding a second penalty from legacy siege aftermath. Housing constructed for the temporary RTS economy does not create a permanent city district for free.

Winning still follows occupation or military defeat in the RTS plan. Do not require destroying every passive house to end a battle. Deliberate civilian destruction can damage the conquered city's value, but an isolated shed cannot force another twenty minutes of cleanup.

## 12. Additional art and tooling

This is additional scope beyond the existing 78 operational RTS building/prefab tasks and 30 land-unit/worker profiles. Counts below are asset families/authoring tasks, not completed items or unique high-detail meshes for every hex.

| Deliverable | Initial catalog | Reuse approach |
|---|---:|---|
| Ground material families | 8 | Grass, dry steppe, desert sand, exposed rock, snow/ice, tundra, wet soil, city paving; material masks/normal/AO scales shared |
| Geographic mesh kits | 8 | Hills, mountain ridges, cliffs, dunes, coasts, rivers, lakes, wetlands; several shapes/LOD/connectors per kit |
| Vegetation kits | 6 | Temperate, conifer, Mediterranean, tropical/palm, scrub, cold/tundra; multiple mesh sizes and distant canopy variants |
| Geographic infrastructure kits | 4 | Roads, crossings/bridges, agricultural edges, shore/harbor details; same connectivity in map and RTS |
| Passive city component coverage | Audit actual town modules and built building/landmark catalogs first | Earlier 24-per-era/120-family figure is a provisional reusable asset-library allowance, not a spawn roster; prioritize faithful exports of existing map buildings |
| Civilization/culture appearance | Adapt existing regional kits | Roofs, doors, facades and palette swaps; do not immediately commission 120 × eleven complete models |
| Damage/ruin libraries | Five era material libraries plus per-archetype silhouette variants | Shared rubble/scorch/roof sections; intact, damaged and ruined states on each civilian family |
| Existing city landmarks/wonders | Adapt individually after audit | Preserve recognizable form, provenance, independent footprint/HP where represented |

Audit editable Blender/script sources before recreating town houses. Export individual modules with stable pivots/footprints and source mappings. A merged GLB may have lost building boundaries and useful ground contacts; it may require re-export from source. Shared modules can assemble both a low-detail town proxy and a close tactical neighborhood.

Existing Three.js, Web Workers, GLTFLoader, instancing and the project's meshopt/glTF import pipeline remain suitable. Add no new runtime engine by default. Blender handles module/LOD/ruin authoring; glTF Transform/gltfpack handle validation/optimization. KTX2/Basis texture compression is useful after testing the current material pipeline and target browsers. GDAL/QGIS or equivalent offline scripts can prepare terrain chunks and higher-resolution geographic masks; these are build tools, not required gameplay downloads.

Kenney/Quaternius terrain and building packs can supply prototypes where their actual license, source/export formats and silhouettes fit. More detailed paid terrain/building packs still require scale, material, team-mark and mobile-budget adaptation. Choose an art reference first; a collection of inconsistent packs cannot deliver the requested finish automatically.

## 13. Performance gates

Preserve the RTS plan's 500 combatants + 100 workers per side standard target and 1,000 + 100 large target. Passive buildings have their own pool and do not consume army capacity. Benchmark the full composition:

- Standard: 1,200 active units, approximately 240 passive city structures, both sides' operational buildings, walls, vegetation, fog and projectiles.
- Large: 2,200 active units, up to 500 passive city structures, expanded defenses, effects and dynamic breaches.

The proposed phone triangle/draw-call/texture budgets are **whole-scene** budgets. As an initial 500k-triangle planning split at mass zoom, allocate about 150k units, 150k buildings/fortifications, 120k terrain/vegetation and 80k effects/other geometry. This split is a hypothesis to profile; close zoom redistributes the budget because fewer objects are visible.

For example, 500 visible civilian buildings at 200 triangles each use 100k triangles; at 5,000 each they use 2.5 million before a soldier is drawn. Use projected-size LODs, distant neighborhood aggregation and instancing by archetype/material/state. If a merged distant district is rendered, retain each structure's authoritative ID/footprint and invalidate or rebuild that district's visual batch after destruction. Aggregation must not turn individually destructible houses into one shared-HP target.

Use static structure grids for targeting/collision, event-driven HP/state uploads, shared damage materials and pooled effects. Batch a burst of destruction into dirty-sector navigation work within the deterministic job budget. Limit simultaneous fire/smoke/collapse animations; all actual damage events still occur. Prototype mass wall breaches while worker routes and combat target acquisition are active.

For the campaign map, benchmark a viewport packed with adjacent towns, forests and mountains; repeated pan/zoom; coast transitions; and ten map/battle/map cycles. Set chunk residency, prefetch and memory budgets from real hardware. Never leave both campaign and RTS renderers fully active.

## 14. Implementation sequence and effort

1. **Visual reference and source audit:** select representative Civilization-quality references, decide stylization, inspect existing editable modules, capture current screenshots/device timings. Deliver one style/material/scale sheet and a reuse matrix.
2. **Campaign terrain slice:** one temperate river/coastal cluster plus a neighboring mountain cluster, exact footprint fitting, shared terrain boundaries and two zoom detail levels. Prove the effect before generating global content.
3. **Shared city manifest:** export one actual Classical city's selected town components, built landmarks/tiers, capital/defense attachments and placements; both map and battle consume identical structure IDs. Prove roster parity before adding destruction or building-volume stress fixtures.
4. **Destruction slice:** individual HP, attacks/splash, damage stages, authored ruins, breach navigation, saves and campaign damage. Test a second invasion of the damaged city.
5. **Full-load gate:** combine the city with the large-army kernel, workers, projectiles and fog, and run real phone/desktop sustained tests. Resolve performance before broad art expansion.
6. **World/content expansion:** six biome appearance families, remaining eras, culture modules, geographic transitions, larger cities and landmarks. Regional authoring follows the proven pipeline.

Broad incremental planning allowance: 8–16 engineering person-weeks for campaign terrain/placement/rendering work, 4–8 for city descriptor/destruction/persistence work, and roughly 12–24 technical-art/art person-weeks for the first coherent biome and civilian-building libraries with source reuse. These are uncertain incremental allowances, with overlap in RTS navigation, LOD, material and prefab work already budgeted. Do not simply add every range to the previous RTS estimate; re-estimate together after the first full-load slice. Fully bespoke five-era × eleven-culture assets and surveyed real-city reconstructions would be separate, substantially larger scope.

## 15. Acceptance checklist

- At world, regional and close zoom, terrain remains geographically consistent, and rivers/mountain chains connect across cell/chunk boundaries.
- Ground footprints stay inside their declared cells/plots; intended edge features have explicit legal spans. Test neighboring towns, coastlines, exceptional polygons, polar views and longitude seams.
- No floating foundations, visible square ground plates, terrain cracks, rivers ending at hex edges, sudden scale changes or palette mismatch.
- The battle reproduces the invaded city's biome, relief, water/road directions, architecture, development, defenses and prior damage.
- Manifest parity: every actual map-city structure/component appears exactly once in the battle with the same stable ID/source/tier/variant; no unbuilt landmark or independently generated house is added. Compare canonical ID sets and source records rather than LOD mesh counts. Test missing/delayed art, city upgrades, saved ruins and loading the map/battle in either order.
- Every represented civilian building in playable space can be selected/targeted, takes authoritative damage, creates consistent rubble/navigation and persists its loss once.
- Passive civilian structures never grant undeclared production, auras or weapon fire. Actual defense tier/era determines walls and emplacements.
- Victory does not require demolishing all civilian scenery.
- Replay/checkpoint restore matches HP, ruins, occupancy, defensive fire and campaign results; a second invasion begins with previous damage.
- Sustained full-city scenes meet the validated 500/1,000-unit presets on their published supported devices. Screenshot quality alone is insufficient evidence.

## 16. Source links

- [Geographic grid build and elevation sampling](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/scripts/geo/build-tiles.mjs)
- [Current close terrain layer](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/components/map/closeView/CloseTerrainLayer.jsx)
- [Terrain shader](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/components/map/closeView/terrainShader.js)
- [Town scaling and room limits](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/components/map/closeView/scale.js)
- [Ground color blending](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/components/map/closeView/groundBlend.js)
- [Current trees and improvements](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/components/map/closeView/landscape.js)
- [Town-art scale, LOD and layout brief](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/plans/town-art-brief.md)
- [Battle tile/neighbor context and current rotation](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/setup/tileContext.js)
- [Battle ground blending and landscape skirt](https://github.com/yaniv89/terra-imperium/blob/81b933b7d2125ddf567833eae3f7b92900bffb2a/src/battle/render/terrainSurface.js)

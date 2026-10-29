ponytail loaded in full at the session start (Skill `ponytail:ponytail` printed the whole SKILL.md; the start hook printed PONYTAIL MODE ACTIVE).

# Lane map-speed-8 (U10, F145): report

Branch `claude/map-speed-8`, base b25b72a4. UI and renderer only, no engine change. No API use.

## For the lead
No design call open. One deviation from U10: the first frame keeps labels. The profile showed labels cost about 0.1 s; the whole black wait was the territory shader's link, so labels were not held back.

## Root cause
CPU profile of Begin to first frame (desktop, real GPU, ANGLE D3D11): one 9.7 s main-thread task, then a second 9.7 s one, all inside three.js `getUniforms` (the blocking program link) of the territory shader. Its loops had constant bounds, so the D3D11 compiler unrolled them all. It is linked twice: once for the cached texture, once for the live draw used while zooming (that second one is the "black after scroll-zoom").

## Fix
- territoryShader.js: loop bounds come from a uniform (`uLoops`, set in glLayers.js `LOOPS`). Raw link 5.6 s to 0.94 s.
- glLayers.js: `createTerritoryCache().warm()` links both programs with `renderer.compileAsync` (KHR_parallel_shader_compile, off the main thread); the territory pass draws nothing until then, so the Earth shows at once. Raster layer: the world picture is asked once (it was asked again every frame while loading or after a failure), `stats().loading` and `stats().failed` count on-screen pictures, `retry()` asks again.
- GLMapView.jsx: a small "Loading map detail" chip while the shader or on-screen pictures load; a "Map detail did not load: Retry" chip on failure (en and he). The low-detail Earth stays drawn under failed tiles.
- tileGpuData.js: lookup build without per-texel objects (bytes identical, 95 to 70 ms in Node).
- scripts/perf/map-pan.mjs `--load`: ms from Begin to the first frame and to full detail, and after a wheel zoom out and back in.
- Tried and dropped: prefetching the GL map chunk on the start screen (no gain beyond noise).

## Numbers (same machine, back to back, `node scripts/perf/map-pan.mjs --load --no-build --profiles <p>`, each profile a fresh browser)
| build | profile | first frame after Begin, ms | full detail, ms |
|---|---|---|---|
| base | desktop | 8421, 5509 | same (no chip then) |
| after | desktop | 979, 860, 1026, 1038 | 3156, 2673, 3401, 3842 |
| base | phone (4x CPU) | 8026, 12464 | same |
| after | phone (4x CPU) | 5151, 3094, 2647, 4539 | 11077, 7007, 5927, 8737 |

The phone's remaining wait before the first frame is CPU (game start reducer, tribalCamps.js about 0.5 s at 4x; the map's first render), not the GPU. The "territories within 1 s on the phone profile" scenario is not met: after the first frame the chip shows while the territories link.
Pan (map-pan default, k 4/12/40): step median unchanged (13.9 ms both); fps within noise (phone k4 109 vs 126, k40 80.5 vs 70.5).

## Evidence
- `node scripts/ui/map-speed-8-shots.mjs` (preview on 4251, 844x390 touch and 1600x900, en and he): all 24 checks ok; shots in `plans/lanes/map-speed-8-shots/` (first frame, Retry chip with tiles aborted, after Retry).
- Tests: new `src/components/map/gl/glLayers.test.js` (world asked once, failed world and tile retry, Earth stays drawn under a failed tile, territory waits for link, no constant loop bound). `npm run test:related` on the map files: 12 files, 95 passed. src/i18n: 10 files, 131 passed. Lint `--no-ignore` clean on every touched file.

## Not done / risks
- Not checked on a real phone GPU or Safari (KHR_parallel_shader_compile missing there means a blocking but now about 1 s link).
- After a lost and restored WebGL context the programs relink blocking (about 1 s now).

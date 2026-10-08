// Native camera and live LOD/UV audit; called after asset readiness and real Start/Pause.
export async function captureTerrainFar({ page, row, scenario, base, shoot }) {
// Far screenshots use the real paused renderer and native zoom clamp.
if (!scenario.crossing) throw new Error('Far terrain harness accepts river scenarios only');
row.farAudit = [];
const farTargets = row.audit.targets.filter((target) => target.name.startsWith('bridge-')).slice(0, 1);
if (farTargets.length !== 1) row.gaps.push('Expected live bridge target');
for (const zoom of [0.5, 0.45]) for (const target of farTargets) {
  await page.evaluate(({ zoom, target }) => {
    const r = window.__battleRenderer;
    r.zoomBy(zoom / r.camera.zoom);
    r.centerOn(target.x, target.z);
    r.updateCamera();
  }, { zoom, target });
  await page.waitForFunction(({ zoom, expected }) => {
    const r = window.__battleRenderer;
    return r && Math.abs(r.camera.zoom - zoom) < 1e-6 && r.terrainArt?.lod === expected;
  }, { zoom, expected: zoom === 0.5 ? 1 : 2 }, { timeout: 15000 });
  await page.waitForTimeout(600);
  const audit = await page.evaluate(async ({ baseURL, zoom, name }) => {
    const { kitLodForZoom } = await import(`${baseURL}src/battle/art/kitInstances.js`);
    const { parseKit, lodOf } = await import(`${baseURL}src/battle/art/kitLoader.js`);
    const { loadGltf } = await import(`${baseURL}src/battle/render/gltfUnitLoader.js`);
    const { ART } = await import(`${baseURL}src/battle/art/artFiles.js`);
    const r = window.__battleRenderer; const layer = r.terrainArt;
    const expected = kitLodForZoom(zoom); const roots = []; const gaps = [];
    const visible = (mesh) => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    const equalUv = (a, b) => !!a && !!b && a.itemSize === b.itemSize && a.count === b.count &&
      Array.from({ length: a.count }).every((_, i) => a.getX(i) === b.getX(i) && a.getY(i) === b.getY(i));
    for (const [kind, rootName] of [['bank', 'bank'], ['ford', 'ford'], ['bridge', layer.bridgeName]]) {
      const kit = layer.kits[kind]; const obj = kit?.objects[rootName];
      const ref = kind === 'bridge' ? ART.bridge(r.setup.sides[1]?.ageId || r.setup.sides[0]?.ageId) : ART.terrain(kind === 'bank' ? 'river-kit' : 'ford');
      if (!obj || !ref) { gaps.push(`Missing native ${kind} kit/root`); continue; }
      // Already loaded native asset; never add a model to the scene or alter its UVs.
      const gltf = await loadGltf(ref.url);
      const preservedKit = parseKit(gltf.scene, { repairLodUvs: false });
      const preserved = preservedKit.objects[rootName];
      let rawRoot = null; gltf.scene.traverse((node) => { if (node.name === rootName) rawRoot = node; });
      const bundle = obj.lods[expected]; const uv = bundle?.geometry.attributes.uv;
      const nativeLodChild = !!rawRoot?.children.some((node) => lodOf(node) === expected);
      const inheritedBundle = !bundle || obj.lods.slice(0, expected).some((prior) => prior === bundle);
      const e = bundle && layer.pieces.meshes.get(bundle);
      const active = !!e?.mesh.parent && visible(e.mesh) && e.mesh.count > 0 && e.mesh.geometry === bundle.geometry;
      const activeLevels = obj.lods.map((b, lod) => {
        const m = layer.pieces.meshes.get(b)?.mesh;
        return m?.parent && visible(m) && m.count > 0 ? lod : null;
      }).filter((lod) => lod !== null);
      const uvFlags = {
        attributePresent: !!uv,
        finite: !!uv && Array.from(uv.array).every(Number.isFinite),
        sameAsPreservationOnlyParse: equalUv(uv, preserved?.lods[expected]?.geometry.attributes.uv),
        repairFlagExposed: Object.hasOwn(bundle || {}, 'uvRepairApplied') || Object.hasOwn(bundle?.geometry.userData || {}, 'uvRepairApplied'),
        repairFlag: bundle?.uvRepairApplied ?? bundle?.geometry.userData?.uvRepairApplied ?? null,
        sourceRootExtras: rawRoot?.userData || {},
        geometryMetadata: bundle?.geometry.userData || {}
      };
      roots.push({ kind, rootName, url: ref.url, requestedLOD: expected, nativeLodChild, inheritedBundle,
        active, activeLevels, copies: e?.mesh.count || 0,
        triangles: bundle ? bundle.geometry.index.count / 3 : null, uvFlags });
      if (!nativeLodChild || inheritedBundle || !active || activeLevels.length !== 1 || activeLevels[0] !== expected)
        gaps.push(`Native LOD${expected} not exclusively drawn: ${rootName}`);
      if (!uvFlags.finite || !uvFlags.sameAsPreservationOnlyParse || uvFlags.repairFlag === true)
        gaps.push(`Runtime UV preservation failed: ${rootName} LOD${expected}`);
      // Only dispose fresh comparison geometries, never live or cached source geometry.
      const comparisons = new Set(Object.values(preservedKit.objects).flatMap((o) => o.lods.map((b) => b.geometry)));
      comparisons.forEach((geometry) => geometry.dispose());
    }
    const focused = roots.find((root) => root.rootName === name);
    const liveObj = focused && layer.kits[focused.kind]?.objects[name];
    const liveMesh = liveObj && layer.pieces.meshes.get(liveObj.lods[expected])?.mesh;
    let projectedTargetBounds = null;
    const uiSafeBounds = { left: 24, right: r.width - 24, top: 110, bottom: r.height - 90 };
    let projectedTargetCenter = null;
    if (liveMesh?.count) {
      const geometry = liveMesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      r.scene.updateMatrixWorld(true);
      const instance = liveMesh.matrix.clone(); liveMesh.getMatrixAt(0, instance);
      const transform = liveMesh.matrixWorld.clone().multiply(instance);
      const box = geometry.boundingBox; const points = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = r.target.clone().set(x, y, z).applyMatrix4(transform).project(r.camera);
          points.push({ x: (p.x + 1) * r.width / 2, y: (1 - p.y) * r.height / 2 });
        }
      projectedTargetBounds = { left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
        top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)) };
      projectedTargetCenter = { x: (projectedTargetBounds.left + projectedTargetBounds.right) / 2,
        y: (projectedTargetBounds.top + projectedTargetBounds.bottom) / 2 };
      if (projectedTargetBounds.left < uiSafeBounds.left || projectedTargetBounds.right > uiSafeBounds.right ||
          projectedTargetBounds.top < uiSafeBounds.top || projectedTargetBounds.bottom > uiSafeBounds.bottom)
        gaps.push(`Far target overlaps UI-safe frame boundary: ${name}`);
      if (projectedTargetCenter.x < r.width * 0.25 || projectedTargetCenter.x > r.width * 0.75 ||
          projectedTargetCenter.y < r.height * 0.3 || projectedTargetCenter.y > r.height * 0.7)
        gaps.push(`Far target is not centrally framed: ${name}`);
    } else gaps.push(`No live instance for far target ${name}`);
    if (layer.lod !== expected) gaps.push('Layer selected LOD disagrees with kitLodForZoom');
    if (r.renderer.getContext().isContextLost() || !r.diagnostics().drawCalls) gaps.push('No live WebGL draw');
    return { target: name, requestedZoom: zoom, actualZoom: r.camera.zoom, expectedLOD: expected,
      selectedLOD: layer.lod, roots, projectedTargetBounds, projectedTargetCenter, uiSafeBounds,
      actualTile: r.setup.tile, simTick: window.__battleTest.tick(),
      diagnostics: r.diagnostics(), syntheticState: false, forcedLOD: false, gaps };
  }, { baseURL: base.href, zoom, name: target.name });
  row.farAudit.push(audit); row.gaps.push(...audit.gaps);
  await shoot(`far-LOD${audit.expectedLOD}-zoom${zoom}-${target.name}`);
}
}

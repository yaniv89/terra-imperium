// Native camera and live LOD/UV audit; called after asset readiness and real Start/Pause.
export async function captureConiferFar({ page, row, base, shoot }) {
row.farAudit = [];
const target = row.audit.targets.find((t) => t.name === 'vegetation-conifer');
if (!target) throw new Error('No native conifer target found');
for (const zoom of [1, 0.5]) {
  await page.evaluate(({ zoom, target }) => {
    const r = window.__battleRenderer;
    r.zoomBy(zoom / r.camera.zoom);
    r.centerOn(target.x, target.z);
    r.updateCamera();
  }, { zoom, target });
  await page.waitForFunction(({ zoom, expected }) => {
    const r = window.__battleRenderer;
    return r && Math.abs(r.camera.zoom - zoom) < 1e-6 && r.vegetation?.lod === expected;
  }, { zoom, expected: zoom === 1 ? 1 : 2 }, { timeout: 15000 });
  await page.waitForTimeout(600);
  const audit = await page.evaluate(async ({ baseURL, zoom }) => {
    const { vegetationLodForZoom, PROP_OBJECTS } = await import(`${baseURL}src/battle/art/vegetationProps.js`);
    const { vegetationKitFor } = await import(`${baseURL}src/battle/art/vegetation.js`);
    const { parseKit, loadKit, kitObject, lodOf } = await import(`${baseURL}src/battle/art/kitLoader.js`);
    const { loadGltf } = await import(`${baseURL}src/battle/render/gltfUnitLoader.js`);
    const { ART } = await import(`${baseURL}src/battle/art/artFiles.js`);
    const r = window.__battleRenderer; const layer = r.vegetation;
    const expected = vegetationLodForZoom(zoom); const roots = []; const gaps = [];
    if (vegetationKitFor(r.setup) !== 'conifer') gaps.push('Actual tile did not select conifer');
    const ref = ART.vegetation('conifer');
    const gltf = await loadGltf(ref.url); const kit = await loadKit(ref.url);
    const preserved = parseKit(gltf.scene, { repairLodUvs: false });
    const equalUv = (a, b) => !!a && !!b && a.itemSize === b.itemSize && a.count === b.count &&
      Array.from({ length: a.count }).every((_, i) => a.getX(i) === b.getX(i) && a.getY(i) === b.getY(i));
    const visible = (mesh) => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    for (const kind of ['pine', 'oak']) {
      const value = layer.kinds?.[kind]; if (!value) continue;
      const obj = kitObject(kit, PROP_OBJECTS[kind]); const bundle = obj?.lods[expected];
      let rawRoot = null; gltf.scene.traverse((node) => { if (node.name === obj?.name) rawRoot = node; });
      const nativeLodChild = !!rawRoot?.children.some((node) => lodOf(node) === expected);
      const inheritedBundle = !bundle || obj.lods.slice(0, expected).some((prior) => prior === bundle);
      const meshes = value.list.filter((mesh) => mesh.parent && visible(mesh) && mesh.count > 0);
      const uv = value.levels[expected]?.geometry.attributes.uv;
      const uvFlags = { attributePresent: !!uv, finite: !!uv && Array.from(uv.array).every(Number.isFinite),
        sameAsPreservationOnlyParse: equalUv(uv, preserved.objects[obj?.name]?.lods[expected]?.geometry.attributes.uv),
        repairFlagExposed: Object.hasOwn(bundle || {}, 'uvRepairApplied') || Object.hasOwn(bundle?.geometry.userData || {}, 'uvRepairApplied'),
        repairFlag: bundle?.uvRepairApplied ?? bundle?.geometry.userData?.uvRepairApplied ?? null,
        sourceRootExtras: rawRoot?.userData || {}, geometryMetadata: bundle?.geometry.userData || {} };
      const exclusivelySelected = meshes.every((mesh) => mesh.geometry === value.levels[expected].geometry);
      const activeLevels = [...new Set(meshes.map((mesh) => value.levels.findIndex((level) => level.geometry === mesh.geometry)))];
      roots.push({ kind, rootName: obj?.name, requestedLOD: expected, nativeLodChild, inheritedBundle,
        activeLevels, copies: meshes.reduce((n, mesh) => n + mesh.count, 0), exclusivelySelected,
        triangles: bundle ? bundle.geometry.index.count / 3 : null, uvFlags });
      if (!meshes.length || !nativeLodChild || inheritedBundle || !exclusivelySelected)
        gaps.push(`Native conifer ${kind} LOD${expected} fallback or not drawn`);
      if (!uvFlags.finite || !uvFlags.sameAsPreservationOnlyParse || uvFlags.repairFlag === true)
        gaps.push(`Runtime conifer UV preservation failed: ${kind} LOD${expected}`);
    }
    new Set(Object.values(preserved.objects).flatMap((o) => o.lods.map((b) => b.geometry))).forEach((g) => g.dispose());
    if (!roots.length || layer.lod !== expected) gaps.push('Conifer native LOD not selected');
    if (r.renderer.getContext().isContextLost() || !r.diagnostics().drawCalls) gaps.push('No live WebGL draw');
    return { requestedZoom: zoom, actualZoom: r.camera.zoom, expectedLOD: expected, selectedLOD: layer.lod,
      roots, actualTile: r.setup.tile, simTick: window.__battleTest.tick(), diagnostics: r.diagnostics(),
      syntheticState: false, forcedLOD: false, gaps };
  }, { baseURL: base.href, zoom });
  row.farAudit.push(audit); row.gaps.push(...audit.gaps);
  await shoot(`far-LOD${audit.expectedLOD}-zoom${zoom}-conifer`);
}
}

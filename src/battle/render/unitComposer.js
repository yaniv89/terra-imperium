// src/battle/render/unitComposer.js
// Composed units: one CC0 archetype model (a rigged soldier) dressed for a given age and class by a
// small JSON "recipe", then baked into ONE instancing-ready geometry by gltfUnitLoader — so a single
// downloaded humanoid covers the whole {age}-{class} matrix without shipping twenty copies of it.
//
//   { "base": "character-soldier",        a model in src/assets/units/_src/ (scripts/fetch-models.js)
//     "restClip": "idle", "teamFrom": "torso", "height": 1,
//     "attach": [ { "model": "weapon-spear" | "prop": "bow", "hand": "right" | "left",
//                   "at": [x, y, z], "rotation": [rx, ry, rz], "scale": 1 }
//                 | { "prop": "turret", "to": "root", "at": [x, y, z] } ],   (vehicles: a node + absolute spot)
//     "mount":  { "model": "kingdoms-cavalry-mount", "height": 1.25, "riderHeight": 0.9, "seat": [x, y, z] }
//               (legacy: { "kind": "horse" | "warhorse" | "darkhorse" | "chariot" } — a procedural mount),
//     "engine": { "model": "classical-siege-engine", "height": 1.3 }   (legacy: "siege" — procedural),
//     "crew": [[x, z] | [x, y, z], ...], "crewHeight": 0.85 }
//
// attach — a weapon or prop is placed at the soldier's hand (found from the posed mesh: the point of
//          the arm farthest from its shoulder), oriented in world space, and parented to the arm
//          bone, so it swings with the arm in the shader's walk/strike animation. A GLB part keeps its
//          own colours; a procedural prop (bow, shield, musket…) comes from soldierFactory.
// mount  — the soldier is baked seated (its own "sit" clip, legs still) on a mount model (its legs
//          gallop through the quadruped rig), seated at the saddle found on its back.
// engine — a siege engine / vehicle model, crewed by baked copies of the soldier standing behind it
//          (or wherever `crew` says: [x, z] on the ground, [x, y, z] on a platform, like a chariot).
// scripts/import-models.js writes these recipes from the packs you download.
import { Mesh, MeshBasicMaterial, Vector3, Vector4, Matrix4, Quaternion, Euler, BufferAttribute, AnimationMixer } from 'three';
import { extractUnitGeometry, loadGltf, cloneScene, limbFromName } from './gltfUnitLoader';
import { getPropGeometry, getMount, offsetRig, mergeRigged, getProceduralSoldierGeometry, LIMB } from './soldierFactory';

const HAND_LIMB = { right: LIMB.ARM_R, left: LIMB.ARM_L };

const bounds = (geo) => { geo.computeBoundingBox(); return geo.boundingBox; };

// Where a rider sits on a mount: the highest point of its back — the top of the middle third of
// its length (the head and the tail are out at the ends), centred across.
export const findSaddle = (geo) => {
  const bb = bounds(geo); const p = geo.attributes.position;
  const len = bb.max.z - bb.min.z; const lo = bb.min.z + len / 3; const hi = bb.max.z - len / 3;
  let top = -Infinity;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z >= lo && z <= hi) top = Math.max(top, p.getY(i)); }
  return [(bb.min.x + bb.max.x) / 2, Number.isFinite(top) ? top : bb.max.y * 0.7, (bb.min.z + bb.max.z) / 2];
};

// The posed world position of `side`'s hand: the vertex skinned to that arm that lies farthest from
// the arm's top joint. Also returns the arm bone to parent attachments to.
export const findHand = (root, side) => {
  const want = HAND_LIMB[side] ?? LIMB.ARM_R;
  let bone = null;
  root.traverse((o) => { if (!bone && o.isBone && limbFromName(o.name) === want) bone = o; });
  if (!bone) return null;
  const joint = bone.getWorldPosition(new Vector3());
  const v = new Vector3(); const idx = new Vector4(); const w = new Vector4();
  let best = null; let bestD = -1;
  root.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return;
    const bi = mesh.skeleton.bones.indexOf(bone);
    if (bi < 0) return;
    const g = mesh.geometry;
    for (let i = 0; i < g.attributes.position.count; i++) {
      idx.fromBufferAttribute(g.attributes.skinIndex, i); w.fromBufferAttribute(g.attributes.skinWeight, i);
      let top = 0; for (let q = 1; q < 4; q++) if (w.getComponent(q) > w.getComponent(top)) top = q;
      if (idx.getComponent(top) !== bi) continue;
      mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld);
      const d = v.distanceToSquared(joint);
      if (d > bestD) { bestD = d; best = v.clone(); }
    }
  });
  return { bone, hand: best || joint };
};

// `clip`: a name, a RegExp, or a list of them in order of preference (the first that exists wins).
const pose = (root, animations, clip) => {
  const wants = Array.isArray(clip) ? clip : [clip];
  let c = null;
  for (const want of wants) { c = animations.find((a) => (want instanceof RegExp ? want.test(a.name) : a.name === want)); if (c) break; }
  if (c) { const m = new AnimationMixer(root); m.clipAction(c).play(); m.update(0); }
  root.updateMatrixWorld(true);
};

// A procedural prop as a Mesh the baker can read (vertex colours; the shield face is an emblem).
const propMesh = (kind) => {
  const geo = getPropGeometry(kind);
  const isEmblem = geo.attributes.aPart && Array.from(geo.attributes.aPart.array).some((p) => p === 2);
  if (geo.attributes.aUv) geo.setAttribute('uv', new BufferAttribute(geo.attributes.aUv.array.slice(), 2));
  return new Mesh(geo, Object.assign(new MeshBasicMaterial({ vertexColors: true }), { name: isEmblem ? 'Emblem' : `prop-${kind}` }));
};

// Place `obj` at a world transform, parented to `parent` (so it inherits the parent's rig limb).
const attachAt = (obj, parent, worldPos, rotation = [0, 0, 0], scale = 1) => {
  const world = new Matrix4().compose(worldPos, new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(scale, scale, scale));
  parent.updateMatrixWorld(true);
  const local = new Matrix4().copy(parent.matrixWorld).invert().multiply(world);
  local.decompose(obj.position, obj.quaternion, obj.scale);
  obj.userData.attachment = true;
  parent.add(obj);
};

/**
 * Build the soldier geometry for a recipe. `resolve(name)` → URL of a source model.
 * Returns { geometry, stats }.
 */
export const composeUnitModel = async (recipe, { resolve, ageId = 'kingdoms', load = loadGltf } = {}) => {
  const baseUrl = resolve(recipe.base);
  if (!baseUrl) throw new Error(`recipe base "${recipe.base}" is not available`);
  const base = await load(baseUrl);
  const clipFor = (fallback) => recipe.restClip || fallback;
  const common = { animations: base.animations, rotateY: recipe.rotateY || 0, teamFrom: recipe.teamFrom || null, tags: recipe.tags };

  // Dress one copy of the soldier (posed with `clip`) with its attachments, and bake it.
  const bakeSoldier = async (clip, extra) => {
    const root = await cloneScene(base.scene);
    pose(root, base.animations, clip);
    for (const a of recipe.attach || []) {
      // `to`: a named node (or "root") and an absolute position — for vehicles, which have no hands.
      const found = a.to
        ? { bone: (a.to === 'root' ? root : root.getObjectByName(a.to)) || root, hand: new Vector3() }
        : findHand(root, a.hand || 'right');
      if (!found) continue;
      let obj;
      if (a.model) {
        const partUrl = resolve(a.model);
        if (!partUrl) continue;
        obj = await cloneScene((await load(partUrl)).scene);
      } else if (a.prop) obj = propMesh(a.prop);
      else continue;
      const at = new Vector3(...(a.at || [0, 0, 0])).add(found.hand);
      attachAt(obj, found.bone, at, a.rotation, a.scale ?? 1);
    }
    return extractUnitGeometry(root, { ...common, restClip: clip, ...extra });
  };

  const loadModel = async (name, opts) => {
    const url = resolve(name);
    if (!url) throw new Error(`model "${name}" is not available`);
    const gltf = await load(url);
    return extractUnitGeometry(await cloneScene(gltf.scene), { animations: gltf.animations, ...opts });
  };

  if (recipe.mount?.model) {
    const m = recipe.mount;
    const mount = await loadModel(m.model, { quadruped: true, height: m.height ?? 1.25, restClip: m.restClip || /idle|stand|walk/i, teamFrom: m.teamFrom || null, segment: false });
    const riderHeight = m.riderHeight ?? 0.9;
    const rider = await bakeSoldier(m.clip || [/rid(e|ing)|mount|horse/i, /sit/i, /idle/i], { height: riderHeight, staticLegs: true });
    // The seated rider's hips sit on the saddle (roughly halfway up its seated height).
    const [sx, sy, sz] = m.seat || findSaddle(mount.geometry);
    const hips = (bounds(rider.geometry).max.y - bounds(rider.geometry).min.y) * 0.45;
    offsetRig(rider.geometry, sx, sy - hips, sz);
    return { geometry: mergeRigged([mount.geometry, rider.geometry]), stats: { ...rider.stats, composed: 'mount' } };
  }
  if (recipe.mount) {
    const mount = getMount(recipe.mount.kind || recipe.mount);
    const rider = await bakeSoldier(mount.standing ? clipFor('idle') : (recipe.mount.clip || 'sit'), {
      height: recipe.mount.riderHeight ?? (mount.standing ? 0.85 : 0.9), staticLegs: !mount.standing
    });
    offsetRig(rider.geometry, mount.saddle[0], mount.saddle[1] - (mount.standing ? 0 : 0.08), mount.saddle[2]);
    return { geometry: mergeRigged([mount.geometry, rider.geometry]), stats: { ...rider.stats, composed: 'mount' } };
  }
  if (recipe.engine) {
    const e = recipe.engine;
    const engine = e.model
      ? (await loadModel(e.model, { height: e.height ?? 1.2, restClip: e.restClip || 'bind', teamFrom: e.teamFrom || null, segment: false })).geometry
      : getProceduralSoldierGeometry(ageId, 'siege').clone();
    const crewman = await bakeSoldier(clipFor('idle'), { height: recipe.crewHeight ?? 0.85 });
    // Default crew: two soldiers standing just behind the engine.
    const bb = bounds(engine);
    const behind = bb.min.z - 0.3;
    // 'aboard': one driver standing on the machine's floor (a chariot), a little behind its middle.
    const len = bb.max.z - bb.min.z;
    const spots = recipe.crew === 'aboard'
      ? [[(bb.min.x + bb.max.x) / 2, bb.min.y + (bb.max.y - bb.min.y) * 0.28, (bb.min.z + bb.max.z) / 2 - len * 0.15]]
      : recipe.crew || [[-0.45, behind], [0.45, behind]];
    const crew = spots.map((c) => (c.length === 3 ? offsetRig(crewman.geometry.clone(), c[0], c[1], c[2]) : offsetRig(crewman.geometry.clone(), c[0], 0, c[1])));
    return { geometry: mergeRigged([engine, ...crew]), stats: { ...crewman.stats, composed: 'engine' } };
  }
  const soldier = await bakeSoldier(clipFor(/idle/i), { height: recipe.height ?? 1 });
  return { geometry: mergeRigged([soldier.geometry]), stats: soldier.stats };
};

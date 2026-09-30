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
//     "mount":  { "kind": "horse" | "warhorse" | "darkhorse" | "chariot", "riderHeight": 0.9 },
//     "engine": "siege", "crew": [[x, z], ...], "crewHeight": 0.85 }
//
// attach — a weapon or prop is placed at the soldier's hand (found from the posed mesh: the point of
//          the arm farthest from its shoulder), oriented in world space, and parented to the arm
//          bone, so it swings with the arm in the shader's walk/strike animation. A GLB part keeps its
//          own colours; a procedural prop (bow, shield, musket…) comes from soldierFactory.
// mount  — the soldier is baked seated (its own "sit" clip, legs still) on a procedural animated
//          mount (galloping legs), or standing in a chariot.
// engine — a procedural siege engine of the unit's age, crewed by baked copies of the soldier.
import { Mesh, MeshBasicMaterial, Vector3, Vector4, Matrix4, Quaternion, Euler, BufferAttribute, AnimationMixer } from 'three';
import { extractUnitGeometry, loadGltf, cloneScene, limbFromName } from './gltfUnitLoader';
import { getPropGeometry, getMount, offsetRig, mergeRigged, getProceduralSoldierGeometry, LIMB } from './soldierFactory';

const HAND_LIMB = { right: LIMB.ARM_R, left: LIMB.ARM_L };

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

const pose = (root, animations, clip) => {
  const c = animations.find((a) => (clip instanceof RegExp ? clip.test(a.name) : a.name === clip));
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

  if (recipe.mount) {
    const mount = getMount(recipe.mount.kind || recipe.mount);
    const rider = await bakeSoldier(mount.standing ? clipFor('idle') : (recipe.mount.clip || 'sit'), {
      height: recipe.mount.riderHeight ?? (mount.standing ? 0.85 : 0.9), staticLegs: !mount.standing
    });
    offsetRig(rider.geometry, mount.saddle[0], mount.saddle[1] - (mount.standing ? 0 : 0.08), mount.saddle[2]);
    return { geometry: mergeRigged([mount.geometry, rider.geometry]), stats: { ...rider.stats, composed: 'mount' } };
  }
  if (recipe.engine) {
    const engine = getProceduralSoldierGeometry(ageId, 'siege').clone();
    const crewman = await bakeSoldier(clipFor('idle'), { height: recipe.crewHeight ?? 0.85 });
    const crew = (recipe.crew || [[-0.55, -0.8], [0.55, -0.8]]).map(([x, z]) => offsetRig(crewman.geometry.clone(), x, 0, z));
    return { geometry: mergeRigged([engine, ...crew]), stats: { ...crewman.stats, composed: 'engine' } };
  }
  const soldier = await bakeSoldier(clipFor(/idle/i), { height: recipe.height ?? 1 });
  return { geometry: mergeRigged([soldier.geometry]), stats: soldier.stats };
};

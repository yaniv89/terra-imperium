// scripts/import-models.js
// Builds the battle's whole unit roster — every {age}-{class} of the 5 ages × infantry, ranged,
// cavalry, siege, plus modern support (21 slots) — from CC0 model packs YOU download and unzip into
// src/assets/raw-models/ (see its README.md for the download list). No procedural or kit-bashed
// stand-ins: a slot with no dedicated model is reported as missing and the script exits non-zero.
//
//   node scripts/import-models.js            match, normalise, tag and write src/assets/units/
//   node scripts/import-models.js --scan     list every model found and what each slot would use
//   node scripts/import-models.js --check    verify src/assets/units/ holds the complete matrix
//   node scripts/import-models.js --raw <dir>   read packs from somewhere else
//
// What it does, per slot:
//   1. match — every .glb/.gltf under raw-models/ is scored against the slot's period keywords
//      (hoplite/legionary for classical infantry, knight/man-at-arms for kingdoms, musketeer/line
//      infantry for gunpowder, tank for modern armour…) by its file name, folders and node names.
//      src/assets/raw-models/units.manifest.json can pin any slot to an exact file.
//   2. normalise — the model is measured (three.js, real skinning), then wrapped in a root node
//      that stands it on the ground, centres it, scales it to real size (people 1.8 m, horses,
//      engines and vehicles by type) and turns it to face +Z (barrel-first for guns and tanks).
//   3. tag — materials the game's shaders key on are renamed: the uniform/cloth/paint becomes
//      "TeamColor" (the side's colour) and skin becomes "Skin" (a per-soldier skin tone). Models
//      with one palette texture and nothing to rename get `teamFrom`/`skinFrom` (a torso/head bone)
//      in their options file, which gltfUnitLoader resolves per vertex.
//   4. write — self-contained GLBs (external buffers and textures embedded) plus a JSON per slot:
//      options for a single model, or a recipe for a composed one — a rider on a mount model, a
//      siege engine with its age's infantry as crew, a chariot with its driver — both parts real
//      models from the packs (src/battle/render/unitComposer.js assembles them at load time).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGE_ORDER } from '../src/data/ages.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = path.join(ROOT, 'src/assets/raw-models');
const UNITS = path.join(ROOT, 'src/assets/units');

// ---- the matrix ------------------------------------------------------------------------------

export const AGES = AGE_ORDER; // the age registry (src/data/ages.js)
const MOUNT_WANT = ['warhorse', 'war horse', 'stallion', 'horse', 'mare', 'pony'];
const RIDER_AVOID = ['horse', 'mount', 'cart', 'wagon'];
const PEOPLE_AVOID = ['zombie', 'skeleton', 'alien', 'robot', 'orc', 'goblin', 'elf', 'wizard', 'mage', 'witch', 'child', 'kid', 'baby', 'girl', 'woman', 'female', 'chef', 'doctor', 'business', 'casual', 'astronaut', 'space'];

// kind: humanoid (one soldier model) | mounted (rider + mount, or one combined model) |
// engine (a siege engine crewed by the age's infantry) | chariot (vehicle + one driver aboard) |
// vehicle (one self-contained model). `meters`: real height it's scaled to.
export const SLOTS = {
  'bronze-infantry': { kind: 'humanoid', want: ['bronze age', 'sumerian', 'akkadian', 'egyptian', 'hittite', 'mycenaean', 'canaanite', 'bronze', 'spearman', 'tribal warrior', 'warrior'] },
  'bronze-ranged': { kind: 'humanoid', want: ['egyptian archer', 'bronze archer', 'slinger', 'composite bow', 'archer', 'bowman', 'hunter'] },
  'bronze-cavalry': { kind: 'chariot', want: ['war chariot', 'egyptian chariot', 'chariot'], meters: 2.2 },
  'bronze-siege': { kind: 'engine', want: ['battering ram', 'siege ram', 'ram', 'siege ladder'], meters: 2.2 },
  'classical-infantry': { kind: 'humanoid', want: ['hoplite', 'legionary', 'legionnaire', 'spartan', 'phalanx', 'centurion', 'roman soldier', 'greek soldier', 'roman', 'greek', 'gladiator'] },
  'classical-ranged': { kind: 'humanoid', want: ['toxotes', 'peltast', 'sagittarius', 'roman archer', 'greek archer', 'javelin', 'slinger', 'archer'] },
  'classical-cavalry': { kind: 'mounted', want: ['equites', 'hetairoi', 'companion cavalry', 'roman cavalry', 'greek cavalry', 'classical rider'], rider: ['roman rider', 'greek rider', 'rider', 'horseman'] },
  'classical-siege': { kind: 'engine', want: ['ballista', 'onager', 'scorpion', 'catapult'], meters: 2.4 },
  'kingdoms-infantry': { kind: 'humanoid', want: ['man at arms', 'men at arms', 'man-at-arms', 'knight', 'crusader', 'templar', 'footman', 'medieval soldier', 'swordsman', 'guard'] },
  'kingdoms-ranged': { kind: 'humanoid', want: ['crossbowman', 'crossbow', 'longbowman', 'longbow', 'medieval archer', 'archer', 'ranger'] },
  'kingdoms-cavalry': { kind: 'mounted', want: ['mounted knight', 'knight on horse', 'knight horse', 'cavalry', 'horseman', 'lancer'], rider: ['knight', 'lancer', 'rider'] },
  'kingdoms-siege': { kind: 'engine', want: ['trebuchet', 'mangonel', 'siege tower', 'catapult'], meters: 3.8 },
  'gunpowder-infantry': { kind: 'humanoid', want: ['line infantry', 'musketeer', 'grenadier', 'fusilier', 'redcoat', 'napoleonic', 'colonial soldier', 'musket', 'pikeman'] },
  'gunpowder-ranged': { kind: 'humanoid', want: ['rifleman', 'jager', 'skirmisher', 'sharpshooter', 'arquebusier', 'musketeer', 'pirate'] },
  'gunpowder-cavalry': { kind: 'mounted', want: ['hussar', 'dragoon', 'cuirassier', 'cavalry', 'horseman'], rider: ['hussar', 'dragoon', 'cuirassier', 'officer', 'rider'] },
  'gunpowder-siege': { kind: 'engine', want: ['field cannon', 'field gun', 'cannon', 'mortar', 'artillery', 'culverin'], meters: 1.6 },
  'modern-infantry': { kind: 'humanoid', want: ['rifleman', 'infantry', 'trooper', 'soldier', 'military', 'army', 'marine', 'commando', 'swat'] },
  'modern-ranged': { kind: 'humanoid', want: ['sniper', 'machine gunner', 'machinegunner', 'rocket soldier', 'bazooka', 'rpg', 'grenadier', 'gunner'] },
  'modern-cavalry': { kind: 'vehicle', want: ['main battle tank', 'battle tank', 'tank'], avoid: ['water', 'fuel', 'gas', 'oil'], meters: 2.5, barrel: true },
  'modern-siege': { kind: 'engine', want: ['howitzer', 'self propelled', 'mlrs', 'rocket launcher', 'artillery', 'field gun'], meters: 2.4, barrel: true },
  'modern-support': { kind: 'vehicle', want: ['apc', 'ifv', 'armored car', 'armoured car', 'humvee', 'military truck', 'jeep', 'truck'], avoid: ['fire', 'ice cream', 'police', 'garbage', 'tow'], meters: 2.6 }
};
const HUMAN_METERS = 1.8;
const MOUNT_METERS = 2.3; // a horse to the top of its head
const ageOf = (slot) => slot.split('-')[0];

// ---- GLB / glTF containers -------------------------------------------------------------------

const pad4 = (b, fill = 0) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);

export const readGlb = (buf) => {
  if (buf.toString('latin1', 0, 4) !== 'glTF') throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen;
  const bin = binStart + 8 <= buf.length ? buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart)) : Buffer.alloc(0);
  return { json, bin };
};

export const writeGlb = (json, bin) => {
  const out = { ...json };
  if (bin.length) out.buffers = [{ byteLength: bin.length }];
  const jsonBuf = pad4(Buffer.from(JSON.stringify(out), 'utf8'), 0x20);
  const binBuf = pad4(bin);
  const chunk = (b, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(b.length, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, b]); };
  const header = Buffer.alloc(12); header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4);
  const glb = Buffer.concat([header, chunk(jsonBuf, 'JSON'), ...(binBuf.length ? [chunk(binBuf, 'BIN\0')] : [])]);
  glb.writeUInt32LE(glb.length, 8);
  return glb;
};

const decodeDataUri = (uri) => Buffer.from(uri.slice(uri.indexOf(',') + 1), /;base64,/.test(uri) ? 'base64' : 'utf8');

/**
 * Any glTF (a .glb, or a .gltf with external or data-URI buffers and images) → one self-contained
 * { json, bin }: every buffer merged into a single binary chunk, every image embedded in it.
 * `readUri(uri)` reads a file next to the model.
 */
export const packGltf = async ({ json: src, bin: glbBin = null }, readUri) => {
  const json = JSON.parse(JSON.stringify(src));
  const parts = []; let offset = 0;
  const append = (data) => { const at = offset; const padded = pad4(data); parts.push(padded); offset += padded.length; return at; };
  const bufferOffsets = await Promise.all((json.buffers || []).map(async (b, i) => {
    if (!b.uri) return i === 0 && glbBin ? glbBin : Buffer.alloc(0);
    return b.uri.startsWith('data:') ? decodeDataUri(b.uri) : readUri(decodeURIComponent(b.uri));
  })).then((datas) => datas.map((d) => append(d)));
  (json.bufferViews || []).forEach((bv) => { bv.byteOffset = (bv.byteOffset || 0) + (bufferOffsets[bv.buffer] || 0); bv.buffer = 0; });
  for (const img of json.images || []) {
    if (!img.uri) continue;
    const data = img.uri.startsWith('data:') ? decodeDataUri(img.uri) : await readUri(decodeURIComponent(img.uri));
    json.bufferViews = json.bufferViews || [];
    json.bufferViews.push({ buffer: 0, byteOffset: append(data), byteLength: data.length });
    img.bufferView = json.bufferViews.length - 1;
    img.mimeType = img.mimeType || (/\.jpe?g$/i.test(img.uri) || img.uri.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png');
    delete img.uri;
  }
  const bin = Buffer.concat(parts);
  json.buffers = bin.length ? [{ byteLength: bin.length }] : [];
  return { json, bin };
};

const loadContainer = async (file) => {
  const buf = fs.readFileSync(file);
  const dir = path.dirname(file);
  const readUri = async (uri) => fs.readFileSync(path.join(dir, uri));
  const parsed = buf.toString('latin1', 0, 4) === 'glTF' ? readGlb(buf) : { json: JSON.parse(buf.toString('utf8')), bin: null };
  return packGltf(parsed, readUri);
};

// ---- describing a model ----------------------------------------------------------------------

const norm = (s) => ` ${String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const has = (text, kw) => text.includes(` ${norm(kw).trim()} `) || text.includes(` ${norm(kw).trim()}s `);

export const describe = (rel, json) => {
  const nodeNames = (json.nodes || []).map((n) => n.name || '').filter(Boolean);
  const skinned = (json.skins || []).length > 0;
  const jointNames = new Set((json.skins || []).flatMap((s) => s.joints.map((j) => json.nodes[j]?.name || '')));
  const quadruped = [...jointNames].some((n) => /(front|fore|hind|back).?(leg|foot|paw)|leg.?(front|fore|hind|back)|tail/i.test(n));
  const humanoid = skinned && !quadruped && [...jointNames].some((n) => /arm|hand|shoulder/i.test(n));
  return {
    rel,
    file: norm(path.basename(rel).replace(/\.(glb|gltf)$/i, '')),
    dirs: norm(path.dirname(rel)),
    names: norm([...nodeNames, ...(json.meshes || []).map((m) => m.name || ''), ...(json.materials || []).map((m) => m.name || '')].join(' ')),
    skinned, humanoid, quadruped,
    animations: (json.animations || []).map((a) => a.name || ''),
    triangles: (json.meshes || []).reduce((t, m) => t + m.primitives.reduce((u, p) => u + Math.round((json.accessors[p.indices ?? p.attributes.POSITION]?.count || 0) / 3), 0), 0)
  };
};

// How well a model fits a wish list: earlier keywords weigh more; the file name counts most.
export const scoreModel = (d, want, avoid = []) => {
  let score = 0;
  want.forEach((kw, i) => {
    const w = want.length - i + 2;
    if (has(d.file, kw)) score += w * 3;
    else if (has(d.dirs, kw)) score += w * 2;
    else if (has(d.names, kw)) score += w;
  });
  avoid.forEach((kw) => { if (has(d.file, kw) || has(d.dirs, kw)) score -= 40; });
  return score;
};

const fitsKind = (d, kind) => {
  if (kind === 'humanoid' || kind === 'rider') return d.humanoid || (!d.quadruped && d.skinned);
  if (kind === 'mount') return d.quadruped || !d.humanoid;
  if (kind === 'mounted') return d.skinned;
  return !d.humanoid; // engines, chariots, vehicles
};

const best = (models, want, { kind, avoid = [], exclude = new Set() } = {}) => models
  .filter((d) => fitsKind(d, kind) && !exclude.has(d.rel))
  .map((d) => ({ d, score: scoreModel(d, want, avoid) }))
  .filter((c) => c.score > 0)
  .sort((a, b) => b.score - a.score || a.d.rel.localeCompare(b.d.rel))[0] || null;

/**
 * Decide which model(s) every slot uses. Pure: `models` are describe() results, `manifest` the
 * optional per-slot pins. Returns { plan: { slot → parts }, missing: [slot…], shared: [...] }.
 */
export const planRoster = (models, manifest = {}) => {
  const byRel = new Map(models.map((d) => [d.rel, d]));
  const pinned = (rel) => (rel && byRel.get(rel)) || null;
  const used = new Map(); // rel → slots, to prefer a dedicated model per slot
  const take = (slot, d) => { if (d) used.set(d.rel, [...(used.get(d.rel) || []), slot]); return d; };
  const plan = {}; const missing = [];
  const claimed = () => new Set([...used.keys()]);

  // People first (engines borrow their age's infantry as crew), most specific slots first.
  const order = Object.keys(SLOTS).sort((a, b) => ['humanoid', 'mounted', 'chariot', 'engine', 'vehicle'].indexOf(SLOTS[a].kind) - ['humanoid', 'mounted', 'chariot', 'engine', 'vehicle'].indexOf(SLOTS[b].kind));
  for (const slot of order) {
    const def = SLOTS[slot]; const pin = manifest[slot] || {};
    const avoid = [...(def.avoid || []), ...(def.kind === 'humanoid' ? [...PEOPLE_AVOID, ...RIDER_AVOID] : [])];
    const pick = (want, kind, extraAvoid = []) => best(models, want, { kind, avoid: [...avoid, ...extraAvoid], exclude: claimed() }) || best(models, want, { kind, avoid: [...avoid, ...extraAvoid] });
    if (def.kind === 'humanoid' || def.kind === 'vehicle') {
      const d = pinned(pin.file) || pick(def.want, def.kind)?.d;
      if (d) plan[slot] = { kind: def.kind, model: take(slot, d) }; else missing.push(slot);
    } else if (def.kind === 'mounted') {
      // One model that already sits a rider on a horse, or a rider model + a mount model.
      const combined = pinned(pin.file) || best(models, def.want, { kind: 'mounted', avoid })?.d;
      if (combined && (pin.file || (combined.quadruped && combined.humanoid !== true && /horse|cavalry|rider|mounted/.test(combined.file + combined.dirs)))) {
        plan[slot] = { kind: 'mounted-combined', model: take(slot, combined) };
        continue;
      }
      const rider = pinned(pin.rider) || pick(def.rider, 'rider', ['horse'])?.d || plan[`${ageOf(slot)}-infantry`]?.model;
      const mount = pinned(pin.mount) || pick(ageOf(slot) === 'kingdoms' ? ['barded', 'armored horse', 'armoured horse', ...MOUNT_WANT] : MOUNT_WANT, 'mount')?.d;
      if (rider && mount) plan[slot] = { kind: 'mounted', rider: take(slot, rider), mount: take(slot, mount) }; else missing.push(slot);
    } else {
      // engine / chariot: the machine, crewed by this age's infantry.
      const machine = pinned(pin.file) || pick(def.want, def.kind)?.d;
      const crew = pinned(pin.crew) || plan[`${ageOf(slot)}-infantry`]?.model;
      if (machine && crew) plan[slot] = { kind: def.kind, model: take(slot, machine), crew }; else missing.push(slot);
    }
  }
  const shared = [...used.entries()].filter(([, slots]) => slots.length > 1).map(([rel, slots]) => ({ rel, slots }));
  return { plan, missing: Object.keys(SLOTS).filter((s) => missing.includes(s)), shared };
};

// ---- measuring (three.js, real skinning) -----------------------------------------------------

const withNodeGlobals = () => {
  globalThis.self = globalThis.self || globalThis;
  if (typeof globalThis.ProgressEvent === 'undefined') {
    globalThis.ProgressEvent = class ProgressEvent extends Event { constructor(t, i = {}) { super(t); Object.assign(this, { lengthComputable: false, loaded: 0, total: 0, ...i }); } };
  }
};

// The scene's box and vertex centroid, in its own units (textures stripped: only shape matters).
export const measure = async ({ json, bin }) => {
  withNodeGlobals();
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const shape = JSON.parse(JSON.stringify(json));
  delete shape.images; delete shape.textures; delete shape.samplers;
  (shape.materials || []).forEach((m) => {
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; delete m.extensions;
  });
  const glb = writeGlb(shape, bin);
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length), '', resolve, reject));
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3(); const v = new THREE.Vector3(); const sum = new THREE.Vector3(); let count = 0;
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(p.count / 4000));
    for (let i = 0; i < p.count; i += step) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); sum.add(v); count += 1; }
  });
  if (!count) throw new Error('no geometry');
  return { min: box.min.toArray(), max: box.max.toArray(), centroid: sum.divideScalar(count).toArray() };
};

/**
 * The yaw (radians) that turns a model to face +Z. glTF's convention is +Z forward, so people and
 * most machines need none. A long machine lying along X is turned lengthwise; one with a barrel
 * (`barrel`: guns, tanks) is turned barrel-first — the barrel end is the lighter end, so the vertex
 * centroid sits towards the back. `pinDegrees` (manifest) always wins.
 */
export const facingYaw = ({ min, max, centroid }, { barrel = false, lengthwise = true, pinDegrees = null } = {}) => {
  if (pinDegrees != null) return (pinDegrees * Math.PI) / 180;
  if (!lengthwise) return 0;
  const lx = max[0] - min[0]; const lz = max[2] - min[2];
  const alongX = lx > lz * 1.15;
  const axis = alongX ? 0 : 2;
  const mid = (min[axis] + max[axis]) / 2;
  const heavyToward = Math.sign(centroid[axis] - mid) || 1;
  const front = barrel ? -heavyToward : 1; // without a barrel, trust the convention (front = +)
  if (alongX) return front > 0 ? -Math.PI / 2 : Math.PI / 2;
  return front > 0 ? 0 : Math.PI;
};

// Real-world height for a machine, by what it is.
export const machineMeters = (slot, d) => {
  const t = `${d.file}${d.dirs}`;
  const table = [['trebuchet', 4.5], ['siege tower', 5], ['tower', 5], ['catapult', 2.6], ['mangonel', 2.6], ['onager', 2.4], ['ballista', 1.9], ['scorpion', 1.5], ['ram', 2.2], ['mortar', 1.1], ['cannon', 1.5], ['howitzer', 2.6], ['mlrs', 3], ['rocket', 3], ['tank', 2.5], ['apc', 2.6], ['humvee', 1.9], ['jeep', 1.8], ['truck', 3], ['chariot', 2.2]];
  const hit = table.find(([kw]) => has(t, kw));
  return hit ? hit[1] : (SLOTS[slot]?.meters || 2);
};

// ---- tagging ---------------------------------------------------------------------------------

const TEAM_NAME = /team|tabard|tunic|surcoat|banner|flag|faction|cloak|cape|livery|plume|cloth|shirt|uniform|coat|jacket|robe|clothes|fabric|dress|pants|trouser|main.?colou?r|primary|paint|body.?colou?r|hull|chassis/i;
const SKIN_NAME = /(^|[^a-z])(skin|flesh|face)|body.?skin/i;
const NEVER_TEAM = /metal|steel|iron|bronze|gold|silver|brass|copper|chain|leather|wood|hair|eye|beard|brow|mouth|teeth|tooth|lip|nail|glass|rubber|tire|tyre|wheel|track|rope|string|bone|black|shadow|light|lamp|skin|flesh|face|boot|shoe|glove|belt|strap|gun|weapon|sword|spear|bow|arrow|blade/i;

const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
// Same test as gltfUnitLoader's isSkinLike (kept in sync by unitComposer.test.js).
export const isSkinLike = (r, g, b) => {
  const R = srgb(r); const G = srgb(g); const B = srgb(b);
  if (!(R >= G && G >= B) || R < 0.2) return false;
  const chroma = R - B;
  return chroma > 0.08 && chroma < 0.5 && G / R > 0.5 && G / R < 0.92;
};

/**
 * Tag a model's surfaces for the game's shaders. Renames materials in place (TeamColor_i / Skin_i,
 * keeping the original under extras.sourceName) and returns { team, skin, options } — `options`
 * carries teamFrom/skinFrom when the model is one palette texture with nothing to rename.
 * `pin`: manifest names { teamMaterial, skinMaterial } to force.
 */
export const tagSurfaces = (json, { people = true, pin = {} } = {}) => {
  const mats = json.materials || [];
  const area = mats.map(() => 0);
  (json.meshes || []).forEach((m) => m.primitives.forEach((p) => {
    if (p.material == null) return;
    area[p.material] += (json.accessors[p.indices ?? p.attributes.POSITION]?.count || 0) / 3;
  }));
  const colour = (m) => m.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
  const textured = (m) => !!m.pbrMetallicRoughness?.baseColorTexture;
  const metal = (m) => (m.pbrMetallicRoughness?.metallicFactor ?? 1) > 0.6 && !textured(m);
  const team = new Set(); const skin = new Set();
  mats.forEach((m, i) => {
    const name = m.name || '';
    if (pin.teamMaterial && name === pin.teamMaterial) team.add(i);
    else if (pin.skinMaterial && name === pin.skinMaterial) skin.add(i);
    else if (people && (SKIN_NAME.test(name) || (!textured(m) && isSkinLike(...colour(m).slice(0, 3)) && !NEVER_TEAM.test(name)))) skin.add(i);
    else if (TEAM_NAME.test(name) && !NEVER_TEAM.test(name)) team.add(i);
  });
  // Nothing named like cloth: the biggest plain-coloured, non-metal surface wears the colours.
  if (!team.size) {
    const cand = mats.map((m, i) => i).filter((i) => !skin.has(i) && !NEVER_TEAM.test(mats[i].name || '') && !metal(mats[i]) && !textured(mats[i]))
      .filter((i) => { const [r, g, b] = colour(mats[i]); return Math.max(r, g, b) > 0.02; })
      .sort((a, b) => area[b] - area[a]);
    if (cand.length && area[cand[0]] > 0) team.add(cand[0]);
  }
  team.forEach((i) => { mats[i].extras = { ...(mats[i].extras || {}), sourceName: mats[i].name || '' }; mats[i].name = `TeamColor_${i}`; });
  skin.forEach((i) => { mats[i].extras = { ...(mats[i].extras || {}), sourceName: mats[i].name || '' }; mats[i].name = `Skin_${i}`; });

  // One palette texture (Kenney, Quaternius atlases): tag per vertex at load time instead.
  const options = {};
  if (!team.size) {
    const joints = (json.skins || []).flatMap((s) => s.joints.map((j) => json.nodes[j]?.name || '')).filter(Boolean);
    const torso = joints.find((n) => /upper.?chest|chest|spine.?2|spine.?1|spine|torso/i.test(n));
    if (torso) options.teamFrom = torso;
    else {
      // A machine: its largest mesh node is the hull / body.
      const meshNodes = (json.nodes || []).filter((n) => n.mesh != null && n.name);
      const size = (n) => json.meshes[n.mesh].primitives.reduce((t, p) => t + (json.accessors[p.indices ?? p.attributes.POSITION]?.count || 0), 0);
      const hull = meshNodes.sort((a, b) => size(b) - size(a))[0];
      if (hull) options.teamFrom = hull.name;
    }
  }
  if (people && !skin.size) {
    const head = (json.skins || []).flatMap((s) => s.joints.map((j) => json.nodes[j]?.name || '')).find((n) => /head/i.test(n) && !/end|top/i.test(n));
    if (head) options.skinFrom = head;
  }
  return { team: [...team], skin: [...skin], options };
};

// ---- normalising -----------------------------------------------------------------------------

/** Wrap every scene root in one node that stands the model on the ground at `meters` tall, centred, facing +Z. */
export const normalise = (json, { min, max }, { meters, yaw = 0 }) => {
  const h = Math.max(1e-6, max[1] - min[1]);
  const s = meters / h;
  const cx = (min[0] + max[0]) / 2; const cz = (min[2] + max[2]) / 2;
  const c = Math.cos(yaw); const sn = Math.sin(yaw);
  // M = S · Ry · T(-cx, -minY, -cz), column-major for glTF.
  const tx = -cx; const ty = -min[1]; const tz = -cz;
  const matrix = [
    s * c, 0, -s * sn, 0,
    0, s, 0, 0,
    s * sn, 0, s * c, 0,
    s * (c * tx + sn * tz), s * ty, s * (-sn * tx + c * tz), 1
  ];
  const sceneIdx = json.scene ?? 0;
  const scene = json.scenes?.[sceneIdx];
  if (!scene) throw new Error('model has no scene');
  json.nodes = json.nodes || [];
  json.nodes.push({ name: 'UnitRoot', matrix, children: [...(scene.nodes || [])] });
  scene.nodes = [json.nodes.length - 1];
  json.scenes = [scene];
  json.scene = 0;
  return json;
};

// ---- the run ---------------------------------------------------------------------------------

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const discover = async (raw) => {
  const files = walk(raw);
  const models = []; const skipped = [];
  const otherFormats = files.filter((f) => /\.(fbx|obj|blend|dae)$/i.test(f)).length;
  for (const f of files.filter((x) => /\.(glb|gltf)$/i.test(x))) {
    const rel = path.relative(raw, f).split(path.sep).join('/');
    try {
      const container = await loadContainer(f);
      const req = container.json.extensionsRequired || [];
      if (req.some((x) => /draco|meshopt|basisu/i.test(x))) { skipped.push(`${rel}: compressed (${req.join(', ')}) — use the pack's uncompressed glTF`); continue; }
      models.push({ ...describe(rel, container.json), abs: f });
    } catch (e) { skipped.push(`${rel}: ${e.message}`); }
  }
  return { models, skipped, otherFormats };
};

const licenceOf = (raw, rel) => {
  let dir = path.dirname(path.join(raw, rel));
  while (dir.startsWith(raw)) {
    const lic = fs.readdirSync(dir).find((f) => /^(licen[cs]e|readme|credits)/i.test(f) && /\.(txt|md)$/i.test(f));
    if (lic) {
      const text = fs.readFileSync(path.join(dir, lic), 'utf8');
      return { file: path.relative(raw, path.join(dir, lic)), cc0: /cc0|creative commons zero|public domain/i.test(text) };
    }
    if (dir === raw) break;
    dir = path.dirname(dir);
  }
  return { file: null, cc0: false };
};

const process1 = async (d, { meters, barrel = false, lengthwise = false, people = false, pin = {} }) => {
  const container = await loadContainer(d.abs);
  const m = await measure(container);
  const yaw = facingYaw(m, { barrel, lengthwise, pinDegrees: pin.rotateY ?? null });
  const tags = tagSurfaces(container.json, { people, pin });
  normalise(container.json, m, { meters: pin.meters ?? meters, yaw });
  container.json.asset = { ...(container.json.asset || {}), generator: 'terra-imperium scripts/import-models.js' };
  return { glb: writeGlb(container.json, container.bin), tags, yaw };
};

const idleClip = (d) => (d.animations.find((a) => /idle/i.test(a)) ? 'idle' : undefined);
const relHeight = (meters) => Math.round((meters / HUMAN_METERS) * 1000) / 1000;

const writeJson = (file, obj) => fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

export const run = async ({ raw = RAW, scan = false, out = UNITS, quiet = false } = {}) => {
  const UNITS = out; const SRC = path.join(out, '_src');
  const { models, skipped, otherFormats } = await discover(raw);
  const manifestFile = path.join(raw, 'units.manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  const { plan, missing, shared } = planRoster(models, manifest);
  const log = (...a) => { if (!quiet) console.log(...a); };

  log(`Found ${models.length} glTF/GLB models under ${path.relative(ROOT, raw) || raw}${otherFormats ? ` (+${otherFormats} FBX/OBJ/Blend files ignored — use each pack's glTF folder)` : ''}.`);
  skipped.forEach((s) => log(`  skipped ${s}`));
  if (scan) {
    models.forEach((d) => log(`  ${d.rel}  [${d.humanoid ? 'person' : d.quadruped ? 'animal' : d.skinned ? 'rigged' : 'static'}${d.animations.length ? `, ${d.animations.length} clips` : ''}]`));
  }
  log('\nRoster:');
  Object.keys(SLOTS).forEach((slot) => {
    const p = plan[slot];
    const show = !p ? 'MISSING' : p.kind === 'mounted' ? `rider ${p.rider.rel} + mount ${p.mount.rel}` : (p.kind === 'engine' || p.kind === 'chariot') ? `${p.model.rel} (crew: ${p.crew.rel})` : p.model.rel;
    log(`  ${slot.padEnd(19)} ${show}`);
  });
  shared.forEach((s) => log(`  note: ${s.rel} serves ${s.slots.join(', ')} — add a dedicated model or pin one in units.manifest.json`));
  if (scan) return { plan, missing };
  if (!Object.keys(plan).length) { log('\nNothing to import.'); return { plan, missing }; }

  // Replace the whole generated roster.
  fs.mkdirSync(SRC, { recursive: true });
  for (const dir of [UNITS, SRC]) fs.readdirSync(dir).filter((f) => /\.(glb|gltf|json)$/i.test(f)).forEach((f) => fs.rmSync(path.join(dir, f)));

  const credits = new Map();
  const credit = (d) => { const pack = d.rel.split('/').slice(0, 2).join('/'); if (!credits.has(pack)) credits.set(pack, licenceOf(raw, d.rel)); };
  const written = new Map(); // rel+role → _src name (a part used by several slots is written once)
  const part = async (d, name, opts) => {
    const key = `${d.rel}|${JSON.stringify(opts)}`;
    if (written.has(key)) return written.get(key);
    const { glb } = await process1(d, opts);
    fs.writeFileSync(path.join(SRC, `${name}.glb`), glb);
    written.set(key, name); credit(d);
    return name;
  };

  for (const slot of Object.keys(SLOTS)) {
    const p = plan[slot]; if (!p) continue;
    const def = SLOTS[slot]; const pin = manifest[slot] || {};
    if (p.kind === 'humanoid') {
      const { glb, tags } = await process1(p.model, { meters: HUMAN_METERS, people: true, pin });
      fs.writeFileSync(path.join(UNITS, `${slot}.glb`), glb); credit(p.model);
      writeJson(path.join(UNITS, `${slot}.json`), clean({ restClip: idleClip(p.model), ...tags.options }));
    } else if (p.kind === 'vehicle') {
      const meters = machineMeters(slot, p.model);
      const { glb, tags } = await process1(p.model, { meters, barrel: !!def.barrel, lengthwise: true, pin });
      fs.writeFileSync(path.join(UNITS, `${slot}.glb`), glb); credit(p.model);
      writeJson(path.join(UNITS, `${slot}.json`), clean({ height: relHeight(meters), restClip: 'bind', segment: false, ...tags.options }));
    } else if (p.kind === 'mounted-combined') {
      const { glb, tags } = await process1(p.model, { meters: MOUNT_METERS, people: true, lengthwise: true, pin });
      fs.writeFileSync(path.join(UNITS, `${slot}.glb`), glb); credit(p.model);
      writeJson(path.join(UNITS, `${slot}.json`), clean({ quadruped: true, height: relHeight(MOUNT_METERS), restClip: idleClip(p.model), ...tags.options }));
    } else if (p.kind === 'mounted') {
      const rider = await part(p.rider, `${slot}-rider`, { meters: HUMAN_METERS, people: true });
      const mountName = await part(p.mount, `${slot}-mount`, { meters: MOUNT_METERS, lengthwise: true, pin: { rotateY: pin.mountRotateY } });
      const riderTags = tagSurfaces(JSON.parse(JSON.stringify((await loadContainer(p.rider.abs)).json)), { people: true });
      writeJson(path.join(UNITS, `${slot}.json`), clean({ base: rider, restClip: idleClip(p.rider), ...riderTags.options, mount: clean({ model: mountName, height: relHeight(MOUNT_METERS), seat: pin.seat }) }));
    } else {
      // engine / chariot, crewed by this age's infantry (its own processed GLB).
      const meters = machineMeters(slot, p.model);
      const machine = await part(p.model, `${slot}-machine`, { meters, barrel: !!def.barrel, lengthwise: true, pin });
      const crew = await part(p.crew, `${ageOf(slot)}-crew`, { meters: HUMAN_METERS, people: true });
      const crewTags = tagSurfaces(JSON.parse(JSON.stringify((await loadContainer(p.crew.abs)).json)), { people: true });
      writeJson(path.join(UNITS, `${slot}.json`), clean({
        base: crew, restClip: idleClip(p.crew), ...crewTags.options,
        engine: { model: machine, height: relHeight(meters) },
        crew: pin.crewSpots || (p.kind === 'chariot' ? 'aboard' : undefined)
      }));
    }
  }

  const lines = [...credits.entries()].map(([pack, l]) => `- ${pack} — ${l.cc0 ? 'CC0' : 'LICENCE NOT CONFIRMED'}${l.file ? ` (${l.file})` : ''}`);
  fs.writeFileSync(path.join(UNITS, 'CREDITS.md'), `# Unit models\n\nImported by \`scripts/import-models.js\` from the packs in src/assets/raw-models/:\n\n${lines.join('\n')}\n`);
  const unconfirmed = [...credits.values()].filter((l) => !l.cc0).length;
  log(`\nWrote ${Object.keys(plan).length}/${Object.keys(SLOTS).length} slots to ${path.relative(ROOT, UNITS)}.`);
  if (unconfirmed) log(`  ${unconfirmed} pack(s) without a CC0 licence file — check CREDITS.md before shipping.`);
  return { plan, missing };
};

// Is the written roster complete? (Every slot has a GLB, or a recipe whose parts exist.)
export const checkRoster = (units = UNITS) => Object.keys(SLOTS).map((slot) => {
  const glb = fs.existsSync(path.join(units, `${slot}.glb`));
  const jsonFile = path.join(units, `${slot}.json`);
  const recipe = fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : null;
  const need = recipe?.base ? [recipe.base, recipe.mount?.model, recipe.engine?.model].filter(Boolean) : [];
  const partMissing = need.filter((n) => !fs.existsSync(path.join(units, '_src', `${n}.glb`)) && !fs.existsSync(path.join(units, `${n}.glb`)));
  return { slot, ok: glb || (!!recipe?.base && partMissing.length === 0), missing: glb ? [] : recipe?.base ? partMissing : [`${slot}.glb`] };
});

const main = async () => {
  const args = process.argv.slice(2);
  const rawAt = args.indexOf('--raw');
  const raw = rawAt >= 0 ? path.resolve(args[rawAt + 1]) : RAW;
  if (args.includes('--check')) {
    const res = checkRoster();
    res.forEach((r) => console.log(`${r.ok ? 'ok     ' : 'MISSING'} ${r.slot}${r.ok ? '' : `  (${r.missing.join(', ')})`}`));
    process.exit(res.every((r) => r.ok) ? 0 : 1);
  }
  const { missing } = await run({ raw, scan: args.includes('--scan') });
  if (missing.length) {
    console.log(`\n${missing.length} slot(s) have no dedicated model: ${missing.join(', ')}`);
    console.log('Add a pack that has them (see src/assets/raw-models/README.md) or pin a file in units.manifest.json.');
    process.exit(1);
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });

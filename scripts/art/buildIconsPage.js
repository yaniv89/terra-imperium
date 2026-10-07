// scripts/art/buildIconsPage.js
// The page behind scripts/art/build-icons.html: draws every battle-economy building (data/economy.js
// BUILDINGS) the way the battle draws it, from its age's rts-<age>.glb (the greybox parts of
// economyLayer.js where the file has no such object), one small three.js shot each on a clear
// background, in the player's colour, from the battle camera's angle. window.__buildIcons ends up as
// { [iconId]: webp data URL } (build-icons.mjs saves them to src/assets/icons/battle/).
import {
  WebGLRenderer, Scene, OrthographicCamera, HemisphereLight, DirectionalLight, Mesh, Group, Box3, Vector3,
  BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, CircleGeometry, MeshLambertMaterial, SRGBColorSpace
} from 'three';
import { loadTiles } from '../../src/data/geo/tiles';

// The battle's data modules read the world grid when they load: load it first, then them.
let ART; let loadKit; let kitObject; let BUILDINGS; let PARTS;

const params = new URLSearchParams(location.search);
const SIZE = Number(params.get('size') || 144);
const AGE = params.get('age') || 'bronze';
const TEAM = params.get('team') || '#5b9bf0'; // Field Atlas "you"

const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.outputColorSpace = SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const prims = {
  box: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  roof: new ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  cyl: new CylinderGeometry(0.5, 0.5, 1, 16).translate(0, 0.5, 0),
  cone: new ConeGeometry(0.5, 1, 16).translate(0, 0.5, 0),
  rock: new DodecahedronGeometry(0.5, 0),
  flat: new CircleGeometry(0.5, 24).rotateX(-Math.PI / 2)
};

// The greybox: the same parts economyLayer.js draws.
const greybox = (type) => {
  const g = new Group();
  (PARTS[type] || PARTS.house).forEach(([p, dx, py, dz, sx, sy, sz, col]) => {
    const m = new Mesh(prims[p], new MeshLambertMaterial({ color: col === 'side' ? TEAM : col }));
    m.position.set(dx, py, dz); m.scale.set(sx, sy, sz);
    g.add(m);
  });
  return g;
};

// A kit object (its LOD0 bundle) as a mesh, the Team material in the player's colour.
const fromKit = (obj) => {
  const b = obj.lods[0];
  const mats = b.materials.map((m, i) => { if (!b.team[i]) return m; const c = m.clone(); c.color?.set(TEAM); return c; });
  return new Mesh(b.geometry, mats.length === 1 ? mats[0] : mats);
};

const shoot = (object) => {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xfdf6e3, 0x5b5148, 1.6));
  const sun = new DirectionalLight(0xffffff, 2.2); sun.position.set(-4, 8, 6); scene.add(sun);
  scene.add(object);
  const box = new Box3().setFromObject(object);
  const c = box.getCenter(new Vector3()); const s = box.getSize(new Vector3());
  // The battle camera looks down from the south-west at about 40 degrees.
  const dir = new Vector3(-0.62, 0.66, 0.9).normalize();
  const r = Math.max(s.x, s.y, s.z) * 0.95;
  const cam = new OrthographicCamera(-r, r, r, -r, 0.01, r * 20);
  cam.position.copy(c).addScaledVector(dir, r * 6); cam.lookAt(c); cam.updateMatrixWorld();
  // Fit the projected box tightly (with a small margin) so every icon fills its square the same way.
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam));
  const xs = pts.map((p) => p.x); const ys = pts.map((p) => p.y);
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 * r * 1.08;
  const mx = ((Math.max(...xs) + Math.min(...xs)) / 2) * r; const my = ((Math.max(...ys) + Math.min(...ys)) / 2) * r;
  Object.assign(cam, { left: mx - half, right: mx + half, top: my + half, bottom: my - half });
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/webp', 0.92);
};

const run = async () => {
  await loadTiles();
  ({ ART } = await import('../../src/battle/art/artFiles'));
  ({ loadKit, kitObject } = await import('../../src/battle/art/kitLoader'));
  ({ BUILDINGS } = await import('../../src/battle/data/economy'));
  ({ PARTS } = await import('../../src/battle/render/economyLayer'));
  const ref = ART.rts(AGE);
  const kit = ref ? await loadKit(ref.url).catch((e) => { console.warn(e.message); return null; }) : null;
  const out = {}; const sources = {};
  for (const [type, def] of Object.entries(BUILDINGS)) {
    const obj = kitObject(kit, def.art);
    out[def.icon] = shoot(obj ? fromKit(obj) : greybox(type));
    sources[def.icon] = obj ? `${ref.key}#${def.art}` : 'greybox';
    const img = document.createElement('img'); img.src = out[def.icon]; img.title = def.icon; img.width = SIZE; img.style.background = '#1a212b';
    document.getElementById('out').appendChild(img);
  }
  window.__buildIconSources = sources;
  window.__buildIcons = out;
};
run().catch((e) => { window.__buildIconsError = e.message; console.error(e); });

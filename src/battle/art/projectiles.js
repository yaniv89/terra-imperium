// src/battle/art/projectiles.js
// What flies from a shot (plans/ART-MODELS-PLAN.md 8.3): src/assets/battle/projectiles/<age>.glb
// (the shooter's age, else the nearest earlier age with a file) holds one object per projectile:
// arrow, javelin, sling-stone, bolt, stone, cannonball, shell, missile. Each points along +Z (its
// front, glTF), origin at its middle, under 60 triangles; drawn at PROJECTILE_SCALE (twice true
// size, so it reads at the battle camera) along the shot's arc, nose following the arc. A shot
// whose shooter has no projectile here (muskets and rifles), or whose file or object is missing,
// keeps the tracer streak.
import { Matrix4, Vector3, Euler } from 'three';
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { KitInstances } from './kitInstances';
import { CITY_TILES_PER_UNIT } from '../setup/cityBattle';

export const PROJECTILES = ['arrow', 'javelin', 'sling-stone', 'bolt', 'stone', 'cannonball', 'shell', 'missile'];
export const PROJECTILE_SCALE = CITY_TILES_PER_UNIT * 2;
// [classId][ageId] -> projectile (null: the tracer). 'tower' is a tower's or keep's shot.
const TABLE = {
  ranged: { bronze: 'arrow', classical: 'arrow', kingdoms: 'arrow', gunpowder: null, modern: 'missile' },
  infantry: { bronze: 'javelin', classical: 'javelin' },
  cavalry: { bronze: 'arrow', classical: 'javelin' },
  siege: { classical: 'bolt', kingdoms: 'stone', gunpowder: 'cannonball', modern: 'shell' },
  support: { modern: 'missile' },
  tower: { bronze: 'arrow', classical: 'arrow', kingdoms: 'arrow', gunpowder: 'cannonball', modern: null }
};
/** The projectile a shooter of this class and age throws, or null (the tracer). */
export const projectileFor = (classId, ageId) => TABLE[classId]?.[ageId] ?? null;

const M = new Matrix4(); const V = new Vector3(); const E = new Euler(0, 0, 0, 'YXZ');

export class ProjectileArt {
  constructor(r, { art = ART, load = loadKit } = {}) {
    this.r = r; this.kits = new Map(); this.ready = [];
    this.pieces = new KitInstances(r.scene, { track: (x) => r.track(x), castShadow: false, initial: 32 });
    const ages = new Set(r.setup.sides.map((s) => s.ageId));
    this.refs = {};
    ages.forEach((a) => {
      const ref = art.projectiles(a);
      this.refs[a] = ref;
      if (!ref || this.kits.has(ref.url)) return;
      this.kits.set(ref.url, null);
      this.ready.push(load(ref.url).then((kit) => { if (!this.disposed) this.kits.set(ref.url, kit); })
        .catch((e) => console.warn(`[art] ${e.message}: shots keep their tracers`)));
    });
  }

  /** The kit object for a shot by this shooter, or null. */
  objectFor(classId, ageId) {
    const name = projectileFor(classId, ageId);
    const ref = name && this.refs[ageId];
    return ref ? kitObject(this.kits.get(ref.url), name) : null;
  }

  begin() { this.pieces.begin(); }

  /** One projectile at (x, y, z) travelling along (dx, dz) on the ground, climbing `slope` (dy per ground unit). */
  add(obj, x, y, z, dx, dz, slope) {
    E.set(-Math.atan(slope), Math.atan2(dx, dz), 0);
    this.pieces.add(obj, 0, M.makeRotationFromEuler(E).scale(V.setScalar(PROJECTILE_SCALE)).setPosition(x, y, z));
  }

  end() { this.pieces.end(); }

  dispose() { this.disposed = true; this.pieces.dispose(); }
}

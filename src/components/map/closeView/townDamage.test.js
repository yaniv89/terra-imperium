import { describe, it, expect } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { enableTownDamage, setTownDamage, syncTownDamage, ruinMound, MAX_RECTS, fileGroundClear, enableGroundClear, setGroundClear } from './townDamage';

const makeTown = () => {
  const root = new Group();
  const town = new MeshStandardMaterial({ name: 'Town' }); const ground = new MeshStandardMaterial({ name: 'Ground' });
  root.add(new Mesh(new BoxGeometry(), [town, ground]));
  root.add(new Mesh(new BoxGeometry(), town));
  return { root, town, ground };
};

describe('townDamage: a city\'s ruins drawn on its merged town model', () => {
  it('gives the instance its own building materials (the Ground stays shared), once', () => {
    const { root, town, ground } = makeTown();
    const made = enableTownDamage(root);
    expect(made).toHaveLength(2); // the building material and the shadow depth material
    expect(root.children[0].customDepthMaterial).toBe(made[1]);
    expect(root.children[1].customDepthMaterial).toBe(made[1]);
    expect(root.children[0].material[0]).not.toBe(town);
    expect(root.children[0].material[1]).toBe(ground);
    expect(root.children[1].material).toBe(root.children[0].material[0]);
    expect(enableTownDamage(root)).toEqual([]);
  });

  it('passes the ruined and damaged footprints and the town space to the shader', () => {
    const { root } = makeTown();
    enableTownDamage(root);
    setTownDamage(root, [{ x: 1, z: 2, w: 0.5, d: 0.5 }], [{ x: 0, z: 0, w: 1, d: 1 }, { x: 3, z: 3, w: 1, d: 1 }]);
    const u = root.userData.townDamage[0].userData.townDamage;
    expect(u.uRuinN.value).toBe(1);
    expect(u.uDmgN.value).toBe(2);
    // the shadow pass cuts the same ruins
    expect(root.userData.townDamage[1].userData.townDamage.uRuinN.value).toBe(1);
    expect(u.uRuin.value[0].x).toBeCloseTo(0.71);
    expect(u.uRuin.value).toHaveLength(MAX_RECTS);
    root.position.set(5, 0, 0); root.scale.setScalar(2);
    syncTownDamage(root);
    expect(u.uTownInv.value.elements[12]).toBeCloseTo(-2.5);
  });

  it('a rubble mound covers the footprint', () => {
    const m = ruinMound({ x: 1, z: -1, w: 0.8, d: 0.6 });
    expect(m.position.x).toBe(1);
    expect(m.scale.x).toBeCloseTo(0.8);
  });

  it('reads the old landmark plots a town file asks to clear and lifts them on its ground', () => {
    const { root, ground } = makeTown();
    expect(fileGroundClear(root)).toEqual([]);
    root.children[0].userData.clearGround = [[1, -2, 0.5, 0.4], [0, 1, 1, 1]];
    expect(fileGroundClear(root)).toEqual([{ x: 1, z: -2, w: 0.5, d: 0.4 }, { x: 0, z: 1, w: 1, d: 1 }]);
    const [m] = enableGroundClear(root);
    expect(m.name).toBe(ground.name);
    setGroundClear(root, fileGroundClear(root));
    expect(m.userData.groundClear.uClearN.value).toBe(2);
  });
});

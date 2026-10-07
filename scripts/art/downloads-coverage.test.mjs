// scripts/art/downloads-coverage.test.mjs
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { DOWNLOADS, itemOf, gameTargets, downloadsCoverage, builtNotUploaded } from './downloads-coverage.mjs';

const fakeList = (dir) => ({
  'src/assets/map/towns': ['kingdoms-town-small-a-japan.glb', 'bronze-town-big-b-nile.glb', 'bronze-town-big-b-nile.blend'],
  'src/assets/map/improvements': ['farm-bronze-israelite.glb', 'farm-modern.glb'],
  'src/assets/icons/resources': ['horses.webp', 'iron.svg']
}[dir] || []);

describe('art downloads coverage', () => {
  it('finds the item folder of a delivered file', () => {
    expect(itemOf('plans/art/kits/nile/bronze/houses/model.glb')).toBe('plans/art/kits/nile/bronze/houses');
    expect(itemOf('plans/art/wonders/masada/tier1/preview.png')).toBe('plans/art/wonders/masada');
    expect(itemOf('plans/art/icons/ages/bronze-mask.png')).toBe('plans/art/icons/ages/bronze');
    expect(itemOf('plans/art/kits/levant/classical/street.png')).toBe('plans/art/kits/levant/classical');
    expect(itemOf('dependencies/nile-modern-houses.blend')).toBe('plans/art/kits/nile/modern/houses');
    expect(itemOf('README.md')).toBeNull();
    expect(itemOf('repo-source/scripts/blender/ti_town.py')).toBeNull();
  });

  it('maps an item to the file the game ships', () => {
    expect(gameTargets('plans/art/kits/sinic/kingdoms/landmark-japan-pagoda', fakeList).files).toEqual(['src/assets/map/towns/kingdoms-town-small-a-japan.glb']);
    expect(gameTargets('plans/art/kits/nile/bronze/houses', fakeList).files).toEqual(['src/assets/map/towns/bronze-town-big-b-nile.glb']);
    expect(gameTargets('plans/art/kits/nile/kingdoms/palace', fakeList).files).toEqual(['src/assets/map/shared/shared-kingdoms-nile.glb']);
    expect(gameTargets('plans/art/towns/classical/palace-small', fakeList).files).toEqual(['src/assets/map/shared/shared-classical.glb']);
    expect(gameTargets('plans/art/towns/bronze/field-1-israelite', fakeList).files).toEqual(['src/assets/map/shared/shared-bronze-israelite.glb']);
    expect(gameTargets('plans/art/buildings/granary-israelite', fakeList).files).toEqual(['src/assets/map/buildings/granary-israelite.glb']);
    expect(gameTargets('plans/art/improvements/ancient/farm-israelite', fakeList).files).toEqual(['src/assets/map/improvements/farm-bronze-israelite.glb']);
    expect(gameTargets('plans/art/improvements/modern/farm', fakeList).files).toEqual(['src/assets/map/improvements/farm-modern.glb']);
    expect(gameTargets('plans/art/icons/resources/horses', fakeList).files).toEqual(['src/assets/icons/resources/horses.webp']);
  });

  it.skipIf(!existsSync(DOWNLOADS))('every delivered item is in the game', () => {
    const coverage = downloadsCoverage();
    expect(coverage.length).toBeGreaterThan(0);
    const missing = coverage.flatMap((z) => z.items.filter((i) => !i.files.length).map((i) => `${z.zip}: ${i.item}`));
    expect(missing).toEqual([]);
    // An item built but not uploaded that shows up in a ZIP must be imported (and its status moved on).
    expect(builtNotUploaded(coverage).filter((p) => p.inZip)).toEqual([]);
  });
});

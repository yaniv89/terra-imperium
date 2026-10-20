// H-05 / H-06: a model file that is being drawn is never dropped from memory (its textures would be
// disposed under the drawing and come out black); files nobody holds still go past the budget.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadGltf, createGltfHold, isGltfHeld, onGltfEvict, trimGltfCache, gltfMemory } from './gltfUnitLoader';
import { buildingGlb } from '../../components/map/closeView/glbFixture';

// three's FileLoader reports progress with ProgressEvent, which Node lacks
globalThis.ProgressEvent ||= class extends Event { constructor(type, init = {}) { super(type); Object.assign(this, init); } };
const urlOf = (name) => `data:model/gltf-binary;base64,${Buffer.from(buildingGlb(name)).toString('base64')}`;

afterEach(() => { vi.useRealTimers(); });

describe('holds on model files (H-05, H-06)', () => {
  it('keeps held files through a trim and tells the caches about the ones that go, disposed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const a = urlOf('held-a'); const b = urlOf('idle-b');
    await loadGltf(a); await loadGltf(b);
    const hold = createGltfHold();
    hold.add(a);
    const gone = [];
    const off = onGltfEvict((url, gltf, info) => gone.push([url, info.disposed]));
    vi.setSystemTime(1_000_000 + 60_000); // both idle past the keep time
    trimGltfCache(-1); // (the fixture files hold no textures: 0 bytes, so a limit below 0)
    expect(gone.map(([u, d]) => [u === b, d])).toEqual([[true, true]]);
    expect(isGltfHeld(a)).toBe(true);
    expect(gltfMemory().files).toBeGreaterThanOrEqual(1);
    // the same file object comes back for a held file: nothing was disposed under its users
    const first = await loadGltf(a);
    expect(await loadGltf(a)).toBe(first);
    hold.release();
    expect(isGltfHeld(a)).toBe(false);
    vi.setSystemTime(1_000_000 + 120_000);
    trimGltfCache(-1); // (the fixture files hold no textures: 0 bytes, so a limit below 0)
    expect(gone.some((g) => g[0] === a)).toBe(true);
    off();
  });

  it('a capturing hold (a battle) takes every file loaded or used while it is open', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(2_000_000);
    const before = urlOf('before-battle'); const during = urlOf('during-battle');
    await loadGltf(before);
    const battle = createGltfHold({ capture: true });
    loadGltf(before); // a use, from a cache that already had it
    await loadGltf(during);
    expect(isGltfHeld(before)).toBe(true);
    expect(isGltfHeld(during)).toBe(true);
    const gone = [];
    const off = onGltfEvict((url) => gone.push(url));
    vi.setSystemTime(2_000_000 + 60_000);
    trimGltfCache(-1); // (the fixture files hold no textures: 0 bytes, so a limit below 0)
    expect(gone.includes(before)).toBe(false);
    expect(gone.includes(during)).toBe(false);
    battle.release(); // the battle is over: what nobody else holds may go
    trimGltfCache(-1); // (the fixture files hold no textures: 0 bytes, so a limit below 0)
    expect(gone.includes(before) && gone.includes(during)).toBe(true);
    // a released hold captures nothing more
    const after = urlOf('after-battle');
    await loadGltf(after);
    expect(isGltfHeld(after)).toBe(false);
    off();
  });

  it('set() holds exactly the files of the last layout; two holds on one file need both released', () => {
    const one = createGltfHold(); const two = createGltfHold();
    one.set(['x', 'y']); two.add('y');
    one.set(['y', 'z']);
    expect(isGltfHeld('x')).toBe(false);
    expect(isGltfHeld('z')).toBe(true);
    one.release();
    expect(isGltfHeld('y')).toBe(true);
    two.release();
    expect(isGltfHeld('y')).toBe(false);
  });
});

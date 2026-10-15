import { describe, it, expect } from 'vitest';
import { RESOURCE_DEPOSITS, hasDeposit, getDepositsFor } from './deposits';
import countriesMeta from './geo/countries-meta.json';

describe('RESOURCE_DEPOSITS', () => {
  it('every key is a real country id', () => {
    Object.keys(RESOURCE_DEPOSITS).forEach(id => {
      expect(countriesMeta[id], `${id} is not a real country id`).toBeDefined();
    });
  });

  it('only lists copper/iron/oil, never an unlocked-later resource', () => {
    Object.values(RESOURCE_DEPOSITS).forEach(list => {
      list.forEach(resourceId => {
        expect(['copper', 'iron', 'oil']).toContain(resourceId);
      });
    });
  });

  it('is not exhaustive over all 240 nations — scarcity is the point', () => {
    expect(Object.keys(RESOURCE_DEPOSITS).length).toBeLessThan(Object.keys(countriesMeta).length);
  });
});

describe('hasDeposit / getDepositsFor', () => {
  it('reports a known deposit', () => {
    expect(hasDeposit('sa', 'oil')).toBe(true);
    expect(getDepositsFor('sa')).toContain('oil');
  });

  it('reports false/empty for a nation with no listed deposits', () => {
    expect(hasDeposit('is', 'oil')).toBe(false);
    expect(getDepositsFor('is')).toEqual([]);
  });

  it('reports false for a deposit type a nation does not have', () => {
    expect(hasDeposit('sa', 'iron')).toBe(false);
  });

  it('handles an unknown country id without throwing', () => {
    expect(() => hasDeposit('not-a-real-country', 'oil')).not.toThrow();
    expect(getDepositsFor('not-a-real-country')).toEqual([]);
  });
});

describe('deposits in a peoples world', () => {
  const load = async () => {
    const { peoplesWorld } = await import('../engine/testWorld');
    const { buildRegistry } = await import('../engine/world/registry');
    const { getTiles } = await import('./geo/tiles');
    return { peoplesWorld, buildRegistry, getTiles };
  };
  const WORLDS = [['small', 11], ['standard', 5], ['standard', 9]];

  it('each deposit has at most one holder on its land, and only a few cities hold one', async () => {
    const { peoplesWorld, buildRegistry } = await load();
    for (const [size, seed] of WORLDS) {
      const reg = buildRegistry(peoplesWorld({ seed, size }).regions).regions;
      const ids = Object.keys(reg);
      const lands = {};
      ids.forEach((id) => { (lands[reg[id].landCode] ||= []).push(id); });
      Object.entries(lands).forEach(([land, cityIds]) => {
        getDepositsFor(land).forEach((res) => {
          expect(cityIds.filter((id) => reg[id].deposits.includes(res)).length).toBeLessThanOrEqual(1);
        });
      });
      const share = ids.filter((id) => reg[id].deposits.length > 0).length / ids.length;
      expect(share).toBeGreaterThan(0.05);
      expect(share).toBeLessThan(0.25);
      expect(ids.some((id) => getDepositsFor(reg[id].startOwner).length > 0)).toBe(false);
    }
  }, 60000);

  it('is deterministic', async () => {
    const { peoplesWorld, buildRegistry } = await load();
    const s = peoplesWorld({ seed: 5, size: 'standard' });
    const pick = (r) => Object.fromEntries(Object.keys(r).map((id) => [id, r[id].deposits]));
    expect(pick(buildRegistry(s.regions).regions)).toEqual(pick(buildRegistry(s.regions).regions));
  }, 60000);

  it('moves to the next city of the land when its city is razed, and a city taken in war keeps it', async () => {
    const { peoplesWorld, buildRegistry, getTiles } = await load();
    const tiles = getTiles();
    const s = peoplesWorld({ seed: 5, size: 'standard' });
    const a = buildRegistry(s.regions).regions;
    const holder = Object.keys(a).find((id) => a[id].deposits.length > 0);
    const res = a[holder].deposits[0];
    const land = a[holder].landCode;
    // a second city of the same land one step away
    const t2 = tiles.neighbors[s.regions[holder].tile].find((t) => tiles.land[t] === 1 && tiles.countryOf(t) === land);
    expect(t2).toBeDefined();
    const regions = { ...s.regions, twin: { ...s.regions[holder], id: 'twin', tile: t2, tiles: [t2], isCapital: false } };
    const both = buildRegistry(regions).regions;
    const owners = Object.keys(both).filter((id) => both[id].landCode === land && both[id].deposits.includes(res));
    expect(owners.length).toBe(1);
    const gone = { ...regions }; delete gone[owners[0]];
    const next = buildRegistry(gone).regions;
    const after = Object.keys(next).filter((id) => next[id].landCode === land && next[id].deposits.includes(res));
    expect(after.length).toBe(1);
    expect(after[0]).not.toBe(owners[0]);
    // capture: the owner changes, the deposit stays in the same city
    const taken = { ...regions, [owners[0]]: { ...regions[owners[0]], owner: 'someone-else' } };
    expect(buildRegistry(taken).regions[owners[0]].deposits).toContain(res);
  }, 60000);
});

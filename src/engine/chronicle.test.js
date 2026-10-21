import { describe, it, expect } from 'vitest';
import { tickChronicle, tileRuns, BATTLES_KEPT } from './chronicle';
import { AGE_ORDER } from '../data/ages';
import { peoplesWorld, rivalOf } from './testWorld';

const WORLD = peoplesWorld({ seed: 11 });
const ME = WORLD.playerNationId;
const RIVAL = rivalOf(WORLD, 0);
const [FIRST, SECOND] = AGE_ORDER;
const turn = (s, patch = {}) => ({ ...s, turnNumber: s.turnNumber + 1, ...patch });
const report = (n, fallen) => ({ id: `battle-${n}`, turn: 5, name: `Battle ${n}`, tile: 1, kind: 'land', playerSide: 'attacker', outcome: 'attacker', fallen: { attacker: fallen, defender: 0 } });

describe('chronicle', () => {
  it('opens a chapter and closes it with a tile snapshot on the player\'s own age change only', () => {
    let s = tickChronicle(WORLD, turn(WORLD));
    expect(s.chronicle.chapters).toHaveLength(1);
    const rival = turn(s, { nations: { ...s.nations, [RIVAL]: { ...s.nations[RIVAL], tech: { ...s.nations[RIVAL].tech, ageId: SECOND } } } });
    s = tickChronicle(s, rival);
    expect(s.chronicle.chapters).toHaveLength(1);
    s = tickChronicle(s, turn(s, { techAgeId: SECOND }));
    const [done, open] = s.chronicle.chapters;
    expect(done.age).toBe(FIRST);
    expect(done.to).toBe(s.turnNumber);
    expect(done.tiles).toEqual(tileRuns(s));
    expect(done.tiles.length).toBeGreaterThan(0);
    expect(open.age).toBe(SECOND);
  });

  it('writes a battle once and keeps only the biggest', () => {
    let s = tickChronicle(WORLD, turn(WORLD));
    const reports = Array.from({ length: 10 }, (_, i) => report(i + 1, i * 10)).reverse();
    s = tickChronicle(s, turn(s, { battleReports: reports, battleReportSeq: 10 }));
    const again = tickChronicle(s, turn(s));
    expect(again.chronicle.chapters[0].battles).toHaveLength(BATTLES_KEPT);
    expect(again.chronicle.chapters[0].battles[0].fallen).toBe(90);
    expect(again.chronicle.chapters[0].battles).toEqual(s.chronicle.chapters[0].battles);
  });

  it('records a declared war and a lost city', () => {
    let s = tickChronicle(WORLD, turn(WORLD));
    const cityId = Object.keys(s.regions).find((id) => s.regions[id].owner === ME || s.regions[id].ownerId === ME);
    const lost = { ...s.regions, [cityId]: { ...s.regions[cityId], owner: RIVAL, ownerId: RIVAL } };
    const next = turn(s, { regions: lost, wars: [{ id: 'w1', enemy: RIVAL, startTurn: s.turnNumber + 1, aggressor: RIVAL, active: true }] });
    const c = tickChronicle(s, next).chronicle.chapters[0];
    expect(c.wars).toEqual([{ t: next.turnNumber, id: 'w1', enemy: RIVAL, aggressor: RIVAL }]);
    expect(c.cities).toEqual([{ t: next.turnNumber, id: cityId, how: 'lost' }]);
  });
});

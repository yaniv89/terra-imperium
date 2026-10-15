import { describe, it, expect } from 'vitest';
import { turnReportModel } from './turnReportModel';
import { cap } from '../../engine/testWorld';
import { LogTypes } from '../../data/types';
import { peoplesWorld } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 11 });
const FR = WORLD.playerNationId;

describe('turn report model (W10)', () => {
  const before = peoplesWorld({ seed: 11 });
  const next = (patch) => ({ ...before, turnNumber: before.turnNumber + 1, ...patch });

  it('is null when no turn passed, quiet when nothing but growth or research happened', () => {
    expect(turnReportModel(before, before)).toBeNull();
    const capId = cap(FR);
    const grown = next({ regions: { ...before.regions, [capId]: { ...before.regions[capId], size: (before.regions[capId].size || 1) + 1 } } });
    const m = turnReportModel(before, grown);
    expect(m.title).toBe(`Turn ${before.turnNumber} report`);
    expect(m.counts.cities).toBe(1);
    expect(m.items[0].place).toEqual({ kind: 'city', id: capId, name: before.regions[capId].name });
    expect(m.quiet).toBe(true);
  });

  it('groups a battle, a raid line and a city lost, and is not quiet then', () => {
    const capId = cap(FR);
    const city = before.regions[capId];
    const battle = { id: 'battle-99', name: `Siege of ${city.name}`, playerSide: 'defender', outcome: 'defender', defense: true, targetRegionId: capId, fallen: { attacker: 400, defender: 40 } };
    const other = Object.values(before.regions).find((c) => c.owner !== FR);
    const after = next({
      battleReports: [battle, ...(before.battleReports || [])],
      logs: [...before.logs, { year: before.year, type: LogTypes.COMBAT, message: `Gutians pillage the land of ${city.name} (a pasture).` }, { year: before.year, type: LogTypes.ACTION, message: 'income line' }],
      regions: { ...before.regions, [capId]: { ...city, owner: other.owner } }
    });
    const m = turnReportModel(before, after);
    expect(m.counts).toMatchObject({ battles: 1, raids: 1, cities: 1 });
    const b = m.items.find((i) => i.group === 'battles');
    expect(b.title).toBe(`Siege of ${city.name}: held`);
    expect(b.sub).toContain('Your fallen: 40');
    expect(b.tone).toBe('good');
    expect(m.items.find((i) => i.group === 'raids').place.id).toBe(capId);
    expect(m.items.find((i) => i.group === 'cities').title).toBe(`${city.name} lost`);
    expect(m.groups.map((g) => g.id)).toEqual(['battles', 'raids', 'cities']);
    expect(m.quiet).toBe(false);
  });

  it('names a fast forward by its turns', () => {
    const m = turnReportModel(before, { ...before, turnNumber: before.turnNumber + 5 });
    expect(m.title).toBe(`Turns ${before.turnNumber} to ${before.turnNumber + 4}`);
    expect(m.turns).toBe(5);
  });

  it('collapses news about peoples the player has not met into one line, and folds recurring upkeep', () => {
    const me = before.playerNationId;
    const stranger = Object.values(before.nations).find((n) => n.id !== me && !before.fog?.met?.[me]?.[n.id] && n.name);
    expect(stranger).toBeTruthy();
    const after = next({
      logs: [...before.logs,
        { year: before.year, type: LogTypes.CRISIS, message: `${stranger.name} descends into civil war!` },
        { year: before.year, type: LogTypes.CRISIS, message: `${stranger.name} loses a city to rebels.` }]
    });
    const m = turnReportModel(before, after);
    const unmet = m.items.filter((i) => i.unmet);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].title).toBe('2 reports from lands you have not seen');
    expect(m.items.some((i) => i.title.includes('civil war'))).toBe(false);
    expect(m.quiet).toBe(true);
  });

  it('folds recurring upkeep lines of a fast forward into one', () => {
    const logs = [1, 2, 3].map((y) => ({ year: y, type: LogTypes.CRISIS, message: `Upkeep: -${y} (army 1)` }));
    const m = turnReportModel(before, { ...before, turnNumber: before.turnNumber + 3, logs: [...before.logs, ...logs] });
    expect(m.items.filter((i) => i.title.startsWith('Upkeep'))).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { turnReportModel } from './turnReportModel';
import { cap } from '../../engine/testWorld';
import { LogTypes } from '../../data/types';
import { peoplesWorld } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 11 });
const FR = WORLD.playerNationId;

// Playtest audit I172: a sack that shrinks a city and growth in the same report read in order.
describe('turn report: shrink then growth', () => {
  it('explains a city that shrank and grew back', () => {
    const before = peoplesWorld({ seed: 11 });
    const id = cap(FR);
    const city = before.regions[id];
    const after = {
      ...before,
      turnNumber: before.turnNumber + 1,
      regions: { ...before.regions, [id]: { ...city, size: (city.size || 1) + 1 } },
      logs: [...before.logs, { year: before.year, type: LogTypes.COMBAT, message: `Raiders sack ${city.name}: 40 gold taken, the city shrinks to 1.` }]
    };
    const m = turnReportModel(before, after);
    const grew = m.items.find((i) => i.growth);
    expect(grew.title).toBe(`${city.name} grew to size ${(city.size || 1) + 1}`);
    expect(grew.sub).toMatch(/shrank to 1/);
  });
});

// Lane turn-pacing: the report opens by itself only for what matters to the player.
describe('turn report: quiet unless it matters', () => {
  const step = (lines) => {
    const before = peoplesWorld({ seed: 11 });
    return turnReportModel(before, { ...before, turnNumber: before.turnNumber + 1, logs: [...before.logs, ...lines.map((l) => ({ year: before.year, ...l }))] });
  };
  const known = () => { const w = peoplesWorld({ seed: 11 }); return Object.values(w.nations).find((n) => n.id !== FR && !n.isEliminated && w.fog?.met?.[FR]?.[n.id]); };

  it('stays shut for other peoples\' pacts and milestones', () => {
    const other = known();
    const m = step([{ type: LogTypes.DIPLOMACY, message: `${other?.name || 'Someone'} signs a pact.` }, { type: LogTypes.MILESTONE, message: 'A wonder rises far away.' }]);
    expect(m.quiet).toBe(true);
  });

  it('opens for news that names the player, and for a crisis', () => {
    const me = peoplesWorld({ seed: 11 }).nations[FR].name;
    expect(step([{ type: LogTypes.DIPLOMACY, message: `The Hittites declare war on ${me}.` }]).quiet).toBe(false);
    expect(step([{ type: LogTypes.DIPLOMACY, message: 'x', msgVars: { a: { k: 'people', id: FR, en: me } } }]).quiet).toBe(false);
    expect(step([{ type: LogTypes.CRISIS, message: 'A great drought.' }]).quiet).toBe(false);
  });
});

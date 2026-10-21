import { describe, it, expect } from 'vitest';
import { nationOverviewModel } from './nationOverviewModel';
import { authorityOf } from '../../engine/authority';
import { AGE_ORDER } from '../../data/ages';
import { EMPIRE_CITY_COUNT } from '../../data/nationTitles';
import { peoplesWorld } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 5 });
const FR = WORLD.playerNationId;

describe('nation overview model (W17)', () => {
  const s = peoplesWorld({ seed: 5 });

  it('reads the ruler, government, stability, victory, era goals and the age for the player', () => {
    const m = nationOverviewModel(s);
    const n = s.nations[FR];
    expect(m.name).toBe(n.name);
    expect(m.cities).toBeGreaterThan(0);
    expect(m.ruler.name).toBe(n.ruler.name);
    expect(m.ruler.skills.map((k) => k.value)).toEqual([n.ruler.adm, n.ruler.dip, n.ruler.mil]);
    expect(m.government.title).toBe(n.name);
    if (m.government.nextTitle) expect(m.government.nextTitle.needed).toBe(EMPIRE_CITY_COUNT);
    expect(m.stability.authority).toBe(authorityOf(s, FR).total);
    expect(m.stability.parts.some((p) => p.id === 'base')).toBe(false);
    expect(m.victory.map((v) => v.id)).toEqual(['domination']);
    expect(m.victory[0].value).toBe(0);
    expect(m.score.rank).toBeGreaterThan(0);
    expect(m.era.goals).toHaveLength(5);
    expect(m.ages.map((a) => a.id)).toEqual(AGE_ORDER);
    expect(m.ages.find((a) => a.current).id).toBe(s.techAgeId);
    expect(m.nextAge.techs).toBeGreaterThan(0);
  });

  it('is null without a player nation', () => {
    expect(nationOverviewModel({ ...s, playerNationId: 'nope' })).toBeNull();
  });
});

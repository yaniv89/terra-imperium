// Differentiation plan U7: the ADM/DIP/MIL pools are gone; acts of state spend the ruler's decrees,
// everything else is gold. Through the real reducer, the opinion hook and the v18 to v19 migration.
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { LAW_CATEGORIES, canEnactLaw } from '../data/laws';
import { neighbourWorld, rivalOf, withDecrees } from './testWorld';
import { opinionReasons } from './opinion';
import { migrate18to19, POOL_POINTS_PER_DECREE } from './saveMigrations';
import { decreeCap } from './decrees';
import { getDevelopProvinceCost } from './development';
import { assertGameState } from './stateAudit';

const S = neighbourWorld({ seed: 11 });
const ME = S.playerNationId;
const enactable = (s) => Object.entries(LAW_CATEGORIES).flatMap(([c, laws]) => laws.map((l) => [c, l.id])).find(([c, id]) => canEnactLaw(s, ME, c, id));

describe('pools retired (U7)', () => {
  it('a new game has no pool and no pool bonus', () => {
    ['adm', 'dip', 'mil', 'maxAdm'].forEach((k) => expect(S.resources).not.toHaveProperty(k));
    Object.values(S.nations).forEach((n) => n.economy && expect(n.economy).not.toHaveProperty('adm'));
  });

  it('changing a law spends one decree and is refused without one', () => {
    const [category, lawId] = enactable(S);
    const payload = { type: ActionTypes.CHANGE_LAW, payload: { category, lawId } };
    expect(gameReducer(S, payload)).toBe(S);
    const rich = withDecrees(S, 2);
    const done = gameReducer(rich, payload);
    expect(done.nations[ME].laws[category]).toBe(lawId);
    expect(done.nations[ME].ruler.decrees).toBe(1);
    expect(done.nations[ME].ruler.decreeLog[0]).toMatchObject({ act: 'changeLaw', n: -1 });
    expect(done.resources).toEqual(rich.resources);
  });

  it('gaining control costs gold only; developing a city costs gold', () => {
    const city = S.regions[S.nations[ME].capitalRegionId];
    const s = { ...S, regions: { ...S.regions, [city.id]: { ...city, control: 10 } }, resources: { ...S.resources, gold: 100000 } };
    const ctl = gameReducer(s, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: city.id } });
    expect(ctl.resources.gold).toBe(100000 - 40);
    const cost = getDevelopProvinceCost(city);
    const dev = gameReducer(s, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: city.id, devType: 'tax' } });
    expect(dev.resources.gold).toBe(100000 - cost);
    expect(dev.regions[city.id].dev.tax).toBe(s.regions[city.id].dev.tax + 1);
  });

  it('a nation with a national.opinion bonus is liked better by everyone', () => {
    const other = rivalOf(S, 0);
    const before = opinionReasons(S, other, ME).find((r) => r.id === 'diplomacy');
    const s = { ...S, nations: { ...S.nations, [ME]: { ...S.nations[ME], government: { type: 'republic', reforms: { classical: 'oligarchic_republic' } } } } };
    expect(before).toBeUndefined();
    expect(opinionReasons(s, other, ME).find((r) => r.id === 'diplomacy')?.value).toBe(5);
  });

  it('a v18 save with banked pools arrives with decrees (1 per 300, up to the cap) and no pool fields', () => {
    const old = { ...S, resources: { ...S.resources, adm: 800, dip: 600, mil: 400, maxAdm: 5 } };
    const loaded = migrate18to19(old);
    expect(1800 / POOL_POINTS_PER_DECREE).toBeGreaterThan(decreeCap(S.nations[ME]));
    expect(loaded.nations[ME].ruler.decrees).toBe(decreeCap(S.nations[ME]));
    ['adm', 'dip', 'mil', 'maxAdm'].forEach((k) => expect(loaded.resources).not.toHaveProperty(k));
    expect(() => assertGameState(loaded)).not.toThrow();
  });
});

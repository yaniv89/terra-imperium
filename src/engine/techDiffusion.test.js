import { describe, it, expect } from 'vitest';
import { getTechDiffusion, contactsOf, reachAgeOf, CATCHUP_MAX, DIFFUSION_MAX, PIONEER_MULT } from './techDiffusion';
import { getResearchCost } from './research';
import { peoplesWorld } from './testWorld';
import { TECH_TREE } from '../data/techTree';

// Eight-ages plan U10 (KTD5): no penalty for falling behind; a bigger discount on techs known
// contacts in later ages hold, and a contact reach that follows the research leader.
const world = peoplesWorld({ seed: 5 });
const me = world.playerNationId;
const tech = Object.values(TECH_TREE).find((t) => t.ageId === 'stone' && t.prerequisites.length === 0).id;
const known = [...contactsOf(world, me).keys()];

// Every nation in `holders` holds `tech` at age `ageId`; the player holds nothing and is Bronze.
const withHolders = (holders, ageId) => {
  const nations = { ...world.nations };
  Object.keys(nations).forEach((id) => {
    if (id === me) return;
    const has = holders.includes(id);
    nations[id] = { ...nations[id], tech: { researched: has ? [tech] : [], ageId: has ? ageId : 'bronze' } };
  });
  const techTree = Object.fromEntries(Object.keys(world.techTree).map((id) => [id, { ...world.techTree[id], researched: false }]));
  return { ...world, nations, techTree, techAgeId: 'bronze' };
};

describe('catch-up diffusion', () => {
  it('the world has contacts to test with', () => {
    expect(known.length).toBeGreaterThan(0);
  });

  it('a Bronze nation among Classical holders pays at most 55% for a Bronze tech they all hold', () => {
    const d = getTechDiffusion(withHolders(known, 'classical'), me, tech);
    expect(d.catchUp).toBe(true);
    expect(d.mult).toBeLessThanOrEqual(1 - CATCHUP_MAX + 1e-9);
  });

  it('the same tech held only by Bronze neighbours costs at most 70%', () => {
    const d = getTechDiffusion(withHolders(known, 'bronze'), me, tech);
    expect(d.catchUp).toBe(false);
    expect(d.mult).toBeLessThanOrEqual(1 - DIFFUSION_MAX + 1e-9);
    expect(d.mult).toBeGreaterThan(1 - CATCHUP_MAX);
  });

  it('a nation that knows none of the holders pays full price, the pioneer pays 1.2', () => {
    const stranger = Object.keys(world.nations).find((id) => id !== me && !known.includes(id));
    if (stranger) expect(getTechDiffusion(withHolders([stranger], 'bronze'), me, tech).mult).toBe(1);
    const nobody = withHolders([], 'bronze');
    expect(getTechDiffusion(nobody, me, tech).mult).toBe(PIONEER_MULT);
  });

  it('falling behind costs nothing extra: a Bronze tech costs a Bronze nation the same in any world', () => {
    const a = withHolders([], 'bronze');
    const leaderId = known[0];
    const b = { ...a, nations: { ...a.nations, [leaderId]: { ...a.nations[leaderId], tech: { researched: [], ageId: 'modern' } } } };
    expect(getResearchCost(b, me, tech)).toBe(getResearchCost(a, me, tech));
  });

  it('the contact reach follows the research leader: its age minus one when that is higher', () => {
    const flat = withHolders([], 'bronze');
    expect(reachAgeOf(flat, me)).toBe('bronze');
    const leaderId = known[0];
    const ahead = { ...flat, nations: { ...flat.nations, [leaderId]: { ...flat.nations[leaderId], tech: { researched: [], ageId: 'kingdoms' } } } };
    expect(reachAgeOf(ahead, me)).toBe('classical');
    expect(contactsOf(ahead, me).size).toBeGreaterThanOrEqual(contactsOf(flat, me).size);
    expect(reachAgeOf({ ...ahead, techAgeId: 'gunpowder' }, me)).toBe('gunpowder');
  });
});

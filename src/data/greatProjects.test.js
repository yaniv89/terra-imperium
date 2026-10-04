import { describe, it, expect } from 'vitest';
import {
  GREAT_PROJECTS, GREAT_PROJECT_IDS, GREAT_PROJECT_TIER_COST, getGreatProject, getGreatProjectCost,
  getGreatProjectOwner, meetsSiteRule, SITE_RULES
} from './greatProjects';
import { AGE_ORDER } from './ages';
import { createEmptyRegionBuildings } from './buildings';
import { REGIONS_DATA } from './regions';

const RECOGNIZED_HOOKS = [
  'goldMult', 'hrMult', 'techPointsMult', 'stabilityBonus', 'popGrowthBonus', 'apBonus', 'admBonus',
  'dipBonus', 'milBonus', 'developmentCost', 'buildingCost', 'researchCost', 'stabilityCost',
  'supplyRange', 'attrition', 'governingCapacity'
];

describe('GREAT_PROJECTS data integrity', () => {
  it('has exactly 15 world projects, 3 per age, plus national ones tied to a homeland', () => {
    const world = Object.values(GREAT_PROJECTS).filter((p) => !p.national);
    expect(world.length).toBe(15);
    AGE_ORDER.forEach((ageId) => {
      expect(world.filter((p) => p.ageId === ageId).length, ageId).toBe(3);
    });
    const national = Object.values(GREAT_PROJECTS).filter((p) => p.national);
    expect(national.map((p) => p.id).sort()).toEqual(['masada', 'solomons_temple']);
    national.forEach((p) => { expect(p.homeland, p.id).toBeTruthy(); expect(p.siteRule).toBe('homeland'); });
    expect(GREAT_PROJECT_IDS.length).toBe(world.length + national.length);
  });

  it('every project has exactly 3 tiers, each with a completionPrestige and an effects object', () => {
    Object.values(GREAT_PROJECTS).forEach((project) => {
      expect(project.tiers.length, project.id).toBe(3);
      project.tiers.forEach((tier, i) => {
        expect(tier.completionPrestige, `${project.id}/tier${i + 1}`).toBeGreaterThan(0);
        expect(typeof tier.effects).toBe('object');
      });
    });
  });

  it('every project\'s site rule is a real, defined rule', () => {
    Object.values(GREAT_PROJECTS).forEach((project) => {
      expect(SITE_RULES, project.id).toHaveProperty(project.siteRule);
    });
  });

  it('every tier\'s effect key is a real, wired modifier hook or the known raw estateLoyalty key (plan §M9)', () => {
    Object.values(GREAT_PROJECTS).forEach((project) => {
      project.tiers.forEach((tier) => {
        Object.keys(tier.effects).forEach((hook) => {
          if (hook === 'estateLoyalty') return;
          expect(RECOGNIZED_HOOKS, `${project.id}/${hook}`).toContain(hook);
        });
      });
    });
  });

  // Bug-pattern regression guard (plan feedback: "issue with great works" — 5 projects gave
  // literally no ongoing effect at all, and 3 more claimed an estateLoyalty bonus that nothing ever
  // applied). Keeps both classes of bug from quietly coming back.
  it('no project is effect-free at any tier (every project gives a real, ongoing bonus beyond one-time prestige)', () => {
    Object.values(GREAT_PROJECTS).forEach((project) => {
      project.tiers.forEach((tier, i) => {
        // a national wonder acts on its own city (cityEffects) instead of the nation
        expect(Object.keys(tier.effects).length + Object.keys(tier.cityEffects || {}).length, `${project.id}/tier${i + 1}`).toBeGreaterThan(0);
      });
    });
  });

  it('prestige rises with tier for every project', () => {
    Object.values(GREAT_PROJECTS).forEach((project) => {
      expect(project.tiers[1].completionPrestige, project.id).toBeGreaterThan(project.tiers[0].completionPrestige);
      expect(project.tiers[2].completionPrestige, project.id).toBeGreaterThan(project.tiers[1].completionPrestige);
    });
  });
});

describe('getGreatProject / getGreatProjectCost', () => {
  it('returns the project by id, or null for an unknown one', () => {
    expect(getGreatProject('great_pyramids')?.name).toBe('The Great Pyramids');
    expect(getGreatProject('not_real')).toBeNull();
  });

  it('matches the plan\'s own gold/ADM/turns table for each tier', () => {
    expect(getGreatProjectCost(1)).toEqual({ gold: 500, adm: 100, turns: 4 });
    expect(getGreatProjectCost(2)).toEqual({ gold: 1000, adm: 150, turns: 6 });
    expect(getGreatProjectCost(3)).toEqual({ gold: 2000, adm: 200, turns: 8 });
  });

  it('returns null for an out-of-range tier', () => {
    expect(getGreatProjectCost(0)).toBeNull();
    expect(getGreatProjectCost(4)).toBeNull();
  });

  it('GREAT_PROJECT_TIER_COST has exactly 3 entries', () => {
    expect(GREAT_PROJECT_TIER_COST.length).toBe(3);
  });
});

describe('getGreatProjectOwner', () => {
  it('is derived from the site region\'s current owner, not stored', () => {
    const state = { greatProjects: { great_pyramids: { regionId: 'r1', tier: 1 } }, regions: { r1: { owner: 'fr' } } };
    expect(getGreatProjectOwner(state, 'great_pyramids')).toBe('fr');
  });

  it('reflects a capture immediately (no stale ownership)', () => {
    const state = { greatProjects: { great_pyramids: { regionId: 'r1', tier: 1 } }, regions: { r1: { owner: 'de' } } };
    expect(getGreatProjectOwner(state, 'great_pyramids')).toBe('de');
  });

  it('is null for a project never started', () => {
    expect(getGreatProjectOwner({ greatProjects: {}, regions: {} }, 'great_pyramids')).toBeNull();
  });
});

describe('meetsSiteRule', () => {
  it('capital: true only for a real capital region', () => {
    const capitalId = Object.keys(REGIONS_DATA).find((id) => REGIONS_DATA[id].isCapital);
    const nonCapitalId = Object.keys(REGIONS_DATA).find((id) => !REGIONS_DATA[id].isCapital);
    expect(meetsSiteRule(GREAT_PROJECTS.great_pyramids, {}, capitalId)).toBe(true);
    expect(meetsSiteRule(GREAT_PROJECTS.great_pyramids, {}, nonCapitalId)).toBe(false);
  });

  it('irrigation: true only once the food category reaches tier 1', () => {
    const buildings = createEmptyRegionBuildings();
    expect(meetsSiteRule(GREAT_PROJECTS.hanging_gardens, { buildings }, 'r1')).toBe(false);
    buildings.categories.food = 1;
    expect(meetsSiteRule(GREAT_PROJECTS.hanging_gardens, { buildings }, 'r1')).toBe(true);
  });

  it('devAtLeast15: true only once total dev reaches 15', () => {
    expect(meetsSiteRule(GREAT_PROJECTS.colosseum, { dev: { tax: 5, production: 5, manpower: 4 } }, 'r1')).toBe(false);
    expect(meetsSiteRule(GREAT_PROJECTS.colosseum, { dev: { tax: 5, production: 5, manpower: 5 } }, 'r1')).toBe(true);
  });

  it('is false for a project with no such rule', () => {
    expect(meetsSiteRule({ siteRule: 'not_a_real_rule' }, {}, 'r1')).toBe(false);
  });
});

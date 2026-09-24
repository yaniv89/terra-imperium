import { describe, it, expect } from 'vitest';
import { staticSources, contextSources, regionSources } from './sources';
import { createInitialState } from '../../context/GameContext';
import { createEmptyRegionBuildings } from '../../data/buildings';

describe('staticSources', () => {
  it('emits one line per non-zero hook across every active government reform tier', () => {
    const nation = { government: { type: 'monarchy', reforms: { bronze: 'despotic_rule', classical: 'imperial_bureaucracy' } } };
    const lines = staticSources(nation);
    expect(lines).toEqual(expect.arrayContaining([
      { key: 'national.milBonus', value: 1, sourceType: 'government', sourceId: 'despotic_rule', label: 'Despotic Rule' },
      { key: 'national.stabilityBonus', value: -1, sourceType: 'government', sourceId: 'despotic_rule', label: 'Despotic Rule' },
      { key: 'national.governingCapacity', value: 10, sourceType: 'government', sourceId: 'imperial_bureaucracy', label: 'Imperial Bureaucracy' },
      { key: 'national.admBonus', value: 1, sourceType: 'government', sourceId: 'imperial_bureaucracy', label: 'Imperial Bureaucracy' }
    ]));
  });

  it('emits nothing for a reform tier with no wired effects (e.g. Divine Kingship)', () => {
    const nation = { government: { type: 'monarchy', reforms: { bronze: 'divine_kingship' } } };
    expect(staticSources(nation).some((l) => l.sourceType === 'government')).toBe(false);
  });

  it('emits nothing when the nation has no government type at all', () => {
    expect(staticSources({}).some((l) => l.sourceType === 'government')).toBe(false);
  });

  it('emits one line per non-zero hook on the nation\'s active law in every category', () => {
    const lines = staticSources({ laws: { taxation: 'land_tax', justice: 'martial_law' } });
    expect(lines).toEqual(expect.arrayContaining([
      { key: 'national.goldMult', value: 0.1, sourceType: 'law', sourceId: 'land_tax', label: 'Land Tax' },
      { key: 'national.goldMult', value: -0.2, sourceType: 'law', sourceId: 'martial_law', label: 'Martial Law' },
      { key: 'national.dipBonus', value: -1, sourceType: 'law', sourceId: 'martial_law', label: 'Martial Law' }
    ]));
  });

  it('emits nothing for a law with no wired effects (e.g. the Tribute/Customary Law defaults)', () => {
    expect(staticSources({ laws: { taxation: 'tribute', justice: 'customary_law' } }).some((l) => l.sourceType === 'law')).toBe(false);
  });

  it('emits nothing for identity alone (plan §M8.3: identity gates/discounts instead of granting a flat bonus)', () => {
    expect(staticSources({ identity: { collectivism: 100, secularism: 100, globalism: 100 } }).some((l) => l.sourceType === 'identity')).toBe(false);
  });

  it('emits an estate\'s threshold BONUS lines once its loyalty is high enough (plan §M9)', () => {
    const lines = staticSources({ estates: { clergy: { loyalty: 60, influence: 10, privileges: [] } } });
    expect(lines).toEqual(expect.arrayContaining([
      { key: 'national.stabilityBonus', value: 1, sourceType: 'estate', sourceId: 'clergy', label: 'Clergy (loyal)' },
      { key: 'national.admBonus', value: 1, sourceType: 'estate', sourceId: 'clergy', label: 'Clergy (loyal)' }
    ]));
  });

  it('emits an estate\'s threshold MALUS lines once its loyalty is too low', () => {
    const lines = staticSources({ estates: { nobility: { loyalty: 10, influence: 10, privileges: [] } } });
    expect(lines).toContainEqual({ key: 'national.milBonus', value: -0.5, sourceType: 'estate', sourceId: 'nobility', label: 'Nobility (disloyal)' });
  });

  it('emits nothing for an estate in the neutral 30-59 loyalty band', () => {
    expect(staticSources({ estates: { clergy: { loyalty: 45, influence: 10, privileges: [] } } }).some((l) => l.sourceType === 'estate')).toBe(false);
  });

  it('emits a line per granted privilege', () => {
    const lines = staticSources({ estates: { clergy: { loyalty: 50, influence: 10, privileges: ['control_of_education'] } } });
    expect(lines).toContainEqual({ key: 'national.techPointsMult', value: 0.15, sourceType: 'privilege', sourceId: 'control_of_education', label: 'Control of Education' });
  });

  it('emits crown land lines at the low/high thresholds, nothing in between', () => {
    expect(staticSources({ crownLand: 20 })).toContainEqual({ key: 'national.goldMult', value: -0.1, sourceType: 'crownLand', sourceId: 'crownLand', label: 'Low Crown Land' });
    const high = staticSources({ crownLand: 80 });
    expect(high).toContainEqual({ key: 'national.goldMult', value: 0.1, sourceType: 'crownLand', sourceId: 'crownLand', label: 'High Crown Land' });
    expect(high).toContainEqual({ key: 'national.stabilityBonus', value: -1, sourceType: 'crownLand', sourceId: 'crownLand', label: 'High Crown Land' });
    expect(staticSources({ crownLand: 50 }).some((l) => l.sourceType === 'crownLand')).toBe(false);
  });

  it('emits nothing for an empty/missing nation', () => {
    expect(staticSources(undefined)).toEqual([]);
    expect(staticSources({})).toEqual([]);
  });

  it('reads timed nation.modifiers[] entries', () => {
    const lines = staticSources({ modifiers: [{ id: 'm1', sourceType: 'event', label: 'Test Event', mods: { 'national.goldMult': 0.2 } }] });
    expect(lines).toContainEqual({ key: 'national.goldMult', value: 0.2, sourceType: 'event', sourceId: 'm1', label: 'Test Event' });
  });

  it('skips a hook with no LEGACY_HOOK mapping rather than throwing', () => {
    const nation = { government: { type: 'monarchy', reforms: { bronze: 'despotic_rule' } }, laws: { taxation: 'not_real' } };
    expect(() => staticSources(nation)).not.toThrow();
  });
});

describe('contextSources', () => {
  it('includes a tax-rate goldMult line when the nation has a non-default tax rate', () => {
    const state = { nations: { fr: { taxRate: 'high' } } };
    const lines = contextSources(state, 'fr');
    expect(lines.some((l) => l.sourceType === 'tax' && l.key === 'national.goldMult')).toBe(true);
  });

  // Plan §M12: "+5% x pact count", replacing the old flat +20 gold/partner (helpers.js). Pacts are
  // inherently player-centric (hasTradeAgreement lives on the OTHER nation's own record).
  it('includes a Trade Pact goldMult line for the player, scaled by how many partners have hasTradeAgreement', () => {
    const state = { playerNationId: 'fr', nations: { fr: {}, de: { hasTradeAgreement: true }, gb: { hasTradeAgreement: true } } };
    const lines = contextSources(state, 'fr');
    expect(lines).toContainEqual({ key: 'national.goldMult', value: 0.1, sourceType: 'tradePact', sourceId: 'trade_pacts', label: 'Trade Pacts' });
  });

  it('emits no Trade Pact line with zero active pacts', () => {
    const state = { playerNationId: 'fr', nations: { fr: {}, de: {} } };
    expect(contextSources(state, 'fr').some((l) => l.sourceType === 'tradePact')).toBe(false);
  });

  it('never emits a Trade Pact line for a non-player nation', () => {
    const state = { playerNationId: 'fr', nations: { fr: {}, de: { hasTradeAgreement: true }, gb: {} } };
    expect(contextSources(state, 'gb').some((l) => l.sourceType === 'tradePact')).toBe(false);
  });

  it('includes satellite lines only for the satellite\'s own owner', () => {
    const state = {
      nations: { fr: {}, de: {} },
      satellites: { s1: { id: 's1', ownerId: 'de', typeId: 'navigation' } }
    };
    expect(contextSources(state, 'de').some((l) => l.sourceType === 'satellite')).toBe(true);
    expect(contextSources(state, 'fr').some((l) => l.sourceType === 'satellite')).toBe(false);
  });

  it('includes a real per-tech effect line for the player\'s own researched techs, and only for the player (plan §M7)', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const withTech = {
      ...base,
      techTree: { ...base.techTree, governance_code_of_laws: { ...base.techTree.governance_code_of_laws, researched: true } }
    };
    expect(contextSources(withTech, 'fr')).toContainEqual({ key: 'national.admBonus', value: 1, sourceType: 'tech', sourceId: 'governance_code_of_laws', label: 'Code of Laws' });
    expect(contextSources(withTech, 'de').some((l) => l.sourceType === 'tech')).toBe(false);
  });

  it('emits nothing for a tech with no effects table entry (an unlock-only tech)', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const withTech = {
      ...base,
      techTree: { ...base.techTree, governance_civic_assemblies: { ...base.techTree.governance_civic_assemblies, researched: true } }
    };
    expect(contextSources(withTech, 'fr').some((l) => l.sourceType === 'tech')).toBe(false);
  });

  it('includes a great project\'s current-tier effect only for whoever currently owns its site region (plan §M10)', () => {
    const state = {
      playerNationId: 'fr',
      nations: { fr: {}, de: {} },
      regions: { r1: { owner: 'fr' } },
      greatProjects: { great_library: { regionId: 'r1', tier: 2 } } // techPointsMult 0.2
    };
    expect(contextSources(state, 'fr')).toContainEqual({ key: 'national.techPointsMult', value: 0.2, sourceType: 'greatProject', sourceId: 'great_library', label: 'The Great Library' });
    expect(contextSources(state, 'de').some((l) => l.sourceType === 'greatProject')).toBe(false);
  });

  it('follows a great project to its new owner the instant the site region is captured', () => {
    const state = {
      playerNationId: 'fr',
      nations: { fr: {}, de: {} },
      regions: { r1: { owner: 'de' } }, // captured
      greatProjects: { great_library: { regionId: 'r1', tier: 1 } }
    };
    expect(contextSources(state, 'fr').some((l) => l.sourceType === 'greatProject')).toBe(false);
    expect(contextSources(state, 'de')).toContainEqual({ key: 'national.techPointsMult', value: 0.1, sourceType: 'greatProject', sourceId: 'great_library', label: 'The Great Library' });
  });

  it('emits nothing for a project with no wired ongoing effect (e.g. the Great Wall)', () => {
    const state = { playerNationId: 'fr', nations: { fr: {} }, regions: { r1: { owner: 'fr' } }, greatProjects: { great_wall: { regionId: 'r1', tier: 2 } } };
    expect(contextSources(state, 'fr').some((l) => l.sourceType === 'greatProject')).toBe(false);
  });

  it('a governingCapacity reform raises the overextension threshold, delaying the overextension penalty line (plan §M8.1)', () => {
    const manyRegions = {};
    for (let i = 0; i < 15; i++) manyRegions[`r${i}`] = { owner: 'fr' };
    const withoutReform = { playerNationId: 'fr', nations: { fr: { startRegionCount: 1, government: { type: 'tribal', reforms: {} } } }, regions: manyRegions };
    const withReform = { playerNationId: 'fr', nations: { fr: { startRegionCount: 1, government: { type: 'monarchy', reforms: { classical: 'imperial_bureaucracy' } } } }, regions: manyRegions };
    const without = contextSources(withoutReform, 'fr').find((l) => l.sourceType === 'overextension');
    const withGov = contextSources(withReform, 'fr').find((l) => l.sourceType === 'overextension');
    expect(without).toBeDefined();
    expect(withGov?.value ?? 0).toBeGreaterThan(without.value); // less negative (or absent) — the reform's +10 capacity eases it
  });
});

describe('regionSources (plan §M6: building tiers)', () => {
  it('emits nothing for a region with no buildings at all', () => {
    expect(regionSources({ buildings: createEmptyRegionBuildings() })).toEqual([]);
  });

  it('emits a line per built category at its current tier\'s effect', () => {
    const buildings = createEmptyRegionBuildings();
    buildings.categories.economy = 0; // Market: local.taxIncome 0.15
    const lines = regionSources({ buildings });
    expect(lines).toContainEqual({ key: 'local.taxIncome', value: 0.15, sourceType: 'building', sourceId: 'economy_0', label: 'Market' });
  });

  it('uses the CURRENT tier\'s value only, not every tier up to it', () => {
    const buildings = createEmptyRegionBuildings();
    buildings.categories.military = 2; // Military Academy: local.manpower 0.50 (not Barracks' 0.20 or Drill Yard's 0.35)
    const lines = regionSources({ buildings });
    expect(lines.filter((l) => l.key === 'local.manpower')).toEqual([
      { key: 'local.manpower', value: 0.50, sourceType: 'building', sourceId: 'military_2', label: 'Military Academy' }
    ]);
  });

  it('emits nothing for a category left at -1 (unbuilt)', () => {
    const buildings = createEmptyRegionBuildings();
    const lines = regionSources({ buildings });
    expect(lines).toEqual([]);
  });

  it('is safe against a region with no buildings field at all', () => {
    expect(regionSources({})).toEqual([]);
    expect(regionSources(null)).toEqual([]);
  });
});

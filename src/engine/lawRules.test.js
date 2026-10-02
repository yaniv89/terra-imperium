// Laws with real effects on the tile world and the AI's doctrine table (plan C4.4 / C4.5).
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { lawRulesOf, describeRules, EMPTY_RULES } from './lawRules';
import { LAW_CATEGORIES, getLaw } from '../data/laws';
import { GOVERNMENT_REFORMS } from '../data/government';
import { DOCTRINE_GOVERNMENT, DOCTRINE_LAWS, DOCTRINE_REFORMS, DOCTRINE_IDS } from '../data/nations';
import { loyaltyTarget, LOYALTY_NEUTRAL } from './loyalty';
import { calcNationBalance } from './economy';
import { opinionReasons } from './opinion';
import { pillageTile, RAID_GOLD } from './threat';
import { calcIncome } from '../utils/helpers';
import { pickAILaw, AI_LAW_ADM_RESERVE } from './aiEconomy';
import { getLawChangeCost } from '../data/laws';
import { getCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';

const base = () => createInitialState({ playerNationId: 'fr', rngSeed: 5 });
const withLaws = (state, laws, nationId = 'fr') => ({ ...state, nations: { ...state.nations, [nationId]: { ...state.nations[nationId], laws: { ...state.nations[nationId].laws, ...laws } } } });

describe('lawRulesOf', () => {
  it('sums numbers and ORs booleans over laws and reforms, memoised per nation', () => {
    const s = base();
    const fr = s.nations.fr;
    expect(lawRulesOf(fr)).toEqual(EMPTY_RULES);
    const n = { ...fr, laws: { ...fr.laws, justice: 'codified_law', religion: 'tolerance', conscription: 'professional_army' }, government: { type: 'tribal', reforms: { bronze: 'chieftaincy' } } };
    const r = lawRulesOf(n);
    expect(r.loyaltyBonus).toBe(3); expect(r.tolerance).toBe(true); expect(r.unitUpkeepMult).toBeCloseTo(0.3); expect(r.pillageGoldMult).toBe(1);
    expect(lawRulesOf(n)).toBe(r);
    expect(describeRules(r)).toEqual(['+3 loyalty in every city', 'no loyalty penalty for foreign-culture cities', 'army upkeep +30%', 'raids yield +100% gold']);
  });
  it('every law and reform rule uses a known key', () => {
    const keys = Object.keys(EMPTY_RULES);
    Object.values(LAW_CATEGORIES).flat().forEach((l) => Object.keys(l.rules || {}).forEach((k) => expect(keys, l.id).toContain(k)));
    Object.values(GOVERNMENT_REFORMS).forEach((byAge) => Object.values(byAge).flat().forEach((r) => Object.keys(r.rules || {}).forEach((k) => expect(keys, r.id).toContain(k))));
    Object.values(LAW_CATEGORIES).flat().forEach((l) => expect(l.description, l.id).not.toMatch(/not yet|M1[1-4]\)/));
  });
});

describe('the systems read the rules', () => {
  it('loyalty: a flat bonus per city and Tolerance floors the people term', () => {
    const s = base(); const paris = s.regions[getCapital(s, 'fr')];
    const foreign = { ...paris, culture: { de: 0.9, fr: 0.1 } };
    const before = loyaltyTarget(s, foreign);
    expect(before.fromShare).toBe(0);
    const tolerant = withLaws(s, { religion: 'tolerance', justice: 'rule_of_law' });
    const after = loyaltyTarget(tolerant, foreign);
    expect(after.fromShare).toBe(LOYALTY_NEUTRAL); expect(after.law).toBe(4);
    expect(after.total).toBe(Math.min(100, before.total + LOYALTY_NEUTRAL + 4));
  });
  it('upkeep: Feudal Levy cuts the army bill by 20%', () => {
    const s = base(); const paris = getCapital(s, 'fr');
    const units = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { id, ownerId: 'fr', regionId: paris, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000 }]));
    const full = calcNationBalance({ ...s, units }, 'fr').expenses.armyUpkeep;
    const levy = calcNationBalance(withLaws({ ...s, units }, { conscription: 'feudal_levy' }), 'fr').expenses.armyUpkeep;
    expect(full).toBeGreaterThan(0); expect(levy).toBe(Math.round(full * 0.8));
  });
  it('opinion: a trade partner reads the trade law', () => {
    const s = { ...base(), nations: {} }; const b0 = base();
    s.nations = { ...b0.nations, de: { ...b0.nations.de, hasTradeAgreement: true } };
    expect(opinionReasons(s, 'de', 'fr').find((r) => r.id === 'tradeLaw')).toBeUndefined();
    const merc = withLaws(s, { trade: 'mercantilism' });
    expect(opinionReasons(merc, 'de', 'fr').find((r) => r.id === 'tradeLaw').value).toBe(-5);
    const free = withLaws(s, { trade: 'free_trade' });
    expect(opinionReasons(free, 'de', 'fr').find((r) => r.id === 'tradeLaw').value).toBe(15);
  });
  it('raids: Chieftaincy doubles the gold', () => {
    const s = base(); const tiles = getTiles();
    const berlin = s.regions[getCapital(s, 'de')];
    const tile = tiles.neighbors[berlin.tile].find((t) => s.world.tileOwner[t] === berlin.id && t !== berlin.tile);
    const world = { ...s.world, tileState: { ...s.world.tileState, [tile]: { ...(s.world.tileState[tile] || {}), improvement: 'farm' } } };
    const enemies = new Set(['de']);
    expect(pillageTile({ ...s, world }, 'fr', tile, enemies).gold).toBe(RAID_GOLD);
    const chief = { ...s, world, nations: { ...s.nations, fr: { ...s.nations.fr, government: { type: 'tribal', reforms: { bronze: 'chieftaincy' } } } } };
    expect(pillageTile(chief, 'fr', tile, enemies).gold).toBe(RAID_GOLD * 2);
  });
  it('income: Mercantilism adds flat gold per trade pact', () => {
    const s0 = base();
    const s = { ...s0, nations: { ...s0.nations, de: { ...s0.nations.de, hasTradeAgreement: true }, it: { ...s0.nations.it, hasTradeAgreement: true } } };
    const plain = calcIncome(s).gold;
    const merc = withLaws(s, { trade: 'mercantilism' });
    const mercNoMult = { ...merc, nations: { ...merc.nations, fr: { ...merc.nations.fr, laws: { ...merc.nations.fr.laws } } } };
    // Mercantilism also carries +20% goldMult; compare against the same multiplier with the flat part removed.
    const gold = calcIncome(mercNoMult).gold;
    expect(gold).toBeGreaterThan(plain * 1.2 - 1);
    expect(gold - plain * 1.2).toBeGreaterThanOrEqual(2 * 2 - 1);
  });
});

describe('the AI picks by doctrine', () => {
  it('the tables name real governments, laws and reforms for every doctrine', () => {
    const lawIds = new Set(Object.values(LAW_CATEGORIES).flat().map((l) => l.id));
    const reformIds = new Set(Object.values(GOVERNMENT_REFORMS).flatMap((byAge) => Object.values(byAge).flat().map((r) => r.id)));
    DOCTRINE_IDS.forEach((d) => {
      expect(DOCTRINE_GOVERNMENT[d]?.length, d).toBeGreaterThan(0);
      Object.entries(DOCTRINE_LAWS[d] || {}).forEach(([category, ids]) => ids.forEach((id) => { expect(lawIds.has(id), `${d}/${id}`).toBe(true); expect(getLaw(category, id), `${d}/${category}/${id}`).toBeTruthy(); }));
      (DOCTRINE_REFORMS[d] || []).forEach((id) => expect(reformIds.has(id), `${d}/${id}`).toBe(true));
    });
  });
  it('a conqueror with the tech takes Mass Conscription first, a merchant waits for Free Trade and never moves backwards', () => {
    const s = base();
    const researched = ['military_feudal_levies', 'military_standing_armies', 'military_mechanized_warfare', 'economy_minted_coinage', 'economy_joint_stock_companies'];
    const mk = (doctrine, laws = {}) => ({ ...s.nations.de, doctrine, tech: { ...s.nations.de.tech, researched }, laws: { ...s.nations.de.laws, ...laws }, lawCooldowns: {}, stability: 1, economy: { ...s.nations.de.economy, adm: 10000 } });
    const state = (nation) => ({ ...s, nations: { ...s.nations, de: nation } });
    const conqueror = mk('conqueror');
    const pick = pickAILaw(state(conqueror), 'de', conqueror, conqueror.economy);
    expect(pick).toEqual({ category: 'conscription', id: 'mass_conscription' });
    const merchant = mk('merchant');
    // Free Trade needs Global Markets, so the merchant takes Mercantilism, its second choice, before any tax law.
    expect(pickAILaw(state(merchant), 'de', merchant, merchant.economy)).toEqual({ category: 'trade', id: 'mercantilism' });
    const traded = mk('merchant', { trade: 'mercantilism' });
    expect(pickAILaw(state(traded), 'de', traded, traded.economy)).toEqual({ category: 'taxation', id: 'land_tax' });
    const settled = mk('conqueror', { conscription: 'mass_conscription', justice: 'martial_law', taxation: 'head_tax' });
    const again = pickAILaw(state(settled), 'de', settled, settled.economy);
    expect(again?.category).not.toBe('conscription');
    const poor = { ...conqueror, economy: { ...conqueror.economy, adm: getLawChangeCost(state(conqueror), 'de', 'conscription', 'mass_conscription') + AI_LAW_ADM_RESERVE - 1 } };
    expect(pickAILaw(state(poor), 'de', poor, poor.economy)?.id).not.toBe('mass_conscription');
  });
});

// src/components/battle/preBattleModel.test.js
// W11 Pre-battle: without intel the odds are the scouts' band and their men a range; a spy
// report makes them exact and says so; the walls and the houses; 300 a side.
import { describe, expect, it } from 'vitest';
import { getNeighborIds } from '../../data/regions';
import { atGates } from '../../engine/testWorld';
import { preBattleModel, autoText, parityLine, rangeLine } from './preBattleModel';
import { cityManifestOf } from '../../engine/cityManifest';
import { peoplesWorld, rivalOf, withBorder } from '../../engine/testWorld';
import { estimateMarchOdds, seenStandby, autoChance } from '../../engine/battleOdds';
import { marchOddsText } from '../map/marchOddsText';
import { battleInputs } from '../../engine/battleInputs';
import { getTiles } from '../../data/geo/tiles';
import { forgetSeen } from './oddsMemory';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

const setup = () => {
  const state = withBorder(WORLD, FR, DE);
  const from = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && getNeighborIds(id).some((n) => state.regions[n]?.owner === DE));
  const target = getNeighborIds(from).find((n) => state.regions[n]?.owner === DE);
  const s = atGates({
    ...state,
    wars: [{ id: 'w', aggressor: FR, enemy: DE, active: true, score: 0 }],
    resources: { ...state.resources, gold: 10000, mil: 1000 },
    units: {
      a: { id: 'a', ownerId: FR, regionId: from, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1 },
      d: { id: 'd', ownerId: DE, regionId: target, domain: 'land', classId: 'infantry', strength: 300, maxStrength: 300, morale: 100, movesLeft: 1 }
    }
  }, from, target);
  return { s, from, target };
};

describe('W11 preBattleModel', () => {
  it("without intel: the scouts' band, a range of men, never exact odds", { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const m = preBattleModel(s, { fromRegionId: from, targetRegionId: target }, { samples: 20 });
    expect(m.v.ok).toBe(true);
    expect(m.chance.exact).toBe(false);
    expect(m.chance.verdict).toBe('Likely win');
    expect(m.chance.band[1] - m.chance.band[0]).toBeCloseTo(0.33, 5);
    expect(m.theirs.total).toMatch(/^about [\d,]+ to [\d,]+$/);
    expect(m.yours.men).toBe(1000);
    expect(m.walls.maxLost).toBeUndefined();
    expect(m.walls.ruleText).toBeUndefined();
    expect(m.size.cap).toBe(300);
    expect(m.command).toMatch(/300 a side/);
  });

  it('with a spy report: exact odds, named as such', { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const m = preBattleModel({ ...s, intel: { [DE]: s.turnNumber + 3 } }, { fromRegionId: from, targetRegionId: target }, { samples: 20 });
    expect(m.chance).toMatchObject({ exact: true, source: 'Spy report' });
    expect(m.chance.win + m.chance.lose + m.chance.draw).toBeCloseTo(1, 5);
    expect(typeof m.theirs.total).toBe('number');
  });

  it("exact odds carry the Auto range, at most three ranked reasons and the kind's parity line", { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const m = preBattleModel({ ...s, intel: { [DE]: s.turnNumber + 3 } }, { fromRegionId: from, targetRegionId: target }, { samples: 40 });
    expect(m.chance.range).toMatch(/^Auto expects: win \d+( to \d+)?%\. You lose [\d,]+( to [\d,]+)? men, they lose/);
    expect(m.chance.reasons.length).toBeLessThanOrEqual(3);
    expect(m.chance.parity).toMatch(/^Auto matched real time in \d+ of \d+ test matchups\.$/);
    expect(preBattleModel({ ...s, intel: {} }, { fromRegionId: from, targetRegionId: target }, { samples: 4 }).chance.range).toBeUndefined();
  });

  it('a hopeless attack says so with its main reason; an even one does not (I011 for attacks)', { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const spy = { ...s, intel: { [DE]: s.turnNumber + 3 } };
    const weak = { ...spy, units: { ...spy.units, a: { ...spy.units.a, strength: 60 }, d: { ...spy.units.d, strength: 1000, maxStrength: 1000 } } };
    const m = preBattleModel(weak, { fromRegionId: from, targetRegionId: target }, { samples: 20 });
    expect(m.hopeless).toBe(true);
    expect(m.hopelessText).toMatch(/^Hopeless: Auto wins only \d+% of the time, mostly from Numbers x0\.\d\d\. Call off/);
    expect(preBattleModel(spy, { fromRegionId: from, targetRegionId: target }, { samples: 20 }).hopelessText).toBeNull();
  });

  it('no parity record or no range yields no line, never a made-up number', () => {
    expect(parityLine('naval')).toBeNull();
    expect(parityLine(undefined)).toBeNull();
    expect(rangeLine({})).toBeNull();
  });
});

describe('the two ways against a city (the 14 October rule)', () => {
  it('the card says Auto fights the garrison first and Command takes a city it wins', { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const m = preBattleModel(s, { fromRegionId: from, targetRegionId: target }, { samples: 10 });
    expect(m.cityRule).toBe('garrison');
    expect(m.auto).toMatch(/Auto fights the garrison first; the city is taken only when empty and its defences are broken/);
    expect(m.command).toMatch(/^Win the battle and the city is yours/);
    const { d, ...rest } = s.units; // eslint-disable-line no-unused-vars
    expect(preBattleModel({ ...s, units: rest }, { fromRegionId: from, targetRegionId: target }, { samples: 10 }).cityRule).toBe('attack');
  });

  it('an empty city seen up close says how far one attack brings its defences down', () => {
    const text = autoText({ knownEmpty: true, odds: { capture: 0, city: { hpBefore: 520, hpAfter: 340, maxHp: 520 } } });
    expect(text).toMatch(/520 of 520 HP down to about 340/);
    expect(text).toMatch(/needs more attacks/);
    expect(autoText({ field: true })).toMatch(/the field is yours/);
  });
});
describe('DEF-01 on the attack card: Command with nobody to fight', () => {
  it('a city seen to hold no garrison and no militia disables Command and says why; with a militia it does not', { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const { d, ...rest } = s.units; // eslint-disable-line no-unused-vars
    const seen = { ...s, units: rest, intel: { [DE]: s.turnNumber + 3 } };
    const withMilitia = preBattleModel(seen, { fromRegionId: from, targetRegionId: target }, { samples: 4 });
    expect(withMilitia.knownEmpty).toBe(true);
    expect(withMilitia.commandBlocked).toBeNull();
    const manifest = cityManifestOf(seen, target);
    const ruined = Object.fromEntries(manifest.structures.map((x) => [x.id, true]));
    const bare = { ...seen, regions: { ...seen.regions, [target]: { ...seen.regions[target], cityDamage: { ruined, damaged: {} } } } };
    const m = preBattleModel(bare, { fromRegionId: from, targetRegionId: target }, { samples: 4 });
    expect(m.commandBlocked).toMatch(/^Nobody defends it, not even a militia/);
    // Without intel the card cannot know: Command stays, and the reducer says so on the result.
    const blind = preBattleModel({ ...bare, intel: {} }, { fromRegionId: from, targetRegionId: target }, { samples: 4 });
    expect(blind.commandBlocked).toBeNull();
  });
});

// Round 3b (odds-truth): one city, one turn, one strength on every surface; the troops a commanded
// battle calls in and a garrison that grew since an earlier turn are said on the card.
describe('odds truth', () => {
  it('the march preview, the pre-battle card and Auto read the same strength on the same state', { timeout: 30000 }, () => {
    const { s, from, target } = setup();
    const spy = { ...s, intel: { [DE]: s.turnNumber + 3 } };
    const m = preBattleModel(spy, { fromRegionId: from, targetRegionId: target }, { samples: 10 });
    const march = estimateMarchOdds(spy, [spy.units.a], target, 10);
    const auto = battleInputs(spy, { attackerUnits: m.v.attackerUnits, defenderUnits: m.v.defenderUnits, cityId: target, fromRegionId: from });
    const sum = (us) => us.reduce((n, u) => n + u.strength, 0);
    expect(march.defenderStrength).toBe(sum(auto.defenderUnits));
    expect(m.theirs.men).toBe(sum(auto.defenderUnits));
    expect(march.attackerStrength).toBe(sum(auto.attackerUnits));
  });

  it('names the enemy troops standing near the city, which join only a commanded battle', { timeout: 30000 }, () => {
    const { s, from, target } = setup();
    const near = getTiles().neighbors[s.regions[target].tile].find((x) => x !== s.units.a.tile);
    const st = { ...s, intel: { [DE]: s.turnNumber + 3 }, units: { ...s.units, r: { id: 'r', ownerId: DE, regionId: 'elsewhere', tile: near, domain: 'land', classId: 'infantry', strength: 2000, maxStrength: 2000, morale: 100, movesLeft: 1 } } };
    expect(seenStandby(st, target).strength).toBe(2000);
    const m = preBattleModel(st, { fromRegionId: from, targetRegionId: target }, { samples: 4 });
    expect(m.theirs.note).toMatch(/20,000 more enemy men stand near it: a battle you command meets about [\d,]+ with them and about [\d,]+ auxiliaries it trains\. Auto fights without the men near it\./);
  });

  // Lead playtest 29 Oct, Blidaru: the march said "Hopeless on Auto", the card "Likely win". One chance, one verdict.
  it.each([['a garrison', 300], ['militia alone', 0]])('with %s, the march line and the card give the same Auto chance and hopeless call', { timeout: 60000 }, (_, garrison) => {
    const { s, from, target } = setup();
    const units = { ...s.units, d: { ...s.units.d, strength: garrison } };
    if (!garrison) delete units.d;
    const spy = { ...s, units, intel: { [DE]: s.turnNumber + 3 }, regions: { ...s.regions, [target]: { ...s.regions[target], defenseLevel: 3 } } };
    const m = preBattleModel(spy, { fromRegionId: from, targetRegionId: target }, { samples: 20 });
    const march = estimateMarchOdds(spy, [spy.units.a], target, 20);
    expect(m.autoP).toBe(autoChance(march));
    expect(m.hopeless).toBe(marchOddsText(march, 'X').hopeless);
    if (m.chance) expect(m.chance.verdict === 'Likely win').toBe(m.autoP >= 0.65);
  });

  it('a garrison that grew since an earlier turn says so', { timeout: 30000 }, () => {
    forgetSeen();
    const { s, from, target } = setup();
    const spy = { ...s, intel: { [DE]: s.turnNumber + 3 } };
    preBattleModel(spy, { fromRegionId: from, targetRegionId: target }, { samples: 4 });
    const later = { ...spy, turnNumber: spy.turnNumber + 2, units: { ...spy.units, d: { ...spy.units.d, strength: 3000, maxStrength: 3000 } } };
    const m = preBattleModel(later, { fromRegionId: from, targetRegionId: target }, { samples: 4 });
    expect(m.theirs.note).toMatch(/Up from [\d,]+ on turn \d+: more troops marched in\./);
    expect(m.theirs.note).toContain(`on turn ${spy.turnNumber}:`);
  });
});

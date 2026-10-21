// Renown, levels, points, the Virtue tree and the AI ruler (differentiation plan U11, RULER-PLAN 7.5).
import { describe, it, expect } from 'vitest';
import { grantRenown, grantBattleRenown, cityTakenRenown, techRenown, timeRenown, grantEraLegacy, humbleRuler, sizeDamp } from './renown';
import { createRuler, rulerLevel, rulerPoints, raiseAttribute, raiseBlock, takeVirtue, virtueBlock, reshapeRuler, aiDevelopRuler, attributeCap } from './rulers';
import { RENOWN, BATTLE_RENOWN_TURN_CAP, CATCHUP_MULT, renownForLevel, ERA_LEGACY_VIRTUE_MAX, RULER_START } from '../data/rulers';
import { VIRTUES, BRANCHES, TIERS, tierAgeIndex, rulerRules, DOCTRINE_RULER_PLAN } from '../data/rulerVirtues';
import { LEGACY_HOOK } from './modifiers/registry';
import { lawRulesOf } from './lawRules';
import { AGE_ORDER, FIRST_AGE_ID, LAST_AGE_ID, GAME_SPEEDS, speedTurns } from '../data/ages';
import { rulerWarMult, rulerBuildOrder } from './rulerBias';
import { peoplesWorld, majorIds } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { assertGameState } from './stateAudit';

const nation = (extra = {}, ruler = {}) => ({ id: 'p', ruler: { ...createRuler('p'), ...ruler }, ...extra });
const world = (ruler = {}, ageId = FIRST_AGE_ID, extra = {}) => ({ playerNationId: 'p', techAgeId: ageId, turnNumber: 5, nations: { p: nation(extra, ruler) } });

describe('levels', () => {
  it('follow 50 + 10 x L renown a level, capped at 30', () => {
    expect(rulerLevel(0)).toBe(1);
    expect(rulerLevel(59)).toBe(1);
    expect(rulerLevel(60)).toBe(2);
    expect(renownForLevel(5)).toBe(300);
    expect(renownForLevel(10)).toBe(900);
    expect(renownForLevel(20)).toBe(2850);
    expect(rulerLevel(5799)).toBe(29);
    expect(rulerLevel(5800)).toBe(30);
    expect(rulerLevel(1e9)).toBe(30);
  });

  it('give an attribute point a level and a virtue point every even level, plus the founding one', () => {
    expect(rulerPoints(createRuler('p'))).toEqual({ level: 1, attribute: 0, virtue: 1 });
    expect(rulerPoints({ ...createRuler('p'), renown: renownForLevel(4) })).toEqual({ level: 4, attribute: 3, virtue: 3 });
    expect(rulerPoints({ ...createRuler('p'), renown: renownForLevel(4), bonusVirtuePoints: 2, adm: 4, traits: ['warlord'] })).toEqual({ level: 4, attribute: 2, virtue: 4 });
  });
});

describe('renown grants', () => {
  it('add, keep the last deeds, never go negative, skip a nation without a ruler', () => {
    const n = grantRenown(nation(), 'cityFounded', RENOWN.cityFounded, 3, 'c1');
    expect(n.ruler.renown).toBe(15);
    expect(n.ruler.deeds[0]).toEqual({ turn: 3, id: 'cityFounded', renown: 15, where: 'c1' });
    expect(grantRenown(n, 'event', -50, 4)).toBe(n);
    const indep = { id: 'x', ruler: null };
    expect(grantRenown(indep, 'tech', 5, 1)).toBe(indep);
    let many = nation();
    for (let i = 0; i < 20; i++) many = grantRenown(many, 'tech', 2, i);
    expect(many.ruler.deeds.length).toBe(12);
  });

  it('a rising star earns more', () => {
    expect(grantRenown(nation({}, { risingStar: true }), 'tech', 10, 1).ruler.renown).toBe(10 * CATCHUP_MULT);
  });

  it('damp conquest and battle renown by size, and cap battles a turn', () => {
    expect(sizeDamp(6)).toBe(1);
    expect(sizeDamp(36)).toBeCloseTo(1 / 3);
    expect(cityTakenRenown({ capital: true, cities: 5 })).toBe(RENOWN.cityTaken + RENOWN.capitalTaken);
    expect(cityTakenRenown({ fromIndependent: true, cities: 24 })).toBe(RENOWN.cityTakenIndep / 2);
    let n = nation();
    for (let i = 0; i < 5; i++) n = grantBattleRenown(n, { outnumbered: true, cities: 3, turn: 7 });
    expect(n.ruler.renown).toBe(BATTLE_RENOWN_TURN_CAP);
    expect(grantBattleRenown(n, { cities: 3, turn: 8 }).ruler.renown).toBe(BATTLE_RENOWN_TURN_CAP + RENOWN.battleWon);
  });

  it('techs pay by their age, and an era legacy adds a virtue point at most five times', () => {
    expect(techRenown(0)).toBe(RENOWN.techBase);
    expect(techRenown(AGE_ORDER.length - 1)).toBe(RENOWN.techBase + RENOWN.techPerAge * (AGE_ORDER.length - 1));
    let n = nation();
    for (let i = 0; i < 7; i++) n = grantEraLegacy(n, i, AGE_ORDER[0]);
    expect(n.ruler.bonusVirtuePoints).toBe(ERA_LEGACY_VIRTUE_MAX);
    expect(n.ruler.renown).toBe(7 * RENOWN.eraLegacy);
  });

  it('time renown is equal over the same reference turns at every speed', () => {
    Object.keys(GAME_SPEEDS).forEach((speed) => {
      [FIRST_AGE_ID, LAST_AGE_ID].forEach((age) => {
        let sum = 0;
        for (let t = 1; t <= speedTurns(100, speed, age); t++) sum += timeRenown(speed, age, t);
        expect(Math.abs(sum - 100 * RENOWN.timePerRefTurn)).toBeLessThan(0.1 * 100 * RENOWN.timePerRefTurn);
      });
    });
  });

  it('a lost civil war empties the progress to the next level and spends the free reshape', () => {
    const n = humbleRuler(nation({}, { renown: renownForLevel(6) + 40 }), 'bronze');
    expect(n.ruler.renown).toBe(renownForLevel(6));
    expect(n.ruler.reshapeAge).toBe('bronze');
  });
});

describe('attributes and virtues', () => {
  it('cost 1 point up to 5 and 2 above, within the age cap', () => {
    const s = world({ renown: renownForLevel(10) }, LAST_AGE_ID);
    let t = s;
    for (let i = 0; i < 5; i++) t = raiseAttribute(t, 'p', 'cmd');
    expect(t.nations.p.ruler.cmd).toBe(5);
    expect(rulerPoints(t.nations.p.ruler).attribute).toBe(4);
    t = raiseAttribute(t, 'p', 'cmd');
    expect(t.nations.p.ruler.cmd).toBe(6);
    expect(rulerPoints(t.nations.p.ruler).attribute).toBe(2);
    const first = world({ renown: renownForLevel(10) });
    expect(raiseAttribute(first, 'p', 'adm').nations.p.ruler.adm).toBe(4);
    expect(raiseBlock(raiseAttribute(first, 'p', 'adm'), 'p', 'adm')).toBe('At the cap of this age');
    expect(raiseBlock(world(), 'p', 'adm')).toBe('Not enough attribute points');
  });

  it('open by tier and age, need the tier before, and one capstone only', () => {
    const first = world({ renown: renownForLevel(30), bonusVirtuePoints: 30 });
    expect(virtueBlock(first, 'p', 'ironDiscipline')).toBe('Opens in a later age');
    expect(virtueBlock(world({ renown: renownForLevel(30) }, LAST_AGE_ID), 'p', 'ironDiscipline')).toBe('Needs the tier before it');
    let late = world({ renown: renownForLevel(30), bonusVirtuePoints: 30 }, LAST_AGE_ID);
    ['warlord', 'ironDiscipline', 'siegeLord', 'terrorOfTheField', 'grandStrategist', 'conquerorsPeace', 'founder', 'masterBuilder', 'surveyor', 'granaries', 'engineerKing'].forEach((id) => { late = takeVirtue(late, 'p', id); });
    expect(late.nations.p.ruler.traits).toContain('conquerorsPeace');
    expect(virtueBlock(late, 'p', 'builderOfAges')).toBe('One capstone only');
    expect(virtueBlock(world(), 'p', 'founder')).toBe(null);
    expect(virtueBlock(takeVirtue(world(), 'p', 'founder'), 'p', 'envoy')).toBe('Not enough virtue points');
  });

  it('reshape is free once an age, then costs a decree and a point of stability', () => {
    const s = takeVirtue(raiseAttribute(world({ renown: renownForLevel(3), decrees: 1 }, FIRST_AGE_ID, { stability: 1 }), 'p', 'lrn'), 'p', 'scribe');
    const free = reshapeRuler(s, 'p');
    expect(free.nations.p.ruler).toMatchObject({ ...RULER_START, traits: [], reshapeAge: FIRST_AGE_ID });
    expect(free.nations.p.stability).toBe(1);
    const paid = reshapeRuler(free, 'p');
    expect(paid.nations.p.ruler.decrees).toBe(0);
    expect(paid.nations.p.stability).toBe(0);
    expect(reshapeRuler(paid, 'p')).toBe(paid);
  });
});

describe('the tree', () => {
  it('has five branches of six tiers, 50 points in all, effect keys that exist', () => {
    expect(BRANCHES.length).toBe(5);
    BRANCHES.forEach((b) => expect(Object.values(VIRTUES).filter((v) => v.branch === b).map((v) => v.tier).sort()).toEqual([1, 2, 3, 4, 5, 6]));
    expect(Object.values(VIRTUES).reduce((s, v) => s + v.cost, 0)).toBe(50);
    Object.values(VIRTUES).forEach((v) => Object.keys(v.effects).forEach((k) => expect(LEGACY_HOOK[k]).toBeTruthy()));
    expect(tierAgeIndex(1, AGE_ORDER.length)).toBe(0);
    expect(tierAgeIndex(TIERS, AGE_ORDER.length)).toBe(AGE_ORDER.length - 1);
  });

  it("the ruler's rules reach every rules consumer through lawRulesOf", () => {
    const r = { ...createRuler('p'), dip: 5, cmd: 6, lrn: 2, maj: 3, traits: ['envoy', 'ironDiscipline', 'cultOfTheRuler'] };
    expect(rulerRules(r)).toMatchObject({ rulerOpinion: 7, generalMartial: 2, scienceMult: 0.04, loyaltyBonus: 8 });
    expect(rulerRules(r).battleMoraleLoss).toBeCloseTo(-0.68);
    expect(rulerRules({ ...r, cmd: 8 }).battleMoraleLoss).toBe(-0.75);
    expect(lawRulesOf({ laws: {}, ruler: r }).loyaltyBonus).toBeGreaterThanOrEqual(8);
  });
});

describe('the AI ruler', () => {
  it('spends its points by its doctrine, within caps, with no rng', () => {
    const s = { ...world({ renown: renownForLevel(8) }, LAST_AGE_ID), playerNationId: 'me' };
    s.nations.p.doctrine = 'merchant';
    const next = aiDevelopRuler(s, 'p');
    const r = next.nations.p.ruler;
    expect(r.traits[0]).toBe('envoy');
    expect(r.dip).toBeGreaterThan(3);
    const pts = rulerPoints(r);
    expect(pts.attribute).toBeLessThanOrEqual(1);
    expect(pts.virtue).toBeLessThan(VIRTUES.envoy.cost + 2);
    expect(aiDevelopRuler(s, 'p')).toEqual(next);
    expect(aiDevelopRuler(next, 'p')).toBe(next);
    Object.keys(DOCTRINE_RULER_PLAN).forEach((d) => expect(DOCTRINE_RULER_PLAN[d].branches.every((b) => BRANCHES.includes(b))).toBe(true));
  });

  it('virtues bias the war roll and the build order', () => {
    expect(rulerWarMult(nation({}, { traits: ['warlord', 'ironDiscipline'] }))).toBeCloseTo(1.21);
    expect(rulerWarMult(nation({}, { traits: ['envoy'] }))).toBeCloseTo(0.9);
    expect(rulerBuildOrder(nation({}, { traits: ['scribe'] }), ['economy', 'science', 'culture'])).toEqual(['science', 'culture', 'economy']);
  });
});

describe('a quiet peoples world (integration)', () => {
  it('every AI ruler earns renown, levels and spends within its caps, and the audit stays clean', () => {
    const fired = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
    let s = { ...peoplesWorld({ seed: 11 }), firedEvents: fired, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    for (let t = 0; t < 40; t++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: s.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
    }
    const ais = majorIds(s).filter((id) => id !== s.playerNationId && !s.nations[id].isEliminated);
    expect(ais.length).toBeGreaterThan(3);
    ais.forEach((id) => {
      const r = s.nations[id].ruler;
      expect(r.renown).toBeGreaterThan(0);
      expect(r.traits.length).toBeGreaterThan(0);
      ['adm', 'dip', 'mil', 'cmd', 'lrn', 'maj'].forEach((a) => expect(r[a]).toBeLessThanOrEqual(attributeCap(s, id)));
      expect(rulerPoints(r).attribute).toBeLessThanOrEqual(1);
    });
    expect(() => assertGameState(s)).not.toThrow();
  }, 120000);
});

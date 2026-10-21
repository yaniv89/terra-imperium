import { CIVIL_WAR_STABILITY_STREAK_TURNS } from '../data/actionCosts';
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { SUPPLY_MAX, SUPPLY_ENEMY_LOSS, SUPPLY_HOME_GAIN, STARVE_STRENGTH } from './supplyMeter';
import { gameReducer } from '../context/GameContext';
import { GameStatus, ActionTypes, LogTypes } from '../data/types';
import { speedTurnLimit } from '../data/ages';
import { displayYear } from './displayYear';
import { TECH_TREE } from '../data/techTree';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD, REVOLT_SUCCESS_TURNS, INTEGRATION_CONTROL_THRESHOLD } from '../data/rebellion';
import { HISTORICAL_EVENTS, eventTechsNeeded } from '../data/events';
import { getTechsForAge } from '../data/techTree';
import { cardOf, CARDS, storyCard } from './eventDeck';
import { countryOfNation } from '../data/peoples';
import { speedTurns } from '../data/ages';
import { ageOf } from './nationState';
import { applyEventEffects } from './applyEventEffects';
import { withAgesResearched } from './research';
import { peoplesWorld, rivalOf, neighbourWorld, borderPair, cloneWorld } from './testWorld';
import { syncWorldRegistry } from './world/registry';
import { UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';
import { NATION_ELIMINATION_REWARD } from './elimination';

// One small peoples world (seed 11) for the whole file: P is the player, R1..R5 are rivals.
const W0 = peoplesWorld({ seed: 11 });
const P = W0.playerNationId;
const [R1, R2, R3, R4, R5] = [0, 1, 2, 3, 4].map((i) => rivalOf(W0, i));
const cap = (id) => W0.nations[id].capitalRegionId;
// The shared world (never mutate it); a number pins the roll seed.
const world = (rngSeed) => { syncWorldRegistry(W0); return rngSeed ? { ...W0, rngSeed } : W0; };

// Every real scripted/procedural event already "used up" — isolates tests that aren't themselves
// about the event system from HISTORICAL_EVENTS/proceduralEvents.js's real, non-empty content
// (Phase D3): resolveTurn is a no-op while an event is pending, so an unrelated test that runs
// enough turns to cross a real event's year would otherwise silently stall.
const withAllEventsFired = (state) => ({
  ...state,
  firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
  proceduralEventCooldown: 999999,
  // A queued defense battle pauses resolveTurn until the player fights it; these passive-player
  // loops let them auto-resolve instead (as the long-run harnesses do).
  battleSettings: { autoDefend: true }
});

describe('resolveTurn determinism', () => {
  it('produces identical output for identical input (same rngSeed)', () => {
    const state = world();
    const a = resolveTurn(state);
    const b = resolveTurn(state);
    expect(a).toEqual(b);
  });

  // Plan §13's real contract: "same seed + same action list => byte-identical resulting state" —
  // this is what a server-authoritative multiplayer session (plan §10) actually relies on, so it
  // has to hold across a genuine MIX of turn advances and player actions dispatched through the
  // real gameReducer entry point, not just two bare calls to resolveTurn on the same snapshot.
  // The sequence deliberately includes RNG-driven paths (LAUNCH_INVASION's battle resolution,
  // several ADVANCE_TURNs worth of AI decisions/rebellion rolls) rather than only side-effect-free
  // economic actions, which wouldn't actually exercise the seeded randomness this guarantees.
  it('replaying an identical sequence of turns and player actions from the same starting state converges to byte-identical results', () => {
    const initial = neighbourWorld({ rivals: 1 });
    syncWorldRegistry(initial);
    const [FRONTIER_REGION, TARGET_REGION] = borderPair(initial, P, R1);
    const withResources = { ...initial, resources: { ...initial.resources, gold: 100000, hr: 100000, mil: 100 } };
    // The player's border city and the rival city beside it: the recruited unit can launch a real
    // invasion from one to the other, exercising real battle RNG.
    const actions = [
      { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FRONTIER_REGION, classId: 'infantry' } },
      { type: ActionTypes.ADVANCE_TURN },
      { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'high' } },
      { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cap(P) } },
      { type: ActionTypes.ADVANCE_TURN },
      { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FRONTIER_REGION, targetRegionId: TARGET_REGION } },
      { type: ActionTypes.ADVANCE_TURN },
      { type: ActionTypes.ADVANCE_TURN },
      { type: ActionTypes.ADVANCE_TURN }
    ];
    const replay = (state) => actions.reduce((acc, action) => gameReducer(acc, action), state);
    const a = replay(withResources);
    const b = replay(withResources);
    expect(a).toEqual(b);
  });

  it('is a no-op once the game has ended', () => {
    const state = { ...world(), gameStatus: GameStatus.DEFEAT };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while a scripted event is blocking play', () => {
    const state = { ...world(), activeEventId: 'some_event' };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while a procedural event is blocking play', () => {
    const state = { ...world(), activeProceduralEvent: { id: 'x', options: [] } };
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn time: the year is a label, a turn is a turn (KTD3)', () => {
  const bronze = Object.values(TECH_TREE).filter((t) => t.ageId === 'bronze').map((t) => t.id);
  const withTechs = (state, ids) => ({ ...state, techTree: { ...state.techTree, ...Object.fromEntries(ids.map((id) => [id, { ...state.techTree[id], researched: true }])) } });

  it('the label at 5 of 10 Bronze techs is 1400 BCE, at none 2000 BCE', () => {
    const state = withAgesResearched(world(5), P, 'bronze'); // a Bronze Age start: the Stone techs are known
    expect(displayYear(state)).toBe(-2000);
    expect(displayYear(withTechs(state, bronze.slice(0, 5)))).toBe(-1400);
  });

  it('writes the label once a turn and never reads it: the same turn at any written year', () => {
    const state = world(5);
    const next = resolveTurn(state);
    expect(next.year).toBe(displayYear(next));
    const late = resolveTurn({ ...state, year: 1900 });
    expect(late.year).toBe(next.year);
    expect(late.turnNumber).toBe(next.turnNumber);
  });

  it('the label never goes down over a run', () => {
    let s = { ...world(5), firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true }, research: { current: null, queue: [], progress: {}, auto: true, lastCompleted: null } };
    let last = s.year;
    for (let t = 0; t < 40 && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.pendingPeaceOffer) s = { ...s, pendingPeaceOffer: null };
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      expect(s.year).toBeGreaterThanOrEqual(last);
      last = s.year;
    }
  }, 120000);

  it('ends the game at the speed turn limit (923 on Normal), once', () => {
    const state = withAllEventsFired({ ...world(5), turnNumber: 921 });
    const before = resolveTurn(state);
    expect(before.turnNumber).toBe(922);
    expect(before.ending).toBeUndefined();
    const end = resolveTurn(before);
    expect(end.turnNumber).toBe(923);
    expect(end.ending).toEqual({ reason: 'turnLimit' });
    expect([GameStatus.VICTORY, GameStatus.COMPLETE]).toContain(end.gameStatus);
    expect(end.nations[P].eraGoals?.stone).toBeDefined(); // the final age is scored
    expect(resolveTurn(end)).toBe(end);
  });

  it('increments turnNumber', () => {
    const state = world();
    const next = resolveTurn(state);
    expect(next.turnNumber).toBe(state.turnNumber + 1);
  });
});

describe('resolveTurn resource income', () => {
  it('grows the player\'s gold and hr each turn', () => {
    const state = world(5); // a fixed seed: a random first turn can cost gold
    const next = resolveTurn(state);
    expect(next.resources.gold).toBeGreaterThan(state.resources.gold);
    expect(next.resources.hr).toBeGreaterThan(state.resources.hr);
  });

  it('unlocks a newly-available resource at 0 once the player reaches its age', () => {
    // Classical unlocks Iron.
    const state = world();
    expect(state.resources.iron).toBeUndefined();
    const next = resolveTurn({ ...state, techAgeId: 'classical' });
    expect(next.resources.iron).toBeDefined();
  });

});

// Regression/feature: RECRUIT_UNIT/DISBAND_UNIT only ever charged a one-time cost — a standing
// army was free to hold once raised. UNIT_UPKEEP_GOLD_PER_TURN (actionCosts.js) makes fielding an
// army a real, continuous tradeoff instead.
describe('resolveTurn army maintenance', () => {
  const fakeUnit = (id) => ({
    id, ownerId: P, regionId: cap(P), domain: 'land', classId: 'infantry', ageId: 'bronze',
    strength: 1000, maxStrength: 1000, morale: 100, organization: 100, xp: 0, rank: 'recruit',
    promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
  });
  const withUnits = (count) => {
    const units = {};
    for (let i = 0; i < count; i++) units[`unit_${i}`] = fakeUnit(`unit_${i}`);
    return { ...withAllEventsFired(world()), units };
  };

  it('charges no upkeep, and logs none, with no units fielded', () => {
    const state = withUnits(0);
    const next = resolveTurn(state);
    expect(next.logs.some(l => l.message.includes('Upkeep'))).toBe(false);
  });

  // Plan §M11 extends this into a combined army/navy/fort/advisor/loan-interest ledger line
  // ("Upkeep: ...") — this test now checks the army component of that combined line.
  it('deducts UNIT_UPKEEP_GOLD_PER_TURN per player-owned unit, on top of ordinary income', () => {
    // Both scenarios are derived from the SAME base state (one createInitialState call, one seeded
    // ruler/traits), not two independent ones — M3's ruler generation draws real randomness during
    // createInitialState itself, so two separate calls can seed different ruler traits/skills and
    // make their income diverge for reasons that have nothing to do with unit upkeep. Equalizing
    // starting gold on top isolates the outcome to exactly the upkeep difference.
    const sharedBase = withAllEventsFired(world());
    const base = { ...sharedBase, resources: { ...sharedBase.resources, gold: 5000 } };
    const armyUnits = {};
    for (let i = 0; i < 3; i++) armyUnits[`unit_${i}`] = fakeUnit(`unit_${i}`);
    const withArmy = { ...base, units: { ...base.units, ...armyUnits } }; // on top of the starting army
    const nextBase = resolveTurn(base);
    const nextArmy = resolveTurn(withArmy);
    expect(nextBase.resources.gold - nextArmy.resources.gold).toBe(3 * UNIT_UPKEEP_GOLD_PER_TURN);
    const playerUnits = Object.values(withArmy.units).filter((u) => u.ownerId === P).length;
    expect(nextArmy.logs.some(l => l.message.includes(`army ${playerUnits * UNIT_UPKEEP_GOLD_PER_TURN}g`))).toBe(true);
  });

  it('never charges upkeep for another nation\'s units', () => {
    const state = withUnits(0);
    state.units.enemy_unit = { ...fakeUnit('enemy_unit'), ownerId: R1 };
    const next = resolveTurn(state);
    expect(next.logs.some(l => l.message.includes('Upkeep'))).toBe(false);
  });

  // Plan §M11: without Banking Houses, loan capacity is 0 (see economy.js's getLoanCapacity), so a
  // shortfall this large goes straight to bankruptcy rather than an auto-loan — either outcome
  // floors the treasury at 0, which is what this test actually pins.
  it('floors gold at zero (via bankruptcy, pre-Banking-Houses) rather than going negative from upkeep', () => {
    const state = { ...withUnits(1000), resources: { ...withUnits(1000).resources, gold: 0 } };
    const next = resolveTurn(state);
    expect(next.resources.gold).toBeGreaterThanOrEqual(0);
    expect(next.logs.some(l => l.message.includes('Bankruptcy'))).toBe(true);
  });
});

// Plan §M11: fort upkeep, auto-loans, and bankruptcy's real effects.
describe('resolveTurn economy (plan §M11)', () => {
  const withBankingHouses = (state) => ({
    ...state,
    techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } }
  });

  it('charges fort upkeep for a built Defense-tier region', () => {
    const base = withAllEventsFired(world());
    const buildings = { ...base.regions[cap(P)].buildings, categories: { ...base.regions[cap(P)].buildings.categories, defense: 1 } }; // Palisade: fortLevel 1
    const withFort = { ...base, regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], buildings } } };
    const nextBase = resolveTurn(base);
    const nextFort = resolveTurn(withFort);
    expect(nextBase.resources.gold - nextFort.resources.gold).toBe(1); // FORT_UPKEEP_GOLD_PER_FORT_LEVEL x fortLevel 1
  });

  it('auto-takes a loan on a shortfall once Banking Houses is researched, rather than going bankrupt', () => {
    const base = withBankingHouses(withAllEventsFired(world()));
    const hugeArmy = Array.from({ length: 200 }, (_, i) => [`u${i}`, { id: `u${i}`, ownerId: P, domain: 'land', regionId: cap(P) }])
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    const poor = { ...base, resources: { ...base.resources, gold: 0 }, units: hugeArmy };
    const next = resolveTurn(poor);
    expect(next.nations[P].loans.length).toBe(1);
    expect(next.resources.gold).toBeGreaterThanOrEqual(0);
    expect(next.logs.some(l => l.message.includes('auto-took a loan'))).toBe(true);
  });

  it('bankruptcy applies -3 stability, -20 prestige, clears loans, and pushes a 10-turn modifier', () => {
    const base = withAllEventsFired(world());
    const fr = {
      ...base.nations[P],
      stability: 0,
      prestige: 50,
      ruler: { ...base.nations[P].ruler, traits: [] },
      // A pre-existing loan is here to confirm it gets wiped by bankruptcy, not what CAUSES it —
      // the huge army's upkeep below is the actual shortfall (Banking Houses isn't researched, so
      // loan capacity is 0 regardless of this loan's own presence).
      loans: [{ id: 'l1', principal: 100, interestRate: 0.04, takenTurn: 0 }]
    };
    const hugeArmy = Array.from({ length: 1000 }, (_, i) => [`u${i}`, { id: `u${i}`, ownerId: P, domain: 'land', regionId: cap(P) }])
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    const state = { ...base, nations: { ...base.nations, [P]: fr }, resources: { ...base.resources, gold: 0 }, units: hugeArmy };
    const next = resolveTurn(state);
    expect(next.nations[P].stability).toBe(-3);
    // prestige decays 5% toward 0 in the national-power phase BEFORE bankruptcy's own -20 applies:
    // trunc(50 x 0.95) = 47, then 47 - 20 = 27.
    expect(next.nations[P].prestige).toBe(27);
    expect(next.nations[P].loans).toEqual([]);
    expect(next.nations[P].modifiers.some((m) => m.sourceType === 'bankruptcy' && m.expiresTurn === next.turnNumber + 10)).toBe(true);
  });
});

describe('resolveTurn unrest drift', () => {
  it('settles unrest toward 0 when every region is at full control', () => {
    // Fixed seed: a random ruler's traits could otherwise push unrest up on their own (a flake).
    const base = world(12345);
    const state = { ...base, nations: { ...base.nations, [P]: { ...base.nations[P], ruler: { ...base.nations[P].ruler, traits: [] } } }, regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], unrest: 10 } } };
    const next = resolveTurn(state);
    expect(next.regions[cap(P)].unrest).toBeLessThan(10);
  });

  it('raises unrest for a region under the control threshold', () => {
    // Fixed seed and a trait-free ruler at 0 stability: createInitialState otherwise rolls a random
    // ruler, and a stability-heavy trait roll could cancel the +3/turn rise on its own (a real flake).
    const state = world(12345);
    const fr = state.nations[P];
    const lowControl = {
      ...state,
      nations: { ...state.nations, [P]: { ...fr, stability: 0, ruler: { ...fr.ruler, traits: [] } } },
      regions: { ...state.regions, [cap(P)]: { ...state.regions[cap(P)], control: 10, unrest: 0 } }
    };
    const next = resolveTurn(lowControl);
    expect(next.regions[cap(P)].unrest).toBeGreaterThan(0);
  });
});

// Regression/feature: currentPopulation used to be completely static outside the manual, opt-in
// POPULATION_POLICY action — resolveTurn.js now grows it every turn via src/engine/population.js,
// driven by the (now-wired) Food & Growth building tier, infrastructure, and war.
describe('resolveTurn population growth', () => {
  it('grows a region with a built Food building faster than an unimproved one over several turns', () => {
    const base = world();
    const withFood = {
      ...base,
      regions: {
        ...base.regions,
        [cap(P)]: {
          ...base.regions[cap(P)],
          buildings: { ...base.regions[cap(P)].buildings, categories: { ...base.regions[cap(P)].buildings.categories, food: 0 } }
        }
      }
    };

    let plainState = base;
    let foodState = withFood;
    for (let i = 0; i < 10; i++) {
      plainState = resolveTurn(plainState);
      foodState = resolveTurn(foodState);
    }

    // People follow city size, which grows from the food bank (src/engine/world/cities.js).
    const progress = (s) => s.regions[cap(P)].size * 1000 + s.regions[cap(P)].food;
    expect(progress(foodState)).toBeGreaterThan(progress(plainState));
  });

  it('grows slower while a region is under active invasion', () => {
    const base = world();
    const invaded = { ...base, regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], underInvasion: true } } };
    const next = resolveTurn(invaded);
    const calm = resolveTurn(base);
    // An invaded city lives off its centre alone: its food bank fills slower (people follow size).
    expect(next.regions[cap(P)].food).toBeLessThan(calm.regions[cap(P)].food);
    expect(next.regions[cap(P)].currentPopulation).toBeLessThan(calm.regions[cap(P)].currentPopulation);
  });

  it('grows even an undeveloped, calm region a little just from the passage of time', () => {
    const base = world();
    const next = resolveTurn(base);
    // Growth is the food bank filling towards the next size (people follow size).
    expect(next.regions[cap(P)].food).toBeGreaterThan(base.regions[cap(P)].food);
  });
});

describe('resolveTurn rebellion', () => {
  const rebelUnitIn = (state) => Object.values(state.units).find(u => u.ownerId === REBEL_OWNER_ID);

  it('spawns a rebel army once unrest crosses the threshold', () => {
    const base = world();
    // A few points above the threshold: unrest drift (-1/turn at full control) shouldn't be
    // enough to pull it back under REBELLION_UNREST_THRESHOLD before the rebellion check reads it.
    const state = { ...base, regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], unrest: REBELLION_UNREST_THRESHOLD + 5 } } };
    const next = resolveTurn(state);
    const rebel = rebelUnitIn(next);
    expect(rebel).toBeDefined();
    expect(rebel.regionId).toBe(cap(P));
    expect(rebel.domain).toBe('land');
    expect(next.regions[cap(P)].control).toBeLessThan(state.regions[cap(P)].control);
  });

  // M3's seeded ruler traits (src/data/traits.js) feed the SAME national.stabilityBonus hook a
  // government/policy/wonder does, which directly shaves unrest drift (nextUnrest) every turn —
  // a France ruler who happens to roll Just (+2) or Kind (+3) can, over 2 turns, pull unrest below
  // REBELLION_UNREST_THRESHOLD despite the "+5" margin these tests were written with (pre-M3) to
  // rule out. Zeroing traits here isolates the rebellion-growth invariant these tests are actually
  // about from that unrelated (and correctly working) M3 randomness.
  const noRulerTraits = (state) => ({
    ...state,
    nations: { ...state.nations, [P]: { ...state.nations[P], ruler: { ...state.nations[P].ruler, traits: [] } } }
  });

  it('does not spawn a second rebel army in a region that already has one', () => {
    const base = noRulerTraits(withAllEventsFired(world()));
    const state = { ...base, regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], unrest: REBELLION_UNREST_THRESHOLD + 5 } } };
    const withRebel = resolveTurn(state);
    const again = resolveTurn(withRebel);
    const rebelCount = Object.values(again.units).filter(u => u.ownerId === REBEL_OWNER_ID && u.regionId === cap(P)).length;
    expect(rebelCount).toBe(1);
  });

  it('grows an existing rebel army while unrest stays at or above the threshold', () => {
    const base = noRulerTraits(withAllEventsFired(world()));
    const state = { ...base, regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], unrest: REBELLION_UNREST_THRESHOLD + 5 } } };
    const withRebel = resolveTurn(state);
    const before = rebelUnitIn(withRebel).strength;
    const again = resolveTurn(withRebel);
    const after = rebelUnitIn(again)?.strength;
    expect(after).toBeGreaterThan(before);
  });

  it('dissolves the rebellion once unrest drops back below the threshold', () => {
    const base = world();
    const rebelUnit = {
      id: 'rebel_fr_1', regionId: cap(P), ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 500, maxStrength: 500, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
    };
    const state = {
      ...base,
      units: { rebel_fr_1: rebelUnit },
      regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], unrest: 0 } }
    };
    const next = resolveTurn(state);
    expect(next.units.rebel_fr_1).toBeUndefined();
  });
});

describe('resolveTurn revolt end conditions (conquered territory)', () => {
  const rebelUnitAt = (regionId, spawnedTurn) => ({
    id: `rebel_${regionId}_1`, regionId, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: 'bronze',
    strength: 500, maxStrength: 500, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
    spawnedTurn
  });

  it('reverts a conquered region to its former owner once the revolt runs unresolved for REVOLT_SUCCESS_TURNS', () => {
    const base = withAllEventsFired(world());
    const rebel = rebelUnitAt(cap(R1), 1);
    const garrison = {
      id: 'garrison_1', regionId: cap(R1), ownerId: P, domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 200, maxStrength: 200, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
    };
    const state = {
      ...base,
      turnNumber: 1 + REVOLT_SUCCESS_TURNS,
      units: { [rebel.id]: rebel, [garrison.id]: garrison },
      regions: { ...base.regions, [cap(R1)]: { ...base.regions[cap(R1)], owner: P, formerOwner: R1, unrest: REBELLION_UNREST_THRESHOLD + 5, control: 20 } }
    };
    const next = resolveTurn(state);
    expect(next.regions[cap(R1)].owner).toBe(R1);
    expect(next.regions[cap(R1)].formerOwner).toBeUndefined();
    expect(next.units[rebel.id]).toBeUndefined();
    // The occupier's garrison is overrun along with the rebellion's victory, same as a lost battle.
    expect(next.units[garrison.id]).toBeUndefined();
  });

  it('keeps growing the rebel army in conquered land that has not yet run REVOLT_SUCCESS_TURNS', () => {
    const base = withAllEventsFired(world());
    const rebel = rebelUnitAt(cap(R1), 1);
    const state = {
      ...base,
      turnNumber: 1, // only one turn old — far short of REVOLT_SUCCESS_TURNS
      units: { [rebel.id]: rebel },
      regions: { ...base.regions, [cap(R1)]: { ...base.regions[cap(R1)], owner: P, formerOwner: R1, unrest: REBELLION_UNREST_THRESHOLD + 5, control: 20 } }
    };
    const next = resolveTurn(state);
    expect(next.regions[cap(R1)].owner).toBe(P); // still held
    expect(next.regions[cap(R1)].formerOwner).toBe(R1); // still at risk
    expect(next.units[rebel.id].strength).toBeGreaterThan(rebel.strength); // grew instead of succeeding
  });

  it('never reverts ownership for a home-territory rebellion, which has no formerOwner to revert to', () => {
    const base = withAllEventsFired(world());
    const rebel = rebelUnitAt(cap(P), 1);
    const state = {
      ...base,
      turnNumber: 1 + REVOLT_SUCCESS_TURNS + 5, // well past the revolt-success window
      units: { [rebel.id]: rebel },
      regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], unrest: REBELLION_UNREST_THRESHOLD + 5 } }
    };
    const next = resolveTurn(state);
    expect(next.regions[cap(P)].owner).toBe(P);
    expect(Object.values(next.units).some(u => u.ownerId === REBEL_OWNER_ID && u.regionId === cap(P))).toBe(true);
  });

  it('integrates a conquered region once control reaches INTEGRATION_CONTROL_THRESHOLD without a live rebellion', () => {
    const base = world();
    const state = {
      ...base,
      regions: { ...base.regions, [cap(R1)]: { ...base.regions[cap(R1)], owner: P, formerOwner: R1, unrest: 10, control: INTEGRATION_CONTROL_THRESHOLD } }
    };
    const next = resolveTurn(state);
    expect(next.regions[cap(R1)].formerOwner).toBeUndefined();
    expect(next.regions[cap(R1)].owner).toBe(P); // integration only clears the revolt-risk flag, ownership is unchanged
  });

  it('keeps formerOwner set on conquered land that is neither revolting nor yet fully integrated', () => {
    const base = world();
    const state = {
      ...base,
      regions: { ...base.regions, [cap(R1)]: { ...base.regions[cap(R1)], owner: P, formerOwner: R1, unrest: 10, control: 30 } }
    };
    const next = resolveTurn(state);
    expect(next.regions[cap(R1)].formerOwner).toBe(R1);
  });
});

describe('resolveTurn supply meter (plans/civ-map-rework.md D3)', () => {
  const unitAt = (id, regionId, extra = {}) => ({
    id, regionId, ownerId: P, domain: 'land', classId: 'infantry',
    strength: 1000, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null, ...extra
  });
  const atWar = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-sup', aggressor: P, enemy, active: true, startYear: s.year }] });

  it('drains the meter of a unit deep in enemy land and starves it at zero', () => {
    const base = atWar(world(1), R2);
    const state = { ...base, units: { u_far: unitAt('u_far', cap(R2)) } };
    const next = resolveTurn(state);
    expect(next.units.u_far.supply).toBe(SUPPLY_MAX - SUPPLY_ENEMY_LOSS);
    expect(next.units.u_far.strength).toBe(1000);
    const starved = resolveTurn({ ...state, units: { u_far: unitAt('u_far', cap(R2), { supply: 5 }) } });
    expect(starved.units.u_far.supply).toBe(0);
    expect(starved.units.u_far.strength).toBe(Math.floor(1000 * (1 - STARVE_STRENGTH)));
    expect(starved.units.u_far.morale).toBeLessThan(100);
  });

  it('keeps a unit at home full, and refills one that comes home', () => {
    const base = world(1);
    const next = resolveTurn({ ...base, units: { u_home: unitAt('u_home', cap(P), { supply: 50 }) } });
    expect(next.units.u_home.supply).toBe(50 + SUPPLY_HOME_GAIN);
    expect(next.units.u_home.strength).toBe(1000);
  });

  it('does not touch embarked cargo (it shares its transport\'s supply)', () => {
    const base = world(1);
    const next = resolveTurn({ ...base, units: { u_cargo: unitAt('u_cargo', cap(R2), { embarkedOn: 'u_ship', supply: 5 }) } });
    expect(next.units.u_cargo.strength).toBe(1000);
    expect(next.units.u_cargo.supply).toBe(5);
  });

  it('removes a starving unit whose strength is gone', () => {
    const base = atWar(world(1), R2);
    const next = resolveTurn({ ...base, units: { u_weak: unitAt('u_weak', cap(R2), { strength: 1, supply: 0 }) } });
    expect(next.units.u_weak).toBeUndefined();
  });

  it('a Forager loses less, and Paved Roads (national.attrition) slow the drain for the player only', () => {
    const base = atWar(world(1), R2);
    const forager = resolveTurn({ ...base, units: { u: unitAt('u', cap(R2), { promotions: ['forager'] }) } });
    expect(forager.units.u.supply).toBe(SUPPLY_MAX - SUPPLY_ENEMY_LOSS / 2);
    const withTech = { ...base, techTree: { ...base.techTree, infrastructure_paved_roads: { ...base.techTree.infrastructure_paved_roads, researched: true } } };
    const plain = resolveTurn({ ...base, units: { u: unitAt('u', cap(R2)) } });
    const paved = resolveTurn({ ...withTech, units: { u: unitAt('u', cap(R2)) } });
    expect(paved.units.u.supply).toBeGreaterThan(plain.units.u.supply);
    // Germany's unit on Australian soil, at war, drains at the full rate whatever France researched.
    const german = { ...withTech, wars: [...withTech.wars, { id: 'w-de', aggressor: R1, enemy: R5, active: true, startYear: base.year }], units: { u_ai: unitAt('u_ai', cap(R5), { ownerId: R1 }) } };
    expect(resolveTurn(german).units.u_ai.supply).toBe(SUPPLY_MAX - SUPPLY_ENEMY_LOSS);
  });
});

describe('resolveTurn movement reset, reinforcement, and morale recovery (plan §M14)', () => {
  const makeUnit = (overrides = {}) => ({
    id: 'u1', regionId: cap(P), ownerId: P, domain: 'land', classId: 'infantry',
    strength: 500, maxStrength: 1000, morale: 50, movesLeft: 0,
    xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
    ...overrides
  });

  it('resets a fully-spent unit\'s move at the start of its next turn', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ movesLeft: 0 }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.movesLeft).toBe(1);
  });

  it('grants a second move to a unit with the forcedMarch perk', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ movesLeft: 0, promotions: ['forcedMarch'] }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.movesLeft).toBe(2);
  });

  it('recovers morale for a unit that did not fight this turn', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ morale: 50 }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.morale).toBeGreaterThan(50);
  });

  it('does not recover morale for a unit that fought THIS turn', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ morale: 50, lastBattleTurn: base.turnNumber }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.morale).toBe(50);
  });

  it('never recovers morale past 100', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ morale: 95 }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.morale).toBeLessThanOrEqual(100);
  });

  it('reinforces a below-strength unit in its owner\'s own, unoccupied territory', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ strength: 500 }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.strength).toBeGreaterThan(500);
  });

  it('costs the player manpower for the strength it reinforces', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ strength: 500 }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.strength).toBeGreaterThan(500);
    // Same turn's income applies to both runs identically, so any DIFFERENCE in resulting hr is
    // exactly the manpower this unit's own reinforcement consumed.
    const fullyHealed = { ...base, units: { u1: makeUnit({ strength: 1000 }) } };
    const nextHealed = resolveTurn(fullyHealed);
    expect(next.resources.hr).toBeLessThan(nextHealed.resources.hr);
  });

  it('does not reinforce a unit in a region occupied by someone else', () => {
    const base = world();
    const state = {
      ...base,
      units: { u1: makeUnit({ strength: 500 }) },
      regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], occupiedBy: R1 } }
    };
    const next = resolveTurn(state);
    // No reinforcement (attrition may still bite: an occupied capital is out of supply).
    expect(next.units.u1.strength).toBeLessThanOrEqual(500);
  });

  it('does not reinforce a unit outside its owner\'s own territory', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ strength: 500, regionId: cap(R1) }) } };
    const next = resolveTurn(state);
    // Out of supply AND out of home territory: no reinforcement, only attrition (a strict decrease).
    expect(next.units.u1.strength).toBeLessThanOrEqual(500);
  });

  it('never reinforces past maxStrength', () => {
    const base = world();
    const state = { ...base, units: { u1: makeUnit({ strength: 990 }) } };
    const next = resolveTurn(state);
    expect(next.units.u1.strength).toBeLessThanOrEqual(1000);
  });

  it('the Cadre perk doubles the reinforcement gain', () => {
    const base = world();
    const plain = { ...base, units: { u1: makeUnit({ strength: 500 }) } };
    const withCadre = { ...base, units: { u1: makeUnit({ strength: 500, promotions: ['cadre'] }) } };
    const plainGain = resolveTurn(plain).units.u1.strength - 500;
    const cadreGain = resolveTurn(withCadre).units.u1.strength - 500;
    expect(cadreGain).toBeGreaterThan(plainGain);
  });

  it('reinforces an AI-owned unit\'s strength without touching the player\'s manpower', () => {
    const base = cloneWorld(world());
    base.nations[R1] = {...base.nations[R1],economy:{...base.nations[R1].economy,hr:1000}};
    const aiUnit = { ...makeUnit({ strength: 500, ownerId: R1, regionId: cap(R1) }), id: 'u_ai' };
    const state = { ...base, units: { u_ai: aiUnit } };
    const next = resolveTurn(state);
    expect(next.units.u_ai.strength).toBeGreaterThan(500);
  });

  it('the Forager perk halves the supply drain abroad', () => {
    const base = world();
    const war = { ...base, wars: [...base.wars, { id: 'w-f', aggressor: P, enemy: R2, active: true, startYear: base.year }] };
    const plain = { ...war, units: { u1: makeUnit({ strength: 1000, regionId: cap(R2) }) } };
    const withForager = { ...war, units: { u1: makeUnit({ strength: 1000, regionId: cap(R2), promotions: ['forager'] }) } };
    expect(resolveTurn(withForager).units.u1.supply).toBeGreaterThan(resolveTurn(plain).units.u1.supply);
  });

  it('a logistician-commanded unit also loses half its supply', () => {
    const base = world();
    const war = { ...base, wars: [...base.wars, { id: 'w-l', aggressor: P, enemy: R2, active: true, startYear: base.year }] };
    const plain = { ...war, units: { u1: makeUnit({ strength: 1000, regionId: cap(R2) }) } };
    const withLogistician = {
      ...war,
      units: { u1: makeUnit({ strength: 1000, regionId: cap(R2), commanderId: 'g1' }) },
      hiredCommanders: { g1: { id: 'g1', nationId: P, name: 'Test', martial: 3, shock: 3, fire: 3, maneuver: 3, personality: 'logistician', assignedUnitId: 'u1' } }
    };
    expect(resolveTurn(withLogistician).units.u1.supply).toBeGreaterThan(resolveTurn(plain).units.u1.supply);
  });
});

describe('resolveTurn war exhaustion', () => {
  it('rises for a nation at war', () => {
    const base = world();
    const state = { ...base, nations: { ...base.nations, [R1]: { ...base.nations[R1], isAtWar: true } } };
    const next = resolveTurn(state);
    expect(next.nations[R1].warExhaustion).toBeGreaterThan(0);
  });

  it('decays for a nation at peace', () => {
    const base = world();
    const state = { ...base, nations: { ...base.nations, [R1]: { ...base.nations[R1], warExhaustion: 50 } } };
    const next = resolveTurn(state);
    expect(next.nations[R1].warExhaustion).toBeLessThan(50);
  });

  it('applies to the player too, not just AI nations', () => {
    const base = world();
    const state = { ...base, nations: { ...base.nations, [P]: { ...base.nations[P], isAtWar: true } } };
    const next = resolveTurn(state);
    expect(next.nations[P].warExhaustion).toBeGreaterThan(0);
  });

  it('never drops below 0 or exceeds 100', () => {
    const base = world();
    const atZero = { ...base, nations: { ...base.nations, [R1]: { ...base.nations[R1], warExhaustion: 0 } } };
    expect(resolveTurn(atZero).nations[R1].warExhaustion).toBe(0);
    const atMax = { ...base, nations: { ...base.nations, [R1]: { ...base.nations[R1], warExhaustion: 100, isAtWar: true } } };
    expect(resolveTurn(atMax).nations[R1].warExhaustion).toBe(100);
  });
});

describe('resolveTurn AI nations', () => {
  it('grows non-player nations\' military strength over many turns without crashing', () => {
    let state = world();
    for (let i = 0; i < 20; i++) {
      state = resolveTurn(state);
    }
    Object.values(state.nations).forEach(n => {
      if (n.isPlayer) return;
      expect(n.militaryStrength).toBeGreaterThanOrEqual(100);
      expect(Number.isFinite(n.militaryStrength)).toBe(true);
    });
  });

  it('never touches the player nation\'s own stats via the AI pass', () => {
    // A fixed rngSeed, not an unseeded one: an unseeded run has a small (~0.75%) chance an AI
    // nation rolls a war declaration against the player on turn 1, and resolveWarProgress's
    // per-turn attrition (diplomacy.js) legitimately reduces BOTH sides' militaryStrength once a
    // war exists — a real, intended feature, not a bug this test should be catching. Seed 1 is
    // verified not to trigger any turn-1 war, isolating this test to its actual point: that the AI
    // pass itself (growth/hostility/recruitment) never reaches into the player's own stats.
    const state = world(1);
    const next = resolveTurn(state);
    expect(next.nations[P].militaryStrength).toBe(state.nations[P].militaryStrength);
  });
});

describe('resolveTurn AI war declarations', () => {
  it('carries an existing war forward across a turn (wars is part of the resolved state)', () => {
    // This test is about wars[] surviving the turn, not about AI war-declaration odds. AI nations
    // may now fight up to MAX_AI_WARS wars at once, so other nations can still declare their own
    // wars this turn: the assertion looks at this war only. A fixed seed keeps the run
    // reproducible (a fresh game otherwise gets a random seed).
    const base = world(12345);
    // Plan §M13: score bookkeeping (battleScore/tickScore/score) runs for every active war every
    // turn, including one the player started — pre-seeded at their post-bookkeeping values (all 0,
    // since nothing here moves them) so this stays an exact-shape assertion of "wars[] survives".
    const existingWar = {
      id: 'war_de_-2000', enemy: R1, startYear: base.year, startTurn: base.turnNumber, active: true, aggressor: P,
      goal: { type: 'destroy_military', threshold: 1 }, goalAchieved: false, cb: 'none',
      battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0
    };
    const state = { ...base, wars: [existingWar] };
    const next = resolveTurn(state);
    expect(next.wars[0]).toEqual(existingWar);
    expect(resolveTurn(state).wars).toEqual(next.wars); // same state in, same wars out
  });

  it('an aggressive, hostile Tier 1 neighbor eventually declares war on its own, wired end-to-end through resolveTurn', () => {
    // R1 borders the player (P), which makes it Tier 1 every turn regardless of ranking.
    // zealot + hostility 100 gives it the highest available per-turn roll chance; run enough
    // turns that failing to ever roll it is astronomically unlikely (this is an integration test
    // of the real wiring, not a probability estimate — aiLogic.test.js covers the exact odds).
    // Waits for a war DE itself declared: with multi-front wars another nation may declare on DE
    // first, which makes it isAtWar without it having declared anything. Fixed seed: reproducible.
    // R1 starts in the Bronze Age: the AI declares when a war is worth it (war value, not the roll), and since
    // U47 slowed Stone research a Stone R1 does not reach a worthwhile war within 300 turns.
    const base = withAgesResearched(world(2024), R1, 'bronze');
    let state = withAllEventsFired({
      ...base,
      // The floor keeps hostility at 100 (it would otherwise decay a point a turn and take the
      // roll chance with it), so the premise above holds for the whole run.
      nations: { ...base.nations, [R1]: { ...base.nations[R1], doctrine: 'zealot', hostility: 100, hostilityFloor: 100 } }
    });
    let warDeclared = false;
    for (let i = 0; i < 300 && !warDeclared; i++) {
      state = resolveTurn(state);
      if (state.wars.some(w => w.aggressor === R1)) warDeclared = true;
    }
    expect(warDeclared).toBe(true);
    expect(state.nations[R1].isAtWar).toBe(true);
  }, 60000); // up to 300 whole-world turns: slow under full-suite load
});

describe('resolveTurn AI war progress (Task 32: territorial conquest, wired end-to-end)', () => {
  // A very large difficultyMultiplier pushes resolveWarProgress's capture-chance roll (see
  // diplomacy.js) effectively to certainty on the very first turn, regardless of the turn's own
  // rngSeed — this is an integration test of the real resolveTurn wiring (Object.assign onto the
  // in-progress regions object, reassigning nationsAfterWars/wars for the rest of the turn to see),
  // not a probability estimate; diplomacy.test.js already covers the exact odds with a mocked rng.
  // A fixed seed: with a random one a third nation sometimes declares war on the defender this
  // turn and its garrison marches out, leaving the capital empty (a flaky "captured" result).
  const withCertainCapture = (aggressor, enemy, regionId) => {
    const base = withAllEventsFired(world(7));
    const war = { id: 'war_1', aggressor, enemy, active: true, goalAchieved: false, startYear: base.year, goal: { type: 'capture_region', regionId } };
    // Plan §M13: capturing sets occupiedBy, and war score/peace bookkeeping now runs every turn —
    // occupying just one region (here, always the capital, tripled by getOccupationScore's own
    // capital weight) can by itself cross the AI-vs-AI peace threshold on real geography and
    // conclude the war via a negotiated cede this same turn. Inflating the enemy's OTHER regions'
    // dev keeps these tests scoped to "does the capture-and-occupy mechanic itself work", leaving
    // the peace threshold's own behavior to diplomacy.test.js's dedicated peace-machinery tests.
    const regions = { ...base.regions };
    Object.keys(regions).forEach((id) => {
      if (regions[id].owner === enemy && id !== regionId) regions[id] = { ...regions[id], dev: { tax: 1000, production: 1000, manpower: 1000 } };
    });
    return {
      ...base,
      regions,
      difficultyMultiplier: 1000,
      wars: [war],
      // Overwhelming strength: the assault the capture roll raises (defense.js) is sized by the
      // strength share, so the garrison cannot hold (AI armies no longer strike across the registry's
      // city bridge; they march on tiles, workstream 9).
      nations: { ...base.nations, [aggressor]: { ...base.nations[aggressor], economy: undefined, isAtWar: true, militaryStrength: 50000 }, [enemy]: { ...base.nations[enemy], isAtWar: true } }
    };
  };

  it('lets one AI nation actually conquer territory from another', () => {
    const state = withCertainCapture(R4, R3, cap(R3));
    // Legacy saves without an economy retain their historical abstract capture policy.
    // Same-turn recruits now defend. Keep this conquest fixture below one siege hit
    // so its result does not depend on whether Canada rolls a recruit this turn.
    state.regions = { ...state.regions, [cap(R3)]: { ...state.regions[cap(R3)], control: 20 } };
    const next = resolveTurn(state);
    expect(next.regions[cap(R3)].owner).toBe(R4); // conquered in battle
    expect(next.regions[cap(R3)].conquest?.from).toBe(R3);
    expect(next.regions[cap(R3)].formerOwner).toBe(R3); // remembered, so it can revolt back
  });

  it('grinds a defended region\'s control instead of instantly capturing it in one turn (src/engine/siege.js)', () => {
    const state = withCertainCapture(R4, R3, cap(R3));
    const defenderUnit = {
      id: 'ca_garrison', regionId: cap(R3), ownerId: R3, domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 1000, maxStrength: 1000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
    };
    // Isolate legacy siege damage from newly declared third-party fronts.
    state.nations = Object.fromEntries(Object.entries(state.nations).map(([id,n])=>[id,{...n,doctrine:'isolationist',hostility:0}]));
    const withDefender = { ...state, units: { ...state.units, ca_garrison: defenderUnit } };
    const next = resolveTurn(withDefender);
    expect(next.regions[cap(R3)].owner).toBe(R3); // not captured yet
    expect(next.regions[cap(R3)].control).toBe(70); // 100 - 30
    expect(next.wars.find(w => w.id === 'war_1').active).toBe(true); // war goal not yet achieved
  });

  it('lets an AI nation conquer territory from the PLAYER — every nation must be conquerable by anyone', () => {
    const state = withCertainCapture(R1, P, cap(P));
    // A thin garrison: the assault is a real battle, and a full one can win it on some dice (it
    // did once the court's name rolls moved the seed). This test is about the wiring, not the odds.
    state.units = Object.fromEntries(Object.entries(state.units).map(([id, u]) => [id, u.ownerId === P ? { ...u, strength: 100 } : u]));
    // On Auto a garrison is fought first and the city is not taken in that battle (the 14 October
    // rule, cityAssault.js); the beaten garrison is driven out.
    const next = resolveTurn(state);
    expect(next.regions[cap(P)].owner).toBe(P);
    expect(Object.values(next.units).some((u) => u.ownerId === P && u.regionId === cap(P) && u.domain === 'land')).toBe(false);
    // Empty and its defences broken, the city falls to the next attack.
    const empty = { ...state, units: Object.fromEntries(Object.entries(state.units).filter(([, u]) => u.ownerId !== P)), regions: { ...state.regions, [cap(P)]: { ...state.regions[cap(P)], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } } } };
    const taken = resolveTurn(empty);
    expect(taken.regions[cap(P)].owner).toBe(R1);
    expect(taken.regions[cap(P)].conquest?.from).toBe(P);
  });

  it('leaves a war the player started to be resolved by the player\'s own invasion actions, not synthetically', () => {
    const state = withCertainCapture(P, R1, cap(R1));
    const next = resolveTurn(state);
    // Untouched by resolveWarProgress (the certain-capture multiplier also lets any AI war that
    // started this turn capture at once, so only the player's own hand is ruled out here).
    expect(next.regions[cap(R1)].owner).not.toBe(P);
    expect(next.wars.find(w => w.id === 'war_1').active).toBe(true);
  });
});

describe('resolveTurn victory', () => {
  // Plan §M18: reaching the turn limit is no longer an automatic win — it's a RANKED ending
  // by legacy (src/engine/score.js; the win itself: legacy.test.js): VICTORY only if the player
  // leads the world, GameStatus.COMPLETE (with finalRank) otherwise.
  it('ends as GameStatus.COMPLETE with a real finalRank when the player does NOT rank #1 at the turn limit', () => {
    const base = withAllEventsFired({ ...world(), turnNumber: speedTurnLimit('normal') - 1 });
    const regions = {};
    Object.keys(base.regions).forEach((id) => { regions[id] = { ...base.regions[id], owner: id === cap(P) ? P : R1 }; });
    const next = resolveTurn({ ...base, regions });
    expect(next.gameStatus).toBe(GameStatus.COMPLETE);
    expect(next.finalRank).toBeGreaterThan(1);
  });

  it('does not check victory conditions while an event is pending', () => {
    const state = { ...world(), turnNumber: speedTurnLimit('normal') - 1, activeEventId: 'some_event' };
    // resolveTurn is a no-op while an event is pending (existing guard) — this just confirms
    // that guard still holds even when a victory condition would otherwise already be met.
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn event chains', () => {
  it('does not fire a chain event before its dueTurn', () => {
    const state = withAllEventsFired({ ...world(), turnNumber: 5, pendingEventChains: [{ id: 'not_registered', dueTurn: 10 }] });
    const next = resolveTurn(state);
    expect(next.activeEventId).toBeNull();
    expect(next.pendingEventChains).toEqual([{ id: 'not_registered', dueTurn: 10 }]);
  });

  it('ignores a pending entry whose id has no matching registry entry, rather than throwing', () => {
    const state = { ...world(), turnNumber: 5, pendingEventChains: [{ id: 'not_a_real_chain', dueTurn: 6 }] };
    expect(() => resolveTurn(state)).not.toThrow();
  });

  it('fires a real, multi-step chain end-to-end: schedules, fires at dueTurn, and resolving it schedules the next step', () => {
    const base = withAllEventsFired({ ...world(), turnNumber: 5, pendingEventChains: [{ id: 'colonial_venture_1', dueTurn: 6 }] });
    const next = resolveTurn(base);
    expect(next.activeEventId).toBe('colonial_venture_1');
    expect(next.pendingEventChains).toEqual([]);

    const event = cardOf(next.activeEventId);
    expect(event.title).toBe('A Venture Beyond the Horizon');

    const resolved = applyEventEffects(next, event, 0); // "Fund it generously" -> schedules colonial_venture_2
    expect(resolved.pendingEventChains).toEqual([{ id: 'colonial_venture_2', dueTurn: resolved.turnNumber + speedTurns(8, resolved.gameSpeed, ageOf(resolved, P)) }]);
    expect(resolved.activeEventId).toBeNull();
  });
});

describe('resolveTurn curated national events', () => {
  it('fires a curated national event for a people of the land it names, once the player has its age and progress', () => {
    // A copy of the Nile flood event keyed to the player's own land (peoples.js countryOfNation).
    // It is chronologically the earliest of ALL real events, so clearing firedEvents entirely can't
    // let another one preempt it.
    const ev = storyCard({ ...HISTORICAL_EVENTS.national_egypt_nile_flood, id: 'national_test_flood', land: countryOfNation(P) });
    CARDS[ev.id] = ev;
    try {
      const held = getTechsForAge(ev.ageId).slice(0, eventTechsNeeded(ev.ageId, ev.year));
      const base = withAllEventsFired(world());
      const state = { ...base, techAgeId: ev.ageId, techTree: { ...base.techTree, ...Object.fromEntries(held.map((t) => [t.id, { ...base.techTree?.[t.id], researched: true }])) }, firedEvents: {} };
      const next = resolveTurn(state);
      expect(next.activeEventId).toBe(ev.id);
    } finally { delete CARDS[ev.id]; }
  });

  it('never fires a curated national event for a different nation', () => {
    const state = { ...withAllEventsFired(world()), firedEvents: {} };
    const next = resolveTurn(state);
    expect(next.activeEventId).not.toBe('national_egypt_nile_flood');
  });

  it('declaring war through a curated event\'s warWith effect marks both sides isAtWar (Task 23\'s aggressor fix)', () => {
    const event = { id: 'test_war_event', title: 'T', description: 'T', options: [{ label: 'Declare war', effects: { warWith: [R1] } }] };
    const resolved = applyEventEffects(world(), event, 0);
    expect(resolved.nations[R1].isAtWar).toBe(true);
    expect(resolved.nations[P].isAtWar).toBe(true);
  });
});

describe('resolveTurn new victory conditions wired end-to-end', () => {

  it('triggers Domination once the player holds enough of the world\'s regions', () => {
    const base = world();
    const regions = { ...base.regions };
    const ids = Object.keys(regions);
    ids.slice(0, Math.ceil(ids.length * 0.41)).forEach(id => { regions[id] = { ...regions[id], owner: P }; });
    const state = withAllEventsFired({ ...base, regions });
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('domination');
  });
});

describe('resolveTurn nation elimination (src/engine/elimination.js)', () => {
  // Hands every region a nation currently owns to `newOwnerId` — simulating "this nation has just
  // been reduced to zero regions" without needing to also drive real combat RNG through this test,
  // matching this file's existing convention of crafting scenarios directly via state overrides
  // (e.g. the AI war declarations describe block above just seeds state.wars by hand). control: 25
  // matches what a real LAUNCH_INVASION capture always leaves a region at (gameReducer.js) — well
  // under INTEGRATION_CONTROL_THRESHOLD, so the rebellion/integration pass earlier in this same
  // resolveTurn call doesn't clear formerOwner again before the elimination sweep gets to read it.
  const strip = (state, nationId, newOwnerId) => {
    const regions = { ...state.regions };
    Object.entries(regions).forEach(([id, r]) => {
      if (r.owner === nationId) regions[id] = { ...r, owner: newOwnerId, formerOwner: nationId, control: 25 };
    });
    return { ...state, regions };
  };

  it('marks a nation eliminated once it holds zero regions and closes out its wars', () => {
    const base = withAllEventsFired(world());
    const withWar = { ...base, wars: [{ id: 'w1', aggressor: R1, enemy: R2, active: true, goalAchieved: false, startYear: base.year, goal: { type: 'destroy_military', threshold: 1 } }] };
    // Some other AI nation (R2) absorbed Germany's last region — not the player.
    const state = strip(withWar, R1, R2);
    const next = resolveTurn(state);
    expect(next.nations[R1].isEliminated).toBe(true);
    expect(next.nations[R1].isAtWar).toBe(false);
    // Not `toEqual([])`: M3's per-nation ruler generation at game creation consumes extra RNG
    // draws, which can shift an unrelated AI nation into declaring its own war during this same
    // turn's AI phase. This test only cares that Germany's own war closed out on elimination.
    expect(next.wars.some((w) => w.aggressor === R1 || w.enemy === R1)).toBe(false);
    expect(next.playerEliminatedNationId).toBeNull();
    expect(next.logs.some(l => l.type === LogTypes.MILESTONE && l.message.includes(W0.nations[R1].name) && l.message.includes('eliminated'))).toBe(true);
  });

  it('rewards the player and fires the popup signal when THEY are the one who eliminated a nation', () => {
    const base = withAllEventsFired(world());
    const state = strip(base, R1, P);
    const goldBefore = state.resources.gold;
    const next = resolveTurn(state);
    expect(next.nations[R1].isEliminated).toBe(true);
    expect(next.playerEliminatedNationId).toBe(R1);
    expect(next.resources.gold - goldBefore).toBeGreaterThanOrEqual(NATION_ELIMINATION_REWARD.gold);
  });

  it('never eliminates the player nation itself, however few regions remain', () => {
    const base = withAllEventsFired(world());
    const state = strip(base, P, R1);
    const next = resolveTurn(state);
    expect(next.nations[P].isEliminated).toBeUndefined();
  });

  it('sets GameStatus.DEFEAT once the PLAYER is reduced to zero regions (plan §M15)', () => {
    const base = withAllEventsFired(world());
    const state = strip(base, P, R1);
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.DEFEAT);
    expect(next.logs.some((l) => l.type === LogTypes.MILESTONE && l.message.includes('DEFEAT'))).toBe(true);
  });

  it('does not set DEFEAT while the player still owns at least one region', () => {
    const base = withAllEventsFired(world());
    const next = resolveTurn(base);
    expect(next.gameStatus).toBe(GameStatus.ACTIVE);
  });
});

describe('resolveTurn capitals (plan §M15)', () => {
  it('applies a one-time -1 stability the turn the capital first becomes occupied', () => {
    const base = withAllEventsFired(world());
    const state = {
      ...base,
      regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], occupiedBy: R1 } },
      nations: { ...base.nations, [P]: { ...base.nations[P], stability: 0 } }
    };
    const next = resolveTurn(state);
    expect(next.nations[P].capitalOccupied).toBe(true);
    expect(next.nations[P].stability).toBe(-1);
  });

  it('does not repeat the stability penalty on a later turn the capital is STILL occupied', () => {
    const base = withAllEventsFired(world());
    const state = {
      ...base,
      regions: { ...base.regions, [cap(P)]: { ...base.regions[cap(P)], occupiedBy: R1 } },
      nations: { ...base.nations, [P]: { ...base.nations[P], stability: -1, capitalOccupied: true } }
    };
    const next = resolveTurn(state);
    expect(next.nations[P].stability).toBe(-1); // unchanged: the penalty does not recur
  });

  it('clears the occupied flag and stops the penalty once the capital is liberated', () => {
    const base = withAllEventsFired(world());
    const state = { ...base, nations: { ...base.nations, [P]: { ...base.nations[P], capitalOccupied: true } } };
    const next = resolveTurn(state); // capital is NOT occupied in state.regions here
    expect(next.nations[P].capitalOccupied).toBe(false);
  });
});

describe('resolveTurn civil war trigger (plan §M15)', () => {
  it('descends into civil war after the streak of turns at the stability floor (five, plans/playtest-1.md P4)', () => {
    let state = withAllEventsFired(world());
    state = { ...state, nations: { ...state.nations, [P]: { ...state.nations[P], stability: -3 } } };
    for (let i = 0; i < CIVIL_WAR_STABILITY_STREAK_TURNS - 1; i++) {
      state = resolveTurn(state);
      expect(state.nations[P].civilWar).toBeNull();
      state = { ...state, nations: { ...state.nations, [P]: { ...state.nations[P], stability: -3 } } };
    }
    const next = resolveTurn(state);
    expect(next.nations[P].civilWar?.active).toBe(true);
    expect(Object.values(next.units).some((u) => u.isInsurgent)).toBe(true);
    expect(next.logs.some((l) => l.type === LogTypes.CRISIS && l.message.toLowerCase().includes('civil war'))).toBe(true);
  });

  it('the streak resets once stability recovers above the floor', () => {
    let state = withAllEventsFired(world());
    state = { ...state, nations: { ...state.nations, [P]: { ...state.nations[P], stability: -3 } } };
    state = resolveTurn(state);
    state = { ...state, nations: { ...state.nations, [P]: { ...state.nations[P], stability: 0 } } };
    state = resolveTurn(state);
    expect(state.nations[P].lowStabilityStreak).toBe(0);
  });
});

describe('resolveTurn disasters (plan §M15)', () => {
  // Revolution: a Modern-age nation at stability -2 or worse whose legitimacy is under 30.
  const revolutionary = (meter) => {
    const base = withAllEventsFired(world(2));
    const fr = { ...base.nations[P], government: { type: 'monarchy', reforms: {} }, stability: -3, legitimacy: 10, disasters: { ...base.nations[P].disasters, revolution: meter } };
    return { ...base, techAgeId: 'modern', nations: { ...base.nations, [P]: fr } };
  };

  it('grows the Revolution meter for a discredited Modern-age regime', () => {
    const next = resolveTurn(revolutionary(0));
    expect(next.nations[P].disasters.revolution).toBeGreaterThan(0);
  });

  it('completes into a new government and a civil war once the Revolution meter reaches 100', () => {
    const next = resolveTurn(revolutionary(90));
    expect(next.nations[P].disasters.revolution).toBe(0); // completed and reset
    expect(next.nations[P].government.type).not.toBe('monarchy');
    expect(next.nations[P].civilWar?.active).toBe(true);
  });
});

describe('resolveTurn national power (plan §M4)', () => {
  it('runs the stability/legitimacy/prestige pass for every nation, not just the player\'s', () => {
    const base = withAllEventsFired(world());
    const state = { ...base, nations: { ...base.nations, [R1]: { ...base.nations[R1], prestige: 100 } } };
    const next = resolveTurn(state);
    // Prestige decays 5%/turn toward 0 (nationalPower.js) — proves the pass actually ran for an
    // AI nation, not only the one the getPowerIncome code path already special-cases.
    expect(next.nations[R1].prestige).toBeLessThan(100);
  });

  it('keeps the one ruler: no reign ends, no heir and no stability cost (differentiation plan U5)', () => {
    const base = withAllEventsFired(world(1));
    const state = { ...base, nations: { ...base.nations, [P]: { ...base.nations[P], government: { type: 'monarchy', reforms: {} }, stability: 0 } } };
    const next = resolveTurn(state);
    // The same ruler; the decree bank (decrees.js) and renown (renown.js) move.
    expect(next.nations[P].ruler).toMatchObject({ id: base.nations[P].ruler.id, name: base.nations[P].ruler.name });
    expect(next.nations[P].ruler.renown).toBeGreaterThanOrEqual(base.nations[P].ruler.renown || 0);
    expect(next.nations[P].stability).toBe(0);
    expect(next.nations[P]).not.toHaveProperty('heir');
    expect(next.nations[P]).not.toHaveProperty('estates');
  });
});

describe('resolveTurn diplomacy (plan §M12)', () => {
  it('decays every nation\'s Aggressive Expansion by AE_DECAY_PER_TURN', () => {
    const base = withAllEventsFired(world());
    const state = { ...base, nations: { ...base.nations, [R1]: { ...base.nations[R1], ae: { [P]: 10 } } } };
    const next = resolveTurn(state);
    expect(next.nations[R1].ae[P]).toBe(8);
  });

  it('decays a diplomat\'s assigned target\'s hostility faster than passive decay alone', () => {
    const base = withAllEventsFired(world());
    const withTarget = {
      ...base,
      nations: {
        ...base.nations,
        [P]: { ...base.nations[P], diplomatTasks: [{ targetId: R1, task: 'improve_relations', startedTurn: base.turnNumber }] },
        [R1]: { ...base.nations[R1], hostility: 50, hostilityFloor: 0 }
      }
    };
    const withoutTarget = { ...base, nations: { ...base.nations, [R1]: { ...base.nations[R1], hostility: 50, hostilityFloor: 0 } } };
    const withNext = resolveTurn(withTarget);
    const withoutNext = resolveTurn(withoutTarget);
    expect(withNext.nations[R1].hostility).toBeLessThan(withoutNext.nations[R1].hostility);
  });

  it('pays the player real vassal tribute proportional to the vassal\'s own development', () => {
    const base = withAllEventsFired(world());
    const withVassal = { ...base, nations: { ...base.nations, [P]: { ...base.nations[P], vassals: [R1] } } };
    const withoutVassal = base;
    const withNext = resolveTurn(withVassal);
    const withoutNext = resolveTurn(withoutVassal);
    expect(withNext.resources.gold).toBeGreaterThan(withoutNext.resources.gold);
  });

  it('rewards prestige when a designated rival is eliminated', () => {
    const base = withAllEventsFired(world());
    // Strip every region R1 owns so it's eliminated this turn's elimination sweep.
    const deEliminated = { ...base, regions: { ...base.regions } };
    Object.keys(deEliminated.regions).forEach((id) => {
      if (deEliminated.regions[id].owner === R1) deEliminated.regions[id] = { ...deEliminated.regions[id], owner: P };
    });
    const asRival = { ...deEliminated, nations: { ...deEliminated.nations, [P]: { ...deEliminated.nations[P], rivals: [R1], prestige: 0 } } };
    const next = resolveTurn(asRival);
    expect(next.nations[P].prestige).toBeGreaterThan(0);
  });
});

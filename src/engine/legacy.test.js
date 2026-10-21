import { describe, it, expect, vi } from 'vitest';
import { legacyScore } from './legacy';
import { LEGACY_PARTS, legacyPoints } from '../data/legacy';
import { AGE_ORDER } from '../data/ages';
import { rankNations, getPlayerRank } from './score';
import { resolveTurn } from './resolveTurn';
import { migrateSave, CURRENT_SAVE_VERSION } from './saveMigrations';
import { GameStatus } from '../data/types';
import { speedTurnLimit } from '../data/ages';
import { peoplesWorld, rivalOf } from './testWorld';
import { HISTORICAL_EVENTS } from '../data/events';

// The Future goal does not exist yet (no 'future' age): a test may fire it through this switch.
const goal = vi.hoisted(() => ({ nationId: null }));
vi.mock('./ending', async (load) => {
  const real = await load();
  return { ...real, endingSignal: (state, opts) => (goal.nationId ? { reason: 'futureGoal', nationId: goal.nationId } : real.endingSignal(state, opts)) };
});

const WORLD = peoplesWorld({ seed: 11 });
const ME = WORLD.playerNationId;
const RIVAL = rivalOf(WORLD, 0);
const [FIRST, SECOND] = AGE_ORDER;

const withNation = (state, id, patch) => ({ ...state, nations: { ...state.nations, [id]: { ...state.nations[id], ...patch } } });
const quiet = (state) => ({ ...state, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const atLimit = (state) => quiet({ ...state, turnNumber: speedTurnLimit(state.gameSpeed) - 1 });
// Two ages of goals and a legacy, plus an ambition: far ahead of anyone in a fresh world.
const LEADER = {
  eraGoals: { [FIRST]: { met: ['expand', 'science'], legacy: true }, [SECOND]: { met: ['war'], legacy: false } },
  ambitions: { ageId: SECOND, offers: [], done: [{ id: 'firstCity', ageId: FIRST, turn: 3, legacy: 1 }] }
};

describe('legacyScore', () => {
  it('is zero with no goals, legacies or ambitions', () => {
    expect(legacyScore(WORLD, ME)).toEqual({ total: 0, parts: [] });
    expect(legacyScore(WORLD, 'nobody').total).toBe(0);
  });

  it('adds each goal met, each legacy earned and each ambition done, at its age\'s points', () => {
    const { total, parts } = legacyScore(withNation(WORLD, ME, LEADER), ME);
    const p1 = legacyPoints(FIRST); const p2 = legacyPoints(SECOND);
    expect(total).toBe(2 * p1.eraGoal + p1.eraLegacy + p2.eraGoal + p1.ambition);
    expect(parts).toHaveLength(5);
  });

  it('every part has a reason key, an age and points', () => {
    const { parts } = legacyScore(withNation(WORLD, ME, LEADER), ME);
    parts.forEach((p) => {
      expect(LEGACY_PARTS.map((k) => `legacy.${k}`)).toContain(p.reason);
      expect(AGE_ORDER).toContain(p.ageId);
      expect(p.points).toBeGreaterThan(0);
    });
  });

  it('a later age is worth at least as much (points by age, KTD1)', () => {
    AGE_ORDER.slice(1).forEach((id, i) => LEGACY_PARTS.forEach((k) => expect(legacyPoints(id)[k]).toBeGreaterThanOrEqual(legacyPoints(AGE_ORDER[i])[k])));
  });
});

describe('rankNations by legacy', () => {
  it('ranks by legacy first, the old score breaking ties, majors only', () => {
    const state = withNation(WORLD, RIVAL, LEADER);
    const ranked = rankNations(state);
    expect(ranked[0].nationId).toBe(RIVAL);
    expect(ranked[0].legacy).toBe(legacyScore(state, RIVAL).total);
    expect(ranked.every((r) => state.nations[r.nationId].kind !== 'independent')).toBe(true);
    expect(getPlayerRank(withNation(WORLD, ME, LEADER))).toBe(1);
  });
});

describe('the ending ranks by legacy once', () => {
  it('a player first in legacy when the turn limit fires wins', () => {
    const next = resolveTurn(atLimit(withNation(WORLD, ME, LEADER)));
    expect(next.ending).toEqual({ reason: 'turnLimit' });
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('finalScore');
    expect(next.finalRank).toBe(1);
  });

  it('a player behind in legacy at the turn limit completes with a rank', () => {
    const next = resolveTurn(atLimit(withNation(WORLD, RIVAL, LEADER)));
    expect(next.gameStatus).toBe(GameStatus.COMPLETE);
    expect(next.finalRank).toBeGreaterThan(1);
  });

  it('the Future goal ends the game, also on the turn limit, and ranks once', () => {
    goal.nationId = RIVAL;
    try {
      const next = resolveTurn(atLimit(withNation(WORLD, RIVAL, LEADER)));
      expect(next.ending).toEqual({ reason: 'futureGoal', nationId: RIVAL });
      expect(next.gameStatus).toBe(GameStatus.COMPLETE);
      // The final age was scored for every major, once: another turn changes nothing.
      const again = resolveTurn(next);
      expect(again.ending).toBe(next.ending);
      expect(again.finalRank).toBe(next.finalRank);
      Object.keys(next.nations).forEach((id) => expect(again.nations[id].eraGoals).toBe(next.nations[id].eraGoals));
    } finally { goal.nationId = null; }
  });

  it('an old save mid-way to a diplomatic win loads and plays on with legacy', () => {
    const nations = { ...WORLD.nations };
    Object.keys(nations).filter((id) => id !== ME).forEach((id) => { nations[id] = { ...nations[id], hasTradeAgreement: true }; });
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: quiet({ ...WORLD, nations, diplomaticLeadershipStreak: 19 }) }).state;
    const next = resolveTurn(loaded);
    expect(next.gameStatus).toBe(GameStatus.ACTIVE);
    const end = resolveTurn(atLimit(withNation(next, ME, LEADER)));
    expect(end.victoryConditionId).toBe('finalScore');
  });
});

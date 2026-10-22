// src/engine/exploreMode.test.js
// Explore mode (differentiation plan U43): settings.explore turns off every fight.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { gameReducer } from '../context/GameContext';
import { peoplesWorld } from './testWorld';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { canFight, canAttack } from './hostility';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { startState } from './gameReducer';


const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
const world = (explore) => {
  const w = peoplesWorld({ seed: 4242 });
  return { ...w, firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true }, settings: { ...w.settings, explore } };
};

describe('explore mode', () => {
  it('startState sets the flag only when asked', () => {
    expect(startState({ playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: 'small', seed: 7 }, explore: true }).settings.explore).toBe(true);
    expect(startState({ playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: "small", seed: 7 } }).settings?.explore).toBeUndefined();
  });

  it('canFight and canAttack are false for every pair, rebels and independents included', () => {
    const s = world(true);
    const ids = [...Object.keys(s.nations), REBEL_OWNER_ID];
    ids.forEach((a) => ids.forEach((b) => { expect(canFight(s, a, b)).toBe(false); expect(canAttack(s, a, b)).toBe(false); }));
  });

  it('a war cannot be declared', () => {
    const s = world(true);
    const [me, other] = Object.keys(s.nations).filter((id) => s.nations[id].kind !== 'independent');
    const after = gameReducer({ ...s, playerNationId: me }, { type: ActionTypes.DECLARE_WAR, payload: { nationId: other } });
    expect((after.wars || []).filter((w) => w.active)).toHaveLength(0);
  });

  it('maximum unrest raises no rebels', () => {
    const w = world(true);
    const regions = Object.fromEntries(Object.entries(w.regions).map(([id, r]) => [id, { ...r, unrest: 100 }]));
    const s = resolveTurn({ ...w, regions });
    expect(Object.values(s.units).filter((u) => u.ownerId === REBEL_OWNER_ID)).toHaveLength(0);
  });

  it('50 turns: no war, no battle, no crisis', () => {
    let s = world(true);
    for (let t = 0; t < 50; t++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.ACCEPT_PENDING_PEACE });
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      expect((s.wars || []).filter((w) => w.active), `turn ${s.turnNumber}`).toHaveLength(0);
    }
    expect(s.battleReports || []).toHaveLength(0);
    expect(s.crises?.history || []).toHaveLength(0);
    expect(s.pendingDefenses || []).toHaveLength(0);
  }, 300000);
});

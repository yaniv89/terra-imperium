import { describe, it, expect } from 'vitest';
import { advanceCampaign } from '../../scripts/simulate.mjs';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { assertGameState } from './stateAudit';
import { migrateSave, CURRENT_SAVE_VERSION } from './saveMigrations';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';

const engine = { gameReducer, resolveTurn, assertGameState, ActionTypes };
const fresh = seed => ({
  ...createInitialState({ playerNationId: 'fr', rngSeed: seed }),
  firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true])),
  proceduralEventCooldown: 999999,
  battleSettings: { defaultMode: 'ask', autoDefend: true }
});

describe('audited campaigns', () => {
  it.each([7, 4242])('advances 30 real turns with state integrity (seed %s)', seed => {
    let state = fresh(seed);
    const firstTurn = state.turnNumber;
    for (let i = 0; i < 30; i++) state = advanceCampaign(engine, state);
    expect(state.turnNumber).toBe(firstTurn + 30);
  }, 120000);
  it('continues a saved multi-front war identically after reload',()=>{
    let s=fresh(7);s.wars=[{id:'one',aggressor:'fr',enemy:'de',active:true,startYear:s.year},{id:'two',aggressor:'be',enemy:'fr',active:true,startYear:s.year}];
    for(const id of ['fr','de','be'])s.nations[id]={...s.nations[id],isAtWar:true};
    const loaded=migrateSave({version:CURRENT_SAVE_VERSION,state:JSON.parse(JSON.stringify(s))}).state;
    expect(JSON.parse(JSON.stringify(advanceCampaign(engine,loaded)))).toEqual(JSON.parse(JSON.stringify(advanceCampaign(engine,s))));
  },30000);
  it('closing an eliminated nation\'s last war clears the survivor\'s war flag', () => {
    const state = fresh(7);
    Object.values(state.regions).forEach(r => { if (r.owner === 'lu') r.owner = 'fr'; });
    state.wars = [{ id: 'elimination', aggressor: 'fr', enemy: 'lu', active: true, score: 0, startTurn: 0 }];
    state.nations.fr.isAtWar = true;
    state.nations.lu.isAtWar = true;
    const next = resolveTurn(state);
    expect(next.nations.lu.isEliminated).toBe(true);
    expect(next.wars.some(w => w.active && (w.enemy === 'lu' || w.aggressor === 'lu'))).toBe(false);
    expect(next.nations.fr.isAtWar).toBe(next.wars.some(w => w.active && (w.enemy === 'fr' || w.aggressor === 'fr')));
    assertGameState(next);
  });
});

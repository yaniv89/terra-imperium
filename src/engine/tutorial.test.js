import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { peoplesWorld, addCity, cloneWorld } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { tileFacts } from '../data/tileYields';
import { isSettler } from './settlers';
import { TUTORIAL_NATION, TUTORIAL_WORLD_SIZE, TUTORIAL_STEPS, TUTORIAL_TURNS, TUTORIAL_TECH, tutorialStatus, tutorialPrompt, advanceTutorial, markTutorialStep } from './tutorial';
import { nextPrompts } from '../components/ui/nextPromptModel';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
// The guided game as it is really played: Kemet in a Standard peoples world, built once and shared.
let guidedWorld = null;
const guided = () => (guidedWorld ||= quiet(createInitialState({ playerNationId: TUTORIAL_NATION, rngSeed: 11, guided: true, scenario: { mode: 'peoples', size: TUTORIAL_WORLD_SIZE, seed: 11 } })));

describe('the guided start as Kemet (plan E9, phase W0)', () => {
  it('a guided game carries the guide, a plain one does not, and nobody starts with a free settler', () => {
    const s = guided();
    expect(s.playerNationId).toBe('kemet');
    expect(Object.keys(s.nations).filter((id) => s.nations[id].kind !== 'independent')).toHaveLength(36); // the majors; the rest are independents (W1)
    expect(s.tutorial).toEqual({ startTurn: 1, done: {}, ended: false });
    expect(peoplesWorld({ seed: 11 }).tutorial).toBeUndefined();
    expect(Object.values(s.units).some((u) => isSettler(u))).toBe(false);
    expect(tutorialStatus(s).current.id).toBe('settle');
  });

  it('is still guiding after turn 11, when the first Settlers walk out (H-22)', () => {
    const s = { ...guided(), turnNumber: 12 };
    expect(tutorialStatus(s)).toMatchObject({ active: true, turn: 12 });
    expect(tutorialStatus({ ...s, turnNumber: TUTORIAL_TURNS + 1 }).active).toBe(false);
    expect(TUTORIAL_TURNS).toBeGreaterThanOrEqual(20);
  });

  it('the first step is the first prompt and each step is read from the state', () => {
    let s = cloneWorld(guided());
    const cap = s.regions[s.nations.kemet.capitalRegionId];
    const status = tutorialStatus(s);
    expect(status.active).toBe(true);
    expect(status.steps.map((x) => x.id)).toEqual(TUTORIAL_STEPS.map((x) => x.id));
    expect(status.current.id).toBe('settle');
    expect(nextPrompts(s)[0]).toMatchObject({ kind: 'guide', step: 'settle', target: 'settler' });
    expect(tutorialPrompt(s).label).toMatch(/^Guide 1\/6/);
    // Settle: a second city counts, so the prompt moves on at once.
    const tiles = getTiles();
    const withTarget = addCity(s, 'kemet').state;
    expect(tutorialStatus(withTarget).current.id).toBe('farm');
    // Farm on a floodplain: queued is enough.
    const flood = cap.tiles.find((t) => t !== cap.tile && tileFacts(tiles, t).feature === 'floodplain');
    expect(flood).toBeDefined();
    s = gameReducer(withTarget, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: cap.id, item: { kind: 'improvement', improvement: 'farm', tile: flood } } });
    expect(tutorialStatus(s).current.id).toBe('granary');
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: cap.id, item: { kind: 'building', category: 'food', tier: 0 } } });
    expect(tutorialStatus(s).current.id).toBe('research');
    s = gameReducer(s, { type: ActionTypes.QUEUE_RESEARCH, payload: { techId: TUTORIAL_TECH } });
    expect(tutorialStatus(s).current.id).toBe('meet');
    // Meeting is witnessed by the UI through the reducer.
    expect(markTutorialStep(s, 'nope')).toBe(s);
    s = gameReducer(s, { type: ActionTypes.MARK_TUTORIAL_STEP, payload: { stepId: 'meet' } });
    expect(s.tutorial.done.meet).toBe(1);
    expect(tutorialStatus(s).current.id).toBe('battle');
    const fought = { ...s, battleReports: [{ id: 'b1', playerSide: 'attacker', outcome: 'attacker' }] };
    const ended = advanceTutorial(fought);
    expect(ended.tutorial.ended).toBe(true);
    expect(Object.keys(ended.tutorial.done)).toHaveLength(TUTORIAL_STEPS.length);
    expect(tutorialStatus(ended).active).toBe(false);
    expect(nextPrompts(ended).some((p) => p.kind === 'guide')).toBe(false);
  });

  it('the guide ends after its 25 turns, records the steps met and the world keeps turning', () => {
    let s = guided();
    for (let i = 0; i < TUTORIAL_TURNS + 1; i++) { s = resolveTurn(s); if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE }); }
    expect(s.turnNumber).toBe(TUTORIAL_TURNS + 2);
    expect(s.tutorial.ended).toBe(true);
    expect(s.logs.some((l) => /The guide ends/.test(l.message))).toBe(true);
    expect(tutorialStatus(s).active).toBe(false);
    expect(resolveTurn(peoplesWorld({ seed: 11 })).tutorial).toBeUndefined();
  }, 60000);
});


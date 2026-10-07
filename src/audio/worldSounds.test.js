// The world and interface sound map: every player action is either given a sound or knowingly
// left silent, every id named has recordings shipped, and a state change sounds as it should.
import { describe, it, expect } from 'vitest';
import { ActionTypes, GameStatus } from '../data/types';
import { ACTION_SOUNDS, actionSound, soundsForTransition, logSound, isRejection } from './worldSounds';
import { UI_SOUNDS, WORLD_SOUNDS, uiFilesFor, worldFilesFor } from './soundRegistry';

const known = (id) => !!(UI_SOUNDS[id] || WORLD_SOUNDS[id]);
const base = () => ({
  playerNationId: 'akkad', turnNumber: 5, age: 'bronze', gameStatus: GameStatus.ACTIVE, logs: [],
  wars: [], regions: { kish: { owner: 'akkad' }, ur: { owner: 'sumer' } }, units: { s1: { classId: 'settler' }, a1: { classId: 'infantry' } },
  fog: { met: { akkad: { sumer: true } } }, pendingDefenses: [], battleReports: [], battleReportSeq: 0
});
const log = (message) => ({ year: -2000, message, type: 'action' });

describe('world sounds: the action map', () => {
  it('names every ActionTypes entry (a sound, a function, or null on purpose)', () => {
    Object.values(ActionTypes).forEach((type) => expect(ACTION_SOUNDS, type).toHaveProperty(type));
    Object.keys(ACTION_SOUNDS).forEach((type) => expect(Object.values(ActionTypes), type).toContain(type));
  });

  it('maps each sounding action to a registered id', () => {
    const prev = base();
    Object.values(ActionTypes).forEach((type) => {
      const id = actionSound({ type, payload: {} }, prev, prev);
      if (id !== null) expect(known(id), `${type} -> ${id}`).toBe(true);
    });
    // The ones the player hears most must sound.
    [ActionTypes.FOUND_CITY, ActionTypes.RECRUIT_UNIT, ActionTypes.RESEARCH_TECH, ActionTypes.QUEUE_PRODUCTION, ActionTypes.MOVE_ARMY,
      ActionTypes.TRADE_AGREEMENT, ActionTypes.MILITARY_ALLIANCE, ActionTypes.RAZE_CITY, ActionTypes.SET_SETTLER_TARGET]
      .forEach((type) => expect(actionSound({ type, payload: {} }, prev, prev), type).not.toBeNull());
  });

  it('tells a settler from an army, and a wonder from a building', () => {
    const prev = base();
    expect(actionSound({ type: ActionTypes.MOVE_ARMY, payload: { unitId: 's1' } }, prev, prev)).toBe('settler-moving');
    expect(actionSound({ type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a1' } }, prev, prev)).toBe('army-moved');
    expect(actionSound({ type: ActionTypes.QUEUE_PRODUCTION, payload: { item: { kind: 'wonder' } } }, prev, prev)).toBe('wonder-started');
    expect(actionSound({ type: ActionTypes.QUEUE_PRODUCTION, payload: { item: { kind: 'building' } } }, prev, prev)).toBe('building-queued');
  });

  it('has recordings for every interface and world id (CC0, src/assets/audio/LICENSES.md)', () => {
    Object.keys(UI_SOUNDS).forEach((id) => expect(uiFilesFor(id).length, id).toBeGreaterThanOrEqual(1));
    Object.keys(WORLD_SOUNDS).forEach((id) => expect(worldFilesFor(id).length, id).toBeGreaterThanOrEqual(1));
  });

  it('reads the news in log lines, not the income line', () => {
    expect(logSound('Kish grows to size 4.')).toBe('city-grows');
    expect(logSound('Kish completes a Granary.')).toBe('building-complete');
    expect(logSound('Researched Bronze Working.')).toBe('tech-complete');
    expect(logSound('A new era dawns: the world enters the Iron Age.')).toBe('era-advanced');
    expect(logSound('Rebellion breaks out in Ur!')).toBe('rebellion');
    expect(logSound('The Gutians join you: Lagash is yours, peacefully.')).toBe('independent-joined');
    expect(logSound('Gutian raiders are 3 tiles from Kish.')).toBe('raid-warning');
    expect(logSound('Kish trains infantry.')).toBe('unit-trained');
    expect(logSound('-1990: +12')).toBeNull();
    expect(logSound('Nothing of note.')).toBeNull();
  });
});

describe('world sounds: a state change', () => {
  it('a refused action (only a log line added) is an error, nothing else', () => {
    const prev = base();
    const next = { ...prev, logs: [log('Not your city.')] };
    expect(isRejection(prev, next)).toBe(true);
    expect(soundsForTransition(prev, next, { type: ActionTypes.QUEUE_PRODUCTION, payload: {} })).toEqual(['ui-error']);
  });

  it('a diplomatic offer turned down sounds like a refusal', () => {
    const prev = base();
    const next = { ...prev, nations: {}, logs: [log('Sumer refuses your alliance.')] };
    expect(soundsForTransition(prev, next, { type: ActionTypes.MILITARY_ALLIANCE, payload: {} })).toContain('ui-error');
  });

  it('a war begun and a war ended', () => {
    const prev = base();
    const atWar = { ...prev, wars: [{ id: 'w1', aggressor: 'akkad', enemy: 'sumer', active: true }] };
    expect(soundsForTransition(prev, atWar, { type: ActionTypes.DECLARE_WAR, payload: {} })).toContain('war-declared');
    const peace = { ...atWar, wars: [{ id: 'w1', aggressor: 'akkad', enemy: 'sumer', active: false }] };
    expect(soundsForTransition(atWar, peace, { type: ActionTypes.ACCEPT_PENDING_PEACE, payload: {} })).toContain('peace-signed');
  });

  it('cities founded, captured and lost', () => {
    const prev = base();
    const founded = { ...prev, regions: { ...prev.regions, lagash: { owner: 'akkad' } } };
    expect(soundsForTransition(prev, founded, { type: ActionTypes.FOUND_CITY, payload: {} })).toContain('city-founded');
    const taken = { ...prev, regions: { ...prev.regions, ur: { owner: 'akkad' } } };
    expect(soundsForTransition(prev, taken, { type: ActionTypes.APPLY_TURN_RESULT, payload: {} })).toContain('city-captured');
    const lost = { ...prev, regions: { ...prev.regions, kish: { owner: 'sumer' } } };
    expect(soundsForTransition(prev, lost, { type: ActionTypes.APPLY_TURN_RESULT, payload: {} })).toContain('city-lost');
  });

  it('a turn: its news, a new era, an event, a raid, a new people met, and the new turn itself', () => {
    const prev = base();
    const next = {
      ...prev, turnNumber: 6, age: 'iron', activeEventId: 'flood',
      pendingDefenses: [{ kind: 'raid' }], fog: { met: { akkad: { sumer: true, elam: true } } },
      logs: [log('Kish grows to size 4.'), log('-1990: +12')]
    };
    const ids = soundsForTransition(prev, next, { type: ActionTypes.APPLY_TURN_RESULT, payload: {} });
    ['era-advanced', 'event-appeared', 'raid-warning', 'first-contact', 'city-grows', 'turn-begin'].forEach((id) => expect(ids).toContain(id));
    expect(ids.every(known)).toBe(true);
  });

  it('a battle the player fought on Auto: won or lost', () => {
    const prev = base();
    const won = { ...prev, battleReportSeq: 1, battleReports: [{ outcome: 'attacker', playerSide: 'attacker' }] };
    expect(soundsForTransition(prev, won, { type: ActionTypes.LAUNCH_INVASION, payload: {} })).toContain('battle-won');
    const lost = { ...prev, battleReportSeq: 1, battleReports: [{ outcome: 'defender', playerSide: 'attacker' }] };
    expect(soundsForTransition(prev, lost, { type: ActionTypes.ATTACK_ARMY, payload: {} })).toContain('battle-lost');
    // A commanded battle already sounded its victory or defeat on the battlefield.
    expect(soundsForTransition(prev, won, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: {} })).not.toContain('battle-won');
  });

  it('victory and defeat', () => {
    const prev = base();
    expect(soundsForTransition(prev, { ...prev, gameStatus: GameStatus.VICTORY }, { type: ActionTypes.APPLY_TURN_RESULT })).toContain('game-victory');
    expect(soundsForTransition(prev, { ...prev, gameStatus: GameStatus.DEFEAT }, { type: ActionTypes.APPLY_TURN_RESULT })).toContain('game-defeat');
  });

  it('is silent for a load, a new game, a bare log line, or no change', () => {
    const prev = base();
    const other = { ...prev, turnNumber: 9 };
    expect(soundsForTransition(prev, other, { type: ActionTypes.LOAD_GAME })).toEqual([]);
    expect(soundsForTransition(prev, other, { type: ActionTypes.RESET_GAME })).toEqual([]);
    expect(soundsForTransition(prev, { ...prev, logs: [log('Achievement unlocked: First City')] }, { type: ActionTypes.ADD_LOG })).toEqual([]);
    expect(soundsForTransition(prev, prev, { type: ActionTypes.FOUND_CITY })).toEqual([]);
  });
});

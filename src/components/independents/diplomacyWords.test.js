// CB08 slice (L8): honest diplomacy words. The attitude label follows an active raid, the opinion
// "Why?" adds up to the number shown, first contact says who met whom, an arrival is not a colony.
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { isIndependentNation } from '../../data/independents';
import { opinionBreakdown, opinionOf } from '../../engine/opinion';
import { attitudeLabel } from './independentSheetModel';
import { contactHow, contactCard } from '../modals/firstContactModel';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const me = base.playerNationId;

describe('attitude label follows raiding (I111)', () => {
  const ind = Object.values(base.nations).find((n) => isIndependentNation(n) && !n.isEliminated);
  const withIndep = (patch) => ({ ...ind, indep: { ...ind.indep, ...patch } });

  it('a warm independent with a party out against you is not just "Warm"', () => {
    expect(attitudeLabel(base, withIndep({ raid: null, lastRaidOnPlayer: null }), me, 16)).toEqual({ word: 'Warm', tone: 'neutral', raiding: null });
    const now = attitudeLabel(base, withIndep({ raid: { targetNationId: me, phase: 'out' } }), me, 16);
    expect(now).toMatchObject({ word: 'Warm but raiding you', tone: 'bad', raiding: 'now' });
    const going = attitudeLabel(base, withIndep({ raid: { targetNationId: me, phase: 'home' } }), me, 16);
    expect(going.raiding).toBe(null);
  });

  it('a recent hit counts, an old one does not; a hostile one reads as a plain list', () => {
    const t = base.turnNumber;
    expect(attitudeLabel(base, withIndep({ lastRaidOnPlayer: { turn: t - 3, won: true } }), me, 16).word).toBe('Warm but raided you lately');
    expect(attitudeLabel(base, withIndep({ lastRaidOnPlayer: { turn: t - 30, won: true } }), me, 16).raiding).toBe(null);
    expect(attitudeLabel(base, withIndep({ raid: { targetNationId: me, phase: 'out' } }), me, -60).word).toBe('Hostile, raiding you');
  });
});

describe('opinion Why? reconciles (I112)', () => {
  it('the rows add up to the total shown, for every nation', () => {
    Object.keys(base.nations).filter((id) => id !== me).slice(0, 60).forEach((id) => {
      const b = opinionBreakdown(base, id);
      expect(b.total).toBe(opinionOf(base, id));
      const rowSum = b.rows.reduce((s, r) => s + r.value, 0);
      if (!b.clamped) expect(Math.round((rowSum + b.rounding) * 10) / 10).toBe(b.total);
    });
  });

  it('names the starting point and says when nothing else applies', () => {
    const stranger = Object.keys(base.nations).find((id) => id !== me && opinionBreakdown(base, id).rows.length === 1);
    if (!stranger) return;
    const b = opinionBreakdown(base, stranger);
    expect(b.plain).toBe(true);
    expect(b.rows[0].label).toBe('Starting point for strangers');
  });
});

describe('first contact words (I118)', () => {
  it('never credits scouts, and depends on who saw whom', () => {
    const args = { capitalSeen: true, capital: 'Kanesh' };
    const youOnly = contactHow({ ...args, youSaw: true, theySaw: false });
    const theyOnly = contactHow({ ...args, capitalSeen: false, youSaw: false, theySaw: true });
    const both = contactHow({ ...args, youSaw: true, theySaw: true });
    const none = contactHow({ capitalSeen: false, capital: null, youSaw: false, theySaw: false });
    [youOnly, theyOnly, both, none].forEach((t) => expect(t).not.toMatch(/scout/i));
    expect(youOnly).toContain('Kanesh');
    expect(theyOnly).toMatch(/They came across your land/);
    expect(both).toMatch(/each other's sight/);
    expect(none).toMatch(/Word of them/);
  });

  it('the card carries the words', () => {
    const other = Object.keys(base.nations).find((id) => id !== me && !isIndependentNation(base.nations[id]) && base.nations[id].capitalRegionId);
    const card = contactCard(base, other);
    expect(typeof card.how).toBe('string');
    expect(card.how).not.toMatch(/scout/i);
  });
});

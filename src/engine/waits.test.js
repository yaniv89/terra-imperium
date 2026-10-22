import { describe, it, expect } from 'vitest';
import { waitAgeOf } from './ageRefs';
import { demandTruceTurns, demandCbTurns } from './accords';
import { demandGapTurns } from './aiAccords';
import { plunderCutTurns } from './tradeDisruptions';
import { speedTurns } from '../data/ages';
import { DEMAND_TRUCE_REF_TURNS } from './accords';

// Eight-ages plan U12 (KTD7): a wait runs at the age of whoever waits.
const state = {
  playerNationId: 'p',
  techAgeId: 'classical',
  gameSpeed: 'marathon', // Bronze 3, Classical 2.6, Kingdoms 4, Modern 3: the ages differ here
  nations: { p: { id: 'p' }, b: { id: 'b', tech: { ageId: 'bronze' } }, m: { id: 'm', tech: { ageId: 'modern' } }, k: { id: 'k', tech: { ageId: 'kingdoms' } } },
  regions: { r1: { owner: 'k', size: 3 }, r2: { owner: 'p', size: 1 } }
};

describe('waits keyed by the right age', () => {
  it('a wait shared by two nations uses the older age of the two', () => {
    expect(waitAgeOf(state, 'p', 'm')).toBe('classical');
    expect(waitAgeOf(state, 'm', 'b')).toBe('bronze');
    expect(waitAgeOf(state, 'm')).toBe('modern');
  });

  it('a truce between a Modern and a Kingdoms nation lasts the Kingdoms span', () => {
    expect(demandTruceTurns(state, 'm', 'k')).toBe(speedTurns(DEMAND_TRUCE_REF_TURNS, 'marathon', 'kingdoms'));
    expect(demandTruceTurns(state, 'm', 'k')).not.toBe(speedTurns(DEMAND_TRUCE_REF_TURNS, 'marathon', 'modern'));
    expect(demandCbTurns(state, 'k', 'm')).toBe(demandCbTurns(state, 'm', 'k'));
  });

  it('the pressed people waits at its own age; a route at the older of the player and its partner', () => {
    expect(demandGapTurns(state, 'm')).toBeLessThan(demandGapTurns(state, 'k'));
    expect(plunderCutTurns(state, 'm')).toBe(plunderCutTurns(state, 'p'));
  });

  it('a wait owned by no nation uses the research leader\'s age', () => {
    expect(waitAgeOf(state)).toBe('kingdoms'); // m and b hold no city; k leads among those that do
  });
});

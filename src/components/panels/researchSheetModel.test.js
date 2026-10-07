import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { researchSheetModel, boostTarget } from './researchSheetModel';
import { AGE_ORDER } from '../../data/ages';
import { TECH_TREE } from '../../data/techTree';
import { BOOSTS, BOOST_SHARE } from '../../data/boosts';
import { getResearchCost } from '../../engine/research';

describe('research sheet model (W09)', () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });

  it('has an age strip with every age, its techs known of its total, and the current one', () => {
    const m = researchSheetModel(s);
    expect(m.ages.map((a) => a.ageId)).toEqual(AGE_ORDER);
    const total = m.ages.reduce((n, a) => n + a.total, 0);
    expect(total).toBe(Object.keys(TECH_TREE).length);
    expect(m.ages.filter((a) => a.current)).toHaveLength(1);
    expect(m.header.total).toBe(m.ages.find((a) => a.current).total);
    expect(m.era.goals).toHaveLength(5);
    expect(m.era.goals.every((g) => g.bonus)).toBe(true);
  });

  it('lists the boosts of techs you can start, met ones first, none already taken', () => {
    const m = researchSheetModel(s);
    expect(m.boosts.length).toBeGreaterThan(0);
    m.boosts.forEach((b) => { expect(BOOSTS[b.techId]).toBeTruthy(); expect(b.taken).toBe(false); expect(b.share).toBe(Math.round(BOOST_SHARE * 100)); });
    const firstUnmet = m.boosts.findIndex((b) => !b.met);
    if (firstUnmet >= 0) expect(m.boosts.slice(firstUnmet).every((b) => !b.met)).toBe(true);
  });

  it('draws a met boost of the current tech as the waiting part of its bar', () => {
    const techId = Object.keys(BOOSTS).find((id) => TECH_TREE[id] && m0boostMet(id));
    if (!techId) return; // no boost met at the start for this people
    const st = { ...s, research: { ...(s.research || {}), current: techId, queue: [], progress: {}, boosted: {} } };
    const m = researchSheetModel(st);
    expect(m.current.tech.id).toBe(techId);
    expect(m.current.pendingBoost).toBe(Math.round(getResearchCost(st, st.playerNationId, techId) * BOOST_SHARE));
    const taken = researchSheetModel({ ...st, research: { ...st.research, boosted: { [techId]: true } } });
    expect(taken.current.pendingBoost).toBe(0);
  });

  it('points each unmet boost at the right lens or sheet', () => {
    expect(boostTarget('Found a city on a river')).toEqual({ kind: 'lens', lens: 'settle', label: 'Map' });
    expect(boostTarget('Own copper').lens).toBe('settle');
    expect(boostTarget('Grow a city to size 4').lens).toBe('yields');
    expect(boostTarget('Build a road').lens).toBe('supply');
    expect(boostTarget('Sign a trade agreement')).toEqual({ kind: 'tab', tab: 'diplomacy', label: 'Peoples' });
    expect(boostTarget('Own a harbour')).toBeNull();
    expect(boostTarget('Lay a siege')).toBeNull();
  });

  function m0boostMet(id) { return researchSheetModel({ ...s, research: { ...(s.research || {}), current: id, queue: [] } }).current?.boost?.met; }
});

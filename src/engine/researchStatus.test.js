import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { TECH_TREE } from '../data/techTree';
import { researchStatus, researchNeedsChoice, researchSchedule, advisorPlan, scholarsPreview, nextGatedTech } from './researchStatus';
import { researchIdle, turnBlockers } from './turnBlockers';
import { nextPrompts } from '../components/ui/nextPromptModel';
import { getResearchView } from '../components/panels/researchView';
import { scienceLabel, topBarModel } from '../components/ui/topBarModel';
import { empireOverviewModel } from '../components/panels/empireOverviewModel';
import { previewGovernmentChange } from './governmentPreview';
import { authorityOf, canEnactLaws } from './authority';
import { getAvailableGovernmentTypes } from '../data/government';
import { peoplesWorld } from './testWorld';

const fresh = () => peoplesWorld({ seed: 5, age: 'bronze' });
const techs = Object.values(TECH_TREE);

// A Bronze state in which every tech of its research window (Bronze and Classical) is known, so
// what is left is all held back by the window (the age stays Bronze: nothing re-derives it here).
const allOpenKnown = (s) => {
  const techTree = { ...s.techTree };
  techs.filter((t) => t.ageId === 'bronze' || t.ageId === 'classical').forEach((t) => { techTree[t.id] = { ...techTree[t.id], researched: true }; });
  return { ...s, techAgeId: 'bronze', techTree, research: { current: null, queue: [], progress: {}, auto: false, lastCompleted: null } };
};

describe('research status: a tech held back by the research window (KTD4)', () => {
  const gatedState = () => {
    const base = allOpenKnown(fresh());
    const gated = nextGatedTech(base);
    return { gated, state: { ...base, research: { ...base.research, current: gated.techId }, resources: { ...base.resources, techPoints: 100000 } } };
  };

  it('a tech two ages ahead waits for the age before it, never for a year', () => {
    const { gated, state } = gatedState();
    expect(TECH_TREE[gated.techId].ageId).toBe('kingdoms');
    expect(gated.ageId).toBe('classical');
    const st = researchStatus(state);
    expect(st.kind).toBe('waiting');
    expect(st.gate).toMatchObject({ kind: 'age', ageId: 'classical', label: 'Classical Age', turns: null });
    expect(st.finishesIn).toBe(Infinity);
    expect(st.note).toContain('waits for the Classical Age');
    expect(st.note).toContain('banked');
    const view = getResearchView(state);
    expect(scienceLabel(view.current, view.status)).toBe(`${TECH_TREE[gated.techId].name} waits for the Classical Age`);
    expect(topBarModel(state).science.label).toContain('waits for');
    expect(empireOverviewModel(state).research.gate).toBeTruthy();
    expect(researchNeedsChoice(state)).toBe(false);
    expect(nextPrompts(state).some((p) => p.kind === 'research')).toBe(false);
    expect(turnBlockers(state).some((b) => b.kind === 'research')).toBe(false);
  });

  it('a queue opens its own gate: techs earlier in the order move the age on', () => {
    const s = fresh();
    const bronze = techs.filter((t) => t.ageId === 'bronze');
    const classical = techs.filter((t) => t.ageId === 'classical');
    const kingdoms = techs.find((t) => t.ageId === 'kingdoms');
    const order = [...bronze.map((t) => t.id), ...classical.map((t) => t.id), kingdoms.id];
    const sched = researchSchedule({ ...s, techAgeId: 'bronze' }, order, 1000);
    expect(sched[sched.length - 1].gate).toBeNull();
    const [alone] = researchSchedule({ ...s, techAgeId: 'bronze' }, [kingdoms.id], 1000);
    expect(alone.gate).toMatchObject({ kind: 'age', ageId: 'classical' });
    expect(alone.finishesIn).toBe(Infinity);
  });
});

describe('research status: nothing can start', () => {
  it('waiting for an age is not a "Choose research" prompt, with or without the advisor', () => {
    const s = allOpenKnown(fresh());
    expect(researchNeedsChoice(s)).toBe(false);
    expect(researchIdle(s)).toBe(false);
    expect(nextPrompts(s).some((p) => p.kind === 'research')).toBe(false);
    const st = researchStatus(s);
    expect(st.kind).toBe('idle-waiting');
    expect(st.next.ageId).toBe('classical');
    expect(st.note).toContain('opens in the Classical Age');
    const auto = { ...s, research: { ...s.research, auto: true } };
    expect(researchStatus(auto).kind).toBe('advisor-waiting');
    expect(advisorPlan(s).techId).toBeNull();
    expect(advisorPlan(s).why).toContain(st.next.name);
    expect(scienceLabel(null, st)).toBe(st.shortLabel);
  });

  it('a fresh game with a free choice still asks, and the advisor then picks something', () => {
    const s = { ...fresh(), research: { current: null, queue: [], progress: {}, auto: false, lastCompleted: null } };
    expect(researchNeedsChoice(s)).toBe(true);
    expect(nextPrompts(s)[0]).toMatchObject({ kind: 'research' });
    expect(turnBlockers(s).some((b) => b.kind === 'research')).toBe(true);
    expect(researchStatus(s).kind).toBe('choose');
    const plan = advisorPlan(s);
    expect(plan.techId).toBeTruthy();
    const chosen = gameReducer(gameReducer(s, { type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } }), { type: ActionTypes.RESEARCH_TECH, payload: { techId: plan.techId } });
    expect(chosen.research.current).toBe(plan.techId);
    expect(researchStatus(chosen).kind).toBe('researching');
  });
});

describe('Fund Scholars preview', () => {
  it('says the science added and the turns it saves, or that it banks', () => {
    const s = fresh();
    const none = scholarsPreview({ ...s, research: { ...s.research, current: null } }, 40);
    expect(none.note).toContain('bank');
    const cur = s.research.current || techs.find((t) => t.prerequisites.length === 0).id;
    const p = scholarsPreview({ ...s, research: { ...s.research, current: cur }, resources: { ...s.resources, techPoints: 0 } }, 40);
    expect(p.added).toBe(40);
    expect(p.turnsSaved).toBeGreaterThanOrEqual(0);
  });
});

describe('government change preview', () => {
  it('matches what the real action does, including the Authority 25 law line', () => {
    const base = fresh();
    const me = base.playerNationId;
    const target = getAvailableGovernmentTypes(base.techAgeId, base.nations[me].identity).find((t) => t.id !== base.nations[me].government?.type);
    expect(target).toBeTruthy();
    let sawLock = false;
    for (const legitimacy of [0, 20, 35, 50, 70, 100]) {
      for (const stability of [-3, -1, 0, 1, 2, 3]) {
        const s = { ...base, nations: { ...base.nations, [me]: { ...base.nations[me], stability, legitimacy, ruler: { ...base.nations[me].ruler, decrees: 3 } } } };
        const pv = previewGovernmentChange(s, target.id);
        const real = gameReducer(s, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: target.id } });
        expect(pv.ok).toBe(true);
        expect(pv.after.authority).toBe(authorityOf(real, me).total);
        expect(pv.after.stability).toBe(real.nations[me].stability);
        expect(pv.after.canEnactLaws).toBe(canEnactLaws(real, me));
        expect(pv.locksLaws).toBe(canEnactLaws(s, me) && !canEnactLaws(real, me));
        if (pv.locksLaws) { sawLock = true; expect(pv.lines.join(' ')).toContain('cannot enact laws'); }
      }
    }
    expect(sawLock).toBe(true);
  });

  it('works even when the change is not affordable yet', () => {
    const s = fresh();
    const me = s.playerNationId;
    const poor = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], ruler: { ...s.nations[me].ruler, decrees: 0 } } } };
    const target = getAvailableGovernmentTypes(s.techAgeId, s.nations[me].identity).find((t) => t.id !== s.nations[me].government?.type);
    const pv = previewGovernmentChange(poor, target.id);
    expect(pv.ok).toBe(true);
    expect(pv.affordable).toBe(false);
  });
});

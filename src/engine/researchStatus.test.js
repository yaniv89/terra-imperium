import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { TECH_TREE } from '../data/techTree';
import { researchStatus, researchNeedsChoice, turnsUntilYear, researchSchedule, advisorPlan, scholarsPreview, nextGatedTech } from './researchStatus';
import { researchIdle, turnBlockers } from './turnBlockers';
import { nextPrompts } from '../components/ui/nextPromptModel';
import { getResearchView } from '../components/panels/researchView';
import { scienceLabel, topBarModel } from '../components/ui/topBarModel';
import { empireOverviewModel } from '../components/panels/empireOverviewModel';
import { previewGovernmentChange } from './governmentPreview';
import { authorityOf, canEnactLaws } from './authority';
import { getAvailableGovernmentTypes } from '../data/government';

const fresh = () => createInitialState({ playerNationId: 'fr', rngSeed: 5 });
const techs = Object.values(TECH_TREE);

// A state in which every tech that is open by date is known, so what is left is all held back by its year.
const allOpenKnown = (s) => {
  const techTree = { ...s.techTree };
  techs.filter((t) => t.yearAvailable <= s.year).forEach((t) => { techTree[t.id] = { ...techTree[t.id], researched: true }; });
  return { ...s, techTree, research: { current: null, queue: [], progress: {}, auto: false, lastCompleted: null } };
};

describe('turnsUntilYear', () => {
  it('counts turns on the real calendar schedule across BCE to CE', () => {
    const s = { year: -30, age: 'classical', gameSpeed: 'normal' };
    expect(turnsUntilYear(s, -30)).toBe(0);
    expect(turnsUntilYear(s, 20)).toBe(5); // 12 years a turn: -18, -6, 6, 18, 30
    expect(turnsUntilYear({ ...s, gameSpeed: 'marathon' }, 20)).toBe(10); // 5 years a turn
  });
});

describe('research status: a tech held back by its date', () => {
  const gatedState = () => {
    const base = allOpenKnown(fresh());
    const gated = nextGatedTech(base);
    // Make it startable by prerequisites, then choose it with a big bank.
    const techTree = { ...base.techTree };
    techs.filter((t) => t.id !== gated.techId && t.yearAvailable > base.year).forEach((t) => { techTree[t.id] = { ...techTree[t.id], researched: true }; });
    return { gated, state: { ...base, techTree, research: { ...base.research, current: gated.techId }, resources: { ...base.resources, techPoints: 100000 } } };
  };

  it('never says 1 turn while the date is far: the wait is shown with the banked science', () => {
    const { gated, state } = gatedState();
    const st = researchStatus(state);
    expect(st.kind).toBe('waiting');
    expect(st.gate).toMatchObject({ kind: 'wait', year: gated.year, turns: gated.turns });
    expect(st.finishesIn).toBe(gated.turns);
    expect(gated.turns).toBeGreaterThan(1);
    expect(st.note).toContain(`waits for ${gated.label}`);
    expect(st.note).toContain('banked');
    const view = getResearchView(state);
    expect(view.current.finishesIn).toBe(gated.turns);
    expect(scienceLabel(view.current, view.status)).toBe(`${TECH_TREE[gated.techId].name} waits for ${gated.label}`);
    expect(topBarModel(state).science.label).toContain('waits for');
    expect(empireOverviewModel(state).research.name).toBe(TECH_TREE[gated.techId].name);
    expect(empireOverviewModel(state).research.gate).toBeTruthy();
    // a gated current tech is neither a "Choose research" prompt nor a blocker
    expect(researchNeedsChoice(state)).toBe(false);
    expect(nextPrompts(state).some((p) => p.kind === 'research')).toBe(false);
    expect(turnBlockers(state).some((b) => b.kind === 'research')).toBe(false);
  });

  it('the finish is the later of science ready and date reached', () => {
    const { gated, state } = gatedState();
    const poor = { ...state, resources: { ...state.resources, techPoints: 0 } };
    const [slow] = researchSchedule(poor, [gated.techId], 0.001);
    expect(slow.finishesIn).toBeGreaterThanOrEqual(gated.turns);
    const [fast] = researchSchedule(state, [gated.techId], 50);
    expect(fast.finishesIn).toBe(gated.turns); // science was ready long before the date
  });
});

describe('research status: nothing can start', () => {
  it('waiting for a date is not a "Choose research" prompt, with or without the advisor', () => {
    const s = allOpenKnown(fresh());
    expect(researchNeedsChoice(s)).toBe(false);
    expect(researchIdle(s)).toBe(false);
    expect(nextPrompts(s).some((p) => p.kind === 'research')).toBe(false);
    const st = researchStatus(s);
    expect(st.kind).toBe('idle-waiting');
    expect(st.next.turns).toBeGreaterThan(0);
    expect(st.note).toContain('opens in');
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
    const target = getAvailableGovernmentTypes(base.age, base.nations[me].identity).find((t) => t.id !== base.nations[me].government?.type);
    expect(target).toBeTruthy();
    let sawLock = false;
    for (const legitimacy of [0, 20, 35, 50, 70, 100]) {
      for (const stability of [-3, -1, 0, 1, 2, 3]) {
        const s = { ...base, resources: { ...base.resources, adm: 1000 }, nations: { ...base.nations, [me]: { ...base.nations[me], stability, legitimacy } } };
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
    const poor = { ...s, resources: { ...s.resources, adm: 0 } };
    const target = getAvailableGovernmentTypes(s.age, s.nations[me].identity).find((t) => t.id !== s.nations[me].government?.type);
    const pv = previewGovernmentChange(poor, target.id);
    expect(pv.ok).toBe(true);
    expect(pv.affordable).toBe(false);
  });
});

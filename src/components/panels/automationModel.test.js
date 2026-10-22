import { describe, it, expect } from 'vitest';
import { automationView } from './automationModel';
import { AUTOMATION_PER_ROBOT } from '../../engine/automation';
import { techInfo } from './researchView';
import { TECH_TREE } from '../../data/techTree';
import { peoplesWorld } from '../../engine/testWorld';
import { armySheetModel, stackOn } from '../map/armySheetModel';

const world = (nation, units = {}) => ({ turnNumber: 10, nations: { me: { stability: 0, ...nation } }, units, techTree: {} , playerNationId: 'me' });

describe('automationView', () => {
  it('is null for a nation with no machines', () => {
    expect(automationView(world({}), 'me')).toBeNull();
  });
  it('counts live robots for the target and shows the yields', () => {
    const v = automationView(world({ automation: 40 }, { a: { ownerId: 'me', robot: true, strength: 50 }, b: { ownerId: 'me', robot: true, strength: 0 }, c: { ownerId: 'me', strength: 50 } }), 'me');
    expect(v.robots).toBe(1);
    expect(v.target).toBe(AUTOMATION_PER_ROBOT);
    expect(v.production).toBe(10);
    expect(v.science).toBe(8);
    expect(v.rioting).toBe(false);
  });
  it('shows the riots, the danger and the turns left of a warning', () => {
    const v = automationView(world({ automation: 70, stability: -2, uprisingWarning: { since: 8, at: 14 } }), 'me');
    expect(v.rioting).toBe(true);
    expect(v.warningTurns).toBe(4);
    expect(v.danger).toBe(false); // the target is 0: no robots left, the meter is falling
  });
});

describe('Future UI rows (U74)', () => {
  it('Future Tech says how many times it was taken; a robot row in the army sheet is marked', () => {
    const s = peoplesWorld({ seed: 7 });
    const ft = Object.values(TECH_TREE).find((t) => t.repeatable).id;
    expect(techInfo(s, ft).repeats).toBe(0);
    expect(techInfo({ ...s, research: { ...s.research, futureTechs: 3 } }, ft).repeats).toBe(3);
    const cap = s.regions[s.nations[s.playerNationId].capitalRegionId];
    const id = stackOn(s, cap.tile)[0].id;
    const withRobot = { ...s, units: { ...s.units, [id]: { ...s.units[id], robot: true } } };
    expect(armySheetModel(withRobot, cap.tile).groups[0].units.find((u) => u.id === id).robot).toBe(true);
  }, 60000);
});

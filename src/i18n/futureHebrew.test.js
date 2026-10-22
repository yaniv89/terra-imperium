// Eight ages U75: every Future string a player meets has Hebrew text, with no Latin letters left.
import { describe, it, expect } from 'vitest';
import { dataTable, tableOf } from './core';
import { ROBOT_VARIANTS } from '../data/unitClasses';
import { COUNCIL_ORDER } from '../data/worldCongress';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTechsForAge, TECH_TREE } from '../data/techTree';

const LATIN = /[A-Za-zÀ-ɏ]/;
const data = dataTable('he');
const he = tableOf('he');
const hebrew = (table, key) => {
  const text = table[key] ?? table[`${key}.other`];
  expect(text, `Hebrew text for ${key}`).toBeDefined();
  expect(String(text).replace(/\{\w+\}/g, ''), key).not.toMatch(LATIN);
};

describe('Future Hebrew (U75)', () => {
  it('techs, robot variants, battle economy names and events', () => {
    [...getTechsForAge('future'), ...Object.values(TECH_TREE).filter((t) => t.ageId === 'future')].forEach((t) => hebrew(data, `tech.${t.id}`));
    Object.keys(ROBOT_VARIANTS).forEach((c) => hebrew(data, `unit.robot.${c}`));
    Object.keys(data).filter((k) => k.startsWith('beco.information.')).forEach((k) => hebrew(data, k.replace('information', 'future'))); // every Information name has its Future one
    Object.values(HISTORICAL_EVENTS).filter((e) => e.ageId === 'future').forEach((e) => { hebrew(data, `evt.${e.id}.title`); hebrew(data, `evt.${e.id}.desc`); e.options.forEach((_, i) => hebrew(data, `evt.${e.id}.opt${i}`)); });
  });
  it('the Planetary Council, the automation box and the uprising', () => {
    COUNCIL_ORDER.forEach((id) => { hebrew(he, `wc.res.${id}`); hebrew(he, `wc.res.${id}.desc`); });
    ['dom.automation', 'p1.dom.autoMeter', 'p1.dom.autoYields', 'p1.dom.autoRisk', 'p1.dom.autoRiots', 'p1.dom.autoWarn', 'prompt.uprising', 'p2.tr.repeats', 'mx.army.statsRobot', 'cy.robotDetail'].forEach((k) => hebrew(he, k));
  });
});

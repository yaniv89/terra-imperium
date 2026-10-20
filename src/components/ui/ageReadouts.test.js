// U15: the screens talk about a nation's own age (ageOf) and the player's progress toward the next,
// never a calendar or a world age.
import { describe, it, expect } from 'vitest';
import { peoplesWorld } from '../../engine/testWorld';
import { peoplesModel } from '../panels/peoplesModel';
import { researchSheetModel } from '../panels/researchSheetModel';
import { topBarModel } from './topBarModel';
import { turnReportModel } from './turnReportModel';
import { ageProgress, ageVersusPlayer } from './ageProgress';
import { ageOf } from '../../engine/nationState';
import { AGE_ORDER } from '../../data/ages';
import { translate } from '../../i18n';

const world = peoplesWorld({ seed: 3 });
const me = world.playerNationId;
const other = Object.values(world.nations).find((n) => n.id !== me && n.kind !== 'independent').id;
const met = (s) => ({ ...s, fog: { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met[me] || {}), [other]: 1 } } } });
// the player in `mine`, the other nation in `theirs`; no state.age anywhere
const at = (mine, theirs) => {
  const s = met({ ...world, techAgeId: mine });
  delete s.age;
  return { ...s, nations: { ...s.nations, [other]: { ...s.nations[other], tech: { ...(s.nations[other].tech || {}), ageId: theirs } } } };
};

describe('a nation card shows the nation\'s own age against yours', () => {
  const row = (s) => peoplesModel(s).rows.find((r) => r.id === other);
  it.each([
    ['ahead', 'bronze', 'classical'],
    ['equal', 'classical', 'classical'],
    ['behind', 'classical', 'bronze']
  ])('%s', (vs, mine, theirs) => {
    const s = at(mine, theirs);
    expect(ageOf(s, other)).toBe(theirs);
    expect(ageVersusPlayer(s, other)).toBe(vs);
    const r = row(s);
    expect(r.ageId).toBe(theirs);
    expect(r.ageVsYou).toBe(vs);
    expect(r.ageName).toBeTruthy();
  });
});

describe('the player\'s age and progress', () => {
  it('research sheet names the player\'s age and the next, from techAgeId and not state.age', () => {
    const s = { ...at('bronze', 'bronze'), age: 'medieval' };
    const m = researchSheetModel(s);
    expect(m.header.ageName).toMatch(/Bronze/);
    expect(m.header.nextAgeName).toBeTruthy();
    expect(m.header.techsLeft).toBeGreaterThan(0);
  });
  it('the last age has no next', () => {
    const last = AGE_ORDER[AGE_ORDER.length - 1];
    const p = ageProgress(at(last, last), me);
    expect(p.nextAgeId).toBeNull();
    expect(p.techsLeft).toBeNull();
    expect(researchSheetModel(at(last, last)).header.nextAgeName).toBeNull();
  });
  it('the top bar carries the player\'s age with the year label', () => {
    const m = topBarModel(at('classical', 'bronze'));
    expect(m.age.id).toBe('classical');
    expect(m.age.name).toBeTruthy();
    expect(m.age.nextName).toBeTruthy();
    expect(typeof m.year).toBe('string');
  });
  it('the turn report names a new age only when the player\'s own age rose', () => {
    const before = at('bronze', 'bronze');
    const grew = { ...before, turnNumber: before.turnNumber + 1, techAgeId: 'classical' };
    const titles = (m) => (m?.items || []).map((i) => i.title).join('|');
    expect(titles(turnReportModel(before, grew))).toMatch(/Classical/);
    const stayed = { ...before, turnNumber: before.turnNumber + 1 };
    expect(titles(turnReportModel(before, stayed))).not.toMatch(/enter the/);
    // the world age field is not read at all
    expect(titles(turnReportModel(before, { ...stayed, age: 'gunpowder' }))).not.toMatch(/enter the/);
  });
});

describe('strings exist in English and Hebrew', () => {
  const keys = ['p2.th.header', 'p2.th.next', 'p2.pp.age.ahead', 'p2.pp.age.equal', 'p2.pp.age.behind', 'topbar.ageTip', 'topbar.ageLast', 'report.newAge'];
  it.each(keys)('%s', (k) => {
    ['en', 'he'].forEach((lang) => {
      const text = translate(k, { age: 'A', next: 'N', name: 'N', n: 2, known: 1, total: 10 }, lang);
      expect(text).not.toBe(k);
      expect(text).not.toMatch(/\{[a-z]+\}/);
      expect(text).not.toMatch(/\u2014/);
    });
  });
  it('the old calendar string is gone', () => {
    expect(translate('p2.th.ahead', null, 'en')).toBe('p2.th.ahead');
  });
});

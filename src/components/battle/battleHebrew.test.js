// src/components/battle/battleHebrew.test.js
// Phase H5: the battle screens' text builders write Hebrew with no English left in it.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { setCurrentLanguage, tableOf } from '../../i18n/core';
import { coachSteps, deployHelp, cameraHelp } from './battleCoach';
import { armyTallyText, nextAlerts, refusedText } from './battleHudModel';
import { describeOutcome, verificationNotice, FATE_VIEW } from './battleReportView';
import { resultOf, REPORT_FILTERS } from './battleReportsModel';
import { auxiliaryText, battleTypeText, abilityLabel, powerLabel, ecoLabel } from './battleText';
import { describeAttackBlock } from '../../utils/attackAvailability';
import { PLACEMENT_REASON } from '../../battle/input/placement';
import { arrivalNote } from '../../battle/input/orderFeedback';
import { SCOUT_BANDS } from './battleReportView';
import { POWERS, ABILITIES } from '../../battle/sim/effects';

const LATIN = /[A-Za-z]{2,}/;

describe('battle text in Hebrew', () => {
  beforeEach(() => { setCurrentLanguage('he'); });
  afterEach(() => { setCurrentLanguage('en'); });

  it('the coach, the deploy card and the camera line', () => {
    [true, false].forEach((mouse) => {
      coachSteps(mouse).forEach((s) => { expect(s.title).not.toMatch(LATIN); expect(s.text.replace(/Alt/g, '')).not.toMatch(LATIN); });
      expect(deployHelp(mouse)).not.toMatch(LATIN);
      expect(cameraHelp(mouse).replace(/Alt/g, '')).not.toMatch(LATIN);
    });
  });

  it('the tally, the refusal and the alerts', () => {
    expect(armyTallyText({ field: 4, killed: 1, routed: 2, withdrew: 0, arriving: 1, out: 0 })).not.toMatch(LATIN);
    expect(refusedText({ full: true })).not.toMatch(LATIN);
    expect(refusedText({ count: 3 })).not.toMatch(LATIN);
    const sq = (over) => ({ side: 1, classId: 'infantry', ageId: 'bronze', alive: true, routed: false, onField: true, visible: true, strength: 100, maxStrength: 100, morale: 80, x: 0, y: 0, idx: 0, ...over });
    const prev = { tick: 1, structures: [], squads: [sq({}), sq({ side: 0, classId: 'worker', idx: 1 })] };
    const cur = { tick: 2, structures: [], squads: [sq({ routed: true }), sq({ side: 0, classId: 'worker', idx: 1, strength: 5 })] };
    const alerts = nextAlerts(prev, cur, 0, {}, {});
    expect(alerts.length).toBeGreaterThan(0);
    alerts.forEach((a) => { expect(a.title).not.toMatch(LATIN); expect(a.detail).not.toMatch(LATIN); });
  });

  it('report outcomes, results, fates and filters', () => {
    const entry = { outcome: 'attacker', playerSide: 'attacker', kind: 'siege', captured: true, targetRegionId: null };
    expect(describeOutcome(entry).text).not.toMatch(LATIN);
    expect(describeOutcome({ ...entry, kind: 'field' }).text).not.toMatch(LATIN);
    expect(describeOutcome({ ...entry, outcome: 'defender' }).text).not.toMatch(LATIN);
    expect(describeOutcome({ ...entry, kind: 'raid', playerSide: 'defender', outcome: 'defender' }).text).not.toMatch(LATIN);
    expect(resultOf(entry).label).not.toMatch(LATIN);
    expect(verificationNotice({ verification: 'desync', breaches: [{ kind: 'missing' }, { kind: 'x' }] })).not.toMatch(LATIN);
    Object.values(FATE_VIEW).forEach((f) => expect(f.text).not.toMatch(LATIN));
    REPORT_FILTERS.forEach((f) => expect(f.label).not.toMatch(LATIN));
    expect(auxiliaryText({ squads: 2, standing: 1 })).not.toMatch(LATIN);
    SCOUT_BANDS.forEach((b) => { expect(b.label).not.toMatch(LATIN); expect(b.hint).not.toMatch(LATIN); });
  });

  it('data names: battle types, abilities, powers and the economy', () => {
    ['field', 'river', 'ambush', 'assault', 'sally', 'landing', 'raid', 'sack', 'naval'].forEach((type) => {
      ['label', 'attacker', 'defender'].forEach((f) => expect(battleTypeText(type, f)).not.toMatch(LATIN));
    });
    expect(abilityLabel('charge')).not.toMatch(LATIN);
    expect(powerLabel('arrowStorm')).not.toMatch(LATIN);
    Object.keys(POWERS).forEach((id) => expect(powerLabel(id)).not.toMatch(LATIN));
    Object.keys(ABILITIES).forEach((id) => expect(abilityLabel(id)).not.toMatch(LATIN));
    // the screens name abilities and powers only through abilityLabel / powerLabel (the radial once read ABILITIES' English)
    ['TacticalBattleScreen.jsx', 'BattleHud.jsx'].forEach((f) => expect(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'), f).not.toMatch(/\b(ABILITIES|POWERS)\b/));
    ['camp', 'hall', 'house', 'barracks', 'range', 'stable', 'tower'].forEach((id) => ['bronze', 'modern'].forEach((age) => expect(ecoLabel(id, age)).not.toMatch(LATIN)));
  });

  it('refusals, placement reasons and order notes', () => {
    expect(describeAttackBlock({ ok: false, reason: 'no_moves' })).not.toMatch(LATIN);
    expect(describeAttackBlock({ ok: false, reason: 'weird' })).not.toMatch(LATIN);
    Object.keys(PLACEMENT_REASON).forEach((k) => expect(PLACEMENT_REASON[k]).not.toMatch(LATIN));
    expect(arrivalNote(['cavalry', 'infantry'], 'attack')).not.toMatch(LATIN);
    expect(arrivalNote(['cavalry', 'infantry'], 'move')).not.toMatch(LATIN);
  });

  it('every battle key has a Hebrew text', () => {
    const he = tableOf('he');
    const missing = Object.keys(tableOf('en')).filter((k) => /^(bt|nc|ns|op|ind|td|onb|rc|tc|fx|fxb|cp|rz|st|ri)\./.test(k) && he[k] === undefined && !k.endsWith('.one') && !k.endsWith('.two'));
    expect(missing).toEqual([]);
  });
});

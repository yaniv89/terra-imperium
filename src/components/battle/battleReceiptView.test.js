// src/components/battle/battleReceiptView.test.js
// Playtest audit CB02, the words on the screens: accurate headlines for raids, sacks and field
// battles (I006), a one-round Auto battle as a summary (I016), the notice when the campaign's
// count differs, the refused-orders message, men counted once (X05), no "50% rule" text (I210),
// and troops trained in a battle marked temporary before the player pays (I015).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { describeOutcome, verificationNotice } from './battleReportView';
import { reportDetail, resultOf } from './battleReportsModel';
import { refusedText } from './battleHudModel';
import BattleResultScreen from './BattleResultScreen';
import BattleReportSheet from './BattleReportSheet';
import BattleReplay from './BattleReplay';
import { BuildingActions } from './EconomyHud';

const game = vi.hoisted(() => ({ state: { nations: { fr: { name: 'France' }, de: { name: 'Germany' } } } }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));

const entry = {
  id: 'battle-1', turn: 3, year: -1990, kind: 'land', commanded: false, targetRegionId: null,
  attackerNationId: 'fr', defenderNationId: 'de', playerSide: 'attacker', outcome: 'attacker', captured: true,
  timeline: [{ round: 0, att: 2000, def: 900 }, { round: 1, att: 1900, def: 300, defBroken: true }], rounds: 1,
  sides: { attacker: [{ id: 'a', classId: 'infantry', before: 2000, after: 1900, routed: false, fate: 'held' }], defender: [{ id: 'd', classId: 'infantry', before: 900, after: 300, routed: true, fate: 'runDown' }] },
  fallen: { attacker: 1000, defender: 9000 }, fled: { attacker: 0, defender: 0 }
};

describe('headlines say what happened (I006)', () => {
  it('a sack or a raid is driven off or gets through: never "held", never walls', () => {
    const sack = { ...entry, kind: 'sack', playerSide: 'defender', captured: false };
    expect(describeOutcome({ ...sack, outcome: 'attacker' })).toMatchObject({ tone: 'loss' });
    expect(describeOutcome({ ...sack, outcome: 'attacker' }).text).toMatch(/sacked: the raiders got away with the loot$/);
    expect(describeOutcome({ ...sack, outcome: 'attacker' }).text).not.toMatch(/held|walls/);
    expect(describeOutcome({ ...sack, outcome: 'defender' }).text).toMatch(/^Raiders driven off at/);
    expect(resultOf({ ...sack, outcome: 'attacker' })).toEqual({ label: 'Sacked', tone: 'loss' });
    expect(resultOf({ ...sack, kind: 'raid', outcome: 'attacker' })).toEqual({ label: 'Raided', tone: 'loss' });
    expect(resultOf({ ...sack, outcome: 'defender' })).toEqual({ label: 'Driven off', tone: 'win' });
    expect(describeOutcome({ ...sack, kind: 'raid', outcome: 'attacker' }).text).toMatch(/^Raiders got through near/);
  });

  it('a field battle takes no city, and a defence that lost ground claims no wall damage', () => {
    expect(describeOutcome({ ...entry, kind: 'field', captured: false }).text).toMatch(/^Victory in the field near/);
    expect(describeOutcome({ ...entry, kind: 'field', captured: false, outcome: 'defender' }).text).toMatch(/^Defeat in the field near/);
    expect(describeOutcome({ ...entry, captured: false }).text).toMatch(/but the city is not yours yet$/);
    const pressed = describeOutcome({ ...entry, playerSide: 'defender', captured: false });
    expect(pressed.text).toMatch(/holds on, but the enemy gained ground$/);
    expect(pressed.text).not.toMatch(/walls/);
  });
});

describe('the report is the receipt', () => {
  it('a one-round Auto battle is a summary, with its replay still there (I016)', () => {
    const d = reportDetail(game.state, entry);
    expect(d).toMatchObject({ oneRound: true, canReplay: true });
    expect(reportDetail(game.state, { ...entry, rounds: 3 }).oneRound).toBe(false);
    expect(reportDetail(game.state, { ...entry, commanded: true }).oneRound).toBe(false);
    const sheet = renderToStaticMarkup(React.createElement(BattleReportSheet, { entry, onClose: vi.fn(), onReplay: vi.fn() }));
    expect(sheet).toContain('Decided in one round: these numbers are the whole battle.');
    expect(sheet).toContain('View replay');
    const replay = renderToStaticMarkup(React.createElement(BattleReplay, { entries: [entry], onOpen: vi.fn(), onClose: vi.fn() }));
    expect(replay).toContain('Decided in one round');
    expect(replay).toContain('data-testid="battle-replay-result"'); // the result at once, no playback to sit through
    expect(replay).toContain('19,000 men');
  });

  it('shows the line the campaign logged, the temporary troops and how a commanded battle was checked', () => {
    const e = { ...entry, commanded: true, line: 'Your invasion on Kerma was repelled.', verification: 'desync', aux: { attacker: { squads: 2, standing: 1, workersLost: 0 }, defender: null }, breaches: [{ id: 'a2', kind: 'missing' }] };
    const d = reportDetail(game.state, e);
    expect(d.line).toBe('Your invasion on Kerma was repelled.');
    expect(d.aux).toEqual(['Your auxiliaries trained in the battle: 2 squads, 1 standing at the end. Temporary: they leave after the battle.']);
    expect(d.notice).toMatch(/This result is the one that counts\. 1 regiment was missing from the battle's record and counts as lost\./);
    const sheet = renderToStaticMarkup(React.createElement(BattleReportSheet, { entry: e, onClose: vi.fn(), onReplay: vi.fn() }));
    expect(sheet).toContain('data-testid="battle-report-line"');
    expect(sheet).toContain('data-testid="battle-report-aux"');
    expect(sheet).toContain('data-testid="battle-report-notice"');
    expect(verificationNotice({ ...entry, verification: 'verified' })).toBeNull();
    expect(verificationNotice(entry)).toBeNull();
    expect(verificationNotice({ verification: 'version' })).toMatch(/older rules/);
    expect(verificationNotice({ breaches: [{ id: 'x', kind: 'retained' }] })).toMatch(/does not match the map/);
  });
});

describe('the result screen', () => {
  const setup = {
    battleType: 'assault', city: {},
    sides: [{ ageId: 'bronze', units: [{ id: 'a', strength: 1000 }] }, { ageId: 'bronze', units: [{ id: 'd', strength: 900 }] }],
    structures: [{ kind: 'keep' }, { kind: 'house', manifestId: 'h0' }, { kind: 'house', manifestId: 'h1' }]
  };
  const ended = { result: {
    outcome: 'attacker', attackerUnits: [{ id: 'a', classId: 'infantry', strength: 700, xp: 0 }], defenderUnits: [{ id: 'd', classId: 'infantry', strength: 0 }],
    report: { deployedAttackerIds: ['a'], tactical: { reason: 'defendersBroken', durationSec: 300, cityDamage: { destroyed: ['h0'], damaged: [] }, economy: [{ workersLost: 0, looted: 30, trained: { infantry: 1 }, auxiliariesStanding: { infantry: 1 } }, { workersLost: 0, looted: 0 }] } }
  } };
  const html = (props) => renderToStaticMarkup(React.createElement(BattleResultScreen, { ended, setup, playerSide: 0, title: 'Siege of Kerma', onContinue: vi.fn(), ...props }));

  it('counts men as the report does, never mentions the 50% rule, and calls battle loot what it is', () => {
    const h = html();
    expect(h).toContain('data-result-state="preview"');
    expect(h).toContain('3,000 lost of 10,000'); // 300 strength lost of 1,000: men, as in the report and the Log
    expect(h).not.toContain('50%');
    expect(h).not.toMatch(/at most \d+ can be lost/i);
    expect(h).toContain('Houses ruined 1 of 2. Repairs are free over a few turns.');
    expect(h).toContain('looted and spent inside the battle');
    expect(h).not.toContain('GOLD <span');
    expect(h).toContain('Temporary: they leave after the battle.');
  });

  it('while the campaign counts: no numbers and no Continue; a battle that changed nothing says so', () => {
    const waiting = html({ receipt: { pending: true } });
    expect(waiting).toContain('data-result-state="pending"');
    expect(waiting).toContain('Counting the result with the campaign.');
    expect(waiting).not.toContain('data-testid="battle-result-losses"');
    expect(waiting).toMatch(/<button[^>]*disabled=""[^>]*data-testid="battle-continue"|<button[^>]*data-testid="battle-continue"[^>]*disabled=""/);
    const nothing = html({ receipt: { applied: false, voidLine: 'The battle at Kerma changed nothing: peace was made before it ended.' } });
    expect(nothing).toContain('No effect');
    expect(nothing).toContain('peace was made before it ended');
    expect(nothing).not.toContain('data-testid="battle-result-losses"');
    const failed = html({ receipt: { failed: true } });
    expect(failed).toContain('data-testid="battle-result-notice"');
    expect(failed).toContain('data-testid="battle-result-losses"');
  });

  it('with the receipt it shows the campaign verdict, not the screen\'s own: a "win" the campaign counted as repelled reads Repelled', () => {
    const repelled = { ...entry, id: 'battle-9', commanded: true, kind: 'land', outcome: 'defender', captured: false, line: 'Your invasion on Kerma was repelled.', verification: 'desync' };
    const receipt = {
      applied: true, entry: repelled, line: repelled.line, lines: [], cityLine: null, xp: [], generals: [{ id: 'g', name: 'Sargon', fate: 'fell' }], goldGained: 0, city: { taken: false, control: 100 },
      ledger: { mineKey: 'attacker', theirsKey: 'defender', mine: { units: 1, before: 1000, after: 0, fallen: 400, fled: 600, runDown: 0, destroyed: 0 }, theirs: { units: 1, before: 900, after: 800, fallen: 100, fled: 0, runDown: 0, destroyed: 0 }, aux: null, theirAux: null, breaches: [] }
    };
    const h = html({ receipt });
    expect(ended.result.outcome).toBe('attacker'); // what the live battle said
    expect(h).toContain('data-result-state="committed"');
    expect(h).toMatch(/data-testid="battle-verdict">Repelled</);
    expect(h).toContain('Your invasion on Kerma was repelled.');
    expect(h).toContain('4,000 lost of 10,000');
    expect(h).toContain('6,000 men fled the field and live');
    expect(h).toContain('Sargon fell with the regiment.');
    expect(h).toContain('This result is the one that counts');
    expect(h).toContain('The city took no lasting damage.');
  });
});

describe('small honest words', () => {
  it('refused orders are told', () => {
    expect(refusedText({ count: 1 })).toBe('That order was not taken by the battle. Please try again.');
    expect(refusedText({ count: 3 })).toMatch(/^3 orders were not taken/);
    expect(refusedText({ count: 1, full: true })).toMatch(/order log is full/);
  });

  it('troops trained in a battle are marked temporary before the player pays; laborers are not troops (I015)', () => {
    const props = { ageId: 'bronze', stock: [500, 500, 500], onTrain: vi.fn(), onCancel: vi.fn(), onRally: vi.fn(), onBuildHouse: vi.fn() };
    const barracks = renderToStaticMarkup(React.createElement(BuildingActions, { ...props, building: { type: 'barracks', built: true, queue: [] } }));
    expect(barracks).toContain('data-testid="battle-train-temporary"');
    expect(barracks).toContain('Temporary: they leave after the battle');
    const camp = renderToStaticMarkup(React.createElement(BuildingActions, { ...props, building: { type: 'camp', built: true, queue: [] } }));
    if (camp) expect(camp).not.toContain('data-testid="battle-train-temporary"');
  });
});

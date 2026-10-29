// src/engine/battleLedger.test.js
// The participant ledger (playtest audit CB02): per side before = after + fallen + fled, the check
// against the committed map (a destroyed regiment left standing, a survivor made whole, a unit
// missing from the result), one conversion of strength to men, and the temporary troops.
import { describe, expect, it } from 'vitest';
import { auxiliariesOf, auxiliaryLine, checkLedger, conserved, countText, ledgerOf, menOf, menText, sideTotals, unitMenOf, SCOUT_PARTY_MEN } from './battleLedger';
import { MEN_PER_STRENGTH } from './aftermath';
import { recordBattleReport } from './battleReports';

const row = (id, before, after, o = {}) => ({ id, classId: 'infantry', before, after, routed: false, fate: after > 0 ? 'held' : 'fellFighting', ...o });

describe('battle ledger', () => {
  it('one conversion from strength to men', () => {
    expect(menOf(487.6)).toBe(Math.round(487.6 * MEN_PER_STRENGTH));
    expect(menOf(-5)).toBe(0);
    expect(menText(4876)).toBe('48,760');
    expect(countText(48760)).toBe('48,760');
  });

  it('a side: before = after + fallen + fled; the run down are fallen, the fled live', () => {
    const rows = [
      row('a', 1000, 700), // held, lost 300
      row('b', 1000, 0), // destroyed
      row('c', 1000, 400, { routed: true, fate: 'escaped' }), // fled with 400
      row('d', 1000, 250, { routed: true, fate: 'runDown' }) // lived the fight, caught after
    ];
    const t = sideTotals(rows);
    expect(t).toEqual({ units: 4, before: 4000, after: 700, fallen: 300 + 1000 + 600 + 750 + 250, fled: 400, runDown: 250, destroyed: 2, men: { before: menOf(4000), after: menOf(700), fallen: menOf(2900), fled: menOf(400), runDown: menOf(250) } });
    expect(conserved(t)).toBe(true);
    expect(conserved({ ...t, after: t.after + 1 })).toBe(false);
  });

  it('a row that ends above its start is clamped in the totals and reported as a breach', () => {
    const rows = { attacker: [row('a', 500, 800)], defender: [] };
    expect(conserved(sideTotals(rows.attacker))).toBe(true);
    expect(checkLedger({ rows })).toEqual([{ id: 'a', kind: 'gained', ledger: 500, map: 800 }]);
  });

  it('the ledger against the map: retained, strength, duplicate and missing are breaches; battle-only troops are not checked', () => {
    const rows = {
      attacker: [row('a', 1000, 0), row('b', 1000, 355), row('c', 1000, 600), row('c', 1000, 600), row('m', 300, 100, { temp: 'militia' })],
      defender: [row('d', 800, 200, { routed: true, fate: 'runDown' })]
    };
    const before = { a: { strength: 1000 }, b: { strength: 1000 }, c: { strength: 1000 }, d: { strength: 800 } };
    const sound = { b: { strength: 355 }, c: { strength: 600 } };
    expect(checkLedger({ rows: { ...rows, attacker: rows.attacker.filter((_, i) => i !== 3) }, before, after: sound })).toEqual([]);
    const ghost = { a: { strength: 1000 }, b: { strength: 1000 }, c: { strength: 600 }, d: { strength: 200 } };
    expect(checkLedger({ rows, before, after: ghost, missing: ['z'] })).toEqual([
      { id: 'z', kind: 'missing' },
      { id: 'a', kind: 'retained', ledger: 0, map: 1000 }, // the dead regiment that stood on the map
      { id: 'b', kind: 'strength', ledger: 355, map: 1000 }, // the ghost cavalry: 355 in the battle, 1,000 on the map
      { id: 'c', kind: 'duplicate' },
      { id: 'd', kind: 'retained', ledger: 0, map: 200 }
    ]);
  });

  it('a report entry carries the ledger: fallen and fled are its sums in men, breaches are kept, old entries still read', () => {
    const state = { playerNationId: 'fr', turnNumber: 4, year: -2000, units: { a: { strength: 1000 }, b: { strength: 1000 } }, battleReports: [] };
    const attackers = [{ id: 'a', classId: 'infantry', strength: 400, routed: true, disposition: 'field' }, { id: 'b', classId: 'cavalry', strength: 900, routed: true, disposition: 'fled' }];
    const defenders = [{ id: 'm', classId: 'infantry', strength: 50, militia: true }];
    const out = recordBattleReport(state, { outcome: 'defender', kind: 'field', attackerNationId: 'fr', defenderNationId: 'be', opId: 'op1', line: 'thrown back' }, {
      attackers, defenders, beforeOf: (u) => state.units[u.id]?.strength ?? 200, goneIds: new Set(['a']),
      breaches: (rows) => checkLedger({ rows, before: state.units, after: { b: { strength: 1000 } } })
    });
    const entry = out.battleReports[0];
    expect(entry).toMatchObject({ opId: 'op1', line: 'thrown back', playerSide: 'attacker' });
    expect(entry.sides.attacker.map((u) => u.fate)).toEqual(['runDown', 'escaped']);
    expect(entry.sides.defender[0].temp).toBe('militia');
    // a (1,000): 600 killed and 400 caught; b (1,000): 100 killed, 900 fled and live
    expect(entry.fallen.attacker).toBe(menOf(1100));
    expect(entry.fled.attacker).toBe(menOf(900));
    expect(entry.breaches).toEqual([{ id: 'b', kind: 'strength', ledger: 900, map: 1000 }]);
    const l = ledgerOf(entry);
    expect(l.mine).toMatchObject({ before: 2000, fallen: 1100, fled: 900, after: 0, destroyed: 1 });
    expect(l.conserved).toBe(false); // a breach is never "conserved"
    // an entry saved before the ledger: rows with before, after and routed only
    const old = { playerSide: 'defender', sides: { attacker: [{ id: 'x', before: 500, after: 0 }], defender: [{ id: 'y', before: 300, after: 120, routed: true }] } };
    expect(ledgerOf(old)).toMatchObject({ mine: { before: 300, fallen: 180, fled: 120 }, theirs: { before: 500, fallen: 500, destroyed: 1 }, conserved: true });
  });

  it('the troops trained for the battle are temporary: a commanded economy report, an Auto report, or none', () => {
    const commanded = auxiliariesOf({ tactical: { economy: [{ trained: { infantry: 2, worker: 3, ranged: 1 }, auxiliariesStanding: { infantry: 1 }, workersLost: 2 }, { trained: {}, auxiliariesStanding: {}, workersLost: 0 }] } });
    expect(commanded).toEqual({ attacker: { squads: 3, standing: 1, workersLost: 2 }, defender: null });
    expect(auxiliaryLine(commanded.attacker)).toBe('Your auxiliaries trained in the battle: 3 squads, 1 standing at the end. Temporary: they leave after the battle.');
    const auto = auxiliariesOf({ auxiliaries: [{ fielded: 400, standing: 150 }, { fielded: 0, standing: 0 }] });
    expect(auto).toEqual({ attacker: { strength: 400, standing: 150 }, defender: null });
    expect(auxiliaryLine(auto.attacker, { yours: false })).toMatch(/^Their auxiliaries raised for the battle: 4,000 men, 1,500 standing at the end\. Temporary/);
    expect(auxiliariesOf({})).toBeNull();
    expect(auxiliaryLine(null)).toBeNull();
  });
});

describe('men of a unit', () => {
  it('counts a regiment by its strength and a scout party by its few riders', () => {
    expect(unitMenOf({ strength: 1000 })).toBe(menOf(1000));
    expect(unitMenOf({ explorer: true, strength: 300, maxStrength: 300 })).toBe(SCOUT_PARTY_MEN);
    expect(unitMenOf({ explorer: true, strength: 150, maxStrength: 300 })).toBe(SCOUT_PARTY_MEN / 2);
  });
});

describe('a scout party in a battle', () => {
  it('counts the same men in the ledger as on its banner, and the men balance', () => {
    const scout = { id: 's', classId: 'support', explorer: true, strength: 300, maxStrength: 300, ownerId: 'fr' };
    const state = { playerNationId: 'fr', turnNumber: 4, year: -2000, units: { s: scout }, battleReports: [] };
    const out = recordBattleReport(state, { outcome: 'attacker', kind: 'field', attackerNationId: 'be', defenderNationId: 'fr', opId: 'op2' }, {
      attackers: [], defenders: [{ ...scout, strength: 120, routed: true, disposition: 'fled' }]
    });
    const entry = out.battleReports[0];
    const { mine } = ledgerOf(entry);
    expect(mine.men.before).toBe(unitMenOf(scout)); // the banner's count (mapMarkers.js men)
    expect(mine.men.before).toBe(SCOUT_PARTY_MEN);
    expect(mine.men.before).toBe(mine.men.after + mine.men.fallen + mine.men.fled);
    expect(entry.fallen.defender + entry.fled.defender).toBe(SCOUT_PARTY_MEN);
  });
});

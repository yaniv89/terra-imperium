// src/components/battle/battleCardModel.test.js
// U22: every campaign input with an effect has a row, with the setup's own number; no fact, no row.
import { describe, expect, it } from 'vitest';
import { battleCardRows } from './battleCardModel';
import { menText } from '../../engine/battleLedger';

const sector = (river = false) => ({ river, water: false });
const base = (over = {}) => ({
  campaign: { ground: { terrain: 'plains', sectors: [sector(), sector()], walls: 0, hpRatio: 1 }, inputs: { supply: [1, 1], development: [0, 0], conditions: { starved: false, plague: false, militia: 0 } } },
  sides: [{ reinforcements: [] }, { reinforcements: [] }],
  ...over
});
const ids = (rows) => rows.map((r) => r.id);

describe('U22 battleCardRows', () => {
  it('a plain battle has only the ground row', () => {
    expect(ids(battleCardRows(base()))).toEqual(['ground']);
  });

  it('each input with an effect has a row carrying the setup number', () => {
    const setup = base({
      campaign: { ground: { terrain: 'hills', sectors: [sector(true), sector(true), sector()], walls: 2, hpRatio: 0.6 }, inputs: { supply: [0.7, 0.4], conditions: { starved: true, plague: true, militia: 400 } } },
      sides: [{ reinforcements: [{ units: [{ strength: 100 }, { strength: 50 }] }] }, { reinforcements: [] }]
    });
    const rows = battleCardRows(setup, 1);
    expect(ids(rows)).toEqual(['ground', 'river', 'walls', 'supply-you', 'supply-foe', 'starved', 'plague', 'militia', 'reinforce-foe']);
    const text = (id) => rows.find((r) => r.id === id).text;
    expect(text('river')).toContain('2');
    expect(text('walls')).toContain('60%');
    expect(text('supply-you')).toContain('40%'); // the player is the defender: side 1
    expect(text('supply-foe')).toContain('70%');
    expect(text('militia')).toContain(menText(400));
    // the same battle seen from the attacker's seat: the reinforcements are the player's
    expect(battleCardRows(setup, 0).find((r) => r.id === 'reinforce-you').text).toContain(menText(150));
  });

  it('a setup without inputs or ground gives no rows and never throws', () => {
    expect(battleCardRows(null)).toEqual([]);
    expect(battleCardRows({ sides: [] })).toEqual([]);
  });
});

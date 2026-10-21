// src/components/battle/battleCardModel.js
// U22: why this battle differs, said before the troops deploy. Pure over the built battle setup: the
// ground (tileContext.js), the walls' HP, and the campaign facts battleInputs.js put on
// `setup.campaign` (supply, starvation, plague, the militia), plus each side's reinforcements. It
// has no numbers of its own: every figure is read off the setup the battle itself runs on, and a
// fact with no effect (full supply, no plague, no river) has no row.
import { t } from '../../i18n/core';
import { terrainWord } from '../../i18n/gameText';
import { menText } from '../../engine/battleLedger';

const pct = (v) => `${Math.round(v * 100)}`;
const sumStrength = (list = []) => list.reduce((n, u) => n + (u.strength || 0), 0);

/** [{ id, tone: 'good' | 'bad' | 'plain', text }] for the player's side `playerSide` (0 attacker, 1 defender). */
export const battleCardRows = (setup, playerSide = 0) => {
  if (!setup) return [];
  const mine = playerSide; const foe = 1 - playerSide;
  const rows = [];
  const ctx = setup.campaign?.ground;
  const ins = setup.campaign?.inputs || {};
  const cond = ins.conditions || {};
  const sides = setup.sides || [];
  const push = (id, tone, text) => rows.push({ id, tone, text });

  if (ctx) {
    const rivers = ctx.sectors.filter((s) => s.river).length;
    push('ground', 'plain', t('bt.card.ground', { terrain: terrainWord(ctx.terrain) }));
    if (rivers) push('river', 'plain', t('bt.card.river', { n: rivers }));
    if (ctx.walls > 0 && ctx.hpRatio < 1) push('walls', playerSide === 1 ? 'bad' : 'good', t('bt.card.walls', { pct: pct(ctx.hpRatio) }));
  }
  [[mine, 'you'], [foe, 'foe']].forEach(([i, who]) => {
    const supply = ins.supply?.[i];
    if (supply != null && supply < 0.995) push(`supply-${who}`, i === mine ? 'bad' : 'good', t(`bt.card.supply.${who}`, { pct: pct(supply) }));
  });
  const defender = 1; // starvation, plague and the militia are the besieged city's
  if (cond.starved) push('starved', playerSide === defender ? 'bad' : 'good', t('bt.card.starved'));
  if (cond.plague) push('plague', playerSide === defender ? 'bad' : 'good', t('bt.card.plague'));
  if (cond.militia > 0) push('militia', playerSide === defender ? 'good' : 'bad', t('bt.card.militia', { men: menText(cond.militia) }));
  [[mine, 'you'], [foe, 'foe']].forEach(([i, who]) => {
    const men = (sides[i]?.reinforcements || []).reduce((n, r) => n + sumStrength(r.units), 0);
    if (men > 0) push(`reinforce-${who}`, i === mine ? 'good' : 'bad', t(`bt.card.reinforce.${who}`, { men: menText(men) }));
  });
  return rows;
};

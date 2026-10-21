// src/engine/governmentPreview.js
// What changing government really does (playtest audit CB12, I139 to I141). The preview RUNS the
// real reducer on a copy of the state and compares, so it cannot drift from what happens: the -2
// stability, the authority it costs (8 per stability point), the Authority 25 line under which no
// law can be enacted, and the reform package that gets picked for you (the first choice of each
// age tier). Pure. The confirm dialog (GovernmentChangeDialog.jsx) and the card text read this.
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { ACTION_COSTS } from '../data/actionCosts';
import { GOVERNMENT_TYPES, canChangeGovernmentType, getActiveReforms, reformSlotsForType } from '../data/government';
import { AGES } from '../data/ages';
import { ageOf } from './nationState';
import { stonePhaseOf } from './stonePhase';
import { authorityOf, canEnactLaws, AUTHORITY_NO_LAWS } from './authority';
import { canPay } from '../utils/costs';
import { decreesOf } from './decrees';
import { getCostString } from '../utils/helpers';

const snapshot = (state, me) => {
  const nation = state.nations[me];
  const authority = authorityOf(state, me);
  return { stability: nation.stability || 0, authority: authority.total, canEnactLaws: canEnactLaws(state, me), reforms: getActiveReforms(nation).map((r) => r.name) };
};

/**
 * previewGovernmentChange(state, typeId) =>
 *   { ok, reason, typeName, cost, affordable, before, after, stabilityChange, authorityChange,
 *     locksLaws, lawsAlreadyLocked, reformsLost, reformsChosen, lines }
 * `lines` is the plain-English list for the card. `ok` says the rules allow the change (it can
 * still be unaffordable: `affordable`).
 */
export const previewGovernmentChange = (state, typeId, picks = null) => {
  const me = state.playerNationId;
  const nation = state.nations?.[me];
  const type = GOVERNMENT_TYPES[typeId];
  const cost = ACTION_COSTS.changeGovernmentType;
  if (!nation || !type) return { ok: false, reason: 'Unknown government', cost, lines: [] };
  if (!canChangeGovernmentType(nation, typeId, ageOf(state, state.playerNationId), stonePhaseOf(state, me))) return { ok: false, reason: 'Not available to you yet', typeName: type.name, cost, lines: [] };

  const affordable = canPay(state, cost);
  // Run the real action with the decrees covered, so the preview works even when it is not affordable yet.
  const funded = nation.ruler ? { ...state, nations: { ...state.nations, [me]: { ...nation, ruler: { ...nation.ruler, decrees: Math.max(decreesOf(nation), cost.decrees) } } } } : state;
  const next = gameReducer(funded, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId, reforms: picks || undefined } });
  if (next === funded) return { ok: false, reason: 'The change is not allowed', typeName: type.name, cost, lines: [] };

  const before = snapshot(state, me);
  const after = snapshot(next, me);
  const stabilityChange = after.stability - before.stability;
  const authorityChange = after.authority - before.authority;
  const locksLaws = before.canEnactLaws && !after.canEnactLaws;
  const lines = [];
  lines.push(`Costs ${getCostString(cost)}.`);
  if (stabilityChange) lines.push(`Stability ${stabilityChange > 0 ? '+' : ''}${stabilityChange} (to ${after.stability}).`);
  if (authorityChange) lines.push(`Authority ${before.authority} to ${after.authority}.`);
  if (locksLaws) lines.push(`Authority falls under ${AUTHORITY_NO_LAWS}: you cannot enact laws until it recovers.`);
  else if (!after.canEnactLaws) lines.push(`Authority stays under ${AUTHORITY_NO_LAWS}: laws stay locked.`);
  if (after.reforms.length) lines.push(`Reforms for the new government (you choose): ${after.reforms.join(', ')}.`);
  if (before.reforms.length) lines.push(`You lose: ${before.reforms.join(', ')}.`);
  const chosenIds = next.nations[me].government?.reforms || {};
  const reformSlots = reformSlotsForType(typeId, ageOf(state, state.playerNationId)).map((slot) => ({ ageId: slot.ageId, ageName: AGES[slot.ageId]?.name || slot.ageId, options: slot.options, chosen: chosenIds[slot.ageId] || slot.options[0].id }));
  return { ok: true, affordable, reason: null, typeName: type.name, cost, before, after, stabilityChange, authorityChange, locksLaws, lawsAlreadyLocked: !before.canEnactLaws, reformsLost: before.reforms, reformsChosen: after.reforms, reformSlots, lines };
};

// src/components/ui/confirmSpecs.js
// What the two-step confirm card (ConfirmActionDialog.jsx) shows before a costly one-tap action
// happens (mobile audit H-08): declaring war and changing a law. Like the government change, the
// war preview RUNS the real reducer on a copy, so the opinion hit it names is the one that lands.
// Pure: each builder returns { title, rows, notes, confirmLabel } or null when the action is not allowed.
import { gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { opinionOf } from '../../engine/opinion';
import { getLaw } from '../../data/laws';
import { declareWarModel } from '../panels/warActions';
import { costLine, lawEffectText } from '../panels/empireText';
import { lawName, lawLine } from '../../i18n/gameText';
import { t, dataText } from '../../i18n/core';
import { VIRTUES } from '../../data/rulerVirtues';
import { rulerPoints, virtueBlock } from '../../engine/rulers';
import { ACTION_COSTS } from '../../data/actionCosts';
import { tradeRouteStatus } from '../../engine/tradeDisruptions';
import { getTradePactCapacity } from '../../engine/diplomacy';
import { msgRefText } from '../battle/battleText';

/** Their opinion of you before and after the war, from the real reducer on a funded copy. */
export const warOpinionHit = (state, nationId, costs) => {
  const before = opinionOf(state, nationId);
  const me = state.playerNationId;
  const met = state.fog ? { fog: { ...state.fog, met: { ...state.fog.met, [me]: { ...(state.fog.met?.[me] || {}), [nationId]: true } } } } : {}; // the card only exists for a people you know
  const funded = { ...state, ...met, resources: { ...state.resources, ...Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, Math.max(state.resources?.[k] || 0, v)])) } };
  const next = gameReducer(funded, { type: ActionTypes.DECLARE_WAR, payload: { nationId } });
  const after = next === funded ? before : opinionOf(next, nationId);
  return { before, after };
};

export const declareWarConfirm = (state, nationId) => {
  const m = declareWarModel(state, nationId);
  if (!m || m.blocked) return null;
  const { before, after } = warOpinionHit(state, nationId, m.costs);
  const notes = [m.justified ? t('cf.war.cause') : t('cf.war.noCause')];
  if (m.breaksTruce) notes.push(t('cf.war.truce'));
  return {
    id: `declare-war:${nationId}`,
    title: t('cf.war.title', { name: m.shown }),
    rows: [
      { label: t('cf.cost'), value: costLine(m.costs), tone: m.affordable ? '' : 'bad' },
      { label: t('cf.war.opinion'), value: t('cf.fromTo', { from: before, to: after }), tone: after < before ? 'bad' : '' }
    ],
    notes,
    confirmLabel: t('cf.war.ok')
  };
};

/** A trade agreement's terms before it is signed (manual playtest 29 Oct: one tap signed it unseen):
 * the price, their opinion and the route as the real reducer on a copy leaves them. */
export const tradeConfirm = (state, nationId, shown) => {
  const next = gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId } });
  if (!next.nations?.[nationId]?.hasTradeAgreement) return null;
  const before = opinionOf(state, nationId);
  const after = opinionOf(next, nationId);
  const route = tradeRouteStatus(next, nationId);
  return {
    id: `trade:${nationId}`,
    title: t('cf.trade.title', { name: shown }),
    rows: [
      { label: t('cf.cost'), value: costLine(ACTION_COSTS.tradeAgreement) },
      { label: t('cf.war.opinion'), value: t('cf.fromTo', { from: before, to: after }) },
      ...(route ? [{ label: t('cf.trade.route'), value: msgRefText(route.textMsg, route.text), tone: route.pays ? '' : 'bad' }] : []),
      { label: t('cf.trade.pacts'), value: t('cf.trade.pactsValue', { a: Object.values(next.nations).filter((n) => n.hasTradeAgreement).length, b: getTradePactCapacity(next.nations[next.playerNationId]) }) }
    ],
    notes: [],
    confirmLabel: t('cf.trade.ok')
  };
};

/** The dock's Buy (endTurnModel.js buyHint): what it costs and leaves, like the city's own buy offer. */
export const buyConfirm = (state, buy, cityLabel) => ({
  id: `buy:${buy.cityId}`,
  title: t('cf.buy.title', { city: cityLabel }),
  rows: [
    { label: t('cf.cost'), value: costLine({ gold: buy.gold }) },
    { label: t('cf.buy.left'), value: costLine({ gold: Math.floor((state.resources?.gold || 0) - buy.gold) }) || '0' },
    { label: t('cf.buy.sooner'), value: t('cf.buy.soonerValue', { turns: buy.turns }) }
  ],
  notes: [],
  confirmLabel: t('cf.buy.ok', { gold: buy.gold })
});

export const changeLawConfirm = (state, category, lawId, cost) => {
  const law = getLaw(category, lawId);
  if (!law) return null;
  const nation = state.nations?.[state.playerNationId];
  const current = getLaw(category, nation?.laws?.[category]);
  return {
    id: `change-law:${category}`,
    title: t('cf.law.title', { law: lawName(law.id, law.name) }),
    rows: [
      { label: t('cf.cost'), value: costLine(cost) || t('p1.dom.lawFree') },
      ...(current ? [{ label: t('cf.law.now'), value: lawName(current.id, current.name) }] : []),
      { label: t('cf.law.after'), value: lawLine(law, lawEffectText(law)) }
    ],
    notes: [],
    confirmLabel: t('cf.law.ok')
  };
};

/** Building an improvement over another (playtest 22 Oct): the old one and its yield go. */
export const replaceImprovementConfirm = (label, old) => ({
  id: `replace-improvement:${label}`,
  title: t('cf.replace.title', { old }),
  rows: [{ label: t('cf.replace.build'), value: label }],
  notes: [t('cf.replace.note', { old })],
  confirmLabel: t('cf.replace.ok')
});

/** Taking a ruler virtue (playtest issue 10): its cost in virtue points, what is left, its drawback. */
export const virtueConfirm = (state, virtueId) => {
  const id = state.playerNationId;
  const virtue = VIRTUES[virtueId];
  if (!virtue || virtueBlock(state, id, virtueId)) return null;
  const have = rulerPoints(state.nations[id].ruler).virtue;
  const name = dataText(`virtue.${virtueId}`, virtue.name);
  return {
    id: `take-virtue:${virtueId}`,
    title: t('cf.virtue.title', { name }),
    rows: [{ label: t('cf.virtue.points'), value: t('cf.virtue.left', { cost: virtue.cost, have, left: have - virtue.cost }) }],
    notes: [...(virtue.drawback ? [t('cf.virtue.drawback', { text: dataText(`virtue.${virtueId}.drawback`, virtue.drawback) })] : []), t('cf.virtue.keep')],
    confirmLabel: t('cf.virtue.ok')
  };
};

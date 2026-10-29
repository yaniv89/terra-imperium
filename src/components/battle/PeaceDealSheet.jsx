// src/components/battle/PeaceDealSheet.jsx
// W13 Peace deal (plans/UI-DESIGN.md; plan M13's OFFER_PEACE). Land you win in battle is already
// yours (src/engine/conquest.js); the table is for what battle did not settle. Three columns:
//   left    the war score from your side and its parts, both sides' war exhaustion, and why they
//           would give what they give (the acceptance ledger, line by line)
//   middle  your demands, tap to add or remove; each says live whether they accept it or how much
//           you are short; the total demanded against what they give, and the verdict
//   right   their counter-offer (the most they would give, "Load into my offer"), a white peace,
//           and the one brass button: Send offer
// Everything comes from peaceDealModel.js, over the engine's own ledger (getPeaceAcceptance).
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { HeartHandshake, Check } from 'lucide-react';
import { rich } from '../../i18n/rich';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { Button, CloseButton, Label, Meter } from '../ui/atlas';
import { peaceDealModel, bestDeal } from './peaceDealModel';
import { useT } from '../../i18n/useT';
import { isolateLtr } from '../../i18n/core';

const signed = (v) => isolateLtr(`${v > 0 ? '+' : ''}${v}`); // Hebrew keeps "+5" and "-5" in order
const toneOf = (v) => (v > 0 ? 'text-fa-good' : v < 0 ? 'text-fa-danger-text' : 'text-fa-muted');

// `onSend(action, why)` (people's card, city card): sends the offer through the card's answer (useAnswer.js), shown on the card.
const PeaceDealSheet = ({ warId, onClose, onSend = null }) => {
  const { state, dispatch } = useGame();
  const { t } = useT();
  const war = state.wars.find((w) => w.id === warId && w.active);
  // Start with the land they would give right now (cheapest first).
  const [selected, setSelected] = useState(() => {
    if (!war) return new Set();
    const best = bestDeal(state, war);
    return new Set(best.keys.filter((k) => k.startsWith('cede:')));
  });
  const m = useMemo(() => peaceDealModel(state, warId, selected), [state, warId, selected]);
  if (!m) return null;

  const toggle = (row) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(row.key)) next.delete(row.key);
    else {
      // one gold sum at a time
      if (row.group === 'gold') [...next].filter((k) => k.startsWith('gold:')).forEach((k) => next.delete(k));
      next.add(row.key);
    }
    return next;
  });
  // `why`: their reason to refuse, said after the answer (onSend only; the log keeps the plain answer).
  const send = (terms, why) => { (onSend || dispatch)({ type: ActionTypes.OFFER_PEACE, payload: { warId, terms } }, why); onClose(); };
  const scoreShare = Math.max(0, Math.min(1, (m.score + 100) / 200));

  // Portalled to <body>: opened from inside the side panel, whose transformed container would
  // otherwise trap this "fixed" sheet under the tab bar.
  return createPortal((
    <div className="fixed inset-0 z-[70] bg-black/55 flex items-end sm:items-center justify-center" onClick={onClose} data-testid="peace-deal">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="peace-title"
        className="fa-panel !bg-fa-panel shadow-2xl w-full sm:w-[min(58rem,calc(100vw-1rem))] max-h-[94dvh] sm:max-h-[calc(100dvh-1rem)] flex flex-col rounded-b-none sm:rounded-[10px]">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-fa-line">
          <HeartHandshake className="w-5 h-5 text-fa-muted shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 flex items-baseline gap-x-3 flex-wrap">
            <h2 id="peace-title" className="fa-heading text-[19px] pl:text-[17px] leading-tight truncate">{t('bt.peace.title', { name: m.enemy.replace(/^The /, 'the ') })}</h2>
            <span className="text-[12px] text-fa-muted">{m.since}</span>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-hidden p-2 grid gap-2 grid-cols-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)_minmax(0,0.95fr)] sm:grid-rows-[minmax(0,1fr)]">
          <div className="space-y-2 min-w-0 sm:overflow-y-auto">
            <div className="fa-card px-2.5 py-1.5" data-testid="peace-score">
              <div className="flex items-baseline justify-between"><Label>{t('bt.peace.warScore')}</Label><span className={`fa-num text-[17px] font-semibold ${m.score >= 0 ? 'text-fa-brass' : 'text-fa-danger-text'}`}>{signed(m.score)}</span></div>
              <div className="relative h-2 mt-1 rounded-full bg-fa-ink border border-fa-line overflow-hidden">
                <span className="absolute inset-y-0" style={{ insetInlineStart: m.score >= 0 ? '50%' : `${scoreShare * 100}%`, width: `${Math.abs(scoreShare - 0.5) * 100}%`, background: m.score >= 0 ? 'var(--fa-you)' : 'var(--fa-enemy)' }} />
                <span className="absolute inset-y-[-2px] start-1/2 w-px bg-fa-text/70" />
              </div>
              <div className="flex justify-between text-[10px] text-fa-muted"><span className="truncate">{m.enemy.replace(/^The /, '')}</span><span className="truncate">{m.me.replace(/^The /, '')}</span></div>
              {m.scoreParts.map((p) => <div key={p.id} className="flex justify-between text-[12px]"><span>{p.label}</span><span className={`fa-num ${toneOf(p.value)}`}>{signed(p.value)}</span></div>)}
            </div>
            <div className="fa-card px-2.5 py-1.5">
              <Label>{t('bt.peace.exhaustion')}</Label>
              {[[t('bt.peace.you'), m.exhaustion.mine, 'var(--fa-you)'], [m.enemy.replace(/^The /, ''), m.exhaustion.theirs, 'var(--fa-enemy)']].map(([who, v, c]) => (
                <div key={who} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-[12px] mt-0.5">
                  <span className="truncate">{who}</span><Meter value={v} max={m.exhaustion.max} color={c} /><span className="fa-num">{v}</span>
                </div>
              ))}
              <div className="text-[11px] text-fa-muted mt-1 leading-snug" data-testid="peace-ledger">{rich(t('bt.peace.theyGive', { list: m.ledger.map((l) => `${l.label.toLowerCase()} ${isolateLtr(signed(l.value))}`).join(', ') || t('bt.peace.nothingToWeigh') }), { n: <b className="fa-num text-fa-text">{m.willingness}</b> })}</div>
            </div>
          </div>

          <div className="min-w-0 flex flex-col min-h-0">
            <div className="flex justify-between items-baseline px-0.5"><Label>{t('bt.peace.yourDemands')}</Label><span className="text-[11px] text-fa-muted">{t('bt.peace.tapAddRemove')}</span></div>
            <div className="flex-1 min-h-0 sm:overflow-y-auto space-y-1.5 mt-1">
              {m.rows.length === 0 && <div className="text-[12px] text-fa-muted">{t('bt.peace.nothingToDemand')}</div>}
              {m.rows.map((r) => (
                <button key={r.key} type="button" aria-pressed={r.on} onClick={() => toggle(r)} data-testid={r.group === 'land' ? 'peace-cede' : `peace-term-${r.group}`}
                  className={`w-full text-start fa-option px-2 py-1 min-h-[44px] flex items-center gap-2 ${r.on ? 'fa-selected' : ''}`}>
                  <span className={`w-5 h-5 rounded border shrink-0 grid place-items-center ${r.on ? 'bg-fa-text border-fa-text' : 'border-fa-line'}`}>{r.on && <Check className="w-3.5 h-3.5 text-fa-ink" aria-hidden="true" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2"><span className="text-[13px] font-semibold truncate">{r.label}</span><span className="text-[12px] shrink-0">{t('bt.peace.scorePts', { n: r.cost })}</span></span>
                    <span className="flex justify-between gap-2 text-[11px]"><span className="text-fa-muted truncate">{r.detail}</span><span className={`shrink-0 ${r.ok ? 'text-fa-good' : 'text-fa-danger-text'}`}>{r.status}</span></span>
                  </span>
                </button>
              ))}
            </div>
            <div className="fa-card px-2.5 py-1.5 mt-1.5" data-testid="peace-demanded">
              <div className="flex justify-between items-baseline text-[12px]">
                <span><span className="fa-label">{t('bt.peace.demanded')}</span> <b className="fa-num">{m.demanded}</b> <span className="text-fa-muted">{t('bt.peace.ofWord')}</span> <b className="fa-num">{m.willingness}</b></span>
                <span className={`font-semibold ${m.accepted ? 'text-fa-good' : 'text-fa-danger-text'}`} data-testid="peace-verdict">{m.accepted ? t('bt.peace.wouldAcceptVerdict') : t('bt.peace.wouldRefuse')}</span>
              </div>
              <Meter className="mt-1" value={Math.min(m.demanded, Math.max(0, m.willingness))} max={Math.max(1, m.willingness, m.demanded)} color={m.accepted ? 'var(--fa-good)' : 'var(--fa-danger)'} />
              <div className="text-[11px] text-fa-muted mt-0.5">{m.accepted ? t('bt.peace.withinTruce', { n: m.truceTurns }) : t('bt.peace.moreThanGive', { n: m.short })}</div>
            </div>
          </div>

          <div className="min-w-0 min-h-0 flex flex-col gap-2">
            <div className="flex-1 min-h-0 sm:overflow-y-auto space-y-2">
            {m.counter && (
              <div className="rounded-[10px] border border-fa-enemy px-2.5 py-1.5 bg-fa-ink/50" data-testid="peace-counter">
                <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-fa-enemy">{t('bt.peace.mostTheyGive')}</div>
                <div className="text-[12.5px] leading-snug mt-0.5">{m.counter.text}</div>
                <div className="text-[11px] text-fa-muted">{t('bt.peace.worth', { a: m.counter.worth, b: m.counter.budget })}</div>
                <Button size="sm" className="w-full mt-1.5 !min-h-[40px]" onClick={() => setSelected(new Set(m.counter.keys))}>{t('bt.peace.loadOffer')}</Button>
              </div>
            )}
            <div className="fa-card px-2.5 py-1.5">
              <Label>{t('bt.peace.whitePeace')}</Label>
              <div className="text-[12px] leading-snug mt-0.5">{m.whitePeace.text}</div>
              <Button size="sm" className="w-full mt-1.5 !min-h-[40px]" onClick={() => send([], m.whitePeace.accepted ? null : m.whitePeace.text)} data-testid="peace-white">{t('bt.peace.offerWhite')}</Button>
            </div>
            </div>
            <Button variant="primary" hero className="w-full !min-h-[52px] shrink-0" disabled={!m.terms.length} title={m.terms.length ? undefined : t('bt.peace.chooseFirst')} onClick={() => send(m.terms, m.refusal)} data-testid="peace-offer">
              {t('bt.peace.sendOffer')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
};

export default PeaceDealSheet;

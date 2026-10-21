// src/components/panels/WorldCongressSheet.jsx
// The World Congress (eight-ages plan U60; engine: src/engine/worldCongress.js, the shown facts:
// worldCongressModel.js): the next resolution and when it is voted, how the vote stands now with
// your choice, your vote weight, the sanctions in force and the last votes. A sheet the player
// opens (openWorldCongress, from the Diplomacy tab): it goes through the interaction registry, a
// side sheet on a phone held sideways (.sheet-backdrop / .sheet-panel), a card on a desktop.
// Voting is never forced: no vote is an abstention, and the turn goes on without one.
import React, { useEffect, useMemo, useState } from 'react';
import { X, Landmark } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { useInteraction, useDismissOverlays, PRIORITY } from '../../hooks/useExclusivePanel';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { nameNow } from '../../i18n/names';
import { techName } from '../../i18n/gameText';
import { TECH_TREE } from '../../data/techTree';
import { worldCongressModel } from './worldCongressModel';

export const OPEN_WORLD_CONGRESS = 'ti:open-world-congress';
/** Opens the World Congress sheet from anywhere. */
export const openWorldCongress = () => window.dispatchEvent(new CustomEvent(OPEN_WORLD_CONGRESS));

const VOTES = [['yes', 'wc.voteYes'], ['no', 'wc.voteNo'], [null, 'wc.voteAbstain']];

const WorldCongressSheet = () => {
  useT(); // redraw when the language changes
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_WORLD_CONGRESS, on);
    return () => window.removeEventListener(OPEN_WORLD_CONGRESS, on);
  }, []);
  const m = useMemo(() => (open ? worldCongressModel(state) : null), [open, state]);
  const close = () => setOpen(false);
  const turn = useInteraction('world-congress', open && !!m, { priority: PRIORITY.sheet, user: true, label: tNow('wc.title') });
  useDismissOverlays(close, open);
  if (!open || !m || !turn.shown) return null;

  const people = (id) => nameNow('people', id, state.nations[id]?.name || id);
  const p = m.proposal;
  const resName = (r) => tNow(`wc.res.${r.id}`) + (r.targetId ? ` · ${people(r.targetId)}` : '');

  return (
    <div className="fixed inset-0 z-[66] bg-black/50 flex items-end sm:items-center justify-center sheet-backdrop" onClick={close} data-testid="world-congress-sheet">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="wc-title"
        className="sheet-panel fa-sheet w-full sm:max-w-lg max-h-[88dvh] flex flex-col border border-fa-line rounded-t-2xl sm:rounded-[10px] shadow-2xl text-fa-text">
        <div className="flex items-start gap-2.5 px-3 pt-3 pb-2 border-b border-fa-line">
          <Landmark className="w-6 h-6 shrink-0 text-fa-brass mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="wc-title" className="fa-heading text-[19px] pl:text-[16px] leading-tight">{tNow('wc.title')}</h2>
            <div className="text-[12px] text-fa-muted">{tNow('wc.hostLine', { host: people(m.hostId), n: m.members.length })}</div>
          </div>
          <button type="button" onClick={close} aria-label={tNow('wc.close')} className="fa-icon-btn -me-1 -mt-1 min-w-[44px] min-h-[44px]"><X className="w-4 h-4" /></button>
        </div>
        {/* pl:pb: End Turn rides above the sheets (TurnDock.jsx); the last rows scroll clear of it. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 pl:pb-20 space-y-3 text-[12.5px]">
          {p && (
            <section className="rounded-lg border border-fa-brass/60 bg-fa-raised/50 p-2.5 space-y-1.5" data-testid="wc-proposal">
              <div className="flex items-baseline justify-between gap-2">
                <span className="fa-label">{tNow('wc.nextVote', { count: m.turnsLeft, turn: m.voteTurn })}</span>
                {m.forecast && <span className={`text-[12px] ${m.forecast.passes ? 'text-fa-good' : 'text-fa-danger-text'}`} data-testid="wc-forecast">{tNow(m.forecast.passes ? 'wc.wouldPass' : 'wc.wouldFail', { yes: m.forecast.yes, no: m.forecast.no })}</span>}
              </div>
              <div className="text-[14px] font-semibold">{resName(p)}</div>
              <div className="text-fa-muted">{tNow(`wc.res.${p.id}.desc`)}</div>
              {m.member ? (
                <>
                  <div role="radiogroup" aria-label={tNow('wc.yourVote', { n: m.weight })} className="grid grid-cols-3 gap-1.5 pt-1">
                    {VOTES.map(([v, key]) => (
                      <button key={key} type="button" role="radio" aria-checked={m.myVote === v} data-testid={`wc-vote-${v || 'abstain'}`}
                        onClick={() => dispatch({ type: ActionTypes.WORLD_CONGRESS_VOTE, payload: { vote: v } })}
                        className={`min-h-[44px] fa-option px-2 py-1 text-center font-semibold ${m.myVote === v ? 'fa-selected' : ''}`}>{tNow(key)}</button>
                    ))}
                  </div>
                  <div className="text-[11px] text-fa-muted">{tNow('wc.yourVote', { n: m.weight })}</div>
                </>
              ) : <div className="text-[12px] text-amber-300" data-testid="wc-not-member">{tNow('wc.notMember', { tech: techName(m.joinTech, TECH_TREE[m.joinTech]?.name) })}</div>}
            </section>
          )}
          {m.sanctions.length > 0 && (
            <section className="space-y-1" data-testid="wc-sanctions">
              <div className="fa-label">{tNow('wc.sanctions')}</div>
              {m.sanctions.map((s) => (
                <div key={`${s.targetId}-${s.untilTurn}`} className={`flex justify-between gap-2 ${s.onMe ? 'text-fa-danger-text' : ''}`}>
                  <span>{people(s.targetId)}{s.mine ? tNow('wc.youSigned') : ''}</span>
                  <span className="text-fa-muted shrink-0">{tNow('wc.sanctionsLine', { n: s.signers, turn: s.untilTurn })}</span>
                </div>
              ))}
            </section>
          )}
          <section className="space-y-1" data-testid="wc-record">
            <div className="fa-label">{tNow('wc.record')}</div>
            {m.record.length ? m.record.map((r) => (
              <div key={`${r.turn}-${r.id}`} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{tNow('wc.turn', { turn: r.turn })} · {resName(r)}</span>
                <span className={`shrink-0 ${r.passed ? 'text-fa-good' : 'text-fa-muted'}`}>{tNow(r.passed ? 'wc.passed' : 'wc.failed', { yes: r.yes, no: r.no })}</span>
              </div>
            )) : <div className="text-fa-muted">{tNow('wc.noVotes')}</div>}
          </section>
        </div>
      </div>
    </div>
  );
};

export default WorldCongressSheet;

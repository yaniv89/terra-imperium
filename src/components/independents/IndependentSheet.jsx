// src/components/independents/IndependentSheet.jsx
// The independent city sheet (phase W4; the W08 sketch, independentSheetModel.js): personality
// shield, attitude with reasons, grudge with causes and decay, their tribute demand and the deals,
// in the Field Atlas look (U1 step 11: tokens, Spectral SC name, brass only on the primary action),
// mercenaries for hire, and the honest actions. A side sheet on a phone held sideways
// (.sheet-backdrop / .sheet-panel, one column), a two-column card on desktop. Every button is at
// least 44 px; a blocked action stays tappable and shows why (reasons on tap); brass marks the one
// primary action only; the sheet's frame is the independents' dashed violet.
import React, { useMemo, useState } from 'react';
import { X, Swords, Coins, HeartHandshake, Gift, Crown, ArrowLeftRight, Users, Flame, AlertTriangle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { focusRegion } from '../map/marchEvents';
import { independentSheetModel } from './independentSheetModel';
import { openTributeDemand } from './independentEvents';
import { actionIconUrl } from './independentArt';
import { ShieldMark, AttitudeMeter, GrudgeMeter, CardLabel, TONE_TEXT } from './IndependentBits';

const ACTION_GLYPH = { attack: Swords, payTribute: Coins, join: HeartHandshake, gift: Gift, demandTribute: Crown, trade: ArrowLeftRight, hire: Users };
const ACTION_ART = { attack: 'raid', payTribute: 'tribute', join: 'join', demandTribute: 'tribute', trade: 'trade', hire: 'hire' };

const ActionGlyph = ({ id }) => {
  const url = ACTION_ART[id] ? actionIconUrl(ACTION_ART[id]) : null;
  if (url) return <img src={url} alt="" width={16} height={16} className="shrink-0" draggable={false} />;
  const G = ACTION_GLYPH[id] || Coins;
  return <G className="w-4 h-4 shrink-0" aria-hidden="true" />;
};

const actionClass = (a) => {
  const base = 'min-h-[44px] w-full rounded-lg px-2 py-1.5 text-left flex items-center gap-2 border transition-colors';
  if (!a.ok) return `${base} bg-fa-ink/30 border-dashed border-fa-line text-fa-muted`;
  if (a.tone === 'primary') return `${base} bg-fa-brass hover:bg-fa-brass-hi border-fa-brass text-fa-ink`;
  if (a.tone === 'danger') return `${base} bg-fa-raised hover:bg-fa-hover border-fa-danger text-fa-text`;
  return `${base} bg-fa-raised hover:bg-fa-hover border-fa-line text-fa-text`;
};

const signed = (v) => `${v > 0 ? '+' : ''}${v}`;

export const IndependentSheetBody = ({ model: m, onRun, note, onClose }) => (
  <>
    <div className="flex items-start gap-2.5 px-3 pt-3 pb-2 border-b border-fa-line">
      <ShieldMark personality={m.personality.id} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="fa-heading text-[19px] leading-tight truncate" data-testid="indep-name">{m.name}</h2>
        <div className="fa-label !text-fa-indep">Independent · {m.personality.name}{m.freeCity ? ' · free city' : ''}</div>
        <div className="text-[12px] text-fa-muted truncate">{m.facts.join(' · ')}{m.people ? ` · ${m.people}` : ''}</div>
      </div>
      {onClose && <button type="button" onClick={onClose} aria-label="Close" className="fa-icon-btn -mr-1 -mt-1"><X className="w-4 h-4" /></button>}
    </div>
    <div className="flex-1 overflow-y-auto p-3 grid gap-3 sm:grid-cols-2 pl:grid-cols-1 text-[12px] text-fa-text">
      <div className="space-y-3 min-w-0">
        {m.deals.raid && (
          <div className="rounded-lg border border-fa-danger bg-fa-danger/10 p-2 flex gap-2 items-start text-fa-text" data-testid="indep-raid">
            <Flame className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>Their raid party is heading for {m.deals.raid.target}{m.deals.raid.eta != null ? `: about ${m.deals.raid.eta} turn${m.deals.raid.eta === 1 ? '' : 's'} away` : ''}. Meet it with an army, or keep your soldiers in the city.</div>
          </div>
        )}
        {m.deals.lastRaid && (
          <div className={`rounded-lg border p-2 text-[12px] ${m.deals.lastRaid.won ? 'border-fa-danger/70 bg-fa-danger/10 text-fa-text' : 'border-fa-good/60 bg-fa-good/10 text-fa-text'}`} data-testid="indep-last-raid">
            <span className="font-semibold">Last raid on you, turn {m.deals.lastRaid.turn}:</span> {m.deals.lastRaid.text}{m.deals.lastRaid.won && m.deals.lastRaid.loot && !m.deals.lastRaid.text.includes('gold') ? ` They took ${m.deals.lastRaid.loot} gold.` : ''}
          </div>
        )}
        <section className="rounded-lg border border-fa-line bg-fa-raised/50 p-2.5 space-y-1.5" data-testid="indep-attitude">
          <CardLabel right={<span className={`normal-case tracking-normal text-[12px] font-semibold ${TONE_TEXT[m.attitude.tone]}`}>{m.attitude.word} {signed(m.attitude.value)}</span>}>Toward you</CardLabel>
          <AttitudeMeter value={m.attitude.value} tone={m.attitude.tone} />
          {m.attitude.reasons.length > 0 && (
            <ul className="space-y-0.5">
              {m.attitude.reasons.map((r) => <li key={r.id} className="flex justify-between gap-2"><span className="text-fa-text">{r.label}</span><span className={`fa-num ${r.value > 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{signed(r.value)}</span></li>)}
            </ul>
          )}
          <div className="text-[11px] text-fa-muted">{m.attitude.joinRule}</div>
        </section>
        <section className="rounded-lg border border-fa-line bg-fa-raised/50 p-2.5 space-y-1.5" data-testid="indep-grudge">
          <CardLabel right={<span className={`fa-num normal-case tracking-normal text-[12px] ${TONE_TEXT[m.grudge.tone]}`}>{m.grudge.value} / {m.grudge.max}</span>}>Grudge</CardLabel>
          <GrudgeMeter value={m.grudge.value} max={m.grudge.max} />
          {m.grudge.causes.length > 0
            ? <ul className="space-y-0.5">{m.grudge.causes.map((c, i) => <li key={i} className="flex justify-between gap-2"><span className="text-fa-text">{c.label}{c.turn != null ? `, T${c.turn}` : ''}</span><span className="fa-num text-fa-danger-text">+{c.amount}</span></li>)}</ul>
            : m.grudge.value > 0 ? null : <div className="text-fa-muted">They hold nothing against you.</div>}
          {m.grudge.value > 0 && <div className="text-[11px] text-fa-muted">Fades {m.grudge.decay} a turn: gone in {m.grudge.fadesIn} turns.{m.grudge.effects.length ? ` Now: ${m.grudge.effects.join('; ')}.` : ''}</div>}
        </section>
        {m.deals.demand && (
          <section className="rounded-lg border border-fa-enemy/70 bg-fa-ink/60 p-2.5 space-y-2" data-testid="indep-demand">
            <CardLabel>They demand tribute</CardLabel>
            <div><span className="fa-num font-semibold text-fa-brass">{m.deals.demand.gold} gold</span> a turn for {m.deals.demand.turns} turns. Pay: no raids on you. Refuse: grudge {m.grudge.value} to {m.deals.demand.afterRefuse}, and expect raiders. Answer within {m.deals.demand.turnsLeft} turn{m.deals.demand.turnsLeft === 1 ? '' : 's'}.</div>
            <button type="button" onClick={() => openTributeDemand(m.deals.demand.id)} className="fa-btn fa-btn-secondary w-full" data-testid="indep-demand-open">Answer: pay, refuse or hire</button>
          </section>
        )}
        {(m.deals.youPay || m.deals.theyPay || m.deals.trade || m.deals.joinOffer) && (
          <section className="rounded-lg border border-fa-line bg-fa-raised/50 p-2.5 space-y-1" data-testid="indep-deals">
            <CardLabel>Deals</CardLabel>
            {m.deals.youPay && <div>You pay them {m.deals.youPay.gold} gold a turn until turn {m.deals.youPay.until}: no raids, no attacks.</div>}
            {m.deals.theyPay && <div className="text-fa-good">They pay you {m.deals.theyPay.gold} gold a turn until turn {m.deals.theyPay.until}.</div>}
            {m.deals.trade && <div className="text-fa-good">Trade: {m.deals.trade.gold} gold a turn each way.</div>}
            {m.deals.joinOffer && <div className="text-fa-good">They offer to join you (answer by turn {m.deals.joinOffer.expires}).</div>}
          </section>
        )}
      </div>
      <div className="space-y-3 min-w-0">
        {m.mercs && (
          <section className="space-y-1.5" data-testid="indep-mercs">
            <CardLabel right={<span className="normal-case tracking-normal text-[11px]">{m.mercs.stock} band{m.mercs.stock === 1 ? '' : 's'} free</span>}>Mercenaries for hire</CardLabel>
            {m.mercs.offer ? (
              <div className="rounded-lg border border-fa-line bg-fa-raised/50 p-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-fa-text truncate">{m.mercs.offer.unit}</div>
                  <div className="fa-num text-[11px] text-fa-text">{m.mercs.offer.price}g · {m.mercs.offer.upkeep}/turn · {m.mercs.offer.turns} turns</div>
                  <div className="text-[11px] text-fa-muted">Waits in {m.mercs.offer.waitIn}</div>
                </div>
                <button type="button" onClick={() => onRun(m.actions.find((a) => a.id === 'hire'))} className={`min-h-[44px] min-w-[64px] px-3 rounded-lg border font-semibold ${m.mercs.offer.affordable ? 'border-fa-line bg-fa-panel hover:bg-fa-hover text-fa-text' : 'border-dashed border-fa-line text-fa-muted'}`} data-testid="hire-mercenary">Hire</button>
              </div>
            ) : <div className="text-fa-muted">{m.mercs.reason}</div>}
            {m.mercs.hired.length > 0 && <div className="text-[11px] text-fa-text">Your bands from them: {m.mercs.hired.map((h) => `until turn ${h.until}`).join(', ')}.</div>}
            <div className="text-[11px] text-fa-muted">{m.mercs.note}</div>
          </section>
        )}
        {m.alive ? (
          <section className="space-y-1.5" data-testid="indep-actions">
            <CardLabel>Actions</CardLabel>
            <div className="grid grid-cols-2 gap-2">
              {m.actions.filter((a) => a.id !== 'hire' || !m.mercs).map((a) => (
                <button key={a.id} type="button" onClick={() => onRun(a)} className={`${actionClass(a)}${note?.id === a.id ? ' outline outline-2 outline-fa-text' : ''}`} data-testid={`indep-action-${a.id}`} data-ok={a.ok ? 'true' : 'false'} aria-describedby={note?.id === a.id ? 'indep-note' : undefined}>
                  <ActionGlyph id={a.id} />
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">{a.label}</span>
                    <span className={`block text-[10px] leading-tight ${a.tone === 'primary' && a.ok ? 'text-fa-ink/80' : 'text-fa-muted'}`}>{a.sub}</span>
                  </span>
                </button>
              ))}
            </div>
            {note && (
              <div id="indep-note" role="status" className={`rounded-lg border p-2 text-[12px] ${note.ok ? 'border-fa-line bg-fa-raised/70 text-fa-text' : 'border-fa-enemy/70 bg-fa-enemy/10 text-fa-text'}`} data-testid="indep-note">
                <div className="flex gap-1.5 items-start">{!note.ok && <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />}<span>{note.text}</span></div>
                {note.confirm && <button type="button" onClick={note.confirm} className="mt-2 w-full min-h-[44px] rounded-lg border border-fa-line bg-fa-panel hover:bg-fa-hover font-semibold text-fa-text" data-testid="indep-confirm">{note.confirmLabel}</button>}
              </div>
            )}
          </section>
        ) : <div className="text-fa-muted">{m.name} are no more: {m.facts[0]}.</div>}
      </div>
    </div>
  </>
);

const IndependentSheet = ({ indepId, onClose }) => {
  const { state, dispatch } = useGame();
  const m = useMemo(() => independentSheetModel(state, indepId), [state, indepId]);
  const [note, setNote] = useState(null);
  if (!m) return null;
  const go = (a) => {
    if (a.run?.kind === 'focusCity') { onClose(); focusRegion(a.run.cityId); return; }
    if (a.run?.action) dispatch(a.run.action);
    setNote(null);
  };
  // Reasons on tap: a blocked action explains itself; one that would backfire asks first.
  const onRun = (a) => {
    if (!a) return;
    if (!a.ok) { setNote({ id: a.id, ok: false, text: a.reason || 'Not possible now.' }); return; }
    if ((a.warn || a.id === 'attack') && note?.id !== a.id) {
      setNote({ id: a.id, ok: true, text: a.reason, confirm: () => go(a), confirmLabel: a.id === 'attack' ? 'Go to the city to attack' : `${a.label} anyway` });
      return;
    }
    go(a);
  };
  return (
    <div className="fixed inset-0 z-[66] bg-black/50 flex items-end sm:items-center justify-center sheet-backdrop" onClick={onClose} data-testid="independent-sheet">
      <div onClick={(e) => e.stopPropagation()} className="sheet-panel fa-sheet w-full sm:max-w-3xl max-h-[88dvh] flex flex-col border border-dashed border-fa-indep/70 rounded-t-2xl sm:rounded-[10px] shadow-2xl text-fa-text" role="dialog" aria-label={`${m.name}, independent city`}>
        <IndependentSheetBody model={m} onRun={onRun} note={note} onClose={onClose} />
      </div>
    </div>
  );
};

export default IndependentSheet;

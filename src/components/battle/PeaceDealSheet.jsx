// src/components/battle/PeaceDealSheet.jsx
// Negotiate a peace with real terms (plan §M13's OFFER_PEACE — until now the engine supported it
// but nothing in the UI could send one, so conquered land could never actually become yours).
// Occupation is not ownership: the regions your army holds are listed here, pre-selected as far as
// the enemy would accept, and ceding them at the table is what makes them yours. Their acceptance
// is shown live, line by line, from the same ledger the engine decides with (getPeaceAcceptance).
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { HeartHandshake as Handshake, X, Check } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { getPeaceAcceptance, getTermCost } from '../../engine/peace';

const GOLD_OPTIONS = [0, 500, 1500, 3000];

const PeaceDealSheet = ({ warId, onClose }) => {
  const { state, dispatch } = useGame();
  const war = state.wars.find((w) => w.id === warId && w.active);
  const me = state.playerNationId;
  const enemyId = war ? (war.aggressor === me ? war.enemy : war.aggressor) : null;
  const enemy = state.nations[enemyId];

  // Their land your army holds, cheapest to demand first.
  const occupied = useMemo(() => (war ? Object.values(state.regions)
    .filter((r) => r.owner === enemyId && r.occupiedBy === me)
    .map((r) => ({ id: r.id, name: REGIONS_DATA[r.id]?.name || r.id, cost: getTermCost(state, war, me, { type: 'cede', regionId: r.id }) }))
    .sort((a, b) => a.cost - b.cost) : []), [state, war, enemyId, me]);

  // Start with as much of the occupied land as they'd accept right now.
  const [ceded, setCeded] = useState(() => {
    if (!war) return new Set();
    const budget = getPeaceAcceptance(state, war, me, []).total;
    const picked = new Set(); let spent = 0;
    occupied.forEach((r) => { if (spent + r.cost <= budget) { picked.add(r.id); spent += r.cost; } });
    return picked;
  });
  const [gold, setGold] = useState(0);
  const [reparations, setReparations] = useState(false);
  const [humiliate, setHumiliate] = useState(false);

  if (!war || !enemy) return null;
  const terms = [
    ...[...ceded].map((regionId) => ({ type: 'cede', regionId })),
    ...(gold ? [{ type: 'gold', amount: gold }] : []),
    ...(reparations ? [{ type: 'reparations' }] : []),
    ...(humiliate ? [{ type: 'humiliate' }] : [])
  ];
  const acceptance = getPeaceAcceptance(state, war, me, terms);
  const toggle = (id) => setCeded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const offer = () => { dispatch({ type: ActionTypes.OFFER_PEACE, payload: { warId, terms } }); onClose(); };
  const pct = Math.max(0, Math.min(100, acceptance.cost > 0 ? (acceptance.total / acceptance.cost) * 100 : 100));

  // Portalled to <body>: opened from inside the side panel, whose transformed container would
  // otherwise trap this "fixed" sheet under the mobile tab bar.
  return createPortal((
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} data-testid="peace-deal">
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md max-h-[88vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl text-slate-200 shadow-2xl">
        <div className="p-4 pb-2 flex items-start justify-between">
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2"><Handshake className="w-5 h-5 text-emerald-400" /> Peace with {enemy.name}</div>
            <div className="text-xs text-slate-400">Land you occupy becomes yours only when they cede it here.</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-slate-400" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 space-y-3 overflow-y-auto">
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1">Cede territory ({occupied.length} occupied)</div>
            {occupied.length === 0 && <div className="text-[11px] text-slate-500">Your army holds none of their land yet — occupy regions first to demand them.</div>}
            <div className="space-y-1">
              {occupied.map((r) => (
                <button key={r.id} type="button" onClick={() => toggle(r.id)} className={`w-full min-h-[40px] px-3 rounded-lg border flex items-center justify-between text-sm ${ceded.has(r.id) ? 'bg-cyan-500/15 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`} data-testid="peace-cede">
                  <span className="flex items-center gap-2">{ceded.has(r.id) ? <Check className="w-4 h-4 text-cyan-300" /> : <span className="w-4" />}{r.name}</span>
                  <span className="text-[11px] text-slate-400">cost {r.cost}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1">Gold</div>
            <div className="grid grid-cols-4 gap-1">
              {GOLD_OPTIONS.map((g) => (
                <button key={g} type="button" onClick={() => setGold(g)} className={`min-h-[36px] rounded-lg border text-xs ${gold === g ? 'bg-amber-500/15 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{g ? `${g}g` : 'None'}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => setReparations((v) => !v)} className={`min-h-[40px] rounded-lg border text-xs ${reparations ? 'bg-amber-500/15 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>War reparations</button>
            <button type="button" onClick={() => setHumiliate((v) => !v)} className={`min-h-[40px] rounded-lg border text-xs ${humiliate ? 'bg-amber-500/15 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>Humiliate</button>
          </div>

          <div className="rounded-lg bg-slate-800/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Their willingness vs your demands</span>
              <span className={`font-semibold ${acceptance.accepted ? 'text-emerald-400' : 'text-red-400'}`} data-testid="peace-verdict">{acceptance.accepted ? 'They would accept' : 'They would refuse'}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-900 overflow-hidden"><div className={`h-full ${acceptance.accepted ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div>
            <div className="text-[11px] text-slate-400">{acceptance.total} willingness · {acceptance.cost} demanded</div>
            <div className="text-[10px] text-slate-500 leading-snug">{acceptance.breakdown.filter((l) => l.value).map((l) => `${l.label} ${l.value > 0 ? '+' : ''}${l.value}`).join(' · ')}</div>
          </div>
        </div>

        <div className="p-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={offer} className="w-full min-h-[48px] rounded-xl bg-emerald-600 border border-emerald-400 font-semibold text-white disabled:opacity-50" data-testid="peace-offer">
            {terms.length ? `Offer peace (${terms.length} term${terms.length > 1 ? 's' : ''})` : 'Offer white peace'}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
};

export default PeaceDealSheet;

// src/components/modals/ColonyBlock.jsx
// The frontier province's settling block on the region card (plan §4h, colonies.js): the checklist
// for founding a colony, the two ways to treat the people already living there (with their speed
// and raid risk), or, once founded, the colony's progress, turns left, upkeep, raid risk and
// Abandon. Never hidden: what is missing is said, the button is greyed.
import React from 'react';
import { Check, Tent, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { colonyGrowth, colonyTurnsLeft, coloniesOf, POLICY, raidChance, UPKEEP_GOLD, UPKEEP_GOLD_PER_OTHER, UPKEEP_SUPPLIES, validateColony } from '../../engine/colonies';

const pct = (v) => `${Math.round(v * 100)}%`;

const ColonyBlock = ({ regionId }) => {
  const { state, dispatch } = useGame();
  const region = state.regions[regionId];
  if (!region || region.owner !== null || !region.neutral || state.scenario?.mode !== 'emergent') return null;
  const me = state.playerNationId;
  const colony = region.colony;

  if (colony && colony.ownerId !== me) {
    return <div className="text-[11px] text-fa-muted">{state.nations[colony.ownerId]?.name || 'Another nation'} is settling here ({Math.round(colony.progress)}%).</div>;
  }

  if (colony) {
    const escorted = Object.values(state.units).some((u) => u.ownerId === me && u.regionId === regionId && u.domain === 'land' && u.strength > 0);
    const upkeep = UPKEEP_GOLD + UPKEEP_GOLD_PER_OTHER * Math.max(0, coloniesOf(state, me).length - 1);
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 space-y-1.5" data-testid="colony-progress">
        <div className="flex items-center gap-1.5 text-[12px] text-emerald-200 font-semibold"><Tent className="w-4 h-4" /> Your colony: {Math.round(colony.progress)}%</div>
        <div className="h-1.5 rounded bg-fa-raised overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, colony.progress)}%` }} /></div>
        <div className="text-[11px] text-fa-text">
          About {colonyTurnsLeft(state, regionId)} more turns at +{Math.round(colonyGrowth(state, regionId, me, colony.policy))} a turn.
          {' '}{colony.policy === 'driveOut' ? 'Driving out the people here.' : 'Living alongside the people here.'}
        </div>
        <div className="text-[11px] text-fa-muted">Upkeep {upkeep} gold and {UPKEEP_SUPPLIES} supply a turn. Raid risk {pct(raidChance(state, regionId, colony.policy, escorted))}{escorted ? '' : ' (no escort: doubled)'}{colony.raids ? `, ${colony.raids} raid${colony.raids > 1 ? 's' : ''} in a row` : ''}.</div>
        <button onClick={() => dispatch({ type: ActionTypes.ABANDON_COLONY, payload: { regionId } })} className="min-h-[32px] px-3 rounded-lg bg-fa-raised hover:bg-fa-hover text-[11px] text-fa-text">Abandon colony</button>
      </div>
    );
  }

  const v = validateColony(state, regionId);
  const resistance = region.neutral.resistance || 0;
  const found = (policy) => dispatch({ type: ActionTypes.FOUND_COLONY, payload: { regionId, policy } });
  const option = (policy, label, blurb) => (
    <button key={policy} onClick={() => found(policy)} disabled={!v.ok} data-testid={`found-colony-${policy}`}
      className="flex-1 min-h-[52px] rounded-lg border border-fa-line bg-fa-raised/70 hover:border-emerald-400 disabled:opacity-40 disabled:hover:border-fa-line p-2 text-left">
      <div className="text-[12px] font-semibold text-fa-text">{label}</div>
      <div className="text-[10px] text-fa-muted">{blurb}</div>
    </button>
  );
  return (
    <div className="rounded-lg border border-fa-line bg-fa-raised/40 p-2 space-y-1.5" data-testid="colony-found">
      <div className="flex items-center gap-1.5 text-[12px] text-fa-text font-semibold"><Tent className="w-4 h-4 text-fa-good" /> Found a colony</div>
      <div className="text-[11px] text-fa-muted">Free land, home to {(region.neutral.inhabitants || 0).toLocaleString('en-US')} people (resistance {resistance}). A colony grows over several turns and costs upkeep until it becomes a province.</div>
      <ul className="space-y-0.5">
        {v.checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-1 text-[11px] ${c.ok ? 'text-fa-text' : 'text-fa-danger-text'}`}>
            {c.ok ? <Check className="w-3 h-3 text-fa-good shrink-0" /> : <X className="w-3 h-3 shrink-0" />} {c.label}
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5">
        {option('coexist', 'Live alongside them', `Slower (x${POLICY.coexist.growth}), they join you, raid risk ${pct(raidChance(state, regionId, 'coexist', true))}`)}
        {option('driveOut', 'Drive them out', `Faster (x${POLICY.driveOut.growth}), empty land, unrest, raid risk ${pct(raidChance(state, regionId, 'driveOut', true))}`)}
      </div>
    </div>
  );
};

export default ColonyBlock;

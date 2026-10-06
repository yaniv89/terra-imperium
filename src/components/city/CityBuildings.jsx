// src/components/city/CityBuildings.jsx
// The city sheet's Buildings tab (plans/civ-map-rework.md E4): every line, what stands, the next
// tier with its production cost, and a one-tap queue. 44 px targets.
import React from 'react';
import { Plus, Check } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { ACTION_COSTS } from '../../data/actionCosts';
import { cityBuildingsModel, cityDevelopmentModel } from './cityPoliticsModel';
import { useEffects } from '../../context/EffectsContext';
import { ActionButton } from '../ui';
import { TrendingUp } from 'lucide-react';
import { BuildingIcon, ExtractionIcon } from '../ui/icons';

// ActionButton takes an icon component; this one draws the deposit's extraction building.
const depositIcons = {};
const depositIcon = (resourceId) => (depositIcons[resourceId] ||= Object.assign(
  () => <ExtractionIcon resourceId={resourceId} size={18} />, { displayName: `DepositIcon(${resourceId})` }));

const CityBuildings = ({ cityId }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const rows = cityBuildingsModel(state, cityId);
  if (!rows) return null;
  const mine = state.regions[cityId]?.owner === state.playerNationId;
  const dev = mine ? cityDevelopmentModel(state, cityId) : null;
  const invest = (r) => {
    if (!r.enabled) return addLog('Not enough resources', 'action');
    triggerEffect(r.devType ? 'develop_province' : r.id === 'infrastructure' ? 'build_infrastructure' : r.id === 'defenses' ? 'build_defenses' : 'build_climate_resilience', { region: cityId });
    dispatch({ type: r.actionType, payload: r.payload });
  };
  const developSite = (d) => {
    if (!d.enabled) return addLog(d.built ? 'Already developed' : 'Not yet possible', 'action');
    triggerEffect('develop_resource_site', { region: cityId, variant: d.resourceId });
    dispatch({ type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: cityId, resourceId: d.resourceId } });
  };
  return (
    <div className="space-y-3">
    <ul className="space-y-1" data-testid="city-buildings">
      {rows.map((r) => (
        <li key={r.category} className="flex items-center gap-2 rounded-lg px-2 py-1.5 min-h-[44px] text-xs bg-fa-raised/60 border border-fa-line/60">
          {/* The next tier's icon (what the button queues); a finished line shows its top tier. */}
          <BuildingIcon category={r.category} tier={r.next ? r.built.length : r.built.length - 1} size={28} />
          <div className="min-w-0 flex-1">
            <div className="text-fa-text">{r.label}</div>
            <div className="text-fa-muted truncate">{r.built.length ? r.built.join(', ') : 'nothing yet'}{r.next ? ` · next ${r.next.name} (${r.next.cost})` : ' · complete'}{r.next?.needs ? ` · needs ${r.next.needs}` : ''}{r.next?.needsTech && mine && <button type="button" onClick={() => dispatch({ type: ActionTypes.QUEUE_RESEARCH, payload: { techId: r.next.needsTech } })} className="ml-1 underline text-fa-you min-h-[24px]" data-testid="research-for-building">Research it</button>}</div>
          </div>
          {r.next && mine && (r.next.queued
            ? <span className="text-fa-good flex items-center gap-1"><Check className="w-3.5 h-3.5" /> queued</span>
            : <button type="button" disabled={!r.next.canBuild} onClick={() => dispatch({ type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId, item: { kind: 'building', category: r.category, tier: r.built.length } } })} aria-label={`Queue ${r.next.name}`} className="min-w-[44px] min-h-[44px] rounded-lg bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 text-fa-text flex items-center justify-center"><Plus className="w-4 h-4" /></button>)}
        </li>
      ))}
    </ul>
    {dev && (
      <div className="space-y-1" data-testid="city-development">
        <div className="text-xs font-semibold text-fa-text">Development (total {dev.totalDev})</div>
        {dev.rows.map((r) => <ActionButton key={r.id} icon={TrendingUp} label={r.label} description={r.description} costs={r.costs} onClick={() => invest(r)} disabled={!r.enabled} resources={state.resources} size="small" />)}
        {dev.deposits.map((d) => <ActionButton key={d.resourceId} icon={depositIcon(d.resourceId)} label={`${d.name}${d.built ? ' (built)' : ''}`} description={`Develop this land's ${d.resourceId} deposit`} costs={d.built ? null : ACTION_COSTS.developResourceSite} onClick={() => developSite(d)} disabled={!d.enabled} resources={state.resources} size="small" />)}
      </div>
    )}
    </div>
  );
};

export default CityBuildings;

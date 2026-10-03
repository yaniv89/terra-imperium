// src/components/map/ArmySheet.jsx
// The army sheet (plans/civ-map-rework.md E4): tap one of your army banners and see the stack on
// that tile, grouped by army, with supply, moves and route, and the orders that start from here
// (march, cancel the route, rename the army, disband). A bottom sheet on a phone, a docked panel
// on a wider screen, like the tile sheet.
import React, { useMemo, useState } from 'react';
import { X, Flag, Shield, Pencil, Trash2, Flame, Award, Swords, Castle } from 'lucide-react';
import PreBattleModal from '../battle/PreBattleModal';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile'
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { startMarch } from './marchEvents';
import { armySheetModel } from './armySheetModel';

const ArmySheet = ({ tile, onClose, onSelectRegion }) => {
  const { state, dispatch } = useGame();
  const isMobile = useIsMobile();
  const model = useMemo(() => armySheetModel(state, tile), [state, tile]);
  const [renaming, setRenaming] = useState(null);
  const [picked, setPicked] = useState(null); // unit ids chosen to march (null: the whole stack)
  const [attack, setAttack] = useState(null); // a target of the pre-battle modal
  if (!model) return null;
  const marching = picked ? model.unitIds.filter((id) => picked.has(id)) : model.unitIds;
  const togglePick = (id) => setPicked((p) => { const next = new Set(p || model.unitIds); if (next.has(id)) next.delete(id); else next.add(id); return next.size === model.unitIds.length ? null : next; });
  const tiles = getTiles();
  const where = tiles.names[tile] || model.base || 'the field';
  const rename = () => { if (renaming?.trim()) dispatch({ type: ActionTypes.RENAME_ARMY, payload: { unitIds: model.unitIds, name: renaming.trim() } }); setRenaming(null); };
  const body = (
    <>
      <div className="flex justify-between items-start border-b border-slate-700 pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white truncate text-sm">{model.groups.length === 1 && model.groups[0].key ? model.groups[0].name : `Army at ${where}`}</div>
            <div className="text-slate-500 text-[10px]">{model.soldiers.toLocaleString()} soldiers · {where}{model.base ? ` · based at ` : ''}{model.base && <button type="button" onClick={() => onSelectRegion?.(model.regionId)} className="underline">{model.base}</button>}</div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-[11px] text-slate-300 mb-2" data-testid="army-supply">{model.zoneText}{model.airCover ? ` Air cover: ${model.airCover} aircraft within ${model.airRange} tiles join a battle here.` : ''}</div>
      {model.route && <div className="text-[11px] text-amber-200 mb-2" data-testid="army-route">Marching to {model.route.name}: about {model.route.turns} turn{model.route.turns === 1 ? '' : 's'}.</div>}
      {model.siege && <div className="text-[11px] text-orange-200 mb-2 flex items-center gap-1.5" data-testid="army-siege"><Castle className="w-3.5 h-3.5 shrink-0" />Besieging {model.siege.name}: walls {model.siege.hp}/{model.siege.maxHp}{model.siege.walls ? ` (${model.siege.walls} wall${model.siege.walls === 1 ? '' : 's'})` : ''}, {model.siege.strength} siege strength a turn{model.siege.encircled ? ', encircled: it starves' : ''}.</div>}
      {model.groups.map((g) => (
        <div key={g.key || 'none'} className="mb-2" data-testid="army-group">
          <div className="text-[11px] font-semibold text-slate-200 mb-1">{g.name} <span className="text-slate-500">({g.units.length})</span></div>
          <ul className="space-y-1">
            {g.units.map((u) => (
              <li key={u.id} className="flex items-center gap-2 rounded-lg px-2 min-h-[40px] text-xs bg-slate-800/60 border border-slate-700/60">
                {model.unitIds.length > 1 && !model.route && <input type="checkbox" aria-label={`March ${u.name}`} checked={!picked || picked.has(u.id)} onChange={() => togglePick(u.id)} className="w-5 h-5 shrink-0" data-testid="army-pick" />}
                <div className="min-w-0 flex-1">
                  <div className="text-slate-100 truncate">{u.name}{u.general ? ` · ${u.general}` : ''}{u.promotions ? ` · ${u.promotions} promotion${u.promotions === 1 ? '' : 's'}` : ''}</div>
                  <div className="text-slate-400">{u.strength}/{u.maxStrength} · morale {u.morale} · supply {u.supply}/{u.supplyMax} · moves {u.moves}/{u.movePoints}</div>
                  <div className="text-slate-500 capitalize">{u.rank}{u.nextRankAt ? ` · ${u.xp}/${u.nextRankAt} xp` : ''}{u.general ? ` · ${u.general} commands` : ''}</div>
                  {u.general
                    ? <button type="button" onClick={() => dispatch({ type: ActionTypes.APPOINT_GENERAL, payload: { generalId: u.generalId, unitId: null } })} className="text-slate-400 underline min-h-[32px]">Recall the general</button>
                    : model.generals.length > 0 && (
                      <select aria-label={`General for ${u.name}`} defaultValue="" onChange={(e) => { if (e.target.value) { dispatch({ type: ActionTypes.APPOINT_GENERAL, payload: { generalId: e.target.value, unitId: u.id } }); e.target.value = ''; } }} className="mt-1 bg-slate-700 text-slate-200 rounded px-1.5 min-h-[32px] text-[11px]">
                        <option value="" disabled>Assign a general…</option>
                        {model.generals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    )}
                  {u.perks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1" data-testid="army-promote">
                      <span className="text-purple-300 flex items-center gap-1"><Award className="w-3 h-3" /> Promote:</span>
                      {u.perks.map((p) => <button key={p.id} type="button" title={p.description} onClick={() => dispatch({ type: ActionTypes.PROMOTE_UNIT, payload: { unitId: u.id, perkId: p.id } })} className="px-1.5 min-h-[32px] rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-200 text-[10px]">{p.name}</button>)}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => dispatch({ type: ActionTypes.DISBAND_UNIT, payload: { unitId: u.id } })} aria-label={`Disband ${u.name}`} className="p-2 rounded-lg min-w-[36px] min-h-[36px] text-red-300 hover:bg-slate-700"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        {model.route
          ? <button type="button" onClick={() => dispatch({ type: ActionTypes.CANCEL_ROUTE, payload: { unitIds: model.unitIds } })} className="flex-1 min-h-[44px] rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold">Halt the march</button>
          : <button type="button" disabled={!model.canMarch || !marching.length} onClick={() => { startMarch(model.regionId, { unitIds: marching }); onClose?.(); }} data-testid="army-march" className="flex-1 min-h-[44px] rounded-lg bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5"><Flag className="w-3.5 h-3.5" /> March{picked ? ` ${marching.length} of ${model.unitIds.length}` : ''}…</button>}
        <button type="button" onClick={() => setRenaming(model.groups[0].key ? model.groups[0].name : '')} aria-label="Name this army" className="min-h-[44px] px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"><Pencil className="w-4 h-4" /></button>
      </div>
      {model.targets.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="army-targets">
          {model.targets.map((t) => (
            <button key={`${t.kind}:${t.tile}`} type="button" disabled={!t.ok} onClick={() => setAttack(t)} data-testid={`army-attack-${t.kind}`} title={t.ok ? (t.kind === 'city' ? 'Assault the city' : 'Attack the army') : t.reason} className="w-full min-h-[44px] rounded-lg bg-red-800/70 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
              <Swords className="w-3.5 h-3.5" /> {t.kind === 'city' ? `Assault ${t.name}` : `Attack the ${t.name}`} ({t.strength.toLocaleString()}){t.ok ? '' : ` · ${t.reason}`}
            </button>
          ))}
        </div>
      )}
      {attack && (attack.kind === 'city'
        ? <PreBattleModal fromRegionId={model.regionId} targetRegionId={attack.regionId} onClose={() => setAttack(null)} />
        : <PreBattleModal fromRegionId={model.regionId} tile={attack.tile} onClose={() => setAttack(null)} />)}
      {model.pillage && (
        <button type="button" onClick={() => dispatch({ type: ActionTypes.PILLAGE_TILE, payload: { unitIds: model.unitIds } })} data-testid="army-pillage" className="w-full mt-2 min-h-[44px] rounded-lg bg-red-800/70 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5" title="Burn the improvement here: it stops yielding until repaired; the stack spends its moves.">
          <Flame className="w-3.5 h-3.5" /> Pillage the {model.pillage.name} (+{model.pillage.gold} gold)
        </button>
      )}
      {renaming != null && (
        <div className="flex gap-2 mt-2">
          <input value={renaming} onChange={(e) => setRenaming(e.target.value)} placeholder="Army name" aria-label="Army name" className="flex-1 bg-slate-800 rounded px-2 min-h-[40px] text-white text-xs" />
          <button type="button" onClick={rename} data-testid="army-rename" className="min-h-[40px] px-3 rounded-lg bg-emerald-700 text-white text-xs">Save</button>
        </div>
      )}
    </>
  );
  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-y-auto bg-slate-900 border-t border-slate-700 rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs shadow-2xl sheet-panel" data-testid="army-sheet">{body}</div>
    );
  }
  return (
    <div className="absolute top-[calc(var(--header-height,4.5rem)+0.5rem)] left-2 z-20 bg-slate-900 p-3 rounded-lg text-xs w-[300px] max-w-[calc(100vw-1rem)] border border-slate-700 shadow-xl max-h-[calc(100dvh-var(--header-height,4.5rem)-1.5rem)] overflow-y-auto" data-testid="army-sheet">{body}</div>
  );
};

export default ArmySheet;

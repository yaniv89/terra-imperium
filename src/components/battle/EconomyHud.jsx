// src/components/battle/EconomyHud.jsx
// The battle economy's controls (phase R1; src/battle/sim/economy.js), phone first (844x390):
//   ResourceBar   food, materials, gold and population / housing, in the top bar
//   BuildMenu     the buildings a worker can raise, with prices (tap one, then tap the ground)
//   BuildingPanel the selected building: HP, its training queue (cancel), train buttons, rally
// Icons come from the art plan's battle set (src/assets/icons/battle/<id>.svg, batch 04 and 06:
// resource-food, resource-materials, resource-gold, population, build-*) through GameIcon; until the
// art is delivered each shows its lucide glyph.
import React from 'react';
import { Wheat, TreePine, Coins, Home, Hammer, X, Flag, Hourglass } from 'lucide-react';
import GameIcon from '../ui/GameIcon';
import { BUILDINGS, UNITS, RESOURCES, ecoName, buildableFor, trainableRoles } from '../../battle/data/economy';
import { getSquadDisplayName } from '../../battle/data/battleStats';

const RES_ICON = { food: ['resource-food', Wheat, 'text-amber-200'], materials: ['resource-materials', TreePine, 'text-emerald-200'], gold: ['resource-gold', Coins, 'text-yellow-300'] };
const ResIcon = ({ res, size = 14 }) => {
  const [id, Glyph, tone] = RES_ICON[res];
  return <GameIcon group="battle" id={id} size={size} fallback={<Glyph className={`shrink-0 ${tone}`} style={{ width: size, height: size }} />} />;
};
const Cost = ({ cost, stock }) => (
  <span className="flex flex-wrap justify-center gap-x-1 leading-none">
    {RESOURCES.filter((r) => cost?.[r]).map((r) => (
      <span key={r} className={`flex items-center gap-0.5 ${stock && stock[RESOURCES.indexOf(r)] < cost[r] ? 'text-red-400' : ''}`}><ResIcon res={r} size={10} />{cost[r]}</span>
    ))}
  </span>
);
const canPay = (cost, stock) => RESOURCES.every((r, i) => (cost?.[r] || 0) <= stock[i]);

export const ResourceBar = ({ eco }) => {
  if (!eco) return null;
  const full = eco.pop >= eco.cap;
  return (
    <div className="px-2 py-0.5 rounded-full bg-slate-900/85 border border-slate-600/70 text-slate-100 text-[11px] font-mono shadow-lg flex items-center gap-2.5" data-testid="battle-resources">
      {RESOURCES.map((r, i) => <span key={r} className="flex items-center gap-1" title={r}><ResIcon res={r} />{eco.stock[i]}</span>)}
      <span className={`flex items-center gap-1 ${full ? 'text-red-300' : ''}`} title="Population / housing">
        <GameIcon group="battle" id="population" size={14} fallback={<Home className="w-3.5 h-3.5 text-sky-300" />} />{eco.pop}/{eco.cap}
      </span>
    </div>
  );
};

export const BuildMenu = ({ ageId, stock, onPick, onClose }) => (
  <div className="absolute right-2 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 w-[300px] max-w-[calc(100vw-1rem)] p-1.5 rounded-xl bg-slate-900/95 border border-slate-600 shadow-2xl pointer-events-auto" data-testid="battle-build-menu">
    <div className="flex items-center justify-between px-1 pb-1 text-xs font-semibold text-white"><span>Build</span><button type="button" onClick={onClose} className="p-1"><X className="w-4 h-4" /></button></div>
    <div className="grid grid-cols-4 gap-1">
      {buildableFor(ageId).map((id) => {
        const def = BUILDINGS[id];
        const ok = canPay(def.cost, stock);
        return (
          <button key={id} type="button" disabled={!ok} onClick={() => onPick(id)} data-testid={`build-${id}`}
            className="min-h-[52px] px-0.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[9px] text-slate-100 flex flex-col items-center justify-center gap-0.5 disabled:opacity-45">
            <GameIcon group="battle" id={def.icon} size={16} fallback={<Hammer className="w-4 h-4 text-slate-300" />} />
            <span className="leading-none text-center">{ecoName(id, ageId)}</span>
            <Cost cost={def.cost} stock={stock} />
          </button>
        );
      })}
    </div>
  </div>
);

export const BuildingPanel = ({ building, ageId, stock, onTrain, onCancel, onRally, rallyArmed, onClose }) => {
  if (!building) return null;
  const def = BUILDINGS[building.type];
  const roles = (def.trains || []).filter((r) => trainableRoles(ageId).includes(r));
  const name = ecoName(building.type, ageId);
  return (
    <div className="absolute left-2 top-[calc(6.5rem+env(safe-area-inset-top))] z-20 w-[230px] max-w-[60vw] p-2 rounded-xl bg-slate-900/95 border border-slate-600 shadow-2xl text-[11px] text-slate-200 pointer-events-auto" data-testid="battle-building-panel">
      <div className="flex items-center justify-between font-semibold text-white text-xs"><span className="truncate">{name}</span><button type="button" onClick={onClose} className="p-1"><X className="w-4 h-4" /></button></div>
      <div className="h-1.5 my-1 bg-slate-700 rounded-full overflow-hidden"><span className="block h-full bg-emerald-400" style={{ width: `${building.built ? (building.hp / Math.max(1, building.maxHp)) * 100 : building.progress}%` }} /></div>
      {!building.built && <div className="text-amber-200">Under construction · {building.progress}%</div>}
      {building.built && building.queue.length > 0 && (
        <div className="flex flex-wrap gap-1 my-1">
          {building.queue.map((it, k) => (
            <button key={k} type="button" onClick={() => onCancel(k)} title="Cancel"
              className={`relative w-9 h-9 rounded-md border text-[9px] leading-none flex flex-col items-center justify-center ${it.blocked ? 'border-red-500 bg-red-950/60' : 'border-slate-600 bg-slate-800'}`}>
              {it.blocked ? <Home className="w-3 h-3 text-red-300" /> : <Hourglass className="w-3 h-3" />}
              <span>{k === 0 ? `${it.pct}%` : ''}</span>
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-lime-400" style={{ width: `${k === 0 ? it.pct : 0}%` }} />
            </button>
          ))}
        </div>
      )}
      {building.queue[0]?.blocked === 'housing' && <div className="text-red-300">Needs housing: build a village house.</div>}
      {building.built && roles.length > 0 && (
        <div className="grid grid-cols-2 gap-1 mt-1">
          {roles.map((role) => (
            <button key={role} type="button" disabled={!canPay(UNITS[role].cost, stock)} onClick={() => onTrain(role)} data-testid={`train-${role}`}
              className="min-h-[44px] px-1 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-0.5 disabled:opacity-45">
              <span className="font-semibold text-[10px] leading-none">{role === 'worker' ? ecoName('worker', ageId) : getSquadDisplayName(role, ageId)}</span>
              <Cost cost={UNITS[role].cost} stock={stock} />
            </button>
          ))}
        </div>
      )}
      {building.built && roles.length > 0 && (
        <button type="button" onClick={onRally} className={`mt-1 w-full h-9 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1 ${rallyArmed ? 'bg-lime-500/25 border-lime-400 text-lime-200' : 'bg-slate-800 border-slate-700'}`}>
          <Flag className="w-3.5 h-3.5" />{rallyArmed ? 'Tap the ground for the rally point' : 'Set rally point'}
        </button>
      )}
    </div>
  );
};

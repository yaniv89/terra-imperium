// Shared subject and territory invariants at ownership-changing boundaries.
import { getOwnedRegionIds, invalidateRegionsCache } from '../data/regions';
import { refreshWarFlags } from './diplomacy';
import { getTotalDev } from './development';

export const canSubjugate = (nations, overlordId, subjectId) => {
  const overlord = nations[overlordId], subject = nations[subjectId];
  if (!overlord || !subject || overlordId === subjectId || overlord.isEliminated || subject.isEliminated || overlord.vassalOf || subject.vassalOf) return false;
  const seen = new Set([subjectId]);
  let id = overlordId;
  while (id) {
    if (seen.has(id)) return false;
    seen.add(id);
    id = nations[id]?.vassalOf;
  }
  return true;
};

export const reconcileTerritory = state => {
  invalidateRegionsCache(state.regions);
  let nations = state.nations;
  const patch = (id, fields) => { nations = { ...nations, [id]: { ...nations[id], ...fields } }; };
  for (const id of Object.keys(nations)) {
    const nation = nations[id];
    const land = getOwnedRegionIds(state.regions, id);
    if (!land.length && id!==state.playerNationId && !nation.isEliminated)patch(id,{isEliminated:true,capitalRegionId:null});
    if (land.length && (nation.isEliminated || !land.includes(nation.capitalRegionId))) {
      const capital = land.reduce((a, b) => getTotalDev(state.regions[b]) > getTotalDev(state.regions[a]) ? b : a);
      patch(id, { capitalRegionId: capital, isEliminated: false });
    }
    if (nation.vassalOf && (!nations[nation.vassalOf] || nations[nation.vassalOf].isEliminated)) patch(id, { vassalOf: null, vassalizedTurn: null });
  }
  const wars = state.wars.filter(w => !w.active || (!nations[w.aggressor]?.isEliminated && !nations[w.enemy]?.isEliminated));
  const liveWars = new Set(wars.filter(w => w.active).map(w => w.id));
  const pendingPeaceOffer = state.pendingPeaceOffer && liveWars.has(state.pendingPeaceOffer.warId) ? state.pendingPeaceOffer : null;
  const pendingDefenses = (state.pendingDefenses || []).filter(d => liveWars.has(d.warId) && state.regions[d.regionId]?.owner === state.playerNationId);
  const changed = state.wars.filter(w => w.active && !liveWars.has(w.id)).flatMap(w => [w.aggressor, w.enemy]);
  if (changed.length) nations = refreshWarFlags(nations, wars, changed);
  for (const id of Object.keys(nations)) {
    const vassals = Object.values(nations).filter(n => !n.isEliminated && n.vassalOf === id).map(n => n.id);
    if (JSON.stringify(vassals.slice().sort()) !== JSON.stringify((nations[id].vassals || []).slice().sort())) patch(id, { vassals });
  }
  const units=Object.fromEntries(Object.entries(state.units || {}).filter(([,u])=>!nations[u.ownerId]?.isEliminated));
  const pendingBattle=state.pendingBattle && !liveWars.has(state.pendingBattle.warId)?null:state.pendingBattle;
  return { ...state, nations, units, wars, pendingBattle, pendingPeaceOffer, pendingDefenses };
};

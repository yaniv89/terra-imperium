// src/components/panels/DiplomacyPanel.jsx
// Diplomacy tab: a browsable relations view of all 240 nations, plus per-nation actions — Declare
// War (with casus belli), Fabricate Claim, Sue for Peace, Trade Agreement, Military Alliance,
// Gift/Bribe, Espionage — against src/engine/diplomacy.js's war-goal engine, plus one empire-wide
// action with no chosen target, Cultural Export (Modern age soft power). Plan §M12 adds Rivals,
// Royal Marriage, Break Alliance, Insult, Diplomats (Improve Relations), and the Vassal lifecycle
// (Vassalize/Annex/Release) — see gameReducer.js's own header on that group for what's real vs.
// deferred (Call to Arms/Guarantee Independence need multi-party wars, M13 territory).

import React, { useMemo, useState } from 'react';
import { Search, Swords, Target, HeartHandshake, ShieldCheck, Gift, Flag, Eye, Sparkles, Heart, Users, Crown, Unlock, Ban, AlertTriangle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { WORLD_NATIONS } from '../../data/worldNations';
import { ActionTypes } from '../../data/types';
import {
  ACTION_COSTS, SUE_FOR_PEACE_MIN_GOLD, SUE_FOR_PEACE_BASE_GOLD, ESPIONAGE_SUCCESS_CHANCE, ESPIONAGE_TECH_POINTS_STOLEN,
  CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION,
  MAX_RIVALS, VASSALIZE_HOSTILITY_CEILING, VASSALIZE_STRENGTH_RATIO, VASSAL_ANNEX_COOLDOWN_TURNS, VASSAL_ANNEX_DIP_PER_DEV
} from '../../data/actionCosts';
import { hasCasusBelli, isAtWarWithPlayer, isInTruce } from '../../engine/diplomacy';
import { getSuccessionStyle } from '../../engine/succession';
import { getTotalDev } from '../../engine/development';
import { getNationCapital } from '../../data/regions';
import { getEffectiveAgeId } from '../../data/ages';
import { canAfford, formatNumber, getRelationColor, getFieldedStrength } from '../../utils/helpers';
import { ActionButton } from '../ui';

// Diplomacy actions that travel visibly between the player's capital and the target nation's.
const DIPLOMACY_EFFECT_BY_ACTION = {
  [ActionTypes.DECLARE_WAR]: 'declare_war',
  [ActionTypes.SUE_FOR_PEACE]: 'sue_for_peace',
  [ActionTypes.TRADE_AGREEMENT]: 'trade_agreement',
  [ActionTypes.GIFT_BRIBE]: 'gift_bribe',
  [ActionTypes.FABRICATE_CLAIM]: 'fabricate_claim',
  [ActionTypes.MILITARY_ALLIANCE]: 'military_alliance',
  [ActionTypes.ESPIONAGE]: 'espionage',
  [ActionTypes.RIVAL_NATION]: 'rival_nation',
  [ActionTypes.PROPOSE_MARRIAGE]: 'propose_marriage',
  [ActionTypes.BREAK_ALLIANCE]: 'break_alliance',
  [ActionTypes.INSULT]: 'insult',
  [ActionTypes.ASSIGN_DIPLOMAT]: 'assign_diplomat',
  [ActionTypes.VASSALIZE]: 'vassalize',
  [ActionTypes.RELEASE_VASSAL]: 'release_vassal'
};

const IconButton = ({ icon: Icon, label, onClick, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-[10px]"
  >
    <Icon size={11} />
    {label}
  </button>
);

const DiplomacyPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [search, setSearch] = useState('');

  const dispatchIfAffordable = (type, nationId, costs) => {
    if (!canAfford(state.resources, costs)) return addLog('Not enough resources', 'action');
    const effectType = DIPLOMACY_EFFECT_BY_ACTION[type];
    if (effectType) triggerEffect(effectType, { from: getNationCapital(state.playerNationId), to: getNationCapital(nationId) });
    dispatch({ type, payload: { nationId } });
  };

  const handleCulturalExport = () => {
    if (!canAfford(state.resources, ACTION_COSTS.culturalExport)) return addLog('Not enough resources', 'action');
    triggerEffect('cultural_export', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CULTURAL_EXPORT });
  };
  const isModernAge = getEffectiveAgeId(state.age, state.techAgeId) === 'modern';
  const playerNation = state.nations[state.playerNationId];

  // Sort nations: at war (with the player — n.isAtWar alone just means "in a war with someone",
  // which two AI nations fighting each other would also set) first, then by hostility, so the
  // ones that matter surface first; the search box is for finding one specific nation among all
  // 240.
  const sortedNations = useMemo(() => {
    return Object.values(state.nations)
      .filter(n => !n.isPlayer)
      .filter(n => !search.trim() || n.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        const aAtWar = isAtWarWithPlayer(state, a.id);
        const bAtWar = isAtWarWithPlayer(state, b.id);
        if (aAtWar !== bAtWar) return aAtWar ? -1 : 1;
        return b.hostility - a.hostility;
      });
  }, [state, search]);

  return (
    <div className="space-y-2">
      {isModernAge && (
        <ActionButton
          icon={Sparkles}
          label="Cultural Export"
          description={`Soft power abroad: -${CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION} hostility with every nation, +${CULTURAL_EXPORT_INFLUENCE_GAIN} Cultural Influence (${formatNumber(playerNation?.culturalInfluence || 0)} so far)`}
          costs={ACTION_COSTS.culturalExport}
          onClick={handleCulturalExport}
          disabled={!canAfford(state.resources, ACTION_COSTS.culturalExport)}
          size="small"
        />
      )}
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nations..."
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600">
        {sortedNations.map(nation => {
          const nationData = WORLD_NATIONS[nation.id];
          const atWarWithPlayer = isAtWarWithPlayer(state, nation.id);
          const justified = hasCasusBelli(state, state.playerNationId, nation.id);
          const declareWarCosts = justified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
          const sueForPeaceCosts = { gold: Math.max(SUE_FOR_PEACE_MIN_GOLD, Math.round(SUE_FOR_PEACE_BASE_GOLD - (nation.warExhaustion || 0) * 2)), dip: 1 };

          // Diplomacy overhaul (plan §M12).
          const player = state.nations[state.playerNationId];
          const isRival = (player.rivals || []).includes(nation.id);
          const isVassalOfPlayer = nation.vassalOf === state.playerNationId;
          const truceActive = !atWarWithPlayer && isInTruce(state, state.playerNationId, nation.id);
          const canMarry = !atWarWithPlayer
            && getSuccessionStyle(player.government) === 'hereditary'
            && getSuccessionStyle(nation.government) === 'hereditary'
            && !(player.marriageWith || []).includes(nation.id);
          const hasDiplomatAssigned = (player.diplomatTasks || []).some((t) => t.targetId === nation.id);
          const canAssignDiplomat = !hasDiplomatAssigned && (player.diplomatTasks || []).length < (player.diplomats || 0);
          const canVassalize = !atWarWithPlayer && !nation.vassalOf && nation.id !== state.playerNationId
            && (nation.hostility || 0) <= VASSALIZE_HOSTILITY_CEILING
            && (player.militaryStrength || 0) >= (nation.militaryStrength || 0) * VASSALIZE_STRENGTH_RATIO;
          const vassalTotalDev = isVassalOfPlayer ? Object.values(state.regions).reduce((s, r) => s + (r.owner === nation.id ? getTotalDev(r) : 0), 0) : 0;
          const annexCost = { dip: Math.round(VASSAL_ANNEX_DIP_PER_DEV * vassalTotalDev) };
          const canAnnex = isVassalOfPlayer && state.turnNumber >= (nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS;

          return (
            <div
              key={nation.id}
              className={`
                p-3 rounded-lg border transition-all
                ${atWarWithPlayer
                  ? 'bg-red-500/10 border-red-500/30'
                  : nation.hasPeaceTreaty
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-slate-800/50 border-slate-700'
                }
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: nationData?.color }}
                    />
                    {nation.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-xs font-medium"
                      style={{ color: getRelationColor(nation.relationStatus) }}
                    >
                      {nation.relationStatus}
                    </span>
                    {nation.doctrine && (
                      <span className="text-[9px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1">
                        {nation.doctrine}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-slate-400">
                    Hostility: <span className="text-orange-400 font-mono">{nation.hostility}</span>
                  </div>
                  <div className="text-slate-400">
                    Military: <span className="text-red-400 font-mono">{formatNumber(getFieldedStrength(state, nation.id))}</span>
                  </div>
                  {atWarWithPlayer && (
                    <div className="text-slate-400">
                      War Exhaustion: <span className="text-amber-400 font-mono">{nation.warExhaustion || 0}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {nation.hasPeaceTreaty && (
                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                    ✓ Peace Treaty
                  </span>
                )}
                {nation.hasTradeAgreement && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                    ✓ Trade Agreement
                  </span>
                )}
                {nation.hasMilitaryPact && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">
                    ✓ Military Pact
                  </span>
                )}
                {state.nations[state.playerNationId]?.claims?.includes(nation.id) && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                    ✓ Claim Fabricated
                  </span>
                )}
                {atWarWithPlayer && (
                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] animate-pulse">
                    ⚔ AT WAR
                  </span>
                )}
                {truceActive && (
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px]">
                    Truce (turn {nation.truces?.[state.playerNationId]})
                  </span>
                )}
                {isRival && (
                  <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px]">
                    Rival
                  </span>
                )}
                {isVassalOfPlayer && (
                  <span className="px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded text-[10px]">
                    Your Vassal
                  </span>
                )}
                {hasDiplomatAssigned && (
                  <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 rounded text-[10px]">
                    Diplomat assigned
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {isVassalOfPlayer ? (
                  <>
                    <IconButton
                      icon={Crown}
                      label={`Annex (${formatNumber(annexCost.dip)} DIP)`}
                      title={canAnnex ? 'Absorb this vassal\'s territory into your realm' : `Available turn ${(nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS}`}
                      disabled={!canAnnex || !canAfford(state.resources, annexCost)}
                      onClick={() => dispatch({ type: ActionTypes.ANNEX_VASSAL, payload: { nationId: nation.id } })}
                    />
                    <IconButton
                      icon={Unlock}
                      label="Release"
                      onClick={() => dispatch({ type: ActionTypes.RELEASE_VASSAL, payload: { nationId: nation.id } })}
                    />
                  </>
                ) : atWarWithPlayer ? (
                  <IconButton
                    icon={Flag}
                    label={`Sue for Peace (${sueForPeaceCosts.gold}g)`}
                    title="End the war — cheaper the more war-exhausted they are"
                    disabled={!canAfford(state.resources, sueForPeaceCosts)}
                    onClick={() => dispatchIfAffordable(ActionTypes.SUE_FOR_PEACE, nation.id, sueForPeaceCosts)}
                  />
                ) : (
                  <>
                    <IconButton
                      icon={Swords}
                      label={justified ? 'Declare War' : 'Declare War (unjustified)'}
                      title={justified ? 'A casus belli justifies this war' : 'No casus belli — costs more and hurts relations'}
                      disabled={!canAfford(state.resources, declareWarCosts)}
                      onClick={() => dispatchIfAffordable(ActionTypes.DECLARE_WAR, nation.id, declareWarCosts)}
                    />
                    {!state.nations[state.playerNationId]?.claims?.includes(nation.id) && (
                      <IconButton
                        icon={Target}
                        label="Fabricate Claim"
                        title="Manufacture a casus belli for a future war"
                        disabled={!canAfford(state.resources, ACTION_COSTS.fabricateClaim)}
                        onClick={() => dispatchIfAffordable(ActionTypes.FABRICATE_CLAIM, nation.id, ACTION_COSTS.fabricateClaim)}
                      />
                    )}
                    {!nation.hasTradeAgreement && (
                      <IconButton
                        icon={HeartHandshake}
                        label="Trade Agreement"
                        disabled={!canAfford(state.resources, ACTION_COSTS.tradeAgreement)}
                        onClick={() => dispatchIfAffordable(ActionTypes.TRADE_AGREEMENT, nation.id, ACTION_COSTS.tradeAgreement)}
                      />
                    )}
                    {nation.hasMilitaryPact ? (
                      <IconButton
                        icon={Ban}
                        label="Break Alliance"
                        title="Ends the pact — raises their hostility"
                        onClick={() => dispatchIfAffordable(ActionTypes.BREAK_ALLIANCE, nation.id, {})}
                      />
                    ) : (
                      <IconButton
                        icon={ShieldCheck}
                        label="Alliance"
                        title="Acceptance scores hostility, prestige, and any existing trade agreement"
                        disabled={!canAfford(state.resources, ACTION_COSTS.militaryAlliance)}
                        onClick={() => dispatchIfAffordable(ActionTypes.MILITARY_ALLIANCE, nation.id, ACTION_COSTS.militaryAlliance)}
                      />
                    )}
                    <IconButton
                      icon={Gift}
                      label="Gift"
                      title="Reduces hostility"
                      disabled={!canAfford(state.resources, ACTION_COSTS.giftBribe)}
                      onClick={() => dispatchIfAffordable(ActionTypes.GIFT_BRIBE, nation.id, ACTION_COSTS.giftBribe)}
                    />
                    <IconButton
                      icon={Eye}
                      label="Espionage"
                      title={`Steal ${ESPIONAGE_TECH_POINTS_STOLEN} Tech Points (${Math.round(ESPIONAGE_SUCCESS_CHANCE * 100)}% chance) — if caught, hostility rises`}
                      disabled={!canAfford(state.resources, ACTION_COSTS.espionage)}
                      onClick={() => dispatchIfAffordable(ActionTypes.ESPIONAGE, nation.id, ACTION_COSTS.espionage)}
                    />
                    <IconButton
                      icon={AlertTriangle}
                      label="Insult"
                      title="Free — raises their hostility, for rivalries"
                      onClick={() => dispatchIfAffordable(ActionTypes.INSULT, nation.id, {})}
                    />
                    <IconButton
                      icon={Target}
                      label={isRival ? 'Unrival' : `Rival (${(player.rivals || []).length}/${MAX_RIVALS})`}
                      title={isRival ? 'Stop treating them as a rival' : 'Must border you — a fallen rival grants prestige'}
                      disabled={!isRival && ((player.rivals || []).length >= MAX_RIVALS)}
                      onClick={() => dispatchIfAffordable(isRival ? ActionTypes.UNRIVAL_NATION : ActionTypes.RIVAL_NATION, nation.id, {})}
                    />
                    {canMarry && (
                      <IconButton
                        icon={Heart}
                        label="Royal Marriage"
                        title="Both monarchies — reduces hostility and raises your heir's claim"
                        disabled={!canAfford(state.resources, ACTION_COSTS.proposeMarriage)}
                        onClick={() => dispatchIfAffordable(ActionTypes.PROPOSE_MARRIAGE, nation.id, ACTION_COSTS.proposeMarriage)}
                      />
                    )}
                    {hasDiplomatAssigned ? (
                      <IconButton
                        icon={Users}
                        label="Recall Diplomat"
                        onClick={() => dispatch({ type: ActionTypes.RECALL_DIPLOMAT, payload: { nationId: nation.id } })}
                      />
                    ) : (
                      <IconButton
                        icon={Users}
                        label="Assign Diplomat"
                        title={`Improve Relations — ${(player.diplomatTasks || []).length}/${player.diplomats || 0} diplomats in use`}
                        disabled={!canAssignDiplomat || !canAfford(state.resources, ACTION_COSTS.assignDiplomat)}
                        onClick={() => dispatchIfAffordable(ActionTypes.ASSIGN_DIPLOMAT, nation.id, ACTION_COSTS.assignDiplomat)}
                      />
                    )}
                    {canVassalize && (
                      <IconButton
                        icon={Crown}
                        label="Vassalize"
                        title="Low hostility and overwhelming strength required"
                        disabled={!canAfford(state.resources, ACTION_COSTS.vassalize)}
                        onClick={() => dispatchIfAffordable(ActionTypes.VASSALIZE, nation.id, ACTION_COSTS.vassalize)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-red-400 font-bold">{sortedNations.filter(n => isAtWarWithPlayer(state, n.id)).length}</div>
            <div className="text-slate-500">At War</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">{sortedNations.filter(n => n.hasPeaceTreaty).length}</div>
            <div className="text-slate-500">Peace</div>
          </div>
          <div>
            <div className="text-blue-400 font-bold">{sortedNations.filter(n => n.hasTradeAgreement).length}</div>
            <div className="text-slate-500">Trade</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiplomacyPanel;

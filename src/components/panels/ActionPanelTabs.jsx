// src/components/panels/ActionPanelTabs.jsx
// The tabs of the side panel: Empire, Cities, Research, Peoples (diplomacy), Space, Legacy. The
// rail (PanelDrawer.jsx) shows them on the right edge on every landscape layout and the desktop;
// the bottom bar of a phone held upright shows this row. Field Atlas look: a light underline marks
// the open tab, a small red dot the tabs that need you (plans/UI-DESIGN.md section 2).
import React from 'react';
import { Crown, Building2, FlaskConical, HeartHandshake, Trophy, Satellite } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { TECH_TREE } from '../../data/techTree';
import { nextPrompts } from '../ui/nextPromptModel';

// The War section stays in the Empire sheet (plans/civ-map-rework.md E4); Diplomacy is its own tab
// again as "Peoples" (W07), so the Empire sheet no longer repeats it.
export const TABS = [
  { id: 'domestic', label: 'Empire', icon: Crown },
  { id: 'cities', label: 'Cities', icon: Building2 },
  { id: 'tech', label: 'Research', icon: FlaskConical },
  { id: 'diplomacy', label: 'Peoples', icon: HeartHandshake },
  { id: 'space', label: 'Space', icon: Satellite },
  { id: 'legacy', label: 'Legacy', icon: Trophy }
];

// The tabs the player sees (plans/playtest-1.md P5.3): the Space tab only once the nation has
// researched a Modern Age tech (the space race means nothing before that).
export const spaceUnlocked = (state) => state.techAgeId === 'modern' || Object.keys(state.techTree || {}).some((id) => state.techTree[id]?.researched && TECH_TREE[id]?.ageId === 'modern');
export const visibleTabs = (state) => TABS.filter((t) => t.id !== 'space' || spaceUnlocked(state));

// The count on a tab (also used by the landscape tab rail in PanelDrawer.jsx).
export const getTabBadge = (state, tabId) => {
  switch (tabId) {
    case 'domestic': {
      // Enemy invasions under way: what the War section holds.
      const invasions = (state.invasions || []).filter(i => i.active && !i.isPlayerAttacker).length;
      const wars = Object.values(state.nations).filter(n => !n.isPlayer && isAtWarWithPlayer(state, n.id)).length;
      return wars + invasions > 0 ? wars + invasions : null;
    }
    case 'cities': {
      const n = nextPrompts(state).filter((p) => p.kind === 'city' || p.kind === 'unrest').length;
      return n || null;
    }
    case 'tech':
      return !state.research?.current && !state.research?.auto ? 1 : null;
    case 'diplomacy': {
      const n = (state.pendingPeaceOffer ? 1 : 0) + (state.pendingDemand ? 1 : 0) + (state.tributeDemands || []).length + (state.joinOffers || []).length;
      return n || null;
    }
    default:
      return null;
  }
};

const ActionPanelTabs = ({ activeTab, onTabChange }) => {
  const { state } = useGame();

  return (
    <div className="flex border-b border-fa-line bg-fa-panel overflow-x-auto scrollbar-none" role="tablist" aria-label="Panels">
      {visibleTabs(state).map(tab => {
        const Icon = tab.icon;
        const badge = getTabBadge(state, tab.id);
        return (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-label={tab.label} onClick={() => onTabChange(tab.id)}
            className="fa-tab flex-1 flex-col !gap-0.5 !px-1 !text-[10px] min-w-[3.5rem]">
            <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
            {tab.label}
            {badge > 0 && <span className="absolute top-1.5 right-[calc(50%-16px)] w-2 h-2 rounded-full bg-fa-danger" aria-label={`${badge} waiting`} />}
          </button>
        );
      })}
    </div>
  );
};

export default ActionPanelTabs;

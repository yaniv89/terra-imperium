// src/components/panels/ActionPanelTabs.jsx
// The Empire/Tech/Space/Legacy tab row, split out of ActionPanel.jsx so
// App.jsx's mobile layout can position it independently of the panel content — pinned to the
// bottom of the screen (thumb-reachable) instead of sitting above content, which requires
// scrolling back up past the globe to reach after selecting a region. Desktop keeps the tabs
// visually above the content exactly as before; only the DOM/flex-order relationship changed to
// make that possible without duplicating this component per breakpoint.
import React from 'react';
import { Home, Beaker, Trophy, Satellite } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { TECH_TREE } from '../../data/techTree';
import { TabButton } from '../ui';
import { isAgeAtLeast } from '../../data/ages';

// The Military and Diplomacy tabs are the Empire sheet's War and Relations sections now
// (plans/civ-map-rework.md E4; panelEvents.js aliases the old ids).
export const TABS = [
  { id: 'domestic', label: 'Empire', icon: Home },
  { id: 'tech', label: 'Tech', icon: Beaker },
  { id: 'space', label: 'Space', icon: Satellite },
  { id: 'legacy', label: 'Legacy', icon: Trophy }
];

// The tabs the player sees (plans/playtest-1.md P5.3): the Space tab only once the nation has
// researched a Modern Age tech (the space race means nothing before that).
export const spaceUnlocked = (state) => isAgeAtLeast(state.techAgeId, 'modern') || Object.keys(state.techTree || {}).some((id) => state.techTree[id]?.researched && isAgeAtLeast(TECH_TREE[id]?.ageId, 'modern'));
export const visibleTabs = (state) => TABS.filter((t) => t.id !== 'space' || spaceUnlocked(state));

// The red count on a tab (also used by the landscape tab rail in PanelDrawer.jsx).
export const getTabBadge = (state, tabId) => {
  switch (tabId) {
    case 'domestic': {
      // Wars with the player (n.isAtWar alone is "in a war with anyone") plus enemy invasions
      // under way: what the War and Relations sections hold.
      const invasions = (state.invasions || []).filter(i => i.active && !i.isPlayerAttacker).length;
      const wars = Object.values(state.nations).filter(n => !n.isPlayer && isAtWarWithPlayer(state, n.id)).length;
      return wars + invasions > 0 ? wars + invasions : null;
    }
    default:
      return null;
  }
};

const ActionPanelTabs = ({ activeTab, onTabChange }) => {
  const { state } = useGame();

  return (
    <div className="flex border-b border-slate-700 bg-slate-800/50">
      {visibleTabs(state).map(tab => (
        <TabButton
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          badge={getTabBadge(state, tab.id)}
        />
      ))}
    </div>
  );
};

export default ActionPanelTabs;

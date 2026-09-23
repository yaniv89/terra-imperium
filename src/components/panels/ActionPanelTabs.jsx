// src/components/panels/ActionPanelTabs.jsx
// The Domestic/Military/Diplomacy/Tech/Space/Legacy tab row, split out of ActionPanel.jsx so
// App.jsx's mobile layout can position it independently of the panel content — pinned to the
// bottom of the screen (thumb-reachable) instead of sitting above content, which requires
// scrolling back up past the globe to reach after selecting a region. Desktop keeps the tabs
// visually above the content exactly as before; only the DOM/flex-order relationship changed to
// make that possible without duplicating this component per breakpoint.
import React from 'react';
import { Home, Swords, Flag, Beaker, Trophy, Satellite } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { TabButton } from '../ui';

export const TABS = [
  { id: 'domestic', label: 'Domestic', icon: Home },
  { id: 'military', label: 'Military', icon: Swords },
  { id: 'diplomacy', label: 'Diplomacy', icon: Flag },
  { id: 'tech', label: 'Tech', icon: Beaker },
  { id: 'space', label: 'Space', icon: Satellite },
  { id: 'legacy', label: 'Legacy', icon: Trophy }
];

const ActionPanelTabs = ({ activeTab, onTabChange }) => {
  const { state } = useGame();

  const getTabBadge = (tabId) => {
    switch (tabId) {
      case 'military': {
        // Show number of active invasions
        const invasions = state.invasions.filter(i => i.active && !i.isPlayerAttacker).length;
        return invasions > 0 ? invasions : null;
      }
      case 'diplomacy': {
        // Show number of nations at war WITH THE PLAYER — n.isAtWar alone is "in a war with
        // anyone", which would badge this tab for wars the player has nothing to do with.
        const wars = Object.values(state.nations).filter(n => !n.isPlayer && isAtWarWithPlayer(state, n.id)).length;
        return wars > 0 ? wars : null;
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex border-b border-slate-700 bg-slate-800/50">
      {TABS.map(tab => (
        <TabButton
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          badge={getTabBadge(tab.id)}
        />
      ))}
    </div>
  );
};

export default ActionPanelTabs;

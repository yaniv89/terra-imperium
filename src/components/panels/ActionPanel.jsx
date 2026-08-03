// src/components/panels/ActionPanel.jsx
// Main action panel container with tabs for Domestic, Military, Diplomacy, Tech

import React, { useState } from 'react';
// FIX: Replaced 'Handshake' with 'Flag' to resolve the export error
import { Home, Swords, Flag, Beaker } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { TabButton } from '../ui';
import DomesticPanel from './DomesticPanel';
import MilitaryPanel from './MilitaryPanel';
import DiplomacyPanel from './DiplomacyPanel';
import TechPanel from './TechPanel';

const TABS = [
  { id: 'domestic', label: 'Domestic', icon: Home },
  { id: 'military', label: 'Military', icon: Swords },
  // FIX: Using Flag icon for Diplomacy tab
  { id: 'diplomacy', label: 'Diplomacy', icon: Flag },
  { id: 'tech', label: 'Tech', icon: Beaker }
];

const ActionPanel = ({ selectedRegion }) => {
  const [activeTab, setActiveTab] = useState('domestic');
  const { state } = useGame();

  // Calculate badges for tabs
  const getTabBadge = (tabId) => {
    switch (tabId) {
      case 'military': {
        // Show number of active invasions
        const invasions = state.invasions.filter(i => i.active && !i.isPlayerAttacker).length;
        return invasions > 0 ? invasions : null;
      }
      case 'diplomacy': {
        // Show number of nations at war
        const wars = Object.values(state.nations).filter(n => n.isAtWar).length;
        return wars > 0 ? wars : null;
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 w-80 shrink-0 shadow-xl z-20 w-full">

      {/* Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-800/50">
        {TABS.map(tab => (
          <TabButton
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            isActive={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            badge={getTabBadge(tab.id)}
          />
        ))}
      </div>


      {/* Panel Content */}
      <div className="flex-1 overflow-y-scroll p-4 relative">
        {activeTab === 'domestic' && (
          <DomesticPanel selectedRegion={selectedRegion} />
        )}
        {activeTab === 'military' && (
          <MilitaryPanel selectedRegion={selectedRegion} />
        )}
        {activeTab === 'diplomacy' && (
          <DiplomacyPanel />
        )}
        {activeTab === 'tech' && (
          <TechPanel />
        )}
      </div>

    </div>

  );
};

export default ActionPanel;
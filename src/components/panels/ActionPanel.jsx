// src/components/panels/ActionPanel.jsx
// Renders the content for whichever tab is active (Domestic/Military/Diplomacy/Tech/Space/
// Legacy). Tab SELECTION lives in ActionPanelTabs.jsx / GameLayout (App.jsx) now, not here — see
// ActionPanelTabs.jsx's comment for why the two were split.
import React from 'react';
import DomesticPanel from './DomesticPanel';
import MilitaryPanel from './MilitaryPanel';
import DiplomacyPanel from './DiplomacyPanel';
import TechPanel from './TechPanel';
import SpacePanel from './SpacePanel';
import LegacyPanel from './LegacyPanel';

const ActionPanel = ({ activeTab, selectedRegion }) => {
  return (
    <div className="flex-1 overflow-y-scroll p-4 relative bg-slate-900">
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
      {activeTab === 'space' && (
        <SpacePanel />
      )}
      {activeTab === 'legacy' && (
        <LegacyPanel />
      )}
    </div>
  );
};

export default ActionPanel;

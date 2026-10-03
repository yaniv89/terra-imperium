// src/components/panels/ActionPanel.jsx
// Renders the content for whichever tab is active (Empire/Tech/Space/Legacy; the Military and
// Diplomacy panels live inside the Empire sheet as its War and Relations sections). Tab SELECTION lives in ActionPanelTabs.jsx / GameLayout (App.jsx) now, not here — see
// ActionPanelTabs.jsx's comment for why the two were split.
import React from 'react';
import DomesticPanel from './DomesticPanel';
import TechPanel from './TechPanel';
import SpacePanel from './SpacePanel';
import LegacyPanel from './LegacyPanel';

const ActionPanel = ({ activeTab }) => {
  return (
    <div className="flex-1 overflow-y-scroll p-4 relative bg-slate-900">
      {activeTab === 'domestic' && (
        <DomesticPanel />
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

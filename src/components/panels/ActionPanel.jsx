// src/components/panels/ActionPanel.jsx
// Renders the content for whichever tab is active: Empire (with its War section), Cities, Research,
// Peoples (diplomacy), Space and Legacy. Tab SELECTION lives in ActionPanelTabs.jsx / the rail in
// PanelDrawer.jsx / GameLayout (App.jsx), not here.
import React from 'react';
import DomesticPanel from './DomesticPanel';
import TechPanel from './TechPanel';
import SpacePanel from './SpacePanel';
import LegacyPanel from './LegacyPanel';
import DiplomacyPanel from './DiplomacyPanel';
import CityList from '../city/CityList';
import { selectRegion } from '../map/marchEvents';

const ActionPanel = ({ activeTab }) => {
  return (
    <div className={`flex-1 overflow-y-auto overscroll-contain relative bg-fa-panel text-fa-text ${activeTab === 'cities' || activeTab === 'tech' ? '' : 'p-3 sm:p-4'}`} data-testid="action-panel">
      {activeTab === 'domestic' && (
        <DomesticPanel />
      )}
      {activeTab === 'cities' && (
        <div>
          <div className="px-4 pt-3 pb-2 flex items-baseline gap-2"><h2 className="fa-heading text-[19px]">Cities</h2><span className="text-[12px] text-fa-muted">tap one to open it</span></div>
          <CityList onSelect={selectRegion} compact />
        </div>
      )}
      {activeTab === 'tech' && (
        <TechPanel />
      )}
      {activeTab === 'diplomacy' && (
        <DiplomacyPanel />
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

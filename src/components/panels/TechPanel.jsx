// src/components/panels/TechPanel.jsx
// Research tab. TECH_TREE content is empty for now — the ~50-tech, 5-line, age-gated tree
// described in the plan is Phase D work, built on top of the same canResearchTech gating this
// panel already reads from.

import React from 'react';
import { Beaker } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { TECH_TREE } from '../../data/techTree';

const TechPanel = () => {
  const { state } = useGame();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white font-bold text-lg">
        <Beaker size={20} className="text-purple-400" />
        Research
      </div>
      <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Researched:</span>
          <span className="font-mono text-purple-400">
            {Object.values(state.techTree).filter(t => t.researched).length} / {Object.keys(TECH_TREE).length}
          </span>
        </div>
      </div>
      <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
        The technology tree (Military, Economy, Infrastructure, Governance, Science) is coming in a future update.
      </div>
    </div>
  );
};

export default TechPanel;

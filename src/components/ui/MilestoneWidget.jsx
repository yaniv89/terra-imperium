// src/components/ui/MilestoneWidget.jsx
// "Next milestone" dashboard widget (Phase 10) — always shows the player the win condition (or
// tech) closest to completion, so there's always something visibly "just out of reach".

import React from 'react';
import { Target } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { computeMilestones } from '../../utils/milestones';
import ProgressBar from './ProgressBar';

const MilestoneWidget = () => {
  const { state } = useGame();
  const milestones = computeMilestones(state);
  if (milestones.length === 0) return null;

  const top = milestones[0];

  return (
    <div className="p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 mb-1.5">
        <Target className="w-3.5 h-3.5" />
        {top.label}
      </div>
      <ProgressBar value={top.progress * 100} color="purple" size="small" />
      <div className="text-[9px] text-slate-500 mt-1">{top.detail}</div>
    </div>
  );
};

export default MilestoneWidget;

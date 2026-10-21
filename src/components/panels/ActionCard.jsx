// src/components/panels/ActionCard.jsx
// A raised action card with its price and what it buys, the way ui/ActionButton draws it, but with the
// price already written in the current language (ActionButton writes "Cost:" and "Gold" itself).
import React from 'react';
import { t as tNow } from '../../i18n/core';
import { useWhy } from '../ui/WhyTip';

// `why`: the reason a disabled card is blocked, shown on tap (WhyTip.jsx).
const ActionCard = ({ icon: Icon, label, description, cost, effect, onClick, disabled = false, why: reason = null }) => {
  const [why, bubble] = useWhy();
  return (<>
  <button type="button" {...why(disabled, reason, onClick)}
    className={`w-full rounded-lg border transition-all flex items-start text-start p-2 gap-2 min-h-[44px] bg-fa-raised hover:bg-fa-hover border-fa-line text-fa-text ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] cursor-pointer'}`}>
    {Icon && <div className="shrink-0 mt-0.5"><Icon className="w-4 h-4" aria-hidden="true" /></div>}
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-sm leading-tight">{label}</div>
      {description && <div className="text-xs text-fa-muted mt-0.5 leading-tight">{description}</div>}
      {(cost || effect) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs font-mono">
          {cost && <span className="text-fa-muted">{tNow('p2.act.cost', { cost })}</span>}
          {effect && <span className="text-fa-good"><span className="inline-block rtl:-scale-x-100">→</span> {effect}</span>}
        </div>
      )}
    </div>
  </button>
  {bubble}
  </>);
};

export default ActionCard;

// src/components/ui/ResourceBar.jsx
// Resource bar showing all of the player's currently-unlocked resources, plus meta-currencies
// and military strength, with expand on click.

import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { getUnlockedResourceIds } from '../../data/resources';
import { getFieldedStrength, getPowerBreakdown, getPowerIncome } from '../../utils/helpers';
import ResourceBadge from './ResourceBadge';
import Breakdown from './Breakdown';
import { POWER_POOL_HELP } from '../../data/powerPools';

// `wrap`: the top bar's "All your stores" list. There every badge carries its name: a phone has no
// hover, so the bare icons and numbers could not be told apart (playtest audit I163).
const ResourceBar = ({ wrap = false }) => {
  const { state } = useGame();
  const [expandedResource, setExpandedResource] = useState(null);

  const handleToggle = (type) => {
    setExpandedResource(prev => prev === type ? null : type);
  };

  const unlockedResourceIds = getUnlockedResourceIds(state.age);
  // The live per-turn income (ruler, advisors, government, tech...), the same number the tooltip
  // breaks down. resources.maxAdm/maxDip/maxMil only refresh when a turn resolves, so reading them
  // showed a flat +3 on turn one (and +0 on some migrated saves) instead of what you'll really get.
  const powerIncome = getPowerIncome(state);

  return (
    // flex-nowrap, not flex-wrap: the parent (GameHeader) already wraps this in an
    // overflow-x-auto scroller, expecting ONE horizontally-scrollable row — flex-wrap fought that
    // by wrapping into two full rows instead of letting the row scroll, which is what pushed all
    // of a phone's resource badges into a tall, always-visible block above the game content.
    // shrink-0 on every badge keeps each one at its natural width instead of being squeezed.
    <div className={`flex ${wrap ? 'flex-wrap' : 'flex-nowrap'} gap-1.5 sm:gap-2 [&>*]:shrink-0`}>
      {['adm', 'dip', 'mil'].map((pool) => (
        <ResourceBadge
          key={pool}
          type={pool}
          value={state.resources[pool]}
          perTurn={powerIncome[pool]}
          showLabel={wrap}
          expanded={expandedResource === pool}
          onClick={() => handleToggle(pool)}
          tooltipContent={(
            <div>
              <div className="font-semibold mb-1">{POWER_POOL_HELP[pool].name} ({pool.toUpperCase()}) each turn</div>
              <Breakdown rows={getPowerBreakdown(state, state.playerNationId, pool)} />
              <div className="mt-1 text-[11px] text-fa-muted max-w-[16rem] space-y-0.5" data-testid={`pool-help-${pool}`}><div>{POWER_POOL_HELP[pool].earns}</div><div>{POWER_POOL_HELP[pool].spends}</div><div>Unspent points are saved for later turns.</div></div>
            </div>
          )}
        />
      ))}

      {wrap && POWER_POOL_HELP[expandedResource] && (
        // A phone has no hover: tapping ADM, DIP or MIL in the top bar sheet opens its explanation here.
        <div className="basis-full text-[11px] text-fa-muted space-y-0.5 bg-fa-raised/60 rounded-lg p-2" data-testid={`pool-explain-${expandedResource}`}>
          <div className="font-semibold text-fa-text">{POWER_POOL_HELP[expandedResource].name}</div>
          <Breakdown rows={getPowerBreakdown(state, state.playerNationId, expandedResource)} />
          <div>{POWER_POOL_HELP[expandedResource].earns}</div>
          <div>{POWER_POOL_HELP[expandedResource].spends}</div>
          <div>Unspent points are saved for later turns.</div>
        </div>
      )}

      {unlockedResourceIds.map(resourceId => (
        <ResourceBadge
          key={resourceId}
          type={resourceId}
          value={state.resources[resourceId] || 0}
          showLabel={wrap}
          expanded={expandedResource === resourceId}
          onClick={() => handleToggle(resourceId)}
        />
      ))}

      <ResourceBadge
        type="techPoints"
        value={state.resources.techPoints}
        showLabel={wrap}
        expanded={expandedResource === 'techPoints'}
        onClick={() => handleToggle('techPoints')}
      />

      <ResourceBadge
        type="militaryStrength"
        value={getFieldedStrength(state, state.playerNationId)}
        showLabel={wrap}
        expanded={expandedResource === 'military'}
        onClick={() => handleToggle('military')}
      />
    </div>
  );
};

export default ResourceBar;

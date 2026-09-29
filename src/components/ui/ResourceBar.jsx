// src/components/ui/ResourceBar.jsx
// Resource bar showing all of the player's currently-unlocked resources, plus meta-currencies
// and military strength, with expand on click.

import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { getUnlockedResourceIds } from '../../data/resources';
import { getFieldedStrength, getPowerBreakdown, getPowerIncome } from '../../utils/helpers';
import ResourceBadge from './ResourceBadge';
import Breakdown from './Breakdown';
import { POWER_POOL_CAP } from '../../data/actionCosts';

const ResourceBar = () => {
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
    <div className="flex flex-nowrap gap-1.5 sm:gap-2 [&>*]:shrink-0">
      {['adm', 'dip', 'mil'].map((pool) => (
        <ResourceBadge
          key={pool}
          type={pool}
          value={state.resources[pool]}
          perTurn={powerIncome[pool]}
          expanded={expandedResource === pool}
          onClick={() => handleToggle(pool)}
          tooltipContent={(
            <div>
              <div className="font-semibold mb-1">{pool.toUpperCase()} per turn (banks up to {POWER_POOL_CAP})</div>
              <Breakdown rows={getPowerBreakdown(state, state.playerNationId, pool)} />
            </div>
          )}
        />
      ))}

      {unlockedResourceIds.map(resourceId => (
        <ResourceBadge
          key={resourceId}
          type={resourceId}
          value={state.resources[resourceId] || 0}
          expanded={expandedResource === resourceId}
          onClick={() => handleToggle(resourceId)}
        />
      ))}

      <ResourceBadge
        type="techPoints"
        value={state.resources.techPoints}
        expanded={expandedResource === 'techPoints'}
        onClick={() => handleToggle('techPoints')}
      />

      <ResourceBadge
        type="militaryStrength"
        value={getFieldedStrength(state, state.playerNationId)}
        expanded={expandedResource === 'military'}
        onClick={() => handleToggle('military')}
      />
    </div>
  );
};

export default ResourceBar;

// src/components/ui/ResourceBar.jsx
// Resource bar showing all of the player's currently-unlocked resources, plus meta-currencies
// and military strength, with expand on click.

import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { getUnlockedResourceIds } from '../../data/resources';
import { getFieldedStrength } from '../../utils/helpers';
import ResourceBadge from './ResourceBadge';

const ResourceBar = () => {
  const { state } = useGame();
  const [expandedResource, setExpandedResource] = useState(null);

  const handleToggle = (type) => {
    setExpandedResource(prev => prev === type ? null : type);
  };

  const unlockedResourceIds = getUnlockedResourceIds(state.age);

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
          maxValue={state.resources[`max${pool[0].toUpperCase()}${pool.slice(1)}`]}
          expanded={expandedResource === pool}
          onClick={() => handleToggle(pool)}
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

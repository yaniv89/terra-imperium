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
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      <ResourceBadge
        type="actionPoints"
        value={state.resources.actionPoints}
        maxValue={state.resources.maxActionPoints}
        expanded={expandedResource === 'actionPoints'}
        onClick={() => handleToggle('actionPoints')}
      />

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
        type="diplomacyPoints"
        value={state.resources.diplomacyPoints}
        expanded={expandedResource === 'diplomacyPoints'}
        onClick={() => handleToggle('diplomacyPoints')}
      />

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

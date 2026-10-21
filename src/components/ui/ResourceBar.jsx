// src/components/ui/ResourceBar.jsx
// Resource bar showing all of the player's currently-unlocked resources, plus meta-currencies
// and military strength, with expand on click.

import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { getUnlockedResourceIds } from '../../data/resources';
import { getFieldedStrength } from '../../utils/helpers';
import ResourceBadge from './ResourceBadge';
import { decreesOf, decreeCap } from '../../engine/decrees';
import { ageOf } from '../../engine/nationState';

// `wrap`: the top bar's "All your stores" list. There every badge carries its name: a phone has no
// hover, so the bare icons and numbers could not be told apart (playtest audit I163).
const ResourceBar = ({ wrap = false }) => {
  const { state } = useGame();
  const [expandedResource, setExpandedResource] = useState(null);

  const handleToggle = (type) => {
    setExpandedResource(prev => prev === type ? null : type);
  };

  const unlockedResourceIds = getUnlockedResourceIds(ageOf(state, state.playerNationId));
  const player = state.nations?.[state.playerNationId];

  return (
    // flex-nowrap, not flex-wrap: the parent (GameHeader) already wraps this in an
    // overflow-x-auto scroller, expecting ONE horizontally-scrollable row — flex-wrap fought that
    // by wrapping into two full rows instead of letting the row scroll, which is what pushed all
    // of a phone's resource badges into a tall, always-visible block above the game content.
    // shrink-0 on every badge keeps each one at its natural width instead of being squeezed.
    <div className={`flex ${wrap ? 'flex-wrap' : 'flex-nowrap'} gap-1.5 sm:gap-2 [&>*]:shrink-0`}>
      {/* The ruler's decrees replace the ADM/DIP/MIL pools (differentiation plan U7; U9 adds the reasons). */}
      <ResourceBadge type="decrees" value={decreesOf(player)} maxValue={decreeCap(player)} showLabel={wrap} />

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

// src/components/ui/icons.jsx
// The game's things as icons: the delivered art (src/data/icons.js) where it exists, else the old
// game-icons.net silhouette (unitIcons.js / buildingIcons.js) or lucide glyph, so every id draws
// something. Sizes are CSS pixels; each renders a fixed box, so loading never shifts the layout.
import React from 'react';
import { Gem, Landmark } from 'lucide-react';
import GameIcon from './GameIcon';
import {
  buildingIconUrl, extractionIconUrl, unitIconUrl, shipIconUrl, wonderIconUrl,
  resourceIconUrl, improvementIconUrl, ageIconUrl
} from '../../data/icons';
import { getBuildingIconPath, getExtractionIconPath } from '../../data/buildingIcons';
import { getUnitIconPath } from '../../data/unitIcons';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { WONDER_ICONS } from '../city/wonderIcons';

/** A game-icons.net silhouette (0..512 viewBox), recoloured through currentColor. */
export const PathIcon = ({ path, size = 20, className = '' }) => (path
  ? <svg viewBox="0 0 512 512" width={size} height={size} className={`shrink-0 ${className}`} fill="currentColor" aria-hidden="true"><path d={path} /></svg>
  : <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />);

/** A building tier (category + tier index). */
export const BuildingIcon = ({ category, tier, size = 20, className = '' }) => {
  const age = BUILDING_CATEGORIES[category]?.tiers[Math.max(0, tier)]?.age;
  return (
    <GameIcon url={buildingIconUrl(category, Math.max(0, tier))} size={size} className={className}
      fallback={<PathIcon path={getBuildingIconPath(category, age)} size={size} className={`text-amber-300 ${className}`} />} />
  );
};

/** An extraction building, by its resource (copper, iron, oil). */
export const ExtractionIcon = ({ resourceId, size = 20, className = '' }) => (
  <GameIcon url={extractionIconUrl(resourceId)} size={size} className={className}
    fallback={<PathIcon path={getExtractionIconPath(resourceId)} size={size} className={className} />} />
);

/** A unit: land units by class, naval units by their line (warship, transport, raider, carrier). */
export const UnitIcon = ({ classId, navalLine = null, ageId = 'bronze', size = 20, className = '' }) => {
  const url = classId === 'naval' ? shipIconUrl(navalLine) : unitIconUrl(classId);
  return (
    <GameIcon url={url} size={size} className={className}
      fallback={<PathIcon path={getUnitIconPath(ageId, classId)} size={size} className={`text-slate-200 ${className}`} />} />
  );
};

/** A wonder (great project id). */
export const WonderIcon = ({ projectId, size = 20, className = '' }) => {
  const Glyph = WONDER_ICONS[projectId] || Landmark;
  return (
    <GameIcon url={wonderIconUrl(projectId)} size={size} className={className}
      fallback={<Glyph className={`shrink-0 text-yellow-200 ${className}`} style={{ width: size, height: size }} aria-hidden="true" />} />
  );
};

/** A map resource (wheat, horses, iron ...). */
export const ResourceIcon = ({ resourceId, size = 16, className = '' }) => (
  <GameIcon url={resourceIconUrl(resourceId)} size={size} className={className} title={resourceId}
    fallback={<Gem className={`shrink-0 text-fuchsia-300 ${className}`} style={{ width: size, height: size }} aria-hidden="true" />} />
);

/** A tile improvement (farm, mine, road ...). */
export const ImprovementIcon = ({ improvementId, size = 16, className = '' }) => (
  <GameIcon url={improvementIconUrl(improvementId)} size={size} className={className} />
);

/** An age (bronze ... modern). */
export const AgeIcon = ({ ageId, size = 16, className = '' }) => (
  <GameIcon url={ageIconUrl(ageId)} size={size} className={className} />
);

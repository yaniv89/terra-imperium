// src/components/ui/ResourceBadge.jsx
// Individual resource badge component with expand/collapse functionality

import React from 'react';
import { Coins, Users, Beaker, Swords, Hammer, Flame, Fuel, Gem, ScrollText, Package } from 'lucide-react';
import { formatNumber } from '../../utils/helpers';
import Tooltip from './Tooltip';
import GameIcon from './GameIcon';
import { resourceIconUrl } from '../../data/icons';
import { useT } from '../../i18n/useT';

const RESOURCE_CONFIG = {
  gold: {
    icon: Coins,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    label: 'Gold'
  },
  hr: {
    icon: Users,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    label: 'HR',
    description: 'HR (Manpower)'
  },
  supplies: {
    icon: Package,
    color: 'text-lime-300',
    bgColor: 'bg-lime-500/20',
    label: 'Supplies',
    description: 'Supplies: foraged by your provinces, made by Industry from metal, eaten by armies campaigning abroad'
  },
  copper: {
    icon: Hammer,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    label: 'Copper'
  },
  iron: {
    icon: Flame,
    color: 'text-slate-300',
    bgColor: 'bg-slate-500/20',
    label: 'Iron'
  },
  oil: {
    icon: Fuel,
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-500/20',
    label: 'Oil'
  },
  rareMetals: {
    icon: Gem,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    label: 'Rare Metals'
  },
  techPoints: {
    icon: Beaker,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    label: 'Tech Points'
  },
  // The ruler's decrees (src/engine/decrees.js), shown as banked / cap.
  decrees: {
    icon: ScrollText,
    color: 'text-amber-300',
    bgColor: 'bg-amber-500/20',
    label: 'Decrees',
    description: 'Decrees: earned by deeds, spent on the great acts of state'
  },
  militaryStrength: {
    icon: Swords,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Military Strength'
  }
};

const ResourceBadge = ({
  type,
  value,
  maxValue = null,
  perTurn = null, // shown as a small "+N" after the banked value
  expanded = false,
  onClick = null,
  showLabel = false,
  size = 'normal', // 'small', 'normal', 'large'
  tooltipContent = null // plan §M20: overrides the flat description with a real breakdown (e.g. an income)
}) => {
  const { t, tx } = useT();
  const config = RESOURCE_CONFIG[type];
  if (!config) return null;
  const label = t(`res.${type}`);
  const description = tx(`res.${type}.desc`, null);

  const Icon = config.icon;
  // Power pools (perTurn set) show their exact banked amount — they bank into the thousands, and an
  // abbreviated "1.2K ADM" would hide whether a 1,250-ADM action is actually affordable.
  const displayValue = maxValue !== null
    ? `${value}/${maxValue}`
    : (perTurn !== null && typeof value === 'number' ? String(Math.floor(value)) : (typeof value === 'number' ? formatNumber(value) : value));

  const sizeClasses = {
    small: 'px-1.5 py-0.5 text-xs gap-1',
    normal: 'px-2 py-1 text-sm gap-1.5',
    large: 'px-3 py-1.5 text-base gap-2'
  };

  const iconSizes = {
    small: 12,
    normal: 14,
    large: 18
  };

  return (
    <Tooltip content={tooltipContent || description || label}>
      <button
        onClick={onClick}
        disabled={!onClick}
        className={`
          flex items-center rounded-lg transition-all border
          ${sizeClasses[size]}
          ${expanded ? 'bg-fa-raised border-transparent shadow-[inset_0_0_0_2px_#ECE5D3]' : 'bg-fa-raised border-fa-line hover:bg-fa-hover'}
          ${onClick ? 'cursor-pointer' : 'cursor-default'}
          disabled:cursor-default
        `}
      >
        {/* Gold and the metals have delivered art (src/data/icons.js); the abstract pools keep lucide.
            The art draws a little larger than the glyph so it reads at phone size. */}
        <span className={`${config.color} inline-flex`}>
          <GameIcon url={resourceIconUrl(type)} size={iconSizes[size] + 4} title={label} fallback={<Icon size={iconSizes[size]} />} />
        </span>
        <span className="font-mono font-semibold text-fa-text">
          {displayValue}
        </span>
        {perTurn !== null && (
          <span className="font-mono text-[10px] text-fa-good">+{perTurn}</span>
        )}
        {(expanded || showLabel) && (
          <span className="text-fa-muted ms-1 text-xs">
            {label}
          </span>
        )}
      </button>
    </Tooltip>
  );
};

export default ResourceBadge;

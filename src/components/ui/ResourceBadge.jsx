// src/components/ui/ResourceBadge.jsx
// Individual resource badge component with expand/collapse functionality

import React from 'react';
import { Coins, Users, Beaker, Swords, Hammer, Flame, Fuel, Gem, Atom, ScrollText, Landmark } from 'lucide-react';
import { formatNumber } from '../../utils/helpers';
import Tooltip from './Tooltip';

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
  helium3: {
    icon: Atom,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    label: 'Helium-3'
  },
  techPoints: {
    icon: Beaker,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    label: 'Tech Points'
  },
  // Plan §M2's three power pools, replacing the old single actionPoints + diplomacyPoints pair —
  // ADM (administration/economy/government), DIP (diplomacy/research/space), MIL (military).
  adm: {
    icon: ScrollText,
    color: 'text-amber-300',
    bgColor: 'bg-amber-500/20',
    label: 'ADM',
    description: 'Administrative Power — domestic, economic and government actions'
  },
  dip: {
    icon: Landmark,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'DIP',
    description: 'Diplomatic Power — diplomacy, research and space actions'
  },
  mil: {
    icon: Swords,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'MIL',
    description: 'Military Power — recruitment, fleets and warfare actions'
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
  expanded = false, 
  onClick = null,
  showLabel = false,
  size = 'normal' // 'small', 'normal', 'large'
}) => {
  const config = RESOURCE_CONFIG[type];
  if (!config) return null;

  const Icon = config.icon;
  const displayValue = maxValue !== null 
    ? `${value}/${maxValue}` 
    : (typeof value === 'number' ? formatNumber(value) : value);

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
    <Tooltip content={config.description || config.label}>
      <button
        onClick={onClick}
        disabled={!onClick}
        className={`
          flex items-center rounded-lg transition-all
          ${sizeClasses[size]}
          ${expanded ? 'bg-slate-700 ring-1 ring-blue-400' : 'bg-slate-800/60 hover:bg-slate-700/80'}
          ${onClick ? 'cursor-pointer' : 'cursor-default'}
          disabled:cursor-default
        `}
      >
        <span className={config.color}>
          <Icon size={iconSizes[size]} />
        </span>
        <span className="font-mono font-bold text-white">
          {displayValue}
        </span>
        {(expanded || showLabel) && (
          <span className="text-slate-400 ml-1 text-xs">
            {config.label}
          </span>
        )}
      </button>
    </Tooltip>
  );
};

export default ResourceBadge;

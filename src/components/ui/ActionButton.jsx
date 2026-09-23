// src/components/ui/ActionButton.jsx
// Reusable action button component with cost and effect display

import React from 'react';
import { getCostString, getResourceStrain } from '../../utils/helpers';

const VARIANT_STYLES = {
  default: 'bg-slate-700/80 hover:bg-slate-600 border-slate-600 text-slate-100',
  primary: 'bg-blue-600/80 hover:bg-blue-500 border-blue-500 text-white',
  success: 'bg-green-600/20 hover:bg-green-600/30 border-green-500/50 text-green-400',
  warning: 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/50 text-amber-400',
  danger: 'bg-red-600/20 hover:bg-red-600/30 border-red-500/50 text-red-400',
  purple: 'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/50 text-purple-400'
};

const formatCost = (costs) => {
  if (!costs) return null;
  const str = getCostString(costs);
  return str || null;
};

const formatEffect = (effects) => {
  if (!effects) return null;
  const parts = [];

  if (effects.control) parts.push(`+${effects.control}% Control`);
  if (effects.infrastructure) parts.push(`+${effects.infrastructure} Infra`);
  if (effects.defense) parts.push(`+${effects.defense} Defense`);
  if (effects.unrest) parts.push(`-${effects.unrest} Unrest`);
  if (effects.hostilityReduction) parts.push(`-${effects.hostilityReduction} Hostility`);
  if (effects.custom) parts.push(effects.custom);

  return parts.length > 0 ? parts.join(', ') : null;
};

const ActionButton = ({
  icon: Icon,
  label,
  description,
  costs = null,
  effects = null,
  onClick,
  disabled = false,
  variant = 'default',
  size = 'normal', // 'small', 'normal', 'large'
  className = '',
  // Optional: pass the current resources pool to surface a "this uses most/all of your X" warning
  // (turn-1 government adoption, first unit recruit) — inert when omitted, every other call site
  // is unaffected.
  resources = null
}) => {
  const costString = formatCost(costs);
  const effectString = formatEffect(effects);
  const strain = costs && resources ? getResourceStrain(costs, resources) : null;

  const sizeClasses = {
    small: 'p-2 gap-2',
    normal: 'p-3 gap-3',
    large: 'p-4 gap-4'
  };

  const iconSizes = {
    small: 'w-4 h-4',
    normal: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full rounded-lg border transition-all flex items-start text-left
        ${sizeClasses[size]}
        ${VARIANT_STYLES[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] cursor-pointer'}
        ${className}
      `}
    >
      {/* Icon */}
      {Icon && (
        <div className="shrink-0 mt-0.5">
          <Icon className={iconSizes[size]} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label */}
        <div className="font-semibold text-sm leading-tight">
          {label}
        </div>

        {/* Description */}
        {description && (
          <div className="text-xs text-slate-400 mt-0.5 leading-tight">
            {description}
          </div>
        )}

        {/* Cost and Effect Row */}
        {(costString || effectString) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs font-mono">
            {/* Cost */}
            {costString && (
              <span className={strain ? `${strain.level === 'critical' ? 'text-red-400' : 'text-amber-400'} font-semibold` : 'text-red-400/90'}>
                Cost: {costString}
              </span>
            )}
            {/* Effect */}
            {effectString && (
              <span className="text-green-400/90">
                → {effectString}
              </span>
            )}
          </div>
        )}

        {/* Resource strain warning */}
        {strain && (
          <div className={`text-xs mt-1 ${strain.level === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
            ⚠ Uses {strain.level === 'critical' ? 'all' : 'most'} of your {strain.label}
          </div>
        )}
      </div>
    </button>
  );
};

export default ActionButton;

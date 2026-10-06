// src/components/ui/ActionButton.jsx
// Reusable action button component with cost and effect display

import React from 'react';
import { getCostString, getResourceStrain } from '../../utils/helpers';

const VARIANT_STYLES = {
  // Field Atlas (plans/UI-DESIGN.md): actions are raised cards with a line border; only a screen's
  // one primary action is brass, so 'primary' here is the same raised card with a light edge.
  default: 'bg-fa-raised hover:bg-fa-hover border-fa-line text-fa-text',
  primary: 'bg-fa-raised hover:bg-fa-hover border-fa-text/70 text-fa-text',
  success: 'bg-fa-raised hover:bg-fa-hover border-fa-good/60 text-fa-good',
  warning: 'bg-fa-raised hover:bg-fa-hover border-fa-enemy/60 text-fa-enemy',
  danger: 'bg-[rgba(229,96,77,0.12)] hover:bg-[rgba(229,96,77,0.2)] border-fa-danger text-fa-danger-text',
  purple: 'bg-fa-raised hover:bg-fa-hover border-fa-indep/60 text-fa-indep'
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
    small: 'p-2 gap-2 min-h-[44px]',
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
          <div className="text-xs text-fa-muted mt-0.5 leading-tight">
            {description}
          </div>
        )}

        {/* Cost and Effect Row */}
        {(costString || effectString) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs font-mono">
            {/* Cost */}
            {costString && (
              <span className={strain ? `${strain.level === 'critical' ? 'text-fa-danger-text' : 'text-fa-enemy'} font-semibold` : 'text-fa-muted'}>
                Cost: {costString}
              </span>
            )}
            {/* Effect */}
            {effectString && (
              <span className="text-fa-good">
                → {effectString}
              </span>
            )}
          </div>
        )}

        {/* Resource strain warning */}
        {strain && (
          <div className={`text-xs mt-1 ${strain.level === 'critical' ? 'text-fa-danger-text' : 'text-fa-enemy'}`}>
            ⚠ Uses {strain.level === 'critical' ? 'all' : 'most'} of your {strain.label}
          </div>
        )}
      </div>
    </button>
  );
};

export default ActionButton;

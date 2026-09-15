// src/components/modals/EventModal.jsx
// Historical event modal with effect preview for each option

import React from 'react';
import { AlertTriangle, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber, formatMoney } from '../../utils/helpers';
import { NATIONS_DATA } from '../../data/nations';

// Format effect for display
const formatEffectItem = (key, value) => {
  const labels = {
    money: 'Funds',
    manpower: 'Manpower',
    diplomacyPoints: 'Diplomacy',
    techPoints: 'Tech Points',
    undergroundBonus: 'Underground',
    militaryBonus: 'Military',
    controlBonus: 'Control',
    controlPenalty: 'Control',
    defenseBonus: 'Defense',
    captureRegions: 'Capture',
    returnRegion: 'Return',
    peaceWith: 'Peace with',
    tradeWith: 'Trade with',
    warWith: 'War with',
    canDeclareIndependence: 'Independence'
  };

  const label = labels[key] || key;

  // Handle different effect types
  if (key === 'captureRegions' && Array.isArray(value)) {
    return { label: 'Capture', value: value.join(', '), type: 'positive' };
  }
  if (key === 'returnRegion') {
    return { label: 'Return', value: value, type: 'negative' };
  }
  if (key === 'peaceWith') {
    const nations = Array.isArray(value) ? value.join(', ') : value;
    return { label: 'Peace', value: nations, type: 'positive' };
  }
  if (key === 'tradeWith') {
    const nations = Array.isArray(value) ? value.join(', ') : value;
    return { label: 'Trade', value: nations, type: 'positive' };
  }
  if (key === 'warWith') {
    const nations = Array.isArray(value) ? value.join(', ') : value;
    return { label: 'War', value: nations, type: 'negative' };
  }
  if (key === 'canDeclareIndependence') {
    return { label: 'Unlock', value: 'Independence', type: 'positive' };
  }
  if (key === 'nationHostility') {
    // { nationId: delta } — procedural events (Phase 6) only ever target one nation per option.
    const [nId, delta] = Object.entries(value)[0] || [];
    const name = NATIONS_DATA[nId]?.name || nId;
    return { label: `Relations: ${name}`, value: `${delta >= 0 ? '+' : ''}${delta}`, type: delta >= 0 ? 'negative' : 'positive' };
  }
  if (key === 'controlPenalty') {
    return { label, value: `-${value}%`, type: 'negative' };
  }
  if (key === 'defenseBonus') {
    return { label, value: `+${(value * 100).toFixed(0)}%`, type: 'positive' };
  }

  // Numeric values
  if (typeof value === 'number') {
    let displayValue;
    if (key === 'money') {
      displayValue = formatMoney(Math.abs(value));
    } else if (key === 'controlBonus') {
      displayValue = `${Math.abs(value)}%`;
    } else {
      displayValue = formatNumber(Math.abs(value));
    }
    
    const prefix = value >= 0 ? '+' : '-';
    return {
      label,
      value: `${prefix}${displayValue}`,
      type: value >= 0 ? 'positive' : 'negative'
    };
  }

  return { label, value: String(value), type: 'neutral' };
};

// Parse all effects from an option
const parseEffects = (effects) => {
  if (!effects) return [];
  
  const parsed = [];
  Object.entries(effects).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== false) {
      parsed.push(formatEffectItem(key, value));
    }
  });
  
  return parsed;
};

const EffectBadge = ({ label, value, type }) => {
  const typeStyles = {
    positive: 'bg-green-500/20 text-green-400 border-green-500/30',
    negative: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };

  const TypeIcon = type === 'positive' ? TrendingUp : type === 'negative' ? TrendingDown : Minus;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${typeStyles[type]}`}>
      <TypeIcon className="w-3 h-3" />
      <span className="font-medium">{label}:</span>
      <span className="font-mono">{value}</span>
    </div>
  );
};

const EventModal = ({ event, onResolve }) => {
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        className="bg-slate-900 rounded-xl border-2 border-amber-500 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="line-clamp-2">{event.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            {event.year != null && (
              <>
                <Calendar className="w-3 h-3" />
                <span>{event.year}</span>
              </>
            )}
            {event.mandatory && (
              <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                Mandatory
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Description */}
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {event.description}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {event.options.map((option, index) => {
              const effects = parseEffects(option.effects);
              
              return (
                <button
                  key={index}
                  onClick={() => onResolve(index)}
                  className="w-full p-4 rounded-lg text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 transition-all group"
                >
                  {/* Option Label */}
                  <div className="font-semibold text-sm text-white group-hover:text-amber-300 transition-colors">
                    {option.label}
                  </div>

                  {/* Cost (if specified separately) */}
                  {option.cost && (
                    <div className="text-xs text-red-400 mt-1 font-mono">
                      Cost: {option.cost}
                    </div>
                  )}

                  {/* Effects Preview */}
                  {effects.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {effects.map((effect, i) => (
                        <EffectBadge key={i} {...effect} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500 text-center shrink-0">
          Click an option to proceed. This event cannot be skipped.
        </div>
      </div>
    </div>
  );
};

export default EventModal;

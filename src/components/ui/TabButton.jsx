// src/components/ui/TabButton.jsx
// Tab navigation button component

import React from 'react';

const TabButton = ({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick,
  badge = null,
  disabled = false 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`
        flex-1 py-2 px-1.5 sm:px-2 text-xs font-semibold transition-all
        flex items-center justify-center gap-1 relative
        ${isActive 
          ? 'text-blue-400 border-b-2 border-blue-400 bg-fa-raised/50' 
          : 'text-fa-muted hover:text-fa-text border-b-2 border-transparent'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{label}</span>
      
      {/* Badge for notifications */}
      {badge !== null && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-fa-text text-[10px] rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
};

export default TabButton;

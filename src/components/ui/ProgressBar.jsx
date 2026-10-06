// src/components/ui/ProgressBar.jsx
// Reusable progress bar component

import React from 'react';

const ProgressBar = ({
  value,
  max = 100,
  color = 'blue',
  size = 'normal', // 'small', 'normal', 'large'
  showLabel = false,
  label = '',
  animate = true,
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colorClasses = {
    blue: 'bg-fa-you',
    green: 'bg-fa-good',
    red: 'bg-fa-danger',
    yellow: 'bg-[#CDB27A]',
    amber: 'bg-fa-brass',
    purple: 'bg-fa-indep',
    orange: 'bg-fa-enemy',
    gradient: 'bg-gradient-to-r from-red-500 via-yellow-500 to-green-500'
  };

  const sizeClasses = {
    small: 'h-1',
    normal: 'h-2',
    large: 'h-3'
  };

  // Dynamic color based on value
  const getValueColor = () => {
    if (color !== 'dynamic') return colorClasses[color] || colorClasses.blue;
    if (percentage >= 80) return colorClasses.green;
    if (percentage >= 60) return colorClasses.blue;
    if (percentage >= 40) return colorClasses.yellow;
    if (percentage >= 20) return colorClasses.orange;
    return colorClasses.red;
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1 text-xs">
          <span className="text-fa-muted">{label}</span>
          <span className="text-fa-text font-mono">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-fa-line rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`h-full ${getValueColor()} ${animate ? 'transition-all duration-500' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;

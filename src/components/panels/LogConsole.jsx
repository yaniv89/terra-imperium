// src/components/panels/LogConsole.jsx
// Scrollable game log console showing all events, actions, and combat

import React, { useRef, useEffect, useState } from 'react';
import { ScrollText, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { LogTypes } from '../../data/types';

// Log type styling configuration
const LOG_STYLES = {
  [LogTypes.ACTION]: {
    className: 'text-green-400',
    borderClass: '',
    bgClass: '',
    label: 'Action'
  },
  [LogTypes.EVENT]: {
    className: 'text-yellow-400',
    borderClass: 'border-l-2 border-yellow-500 pl-2',
    bgClass: 'bg-yellow-500/5',
    label: 'Event'
  },
  [LogTypes.COMBAT]: {
    className: 'text-orange-400',
    borderClass: 'border-l-2 border-orange-500 pl-2',
    bgClass: '',
    label: 'Combat'
  },
  [LogTypes.MILESTONE]: {
    className: 'text-blue-400 font-semibold',
    borderClass: 'border-l-2 border-blue-500 pl-2',
    bgClass: 'bg-blue-500/5',
    label: 'Milestone'
  },
  [LogTypes.CRISIS]: {
    className: 'text-red-400 font-bold',
    borderClass: 'border-l-2 border-red-500 pl-2',
    bgClass: 'bg-red-500/10',
    label: 'Crisis'
  },
  [LogTypes.TECH]: {
    className: 'text-purple-400',
    borderClass: 'border-l-2 border-purple-500 pl-2',
    bgClass: 'bg-purple-500/5',
    label: 'Tech'
  },
  [LogTypes.DIPLOMACY]: {
    className: 'text-cyan-400',
    borderClass: 'border-l-2 border-cyan-500 pl-2',
    bgClass: '',
    label: 'Diplomacy'
  },
  [LogTypes.AI]: {
    className: 'text-slate-400 italic',
    borderClass: 'border-l-2 border-slate-500 pl-2',
    bgClass: '',
    label: 'World'
  }
};

// Individual log entry component
const LogEntry = ({ log, showYear = true }) => {
  const style = LOG_STYLES[log.type] || LOG_STYLES[LogTypes.ACTION];

  return (
    <div 
      className={`
        py-1 px-1 rounded-sm transition-colors relative
        ${style.borderClass}
        ${style.bgClass}
        ${style.className}
        hover:bg-slate-800/50
      `}
    >
      {showYear && (
        <span className="text-slate-600 mr-2 font-mono text-[10px] inline-block align-top mt-0.5">
          [{log.year}]
        </span>
      )}
      {/* FIX: added break-words to prevent horizontal scrolling breaking layout */}
      <span className="text-[11px] break-words">{log.message}</span>
    </div>
  );
};

// Filter button component
const FilterButton = ({ type, label, isActive, onClick, count }) => {
  const style = LOG_STYLES[type] || {};
  
  return (
    <button
      onClick={onClick}
      className={`
        px-1.5 py-0.5 rounded text-[9px] transition-all whitespace-nowrap
        ${isActive 
          ? `${style.className} bg-slate-700` 
          : 'text-slate-500 hover:text-slate-300'
        }
      `}
    >
      {label}
      {count > 0 && (
        <span className="ml-1 text-[8px] opacity-70">({count})</span>
      )}
    </button>
  );
};

const LogConsole = ({ maxHeight = 'h-48', expanded = false }) => {
  const { state } = useGame();
  const scrollRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filters, setFilters] = useState({
    [LogTypes.ACTION]: true,
    [LogTypes.EVENT]: true,
    [LogTypes.COMBAT]: true,
    [LogTypes.MILESTONE]: true,
    [LogTypes.CRISIS]: true,
    [LogTypes.TECH]: true,
    [LogTypes.DIPLOMACY]: true,
    [LogTypes.AI]: true
  });

  // Auto-scroll to bottom when new logs appear
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.logs, autoScroll]);

  // Handle scroll - disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Increased threshold for mobile touch scrolling sensitivity
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  };

  // Toggle filter
  const toggleFilter = (type) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Filter logs
  const filteredLogs = state.logs.filter(log => filters[log.type] !== false);

  // Count logs by type
  const logCounts = state.logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {});

  // Group logs by year for better readability
  const groupedByYear = filteredLogs.reduce((groups, log) => {
    const year = log.year;
    if (!groups[year]) groups[year] = [];
    groups[year].push(log);
    return groups;
  }, {});

  const years = Object.keys(groupedByYear).sort((a, b) => Number(a) - Number(b));

  return (
    <div className={`
      bg-slate-950 rounded-lg border border-slate-800 flex flex-col
      ${isExpanded ? 'h-80' : maxHeight}
      transition-all duration-300 shadow-xl overflow-y-scroll
    `}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950 z-10">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-400">Event Log</span>
          <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
            {filteredLogs.length} / {state.logs.length}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Auto-scroll indicator */}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }}
              className="text-[9px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 bg-blue-500/20 rounded animate-pulse"
            >
              ↓ New
            </button>
          )}
          
          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="px-2 py-1.5 border-b border-slate-800/50 flex flex-wrap gap-1 shrink-0 bg-slate-900/50">
        <Filter className="w-3 h-3 text-slate-600 mr-1 mt-0.5" />
        {Object.entries(LOG_STYLES).map(([type, style]) => (
          <FilterButton
            key={type}
            type={type}
            label={style.label}
            isActive={filters[type]}
            onClick={() => toggleFilter(type)}
            count={logCounts[type] || 0}
          />
        ))}
      </div>

      {/* Log Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-col 
          flex-1 
          min-h-0 
          overflow-y-auto 
          p-2 
          font-mono 
          space-y-0.5 
          scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900
          overscroll-contain 
          pb-6 
        "
      >
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 text-xs text-center py-4 italic">
            No logs match current filters
          </div>
        ) : (
          // Render logs grouped by year
          years.map(year => (
            <div key={year} className="mb-2">
              {/* Year separator for milestone years */}
              {(Number(year) % 10 === 0 || groupedByYear[year].some(l => l.type === LogTypes.MILESTONE)) && (
                <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1 mt-2 
                              border-t border-slate-800 pt-1 sticky top-0 bg-slate-950/90 backdrop-blur-sm z-10">
                  — {year} —
                </div>
              )}
              
              {/* Logs for this year */}
              {groupedByYear[year].map((log, idx) => (
                <LogEntry 
                  key={`${year}-${idx}`} 
                  log={log} 
                  index={idx}
                  showYear={!years.some(y => Number(y) % 10 === 0) || Number(year) % 10 !== 0}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer with turn info */}
      <div className="px-2 py-1 border-t border-slate-800 text-[9px] text-slate-600 
                      flex justify-between items-center shrink-0 bg-slate-900/50">
        <span>Turn {state.turnNumber} • Year {state.year}</span>
        <span className="flex items-center gap-2">
          {state.phase === 'PRE_STATE' ? 'Pre-State Era' : 'State of Israel'}
        </span>
      </div>
    </div>
  );
};

export default LogConsole;
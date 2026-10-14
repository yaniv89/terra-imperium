// src/components/ui/GameIcon.jsx
// One delivered icon (src/data/icons.js) as a fixed-size <img>, so nothing shifts while it loads.
// With no art for the id it renders `fallback` instead (the old lucide glyph or text), or nothing;
// a picture that fails to load falls back the same way (I186: never a blank tile). `eager` loads it
// at once (a sheet that must show its pictures on first open); the default stays lazy.
// The art has a dark outline: `halo` adds a soft light rim so it reads on the dark panels.
import React, { useState } from 'react';
import { iconUrl } from '../../data/icons';

// `disabled` is the one look of an icon whose choice is not on offer (grey, 45% strength: index.css).
const GameIcon = ({ group, id, url = null, size = 20, fallback = null, title, className = '', halo = true, disabled = false, eager = false }) => {
  const src = url || iconUrl(group, id);
  const [failed, setFailed] = useState(null);
  if (!src || failed === src) return fallback;
  return (
    <img
      src={src}
      alt={title || ''}
      title={title}
      width={size}
      height={size}
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(src)}
      className={`game-icon shrink-0 select-none ${halo && !disabled ? 'game-icon-halo' : ''} ${disabled ? 'game-icon-disabled' : ''} ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default GameIcon;

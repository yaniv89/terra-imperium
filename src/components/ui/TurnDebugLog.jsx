// src/components/ui/TurnDebugLog.jsx
// `?turndebug`: the turn worker's last events (src/services/turnClient.js) live on screen, top
// left, small and click-through, so a phone that hangs on "The world moves" shows where it stopped
// (sent, ping, pong, answer, error, timeout, the state's size and the worker's ms a turn).
import React, { useEffect, useState } from 'react';
import { turnLogText } from '../../services/turnClient';

export const turnDebugOn = () => {
  try { return new URLSearchParams(window.location.search).has('turndebug'); } catch { return false; }
};

const TurnDebugLog = () => {
  const [text, setText] = useState('');
  useEffect(() => {
    const tick = () => setText(turnLogText().split('\n').slice(-14).join('\n'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <pre data-testid="turn-debug-log" aria-hidden="true"
      className="fixed z-[300] left-[max(env(safe-area-inset-left),0.25rem)] top-[calc(var(--header-height,2.25rem)+0.25rem)] max-w-[min(34rem,70vw)] max-h-[45%] overflow-hidden whitespace-pre-wrap break-all pointer-events-none bg-black/75 text-[10px] leading-tight text-green-300 p-1.5 rounded">
      {text}
    </pre>
  );
};

export default TurnDebugLog;

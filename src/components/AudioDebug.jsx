// src/components/AudioDebug.jsx
// `?audiodebug`: a small readout of the game's audio (src/audio/audioContext.js audioDebugInfo):
// the shared context's state, whether the page counts as on screen, the iOS audio session, what
// the music is playing, and the last state changes with times. For checking on a real phone what
// happens when the screen locks or the app goes to the background. Tap it to fold it.
import { useEffect, useState } from 'react';
import { audioDebugInfo } from '../audio/audioContext';

const line = (k, v) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;

const AudioDebug = () => {
  const [info, setInfo] = useState(() => audioDebugInfo());
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const h = setInterval(() => setInfo(audioDebugInfo()), 500);
    const now = () => setInfo(audioDebugInfo());
    document.addEventListener('visibilitychange', now);
    return () => { clearInterval(h); document.removeEventListener('visibilitychange', now); };
  }, []);
  const p = info.page;
  const rows = open ? [
    line('context', `${info.context} t=${info.time}s ${info.rate} Hz`),
    line('page', `${info.audible ? 'on screen' : 'away'}${['hidden', 'pagehidden', 'frozen', 'appPaused', 'blurred'].filter((k) => p[k]).map((k) => ` ${k}`).join('')}${p.phone ? ' (phone)' : ''}`),
    line('audioSession', info.session),
    line('mediaSession', info.mediaSession),
    line('media elements', info.mediaElements),
    ...Object.entries(info.consumers).map(([k, v]) => line(k, v)),
    '--- log (newest first)',
    ...info.log
  ] : [`audio: ${info.context}${info.consumers.music ? `, music ${info.consumers.music.track}` : ''}`];
  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{ position: 'fixed', left: 4, bottom: 4, zIndex: 99999, maxWidth: 'min(420px, 70vw)', maxHeight: '60vh', overflow: 'auto', background: 'rgba(0,0,0,0.78)', color: '#9f9', font: '10px/1.3 ui-monospace, monospace', padding: '4px 6px', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', pointerEvents: 'auto' }}
    >
      {rows.join('\n')}
    </div>
  );
};

export default AudioDebug;

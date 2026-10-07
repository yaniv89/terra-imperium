// A stand-in Web Audio context for the audio tests (Node has none): records which sources play,
// lets a test move the clock and the state, and decodes "files" into buffers of a set length.
const param = (v = 1) => {
  const p = { value: v, events: [] };
  p.setValueAtTime = (x, t) => { p.value = x; p.events.push(['set', x, t]); };
  p.linearRampToValueAtTime = (x, t) => { p.value = x; p.events.push(['ramp', x, t]); };
  p.setTargetAtTime = (x, t, tc) => { p.value = x; p.events.push(['target', x, t, tc]); };
  p.exponentialRampToValueAtTime = (x, t) => { p.value = x; p.events.push(['exp', x, t]); };
  p.cancelScheduledValues = () => {};
  return p;
};
const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: { value: 0 }, pan: param(), playbackRate: { value: 1 } });

/** durations: { url: seconds } (unknown urls last 60 s). */
export const createFakeAudioContext = ({ durations = {}, sampleRate = 48000 } = {}) => {
  const listeners = {};
  const ctx = {
    currentTime: 0, sampleRate, state: 'running', destination: node(),
    sources: [], suspendCalls: 0, resumeCalls: 0, refuseResume: false,
    addEventListener(n, fn) { (listeners[n] = listeners[n] || []).push(fn); },
    setState(s) { ctx.state = s; (listeners.statechange || []).forEach((fn) => fn()); },
    createGain() { return node(); },
    createStereoPanner() { return node(); },
    createBiquadFilter() { return node(); },
    createOscillator() { return { ...node(), type: 'sine', start() {}, stop() {} }; },
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; },
    createBufferSource() {
      const s = { ...node(), buffer: null, loop: false, playing: false, startedAt: null, stopAt: null, onended: null };
      s.start = (at = 0, offset = 0) => { s.playing = true; s.startedAt = at; s.offset = offset; };
      s.stop = (at) => { s.stopAt = at ?? ctx.currentTime; if (s.stopAt <= ctx.currentTime) s.playing = false; };
      ctx.sources.push(s);
      return s;
    },
    decodeAudioData(ab) { return Promise.resolve({ duration: durations[ab.url] ?? 60, sampleRate, numberOfChannels: 2, url: ab.url }); },
    suspend() { ctx.suspendCalls += 1; ctx.state = 'suspended'; return Promise.resolve(); },
    resume() { ctx.resumeCalls += 1; if (!ctx.refuseResume) ctx.state = 'running'; return Promise.resolve(); },
    /** Move the clock: sources whose stop time (or natural end) passed end. */
    advance(s) {
      ctx.currentTime += s;
      ctx.sources.forEach((src) => {
        if (!src.playing) return;
        const end = src.stopAt ?? (src.loop ? Infinity : src.startedAt + (src.buffer?.duration ?? 0) - (src.offset || 0));
        if (end <= ctx.currentTime) { src.playing = false; src.onended?.(); }
      });
    },
    /** The sources playing now (started, not yet ended). */
    playing: () => ctx.sources.filter((s) => s.playing && s.startedAt <= ctx.currentTime + 1e-6),
    playingUrls: () => ctx.playing().map((s) => s.buffer?.url).filter(Boolean)
  };
  return ctx;
};

/** fetch() that returns { url } as the array buffer. */
export const fakeFetch = (url) => Promise.resolve({ arrayBuffer: () => Promise.resolve({ url, slice() { return { url }; } }) });

// scripts/perf/memoryProbe.js
// Runs in the page before anything else (page.addInitScript): counts what holds memory outside the
// JS heap, for scripts/perf/memory-soak.mjs. window.__memProbe.read() returns:
//   contexts        WebGL contexts made and still alive (not lost; their canvas not collected)
//   textures / texMB, buffers / bufMB, renderbuffers / rbMB, framebuffers, programs
//                   GL objects alive and their approximate GPU bytes (from the sizes uploaded)
//   canvases / canvasMB   canvases with a 2D or WebGL context still reachable, and their pixels
//   bitmaps / bitmapMB    ImageBitmaps not closed (and not collected)
//   workers         Workers made and not terminated
// Approximate by design: the point is a number that rises when something leaks.
export const memoryProbe = () => {
  const reg = (typeof FinalizationRegistry === 'function') ? FinalizationRegistry : null;
  const live = { contexts: new Set(), canvases: new Set(), bitmaps: new Set(), workers: new Set() };
  const tex = new Map(); const buf = new Map(); const rb = new Map();
  const counts = { framebuffers: 0, programs: 0, contextsMade: 0, contextsLost: 0, contextsRestored: 0 };
  const SIZED = { 0x8814: 16, 0x881a: 8, 0x822e: 4, 0x822d: 2, 0x8229: 1, 0x822b: 2, 0x8230: 8, 0x822f: 4, 0x8232: 1, 0x8236: 4, 0x8d70: 16, 0x8d7c: 4, 0x8058: 4, 0x8051: 4, 0x88f0: 4, 0x81a6: 4, 0x8cac: 4, 0x8c43: 4, 0x8c41: 4, 0x8d62: 2, 0x8056: 2, 0x8057: 2, 0x8c3a: 4, 0x8c3d: 4, 0x8cad: 8 };
  const CH = { 0x1908: 4, 0x1907: 3, 0x8227: 2, 0x1903: 1, 0x8d94: 1, 0x8228: 2, 0x8d99: 4, 0x1909: 1, 0x1906: 1, 0x190a: 2, 0x1902: 4, 0x84f9: 4 };
  const TYPE = { 0x1401: 1, 0x1400: 1, 0x1406: 4, 0x140b: 2, 0x8d61: 2, 0x1403: 2, 0x1402: 2, 0x1405: 4, 0x1404: 4, 0x84fa: 4, 0x8033: 0.5, 0x8034: 0.5, 0x8363: 0.5 };
  const bpp = (internal, format, type) => SIZED[internal] || (CH[format] || CH[internal] || 4) * (TYPE[type] || 1);
  const wrap = (proto) => {
    if (!proto) return;
    const st = new WeakMap();
    const S = (gl) => { let s = st.get(gl); if (!s) { s = { unit: 0, units: new Map(), buffers: new Map(), rb: null }; st.set(gl, s); } return s; };
    const bound = (gl, target) => {
      const s = S(gl); const t = (target >= 0x8515 && target <= 0x851a) ? 0x8513 : target;
      return s.units.get(s.unit)?.get(t);
    };
    const level = (t, key, bytes) => { if (!t) return; const e = tex.get(t); if (!e) return; e.levels.set(key, bytes); };
    const o = {};
    ['createTexture', 'deleteTexture', 'bindTexture', 'activeTexture', 'texImage2D', 'texImage3D', 'texStorage2D', 'texStorage3D', 'compressedTexImage2D', 'generateMipmap',
      'createBuffer', 'deleteBuffer', 'bindBuffer', 'bufferData', 'createRenderbuffer', 'deleteRenderbuffer', 'bindRenderbuffer', 'renderbufferStorage', 'renderbufferStorageMultisample',
      'createFramebuffer', 'deleteFramebuffer', 'createProgram', 'deleteProgram'].forEach((k) => { o[k] = proto[k]; });
    proto.createTexture = function () { const t = o.createTexture.call(this); if (t) tex.set(t, { levels: new Map(), mip: false }); return t; };
    proto.deleteTexture = function (t) { tex.delete(t); return o.deleteTexture.call(this, t); };
    proto.activeTexture = function (u) { S(this).unit = u; return o.activeTexture.call(this, u); };
    proto.bindTexture = function (target, t) { const s = S(this); let m = s.units.get(s.unit); if (!m) { m = new Map(); s.units.set(s.unit, m); } m.set(target, t); return o.bindTexture.call(this, target, t); };
    proto.texImage2D = function (...a) {
      try {
        let w; let h; let bytes;
        if (a.length >= 8) { w = a[3]; h = a[4]; bytes = w * h * bpp(a[2], a[6], a[7]); } else { const src = a[5]; w = src?.videoWidth || src?.naturalWidth || src?.width || 0; h = src?.videoHeight || src?.naturalHeight || src?.height || 0; bytes = w * h * bpp(a[2], a[3], a[4]); }
        const t = bound(this, a[0]); level(t, `${a[0]}:${a[1]}`, bytes);
        const e = tex.get(t); const src = a.length >= 8 ? a[8] : a[5];
        if (e && a[1] === 0) Object.assign(e, { w, h, kind: src?.constructor?.name || 'null', src: (src?.currentSrc || src?.src || '').slice(-60) });
      } catch { /* the probe never breaks the page */ }
      return o.texImage2D.apply(this, a);
    };
    if (o.texImage3D) proto.texImage3D = function (...a) { try { level(bound(this, a[0]), `${a[0]}:${a[1]}`, a[3] * a[4] * a[5] * bpp(a[2], a[7], a[8])); } catch { /* none */ } return o.texImage3D.apply(this, a); };
    if (o.texStorage2D) proto.texStorage2D = function (target, levels, internal, w, h) { try { const e0 = tex.get(bound(this, target)); if (e0) Object.assign(e0, { w, h, kind: `storage x${levels}`, src: String(internal) }); let b = 0; let ww = w; let hh = h; for (let i = 0; i < levels; i++) { b += ww * hh * bpp(internal); ww = Math.max(1, ww >> 1); hh = Math.max(1, hh >> 1); } level(bound(this, target), 'storage', b * (target === 0x8513 ? 6 : 1)); } catch { /* none */ } return o.texStorage2D.call(this, target, levels, internal, w, h); };
    if (o.texStorage3D) proto.texStorage3D = function (target, levels, internal, w, h, d) { try { level(bound(this, target), 'storage', w * h * d * bpp(internal) * (levels > 1 ? 4 / 3 : 1)); } catch { /* none */ } return o.texStorage3D.call(this, target, levels, internal, w, h, d); };
    proto.compressedTexImage2D = function (...a) { try { level(bound(this, a[0]), `${a[0]}:${a[1]}`, a[6]?.byteLength || 0); } catch { /* none */ } return o.compressedTexImage2D.apply(this, a); };
    proto.generateMipmap = function (target) { const e = tex.get(bound(this, target)); if (e) e.mip = true; return o.generateMipmap.call(this, target); };
    proto.createBuffer = function () { const b = o.createBuffer.call(this); if (b) buf.set(b, 0); return b; };
    proto.deleteBuffer = function (b) { buf.delete(b); return o.deleteBuffer.call(this, b); };
    proto.bindBuffer = function (target, b) { S(this).buffers.set(target, b); return o.bindBuffer.call(this, target, b); };
    proto.bufferData = function (target, data, ...r) { try { const b = S(this).buffers.get(target); if (b && buf.has(b)) buf.set(b, typeof data === 'number' ? data : (data?.byteLength || 0)); } catch { /* none */ } return o.bufferData.call(this, target, data, ...r); };
    proto.createRenderbuffer = function () { const r = o.createRenderbuffer.call(this); if (r) rb.set(r, 0); return r; };
    proto.deleteRenderbuffer = function (r) { rb.delete(r); return o.deleteRenderbuffer.call(this, r); };
    proto.bindRenderbuffer = function (target, r) { S(this).rb = r; return o.bindRenderbuffer.call(this, target, r); };
    proto.renderbufferStorage = function (target, internal, w, h) { const r = S(this).rb; if (r && rb.has(r)) rb.set(r, w * h * 4); return o.renderbufferStorage.call(this, target, internal, w, h); };
    if (o.renderbufferStorageMultisample) proto.renderbufferStorageMultisample = function (target, samples, internal, w, h) { const r = S(this).rb; if (r && rb.has(r)) rb.set(r, w * h * 4 * Math.max(1, samples)); return o.renderbufferStorageMultisample.call(this, target, samples, internal, w, h); };
    proto.createFramebuffer = function () { counts.framebuffers += 1; return o.createFramebuffer.call(this); };
    proto.deleteFramebuffer = function (f) { if (f) counts.framebuffers -= 1; return o.deleteFramebuffer.call(this, f); };
    proto.createProgram = function () { counts.programs += 1; return o.createProgram.call(this); };
    proto.deleteProgram = function (p) { if (p) counts.programs -= 1; return o.deleteProgram.call(this, p); };
  };
  wrap(window.WebGL2RenderingContext?.prototype);
  wrap(window.WebGLRenderingContext?.prototype);

  const canvasReg = reg ? new reg((ref) => live.canvases.delete(ref)) : null;
  const getContext = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (type, ...r) {
    const ctx = getContext.call(this, type, ...r);
    if (ctx && !seen.has(this)) {
      seen.add(this);
      const ref = new WeakRef(this);
      live.canvases.add(ref); canvasReg?.register(this, ref);
      if (/webgl/.test(type)) {
        counts.contextsMade += 1;
        const entry = { ref, lost: false };
        live.contexts.add(entry);
        this.addEventListener('webglcontextlost', () => { entry.lost = true; counts.contextsLost += 1; });
        this.addEventListener('webglcontextrestored', () => { entry.lost = false; counts.contextsRestored += 1; });
      }
    }
    return ctx;
  };
  if (window.OffscreenCanvas) {
    const og = OffscreenCanvas.prototype.getContext;
    OffscreenCanvas.prototype.getContext = function (type, ...r) {
      const ctx = og.call(this, type, ...r);
      if (ctx && !seen.has(this)) { seen.add(this); const ref = new WeakRef(this); live.canvases.add(ref); canvasReg?.register(this, ref); }
      return ctx;
    };
  }
  if (window.createImageBitmap) {
    const cib = window.createImageBitmap;
    const bmReg = reg ? new reg((ref) => live.bitmaps.delete(ref)) : null;
    window.createImageBitmap = function (...a) {
      return cib.apply(this, a).then((bm) => { const ref = new WeakRef(bm); live.bitmaps.add(ref); bmReg?.register(bm, ref); const close = bm.close.bind(bm); bm.close = () => { live.bitmaps.delete(ref); close(); }; return bm; });
    };
  }
  const W = window.Worker;
  if (W) {
    window.Worker = function ProbedWorker(...a) {
      const w = new W(...a);
      live.workers.add(w);
      const term = w.terminate.bind(w);
      w.terminate = () => { live.workers.delete(w); term(); };
      return w;
    };
    window.Worker.prototype = W.prototype;
  }
  const mb = (n) => Math.round(n / 1048576 * 10) / 10;
  window.__memProbe = {
    // the biggest textures alive: [{ MB, w, h, kind, src }]
    top(n = 20) {
      const list = [];
      tex.forEach((e) => { let b = 0; e.levels.forEach((v) => { b += v; }); if (e.mip) b = b * 4 / 3; list.push({ MB: mb(b), w: e.w, h: e.h, kind: e.kind, src: e.src }); });
      return list.sort((a, b) => b.MB - a.MB).slice(0, n);
    },
    read() {
      let texBytes = 0; tex.forEach((e) => { let b = 0; e.levels.forEach((v) => { b += v; }); texBytes += e.mip ? b * 4 / 3 : b; });
      let bufBytes = 0; buf.forEach((v) => { bufBytes += v; });
      let rbBytes = 0; rb.forEach((v) => { rbBytes += v; });
      let canvases = 0; let canvasPx = 0;
      live.canvases.forEach((ref) => { const c = ref.deref(); if (!c) { live.canvases.delete(ref); return; } canvases += 1; canvasPx += (c.width || 0) * (c.height || 0); });
      let contexts = 0; live.contexts.forEach((e) => { const c = e.ref.deref(); if (!c) { live.contexts.delete(e); return; } if (!e.lost) contexts += 1; });
      let bitmaps = 0; let bmPx = 0; live.bitmaps.forEach((ref) => { const b = ref.deref(); if (!b || !b.width) { live.bitmaps.delete(ref); return; } bitmaps += 1; bmPx += b.width * b.height; });
      return {
        contexts, ...counts, textures: tex.size, texMB: mb(texBytes), buffers: buf.size, bufMB: mb(bufBytes), renderbuffers: rb.size, rbMB: mb(rbBytes),
        canvases, canvasMB: mb(canvasPx * 4), bitmaps, bitmapMB: mb(bmPx * 4), workers: live.workers.size, gpuMB: mb(texBytes + bufBytes + rbBytes)
      };
    }
  };
};

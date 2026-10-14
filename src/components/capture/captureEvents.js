// src/components/capture/captureEvents.js
// Bring the capture card (CaptureCard.jsx) back on screen from anywhere: End Turn's blocker.
export const SHOW_CAPTURE = 'ti:show-capture';
export const showCapture = () => window.dispatchEvent(new CustomEvent(SHOW_CAPTURE));

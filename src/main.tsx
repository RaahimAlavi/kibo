import React from 'react';
import ReactDOM from 'react-dom/client';
import { initTauriBridge, isTauriRuntime } from './lib/tauriBridge';
import { App } from './App';

// Initialize native Tauri v2 bridge before React mounts so window.kiboAPI is immediately available
initTauriBridge();

// Lock transparent background before React's first paint (except standalone Settings window)
if (typeof window !== 'undefined' && (Boolean((window as any).kiboAPI) || isTauriRuntime())) {
  const isSettings =
    (window as any).__KIBO_WINDOW_MODE__ === 'settings' ||
    (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label === 'settings' ||
    new URLSearchParams(window.location.search).get('mode') === 'settings';
  const bg = isSettings ? '#121214' : 'transparent';
  document.documentElement.style.background = bg;
  document.body.style.background = bg;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);

import { useSyncExternalStore } from 'react';
import { getStoredTechHubSurfaceMode } from '../utils/techHubAccent';

/** Stesso valore di {@link getStoredTechHubSurfaceMode}, con re-render quando cambia il tema shell (evento `tech-hub-surface`). */
function subscribeSurface(callback) {
  window.addEventListener('tech-hub-surface', callback);
  return () => window.removeEventListener('tech-hub-surface', callback);
}

export function useTechHubSurfaceMode() {
  return useSyncExternalStore(subscribeSurface, getStoredTechHubSurfaceMode, () => 'dark');
}

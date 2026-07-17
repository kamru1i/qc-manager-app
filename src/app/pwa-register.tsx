'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Detect if we are running inside Tauri
      const isTauri = 
        (window as any).__TAURI_INTERNALS__ !== undefined || 
        window.location.protocol === 'tauri:' ||
        window.location.hostname === 'tauri.localhost';

      if (isTauri) {
        // Unregister any active service worker in Tauri environment to prevent caching/startup hangs
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
              registration.unregister();
            }
          }).catch((err) => {
            console.error('[Tauri] Error unregistering service workers:', err);
          });
        }
        return;
      }

      // Standard PWA registration for web browsers
      if ('serviceWorker' in navigator) {
        const registerSW = () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then(() => {
              // Registration succeeded silently
            })
            .catch((error) => {
              console.error('Service Worker registration failed:', error);
            });
        };

        if (document.readyState === 'complete') {
          registerSW();
        } else {
          window.addEventListener('load', registerSW);
          return () => window.removeEventListener('load', registerSW);
        }
      }
    }
  }, []);

  return null;
}


import { Capacitor } from '@capacitor/core';

/**
 * Detects if the app is running inside a Tauri Desktop App.
 */
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'tauri:' || 
    window.location.hostname === 'tauri.localhost' || 
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined
  );
}

/**
 * Detects if the app is running inside a native Capacitor Mobile App.
 * Uses Capacitor.isNativePlatform() to prevent false positives in web browsers.
 */
export function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' || 
    Capacitor.isNativePlatform()
  );
}

/**
 * Resolves the correct API URL depending on whether the app is running
 * inside a Web Browser, Tauri Desktop App, or Capacitor Mobile App.
 */
export function getApiUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  
  const isTauri = isTauriApp();
  const isMobile = isMobileApp();

  if (isTauri || isMobile) {
    // If the Tauri/Capacitor client webview is running on localhost in DEV mode,
    // route API requests directly to the local Next.js server on port 3000.
    const isLocalDev = 
      window.location.protocol === 'http:' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1');

    if (isLocalDev) {
      return `http://localhost:3000${path}`;
    }
    const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://chuti.bnfcorporate.com';
    const baseUrl = envUrl.startsWith('http://') ? envUrl.replace('http://', 'https://') : envUrl;
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }
  
  return path;
}

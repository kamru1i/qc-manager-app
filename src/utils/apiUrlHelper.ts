/**
 * Detects if the app is running inside a Tauri Desktop App.
 */
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'tauri:' || 
    window.location.hostname === 'tauri.localhost' || 
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined
  );
}

/**
 * Detects if the app is running inside a Capacitor Mobile App.
 */
export function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' || 
    (window as any).Capacitor !== undefined
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

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://qc-manager-y4bzh900h-kamrul-projects.vercel.app';
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }
  
  return path;
}


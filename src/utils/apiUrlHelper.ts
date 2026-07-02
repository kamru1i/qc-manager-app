/**
 * Detects if the app is running inside a Tauri Desktop App.
 */
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'tauri:' || 
    window.location.hostname === 'tauri.localhost' || 
    (window as any).__TAURI_INTERNALS__ !== undefined
  );
}

/**
 * Resolves the correct API URL depending on whether the app is running
 * inside a Web Browser (Next.js server context) or inside a Tauri Desktop App.
 */
export function getApiUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  
  const isTauri = isTauriApp();

  if (isTauri) {
    // If the Tauri webview itself is running on localhost/127.0.0.1 in DEV mode (http:),
    // route API requests directly to the local Next.js server on port 3000.
    // In production, the protocol is 'tauri:' (macOS) or 'https:' (Windows/Linux).
    const isLocalDev = 
      window.location.protocol === 'http:' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1');

    if (isLocalDev) {
      return `http://localhost:3000${path}`;
    }

    // Default to the stable git branch deployment URL on Vercel, or override via Env variable
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://qc-manager-app.vercel.app';
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }
  
  return path;
}


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (typeof window !== 'undefined') {
    console.error('CRITICAL: Supabase environment variables are missing. Database requests will fail.');
  } else {
    console.warn('WARNING: Supabase environment variables are missing during build.');
  }
}



const fetchWithTimeout = (url: URL | RequestInfo, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(id));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use localStorage for session persistence (works in Tauri WebView + browser).
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,

    // Prevent Supabase from trying to parse auth tokens from the URL hash/query.
    // In Tauri, the URL is a static file path — there is no server-side redirect.
    detectSessionInUrl: false,

    // Use PKCE flow for security. This is compatible with both browser and Tauri WebView.
    flowType: 'pkce',

    // Persist session across app restarts (stored in localStorage).
    persistSession: true,

    // Auto-refresh the JWT token before it expires.
    autoRefreshToken: true,
  },
  global: {
    fetch: (url, options) => fetchWithTimeout(url, options, 15000),
  },
});

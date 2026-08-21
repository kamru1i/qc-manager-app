import { NextRequest } from 'next/server';



/** Trusted origins for CORS — only these or matching patterns are reflected back. */
const ALLOWED_ORIGINS = [
  'https://qc-manager-app.vercel.app',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:3000',
  'http://localhost:3001',
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host.endsWith('.vercel.app') || host === 'vercel.app') return true;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (url.protocol === 'tauri:' || url.protocol === 'capacitor:' || host === 'tauri.localhost') return true;
  } catch {
    if (origin.startsWith('tauri://') || origin.startsWith('capacitor://') || origin.includes('tauri.localhost')) {
      return true;
    }
  }
  return false;
}

export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * Bounded in-memory rate limiter.
 * Automatically prunes stale entries to prevent unbounded growth.
 */
export class RateLimiter {
  private map = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;

  constructor(windowMs: number, maxRequests: number, maxEntries = 10000) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxEntries = maxEntries;
  }

  /**
   * Returns true if the key has exceeded the rate limit.
   * Automatically prunes expired timestamps and evicts stale entries.
   */
  isLimited(key: string): boolean {
    const now = Date.now();

    // Periodic cleanup: evict stale entries when map grows too large
    if (this.map.size > this.maxEntries) {
      for (const [k, timestamps] of this.map) {
        const active = timestamps.filter(t => now - t < this.windowMs);
        if (active.length === 0) {
          this.map.delete(k);
        } else {
          this.map.set(k, active);
        }
      }
    }

    if (!this.map.has(key)) {
      this.map.set(key, [now]);
      return false;
    }

    const timestamps = this.map.get(key)!.filter(t => now - t < this.windowMs);
    if (timestamps.length >= this.maxRequests) {
      this.map.set(key, timestamps);
      return true;
    }

    timestamps.push(now);
    this.map.set(key, timestamps);
    return false;
  }
}

/**
 * Simple cooldown-based rate limiter (one request per cooldown period).
 * Used for per-user throttling (e.g., push notification spam prevention).
 */
export class CooldownLimiter {
  private map = new Map<string, number>();
  private readonly cooldownMs: number;
  private readonly maxEntries: number;

  constructor(cooldownMs: number, maxEntries = 10000) {
    this.cooldownMs = cooldownMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Returns true if the key is still within the cooldown period.
   */
  isLimited(key: string): boolean {
    const now = Date.now();

    // Periodic cleanup
    if (this.map.size > this.maxEntries) {
      for (const [k, timestamp] of this.map) {
        if (now - timestamp >= this.cooldownMs) {
          this.map.delete(k);
        }
      }
    }

    const lastRequest = this.map.get(key);
    if (lastRequest && now - lastRequest < this.cooldownMs) {
      return true;
    }

    this.map.set(key, now);
    return false;
  }
}

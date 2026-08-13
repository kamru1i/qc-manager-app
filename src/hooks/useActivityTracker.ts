import { useEffect } from 'react';

// Throttle activity updates to at most once per minute to avoid performance issues
// and excessive localStorage writes.
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000;

export function useActivityTracker(userId: string | undefined) {
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    let lastUpdateTime = 0;
    
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastUpdateTime > ACTIVITY_UPDATE_INTERVAL) {
        lastUpdateTime = now;
        localStorage.setItem(`last_active_time_${userId}`, now.toString());
      }
    };

    // Listen to standard interaction events
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Do an initial update on mount
    handleUserActivity();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [userId]);
}

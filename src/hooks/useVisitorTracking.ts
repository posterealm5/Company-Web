import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getOrCreateVisitorSessionId, sendVisitorHeartbeat } from '../services/analytics';

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
const MIN_HEARTBEAT_GAP_MS = 50 * 1000; // Minimum 50 seconds between heartbeats
const STORAGE_LAST_HEARTBEAT_KEY = 'pr_last_heartbeat_ts';

/**
 * Lightweight hook to track anonymous storefront visitor sessions.
 * Sends periodic heartbeats (~60s) while the tab is active and visible.
 * Completely ignores /admin routes and avoids duplicate traffic on route changes or remounts.
 */
export function useVisitorTracking() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Never track admin panel activity
    if (isAdmin) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const sessionId = getOrCreateVisitorSessionId();
    if (!sessionId) return;

    const triggerHeartbeat = (force = false) => {
      // Avoid heartbeat if the document/tab is currently hidden
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      const now = Date.now();
      let lastHeartbeat = 0;
      try {
        const lastVal = localStorage.getItem(STORAGE_LAST_HEARTBEAT_KEY);
        if (lastVal) lastHeartbeat = parseInt(lastVal, 10);
      } catch (e) {
        // localStorage restriction
      }

      if (!force && (now - lastHeartbeat) < MIN_HEARTBEAT_GAP_MS) {
        return;
      }

      try {
        localStorage.setItem(STORAGE_LAST_HEARTBEAT_KEY, now.toString());
      } catch (e) {
        // localStorage restriction
      }

      sendVisitorHeartbeat(sessionId);
    };

    // Initial heartbeat on mount (subject to minimum gap check)
    triggerHeartbeat(false);

    // Recurring interval while active
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      triggerHeartbeat(false);
    }, HEARTBEAT_INTERVAL_MS);

    // Handle visibility changes (pause in background, resume when active)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerHeartbeat(false);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          triggerHeartbeat(false);
        }, HEARTBEAT_INTERVAL_MS);
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdmin]);
}

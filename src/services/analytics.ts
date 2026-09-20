import { supabase } from '../lib/supabase';
import type { VisitorAnalyticsData } from '../types/database';

const VISITOR_SESSION_STORAGE_KEY = 'pr_visitor_session_id';

/**
 * Generate a cryptographically secure random UUID v4 string.
 */
function generateAnonymousId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieve or generate an anonymous visitor session ID persisted in localStorage.
 * Multiple tabs in the same browser share this session ID.
 */
export function getOrCreateVisitorSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    let sessionId = localStorage.getItem(VISITOR_SESSION_STORAGE_KEY);
    if (!sessionId || sessionId.trim() === '') {
      sessionId = generateAnonymousId();
      localStorage.setItem(VISITOR_SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  } catch (err) {
    // localStorage might be unavailable or restricted in some private modes
    return generateAnonymousId();
  }
}

/**
 * Send an anonymous visitor heartbeat to Supabase.
 * Updates last_seen_at in visitor_sessions and records a unique daily visit in visitor_daily_visits.
 * Silently catches errors so storefront visitors are never impacted by transient network issues.
 */
export async function sendVisitorHeartbeat(sessionId?: string): Promise<void> {
  const activeSessionId = sessionId || getOrCreateVisitorSessionId();
  if (!activeSessionId) return;

  try {
    const { error } = await supabase.rpc('record_visitor_heartbeat', {
      p_session_id: activeSessionId
    });

    if (error) {
      console.warn('[Analytics] Heartbeat error:', error.message);
    }
  } catch (err) {
    // Non-blocking, fail silently for visitors
  }
}

/**
 * Fetch visitor analytics data for the Admin Overview.
 * Uses the protected get_admin_visitor_analytics RPC as the single source of truth.
 * Throws on error so the caller can present the existing Admin ErrorState and retry.
 */
export async function fetchAdminVisitorAnalytics(days: number = 7): Promise<VisitorAnalyticsData> {
  const { data, error } = await supabase.rpc('get_admin_visitor_analytics', {
    p_days: days
  });

  if (error) {
    throw error;
  }

  return (data as unknown) as VisitorAnalyticsData;
}

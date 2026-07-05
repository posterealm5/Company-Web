/**
 * Centralized SEO configuration
 * All URLs, canonical tags, sitemaps, and schemas must derive their base URL from this file.
 */

export const SITE_URL = (
  (typeof process !== 'undefined' && process.env && process.env.VITE_SITE_URL) ||
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SITE_URL) ||
  (typeof window !== 'undefined' && window.location && window.location.origin) ||
  ''
).replace(/\/$/, '');

import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Storage Service
 * Handles file uploads/downloads for poster images and assets
 * using Supabase Storage buckets.
 * 
 * Expected buckets:
 *   - "posters"   → product/poster images
 *   - "avatars"   → user profile pictures
 *   - "assets"    → general site assets (logos, category images, etc.)
 */

const BUCKETS = {
  POSTERS: 'posters',
  AVATARS: 'avatars',
  ASSETS: 'assets',
  CUSTOM_DESIGNS: 'custom-designs',
} as const;

type BucketName = typeof BUCKETS[keyof typeof BUCKETS];

/** Upload a file or Blob to a Supabase Storage bucket */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File | Blob,
  options?: { upsert?: boolean; cacheControl?: string }
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { url: null, error: 'Supabase is not configured' };
  }

  // 1 year cache for immutable versioned storefront variants; 1 hour default for raw uploads
  const cacheHeader = options?.cacheControl || 
    (path.includes('storefront/') 
      ? '31536000' 
      : '3600');

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: cacheHeader,
      upsert: options?.upsert ?? false,
    });

  if (error) {
    console.error('Supabase Upload Failure Details:', {
      table: 'storage.objects',
      payload: {
        bucket: bucket,
        path: path,
        fileSize: file.size,
        fileType: file.type,
      },
      error: error
    });
    return { url: null, error: error.message };
  }

  const url = getPublicUrl(bucket, path);
  return { url, error: null };
}

/** Get the public URL for a file in a bucket */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Delete a file from a bucket */
export async function deleteFile(
  bucket: BucketName,
  path: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured' };
  }

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    console.error('Error deleting file:', error.message);
    return { error: error.message };
  }

  return { error: null };
}

/** List files in a bucket directory */
export async function listFiles(
  bucket: BucketName,
  folder?: string
): Promise<{ name: string; url: string }[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder || '', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    console.error('Error listing files:', error.message);
    return [];
  }

  return (data || []).map((file) => ({
    name: file.name,
    url: getPublicUrl(bucket, folder ? `${folder}/${file.name}` : file.name),
  }));
}

/** Upload a poster image */
export async function uploadPosterImage(
  productId: number,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop();
  const path = `${productId}/poster.${ext}`;
  return uploadFile(BUCKETS.POSTERS, path, file, { upsert: true });
}

/** Upload a user avatar */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/avatar.${ext}`;
  return uploadFile(BUCKETS.AVATARS, path, file, { upsert: true });
}

/** Upload a review avatar */
export async function uploadReviewAvatar(
  reviewId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop();
  const path = `reviews/${reviewId}-${Date.now()}.${ext}`;
  return uploadFile(BUCKETS.AVATARS, path, file, { upsert: true });
}

/** Upload a room setup image for the customer showcase */
export async function uploadShowcaseImage(
  entryId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop();
  const path = `showcases/${entryId}-${Date.now()}.${ext}`;
  return uploadFile(BUCKETS.POSTERS, path, file, { upsert: true });
}

/** Upload a general site asset (logo, category image, etc.) */
export async function uploadAsset(
  name: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop();
  const path = `${name}.${ext}`;
  return uploadFile(BUCKETS.ASSETS, path, file, { upsert: true });
}

/** Upload a custom design raw master to the custom-designs bucket */
export async function uploadCustomDesignOriginal(
  file: File,
  identifier?: { timestamp: number; random: string }
): Promise<{ url: string | null; path: string; error: string | null }> {
  const timestamp = identifier?.timestamp ?? Date.now();
  const random = identifier?.random ?? Math.random().toString(36).substring(7);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `uploads/design-${timestamp}-${random}.${ext}`;
  const res = await uploadFile(BUCKETS.CUSTOM_DESIGNS, path, file, { cacheControl: '3600', upsert: false });
  return { url: res.url, path, error: res.error };
}

/** Upload a custom design 400px WebP preview to the custom-designs bucket */
export async function uploadCustomDesignPreview(
  blob: Blob,
  identifier: { timestamp: number; random: string }
): Promise<{ url: string | null; path: string; error: string | null }> {
  const path = `previews/design-${identifier.timestamp}-${identifier.random}-400.webp`;
  const res = await uploadFile(BUCKETS.CUSTOM_DESIGNS, path, blob, { cacheControl: '31536000', upsert: false });
  return { url: res.url, path, error: res.error };
}

/** Upload a custom design from the Customize page (preserves uncompressed original in uploads/) */
export async function uploadCustomDesign(
  file: File
): Promise<{ url: string | null; artworkUrl?: string | null; previewUrl?: string | null; error: string | null }> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `uploads/design-${timestamp}-${random}.${ext}`;
  const res = await uploadFile(BUCKETS.CUSTOM_DESIGNS, path, file, { cacheControl: '3600', upsert: false });
  return { url: res.url, artworkUrl: res.url, previewUrl: res.url, error: res.error };
}

// ============================================================================
// Phase 3B: SHA-256 Hashing & User-Scoped Custom Artwork Registry
// ============================================================================

export const POSTER_KIT_CUSTOM_ARTWORK_REGISTRY_KEY = 'posterealm_custom_artwork_registry_v1';

export interface UserScopedArtworkRecord {
  userId: string;
  sha256: string;
  customArtworkId: string;
  artwork_url: string;               // Permanent uncompressed master in uploads/
  image: string | null;              // Permanent 400px WebP preview in previews/
  customArtworkFileName?: string;
  status: 'master_uploaded' | 'completed';
  uploadedAt: number;
  dbArtworkId?: string;
}

// In-memory registry fallback for non-browser / SSR / test environments
const memoryRegistry = new Map<string, string>();

function getRegistryStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (key: string) => memoryRegistry.get(key) ?? null,
    setItem: (key: string, val: string) => memoryRegistry.set(key, val),
    removeItem: (key: string) => memoryRegistry.delete(key),
    clear: () => memoryRegistry.clear(),
  };
}

/**
 * Calculates SHA-256 hash of file bytes using Web Crypto API.
 * In Node test environments, safely delegates to node:crypto.
 * Throws if cryptographic hashing is completely unavailable (never substitutes a weak hash).
 */
export async function calculateFileSha256(file: File | Blob): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Safe fallback for Node.js test runner environments
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const moduleName = 'node:crypto';
      const nodeCrypto = await import(/* @vite-ignore */ moduleName);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return nodeCrypto.createHash('sha256').update(buffer).digest('hex');
    } catch (e: any) {
      throw new Error(`SHA-256 calculation failed in Node environment: ${e?.message || e}`);
    }
  }

  throw new Error('SHA-256 integrity calculation failed: Cryptographic provider is unavailable.');
}

/**
 * Retrieves the complete custom artwork registry.
 */
export function getArtworkRegistry(): Record<string, UserScopedArtworkRecord> {
  try {
    const storage = getRegistryStorage();
    const raw = storage.getItem(POSTER_KIT_CUSTOM_ARTWORK_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Persists an artwork record into the user-scoped registry.
 */
export function saveArtworkRegistryRecord(record: UserScopedArtworkRecord): void {
  try {
    const storage = getRegistryStorage();
    const registry = getArtworkRegistry();
    const key = `${record.userId}:${record.sha256}`;
    registry[key] = record;
    storage.setItem(POSTER_KIT_CUSTOM_ARTWORK_REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn('[Storage] Failed to save artwork registry record:', err);
  }
}

/**
 * Retrieves a cached artwork record matching the authenticated userId and SHA-256 hash.
 * Strict user-scoping: never returns an entry belonging to a different user.
 */
export function getCachedArtworkRecord(userId: string, sha256: string): UserScopedArtworkRecord | null {
  if (!userId || !sha256) return null;
  const registry = getArtworkRegistry();
  const record = registry[`${userId}:${sha256}`];
  if (!record || record.userId !== userId || record.sha256 !== sha256) {
    return null;
  }
  return record;
}

export { BUCKETS };

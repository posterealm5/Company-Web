import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../types/database';
import { BUCKETS, getPublicUrl } from './storage';

export type CustomArtworkRow = Database['public']['Tables']['custom_artworks']['Row'];
export type CustomArtworkInsert = Database['public']['Tables']['custom_artworks']['Insert'];

export const MASTER_PATH_REGEX = /^uploads\/design-[0-9]+-[a-z0-9_-]+\.(png|jpe?g|webp|avif)$/i;
export const PREVIEW_PATH_REGEX = /^previews\/(?:design-[0-9]+-[a-z0-9_-]+-400|preview-[0-9]+-[a-z0-9_-]+)\.webp$/i;
export const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;

export const VALID_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
] as const;

export type ValidArtworkMimeType = (typeof VALID_MIME_TYPES)[number];

export type ArtworkLookupResult =
  | { status: 'found'; record: CustomArtworkRow }
  | { status: 'not_found' }
  | { status: 'error'; error: string };

export type StorageObjectStatus = 'available' | 'missing' | 'inconclusive';

export interface StorageAvailabilityResult {
  masterStatus: StorageObjectStatus;
  previewStatus: StorageObjectStatus;
}

export interface RegisterArtworkParams {
  userId: string;
  sha256: string;
  storageMasterPath: string; // Relative path matching ^uploads/design-... or validated custom-designs URL
  storagePreviewPath?: string | null; // Relative path matching ^previews/design-... or validated custom-designs URL
  fileSize: number;
  mimeType: string;
}

export type RegisterArtworkResult =
  | { success: true; record: CustomArtworkRow; reused: boolean; error?: undefined }
  | { success: false; error: string; code?: string; record?: undefined; reused?: undefined };

/**
 * Resolves the exact configured Supabase project URL origin.
 * Does not accept arbitrary domains or arbitrary *.supabase.co projects.
 */
export function getConfiguredSupabaseOrigin(): string | null {
  const urlStr =
    (supabase as any)?.supabaseUrl ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined);

  if (!urlStr || typeof urlStr !== 'string' || urlStr === 'https://placeholder.supabase.co') {
    return null;
  }
  try {
    return new URL(urlStr).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validates and extracts the relative object path from a storage path or full public URL.
 * 
 * Strict Validation Rules:
 * 1. For full URLs: Origin must exactly match the configured Supabase project URL.
 *    Arbitrary *.supabase.co projects and foreign hosts are rejected.
 * 2. URL must target the custom-designs bucket (/custom-designs/).
 * 3. Rejects traversal segments (.. or .), query strings, fragments, backslashes, and null bytes.
 * 4. Rejects malformed or invalid percent-encoded sequences.
 * 5. Relative paths must match approved database-compatible master or preview patterns.
 */
export function extractRelativeStoragePath(urlOrPath: string): string | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;
  const trimmed = urlOrPath.trim();

  // Reject paths containing query strings, fragments, backslashes, or null bytes upfront
  if (trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return null;
  }

  let candidatePath: string;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);

      // Reject query strings or fragments in URL
      if (parsed.search || parsed.hash) {
        return null;
      }

      // Origin must exactly match configured Supabase project URL
      const configuredOrigin = getConfiguredSupabaseOrigin();
      if (!configuredOrigin || parsed.origin.toLowerCase() !== configuredOrigin) {
        return null;
      }

      // Must target the expected Supabase Storage public-object route and exact custom-designs bucket
      const EXPECTED_PUBLIC_PREFIX = '/storage/v1/object/public/custom-designs/';
      if (!parsed.pathname.startsWith(EXPECTED_PUBLIC_PREFIX)) {
        return null;
      }

      candidatePath = parsed.pathname.slice(EXPECTED_PUBLIC_PREFIX.length);
    } catch {
      return null;
    }
  } else {
    // Relative path candidate
    candidatePath = trimmed;
  }

  // Decode percent-encoding and check for malformed sequences
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(candidatePath);
  } catch {
    return null; // Malformed percent-encoding
  }

  // Reject if decoded path contains null bytes, backslashes, double slashes, query strings, or fragments
  if (
    decodedPath.includes('\0') ||
    decodedPath.includes('\\') ||
    decodedPath.includes('//') ||
    decodedPath.includes('?') ||
    decodedPath.includes('#')
  ) {
    return null;
  }

  // Path traversal check: verify every segment is clean and contains no '.' or '..'
  const segments = decodedPath.split('/');
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || seg.trim() === '') {
      return null;
    }
  }

  // Must match database-compatible master or preview path pattern
  if (MASTER_PATH_REGEX.test(decodedPath) || PREVIEW_PATH_REGEX.test(decodedPath)) {
    return decodedPath;
  }

  return null;
}

/**
 * Resolves artwork MIME type from browser MIME or supported filename extension.
 * Rules:
 * 1. When browser MIME type is empty, resolves strictly from a supported extension (png, jpg/jpeg, webp, avif).
 * 2. When browser MIME is provided, normalizes image/jpg -> image/jpeg and checks membership in VALID_MIME_TYPES.
 *    Also verifies consistency between MIME and extension.
 * 3. Generic MIME types (e.g. application/octet-stream, binary/octet-stream) and unsupported types are rejected.
 */
export function resolveArtworkMimeType(
  rawMime: string | undefined | null,
  fileNameOrExt: string
): ValidArtworkMimeType | null {
  const trimmedMime = (rawMime || '').trim().toLowerCase();
  const ext = (fileNameOrExt.includes('.') ? fileNameOrExt.split('.').pop() : fileNameOrExt)?.toLowerCase().replace(/^\./, '') || '';

  // 1. If browser provided a MIME type:
  if (trimmedMime) {
    let resolved: ValidArtworkMimeType | null = null;
    if (trimmedMime === 'image/jpg' || trimmedMime === 'image/jpeg') {
      resolved = 'image/jpeg';
    } else if ((VALID_MIME_TYPES as readonly string[]).includes(trimmedMime)) {
      resolved = trimmedMime as ValidArtworkMimeType;
    } else {
      // Generic (e.g. application/octet-stream) or unsupported MIME is rejected
      return null;
    }

    // Verify consistency with extension if present
    if (ext) {
      const isConsistent =
        (resolved === 'image/png' && ext === 'png') ||
        (resolved === 'image/jpeg' && (ext === 'jpg' || ext === 'jpeg')) ||
        (resolved === 'image/webp' && ext === 'webp') ||
        (resolved === 'image/avif' && ext === 'avif');

      if (!isConsistent) {
        return null;
      }
    }

    return resolved;
  }

  // 2. When browser MIME type is empty, resolve ONLY from supported filename extension
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'avif') return 'image/avif';

  // Unsupported or unidentifiable extension
  return null;
}

/**
 * Validates and normalizes MIME type against supported Phase 3B formats (PNG, JPEG, WebP, AVIF).
 * Invariant: Does NOT silently infer that a generic MIME type (e.g. application/octet-stream)
 * proves the actual file format. Rejects unsupported or generic MIME types.
 * If expectedExtension is provided, enforces that the MIME type is consistent with it.
 */
export function normalizeArtworkMimeType(rawMime: string, expectedExtension?: string): ValidArtworkMimeType | null {
  return resolveArtworkMimeType(rawMime, expectedExtension || '');
}

/**
 * Verifies availability of referenced storage objects using public HTTP HEAD/GET probes.
 * Adheres strictly to public-read bucket semantics without requiring storage-list permissions.
 * 
 * Returns explicit status for each object:
 * - 'available': confirmed available (200/206/304)
 * - 'missing': confirmed missing (404/400)
 * - 'inconclusive': network error, timeout, or unexpected server status (never mislabeled as available)
 */
export async function verifyStorageObjectAvailability(
  masterPath: string,
  previewPath?: string | null
): Promise<StorageAvailabilityResult> {
  const probePath = async (relPath: string): Promise<StorageObjectStatus> => {
    if (!isSupabaseConfigured()) {
      return 'inconclusive';
    }

    try {
      const publicUrl = getPublicUrl(BUCKETS.CUSTOM_DESIGNS, relPath);
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;

      try {
        const res = await fetch(publicUrl, {
          method: 'HEAD',
          signal: controller?.signal,
        });
        if (timeoutId) clearTimeout(timeoutId);

        if (res.ok || res.status === 304) {
          return 'available';
        }
        if (res.status === 404 || res.status === 400) {
          return 'missing';
        }
        // Fallback for CDN endpoints returning 405 Method Not Allowed on HEAD
        if (res.status === 405) {
          const getRes = await fetch(publicUrl, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
            signal: controller?.signal,
          });
          if (getRes.ok || getRes.status === 206 || getRes.status === 304) {
            return 'available';
          }
          if (getRes.status === 404 || getRes.status === 400) {
            return 'missing';
          }
          return 'inconclusive';
        }
        return 'inconclusive';
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId);
        // Timeout, connection drop, DNS failure are inconclusive
        return 'inconclusive';
      }
    } catch {
      return 'inconclusive';
    }
  };

  const masterStatus = await probePath(masterPath);
  const previewStatus = previewPath ? await probePath(previewPath) : 'missing';

  return { masterStatus, previewStatus };
}

/**
 * Tri-state lookup for custom artwork in public.custom_artworks by (user_id, sha256).
 * Explicitly distinguishes:
 * - 'found': confirmed record
 * - 'not_found': confirmed cache miss (0 rows)
 * - 'error': database/network/permission error (never treated as a cache miss)
 */
export async function findCustomArtworkByUserAndSha256(
  userId: string,
  sha256: string
): Promise<ArtworkLookupResult> {
  if (!userId || !sha256) {
    return { status: 'error', error: 'User ID and SHA-256 hash are required for lookup.' };
  }

  if (!isSupabaseConfigured()) {
    return { status: 'error', error: 'Supabase is not configured.' };
  }

  const normSha256 = sha256.trim().toLowerCase();
  if (!SHA256_HEX_REGEX.test(normSha256)) {
    return { status: 'error', error: `Invalid SHA-256 hash format: ${sha256}` };
  }

  try {
    const { data, error } = await supabase
      .from('custom_artworks')
      .select('*')
      .eq('user_id', userId)
      .eq('sha256', normSha256)
      .maybeSingle();

    if (error) {
      return { status: 'error', error: error.message };
    }

    if (!data) {
      return { status: 'not_found' };
    }

    return { status: 'found', record: data as CustomArtworkRow };
  } catch (err: any) {
    return { status: 'error', error: err?.message || String(err) };
  }
}

/**
 * Idempotently registers custom artwork metadata into public.custom_artworks.
 * 
 * Invariant Guarantees:
 * 1. Pre-validates master path, preview path, MIME type, file size, and SHA-256 format.
 * 2. Rejects path traversals, query strings, fragments, and malformed encoding.
 * 3. Enforces MIME-to-extension consistency matching database CHECK constraints.
 * 4. Checks existing record by (user_id, sha256); reuses existing record if present.
 * 5. Inserts with RLS-mandated parameters (hash_verified = false, integrity_status = 'uploaded').
 * 6. Safely handles unique constraint race conditions (Postgres code 23505) by re-querying.
 * 7. Never throws; returns structured failure object on database error.
 */
export async function registerCustomArtwork(
  params: RegisterArtworkParams
): Promise<RegisterArtworkResult> {
  if (!params.userId || !params.sha256) {
    return { success: false, error: 'User ID and SHA-256 are required for artwork registration.' };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  const normSha256 = params.sha256.trim().toLowerCase();
  if (!SHA256_HEX_REGEX.test(normSha256)) {
    return { success: false, error: `Invalid SHA-256 hash format: ${params.sha256}` };
  }

  if (typeof params.fileSize !== 'number' || params.fileSize <= 0) {
    return { success: false, error: `File size must be positive, got: ${params.fileSize}` };
  }

  const masterPath = extractRelativeStoragePath(params.storageMasterPath);
  if (!masterPath || !MASTER_PATH_REGEX.test(masterPath)) {
    return {
      success: false,
      error: `Invalid master storage path: "${params.storageMasterPath}". Must match ^uploads/design-[0-9]+-[a-z0-9_-]+\\.(png|jpe?g|webp|avif)$ without traversal, query, or fragments.`,
    };
  }

  const previewPath = params.storagePreviewPath
    ? extractRelativeStoragePath(params.storagePreviewPath)
    : null;

  if (previewPath && !PREVIEW_PATH_REGEX.test(previewPath) && previewPath !== masterPath) {
    return {
      success: false,
      error: `Invalid preview storage path: "${params.storagePreviewPath}". Must match ^previews/(?:design-...-400|preview-...)\\.webp$ or equal master path without traversal, query, or fragments.`,
    };
  }

  const ext = masterPath.split('.').pop()?.toLowerCase();
  const normMime = normalizeArtworkMimeType(params.mimeType, ext);
  if (!normMime) {
    return {
      success: false,
      error: `Unsupported or inconsistent MIME type "${params.mimeType}" for master file extension ".${ext}". Generic types (e.g. application/octet-stream) are rejected.`,
    };
  }

  try {
    // 1. Check if record already exists in database
    const existingLookup = await findCustomArtworkByUserAndSha256(params.userId, normSha256);
    if (existingLookup.status === 'found') {
      return { success: true, record: existingLookup.record, reused: true };
    }
    if (existingLookup.status === 'error') {
      return {
        success: false,
        error: `Database lookup failed prior to registration: ${existingLookup.error}`,
      };
    }

    // 2. Insert new record (ONLY reached when existingLookup.status === 'not_found')
    const insertPayload: CustomArtworkInsert = {
      user_id: params.userId,
      storage_master_path: masterPath,
      storage_preview_path: previewPath,
      sha256: normSha256,
      file_size: params.fileSize,
      mime_type: normMime,
      integrity_status: 'uploaded',
      hash_verified: false,
    };

    const { data, error } = await supabase
      .from('custom_artworks')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      // Handle concurrent insert race condition gracefully (Postgres unique constraint 23505)
      if (error.code === '23505') {
        const retryLookup = await findCustomArtworkByUserAndSha256(params.userId, normSha256);
        if (retryLookup.status === 'found') {
          return { success: true, record: retryLookup.record, reused: true };
        }
      }
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true, record: data as CustomArtworkRow, reused: false };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Retrieves a custom artwork record by its primary key UUID.
 */
export async function getCustomArtworkById(id: string): Promise<CustomArtworkRow | null> {
  if (!id || !isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('custom_artworks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as CustomArtworkRow;
  } catch {
    return null;
  }
}

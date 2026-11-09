import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Product } from '../types/database';

/**
 * Poster Kit Artwork Service
 * 
 * Manages the resolution and verification of original poster artwork files
 * stored in Supabase Storage.
 * 
 * STRICT GUARANTEE:
 * Storefront room mockups (room-scenes featuring walls, desks, figurines,
 * plants, frames, or laptops) are NEVER treated as original artwork and
 * are strictly barred from being applied to the Poster Kit wall.
 */

export const POSTER_ARTWORK_BUCKET = 'posters';
export const ARTWORK_STORAGE_FOLDER = 'artworks';

export interface OriginalArtworkResolution {
  artworkUrl: string | null;
  isAvailable: boolean;
  sourceType: 'field' | 'storage' | 'none';
  storagePath?: string;
}

/**
 * Detects whether a given URL or storage path represents a storefront room mockup
 * rather than an original print artwork design.
 */
export function isStorefrontMockupUrl(urlOrPath: string | null | undefined): boolean {
  if (!urlOrPath) return false;
  const lower = urlOrPath.toLowerCase().trim();

  // 1. Optimized storefront WebP variants (e.g. storefront/anime/4/.../*.webp)
  if (lower.includes('/storefront/') || lower.startsWith('storefront/')) {
    return true;
  }

  // 2. Legacy catalog image folders containing room-scene mockup photos
  const legacyMockupFolders = [
    '/anime/',
    '/bikes & cars/',
    '/bikes%20&%20cars/',
    '/gaming/',
    '/movies & series/',
    '/movies%20&%20series/',
    '/music/',
    '/printesty/',
  ];

  for (const folder of legacyMockupFolders) {
    if (lower.includes(folder)) {
      return true;
    }
  }

  // 3. Relative paths starting with legacy mockup category folders
  if (
    lower.startsWith('anime/') ||
    lower.startsWith('bikes & cars/') ||
    lower.startsWith('gaming/') ||
    lower.startsWith('movies & series/') ||
    lower.startsWith('music/') ||
    lower.startsWith('printesty/')
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves the original poster artwork URL for a given product.
 * 
 * Resolution order:
 * 1. Verified storage map lookup (cached/pre-fetched from Supabase Storage `artworks/` folder)
 * 2. Dedicated explicit original artwork URL fields on product record (if present)
 * 3. Dedicated explicit original artwork storage path on product record (if present)
 * 4. Safe fallback: Rejects all storefront mockups and returns { isAvailable: false, artworkUrl: null }
 */
export function resolveOriginalPosterArtwork(
  product: Product | null | undefined,
  verifiedStorageMap?: Map<string | number, string> | Record<string | number, string>
): OriginalArtworkResolution {
  if (!product) {
    return { artworkUrl: null, isAvailable: false, sourceType: 'none' };
  }

  const productId = product.id;

  // 1. Check verified storage map (if preloaded from Supabase Storage)
  if (verifiedStorageMap) {
    const mappedUrl =
      verifiedStorageMap instanceof Map
        ? verifiedStorageMap.get(productId) ?? verifiedStorageMap.get(String(productId))
        : verifiedStorageMap[productId] ?? verifiedStorageMap[String(productId)];

    if (mappedUrl && !isStorefrontMockupUrl(mappedUrl)) {
      return {
        artworkUrl: mappedUrl,
        isAvailable: true,
        sourceType: 'storage',
      };
    }
  }

  // 2. Dedicated explicit artwork fields on product
  const prodAny = product as any;
  const explicitUrl =
    prodAny.artwork_url ||
    prodAny.original_artwork_url ||
    prodAny.design_url;

  if (explicitUrl && typeof explicitUrl === 'string' && !isStorefrontMockupUrl(explicitUrl)) {
    return {
      artworkUrl: explicitUrl,
      isAvailable: true,
      sourceType: 'field',
    };
  }

  // 3. Dedicated explicit artwork path on product (resolved to public URL in posters bucket)
  const explicitPath =
    prodAny.artwork_path ||
    prodAny.original_artwork_path ||
    prodAny.design_path;

  if (explicitPath && typeof explicitPath === 'string' && !isStorefrontMockupUrl(explicitPath)) {
    const publicUrl = supabase.storage
      .from(POSTER_ARTWORK_BUCKET)
      .getPublicUrl(explicitPath).data.publicUrl;

    return {
      artworkUrl: publicUrl,
      isAvailable: true,
      sourceType: 'storage',
      storagePath: explicitPath,
    };
  }

  // 4. Safe Fallback:
  // product.image and image_*_url contain storefront room-scene mockups.
  // Never pass off a mockup as original artwork!
  return {
    artworkUrl: null,
    isAvailable: false,
    sourceType: 'none',
  };
}

/**
 * Lists and indexes all verified original artwork files from the dedicated
 * `posters/artworks/` folder in Supabase Storage.
 * Returns a Map of productId -> publicUrl.
 */
export async function fetchVerifiedStorageArtworks(): Promise<Map<string | number, string>> {
  const artworkMap = new Map<string | number, string>();
  if (!isSupabaseConfigured()) return artworkMap;

  try {
    const { data: files, error } = await supabase.storage
      .from(POSTER_ARTWORK_BUCKET)
      .list(ARTWORK_STORAGE_FOLDER, { limit: 1000 });

    if (error) {
      // If the artworks folder does not exist yet or is empty, return empty map safely
      return artworkMap;
    }

    if (files && Array.isArray(files)) {
      for (const file of files) {
        if (!file.name || file.name === '.emptyFolderPlaceholder') continue;

        // Pattern: {productId}.{ext} e.g. "4.png", "12.webp"
        const baseName = file.name.split('.')[0];
        const storagePath = `${ARTWORK_STORAGE_FOLDER}/${file.name}`;
        const { data } = supabase.storage
          .from(POSTER_ARTWORK_BUCKET)
          .getPublicUrl(storagePath);

        if (data?.publicUrl) {
          artworkMap.set(baseName, data.publicUrl);
          const numId = Number(baseName);
          if (!isNaN(numId)) {
            artworkMap.set(numId, data.publicUrl);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Notice: Could not list dedicated artworks from Supabase Storage:', err);
  }

  return artworkMap;
}

export const MAX_ARTWORK_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB limit
export const ALLOWED_ARTWORK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_ARTWORK_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validates file type and size for clean poster artwork uploads.
 * Strictly verifies BOTH MIME type and extension to prevent file spoofing.
 */
export function validateArtworkFile(file: File): { isValid: boolean; error?: string } {
  if (!file || !file.name) {
    return { isValid: false, error: 'No file provided for upload.' };
  }

  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  const hasValidExt = ALLOWED_ARTWORK_EXTENSIONS.includes(ext);
  const hasValidType = ALLOWED_ARTWORK_TYPES.includes(file.type);

  // Validate extension to MIME type consistency
  const isConsistent =
    (ext === '.png' && file.type === 'image/png') ||
    ((ext === '.jpg' || ext === '.jpeg') && file.type === 'image/jpeg') ||
    (ext === '.webp' && file.type === 'image/webp');

  if (!hasValidExt || !hasValidType || !isConsistent) {
    return {
      isValid: false,
      error: 'Invalid file format. Please upload a high-resolution JPEG, PNG, or WebP image.',
    };
  }

  if (file.size <= 0) {
    return {
      isValid: false,
      error: 'File is empty (0 bytes). Please upload a valid image file.',
    };
  }

  if (file.size > MAX_ARTWORK_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File size (${sizeMb} MB) exceeds the 20 MB limit. Please select an image under 20 MB.`,
    };
  }

  return { isValid: true };
}

export interface UploadArtworkResult {
  url: string | null;
  storageUrl?: string | null;
  dbSaved: boolean;
  error: string | null;
}

/**
 * Uploads a verified original artwork file for a product to Supabase Storage
 * and persists the artwork reference to the database without altering storefront mockups.
 * 
 * Target Storage Path: `artworks/{productId}.{ext}`
 * Bucket: `posters`
 */
export async function uploadProductOriginalArtwork(
  productId: number | string,
  file: File
): Promise<UploadArtworkResult> {
  if (!isSupabaseConfigured()) {
    return { url: null, storageUrl: null, dbSaved: false, error: 'Supabase is not configured' };
  }

  const validation = validateArtworkFile(file);
  if (!validation.isValid) {
    return { url: null, storageUrl: null, dbSaved: false, error: validation.error || 'Invalid artwork file' };
  }

  const numId = Number(productId);
  if (isNaN(numId) || numId <= 0) {
    return { url: null, storageUrl: null, dbSaved: false, error: `Invalid product ID: ${productId}` };
  }

  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const storagePath = `${ARTWORK_STORAGE_FOLDER}/${numId}.${ext}`;

  try {
    // 1. Upload to Supabase Storage with collision-safe replacement (upsert)
    const { error: uploadError } = await supabase.storage
      .from(POSTER_ARTWORK_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload artwork to Supabase Storage:', uploadError);
      const isRls =
        uploadError.message?.toLowerCase().includes('row-level security') ||
        uploadError.message?.toLowerCase().includes('policy') ||
        (uploadError as any).statusCode === '403' ||
        (uploadError as any).status === 400;

      const userFriendlyError = isRls
        ? "Storage upload rejected: Row-level security (RLS) on bucket 'posters' denied upload. Please execute 'supabase/migrations/20261024010000_storage_posters_admin_policy.sql' in Supabase SQL Editor to grant upload permissions."
        : `Storage upload failed: ${uploadError.message}`;

      return { url: null, storageUrl: null, dbSaved: false, error: userFriendlyError };
    }

    // 2. Resolve public URL
    const { data: urlData } = supabase.storage
      .from(POSTER_ARTWORK_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      return { url: null, storageUrl: null, dbSaved: false, error: 'Failed to retrieve public URL for uploaded artwork.' };
    }

    // 3. Persist artwork_url in database products table with verified mutation
    const { data: updatedRows, error: updateError } = await supabase
      .from('products')
      .update({ artwork_url: publicUrl })
      .eq('id', numId)
      .select('id, name, artwork_url');

    if (updateError) {
      console.error('Database update failed for products.artwork_url:', updateError);
      return {
        url: null,
        storageUrl: publicUrl,
        dbSaved: false,
        error: `Artwork was uploaded to Storage (${storagePath}), but saving reference to database failed: ${updateError.message}. Storage image is preserved; please retry saving.`,
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error(`Database update returned 0 rows for product ID ${numId}`);
      return {
        url: null,
        storageUrl: publicUrl,
        dbSaved: false,
        error: `Artwork was uploaded to Storage (${storagePath}), but product #${numId} was not found or could not be updated in the database.`,
      };
    }

    return { url: publicUrl, storageUrl: publicUrl, dbSaved: true, error: null };
  } catch (err: any) {
    console.error('Error in uploadProductOriginalArtwork:', err);
    return {
      url: null,
      storageUrl: null,
      dbSaved: false,
      error: err.message || 'An unexpected error occurred during artwork upload',
    };
  }
}

/**
 * Persists an existing artwork URL directly to products.artwork_url in database.
 * Useful for retrying database persistence without re-uploading file.
 */
export async function persistProductArtworkUrl(
  productId: number | string,
  artworkUrl: string
): Promise<{ success: boolean; error: string | null }> {
  const numId = Number(productId);
  if (isNaN(numId) || numId <= 0) {
    return { success: false, error: `Invalid product ID: ${productId}` };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .update({ artwork_url: artworkUrl })
      .eq('id', numId)
      .select('id, artwork_url');

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: `Product #${numId} was not found in the database.` };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to persist artwork URL' };
  }
}

/**
 * Removes original artwork for a product from Supabase Storage and clears artwork_url.
 */
export async function removeProductOriginalArtwork(
  productId: number | string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  const numId = Number(productId);
  if (isNaN(numId) || numId <= 0) {
    return { success: false, error: `Invalid product ID: ${productId}` };
  }

  try {
    const possibleFiles = ALLOWED_ARTWORK_EXTENSIONS.map(
      (ext) => `${ARTWORK_STORAGE_FOLDER}/${numId}${ext}`
    );

    const { error: storageRemoveErr } = await supabase.storage
      .from(POSTER_ARTWORK_BUCKET)
      .remove(possibleFiles);

    if (storageRemoveErr) {
      console.warn('Storage file remove notice:', storageRemoveErr.message);
    }

    const { data, error: dbError } = await supabase
      .from('products')
      .update({ artwork_url: null })
      .eq('id', numId)
      .select('id, artwork_url');

    if (dbError) {
      return { success: false, error: `Failed to clear artwork_url in database: ${dbError.message}` };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to remove artwork' };
  }
}

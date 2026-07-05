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

/** Upload a file to a Supabase Storage bucket */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { url: null, error: 'Supabase is not configured' };
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: options?.upsert ?? false,
    });

  if (error) {
    console.error('Supabase Upload Failure Details:', {
      table: 'storage.objects',
      payload: {
        bucket: bucket,
        path: path,
        fileName: file.name,
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

/** Upload a custom design from the Customize page */
export async function uploadCustomDesign(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const ext = file.name.split('.').pop();
  const path = `uploads/design-${timestamp}-${random}.${ext}`;
  return uploadFile(BUCKETS.CUSTOM_DESIGNS, path, file);
}

export { BUCKETS };

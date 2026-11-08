import {
  uploadFile,
  getPublicUrl,
  BUCKETS,
  calculateFileSha256,
  getCachedArtworkRecord,
  saveArtworkRegistryRecord,
  UserScopedArtworkRecord,
} from '../services/storage';
import {
  registerCustomArtwork,
  findCustomArtworkByUserAndSha256,
  verifyStorageObjectAvailability,
  resolveArtworkMimeType,
  extractRelativeStoragePath,
  MASTER_PATH_REGEX,
  PREVIEW_PATH_REGEX,
} from '../services/artworkLifecycle';

export interface ImageVariantResult {
  blob: Blob;
  width: number;
  height: number;
  targetWidth: number;
}

export interface StorefrontVariants {
  thumb100: ImageVariantResult;
  card400: ImageVariantResult;
  preview800: ImageVariantResult;
}

export interface StorefrontUrls {
  image_thumbnail_url: string | null;
  image_card_url: string | null;
  image_preview_url: string | null;
}

/**
 * Sanitizes genre, product ID, and filename to prevent storage path collisions and invalid URL characters.
 */
export const sanitizeStoragePathSegment = (segment: string | number): string => {
  return String(segment)
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
};

/**
 * Builds versioned storefront storage path for immutable caching.
 * Pattern: storefront/{genre}/{productId}/{version}/{size}.webp
 */
export const buildStorefrontPath = (
  genre: string,
  productId: number | string,
  version: string | number,
  size: 100 | 400 | 800
): string => {
  const cleanGenre = sanitizeStoragePathSegment(genre || 'general');
  const cleanProdId = sanitizeStoragePathSegment(productId || 'unknown');
  const cleanVersion = sanitizeStoragePathSegment(version || Date.now());

  return `storefront/${cleanGenre}/${cleanProdId}/${cleanVersion}/${size}.webp`;
};

/**
 * Generates a single WebP image variant preserving aspect ratio and preventing upscaling.
 * Quality Settings:
 *  - 100px: ~0.78 (78% quality)
 *  - 400px: ~0.82 (82% quality)
 *  - 800px: ~0.84 (84% quality)
 */
export const generateImageVariant = (
  source: File | Blob | string,
  targetWidth: number,
  quality: number = 0.82
): Promise<ImageVariantResult> => {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('Canvas variant generation requires browser DOM environment'));
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl: string | null = null;
    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);

      const naturalWidth = img.naturalWidth || img.width;
      const naturalHeight = img.naturalHeight || img.height;

      if (!naturalWidth || !naturalHeight) {
        return reject(new Error('Invalid image dimensions'));
      }

      // Prevent upscaling
      const finalWidth = Math.min(targetWidth, naturalWidth);
      const ratio = naturalHeight / naturalWidth;
      const finalHeight = Math.round(finalWidth * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to get 2D canvas context'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Canvas toBlob failed'));
          }
          resolve({
            blob,
            width: finalWidth,
            height: finalHeight,
            targetWidth
          });
        },
        'image/webp',
        quality
      );
    };

    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image for variant generation: ${err}`));
    };
  });
};

/**
 * Generates all three storefront WebP variants (100px, 400px, 800px) in parallel.
 */
export const generateAllStorefrontVariants = async (
  source: File | Blob | string
): Promise<StorefrontVariants> => {
  const [thumb100, card400, preview800] = await Promise.all([
    generateImageVariant(source, 100, 0.78),
    generateImageVariant(source, 400, 0.82),
    generateImageVariant(source, 800, 0.84)
  ]);

  return { thumb100, card400, preview800 };
};

/**
 * Generates and uploads 100px, 400px, and 800px WebP storefront variants to Supabase Storage.
 * Uses versioned path: posters/storefront/{genre}/{productId}/{version}/{size}.webp
 */
export const uploadStorefrontVariants = async (
  genre: string,
  productId: number | string,
  source: File | Blob | string,
  customVersion?: string | number
): Promise<StorefrontUrls> => {
  try {
    const version = customVersion || Date.now();
    const variants = await generateAllStorefrontVariants(source);

    const path100 = buildStorefrontPath(genre, productId, version, 100);
    const path400 = buildStorefrontPath(genre, productId, version, 400);
    const path800 = buildStorefrontPath(genre, productId, version, 800);

    // Cache-Control for immutable versioned storefront assets (1 year in seconds)
    const cacheHeader = '31536000';

    const [res100, res400, res800] = await Promise.all([
      uploadFile(BUCKETS.POSTERS, path100, variants.thumb100.blob, { upsert: true, cacheControl: cacheHeader }),
      uploadFile(BUCKETS.POSTERS, path400, variants.card400.blob, { upsert: true, cacheControl: cacheHeader }),
      uploadFile(BUCKETS.POSTERS, path800, variants.preview800.blob, { upsert: true, cacheControl: cacheHeader })
    ]);

    return {
      image_thumbnail_url: res100.url,
      image_card_url: res400.url,
      image_preview_url: res800.url
    };
  } catch (err) {
    console.error('Error generating/uploading storefront variants:', err);
    // Non-blocking fallback: return nulls if variant generation fails
    return {
      image_thumbnail_url: null,
      image_card_url: null,
      image_preview_url: null
    };
  }
};

/**
 * Result of a customer custom design upload.
 */
export interface CustomDesignProcessResult {
  url: string | null;           // Display URL (preview WebP, or fallback to original)
  artworkUrl: string | null;    // Original uncompressed master print URL
  previewUrl: string | null;    // 400px WebP preview URL (or fallback to original)
  error: string | null;
}

/**
 * Processes a custom poster upload from the Customize page:
 * 1. Preserves original file byte-for-byte in custom-designs/uploads/ (cacheControl: '3600', upsert: false).
 * 2. Generates one 400px WebP preview (max width 400px, aspect ratio preserved, no upscaling, quality 0.82, alpha transparency preserved).
 * 3. Uploads preview to custom-designs/previews/ (cacheControl: '31536000', upsert: false).
 * 4. If preview generation or upload fails, non-fatally falls back to original artwork URL.
 * 5. If original upload fails, halts operation and returns error.
 * 6. Does not duplicate original upload if existingArtworkUrl is supplied.
 */
export async function processCustomDesignUpload(
  file: File,
  existingArtworkUrl?: string | null
): Promise<CustomDesignProcessResult> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';

  let artworkUrl = existingArtworkUrl || null;

  // Step 1: Upload original master if not already uploaded
  if (!artworkUrl) {
    const originalPath = `uploads/design-${timestamp}-${random}.${ext}`;
    const origRes = await uploadFile(BUCKETS.CUSTOM_DESIGNS, originalPath, file, {
      cacheControl: '3600',
      upsert: false
    });

    if (origRes.error || !origRes.url) {
      return {
        url: null,
        artworkUrl: null,
        previewUrl: null,
        error: origRes.error || 'Failed to upload original artwork'
      };
    }
    artworkUrl = origRes.url;
  }

  // Step 2: Generate and upload 400px WebP preview
  let previewUrl: string | null = null;
  const previewPath = `previews/design-${timestamp}-${random}-400.webp`;

  try {
    const variant = await generateImageVariant(file, 400, 0.82);
    const prevRes = await uploadFile(BUCKETS.CUSTOM_DESIGNS, previewPath, variant.blob, {
      cacheControl: '31536000',
      upsert: false
    });

    if (prevRes.error || !prevRes.url) {
      console.warn('[CustomPoster] Preview upload failed, using original URL fallback:', prevRes.error);
      previewUrl = artworkUrl;
    } else {
      previewUrl = prevRes.url;
    }
  } catch (prevErr) {
    console.warn('[CustomPoster] Preview generation failed, using original URL fallback:', prevErr);
    previewUrl = artworkUrl;
  }

  return {
    url: previewUrl || artworkUrl,
    artworkUrl,
    previewUrl: previewUrl || artworkUrl,
    error: null
  };
}

// Track in-flight uploads within this page session to deduplicate identical concurrent operations
const inFlightUploads = new Map<string, Promise<PosterKitUploadResult>>();

export interface PosterKitProcessUploadOptions {
  userId: string;
  customArtworkId?: string;
  customArtworkFileName?: string;
}

export interface PosterKitUploadResult {
  artwork_url: string | null; // Master uncompressed original file in uploads/
  image: string | null;       // 400px WebP preview in previews/
  customArtworkId: string;
  customArtworkFileName?: string;
  sha256: string;
  error: string | null;       // Storage upload error
  registrationError?: string | null; // Phase 3C: Dedicated database registration diagnostic
  dbArtworkId?: string;       // Phase 3C: Supabase custom_artworks primary key UUID
  reusedFromCache?: boolean;
}

/**
 * Phase 3B: Poster Kit custom artwork upload coordinator.
 * 
 * Guarantees:
 * 1. Strict authentication check: blocks unauthenticated uploads.
 * 2. Cryptographic SHA-256 byte-level deduplication.
 * 3. Immediate partial registry persistence after original master upload.
 * 4. Separate 400px WebP preview generation (never recompressing the master).
 * 5. Web Locks API cross-tab coordination with in-flight deduplication.
 * 6. upsert: false and unique paths ensuring no file overwrite.
 */
export async function processPosterKitCustomUpload(
  file: File | Blob,
  options: PosterKitProcessUploadOptions
): Promise<PosterKitUploadResult> {
  if (!options.userId || options.userId === 'anonymous') {
    return {
      artwork_url: null,
      image: null,
      customArtworkId: options.customArtworkId || '',
      customArtworkFileName: options.customArtworkFileName,
      sha256: '',
      error: 'Authentication required: User must be signed in to upload artwork.',
    };
  }

  // 1. Explicit positive file-size validation (Correction 5: reject zero-byte files, never fabricate)
  const rawSize = typeof (file as any)?.size === 'number' ? (file as any).size : null;
  if (rawSize === null || !Number.isFinite(rawSize) || rawSize <= 0) {
    return {
      artwork_url: null,
      image: null,
      customArtworkId: options.customArtworkId || '',
      customArtworkFileName: options.customArtworkFileName,
      sha256: '',
      error: 'Invalid artwork file: File is empty (0 bytes) or has an invalid size. Upload rejected.',
    };
  }
  const fileSize: number = rawSize;

  // 2. Resolve MIME type strictly: when browser MIME is empty, resolve ONLY from supported extension (Correction 4)
  const candidateFileName = options.customArtworkFileName || (file as File).name || 'custom-artwork.png';
  const resolvedMime = resolveArtworkMimeType((file as File).type, candidateFileName);
  if (!resolvedMime) {
    return {
      artwork_url: null,
      image: null,
      customArtworkId: options.customArtworkId || '',
      customArtworkFileName: candidateFileName,
      sha256: '',
      error: `Unsupported or unidentifiable file type for "${candidateFileName}". Only PNG, JPG/JPEG, WebP, and AVIF are supported.`,
    };
  }

  // 3. Calculate byte-accurate SHA-256 hash
  let sha256: string;
  try {
    sha256 = await calculateFileSha256(file);
  } catch (hashErr: any) {
    return {
      artwork_url: null,
      image: null,
      customArtworkId: options.customArtworkId || '',
      customArtworkFileName: options.customArtworkFileName,
      sha256: '',
      error: `Artwork integrity check failed: ${hashErr?.message || hashErr}`,
    };
  }

  const uploadKey = `${options.userId}:${sha256}`;

  // 4. Reuse in-flight upload within the same page session
  if (inFlightUploads.has(uploadKey)) {
    return inFlightUploads.get(uploadKey)!;
  }

  const uploadPromise = (async (): Promise<PosterKitUploadResult> => {
    const runUpload = async (): Promise<PosterKitUploadResult> => {
      const fileName = options.customArtworkFileName || (file as File).name || 'custom-artwork.png';
      const artworkId = options.customArtworkId || `custom-art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Check user-scoped registry for existing verified record
      const cached = getCachedArtworkRecord(options.userId, sha256);

      // Case A: Fully completed in local registry
      if (cached && cached.status === 'completed' && cached.artwork_url && cached.image) {
        // Correction 2: Validate both cached artwork URLs against exact configured Supabase project
        // and approved custom-designs bucket paths, regardless of whether cached.dbArtworkId already exists
        const validatedMaster = extractRelativeStoragePath(cached.artwork_url);
        const validatedPreview = extractRelativeStoragePath(cached.image);

        const isMasterValid = validatedMaster && MASTER_PATH_REGEX.test(validatedMaster);
        const isPreviewValid = validatedPreview && (PREVIEW_PATH_REGEX.test(validatedPreview) || validatedPreview === validatedMaster);

        if (!isMasterValid || !isPreviewValid) {
          console.warn('[PosterKitUpload] Cached local artwork contains invalid storage URLs or foreign project origin. Rejecting cache entry.');
          // Do not return invalid cached URLs! Fall through to database lookup / fresh upload.
        } else {
          // Both cached URLs are verified valid
          let dbArtworkId = cached.dbArtworkId;
          let registrationError: string | null = null;

          if (!dbArtworkId) {
            try {
              const regResult = await registerCustomArtwork({
                userId: options.userId,
                sha256,
                storageMasterPath: cached.artwork_url,
                storagePreviewPath: cached.image,
                fileSize,
                mimeType: resolvedMime,
              });
              if (regResult.success) {
                dbArtworkId = regResult.record.id;
                saveArtworkRegistryRecord({
                  ...cached,
                  dbArtworkId,
                });
              } else {
                registrationError = regResult.error;
                console.warn('[PosterKitUpload] Local cache backfill registration diagnostic:', regResult.error);
              }
            } catch (regErr: any) {
              registrationError = regErr?.message || String(regErr);
              console.warn('[PosterKitUpload] Local cache backfill registration warning:', regErr);
            }
          }

          return {
            artwork_url: cached.artwork_url,
            image: cached.image,
            customArtworkId: cached.customArtworkId || artworkId,
            customArtworkFileName: cached.customArtworkFileName || fileName,
            sha256,
            error: null,
            registrationError,
            dbArtworkId,
            reusedFromCache: true,
          };
        }
      }

      // Case B: Master was uploaded in a previous session, but preview was interrupted
      if (cached && cached.status === 'master_uploaded' && cached.artwork_url) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const previewPath = `previews/design-${timestamp}-${random}-400.webp`;

        let previewUrl: string | null = null;
        try {
          const variant = await generateImageVariant(file, 400, 0.82);
          const prevRes = await uploadFile(BUCKETS.CUSTOM_DESIGNS, previewPath, variant.blob, {
            cacheControl: '31536000',
            upsert: false,
          });

          if (!prevRes.error && prevRes.url) {
            previewUrl = prevRes.url;
          } else {
            console.warn('[PosterKitUpload] Preview recovery upload failed, falling back to master:', prevRes.error);
            previewUrl = cached.artwork_url;
          }
        } catch (variantErr) {
          console.warn('[PosterKitUpload] Preview recovery generation failed, falling back to master:', variantErr);
          previewUrl = cached.artwork_url;
        }

        const finalPreviewUrl = previewUrl || cached.artwork_url;
        const finalPreviewPath = previewUrl && previewUrl !== cached.artwork_url ? previewPath : null;

        // Attempt registration in database if dbArtworkId is missing
        let dbArtworkId = cached.dbArtworkId;
        let registrationError: string | null = null;
        if (!dbArtworkId) {
          try {
            const regResult = await registerCustomArtwork({
              userId: options.userId,
              sha256,
              storageMasterPath: cached.artwork_url,
              storagePreviewPath: finalPreviewPath,
              fileSize,
              mimeType: resolvedMime,
            });
            if (regResult.success) {
              dbArtworkId = regResult.record.id;
            } else {
              registrationError = regResult.error;
            }
          } catch (regErr: any) {
            registrationError = regErr?.message || String(regErr);
          }
        }

        // Persist final preview URL, completed status, and dbArtworkId consistently to registry
        saveArtworkRegistryRecord({
          ...cached,
          image: finalPreviewUrl,
          status: 'completed',
          dbArtworkId,
        });

        return {
          artwork_url: cached.artwork_url,
          image: finalPreviewUrl,
          customArtworkId: cached.customArtworkId || artworkId,
          customArtworkFileName: cached.customArtworkFileName || fileName,
          sha256,
          error: null,
          registrationError,
          dbArtworkId,
          reusedFromCache: true,
        };
      }

      // Case C: Check Database for existing verified record before initiating upload
      // Safeguard 1: Tri-state lookup distinguishing found, not_found, and error
      const dbLookup = await findCustomArtworkByUserAndSha256(options.userId, sha256);
      if (dbLookup.status === 'found') {
        // Issue 3: Verify storage object availability with tri-state status (available | missing | inconclusive)
        const { masterStatus, previewStatus } = await verifyStorageObjectAvailability(
          dbLookup.record.storage_master_path,
          dbLookup.record.storage_preview_path
        );

        if (masterStatus === 'available') {
          const masterUrl = getPublicUrl(BUCKETS.CUSTOM_DESIGNS, dbLookup.record.storage_master_path);
          // Issue 4: When master is confirmed available but preview is missing or inconclusive,
          // use master public URL as display fallback. Preserve stored master and preview paths.
          const previewUrl =
            previewStatus === 'available' && dbLookup.record.storage_preview_path
              ? getPublicUrl(BUCKETS.CUSTOM_DESIGNS, dbLookup.record.storage_preview_path)
              : masterUrl;

          // Save to local registry so future lookups are instantaneous
          saveArtworkRegistryRecord({
            userId: options.userId,
            sha256,
            customArtworkId: artworkId,
            artwork_url: masterUrl,
            image: previewUrl,
            customArtworkFileName: fileName,
            status: 'completed',
            uploadedAt: Date.now(),
            dbArtworkId: dbLookup.record.id,
          });

          return {
            artwork_url: masterUrl,
            image: previewUrl,
            customArtworkId: artworkId,
            customArtworkFileName: fileName,
            sha256,
            error: null,
            dbArtworkId: dbLookup.record.id,
            reusedFromCache: true,
          };
        } else if (masterStatus === 'missing') {
          console.warn('[PosterKitUpload] DB artwork record exists but master storage object is confirmed missing. Re-uploading to recover.');
        } else {
          // masterStatus === 'inconclusive'
          // Probe could not confirm availability due to network/timeout. Do not mislabel as available or missing.
          console.warn('[PosterKitUpload] Storage availability probe was inconclusive for master object.');
          return {
            artwork_url: null,
            image: null,
            customArtworkId: artworkId,
            customArtworkFileName: fileName,
            sha256,
            error: 'Storage verification was inconclusive. Please retry upload.',
            registrationError: 'Master storage object probe was inconclusive.',
          };
        }
      } else if (dbLookup.status === 'error') {
        // Issue 2: Only not_found may trigger a fresh upload.
        // On error, reuse valid existing local cache if available; otherwise return clear retryable error.
        // Never treat a failed database lookup as a confirmed cache miss.
        console.warn('[PosterKitUpload] Database lookup returned error:', dbLookup.error);
        if (cached && cached.artwork_url && cached.image) {
          return {
            artwork_url: cached.artwork_url,
            image: cached.image,
            customArtworkId: cached.customArtworkId || artworkId,
            customArtworkFileName: cached.customArtworkFileName || fileName,
            sha256,
            error: null,
            registrationError: dbLookup.error,
            dbArtworkId: cached.dbArtworkId,
            reusedFromCache: true,
          };
        }

        return {
          artwork_url: null,
          image: null,
          customArtworkId: artworkId,
          customArtworkFileName: fileName,
          sha256,
          error: `Database lookup failed: ${dbLookup.error}. Please retry.`,
          registrationError: dbLookup.error,
        };
      }

      // Case D: New Upload (Two-Stage Upload)
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = (file as File).name?.split('.').pop()?.toLowerCase() || 'png';
      const originalPath = `uploads/design-${timestamp}-${random}.${ext}`;

      // Stage 1: Upload byte-identical original master
      const origRes = await uploadFile(BUCKETS.CUSTOM_DESIGNS, originalPath, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (origRes.error || !origRes.url) {
        return {
          artwork_url: null,
          image: null,
          customArtworkId: artworkId,
          customArtworkFileName: fileName,
          sha256,
          error: origRes.error || 'Failed to upload original master artwork',
        };
      }

      const originalMasterUrl = origRes.url;

      // IMMEDIATE PARTIAL REGISTRY PERSISTENCE (Requirement 1 & 4)
      saveArtworkRegistryRecord({
        userId: options.userId,
        sha256,
        customArtworkId: artworkId,
        artwork_url: originalMasterUrl,
        image: null,
        customArtworkFileName: fileName,
        status: 'master_uploaded',
        uploadedAt: Date.now(),
      });

      // Stage 2: Generate and upload 400px WebP preview
      const previewPath = `previews/design-${timestamp}-${random}-400.webp`;
      let previewUrl: string | null = null;

      try {
        const variant = await generateImageVariant(file, 400, 0.82);
        const prevRes = await uploadFile(BUCKETS.CUSTOM_DESIGNS, previewPath, variant.blob, {
          cacheControl: '31536000',
          upsert: false,
        });

        if (!prevRes.error && prevRes.url) {
          previewUrl = prevRes.url;
        } else {
          console.warn('[PosterKitUpload] Preview upload failed, using original master fallback:', prevRes.error);
          previewUrl = originalMasterUrl;
        }
      } catch (variantErr) {
        console.warn('[PosterKitUpload] Preview generation failed, using original master fallback:', variantErr);
        previewUrl = originalMasterUrl;
      }

      // Stage 3: Phase 3C Metadata Registration in public.custom_artworks
      let dbArtworkId: string | undefined;
      let registrationError: string | null = null;
      try {
        const regResult = await registerCustomArtwork({
          userId: options.userId,
          sha256,
          storageMasterPath: originalPath,
          storagePreviewPath: previewUrl === originalMasterUrl ? originalPath : previewPath,
          fileSize,
          mimeType: resolvedMime,
        });
        if (regResult.success) {
          dbArtworkId = regResult.record.id;
        } else {
          registrationError = regResult.error;
          console.warn('[PosterKitUpload] Artwork database registration diagnostic:', regResult.error);
        }
      } catch (regErr: any) {
        registrationError = regErr?.message || String(regErr);
        console.warn('[PosterKitUpload] Artwork database registration exception:', regErr);
      }

      // Completed local registry persistence (with dbArtworkId if registered)
      saveArtworkRegistryRecord({
        userId: options.userId,
        sha256,
        customArtworkId: artworkId,
        artwork_url: originalMasterUrl,
        image: previewUrl || originalMasterUrl,
        customArtworkFileName: fileName,
        status: 'completed',
        uploadedAt: Date.now(),
        dbArtworkId,
      });

      return {
        artwork_url: originalMasterUrl,
        image: previewUrl || originalMasterUrl,
        customArtworkId: artworkId,
        customArtworkFileName: fileName,
        sha256,
        error: null,
        registrationError,
        dbArtworkId,
      };
    };

    // 3. Web Locks API cross-tab coordination
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
      return navigator.locks.request(`upload_${options.userId}_${sha256}`, runUpload);
    }
    return runUpload();
  })();

  inFlightUploads.set(uploadKey, uploadPromise);
  try {
    return await uploadPromise;
  } finally {
    inFlightUploads.delete(uploadKey);
  }
}

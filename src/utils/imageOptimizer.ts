import { uploadFile, BUCKETS } from '../services/storage';

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
  file: File | Blob
): Promise<StorefrontVariants> => {
  const [thumb100, card400, preview800] = await Promise.all([
    generateImageVariant(file, 100, 0.78),
    generateImageVariant(file, 400, 0.82),
    generateImageVariant(file, 800, 0.84)
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
  file: File | Blob,
  customVersion?: string | number
): Promise<StorefrontUrls> => {
  try {
    const version = customVersion || Date.now();
    const variants = await generateAllStorefrontVariants(file);

    const path100 = buildStorefrontPath(genre, productId, version, 100);
    const path400 = buildStorefrontPath(genre, productId, version, 400);
    const path800 = buildStorefrontPath(genre, productId, version, 800);

    // Cache-Control for immutable versioned storefront assets (1 year)
    const cacheHeader = 'public, max-age=31536000, immutable';

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

/**
 * Image Utilities & Storefront Variant Resolution System
 * 
 * Provides fallback-safe image URL resolution and optimization helpers.
 */

export type StorefrontSizeKey = 'thumbnail' | 'card' | 'preview' | 100 | 400 | 800;

export interface MinimalProductImageInfo {
  image?: string | null;
  image_thumbnail_url?: string | null;
  image_card_url?: string | null;
  image_preview_url?: string | null;
}

/**
 * Resolves the appropriate storefront image variant URL for a product.
 * Fallback Rule: If the requested optimized variant URL is missing/empty,
 * it returns the original `image` URL. This guarantees 100% backward compatibility.
 */
export const getStorefrontImage = (
  product: MinimalProductImageInfo | null | undefined,
  size: StorefrontSizeKey = 'card'
): string => {
  if (!product) return '';

  const isThumb = size === 100 || size === 'thumbnail';
  const isPreview = size === 800 || size === 'preview';

  if (isThumb && product.image_thumbnail_url) {
    return product.image_thumbnail_url;
  }
  if (isPreview && product.image_preview_url) {
    return product.image_preview_url;
  }
  if (!isThumb && !isPreview && product.image_card_url) {
    return product.image_card_url;
  }

  // FALLBACK: If optimized variant is missing, return original high-res image
  return product.image || '';
};

/**
 * Standardized storage path builder for optimized storefront WebP variants.
 * Format: storefront/{genre}/{productId}/{version}/{size}.webp
 */
export const getStorefrontPath = (
  genre: string,
  productId: number | string,
  version: string | number,
  size: 100 | 400 | 800
): string => {
  const cleanGenre = genre.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  const cleanProdId = String(productId).trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  const cleanVer = String(version).trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  
  return `storefront/${cleanGenre}/${cleanProdId}/${cleanVer}/${size}.webp`;
};

/**
 * Helper to transform a public image URL into an optimized, resized version.
 * Preserved for backward compatibility across existing callsites.
 */
export const getOptimizedImageUrl = (url: string, width?: number, height?: number): string => {
  if (!url) return '';
  
  // If it's a Supabase storage URL, return as-is unless specific storefront variant is handled
  if (url.includes('/storage/v1/object/public/')) {
    return url;
  }
  
  // If it's an Unsplash URL, modify the search parameters
  if (url.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(url);
      if (width) urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('q', '80');
      urlObj.searchParams.set('auto', 'format');
      
      if (width && height) {
        urlObj.searchParams.set('fit', 'crop');
      } else {
        urlObj.searchParams.set('fit', 'max');
      }
      
      return urlObj.toString();
    } catch (e) {
      return url;
    }
  }

  return url;
};

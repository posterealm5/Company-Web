/**
 * Helper to transform a public image URL into an optimized, resized version.
 * Supports Supabase Storage rendering service and Unsplash dynamic parameter API.
 */
export const getOptimizedImageUrl = (url: string, width?: number, height?: number): string => {
  if (!url) return '';
  
  // If it's a Supabase storage URL, return the original public URL as-is
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
      
      // Only crop if both width and height are requested
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

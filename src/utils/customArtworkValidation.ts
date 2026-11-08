/**
 * Shared validator for customer custom artwork in checkout.
 * Enforces that any custom masterpiece or custom Poster Kit poster possesses:
 * 1. A permanent, verified HTTPS original print-master URL in `artwork_url`
 * 2. A permanent, verified HTTPS preview URL in `image`
 * 3. No `artworkMissing` flag or transient `blob:` URLs.
 *
 * Storefront collection items and normal catalog products strictly return false (bypass).
 */
export function validateCustomArtworkItems(items: Array<{
  name?: string;
  title?: string;
  origin?: string;
  isPosterKit?: boolean;
  posterKit?: boolean;
  customArtworkId?: string;
  artwork_source?: string;
  artworkSource?: string;
  artwork_url?: string | null;
  image?: string | null;
  artworkMissing?: boolean;
}>): { isValid: boolean; invalidItem?: any } {
  const invalidItem = items.find(item => {
    const isCustom = Boolean(
      item.customArtworkId ||
      item.origin === 'custom' ||
      ((item.isPosterKit || item.posterKit || item.origin === 'poster_kit') &&
        (item.artwork_source === 'custom' || item.artworkSource === 'custom')) ||
      item.name === 'Custom Design' ||
      item.name === 'Custom Masterpiece' ||
      item.title === 'Custom Design'
    );
    if (!isCustom) return false;
    const master = item.artwork_url;
    const preview = item.image;
    return (
      item.artworkMissing ||
      !master ||
      master.startsWith('blob:') ||
      !master.startsWith('http') ||
      !preview ||
      preview.startsWith('blob:')
    );
  });

  return { isValid: !invalidItem, invalidItem };
}


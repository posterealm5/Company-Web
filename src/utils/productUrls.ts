import type { Product } from '../types/database';

export const getProductPageUrl = (product: { slug?: string | null }): string | null => {
  if (!product || !product.slug) return null;
  return `/products/${product.slug}`;
};

export const getProductShareUrl = (product: { slug?: string | null }): string | null => {
  if (!product) return null;
  const pageUrl = getProductPageUrl(product);
  if (!pageUrl) return null;
  const origin = window.location.origin;
  return `${origin}${pageUrl}`;
};

/**
 * Resolves the display name of a product.
 * Prefer `display_name` if it exists. Otherwise, fall back to `name`.
 * This separates visual presentation from SEO metadata.
 */
export const getProductDisplayName = (product: Product): string => {
  if (!product) return '';
  return product.display_name || product.name;
};

/**
 * @deprecated Automatic string-manipulation display title generation is deprecated.
 * Use getProductDisplayName(product) instead.
 */
export const getDisplayTitle = (name: string): string => {
  return name;
};

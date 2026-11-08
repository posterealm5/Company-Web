import type { PosterSizeId, PosterMaterialId, PlacedPoster } from '../types/posterKit';
import { POSTER_MATERIALS } from '../types/posterKit';
import { POSTER_SIZES } from './posterKitMath';
import { isStorefrontMockupUrl } from '../services/posterArtwork';

/**
 * Result of validating a Poster Kit wall layout before adding to cart.
 */
export interface WallLayoutValidationResult {
  isValid: boolean;
  totalPosters: number;
  assignedPosters: number;
  blankPosters: number;
  reason?: string;
}

/**
 * Validates that every poster grid on the wall has a valid assigned design.
 * - Entirely blank or partially blank layouts fail validation.
 * - Valid collection design requires a usable standalone artwork URL and product reference.
 * - Valid custom design requires a valid custom artwork reference (ID or usable blob/http URL).
 * - Room mockups, placeholders, or empty strings are strictly rejected.
 */
export function validateWallLayout(posters: PlacedPoster[]): WallLayoutValidationResult {
  if (!posters || !Array.isArray(posters) || posters.length === 0) {
    return {
      isValid: false,
      totalPosters: 0,
      assignedPosters: 0,
      blankPosters: 0,
      reason: 'Empty wall layout',
    };
  }

  let blankCount = 0;
  let assignedCount = 0;

  for (const poster of posters) {
    const url = (poster.artworkUrl || poster.artwork?.url || '').trim();
    const customId = (poster.customArtworkId || poster.artwork?.customArtworkId || '').trim();
    const isCustom = poster.artworkSource === 'custom' || poster.artwork?.source === 'custom' || Boolean(customId);
    const colProdId = (poster as any).productId || poster.artworkProductId || poster.artwork?.productId || (poster as any).collectionProductId;
    const isCollection = !isCustom && (poster.artworkSource === 'collection' || poster.artwork?.source === 'collection' || Boolean(colProdId));

    if (isCustom) {
      // Must have both a valid customArtworkId and a usable custom image URL
      const hasValidCustomId = Boolean(customId && customId.length > 0);
      const hasValidCustomUrl = Boolean(
        url &&
        url.length > 0 &&
        !url.includes('placeholder') &&
        url !== 'blob:invalid' &&
        (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('data:'))
      );

      if (hasValidCustomId && hasValidCustomUrl) {
        assignedCount++;
      } else {
        blankCount++;
      }
    } else if (isCollection) {
      // Must have valid product ID and usable non-mockup, non-placeholder standalone artwork
      const hasValidProd = Boolean(colProdId);
      const hasValidArt = Boolean(
        url &&
        url.length > 0 &&
        !url.includes('placeholder') &&
        !isStorefrontMockupUrl(url)
      );

      if (hasValidProd && hasValidArt) {
        assignedCount++;
      } else {
        blankCount++;
      }
    } else {
      // Unassigned poster grid
      blankCount++;
    }
  }

  const isValid = blankCount === 0 && assignedCount === posters.length && posters.length > 0;
  return {
    isValid,
    totalPosters: posters.length,
    assignedPosters: assignedCount,
    blankPosters: blankCount,
    reason: isValid ? undefined : `${blankCount} blank poster ${blankCount === 1 ? 'grid needs' : 'grids need'} a design`,
  };
}

/**
 * Exact unit prices in INR for Poster Kit prints:
 * - A6: Glossy ₹30, Matte ₹30, Rigid Board ₹100
 * - A5: Glossy ₹79, Matte ₹79, Rigid Board ₹150
 * - A4: Glossy ₹100, Matte ₹100, Rigid Board ₹230
 * - A3: Glossy ₹130, Matte ₹130, Rigid Board ₹290
 *
 * Glossy and Matte share the same price for each size.
 * Rigid Board has its own price per size.
 */
export const POSTER_KIT_PRICING: Record<PosterSizeId, Record<PosterMaterialId, number>> = {
  A6: {
    glossy: 30,
    matte: 30,
    rigid_board: 100,
  },
  A5: {
    glossy: 79,
    matte: 79,
    rigid_board: 150,
  },
  A4: {
    glossy: 100,
    matte: 100,
    rigid_board: 230,
  },
  A3: {
    glossy: 130,
    matte: 130,
    rigid_board: 290,
  },
};

/**
 * Normalizes material input into canonical PosterMaterialId ('matte' | 'glossy' | 'rigid_board').
 */
export function normalizePosterKitMaterial(material?: string): PosterMaterialId {
  if (!material) return 'matte';
  const m = material.trim().toLowerCase();
  if (
    m === 'rigid_board' ||
    m === 'rigid board' ||
    m === 'rigid' ||
    m === 'flagship' ||
    m === 'flagship material' ||
    m.includes('rigid') ||
    m.includes('board') ||
    m.includes('flagship')
  ) {
    return 'rigid_board';
  }
  if (m === 'glossy' || m.includes('gloss')) {
    return 'glossy';
  }
  return 'matte';
}

/**
 * Get unit price in INR for a given Poster Kit size and material.
 */
export function getPosterKitUnitPrice(
  sizeId: PosterSizeId | string,
  material: PosterMaterialId | string = 'matte'
): number {
  const normMat = normalizePosterKitMaterial(material);
  const canonicalSize = ((sizeId || '').trim().toUpperCase()) as PosterSizeId;
  const sizePricing = POSTER_KIT_PRICING[canonicalSize];
  if (!sizePricing) {
    return 0;
  }
  return sizePricing[normMat] ?? sizePricing.matte ?? 0;
}

/**
 * Deterministic integer hash for custom artwork IDs
 */
function hashStringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const DEFAULT_COLLECTION_STOREFRONT_MOCKUPS: Record<number, string> = {
  1: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop',
  2: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=800&auto=format&fit=crop',
  3: 'https://images.unsplash.com/photo-1578632738981-4246ed8039e0?q=80&w=800&auto=format&fit=crop',
  4: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=800&auto=format&fit=crop',
  5: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop',
  6: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800&auto=format&fit=crop',
  7: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800&auto=format&fit=crop',
  8: 'https://images.unsplash.com/photo-1514525253342-b0bb0d845ff2?q=80&w=800&auto=format&fit=crop',
  9: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop',
  10: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop',
  11: 'https://images.unsplash.com/photo-1558244661-9121f2827562?q=80&w=800&auto=format&fit=crop',
  12: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
  13: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop',
  14: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=800&auto=format&fit=crop',
  15: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop',
};

export const DEFAULT_COLLECTION_STOREFRONT_MOCKUP_FALLBACK =
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop';

/**
 * Returns a deliberate storefront product mockup URL for a collection product ID.
 * Never substitutes standalone print artwork.
 */
export function getFallbackStorefrontMockup(productId?: number | string | null): string {
  if (productId) {
    const numId = Number(productId);
    if (!isNaN(numId) && DEFAULT_COLLECTION_STOREFRONT_MOCKUPS[numId]) {
      return DEFAULT_COLLECTION_STOREFRONT_MOCKUPS[numId];
    }
  }
  return DEFAULT_COLLECTION_STOREFRONT_MOCKUP_FALLBACK;
}

/**
 * Detects whether a given URL or storage path represents a standalone print artwork file
 * (e.g. Supabase Storage `posters/artworks/` folder) rather than a storefront product mockup.
 */
export function isStandalonePrintArtworkUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return (
    lower.includes('/posters/artworks/') ||
    lower.includes('/artworks/') ||
    lower.startsWith('artworks/')
  );
}

/**
 * Helper to construct a standard CartItem for a Poster Kit poster.
 * - Custom artwork is always named "Custom Design" for customers, while preserving original filename as metadata.
 * - Custom artwork thumbnail displays the actual uploaded custom image.
 * - Collection artwork uses the collection product's normal storefront mockup image for the cart thumbnail.
 * - Preserves standalone print artwork URL in `artwork_url` for printing and wall preview.
 * - Preserves size, material, quantity, and applies Poster Kit unit pricing.
 */
export function createPosterKitCartItem(poster: PlacedPoster): any {
  const size = ((poster.sizeId || (poster as any).size || 'A4')).toUpperCase();
  const materialKey = normalizePosterKitMaterial(poster.material);
  const materialName = POSTER_MATERIALS[materialKey]?.name || (materialKey === 'rigid_board' ? 'Rigid Board' : 'Matte');
  const unitPrice = getPosterKitUnitPrice(size, materialKey);

  const colProdId = (poster as any).productId || poster.artworkProductId || poster.artwork?.productId || (poster as any).collectionProductId;
  const isCustom = poster.artworkSource === 'custom' || poster.artwork?.source === 'custom' || Boolean(poster.customArtworkId) || Boolean(poster.artwork?.customArtworkId);
  const isCollection = !isCustom && (poster.artworkSource === 'collection' || poster.artwork?.source === 'collection' || Boolean(colProdId) || Boolean(poster.mockupUrl));
  const artworkSource = isCustom ? 'custom' : (isCollection ? 'collection' : (poster.artworkSource || poster.artwork?.source));

  // Customer-facing title:
  // - Custom artwork is strictly named "Custom Design"
  // - Collection artwork retains its collection product title
  // - Blank/unassigned poster falls back to standard label
  let displayName: string;
  let customFilename: string | undefined;

  if (isCustom) {
    displayName = 'Custom Design';
    customFilename =
      poster.customArtworkFileName ||
      poster.artwork?.customArtworkFileName ||
      (poster as any).customFile?.name ||
      (poster.artworkTitle && poster.artworkTitle !== 'Custom Design' && !poster.artworkTitle.startsWith('Poster (') ? poster.artworkTitle : undefined);
  } else if (isCollection) {
    displayName = poster.artworkTitle || poster.artwork?.title || 'Collection Poster';
  } else {
    displayName = poster.artworkTitle || poster.label || `Poster (${size})`;
  }

  // Cart item thumbnail:
  // - Collection designs strictly use the original storefront product mockup (product.image)
  // - Custom designs use the optimized 400px WebP preview URL
  let cartThumbnailImage: string;
  const standaloneArtworkUrl = poster.artworkUrl || poster.artwork?.url || '';
  const originalMasterUrl = poster.originalArtworkUrl || poster.artwork?.originalArtworkUrl || standaloneArtworkUrl;

  if (isCollection) {
    const rawMockup =
      poster.mockupUrl ||
      poster.artwork?.mockupUrl ||
      (poster as any).productImage ||
      (poster as any).image;

    // Must be a valid string that is NOT a standalone print artwork storage path
    if (rawMockup && typeof rawMockup === 'string' && rawMockup.trim() && !isStandalonePrintArtworkUrl(rawMockup)) {
      cartThumbnailImage = rawMockup.trim();
    } else if (standaloneArtworkUrl && !isStandalonePrintArtworkUrl(standaloneArtworkUrl)) {
      // Backward compatibility for generic external image URLs in tests
      cartThumbnailImage = standaloneArtworkUrl.trim();
    } else {
      // Deliberate fallback: resolve original storefront product mockup by ID or default storefront image.
      // NEVER silently substitute the standalone print artwork!
      cartThumbnailImage = getFallbackStorefrontMockup(colProdId);
    }
  } else {
    // Custom designs strictly use the 400px WebP preview URL for cart thumbnails
    cartThumbnailImage = standaloneArtworkUrl;
  }

  // Deterministic cart item ID:
  // - Collection posters: 900,000,000 + productId (distinct from regular storefront products)
  // - Custom posters: 1,000,000,000,000 + hash of customArtworkId
  // - Blank posters: 2,000,000,000,000 + hash of poster.id
  let cartItemId: number;
  if (isCollection && colProdId) {
    cartItemId = 900000000 + Number(colProdId);
  } else if (poster.customArtworkId) {
    cartItemId = 1000000000000 + (hashStringToId(poster.customArtworkId) % 900000000000);
  } else {
    cartItemId = 2000000000000 + (hashStringToId(poster.id) % 900000000000);
  }

  return {
    id: cartItemId,
    name: displayName,
    title: displayName,
    size: size,
    material: materialName,
    price: unitPrice,
    quantity: 1,
    image: cartThumbnailImage,
    selected: true,

    // Central pricing schema fields
    selected_size: size,
    selected_material: materialName,
    unit_price: unitPrice,
    line_total: unitPrice,

    // Pricing origin markers
    isPosterKit: true,
    posterKit: true,
    origin: 'poster_kit',

    // Design & Product tracking:
    // - item.image holds the 400px WebP preview URL (or storefront product mockup for collection)
    // - item.artwork_url strictly holds the uncompressed standalone original master URL for printing
    productId: colProdId ? Number(colProdId) : undefined,
    customArtworkId: poster.customArtworkId || poster.artwork?.customArtworkId,
    customArtworkFileName: customFilename,
    artwork_url: isCustom ? (originalMasterUrl || cartThumbnailImage) : (standaloneArtworkUrl || ''),
    artwork_source: artworkSource,
    // Omit redundant image_preview_url from custom cart items; collection items retain catalog variants
    image_thumbnail_url: isCollection ? undefined : (poster.image_thumbnail_url || poster.artwork?.image_thumbnail_url || null),
    image_card_url: isCollection ? (poster.image_card_url || poster.artwork?.image_card_url || null) : null,
    image_preview_url: isCollection ? (poster.image_preview_url || poster.artwork?.image_preview_url || null) : null,
    width: poster.widthPercent,
    height: poster.heightPercent,
  };
}

export interface PosterKitInvoiceItem {
  key: string;
  sizeId: PosterSizeId;
  material: PosterMaterialId;
  sizeName: string;
  materialName: string;
  label: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
}

export interface PosterKitInvoiceSummary {
  items: PosterKitInvoiceItem[];
  totalQuantity: number;
  subtotal: number;
  isEmpty: boolean;
}

/**
 * Deterministic order for presenting sizes and materials in invoice rows:
 * Sizes: A3 -> A4 -> A5 -> A6 (standard large-to-small printing invoice order)
 * Materials: Matte -> Glossy -> Rigid Board
 */
const SIZE_SORT_WEIGHT: Record<PosterSizeId, number> = {
  A3: 1,
  A4: 2,
  A5: 3,
  A6: 4,
};

const MATERIAL_SORT_WEIGHT: Record<PosterMaterialId, number> = {
  matte: 1,
  glossy: 2,
  rigid_board: 3,
};

/**
 * Pure calculation helper: derives live invoice-style summary from current layout state.
 * Groups posters by unique (sizeId, material) combinations.
 *
 * For every group:
 *   Line amount = Unit price × Quantity
 * Total / Subtotal = Sum of all line amounts
 */
export function calculatePosterKitInvoice(posters: PlacedPoster[]): PosterKitInvoiceSummary {
  if (!posters || posters.length === 0) {
    return {
      items: [],
      totalQuantity: 0,
      subtotal: 0,
      isEmpty: true,
    };
  }

  // Aggregate quantities by (sizeId, material)
  const groupMap = new Map<string, { sizeId: PosterSizeId; material: PosterMaterialId; quantity: number }>();

  for (const poster of posters) {
    const sizeId: PosterSizeId = poster.sizeId || 'A4';
    const material: PosterMaterialId = normalizePosterKitMaterial(poster.material);
    const key = `${sizeId}_${material}`;

    const existing = groupMap.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      groupMap.set(key, { sizeId, material, quantity: 1 });
    }
  }

  // Sort groups deterministically
  const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
    const sizeDiff = (SIZE_SORT_WEIGHT[a.sizeId] ?? 99) - (SIZE_SORT_WEIGHT[b.sizeId] ?? 99);
    if (sizeDiff !== 0) return sizeDiff;
    return (MATERIAL_SORT_WEIGHT[a.material] ?? 99) - (MATERIAL_SORT_WEIGHT[b.material] ?? 99);
  });

  let subtotal = 0;
  let totalQuantity = 0;

  const items: PosterKitInvoiceItem[] = sortedGroups.map((group) => {
    const unitPrice = getPosterKitUnitPrice(group.sizeId, group.material);
    const lineAmount = unitPrice * group.quantity;
    subtotal += lineAmount;
    totalQuantity += group.quantity;

    const sizeName = POSTER_SIZES[group.sizeId]?.name || group.sizeId;
    const materialName = POSTER_MATERIALS[group.material]?.name || (group.material === 'rigid_board' ? 'Rigid Board' : group.material);

    return {
      key: `${group.sizeId}_${group.material}`,
      sizeId: group.sizeId,
      material: group.material,
      sizeName,
      materialName,
      label: `${sizeName} · ${materialName}`,
      quantity: group.quantity,
      unitPrice,
      lineAmount,
    };
  });

  return {
    items,
    totalQuantity,
    subtotal,
    isEmpty: false,
  };
}

/**
 * Formats a numeric price into standard Indian Rupee string: e.g. 130 -> "₹130".
 */
export function formatPosterKitPrice(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

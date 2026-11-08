import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getSavedPosterKitLayout } from './posterKitStorage';
import { normalizePosterKitMaterial, getPosterKitUnitPrice } from '../utils/posterKitPricing';
import type { PlacedPoster, PosterSizeId, PosterOrientation, PosterMaterialId } from '../types/posterKit';
import type { CartItem } from '../context/CartContext';
import type { PosterKitLayoutRow } from '../types/database';

export const CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY = 'checkout_poster_kit_layout_id';

export type PosterKitLayoutStatus = 'active' | 'ordered' | 'expired';

export interface PosterKitLayoutItemPayload {
  id: string;
  sizeId: PosterSizeId;
  orientation: PosterOrientation;
  material: PosterMaterialId;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  label: string;
  artworkSource?: 'collection' | 'custom' | string;
  artworkProductId?: number | string;
  artworkTitle?: string;
  artworkUrl?: string;
  originalArtworkUrl?: string;
  customArtworkId?: string;
  customArtworkFileName?: string;
  mockupUrl?: string;
  unitPrice: number;
}

export interface PersistPosterKitLayoutInput {
  items: PosterKitLayoutItemPayload[];
  subtotal: number;
}

export type PersistPosterKitLayoutResult =
  | { success: true; layoutId: string; expiresAt: string; reused?: boolean; reason?: undefined; error?: undefined }
  | { success: false; reason?: string; error: string; code?: string; details?: unknown; layoutId?: undefined; expiresAt?: undefined; reused?: undefined };

/**
 * Validates a layout payload against both client-side and database-level schema requirements.
 */
export function validateLayoutPayload(input: PersistPosterKitLayoutInput): { isValid: boolean; error?: string } {
  if (!input || typeof input !== 'object') {
    return { isValid: false, error: 'Layout payload must be a non-null object' };
  }

  // 1. Validate subtotal: must be non-negative, finite number
  if (
    typeof input.subtotal !== 'number' ||
    !Number.isFinite(input.subtotal) ||
    Number.isNaN(input.subtotal) ||
    input.subtotal < 0
  ) {
    return { isValid: false, error: 'Subtotal must be a non-negative finite number' };
  }

  // 2. Validate items array
  if (!Array.isArray(input.items)) {
    return { isValid: false, error: 'Layout items must be a JSON array' };
  }

  if (input.items.length < 3) {
    return {
      isValid: false,
      error: `Poster Kit layout requires at least 3 items (received ${input.items.length})`,
    };
  }

  // 3. Deep validation of each item
  const validSizes: PosterSizeId[] = ['A6', 'A5', 'A4', 'A3'];
  const validOrientations: PosterOrientation[] = ['portrait', 'landscape'];
  const validMaterials: PosterMaterialId[] = ['matte', 'glossy', 'rigid_board'];

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    if (!item || typeof item !== 'object') {
      return { isValid: false, error: `Layout item at index ${i} must be a valid object` };
    }

    if (typeof item.id !== 'string' || !item.id.trim()) {
      return { isValid: false, error: `Layout item at index ${i} is missing a valid id` };
    }

    if (typeof item.label !== 'string' || !item.label.trim()) {
      return { isValid: false, error: `Layout item at index ${i} is missing a valid label` };
    }

    if (!validSizes.includes(item.sizeId)) {
      return { isValid: false, error: `Layout item at index ${i} has invalid sizeId '${item.sizeId}'` };
    }

    if (!validOrientations.includes(item.orientation)) {
      return { isValid: false, error: `Layout item at index ${i} has invalid orientation '${item.orientation}'` };
    }

    if (!validMaterials.includes(item.material)) {
      return { isValid: false, error: `Layout item at index ${i} has invalid material '${item.material}'` };
    }

    if (
      typeof item.xPercent !== 'number' ||
      !Number.isFinite(item.xPercent) ||
      typeof item.yPercent !== 'number' ||
      !Number.isFinite(item.yPercent) ||
      typeof item.widthPercent !== 'number' ||
      !Number.isFinite(item.widthPercent) ||
      typeof item.heightPercent !== 'number' ||
      !Number.isFinite(item.heightPercent)
    ) {
      return { isValid: false, error: `Layout item at index ${i} contains non-finite coordinates` };
    }

    if (
      item.xPercent < 0 ||
      item.yPercent < 0 ||
      item.widthPercent <= 0 ||
      item.heightPercent <= 0 ||
      item.xPercent > 100 ||
      item.yPercent > 100 ||
      item.widthPercent > 100 ||
      item.heightPercent > 100
    ) {
      return { isValid: false, error: `Layout item at index ${i} has out-of-bounds coordinates` };
    }
  }

  return { isValid: true };
}

/**
 * Calculates a strict 7-day TTL timestamp.
 */
export function calculate7DayTtl(): { createdAt: string; expiresAt: string } {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Persists a validated Poster Kit layout to the database using the secure server-side RPC.
 * Server verifies user identity via auth.uid() and enforces 7-day TTL and check constraints.
 */
export async function persistPosterKitLayout(
  input: PersistPosterKitLayoutInput
): Promise<PersistPosterKitLayoutResult> {
  const validation = validateLayoutPayload(input);
  if (!validation.isValid) {
    return {
      success: false,
      reason: 'validation_error',
      error: validation.error || 'Invalid layout payload',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      reason: 'supabase_not_configured',
      error: 'Supabase client is not configured with production credentials',
    };
  }

  try {
    const { data, error } = await supabase.rpc('register_poster_kit_layout' as any, {
      p_items: input.items,
      p_subtotal: Number(input.subtotal.toFixed(2)),
    });

    if (error) {
      console.warn('[PosterKitLayoutService] RPC register_poster_kit_layout failed:', error);
      return {
        success: false,
        reason: 'rpc_error',
        error: error.message || 'Database error while registering layout',
        code: error.code,
        details: error.details,
      };
    }

    const payload = (data as any) || {};
    const layoutId = payload.id || (typeof data === 'string' ? data : null);

    if (!layoutId) {
      return {
        success: false,
        reason: 'empty_response',
        error: 'Database returned an empty layout identifier',
      };
    }

    return {
      success: true,
      layoutId: String(layoutId),
      expiresAt: payload.expires_at || calculate7DayTtl().expiresAt,
    };
  } catch (err: any) {
    console.warn('[PosterKitLayoutService] Unexpected error during layout persistence:', err);
    return {
      success: false,
      reason: 'unexpected_error',
      error: err?.message || 'Unexpected exception during layout persistence',
    };
  }
}

/**
 * Safely fetches an existing layout row by UUID using the authenticated user's SELECT RLS policy.
 */
export async function getPosterKitLayoutById(layoutId: string): Promise<PosterKitLayoutRow | null> {
  if (!layoutId || typeof layoutId !== 'string') return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(layoutId.trim())) return null;

  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('poster_kit_layouts')
      .select('*')
      .eq('id', layoutId.trim())
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as PosterKitLayoutRow;
  } catch {
    return null;
  }
}

export interface ExpandedCartPosterUnit {
  cartItemId: number;
  unitIndex: number;
  size: string;
  material: string;
  price: number;
  customArtworkId?: string;
  productId?: number;
  artwork_url?: string;
  isPosterKit: boolean;
}

/**
 * Extracts and expands selected Poster Kit items from the cart into individual physical poster units.
 */
export function extractCartPosterUnits(cartItems: CartItem[]): ExpandedCartPosterUnit[] {
  if (!Array.isArray(cartItems)) return [];

  const units: ExpandedCartPosterUnit[] = [];

  for (const item of cartItems) {
    if (!item) continue;
    // Check if item is selected (default true if undefined) and belongs to Poster Kit
    const isSelected = item.selected !== false;
    const isPk = Boolean(item.isPosterKit || item.posterKit || item.origin === 'poster_kit');

    if (!isSelected || !isPk) continue;

    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? Math.floor(item.quantity) : 1;
    const size = (item.selected_size || item.size || 'A4').trim().toUpperCase();
    const material = (item.selected_material || item.material || 'matte').trim();

    for (let q = 0; q < qty; q++) {
      units.push({
        cartItemId: item.id,
        unitIndex: q,
        size,
        material,
        price: typeof item.unit_price === 'number' ? item.unit_price : item.price,
        customArtworkId: item.customArtworkId,
        productId: item.productId,
        artwork_url: item.artwork_url || item.image,
        isPosterKit: true,
      });
    }
  }

  return units;
}

/**
 * Checks whether a saved placed poster corresponds to a specific cart poster unit.
 */
export function isPosterMatchingCartUnit(poster: PlacedPoster, unit: ExpandedCartPosterUnit): boolean {
  // 1. Size match (case-insensitive canonical comparison)
  const posterSize = (poster.sizeId || '').trim().toUpperCase();
  const unitSize = unit.size.trim().toUpperCase();
  if (posterSize !== unitSize) return false;

  // 2. Material match (normalized canonical comparison)
  const posterMat = normalizePosterKitMaterial(poster.material);
  const unitMat = normalizePosterKitMaterial(unit.material);
  if (posterMat !== unitMat) return false;

  // 3. Artwork identity match
  const isPosterCustom =
    poster.artworkSource === 'custom' ||
    poster.artwork?.source === 'custom' ||
    Boolean(poster.customArtworkId) ||
    Boolean(poster.artwork?.customArtworkId);

  const isUnitCustom = Boolean(unit.customArtworkId) || (unit.artwork_url && unit.artwork_url.includes('/uploads/'));

  if (isPosterCustom) {
    if (!isUnitCustom) return false;
    const posterCustomId = poster.customArtworkId || poster.artwork?.customArtworkId;
    if (posterCustomId && unit.customArtworkId && posterCustomId === unit.customArtworkId) {
      return true;
    }
    const posterArtUrl = poster.artworkUrl || poster.originalArtworkUrl || poster.artwork?.url;
    if (posterArtUrl && unit.artwork_url && posterArtUrl === unit.artwork_url) {
      return true;
    }
    return false;
  } else {
    // Collection poster
    const posterProdId = poster.artworkProductId || poster.collectionProductId || poster.artwork?.productId;
    if (posterProdId && unit.productId && Number(posterProdId) === Number(unit.productId)) {
      return true;
    }
    const posterArtUrl = poster.artworkUrl || poster.artwork?.url;
    if (posterArtUrl && unit.artwork_url && posterArtUrl === unit.artwork_url) {
      return true;
    }
    return false;
  }
}

export interface OneToOneMatchResult {
  matched: boolean;
  reason?: string;
  error?: string;
  posterToUnitMap?: Map<number, number>;
}

/**
 * Solves exact one-to-one bipartite matching between saved layout posters and cart units.
 * Every poster must match exactly one unit, and every unit must be matched exactly once.
 * Rejects ambiguous or incomplete matches.
 */
export function matchLayoutToOneToOneCartUnits(
  posters: PlacedPoster[],
  units: ExpandedCartPosterUnit[]
): OneToOneMatchResult {
  if (posters.length !== units.length) {
    return {
      matched: false,
      reason: 'count_mismatch',
      error: `Layout has ${posters.length} posters, but bag contains ${units.length} Poster Kit items`,
    };
  }

  const n = posters.length;
  // Build adjacency matrix: can poster i match unit j?
  const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (isPosterMatchingCartUnit(posters[i], units[j])) {
        adj[i][j] = true;
      }
    }
  }

  // Maximum Bipartite Matching using Augmenting Paths (Hopcroft-Karp / Ford-Fulkerson style)
  const matchToUnit = new Map<number, number>(); // posterIndex -> unitIndex
  const unitToPoster = new Map<number, number>(); // unitIndex -> posterIndex

  function dfs(posterIdx: number, visited: Set<number>): boolean {
    for (let unitIdx = 0; unitIdx < n; unitIdx++) {
      if (adj[posterIdx][unitIdx] && !visited.has(unitIdx)) {
        visited.add(unitIdx);
        const currentOwner = unitToPoster.get(unitIdx);
        if (currentOwner === undefined || dfs(currentOwner, visited)) {
          matchToUnit.set(posterIdx, unitIdx);
          unitToPoster.set(unitIdx, posterIdx);
          return true;
        }
      }
    }
    return false;
  }

  for (let i = 0; i < n; i++) {
    const visited = new Set<number>();
    if (!dfs(i, visited)) {
      return {
        matched: false,
        reason: 'unmatched_posters',
        error: `Saved layout poster #${i + 1} (${posters[i].label || posters[i].sizeId}) could not be matched to an item in the bag`,
      };
    }
  }

  if (matchToUnit.size !== n || unitToPoster.size !== n) {
    return {
      matched: false,
      reason: 'ambiguous_matching',
      error: 'Saved layout posters do not correspond 1-to-1 with bag items',
    };
  }

  return {
    matched: true,
    posterToUnitMap: matchToUnit,
  };
}

/**
 * Checks sessionStorage for a previously persisted layout for this checkout session.
 * Reuses the layout if it exists, is active, has not expired, and matches the current cart units 1-to-1.
 */
export async function getReusableCachedLayout(
  units: ExpandedCartPosterUnit[]
): Promise<{ reusable: boolean; layoutId?: string }> {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { reusable: false };
  }

  const cachedId = window.sessionStorage.getItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY);
  if (!cachedId) {
    return { reusable: false };
  }

  const existingRow = await getPosterKitLayoutById(cachedId);
  if (!existingRow) {
    window.sessionStorage.removeItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY);
    return { reusable: false };
  }

  // Verify status is active
  if (existingRow.status !== 'active') {
    window.sessionStorage.removeItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY);
    return { reusable: false };
  }

  // Verify not expired
  const expiresAt = new Date(existingRow.expires_at).getTime();
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    window.sessionStorage.removeItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY);
    return { reusable: false };
  }

  // Verify item count
  if (existingRow.item_count !== units.length) {
    window.sessionStorage.removeItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY);
    return { reusable: false };
  }

  // Verify stored items match current cart units
  if (!Array.isArray(existingRow.items)) {
    window.sessionStorage.removeItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY);
    return { reusable: false };
  }

  // Verify one-to-one match between existingRow.items and units
  const storedPosters: PlacedPoster[] = existingRow.items.map((it: any) => ({
    id: it.id,
    sizeId: it.sizeId,
    orientation: it.orientation,
    material: it.material,
    xPercent: it.xPercent,
    yPercent: it.yPercent,
    widthPercent: it.widthPercent,
    heightPercent: it.heightPercent,
    label: it.label,
    artworkSource: it.artworkSource,
    artworkProductId: it.artworkProductId,
    customArtworkId: it.customArtworkId,
    artworkUrl: it.artworkUrl,
    originalArtworkUrl: it.originalArtworkUrl,
  }));

  const match = matchLayoutToOneToOneCartUnits(storedPosters, units);
  if (!match.matched) {
    window.sessionStorage.removeItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY);
    return { reusable: false };
  }

  return { reusable: true, layoutId: existingRow.id };
}

/**
 * Initiates Poster Kit layout persistence upon checkout initiation.
 * - Enforces guest safety (bypasses unauthenticated users cleanly).
 * - Extracts and validates cart items ($\ge 3$ items required).
 * - Checks sessionStorage for deduplication / safe reuse.
 * - Uses getSavedPosterKitLayout() as the authoritative source.
 * - Performs strict 1-to-1 matching (no silent guessed replacements on desynchronization).
 * - Invokes the secure server-side RPC and records checkout_poster_kit_layout_id in sessionStorage.
 */
export async function persistCheckoutPosterKitLayout(
  userId: string | undefined | null,
  cartItems: CartItem[]
): Promise<PersistPosterKitLayoutResult> {
  // 1. Check user authentication
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return {
      success: false,
      reason: 'unauthenticated',
      error: 'Layout persistence is scoped to authenticated users only',
    };
  }

  // 2. Extract selected Poster Kit units from cart
  const units = extractCartPosterUnits(cartItems);
  if (units.length < 3) {
    return {
      success: false,
      reason: 'insufficient_items',
      error: `Poster Kit layout requires at least 3 items in bag (found ${units.length})`,
    };
  }

  // 3. Deduplication check: verify if an existing active layout in sessionStorage can be safely reused
  const cached = await getReusableCachedLayout(units);
  if (cached.reusable && cached.layoutId) {
    return {
      success: true,
      layoutId: cached.layoutId,
      expiresAt: calculate7DayTtl().expiresAt,
      reused: true,
    };
  }

  // 4. Retrieve authoritative saved layout from localStorage
  const saved = getSavedPosterKitLayout();
  if (!saved || !Array.isArray(saved.posters) || saved.posters.length === 0) {
    return {
      success: false,
      reason: 'no_saved_layout_found',
      error: 'No saved Poster Kit wall layout found on this device',
    };
  }

  // 5. Strict 1-to-1 matching between saved layout posters and cart units
  const matchResult = matchLayoutToOneToOneCartUnits(saved.posters, units);
  if (!matchResult.matched) {
    console.warn('[PosterKitLayoutService] Layout desynchronization detected:', matchResult.error);
    return {
      success: false,
      reason: 'layout_cart_mismatch',
      error: matchResult.error || 'Saved wall layout does not match items currently in your bag',
    };
  }

  // 6. Format layout items payload preserving exact 2D visual layout coordinates and physical materials
  let calculatedSubtotal = 0;
  const itemsPayload: PosterKitLayoutItemPayload[] = saved.posters.map((poster) => {
    const sizeId = poster.sizeId;
    const material = normalizePosterKitMaterial(poster.material);
    const unitPrice = getPosterKitUnitPrice(sizeId, material);
    calculatedSubtotal += unitPrice;

    return {
      id: poster.id,
      sizeId,
      orientation: poster.orientation || 'portrait',
      material,
      xPercent: Number(poster.xPercent.toFixed(4)),
      yPercent: Number(poster.yPercent.toFixed(4)),
      widthPercent: Number(poster.widthPercent.toFixed(4)),
      heightPercent: Number(poster.heightPercent.toFixed(4)),
      label: poster.label || 'Poster',
      artworkSource: poster.artworkSource,
      artworkProductId: poster.artworkProductId || poster.collectionProductId,
      artworkTitle: poster.artworkTitle,
      artworkUrl: poster.artworkUrl,
      originalArtworkUrl: poster.originalArtworkUrl,
      customArtworkId: poster.customArtworkId,
      customArtworkFileName: poster.customArtworkFileName,
      mockupUrl: poster.mockupUrl,
      unitPrice,
    };
  });

  // 7. Persist via server-side RPC
  const result = await persistPosterKitLayout({
    items: itemsPayload,
    subtotal: calculatedSubtotal,
  });

  if (result.success && result.layoutId && typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem(CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY, result.layoutId);
  }

  return result;
}


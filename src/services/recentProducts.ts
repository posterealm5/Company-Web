import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Product } from '../types/database';
import { homeCache } from '../utils/homeCache';

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 8;

interface RecentViewItem {
  product_id: number;
  timestamp: number;
}

/**
 * Tracks a product view in localStorage.
 * Moves the product to the front if it already exists, and caps the list at 8.
 */
export function trackProductView(productId: number): void {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    let items: RecentViewItem[] = [];

    if (rawData) {
      items = JSON.parse(rawData);
    }

    // Filter out existing duplicate
    items = items.filter(item => item.product_id !== productId);

    // Add new view to the front
    items.unshift({
      product_id: productId,
      timestamp: Date.now()
    });

    // Limit to maximum 8 items
    if (items.length > MAX_ITEMS) {
      items = items.slice(0, MAX_ITEMS);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Error tracking product view in localStorage:', error);
  }
}

/**
 * Fetches product details from Supabase for all recently viewed product IDs.
 * Preserves the chronological order stored in localStorage and filters out inactive products.
 */
export async function getRecentlyViewedProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return [];

    const items: RecentViewItem[] = JSON.parse(rawData);
    if (items.length === 0) return [];

    const productIds = items.map(item => item.product_id);
    const cacheKey = `recent_products_${productIds.join(',')}`;
    const cached = homeCache.get<Product[]>(cacheKey, 60 * 1000); // 1 minute TTL is enough since it's highly dynamic
    if (cached) return cached;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching recently viewed products:', error.message);
      throw error;
    }

    if (!data) return [];

    // Sort products based on their order in the localStorage IDs array to preserve chronological viewing order
    const orderedProducts = productIds
      .map(id => data.find(p => p.id === id))
      .filter((product): product is Product => !!product);

    homeCache.set(cacheKey, orderedProducts);
    return orderedProducts;
  } catch (error) {
    console.error('Error getting recently viewed products:', error);
    return [];
  }
}


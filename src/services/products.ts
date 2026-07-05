import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Product, ProductInsert } from '../types/database';

/**
 * Products Service
 * Handles all product-related database operations.
 * Falls back gracefully when Supabase is not configured.
 */

/** Fetch all active products, optionally filtered by genre */
export async function getProducts(genre?: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (genre && genre !== 'All') {
    query = query.eq('genre', genre);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products:', error.message);
    return [];
  }

  return data || [];
}

/** Fetch a single product by ID */
export async function getProductById(id: number): Promise<Product | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching product:', error.message);
    return null;
  }

  return data;
}

/** Create a new product (admin use) */
export async function createProduct(product: ProductInsert): Promise<Product | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();

  if (error) {
    console.error('Error creating product:', error.message);
    return null;
  }

  return data;
}

/** Update an existing product (admin use) */
export async function updateProduct(id: number, updates: Partial<ProductInsert>): Promise<Product | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error.message);
    return null;
  }

  return data;
}

/** Soft-delete a product by setting is_active to false */
export async function deleteProduct(id: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error.message);
    return false;
  }

  return true;
}

/** Search products by name */
export async function searchProducts(query: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .order('name');

  if (error) {
    console.error('Error searching products:', error.message);
    return [];
  }

  return data || [];
}

/** Fetch a single product by slug */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) return null;

  let { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching product by slug:', error.message);
    return null;
  }

  return data;
}

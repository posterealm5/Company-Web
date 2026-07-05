import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Review, ReviewInsert } from '../types/database';
import { homeCache } from '../utils/homeCache';

/**
 * Fetches reviews sorted by display_order ascending.
 */
export async function getReviews(onlyActive = false): Promise<Review[]> {
  if (onlyActive) {
    const cached = homeCache.get<Review[]>('reviews_active');
    if (cached) return cached;
  }

  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, returning empty reviews.');
    return [];
  }

  let query = supabase
    .from('reviews')
    .select('*')
    .order('display_order', { ascending: true });

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching reviews:', error.message);
    throw error;
  }

  const result = data || [];
  if (onlyActive) {
    homeCache.set('reviews_active', result);
  }

  return result;
}

/**
 * Creates a new review.
 */
export async function createReview(review: ReviewInsert): Promise<Review> {
  homeCache.clear('reviews_active');
  const { data, error } = await supabase
    .from('reviews')
    .insert([review])
    .select()
    .single();

  if (error) {
    console.error('Error creating review:', error.message);
    throw error;
  }

  return data;
}

/**
 * Updates an existing review.
 */
export async function updateReview(id: string, review: Partial<Review>): Promise<Review> {
  homeCache.clear('reviews_active');
  const { data, error } = await supabase
    .from('reviews')
    .update(review)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating review:', error.message);
    throw error;
  }

  return data;
}

/**
 * Deletes a review.
 */
export async function deleteReview(id: string): Promise<void> {
  homeCache.clear('reviews_active');
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting review:', error.message);
    throw error;
  }
}

/**
 * Updates the display orders of multiple reviews in parallel.
 */
export async function reorderReviews(updates: { id: string; display_order: number }[]): Promise<void> {
  homeCache.clear('reviews_active');
  const promises = updates.map(update =>
    supabase
      .from('reviews')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  for (const res of results) {
    if (res.error) {
      console.error('Error in reordering reviews:', res.error.message);
      throw res.error;
    }
  }
}


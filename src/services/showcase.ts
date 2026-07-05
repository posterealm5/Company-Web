import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ShowcaseEntry, ShowcaseEntryInsert } from '../types/database';
import { homeCache } from '../utils/homeCache';

/**
 * Fetches showcase entries.
 * Sorted by: featured desc, display_order asc, created_at desc
 */
export async function getShowcaseEntries(onlyActive = false): Promise<ShowcaseEntry[]> {
  if (onlyActive) {
    const cached = homeCache.get<ShowcaseEntry[]>('showcase_active');
    if (cached) return cached;
  }

  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, returning empty showcase entries.');
    return [];
  }

  let query = supabase
    .from('wall_showcase')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching showcase entries:', error.message);
    throw error;
  }

  const result = data || [];
  if (onlyActive) {
    homeCache.set('showcase_active', result);
  }

  return result;
}

/**
 * Creates a new showcase entry.
 */
export async function createShowcaseEntry(entry: ShowcaseEntryInsert): Promise<ShowcaseEntry> {
  homeCache.clear('showcase_active');
  const { data, error } = await supabase
    .from('wall_showcase')
    .insert([entry])
    .select()
    .single();

  if (error) {
    console.error('Error creating showcase entry:', error.message);
    throw error;
  }

  return data;
}

/**
 * Updates an existing showcase entry.
 */
export async function updateShowcaseEntry(id: string, entry: Partial<ShowcaseEntry>): Promise<ShowcaseEntry> {
  homeCache.clear('showcase_active');
  const { data, error } = await supabase
    .from('wall_showcase')
    .update(entry)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating showcase entry:', error.message);
    throw error;
  }

  return data;
}

/**
 * Deletes a showcase entry.
 */
export async function deleteShowcaseEntry(id: string): Promise<void> {
  homeCache.clear('showcase_active');
  const { error } = await supabase
    .from('wall_showcase')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting showcase entry:', error.message);
    throw error;
  }
}

/**
 * Updates the display orders of multiple showcase entries in parallel.
 */
export async function reorderShowcaseEntries(updates: { id: string; display_order: number }[]): Promise<void> {
  homeCache.clear('showcase_active');
  const promises = updates.map(update =>
    supabase
      .from('wall_showcase')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  for (const res of results) {
    if (res.error) {
      console.error('Error in reordering showcase entries:', res.error.message);
      throw res.error;
    }
  }
}


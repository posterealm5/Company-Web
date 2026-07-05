import { supabase } from '../lib/supabase';
import { Offer, OfferInsert } from '../types/database';

/**
 * Fetches all offers or only active offers ordered by display_order.
 */
export async function getOffers(onlyActive: boolean = false): Promise<Offer[]> {
  const now = new Date().toISOString();
  let query = supabase.from('offers').select('*');

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching offers:', error.message);
    throw error;
  }

  const offers = data || [];

  if (onlyActive) {
    // Filter active date bounds on JS side to ensure correctness
    return offers.filter(offer => {
      if (offer.start_date && new Date(offer.start_date) > new Date(now)) {
        return false;
      }
      if (offer.end_date && new Date(offer.end_date) < new Date(now)) {
        return false;
      }
      return true;
    });
  }

  return offers;
}

/**
 * Creates a new promotional offer.
 */
export async function createOffer(offer: OfferInsert): Promise<Offer> {
  const { data, error } = await supabase
    .from('offers')
    .insert([offer])
    .select()
    .single();

  if (error) {
    console.error('Error creating offer:', error.message);
    throw error;
  }

  return data;
}

/**
 * Updates an existing offer.
 */
export async function updateOffer(id: string, offer: Partial<Offer>): Promise<Offer> {
  const { data, error } = await supabase
    .from('offers')
    .update(offer)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating offer:', error.message);
    throw error;
  }

  return data;
}

/**
 * Deletes an offer.
 */
export async function deleteOffer(id: string): Promise<void> {
  const { error } = await supabase
    .from('offers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting offer:', error.message);
    throw error;
  }
}

/**
 * Updates the display orders of multiple offers in parallel.
 */
export async function reorderOffers(updates: { id: string; display_order: number }[]): Promise<void> {
  const promises = updates.map(update => 
    supabase
      .from('offers')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  for (const res of results) {
    if (res.error) {
      console.error('Error in reordering offers:', res.error.message);
      throw res.error;
    }
  }
}

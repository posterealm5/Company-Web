import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Address, AddressInsert, AddressUpdate } from '../types/database';

/**
 * Address Service
 * Handles database operations for user delivery addresses.
 */

/** Get all addresses for a user */
export async function getAddresses(userId: string): Promise<Address[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching addresses:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching addresses:', err);
    return [];
  }
}

/** Get the default address for a user */
export async function getDefaultAddress(userId: string): Promise<Address | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching default address:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception fetching default address:', err);
    return null;
  }
}

/** Add a new address */
export async function addAddress(address: AddressInsert): Promise<Address | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('addresses')
      .insert(address)
      .select()
      .single();

    if (error) {
      console.error('Error inserting address:', error.message);
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    console.error('Exception inserting address:', err);
    throw err;
  }
}

/** Update an existing address */
export async function updateAddress(id: string, updates: AddressUpdate): Promise<Address | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('addresses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating address:', error.message);
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    console.error('Exception updating address:', err);
    throw err;
  }
}

/** Delete an address */
export async function deleteAddress(id: string, userId: string, wasDefault: boolean): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting address:', error.message);
      throw new Error(error.message);
    }

    // If the deleted address was the default one, automatically reassign default flag to another address
    if (wasDefault) {
      const remaining = await getAddresses(userId);
      if (remaining.length > 0) {
        // Mark the first remaining address as default
        await updateAddress(remaining[0].id, { is_default: true });
      }
    }

    return true;
  } catch (err: any) {
    console.error('Exception deleting address:', err);
    throw err;
  }
}

/** Set an address as default */
export async function setDefaultAddress(id: string, userId: string): Promise<Address | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    // Database trigger 'on_address_default_changed' handles clearing other default flags
    const { data, error } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error setting default address:', error.message);
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    console.error('Exception setting default address:', err);
    throw err;
  }
}

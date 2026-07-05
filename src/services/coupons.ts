import { supabase } from '../lib/supabase';
import { CouponRow, CouponInsert } from '../types/database';

export interface CouponWithUsers extends CouponRow {
  eligible_users?: { user_id: string; full_name?: string; email?: string }[];
}

/**
 * Fetches all coupons along with their eligible users.
 */
export async function getCoupons(): Promise<CouponWithUsers[]> {
  const { data: coupons, error } = await (supabase
    .from('coupons')
    .select('*, coupon_users(user_id)')
    .order('created_at', { ascending: false }) as any);

  if (error) {
    console.error('Error fetching coupons:', error.message);
    throw error;
  }

  const results: CouponWithUsers[] = [];
  for (const coupon of (coupons || [])) {
    const userIds = coupon.coupon_users?.map((cu: any) => cu.user_id) || [];
    let eligible_users: any[] = [];
    if (userIds.length > 0) {
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      if (!profError && profiles) {
        eligible_users = profiles.map(p => ({
          user_id: p.id,
          full_name: p.full_name,
          email: p.email
        }));
      }
    }
    results.push({
      ...coupon,
      eligible_users
    });
  }

  return results;
}

/**
 * Creates a new coupon and its user-specific associations.
 */
export async function createCoupon(coupon: CouponInsert, eligibleUserIds: string[] = []): Promise<CouponRow> {
  const { data: created, error } = await supabase
    .from('coupons')
    .insert([coupon])
    .select()
    .single();

  if (error) {
    console.error('Error creating coupon:', error.message);
    throw error;
  }

  if (eligibleUserIds.length > 0) {
    const relationData = eligibleUserIds.map(userId => ({
      coupon_id: created.id,
      user_id: userId
    }));
    const { error: relError } = await supabase
      .from('coupon_users')
      .insert(relationData);
    if (relError) {
      console.error('Error creating coupon user associations:', relError.message);
      throw relError;
    }
  }

  return created;
}

/**
 * Updates a coupon and its user-specific associations.
 */
export async function updateCoupon(id: number, coupon: Partial<CouponInsert>, eligibleUserIds?: string[]): Promise<CouponRow> {
  const { data: updated, error } = await supabase
    .from('coupons')
    .update(coupon)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating coupon:', error.message);
    throw error;
  }

  if (eligibleUserIds !== undefined) {
    // Delete existing associations
    const { error: delError } = await supabase
      .from('coupon_users')
      .delete()
      .eq('coupon_id', id);
    if (delError) {
      console.error('Error deleting old coupon associations:', delError.message);
      throw delError;
    }

    if (eligibleUserIds.length > 0) {
      const relationData = eligibleUserIds.map(userId => ({
        coupon_id: id,
        user_id: userId
      }));
      const { error: relError } = await supabase
        .from('coupon_users')
        .insert(relationData);
      if (relError) {
        console.error('Error creating new coupon associations:', relError.message);
        throw relError;
      }
    }
  }

  return updated;
}

/**
 * Deletes a coupon from the database.
 */
export async function deleteCoupon(id: number): Promise<void> {
  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting coupon:', error.message);
    throw error;
  }
}

/**
 * Fetches a single coupon by its code if it is active.
 */
export async function getCouponByCode(code: string): Promise<CouponWithUsers | null> {
  const { data: coupon, error } = await (supabase
    .from('coupons')
    .select('*, coupon_users(user_id)')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .maybeSingle() as any);

  if (error) {
    console.error('Error fetching coupon by code:', error.message);
    return null;
  }

  if (!coupon) return null;

  const userIds = coupon.coupon_users?.map((cu: any) => cu.user_id) || [];
  let eligible_users: any[] = [];
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    if (profiles) {
      eligible_users = profiles.map(p => ({
        user_id: p.id,
        full_name: p.full_name,
        email: p.email
      }));
    }
  }

  return {
    ...coupon,
    eligible_users
  };
}

/**
 * Safely increments the current redemptions count for a coupon.
 */
export async function incrementRedemptionCount(code: string): Promise<void> {
  const { data: coupon } = await supabase
    .from('coupons')
    .select('id, current_redemptions')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();

  if (coupon) {
    const { error } = await supabase
      .from('coupons')
      .update({ current_redemptions: coupon.current_redemptions + 1 })
      .eq('id', coupon.id);
    if (error) {
      console.error('Error incrementing redemption count:', error.message);
    }
  }
}

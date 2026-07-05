import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Order, OrderInsert, OrderItem } from '../types/database';

/**
 * Orders Service
 * Handles all order-related database operations.
 */

/** Create a new order */
export async function createOrder(order: OrderInsert): Promise<Order | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (error) {
    console.error('Error creating order:', error.message);
    return null;
  }

  return data;
}

/** Fetch orders for a specific user */
export async function getUserOrders(userId: string): Promise<Order[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error.message);
    return [];
  }

  return data || [];
}

/** Fetch a single order by ID */
export async function getOrderById(id: number): Promise<Order | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching order:', error.message);
    return null;
  }

  return data;
}

/** Update order status */
export async function updateOrderStatus(
  id: number,
  status: Order['status']
): Promise<Order | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating order status:', error.message);
    return null;
  }

  return data;
}

/** Cancel order by customer with backend status validation */
export async function cancelOrderByCustomer(
  id: number
): Promise<{ success: boolean; error?: string; data?: Order }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database is not configured.' };
  }

  // 1. Fetch current order to validate status
  const currentOrder = await getOrderById(id);
  if (!currentOrder) {
    return { success: false, error: 'Order not found.' };
  }

  // Backend validation: prevent cancellation if status is not pending or confirmed
  const allowedStatuses: Order['status'][] = ['pending', 'confirmed'];
  if (!allowedStatuses.includes(currentOrder.status)) {
    return { 
      success: false, 
      error: `Order cannot be cancelled. Current status is '${currentOrder.status}'.` 
    };
  }

  // Get current user to retrieve their UUID for the cancelled_by column
  const { data: { user } } = await supabase.auth.getUser();
  const cancelled_by = user?.id || currentOrder.user_id;

  const payload = { 
    status: 'cancelled' as const, 
    cancelled_by,
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString() 
  };

  
  
  
  
  
  

  // 2. Perform status update to 'cancelled' with cancelled_by and cancelled_at fields
  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error cancelling order:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export function buildOrderFromCart(
  cartItems: OrderItem[],
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
  },
  subtotal: number,
  shippingCharge: number,
  total: number,
  userId?: string,
  paymentInfo?: {
    method: string;
    id: string;
    status: string;
  },
  status?: Order['status'],
  couponCode?: string | null,
  discountAmount?: number | null
): OrderInsert {
  return {
    user_id: userId || null,
    items: cartItems,
    subtotal,
    shipping_charge: shippingCharge,
    total,
    status: status || 'pending',
    customer_name: customerInfo.name,
    customer_email: customerInfo.email,
    customer_phone: customerInfo.phone,
    shipping_address: customerInfo.address,
    payment_method: paymentInfo?.method || null,
    payment_id: paymentInfo?.id || null,
    payment_status: paymentInfo?.status || null,
    coupon_code: couponCode || null,
    discount_amount: discountAmount || null,
  };
}

/** 
 * Backend Razorpay Order Creation
 * Invokes Supabase Edge Function to create order securely
 */
export async function createRazorpayOrder(amount: number, receipt: string) {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.functions.invoke('razorpay-order', {
    body: { amount, receipt }
  });

  if (error) {
    console.error('Error invoking razorpay-order:', error);
    return null;
  }

  return data;
}

/** 
 * Backend Razorpay Payment Verification
 * Invokes Supabase Edge Function to verify signature and update status
 */
export async function verifyRazorpayPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  order_id: number;
}) {
  if (!isSupabaseConfigured()) return null;

  const response = await supabase.functions.invoke('razorpay-verify', {
    body: payload
  });

  

  if (response.error) {
    console.error("VERIFY FUNCTION ERROR:", response.error);
  }

  

  return response.data || { success: false, error: response.error?.message };
}

/** 
 * Counts how many valid (non-cancelled) orders a user has placed using a specific coupon code.
 */
export async function getUserCouponRedemptionCount(userId: string, couponCode: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const orders = await getUserOrders(userId);
  const targetCode = couponCode.toUpperCase().trim();

  let count = 0;
  for (const order of orders) {
    if (order.status === 'cancelled') continue;

    // Check if the coupon code was applied in this order (by checking item.couponCode inside the items array)
    const hasCoupon = order.items?.some(
      (item: any) => item && item.couponCode && item.couponCode.toUpperCase().trim() === targetCode
    );

    if (hasCoupon) {
      count++;
    }
  }

  return count;
}

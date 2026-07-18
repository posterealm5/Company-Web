import type { Order } from '../types/database';

/**
 * Determines if an order should be included in the revenue calculation.
 * 
 * Business Rules:
 * 1. For ONLINE payment method: include ONLY if payment status is 'Paid' (case-insensitive).
 * 2. For COD payment method: include if order status is NOT 'cancelled' (case-insensitive).
 */
export function isOrderValidForRevenue(order: {
  payment_method: string | null;
  payment_status: string | null;
  status: string;
}): boolean {
  const method = (order.payment_method || '').toUpperCase();
  const payStatus = (order.payment_status || '').toLowerCase();
  const orderStatus = (order.status || '').toLowerCase();

  // Cancelled orders are always excluded
  if (orderStatus === 'cancelled') {
    return false;
  }

  // ONLINE payment checks (covers 'ONLINE', 'ONLINE PAYMENT', etc.)
  if (method.includes('ONLINE')) {
    return payStatus === 'paid';
  }

  // COD payment checks (covers 'COD', etc.)
  if (method.includes('COD')) {
    return true;
  }

  return false;
}

/**
 * Calculates the total revenue from a list of orders.
 */
export function calculateTotalRevenue(orders: Array<{
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  status: string;
}>): number {
  return orders.reduce((sum, order) => {
    if (isOrderValidForRevenue(order)) {
      return sum + (order.total || 0);
    }
    return sum;
  }, 0);
}

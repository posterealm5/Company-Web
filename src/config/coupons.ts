import { CartItem } from '../context/CartContext';
import { getPosterBasePrice, getMaterialPremium, calculateSinglePosterPrice, calculateCustomPosterPrice } from './pricing';

export interface Coupon {
  id?: number; // Optional database ID
  code: string;
  name: string;
  type: 'percentage' | 'buy_x_get_y';
  value?: number; // For percentage amount
  buyQty?: number; // For buy_x_get_y
  freeQty?: number; // For buy_x_get_y
  minSubtotal?: number; // Optional minimum subtotal required
  expiryDate?: string; // ISO date string (YYYY-MM-DD)
  description: string;

  // New database fields (optional for backward compatibility)
  start_date?: string | null;
  end_date?: string | null;
  max_redemptions?: number | null;
  max_redemptions_per_user?: number | null;
  current_redemptions?: number | null;
  eligible_users?: { user_id: string; full_name?: string; email?: string }[];
  is_active?: boolean;
}

export function getCartItemUnitPrice(item: CartItem): number {
  const selectedSize = item.selected_size || item.size;
  const selectedMaterial = item.selected_material || item.material;

  const isCustom = (selectedSize || '').toLowerCase().includes('x') || selectedSize === 'Custom';
  if (isCustom && item.width && item.height) {
    return calculateCustomPosterPrice(item.width, item.height, selectedMaterial);
  } else {
    return calculateSinglePosterPrice(selectedSize, selectedMaterial);
  }
}

export const COUPONS: Coupon[] = [
  {
    code: 'B5G2F',
    name: 'Buy 5 Get 2 Free',
    type: 'buy_x_get_y',
    buyQty: 5,
    freeQty: 2,
    description: 'Select 2 Free Designs'
  },
  {
    code: 'B6G3F',
    name: 'Buy 6 Get 3 Free',
    type: 'buy_x_get_y',
    buyQty: 6,
    freeQty: 3,
    description: 'Select 3 Free Designs'
  },
  {
    code: 'B7G5F',
    name: 'Buy 7 Get 5 Free',
    type: 'buy_x_get_y',
    buyQty: 7,
    freeQty: 5,
    description: 'Select 5 Free Designs'
  },
  {
    code: 'SAVE10',
    name: '10% Discount',
    type: 'percentage',
    value: 10,
    description: 'Get 10% off on your entire purchase'
  },
  {
    code: 'COMBO3',
    name: 'Buy 2 Get 1 Free',
    type: 'buy_x_get_y',
    buyQty: 2,
    freeQty: 1,
    description: 'Select 1 Free Design'
  },
  {
    code: 'EXPIRED20',
    name: 'Expired Promo',
    type: 'percentage',
    value: 20,
    expiryDate: '2025-01-01',
    description: 'An expired promo for testing'
  }
];

/**
 * Validates a coupon against the current selected cart items.
 * Returns { isValid: boolean; error?: string }
 */
export function validateCoupon(
  coupon: Coupon,
  selectedItems: CartItem[],
  currentUserId?: string,
  userRedemptionCount?: number
): { isValid: boolean; error?: string } {
  const now = new Date();

  // 1. Coupon Exists is handled before calling this
  // 2. Coupon is Active
  if (coupon.is_active === false) {
    return { isValid: false, error: 'This coupon is not active yet.' };
  }

  // 3. Validate Start Date
  if (coupon.start_date) {
    const startDate = new Date(coupon.start_date);
    if (now < startDate) {
      return { isValid: false, error: 'This coupon is not active yet.' };
    }
  }

  // 4. Validate End Date
  if (coupon.end_date) {
    const endDate = new Date(coupon.end_date);
    if (now > endDate) {
      return { isValid: false, error: 'This coupon has expired.' };
    }
  }

  // Backward compatibility: expiryDate
  if (coupon.expiryDate) {
    const today = new Date();
    const expiry = new Date(coupon.expiryDate);
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    if (today > expiry) {
      return { isValid: false, error: 'This coupon has expired.' };
    }
  }

  // 5. Validate Maximum Redemptions
  if (coupon.max_redemptions !== undefined && coupon.max_redemptions !== null) {
    const current = coupon.current_redemptions || 0;
    if (current >= coupon.max_redemptions) {
      return { isValid: false, error: 'This coupon has reached its usage limit.' };
    }
  }

  // 6. Validate User Eligibility
  if (coupon.eligible_users && coupon.eligible_users.length > 0) {
    if (!currentUserId) {
      return { isValid: false, error: 'This coupon is not available for your account.' };
    }
    const isEligible = coupon.eligible_users.some(u => u.user_id === currentUserId);
    if (!isEligible) {
      return { isValid: false, error: 'This coupon is not available for your account.' };
    }
  }

  // If no items are selected, coupon cannot be applied
  if (selectedItems.length === 0) {
    return { isValid: false, error: 'Please select items in your bag to qualify' };
  }

  // Get paid items (non-free)
  const paidItems = selectedItems.filter(item => !item.isFreeItem);
  const paidCount = paidItems.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = paidItems.reduce((acc, item) => acc + (item.line_total || (item.price * item.quantity)), 0);

  // 7. Check minimum subtotal
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return { 
      isValid: false, 
      error: `Minimum subtotal of ₹${coupon.minSubtotal} required. Add ₹${coupon.minSubtotal - subtotal} more.` 
    };
  }

  // 8. Check minimum quantity (only for buy_x_get_y now)
  if (coupon.type === 'buy_x_get_y') {
    const buyQty = coupon.buyQty || 0;
    if (paidCount < buyQty) {
      return { 
        isValid: false, 
        error: `Buy ${buyQty} posters to activate this coupon. Currently you have ${paidCount} selected.` 
      };
    }
  }

  // 9. Validate per-user usage limit
  if (coupon.max_redemptions_per_user !== undefined && coupon.max_redemptions_per_user !== null) {
    if (currentUserId && userRedemptionCount !== undefined && userRedemptionCount >= coupon.max_redemptions_per_user) {
      return {
        isValid: false,
        error: 'This coupon has already been used the maximum number of times for your account.'
      };
    }
  }

  return { isValid: true };
}

/**
 * Calculates the discount amount for a validated coupon.
 */
export function calculateCouponDiscount(
  coupon: Coupon,
  selectedItems: CartItem[],
  currentUserId?: string,
  userRedemptionCount?: number
): number {
  const validation = validateCoupon(coupon, selectedItems, currentUserId, userRedemptionCount);
  if (!validation.isValid) {
    return 0;
  }

  const paidItems = selectedItems.filter(item => !item.isFreeItem);
  const subtotal = paidItems.reduce((acc, item) => acc + (item.line_total || (item.price * item.quantity)), 0);

  if (coupon.type === 'percentage') {
    const pct = coupon.value || 0;
    return Math.round(subtotal * (pct / 100));
  }

  if (coupon.type === 'buy_x_get_y') {
    const freeItems = selectedItems.filter(item => item.isFreeItem);
    return freeItems.reduce((acc, item) => acc + (item.line_total || (item.price * item.quantity)), 0);
  }

  return 0;
}

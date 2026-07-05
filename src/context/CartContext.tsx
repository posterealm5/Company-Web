import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { recalculateCartPrices, getMajoritySizeAndMaterial, calculateSinglePosterPrice } from '../config/pricing';
import { Coupon, COUPONS, validateCoupon, calculateCouponDiscount } from '../config/coupons';
import { getCouponByCode } from '../services/coupons';
import { getUserCouponRedemptionCount } from '../services/orders';

export interface CartItem {
  id: number;
  name: string;
  size: string;
  material: string;
  price: number;
  quantity: number;
  image: string;
  selected?: boolean;

  // Central pricing schema fields
  selected_size?: string;
  selected_material?: string;
  unit_price?: number;
  line_total?: number;

  // Custom poster tracking fields
  width?: number;
  height?: number;
  area?: number;
  custom_price?: number;

  // Coupon tracking fields
  isFreeItem?: boolean;
  couponCode?: string;
  slotIndex?: number;
  productId?: number;
  originalId?: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, delta: number) => void;
  toggleSelection: (id: number) => void;
  cartCount: number;
  showNotification: boolean;
  notificationMessage: string;
  triggerNotification: (message: string) => void;
  clearCart: () => void;
  updateItem: (id: number, updates: Partial<CartItem>) => void;
  
  // Coupon system fields
  appliedCouponCode: string | null;
  appliedCoupon: Coupon | null;
  couponDiscount: number;
  couponValidationError: string | undefined;
  applyCoupon: (code: string) => Promise<{ success: boolean; error?: string }>;
  removeCoupon: () => void;

  // Free poster slot management
  selectFreePosterDesign: (slotIndex: number, product: any) => void;
  removeFreePosterDesign: (slotIndex: number) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Track the user ID for which the cart is currently loaded
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>(user?.id);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const key = user?.id ? `cart_${user.id}` : 'cart_guest';
    const savedCart = localStorage.getItem(key);
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const { showNotification, notificationMessage, triggerNotification: globalTrigger } = useNotification();
  
  // Coupon System State
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(() => {
    const key = user?.id ? `appliedCouponCode_${user.id}` : 'appliedCouponCode_guest';
    return localStorage.getItem(key);
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [userRedemptionCount, setUserRedemptionCount] = useState<number>(0);

  const syncCartState = (items: CartItem[], couponCode: string | null, activeCoupon?: Coupon | null): CartItem[] => {
    // 1. Separate slot free items
    const slotFreeItems = items.filter(item => item.slotIndex !== undefined);

    // 2. Merge previously split regular items back into their single representation
    const regularItemsMerged: CartItem[] = [];
    items.forEach(item => {
      if (item.slotIndex !== undefined) return;
      const targetId = item.originalId || item.id;
      const existing = regularItemsMerged.find(r => r.id === targetId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        // Clone the item and make sure it has its original ID and clean properties
        regularItemsMerged.push({
          ...item,
          id: targetId,
          isFreeItem: false,
          originalId: undefined
        });
      }
    });

    // 3. Recalculate prices for all merged regular items
    const recalculatedRegular = recalculateCartPrices(regularItemsMerged);

    // Ensure all recalculated regular items start without free/coupon flags
    recalculatedRegular.forEach(item => {
      item.isFreeItem = false;
      delete item.couponCode;
    });

    // 4. Handle Buy X Get Y coupons
    const coupon = activeCoupon || (couponCode 
      ? COUPONS.find(c => c.code.toUpperCase() === couponCode.toUpperCase()) || null
      : null);

    let finalRegularItems = [...recalculatedRegular];
    let updatedFreeItems: CartItem[] = [];

    if (couponCode && coupon?.type === 'buy_x_get_y') {
      const buyQty = coupon.buyQty || 1;
      const freeQty = coupon.freeQty || 0;

      const selectedRegular = recalculatedRegular.filter(item => item.selected);
      const totalSelectedPosterQuantity = selectedRegular.reduce((sum, item) => sum + item.quantity, 0);

      // automaticFreeCount = min(max(totalSelectedPosterQuantity - X, 0), Y)
      const automaticFreeCount = Math.min(
        Math.max(totalSelectedPosterQuantity - buyQty, 0),
        freeQty
      );
      
      // remainingFreeSlots = Y - automaticFreeCount
      const remainingFreeSlots = freeQty - automaticFreeCount;

      // Find majority size and material of paid items to inherit
      const { size: majSize, material: majMat } = getMajoritySizeAndMaterial(selectedRegular);

      if (automaticFreeCount > 0) {
        // Prioritize which items become free based on majority size & material
        const getPriority = (item: CartItem) => {
          const matchesSize = item.size === majSize;
          const matchesMaterial = item.material === majMat;
          if (matchesSize && matchesMaterial) return 1;
          if (matchesSize) return 2;
          if (matchesMaterial) return 3;
          return 4;
        };

        const units: { item: CartItem; priority: number }[] = [];
        selectedRegular.forEach(item => {
          for (let i = 0; i < item.quantity; i++) {
            units.push({ item, priority: getPriority(item) });
          }
        });

        // Sort units by priority ascending
        units.sort((a, b) => a.priority - b.priority);

        // Slice first automaticFreeCount units
        const freeCountsMap: Record<number, number> = {};
        const chosenUnits = units.slice(0, automaticFreeCount);
        chosenUnits.forEach(u => {
          freeCountsMap[u.item.id] = (freeCountsMap[u.item.id] || 0) + 1;
        });

        // Reconstruct regular items with splits
        const splitRegularItems: CartItem[] = [];
        recalculatedRegular.forEach(item => {
          const freeQty = freeCountsMap[item.id] || 0;
          if (freeQty > 0) {
            const paidQty = item.quantity - freeQty;
            if (paidQty > 0) {
              splitRegularItems.push({
                ...item,
                quantity: paidQty,
                line_total: item.unit_price! * paidQty
              });
            }
            splitRegularItems.push({
              ...item,
              id: item.id + 1000000,
              originalId: item.id,
              quantity: freeQty,
              price: item.price,
              unit_price: item.unit_price,
              line_total: 0,
              isFreeItem: true,
              couponCode: couponCode || undefined
            });
          } else {
            splitRegularItems.push(item);
          }
        });

        finalRegularItems = splitRegularItems;
      }

      if (remainingFreeSlots > 0) {
        updatedFreeItems = slotFreeItems
          .filter(item => item.slotIndex !== undefined && item.slotIndex < remainingFreeSlots)
          .map(item => {
            const unitPrice = calculateSinglePosterPrice(majSize, majMat);
            return {
              ...item,
              size: majSize,
              material: majMat,
              price: unitPrice,
              unit_price: unitPrice,
              line_total: unitPrice,
              isFreeItem: true,
              couponCode: couponCode || undefined
            };
          });
      }
    }

    return [...finalRegularItems, ...updatedFreeItems];
  };

  // Synchronize cart and coupon state when user session changes (login, logout, account switch)
  useEffect(() => {
    const prevUserId = loadedUserId;
    const nextUserId = user?.id;

    if (prevUserId === nextUserId) {
      return;
    }

    const guestCartKey = 'cart_guest';
    const guestCouponKey = 'appliedCouponCode_guest';
    const nextCartKey = nextUserId ? `cart_${nextUserId}` : guestCartKey;
    const nextCouponKey = nextUserId ? `appliedCouponCode_${nextUserId}` : guestCouponKey;

    let nextCart: CartItem[] = [];
    let nextCouponCode: string | null = null;

    // Case 1: Guest logs in
    if (!prevUserId && nextUserId) {
      const guestCartJson = localStorage.getItem(guestCartKey);
      const guestCart: CartItem[] = guestCartJson ? JSON.parse(guestCartJson) : [];

      const userCartJson = localStorage.getItem(nextCartKey);
      const userCart: CartItem[] = userCartJson ? JSON.parse(userCartJson) : [];

      const guestCoupon = localStorage.getItem(guestCouponKey);
      const userCoupon = localStorage.getItem(nextCouponKey);

      // Merge guest cart into user cart
      if (guestCart.length > 0) {
        const mergedCart = [...userCart];
        guestCart.forEach(guestItem => {
          const existingIndex = mergedCart.findIndex(
            userItem =>
              userItem.id === guestItem.id &&
              userItem.size === guestItem.size &&
              userItem.material === guestItem.material
          );
          if (existingIndex >= 0) {
            mergedCart[existingIndex].quantity += guestItem.quantity;
          } else {
            mergedCart.push(guestItem);
          }
        });
        nextCart = mergedCart;
        localStorage.setItem(nextCartKey, JSON.stringify(nextCart));
        localStorage.removeItem(guestCartKey);
      } else {
        nextCart = userCart;
      }

      // Migrate guest coupon to user if user has no coupon applied
      if (guestCoupon && !userCoupon) {
        nextCouponCode = guestCoupon;
        localStorage.setItem(nextCouponKey, guestCoupon);
        localStorage.removeItem(guestCouponKey);
      } else {
        nextCouponCode = userCoupon;
      }
    }
    // Case 2: Logout
    else if (prevUserId && !nextUserId) {
      const guestCartJson = localStorage.getItem(guestCartKey);
      nextCart = guestCartJson ? JSON.parse(guestCartJson) : [];
      nextCouponCode = localStorage.getItem(guestCouponKey);
    }
    // Case 3: Account switch
    else {
      const userCartJson = localStorage.getItem(nextCartKey);
      nextCart = userCartJson ? JSON.parse(userCartJson) : [];
      nextCouponCode = localStorage.getItem(nextCouponKey);
    }

    async function syncSession() {
      const syncedCart = syncCartState(nextCart, nextCouponCode, appliedCoupon);
      setCartItems(syncedCart);
      setAppliedCouponCode(nextCouponCode);
      setLoadedUserId(nextUserId);
    }
    syncSession();
  }, [user?.id, loadedUserId, appliedCoupon]);

  const selectedItems = useMemo(() => cartItems.filter(item => item.selected), [cartItems]);


  // Load applied coupon on start / user change
  useEffect(() => {
    let active = true;
    async function loadCoupon() {
      if (!appliedCouponCode) {
        setAppliedCoupon(null);
        return;
      }
      
      // Try static list first
      const staticCoupon = COUPONS.find(c => c.code.toUpperCase() === appliedCouponCode.toUpperCase());
      if (staticCoupon) {
        if (active) setAppliedCoupon(staticCoupon);
        return;
      }
      
      // Check database
      try {
        const dbCoupon = await getCouponByCode(appliedCouponCode);
        if (active) {
          if (dbCoupon) {
            const mappedCoupon: Coupon = {
              id: Number(dbCoupon.id),
              code: dbCoupon.code,
              name: dbCoupon.name,
              type: dbCoupon.type,
              value: dbCoupon.value ? Number(dbCoupon.value) : undefined,
              buyQty: dbCoupon.buy_qty ?? undefined,
              freeQty: dbCoupon.free_qty ?? undefined,
              minSubtotal: dbCoupon.min_subtotal ? Number(dbCoupon.min_subtotal) : undefined,
              description: dbCoupon.description,
              start_date: dbCoupon.start_date,
              end_date: dbCoupon.end_date,
              max_redemptions: dbCoupon.max_redemptions,
              max_redemptions_per_user: dbCoupon.max_redemptions_per_user,
              current_redemptions: dbCoupon.current_redemptions,
              eligible_users: dbCoupon.eligible_users,
              is_active: dbCoupon.is_active
            };
            setAppliedCoupon(mappedCoupon);
          } else {
            setAppliedCoupon(null);
            setAppliedCouponCode(null);
            const key = user?.id ? `appliedCouponCode_${user.id}` : 'appliedCouponCode_guest';
            localStorage.removeItem(key);
          }
        }
      } catch (err) {
        console.error("Error loading coupon:", err);
      }
    }
    loadCoupon();
    return () => { active = false; };
  }, [appliedCouponCode, user?.id]);

  // Load user redemption count for the applied coupon
  useEffect(() => {
    let active = true;
    async function loadRedemptionCount() {
      if (!appliedCouponCode || !user?.id) {
        setUserRedemptionCount(0);
        return;
      }
      try {
        const count = await getUserCouponRedemptionCount(user.id, appliedCouponCode);
        if (active) {
          setUserRedemptionCount(count);
        }
      } catch (err) {
        console.error("Error loading user redemption count:", err);
      }
    }
    loadRedemptionCount();
    return () => { active = false; };
  }, [appliedCouponCode, user?.id]);

  // Sync cart state when appliedCoupon changes
  useEffect(() => {
    setCartItems(prev => syncCartState(prev, appliedCouponCode, appliedCoupon));
  }, [appliedCoupon, appliedCouponCode]);

  const couponValidation = useMemo(() => {
    return appliedCoupon 
      ? validateCoupon(appliedCoupon, selectedItems, user?.id, userRedemptionCount)
      : { isValid: false, error: undefined };
  }, [appliedCoupon, selectedItems, user?.id, userRedemptionCount]);

  const couponDiscount = useMemo(() => {
    return appliedCoupon && couponValidation.isValid
      ? calculateCouponDiscount(appliedCoupon, selectedItems, user?.id, userRedemptionCount)
      : 0;
  }, [appliedCoupon, couponValidation, selectedItems, user?.id, userRedemptionCount]);

  const couponValidationError = useMemo(() => {
    return appliedCoupon && !couponValidation.isValid
      ? couponValidation.error
      : undefined;
  }, [appliedCoupon, couponValidation]);

  const applyCoupon = useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    let coupon = COUPONS.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
    if (!coupon) {
      try {
        const dbCoupon = await getCouponByCode(code);
        if (dbCoupon) {
          coupon = {
            id: Number(dbCoupon.id),
            code: dbCoupon.code,
            name: dbCoupon.name,
            type: dbCoupon.type,
            value: dbCoupon.value ? Number(dbCoupon.value) : undefined,
            buyQty: dbCoupon.buy_qty ?? undefined,
            freeQty: dbCoupon.free_qty ?? undefined,
            minSubtotal: dbCoupon.min_subtotal ? Number(dbCoupon.min_subtotal) : undefined,
            description: dbCoupon.description,
            start_date: dbCoupon.start_date,
            end_date: dbCoupon.end_date,
            max_redemptions: dbCoupon.max_redemptions,
            max_redemptions_per_user: dbCoupon.max_redemptions_per_user,
            current_redemptions: dbCoupon.current_redemptions,
            eligible_users: dbCoupon.eligible_users,
            is_active: dbCoupon.is_active
          };
        }
      } catch (err) {
        console.error("Error fetching coupon from db:", err);
      }
    }

    if (!coupon) {
      return { success: false, error: 'Invalid coupon code' };
    }

    let count = 0;
    if (user?.id) {
      count = await getUserCouponRedemptionCount(user.id, coupon.code);
    }

    const validation = validateCoupon(coupon, selectedItems, user?.id, count);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    setAppliedCoupon(coupon);
    setAppliedCouponCode(coupon.code);
    const key = user?.id ? `appliedCouponCode_${user.id}` : 'appliedCouponCode_guest';
    localStorage.setItem(key, coupon.code);
    return { success: true };
  }, [selectedItems, user?.id]);

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setAppliedCouponCode(null);
    const key = user?.id ? `appliedCouponCode_${user.id}` : 'appliedCouponCode_guest';
    localStorage.removeItem(key);
  }, [user?.id]);

  const selectFreePosterDesign = useCallback((slotIndex: number, product: any) => {
    setCartItems(prev => {
      const paidItems = prev.filter(item => !item.isFreeItem);
      const selectedPaid = paidItems.filter(item => item.selected);
      const { size, material } = getMajoritySizeAndMaterial(selectedPaid);
      
      const existingFreeIndex = prev.findIndex(item => item.isFreeItem && item.slotIndex === slotIndex);
      const unitPrice = calculateSinglePosterPrice(size, material);
      const displayName = product.display_name || product.name;
      const newFreeItem: CartItem = {
        id: existingFreeIndex >= 0 ? prev[existingFreeIndex].id : Date.now() + Math.random(),
        name: `${displayName} (Free Poster)`,
        price: unitPrice,
        unit_price: unitPrice,
        line_total: unitPrice,
        quantity: 1,
        size: size,
        material: material,
        image: product.image,
        selected: true,
        isFreeItem: true,
        couponCode: appliedCouponCode || undefined,
        slotIndex: slotIndex
      };
      
      let newCart;
      if (existingFreeIndex >= 0) {
        const copy = [...prev];
        copy[existingFreeIndex] = newFreeItem;
        newCart = copy;
      } else {
        newCart = [...prev, newFreeItem];
      }
      return syncCartState(newCart, appliedCouponCode, appliedCoupon);
    });
  }, [appliedCouponCode, appliedCoupon]);

  const removeFreePosterDesign = useCallback((slotIndex: number) => {
    setCartItems(prev => {
      const filtered = prev.filter(item => !(item.isFreeItem && item.slotIndex === slotIndex));
      return syncCartState(filtered, appliedCouponCode, appliedCoupon);
    });
  }, [appliedCouponCode, appliedCoupon]);

  // Sync to localStorage when cartItems changes
  useEffect(() => {
    const currentCartKey = user?.id ? `cart_${user.id}` : 'cart_guest';
    localStorage.setItem(currentCartKey, JSON.stringify(cartItems));
  }, [cartItems, user?.id]);

  const triggerNotification = useCallback((message: string) => {
    globalTrigger(message);
  }, [globalTrigger]);

  const addToCart = useCallback((item: CartItem) => {
    setCartItems(prev => {
      const existing = prev.find(p => p.id === item.id && p.size === item.size && p.material === item.material);
      let updated;
      if (existing) {
        updated = prev.map(p => p === existing ? { ...p, quantity: p.quantity + 1 } : p);
      } else {
        updated = [...prev, { ...item, selected: true }];
      }
      return syncCartState(updated, appliedCouponCode, appliedCoupon);
    });
    triggerNotification(`${item.name} added to bag!`);
  }, [appliedCouponCode, appliedCoupon, triggerNotification]);

  const removeFromCart = useCallback((id: number) => {
    setCartItems(prev => {
      const itemToRemove = prev.find(item => item.id === id);
      const targetId = itemToRemove?.originalId || id;
      const filtered = prev.filter(item => item.id !== targetId && item.originalId !== targetId && item.id !== id);
      return syncCartState(filtered, appliedCouponCode, appliedCoupon);
    });
  }, [appliedCouponCode, appliedCoupon]);

  const updateQuantity = useCallback((id: number, delta: number) => {
    setCartItems(prev => {
      const itemToUpdate = prev.find(item => item.id === id);
      const targetId = itemToUpdate?.originalId || id;
      
      const parts = prev.filter(item => item.id === targetId || item.originalId === targetId);
      const totalQuantity = parts.reduce((sum, item) => sum + item.quantity, 0);
      const newQuantity = Math.max(1, totalQuantity + delta);

      const updated = prev
        .filter(item => item.originalId !== targetId)
        .map(item => {
          if (item.id === targetId) {
            return { ...item, quantity: newQuantity };
          }
          return item;
        });

      return syncCartState(updated, appliedCouponCode, appliedCoupon);
    });
  }, [appliedCouponCode, appliedCoupon]);

  const toggleSelection = useCallback((id: number) => {
    setCartItems(prev => {
      const itemToToggle = prev.find(item => item.id === id);
      const targetId = itemToToggle?.originalId || id;
      const newSelected = !itemToToggle?.selected;

      const updated = prev.map(item => {
        if (item.id === targetId || item.originalId === targetId) {
          return { ...item, selected: newSelected };
        }
        return item;
      });

      return syncCartState(updated, appliedCouponCode, appliedCoupon);
    });
  }, [appliedCouponCode, appliedCoupon]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    removeCoupon();
  }, [removeCoupon]);

  const updateItem = useCallback((id: number, updates: Partial<CartItem>) => {
    setCartItems(prev => {
      const itemToUpdate = prev.find(item => item.id === id);
      const targetId = itemToUpdate?.originalId || id;

      const updated = prev.map(item => {
        if (item.id === targetId) {
          return { ...item, ...updates };
        }
        return item;
      });

      return syncCartState(updated, appliedCouponCode, appliedCoupon);
    });
  }, [appliedCouponCode, appliedCoupon]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const contextValue = useMemo(() => ({
    cartItems, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    toggleSelection, 
    cartCount, 
    showNotification, 
    notificationMessage, 
    triggerNotification, 
    clearCart, 
    updateItem,
    appliedCouponCode,
    appliedCoupon,
    couponDiscount,
    couponValidationError,
    applyCoupon,
    removeCoupon,
    selectFreePosterDesign,
    removeFreePosterDesign
  }), [
    cartItems, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    toggleSelection, 
    cartCount, 
    showNotification, 
    notificationMessage, 
    triggerNotification, 
    clearCart, 
    updateItem,
    appliedCouponCode,
    appliedCoupon,
    couponDiscount,
    couponValidationError,
    applyCoupon,
    removeCoupon,
    selectFreePosterDesign,
    removeFreePosterDesign
  ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

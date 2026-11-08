import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { recalculateCartPrices, getMajoritySizeAndMaterial, calculateSinglePosterPrice, normalizeMaterialId } from '../config/pricing';
import { Coupon, COUPONS, validateCoupon, calculateCouponDiscount, isPosterKitItem } from '../config/coupons';
import { getCouponByCode } from '../services/coupons';
import { getUserCouponRedemptionCount } from '../services/orders';
import { PosterKitCouponModal, PosterKitCouponModalMode } from '../components/cart/PosterKitCouponModal';

import { getCustomArtworkBlob } from '../services/posterKitStorage';
import { processPosterKitCustomUpload } from '../utils/imageOptimizer';

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

  // Poster Kit origin & design tracking fields
  isPosterKit?: boolean;
  posterKit?: boolean;
  origin?: 'storefront' | 'poster_kit' | 'custom' | string;
  customArtworkId?: string;
  customArtworkFileName?: string;
  artwork_url?: string;
  artwork_source?: 'collection' | 'custom';
  artworkMissing?: boolean;

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
  addMultipleToCart: (items: CartItem[], customNotification?: string) => void;
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

  // Poster Kit coupon modal management
  posterKitCouponModal: { isOpen: boolean; mode: PosterKitCouponModalMode } | null;
  openPosterKitCouponModal: (mode: PosterKitCouponModalMode) => void;
  dismissPosterKitCouponModal: () => void;

  // Custom artwork blob hydration
  refreshCartBlobs: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const normalizeCartItem = (item: CartItem): CartItem => {
  const rawMat = item.selected_material || item.material || 'Matte';
  const normId = normalizeMaterialId(rawMat);
  if (normId === 'rigid_board') {
    return {
      ...item,
      material: item.material ? (normalizeMaterialId(item.material) === 'rigid_board' ? 'Rigid Board' : item.material) : 'Rigid Board',
      selected_material: item.selected_material ? (normalizeMaterialId(item.selected_material) === 'rigid_board' ? 'Rigid Board' : item.selected_material) : 'Rigid Board'
    };
  }
  return item;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Track the user ID for which the cart is currently loaded
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>(user?.id);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const key = user?.id ? `cart_${user.id}` : 'cart_guest';
    const savedCart = localStorage.getItem(key);
    if (!savedCart) return [];
    try {
      const parsed: CartItem[] = JSON.parse(savedCart);
      return parsed.map(normalizeCartItem);
    } catch {
      return [];
    }
  });
  const { showNotification, notificationMessage, triggerNotification: globalTrigger } = useNotification();
  
  // Coupon System State
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(() => {
    const key = user?.id ? `appliedCouponCode_${user.id}` : 'appliedCouponCode_guest';
    return localStorage.getItem(key);
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [userRedemptionCount, setUserRedemptionCount] = useState<number>(0);
  const [posterKitCouponModal, setPosterKitCouponModal] = useState<{ isOpen: boolean; mode: PosterKitCouponModalMode } | null>(null);

  const dismissPosterKitCouponModal = useCallback(() => {
    setPosterKitCouponModal(null);
  }, []);

  const openPosterKitCouponModal = useCallback((mode: PosterKitCouponModalMode) => {
    setPosterKitCouponModal({ isOpen: true, mode });
  }, []);

  const syncCartState = (items: CartItem[], couponCode: string | null, activeCoupon?: Coupon | null): CartItem[] => {
    // 0. Normalize legacy material names (e.g. flagship -> Rigid Board)
    const normalized = items.map(normalizeCartItem);

    // 1. Separate slot free items
    const slotFreeItems = normalized.filter(item => item.slotIndex !== undefined);

    // 2. Merge previously split regular items back into their single representation
    const regularItemsMerged: CartItem[] = [];
    normalized.forEach(item => {
      if (item.slotIndex !== undefined) return;
      const targetId = item.originalId || item.id;
      const isPk = Boolean(item.isPosterKit || item.posterKit || item.origin === 'poster_kit');
      const existing = regularItemsMerged.find(r =>
        (r.originalId || r.id) === targetId &&
        (r.selected_size || r.size) === (item.selected_size || item.size) &&
        (r.selected_material || r.material) === (item.selected_material || item.material) &&
        Boolean(r.isPosterKit || r.posterKit || r.origin === 'poster_kit') === isPk
      );
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

      // Filter to ONLY eligible regular posters (excluding Poster Kit items)
      const eligibleRegular = recalculatedRegular.filter(
        item => item.selected && !isPosterKitItem(item)
      );
      const totalSelectedPosterQuantity = eligibleRegular.reduce((sum, item) => sum + item.quantity, 0);

      // Centralized Reconciliation: if selected eligible regular posters drop below buyQty, clear coupon and free items
      if (totalSelectedPosterQuantity < buyQty) {
        setTimeout(() => {
          setAppliedCouponCode(null);
          setAppliedCoupon(null);
          const key = user?.id ? `appliedCouponCode_${user.id}` : 'appliedCouponCode_guest';
          localStorage.removeItem(key);
        }, 0);
        return [...recalculatedRegular];
      }

      // automaticFreeCount = min(max(totalSelectedPosterQuantity - X, 0), Y)
      const automaticFreeCount = Math.min(
        Math.max(totalSelectedPosterQuantity - buyQty, 0),
        freeQty
      );
      
      // remainingFreeSlots = Y - automaticFreeCount
      const remainingFreeSlots = freeQty - automaticFreeCount;

      // Find majority size and material of eligible regular items to inherit
      const { size: majSize, material: majMat } = getMajoritySizeAndMaterial(eligibleRegular);

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
        eligibleRegular.forEach(item => {
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
          if (isPosterKitItem(item)) {
            splitRegularItems.push(item);
            return;
          }
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

    // If coupon is Buy X Get Y, handle Poster Kit checks & modal notification
    if (coupon.type === 'buy_x_get_y') {
      const hasPosterKit = selectedItems.some(item => isPosterKitItem(item));
      const paidRegularItems = selectedItems.filter(item => !item.isFreeItem && !isPosterKitItem(item));
      const paidRegularCount = paidRegularItems.reduce((acc, item) => acc + item.quantity, 0);

      // Cart contains ONLY Poster Kit items
      if (hasPosterKit && paidRegularCount === 0) {
        setPosterKitCouponModal({ isOpen: true, mode: 'poster_kit_only' });
        return { success: false, error: 'Coupon not applicable to Poster Kit' };
      }

      // Mixed Cart: both regular posters and Poster Kit items
      if (hasPosterKit && paidRegularCount > 0) {
        if (!validation.isValid) {
          setPosterKitCouponModal({ isOpen: true, mode: 'mixed' });
          return { success: false, error: validation.error };
        }

        // Regular posters qualify! Apply coupon to regular posters and inform customer
        setAppliedCoupon(coupon);
        setAppliedCouponCode(coupon.code);
        const key = user?.id ? `appliedCouponCode_${user.id}` : 'appliedCouponCode_guest';
        localStorage.setItem(key, coupon.code);
        setPosterKitCouponModal({ isOpen: true, mode: 'mixed' });
        return { success: true };
      }
    }

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
      const paidItems = prev.filter(item => !item.isFreeItem && !isPosterKitItem(item));
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

  // Track CartContext-owned object URLs: customArtworkId -> objectUrl
  // CartContext retains independent ownership of preview URLs restored from IndexedDB (B1, B3)
  const cartBlobUrlsRef = useRef<Map<string, string>>(new Map());

  const ensureCartOwnedBlobUrl = useCallback(async (customArtworkId: string): Promise<string | null> => {
    const existing = cartBlobUrlsRef.current.get(customArtworkId);
    if (existing) return existing;
    try {
      const blob = await getCustomArtworkBlob(customArtworkId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        cartBlobUrlsRef.current.set(customArtworkId, url);
        return url;
      }
    } catch (e) {
      console.warn('[CartContext] Failed to load custom artwork blob from IndexedDB:', e);
    }
    return null;
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    const isCustom = Boolean(item.customArtworkId);
    setCartItems(prev => {
      const isPk = Boolean(item.isPosterKit || item.posterKit || item.origin === 'poster_kit');
      const existing = prev.find(p =>
        p.id === item.id &&
        p.size === item.size &&
        p.material === item.material &&
        Boolean(p.isPosterKit || p.posterKit || p.origin === 'poster_kit') === isPk
      );
      let updated;
      if (existing) {
        updated = prev.map(p => p === existing ? { ...p, quantity: p.quantity + 1 } : p);
      } else {
        updated = [...prev, { ...item, selected: true }];
      }
      return syncCartState(updated, appliedCouponCode, appliedCoupon);
    });

    // Hydrate CartContext-owned preview URL immediately for legacy custom upload item (B1, B2)
    // Only hydrate if artwork_url or image is not already a permanent HTTPS cloud URL
    if (isCustom && item.customArtworkId && (!item.artwork_url || item.artwork_url.startsWith('blob:') || !item.image || item.image.startsWith('blob:'))) {
      ensureCartOwnedBlobUrl(item.customArtworkId).then((url) => {
        if (url) {
          setCartItems(prev =>
            prev.map(p => {
              if (p.customArtworkId === item.customArtworkId) {
                const needsPreview = !p.image || p.image.startsWith('blob:');
                const needsMaster = !p.artwork_url || p.artwork_url.startsWith('blob:');
                if (needsPreview || needsMaster) {
                  return {
                    ...p,
                    image: needsPreview ? url : p.image,
                    artwork_url: needsMaster ? url : p.artwork_url,
                  };
                }
              }
              return p;
            })
          );
        }
      });
    }

    triggerNotification(`${item.name} added to bag!`);
  }, [appliedCouponCode, appliedCoupon, triggerNotification, ensureCartOwnedBlobUrl]);

  const addMultipleToCart = useCallback((items: CartItem[], customNotification?: string) => {
    if (!items || items.length === 0) return;
    setCartItems(prev => {
      let updated = [...prev];
      for (const item of items) {
        const isPk = Boolean(item.isPosterKit || item.posterKit || item.origin === 'poster_kit');
        const existingIndex = updated.findIndex(p =>
          p.id === item.id &&
          p.size === item.size &&
          p.material === item.material &&
          Boolean(p.isPosterKit || p.posterKit || p.origin === 'poster_kit') === isPk
        );
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + (item.quantity || 1)
          };
        } else {
          updated.push({ ...item, selected: true });
        }
      }
      return syncCartState(updated, appliedCouponCode, appliedCoupon);
    });

    // Asynchronously ensure CartContext-owned blob URLs ONLY for legacy custom uploads lacking permanent cloud URLs (Bug 2 Fix)
    const legacyCustomItems = items.filter(
      i => Boolean(i.customArtworkId) && (
        !i.artwork_url ||
        i.artwork_url.startsWith('blob:') ||
        !i.image ||
        i.image.startsWith('blob:')
      )
    );
    const customIds = Array.from(new Set(legacyCustomItems.map(i => i.customArtworkId).filter(Boolean))) as string[];
    if (customIds.length > 0) {
      Promise.all(customIds.map(id => ensureCartOwnedBlobUrl(id))).then(() => {
        setCartItems(prev =>
          prev.map(p => {
            if (
              p.customArtworkId &&
              customIds.includes(p.customArtworkId) &&
              cartBlobUrlsRef.current.has(p.customArtworkId)
            ) {
              const url = cartBlobUrlsRef.current.get(p.customArtworkId)!;
              const needsPreview = !p.image || p.image.startsWith('blob:');
              const needsMaster = !p.artwork_url || p.artwork_url.startsWith('blob:');
              if (needsPreview || needsMaster) {
                return {
                  ...p,
                  image: needsPreview ? url : p.image,
                  artwork_url: needsMaster ? url : p.artwork_url,
                };
              }
            }
            return p;
          })
        );
      });
    }

    triggerNotification(customNotification || `${items.length} ${items.length === 1 ? 'poster' : 'posters'} added to bag!`);
  }, [appliedCouponCode, appliedCoupon, triggerNotification, ensureCartOwnedBlobUrl]);

  const removeFromCart = useCallback((id: number) => {
    setCartItems(prev => {
      const itemToRemove = prev.find(item => item.id === id);
      const targetId = itemToRemove?.originalId || id;
      const filtered = prev.filter(item => item.id !== targetId && item.originalId !== targetId && item.id !== id);

      // Clean up CartContext-owned URL if no other active cart item uses the same customArtworkId (B3)
      const removedItems = prev.filter(item => item.id === targetId || item.originalId === targetId || item.id === id);
      removedItems.forEach(removed => {
        if (removed.customArtworkId) {
          const stillUsed = filtered.some(rem => rem.customArtworkId === removed.customArtworkId);
          if (!stillUsed) {
            const url = cartBlobUrlsRef.current.get(removed.customArtworkId);
            if (url) {
              try {
                URL.revokeObjectURL(url);
              } catch {
                // Safe fallback
              }
              cartBlobUrlsRef.current.delete(removed.customArtworkId);
            }
          }
        }
      });

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
    // Revoke all CartContext-owned object URLs upon cart clear (B3)
    cartBlobUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe fallback
      }
    });
    cartBlobUrlsRef.current.clear();

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

  // Route-aware hydration helper: guarantees custom artwork blobs are restored when cart mounts or updates (B2)
  // Phase 3B: Strictly skips items that already possess verified permanent HTTPS cloud URLs
  const refreshCartBlobs = useCallback(async () => {
    const legacyItems = cartItems.filter(
      i => Boolean(i.customArtworkId) && (
        !i.artwork_url ||
        i.artwork_url.startsWith('blob:') ||
        !i.image ||
        i.image.startsWith('blob:')
      )
    );
    if (legacyItems.length === 0) return;

    let hasUpdates = false;
    for (const item of legacyItems) {
      const id = item.customArtworkId!;
      let url = cartBlobUrlsRef.current.get(id);
      if (!url) {
        try {
          const blob = await getCustomArtworkBlob(id);
          if (blob) {
            url = URL.createObjectURL(blob);
            cartBlobUrlsRef.current.set(id, url);
          }
        } catch (e) {
          console.warn('[CartContext] Failed to hydrate blob for', id, e);
        }
      }
      if (url) {
        const needsPreview = !item.image || item.image.startsWith('blob:');
        const needsMaster = !item.artwork_url || item.artwork_url.startsWith('blob:');
        if ((needsPreview && item.image !== url) || (needsMaster && item.artwork_url !== url)) {
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      setCartItems(prev =>
        prev.map(item => {
          if (item.customArtworkId && cartBlobUrlsRef.current.has(item.customArtworkId)) {
            const url = cartBlobUrlsRef.current.get(item.customArtworkId)!;
            const needsPreview = !item.image || item.image.startsWith('blob:');
            const needsMaster = !item.artwork_url || item.artwork_url.startsWith('blob:');
            if (needsPreview || needsMaster) {
              return {
                ...item,
                image: needsPreview ? url : item.image,
                artwork_url: needsMaster ? url : item.artwork_url,
              };
            }
          }
          return item;
        })
      );
    }
  }, [cartItems]);

  // Phase 3B: Hydrate & migrate legacy custom artwork blobs from IndexedDB upon provider load / page refresh
  useEffect(() => {
    let active = true;
    async function hydrateCartCustomBlobs() {
      // Only process legacy items that lack verified permanent cloud URLs
      const legacyItems = cartItems.filter(
        i => Boolean(i.customArtworkId) && (
          !i.artwork_url ||
          i.artwork_url.startsWith('blob:') ||
          !i.image ||
          i.image.startsWith('blob:')
        )
      );
      if (legacyItems.length === 0) return;

      const legacyIds: string[] = Array.from(new Set(legacyItems.map(i => i.customArtworkId!)));
      const blobUpdates = new Map<string, string>();
      const missingIds = new Set<string>();

      for (const id of legacyIds) {
        try {
          const blob = await getCustomArtworkBlob(id);
          if (blob && active) {
            const oldUrl = cartBlobUrlsRef.current.get(id);
            if (oldUrl) {
              try { URL.revokeObjectURL(oldUrl); } catch {}
            }
            const newUrl = URL.createObjectURL(blob);
            cartBlobUrlsRef.current.set(id, newUrl);
            blobUpdates.set(id, newUrl);

            // If user is authenticated, lazily migrate blob to Supabase Storage cloud URLs in background
            if (user?.id) {
              const matchedItem = legacyItems.find(i => i.customArtworkId === id);
              processPosterKitCustomUpload(blob, {
                userId: user.id,
                customArtworkId: id,
                customArtworkFileName: matchedItem?.customArtworkFileName,
              }).then(res => {
                if (res.artwork_url && res.image && active) {
                  setCartItems(prev => {
                    const migrated = prev.map(p =>
                      p.customArtworkId === id
                        ? { ...p, artwork_url: res.artwork_url!, image: res.image!, artworkMissing: false }
                        : p
                    );
                    return syncCartState(migrated, appliedCouponCode, appliedCoupon);
                  });
                }
              }).catch(err => {
                console.warn('[CartContext] Background legacy cloud migration failed (will retry):', err);
              });
            }
          } else if (!blob && active) {
            // Blob missing from IndexedDB (e.g. cleared cache / new device)
            missingIds.add(id);
          }
        } catch {
          missingIds.add(id);
        }
      }

      if ((blobUpdates.size > 0 || missingIds.size > 0) && active) {
        setCartItems(prev =>
          prev.map(item => {
            if (item.customArtworkId && missingIds.has(item.customArtworkId)) {
              return { ...item, artworkMissing: true };
            }
            if (item.customArtworkId && blobUpdates.has(item.customArtworkId)) {
              const newUrl = blobUpdates.get(item.customArtworkId)!;
              const needsPreview = !item.image || item.image.startsWith('blob:');
              const needsMaster = !item.artwork_url || item.artwork_url.startsWith('blob:');
              if (needsPreview || needsMaster) {
                return {
                  ...item,
                  image: needsPreview ? newUrl : item.image,
                  artwork_url: needsMaster ? newUrl : item.artwork_url,
                  artworkMissing: false,
                };
              }
            }
            return item;
          })
        );
      }
    }

    hydrateCartCustomBlobs();

    return () => {
      active = false;
    };
  }, [user?.id]);

  // Clean up all CartContext-owned blob URLs on provider unmount (B3)
  useEffect(() => {
    return () => {
      cartBlobUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Safe fallback
        }
      });
      cartBlobUrlsRef.current.clear();
    };
  }, []);

  const contextValue = useMemo(() => ({
    cartItems, 
    addToCart, 
    addMultipleToCart,
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
    removeFreePosterDesign,
    refreshCartBlobs,
    posterKitCouponModal,
    openPosterKitCouponModal,
    dismissPosterKitCouponModal
  }), [
    cartItems, 
    addToCart, 
    addMultipleToCart,
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
    removeFreePosterDesign,
    refreshCartBlobs,
    posterKitCouponModal,
    openPosterKitCouponModal,
    dismissPosterKitCouponModal
  ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
      <PosterKitCouponModal
        isOpen={Boolean(posterKitCouponModal?.isOpen)}
        mode={posterKitCouponModal?.mode}
        onClose={dismissPosterKitCouponModal}
      />
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

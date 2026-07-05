import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ArrowLeft, Check, X, Maximize2, Layers, AlertCircle, Sparkles } from 'lucide-react';
import { getOptimizedImageUrl } from '../utils/imageUtils';

import { motion, AnimatePresence } from 'motion/react';
import { useCart, CartItem } from '../context/CartContext';
import { RippleWrapper } from '../components/ui/RippleWrapper';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Product } from '../types/database';
import { getProducts } from '../services/products';
import { getProductDisplayName } from '../utils/productUrls';

import { EmptyState } from '../components/ui/EmptyState';

import { POSTER_PRICING, FLAGSHIP_PREMIUM, BUNDLE_OPTIONS, calculateSinglePosterPrice, calculateCustomPosterPrice, getMajoritySizeAndMaterial, SHIPPING_CHARGE } from '../config/pricing';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';

const SIZES = [
  { id: 'a5', name: 'A5', price: POSTER_PRICING.A5 },
  { id: 'a4', name: 'A4', price: POSTER_PRICING.A4 },
  { id: 'a3', name: 'A3', price: POSTER_PRICING.A3 },
  { id: 'a2', name: 'A2', price: POSTER_PRICING.A2 },
];

const MATERIALS = [
  { id: 'matte', name: 'Matte', premium: 0 },
  { id: 'glossy', name: 'Glossy', premium: 0 },
  { id: 'flagship', name: 'Flagship Material', premium: FLAGSHIP_PREMIUM },
];

export default function Cart() {
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    toggleSelection, 
    clearCart, 
    updateItem,
    appliedCouponCode,
    appliedCoupon,
    couponDiscount,
    couponValidationError,
    applyCoupon,
    removeCoupon,
    triggerNotification,
    selectFreePosterDesign,
    removeFreePosterDesign
  } = useCart();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [couponInput, setCouponInput] = useState('');
  
  // Free slot picker states
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectingSlotIndex, setSelectingSlotIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('All');
  
  const navigate = useNavigate();

  const selectedItems = cartItems.filter(item => item.selected);
  const paidSelectedItems = selectedItems.filter(item => !item.isFreeItem);
  const freeSelectedItems = selectedItems.filter(item => item.isFreeItem && item.slotIndex !== undefined);

  const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = selectedItems.reduce((acc, item) => acc + (item.line_total || (item.price * item.quantity)), 0);

  const displayedSubtotal = subtotal;

  const netSubtotal = Math.max(0, subtotal - couponDiscount);
  const shipping = selectedItems.length > 0 ? SHIPPING_CHARGE : 0;
  const total = Math.max(0, netSubtotal + shipping);

  const buyQty = appliedCoupon?.buyQty || 0;
  const freeQty = appliedCoupon?.freeQty || 0;

  const selectedRegular = selectedItems.filter(item => item.slotIndex === undefined);
  const totalSelectedPosterQuantity = selectedRegular.reduce((sum, item) => sum + item.quantity, 0);
  const automaticFreeCount = (appliedCoupon?.type === 'buy_x_get_y' && buyQty > 0)
    ? Math.min(Math.max(totalSelectedPosterQuantity - buyQty, 0), freeQty)
    : 0;
  const numSlots = (appliedCoupon?.type === 'buy_x_get_y')
    ? freeQty - automaticFreeCount
    : 0;

  useEffect(() => {
    async function loadProducts() {
      setLoadingProducts(true);
      try {
        const data = await getProducts();
        setAllProducts(data || []);
      } catch (err) {
        console.error('Error loading products for free slot picker:', err);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.display_name && product.display_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCollection = selectedCollection === 'All' || product.genre === selectedCollection;
      return matchesSearch && matchesCollection;
    });
  }, [allProducts, searchQuery, selectedCollection]);

  // Extract distinct collections for the filter dropdown
  const collections = useMemo(() => {
    const genres = allProducts.map(p => p.genre).filter(Boolean) as string[];
    return ['All', ...Array.from(new Set(genres))];
  }, [allProducts]);

  const getEditingItemPrice = (item: CartItem) => {
    const isCustom = item.size.toLowerCase().includes('x') || item.size === 'Custom';
    if (isCustom && item.width && item.height) {
      return calculateCustomPosterPrice(item.width, item.height, item.material);
    }
    return calculateSinglePosterPrice(item.size, item.material);
  };

  // Determine which items are free under Buy X Get Y coupon
  const getFreeItemQuantityMap = () => {
    const map: Record<number, number> = {};
    if (appliedCoupon?.type !== 'buy_x_get_y' || couponDiscount <= 0) {
      return map;
    }
    
    // Expand all selected items into a list of { id, price }
    const itemsList: { id: number; price: number }[] = [];
    selectedItems.forEach(item => {
      if (item.isFreeItem) return;
      const isCustom = item.size.toLowerCase().includes('x') || item.size === 'Custom';
      let unitPrice = 0;
      if (isCustom && item.width && item.height) {
        unitPrice = calculateCustomPosterPrice(item.width, item.height, item.material);
      } else {
        unitPrice = calculateSinglePosterPrice(item.size, item.material);
      }
      for (let i = 0; i < item.quantity; i++) {
        itemsList.push({ id: item.id, price: unitPrice });
      }
    });

    // Sort ascending by price
    itemsList.sort((a, b) => a.price - b.price);

    const buyQty = appliedCoupon.buyQty || 1;
    const freeQty = appliedCoupon.freeQty || 0;
    const numFree = Math.floor(itemsList.length / buyQty) * freeQty;

    // Take the cheapest numFree items
    for (let i = 0; i < Math.min(numFree, itemsList.length); i++) {
      const id = itemsList[i].id;
      map[id] = (map[id] || 0) + 1;
    }

    return map;
  };

  const freeItemQuantityMap = getFreeItemQuantityMap();

  if (cartItems.length === 0) {
    return (
      <div className="pt-32 pb-24 min-h-screen px-4 flex items-center justify-center">
        <SEO metadata={getNonIndexableMetadata('Shopping Cart', '/cart')} />
        <EmptyState 
          icon={ShoppingCart}
          title="Your Bag is Empty"
          description="Looks like you haven't added any posters to your realm yet."
          actionLabel="Start Shopping"
          onActionClick={() => navigate('/collections')}
        />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-4 min-h-screen">
      <SEO metadata={getNonIndexableMetadata('Shopping Cart', '/cart')} />
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12"
        >
          <Link to="/collections" className="inline-flex items-center gap-2 text-brand-black hover:text-brand-red transition-colors font-bold uppercase tracking-widest text-sm">
            <ArrowLeft size={18} />
            Back to Store
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-4">
            <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter">
              YOUR <span className="text-brand-red">BAG</span>
            </h1>
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-red transition-colors font-bold uppercase tracking-widest text-xs mb-2 group"
            >
              <Trash2 size={14} />
              Clear Bag
              <div className="w-0 group-hover:w-full h-0.5 bg-brand-red transition-all duration-300"></div>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-6">
            {paidSelectedItems.length === 0 && (
              <div className="p-8 text-center bg-white comic-border uppercase tracking-widest font-black text-xs text-gray-500">
                Please select items in your bag to proceed.
              </div>
            )}
            {cartItems.filter(item => item.slotIndex === undefined).map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="comic-border p-4 md:p-6 bg-white flex flex-col md:flex-row gap-6 relative group text-brand-black"
              >
                {/* Selection Checkbox */}
                <button 
                  onClick={() => toggleSelection(item.id)}
                  className={`absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 comic-border z-10 flex items-center justify-center transition-all ${
                    item.selected ? 'bg-brand-red border-brand-black text-white' : 'bg-white border-gray-300 text-transparent'
                  }`}
                >
                  <Check size={16} strokeWidth={4} />
                </button>

                <div className={`w-full md:w-32 aspect-[3/4] bg-gray-100 flex-shrink-0 border-2 border-brand-black overflow-hidden transition-opacity ${!item.selected ? 'opacity-40 grayscale' : ''}`}>
                  <img 
                    src={getOptimizedImageUrl(item.image, 160, 213)} 
                    alt={item.name} 
                    width={160}
                    height={213}
                    loading="lazy"
                    className="w-full h-full object-cover" 
                  />
                </div>
                
                <div className={`flex-grow transition-opacity ${!item.selected ? 'opacity-40' : ''}`}>
                  <div className="flex justify-between items-start mb-2 text-left">
                    <h3 className="text-2xl font-black uppercase tracking-tight">
                      {item.name}
                    </h3>
                    <p className="text-xl font-black tracking-tight text-brand-red text-right flex flex-col items-end">
                      {item.isFreeItem ? (
                        <>
                          <span className="bg-green-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 mb-1.5 comic-border border-brand-black">
                            FREE
                          </span>
                          <span className="text-xs text-gray-400 line-through">
                            ₹{(item.unit_price || item.price)}
                          </span>
                          <span className="text-xl font-black text-brand-red mt-0.5">
                            ₹0
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-gray-400 font-bold block mt-0.5">
                              Total: ₹0 (Saved ₹{(item.unit_price || item.price) * item.quantity})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          ₹{item.unit_price || item.price}
                          {item.quantity > 1 && (
                            <span className="text-xs text-gray-400 font-bold block">
                              Total: ₹{item.line_total || (item.price * item.quantity)}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 mb-6">
                    <div className="bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider border border-gray-200">
                      Size: {item.size}
                    </div>
                    <div className="bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider border border-gray-200">
                      Material: {item.material}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center border-2 border-brand-black">
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-2 hover:bg-gray-100 transition-colors border-right-2 border-brand-black"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-12 text-center font-black">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-2 hover:bg-gray-100 transition-colors border-left-2 border-brand-black"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEditingItem(item)}
                        className="transition-colors p-2 text-gray-400 hover:text-brand-red"
                        title="Edit Item"
                      >
                        <span className="text-xs font-bold uppercase tracking-widest mr-1">Edit</span>
                      </button>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-400 hover:text-brand-red transition-colors p-2"
                        title="Remove Item"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Free Poster Slots Section */}
            {appliedCoupon?.type === 'buy_x_get_y' && numSlots > 0 && (
              <div className="mt-12 space-y-6">
                <div className="border-b-4 border-brand-black pb-2 flex justify-between items-end">
                  <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Sparkles className="text-brand-red animate-pulse" />
                    Free Poster Slots
                  </h2>
                  <span className="bg-brand-red text-white text-xs font-black uppercase tracking-widest px-3 py-1 comic-border">
                    {freeSelectedItems.length} / {numSlots} Chosen
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-brand-black">
                  {Array.from({ length: numSlots }).map((_, i) => {
                    const freeItem = freeSelectedItems.find(item => item.slotIndex === i);
                    if (freeItem) {
                      return (
                        <motion.div
                          key={`free-slot-${i}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="comic-border p-4 bg-green-50/55 border-green-600 flex gap-4 relative text-left"
                        >
                          <div className="w-20 aspect-[3/4] bg-gray-100 flex-shrink-0 border-2 border-brand-black overflow-hidden">
                            <img 
                              src={getOptimizedImageUrl(freeItem.image, 120, 160)} 
                              alt={freeItem.name} 
                              width={120}
                              height={160}
                              loading="lazy"
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          <div className="flex-grow flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start">
                                <h3 className="font-black uppercase tracking-tight text-sm pr-6">
                                  {freeItem.name.replace(' (Free Poster)', '')}
                                </h3>
                                <span className="bg-green-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
                                  FREE
                                </span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <span className="bg-white border border-gray-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                  Size: {freeItem.size}
                                </span>
                                <span className="bg-white border border-gray-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                  Material: {freeItem.material}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-4">
                              <button
                                onClick={() => setSelectingSlotIndex(i)}
                                className="text-[10px] font-black uppercase tracking-widest text-brand-black hover:text-brand-red transition-colors"
                              >
                                Change Design
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => removeFreePosterDesign(i)}
                                className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-brand-red transition-colors"
                              >
                                Clear Slot
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    } else {
                      return (
                        <motion.button
                          key={`free-slot-empty-${i}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => setSelectingSlotIndex(i)}
                          className="comic-border p-6 bg-white border-dashed border-gray-400 hover:border-brand-red hover:bg-gray-50 flex items-center justify-center gap-4 group transition-all text-left h-32"
                        >
                          <div className="w-12 h-16 bg-gray-100 flex-shrink-0 border-2 border-dashed border-gray-400 group-hover:border-brand-red flex items-center justify-center text-gray-400 group-hover:text-brand-red">
                            <Plus size={20} />
                          </div>
                          <div>
                            <h3 className="font-black uppercase tracking-wider text-xs text-gray-500 group-hover:text-brand-red mb-1">
                              Slot #{i + 1}: Choose Free Design
                            </h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">
                              Auto-assigned as {paidSelectedItems.length > 0 ? 'majority size/material' : 'A5/Matte'}
                            </p>
                          </div>
                        </motion.button>
                      );
                    }
                  })}
                </div>
              </div>
            )}



            <CartRecommendations />
          </div>

          <div className="lg:col-span-1">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="comic-border p-8 bg-brand-black text-white sticky top-32"
            >
              <h2 className="text-3xl font-black uppercase mb-8 border-b-2 border-white/10 pb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between font-bold uppercase tracking-widest text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span>₹{displayedSubtotal}</span>
                </div>
                
                {appliedCouponCode && (
                  <div className="flex justify-between font-bold uppercase tracking-widest text-sm">
                    <span className="text-gray-400">Discount ({appliedCouponCode})</span>
                    <span className={couponDiscount > 0 ? "text-green-400 font-black" : "text-gray-500"}>
                      {couponDiscount > 0 ? `-₹${couponDiscount}` : '₹0'}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between font-bold uppercase tracking-widest text-sm">
                  <span className="text-gray-400">Shipping</span>
                  <span>₹{SHIPPING_CHARGE}</span>
                </div>
              </div>

              {/* Promo Code Input System */}
              <div className="border-t border-b border-white/10 py-6 mb-8 text-left">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red mb-3">
                  Have a Promo Code?
                </p>
                
                {!appliedCouponCode ? (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const code = couponInput.trim();
                      if (!code) return;
                      const result = await applyCoupon(code);
                      if (result.success) {
                        triggerNotification(`Coupon "${code.toUpperCase()}" applied!`);
                        setCouponInput('');
                      } else {
                        triggerNotification(result.error || "Invalid coupon");
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input 
                      name="couponCode"
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="ENTER CODE"
                      className="flex-grow bg-white/5 border-2 border-white/10 text-white font-bold p-3 text-sm focus:outline-none focus:border-brand-red focus:bg-white/10 transition-all uppercase tracking-widest"
                    />
                    <button 
                      type="submit"
                      className="bg-brand-red text-white hover:bg-white hover:text-brand-black transition-colors font-display text-sm font-black uppercase tracking-widest px-6 comic-border border-white active:scale-95"
                    >
                      Apply
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-brand-red text-white text-[10px] font-black px-2 py-0.5 tracking-wider uppercase">
                            {appliedCoupon?.code || appliedCouponCode}
                          </span>
                          <span className="text-xs font-bold text-gray-300 truncate">
                            {appliedCoupon?.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                          {appliedCoupon?.description}
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          removeCoupon();
                          triggerNotification("Coupon removed.");
                        }}
                        className="text-gray-400 hover:text-brand-red p-1 transition-colors ml-2"
                        title="Remove Coupon"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {!couponValidationError && (
                      <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-black uppercase tracking-wider bg-green-500/10 border border-green-500/20 p-2">
                        <Check size={12} strokeWidth={3} />
                        Coupon Applied! Saved ₹{couponDiscount}
                      </div>
                    )}
                  </div>
                )}

                {couponValidationError && (
                  <div className="mt-2 flex items-start gap-1.5 text-brand-red text-[10px] font-black uppercase tracking-wider bg-brand-red/10 border border-brand-red/20 p-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black">Coupon Inactive</p>
                      <p className="text-[9px] font-medium text-gray-300 normal-case mt-0.5">{couponValidationError}</p>
                    </div>
                  </div>
                )}

                {/* Available Offers Section */}
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red mb-4">
                    Available Offers
                  </p>
                  <div className="flex flex-col gap-3">
                    {(() => {
                      const paidSelectedItems = cartItems.filter(item => item.selected && !item.isFreeItem);
                      const paidCount = paidSelectedItems.reduce((sum, item) => sum + item.quantity, 0);

                      const offersList = [
                        { code: 'B5G2F', title: 'Buy 5 Get 2 Free', req: 5, free: 2 },
                        { code: 'B6G3F', title: 'Buy 6 Get 3 Free', req: 6, free: 3 },
                        { code: 'B7G5F', title: 'Buy 7 Get 5 Free', req: 7, free: 5 }
                      ];

                      let closestOfferCode = '';
                      let minRemaining = Infinity;
                      offersList.forEach(o => {
                        const rem = o.req - paidCount;
                        if (rem > 0 && rem < minRemaining) {
                          minRemaining = rem;
                          closestOfferCode = o.code;
                        }
                      });

                      return offersList.map((offer) => {
                        const remaining = offer.req - paidCount;
                        const isUnlocked = remaining <= 0;
                        const isClosest = offer.code === closestOfferCode;
                        const progress = Math.min((paidCount / offer.req) * 100, 100);
                        const progressPercentage = Math.round(progress);

                        let cardStyles = 'border-white/10 bg-white/5 hover:border-white/30';
                        if (isUnlocked) {
                          cardStyles = 'border-green-500 bg-green-500/10';
                        } else if (isClosest) {
                          cardStyles = 'border-brand-red/60 bg-white/10';
                        }

                        return (
                          <div 
                            key={offer.code} 
                            className={`py-3 px-4 border-2 transition-all duration-300 flex flex-col gap-1.5 ${cardStyles}`}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div>
                                <p className="font-display font-black text-sm uppercase tracking-tight text-white">
                                  {offer.title}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5 font-bold uppercase tracking-wider">
                                  Code: <span className="text-brand-red">{offer.code}</span>
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  if (!appliedCouponCode) {
                                    setCouponInput(offer.code);
                                  }
                                }}
                                disabled={!!appliedCouponCode}
                                className={`px-3 py-1 rounded-full font-mono text-[10px] font-black tracking-widest border transition-all cursor-pointer ${
                                  appliedCouponCode
                                    ? 'border-gray-600 text-gray-500 cursor-not-allowed bg-transparent'
                                    : isUnlocked
                                      ? 'border-green-500 bg-green-500 text-black hover:bg-white hover:text-black hover:border-white'
                                      : 'border-white/20 text-white bg-white/10 hover:bg-brand-red hover:text-white hover:border-brand-red'
                                }`}
                              >
                                {offer.code}
                              </button>
                            </div>

                            {/* Premium Visual Progress Bar */}
                            <div className="w-full mt-1">
                              <div className={`w-full h-2 rounded-full overflow-hidden ${isUnlocked ? 'bg-green-500/20' : 'bg-white/10'}`}>
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ease-out ${isUnlocked ? 'bg-green-500' : 'bg-brand-red'}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center mt-1 text-[10px] font-black uppercase tracking-wider">
                                <span className={isUnlocked ? 'text-green-400' : 'text-brand-red'}>
                                  {progressPercentage}%
                                </span>
                                <span className="text-gray-400">
                                  {paidCount} / {offer.req} Posters Added
                                </span>
                              </div>
                            </div>

                            {remaining > 0 ? (
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Add {remaining} more poster{remaining > 1 ? 's' : ''} to unlock {offer.free} FREE poster{offer.free > 1 ? 's' : ''}.
                              </p>
                            ) : paidCount === offer.req ? (
                              <p className="text-[10px] font-black text-green-400 uppercase tracking-wider">
                                ✓ Congratulations! <br />
                                You've unlocked {offer.free} FREE poster{offer.free > 1 ? 's' : ''}.
                              </p>
                            ) : (
                              <p className="text-[10px] font-black text-green-400 uppercase tracking-wider">
                                ✓ {offer.free} poster{offer.free > 1 ? 's' : ''} {offer.free > 1 ? 'were' : 'was'} automatically converted to FREE.
                              </p>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {appliedCoupon && !couponValidationError && (
                <div className="border-t border-b border-white/10 py-4 mb-6 space-y-2 text-xs font-bold uppercase tracking-widest text-left text-gray-400">
                  {appliedCoupon.type === 'buy_x_get_y' ? (
                    <>
                      <div className="flex justify-between">
                        <span>Paid Posters</span>
                        <span className="text-white">
                          {paidSelectedItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Free Posters</span>
                        <span className="text-white">
                          {freeSelectedItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>Total Items</span>
                      <span className="text-white">{paidSelectedItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Coupon Applied</span>
                    <span className="text-brand-red font-black">{appliedCoupon.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Saved</span>
                    <span className="text-green-400 font-black">₹{couponDiscount}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end mb-10 pt-2">
                <span className="text-lg font-black uppercase tracking-widest">Total</span>
                <span className="text-4xl font-black text-brand-red">₹{total}</span>
              </div>

              <RippleWrapper delay={2} disabled={selectedItems.length === 0} className="w-full">
                <button 
                  onClick={() => navigate('/checkout')}
                  disabled={selectedItems.length === 0}
                  className={`w-full py-5 font-display text-2xl uppercase tracking-widest comic-border border-white transition-all flex items-center justify-center gap-3 active:scale-95 ${
                    selectedItems.length > 0 
                    ? 'bg-brand-red text-white hover:bg-white hover:text-brand-black cursor-pointer' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed grayscale'
                  }`}
                >
                  {selectedItems.length === 0 ? 'Select Items' : 'Checkout'}
                  <ArrowRight size={24} />
                </button>
              </RippleWrapper>

              <p className="text-[10px] text-gray-500 font-bold text-center mt-6 uppercase tracking-widest">
                Safe & Secure Transactions guaranteed.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
      {/* Edit Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 overflow-y-auto pt-20 pb-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-brand-white w-full max-w-4xl comic-border overflow-hidden flex flex-col md:flex-row shadow-2xl z-10 my-auto"
            >
              <button 
                onClick={() => setEditingItem(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-brand-black text-white hover:bg-brand-red transition-colors comic-border border-white"
              >
                <X size={24} />
              </button>

              <div className="w-full md:w-1/2 bg-gray-100 relative" style={{ aspectRatio: '3/4' }}>
                <img 
                  src={getOptimizedImageUrl(editingItem.image, 1000, 1333)} 
                  alt={editingItem.name} 
                  width={1000}
                  height={1333}
                  loading="lazy"
                  className="w-full h-full object-cover aspect-[3/4] md:aspect-auto"
                />
              </div>

              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col max-h-[80vh] overflow-y-auto">
                <div className="mb-8 text-left">
                  <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">{editingItem.name}</h2>
                  <p className="text-gray-500 font-medium">Customize your selection.</p>
                </div>

                <div className="space-y-8 flex-grow text-left">
                  {/* Size Selection */}
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
                      <Maximize2 size={14} /> {
                        (editingItem.size.toLowerCase().includes('x') || editingItem.size === 'Custom') 
                          ? 'Size (Custom)' 
                          : BUNDLE_OPTIONS.some(opt => opt.name === editingItem.size)
                            ? 'Bundle Option'
                            : 'Select Size'
                      }
                    </p>
                    {(editingItem.size.toLowerCase().includes('x') || editingItem.size === 'Custom') ? (
                      <div className="p-4 border-2 border-brand-black bg-brand-black text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-black text-sm uppercase">Custom Dimensions</p>
                            <p className="text-[10px] font-bold text-brand-red">{editingItem.size}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Custom Size</span>
                          </div>
                        </div>
                      </div>
                    ) : BUNDLE_OPTIONS.some(opt => opt.name === editingItem.size) ? (
                      <div className="grid grid-cols-1 gap-2">
                        {BUNDLE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              const updated = { ...editingItem, size: option.name, selected_size: option.name };
                              const newPrice = getEditingItemPrice(updated);
                              updateItem(editingItem.id, { 
                                size: option.name,
                                selected_size: option.name,
                                price: newPrice,
                                unit_price: newPrice,
                                line_total: newPrice * editingItem.quantity
                              });
                              setEditingItem({ ...updated, price: newPrice });
                            }}
                            className={`p-3 border-2 text-left transition-all flex justify-between items-center ${
                              editingItem.size === option.name 
                                ? 'border-brand-black bg-brand-black text-white' 
                                : 'border-gray-200 bg-white hover:border-brand-red'
                            }`}
                          >
                            <div>
                              <p className="font-black text-sm uppercase">{option.name}</p>
                              <p className={`text-[10px] font-bold ${editingItem.size === option.name ? 'text-brand-red' : 'text-gray-400'}`}>
                                {option.postersCount} A5 posters
                              </p>
                            </div>
                            <span className="font-mono text-sm font-bold">₹{option.price}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {SIZES.map((size) => (
                          <button
                            key={size.id}
                            onClick={() => {
                              const updated = { ...editingItem, size: size.name, selected_size: size.name };
                              const newPrice = getEditingItemPrice(updated);
                              updateItem(editingItem.id, { 
                                size: size.name,
                                selected_size: size.name,
                                price: newPrice,
                                unit_price: newPrice,
                                line_total: newPrice * editingItem.quantity
                              });
                              setEditingItem({ ...updated, price: newPrice });
                            }}
                            className={`p-3 border-2 text-left transition-all ${
                              editingItem.size === size.name 
                                ? 'border-brand-black bg-brand-black text-white' 
                                : 'border-gray-200 bg-white hover:border-brand-red'
                            }`}
                          >
                            <p className="font-black text-sm uppercase">{size.name}</p>
                            <p className={`text-[10px] font-bold ${editingItem.size === size.name ? 'text-brand-red' : 'text-gray-400'}`}>
                              {size.name === 'A5' ? '5.8" x 8.3"' : size.name === 'A4' ? '8.3" x 11.7"' : size.name === 'A3' ? '11.7" x 16.5"' : '16.5" x 23.4"'}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Material Selection */}
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
                      <Layers size={14} /> Select Material
                    </p>
                    <div className="space-y-2">
                      {MATERIALS.map((material) => (
                        <button
                          key={material.id}
                          onClick={() => {
                            const updated = { ...editingItem, material: material.name, selected_material: material.name };
                            const newPrice = getEditingItemPrice(updated);
                            updateItem(editingItem.id, { 
                              material: material.name,
                              selected_material: material.name,
                              price: newPrice,
                              unit_price: newPrice,
                              line_total: newPrice * editingItem.quantity
                            });
                            setEditingItem({ ...updated, price: newPrice });
                          }}
                          className={`w-full p-4 border-2 text-left transition-all flex items-center justify-between ${
                            editingItem.material === material.name 
                              ? 'border-brand-black bg-brand-black text-white' 
                              : 'border-gray-200 bg-white hover:border-brand-red'
                          }`}
                        >
                          <div>
                            <p className="font-black text-sm uppercase">{material.name}</p>
                            <p className={`text-[10px] font-bold ${editingItem.material === material.name ? 'text-gray-400' : 'text-gray-500'}`}>
                              {material.name === 'Matte' ? 'Non-reflective, professional finish' : material.name === 'Glossy' ? 'Vibrant colors, high shine' : 'Heavyweight archival stock, textured'}
                            </p>
                          </div>
                          {material.premium > 0 && (
                            <p className="font-mono text-xs font-bold">+₹{material.premium}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t-2 border-gray-100 flex items-center justify-between gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Price</p>
                    <p className="text-4xl font-black text-brand-red leading-none">
                      ₹{editingItem ? getEditingItemPrice(editingItem) : 0}
                    </p>
                  </div>
                  <RippleWrapper delay={2} className="flex-1">
                    <button 
                      onClick={() => setEditingItem(null)}
                      className="w-full py-5 bg-brand-black text-white font-display text-2xl uppercase tracking-widest comic-border border-white hover:bg-brand-red transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none"
                    >
                      Done
                    </button>
                  </RippleWrapper>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Bag Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-black/60 backdrop-blur-sm" 
              onClick={() => setShowClearConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white comic-border p-8 max-w-md w-full shadow-2xl z-10"
            >
              <h3 className="text-3xl font-black uppercase tracking-tight mb-4">Clear Bag?</h3>
              <p className="text-gray-600 font-medium mb-8 text-lg text-left">
                Are you sure you want to clear the bag?
              </p>
              <div className="flex gap-4">
                <button 
                  autoFocus
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-brand-black text-white hover:bg-brand-red transition-colors comic-border focus:outline-none focus:ring-4 focus:ring-brand-red/50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    clearCart();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-4 font-display text-xl uppercase tracking-widest bg-white text-brand-black hover:bg-gray-100 transition-colors comic-border border-brand-black"
                >
                  Sure
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Design Picker Modal */}
      <AnimatePresence>
        {selectingSlotIndex !== null && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white comic-border max-w-4xl w-full max-h-[80vh] flex flex-col text-brand-black"
            >
              <div className="p-6 border-b-2 border-brand-black flex justify-between items-center bg-brand-black text-white">
                <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="text-yellow-400" />
                  Select Free Design (Slot #{selectingSlotIndex + 1})
                </h3>
                <button 
                  onClick={() => setSelectingSlotIndex(null)}
                  className="p-1 hover:bg-white/10 transition-colors border border-white/20"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Filters */}
              <div className="p-4 border-b-2 border-brand-black bg-gray-50 flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  placeholder="Search posters..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-grow p-3 bg-white comic-border font-bold placeholder-gray-400 focus:outline-none"
                />
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="p-3 bg-white comic-border font-bold focus:outline-none"
                >
                  {collections.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              {/* Grid of designs */}
              <div className="flex-grow overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {loadingProducts ? (
                  <div className="col-span-full py-12 text-center uppercase tracking-widest font-black text-xs text-gray-500">
                    Loading designs...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full py-12 text-center uppercase tracking-widest font-black text-xs text-gray-500">
                    No matching designs found.
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        selectFreePosterDesign(selectingSlotIndex, product);
                        setSelectingSlotIndex(null);
                        setSearchQuery('');
                      }}
                      className="comic-border p-2 bg-white flex flex-col hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left group"
                    >
                      <div className="aspect-[3/4] bg-gray-100 border-b-2 border-brand-black overflow-hidden relative">
                        <img 
                          src={getOptimizedImageUrl(product.image, 160, 213)} 
                          alt={getProductDisplayName(product)} 
                          width={160}
                          height={213}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      </div>
                      <div className="pt-2">
                        <h4 className="font-black uppercase tracking-tight text-xs truncate">{getProductDisplayName(product)}</h4>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">{product.genre}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const RECOMMENDATION_SIZES = [
  { id: 'a5', name: 'A5', dimensions: '5.8" x 8.3"', price: POSTER_PRICING.A5 },
  { id: 'a4', name: 'A4', dimensions: '8.3" x 11.7"', price: POSTER_PRICING.A4 },
  { id: 'a3', name: 'A3', dimensions: '11.7" x 16.5"', price: POSTER_PRICING.A3 },
  { id: 'a2', name: 'A2', dimensions: '16.5" x 23.4"', price: POSTER_PRICING.A2 },
];

const RECOMMENDATION_MATERIALS = [
  { id: 'matte', name: 'Matte', desc: 'Non-reflective, professional finish', price: 0 },
  { id: 'glossy', name: 'Glossy', desc: 'Vibrant colors, high shine', price: 0 },
  { id: 'flagship', name: 'Flagship Material', desc: 'Heavyweight archival stock, textured', price: FLAGSHIP_PREMIUM },
];

const CartRecommendations = () => {
  const { cartItems, addToCart } = useCart();
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<any>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (cartItems.length === 0) {
        setRecommendations([]);
        setLoading(false);
        return;
      }

      try {
        const cartProductIds = cartItems.map(item => item.id);
        
        // 1. Get categories of items in the cart
        const { data: cartProducts, error: err1 } = await supabase
          .from('products')
          .select('id, genre')
          .in('id', cartProductIds);

        if (err1) throw err1;

        const genres = Array.from(new Set(cartProducts?.map(p => p.genre).filter(Boolean)));
        if (genres.length === 0) {
          setRecommendations([]);
          setLoading(false);
          return;
        }

        // 2. Fetch products in those categories
        const { data: recommended, error: err2 } = await supabase
          .from('products')
          .select('*')
          .in('genre', genres)
          .eq('is_active', true);

        if (err2) throw err2;

        // 3. Exclude products already in cart
        const cartProductIdsSet = new Set(cartProductIds);
        const filtered = (recommended || []).filter(p => !cartProductIdsSet.has(p.id));

        // 4. Sort by priority: Featured -> Popular -> Newest
        filtered.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;

          if (a.is_popular && !b.is_popular) return -1;
          if (!a.is_popular && b.is_popular) return 1;

          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });

        setRecommendations(filtered.slice(0, 4));
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [cartItems]);

  const handleOpenQuickAdd = (product: Product) => {
    setSelectedProduct(product);
    setSelectedMaterial(RECOMMENDATION_MATERIALS[0]);
    if (product.genre?.toLowerCase() === 'bundle') {
      setSelectedSize(BUNDLE_OPTIONS[0]);
    } else {
      setSelectedSize(RECOMMENDATION_SIZES[2]); // Default A3
    }
  };

  const handleQuickAdd = () => {
    if (!selectedProduct) return;
    
    const finalPrice = selectedSize.price + selectedMaterial.price;
    addToCart({
      id: selectedProduct.id,
      name: getProductDisplayName(selectedProduct),
      price: finalPrice,
      image: selectedProduct.image,
      quantity: 1,
      size: selectedSize.name,
      material: selectedMaterial.name,
      selected_size: selectedSize.name,
      selected_material: selectedMaterial.name,
      unit_price: finalPrice,
      line_total: finalPrice
    });
    
    setSelectedProduct(null);
  };

  if (loading || recommendations.length === 0) return null;

  const isBundle = selectedProduct?.genre?.toLowerCase() === 'bundle';

  return (
    <div className="mt-16 pt-12 border-t-4 border-brand-black">
      <div className="mb-10 text-left">
        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">
          Complete <span className="text-brand-red">Your Collection</span>
        </h2>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
          You might also like these posters.
        </p>
      </div>

      {/* Grid / Carousel layout */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto sm:overflow-x-visible pb-6 sm:pb-0 snap-x scrollbar-hide">
        {recommendations.map((product) => (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            key={product.id}
            className="flex-shrink-0 w-[240px] sm:w-auto snap-start bg-white comic-border transition-all hover:-translate-y-2 overflow-hidden flex flex-col justify-between group"
          >
            <div className="relative overflow-hidden aspect-[3/4]">
              <img 
                src={getOptimizedImageUrl(product.image, 600, 800)} 
                alt={getProductDisplayName(product)} 
                width={600}
                height={800}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-brand-red/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </div>
            
            <div className="p-4 flex-grow flex flex-col justify-between">
              <div className="mb-3">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-[9px] font-black uppercase text-brand-red tracking-[0.2em]">{product.genre}</p>
                  <p className="font-mono text-[10px] font-black uppercase tracking-wider text-gray-500">
                    {product.genre?.toLowerCase() === 'bundle'
                      ? `From ₹${BUNDLE_OPTIONS[0].price}`
                      : `From ₹${POSTER_PRICING.A5}`}
                  </p>
                </div>
                <h3 className="font-display text-lg font-black uppercase tracking-tight group-hover:text-brand-red transition-colors line-clamp-1">
                  {getProductDisplayName(product)}
                </h3>
              </div>
              <button 
                onClick={() => handleOpenQuickAdd(product)}
                className="w-full py-2 bg-brand-black text-white font-display text-lg uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-red transition-all"
              >
                <ShoppingCart size={14} /> Quick Add
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[250] flex items-start justify-center px-4 overflow-y-auto pt-20 pb-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-brand-white w-full max-w-4xl comic-border overflow-hidden flex flex-col md:flex-row shadow-2xl z-[260] my-auto"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="fixed top-4 right-4 md:absolute md:top-4 md:right-4 z-[130] w-12 h-12 flex items-center justify-center bg-brand-black text-white hover:bg-brand-red transition-colors comic-border border-white active:scale-95 cursor-pointer"
                aria-label="Close modal"
              >
                <X size={24} />
              </button>

              <div className="w-full md:w-1/2 bg-gray-100 relative" style={{ aspectRatio: '3/4' }}>
                <img 
                  src={getOptimizedImageUrl(selectedProduct.image, 1000, 1333)} 
                  alt={selectedProduct.name} 
                  width={1000}
                  height={1333}
                  loading="lazy"
                  className="w-full h-full object-cover aspect-[3/4] md:aspect-auto"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 left-4 bg-brand-red text-white px-3 py-1 text-xs font-black uppercase tracking-widest rotate-2">
                  {selectedProduct.genre}
                </div>
              </div>

              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col max-h-[80vh] overflow-y-auto text-brand-black">
                <div className="mb-8">
                  <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">{selectedProduct.name}</h2>
                  <p className="text-gray-500 font-medium">{selectedProduct.description}</p>
                </div>

                <div className="space-y-8 flex-grow">
                  {/* Size Selection */}
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
                      <Maximize2 size={14} /> {isBundle ? 'Select Bundle Option' : 'Select Size'}
                    </p>
                    {isBundle ? (
                      <div className="grid grid-cols-1 gap-2">
                        {BUNDLE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setSelectedSize(option)}
                            className={`p-3 border-2 text-left transition-all flex justify-between items-center ${
                              selectedSize.id === option.id 
                                ? 'border-brand-black bg-brand-black text-white' 
                                : 'border-gray-200 bg-white hover:border-brand-red'
                            }`}
                          >
                            <div>
                              <p className="font-black text-sm uppercase">{option.name}</p>
                              <p className={`text-[10px] font-bold ${selectedSize.id === option.id ? 'text-brand-red' : 'text-gray-400'}`}>
                                {option.postersCount} A5 posters
                              </p>
                            </div>
                            <span className="font-mono text-sm font-bold">₹{option.price}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {RECOMMENDATION_SIZES.map((size) => (
                          <button
                            key={size.id}
                            onClick={() => setSelectedSize(size)}
                            className={`p-3 border-2 text-left transition-all ${
                              selectedSize.id === size.id 
                                ? 'border-brand-black bg-brand-black text-white' 
                                : 'border-gray-200 bg-white hover:border-brand-red'
                            }`}
                          >
                            <p className="font-black text-sm uppercase">{size.name}</p>
                            <p className={`text-[10px] font-bold ${selectedSize.id === size.id ? 'text-brand-red' : 'text-gray-400'}`}>
                              {size.dimensions}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Material Selection */}
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
                      <Layers size={14} /> Select Material
                    </p>
                    <div className="space-y-2">
                      {RECOMMENDATION_MATERIALS.map((material) => (
                        <button
                          key={material.id}
                          onClick={() => setSelectedMaterial(material)}
                          className={`w-full p-4 border-2 text-left transition-all flex items-center justify-between ${
                            selectedMaterial.id === material.id 
                              ? 'border-brand-black bg-brand-black text-white' 
                              : 'border-gray-200 bg-white hover:border-brand-red'
                          }`}
                        >
                          <div>
                            <p className="font-black text-sm uppercase">{material.name}</p>
                            <p className={`text-[10px] font-bold ${selectedMaterial.id === material.id ? 'text-gray-400' : 'text-gray-500'}`}>
                              {material.desc}
                            </p>
                          </div>
                          {material.price > 0 && (
                            <p className="font-mono text-xs font-bold">+₹{material.price}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t-2 border-gray-100 flex items-center justify-between gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Price</p>
                    <p className="text-4xl font-black text-brand-red leading-none">
                      ₹{((selectedSize?.price || 0) + (selectedMaterial?.price || 0))}
                    </p>
                  </div>
                  <RippleWrapper delay={2} className="flex-1">
                    <button 
                      onClick={handleQuickAdd}
                      className="w-full py-5 bg-brand-black text-white font-display text-2xl uppercase tracking-widest comic-border border-white hover:bg-brand-red transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none"
                    >
                      <ShoppingCart size={24} /> Add to Bag
                    </button>
                  </RippleWrapper>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

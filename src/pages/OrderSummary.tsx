import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, MapPin, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { RippleWrapper } from '../components/ui/RippleWrapper';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl, getStorefrontImage } from '../utils/imageUtils';
import { SHIPPING_CHARGE } from '../config/pricing';
import { getSizeDisplayLabel } from '../utils/sizeHelper';

export default function OrderSummary() {
  const { user } = useAuth();
  const { cartItems, clearCart, triggerNotification, couponDiscount, appliedCouponCode } = useCart();
  const navigate = useNavigate();
  
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const savedDetails = sessionStorage.getItem('checkout_details');
    if (!savedDetails || cartItems.length === 0) {
      navigate('/checkout');
      return;
    }
    setDetails(JSON.parse(savedDetails));
  }, [cartItems, navigate]);

  const selectedItems = cartItems.filter(item => item.selected);
  const subtotal = selectedItems.reduce((acc, item) => acc + (item.line_total || (item.price * item.quantity)), 0);

  const displayedSubtotal = subtotal;

  const netSubtotal = Math.max(0, subtotal - couponDiscount);
  const shipping = SHIPPING_CHARGE;
  const total = Math.max(0, netSubtotal + shipping);

  if (!details) return null;

  return (
    <div className="pt-32 pb-24 bg-brand-white dark:bg-[#0D0D0D] min-h-screen text-brand-black dark:text-zinc-100">
      <SEO metadata={getNonIndexableMetadata('Order Summary', '/order-summary')} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12"
        >
          <button 
            onClick={() => navigate('/checkout')}
            className="inline-flex items-center gap-2 text-brand-black dark:text-zinc-100 hover:text-brand-red transition-colors font-bold uppercase tracking-widest text-sm"
          >
            <ArrowLeft size={18} />
            Edit Checkout Details
          </button>
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter mt-4 text-brand-black dark:text-zinc-100">
            ORDER <span className="text-brand-red">SUMMARY</span>
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
          <div className="lg:col-span-7 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 p-8 text-brand-black dark:text-zinc-100"
            >
              <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-3 text-brand-black dark:text-zinc-100">
                <MapPin size={24} className="text-brand-red" /> Delivery Details
              </h2>
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-black uppercase text-gray-400 dark:text-zinc-400 block mb-1">Customer Name</span>
                  <p className="font-bold text-lg text-brand-black dark:text-zinc-100">{details.fullName}</p>
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-gray-400 dark:text-zinc-400 block mb-1">Contact Number</span>
                  <p className="font-bold text-lg text-brand-black dark:text-zinc-100">{details.contactNumber}</p>
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-gray-400 dark:text-zinc-400 block mb-1">Shipping Address</span>
                  <p className="font-bold text-lg leading-snug whitespace-pre-line text-brand-black dark:text-zinc-100">{details.address}</p>
                  {details.nearestLandmark && (
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Landmark: {details.nearestLandmark}</p>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 p-8 text-brand-black dark:text-zinc-100"
            >
              <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-3 text-brand-black dark:text-zinc-100">
                <Package size={24} className="text-brand-red" /> Selected Items ({selectedItems.length})
              </h2>
              <div className="divide-y-2 divide-gray-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto pr-2">
                {selectedItems.map((item, idx) => (
                  <div key={idx} className="py-4 flex gap-4 items-center first:pt-0 last:pb-0">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded overflow-hidden flex-shrink-0 border border-brand-black dark:border-zinc-700">
                      <img 
                        src={getStorefrontImage(item, 'thumbnail')} 
                        alt={item.name} 
                        width={80}
                        height={80}
                        loading="lazy"
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-black uppercase text-sm text-brand-black dark:text-zinc-100">{item.name}</h4>
                      <p className="text-xs text-gray-400 dark:text-zinc-400 font-bold uppercase mt-1">
                        {getSizeDisplayLabel(item.selected_size || item.size)} • {item.selected_material || item.material} • Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.isFreeItem ? (
                        <>
                          <span className="font-black text-green-600 dark:text-green-400 text-sm">FREE</span>
                          <span className="text-xs text-gray-400 dark:text-zinc-500 line-through block mt-0.5">
                            ₹{(item.unit_price || item.price) * item.quantity}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-black text-brand-red text-sm">₹{item.line_total || (item.price * item.quantity)}</span>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest block mt-0.5">
                            Unit: ₹{item.unit_price || item.price}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-brand-black text-white comic-border p-8 sticky top-32"
            >
              <h2 className="text-2xl font-black uppercase mb-8 border-b border-white/10 pb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-8 border-t border-white/10 pt-6">
                <div className="flex justify-between font-bold uppercase tracking-widest text-xs">
                  <span className="text-gray-400">Subtotal</span>
                  <span>₹{displayedSubtotal}</span>
                </div>
                 {appliedCouponCode && (
                  <div className="flex justify-between font-bold uppercase tracking-widest text-xs">
                    <span className="text-gray-400">Discount ({appliedCouponCode})</span>
                    <span className="text-green-400 font-bold">-₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold uppercase tracking-widest text-xs">
                  <span className="text-gray-400">Shipping</span>
                  <span>₹{SHIPPING_CHARGE}</span>
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                  <span className="text-lg font-black uppercase tracking-widest leading-none">Grand Total</span>
                  <span className="text-4xl font-black text-brand-red leading-none">₹{total}</span>
                </div>
              </div>

              <RippleWrapper delay={2} className="w-full">
                <button 
                  onClick={() => navigate('/payment')}
                  className="w-full py-5 bg-brand-red text-white font-display text-2xl uppercase tracking-widest comic-border border-white hover:bg-white hover:text-brand-black transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  Place Order <ArrowLeft size={24} className="rotate-180" />
                </button>
              </RippleWrapper>
              
              <p className="text-[10px] text-gray-500 font-bold text-center mt-6 uppercase tracking-widest">
                By placing order, you agree to our terms.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { RippleWrapper } from '../components/ui/RippleWrapper';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { SHIPPING_CHARGE } from '../config/pricing';

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
    <div className="pt-32 pb-24 bg-brand-white min-h-screen">
      <SEO metadata={getNonIndexableMetadata('Order Summary', '/order-summary')} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12"
        >
          <button 
            onClick={() => navigate('/checkout')}
            className="inline-flex items-center gap-2 text-brand-black hover:text-brand-red transition-colors font-bold uppercase tracking-widest text-sm"
          >
            <ArrowLeft size={18} />
            Back to Details
          </button>
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter mt-4">
            ORDER <span className="text-brand-red">SUMMARY</span>
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Details & Items */}
          <div className="lg:col-span-2 space-y-8">
            {/* Delivery Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white comic-border p-8"
            >
              <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-3">
                <ShoppingBag size={24} className="text-brand-red" /> Delivery Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Customer</p>
                  <p className="font-bold text-lg">{details.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Contact</p>
                  <p className="font-bold text-lg">{details.contactNumber}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Shipping Address</p>
                  <p className="font-bold text-lg">{details.address}</p>
                  {details.nearestLandmark && (
                    <p className="text-sm text-gray-500 mt-1">Landmark: {details.nearestLandmark}</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Selected Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white comic-border p-8"
            >
              <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-3">
                <ShoppingBag size={24} className="text-brand-red" /> Your Realm Selection
              </h2>
              <div className="space-y-6">
                {selectedItems.map((item) => (
                  <div key={item.id} className="flex gap-4 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                    <div className="w-16 h-16 bg-gray-100 rounded border border-brand-black flex-shrink-0 overflow-hidden">
                      <img 
                        src={getOptimizedImageUrl(item.image, 80, 80)} 
                        alt={item.name} 
                        width={80}
                        height={80}
                        loading="lazy"
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="flex-grow text-left">
                      <p className="font-black uppercase text-sm">{item.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {item.selected_size || item.size} • {item.selected_material || item.material} • Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.isFreeItem ? (
                        <>
                          <p className="font-black text-green-600">FREE</p>
                          <span className="text-xs text-gray-400 line-through block mt-0.5">
                            ₹{(item.unit_price || item.price) * item.quantity}
                          </span>
                        </>
                      ) : (
                        <p className="font-black text-brand-red">₹{item.line_total || (item.price * item.quantity)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Pricing & Payment */}
          <div className="lg:col-span-1">
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

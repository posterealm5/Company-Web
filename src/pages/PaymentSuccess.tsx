import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, ArrowRight, Loader2, MapPin, Calendar, CreditCard, ChevronRight } from 'lucide-react';
import { getOrderById } from '../services/orders';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl } from '../utils/imageUtils';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const orderId = location.state?.orderId;

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      try {
        const orderData = await getOrderById(Number(orderId));
        setOrder(orderData);
      } catch (err) {
        console.error("Failed to fetch order details:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="pt-32 pb-24 bg-brand-white min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-brand-red w-12 h-12 mb-4" />
        <p className="text-xl font-bold uppercase tracking-widest text-brand-black">Retrieving Order Details...</p>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 bg-brand-white min-h-screen">
      <SEO metadata={getNonIndexableMetadata('Payment Success', '/payment/success')} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Success Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="bg-green-100 border-2 border-green-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(34,197,94,1)]">
            <CheckCircle2 size={56} className="text-green-600" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter">
            ORDER <span className="text-green-600">CONFIRMED!</span>
          </h1>
          <p className="text-lg md:text-xl font-medium text-gray-600 mt-2 max-w-lg mx-auto">
            Victory! Your payment was secure, the signature verified, and your posters are ready for printing.
          </p>
        </motion.div>

        {/* Order Details Card */}
        {order ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white comic-border p-8 md:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-12 space-y-8"
          >
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-gray-100 pb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Order ID</p>
                <p className="text-lg font-black text-brand-black">#PR-{order.id}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date Placed</p>
                <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mt-0.5">
                  <Calendar size={14} className="text-brand-red" />
                  {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payment Status</p>
                <p className="text-sm font-bold text-green-600 flex items-center gap-1.5 mt-0.5">
                  <CreditCard size={14} className="text-green-600" />
                  Paid via Online
                </p>
              </div>
            </div>

            {/* Items Recap */}
            <div>
              <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                <ShoppingBag size={20} className="text-brand-red" /> Items Ordered
              </h3>
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex gap-4 items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <img 
                      src={getOptimizedImageUrl(item.image, 80, 80)} 
                      alt={item.name} 
                      width={64}
                      height={64}
                      loading="lazy"
                      className="w-14 h-14 object-cover comic-border" 
                    />
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-black uppercase truncate">{item.name}</p>
                      <p className="text-xs font-bold text-gray-400 uppercase mt-0.5">
                        {item.selected_size || item.size} • {item.selected_material || item.material} • Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.isFreeItem ? (
                        <span className="text-xs font-black text-green-600 uppercase">FREE</span>
                      ) : (
                        <p className="text-sm font-black">₹{item.line_total || (item.price * item.quantity)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Address & Invoice summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                  <MapPin size={16} className="text-brand-red" /> Shipping Address
                </h3>
                <p className="font-black text-sm text-gray-800">{order.customer_name}</p>
                <p className="text-xs font-bold text-gray-500 mt-1 leading-relaxed">{order.shipping_address}</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Phone: {order.customer_phone}</p>
              </div>

              <div className="bg-gray-50 comic-border p-5 space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase text-gray-500">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal}</span>
                </div>
                {order.discount_amount && (
                  <div className="flex justify-between text-xs font-bold uppercase text-green-600">
                    <span>Discount</span>
                    <span>-₹{order.discount_amount}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold uppercase text-gray-500">
                  <span>Shipping Fee</span>
                  <span>₹{order.shipping_charge}</span>
                </div>
                <div className="flex justify-between items-end pt-3 border-t border-gray-200 mt-2">
                  <span className="text-xs font-black uppercase">Grand Total</span>
                  <span className="text-2xl font-black text-brand-red">₹{order.total}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white comic-border p-10 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-12"
          >
            <p className="text-lg font-bold text-gray-600">We couldn't load the order details dynamically, but your payment was verified successfully.</p>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button 
            onClick={() => navigate('/collections')}
            className="flex-1 py-4 bg-white hover:bg-gray-50 font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 comic-border border-2 border-brand-black transition-colors"
          >
            Continue Shopping <ChevronRight size={16} />
          </button>
          
          <button 
            onClick={() => navigate('/orders')}
            className="flex-1 py-4 bg-brand-black text-white hover:bg-brand-red font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 comic-border border-2 border-white transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
          >
            View My Orders <ArrowRight size={16} />
          </button>
        </motion.div>

      </div>
    </div>
  );
}

import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Phone, MapPin, Mail, Landmark, 
  CreditCard, CheckCircle2, Loader2, Edit3, ShieldCheck,
  AlertCircle, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { createOrder, buildOrderFromCart, createRazorpayOrder, verifyRazorpayPayment, updateOrderStatus, getUserOrders, getOrderById } from '../services/orders';
import { incrementRedemptionCount } from '../services/coupons';
import { RippleWrapper } from '../components/ui/RippleWrapper';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { SHIPPING_CHARGE } from '../config/pricing';
import { checkCodEligibility } from '../config/payment';

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Helper to check if the cart items in the database order match the current selected cart items
function isSameCart(orderItems: any[], selectedCartItems: any[]) {
  if (!Array.isArray(orderItems) || orderItems.length !== selectedCartItems.length) {
    return false;
  }
  for (const cartItem of selectedCartItems) {
    const matchingOrderItem = orderItems.find(
      (oi: any) => 
        String(oi.product_id) === String(cartItem.id) &&
        String(oi.selected_size || oi.size) === String(cartItem.selected_size || cartItem.size) &&
        String(oi.selected_material || oi.material) === String(cartItem.selected_material || cartItem.material) &&
        Number(oi.quantity) === Number(cartItem.quantity)
    );
    if (!matchingOrderItem) return false;
  }
  return true;
}

export default function Payment() {
  const { user, profile } = useAuth();
  const { cartItems, clearCart, triggerNotification, couponDiscount, appliedCouponCode } = useCart();
  const navigate = useNavigate();
  
  const [details, setDetails] = useState<any>(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'ONLINE' | 'COD'>('ONLINE');

  const isEligibleForCod = details ? checkCodEligibility(details.address) : false;

  useEffect(() => {
    if (!isEligibleForCod && selectedMethod === 'COD') {
      setSelectedMethod('ONLINE');
    }
  }, [isEligibleForCod, selectedMethod]);

  const [addressForm, setAddressForm] = useState({
    fullName: '',
    contactNumber: '',
    address: '',
    nearestLandmark: '',
    email: ''
  });

  useEffect(() => {
    const savedDetails = sessionStorage.getItem('checkout_details');
    if (!savedDetails || cartItems.length === 0) {
      navigate('/checkout');
      return;
    }
    const parsed = JSON.parse(savedDetails);
    setDetails(parsed);
    setAddressForm(parsed);
  }, [cartItems, navigate]);

  const selectedItems = cartItems.filter(item => item.selected);
  const subtotal = selectedItems.reduce((acc, item) => acc + (item.line_total || (item.price * item.quantity)), 0);

  const displayedSubtotal = subtotal;

  const netSubtotal = Math.max(0, subtotal - couponDiscount);
  const shipping = SHIPPING_CHARGE;
  const total = Math.max(0, netSubtotal + shipping);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const processingRef = useRef(false);

  const handleOnlinePayment = async () => {
    // If a payment flow is already active, ignore subsequent clicks immediately
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    
    if (!razorpayKey) {
      triggerNotification("Razorpay Key ID is missing. Please check your configuration.");
      processingRef.current = false;
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Check if a pending order already exists for this checkout session / current cart
      let dbOrder = null;
      let rzpOrder = null;

      // Check for user-specific pending order matching current cart
      if (user?.id) {
        const userOrders = await getUserOrders(user.id);
        const matchingPendingOrder = userOrders.find((order: any) => {
          const isPending = order.status === 'pending';
          const isSame = isSameCart(order.items, selectedItems);
          const isNotExpired = new Date().getTime() - new Date(order.created_at).getTime() < 24 * 60 * 60 * 1000;
          return isPending && isSame && isNotExpired;
        });

        if (matchingPendingOrder) {
          dbOrder = matchingPendingOrder;
        }
      }

      // If not found (or guest checkout), check sessionStorage for pending order ID
      if (!dbOrder) {
        const pendingOrderIdStr = sessionStorage.getItem('pending_order_id');
        if (pendingOrderIdStr) {
          const pendingOrderId = Number(pendingOrderIdStr);
          if (!isNaN(pendingOrderId)) {
            const order = await getOrderById(pendingOrderId);
            if (order && order.status === 'pending') {
              const isSame = isSameCart(order.items, selectedItems);
              const isNotExpired = new Date().getTime() - new Date(order.created_at).getTime() < 24 * 60 * 60 * 1000;
              if (isSame && isNotExpired) {
                dbOrder = order;
              }
            }
          }
        }
      }

      if (dbOrder) {
        
        // Save back to sessionStorage in case it wasn't there
        sessionStorage.setItem('pending_order_id', dbOrder.id.toString());
        
        // Reuse Razorpay order if already exists on the recovered database order
        if (dbOrder.razorpay_order_id) {
          
          rzpOrder = {
            id: dbOrder.razorpay_order_id,
            amount: Math.round(dbOrder.total * 100),
            currency: 'INR'
          };
        }
      } else {
        // Build and create a new order in database
        const orderData = buildOrderFromCart(
          selectedItems.map(item => ({
            product_id: item.id,
            name: item.name,
            size: item.size,
            material: item.material,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            selected_size: item.selected_size || item.size,
            selected_material: item.selected_material || item.material,
            unit_price: item.unit_price || item.price,
            line_total: item.line_total || (item.price * item.quantity),
            width: item.width || null,
            height: item.height || null,
            area: item.area || null,
            custom_price: item.custom_price || null,
            isFreeItem: item.isFreeItem || null,
            couponCode: item.couponCode || appliedCouponCode || null
          }) as any),
          {
            name: addressForm.fullName,
            email: addressForm.email,
            phone: addressForm.contactNumber,
            address: `${addressForm.address}${addressForm.nearestLandmark ? ` (Landmark: ${addressForm.nearestLandmark})` : ''}`
          },
          subtotal,
          shipping,
          total,
          user?.id,
          {
            method: 'ONLINE',
            id: '',
            status: 'Pending'
          },
          'pending',
          appliedCouponCode,
          couponDiscount
        );

        dbOrder = await createOrder(orderData);
        if (!dbOrder) {
          throw new Error("Failed to create initial order");
        }
        sessionStorage.setItem('pending_order_id', dbOrder.id.toString());
      }

      // 2. Create Razorpay order if not reused
      if (!rzpOrder) {
        rzpOrder = await createRazorpayOrder(total, dbOrder.id.toString());
        if (!rzpOrder || !rzpOrder.id) {
          throw new Error("Failed to create Razorpay order");
        }
        // Locally set it so we have it in this closure
        dbOrder.razorpay_order_id = rzpOrder.id;
      }

      // 3. Load Razorpay SDK
      const res = await loadRazorpay();
      if (!res) {
        triggerNotification("Razorpay SDK failed to load. Are you online?");
        processingRef.current = false;
        setIsProcessing(false);
        return;
      }

      const options = {
        key: razorpayKey,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: 'Posterealm',
        description: 'Purchase Payment',
        order_id: rzpOrder.id,
        image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/assets/logo.png',
        handler: async function (response: any) {
          await handlePaymentSuccess(response, dbOrder.id);
        },
        modal: {
          ondismiss: function() {
            processingRef.current = false;
            setIsProcessing(false);
            updateOrderStatus(dbOrder.id, 'cancelled');
            triggerNotification("Payment cancelled. You can try again.");
          }
        },
        prefill: {
          name: addressForm.fullName,
          email: addressForm.email,
          contact: addressForm.contactNumber,
        },
        notes: {
          address: addressForm.address,
          order_id: dbOrder.id.toString()
        },
        theme: {
          color: '#FF0000',
        },
      };

      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        processingRef.current = false;
        setIsProcessing(false);
        updateOrderStatus(dbOrder.id, 'failed');
        triggerNotification(`Payment failed: ${response.error.description}`);
      });

      paymentObject.open();
    } catch (error: any) {
      console.error('Checkout error:', error);
      triggerNotification(error.message || "An error occurred during checkout.");
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleCodPayment = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    try {
      const orderData = buildOrderFromCart(
        selectedItems.map(item => ({
          product_id: item.id,
          name: item.name,
          size: item.size,
          material: item.material,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          selected_size: item.selected_size || item.size,
          selected_material: item.selected_material || item.material,
          unit_price: item.unit_price || item.price,
          line_total: item.line_total || (item.price * item.quantity),
          width: item.width || null,
          height: item.height || null,
          area: item.area || null,
          custom_price: item.custom_price || null,
          isFreeItem: item.isFreeItem || null,
          couponCode: item.couponCode || appliedCouponCode || null
        }) as any),
        {
          name: addressForm.fullName,
          email: addressForm.email,
          phone: addressForm.contactNumber,
          address: `${addressForm.address}${addressForm.nearestLandmark ? ` (Landmark: ${addressForm.nearestLandmark})` : ''}`
        },
        subtotal,
        shipping,
        total,
        user?.id,
        {
          method: 'COD',
          id: '',
          status: 'Pending'
        },
        'confirmed',
        appliedCouponCode,
        couponDiscount
      );

      const dbOrder = await createOrder(orderData);
      if (!dbOrder) {
        throw new Error("Failed to create COD order");
      }

      setIsSuccess(true);
      if (appliedCouponCode) {
        try {
          await incrementRedemptionCount(appliedCouponCode);
        } catch (err) {
          console.error("Failed to increment redemption count:", err);
        }
      }
      triggerNotification("Order placed successfully via Cash on Delivery!");
      sessionStorage.removeItem('checkout_details');
      sessionStorage.removeItem('pending_order_id');
      setTimeout(() => {
        clearCart();
        navigate('/orders');
      }, 3000);
    } catch (error: any) {
      console.error('COD placement error:', error);
      triggerNotification(error.message || "An error occurred while placing COD order.");
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  const handlePaymentSuccess = async (response: any, orderId: number) => {
    setIsProcessing(true);
    
    
    
    
    try {
      // Verify signature on backend
      
      const result = await verifyRazorpayPayment({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        order_id: orderId
      });

      

      if (result && result.success) {
        setIsSuccess(true);
        if (appliedCouponCode) {
          try {
            await incrementRedemptionCount(appliedCouponCode);
          } catch (err) {
            console.error("Failed to increment redemption count:", err);
          }
        }
        triggerNotification("Order placed successfully!");
        sessionStorage.removeItem('checkout_details');
        sessionStorage.removeItem('pending_order_id');
        setTimeout(() => {
          clearCart();
          navigate('/orders');
        }, 3000);
      } else {
        const errorMsg = result?.error || "Payment verification failed";
        console.error("%c[VERIFY] FAILED", "color: #ef4444; font-weight: bold;");
        console.error("Error Message:", errorMsg);
        if (result?.stack) {
          console.error("Backend Stack Trace:\n", result.stack);
        }
        await updateOrderStatus(orderId, 'failed');
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("%c[VERIFY] EXCEPTION", "color: #ef4444; font-weight: bold;");
      console.error("Full Exception Details:", error);
      triggerNotification(`Verification failed: ${error.message || "Please contact support"}`);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  const handleSaveAddress = () => {
    if (!addressForm.fullName || !addressForm.contactNumber || !addressForm.address || !addressForm.email) {
      triggerNotification("Please fill all required fields.");
      return;
    }
    setDetails(addressForm);
    sessionStorage.setItem('checkout_details', JSON.stringify(addressForm));
    setIsEditingAddress(false);
    triggerNotification("Address updated successfully!");
  };

  if (!details) return null;

  if (isSuccess) {
    return (
      <div className="pt-32 pb-24 bg-brand-white min-h-screen flex items-center justify-center">
        <SEO metadata={getNonIndexableMetadata('Payment Success', '/payment')} />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white comic-border p-12 max-w-xl w-full text-center shadow-2xl"
        >
          <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 size={64} className="text-green-600" />
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">Victory!</h1>
          <p className="text-xl text-gray-600 font-medium mb-8">
            Your payment was successful and your order is being processed. Redirecting to your realm...
          </p>
          <Loader2 className="animate-spin mx-auto text-brand-red w-8 h-8" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 bg-brand-white min-h-screen">
      <SEO metadata={getNonIndexableMetadata('Payment', '/payment')} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12"
        >
          <button 
            onClick={() => !isProcessing && navigate('/order-summary')}
            disabled={isProcessing}
            className={`inline-flex items-center gap-2 text-brand-black transition-colors font-bold uppercase tracking-widest text-sm ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:text-brand-red'}`}
          >
            <ArrowLeft size={18} />
            Back to Summary
          </button>
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter mt-4">
            CHECKOUT <span className="text-brand-red">PAYMENT</span>
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Main Sections */}
          <div className="lg:col-span-3 space-y-12">
            
            {/* Shipping To Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                  <MapPin size={28} className="text-brand-red" /> Shipping To
                </h2>
                {!isEditingAddress && (
                  <button 
                    onClick={() => !isProcessing && setIsEditingAddress(true)}
                    disabled={isProcessing}
                    className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-brand-black text-white px-4 py-2 transition-colors comic-border ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-red'}`}
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                {isEditingAddress ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white comic-border p-8 space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Full Name</label>
                        <input 
                          type="text" 
                          value={addressForm.fullName}
                          onChange={(e) => setAddressForm({...addressForm, fullName: e.target.value})}
                          className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Contact Number</label>
                        <input 
                          type="tel" 
                          value={addressForm.contactNumber}
                          onChange={(e) => setAddressForm({...addressForm, contactNumber: e.target.value})}
                          className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Email Address</label>
                        <input 
                          type="email" 
                          value={addressForm.email}
                          onChange={(e) => setAddressForm({...addressForm, email: e.target.value})}
                          className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Landmark</label>
                        <input 
                          type="text" 
                          value={addressForm.nearestLandmark}
                          onChange={(e) => setAddressForm({...addressForm, nearestLandmark: e.target.value})}
                          className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Shipping Address</label>
                      <textarea 
                        rows={3}
                        value={addressForm.address}
                        onChange={(e) => setAddressForm({...addressForm, address: e.target.value})}
                        className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red resize-none"
                      />
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          if (isProcessing) return;
                          setAddressForm(details);
                          setIsEditingAddress(false);
                        }}
                        disabled={isProcessing}
                        className="flex-1 py-3 font-black uppercase text-sm comic-border border-brand-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveAddress}
                        disabled={isProcessing}
                        className="flex-1 py-3 font-black uppercase text-sm bg-brand-black text-white hover:bg-brand-red transition-colors comic-border disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save Address
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-white comic-border p-8 shadow-sm group hover:shadow-md transition-shadow"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-gray-100 flex items-center justify-center comic-border shrink-0">
                          <User size={20} className="text-brand-red" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</p>
                          <p className="font-black text-lg">{details.fullName}</p>
                          <p className="text-xs font-bold text-gray-500">{details.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-gray-100 flex items-center justify-center comic-border shrink-0">
                          <Phone size={20} className="text-brand-red" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contact</p>
                          <p className="font-black text-lg">{details.contactNumber}</p>
                        </div>
                      </div>
                      <div className="md:col-span-2 flex gap-4 border-t border-gray-100 pt-6">
                        <div className="w-10 h-10 bg-gray-100 flex items-center justify-center comic-border shrink-0">
                          <MapPin size={20} className="text-brand-red" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Address</p>
                          <p className="font-bold leading-snug">{details.address}</p>
                          {details.nearestLandmark && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <Landmark size={12} className="text-brand-red" />
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Near {details.nearestLandmark}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Mode for Payment Section */}
            <section>
              <h2 className="text-3xl font-black uppercase tracking-tight mb-6 flex items-center gap-3">
                <CreditCard size={28} className="text-brand-red" /> Mode for Payment
              </h2>

              <div className="space-y-4">
                {/* Online Payment Option */}
                <div 
                  onClick={() => !isProcessing && setSelectedMethod('ONLINE')}
                  className={`bg-white comic-border p-6 flex items-center gap-6 transition-all relative overflow-hidden border-2 ${
                    selectedMethod === 'ONLINE' ? 'border-brand-red shadow-[4px_4px_0px_0px_rgba(230,57,70,1)]' : 'border-brand-black/10'
                  } ${isProcessing ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer group hover:border-brand-red active:scale-[0.99]'}`}
                >
                  <div className="absolute top-0 right-0 bg-brand-red text-white text-[8px] font-black px-3 py-1 uppercase tracking-widest transform rotate-45 translate-x-3 translate-y-1">
                    Secure
                  </div>
                  <div className="flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      checked={selectedMethod === 'ONLINE'}
                      onChange={() => {}}
                      className="accent-brand-red w-5 h-5 cursor-pointer"
                    />
                  </div>
                  <div className="w-12 h-12 bg-brand-red/10 flex items-center justify-center comic-border border-brand-red group-hover:bg-brand-red group-hover:text-white transition-colors shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black uppercase">Online Payment</h3>
                      <span className="text-[8px] font-black bg-brand-black text-white px-2 py-0.5 uppercase tracking-widest rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Razorpay • UPI • Cards • Netbanking</p>
                  </div>
                </div>

                {/* Cash on Delivery Option */}
                <div 
                  onClick={() => {
                    if (isEligibleForCod && !isProcessing) {
                      setSelectedMethod('COD');
                    }
                  }}
                  className={`p-6 flex items-center gap-6 transition-all relative overflow-hidden border-2 ${
                    isEligibleForCod 
                      ? selectedMethod === 'COD' 
                        ? 'bg-white border-brand-red shadow-[4px_4px_0px_0px_rgba(230,57,70,1)] cursor-pointer group hover:border-brand-red active:scale-[0.99]' 
                        : 'bg-white border-brand-black/10 cursor-pointer group hover:border-brand-red active:scale-[0.99]'
                      : 'bg-gray-50 border-gray-200 opacity-55 cursor-not-allowed select-none'
                  } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      checked={selectedMethod === 'COD'}
                      disabled={!isEligibleForCod}
                      onChange={() => {
                        if (isEligibleForCod && !isProcessing) {
                          setSelectedMethod('COD');
                        }
                      }}
                      className={`w-5 h-5 ${isEligibleForCod ? 'accent-brand-red cursor-pointer' : 'accent-gray-400 cursor-not-allowed'}`}
                    />
                  </div>
                  <div className={`w-12 h-12 flex items-center justify-center comic-border transition-colors shrink-0 ${
                    isEligibleForCod 
                      ? 'bg-gray-100 border-gray-300 group-hover:bg-brand-red group-hover:text-white' 
                      : 'bg-gray-200 border-gray-300 text-gray-400'
                  }`}>
                    <Landmark size={24} />
                  </div>
                  <div className="flex-grow">
                    <h3 className={`text-xl font-black uppercase ${isEligibleForCod ? 'text-brand-black' : 'text-gray-400'}`}>
                      Cash on Delivery
                    </h3>
                    {isEligibleForCod ? (
                      <div className="text-left mt-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                          Available only for deliveries within Udaipur, Rajasthan.
                        </p>
                        <p className="text-[10px] font-black text-brand-red uppercase tracking-wider mt-1">
                          Please keep the exact order amount ready at the time of delivery.
                        </p>
                      </div>
                    ) : (
                      <div className="text-left mt-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                          Currently unavailable at your provided address.
                        </p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-1">
                          We are sorry for the inconvenience.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8">
                <button
                  onClick={selectedMethod === 'ONLINE' ? handleOnlinePayment : handleCodPayment}
                  disabled={isProcessing}
                  className="w-full py-5 text-white font-display text-2xl uppercase tracking-widest bg-brand-black hover:bg-brand-red transition-all flex items-center justify-center gap-3 active:scale-95 comic-border border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      Processing... <Loader2 className="animate-spin" size={24} />
                    </>
                  ) : selectedMethod === 'ONLINE' ? (
                    <>
                      Pay Online via Razorpay <CreditCard size={24} />
                    </>
                  ) : (
                    <>
                      Confirm COD Order <CheckCircle2 size={24} />
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* Right Sidebar - Order Recap */}
          <div className="lg:col-span-2">
            <div className="sticky top-32 space-y-6">
              <div className="bg-brand-black text-white comic-border p-8">
                <h3 className="text-xl font-black uppercase border-b border-white/10 pb-4 mb-6 flex items-center gap-2">
                  <Loader2 size={18} className={isProcessing ? "animate-spin" : "hidden"} />
                  Final Recap
                </h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between font-bold uppercase tracking-widest text-[10px]">
                    <span className="text-gray-400">Items ({selectedItems.length})</span>
                    <span>₹{displayedSubtotal}</span>
                  </div>
                  {appliedCouponCode && (
                    <div className="flex justify-between font-bold uppercase tracking-widest text-[10px]">
                      <span className="text-gray-400">Discount ({appliedCouponCode})</span>
                      <span className="text-green-400 font-bold">-₹{couponDiscount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold uppercase tracking-widest text-[10px]">
                    <span className="text-gray-400">Shipping Fee</span>
                    <span>₹{SHIPPING_CHARGE}</span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t border-white/10">
                    <span className="text-sm font-black uppercase tracking-widest">Grand Total</span>
                    <span className="text-3xl font-black text-brand-red">₹{total}</span>
                  </div>
                </div>

                <div className="bg-white/5 comic-border border-white/10 p-4 mb-8">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Selected Items</p>
                  <div className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="flex gap-3 items-center">
                        <img 
                          src={getOptimizedImageUrl(item.image, 80, 80)} 
                          alt={item.name} 
                          width={80}
                          height={80}
                          loading="lazy"
                          className="w-10 h-10 object-cover comic-border border-white/20" 
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                          <p className="text-[8px] font-bold text-gray-500 uppercase">{item.selected_size || item.size} • Qty: {item.quantity}</p>
                        </div>
                        {item.isFreeItem ? (
                          <div className="text-right">
                            <p className="text-[10px] font-black text-green-400">FREE</p>
                            <span className="text-[9px] font-bold text-gray-500 line-through block mt-0.5">
                              ₹{(item.unit_price || item.price) * item.quantity}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] font-black">₹{item.line_total || (item.price * item.quantity)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-brand-red">
                  <ShieldCheck size={20} />
                  <p className="text-[10px] font-black uppercase tracking-widest">SSL Encrypted Payment</p>
                </div>
              </div>

              <div className="bg-white comic-border p-6 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Need Help?</p>
                <p className="text-sm font-black uppercase">posterealm5@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

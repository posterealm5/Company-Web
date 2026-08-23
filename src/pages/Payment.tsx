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
import { createOrder, buildOrderFromCart, createRazorpayOrder, verifyRazorpayPayment } from '../services/orders';
import { incrementRedemptionCount } from '../services/coupons';
import { RippleWrapper } from '../components/ui/RippleWrapper';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl, getStorefrontImage } from '../utils/imageUtils';
import { SHIPPING_CHARGE } from '../config/pricing';
import { checkCodEligibility } from '../config/payment';

declare global {
  interface Window {
    Razorpay: any;
  }
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
      const itemsPayload = selectedItems.map(item => ({
        id: item.id,
        name: item.name,
        size: item.selected_size || item.size,
        material: item.selected_material || item.material,
        price: item.unit_price || item.price,
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
      }));

      const customerInfo = {
        name: addressForm.fullName,
        email: addressForm.email,
        phone: addressForm.contactNumber,
        address: `${addressForm.address}${addressForm.nearestLandmark ? ` (Landmark: ${addressForm.nearestLandmark})` : ''}`
      };

      // 1. Create Razorpay order on backend (does not insert order to DB yet)
      const rzpOrder = await createRazorpayOrder({
        cartItems: itemsPayload,
        couponCode: appliedCouponCode,
        customerInfo,
        userId: user?.id || null
      });

      if (!rzpOrder || !rzpOrder.id) {
        throw new Error("Failed to create Razorpay order");
      }

      // 2. Load Razorpay SDK
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
          await handlePaymentSuccess(response, itemsPayload, customerInfo);
        },
        modal: {
          ondismiss: function() {
            processingRef.current = false;
            setIsProcessing(false);
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

  const handlePaymentSuccess = async (response: any, itemsPayload: any[], customerInfo: any) => {
    setIsProcessing(true);
    try {
      // Verify signature on backend and create database order
      const result = await verifyRazorpayPayment({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        cartItems: itemsPayload,
        customerInfo: customerInfo,
        couponCode: appliedCouponCode,
        userId: user?.id || null
      });

      if (result && result.success) {
        setIsSuccess(true);
        triggerNotification("Order placed successfully!");
        sessionStorage.removeItem('checkout_details');
        clearCart();
        navigate('/payment/success', { state: { orderId: result.order_id } });
      } else {
        const errorMsg = result?.error || "Payment verification failed";
        console.error("Payment verification failed:", errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Payment verification exception:", error);
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
      <div className="pt-32 pb-24 bg-brand-white dark:bg-[#0D0D0D] min-h-screen flex items-center justify-center">
        <SEO metadata={getNonIndexableMetadata('Payment Success', '/payment')} />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 p-12 max-w-xl w-full text-center shadow-2xl text-brand-black dark:text-zinc-100"
        >
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6 animate-bounce" />
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2 text-brand-black dark:text-zinc-100">ORDER PLACED!</h1>
          <p className="text-gray-600 dark:text-zinc-300 font-bold uppercase tracking-wider text-xs mb-8">
            Thank you for your order. We are preparing your posters!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/account/orders')}
              className="px-6 py-4 bg-brand-black dark:bg-zinc-800 text-white font-black uppercase tracking-widest text-xs comic-border hover:bg-brand-red dark:hover:bg-brand-red transition-all"
            >
              View My Orders
            </button>
            <button
              onClick={() => navigate('/collections')}
              className="px-6 py-4 bg-white dark:bg-zinc-800 text-brand-black dark:text-zinc-100 font-black uppercase tracking-widest text-xs comic-border border-brand-black dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all"
            >
              Continue Shopping
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 bg-brand-white dark:bg-[#0D0D0D] min-h-screen text-brand-black dark:text-zinc-100">
      <SEO metadata={getNonIndexableMetadata('Payment', '/payment')} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12"
        >
          <button 
            onClick={() => navigate('/order-summary')}
            disabled={isProcessing}
            className={`inline-flex items-center gap-2 text-brand-black dark:text-zinc-100 transition-colors font-bold uppercase tracking-widest text-sm ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:text-brand-red'
            }`}
          >
            <ArrowLeft size={18} />
            Back to Summary
          </button>
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter mt-4 text-brand-black dark:text-zinc-100">
            CHECKOUT <span className="text-brand-red">PAYMENT</span>
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
          
          {/* Left Column: Address Edit & Payment Options */}
          <div className="lg:col-span-7 space-y-8">

            {/* Shipping Address Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3 text-brand-black dark:text-zinc-100">
                  <MapPin className="text-brand-red shrink-0" size={28} /> Shipping To
                </h2>
                {!isEditingAddress && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(true)}
                    disabled={isProcessing}
                    className="text-xs font-black uppercase tracking-widest bg-brand-black dark:bg-zinc-800 text-white px-4 py-2 hover:bg-brand-red dark:hover:bg-brand-red transition-colors comic-border border-brand-black dark:border-zinc-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                {isEditingAddress ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 p-8 shadow-sm space-y-4 text-brand-black dark:text-zinc-100"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">Full Name</label>
                        <input 
                          type="text" 
                          value={addressForm.fullName}
                          onChange={(e) => setAddressForm({...addressForm, fullName: e.target.value})}
                          className="w-full p-3 bg-gray-50 dark:bg-zinc-800 comic-border border-2 border-brand-black dark:border-zinc-700 text-sm font-bold text-brand-black dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">Contact Number</label>
                        <input 
                          type="text" 
                          value={addressForm.contactNumber}
                          onChange={(e) => setAddressForm({...addressForm, contactNumber: e.target.value})}
                          className="w-full p-3 bg-gray-50 dark:bg-zinc-800 comic-border border-2 border-brand-black dark:border-zinc-700 text-sm font-bold text-brand-black dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">Email Address</label>
                        <input 
                          type="email" 
                          value={addressForm.email}
                          onChange={(e) => setAddressForm({...addressForm, email: e.target.value})}
                          className="w-full p-3 bg-gray-50 dark:bg-zinc-800 comic-border border-2 border-brand-black dark:border-zinc-700 text-sm font-bold text-brand-black dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">Landmark</label>
                        <input 
                          type="text" 
                          value={addressForm.nearestLandmark}
                          onChange={(e) => setAddressForm({...addressForm, nearestLandmark: e.target.value})}
                          className="w-full p-3 bg-gray-50 dark:bg-zinc-800 comic-border border-2 border-brand-black dark:border-zinc-700 text-sm font-bold text-brand-black dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">Shipping Address</label>
                      <textarea 
                        rows={3}
                        value={addressForm.address}
                        onChange={(e) => setAddressForm({...addressForm, address: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-zinc-800 comic-border border-2 border-brand-black dark:border-zinc-700 text-sm font-bold text-brand-black dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-red resize-none"
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
                        className="flex-1 py-3 font-black uppercase text-sm comic-border border-2 border-brand-black dark:border-zinc-700 bg-white dark:bg-zinc-800 text-brand-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveAddress}
                        disabled={isProcessing}
                        className="flex-1 py-3 font-black uppercase text-sm bg-brand-black dark:bg-zinc-800 text-white hover:bg-brand-red dark:hover:bg-brand-red transition-colors comic-border border-2 border-brand-black dark:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 p-8 shadow-sm group hover:shadow-md transition-shadow text-brand-black dark:text-zinc-100"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center comic-border border-gray-200 dark:border-zinc-700 shrink-0">
                          <User size={20} className="text-brand-red" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-400">Customer</p>
                          <p className="font-black text-lg text-brand-black dark:text-zinc-100">{details.fullName}</p>
                          <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">{details.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center comic-border border-gray-200 dark:border-zinc-700 shrink-0">
                          <Phone size={20} className="text-brand-red" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-400">Contact</p>
                          <p className="font-black text-lg text-brand-black dark:text-zinc-100">{details.contactNumber}</p>
                        </div>
                      </div>
                      <div className="md:col-span-2 flex gap-4 border-t border-gray-100 dark:border-zinc-800 pt-6">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center comic-border border-gray-200 dark:border-zinc-700 shrink-0">
                          <MapPin size={20} className="text-brand-red" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-400">Address</p>
                          <p className="font-bold leading-snug text-brand-black dark:text-zinc-100">{details.address}</p>
                          {details.nearestLandmark && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <Landmark size={12} className="text-brand-red" />
                              <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Near {details.nearestLandmark}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mode for Payment Section */}
            <section>
              <h2 className="text-3xl font-black uppercase tracking-tight mb-6 flex items-center gap-3 text-brand-black dark:text-zinc-100">
                <CreditCard size={28} className="text-brand-red" /> Mode for Payment
              </h2>

              <div className="space-y-4">
                {/* Online Payment Option */}
                <div 
                  onClick={() => !isProcessing && setSelectedMethod('ONLINE')}
                  className={`bg-white dark:bg-zinc-900 comic-border p-6 flex items-center gap-6 transition-all relative overflow-hidden border-2 ${
                    selectedMethod === 'ONLINE' ? 'border-brand-red shadow-[4px_4px_0px_0px_rgba(230,57,70,1)]' : 'border-brand-black/10 dark:border-zinc-700'
                  } ${isProcessing ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer group hover:border-brand-red active:scale-[0.99]'} text-brand-black dark:text-zinc-100`}
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
                  <div className="w-12 h-12 bg-brand-red/10 dark:bg-brand-red/20 text-brand-red flex items-center justify-center comic-border border-brand-red group-hover:bg-brand-red group-hover:text-white transition-colors shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black uppercase text-brand-black dark:text-zinc-100">Online Payment</h3>
                      <span className="text-[8px] font-black bg-brand-black dark:bg-zinc-800 text-white px-2 py-0.5 uppercase tracking-widest rounded comic-border border-brand-black dark:border-zinc-700">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest mt-1">Razorpay • UPI • Cards • Netbanking</p>
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
                        ? 'bg-white dark:bg-zinc-900 border-brand-red shadow-[4px_4px_0px_0px_rgba(230,57,70,1)] cursor-pointer group hover:border-brand-red active:scale-[0.99]' 
                        : 'bg-white dark:bg-zinc-900 border-brand-black/10 dark:border-zinc-700 cursor-pointer group hover:border-brand-red active:scale-[0.99]'
                      : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 opacity-55 cursor-not-allowed select-none'
                  } ${isProcessing ? 'opacity-50 pointer-events-none' : ''} text-brand-black dark:text-zinc-100`}
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
                      ? 'bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-brand-black dark:text-zinc-100 group-hover:bg-brand-red group-hover:text-white' 
                      : 'bg-gray-200 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500'
                  }`}>
                    <Landmark size={24} />
                  </div>
                  <div className="flex-grow">
                    <h3 className={`text-xl font-black uppercase ${isEligibleForCod ? 'text-brand-black dark:text-zinc-100' : 'text-gray-400 dark:text-zinc-500'}`}>
                      Cash on Delivery
                    </h3>
                    {isEligibleForCod ? (
                      <div className="text-left mt-1">
                        <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">
                          Available only for deliveries within Udaipur, Rajasthan.
                        </p>
                        <p className="text-[10px] font-black text-brand-red uppercase tracking-wider mt-1">
                          Please keep the exact order amount ready at the time of delivery.
                        </p>
                      </div>
                    ) : (
                      <div className="text-left mt-1">
                        <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                          Currently unavailable at your provided address.
                        </p>
                        <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mt-1">
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
                  className="w-full py-5 text-white font-display text-2xl uppercase tracking-widest bg-brand-black dark:bg-zinc-800 hover:bg-brand-red dark:hover:bg-brand-red transition-all flex items-center justify-center gap-3 active:scale-95 comic-border border-2 border-brand-black dark:border-zinc-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          <div className="lg:col-span-5">
            <div className="sticky top-32 space-y-6">
              <div className="bg-brand-black dark:bg-zinc-900 text-white comic-border border-2 border-brand-black dark:border-zinc-700 p-8">
                <h3 className="text-xl font-black uppercase border-b border-white/10 dark:border-zinc-700 pb-4 mb-6 flex items-center gap-2 text-white dark:text-zinc-100">
                  <Loader2 size={18} className={isProcessing ? "animate-spin" : "hidden"} />
                  Final Recap
                </h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between font-bold uppercase tracking-widest text-[10px]">
                    <span className="text-gray-400 dark:text-zinc-400">Items ({selectedItems.length})</span>
                    <span className="text-white dark:text-zinc-100">₹{displayedSubtotal}</span>
                  </div>
                  {appliedCouponCode && (
                    <div className="flex justify-between font-bold uppercase tracking-widest text-[10px]">
                      <span className="text-gray-400 dark:text-zinc-400">Discount ({appliedCouponCode})</span>
                      <span className="text-green-400 font-bold">-₹{couponDiscount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold uppercase tracking-widest text-[10px]">
                    <span className="text-gray-400 dark:text-zinc-400">Shipping Fee</span>
                    <span className="text-white dark:text-zinc-100">₹{SHIPPING_CHARGE}</span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t border-white/10 dark:border-zinc-700">
                    <span className="text-sm font-black uppercase tracking-widest text-white dark:text-zinc-100">Grand Total</span>
                    <span className="text-3xl font-black text-brand-red">₹{total}</span>
                  </div>
                </div>

                <div className="bg-white/5 dark:bg-zinc-800/60 comic-border border-white/10 dark:border-zinc-700 p-4 mb-8">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-2">Selected Items</p>
                  <div className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="flex gap-3 items-center">
                        <img 
                          src={getStorefrontImage(item, 'thumbnail')} 
                          alt={item.name} 
                          width={80}
                          height={80}
                          loading="lazy"
                          className="w-10 h-10 object-cover comic-border border-white/20 dark:border-zinc-700" 
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-[10px] font-black uppercase truncate text-white dark:text-zinc-100">{item.name}</p>
                          <p className="text-[8px] font-bold text-gray-400 dark:text-zinc-400 uppercase">{item.selected_size || item.size} • Qty: {item.quantity}</p>
                        </div>
                        {item.isFreeItem ? (
                          <div className="text-right">
                            <p className="text-[10px] font-black text-green-400">FREE</p>
                            <span className="text-[9px] font-bold text-gray-400 line-through block mt-0.5">
                              ₹{(item.unit_price || item.price) * item.quantity}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] font-black text-white dark:text-zinc-100">₹{item.line_total || (item.price * item.quantity)}</p>
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

              <div className="bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 p-6 text-center text-brand-black dark:text-zinc-100">
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-widest mb-2">Need Help?</p>
                <p className="text-sm font-black uppercase text-brand-black dark:text-zinc-100">posterealm5@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

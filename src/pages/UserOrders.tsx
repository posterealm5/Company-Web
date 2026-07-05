import React, { useState, useEffect, useRef } from 'react';
import { Package, ArrowLeft, Loader2, Calendar, MapPin, Copy, CheckCircle2, Clock, Truck, XCircle, AlertCircle, Download } from 'lucide-react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { getUserOrders, getOrderById, cancelOrderByCustomer } from '../services/orders';
import type { Order } from '../types/database';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { downloadInvoice } from '../utils/invoiceGenerator';

const Timeline: React.FC<{ status: string; deliveryMethod?: 'local' | 'courier' }> = ({ status, deliveryMethod = 'courier' }) => {
  const steps = deliveryMethod === 'local'
    ? [
        { label: 'Confirmed', active: ['confirmed', 'processing', 'out_for_delivery', 'delivered'].includes(status), current: status === 'confirmed' },
        { label: 'Processing', active: ['processing', 'out_for_delivery', 'delivered'].includes(status), current: status === 'processing' },
        { label: 'Out For Delivery', active: ['out_for_delivery', 'delivered'].includes(status), current: status === 'out_for_delivery' },
        { label: 'Delivered', active: status === 'delivered', current: status === 'delivered' }
      ]
    : [
        { label: 'Confirmed', active: ['confirmed', 'processing', 'shipped', 'delivered'].includes(status), current: status === 'confirmed' },
        { label: 'Processing', active: ['processing', 'shipped', 'delivered'].includes(status), current: status === 'processing' },
        { label: 'Shipped', active: ['shipped', 'delivered'].includes(status), current: status === 'shipped' },
        { label: 'Delivered', active: status === 'delivered', current: status === 'delivered' }
      ];

  if (status === 'cancelled' || status === 'failed') {
    return (
      <div className="bg-brand-red/10 border-2 border-brand-red p-6 text-center comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <p className="font-black text-brand-red uppercase tracking-widest text-sm">
          Order {status === 'cancelled' ? 'Cancelled' : 'Failed'}
        </p>
        <p className="text-xs text-gray-500 font-bold uppercase mt-1">This order is no longer active.</p>
      </div>
    );
  }

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between w-full relative">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center flex-1 relative z-10">
              <motion.div 
                animate={step.current ? { scale: [1, 1.12, 1] } : {}}
                transition={step.current ? { repeat: Infinity, duration: 2 } : {}}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm comic-border border-2 transition-all duration-500 ${
                  step.active 
                    ? 'bg-brand-red text-white border-brand-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                    : 'bg-white text-gray-300 border-gray-200'
                } ${step.current ? 'ring-4 ring-brand-red/30' : ''}`}
              >
                {step.active ? '✓' : idx + 1}
              </motion.div>
              <span className={`text-[9px] font-black uppercase tracking-wider mt-3 text-center transition-colors duration-500 max-w-[80px] leading-tight ${
                step.active ? 'text-brand-black' : 'text-gray-300'
              } ${step.current ? 'text-brand-red font-black' : ''}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className="absolute top-5 left-0 right-0 h-1 -z-0 flex items-center" style={{ left: `${(idx * 2 + 1) * 12.5}%`, right: `${100 - ((idx + 1) * 2 + 1) * 12.5}%` }}>
                <div className={`h-1 w-full transition-all duration-1000 ${
                  steps[idx + 1].active ? 'bg-brand-black' : 'bg-gray-200'
                }`} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default function UserOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [singleOrder, setSingleOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; message?: string } | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBackToOrders = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/account/orders', { replace: true });
    }
  };

  

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (title: string, message?: string, duration: number = 2500) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage({ title, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, duration);
  };

  const handleCancelOrder = async (orderId: number) => {
    setCancelling(true);
    try {
      const response = await cancelOrderByCustomer(orderId);
      if (response.success && response.data) {
        showToast(
          "ORDER CANCELLED",
          "We've received your cancellation request. Your refund has been initiated and is expected to be credited to your original payment method within 3–4 business days.",
          6000
        );
        // If single order view, update singleOrder status
        if (singleOrder && singleOrder.id === orderId) {
          setSingleOrder(response.data);
        }
        // Update orders list status
        setOrders(prev => prev.map(o => o.id === orderId && response.data ? response.data : o));
      } else {
        showToast(response.error || "Failed to cancel order.");
      }
    } catch (err: any) {
      console.error("Error in handleCancelOrder:", err);
      showToast("An unexpected error occurred.");
    } finally {
      setCancelling(false);
      setOrderToCancel(null);
    }
  };

  const handleCopyTracking = (trackingNum: string) => {
    navigator.clipboard.writeText(trackingNum);
    showToast("Tracking number copied");
  };

  const getTrackingLink = (courier: string, trackingNumber: string): string => {
    const cleanCourier = courier.toLowerCase().trim();
    const cleanTracking = trackingNumber.trim();
    
    if (cleanCourier.includes('delhivery')) {
      return `https://www.delhivery.com/track/package/${cleanTracking}`;
    }
    if (cleanCourier.includes('dtdc')) {
      return `https://www.dtdc.in/tracking/tracking_results.asp?keyword=${cleanTracking}`;
    }
    if (cleanCourier.includes('blue dart') || cleanCourier.includes('bluedart')) {
      return `https://main.bluedart.com/CourierTracking?handler=myhandler&keyNo=${cleanTracking}`;
    }
    
    if (cleanCourier.startsWith('http://') || cleanCourier.startsWith('https://')) {
      return cleanCourier;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(courier + ' tracking ' + trackingNumber)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered': return { icon: <CheckCircle2 size={12} />, color: 'bg-green-50 text-green-700 border-green-200', label: 'Delivered' };
      case 'shipped': return { icon: <Truck size={12} />, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Shipped' };
      case 'out_for_delivery': return { icon: <Truck size={12} />, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Out For Delivery' };
      case 'processing': return { icon: <Clock size={12} />, color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Processing' };
      case 'confirmed': return { icon: <CheckCircle2 size={12} />, color: 'bg-green-50 text-green-700 border-green-200', label: 'Confirmed' };
      case 'cancelled': return { icon: <XCircle size={12} />, color: 'bg-red-600 text-white border-red-700 font-black', label: 'CANCELLED' };
      case 'failed': return { icon: <AlertCircle size={12} />, color: 'bg-red-50 text-red-700 border-red-200', label: 'Failed' };
      default: return { icon: <Clock size={12} />, color: 'bg-gray-50 text-gray-500 border-gray-200', label: 'Pending' };
    }
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setErrorState(null);
      
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        if (id) {
          const orderIdNum = Number(id);
          if (isNaN(orderIdNum)) {
            setErrorState("Invalid Order ID format.");
            setLoading(false);
            return;
          }
          
          const order = await getOrderById(orderIdNum);
          if (!order) {
            setErrorState("Order not found.");
          } else if (order.user_id !== user.id) {
            setErrorState("Access Denied: You do not have permission to view this order.");
          } else {
            setSingleOrder(order);
          }
        } else {
          const data = await getUserOrders(user.id);
          setOrders(data);
        }
      } catch (err: any) {
        console.error("Error fetching orders:", err);
        setErrorState("Failed to load order data. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, id]);

  if (loading) {
    return (
      <div className="pt-32 pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[80vh] space-y-8">
        <SEO metadata={getNonIndexableMetadata('My Orders', location.pathname)} />
        <div className="h-10 w-48 bg-gray-200 animate-pulse comic-border mb-4" />
        <div className="h-16 w-full bg-gray-200 animate-pulse comic-border mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="h-64 bg-gray-200 animate-pulse comic-border" />
            <div className="h-48 bg-gray-200 animate-pulse comic-border" />
          </div>
          <div className="space-y-6">
            <div className="h-96 bg-gray-200 animate-pulse comic-border" />
          </div>
        </div>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="pt-32 pb-24 max-w-xl mx-auto px-4 min-h-[70vh] flex flex-col items-center justify-center text-center">
        <SEO metadata={getNonIndexableMetadata('My Orders', location.pathname)} />
        <div className="bg-white comic-border p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-full flex items-center justify-center mx-auto border-2 border-brand-black">
            <Package size={32} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-brand-black">
            {errorState.includes("Denied") ? "Access Denied" : "Error"}
          </h2>
          <p className="text-gray-600 font-bold uppercase text-xs tracking-wider leading-relaxed">
            {errorState}
          </p>
          <button
            onClick={() => {
              setErrorState(null);
              setSingleOrder(null);
              navigate('/account/orders', { replace: true });
            }}
            className="inline-block bg-brand-black text-white font-black uppercase text-xs tracking-widest px-6 py-3 comic-border hover:bg-brand-red transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // MODE B: Single Order View
  if (id && singleOrder) {
    const badge = getStatusBadge(singleOrder.status);
    return (
      <div className="pt-32 pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[75vh]">
        <SEO metadata={getNonIndexableMetadata('My Orders', location.pathname)} />
        {/* Back navigation */}
        <div className="text-left mb-8">
          <button
            onClick={handleBackToOrders}
            className="inline-flex items-center gap-2 px-4 py-2 border-2 border-brand-black bg-white hover:bg-gray-50 font-black uppercase text-xs tracking-widest comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft size={16} /> Back to My Orders
          </button>
        </div>

        {/* Order Heading Card */}
        <div className="bg-white comic-border p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8 text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Order Reference</p>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mt-1">
                Order #{singleOrder.id.toString().padStart(6, '0')}
              </h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">
                Placed: {new Date(singleOrder.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Grand Total</p>
                <p className="text-2xl font-black text-brand-red mt-0.5">₹{singleOrder.total}</p>
              </div>
              <div className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-2 comic-border ${badge.color} flex items-center gap-2`}>
                {badge.icon}
                {badge.label}
              </div>
              <button
                onClick={() => downloadInvoice(singleOrder)}
                className="px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-brand-black bg-white text-brand-black hover:bg-brand-red hover:text-white hover:border-brand-black transition-all comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-1.5"
              >
                <Download size={13} />
                Download Invoice
              </button>
              {['pending', 'confirmed'].includes(singleOrder.status) && (
                <button
                  onClick={() => {
                    
                    setOrderToCancel(singleOrder);
                  }}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-brand-red bg-white text-brand-red hover:bg-brand-red hover:text-white hover:border-brand-black transition-all comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          {/* Left Column: Timeline, Delivery & Address */}
          <div className="space-y-8">
            {/* Visual Timeline Box */}
            <div className="bg-white comic-border p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-red border-b-2 border-gray-100 pb-2">
                Delivery Timeline
              </h3>
              <Timeline status={singleOrder.status} deliveryMethod={singleOrder.delivery_method || 'courier'} />
            </div>

            {/* Delivery Information Info Box */}
            <div className="bg-white comic-border p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <div className="flex justify-between items-center border-b-2 border-gray-100 pb-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-brand-red">
                  Delivery Details
                </h3>
                <span className="text-[9px] font-black uppercase tracking-widest bg-brand-black text-white px-2 py-0.5 comic-border">
                  {(singleOrder.delivery_method || 'courier') === 'local' ? 'Local Delivery' : 'Courier Delivery'}
                </span>
              </div>

              {(singleOrder.delivery_method || 'courier') === 'courier' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Courier Partner</p>
                      <p className="font-black text-sm uppercase mt-1">{singleOrder.courier_name || 'Preparing Shipment'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tracking Code</p>
                      {singleOrder.tracking_number ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-sm font-bold bg-gray-50 px-2 py-0.5 comic-border border-gray-200">
                            {singleOrder.tracking_number}
                          </span>
                          <button
                            onClick={() => handleCopyTracking(singleOrder.tracking_number!)}
                            className="p-1.5 hover:bg-brand-black hover:text-white transition-all comic-border border-gray-200"
                            title="Copy Code"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-gray-400 uppercase mt-1">Not Available Yet</p>
                      )}
                    </div>
                  </div>

                  {singleOrder.tracking_number && (
                    <a
                      href={getTrackingLink(singleOrder.courier_name || '', singleOrder.tracking_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-brand-black hover:bg-brand-red text-white font-black uppercase text-xs tracking-widest comic-border border-brand-black flex items-center justify-center transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
                    >
                      Track Shipment
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Delivery Status</p>
                  <p className="font-black text-sm uppercase text-brand-red">
                    {singleOrder.status === 'out_for_delivery' ? 'Out For Delivery' : singleOrder.status}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 leading-relaxed">
                    Our local agent in Udaipur will deliver this order directly to your shipping address.
                  </p>
                </div>
              )}
            </div>

            {/* Shipping Address Box */}
            <div className="bg-white comic-border p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-red border-b-2 border-gray-100 pb-2 flex items-center gap-2">
                <MapPin size={16} /> Delivery Information
              </h3>
              <div className="space-y-2">
                <p className="font-black text-sm">{singleOrder.customer_name}</p>
                <p className="text-xs font-bold text-gray-600 leading-relaxed uppercase">{singleOrder.shipping_address}</p>
                <p className="text-xs font-black uppercase tracking-widest mt-2 pt-2 border-t border-gray-100">
                  Phone: <span className="font-bold font-mono">{singleOrder.customer_phone}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Products & Summary */}
          <div className="space-y-8">
            {/* Products Box */}
            <div className="bg-white comic-border p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-red border-b-2 border-gray-100 pb-2">
                Ordered Products
              </h3>
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {singleOrder.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-center bg-white p-4 comic-border border-gray-200">
                    <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-200">
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
                      <p className="font-black uppercase text-xs">{item.name}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {item.selected_size || item.size} • {item.selected_material || item.material} • Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.isFreeItem ? (
                        <>
                          <p className="font-black text-green-600 text-sm">FREE</p>
                          <span className="text-xs text-gray-400 line-through block mt-0.5">
                            ₹{(item.unit_price || item.price) * item.quantity}
                          </span>
                        </>
                      ) : (
                        <>
                          <p className="font-black text-brand-red text-sm">₹{item.line_total || (item.price * item.quantity)}</p>
                          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">
                            Unit Price: ₹{item.unit_price || item.price}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Totals Box */}
            <div className="bg-white comic-border p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-red border-b-2 border-gray-100 pb-2">
                Order Summary
              </h3>
              <div className="space-y-2 text-xs font-bold uppercase tracking-wider">
                <div className="flex justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span>₹{singleOrder.subtotal}</span>
                </div>
                {singleOrder.coupon_code && singleOrder.discount_amount && Number(singleOrder.discount_amount) > 0 ? (
                  <div className="flex justify-between text-green-600 font-black">
                    <span className="text-gray-400 font-bold">Coupon ({singleOrder.coupon_code})</span>
                    <span>-₹{singleOrder.discount_amount}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-gray-400">Shipping Charge</span>
                  <span>₹{singleOrder.shipping_charge}</span>
                </div>
                <div className="border-t-2 border-dashed border-gray-200 my-2 pt-2 flex justify-between text-sm font-black text-brand-black">
                  <span>Grand Total</span>
                  <span className="text-brand-red">₹{singleOrder.total}</span>
                </div>
                <div className="border-t border-gray-100 pt-3 mt-3 grid grid-cols-2 gap-2 text-[9px]">
                  <div>
                    <span className="text-gray-400 block font-black">Payment Method</span>
                    <span className="font-black text-brand-black uppercase mt-0.5 block">{singleOrder.payment_method || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-black">Payment Status</span>
                    <span className={`font-black uppercase mt-0.5 block ${singleOrder.payment_status === 'Paid' ? 'text-green-600' : 'text-orange-500'}`}>{singleOrder.payment_status || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toast Alert */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-8 right-8 z-[999] bg-brand-black text-white px-6 py-4 comic-border border-white shadow-2xl flex items-start gap-3 max-w-[calc(100vw-2rem)] md:max-w-md"
            >
              <span className="w-2 h-2 rounded-full bg-brand-red animate-ping mt-1.5 shrink-0" />
              <div className="flex flex-col text-left">
                <p className="font-display font-black uppercase tracking-widest text-xs leading-tight">
                  {toastMessage.title}
                </p>
                {toastMessage.message && (
                  <p className="text-xs text-gray-400 font-medium mt-1 leading-normal font-sans normal-case">
                    {toastMessage.message}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancellation Confirmation Modal */}
        <AnimatePresence>
          {orderToCancel && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOrderToCancel(null)}
                className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white border-4 border-brand-black p-6 md:p-8 max-w-md w-full relative z-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-left"
              >
                <h2 className="text-2xl font-black uppercase tracking-tight text-brand-black mb-4">
                  Cancel Order?
                </h2>
                <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed mb-6">
                  This action cannot be undone. Your order will be cancelled immediately.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setOrderToCancel(null)}
                    disabled={cancelling}
                    className="flex-1 bg-white hover:bg-gray-50 text-brand-black font-black uppercase text-xs tracking-widest py-3 border-2 border-brand-black comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all disabled:opacity-50"
                  >
                    Keep Order
                  </button>
                  <button
                    onClick={() => handleCancelOrder(orderToCancel.id)}
                    disabled={cancelling}
                    className="flex-grow-2 flex-1 bg-brand-red hover:bg-brand-black text-white font-black uppercase text-xs tracking-widest py-3 border-2 border-brand-black comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        <span>Cancelling...</span>
                      </>
                    ) : (
                      <span>Cancel Order</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // MODE A: Order List View
  return (
    <div className="pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[70vh]">
      <SEO metadata={getNonIndexableMetadata('My Orders', location.pathname)} />
      <div className="flex items-center gap-4 mb-12">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 border-2 border-brand-black hover:bg-gray-100 transition-colors bg-white focus:outline-none flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
          aria-label="Go back"
        >
          <ArrowLeft size={24} className="text-brand-black" />
        </button>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-left">
          MY <span className="text-brand-red">ORDERS</span>
        </h1>
      </div>

      {orders.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-white border-2 border-brand-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-12 text-center"
        >
          <div className="flex justify-center mb-6">
            <Package size={64} className="text-gray-300" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight mb-4">No orders found yet.</h2>
          <p className="text-gray-600 font-bold uppercase text-[10px] tracking-wider mb-8 max-w-md mx-auto leading-relaxed">
            When you place an order, it will appear here. You can track its status, courier shipment progress, or Udaipur local dispatch updates.
          </p>
          <Link 
            to="/collections" 
            className="inline-block bg-brand-black text-brand-white font-black uppercase tracking-widest text-xs px-8 py-4 hover:bg-brand-red transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            Browse Collections
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {orders.map((order, idx) => {
            const badge = getStatusBadge(order.status);
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white comic-border overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all"
              >
                <div className="p-5 md:p-6 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                  {/* Left Column: Order ID & Poster Count */}
                  <div className="flex items-start gap-4 text-left">
                    <div className="w-12 h-12 bg-brand-red/10 border-2 border-brand-black rounded flex items-center justify-center text-brand-red shrink-0">
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-gray-400 tracking-widest">
                        Order ID: #{order.id.toString().padStart(6, '0')}
                      </p>
                      <p className="font-black text-sm uppercase mt-0.5">
                        {order.items.length} {order.items.length === 1 ? 'Poster' : 'Posters'}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Date, Amount, Status, and Actions */}
                  <div className="flex flex-col gap-4 text-left md:text-right md:items-end flex-grow">
                    {/* Stats Row */}
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 md:justify-end">
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Order Date</p>
                        <div className="flex items-center gap-1.5 font-bold text-xs uppercase mt-0.5">
                          <Calendar size={13} className="text-brand-red" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Total Amount</p>
                        <p className="font-black text-base text-brand-red mt-0.5">₹{order.total}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Status</p>
                        <div className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border comic-border mt-0.5 inline-block ${badge.color}`}>
                          {badge.label}
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex flex-wrap gap-3 md:justify-end">
                      <button
                        onClick={() => downloadInvoice(order)}
                        className="bg-white text-brand-black hover:bg-brand-red hover:text-white font-black uppercase text-[10px] tracking-widest px-5 py-2.5 comic-border border-brand-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-center cursor-pointer flex items-center gap-1.5"
                      >
                        <Download size={11} /> Download Invoice
                      </button>

                      {order.status !== 'cancelled' && (
                        <Link
                          to={`/account/order/${order.id}`}
                          className="bg-brand-black text-white font-black uppercase text-[10px] tracking-widest px-5 py-2.5 comic-border hover:bg-brand-red transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-center"
                        >
                          Track Order
                        </Link>
                      )}

                      {order.status !== 'cancelled' && ['pending', 'confirmed'].includes(order.status) && (
                        <button
                          onClick={() => setOrderToCancel(order)}
                          className="bg-white text-brand-red hover:bg-brand-red hover:text-white font-black uppercase text-[10px] tracking-widest px-5 py-2.5 comic-border border-brand-red hover:border-brand-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-center cursor-pointer"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-[999] bg-brand-black text-white px-6 py-4 comic-border border-white shadow-2xl flex items-start gap-3 max-w-[calc(100vw-2rem)] md:max-w-md"
          >
            <span className="w-2 h-2 rounded-full bg-brand-red animate-ping mt-1.5 shrink-0" />
            <div className="flex flex-col text-left">
              <p className="font-display font-black uppercase tracking-widest text-xs leading-tight">
                {toastMessage.title}
              </p>
              {toastMessage.message && (
                <p className="text-xs text-gray-400 font-medium mt-1 leading-normal font-sans normal-case">
                  {toastMessage.message}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancellation Confirmation Modal */}
      <AnimatePresence>
        {orderToCancel && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToCancel(null)}
              className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border-4 border-brand-black p-6 md:p-8 max-w-md w-full relative z-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-left"
            >
              <h2 className="text-2xl font-black uppercase tracking-tight text-brand-black mb-4">
                Cancel Order?
              </h2>
              <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed mb-6">
                This action cannot be undone. Your order will be cancelled immediately.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setOrderToCancel(null)}
                  disabled={cancelling}
                  className="flex-1 bg-white hover:bg-gray-50 text-brand-black font-black uppercase text-xs tracking-widest py-3 border-2 border-brand-black comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button
                  onClick={() => handleCancelOrder(orderToCancel.id)}
                  disabled={cancelling}
                  className="flex-grow-2 flex-1 bg-brand-red hover:bg-brand-black text-white font-black uppercase text-xs tracking-widest py-3 border-2 border-brand-black comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <span>Cancel Order</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

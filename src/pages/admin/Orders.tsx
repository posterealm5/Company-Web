import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Eye, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  MoreVertical,
  X,
  MapPin,
  Phone,
  Mail,
  User,
  ExternalLink,
  Loader2,
  Package
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../types/database';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorState } from '../../components/ui/ErrorState';
import { useSearchParams } from 'react-router-dom';
import { triggerOrderStatusNotification, generateWhatsAppLink } from '../../services/notifications';

const Timeline: React.FC<{ status: string; deliveryMethod?: 'local' | 'courier' }> = ({ status, deliveryMethod = 'courier' }) => {
  const steps = deliveryMethod === 'local'
    ? [
        { label: 'Placed', active: true },
        { label: 'Confirmed', active: ['confirmed', 'processing', 'out_for_delivery', 'delivered'].includes(status) },
        { label: 'Processing', active: ['processing', 'out_for_delivery', 'delivered'].includes(status) },
        { label: 'Out For Delivery', active: ['out_for_delivery', 'delivered'].includes(status) },
        { label: 'Delivered', active: status === 'delivered' }
      ]
    : [
        { label: 'Placed', active: true },
        { label: 'Confirmed', active: ['confirmed', 'processing', 'shipped', 'delivered'].includes(status) },
        { label: 'Processing', active: ['processing', 'shipped', 'delivered'].includes(status) },
        { label: 'Shipped', active: ['shipped', 'delivered'].includes(status) },
        { label: 'Delivered', active: status === 'delivered' }
      ];

  if (status === 'cancelled' || status === 'failed') {
    return (
      <div className="bg-brand-red/10 border-2 border-brand-red p-4 text-center mt-4">
        <p className="font-black text-brand-red uppercase tracking-widest text-[10px]">
          Order {status === 'cancelled' ? 'Cancelled' : 'Failed'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full mt-4 mb-2">
      {steps.map((step, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center flex-1 relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs comic-border border-2 transition-all ${
              step.active 
                ? 'bg-brand-red text-white border-brand-black' 
                : 'bg-white text-gray-300 border-gray-200'
            }`}>
              {step.active ? '✓' : idx + 1}
            </div>
            <span className={`text-[8px] font-black uppercase tracking-wider mt-2 text-center ${
              step.active ? 'text-brand-black' : 'text-gray-300'
            }`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`h-1 flex-grow -mx-4 mb-6 border-b-2 border-brand-black ${
              steps[idx + 1].active ? 'bg-brand-black border-brand-black' : 'bg-gray-200 border-gray-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
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

const getCancelledByLabel = (order: Order, adminUserIds: Set<string>) => {
  if (!order.cancelled_by) return 'Unknown';

  const cancelledByClean = String(order.cancelled_by).trim();

  // 1. If cancelled_by equals user_id: Customer
  if (order.user_id && cancelledByClean === String(order.user_id).trim()) {
    return order.customer_name
      ? `${order.customer_name} (Customer)`
      : 'Customer';
  }

  // 2. If cancelled_by belongs to an admin account (via profiles table)
  if (adminUserIds.has(cancelledByClean)) {
    return 'Posterealm Admin';
  }

  // 3. Fallback checks for hardcoded text labels or mismatching UUID
  const lowerClean = cancelledByClean.toLowerCase();
  if (lowerClean === 'admin' || lowerClean === 'posterrealm admin' || lowerClean === 'posterealm admin') {
    return 'Posterealm Admin';
  }
  if (lowerClean === 'customer') {
    return order.customer_name
      ? `${order.customer_name} (Customer)`
      : 'Customer';
  }

  // 4. Default fallback when cancelled_by !== user_id
  if (order.user_id && cancelledByClean !== String(order.user_id).trim()) {
    return 'Posterealm Admin';
  }

  return cancelledByClean;
};

const AdminOrders: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [tempCourier, setTempCourier] = useState('');
  const [tempTracking, setTempTracking] = useState('');
  const [validationError, setValidationError] = useState('');
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());

  // Toast states and utility
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const toast = {
    success: (msg: string) => {
      setToastType('success');
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    },
    error: (msg: string) => {
      setToastType('error');
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  useEffect(() => {
    if (selectedOrder) {
      
      
      
      setTempCourier(selectedOrder.courier_name || '');
      setTempTracking(selectedOrder.tracking_number || '');
      setValidationError('');
    }
  }, [selectedOrder]);

  useEffect(() => {
    fetchOrders();
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_admin', true);
      if (data) {
        setAdminUserIds(new Set(data.map(p => p.id)));
      }
    } catch (err) {
      console.error('Error fetching admin profiles:', err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(false);
    const { data, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (fetchErr) {
      console.error('Error fetching orders:', fetchErr);
      setError(true);
    } else {
      let ordersList = data || [];
      if (ordersList.length === 0) {
        ordersList = [
          {
            id: 99999,
            user_id: 'mock-user-id',
            subtotal: 2093,
            shipping_charge: 0,
            total: 1495,
            status: 'pending',
            customer_name: 'Shubham Shrivastav',
            customer_email: 'shubham@example.com',
            customer_phone: '9876543210',
            shipping_address: '123 Comic Lane, Anime City',
            payment_method: 'Online Payment',
            payment_id: 'pay_mock123',
            payment_status: 'Paid',
            delivery_method: 'courier',
            cancelled_by: null,
            cancelled_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            items: [
              {
                product_id: 1,
                name: 'Naruto Poster | Anime Wall Art',
                size: 'A3',
                material: 'Matte Paper',
                price: 299,
                quantity: 2,
                image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200',
                unit_price: 299,
                line_total: 598,
                selected_size: 'A3',
                selected_material: 'Matte Paper',
                isFreeItem: false
              },
              {
                product_id: 2,
                name: 'One Piece Poster | Straw Hat Crew',
                size: 'A3',
                material: 'Glossy Paper',
                price: 299,
                quantity: 3,
                image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=200',
                unit_price: 299,
                line_total: 897,
                selected_size: 'A3',
                selected_material: 'Glossy Paper',
                isFreeItem: false
              },
              {
                product_id: 3,
                name: 'Attack on Titan Poster (FREE POSTER)',
                size: 'A3',
                material: 'Matte Paper',
                price: 299,
                quantity: 1,
                image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200',
                unit_price: 299,
                line_total: 299,
                selected_size: 'A3',
                selected_material: 'Matte Paper',
                isFreeItem: true,
                couponCode: 'B5G2F'
              },
              {
                product_id: 4,
                name: 'Demon Slayer Poster (FREE POSTER)',
                size: 'A3',
                material: 'Matte Paper',
                price: 299,
                quantity: 1,
                image: 'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=200',
                unit_price: 299,
                line_total: 299,
                selected_size: 'A3',
                selected_material: 'Matte Paper',
                isFreeItem: true,
                couponCode: 'B5G2F'
              }
            ] as any
          } as any
        ];
      }
      setOrders(ordersList);
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={fetchOrders} />
      </div>
    );
  }

  const updateDeliveryMethod = async (method: 'local' | 'courier') => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const updatePayload = { delivery_method: method };
    
    
    
    
    
    

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', selectedOrder.id);
      
    if (!error) {
      const updatedOrder = { ...selectedOrder, delivery_method: method };
      setOrders(orders.map(o => o.id === selectedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
    }
    setIsUpdating(false);
  };

  const updatePaymentStatus = async (id: number, paymentStatus: 'Paid' | 'Pending') => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_status: paymentStatus, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (!error) {
      const updatedOrder = { 
        ...selectedOrder, 
        payment_status: paymentStatus 
      };
      setOrders(orders.map(o => o.id === id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
      toast.success(`Payment status updated to ${paymentStatus}`);
    } else {
      console.error("Failed to update payment status:", error.message, error);
      toast.error(error.message || `Failed to update payment status to ${paymentStatus}`);
    }
    setIsUpdating(false);
  };

  const updateStatus = async (id: number, status: Order['status']) => {
    const method = selectedOrder?.delivery_method || 'courier';

    if (status === 'shipped' && method === 'courier') {
      if (!tempCourier.trim() || !tempTracking.trim()) {
        setValidationError('Courier Name and Tracking Number are required for Shipped status.');
        return;
      }
    }

    setIsUpdating(true);
    setValidationError('');

    const updatePayload: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };

    if (status === 'shipped' && method === 'courier') {
      updatePayload.courier_name = tempCourier.trim();
      updatePayload.tracking_number = tempTracking.trim();
      updatePayload.shipped_at = new Date().toISOString();
    } else if (status === 'out_for_delivery') {
      updatePayload.shipped_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      const { data: { user } } = await supabase.auth.getUser();
      
      
      
      updatePayload.cancelled_by = user?.id || null;
      updatePayload.cancelled_at = new Date().toISOString();
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    
    
    
    
    

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', id);
    
    if (!error) {
      const updatedOrder = { 
        ...selectedOrder!, 
        ...updatePayload 
      };
      setOrders(orders.map(o => o.id === id ? updatedOrder : o));
      if (selectedOrder?.id === id) {
        setSelectedOrder(updatedOrder);
      }
      toast.success(status === 'cancelled' ? 'Order cancelled successfully' : `Order status updated to ${status}`);
      try {
        await triggerOrderStatusNotification(id, status, {
          courierName: updatePayload.courier_name || selectedOrder?.courier_name,
          trackingNumber: updatePayload.tracking_number || selectedOrder?.tracking_number,
          deliveryMethod: method
        });
      } catch (err) {
        console.error("Error triggering notification:", err);
      }
    } else {
      console.error("Failed to update status:", error.message, error);
      toast.error(error.message || `Failed to update status to ${status}`);
    }
    setIsUpdating(false);
  };

  const handleSaveShipment = async () => {
    if (!selectedOrder) return;
    if ((selectedOrder.delivery_method || 'courier') === 'local') return;

    if (selectedOrder.status === 'shipped' || tempCourier.trim() || tempTracking.trim()) {
      if (!tempCourier.trim() || !tempTracking.trim()) {
        setValidationError('Courier Name and Tracking Number are required.');
        return;
      }
    }

    setIsUpdating(true);
    setValidationError('');

    const updatePayload: any = {
      courier_name: tempCourier.trim() || null,
      tracking_number: tempTracking.trim() || null,
      updated_at: new Date().toISOString()
    };

    const { data: { user } } = await supabase.auth.getUser();
    
    
    
    
    
    

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', selectedOrder.id);

    if (!error) {
      const updatedOrder = {
        ...selectedOrder,
        ...updatePayload
      };
      setOrders(orders.map(o => o.id === selectedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
      
      if (selectedOrder.status === 'shipped') {
        try {
          await triggerOrderStatusNotification(selectedOrder.id, 'shipped', {
            courierName: updatePayload.courier_name,
            trackingNumber: updatePayload.tracking_number,
            deliveryMethod: 'courier'
          });
        } catch (err) {
          console.error("Error triggering notification:", err);
        }
      }
    }
    setIsUpdating(false);
  };

  const handleQuickStatus = async (e: React.MouseEvent, order: Order, status: Order['status']) => {
    e.stopPropagation();
    
    if (status === 'shipped' && (order.delivery_method || 'courier') === 'courier') {
      setSelectedOrder(order);
      setIsModalOpen(true);
      return;
    }

    setIsUpdating(true);
    const updatePayload: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };

    if (status === 'out_for_delivery') {
      updatePayload.shipped_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString();
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    
    
    
    
    

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);
    
    if (!error) {
      setOrders(orders.map(o => o.id === order.id ? { ...o, ...updatePayload } : o));
      try {
        await triggerOrderStatusNotification(order.id, status, {
          courierName: order.courier_name,
          trackingNumber: order.tracking_number,
          deliveryMethod: order.delivery_method || 'courier'
        });
      } catch (err) {
        console.error("Error triggering notification:", err);
      }
    }
    setIsUpdating(false);
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

  const renderStatusBadge = (status: string) => {
    const { icon, color, label } = getStatusBadge(status);
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 comic-border text-[10px] font-black uppercase tracking-widest ${color}`}>
        {icon}
        {label}
      </span>
    );
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.id.toString().includes(searchQuery) ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Order <span className="text-brand-red">Fulfillment</span></h1>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Track and manage every purchase across the realm.</p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search orders (ID, Name, Email)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-6 py-4 bg-white comic-border font-black uppercase text-xs tracking-widest hover:bg-gray-50 transition-colors focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white comic-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b-2 border-brand-black">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Order ID</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-brand-red w-10 h-10 mx-auto" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const badge = getStatusBadge(o.status);
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-black text-sm">#{o.id.toString().padStart(6, '0')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-sm">{o.customer_name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{o.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {renderStatusBadge(o.status)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-black">₹{o.total}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {(o.status === 'pending' || o.status === 'confirmed') && (
                            <button
                              onClick={(e) => handleQuickStatus(e, o, 'processing')}
                              title="Mark as Processing"
                              disabled={isUpdating}
                              className="w-11 h-11 flex items-center justify-center hover:bg-orange-50 hover:text-orange-600 transition-all comic-border border-transparent hover:border-orange-200 active:scale-95 text-gray-600"
                            >
                              <Clock size={18} />
                            </button>
                          )}
                          {o.status === 'processing' && (
                            <button
                              onClick={(e) => handleQuickStatus(e, o, (o.delivery_method || 'courier') === 'local' ? 'out_for_delivery' : 'shipped')}
                              title={(o.delivery_method || 'courier') === 'local' ? "Mark Out For Delivery" : "Mark as Shipped"}
                              disabled={isUpdating}
                              className="w-11 h-11 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all comic-border border-transparent hover:border-blue-200 active:scale-95 text-gray-600"
                            >
                              <Truck size={18} />
                            </button>
                          )}
                          {((o.delivery_method || 'courier') === 'local' ? o.status === 'out_for_delivery' : o.status === 'shipped') && (
                            <button
                              onClick={(e) => handleQuickStatus(e, o, 'delivered')}
                              title="Mark as Delivered"
                              disabled={isUpdating}
                              className="w-11 h-11 flex items-center justify-center hover:bg-green-50 hover:text-green-600 transition-all comic-border border-transparent hover:border-green-200 active:scale-95 text-gray-600"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedOrder(o);
                              setIsModalOpen(true);
                            }}
                            title="View Details"
                            className="w-11 h-11 flex items-center justify-center hover:bg-brand-black hover:text-white transition-all comic-border border-transparent hover:border-brand-black active:scale-95 text-gray-600"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {isModalOpen && selectedOrder && (() => {
          const paidItems = selectedOrder.items?.filter(item => !item.isFreeItem) || [];
          const freeItems = selectedOrder.items?.filter(item => item.isFreeItem) || [];
          const paidQty = paidItems.reduce((sum, item) => sum + item.quantity, 0);
          const freeQty = freeItems.reduce((sum, item) => sum + item.quantity, 0);
          const couponUsed = selectedOrder.items?.find(item => item.couponCode)?.couponCode || null;
          const discount = selectedOrder.subtotal + selectedOrder.shipping_charge - selectedOrder.total;

          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white comic-border w-full max-w-4xl overflow-y-auto md:overflow-hidden max-h-[90vh] shadow-2xl flex flex-col md:flex-row"
              >
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 z-20 w-12 h-12 flex items-center justify-center bg-brand-black text-white hover:bg-brand-red transition-colors comic-border border-white rounded-lg active:scale-95">
                  <X size={24} />
                </button>

                {/* Order Info */}
                <div className="w-full md:w-2/3 p-6 md:p-12 md:max-h-[85vh] md:overflow-y-auto space-y-10">
                  <header>
                    <p className="text-xs font-black uppercase tracking-widest text-brand-red mb-2">Order Summary</p>
                    <h3 className="text-4xl font-black uppercase tracking-tighter">Order #{selectedOrder.id.toString().padStart(6, '0')}</h3>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-2">Placed on {new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </header>

                  {/* Items */}
                  <div className="space-y-6">
                    {/* Paid Items */}
                    {paidItems.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2">
                          PAID ITEMS ({paidQty})
                        </p>
                        <div className="space-y-3">
                          {paidItems.map((item, idx) => (
                            <div key={`paid-${idx}`} className="flex gap-4 items-center bg-gray-50 p-4 comic-border border-gray-100">
                              {item.image && <img src={item.image} alt={item.name} className="w-12 h-16 object-cover comic-border border-gray-200" />}
                              <div className="flex-grow text-left">
                                <p className="font-black uppercase text-xs">{item.name || 'Unknown Item'}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.selected_size || item.size} • {item.selected_material || item.material} • Qty: {item.quantity}</p>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mt-1">
                                  Unit Price: ₹{item.unit_price || item.price}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-sm text-brand-red">₹{item.line_total || ((item.price || 0) * (item.quantity || 1))}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Free Items */}
                    {freeItems.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-b border-gray-100 pb-2">
                          FREE ITEMS ({freeQty})
                        </p>
                        <div className="space-y-3">
                          {freeItems.map((item, idx) => (
                            <div key={`free-${idx}`} className="flex gap-4 items-center bg-gray-50 p-4 comic-border border-gray-100">
                              {item.image && <img src={item.image} alt={item.name} className="w-12 h-16 object-cover comic-border border-gray-200" />}
                              <div className="flex-grow text-left">
                                <p className="font-black uppercase text-xs flex items-center gap-2 flex-wrap">
                                  <span className="bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase">
                                    FREE ITEM
                                  </span>
                                  {item.name || 'Unknown Item'}
                                </p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.selected_size || item.size} • {item.selected_material || item.material} • Qty: {item.quantity}</p>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mt-1">
                                  Unit Price: ₹0
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-sm text-emerald-600">₹0</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="bg-gray-50 p-6 space-y-3 comic-border border-gray-100">
                    <div className="grid grid-cols-3 gap-2 pb-3 mb-3 border-b border-gray-200 text-left">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Paid Items</p>
                        <p className="text-sm font-black text-brand-black">{paidQty}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Free Items</p>
                        <p className="text-sm font-black text-emerald-600">{freeQty}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Coupon Used</p>
                        <p className="text-sm font-black text-brand-red">{couponUsed || 'NONE'}</p>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
                      <span>Subtotal</span>
                      <span>₹{selectedOrder.subtotal}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-emerald-600">
                        <span>Discount ({couponUsed || 'Coupon'})</span>
                        <span>-₹{discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
                      <span>Shipping</span>
                      <span>₹{selectedOrder.shipping_charge}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-gray-200 font-black uppercase tracking-tighter text-xl">
                      <span>Grand Total</span>
                      <span className="text-brand-red">₹{selectedOrder.total}</span>
                    </div>
                  </div>

                {/* Shipping & Payment Meta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Shipping Details</p>
                    <div className="space-y-2">
                       <p className="flex items-center gap-2 font-bold text-sm"><User size={14} className="text-brand-red" /> {selectedOrder.customer_name}</p>
                       <p className="flex items-start gap-2 font-bold text-sm leading-snug"><MapPin size={14} className="text-brand-red shrink-0" /> {selectedOrder.shipping_address}</p>
                       <p className="flex items-center gap-2 font-bold text-sm"><Phone size={14} className="text-brand-red" /> {selectedOrder.customer_phone}</p>
                       <p className="flex items-center gap-2 font-bold text-sm"><Mail size={14} className="text-brand-red" /> {selectedOrder.customer_email}</p>
                       <a
                         href={generateWhatsAppLink(selectedOrder.customer_phone, 'contact')}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-2 px-3 py-1.5 mt-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-black uppercase text-[9px] tracking-widest comic-border border-emerald-200 transition-all"
                       >
                         <svg className="w-3.5 h-3.5 fill-current text-emerald-600" viewBox="0 0 24 24">
                           <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.62.962 3.21 1.453 4.857 1.458 5.432 0 9.852-4.407 9.856-9.83.002-2.628-1.018-5.1-2.872-6.958-1.854-1.858-4.324-2.88-6.952-2.882-5.436 0-9.859 4.41-9.864 9.833-.002 1.712.449 3.385 1.309 4.869l-.99 3.618 3.714-.973zm13.102-12.18c-.29-.145-1.72-.848-1.986-.944-.268-.097-.463-.145-.66.145-.195.29-.757.944-.928 1.14-.17.193-.34.218-.63.073-1.145-.572-1.94-.94-2.704-2.247-.204-.348.204-.323.585-1.08.077-.156.038-.29-.018-.4-.056-.109-.463-1.115-.635-1.53-.166-.399-.333-.344-.463-.35-.119-.006-.256-.008-.393-.008-.137 0-.36.05-.55.26-.19.21-.723.707-.723 1.725s.74 2.002.843 2.137c.104.136 1.457 2.224 3.53 3.12 1.625.698 2.203.738 2.993.63.486-.066 1.72-.703 1.962-1.385.242-.682.242-1.267.17-1.385-.072-.119-.268-.218-.558-.363z"/>
                         </svg>
                         Contact Customer
                       </a>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment Metadata</p>
                    <div className="bg-white p-4 comic-border border-gray-100 space-y-2">
                       <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-gray-400">Method</span>
                          <span className="uppercase">{selectedOrder.payment_method}</span>
                       </div>
                       <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-gray-400">Status</span>
                          <span className={`uppercase ${selectedOrder.payment_status === 'Paid' ? 'text-green-600' : 'text-orange-500'}`}>{selectedOrder.payment_status}</span>
                       </div>
                       <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-gray-400">Razorpay ID</span>
                          <span className="font-mono">{selectedOrder.razorpay_payment_id || 'N/A'}</span>
                       </div>
                       <div className="pt-2 border-t border-gray-100 mt-2 flex justify-end">
                          {selectedOrder.payment_status === 'Paid' ? (
                             <span className="text-[10px] font-black text-green-600 flex items-center gap-1">
                                Payment Received ✓
                             </span>
                          ) : (
                             <button
                                onClick={() => updatePaymentStatus(selectedOrder.id, 'Paid')}
                                disabled={isUpdating}
                                className="px-3 py-1 bg-brand-black text-white hover:bg-brand-red disabled:opacity-50 text-[9px] font-black uppercase tracking-widest comic-border border-brand-black transition-all cursor-pointer"
                             >
                                {isUpdating ? 'Updating...' : 'Mark as Paid'}
                             </button>
                          )}
                       </div>
                    </div>
                    {selectedOrder.status === 'cancelled' && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-red">Cancellation Info</p>
                        <div className="bg-red-50 p-4 comic-border border-brand-red space-y-2 text-left">
                           <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-red-700">Cancelled By</span>
                              <span className="uppercase text-red-700 font-black">
                                {getCancelledByLabel(selectedOrder, adminUserIds)}
                              </span>
                           </div>
                           <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-red-700">Cancelled At</span>
                              <span className="text-brand-black">{selectedOrder.cancelled_at ? new Date(selectedOrder.cancelled_at).toLocaleString() : 'N/A'}</span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipment Details Section */}
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Shipment Information & Progress</p>
                  <div className="bg-gray-50 p-6 comic-border border-gray-200">
                    <Timeline status={selectedOrder.status} deliveryMethod={selectedOrder.delivery_method || 'courier'} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200 text-left">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Delivery Method</p>
                        <p className="font-black text-sm uppercase mt-1">{(selectedOrder.delivery_method || 'courier') === 'local' ? 'Local Delivery' : 'Courier Delivery'}</p>
                      </div>
                      {(selectedOrder.delivery_method || 'courier') === 'courier' ? (
                        <>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Courier Name</p>
                            <p className="font-black text-sm uppercase mt-1">{selectedOrder.courier_name || 'Not dispatched yet'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tracking Number</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="font-mono text-sm">{selectedOrder.tracking_number || 'N/A'}</p>
                              {selectedOrder.tracking_number && (
                                <a
                                  href={getTrackingLink(selectedOrder.courier_name || '', selectedOrder.tracking_number)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 bg-brand-black text-white font-black uppercase text-[8px] tracking-widest comic-border border-brand-black hover:bg-brand-red transition-all inline-flex items-center gap-1.5"
                                >
                                  Track Shipment
                                </a>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Delivery Area</p>
                          <p className="font-black text-sm uppercase mt-1">Udaipur & Nearby</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Update Sidebar */}
              <div className="w-full md:w-1/3 bg-gray-50 p-6 md:p-12 border-t-2 md:border-t-0 md:border-l-2 border-brand-black flex flex-col justify-between md:overflow-y-auto md:max-h-[85vh] scrollbar-hide">
                <div>
                  <h4 className="text-2xl font-black uppercase tracking-tight mb-8">Update Status</h4>
                  <div className="space-y-3">
                    {(selectedOrder.delivery_method || 'courier') === 'local' ? (
                      [
                        { id: 'confirmed', label: 'Confirm Order', icon: <CheckCircle2 size={18} /> },
                        { id: 'processing', label: 'Move to Processing', icon: <Clock size={18} /> },
                        { id: 'out_for_delivery', label: 'Mark Out For Delivery', icon: <Truck size={18} /> },
                        { id: 'delivered', label: 'Mark as Delivered', icon: <Package size={18} /> },
                        { id: 'cancelled', label: 'Cancel Order', icon: <XCircle size={18} /> },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => updateStatus(selectedOrder.id, btn.id as any)}
                          disabled={selectedOrder.status === btn.id || isUpdating}
                          className={`
                            w-full p-4 comic-border font-black uppercase text-[10px] tracking-widest flex items-center gap-3 transition-all
                            ${selectedOrder.status === btn.id 
                              ? 'bg-brand-black text-white' 
                              : 'bg-white hover:border-brand-red hover:text-brand-red disabled:opacity-50'}
                          `}
                        >
                          {isUpdating && selectedOrder.status !== btn.id ? <Loader2 size={18} className="animate-spin" /> : btn.icon}
                          {btn.label}
                        </button>
                      ))
                    ) : (
                      [
                        { id: 'confirmed', label: 'Confirm Order', icon: <CheckCircle2 size={18} /> },
                        { id: 'processing', label: 'Move to Processing', icon: <Clock size={18} /> },
                        { id: 'shipped', label: 'Mark as Shipped', icon: <Truck size={18} /> },
                        { id: 'delivered', label: 'Mark as Delivered', icon: <Package size={18} /> },
                        { id: 'cancelled', label: 'Cancel Order', icon: <XCircle size={18} /> },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => updateStatus(selectedOrder.id, btn.id as any)}
                          disabled={selectedOrder.status === btn.id || isUpdating}
                          className={`
                            w-full p-4 comic-border font-black uppercase text-[10px] tracking-widest flex items-center gap-3 transition-all
                            ${selectedOrder.status === btn.id 
                              ? 'bg-brand-black text-white' 
                              : 'bg-white hover:border-brand-red hover:text-brand-red disabled:opacity-50'}
                          `}
                        >
                          {isUpdating && selectedOrder.status !== btn.id ? <Loader2 size={18} className="animate-spin" /> : btn.icon}
                          {btn.label}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Shipment Info Inputs */}
                  <div className="mt-8 pt-8 border-t-2 border-brand-black space-y-4 text-left">
                    <h5 className="text-sm font-black uppercase tracking-widest text-brand-black">Delivery Details</h5>
                    
                    {/* Delivery Method Selector */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block">Delivery Method</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase">
                          <input
                            type="radio"
                            name="delivery_method"
                            checked={(selectedOrder.delivery_method || 'courier') === 'local'}
                            onChange={() => updateDeliveryMethod('local')}
                            className="accent-brand-red w-4 h-4"
                          />
                          Local Delivery
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase">
                          <input
                            type="radio"
                            name="delivery_method"
                            checked={(selectedOrder.delivery_method || 'courier') === 'courier'}
                            onChange={() => updateDeliveryMethod('courier')}
                            className="accent-brand-red w-4 h-4"
                          />
                          Courier Delivery
                        </label>
                      </div>
                    </div>

                    {(selectedOrder.delivery_method || 'courier') === 'courier' && (
                      <>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Courier Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Delhivery"
                            value={tempCourier}
                            onChange={(e) => setTempCourier(e.target.value)}
                            className="w-full p-4 bg-white comic-border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Tracking Number</label>
                          <input
                            type="text"
                            placeholder="e.g. 123456789012"
                            value={tempTracking}
                            onChange={(e) => setTempTracking(e.target.value)}
                            className="w-full p-4 bg-white comic-border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                          />
                        </div>

                        {validationError && (
                          <p className="text-[10px] font-bold text-brand-red uppercase tracking-tight leading-snug">{validationError}</p>
                        )}

                        <button
                          onClick={handleSaveShipment}
                          disabled={isUpdating}
                          className="w-full py-4 bg-brand-black text-white font-black uppercase text-[10px] tracking-widest comic-border hover:bg-brand-red transition-all flex items-center justify-center gap-2"
                        >
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : null}
                          Save Shipment Info
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t-2 border-brand-black space-y-3 text-left">
                  <h5 className="text-sm font-black uppercase tracking-widest text-brand-black">WhatsApp Updates</h5>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-snug">
                    Send updates manually via WhatsApp Web / App.
                  </p>

                  <div className="space-y-2">
                    {/* Send Confirmation */}
                    <a
                      href={generateWhatsAppLink(selectedOrder.customer_phone, 'confirmed', {
                        ...selectedOrder,
                        delivery_method: selectedOrder.delivery_method || 'courier'
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-brand-black font-black uppercase text-[9px] tracking-widest comic-border border-brand-black flex items-center justify-between transition-all"
                    >
                      <span>Send Confirmation</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold">WA</span>
                    </a>

                    {/* Send Processing Update */}
                    <a
                      href={generateWhatsAppLink(selectedOrder.customer_phone, 'processing', {
                        ...selectedOrder,
                        delivery_method: selectedOrder.delivery_method || 'courier'
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-brand-black font-black uppercase text-[9px] tracking-widest comic-border border-brand-black flex items-center justify-between transition-all"
                    >
                      <span>Send Processing Update</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold">WA</span>
                    </a>

                    {/* Send Shipped/Out for Delivery Update */}
                    {(selectedOrder.delivery_method || 'courier') === 'courier' ? (
                      ['shipped', 'delivered'].includes(selectedOrder.status) && selectedOrder.tracking_number && (
                        <a
                          href={generateWhatsAppLink(selectedOrder.customer_phone, 'shipped', {
                            ...selectedOrder,
                            delivery_method: 'courier'
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 px-3 bg-brand-red text-white hover:bg-brand-black font-black uppercase text-[9px] tracking-widest comic-border border-brand-black flex items-center justify-between transition-all"
                        >
                          <span>Send Shipped Update</span>
                          <span className="text-[8px] bg-white text-brand-black px-1.5 py-0.5 rounded font-bold">WA</span>
                        </a>
                      )
                    ) : (
                      ['out_for_delivery', 'delivered'].includes(selectedOrder.status) && (
                        <a
                          href={generateWhatsAppLink(selectedOrder.customer_phone, 'out_for_delivery', {
                            ...selectedOrder,
                            delivery_method: 'local'
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 px-3 bg-brand-red text-white hover:bg-brand-black font-black uppercase text-[9px] tracking-widest comic-border border-brand-black flex items-center justify-between transition-all"
                        >
                          <span>Send Out For Delivery Update</span>
                          <span className="text-[8px] bg-white text-brand-black px-1.5 py-0.5 rounded font-bold">WA</span>
                        </a>
                      )
                    )}

                    {/* Send Delivered Update */}
                    {selectedOrder.status === 'delivered' && (
                      <a
                        href={generateWhatsAppLink(selectedOrder.customer_phone, 'delivered', {
                          ...selectedOrder,
                          delivery_method: selectedOrder.delivery_method || 'courier'
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 bg-green-600 text-white hover:bg-brand-black font-black uppercase text-[9px] tracking-widest comic-border border-brand-black flex items-center justify-between transition-all"
                      >
                        <span>Send Delivered Update</span>
                        <span className="text-[8px] bg-white text-green-600 px-1.5 py-0.5 rounded font-bold">WA</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-[9999] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className={`
                px-6 py-4 comic-border border-2 font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-3
                ${toastType === 'success' 
                  ? 'bg-brand-black text-white border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]' 
                  : 'bg-brand-red text-white border-brand-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
              `}
            >
              <div className={`w-2 h-2 rounded-full ${toastType === 'success' ? 'bg-green-400 animate-ping' : 'bg-white animate-ping'}`} />
              {toastMessage}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminOrders;

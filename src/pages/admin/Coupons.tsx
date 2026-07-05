import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Loader2, 
  Calendar, 
  Users, 
  Search, 
  AlertCircle,
  HelpCircle,
  Percent,
  TrendingDown,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../services/coupons';
import { supabase } from '../../lib/supabase';
import type { CouponWithUsers } from '../../services/coupons';
import type { Profile } from '../../types/database';
import { ErrorState } from '../../components/ui/ErrorState';

const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponWithUsers | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'percentage' | 'buy_x_get_y'>('percentage');
  const [value, setValue] = useState<number | ''>('');
  const [buyQty, setBuyQty] = useState<number | ''>('');
  const [freeQty, setFreeQty] = useState<number | ''>('');
  const [minSubtotal, setMinSubtotal] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>('');
  const [maxRedemptionsPerUser, setMaxRedemptionsPerUser] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  // Eligible Users states
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Toast notification
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
    fetchCoupons();
    fetchProfiles();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getCoupons();
      setCoupons(data);
    } catch (err: any) {
      console.error('Error fetching coupons:', err);
      toast.error(err.message || 'Failed to fetch coupons');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (profError) throw profError;
      if (data) setAllProfiles(data);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={fetchCoupons} />
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setName('');
    setDescription('');
    setType('percentage');
    setValue('');
    setBuyQty('');
    setFreeQty('');
    setMinSubtotal('');
    setStartDate('');
    setEndDate('');
    setMaxRedemptions('');
    setMaxRedemptionsPerUser('');
    setIsActive(true);
    setSelectedUserIds([]);
    setUserSearchQuery('');
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: CouponWithUsers) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setName(coupon.name);
    setDescription(coupon.description);
    setType(coupon.type);
    setValue(coupon.value ?? '');
    setBuyQty(coupon.buy_qty ?? '');
    setFreeQty(coupon.free_qty ?? '');
    setMinSubtotal(coupon.min_subtotal ?? '');
    setStartDate(coupon.start_date ? formatDateForInput(coupon.start_date) : '');
    setEndDate(coupon.end_date ? formatDateForInput(coupon.end_date) : '');
    setMaxRedemptions(coupon.max_redemptions ?? '');
    setMaxRedemptionsPerUser(coupon.max_redemptions_per_user ?? '');
    setIsActive(coupon.is_active);
    setSelectedUserIds(coupon.eligible_users?.map(u => u.user_id) || []);
    setUserSearchQuery('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteCoupon(id);
      toast.success('Coupon deleted successfully');
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      console.error('Error deleting coupon:', err);
      toast.error(err.message || 'Failed to delete coupon');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    if (!name.trim()) {
      toast.error('Coupon name is required');
      return;
    }

    setSubmitting(true);

    try {
      const dbValue = value !== '' ? Number(value) : null;
      const dbMinSubtotal = minSubtotal !== '' ? Number(minSubtotal) : null;
      const dbBuyQty = buyQty !== '' ? Number(buyQty) : null;
      const dbFreeQty = freeQty !== '' ? Number(freeQty) : null;
      const dbMaxRedemptions = maxRedemptions !== '' ? Number(maxRedemptions) : null;
      const dbMaxRedemptionsPerUser = maxRedemptionsPerUser !== '' ? Number(maxRedemptionsPerUser) : null;
      
      const payload: any = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        type,
        is_active: isActive,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        max_redemptions: dbMaxRedemptions,
        max_redemptions_per_user: dbMaxRedemptionsPerUser,
      };

      // Map UI values to database schema fields
      if (type === 'buy_x_get_y') {
        payload.buy_qty = dbBuyQty;
        payload.free_qty = dbFreeQty;
      } else {
        payload.value = dbValue;
        payload.min_subtotal = dbMinSubtotal;
      }

      if (editingCoupon) {
        const updated = await updateCoupon(editingCoupon.id, payload, selectedUserIds);
        toast.success('Coupon updated successfully');
        
        // Refresh local list
        const mappedUsers = allProfiles
          .filter(p => selectedUserIds.includes(p.id))
          .map(p => ({
            user_id: p.id,
            full_name: p.full_name || undefined,
            email: p.email
          }));

        setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? { ...c, ...updated, eligible_users: mappedUsers } : c));
      } else {
        const created = await createCoupon(payload, selectedUserIds);
        toast.success('Coupon created successfully');
        
        const mappedUsers = allProfiles
          .filter(p => selectedUserIds.includes(p.id))
          .map(p => ({
            user_id: p.id,
            full_name: p.full_name || undefined,
            email: p.email
          }));

        setCoupons(prev => [{ ...created, eligible_users: mappedUsers }, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving coupon:', err);
      toast.error(err.message || 'Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  // Helpers
  const formatDateForInput = (isoString: string) => {
    const date = new Date(isoString);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  const getCouponTypeLabel = (t: string) => {
    switch (t) {
      case 'percentage': return 'Percentage';
      case 'buy_x_get_y': return 'Buy X Get Y';
      default: return t;
    }
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchedProfiles = userSearchQuery.trim()
    ? allProfiles.filter(p => 
        (p.full_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(userSearchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-8 text-brand-black">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 right-4 z-[200] px-6 py-4 comic-border border-2 font-black uppercase text-xs tracking-widest flex items-center gap-3 ${
              toastType === 'success' ? 'bg-green-500 border-brand-black text-white' : 'bg-brand-red border-white text-white'
            }`}
          >
            {toastType === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">
            COUPON <span className="text-brand-red">TREASURY</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
            Manage promo codes, time-limited discounts, and account-exclusive offers.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 bg-brand-red text-white hover:bg-brand-black px-6 py-4 font-black uppercase text-xs tracking-widest transition-colors comic-border border-brand-black active:scale-95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
        >
          <Plus size={16} /> Create Coupon
        </button>
      </header>

      {/* Search toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search coupons (Code, Name, Description)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all"
          />
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white comic-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b-2 border-brand-black">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Coupon Code</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Type & Benefit</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Usage limits</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Visibility & Dates</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
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
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                    No coupons found.
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon) => {
                  const hasUsageLimit = coupon.max_redemptions !== null && coupon.max_redemptions !== undefined;
                  const currentRedemptions = coupon.current_redemptions || 0;
                  const isUserLimited = coupon.eligible_users && coupon.eligible_users.length > 0;
                  
                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50/50 transition-colors group">
                      {/* Code & Name */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-left">
                          <span className="font-black text-lg bg-brand-red/10 border-2 border-dashed border-brand-red text-brand-red px-2 py-0.5 w-fit uppercase mb-1">
                            {coupon.code}
                          </span>
                          <span className="font-black text-xs uppercase">{coupon.name}</span>
                          <span className="text-[10px] text-gray-500 mt-0.5 normal-case font-medium max-w-xs truncate">{coupon.description}</span>
                        </div>
                      </td>
                      
                      {/* Type & Benefit */}
                      <td className="px-6 py-4 text-left">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{getCouponTypeLabel(coupon.type)}</span>
                          <span className="font-black text-sm text-brand-black mt-0.5">
                            {coupon.type === 'buy_x_get_y' ? (
                              `Buy ${coupon.buy_qty} Get ${coupon.free_qty}`
                            ) : (
                              `${coupon.value}% Off`
                            )}
                          </span>
                          {coupon.min_subtotal && (
                            <span className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Min Subtotal: ₹{coupon.min_subtotal}</span>
                          )}
                        </div>
                      </td>

                      {/* Usage Limits */}
                      <td className="px-6 py-4 text-left">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Redemptions</span>
                          <span className="font-black text-sm mt-0.5">
                            {currentRedemptions} {hasUsageLimit ? `/ ${coupon.max_redemptions}` : 'Used'}
                          </span>
                          {hasUsageLimit && (
                            <div className="w-24 bg-gray-100 h-1.5 mt-1 border border-brand-black/10">
                              <div 
                                className="bg-brand-red h-full"
                                style={{ width: `${Math.min(100, (currentRedemptions / (coupon.max_redemptions || 1)) * 100)}%` }}
                              />
                            </div>
                          )}
                          <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">
                            {coupon.max_redemptions_per_user ? `Max ${coupon.max_redemptions_per_user} per user` : 'Unlimited per user'}
                          </span>
                        </div>
                      </td>

                      {/* Visibility & Dates */}
                      <td className="px-6 py-4 text-left">
                        <div className="flex flex-col gap-1">
                          {/* Visibility badge */}
                          <span className={`inline-flex items-center gap-1 w-fit px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                            isUserLimited ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-green-100 text-green-700 border-green-200'
                          }`}>
                            {isUserLimited ? (
                              <><Users size={10} /> Private ({coupon.eligible_users?.length})</>
                            ) : (
                              'Public'
                            )}
                          </span>
                          
                          {/* Start/End dates */}
                          <div className="text-[10px] text-gray-500 font-bold uppercase space-y-0.5 mt-0.5">
                            {coupon.start_date && (
                              <p className="flex items-center gap-1"><Calendar size={10} /> Start: {new Date(coupon.start_date).toLocaleDateString()}</p>
                            )}
                            {coupon.end_date && (
                              <p className="flex items-center gap-1"><Calendar size={10} /> End: {new Date(coupon.end_date).toLocaleDateString()}</p>
                            )}
                            {!coupon.start_date && !coupon.end_date && <p className="text-[9px] italic">Never Expires</p>}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 comic-border text-[9px] font-black uppercase tracking-widest ${
                          coupon.is_active 
                            ? 'bg-green-500 text-white border-green-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                            : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}>
                          {coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(coupon)}
                            className="w-10 h-10 flex items-center justify-center transition-all comic-border border-transparent hover:bg-gray-100 hover:border-gray-200 active:scale-95 text-gray-400 hover:text-brand-black"
                            title="Edit Coupon"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(coupon.id)}
                            className="w-10 h-10 flex items-center justify-center transition-all comic-border border-transparent hover:bg-red-50 hover:border-red-100 active:scale-95 text-gray-400 hover:text-brand-red"
                            title="Delete Coupon"
                          >
                            <Trash2 size={16} />
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

      {/* Create / Edit Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-start justify-center px-4 overflow-y-auto pt-10 pb-10">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsModalOpen(false)}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
            />

            {/* Dialog Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl comic-border border-2 border-brand-black shadow-2xl z-10 my-auto flex flex-col overflow-hidden"
            >
              <header className="bg-brand-black text-white px-8 py-5 flex items-center justify-between border-b-2 border-brand-black">
                <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Tag className="text-brand-red" />
                  {editingCoupon ? 'Modify Coupon' : 'Forging New Coupon'}
                </h3>
                <button
                  onClick={() => !submitting && setIsModalOpen(false)}
                  disabled={submitting}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </header>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto text-left">
                {/* Core Config */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1">
                      Coupon Code <span className="text-brand-red">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EPIC50"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red uppercase"
                    />
                  </div>
                  
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Display Name <span className="text-brand-red">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Grand Opening 50% Off"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Description / Offer details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Save flat 50% on all posters in your bag"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                  />
                </div>

                {/* Type Selection */}
                <div className={`grid grid-cols-1 ${type === 'buy_x_get_y' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 border-t border-b border-gray-100 py-6`}>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Discount Type
                    </label>
                    <select
                      value={type}
                      onChange={(e: any) => {
                        setType(e.target.value);
                        setValue('');
                        setBuyQty('');
                        setFreeQty('');
                      }}
                      className="w-full p-3 bg-white comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                    >
                      <option value="percentage">Percentage Off</option>
                      <option value="buy_x_get_y">Buy X Get Y (Free items)</option>
                    </select>
                  </div>

                  {type !== 'buy_x_get_y' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1">
                        Discount Value (%) <span className="text-brand-red">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="15"
                        value={value}
                        onChange={(e) => setValue(e.target.value ? Number(e.target.value) : '')}
                        className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                      />
                    </div>
                  )}

                  {type === 'buy_x_get_y' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                          Buy Quantity (X) <span className="text-brand-red">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="5"
                          value={buyQty}
                          onChange={(e) => setBuyQty(e.target.value ? Number(e.target.value) : '')}
                          className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                          Free Quantity (Y) <span className="text-brand-red">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="2"
                          value={freeQty}
                          onChange={(e) => setFreeQty(e.target.value ? Number(e.target.value) : '')}
                          className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Min Order Value (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1500"
                      value={minSubtotal}
                      onChange={(e) => setMinSubtotal(e.target.value ? Number(e.target.value) : '')}
                      className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>
                </div>

                {/* Validity and Limits */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Start Date & Time (Local)
                    </label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      End Date & Time (Local)
                    </label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Redemption Limit
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 100 (Blank = Unlimited)"
                      value={maxRedemptions}
                      onChange={(e) => setMaxRedemptions(e.target.value ? Number(e.target.value) : '')}
                      className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Maximum Uses Per User
                    </label>
                    <input
                      type="number"
                      placeholder="Leave blank for unlimited"
                      value={maxRedemptionsPerUser}
                      onChange={(e) => setMaxRedemptionsPerUser(e.target.value ? Number(e.target.value) : '')}
                      className="w-full p-3 bg-gray-50 comic-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>
                </div>

                {/* Eligible Users (Private restriction) */}
                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-brand-black">
                      <Users size={16} className="text-purple-600" />
                      Eligible Account Restrictions (Private Coupon)
                    </h4>
                    <p className="text-[11px] text-gray-400 font-bold uppercase mt-1">
                      Add specific user accounts who can claim this coupon. Leave blank to make it a public coupon.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Search & Selection */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          placeholder="Search registered user accounts by name or email..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 comic-border text-xs font-bold focus:outline-none"
                        />
                      </div>

                      {/* Dropdown search results */}
                      {userSearchQuery.trim() && (
                        <div className="bg-white comic-border max-h-48 overflow-y-auto divide-y divide-gray-100 shadow-lg text-xs">
                          {searchedProfiles.length === 0 ? (
                            <p className="p-3 text-center text-gray-400 uppercase font-black">No accounts found</p>
                          ) : (
                            searchedProfiles.map(p => {
                              const isAlreadySelected = selectedUserIds.includes(p.id);
                              return (
                                <div key={p.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                  <div>
                                    <p className="font-black uppercase">{p.full_name || 'Anonymous User'}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">{p.email}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isAlreadySelected) {
                                        setSelectedUserIds(prev => prev.filter(uid => uid !== p.id));
                                      } else {
                                        setSelectedUserIds(prev => [...prev, p.id]);
                                      }
                                    }}
                                    className={`px-3 py-1 font-black uppercase text-[9px] tracking-widest border transition-colors ${
                                      isAlreadySelected
                                        ? 'bg-brand-red text-white border-brand-red'
                                        : 'bg-brand-black text-white border-brand-black hover:bg-brand-red hover:border-brand-red'
                                    }`}
                                  >
                                    {isAlreadySelected ? 'Remove' : 'Select'}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Users List */}
                    <div className="bg-gray-50 comic-border p-4 max-h-48 overflow-y-auto text-xs space-y-2">
                      <p className="font-black uppercase text-[10px] text-gray-400 tracking-wider">
                        Restricted to ({selectedUserIds.length} Accounts):
                      </p>
                      {selectedUserIds.length === 0 ? (
                        <p className="text-gray-400 italic text-[11px] py-4 text-center">Public Coupon (Any citizen can redeem this)</p>
                      ) : (
                        <div className="space-y-1">
                          {allProfiles
                            .filter(p => selectedUserIds.includes(p.id))
                            .map(p => (
                              <div key={p.id} className="flex justify-between items-center bg-white p-2 border border-gray-200">
                                <div className="min-w-0">
                                  <p className="font-black uppercase truncate">{p.full_name || 'Anonymous User'}</p>
                                  <p className="text-[9px] text-gray-400 truncate">{p.email}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserIds(prev => prev.filter(uid => uid !== p.id))}
                                  className="text-brand-red hover:text-brand-black p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-3 border-t border-gray-100 pt-6">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-brand-red w-5 h-5 cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-xs font-black uppercase tracking-widest cursor-pointer select-none">
                    Make this coupon active immediately
                  </label>
                </div>

                {/* Submit Action buttons */}
                <div className="flex gap-4 pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => !submitting && setIsModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-4 font-black uppercase text-xs tracking-widest comic-border border-brand-black hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-grow py-4 font-black uppercase text-xs tracking-widest bg-brand-black text-white hover:bg-brand-red transition-colors comic-border border-transparent flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>Saving Coupon... <Loader2 className="animate-spin" size={16} /></>
                    ) : (
                      'Save Coupon'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCoupons;

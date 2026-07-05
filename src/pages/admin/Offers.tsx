import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  X, 
  Loader2, 
  Calendar, 
  Link as LinkIcon, 
  Tag, 
  Eye 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOffers, createOffer, updateOffer, deleteOffer, reorderOffers } from '../../services/offers';
import type { Offer, OfferInsert } from '../../types/database';
import { ErrorState } from '../../components/ui/ErrorState';

const AdminOffers: React.FC = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [highlightColor, setHighlightColor] = useState('#E63946');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [targetLink, setTargetLink] = useState('');

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
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getOffers(false);
      setOffers(data);
    } catch (err: any) {
      console.error('Error fetching offers:', err);
      toast.error(err.message || 'Failed to fetch offers');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={fetchOffers} />
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingOffer(null);
    setTitle('');
    setIsActive(true);
    setHighlightColor('#E63946');
    setStartDate('');
    setEndDate('');
    setCouponCode('');
    setTargetLink('');
    setIsModalOpen(true);
  };

  const openEditModal = (offer: Offer) => {
    setEditingOffer(offer);
    setTitle(offer.title);
    setIsActive(offer.is_active);
    setHighlightColor(offer.highlight_color || '#E63946');
    setStartDate(offer.start_date ? formatDateForInput(offer.start_date) : '');
    setEndDate(offer.end_date ? formatDateForInput(offer.end_date) : '');
    setCouponCode(offer.coupon_code || '');
    setTargetLink(offer.target_link || '');
    setIsModalOpen(true);
  };

  const formatDateForInput = (isoString: string) => {
    try {
      const date = new Date(isoString);
      // Format to yyyy-MM-ddThh:mm
      const pad = (num: number) => String(num).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch (e) {
      return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const payload: OfferInsert = {
        title: title.trim(),
        is_active: isActive,
        highlight_color: highlightColor.trim() || null,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        coupon_code: couponCode.trim() || null,
        target_link: targetLink.trim() || null,
      };

      if (editingOffer) {
        await updateOffer(editingOffer.id, payload);
        toast.success('Announcement updated successfully!');
      } else {
        // Find highest display order and add 1
        const maxOrder = offers.reduce((max, o) => o.display_order > max ? o.display_order : max, 0);
        payload.display_order = maxOrder + 1;
        await createOffer(payload);
        toast.success('Announcement created successfully!');
      }
      setIsModalOpen(false);
      await fetchOffers();
    } catch (err: any) {
      console.error('Error saving offer:', err);
      toast.error(err.message || 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotional offer?')) return;
    try {
      await deleteOffer(id);
      toast.success('Announcement deleted successfully!');
      await fetchOffers();
    } catch (err: any) {
      console.error('Error deleting offer:', err);
      toast.error(err.message || 'Failed to delete announcement');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateOffer(id, { is_active: !currentActive });
      setOffers(offers.map(o => o.id === id ? { ...o, is_active: !currentActive } : o));
      toast.success(`Announcement ${!currentActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (err: any) {
      console.error('Error toggling active status:', err);
      toast.error(err.message || 'Failed to toggle active status');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= offers.length) return;

    const listCopy = [...offers];
    const temp = listCopy[index];
    listCopy[index] = listCopy[newIndex];
    listCopy[newIndex] = temp;

    // Recalculate display orders sequentially
    const updates = listCopy.map((offer, i) => ({
      id: offer.id,
      display_order: i + 1
    }));

    // Update locally immediately for instant feedback
    setOffers(listCopy.map((o, i) => ({ ...o, display_order: i + 1 })));

    try {
      await reorderOffers(updates);
      toast.success('Announcements reordered successfully!');
    } catch (err: any) {
      console.error('Error reordering offers:', err);
      toast.error(err.message || 'Failed to reorder announcements');
      fetchOffers(); // Fallback on error
    }
  };

  const renderTitlePreview = (text: string, color: string) => {
    if (!text) return <span className="text-gray-400">Preview text here...</span>;
    if (text.includes('**')) {
      const parts = text.split('**');
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <span key={i} style={{ color }}>{part}</span>;
        }
        return part;
      });
    }
    const regex = /(BUY\s+\d+\s+GET\s+\d+\s+FREE|FREE\s+SHIPPING|₹\s*\d+|\d+%\s+OFF|FREE)/gi;
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (part.match(regex)) {
        return <span key={i} style={{ color }}>{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">
            Marketing <span className="text-brand-red">Offers</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
            Manage the scrolling marquee announcements at the top of the storefront.
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-4 bg-brand-red text-white font-black uppercase text-xs tracking-widest comic-border border-brand-red shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
        >
          <Plus size={16} />
          Create Announcement
        </button>
      </header>

      {/* Offers Table */}
      <div className="bg-white comic-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b-2 border-brand-black">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-16 text-center">Order</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Offer Message Preview</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Configuration</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Visibility Bounds</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Active</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-bold">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-brand-red w-10 h-10 mx-auto" />
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400 uppercase tracking-widest text-xs">
                    No offers configured. Use the button above to add one.
                  </td>
                </tr>
              ) : (
                offers.map((offer, idx) => {
                  const now = new Date();
                  const isFuture = offer.start_date && new Date(offer.start_date) > now;
                  const isPast = offer.end_date && new Date(offer.end_date) < now;
                  const isDateInactive = isFuture || isPast;

                  return (
                    <tr key={offer.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button 
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, 'up')}
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-brand-black disabled:opacity-20 hover:bg-gray-100 transition-colors cursor-pointer rounded-md"
                          >
                            <ChevronUp size={18} />
                          </button>
                          <span className="text-xs font-black">{idx + 1}</span>
                          <button 
                            disabled={idx === offers.length - 1}
                            onClick={() => handleMove(idx, 'down')}
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-brand-black disabled:opacity-20 hover:bg-gray-100 transition-colors cursor-pointer rounded-md"
                          >
                            <ChevronDown size={18} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="bg-black text-white p-3 rounded border border-brand-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-xs inline-flex items-center gap-2 select-none max-w-md overflow-hidden truncate">
                          <Megaphone size={14} className="text-brand-red shrink-0" />
                          <span>
                            {renderTitlePreview(offer.title, offer.highlight_color || '#E63946')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs space-y-1">
                        {offer.coupon_code && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Tag size={12} className="text-brand-red" />
                            <span>Coupon: <code className="bg-gray-100 px-1 py-0.5 rounded text-brand-black font-mono font-bold uppercase">{offer.coupon_code}</code></span>
                          </div>
                        )}
                        {offer.target_link && (
                          <div className="flex items-center gap-1.5 text-gray-600 truncate max-w-xs">
                            <LinkIcon size={12} className="text-brand-red shrink-0" />
                            <span className="truncate">Link: <a href={offer.target_link} target="_blank" rel="noreferrer" className="text-brand-red hover:underline">{offer.target_link}</a></span>
                          </div>
                        )}
                        {!offer.coupon_code && !offer.target_link && (
                          <span className="text-gray-400 font-normal">Text Only Announcement</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs space-y-1">
                        {offer.start_date && (
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Calendar size={12} />
                            <span>Starts: {new Date(offer.start_date).toLocaleString()}</span>
                          </div>
                        )}
                        {offer.end_date && (
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Calendar size={12} />
                            <span>Ends: {new Date(offer.end_date).toLocaleString()}</span>
                          </div>
                        )}
                        {!offer.start_date && !offer.end_date && (
                          <span className="text-gray-400 font-normal">Always Displayed</span>
                        )}
                        {isDateInactive && (
                          <div className="text-[10px] text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 inline-block font-black uppercase tracking-wider">
                            {isFuture ? 'Scheduled' : 'Expired'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleToggleActive(offer.id, offer.is_active)}
                          className={`w-11 h-11 flex items-center justify-center mx-auto rounded border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                            offer.is_active 
                              ? 'bg-green-50 border-green-300 text-green-600 hover:bg-green-100 shadow-[2px_2px_0px_0px_rgba(22,163,74,0.2)]' 
                              : 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 shadow-[2px_2px_0px_0px_rgba(220,38,38,0.2)]'
                          }`}
                        >
                          {offer.is_active ? <Check size={18} /> : <X size={18} />}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(offer)}
                            className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-brand-black hover:bg-gray-100 border border-transparent rounded transition-all cursor-pointer hover:border-gray-200 active:scale-95"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(offer.id)}
                            className="w-11 h-11 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-500 border border-transparent hover:border-brand-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded transition-all cursor-pointer active:scale-95"
                            title="Delete"
                          >
                            <Trash2 size={18} />
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

      {/* Creation / Editing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
          <div className="bg-white border-4 border-brand-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-brand-black text-white p-4 flex justify-between items-center border-b-4 border-brand-black shrink-0">
              <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-2">
                <Megaphone className="text-brand-red" />
                {editingOffer ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6 overflow-y-auto flex-grow flex flex-col justify-between">
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                    Announcement Title / Content (use **keyword** to apply highlight color)
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. BUY 5 GET 2 FREE or Get **Free Shipping** above ₹999!"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-4 bg-white comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all text-sm"
                  />
                </div>

                {/* Highlight Preview */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs">
                  <p className="font-bold text-gray-500 uppercase tracking-widest text-[9px] mb-1 flex items-center gap-1"><Eye size={10} /> Rendering Preview:</p>
                  <p className="bg-black text-white p-2 rounded text-xs inline-flex items-center gap-2 select-none border border-brand-black">
                    <Megaphone size={12} className="text-brand-red" />
                    <span>{renderTitlePreview(title, highlightColor)}</span>
                  </p>
                </div>

                {/* Highlight Color & Active */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                      Highlight Color (Text or HEX, e.g. #ef4444)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={highlightColor}
                        onChange={(e) => setHighlightColor(e.target.value)}
                        className="w-12 h-11 bg-white border-2 border-brand-black cursor-pointer rounded p-1"
                      />
                      <input 
                        type="text" 
                        value={highlightColor}
                        onChange={(e) => setHighlightColor(e.target.value)}
                        placeholder="#ef4444"
                        className="flex-grow px-4 py-3.5 bg-white comic-border font-mono font-bold focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center h-full pt-6">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-5 h-5 accent-brand-red cursor-pointer"
                      />
                      <span className="text-sm font-black uppercase tracking-wider">Active immediately</span>
                    </label>
                  </div>
                </div>

                {/* Date Bounds */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                      Start Date (Optional)
                    </label>
                    <input 
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white comic-border font-bold focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                      End Date (Optional)
                    </label>
                    <input 
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white comic-border font-bold focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Coupon & Link */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                      Coupon Code (Optional, displays badge)
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. FREE99"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white comic-border font-mono font-bold focus:outline-none text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                      Target Link / Redirect URL (Optional)
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. /collections?category=bundle"
                      value={targetLink}
                      onChange={(e) => setTargetLink(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white comic-border font-bold focus:outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t-2 border-brand-black mt-6 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-4 bg-white text-brand-black border-2 border-brand-black hover:bg-gray-100 font-bold uppercase text-xs tracking-widest transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-red text-white font-black uppercase text-xs tracking-widest comic-border border-brand-red shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 transition-all cursor-pointer min-h-[44px]"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : editingOffer ? 'Save Changes' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-8 right-8 z-[999] text-white px-6 py-4 font-black uppercase text-xs tracking-widest comic-border border-white shadow-2xl flex items-center gap-2 ${
              toastType === 'success' ? 'bg-brand-black' : 'bg-brand-red'
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-ping ${toastType === 'success' ? 'bg-brand-red' : 'bg-white'}`} />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminOffers;

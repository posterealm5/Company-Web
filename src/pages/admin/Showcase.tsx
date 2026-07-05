import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  X, 
  Loader2, 
  Upload, 
  Image as ImageIcon,
  CheckCircle,
  ThumbsUp,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getShowcaseEntries, createShowcaseEntry, updateShowcaseEntry, deleteShowcaseEntry, reorderShowcaseEntries } from '../../services/showcase';
import { uploadShowcaseImage } from '../../services/storage';
import type { ShowcaseEntry, ShowcaseEntryInsert } from '../../types/database';
import { ErrorState } from '../../components/ui/ErrorState';
import { getOptimizedImageUrl } from '../../utils/imageUtils';


const AdminShowcase: React.FC = () => {
  const [entries, setEntries] = useState<ShowcaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ShowcaseEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [city, setCity] = useState('');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

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
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getShowcaseEntries(false);
      setEntries(data);
    } catch (err: any) {
      console.error('Error fetching showcase entries:', err);
      toast.error(err.message || 'Failed to fetch showcase entries');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={fetchEntries} />
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingEntry(null);
    setCustomerName('');
    setCity('');
    setCaption('');
    setImageUrl('');
    setIsActive(true);
    setIsFeatured(false);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: ShowcaseEntry) => {
    setEditingEntry(entry);
    setCustomerName(entry.customer_name || '');
    setCity(entry.city || '');
    setCaption(entry.caption || '');
    setImageUrl(entry.image_url);
    setIsActive(entry.is_active);
    setIsFeatured(entry.is_featured);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const entryId = editingEntry?.id || 'new-showcase';
      const { url, error } = await uploadShowcaseImage(entryId, file);
      if (error) {
        toast.error(error);
      } else if (url) {
        setImageUrl(url);
        toast.success('Room setup image uploaded successfully!');
      }
    } catch (err: any) {
      console.error('Error uploading showcase image:', err);
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      toast.error('Room setup image is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: ShowcaseEntryInsert = {
        customer_name: customerName.trim() || null,
        city: city.trim() || null,
        caption: caption.trim() || null,
        image_url: imageUrl.trim(),
        is_active: isActive,
        is_featured: isFeatured
      };

      if (editingEntry) {
        await updateShowcaseEntry(editingEntry.id, payload);
        toast.success('Showcase entry updated successfully!');
      } else {
        // Find highest display order and add 1
        const maxOrder = entries.reduce((max, r) => r.display_order > max ? r.display_order : max, 0);
        payload.display_order = maxOrder + 1;
        await createShowcaseEntry(payload);
        toast.success('Showcase entry created successfully!');
      }
      setIsModalOpen(false);
      await fetchEntries();
    } catch (err: any) {
      console.error('Error saving showcase entry:', err);
      toast.error(err.message || 'Failed to save showcase entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this showcase entry?')) return;
    try {
      await deleteShowcaseEntry(id);
      toast.success('Showcase entry deleted successfully!');
      await fetchEntries();
    } catch (err: any) {
      console.error('Error deleting showcase entry:', err);
      toast.error(err.message || 'Failed to delete showcase entry');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateShowcaseEntry(id, { is_active: !currentActive });
      setEntries(entries.map(r => r.id === id ? { ...r, is_active: !currentActive } : r));
      toast.success(`Showcase entry ${!currentActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (err: any) {
      console.error('Error toggling active status:', err);
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      await updateShowcaseEntry(id, { is_featured: !currentFeatured });
      setEntries(entries.map(r => r.id === id ? { ...r, is_featured: !currentFeatured } : r));
      toast.success(`Showcase entry ${!currentFeatured ? 'marked as featured' : 'removed from featured'}!`);
    } catch (err: any) {
      console.error('Error toggling featured status:', err);
      toast.error(err.message || 'Failed to toggle featured');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === entries.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const listCopy = [...entries];
    
    // Swap items
    const temp = listCopy[index];
    listCopy[index] = listCopy[targetIndex];
    listCopy[targetIndex] = temp;

    // Local update
    setEntries(listCopy);

    // Persist to Supabase
    try {
      const updates = listCopy.map((entry, i) => ({
        id: entry.id,
        display_order: i + 1
      }));
      await reorderShowcaseEntries(updates);
    } catch (err: any) {
      console.error('Error persisting reorder:', err);
      toast.error(err.message || 'Failed to save new display order');
      await fetchEntries(); // Revert on failure
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 right-6 z-[999] px-6 py-4 comic-border font-black uppercase text-xs tracking-widest ${
              toastType === 'success' 
                ? 'bg-brand-black text-white border-brand-red shadow-[4px_4px_0px_0px_#ef4444]' 
                : 'bg-brand-red text-white border-brand-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Customer <span className="text-brand-red">Walls</span></h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Manage customer room setups showcased in the home gallery.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-brand-black text-white px-8 py-4 font-black uppercase tracking-widest text-sm comic-border border-white hover:bg-brand-red transition-all flex items-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]"
        >
          <Plus size={20} /> Add Showcase Entry
        </button>
      </header>

      {/* Showcase List */}
      <div className="bg-white comic-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b-2 border-brand-black">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-16 text-center">Order</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-24">Image</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Caption</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Promotion</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-bold text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-brand-red w-10 h-10 mx-auto" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400 uppercase tracking-widest text-xs">
                    No showcase entries available. Add a room setup photo to start!
                  </td>
                </tr>
              ) : (
                entries.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* Order controls */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          onClick={() => handleMove(index, 'up')}
                          disabled={index === 0}
                          className={`w-10 h-10 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${index === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-brand-black'}`}
                        >
                          <ChevronUp size={18} />
                        </button>
                        <span className="font-black text-xs">{entry.display_order}</span>
                        <button 
                          onClick={() => handleMove(index, 'down')}
                          disabled={index === entries.length - 1}
                          className={`w-10 h-10 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${index === entries.length - 1 ? 'text-gray-200 cursor-not-allowed' : 'text-brand-black'}`}
                        >
                          <ChevronDown size={18} />
                        </button>
                      </div>
                    </td>
                    {/* Image Preview */}
                    <td className="px-6 py-4">
                      <img 
                        src={getOptimizedImageUrl(entry.image_url, 64, 64)} 
                        alt="Customer Wall Setup" 
                        width={64}
                        height={64}
                        loading="lazy"
                        className="w-16 h-16 object-cover comic-border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                    </td>
                    {/* Customer info */}
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-black text-brand-black uppercase tracking-wider">{entry.customer_name || 'Anonymous'}</p>
                        {entry.city && (
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <MapPin size={10} className="text-brand-red" /> {entry.city}
                          </p>
                        )}
                      </div>
                    </td>
                    {/* Caption */}
                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-gray-600 line-clamp-2 italic">"{entry.caption || 'No caption provided.'}"</p>
                    </td>
                    {/* Promotion / Featured badge */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleFeatured(entry.id, entry.is_featured)}
                        className={`px-3 py-2.5 rounded text-[10px] font-black uppercase tracking-wider border transition-all hover:scale-105 active:scale-95 ${
                          entry.is_featured 
                            ? 'bg-amber-500 text-white border-amber-600 shadow-[2px_2px_0px_0px_#d97706]' 
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Featured
                      </button>
                    </td>
                    {/* Active/Inactive */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(entry.id, entry.is_active)}
                        className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all comic-border hover:scale-105 active:scale-95 ${
                          entry.is_active
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-[2px_2px_0px_0px_#059669]'
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {entry.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(entry)}
                          className="w-11 h-11 flex items-center justify-center transition-all comic-border border-transparent hover:bg-gray-100 text-gray-500 hover:text-brand-black hover:border-gray-200 active:scale-95"
                          title="Edit Entry"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(entry.id)}
                          className="w-11 h-11 flex items-center justify-center transition-all comic-border border-transparent hover:bg-red-50 text-gray-400 hover:text-brand-red hover:border-red-200 active:scale-95"
                          title="Delete Entry"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white comic-border w-full max-w-2xl overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col max-h-[90vh]"
            >
              <div className="p-4 md:p-8 bg-brand-black text-white flex justify-between items-center border-b-4 border-brand-red shrink-0">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-widest flex items-center gap-3">
                  <ImageIcon className="text-brand-red" />
                  {editingEntry ? 'Edit Showcase Entry' : 'Create Showcase Entry'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-white active:scale-95"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 md:p-8 overflow-y-auto flex-grow space-y-6">
                <form id="showcase-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Customer Name */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Customer Name</label>
                      <input 
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Shubham"
                        className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      />
                    </div>

                    {/* City */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">City (Optional)</label>
                      <input 
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Udaipur"
                        className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      />
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Caption / Testimonial</label>
                    <textarea 
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="e.g. Finally completed my anime wall."
                      rows={3}
                      className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 resize-none"
                    />
                  </div>

                  {/* Room Setup Image Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Room Setup Image</label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {imageUrl ? (
                        <div className="relative">
                          <img 
                            src={getOptimizedImageUrl(imageUrl, 96, 96)} 
                            alt="Room Setup Preview" 
                            width={96}
                            height={96}
                            loading="lazy"
                            className="w-24 h-24 object-cover comic-border border-gray-300"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                          No Setup
                        </div>
                      )}
                      
                      <div className="flex-grow space-y-2 w-full sm:w-auto">
                        <div className="flex gap-2">
                          <label className="flex-1 sm:flex-initial bg-white border-2 border-brand-black px-4 py-3 font-black uppercase text-xs tracking-wider cursor-pointer hover:bg-gray-50 transition-colors text-center flex items-center justify-center gap-2">
                            {uploadingImage ? (
                              <Loader2 size={14} className="animate-spin text-brand-red" />
                            ) : (
                              <Upload size={14} />
                            )}
                            {uploadingImage ? 'Uploading...' : 'Choose Room Photo'}
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                              className="hidden" 
                            />
                          </label>
                          
                          {imageUrl && (
                            <button
                              type="button"
                              onClick={() => setImageUrl('')}
                              className="px-3 py-2 bg-red-50 text-brand-red border border-transparent hover:border-brand-red rounded transition-colors text-xs font-bold"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input 
                          type="text" 
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="Or paste setup photo URL directly..."
                          className="w-full p-2 bg-gray-50 comic-border text-xs font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 comic-border">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                      <input 
                        type="checkbox" 
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 text-brand-red focus:ring-brand-red"
                      />
                      <span>Active (Show on homepage)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                      <input 
                        type="checkbox" 
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                        className="w-4 h-4 text-brand-red focus:ring-brand-red"
                      />
                      <span>Featured (Display first in list)</span>
                    </label>
                  </div>
                </form>
              </div>

              <div className="p-4 md:p-8 bg-gray-50 border-t-2 border-brand-black flex gap-4 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 font-black uppercase text-sm comic-border border-gray-200 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="showcase-form"
                  disabled={submitting}
                  className="flex-1 bg-brand-red text-white py-4 font-black uppercase text-sm comic-border border-brand-red shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {editingEntry ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminShowcase;

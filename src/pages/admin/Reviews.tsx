import React, { useState, useEffect } from 'react';
import { 
  Star, 
  MessageSquare, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  X, 
  Loader2, 
  Upload, 
  CheckCircle,
  ThumbsUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getReviews, createReview, updateReview, deleteReview, reorderReviews } from '../../services/reviews';
import { uploadReviewAvatar } from '../../services/storage';
import type { Review, ReviewInsert } from '../../types/database';
import { ErrorState } from '../../components/ui/ErrorState';

const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(true);

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
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getReviews(false);
      setReviews(data);
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      toast.error(err.message || 'Failed to fetch reviews');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={fetchReviews} />
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingReview(null);
    setName('');
    setReviewText('');
    setRating(5);
    setAvatarUrl('');
    setIsActive(true);
    setIsFeatured(false);
    setIsVerifiedPurchase(true);
    setIsModalOpen(true);
  };

  const openEditModal = (review: Review) => {
    setEditingReview(review);
    setName(review.name);
    setReviewText(review.review_text);
    setRating(review.rating);
    setAvatarUrl(review.avatar_url || '');
    setIsActive(review.is_active);
    setIsFeatured(review.is_featured);
    setIsVerifiedPurchase(review.is_verified_purchase);
    setIsModalOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      // Use a temporary unique name if creating, or the review ID if editing
      const reviewId = editingReview?.id || 'new-review';
      const { url, error } = await uploadReviewAvatar(reviewId, file);
      if (error) {
        toast.error(error);
      } else if (url) {
        setAvatarUrl(url);
        toast.success('Avatar uploaded successfully!');
      }
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      toast.error(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !reviewText.trim()) {
      toast.error('Name and Review Text are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: ReviewInsert = {
        name: name.trim(),
        review_text: reviewText.trim(),
        rating,
        avatar_url: avatarUrl.trim() || null,
        is_active: isActive,
        is_featured: isFeatured,
        is_verified_purchase: isVerifiedPurchase
      };

      if (editingReview) {
        await updateReview(editingReview.id, payload);
        toast.success('Review updated successfully!');
      } else {
        // Find highest display order and add 1
        const maxOrder = reviews.reduce((max, r) => r.display_order > max ? r.display_order : max, 0);
        payload.display_order = maxOrder + 1;
        await createReview(payload);
        toast.success('Review created successfully!');
      }
      setIsModalOpen(false);
      await fetchReviews();
    } catch (err: any) {
      console.error('Error saving review:', err);
      toast.error(err.message || 'Failed to save review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client review?')) return;
    try {
      await deleteReview(id);
      toast.success('Review deleted successfully!');
      await fetchReviews();
    } catch (err: any) {
      console.error('Error deleting review:', err);
      toast.error(err.message || 'Failed to delete review');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateReview(id, { is_active: !currentActive });
      setReviews(reviews.map(r => r.id === id ? { ...r, is_active: !currentActive } : r));
      toast.success(`Review ${!currentActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (err: any) {
      console.error('Error toggling active status:', err);
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      await updateReview(id, { is_featured: !currentFeatured });
      setReviews(reviews.map(r => r.id === id ? { ...r, is_featured: !currentFeatured } : r));
      toast.success(`Review ${!currentFeatured ? 'marked as featured' : 'removed from featured'}!`);
    } catch (err: any) {
      console.error('Error toggling featured status:', err);
      toast.error(err.message || 'Failed to toggle featured');
    }
  };

  const handleToggleVerified = async (id: string, currentVerified: boolean) => {
    try {
      await updateReview(id, { is_verified_purchase: !currentVerified });
      setReviews(reviews.map(r => r.id === id ? { ...r, is_verified_purchase: !currentVerified } : r));
      toast.success(`Review ${!currentVerified ? 'marked as verified purchase' : 'removed from verified purchase'}!`);
    } catch (err: any) {
      console.error('Error toggling verified status:', err);
      toast.error(err.message || 'Failed to toggle verified purchase');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === reviews.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const listCopy = [...reviews];
    
    // Swap items
    const temp = listCopy[index];
    listCopy[index] = listCopy[targetIndex];
    listCopy[targetIndex] = temp;

    // Local update
    setReviews(listCopy);

    // Persist to Supabase
    try {
      const updates = listCopy.map((review, i) => ({
        id: review.id,
        display_order: i + 1
      }));
      await reorderReviews(updates);
    } catch (err: any) {
      console.error('Error persisting reorder:', err);
      toast.error(err.message || 'Failed to save new display order');
      await fetchReviews(); // Revert on failure
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
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Review <span className="text-brand-red">HQ</span></h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Manage client testimonials and reviews shown on the homepage.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-brand-black text-white px-8 py-4 font-black uppercase tracking-widest text-sm comic-border border-white hover:bg-brand-red transition-all flex items-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]"
        >
          <Plus size={20} /> Add New Review
        </button>
      </header>

      {/* Reviews Table */}
      <div className="bg-white comic-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b-2 border-brand-black">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-16 text-center">Order</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Client</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Review Text</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Rating</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Badges</th>
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
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400 uppercase tracking-widest text-xs">
                    No reviews in the system. Create one to display on the homepage.
                  </td>
                </tr>
              ) : (
                reviews.map((review, index) => (
                  <tr key={review.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          onClick={() => handleMove(index, 'up')}
                          disabled={index === 0}
                          className={`w-10 h-10 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${index === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-brand-black'}`}
                        >
                          <ChevronUp size={18} />
                        </button>
                        <span className="font-black text-xs">{review.display_order}</span>
                        <button 
                          onClick={() => handleMove(index, 'down')}
                          disabled={index === reviews.length - 1}
                          className={`w-10 h-10 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${index === reviews.length - 1 ? 'text-gray-200 cursor-not-allowed' : 'text-brand-black'}`}
                        >
                          <ChevronDown size={18} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {review.avatar_url ? (
                          <img 
                            src={review.avatar_url} 
                            alt={review.name} 
                            className="w-10 h-10 rounded-full object-cover comic-border border-gray-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand-red/10 border border-brand-red/20 text-brand-red flex items-center justify-center font-black">
                            {review.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-black text-brand-black uppercase tracking-wider">{review.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs md:max-w-md">
                      <p className="text-gray-600 line-clamp-2 italic">"{review.review_text}"</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-0.5 text-brand-red">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={14} 
                            className={i < review.rating ? "fill-current" : "text-gray-200"} 
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleToggleFeatured(review.id, review.is_featured)}
                          className={`px-3 py-2.5 rounded text-[10px] font-black uppercase tracking-wider border transition-all hover:scale-105 active:scale-95 ${
                            review.is_featured 
                              ? 'bg-amber-500 text-white border-amber-600 shadow-[2px_2px_0px_0px_#d97706]' 
                              : 'bg-gray-100 text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Featured
                        </button>
                        <button
                          onClick={() => handleToggleVerified(review.id, review.is_verified_purchase)}
                          className={`px-3 py-2.5 rounded text-[10px] font-black uppercase tracking-wider border transition-all hover:scale-105 active:scale-95 ${
                            review.is_verified_purchase 
                              ? 'bg-green-500 text-white border-green-600 shadow-[2px_2px_0px_0px_#059669]' 
                              : 'bg-gray-100 text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Verified
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(review.id, review.is_active)}
                        className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all comic-border hover:scale-105 active:scale-95 ${
                          review.is_active
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-[2px_2px_0px_0px_#059669]'
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {review.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(review)}
                          className="w-11 h-11 flex items-center justify-center transition-all comic-border border-transparent hover:bg-gray-100 text-gray-500 hover:text-brand-black hover:border-gray-200 active:scale-95"
                          title="Edit Review"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(review.id)}
                          className="w-11 h-11 flex items-center justify-center transition-all comic-border border-transparent hover:bg-red-50 text-gray-400 hover:text-brand-red hover:border-red-200 active:scale-95"
                          title="Delete Review"
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
                  <MessageSquare className="text-brand-red" />
                  {editingReview ? 'Edit Client Review' : 'Create New Review'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-white active:scale-95"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 md:p-8 overflow-y-auto flex-grow space-y-6">
                <form id="review-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Client Name</label>
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. John Doe"
                        required
                        className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      />
                    </div>

                    {/* Rating */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Rating (1 to 5 Stars)</label>
                      <select 
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="w-full p-4 bg-gray-50 comic-border font-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      >
                        {[5, 4, 3, 2, 1].map(r => (
                          <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Review Text */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Review Text</label>
                    <textarea 
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Write the testimonial content..."
                      rows={4}
                      required
                      className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 resize-none"
                    />
                  </div>

                  {/* Avatar Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Client Avatar Image</label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt="Avatar Preview" 
                          className="w-16 h-16 rounded-full object-cover comic-border border-gray-300"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                      
                      <div className="flex-grow space-y-2 w-full sm:w-auto">
                        <div className="flex gap-2">
                          <label className="flex-1 sm:flex-initial bg-white border-2 border-brand-black px-4 py-3 font-black uppercase text-xs tracking-wider cursor-pointer hover:bg-gray-50 transition-colors text-center flex items-center justify-center gap-2">
                            {uploadingAvatar ? (
                              <Loader2 size={14} className="animate-spin text-brand-red" />
                            ) : (
                              <Upload size={14} />
                            )}
                            {uploadingAvatar ? 'Uploading...' : 'Choose File'}
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={handleAvatarUpload}
                              disabled={uploadingAvatar}
                              className="hidden" 
                            />
                          </label>
                          
                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={() => setAvatarUrl('')}
                              className="px-3 py-2 bg-red-50 text-brand-red border border-transparent hover:border-brand-red rounded transition-colors text-xs font-bold"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input 
                          type="text" 
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          placeholder="Or paste an image URL directly..."
                          className="w-full p-2 bg-gray-50 comic-border text-xs font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 comic-border">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                      <input 
                        type="checkbox" 
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 text-brand-red focus:ring-brand-red"
                      />
                      <span>Active</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                      <input 
                        type="checkbox" 
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                        className="w-4 h-4 text-brand-red focus:ring-brand-red"
                      />
                      <span>Featured Review</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                      <input 
                        type="checkbox" 
                        checked={isVerifiedPurchase}
                        onChange={(e) => setIsVerifiedPurchase(e.target.checked)}
                        className="w-4 h-4 text-brand-red focus:ring-brand-red"
                      />
                      <span>Verified Purchase</span>
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
                  form="review-form"
                  disabled={submitting}
                  className="flex-1 bg-brand-red text-white py-4 font-black uppercase text-sm comic-border border-brand-red shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {editingReview ? 'Save Changes' : 'Create Review'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminReviews;

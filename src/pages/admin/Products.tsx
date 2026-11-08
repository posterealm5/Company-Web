import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Star, 
  TrendingUp, 
  Eye, 
  EyeOff,
  X,
  Check,
  Upload,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  AlertTriangle,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product } from '../../types/database';
import { getOptimizedImageUrl, getStorefrontImage } from '../../utils/imageUtils';
import { uploadStorefrontVariants } from '../../utils/imageOptimizer';
import { motion, AnimatePresence } from 'motion/react';

import { ErrorState } from '../../components/ui/ErrorState';
import { 
  generateProductSEO, 
  validateSEOData, 
  bulkGenerateSEOForAll, 
  bulkGenerateSEOForCategory,
  type SEOValidationError 
} from '../../services/seo';
import {
  resolveOriginalPosterArtwork,
  fetchVerifiedStorageArtworks,
  uploadProductOriginalArtwork,
  removeProductOriginalArtwork,
  persistProductArtworkUrl,
  validateArtworkFile,
  MAX_ARTWORK_SIZE_BYTES
} from '../../services/posterArtwork';

const AdminProducts: React.FC = () => {
  const ITEMS_PER_PAGE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [storageArtworksMap, setStorageArtworksMap] = useState<Map<string | number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'seo' | 'artwork'>('basic');
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);
  const [artworkUploading, setArtworkUploading] = useState(false);
  const [pendingStorageUrl, setPendingStorageUrl] = useState<string | null>(null);
  const [artworkMessage, setArtworkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDraggingArtwork, setIsDraggingArtwork] = useState(false);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const [seoState, setSeoState] = useState({
    display_name: '',
    slug: '',
    meta_description: '',
    alt_text: ''
  });
  const [validationErrors, setValidationErrors] = useState<SEOValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const openEditModal = (product: Partial<Product>, initialTab: 'basic' | 'seo' | 'artwork' = 'basic') => {
    const resolvedArt = resolveOriginalPosterArtwork(product as Product, storageArtworksMap);
    const initialArtworkUrl = product.artwork_url || (resolvedArt.isAvailable ? resolvedArt.artworkUrl : null);
    setEditingProduct({
      ...product,
      artwork_url: initialArtworkUrl,
    });
    setSeoState({
      display_name: product.display_name || '',
      slug: product.slug || '',
      meta_description: product.meta_description || '',
      alt_text: product.alt_text || ''
    });
    setActiveTab(initialTab);
    setValidationErrors([]);
    setArtworkFile(null);
    if (artworkPreviewUrl && artworkPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(artworkPreviewUrl);
    }
    setArtworkPreviewUrl(null);
    setPendingStorageUrl(null);
    setArtworkMessage(null);
    setIsModalOpen(true);
  };

  const triggerValidation = async (data: typeof seoState) => {
    setIsValidating(true);
    const errors = await validateSEOData(data, editingProduct?.id);
    setValidationErrors(errors);
    setIsValidating(false);
    return errors;
  };

  const handleArtworkFileSelected = (file: File) => {
    setArtworkMessage(null);
    setPendingStorageUrl(null);
    const validation = validateArtworkFile(file);
    if (!validation.isValid) {
      setArtworkMessage({ type: 'error', text: validation.error || 'Invalid artwork file' });
      return;
    }
    if (artworkPreviewUrl && artworkPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(artworkPreviewUrl);
    }
    const blobUrl = URL.createObjectURL(file);
    setArtworkFile(file);
    setArtworkPreviewUrl(blobUrl);
  };

  const handleUploadArtwork = async () => {
    if (!artworkFile || !editingProduct?.id || artworkUploading) return;
    setArtworkUploading(true);
    setArtworkMessage(null);

    const uploadRes = await uploadProductOriginalArtwork(editingProduct.id, artworkFile);

    if (uploadRes.url && uploadRes.dbSaved) {
      const newUrl = uploadRes.url;
      const updatedMap = new Map(storageArtworksMap);
      updatedMap.set(editingProduct.id, newUrl);
      updatedMap.set(String(editingProduct.id), newUrl);
      setStorageArtworksMap(updatedMap);
      setEditingProduct(prev => prev ? { ...prev, artwork_url: newUrl } : prev);
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, artwork_url: newUrl } : p));
      setArtworkMessage({ 
        type: 'success', 
        text: `Standalone artwork uploaded and saved to Product #${editingProduct.id} successfully! Ready in Poster Kit.` 
      });
      setArtworkFile(null);
      if (artworkPreviewUrl && artworkPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(artworkPreviewUrl);
      }
      setArtworkPreviewUrl(null);
      setPendingStorageUrl(null);
    } else {
      if (uploadRes.storageUrl) {
        setPendingStorageUrl(uploadRes.storageUrl);
      }
      setArtworkMessage({ 
        type: 'error', 
        text: uploadRes.error || 'Failed to complete artwork upload.' 
      });
    }
    setArtworkUploading(false);
  };

  const handleRetryDatabaseSave = async () => {
    if (!pendingStorageUrl || !editingProduct?.id || artworkUploading) return;
    setArtworkUploading(true);
    setArtworkMessage(null);

    const res = await persistProductArtworkUrl(editingProduct.id, pendingStorageUrl);
    if (res.success) {
      const updatedMap = new Map(storageArtworksMap);
      updatedMap.set(editingProduct.id, pendingStorageUrl);
      updatedMap.set(String(editingProduct.id), pendingStorageUrl);
      setStorageArtworksMap(updatedMap);
      setEditingProduct(prev => prev ? { ...prev, artwork_url: pendingStorageUrl } : prev);
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, artwork_url: pendingStorageUrl } : p));
      setArtworkMessage({ 
        type: 'success', 
        text: `Artwork reference successfully persisted to Product #${editingProduct.id}! Ready in Poster Kit.` 
      });
      setArtworkFile(null);
      if (artworkPreviewUrl && artworkPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(artworkPreviewUrl);
      }
      setArtworkPreviewUrl(null);
      setPendingStorageUrl(null);
    } else {
      setArtworkMessage({
        type: 'error',
        text: `Failed to persist to database: ${res.error}. Please retry or check database permissions.`
      });
    }
    setArtworkUploading(false);
  };

  const handleGenerateSEO = () => {
    const formEl = document.getElementById('product-form') as HTMLFormElement | null;
    if (!formEl) return;
    const formData = new FormData(formEl);
    const name = (formData.get('name') as string) || '';
    const genre = (formData.get('genre') as string) || 'Anime';
    const description = (formData.get('description') as string) || '';
    
    const generated = generateProductSEO({ name, genre, description });
    
    const updated = {
      display_name: generated.display_name,
      slug: generated.slug,
      meta_description: generated.meta_description,
      alt_text: generated.alt_text
    };
    setSeoState(updated);
    triggerValidation(updated);
  };

  const handleBulkSEO = async (type: 'all' | 'category') => {
    if (!confirm(`Are you sure you want to generate SEO for ${type === 'all' ? 'ALL active products' : `all products in the "${categoryFilter}" category`}? This will safely fill in any missing SEO fields without overwriting your customized titles and descriptions.`)) {
      return;
    }
    setBulkLoading(true);
    setBulkResult(null);
    
    let res;
    if (type === 'all') {
      res = await bulkGenerateSEOForAll(false);
    } else {
      if (categoryFilter === 'all') {
        alert('Please select a specific category first.');
        setBulkLoading(false);
        return;
      }
      res = await bulkGenerateSEOForCategory(categoryFilter, false);
    }
    
    setBulkResult(`Bulk SEO completed! Updated: ${res.successCount} products, Failed/Unchanged: ${res.failedCount}`);
    fetchProducts();
    setBulkLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError(false);
    try {
      const [{ data, error: fetchErr }, storageArtworks] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false }),
        fetchVerifiedStorageArtworks(),
      ]);
      
      if (fetchErr) {
        console.error('Error fetching products:', fetchErr);
        setError(true);
      } else if (data) {
        setProducts(data);
      }
      setStorageArtworksMap(storageArtworks || new Map());
    } catch (err) {
      console.error('Failed to load products and artworks:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={fetchProducts} />
      </div>
    );
  }

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    
    if (!error) {
      setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    }
  };

  const toggleFeatured = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase
      .from('products')
      .update({ is_featured: !currentStatus })
      .eq('id', id);
    
    if (!error) {
      setProducts(products.map(p => p.id === id ? { ...p, is_featured: !currentStatus } : p));
    }
  };

  const togglePopular = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase
      .from('products')
      .update({ is_popular: !currentStatus })
      .eq('id', id);
    
    if (!error) {
      setProducts(products.map(p => p.id === id ? { ...p, is_popular: !currentStatus } : p));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.genre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || p.genre === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Product <span className="text-brand-red">Vault</span></h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Manage your collection of world-class posters.</p>
        </div>
        <button 
          onClick={() => {
            openEditModal({
              name: '',
              genre: 'Anime',
              price: 0,
              description: '',
              image: '',
              is_active: true,
              is_featured: false,
              is_popular: false,
              tags: []
            });
          }}
          className="bg-brand-black text-white px-8 py-4 font-black uppercase tracking-widest text-sm comic-border border-white hover:bg-brand-red transition-all flex items-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]"
        >
          <Plus size={20} /> Add New Poster
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search vault..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-12 pr-4 py-4 bg-white comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all"
          />
        </div>
        <select 
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-6 py-4 bg-white comic-border font-black uppercase text-xs tracking-widest hover:bg-gray-50 transition-colors focus:outline-none"
        >
          <option value="all">All Categories</option>
          {['Anime', 'Movies', 'Bike', 'Cars', 'Music', 'Pinteresty', 'Gaming', 'Bundle'].map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Bulk SEO Controls */}
      <div className="bg-gray-50 p-6 comic-border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-black uppercase text-sm text-brand-black flex items-center gap-2">
            <Sparkles size={16} className="text-brand-red animate-pulse" /> Bulk SEO Optimization Engine
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
            Perform site-wide metadata creation and optimization in one click.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => handleBulkSEO('category')}
            disabled={bulkLoading || categoryFilter === 'all'}
            className="flex-grow md:flex-grow-0 px-4 py-3 bg-white text-brand-black border-2 border-brand-black hover:bg-brand-red hover:text-white transition-all font-black uppercase text-[10px] tracking-widest disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            {bulkLoading ? 'Processing...' : `Optimize ${categoryFilter === 'all' ? 'Category' : categoryFilter}`}
          </button>
          <button
            onClick={() => handleBulkSEO('all')}
            disabled={bulkLoading}
            className="flex-grow md:flex-grow-0 px-4 py-3 bg-brand-black text-white hover:bg-brand-red transition-all font-black uppercase text-[10px] tracking-widest disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            {bulkLoading ? 'Processing...' : 'Optimize All Products'}
          </button>
        </div>
      </div>
      
      {bulkResult && (
        <div className="bg-green-50 text-green-800 border-2 border-green-200 p-4 font-bold text-xs uppercase flex justify-between items-center">
          <span>{bulkResult}</span>
          <button onClick={() => setBulkResult(null)} className="text-green-800 hover:text-brand-red font-black cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Products List */}
      <div className="bg-white comic-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b-2 border-brand-black">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Product</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Category</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Price</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Artwork (Print)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Visibility</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Promotions</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-brand-red w-10 h-10 mx-auto" />
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                    No posters found in the vault.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const artInfo = resolveOriginalPosterArtwork(p, storageArtworksMap);
                  const hasArtwork = artInfo.isAvailable && Boolean(artInfo.artworkUrl);

                  return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img 
                          src={getStorefrontImage(p, 'thumbnail')} 
                          alt={p.name} 
                          width={50}
                          height={67}
                          loading="lazy"
                          className="w-12 h-16 object-cover comic-border border-gray-200" 
                        />
                        <div>
                          <p className="font-black uppercase text-sm group-hover:text-brand-red transition-colors">{p.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">ID: #{p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-[10px] font-black uppercase tracking-widest rounded">{p.genre}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold">₹{p.price}</p>
                    </td>
                    <td className="px-6 py-4">
                      {hasArtwork ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 text-[10px] font-black uppercase tracking-wider">
                            <Check size={12} className="stroke-[3]" />
                            Clean Art Ready
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditModal(p, 'artwork')}
                            className="text-[10px] font-mono text-gray-500 hover:text-brand-red underline cursor-pointer"
                            title="Manage or replace original print artwork"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                            No Artwork
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditModal(p, 'artwork')}
                            className="text-[10px] font-black text-brand-red hover:underline uppercase cursor-pointer"
                            title="Upload original standalone artwork for Poster Kit"
                          >
                            + Upload
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(p.id, p.is_active)}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 comic-border text-xs font-black uppercase tracking-widest transition-all min-h-[44px] ${p.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                      >
                        {p.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                        {p.is_active ? 'Active' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => toggleFeatured(p.id, p.is_featured)}
                          title="Featured"
                          className={`w-11 h-11 flex items-center justify-center comic-border transition-all hover:scale-105 active:scale-95 ${p.is_featured ? 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-yellow-200 hover:bg-gray-100'}`}
                        >
                          <Star size={18} fill={p.is_featured ? 'currentColor' : 'none'} />
                        </button>
                        <button 
                          onClick={() => togglePopular(p.id, p.is_popular)}
                          title="Most Popular"
                          className={`w-11 h-11 flex items-center justify-center comic-border transition-all hover:scale-105 active:scale-95 ${p.is_popular ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-blue-200 hover:bg-gray-100'}`}
                        >
                          <TrendingUp size={18} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            openEditModal(p);
                          }}
                          className="w-11 h-11 flex items-center justify-center hover:bg-brand-black hover:text-white transition-all comic-border border-transparent hover:border-brand-black active:scale-95 text-gray-600"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="w-11 h-11 flex items-center justify-center hover:bg-brand-red hover:text-white transition-all comic-border border-transparent hover:border-brand-red active:scale-95 text-gray-600"
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

        {/* Pagination Bar */}
        {filteredProducts.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t-2 border-brand-black flex flex-col sm:flex-row items-center justify-between gap-4 font-black uppercase text-xs">
            <p className="text-gray-500 tracking-wider">
              Showing <span className="text-brand-black font-black">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-brand-black font-black">{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}</span> of <span className="text-brand-black font-black">{filteredProducts.length}</span> Posters
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white text-brand-black border-2 border-brand-black comic-border hover:bg-brand-red hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-brand-black cursor-pointer"
                >
                  Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 flex items-center justify-center border-2 border-brand-black comic-border transition-all cursor-pointer ${
                        currentPage === page
                          ? 'bg-brand-black text-white'
                          : 'bg-white text-brand-black hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white text-brand-black border-2 border-brand-black comic-border hover:bg-brand-red hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-brand-black cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
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
              className="relative bg-white comic-border w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="bg-brand-black text-white p-4 md:p-6 flex justify-between items-center border-b-4 border-brand-red">
                <h3 className="text-xl font-black uppercase tracking-widest">
                  {editingProduct?.id ? 'Edit Poster' : 'Forge New Poster'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-white">
                  <X size={24} />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b-2 border-brand-black bg-gray-50">
                <button 
                  type="button"
                  onClick={() => setActiveTab('basic')}
                  className={`flex-1 py-3 font-black uppercase text-xs tracking-widest border-r-2 border-brand-black transition-colors ${activeTab === 'basic' ? 'bg-white text-brand-black border-b-4 border-brand-red' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Basic Info
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('seo')}
                  className={`flex-1 py-3 font-black uppercase text-xs tracking-widest border-r-2 border-brand-black transition-colors ${activeTab === 'seo' ? 'bg-white text-brand-black border-b-4 border-brand-red' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  SEO Settings
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('artwork')}
                  className={`flex-1 py-3 font-black uppercase text-xs tracking-widest transition-colors ${activeTab === 'artwork' ? 'bg-white text-brand-black border-b-4 border-brand-red' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Poster Kit Artwork
                </button>
              </div>

              <div className="p-4 md:p-8 overflow-y-auto flex-grow">
                <form className="space-y-6" id="product-form" onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSaving(true);
                  
                  const formData = new FormData(e.currentTarget);
                  
                  // Validate SEO data
                  const currentSeo = {
                    display_name: seoState.display_name,
                    slug: seoState.slug,
                    meta_description: seoState.meta_description,
                    alt_text: seoState.alt_text,
                  };

                  const errors = await triggerValidation(currentSeo);
                  const hasErrors = errors.some(err => err.type === 'error');
                  if (hasErrors) {
                    setActiveTab('seo'); // switch to SEO tab so they see errors
                    setIsSaving(false);
                    return;
                  }

                  const newImageUrl = formData.get('image') as string;
                  const isImageChanged = editingProduct?.id ? editingProduct.image !== newImageUrl : true;

                  // Preserve original standalone artwork reference
                  const existingProd = products.find(p => p.id === editingProduct?.id);
                  const preservedArtworkUrl = 
                    editingProduct?.artwork_url !== undefined
                      ? editingProduct.artwork_url
                      : (existingProd?.artwork_url ?? (editingProduct?.id ? storageArtworksMap.get(editingProduct.id) : null) ?? null);

                  const productData = {
                    name: formData.get('name') as string,
                    genre: formData.get('genre') as string,
                    price: Number(formData.get('price')),
                    description: formData.get('description') as string,
                    image: newImageUrl,
                    // If image changed on edit, immediately set variant URLs to NULL so stale variants are cleared.
                    // If new product creation, set variant URLs to NULL initially.
                    image_thumbnail_url: (editingProduct?.id && !isImageChanged) ? (editingProduct.image_thumbnail_url ?? null) : null,
                    image_card_url: (editingProduct?.id && !isImageChanged) ? (editingProduct.image_card_url ?? null) : null,
                    image_preview_url: (editingProduct?.id && !isImageChanged) ? (editingProduct.image_preview_url ?? null) : null,
                    is_active: editingProduct?.is_active ?? true,
                    is_featured: editingProduct?.is_featured ?? false,
                    is_popular: editingProduct?.is_popular ?? false,
                    tags: editingProduct?.tags ?? [],
                    // SEO fields
                    display_name: currentSeo.display_name || null,
                    slug: currentSeo.slug || null,
                    meta_description: currentSeo.meta_description || null,
                    alt_text: currentSeo.alt_text || null,
                    // Preserve original standalone artwork reference
                    artwork_url: preservedArtworkUrl
                  };

                  let savedProductId: number | null = null;
                  let dbError: any = null;

                  if (editingProduct?.id) {
                    savedProductId = editingProduct.id;
                    const { error } = await supabase
                      .from('products')
                      .update(productData)
                      .eq('id', editingProduct.id);
                    dbError = error;
                  } else {
                    const { data: newProd, error } = await supabase
                      .from('products')
                      .insert(productData)
                      .select('id')
                      .single();
                    if (newProd) savedProductId = newProd.id;
                    dbError = error;
                  }

                  if (savedProductId && preservedArtworkUrl) {
                    const updatedMap = new Map(storageArtworksMap);
                    updatedMap.set(savedProductId, preservedArtworkUrl);
                    updatedMap.set(String(savedProductId), preservedArtworkUrl);
                    setStorageArtworksMap(updatedMap);
                  }

                  if (dbError || !savedProductId) {
                    alert(dbError?.message || 'Failed to save product');
                    setIsSaving(false);
                    return;
                  }

                  // Post-save storefront WebP variant generation (new product creation or image URL replacement)
                  if (isImageChanged && newImageUrl) {
                    try {
                      const version = Date.now();
                      const variants = await uploadStorefrontVariants(
                        productData.genre,
                        savedProductId,
                        newImageUrl,
                        version
                      );

                      if (variants.image_thumbnail_url && variants.image_card_url && variants.image_preview_url) {
                        await supabase
                          .from('products')
                          .update({
                            image_thumbnail_url: variants.image_thumbnail_url,
                            image_card_url: variants.image_card_url,
                            image_preview_url: variants.image_preview_url,
                          })
                          .eq('id', savedProductId);
                      }
                    } catch (varErr) {
                      console.error('Non-blocking storefront variant generation error:', varErr);
                    }
                  }

                  fetchProducts();
                  setIsModalOpen(false);
                  setIsSaving(false);
                }}>
                  {/* Basic Info Tab Content */}
                  <div className={`space-y-6 ${activeTab === 'basic' ? 'block' : 'hidden'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Poster Name</label>
                        <input 
                          name="name"
                          defaultValue={editingProduct?.name}
                          required
                          className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Category</label>
                        <select 
                          name="genre"
                          defaultValue={editingProduct?.genre}
                          className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        >
                          {['Anime', 'Movies', 'Bike', 'Cars', 'Music', 'Pinteresty', 'Gaming', 'Bundle'].map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Price (₹)</label>
                        <input 
                          name="price"
                          type="number"
                          defaultValue={editingProduct?.price}
                          required
                          className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Image URL</label>
                        <input 
                          name="image"
                          defaultValue={editingProduct?.image}
                          required
                          className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Description</label>
                      <textarea 
                        name="description"
                        defaultValue={editingProduct?.description}
                        rows={4}
                        className="w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 resize-none"
                      />
                    </div>
                  </div>

                  {/* SEO Settings Tab Content */}
                  <div className={`space-y-6 ${activeTab === 'seo' ? 'block' : 'hidden'}`}>
                    <div className="flex justify-between items-center bg-gray-50 p-4 border-2 border-brand-black">
                      <div>
                        <h4 className="font-black uppercase text-xs text-brand-black">SEO Auto-Generation</h4>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Generate optimized display name, slug, description, and alt text.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateSEO}
                        className="px-4 py-2 bg-brand-red text-white font-black uppercase text-[10px] tracking-widest comic-border border-white hover:bg-brand-black transition-colors cursor-pointer"
                      >
                        Generate SEO
                      </button>
                    </div>

                    {/* Display Name */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Display Name</label>
                      <input
                        type="text"
                        value={seoState.display_name}
                        onChange={(e) => {
                          const updated = { ...seoState, display_name: e.target.value };
                          setSeoState(updated);
                          triggerValidation(updated);
                        }}
                        className={`w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 ${
                          validationErrors.some(err => err.field === 'display_name' && err.type === 'error')
                            ? 'border-brand-red ring-2 ring-brand-red/10'
                            : ''
                        }`}
                      />
                      {validationErrors.filter(err => err.field === 'display_name').map((err, i) => (
                        <p key={i} className="text-[10px] font-bold text-brand-red uppercase">{err.message}</p>
                      ))}
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Slug</label>
                      <input
                        type="text"
                        value={seoState.slug}
                        onChange={(e) => {
                          const updated = { ...seoState, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') };
                          setSeoState(updated);
                          triggerValidation(updated);
                        }}
                        className={`w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 ${
                          validationErrors.some(err => err.field === 'slug' && err.type === 'error')
                            ? 'border-brand-red ring-2 ring-brand-red/10'
                            : ''
                        }`}
                      />
                      {validationErrors.filter(err => err.field === 'slug').map((err, i) => (
                        <p key={i} className="text-[10px] font-bold text-brand-red uppercase">{err.message}</p>
                      ))}
                    </div>

                    {/* Meta Description */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Meta Description</label>
                        <span className={`text-[10px] font-black uppercase ${
                          seoState.meta_description.length >= 150 && seoState.meta_description.length <= 160
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}>
                          {seoState.meta_description.length} / 160 chars
                        </span>
                      </div>
                      <textarea
                        value={seoState.meta_description}
                        onChange={(e) => {
                          const updated = { ...seoState, meta_description: e.target.value };
                          setSeoState(updated);
                          triggerValidation(updated);
                        }}
                        rows={3}
                        className={`w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 resize-none ${
                          validationErrors.some(err => err.field === 'meta_description' && err.type === 'error')
                            ? 'border-brand-red ring-2 ring-brand-red/10'
                            : validationErrors.some(err => err.field === 'meta_description' && err.type === 'warning')
                            ? 'border-yellow-500 ring-2 ring-yellow-500/10'
                            : ''
                        }`}
                      />
                      {validationErrors.filter(err => err.field === 'meta_description').map((err, i) => (
                        <p key={i} className={`text-[10px] font-bold uppercase ${err.type === 'error' ? 'text-brand-red' : 'text-yellow-600'}`}>{err.message}</p>
                      ))}
                    </div>

                    {/* Alt Text */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Alt Text (Image Description)</label>
                      <input
                        type="text"
                        value={seoState.alt_text}
                        onChange={(e) => {
                          const updated = { ...seoState, alt_text: e.target.value };
                          setSeoState(updated);
                          triggerValidation(updated);
                        }}
                        className={`w-full p-4 bg-gray-50 comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 ${
                          validationErrors.some(err => err.field === 'alt_text' && err.type === 'error')
                            ? 'border-brand-red ring-2 ring-brand-red/10'
                            : ''
                        }`}
                      />
                      {validationErrors.filter(err => err.field === 'alt_text').map((err, i) => (
                        <p key={i} className="text-[10px] font-bold text-brand-red uppercase">{err.message}</p>
                      ))}
                    </div>
                  </div>

                  {/* Poster Kit Artwork Tab Content */}
                  <div className={`space-y-6 ${activeTab === 'artwork' ? 'block' : 'hidden'}`}>
                    <div className="bg-gray-50 p-4 border-2 border-brand-black space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1 bg-brand-red text-white">
                          <ImageIcon size={16} />
                        </span>
                        <h4 className="font-black uppercase text-xs text-brand-black tracking-wider">
                          Poster Kit Original Print Artwork
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                        The Poster Kit renders clean, standalone poster artwork on its virtual wall. 
                        <strong> Storefront room mockups (room-scenes with walls, desks, or decor) are strictly excluded.</strong>
                        {' '}Upload high-resolution print files (JPEG, PNG, WebP up to 20MB) to make this design available in the Poster Kit.
                      </p>
                    </div>

                    {!editingProduct?.id ? (
                      <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-300 text-center space-y-2">
                        <AlertTriangle size={24} className="text-amber-500 mx-auto" />
                        <p className="font-black uppercase text-xs text-gray-700">Save Poster First</p>
                        <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                          Please fill in basic details on the Basic Info tab and click &ldquo;Add to Vault&rdquo; to generate a product ID. 
                          You can then upload and link verified print artwork immediately.
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const art = resolveOriginalPosterArtwork(editingProduct as Product, storageArtworksMap);
                        const isAvailable = art.isAvailable && Boolean(art.artworkUrl);

                        return (
                          <div className="space-y-5">
                            {/* Current Artwork Status */}
                            <div className="flex items-start justify-between gap-4 p-4 border-2 bg-white">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-20 bg-[#FAF9F6] border border-gray-300 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-xs">
                                  {isAvailable ? (
                                    <img
                                      src={art.artworkUrl!}
                                      alt={editingProduct.name || 'Artwork'}
                                      className="w-full h-full object-contain pointer-events-none"
                                    />
                                  ) : (
                                    <span className="text-[9px] font-mono text-gray-400 text-center">No Art</span>
                                  )}
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">Poster Kit Status:</span>
                                  <div>
                                    {isAvailable ? (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 text-xs font-black uppercase tracking-wider">
                                        <Check size={13} className="stroke-[3]" /> Clean Art Active
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider">
                                        <AlertTriangle size={13} /> Artwork Unavailable (Protected)
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-500 font-mono truncate max-w-xs">
                                    {isAvailable ? art.artworkUrl : 'Room mockups are excluded from Poster Kit'}
                                  </p>
                                </div>
                              </div>

                              {isAvailable && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to remove original artwork for #${editingProduct.id}? This will make it unavailable in the Poster Kit.`)) return;
                                    setArtworkUploading(true);
                                    setArtworkMessage(null);
                                    const res = await removeProductOriginalArtwork(editingProduct.id!);
                                    if (res.success) {
                                      const updatedMap = new Map(storageArtworksMap);
                                      updatedMap.delete(editingProduct.id!);
                                      updatedMap.delete(String(editingProduct.id));
                                      setStorageArtworksMap(updatedMap);
                                      setEditingProduct({ ...editingProduct, artwork_url: null });
                                      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, artwork_url: null } : p));
                                      setArtworkMessage({ type: 'success', text: 'Original artwork removed safely.' });
                                    } else {
                                      setArtworkMessage({ type: 'error', text: res.error || 'Failed to remove artwork' });
                                    }
                                    setArtworkUploading(false);
                                  }}
                                  disabled={artworkUploading}
                                  className="px-3 py-1.5 text-xs text-brand-red border border-brand-red/30 hover:bg-brand-red hover:text-white font-black uppercase transition-colors shrink-0 cursor-pointer"
                                >
                                  Remove Art
                                </button>
                              )}
                            </div>

                            {/* Top Feedback Messages */}
                            {artworkMessage && !artworkFile && !pendingStorageUrl && (
                              <div className={`p-3.5 border-2 text-xs font-bold uppercase flex items-center justify-between ${
                                artworkMessage.type === 'success' 
                                  ? 'bg-green-50 text-green-800 border-green-300' 
                                  : 'bg-red-50 text-brand-red border-brand-red'
                              }`}>
                                <div className="flex items-start gap-2">
                                  {artworkMessage.type === 'success' ? (
                                    <Check size={16} className="text-green-600 shrink-0 mt-0.5 stroke-[3]" />
                                  ) : (
                                    <AlertTriangle size={16} className="text-brand-red shrink-0 mt-0.5" />
                                  )}
                                  <span className="leading-snug">{artworkMessage.text}</span>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => setArtworkMessage(null)} 
                                  className="font-black hover:opacity-75 cursor-pointer ml-3 text-sm p-1"
                                >
                                  ✕
                                </button>
                              </div>
                            )}

                            {/* Storage Succeeded but Database Failed Alert with Direct Retry */}
                            {pendingStorageUrl && (
                              <div className="p-3.5 bg-amber-50 border-2 border-amber-300 text-xs space-y-2">
                                <div className="flex items-center gap-2 text-amber-800 font-black uppercase">
                                  <AlertTriangle size={15} />
                                  <span>Storage Uploaded — Database Persistence Pending</span>
                                </div>
                                <p className="text-[11px] text-amber-800 font-medium">
                                  The clean artwork file was uploaded to Supabase Storage, but writing the link to Product #{editingProduct.id} in the database was not confirmed. Click below to retry database persistence without re-uploading:
                                </p>
                                <button
                                  type="button"
                                  onClick={handleRetryDatabaseSave}
                                  disabled={artworkUploading}
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-xs tracking-wider flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {artworkUploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                  Retry Database Persistence
                                </button>
                              </div>
                            )}

                            {/* Upload / Replace Dropzone */}
                            <div
                              onDragOver={(e) => { e.preventDefault(); setIsDraggingArtwork(true); }}
                              onDragLeave={() => setIsDraggingArtwork(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingArtwork(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleArtworkFileSelected(file);
                              }}
                              className={`p-6 border-2 border-dashed transition-all text-center flex flex-col items-center justify-center bg-gray-50 ${
                                isDraggingArtwork ? 'border-brand-red bg-red-50/40' : 'border-gray-300'
                              }`}
                            >
                              <input
                                ref={artworkInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleArtworkFileSelected(file);
                                }}
                                className="hidden"
                              />
                              <div className="w-12 h-12 bg-white border-2 border-brand-black flex items-center justify-center mb-2 shadow-xs">
                                <Upload size={20} className="text-brand-red" />
                              </div>
                              <p className="font-black uppercase text-xs text-brand-black mb-1">
                                {isAvailable ? 'Replace Standalone Print Artwork' : 'Upload Standalone Print Artwork'}
                              </p>
                              <p className="text-[11px] text-gray-500 max-w-sm mb-3">
                                Drag &amp; drop file here, or click to browse. Supports JPEG, PNG, or WebP up to 20 MB. Stored at <code className="font-mono text-gray-700">posters/artworks/{editingProduct.id}.ext</code>.
                              </p>
                              <button
                                type="button"
                                onClick={() => artworkInputRef.current?.click()}
                                disabled={artworkUploading}
                                className="px-4 py-2 bg-white border-2 border-brand-black text-brand-black font-black uppercase text-xs tracking-wider hover:bg-brand-black hover:text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
                              >
                                Choose Image File
                              </button>
                            </div>

                            {/* Selected File Stage & Upload Trigger */}
                            {artworkFile && (
                              <div className="p-4 bg-white border-2 border-brand-black space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileCheck size={16} className="text-green-600 shrink-0" />
                                    <span className="text-xs font-mono font-bold truncate max-w-xs">{artworkFile.name}</span>
                                    <span className="text-[10px] font-mono text-gray-400">
                                      ({(artworkFile.size / (1024 * 1024)).toFixed(2)} MB)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setArtworkFile(null);
                                      if (artworkPreviewUrl && artworkPreviewUrl.startsWith('blob:')) {
                                        URL.revokeObjectURL(artworkPreviewUrl);
                                      }
                                      setArtworkPreviewUrl(null);
                                      setArtworkMessage(null);
                                    }}
                                    disabled={artworkUploading}
                                    className="text-xs text-gray-500 hover:text-brand-red font-bold uppercase cursor-pointer disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>

                                {artworkPreviewUrl && (
                                  <div className="h-44 bg-[#FAF9F6] border border-gray-200 flex items-center justify-center p-2">
                                    <img
                                      src={artworkPreviewUrl}
                                      alt="Staged Artwork Preview"
                                      className="h-full object-contain pointer-events-none"
                                    />
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={handleUploadArtwork}
                                  disabled={artworkUploading}
                                  className="w-full py-3 bg-brand-red hover:bg-brand-black text-white font-black uppercase text-xs tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                                >
                                  {artworkUploading ? (
                                    <>
                                      <Loader2 size={16} className="animate-spin" />
                                      <span>Uploading to Storage &amp; Persisting to Database...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload size={16} />
                                      <span>Confirm &amp; Apply Standalone Artwork</span>
                                    </>
                                  )}
                                </button>

                                {/* Action-Point Feedback Message */}
                                {artworkMessage && (
                                  <div className={`p-3.5 border-2 text-xs font-bold uppercase flex items-center justify-between ${
                                    artworkMessage.type === 'success' 
                                      ? 'bg-green-50 text-green-800 border-green-300' 
                                      : 'bg-red-50 text-brand-red border-brand-red'
                                  }`}>
                                    <div className="flex items-start gap-2">
                                      {artworkMessage.type === 'success' ? (
                                        <Check size={16} className="text-green-600 shrink-0 mt-0.5 stroke-[3]" />
                                      ) : (
                                        <AlertTriangle size={16} className="text-brand-red shrink-0 mt-0.5" />
                                      )}
                                      <span className="leading-snug">{artworkMessage.text}</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => setArtworkMessage(null)} 
                                      className="font-black hover:opacity-75 cursor-pointer ml-3 text-sm p-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </form>
              </div>

              <div className="p-4 md:p-8 bg-gray-50 border-t-2 border-brand-black flex gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 font-black uppercase text-sm comic-border border-gray-200 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="product-form"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-brand-black text-white font-black uppercase text-sm comic-border border-white hover:bg-brand-red transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  {editingProduct?.id ? 'Update Vault' : 'Add to Vault'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminProducts;

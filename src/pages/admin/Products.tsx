import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product } from '../../types/database';
import { getOptimizedImageUrl } from '../../utils/imageUtils';
import { motion, AnimatePresence } from 'motion/react';

import { ErrorState } from '../../components/ui/ErrorState';
import { 
  generateProductSEO, 
  validateSEOData, 
  bulkGenerateSEOForAll, 
  bulkGenerateSEOForCategory,
  type SEOValidationError 
} from '../../services/seo';

const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'seo'>('basic');
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

  const openEditModal = (product: Partial<Product>) => {
    setEditingProduct(product);
    setSeoState({
      display_name: product.display_name || '',
      slug: product.slug || '',
      meta_description: product.meta_description || '',
      alt_text: product.alt_text || ''
    });
    setActiveTab('basic');
    setValidationErrors([]);
    setIsModalOpen(true);
  };

  const triggerValidation = async (data: typeof seoState) => {
    setIsValidating(true);
    const errors = await validateSEOData(data, editingProduct?.id);
    setValidationErrors(errors);
    setIsValidating(false);
    return errors;
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
    const { data, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (fetchErr) {
      console.error('Error fetching products:', fetchErr);
      setError(true);
    } else if (data) {
      setProducts(data);
    }
    setLoading(false);
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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all"
          />
        </div>
        <select 
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-6 py-4 bg-white comic-border font-black uppercase text-xs tracking-widest hover:bg-gray-50 transition-colors focus:outline-none"
        >
          <option value="all">All Categories</option>
          {['Anime', 'Movies', 'Bike', 'Cars', 'Music', 'Printesty', 'Gaming', 'Bundle'].map(g => (
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
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Visibility</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Promotions</th>
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
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                    No posters found in the vault.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img 
                          src={getOptimizedImageUrl(p.image, 50, 67)} 
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
                ))
              )}
            </tbody>
          </table>
        </div>
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
                  className={`flex-1 py-3 font-black uppercase text-xs tracking-widest transition-colors ${activeTab === 'seo' ? 'bg-white text-brand-black border-b-4 border-brand-red' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  SEO Settings
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
                    seo_keywords: seoState.seo_keywords
                  };

                  const errors = await triggerValidation(currentSeo);
                  const hasErrors = errors.some(err => err.type === 'error');
                  if (hasErrors) {
                    setActiveTab('seo'); // switch to SEO tab so they see errors
                    setIsSaving(false);
                    return;
                  }

                  const productData = {
                    name: formData.get('name') as string,
                    genre: formData.get('genre') as string,
                    price: Number(formData.get('price')),
                    description: formData.get('description') as string,
                    image: formData.get('image') as string,
                    is_active: editingProduct?.is_active ?? true,
                    is_featured: editingProduct?.is_featured ?? false,
                    is_popular: editingProduct?.is_popular ?? false,
                    tags: editingProduct?.tags ?? [],
                    // SEO fields
                    display_name: currentSeo.display_name || null,
                    slug: currentSeo.slug || null,
                    meta_description: currentSeo.meta_description || null,
                    alt_text: currentSeo.alt_text || null
                  };

                  let result;
                  if (editingProduct?.id) {
                    result = await supabase.from('products').update(productData).eq('id', editingProduct.id);
                  } else {
                    result = await supabase.from('products').insert(productData);
                  }

                  if (!result.error) {
                    fetchProducts();
                    setIsModalOpen(false);
                  } else {
                    alert(result.error.message);
                  }
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
                          {['Anime', 'Movies', 'Bike', 'Cars', 'Music', 'Printesty', 'Gaming', 'Bundle'].map(g => (
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

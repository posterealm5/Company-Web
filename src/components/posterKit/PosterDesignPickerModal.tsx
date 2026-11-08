import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Upload,
  Image as ImageIcon,
  ImageOff,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Trash2,
  Layers,
  Info,
} from 'lucide-react';
import type { PlacedPoster, PosterArtwork } from '../../types/posterKit';
import type { Product } from '../../types/database';
import { getProducts } from '../../services/products';
import {
  resolveOriginalPosterArtwork,
  fetchVerifiedStorageArtworks,
  isStorefrontMockupUrl,
} from '../../services/posterArtwork';
import { getProductDisplayName } from '../../utils/productUrls';
import { POSTER_SIZES, getPosterDimensionsInches } from '../../utils/posterKitMath';
import { saveCustomArtworkBlob } from '../../services/posterKitStorage';
import { getOptimizedImageUrl, getStorefrontImage } from '../../utils/imageUtils';
import { getDailySeed, shuffleWithDailySeed } from '../../utils/dailyShuffle';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { processPosterKitCustomUpload } from '../../utils/imageOptimizer';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface PosterDesignPickerModalProps {
  isOpen: boolean;
  targetPoster: PlacedPoster | null;
  onClose: () => void;
  onApplyArtwork: (targetPosterId: string, artwork: PosterArtwork) => void;
  onRemoveArtwork?: (targetPosterId: string) => void;
  onRequireAuth?: () => void;
  portalTarget?: HTMLElement | null;
  dailySeed?: string;
}

export const PosterDesignPickerModal: React.FC<PosterDesignPickerModalProps> = ({
  isOpen,
  targetPoster,
  onClose,
  onApplyArtwork,
  onRemoveArtwork,
  onRequireAuth,
  portalTarget,
  dailySeed,
}) => {
  // Lock target poster ID when modal opens so selection changes cannot misdirect artwork
  const lockedPosterIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<'collections' | 'upload'>('collections');

  // Collections State
  const [products, setProducts] = useState<Product[]>([]);
  const [storageArtworksMap, setStorageArtworksMap] = useState<Map<string | number, string>>(new Map());
  const [showOnlyVerified, setShowOnlyVerified] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Daily seed matching Collections page date boundary (YYYY-MM-DD local time)
  const [currentDateStr, setCurrentDateStr] = useState(dailySeed || getDailySeed);

  useEffect(() => {
    if (dailySeed) {
      setCurrentDateStr(dailySeed);
      return;
    }
    const interval = setInterval(() => {
      const todayStr = getDailySeed();
      setCurrentDateStr((prev) => (prev !== todayStr ? todayStr : prev));
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [dailySeed]);

  // Deterministic daily shuffle matching Collections page behavior
  const dailyShuffledProducts = useMemo(() => {
    if (products.length === 0) return [];
    return shuffleWithDailySeed(products, currentDateStr);
  }, [products, currentDateStr]);

  // Custom Upload State
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customPreviewUrl, setCustomPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref tracking unapplied preview blob URLs owned by this modal
  const unappliedBlobUrlRef = useRef<string | null>(null);

  // Phase 3B: Authentication & Cloud Upload State
  const { user } = useAuth();
  const { triggerNotification } = useNotification();
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);

  // Lock target poster ID upon opening
  useEffect(() => {
    if (isOpen && targetPoster) {
      lockedPosterIdRef.current = targetPoster.id;
    } else if (!isOpen) {
      lockedPosterIdRef.current = null;
    }
  }, [isOpen, targetPoster]);

  // Clean up any unapplied blob when modal unmounts
  useEffect(() => {
    return () => {
      if (unappliedBlobUrlRef.current && unappliedBlobUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(unappliedBlobUrlRef.current);
        } catch (e) {
          // Safe fallback
        }
        unappliedBlobUrlRef.current = null;
      }
    };
  }, []);

  // Fetch Collections products when modal opens (if not already loaded)
  useEffect(() => {
    if (isOpen && products.length === 0 && !isLoadingProducts) {
      fetchCatalog();
    }
  }, [isOpen, products.length]);

  const fetchCatalog = async () => {
    setIsLoadingProducts(true);
    setProductsError(null);
    try {
      const [data, storageArtworks] = await Promise.all([
        getProducts(),
        fetchVerifiedStorageArtworks(),
      ]);
      setProducts(data || []);
      setStorageArtworksMap(storageArtworks || new Map());
    } catch (err: any) {
      console.error('Failed to load collections for Poster Kit:', err);
      setProductsError('Unable to load collection posters. Please try again.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Clean up any unapplied temporary blob URL when closing or unmounting
  const cleanupUnappliedBlob = () => {
    // Only revoke if the blob URL is unapplied (not transferred to a poster)
    if (unappliedBlobUrlRef.current && unappliedBlobUrlRef.current.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(unappliedBlobUrlRef.current);
      } catch (e) {
        // Safe fallback
      }
      unappliedBlobUrlRef.current = null;
    }
    setCustomPreviewUrl(null);
    setCustomFile(null);
    setUploadError(null);
  };

  const handleClose = () => {
    cleanupUnappliedBlob();
    setSelectedProduct(null);
    setSearchQuery('');
    onClose();
  };

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Count of products that have verified original artwork
  const verifiedCatalogCount = useMemo(() => {
    return products.filter((p) => {
      const art = resolveOriginalPosterArtwork(p, storageArtworksMap);
      return art.isAvailable && Boolean(art.artworkUrl);
    }).length;
  }, [products, storageArtworksMap]);

  // Available genres derived from active catalog (or verified subset when filtering verified)
  const availableGenres = useMemo(() => {
    const pool = showOnlyVerified
      ? products.filter((p) => {
          const art = resolveOriginalPosterArtwork(p, storageArtworksMap);
          return art.isAvailable && Boolean(art.artworkUrl);
        })
      : products;
    const genres = Array.from(new Set(pool.map((p) => p.genre).filter(Boolean)));
    return ['All', ...genres];
  }, [products, showOnlyVerified, storageArtworksMap]);

  // Filtered products list: Displays ONLY verified original artwork by default, in daily-random order
  const filteredProducts = useMemo(() => {
    let result = dailyShuffledProducts;

    if (showOnlyVerified) {
      result = result.filter((p) => {
        const art = resolveOriginalPosterArtwork(p, storageArtworksMap);
        return art.isAvailable && Boolean(art.artworkUrl);
      });
    }

    if (selectedGenre && selectedGenre !== 'All') {
      result = result.filter(
        (p) => p.genre && p.genre.toLowerCase() === selectedGenre.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const dispName = (p.display_name || '').toLowerCase();
        const genre = (p.genre || '').toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
        return (
          name.includes(q) ||
          dispName.includes(q) ||
          genre.includes(q) ||
          tags.includes(q)
        );
      });
    }

    return result;
  }, [dailyShuffledProducts, showOnlyVerified, storageArtworksMap, selectedGenre, searchQuery]);

  // Handle applying a Collection product
  const handleApplyCollectionProduct = (product: Product) => {
    const targetId = lockedPosterIdRef.current || targetPoster?.id;
    if (!targetId) return;

    // Resolve verified original artwork from Supabase Storage or dedicated fields
    const artworkInfo = resolveOriginalPosterArtwork(product, storageArtworksMap);

    // STRICT SAFETY CHECK: Never apply room-scene mockups to the wall grid
    if (
      !artworkInfo.isAvailable ||
      !artworkInfo.artworkUrl ||
      isStorefrontMockupUrl(artworkInfo.artworkUrl)
    ) {
      console.warn(
        `Cannot apply poster design: original artwork is unavailable in Supabase Storage for product ${product.id}.`
      );
      return;
    }

    const displayName = getProductDisplayName(product) || product.name;

    const artwork: PosterArtwork = {
      source: 'collection',
      url: artworkInfo.artworkUrl,
      productId: product.id,
      title: displayName,
      isBlobUrl: false,
      mockupUrl: product.image,
      image_thumbnail_url: product.image_thumbnail_url,
      image_card_url: product.image_card_url,
      image_preview_url: product.image_preview_url,
    };

    onApplyArtwork(targetId, artwork);
    handleClose();
  };

  // File validation
  const validateAndSelectFile = (file: File) => {
    setUploadError(null);

    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const isAllowedType =
      ALLOWED_IMAGE_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(fileExt);

    if (!isAllowedType) {
      setUploadError(
        'Unsupported file format. Please upload a JPEG, PNG, or WebP image.'
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(
        `File size (${sizeMb} MB) exceeds the 10 MB limit. Please select a smaller image.`
      );
      return;
    }

    // Clean up previous unapplied preview blob if user picks another image
    if (unappliedBlobUrlRef.current && unappliedBlobUrlRef.current.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(unappliedBlobUrlRef.current);
      } catch (e) {
        // Safe fallback
      }
      unappliedBlobUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    unappliedBlobUrlRef.current = objectUrl;
    setCustomFile(file);
    setCustomPreviewUrl(objectUrl);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  // Apply Custom Uploaded Artwork
  const handleApplyCustomArtwork = async () => {
    const targetId = lockedPosterIdRef.current || targetPoster?.id;
    if (!targetId || !customFile) {
      setUploadError('Please select a valid image to apply.');
      return;
    }

    // Require authentication before any cloud upload is attempted (Bug 1 Fix)
    if (!user) {
      handleClose();
      onRequireAuth?.();
      return;
    }

    setIsUploadingCloud(true);
    setUploadError(null);

    try {
      // 1. Persist custom artwork blob to IndexedDB as durable local backup (safeguard)
      const customArtworkId = targetPoster?.customArtworkId || `custom-art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      try {
        await saveCustomArtworkBlob(customArtworkId, customFile, customFile.name);
      } catch (dbErr) {
        console.warn('Failed to persist custom artwork to IndexedDB backup:', dbErr);
      }

      // 2. Perform two-stage Phase 3B cloud upload with SHA-256 deduplication
      const uploadResult = await processPosterKitCustomUpload(customFile, {
        userId: user!.id,
        customArtworkId,
        customArtworkFileName: customFile.name,
      });

      if (uploadResult.error || !uploadResult.artwork_url || !uploadResult.image) {
        setUploadError(uploadResult.error || 'Failed to upload artwork to cloud. Please check your connection and try again.');
        setIsUploadingCloud(false);
        return;
      }

      // 3. Relinquish modal ownership of unapplied preview blob URL
      unappliedBlobUrlRef.current = null;

      // 4. Construct verified PosterArtwork pointing to permanent cloud URLs
      const artwork: PosterArtwork = {
        source: 'custom',
        url: uploadResult.image, // 400px WebP preview URL
        originalArtworkUrl: uploadResult.artwork_url, // Original uncompressed master URL
        title: 'Custom Design',
        isBlobUrl: false,
        customArtworkId: uploadResult.customArtworkId || customArtworkId,
        customArtworkFileName: customFile.name,
      };

      onApplyArtwork(targetId, artwork);
      handleClose();
    } catch (err: any) {
      console.error('Failed to apply custom artwork:', err);
      // If applying failed, restore modal ownership so user can retry
      unappliedBlobUrlRef.current = customPreviewUrl;
      setUploadError(err?.message || 'Failed to apply custom artwork to poster. Please try again.');
    } finally {
      setIsUploadingCloud(false);
    }
  };

  // Remove current artwork from targeted poster
  const handleRemoveCurrentArtwork = () => {
    const targetId = lockedPosterIdRef.current || targetPoster?.id;
    if (!targetId || !onRemoveArtwork) return;
    onRemoveArtwork(targetId);
    handleClose();
  };

  if (!isOpen || !targetPoster) return null;

  const targetSizeConfig = POSTER_SIZES[targetPoster.sizeId];
  const targetOrientation = targetPoster.orientation || 'portrait';
  const targetDimensions = getPosterDimensionsInches(
    targetPoster.sizeId,
    targetOrientation
  );
  const currentArtwork = targetPoster.artworkUrl || targetPoster.artwork?.url;

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs select-none pointer-events-auto"
        data-testid="poster-design-picker-modal"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(230,57,70,0.4)] overflow-hidden text-brand-black dark:text-zinc-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b-2 border-brand-black dark:border-zinc-700 bg-neutral-50 dark:bg-zinc-900 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-brand-red text-white comic-border border-black dark:border-zinc-700 shrink-0">
                  <ImageIcon size={16} />
                </span>
                <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight truncate">
                  {currentArtwork ? 'Change Poster Design' : 'Add Poster Design'}
                </h2>
              </div>

              {/* Target Poster Badge */}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-950/40 border border-brand-red/40 text-[11px] font-mono text-brand-red font-bold self-start sm:self-auto shrink-0">
                <span>TARGET:</span>
                <span className="font-display font-black">{targetPoster.label}</span>
                <span>•</span>
                <span>
                  {targetSizeConfig.name} ({targetOrientation})
                </span>
                <span className="text-neutral-500 hidden sm:inline">[{targetDimensions}]</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-neutral-500 hover:text-brand-red hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-red shrink-0"
              aria-label="Close design picker"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b-2 border-neutral-200 dark:border-zinc-800 px-3 sm:px-6 bg-white dark:bg-zinc-900 shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('collections')}
              data-testid="tab-collections"
              className={`flex items-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 font-display text-xs sm:text-sm font-black uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${
                activeTab === 'collections'
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Layers size={15} />
              <span>Posterealm Collections</span>
              {products.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400 font-bold border border-neutral-300 dark:border-zinc-700">
                  {showOnlyVerified ? `${verifiedCatalogCount} Ready` : `${products.length}`}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              data-testid="tab-upload"
              className={`flex items-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 font-display text-xs sm:text-sm font-black uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${
                activeTab === 'upload'
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Upload size={15} />
              <span>Upload Custom Artwork</span>
            </button>
          </div>

          {/* Tab Content Area (Scrollable) */}
          <div className="flex-1 overflow-y-auto min-h-[320px] max-h-[62vh] sm:max-h-[66vh] p-3 sm:p-6 bg-neutral-50/60 dark:bg-zinc-950/40">
            {/* TAB 1: COLLECTIONS */}
            {activeTab === 'collections' && (
              <div className="space-y-4">
                {/* Search & Genre Filters Toolbar */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-zinc-500"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search posters by title, genre, or keyword..."
                      className="w-full pl-9 pr-8 py-2 bg-white dark:bg-zinc-800 border-2 border-neutral-300 dark:border-zinc-700 text-xs sm:text-sm text-brand-black dark:text-zinc-100 placeholder-neutral-400 focus:outline-none focus:border-brand-black dark:focus:border-brand-red"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-brand-red"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filter Toolbar Actions (Genre Pills & Verified Toggle) */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setShowOnlyVerified((prev) => !prev)}
                      className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0 ${
                        showOnlyVerified
                          ? 'bg-green-50 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
                          : 'bg-white dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400 border-neutral-300 dark:border-zinc-700 hover:border-brand-black'
                      }`}
                      title={
                        showOnlyVerified
                          ? 'Currently showing only products with verified standalone print artwork. Click to view all catalog items.'
                          : 'Currently viewing all catalog products. Click to show only verified print artwork.'
                      }
                    >
                      <Check size={12} className={showOnlyVerified ? 'text-green-700 stroke-[3]' : 'opacity-0'} />
                      <span>{showOnlyVerified ? `Verified Art (${verifiedCatalogCount})` : `All Catalog (${products.length})`}</span>
                    </button>

                    {/* Quick Genre Pills */}
                    {availableGenres.slice(0, 8).map((genre) => {
                      const isActive = selectedGenre.toLowerCase() === genre.toLowerCase();
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => setSelectedGenre(genre)}
                          className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                            isActive
                              ? 'bg-brand-black dark:bg-brand-red text-white border-brand-black dark:border-brand-red'
                              : 'bg-white dark:bg-zinc-800 text-neutral-700 dark:text-zinc-300 border-neutral-300 dark:border-zinc-700 hover:border-brand-black'
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Original Artwork Transparency Notice */}
                <div className="flex items-start sm:items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-zinc-800/80 border border-neutral-300 dark:border-zinc-700 text-neutral-700 dark:text-zinc-300 text-xs">
                  <Info size={14} className="shrink-0 text-brand-red mt-0.5 sm:mt-0" />
                  <p className="leading-snug text-[11px] sm:text-xs">
                    <strong>Original Designs Only:</strong> Poster Kit renders clean, original poster artwork directly from Supabase Storage. Storefront room mockups (room walls, desks, and figurines) are strictly excluded.
                  </p>
                </div>

                {/* State: Loading */}
                {isLoadingProducts && (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-brand-red" />
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-600 dark:text-zinc-400 font-mono">
                      Loading Posterealm Collection Artwork...
                    </p>
                  </div>
                )}

                {/* State: Error */}
                {!isLoadingProducts && productsError && (
                  <div className="flex flex-col items-center justify-center py-12 text-center p-6 bg-red-50 dark:bg-red-950/20 border-2 border-brand-red space-y-3">
                    <AlertTriangle size={32} className="text-brand-red" />
                    <p className="text-sm font-bold text-brand-red">{productsError}</p>
                    <button
                      type="button"
                      onClick={fetchCatalog}
                      className="px-4 py-2 bg-brand-red text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} />
                      <span>Retry</span>
                    </button>
                  </div>
                )}

                {/* State: Empty Search / Filter Results or Verified Art Pending */}
                {!isLoadingProducts && !productsError && filteredProducts.length === 0 && (
                  showOnlyVerified && verifiedCatalogCount === 0 ? (
                    /* Clear explanation when no products have verified artwork assigned yet */
                    <div className="flex flex-col items-center justify-center py-10 text-center p-6 border-2 border-brand-black dark:border-zinc-700 space-y-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(230,57,70,0.3)]">
                      <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500 text-amber-600 flex items-center justify-center mb-1">
                        <ImageOff size={24} />
                      </div>
                      <h3 className="font-display font-black text-base uppercase">Original Standalone Artwork Required</h3>
                      <p className="text-xs text-neutral-600 dark:text-zinc-300 max-w-md leading-relaxed">
                        All 155 storefront catalog items currently use room-scene mockups (walls, desks, figurines, and decor). To keep the virtual wall realistic and pristine, storefront mockups are strictly excluded from the Poster Kit.
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-zinc-400 max-w-md">
                        Administrators can upload standalone print artwork via the <strong>Admin Vault &gt; Poster Kit Artwork</strong>.
                      </p>
                      <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveTab('upload')}
                          className="px-4 py-2 bg-brand-red text-white font-display text-xs font-black uppercase tracking-wider transition-all comic-border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
                        >
                          <Upload size={14} />
                          <span>Upload Custom Artwork</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowOnlyVerified(false)}
                          className="px-4 py-2 bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 text-neutral-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider transition-colors border border-neutral-300 dark:border-zinc-700"
                        >
                          View Catalog Status ({products.length})
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Search / Genre filter empty state */
                    <div className="flex flex-col items-center justify-center py-12 text-center p-6 border-2 border-dashed border-neutral-300 dark:border-zinc-700 space-y-3 bg-white dark:bg-zinc-900">
                      <ImageIcon size={32} className="text-neutral-400" />
                      <h3 className="font-display font-black text-base uppercase">No Posters Found</h3>
                      <p className="text-xs text-neutral-500 max-w-xs">
                        No artwork matches &ldquo;{searchQuery}&rdquo; in {selectedGenre}. Try adjusting your search query or category filter.
                      </p>
                      {(searchQuery || selectedGenre !== 'All') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedGenre('All');
                          }}
                          className="px-3 py-1.5 bg-neutral-100 dark:bg-zinc-800 text-neutral-800 dark:text-zinc-200 text-xs font-bold uppercase tracking-wider hover:bg-neutral-200 transition-colors"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  )
                )}

                {/* Product Grid */}
                {!isLoadingProducts && !productsError && filteredProducts.length > 0 && (
                  <div className="grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3">
                    {filteredProducts.map((product) => {
                      const artworkInfo = resolveOriginalPosterArtwork(product, storageArtworksMap);
                      const hasOriginalArtwork = artworkInfo.isAvailable && Boolean(artworkInfo.artworkUrl);
                      const title = getProductDisplayName(product) || product.name;
                      const isSelectedInModal = selectedProduct?.id === product.id;

                      return (
                        <div
                          key={product.id}
                          data-testid={`collection-product-card-${product.id}`}
                          data-has-artwork={hasOriginalArtwork ? 'true' : 'false'}
                          onClick={() => setSelectedProduct(product)}
                          onDoubleClick={() => {
                            if (hasOriginalArtwork) {
                              handleApplyCollectionProduct(product);
                            }
                          }}
                          className={`group relative bg-white dark:bg-zinc-800 border-2 transition-all cursor-pointer flex flex-col overflow-hidden text-left ${
                            isSelectedInModal
                              ? 'border-brand-red ring-2 ring-brand-red/40 shadow-[3px_3px_0px_0px_rgba(230,57,70,1)]'
                              : 'border-neutral-300 dark:border-zinc-700 hover:border-brand-black dark:hover:border-zinc-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]'
                          }`}
                        >
                          {/* Neutral Artwork Cardstock Container (object-contain, neutral background) */}
                          <div className="relative aspect-[1/1.414] bg-[#FAF9F6] dark:bg-zinc-900 overflow-hidden flex items-center justify-center p-2 border-b border-neutral-200 dark:border-zinc-700">
                            {hasOriginalArtwork ? (
                              <>
                                <img
                                  src={getStorefrontImage(product, 'card')}
                                  alt={title}
                                  className="w-full h-full object-contain pointer-events-none transition-transform duration-200 group-hover:scale-105 select-none"
                                  loading="lazy"
                                />
                                {isSelectedInModal && (
                                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-brand-red text-white flex items-center justify-center rounded-none shadow">
                                    <Check size={12} className="stroke-[3]" />
                                  </div>
                                )}
                              </>
                            ) : (
                              /* Safe Fallback: Original Artwork Unavailable (Never renders room mockup) */
                              <div className="relative w-full h-full flex flex-col items-center justify-center p-2 text-center select-none bg-[#FAF9F6] dark:bg-zinc-900">
                                {/* Architectural corner crop marks */}
                                <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-neutral-400/60 dark:border-zinc-600 pointer-events-none" />
                                <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-neutral-400/60 dark:border-zinc-600 pointer-events-none" />
                                <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-neutral-400/60 dark:border-zinc-600 pointer-events-none" />
                                <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-neutral-400/60 dark:border-zinc-600 pointer-events-none" />

                                <div className="p-1.5 bg-neutral-100 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 mb-1 border border-neutral-200 dark:border-zinc-700">
                                  <ImageOff size={15} />
                                </div>
                                <span className="text-[9px] sm:text-[10px] font-display font-black uppercase text-neutral-600 dark:text-zinc-300 tracking-wider">
                                  Artwork Unavailable
                                </span>
                                <span className="text-[8px] font-mono text-neutral-400 dark:text-zinc-500 mt-0.5 leading-tight">
                                  Original Art Pending
                                </span>
                                <span className="text-[7px] font-mono font-bold text-neutral-500 dark:text-zinc-400 mt-1 uppercase tracking-wider bg-neutral-200/70 dark:bg-zinc-800 px-1 py-0.2 border border-neutral-300 dark:border-zinc-700">
                                  Mockup Excluded
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info & Apply Bar */}
                          <div className="p-2 flex flex-col justify-between flex-1 bg-white dark:bg-zinc-800 border-t border-neutral-200 dark:border-zinc-700">
                            <div>
                              <span className="text-[9px] font-mono font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest block truncate">
                                {product.genre || 'Collection'}
                              </span>
                              <h4 className="font-display font-black text-xs uppercase leading-tight line-clamp-1 mt-0.5 text-neutral-900 dark:text-zinc-100">
                                {title}
                              </h4>
                            </div>

                            {hasOriginalArtwork ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplyCollectionProduct(product);
                                }}
                                className="mt-2 w-full py-1 px-1.5 bg-brand-black hover:bg-brand-red dark:bg-zinc-700 dark:hover:bg-brand-red text-white text-[10px] font-display font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                title={`Apply ${title} to ${targetPoster.label}`}
                              >
                                <span>Apply Design</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 w-full py-1 px-1.5 bg-neutral-100 dark:bg-zinc-800/80 text-neutral-400 dark:text-zinc-500 text-[10px] font-display font-black uppercase tracking-wider border border-neutral-200 dark:border-zinc-700 cursor-not-allowed flex items-center justify-center gap-1"
                                title="Original artwork file is unavailable in Supabase Storage. Room mockups cannot be applied."
                              >
                                <span>Art Pending</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: UPLOAD CUSTOM ARTWORK */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative p-6 sm:p-10 border-2 border-dashed transition-all flex flex-col items-center justify-center text-center bg-white dark:bg-zinc-900 ${
                    isDraggingOver
                      ? 'border-brand-red bg-red-50/50 dark:bg-red-950/20'
                      : 'border-neutral-300 dark:border-zinc-700'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="poster-custom-file-input"
                  />

                  <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 border-2 border-brand-red text-brand-red flex items-center justify-center mb-3">
                    <Upload size={24} />
                  </div>

                  <h3 className="font-display font-black text-base sm:text-lg uppercase tracking-tight mb-1">
                    Upload Your Own Poster Art
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-zinc-400 max-w-md mb-4 leading-relaxed font-medium">
                    Drag and drop your image file here, or click below to choose a file from your device.
                    Supports JPEG, PNG, or WebP files up to 10 MB.
                  </p>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-brand-red hover:bg-brand-black text-white font-display text-xs sm:text-sm uppercase tracking-wider transition-all comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-2"
                  >
                    <Upload size={16} />
                    <span>Choose Image File</span>
                  </button>

                  <span className="text-[10px] font-mono text-neutral-400 dark:text-zinc-500 uppercase tracking-widest mt-3">
                    Max size: 10 MB • Instant local preview • Privacy preserved
                  </span>
                </div>

                {/* Validation / Error Message */}
                {uploadError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border-2 border-brand-red flex items-center gap-2 text-xs font-bold text-brand-red">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Upload Preview Container */}
                {customPreviewUrl && (
                  <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-zinc-800 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold uppercase text-brand-red">Preview:</span>
                        <span className="text-xs font-mono text-neutral-600 dark:text-zinc-300 truncate max-w-xs">
                          {customFile?.name}
                        </span>
                        {customFile && (
                          <span className="text-[10px] font-mono text-neutral-400">
                            ({(customFile.size / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-neutral-600 hover:text-brand-red underline font-bold uppercase"
                      >
                        Change File
                      </button>
                    </div>

                    {/* Preview Box styled like realistic cardstock */}
                    <div className="w-full flex items-center justify-center p-4 bg-neutral-100 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800">
                      <div className="max-h-56 max-w-sm aspect-[1/1.414] bg-[#FAF9F6] border border-neutral-300 shadow-md flex items-center justify-center overflow-hidden">
                        <img
                          src={customPreviewUrl}
                          alt="Custom Upload Preview"
                          className="w-full h-full object-cover object-center pointer-events-none select-none block"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-500 dark:text-zinc-400 font-medium text-center">
                      The artwork will fit edge-to-edge inside the {targetSizeConfig.name} printable surface.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-6 py-3 border-t-2 border-brand-black dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0">
            {/* Left: Remove Artwork (if poster has one) */}
            <div>
              {currentArtwork && onRemoveArtwork && (
                <button
                  type="button"
                  onClick={handleRemoveCurrentArtwork}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-zinc-400 hover:text-brand-red flex items-center gap-1.5 transition-colors border border-transparent hover:border-neutral-300 dark:hover:border-zinc-700"
                  title="Remove artwork and revert to blank cardstock placeholder"
                >
                  <Trash2 size={13} />
                  <span>Remove Artwork</span>
                </button>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>

              {activeTab === 'upload' && customPreviewUrl && (
                <button
                  type="button"
                  disabled={isUploadingCloud}
                  onClick={handleApplyCustomArtwork}
                  data-testid="apply-custom-artwork-btn"
                  className="px-5 py-2 bg-brand-red hover:bg-brand-black text-white font-display text-xs sm:text-sm font-black uppercase tracking-wider transition-all comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isUploadingCloud ? (
                    <>
                      <Loader2 size={14} className="animate-spin stroke-[3]" />
                      <span>Uploading Artwork...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} className="stroke-[3]" />
                      <span>Apply to {targetPoster.label}</span>
                    </>
                  )}
                </button>
              )}

              {activeTab === 'collections' && selectedProduct && (
                (() => {
                  const selectedArtworkInfo = resolveOriginalPosterArtwork(
                    selectedProduct,
                    storageArtworksMap
                  );
                  const isSelectedAvailable =
                    selectedArtworkInfo.isAvailable && Boolean(selectedArtworkInfo.artworkUrl);

                  return (
                    <button
                      type="button"
                      disabled={!isSelectedAvailable}
                      onClick={() => {
                        if (isSelectedAvailable) {
                          handleApplyCollectionProduct(selectedProduct);
                        }
                      }}
                      data-testid="apply-collection-artwork-btn"
                      className={`px-5 py-2 font-display text-xs sm:text-sm font-black uppercase tracking-wider transition-all comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 ${
                        isSelectedAvailable
                          ? 'bg-brand-red hover:bg-brand-black text-white cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                          : 'bg-neutral-200 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        isSelectedAvailable
                          ? `Apply ${getProductDisplayName(selectedProduct) || selectedProduct.name} to ${targetPoster.label}`
                          : 'Original artwork is not yet available in Supabase Storage for this poster.'
                      }
                    >
                      <Check size={14} className="stroke-[3]" />
                      <span>{isSelectedAvailable ? 'Apply Selected Artwork' : 'Artwork Unavailable'}</span>
                    </button>
                  );
                })()
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  const container =
    portalTarget ||
    (typeof document !== 'undefined'
      ? (document.fullscreenElement as HTMLElement) || document.body
      : null);

  if (!container) return null;

  return createPortal(modalContent, container);
};

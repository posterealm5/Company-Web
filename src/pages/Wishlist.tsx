import React, { useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist, WishlistProduct } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { ArrowLeft, Heart, Eye, ShoppingCart, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { POSTER_PRICING, BUNDLE_OPTIONS, calculateSinglePosterPrice } from '../config/pricing';
import { getProductDisplayName } from '../utils/productUrls';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl, getStorefrontImage } from '../utils/imageUtils';
import { ProtectedImage } from '../components/ProtectedImage';
import { ProductDetailContent } from '../components/product/ProductDetailContent';
import { SIZES } from '../utils/sizeHelper';
import { getProductById } from '../services/products';
import type { Product } from '../types/database';

const MATERIALS = [
  { id: 'matte', name: 'Matte', desc: 'Non-reflective, professional finish' },
  { id: 'glossy', name: 'Glossy', desc: 'Vibrant colors, high shine' },
  { id: 'flagship', name: 'Flagship Material', desc: 'Heavyweight archival stock, textured' },
];

export default function Wishlist() {
  const navigate = useNavigate();
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart, triggerNotification } = useCart();
  const removeBtnRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<any>(SIZES[2]); // Default A3
  const [selectedMaterial, setSelectedMaterial] = useState<any>(MATERIALS[0]); // Default Matte

  const handleOpenModal = useCallback(async (item: WishlistProduct) => {
    const isBundle = item.genre?.toLowerCase() === 'bundle';
    setSelectedMaterial(MATERIALS[0]);
    if (isBundle) {
      setSelectedSize(BUNDLE_OPTIONS[0]);
    } else {
      setSelectedSize(SIZES[2]);
    }

    let fullProduct: Product | null = null;
    try {
      fullProduct = await getProductById(item.product_id);
    } catch (e) {
      fullProduct = null;
    }

    const prod: Product = fullProduct || {
      id: item.product_id,
      name: item.title,
      display_name: item.title,
      genre: item.genre || 'Anime',
      price: item.price || 79,
      image: item.image,
      image_thumbnail_url: null,
      image_card_url: null,
      image_preview_url: null,
      description: `Premium quality ${item.title} poster printed on archival paper. Perfect for room decor.`,
      slug: item.product_slug || null,
      seo_title: null,
      meta_description: null,
      alt_text: item.title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      is_featured: false,
      is_popular: false,
      tags: []
    };

    setSelectedProduct(prod);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const handleConfirmAddToCart = useCallback(() => {
    if (!selectedProduct || !selectedSize || !selectedMaterial) return;

    const isBundle = selectedProduct.genre?.toLowerCase() === 'bundle';
    const finalPrice = isBundle
      ? selectedSize.price
      : calculateSinglePosterPrice(selectedSize.name, selectedMaterial.name);

    addToCart({
      id: selectedProduct.id,
      name: getProductDisplayName(selectedProduct),
      price: finalPrice,
      image: selectedProduct.image,
      quantity: 1,
      size: selectedSize.name,
      material: selectedMaterial.name,
      selected_size: selectedSize.name,
      selected_material: selectedMaterial.name,
      unit_price: finalPrice,
      line_total: finalPrice
    });

    // Remove item from Wishlist only after customer explicitly confirms add/move to cart
    removeFromWishlist(selectedProduct.id);

    triggerNotification("Added to Cart 🛒");
    handleCloseModal();
  }, [selectedProduct, selectedSize, selectedMaterial, addToCart, removeFromWishlist, triggerNotification, handleCloseModal]);

  const handleRemoveFromWishlist = useCallback((productId: number) => {
    removeFromWishlist(productId);
  }, [removeFromWishlist]);

  const setRef = useCallback((productId: number, el: HTMLButtonElement | null) => {
    removeBtnRefs.current[productId] = el;
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  const isBundleModal = selectedProduct?.genre?.toLowerCase() === 'bundle';

  return (
    <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SEO metadata={getNonIndexableMetadata('Wishlist', '/wishlist')} />
      {/* Header with BACK button */}
      <div className="flex flex-col gap-4 mb-12">
        <div>
          <button 
            onClick={handleBack}
            className="group px-4 py-2 border-2 border-brand-black hover:bg-gray-100 transition-all bg-white font-bold uppercase text-xs tracking-widest flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] cursor-pointer"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
          MY <span className="text-brand-red">WISHLIST</span>
        </h1>
      </div>

      {wishlist.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center text-center py-20 bg-white comic-border p-8 md:p-16 max-w-2xl mx-auto shadow-[8px_8px_0px_0px_rgba(230,57,70,0.1)]">
          <div className="w-24 h-24 bg-red-50 border-2 border-brand-red flex items-center justify-center text-brand-red rounded-full mb-8 rotate-[-6deg]">
            <Heart size={48} className="fill-brand-red" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight mb-4">Your wishlist is empty</h2>
          <p className="text-gray-500 font-medium text-sm mb-8 max-w-md">
            Save products you love and view them later.
          </p>
          <button
            onClick={() => navigate('/collections')}
            className="px-8 py-4 bg-brand-red text-white font-black uppercase text-sm tracking-widest comic-border border-white hover:bg-brand-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none cursor-pointer"
          >
            Browse Collections
          </button>
        </div>
      ) : (
        /* Product Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {wishlist.map((item) => (
            <WishlistCard 
              key={item.product_id}
              item={item}
              onOpenModal={handleOpenModal}
              onRemoveFromWishlist={handleRemoveFromWishlist}
              setRef={setRef}
            />
          ))}
        </div>
      )}

      {/* Product Selection Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 overflow-y-auto pt-20 pb-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-brand-white w-full max-w-4xl comic-border overflow-hidden flex flex-col md:flex-row shadow-2xl z-[120] my-auto"
            >
              <button 
                onClick={handleCloseModal}
                className="fixed top-4 right-4 md:absolute md:top-4 md:right-4 z-[130] w-12 h-12 flex items-center justify-center bg-brand-black text-white hover:bg-brand-red transition-colors comic-border border-white active:scale-95 cursor-pointer"
                aria-label="Close modal"
              >
                <X size={24} />
              </button>

              <ProductDetailContent
                product={selectedProduct}
                selectedSize={selectedSize}
                setSelectedSize={setSelectedSize}
                selectedMaterial={selectedMaterial}
                setSelectedMaterial={setSelectedMaterial}
                handleQuickAdd={handleConfirmAddToCart}
                SIZES={SIZES}
                MATERIALS={MATERIALS}
                isBundle={isBundleModal}
                layoutMode="modal"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface WishlistCardProps {
  item: WishlistProduct;
  onOpenModal: (item: WishlistProduct) => void;
  onRemoveFromWishlist: (productId: number) => void;
  setRef: (productId: number, el: HTMLButtonElement | null) => void;
}

const WishlistCard: React.FC<WishlistCardProps> = React.memo(({ item, onOpenModal, onRemoveFromWishlist, setRef }) => {
  const handleOpen = useCallback(() => {
    onOpenModal(item);
  }, [item, onOpenModal]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation?.();
    onRemoveFromWishlist(item.product_id);
  }, [item.product_id, onRemoveFromWishlist]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-white comic-border transition-all hover:-translate-y-2 overflow-hidden flex flex-col justify-between protected-area"
    >
      <div 
        onClick={handleOpen}
        className="relative aspect-[3/4] overflow-hidden bg-gray-100 protected-area cursor-pointer"
      >
        <ProtectedImage 
          src={getStorefrontImage(item, 'card')} 
          alt={item.title} 
          width={320}
          height={427}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Remove button (filled heart) */}
        <button 
          ref={(el) => setRef(item.product_id, el)}
          onClick={handleRemove}
          className="absolute top-4 right-4 p-2 bg-white rounded-full transition-all hover:scale-110 text-brand-red shadow-md cursor-pointer z-10"
          aria-label="Remove from wishlist"
        >
          <Heart size={20} className="fill-brand-red text-brand-red" />
        </button>
        <div className="absolute inset-0 bg-brand-red/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="mb-4">
          <h3 
            onClick={handleOpen}
            className="font-display text-2xl font-black uppercase tracking-tight group-hover:text-brand-red transition-colors line-clamp-1 mb-2 cursor-pointer"
          >
            <span className="hover:text-brand-red text-brand-black">
              {item.title}
            </span>
          </h3>
          <p className="font-mono text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
            {item.genre?.toLowerCase() === 'bundle'
              ? `Starting From ₹${BUNDLE_OPTIONS[0].price}`
              : `Starting From ₹${POSTER_PRICING.A5}`}
          </p>
        </div>
        
        {/* Move to Cart button */}
        <button 
          onClick={handleOpen}
          className="w-full py-3 mb-2 bg-brand-red text-white font-display text-lg uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-black transition-all cursor-pointer"
        >
          <ShoppingCart size={18} /> Move To Cart
        </button>

        {/* Actions */}
        <div className="flex gap-2">
          <button 
            onClick={handleOpen}
            className="flex-1 py-3 bg-brand-black text-white font-display text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-red transition-all cursor-pointer inline-flex"
          >
            <Eye size={16} /> View Product
          </button>
          <button 
            onClick={handleRemove}
            className="py-3 px-4 border-2 border-brand-black text-brand-black font-display text-xs font-black uppercase tracking-widest flex items-center justify-center hover:bg-brand-red hover:text-white hover:border-brand-red transition-all cursor-pointer"
            aria-label="Remove from wishlist"
          >
            Remove
          </button>
        </div>
      </div>
    </motion.div>
  );
});
WishlistCard.displayName = 'WishlistCard';

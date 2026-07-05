import React, { useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWishlist, WishlistProduct } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { ArrowLeft, Heart, Eye, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { POSTER_PRICING, BUNDLE_OPTIONS } from '../config/pricing';
import { getProductPageUrl } from '../utils/productUrls';
import { SEO } from '../components/SEO';
import { getNonIndexableMetadata } from '../services/metadata';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { ProtectedImage } from '../components/ProtectedImage';


export default function Wishlist() {
  const navigate = useNavigate();
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart, triggerNotification } = useCart();
  const removeBtnRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  const handleMoveToCart = useCallback((item: WishlistProduct) => {
    const isBundle = item.genre?.toLowerCase() === 'bundle';
    const sizeName = isBundle ? BUNDLE_OPTIONS[0].name : 'A3';
    const sizePrice = isBundle ? BUNDLE_OPTIONS[0].price : POSTER_PRICING.A3;
    const materialName = 'Matte';
    const materialPrice = 0;
    const finalPrice = sizePrice + materialPrice;

    addToCart({
      id: item.product_id,
      name: item.title,
      price: finalPrice,
      image: item.image,
      quantity: 1,
      size: sizeName,
      material: materialName,
      selected_size: sizeName,
      selected_material: materialName,
      unit_price: finalPrice,
      line_total: finalPrice
    });
    
    // Explicitly set the custom notification text requested
    triggerNotification("Added to Cart 🛒");
  }, [addToCart, triggerNotification]);

  const handleRemoveFromWishlist = useCallback((productId: number) => {
    removeFromWishlist(productId);
  }, [removeFromWishlist]);

  const setRef = useCallback((productId: number, el: HTMLButtonElement | null) => {
    removeBtnRefs.current[productId] = el;
  }, []);

  
  

  React.useEffect(() => {
    
    
    
    
  }, [wishlist]);

  // Redirect specifically to "/" as per requirement 5: "Always redirect to homepage."
  const handleBack = () => {
    navigate('/');
  };

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
              onMoveToCart={handleMoveToCart}
              onRemoveFromWishlist={handleRemoveFromWishlist}
              setRef={setRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WishlistCardProps {
  item: WishlistProduct;
  onMoveToCart: (item: WishlistProduct) => void;
  onRemoveFromWishlist: (productId: number) => void;
  setRef: (productId: number, el: HTMLButtonElement | null) => void;
}

const WishlistCard: React.FC<WishlistCardProps> = React.memo(({ item, onMoveToCart, onRemoveFromWishlist, setRef }) => {
  const pageUrl = getProductPageUrl({ slug: item.product_slug });

  const handleMove = useCallback(() => {
    onMoveToCart(item);
  }, [item, onMoveToCart]);

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
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 protected-area">
        {pageUrl ? (
          <Link to={pageUrl} className="block w-full h-full cursor-pointer">
            <ProtectedImage 
              src={getOptimizedImageUrl(item.image, 320, 427)} 
              alt={item.title} 
              width={320}
              height={427}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          </Link>
        ) : (
          <div className="block w-full h-full">
            <ProtectedImage 
              src={getOptimizedImageUrl(item.image, 320, 427)} 
              alt={item.title} 
              width={320}
              height={427}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          </div>
        )}
        
        {/* Remove button (filled heart) */}
        <button 
          ref={(el) => setRef(item.product_id, el)}
          onClick={handleRemove}
          className="absolute top-4 right-4 p-2 bg-white rounded-full transition-all hover:scale-110 text-brand-red shadow-md cursor-pointer"
          aria-label="Remove from wishlist"
        >
          <Heart size={20} className="fill-brand-red text-brand-red" />
        </button>
        <div className="absolute inset-0 bg-brand-red/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="mb-4">
          <h3 className="font-display text-2xl font-black uppercase tracking-tight group-hover:text-brand-red transition-colors line-clamp-1 mb-2">
            {pageUrl ? (
              <Link to={pageUrl} className="hover:text-brand-red cursor-pointer">
                {item.title}
              </Link>
            ) : (
              <span className="text-brand-black">
                {item.title}
              </span>
            )}
          </h3>
          <p className="font-mono text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
            {item.genre?.toLowerCase() === 'bundle'
              ? `Starting From ₹${BUNDLE_OPTIONS[0].price}`
              : `Starting From ₹${POSTER_PRICING.A5}`}
          </p>
        </div>
        
        {/* Move to Cart button */}
        <button 
          onClick={handleMove}
          className="w-full py-3 mb-2 bg-brand-red text-white font-display text-lg uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-black transition-all cursor-pointer"
        >
          <ShoppingCart size={18} /> Move To Cart
        </button>

        {/* Actions */}
        <div className="flex gap-2">
          {pageUrl ? (
            <Link 
              to={pageUrl}
              className="flex-1 py-3 bg-brand-black text-white font-display text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-red transition-all cursor-pointer inline-flex"
            >
              <Eye size={16} /> View Product
            </Link>
          ) : (
            <button 
              disabled
              className="flex-1 py-3 bg-gray-300 text-gray-500 font-display text-sm uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed inline-flex"
            >
              <Eye size={16} /> View Product
            </button>
          )}
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

import React, { useRef } from 'react';
import { Heart, Share2, Maximize2, Layers, ShoppingCart } from 'lucide-react';
import { RippleWrapper } from '../ui/RippleWrapper';
import { getProductDisplayName } from '../../utils/productUrls';
import { useWishlist } from '../../context/WishlistContext';
import { useSharePoster } from '../../hooks/useSharePoster';
import { BUNDLE_OPTIONS } from '../../config/pricing';
import type { Product } from '../../types/database';
import { getOptimizedImageUrl } from '../../utils/imageUtils';
import { ProtectedImage } from '../ProtectedImage';

interface ProductDetailContentProps {
  product: Product;
  selectedSize: any;
  setSelectedSize: (size: any) => void;
  selectedMaterial: any;
  setSelectedMaterial: (material: any) => void;
  handleQuickAdd: () => void;
  SIZES: any[];
  MATERIALS: any[];
  isBundle: boolean;
  layoutMode?: 'modal' | 'page';
}

export const ProductDetailContent: React.FC<ProductDetailContentProps> = ({
  product,
  selectedSize,
  setSelectedSize,
  selectedMaterial,
  setSelectedMaterial,
  handleQuickAdd,
  SIZES,
  MATERIALS,
  isBundle,
  layoutMode = 'modal'
}) => {
  const sharePoster = useSharePoster();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  const wishlistBtnRef1 = useRef<HTMLButtonElement>(null);
  const shareBtnRef1 = useRef<HTMLButtonElement>(null);
  const wishlistBtnRef2 = useRef<HTMLButtonElement>(null);
  const shareBtnRef2 = useRef<HTMLButtonElement>(null);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation?.();
    if (wishlisted) {
      await removeFromWishlist(product.id);
    } else {
      await addToWishlist(product);
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation?.();
    sharePoster(product);
  };

  if (layoutMode === 'page') {
    return (
      <>
        {/* Product Image Section - 45-50% width on desktop */}
        <div className="w-full lg:w-[48%] flex justify-center sticky lg:top-36 protected-area">
          <div className="w-full relative max-h-[750px] aspect-[3/4] flex items-center justify-center">
            <ProtectedImage 
              src={getOptimizedImageUrl(product.image, 1000, 1333)} 
              alt={product.name} 
              width={1000}
              height={1333}
              loading="eager"
              fetchPriority="high"
              className="w-auto h-full max-h-[600px] lg:max-h-[750px] object-contain comic-border border-2 border-brand-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-fade-in"
            />
            <div className="absolute top-4 left-4 bg-brand-red text-white px-4 py-1.5 text-xs font-black uppercase tracking-widest rotate-[-2deg] comic-border border-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              {product.genre}
            </div>
          </div>
        </div>

        {/* Product Information Section - 50-55% width on desktop */}
        <div className="w-full lg:w-[52%] flex flex-col space-y-8 bg-transparent">
          <div className="flex justify-between items-start gap-6">
            <div className="flex-1 space-y-4">
              <h1 className="text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-none text-brand-black">{getProductDisplayName(product)}</h1>
              <p className="text-gray-600 font-medium text-base leading-relaxed max-w-xl">{product.description}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                ref={wishlistBtnRef1}
                onClick={handleWishlistToggle}
                className={`p-4 border-2 border-brand-black transition-all active:scale-95 cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none ${
                  wishlisted ? 'bg-brand-red border-brand-red text-white' : 'bg-white text-brand-black hover:text-brand-red'
                }`}
                aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart size={20} fill={wishlisted ? "currentColor" : "none"} />
              </button>
              <button
                ref={shareBtnRef1}
                onClick={handleShareClick}
                className="p-4 bg-white text-brand-black hover:text-brand-red border-2 border-brand-black transition-all active:scale-95 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none cursor-pointer"
                aria-label="Share poster"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {/* Size Selection */}
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
                <Maximize2 size={14} /> {isBundle ? 'Select Bundle Option' : 'Select Poster Size'}
              </p>
              {isBundle ? (
                <div className="grid grid-cols-1 gap-3">
                  {BUNDLE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedSize(option)}
                      className={`p-4 border-2 text-left transition-all flex justify-between items-center ${
                        selectedSize.id === option.id 
                          ? 'border-brand-black bg-brand-black text-white shadow-[4px_4px_0px_0px_rgba(230,57,70,0.5)]' 
                          : 'border-brand-black/20 bg-white hover:border-brand-red hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]'
                      }`}
                    >
                      <div>
                        <p className="font-black text-sm uppercase">{option.name}</p>
                        <p className={`text-[10px] font-bold ${selectedSize.id === option.id ? 'text-brand-red' : 'text-gray-400'}`}>
                          {option.postersCount} A5 posters
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold">₹{option.price}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setSelectedSize(size)}
                      className={`p-4 border-2 text-left transition-all ${
                        selectedSize.id === size.id 
                          ? 'border-brand-black bg-brand-black text-white shadow-[4px_4px_0px_0px_rgba(230,57,70,0.5)]' 
                          : 'border-brand-black/20 bg-white hover:border-brand-red hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]'
                      }`}
                    >
                      <p className="font-black text-sm uppercase">{size.name}</p>
                      <p className={`text-[10px] font-bold ${selectedSize.id === size.id ? 'text-brand-red' : 'text-gray-400'}`}>
                        {size.dimensions}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Material Selection */}
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
                <Layers size={14} /> Select Material
              </p>
              <div className="space-y-3">
                {MATERIALS.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => setSelectedMaterial(material)}
                    className={`w-full p-4 border-2 text-left transition-all flex items-center justify-between ${
                      selectedMaterial.id === material.id 
                        ? 'border-brand-black bg-brand-black text-white shadow-[4px_4px_0px_0px_rgba(230,57,70,0.5)]' 
                        : 'border-brand-black/20 bg-white hover:border-brand-red hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]'
                    }`}
                  >
                    <div>
                      <p className="font-black text-sm uppercase">{material.name}</p>
                      <p className={`text-[10px] font-bold ${selectedMaterial.id === material.id ? 'text-gray-300' : 'text-gray-500'}`}>
                        {material.desc}
                      </p>
                    </div>
                    {material.price > 0 && (
                      <p className="font-mono text-xs font-bold">+₹{material.price}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t-2 border-brand-black/10 flex items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Price</p>
              <p className="text-4xl md:text-5xl font-black text-brand-red leading-none">
                ₹{((selectedSize?.price || 0) + (selectedMaterial?.price || 0))}
              </p>
            </div>
            <RippleWrapper delay={2} className="flex-1">
              <button 
                onClick={handleQuickAdd}
                className="w-full py-5 bg-brand-black text-white font-display text-2xl uppercase tracking-widest comic-border border-white hover:bg-brand-red transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.15)] hover:shadow-none cursor-pointer"
              >
                <ShoppingCart size={24} /> Add to Bag
              </button>
            </RippleWrapper>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Product Image Gallery */}
      <div className="w-full md:w-1/2 bg-gray-100 relative protected-area animate-fade-in" style={{ aspectRatio: '3/4' }}>
        <ProtectedImage 
          src={getOptimizedImageUrl(product.image, 1000, 1333)} 
          alt={product.name} 
          width={1000}
          height={1333}
          loading="lazy"
          className="w-full h-full object-cover aspect-[3/4] md:aspect-auto"
        />
        <div className="absolute top-4 left-4 bg-brand-red text-white px-3 py-1 text-xs font-black uppercase tracking-widest rotate-2">
          {product.genre}
        </div>
      </div>

      {/* Product Information Panel */}
      <div className={`w-full md:w-1/2 p-8 md:p-12 flex flex-col ${
        layoutMode === 'modal' ? 'max-h-[80vh] overflow-y-auto' : ''
      }`}>
        <div className="mb-8 flex justify-between items-start gap-4">
          <div className="flex-1">
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">{getProductDisplayName(product)}</h2>
            <p className="text-gray-500 font-medium text-sm leading-relaxed">{product.description}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              ref={wishlistBtnRef2}
              onClick={handleWishlistToggle}
              className={`p-3 border-2 border-brand-black transition-all active:scale-95 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none ${
                wishlisted ? 'bg-brand-red border-brand-red text-white' : 'bg-white text-brand-black hover:text-brand-red'
              }`}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
            </button>
            <button
              ref={shareBtnRef2}
              onClick={handleShareClick}
              className="p-3 bg-white text-brand-black hover:text-brand-red border-2 border-brand-black transition-all active:scale-95 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none cursor-pointer"
              aria-label="Share poster"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-8 flex-grow">
          {/* Size Selection */}
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
              <Maximize2 size={14} /> {isBundle ? 'Select Bundle Option' : 'Select Poster Size'}
            </p>
            {isBundle ? (
              <div className="grid grid-cols-1 gap-2">
                {BUNDLE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedSize(option)}
                    className={`p-3 border-2 text-left transition-all flex justify-between items-center ${
                      selectedSize.id === option.id 
                        ? 'border-brand-black bg-brand-black text-white' 
                        : 'border-gray-200 bg-white hover:border-brand-red'
                    }`}
                  >
                    <div>
                      <p className="font-black text-sm uppercase">{option.name}</p>
                      <p className={`text-[10px] font-bold ${selectedSize.id === option.id ? 'text-brand-red' : 'text-gray-400'}`}>
                        {option.postersCount} A5 posters
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold">₹{option.price}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {SIZES.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setSelectedSize(size)}
                    className={`p-3 border-2 text-left transition-all ${
                      selectedSize.id === size.id 
                        ? 'border-brand-black bg-brand-black text-white' 
                        : 'border-gray-200 bg-white hover:border-brand-red'
                    }`}
                  >
                    <p className="font-black text-sm uppercase">{size.name}</p>
                    <p className={`text-[10px] font-bold ${selectedSize.id === size.id ? 'text-brand-red' : 'text-gray-400'}`}>
                      {size.dimensions}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Material Selection */}
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red flex items-center gap-2">
              <Layers size={14} /> Select Material
            </p>
            <div className="space-y-2">
              {MATERIALS.map((material) => (
                <button
                  key={material.id}
                  onClick={() => setSelectedMaterial(material)}
                  className={`w-full p-4 border-2 text-left transition-all flex items-center justify-between ${
                    selectedMaterial.id === material.id 
                      ? 'border-brand-black bg-brand-black text-white' 
                      : 'border-gray-200 bg-white hover:border-brand-red'
                  }`}
                >
                  <div>
                    <p className="font-black text-sm uppercase">{material.name}</p>
                    <p className={`text-[10px] font-bold ${selectedMaterial.id === material.id ? 'text-gray-400' : 'text-gray-500'}`}>
                      {material.desc}
                    </p>
                  </div>
                  {material.price > 0 && (
                    <p className="font-mono text-xs font-bold">+₹{material.price}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t-2 border-gray-100 flex items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Price</p>
            <p className="text-4xl font-black text-brand-red leading-none">
              ₹{((selectedSize?.price || 0) + (selectedMaterial?.price || 0))}
            </p>
          </div>
          <RippleWrapper delay={2} className="flex-1">
            <button 
              onClick={handleQuickAdd}
              className="w-full py-5 bg-brand-black text-white font-display text-2xl uppercase tracking-widest comic-border border-white hover:bg-brand-red transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none cursor-pointer"
            >
              <ShoppingCart size={24} /> Add to Bag
            </button>
          </RippleWrapper>
        </div>
      </div>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Maximize2, Layers, X } from 'lucide-react';
import { getRecentlyViewedProducts } from '../../services/recentProducts';
import { getProductDisplayName } from '../../utils/productUrls';
import { getOptimizedImageUrl } from '../../utils/imageUtils';
import { POSTER_PRICING, FLAGSHIP_PREMIUM, BUNDLE_OPTIONS } from '../../config/pricing';
import { useCart } from '../../context/CartContext';
import { RippleWrapper } from '../ui/RippleWrapper';
import type { Product } from '../../types/database';
import { ProtectedImage } from '../ProtectedImage';

import { SIZES } from '../../utils/sizeHelper';

const MATERIALS = [
  { id: 'matte', name: 'Matte', desc: 'Non-reflective, professional finish', price: 0 },
  { id: 'glossy', name: 'Glossy', desc: 'Vibrant colors, high shine', price: 0 },
  { id: 'flagship', name: 'Flagship Material', desc: 'Heavyweight archival stock, textured', price: FLAGSHIP_PREMIUM },
];

export default function RecentlyViewed() {
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<any>(SIZES[2]); // Default A3
  const [selectedMaterial, setSelectedMaterial] = useState(MATERIALS[0]); // Default Matte
  const { addToCart, triggerNotification } = useCart();

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const products = await getRecentlyViewedProducts();
        setRecentProducts(products);
      } catch (err) {
        console.error('Error loading recently viewed products:', err);
      } finally {
        setLoading(false);
      }
    };
    loadRecent();
  }, []);

  const handleClearHistory = () => {
    localStorage.removeItem('recently_viewed_products');
    setRecentProducts([]);
    if (triggerNotification) {
      triggerNotification('Recently viewed products cleared.');
    }
  };

  const handleOpenQuickAdd = (product: Product) => {
    setSelectedProduct(product);
    setSelectedMaterial(MATERIALS[0]);
    if (product.genre?.toLowerCase() === 'bundle') {
      setSelectedSize(BUNDLE_OPTIONS[0]);
    } else {
      setSelectedSize(SIZES[2]);
    }
  };

  const handleQuickAdd = () => {
    if (!selectedProduct) return;

    const finalPrice = selectedSize.price + selectedMaterial.price;
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

    setSelectedProduct(null);
  };

  if (loading || recentProducts.length === 0) return null;

  const isBundle = selectedProduct?.genre?.toLowerCase() === 'bundle';
  const displayedProducts = recentProducts.slice(0, 4);

  return (
    <section className="py-24 bg-brand-white border-t-4 border-brand-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 mb-16">
          <div>
            <h2 className="text-6xl font-black uppercase mb-4">RECENTLY <span className="text-brand-red">VIEWED</span></h2>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
              Continue exploring posters you recently viewed.
            </p>
          </div>
          <button
            onClick={handleClearHistory}
            className="self-start sm:self-auto px-4 py-2 border-2 border-brand-black text-brand-black font-bold uppercase text-xs hover:bg-brand-black hover:text-white transition-all comic-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
          >
            Clear History
          </button>
        </div>

        {/* Carousel / Grid */}
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-8 overflow-x-auto sm:overflow-x-visible pb-6 sm:pb-0 snap-x scrollbar-hide">
          {displayedProducts.map((product) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={product.id}
              className="flex-shrink-0 w-[280px] sm:w-auto snap-start bg-white comic-border transition-all hover:-translate-y-2 overflow-hidden flex flex-col justify-between group"
            >
              <div className="relative overflow-hidden aspect-[3/4] protected-area">
                <ProtectedImage
                  src={getOptimizedImageUrl(product.image, 600, 800)}
                  alt={product.name}
                  width={600}
                  height={800}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-brand-red/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>

              <div className="p-6 flex-grow flex flex-col justify-between">
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black uppercase text-brand-red tracking-[0.2em]">{product.genre}</p>
                    <p className="font-mono text-xs font-black uppercase tracking-wider text-gray-500">
                      {product.genre?.toLowerCase() === 'bundle'
                        ? `Starting From ₹${BUNDLE_OPTIONS[0].price}`
                        : `Starting From ₹${POSTER_PRICING.A5}`}
                    </p>
                  </div>
                  <h3 className="font-display text-2xl font-black uppercase tracking-tight group-hover:text-brand-red transition-colors line-clamp-1">
                    {getProductDisplayName(product)}
                  </h3>
                </div>
                <button
                  onClick={() => handleOpenQuickAdd(product)}
                  className="w-full py-3 bg-brand-black text-white font-display text-xl uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-red transition-all"
                >
                  <ShoppingCart size={18} /> Quick Add
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 overflow-y-auto pt-20 pb-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-brand-white w-full max-w-4xl comic-border overflow-hidden flex flex-col md:flex-row shadow-2xl z-[120] my-auto"
            >
              <button
                onClick={() => setSelectedProduct(null)}
                className="fixed top-4 right-4 md:absolute md:top-4 md:right-4 z-[130] w-12 h-12 flex items-center justify-center bg-brand-black text-white hover:bg-brand-red transition-colors comic-border border-white active:scale-95 cursor-pointer"
                aria-label="Close modal"
              >
                <X size={24} />
              </button>

              <div className="w-full md:w-1/2 bg-gray-100 relative protected-area">
                <ProtectedImage
                  src={getOptimizedImageUrl(selectedProduct.image, 1000, 1333)}
                  alt={selectedProduct.name}
                  width={1000}
                  height={1333}
                  loading="lazy"
                  className="w-full h-full object-cover aspect-[3/4] md:aspect-auto"
                />
                <div className="absolute top-4 left-4 bg-brand-red text-white px-3 py-1 text-xs font-black uppercase tracking-widest rotate-2">
                  {selectedProduct.genre}
                </div>
              </div>

              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col max-h-[80vh] overflow-y-auto">
                <div className="mb-8">
                  <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">{getProductDisplayName(selectedProduct)}</h2>
                  <p className="text-gray-500 font-medium">{selectedProduct.description}</p>
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
                            className={`p-3 border-2 text-left transition-all flex justify-between items-center ${selectedSize.id === option.id
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
                            className={`p-3 border-2 text-left transition-all ${selectedSize.id === size.id
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
                          className={`w-full p-4 border-2 text-left transition-all flex items-center justify-between ${selectedMaterial.id === material.id
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
                      className="w-full py-5 bg-brand-black text-white font-display text-2xl uppercase tracking-widest comic-border border-white hover:bg-brand-red transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none"
                    >
                      <ShoppingCart size={24} /> Add to Bag
                    </button>
                  </RippleWrapper>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

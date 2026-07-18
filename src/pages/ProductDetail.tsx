import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, Compass, Sparkles } from 'lucide-react';
import { getProductBySlug } from '../services/products';
import { ProductDetailContent } from '../components/product/ProductDetailContent';
import { useCart } from '../context/CartContext';
import { SEO } from '../components/SEO';
import { getProductMetadata } from '../services/metadata';
import { StructuredData } from '../components/StructuredData';
import { getProductSchema, getBreadcrumbSchema } from '../services/structuredData';
import { getProductDisplayName } from '../utils/productUrls';
import { POSTER_PRICING, FLAGSHIP_PREMIUM, BUNDLE_OPTIONS } from '../config/pricing';
import type { Product } from '../types/database';

import { SIZES } from '../utils/sizeHelper';

const MATERIALS = [
  { id: 'matte', name: 'Matte', desc: 'Non-reflective, professional finish', price: 0 },
  { id: 'glossy', name: 'Glossy', desc: 'Vibrant colors, high shine', price: 0 },
  { id: 'flagship', name: 'Flagship Material', desc: 'Heavyweight archival stock, textured', price: FLAGSHIP_PREMIUM },
];

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart, triggerNotification } = useCart();

  const breadcrumbs = useMemo(() => {
    if (!product) return [];
    const items = [
      { name: 'Home', url: '/' },
      { name: 'Collections', url: '/collections' }
    ];
    if (product.genre) {
      items.push({
        name: product.genre,
        url: `/collections?category=${product.genre.toLowerCase()}`
      });
    }
    items.push({
      name: getProductDisplayName(product),
      url: `/products/${product.slug}`
    });
    return items;
  }, [product]);

  const [selectedSize, setSelectedSize] = useState<any>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);

  useEffect(() => {
    async function loadProduct() {
      if (!slug) return;
      setIsLoading(true);
      const data = await getProductBySlug(slug);
      setProduct(data);
      setIsLoading(false);
    }
    loadProduct();
  }, [slug]);

  useEffect(() => {
    if (product) {
      const isBundle = product.genre?.toLowerCase() === 'bundle';
      setSelectedMaterial(MATERIALS[0]);
      if (isBundle) {
        setSelectedSize(BUNDLE_OPTIONS[0]);
      } else {
        setSelectedSize(SIZES[2]); // Default A3
      }
    }
  }, [product]);

  const handleAddToCart = () => {
    if (!product || !selectedSize || !selectedMaterial) return;
    const finalPrice = selectedSize.price + selectedMaterial.price;
    addToCart({
      id: product.id,
      name: getProductDisplayName(product),
      price: finalPrice,
      image: product.image,
      quantity: 1,
      size: selectedSize.name,
      material: selectedMaterial.name,
      selected_size: selectedSize.name,
      selected_material: selectedMaterial.name,
      unit_price: finalPrice,
      line_total: finalPrice
    });
    if (triggerNotification) {
      triggerNotification("Added to Cart 🛒");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-white flex items-center justify-center pt-32 pb-24">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-brand-red w-12 h-12 mx-auto" />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Retrieving poster details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-brand-white flex items-center justify-center p-6 pt-32 pb-24">
        <div className="max-w-md w-full bg-white comic-border p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-2 right-[-24px] bg-brand-red text-white text-[8px] font-black uppercase tracking-wider px-6 py-1 rotate-45">
            404
          </div>
          
          <div className="w-20 h-20 bg-red-50 flex items-center justify-center mx-auto comic-border border-brand-red rotate-3 hover:rotate-0 transition-transform duration-300">
            <Sparkles size={40} className="text-brand-red animate-pulse" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none">
              POSTER <span className="text-brand-red">NOT FOUND</span>
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-wider text-xs leading-relaxed">
              Looks like this poster escaped the realm or does not exist.
            </p>
          </div>

          <div className="flex flex-col gap-4 pt-2">
            <Link to="/collections" className="w-full">
              <span className="w-full py-4 bg-brand-black text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 comic-border border-white hover:bg-brand-red transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none inline-flex">
                <Compass size={16} /> Browse Collections
              </span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isBundle = product.genre?.toLowerCase() === 'bundle';

  return (
    <div className="bg-brand-white pt-32 pb-24 min-h-screen">
      <SEO metadata={getProductMetadata(product)} />
      <StructuredData schema={getProductSchema(product)} />
      <StructuredData schema={getBreadcrumbSchema(breadcrumbs)} />
      <div className="max-w-[1280px] w-full mx-auto px-8 md:px-12">
        <Link to="/collections" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-black hover:text-brand-red mb-8 transition-colors">
          <ChevronLeft size={16} /> Back to Collections
        </Link>
        <div className="w-full flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
          {selectedSize && selectedMaterial && (
            <ProductDetailContent
              product={product}
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
              selectedMaterial={selectedMaterial}
              setSelectedMaterial={setSelectedMaterial}
              handleQuickAdd={handleAddToCart}
              SIZES={SIZES}
              MATERIALS={MATERIALS}
              isBundle={isBundle}
              layoutMode="page"
            />
          )}
        </div>
      </div>
    </div>
  );
}

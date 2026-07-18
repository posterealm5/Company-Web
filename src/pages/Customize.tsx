import { motion } from 'motion/react';
import React, { useState, ChangeEvent, useRef } from 'react';
import { Upload, ChevronRight, Check, Sparkles, Layers, Info, RefreshCw, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { uploadCustomDesign } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from '../components/auth/AuthModal';

import { RippleWrapper } from '../components/ui/RippleWrapper';
import { POSTER_PRICING, FLAGSHIP_PREMIUM, calculateSinglePosterPrice } from '../config/pricing';
import { SEO } from '../components/SEO';
import { getCustomizeMetadata } from '../services/metadata';
import { StructuredData } from '../components/StructuredData';
import { getCustomizeSchema } from '../services/structuredData';
import { getOptimizedImageUrl } from '../utils/imageUtils';

import { SIZES, getSizeDisplayLabel } from '../utils/sizeHelper';

const MATERIALS = [
  { id: 'matte', name: 'Matte', desc: 'Non-reflective, professional finish', price: 0 },
  { id: 'glossy', name: 'Glossy', desc: 'Vibrant colors, high shine', price: 0 },
  { id: 'flagship', name: 'Flagship Material', desc: 'Heavyweight archival stock, textured', price: FLAGSHIP_PREMIUM },
];

export default function Customize() {
  const [selectedSize, setSelectedSize] = useState(SIZES[1]);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [selectedMaterial, setSelectedMaterial] = useState(MATERIALS[0]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToCart, triggerNotification } = useCart();
  const navigate = useNavigate();

  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openLoginModal = () => setIsAuthModalOpen(true);
  
  const toast = {
    info: (msg: string) => triggerNotification(msg)
  };

  const requireAuth = () => {
    if (!user) {
      openLoginModal();
      toast.info("Please sign in to upload your custom design");
      return false;
    }
    return true;
  };

  const processUpload = async (file: File) => {
    setIsUploading(true);
    
    try {
      const { url, error } = await uploadCustomDesign(file);
      
      if (error) {
        console.error(`Error details:`, error);
        console.error(`[UPLOAD STEP] Exact request triggering error:`, {
          operation: 'storage.upload',
          bucket: 'custom-designs',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        if (error.toLowerCase().includes('bucket not found')) {
          triggerNotification("Storage Error: 'custom-designs' bucket is missing. Please run the setup SQL.");
        } else {
          triggerNotification("Upload failed: " + error);
        }
      } else if (url) {
        setImagePreview(url);
      }
    } catch (err) {
      console.error('Upload error:', err);
      triggerNotification("An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!requireAuth()) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      await processUpload(file);
    }
  };

  const handleUploadClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (requireAuth()) {
      fileInputRef.current?.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await processUpload(file);
    }
  };

  const totalPrice = calculateSinglePosterPrice(selectedSize.name, selectedMaterial.id);

  const handleAddToBag = () => {
    if (!imagePreview) {
      triggerNotification("Kindly Upload your custom design before adding item to the cart.");
      return;
    }
    
    const finalSizeName = selectedSize.name;
    const finalPrice = totalPrice;
    
    addToCart({
      id: Date.now(), // Generate a unique ID for custom design
      name: 'Custom Masterpiece',
      price: finalPrice,
      image: imagePreview,
      quantity: 1,
      size: finalSizeName,
      material: selectedMaterial.name,
      selected_size: finalSizeName,
      selected_material: selectedMaterial.name,
      unit_price: finalPrice,
      line_total: finalPrice
    });
    navigate('/cart');
  };

  return (
    <div className="pt-32 pb-24 bg-brand-white min-h-screen">
      <SEO metadata={getCustomizeMetadata()} />
      <StructuredData schema={getCustomizeSchema()} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          className="mb-12"
        >
          <h1 className="text-6xl md:text-8xl font-black mb-4">CUSTOM <span className="text-brand-red">DESIGNER</span></h1>
          <p className="text-xl text-gray-600 font-medium">Create your masterpiece with premium materials.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.1 }}
            className="sticky top-32"
          >
            <div className="bg-white p-8 comic-border relative group">
              <div className={`transition-all duration-500 ease-in-out bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-brand-black ${
                orientation === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]'
              }`}>
                {isUploading ? (
                   <div className="text-center p-8">
                     <Loader2 size={64} className="mx-auto mb-4 text-brand-red animate-spin" />
                     <p className="text-gray-400 font-bold uppercase tracking-widest">Uploading Art...</p>
                   </div>
                ) : imagePreview ? (
                  <div className="relative w-full h-full group/preview">
                    <img 
                      src={getOptimizedImageUrl(imagePreview, 1000, 1333)} 
                      alt="Preview" 
                      width={1000}
                      height={1333}
                      className="w-full h-full object-contain" 
                      referrerPolicy="no-referrer" 
                    />
                    <button 
                      onClick={handleUploadClick}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 backdrop-blur-sm"
                    >
                      <RefreshCw className="w-8 h-8" />
                      <span className="font-black uppercase tracking-widest text-sm">Change Design</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Sparkles size={64} className="mx-auto mb-4 text-brand-red opacity-20" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest">Awaiting Your Vision</p>
                  </div>
                )}
              </div>
              
              {/* Material hint labels */}
              <div className="absolute top-12 right-12 bg-brand-black text-white px-3 py-1 text-[10px] uppercase font-black tracking-widest rotate-6 z-10">
                Material: {selectedMaterial.name}
              </div>
              <div className="absolute bottom-12 left-12 bg-brand-red text-white px-3 py-1 text-[10px] uppercase font-black tracking-widest -rotate-6 z-10">
                Size: {getSizeDisplayLabel(selectedSize.name)}
              </div>
            </div>
            
            <div className="mt-8 flex items-center gap-4 p-6 bg-brand-black text-brand-white rounded-xl">
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Estimated Total</p>
                <p className="text-5xl font-display font-black leading-none">
                  {totalPrice !== null ? `₹${totalPrice.toLocaleString()}` : '—'}
                </p>
              </div>
              <RippleWrapper delay={2}>
                <button 
                  onClick={handleAddToBag}
                  className="px-8 py-4 bg-brand-red text-white hover:bg-white hover:text-brand-red transition-all font-display text-2xl uppercase tracking-widest"
                >
                  Add to Cart
                </button>
              </RippleWrapper>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.1 }}
            className="space-y-12"
          >
            {/* Step 1: Upload */}
            <div className="space-y-6 text-left">
              <h3 className="text-3xl font-black uppercase flex items-center gap-3">
                <span className="w-10 h-10 bg-brand-red text-white rounded-full flex items-center justify-center text-xl">1</span>
                Upload Design
              </h3>
              {imagePreview ? (
                <div className="flex items-center gap-4 p-4 border-2 border-brand-black rounded-2xl bg-white">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    {isUploading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="animate-spin text-brand-red" size={24} />
                      </div>
                    ) : (
                      <img 
                        src={getOptimizedImageUrl(imagePreview, 80, 80)} 
                        alt="Thumbnail" 
                        width={80}
                        height={80}
                        className="w-full h-full object-cover" 
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-black uppercase text-sm">{isUploading ? 'Uploading...' : 'Design Ready'}</p>
                    <p className="text-xs text-gray-500 font-medium">{isUploading ? 'Sending to storage' : 'Your custom art is loaded'}</p>
                  </div>
                  <button 
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className={`flex items-center gap-2 text-brand-red font-black uppercase text-xs hover:underline ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RefreshCw size={14} /> Change
                  </button>
                </div>
              ) : (
                <div 
                  onClick={handleUploadClick}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="block w-full cursor-pointer group"
                >
                  <div className="border-4 border-dashed border-gray-200 group-hover:border-brand-red transition-colors p-10 text-center rounded-2xl bg-gray-50">
                    <Upload size={48} className="mx-auto mb-4 text-gray-300 group-hover:text-brand-red transition-colors" />
                    <p className="text-lg font-bold text-gray-500 group-hover:text-brand-black">Drag or click to upload</p>
                    <p className="text-sm text-gray-400 mt-2 font-medium">Recommended: 300 DPI, JPG/PNG, min. 2000px width</p>
                  </div>
                </div>
              )}
              <input 
                id="file-upload"
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileSelect} 
              />
            </div>

            {/* Step 2: Orientation & Size */}
            <div className="space-y-6 text-left">
              <h3 className="text-3xl font-black uppercase flex items-center gap-3">
                <span className="w-10 h-10 bg-brand-red text-white rounded-full flex items-center justify-center text-xl">2</span>
                Choose Orientation
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setOrientation('portrait')}
                  className={`p-6 border-2 transition-all flex flex-col items-center gap-3 rounded-2xl ${
                    orientation === 'portrait' ? 'border-brand-black bg-brand-black text-white' : 'border-gray-200 bg-white hover:border-brand-red'
                  }`}
                >
                  <Maximize2 size={32} className={orientation === 'portrait' ? 'text-brand-red' : 'text-gray-300'} />
                  <p className="font-display text-xl font-black uppercase">Portrait</p>
                </button>
                <button 
                  onClick={() => setOrientation('landscape')}
                  className={`p-6 border-2 transition-all flex flex-col items-center gap-3 rounded-2xl ${
                    orientation === 'landscape' ? 'border-brand-black bg-brand-black text-white' : 'border-gray-200 bg-white hover:border-brand-red'
                  }`}
                >
                  <Minimize2 size={32} className={orientation === 'landscape' ? 'text-brand-red' : 'text-gray-300'} />
                  <p className="font-display text-xl font-black uppercase">Landscape</p>
                </button>
              </div>

              <h3 className="text-3xl font-black uppercase flex items-center gap-3 pt-6">
                <span className="w-10 h-10 bg-brand-red text-white rounded-full flex items-center justify-center text-xl">3</span>
                Select Poster Size
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SIZES.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setSelectedSize(size)}
                    className={`h-24 border-2 transition-all flex flex-col items-center justify-center relative rounded-xl group ${
                      selectedSize.id === size.id ? 'border-brand-black bg-brand-black text-white px-2' : 'border-gray-200 bg-white hover:border-brand-red'
                    }`}
                  >
                    <p className={`text-2xl font-black uppercase tracking-tighter ${selectedSize.id === size.id ? 'text-white' : 'text-brand-black'}`}>{size.name}</p>
                    <p className={`text-[10px] font-bold mt-1 ${selectedSize.id === size.id ? 'text-brand-red' : 'text-gray-400'}`}>
                      {size.dimensions}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Material */}
            <div className="space-y-6 text-left">
              <h3 className="text-3xl font-black uppercase flex items-center gap-3">
                <span className="w-10 h-10 bg-brand-red text-white rounded-full flex items-center justify-center text-xl">4</span>
                Choose Material
              </h3>
              <div className="space-y-4">
                {MATERIALS.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => setSelectedMaterial(material)}
                    className={`w-full p-6 border-2 transition-all flex items-center gap-6 text-left rounded-2xl ${
                      selectedMaterial.id === material.id ? 'border-brand-black bg-brand-black text-white' : 'border-gray-200 bg-white hover:border-brand-red'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${selectedMaterial.id === material.id ? 'bg-brand-red' : 'bg-gray-100'}`}>
                      <Layers size={24} className={selectedMaterial.id === material.id ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1">
                      <p className="font-display text-2xl font-black uppercase">{material.name}</p>
                      <p className={`text-sm font-medium ${selectedMaterial.id === material.id ? 'text-gray-400' : 'text-gray-500'}`}>{material.desc}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-mono font-bold">₹{material.price}</p>
                       {material.id === 'flagship' && <span className="text-[10px] bg-brand-red text-white px-2 py-0.5 rounded font-black uppercase">Elite</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-blue-50 border-l-4 border-blue-500 flex gap-4 text-left rounded-2xl">
               <Info className="text-blue-500 shrink-0" />
               <div>
                  <p className="font-bold text-blue-900 uppercase text-xs tracking-widest mb-1">Expert Tip</p>
                  <p className="text-sm text-blue-800 font-medium">Flagship material offers the best color accuracy and texture for digital art and high-contrast designs.</p>
               </div>
            </div>
          </motion.div>
        </div>
      </div>
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </div>
  );
}

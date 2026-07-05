import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SEO } from '../components/SEO';
import { getHomeMetadata } from '../services/metadata';
import { StructuredData } from '../components/StructuredData';
import { getOrganizationSchema, getWebsiteSchema } from '../services/structuredData';
import {
  ArrowRight, Star, Zap, Shield, Play, Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RippleWrapper } from '../components/ui/RippleWrapper';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Review, ShowcaseEntry, Product } from '../types/database';
import { useCart } from '../context/CartContext';
import { getProductDisplayName } from '../utils/productUrls';
import { POSTER_PRICING, FLAGSHIP_PREMIUM, BUNDLE_OPTIONS } from '../config/pricing';
import { homeCache } from '../utils/homeCache';
import heroLeft from '../assets/images/hero-left.jpg';
import heroCenter from '../assets/images/hero-center.jpg';
import heroRight from '../assets/images/hero-right.jpg';
import objectiveImage from '../assets/images/regenerated_image_1778348846524.jpg';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { ProtectedImage } from '../components/ProtectedImage';

const FeedbackMarquee = lazy(() => import('../components/home/FeedbackMarquee'));
const CustomerShowcase = lazy(() => import('../components/home/CustomerShowcase'));
const RecentlyViewed = lazy(() => import('../components/home/RecentlyViewed'));



const SIZES = [
  { id: 'a5', name: 'A5', dimensions: '5.8" x 8.3"', price: POSTER_PRICING.A5 },
  { id: 'a4', name: 'A4', dimensions: '8.3" x 11.7"', price: POSTER_PRICING.A4 },
  { id: 'a3', name: 'A3', dimensions: '11.7" x 16.5"', price: POSTER_PRICING.A3 },
  { id: 'a2', name: 'A2', dimensions: '16.5" x 23.4"', price: POSTER_PRICING.A2 },
];

const MATERIALS = [
  { id: 'matte', name: 'Matte', desc: 'Non-reflective, professional finish', price: 0 },
  { id: 'glossy', name: 'Glossy', desc: 'Vibrant colors, high shine', price: 0 },
  { id: 'flagship', name: 'Flagship Material', desc: 'Heavyweight archival stock, textured', price: FLAGSHIP_PREMIUM },
];

interface HeroProps {
  leftPosterImage?: string;
  centerPosterImage?: string;
  rightPosterImage?: string;
  leftPosterAlt?: string;
  centerPosterAlt?: string;
  rightPosterAlt?: string;
}

interface PosterImageProps {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
}

const PosterImage: React.FC<PosterImageProps> = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  fetchPriority = 'auto',
  width,
  height
}) => {
  const optimizedSrc = src ? getOptimizedImageUrl(src, width, height) : undefined;
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }}>
      {/* Specular Diagonal Light Reflection */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_35%,transparent_36%,transparent_100%)] opacity-80 mix-blend-screen"></div>
      
      {!optimizedSrc ? (
        <div className={`w-full h-full bg-neutral-900 border border-brand-red/30 flex flex-col items-center justify-center p-4 text-center select-none ${className}`}>
          <Layers className="text-brand-red/30 mb-3" size={32} />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-normal max-w-[90%]">
            {alt}
          </span>
        </div>
      ) : (
        <ProtectedImage
          src={optimizedSrc}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          fetchPriority={fetchPriority}
          className={`w-full h-full object-cover ${className}`}
        />
      )}
    </div>
  );
};

const Hero: React.FC<HeroProps> = ({
  leftPosterImage,
  centerPosterImage,
  rightPosterImage,
  leftPosterAlt = 'Featured Poster Left',
  centerPosterAlt = 'Featured Poster Center',
  rightPosterAlt = 'Featured Poster Right'
}) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hoveredPoster, setHoveredPoster] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Max rotation: rotateX = 2deg, rotateY = 3deg
    const rotateX = -(y / (rect.height / 2)) * 2;
    const rotateY = (x / (rect.width / 2)) * 3;
    
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16 lg:py-20 overflow-hidden bg-brand-black protected-area">
      {/* Background Image Container */}
      <div className="absolute inset-0 z-0">
        <img
          src={getOptimizedImageUrl("https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=2000&auto=format&fit=crop", 1200, 800)}
          srcSet={`${getOptimizedImageUrl("https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=2000&auto=format&fit=crop", 600, 400)} 600w,
                    ${getOptimizedImageUrl("https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=2000&auto=format&fit=crop", 1000, 667)} 1000w,
                    ${getOptimizedImageUrl("https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=2000&auto=format&fit=crop", 1200, 800)} 1200w,
                    ${getOptimizedImageUrl("https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=2000&auto=format&fit=crop", 1600, 1067)} 1600w,
                    ${getOptimizedImageUrl("https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=2000&auto=format&fit=crop", 2000, 1333)} 2000w`}
          sizes="100vw"
          alt="Studio Background"
          width={1200}
          height={800}
          loading="eager"
          fetchPriority="high"
          className="w-full h-full object-cover opacity-30 pointer-events-none select-none"
        />
        {/* Subtle red ambient glow behind posters */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/90 to-brand-black/40"></div>
        <div className="absolute right-[5%] lg:right-[15%] top-1/4 w-[400px] lg:w-[600px] h-[400px] lg:h-[600px] bg-brand-red/10 rounded-full blur-[100px] lg:blur-[140px] pointer-events-none"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8 items-center">
          
          {/* Left Side (45% / 5 Cols on desktop) */}
          <div className="lg:col-span-5 flex flex-col items-start text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[5.5rem] font-black leading-[0.85] mb-8 text-white uppercase tracking-tight">
                STEP INTO<br />
                YOUR <span className="text-brand-red">REALM</span>
              </h1>
              <p className="text-lg text-gray-300 max-w-xl mb-10 font-medium leading-relaxed">
                Explore a vast collection of premium posters. From timeless classics to custom designs, we've got your walls covered with unique and premium designs.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/collections">
                  <span className="px-10 py-5 bg-brand-red text-white font-display text-2xl uppercase tracking-wider flex items-center gap-2 hover:bg-white hover:text-brand-red transition-all transform hover:-translate-y-1 inline-flex">
                    Shop Posters <ArrowRight size={24} />
                  </span>
                </Link>
                <Link to="/customize">
                  <span className="px-10 py-5 border-4 border-white text-white font-display text-2xl uppercase tracking-wider flex items-center gap-2 hover:bg-white/10 transition-all inline-flex">
                    Create Custom Poster <Play size={24} fill="currentColor" />
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right Side (55% / 7 Cols on desktop) */}
          <div className="lg:col-span-7 flex justify-center items-center relative w-full lg:translate-x-[75px]">
            {/* Ambient secondary glow behind the entire group */}
            <div className="absolute inset-0 bg-brand-red/5 rounded-full blur-[100px] pointer-events-none transform scale-110"></div>
            
            {/* Focused soft red glow centered behind center poster */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[320px] bg-brand-red/10 rounded-full blur-[60px] pointer-events-none z-0"></div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              ref={containerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full max-w-[460px] sm:max-w-[530px] lg:max-w-[610px] aspect-[4/3] flex items-center justify-center select-none mx-auto z-10"
              style={{
                perspective: '1000px',
              }}
            >
              <div
                className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
                style={{
                  transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Left Poster */}
                <div
                  className="absolute left-[1%] w-[35%] aspect-[2/3] transition-all duration-300 ease-out z-10"
                  style={{
                    animation: 'float-left 7.5s ease-in-out infinite',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div
                    onMouseEnter={() => setHoveredPoster('left')}
                    onMouseLeave={() => setHoveredPoster(null)}
                    className="w-full h-full rounded-lg overflow-hidden border-2 border-brand-black bg-white transition-all duration-300 ease-out cursor-pointer"
                    style={{
                      transform: hoveredPoster === 'left'
                        ? 'rotateY(-8deg) scale(0.875) translateZ(0px) translateY(-8px)'
                        : 'rotateY(-8deg) scale(0.85) translateZ(-20px) translateY(0)',
                      boxShadow: hoveredPoster === 'left'
                        ? '0 25px 45px -8px rgba(230, 57, 70, 0.25)'
                        : '0 15px 30px -5px rgba(0, 0, 0, 0.5)',
                      transformStyle: 'preserve-3d',
                      opacity: hoveredPoster === 'left' ? 1 : 0.85,
                    }}
                  >
                    <PosterImage
                      src={leftPosterImage}
                      alt={leftPosterAlt}
                      loading="eager"
                      width={400}
                      height={600}
                    />
                  </div>
                </div>

                {/* Right Poster */}
                <div
                  className="absolute right-[1%] w-[35%] aspect-[2/3] transition-all duration-300 ease-out z-10"
                  style={{
                    animation: 'float-right 7.5s ease-in-out infinite',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div
                    onMouseEnter={() => setHoveredPoster('right')}
                    onMouseLeave={() => setHoveredPoster(null)}
                    className="w-full h-full rounded-lg overflow-hidden border-2 border-brand-black bg-white transition-all duration-300 ease-out cursor-pointer"
                    style={{
                      transform: hoveredPoster === 'right'
                        ? 'rotateY(8deg) scale(0.875) translateZ(0px) translateY(-8px)'
                        : 'rotateY(8deg) scale(0.85) translateZ(-20px) translateY(0)',
                      boxShadow: hoveredPoster === 'right'
                        ? '0 25px 45px -8px rgba(230, 57, 70, 0.25)'
                        : '0 15px 30px -5px rgba(0, 0, 0, 0.5)',
                      transformStyle: 'preserve-3d',
                      opacity: hoveredPoster === 'right' ? 1 : 0.85,
                    }}
                  >
                    <PosterImage
                      src={rightPosterImage}
                      alt={rightPosterAlt}
                      loading="eager"
                      width={400}
                      height={600}
                    />
                  </div>
                </div>

                {/* Center Poster (Main Focus) */}
                <div
                  className="absolute w-[43%] aspect-[2/3] z-20 transition-all duration-300 ease-out"
                  style={{
                    animation: 'float-center 6.5s ease-in-out infinite',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div
                    onMouseEnter={() => setHoveredPoster('center')}
                    onMouseLeave={() => setHoveredPoster(null)}
                    className="w-full h-full rounded-lg overflow-hidden border-[3px] border-brand-black bg-white transition-all duration-300 ease-out cursor-pointer"
                    style={{
                      transform: hoveredPoster === 'center'
                        ? 'translateZ(50px) scale(1.03) translateY(-8px)'
                        : 'translateZ(30px) scale(1) translateY(0)',
                      boxShadow: hoveredPoster === 'center'
                        ? '0 40px 70px -12px rgba(230, 57, 70, 0.4)'
                        : '0 30px 50px -10px rgba(0, 0, 0, 0.7), 0 10px 20px -5px rgba(0, 0, 0, 0.5)',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <PosterImage
                      src={centerPosterImage}
                      alt={centerPosterAlt}
                      loading="eager"
                      width={400}
                      height={600}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>

      {/* Background Text Overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full whitespace-nowrap opacity-[0.02] pointer-events-none select-none font-black text-[30vw] uppercase leading-none text-white z-0">
        POSTEREALM
      </div>
    </section>
  );
};

const ObjectiveSection = () => {
  return (
    <section className="py-24 bg-brand-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-6xl font-black uppercase mb-8">OUR <span className="text-brand-red">OBJECTIVE</span></h2>
            <p className="text-2xl text-gray-800 font-medium leading-relaxed mb-8">
              At Posterealm, our mission is to redefine your walls. We're dedicated to delivering
              <span className="text-brand-red"> high-quality, premium-look posters </span>
              that turn your personal creative vision into a reality.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mb-10">
              We believe that unique, custom art shouldn't be out of reach. That's why we bring
              together top-tier materials and personalized designs at an affordable range, ensuring
              that every home can step into its own realm of inspiration.
            </p>
            <div className="grid grid-cols-2 md:flex gap-6 md:gap-8 justify-items-center md:justify-start w-full">
              <div className="text-center">
                <p className="text-4xl font-black text-brand-red">100%</p>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Quality</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-black text-brand-red">Personalized</p>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Designs</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.8 }}
            className="relative lg:pl-12"
          >
            <div
              className="comic-border p-4 bg-white transform rotate-2 hover:rotate-0 transition-transform duration-500"
              style={{ width: '897.2px', maxWidth: '100%', height: 'auto', aspectRatio: '897.2 / 1250.82' }}
            >
              <ProtectedImage
                src={objectiveImage}
                alt="Our Objective"
                width={897}
                height={1251}
                loading="lazy"
                className="w-full h-auto rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true';
                    target.src = '/api/artifacts/objective_image.png';
                  } else {
                    target.src = "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1000&auto=format&fit=crop";
                  }
                }}
              />
            </div>
            {/* Visual element */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-brand-red/5 rounded-full blur-3xl"></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

interface CategoryState {
  images: string[];
  count: number | null;
}

/** Collection card with auto-rotating poster slideshow */
const CollectionCard: React.FC<{
  title: string;
  genre: string;
  fallbackImage: string;
  index: number;
  images: string[];
  count: number | null;
}> = ({ title, genre, fallbackImage, index, images, count }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // We maintain two slots for the crossfade
  const [slotA, setSlotA] = useState<string | null>(null);
  const [slotB, setSlotB] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');

  // Set initial slots when images load
  useEffect(() => {
    if (images.length > 0) {
      setSlotA(images[0]);
      setSlotB(images[1] || null);
      setActiveSlot('A');
      setActiveIndex(0);
    } else {
      setSlotA(fallbackImage);
      setSlotB(null);
      setActiveSlot('A');
      setActiveIndex(0);
    }
  }, [images, fallbackImage]);

  // Auto-rotate every 3.2 seconds when there are multiple images
  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlot(current => {
        const nextSlot = current === 'A' ? 'B' : 'A';
        setActiveIndex(prev => {
          const nextIdx = (prev + 1) % images.length;
          // Load the next active image into the incoming slot
          if (nextSlot === 'A') {
            setSlotA(images[nextIdx]);
          } else {
            setSlotB(images[nextIdx]);
          }
          return nextIdx;
        });
        return nextSlot;
      });
    }, 3200);
    return () => clearInterval(interval);
  }, [images]);

  // Preload next image in the inactive slot after transition is complete
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setTimeout(() => {
      const nextIdx = (activeIndex + 1) % images.length;
      if (activeSlot === 'A') {
        setSlotB(images[nextIdx]);
      } else {
        setSlotA(images[nextIdx]);
      }
    }, 850); // wait for transition (800ms) to complete before changing the inactive slot source
    return () => clearTimeout(timer);
  }, [activeIndex, images, activeSlot]);

  const displayCount = count !== null ? count : '—';

  return (
    <Link to={`/collections?category=${genre}`} className="block protected-area">
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ delay: index * 0.1, duration: 0.6 }}
        className="relative aspect-[4/5] bg-brand-black overflow-hidden group cursor-pointer comic-border text-left"
      >
        {/* Slot A */}
        {slotA && (
          <ProtectedImage
            src={getOptimizedImageUrl(slotA, 500, 625)}
            alt={title}
            width={500}
            height={625}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-all duration-[800ms] ease-in-out ${
              activeSlot === 'A' ? 'opacity-80 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ transitionProperty: 'opacity, transform' }}
          />
        )}

        {/* Slot B */}
        {slotB && (
          <ProtectedImage
            src={getOptimizedImageUrl(slotB, 500, 625)}
            alt={title}
            width={500}
            height={625}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-all duration-[800ms] ease-in-out ${
              activeSlot === 'B' ? 'opacity-80 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ transitionProperty: 'opacity, transform' }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        <div className="absolute bottom-8 left-8">
          <p className="text-brand-red font-black text-sm uppercase tracking-widest mb-2">{displayCount} ITEMS</p>
          <h3 className="text-4xl font-black text-white uppercase">{title}</h3>
        </div>
      </motion.div>
    </Link>
  );
};

const CollectionsSection: React.FC<{
  animeData: CategoryState;
  moviesData: CategoryState;
  printestyData: CategoryState;
}> = ({ animeData, moviesData, printestyData }) => {
  const collections = useMemo(() => [
    { title: "Anime & Manga", genre: "Anime", fallbackImage: "/anime-manga.jpg", data: animeData },
    { title: "Movies & Series", genre: "Movies", fallbackImage: "/movies-series.jpg", data: moviesData },
    { title: "Printesty", genre: "Printesty", fallbackImage: "/printesty.jpg", data: printestyData },
  ], [animeData, moviesData, printestyData]);

  return (
    <section className="py-24 bg-brand-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          className="mb-16 text-left"
        >
          <h2 className="text-6xl font-black uppercase mb-4">OUR <span className="text-brand-red">COLLECTIONS</span></h2>
          <div className="w-24 h-2 bg-brand-red"></div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {collections.map((coll, i) => (
            <CollectionCard
              key={coll.genre}
              title={coll.title}
              genre={coll.genre}
              fallbackImage={coll.fallbackImage}
              index={i}
              images={coll.data.images}
              count={coll.data.count}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, amount: 0.2 }}
        >
          <Link
            to="/collections"
          >
            <span className="inline-flex items-center gap-3 px-12 py-5 bg-brand-black text-white font-display text-2xl uppercase tracking-widest comic-border hover:bg-brand-red transition-colors group">
              Explore More
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// Components FeedbackMarquee, CustomerShowcase, and RecentlyViewed have been moved to their own files for lazy loading.

// Configure Hero Showcase Poster Images here.
// Set URLs to showcase custom poster assets (e.g. '/assets/image.jpg').
// Set to undefined/empty to show the clean, brand-themed placeholder showcase.
const HERO_CONFIG = {
  leftPosterImage: heroLeft, 
  centerPosterImage: heroCenter, 
  rightPosterImage: heroRight, 
  leftPosterAlt: 'Ghost of Tsushima',
  centerPosterAlt: 'Encore ABJ',
  rightPosterAlt: 'Demon Slayer',
};

export default function Home() {
  const [categoriesData, setCategoriesData] = useState<Record<string, CategoryState>>({
    Anime: { images: [], count: null },
    Movies: { images: [], count: null },
    Printesty: { images: [], count: null }
  });

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      try {
        const cacheKey = 'homepage_categories';
        const cached = homeCache.get<Record<string, CategoryState>>(cacheKey);
        if (cached) {
          if (!cancelled) setCategoriesData(cached);
          return;
        }

        if (!isSupabaseConfigured()) {
          if (!cancelled) {
            setCategoriesData({
              Anime: { images: [], count: 0 },
              Movies: { images: [], count: 0 },
              Printesty: { images: [], count: 0 }
            });
          }
          return;
        }

        const { data, error } = await supabase
          .from('products')
          .select('genre, image')
          .eq('is_active', true)
          .in('genre', ['Anime', 'Movies', 'Printesty']);

        const result: Record<string, CategoryState> = {
          Anime: { images: [], count: 0 },
          Movies: { images: [], count: 0 },
          Printesty: { images: [], count: 0 }
        };

        if (!error && data) {
          data.forEach((item: any) => {
            const genre = item.genre;
            if (result[genre]) {
              result[genre].count!++;
              if (item.image) {
                result[genre].images.push(item.image);
              }
            }
          });
        }

        homeCache.set(cacheKey, result);
        if (!cancelled) {
          setCategoriesData(result);
        }
      } catch (err) {
        console.error('Error loading category data:', err);
      }
    }
    loadCategories();
    return () => { cancelled = true; };
  }, []);

  const animeData = useMemo(() => categoriesData.Anime, [categoriesData]);
  const moviesData = useMemo(() => categoriesData.Movies, [categoriesData]);
  const printestyData = useMemo(() => categoriesData.Printesty, [categoriesData]);

  return (
    <div>
      <SEO metadata={getHomeMetadata()} />
      <StructuredData schema={getOrganizationSchema()} />
      <StructuredData schema={getWebsiteSchema()} />
      <Hero
        leftPosterImage={HERO_CONFIG.leftPosterImage}
        centerPosterImage={HERO_CONFIG.centerPosterImage}
        rightPosterImage={HERO_CONFIG.rightPosterImage}
        leftPosterAlt={HERO_CONFIG.leftPosterAlt}
        centerPosterAlt={HERO_CONFIG.centerPosterAlt}
        rightPosterAlt={HERO_CONFIG.rightPosterAlt}
      />
      <ObjectiveSection />
      <CollectionsSection
        animeData={animeData}
        moviesData={moviesData}
        printestyData={printestyData}
      />

      {/* Promotion Section */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        className="py-24 bg-brand-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-brand-red p-12 md:p-24 comic-border flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="text-white max-w-xl">
              <h2 className="text-6xl md:text-8xl font-black leading-none mb-6">CUSTOMIZE YOUR REALM</h2>
              <p className="text-xl font-medium opacity-90 mb-10">
                Don't settle for generics. Upload your own artwork or use our themes
                to create a poster that is uniquely yours. Choose your size, material,
                and finish.
              </p>
              <Link
                to="/customize"
              >
                <span className="px-10 py-5 bg-black text-white font-display text-2xl uppercase tracking-widest hover:bg-white hover:text-black transition-all inline-flex">
                  Start Designing
                </span>
              </Link>
            </div>
            <div className="w-full max-w-sm aspect-square bg-black p-2 transform -rotate-3 transition-transform hover:rotate-0 duration-500" style={{ aspectRatio: '1/1' }}>
              <ProtectedImage
                src={getOptimizedImageUrl("https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=1000&auto=format&fit=crop", 400, 400)}
                alt="Customization Preview"
                width={400}
                height={400}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </motion.section>

      <Suspense fallback={null}>
        <CustomerShowcase />
        <RecentlyViewed />
        <FeedbackMarquee />
      </Suspense>
    </div>
  );
}

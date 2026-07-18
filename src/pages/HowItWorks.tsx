import { motion } from 'motion/react';
import { ReactNode } from 'react';
import { Package, Truck, Layers, Maximize, Palette, MousePointer2 } from 'lucide-react';
import { SEO } from '../components/SEO';
import { getStaticPageMetadata } from '../services/metadata';

const Step = ({ icon, title, desc, delay }: { icon: ReactNode, title: string, desc: string, delay: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -30 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.6 }}
    className="flex gap-6 items-start"
  >
    <div className="flex-shrink-0 w-16 h-16 bg-brand-black text-brand-red flex items-center justify-center border-2 border-brand-black shadow-[4px_4px_0px_0px_rgba(230,57,70,1)]">
      {icon}
    </div>
    <div>
      <h3 className="text-2xl font-black uppercase mb-2">{title}</h3>
      <p className="text-gray-600 font-medium leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

const MaterialCard = ({ title, desc, image }: { title: string, desc: string, image: string }) => (
  <div className="bg-white comic-border overflow-hidden group">
    <div className="h-64 bg-gray-200 overflow-hidden relative">
      <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
      <div className="absolute bottom-0 left-0 bg-brand-black text-white px-4 py-2 font-display text-xl uppercase">
        {title}
      </div>
    </div>
    <div className="p-8">
      <p className="text-gray-500 font-medium">{desc}</p>
    </div>
  </div>
);

export default function HowItWorks() {
  return (
    <div className="pt-32 pb-24 bg-brand-white">
      <SEO metadata={getStaticPageMetadata('How It Works', 'How It Works | Posterealm', 'Learn how Posterealm\'s custom poster printing works from uploading designs to delivery.')} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          className="mb-20 text-center max-w-3xl mx-auto"
        >
          <h1 className="text-6xl md:text-8xl font-black mb-6">HOW IT <span className="text-brand-red">WORKS</span></h1>
          <p className="text-xl text-gray-600 font-medium">
            From your screen to your walls. We've simplified the journey 
            of getting high-end custom posters.
          </p>
        </motion.div>

        {/* The Process */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 mb-32 items-center">
           <div className="space-y-12">
             <div className="inline-block px-4 py-1 bg-brand-red text-white text-xs font-black uppercase tracking-[0.2em] mb-4">
                The Journey
             </div>
             <Step 
               icon={<MousePointer2 size={32} />} 
               title="Choose or Upload" 
               desc="Browse our curated collections or upload your own high-resolution artwork. Our systems verify quality before you proceed."
               delay={0.1}
             />
             <Step 
               icon={<Palette size={32} />} 
               title="Configure Style" 
               desc="Pick your preferred material and finish. Whether it's Glossy for pop or Matte for sophistication, you control the look."
               delay={0.2}
             />
             <Step 
               icon={<Maximize size={32} />} 
               title="Select Poster Size" 
               desc="From compact A5 desk prints to massive A2 feature walls, we offer standard A-series sizing options to perfectly fit your space."
               delay={0.3}
             />
             <Step 
               icon={<Truck size={32} />} 
               title="Rapid Delivery" 
               desc="Once your order is placed, our local artisans craft it in 24 hours and ship it in reinforced protective tubes."
               delay={0.4}
             />
           </div>
           
           <div className="relative">
              <div className="aspect-square bg-gray-100 comic-border p-4 transform rotate-3">
                 <img 
                   src="/crafting-printer.jpg" 
                   alt="Mimaki CJV150-160BS poster printing setup" 
                   className="w-full h-full object-cover"
                   referrerPolicy="no-referrer"
                 />
              </div>
              <div className="absolute -bottom-10 -right-10 bg-brand-red text-white p-10 font-display text-5xl font-black uppercase leading-none shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                 24HR<br />CRAFTING
              </div>
           </div>
        </div>

        {/* Materials Insight */}
        <div className="mb-20">
          <div className="flex items-center gap-6 mb-12">
             <h2 className="text-5xl font-black uppercase">THE <span className="text-brand-red">MATERIALS</span></h2>
             <div className="flex-1 h-1 bg-brand-black"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <MaterialCard 
              title="Glossy Finish" 
              desc="High-reflectivity surface that makes colors pop. Ideal for vibrant photography, neon aesthetics, and modern pop-art."
              image="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=600&auto=format&fit=crop"
            />
            <MaterialCard 
              title="Matte Finish" 
              desc="A elegant, soft finish with zero glare. Perfect for black and white photography, minimalistic designs, and well-lit rooms."
              image="https://images.unsplash.com/photo-1554188248-986adbb73be4?q=80&w=600&auto=format&fit=crop"
            />
            <MaterialCard 
              title="Flagship Material" 
              desc="A wrinkle-free, crease-resistant, and built to withstand wear. It mounts perfectly flat with a bubble-free finish, ensuring your art stays straight and flawless on any wall."
              image="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"
            />
          </div>
        </div>
        
        {/* Sizing Guide */}
        <section className="bg-brand-black text-brand-white p-12 md:p-20 comic-border">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
             <div>
                <h2 className="text-5xl font-black uppercase mb-6">SIZING <span className="text-brand-red">GUIDE</span></h2>
                <p className="text-gray-400 mb-10 text-lg">
                  Unsure which size fits your space? We've standardized our sizing 
                  to match common frame sizes worldwide, but our Flagship XL 
                  is designed specifically for maximum impact.
                </p>
                <div className="space-y-4">
                   {[
                     { l: 'A5 (5.8" × 8.3")', d: 'Perfect for gallery walls and desk spaces.' },
                     { l: 'A4 (8.3" × 11.7")', d: 'Standard document size, great for detail.' },
                     { l: 'A3 (11.7" × 16.5")', d: 'Classic poster size for any room.' },
                     { l: 'A2 (16" × 23")', d: 'Impactful feature for major wall real estate.' }
                   ].map((sz, i) => (
                     <div key={i} className="flex items-center gap-4 group">
                        <div className="w-2 h-2 bg-brand-red group-hover:scale-150 transition-transform"></div>
                        <div>
                           <span className="font-mono font-bold text-xl">{sz.l}</span>
                           <span className="text-gray-500 ml-4 hidden md:inline">— {sz.d}</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
             <div className="bg-white/5 p-4 md:p-12 border border-white/10 relative overflow-hidden w-full">
                <div className="flex items-end justify-center gap-3 md:gap-6 h-60 md:h-80 border-b border-white/20 pb-0 w-full">
                   {[
                     { name: 'A5', w: 'w-7 md:w-10', h: 'h-11 md:h-16', dim: '5.8" × 8.3"', color: 'bg-brand-red/40' },
                     { name: 'A4', w: 'w-10 md:w-14', h: 'h-16 md:h-24', dim: '8.3" × 11.7"', color: 'bg-brand-red/60' },
                     { name: 'A3', w: 'w-14 md:w-20', h: 'h-24 md:h-36', dim: '11.7" × 16.5"', color: 'bg-brand-red/80' },
                     { name: 'A2', w: 'w-20 md:w-28', h: 'h-40 md:h-56', dim: '16" × 23"', color: 'bg-brand-red' }
                   ].map((sz, i) => (
                     <div key={i} className="flex flex-col items-center gap-2">
                        <span className="text-[9px] md:text-[10px] font-mono text-gray-500">{sz.dim}</span>
                        <div className={`${sz.w} ${sz.h} ${sz.color} border border-brand-red flex items-center justify-center relative group`}>
                           <span className="font-black text-[10px] md:text-sm text-white">{sz.name}</span>
                           {sz.name === 'A2' && (
                             <div className="absolute -top-2.5 -right-2.5 w-5 h-5 md:w-6 md:h-6 bg-brand-red rounded-full flex items-center justify-center text-[7px] md:text-[8px] font-black animate-pulse shadow-lg">XL</div>
                           )}
                        </div>
                     </div>
                   ))}
                </div>
                <p className="text-center mt-8 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">Visual Scale Comparison (Inches)</p>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}

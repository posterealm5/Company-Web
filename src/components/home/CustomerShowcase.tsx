import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Star, MapPin } from 'lucide-react';
import { getShowcaseEntries } from '../../services/showcase';
import { getOptimizedImageUrl } from '../../utils/imageUtils';
import type { ShowcaseEntry } from '../../types/database';
import { ProtectedImage } from '../ProtectedImage';

export default function CustomerShowcase() {
  const [entries, setEntries] = useState<ShowcaseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShowcase = async () => {
      try {
        const data = await getShowcaseEntries(true);
        setEntries(data);
      } catch (err) {
        console.error('Error fetching showcase entries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShowcase();
  }, []);

  if (loading || entries.length === 0) return null;

  return (
    <section className="py-24 bg-brand-white dark:bg-[#0D0D0D] border-t-4 border-brand-black dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-black text-brand-black dark:text-zinc-100 uppercase italic tracking-tighter"
          >
            REAL WALLS. <span className="text-brand-red">REAL CUSTOMERS.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-sm mt-4"
          >
            See how PosteRealm posters look in real spaces.
          </motion.p>
        </div>

        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5 }}
              className="break-inside-avoid bg-white dark:bg-zinc-900 comic-border p-4 mb-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(230,57,70,0.5)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-300 group flex flex-col"
            >
              <div className="overflow-hidden comic-border border-2 border-brand-black dark:border-zinc-700 mb-4 relative aspect-[3/4] protected-area">
                <ProtectedImage
                  src={getOptimizedImageUrl(entry.image_url, 450, 600)}
                  alt={entry.customer_name || 'Room Setup'}
                  width={450}
                  height={600}
                  loading="lazy"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                {entry.is_featured && (
                  <span className="absolute top-2 right-2 bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded comic-border border-amber-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)] flex items-center gap-1 z-10">
                    <Star size={8} className="fill-current text-white" /> Featured Setup
                  </span>
                )}
              </div>

              <div>
                <h4 className="font-black text-lg uppercase tracking-tight text-brand-black dark:text-zinc-100 flex items-center justify-between gap-2">
                  {entry.customer_name || 'Anonymous'}
                </h4>
                {entry.city && (
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-brand-red" /> {entry.city}
                  </p>
                )}
                {entry.caption && (
                  <p className="text-sm font-medium text-gray-600 dark:text-zinc-300 mt-3 italic leading-relaxed">
                    "{entry.caption}"
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

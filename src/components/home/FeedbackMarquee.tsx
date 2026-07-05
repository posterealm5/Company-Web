import React, { useState, useEffect } from 'react';
import { Quote, Star, CheckCircle, Loader2 } from 'lucide-react';
import { getReviews } from '../../services/reviews';
import { getOptimizedImageUrl } from '../../utils/imageUtils';
import type { Review } from '../../types/database';

export default function FeedbackMarquee() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveReviews = async () => {
      try {
        const data = await getReviews(true);
        setReviews(data);
      } catch (err) {
        console.error('Error loading reviews for marquee:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchActiveReviews();
  }, []);

  if (loading) {
    return (
      <section className="py-24 bg-brand-black overflow-hidden border-y-4 border-brand-red flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-red w-10 h-10" />
      </section>
    );
  }

  if (reviews.length === 0) return null;

  // Make sure we have a decent number of reviews to fill the screen width
  const baseReviews = reviews.length < 5 
    ? Array(Math.ceil(5 / reviews.length)).fill(reviews).flat()
    : reviews;

  return (
    <section className="py-24 bg-brand-black overflow-hidden border-y-4 border-brand-red">
      <style>{`
        @keyframes testimonial-marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(calc(-1 * var(--testimonial-marquee-width)), 0, 0);
          }
        }
        .animate-testimonial-marquee {
          animation: testimonial-marquee 38s linear infinite;
        }
      `}</style>

      <div className="mb-12 text-center">
        <h2 className="text-5xl md:text-7xl font-black text-white uppercase italic">WHAT CLIENTS <span className="text-brand-red">SAY</span></h2>
      </div>

      <div className="relative testimonial-marquee-container overflow-hidden w-full">
        <div 
          className="flex gap-8 animate-testimonial-marquee w-max"
          style={{ 
            '--testimonial-marquee-width': `${baseReviews.length * 26}rem`
          } as React.CSSProperties}
        >
          {/* First Group of Reviews */}
          {baseReviews.map((review, i) => (
            <div
              key={`c1-${i}`}
              className="flex-shrink-0 w-96 p-8 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition-colors"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <Quote className="text-brand-red" size={32} />
                  {review.is_verified_purchase && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/25">
                      <CheckCircle size={10} className="text-emerald-400" /> Verified
                    </span>
                  )}
                </div>
                <p className="text-xl text-gray-300 font-medium leading-relaxed italic mb-8 whitespace-normal">
                  "{review.review_text}"
                </p>
              </div>
              <div className="flex justify-between items-end border-t border-white/10 pt-6">
                <div>
                  <p className="font-black text-white uppercase tracking-wider">{review.name}</p>
                  <div className="flex gap-1 mt-2">
                    {[...Array(review.rating)].map((_, idx) => (
                      <Star key={idx} size={14} className="fill-brand-red text-brand-red" />
                    ))}
                  </div>
                </div>
                {review.avatar_url ? (
                  <img
                    src={getOptimizedImageUrl(review.avatar_url, 96, 96)}
                    alt={review.name}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="w-12 h-12 rounded-full object-cover comic-border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-brand-red font-black">
                    {review.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Second Duplicate Group of Reviews */}
          {baseReviews.map((review, i) => (
            <div
              key={`c2-${i}`}
              className="flex-shrink-0 w-96 p-8 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition-colors"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <Quote className="text-brand-red" size={32} />
                  {review.is_verified_purchase && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/25">
                      <CheckCircle size={10} className="text-emerald-400" /> Verified
                    </span>
                  )}
                </div>
                <p className="text-xl text-gray-300 font-medium leading-relaxed italic mb-8 whitespace-normal">
                  "{review.review_text}"
                </p>
              </div>
              <div className="flex justify-between items-end border-t border-white/10 pt-6">
                <div>
                  <p className="font-black text-white uppercase tracking-wider">{review.name}</p>
                  <div className="flex gap-1 mt-2">
                    {[...Array(review.rating)].map((_, idx) => (
                      <Star key={idx} size={14} className="fill-brand-red text-brand-red" />
                    ))}
                  </div>
                </div>
                {review.avatar_url ? (
                  <img
                    src={getOptimizedImageUrl(review.avatar_url, 96, 96)}
                    alt={review.name}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="w-12 h-12 rounded-full object-cover comic-border border-white/20"
                    referrerPolicy="no-referrer"
                    />
                ) : (
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-brand-red font-black">
                    {review.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

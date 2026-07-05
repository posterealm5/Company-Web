import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOffers } from '../services/offers';
import { Offer } from '../types/database';

interface OfferTickerProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const OfferTicker: React.FC<OfferTickerProps> = ({ onVisibilityChange }) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchOffers = async () => {
      try {
        const activeOffers = await getOffers(true);
        if (active) {
          setOffers(activeOffers);
          if (onVisibilityChange) {
            onVisibilityChange(activeOffers.length > 0);
          }
        }
      } catch (err) {
        console.error('Failed to load offers ticker:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchOffers();
    return () => {
      active = false;
    };
  }, [onVisibilityChange]);

  if (loading || offers.length === 0) return null;

  const renderTitle = (title: string, highlightColor?: string | null) => {
    // Priority 1: Check for explicit ** markers for custom highlights
    if (title.includes('**')) {
      const parts = title.split('**');
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <span 
              key={i} 
              style={highlightColor ? { color: highlightColor } : undefined}
              className={highlightColor ? "" : "text-[#ef4444]"}
            >
              {part}
            </span>
          );
        }
        return part;
      });
    }

    // Priority 2: Use regex to parse default keywords and highlight them in Brand Red (#ef4444)
    const regex = /(BUY\s+\d+\s+GET\s+\d+\s+FREE|FREE\s+SHIPPING|₹\s*\d+|\d+%\s+OFF|FREE)/gi;
    const parts = title.split(regex);
    return parts.map((part, i) => {
      if (part.match(regex)) {
        return (
          <span 
            key={i} 
            style={highlightColor ? { color: highlightColor } : undefined}
            className={highlightColor ? "" : "text-[#ef4444]"}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const renderOffersList = () => (
    <div className="flex items-center space-x-12 px-6">
      {offers.map((offer) => (
        <React.Fragment key={offer.id}>
          <div className="flex items-center space-x-4">
            {offer.target_link ? (
              <Link 
                to={offer.target_link} 
                className="hover:underline transition-all cursor-pointer inline-flex items-center"
              >
                {renderTitle(offer.title, offer.highlight_color)}
              </Link>
            ) : (
              <span className="inline-flex items-center">
                {renderTitle(offer.title, offer.highlight_color)}
              </span>
            )}
            {offer.coupon_code && (
              <span className="text-[10px] bg-red-500/20 text-[#ef4444] px-2 py-0.5 rounded border border-red-500/40 uppercase font-mono font-bold select-all">
                {offer.coupon_code}
              </span>
            )}
          </div>
          <span className="text-gray-600 font-normal select-none">•</span>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div 
      className="relative w-full overflow-hidden bg-black text-white h-10 flex items-center font-bold text-xs uppercase tracking-wider border-b border-brand-black z-50 select-none"
      role="marquee"
    >
      {/* We render the list of offers 4 times to ensure it overflows the screen width and loops seamlessly */}
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {renderOffersList()}
        {renderOffersList()}
        {renderOffersList()}
        {renderOffersList()}
      </div>
    </div>
  );
};

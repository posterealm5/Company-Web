import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';

interface CustomPosterCTAProps {
  className?: string;
  onClick?: () => void;
}

export const CustomPosterCTA: React.FC<CustomPosterCTAProps> = ({ className = '', onClick }) => {
  return (
    <Link
      to="/customize"
      onClick={onClick}
      className={`group block w-full p-4 bg-white border-2 border-brand-black hover:border-brand-red transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(230,57,70,1)] active:scale-[0.99] cursor-pointer ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1 text-left">
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-brand-red flex items-center gap-1.5 leading-none">
            <Sparkles size={13} className="shrink-0" /> WANT YOUR OWN DESIGN?
          </p>
          <p className="text-sm sm:text-base font-black uppercase tracking-tight text-brand-black group-hover:text-brand-red transition-colors flex items-center gap-1 leading-tight">
            Create a Custom Poster →
          </p>
        </div>
        <div className="shrink-0 w-8 h-8 rounded-full bg-brand-black text-white group-hover:bg-brand-red flex items-center justify-center transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
};

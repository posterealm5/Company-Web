import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Sparkles } from 'lucide-react';
import { SEO } from '../components/SEO';
import { getNotFoundMetadata } from '../services/metadata';

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-brand-white flex items-center justify-center p-6 pt-32 pb-24">
      <SEO metadata={getNotFoundMetadata(location.pathname)} />
      <div className="max-w-md w-full bg-white comic-border p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center space-y-8 relative overflow-hidden">
        <div className="absolute top-2 right-[-24px] bg-brand-red text-white text-[8px] font-black uppercase tracking-wider px-6 py-1 rotate-45">
          404
        </div>
        
        <div className="w-20 h-20 bg-red-50 flex items-center justify-center mx-auto comic-border border-brand-red rotate-3 hover:rotate-0 transition-transform duration-300">
          <Sparkles size={40} className="text-brand-red animate-pulse" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none">
            LOST IN <span className="text-brand-red">THE REALM</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-wider text-xs leading-relaxed">
            Looks like this poster escaped the wall.
          </p>
        </div>

        <div className="flex flex-col gap-4 pt-2">
          <Link to="/" className="w-full">
            <span className="w-full py-4 bg-brand-black text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 comic-border border-white hover:bg-brand-red transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none inline-flex">
              <Home size={16} /> Back Home
            </span>
          </Link>
          <Link to="/collections" className="w-full">
            <span className="w-full py-4 bg-white text-brand-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 comic-border border-brand-black hover:bg-gray-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none inline-flex">
              <Compass size={16} /> Browse Collections
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center w-full bg-brand-white">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-brand-red w-12 h-12 mx-auto" />
        <p className="text-xs font-black uppercase tracking-widest text-brand-black/60">{message}</p>
      </div>
    </div>
  );
};

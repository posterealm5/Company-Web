import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Unable to load data.",
  description = "A connection issue or temporary error occurred. Please check your internet connection.",
  onRetry
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white comic-border border-2 border-brand-black space-y-6 max-w-md mx-auto my-12 shadow-[8px_8px_0px_0px_rgba(255,0,0,1)]">
      <div className="w-16 h-16 bg-red-100 border-2 border-brand-red flex items-center justify-center mx-auto text-brand-red rotate-3">
        <AlertTriangle size={32} />
      </div>
      <div>
        <h3 className="text-2xl font-black uppercase tracking-tight">{title}</h3>
        {description && (
          <p className="text-gray-500 font-medium text-xs mt-2 leading-relaxed">{description}</p>
        )}
      </div>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-8 py-3 bg-brand-red text-white font-black uppercase text-xs tracking-widest hover:bg-brand-black transition-all comic-border border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
        >
          Retry
        </button>
      )}
    </div>
  );
};

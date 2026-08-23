import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onActionClick
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-zinc-900 comic-border border-2 border-brand-black dark:border-zinc-700 space-y-6 max-w-lg mx-auto my-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(230,57,70,0.5)]">
      <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 border-2 border-brand-black dark:border-zinc-700 flex items-center justify-center mx-auto text-brand-black dark:text-zinc-100 rotate-[-3deg] hover:rotate-0 transition-transform duration-300">
        <Icon size={32} />
      </div>
      <div className="space-y-2">
        <h3 className="text-3xl font-black uppercase tracking-tight text-brand-black dark:text-zinc-100">{title}</h3>
        <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm leading-relaxed max-w-sm mx-auto">{description}</p>
      </div>
      {actionLabel && onActionClick && (
        <button 
          onClick={onActionClick}
          className="px-8 py-4 bg-brand-black dark:bg-brand-red text-white font-black uppercase text-xs tracking-widest hover:bg-brand-red dark:hover:bg-red-600 transition-all comic-border border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

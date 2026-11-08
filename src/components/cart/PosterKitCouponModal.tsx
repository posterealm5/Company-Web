import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

export type PosterKitCouponModalMode = 'poster_kit_only' | 'mixed';

export interface PosterKitCouponModalProps {
  isOpen: boolean;
  mode?: PosterKitCouponModalMode;
  onClose: () => void;
}

export const PosterKitCouponModal: React.FC<PosterKitCouponModalProps> = ({
  isOpen,
  mode = 'poster_kit_only',
  onClose,
}) => {
  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const message =
    mode === 'mixed'
      ? 'Your Buy X Get Y offer applies only to eligible individual posters. Poster Kit products in your cart are excluded from this promotion.'
      : 'This Buy X Get Y offer is valid only on eligible individual posters. Poster Kit products are excluded from this promotion. You can use an eligible percentage-off coupon on your Poster Kit instead.';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="poster-kit-coupon-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-brand-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(230,57,70,0.45)] flex flex-col overflow-hidden text-brand-black dark:text-zinc-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-brand-black dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-red/10 dark:bg-brand-red/20 border border-brand-red flex items-center justify-center text-brand-red">
                  <AlertCircle size={18} />
                </div>
                <h3
                  id="poster-kit-coupon-modal-title"
                  className="text-lg font-display font-bold uppercase tracking-wider text-brand-black dark:text-zinc-100"
                >
                  Coupon Not Applicable to Poster Kit
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors focus:outline-none cursor-pointer text-brand-black dark:text-zinc-100"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-7 space-y-6">
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 leading-relaxed text-left">
                {message}
              </p>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 px-6 bg-brand-red text-white font-display font-bold text-base uppercase tracking-widest border-2 border-brand-black dark:border-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black dark:hover:bg-zinc-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center"
                >
                  OKAY
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};


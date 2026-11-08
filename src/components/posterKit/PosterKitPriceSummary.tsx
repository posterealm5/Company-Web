import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Receipt, ChevronDown, ChevronUp, Sparkles, ShoppingBag, AlertTriangle, X } from 'lucide-react';
import type { PlacedPoster } from '../../types/posterKit';
import {
  calculatePosterKitInvoice,
  formatPosterKitPrice,
  PosterKitInvoiceSummary,
  createPosterKitCartItem,
  validateWallLayout,
} from '../../utils/posterKitPricing';
import { useCart } from '../../context/CartContext';

export interface PosterKitPriceSummaryProps {
  posters: PlacedPoster[];
  variant?: 'standard' | 'fullscreen';
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onAddToCart?: (posters: PlacedPoster[]) => void;
}

export const PosterKitPriceSummary: React.FC<PosterKitPriceSummaryProps> = ({
  posters,
  variant = 'standard',
  className = '',
  collapsible = variant === 'fullscreen',
  defaultExpanded = true,
  onAddToCart,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isAdded, setIsAdded] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const { addMultipleToCart, addToCart, triggerNotification } = useCart();

  // Accessible Escape key listener for validation modal
  useEffect(() => {
    if (!isValidationModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsValidationModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isValidationModalOpen]);

  // Purely derived calculation from layout state (cannot become stale)
  const invoice: PosterKitInvoiceSummary = useMemo(() => {
    return calculatePosterKitInvoice(posters);
  }, [posters]);

  const handleAddWallToBag = () => {
    // 1. Validate every poster grid in the current layout
    const validation = validateWallLayout(posters);
    if (!validation.isValid) {
      // If layout is empty or any poster grid has no valid assigned artwork, do not add any items
      setIsValidationModalOpen(true);
      return;
    }

    // Phase 3B Guard: Verify all custom posters have completed cloud uploads with verified HTTPS URLs
    const hasUnuploadedCustomPoster = posters.some((p) => {
      const isCustom = p.artworkSource === 'custom' || Boolean(p.customArtworkId) || p.artwork?.source === 'custom';
      if (!isCustom) return false;
      const artworkUrl = p.artworkUrl || p.artwork?.url;
      return !artworkUrl || artworkUrl.startsWith('blob:') || !artworkUrl.startsWith('http');
    });

    if (hasUnuploadedCustomPoster) {
      triggerNotification?.('One or more custom posters are still uploading or not yet verified in cloud storage. Please wait a moment and try again.');
      return;
    }

    if (onAddToCart) {
      onAddToCart(posters);
      return;
    }
    const cartItems = posters.map(createPosterKitCartItem);
    if (addMultipleToCart) {
      addMultipleToCart(cartItems, `Added ${posters.length} Poster Kit ${posters.length === 1 ? 'poster' : 'posters'} to your bag! 🛒`);
    } else {
      cartItems.forEach((item) => addToCart(item));
      triggerNotification?.(`Added ${posters.length} Poster Kit posters to your bag! 🛒`);
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2500);
  };

  const isFullscreenVariant = variant === 'fullscreen';

  return (
    <>
      <section
        data-testid={isFullscreenVariant ? 'fullscreen-price-summary' : 'poster-kit-price-summary'}
      aria-label="Wall Layout Price Summary"
      className={`w-full bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 transition-all select-none ${
        isFullscreenVariant
          ? 'p-2 sm:p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(230,57,70,0.4)] text-xs'
          : 'p-3 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(230,57,70,0.4)]'
      } ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-brand-black dark:border-zinc-700">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`flex items-center justify-center shrink-0 bg-brand-red text-white ${
              isFullscreenVariant ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'
            } border border-brand-black dark:border-zinc-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]`}
          >
            <Receipt size={isFullscreenVariant ? 12 : 14} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h3
              data-testid="price-summary-heading"
              className={`font-display font-black tracking-wider uppercase text-brand-black dark:text-zinc-100 leading-tight ${
                isFullscreenVariant ? 'text-xs sm:text-sm' : 'text-sm sm:text-base md:text-lg'
              }`}
            >
              WALL LAYOUT PRICE SUMMARY
            </h3>
            {!isFullscreenVariant && (
              <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-zinc-400 font-mono hidden min-[400px]:block">
                Live breakdown per size &amp; material • No commitment
              </p>
            )}
          </div>
        </div>

        {/* Right side header: Item count, Subtotal pill & Collapse toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 sm:py-1 bg-neutral-100 dark:bg-zinc-800 border border-neutral-300 dark:border-zinc-700 font-mono text-[11px] sm:text-xs">
            <span className="text-neutral-500 dark:text-zinc-400">
              {invoice.totalQuantity} {invoice.totalQuantity === 1 ? 'item' : 'items'}
            </span>
            <span className="font-bold text-brand-red">
              {formatPosterKitPrice(invoice.subtotal)}
            </span>
          </div>

          {collapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              data-testid="fullscreen-price-summary-toggle"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse price summary' : 'Expand price summary'}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 border border-neutral-300 dark:border-zinc-700 text-neutral-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Invoice Content (Expandable or always visible) */}
      {(!collapsible || isExpanded) && (
        <div className="pt-2.5 sm:pt-3">
          {invoice.isEmpty ? (
            /* Friendly Empty State */
            <div
              data-testid="price-summary-empty"
              className="py-3 sm:py-4 px-3 bg-neutral-50 dark:bg-zinc-800/50 border border-dashed border-neutral-300 dark:border-zinc-700 text-center flex flex-col items-center justify-center gap-1.5"
            >
              <div className="flex items-center gap-1.5 text-neutral-600 dark:text-zinc-400 text-xs sm:text-sm font-medium">
                <Sparkles size={14} className="text-brand-red shrink-0" />
                <span>Add posters to your wall to see your price breakdown.</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-zinc-400">
                <span className="font-bold uppercase tracking-wider">LAYOUT SUBTOTAL:</span>
                <span data-testid="price-summary-subtotal" className="font-black text-brand-black dark:text-zinc-200">
                  {formatPosterKitPrice(0)}
                </span>
              </div>
            </div>
          ) : (
            /* Invoice Table */
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[280px]">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-zinc-800 text-[10px] sm:text-xs font-mono uppercase text-neutral-500 dark:text-zinc-400">
                    <th scope="col" className="py-1 sm:py-1.5 font-bold tracking-wider text-left">
                      Poster
                    </th>
                    <th scope="col" className="py-1 sm:py-1.5 font-bold tracking-wider text-center px-2">
                      Qty
                    </th>
                    <th scope="col" className="py-1 sm:py-1.5 font-bold tracking-wider text-right px-2">
                      Unit Price
                    </th>
                    <th scope="col" className="py-1 sm:py-1.5 font-bold tracking-wider text-right pl-2">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800/60 font-mono">
                  {invoice.items.map((item) => (
                    <tr
                      key={item.key}
                      data-testid={`price-summary-row-${item.sizeId}-${item.material}`}
                      className="hover:bg-neutral-50/80 dark:hover:bg-zinc-800/40 transition-colors text-xs sm:text-sm"
                    >
                      {/* Size & Material */}
                      <td className="py-1.5 sm:py-2 text-brand-black dark:text-zinc-100 font-sans">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-display font-black text-xs sm:text-sm uppercase text-brand-red dark:text-brand-red">
                            {item.sizeId}
                          </span>
                          <span className="text-neutral-400 dark:text-zinc-600 font-bold">•</span>
                          <span className="text-[11px] sm:text-xs font-semibold text-neutral-700 dark:text-zinc-300 whitespace-nowrap">
                            {item.materialName}
                          </span>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-1.5 sm:py-2 text-center px-2 text-brand-black dark:text-zinc-200 font-bold">
                        {item.quantity}
                      </td>

                      {/* Unit Price */}
                      <td className="py-1.5 sm:py-2 text-right px-2 text-neutral-600 dark:text-zinc-400">
                        {formatPosterKitPrice(item.unitPrice)}
                      </td>

                      {/* Line Amount */}
                      <td className="py-1.5 sm:py-2 text-right pl-2 font-bold text-brand-black dark:text-zinc-100">
                        {formatPosterKitPrice(item.lineAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-brand-black dark:border-zinc-700 font-mono">
                    <th
                      scope="row"
                      colSpan={2}
                      className="pt-2 sm:pt-2.5 pb-1 font-display font-black text-xs sm:text-sm uppercase tracking-wider text-brand-black dark:text-zinc-100"
                    >
                      LAYOUT SUBTOTAL
                    </th>
                    <td
                      colSpan={2}
                      className="pt-2 sm:pt-2.5 pb-1 text-right"
                    >
                      <span
                        data-testid="price-summary-subtotal"
                        className="font-mono font-black text-sm sm:text-base md:text-lg text-brand-red dark:text-brand-red"
                      >
                        {formatPosterKitPrice(invoice.subtotal)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Informative footer disclaimer note */}
              <div className="mt-1.5 pt-1.5 border-t border-neutral-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-[10px] text-neutral-400 dark:text-zinc-500 font-mono">
                <span className="truncate">
                  * All unit prices in INR (₹). Poster Kit print subtotal only.
                </span>
                <span className="shrink-0 font-bold uppercase">
                  {invoice.totalQuantity} {invoice.totalQuantity === 1 ? 'Poster' : 'Posters'}
                </span>
              </div>

              {/* Add Wall Layout to Bag button */}
              <div className="mt-3 pt-2.5 border-t-2 border-brand-black dark:border-zinc-700">
                <button
                  type="button"
                  onClick={handleAddWallToBag}
                  data-testid="add-wall-to-cart-button"
                  className="w-full py-2.5 sm:py-3 px-4 bg-brand-red hover:bg-brand-black text-white font-display text-xs sm:text-sm md:text-base font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 comic-border border-brand-black dark:border-zinc-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(230,57,70,0.4)] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                >
                  <ShoppingBag size={16} />
                  <span>
                    {isAdded
                      ? 'ADDED TO BAG! ✓'
                      : `ADD ${invoice.totalQuantity === 1 ? 'POSTER' : 'WALL LAYOUT'} TO BAG • ${formatPosterKitPrice(invoice.subtotal)}`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>

    {/* Validation Modal for Blank Poster Grids */}
    {typeof document !== 'undefined' && isValidationModalOpen && createPortal(
      <AnimatePresence>
        <div
          data-testid="complete-layout-modal"
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none pointer-events-auto"
          onClick={() => setIsValidationModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="validation-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 p-6 sm:p-8 text-center space-y-5 comic-border shadow-[8px_8px_0px_0px_rgba(230,57,70,1)] text-brand-black dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsValidationModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-brand-black dark:hover:text-white transition-colors"
              aria-label="Close notification"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 bg-red-100 dark:bg-red-950/60 border-2 border-brand-red text-brand-red flex items-center justify-center mx-auto comic-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <AlertTriangle size={24} className="stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h3
                id="validation-modal-title"
                data-testid="complete-layout-heading"
                className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight text-brand-black dark:text-zinc-100"
              >
                Complete Your Wall Layout
              </h3>
              <p 
                data-testid="complete-layout-message"
                className="text-xs sm:text-sm font-medium text-neutral-600 dark:text-zinc-300 leading-relaxed max-w-sm mx-auto"
              >
                Every poster needs a design before you can add your wall layout to the bag. Please add a design to each blank poster and try again.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                data-testid="complete-layout-okay-button"
                onClick={() => setIsValidationModalOpen(false)}
                className="w-full py-3 px-6 bg-brand-red hover:bg-brand-black text-white font-display text-sm sm:text-base font-black uppercase tracking-wider transition-all comic-border border-brand-black dark:border-zinc-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(230,57,70,0.4)] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
              >
                Okay
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>,
      document.body
    )}
  </>
  );
};

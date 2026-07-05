import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  // Calculate which page numbers to show on desktop
  const getPageNumbers = () => {
    const pages = [];
    const delta = 1; // Number of pages to show before and after current page
    
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center justify-center gap-4 mt-16 py-8 border-t-2 border-gray-150">
      {/* Desktop Pagination */}
      <div className="hidden sm:flex items-center gap-3">
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          className={`px-4 py-2 border-2 border-brand-black font-display text-lg uppercase tracking-wider flex items-center gap-1 transition-all duration-150 ${
            currentPage === 1
              ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-300 shadow-none'
              : 'bg-white cursor-pointer hover:bg-brand-red hover:text-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(230,57,70,1)]'
          }`}
        >
          <ChevronLeft size={18} /> Prev
        </button>

        {pageNumbers.map((page, idx) => {
          if (page === '...') {
            return (
              <span key={`dots-${idx}`} className="px-2 font-mono text-gray-500 font-bold">
                ...
              </span>
            );
          }

          const isCurrent = page === currentPage;
          return (
            <button
              key={page}
              onClick={() => onPageChange(Number(page))}
              className={`w-10 h-10 border-2 border-brand-black font-mono font-bold text-sm transition-all duration-150 flex items-center justify-center ${
                isCurrent
                  ? 'bg-brand-red text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-default'
                  : 'bg-white cursor-pointer hover:bg-brand-black hover:text-white hover:shadow-[4px_4px_0px_0px_rgba(230,57,70,1)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px]'
              }`}
            >
              {page}
            </button>
          );
        })}

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 border-2 border-brand-black font-display text-lg uppercase tracking-wider flex items-center gap-1 transition-all duration-150 ${
            currentPage === totalPages
              ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-300 shadow-none'
              : 'bg-white cursor-pointer hover:bg-brand-red hover:text-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(230,57,70,1)]'
          }`}
        >
          Next <ChevronRight size={18} />
        </button>
      </div>

      {/* Mobile Pagination */}
      <div className="flex sm:hidden items-center justify-between w-full max-w-[280px] px-2">
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          className={`px-3 py-1.5 border-2 border-brand-black font-display text-base uppercase tracking-wider flex items-center gap-0.5 transition-all duration-150 ${
            currentPage === 1
              ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-300 shadow-none'
              : 'bg-white cursor-pointer shadow-[3px_3px_0px_0px_rgba(230,57,70,1)]'
          }`}
        >
          <ChevronLeft size={16} /> Prev
        </button>

        <span className="font-mono font-bold text-sm bg-white border-2 border-brand-black px-4 py-1.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className={`px-3 py-1.5 border-2 border-brand-black font-display text-base uppercase tracking-wider flex items-center gap-0.5 transition-all duration-150 ${
            currentPage === totalPages
              ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-300 shadow-none'
              : 'bg-white cursor-pointer shadow-[3px_3px_0px_0px_rgba(230,57,70,1)]'
          }`}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

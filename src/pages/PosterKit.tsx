import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, RotateCcw, RotateCw, AlertTriangle, AlertCircle, X, Move, Sparkles, ArrowLeft, Maximize2, Image as ImageIcon, ImageOff, Layers, ChevronDown, Check } from 'lucide-react';
import { SEO } from '../components/SEO';
import { getPosterKitMetadata } from '../services/metadata';
import type { PosterSizeId, PosterOrientation, PlacedPoster, PosterArtwork, PosterMaterialId } from '../types/posterKit';
import { POSTER_MATERIALS, AVAILABLE_MATERIALS } from '../types/posterKit';
import { PosterDesignPickerModal } from '../components/posterKit/PosterDesignPickerModal';
import { PosterKitPriceSummary } from '../components/posterKit/PosterKitPriceSummary';
import { calculatePosterKitInvoice, formatPosterKitPrice } from '../utils/posterKitPricing';
import { getOptimizedWallArtworkUrl } from '../utils/imageUtils';
import {
  savePosterKitLayout,
  getSavedPosterKitLayout,
  clearSavedPosterKitLayout,
  getCustomArtworkBlob,
  deleteCustomArtworkBlob,
  clearAllCustomArtworkBlobs,
} from '../services/posterKitStorage';
import {
  POSTER_SIZES,
  AVAILABLE_SIZES,
  USABLE_WALL_BOUNDS,
  MOBILE_USABLE_WALL_BOUNDS,
  getUsableWallBounds,
  calculatePosterDimensions,
  getPosterDimensionsInches,
  getPosterDimensionsMm,
  clampPosterPosition,
  getNextPosterPlacement,
  getInitialPosters,
  normalizeMinimumPosterLayout,
  MOBILE_POSTER_SCALE_FACTOR,
  DESKTOP_POSTER_SCALE_FACTOR,
  getMobilePosterScale,
  getResponsivePosterScale,
  getResponsivePosterPlacement,
  toCanonicalPosterPlacement,
  WALL_ASPECT_RATIO,
  getPosterAspectRatio,
  getPosterCountScaleFactor,
  getFullScreenButtonProtectedRegion,
  avoidProtectedRegion,
} from '../utils/posterKitMath';

interface DragState {
  pointerId: number;
  posterId: string;
  startClientX: number;
  startClientY: number;
  startPosterX: number;
  startPosterY: number;
  renderedWidth: number;
  renderedHeight: number;
  containerWidth: number;
  containerHeight: number;
  isMobileZoomed: boolean;
  scaleFactor: number;
}

export default function PosterKit() {
  const [posters, setPosters] = useState<PlacedPoster[]>(() => {
    const saved = getSavedPosterKitLayout();
    if (saved && Array.isArray(saved.posters)) {
      return normalizeMinimumPosterLayout(saved.posters);
    }
    return getInitialPosters();
  });
  const [selectedPosterId, setSelectedPosterId] = useState<string | null>(null);
  const [materialMenuOpenPosterId, setMaterialMenuOpenPosterId] = useState<string | null>(null);
  const [activeSizeToAdd, setActiveSizeToAdd] = useState<PosterSizeId>(() => {
    const saved = getSavedPosterKitLayout();
    if (saved?.activeSizeToAdd && POSTER_SIZES[saved.activeSizeToAdd]) {
      return saved.activeSizeToAdd;
    }
    return 'A4';
  });
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isMinLayoutModalOpen, setIsMinLayoutModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fullscreenPreviewRef = useRef<HTMLDivElement>(null);

  // Responsive mobile viewport tracking for poster grid scaling below md breakpoint (768px)
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isMobileZoomed = isMobile && !isFullScreen;

  // Artwork Design Picker State
  const [isDesignPickerOpen, setIsDesignPickerOpen] = useState(false);
  const [designPickerTargetPosterId, setDesignPickerTargetPosterId] = useState<string | null>(null);
  const [isGuestAuthPromptOpen, setIsGuestAuthPromptOpen] = useState(false);

  // Track all active custom upload object URLs to ensure 100% leak-proof cleanup
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());
  // Track artwork URLs that failed to load to prevent unsightly broken-image icons
  const [failedArtworkUrls, setFailedArtworkUrls] = useState<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  // Pure derived live invoice-style price summary from layout state
  const invoiceSummary = useMemo(() => calculatePosterKitInvoice(posters), [posters]);

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenCanvasWrapperRef = useRef<HTMLDivElement>(null);
  const [fullscreenCanvasDimensions, setFullscreenCanvasDimensions] = useState<{
    width: number;
    height: number;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const availW = window.innerWidth - (window.innerWidth < 640 ? 24 : 48);
    const availH = window.innerHeight - (window.innerWidth < 640 ? 140 : 160);
    if (availW <= 0 || availH <= 0) return null;
    const targetAspect = WALL_ASPECT_RATIO;
    let width = availW;
    let height = width / targetAspect;
    if (height > availH) {
      height = availH;
      width = height * targetAspect;
    }
    return {
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
    };
  });

  // Dynamically compute exact 16:9 wall canvas dimensions in full-screen mode to prevent any stretching
  useEffect(() => {
    if (!isFullScreen) {
      return;
    }

    const wrapper = fullscreenCanvasWrapperRef.current;
    if (!wrapper) return;

    const updateCanvasDimensions = () => {
      const availW = wrapper.clientWidth;
      const availH = wrapper.clientHeight;
      if (availW <= 0 || availH <= 0) return;

      const targetAspect = WALL_ASPECT_RATIO;
      let width = availW;
      let height = width / targetAspect;

      if (height > availH) {
        height = availH;
        width = height * targetAspect;
      }

      setFullscreenCanvasDimensions({
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
      });
    };

    updateCanvasDimensions();
    const ro = new ResizeObserver(updateCanvasDimensions);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [isFullScreen, windowWidth]);

  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [panelHeight, setPanelHeight] = useState<number>(120);

  // Measure actual height of the bottom controls panel to calculate its optimal non-overlapping position
  useEffect(() => {
    const el = bottomPanelRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el) {
        setPanelHeight(el.offsetHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedPosterId, posters.length, windowWidth]);

  const selectedPoster = posters.find((p) => p.id === selectedPosterId) || null;

  // Add a new poster of the currently selected size (defaults to portrait and Matte material)
  const handleAddPoster = (sizeIdToUse?: PosterSizeId) => {
    const targetSize = sizeIdToUse || activeSizeToAdd;
    const wallBounds = getUsableWallBounds(windowWidth);
    const placement = getNextPosterPlacement(posters.length, targetSize, wallBounds);
    const newPoster: PlacedPoster = {
      id: `poster-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sizeId: targetSize,
      orientation: 'portrait',
      material: 'matte',
      xPercent: placement.xPercent,
      yPercent: placement.yPercent,
      widthPercent: placement.widthPercent,
      heightPercent: placement.heightPercent,
      label: `Poster #${posters.length + 1}`,
    };

    setPosters((prev) => [...prev, newPoster]);
    setSelectedPosterId(newPoster.id);
  };

  // Update material for a single targeted poster (independent per grid, never global)
  const handleUpdatePosterMaterial = (targetPosterId: string, material: PosterMaterialId) => {
    setPosters((prev) =>
      prev.map((poster) => {
        if (poster.id !== targetPosterId) return poster;
        return {
          ...poster,
          material,
        };
      })
    );
  };


  // Rotate the selected poster between portrait and landscape (preserves physical dimensions and area)
  const handleRotatePoster = (posterIdToRotate?: string) => {
    const targetId = posterIdToRotate || selectedPosterId;
    if (!targetId) return;

    setPosters((prev) =>
      prev.map((poster) => {
        if (poster.id !== targetId) return poster;

        const currentOrientation: PosterOrientation = poster.orientation || 'portrait';
        const nextOrientation: PosterOrientation = currentOrientation === 'portrait' ? 'landscape' : 'portrait';

        const newDims = calculatePosterDimensions(poster.sizeId, nextOrientation);

        // Keep center stationary during rotation
        const centerX = poster.xPercent + poster.widthPercent / 2;
        const centerY = poster.yPercent + poster.heightPercent / 2;

        const rawNewX = centerX - newDims.widthPercent / 2;
        const rawNewY = centerY - newDims.heightPercent / 2;

        // Ensure rotated poster stays completely inside usable wall bounds
        const wallBounds = getUsableWallBounds(windowWidth);
        const clamped = clampPosterPosition(
          rawNewX,
          rawNewY,
          newDims.widthPercent,
          newDims.heightPercent,
          wallBounds
        );

        return {
          ...poster,
          orientation: nextOrientation,
          xPercent: clamped.x,
          yPercent: clamped.y,
          widthPercent: newDims.widthPercent,
          heightPercent: newDims.heightPercent,
        };
      })
    );
  };

  // Open design selection interface for targeted poster
  const handleOpenDesignPicker = (posterIdToDesign?: string) => {
    const targetId = posterIdToDesign || selectedPosterId;
    if (!targetId) return;
    setDesignPickerTargetPosterId(targetId);
    setIsDesignPickerOpen(true);
  };

  // Hydrate custom artwork blobs from IndexedDB upon page load
  useEffect(() => {
    let isCancelled = false;

    async function hydrateCustomArtworks() {
      const postersNeedingHydration = posters.filter(
        (p) => p.artworkSource === 'custom' && p.customArtworkId && (!p.artworkUrl || p.artworkUrl.startsWith('blob:'))
      );

      if (postersNeedingHydration.length === 0) return;

      const updates: { id: string; url: string }[] = [];

      for (const poster of postersNeedingHydration) {
        if (!poster.customArtworkId) continue;
        try {
          const blob = await getCustomArtworkBlob(poster.customArtworkId);
          if (blob && !isCancelled) {
            const blobUrl = URL.createObjectURL(blob);
            activeBlobUrlsRef.current.add(blobUrl);
            updates.push({ id: poster.id, url: blobUrl });
          }
        } catch (e) {
          console.warn(`Failed to hydrate custom artwork for poster ${poster.id}:`, e);
        }
      }

      if (updates.length > 0 && !isCancelled) {
        setPosters((prev) =>
          prev.map((poster) => {
            const update = updates.find((u) => u.id === poster.id);
            if (!update) return poster;
            return {
              ...poster,
              artworkUrl: update.url,
              artwork: poster.artwork
                ? { ...poster.artwork, url: update.url }
                : {
                    source: 'custom',
                    url: update.url,
                    title: poster.artworkTitle || 'Custom Artwork',
                    isBlobUrl: true,
                    customArtworkId: poster.customArtworkId,
                  },
            };
          })
        );
      }
    }

    hydrateCustomArtworks();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Persist layout to versioned localStorage whenever posters or activeSizeToAdd change (except while actively dragging)
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }
    if (isDragging) return;
    savePosterKitLayout(posters, activeSizeToAdd);
  }, [posters, activeSizeToAdd, isDragging]);

  // Apply chosen artwork (from Collection or Custom Upload) to the target poster
  const handleApplyArtwork = (targetPosterId: string, artwork: PosterArtwork) => {
    if (artwork.isBlobUrl && artwork.url.startsWith('blob:')) {
      activeBlobUrlsRef.current.add(artwork.url);
    }

    // Clear any previous error state for this artwork URL
    setFailedArtworkUrls((prev) => {
      if (!prev.has(artwork.url)) return prev;
      const next = new Set(prev);
      next.delete(artwork.url);
      return next;
    });

    setPosters((prev) =>
      prev.map((poster) => {
        if (poster.id !== targetPosterId) return poster;

        // If replacing an existing custom blob URL, revoke the old one if no other poster uses it
        if (poster.artworkUrl && poster.artworkUrl.startsWith('blob:') && poster.artworkUrl !== artwork.url) {
          const isUsedElsewhere = prev.some(
            (other) => other.id !== targetPosterId && other.artworkUrl === poster.artworkUrl
          );
          if (!isUsedElsewhere) {
            try {
              URL.revokeObjectURL(poster.artworkUrl);
              activeBlobUrlsRef.current.delete(poster.artworkUrl);
            } catch {
              // Safe fallback
            }
          }
        }

        // If replacing a custom artwork with a different customArtworkId, remove from IndexedDB if not used elsewhere
        if (poster.customArtworkId && poster.customArtworkId !== artwork.customArtworkId) {
          const isCustomIdUsedElsewhere = prev.some(
            (other) => other.id !== targetPosterId && other.customArtworkId === poster.customArtworkId
          );
          if (!isCustomIdUsedElsewhere) {
            deleteCustomArtworkBlob(poster.customArtworkId).catch(() => {});
          }
        }

        return {
          ...poster,
          artwork,
          artworkUrl: artwork.url,
          originalArtworkUrl: artwork.originalArtworkUrl || (artwork.url && !artwork.url.startsWith('blob:') ? artwork.url : poster.originalArtworkUrl),
          artworkSource: artwork.source,
          artworkProductId: artwork.productId,
          collectionProductId: artwork.productId,
          artworkTitle: artwork.title,
          customArtworkId: artwork.customArtworkId,
          mockupUrl: artwork.mockupUrl,
          image_thumbnail_url: artwork.image_thumbnail_url,
          image_card_url: artwork.image_card_url,
          image_preview_url: artwork.image_preview_url,
          customArtworkFileName: artwork.customArtworkFileName,
        };
      })
    );
  };

  // Clear assigned artwork from the targeted poster, retaining poster grid, size, position & orientation
  const handleClearPosterDesign = (posterIdToClear?: string) => {
    const targetId = posterIdToClear || selectedPosterId;
    if (!targetId) return;

    const poster = posters.find((p) => p.id === targetId);
    if (!poster || !poster.artworkUrl) return;

    // Check if artwork URL is a blob URL and revoke it safely if no other poster uses it
    if (poster.artworkUrl.startsWith('blob:')) {
      const isUsedElsewhere = posters.some(
        (other) => other.id !== targetId && other.artworkUrl === poster.artworkUrl
      );
      if (!isUsedElsewhere) {
        try {
          URL.revokeObjectURL(poster.artworkUrl);
          activeBlobUrlsRef.current.delete(poster.artworkUrl);
        } catch {
          // Safe fallback
        }
      }
    }

    // If it had a customArtworkId, delete it from IndexedDB if not used elsewhere
    if (poster.customArtworkId) {
      const isCustomIdUsedElsewhere = posters.some(
        (other) => other.id !== targetId && other.customArtworkId === poster.customArtworkId
      );
      if (!isCustomIdUsedElsewhere) {
        deleteCustomArtworkBlob(poster.customArtworkId).catch(() => {});
      }
    }

    // Clear any image-load error for this artwork URL
    if (poster.artworkUrl) {
      setFailedArtworkUrls((prev) => {
        if (!prev.has(poster.artworkUrl!)) return prev;
        const next = new Set(prev);
        next.delete(poster.artworkUrl!);
        return next;
      });
    }

    // Clear artwork metadata while strictly preserving all layout properties
    setPosters((prev) =>
      prev.map((p) => {
        if (p.id !== targetId) return p;
        return {
          ...p,
          artwork: undefined,
          artworkUrl: undefined,
          artworkSource: undefined,
          artworkProductId: undefined,
          artworkTitle: undefined,
          customArtworkId: undefined,
          mockupUrl: undefined,
          image_thumbnail_url: undefined,
          image_card_url: undefined,
          image_preview_url: undefined,
          customArtworkFileName: undefined,
        };
      })
    );
  };

  // Revert poster back to blank cardstock placeholder (alias for handleClearPosterDesign)
  const handleRemoveArtwork = (targetPosterId: string) => {
    handleClearPosterDesign(targetPosterId);
  };

  // Remove the currently selected poster
  const handleRemovePoster = (posterIdToRemove?: string) => {
    const targetId = posterIdToRemove || selectedPosterId;
    if (!targetId) return;

    // Enforce layout minimum: cannot reduce layout below 3 poster grids
    if (posters.length <= 3) {
      setIsMinLayoutModalOpen(true);
      return;
    }

    const posterToRemove = posters.find((p) => p.id === targetId);
    if (posterToRemove?.artworkUrl && posterToRemove.artworkUrl.startsWith('blob:')) {
      const isUsedElsewhere = posters.some(
        (other) => other.id !== targetId && other.artworkUrl === posterToRemove.artworkUrl
      );
      if (!isUsedElsewhere) {
        try {
          URL.revokeObjectURL(posterToRemove.artworkUrl);
          activeBlobUrlsRef.current.delete(posterToRemove.artworkUrl);
        } catch {
          // Safe fallback
        }
      }
    }

    if (posterToRemove?.customArtworkId) {
      const isCustomUsedElsewhere = posters.some(
        (other) => other.id !== targetId && other.customArtworkId === posterToRemove.customArtworkId
      );
      if (!isCustomUsedElsewhere) {
        deleteCustomArtworkBlob(posterToRemove.customArtworkId).catch(() => {});
      }
    }

    setPosters((prev) => prev.filter((p) => p.id !== targetId));
    if (selectedPosterId === targetId) {
      setSelectedPosterId(null);
    }
    if (materialMenuOpenPosterId === targetId) {
      setMaterialMenuOpenPosterId(null);
    }
    if (designPickerTargetPosterId === targetId) {
      setIsDesignPickerOpen(false);
      setDesignPickerTargetPosterId(null);
    }
  };

  // Revoke all temporary object URLs
  const cleanupAllBlobUrls = () => {
    activeBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe fallback
      }
    });
    activeBlobUrlsRef.current.clear();
  };

  // Reset layout to initial 3-poster gallery wall
  const handleResetLayout = () => {
    cleanupAllBlobUrls();
    clearAllCustomArtworkBlobs().catch(() => {});
    const initial = getInitialPosters();
    setPosters(initial);
    savePosterKitLayout(initial, activeSizeToAdd);
    setSelectedPosterId(null);
    setMaterialMenuOpenPosterId(null);
    setIsDesignPickerOpen(false);
    setDesignPickerTargetPosterId(null);
  };

  // Clear all posters after confirmation - replaces empty-wall result with default layout of at least 3 grids
  const handleConfirmClear = () => {
    cleanupAllBlobUrls();
    clearAllCustomArtworkBlobs().catch(() => {});
    const defaultLayout = getInitialPosters();
    setPosters(defaultLayout);
    savePosterKitLayout(defaultLayout, activeSizeToAdd);
    clearSavedPosterKitLayout(activeSizeToAdd);
    setSelectedPosterId(null);
    setMaterialMenuOpenPosterId(null);
    setIsClearModalOpen(false);
    setIsDesignPickerOpen(false);
    setDesignPickerTargetPosterId(null);
  };


  // Enter full-screen viewing mode with native Fullscreen API and fallback overlay
  const handleEnterFullScreen = async () => {
    setIsFullScreen(true);

    try {
      const container = fullscreenPreviewRef.current || document.documentElement;
      if (
        typeof document !== 'undefined' &&
        document.fullscreenEnabled &&
        !document.fullscreenElement &&
        container?.requestFullscreen
      ) {
        await container.requestFullscreen().catch(() => {
          // Native fullscreen denied or unavailable; fallback fixed overlay handles it
        });
      }
    } catch {
      // Safe fallback
    }
  };

  // Exit full-screen viewing mode and restore normal editor
  const handleExitFullScreen = async () => {
    setIsFullScreen(false);

    try {
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Safe fallback
    }
  };

  // Clean up any lingering object URLs and exit native fullscreen on unmount
  useEffect(() => {
    return () => {
      cleanupAllBlobUrls();
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Listen for native fullscreen changes (e.g. user pressed Escape or used native browser controls)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Prevent background page scrolling while in full-screen mode
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (isFullScreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullScreen]);

  // Drag and drop handlers using unified Pointer Events with Pointer Capture
  const handlePointerDown = (e: React.PointerEvent, posterId: string) => {
    // Only primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const poster = posters.find((p) => p.id === posterId);
    if (!poster) return;

    setSelectedPosterId(posterId);

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }

    setIsDragging(true);

    const scaleFactor = getResponsivePosterScale(windowWidth, isFullScreen, posters.length);
    const renderedPos = getResponsivePosterPlacement(
      poster,
      windowWidth,
      isFullScreen,
      posters.length
    );

    const posterAspect = getPosterAspectRatio(poster.sizeId, poster.orientation || 'portrait');
    const derivedHeightPercent = Number(
      ((renderedPos.widthPercent * WALL_ASPECT_RATIO) / posterAspect).toFixed(3)
    );

    dragStateRef.current = {
      pointerId: e.pointerId,
      posterId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosterX: renderedPos.xPercent,
      startPosterY: renderedPos.yPercent,
      renderedWidth: renderedPos.widthPercent,
      renderedHeight: derivedHeightPercent,
      containerWidth: rect.width,
      containerHeight: rect.height,
      isMobileZoomed: !isFullScreen && scaleFactor > 1.0,
      scaleFactor,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== e.pointerId) return;

    e.preventDefault();
    const {
      posterId,
      startClientX,
      startClientY,
      startPosterX,
      startPosterY,
      renderedWidth,
      renderedHeight,
      containerWidth,
      containerHeight,
      isMobileZoomed: dragMobileZoomed,
      scaleFactor,
    } = dragStateRef.current;

    const poster = posters.find((p) => p.id === posterId);
    if (!poster) return;

    const deltaX = e.clientX - startClientX;
    const deltaY = e.clientY - startClientY;

    // Convert pixel offset to percentage coordinates of container
    const deltaXPercent = (deltaX / containerWidth) * 100;
    const deltaYPercent = (deltaY / containerHeight) * 100;

    const rawX = startPosterX + deltaXPercent;
    const rawY = startPosterY + deltaYPercent;

    const wallBounds = getUsableWallBounds(windowWidth);
    const protectedRegion = getFullScreenButtonProtectedRegion(
      windowWidth,
      containerWidth,
      containerHeight
    );

    if (scaleFactor !== 1.0 || dragMobileZoomed) {
      // Clamping in rendered space prevents poster from overflowing wall bounds or protected region
      const clampedRendered = clampPosterPosition(
        rawX,
        rawY,
        renderedWidth,
        renderedHeight,
        wallBounds,
        protectedRegion
      );

      // Invert back to canonical coordinates for clean, distortion-free persistence
      const canonicalPos = toCanonicalPosterPlacement(
        clampedRendered,
        poster,
        windowWidth,
        isFullScreen,
        posters.length
      );

      setPosters((prev) =>
        prev.map((p) =>
          p.id === posterId
            ? { ...p, xPercent: canonicalPos.xPercent, yPercent: canonicalPos.yPercent }
            : p
        )
      );
    } else {
      const clamped = clampPosterPosition(
        rawX,
        rawY,
        poster.widthPercent,
        poster.heightPercent,
        wallBounds,
        protectedRegion
      );

      setPosters((prev) =>
        prev.map((p) => (p.id === posterId ? { ...p, xPercent: clamped.x, yPercent: clamped.y } : p))
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStateRef.current && dragStateRef.current.pointerId === e.pointerId) {
      const target = e.currentTarget as HTMLElement;
      try {
        if (target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
      }

      dragStateRef.current = null;
      setIsDragging(false);
    }
  };

  // Keyboard shortcut: Delete / Backspace removes selected poster; Escape closes modal / deselects; R rotates; C clears design; Escape exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // When in full-screen viewing mode, Escape exits full-screen; other editor commands are blocked
      if (isFullScreen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleExitFullScreen();
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPosterId) {
        e.preventDefault();
        handleRemovePoster();
      } else if ((e.key === 'r' || e.key === 'R') && selectedPosterId) {
        e.preventDefault();
        handleRotatePoster();
      } else if ((e.key === 'c' || e.key === 'C') && selectedPosterId) {
        const target = posters.find((p) => p.id === selectedPosterId);
        if (target?.artworkUrl) {
          e.preventDefault();
          handleClearPosterDesign(selectedPosterId);
        }
      } else if (e.key === 'Escape') {
        if (isGuestAuthPromptOpen) {
          setIsGuestAuthPromptOpen(false);
        } else if (isMinLayoutModalOpen) {
          setIsMinLayoutModalOpen(false);
        } else if (materialMenuOpenPosterId) {
          setMaterialMenuOpenPosterId(null);
        } else if (isClearModalOpen) {
          setIsClearModalOpen(false);
        } else if (selectedPosterId) {
          setSelectedPosterId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPosterId, materialMenuOpenPosterId, isClearModalOpen, isMinLayoutModalOpen, isGuestAuthPromptOpen, posters, isFullScreen]);


  // Deselect poster when clicking empty wall area
  const handleWallBackgroundClick = () => {
    setSelectedPosterId(null);
    setMaterialMenuOpenPosterId(null);
  };

  // Resolve active portal mount target: browser fullscreenElement when active, fullscreenPreviewRef in fallback, or document.body
  const getPortalTarget = (): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    if (document.fullscreenElement) {
      return document.fullscreenElement as HTMLElement;
    }
    if (isFullScreen && fullscreenPreviewRef.current) {
      return fullscreenPreviewRef.current;
    }
    return document.body;
  };


  return (
    <div className="pt-28 pb-20 min-h-screen bg-brand-white dark:bg-[#0D0D0D] text-brand-black dark:text-zinc-100 transition-colors duration-200">
      <SEO metadata={getPosterKitMetadata()} />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-4 sm:mb-6 text-left">
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-brand-red text-white text-[10px] sm:text-[11px] font-black uppercase tracking-widest comic-border border-black dark:border-zinc-800">
              <Sparkles size={12} /> Poster Kit Designer
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-brand-black dark:text-zinc-100 mb-2 leading-tight">
            CURATE YOUR <span className="text-brand-red">WALL REALM</span>
          </h1>
          <p className="text-xs sm:text-base text-gray-600 dark:text-zinc-300 font-medium leading-relaxed">
            Plan your room decor on a realistic wall. Choose physical A6, A5, A4, or A3 poster sizes and drag them freely to craft your custom layout.
          </p>
        </div>

        {/* 1. Large Wall Preview with Floating Toolbar Overlay */}
        <div
          ref={fullscreenPreviewRef}
          className={
            isFullScreen
              ? "fixed inset-0 z-[100] w-screen h-screen bg-neutral-950 flex flex-col items-center justify-between p-3 sm:p-6 overflow-hidden select-none"
              : "relative z-10 isolate w-full aspect-[16/9] max-h-[720px] rounded-none overflow-hidden comic-border border-2 border-brand-black dark:border-zinc-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(230,57,70,0.5)] sm:dark:shadow-[8px_8px_0px_0px_rgba(230,57,70,0.5)] bg-neutral-200 dark:bg-neutral-900 select-none mx-auto"
          }
        >
          {/* Full-Screen Mode Header Bar with Back to Editor Button */}
          {isFullScreen && (
            <div className="w-full flex items-center justify-between z-50 shrink-0 mb-2 sm:mb-4 px-1 max-w-7xl">
              <button
                type="button"
                onClick={handleExitFullScreen}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-brand-black dark:bg-zinc-900 dark:text-zinc-100 hover:bg-brand-red hover:text-white dark:hover:bg-brand-red dark:hover:text-white comic-border border-2 border-brand-black dark:border-zinc-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(230,57,70,0.5)] font-display text-xs sm:text-sm font-black uppercase tracking-wider transition-colors cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                title="Back to Editor (Escape)"
                aria-label="Back to Editor"
                data-testid="exit-fullscreen-btn"
              >
                <ArrowLeft size={16} className="stroke-[2.5]" />
                <span>Back to Editor</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-black/60 text-white text-[11px] font-mono uppercase tracking-widest border border-white/20">
                  <Sparkles size={12} className="text-brand-red" />
                  Wall Realm Preview • {posters.length} {posters.length === 1 ? 'Poster' : 'Posters'}
                </span>
                <span className="text-[10px] font-mono text-neutral-400 hidden md:inline">
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-800 text-white rounded text-[9px] font-bold">ESC</kbd> to exit
                </span>
              </div>
            </div>
          )}

          {/* Wall Visualization Canvas (Measured by containerRef) */}
          <div ref={fullscreenCanvasWrapperRef} className={isFullScreen ? "flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden" : "contents"}>
            <div
              ref={containerRef}
              onClick={handleWallBackgroundClick}
              className={
                isFullScreen
                  ? "relative aspect-[16/9] max-w-full max-h-full overflow-hidden select-none shadow-[0_10px_40px_rgba(0,0,0,0.8)] comic-border border-2 border-brand-black dark:border-zinc-700 bg-neutral-200 dark:bg-neutral-900"
                  : "relative z-10 w-full h-full aspect-[16/9] overflow-hidden select-none touch-none cursor-default"
              }
              style={{
                ...(isFullScreen && fullscreenCanvasDimensions
                  ? {
                      width: `${fullscreenCanvasDimensions.width}px`,
                      height: `${fullscreenCanvasDimensions.height}px`,
                    }
                  : {}),
                aspectRatio: '16 / 9',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              {/* Full Screen Mode Trigger Button / Back to Editor Button (Visible in bottom-right of wall canvas) */}
              {isFullScreen ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExitFullScreen();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  className="absolute bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5 z-40 flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm text-brand-black dark:text-zinc-100 comic-border border-2 border-brand-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(230,57,70,1)] sm:shadow-[3px_3px_0px_0px_rgba(230,57,70,1)] dark:shadow-[2px_2px_0px_0px_rgba(230,57,70,0.8)] sm:dark:shadow-[3px_3px_0px_0px_rgba(230,57,70,0.8)] hover:bg-neutral-100 dark:hover:bg-zinc-800 hover:text-brand-red dark:hover:text-brand-red transition-all text-xs font-bold uppercase tracking-wider cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                  title="Back to Editor (Escape)"
                  aria-label="Back to Editor"
                  data-testid="exit-fullscreen-btn"
                >
                  <ArrowLeft size={13} className="stroke-[2.5]" />
                  <span className="text-[9px] min-[360px]:text-[10px] sm:text-xs">Back to Editor</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnterFullScreen();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  className="absolute bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5 z-40 flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm text-brand-black dark:text-zinc-100 comic-border border-2 border-brand-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(230,57,70,1)] sm:shadow-[3px_3px_0px_0px_rgba(230,57,70,1)] dark:shadow-[2px_2px_0px_0px_rgba(230,57,70,0.8)] sm:dark:shadow-[3px_3px_0px_0px_rgba(230,57,70,0.8)] hover:bg-neutral-100 dark:hover:bg-zinc-800 hover:text-brand-red dark:hover:text-brand-red transition-all text-xs font-bold uppercase tracking-wider cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                  title="Full Screen Preview"
                  aria-label="View wall preview in full screen"
                  data-testid="enter-fullscreen-btn"
                >
                  <Maximize2 size={13} className="stroke-[2.5]" />
                  <span className="text-[9px] min-[360px]:text-[10px] sm:text-xs">Full Screen</span>
                </button>
              )}

              {/* Wall Room Background Layer (Dedicated background-only wrapper with responsive mobile zoom) */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
                <img
                  id="wall-bg-image"
                  src="/wall-background.jpg"
                  alt="Clean straight-on modern room wall"
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-transform duration-300 ${
                    isFullScreen
                      ? 'scale-100 origin-center'
                      : 'scale-[1.38] md:scale-100 origin-[50%_42%] md:origin-center'
                  }`}
                  draggable={false}
                  loading="eager"
                />

                {/* Subtle ambient lighting vignette overlay */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-black/10 mix-blend-multiply"></div>
              </div>

              {/* Usable wall boundary guide (Subtle indicator while dragging) */}
              {isDragging && !isFullScreen && (() => {
                const wallBounds = getUsableWallBounds(windowWidth);
                return (
                  <div
                    className="absolute pointer-events-none border border-dashed border-neutral-400/40 dark:border-zinc-500/40 transition-opacity"
                    style={{
                      left: `${wallBounds.minX}%`,
                      top: `${wallBounds.minY}%`,
                      width: `${wallBounds.maxX - wallBounds.minX}%`,
                      height: `${wallBounds.maxY - wallBounds.minY}%`,
                    }}
                  >
                    <span className="absolute top-1 left-2 text-[8px] sm:text-[9px] font-mono font-medium text-neutral-400/60 dark:text-zinc-500/60 uppercase tracking-wider select-none pointer-events-none">
                      Usable Wall Area
                    </span>
                  </div>
                );
              })()}

              {/* Placed Posters on the Wall */}
              {posters.map((poster) => {
                const isSelected = poster.id === selectedPosterId;
                const sizeConfig = POSTER_SIZES[poster.sizeId];
                const posterOrientation: PosterOrientation = poster.orientation || 'portrait';
                const scaleRatio = sizeConfig.heightMm / 420;

                const currentDimensionsInches = getPosterDimensionsInches(poster.sizeId, posterOrientation);
                const currentDimensionsMm = getPosterDimensionsMm(poster.sizeId, posterOrientation);

                // Derive responsive rendered dimensions and positions for mobile, tablet, laptop, and desktop viewports
                // while preserving the original canonical layout data (poster.xPercent, poster.yPercent, poster.widthPercent, poster.heightPercent)
                const renderedPos = getResponsivePosterPlacement(
                  poster,
                  windowWidth,
                  isFullScreen,
                  posters.length
                );

                const posterAspect = getPosterAspectRatio(poster.sizeId, posterOrientation);
                const physWidthMm = posterOrientation === 'landscape' ? sizeConfig.heightMm : sizeConfig.widthMm;
                const physHeightMm = posterOrientation === 'landscape' ? sizeConfig.widthMm : sizeConfig.heightMm;
                const derivedHeightPercent = Number(
                  ((renderedPos.widthPercent * WALL_ASPECT_RATIO) / posterAspect).toFixed(3)
                );

                return (
                  <div
                    key={poster.id}
                    onPointerDown={(e) => handlePointerDown(e, poster.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPosterId(poster.id);
                    }}
                    className={`absolute transition-shadow duration-150 select-none group ${
                      isSelected
                        ? 'z-30 cursor-grabbing'
                        : 'z-10 cursor-grab hover:z-20'
                    }`}
                    style={{
                      left: `${renderedPos.xPercent}%`,
                      top: `${renderedPos.yPercent}%`,
                      width: `${renderedPos.widthPercent}%`,
                      height: `${derivedHeightPercent}%`,
                      aspectRatio: `${physWidthMm} / ${physHeightMm}`,
                      touchAction: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                  >
                    {/* Selection Indicator Halo */}
                    {isSelected && (
                      <div className="absolute -inset-1 border-2 border-brand-red pointer-events-none animate-pulse z-20"></div>
                    )}

                    {/* Contextual Action Menu associated with the selected poster (Desktop only; mobile actions are dedicated below the wall canvas) */}
                    {isSelected && !isFullScreen && (
                      <div
                        className={`hidden md:block contextual-action-menu absolute z-40 select-none pointer-events-auto transition-all w-[215px] min-[360px]:w-[235px] md:w-auto max-w-[calc(100vw-36px)] ${
                          poster.yPercent >= 11 || renderedPos.yPercent >= 11
                            ? (renderedPos.yPercent < 38 || poster.yPercent < 38 ? 'top-full mt-1.5 md:bottom-full md:mb-2' : 'bottom-full mb-1.5 sm:mb-2')
                            : 'top-full mt-1.5 sm:mt-2'
                        } ${
                          poster.xPercent < 10 || renderedPos.xPercent < 10
                            ? 'left-0 translate-x-0'
                            : poster.xPercent < 22 || renderedPos.xPercent < 22
                            ? 'left-0 translate-x-0 md:left-1/2 md:-translate-x-1/2'
                            : (renderedPos.xPercent + renderedPos.widthPercent > 80) || (poster.xPercent + poster.widthPercent > 80)
                            ? 'right-0 left-auto translate-x-0'
                            : 'left-1/2 -translate-x-1/2'
                        }`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        {/* Desktop Single-Row Toolbar (Viewports md: 768px and wider) */}
                        <div
                          className="hidden md:flex items-center h-9 px-1 gap-0.5 whitespace-nowrap bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-2 border-brand-black dark:border-zinc-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(230,57,70,0.5)] select-none shrink-0"
                        >
                          {/* Size & Orientation Badge */}
                          <div className="flex items-center gap-1 px-2 py-1 border-r border-neutral-200 dark:border-zinc-700 shrink-0">
                            <span className="font-display font-black text-xs text-brand-red leading-none">
                              {sizeConfig.name}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500 dark:text-zinc-400">
                              {posterOrientation === 'landscape' ? 'Land.' : 'Port.'}
                            </span>
                          </div>

                          {/* Material Selector Trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMaterialMenuOpenPosterId((prev) => (prev === poster.id ? null : poster.id));
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-zinc-200 hover:text-brand-red dark:hover:text-brand-red hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer shrink-0 border-r border-neutral-200 dark:border-zinc-700"
                            title={`Material: ${POSTER_MATERIALS[poster.material || 'matte'].name} (Click to change)`}
                            aria-label={`Change material for ${sizeConfig.name} poster, currently ${POSTER_MATERIALS[poster.material || 'matte'].name}`}
                            data-testid={`material-trigger-${poster.id}`}
                          >
                            <Layers size={12} className="stroke-[2.5] shrink-0" />
                            <span className="text-xs">
                              {POSTER_MATERIALS[poster.material || 'matte'].name}
                            </span>
                            <ChevronDown size={11} className="stroke-[2.5] ml-0.5 shrink-0" />
                          </button>

                          {/* Change / Add Design Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDesignPicker(poster.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-zinc-200 hover:text-brand-red dark:hover:text-brand-red hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer shrink-0"
                            title={poster.artworkUrl ? 'Change Design' : 'Add Design'}
                            aria-label={`${poster.artworkUrl ? 'Change' : 'Add'} design for ${sizeConfig.name} poster`}
                          >
                            <ImageIcon size={12} className="stroke-[2.5] shrink-0" />
                            <span>{poster.artworkUrl ? 'Change Design' : 'Add Design'}</span>
                          </button>

                          {/* Clear Design Action Button (only visible when poster has assigned artwork) */}
                          {poster.artworkUrl && (
                            <>
                              <div className="w-px h-4 bg-neutral-200 dark:bg-zinc-700 shrink-0"></div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearPosterDesign(poster.id);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-zinc-200 hover:text-brand-red dark:hover:text-brand-red hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer shrink-0"
                                title="Clear Design from poster (C)"
                                aria-label={`Clear design from ${sizeConfig.name} poster`}
                              >
                                <ImageOff size={12} className="stroke-[2.5] shrink-0" />
                                <span>Clear Design (C)</span>
                              </button>
                            </>
                          )}

                          <div className="w-px h-4 bg-neutral-200 dark:bg-zinc-700 shrink-0"></div>

                          {/* Rotate Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotatePoster(poster.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-zinc-200 hover:text-brand-red dark:hover:text-brand-red hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer shrink-0"
                            title={`Rotate ${sizeConfig.name} to ${posterOrientation === 'landscape' ? 'Portrait' : 'Landscape'} (R)`}
                            aria-label={`Rotate ${sizeConfig.name} to ${posterOrientation === 'landscape' ? 'portrait' : 'landscape'}`}
                          >
                            <RotateCw size={12} className="stroke-[2.5] shrink-0" />
                            <span>Rotate Grid</span>
                          </button>

                          <div className="w-px h-4 bg-neutral-200 dark:bg-zinc-700 shrink-0"></div>

                          {/* Delete Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePoster(poster.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-red hover:bg-brand-red hover:text-white transition-colors focus:outline-none cursor-pointer shrink-0"
                            title="Delete poster (Delete / Backspace)"
                            aria-label={`Delete ${sizeConfig.name} poster`}
                          >
                            <Trash2 size={12} className="stroke-[2.5] shrink-0" />
                            <span>Delete Grid</span>
                          </button>
                        </div>

                        {/* Mobile Contextual 2-Row Action Panel (Viewports < md: 768px) */}
                        <div
                          className="flex md:hidden flex-col p-1.5 w-[215px] min-[360px]:w-[235px] max-w-[calc(100vw-36px)] box-border bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-2 border-brand-black dark:border-zinc-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(230,57,70,0.5)] select-none"
                        >
                          {/* Header row on mobile: Size & Orientation Badge + Material Selector Trigger */}
                          <div className="flex items-center justify-between w-full border-b border-neutral-200 dark:border-zinc-700 pb-1 mb-1.5">
                            {/* Size & Orientation Badge */}
                            <div className="flex items-center gap-1 px-1 py-0.5">
                              <span className="font-display font-black text-xs text-brand-red leading-none">
                                {sizeConfig.name}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-500 dark:text-zinc-400">
                                {posterOrientation === 'landscape' ? 'Land.' : 'Port.'}
                              </span>
                            </div>

                            {/* Material Selector Trigger */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMaterialMenuOpenPosterId((prev) => (prev === poster.id ? null : poster.id));
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-800 dark:text-zinc-200 hover:text-brand-red dark:hover:text-brand-red bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none cursor-pointer border border-neutral-200 dark:border-zinc-700"
                              title={`Material: ${POSTER_MATERIALS[poster.material || 'matte'].name} (Click to change)`}
                              aria-label={`Change material for ${sizeConfig.name} poster, currently ${POSTER_MATERIALS[poster.material || 'matte'].name}`}
                              data-testid={`material-trigger-${poster.id}`}
                            >
                              <Layers size={11} className="stroke-[2.5] shrink-0" />
                              <span>{POSTER_MATERIALS[poster.material || 'matte'].name}</span>
                              <ChevronDown size={10} className="stroke-[2.5] ml-0.5 shrink-0" />
                            </button>
                          </div>

                          {/* 2-Row Action Grid */}
                          <div className="w-full space-y-1.5">
                            {/* Row 1: Change Design (or Add Design) and Clear Design when artwork is assigned */}
                            <div className={`grid ${poster.artworkUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5 w-full`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDesignPicker(poster.id);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="min-w-0 box-border w-full py-1.5 px-1 min-h-[36px] bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border border-neutral-200 dark:border-zinc-700 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer text-center leading-tight whitespace-normal"
                                title={poster.artworkUrl ? 'Change Design' : 'Add Design'}
                                aria-label={`${poster.artworkUrl ? 'Change' : 'Add'} design for ${sizeConfig.name} poster`}
                              >
                                <ImageIcon size={12} className="stroke-[2.5] shrink-0" />
                                <span className="min-w-0">{poster.artworkUrl ? 'Change Design' : 'Add Design'}</span>
                              </button>

                              {poster.artworkUrl && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearPosterDesign(poster.id);
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  className="min-w-0 box-border w-full py-1.5 px-1 min-h-[36px] bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border border-neutral-200 dark:border-zinc-700 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer text-center leading-tight whitespace-normal"
                                  title="Clear Design from poster (C)"
                                  aria-label={`Clear design from ${sizeConfig.name} poster`}
                                >
                                  <ImageOff size={12} className="stroke-[2.5] shrink-0" />
                                  <span className="min-w-0">Clear Design (C)</span>
                                </button>
                              )}
                            </div>

                            {/* Row 2: Rotate and Delete */}
                            <div className="grid grid-cols-2 gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRotatePoster(poster.id);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="min-w-0 box-border w-full py-1.5 px-1 min-h-[36px] bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border border-neutral-200 dark:border-zinc-700 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer text-center leading-tight"
                                title={`Rotate ${sizeConfig.name} to ${posterOrientation === 'landscape' ? 'Portrait' : 'Landscape'} (R)`}
                                aria-label={`Rotate ${sizeConfig.name} to ${posterOrientation === 'landscape' ? 'portrait' : 'landscape'}`}
                              >
                                <RotateCw size={12} className="stroke-[2.5] shrink-0" />
                                <span>Rotate</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePoster(poster.id);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="min-w-0 box-border w-full py-1.5 px-1 min-h-[36px] bg-red-50 dark:bg-red-950/40 hover:bg-brand-red hover:text-white text-brand-red border border-brand-red/30 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer text-center leading-tight"
                                title="Delete poster (Delete / Backspace)"
                                aria-label={`Delete ${sizeConfig.name} poster`}
                              >
                                <Trash2 size={12} className="stroke-[2.5] shrink-0" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Poster Paper Cardstock Surface (Unframed Print flush on wall) */}
                  <div
                    className={`poster-cardstock relative w-full h-full border border-neutral-300/80 transition-transform duration-100 overflow-hidden bg-[#FAF9F6] ${
                      poster.artworkUrl
                        ? ''
                        : 'flex flex-col items-center justify-between'
                    } ${
                      isSelected
                        ? 'shadow-[0_16px_32px_-6px_rgba(0,0,0,0.35),0_6px_12px_-2px_rgba(0,0,0,0.2)] scale-[1.01]'
                        : 'shadow-[0_5px_15px_-2px_rgba(0,0,0,0.22),0_2px_6px_-1px_rgba(0,0,0,0.12)] hover:shadow-[0_10px_24px_-4px_rgba(0,0,0,0.28)]'
                    }`}
                    style={{
                      containerType: 'size',
                      padding: poster.artworkUrl ? 0 : 'clamp(2px, 3.5cqw, 10px)',
                    }}
                  >
                    {poster.artworkUrl && !failedArtworkUrls.has(poster.artworkUrl) ? (
                      /* Assigned Artwork Preview (Full inner surface, edge-to-edge, filled naturally with object-cover and centered) */
                      <>
                        <img
                          src={getOptimizedWallArtworkUrl(poster.artworkUrl)}
                          alt={poster.artworkTitle || `${sizeConfig.name} Artwork`}
                          className="w-full h-full object-cover object-center pointer-events-none select-none"
                          draggable={false}
                          onError={() => {
                            if (poster.artworkUrl) {
                              setFailedArtworkUrls((prev) => new Set(prev).add(poster.artworkUrl!));
                            }
                          }}
                        />

                        {/* Subtle Material Finish Treatment (Zero CSS color distortion; purely structural/sheen highlight) */}
                        {poster.material === 'glossy' && (
                          <div 
                            className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-60" 
                            aria-hidden="true" 
                          />
                        )}
                        {poster.material === 'rigid_board' && (
                          <div 
                            className="absolute inset-0 pointer-events-none border border-black/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]" 
                            aria-hidden="true" 
                          />
                        )}
                      </>
                    ) : poster.artworkUrl && failedArtworkUrls.has(poster.artworkUrl) ? (

                      /* Graceful Error Fallback State (Never leaves broken image icon or raw filename) */
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-[#FAF9F6] select-none">
                        <AlertTriangle size={18} className="text-brand-red stroke-[2.5] mb-1" />
                        <span className="font-display font-black text-[10px] sm:text-xs uppercase tracking-wider text-brand-black">
                          Artwork Error
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-neutral-500 font-medium line-clamp-1 max-w-[90%] mt-0.5">
                          Unable to render artwork
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDesignPicker(poster.id);
                          }}
                          className="mt-1.5 px-2 py-0.5 bg-brand-black text-white hover:bg-brand-red text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Replace
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Architectural Crop Marks (L-shaped corners scaled with container width) */}
                        <div 
                          className="poster-crop-mark absolute pointer-events-none border-t border-l border-neutral-400/60"
                          style={{
                            top: 'clamp(1px, 2cqw, 4px)',
                            left: 'clamp(1px, 2cqw, 4px)',
                            width: 'clamp(3px, 5cqw, 7px)',
                            height: 'clamp(3px, 5cqw, 7px)',
                          }}
                        />
                        <div 
                          className="poster-crop-mark absolute pointer-events-none border-t border-r border-neutral-400/60"
                          style={{
                            top: 'clamp(1px, 2cqw, 4px)',
                            right: 'clamp(1px, 2cqw, 4px)',
                            width: 'clamp(3px, 5cqw, 7px)',
                            height: 'clamp(3px, 5cqw, 7px)',
                          }}
                        />
                        <div 
                          className="poster-crop-mark absolute pointer-events-none border-b border-l border-neutral-400/60"
                          style={{
                            bottom: 'clamp(1px, 2cqw, 4px)',
                            left: 'clamp(1px, 2cqw, 4px)',
                            width: 'clamp(3px, 5cqw, 7px)',
                            height: 'clamp(3px, 5cqw, 7px)',
                          }}
                        />
                        <div 
                          className="poster-crop-mark absolute pointer-events-none border-b border-r border-neutral-400/60"
                          style={{
                            bottom: 'clamp(1px, 2cqw, 4px)',
                            right: 'clamp(1px, 2cqw, 4px)',
                            width: 'clamp(3px, 5cqw, 7px)',
                            height: 'clamp(3px, 5cqw, 7px)',
                          }}
                        />

                        {/* Top micro brand / size label */}
                        <div 
                          className="poster-header-label w-full flex justify-between items-center font-mono text-neutral-400 uppercase tracking-widest pointer-events-none leading-none shrink-0"
                          style={{
                            fontSize: `clamp(calc(4px + 1.5px * ${scaleRatio}), 7cqw, calc(7px + 2px * ${scaleRatio}))`,
                          }}
                        >
                          <span className="truncate max-w-[65%]">POSTEREALM</span>
                          <span className="font-bold text-neutral-500">{sizeConfig.name}</span>
                        </div>

                        {/* Center Typography Placeholder */}
                        <div className="my-auto text-center pointer-events-none flex flex-col items-center justify-center w-full px-0.5">
                          <span 
                            className="poster-size-title font-display font-black tracking-tight text-neutral-800 leading-none"
                            style={{
                              fontSize: `clamp(calc(7.5px + 5.5px * ${scaleRatio}), 26cqw, calc(14px + 22px * ${scaleRatio}))`,
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {sizeConfig.name}
                          </span>
                          
                          <span 
                            className="poster-dim-label font-mono font-semibold text-neutral-600 leading-none mt-[clamp(1px,1.5cqw,4px)] truncate max-w-full"
                            style={{
                              fontSize: `clamp(calc(4.5px + 2px * ${scaleRatio}), 8.5cqw, calc(8px + 4px * ${scaleRatio}))`,
                            }}
                          >
                            {currentDimensionsInches}
                          </span>

                          <span 
                            className="poster-mm-label font-mono text-neutral-400 leading-none mt-[clamp(1px,1cqw,3px)] truncate max-w-full"
                            style={{
                              fontSize: `clamp(calc(4px + 1.5px * ${scaleRatio}), 7cqw, calc(7px + 3px * ${scaleRatio}))`,
                            }}
                          >
                            {currentDimensionsMm}
                          </span>
                        </div>

                        {/* Bottom micro label */}
                        <div 
                          className="poster-footer-label w-full text-center font-mono uppercase tracking-widest text-neutral-400 pointer-events-none border-t border-neutral-200/60 pt-0.5 leading-none shrink-0 truncate"
                          style={{
                            fontSize: `clamp(calc(4px + 1.5px * ${scaleRatio}), 6.5cqw, calc(6.5px + 2.5px * ${scaleRatio}))`,
                          }}
                        >
                          <span>{poster.material === 'rigid_board' ? 'RIGID BOARD • MOUNTED' : `UNFRAMED PRINT • ${POSTER_MATERIALS[poster.material || 'matte'].name.toUpperCase()}`}</span>
                        </div>

                      </>
                    )}
                  </div>


                  {/* Touch padding hitbox extension to ensure easy tapping on mobile */}
                  <div className="absolute -inset-2 pointer-events-none"></div>
                </div>
              );
            })}

            {/* Empty State Banner (When all posters cleared) */}
            {posters.length === 0 && (
              <div
                data-testid="empty-wall-state"
                className="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pointer-events-none"
              >
                <div
                  className="w-full max-w-[280px] min-[360px]:max-w-[320px] sm:max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-3.5 sm:p-6 text-center comic-border border-2 border-brand-black dark:border-zinc-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(230,57,70,0.5)] sm:dark:shadow-[6px_6px_0px_0px_rgba(230,57,70,0.5)] pointer-events-auto space-y-2 sm:space-y-4"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-950/40 text-brand-red flex items-center justify-center mx-auto border sm:border-2 border-brand-red rotate-[-2deg]">
                    <Sparkles size={18} className="sm:hidden" />
                    <Sparkles size={24} className="hidden sm:block" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-xl font-black uppercase text-brand-black dark:text-zinc-100 mb-0.5 sm:mb-1">
                      Your Wall is Empty
                    </h3>
                    <p className="text-[10px] min-[360px]:text-[11px] sm:text-xs text-gray-600 dark:text-zinc-300 leading-snug">
                      Select A6, A5, A4, or A3 in the controls below and click &ldquo;Add Poster&rdquo; to begin planning, or restore the default layout.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddPoster(activeSizeToAdd || 'A4')}
                      className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-brand-red text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:bg-brand-black transition-colors comic-border border border-black dark:border-zinc-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                      data-testid="empty-add-poster-btn"
                    >
                      Add {activeSizeToAdd || 'A4'} Poster
                    </button>
                    <button
                      type="button"
                      onClick={handleResetLayout}
                      className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors border border-gray-300 dark:border-zinc-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                      data-testid="empty-restore-layout-btn"
                    >
                      Restore Sample Layout
                    </button>
                  </div>
                </div>
              </div>
            )}

            </div>
          </div>

          {/* Floating Poster Size and Layout Toolbar Overlay */}
          {!isFullScreen && (() => {
            const wallWidth = containerRef.current?.clientWidth || (windowWidth >= 1280 ? 1280 : windowWidth - (windowWidth < 1024 ? 48 : 64));
            const wallHeight = containerRef.current?.clientHeight || Math.round(wallWidth * 9 / 16);
            const availableCredenzaHeight = wallHeight * (1 - USABLE_WALL_BOUNDS.maxY / 100);
            const panelBottomPx = Math.max(8, Math.min(16, Math.floor((availableCredenzaHeight - panelHeight) / 2)));

            return (
              <div
                ref={bottomPanelRef}
                className="hidden sm:block absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-2 border-brand-black dark:border-zinc-700 p-2.5 sm:px-5 sm:py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(230,57,70,0.4)] pointer-events-auto select-none"
                style={{
                  bottom: `${panelBottomPx}px`,
                  maxWidth: 'min(42rem, calc(100% - 290px))',
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
              <div className="flex flex-col gap-2 sm:gap-2.5">
                
                {/* Row 1 — Main Controls (Centered) */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mr-0.5">
                    Size:
                  </span>
                  
                  {/* Individual Selectable Size Cards (No shared group border/background) */}
                  <div 
                    className="flex items-center gap-1.5 sm:gap-2 shrink-0"
                    role="group"
                    aria-label="Poster Size Options"
                  >
                    {AVAILABLE_SIZES.map((size) => {
                      const isActive = activeSizeToAdd === size.id;
                      return (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => setActiveSizeToAdd(size.id)}
                          aria-pressed={isActive}
                          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 min-w-[58px] sm:min-w-[66px] flex flex-col items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
                            isActive
                              ? 'bg-brand-black dark:bg-brand-red text-white border-2 border-brand-black dark:border-brand-red shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(230,57,70,0.5)] translate-y-[-1px]'
                              : 'bg-white dark:bg-zinc-800 text-brand-black dark:text-zinc-200 border-2 border-neutral-300 dark:border-zinc-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.12)] hover:border-brand-black dark:hover:border-zinc-500 hover:bg-neutral-50 dark:hover:bg-zinc-700/80 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]'
                          }`}
                          title={`Select ${size.name} (${size.dimensionsInches})`}
                        >
                          <span className="font-display text-xs sm:text-sm font-black uppercase tracking-wider leading-none">
                            {size.name}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] font-mono leading-none mt-1 ${
                            isActive ? 'text-neutral-300 dark:text-white/90' : 'text-neutral-500 dark:text-zinc-400'
                          }`}>
                            {size.dimensionsInches}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddPoster()}
                    className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-brand-red hover:bg-brand-black text-white font-display text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-1.5 comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                  >
                    <Plus size={15} className="stroke-[3]" />
                    <span>Add {activeSizeToAdd}</span>
                  </button>

                  <div className="hidden sm:inline-block h-6 w-px bg-gray-300 dark:bg-zinc-700 mx-0.5 shrink-0"></div>

                  {/* Poster Count Badge */}
                  <div className="px-2.5 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-xs font-mono font-bold text-gray-700 dark:text-zinc-300 uppercase whitespace-nowrap shrink-0">
                    {posters.length} {posters.length === 1 ? 'Poster' : 'Posters'}
                  </div>

                  {/* Subtotal Pill */}
                  <div className="px-2.5 py-1.5 bg-red-50 dark:bg-zinc-800 border border-brand-red/30 dark:border-zinc-700 text-xs font-mono font-bold text-brand-red dark:text-brand-red uppercase whitespace-nowrap shrink-0">
                    Subtotal: {formatPosterKitPrice(invoiceSummary.subtotal)}
                  </div>
                </div>

                {/* Subtle hairline separator between Row 1 and Row 2 */}
                <div className="w-full h-px bg-gray-200 dark:bg-zinc-800"></div>

                {/* Row 2 — Context and Actions (Balanced & Vertically Aligned) */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 w-full min-w-0">
                  
                  {/* Left: Context area (Consistent position, swaps between Drag Helper and Selected Badge) */}
                  <div className="flex items-center min-w-0">
                    {selectedPoster ? (
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-red-50 dark:bg-red-950/30 border border-brand-red/40 px-2 sm:px-2.5 py-1 min-w-0">
                        <span className="text-xs font-bold text-brand-red uppercase whitespace-nowrap">
                          SELECTED: <span className="font-mono">{selectedPoster.sizeId}</span>
                        </span>
                        <span className="text-[10px] font-mono text-neutral-600 dark:text-zinc-300 hidden md:inline whitespace-nowrap">
                          • {getPosterDimensionsInches(selectedPoster.sizeId, selectedPoster.orientation)}
                        </span>

                        {/* Material Quick Switcher in Desktop Toolbar */}
                        <div className="flex items-center gap-1 border-l border-brand-red/30 pl-1.5 sm:pl-2 shrink-0">
                          <span className="text-[9px] font-mono uppercase font-bold text-neutral-500 dark:text-zinc-400">
                            Mat:
                          </span>
                          <div className="flex border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5">
                            {AVAILABLE_MATERIALS.map((mat) => {
                              const isMatActive = (selectedPoster.material || 'matte') === mat.id;
                              return (
                                <button
                                  key={mat.id}
                                  type="button"
                                  onClick={() => handleUpdatePosterMaterial(selectedPoster.id, mat.id)}
                                  className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                    isMatActive
                                      ? 'bg-brand-black dark:bg-brand-red text-white'
                                      : 'text-neutral-700 dark:text-zinc-300 hover:text-brand-red hover:bg-neutral-100 dark:hover:bg-zinc-800'
                                  }`}
                                  title={`${mat.name}: ${mat.description}`}
                                  aria-pressed={isMatActive}
                                  data-testid={`desktop-material-${mat.id}`}
                                >
                                  {mat.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenDesignPicker(selectedPoster.id)}
                          className="p-1 text-neutral-700 dark:text-zinc-300 hover:text-brand-red hover:bg-red-100 dark:hover:bg-red-950/50 rounded transition-colors flex items-center gap-1 text-xs font-bold uppercase shrink-0"
                          title={selectedPoster.artworkUrl ? 'Change Design' : 'Add Design'}
                          aria-label="Change poster design"
                        >
                          <ImageIcon size={13} />
                          <span className="hidden md:inline">{selectedPoster.artworkUrl ? 'Design' : 'Design'}</span>
                        </button>
                        {selectedPoster.artworkUrl && (
                          <button
                            type="button"
                            onClick={() => handleClearPosterDesign(selectedPoster.id)}
                            className="p-1 text-neutral-700 dark:text-zinc-300 hover:text-brand-red hover:bg-red-100 dark:hover:bg-red-950/50 rounded transition-colors flex items-center gap-1 text-xs font-bold uppercase shrink-0"
                            title="Clear design from poster (C)"
                            aria-label="Clear poster design"
                          >
                            <ImageOff size={13} />
                            <span className="hidden md:inline">Clear Art</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRotatePoster(selectedPoster.id)}
                          className="p-1 text-neutral-700 dark:text-zinc-300 hover:text-brand-red hover:bg-red-100 dark:hover:bg-red-950/50 rounded transition-colors flex items-center gap-1 text-xs font-bold uppercase shrink-0"
                          title={`Rotate ${selectedPoster.sizeId} (R)`}
                          aria-label="Rotate selected poster"
                        >
                          <RotateCw size={13} />
                          <span className="hidden md:inline whitespace-nowrap">Rotate Grid</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePoster(selectedPoster.id)}
                          className="p-1 text-brand-red hover:bg-brand-red hover:text-white rounded transition-colors flex items-center gap-1 text-xs font-bold uppercase shrink-0"
                          title="Remove selected poster (Delete / Backspace)"
                          aria-label="Remove selected poster"
                        >
                          <Trash2 size={13} />
                          <span className="hidden md:inline whitespace-nowrap">Delete Grid</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                        <Move size={13} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                        <span className="hidden sm:inline">Click & drag posters on the wall</span>
                        <span className="sm:hidden">Drag posters freely</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Reset & Clear actions placed together with consistent spacing */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={handleResetLayout}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition-colors shrink-0"
                      title="Reset to default 3-poster gallery layout"
                    >
                      <RotateCcw size={13} />
                      <span>Reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (posters.length <= 3) {
                          setIsMinLayoutModalOpen(true);
                        } else {
                          setIsClearModalOpen(true);
                        }
                      }}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-brand-red hover:border-brand-red flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                      title="Clear all posters from wall"
                    >
                      <Trash2 size={13} />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
            );
          })()}

          {/* Full-Screen Mode Dedicated Workspace Editing Toolbar */}
          {isFullScreen && (
            <div
              data-testid="fullscreen-editing-toolbar"
              className="w-full max-w-7xl z-50 shrink-0 mt-1 sm:mt-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-2 border-brand-black dark:border-zinc-700 shadow-[0_8px_32px_rgba(0,0,0,0.8)] p-2 sm:px-4 sm:py-2.5 max-h-[36vh] sm:max-h-none overflow-y-auto select-none pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2">
                {/* Row 1: Size Selector, Add Poster, Poster Count Badge, Reset & Clear */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 shrink-0">
                      Size:
                    </span>
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" role="group" aria-label="Poster Size Options">
                      {AVAILABLE_SIZES.map((size) => {
                        const isActive = activeSizeToAdd === size.id;
                        return (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => setActiveSizeToAdd(size.id)}
                            aria-pressed={isActive}
                            className={`px-2 sm:px-2.5 py-1 min-w-[50px] sm:min-w-[58px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                              isActive
                                ? 'bg-brand-black dark:bg-brand-red text-white border-2 border-brand-black dark:border-brand-red shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(230,57,70,0.5)]'
                                : 'bg-white dark:bg-zinc-800 text-brand-black dark:text-zinc-200 border border-neutral-300 dark:border-zinc-700 hover:border-brand-black dark:hover:border-zinc-500'
                            }`}
                            title={`Select ${size.name} (${size.dimensionsInches})`}
                          >
                            <span className="font-display text-xs sm:text-sm font-black uppercase tracking-wider leading-none">
                              {size.name}
                            </span>
                            <span
                              className={`text-[8px] sm:text-[9px] font-mono leading-none mt-0.5 ${
                                isActive ? 'text-neutral-300 dark:text-white/90' : 'text-neutral-500 dark:text-zinc-400'
                              }`}
                            >
                              {size.dimensionsInches}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddPoster()}
                      className="px-3 sm:px-3.5 py-1.5 bg-brand-red hover:bg-brand-black text-white font-display text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-1.5 comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] shrink-0 cursor-pointer"
                    >
                      <Plus size={14} className="stroke-[3]" />
                      <span>Add {activeSizeToAdd}</span>
                    </button>

                    <div className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-xs font-mono font-bold text-gray-700 dark:text-zinc-300 uppercase whitespace-nowrap shrink-0">
                      {posters.length} {posters.length === 1 ? 'Poster' : 'Posters'}
                    </div>

                    {!isFullScreen && (
                      <div className="px-2.5 py-1 bg-red-50 dark:bg-zinc-800 border border-brand-red/30 dark:border-zinc-700 text-xs font-mono font-bold text-brand-red dark:text-brand-red uppercase whitespace-nowrap shrink-0">
                        Subtotal: {formatPosterKitPrice(invoiceSummary.subtotal)}
                      </div>
                    )}
                  </div>

                  {/* Global Wall Actions: Reset Layout & Clear All */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={handleResetLayout}
                      className="px-2.5 sm:px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                      title="Reset to default 3-poster gallery layout"
                    >
                      <RotateCcw size={13} />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsClearModalOpen(true)}
                      disabled={posters.length === 0}
                      className="px-2.5 sm:px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-brand-red hover:border-brand-red disabled:opacity-40 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                      title="Clear all posters from wall"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Clear All</span>
                    </button>
                  </div>
                </div>

                {/* Hairline divider */}
                <div className="w-full h-px bg-gray-200 dark:bg-zinc-800"></div>

                {/* Row 2: Selected Poster Context, Material Selector & Poster Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 w-full min-w-0">
                  {selectedPoster ? (
                    <div className="flex flex-wrap items-center gap-2 w-full justify-between">
                      {/* Selected Details & Material */}
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 border border-brand-red/40 px-2 py-1 shrink-0">
                          <span className="text-xs font-bold text-brand-red uppercase whitespace-nowrap">
                            SELECTED: <span className="font-mono text-brand-black dark:text-zinc-100">{selectedPoster.sizeId}</span>
                          </span>
                          <span className="text-[10px] font-mono text-neutral-600 dark:text-zinc-300 hidden md:inline whitespace-nowrap">
                            • {getPosterDimensionsInches(selectedPoster.sizeId, selectedPoster.orientation)}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-neutral-200 dark:bg-zinc-700 text-neutral-700 dark:text-zinc-300 font-bold ml-1">
                            {selectedPoster.orientation}
                          </span>
                        </div>

                        {/* Material Selector */}
                        <div className="flex items-center gap-1 border-l border-gray-200 dark:border-zinc-700 pl-2 shrink-0">
                          <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 dark:text-zinc-400">
                            Material:
                          </span>
                          <div className="flex border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5">
                            {AVAILABLE_MATERIALS.map((mat) => {
                              const isMatActive = (selectedPoster.material || 'matte') === mat.id;
                              return (
                                <button
                                  key={mat.id}
                                  type="button"
                                  onClick={() => handleUpdatePosterMaterial(selectedPoster.id, mat.id)}
                                  className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                    isMatActive
                                      ? 'bg-brand-black dark:bg-brand-red text-white'
                                      : 'text-neutral-700 dark:text-zinc-300 hover:text-brand-red hover:bg-neutral-100 dark:hover:bg-zinc-800'
                                  }`}
                                  title={`${mat.name}: ${mat.description}`}
                                  aria-pressed={isMatActive}
                                  data-testid={`fullscreen-material-${mat.id}`}
                                >
                                  {mat.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Selected Poster Actions: Change Design, Clear Design, Rotate Poster, Delete */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0 ml-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDesignPicker(selectedPoster.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="px-2 py-1 bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border border-neutral-300 dark:border-zinc-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          title={selectedPoster.artworkUrl ? 'Change Design' : 'Add Design'}
                          aria-label="Change poster design"
                          data-testid="fullscreen-design-btn"
                        >
                          <ImageIcon size={13} className="text-brand-red shrink-0" />
                          <span>{selectedPoster.artworkUrl ? 'Change Design' : 'Add Design'}</span>
                        </button>

                        {selectedPoster.artworkUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearPosterDesign(selectedPoster.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="px-2 py-1 bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border border-neutral-300 dark:border-zinc-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            title="Clear design from poster"
                            aria-label="Clear poster design"
                            data-testid="fullscreen-clear-design-btn"
                          >
                            <ImageOff size={13} className="shrink-0" />
                            <span>Clear Design</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotatePoster(selectedPoster.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="px-2 py-1 bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border border-neutral-300 dark:border-zinc-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          title={`Rotate ${selectedPoster.sizeId} (R)`}
                          aria-label="Rotate selected poster"
                          data-testid="fullscreen-rotate-btn"
                        >
                          <RotateCw size={13} className="shrink-0" />
                          <span className="hidden md:inline whitespace-nowrap">Rotate Grid</span>
                          <span className="md:hidden whitespace-nowrap">Rotate</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePoster(selectedPoster.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="px-2 py-1 bg-red-100 dark:bg-red-950/50 hover:bg-brand-red text-brand-red hover:text-white border border-brand-red/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          title="Delete selected poster"
                          aria-label="Delete selected poster"
                          data-testid="fullscreen-delete-btn"
                        >
                          <Trash2 size={13} className="shrink-0" />
                          <span className="hidden md:inline whitespace-nowrap">Delete Grid</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 font-medium py-0.5">
                      <Move size={13} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                      <span>Click or drag any poster on the wall to edit size, material, or artwork</span>
                    </div>
                  )}
                </div>

                {/* Live Invoice-Style Price Summary (unmounted in full screen mode to maximize wall preview) */}
                {!isFullScreen && (
                  <>
                    <div className="w-full h-px bg-gray-200 dark:bg-zinc-800"></div>
                    <div className="w-full min-w-0">
                      <PosterKitPriceSummary
                        posters={posters}
                        variant="fullscreen"
                        collapsible={true}
                        defaultExpanded={true}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Toolbar Panel (Normal document flow immediately below wall) */}
        {!isFullScreen && (
          <div
            className="block sm:hidden mt-3 w-full bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(230,57,70,0.4)] select-none"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Row 1 — Size selection: Individual selectable cards */}
          <div 
            className="grid grid-cols-4 gap-1.5 min-[360px]:gap-2 w-full"
            role="group"
            aria-label="Poster Size Options"
          >
            {AVAILABLE_SIZES.map((size) => {
              const isActive = activeSizeToAdd === size.id;
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setActiveSizeToAdd(size.id)}
                  aria-pressed={isActive}
                  className={`py-1.5 px-0.5 min-[360px]:px-1 text-center transition-all flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
                    isActive
                      ? 'bg-brand-black dark:bg-brand-red text-white border-2 border-brand-black dark:border-brand-red shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(230,57,70,0.5)]'
                      : 'bg-white dark:bg-zinc-800 text-brand-black dark:text-zinc-200 border-2 border-neutral-300 dark:border-zinc-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] active:border-brand-black dark:active:border-zinc-500 active:bg-neutral-50'
                  }`}
                  title={`Select ${size.name} (${size.dimensionsInches})`}
                >
                  <span className="font-display font-black text-xs min-[360px]:text-sm uppercase tracking-wide leading-none">
                    {size.name}
                  </span>
                  <span className={`text-[8px] min-[360px]:text-[9px] min-[400px]:text-[9.5px] font-mono leading-none mt-1 truncate max-w-full ${
                    isActive ? 'text-neutral-300 dark:text-white/90' : 'text-neutral-500 dark:text-zinc-400'
                  }`}>
                    {size.dimensionsInches}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 2 — Add Poster */}
          <div className="flex items-center gap-2 w-full mt-2.5">
            <button
              type="button"
              onClick={() => handleAddPoster()}
              className="flex-1 py-2 px-3 bg-brand-red hover:bg-brand-black text-white font-display text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Plus size={16} className="stroke-[3]" />
              <span>Add {activeSizeToAdd} Poster</span>
            </button>

            <div className="px-2.5 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-xs font-mono font-bold text-gray-700 dark:text-zinc-300 uppercase whitespace-nowrap shrink-0 text-center">
              {posters.length} {posters.length === 1 ? 'Poster' : 'Posters'}
            </div>

            <div className="px-2.5 py-2 bg-red-50 dark:bg-zinc-800 border border-brand-red/30 dark:border-zinc-700 text-xs font-mono font-bold text-brand-red dark:text-brand-red uppercase whitespace-nowrap shrink-0 text-center">
              {formatPosterKitPrice(invoiceSummary.subtotal)}
            </div>
          </div>

          {/* Row 3 — Context */}
          <div className="w-full mt-2.5 p-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 text-xs">
            {selectedPoster ? (
              <div className="flex flex-wrap flex-col gap-2 w-full">
                {/* Header: Selected Poster Details */}
                <div className="flex items-center justify-between w-full pb-1.5 border-b border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-brand-red uppercase">
                      Selected: <span className="font-mono text-brand-black dark:text-zinc-100">{selectedPoster.sizeId}</span>
                    </span>
                    <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-mono">
                      ({getPosterDimensionsInches(selectedPoster.sizeId, selectedPoster.orientation)})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-neutral-200 dark:bg-zinc-700 text-neutral-700 dark:text-zinc-300 font-bold">
                    {selectedPoster.orientation}
                  </span>
                </div>

                {/* 2-Row Action Grid: Row 1 = Change / Clear Design, Row 2 = Rotate / Delete */}
                <div className="w-full space-y-1.5">
                  {/* Row 1: Change Design and Clear Design */}
                  <div className={`grid ${selectedPoster.artworkUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5 w-full`}>
                    <button
                      type="button"
                      onClick={() => handleOpenDesignPicker(selectedPoster.id)}
                      className="min-w-0 box-border w-full py-2 px-2 min-h-[38px] bg-white dark:bg-zinc-700 hover:bg-neutral-100 dark:hover:bg-zinc-600 text-neutral-800 dark:text-zinc-200 border border-neutral-300 dark:border-zinc-600 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center leading-tight whitespace-normal"
                      title={selectedPoster.artworkUrl ? 'Change Design' : 'Add Design'}
                      aria-label={`${selectedPoster.artworkUrl ? 'Change' : 'Add'} design for selected poster`}
                    >
                      <ImageIcon size={13} className="shrink-0" />
                      <span className="min-w-0">{selectedPoster.artworkUrl ? 'Change Design' : 'Add Design'}</span>
                    </button>
                    {selectedPoster.artworkUrl && (
                      <button
                        type="button"
                        onClick={() => handleClearPosterDesign(selectedPoster.id)}
                        className="min-w-0 box-border w-full py-2 px-2 min-h-[38px] bg-white dark:bg-zinc-700 hover:bg-neutral-100 dark:hover:bg-zinc-600 text-neutral-800 dark:text-zinc-200 border border-neutral-300 dark:border-zinc-600 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center leading-tight whitespace-normal"
                        title="Clear Design from poster (C)"
                        aria-label="Clear design from selected poster"
                      >
                        <ImageOff size={13} className="shrink-0" />
                        <span className="min-w-0">Clear Design</span>
                      </button>
                    )}
                  </div>

                  {/* Row 2: Rotate and Delete */}
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => handleRotatePoster(selectedPoster.id)}
                      className="min-w-0 box-border w-full py-2 px-2 min-h-[38px] bg-white dark:bg-zinc-700 hover:bg-neutral-100 dark:hover:bg-zinc-600 text-neutral-800 dark:text-zinc-200 border border-neutral-300 dark:border-zinc-600 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center leading-tight"
                      title="Rotate selected poster"
                      aria-label="Rotate selected poster"
                    >
                      <RotateCw size={13} className="shrink-0" />
                      <span>Rotate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePoster(selectedPoster.id)}
                      className="min-w-0 box-border w-full py-2 px-2 min-h-[38px] bg-red-100 dark:bg-red-950/50 hover:bg-brand-red text-brand-red hover:text-white border border-brand-red/40 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center leading-tight"
                      title="Delete selected poster"
                      aria-label="Remove selected poster"
                    >
                      <Trash2 size={13} className="shrink-0" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Material selector row for mobile */}
                <div className="w-full flex items-center justify-between gap-1.5 pt-2 mt-0.5 border-t border-gray-200 dark:border-zinc-700">
                  <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-zinc-400 shrink-0">
                    Material:
                  </span>
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    {AVAILABLE_MATERIALS.map((mat) => {
                      const isMatActive = (selectedPoster.material || 'matte') === mat.id;
                      return (
                        <button
                          key={mat.id}
                          type="button"
                          onClick={() => handleUpdatePosterMaterial(selectedPoster.id, mat.id)}
                          className={`py-1.5 px-1 text-center text-[9px] min-[360px]:text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            isMatActive
                              ? 'bg-brand-black dark:bg-brand-red text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-white dark:bg-zinc-800 text-neutral-700 dark:text-zinc-300 border border-neutral-300 dark:border-zinc-700 hover:bg-neutral-100 dark:hover:bg-zinc-700'
                          }`}
                          title={`${mat.name}: ${mat.description}`}
                          aria-pressed={isMatActive}
                          data-testid={`mobile-material-${mat.id}`}
                        >
                          {mat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            ) : (
              <div className="flex items-center justify-center gap-1.5 text-gray-500 dark:text-zinc-400 font-medium py-0.5">
                <Move size={13} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                <span>Drag to arrange</span>
              </div>
            )}
          </div>

          {/* Row 4 — Actions */}
          <div className="grid grid-cols-2 gap-2 w-full mt-2.5">
            <button
              type="button"
              onClick={handleResetLayout}
              className="py-2 px-3 text-xs font-bold uppercase tracking-wider border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-colors"
              title="Reset to default 3-poster gallery layout"
            >
              <RotateCcw size={13} />
              <span>Reset Layout</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              disabled={posters.length === 0}
              className="py-2 px-3 text-xs font-bold uppercase tracking-wider border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-brand-red hover:border-brand-red disabled:opacity-40 disabled:hover:text-gray-700 disabled:hover:border-gray-300 flex items-center justify-center gap-1.5 transition-colors"
              title="Clear all posters from wall"
            >
              <Trash2 size={13} />
              <span>Clear All</span>
            </button>
          </div>
        </div>
        )}

        {/* Live Invoice-Style Price Summary (Directly below size selection and Add Poster controls) */}
        {!isFullScreen && (
          <div className="mt-4 sm:mt-6 w-full">
            <PosterKitPriceSummary posters={posters} />
          </div>
        )}

      </div>

      {/* Confirmation Modal for Clear Layout */}
      {typeof document !== 'undefined' && isClearModalOpen && (() => {
        const portalNode = getPortalTarget();
        if (!portalNode) return null;
        return createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 p-6 sm:p-8 text-center space-y-6 comic-border shadow-[8px_8px_0px_0px_rgba(230,57,70,1)] text-brand-black dark:text-zinc-100"
              >
                <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 border-2 border-brand-red flex items-center justify-center mx-auto text-brand-red rotate-[-3deg]">
                  <AlertTriangle size={28} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-brand-black dark:text-zinc-100">
                    Clear Wall Layout?
                  </h3>
                  <p className="text-gray-500 dark:text-zinc-400 font-medium text-xs leading-relaxed">
                    Are you sure you want to remove all {posters.length} posters from the wall? You can restore the sample
                    arrangement at any time using the Reset button.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsClearModalOpen(false)}
                    className="py-3 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-brand-black dark:text-zinc-200 font-bold uppercase text-xs tracking-wider transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClear}
                    className="py-3 bg-brand-red hover:bg-brand-black text-white font-bold uppercase text-xs tracking-wider transition-colors comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                  >
                    Yes, Clear Wall
                  </button>
                </div>
              </motion.div>
            </div>
          </AnimatePresence>,
          portalNode
        );
      })()}

      {/* Notification Modal for Minimum Layout Requirement (At least 3 poster grids) */}
      {typeof document !== 'undefined' && isMinLayoutModalOpen && (() => {
        const portalNode = getPortalTarget();
        if (!portalNode) return null;
        return createPortal(
          <AnimatePresence>
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none pointer-events-auto"
              onClick={() => setIsMinLayoutModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="min-layout-heading"
                aria-describedby="min-layout-message"
                className="w-full max-w-md bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 p-6 sm:p-8 text-center space-y-6 comic-border shadow-[8px_8px_0px_0px_rgba(230,57,70,1)] text-brand-black dark:text-zinc-100 pointer-events-auto"
                data-testid="min-layout-modal"
              >
                <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 border-2 border-brand-red flex items-center justify-center mx-auto text-brand-red rotate-[-3deg]">
                  <AlertCircle size={28} />
                </div>

                <div className="space-y-2">
                  <h3 id="min-layout-heading" className="text-2xl font-black uppercase tracking-tight text-brand-black dark:text-zinc-100">
                    Minimum Layout Required
                  </h3>
                  <p id="min-layout-message" className="text-gray-500 dark:text-zinc-400 font-medium text-xs leading-relaxed">
                    Your Poster Kit must contain at least 3 poster grids. Add more posters or keep at least 3 grids in your layout.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsMinLayoutModalOpen(false)}
                    className="w-full py-3 bg-brand-red hover:bg-brand-black text-white font-bold uppercase text-xs tracking-wider transition-colors comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                    data-testid="min-layout-okay-btn"
                  >
                    Okay
                  </button>
                </div>
              </motion.div>
            </div>
          </AnimatePresence>,
          portalNode
        );
      })()}

      {/* Design Picker Modal for Collections Artwork & Custom Uploads */}
      <PosterDesignPickerModal
        isOpen={isDesignPickerOpen}
        targetPoster={posters.find((p) => p.id === designPickerTargetPosterId) || null}
        onClose={() => {
          setIsDesignPickerOpen(false);
          setDesignPickerTargetPosterId(null);
        }}
        onApplyArtwork={handleApplyArtwork}
        onRemoveArtwork={handleRemoveArtwork}
        onRequireAuth={() => {
          setIsDesignPickerOpen(false);
          setDesignPickerTargetPosterId(null);
          setIsGuestAuthPromptOpen(true);
        }}
        portalTarget={getPortalTarget()}
      />

      {/* Viewport-Level Guest Authentication Required Prompt Modal (Portal) - Bug 1 Fix */}
      {typeof document !== 'undefined' && isGuestAuthPromptOpen && (() => {
        const portalNode = getPortalTarget();
        if (!portalNode) return null;
        return createPortal(
          <AnimatePresence>
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none pointer-events-auto"
              onClick={() => setIsGuestAuthPromptOpen(false)}
              data-testid="guest-auth-prompt-backdrop"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="guest-auth-heading"
                aria-describedby="guest-auth-message"
                className="w-full max-w-md bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 p-6 sm:p-8 text-center space-y-6 comic-border shadow-[8px_8px_0px_0px_rgba(230,57,70,1)] text-brand-black dark:text-zinc-100 pointer-events-auto"
                data-testid="guest-auth-prompt-modal"
              >
                <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 border-2 border-brand-red flex items-center justify-center mx-auto text-brand-red rotate-[-3deg]">
                  <AlertCircle size={28} />
                </div>

                <div className="space-y-2">
                  <h3 id="guest-auth-heading" className="text-2xl font-black uppercase tracking-tight text-brand-black dark:text-zinc-100">
                    SIGN IN REQUIRED
                  </h3>
                  <p id="guest-auth-message" className="text-gray-500 dark:text-zinc-400 font-medium text-xs leading-relaxed">
                    Please sign in to upload and save your custom artwork to your Poster Kit.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsGuestAuthPromptOpen(false)}
                    className="w-full py-3 bg-brand-red hover:bg-brand-black text-white font-bold uppercase text-xs tracking-wider transition-colors comic-border border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                    data-testid="guest-auth-ok-btn"
                  >
                    OK
                  </button>
                </div>
              </motion.div>
            </div>
          </AnimatePresence>,
          portalNode
        );
      })()}

      {/* Viewport-Level Material Selection Modal (Portal) to prevent overflow:hidden clipping */}
      {typeof document !== 'undefined' && materialMenuOpenPosterId && (() => {
        const targetMaterialPoster = posters.find((p) => p.id === materialMenuOpenPosterId);
        if (!targetMaterialPoster) return null;
        const portalNode = getPortalTarget();
        if (!portalNode) return null;
        return createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none pointer-events-auto"
            onClick={() => setMaterialMenuOpenPosterId(null)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm sm:max-w-md bg-white dark:bg-zinc-900 border-2 border-brand-black dark:border-zinc-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(230,57,70,0.5)] p-4 text-left pointer-events-auto max-h-[85vh] flex flex-col"
              data-testid="material-dropdown-popover"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-neutral-200 dark:border-zinc-700 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-black text-sm uppercase tracking-wide text-brand-black dark:text-zinc-100">
                      Select Material Finish
                    </h4>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-neutral-100 dark:bg-zinc-800 text-brand-red font-bold border border-neutral-200 dark:border-zinc-700">
                      {targetMaterialPoster.sizeId} Grid
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-zinc-400 font-medium mt-0.5">
                    Each poster can have an independent material finish
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMaterialMenuOpenPosterId(null)}
                  className="p-1 text-neutral-500 hover:text-brand-red dark:hover:text-brand-red transition-colors cursor-pointer"
                  aria-label="Close material selector"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1 -mr-1 flex-1">
                {AVAILABLE_MATERIALS.map((mat) => {
                  const isCurrent = (targetMaterialPoster.material || 'matte') === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdatePosterMaterial(targetMaterialPoster.id, mat.id);
                        setMaterialMenuOpenPosterId(null);
                      }}
                      className={`w-full text-left p-3 transition-all flex items-start gap-3 border cursor-pointer ${
                        isCurrent
                          ? 'bg-brand-red text-white border-brand-red shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border-neutral-200 dark:border-zinc-700'
                      }`}
                      data-testid={`material-option-${mat.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-black text-sm uppercase tracking-wide">
                            {mat.name}
                          </span>
                          {isCurrent && <Check size={14} className="stroke-[3]" />}
                        </div>
                        <p
                          className={`text-xs leading-relaxed mt-1 ${
                            isCurrent ? 'text-white/90' : 'text-neutral-500 dark:text-zinc-400'
                          }`}
                        >
                          {mat.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

import type { PosterSizeConfig, PosterSizeId, PosterOrientation, WallBounds, PlacedPoster, RectBounds } from '../types/posterKit';

/**
 * Physical poster dimensions based on ISO 216 standards:
 * - A6: 105 mm × 148 mm (4.13" × 5.83")
 * - A5: 148 mm × 210 mm (5.83" × 8.27")
 * - A4: 210 mm × 297 mm (8.27" × 11.69")
 * - A3: 297 mm × 420 mm (11.69" × 16.54")
 * Note: A2 is strictly excluded per project requirements.
 */
export const POSTER_SIZES: Record<PosterSizeId, PosterSizeConfig> = {
  A6: {
    id: 'A6',
    name: 'A6',
    dimensionsInches: '4.13 × 5.83 in',
    dimensionsMm: '105 × 148 mm',
    widthMm: 105,
    heightMm: 148,
    aspectRatio: 105 / 148, // ~0.7095
  },
  A5: {
    id: 'A5',
    name: 'A5',
    dimensionsInches: '5.83 × 8.27 in',
    dimensionsMm: '148 × 210 mm',
    widthMm: 148,
    heightMm: 210,
    aspectRatio: 148 / 210, // ~0.7048
  },
  A4: {
    id: 'A4',
    name: 'A4',
    dimensionsInches: '8.27 × 11.69 in',
    dimensionsMm: '210 × 297 mm',
    widthMm: 210,
    heightMm: 297,
    aspectRatio: 210 / 297, // ~0.7071
  },
  A3: {
    id: 'A3',
    name: 'A3',
    dimensionsInches: '11.69 × 16.54 in',
    dimensionsMm: '297 × 420 mm',
    widthMm: 297,
    heightMm: 420,
    aspectRatio: 297 / 420, // ~0.7071
  },
};

export const AVAILABLE_SIZES: PosterSizeConfig[] = [
  POSTER_SIZES.A6,
  POSTER_SIZES.A5,
  POSTER_SIZES.A4,
  POSTER_SIZES.A3,
];

/**
 * Aspect ratio of the wall container (16:9).
 */
export const WALL_ASPECT_RATIO = 16 / 9;

/**
 * Base scale: A3 height occupies 29.5% of the total wall preview height.
 * All other sizes scale proportionally according to their real-world millimeter height:
 * - A3 height = 29.5%
 * - A4 height = 29.5% * (297 / 420) ≈ 20.86%
 * - A5 height = 29.5% * (210 / 420) = 14.75%
 */
export const BASE_A3_HEIGHT_PERCENT = 29.5;

/**
 * Usable wall area boundaries expressed in percentage coordinates (0-100%).
 * Keeps posters safely on the open plaster wall, above the credenza (~73%) and away from edges on desktop.
 */
export const USABLE_WALL_BOUNDS: WallBounds = {
  minX: 6,
  maxX: 94,
  minY: 6,
  maxY: 71,
};

/**
 * Usable wall area boundaries for mobile viewports (< 768px).
 * On mobile, the wall background image is zoomed ~1.38x centered at (50%, 42%),
 * which pushes the credenza down to ~84.8% and opens up plaster wall space down to 81.0%,
 * with reasonable margins (4.5%) from the wall container edges.
 */
export const MOBILE_USABLE_WALL_BOUNDS: WallBounds = {
  minX: 4.5,
  maxX: 95.5,
  minY: 4.5,
  maxY: 81.0,
};

/**
 * Returns the usable wall boundaries based on effective viewport width.
 * Mobile (< 768px) uses MOBILE_USABLE_WALL_BOUNDS to restore the full usable open plaster area.
 * Desktop/Tablet (>= 768px) preserves canonical USABLE_WALL_BOUNDS above the credenza (~73%).
 */
export function getUsableWallBounds(viewportWidth?: number): WallBounds {
  if (typeof viewportWidth === 'number' && viewportWidth < 768) {
    return MOBILE_USABLE_WALL_BOUNDS;
  }
  return USABLE_WALL_BOUNDS;
}


/**
 * Exact physical poster aspect ratio based on canonical ISO 216 standards:
 * - Portrait: width / height (< 1.0)
 * - Landscape: height / width (> 1.0, reciprocal inverse ratio)
 */
export function getPosterAspectRatio(
  sizeId: PosterSizeId,
  orientation: PosterOrientation = 'portrait'
): number {
  const config = POSTER_SIZES[sizeId];
  const isLandscape = orientation === 'landscape';
  const physWidthMm = isLandscape ? config.heightMm : config.widthMm;
  const physHeightMm = isLandscape ? config.widthMm : config.heightMm;
  return physWidthMm / physHeightMm;
}

/**
 * Calculate poster width and height percentages relative to the 16:9 container
 * ensuring 100% physically proportional scale and exact ISO aspect ratios for portrait or landscape.
 */
export function calculatePosterDimensions(
  sizeId: PosterSizeId,
  orientation: PosterOrientation = 'portrait'
): { widthPercent: number; heightPercent: number } {
  const config = POSTER_SIZES[sizeId];
  const isLandscape = orientation === 'landscape';

  const physHeightMm = isLandscape ? config.widthMm : config.heightMm;
  const physWidthMm = isLandscape ? config.heightMm : config.widthMm;

  // Height as percentage of wall preview height (container is 16:9)
  const heightPercent = BASE_A3_HEIGHT_PERCENT * (physHeightMm / 420);
  // Width in percentage of wall preview width:
  // (widthPercent / 100) * wallWidth = (heightPercent / 100) * wallHeight * (physWidthMm / physHeightMm)
  // widthPercent = (heightPercent / WALL_ASPECT_RATIO) * (physWidthMm / physHeightMm)
  const widthPercent = (heightPercent / WALL_ASPECT_RATIO) * (physWidthMm / physHeightMm);

  return {
    widthPercent: Number(widthPercent.toFixed(3)),
    heightPercent: Number(heightPercent.toFixed(3)),
  };
}

/**
 * Get dimensions in inches formatted for the given orientation.
 * E.g., A4 portrait: "8.27 × 11.69 in", A4 landscape: "11.69 × 8.27 in".
 */
export function getPosterDimensionsInches(
  sizeId: PosterSizeId,
  orientation: PosterOrientation = 'portrait'
): string {
  const config = POSTER_SIZES[sizeId];
  if (orientation === 'landscape') {
    const clean = config.dimensionsInches.replace(' in', '').trim();
    const parts = clean.split(' × ');
    return `${parts[1]} × ${parts[0]} in`;
  }
  return config.dimensionsInches;
}

/**
 * Get dimensions in millimeters formatted for the given orientation.
 * E.g., A4 portrait: "210 × 297 mm", A4 landscape: "297 × 210 mm".
 */
export function getPosterDimensionsMm(
  sizeId: PosterSizeId,
  orientation: PosterOrientation = 'portrait'
): string {
  const config = POSTER_SIZES[sizeId];
  if (orientation === 'landscape') {
    return `${config.heightMm} × ${config.widthMm} mm`;
  }
  return config.dimensionsMm;
}

/**
 * Toggles orientation between portrait and landscape.
 */
export function rotatePosterOrientation(orientation?: PosterOrientation): PosterOrientation {
  return orientation === 'landscape' ? 'portrait' : 'landscape';
}

/**
 * Adaptive scaling factor based on the number of placed posters.
 * Dynamically scales down poster presentation as the gallery wall fills up,
 * preventing crowding while keeping prints proportional, distinct, and usable.
 * - 1–3 posters: 1.0x (full viewport presentation scale)
 * - 4–5 posters: 0.92x (gentle reduction for comfortable spacing)
 * - 6–8 posters: 0.82x (moderate reduction as grid density grows)
 * - 9–12 posters: 0.70x (compact layout preservation)
 * - 13–15 posters: 0.60x
 * - 16+ posters: 0.55x (sensible floor preserving readability and tap targets)
 */
export function getPosterCountScaleFactor(posterCount?: number): number {
  if (typeof posterCount !== 'number' || posterCount <= 3) return 1.0;
  if (posterCount <= 5) return 0.92;
  if (posterCount <= 8) return 0.82;
  if (posterCount <= 12) return 0.70;
  if (posterCount <= 15) return 0.60;
  return 0.55;
}

/**
 * Returns the protected exclusion region (in wall percentage coordinates 0-100%)
 * for the Full Screen button in edit mode, with a comfortable padding buffer.
 * Posters are clamped/adjusted so they cannot enter or overlap this protected region.
 */
export function getFullScreenButtonProtectedRegion(
  viewportWidth?: number,
  containerWidth?: number,
  containerHeight?: number
): RectBounds {
  const isMobile = typeof viewportWidth === 'number' ? viewportWidth < 640 : false;

  const wallW = containerWidth || (typeof viewportWidth === 'number'
    ? Math.min(1280, viewportWidth - (viewportWidth < 640 ? 24 : viewportWidth < 1024 ? 48 : 64))
    : 1000);
  const wallH = containerHeight || Math.round((wallW * 9) / 16);

  // Exact button bounding box + margin at bottom-right corner
  // Mobile button: bottom 10px, right 10px, width ~80px, height ~24px -> protected region ~80px wide, ~34px tall from wall bottom
  // Desktop button: bottom 14px, right 14px, width ~112px, height ~34px -> protected region ~112px wide, ~48px tall from wall bottom
  const btnOffset = isMobile ? 10 : 14;
  const btnWidth = isMobile ? 80 : 112;
  const btnHeight = isMobile ? 24 : 34;

  const leftPercent = 100 - ((btnOffset + btnWidth) / wallW) * 100;
  const rightPercent = 100;
  const topPercent = 100 - ((btnOffset + btnHeight) / wallH) * 100;
  const bottomPercent = 100;

  return {
    left: Math.max(0, leftPercent),
    right: rightPercent,
    top: Math.max(0, topPercent),
    bottom: Math.min(100, bottomPercent),
  };
}

/**
 * Ensures a poster rectangle does not intersect with the protected region (e.g. Full Screen button).
 * If an intersection is detected, shifts the poster upward or leftward away from the bottom-right protected region
 * based on the minimal displacement required, while staying safely within usable wall bounds.
 */
export function avoidProtectedRegion(
  x: number,
  y: number,
  width: number,
  height: number,
  protectedRegion: RectBounds,
  bounds: WallBounds
): { x: number; y: number } {
  const posterRight = x + width;
  const posterBottom = y + height;

  const horizontalOverlap = posterRight > protectedRegion.left && x < protectedRegion.right;
  const verticalOverlap = posterBottom > protectedRegion.top && y < protectedRegion.bottom;

  if (horizontalOverlap && verticalOverlap) {
    const targetX = protectedRegion.left - width - 0.5;
    const targetY = protectedRegion.top - height - 0.5;

    const overlapX = posterRight - protectedRegion.left;
    const overlapY = posterBottom - protectedRegion.top;

    // Prefer the direction that requires the smaller displacement and stays within bounds
    const canShiftX = targetX >= bounds.minX;
    const canShiftY = targetY >= bounds.minY;

    if (canShiftX && canShiftY) {
      if (overlapY <= overlapX) {
        return { x, y: targetY };
      } else {
        return { x: targetX, y };
      }
    } else if (canShiftY) {
      return { x, y: targetY };
    } else if (canShiftX) {
      return { x: targetX, y };
    } else {
      return {
        x: Math.max(bounds.minX, targetX),
        y: Math.max(bounds.minY, targetY),
      };
    }
  }

  return { x, y };
}

/**
 * Clamps coordinates to ensure the entire poster rectangle stays inside the usable wall bounds,
 * and optionally keeps it outside a protected exclusion region (e.g. Full Screen button).
 */
export function clampPosterPosition(
  x: number,
  y: number,
  widthPercent: number,
  heightPercent: number,
  bounds: WallBounds = USABLE_WALL_BOUNDS,
  protectedRegion?: RectBounds
): { x: number; y: number } {
  const minX = bounds.minX;
  const maxX = Math.max(bounds.minX, bounds.maxX - widthPercent);
  const minY = bounds.minY;
  const maxY = Math.max(bounds.minY, bounds.maxY - heightPercent);

  let clampedX = Math.max(minX, Math.min(maxX, x));
  let clampedY = Math.max(minY, Math.min(maxY, y));

  if (protectedRegion) {
    const avoided = avoidProtectedRegion(clampedX, clampedY, widthPercent, heightPercent, protectedRegion, bounds);
    clampedX = Math.max(minX, Math.min(maxX, avoided.x));
    clampedY = Math.max(minY, Math.min(maxY, avoided.y));
  }

  return {
    x: clampedX,
    y: clampedY,
  };
}


/**
 * Calculate smart offset placement for adding multiple posters to avoid exact overlaps.
 */
export function getNextPosterPlacement(
  index: number,
  sizeId: PosterSizeId,
  bounds: WallBounds = USABLE_WALL_BOUNDS,
  orientation: PosterOrientation = 'portrait'
): { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number } {
  const { widthPercent, heightPercent } = calculatePosterDimensions(sizeId, orientation);

  // Staggered cascade algorithm
  const column = index % 5;
  const row = Math.floor(index / 5) % 3;

  const rawX = 26 + column * 7.5;
  const rawY = 16 + row * 8.5;

  const clamped = clampPosterPosition(rawX, rawY, widthPercent, heightPercent, bounds);

  return {
    xPercent: clamped.x,
    yPercent: clamped.y,
    widthPercent,
    heightPercent,
  };
}

/**
 * Initial curated gallery wall state showing 3 balanced posters (A4, A3, A5).
 */
export function getInitialPosters(): PlacedPoster[] {
  const a4Dims = calculatePosterDimensions('A4', 'portrait');
  const a3Dims = calculatePosterDimensions('A3', 'portrait');
  const a5Dims = calculatePosterDimensions('A5', 'portrait');

  return [
    {
      id: 'poster-initial-1',
      sizeId: 'A4',
      orientation: 'portrait',
      material: 'matte',
      xPercent: 27,
      yPercent: 23,
      widthPercent: a4Dims.widthPercent,
      heightPercent: a4Dims.heightPercent,
      label: 'Poster #1',
    },
    {
      id: 'poster-initial-2',
      sizeId: 'A3',
      orientation: 'portrait',
      material: 'matte',
      xPercent: 44,
      yPercent: 18,
      widthPercent: a3Dims.widthPercent,
      heightPercent: a3Dims.heightPercent,
      label: 'Poster #2',
    },
    {
      id: 'poster-initial-3',
      sizeId: 'A5',
      orientation: 'portrait',
      material: 'matte',
      xPercent: 65,
      yPercent: 26,
      widthPercent: a5Dims.widthPercent,
      heightPercent: a5Dims.heightPercent,
      label: 'Poster #3',
    },
  ];
}

/**
 * Normalizes a layout so that it always maintains at least 3 poster grids.
 * Preserves all valid poster details, positions, sizes, materials, and artwork.
 * If fewer than 3 grids exist, adds blank default grids up to 3.
 */
export function normalizeMinimumPosterLayout(currentPosters?: PlacedPoster[] | null): PlacedPoster[] {
  const defaults = getInitialPosters();
  if (!currentPosters || !Array.isArray(currentPosters) || currentPosters.length === 0) {
    return defaults;
  }
  if (currentPosters.length >= 3) {
    return currentPosters;
  }

  const result = [...currentPosters];
  const existingIds = new Set(result.map((p) => p.id));

  for (let i = 0; i < defaults.length && result.length < 3; i++) {
    const def = defaults[i];
    let newId = def.id;
    if (existingIds.has(newId)) {
      newId = `poster-default-${Date.now()}-${result.length + 1}`;
    }
    existingIds.add(newId);

    result.push({
      ...def,
      id: newId,
      label: `Poster #${result.length + 1}`,
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
    });
  }

  return result;
}

/**
 * Responsive poster presentation scaling configuration.
 * - Mobile viewports (< 768px): scaled ~1.62x–1.72x to match the mobile background zoom (~1.38x).
 * - Compact laptop viewports (1024px–1280px): scaled ~1.28x–1.32x (target range ~1.25x–1.35x).
 * - Typical laptop viewports (1281px–1536px, e.g. 1366px, 1440px): scaled ~1.38x–1.42x (target range ~1.35x–1.50x).
 * - Larger desktop viewports (>= 1537px, e.g. 1600px, 1920px+): scaled ~1.48x (target range ~1.45x–1.60x).
 * - Full-screen viewing mode: strictly 1.0x (canonical proportions preserved).
 */
export const MOBILE_POSTER_SCALE_FACTOR = 2.05;
export const DESKTOP_POSTER_SCALE_FACTOR = 1.42;

/**
 * Wall visual focus center for center-relative presentation scaling.
 * - Desktop/tablet center is tuned to (50%, 33%) to keep the arrangement centered in the open plaster wall area above the credenza.
 * - Mobile viewports (< 768px) use an optimized visual distribution (spreadX: 1.58, spreadY: 1.15, targetCenterY: 38)
 *   that enables large 1.92x–2.12x poster scaling while guaranteeing full boundary safety, clear separation between prints,
 *   and zero collision with the top-right Full Screen button.
 */
export const RESPONSIVE_WALL_ZOOM_CENTER = {
  x: 50,
  y: 33,
};
export const MOBILE_WALL_ZOOM_CENTER = {
  x: 48,
  y: 30,
};

/**
 * Returns the wall zoom center based on the effective viewport width.
 */
export function getResponsiveWallZoomCenter(viewportWidth?: number): { x: number; y: number } {
  if (typeof viewportWidth === 'number' && viewportWidth < 768) {
    return MOBILE_WALL_ZOOM_CENTER;
  }
  return RESPONSIVE_WALL_ZOOM_CENTER;
}

/**
 * Returns the responsive poster presentation scale factor based on viewport width and full-screen state.
 */
export function getResponsivePosterScale(
  viewportWidth?: number,
  isFullScreen: boolean = false,
  posterCount?: number
): number {
  const isMobile = typeof viewportWidth === 'number' && viewportWidth < 768;
  const countFactor = isMobile ? getPosterCountScaleFactor(posterCount) : 1.0;

  if (isFullScreen) {
    return Number(countFactor.toFixed(3));
  }

  let baseScale = DESKTOP_POSTER_SCALE_FACTOR;

  if (typeof viewportWidth === 'number') {
    // Mobile viewports (< 768px): target range 1.90x–2.15x tuned by viewport width
    if (viewportWidth <= 340) baseScale = 1.92; // 320px: 1.90x–1.95x
    else if (viewportWidth <= 370) baseScale = 2.02; // 360px: 2.00x–2.05x
    else if (viewportWidth <= 385) baseScale = 2.05; // 375px: 2.00x–2.08x
    else if (viewportWidth <= 410) baseScale = 2.08; // 390px: 2.05x–2.10x
    else if (viewportWidth < 768) baseScale = 2.12;  // 430px: 2.10x–2.15x

    // Tablet viewports (768px - 1023px)
    else if (viewportWidth < 1024) baseScale = 1.20;

    // Compact Laptop viewports (1024px - 1280px): target ~1.25x–1.35x
    else if (viewportWidth <= 1150) baseScale = 1.28;
    else if (viewportWidth <= 1280) baseScale = 1.32;

    // Typical Laptop viewports (1281px - 1536px, e.g. 1366px, 1440px): target ~1.35x–1.50x
    else if (viewportWidth <= 1390) baseScale = 1.38;
    else if (viewportWidth <= 1536) baseScale = 1.42;

    // Larger Desktop viewports (>= 1537px, e.g. 1600px, 1920px+): target ~1.45x–1.60x
    else baseScale = 1.48;
  }

  return Number((baseScale * countFactor).toFixed(3));
}

/**
 * Backwards-compatible alias for getResponsivePosterScale.
 */
export const getMobilePosterScale = getResponsivePosterScale;

/**
 * Derives responsive rendered dimensions and positions for a poster without modifying its stored canonical coordinates.
 * Supports mobile, tablet, laptop, and desktop viewports, preserving ISO aspect ratios, relative spacing,
 * and clamping within usable wall bounds.
 */
export function getResponsivePosterPlacement(
  poster: { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number },
  isMobileOrVp?: boolean | number,
  viewportWidthOrFullScreen?: number | boolean,
  isFullScreen: boolean | number = false,
  posterCount?: number
): { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number } {
  let effectiveVp: number | undefined;
  let effectiveFullScreen = false;
  let effectivePosterCount: number | undefined;

  if (typeof isMobileOrVp === 'number') {
    effectiveVp = isMobileOrVp;
    if (typeof viewportWidthOrFullScreen === 'boolean') {
      effectiveFullScreen = viewportWidthOrFullScreen;
      if (typeof isFullScreen === 'number') {
        effectivePosterCount = isFullScreen;
      } else if (typeof posterCount === 'number') {
        effectivePosterCount = posterCount;
      }
    } else {
      effectiveFullScreen = Boolean(isFullScreen);
      if (typeof posterCount === 'number') {
        effectivePosterCount = posterCount;
      }
    }
  } else if (typeof isMobileOrVp === 'boolean') {
    effectiveVp = typeof viewportWidthOrFullScreen === 'number' ? viewportWidthOrFullScreen : (isMobileOrVp ? 375 : undefined);
    effectiveFullScreen = typeof viewportWidthOrFullScreen === 'boolean' ? viewportWidthOrFullScreen : Boolean(isFullScreen);
    effectivePosterCount = typeof posterCount === 'number' ? posterCount : undefined;
    // If explicitly disabled (e.g. isMobile === false and no viewport width passed)
    if (!isMobileOrVp && typeof viewportWidthOrFullScreen !== 'number') {
      return {
        xPercent: poster.xPercent,
        yPercent: poster.yPercent,
        widthPercent: poster.widthPercent,
        heightPercent: poster.heightPercent,
      };
    }
  } else {
    effectiveVp = typeof viewportWidthOrFullScreen === 'number' ? viewportWidthOrFullScreen : undefined;
    effectiveFullScreen = typeof viewportWidthOrFullScreen === 'boolean' ? viewportWidthOrFullScreen : Boolean(isFullScreen);
    effectivePosterCount = typeof posterCount === 'number' ? posterCount : undefined;
  }

  const scale = getResponsivePosterScale(effectiveVp, effectiveFullScreen, effectivePosterCount);
  if (scale === 1.0) {
    return {
      xPercent: poster.xPercent,
      yPercent: poster.yPercent,
      widthPercent: poster.widthPercent,
      heightPercent: poster.heightPercent,
    };
  }

  const w = Number((poster.widthPercent * scale).toFixed(3));
  // Derive rendered height from rendered width and canonical aspect ratio to ensure uniform scaling
  const h = Number(((w * poster.heightPercent) / poster.widthPercent).toFixed(3));

  const cx = poster.xPercent + poster.widthPercent / 2;
  const cy = poster.yPercent + poster.heightPercent / 2;

  let scaledCx: number;
  let scaledCy: number;

  const countFactor = (effectiveVp && effectiveVp < 768)
    ? getPosterCountScaleFactor(effectivePosterCount)
    : 1.0;

  if (effectiveVp && effectiveVp < 768) {
    const effectiveSpreadX = countFactor < 1.0 ? 1.0 + (1.75 - 1.0) * countFactor : 1.75;
    const effectiveSpreadY = countFactor < 1.0 ? 1.0 + (1.15 - 1.0) * countFactor : 1.15;
    const targetCenterY = 38.0;
    scaledCx = 50 + (cx - 50) * effectiveSpreadX;
    scaledCy = targetCenterY + (cy - 33) * effectiveSpreadY;
  } else {
    scaledCx = RESPONSIVE_WALL_ZOOM_CENTER.x + (cx - RESPONSIVE_WALL_ZOOM_CENTER.x) * scale;
    scaledCy = RESPONSIVE_WALL_ZOOM_CENTER.y + (cy - RESPONSIVE_WALL_ZOOM_CENTER.y) * scale;
  }

  const rawX = scaledCx - w / 2;
  const rawY = scaledCy - h / 2;

  const wallBounds = getUsableWallBounds(effectiveVp);
  const protectedRegion = getFullScreenButtonProtectedRegion(effectiveVp);

  const clamped = clampPosterPosition(rawX, rawY, w, h, wallBounds, protectedRegion);

  return {
    xPercent: Number(clamped.x.toFixed(3)),
    yPercent: Number(clamped.y.toFixed(3)),
    widthPercent: w,
    heightPercent: h,
  };
}

/**
 * Converts responsive rendered coordinates back to canonical layout coordinates for persistence.
 * Guarantees zero pointer drift during dragging and eliminates coordinate distortion across viewports.
 */
export function toCanonicalPosterPlacement(
  rendered: { xPercent?: number; yPercent?: number; x?: number; y?: number },
  originalPoster: { widthPercent: number; heightPercent: number },
  isMobileOrVp?: boolean | number,
  viewportWidthOrFullScreen?: number | boolean,
  isFullScreen: boolean | number = false,
  posterCount?: number
): { xPercent: number; yPercent: number } {
  const renderedX = rendered.xPercent ?? rendered.x ?? 0;
  const renderedY = rendered.yPercent ?? rendered.y ?? 0;

  let effectiveVp: number | undefined;
  let effectiveFullScreen = false;
  let effectivePosterCount: number | undefined;

  if (typeof isMobileOrVp === 'number') {
    effectiveVp = isMobileOrVp;
    if (typeof viewportWidthOrFullScreen === 'boolean') {
      effectiveFullScreen = viewportWidthOrFullScreen;
      if (typeof isFullScreen === 'number') {
        effectivePosterCount = isFullScreen;
      } else if (typeof posterCount === 'number') {
        effectivePosterCount = posterCount;
      }
    } else {
      effectiveFullScreen = Boolean(isFullScreen);
      if (typeof posterCount === 'number') {
        effectivePosterCount = posterCount;
      }
    }
  } else if (typeof isMobileOrVp === 'boolean') {
    effectiveVp = typeof viewportWidthOrFullScreen === 'number' ? viewportWidthOrFullScreen : (isMobileOrVp ? 375 : undefined);
    effectiveFullScreen = typeof viewportWidthOrFullScreen === 'boolean' ? viewportWidthOrFullScreen : Boolean(isFullScreen);
    effectivePosterCount = typeof posterCount === 'number' ? posterCount : undefined;
    if (!isMobileOrVp && typeof viewportWidthOrFullScreen !== 'number') {
      const wallBounds = getUsableWallBounds(effectiveVp);
      const clamped = clampPosterPosition(
        renderedX,
        renderedY,
        originalPoster.widthPercent,
        originalPoster.heightPercent,
        wallBounds
      );
      return {
        xPercent: Number(clamped.x.toFixed(3)),
        yPercent: Number(clamped.y.toFixed(3)),
      };
    }
  } else {
    effectiveVp = typeof viewportWidthOrFullScreen === 'number' ? viewportWidthOrFullScreen : undefined;
    effectiveFullScreen = typeof viewportWidthOrFullScreen === 'boolean' ? viewportWidthOrFullScreen : Boolean(isFullScreen);
    effectivePosterCount = typeof posterCount === 'number' ? posterCount : undefined;
  }

  const wallBounds = getUsableWallBounds(effectiveVp);
  const scale = getResponsivePosterScale(effectiveVp, effectiveFullScreen, effectivePosterCount);
  if (scale === 1.0) {
    const clamped = clampPosterPosition(
      renderedX,
      renderedY,
      originalPoster.widthPercent,
      originalPoster.heightPercent,
      wallBounds
    );
    return {
      xPercent: Number(clamped.x.toFixed(3)),
      yPercent: Number(clamped.y.toFixed(3)),
    };
  }

  const renderedW = originalPoster.widthPercent * scale;
  const renderedH = originalPoster.heightPercent * scale;

  const renderedCx = renderedX + renderedW / 2;
  const renderedCy = renderedY + renderedH / 2;

  let canonicalCx: number;
  let canonicalCy: number;

  const countFactor = (effectiveVp && effectiveVp < 768)
    ? getPosterCountScaleFactor(effectivePosterCount)
    : 1.0;

  if (effectiveVp && effectiveVp < 768) {
    const effectiveSpreadX = countFactor < 1.0 ? 1.0 + (1.75 - 1.0) * countFactor : 1.75;
    const effectiveSpreadY = countFactor < 1.0 ? 1.0 + (1.15 - 1.0) * countFactor : 1.15;
    const targetCenterY = 38.0;
    canonicalCx = 50 + (renderedCx - 50) / effectiveSpreadX;
    canonicalCy = 33 + (renderedCy - targetCenterY) / effectiveSpreadY;
  } else {
    canonicalCx = RESPONSIVE_WALL_ZOOM_CENTER.x + (renderedCx - RESPONSIVE_WALL_ZOOM_CENTER.x) / scale;
    canonicalCy = RESPONSIVE_WALL_ZOOM_CENTER.y + (renderedCy - RESPONSIVE_WALL_ZOOM_CENTER.y) / scale;
  }

  const rawX = canonicalCx - originalPoster.widthPercent / 2;
  const rawY = canonicalCy - originalPoster.heightPercent / 2;

  const clamped = clampPosterPosition(
    rawX,
    rawY,
    originalPoster.widthPercent,
    originalPoster.heightPercent,
    wallBounds
  );

  return {
    xPercent: Number(clamped.x.toFixed(3)),
    yPercent: Number(clamped.y.toFixed(3)),
  };
}





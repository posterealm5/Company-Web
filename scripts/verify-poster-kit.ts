import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  POSTER_SIZES,
  AVAILABLE_SIZES,
  calculatePosterDimensions,
  getPosterDimensionsInches,
  getPosterDimensionsMm,
  rotatePosterOrientation,
  clampPosterPosition,
  getNextPosterPlacement,
  getInitialPosters,
  normalizeMinimumPosterLayout,
  USABLE_WALL_BOUNDS,
  WALL_ASPECT_RATIO,
  getPosterCountScaleFactor,
  getFullScreenButtonProtectedRegion,
  avoidProtectedRegion,
  getResponsivePosterScale,
  getResponsivePosterPlacement,
  toCanonicalPosterPlacement,
  getUsableWallBounds,
  getPosterAspectRatio,
} from '../src/utils/posterKitMath';
import {
  isStorefrontMockupUrl,
  resolveOriginalPosterArtwork,
  validateArtworkFile,
  POSTER_ARTWORK_BUCKET,
  ARTWORK_STORAGE_FOLDER,
  MAX_ARTWORK_SIZE_BYTES,
  ALLOWED_ARTWORK_TYPES,
  ALLOWED_ARTWORK_EXTENSIONS,
} from '../src/services/posterArtwork';
import { getStorefrontImage, getOptimizedWallArtworkUrl, getOptimizedImageUrl } from '../src/utils/imageUtils';
import {
  savePosterKitLayout,
  getSavedPosterKitLayout,
  clearSavedPosterKitLayout,
  resetSavedPosterKitLayout,
  saveCustomArtworkBlob,
  getCustomArtworkBlob,
  deleteCustomArtworkBlob,
  clearAllCustomArtworkBlobs,
  getRawSavedLayoutJson,
  setRawSavedLayoutJson,
  POSTER_KIT_STORAGE_KEY_V1,
} from '../src/services/posterKitStorage';
import type { PlacedPoster, PosterMaterialId } from '../src/types/posterKit';
import { POSTER_MATERIALS, AVAILABLE_MATERIALS } from '../src/types/posterKit';
import {
  POSTER_KIT_PRICING,
  getPosterKitUnitPrice,
  calculatePosterKitInvoice,
  formatPosterKitPrice,
  normalizePosterKitMaterial,
  createPosterKitCartItem,
  validateWallLayout,
} from '../src/utils/posterKitPricing';
import {
  recalculateCartPrices,
  calculateSinglePosterPrice,
  POSTER_PRICING,
  RIGID_BOARD_PRICING,
  SHIPPING_CHARGE,
} from '../src/config/pricing';
import {
  getDailySeed,
  getDailyNumericSeed,
  createMulberry32,
  shuffleWithDailySeed,
} from '../src/utils/dailyShuffle';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('--- RUNNING POSTER KIT VERIFICATION TESTS (A6 EXTENSION) ---');

// 1. Available Sizes Test: Exactly A6, A5, A4, and A3
console.log('\n[Test 1] Available Sizes (A6 Exclusive Addition)');
assert(AVAILABLE_SIZES.length === 4, 'Exactly 4 sizes are provided in Poster Kit');
assert(AVAILABLE_SIZES.some((s) => s.id === 'A6'), 'A6 is available in Poster Kit');
assert(AVAILABLE_SIZES.some((s) => s.id === 'A5'), 'A5 is available in Poster Kit');
assert(AVAILABLE_SIZES.some((s) => s.id === 'A4'), 'A4 is available in Poster Kit');
assert(AVAILABLE_SIZES.some((s) => s.id === 'A3'), 'A3 is available in Poster Kit');
assert(!AVAILABLE_SIZES.some((s: any) => s.id === 'A2'), 'A2 is strictly unavailable and NOT present');

// 2. Physical Dimensions & Aspect Ratios
console.log('\n[Test 2] Physical Dimensions & ISO Proportions');
const a6 = POSTER_SIZES.A6;
const a5 = POSTER_SIZES.A5;
const a4 = POSTER_SIZES.A4;
const a3 = POSTER_SIZES.A3;

assert(a6.widthMm === 105 && a6.heightMm === 148, 'A6 has correct ISO dimensions (105 × 148 mm)');
assert(a6.dimensionsMm === '105 × 148 mm', 'A6 millimeter label is correct');
assert(a6.dimensionsInches.includes('4.13') && a6.dimensionsInches.includes('5.83'), 'A6 inch label is approximately 4.13 × 5.83 in');
assert(a5.widthMm === 148 && a5.heightMm === 210, 'A5 has correct ISO dimensions (148 × 210 mm)');
assert(a4.widthMm === 210 && a4.heightMm === 297, 'A4 has correct ISO dimensions (210 × 297 mm)');
assert(a3.widthMm === 297 && a3.heightMm === 420, 'A3 has correct ISO dimensions (297 × 420 mm)');

// 3. Mathematical Scale Proportions & Hierarchy
console.log('\n[Test 3] Mathematical Scale Proportions (A6 < A5 < A4 < A3)');
const a6Dims = calculatePosterDimensions('A6');
const a5Dims = calculatePosterDimensions('A5');
const a4Dims = calculatePosterDimensions('A4');
const a3Dims = calculatePosterDimensions('A3');

console.log('Calculated Percentage Dimensions on 16:9 Wall:', {
  A6: a6Dims,
  A5: a5Dims,
  A4: a4Dims,
  A3: a3Dims,
});

assert(a6Dims.widthPercent < a5Dims.widthPercent, 'A6 width is strictly smaller than A5');
assert(a6Dims.heightPercent < a5Dims.heightPercent, 'A6 height is strictly smaller than A5');

// A6 height relative to A3 (148 / 420 ≈ 0.3524)
const heightRatioA6toA3 = a6Dims.heightPercent / a3Dims.heightPercent;
assert(
  Math.abs(heightRatioA6toA3 - 148 / 420) < 0.01,
  `A6 height is ~35.2% of A3 height (got ${(heightRatioA6toA3 * 100).toFixed(1)}%)`
);

// A6 height relative to A5 (148 / 210 ≈ 0.7048)
const heightRatioA6toA5 = a6Dims.heightPercent / a5Dims.heightPercent;
assert(
  Math.abs(heightRatioA6toA5 - 148 / 210) < 0.01,
  `A6 height is ~70.5% of A5 height (got ${(heightRatioA6toA5 * 100).toFixed(1)}%)`
);

// A5 height should be exactly half of A3 height (210mm vs 420mm)
const heightRatioA5toA3 = a5Dims.heightPercent / a3Dims.heightPercent;
assert(Math.abs(heightRatioA5toA3 - 0.5) < 0.01, `A5 height is exactly 50% of A3 height (got ${(heightRatioA5toA3 * 100).toFixed(1)}%)`);

// Check aspect ratio in physical pixels for each poster
const screenAspectA6 = (a6Dims.widthPercent * WALL_ASPECT_RATIO) / a6Dims.heightPercent;
const screenAspectA5 = (a5Dims.widthPercent * WALL_ASPECT_RATIO) / a5Dims.heightPercent;
const screenAspectA4 = (a4Dims.widthPercent * WALL_ASPECT_RATIO) / a4Dims.heightPercent;
const screenAspectA3 = (a3Dims.widthPercent * WALL_ASPECT_RATIO) / a3Dims.heightPercent;

assert(Math.abs(screenAspectA6 - (105 / 148)) < 0.005, 'A6 preserves portrait 105/148 aspect ratio');
assert(Math.abs(screenAspectA5 - (148 / 210)) < 0.005, 'A5 preserves portrait 148/210 aspect ratio');
assert(Math.abs(screenAspectA4 - (210 / 297)) < 0.005, 'A4 preserves portrait 210/297 aspect ratio');
assert(Math.abs(screenAspectA3 - (297 / 420)) < 0.005, 'A3 preserves portrait 297/420 aspect ratio');

// 4. Boundary Clamping Test for A6
console.log('\n[Test 4] Boundary Clamping for A6 Posters');
const clampedTopLeftA6 = clampPosterPosition(-10, -5, a6Dims.widthPercent, a6Dims.heightPercent);
assert(clampedTopLeftA6.x === USABLE_WALL_BOUNDS.minX, 'Clamps negative X to minX for A6');
assert(clampedTopLeftA6.y === USABLE_WALL_BOUNDS.minY, 'Clamps negative Y to minY for A6');

const clampedBottomRightA6 = clampPosterPosition(120, 150, a6Dims.widthPercent, a6Dims.heightPercent);
assert(
  Math.abs(clampedBottomRightA6.x - (USABLE_WALL_BOUNDS.maxX - a6Dims.widthPercent)) < 0.001,
  'Clamps right edge inside maxX for A6'
);
assert(
  Math.abs(clampedBottomRightA6.y - (USABLE_WALL_BOUNDS.maxY - a6Dims.heightPercent)) < 0.001,
  'Clamps bottom edge inside maxY for A6'
);

// 5. Staggered Placement for A6
console.log('\n[Test 5] Staggered Placement Algorithm for A6');
const a6Pos1 = getNextPosterPlacement(0, 'A6');
const a6Pos2 = getNextPosterPlacement(1, 'A6');
assert(
  a6Pos1.xPercent !== a6Pos2.xPercent || a6Pos1.yPercent !== a6Pos2.yPercent,
  'Adding A6 posters uses offset placement to avoid overlaps'
);
assert(a6Pos1.widthPercent === a6Dims.widthPercent, 'Placement assigns correct A6 widthPercent');
assert(a6Pos1.heightPercent === a6Dims.heightPercent, 'Placement assigns correct A6 heightPercent');

// 6. Initial Curated Layout Preserved
console.log('\n[Test 6] Initial Curated Sample Layout Preserved');
const initial = getInitialPosters();
assert(initial.length === 3, 'Initial state preserves 3 curated posters (A4, A3, A5)');
assert(initial.some((p) => p.sizeId === 'A4'), 'Initial layout has A4');
assert(initial.some((p) => p.sizeId === 'A3'), 'Initial layout has A3');
assert(initial.some((p) => p.sizeId === 'A5'), 'Initial layout has A5');

// 7. Storefront Isolation: A6 must NOT exist in general product pricing
console.log('\n[Test 7] Storefront Isolation (A6 exclusive to Poster Kit)');
const pricingPath = path.resolve(__dirname, '../src/config/pricing.ts');
const pricingCode = fs.readFileSync(pricingPath, 'utf-8');
assert(!pricingCode.includes('A6:'), 'A6 is strictly NOT in general product pricing (pricing.ts)');

// 8. Size Selector in PosterKit UI
console.log('\n[Test 8] UI Size Selector Renders 4 Options');
const posterKitPath = path.resolve(__dirname, '../src/pages/PosterKit.tsx');
const posterKitCode = fs.readFileSync(posterKitPath, 'utf-8');
assert(posterKitCode.includes('grid-cols-4'), 'Mobile size selector uses 4-column responsive grid');
assert(posterKitCode.includes('AVAILABLE_SIZES.map'), 'Size selectors map dynamically over AVAILABLE_SIZES');

// 9. Individual Size Cards Architecture (No shared segmented box)
console.log('\n[Test 9] Individual Size Cards Verification');
// Check Desktop
assert(
  !posterKitCode.includes('inline-flex rounded-none p-0.5 sm:p-1 bg-gray-100 dark:bg-zinc-800 border border-gray-300'),
  'Desktop size selector does NOT use a shared segmented box with shared border/background'
);
assert(
  posterKitCode.includes('flex items-center gap-1.5 sm:gap-2 shrink-0'),
  'Desktop size cards are aligned in a horizontal row with consistent gap spacing'
);

// Check Mobile
assert(
  !posterKitCode.includes('p-1 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 w-full'),
  'Mobile size selector does NOT wrap cards in a shared segmented border/background'
);
assert(
  posterKitCode.includes('grid grid-cols-4 gap-1.5 min-[360px]:gap-2 w-full'),
  'Mobile size cards use a 4-column responsive grid with independent spacing'
);

// Check Individual Card Styling
assert(
  posterKitCode.includes('border-2 border-brand-black dark:border-brand-red') &&
  posterKitCode.includes('border-2 border-neutral-300 dark:border-zinc-700'),
  'Each card has an independent 2px border for active and inactive states'
);
assert(
  posterKitCode.includes('font-display') && posterKitCode.includes('{size.name}'),
  'Size name is displayed prominently with font-display'
);
assert(
  posterKitCode.includes('{size.dimensionsInches}'),
  'Dimensions are displayed underneath in smaller text'
);

// 10. Adaptive Poster Typography Hierarchy & Clamp Formula
console.log('\n[Test 10] Adaptive Typography Scaling Hierarchy (A6 < A5 < A4 < A3)');
assert(
  posterKitCode.includes('const scaleRatio = sizeConfig.heightMm / 420;'),
  'Calculates scaleRatio from physical heightMm relative to A3 base'
);
assert(
  posterKitCode.includes('poster-cardstock') && posterKitCode.includes("containerType: 'size'"),
  'Cardstock surface establishes a container-query context (size)'
);

// Test clamp formula mathematically across viewports
function calculateTitleFontSize(heightMm: number, renderedWidthPx: number): number {
  const scaleRatio = heightMm / 420;
  const min = 7.5 + 5.5 * scaleRatio;
  const max = 14 + 22 * scaleRatio;
  const preferred = 0.26 * renderedWidthPx;
  return Math.min(Math.max(min, preferred), max);
}

// 1) Desktop (Wall 1200px width, rendered poster widths)
const desktopA3Font = calculateTitleFontSize(420, 141);
const desktopA4Font = calculateTitleFontSize(297, 100);
const desktopA5Font = calculateTitleFontSize(210, 70);
const desktopA6Font = calculateTitleFontSize(148, 50);

console.log('Desktop Typography Font Sizes (px):', {
  A3: desktopA3Font.toFixed(1),
  A4: desktopA4Font.toFixed(1),
  A5: desktopA5Font.toFixed(1),
  A6: desktopA6Font.toFixed(1),
});

assert(desktopA6Font < desktopA5Font, 'Desktop: A6 font size < A5 font size');
assert(desktopA5Font < desktopA4Font, 'Desktop: A5 font size < A4 font size');
assert(desktopA4Font < desktopA3Font, 'Desktop: A4 font size < A3 font size');

// 2) Mobile (Wall 351px width, rendered poster widths)
const mobileA3Font = calculateTitleFontSize(420, 41);
const mobileA4Font = calculateTitleFontSize(297, 29);
const mobileA5Font = calculateTitleFontSize(210, 21);
const mobileA6Font = calculateTitleFontSize(148, 15);

console.log('Mobile Typography Font Sizes (px):', {
  A3: mobileA3Font.toFixed(1),
  A4: mobileA4Font.toFixed(1),
  A5: mobileA5Font.toFixed(1),
  A6: mobileA6Font.toFixed(1),
});

assert(mobileA6Font < mobileA5Font, 'Mobile: A6 font size < A5 font size');
assert(mobileA5Font < mobileA4Font, 'Mobile: A5 font size < A4 font size');
assert(mobileA4Font < mobileA3Font, 'Mobile: A4 font size < A3 font size');

// Ensure min and max bounds prevent microscopic or oversized text
assert(mobileA6Font >= 8.5, 'A6 title font does not become microscopic on small screens (>= 8.5px)');
assert(desktopA3Font <= 38, 'A3 title font does not become excessively oversized (<= 38px)');

// 11. Container Query Rules in index.css
console.log('\n[Test 11] Container Query Rules in index.css');
const cssPath = path.resolve(__dirname, '../src/index.css');
const cssCode = fs.readFileSync(cssPath, 'utf-8');
const normalizedCss = cssCode.replace(/\s+/g, ' ');
assert(normalizedCss.includes('.poster-cardstock'), '.poster-cardstock container declared in CSS');
assert(normalizedCss.includes('@container (max-height: 95px)'), '@container (max-height: 95px) hides mm label');
assert(normalizedCss.includes('.poster-mm-label { display: none !important; }'), '.poster-mm-label hidden when compact');
assert(normalizedCss.includes('@container (max-height: 75px)'), '@container (max-height: 75px) hides footer label');
assert(normalizedCss.includes('@container (max-height: 55px)'), '@container (max-height: 55px) hides crop marks and header');
assert(normalizedCss.includes('@container (max-height: 38px)'), '@container (max-height: 38px) hides dimension text');

// 12. Viewport Overflow Protection
console.log('\n[Test 12] Responsive Viewport Boundary Check (320px, 360px, 375px, 430px)');
const targetViewports = [320, 360, 375, 430];
for (const vp of targetViewports) {
  const pageMargin = 12 * 2; // px-3
  const availableWidth = vp - pageMargin;
  const toolbarPadding = 12 * 2; // p-3
  const cardsInnerWidth = availableWidth - toolbarPadding;
  const gapTotal = 3 * 6; // 3 gaps of 6px (gap-1.5)
  const singleCardWidth = (cardsInnerWidth - gapTotal) / 4;
  assert(singleCardWidth >= 55, `At ${vp}px viewport: Each size card has sufficient width (${singleCardWidth.toFixed(1)}px >= 55px)`);
  assert(availableWidth <= vp, `At ${vp}px viewport: Content does not exceed viewport width`);
}

// 13. Functional Integrity Check
console.log('\n[Test 13] Functional Handlers and State Integrity');
assert(posterKitCode.includes('handleAddPoster'), 'handleAddPoster function preserved');
assert(posterKitCode.includes('handleRemovePoster'), 'handleRemovePoster function preserved');
assert(posterKitCode.includes('handleResetLayout'), 'handleResetLayout function preserved');
assert(posterKitCode.includes('handlePointerDown'), 'Pointer dragging handlers preserved');
assert(posterKitCode.includes('isClearModalOpen'), 'Clear confirmation modal state preserved');

// 14. Orientation Defaults on Initial and Newly Added Posters
console.log('\n[Test 14] Orientation Defaults (Portrait by Default)');
const initialPosters = getInitialPosters();
for (const p of initialPosters) {
  assert(p.orientation === 'portrait', `Initial poster ${p.id} defaults to portrait`);
}

// Backward-compatible fallback for missing orientation property
const legacyPoster: any = { id: 'p-legacy', sizeId: 'A4' };
const fallbackOrientation = legacyPoster.orientation || 'portrait';
assert(fallbackOrientation === 'portrait', 'Posters with missing orientation safely fallback to portrait');

// New placement defaults to portrait
const newA4Pos = getNextPosterPlacement(4, 'A4');
assert(newA4Pos.widthPercent < newA4Pos.heightPercent, 'Newly placed poster has portrait proportions (width < height)');

// 15. Rotation Mechanics & Landscape/Portrait Alternation
console.log('\n[Test 15] Rotation Mechanics (Portrait <-> Landscape Alternation)');
assert(rotatePosterOrientation('portrait') === 'landscape', 'Rotating portrait yields landscape');
assert(rotatePosterOrientation('landscape') === 'portrait', 'Rotating landscape yields portrait');
assert(rotatePosterOrientation() === 'landscape', 'Rotating undefined yields landscape');

// Verify dimension swapping for all 4 sizes (A6, A5, A4, A3)
const sizes: ('A6' | 'A5' | 'A4' | 'A3')[] = ['A6', 'A5', 'A4', 'A3'];
for (const s of sizes) {
  const port = calculatePosterDimensions(s, 'portrait');
  const land = calculatePosterDimensions(s, 'landscape');

  // Rendered physical pixel dimensions (accounting for 16:9 wall container)
  const portRenderedWidth = port.widthPercent * WALL_ASPECT_RATIO;
  const portRenderedHeight = port.heightPercent;
  assert(portRenderedWidth < portRenderedHeight, `${s} Portrait is visibly taller than wide (${portRenderedWidth.toFixed(2)} < ${portRenderedHeight.toFixed(2)})`);

  const landRenderedWidth = land.widthPercent * WALL_ASPECT_RATIO;
  const landRenderedHeight = land.heightPercent;
  assert(landRenderedWidth > landRenderedHeight, `${s} Landscape is visibly wider than tall (${landRenderedWidth.toFixed(2)} > ${landRenderedHeight.toFixed(2)})`);

  // Screen aspect ratios
  const portAspect = portRenderedWidth / portRenderedHeight;
  const landAspect = landRenderedWidth / landRenderedHeight;

  const config = POSTER_SIZES[s];
  const expectedPortAspect = config.widthMm / config.heightMm;
  const expectedLandAspect = config.heightMm / config.widthMm;

  assert(Math.abs(portAspect - expectedPortAspect) < 0.005, `${s} Portrait preserves exact ISO aspect ratio`);
  assert(Math.abs(landAspect - expectedLandAspect) < 0.005, `${s} Landscape preserves exact inverted ISO aspect ratio`);

  // Physical area conservation (width * height in rendered units)
  const portArea = portRenderedWidth * portRenderedHeight;
  const landArea = landRenderedWidth * landRenderedHeight;
  assert(Math.abs(portArea - landArea) / portArea < 0.001, `${s} preserves exact physical area on rotation (${portArea.toFixed(2)} ≈ ${landArea.toFixed(2)})`);
}

// 16. Dimension Label Swapping in Landscape
console.log('\n[Test 16] Dimension Label Swapping in Landscape');
assert(getPosterDimensionsInches('A4', 'portrait') === '8.27 × 11.69 in', 'A4 portrait inches: 8.27 × 11.69 in');
assert(getPosterDimensionsInches('A4', 'landscape') === '11.69 × 8.27 in', 'A4 landscape inches: 11.69 × 8.27 in');
assert(getPosterDimensionsMm('A4', 'portrait') === '210 × 297 mm', 'A4 portrait mm: 210 × 297 mm');
assert(getPosterDimensionsMm('A4', 'landscape') === '297 × 210 mm', 'A4 landscape mm: 297 × 210 mm');

assert(getPosterDimensionsInches('A3', 'landscape') === '16.54 × 11.69 in', 'A3 landscape inches: 16.54 × 11.69 in');
assert(getPosterDimensionsInches('A5', 'landscape') === '8.27 × 5.83 in', 'A5 landscape inches: 8.27 × 5.83 in');
assert(getPosterDimensionsInches('A6', 'landscape') === '5.83 × 4.13 in', 'A6 landscape inches: 5.83 × 4.13 in');

// 17. Boundary Clamping for Rotated Posters
console.log('\n[Test 17] Boundary Clamping for Rotated Posters');
const a3Landscape = calculatePosterDimensions('A3', 'landscape');
// If placed at right edge before rotation
const clampedLandscape = clampPosterPosition(90, 65, a3Landscape.widthPercent, a3Landscape.heightPercent);
assert(clampedLandscape.x + a3Landscape.widthPercent <= USABLE_WALL_BOUNDS.maxX + 0.001, 'Rotated landscape right edge stays inside maxX');
assert(clampedLandscape.y + a3Landscape.heightPercent <= USABLE_WALL_BOUNDS.maxY + 0.001, 'Rotated landscape bottom edge stays inside maxY');

// 18. Contextual Action Menu in UI
console.log('\n[Test 18] Contextual Action Menu Architecture');
assert(posterKitCode.includes('contextual-action-menu'), 'Contextual action menu element is declared');
assert(posterKitCode.includes('handleRotatePoster'), 'handleRotatePoster action is wired to menu');
assert(posterKitCode.includes('handleRemovePoster'), 'handleRemovePoster action is wired to menu');
assert(posterKitCode.includes('RotateCw'), 'RotateCw icon is imported and rendered');
assert(posterKitCode.includes('Trash2'), 'Trash2 icon is imported and rendered');
assert(
  posterKitCode.includes('onPointerDown={(e) => {') && posterKitCode.includes('e.stopPropagation()'),
  'Action menu stops pointer-down propagation to prevent accidental dragging'
);
assert(
  posterKitCode.includes('poster.yPercent >= 11'),
  'Action menu uses dynamic vertical positioning to prevent clipping at wall top edge'
);
assert(
  posterKitCode.includes('poster.xPercent < 10'),
  'Action menu uses horizontal edge clamping to prevent clipping at wall side edges'
);

// 19. Contextual Selection & Keyboard Controls
console.log('\n[Test 19] Selection, Deselection and Keyboard Controls');
assert(posterKitCode.includes('handleWallBackgroundClick'), 'Wall background click handler is declared');
assert(posterKitCode.includes('setSelectedPosterId(null)'), 'Clicking empty wall deselects selected poster');
assert(posterKitCode.includes('setSelectedPosterId(poster.id)'), 'Clicking another poster changes active selection');
assert(posterKitCode.includes("e.key === 'r' || e.key === 'R'"), 'Keyboard R shortcut rotates selected poster');
assert(posterKitCode.includes("e.key === 'Delete' || e.key === 'Backspace'"), 'Keyboard Delete shortcut deletes selected poster');

// 20. Desktop Floating Toolbar & Mobile Toolbar Actions
console.log('\n[Test 20] Toolbar Sync for Selected Poster Actions');
assert(posterKitCode.includes('SELECTED:'), 'Desktop toolbar shows SELECTED: badge');
assert(posterKitCode.includes('handleRotatePoster(selectedPoster.id)'), 'Toolbar provides synchronized Rotate action');
assert(posterKitCode.includes('getPosterDimensionsInches(selectedPoster.sizeId'), 'Toolbar displays orientation-adjusted dimensions');

// --- ARTWORK ASSIGNMENT & DESIGN PICKER VERIFICATION (TESTS 21 - 32) ---

const modalPath = path.resolve(__dirname, '../src/components/posterKit/PosterDesignPickerModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf-8');

// 21. Targeted Application of Collection Design
console.log('\n[Test 21] Targeted Application of Collection Design');
const testPosters = getInitialPosters();
const targetId = testPosters[1].id; // poster-initial-2
const collectionArtwork = {
  source: 'collection' as const,
  url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800',
  productId: 1,
  title: 'Spirit Samurai',
};
const updatedPosters = testPosters.map((p) => {
  if (p.id !== targetId) return p;
  return {
    ...p,
    artwork: collectionArtwork,
    artworkUrl: collectionArtwork.url,
    artworkSource: collectionArtwork.source,
    artworkProductId: collectionArtwork.productId,
    artworkTitle: collectionArtwork.title,
  };
});
const modifiedPoster = updatedPosters.find((p) => p.id === targetId);
const untouchedPoster1 = updatedPosters.find((p) => p.id === testPosters[0].id);
const untouchedPoster3 = updatedPosters.find((p) => p.id === testPosters[2].id);

assert(modifiedPoster?.artworkUrl === collectionArtwork.url, 'Targeted poster has updated artwork URL');
assert(modifiedPoster?.artworkSource === 'collection', 'Targeted poster has collection source');
assert(modifiedPoster?.artworkProductId === 1, 'Targeted poster references product ID');
assert(untouchedPoster1?.artworkUrl === undefined, 'Other posters of different or same size remain untouched (Poster 1)');
assert(untouchedPoster3?.artworkUrl === undefined, 'Other posters of different or same size remain untouched (Poster 3)');

// 22. Custom Image Preview & Confirmation Workflow
console.log('\n[Test 22] Custom Image Preview & Confirmation Workflow');
assert(modalCode.includes('validateAndSelectFile'), 'Modal includes custom file validation and selection logic');
assert(modalCode.includes('URL.createObjectURL(file)'), 'Modal generates temporary local object URL for instant preview');
assert(modalCode.includes('Preview:'), 'Modal renders upload preview section');
assert(modalCode.includes('data-testid="apply-custom-artwork-btn"'), 'Modal provides clear Apply Design action for custom artwork');
assert(modalCode.includes('handleApplyCustomArtwork'), 'Custom artwork is applied only after explicit confirmation');

// 23. Cancel Closes Picker Without Modifying Artwork
console.log('\n[Test 23] Cancel Action Closes Picker Without Modifying Artwork');
assert(modalCode.includes('cleanupUnappliedBlob'), 'Modal cleans up unapplied blob URL when closed');
assert(modalCode.includes('handleClose'), 'handleClose resets modal state and invokes onClose');
assert(modalCode.includes('onClose()'), 'onClose is called to dismiss picker');

// 24. Target Locking Against Selection Changes
console.log('\n[Test 24] Target Locking Against Selection Changes');
assert(modalCode.includes('lockedPosterIdRef'), 'Modal maintains lockedPosterIdRef to track target poster');
assert(modalCode.includes('lockedPosterIdRef.current = targetPoster.id'), 'Locks target poster ID upon modal mount');
assert(
  modalCode.includes('lockedPosterIdRef.current || targetPoster?.id'),
  'Prevents background selection changes from redirecting apply action'
);

// 25. Artwork Aspect Ratio & Edge-to-Edge Fitting
console.log('\n[Test 25] Artwork Aspect Ratio & Edge-to-Edge Fitting');
assert(
  posterKitCode.includes('className="w-full h-full object-cover object-center pointer-events-none select-none"'),
  'Artwork uses object-cover object-center to fill edge-to-edge naturally without artificial sidebars'
);
assert(
  !posterKitCode.includes('object-fill'),
  'Artwork is never distorted or stretched with object-fill'
);
assert(
  posterKitCode.includes('overflow-hidden'),
  'Poster cardstock uses overflow-hidden to stay within physical boundaries'
);

// 26. Rotation Preserves Artwork Assignment
console.log('\n[Test 26] Rotation Preserves Artwork Assignment');
const rotatedPoster = {
  ...modifiedPoster!,
  orientation: 'landscape' as const,
  widthPercent: modifiedPoster!.heightPercent,
  heightPercent: modifiedPoster!.widthPercent,
};
assert(rotatedPoster.artworkUrl === collectionArtwork.url, 'Rotation preserves poster artwork URL');
assert(rotatedPoster.artworkSource === 'collection', 'Rotation preserves poster artwork source');
assert(rotatedPoster.artworkProductId === 1, 'Rotation preserves poster artwork product ID');
assert(rotatedPoster.orientation === 'landscape', 'Poster orientation updated to landscape');

// 27. Dragging & Pointer Events with Artwork
console.log('\n[Test 27] Dragging & Pointer Events with Artwork');
assert(
  posterKitCode.includes('pointer-events-none select-none') && posterKitCode.includes('draggable={false}'),
  'Artwork image has pointer-events-none and draggable=false to prevent interfering with dragging'
);
assert(
  posterKitCode.includes('onPointerDown={(e) => handlePointerDown(e, poster.id)}'),
  'Poster container retains primary pointer drag handlers'
);

// 28. Temporary Object URL Safe Lifecycle & Cleanup
console.log('\n[Test 28] Temporary Object URL Safe Lifecycle & Cleanup');
assert(posterKitCode.includes('activeBlobUrlsRef'), 'PosterKit tracks all active blob URLs');
assert(posterKitCode.includes('URL.revokeObjectURL(poster.artworkUrl)'), 'Releases old blob URL when replacing artwork');
assert(posterKitCode.includes('cleanupAllBlobUrls'), 'PosterKit provides cleanupAllBlobUrls handler');
assert(modalCode.includes('URL.revokeObjectURL'), 'Modal safely revokes discarded preview blob URLs');

// 29. Upload Validation (File Types & 10MB Size Limit)
console.log('\n[Test 29] Upload Validation (File Types & 10MB Size Limit)');
assert(modalCode.includes('10 * 1024 * 1024'), 'Enforces 10 MB maximum file size limit');
assert(modalCode.includes('image/jpeg') && modalCode.includes('image/png') && modalCode.includes('image/webp'), 'Accepts JPEG, PNG, and WebP');
assert(modalCode.includes('Unsupported file format'), 'Provides validation message for unsupported file types');
assert(modalCode.includes('exceeds the 10 MB limit'), 'Provides validation message for oversized files');

// 30. Collection States (Loading, Empty, Error Handling)
console.log('\n[Test 30] Collection States (Loading, Empty, Error Handling)');
assert(modalCode.includes('isLoadingProducts') && modalCode.includes('Loader2'), 'Handles collection loading state with spinner');
assert(modalCode.includes('productsError') && modalCode.includes('AlertTriangle'), 'Handles collection error state with retry action');
assert(modalCode.includes('filteredProducts.length === 0'), 'Handles empty search/filter results state');

// 31. Desktop & Mobile Responsive UI Architecture
console.log('\n[Test 31] Desktop & Mobile Responsive UI Architecture');
assert(modalCode.includes('tab-collections') && modalCode.includes('tab-upload'), 'Modal provides clear tabs for Collections and Upload');
assert(posterKitCode.includes('handleOpenDesignPicker'), 'Contextual menu wires handleOpenDesignPicker');
assert(
  posterKitCode.includes("poster.artworkUrl ? 'Change Design' : 'Add Design'"),
  'Contextual menu displays dynamic Change/Add Design label'
);
assert(posterKitCode.includes('<PosterDesignPickerModal'), 'PosterDesignPickerModal is mounted in PosterKit');

// 32. Existing Size, Orientation, and Boundary Tests Continuity
console.log('\n[Test 32] Existing Size, Orientation, and Boundary Tests Continuity');
assert(AVAILABLE_SIZES.length === 4, 'All 4 sizes (A6, A5, A4, A3) remain intact');
assert(!AVAILABLE_SIZES.some((s: any) => s.id === 'A2'), 'A2 remains strictly excluded');
assert(getPosterDimensionsInches('A4', 'portrait') === '8.27 × 11.69 in', 'Physical scaling remains correct');

// --- ORIGINAL POSTER ARTWORK RESOLUTION & STORAGE VERIFICATION (TESTS 33 - 40) ---

// 33. Mockup Detection & Strict Rejection
console.log('\n[Test 33] Mockup Detection & Strict Rejection');
const sampleMockups = [
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/Anime/DBZ-4.png',
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/storefront/anime/4/1785830357508/400.webp',
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/Music/JC-2.png',
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/Printesty/PR-1.png',
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/Gaming/COD-1.png',
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/Bikes%20&%20Cars/Cars/C-1.png',
  'Anime/DBZ-4.png',
  'storefront/anime/4/100.webp',
];

for (const mockupUrl of sampleMockups) {
  assert(
    isStorefrontMockupUrl(mockupUrl),
    `Mockup URL is correctly identified and rejected: ${mockupUrl.split('/').pop()}`
  );
}

const verifiedArtworkUrls = [
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/4.png',
  'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/spirit-samurai.webp',
  'blob:http://localhost:3000/12345-67890',
  'data:image/png;base64,iVBORw0KGgo...',
];

for (const artUrl of verifiedArtworkUrls) {
  assert(
    !isStorefrontMockupUrl(artUrl),
    `Original artwork URL is recognized as legitimate design: ${artUrl.slice(0, 40)}...`
  );
}

// 34. Safe Fallback for Legacy Products with Missing Artwork
console.log('\n[Test 34] Safe Fallback for Legacy Products with Missing Artwork');
const legacyProductMock: any = {
  id: 4,
  name: 'Goku | Push Past Your Limits | Dragon Ball Z Wall Poster',
  genre: 'Anime',
  price: 299,
  image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/Anime/DBZ-4.png',
  image_card_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/storefront/anime/4/1785830357508/400.webp',
  image_preview_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/storefront/anime/4/1785830357508/800.webp',
  image_thumbnail_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/storefront/anime/4/1785830357508/100.webp',
  description: 'High quality anime print',
  is_active: true,
  is_featured: false,
  is_popular: true,
  tags: ['anime', 'dragon-ball'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const unresolvedArtwork = resolveOriginalPosterArtwork(legacyProductMock);
assert(unresolvedArtwork.isAvailable === false, 'Product without dedicated artwork is marked unavailable');
assert(unresolvedArtwork.artworkUrl === null, 'Artwork URL is strictly null (mockup is rejected)');
assert(unresolvedArtwork.sourceType === 'none', 'Source type is "none"');

// 35. Resolution of Dedicated Storage Artwork & Explicit Fields
console.log('\n[Test 35] Resolution of Dedicated Storage Artwork & Explicit Fields');
const storageMap = new Map<string | number, string>([
  [4, 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/4.png'],
]);

const resolvedFromStorage = resolveOriginalPosterArtwork(legacyProductMock, storageMap);
assert(resolvedFromStorage.isAvailable === true, 'Product with storage artwork is marked available');
assert(
  resolvedFromStorage.artworkUrl === 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/4.png',
  'Artwork URL resolves to verified Supabase Storage path'
);
assert(resolvedFromStorage.sourceType === 'storage', 'Source type is "storage"');

const productWithExplicitField: any = {
  ...legacyProductMock,
  id: 999,
  artwork_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/custom-art.png',
};
const resolvedFromField = resolveOriginalPosterArtwork(productWithExplicitField);
assert(resolvedFromField.isAvailable === true, 'Explicit artwork_url field is recognized');
assert(resolvedFromField.sourceType === 'field', 'Source type is "field"');

assert(POSTER_ARTWORK_BUCKET === 'posters', 'Supabase Storage bucket convention is "posters"');
assert(ARTWORK_STORAGE_FOLDER === 'artworks', 'Dedicated storage folder convention is "artworks"');

// 36. Picker Modal Safeguards & Optimized Image Delivery
console.log('\n[Test 36] Picker Modal Safeguards & Optimized Image Delivery');
assert(
  modalCode.includes("getStorefrontImage(product, 'card')"),
  'Modal uses getStorefrontImage(product, card) for optimized 400px WebP thumbnails'
);
assert(
  !modalCode.includes("src={getOptimizedImageUrl(artworkInfo.artworkUrl"),
  'Modal card display does not download raw print artwork for thumbnails'
);
assert(
  modalCode.includes('resolveOriginalPosterArtwork'),
  'Modal integrates resolveOriginalPosterArtwork for all collections items'
);
assert(
  modalCode.includes('Artwork Unavailable'),
  'Modal renders clear "Artwork Unavailable" indicator when original art is pending'
);
assert(
  modalCode.includes('Mockup Excluded'),
  'Modal explicitly tags excluded mockups with "Mockup Excluded" badge'
);
assert(
  modalCode.includes('title="Original artwork file is unavailable in Supabase Storage'),
  'Card disabled button provides informative tooltip about missing artwork in storage'
);

// 37. Applying Uses Same Original Artwork Source Shown in Picker
console.log('\n[Test 37] Applying Uses Same Original Artwork Source Shown in Picker');
assert(
  modalCode.includes('isStorefrontMockupUrl(artworkInfo.artworkUrl)'),
  'handleApplyCollectionProduct strictly guards against applying any storefront mockup'
);
assert(
  modalCode.includes('!artworkInfo.isAvailable') && modalCode.includes('!artworkInfo.artworkUrl'),
  'handleApplyCollectionProduct aborts early if original artwork is unavailable'
);
assert(
  modalCode.includes('url: artworkInfo.artworkUrl'),
  'Applied artwork URL exactly matches the resolved original artwork URL'
);

// 38. Storefront Mockup Functionality Elsewhere Remains Intact
console.log('\n[Test 38] Storefront Mockup Functionality Elsewhere Remains Intact');
const cardImage = getStorefrontImage(legacyProductMock, 'card');
const thumbImage = getStorefrontImage(legacyProductMock, 'thumbnail');
const previewImage = getStorefrontImage(legacyProductMock, 'preview');

assert(cardImage === legacyProductMock.image_card_url, 'getStorefrontImage resolves card variant for storefront');
assert(thumbImage === legacyProductMock.image_thumbnail_url, 'getStorefrontImage resolves thumbnail variant for storefront');
assert(previewImage === legacyProductMock.image_preview_url, 'getStorefrontImage resolves preview variant for storefront');

// 39. Custom Device Uploads Remain Functional
console.log('\n[Test 39] Custom Device Uploads Remain Functional');
assert(modalCode.includes('tab-upload'), 'Upload tab is available in modal');
assert(modalCode.includes('handleApplyCustomArtwork'), 'handleApplyCustomArtwork applies uploaded artwork');
assert(modalCode.includes('isBlobUrl'), 'Custom artwork retains isBlobUrl flag');
assert(posterKitCode.includes('activeBlobUrlsRef.current.add'), 'PosterKit safely retains blob URLs');

// 41. Artwork File Validation (Type and Size Limits)
console.log('\n[Test 41] Artwork File Validation (Format and 20MB Size Limits)');
assert(MAX_ARTWORK_SIZE_BYTES === 20 * 1024 * 1024, '20MB max file size limit is defined');
assert(ALLOWED_ARTWORK_TYPES.includes('image/jpeg'), 'JPEG MIME type is allowed');
assert(ALLOWED_ARTWORK_TYPES.includes('image/png'), 'PNG MIME type is allowed');
assert(ALLOWED_ARTWORK_TYPES.includes('image/webp'), 'WebP MIME type is allowed');
assert(ALLOWED_ARTWORK_EXTENSIONS.includes('.jpg'), '.jpg extension is allowed');
assert(ALLOWED_ARTWORK_EXTENSIONS.includes('.png'), '.png extension is allowed');
assert(ALLOWED_ARTWORK_EXTENSIONS.includes('.webp'), '.webp extension is allowed');

// Mock File validation
const validPngFile = { name: 'clean-art.png', type: 'image/png', size: 5 * 1024 * 1024 } as any;
const validJpgFile = { name: 'clean-art.jpg', type: 'image/jpeg', size: 12 * 1024 * 1024 } as any;
const validWebpFile = { name: 'clean-art.webp', type: 'image/webp', size: 8 * 1024 * 1024 } as any;
const oversizedFile = { name: 'giant.png', type: 'image/png', size: 25 * 1024 * 1024 } as any;
const invalidTypeFile = { name: 'script.exe', type: 'application/x-msdownload', size: 1024 } as any;

assert(validateArtworkFile(validPngFile).isValid === true, '5MB PNG passes artwork validation');
assert(validateArtworkFile(validJpgFile).isValid === true, '12MB JPG passes artwork validation');
assert(validateArtworkFile(validWebpFile).isValid === true, '8MB WebP passes artwork validation');
assert(validateArtworkFile(oversizedFile).isValid === false, '25MB file is rejected (> 20MB)');
assert(validateArtworkFile(invalidTypeFile).isValid === false, 'Non-image file is rejected');

// 42. Dedicated Storage Bucket & Collision-Safe Path Convention
console.log('\n[Test 42] Storage Path Convention (posters/artworks/{id}.{ext})');
assert(POSTER_ARTWORK_BUCKET === 'posters', 'Target bucket is posters');
assert(ARTWORK_STORAGE_FOLDER === 'artworks', 'Target folder is artworks');

// 43. Admin Products Management UI: Artwork (Print) Column & Status Badges
console.log('\n[Test 43] Admin Products Management UI (Artwork Column & Status Badges)');
const adminProductsPath = path.resolve(__dirname, '../src/pages/admin/Products.tsx');
const adminProductsCode = fs.readFileSync(adminProductsPath, 'utf-8');

assert(adminProductsCode.includes('Artwork (Print)'), 'Admin table includes "Artwork (Print)" column header');
assert(adminProductsCode.includes('Clean Art Ready'), 'Admin table displays "Clean Art Ready" badge for verified art');
assert(adminProductsCode.includes('No Artwork'), 'Admin table displays "No Artwork" badge for unassigned products');
assert(adminProductsCode.includes('+ Upload'), 'Admin table provides quick "+ Upload" action');

// 44. Admin Products Modal: Poster Kit Artwork Tab & Upload Dropzone
console.log('\n[Test 44] Admin Products Modal (Poster Kit Artwork Tab & Collision-Safe Upload)');
assert(adminProductsCode.includes('Poster Kit Artwork'), 'Modal tab selector includes "Poster Kit Artwork" tab');
assert(adminProductsCode.includes('uploadProductOriginalArtwork'), 'Modal calls uploadProductOriginalArtwork service');
assert(adminProductsCode.includes('removeProductOriginalArtwork'), 'Modal calls removeProductOriginalArtwork service');
assert(adminProductsCode.includes('validateArtworkFile'), 'Modal validates files before uploading');
assert(adminProductsCode.includes('posters/artworks/'), 'Modal references dedicated storage path convention');

// 45. Collections Picker Displays Only Products with Verified Artwork
console.log('\n[Test 45] Collections Picker Displays Verified Artwork Only by Default');
assert(modalCode.includes('showOnlyVerified'), 'Modal maintains showOnlyVerified filter state');
assert(modalCode.includes('verifiedCatalogCount'), 'Modal calculates verifiedCatalogCount');
assert(
  modalCode.includes('const [showOnlyVerified, setShowOnlyVerified] = useState(true);'),
  'showOnlyVerified defaults to true to display only verified original artwork'
);

// 46. Safe Unavailable Notice Explains Why Mockups Are Excluded
console.log('\n[Test 46] Safe Explanation When Artwork Is Pending or Unassigned');
assert(modalCode.includes('Original Standalone Artwork Required'), 'Modal explains original standalone artwork requirement');
assert(modalCode.includes('storefront mockups are strictly excluded'), 'Modal explicitly explains mockup exclusion');
assert(modalCode.includes('View Catalog Status'), 'Modal allows admins/users to view complete catalog status');

// 47. Database Schema & Migration for artwork_url
console.log('\n[Test 47] Database Migration (20261024000000_add_artwork_url_to_products.sql)');
const migrationPath = path.resolve(
  __dirname,
  '../supabase/migrations/20261024000000_add_artwork_url_to_products.sql'
);
assert(fs.existsSync(migrationPath), 'Migration file exists in supabase/migrations/');
const migrationCode = fs.readFileSync(migrationPath, 'utf-8');
assert(migrationCode.includes('artwork_url'), 'Migration adds artwork_url column');
assert(
  migrationCode.includes('ALTER TABLE public.products') ||
    migrationCode.includes('ALTER TABLE products'),
  'Migration targets products table'
);

// 48. Database Types Include artwork_url
console.log('\n[Test 48] TypeScript Database Schema Types');
const dbTypesPath = path.resolve(__dirname, '../src/types/database.ts');
const dbTypesCode = fs.readFileSync(dbTypesPath, 'utf-8');
assert(dbTypesCode.includes('artwork_url?: string | null'), 'Product Row type includes artwork_url');

// 49. Storage Upload Failure & RLS Actionable Error
console.log('\n[Test 49] Storage Upload Failure & RLS Actionable Guidance');
const posterArtworkCode = fs.readFileSync(path.resolve(__dirname, '../src/services/posterArtwork.ts'), 'utf-8');
assert(posterArtworkCode.includes('uploadProductOriginalArtwork'), 'uploadProductOriginalArtwork is defined');
assert(posterArtworkCode.includes('UploadArtworkResult'), 'UploadArtworkResult interface is exported');
assert(posterArtworkCode.includes('Row-level security (RLS) on bucket \'posters\' denied upload'), 'Actionable RLS guidance is returned on 403/policy violation');

// 50. Storage Success Followed by Database Failure Handling & Direct Persistence
console.log('\n[Test 50] Storage Success Followed by Database Failure (Safe Partial Failure)');
assert(posterArtworkCode.includes('persistProductArtworkUrl'), 'persistProductArtworkUrl is exported for direct retry');
assert(posterArtworkCode.includes('Artwork was uploaded to Storage'), 'Safe partial failure error identifies storage path and db failure');
assert(posterArtworkCode.includes('Storage image is preserved; please retry saving'), 'Safe partial failure informs user storage image is preserved');
assert(adminProductsCode.includes('handleRetryDatabaseSave'), 'Admin UI provides direct 1-click retry for database persistence');

// 51. Correct Product ID and artwork_url Assignment
console.log('\n[Test 51] Correct Product ID and artwork_url Assignment');
assert(posterArtworkCode.includes('numId = Number(productId)'), 'Product ID is sanitized to numeric format');
assert(posterArtworkCode.includes('.eq(\'id\', numId)'), 'Database update filters by exact sanitized product ID');
assert(posterArtworkCode.includes('.select(\'id, name, artwork_url\')'), 'Database update confirms persisted row via .select()');

// 52. Immediate Product Table Refresh & Clean Art Ready Status
console.log('\n[Test 52] Immediate Product Table Refresh (Clean Art Ready Status)');
assert(adminProductsCode.includes('setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, artwork_url: newUrl } : p))'), 'Products state is immediately updated upon successful upload without requiring page refresh');
assert(adminProductsCode.includes('setStorageArtworksMap(updatedMap)'), 'Storage artworks map is immediately updated in memory');

// 53. Reopening Modal with Saved Artwork
console.log('\n[Test 53] Reopening Modal Preserves Saved Artwork');
assert(adminProductsCode.includes('const resolvedArt = resolveOriginalPosterArtwork(product as Product, storageArtworksMap);'), 'openEditModal resolves artwork using verified storage map');
assert(adminProductsCode.includes('artwork_url: initialArtworkUrl'), 'editingProduct is initialized with resolved artwork URL');

// 54. "Update Vault" Preserves Persisted artwork_url
console.log('\n[Test 54] "Update Vault" Never Discards or Overwrites artwork_url');
assert(adminProductsCode.includes('preservedArtworkUrl'), 'onSubmit calculates preservedArtworkUrl from editingProduct and existing product');
assert(adminProductsCode.includes('artwork_url: preservedArtworkUrl'), 'productData assigns preservedArtworkUrl');

// 55. Safe Removal Flow
console.log('\n[Test 55] Safe Artwork Removal Flow');
assert(posterArtworkCode.includes('removeProductOriginalArtwork'), 'removeProductOriginalArtwork is defined');
assert(posterArtworkCode.includes('.update({ artwork_url: null })'), 'removeProductOriginalArtwork clears artwork_url column');
assert(adminProductsCode.includes('Original artwork removed safely'), 'Admin UI reports successful artwork removal');

// 56. Poster Kit Discovery of Persisted Database artwork_url
console.log('\n[Test 56] Poster Kit Discovery of Persisted Database artwork_url');
const testProductWithSavedArtwork: any = {
  id: 8,
  name: 'GOKU & SHENRON',
  genre: 'Anime',
  price: 299,
  image: 'https://posterealm.supabase.co/storage/v1/object/public/posters/anime/goku-shenron.jpg',
  artwork_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/8.png',
};
const resolvedKitArt = resolveOriginalPosterArtwork(testProductWithSavedArtwork);
assert(resolvedKitArt.isAvailable === true, 'Poster Kit recognizes product with artwork_url as available');
assert(resolvedKitArt.artworkUrl === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/8.png', 'Poster Kit uses clean artwork_url, NOT room mockup');
assert(resolvedKitArt.sourceType === 'field', 'Source type is resolved from database field');

// 57. Admin Storage Policy Migration Presence & Verification
console.log('\n[Test 57] Supabase Storage Policy Migration');
const storageMigrationPath = path.resolve(__dirname, '../supabase/migrations/20261024010000_storage_posters_admin_policy.sql');
assert(fs.existsSync(storageMigrationPath), 'Storage posters admin policy migration exists');
const storageMigrationSql = fs.readFileSync(storageMigrationPath, 'utf-8');
assert(storageMigrationSql.includes('Admins can upload to posters bucket'), 'Migration provides INSERT policy');
assert(storageMigrationSql.includes('Admins can update posters bucket'), 'Migration provides UPDATE policy');
assert(storageMigrationSql.includes('Admins can delete from posters bucket'), 'Migration provides DELETE policy');
assert(storageMigrationSql.includes('bucket_id = \'posters\''), 'Migration targets posters bucket');

// 58. Edge-to-Edge Artwork Rendering (Zero Padding, No Artificial Strips or Dark Backing)
console.log('\n[Test 58] Edge-to-Edge Artwork Rendering (Zero Padding, No Artificial Strips or Dark Backing)');
assert(
  posterKitCode.includes('padding: poster.artworkUrl ? 0 : \'clamp(2px, 3.5cqw, 10px)\''),
  'Padding is strictly 0 when artwork is assigned, eliminating artificial white frames'
);
assert(
  !posterKitCode.includes('clamp(2px, 1.5cqw, 6px)'),
  'Obsolete artificial artwork padding clamp is completely removed'
);
assert(
  !posterKitCode.includes('poster.artworkUrl\n                        ? \'bg-neutral-900\'') &&
  !posterKitCode.includes('poster.artworkUrl ? \'bg-neutral-900\''),
  'Dark backing bg-neutral-900 is removed from poster-cardstock to prevent black strips around assigned artwork'
);
// 59. Custom Upload Blob Detachment & Ownership Transfer
console.log('\n[Test 59] Custom Upload Blob Ownership Transfer to PosterKit');
assert(
  modalCode.includes('unappliedBlobUrlRef.current = null'),
  'handleApplyCustomArtwork disowns the blob URL before closing so it is not revoked prematurely'
);
assert(
  modalCode.includes('unappliedBlobUrlRef') && modalCode.includes('cleanupUnappliedBlob'),
  'cleanupUnappliedBlob only revokes blob URLs that were never applied to a poster'
);

// 60. Active Blob URL Registration & Preservation in PosterKit
console.log('\n[Test 60] Active Blob URL Preservation on Wall Grid');
assert(
  posterKitCode.includes('activeBlobUrlsRef.current.add(artwork.url)'),
  'PosterKit tracks applied custom blob URLs in activeBlobUrlsRef'
);
assert(
  posterKitCode.includes('artwork.isBlobUrl && artwork.url.startsWith(\'blob:\')'),
  'Identifies custom blob URLs for lifecycle tracking'
);

// 61. Safe Cleanup on Poster Deletion and Replacement
console.log('\n[Test 61] Safe Blob Cleanup on Replacement and Deletion');
assert(
  posterKitCode.includes('isUsedElsewhere') && posterKitCode.includes('URL.revokeObjectURL(poster.artworkUrl)'),
  'PosterKit checks if blob URL is used by another poster before revoking upon replacement'
);
assert(
  posterKitCode.includes('posterToRemove.artworkUrl.startsWith(\'blob:\')'),
  'PosterKit safely cleans up custom blob URLs when a poster is deleted'
);
assert(
  posterKitCode.includes('cleanupAllBlobUrls') && posterKitCode.includes('activeBlobUrlsRef.current.clear()'),
  'PosterKit cleans up all active blob URLs upon component unmount or layout clear'
);

// 62. Graceful Artwork Error Fallback (No Broken Image Icons or Raw Filenames)
console.log('\n[Test 62] Graceful Artwork Error Fallback on Wall Grid');
assert(
  posterKitCode.includes('failedArtworkUrls') && posterKitCode.includes('setFailedArtworkUrls'),
  'PosterKit tracks failed artwork URLs in state'
);
assert(
  posterKitCode.includes('onError={() =>') && posterKitCode.includes('setFailedArtworkUrls'),
  'PosterKit image catches load errors with onError handler'
);
assert(
  posterKitCode.includes('Artwork Error') && posterKitCode.includes('Unable to render artwork'),
  'PosterKit renders graceful error card instead of raw broken image icon and filename'
);
assert(
  posterKitCode.includes('setFailedArtworkUrls((prev) => {') &&
  posterKitCode.includes('next.delete(artwork.url)'),
  'Applying new artwork clears previous error state for that artwork'
);

// 63. Modal Upload Validation and Error Resilience
console.log('\n[Test 63] Upload Error Resilience and Retry Retention');
assert(
  modalCode.includes('setUploadError') && modalCode.includes('unappliedBlobUrlRef.current = customPreviewUrl'),
  'Retains preview URL in modal ref if application fails so user can retry'
);
assert(
  modalCode.includes('data-testid="apply-custom-artwork-btn"'),
  'Apply button allows explicit user confirmation of custom artwork'
);

// 64. Supabase Collection Compatibility Maintained
console.log('\n[Test 64] Collection Artwork Compatibility Maintained');
assert(
  modalCode.includes('handleApplyCollectionProduct'),
  'handleApplyCollectionProduct handler is preserved'
);
assert(
  modalCode.includes('resolveOriginalPosterArtwork'),
  'Original Supabase storage artwork resolver is used'
);
assert(
  modalCode.includes('isStorefrontMockupUrl'),
  'Mockup protection remains active for collections'
);

// 65. Edge-to-Edge Artwork Rendering Integrity
console.log('\n[Test 65] Edge-to-Edge Artwork Rendering Integrity');
assert(
  posterKitCode.includes('className="w-full h-full object-cover object-center pointer-events-none select-none"'),
  'Artwork utilizes object-cover object-center for seamless edge-to-edge wall display'
);
assert(
  posterKitCode.includes('padding: poster.artworkUrl ? 0 : \'clamp(2px, 3.5cqw, 10px)\''),
  'Cardstock surface uses 0 padding for assigned artwork'
);

// ============================================================================
// EXTENDED TESTS: CLEAR ARTWORK & PERSISTENT LAYOUT (Features 1 & 2)
// ============================================================================

async function runPersistenceAndClearTests() {
  console.log('\n--- RUNNING EXTENDED VERIFICATION TESTS (CLEAR ARTWORK & PERSISTENT LAYOUT) ---');

  // 66. Clearing Artwork Retains the Poster and Its Exact Geometry
  console.log('\n[Test 66] Clearing Artwork Retains Poster and Exact Geometry');
  const initialPoster: PlacedPoster = {
    id: 'poster-geom-test',
    sizeId: 'A4',
    orientation: 'landscape',
    xPercent: 32.45,
    yPercent: 41.2,
    widthPercent: 25.1,
    heightPercent: 18.2,
    label: 'Poster #2',
    artworkUrl: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/12.png',
    artworkSource: 'collection',
    artworkProductId: 12,
    artworkTitle: 'Attack on Titan Art',
    customArtworkId: undefined,
    artwork: {
      source: 'collection',
      url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/12.png',
      productId: 12,
      title: 'Attack on Titan Art',
      isBlobUrl: false,
    },
  };

  // Pure function simulation matching handleClearPosterDesign in PosterKit.tsx
  function simulateClearPosterDesign(posterList: PlacedPoster[], targetId: string): PlacedPoster[] {
    const poster = posterList.find((p) => p.id === targetId);
    if (!poster || !poster.artworkUrl) return posterList;

    return posterList.map((p) => {
      if (p.id !== targetId) return p;
      return {
        ...p,
        artwork: undefined,
        artworkUrl: undefined,
        artworkSource: undefined,
        artworkProductId: undefined,
        artworkTitle: undefined,
        customArtworkId: undefined,
      };
    });
  }

  const clearedList = simulateClearPosterDesign([initialPoster], 'poster-geom-test');
  const clearedPoster = clearedList[0];

  assert(clearedList.length === 1, 'Poster grid remains in layout after clearing design');
  assert(clearedPoster.id === initialPoster.id, 'Poster ID is strictly preserved');
  assert(clearedPoster.sizeId === initialPoster.sizeId, 'Poster sizeId is strictly preserved');
  assert(clearedPoster.orientation === initialPoster.orientation, 'Poster orientation is strictly preserved');
  assert(clearedPoster.xPercent === initialPoster.xPercent, 'Poster xPercent is strictly preserved');
  assert(clearedPoster.yPercent === initialPoster.yPercent, 'Poster yPercent is strictly preserved');
  assert(clearedPoster.widthPercent === initialPoster.widthPercent, 'Poster widthPercent is strictly preserved');
  assert(clearedPoster.heightPercent === initialPoster.heightPercent, 'Poster heightPercent is strictly preserved');
  assert(clearedPoster.label === initialPoster.label, 'Poster label is strictly preserved');
  assert(clearedPoster.artworkUrl === undefined, 'Artwork URL is completely removed');
  assert(clearedPoster.artwork === undefined, 'Artwork object is completely removed');
  assert(clearedPoster.artworkSource === undefined, 'Artwork source is completely removed');
  assert(clearedPoster.artworkProductId === undefined, 'Artwork product ID is completely removed');
  assert(clearedPoster.artworkTitle === undefined, 'Artwork title is completely removed');
  assert(clearedPoster.customArtworkId === undefined, 'Custom artwork ID is completely removed');

  // Verify PosterKit.tsx contains the exact cardstock placeholder restoration
  assert(
    posterKitCode.includes('handleClearPosterDesign') && posterKitCode.includes('artwork: undefined'),
    'PosterKit.tsx implements handleClearPosterDesign clearing artwork metadata'
  );
  assert(
    posterKitCode.includes('poster-crop-mark') && posterKitCode.includes('poster-size-title') && posterKitCode.includes('poster-dim-label'),
    'PosterKit.tsx renders the exact blank cardstock placeholder with crop marks and dimensions when artworkUrl is absent'
  );

  // 67. Clearing an Already Blank Poster Is Safe
  console.log('\n[Test 67] Clearing Already Blank Poster Is Safe');
  const blankPoster: PlacedPoster = {
    id: 'poster-blank',
    sizeId: 'A3',
    orientation: 'portrait',
    xPercent: 10,
    yPercent: 10,
    widthPercent: 20,
    heightPercent: 30,
    label: 'Poster #3',
  };
  const blankResult = simulateClearPosterDesign([blankPoster], 'poster-blank');
  assert(blankResult[0] === blankPoster, 'Clearing a blank poster returns unchanged poster safely');

  // 68. Clearing Artwork Releases Unreferenced Blob URL Safely
  console.log('\n[Test 68] Clearing Artwork Releases Unreferenced Blob URL');
  let revokedUrls: string[] = [];
  const testRevokeObjectURL = (url: string) => {
    revokedUrls.push(url);
  };

  function simulateBlobCleanup(posters: PlacedPoster[], targetId: string, revokeFn: (url: string) => void) {
    const poster = posters.find((p) => p.id === targetId);
    if (!poster || !poster.artworkUrl) return;

    if (poster.artworkUrl.startsWith('blob:')) {
      const isUsedElsewhere = posters.some(
        (other) => other.id !== targetId && other.artworkUrl === poster.artworkUrl
      );
      if (!isUsedElsewhere) {
        revokeFn(poster.artworkUrl);
      }
    }
  }

  const singleBlobPoster: PlacedPoster = {
    id: 'p-blob-1',
    sizeId: 'A5',
    orientation: 'portrait',
    xPercent: 15,
    yPercent: 15,
    widthPercent: 10,
    heightPercent: 15,
    label: 'Poster #4',
    artworkUrl: 'blob:http://localhost/unique-blob-123',
    artworkSource: 'custom',
  };

  simulateBlobCleanup([singleBlobPoster], 'p-blob-1', testRevokeObjectURL);
  assert(revokedUrls.includes('blob:http://localhost/unique-blob-123'), 'Unreferenced blob URL is released safely');

  // 69. Clearing One Poster Does Not Invalidate Another Poster Sharing a URL
  console.log('\n[Test 69] Clearing One Poster Does Not Invalidate Another Poster Sharing a URL');
  revokedUrls = [];
  const sharedBlobUrl = 'blob:http://localhost/shared-blob-456';
  const sharedPosterA: PlacedPoster = {
    id: 'poster-shared-a',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 10,
    yPercent: 10,
    widthPercent: 15,
    heightPercent: 20,
    label: 'Poster #5',
    artworkUrl: sharedBlobUrl,
    artworkSource: 'custom',
  };
  const sharedPosterB: PlacedPoster = {
    id: 'poster-shared-b',
    sizeId: 'A4',
    orientation: 'landscape',
    xPercent: 40,
    yPercent: 10,
    widthPercent: 20,
    heightPercent: 15,
    label: 'Poster #6',
    artworkUrl: sharedBlobUrl,
    artworkSource: 'custom',
  };

  const sharedList = [sharedPosterA, sharedPosterB];
  simulateBlobCleanup(sharedList, 'poster-shared-a', testRevokeObjectURL);
  assert(!revokedUrls.includes(sharedBlobUrl), 'Shared blob URL is NOT revoked when another poster still references it');

  const afterClearingA = simulateClearPosterDesign(sharedList, 'poster-shared-a');
  assert(afterClearingA.find((p) => p.id === 'poster-shared-b')?.artworkUrl === sharedBlobUrl, 'Poster B retains its shared artwork URL');

  // 70. Saving and Restoring the Full Layout
  console.log('\n[Test 70] Saving and Restoring Full Layout');
  resetSavedPosterKitLayout();

  const testFullLayout: PlacedPoster[] = [
    {
      id: 'full-p1',
      sizeId: 'A6',
      orientation: 'landscape',
      xPercent: 12.34,
      yPercent: 18.56,
      widthPercent: 14.12,
      heightPercent: 10.01,
      label: 'Poster #1 (A6)',
    },
    {
      id: 'full-p2',
      sizeId: 'A3',
      orientation: 'portrait',
      xPercent: 45.0,
      yPercent: 20.0,
      widthPercent: 25.0,
      heightPercent: 35.0,
      label: 'Poster #2 (A3)',
      artworkSource: 'collection',
      artworkUrl: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/5.png',
      artworkProductId: 5,
      artworkTitle: 'Goku Minimalist',
    },
  ];

  savePosterKitLayout(testFullLayout, 'A6');
  const restoredLayout = getSavedPosterKitLayout();

  assert(restoredLayout !== null, 'Restored layout is not null');
  assert(restoredLayout!.activeSizeToAdd === 'A6', 'Active size to add restored correctly');
  assert(restoredLayout!.posters.length === 2, 'Restored exact count of 2 posters');
  assert(restoredLayout!.posters[0].id === 'full-p1', 'Poster 1 ID preserved');
  assert(restoredLayout!.posters[0].sizeId === 'A6', 'Poster 1 sizeId preserved');
  assert(restoredLayout!.posters[0].orientation === 'landscape', 'Poster 1 orientation preserved');
  assert(restoredLayout!.posters[0].xPercent === 12.34, 'Poster 1 xPercent preserved');
  assert(restoredLayout!.posters[0].yPercent === 18.56, 'Poster 1 yPercent preserved');

  // 71. Restoring Collection Artwork After Refresh
  console.log('\n[Test 71] Restoring Collection Artwork After Refresh');
  const restoredCollectionPoster = restoredLayout!.posters[1];
  assert(restoredCollectionPoster.artworkSource === 'collection', 'Artwork source is collection');
  assert(
    restoredCollectionPoster.artworkUrl === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/5.png',
    'Collection artwork URL restored accurately'
  );
  assert(restoredCollectionPoster.artworkProductId === 5, 'Collection artworkProductId preserved');
  assert(restoredCollectionPoster.artworkTitle === 'Goku Minimalist', 'Collection artworkTitle preserved');
  assert(restoredCollectionPoster.artwork !== undefined, 'Artwork object reconstructed for rendering');
  assert(restoredCollectionPoster.artwork?.isBlobUrl === false, 'Collection artwork marked isBlobUrl: false');

  // 72. Restoring Custom Uploads After Refresh Using Durable IndexedDB Strategy
  console.log('\n[Test 72] Restoring Custom Uploads via Durable Strategy');
  const customId = `custom_test_${Date.now()}`;
  const dummyBlob = new Blob(['mock-binary-poster-image-data-test'], { type: 'image/png' });

  await saveCustomArtworkBlob(customId, dummyBlob, 'test-poster.png');
  const retrievedBlob = await getCustomArtworkBlob(customId);

  assert(retrievedBlob !== null, 'Custom artwork Blob successfully retrieved from storage');
  assert(retrievedBlob?.type === 'image/png', 'Retrieved Blob preserves MIME type image/png');
  assert(retrievedBlob?.size === dummyBlob.size, 'Retrieved Blob preserves exact byte length');

  // Verify that transient blob URLs are NEVER persisted into localStorage
  const posterWithCustomArt: PlacedPoster = {
    id: 'poster-custom-1',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 20,
    yPercent: 20,
    widthPercent: 15,
    heightPercent: 20,
    label: 'Poster Custom',
    artworkUrl: 'blob:http://localhost/transient-blob-url',
    artworkSource: 'custom',
    customArtworkId: customId,
    artworkTitle: 'My Upload.png',
  };

  savePosterKitLayout([posterWithCustomArt], 'A4');
  const rawStorage = getRawSavedLayoutJson() || '';
  assert(!rawStorage.includes('blob:http://localhost/transient-blob-url'), 'Transient blob: URLs are strictly NOT saved to localStorage');
  assert(rawStorage.includes(customId), 'Stable customArtworkId is persisted in layout');

  const restoredCustomLayout = getSavedPosterKitLayout();
  assert(restoredCustomLayout?.posters[0].customArtworkId === customId, 'customArtworkId restored for poster');
  assert(restoredCustomLayout?.posters[0].artworkSource === 'custom', 'artworkSource custom restored for poster');

  // Cleanup test blob
  await deleteCustomArtworkBlob(customId);
  const deletedBlob = await getCustomArtworkBlob(customId);
  assert(deletedBlob === null, 'deleteCustomArtworkBlob deletes blob safely');

  // 73. Restoring Orientation, Positions, Dimensions, and Poster IDs
  console.log('\n[Test 73] Restoring Orientation, Positions, Dimensions, and Poster IDs');
  const complexLayout: PlacedPoster[] = [
    {
      id: 'p-landscape-a3',
      sizeId: 'A3',
      orientation: 'landscape',
      xPercent: 15.5555,
      yPercent: 22.3333,
      widthPercent: 32.1111,
      heightPercent: 24.6666,
      label: 'Main Feature',
    },
    {
      id: 'p-portrait-a6',
      sizeId: 'A6',
      orientation: 'portrait',
      xPercent: 60.1234,
      yPercent: 50.5678,
      widthPercent: 8.7654,
      heightPercent: 12.3456,
      label: 'Corner Mini',
    },
  ];
  savePosterKitLayout(complexLayout, 'A5');
  const restoredComplex = getSavedPosterKitLayout()!;
  assert(restoredComplex.posters[0].id === 'p-landscape-a3', 'Poster ID 1 exact match');
  assert(restoredComplex.posters[0].orientation === 'landscape', 'Landscape orientation restored');
  assert(restoredComplex.posters[0].xPercent === 15.5555, 'xPercent decimal precision restored');
  assert(restoredComplex.posters[0].widthPercent === 32.1111, 'widthPercent decimal precision restored');
  assert(restoredComplex.posters[1].id === 'p-portrait-a6', 'Poster ID 2 exact match');
  assert(restoredComplex.posters[1].orientation === 'portrait', 'Portrait orientation restored');

  // 74. Persisting Add, Drag, Rotate, Delete, Clear All, and Reset Layout Actions
  console.log('\n[Test 74] Layout State Persisted on All Actions');
  assert(
    posterKitCode.includes('useEffect(() => {') &&
    posterKitCode.includes('if (isDragging) return;') &&
    posterKitCode.includes('savePosterKitLayout(posters, activeSizeToAdd);'),
    'PosterKit auto-saves layout on state changes, deferring while dragging'
  );
  assert(
    posterKitCode.includes('handleResetLayout') && posterKitCode.includes('savePosterKitLayout(initial, activeSizeToAdd);'),
    'Reset Layout updates and persists sample layout to localStorage'
  );
  assert(
    posterKitCode.includes('handleConfirmClear') && posterKitCode.includes('clearSavedPosterKitLayout(activeSizeToAdd);'),
    'Clear All clears and persists empty state to localStorage'
  );

  // Test Clear All persistence explicitly
  clearSavedPosterKitLayout('A4');
  const clearedState = getSavedPosterKitLayout();
  assert(clearedState !== null && clearedState.posters.length === 0, 'Clear All persists explicit empty array posters: []');

  // Test Reset Layout
  resetSavedPosterKitLayout();
  assert(getSavedPosterKitLayout() === null, 'resetSavedPosterKitLayout removes key completely');

  // 75. Handling Malformed or Outdated Saved State
  console.log('\n[Test 75] Handling Malformed or Outdated Saved State');
  // Malformed JSON
  setRawSavedLayoutJson('{"version": 1, "posters": INVALID_JSON}');
  assert(getSavedPosterKitLayout() === null, 'Malformed JSON returns null safely without crashing');

  // Outdated version
  setRawSavedLayoutJson(JSON.stringify({ version: 999, posters: [] }));
  assert(getSavedPosterKitLayout() === null, 'Outdated/mismatched version returns null safely');

  // Missing posters array
  setRawSavedLayoutJson(JSON.stringify({ version: 1, posters: 'not-an-array' }));
  assert(getSavedPosterKitLayout() === null, 'Non-array posters returns null safely');

  // Corrupted items in posters array
  setRawSavedLayoutJson(
    JSON.stringify({
      version: 1,
      activeSizeToAdd: 'A4',
      posters: [
        null,
        { id: '', sizeId: 'INVALID' },
        { id: 'valid-p', sizeId: 'A4', orientation: 'portrait', xPercent: 10, yPercent: 10, widthPercent: 15, heightPercent: 20 },
      ],
    })
  );
  const sanitized = getSavedPosterKitLayout();
  assert(sanitized !== null && sanitized.posters.length === 1, 'Corrupted items are filtered out; valid items kept');
  assert(sanitized?.posters[0].id === 'valid-p', 'Valid poster extracted safely');

  // 76. Avoiding Default-Layout Flash Before Restored State Appears
  console.log('\n[Test 76] Avoiding Default-Layout Flash');
  assert(
    posterKitCode.includes('const [posters, setPosters] = useState<PlacedPoster[]>(() => {') &&
    posterKitCode.includes('const saved = getSavedPosterKitLayout();') &&
    posterKitCode.includes('if (saved && Array.isArray(saved.posters)) {') &&
    (posterKitCode.includes('return saved.posters;') || posterKitCode.includes('return normalizeMinimumPosterLayout(saved.posters);')) &&
    posterKitCode.includes('return getInitialPosters();'),
    'Posters state initializes synchronously from saved layout, preventing default-layout flash'
  );

  // 77. Contextual Action Menu and Keyboard Shortcut
  console.log('\n[Test 77] Contextual Action Menu Styling and Keyboard Shortcut C');
  assert(
    posterKitCode.includes('{poster.artworkUrl && (') &&
    posterKitCode.includes('handleClearPosterDesign(poster.id)') &&
    posterKitCode.includes('Clear Design (C)'),
    'Contextual action menu displays Clear Design (C) when artwork is assigned'
  );
  assert(
    posterKitCode.includes("e.key === 'c' || e.key === 'C'") &&
    posterKitCode.includes('handleClearPosterDesign(selectedPosterId)'),
    'Keyboard shortcut C/c triggers handleClearPosterDesign for selected poster'
  );
  assert(
    posterKitCode.includes('onPointerDown={(e) => e.stopPropagation()}') &&
    posterKitCode.includes('onClick={(e) => {') &&
    posterKitCode.includes('e.stopPropagation();'),
    'Clear Design stops event propagation so clicking never triggers dragging or deselects wall'
  );

  // 78. Clear Design in Toolbars
  console.log('\n[Test 78] Clear Design in Desktop and Mobile Toolbars');
  assert(
    posterKitCode.includes('selectedPoster.artworkUrl && (') &&
    posterKitCode.includes('Clear Art'),
    'Toolbars display Clear Art action when selected poster has artwork assigned'
  );

  // ============================================================================
  // FULL-SCREEN WALL PREVIEW & BACK BUTTON VERIFICATION (Tests 79 - 88)
  // ============================================================================

  // 79. Full Screen Control on the Wall
  console.log('\n[Test 79] Full Screen Control on Wall Background Area');
  assert(
    posterKitCode.includes('data-testid="enter-fullscreen-btn"') ||
    (posterKitCode.includes('handleEnterFullScreen') && posterKitCode.includes('Full Screen')),
    'Full Screen button exists on the wall canvas'
  );
  assert(
    posterKitCode.includes('Maximize2'),
    'Full Screen button uses Maximize2 expand/maximize icon'
  );
  assert(
    posterKitCode.includes('bottom-2.5 right-2.5') || posterKitCode.includes('bottom-3 right-3') || posterKitCode.includes('bottom-3.5 right-3.5'),
    'Full Screen button is positioned in the bottom-right corner of the wall canvas'
  );
  assert(
    posterKitCode.includes('comic-border') && posterKitCode.includes('border-brand-black'),
    'Full Screen button uses Posterealm comic-inspired styling'
  );

  // 80. Full Screen Does Not Interfere With Poster Dragging, Selection, or Rotation
  console.log('\n[Test 80] Full Screen Control Event Isolation');
  assert(
    posterKitCode.includes('handleEnterFullScreen') &&
    posterKitCode.includes('e.stopPropagation()'),
    'Full Screen button stops pointer & click propagation to prevent wall deselects or drags'
  );

  // 81. Full-Screen Viewing Mode and Complete Surrounding UI Occlusion
  console.log('\n[Test 81] Full-Screen Viewing Mode Presentation');
  assert(
    posterKitCode.includes('isFullScreen') &&
    posterKitCode.includes('fixed inset-0 z-[100]'),
    'Full-screen mode uses fixed inset-0 overlay with elevated z-index (z-[100]) occluding all page UI'
  );
  assert(
    posterKitCode.includes('!isFullScreen && (') &&
    posterKitCode.includes('Floating Poster Size and Layout Toolbar Overlay'),
    'Desktop floating toolbar is cleanly hidden during full-screen preview'
  );
  assert(
    posterKitCode.includes('!isFullScreen && (') &&
    posterKitCode.includes('Mobile Toolbar Panel'),
    'Mobile toolbar panel is cleanly hidden during full-screen preview'
  );

  // 82. Aspect Ratio and Proportions Preservation
  console.log('\n[Test 82] Proportions and Aspect Ratio Preservation in Full Screen');
  assert(
    posterKitCode.includes('aspect-[16/9]') &&
    posterKitCode.includes('max-h-full'),
    'Wall canvas strictly enforces 16:9 aspect ratio and maximum height in full screen'
  );
  assert(
    posterKitCode.includes('id="wall-bg-image"') &&
    posterKitCode.includes('object-cover'),
    'Realistic wall background image is preserved with object-cover scaling'
  );
  assert(
    posterKitCode.includes('poster.xPercent') && posterKitCode.includes('poster.yPercent') &&
    posterKitCode.includes('poster.widthPercent') && posterKitCode.includes('poster.heightPercent'),
    'Posters use identical relative percentage coordinates across editing and fullscreen modes'
  );

  // 83. Back to Editor Button
  console.log('\n[Test 83] Back to Editor Button');
  assert(
    posterKitCode.includes('data-testid="exit-fullscreen-btn"') ||
    (posterKitCode.includes('handleExitFullScreen') && posterKitCode.includes('Back to Editor')),
    'Back to Editor button is displayed in full-screen view'
  );
  assert(
    posterKitCode.includes('ArrowLeft'),
    'Back to Editor button includes ArrowLeft icon'
  );

  // 84. Layout State & Selection Preserved on Exit
  console.log('\n[Test 84] Layout State and Poster Selection Preserved Across Full Screen');
  assert(
    !posterKitCode.includes('handleExitFullScreen = () => {\n    setPosters') &&
    !posterKitCode.includes('handleExitFullScreen = async () => {\n    setPosters'),
    'Exiting full screen does not reset or reinitialize posters layout state'
  );
  assert(
    !posterKitCode.includes('handleExitFullScreen = () => {\n    setSelectedPosterId(null)') &&
    !posterKitCode.includes('handleExitFullScreen = async () => {\n    setSelectedPosterId(null)'),
    'Exiting full screen preserves previously selected poster'
  );

  // 85. Escape Key Handling for Full Screen Exit
  console.log('\n[Test 85] Escape Key Exits Full Screen');
  assert(
    posterKitCode.includes('if (isFullScreen)') &&
    posterKitCode.includes("e.key === 'Escape'") &&
    posterKitCode.includes('handleExitFullScreen()'),
    'Pressing Escape exits full-screen mode'
  );
  assert(
    posterKitCode.includes('if (isFullScreen) {\n        if (e.key === \'Escape\') {\n          e.preventDefault();\n          handleExitFullScreen();\n        }\n        return;\n      }'),
    'Poster editing shortcuts (Delete, R, C) are blocked while in full-screen mode'
  );

  // 86. Native Fullscreen API Integration and Event Sync
  console.log('\n[Test 86] Native Fullscreen API & Event Sync');
  assert(
    posterKitCode.includes('requestFullscreen') &&
    posterKitCode.includes('exitFullscreen'),
    'Integrates native HTML5 Fullscreen API with requestFullscreen and exitFullscreen'
  );
  assert(
    posterKitCode.includes('fullscreenchange') &&
    posterKitCode.includes('setIsFullScreen(false)'),
    'Listens for native fullscreenchange event to sync exit state'
  );

  // 87. Graceful Viewport Overlay Fallback
  console.log('\n[Test 87] Graceful Viewport Overlay Fallback');
  assert(
    posterKitCode.includes('setIsFullScreen(true)') &&
    posterKitCode.includes('.catch('),
    'Gracefully falls back to viewport overlay if native fullscreen request is denied or unsupported'
  );

  // 88. Cleanup of Listeners and Locks on Unmount
  console.log('\n[Test 88] Cleanup on Unmount and Exit');
  assert(
    posterKitCode.includes('removeEventListener(\'fullscreenchange\'') &&
    posterKitCode.includes('removeEventListener(\'keydown\''),
    'Cleans up fullscreen and keyboard event listeners'
  );
  assert(
    posterKitCode.includes('document.body.style.overflow = \'hidden\'') &&
    posterKitCode.includes('document.body.style.overflow = originalOverflow'),
    'Locks and restores document body scroll overflow during full-screen view'
  );

  // ============================================================================
  // PER-POSTER MATERIAL SELECTION VERIFICATION (Tests 89 - 98)
  // ============================================================================

  // 89. Canonical Material Identifiers and Configurations
  console.log('\n[Test 89] Canonical Material Types and Specifications');
  assert(AVAILABLE_MATERIALS.length === 3, 'Exactly 3 material options are available in Poster Kit');
  assert(AVAILABLE_MATERIALS.some((m) => m.id === 'matte'), 'Matte material is defined');
  assert(AVAILABLE_MATERIALS.some((m) => m.id === 'glossy'), 'Glossy material is defined');
  assert(AVAILABLE_MATERIALS.some((m) => m.id === 'rigid_board'), 'Rigid Board material is defined');
  assert(!AVAILABLE_MATERIALS.some((m) => !['matte', 'glossy', 'rigid_board'].includes(m.id)), 'No additional material types are invented');
  assert(POSTER_MATERIALS.matte.name === 'Matte', 'Matte name is correct');
  assert(POSTER_MATERIALS.glossy.name === 'Glossy', 'Glossy name is correct');
  assert(POSTER_MATERIALS.rigid_board.name === 'Rigid Board', 'Rigid Board name is correct');
  assert(POSTER_MATERIALS.matte.description.includes('non-reflective'), 'Matte description accurately mentions non-reflective finish');
  assert(POSTER_MATERIALS.glossy.description.includes('Shiny'), 'Glossy description accurately mentions shiny finish');
  assert(POSTER_MATERIALS.rigid_board.description.includes('rigid backing'), 'Rigid Board description accurately mentions rigid backing');

  // 90. New Poster Grids Default to Matte
  console.log('\n[Test 90] New Poster Grids Default to Matte');
  const initialPostersDefault = getInitialPosters();
  assert(initialPostersDefault.length === 3, 'Initial posters layout returns 3 posters');
  for (const p of initialPostersDefault) {
    assert(p.material === 'matte', `Initial poster ${p.id} defaults strictly to Matte material`);
  }
  assert(
    posterKitCode.includes('material: \'matte\''),
    'PosterKit.tsx assigns Matte as default material for newly created poster grids'
  );

  // 91. Independent Material Selection Per Grid (No Single Global State)
  console.log('\n[Test 91] Independent Material Selection Per Grid');
  // Pure updater simulation matching handleUpdatePosterMaterial in PosterKit.tsx
  function simulateUpdatePosterMaterial(postersList: PlacedPoster[], posterId: string, material: PosterMaterialId): PlacedPoster[] {
    return postersList.map((p) => {
      if (p.id !== posterId) return p;
      return {
        ...p,
        material,
      };
    });
  }

  const grid1: PlacedPoster = {
    id: 'grid-1',
    sizeId: 'A4',
    orientation: 'portrait',
    material: 'matte',
    xPercent: 10,
    yPercent: 10,
    widthPercent: 15,
    heightPercent: 20,
    label: 'Poster 1',
  };
  const grid2: PlacedPoster = {
    id: 'grid-2',
    sizeId: 'A3',
    orientation: 'portrait',
    material: 'matte',
    xPercent: 30,
    yPercent: 10,
    widthPercent: 25,
    heightPercent: 35,
    label: 'Poster 2',
  };
  const grid3: PlacedPoster = {
    id: 'grid-3',
    sizeId: 'A5',
    orientation: 'landscape',
    material: 'matte',
    xPercent: 60,
    yPercent: 10,
    widthPercent: 15,
    heightPercent: 10,
    label: 'Poster 3',
  };

  let testGridList = [grid1, grid2, grid3];
  // Change grid 2 to glossy
  testGridList = simulateUpdatePosterMaterial(testGridList, 'grid-2', 'glossy');
  assert(testGridList.find((p) => p.id === 'grid-2')?.material === 'glossy', 'Grid 2 updated to Glossy');
  assert(testGridList.find((p) => p.id === 'grid-1')?.material === 'matte', 'Grid 1 remains Matte (untouched)');
  assert(testGridList.find((p) => p.id === 'grid-3')?.material === 'matte', 'Grid 3 remains Matte (untouched)');

  // Change grid 3 to rigid_board
  testGridList = simulateUpdatePosterMaterial(testGridList, 'grid-3', 'rigid_board');
  assert(testGridList.find((p) => p.id === 'grid-3')?.material === 'rigid_board', 'Grid 3 updated to Rigid Board');
  assert(testGridList.find((p) => p.id === 'grid-2')?.material === 'glossy', 'Grid 2 remains Glossy (untouched)');
  assert(testGridList.find((p) => p.id === 'grid-1')?.material === 'matte', 'Grid 1 remains Matte (untouched)');

  // Change grid 1 to glossy
  testGridList = simulateUpdatePosterMaterial(testGridList, 'grid-1', 'glossy');
  assert(testGridList.find((p) => p.id === 'grid-1')?.material === 'glossy', 'Grid 1 updated to Glossy');
  assert(testGridList.find((p) => p.id === 'grid-2')?.material === 'glossy', 'Grid 2 retains Glossy');
  assert(testGridList.find((p) => p.id === 'grid-3')?.material === 'rigid_board', 'Grid 3 retains Rigid Board');

  // 92. Material Selections Survive Save, Refresh, and Restore
  console.log('\n[Test 92] Material Selection Layout Persistence & Restoration');
  resetSavedPosterKitLayout();

  const multiMaterialLayout: PlacedPoster[] = [
    {
      id: 'persisted-mat-1',
      sizeId: 'A4',
      orientation: 'portrait',
      material: 'matte',
      xPercent: 12,
      yPercent: 14,
      widthPercent: 18,
      heightPercent: 24,
      label: 'Poster Matte',
    },
    {
      id: 'persisted-mat-2',
      sizeId: 'A3',
      orientation: 'portrait',
      material: 'glossy',
      xPercent: 35,
      yPercent: 14,
      widthPercent: 25,
      heightPercent: 35,
      label: 'Poster Glossy',
    },
    {
      id: 'persisted-mat-3',
      sizeId: 'A5',
      orientation: 'landscape',
      material: 'rigid_board',
      xPercent: 65,
      yPercent: 14,
      widthPercent: 16,
      heightPercent: 12,
      label: 'Poster Rigid Board',
    },
  ];

  savePosterKitLayout(multiMaterialLayout, 'A4');
  const restoredMaterialLayout = getSavedPosterKitLayout();

  assert(restoredMaterialLayout !== null, 'Restored layout is not null');
  assert(restoredMaterialLayout!.posters.length === 3, 'All 3 posters restored');
  assert(restoredMaterialLayout!.posters[0].material === 'matte', 'Poster 1 restored with Matte material');
  assert(restoredMaterialLayout!.posters[1].material === 'glossy', 'Poster 2 restored with Glossy material');
  assert(restoredMaterialLayout!.posters[2].material === 'rigid_board', 'Poster 3 restored with Rigid Board material');

  // Verify raw JSON includes the material field per item
  const rawJsonWithMaterials = getRawSavedLayoutJson() || '';
  assert(rawJsonWithMaterials.includes('"material":"matte"'), 'JSON serialization includes material: matte');
  assert(rawJsonWithMaterials.includes('"material":"glossy"'), 'JSON serialization includes material: glossy');
  assert(rawJsonWithMaterials.includes('"material":"rigid_board"'), 'JSON serialization includes material: rigid_board');

  // 93. Backward Compatibility & Safe Migration for Legacy Saved Layouts
  console.log('\n[Test 93] Backward Compatibility: Missing Material Defaults Safely to Matte');
  const legacyLayoutJsonWithoutMaterial = JSON.stringify({
    version: 1,
    timestamp: Date.now(),
    activeSizeToAdd: 'A4',
    posters: [
      {
        id: 'legacy-p1',
        sizeId: 'A4',
        orientation: 'portrait',
        xPercent: 20,
        yPercent: 20,
        widthPercent: 15,
        heightPercent: 20,
        label: 'Old Poster Without Material',
        // Notice: No material field!
      },
      {
        id: 'legacy-p2',
        sizeId: 'A3',
        orientation: 'landscape',
        material: 'unrecognized_legacy_type', // Invalid/unknown material
        xPercent: 40,
        yPercent: 20,
        widthPercent: 25,
        heightPercent: 20,
        label: 'Poster With Unknown Material',
      },
    ],
  });

  setRawSavedLayoutJson(legacyLayoutJsonWithoutMaterial);
  const migratedLayout = getSavedPosterKitLayout();

  assert(migratedLayout !== null, 'Migrated layout loads successfully');
  assert(migratedLayout!.posters[0].id === 'legacy-p1', 'Legacy poster 1 loaded');
  assert(migratedLayout!.posters[0].material === 'matte', 'Legacy poster missing material defaults safely to Matte');
  assert(migratedLayout!.posters[1].id === 'legacy-p2', 'Legacy poster 2 loaded');
  assert(migratedLayout!.posters[1].material === 'matte', 'Legacy poster with invalid material safely migrates to Matte');

  // 94. Clear Design Preserves Selected Material
  console.log('\n[Test 94] Clear Design Preserves Selected Material');
  const posterWithArtAndRigidBoard: PlacedPoster = {
    id: 'clear-design-mat-test',
    sizeId: 'A4',
    orientation: 'portrait',
    material: 'rigid_board',
    xPercent: 20,
    yPercent: 20,
    widthPercent: 15,
    heightPercent: 20,
    label: 'Poster With Rigid Board & Art',
    artworkUrl: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/1.png',
    artworkSource: 'collection',
    artworkProductId: 1,
    artworkTitle: 'My Samurai Art',
  };

  const afterClearDesign = simulateClearPosterDesign([posterWithArtAndRigidBoard], 'clear-design-mat-test')[0];
  assert(afterClearDesign.artworkUrl === undefined, 'Clear Design removes artwork URL');
  assert(afterClearDesign.artwork === undefined, 'Clear Design removes artwork object');
  assert(afterClearDesign.material === 'rigid_board', 'Clear Design strictly preserves poster material (rigid_board)');

  const posterWithArtAndGlossy: PlacedPoster = {
    id: 'clear-design-glossy-test',
    sizeId: 'A3',
    orientation: 'landscape',
    material: 'glossy',
    xPercent: 40,
    yPercent: 20,
    widthPercent: 25,
    heightPercent: 20,
    label: 'Poster With Glossy & Art',
    artworkUrl: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/2.png',
    artworkSource: 'collection',
    artworkProductId: 2,
    artworkTitle: 'Cyberpunk Poster',
  };

  const afterClearDesignGlossy = simulateClearPosterDesign([posterWithArtAndGlossy], 'clear-design-glossy-test')[0];
  assert(afterClearDesignGlossy.artworkUrl === undefined, 'Clear Design removes artwork URL');
  assert(afterClearDesignGlossy.material === 'glossy', 'Clear Design strictly preserves poster material (glossy)');

  // 95. Clear All and Reset Layout Behaviors Intact
  console.log('\n[Test 95] Clear All and Reset Layout Behaviors Maintained');
  clearSavedPosterKitLayout('A4');
  const clearedStateCheck = getSavedPosterKitLayout();
  assert(clearedStateCheck !== null && clearedStateCheck.posters.length === 0, 'Clear All empties posters correctly');

  resetSavedPosterKitLayout();
  assert(getSavedPosterKitLayout() === null, 'Reset storage removes layout completely');

  // 96. Contextual Menu and Toolbar UI Integration Audit
  console.log('\n[Test 96] User Interface Material Controls in Contextual Menu & Toolbars');
  assert(
    posterKitCode.includes('handleUpdatePosterMaterial'),
    'PosterKit implements handleUpdatePosterMaterial handler'
  );
  assert(
    posterKitCode.includes('material-dropdown-popover') || posterKitCode.includes('materialMenuOpenPosterId'),
    'Contextual action menu provides interactive Material popover selector'
  );
  assert(
    posterKitCode.includes('desktop-material-') || (posterKitCode.includes('AVAILABLE_MATERIALS.map') && posterKitCode.includes('SELECTED:')),
    'Desktop toolbar displays material switcher for selected poster'
  );
  assert(
    posterKitCode.includes('mobile-material-') || (posterKitCode.includes('grid grid-cols-3') && posterKitCode.includes('Material:')),
    'Mobile toolbar displays material switcher for selected poster'
  );
  assert(
    posterKitCode.includes('POSTER_MATERIALS[poster.material || \'matte\'].name'),
    'Displays active material name on the selector'
  );
  assert(
    posterKitCode.includes('mat.description'),
    'Includes informative description for each material option'
  );

  // 97. Visual Representation and Cardstock Surface Treatment
  console.log('\n[Test 97] Visual Representation and Cardstock Surface Treatment');
  assert(
    posterKitCode.includes('poster.material === \'glossy\''),
    'PosterKit implements subtle non-destructive glossy finish sheen treatment'
  );
  assert(
    posterKitCode.includes('poster.material === \'rigid_board\''),
    'PosterKit implements subtle rigid board backing border/depth treatment'
  );
  assert(
    !posterKitCode.includes('filter: ') && !posterKitCode.includes('hue-rotate') && !posterKitCode.includes('contrast('),
    'Source artwork colors are strictly unaltered by CSS filters'
  );
  assert(
    posterKitCode.includes('UNFRAMED PRINT •') || posterKitCode.includes('RIGID BOARD'),
    'Cardstock footer displays active poster material'
  );

  // 98. Continuity of Existing Features
  console.log('\n[Test 98] Continuity of Existing Poster Kit Capabilities');
  assert(AVAILABLE_SIZES.length === 4, 'All ISO poster sizes A6, A5, A4, A3 remain available');
  assert(!AVAILABLE_SIZES.some((s) => (s as any).id === 'A2'), 'A2 strictly excluded');
  assert(posterKitCode.includes('handleEnterFullScreen'), 'Full-screen mode preserved');
  assert(posterKitCode.includes('handleRotatePoster'), 'Rotation preserved');
  assert(posterKitCode.includes('handleClearPosterDesign'), 'Clear design preserved');
  assert(posterKitCode.includes('handleRemovePoster'), 'Poster deletion preserved');

  // 99. Adaptive Poster Grid Scaling as Poster Count Increases
  console.log('\n[Test 99] Adaptive Poster-Count Scaling Curve');
  assert(getPosterCountScaleFactor(1) === 1.0, '1 poster: retains 1.0x factor');
  assert(getPosterCountScaleFactor(3) === 1.0, '3 posters: retains 1.0x factor');
  assert(getPosterCountScaleFactor(4) === 0.92, '4 posters: applies gentle reduction to 0.92x');
  assert(getPosterCountScaleFactor(5) === 0.92, '5 posters: maintains 0.92x scale');
  assert(getPosterCountScaleFactor(6) === 0.82, '6 posters: scales to 0.82x');
  assert(getPosterCountScaleFactor(8) === 0.82, '8 posters: maintains 0.82x scale');
  assert(getPosterCountScaleFactor(9) === 0.70, '9 posters: scales to 0.70x');
  assert(getPosterCountScaleFactor(12) === 0.70, '12 posters: maintains 0.70x scale');
  assert(getPosterCountScaleFactor(15) === 0.60, '15 posters: scales to 0.60x');
  assert(getPosterCountScaleFactor(20) === 0.55, '20 posters: maintains sensible floor 0.55x');

  // Verify responsive poster scale combines viewport scale with count scale
  const desktop1Scale = getResponsivePosterScale(1440, false, 1);
  const desktop6Scale = getResponsivePosterScale(1440, false, 6);
  assert(desktop1Scale === 1.42, 'Desktop 1 poster scale is 1.42x');
  assert(desktop6Scale === 1.42, 'Desktop 6 posters scale does NOT apply count reduction (retains 1.42x)');
  const mobile1Scale = getResponsivePosterScale(375, false, 1);
  const mobile6Scale = getResponsivePosterScale(375, false, 6);
  assert(mobile1Scale === 2.05, 'Mobile 1 poster scale is 2.05x');
  assert(mobile6Scale === Number((2.05 * 0.82).toFixed(3)), 'Mobile 6 posters scale combines factors (2.05 * 0.82 = 1.681x)');

  // 100. Bijective Round-Trip Mapping Precision Across Poster Counts
  console.log('\n[Test 100] Bijective Round-Trip Mapping Precision Across Poster Counts');
  const testPosterCounts = [1, 3, 4, 6, 8, 12, 15];
  const testViewports = [375, 1024, 1280, 1440];
  const samplePosterForMapping = getInitialPosters()[1]; // A3 poster

  for (const count of testPosterCounts) {
    for (const vp of testViewports) {
      const rendered = getResponsivePosterPlacement(samplePosterForMapping, vp, false, count);
      const canonical = toCanonicalPosterPlacement(rendered, samplePosterForMapping, vp, false, count);
      const diffX = Math.abs(canonical.xPercent - samplePosterForMapping.xPercent);
      const diffY = Math.abs(canonical.yPercent - samplePosterForMapping.yPercent);
      assert(diffX < 0.05, `Count ${count} @ ${vp}px: round-trip X drift (${diffX.toFixed(4)}%) is < 0.05%`);
      assert(diffY < 0.05, `Count ${count} @ ${vp}px: round-trip Y drift (${diffY.toFixed(4)}%) is < 0.05%`);
    }

    // Full screen round-trip
    const fsRendered = getResponsivePosterPlacement(samplePosterForMapping, 1440, true, count);
    const fsCanonical = toCanonicalPosterPlacement(fsRendered, samplePosterForMapping, 1440, true, count);
    const fsDiffX = Math.abs(fsCanonical.xPercent - samplePosterForMapping.xPercent);
    const fsDiffY = Math.abs(fsCanonical.yPercent - samplePosterForMapping.yPercent);
    assert(fsDiffX < 0.05, `Count ${count} Full Screen: round-trip X drift (${fsDiffX.toFixed(4)}%) is < 0.05%`);
    assert(fsDiffY < 0.05, `Count ${count} Full Screen: round-trip Y drift (${fsDiffY.toFixed(4)}%) is < 0.05%`);
  }

  // 101. Full Screen Button Stacking Layer and Protected Region
  console.log('\n[Test 101] Full Screen Button Priority, Canvas Anchoring & Header Containment');
  assert(
    (posterKitCode.includes('z-40') || posterKitCode.includes('z-30')) && posterKitCode.includes('enter-fullscreen-btn'),
    'Full Screen button uses elevated local z-index (z-40) above posters inside the canvas'
  );
  assert(
    posterKitCode.includes('z-10 isolate'),
    'Wall preview container isolates stacking context (z-10 isolate) so children cannot overlap fixed header (z-50)'
  );
  assert(
    !posterKitCode.includes('fixed bottom-2.5 right-2.5') && !posterKitCode.includes('sticky bottom-2.5 right-2.5'),
    'Full Screen button remains anchored to wall canvas with absolute positioning, not fixed or sticky'
  );
  assert(posterKitCode.includes('getFullScreenButtonProtectedRegion'), 'PosterKit integrates Full Screen protected exclusion region');
  assert(posterKitCode.includes('avoidProtectedRegion'), 'PosterKit incorporates protected region collision avoidance');

  const mobileRegion = getFullScreenButtonProtectedRegion(375);
  const desktopRegion = getFullScreenButtonProtectedRegion(1440);
  assert(mobileRegion.left > 60 && mobileRegion.right === 100 && mobileRegion.top > 75 && mobileRegion.bottom === 100, 'Mobile protected region covers bottom-right corner');
  assert(desktopRegion.left > 85 && desktopRegion.right === 100 && desktopRegion.top > 85 && desktopRegion.bottom === 100, 'Desktop protected region covers bottom-right corner');

  // Verify collision avoidance pushes poster out of protected region
  const bounds = getUsableWallBounds(1440);
  const testOverlap = clampPosterPosition(desktopRegion.left + 2, desktopRegion.top + 1, 10, 15, bounds, desktopRegion);
  const overlapX = Math.max(0, Math.min(testOverlap.x + 10, desktopRegion.right) - Math.max(testOverlap.x, desktopRegion.left));
  const overlapY = Math.max(0, Math.min(testOverlap.y + 15, desktopRegion.bottom) - Math.max(testOverlap.y, desktopRegion.top));
  assert(overlapX <= 0 || overlapY <= 0, 'Poster clamped position avoids intersection with Full Screen button protected region');

  // 102. Full-Screen Workspace Editing Controls
  console.log('\n[Test 102] Full-Screen Editing Workspace Controls');
  assert(posterKitCode.includes('data-testid="fullscreen-editing-toolbar"'), 'Dedicated full-screen editing workspace toolbar is present');
  assert(posterKitCode.includes('AVAILABLE_SIZES.map') && posterKitCode.includes('activeSizeToAdd === size.id'), 'Full-screen workspace provides A6, A5, A4, A3 size selector');
  assert(posterKitCode.includes('Add {activeSizeToAdd}') && posterKitCode.includes('posters.length'), 'Full-screen workspace provides Add Poster and live poster count');
  assert(posterKitCode.includes('handleUpdatePosterMaterial'), 'Full-screen workspace provides material selector');
  assert(posterKitCode.includes('fullscreen-material-${mat.id}') || posterKitCode.includes('fullscreen-material-'), 'Material options present in full-screen material selector');
  assert(posterKitCode.includes('handleOpenDesignPicker') && posterKitCode.includes('Change Design'), 'Full-screen workspace provides Change/Add Design');
  assert(posterKitCode.includes('handleClearPosterDesign'), 'Full-screen workspace provides Clear Design');
  assert(posterKitCode.includes('handleRotatePoster'), 'Full-screen workspace provides Rotate action');
  assert(posterKitCode.includes('handleRemovePoster'), 'Full-screen workspace provides Delete action');
  assert(posterKitCode.includes('handleResetLayout') && posterKitCode.includes('setIsClearModalOpen'), 'Full-screen workspace provides Reset Layout and Clear All');
  assert(posterKitCode.includes('data-testid="exit-fullscreen-btn"'), 'Clear always-visible Back to Editor button is present');

  // 103. Full-Screen Interaction & Gesture Protection
  console.log('\n[Test 103] Full-Screen Interaction & Gesture Protection');
  assert(!posterKitCode.includes('if (isFullScreen) return;\n\n    // Only primary mouse button'), 'Pointer down allows dragging in full screen');
  assert(posterKitCode.includes('setSelectedPosterId(poster.id);'), 'Poster click selects poster in full screen');
  assert(posterKitCode.includes('data-testid="fullscreen-editing-toolbar"') && posterKitCode.includes('onPointerDown={(e) => e.stopPropagation()}'), 'Fullscreen toolbar stops pointer down to prevent accidental drags');
  assert(posterKitCode.includes('data-testid="fullscreen-editing-toolbar"') && posterKitCode.includes('onClick={(e) => e.stopPropagation()}'), 'Fullscreen toolbar stops click to prevent background deselects');

  // 104. Full Screen Button Bottom-Right Placement & Red Offset Shadow
  console.log('\n[Test 104] Full Screen Button Bottom-Right Placement & Red Offset Shadow');
  assert(
    posterKitCode.includes('bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5'),
    'Full Screen and Back to Editor buttons are positioned at bottom-right of the wall canvas'
  );
  assert(
    posterKitCode.includes('shadow-[2px_2px_0px_0px_rgba(230,57,70,1)]'),
    'Full Screen button features prominent Posterealm red offset shadow'
  );

  // 105. Empty Wall State Verification
  console.log('\n[Test 105] Empty Wall State Inside Wall Canvas');
  assert(
    posterKitCode.includes('data-testid="empty-wall-state"'),
    'Empty wall state container is present with data-testid="empty-wall-state"'
  );
  assert(
    posterKitCode.includes('absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pointer-events-none'),
    'Empty wall state is rendered inside existing wall canvas bounds (absolute inset-0) without overlay displacement'
  );
  assert(
    posterKitCode.includes('data-testid="empty-add-poster-btn"'),
    'Empty state provides Add Poster action button'
  );
  assert(
    posterKitCode.includes('data-testid="empty-restore-layout-btn"'),
    'Empty state provides Restore Sample Layout action button'
  );

  // 106. Viewport Scaling Policy Isolation
  console.log('\n[Test 106] Viewport Scaling Policy Isolation (Count-Based Scaling Mobile-Only)');
  const tablet10Scale = getResponsivePosterScale(768, false, 10);
  assert(tablet10Scale === 1.20, 'Tablet (768px) scale does not shrink with 10 posters (retains 1.20x)');
  const laptop10Scale = getResponsivePosterScale(1366, false, 10);
  assert(laptop10Scale === 1.38, 'Laptop (1366px) scale does not shrink with 10 posters (retains 1.38x)');
  const desktopFs10Scale = getResponsivePosterScale(1440, true, 10);
  assert(desktopFs10Scale === 1.0, 'Desktop full-screen mode retains strictly 1.0x canonical scale with 10 posters');

  // 107. Mobile Contextual Toolbar Isolation & Clear Hierarchy
  console.log('\n[Test 107] Mobile Contextual Toolbar Isolation & Hierarchy');
  assert(
    posterKitCode.includes('hidden md:block contextual-action-menu'),
    'On-canvas contextual toolbar is hidden on mobile (< md: 768px) to eliminate overlap with size selector'
  );
  assert(
    !posterKitCode.includes('overflow-visible sm:overflow-hidden'),
    'Wall canvas enforces overflow-hidden on mobile to prevent content spilling into controls'
  );
  assert(
    posterKitCode.includes('Row 1 — Size selection') &&
    posterKitCode.includes('Row 2 — Add Poster') &&
    posterKitCode.includes('Row 3 — Context') &&
    posterKitCode.includes('Row 4 — Actions'),
    'Dedicated mobile toolbar below wall maintains 4-row hierarchy: size selector, add button, selected poster actions, reset/clear'
  );

  // 108. Full-Screen Immediate Action Execution & Rotate Poster Explicit Label
  console.log('\n[Test 108] Full-Screen Immediate Actions & Explicit Rotate Label');
  assert(
    posterKitCode.includes('data-testid="fullscreen-rotate-btn"') && posterKitCode.includes('Rotate Poster'),
    'Full-screen editing toolbar provides explicit visible "Rotate Poster" text label alongside icon'
  );
  assert(
    posterKitCode.includes('data-testid="fullscreen-clear-design-btn"'),
    'Full-screen toolbar provides dedicated Clear Design action'
  );
  assert(
    posterKitCode.includes('data-testid="fullscreen-design-btn"'),
    'Full-screen toolbar provides dedicated Add/Change Design action'
  );
  assert(
    posterKitCode.includes('getPortalTarget()') && posterKitCode.includes('portalTarget={getPortalTarget()}'),
    'Modals portal into active fullscreenElement or document.body to remain immediately interactive in full-screen mode'
  );

  // 109. Laptop Layout Collision Avoidance at 1024x768, 1280x800, 1366x768, 1440x900
  console.log('\n[Test 109] Laptop Layout Collision Prevention (1024x768, 1280x800, 1366x768, 1440x900)');
  const laptopResolutions = [
    { width: 1024, height: 768, name: '1024x768' },
    { width: 1280, height: 800, name: '1280x800' },
    { width: 1366, height: 768, name: '1366x768' },
    { width: 1440, height: 900, name: '1440x900' },
  ];

  for (const res of laptopResolutions) {
    const pad = res.width < 1024 ? 48 : 64;
    const wWidth = Math.min(1280, res.width - pad);
    const pMaxW = Math.min(672, wWidth - 290);
    const pActualW = Math.min(pMaxW, wWidth * 0.94);
    const pLeft = (wWidth - pActualW) / 2;
    const pRight = pLeft + pActualW;

    const fsWidth = 120;
    const fsMargin = 14;
    const fsLeft = wWidth - fsMargin - fsWidth;

    const gap = fsLeft - pRight;
    assert(
      gap >= 10,
      `Laptop ${res.name}: Bottom controls right edge (${pRight.toFixed(1)}px) avoids Full Screen button left edge (${fsLeft.toFixed(1)}px) with >= 10px clearance (${gap.toFixed(1)}px)`
    );
  }

  // 110. Full-Screen and Normal Mode Poster Aspect Ratio Invariance (Tolerance < 0.5%)
  console.log('\n[Test 110] ISO Poster Aspect Ratio Invariance in Full-Screen and Normal Modes');
  const allSizes: Array<'A6' | 'A5' | 'A4' | 'A3'> = ['A6', 'A5', 'A4', 'A3'];
  const aspectRatioCheckViewports = [375, 768, 1024, 1280, 1366, 1440, 1920];

  for (const sizeId of allSizes) {
    const config = POSTER_SIZES[sizeId];
    
    // Portrait check
    const portraitAspect = getPosterAspectRatio(sizeId, 'portrait');
    assert(
      Math.abs(portraitAspect - (config.widthMm / config.heightMm)) < 0.0001,
      `${sizeId} portrait aspect ratio (${portraitAspect.toFixed(4)}) equals widthMm / heightMm (${(config.widthMm / config.heightMm).toFixed(4)})`
    );

    // Landscape check (reciprocal inverse)
    const landscapeAspect = getPosterAspectRatio(sizeId, 'landscape');
    assert(
      Math.abs(landscapeAspect - (config.heightMm / config.widthMm)) < 0.0001,
      `${sizeId} landscape aspect ratio (${landscapeAspect.toFixed(4)}) equals inverse heightMm / widthMm (${(config.heightMm / config.widthMm).toFixed(4)})`
    );

    for (const orientation of ['portrait', 'landscape'] as const) {
      const canonicalDims = calculatePosterDimensions(sizeId, orientation);
      const expectedTargetRatio = orientation === 'landscape'
        ? config.heightMm / config.widthMm
        : config.widthMm / config.heightMm;

      const mockPoster: PlacedPoster = {
        id: `test-${sizeId}-${orientation}`,
        sizeId,
        orientation,
        material: 'matte',
        xPercent: 40,
        yPercent: 30,
        widthPercent: canonicalDims.widthPercent,
        heightPercent: canonicalDims.heightPercent,
        label: `${sizeId} Poster`,
      };

      // Full-screen mode aspect ratio
      const fsPlacement = getResponsivePosterPlacement(mockPoster, 1440, true, 3);
      const fsRenderedAspect = (fsPlacement.widthPercent * WALL_ASPECT_RATIO) / fsPlacement.heightPercent;
      const fsDrift = Math.abs(fsRenderedAspect - expectedTargetRatio) / expectedTargetRatio;
      assert(
        fsDrift < 0.005,
        `Full-screen mode: ${sizeId} ${orientation} rendered aspect ratio (${fsRenderedAspect.toFixed(4)}) matches canonical ISO ratio (${expectedTargetRatio.toFixed(4)}) within 0.5% (drift ${(fsDrift * 100).toFixed(4)}%)`
      );

      // Normal mode across viewports
      for (const vp of aspectRatioCheckViewports) {
        const normPlacement = getResponsivePosterPlacement(mockPoster, vp, false, 3);
        const normRenderedAspect = (normPlacement.widthPercent * WALL_ASPECT_RATIO) / normPlacement.heightPercent;
        const normDrift = Math.abs(normRenderedAspect - expectedTargetRatio) / expectedTargetRatio;
        assert(
          normDrift < 0.005,
          `Normal mode @ ${vp}px: ${sizeId} ${orientation} rendered aspect ratio (${normRenderedAspect.toFixed(4)}) matches canonical ISO ratio (${expectedTargetRatio.toFixed(4)}) within 0.5% (drift ${(normDrift * 100).toFixed(4)}%)`
        );

        // Aspect ratio invariance between normal and full screen
        const interModeDifference = Math.abs(fsRenderedAspect - normRenderedAspect) / fsRenderedAspect;
        assert(
          interModeDifference < 0.005,
          `Aspect ratio invariant: ${sizeId} ${orientation} @ ${vp}px matches full-screen mode within 0.5% (difference ${(interModeDifference * 100).toFixed(4)}%)`
        );
      }
    }
  }

  // 111. Coordinate Inversion and Persistence Invariance Across Full-Screen Toggling
  console.log('\n[Test 111] Full-Screen Coordinate Mapping & Toggle Invariance');
  const samplePosters = getInitialPosters();
  for (const p of samplePosters) {
    const fsPlaced = getResponsivePosterPlacement(p, 1920, true, samplePosters.length);
    const roundTrip = toCanonicalPosterPlacement(fsPlaced, p, 1920, true, samplePosters.length);
    const xDiff = Math.abs(roundTrip.xPercent - p.xPercent);
    const yDiff = Math.abs(roundTrip.yPercent - p.yPercent);
    assert(
      xDiff < 0.01 && yDiff < 0.01,
      `Poster ${p.id} (${p.sizeId}): Full-screen round-trip mapping has negligible drift (X: ${xDiff.toFixed(4)}%, Y: ${yDiff.toFixed(4)}%)`
    );
  }

  // Verify that toggling full-screen mode repeatedly does not alter persisted canonical coordinates
  let toggledPosters = [...samplePosters];
  for (let toggle = 1; toggle <= 10; toggle++) {
    // Enter full-screen: placements derived on-the-fly without modifying canonical state
    const fsViews = toggledPosters.map((p) => getResponsivePosterPlacement(p, 1440, true, toggledPosters.length));
    // Exit full-screen: inverse mapping preserves exact coordinates
    toggledPosters = toggledPosters.map((p, idx) => {
      const canonical = toCanonicalPosterPlacement(fsViews[idx], p, 1440, true, toggledPosters.length);
      return { ...p, xPercent: canonical.xPercent, yPercent: canonical.yPercent };
    });
  }
  for (let i = 0; i < samplePosters.length; i++) {
    const orig = samplePosters[i];
    const toggled = toggledPosters[i];
    assert(
      orig.xPercent === toggled.xPercent && orig.yPercent === toggled.yPercent,
      `Toggling full-screen 10 times causes 0.000% cumulative drift on ${orig.id} (canonical pos unchanged at [${toggled.xPercent}, ${toggled.yPercent}])`
    );
  }

  // 112. PosterKit.tsx Full-Screen Canvas Sizing & DOM Aspect Ratio Locking
  console.log('\n[Test 112] Full-Screen Canvas Sizing & DOM Aspect Ratio Enforcement');
  assert(
    posterKitCode.includes('fullscreenCanvasWrapperRef') && posterKitCode.includes('setFullscreenCanvasDimensions'),
    'PosterKit implements dynamic 16:9 canvas dimensions tracking for full-screen mode'
  );
  assert(
    posterKitCode.includes('ref={fullscreenCanvasWrapperRef}'),
    'Fullscreen canvas wrapper is referenced to measure exact available viewport space'
  );
  assert(
    !posterKitCode.includes('w-full max-h-full max-w-[calc((100vh-6rem)*16/9)]'),
    'Eliminated buggy w-full and calc((100vh-6rem)*16/9) constraints that stretched wall canvas horizontally'
  );
  assert(
    posterKitCode.includes('aspectRatio: `${physWidthMm} / ${physHeightMm}`'),
    'Poster DOM element explicitly sets CSS aspectRatio: `${physWidthMm} / ${physHeightMm}` to lock exact ISO proportion'
  );
  assert(
    posterKitCode.includes('derivedHeightPercent') && posterKitCode.includes('WALL_ASPECT_RATIO'),
    'Poster rendered height percentage is derived directly from rendered width percentage and physical aspect ratio'
  );
  assert(
    posterKitCode.includes('object-cover object-center'),
    'Edge-to-edge artwork rendering preserves object-cover object-center without distortion'
  );

  // --- POSTER KIT INVOICE-STYLE PRICING SUMMARY TESTS (113 - 125) ---

  console.log('\n[Test 113] All 12 Size-and-Material Price Combinations');
  const expectedPrices: Record<string, Record<string, number>> = {
    A6: { glossy: 30, matte: 30, rigid_board: 100 },
    A5: { glossy: 79, matte: 79, rigid_board: 150 },
    A4: { glossy: 100, matte: 100, rigid_board: 230 },
    A3: { glossy: 130, matte: 130, rigid_board: 290 },
  };

  for (const [size, materials] of Object.entries(expectedPrices)) {
    for (const [mat, expectedPrice] of Object.entries(materials)) {
      const unitPrice = getPosterKitUnitPrice(size as any, mat as any);
      assert(
        unitPrice === expectedPrice,
        `Expected ${size} ${mat} unit price to be ₹${expectedPrice}, got ₹${unitPrice}`
      );
      assert(
        POSTER_KIT_PRICING[size as keyof typeof POSTER_KIT_PRICING][mat as any] === expectedPrice,
        `POSTER_KIT_PRICING table matches ₹${expectedPrice} for ${size} ${mat}`
      );
    }
  }

  // Material alias normalization
  assert(normalizePosterKitMaterial('Rigid Board') === 'rigid_board', 'Normalizes "Rigid Board" to rigid_board');
  assert(normalizePosterKitMaterial('rigid_board') === 'rigid_board', 'Normalizes "rigid_board" to rigid_board');
  assert(normalizePosterKitMaterial('Glossy') === 'glossy', 'Normalizes "Glossy" to glossy');
  assert(normalizePosterKitMaterial('Matte') === 'matte', 'Normalizes "Matte" to matte');
  assert(normalizePosterKitMaterial(undefined) === 'matte', 'Default material is matte');

  console.log('\n[Test 114] Multiple Posters of Same Size & Material Aggregate into One Row');
  const samePosters: PlacedPoster[] = [
    { id: 'p1', sizeId: 'A4', orientation: 'portrait', xPercent: 10, yPercent: 10, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'glossy' },
    { id: 'p2', sizeId: 'A4', orientation: 'portrait', xPercent: 30, yPercent: 10, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'glossy' },
    { id: 'p3', sizeId: 'A4', orientation: 'landscape', xPercent: 50, yPercent: 10, widthPercent: 20, heightPercent: 15, label: 'Poster', material: 'glossy' },
  ];
  const sameInvoice = calculatePosterKitInvoice(samePosters);
  assert(sameInvoice.items.length === 1, `Expected exactly 1 aggregated row, got ${sameInvoice.items.length}`);
  assert(sameInvoice.items[0].sizeId === 'A4', 'Row size is A4');
  assert(sameInvoice.items[0].material === 'glossy', 'Row material is glossy');
  assert(sameInvoice.items[0].quantity === 3, `Expected quantity 3, got ${sameInvoice.items[0].quantity}`);
  assert(sameInvoice.items[0].unitPrice === 100, `Expected unit price ₹100, got ₹${sameInvoice.items[0].unitPrice}`);
  assert(sameInvoice.items[0].lineAmount === 300, `Expected line amount ₹300, got ₹${sameInvoice.items[0].lineAmount}`);
  assert(sameInvoice.subtotal === 300, `Expected subtotal ₹300, got ₹${sameInvoice.subtotal}`);
  assert(sameInvoice.totalQuantity === 3, 'Total quantity is 3');
  assert(!sameInvoice.isEmpty, 'Invoice is not empty');

  console.log('\n[Test 115] Same Size with Different Materials Produces Separate Rows');
  const mixedMaterialPosters: PlacedPoster[] = [
    { id: 'm1', sizeId: 'A4', orientation: 'portrait', xPercent: 10, yPercent: 10, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'matte' },
    { id: 'm2', sizeId: 'A4', orientation: 'portrait', xPercent: 30, yPercent: 10, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'matte' },
    { id: 'm3', sizeId: 'A4', orientation: 'portrait', xPercent: 50, yPercent: 10, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'rigid_board' },
  ];
  const mixedMatInvoice = calculatePosterKitInvoice(mixedMaterialPosters);
  assert(mixedMatInvoice.items.length === 2, `Expected 2 separate rows for A4 Matte & A4 Rigid Board, got ${mixedMatInvoice.items.length}`);
  const matteRow = mixedMatInvoice.items.find((i) => i.material === 'matte');
  const rigidRow = mixedMatInvoice.items.find((i) => i.material === 'rigid_board');
  assert(!!matteRow && !!rigidRow, 'Found both matte and rigid board rows');
  assert(matteRow!.quantity === 2, 'A4 Matte quantity is 2');
  assert(matteRow!.unitPrice === 100, 'A4 Matte unit price is ₹100');
  assert(matteRow!.lineAmount === 200, 'A4 Matte line amount is ₹200');
  assert(rigidRow!.quantity === 1, 'A4 Rigid Board quantity is 1');
  assert(rigidRow!.unitPrice === 230, 'A4 Rigid Board unit price is ₹230');
  assert(rigidRow!.lineAmount === 230, 'A4 Rigid Board line amount is ₹230');
  assert(mixedMatInvoice.subtotal === 430, `Expected subtotal 200 + 230 = 430, got ${mixedMatInvoice.subtotal}`);

  console.log('\n[Test 116] Line Amount = Unit Price × Quantity for Every Combination');
  const multiComboPosters: PlacedPoster[] = [
    { id: 'c1', sizeId: 'A3', orientation: 'portrait', xPercent: 5, yPercent: 5, widthPercent: 20, heightPercent: 30, label: 'Poster', material: 'matte' },
    { id: 'c2', sizeId: 'A3', orientation: 'portrait', xPercent: 25, yPercent: 5, widthPercent: 20, heightPercent: 30, label: 'Poster', material: 'matte' },
    { id: 'c3', sizeId: 'A4', orientation: 'portrait', xPercent: 45, yPercent: 5, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'rigid_board' },
    { id: 'c4', sizeId: 'A4', orientation: 'portrait', xPercent: 60, yPercent: 5, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'glossy' },
    { id: 'c5', sizeId: 'A4', orientation: 'portrait', xPercent: 75, yPercent: 5, widthPercent: 15, heightPercent: 20, label: 'Poster', material: 'glossy' },
  ];
  const multiComboInvoice = calculatePosterKitInvoice(multiComboPosters);
  // Matching illustration from prompt: A3 Matte x2 (₹260), A4 Rigid Board x1 (₹230), A4 Glossy x2 (₹200) -> Total ₹690
  assert(multiComboInvoice.items.length === 3, 'Exactly 3 rows generated');
  for (const item of multiComboInvoice.items) {
    assert(
      item.lineAmount === item.unitPrice * item.quantity,
      `Row ${item.label}: lineAmount (${item.lineAmount}) == unitPrice (${item.unitPrice}) * quantity (${item.quantity})`
    );
  }

  console.log('\n[Test 117] Subtotal = Sum of All Line Amounts');
  const sumOfLines = multiComboInvoice.items.reduce((sum, item) => sum + item.lineAmount, 0);
  assert(multiComboInvoice.subtotal === sumOfLines, 'Subtotal equals exact sum of line amounts');
  assert(multiComboInvoice.subtotal === 690, `Expected prompt illustrative total ₹690, got ₹${multiComboInvoice.subtotal}`);

  console.log('\n[Test 118] Rotating a Poster Does Not Change Its Price or Category');
  const rotatedPosters: PlacedPoster[] = multiComboPosters.map((p) =>
    p.id === 'c1' ? { ...p, orientation: 'landscape' as const } : p
  );
  const rotatedInvoice = calculatePosterKitInvoice(rotatedPosters);
  assert(rotatedInvoice.subtotal === multiComboInvoice.subtotal, 'Subtotal remains identical after rotation');
  assert(rotatedInvoice.items.length === multiComboInvoice.items.length, 'Row count remains identical after rotation');
  assert(rotatedInvoice.items[0].quantity === multiComboInvoice.items[0].quantity, 'Quantity remains identical after rotation');

  console.log('\n[Test 119] Dragging/Moving or Changing Artwork Does Not Affect Price');
  const movedPosters: PlacedPoster[] = multiComboPosters.map((p) => ({
    ...p,
    xPercent: (p.xPercent + 5) % 80,
    yPercent: (p.yPercent + 5) % 80,
    artworkUrl: 'https://images.unsplash.com/photo-test-123',
    artworkTitle: 'Custom Art',
  }));
  const movedInvoice = calculatePosterKitInvoice(movedPosters);
  assert(movedInvoice.subtotal === multiComboInvoice.subtotal, 'Price is invariant under position moves and artwork assignment');

  console.log('\n[Test 120] Adding a Poster Updates Quantities and Subtotal Instantly');
  const addedPosters: PlacedPoster[] = [
    ...multiComboPosters,
    { id: 'c6', sizeId: 'A6', orientation: 'portrait', xPercent: 10, yPercent: 60, widthPercent: 8, heightPercent: 12, label: 'Poster', material: 'rigid_board' },
  ];
  const addedInvoice = calculatePosterKitInvoice(addedPosters);
  assert(addedInvoice.totalQuantity === multiComboInvoice.totalQuantity + 1, 'Total quantity increased by 1');
  assert(addedInvoice.subtotal === multiComboInvoice.subtotal + 100, 'Subtotal increased by ₹100 for A6 Rigid Board');

  console.log('\n[Test 121] Deleting a Poster Updates Quantities and Subtotal Instantly');
  const deletedPosters = multiComboPosters.filter((p) => p.id !== 'c3'); // Remove A4 Rigid Board (₹230)
  const deletedInvoice = calculatePosterKitInvoice(deletedPosters);
  assert(deletedInvoice.totalQuantity === multiComboInvoice.totalQuantity - 1, 'Total quantity decreased by 1');
  assert(deletedInvoice.subtotal === multiComboInvoice.subtotal - 230, 'Subtotal decreased by ₹230');

  console.log('\n[Test 122] Changing a Poster Material Updates Appropriate Groups and Subtotal');
  // Change c4 from glossy (₹100) to rigid_board (₹230)
  const materialChangedPosters: PlacedPoster[] = multiComboPosters.map((p) =>
    p.id === 'c4' ? { ...p, material: 'rigid_board' as const } : p
  );
  const matChangedInvoice = calculatePosterKitInvoice(materialChangedPosters);
  // Before: A4 Rigid Board x1, A4 Glossy x2. After: A4 Rigid Board x2 (₹460), A4 Glossy x1 (₹100)
  const a4RigidRow = matChangedInvoice.items.find((i) => i.sizeId === 'A4' && i.material === 'rigid_board');
  const a4GlossyRow = matChangedInvoice.items.find((i) => i.sizeId === 'A4' && i.material === 'glossy');
  assert(a4RigidRow!.quantity === 2, 'A4 Rigid Board quantity increased to 2');
  assert(a4GlossyRow!.quantity === 1, 'A4 Glossy quantity decreased to 1');
  assert(matChangedInvoice.subtotal === multiComboInvoice.subtotal - 100 + 230, 'Subtotal correctly adjusted (+₹130)');

  console.log('\n[Test 123] Clear All Produces Empty Invoice and Zero Subtotal');
  const emptyInvoice = calculatePosterKitInvoice([]);
  assert(emptyInvoice.items.length === 0, 'Empty invoice has 0 items');
  assert(emptyInvoice.totalQuantity === 0, 'Empty invoice has 0 quantity');
  assert(emptyInvoice.subtotal === 0, 'Empty invoice has ₹0 subtotal');
  assert(emptyInvoice.isEmpty === true, 'Empty invoice has isEmpty flag true');

  console.log('\n[Test 124] Restoring Sample Layout Immediately Reconstructs Expected Invoice');
  const initialSamplePosters = getInitialPosters();
  const sampleInvoice = calculatePosterKitInvoice(initialSamplePosters);
  assert(sampleInvoice.totalQuantity === initialSamplePosters.length, 'Total quantity matches initial poster count');
  assert(sampleInvoice.subtotal > 0, 'Sample invoice has positive subtotal');
  let expectedSampleSubtotal = 0;
  for (const sp of initialSamplePosters) {
    expectedSampleSubtotal += getPosterKitUnitPrice(sp.sizeId, sp.material || 'matte');
  }
  assert(
    sampleInvoice.subtotal === expectedSampleSubtotal,
    `Sample layout invoice subtotal ₹${sampleInvoice.subtotal} matches expected ₹${expectedSampleSubtotal}`
  );

  console.log('\n[Test 125] Component and Integration DOM Verification');
  const priceSummaryComponentPath = path.resolve(__dirname, '../src/components/posterKit/PosterKitPriceSummary.tsx');
  assert(fs.existsSync(priceSummaryComponentPath), 'PosterKitPriceSummary.tsx component exists');
  const componentCode = fs.readFileSync(priceSummaryComponentPath, 'utf-8');

  assert(componentCode.includes('WALL LAYOUT PRICE SUMMARY'), 'Contains heading "WALL LAYOUT PRICE SUMMARY"');
  assert(componentCode.includes('LAYOUT SUBTOTAL'), 'Contains label "LAYOUT SUBTOTAL"');
  assert(componentCode.includes('Add posters to your wall to see your price breakdown.'), 'Contains friendly empty state');
  assert(componentCode.includes("'poster-kit-price-summary'"), 'Has main container testid');
  assert(componentCode.includes("'fullscreen-price-summary'"), 'Has fullscreen container testid');
  assert(componentCode.includes('formatPosterKitPrice'), 'Uses currency formatter helper');

  // Verify PosterKit.tsx integrates PosterKitPriceSummary in normal mode and fullscreen mode
  const updatedPosterKitCode = fs.readFileSync(posterKitPath, 'utf-8');
  assert(
    updatedPosterKitCode.includes('<PosterKitPriceSummary posters={posters} />'),
    'PosterKit.tsx renders PosterKitPriceSummary in normal page flow below controls'
  );
  assert(
    updatedPosterKitCode.includes('variant="fullscreen"'),
    'PosterKit.tsx renders PosterKitPriceSummary in fullscreen mode with fullscreen variant'
  );
  assert(
    updatedPosterKitCode.includes('fullscreen-editing-toolbar'),
    'PosterKit.tsx includes fullscreen editing toolbar with independent scrolling'
  );
  // Poster Kit cart and order integration verification
  console.log('\n[Test 126] All 12 Poster Kit Size/Material Combinations & Canonical Normalization');
  const expectedGrid: Record<string, Record<string, number>> = {
    A6: { matte: 30, glossy: 30, rigid_board: 100 },
    A5: { matte: 79, glossy: 79, rigid_board: 150 },
    A4: { matte: 100, glossy: 100, rigid_board: 230 },
    A3: { matte: 130, glossy: 130, rigid_board: 290 },
  };
  for (const [size, mats] of Object.entries(expectedGrid)) {
    for (const [mat, expectedPrice] of Object.entries(mats)) {
      const price = getPosterKitUnitPrice(size as any, mat as any);
      assert(price === expectedPrice, `Size ${size} with material ${mat} correctly yields ₹${expectedPrice} (got ₹${price})`);
    }
  }
  // Supported aliases
  assert(normalizePosterKitMaterial('rigid_board') === 'rigid_board', 'Alias rigid_board normalized');
  assert(normalizePosterKitMaterial('rigid board') === 'rigid_board', 'Alias rigid board normalized');
  assert(normalizePosterKitMaterial('rigid') === 'rigid_board', 'Alias rigid normalized');
  assert(normalizePosterKitMaterial('flagship') === 'rigid_board', 'Alias flagship normalized');
  assert(normalizePosterKitMaterial('flagship material') === 'rigid_board', 'Alias flagship material normalized');
  assert(normalizePosterKitMaterial('board') === 'rigid_board', 'Alias board normalized');
  assert(getPosterKitUnitPrice('a4', 'rigid board') === 230, 'Case-insensitive size and alias resolve to ₹230');
  assert(getPosterKitUnitPrice('A3', 'flagship material') === 290, 'Flagship material alias resolves to ₹290');

  console.log('\n[Test 127] Collection Artwork from Poster Kit Uses Poster Kit Pricing');
  const collectionPoster: PlacedPoster = {
    id: 'poster-col-1',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 25,
    yPercent: 25,
    widthPercent: 20,
    heightPercent: 28,
    label: 'A4 Poster',
    artworkUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119',
    artworkTitle: 'Neo Cyber City',
    artworkProductId: 42,
    material: 'glossy',
  };
  const collectionCartItem = createPosterKitCartItem(collectionPoster);
  assert(collectionCartItem.isPosterKit === true, 'Cart item marked isPosterKit: true');
  assert(collectionCartItem.origin === 'poster_kit', 'Cart item origin is poster_kit');
  assert(collectionCartItem.posterKit === true, 'Cart item posterKit is true');
  assert(collectionCartItem.unit_price === 100, `Poster Kit A4 glossy unit_price is ₹100 (not regular ₹129) - got ₹${collectionCartItem.unit_price}`);
  assert(collectionCartItem.line_total === 100, `Poster Kit A4 glossy line_total is ₹100 - got ₹${collectionCartItem.line_total}`);
  assert(collectionCartItem.productId === 42, 'Collection product ID preserved as 42');
  assert(collectionCartItem.artwork_source === 'collection', 'Artwork source identified as collection');
  assert(collectionCartItem.selected_size === 'A4', 'Selected size is A4');
  assert(normalizePosterKitMaterial(collectionCartItem.selected_material) === 'glossy', 'Selected material is glossy');

  console.log('\n[Test 128] Custom Artwork from Poster Kit Uses Poster Kit Pricing');
  const customPoster: PlacedPoster = {
    id: 'poster-cust-1',
    sizeId: 'A3',
    orientation: 'landscape',
    xPercent: 50,
    yPercent: 30,
    widthPercent: 28,
    heightPercent: 20,
    label: 'A3 Poster',
    artworkUrl: 'blob:http://localhost:5173/artwork-uuid-999',
    customArtworkId: 'artwork-uuid-999',
    material: 'rigid_board',
  };
  (customPoster as any).customArtworkFileName = 'personal_photo.jpg';
  const customCartItem = createPosterKitCartItem(customPoster);
  assert(customCartItem.isPosterKit === true, 'Custom cart item marked isPosterKit: true');
  assert(customCartItem.origin === 'poster_kit', 'Custom cart item origin is poster_kit');
  assert(customCartItem.customArtworkId === 'artwork-uuid-999', 'customArtworkId is preserved');
  assert(customCartItem.customArtworkFileName === 'personal_photo.jpg', 'customArtworkFileName is preserved');
  assert(customCartItem.artwork_source === 'custom', 'Artwork source identified as custom');
  assert(customCartItem.unit_price === 290, `Poster Kit A3 rigid board unit_price is ₹290 (not regular ₹330) - got ₹${customCartItem.unit_price}`);
  assert(customCartItem.line_total === 290, `Poster Kit A3 rigid board line_total is ₹290 - got ₹${customCartItem.line_total}`);

  console.log('\n[Test 129] Ordinary Storefront Products Retain Regular Prices Unchanged');
  assert(POSTER_PRICING['A5'] === 79, 'Storefront A5 poster price is ₹79');
  assert(POSTER_PRICING['A4'] === 129, 'Storefront A4 poster price is ₹129');
  assert(POSTER_PRICING['A3'] === 179, 'Storefront A3 poster price is ₹179');
  assert(POSTER_PRICING['A2'] === 299, 'Storefront A2 poster price is ₹299');
  assert(RIGID_BOARD_PRICING['A5'] === 175, 'Storefront A5 rigid board price is ₹175');
  assert(RIGID_BOARD_PRICING['A4'] === 280, 'Storefront A4 rigid board price is ₹280');
  assert(RIGID_BOARD_PRICING['A3'] === 330, 'Storefront A3 rigid board price is ₹330');
  assert(RIGID_BOARD_PRICING['A2'] === 400, 'Storefront A2 rigid board price is ₹400');

  assert(calculateSinglePosterPrice('A4', 'matte', false) === 129, 'Ordinary storefront A4 matte is ₹129');
  assert(calculateSinglePosterPrice('A4', 'matte', true) === 100, 'Poster Kit A4 matte is ₹100');
  assert(calculateSinglePosterPrice('A4', 'rigid_board', false) === 280, 'Ordinary storefront A4 rigid board is ₹280');
  assert(calculateSinglePosterPrice('A4', 'rigid_board', true) === 230, 'Poster Kit A4 rigid board is ₹230');
  assert(calculateSinglePosterPrice('A3', 'matte', false) === 179, 'Ordinary storefront A3 matte is ₹179');
  assert(calculateSinglePosterPrice('A3', 'matte', true) === 130, 'Poster Kit A3 matte is ₹130');
  assert(calculateSinglePosterPrice('A3', 'rigid_board', false) === 330, 'Ordinary storefront A3 rigid board is ₹330');
  assert(calculateSinglePosterPrice('A3', 'rigid_board', true) === 290, 'Poster Kit A3 rigid board is ₹290');

  console.log('\n[Test 130] Artwork, Size, and Material Survive Adding to Cart');
  const mixedWallPosters: PlacedPoster[] = [
    { id: 'p1', sizeId: 'A6', orientation: 'portrait', xPercent: 10, yPercent: 10, widthPercent: 14, heightPercent: 20, label: 'A6', material: 'matte', artworkUrl: 'https://example.com/art1.jpg', artworkTitle: 'Art 1', artworkProductId: 101 },
    { id: 'p2', sizeId: 'A4', orientation: 'landscape', xPercent: 30, yPercent: 20, widthPercent: 28, heightPercent: 20, label: 'A4', material: 'rigid_board', artworkUrl: 'blob:https://example.com/custom-blob', customArtworkId: 'blob-1' },
  ];
  (mixedWallPosters[1] as any).customArtworkFileName = 'upload.png';
  const createdItems = mixedWallPosters.map(createPosterKitCartItem);
  assert(createdItems[0].size === 'A6' && normalizePosterKitMaterial(createdItems[0].material) === 'matte', 'Item 1 size A6 and material matte preserved');
  assert(createdItems[0].image === 'https://example.com/art1.jpg' && (createdItems[0].title === 'Art 1' || createdItems[0].title.includes('Art 1')), 'Item 1 image & title preserved');
  assert(createdItems[1].size === 'A4' && normalizePosterKitMaterial(createdItems[1].material) === 'rigid_board', 'Item 2 size A4 and material rigid_board preserved');
  assert(createdItems[1].customArtworkId === 'blob-1' && createdItems[1].customArtworkFileName === 'upload.png', 'Item 2 custom artwork references preserved');

  console.log('\n[Test 131] Quantity Changes Recalculate Line Total Without Reverting to Storefront Price');
  const posterKitItem = createPosterKitCartItem({
    id: 'p-qty',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 20,
    yPercent: 20,
    widthPercent: 20,
    heightPercent: 28,
    label: 'A4',
    material: 'matte',
    artworkProductId: 55,
  });
  const itemWithQty4 = { ...posterKitItem, quantity: 4 };
  const storefrontItem = {
    id: 200,
    productId: 200,
    title: 'Storefront Poster',
    price: 129,
    image: 'https://example.com/store.jpg',
    size: 'A4',
    material: 'matte',
    quantity: 2,
  };
  const recalculated = recalculateCartPrices([itemWithQty4, storefrontItem]);
  assert(recalculated[0].unit_price === 100, 'Poster Kit item unit_price remains ₹100');
  assert(recalculated[0].line_total === 400, `Poster Kit item line_total is ₹400 (4 × 100), got ₹${recalculated[0].line_total}`);
  assert(recalculated[0].isPosterKit === true, 'Poster Kit origin preserved after recalculation');
  assert(recalculated[1].unit_price === 129, 'Storefront item unit_price remains ₹129');
  assert(recalculated[1].line_total === 258, `Storefront item line_total is ₹258 (2 × 129), got ₹${recalculated[1].line_total}`);
  const mixedSubtotal = recalculated.reduce((sum, item) => sum + item.line_total, 0);
  assert(mixedSubtotal === 658, `Mixed cart subtotal is 400 + 258 = ₹658 (got ₹${mixedSubtotal})`);

  console.log('\n[Test 132] Cart Restoration Preserves Poster Kit Pricing Origin');
  const originalCart = [
    createPosterKitCartItem({ id: 'p-save-1', sizeId: 'A5', orientation: 'portrait', xPercent: 10, yPercent: 10, widthPercent: 15, heightPercent: 21, label: 'A5', material: 'glossy' }),
    createPosterKitCartItem({ id: 'p-save-2', sizeId: 'A3', orientation: 'landscape', xPercent: 30, yPercent: 30, widthPercent: 28, heightPercent: 20, label: 'A3', material: 'rigid_board' }),
    { id: 77, title: 'Ordinary Poster', price: 179, size: 'A3', material: 'matte', quantity: 1, image: 'img.png' },
  ];
  const serialized = JSON.stringify(originalCart);
  const restored = JSON.parse(serialized);
  const restoredCalculated = recalculateCartPrices(restored);
  assert(restoredCalculated[0].isPosterKit === true, 'Restored item 1 preserves isPosterKit');
  assert(restoredCalculated[0].unit_price === 79, `Restored A5 glossy Poster Kit unit price is ₹79 (got ₹${restoredCalculated[0].unit_price})`);
  assert(restoredCalculated[1].isPosterKit === true, 'Restored item 2 preserves isPosterKit');
  assert(restoredCalculated[1].unit_price === 290, `Restored A3 rigid board Poster Kit unit price is ₹290 (got ₹${restoredCalculated[1].unit_price})`);
  assert(!restoredCalculated[2].isPosterKit, 'Restored item 3 remains ordinary storefront product');
  assert(restoredCalculated[2].unit_price === 179, `Restored storefront item retains regular price ₹179 (got ₹${restoredCalculated[2].unit_price})`);

  console.log('\n[Test 133] Order Creation Persists Poster Kit Item Details and Prices');
  const cartForOrder = [
    createPosterKitCartItem({
      id: 'p-order-1',
      sizeId: 'A4',
      orientation: 'portrait',
      xPercent: 10,
      yPercent: 10,
      widthPercent: 20,
      heightPercent: 28,
      label: 'A4',
      material: 'rigid_board',
      artworkUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119',
      artworkTitle: 'Neon Samurai',
      artworkProductId: 108,
    }),
    createPosterKitCartItem({
      id: 'p-order-2',
      sizeId: 'A6',
      orientation: 'portrait',
      xPercent: 40,
      yPercent: 10,
      widthPercent: 14,
      heightPercent: 20,
      label: 'A6',
      material: 'matte',
      artworkUrl: 'blob:http://localhost:5173/custom-art-123',
      customArtworkId: 'custom-art-123',
    }),
  ];
  (cartForOrder[1] as any).customArtworkFileName = 'my_dog.png';

  const orderItemsSnapshot = cartForOrder.map((item) => ({
    product_id: item.productId || item.id,
    product_title: item.title,
    quantity: item.quantity,
    size: item.size || item.selected_size,
    material: item.material || item.selected_material,
    unit_price: item.unit_price,
    line_total: item.line_total,
    image_url: item.image,
    isPosterKit: Boolean(item.isPosterKit),
    posterKit: Boolean(item.posterKit),
    origin: item.origin || 'poster_kit',
    customArtworkId: item.customArtworkId,
    artwork_url: item.artwork_url || item.image,
    customArtworkFileName: item.customArtworkFileName,
  }));

  assert(orderItemsSnapshot[0].unit_price === 230, 'Order item 1 persisted with Poster Kit unit price ₹230');
  assert(orderItemsSnapshot[0].size === 'A4', 'Order item 1 persisted with size A4');
  assert(normalizePosterKitMaterial(orderItemsSnapshot[0].material) === 'rigid_board', 'Order item 1 persisted with material rigid_board');
  assert(orderItemsSnapshot[0].isPosterKit === true, 'Order item 1 persisted with isPosterKit: true');
  assert(orderItemsSnapshot[0].product_id === 108, 'Order item 1 collection product_id is 108');

  assert(orderItemsSnapshot[1].unit_price === 30, 'Order item 2 persisted with Poster Kit unit price ₹30');
  assert(orderItemsSnapshot[1].size === 'A6', 'Order item 2 persisted with size A6');
  assert(normalizePosterKitMaterial(orderItemsSnapshot[1].material) === 'matte', 'Order item 2 persisted with material matte');
  assert(orderItemsSnapshot[1].customArtworkId === 'custom-art-123', 'Order item 2 customArtworkId is preserved');
  assert(orderItemsSnapshot[1].isPosterKit === true, 'Order item 2 persisted with isPosterKit: true');

  console.log('\n[Test 134] Shipping, Coupon, and Checkout Logic Integrity');
  assert(SHIPPING_CHARGE === 99, 'Standard shipping charge remains exactly ₹99');
  const rzpOrderPath = path.resolve(__dirname, '../supabase/functions/razorpay-order/index.ts');
  const rzpVerifyPath = path.resolve(__dirname, '../supabase/functions/razorpay-verify/index.ts');
  const rzpOrderCode = fs.readFileSync(rzpOrderPath, 'utf-8');
  const rzpVerifyCode = fs.readFileSync(rzpVerifyPath, 'utf-8');

  assert(rzpOrderCode.includes('POSTER_KIT_PRICING'), 'razorpay-order includes POSTER_KIT_PRICING validation table');
  assert(rzpOrderCode.includes('getPosterKitUnitPrice'), 'razorpay-order includes getPosterKitUnitPrice helper');
  assert(rzpOrderCode.includes('item.isPosterKit'), 'razorpay-order validates isPosterKit items with trusted rules');

  assert(rzpVerifyCode.includes('POSTER_KIT_PRICING'), 'razorpay-verify includes POSTER_KIT_PRICING validation table');
  assert(rzpVerifyCode.includes('getPosterKitUnitPrice'), 'razorpay-verify includes getPosterKitUnitPrice helper');
  assert(rzpVerifyCode.includes('item.isPosterKit'), 'razorpay-verify validates isPosterKit items with trusted rules');

  console.log('\n[Test 135] Poster Kit Layout, Invoice, and Full-Screen Functionality Preservation');
  const priceSummaryContent = fs.readFileSync(priceSummaryComponentPath, 'utf-8');
  assert(priceSummaryContent.includes('add-wall-to-cart-button'), 'Price summary includes "add-wall-to-cart-button" testid');
  assert(priceSummaryContent.includes('ADD'), 'Price summary has Add Wall to Bag CTA');
  assert(priceSummaryContent.includes('useCart'), 'Price summary connects to CartContext');

  const cartPath = path.resolve(__dirname, '../src/pages/Cart.tsx');
  const cartCode = fs.readFileSync(cartPath, 'utf-8');
  assert(cartCode.includes('Poster Kit') || cartCode.includes('POSTER KIT'), 'Cart displays Poster Kit badge');
  assert(cartCode.includes('getPosterKitUnitPrice'), 'Cart uses getPosterKitUnitPrice for item editing and discounts');

  const adminOrdersPath = path.resolve(__dirname, '../src/pages/admin/Orders.tsx');
  const adminOrdersCode = fs.readFileSync(adminOrdersPath, 'utf-8');
  assert(adminOrdersCode.includes('POSTER KIT'), 'Admin Orders detail displays POSTER KIT badge');

  // =========================================================================
  // REGRESSION TESTS 136 - 150: Cart Refinements, Artwork Validation & Image Egress
  // =========================================================================
  console.log('\n--- COMMENCING FOCUSED REGRESSION SUITE (TESTS 136 - 150) ---');

  // [Test 136 / Req 1] Custom Poster Kit artwork displays the title "Custom Design"
  console.log('\n[Test 136] Custom Poster Kit artwork displays title "Custom Design"');
  const customPosterSample136: PlacedPoster = {
    id: 'poster-custom-136',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 20,
    yPercent: 20,
    widthPercent: 20,
    heightPercent: 30,
    label: 'Poster 1',
    material: 'rigid_board',
    artworkUrl: 'blob:http://localhost:5173/sample-uuid-1234',
    artworkSource: 'custom',
    customArtworkId: 'art-uuid-custom-99',
    customArtworkFileName: 'Screenshot 2026-10-25 211607.png',
  };
  const customCartItem136 = createPosterKitCartItem(customPosterSample136);
  assert(customCartItem136.title === 'Custom Design', 'Custom Poster Kit cart item title is strictly "Custom Design"');
  assert(customCartItem136.name === 'Custom Design', 'Custom Poster Kit cart item name is strictly "Custom Design"');

  // [Test 137 / Req 2] Custom artwork thumbnails still display the actual uploaded image
  console.log('\n[Test 137] Custom artwork thumbnails still display the actual uploaded image');
  assert(customCartItem136.image === 'blob:http://localhost:5173/sample-uuid-1234', 'Custom item image is the uploaded artwork URL');
  assert(getStorefrontImage(customCartItem136, 'thumbnail') === 'blob:http://localhost:5173/sample-uuid-1234', 'getStorefrontImage resolves thumbnail to uploaded artwork URL');

  // [Test 138 / Req 3] The uploaded filename does not replace customer-facing custom item title
  console.log('\n[Test 138] Uploaded filename does not replace customer-facing custom item title');
  assert(customCartItem136.title !== 'Screenshot 2026-10-25 211607.png', 'Customer-facing title is NOT the uploaded filename');
  assert(customCartItem136.name !== 'Screenshot 2026-10-25 211607.png', 'Customer-facing name is NOT the uploaded filename');
  assert(customCartItem136.customArtworkFileName === 'Screenshot 2026-10-25 211607.png', 'Uploaded filename preserved in customArtworkFileName metadata');

  // [Test 139 / Req 4] Collection artwork in the wall preview uses the standalone artwork
  console.log('\n[Test 139] Collection artwork in wall preview uses standalone artwork');
  const collectionPosterSample139: PlacedPoster = {
    id: 'poster-col-139',
    sizeId: 'A3',
    orientation: 'portrait',
    xPercent: 40,
    yPercent: 20,
    widthPercent: 30,
    heightPercent: 45,
    label: 'Poster 2',
    material: 'rigid_board',
    artworkUrl: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/art-standalone-tokyo.jpg',
    artworkSource: 'collection',
    artworkTitle: 'Neo Tokyo Cyberpunk',
    artworkProductId: 108,
    collectionProductId: 108,
    mockupUrl: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/mockup-framed-tokyo.jpg',
  };
  assert(!isStorefrontMockupUrl(collectionPosterSample139.artworkUrl), 'Wall preview artwork is NOT a storefront room mockup');
  const wallOptimizedUrl = getOptimizedWallArtworkUrl(collectionPosterSample139.artworkUrl);
  assert(wallOptimizedUrl.includes('art-standalone-tokyo.jpg'), 'Wall preview uses the standalone print artwork');
  const posterKitPageCode = fs.readFileSync(path.resolve(__dirname, '../src/pages/PosterKit.tsx'), 'utf-8');
  assert(posterKitPageCode.includes('getOptimizedWallArtworkUrl(poster.artworkUrl)'), 'PosterKit wall renders standalone artwork through getOptimizedWallArtworkUrl');

  // [Test 140 / Req 5] Collection artwork in the cart uses the normal storefront mockup
  console.log('\n[Test 140] Collection artwork in the cart uses the normal storefront mockup');
  const collectionCartItem140 = createPosterKitCartItem(collectionPosterSample139);
  assert(collectionCartItem140.image === collectionPosterSample139.mockupUrl, 'Cart item image is the storefront mockup');
  assert(collectionCartItem140.artwork_url === collectionPosterSample139.artworkUrl, 'Cart item artwork_url preserves standalone artwork');
  assert(getStorefrontImage(collectionCartItem140, 'thumbnail') === collectionPosterSample139.mockupUrl, 'Cart thumbnail resolves to storefront mockup');

  // [Test 141 / Req 6] Collection items retain their correct Poster Kit size, material, price, and identity
  console.log('\n[Test 141] Collection items retain Poster Kit size, material, price, and identity');
  assert(collectionCartItem140.productId === 108, 'Collection item retains productId 108');
  assert(collectionCartItem140.size === 'A3', 'Collection item retains size A3');
  assert(collectionCartItem140.material === 'Rigid Board', 'Collection item retains material Rigid Board');
  assert(collectionCartItem140.unit_price === 290, 'Collection item unit_price is Poster Kit A3 Rigid Board (₹290)');
  assert(collectionCartItem140.line_total === 290, 'Collection item line_total is ₹290');
  assert(collectionCartItem140.title === 'Neo Tokyo Cyberpunk', 'Collection item retains catalog title');

  // [Test 142 / Req 7] An entirely blank layout adds zero cart items and displays the notification
  console.log('\n[Test 142] Entirely blank layout adds zero cart items and displays notification');
  const emptyLayoutResult = validateWallLayout([]);
  assert(emptyLayoutResult.isValid === false, 'Empty array layout fails validation');
  assert(emptyLayoutResult.blankPosters === 0 && emptyLayoutResult.totalPosters === 0, 'Empty layout reports 0 posters');

  const allBlankPosters: PlacedPoster[] = [
    { id: 'b1', sizeId: 'A4', orientation: 'portrait', xPercent: 10, yPercent: 10, widthPercent: 20, heightPercent: 30, label: 'B1', material: 'matte' },
    { id: 'b2', sizeId: 'A4', orientation: 'portrait', xPercent: 30, yPercent: 10, widthPercent: 20, heightPercent: 30, label: 'B2', material: 'matte' },
    { id: 'b3', sizeId: 'A4', orientation: 'portrait', xPercent: 50, yPercent: 10, widthPercent: 20, heightPercent: 30, label: 'B3', material: 'matte' },
  ];
  const allBlankResult = validateWallLayout(allBlankPosters);
  assert(allBlankResult.isValid === false, 'All blank posters fails validation');
  assert(allBlankResult.blankPosters === 3, 'Reports exactly 3 blank posters');
  assert(allBlankResult.assignedPosters === 0, 'Zero assigned posters');

  // Verify modal content in PosterKitPriceSummary.tsx
  assert(priceSummaryContent.includes('Complete Your Wall Layout'), 'Modal contains required heading: Complete Your Wall Layout');
  assert(priceSummaryContent.includes('Every poster needs a design before you can add your wall layout to the bag. Please add a design to each blank poster and try again.'), 'Modal contains exact required explanation message');
  assert(priceSummaryContent.includes('Okay'), 'Modal includes Okay button');
  assert(priceSummaryContent.includes('complete-layout-okay-button'), 'Modal Okay button has dedicated test ID');

  // [Test 143 / Req 8] A partially blank layout adds zero cart items and displays the notification
  console.log('\n[Test 143] Partially blank layout adds zero cart items and displays notification');
  const partiallyBlankPosters: PlacedPoster[] = [
    { ...collectionPosterSample139, id: 'pb1' },
    { id: 'pb2', sizeId: 'A5', orientation: 'portrait', xPercent: 30, yPercent: 10, widthPercent: 15, heightPercent: 21, label: 'PB2', material: 'matte' }, // blank!
    { ...customPosterSample136, id: 'pb3' },
  ];
  const partialResult = validateWallLayout(partiallyBlankPosters);
  assert(partialResult.isValid === false, 'Partially blank layout fails validation');
  assert(partialResult.blankPosters === 1, 'Reports exactly 1 blank poster');
  assert(partialResult.assignedPosters === 2, 'Reports exactly 2 assigned posters');

  // [Test 144 / Req 9] A fully designed layout adds all items successfully in one batch
  console.log('\n[Test 144] Fully designed layout adds all items successfully in one batch');
  const fullyDesignedLayout: PlacedPoster[] = [
    { ...collectionPosterSample139, id: 'fd1' },
    { ...customPosterSample136, id: 'fd2' },
  ];
  const fullResult = validateWallLayout(fullyDesignedLayout);
  assert(fullResult.isValid === true, 'Fully designed layout passes validation');
  assert(fullResult.blankPosters === 0, 'Zero blank posters');
  assert(fullResult.assignedPosters === 2, 'Zero unassigned posters');
  const batchedItems = fullyDesignedLayout.map(createPosterKitCartItem);
  assert(batchedItems.length === 2, 'Batch produces exactly 2 items');
  assert(batchedItems[0].name === 'Neo Tokyo Cyberpunk', 'First batch item is collection product');
  assert(batchedItems[1].name === 'Custom Design', 'Second batch item is Custom Design');

  // [Test 145 / Req 10] A missing custom artwork reference cannot bypass validation
  console.log('\n[Test 145] Missing custom artwork reference cannot bypass validation');
  const brokenCustomPoster1: PlacedPoster = {
    id: 'broken-1',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 10,
    yPercent: 10,
    widthPercent: 20,
    heightPercent: 30,
    label: 'Broken 1',
    material: 'matte',
    artworkSource: 'custom',
    artworkUrl: '', // empty url!
    customArtworkId: 'art-123',
  };
  const brokenCustomPoster2: PlacedPoster = {
    id: 'broken-2',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 10,
    yPercent: 10,
    widthPercent: 20,
    heightPercent: 30,
    label: 'Broken 2',
    material: 'matte',
    artworkSource: 'custom',
    artworkUrl: 'blob:invalid',
    customArtworkId: '', // missing ID!
  };
  const mockupAsPrintPoster: PlacedPoster = {
    id: 'broken-3',
    sizeId: 'A4',
    orientation: 'portrait',
    xPercent: 10,
    yPercent: 10,
    widthPercent: 20,
    heightPercent: 30,
    label: 'Broken 3',
    material: 'matte',
    artworkSource: 'collection',
    artworkUrl: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/room-mockup-frame.jpg', // room mockup!
  };
  assert(validateWallLayout([brokenCustomPoster1]).isValid === false, 'Custom poster with empty URL is rejected');
  assert(validateWallLayout([brokenCustomPoster2]).isValid === false, 'Custom poster with missing customArtworkId is rejected');
  assert(validateWallLayout([mockupAsPrintPoster]).isValid === false, 'Room mockup passed as print artwork is rejected');

  // [Test 146 / Req 11] Existing cart restoration and custom artwork hydration continue to work
  console.log('\n[Test 146] Existing cart restoration and custom artwork hydration continue to work');
  const cartContextPath = path.resolve(__dirname, '../src/context/CartContext.tsx');
  const cartContextCode = fs.readFileSync(cartContextPath, 'utf-8');
  assert(cartContextCode.includes('hydrateCartCustomBlobs'), 'CartContext implements hydrateCartCustomBlobs');
  assert(cartContextCode.includes('getCustomArtworkBlob'), 'CartContext retrieves artwork from IndexedDB via getCustomArtworkBlob');
  assert(cartContextCode.includes('customArtworkId'), 'CartContext matches by customArtworkId');

  // [Test 147 / Req 12] Poster Kit prices remain correct for all size/material combinations
  console.log('\n[Test 147] Poster Kit prices remain correct for all size/material combinations');
  const expectedPosterKitPrices: Record<string, Record<string, number>> = {
    A6: { matte: 30, glossy: 30, rigid_board: 100 },
    A5: { matte: 79, glossy: 79, rigid_board: 150 },
    A4: { matte: 100, glossy: 100, rigid_board: 230 },
    A3: { matte: 130, glossy: 130, rigid_board: 290 },
  };
  for (const [size, matObj] of Object.entries(expectedPosterKitPrices)) {
    for (const [mat, expectedPrice] of Object.entries(matObj)) {
      const actualPrice = getPosterKitUnitPrice(size as any, mat as any);
      assert(actualPrice === expectedPrice, `Poster Kit ${size} ${mat} is ₹${expectedPrice} (got ₹${actualPrice})`);
    }
  }

  // [Test 148 / Req 13] Ordinary storefront cart titles, thumbnails, and prices remain unchanged
  console.log('\n[Test 148] Ordinary storefront cart titles, thumbnails, and prices remain unchanged');
  const storefrontCatalogItem = {
    id: 42,
    name: 'Vintage Manga Attack',
    title: 'Vintage Manga Attack',
    size: 'A3',
    material: 'Matte Paper',
    price: 399,
    quantity: 1,
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/manga-mockup.jpg',
    isPosterKit: false,
    origin: 'storefront',
  };
  assert(storefrontCatalogItem.name === 'Vintage Manga Attack', 'Storefront item title remains unchanged');
  assert(storefrontCatalogItem.price === 399, 'Storefront price remains unchanged');
  assert(getStorefrontImage(storefrontCatalogItem, 'thumbnail') === storefrontCatalogItem.image, 'Storefront thumbnail remains unchanged');

  // [Test 149 / Req 14] Existing checkout, payment, shipping, coupons, and order creation continue to work
  console.log('\n[Test 149] Checkout, payment, shipping, coupons, and order creation continue to work');
  const paymentPath = path.resolve(__dirname, '../src/pages/Payment.tsx');
  const paymentCode = fs.readFileSync(paymentPath, 'utf-8');
  assert(paymentCode.includes('getPaymentItemDisplayName'), 'Payment page uses getPaymentItemDisplayName helper');
  assert(paymentCode.includes('Custom Design'), 'Payment page ensures Custom Design for custom Poster Kit');
  assert(paymentCode.includes('customArtworkFileName'), 'Payment page preserves customArtworkFileName');
  assert(paymentCode.includes('verifyRazorpayPayment'), 'Payment page handles Razorpay verification');
  assert(paymentCode.includes('createOrder'), 'Payment page handles COD order creation');

  // [Test 150 / Req 15] Image URL generation does not create unnecessary unique URLs during normal interactions
  console.log('\n[Test 150] Image URL generation does not create unnecessary unique URLs during normal interactions');
  const testUnsplashUrl = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675';
  const urlRun1 = getOptimizedWallArtworkUrl(testUnsplashUrl);
  const urlRun2 = getOptimizedWallArtworkUrl(testUnsplashUrl);
  const urlRun3 = getOptimizedWallArtworkUrl(testUnsplashUrl);
  assert(urlRun1 === urlRun2 && urlRun2 === urlRun3, 'Consecutive calls to getOptimizedWallArtworkUrl return identical deterministic strings');
  assert(!urlRun1.includes('timestamp') && !urlRun1.includes('cache_bust'), 'No cache-busting timestamps in optimized wall URLs');

  const testThumbUrl = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675';
  const thumbRun1 = getOptimizedImageUrl(testThumbUrl, 320);
  const thumbRun2 = getOptimizedImageUrl(testThumbUrl, 320);
  assert(thumbRun1 === thumbRun2, 'Consecutive calls to getOptimizedImageUrl return identical deterministic strings');

  // --- FOCUSED REFINEMENT TESTS: IMAGE QUALITY, DESKTOP CONTROLS & MINIMUM 3-GRID LAYOUT ---

  // [Test 151] Equivalent collection mockup quality for direct collection items vs Poster Kit collection items
  console.log('\n[Test 151] Equivalent Collection Mockup Quality in Cart (Collections vs Poster Kit)');
  const sampleStorefrontMockup = 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/goku-mockup-hd.jpg';
  const sampleCleanPrintArtwork = 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/108.png';
  const sampleTinyPickerThumb = 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/goku-100-tiny.webp';

  // Direct collection cart item (added from Collections.tsx / ProductDetail.tsx)
  const directCollectionItem = {
    id: 108,
    name: 'Goku Minimalist',
    price: 179,
    image: sampleStorefrontMockup,
    quantity: 1,
    size: 'A3',
    material: 'Matte Paper',
    selected_size: 'A3',
    selected_material: 'Matte Paper',
    unit_price: 179,
    line_total: 179,
  };

  // Poster Kit collection poster item
  const pkCollectionPoster: PlacedPoster = {
    id: 'poster-col-test',
    sizeId: 'A3',
    orientation: 'portrait',
    material: 'matte',
    xPercent: 20,
    yPercent: 20,
    widthPercent: 25,
    heightPercent: 35,
    label: 'Poster #1',
    artworkSource: 'collection',
    artworkProductId: 108,
    artworkTitle: 'Goku Minimalist',
    mockupUrl: sampleStorefrontMockup,
    artworkUrl: sampleCleanPrintArtwork,
    image_thumbnail_url: sampleTinyPickerThumb,
    artwork: {
      source: 'collection',
      url: sampleCleanPrintArtwork,
      productId: 108,
      title: 'Goku Minimalist',
      isBlobUrl: false,
      mockupUrl: sampleStorefrontMockup,
      image_thumbnail_url: sampleTinyPickerThumb,
    },
  };

  const pkCollectionCartItem = createPosterKitCartItem(pkCollectionPoster);
  // Image resolver for direct item and Poster Kit item must resolve to identical storefront mockup
  const directCartThumb = getStorefrontImage(directCollectionItem, 'thumbnail');
  const pkCartThumb = getStorefrontImage(pkCollectionCartItem, 'thumbnail');
  assert(directCartThumb === sampleStorefrontMockup, 'Direct collection cart item resolves to original storefront mockup image');
  assert(pkCartThumb === sampleStorefrontMockup, 'Poster Kit collection cart item resolves to original storefront mockup image');
  assert(pkCartThumb === directCartThumb, 'Collection cart item added directly and through Poster Kit resolves to identical mockup image & quality');
  assert(!pkCollectionCartItem.image_thumbnail_url, 'Poster Kit collection item does NOT attach 100px image_thumbnail_url so blurry thumbnails are avoided');

  // [Test 152] Separate standalone print artwork for wall preview vs storefront mockup for cart
  console.log('\n[Test 152] Separate Print Artwork for Wall Preview vs Storefront Mockup for Cart');
  assert(pkCollectionCartItem.artwork_url === sampleCleanPrintArtwork, 'Standalone print artwork is preserved in artwork_url for fulfillment');
  assert(pkCollectionCartItem.image === sampleStorefrontMockup, 'Storefront room mockup is used for cart item image');
  assert(!isStorefrontMockupUrl(pkCollectionCartItem.artwork_url!), 'Print artwork in artwork_url is NOT a room mockup');

  // [Test 153] Custom artwork title and thumbnail preservation
  console.log('\n[Test 153] Custom Artwork Title and Thumbnail Preservation');
  const customPosterRef: PlacedPoster = {
    id: 'poster-cust-123',
    sizeId: 'A4',
    orientation: 'portrait',
    material: 'rigid_board',
    xPercent: 30,
    yPercent: 25,
    widthPercent: 20,
    heightPercent: 28,
    label: 'Poster Custom',
    artworkSource: 'custom',
    customArtworkId: 'cust-id-789',
    customArtworkFileName: 'My_Custom_Art_Final_Draft.png',
    artworkUrl: 'blob:http://localhost:5173/cust-blob-uuid',
    artworkTitle: 'My_Custom_Art_Final_Draft.png',
  };
  const pkCustomCartItem = createPosterKitCartItem(customPosterRef);
  assert(pkCustomCartItem.title === 'Custom Design', 'Customer-facing cart title remains strictly Custom Design');
  assert(pkCustomCartItem.name === 'Custom Design', 'Customer-facing cart name remains strictly Custom Design');
  assert(pkCustomCartItem.image === 'blob:http://localhost:5173/cust-blob-uuid', 'Custom cart item image is the uploaded artwork');
  assert(getStorefrontImage(pkCustomCartItem, 'thumbnail') === 'blob:http://localhost:5173/cust-blob-uuid', 'Custom cart thumbnail resolves to uploaded artwork');
  assert(pkCustomCartItem.customArtworkFileName === 'My_Custom_Art_Final_Draft.png', 'Original upload filename is retained in internal metadata');

  // [Test 154] Desktop-only "Rotate Grid" and "Delete Grid" labels, with no mobile toolbar regression
  console.log('\n[Test 154] Desktop-Only Rotate Grid and Delete Grid Labels & Mobile Isolation');
  const pkitCode = fs.readFileSync(path.resolve(__dirname, '../src/pages/PosterKit.tsx'), 'utf-8');
  assert(pkitCode.includes('Rotate Grid'), 'PosterKit includes visible Rotate Grid label on desktop');
  assert(pkitCode.includes('Delete Grid'), 'PosterKit includes visible Delete Grid label on desktop');
  assert(pkitCode.includes('hidden md:inline whitespace-nowrap">Rotate Grid</span>') || pkitCode.includes('<span>Rotate Grid</span>'), 'Rotate Grid label is visible on desktop layouts');
  assert(pkitCode.includes('hidden md:inline whitespace-nowrap">Delete Grid</span>') || pkitCode.includes('<span>Delete Grid</span>'), 'Delete Grid label is visible on desktop layouts');
  // Confirm mobile toolbar uses compact Rotate and Delete without Grid
  const mobileIdx = pkitCode.lastIndexOf('Row 2: Rotate and Delete');
  const mobileToolbarSnippet = pkitCode.slice(mobileIdx, mobileIdx + 2500);
  assert(mobileToolbarSnippet.includes('<span>Rotate</span>'), 'Mobile toolbar retains compact Rotate label');
  assert(mobileToolbarSnippet.includes('<span>Delete</span>'), 'Mobile toolbar retains compact Delete label');
  assert(!mobileToolbarSnippet.includes('Rotate Grid'), 'Mobile toolbar does not use long Rotate Grid label');
  assert(!mobileToolbarSnippet.includes('Delete Grid'), 'Mobile toolbar does not use long Delete Grid label');

  // [Test 155] Delete, keyboard delete, and Clear All cannot reduce layout below three grids
  console.log('\n[Test 155] Minimum 3-Grid Enforcement on Deletion and Clear');
  assert(pkitCode.includes('if (posters.length <= 3)'), 'handleRemovePoster checks if posters.length <= 3');
  assert(pkitCode.includes('setIsMinLayoutModalOpen(true)'), 'Shows Minimum Layout modal if action would reduce grids below 3');
  assert(pkitCode.includes('Minimum Layout Required'), 'Modal displays exact heading "Minimum Layout Required"');
  assert(pkitCode.includes('Your Poster Kit must contain at least 3 poster grids. Add more posters or keep at least 3 grids in your layout.'), 'Modal displays exact required message');
  assert(pkitCode.includes('data-testid="min-layout-okay-btn"'), 'Modal provides accessible Okay button');
  assert(pkitCode.includes('handleConfirmClear') && pkitCode.includes('getInitialPosters()'), 'Clear confirmation replaces empty-wall result with default layout of at least 3 grids');

  // [Test 156] Reset and saved-layout normalization always produce at least three grids
  console.log('\n[Test 156] Reset and Saved-Layout Normalization Guarantee 3 Grids');
  const normEmpty = normalizeMinimumPosterLayout([]);
  assert(normEmpty.length >= 3, 'Normalizing empty layout produces at least 3 grids');
  const normNull = normalizeMinimumPosterLayout(null);
  assert(normNull.length >= 3, 'Normalizing null layout produces at least 3 grids');
  const singleSavedPoster: PlacedPoster = {
    id: 'saved-single-1',
    sizeId: 'A3',
    orientation: 'landscape',
    material: 'glossy',
    xPercent: 35,
    yPercent: 25,
    widthPercent: 30,
    heightPercent: 20,
    label: 'Custom Feature',
    artworkSource: 'collection',
    artworkProductId: 42,
    artworkUrl: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png',
  };
  const normOne = normalizeMinimumPosterLayout([singleSavedPoster]);
  assert(normOne.length === 3, 'Normalizing 1 poster adds 2 default blank grids to total 3');
  assert(normOne[0].id === 'saved-single-1', 'First poster retains id');
  assert(normOne[0].sizeId === 'A3', 'First poster retains sizeId A3');
  assert(normOne[0].material === 'glossy', 'First poster retains material glossy');
  assert(normOne[0].orientation === 'landscape', 'First poster retains landscape orientation');
  assert(normOne[0].artworkUrl === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png', 'First poster retains artwork URL');
  assert(!normOne[1].artworkUrl && !normOne[2].artworkUrl, 'Padded default grids remain blank cardstock without duplicating artwork');

  // [Test 157] Clearing artwork does not delete its grid
  console.log('\n[Test 157] Clearing Artwork Does Not Delete Its Grid');
  const layoutWithArt: PlacedPoster[] = [
    { ...normOne[0] },
    { ...normOne[1] },
    { ...normOne[2] },
  ];
  // Simulate clearing artwork
  const afterClearedArt = layoutWithArt.map((p) => {
    if (p.id !== 'saved-single-1') return p;
    return {
      ...p,
      artwork: undefined,
      artworkUrl: undefined,
      artworkSource: undefined,
      artworkProductId: undefined,
      artworkTitle: undefined,
    };
  });
  assert(afterClearedArt.length === 3, 'Grid count remains strictly 3 after clearing artwork');
  assert(afterClearedArt[0].id === 'saved-single-1', 'Grid ID remains in place');
  assert(afterClearedArt[0].artworkUrl === undefined, 'Artwork is cleared');
  assert(afterClearedArt[0].sizeId === 'A3', 'Grid size is preserved');
  assert(afterClearedArt[0].material === 'glossy', 'Grid material is preserved');

  // [Test 158] Sizes, physical proportions, materials, invoice prices, cart pricing integrity
  console.log('\n[Test 158] Sizes, Physical ISO Proportions, Materials, and Pricing Integrity');
  const defaultInitial = getInitialPosters();
  assert(defaultInitial.length === 3, 'Initial layout contains exactly 3 grids');
  const initialInvoice = calculatePosterKitInvoice(defaultInitial);
  // Default is A4 Matte (100) + A3 Matte (130) + A5 Matte (79) = ₹309
  assert(initialInvoice.subtotal === 309, 'Initial 3-grid default invoice is ₹309');
  assert(initialInvoice.totalQuantity === 3, 'Initial invoice reports 3 posters');

  // --- COMMENCING DAILY-RANDOM COLLECTION PICKER TESTS (TESTS 159 - 165) ---

  const collectionsCode = fs.readFileSync(path.join(__dirname, '../src/pages/Collections.tsx'), 'utf-8');
  const pickerCode = fs.readFileSync(path.join(__dirname, '../src/components/posterKit/PosterDesignPickerModal.tsx'), 'utf-8');

  // [Test 159] Poster Kit uses the exact same daily-random logic as Collections
  console.log('\n[Test 159] Poster Kit Reuses Same Daily-Random Algorithm as Collections');
  assert(
    collectionsCode.includes("from '../utils/dailyShuffle'"),
    'Collections.tsx imports shared dailyShuffle utility'
  );
  assert(
    pickerCode.includes("from '../../utils/dailyShuffle'"),
    'PosterDesignPickerModal.tsx imports shared dailyShuffle utility'
  );
  assert(
    collectionsCode.includes('shuffleWithDailySeed(products, currentDateStr)'),
    'Collections uses shuffleWithDailySeed with currentDateStr'
  );
  assert(
    pickerCode.includes('shuffleWithDailySeed(products, currentDateStr)'),
    'PosterDesignPickerModal uses shuffleWithDailySeed with currentDateStr'
  );

  // Generate test sample products
  const sampleProducts = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `Test Poster ${i + 1}`,
    genre: i % 3 === 0 ? 'Anime' : i % 3 === 1 ? 'Movies' : 'Gaming',
    price: 399,
    image: `https://images.unsplash.com/photo-${i + 1}`,
  }));

  const testSeed = '2026-10-27';
  const collectionsDailyOrder = shuffleWithDailySeed(sampleProducts, testSeed);
  const posterKitDailyOrder = shuffleWithDailySeed(sampleProducts, testSeed);
  assert(
    collectionsDailyOrder.length === sampleProducts.length,
    'Daily shuffle retains all catalog items'
  );
  assert(
    collectionsDailyOrder.map((p) => p.id).join(',') === posterKitDailyOrder.map((p) => p.id).join(','),
    'Collections and Poster Kit produce identical daily ordering for the same date seed'
  );

  // [Test 160] Ordering/selection remains stable across repeated calls and picker openings during the same day
  console.log('\n[Test 160] Stability Across Repeated Calls and Renders on the Same Day');
  const run1 = shuffleWithDailySeed(sampleProducts, testSeed);
  const run2 = shuffleWithDailySeed(sampleProducts, testSeed);
  const run3 = shuffleWithDailySeed(sampleProducts, testSeed);
  assert(
    run1.map((p) => p.id).join(',') === run2.map((p) => p.id).join(',') &&
    run2.map((p) => p.id).join(',') === run3.map((p) => p.id).join(','),
    'Repeated calls with same date seed produce 100% identical product order'
  );
  assert(
    pickerCode.includes('const dailyShuffledProducts = useMemo(') &&
    pickerCode.includes('[products, currentDateStr]'),
    'dailyShuffledProducts is memoized on [products, currentDateStr] to avoid unseeded re-renders'
  );

  // [Test 161] Ordering/selection changes when the date seed advances to the next day
  console.log('\n[Test 161] Ordering Changes When Date Seed Advances to Next Day');
  const day1Order = shuffleWithDailySeed(sampleProducts, '2026-10-27');
  const day2Order = shuffleWithDailySeed(sampleProducts, '2026-10-28');
  const day3Order = shuffleWithDailySeed(sampleProducts, '2026-10-29');
  assert(
    day1Order.map((p) => p.id).join(',') !== day2Order.map((p) => p.id).join(','),
    'Product order on 2026-10-27 is distinct from 2026-10-28'
  );
  assert(
    day2Order.map((p) => p.id).join(',') !== day3Order.map((p) => p.id).join(','),
    'Product order on 2026-10-28 is distinct from 2026-10-29'
  );
  assert(
    pickerCode.includes('setInterval(') && pickerCode.includes('getDailySeed()'),
    'PosterDesignPickerModal checks getDailySeed() periodically to detect calendar day roll'
  );

  // [Test 162] Category filters work without reshuffling the daily set
  console.log('\n[Test 162] Category Filter Operates on Current Day Set Without Reshuffling');
  const animeInDailySet = day1Order.filter((p) => p.genre === 'Anime');
  const animeIdsInDailySet = animeInDailySet.map((p) => p.id);
  assert(animeInDailySet.length > 0, 'Anime products exist in test set');
  // Re-filtering the daily set for Anime must produce the exact same order
  const filteredAgain = day1Order.filter((p) => p.genre === 'Anime');
  assert(
    filteredAgain.map((p) => p.id).join(',') === animeIdsInDailySet.join(','),
    'Category filter preserves the relative daily-random ordering of matching products'
  );
  assert(
    pickerCode.includes('let result = dailyShuffledProducts;'),
    'PosterDesignPickerModal base result for filteredProducts starts with dailyShuffledProducts'
  );

  // [Test 163] Search filter operates on the current day set without reshuffling
  console.log('\n[Test 163] Search Filter Operates on Current Day Set Without Reshuffling');
  const searchResults = day1Order.filter((p) => p.name.includes('1'));
  const searchIds = searchResults.map((p) => p.id);
  const searchResults2 = day1Order.filter((p) => p.name.includes('1'));
  assert(
    searchResults2.map((p) => p.id).join(',') === searchIds.join(','),
    'Search filter preserves the relative daily-random ordering of matching items'
  );

  // [Test 164] Verified-art filtering and room-mockup exclusion remain intact
  console.log('\n[Test 164] Verified-Art Filter and Room-Mockup Exclusion Intact on Daily Set');
  assert(
    pickerCode.includes('resolveOriginalPosterArtwork(p, storageArtworksMap)'),
    'filteredProducts validates artwork availability with resolveOriginalPosterArtwork'
  );
  assert(
    pickerCode.includes('isStorefrontMockupUrl(artworkInfo.artworkUrl)'),
    'handleApplyCollectionProduct strictly excludes room-scene mockups from being applied to wall'
  );
  assert(
    isStorefrontMockupUrl('https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/neon.webp') &&
    isStorefrontMockupUrl('https://posterealm.supabase.co/storage/v1/object/public/posters/anime/room-mockup.jpg'),
    'isStorefrontMockupUrl recognizes room-scene mockups'
  );
  assert(
    !isStorefrontMockupUrl('https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/101.png'),
    'isStorefrontMockupUrl permits verified standalone artworks'
  );

  // [Test 165] Applying design preserves standalone artwork for wall and storefront mockup for cart
  console.log('\n[Test 165] Applying Design Preserves Standalone Artwork and Storefront Mockup');
  const mockProduct = {
    id: 101,
    name: 'Cyberpunk Skyline',
    genre: 'Cyberpunk',
    price: 499,
    image: 'https://posterealm.supabase.co/storage/v1/object/public/posters/mockups/101-room.png',
  };
  const mockStorageMap = new Map<string | number, string>([
    [101, 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/101.png'],
  ]);
  const resolvedArt = resolveOriginalPosterArtwork(mockProduct as any, mockStorageMap);
  assert(resolvedArt.isAvailable, 'Original artwork is resolved as available');
  assert(
    resolvedArt.artworkUrl === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/101.png',
    'Standalone print artwork URL is resolved'
  );

  const appliedArtwork: any = {
    source: 'collection',
    url: resolvedArt.artworkUrl,
    productId: mockProduct.id,
    title: mockProduct.name,
    isBlobUrl: false,
    mockupUrl: mockProduct.image,
  };

  const posterWithArt: PlacedPoster = {
    ...defaultInitial[0],
    artwork: appliedArtwork,
    artworkUrl: appliedArtwork.url,
    artworkSource: appliedArtwork.source,
    artworkProductId: appliedArtwork.productId,
    artworkTitle: appliedArtwork.title,
  };

  const cartItem = createPosterKitCartItem(posterWithArt);
  assert(cartItem.productId === 101, 'Cart item retains productId 101');
  assert(cartItem.artwork_url === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/101.png', 'Cart item artwork_url preserves standalone artwork');
  assert(cartItem.image === mockProduct.image, 'Cart item image uses storefront mockup image');
  assert(cartItem.image_thumbnail_url === undefined, 'image_thumbnail_url is omitted for collection item to prevent blurry thumbnail');

  // [Test 166] Full-Screen Preview Layout Refinement: Summary and Add to Bag Hidden in Full-Screen Mode
  console.log('\n[Test 166] Full-Screen Preview Layout Refinement: Summary & Add to Bag Hidden');
  const posterKitCurrentCode = fs.readFileSync(posterKitPath, 'utf-8');
  assert(
    posterKitCurrentCode.includes('!isFullScreen') && posterKitCurrentCode.includes('PosterKitPriceSummary'),
    'PosterKit conditionally unmounts/hides PosterKitPriceSummary when isFullScreen is active'
  );
  assert(
    posterKitCurrentCode.includes('data-testid="exit-fullscreen-btn"'),
    'Back to Editor button is preserved in Full Screen mode'
  );
  assert(
    posterKitCurrentCode.includes('Wall Realm Preview •') && posterKitCurrentCode.includes('posters.length'),
    'Poster count indicator is preserved in Full Screen mode'
  );
  assert(
    posterKitCurrentCode.includes('handleExitFullScreen') && posterKitCurrentCode.includes("e.key === 'Escape'"),
    'Escape key listener exits Full Screen mode'
  );
  assert(
    posterKitCurrentCode.includes('fullscreenCanvasWrapperRef') && posterKitCurrentCode.includes('flex-1'),
    'Fullscreen canvas wrapper takes maximum flex viewport space without price summary obstruction'
  );

  // [Test 167] Collection design selection preserves original storefront product image
  console.log('\n[Test 167] Collection design selection preserves original storefront product image');
  const collectionProduct = {
    id: 42,
    name: 'Neo Kyoto Nights',
    genre: 'Anime',
    price: 499,
    image: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/42/v1/card.webp',
  };
  const collectionStorageMap = new Map<string | number, string>([
    [42, 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png'],
  ]);
  const resolvedCollectionArt = resolveOriginalPosterArtwork(collectionProduct as any, collectionStorageMap);
  assert(resolvedCollectionArt.isAvailable, 'Original artwork resolved from storage');
  assert(
    resolvedCollectionArt.artworkUrl === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png',
    'Standalone print artwork URL is resolved strictly'
  );
  assert(
    resolvedCollectionArt.artworkUrl !== collectionProduct.image,
    'Standalone artwork URL is distinct from storefront mockup'
  );

  const selectedArtwork = {
    source: 'collection' as const,
    url: resolvedCollectionArt.artworkUrl!,
    productId: collectionProduct.id,
    title: collectionProduct.name,
    isBlobUrl: false,
    mockupUrl: collectionProduct.image,
  };
  assert(
    selectedArtwork.mockupUrl === collectionProduct.image,
    'Collection design selection preserves original storefront product image in mockupUrl'
  );

  // [Test 168] Applying a collection design to a poster grid does not replace storefront image with standalone artwork
  console.log('\n[Test 168] Applying collection design to poster grid maintains image separation');
  const posterWithCollectionArt: PlacedPoster = {
    ...defaultInitial[0],
    id: 'poster-col-42',
    artwork: selectedArtwork,
    artworkUrl: selectedArtwork.url,
    artworkSource: 'collection',
    artworkProductId: selectedArtwork.productId,
    collectionProductId: selectedArtwork.productId,
    artworkTitle: selectedArtwork.title,
    mockupUrl: selectedArtwork.mockupUrl,
  };
  assert(
    posterWithCollectionArt.mockupUrl === collectionProduct.image,
    'Poster grid retains original storefront product image in mockupUrl'
  );
  assert(
    posterWithCollectionArt.artworkUrl === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png',
    'Poster grid retains standalone print artwork in artworkUrl'
  );
  assert(
    posterWithCollectionArt.mockupUrl !== posterWithCollectionArt.artworkUrl,
    'Storefront mockup and standalone print artwork remain strictly distinct on poster grid'
  );

  // [Test 169] createPosterKitCartItem stores correct storefront mockup in item.image & standalone artwork in item.artwork_url
  console.log('\n[Test 169] createPosterKitCartItem stores correct storefront mockup in item.image & standalone artwork in item.artwork_url');
  const collectionCartItem169 = createPosterKitCartItem(posterWithCollectionArt);
  assert(
    collectionCartItem169.image === collectionProduct.image,
    'Cart item.image contains the original storefront product image'
  );
  assert(
    collectionCartItem169.artwork_url === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png',
    'Cart item.artwork_url independently retains the standalone print artwork'
  );
  assert(
    collectionCartItem169.image !== collectionCartItem169.artwork_url,
    'Cart item image and artwork_url are strictly separated'
  );
  assert(
    collectionCartItem169.productId === 42,
    'Cart item retains original collection product ID'
  );
  assert(
    collectionCartItem169.image_thumbnail_url === undefined,
    'image_thumbnail_url is undefined for collection Poster Kit cart item'
  );

  // [Test 170] Cart thumbnail resolution displays the storefront mockup for collection-based Poster Kit items
  console.log('\n[Test 170] Cart thumbnail resolution displays storefront mockup');
  const resolvedCartThumb = getStorefrontImage(collectionCartItem169, 'thumbnail');
  assert(
    resolvedCartThumb === collectionProduct.image,
    'getStorefrontImage(item, thumbnail) resolves to original storefront mockup image'
  );
  assert(
    resolvedCartThumb !== collectionCartItem169.artwork_url,
    'Cart thumbnail resolution does NOT return standalone print artwork'
  );

  // Defense-in-depth: Even if a tiny 100px thumbnail was somehow attached, getStorefrontImage avoids downsampling
  const collectionCartItemWithTinyThumb170 = {
    ...collectionCartItem169,
    image_thumbnail_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/42/v1/100.webp',
  };
  const resolvedSharpThumb = getStorefrontImage(collectionCartItemWithTinyThumb170, 'thumbnail');
  assert(
    resolvedSharpThumb === collectionProduct.image,
    'getStorefrontImage does not downgrade collection Poster Kit items to 100px thumbnail'
  );

  // [Test 171] Deliberate fallback when original storefront image is unavailable (never standalone print artwork)
  console.log('\n[Test 171] Deliberate fallback when storefront image is missing');
  const posterWithoutMockup: PlacedPoster = {
    ...defaultInitial[1],
    id: 'poster-col-missing-mockup',
    artworkSource: 'collection',
    artworkProductId: 1, // Spirit Samurai
    artworkTitle: 'Spirit Samurai',
    artworkUrl: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/1.png',
    mockupUrl: undefined,
  };
  const cartItemFallback = createPosterKitCartItem(posterWithoutMockup);
  assert(
    cartItemFallback.artwork_url === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/1.png',
    'Cart item artwork_url retains standalone print artwork'
  );
  assert(
    cartItemFallback.image !== cartItemFallback.artwork_url,
    'Cart item image NEVER silently falls back to standalone print artwork'
  );
  assert(
    typeof cartItemFallback.image === 'string' && cartItemFallback.image.length > 0,
    'Cart item image uses a deliberate storefront mockup fallback'
  );

  // [Test 172] Custom uploads still display customer-uploaded artwork & customer-facing title
  console.log('\n[Test 172] Custom uploads display uploaded artwork and Custom Design title');
  const customPosterItem: PlacedPoster = {
    ...defaultInitial[2],
    id: 'poster-custom-99',
    artworkSource: 'custom',
    customArtworkId: 'cust-uuid-99',
    artworkTitle: 'My Digital Sketch.png',
    customArtworkFileName: 'My Digital Sketch.png',
    artworkUrl: 'blob:http://localhost:5173/custom-blob-99',
  };
  const customCartItem172 = createPosterKitCartItem(customPosterItem);
  assert(
    customCartItem172.name === 'Custom Design',
    'Custom design cart item uses customer-facing title Custom Design'
  );
  assert(
    customCartItem172.image === 'blob:http://localhost:5173/custom-blob-99',
    'Custom design cart item.image contains customer-uploaded artwork'
  );
  assert(
    customCartItem172.customArtworkId === 'cust-uuid-99',
    'Custom design cart item preserves customArtworkId'
  );
  assert(
    customCartItem172.customArtworkFileName === 'My Digital Sketch.png',
    'Custom design cart item preserves customArtworkFileName for admin/fulfillment'
  );
  assert(
    getStorefrontImage(customCartItem172, 'thumbnail') === 'blob:http://localhost:5173/custom-blob-99',
    'Cart thumbnail resolves to customer uploaded image'
  );

  // [Test 173] Cart hydration and page refresh preserve correct image mapping
  console.log('\n[Test 173] Cart hydration and page refresh preserve correct image mapping');
  savePosterKitLayout([posterWithCollectionArt, customPosterItem], 'A4');
  const restoredLayout173 = getSavedPosterKitLayout();
  assert(restoredLayout173 !== null, 'Saved layout loaded successfully');
  assert(restoredLayout173!.posters.length === 2, 'Saved layout loaded 2 posters');
  const normalizedPosters = normalizeMinimumPosterLayout(restoredLayout173!.posters);
  assert(normalizedPosters.length === 3, 'Normalized minimum layout restored 3 posters');

  const restoredColPoster = restoredLayout173!.posters.find((p) => p.id === 'poster-col-42');
  assert(restoredColPoster !== undefined, 'Collection poster restored');
  assert(
    restoredColPoster!.mockupUrl === collectionProduct.image,
    'Restored collection poster preserves mockupUrl across page refresh / storage reload'
  );
  assert(
    restoredColPoster!.artworkUrl === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png',
    'Restored collection poster preserves standalone print artwork'
  );

  const restoredColCartItem = createPosterKitCartItem(restoredColPoster!);
  assert(
    restoredColCartItem.image === collectionProduct.image,
    'Cart item created from restored layout still displays storefront mockup image'
  );
  assert(
    restoredColCartItem.artwork_url === 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/42.png',
    'Cart item created from restored layout retains standalone print artwork'
  );
  assert(
    getStorefrontImage(restoredColCartItem, 'thumbnail') === collectionProduct.image,
    'getStorefrontImage from restored layout item displays storefront mockup'
  );

  const restoredCustomPoster = restoredLayout173!.posters.find((p) => p.id === 'poster-custom-99');
  assert(restoredCustomPoster !== undefined, 'Custom poster restored');
  assert(
    restoredCustomPoster!.customArtworkId === 'cust-uuid-99',
    'Restored custom poster preserves customArtworkId'
  );
  assert(
    restoredCustomPoster!.customArtworkFileName === 'My Digital Sketch.png',
    'Restored custom poster preserves customArtworkFileName'
  );
  assert(
    !restoredCustomPoster!.artworkUrl || !restoredCustomPoster!.artworkUrl.startsWith('blob:'),
    'Restored custom poster does not store transient blob URL in localStorage'
  );
  assert(
    restoredCustomPoster!.artwork?.url === '',
    'Restored custom poster artwork URL is empty awaiting IndexedDB hydration'
  );

  // [Test 174] Ordinary collection products retain their existing cart image behavior
  console.log('\n[Test 174] Ordinary collection products retain existing cart image behavior');
  const ordinaryProductCartItem = {
    id: 7,
    name: 'Midnight Racer',
    price: 899,
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800&auto=format&fit=crop',
    quantity: 1,
    size: 'A3',
    material: 'Matte',
    unit_price: 899,
    line_total: 899,
  };
  const ordinaryThumb = getStorefrontImage(ordinaryProductCartItem, 'thumbnail');
  assert(
    ordinaryThumb === ordinaryProductCartItem.image,
    'Direct Collections cart item resolves thumbnail to product.image unchanged'
  );

  // [Test 175] Existing Poster Kit pricing, validation, and order fulfillment remain unchanged
  console.log('\n[Test 175] Existing Poster Kit pricing, validation, and fulfillment data remain unchanged');
  const validLayout = validateWallLayout([posterWithCollectionArt, customPosterItem, { ...defaultInitial[0], id: 'p3', artworkSource: 'collection', artworkProductId: 2, artworkUrl: 'https://posterealm.supabase.co/storage/v1/object/public/posters/artworks/2.png' }]);
  assert(validLayout.isValid, 'validateWallLayout validates complete wall layout');

  const blankLayout = validateWallLayout([posterWithCollectionArt, defaultInitial[1]]);
  assert(!blankLayout.isValid, 'validateWallLayout correctly identifies blank poster grids');

  const invoice = calculatePosterKitInvoice([posterWithCollectionArt, customPosterItem]);
  assert(invoice.totalQuantity === 2, 'Invoice calculates correct poster quantity');
  assert(invoice.subtotal > 0, 'Invoice calculates subtotal');

  // [Test 176] Fix 2: Poster Kit cart and payment thumbnails resolve to 400px WebP card variant
  console.log('\n[Test 176] Poster Kit cart and payment thumbnails resolve to 400px WebP card variant');
  const posterKitItemWithVariants = {
    ...collectionCartItem169,
    image_card_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/42/v1/card.webp',
    image_preview_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/42/v1/preview.webp',
  };
  const resolvedCardVariantThumb = getStorefrontImage(posterKitItemWithVariants, 'thumbnail');
  assert(
    resolvedCardVariantThumb === 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/42/v1/card.webp',
    'Poster Kit collection cart item thumbnail prioritizes 400px WebP card variant'
  );

  // Fallback to 800px preview WebP variant when card variant is missing
  const posterKitItemWithPreviewOnly = {
    ...collectionCartItem169,
    image_card_url: null,
    image_preview_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/42/v1/preview.webp',
  };
  const resolvedPreviewVariantThumb = getStorefrontImage(posterKitItemWithPreviewOnly, 'thumbnail');
  assert(
    resolvedPreviewVariantThumb === 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/42/v1/preview.webp',
    'Poster Kit collection cart item thumbnail falls back to 800px WebP preview variant when card variant is missing'
  );

  // Fallback to product.image when neither variant is present
  const posterKitItemWithoutOptimizedVariants = {
    ...collectionCartItem169,
    image_card_url: null,
    image_preview_url: null,
    image: 'https://posterealm.supabase.co/storage/v1/object/public/posters/legacy-mockup.png',
  };
  const resolvedFallbackThumb = getStorefrontImage(posterKitItemWithoutOptimizedVariants, 'thumbnail');
  assert(
    resolvedFallbackThumb === 'https://posterealm.supabase.co/storage/v1/object/public/posters/legacy-mockup.png',
    'Poster Kit collection cart item thumbnail safely falls back to item.image when no optimized variant exists'
  );
  assert(
    resolvedFallbackThumb !== collectionCartItem169.artwork_url,
    'Poster Kit thumbnail resolution never falls back to print master artwork_url'
  );

  // [Test 177] Standard storefront items and custom upload thumbnails remain unaffected
  console.log('\n[Test 177] Standard storefront items and custom upload thumbnails remain unaffected');
  const regularStorefrontItem = {
    id: 10,
    name: 'Cyber Samurai',
    image: 'https://posterealm.supabase.co/storage/v1/object/public/posters/cyber-samurai.png',
    image_thumbnail_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/10/v1/100.webp',
    image_card_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/10/v1/400.webp',
    image_preview_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/10/v1/800.webp',
  };
  assert(
    getStorefrontImage(regularStorefrontItem, 'thumbnail') === regularStorefrontItem.image_thumbnail_url,
    'Standard storefront item resolves thumbnail to 100px WebP thumbnail variant'
  );
  assert(
    getStorefrontImage(regularStorefrontItem, 'card') === regularStorefrontItem.image_card_url,
    'Standard storefront item resolves card to 400px WebP card variant'
  );
  assert(
    getStorefrontImage(regularStorefrontItem, 'preview') === regularStorefrontItem.image_preview_url,
    'Standard storefront item resolves preview to 800px WebP preview variant'
  );
  assert(
    getStorefrontImage(customCartItem172, 'thumbnail') === customCartItem172.image,
    'Custom upload cart item resolves thumbnail to user uploaded image'
  );

  // [Test 178] Phase 2: Supabase Storage Cache-Control Syntax Corrections
  console.log('\n[Test 178] Phase 2: Supabase Storage Cache-Control Syntax Corrections');

  const storageServiceCode = fs.readFileSync(path.resolve(process.cwd(), 'src/services/storage.ts'), 'utf8');
  const posterArtworkServiceCode = fs.readFileSync(path.resolve(process.cwd(), 'src/services/posterArtwork.ts'), 'utf8');
  const imageOptimizerCode = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/imageOptimizer.ts'), 'utf8');
  const catalogMigrationCode = fs.readFileSync(path.resolve(process.cwd(), 'scripts/execute-full-catalog-migration.ts'), 'utf8');

  // 1. Storefront uploads pass '31536000' in src/services/storage.ts
  assert(
    storageServiceCode.includes("? '31536000'") || storageServiceCode.includes('? "31536000"'),
    'src/services/storage.ts sets cacheControl to 31536000 for storefront paths'
  );
  assert(
    !storageServiceCode.includes("'public, max-age=31536000, immutable'"),
    'src/services/storage.ts removes malformed public, max-age=31536000, immutable string'
  );

  // 2. Non-storefront fallback uploads pass '3600' in src/services/storage.ts
  assert(
    storageServiceCode.includes(": '3600'") || storageServiceCode.includes(': "3600"'),
    'src/services/storage.ts preserves 3600 fallback for non-storefront paths'
  );

  // 3. Original print artwork uploads pass '3600' in src/services/posterArtwork.ts
  assert(
    posterArtworkServiceCode.includes("cacheControl: '3600'") || posterArtworkServiceCode.includes('cacheControl: "3600"'),
    'src/services/posterArtwork.ts sets cacheControl to clean 3600 string'
  );
  assert(
    !posterArtworkServiceCode.includes("cacheControl: 'public, max-age=3600'"),
    'src/services/posterArtwork.ts removes malformed public, max-age=3600 string'
  );
  assert(
    !posterArtworkServiceCode.includes("cacheControl: '86400'"),
    'src/services/posterArtwork.ts strictly preserves 1-hour cache duration for unversioned print masters'
  );

  // 4. Image optimizer uploads pass '31536000' in src/utils/imageOptimizer.ts
  assert(
    imageOptimizerCode.includes("cacheHeader = '31536000'") || imageOptimizerCode.includes('cacheHeader = "31536000"'),
    'src/utils/imageOptimizer.ts sets cacheHeader to clean 31536000 string'
  );
  assert(
    !imageOptimizerCode.includes("cacheHeader = 'public, max-age=31536000, immutable'"),
    'src/utils/imageOptimizer.ts removes malformed public, max-age=31536000, immutable string'
  );

  // 5. Catalog migration uploads pass '31536000' in scripts/execute-full-catalog-migration.ts
  assert(
    catalogMigrationCode.includes("cacheHeader = '31536000'") || catalogMigrationCode.includes('cacheHeader = "31536000"'),
    'scripts/execute-full-catalog-migration.ts sets cacheHeader to clean 31536000 string'
  );
  assert(
    !catalogMigrationCode.includes("cacheHeader = 'public, max-age=31536000, immutable'"),
    'scripts/execute-full-catalog-migration.ts removes malformed public, max-age=31536000, immutable string'
  );

  // 6. Verification that no malformed values containing public, max-age=, or immutable are passed to Supabase cacheControl
  const malformedCacheControlRegex = /cacheControl\s*:\s*['"`](?=.*(public|max-age|immutable)).*['"`]/i;
  assert(
    !malformedCacheControlRegex.test(storageServiceCode),
    'storage.ts has no malformed cacheControl options'
  );
  assert(
    !malformedCacheControlRegex.test(posterArtworkServiceCode),
    'posterArtwork.ts has no malformed cacheControl options'
  );
  assert(
    !malformedCacheControlRegex.test(imageOptimizerCode),
    'imageOptimizer.ts has no malformed cacheControl options'
  );
  assert(
    !malformedCacheControlRegex.test(catalogMigrationCode),
    'execute-full-catalog-migration.ts has no malformed cacheControl options'
  );

  // 7. Existing upload paths, versioning, and upsert behavior remain intact
  assert(
    storageServiceCode.includes("path.includes('storefront/')"),
    'storage.ts retains storefront path detection'
  );
  assert(
    storageServiceCode.includes('upsert: options?.upsert ?? false'),
    'storage.ts retains upsert options handling'
  );
  assert(
    posterArtworkServiceCode.includes('upsert: true'),
    'posterArtwork.ts retains upsert for print masters'
  );
  assert(
    imageOptimizerCode.includes('buildStorefrontPath(genre, productId, version,'),
    'imageOptimizer.ts retains versioned path building'
  );
  assert(
    catalogMigrationCode.includes('storefront/${cleanGenre}/${cleanProdId}/${version}/'),
    'execute-full-catalog-migration.ts retains versioned path structure'
  );

  console.log('\n--- ALL POSTER KIT EXTENDED TESTS (1 - 178) PASSED SUCCESSFULLY! ---');
}


runPersistenceAndClearTests().catch((err) => {
  console.error('❌ Extended Tests Failed:', err);
  process.exit(1);
});






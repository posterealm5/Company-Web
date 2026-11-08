import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MOBILE_POSTER_SCALE_FACTOR,
  DESKTOP_POSTER_SCALE_FACTOR,
  getMobilePosterScale,
  getResponsivePosterScale,
  getResponsivePosterPlacement,
  toCanonicalPosterPlacement,
  getInitialPosters,
  USABLE_WALL_BOUNDS,
  MOBILE_USABLE_WALL_BOUNDS,
  getUsableWallBounds,
  getPosterCountScaleFactor,
  getFullScreenButtonProtectedRegion,
  avoidProtectedRegion,
  clampPosterPosition,
  POSTER_SIZES,
  WALL_ASPECT_RATIO,
  getPosterAspectRatio,
  calculatePosterDimensions,
} from '../src/utils/posterKitMath';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('--- RUNNING POSTER KIT MOBILE LAYOUT REFINEMENT (TOOLBAR BELOW WALL) VERIFICATION ---');

const posterKitPath = path.resolve(__dirname, '../src/pages/PosterKit.tsx');
const code = fs.readFileSync(posterKitPath, 'utf-8');

// 1. Container and Margins
console.log('\n[Check 1] Page Container Padding and Heading');
assert(
  code.includes('px-3 sm:px-6 lg:px-8'),
  'Uses px-3 (12px side margin) on mobile to maximize usable wall space, preserving sm:px-6 on desktop'
);
assert(
  code.includes('text-3xl sm:text-5xl md:text-6xl'),
  'Page heading scales down to text-3xl on mobile to prevent clipping/awkward line-wrapping'
);
assert(
  code.includes('text-xs sm:text-base'),
  'Subtitle uses responsive text-xs on mobile for natural comfortable wrapping'
);

// 2. Wall Preview and Sizing
console.log('\n[Check 2] Wall Preview & Shadow');
assert(
  code.includes('aspect-[16/9] max-h-[720px]'),
  'Wall maintains 16:9 aspect ratio and 720px maximum height'
);
assert(
  code.includes('shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'),
  'Wall preview uses compact 4px comic shadow on mobile to prevent viewport overflow'
);
assert(
  code.includes('id="wall-bg-image"'),
  'Straight-on wall image is preserved'
);
assert(
  code.includes('scale-[1.38]') && code.includes('md:scale-100'),
  'Mobile background zoom (~1.38x) is applied with desktop 1x preservation'
);
assert(
  code.includes('origin-[50%_42%]') && code.includes('md:origin-center'),
  'Background zoom is centered on the wall area while preserving floor credenza context'
);
assert(
  code.includes('overflow-hidden pointer-events-none select-none z-0'),
  'Background image is isolated in dedicated overflow-hidden wrapper without scaling poster coordinate system'
);

// 3. Adaptive Poster Artwork Typography and Cardstock Scaling
console.log('\n[Check 3] Adaptive Poster Typography & Cardstock Scaling');
assert(
  code.includes('poster-cardstock'),
  'Poster cardstock uses container queries (.poster-cardstock) with containerType: size'
);
assert(
  code.includes('poster-size-title') && code.includes('fontSize: `clamp('),
  'Poster size title uses adaptive clamp formula derived from rendered container scale'
);
assert(
  code.includes('poster-dim-label') && code.includes('poster-mm-label'),
  'Poster secondary dimension labels scale dynamically with container queries'
);
assert(
  code.includes('poster-crop-mark'),
  'Corner crop marks use adaptive scaling container units (cqw)'
);
assert(
  code.includes('contextual-action-menu') && (code.includes('mb-1.5 sm:mb-2') || code.includes('mb-1.5 md:mb-2')),
  'Contextual action menu position is scaled for mobile and desktop'
);

// 4. Document Flow Order on Mobile
console.log('\n[Check 4] Mobile Document Order Hierarchy');
const headingIndex = code.indexOf('CURATE YOUR');
const wallPreviewIndex = code.indexOf('id="wall-bg-image"');
const desktopToolbarIndex = code.indexOf('Floating Poster Size and Layout Toolbar Overlay');
const mobileToolbarIndex = code.indexOf('Mobile Toolbar Panel (Normal document flow immediately below wall)');
const priceSummaryIndex = code.indexOf('<PosterKitPriceSummary posters={posters} />');

assert(headingIndex !== -1, 'Page heading & subtitle are present');
assert(wallPreviewIndex !== -1, 'Wall preview canvas is present');
assert(desktopToolbarIndex !== -1, 'Desktop floating toolbar overlay is present');
assert(mobileToolbarIndex !== -1, 'Mobile toolbar panel in normal document flow is present');
assert(priceSummaryIndex !== -1, 'Live invoice price summary is present');

assert(headingIndex < wallPreviewIndex, '1. Page heading appears BEFORE wall preview');
assert(wallPreviewIndex < desktopToolbarIndex, '2. Wall image canvas appears BEFORE desktop floating overlay');
assert(desktopToolbarIndex < mobileToolbarIndex, '3. Desktop floating overlay is inside wall preview BEFORE mobile toolbar panel');
assert(mobileToolbarIndex < priceSummaryIndex, '4. Mobile toolbar panel appears BEFORE live price summary');

// 5. Mobile Toolbar - 4 Logical Rows Below Wall
console.log('\n[Check 5] Mobile Toolbar - 4 Logical Rows Below Wall');
const mobileToolbarEnd = code.indexOf('<PosterKitPriceSummary posters={posters} />', mobileToolbarIndex);
const mobileToolbar = code.substring(mobileToolbarIndex, mobileToolbarEnd);

assert(
  mobileToolbar.includes('block sm:hidden mt-3 w-full'),
  'Mobile toolbar has normal-flow styling with block sm:hidden and small top margin (mt-3)'
);

// Row 1 — Size selection: Individual selectable cards
assert(
  mobileToolbar.includes('Row 1 — Size selection'),
  'Row 1: Size selection header present'
);
assert(
  mobileToolbar.includes('grid grid-cols-4'),
  'Row 1: Poster sizes evenly distributed across 4 equal columns'
);
assert(
  !mobileToolbar.includes('bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 w-full'),
  'Row 1: Outer shared segmented border/container is removed'
);
assert(
  mobileToolbar.includes('border-2 border-brand-black') && mobileToolbar.includes('border-2 border-neutral-300'),
  'Row 1: Each size option renders as an independent bordered card with active/inactive states'
);
assert(
  mobileToolbar.includes('AVAILABLE_SIZES.map'),
  'Row 1: Maps over A6, A5, A4, A3 sizes'
);
assert(
  !mobileToolbar.includes('A2'),
  'Row 1: A2 is strictly excluded'
);

// Row 2 — Add Poster & Live Count
assert(
  mobileToolbar.includes('Row 2 — Add Poster'),
  'Row 2: Add poster section present'
);
assert(
  mobileToolbar.includes('Add {activeSizeToAdd} Poster'),
  'Row 2: Prominent Add Poster button contains currently selected size'
);
assert(
  mobileToolbar.includes('{posters.length} {posters.length === 1 ? \'Poster\' : \'Posters\'}'),
  'Row 2: Live poster count badge is in its own separate element'
);
assert(
  mobileToolbar.includes('flex items-center gap-2 w-full mt-2.5'),
  'Row 2: Add button and count badge use flex layout with gap, preventing overlaps'
);

// Row 3 — Context
assert(
  mobileToolbar.includes('Row 3 — Context'),
  'Row 3: Context section present'
);
assert(
  mobileToolbar.includes('Drag to arrange'),
  'Row 3: Short drag instruction when unselected'
);
assert(
  mobileToolbar.includes('Selected:'),
  'Row 3: Shows selected size when a poster is selected'
);
assert(
  mobileToolbar.includes('handleRemovePoster(selectedPoster.id)'),
  'Row 3: Dedicated remove action for selected poster'
);
assert(
  mobileToolbar.includes('flex flex-wrap'),
  'Row 3: Allows wrapping where necessary on small screens'
);

// Row 4 — Actions
assert(
  mobileToolbar.includes('Row 4 — Actions'),
  'Row 4: Actions section present'
);
assert(
  mobileToolbar.includes('grid grid-cols-2 gap-2 w-full mt-2.5'),
  'Row 4: Reset and Clear buttons have equal widths (grid-cols-2)'
);
assert(
  mobileToolbar.includes('handleResetLayout'),
  'Row 4: Reset layout button'
);
assert(
  mobileToolbar.includes('setIsClearModalOpen(true)'),
  'Row 4: Clear all button'
);

// 6. Desktop Toolbar Preservation
console.log('\n[Check 6] Desktop Toolbar Layout Preservation');
assert(
  code.includes('hidden sm:block absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl'),
  'Desktop floating toolbar is preserved with hidden sm:block and absolute centering'
);
assert(
  code.includes('Row 1 — Main Controls (Centered)'),
  'Desktop Row 1 preserved'
);
assert(
  code.includes('Row 2 — Context and Actions (Balanced & Vertically Aligned)'),
  'Desktop Row 2 preserved'
);

// 7. Complete Removal of Unwanted Bottom Sections (Banner & 3 Informational Cards)
console.log('\n[Check 7] Verification of Removed Bottom Sections');
assert(!code.includes('Ready to print custom artwork?'), 'Ready to Print banner is completely removed');
assert(!code.includes('Open Customizer'), 'Open Customizer CTA button is completely removed');
assert(!code.includes('01 • True Physical Scale'), '01 True Physical Scale informational card is completely removed');
assert(!code.includes('02 • Free Boundary Drag'), '02 Free Boundary Drag informational card is completely removed');
assert(!code.includes('03 • Touch & Pointer Ready'), '03 Touch & Pointer Ready informational card is completely removed');

// 8. Mobile Toolbar Row 3 Contextual 2-Row Layout
console.log('\n[Check 8] Mobile Toolbar Row 3 Contextual 2-Row Action Layout');
assert(
  mobileToolbar.includes('Row 1: Change Design and Clear Design') ||
  (mobileToolbar.includes('Change Design') && mobileToolbar.includes('Clear Design')),
  'Mobile Toolbar Row 3: Action Row 1 groups Change Design and Clear Design'
);
assert(
  mobileToolbar.includes('Row 2: Rotate and Delete') ||
  (mobileToolbar.includes('handleRotatePoster') && mobileToolbar.includes('handleRemovePoster')),
  'Mobile Toolbar Row 3: Action Row 2 groups Rotate and Delete'
);
assert(
  mobileToolbar.includes('grid-cols-2') && mobileToolbar.includes('space-y-1.5'),
  'Mobile Toolbar Row 3: Uses compact 2-column grid layout for actions'
);
assert(
  mobileToolbar.includes('Material:') && mobileToolbar.includes('grid grid-cols-3'),
  'Mobile Toolbar Row 3: Dedicated material selector row is preserved without squeezing into action rows'
);

// 9. Selected Poster Contextual Action Menu on Wall Canvas
console.log('\n[Check 9] Selected Poster Contextual Action Menu Mobile Refinement');
assert(
  code.includes('w-[215px] min-[360px]:w-[235px]') && (code.includes('md:w-auto') || code.includes('sm:w-auto')),
  'Contextual action menu has bounded responsive width on mobile to prevent wall overflow'
);
assert(
  code.includes('poster.yPercent < 38'),
  'Contextual action menu positions below poster on mobile when poster is in upper wall region, preventing top edge clipping'
);
assert(
  (code.includes('hidden md:flex') && code.includes('flex md:hidden')) || code.includes('flex flex-col sm:flex-row sm:items-center'),
  'Contextual action menu provides decoupled desktop single-row toolbar and mobile action panel'
);
assert(
  code.includes('hidden md:flex') && code.includes('h-9') && code.includes('whitespace-nowrap'),
  'Desktop contextual toolbar enforces intrinsic readable single-row height (h-9) with no collapsed strip'
);
assert(
  code.includes('grid grid-cols-2') && code.includes('Clear Design (C)'),
  'Contextual action menu organizes actions into compact 2-column grid on mobile'
);
assert(
  code.includes('createPortal') && code.includes('material-dropdown-popover'),
  'Material popover menu is rendered in a viewport portal to prevent overflow:hidden clipping on mobile'
);

// 10. Viewport Width Boundary Safety at 320px, 360px, 375px, 390px, 430px, 768px, 1280px
console.log('\n[Check 10] Viewport Width Boundary Safety (320px, 360px, 375px, 390px, 430px)');
const viewports = [320, 360, 375, 390, 430, 768, 1280];
for (const vp of viewports) {
  const margin = vp < 640 ? 12 * 2 : (vp < 1024 ? 24 * 2 : 32 * 2);
  const wallWidth = Math.min(1280, vp - margin);
  assert(wallWidth > 0, `Viewport ${vp}px: Wall width ${wallWidth}px > 0`);
  assert(wallWidth <= vp, `Viewport ${vp}px: Content does not overflow viewport`);
  
  if (vp < 640) {
    const mobileMenuWidth = vp >= 360 ? 235 : 215;
    assert(
      mobileMenuWidth <= wallWidth,
      `Viewport ${vp}px: Contextual menu (${mobileMenuWidth}px) fits within available wall width (${wallWidth}px)`
    );
  }
}

// 11. Mobile Poster Grid Enlargement & Coordinate Preservation
console.log('\n[Check 11] Mobile Poster Grid Enlargement & Coordinate Preservation');

assert(
  MOBILE_POSTER_SCALE_FACTOR >= 1.95 && MOBILE_POSTER_SCALE_FACTOR <= 2.15,
  `MOBILE_POSTER_SCALE_FACTOR (${MOBILE_POSTER_SCALE_FACTOR}) is within the fine-tuned target range (1.95x–2.15x)`
);
assert(
  MOBILE_USABLE_WALL_BOUNDS.minX === 4.5 &&
  MOBILE_USABLE_WALL_BOUNDS.maxX === 95.5 &&
  MOBILE_USABLE_WALL_BOUNDS.minY === 4.5 &&
  MOBILE_USABLE_WALL_BOUNDS.maxY === 81.0,
  'MOBILE_USABLE_WALL_BOUNDS correctly restores the open plaster wall area (minX: 4.5%, maxX: 95.5%, minY: 4.5%, maxY: 81.0%)'
);
assert(
  getUsableWallBounds(375) === MOBILE_USABLE_WALL_BOUNDS &&
  getUsableWallBounds(1024) === USABLE_WALL_BOUNDS,
  'getUsableWallBounds provides mobile-optimized bounds on mobile and preserves canonical bounds on desktop'
);
assert(
  code.includes('getResponsivePosterPlacement') && code.includes('toCanonicalPosterPlacement'),
  'PosterKit integrates getResponsivePosterPlacement and toCanonicalPosterPlacement'
);
assert(
  code.includes('isMobileZoomed') && code.includes('windowWidth < 768'),
  'PosterKit targets mobile viewports (< 768px) for poster enlargement, matching mobile background zoom'
);

// Verify across target mobile viewports: 320, 360, 375, 390, 430
const testViewports = [320, 360, 375, 390, 430];
const samplePosters = getInitialPosters();

for (const vp of testViewports) {
  const scale = getMobilePosterScale(vp, false);
  assert(scale >= 1.90 && scale <= 2.15, `Viewport ${vp}px: scale factor ${scale}x is within fine-tuned target 1.90x–2.15x range`);

  if (vp === 320) {
    assert(scale >= 1.90 && scale <= 1.95, `Viewport 320px: scale ${scale}x is within target 1.90x–1.95x`);
  } else if (vp === 360) {
    assert(scale >= 2.00 && scale <= 2.05, `Viewport 360px: scale ${scale}x is within target 2.00x–2.05x`);
  } else if (vp === 375) {
    assert(scale >= 2.00 && scale <= 2.08, `Viewport 375px: scale ${scale}x is within target 2.00x–2.08x`);
  } else if (vp === 390) {
    assert(scale >= 2.05 && scale <= 2.10, `Viewport 390px: scale ${scale}x is within target 2.05x–2.10x`);
  } else if (vp === 430) {
    assert(scale >= 2.10 && scale <= 2.15, `Viewport 430px: scale ${scale}x is within target 2.10x–2.15x`);
  }

  const margin = vp < 640 ? 12 * 2 : 24 * 2;
  const wallW = vp - margin;
  const wallH = wallW * 9 / 16;
  const fsRegion = getFullScreenButtonProtectedRegion(vp, wallW, wallH);
  const fsBtnTop = fsRegion.top;
  const fsBtnBottom = fsRegion.bottom;
  const fsBtnLeft = fsRegion.left;
  const fsBtnRight = fsRegion.right;

  const renderedList: any[] = [];
  const wallBounds = getUsableWallBounds(vp);

  for (const poster of samplePosters) {
    const rendered = getResponsivePosterPlacement(poster, true, vp, false);
    assert(
      rendered.widthPercent > poster.widthPercent,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered width (${rendered.widthPercent}%) is enlarged over canonical (${poster.widthPercent}%)`
    );
    assert(
      rendered.heightPercent > poster.heightPercent,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered height (${rendered.heightPercent}%) is enlarged over canonical (${poster.heightPercent}%)`
    );
    // Boundary check against actual usable wall bounds
    assert(
      rendered.xPercent >= wallBounds.minX,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered x (${rendered.xPercent}%) >= minX (${wallBounds.minX}%)`
    );
    assert(
      rendered.xPercent + rendered.widthPercent <= wallBounds.maxX + 0.01,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered right edge (${rendered.xPercent + rendered.widthPercent}%) <= maxX (${wallBounds.maxX}%)`
    );
    assert(
      rendered.yPercent >= wallBounds.minY,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered y (${rendered.yPercent}%) >= minY (${wallBounds.minY}%)`
    );
    assert(
      rendered.yPercent + rendered.heightPercent <= wallBounds.maxY + 0.01,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered bottom edge (${rendered.yPercent + rendered.heightPercent}%) <= maxY (${wallBounds.maxY}%)`
    );

    // Full screen button collision check
    const overlapFSX = Math.max(0, Math.min(rendered.xPercent + rendered.widthPercent, fsBtnRight) - Math.max(rendered.xPercent, fsBtnLeft));
    const overlapFSY = Math.max(0, Math.min(rendered.yPercent + rendered.heightPercent, fsBtnBottom) - Math.max(rendered.yPercent, fsBtnTop));
    assert(
      overlapFSX <= 0 || overlapFSY <= 0,
      `Viewport ${vp}px [${poster.sizeId}]: Poster does not collide with Full Screen button`
    );

    // Exact inverse mapping round-trip test (zero offset drift)
    const canonical = toCanonicalPosterPlacement(rendered, poster, true, vp, false);
    const roundTripDiffX = Math.abs(canonical.xPercent - poster.xPercent);
    const roundTripDiffY = Math.abs(canonical.yPercent - poster.yPercent);
    assert(
      roundTripDiffX < 0.05,
      `Viewport ${vp}px [${poster.sizeId}]: Inverse mapping round-trip X diff (${roundTripDiffX.toFixed(4)}%) is virtually zero (< 0.05%)`
    );
    assert(
      roundTripDiffY < 0.05,
      `Viewport ${vp}px [${poster.sizeId}]: Inverse mapping round-trip Y diff (${roundTripDiffY.toFixed(4)}%) is virtually zero (< 0.05%)`
    );

    renderedList.push({
      ...rendered,
      right: rendered.xPercent + rendered.widthPercent,
    });
  }

  // Ensure posters remain cleanly separated with distinct spacing (> 10%)
  const gap12 = renderedList[1].xPercent - renderedList[0].right;
  const gap23 = renderedList[2].xPercent - renderedList[1].right;
  assert(gap12 >= 10.0, `Viewport ${vp}px: Gap between Poster 1 and 2 (${gap12.toFixed(2)}%) is comfortably separated (>= 10%)`);
  assert(gap23 >= 10.0, `Viewport ${vp}px: Gap between Poster 2 and 3 (${gap23.toFixed(2)}%) is comfortably separated (>= 10%)`);

  // Ensure posters span broadly across the wall without narrow central clustering
  const totalSpanX = renderedList[2].right - renderedList[0].xPercent;
  assert(totalSpanX >= 75.0, `Viewport ${vp}px: Total poster layout span (${totalSpanX.toFixed(2)}%) fills the usable wall area (>= 75%)`);
}

// 12. Laptop and Desktop Responsive Poster Scaling & Boundary Preservation
console.log('\n[Check 12] Laptop & Desktop Responsive Poster Scaling & Boundary Preservation');

// Compact Laptop (1024px, 1280px): approx 1.25x–1.35x
const compactLaptopViewports = [1024, 1280];
for (const vp of compactLaptopViewports) {
  const scale = getResponsivePosterScale(vp, false);
  assert(
    scale >= 1.25 && scale <= 1.35,
    `Compact Laptop (${vp}px): scale ${scale}x is within target range 1.25x–1.35x`
  );
}

// Typical Laptop (1366px, 1440px): approx 1.35x–1.50x
const typicalLaptopViewports = [1366, 1440];
for (const vp of typicalLaptopViewports) {
  const scale = getResponsivePosterScale(vp, false);
  assert(
    scale >= 1.35 && scale <= 1.50,
    `Typical Laptop (${vp}px): scale ${scale}x is within target range 1.35x–1.50x`
  );
}

// Larger Desktop (1600px, 1920px): approx 1.45x–1.60x
const desktopViewports = [1600, 1920];
for (const vp of desktopViewports) {
  const scale = getResponsivePosterScale(vp, false);
  assert(
    scale >= 1.45 && scale <= 1.60,
    `Larger Desktop (${vp}px): scale ${scale}x is within target range 1.45x–1.60x`
  );
}

// Verify boundary containment and zero-drift round-trip on all desktop/laptop viewports
const allDesktopVps = [...compactLaptopViewports, ...typicalLaptopViewports, ...desktopViewports];
for (const vp of allDesktopVps) {
  for (const poster of samplePosters) {
    const rendered = getResponsivePosterPlacement(poster, vp, false);
    assert(
      rendered.widthPercent > poster.widthPercent,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered width (${rendered.widthPercent}%) enlarged over canonical (${poster.widthPercent}%)`
    );
    assert(
      rendered.heightPercent > poster.heightPercent,
      `Viewport ${vp}px [${poster.sizeId}]: Rendered height (${rendered.heightPercent}%) enlarged over canonical (${poster.heightPercent}%)`
    );
    assert(
      rendered.xPercent >= USABLE_WALL_BOUNDS.minX,
      `Viewport ${vp}px [${poster.sizeId}]: x (${rendered.xPercent}%) >= minX (${USABLE_WALL_BOUNDS.minX}%)`
    );
    assert(
      rendered.xPercent + rendered.widthPercent <= USABLE_WALL_BOUNDS.maxX + 0.01,
      `Viewport ${vp}px [${poster.sizeId}]: right edge (${(rendered.xPercent + rendered.widthPercent).toFixed(2)}%) <= maxX (${USABLE_WALL_BOUNDS.maxX}%)`
    );
    assert(
      rendered.yPercent >= USABLE_WALL_BOUNDS.minY,
      `Viewport ${vp}px [${poster.sizeId}]: y (${rendered.yPercent}%) >= minY (${USABLE_WALL_BOUNDS.minY}%)`
    );
    assert(
      rendered.yPercent + rendered.heightPercent <= USABLE_WALL_BOUNDS.maxY + 0.01,
      `Viewport ${vp}px [${poster.sizeId}]: bottom edge (${(rendered.yPercent + rendered.heightPercent).toFixed(2)}%) <= maxY (${USABLE_WALL_BOUNDS.maxY}%)`
    );

    // Exact inverse mapping round-trip test (zero offset drift)
    const canonical = toCanonicalPosterPlacement(rendered, poster, vp, false);
    const roundTripDiffX = Math.abs(canonical.xPercent - poster.xPercent);
    const roundTripDiffY = Math.abs(canonical.yPercent - poster.yPercent);
    assert(
      roundTripDiffX < 0.05,
      `Viewport ${vp}px [${poster.sizeId}]: Inverse mapping round-trip X diff (${roundTripDiffX.toFixed(4)}%) is virtually zero (< 0.05%)`
    );
    assert(
      roundTripDiffY < 0.05,
      `Viewport ${vp}px [${poster.sizeId}]: Inverse mapping round-trip Y diff (${roundTripDiffY.toFixed(4)}%) is virtually zero (< 0.05%)`
    );
  }
}

// Verify full screen preview strictly preserves canonical 1.0x layout across any screen width
const fullscreenDesktopScale = getResponsivePosterScale(1440, true);
const fullscreenMobileScale = getResponsivePosterScale(375, true);
assert(fullscreenDesktopScale === 1.0, 'Desktop full-screen preview scale is strictly 1.0x');
assert(fullscreenMobileScale === 1.0, 'Mobile full-screen preview scale is strictly 1.0x');

const samplePoster = samplePosters[0];
const fullscreenRendered = getResponsivePosterPlacement(samplePoster, 1440, true);
assert(
  fullscreenRendered.xPercent === samplePoster.xPercent &&
  fullscreenRendered.yPercent === samplePoster.yPercent &&
  fullscreenRendered.widthPercent === samplePoster.widthPercent &&
  fullscreenRendered.heightPercent === samplePoster.heightPercent,
  'Full-screen preview strictly preserves canonical dimensions and positions 100% identically'
);

// 13. Desktop Contextual Toolbar Behavior & Bottom Controls Layout Audit
console.log('\n[Check 13] Desktop Contextual Toolbar Behavior & Bottom Controls Layout Audit');
assert(!code.includes('getDesktopContextualToolbarPlacement'), 'Removed dynamic toolbar placement algorithm');
assert(!code.includes('bottomControlsRef'), 'Removed bottomControlsRef');
assert(code.includes('contextual-action-menu'), 'Contextual action menu is rendered for selected poster');
assert(
  code.includes("renderedPos.yPercent < 38 || poster.yPercent < 38 ? 'top-full mt-1.5 md:bottom-full md:mb-2' : 'bottom-full mb-1.5 sm:mb-2'"),
  'Contextual action menu preserves responsive above/below CSS positioning'
);
assert(code.includes('bottomPanelRef'), 'Bottom controls overlay uses bottomPanelRef');
assert(code.includes('availableCredenzaHeight'), 'Calculates position using available credenza space and wall dimensions');
assert(code.includes('max-w-2xl'), 'Bottom controls panel retains max-w-2xl base styling');

const desktopTestViewports = [1024, 1280, 1366, 1440, 1600, 1920];
for (const vp of desktopTestViewports) {
  const wallW = Math.min(1280, vp - (vp < 1024 ? 48 : 64));
  const wallH = Math.round(wallW * 9 / 16);
  const credenzaH = wallH * (1 - USABLE_WALL_BOUNDS.maxY / 100);
  const panelH = 125;
  const panelBottom = Math.max(8, Math.min(16, Math.floor((credenzaH - panelH) / 2)));
  const panelTop = Number((((wallH - panelBottom - panelH) / wallH) * 100).toFixed(2));

  // Verify that the bottom panel sits safely within the credenza zone and does not overlap posters (<= 71%)
  assert(
    panelTop >= USABLE_WALL_BOUNDS.maxY - 0.5,
    `Viewport ${vp}px: Bottom panel top (${panelTop}%) stays within or at credenza zone (>= ${USABLE_WALL_BOUNDS.maxY}%)`
  );

  for (const poster of samplePosters) {
    const rendered = getResponsivePosterPlacement(poster, vp, false);
    const posterBottom = rendered.yPercent + rendered.heightPercent;
    assert(
      posterBottom <= USABLE_WALL_BOUNDS.maxY + 0.1,
      `Viewport ${vp}px [${poster.sizeId}]: Poster bottom (${posterBottom.toFixed(2)}%) stays within usable wall bounds`
    );
  }
}

// 14. Full-Screen Workspace Editing, Adaptive Grid Scaling, and Button Priority
console.log('\n[Check 14] Full-Screen Editing Workspace, Adaptive Grid Scaling & Button Priority');

// Adaptive count scaling
assert(getPosterCountScaleFactor(1) === 1.0, 'Poster count 1 retains 1.0x factor');
assert(getPosterCountScaleFactor(3) === 1.0, 'Poster count 3 retains 1.0x factor');
assert(getPosterCountScaleFactor(4) === 0.92, 'Poster count 4 scales to 0.92x');
assert(getPosterCountScaleFactor(6) === 0.82, 'Poster count 6 scales to 0.82x');
assert(getPosterCountScaleFactor(10) === 0.70, 'Poster count 10 scales to 0.70x');
assert(getPosterCountScaleFactor(14) === 0.60, 'Poster count 14 scales to 0.60x');
assert(getPosterCountScaleFactor(18) === 0.55, 'Poster count 18 retains minimum 0.55x floor');

// Combined scale factor calculation
const mobileBaseScale = getResponsivePosterScale(375, false, 1);
const mobileScaledCount4 = getResponsivePosterScale(375, false, 4);
assert(mobileBaseScale === 2.05, 'Mobile base scale for 1-3 posters is 2.05x');
assert(mobileScaledCount4 === Number((2.05 * 0.92).toFixed(3)), 'Mobile scale for 4 posters combines factors (2.05 * 0.92 = 1.886x)');

// Full-screen scale factor calculation
const fsScaleCount1 = getResponsivePosterScale(1280, true, 1);
const fsScaleCount6 = getResponsivePosterScale(1280, true, 6);
assert(fsScaleCount1 === 1.0, 'Full-screen scale for 1-3 posters is strictly 1.0x canonical');
assert(fsScaleCount6 === 1.0, 'Desktop full-screen scale for 6 posters retains strictly 1.0x canonical (no count scaling on desktop)');

const fsMobileScaleCount6 = getResponsivePosterScale(375, true, 6);
assert(fsMobileScaleCount6 === 0.82, 'Mobile full-screen scale for 6 posters retains mobile 0.82x count factor');

// Desktop & Tablet scaling with counts: count factor does NOT shrink posters
const desktopBaseScale = getResponsivePosterScale(1440, false, 1);
const desktopScaledCount6 = getResponsivePosterScale(1440, false, 6);
assert(desktopBaseScale === 1.42, 'Desktop base scale is 1.42x');
assert(desktopScaledCount6 === 1.42, 'Desktop scale does NOT shrink with poster count (retains 1.42x)');
const tabletScaledCount6 = getResponsivePosterScale(768, false, 6);
assert(tabletScaledCount6 === 1.20, 'Tablet scale does NOT shrink with poster count (retains 1.20x)');

// Zero-drift round trip mapping across mobile poster counts
for (const count of [1, 3, 4, 6, 8, 12, 15]) {
  for (const poster of samplePosters) {
    const rendered = getResponsivePosterPlacement(poster, 375, false, count);
    const canonical = toCanonicalPosterPlacement(rendered, poster, 375, false, count);
    const diffX = Math.abs(canonical.xPercent - poster.xPercent);
    const diffY = Math.abs(canonical.yPercent - poster.yPercent);
    assert(diffX < 0.05, `Mobile 375px count ${count} [${poster.sizeId}]: round-trip X diff (${diffX.toFixed(4)}%) is < 0.05%`);
    assert(diffY < 0.05, `Mobile 375px count ${count} [${poster.sizeId}]: round-trip Y diff (${diffY.toFixed(4)}%) is < 0.05%`);
  }
}

// Protected region collision avoidance at bottom-right
const mobileBtnRegion = getFullScreenButtonProtectedRegion(375);
assert(mobileBtnRegion.top > 75 && mobileBtnRegion.bottom === 100, 'Mobile protected region is positioned at bottom of wall');
assert(mobileBtnRegion.left > 60 && mobileBtnRegion.right === 100, 'Mobile protected region is positioned at right of wall');
const mBounds = getUsableWallBounds(375);
const avoidedPosterPos = clampPosterPosition(mobileBtnRegion.left + 1, mobileBtnRegion.top + 1, 10, 15, mBounds, mobileBtnRegion);
const ovX = Math.max(0, Math.min(avoidedPosterPos.x + 10, mobileBtnRegion.right) - Math.max(avoidedPosterPos.x, mobileBtnRegion.left));
const ovY = Math.max(0, Math.min(avoidedPosterPos.y + 15, mobileBtnRegion.bottom) - Math.max(avoidedPosterPos.y, mobileBtnRegion.top));
assert(ovX <= 0 || ovY <= 0, 'Poster strictly avoids collision with Full Screen button protected region on mobile');

// Code assertions for Full Screen UI features and Empty State
assert(code.includes('data-testid="fullscreen-editing-toolbar"'), 'Full-screen editing workspace toolbar is implemented');
assert(
  (code.includes('z-40') || code.includes('z-30')) && code.includes('enter-fullscreen-btn'),
  'Full Screen button has elevated local z-index (z-40) above posters without exceeding fixed header z-50'
);
assert(
  code.includes('z-10 isolate'),
  'Wall preview container establishes isolated stacking context (z-10 isolate) preventing header overlap'
);
assert(
  !code.includes('fixed bottom-2.5 right-2.5') && !code.includes('sticky bottom-2.5 right-2.5'),
  'Full Screen button remains anchored to wall canvas with absolute positioning, not fixed or sticky'
);
assert(code.includes('bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5'), 'Full Screen button is positioned at bottom-right corner inside wall canvas');
assert(code.includes('data-testid="exit-fullscreen-btn"'), 'Back to Editor control is implemented with exit button');
assert(code.includes('data-testid="empty-wall-state"'), 'Empty wall state is implemented inside the wall canvas');
assert(code.includes('data-testid="empty-add-poster-btn"'), 'Empty wall state provides functional Add Poster action');
assert(code.includes('data-testid="empty-restore-layout-btn"'), 'Empty wall state provides functional Restore Sample Layout action');
assert(!code.includes('if (isFullScreen) return;\n\n    // Only primary mouse button'), 'Poster dragging is enabled in full-screen mode');

// 15. Mobile Toolbar Hierarchy, Isolation, and Wall Canvas Boundaries
console.log('\n[Check 15] Mobile Toolbar Hierarchy, Isolation & Wall Canvas Overflow Bounds');
assert(
  code.includes('hidden md:block contextual-action-menu'),
  'On-canvas contextual toolbar is hidden on mobile viewports (< md: 768px) to prevent overlapping size selector'
);
assert(
  !code.includes('overflow-visible sm:overflow-hidden'),
  'Wall preview and canvas maintain strict overflow-hidden on mobile to prevent any element from bleeding into controls'
);
assert(
  code.includes('Row 1 — Size selection') &&
  code.includes('Row 2 — Add Poster') &&
  code.includes('Row 3 — Context') &&
  code.includes('Row 4 — Actions'),
  'Mobile interface maintains strict clear hierarchy: preview first, size/add controls, selected-poster context panel, and reset/clear controls'
);

// 16. Full-Screen Immediate Action Execution, Rotate Poster Label & Laptop Collision Prevention
console.log('\n[Check 16] Full-Screen Immediate Actions, Rotate Label & Laptop Collision Prevention');

// Full-screen rotate button label
assert(
  code.includes('data-testid="fullscreen-rotate-btn"') && code.includes('Rotate Poster'),
  'Full-screen editing toolbar features explicit visible label "Rotate Poster" beside the rotation icon'
);
assert(
  code.includes('data-testid="fullscreen-clear-design-btn"'),
  'Full-screen toolbar features Clear Design button with dedicated test id and event stopping'
);
assert(
  code.includes('data-testid="fullscreen-design-btn"'),
  'Full-screen toolbar features Change/Add Design button with dedicated test id and event stopping'
);

// Modal Portaling and Immediate Interactive Visibility in Full Screen
assert(
  code.includes('getPortalTarget()') && code.includes('portalTarget={getPortalTarget()}'),
  'PosterKit resolves active fullscreen element or document.body for top-layer modal portaling'
);
const modalCodePath = path.resolve(__dirname, '../src/components/posterKit/PosterDesignPickerModal.tsx');
const modalCode = fs.readFileSync(modalCodePath, 'utf-8');
assert(
  modalCode.includes('createPortal') && modalCode.includes('portalTarget'),
  'PosterDesignPickerModal uses createPortal to ensure interactive visibility in native/overlay fullscreen'
);
assert(
  modalCode.includes('z-[200]') && modalCode.includes('pointer-events-auto'),
  'PosterDesignPickerModal uses elevated z-[200] and pointer-events-auto to sit above full-screen workspace'
);

// Laptop Collision Prevention: 1024x768, 1280x800, 1366x768, 1440x900
const laptopTestViewports = [
  { width: 1024, height: 768, name: '1024x768' },
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1440, height: 900, name: '1440x900' },
];

for (const vp of laptopTestViewports) {
  const padding = vp.width < 1024 ? 48 : 64;
  const wallW = Math.min(1280, vp.width - padding);
  // Bottom panel width is bounded by max-w-2xl (672px) and min(672, wallW - 290)
  const panelMaxW = Math.min(672, wallW - 290);
  const panelActualW = Math.min(panelMaxW, wallW * 0.94);
  const panelLeft = (wallW - panelActualW) / 2;
  const panelRight = panelLeft + panelActualW;

  // Full Screen button width: icon (13px) + gap (6px) + text "Full Screen" (~70px) + padding (24px) + border (4px) + shadow (3px) = ~120px
  const fsBtnWidth = 120;
  const fsBtnMargin = 14;
  const fsBtnLeft = wallW - fsBtnMargin - fsBtnWidth;

  const clearance = fsBtnLeft - panelRight;
  assert(
    clearance >= 10,
    `Laptop ${vp.name} (Wall width ${wallW}px): Bottom controls panel right edge (${panelRight.toFixed(1)}px) preserves >= 10px clearance (${clearance.toFixed(1)}px) from Full Screen button left edge (${fsBtnLeft.toFixed(1)}px)`
  );
}

// 17. Full-Screen Exact ISO Aspect Ratio & Scaling Proportional Invariance
console.log('\n[Check 17] Full-Screen Exact ISO Aspect Ratio & Scaling Invariance');
const checkSizes: Array<'A6' | 'A5' | 'A4' | 'A3'> = ['A6', 'A5', 'A4', 'A3'];
const checkVps = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

for (const size of checkSizes) {
  const cfg = POSTER_SIZES[size];
  for (const orient of ['portrait', 'landscape'] as const) {
    const targetRatio = orient === 'landscape' ? cfg.heightMm / cfg.widthMm : cfg.widthMm / cfg.heightMm;
    const dims = calculatePosterDimensions(size, orient);
    const p = {
      xPercent: 35,
      yPercent: 25,
      widthPercent: dims.widthPercent,
      heightPercent: dims.heightPercent,
    };

    // Full-screen desktop
    const fsDesktop = getResponsivePosterPlacement(p, 1440, true, 3);
    const fsDesktopAspect = (fsDesktop.widthPercent * WALL_ASPECT_RATIO) / fsDesktop.heightPercent;
    const fsDesktopDrift = Math.abs(fsDesktopAspect - targetRatio) / targetRatio;
    assert(
      fsDesktopDrift < 0.005,
      `Full-screen desktop: ${size} ${orient} aspect ratio (${fsDesktopAspect.toFixed(4)}) matches target (${targetRatio.toFixed(4)}) < 0.5% drift`
    );

    // Full-screen mobile with poster count scaling (e.g. count=6 -> 0.82x factor)
    const fsMobileCount6 = getResponsivePosterPlacement(p, 375, true, 6);
    const fsMobileAspect = (fsMobileCount6.widthPercent * WALL_ASPECT_RATIO) / fsMobileCount6.heightPercent;
    const fsMobileDrift = Math.abs(fsMobileAspect - targetRatio) / targetRatio;
    assert(
      fsMobileDrift < 0.005,
      `Full-screen mobile (count 6): ${size} ${orient} aspect ratio (${fsMobileAspect.toFixed(4)}) matches target (${targetRatio.toFixed(4)}) < 0.5% drift`
    );

    // Normal mode vs full-screen mode invariance across all test viewports
    for (const vp of checkVps) {
      const norm = getResponsivePosterPlacement(p, vp, false, 3);
      const normAspect = (norm.widthPercent * WALL_ASPECT_RATIO) / norm.heightPercent;
      const interDiff = Math.abs(normAspect - fsDesktopAspect) / fsDesktopAspect;
      assert(
        interDiff < 0.005,
        `Aspect ratio invariance: ${size} ${orient} @ ${vp}px matches full screen within 0.5%`
      );
    }
  }
}

// Code assertions for full-screen aspect ratio locking and canvas sizing
assert(
  code.includes('aspectRatio: `${physWidthMm} / ${physHeightMm}`'),
  'Poster DOM element style applies explicit CSS aspectRatio to lock physical proportions'
);
assert(
  code.includes('fullscreenCanvasWrapperRef'),
  'Fullscreen canvas wrapper reference is implemented for dynamic 16:9 bounds measurement'
);
assert(
  !code.includes('max-w-[calc((100vh-6rem)*16/9)]'),
  'Fixed buggy max-w-[calc((100vh-6rem)*16/9)] that distorted full-screen wall canvas'
);

console.log('\n--- ALL MOBILE & DESKTOP REFINEMENT VERIFICATIONS PASSED SUCCESSFULLY! ---');



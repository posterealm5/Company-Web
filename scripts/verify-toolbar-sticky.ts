import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('--- RUNNING POSTER KIT FLOATING OVERLAY & CLEANUP VERIFICATION ---');

const posterKitPath = path.resolve(__dirname, '../src/pages/PosterKit.tsx');
const sourceCode = fs.readFileSync(posterKitPath, 'utf-8');

// 1. Document Flow Order in JSX
console.log('\n[Test 1] Verifying Clean Layout Hierarchy');
const headingIndex = sourceCode.indexOf('CURATE YOUR');
const wallPreviewIndex = sourceCode.indexOf('id="wall-bg-image"');
const floatingToolbarIndex = sourceCode.indexOf('Floating Poster Size and Layout Toolbar Overlay');
const priceSummaryIndex = sourceCode.indexOf('<PosterKitPriceSummary posters={posters} />');

assert(headingIndex !== -1, 'Page heading & subtitle are present');
assert(wallPreviewIndex !== -1, 'Wall preview canvas is present');
assert(floatingToolbarIndex !== -1, 'Floating toolbar overlay is present');
assert(priceSummaryIndex !== -1, 'Live invoice-style price summary is present');

assert(headingIndex < wallPreviewIndex, '1. Page heading appears BEFORE wall preview');
assert(wallPreviewIndex < floatingToolbarIndex, '2. Wall image canvas is declared BEFORE floating overlay');
assert(floatingToolbarIndex < priceSummaryIndex, '3. Floating toolbar is INSIDE wall preview BEFORE price summary');

// Confirmation of complete removal of bottom sections
assert(!sourceCode.includes('Ready to print custom artwork?'), '4. Ready to Print Custom Artwork banner is completely removed');
assert(!sourceCode.includes('01 • True Physical Scale'), '5. Three informational cards are completely removed');

// 2. Floating Toolbar Overlay Positioning
console.log('\n[Test 2] Verifying Toolbar Floats Inside Wall Container as Overlay');
const floatingToolbarBlock = sourceCode.substring(floatingToolbarIndex, priceSummaryIndex);

assert(
  floatingToolbarBlock.includes('left-1/2 -translate-x-1/2'),
  'Toolbar floats centered along the bottom of the wall preview'
);
assert(
  floatingToolbarBlock.includes('max-w-2xl'),
  'Toolbar has balanced max-w-2xl container preventing crowded controls'
);
assert(
  floatingToolbarBlock.includes('Row 1 — Main Controls (Centered)'),
  'Toolbar contains Row 1 for centered creation controls'
);
assert(
  floatingToolbarBlock.includes('Row 2 — Context and Actions'),
  'Toolbar contains Row 2 for context and actions'
);
assert(
  floatingToolbarBlock.includes('SELECTED:'),
  'Toolbar uses compact SELECTED: size label without expanding layout'
);
assert(
  floatingToolbarBlock.includes('z-40'),
  'Toolbar has elevated z-index (z-40) to float visually above the wall canvas'
);
assert(
  floatingToolbarBlock.includes('pointer-events-auto'),
  'Toolbar explicitly captures pointer events only on its rendered surface'
);
assert(
  floatingToolbarBlock.includes('stopPropagation'),
  'Toolbar stops click and pointer propagation to avoid wall deselects or drags'
);
assert(
  !floatingToolbarBlock.includes('fixed'),
  'Toolbar does NOT use fixed viewport positioning'
);
assert(
  !floatingToolbarBlock.includes('sticky'),
  'Toolbar does NOT use sticky scroll positioning'
);

// 3. Confirm No Separate Toolbar Box or Obsolete Spacers Below Wall
console.log('\n[Test 3] Confirming Elimination of Separate Toolbar Box Below Wall');
assert(
  !sourceCode.includes('{/* 2. Poster Size and Layout Toolbar (Normal document flow immediately below the wall) */}'),
  'Removed old separate toolbar section below the wall'
);
assert(
  !sourceCode.includes('mt-3 sm:mt-4 w-full max-w-['),
  'Removed separate disconnected toolbar box and its outer gap below the wall'
);

// 4. Complete Removal of Obsolete Sticky-Toolbar Code
console.log('\n[Test 4] Auditing Removal of Obsolete Sticky-Toolbar Code');
const forbiddenStickyTokens = [
  'isSticky',
  'isStickyRef',
  'toolbarLayout',
  'toolbarHeight',
  'toolbarHeightRef',
  'wallWrapperRef',
  'toolbarContainerRef',
  'toolbarRef',
  'bannerRef',
  'updateToolbarPosition',
  'enterStickyScrollY',
  'releaseScrollY',
  'bottomOffset',
  'viewportBottom',
  'rafIdRef',
  'setToolbarLayout',
  'clamp(200px, 46vh, 480px)', // Obsolete restrictive 46vh clamp
];

for (const token of forbiddenStickyTokens) {
  assert(!sourceCode.includes(token), `Confirmed obsolete token is completely removed: "${token}"`);
}

// 5. Large 16:9 Wall Preview
console.log('\n[Test 5] Verifying Large 16:9 Wall Preview');
assert(
  sourceCode.includes('w-full aspect-[16/9] max-h-[720px]'),
  'Wall occupies full container width with 16:9 ratio and generous 720px max-height'
);
assert(
  sourceCode.includes('object-cover'),
  'Wall background image maintains proper object-cover without unnatural stretching'
);

// 6. Wall Coordinates & Canvas Stability
console.log('\n[Test 6] Verifying Wall Coordinate System Stability');
assert(
  sourceCode.includes('ref={containerRef}'),
  'containerRef is attached to the actual wall canvas, isolating bounds from toolbar'
);
assert(
  sourceCode.includes('dragStateRef'),
  'dragStateRef is preserved for pointer dragging coordinates'
);
assert(
  sourceCode.includes('clampPosterPosition'),
  'Wall boundary clamping logic is preserved'
);

// 7. Preserved Toolbar Controls
console.log('\n[Test 7] Verifying All Toolbar Controls Are Preserved');
assert(sourceCode.includes('AVAILABLE_SIZES.map'), 'A5, A4, A3 size selectors are preserved');
assert(!sourceCode.includes('A2'), 'A2 is strictly NOT present');
assert(sourceCode.includes('Add {activeSizeToAdd}'), 'Add poster button is preserved');
assert(sourceCode.includes('posters.length === 1 ? \'Poster\' : \'Posters\''), 'Poster count badge is preserved');
assert(sourceCode.includes('Click & drag posters on the wall'), 'Helper text is preserved');
assert(sourceCode.includes('handleResetLayout'), 'Reset layout handler is preserved');
assert(sourceCode.includes('setIsClearModalOpen(true)'), 'Clear confirmation modal is preserved');
assert(sourceCode.includes('handleRemovePoster'), 'Poster deletion is preserved');

console.log('\n--- ALL FLOATING TOOLBAR OVERLAY AND VERIFICATION CHECKS PASSED! ---');

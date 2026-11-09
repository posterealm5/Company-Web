import fs from 'fs';
import path from 'path';
import {
  getInitialPosters,
  getResponsivePosterPlacement,
  toCanonicalPosterPlacement,
  getPosterCountScaleFactor,
  getResponsivePosterScale,
  calculatePosterDimensions,
  getUsableWallBounds,
  MOBILE_USABLE_WALL_BOUNDS,
  USABLE_WALL_BOUNDS
} from '../src/utils/posterKitMath';
import type { PlacedPoster } from '../src/types/posterKit';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('--- POSTER KIT GROUP SCALING & LAYOUT PERSISTENCE FIX ---');
console.log('======================================================\n');

// --- Suite 1: Three-Poster Original Layout (Screenshot 1) ---
console.log('[Suite 1] Original Three-Poster Layout (Screenshot 1)');
const initialPosters = getInitialPosters();
assert(initialPosters.length === 3, 'Initial layout contains exactly 3 posters');

const vpMobile = 375;
const r1 = getResponsivePosterPlacement(initialPosters[0], vpMobile, false, 3);
const r2 = getResponsivePosterPlacement(initialPosters[1], vpMobile, false, 3);
const r3 = getResponsivePosterPlacement(initialPosters[2], vpMobile, false, 3);

// Horizontal gap between 1 & 2
const gap12_count3 = r2.xPercent - (r1.xPercent + r1.widthPercent);
// Horizontal gap between 2 & 3
const gap23_count3 = r3.xPercent - (r2.xPercent + r2.widthPercent);

assert(gap12_count3 > 0, `Initial gap 1-2 is positive (${gap12_count3.toFixed(3)}%)`);
assert(gap23_count3 > 0, `Initial gap 2-3 is positive (${gap23_count3.toFixed(3)}%)`);

const ratio12_count3 = gap12_count3 / r1.widthPercent;
const ratio23_count3 = gap23_count3 / r3.widthPercent;
console.log(`  Initial 3-poster spacing ratio (gap12 / w1): ${ratio12_count3.toFixed(4)}`);
console.log(`  Initial 3-poster spacing ratio (gap23 / w3): ${ratio23_count3.toFixed(4)}`);


// --- Suite 2: Adding a 4th Poster (Screenshot 2) & Proportional Scaling ---
console.log('\n[Suite 2] Adding a 4th Poster (Screenshot 2) & Proportional Scaling');
const factor4 = getPosterCountScaleFactor(4);
assert(factor4 === 0.92, `Count 4 has factor 0.92x (got ${factor4})`);

const r1_count4 = getResponsivePosterPlacement(initialPosters[0], vpMobile, false, 4);
const r2_count4 = getResponsivePosterPlacement(initialPosters[1], vpMobile, false, 4);
const r3_count4 = getResponsivePosterPlacement(initialPosters[2], vpMobile, false, 4);

// 1. Poster dimensions reduce proportionally by factor4 (0.92)
const w1_scale = r1_count4.widthPercent / r1.widthPercent;
const w2_scale = r2_count4.widthPercent / r2.widthPercent;
const w3_scale = r3_count4.widthPercent / r3.widthPercent;

assert(Math.abs(w1_scale - factor4) < 0.005, `Poster 1 width scaled by ~${factor4} (got ${w1_scale.toFixed(4)})`);
assert(Math.abs(w2_scale - factor4) < 0.005, `Poster 2 width scaled by ~${factor4} (got ${w2_scale.toFixed(4)})`);
assert(Math.abs(w3_scale - factor4) < 0.005, `Poster 3 width scaled by ~${factor4} (got ${w3_scale.toFixed(4)})`);

// 2. Center distance scales proportionally
const dist12_count3 = (r2.xPercent + r2.widthPercent / 2) - (r1.xPercent + r1.widthPercent / 2);
const dist12_count4 = (r2_count4.xPercent + r2_count4.widthPercent / 2) - (r1_count4.xPercent + r1_count4.widthPercent / 2);
const distScale = dist12_count4 / dist12_count3;
assert(Math.abs(distScale - factor4) < 0.005, `Center distance 1-2 scaled proportionally by ${factor4} (got ${distScale.toFixed(4)})`);

// 3. Gap between posters scales proportionally (does NOT expand)
const gap12_count4 = r2_count4.xPercent - (r1_count4.xPercent + r1_count4.widthPercent);
const gap23_count4 = r3_count4.xPercent - (r2_count4.xPercent + r2_count4.widthPercent);

assert(gap12_count4 <= gap12_count3, `Gap 1-2 (${gap12_count4.toFixed(3)}%) did NOT expand above initial (${gap12_count3.toFixed(3)}%)`);
assert(gap23_count4 <= gap23_count3, `Gap 2-3 (${gap23_count4.toFixed(3)}%) did NOT expand above initial (${gap23_count3.toFixed(3)}%)`);

// 4. Relative spacing ratio (Gap / PosterWidth) is preserved
const ratio12_count4 = gap12_count4 / r1_count4.widthPercent;
const ratio23_count4 = gap23_count4 / r3_count4.widthPercent;
assert(
  Math.abs(ratio12_count4 - ratio12_count3) < 0.01,
  `Spacing ratio 1-2 is preserved: count 3 = ${ratio12_count3.toFixed(4)}, count 4 = ${ratio12_count4.toFixed(4)}`
);
assert(
  Math.abs(ratio23_count4 - ratio23_count3) < 0.01,
  `Spacing ratio 2-3 is preserved: count 3 = ${ratio23_count3.toFixed(4)}, count 4 = ${ratio23_count4.toFixed(4)}`
);


// --- Suite 3: Adding More Posters & Verifying No Progressive Spacing Expansion ---
console.log('\n[Suite 3] Adding More Posters (5, 6, 8, 10, 12, 16) - No Progressive Expansion');
const countsToTest = [5, 6, 8, 10, 12, 15, 18];

for (const count of countsToTest) {
  const factor = getPosterCountScaleFactor(count);
  const p1 = getResponsivePosterPlacement(initialPosters[0], vpMobile, false, count);
  const p2 = getResponsivePosterPlacement(initialPosters[1], vpMobile, false, count);
  const p3 = getResponsivePosterPlacement(initialPosters[2], vpMobile, false, count);

  const gap12 = p2.xPercent - (p1.xPercent + p1.widthPercent);
  const gap23 = p3.xPercent - (p2.xPercent + p2.widthPercent);

  // Gaps must NOT expand
  assert(
    gap12 <= gap12_count3,
    `Count ${count} (factor ${factor}x): Gap 1-2 (${gap12.toFixed(3)}%) <= initial (${gap12_count3.toFixed(3)}%)`
  );
  assert(
    gap23 <= gap23_count3,
    `Count ${count} (factor ${factor}x): Gap 2-3 (${gap23.toFixed(3)}%) <= initial (${gap23_count3.toFixed(3)}%)`
  );

  // Relative spacing ratio must stay invariant
  const ratio = gap12 / p1.widthPercent;
  assert(
    Math.abs(ratio - ratio12_count3) < 0.01,
    `Count ${count}: Spacing ratio (${ratio.toFixed(4)}) matches initial (${ratio12_count3.toFixed(4)}) < 0.01`
  );
}


// --- Suite 4: Preserve Manual Dragging & Arrangement ---
console.log('\n[Suite 4] Preserving Manual Arrangements when New Poster Added');

// Customer manually drags Poster 1 slightly to the left (within usable wall bounds) and Poster 3 to the right
const manuallyArrangedPosters: PlacedPoster[] = [
  { ...initialPosters[0], xPercent: 25, yPercent: 22 },
  { ...initialPosters[1], xPercent: 44, yPercent: 18 },
  { ...initialPosters[2], xPercent: 68, yPercent: 24 }
];

// Render under count 3
const manual_p1_c3 = getResponsivePosterPlacement(manuallyArrangedPosters[0], vpMobile, false, 3);
const manual_p2_c3 = getResponsivePosterPlacement(manuallyArrangedPosters[1], vpMobile, false, 3);
const manual_p3_c3 = getResponsivePosterPlacement(manuallyArrangedPosters[2], vpMobile, false, 3);

const manual_gap12_c3 = manual_p2_c3.xPercent - (manual_p1_c3.xPercent + manual_p1_c3.widthPercent);
const manual_gap23_c3 = manual_p3_c3.xPercent - (manual_p2_c3.xPercent + manual_p2_c3.widthPercent);
const manual_ratio12_c3 = manual_gap12_c3 / manual_p1_c3.widthPercent;

// Add 4th poster -> count 4
const manual_p1_c4 = getResponsivePosterPlacement(manuallyArrangedPosters[0], vpMobile, false, 4);
const manual_p2_c4 = getResponsivePosterPlacement(manuallyArrangedPosters[1], vpMobile, false, 4);
const manual_p3_c4 = getResponsivePosterPlacement(manuallyArrangedPosters[2], vpMobile, false, 4);

const manual_gap12_c4 = manual_p2_c4.xPercent - (manual_p1_c4.xPercent + manual_p1_c4.widthPercent);
const manual_ratio12_c4 = manual_gap12_c4 / manual_p1_c4.widthPercent;

assert(
  Math.abs(manual_ratio12_c4 - manual_ratio12_c3) < 0.015,
  `Manual arrangement relative spacing preserved after adding poster: c3 ratio = ${manual_ratio12_c3.toFixed(4)}, c4 ratio = ${manual_ratio12_c4.toFixed(4)}`
);

// Verify round-trip inversion preserves exact manually dragged canonical coordinates
const roundTripP1 = toCanonicalPosterPlacement(manual_p1_c4, manuallyArrangedPosters[0], vpMobile, false, 4);
const roundTripP3 = toCanonicalPosterPlacement(manual_p3_c4, manuallyArrangedPosters[2], vpMobile, false, 4);

assert(
  Math.abs(roundTripP1.xPercent - manuallyArrangedPosters[0].xPercent) < 0.05,
  `Dragged Poster 1 canonical X preserved (${roundTripP1.xPercent.toFixed(2)} vs ${manuallyArrangedPosters[0].xPercent})`
);
assert(
  Math.abs(roundTripP3.xPercent - manuallyArrangedPosters[2].xPercent) < 0.05,
  `Dragged Poster 3 canonical X preserved (${roundTripP3.xPercent.toFixed(2)} vs ${manuallyArrangedPosters[2].xPercent})`
);


// --- Suite 5: Responsive Invariance & Desktop Behaviour ---
console.log('\n[Suite 5] Responsive Invariance & Desktop Behavior');

const desktopVps = [1024, 1280, 1440, 1920];
for (const vp of desktopVps) {
  const d1 = getResponsivePosterPlacement(initialPosters[0], vp, false);
  const d2 = getResponsivePosterPlacement(initialPosters[1], vp, false);
  const d3 = getResponsivePosterPlacement(initialPosters[2], vp, false);

  const desktopGap12 = d2.xPercent - (d1.xPercent + d1.widthPercent);
  const desktopRatio12 = desktopGap12 / d1.widthPercent;

  assert(desktopGap12 > 0, `Desktop ${vp}px: Gap 1-2 is positive (${desktopGap12.toFixed(3)}%)`);
  assert(
    d1.xPercent >= USABLE_WALL_BOUNDS.minX,
    `Desktop ${vp}px: Poster 1 stays inside minX (${d1.xPercent.toFixed(2)} >= ${USABLE_WALL_BOUNDS.minX})`
  );
  assert(
    d3.xPercent + d3.widthPercent <= USABLE_WALL_BOUNDS.maxX + 0.01,
    `Desktop ${vp}px: Poster 3 stays inside maxX (${(d3.xPercent + d3.widthPercent).toFixed(2)} <= ${USABLE_WALL_BOUNDS.maxX})`
  );
}

// Mobile viewports boundary containment
const mobileVps = [320, 360, 375, 390, 430];
for (const vp of mobileVps) {
  const m1 = getResponsivePosterPlacement(initialPosters[0], vp, false, 4);
  const m3 = getResponsivePosterPlacement(initialPosters[2], vp, false, 4);

  assert(
    m1.xPercent >= MOBILE_USABLE_WALL_BOUNDS.minX,
    `Mobile ${vp}px: Poster 1 stays inside mobile minX (${m1.xPercent.toFixed(2)} >= ${MOBILE_USABLE_WALL_BOUNDS.minX})`
  );
  assert(
    m3.xPercent + m3.widthPercent <= MOBILE_USABLE_WALL_BOUNDS.maxX + 0.01,
    `Mobile ${vp}px: Poster 3 stays inside mobile maxX (${(m3.xPercent + m3.widthPercent).toFixed(2)} <= ${MOBILE_USABLE_WALL_BOUNDS.maxX})`
  );
}

console.log(`\n======================================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
}

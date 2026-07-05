import { calculateCustomPosterBasePrice, POSTER_PRICING } from '../src/config/pricing';

const testCases = [
  { id: 1, w: 5, h: 7, desc: '5 × 7 inches (Expected: Cheaper than A5 - 89)' },
  { id: 2, w: 8.3, h: 10, desc: '8.3 × 10 inches (Expected: Approx A4 pricing and NEVER below 220)' },
  { id: 3, w: 11, h: 16, desc: '11 × 16 inches (Expected: Around A3 pricing and NEVER below 299)' },
  { id: 4, w: 16.5, h: 23.4, desc: '16.5 × 23.4 inches (Expected: Around A2 pricing and NEVER below 390)' },
  { id: 5, w: 22, h: 31, desc: '22 × 31 inches (Expected: Higher than A2 according to the pricing formula)' }
];

console.log("=== Pricing Verification ===");
console.log("Standard A5 Price:", POSTER_PRICING.A5);
console.log("Standard A4 Price:", POSTER_PRICING.A4);
console.log("Standard A3 Price:", POSTER_PRICING.A3);
console.log("Standard A2 Price:", POSTER_PRICING.A2);
console.log("-----------------------------------------");

for (const tc of testCases) {
  const price = calculateCustomPosterBasePrice(tc.w, tc.h);
  console.log(`Example ${tc.id}: ${tc.w} x ${tc.h} inches`);
  console.log(`Description: ${tc.desc}`);
  console.log(`Calculated Price: ₹${price}`);
  console.log("-----------------------------------------");
}

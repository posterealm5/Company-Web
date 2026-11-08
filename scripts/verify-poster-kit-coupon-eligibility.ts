import fs from 'fs';
import path from 'path';
import {
  COUPONS,
  Coupon,
  validateCoupon,
  calculateCouponDiscount,
  isPosterKitItem
} from '../src/config/coupons';
import { CartItem } from '../src/context/CartContext';
import { PosterKitCouponModalMode } from '../src/components/cart/PosterKitCouponModal';

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

function makeRegularItem(id: number, qty = 1, price = 199): CartItem {
  return {
    id,
    name: `Standard Poster ${id}`,
    size: 'A4',
    material: 'Matte',
    price,
    unit_price: price,
    line_total: price * qty,
    quantity: qty,
    image: '/images/poster1.jpg',
    selected: true,
  };
}

function makePosterKitItem(id: number, qty = 1, price = 299): CartItem {
  return {
    id,
    name: `Poster Kit Item ${id}`,
    size: 'A4',
    material: 'Matte',
    price,
    unit_price: price,
    line_total: price * qty,
    quantity: qty,
    image: '/images/pk1.jpg',
    selected: true,
    isPosterKit: true,
    posterKit: true,
    origin: 'poster_kit',
  };
}

console.log('\n--- 1. Poster Kit Identification Verification ---');
{
  const reg = makeRegularItem(1);
  const pk1 = makePosterKitItem(2);
  const pk2 = { ...makeRegularItem(3), isPosterKit: true };
  const pk3 = { ...makeRegularItem(4), posterKit: true };
  const pk4 = { ...makeRegularItem(5), origin: 'poster_kit' };

  assert(!isPosterKitItem(reg), 'Regular item is not detected as Poster Kit');
  assert(isPosterKitItem(pk1), 'Poster Kit item with full flags detected');
  assert(isPosterKitItem(pk2), 'Poster Kit item with isPosterKit detected');
  assert(isPosterKitItem(pk3), 'Poster Kit item with posterKit detected');
  assert(isPosterKitItem(pk4), 'Poster Kit item with origin: poster_kit detected');
}

console.log('\n--- 2. Coupon Validation & Eligibility ---');
{
  const b5g2f = COUPONS.find(c => c.code === 'B5G2F')!;
  const save10 = COUPONS.find(c => c.code === 'SAVE10')!;

  // Test Case 1: Regular posters + Buy X Get Y
  const fourRegular = [makeRegularItem(1, 4)];
  const fiveRegular = [makeRegularItem(1, 5)];
  const v4 = validateCoupon(b5g2f, fourRegular);
  assert(!v4.isValid, '4 regular posters do not qualify for B5G2F (needs 5)');
  const v5 = validateCoupon(b5g2f, fiveRegular);
  assert(v5.isValid, '5 regular posters qualify for B5G2F');

  // Test Case 2: Poster Kit only + Buy X Get Y (rejected)
  const fivePosterKit = [makePosterKitItem(10, 5)];
  const vPkOnly = validateCoupon(b5g2f, fivePosterKit);
  assert(!vPkOnly.isValid, '5 Poster Kit items alone are rejected for B5G2F');
  assert(vPkOnly.isPosterKitOnly === true, 'vPkOnly sets isPosterKitOnly flag');
  assert(vPkOnly.error === 'Coupon not applicable to Poster Kit', 'Error message matches specification');

  // Test Case 3: Poster Kit only + Percentage-off coupon (accepted)
  const vPkPercent = validateCoupon(save10, fivePosterKit);
  assert(vPkPercent.isValid, 'Poster Kit items qualify for percentage coupon SAVE10');
  const pkDiscount = calculateCouponDiscount(save10, fivePosterKit);
  assert(pkDiscount === Math.round(5 * 299 * 0.1), `SAVE10 calculates correct percentage discount (₹${pkDiscount}) on Poster Kit`);

  // Test Case 4: Mixed cart + Buy X Get Y
  // 2 regular + 3 poster kit (total 5 items, but only 2 regular) -> insufficient regular
  const mixedInsufficient = [makeRegularItem(1, 2), makePosterKitItem(10, 3)];
  const vMixedInsuf = validateCoupon(b5g2f, mixedInsufficient);
  assert(!vMixedInsuf.isValid, 'Mixed cart with only 2 regular posters does NOT qualify for B5G2F');
  assert(vMixedInsuf.hasPosterKitItems === true, 'hasPosterKitItems is flagged for mixed cart');

  // 5 regular + 3 poster kit -> regular posters qualify
  const mixedSufficient = [makeRegularItem(1, 5), makePosterKitItem(10, 3)];
  const vMixedSuf = validateCoupon(b5g2f, mixedSufficient);
  assert(vMixedSuf.isValid, 'Mixed cart with 5 regular posters qualifies for B5G2F');
  assert(vMixedSuf.hasPosterKitItems === true, 'hasPosterKitItems is true for mixed cart');

  // Test Case 5: Mixed cart + percentage-off coupon
  const vMixedPercent = validateCoupon(save10, mixedSufficient);
  assert(vMixedPercent.isValid, 'Mixed cart qualifies for percentage coupon SAVE10');
  const mixedSubtotal = (5 * 199) + (3 * 299);
  const mixedDiscount = calculateCouponDiscount(save10, mixedSufficient);
  assert(mixedDiscount === Math.round(mixedSubtotal * 0.1), `SAVE10 calculates 10% on mixed subtotal (₹${mixedDiscount})`);
}

console.log('\n--- 3. Buy X Get Y Discount & Free Items Exclusion ---');
{
  const b5g2f = COUPONS.find(c => c.code === 'B5G2F')!;

  // Cart with 5 paid regular + 2 free regular + 1 paid Poster Kit
  const itemsWithFreeRegular: CartItem[] = [
    makeRegularItem(1, 5, 199),
    {
      ...makeRegularItem(2, 2, 199),
      isFreeItem: true,
      line_total: 199 * 2, // discount calculator sums line_total of free items
    },
    makePosterKitItem(10, 1, 350)
  ];

  const disc = calculateCouponDiscount(b5g2f, itemsWithFreeRegular);
  assert(disc === 398, `B5G2F discounts only free regular items (₹${disc}) and ignores Poster Kit`);

  // Even if a Poster Kit item hypothetically had isFreeItem: true, calculateCouponDiscount must exclude it
  const itemsWithCorruptedPkFree: CartItem[] = [
    makeRegularItem(1, 5, 199),
    {
      ...makeRegularItem(2, 2, 199),
      isFreeItem: true,
      line_total: 398,
    },
    {
      ...makePosterKitItem(10, 1, 350),
      isFreeItem: true,
      line_total: 350,
    }
  ];
  const safeDisc = calculateCouponDiscount(b5g2f, itemsWithCorruptedPkFree);
  assert(safeDisc === 398, `calculateCouponDiscount strictly excludes Poster Kit items even if marked free (₹${safeDisc})`);
}

console.log('\n--- 4. PosterKitCouponModal Component & Design Specification ---');
{
  const modalPath = path.resolve(process.cwd(), 'src/components/cart/PosterKitCouponModal.tsx');
  assert(fs.existsSync(modalPath), 'PosterKitCouponModal.tsx file exists');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');

  // Check required heading
  assert(
    modalContent.includes('Coupon Not Applicable to Poster Kit'),
    'Modal contains exact heading: "Coupon Not Applicable to Poster Kit"'
  );

  // Check required poster kit only message
  const expectedPkOnlyMsg =
    'This Buy X Get Y offer is valid only on eligible individual posters. Poster Kit products are excluded from this promotion. You can use an eligible percentage-off coupon on your Poster Kit instead.';
  assert(modalContent.includes(expectedPkOnlyMsg), 'Modal contains exact Poster Kit only message');

  // Check required mixed cart message
  const expectedMixedMsg =
    'Your Buy X Get Y offer applies only to eligible individual posters. Poster Kit products in your cart are excluded from this promotion.';
  assert(modalContent.includes(expectedMixedMsg), 'Modal contains exact mixed cart message');

  // Check required button text
  assert(modalContent.includes('OKAY'), 'Modal contains "OKAY" button text');

  // Check Posterealm styling: red, black, white
  assert(modalContent.includes('bg-brand-red'), 'Modal uses brand-red styling');
  assert(modalContent.includes('border-brand-black'), 'Modal uses brand-black border styling');
  assert(modalContent.includes('dark:bg-zinc-900'), 'Modal supports dark mode');

  // Check dismissal behavior
  assert(modalContent.includes('onClose'), 'Modal triggers onClose upon clicking OKAY');
  assert(modalContent.includes('Escape'), 'Modal handles Escape key for dismissal');
  assert(!modalContent.includes('clearCart'), 'Modal dismissal does NOT clear cart');
  assert(!modalContent.includes('alert('), 'Modal does NOT use browser alert()');
}

console.log('\n--- 5. CartContext & Cart UI Integration ---');
{
  const contextPath = path.resolve(process.cwd(), 'src/context/CartContext.tsx');
  const contextContent = fs.readFileSync(contextPath, 'utf-8');

  assert(contextContent.includes('PosterKitCouponModal'), 'CartContext imports PosterKitCouponModal');
  assert(contextContent.includes('posterKitCouponModal'), 'CartContext manages posterKitCouponModal state');
  assert(contextContent.includes('dismissPosterKitCouponModal'), 'CartContext exposes dismissPosterKitCouponModal');
  assert(contextContent.includes('openPosterKitCouponModal'), 'CartContext exposes openPosterKitCouponModal');
  assert(
    contextContent.includes('<PosterKitCouponModal'),
    'CartProvider renders root PosterKitCouponModal to prevent stacked modals'
  );

  // Check syncCartState logic
  assert(
    contextContent.includes('item.selected && !isPosterKitItem(item)'),
    'syncCartState filters only eligible regular posters for Buy X Get Y calculations'
  );
  assert(
    contextContent.includes('if (isPosterKitItem(item))'),
    'syncCartState preserves Poster Kit items intact and prevents free item conversion'
  );

  // Check applyCoupon logic
  assert(
    contextContent.includes("mode: 'poster_kit_only'"),
    'applyCoupon triggers poster_kit_only mode modal when cart has only Poster Kit items'
  );
  assert(
    contextContent.includes("mode: 'mixed'"),
    'applyCoupon triggers mixed mode modal when cart contains both regular and Poster Kit items'
  );

  // Check Cart.tsx exclusions
  const cartPagePath = path.resolve(process.cwd(), 'src/pages/Cart.tsx');
  const cartPageContent = fs.readFileSync(cartPagePath, 'utf-8');
  assert(
    cartPageContent.includes("!Boolean(item.isPosterKit || item.posterKit || item.origin === 'poster_kit')"),
    'Cart.tsx excludes Poster Kit items from automaticFreeCount and numSlots calculations'
  );
  assert(
    cartPageContent.includes('paidSelectedItems = cartItems.filter'),
    'Cart.tsx Available Offers excludes Poster Kit items from promotion progress count'
  );
}

console.log('\n--- 6. No Alert() & No Forbidden Modifications ---');
{
  const filesToCheck = [
    'src/context/CartContext.tsx',
    'src/config/coupons.ts',
    'src/pages/Cart.tsx',
    'src/components/cart/PosterKitCouponModal.tsx'
  ];

  filesToCheck.forEach(file => {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8');
    assert(!content.includes('alert('), `${file} does not call window.alert()`);
  });
}

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}


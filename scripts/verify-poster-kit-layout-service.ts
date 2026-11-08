import {
  validateLayoutPayload,
  calculate7DayTtl,
  extractCartPosterUnits,
  isPosterMatchingCartUnit,
  matchLayoutToOneToOneCartUnits,
  persistPosterKitLayout,
  persistCheckoutPosterKitLayout,
  CHECKOUT_POSTER_KIT_LAYOUT_SESSION_KEY,
  PosterKitLayoutItemPayload,
} from '../src/services/posterKitLayoutService';
import type { PlacedPoster } from '../src/types/posterKit';
import type { CartItem } from '../src/context/CartContext';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${desc}`);
  }
}

async function runTests() {
  console.log('--- Phase 3C Stage 2.2: Poster Kit Layout Service Verification ---');

  // 1. Validation Tests
  console.log('\n[Suite 1] validateLayoutPayload');
  {
    const validItem: PosterKitLayoutItemPayload = {
      id: 'poster-1',
      sizeId: 'A4',
      orientation: 'portrait',
      material: 'matte',
      xPercent: 10,
      yPercent: 10,
      widthPercent: 20,
      heightPercent: 30,
      label: 'Poster #1',
      unitPrice: 100,
    };

    assert(!validateLayoutPayload(null as any).isValid, 'Rejects null input');
    assert(!validateLayoutPayload({ items: [], subtotal: 100 }).isValid, 'Rejects empty items array');
    assert(!validateLayoutPayload({ items: [validItem, validItem], subtotal: 200 }).isValid, 'Rejects < 3 items');
    assert(!validateLayoutPayload({ items: [validItem, validItem, validItem], subtotal: -10 }).isValid, 'Rejects negative subtotal');
    assert(!validateLayoutPayload({ items: [validItem, validItem, validItem], subtotal: NaN }).isValid, 'Rejects NaN subtotal');
    assert(!validateLayoutPayload({ items: [validItem, validItem, validItem], subtotal: Infinity }).isValid, 'Rejects Infinity subtotal');

    // Missing or empty field in item
    const missingFieldItem: any = { ...validItem };
    delete missingFieldItem.material;
    assert(!validateLayoutPayload({ items: [validItem, validItem, missingFieldItem], subtotal: 300 }).isValid, 'Rejects missing material in item');

    const emptyIdItem: any = { ...validItem, id: '   ' };
    assert(!validateLayoutPayload({ items: [validItem, validItem, emptyIdItem], subtotal: 300 }).isValid, 'Rejects empty id in item');

    const emptyLabelItem: any = { ...validItem, label: '' };
    assert(!validateLayoutPayload({ items: [validItem, validItem, emptyLabelItem], subtotal: 300 }).isValid, 'Rejects empty label in item');

    // Invalid coordinates
    const outOfBoundsItem: PosterKitLayoutItemPayload = { ...validItem, xPercent: 120 };
    assert(!validateLayoutPayload({ items: [validItem, validItem, outOfBoundsItem], subtotal: 300 }).isValid, 'Rejects out-of-bounds coordinate');

    // Valid 3-item payload
    const valid3Items: PosterKitLayoutItemPayload[] = [
      { ...validItem, id: 'poster-1' },
      { ...validItem, id: 'poster-2', sizeId: 'A3', material: 'glossy' },
      { ...validItem, id: 'poster-3', sizeId: 'A5', material: 'rigid_board' },
    ];
    assert(validateLayoutPayload({ items: valid3Items, subtotal: 350 }).isValid, 'Accepts valid 3-item layout with non-negative subtotal');
  }

  // 2. TTL Tests
  console.log('\n[Suite 2] calculate7DayTtl');
  {
    const ttl = calculate7DayTtl();
    const createdMs = new Date(ttl.createdAt).getTime();
    const expiresMs = new Date(ttl.expiresAt).getTime();
    const diffDays = (expiresMs - createdMs) / (1000 * 60 * 60 * 24);

    assert(expiresMs > createdMs, 'expires_at is strictly in the future of created_at');
    assert(Math.abs(diffDays - 7) < 0.001, 'TTL duration is exactly 7 days');
  }

  // 3. extractCartPosterUnits
  console.log('\n[Suite 3] extractCartPosterUnits');
  {
    const rawCart: CartItem[] = [
      {
        id: 101,
        name: 'Regular Storefront Poster',
        size: 'A4',
        material: 'Matte',
        price: 299,
        quantity: 1,
        image: 'https://example.com/regular.jpg',
        selected: true,
      },
      {
        id: 201,
        name: 'Custom Design',
        size: 'A4',
        material: 'Matte',
        price: 100,
        quantity: 2, // Quantity 2 -> must expand to 2 units
        image: 'https://example.com/custom-preview.webp',
        isPosterKit: true,
        origin: 'poster_kit',
        customArtworkId: 'ca_123',
        selected: true,
      },
      {
        id: 301,
        name: 'Collection Poster',
        size: 'A3',
        material: 'Glossy',
        price: 130,
        quantity: 1,
        image: 'https://example.com/collection.jpg',
        isPosterKit: true,
        origin: 'poster_kit',
        productId: 5,
        selected: false, // Unselected -> must be ignored!
      },
      {
        id: 401,
        name: 'Selected Collection Poster',
        size: 'A3',
        material: 'Glossy',
        price: 130,
        quantity: 1,
        image: 'https://example.com/collection-selected.jpg',
        isPosterKit: true,
        origin: 'poster_kit',
        productId: 5,
        selected: true,
      },
    ];

    const units = extractCartPosterUnits(rawCart);
    assert(units.length === 3, 'Expands quantity 2 + quantity 1 into 3 distinct units; excludes non-PK and unselected items');
    assert(units[0].cartItemId === 201 && units[0].unitIndex === 0, 'First expanded unit has index 0');
    assert(units[1].cartItemId === 201 && units[1].unitIndex === 1, 'Second expanded unit has index 1');
    assert(units[2].cartItemId === 401 && units[2].productId === 5, 'Third unit is selected collection item');
  }

  // 4. One-to-one matching
  console.log('\n[Suite 4] matchLayoutToOneToOneCartUnits (Strict 1-to-1 bipartite matching)');
  {
    const posterA: PlacedPoster = {
      id: 'p-1',
      sizeId: 'A4',
      orientation: 'portrait',
      material: 'matte',
      xPercent: 10,
      yPercent: 10,
      widthPercent: 20,
      heightPercent: 30,
      label: 'Poster #1',
      artworkSource: 'custom',
      customArtworkId: 'ca_user1_artA',
    };

    const posterB: PlacedPoster = {
      id: 'p-2',
      sizeId: 'A4',
      orientation: 'portrait',
      material: 'matte',
      xPercent: 35,
      yPercent: 10,
      widthPercent: 20,
      heightPercent: 30,
      label: 'Poster #2',
      artworkSource: 'custom',
      customArtworkId: 'ca_user1_artA', // Duplicate artwork at different position
    };

    const posterC: PlacedPoster = {
      id: 'p-3',
      sizeId: 'A3',
      orientation: 'portrait',
      material: 'glossy',
      xPercent: 60,
      yPercent: 10,
      widthPercent: 25,
      heightPercent: 35,
      label: 'Poster #3',
      artworkSource: 'collection',
      artworkProductId: 10,
    };

    // Case 4.1: Count mismatch
    const resCountMismatch = matchLayoutToOneToOneCartUnits([posterA, posterB, posterC], [
      { cartItemId: 1, unitIndex: 0, size: 'A4', material: 'matte', price: 100, customArtworkId: 'ca_user1_artA', isPosterKit: true },
      { cartItemId: 1, unitIndex: 1, size: 'A4', material: 'matte', price: 100, customArtworkId: 'ca_user1_artA', isPosterKit: true },
    ]);
    assert(!resCountMismatch.matched && resCountMismatch.reason === 'count_mismatch', 'Rejects count mismatch (3 posters vs 2 cart units)');

    // Case 4.2: Exact match with duplicate posters
    const resExactMatch = matchLayoutToOneToOneCartUnits([posterA, posterB, posterC], [
      { cartItemId: 1, unitIndex: 0, size: 'A4', material: 'matte', price: 100, customArtworkId: 'ca_user1_artA', isPosterKit: true },
      { cartItemId: 1, unitIndex: 1, size: 'A4', material: 'matte', price: 100, customArtworkId: 'ca_user1_artA', isPosterKit: true },
      { cartItemId: 2, unitIndex: 0, size: 'A3', material: 'glossy', price: 130, productId: 10, isPosterKit: true },
    ]);
    assert(resExactMatch.matched, 'Matches 3 posters including duplicate custom artwork 1-to-1 without ambiguity');

    // Case 4.3: Composition mismatch (different material in cart)
    const resMaterialMismatch = matchLayoutToOneToOneCartUnits([posterA, posterB, posterC], [
      { cartItemId: 1, unitIndex: 0, size: 'A4', material: 'matte', price: 100, customArtworkId: 'ca_user1_artA', isPosterKit: true },
      { cartItemId: 1, unitIndex: 1, size: 'A4', material: 'rigid_board', price: 230, customArtworkId: 'ca_user1_artA', isPosterKit: true }, // Changed material!
      { cartItemId: 2, unitIndex: 0, size: 'A3', material: 'glossy', price: 130, productId: 10, isPosterKit: true },
    ]);
    assert(!resMaterialMismatch.matched, 'Rejects mismatch when cart item has different material than saved layout');

    // Case 4.4: Composition mismatch (different artwork in cart)
    const resArtworkMismatch = matchLayoutToOneToOneCartUnits([posterA, posterB, posterC], [
      { cartItemId: 1, unitIndex: 0, size: 'A4', material: 'matte', price: 100, customArtworkId: 'ca_different', isPosterKit: true },
      { cartItemId: 1, unitIndex: 1, size: 'A4', material: 'matte', price: 100, customArtworkId: 'ca_user1_artA', isPosterKit: true },
      { cartItemId: 2, unitIndex: 0, size: 'A3', material: 'glossy', price: 130, productId: 10, isPosterKit: true },
    ]);
    assert(!resArtworkMismatch.matched, 'Rejects mismatch when cart item has different customArtworkId than saved layout');
  }

  // 5. Service Safety & Guest Guard
  console.log('\n[Suite 5] persistCheckoutPosterKitLayout & Error Resilience');
  {
    // Guest safety
    const resGuest = await persistCheckoutPosterKitLayout(null, []);
    assert(!resGuest.success && resGuest.reason === 'unauthenticated', 'Guest users fail gracefully with unauthenticated reason');

    // Insufficient items (< 3)
    const resInsufficient = await persistCheckoutPosterKitLayout('3e5d32c0-8d5f-4a0b-93f9-71b31a88b5a8', [
      {
        id: 1,
        name: 'Custom',
        size: 'A4',
        material: 'Matte',
        price: 100,
        quantity: 1,
        image: 'test',
        isPosterKit: true,
        selected: true,
      },
    ]);
    assert(!resInsufficient.success && resInsufficient.reason === 'insufficient_items', 'Rejects bag with < 3 Poster Kit items');

    // Missing saved layout on device
    const resNoLayout = await persistCheckoutPosterKitLayout('3e5d32c0-8d5f-4a0b-93f9-71b31a88b5a8', [
      { id: 1, name: 'C1', size: 'A4', material: 'Matte', price: 100, quantity: 1, image: 't', isPosterKit: true, selected: true },
      { id: 2, name: 'C2', size: 'A4', material: 'Matte', price: 100, quantity: 1, image: 't', isPosterKit: true, selected: true },
      { id: 3, name: 'C3', size: 'A4', material: 'Matte', price: 100, quantity: 1, image: 't', isPosterKit: true, selected: true },
    ]);
    assert(!resNoLayout.success && resNoLayout.reason === 'no_saved_layout_found', 'Rejects persistence when no saved layout exists on device (no synthetic fakes)');
  }

  console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${failedTests} failures)`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});


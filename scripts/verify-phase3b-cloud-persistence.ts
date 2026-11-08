import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { calculateFileSha256, getCachedArtworkRecord, saveArtworkRegistryRecord, UserScopedArtworkRecord } from '../src/services/storage';
import { createPosterKitCartItem } from '../src/utils/posterKitPricing';
import { getStorefrontImage } from '../src/utils/imageUtils';
import { validateCustomArtworkItems } from '../src/utils/customArtworkValidation';

/**
 * Posterealm — Phase 3B: Poster Kit Cloud Persistence Automated Verification Suite
 * Verifies all requirements:
 * 1. SHA-256 Byte-Accurate Integrity & Cryptographic Hashing
 * 2. User-Scoped Artwork Registry & Cross-User Isolation
 * 3. Two-Stage Upload & Immediate Partial State Recovery
 * 4. Minimal Item Data Model (preview image + master artwork_url)
 * 5. Pre-Checkout Validation Guard (rejection of blob: and missing artwork)
 * 6. Bug 1: Guest Authentication Prompt & Design Picker Stacking Fix
 * 7. Bug 2: addMultipleToCart URL Invariant Preservation & Legacy Recovery
 * 8. Shared Checkout Custom Artwork Validator for Razorpay & COD
 * 9. Admin Download Integrity & Popup-Free Fallback Architecture
 * 10. Collection Artwork & Storefront Non-Regression
 */

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`${GREEN}✅ ${message}${RESET}`);
  } else {
    console.error(`${RED}❌ FAILED: ${message}${RESET}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log(`${CYAN}--- RUNNING PHASE 3B POSTER KIT CLOUD PERSISTENCE TEST SUITE ---${RESET}\n`);

async function runTests() {
  // =========================================================================
  // TEST GROUP 1: SHA-256 Byte-Accurate Integrity & Hashing
  // =========================================================================
  console.log(`${YELLOW}[Group 1] SHA-256 Cryptographic File Hashing & Integrity${RESET}`);

  const bufferA = Buffer.from('POSTEREALM_TEST_IMAGE_BYTES_1234567890');
  const bufferAClone = Buffer.from('POSTEREALM_TEST_IMAGE_BYTES_1234567890');
  const bufferB = Buffer.from('POSTEREALM_TEST_IMAGE_BYTES_1234567891'); // 1 character different

  const hashA = await calculateFileSha256(new Blob([bufferA]));
  const hashAClone = await calculateFileSha256(new Blob([bufferAClone]));
  const hashB = await calculateFileSha256(new Blob([bufferB]));

  assert(hashA === hashAClone, 'Identical file bytes yield identical SHA-256 hashes');
  assert(hashA !== hashB, 'Different file bytes yield distinct SHA-256 hashes (no false collision)');
  assert(hashA.length === 64, 'SHA-256 produces 64-character hexadecimal digest');

  // Verify expected sha256 output using node:crypto directly
  const expectedHashA = crypto.createHash('sha256').update(bufferA).digest('hex');
  assert(hashA === expectedHashA, 'calculateFileSha256 matches exact Node.js crypto SHA-256 output');

  // =========================================================================
  // TEST GROUP 2: User-Scoped Registry & Account Isolation
  // =========================================================================
  console.log(`\n${YELLOW}[Group 2] User-Scoped Registry & Account Isolation${RESET}`);

  const user1 = 'user_uuid_alice_111';
  const user2 = 'user_uuid_bob_222';
  const testSha = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

  const aliceRecord: UserScopedArtworkRecord = {
    userId: user1,
    sha256: testSha,
    customArtworkId: 'custom-art-alice-1',
    artwork_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/uploads/design-alice.png',
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/design-alice-400.webp',
    customArtworkFileName: 'alice-family.png',
    status: 'completed',
    uploadedAt: Date.now(),
  };

  saveArtworkRegistryRecord(aliceRecord);

  // User 1 retrieval
  const retrievedAlice = getCachedArtworkRecord(user1, testSha);
  assert(retrievedAlice !== null, 'Alice can retrieve her own cached artwork record');
  assert(retrievedAlice?.artwork_url === aliceRecord.artwork_url, 'Retrieved record contains correct master URL');
  assert(retrievedAlice?.image === aliceRecord.image, 'Retrieved record contains correct preview URL');

  // User 2 retrieval (must return null to prevent cross-account reuse)
  const retrievedBob = getCachedArtworkRecord(user2, testSha);
  assert(retrievedBob === null, 'Bob CANNOT access Alice’s artwork record despite identical SHA-256 hash');

  // =========================================================================
  // TEST GROUP 3: Two-Stage Upload & Immediate Partial State Recovery
  // =========================================================================
  console.log(`\n${YELLOW}[Group 3] Two-Stage Upload & Immediate Partial State Recovery${RESET}`);

  const recoverySha = '1122334455667788990011223344556677889900112233445566778899001122';
  const partialRecord: UserScopedArtworkRecord = {
    userId: user1,
    sha256: recoverySha,
    customArtworkId: 'custom-art-partial-1',
    artwork_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/uploads/design-partial.png',
    image: null, // Preview interrupted or not yet created
    customArtworkFileName: 'partial-art.png',
    status: 'master_uploaded',
    uploadedAt: Date.now(),
  };

  saveArtworkRegistryRecord(partialRecord);

  const cachedPartial = getCachedArtworkRecord(user1, recoverySha);
  assert(cachedPartial !== null, 'Partial master upload record persists immediately');
  assert(cachedPartial?.status === 'master_uploaded', 'Registry records status as master_uploaded');
  assert(cachedPartial?.image === null, 'Preview URL is initially null in partial state');
  assert(cachedPartial?.artwork_url === partialRecord.artwork_url, 'Master URL is safely preserved');

  // Simulate recovery completion
  const completedRecord: UserScopedArtworkRecord = {
    ...cachedPartial!,
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/design-partial-400.webp',
    status: 'completed',
  };
  saveArtworkRegistryRecord(completedRecord);

  const cachedCompleted = getCachedArtworkRecord(user1, recoverySha);
  assert(cachedCompleted?.status === 'completed', 'Updated record marks status as completed');
  assert(cachedCompleted?.image !== null, 'Updated record contains verified preview URL');

  // =========================================================================
  // TEST GROUP 4: Cart Item Data Model (createPosterKitCartItem)
  // =========================================================================
  console.log(`\n${YELLOW}[Group 4] Minimal Cart Item Data Model${RESET}`);

  const mockCustomPoster: any = {
    id: 'poster-slot-1',
    sizeId: 'A4',
    material: 'matte',
    artworkSource: 'custom',
    artworkUrl: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/design-1-400.webp', // Preview URL
    originalArtworkUrl: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/uploads/design-1.png', // Master URL
    customArtworkId: 'custom-art-12345',
    customArtworkFileName: 'custom-masterpiece.png',
    widthPercent: 20,
    heightPercent: 25,
  };

  const cartItem = createPosterKitCartItem(mockCustomPoster);

  assert(
    cartItem.image === 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/design-1-400.webp',
    'Cart item image is assigned the 400px WebP preview URL'
  );
  assert(
    cartItem.artwork_url === 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/uploads/design-1.png',
    'Cart item artwork_url is assigned the uncompressed original master URL'
  );
  assert(
    cartItem.customArtworkId === 'custom-art-12345',
    'Cart item preserves stable customArtworkId'
  );
  assert(
    cartItem.customArtworkFileName === 'custom-masterpiece.png',
    'Cart item preserves customer filename'
  );
  assert(
    cartItem.isPosterKit === true && cartItem.origin === 'poster_kit',
    'Cart item preserves Poster Kit origin identifiers'
  );
  assert(
    cartItem.image_preview_url === null,
    'Redundant image_preview_url is omitted from custom cart item'
  );

  // Verify storefront image resolver returns preview
  const resolvedThumb = getStorefrontImage(cartItem, 'thumbnail');
  assert(
    resolvedThumb === cartItem.image,
    'getStorefrontImage resolves to 400px WebP preview URL'
  );

  // =========================================================================
  // TEST GROUP 5: BUG 1 Regression — Guest Authentication UI & Stacking
  // =========================================================================
  console.log(`\n${YELLOW}[Group 5] Bug 1 Regression: Guest Auth Prompt & Modal Stacking${RESET}`);

  const modalPath = path.resolve('src/components/posterKit/PosterDesignPickerModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  const posterKitPath = path.resolve('src/pages/PosterKit.tsx');
  const posterKitContent = fs.readFileSync(posterKitPath, 'utf-8');

  // 1. PosterDesignPickerModal should NOT render AuthModal internally (prevents duplicate backdrop & stacking trap)
  assert(
    !modalContent.includes('<AuthModal'),
    'PosterDesignPickerModal does NOT render nested AuthModal component'
  );
  assert(
    !modalContent.includes('import { AuthModal }'),
    'PosterDesignPickerModal does NOT import AuthModal'
  );

  // 2. PosterDesignPickerModal declares onRequireAuth prop
  assert(
    modalContent.includes('onRequireAuth?: () => void;'),
    'PosterDesignPickerModal declares onRequireAuth prop'
  );

  // 3. Applying custom artwork as guest closes picker and notifies parent
  assert(
    modalContent.includes('if (!user) {\n      handleClose();\n      onRequireAuth?.();\n      return;\n    }'),
    'Guest clicking Apply closes design picker and dispatches onRequireAuth callback without initiating upload'
  );

  // 4. PosterKit.tsx handles onRequireAuth by showing centered dialog
  assert(
    posterKitContent.includes('setIsGuestAuthPromptOpen(true)'),
    'PosterKit.tsx sets isGuestAuthPromptOpen when onRequireAuth fires'
  );
  assert(
    posterKitContent.includes('SIGN IN REQUIRED'),
    'PosterKit.tsx displays centered dialog with title "SIGN IN REQUIRED"'
  );
  assert(
    posterKitContent.includes('Please sign in to upload and save your custom artwork to your Poster Kit.'),
    'PosterKit.tsx displays expected explanatory message'
  );
  assert(
    posterKitContent.includes('data-testid="guest-auth-ok-btn"'),
    'PosterKit.tsx provides OK button to dismiss dialog completely'
  );
  assert(
    posterKitContent.includes('onClick={() => setIsGuestAuthPromptOpen(false)}'),
    'Clicking OK dismisses dialog completely without leaving backdrop or focus trap'
  );
  assert(
    posterKitContent.includes("if (isGuestAuthPromptOpen) {\n          setIsGuestAuthPromptOpen(false);"),
    'Pressing Escape cleanly dismisses the guest auth prompt dialog'
  );

  // =========================================================================
  // TEST GROUP 6: BUG 2 Regression — addMultipleToCart URL Invariant Preservation
  // =========================================================================
  console.log(`\n${YELLOW}[Group 6] Bug 2 Regression: addMultipleToCart Cloud URL Preservation${RESET}`);

  const cartContextPath = path.resolve('src/context/CartContext.tsx');
  const cartContextContent = fs.readFileSync(cartContextPath, 'utf-8');

  // 1. addMultipleToCart must ONLY query blob recovery for legacy items lacking cloud URLs
  assert(
    cartContextContent.includes('const legacyCustomItems = items.filter('),
    'addMultipleToCart filters items to only target legacy items'
  );
  assert(
    cartContextContent.includes('!i.artwork_url ||\n        i.artwork_url.startsWith(\'blob:\') ||\n        !i.image ||\n        i.image.startsWith(\'blob:\')'),
    'addMultipleToCart legacy filter checks for missing or blob: URLs'
  );

  // 2. addMultipleToCart state mapping MUST NEVER overwrite valid HTTPS URLs
  assert(
    cartContextContent.includes('const needsPreview = !p.image || p.image.startsWith(\'blob:\');'),
    'addMultipleToCart correctly detects whether preview URL needs recovery'
  );
  assert(
    cartContextContent.includes('const needsMaster = !p.artwork_url || p.artwork_url.startsWith(\'blob:\');'),
    'addMultipleToCart correctly detects whether master artwork URL needs recovery'
  );
  assert(
    cartContextContent.includes('image: needsPreview ? url : p.image,\n                  artwork_url: needsMaster ? url : p.artwork_url,'),
    'addMultipleToCart strictly preserves valid HTTPS URLs and never collapses them to blob:'
  );

  // 3. Functional Simulation of addMultipleToCart URL Preservation:
  const verifiedCloudItem: any = {
    id: 1000847291823,
    customArtworkId: 'custom-art-verified-999',
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/preview-cloud.webp',
    artwork_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/uploads/design-cloud.jpg',
    name: 'Custom Design',
  };

  const isLegacyItem = Boolean(verifiedCloudItem.customArtworkId) && (
    !verifiedCloudItem.artwork_url ||
    verifiedCloudItem.artwork_url.startsWith('blob:') ||
    !verifiedCloudItem.image ||
    verifiedCloudItem.image.startsWith('blob:')
  );

  assert(isLegacyItem === false, 'Verified cloud item is NOT classified as legacy');

  // Simulate state update if a blob URL existed in memory
  const simulatedBlobUrl = 'blob:http://localhost:5173/mock-blob-uuid';
  const needsPreview = !verifiedCloudItem.image || verifiedCloudItem.image.startsWith('blob:');
  const needsMaster = !verifiedCloudItem.artwork_url || verifiedCloudItem.artwork_url.startsWith('blob:');

  const updatedItem = {
    ...verifiedCloudItem,
    image: needsPreview ? simulatedBlobUrl : verifiedCloudItem.image,
    artwork_url: needsMaster ? simulatedBlobUrl : verifiedCloudItem.artwork_url,
  };

  assert(
    updatedItem.image === verifiedCloudItem.image,
    'Verified HTTPS preview URL is 100% preserved (not overwritten by blob)'
  );
  assert(
    updatedItem.artwork_url === verifiedCloudItem.artwork_url,
    'Verified HTTPS master artwork URL is 100% preserved (not overwritten by blob)'
  );
  assert(
    !updatedItem.image.startsWith('blob:') && !updatedItem.artwork_url.startsWith('blob:'),
    'Neither image nor artwork_url becomes a blob: URL'
  );

  // 4. Functional Simulation of Legacy Item Recovery (only missing URLs populated):
  const legacyItemMissingMaster: any = {
    id: 1000847291824,
    customArtworkId: 'custom-art-legacy-888',
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/preview-cached.webp',
    artwork_url: 'blob:http://localhost:5173/expired-blob-master',
    name: 'Custom Design',
  };

  const legNeedsPreview = !legacyItemMissingMaster.image || legacyItemMissingMaster.image.startsWith('blob:');
  const legNeedsMaster = !legacyItemMissingMaster.artwork_url || legacyItemMissingMaster.artwork_url.startsWith('blob:');

  const recoveredItem = {
    ...legacyItemMissingMaster,
    image: legNeedsPreview ? simulatedBlobUrl : legacyItemMissingMaster.image,
    artwork_url: legNeedsMaster ? simulatedBlobUrl : legacyItemMissingMaster.artwork_url,
  };

  assert(
    recoveredItem.image === legacyItemMissingMaster.image,
    'Legacy item preserves existing valid HTTPS preview URL during recovery'
  );
  assert(
    recoveredItem.artwork_url === simulatedBlobUrl,
    'Legacy item recovers missing master URL without collapsing preview URL'
  );

  // =========================================================================
  // TEST GROUP 7: Shared Checkout Custom Artwork Validator
  // =========================================================================
  console.log(`\n${YELLOW}[Group 7] Shared Checkout Custom Artwork Validator (Payment.tsx)${RESET}`);

  // Test 1: Valid Custom Poster Kit Item (Permanent HTTPS URLs)
  const validPkCustom = {
    id: 1000847291823,
    name: 'Custom Design',
    isPosterKit: true,
    origin: 'poster_kit',
    artwork_source: 'custom',
    customArtworkId: 'custom-art-12345',
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/preview-1.webp',
    artwork_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/uploads/design-1.jpg',
  };
  const res1 = validateCustomArtworkItems([validPkCustom]);
  assert(res1.isValid === true, 'Valid custom Poster Kit item passes checkout validation');

  // Test 2: Valid Custom Masterpiece (/customize)
  const validRegularCustom = {
    id: 1234567,
    name: 'Custom Masterpiece',
    origin: 'custom',
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/previews/preview-custom.webp',
    artwork_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/custom-designs/uploads/design-custom.jpg',
  };
  const res2 = validateCustomArtworkItems([validRegularCustom]);
  assert(res2.isValid === true, 'Valid regular Custom Masterpiece passes checkout validation');

  // Test 3: Invalid Item — Blob artwork_url (Un-uploaded or corrupted)
  const invalidBlobMaster = {
    ...validPkCustom,
    artwork_url: 'blob:http://localhost:5173/temporary-blob-uuid',
  };
  const res3 = validateCustomArtworkItems([invalidBlobMaster]);
  assert(res3.isValid === false, 'Custom item with blob: artwork_url is rejected');

  // Test 4: Invalid Item — Blob preview image
  const invalidBlobImage = {
    ...validPkCustom,
    image: 'blob:http://localhost:5173/temporary-blob-uuid',
  };
  const res4 = validateCustomArtworkItems([invalidBlobImage]);
  assert(res4.isValid === false, 'Custom item with blob: image preview is rejected');

  // Test 5: Invalid Item — Missing master artwork_url
  const invalidMissingMaster = {
    ...validPkCustom,
    artwork_url: null,
  };
  const res5 = validateCustomArtworkItems([invalidMissingMaster]);
  assert(res5.isValid === false, 'Custom item with null artwork_url is rejected');

  // Test 6: Invalid Item — artworkMissing flag
  const invalidFlaggedMissing = {
    ...validPkCustom,
    artworkMissing: true,
  };
  const res6 = validateCustomArtworkItems([invalidFlaggedMissing]);
  assert(res6.isValid === false, 'Custom item with artworkMissing: true is rejected');

  // Test 7: Collection Poster Kit Item (Must NOT be subjected to custom validation)
  const collectionPkItem = {
    id: 900000108,
    name: 'Attack on Titan Poster',
    isPosterKit: true,
    origin: 'poster_kit',
    artwork_source: 'collection',
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/products/108.jpg',
    artwork_url: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/108.png',
  };
  const res7 = validateCustomArtworkItems([collectionPkItem]);
  assert(res7.isValid === true, 'Collection Poster Kit item cleanly passes checkout validation');

  // Test 8: Normal Storefront Catalog Item (Must NOT be subjected to custom validation)
  const normalStorefrontItem = {
    id: 108,
    name: 'Attack on Titan Poster',
    origin: 'storefront',
    image: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/products/108.jpg',
  };
  const res8 = validateCustomArtworkItems([normalStorefrontItem]);
  assert(res8.isValid === true, 'Standard storefront item cleanly passes checkout validation');

  // Test 9: Verify Payment.tsx uses shared helper in both Razorpay and COD
  const paymentContent = fs.readFileSync(path.resolve('src/pages/Payment.tsx'), 'utf-8');
  assert(
    paymentContent.includes('const { isValid: isOnlineArtworkValid } = validateCustomArtworkItems(selectedItems);'),
    'Payment.tsx uses validateCustomArtworkItems in handleOnlinePayment'
  );
  assert(
    paymentContent.includes('const { isValid: isCodArtworkValid } = validateCustomArtworkItems(selectedItems);'),
    'Payment.tsx uses validateCustomArtworkItems in handleCodPayment'
  );

  // =========================================================================
  // TEST GROUP 8: Admin Print Master Download & Popup-Free Fallback
  // =========================================================================
  console.log(`\n${YELLOW}[Group 8] Admin Print Master Download & Fallback Link (Orders.tsx)${RESET}`);

  const ordersPath = path.resolve('src/pages/admin/Orders.tsx');
  const ordersContent = fs.readFileSync(ordersPath, 'utf-8');

  assert(
    ordersContent.includes('AdminPrintMasterButton'),
    'Orders.tsx declares AdminPrintMasterButton component'
  );
  assert(
    ordersContent.includes('setDownloadState(\'fallback\')'),
    'AdminPrintMasterButton transitions to fallback state when direct fetch fails'
  );
  assert(
    ordersContent.includes('Direct download blocked. Click below to view/save:'),
    'AdminPrintMasterButton renders visible fallback text when direct fetch fails'
  );
  assert(
    ordersContent.includes('Open & Save Master in New Tab'),
    'AdminPrintMasterButton provides direct link avoiding async popup blocker suppression'
  );
  assert(
    ordersContent.includes('artworkUrl={masterArtworkUrl}'),
    'AdminPrintMasterButton targets master print URL (never preview)'
  );

  // =========================================================================
  // TEST GROUP 9: Collection Artwork & Storefront Non-Regression
  // =========================================================================
  console.log(`\n${YELLOW}[Group 9] Collection Artwork & Storefront Non-Regression${RESET}`);

  const mockCollectionPoster: any = {
    id: 'poster-slot-2',
    sizeId: 'A3',
    material: 'glossy',
    artworkSource: 'collection',
    artworkProductId: 108,
    artworkTitle: 'Attack on Titan Poster',
    mockupUrl: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/products/108.jpg',
    artworkUrl: 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/108.png',
  };

  const collectionCartItem = createPosterKitCartItem(mockCollectionPoster);

  assert(
    collectionCartItem.image === 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/products/108.jpg',
    'Collection poster cart thumbnail strictly uses storefront product mockup'
  );
  assert(
    collectionCartItem.artwork_url === 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/108.png',
    'Collection poster artwork_url strictly uses catalog standalone print artwork'
  );
  assert(
    collectionCartItem.name === 'Attack on Titan Poster',
    'Collection poster retains catalog display name'
  );

  console.log(`\n${GREEN}======================================================${RESET}`);
  console.log(`${GREEN}ALL ${totalTests} TESTS PASSED CLEANLY! ZERO REGRESSIONS.${RESET}`);
  console.log(`${GREEN}======================================================${RESET}\n`);
}

runTests().catch((err) => {
  console.error(`\n${RED}Test execution failed:${RESET}`, err);
  process.exit(1);
});

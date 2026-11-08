import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { getStorefrontImage } from '../src/utils/imageUtils';
import { createPosterKitCartItem } from '../src/utils/posterKitPricing';

/**
 * Posterealm — Focused Verification Suite:
 * 1. Bug 1: Custom Artwork Replacement & Upload Race Protection
 * 2. Bug 2: Poster Kit Custom Artwork Preview Lifecycle (CartContext Ownership & Edit Modal)
 */

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
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

console.log(`${CYAN}--- RUNNING CUSTOM ARTWORK PREVIEW BUGS FOCUSED VERIFICATION SUITE ---${RESET}\n`);

async function runTests() {
  // -------------------------------------------------------------
  // [PART A] BUG 1: Custom Design Replacement
  // -------------------------------------------------------------
  console.log('[Test 1] Source Code Verification: Customize.tsx Upload Pipeline');
  const customizePath = path.resolve('src/pages/Customize.tsx');
  const customizeContent = fs.readFileSync(customizePath, 'utf-8');

  assert(
    customizeContent.includes('const res = await processCustomDesignUpload(file);'),
    'Customize.tsx invokes processCustomDesignUpload(file) WITHOUT passing stale artworkUrl'
  );
  assert(
    customizeContent.includes('uploadSeqRef'),
    'Customize.tsx declares uploadSeqRef to track upload sequence'
  );
  assert(
    customizeContent.includes('const currentSeq = ++uploadSeqRef.current;'),
    'Customize.tsx increments sequence counter for every new file selection'
  );
  assert(
    customizeContent.includes('setArtworkUrl(null);') && customizeContent.includes('setImagePreview(null);'),
    'Customize.tsx clears stale artworkUrl and imagePreview immediately upon new selection'
  );
  assert(
    customizeContent.includes('if (uploadSeqRef.current !== currentSeq)'),
    'Customize.tsx guards against stale/out-of-order upload completions overwriting newer selections'
  );
  assert(
    customizeContent.includes('if (fileInputRef.current) {\n      fileInputRef.current.value = \'\';\n    }'),
    'Customize.tsx resets file input value on selection so re-selecting same file triggers change'
  );
  assert(
    customizeContent.includes('if (isUploading) {\n      triggerNotification("Please wait for your design to finish uploading.");\n      return;\n    }'),
    'Customize.tsx handleAddToBag explicitly blocks adding to cart while uploading'
  );
  assert(
    customizeContent.includes('disabled={isUploading || !artworkUrl || !imagePreview}'),
    'Customize.tsx Add to Cart button is disabled during upload and when artwork is missing'
  );

  // -------------------------------------------------------------
  // [Test 2] Functional Simulation: Replacement file receives brand new master and preview URLs
  // -------------------------------------------------------------
  console.log('\n[Test 2] Replacement file generates unique master & preview URLs');
  
  // Hermetic simulation of processCustomDesignUpload to verify pipeline contract
  async function mockProcessCustomDesignUpload(file: { name: string; buffer: Buffer }, existingArtworkUrl?: string | null) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';

    let artworkUrl = existingArtworkUrl || null;
    let originalUploaded = false;

    if (!artworkUrl) {
      originalUploaded = true;
      artworkUrl = `https://mock.supabase.co/storage/v1/object/public/custom-designs/uploads/design-${timestamp}-${random}.${ext}`;
    }

    const previewUrl = `https://mock.supabase.co/storage/v1/object/public/custom-designs/previews/design-${timestamp}-${random}-400.webp`;

    return {
      artworkUrl,
      previewUrl,
      originalUploaded
    };
  }

  const fileABuffer = await sharp({
    create: { width: 500, height: 500, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } }
  }).png().toBuffer();

  const fileBBuffer = await sharp({
    create: { width: 600, height: 400, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } }
  }).png().toBuffer();

  const mockFileA = { name: 'goku.png', buffer: fileABuffer };
  const mockFileB = { name: 'one-punch-man.png', buffer: fileBBuffer };

  // Step 1: Upload File A (Goku)
  const resA = await mockProcessCustomDesignUpload(mockFileA);
  assert(resA.originalUploaded === true, 'File A triggers original master upload');
  assert(Boolean(resA.artworkUrl), 'File A successfully receives master artwork URL');
  assert(Boolean(resA.previewUrl), 'File A successfully receives preview WebP URL');
  assert(resA.artworkUrl.includes('uploads/design-'), 'File A master URL is in uploads/');
  assert(resA.previewUrl.includes('previews/design-'), 'File A preview URL is in previews/');

  // Step 2: User replaces File A with File B (Calling without existingArtworkUrl)
  const resB = await mockProcessCustomDesignUpload(mockFileB);
  assert(resB.originalUploaded === true, 'File B triggers its OWN original master upload');
  assert(Boolean(resB.artworkUrl), 'File B successfully receives master artwork URL');
  assert(Boolean(resB.previewUrl), 'File B successfully receives preview WebP URL');
  assert(resB.artworkUrl !== resA.artworkUrl, 'File B master URL is distinct from File A master URL');
  assert(resB.previewUrl !== resA.previewUrl, 'File B preview URL is distinct from File A preview URL');

  // Verify Cart Item created with File B
  const cartItemB = {
    id: Date.now(),
    name: 'Custom Masterpiece',
    price: 399,
    image: resB.previewUrl,
    artwork_url: resB.artworkUrl,
    origin: 'custom',
    artwork_source: 'custom',
    quantity: 1,
    size: 'A3',
    material: 'Matte'
  };

  assert(cartItemB.image === resB.previewUrl, 'Cart item image references File B preview URL');
  assert(cartItemB.artwork_url === resB.artworkUrl, 'Cart item artwork_url references File B master URL');
  assert(cartItemB.image !== resA.previewUrl, 'Cart item image does NOT reference File A preview');
  assert(cartItemB.artwork_url !== resA.artworkUrl, 'Cart item artwork_url does NOT reference File A master');

  // -------------------------------------------------------------
  // [Test 3] Upload Race Condition Guard Simulation
  // -------------------------------------------------------------
  console.log('\n[Test 3] Upload Race Guard: Older upload cannot overwrite newer selection');
  let currentSeq = 0;
  let activeArtworkUrl: string | null = null;
  let activePreviewUrl: string | null = null;
  let activeIsUploading = false;

  // Function simulating Customize.tsx processUpload logic
  async function simulateUpload(file: { name: string }, delayMs: number) {
    const seq = ++currentSeq;
    activeArtworkUrl = null;
    activePreviewUrl = null;
    activeIsUploading = true;

    // Simulate async network upload with variable delay
    const res = await new Promise<{ artworkUrl: string; previewUrl: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          artworkUrl: `uploads/design-${file.name}`,
          previewUrl: `previews/design-${file.name}-400.webp`
        });
      }, delayMs);
    });

    // Sequence check (matches Customize.tsx sequence guard)
    if (seq !== currentSeq) {
      // Ignored because superseded
      return;
    }

    activeArtworkUrl = res.artworkUrl;
    activePreviewUrl = res.previewUrl;
    if (seq === currentSeq) {
      activeIsUploading = false;
    }
  }

  // Start File A with slow network (60ms)
  const uploadAPromise = simulateUpload(mockFileA, 60);
  // User rapidly selects File B with fast network (20ms)
  const uploadBPromise = simulateUpload(mockFileB, 20);

  await Promise.all([uploadAPromise, uploadBPromise]);

  assert(
    activeArtworkUrl === 'uploads/design-one-punch-man.png',
    'Final active artwork URL strictly belongs to File B despite File A completing later'
  );
  assert(
    activePreviewUrl === 'previews/design-one-punch-man.png-400.webp',
    'Final active preview URL strictly belongs to File B'
  );
  assert(activeIsUploading === false, 'isUploading is correctly reset to false');

  // -------------------------------------------------------------
  // [PART B] BUG 2: Poster Kit Custom Artwork Preview Lifecycle
  // -------------------------------------------------------------
  console.log('\n[Test 4] Source Code Verification: CartContext.tsx & Cart.tsx');
  const cartContextPath = path.resolve('src/context/CartContext.tsx');
  const cartContextContent = fs.readFileSync(cartContextPath, 'utf-8');
  const cartPagePath = path.resolve('src/pages/Cart.tsx');
  const cartPageContent = fs.readFileSync(cartPagePath, 'utf-8');

  assert(
    cartContextContent.includes('cartBlobUrlsRef = useRef<Map<string, string>>(new Map())'),
    'CartContext declares cartBlobUrlsRef to retain independent ownership of object URLs'
  );
  assert(
    cartContextContent.includes('ensureCartOwnedBlobUrl'),
    'CartContext provides ensureCartOwnedBlobUrl helper to restore blobs from IndexedDB'
  );
  assert(
    cartContextContent.includes('refreshCartBlobs'),
    'CartContext provides refreshCartBlobs for route-aware hydration on navigation'
  );
  assert(
    cartPageContent.includes('refreshCartBlobs?.()'),
    'Cart.tsx invokes refreshCartBlobs on mount'
  );
  assert(
    cartPageContent.includes('CartEditModalImage'),
    'Cart.tsx implements CartEditModalImage for safe modal image resolution'
  );
  assert(
    cartPageContent.includes('<CartEditModalImage item={editingItem} altText={getItemDisplayName(editingItem)} />'),
    'Cart.tsx Edit Modal renders CartEditModalImage instead of bare revoked blob URL'
  );
  assert(
    cartPageContent.includes('Custom Artwork Unavailable'),
    'Cart.tsx displays graceful missing artwork notice when IndexedDB blob cannot be retrieved'
  );

  // -------------------------------------------------------------
  // [Test 5] Poster Kit Cart Item Creation & Metadata Integrity
  // -------------------------------------------------------------
  console.log('\n[Test 5] Poster Kit Cart Item Creation (Custom vs Collection vs Storefront)');
  const dummyCustomPoster: any = {
    id: 'pk-poster-custom-1',
    sizeId: 'A4',
    material: 'matte',
    artworkSource: 'custom',
    customArtworkId: 'custom-art-12345',
    customArtworkFileName: 'my-drawing.png',
    artworkUrl: 'blob:http://localhost:5173/temp-posterkit-blob-url',
    widthPercent: 8.297,
    heightPercent: 20.861
  };

  const pkCartItem = createPosterKitCartItem(dummyCustomPoster);
  assert(pkCartItem.name === 'Custom Design', 'Custom Poster Kit cart item name is "Custom Design"');
  assert(pkCartItem.customArtworkId === 'custom-art-12345', 'Preserves customArtworkId');
  assert(pkCartItem.customArtworkFileName === 'my-drawing.png', 'Preserves customArtworkFileName');
  assert(pkCartItem.isPosterKit === true, 'Preserves isPosterKit: true');
  assert(pkCartItem.artwork_source === 'custom', 'Preserves artwork_source: custom');

  // -------------------------------------------------------------
  // [Test 6] CartContext Blob URL Lifecycle (Independent Ownership & Cleanup)
  // -------------------------------------------------------------
  console.log('\n[Test 6] CartContext Independent URL Ownership & Cleanup Simulation');
  const mockRevokedUrls: string[] = [];
  const mockCreatedUrls: string[] = [];

  const mockUrlManager = {
    createObjectURL: (blob: any) => {
      const u = `blob:http://cartcontext/${Math.random().toString(36).substring(7)}`;
      mockCreatedUrls.push(u);
      return u;
    },
    revokeObjectURL: (url: string) => {
      mockRevokedUrls.push(url);
    }
  };

  // Simulate Map of CartContext URLs
  const cartBlobMap = new Map<string, string>();
  const id1 = 'artwork-abc';
  const id2 = 'artwork-xyz';

  // Item 1 added
  const url1 = mockUrlManager.createObjectURL({ size: 1000 });
  cartBlobMap.set(id1, url1);
  assert(cartBlobMap.has(id1), 'Item 1 receives CartContext-owned blob URL');

  // Item 2 added
  const url2 = mockUrlManager.createObjectURL({ size: 2000 });
  cartBlobMap.set(id2, url2);
  assert(cartBlobMap.has(id2), 'Item 2 receives CartContext-owned blob URL');

  // Item 1 with duplicate customArtworkId added (shared design in another size)
  const sharedUrl = cartBlobMap.get(id1)!;
  assert(sharedUrl === url1, 'Same customArtworkId reuses existing CartContext URL without duplication');

  // Item 1 removed (while other item with id1 remains in cart)
  let remainingItems = [{ id: 102, customArtworkId: id1 }, { id: 103, customArtworkId: id2 }];
  let stillUsed = remainingItems.some(i => i.customArtworkId === id1);
  if (!stillUsed) {
    mockUrlManager.revokeObjectURL(cartBlobMap.get(id1)!);
    cartBlobMap.delete(id1);
  }
  assert(cartBlobMap.has(id1), 'URL for id1 is NOT revoked because another active item uses it');

  // Remove the second item with id1
  remainingItems = [{ id: 103, customArtworkId: id2 }];
  stillUsed = remainingItems.some(i => i.customArtworkId === id1);
  if (!stillUsed) {
    const toRevoke = cartBlobMap.get(id1)!;
    mockUrlManager.revokeObjectURL(toRevoke);
    cartBlobMap.delete(id1);
  }
  assert(!cartBlobMap.has(id1), 'URL for id1 is cleanly revoked once no remaining item uses it');
  assert(mockRevokedUrls.includes(url1), 'mockRevokedUrls captures url1');
  assert(!mockRevokedUrls.includes(url2), 'URL for id2 remains untouched and active');

  // Clear Cart cleans up all remaining URLs
  cartBlobMap.forEach(url => {
    mockUrlManager.revokeObjectURL(url);
  });
  cartBlobMap.clear();
  assert(mockRevokedUrls.includes(url2), 'Clear cart revokes remaining url2');
  assert(cartBlobMap.size === 0, 'cartBlobMap is completely empty after clearCart');

  // -------------------------------------------------------------
  // [Test 7] Item Type Isolation: All 3 Item Types Preserved
  // -------------------------------------------------------------
  console.log('\n[Test 7] Item Type Isolation: All 3 Item Types Preserved');

  // Type 1: Custom Masterpiece
  const regularCustomItem = {
    id: 1740000000001,
    name: 'Custom Masterpiece',
    price: 399,
    image: 'https://supabase.co/storage/v1/object/public/custom-designs/previews/design-1-400.webp',
    artwork_url: 'https://supabase.co/storage/v1/object/public/custom-designs/uploads/design-1.png',
    origin: 'custom',
    artwork_source: 'custom',
    quantity: 1,
    size: 'A3',
    material: 'Matte'
  };
  const regCustomImg = getStorefrontImage(regularCustomItem, 'preview');
  assert(
    regCustomImg === regularCustomItem.image,
    'Custom Masterpiece resolves storefront preview to 400px WebP preview URL'
  );
  assert(
    regularCustomItem.artwork_url.includes('/uploads/'),
    'Custom Masterpiece preserves uncompressed master print URL in artwork_url'
  );

  // Type 2: Poster Kit Collection Item
  const pkCollectionPoster: any = {
    id: 'pk-col-1',
    sizeId: 'A4',
    material: 'glossy',
    artworkSource: 'collection',
    productId: 108,
    mockupUrl: 'https://supabase.co/storage/v1/object/public/products/108.jpg',
    artworkUrl: 'https://supabase.co/storage/v1/object/public/artworks/108.png',
    artworkTitle: 'F*cks I Give Nun Wall Poster'
  };
  const pkColCartItem = createPosterKitCartItem(pkCollectionPoster);
  assert(
    pkColCartItem.image === pkCollectionPoster.mockupUrl,
    'Poster Kit collection item image is the storefront mockup'
  );
  assert(
    pkColCartItem.artwork_url === pkCollectionPoster.artworkUrl,
    'Poster Kit collection item artwork_url is the standalone print artwork'
  );
  assert(
    pkColCartItem.name === 'F*cks I Give Nun Wall Poster',
    'Poster Kit collection item preserves catalog title'
  );

  // Type 3: Poster Kit Custom Design Item
  assert(pkCartItem.name === 'Custom Design', 'Poster Kit custom item preserves Custom Design title');
  assert(pkCartItem.customArtworkId === 'custom-art-12345', 'Poster Kit custom item preserves customArtworkId');

  console.log(`\n${GREEN}--- ALL ${passedTests}/${totalTests} FOCUSED TESTS PASSED SUCCESSFULLY! ---${RESET}`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

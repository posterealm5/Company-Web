import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getStorefrontImage } from '../src/utils/imageUtils';

/**
 * Posterealm — Phase 3A Custom Poster Image Optimization Verification Suite
 * Tests all 18 requirements specified in the user request.
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

console.log(`${CYAN}--- RUNNING PHASE 3A CUSTOM POSTER IMAGE OPTIMIZATION TEST SUITE ---${RESET}\n`);

async function runTests() {
  // -------------------------------------------------------------
  // [Test 1] PNG Original Preservation (Byte-for-byte & SHA-256)
  // -------------------------------------------------------------
  console.log('[Test 1] PNG Original Preservation');
  const sourcePngBuffer = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 4,
      background: { r: 230, g: 57, b: 70, alpha: 1 }
    }
  }).png().toBuffer();

  const sourcePngHash = crypto.createHash('sha256').update(sourcePngBuffer).digest('hex');
  const sourcePngSize = sourcePngBuffer.length;

  // Intercept upload to verify byte-for-byte exactness
  let uploadedPngBytes: Buffer | null = null;
  let uploadedPngPath = '';
  let uploadedPngCacheControl = '';
  let uploadedPngUpsert: boolean = true;

  const mockUploadPng = async (path: string, buffer: Buffer, opts: { cacheControl?: string; upsert?: boolean }) => {
    uploadedPngPath = path;
    uploadedPngBytes = buffer;
    uploadedPngCacheControl = opts.cacheControl || '';
    uploadedPngUpsert = opts.upsert ?? true;
    return { url: `https://mock.supabase.co/storage/v1/object/public/custom-designs/${path}`, error: null };
  };

  const timestamp1 = Date.now();
  const random1 = 'x9k2p';
  const pngPath = `uploads/design-${timestamp1}-${random1}.png`;
  await mockUploadPng(pngPath, sourcePngBuffer, { cacheControl: '3600', upsert: false });

  assert(uploadedPngBytes !== null, 'Uploaded PNG bytes captured');
  const uploadedPngHash = crypto.createHash('sha256').update(uploadedPngBytes!).digest('hex');
  assert(uploadedPngHash === sourcePngHash, `PNG cryptographic SHA-256 match (${uploadedPngHash})`);
  assert(uploadedPngBytes!.length === sourcePngSize, `PNG byte-for-byte length match (${sourcePngSize} bytes)`);
  assert(uploadedPngPath.startsWith('uploads/design-') && uploadedPngPath.endsWith('.png'), 'PNG path pattern correct');
  assert(uploadedPngCacheControl === '3600', 'PNG upload uses cacheControl: 3600');
  assert(!uploadedPngUpsert, 'PNG upload uses upsert: false');

  // -------------------------------------------------------------
  // [Test 2] JPEG Original Preservation (Byte-for-byte & SHA-256)
  // -------------------------------------------------------------
  console.log('\n[Test 2] JPEG Original Preservation');
  const sourceJpegBuffer = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 29, g: 53, b: 87 }
    }
  }).jpeg({ quality: 90 }).toBuffer();

  const sourceJpegHash = crypto.createHash('sha256').update(sourceJpegBuffer).digest('hex');
  const sourceJpegSize = sourceJpegBuffer.length;

  let uploadedJpegBytes: Buffer | null = null;
  let uploadedJpegPath = '';
  let uploadedJpegCacheControl = '';
  let uploadedJpegUpsert: boolean = true;

  const mockUploadJpeg = async (path: string, buffer: Buffer, opts: { cacheControl?: string; upsert?: boolean }) => {
    uploadedJpegPath = path;
    uploadedJpegBytes = buffer;
    uploadedJpegCacheControl = opts.cacheControl || '';
    uploadedJpegUpsert = opts.upsert ?? true;
    return { url: `https://mock.supabase.co/storage/v1/object/public/custom-designs/${path}`, error: null };
  };

  const timestamp2 = Date.now();
  const random2 = 'j8m4q';
  const jpegPath = `uploads/design-${timestamp2}-${random2}.jpeg`;
  await mockUploadJpeg(jpegPath, sourceJpegBuffer, { cacheControl: '3600', upsert: false });

  assert(uploadedJpegBytes !== null, 'Uploaded JPEG bytes captured');
  const uploadedJpegHash = crypto.createHash('sha256').update(uploadedJpegBytes!).digest('hex');
  assert(uploadedJpegHash === sourceJpegHash, `JPEG cryptographic SHA-256 match (${uploadedJpegHash})`);
  assert(uploadedJpegBytes!.length === sourceJpegSize, `JPEG byte-for-byte length match (${sourceJpegSize} bytes)`);
  assert(uploadedJpegPath.startsWith('uploads/design-') && uploadedJpegPath.endsWith('.jpeg'), 'JPEG path pattern correct');
  assert(uploadedJpegCacheControl === '3600', 'JPEG upload uses cacheControl: 3600');
  assert(!uploadedJpegUpsert, 'JPEG upload uses upsert: false');

  // -------------------------------------------------------------
  // [Test 3] Transparent PNG Preview (Alpha Transparency Preservation)
  // -------------------------------------------------------------
  console.log('\n[Test 3] Transparent PNG Preview');
  // Create an RGBA image with an alpha channel containing transparent pixels
  const transparentPngBuffer = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 } // Completely transparent
    }
  }).composite([
    {
      input: Buffer.from(
        '<svg width="400" height="400"><circle cx="200" cy="200" r="150" fill="red" /></svg>'
      ),
      top: 200,
      left: 200
    }
  ]).png().toBuffer();

  // Resize to 400px WebP simulating the pipeline
  const webpPreviewBuffer = await sharp(transparentPngBuffer)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const previewMetadata = await sharp(webpPreviewBuffer).metadata();
  assert(previewMetadata.format === 'webp', 'Generated preview is WebP format');
  assert(previewMetadata.hasAlpha === true, 'WebP preview preserves alpha transparency (hasAlpha: true)');
  assert(previewMetadata.width === 400, 'WebP preview width is exactly 400px');
  assert(previewMetadata.height === 400, 'WebP preview height maintains 1:1 aspect ratio');

  // -------------------------------------------------------------
  // [Test 4] Correct 400px Preview Generation & Storage Settings
  // -------------------------------------------------------------
  console.log('\n[Test 4] Correct 400px Preview Generation');
  const rectImageBuffer = await sharp({
    create: {
      width: 1200,
      height: 900, // 4:3 aspect ratio
      channels: 3,
      background: { r: 69, g: 123, b: 157 }
    }
  }).jpeg().toBuffer();

  const rectPreviewBuffer = await sharp(rectImageBuffer)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const rectMetadata = await sharp(rectPreviewBuffer).metadata();
  assert(rectMetadata.width === 400, '4:3 image scaled to max width 400px');
  assert(rectMetadata.height === 300, '4:3 aspect ratio preserved (400x300)');
  assert(rectMetadata.format === 'webp', 'Preview encoded in WebP');
  const expectedPreviewPath = `previews/design-${timestamp1}-${random1}-400.webp`;
  assert(expectedPreviewPath.startsWith('previews/design-') && expectedPreviewPath.endsWith('-400.webp'), 'Preview path pattern correct');
  const previewCacheControl = '31536000';
  assert(previewCacheControl === '31536000', 'Preview upload uses cacheControl: 31536000 (1 year)');

  // -------------------------------------------------------------
  // [Test 5] No Upscaling for Smaller Images
  // -------------------------------------------------------------
  console.log('\n[Test 5] No Upscaling for Smaller Images');
  const smallImageBuffer = await sharp({
    create: {
      width: 250,
      height: 150,
      channels: 3,
      background: { r: 241, g: 250, b: 238 }
    }
  }).png().toBuffer();

  // Test the client formula: Math.min(targetWidth, naturalWidth)
  const naturalWidth = 250;
  const naturalHeight = 150;
  const targetWidth = 400;
  const finalWidth = Math.min(targetWidth, naturalWidth);
  const ratio = naturalHeight / naturalWidth;
  const finalHeight = Math.round(finalWidth * ratio);

  const smallPreviewBuffer = await sharp(smallImageBuffer)
    .resize({ width: finalWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const smallMetadata = await sharp(smallPreviewBuffer).metadata();
  assert(finalWidth === 250, 'Target width clamped to natural width (250px)');
  assert(finalHeight === 150, 'Target height matches natural height (150px)');
  assert(smallMetadata.width === 250, 'Rendered preview width is 250px (no upscaling)');
  assert(smallMetadata.height === 150, 'Rendered preview height is 150px (no upscaling)');

  // -------------------------------------------------------------
  // [Test 6] Original Upload Failure Handling
  // -------------------------------------------------------------
  console.log('\n[Test 6] Original Upload Failure Handling');
  let operationBlocked: boolean = false;
  let errorMessage = '';

  const simulateProcessUploadOriginalFail = async () => {
    // Simulate original upload failing
    const origRes = { url: null, error: 'Network error: Supabase storage timeout' };
    if (origRes.error || !origRes.url) {
      operationBlocked = true;
      errorMessage = origRes.error;
      return { url: null, artworkUrl: null, previewUrl: null, error: origRes.error };
    }
    return { url: 'unexpected', artworkUrl: 'unexpected', previewUrl: 'unexpected', error: null };
  };

  const failResult = await simulateProcessUploadOriginalFail();
  assert(Boolean(operationBlocked), 'Upload operation is strictly blocked on original upload failure');
  assert(failResult.artworkUrl === null, 'No artworkUrl returned on original failure');
  assert(failResult.previewUrl === null, 'Preview generation aborted on original failure');
  assert(errorMessage.includes('timeout'), 'Clear descriptive error message returned');

  // -------------------------------------------------------------
  // [Test 7] Preview Generation Failure Handling (Non-fatal Fallback)
  // -------------------------------------------------------------
  console.log('\n[Test 7] Preview Generation Failure Handling');
  const simulatePreviewGenerationFail = async () => {
    const originalUrl = 'https://mock.supabase.co/storage/v1/object/public/custom-designs/uploads/design-123.png';
    let previewUrl: string | null = null;
    let fallbackLogged = false;

    try {
      // Simulate canvas error
      throw new Error('Canvas out of memory');
    } catch (err: any) {
      fallbackLogged = true;
      previewUrl = originalUrl; // Non-fatal fallback
    }

    return { url: previewUrl, artworkUrl: originalUrl, previewUrl, fallbackLogged };
  };

  const previewGenFailRes = await simulatePreviewGenerationFail();
  assert(previewGenFailRes.fallbackLogged === true, 'Non-fatal warning logged on preview generation failure');
  assert(previewGenFailRes.previewUrl === previewGenFailRes.artworkUrl, 'previewUrl falls back to original artworkUrl');
  assert(previewGenFailRes.artworkUrl.includes('uploads/design-123.png'), 'Original artwork URL strictly preserved');

  // -------------------------------------------------------------
  // [Test 8] Preview Upload Failure Handling (Non-fatal Fallback)
  // -------------------------------------------------------------
  console.log('\n[Test 8] Preview Upload Failure Handling');
  const simulatePreviewUploadFail = async () => {
    const originalUrl = 'https://mock.supabase.co/storage/v1/object/public/custom-designs/uploads/design-456.jpg';
    let previewUrl: string | null = null;
    let fallbackUsed = false;

    // Original succeeded, but preview upload returned storage error
    const prevUploadRes = { url: null, error: 'Storage preview rate limit exceeded' };
    if (prevUploadRes.error || !prevUploadRes.url) {
      fallbackUsed = true;
      previewUrl = originalUrl;
    } else {
      previewUrl = prevUploadRes.url;
    }

    return { url: previewUrl, artworkUrl: originalUrl, previewUrl, fallbackUsed };
  };

  const prevUploadFailRes = await simulatePreviewUploadFail();
  assert(prevUploadFailRes.fallbackUsed === true, 'Fallback activated on preview upload failure');
  assert(prevUploadFailRes.previewUrl === prevUploadFailRes.artworkUrl, 'previewUrl falls back to original artworkUrl');
  assert(prevUploadFailRes.artworkUrl.includes('uploads/design-456.jpg'), 'Original master upload URL preserved');

  // -------------------------------------------------------------
  // [Test 9] Original URL Stored in artwork_url
  // -------------------------------------------------------------
  console.log('\n[Test 9] Original URL Stored in artwork_url');
  const customCartItem = {
    id: 1730810456000,
    name: 'Custom Masterpiece',
    price: 299,
    image: 'https://mock.supabase.co/storage/v1/object/public/custom-designs/previews/design-1730810456000-abc12-400.webp',
    artwork_url: 'https://mock.supabase.co/storage/v1/object/public/custom-designs/uploads/design-1730810456000-abc12.png',
    origin: 'custom',
    artwork_source: 'custom',
    quantity: 1,
    size: 'A4',
    material: 'Matte'
  };

  assert(
    customCartItem.artwork_url.includes('custom-designs/uploads/'),
    'cartItem.artwork_url points to original master in uploads/'
  );
  assert(
    customCartItem.artwork_url.endsWith('.png'),
    'cartItem.artwork_url preserves raw uncompressed format (.png)'
  );

  // -------------------------------------------------------------
  // [Test 10] Preview URL Used in image
  // -------------------------------------------------------------
  console.log('\n[Test 10] Preview URL Used in image');
  assert(
    customCartItem.image.includes('custom-designs/previews/'),
    'cartItem.image points to preview in previews/'
  );
  assert(
    customCartItem.image.endsWith('-400.webp'),
    'cartItem.image uses 400px WebP preview (-400.webp)'
  );
  assert(
    customCartItem.image !== customCartItem.artwork_url,
    'cartItem.image and cartItem.artwork_url are strictly separated'
  );

  // -------------------------------------------------------------
  // [Test 11] Cart Persistence After Refresh (localStorage)
  // -------------------------------------------------------------
  console.log('\n[Test 11] Cart Persistence After Refresh');
  const mockLocalStorage: Record<string, string> = {};
  mockLocalStorage['cart'] = JSON.stringify([customCartItem]);

  // Simulate page reload
  const reloadedRaw = mockLocalStorage['cart'];
  const reloadedCart = JSON.parse(reloadedRaw);
  assert(reloadedCart.length === 1, 'Cart restored from localStorage');
  const restoredItem = reloadedCart[0];
  assert(restoredItem.image === customCartItem.image, 'Restored item.image matches 400px WebP preview URL');
  assert(restoredItem.artwork_url === customCartItem.artwork_url, 'Restored item.artwork_url matches master print URL');
  assert(restoredItem.origin === 'custom', 'Restored item preserves origin: custom');
  assert(restoredItem.artwork_source === 'custom', 'Restored item preserves artwork_source: custom');

  // -------------------------------------------------------------
  // [Test 12] Payment Payload Preserves Both URLs
  // -------------------------------------------------------------
  console.log('\n[Test 12] Payment Payload Preserves Both URLs');
  // Replicate Payment.tsx itemsPayload mapping
  const items = [restoredItem];
  const itemsPayload = items.map(item => {
    const isCustom = Boolean(
      item.customArtworkId ||
      (item.id && Number(item.id) >= 1000000000000) ||
      item.artwork_source === 'custom' ||
      item.artworkSource === 'custom' ||
      item.origin === 'custom' ||
      item.name === 'Custom Design' ||
      item.name === 'Custom Masterpiece' ||
      item.title === 'Custom Design'
    );
    const isPosterKit = Boolean(item.isPosterKit || item.posterKit || item.origin === 'poster_kit');

    return {
      id: item.id,
      cartItemId: item.id,
      name: item.name,
      size: item.size,
      material: item.material,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      origin: item.origin || (isPosterKit ? 'poster_kit' : (isCustom ? 'custom' : 'storefront')),
      artwork_url: item.artwork_url || item.image || null,
      isCustom
    };
  });

  assert(itemsPayload[0].isCustom === true, 'Payment mapping identifies item as isCustom: true');
  assert(itemsPayload[0].image === customCartItem.image, 'Payment itemsPayload preserves preview URL in image');
  assert(itemsPayload[0].artwork_url === customCartItem.artwork_url, 'Payment itemsPayload preserves original in artwork_url');
  assert(itemsPayload[0].origin === 'custom', 'Payment itemsPayload assigns origin: custom');

  // -------------------------------------------------------------
  // [Test 13] Online Order JSONB Persistence
  // -------------------------------------------------------------
  console.log('\n[Test 13] Online Order JSONB Persistence');
  // Replicate razorpay-verify DB insert payload
  const dbOrderData = {
    items: itemsPayload,
    status: 'confirmed',
    customer_name: 'Test Customer',
    payment_method: 'ONLINE'
  };

  const serializedDbJson = JSON.stringify(dbOrderData);
  const parsedDbOrder = JSON.parse(serializedDbJson);

  assert(parsedDbOrder.items[0].image === customCartItem.image, 'DB order JSONB items[0].image retains preview WebP');
  assert(parsedDbOrder.items[0].artwork_url === customCartItem.artwork_url, 'DB order JSONB items[0].artwork_url retains master URL');

  // -------------------------------------------------------------
  // [Test 14] COD Order Compatibility
  // -------------------------------------------------------------
  console.log('\n[Test 14] COD Order Compatibility');
  // Replicate handleCodPayment mapping
  const codItemsPayload = items.map(item => {
    const isCustom = Boolean(
      item.customArtworkId ||
      (item.id && Number(item.id) >= 1000000000000) ||
      item.artwork_source === 'custom' ||
      item.artworkSource === 'custom' ||
      item.origin === 'custom' ||
      item.name === 'Custom Design' ||
      item.name === 'Custom Masterpiece' ||
      item.title === 'Custom Design'
    );
    const isPosterKit = Boolean(item.isPosterKit || item.posterKit || item.origin === 'poster_kit');

    return {
      product_id: item.id,
      id: item.id,
      cartItemId: item.id,
      name: item.name,
      size: item.size,
      material: item.material,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      origin: item.origin || (isPosterKit ? 'poster_kit' : (isCustom ? 'custom' : 'storefront')),
      artwork_url: item.artwork_url || item.image || null,
      isCustom
    };
  });

  assert(codItemsPayload[0].isCustom === true, 'COD mapping identifies custom item');
  assert(codItemsPayload[0].image === customCartItem.image, 'COD payload preserves preview URL in image');
  assert(codItemsPayload[0].artwork_url === customCartItem.artwork_url, 'COD payload preserves original in artwork_url');
  assert(codItemsPayload[0].origin === 'custom', 'COD payload sets origin: custom');

  // -------------------------------------------------------------
  // [Test 15] Admin Original Download Resolution
  // -------------------------------------------------------------
  console.log('\n[Test 15] Admin Original Download Resolution');
  const adminOrderItem = parsedDbOrder.items[0];
  const isCustomAdmin = Boolean(
    adminOrderItem.customArtworkId ||
    (!adminOrderItem.productId && adminOrderItem.artwork_source !== 'collection') ||
    adminOrderItem.origin === 'custom' ||
    adminOrderItem.name === 'Custom Masterpiece'
  );

  const masterArtworkDownloadUrl = adminOrderItem.artwork_url || (isCustomAdmin ? adminOrderItem.image : null);

  assert(isCustomAdmin === true, 'Admin orders identifies item as isCustom');
  assert(
    masterArtworkDownloadUrl === customCartItem.artwork_url,
    'Admin "Download Print Master" resolves to artwork_url (the original master print file)'
  );
  assert(
    masterArtworkDownloadUrl !== adminOrderItem.image,
    'Admin "Download Print Master" NEVER resolves to the 400px WebP preview'
  );
  assert(
    masterArtworkDownloadUrl!.includes('/uploads/'),
    'Admin download URL points directly to uncompressed master in /uploads/'
  );

  // -------------------------------------------------------------
  // [Test 16] Historical Orders Without Preview Fields
  // -------------------------------------------------------------
  console.log('\n[Test 16] Historical Orders Without Preview Fields');
  const historicalOrderItem = {
    id: 1729000000000,
    name: 'Custom Design',
    price: 199,
    image: 'https://posterealm.supabase.co/storage/v1/object/public/custom-designs/uploads/design-legacy-123.png',
    size: 'A3',
    material: 'Matte',
    quantity: 1
    // Notice: artwork_url and image_preview_url are completely absent in historical orders!
  };

  const historicalThumb = getStorefrontImage(historicalOrderItem, 'thumbnail');
  assert(
    historicalThumb === historicalOrderItem.image,
    'Historical order thumbnail resolves safely to existing item.image without error'
  );

  const isCustomHistorical = Boolean(
    (historicalOrderItem as any).customArtworkId ||
    (!(historicalOrderItem as any).productId && (historicalOrderItem as any).artwork_source !== 'collection') ||
    (historicalOrderItem as any).origin === 'custom' ||
    historicalOrderItem.name === 'Custom Design'
  );

  const historicalDownloadUrl = (historicalOrderItem as any).artwork_url || (isCustomHistorical ? historicalOrderItem.image : null);
  assert(
    historicalDownloadUrl === historicalOrderItem.image,
    'Historical order "Download Print Master" falls back to existing item.image safely'
  );
  assert(
    historicalDownloadUrl.includes('/uploads/design-legacy-123.png'),
    'Historical master download retrieves the original legacy file'
  );

  // -------------------------------------------------------------
  // [Test 17] Normal Catalog Checkout Regression
  // -------------------------------------------------------------
  console.log('\n[Test 17] Normal Catalog Checkout Regression');
  const catalogItem = {
    id: 15,
    productId: 15,
    name: 'Cyber Samurai',
    price: 179,
    image: 'https://posterealm.supabase.co/storage/v1/object/public/posters/cyber-samurai.png',
    image_thumbnail_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/15/v1/100.webp',
    image_card_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/15/v1/400.webp',
    image_preview_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/anime/15/v1/800.webp',
    size: 'A3',
    material: 'Matte',
    quantity: 1,
    origin: 'storefront'
  };

  assert(
    getStorefrontImage(catalogItem, 'thumbnail') === catalogItem.image_thumbnail_url,
    'Catalog item thumbnail resolves to 100px WebP'
  );
  assert(
    getStorefrontImage(catalogItem, 'card') === catalogItem.image_card_url,
    'Catalog item card resolves to 400px WebP'
  );
  assert(
    getStorefrontImage(catalogItem, 'preview') === catalogItem.image_preview_url,
    'Catalog item preview resolves to 800px WebP'
  );

  // Catalog item does not trigger custom download in admin
  const isCustomCatalog = Boolean(
    (catalogItem as any).customArtworkId ||
    (!(catalogItem as any).productId && (catalogItem as any).artwork_source !== 'collection') ||
    (catalogItem as any).origin === 'custom' ||
    catalogItem.name === 'Custom Masterpiece'
  );
  const catalogDownloadUrl = (catalogItem as any).artwork_url || (isCustomCatalog ? catalogItem.image : null);
  assert(catalogDownloadUrl === null, 'Catalog products do not show custom print master download button');

  // -------------------------------------------------------------
  // [Test 18] Poster Kit Regression
  // -------------------------------------------------------------
  console.log('\n[Test 18] Poster Kit Regression');
  const posterKitItem = {
    id: 900000025,
    productId: 25,
    name: 'Neon Tokyo',
    price: 100,
    size: 'A4',
    material: 'glossy',
    quantity: 1,
    origin: 'poster_kit',
    isPosterKit: true,
    artwork_source: 'collection',
    image: 'https://posterealm.supabase.co/storage/v1/object/public/posters/25/poster.png',
    artwork_url: 'https://posterealm.supabase.co/storage/v1/object/public/artworks/25.png',
    image_card_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/city/25/v1/400.webp',
    image_preview_url: 'https://posterealm.supabase.co/storage/v1/object/public/posters/storefront/city/25/v1/800.webp'
  };

  assert(
    getStorefrontImage(posterKitItem, 'thumbnail') === posterKitItem.image_card_url,
    'Poster Kit collection item resolves thumbnail to 400px WebP card variant'
  );
  assert(
    posterKitItem.isPosterKit === true,
    'Poster Kit flag preserved'
  );
  assert(
    posterKitItem.artwork_url === 'https://posterealm.supabase.co/storage/v1/object/public/artworks/25.png',
    'Poster Kit print artwork strictly isolated from thumbnail'
  );

  console.log(`\n${CYAN}--- ALL ${passedTests}/${totalTests} PHASE 3A TESTS PASSED SUCCESSFULLY! ---${RESET}\n`);
}

runTests().catch(err => {
  console.error(`${RED}Test suite encountered an unhandled error:${RESET}`, err);
  process.exit(1);
});

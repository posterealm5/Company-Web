/**
 * Comprehensive Security Verification Test Suite
 * 
 * Verifies remediation of critical, high, and medium vulnerabilities:
 * 1. Razorpay Payment Amount Verification (Prevents Cart Substitution / Underpayment)
 * 2. Buy X Get Y Coupon Eligibility Enforcement (Poster Kit Isolation in Backend)
 * 3. User Coupon Redemption Limit Enforcement (max_redemptions_per_user)
 * 4. Fake Paid Order Injection Prevention (Client createOrder restrictions)
 * 5. IDOR Prevention on Order Cancellation
 * 6. File Upload MIME / Extension Spoofing & Size Limit Protection
 * 7. Storage Bucket RLS Policy Integrity
 * 8. Vercel HTTP Security Headers
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { validateArtworkFile } from '../src/services/posterArtwork';
import { createOrder, cancelOrderByCustomer } from '../src/services/orders';

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(
        () => {
          console.log(`  [PASS] ${desc}`);
          passed++;
        },
        (err) => {
          console.error(`  [FAIL] ${desc}:`, err.message || err);
          failed++;
        }
      );
    }
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${desc}:`, err.message || err);
    failed++;
  }
}

async function runSecurityTests() {
  console.log('================================================================');
  console.log('--- POSTEREALM SECURITY REMEDIATION VERIFICATION SUITE ---');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // Suite 1: Razorpay Payment Verification (Gateway Amount Assertion)
  // --------------------------------------------------------------------------
  console.log('[Suite 1] Razorpay Payment Amount Verification & Cart Substitution Defense');

  const razorpayVerifyPath = path.resolve('supabase/functions/razorpay-verify/index.ts');
  const verifyCode = fs.readFileSync(razorpayVerifyPath, 'utf8');

  const razorpayOrderPath = path.resolve('supabase/functions/razorpay-order/index.ts');
  const orderCode = fs.readFileSync(razorpayOrderPath, 'utf8');

  it('razorpay-verify imports Razorpay SDK', () => {
    assert(verifyCode.includes('import Razorpay from "npm:razorpay"'), 'Razorpay SDK must be imported in razorpay-verify');
  });

  it('razorpay-verify fetches order details from Razorpay gateway API', () => {
    assert(verifyCode.includes('razorpay.orders.fetch(razorpay_order_id)'), 'Must fetch order from gateway');
  });

  it('razorpay-verify asserts Razorpay order amount matches backend calculated total exactly', () => {
    assert(
      verifyCode.includes('Number(rzpOrder.amount) !== expectedAmountInPaise') ||
      verifyCode.includes('rzpOrder.amount !== expectedAmountInPaise'),
      'Must verify order amount matches expected paise exactly'
    );
  });

  it('razorpay-verify rejects amount mismatch with explicit security failure', () => {
    assert(verifyCode.includes('Security validation failed: Razorpay order amount'), 'Must throw descriptive amount mismatch error');
  });

  it('razorpay-order and razorpay-verify validate item quantities using parseValidQuantity', () => {
    assert(orderCode.includes('parseValidQuantity'), 'razorpay-order must use parseValidQuantity');
    assert(verifyCode.includes('parseValidQuantity'), 'razorpay-verify must use parseValidQuantity');
  });

  it('razorpay-verify authenticates token to determine order user ownership', () => {
    assert(verifyCode.includes('authHeader.replace'), 'razorpay-verify must extract token from Authorization header');
    assert(verifyCode.includes('supabase.auth.getUser(token)'), 'razorpay-verify must verify token with auth.getUser');
    assert(verifyCode.includes('verifiedUserId = authUser.id'), 'razorpay-verify must bind order to authenticated user id');
  });

  // --------------------------------------------------------------------------
  // Suite 2: Buy X Get Y Coupon Backend Security (Poster Kit Isolation)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2] Buy X Get Y Backend Coupon Defense in Edge Functions');

  it('razorpay-order filters out Poster Kit items for Buy X Get Y coupons', () => {
    assert(
      orderCode.includes('eligibleRegularItems = paidItems.filter') &&
      orderCode.includes('isPosterKit'),
      'razorpay-order must filter out Poster Kit items for Buy X Get Y'
    );
  });

  it('razorpay-verify filters out Poster Kit items for Buy X Get Y coupons', () => {
    assert(
      verifyCode.includes('eligibleRegularItems = paidItems.filter') &&
      verifyCode.includes('isPosterKit'),
      'razorpay-verify must filter out Poster Kit items for Buy X Get Y'
    );
  });

  it('razorpay-order sets discount to 0 if eligible regular items < buy_qty', () => {
    assert(orderCode.includes('eligibleQuantity >= buyQty && freeQty > 0'), 'Must require eligible regular quantity >= buy_qty');
    assert(orderCode.includes('calculatedDiscount = 0'), 'Must set discount to 0 if threshold not met');
  });

  it('razorpay-verify sets discount to 0 if eligible regular items < buy_qty', () => {
    assert(verifyCode.includes('eligibleQuantity >= buyQty && freeQty > 0'), 'Must require eligible regular quantity >= buy_qty');
  });

  // --------------------------------------------------------------------------
  // Suite 3: User-Level Coupon Redemption Limit (max_redemptions_per_user)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3] User-Level Coupon Redemptions Defense');

  it('razorpay-order checks max_redemptions_per_user against past orders', () => {
    assert(orderCode.includes('max_redemptions_per_user'), 'Must check max_redemptions_per_user in razorpay-order');
    assert(orderCode.includes('eq(\'user_id\', userId)'), 'Must query user orders');
  });

  it('razorpay-verify checks max_redemptions_per_user against past orders', () => {
    assert(verifyCode.includes('max_redemptions_per_user'), 'Must check max_redemptions_per_user in razorpay-verify');
    assert(verifyCode.includes('eq(\'user_id\', userId)') || verifyCode.includes('eq(\'user_id\', finalUserId)'), 'Must query user orders');
  });

  const remediationSql = fs.readFileSync(path.resolve('supabase/migrations/20261109120000_security_remediation.sql'), 'utf8');

  it('remediation migration includes trg_enforce_coupon_redemption_limits with row-level locking', () => {
    assert(remediationSql.includes('enforce_coupon_redemption_limits'), 'Must declare enforce_coupon_redemption_limits function');
    assert(remediationSql.includes('FOR UPDATE'), 'Must lock coupon row with FOR UPDATE to serialize concurrent requests');
    assert(remediationSql.includes('v_user_redemptions >= v_coupon.max_redemptions_per_user'), 'Must enforce max_redemptions_per_user atomically');
    assert(remediationSql.includes('BEFORE INSERT ON public.orders'), 'Must trigger before insert on orders');
  });

  // --------------------------------------------------------------------------
  // Suite 4: Fake Paid Orders / Client Injection Prevention
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4] Client-Side Order Creation Constraints (createOrder)');

  await it('createOrder strictly rejects orders with payment_method = "ONLINE"', async () => {
    const maliciousOrder: any = {
      items: [{ name: 'Test Poster', quantity: 1, price: 100 }],
      subtotal: 100,
      shipping_charge: 99,
      total: 199,
      customer_name: 'Attacker',
      customer_email: 'attacker@evil.com',
      customer_phone: '9999999999',
      shipping_address: 'Udaipur, Rajasthan',
      payment_method: 'ONLINE',
      payment_status: 'Paid',
    };
    const res = await createOrder(maliciousOrder);
    assert.strictEqual(res, null, 'createOrder must reject ONLINE payment_method from client');
  });

  await it('createOrder strictly rejects orders with payment_status = "Paid"', async () => {
    const maliciousOrder: any = {
      items: [{ name: 'Test Poster', quantity: 1, price: 100 }],
      subtotal: 100,
      shipping_charge: 99,
      total: 199,
      customer_name: 'Attacker',
      customer_email: 'attacker@evil.com',
      customer_phone: '9999999999',
      shipping_address: 'Udaipur, Rajasthan',
      payment_method: 'COD',
      payment_status: 'Paid',
    };
    const res = await createOrder(maliciousOrder);
    assert.strictEqual(res, null, 'createOrder must reject Paid status from client');
  });

  await it('createOrder strictly rejects orders with total <= 0', async () => {
    const maliciousOrder: any = {
      items: [{ name: 'Free Poster', quantity: 100, price: 0 }],
      subtotal: 0,
      shipping_charge: 0,
      total: 0,
      customer_name: 'Attacker',
      customer_email: 'attacker@evil.com',
      customer_phone: '9999999999',
      shipping_address: 'Udaipur, Rajasthan',
      payment_method: 'COD',
      payment_status: 'Pending',
    };
    const res = await createOrder(maliciousOrder);
    assert.strictEqual(res, null, 'createOrder must reject total <= 0');
  });

  it('orders RLS policy enforces (user_id IS NOT DISTINCT FROM auth.uid())', () => {
    assert(remediationSql.includes('user_id IS NOT DISTINCT FROM auth.uid()'), 'Must enforce order ownership matching caller');
  });

  it('profiles admin trigger protects both INSERT and UPDATE against unauthorized promotion', () => {
    assert(remediationSql.includes("BEFORE INSERT OR UPDATE ON public.profiles"), 'Must trigger on INSERT OR UPDATE');
    assert(remediationSql.includes("TG_OP = 'INSERT'"), 'Must handle INSERT');
    assert(remediationSql.includes("TG_OP = 'UPDATE'"), 'Must handle UPDATE');
    assert(remediationSql.includes("NEW.is_admin IS DISTINCT FROM OLD.is_admin"), 'Must check DISTINCT for update');
  });

  // --------------------------------------------------------------------------
  // Suite 5: IDOR Prevention on Order Cancellation
  // --------------------------------------------------------------------------
  console.log('\n[Suite 5] IDOR Defense on Order Cancellation');

  await it('cancelOrderByCustomer rejects unauthenticated or unauthorized cancellations', async () => {
    // Calling cancel on a non-existent or foreign order fails gracefully
    const res = await cancelOrderByCustomer(999999);
    assert.strictEqual(res.success, false, 'Cancellation without valid ownership must fail');
  });

  // --------------------------------------------------------------------------
  // Suite 6: File Upload MIME / Extension Spoofing Defense
  // --------------------------------------------------------------------------
  console.log('\n[Suite 6] File Upload MIME & Extension Spoofing Defense');

  it('validateArtworkFile accepts valid JPEG image (.jpg + image/jpeg)', () => {
    const validJpg = new File(['dummy bytes'], 'poster.jpg', { type: 'image/jpeg' });
    const res = validateArtworkFile(validJpg);
    assert.strictEqual(res.isValid, true);
  });

  it('validateArtworkFile accepts valid PNG image (.png + image/png)', () => {
    const validPng = new File(['dummy bytes'], 'poster.png', { type: 'image/png' });
    const res = validateArtworkFile(validPng);
    assert.strictEqual(res.isValid, true);
  });

  it('validateArtworkFile accepts valid WebP image (.webp + image/webp)', () => {
    const validWebp = new File(['dummy bytes'], 'poster.webp', { type: 'image/webp' });
    const res = validateArtworkFile(validWebp);
    assert.strictEqual(res.isValid, true);
  });

  it('validateArtworkFile REJECTS executable with spoofed MIME (.exe with image/jpeg)', () => {
    const spoofedExe = new File(['binary payload'], 'malware.exe', { type: 'image/jpeg' });
    const res = validateArtworkFile(spoofedExe);
    assert.strictEqual(res.isValid, false, 'Must reject .exe extension despite image MIME');
  });

  it('validateArtworkFile REJECTS script with image extension (.png with application/javascript)', () => {
    const spoofedScript = new File(['console.log("pwn")'], 'payload.png', { type: 'application/javascript' });
    const res = validateArtworkFile(spoofedScript);
    assert.strictEqual(res.isValid, false, 'Must reject mismatched MIME type');
  });

  it('validateArtworkFile REJECTS HTML with image extension (.jpg with text/html)', () => {
    const spoofedHtml = new File(['<script>alert(1)</script>'], 'xss.jpg', { type: 'text/html' });
    const res = validateArtworkFile(spoofedHtml);
    assert.strictEqual(res.isValid, false, 'Must reject text/html MIME type');
  });

  it('validateArtworkFile REJECTS empty 0-byte file', () => {
    const emptyFile = new File([], 'empty.png', { type: 'image/png' });
    const res = validateArtworkFile(emptyFile);
    assert.strictEqual(res.isValid, false, 'Must reject 0-byte empty file');
  });

  it('validateArtworkFile REJECTS file exceeding 20 MB limit', () => {
    // Simulate oversized file by mocking size property
    const largeFile = new File([''], 'huge.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 25 * 1024 * 1024 });
    const res = validateArtworkFile(largeFile);
    assert.strictEqual(res.isValid, false, 'Must reject file exceeding 20 MB');
  });

  // Verify PosterDesignPickerModal.tsx and Customize.tsx code inspection
  const modalCode = fs.readFileSync(path.resolve('src/components/posterKit/PosterDesignPickerModal.tsx'), 'utf8');
  it('PosterDesignPickerModal enforces consistent MIME and extension', () => {
    assert(modalCode.includes('hasValidExt && hasValidType') || modalCode.includes('!hasValidExt || !hasValidType || !isConsistent'));
  });

  const customizeCode = fs.readFileSync(path.resolve('src/pages/Customize.tsx'), 'utf8');
  it('Customize.tsx enforces consistent MIME and extension with size check', () => {
    assert(customizeCode.includes('isExtValid && isTypeValid') || customizeCode.includes('!isExtValid || !isTypeValid || !isConsistent'));
    assert(customizeCode.includes('MAX_CUSTOM_SIZE_BYTES'));
  });

  // --------------------------------------------------------------------------
  // Suite 7: Storage Bucket RLS Policy Correctness
  // --------------------------------------------------------------------------
  console.log('\n[Suite 7] Storage Bucket RLS Policy Correctness');

  const storagePolicySql = fs.readFileSync(path.resolve('supabase/migrations/20261024010000_storage_posters_admin_policy.sql'), 'utf8');

  it('posters bucket RLS policies strictly require admin status (no open foldername OR branch)', () => {
    // Should NOT contain: (storage.foldername(name))[1] = 'artworks' OR
    assert(
      !storagePolicySql.includes("(storage.foldername(name))[1] = 'artworks' OR"),
      'Must NOT contain open foldername OR condition for authenticated users'
    );
    assert(storagePolicySql.includes('public.is_admin()'), 'Must require admin check');
  });

  // --------------------------------------------------------------------------
  // Suite 8: Vercel Deployment Security Headers
  // --------------------------------------------------------------------------
  console.log('\n[Suite 8] Vercel Deployment Security Headers');

  const vercelJson = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));

  it('vercel.json defines headers configuration', () => {
    assert(Array.isArray(vercelJson.headers) && vercelJson.headers.length > 0, 'vercel.json must have headers');
  });

  const allHeaders: { key: string; value: string }[] = vercelJson.headers[0].headers;
  const headerKeys = allHeaders.map(h => h.key.toLowerCase());

  it('includes X-Frame-Options to prevent Clickjacking', () => {
    assert(headerKeys.includes('x-frame-options'), 'Missing X-Frame-Options');
    const val = allHeaders.find(h => h.key.toLowerCase() === 'x-frame-options')?.value;
    assert.strictEqual(val, 'SAMEORIGIN');
  });

  it('includes X-Content-Type-Options: nosniff', () => {
    assert(headerKeys.includes('x-content-type-options'), 'Missing X-Content-Type-Options');
    const val = allHeaders.find(h => h.key.toLowerCase() === 'x-content-type-options')?.value;
    assert.strictEqual(val, 'nosniff');
  });

  it('includes Referrer-Policy', () => {
    assert(headerKeys.includes('referrer-policy'), 'Missing Referrer-Policy');
  });

  it('includes Strict-Transport-Security (HSTS)', () => {
    assert(headerKeys.includes('strict-transport-security'), 'Missing Strict-Transport-Security');
  });

  it('includes Permissions-Policy', () => {
    assert(headerKeys.includes('permissions-policy'), 'Missing Permissions-Policy');
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});


import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const POSTER_PRICING: Record<string, number> = { A5: 89, A4: 220, A3: 299, A2: 390 };
const FLAGSHIP_PREMIUM = 100;
const SHIPPING_CHARGE = 150;

function getPosterBasePrice(size: string): number {
  const sz = (size || '').toUpperCase();
  return POSTER_PRICING[sz] || POSTER_PRICING.A5;
}

function getMaterialPremium(material: string): number {
  const mat = (material || '').toLowerCase();
  return mat.includes('flagship') ? FLAGSHIP_PREMIUM : 0;
}

function calculateSinglePosterPrice(size: string, material: string): number {
  return getPosterBasePrice(size) + getMaterialPremium(material);
}

serve(async (req) => {
  console.log("[razorpay-verify] Verification request received");

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let generated_signature = "";
  let rzp_signature = "";

  try {
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim()
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!secret) throw new Error("RAZORPAY_KEY_SECRET not found in environment")
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase credentials not found in environment")

    const payload = await req.json()
    console.log("[razorpay-verify] Verification payload parsed:", JSON.stringify(payload, null, 2))

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: rzpSig,
      cartItems,
      customerInfo,
      couponCode,
      userId
    } = payload;

    rzp_signature = rzpSig?.trim();

    if (!razorpay_order_id || !razorpay_payment_id || !rzp_signature) {
      throw new Error("Missing required Razorpay payment details")
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !customerInfo) {
      throw new Error("Missing required order details")
    }

    // 1. Signature Verification using HMAC SHA256
    const signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const msgData = encoder.encode(signatureBody)

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      msgData
    )

    generated_signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")

    const isMatch = generated_signature.trim() === rzp_signature.trim().toLowerCase();
    console.log(`[razorpay-verify] Signature validation - Generated: ${generated_signature}, Received: ${rzp_signature}, Matches: ${isMatch}`);

    if (!isMatch) {
      throw new Error("Signature verification failed: mismatch")
    }

    // 2. Prevent duplicate verification and duplicate order creation
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (fetchError) {
      console.error("[razorpay-verify] Database lookup error:", fetchError.message);
    }

    if (existingOrder) {
      console.warn(`[razorpay-verify] Order already exists for razorpay_order_id: ${razorpay_order_id}. Skipping creation.`);
      return new Response(
        JSON.stringify({ success: true, order_id: existingOrder.id }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // 3. Validate totals on the backend
    let calculatedSubtotal = 0;
    const paidItems = cartItems.filter(item => !item.isFreeItem);
    const totalPaidQuantity = paidItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

    for (const item of paidItems) {
      // Validate product existence and active status in DB for non-custom items
      if (item.id && Number(item.id) < 1000000000000) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, is_active')
          .eq('id', item.id)
          .maybeSingle();

        if (productError) {
          console.error(`[razorpay-verify] Database error looking up product ${item.id}:`, productError);
        }

        if (!product || !product.is_active) {
          throw new Error(`Product not found or is currently inactive: ${item.name || item.id}`);
        }
      }

      const unitPrice = calculateSinglePosterPrice(item.size, item.material);
      calculatedSubtotal += unitPrice * (item.quantity || 1);
    }

    let calculatedDiscount = 0;
    let dbCoupon = null;

    if (couponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .maybeSingle();

      if (couponError) {
        console.error("[razorpay-verify] Database error fetching coupon:", couponError);
      }

      if (coupon) {
        dbCoupon = coupon;
        const now = new Date();
        let couponValid = true;

        if (!coupon.is_active) couponValid = false;
        if (coupon.start_date && now < new Date(coupon.start_date)) couponValid = false;
        if (coupon.end_date && now > new Date(coupon.end_date)) couponValid = false;
        if (coupon.max_redemptions !== null && (coupon.current_redemptions || 0) >= coupon.max_redemptions) couponValid = false;

        if (couponValid) {
          if (coupon.type === 'percentage' || coupon.type === 'percentage_discount') {
            const pct = coupon.value || coupon.discount_percent || 0;
            calculatedDiscount = Math.round(calculatedSubtotal * (pct / 100));
          } else if (coupon.type === 'fixed') {
            calculatedDiscount = coupon.value || 0;
          } else if (coupon.type === 'buy_x_get_y') {
            const sizeCounts: Record<string, number> = {};
            const materialCounts: Record<string, number> = {};

            paidItems.forEach(item => {
              const qty = item.quantity || 1;
              const sz = item.size || 'A3';
              const mat = item.material || 'Matte';
              sizeCounts[sz] = (sizeCounts[sz] || 0) + qty;
              materialCounts[mat] = (materialCounts[mat] || 0) + qty;
            });

            let majoritySize = 'A3';
            let maxSizeCount = 0;
            for (const [size, count] of Object.entries(sizeCounts)) {
              if (count > maxSizeCount) {
                maxSizeCount = count;
                majoritySize = size;
              } else if (count === maxSizeCount) {
                if (getPosterBasePrice(size) < getPosterBasePrice(majoritySize)) {
                  majoritySize = size;
                }
              }
            }

            let majorityMaterial = 'Matte';
            let maxMatCount = 0;
            for (const [material, count] of Object.entries(materialCounts)) {
              if (count > maxMatCount) {
                maxMatCount = count;
                majorityMaterial = material;
              } else if (count === maxMatCount) {
                if (getMaterialPremium(material) < getMaterialPremium(majorityMaterial)) {
                  majorityMaterial = material;
                }
              }
            }

            const buyQty = coupon.buy_qty || 1;
            const freeQty = coupon.free_qty || 0;
            const freeCount = Math.min(Math.max(totalPaidQuantity - buyQty, 0), freeQty);
            const freeItemUnitPrice = calculateSinglePosterPrice(majoritySize, majorityMaterial);
            calculatedDiscount = freeCount * freeItemUnitPrice;
          }
        }
      }
    }

    const calculatedNetSubtotal = Math.max(0, calculatedSubtotal - calculatedDiscount);
    const calculatedTotal = Math.max(0, calculatedNetSubtotal + SHIPPING_CHARGE);

    console.log(`[razorpay-verify] Verified amount on backend: ₹${calculatedTotal}`);

    // 4. Create Database Order
    const dbOrderData = {
      user_id: userId || null,
      items: cartItems,
      status: 'confirmed',
      customer_name: customerInfo.name,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      shipping_address: customerInfo.address,
      subtotal: calculatedSubtotal,
      shipping_charge: SHIPPING_CHARGE,
      total: calculatedTotal,
      payment_id: razorpay_payment_id,
      payment_method: 'ONLINE',
      payment_status: 'Paid',
      razorpay_order_id: razorpay_order_id,
      razorpay_signature: rzp_signature,
      coupon_code: couponCode || null,
      discount_amount: calculatedDiscount || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log("[razorpay-verify] Creating database order row:", JSON.stringify(dbOrderData, null, 2));

    const { data: newOrder, error: insertError } = await supabase
      .from('orders')
      .insert(dbOrderData)
      .select('id')
      .single();

    if (insertError) {
      console.error("[razorpay-verify] Failed to insert database order:", insertError.message);
      throw new Error(`Order insertion failed: ${insertError.message}`);
    }

    console.log(`[razorpay-verify] Database order created successfully with ID: ${newOrder.id}`);

    // 5. Increment coupon redemptions count
    if (dbCoupon) {
      console.log(`[razorpay-verify] Incrementing redemption count for coupon: ${couponCode}`);
      const { error: updateCouponError } = await supabase
        .from('coupons')
        .update({ current_redemptions: (dbCoupon.current_redemptions || 0) + 1 })
        .eq('id', dbCoupon.id);

      if (updateCouponError) {
        console.error("[razorpay-verify] Failed to increment redemption count:", updateCouponError.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, order_id: newOrder.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error("[razorpay-verify] Verification Step Failed:", error.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Razorpay from "npm:razorpay";
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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("[razorpay-order] Incoming Request Payload:", JSON.stringify(body, null, 2))

    const { cartItems, couponCode, customerInfo, userId } = body

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      throw new Error("Cart items are required")
    }

    const key_id = Deno.env.get("RAZORPAY_KEY_ID")
    const key_secret = Deno.env.get("RAZORPAY_KEY_SECRET")

    if (!key_id || !key_secret) {
      console.error("[razorpay-order] Razorpay credentials missing in environment")
      throw new Error("Server configuration error: Razorpay keys missing")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[razorpay-order] Supabase credentials missing in environment")
      throw new Error("Server configuration error: Supabase keys missing")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate subtotal from products in cart using backend-defined single poster pricing rules
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
          console.error(`[razorpay-order] Database error looking up product ${item.id}:`, productError);
        }

        if (!product || !product.is_active) {
          throw new Error(`Product not found or is currently inactive: ${item.name || item.id}`);
        }
      }

      const unitPrice = calculateSinglePosterPrice(item.size, item.material);
      calculatedSubtotal += unitPrice * (item.quantity || 1);
    }

    let calculatedDiscount = 0;

    // Validate Coupon if present
    if (couponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .maybeSingle();

      if (couponError) {
        console.error("[razorpay-order] Database error fetching coupon:", couponError);
      }

      if (coupon) {
        const now = new Date();
        let couponValid = true;

        if (!coupon.is_active) {
          couponValid = false;
          console.warn(`[razorpay-order] Coupon ${couponCode} is inactive`);
        }

        if (coupon.start_date && now < new Date(coupon.start_date)) {
          couponValid = false;
          console.warn(`[razorpay-order] Coupon ${couponCode} is not active yet`);
        }

        if (coupon.end_date && now > new Date(coupon.end_date)) {
          couponValid = false;
          console.warn(`[razorpay-order] Coupon ${couponCode} has expired`);
        }

        if (coupon.max_redemptions !== null && (coupon.current_redemptions || 0) >= coupon.max_redemptions) {
          couponValid = false;
          console.warn(`[razorpay-order] Coupon ${couponCode} max redemptions reached`);
        }

        if (couponValid) {
          if (coupon.type === 'percentage' || coupon.type === 'percentage_discount') {
            const pct = coupon.value || coupon.discount_percent || 0;
            calculatedDiscount = Math.round(calculatedSubtotal * (pct / 100));
          } else if (coupon.type === 'fixed') {
            calculatedDiscount = coupon.value || 0;
          } else if (coupon.type === 'buy_x_get_y') {
            // Find majority size and material of paid items
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
      } else {
        console.warn(`[razorpay-order] Coupon ${couponCode} not found in database`);
      }
    }

    const calculatedNetSubtotal = Math.max(0, calculatedSubtotal - calculatedDiscount);
    const calculatedTotal = Math.max(0, calculatedNetSubtotal + SHIPPING_CHARGE);

    console.log(`[razorpay-order] Calculated Subtotal: ₹${calculatedSubtotal}, Discount: ₹${calculatedDiscount}, Shipping: ₹${SHIPPING_CHARGE}, Total: ₹${calculatedTotal}`);

    // Create Razorpay Order
    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    // Convert to paise EXACTLY ONCE
    const amountInPaise = Math.round(calculatedTotal * 100);

    console.log(`[razorpay-order] Creating Razorpay order. Amount in paise: ${amountInPaise}`);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    });

    console.log("[razorpay-order] Razorpay Order Created Successfully:", JSON.stringify(razorpayOrder, null, 2))

    return new Response(
      JSON.stringify({
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        calculatedTotal: calculatedTotal
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    )
  } catch (error) {
    console.error("[razorpay-order] Order Creation Step Failed:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Order creation failed" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      },
    )
  }
})

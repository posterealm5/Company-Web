import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Razorpay from "npm:razorpay";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Order Creation Payload:", JSON.stringify(body, null, 2))
    
    const { amount, currency = "INR", receipt } = body

    if (!amount) {
      throw new Error("Amount is required")
    }

    const key_id = Deno.env.get("RAZORPAY_KEY_ID")
    const key_secret = Deno.env.get("RAZORPAY_SECRET_KEY")

    if (!key_id || !key_secret) {
      console.error("Razorpay credentials missing in environment")
      throw new Error("Server configuration error: Razorpay keys missing")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase credentials missing in environment")
      throw new Error("Server configuration error: Supabase keys missing")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if the order already has a Razorpay order ID to prevent duplicate creations
    if (receipt) {
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('status, razorpay_order_id')
        .eq('id', receipt)
        .maybeSingle()

      if (fetchError) {
        console.error("Error fetching order from database:", fetchError.message)
      }

      if (orderData) {
        if (orderData.razorpay_order_id) {
          console.warn(`Razorpay order already exists for database order ID ${receipt}: ${orderData.razorpay_order_id}`)
          return new Response(
            JSON.stringify({ error: "Razorpay order already exists for this database order" }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            },
          )
        }

        if (orderData.status !== 'pending') {
          console.warn(`Database order ID ${receipt} status is not pending: ${orderData.status}`)
          return new Response(
            JSON.stringify({ error: `Cannot initiate payment. Order status is already '${orderData.status}'` }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            },
          )
        }
      }
    }

    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    console.log(`Creating Razorpay order for amount: ${amount}, receipt: ${receipt}`)

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert to paise
      currency,
      receipt,
    });

    console.log("Razorpay Order Created:", JSON.stringify(order, null, 2))

    // Save the razorpay_order_id back to the database order immediately
    if (receipt) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ razorpay_order_id: order.id })
        .eq('id', receipt)

      if (updateError) {
        console.error(`Failed to update order with razorpay_order_id: ${updateError.message}`)
        throw new Error(`Database association failed: ${updateError.message}`)
      }
      console.log(`Successfully associated Razorpay order ${order.id} with database order ${receipt}`)
    }

    return new Response(
      JSON.stringify(order),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    )
  } catch (error) {
    console.error("Order Creation Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      },
    )
  }
})

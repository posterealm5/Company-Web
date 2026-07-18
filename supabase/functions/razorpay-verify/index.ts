import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("STEP 1: Request received")
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let generated_signature = "";
  let rzp_signature = "";

  try {
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim()
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!secret) throw new Error("RAZORPAY_KEY_SECRET not found")
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase credentials not found")

    const payload = await req.json()
    console.log("STEP 2: Payload parsed")
    console.log("Payload:", JSON.stringify(payload))

    const rzp_order_id = payload.razorpay_order_id?.trim()
    const rzp_payment_id = payload.razorpay_payment_id?.trim()
    rzp_signature = payload.razorpay_signature?.trim()
    const internal_order_id = payload.order_id

    if (!rzp_order_id || !rzp_payment_id || !rzp_signature || !internal_order_id) {
      throw new Error("Missing required fields")
    }

    // Signature Verification
    const signatureBody = `${rzp_order_id}|${rzp_payment_id}`
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

    console.log("STEP 3: Signature generated")
    console.log("Generated:", generated_signature)
    console.log("Received:", rzp_signature)

    const isMatch = generated_signature.trim() === rzp_signature.trim().toLowerCase()
    console.log("Exact comparison result:", isMatch)

    if (!isMatch) {
      throw new Error("Signature mismatch")
    }

    console.log("STEP 4: Signature comparison passed")

    console.log("STEP 5: Updating database")
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'confirmed',
        payment_id: rzp_payment_id,
        razorpay_order_id: rzp_order_id,
        razorpay_signature: rzp_signature,
        payment_status: 'Paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', internal_order_id)
      .select()

    console.log("Update Result:", data)
    console.log("Update Error:", error)

    if (error) throw new Error(`DB Update Failed: ${error.message}`)
    if (!data || data.length === 0) throw new Error("Order not found")

    console.log("STEP 6: Database updated")
    console.log("STEP 7: Returning success")

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error("STEP FAILURE:", error.message)
    return new Response(
      JSON.stringify({ 
        success: false, 
        step: "verification_process",
        generated_signature,
        received_signature: rzp_signature,
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

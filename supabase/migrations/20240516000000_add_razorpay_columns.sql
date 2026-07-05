-- Migration: Add Razorpay columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_signature TEXT,
ADD COLUMN IF NOT EXISTS payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT;

-- Update status column if needed (ensure it has correct types)
-- ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';

-- Migration: Add subtotal and shipping_charge to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC,
ADD COLUMN IF NOT EXISTS shipping_charge NUMERIC;

-- Update existing records to have subtotal = total and shipping_charge = 0
-- (assuming existing records didn't have shipping charges stored correctly)
UPDATE public.orders 
SET subtotal = total, shipping_charge = 0 
WHERE subtotal IS NULL;

-- Make them NOT NULL after seeding
ALTER TABLE public.orders 
ALTER COLUMN subtotal SET NOT NULL,
ALTER COLUMN shipping_charge SET NOT NULL;

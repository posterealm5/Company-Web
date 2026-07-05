-- Supabase migration: Add support for cancelled_at column on orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

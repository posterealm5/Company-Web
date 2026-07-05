-- Migration: Add coupon columns to orders table
ALTER TABLE public.orders ADD COLUMN coupon_code TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN discount_amount NUMERIC DEFAULT NULL;

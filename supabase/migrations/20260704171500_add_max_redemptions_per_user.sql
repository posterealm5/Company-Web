-- Migration: Add max_redemptions_per_user to coupons table
ALTER TABLE public.coupons ADD COLUMN max_redemptions_per_user INTEGER DEFAULT NULL;

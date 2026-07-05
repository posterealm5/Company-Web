-- Migration: Add display_name field to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_name TEXT;

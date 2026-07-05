-- Migration to add SEO fields to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS alt_text TEXT;

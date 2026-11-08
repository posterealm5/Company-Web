-- Migration: Add Artwork URL to Products Table
-- Created: 2026-10-24
-- Purpose: Store clean original print artwork URL for Poster Kit and high-resolution printing,
--          separated completely from storefront room mockups.

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS artwork_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.products.artwork_url IS 'Dedicated clean original print artwork URL stored in Supabase Storage (artworks/{productId}.{ext}) without room mockups';

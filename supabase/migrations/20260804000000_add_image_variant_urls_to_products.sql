-- Migration: Add Storefront Image Variant URLs to Products Table
-- Created: 2026-08-04
-- Purpose: Support high-performance storefront image delivery (100px, 400px, 800px WebP)
--          while preserving original high-resolution print/manufacturing assets in `products.image`.

ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS image_thumbnail_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_card_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_preview_url TEXT DEFAULT NULL;

COMMENT ON COLUMN products.image IS 'Original high-resolution print/manufacturing asset URL';
COMMENT ON COLUMN products.image_thumbnail_url IS '100px WebP storefront thumbnail URL (for cart, order history, admin table)';
COMMENT ON COLUMN products.image_card_url IS '400px WebP storefront card URL (for collections grid, wishlist, homepage)';
COMMENT ON COLUMN products.image_preview_url IS '800px WebP storefront preview URL (for product detail page and quick-add modal)';

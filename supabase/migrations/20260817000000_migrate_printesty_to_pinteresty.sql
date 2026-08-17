-- Migration: Migrate legacy 'Printesty' genre database values to canonical 'Pinteresty'
-- Description: Updates the genre column for all products currently set to 'Printesty' to 'Pinteresty'.
-- Preserves all other columns (id, name, description, price, slug, image, image_thumbnail_url, image_card_url, image_preview_url, etc.).

UPDATE products
SET genre = 'Pinteresty'
WHERE genre = 'Printesty';

-- Migration to safely update existing order items with the new tracking fields.
-- This ensures that old order logs are fully compatible with the new dashboard views.

UPDATE public.orders
SET items = (
  SELECT jsonb_strip_nulls(
    jsonb_agg(
      jsonb_build_object(
        'product_id', (item->>'product_id')::bigint,
        'name', item->>'name',
        'size', item->>'size',
        'material', item->>'material',
        'price', (item->>'price')::numeric,
        'quantity', (item->>'quantity')::int,
        'image', item->>'image',
        'selected_size', COALESCE(item->>'selected_size', item->>'size'),
        'selected_material', COALESCE(item->>'selected_material', item->>'material'),
        'unit_price', COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric),
        'line_total', COALESCE((item->>'line_total')::numeric, (item->>'price')::numeric * (item->>'quantity')::int),
        'width', (item->>'width')::numeric,
        'height', (item->>'height')::numeric,
        'area', (item->>'area')::numeric,
        'custom_price', (item->>'custom_price')::numeric
      )
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE items IS NOT NULL AND jsonb_typeof(items) = 'array';

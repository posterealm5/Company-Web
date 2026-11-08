-- Migration: supabase/migrations/20261108130000_register_poster_kit_layout_rpc.sql
-- Description: Server-side RPC for registering Poster Kit layouts with strict validation, 7-day TTL, and empty search_path

CREATE OR REPLACE FUNCTION public.register_poster_kit_layout(
    p_items jsonb,
    p_subtotal numeric
)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_item_count integer;
    v_layout_id uuid;
    v_created_at timestamptz;
    v_expires_at timestamptz;
    v_item jsonb;
    v_id text;
    v_label text;
    v_size_id text;
    v_orientation text;
    v_material text;
    v_x_pct numeric;
    v_y_pct numeric;
    v_w_pct numeric;
    v_h_pct numeric;
BEGIN
    -- 1. Identity Verification (Server-Side: derived strictly from authenticated JWT context)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate items is a JSON array
    IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Invalid items: must be a JSON array' USING ERRCODE = '22023';
    END IF;

    -- 3. Validate item count >= 3
    v_item_count := pg_catalog.jsonb_array_length(p_items);
    IF v_item_count < 3 THEN
        RAISE EXCEPTION 'Invalid item count: Poster Kit layouts must contain at least 3 items (received %)', v_item_count USING ERRCODE = '23514';
    END IF;

    -- 4. Validate subtotal: reject NULL, non-finite values (NaN, Infinity, -Infinity), and negative values
    IF p_subtotal IS NULL OR 
       pg_catalog.lower(pg_catalog.btrim(p_subtotal::text)) IN ('nan', 'infinity', '-infinity') OR 
       p_subtotal < 0 THEN
        RAISE EXCEPTION 'Invalid subtotal: must be a non-negative finite number' USING ERRCODE = '23514';
    END IF;

    -- 5. Deep validation of each layout item
    FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items) LOOP
        -- Must be a JSON object
        IF pg_catalog.jsonb_typeof(v_item) != 'object' THEN
            RAISE EXCEPTION 'Invalid layout item: each item must be a JSON object' USING ERRCODE = '22023';
        END IF;

        -- 5.1 Explicit JSON string type validation for required text fields using IS DISTINCT FROM
        IF pg_catalog.jsonb_typeof(v_item->'id') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION 'Invalid layout item: id must be a string' USING ERRCODE = '22023';
        END IF;

        IF pg_catalog.jsonb_typeof(v_item->'label') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION 'Invalid layout item: label must be a string' USING ERRCODE = '22023';
        END IF;

        IF pg_catalog.jsonb_typeof(v_item->'sizeId') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION 'Invalid layout item: sizeId must be a string' USING ERRCODE = '22023';
        END IF;

        IF pg_catalog.jsonb_typeof(v_item->'orientation') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION 'Invalid layout item: orientation must be a string' USING ERRCODE = '22023';
        END IF;

        IF pg_catalog.jsonb_typeof(v_item->'material') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION 'Invalid layout item: material must be a string' USING ERRCODE = '22023';
        END IF;

        -- 5.2 Validate non-empty and allowed values
        v_id := pg_catalog.btrim(v_item->>'id');
        IF v_id = '' THEN
            RAISE EXCEPTION 'Invalid layout item: id must be a non-empty string' USING ERRCODE = '22023';
        END IF;

        v_label := pg_catalog.btrim(v_item->>'label');
        IF v_label = '' THEN
            RAISE EXCEPTION 'Invalid layout item: label must be a non-empty string' USING ERRCODE = '22023';
        END IF;

        v_size_id := pg_catalog.upper(pg_catalog.btrim(v_item->>'sizeId'));
        IF v_size_id NOT IN ('A6', 'A5', 'A4', 'A3') THEN
            RAISE EXCEPTION 'Invalid sizeId in layout item: % (expected A6, A5, A4, or A3)', v_size_id USING ERRCODE = '23514';
        END IF;

        v_orientation := pg_catalog.lower(pg_catalog.btrim(v_item->>'orientation'));
        IF v_orientation NOT IN ('portrait', 'landscape') THEN
            RAISE EXCEPTION 'Invalid orientation in layout item: % (expected portrait or landscape)', v_orientation USING ERRCODE = '23514';
        END IF;

        v_material := pg_catalog.lower(pg_catalog.btrim(v_item->>'material'));
        IF v_material NOT IN ('matte', 'glossy', 'rigid_board') THEN
            RAISE EXCEPTION 'Invalid material in layout item: % (expected matte, glossy, or rigid_board)', v_material USING ERRCODE = '23514';
        END IF;

        -- 5.3 Validate coordinate text presence and reject empty/null values
        IF (v_item->>'xPercent') IS NULL OR pg_catalog.btrim(v_item->>'xPercent') = '' OR
           (v_item->>'yPercent') IS NULL OR pg_catalog.btrim(v_item->>'yPercent') = '' OR
           (v_item->>'widthPercent') IS NULL OR pg_catalog.btrim(v_item->>'widthPercent') = '' OR
           (v_item->>'heightPercent') IS NULL OR pg_catalog.btrim(v_item->>'heightPercent') = '' THEN
            RAISE EXCEPTION 'Invalid layout item: coordinates must be non-null and non-empty' USING ERRCODE = '22023';
        END IF;

        -- Reject non-finite strings before conversion
        IF pg_catalog.lower(pg_catalog.btrim(v_item->>'xPercent')) IN ('nan', 'infinity', '-infinity') OR
           pg_catalog.lower(pg_catalog.btrim(v_item->>'yPercent')) IN ('nan', 'infinity', '-infinity') OR
           pg_catalog.lower(pg_catalog.btrim(v_item->>'widthPercent')) IN ('nan', 'infinity', '-infinity') OR
           pg_catalog.lower(pg_catalog.btrim(v_item->>'heightPercent')) IN ('nan', 'infinity', '-infinity') THEN
            RAISE EXCEPTION 'Invalid layout item: coordinates cannot be NaN or Infinity' USING ERRCODE = '23514';
        END IF;

        -- Convert coordinates to numeric
        BEGIN
            v_x_pct := (v_item->>'xPercent')::numeric;
            v_y_pct := (v_item->>'yPercent')::numeric;
            v_w_pct := (v_item->>'widthPercent')::numeric;
            v_h_pct := (v_item->>'heightPercent')::numeric;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid coordinate format in layout item: must be valid numeric values' USING ERRCODE = '22023';
        END;

        -- Explicitly reject any converted non-finite NUMERIC values
        IF pg_catalog.lower(pg_catalog.btrim(v_x_pct::text)) IN ('nan', 'infinity', '-infinity') OR
           pg_catalog.lower(pg_catalog.btrim(v_y_pct::text)) IN ('nan', 'infinity', '-infinity') OR
           pg_catalog.lower(pg_catalog.btrim(v_w_pct::text)) IN ('nan', 'infinity', '-infinity') OR
           pg_catalog.lower(pg_catalog.btrim(v_h_pct::text)) IN ('nan', 'infinity', '-infinity') THEN
            RAISE EXCEPTION 'Invalid coordinate numeric value: cannot be NaN or Infinity' USING ERRCODE = '23514';
        END IF;

        -- Retain coordinate bounds checking
        IF v_x_pct < 0 OR v_y_pct < 0 OR v_w_pct <= 0 OR v_h_pct <= 0 OR
           v_x_pct > 100 OR v_y_pct > 100 OR v_w_pct > 100 OR v_h_pct > 100 THEN
            RAISE EXCEPTION 'Layout item coordinates out of bounds: x=%, y=%, w=%, h=% (must satisfy 0 <= x <= 100, 0 <= y <= 100, 0 < w <= 100, 0 < h <= 100)', v_x_pct, v_y_pct, v_w_pct, v_h_pct USING ERRCODE = '23514';
        END IF;
    END LOOP;

    -- 6. Enforce 7-Day Expiry TTL
    v_created_at := pg_catalog.clock_timestamp();
    v_expires_at := v_created_at + interval '7 days';

    -- 7. Insert record with elevated privileges (SECURITY DEFINER)
    INSERT INTO public.poster_kit_layouts (
        user_id,
        item_count,
        items,
        subtotal,
        status,
        created_at,
        expires_at
    ) VALUES (
        v_user_id,
        v_item_count,
        p_items,
        p_subtotal,
        'active',
        v_created_at,
        v_expires_at
    )
    RETURNING id INTO v_layout_id;

    -- 8. Return structured JSON
    RETURN pg_catalog.jsonb_build_object(
        'id', v_layout_id,
        'user_id', v_user_id,
        'item_count', v_item_count,
        'subtotal', p_subtotal,
        'status', 'active',
        'created_at', v_created_at,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- DAC Permissions:
REVOKE ALL ON FUNCTION public.register_poster_kit_layout(jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_poster_kit_layout(jsonb, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_poster_kit_layout(jsonb, numeric) TO service_role;

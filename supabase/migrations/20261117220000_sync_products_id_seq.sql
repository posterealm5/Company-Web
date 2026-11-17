-- Migration: 20261117220000_sync_products_id_seq.sql
-- Purpose: Synchronize the PostgreSQL identity sequence for public.products with the maximum existing ID.
-- Root Cause: When catalog products (IDs 1..155) were seeded with explicit primary keys, PostgreSQL's
--             internal identity sequence (products_id_seq) was not advanced. When the admin panel
--             subsequently attempts to insert a new product without an explicit ID, PostgreSQL's nextval()
--             evaluates to an already existing low integer (e.g. 1), causing:
--             "duplicate key value violates unique constraint 'products_pkey'".
-- Safety Guarantee: Non-destructive. Does not alter, re-index, delete, or re-order any existing rows.

DO $$
DECLARE
    seq_name text;
    max_id bigint;
BEGIN
    -- 1. Identify sequence name associated with public.products.id
    seq_name := pg_get_serial_sequence('public.products', 'id');
    
    -- 2. Retrieve the current maximum ID
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.products;
    
    -- 3. Synchronize sequence if valid sequence and max_id found
    IF seq_name IS NOT NULL THEN
        PERFORM setval(seq_name, GREATEST(max_id, 1), true);
        RAISE NOTICE 'Synchronized sequence % to % (next product will receive ID %)', seq_name, GREATEST(max_id, 1), GREATEST(max_id, 1) + 1;
    ELSE
        RAISE WARNING 'No sequence found for public.products(id)';
    END IF;
END $$;


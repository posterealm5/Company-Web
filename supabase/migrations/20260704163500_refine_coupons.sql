-- Migration: Refine coupons system and add order cancellation trigger

-- 1. Clean up existing coupons that don't match the new allowed types
DELETE FROM public.coupons WHERE type NOT IN ('percentage', 'buy_x_get_y');

-- 2. Restrict coupons type check constraint to only allowed types
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_type_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_type_check CHECK (type IN ('percentage', 'buy_x_get_y'));

-- 3. Drop deprecated columns
ALTER TABLE public.coupons DROP COLUMN IF EXISTS min_quantity;
ALTER TABLE public.coupons DROP COLUMN IF EXISTS discount_percent;
ALTER TABLE public.coupons DROP COLUMN IF EXISTS min_order_value;

-- 4. Create trigger to release coupon redemptions when an order is cancelled
CREATE OR REPLACE FUNCTION public.handle_order_cancellation()
RETURNS TRIGGER AS $$
DECLARE
    item jsonb;
    coupon_code_found text := NULL;
BEGIN
    -- Only act if the status was changed to 'cancelled'
    IF OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN
        -- Find if a coupon code was used in this order by looking inside NEW.items
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
            IF item ? 'couponCode' AND (item->>'couponCode') IS NOT NULL AND (item->>'couponCode') <> '' THEN
                coupon_code_found := item->>'couponCode';
                EXIT; -- Assuming one coupon per order
            END IF;
        END LOOP;

        IF coupon_code_found IS NOT NULL THEN
            -- Decrement current_redemptions by 1 for this coupon, ensuring it never goes below 0
            UPDATE public.coupons
            SET current_redemptions = GREATEST(0, current_redemptions - 1)
            WHERE UPPER(code) = UPPER(coupon_code_found);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplication
DROP TRIGGER IF EXISTS trg_handle_order_cancellation ON public.orders;

-- Attach trigger to orders table
CREATE TRIGGER trg_handle_order_cancellation
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_cancellation();

-- Security Remediation Migration: 20261109120000_security_remediation.sql
-- Description: Hardens orders RLS, restricts posters storage access to admins, prevents admin self-promotion, and introduces secure customer cancellation RPC.
-- Status: Prepared for review. NOT executed on production without authorization.

BEGIN;

-- 1. Hardened RLS Policy on public.orders for INSERT
-- Prevents unauthenticated/arbitrary clients from creating fake "Paid" or "ONLINE" orders.
-- Direct client insert is strictly limited to Cash on Delivery with Pending status.
-- Razorpay orders with 'Paid' status can ONLY be inserted by backend Edge Functions via service_role.
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for valid orders" ON public.orders;

CREATE POLICY "Enable insert for valid orders" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (
    (auth.role() = 'service_role')
    OR
    (
        payment_method = 'COD' AND
        payment_status = 'Pending' AND
        status IN ('pending', 'confirmed') AND
        total > 0 AND
        subtotal > 0 AND
        (user_id IS NOT DISTINCT FROM auth.uid())
    )
);

-- 2. Correct Storage Bucket RLS Policies for 'posters'
-- Revokes unintentional authenticated public write/delete permissions on catalog print masters.
-- Upload, replace, and delete in 'posters' bucket are strictly restricted to administrators.
DROP POLICY IF EXISTS "Admins can upload to posters bucket" ON storage.objects;
CREATE POLICY "Admins can upload to posters bucket" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
);

DROP POLICY IF EXISTS "Admins can update posters bucket" ON storage.objects;
CREATE POLICY "Admins can update posters bucket" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
)
WITH CHECK (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
);

DROP POLICY IF EXISTS "Admins can delete from posters bucket" ON storage.objects;
CREATE POLICY "Admins can delete from posters bucket" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
);

-- 3. Prevent Customer Self-Promotion to Administrator on public.profiles
CREATE OR REPLACE FUNCTION public.protect_profiles_is_admin()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_admin = true THEN
            IF auth.role() != 'service_role' AND NOT public.is_admin() THEN
                RAISE EXCEPTION 'Unauthorized: customers cannot set is_admin = true on insert.' USING ERRCODE = '42501';
            END IF;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            IF auth.role() != 'service_role' AND NOT public.is_admin() THEN
                RAISE EXCEPTION 'Unauthorized: customers cannot modify is_admin.' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profiles_is_admin ON public.profiles;
CREATE TRIGGER trg_protect_profiles_is_admin
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_is_admin();

-- 4. Secure Customer Order Cancellation RPC
-- Prevents IDOR and ensures only the order owner can cancel their own pending/confirmed order.
CREATE OR REPLACE FUNCTION public.cancel_order_by_customer(p_order_id BIGINT)
RETURNS public.orders AS $$
DECLARE
    v_order public.orders;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: You must be signed in to cancel an order.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found.', p_order_id USING ERRCODE = 'P0002';
    END IF;

    IF v_order.user_id != v_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to cancel this order.' USING ERRCODE = '42501';
    END IF;

    IF v_order.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Order cannot be cancelled. Current status is %.', v_order.status USING ERRCODE = '22023';
    END IF;

    UPDATE public.orders
    SET 
        status = 'cancelled',
        cancelled_by = v_user_id::text,
        cancelled_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    RETURN v_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.cancel_order_by_customer(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order_by_customer(BIGINT) TO authenticated;

-- 5. Enforce Coupon Redemption Limits (Concurrency Protection)
-- Serializes concurrent checkouts using SELECT ... FOR UPDATE on the coupon row.
-- Prevents TOCTOU race conditions where concurrent requests bypass max_redemptions_per_user.
CREATE OR REPLACE FUNCTION public.enforce_coupon_redemption_limits()
RETURNS trigger AS $$
DECLARE
    v_coupon public.coupons;
    v_user_redemptions INTEGER;
BEGIN
    IF NEW.coupon_code IS NOT NULL AND pg_catalog.btrim(NEW.coupon_code) <> '' THEN
        -- Lock coupon row to serialize concurrent transactions attempting to redeem this coupon
        SELECT * INTO v_coupon
        FROM public.coupons
        WHERE UPPER(code) = UPPER(pg_catalog.btrim(NEW.coupon_code))
        FOR UPDATE;

        IF FOUND THEN
            -- Check max_redemptions_per_user if user_id is present
            IF v_coupon.max_redemptions_per_user IS NOT NULL AND NEW.user_id IS NOT NULL THEN
                SELECT count(*) INTO v_user_redemptions
                FROM public.orders
                WHERE user_id = NEW.user_id
                  AND UPPER(pg_catalog.btrim(coupon_code)) = UPPER(pg_catalog.btrim(NEW.coupon_code))
                  AND status != 'cancelled';

                IF v_user_redemptions >= v_coupon.max_redemptions_per_user THEN
                    RAISE EXCEPTION 'Coupon redemption limit per user exceeded for code %', NEW.coupon_code
                        USING ERRCODE = '22023';
                END IF;
            END IF;

            -- Check global max_redemptions if defined
            IF v_coupon.max_redemptions IS NOT NULL THEN
                IF v_coupon.current_redemptions >= v_coupon.max_redemptions THEN
                    RAISE EXCEPTION 'Coupon maximum redemptions exceeded for code %', NEW.coupon_code
                        USING ERRCODE = '22023';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_coupon_redemption_limits ON public.orders;
CREATE TRIGGER trg_enforce_coupon_redemption_limits
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_coupon_redemption_limits();

COMMIT;


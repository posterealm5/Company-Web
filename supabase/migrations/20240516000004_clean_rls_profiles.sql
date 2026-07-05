-- Migration: Clean RLS Policies for Profiles (Prevent Recursion)
-- Root cause of timeout is often recursion in RLS policies.

-- 1. Remove all complex/recursive policies from profiles
DROP POLICY IF EXISTS "Profiles self management" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;

-- 2. Create simple, non-recursive policies
-- Users can view and manage their own profile
CREATE POLICY "profiles_self_access" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- 3. Update Admin policies on OTHER tables to be more efficient
-- Products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_app_meta_data->>'is_admin')::boolean = true
        ) OR 
        -- Fallback to profile check if metadata is not set (more expensive but safer for now)
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
    );

-- Orders
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_app_meta_data->>'is_admin')::boolean = true
        ) OR 
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_app_meta_data->>'is_admin')::boolean = true
        ) OR 
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
    );

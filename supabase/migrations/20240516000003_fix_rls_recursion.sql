-- Migration: Fix RLS Recursion and Enhance Admin Policies
-- 1. Create a security definer function to check admin status safely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up existing recursive/conflicting policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 3. Implement non-recursive policies for profiles
-- Allow users to manage their own profile
CREATE POLICY "Profiles self management" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Allow admins to view and manage all profiles
CREATE POLICY "Admins manage all profiles" ON public.profiles
    FOR ALL USING (public.is_admin());

-- 4. Update other table policies to use the new is_admin() function for consistency and performance
-- Products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
    FOR ALL USING (public.is_admin());

-- Orders
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders
    FOR UPDATE USING (public.is_admin());

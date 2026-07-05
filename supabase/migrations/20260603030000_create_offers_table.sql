-- Migration: Create offers table for promotional bar
CREATE TABLE IF NOT EXISTS public.offers (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  highlight_color TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  coupon_code TEXT,
  target_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Select policy: Anyone can view offers (public read)
CREATE POLICY "Anyone can view offers" ON public.offers
  FOR SELECT USING (true);

-- Insert/Update/Delete policy: Admins can do everything
CREATE POLICY "Admins can manage offers" ON public.offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

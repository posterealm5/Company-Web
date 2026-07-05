-- Create addresses table
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    house TEXT NOT NULL,
    street TEXT,
    landmark TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT DEFAULT 'India' NOT NULL,
    address_type TEXT CHECK (address_type IN ('Home', 'Work', 'Other')) NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Server-side validations
    CONSTRAINT valid_phone CHECK (phone ~ '^\+?[0-9\s\-()]{10,20}$'),
    CONSTRAINT valid_pincode CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$')
);

-- Performance index
CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON public.addresses(user_id);

-- Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own addresses" ON public.addresses;
CREATE POLICY "Users can view own addresses" ON public.addresses
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
CREATE POLICY "Users can insert own addresses" ON public.addresses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
CREATE POLICY "Users can update own addresses" ON public.addresses
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
CREATE POLICY "Users can delete own addresses" ON public.addresses
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger: Automatically maintain updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_addresses_updated_at ON public.addresses;
CREATE TRIGGER set_addresses_updated_at
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Trigger: Handle default address switching database-side
CREATE OR REPLACE FUNCTION public.handle_default_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.addresses
        SET is_default = false
        WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_address_default_changed ON public.addresses;
CREATE TRIGGER on_address_default_changed
    BEFORE INSERT OR UPDATE OF is_default ON public.addresses
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE PROCEDURE public.handle_default_address();

-- Data Migration
DO $$
DECLARE
    profile_rec RECORD;
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'complete_address'
    ) THEN
        FOR profile_rec IN 
            SELECT id, email, full_name, phone, complete_address, nearest_landmark 
            FROM public.profiles 
            WHERE complete_address IS NOT NULL AND TRIM(complete_address) <> ''
        LOOP
            INSERT INTO public.addresses (
                user_id,
                recipient_name,
                phone,
                house,
                street,
                landmark,
                city,
                state,
                pincode,
                country,
                address_type,
                is_default
            ) VALUES (
                profile_rec.id,
                COALESCE(NULLIF(TRIM(profile_rec.full_name), ''), 'Recipient'),
                COALESCE(NULLIF(TRIM(profile_rec.phone), ''), '0000000000'),
                profile_rec.complete_address,
                NULL,
                profile_rec.nearest_landmark,
                NULL,
                NULL,
                NULL,
                'India',
                'Home',
                true
            ) ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- Drop columns from profiles table
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS complete_address;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS nearest_landmark;
    END IF;
END $$;

-- Create sellers table
CREATE TABLE IF NOT EXISTS public.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) NOT NULL CHECK (business_type IN ('individual', 'business')),
  category VARCHAR(100) NOT NULL,
  gst_number VARCHAR(15),
  description TEXT,
  contact_phone TEXT,
  pickup_pincode TEXT,
  pickup_city TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active')),
  commission_rate NUMERIC(5, 2) DEFAULT 5.00,
  total_products INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(15, 2) DEFAULT 0.00,
  rating NUMERIC(3, 1) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS pickup_pincode TEXT,
  ADD COLUMN IF NOT EXISTS pickup_city TEXT;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON public.sellers(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON public.sellers(status);

-- Create RLS policies
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own seller profile
DROP POLICY IF EXISTS "Users can view their own seller profile"
ON public.sellers;

CREATE POLICY "Users can view their own seller profile" ON public.sellers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert their own seller profile
DROP POLICY IF EXISTS "Users can create their own seller profile"
ON public.sellers;

CREATE POLICY "Users can create their own seller profile" ON public.sellers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own seller profile
DROP POLICY IF EXISTS "Users can update their own seller profile"
ON public.sellers;

CREATE POLICY "Users can update their own seller profile" ON public.sellers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow public to view active sellers (for future storefront)
DROP POLICY IF EXISTS "Public can view active sellers"
ON public.sellers;

CREATE POLICY "Public can view active sellers" ON public.sellers
  FOR SELECT
  USING (status = 'active');

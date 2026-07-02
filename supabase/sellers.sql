-- Create sellers table
CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) NOT NULL CHECK (business_type IN ('individual', 'business')),
  category VARCHAR(100) NOT NULL,
  gst_number VARCHAR(15),
  description TEXT,
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

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);

-- Create RLS policies
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own seller profile
CREATE POLICY "Users can view their own seller profile" ON sellers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own seller profile
CREATE POLICY "Users can create their own seller profile" ON sellers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own seller profile
CREATE POLICY "Users can update their own seller profile" ON sellers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow public to view active sellers (for future storefront)
CREATE POLICY "Public can view active sellers" ON sellers
  FOR SELECT
  USING (status = 'active');

-- Create banners table
CREATE TABLE IF NOT EXISTS banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT, -- URL to navigate when banner is clicked (optional)
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0, -- Order for displaying banners
  click_count INTEGER DEFAULT 0, -- Track banner clicks
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_display_order ON banners(display_order);
CREATE INDEX IF NOT EXISTS idx_banners_created_at ON banners(created_at DESC);

-- Enable Row Level Security
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for banners
-- Everyone can read active banners
CREATE POLICY "Anyone can read active banners" ON banners
  FOR SELECT USING (is_active = true);

-- Only admins can manage banners (handled via service role in API)

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on banner updates
CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW
  EXECUTE FUNCTION update_banners_updated_at();

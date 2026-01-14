-- Create utility_settings table
CREATE TABLE IF NOT EXISTS utility_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'disabled',
  category TEXT NOT NULL,
  markup DECIMAL(5,2) DEFAULT 0,
  min_amount DECIMAL(10,2),
  max_amount DECIMAL(10,2),
  api_endpoint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Create utility_network_prices table
CREATE TABLE IF NOT EXISTS utility_network_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id TEXT NOT NULL REFERENCES utility_settings(id) ON DELETE CASCADE,
  network TEXT NOT NULL,
  markup DECIMAL(5,2) DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(service_id, network)
);

-- Create utility_transactions table for tracking utility purchases
CREATE TABLE IF NOT EXISTS utility_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  service_id TEXT NOT NULL REFERENCES utility_settings(id),
  network TEXT,
  phone_number TEXT,
  amount DECIMAL(10,2) NOT NULL,
  markup_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  clubkonnect_reference TEXT,
  clubkonnect_response TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_utility_settings_category ON utility_settings(category);
CREATE INDEX IF NOT EXISTS idx_utility_settings_status ON utility_settings(status);
CREATE INDEX IF NOT EXISTS idx_utility_network_prices_service ON utility_network_prices(service_id);
CREATE INDEX IF NOT EXISTS idx_utility_transactions_user ON utility_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_utility_transactions_service ON utility_transactions(service_id);
CREATE INDEX IF NOT EXISTS idx_utility_transactions_status ON utility_transactions(status);
CREATE INDEX IF NOT EXISTS idx_utility_transactions_created ON utility_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE utility_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_network_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for utility_settings (admin only)
CREATE POLICY "Admins can view utility settings" ON utility_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage utility settings" ON utility_settings
  FOR ALL USING (true);

-- RLS Policies for utility_network_prices (admin only)
CREATE POLICY "Admins can view network prices" ON utility_network_prices
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage network prices" ON utility_network_prices
  FOR ALL USING (true);

-- RLS Policies for utility_transactions (users can view their own)
CREATE POLICY "Users can view their own utility transactions" ON utility_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own utility transactions" ON utility_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all utility transactions
CREATE POLICY "Admins can view all utility transactions" ON utility_transactions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage utility transactions" ON utility_transactions
  FOR ALL USING (true);


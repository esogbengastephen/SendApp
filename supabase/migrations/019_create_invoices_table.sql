-- Migration 019: Create invoices table for invoice generation feature

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL, -- Unique invoice identifier (e.g., INV-2024-001)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18, 8) NOT NULL, -- Increased precision for crypto amounts
  currency TEXT NOT NULL DEFAULT 'NGN', -- Currency code: NGN, SEND, ETH, SOL, BTC, etc.
  crypto_chain_id TEXT, -- Chain ID if crypto (e.g., 'base', 'solana', 'ethereum')
  crypto_address TEXT, -- Wallet address for crypto payments
  description TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT REFERENCES transactions(transaction_id) ON DELETE SET NULL, -- Link to payment transaction
  paystack_reference TEXT, -- Paystack payment reference
  metadata JSONB, -- Additional invoice data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own invoices
CREATE POLICY "Users can view their own invoices" ON invoices
  FOR SELECT
  USING (auth.uid()::text = user_id::text OR EXISTS (
    SELECT 1 FROM users WHERE id = invoices.user_id AND email = (SELECT email FROM users WHERE id::text = auth.uid()::text)
  ));

-- Users can create their own invoices
CREATE POLICY "Users can create their own invoices" ON invoices
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text OR EXISTS (
    SELECT 1 FROM users WHERE id = invoices.user_id AND email = (SELECT email FROM users WHERE id::text = auth.uid()::text)
  ));

-- Users can update their own invoices (only if pending)
CREATE POLICY "Users can update their own pending invoices" ON invoices
  FOR UPDATE
  USING (auth.uid()::text = user_id::text OR EXISTS (
    SELECT 1 FROM users WHERE id = invoices.user_id AND email = (SELECT email FROM users WHERE id::text = auth.uid()::text)
  ))
  WITH CHECK (status = 'pending'); -- Only allow updates to pending invoices

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the last sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';
  
  -- Format: INV-YYYY-XXXXX (5 digits)
  invoice_num := 'INV-' || year_part || '-' || LPAD(sequence_num::TEXT, 5, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- Migration 020: Add business invoice fields for personal/business invoice types
-- Description: Allows users to set up business information for professional invoices

-- Add business fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'personal' CHECK (invoice_type IN ('personal', 'business')),
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_logo_url TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS business_city TEXT,
ADD COLUMN IF NOT EXISTS business_state TEXT,
ADD COLUMN IF NOT EXISTS business_zip TEXT,
ADD COLUMN IF NOT EXISTS business_phone TEXT;

-- Add comments for documentation
COMMENT ON COLUMN users.invoice_type IS 'Invoice type: personal or business';
COMMENT ON COLUMN users.business_name IS 'Business/company name for invoices';
COMMENT ON COLUMN users.business_logo_url IS 'URL to business logo image';
COMMENT ON COLUMN users.business_address IS 'Business street address';
COMMENT ON COLUMN users.business_city IS 'Business city';
COMMENT ON COLUMN users.business_state IS 'Business state/province';
COMMENT ON COLUMN users.business_zip IS 'Business ZIP/postal code';
COMMENT ON COLUMN users.business_phone IS 'Business phone number';

-- Create index for invoice type queries
CREATE INDEX IF NOT EXISTS idx_users_invoice_type ON users(invoice_type);

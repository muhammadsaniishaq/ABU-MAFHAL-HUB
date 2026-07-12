-- Add placement column to banners table
ALTER TABLE banners ADD COLUMN IF NOT EXISTS placement text DEFAULT 'dashboard';

-- Run this in your Supabase SQL Editor to add the necessary columns for Bigi API integration

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS vtu_vendor VARCHAR(50) DEFAULT 'clubkonnect',
ADD COLUMN IF NOT EXISTS bigi_api_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS bigi_api_pin VARCHAR(255);

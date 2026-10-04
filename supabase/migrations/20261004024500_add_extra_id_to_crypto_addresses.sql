-- Migration: 20261004024500_add_extra_id_to_crypto_addresses.sql
-- Add extra_id column for memo/tag/comment (crucial for TON, XRP, BNB, etc.)

ALTER TABLE public.crypto_addresses 
ADD COLUMN IF NOT EXISTS extra_id TEXT;

COMMENT ON COLUMN public.crypto_addresses.extra_id IS 'Memo, Comment, or Tag required for certain blockchains like TON, XRP, etc.';

-- ==============================================================================
-- Migration: 20260910060000_expand_transfer_activation_fields.sql
-- Description: Expand Transfer Activation Application fields with comprehensive
--              banking, BVN, frequency, category, next-of-kin, and PEP declarations.
-- ==============================================================================

-- 1. Ensure all new compliance and auditing columns exist
ALTER TABLE public.transfer_activation_requests
ADD COLUMN IF NOT EXISTS account_category text DEFAULT 'Individual',
ADD COLUMN IF NOT EXISTS bvn text,
ADD COLUMN IF NOT EXISTS destination_bank text,
ADD COLUMN IF NOT EXISTS destination_account_number text,
ADD COLUMN IF NOT EXISTS destination_account_name text,
ADD COLUMN IF NOT EXISTS daily_transfer_frequency text DEFAULT '1 - 5 transfers/day',
ADD COLUMN IF NOT EXISTS next_of_kin_address text,
ADD COLUMN IF NOT EXISTS security_secret_word text,
ADD COLUMN IF NOT EXISTS pep_declared boolean DEFAULT false;

-- 2. Add comments for database documentation
COMMENT ON COLUMN public.transfer_activation_requests.account_category IS 'Individual vs Business account classification';
COMMENT ON COLUMN public.transfer_activation_requests.bvn IS '11-digit Bank Verification Number for regulatory compliance';
COMMENT ON COLUMN public.transfer_activation_requests.destination_bank IS 'Primary destination/settlement bank';
COMMENT ON COLUMN public.transfer_activation_requests.destination_account_number IS '10-digit NUBAN destination account number';
COMMENT ON COLUMN public.transfer_activation_requests.destination_account_name IS 'Verified beneficiary name on destination bank';
COMMENT ON COLUMN public.transfer_activation_requests.daily_transfer_frequency IS 'Expected daily transfer volume frequency';
COMMENT ON COLUMN public.transfer_activation_requests.next_of_kin_address IS 'Physical residential address of next of kin';
COMMENT ON COLUMN public.transfer_activation_requests.security_secret_word IS 'Secret security word for manual/telephonic identity challenge';
COMMENT ON COLUMN public.transfer_activation_requests.pep_declared IS 'Flag indicating if applicant is a Politically Exposed Person';

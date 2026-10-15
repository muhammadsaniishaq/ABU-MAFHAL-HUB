-- Migration: Create Admin-Controlled Dynamic CAC Pricing System
-- File: 20261015120000_create_dynamic_cac_pricing_system.sql

-- 1. Create dedicated cac_pricing_configurations table
CREATE TABLE IF NOT EXISTS public.cac_pricing_configurations (
    id TEXT PRIMARY KEY,
    service_code TEXT NOT NULL UNIQUE,
    service_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'registration',
    description TEXT,
    regular_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    promo_price DECIMAL(12,2),
    is_promo_active BOOLEAN NOT NULL DEFAULT false,
    promo_start_at TIMESTAMP WITH TIME ZONE,
    promo_end_at TIMESTAMP WITH TIME ZONE,
    included_share_capital DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    share_capital_increment_step DECIMAL(14,2) NOT NULL DEFAULT 1000000.00,
    share_capital_increment_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    included_directors INTEGER NOT NULL DEFAULT 0,
    additional_director_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    included_shareholders INTEGER NOT NULL DEFAULT 0,
    additional_shareholder_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    included_trustees INTEGER NOT NULL DEFAULT 0,
    additional_trustee_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    processing_time TEXT NOT NULL DEFAULT '24 hours',
    is_available BOOLEAN NOT NULL DEFAULT true,
    quote_validity_hours INTEGER NOT NULL DEFAULT 24,
    pricing_rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES public.profiles(id)
);

-- 2. Create cac_pricing_audit_logs table
CREATE TABLE IF NOT EXISTS public.cac_pricing_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_code TEXT NOT NULL,
    admin_id UUID REFERENCES public.profiles(id),
    admin_email TEXT,
    change_type TEXT NOT NULL DEFAULT 'update',
    previous_config JSONB,
    new_config JSONB NOT NULL,
    summary TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.cac_pricing_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cac_pricing_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies for cac_pricing_configurations
DROP POLICY IF EXISTS "Public read access for cac_pricing_configurations" ON public.cac_pricing_configurations;
CREATE POLICY "Public read access for cac_pricing_configurations" 
ON public.cac_pricing_configurations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write access for cac_pricing_configurations" ON public.cac_pricing_configurations;
CREATE POLICY "Admin write access for cac_pricing_configurations" 
ON public.cac_pricing_configurations FOR ALL 
USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- 5. Policies for cac_pricing_audit_logs
DROP POLICY IF EXISTS "Admin view cac_pricing_audit_logs" ON public.cac_pricing_audit_logs;
CREATE POLICY "Admin view cac_pricing_audit_logs" 
ON public.cac_pricing_audit_logs FOR SELECT 
USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
);

DROP POLICY IF EXISTS "Admin insert cac_pricing_audit_logs" ON public.cac_pricing_audit_logs;
CREATE POLICY "Admin insert cac_pricing_audit_logs" 
ON public.cac_pricing_audit_logs FOR INSERT 
WITH CHECK (
    auth.role() = 'authenticated' AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- 6. Seed official baseline services
INSERT INTO public.cac_pricing_configurations (
    id, service_code, service_name, category, description,
    regular_price, promo_price, is_promo_active,
    included_share_capital, share_capital_increment_step, share_capital_increment_fee,
    included_directors, additional_director_fee,
    included_shareholders, additional_shareholder_fee,
    included_trustees, additional_trustee_fee,
    processing_time, is_available, quote_validity_hours
) VALUES 
(
    'business_name', 'business_name', 'Business Name Registration', 'registration',
    'Official CAC certificate and status document for sole proprietorship and partnerships.',
    40000.00, 38000.00, true,
    0.00, 1000000.00, 0.00,
    0, 0.00,
    0, 0.00,
    0, 0.00,
    '24 hours', true, 24
),
(
    'ltd', 'ltd', 'Private Limited Liability Company (LTD)', 'company',
    'Full CAC incorporation with certificate, status document, and memorandum of association.',
    100000.00, 80000.00, true,
    1000000.00, 1000000.00, 30000.00,
    2, 5000.00,
    2, 0.00,
    0, 0.00,
    '3 - 5 Business Days', true, 24
),
(
    'plc', 'plc', 'Public Limited Liability Company (PLC)', 'company',
    'Comprehensive incorporation for public commercial enterprises and conglomerates.',
    200000.00, 200000.00, false,
    2000000.00, 1000000.00, 40000.00,
    2, 0.00,
    2, 0.00,
    0, 0.00,
    '5 - 7 Business Days', true, 24
),
(
    'incorporated_trustee', 'incorporated_trustee', 'Incorporated Trustee', 'trustee',
    'Official registration for NGOs, Foundations, Churches, Mosques, and Community Associations.',
    200000.00, 160000.00, true,
    0.00, 1000000.00, 0.00,
    0, 0.00,
    0, 0.00,
    2, 5000.00,
    '7 - 14 Business Days', true, 24
),
(
    'upgrade_to_ltd', 'upgrade_to_ltd', 'Business Name to LTD Upgrade', 'upgrade',
    'Official transition of registered business name to limited liability company structure.',
    100000.00, 90000.00, true,
    1000000.00, 1000000.00, 30000.00,
    2, 5000.00,
    2, 0.00,
    0, 0.00,
    '5 - 7 Business Days', true, 24
),
(
    'cac_retrieval', 'cac_retrieval', 'CAC Certificate Retrieval / Document Search', 'search',
    'Official certified true copy (CTC) retrieval and registry status document search.',
    4000.00, 4000.00, false,
    0.00, 1000000.00, 0.00,
    0, 0.00,
    0, 0.00,
    0, 0.00,
    '24 hours', true, 24
)
ON CONFLICT (service_code) DO UPDATE SET
    regular_price = EXCLUDED.regular_price,
    promo_price = EXCLUDED.promo_price,
    included_share_capital = EXCLUDED.included_share_capital,
    share_capital_increment_step = EXCLUDED.share_capital_increment_step,
    share_capital_increment_fee = EXCLUDED.share_capital_increment_fee,
    included_directors = EXCLUDED.included_directors,
    additional_director_fee = EXCLUDED.additional_director_fee,
    included_trustees = EXCLUDED.included_trustees,
    additional_trustee_fee = EXCLUDED.additional_trustee_fee,
    processing_time = EXCLUDED.processing_time;

-- 7. Sync into legacy cac_pricing table for existing foreign keys and backwards compatibility
INSERT INTO public.cac_pricing (name, price, active, original_price, discount_label) VALUES
('Business Name Registration', 38000.00, true, 40000.00, '5% OFF'),
('Private Limited Liability Company (LTD)', 80000.00, true, 100000.00, '20% OFF'),
('Public Limited Liability Company (PLC)', 200000.00, true, 200000.00, NULL),
('Incorporated Trustee', 160000.00, true, 200000.00, '20% OFF'),
('Business Name to LTD Upgrade', 90000.00, true, 100000.00, '10% OFF')
ON CONFLICT (name) DO UPDATE SET
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    discount_label = EXCLUDED.discount_label,
    active = true;

-- 8. Enhanced server-side submit_cac_request function calculating dynamic rules securely
CREATE OR REPLACE FUNCTION submit_cac_request(
    p_pricing_id UUID,
    p_registration_type TEXT,
    p_proposed_names JSONB,
    p_business_info JSONB,
    p_proprietors JSONB,
    p_chairman JSONB,
    p_secretary JSONB,
    p_trustees JSONB,
    p_aims_and_objectives TEXT,
    p_cost DECIMAL -- Client requested cost (validated and overwritten by server)
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_wallet_balance DECIMAL(12,2);
    v_calculated_cost DECIMAL(12,2) := 0.00;
    v_base_price DECIMAL(12,2) := 0.00;
    v_config public.cac_pricing_configurations%ROWTYPE;
    v_matched_code TEXT;
    v_share_capital DECIMAL(14,2) := 0.00;
    v_directors_count INT := 0;
    v_shareholders_count INT := 0;
    v_trustees_count INT := 0;
    v_extra_share_capital_increments INT := 0;
    v_share_capital_fee DECIMAL(12,2) := 0.00;
    v_extra_directors INT := 0;
    v_directors_fee DECIMAL(12,2) := 0.00;
    v_extra_shareholders INT := 0;
    v_shareholders_fee DECIMAL(12,2) := 0.00;
    v_extra_trustees INT := 0;
    v_trustees_fee DECIMAL(12,2) := 0.00;
    v_tin_fee DECIMAL(12,2) := 0.00;
    v_apply_with_tin BOOLEAN := false;
    v_tin_setting TEXT;
    v_request_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Match service code from registration type string or pricing id
    IF p_registration_type ILIKE '%upgrade%' THEN
        v_matched_code := 'upgrade_to_ltd';
    ELSIF p_registration_type ILIKE '%public limited%' OR p_registration_type ILIKE '%plc%' THEN
        v_matched_code := 'plc';
    ELSIF p_registration_type ILIKE '%private limited%' OR p_registration_type ILIKE '%ltd%' OR p_registration_type ILIKE '%limited liability%' THEN
        v_matched_code := 'ltd';
    ELSIF p_registration_type ILIKE '%trustee%' OR p_registration_type ILIKE '%ngo%' OR p_registration_type ILIKE '%club%' THEN
        v_matched_code := 'incorporated_trustee';
    ELSIF p_registration_type ILIKE '%retrieval%' OR p_registration_type ILIKE '%search%' THEN
        v_matched_code := 'cac_retrieval';
    ELSE
        v_matched_code := 'business_name';
    END IF;

    -- Fetch latest saved admin configuration
    SELECT * INTO v_config
    FROM public.cac_pricing_configurations
    WHERE service_code = v_matched_code;

    IF v_config.id IS NULL THEN
        -- Fallback to legacy cac_pricing if not yet migrated in db
        SELECT price INTO v_base_price FROM public.cac_pricing WHERE id = p_pricing_id;
        IF v_base_price IS NULL THEN
            v_base_price := 40000.00;
        END IF;
    ELSE
        -- Check if service is marked available by admin
        IF NOT v_config.is_available THEN
            RAISE EXCEPTION 'This CAC registration service is temporarily unavailable. Please contact support.';
        END IF;

        -- Check promotional pricing validity with server-side time
        IF v_config.is_promo_active AND v_config.promo_price IS NOT NULL AND v_config.promo_price > 0 THEN
            IF (v_config.promo_start_at IS NULL OR v_now >= v_config.promo_start_at) AND
               (v_config.promo_end_at IS NULL OR v_now <= v_config.promo_end_at) THEN
                v_base_price := v_config.promo_price;
            ELSE
                v_base_price := v_config.regular_price;
            END IF;
        ELSE
            v_base_price := v_config.regular_price;
        END IF;

        -- 1. Share capital increment fee calculation
        IF (p_business_info->>'share_capital') IS NOT NULL THEN
            v_share_capital := COALESCE((p_business_info->>'share_capital')::DECIMAL, 0.00);
        END IF;

        IF v_config.share_capital_increment_fee > 0 AND v_config.share_capital_increment_step > 0 AND v_share_capital > v_config.included_share_capital THEN
            v_extra_share_capital_increments := CEIL((v_share_capital - v_config.included_share_capital) / v_config.share_capital_increment_step);
            v_share_capital_fee := v_extra_share_capital_increments * v_config.share_capital_increment_fee;
        END IF;

        -- 2. Directors fee calculation
        IF p_proprietors IS NOT NULL AND jsonb_typeof(p_proprietors) = 'array' THEN
            v_directors_count := jsonb_array_length(p_proprietors);
        ELSIF (p_business_info->>'directors_count') IS NOT NULL THEN
            v_directors_count := COALESCE((p_business_info->>'directors_count')::INT, 1);
        ELSE
            v_directors_count := 1;
        END IF;

        IF v_config.additional_director_fee > 0 AND v_directors_count > v_config.included_directors AND v_config.included_directors > 0 THEN
            v_extra_directors := v_directors_count - v_config.included_directors;
            v_directors_fee := v_extra_directors * v_config.additional_director_fee;
        END IF;

        -- 3. Shareholders fee calculation
        IF (p_business_info->>'shareholders_count') IS NOT NULL THEN
            v_shareholders_count := COALESCE((p_business_info->>'shareholders_count')::INT, 0);
            IF v_config.additional_shareholder_fee > 0 AND v_shareholders_count > v_config.included_shareholders AND v_config.included_shareholders > 0 THEN
                v_extra_shareholders := v_shareholders_count - v_config.included_shareholders;
                v_shareholders_fee := v_extra_shareholders * v_config.additional_shareholder_fee;
            END IF;
        END IF;

        -- 4. Trustees fee calculation
        IF p_trustees IS NOT NULL AND jsonb_typeof(p_trustees) = 'array' THEN
            v_trustees_count := jsonb_array_length(p_trustees);
        ELSIF (p_business_info->>'trustees_count') IS NOT NULL THEN
            v_trustees_count := COALESCE((p_business_info->>'trustees_count')::INT, 1);
        ELSE
            v_trustees_count := 0;
        END IF;

        IF v_config.additional_trustee_fee > 0 AND v_trustees_count > v_config.included_trustees AND v_config.included_trustees > 0 THEN
            v_extra_trustees := v_trustees_count - v_config.included_trustees;
            v_trustees_fee := v_extra_trustees * v_config.additional_trustee_fee;
        END IF;
    END IF;

    -- 5. TIN Add-on calculation
    IF (p_business_info->>'apply_with_tin') IS NOT NULL THEN
        v_apply_with_tin := (p_business_info->>'apply_with_tin')::BOOLEAN;
    END IF;

    IF v_apply_with_tin THEN
        SELECT value INTO v_tin_setting FROM public.app_settings WHERE key = 'cac_tin_fee' LIMIT 1;
        IF v_tin_setting IS NOT NULL AND v_tin_setting ~ '^[0-9]+(\.[0-9]+)?$' THEN
            v_tin_fee := v_tin_setting::DECIMAL;
        ELSE
            v_tin_fee := 3000.00;
        END IF;
    END IF;

    -- Final verified cost
    v_calculated_cost := v_base_price + v_share_capital_fee + v_directors_fee + v_shareholders_fee + v_trustees_fee + v_tin_fee;

    -- Lock profile and check balance
    SELECT balance INTO v_wallet_balance
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_wallet_balance IS NULL THEN
        RAISE EXCEPTION 'Wallet account not found';
    END IF;

    IF v_wallet_balance < v_calculated_cost THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Total required is ₦%', TRIM(TO_CHAR(v_calculated_cost, '999,999,999.00'));
    END IF;

    -- Deduct actual calculated cost
    UPDATE public.profiles
    SET balance = balance - v_calculated_cost
    WHERE id = v_user_id;

    -- Record request with enriched verified pricing breakdown
    INSERT INTO public.cac_requests (
        user_id, pricing_id, registration_type, proposed_names, 
        business_info, proprietors, chairman, secretary, trustees, aims_and_objectives, 
        cost_charged
    ) VALUES (
        v_user_id, p_pricing_id, p_registration_type, p_proposed_names,
        p_business_info || jsonb_build_object(
            'verified_base_price', v_base_price,
            'verified_share_capital_fee', v_share_capital_fee,
            'verified_directors_fee', v_directors_fee,
            'verified_shareholders_fee', v_shareholders_fee,
            'verified_trustees_fee', v_trustees_fee,
            'verified_tin_fee', v_tin_fee,
            'verified_total_cost', v_calculated_cost,
            'pricing_server_timestamp', v_now
        ),
        p_proprietors, p_chairman, p_secretary, p_trustees, p_aims_and_objectives, 
        v_calculated_cost
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

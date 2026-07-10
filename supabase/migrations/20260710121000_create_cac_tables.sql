-- Create cac_pricing table
CREATE TABLE IF NOT EXISTS public.cac_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial pricing data
INSERT INTO public.cac_pricing (name, price) VALUES
('Business Name — Sole Proprietorship', 25000),
('Business Name — Partnership', 35000),
('Limited Liability (N1M Share)', 65000),
('NGO / Association / Club', 150000)
ON CONFLICT (name) DO NOTHING;

-- Create cac_requests table
CREATE TABLE IF NOT EXISTS public.cac_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    pricing_id UUID REFERENCES public.cac_pricing(id) NOT NULL,
    registration_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, queried, completed, rejected
    proposed_names JSONB NOT NULL,
    business_info JSONB NOT NULL,
    proprietors JSONB,
    chairman JSONB,
    secretary JSONB,
    trustees JSONB,
    aims_and_objectives TEXT,
    cost_charged DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    admin_query TEXT,
    certificate_url TEXT,
    status_document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.cac_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cac_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cac_pricing
CREATE POLICY "Public read access for cac_pricing" ON public.cac_pricing
    FOR SELECT USING (true);

CREATE POLICY "Admin full access for cac_pricing" ON public.cac_pricing
    FOR ALL USING (auth.role() = 'authenticated' AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for cac_requests
CREATE POLICY "Users can view own cac_requests" ON public.cac_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cac_requests" ON public.cac_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access for cac_requests" ON public.cac_requests
    FOR ALL USING (auth.role() = 'authenticated' AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Setup storage bucket for cac_documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cac_documents', 'cac_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for cac_documents
CREATE POLICY "Public Access for cac_documents" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'cac_documents');

CREATE POLICY "Authenticated users can upload to cac_documents" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'cac_documents' AND auth.role() = 'authenticated');

CREATE POLICY "Admin Delete Access for cac_documents" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'cac_documents' AND auth.role() = 'authenticated' AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- RPC to submit CAC request and deduct wallet
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
    p_cost DECIMAL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_wallet_balance DECIMAL;
    v_request_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get wallet balance with row lock
    SELECT balance INTO v_wallet_balance
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_wallet_balance IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    IF v_wallet_balance < p_cost THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    -- Deduct balance
    UPDATE profiles
    SET balance = balance - p_cost
    WHERE id = v_user_id;

    -- Insert request
    INSERT INTO cac_requests (
        user_id, pricing_id, registration_type, proposed_names, business_info, 
        proprietors, chairman, secretary, trustees, aims_and_objectives, cost_charged
    ) VALUES (
        v_user_id, p_pricing_id, p_registration_type, p_proposed_names, p_business_info,
        p_proprietors, p_chairman, p_secretary, p_trustees, p_aims_and_objectives, p_cost
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

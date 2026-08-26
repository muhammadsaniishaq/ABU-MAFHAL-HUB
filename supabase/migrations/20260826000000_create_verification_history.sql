-- Create verification_history table for permanent storage of all NIN & BVN tasks, slips, and verifications
CREATE TABLE IF NOT EXISTS public.verification_history (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_category TEXT NOT NULL, -- 'nin', 'bvn', 'cac', 'tin', 'other'
    service_type TEXT NOT NULL,
    search_number TEXT,
    holder_name TEXT,
    layout TEXT DEFAULT 'standard',
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.verification_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users and admins to view, insert, update, and manage records
DROP POLICY IF EXISTS "Allow authenticated users to read verification_history" ON public.verification_history;
CREATE POLICY "Allow authenticated users to read verification_history"
    ON public.verification_history FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert verification_history" ON public.verification_history;
CREATE POLICY "Allow authenticated users to insert verification_history"
    ON public.verification_history FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update verification_history" ON public.verification_history;
CREATE POLICY "Allow authenticated users to update verification_history"
    ON public.verification_history FOR UPDATE
    USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete verification_history" ON public.verification_history;
CREATE POLICY "Allow authenticated users to delete verification_history"
    ON public.verification_history FOR DELETE
    USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

-- Ensure public access fallback for Edge Functions and anonymous verification callbacks
DROP POLICY IF EXISTS "Allow public read access on verification_history" ON public.verification_history;
CREATE POLICY "Allow public read access on verification_history"
    ON public.verification_history FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert on verification_history" ON public.verification_history;
CREATE POLICY "Allow public insert on verification_history"
    ON public.verification_history FOR INSERT
    WITH CHECK (true);

-- Ensure transactions table allows admins and service functions to read all transaction history
DROP POLICY IF EXISTS "Allow admins and auth users to read transactions" ON public.transactions;
CREATE POLICY "Allow admins and auth users to read transactions"
    ON public.transactions FOR SELECT
    USING (
        auth.uid() = user_id OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') OR
        (SELECT (raw_app_meta_data->>'role')::text FROM auth.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
    );

-- Backfill existing NIN and BVN records from transactions table into verification_history
INSERT INTO public.verification_history (id, user_id, service_category, service_type, search_number, holder_name, layout, details, created_at)
SELECT 
    'tx_backfill_' || id::text,
    user_id,
    CASE 
        WHEN lower(type) LIKE '%bvn%' OR lower(description) LIKE '%bvn%' OR lower(description) LIKE '%nibss%' THEN 'bvn'
        ELSE 'nin'
    END AS service_category,
    COALESCE(type, 'verification'),
    COALESCE(reference, id::text),
    COALESCE((SELECT full_name FROM public.profiles WHERE profiles.id = transactions.user_id), 'Applicant Record'),
    'standard',
    jsonb_build_object(
        'amount', amount,
        'reference', reference,
        'description', description,
        'status', CASE WHEN status = 'success' THEN 'COMPLETED' ELSE upper(status) END,
        'source', 'transactions_backfill'
    ),
    created_at
FROM public.transactions
WHERE 
    lower(type) LIKE '%nin%' OR 
    lower(type) LIKE '%bvn%' OR 
    lower(type) LIKE '%ipe%' OR 
    lower(type) LIKE '%val%' OR 
    lower(type) LIKE '%pers%' OR 
    lower(description) LIKE '%nin%' OR 
    lower(description) LIKE '%bvn%' OR 
    lower(description) LIKE '%ipe%' OR 
    lower(description) LIKE '%verification%' OR
    lower(description) LIKE '%modification%' OR
    lower(description) LIKE '%slip%'
ON CONFLICT (id) DO NOTHING;

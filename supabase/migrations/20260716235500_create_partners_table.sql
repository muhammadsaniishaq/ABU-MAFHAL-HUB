-- Create the partners table
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Policies for the partners table
CREATE POLICY "Public can view partners" 
    ON public.partners FOR SELECT 
    USING (true);

CREATE POLICY "Admins can insert partners" 
    ON public.partners FOR INSERT 
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update partners" 
    ON public.partners FOR UPDATE 
    USING (public.is_admin());

CREATE POLICY "Admins can delete partners" 
    ON public.partners FOR DELETE 
    USING (public.is_admin());

-- Create the partners storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partners', 'partners', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for Partners Bucket
CREATE POLICY "Public can view partners images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'partners');

CREATE POLICY "Admins can upload partners images" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'partners' 
    AND public.is_admin()
);

CREATE POLICY "Admins can update partners images" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'partners' 
    AND public.is_admin()
);

CREATE POLICY "Admins can delete partners images" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'partners' 
    AND public.is_admin()
);
